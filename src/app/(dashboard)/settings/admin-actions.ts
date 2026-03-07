'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserAppRole } from '@/lib/supabase/cached-queries'
import { revalidatePath } from 'next/cache'

const VALID_APP_ROLES = new Set(['admin', 'user', 'guest'])

export async function getAllUsers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const appRole = await getUserAppRole(user.id)
  if (appRole !== 'admin') {
    return { error: '관리자 권한이 필요합니다.' }
  }

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, app_role, created_at')
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { data: users }
}

export async function updateUserRole(userId: string, newRole: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const appRole = await getUserAppRole(user.id)
  if (appRole !== 'admin') {
    return { error: '관리자 권한이 필요합니다.' }
  }

  if (!VALID_APP_ROLES.has(newRole)) {
    return { error: '유효하지 않은 권한입니다.' }
  }

  const { error } = await supabase.rpc('update_user_app_role', {
    p_user_id: userId,
    p_new_role: newRole,
  })

  if (error) return { error: error.message }

  revalidatePath('/settings/admin')
  revalidatePath('/settings')
  return { success: true }
}
