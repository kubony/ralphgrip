import { z } from 'zod'
import { supabase, getProjectId } from '../supabase.js'
import { resolveProjectId } from '../auth.js'
import { toolSuccess, toolError } from '../types.js'
import type { AgentContext } from '../auth.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerProjectMetaTools(server: McpServer, agentCtx: AgentContext | null = null) {
  // ── get_project_meta ──
  server.tool(
    'get_project_meta',
    'Get project metadata including available statuses, trackers, and members. Call this first to understand what status/tracker names you can use.',
    {
      project_key: z.string().optional().describe('Project key (required if agent has multiple projects)'),
    },
    async (args) => {
      try {
        const projectId = agentCtx
          ? await resolveProjectId(agentCtx, args.project_key)
          : getProjectId()

        const [statusesRes, trackersRes, projectRes, membersRes] = await Promise.all([
          supabase
            .from('statuses')
            .select('id, name, color, position, is_closed')
            .eq('project_id', projectId)
            .order('position'),
          supabase
            .from('trackers')
            .select('id, name, color, position')
            .eq('project_id', projectId)
            .order('position'),
          supabase
            .from('projects')
            .select('id, name, key, description, project_type')
            .eq('id', projectId)
            .single(),
          supabase
            .from('project_members')
            .select('user_id, role, profile:profiles(id, full_name, avatar_url)')
            .eq('project_id', projectId),
        ])

        if (projectRes.error) return toolError('NOT_FOUND', projectRes.error.message)

        return toolSuccess({
          project: projectRes.data,
          statuses: statusesRes.data ?? [],
          trackers: trackersRes.data ?? [],
          members: (membersRes.data ?? []).map(m => {
            const profile = (Array.isArray(m.profile) ? m.profile[0] : m.profile) as { id: string; full_name: string | null; avatar_url: string | null } | null
            return {
              id: profile?.id ?? m.user_id,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
              role: m.role,
            }
          }),
        })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── list_projects (API key mode only) ──
  server.tool(
    'list_projects',
    'List all projects accessible to the current agent.',
    {},
    async () => {
      try {
        if (!agentCtx) {
          // Legacy mode: return single project
          const pid = getProjectId()
          const { data } = await supabase
            .from('projects')
            .select('id, key, name, description, project_type, created_at')
            .eq('id', pid)
            .single()
          return toolSuccess({ projects: data ? [data] : [] })
        }

        if (agentCtx.accessibleProjectIds.length === 0) {
          return toolSuccess({ projects: [] })
        }

        const { data, error } = await supabase
          .from('projects')
          .select('id, key, name, description, project_type, created_at')
          .in('id', agentCtx.accessibleProjectIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        if (error) return toolError('INTERNAL_ERROR', error.message)

        return toolSuccess({ projects: data ?? [] })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )
}
