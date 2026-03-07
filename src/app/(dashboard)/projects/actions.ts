'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { trackEvent } from '@/lib/track-event'
import { getUserAppRole } from '@/lib/supabase/cached-queries'
import { requireAuthenticatedUser } from '@/lib/server-actions/auth'

export async function createProject(formData: FormData) {
  const supabase = await createClient()

  const auth = await requireAuthenticatedUser(supabase)
  if (!auth.user) return { error: auth.error ?? '로그인이 필요합니다.' }
  const user = auth.user

  const appRole = await getUserAppRole(user.id)
  if (appRole === 'guest') {
    return { error: '게스트 사용자는 프로젝트를 생성할 수 없습니다.' }
  }

  const name = formData.get('name') as string
  const key = (formData.get('key') as string).toUpperCase()
  const description = formData.get('description') as string || null
  const projectType = (formData.get('projectType') as string) || 'issue'

  // 유효성 검사
  if (!name || name.trim().length === 0) {
    return { error: '프로젝트 이름을 입력해주세요.' }
  }

  if (!key || !/^[A-Z]{2,10}$/.test(key)) {
    return { error: '프로젝트 키는 2-10자의 영문 대문자여야 합니다.' }
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: name.trim(),
      key,
      description: description?.trim() || null,
      project_type: projectType as 'requirement' | 'issue',
      owner_id: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: '이미 사용 중인 프로젝트 키입니다.' }
    }
    return { error: error.message }
  }

  void trackEvent(user.id, 'project.created', data.id, { key, project_type: projectType })

  revalidatePath('/projects')
  return { data }
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()
  const auth = await requireAuthenticatedUser(supabase)
  if (!auth.user) return { error: auth.error ?? '로그인이 필요합니다.' }
  const user = auth.user

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'project.deleted', projectId)

  revalidatePath('/projects')
  return { success: true }
}

export async function toggleProjectDemo(projectId: string, isDemo: boolean) {
  const supabase = await createClient()
  const auth = await requireAuthenticatedUser(supabase)
  if (!auth.user) return { error: auth.error ?? '로그인이 필요합니다.' }
  const user = auth.user

  const appRole = await getUserAppRole(user.id)
  if (appRole !== 'admin') {
    return { error: '관리자만 데모 프로젝트를 설정할 수 있습니다.' }
  }

  const { error } = await supabase
    .from('projects')
    .update({ is_demo: isDemo })
    .eq('id', projectId)

  if (error) return { error: error.message }

  revalidatePath('/projects')
  return { success: true }
}

export async function toggleProjectPin(projectId: string, isPinned: boolean) {
  const supabase = await createClient()
  const auth = await requireAuthenticatedUser(supabase)
  if (!auth.user) return { error: auth.error ?? '로그인이 필요합니다.' }
  const user = auth.user

  const { error } = await supabase
    .from('project_members')
    .update({ is_pinned: isPinned })
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/my-work')
  return { success: true }
}
