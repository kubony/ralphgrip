'use server'

import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'

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
