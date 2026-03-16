import { z } from 'zod'
import { supabase } from '../supabase.js'
import { toolSuccess, toolError } from '../types.js'
import type { AgentContext } from '../auth.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerSearchTools(server: McpServer, agentCtx: AgentContext | null) {
  server.tool(
    'search',
    'Search for projects and work items. Results are scoped to accessible projects.',
    {
      query: z.string().min(1).describe('Search query (text or KEY-123 pattern)'),
    },
    async (args) => {
      try {
        const query = args.query.trim()
        if (!query) return toolError('VALIDATION_ERROR', 'Query cannot be empty')

        // Determine project scope
        let projectIds: string[]
        if (agentCtx) {
          projectIds = agentCtx.accessibleProjectIds
        } else {
          const { getProjectId } = await import('../supabase.js')
          projectIds = [getProjectId()]
        }

        if (projectIds.length === 0) {
          return toolSuccess({ projects: [], workItems: [] })
        }

        // Sanitize for ilike
        const sanitized = query.replace(/[%_\\]/g, '\\$&')

        // Check if query matches KEY-NUMBER pattern
        const keyNumberMatch = query.match(/^([A-Z]+)-(\d+)$/i)

        const results: { projects: unknown[]; workItems: unknown[] } = {
          projects: [],
          workItems: [],
        }

        // Search projects
        const { data: projects } = await supabase
          .from('projects')
          .select('id, key, name, description, project_type')
          .in('id', projectIds)
          .is('deleted_at', null)
          .or(`name.ilike.%${sanitized}%,key.ilike.%${sanitized}%`)
          .limit(5)
        results.projects = projects ?? []

        // Search work items
        if (keyNumberMatch) {
          // KEY-NUMBER search: find project by key, then item by number
          const [, key, num] = keyNumberMatch
          const { data: project } = await supabase
            .from('projects')
            .select('id')
            .ilike('key', key)
            .in('id', projectIds)
            .single()

          if (project) {
            const { data: items } = await supabase
              .from('work_items')
              .select('id, number, title, status:statuses(name, color), tracker:trackers(name)')
              .eq('project_id', project.id)
              .eq('number', parseInt(num, 10))
              .is('deleted_at', null)
              .limit(1)
            results.workItems = items ?? []
          }
        } else {
          // Text search
          const { data: items } = await supabase
            .from('work_items')
            .select('id, number, title, status:statuses(name, color), tracker:trackers(name), project:projects(key)')
            .in('project_id', projectIds)
            .is('deleted_at', null)
            .ilike('title', `%${sanitized}%`)
            .order('updated_at', { ascending: false })
            .limit(10)
          results.workItems = items ?? []
        }

        return toolSuccess(results)
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )
}
