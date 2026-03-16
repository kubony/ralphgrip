import { createClient } from '@supabase/supabase-js'

// Support both new env var names and legacy names
const supabaseUrl = process.env.RALPHGRIP_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.RALPHGRIP_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase credentials. Set RALPHGRIP_SUPABASE_URL + RALPHGRIP_SERVICE_KEY or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
  )
}

// Singleton client — reused across all tool handlers (long-running process)
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
})

// ── Legacy mode helpers (backward compatible) ──

/** @deprecated Use AgentContext.projectId or resolveProjectId() instead */
export function getProjectId(): string {
  const projectId = process.env.MADSPEED_PROJECT_ID
  if (!projectId) {
    throw new Error('Missing MADSPEED_PROJECT_ID environment variable')
  }
  return projectId
}

let cachedOwnerId: string | null = null

/** @deprecated Use AgentContext instead */
export async function getProjectOwnerId(): Promise<string> {
  if (cachedOwnerId) return cachedOwnerId

  const projectId = getProjectId()
  const { data, error } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  if (error || !data) {
    throw new Error(`Could not resolve project owner: ${error?.message}`)
  }

  cachedOwnerId = data.owner_id
  return data.owner_id
}

/**
 * Returns { profileId, agentId } for the current actor.
 * In API key mode, agentId comes from AgentContext.
 * In legacy mode, reads from MADSPEED_AGENT_ID env var.
 */
export async function getActorIds(): Promise<{ profileId: string | null; agentId: string | null }> {
  const agentId = process.env.MADSPEED_AGENT_ID || null
  if (agentId) {
    return { profileId: null, agentId }
  }
  const profileId = await getProjectOwnerId()
  return { profileId, agentId: null }
}

/**
 * Check if running in API key authentication mode (vs legacy env var mode).
 */
export function isApiKeyMode(): boolean {
  return !!process.env.RALPHGRIP_API_KEY
}
