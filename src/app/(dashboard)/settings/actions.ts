'use server'

import { randomBytes, createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'
import { getServiceClient } from '@/lib/supabase/service'

export async function updateProfile(updates: { full_name?: string }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  if (updates.full_name !== undefined && updates.full_name.trim().length === 0) {
    return { error: '이름을 입력해주세요.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: updates.full_name?.trim() || null })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteAccount() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // Admin client로 auth user 삭제 (profile은 cascade로 삭제됨)
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )

  const { error } = await adminClient.auth.admin.deleteUser(user.id)
  if (error) {
    return { error: error.message }
  }

  await supabase.auth.signOut()
  return { success: true }
}

// ── API Key Management ──

export interface ApiKeyInfo {
  id: string
  name: string
  display_name: string
  api_key_prefix: string | null
  agent_kind: string
  status: string
  created_at: string
}

/**
 * List all API keys (agents with api_key_hash) owned by the current user.
 */
export async function listApiKeys(): Promise<{ keys: ApiKeyInfo[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { keys: [], error: '로그인이 필요합니다.' }

  const serviceClient = getServiceClient()
  const { data, error } = await serviceClient
    .from('agents')
    .select('id, name, display_name, api_key_prefix, agent_kind, status, created_at')
    .eq('owner_id', user.id)
    .not('api_key_hash', 'is', null)
    .order('created_at', { ascending: false })

  if (error) return { keys: [], error: error.message }
  return { keys: data ?? [] }
}

/**
 * Generate a new API key for the current user.
 * Returns the raw key ONCE — it cannot be retrieved again.
 */
export async function generateApiKey(input: {
  name: string
  displayName: string
}): Promise<{ apiKey?: string; agentId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  if (!input.name || !input.displayName) {
    return { error: '이름과 표시 이름을 입력해주세요.' }
  }

  // Generate raw key: ag_ + 48 random bytes as hex
  const rawKey = `ag_${randomBytes(32).toString('hex')}`
  const hash = createHash('sha256').update(rawKey).digest('hex')
  const prefix = rawKey.slice(0, 10) // ag_XXXXXX for display

  const serviceClient = getServiceClient()
  const { data, error } = await serviceClient
    .from('agents')
    .insert({
      name: input.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      display_name: input.displayName,
      agent_kind: 'external',
      agent_role: 'developer',
      agent_runtime: 'remote',
      category: 'owned',
      owner_id: user.id,
      api_key_hash: hash,
      api_key_prefix: prefix,
      status: 'active',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { apiKey: rawKey, agentId: data.id }
}

/**
 * Revoke (delete) an API key.
 */
export async function revokeApiKey(agentId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const serviceClient = getServiceClient()

  // Verify ownership
  const { data: agent } = await serviceClient
    .from('agents')
    .select('id, owner_id')
    .eq('id', agentId)
    .single()

  if (!agent || agent.owner_id !== user.id) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await serviceClient
    .from('agents')
    .update({ status: 'inactive', api_key_hash: null, api_key_prefix: null })
    .eq('id', agentId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return {}
}
