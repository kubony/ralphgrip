import { z } from 'zod'
import { supabase, getProjectId, getProjectOwnerId, getActorIds } from '../supabase.js'
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

export function registerWorkItemTools(server: McpServer) {
  // ── create_task ──
  server.tool(
    'create_task',
    'Create a new task (work item) in the AgentGrip project. Use tracker and status names (e.g., "Task", "To Do") — UUIDs are resolved automatically.',
    {
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description (markdown supported)'),
      tracker: z.string().default('Task').describe('Tracker name, e.g., "Feature", "Bug", "Task"'),
      status: z.string().default('Open').describe('Status name, e.g., "Open", "In Progress", "Resolved", "Closed"'),
      priority: z.number().min(0).max(4).default(0).describe('Priority: 0=none, 1=low, 2=medium, 3=high, 4=critical'),
      assignee_id: z.string().uuid().optional().describe('Assignee profile UUID (optional)'),
      reporter_id: z.string().uuid().optional().describe('Reporter profile UUID (optional, defaults to service account)'),
      parent_number: z.number().optional().describe('Parent task number to create as subtask'),
    },
    async (args) => {
      const projectId = getProjectId()

      try {
        const [trackerId, statusId, defaultReporterId, actorIds] = await Promise.all([
          resolveTrackerId(projectId, args.tracker),
          resolveStatusId(projectId, args.status),
          args.reporter_id ? Promise.resolve(args.reporter_id) : getProjectOwnerId(),
          getActorIds(),
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
              assignee_id: args.assignee_id ?? null,
              parent_id: parentId,
              position,
              created_by_ai: true,
              ai_metadata: { model: 'mcp-server', last_action: 'create', agent_id: actorIds.agentId },
            }

          // Set reporter as agent or profile
          if (actorIds.agentId) {
            insertData.agent_reporter_id = actorIds.agentId
          } else {
            insertData.reporter_id = args.reporter_id ?? defaultReporterId
          }

          const { data, error } = await supabase
            .from('work_items')
            .insert(insertData)
            .select('id, number, title, position')
            .single()

          if (!error && data) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  task: data,
                  message: `Created task #${data.number}: ${data.title}`,
                }, null, 2),
              }],
            }
          }

          // Check if position conflict
          if (error?.code === '23505' && error.message?.includes('position')) {
            lastError = new Error(error.message)
            continue
          }

          return {
            content: [{ type: 'text' as const, text: `Error creating task: ${error.message}` }],
          }
        }

        return {
          content: [{ type: 'text' as const, text: `Failed after ${MAX_POSITION_INSERT_ATTEMPTS} attempts: ${lastError?.message}` }],
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }] }
      }
    }
  )

  // ── update_task ──
  server.tool(
    'update_task',
    'Update an existing task by its number (e.g., 42). You can change status, title, description, priority, or assignee.',
    {
      number: z.number().describe('Work item number (e.g., 42)'),
      status: z.string().optional().describe('New status name, e.g., "In Progress", "Done"'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      priority: z.number().min(0).max(4).optional().describe('New priority: 0=none, 1=low, 2=medium, 3=high, 4=critical'),
      assignee_id: z.string().uuid().nullable().optional().describe('New assignee UUID or null to unassign'),
    },
    async (args) => {
      const projectId = getProjectId()

      try {
        // Set agent context for audit log trigger
        const actorIds = await getActorIds()
        if (actorIds.agentId) {
          await supabase.rpc('set_agent_session', { agent_id: actorIds.agentId })
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
          return { content: [{ type: 'text' as const, text: 'No fields to update' }] }
        }

        const { data, error } = await supabase
          .from('work_items')
          .update(updates)
          .eq('id', workItem.id)
          .select('id, number, title')
          .single()

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error updating task: ${error.message}` }] }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              task: data,
              updated_fields: updatedFields,
              message: `Updated task #${data.number}: ${updatedFields.join(', ')}`,
            }, null, 2),
          }],
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }] }
      }
    }
  )

  // ── list_tasks ──
  server.tool(
    'list_tasks',
    'List tasks in the project. Filter by status, tracker, or assignee.',
    {
      status: z.string().optional().describe('Filter by status name, e.g., "In Progress"'),
      tracker: z.string().optional().describe('Filter by tracker name, e.g., "Bug"'),
      assignee_id: z.string().uuid().optional().describe('Filter by assignee UUID'),
      limit: z.number().min(1).max(100).default(50).describe('Max results'),
    },
    async (args) => {
      const projectId = getProjectId()

      try {
        let query = supabase
          .from('work_items')
          .select(`
            id, number, title, description, priority, position, created_at, updated_at,
            tracker:trackers(id, name, color),
            status:statuses(id, name, color, is_closed),
            assignee:profiles!work_items_assignee_id_fkey(id, full_name)
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

        const { data, error } = await query

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error listing tasks: ${error.message}` }] }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              count: data.length,
              tasks: data,
            }, null, 2),
          }],
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }] }
      }
    }
  )

  // ── get_task ──
  server.tool(
    'get_task',
    'Get detailed information about a single task by its number.',
    {
      number: z.number().describe('Work item number (e.g., 42)'),
    },
    async (args) => {
      const projectId = getProjectId()

      const { data, error } = await supabase
        .from('work_items')
        .select(`
          id, number, title, description, priority, position, due_date,
          created_at, updated_at, created_by_ai, ai_metadata,
          tracker:trackers(id, name, color),
          status:statuses(id, name, color, is_closed),
          assignee:profiles!work_items_assignee_id_fkey(id, full_name, avatar_url),
          reporter:profiles!work_items_reporter_id_fkey(id, full_name, avatar_url)
        `)
        .eq('project_id', projectId)
        .eq('number', args.number)
        .is('deleted_at', null)
        .single()

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        }],
      }
    }
  )

  // ── add_comment ──
  server.tool(
    'add_comment',
    'Add a comment to a task by its number. If running as an agent (MADSPEED_AGENT_ID set), the comment is attributed to the agent.',
    {
      number: z.number().describe('Work item number (e.g., 42)'),
      content: z.string().describe('Comment content (markdown supported)'),
    },
    async (args) => {
      const projectId = getProjectId()

      try {
        const [workItem, actorIds] = await Promise.all([
          resolveWorkItemByNumber(projectId, args.number),
          getActorIds(),
        ])

        const insertData: Record<string, unknown> = {
          work_item_id: workItem.id,
          content: args.content,
        }

        if (actorIds.agentId) {
          // Set agent session context for RLS/triggers
          await supabase.rpc('set_agent_session', { agent_id: actorIds.agentId })
          insertData.agent_id = actorIds.agentId
        } else {
          // Fall back to project owner as author
          const ownerId = await getProjectOwnerId()
          insertData.author_id = ownerId
        }

        const { data, error } = await supabase
          .from('comments')
          .insert(insertData)
          .select('id, content, created_at')
          .single()

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error adding comment: ${error.message}` }] }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              comment: data,
              message: `Added comment to task #${args.number}`,
            }, null, 2),
          }],
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }] }
      }
    }
  )
}
