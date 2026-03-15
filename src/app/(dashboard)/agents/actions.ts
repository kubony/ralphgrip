'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AgentCategory } from '@/types/database'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', supabase: null, user: null }
  return { error: null, supabase, user }
}

export async function getAccessibleAgents() {
  const { error: authError, supabase, user } = await requireAuth()
  if (authError || !supabase || !user) return { error: authError }

  // RLS가 자동으로 접근 가능한 에이전트만 반환
  const { data, error } = await supabase
    .from('agents')
    .select('*, owner:profiles!agents_owner_id_fkey(id, full_name, avatar_url)')
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function getGlobalAgents() {
  const { error: authError, supabase } = await requireAuth()
  if (authError || !supabase) return { error: authError }

  const { data, error } = await supabase
    .from('agents')
    .select('*, owner:profiles!agents_owner_id_fkey(id, full_name, avatar_url)')
    .eq('category', 'global')
    .is('project_id', null)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function getMyAgents() {
  const { error: authError, supabase, user } = await requireAuth()
  if (authError || !supabase || !user) return { error: authError }

  const { data, error } = await supabase
    .from('agents')
    .select('*, owner:profiles!agents_owner_id_fkey(id, full_name, avatar_url)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function createGlobalAgent(input: {
  name: string
  display_name: string
  category: AgentCategory
  agent_kind: string
  agent_role: string
  agent_model?: string
  agent_runtime: string
  description?: string
}) {
  const { error: authError, supabase, user } = await requireAuth()
  if (authError || !supabase || !user) return { error: authError }

  const rawKey = `ag_${crypto.randomUUID().replace(/-/g, '')}`
  const prefix = rawKey.slice(0, 11) + '...'

  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const apiKeyHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  const { data, error } = await supabase
    .from('agents')
    .insert({
      name: input.name,
      display_name: input.display_name,
      category: input.category,
      owner_id: user.id,
      project_id: null,
      agent_kind: input.agent_kind,
      agent_role: input.agent_role,
      agent_model: input.agent_model || null,
      agent_runtime: input.agent_runtime,
      description: input.description ?? null,
      api_key_hash: apiKeyHash,
      api_key_prefix: prefix,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/agents')
  return { data, apiKey: rawKey }
}

export async function updateGlobalAgent(
  agentId: string,
  input: {
    display_name?: string
    agent_kind?: string
    agent_role?: string
    agent_model?: string | null
    agent_runtime?: string
    status?: string
    description?: string
    category?: AgentCategory
  },
) {
  const { error: authError, supabase } = await requireAuth()
  if (authError || !supabase) return { error: authError }

  const { error } = await supabase
    .from('agents')
    .update(input)
    .eq('id', agentId)

  if (error) return { error: error.message }
  revalidatePath('/agents')
  return { success: true }
}

export async function deleteGlobalAgent(agentId: string) {
  const { error: authError, supabase } = await requireAuth()
  if (authError || !supabase) return { error: authError }

  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', agentId)

  if (error) return { error: error.message }
  revalidatePath('/agents')
  return { success: true }
}

export async function grantAgentPermission(agentId: string, userId: string) {
  const { error: authError, supabase, user } = await requireAuth()
  if (authError || !supabase || !user) return { error: authError }

  const { error } = await supabase
    .from('agent_permissions')
    .insert({
      agent_id: agentId,
      user_id: userId,
      granted_by: user.id,
    })

  if (error) return { error: error.message }
  revalidatePath('/agents')
  return { success: true }
}

export async function revokeAgentPermission(agentId: string, userId: string) {
  const { error: authError, supabase } = await requireAuth()
  if (authError || !supabase) return { error: authError }

  const { error } = await supabase
    .from('agent_permissions')
    .delete()
    .eq('agent_id', agentId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  revalidatePath('/agents')
  return { success: true }
}

export async function getAgentLogs(agentId: string) {
  const { error: authError, supabase } = await requireAuth()
  if (authError || !supabase) return { error: authError }

  const { data, error } = await supabase
    .from('agent_logs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { error: error.message }
  return { data }
}

export async function getActiveAgentCount() {
  const { error: authError, supabase } = await requireAuth()
  if (authError || !supabase) return 0

  const { count } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  return count ?? 0
}
