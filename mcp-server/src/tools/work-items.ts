import { z } from 'zod'
import { supabase, getProjectId, getProjectOwnerId, getActorIds } from '../supabase.js'
import { resolveProjectId, logAgentAction } from '../auth.js'
import { toolSuccess, toolError } from '../types.js'
import type { AgentContext } from '../auth.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const MAX_POSITION_INSERT_ATTEMPTS = 5

async function getNextPosition(
  projectId: string,
  parentId: string | null
): Promise<number> {
  const query = supabase
    .from('work_items')
    .select('position')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)

  if (parentId) {
    query.eq('parent_id', parentId)
  } else {
    query.is('parent_id', null)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data && data.length > 0 ? data[0].position + 1 : 0
}

async function resolveStatusId(
  projectId: string,
  statusName: string
): Promise<string> {
  const { data, error } = await supabase
    .from('statuses')
    .select('id')
    .eq('project_id', projectId)
    .ilike('name', statusName)
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error(`Status "${statusName}" not found in project`)
  }
  return data.id
}

async function resolveTrackerId(
  projectId: string,
  trackerName: string
): Promise<string> {
  const { data, error } = await supabase
    .from('trackers')
    .select('id')
    .eq('project_id', projectId)
    .ilike('name', trackerName)
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error(`Tracker "${trackerName}" not found in project`)
  }
  return data.id
}

async function resolveWorkItemByNumber(
  projectId: string,
  number: number
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('work_items')
    .select('id')
    .eq('project_id', projectId)
    .eq('number', number)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    throw new Error(`Work item #${number} not found`)
  }
  return data
}

/** Resolve project ID from either AgentContext or legacy env var */
async function getResolvedProjectId(agentCtx: AgentContext | null, projectKey?: string): Promise<string> {
  if (agentCtx) {
    return resolveProjectId(agentCtx, projectKey)
  }
  return getProjectId()
}

/** Get actor IDs — from AgentContext or legacy env var */
async function getResolvedActorIds(agentCtx: AgentContext | null): Promise<{ profileId: string | null; agentId: string | null }> {
  if (agentCtx) {
    return { profileId: null, agentId: agentCtx.agentId }
  }
  return getActorIds()
}

