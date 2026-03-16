'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { normalizeWorkItemDateTimePatch } from '@/lib/work-item-datetime'

export async function toggleWorkItemPin(workItemId: string, pinned: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  if (pinned) {
    const { error } = await supabase
      .from('user_pinned_items')
      .upsert({ user_id: user.id, work_item_id: workItemId })
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('user_pinned_items')
      .delete()
      .eq('user_id', user.id)
      .eq('work_item_id', workItemId)
    if (error) return { error: error.message }
  }

  revalidatePath('/my-work')
  return { success: true }
}

export async function updateMyWorkItemDates(
  workItemId: string,
  projectId: string,
  dates: { start_date?: string | null; due_date?: string | null }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 프로젝트 멤버십 검증
  const { data: membership } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { error: '해당 프로젝트의 멤버가 아닙니다.' }

  const normalizedDates = normalizeWorkItemDateTimePatch(dates)

  const { error } = await supabase
    .from('work_items')
    .update(normalizedDates)
    .eq('id', workItemId)

  if (error) return { error: error.message }

  revalidatePath('/my-work')
  revalidateTag(`user:${user.id}:my-work`, 'max')
  revalidateTag(`project:${projectId}:items`, 'max')
  return { success: true }
}

export async function updateMyWorkItemField(
  workItemId: string,
  projectId: string,
  updates: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { error: '해당 프로젝트의 멤버가 아닙니다.' }
  if (membership.role === 'viewer') return { error: '보기 전용 권한으로는 수정할 수 없습니다.' }

  const normalizedUpdates = normalizeWorkItemDateTimePatch(updates)

  const { error } = await supabase
    .from('work_items')
    .update(normalizedUpdates)
    .eq('id', workItemId)

  if (error) return { error: error.message }

  revalidatePath('/my-work')
  revalidateTag(`user:${user.id}:my-work`, 'max')
  revalidateTag(`project:${projectId}:items`, 'max')
  return { success: true }
}

export async function toggleCommentRead(commentId: string, isRead: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  if (isRead) {
    const { error } = await supabase
      .from('comment_reads')
      .upsert({ user_id: user.id, comment_id: commentId })
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('comment_reads')
      .delete()
      .eq('user_id', user.id)
      .eq('comment_id', commentId)
    if (error) return { error: error.message }
  }

  revalidatePath('/my-work')
  return { success: true }
}

export async function markAllCommentsRead(commentIds: string[]) {
  if (commentIds.length === 0) return { success: true }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const rows = commentIds.map(id => ({ user_id: user.id, comment_id: id }))
  const { error } = await supabase
    .from('comment_reads')
    .upsert(rows)
  if (error) return { error: error.message }

  revalidatePath('/my-work')
  return { success: true }
}

export async function getProjectMetadata(projectId: string) {
  const { getProjectStatuses, getProjectTrackers, getProjectMembers } = await import('@/lib/supabase/cached-queries')
  const [statuses, trackers, members] = await Promise.all([
    getProjectStatuses(projectId),
    getProjectTrackers(projectId),
    getProjectMembers(projectId),
  ])
  return { statuses, trackers, members }
}

export async function updateMyWorkItemStatus(
  workItemId: string,
  statusId: string,
  projectId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 프로젝트 멤버십 검증
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { error: '해당 프로젝트의 멤버가 아닙니다.' }
  if (membership.role === 'viewer') return { error: '보기 전용 권한으로는 상태를 변경할 수 없습니다.' }

  const { error } = await supabase
    .from('work_items')
    .update({ status_id: statusId })
    .eq('id', workItemId)

  if (error) return { error: error.message }

  revalidatePath('/my-work')
  revalidateTag(`user:${user.id}:my-work`, 'max')
  revalidateTag(`project:${projectId}:items`, 'max')
  return { success: true }
}
