import { z } from 'zod'
import { supabase } from '../supabase.js'
import { logAgentAction, resolveProjectId } from '../auth.js'
import { toolSuccess, toolError } from '../types.js'
import type { AgentContext } from '../auth.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerAgentInfoTools(server: McpServer, agentCtx: AgentContext | null) {
  // ── whoami ──
  server.tool(
    'whoami',
    'Get information about the current agent, including accessible projects.',
    {},
    async () => {
      if (!agentCtx) {
        // Legacy mode: return env-based info
        const projectId = process.env.MADSPEED_PROJECT_ID
        const agentId = process.env.MADSPEED_AGENT_ID
        return toolSuccess({
          mode: 'legacy',
          projectId,
          agentId,
          message: 'Running in legacy mode. Use RALPHGRIP_API_KEY for multi-project support.',
        })
      }

      // Fetch project names for accessible IDs
      const { data: projects } = await supabase
        .from('projects')
        .select('id, key, name')
        .in('id', agentCtx.accessibleProjectIds)
        .is('deleted_at', null)

      return toolSuccess({
        mode: 'api_key',
        agent: {
          id: agentCtx.agentId,
          name: agentCtx.agentName,
          displayName: agentCtx.displayName,
          kind: agentCtx.agentKind,
          role: agentCtx.agentRole,
          runtime: agentCtx.agentRuntime,
          model: agentCtx.agentModel,
          category: agentCtx.category,
        },
        accessibleProjects: projects ?? [],
      })
    }
  )

  // Only register workflow tools in API key mode
  if (!agentCtx) return

  const ctx = agentCtx

  // ── report_progress ──
  server.tool(
    'report_progress',
    'Report progress on a task. Optionally transitions status to "In Progress" and adds a comment.',
    {
      number: z.number().describe('Work item number'),
      message: z.string().describe('Progress message'),
      project_key: z.string().optional().describe('Project key (required if agent has multiple projects)'),
      set_in_progress: z.boolean().default(true).describe('Set status to "In Progress"'),
    },
    async (args) => {
      try {
        const projectId = await resolveProjectId(ctx, args.project_key)
        const workItem = await resolveWorkItemByNumber(projectId, args.number)

        // Optionally update status to In Progress
        if (args.set_in_progress) {
          const statusId = await resolveStatusId(projectId, 'In Progress')
          if (statusId) {
            await supabase.from('work_items').update({ status_id: statusId }).eq('id', workItem.id)
          }
        }

        // Add comment as agent
        await supabase.from('comments').insert({
          work_item_id: workItem.id,
          agent_id: ctx.agentId,
          content: `**진행 보고**: ${args.message}`,
        })

        await logAgentAction(ctx.agentId, 'report_progress', {
          work_item_id: workItem.id,
          number: args.number,
        })

        return toolSuccess({ success: true, message: `Progress reported on #${args.number}` })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── report_blocker ──
  server.tool(
    'report_blocker',
    'Report a blocker on a task. Transitions status to "Issue" and adds a comment with the blocker description.',
    {
      number: z.number().describe('Work item number'),
      blocker: z.string().describe('Description of the blocker'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = await resolveProjectId(ctx, args.project_key)
        const workItem = await resolveWorkItemByNumber(projectId, args.number)

        const statusId = await resolveStatusId(projectId, 'Issue')
        if (statusId) {
          await supabase.from('work_items').update({ status_id: statusId }).eq('id', workItem.id)
        }

        await supabase.from('comments').insert({
          work_item_id: workItem.id,
          agent_id: ctx.agentId,
          content: `**블로커 보고**: ${args.blocker}`,
        })

        await logAgentAction(ctx.agentId, 'report_blocker', {
          work_item_id: workItem.id,
          number: args.number,
          blocker: args.blocker,
        })

        return toolSuccess({ success: true, message: `Blocker reported on #${args.number}` })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ── mark_resolved ──
  server.tool(
    'mark_resolved',
    'Mark a task as resolved. Transitions status to "Resolved" and adds a completion summary comment.',
    {
      number: z.number().describe('Work item number'),
      summary: z.string().describe('Completion summary'),
      project_key: z.string().optional().describe('Project key'),
    },
    async (args) => {
      try {
        const projectId = await resolveProjectId(ctx, args.project_key)
        const workItem = await resolveWorkItemByNumber(projectId, args.number)

        const statusId = await resolveStatusId(projectId, 'Resolved')
        if (statusId) {
          await supabase.from('work_items').update({ status_id: statusId }).eq('id', workItem.id)
        }

        await supabase.from('comments').insert({
          work_item_id: workItem.id,
          agent_id: ctx.agentId,
          content: `**완료 보고**: ${args.summary}`,
        })

        await logAgentAction(ctx.agentId, 'mark_resolved', {
          work_item_id: workItem.id,
          number: args.number,
          summary: args.summary,
        })

        return toolSuccess({ success: true, message: `Task #${args.number} marked as resolved` })
      } catch (err) {
        return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )
}

// ── Shared helpers ──

async function resolveWorkItemByNumber(projectId: string, number: number): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('work_items')
    .select('id')
    .eq('project_id', projectId)
    .eq('number', number)
    .is('deleted_at', null)
    .single()

  if (error || !data) throw new Error(`NOT_FOUND: Work item #${number} not found`)
  return data
}

async function resolveStatusId(projectId: string, statusName: string): Promise<string | null> {
  const { data } = await supabase
    .from('statuses')
    .select('id')
    .eq('project_id', projectId)
    .ilike('name', statusName)
    .limit(1)
    .single()
  return data?.id ?? null
}