export function registerWorkItemTools(server: McpServer, agentCtx: AgentContext | null = null) {
  // ── create_task ──
  server.tool(
    'create_task',
    'Create a new task (work item). Use tracker and status names (e.g., "Task", "Open") — UUIDs are resolved automatically.',
    {
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description (markdown supported)'),
      tracker: z.string().default('Task').describe('Tracker name, e.g., "Feature", "Bug", "Task"'),
      status: z.string().default('Open').describe('Status name, e.g., "Open", "In Progress", "Resolved"'),
      priority: z.number().min(0).max(4).default(0).describe('Priority: 0=none, 1=low, 2=medium, 3=high, 4=critical'),
      assignee_id: z.string().uuid().optional().describe('Assignee profile UUID'),
      assign_to_self: z.boolean().default(false).describe('Assign to the current agent'),
      reporter_id: z.string().uuid().optional().describe('Reporter profile UUID (legacy mode)'),
      parent_number: z.number().optional().describe('Parent task number to create as subtask'),
      project_key: z.string().optional().describe('Project key (required if agent has multiple projects)'),
    },
    async (args) => {
      try {
        const projectId = await getResolvedProjectId(agentCtx, args.project_key)
        const actorIds = await getResolvedActorIds(agentCtx)

        const [trackerId, statusId] = await Promise.all([
          resolveTrackerId(projectId, args.tracker),
          resolveStatusId(projectId, args.status),
        ])

        let parentId: string | null = null
        if (args.parent_number) {
          const parent = await resolveWorkItemByNumber(projectId, args.parent_number)
          parentId = parent.id
        }

        // Position with retry on conflict
        let lastError: Error | null = null
        for (let attempt = 0; attempt < MAX_POSITION_INSERT_ATTEMPTS; attempt++) {
          const position = await getNextPosition(projectId, parentId)

          const insertData: Record<string, unknown> = {
            project_id: projectId,
            tracker_id: trackerId,
            status_id: statusId,
            title: args.title,
            description: args.description ?? null,
            priority: args.priority,
            parent_id: parentId,
            position,
            created_by_ai: true,
            ai_metadata: { model: 'mcp-server', last_action: 'create', agent_id: actorIds.agentId },
          }

          // Reporter: agent or profile
          if (actorIds.agentId) {
            insertData.agent_reporter_id = actorIds.agentId
            // reporter_id is now nullable (migration 034)
          } else {
            const reporterId = args.reporter_id || await getProjectOwnerId()
            insertData.reporter_id = reporterId
          }

          // Assignee: self (agent), profile, or none
          // CHECK: NOT (assignee_id IS NOT NULL AND agent_assignee_id IS NOT NULL)
          if (args.assign_to_self && actorIds.agentId) {
            insertData.agent_assignee_id = actorIds.agentId
          } else if (args.assignee_id) {
            insertData.assignee_id = args.assignee_id
          }

          const { data, error } = await supabase
            .from('work_items')
            .insert(insertData)
            .select('id, number, title, position')
            .single()

          if (!error && data) {
            if (agentCtx) {
              await logAgentAction(agentCtx.agentId, 'create_task', {
                work_item_id: data.id, number: data.number, title: data.title,
              })
            }
            return toolSuccess({
              success: true,
              task: data,
              message: `Created task #${data.number}: ${data.title}`,
            })
          }

          // Position conflict → retry
          if (error?.code === '23505' && error.message?.includes('position')) {
            lastError = new Error(error.message)
            continue
          }

          return toolError('INTERNAL_ERROR', `Error creating task: ${error.message}`)
        }

        return toolError('CONFLICT', `Position conflict after ${MAX_POSITION_INSERT_ATTEMPTS} attempts: ${lastError?.message}`)
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── update_task ──
  server.tool(
    'update_task',
    'Update an existing task by its number. Change status, title, description, priority, or assignee.',
    {
      number: z.number().describe('Work item number (e.g., 42)'),
      status: z.string().optional().describe('New status name, e.g., "In Progress"'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      priority: z.number().min(0).max(4).optional().describe('New priority'),
      assignee_id: z.string().uuid().nullable().optional().describe('New assignee UUID or null'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = await getResolvedProjectId(agentCtx, args.project_key)
        const actorIds = await getResolvedActorIds(agentCtx)

        // Set agent context for audit log trigger
        if (actorIds.agentId) {
          try {
            await supabase.rpc('set_agent_context', { p_agent_id: actorIds.agentId })
          } catch {
            // Ignore if function doesn't exist yet (backward compat)
          }
        }

        const workItem = await resolveWorkItemByNumber(projectId, args.number)

        const updates: Record<string, unknown> = {
          ai_metadata: { model: 'mcp-server', last_action: 'update', updated_fields: [] as string[], agent_id: actorIds.agentId },
        }
        const updatedFields: string[] = []

        if (args.status) {
          updates.status_id = await resolveStatusId(projectId, args.status)
          updatedFields.push('status')
        }
        if (args.title !== undefined) {
          updates.title = args.title
          updatedFields.push('title')
        }
        if (args.description !== undefined) {
          updates.description = args.description
          updatedFields.push('description')
        }
        if (args.priority !== undefined) {
          updates.priority = args.priority
          updatedFields.push('priority')
        }
        if (args.assignee_id !== undefined) {
          updates.assignee_id = args.assignee_id
          updatedFields.push('assignee')
        }

        ;(updates.ai_metadata as { updated_fields: string[] }).updated_fields = updatedFields

        if (updatedFields.length === 0) {
          return toolError('VALIDATION_ERROR', 'No fields to update')
        }

        const { data, error } = await supabase
          .from('work_items')
          .update(updates)
          .eq('id', workItem.id)
          .select('id, number, title')
          .single()

        if (error) return toolError('INTERNAL_ERROR', `Error updating task: ${error.message}`)

        if (agentCtx) {
          await logAgentAction(agentCtx.agentId, 'update_task', {
            work_item_id: data.id, number: data.number, updated_fields: updatedFields,
          })
        }

        return toolSuccess({
          success: true,
          task: data,
          updated_fields: updatedFields,
          message: `Updated task #${data.number}: ${updatedFields.join(', ')}`,
        })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── list_tasks ──
  server.tool(
    'list_tasks',
    'List tasks in the project. Filter by status, tracker, assignee, or parent.',
    {
      status: z.string().optional().describe('Filter by status name'),
      tracker: z.string().optional().describe('Filter by tracker name'),
      assignee_id: z.string().uuid().optional().describe('Filter by assignee UUID'),
      parent_number: z.number().optional().describe('List children of this task number'),
      limit: z.number().min(1).max(200).default(50).describe('Max results'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = await getResolvedProjectId(agentCtx, args.project_key)

        let query = supabase
          .from('work_items')
          .select(`
            id, number, title, description, priority, position, parent_id,
            start_date, due_date, created_at, updated_at,
            tracker:trackers(id, name, color),
            status:statuses(id, name, color, is_closed),
            assignee:profiles!work_items_assignee_id_fkey(id, full_name),
            agent_assignee:agents!work_items_agent_assignee_id_fkey(id, display_name)
          `)
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .order('number', { ascending: false })
          .limit(args.limit)

        if (args.status) {
          const statusId = await resolveStatusId(projectId, args.status)
          query = query.eq('status_id', statusId)
        }
        if (args.tracker) {
          const trackerId = await resolveTrackerId(projectId, args.tracker)
          query = query.eq('tracker_id', trackerId)
        }
        if (args.assignee_id) {
          query = query.eq('assignee_id', args.assignee_id)
        }
        if (args.parent_number !== undefined) {
          if (args.parent_number === 0) {
            query = query.is('parent_id', null)
          } else {
            const parent = await resolveWorkItemByNumber(projectId, args.parent_number)
            query = query.eq('parent_id', parent.id)
          }
        }

        const { data, error } = await query
        if (error) return toolError('INTERNAL_ERROR', error.message)

        return toolSuccess({ count: data.length, tasks: data })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── get_task ──
  server.tool(
    'get_task',
    'Get detailed information about a single task by its number.',
    {
      number: z.number().describe('Work item number'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = await getResolvedProjectId(agentCtx, args.project_key)

        const { data, error } = await supabase
          .from('work_items')
          .select(`
            id, number, title, description, priority, position, parent_id,
            start_date, due_date, estimated_hours, actual_hours,
            created_at, updated_at, created_by_ai, ai_metadata,
            tracker:trackers(id, name, color),
            status:statuses(id, name, color, is_closed),
            assignee:profiles!work_items_assignee_id_fkey(id, full_name, avatar_url),
            reporter:profiles!work_items_reporter_id_fkey(id, full_name, avatar_url),
            agent_assignee:agents!work_items_agent_assignee_id_fkey(id, name, display_name),
            agent_reporter:agents!work_items_agent_reporter_id_fkey(id, name, display_name)
          `)
          .eq('project_id', projectId)
          .eq('number', args.number)
          .is('deleted_at', null)
          .single()

        if (error) return toolError('NOT_FOUND', `Task #${args.number} not found: ${error.message}`)

        return toolSuccess(data)
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── add_comment ──
  server.tool(
    'add_comment',
    'Add a comment to a task by its number. Attributed to the current agent or project owner.',
    {
      number: z.number().describe('Work item number'),
      content: z.string().describe('Comment content (markdown supported)'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = await getResolvedProjectId(agentCtx, args.project_key)
        const actorIds = await getResolvedActorIds(agentCtx)
        const workItem = await resolveWorkItemByNumber(projectId, args.number)

        const insertData: Record<string, unknown> = {
          work_item_id: workItem.id,
          content: args.content,
        }

        // CHECK: NOT (author_id IS NOT NULL AND agent_id IS NOT NULL)
        if (actorIds.agentId) {
          insertData.agent_id = actorIds.agentId
        } else {
          const ownerId = await getProjectOwnerId()
          insertData.author_id = ownerId
        }

        const { data, error } = await supabase
          .from('comments')
          .insert(insertData)
          .select('id, content, created_at')
          .single()

        if (error) return toolError('INTERNAL_ERROR', `Error adding comment: ${error.message}`)

        if (agentCtx) {
          await logAgentAction(agentCtx.agentId, 'add_comment', {
            work_item_id: workItem.id, number: args.number,
          })
        }

        return toolSuccess({
          success: true,
          comment: data,
          message: `Added comment to task #${args.number}`,
        })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── delete_task ──
  server.tool(
    'delete_task',
    'Soft-delete a task by its number.',
    {
      number: z.number().describe('Work item number'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = await getResolvedProjectId(agentCtx, args.project_key)
        const workItem = await resolveWorkItemByNumber(projectId, args.number)

        // Direct soft-delete instead of RPC — RPC checks auth.uid() which is null
        // for Service Role. MCP server already verified project access above.
        const { error } = await supabase
          .from('work_items')
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', workItem.id)
          .is('deleted_at', null)

        if (error) return toolError('INTERNAL_ERROR', error.message)

        if (agentCtx) {
          await logAgentAction(agentCtx.agentId, 'delete_task', {
            work_item_id: workItem.id, number: args.number,
          })
        }

        return toolSuccess({ success: true, message: `Deleted task #${args.number}` })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── get_task_tree ──
  server.tool(
    'get_task_tree',
    'Get the full work item tree structure for a project.',
    {
      max_depth: z.number().min(1).max(10).default(5).describe('Maximum tree depth'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = await getResolvedProjectId(agentCtx, args.project_key)

        const { data, error } = await supabase
          .from('work_items')
          .select(`
            id, number, title, parent_id, position,
            tracker:trackers(name, color),
            status:statuses(name, color, is_closed)
          `)
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .order('position')

        if (error) return toolError('INTERNAL_ERROR', error.message)

        // Build tree in memory
        const items = data ?? []
        type Item = (typeof items)[number] & { children: unknown[] }
        const map = new Map<string, Item>()
        const roots: Item[] = []

        for (const item of items) {
          map.set(item.id, { ...item, children: [] })
        }

        for (const item of items) {
          const node = map.get(item.id)!
          if (item.parent_id && map.has(item.parent_id)) {
            map.get(item.parent_id)!.children.push(node)
          } else {
            roots.push(node)
          }
        }

        // Limit depth
        function trimDepth(nodes: Item[], depth: number): unknown[] {
          if (depth <= 0) return nodes.map(n => ({ ...n, children: `[${n.children.length} children]` }))
          return nodes.map(n => ({
            ...n,
            children: trimDepth(n.children as Item[], depth - 1),
          }))
        }

        return toolSuccess({ tree: trimDepth(roots, args.max_depth) })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── batch_update_status ──
  server.tool(
    'batch_update_status',
    'Change the status of multiple tasks at once.',
    {
      numbers: z.array(z.number()).min(1).describe('Work item numbers to update'),
      status: z.string().describe('New status name'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = await getResolvedProjectId(agentCtx, args.project_key)
        const statusId = await resolveStatusId(projectId, args.status)

        // Resolve all numbers to IDs
        const ids: string[] = []
        for (const num of args.numbers) {
          const item = await resolveWorkItemByNumber(projectId, num)
          ids.push(item.id)
        }

        const { error } = await supabase
          .from('work_items')
          .update({ status_id: statusId })
          .in('id', ids)

        if (error) return toolError('INTERNAL_ERROR', error.message)

        if (agentCtx) {
          await logAgentAction(agentCtx.agentId, 'batch_update_status', {
            numbers: args.numbers, status: args.status,
          })
        }

        return toolSuccess({ success: true, count: ids.length, message: `Updated ${ids.length} tasks to "${args.status}"` })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )
}
