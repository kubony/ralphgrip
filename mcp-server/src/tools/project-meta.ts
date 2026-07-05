import { z } from 'zod'
import { supabase, getProjectId } from '../supabase.js'
import { resolveProjectId, logAgentAction } from '../auth.js'
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

  // ── create_project (API key mode only; owned/global agents only) ──
  // Requires an owner-bound agent context — legacy env mode has no owner to attribute.
  if (!agentCtx) return
  const ctx = agentCtx

  server.tool(
    'create_project',
    'Create a new RalphGrip project owned by the agent owner. DB triggers auto-provision the owner membership, default trackers (Folder + type tracker), and statuses — do not create those separately. Only owned/global agents may call this.',
    {
      name: z.string().describe('Project name'),
      key: z.string().describe('Project key: 2-10 uppercase letters (A-Z). Used in URLs and work item references.'),
      project_type: z.enum(['issue', 'requirement']).describe('Project workflow type. Immutable after creation.'),
      description: z.string().optional().describe('Project description (optional)'),
    },
    async (args) => {
      try {
        // Permission: only owner-bound (owned/global) agents, never project-scoped or restricted.
        if (
          (ctx.category !== 'owned' && ctx.category !== 'global') ||
          !ctx.ownerId ||
          ctx.projectId
        ) {
          return toolError(
            'PERMISSION_DENIED',
            'Only owned/global agents can create projects. Project-scoped and restricted agents are not allowed.'
          )
        }

        // Validate name (matches web app: non-empty).
        const name = args.name?.trim()
        if (!name) {
          return toolError('VALIDATION_ERROR', '프로젝트 이름을 입력해주세요.')
        }

        // Validate key (matches web app: uppercase, 2-10 letters).
        const key = args.key?.toUpperCase() ?? ''
        if (!/^[A-Z]{2,10}$/.test(key)) {
          return toolError('VALIDATION_ERROR', '프로젝트 키는 2-10자의 영문 대문자여야 합니다.')
        }

        // Insert only — DB triggers handle owner membership, trackers, statuses, and work-item sequence.
        const { data, error } = await supabase
          .from('projects')
          .insert({
            name,
            key,
            description: args.description?.trim() || null,
            project_type: args.project_type,
            owner_id: ctx.ownerId,
          })
          .select('id, key, name, project_type')
          .single()

        if (error) {
          if (error.code === '23505') {
            return toolError('CONFLICT', `이미 존재하는 key입니다: ${key}`)
          }
          return toolError('INTERNAL_ERROR', error.message)
        }

        // Keep the session's access cache fresh so create_task works immediately
        // in the same session (accessibleProjectIds is computed once at session init).
        if (!ctx.accessibleProjectIds.includes(data.id)) {
          ctx.accessibleProjectIds.push(data.id)
        }

        await logAgentAction(ctx.agentId, 'create_project', {
          project_id: data.id,
          key: data.key,
          project_type: data.project_type,
        })

        return toolSuccess({
          success: true,
          project: {
            id: data.id,
            key: data.key,
            name: data.name,
            project_type: data.project_type,
          },
          message: `Project "${data.name}" (${data.key}) created`,
        })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )
}
