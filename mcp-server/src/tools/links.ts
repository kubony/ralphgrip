import { z } from 'zod'
import { supabase } from '../supabase.js'
import { requireProjectAccess, logAgentAction, resolveProjectId } from '../auth.js'
import { toolSuccess, toolError } from '../types.js'
import type { AgentContext } from '../auth.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerLinkTools(server: McpServer, agentCtx: AgentContext | null) {
  // ── list_links ──
  server.tool(
    'list_links',
    'List dependency links (depends_on / blocks) for a work item.',
    {
      number: z.number().describe('Work item number'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = agentCtx
          ? await resolveProjectId(agentCtx, args.project_key)
          : (await import('../supabase.js')).getProjectId()

        const { data: workItem } = await supabase
          .from('work_items')
          .select('id')
          .eq('project_id', projectId)
          .eq('number', args.number)
          .is('deleted_at', null)
          .single()

        if (!workItem) return toolError('NOT_FOUND', `Work item #${args.number} not found`)

        // Outgoing links (this item depends_on others)
        const { data: outgoing } = await supabase
          .from('work_item_links')
          .select(`
            id, suspect,
            target:work_items!work_item_links_target_id_fkey(
              id, number, title,
              project:projects(key),
              status:statuses(name, color)
            )
          `)
          .eq('source_id', workItem.id)

        // Incoming links (others depend on this item)
        const { data: incoming } = await supabase
          .from('work_item_links')
          .select(`
            id, suspect,
            source:work_items!work_item_links_source_id_fkey(
              id, number, title,
              project:projects(key),
              status:statuses(name, color)
            )
          `)
          .eq('target_id', workItem.id)

        const dependsOn = (outgoing ?? []).map(link => ({
          link_id: link.id,
          suspect: link.suspect,
          item: formatLinkedItem(link.target),
        }))

        const blocks = (incoming ?? []).map(link => ({
          link_id: link.id,
          suspect: link.suspect,
          item: formatLinkedItem(link.source),
        }))

        return toolSuccess({ depends_on: dependsOn, blocks })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── create_link ──
  server.tool(
    'create_link',
    'Create a dependency link between two work items. Source "depends on" target.',
    {
      source_number: z.number().describe('Source work item number (the one that depends)'),
      target_number: z.number().describe('Target work item number (the dependency)'),
      project_key: z.string().optional().describe('Project key for source item'),
      target_project_key: z.string().optional().describe('Project key for target (if cross-project)'),
    },
    async (args) => {
      try {
        const sourceProjectId = agentCtx
          ? await resolveProjectId(agentCtx, args.project_key)
          : (await import('../supabase.js')).getProjectId()

        const targetProjectId = args.target_project_key && agentCtx
          ? await resolveProjectId(agentCtx, args.target_project_key)
          : sourceProjectId

        // Cross-project: verify access to both
        if (agentCtx && targetProjectId !== sourceProjectId) {
          requireProjectAccess(agentCtx, targetProjectId)
        }

        const [{ data: source }, { data: target }] = await Promise.all([
          supabase.from('work_items').select('id').eq('project_id', sourceProjectId).eq('number', args.source_number).is('deleted_at', null).single(),
          supabase.from('work_items').select('id').eq('project_id', targetProjectId).eq('number', args.target_number).is('deleted_at', null).single(),
        ])

        if (!source) return toolError('NOT_FOUND', `Source #${args.source_number} not found`)
        if (!target) return toolError('NOT_FOUND', `Target #${args.target_number} not found`)

        const { data, error } = await supabase
          .from('work_item_links')
          .insert({ source_id: source.id, target_id: target.id })
          .select('id, source_id, target_id')
          .single()

        if (error) return toolError('CONFLICT', error.message)

        if (agentCtx) {
          await logAgentAction(agentCtx.agentId, 'create_link', {
            source_number: args.source_number,
            target_number: args.target_number,
          })
        }

        return toolSuccess({ success: true, link: data })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── delete_link ──
  server.tool(
    'delete_link',
    'Delete a dependency link by its ID.',
    {
      link_id: z.string().uuid().describe('Link ID to delete'),
    },
    async (args) => {
      try {
        const { error } = await supabase
          .from('work_item_links')
          .delete()
          .eq('id', args.link_id)

        if (error) return toolError('INTERNAL_ERROR', error.message)

        if (agentCtx) {
          await logAgentAction(agentCtx.agentId, 'delete_link', { link_id: args.link_id })
        }

        return toolSuccess({ success: true })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )
}

function formatLinkedItem(item: unknown): Record<string, unknown> {
  const i = item as Record<string, unknown> | null
  if (!i) return {}
  const project = i.project as Record<string, unknown> | null
  const status = i.status as Record<string, unknown> | null
  return {
    number: i.number,
    title: i.title,
    project_key: project?.key ?? null,
    status_name: status?.name ?? null,
    status_color: status?.color ?? null,
  }
}
