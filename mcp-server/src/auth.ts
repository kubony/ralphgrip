import { createHash } from 'node:crypto'
import { supabase } from './supabase.js'

export interface AgentContext {
  agentId: string
  agentName: string
  displayName: string
  agentKind: string
  agentRole: string
  agentRuntime: string
  agentModel: string | null
  category: 'global' | 'owned' | 'restricted'
  ownerId: string | null
  projectId: string | null
  accessibleProjectIds: string[]
}

/**
 * Validate an API key against the agents table.
 * Returns AgentContext on success, null on failure.
 */
export async function validateApiKey(apiKey: string): Promise<AgentContext | null> {
  const hash = createHash('sha256').update(apiKey).digest('hex')

  const { data: agent } = await supabase
    .from('agents')
    .select(`
      id, name, display_name, agent_kind, agent_role,
      agent_runtime, agent_model, category, owner_id,
      project_id, status
    `)
    .eq('api_key_hash', hash)
    .eq('status', 'active')
    .single()

  if (!agent) return null

  const accessibleProjectIds = await resolveAccessibleProjects(agent)

  return {
    agentId: agent.id,
    agentName: agent.name,
    displayName: agent.display_name,
    agentKind: agent.agent_kind,
    agentRole: agent.agent_role,
    agentRuntime: agent.agent_runtime,
    agentModel: agent.agent_model,
    category: agent.category as AgentContext['category'],
    ownerId: agent.owner_id,
    projectId: agent.project_id,
    accessibleProjectIds,
  }
}

interface AgentRow {
  id: string
  category: string
  owner_id: string | null
  project_id: string | null
}

/**
 * Resolve which projects an agent can access based on its category.
 *
 * - Project-specific agent (project_id NOT NULL): only that project
 * - global/owned (project_id NULL): all projects where owner_id is a member
 * - restricted: projects of users listed in agent_permissions
 */
async function resolveAccessibleProjects(agent: AgentRow): Promise<string[]> {
  // Case 1: project-scoped agent
  if (agent.project_id) {
    return [agent.project_id]
  }

  // Case 2: global/owned → owner's projects
  if ((agent.category === 'global' || agent.category === 'owned') && agent.owner_id) {
    const { data } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', agent.owner_id)
    return (data ?? []).map(m => m.project_id)
  }

  // Case 3: restricted → union of projects for permitted users
  if (agent.category === 'restricted') {
    const { data: perms } = await supabase
      .from('agent_permissions')
      .select('user_id')
      .eq('agent_id', agent.id)

    if (!perms?.length) return []

    const { data: members } = await supabase
      .from('project_members')
      .select('project_id')
      .in('user_id', perms.map(p => p.user_id))

    return [...new Set((members ?? []).map(m => m.project_id))]
  }

  return []
}

/**
 * Check that the agent has access to a specific project.
 * Throws if not authorized.
 */
export function requireProjectAccess(ctx: AgentContext, projectId: string): void {
  if (!ctx.accessibleProjectIds.includes(projectId)) {
    throw new Error(`PERMISSION_DENIED: No access to project ${projectId}`)
  }
}

/**
 * Resolve a project key to a project ID, verifying agent access.
 */
export async function resolveProjectId(
  ctx: AgentContext,
  projectKey?: string,
  legacyProjectId?: string
): Promise<string> {
  // API key mode: use project_key
  if (projectKey) {
    const { data } = await supabase
      .from('projects')
      .select('id')
      .eq('key', projectKey)
      .is('deleted_at', null)
      .single()

    if (!data) throw new Error(`NOT_FOUND: Project "${projectKey}" not found`)
    requireProjectAccess(ctx, data.id)
    return data.id
  }

  // Legacy mode: use MADSPEED_PROJECT_ID
  if (legacyProjectId) {
    return legacyProjectId
  }

  // Single-project agent
  if (ctx.projectId) {
    return ctx.projectId
  }

  // Default: first accessible project
  if (ctx.accessibleProjectIds.length === 1) {
    return ctx.accessibleProjectIds[0]
  }

  throw new Error('VALIDATION_ERROR: project_key is required when agent has access to multiple projects')
}

/**
 * Log an agent action to the agent_logs table.
 */
export async function logAgentAction(
  agentId: string,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from('agent_logs').insert({
    agent_id: agentId,
    action,
    details,
  })
}
