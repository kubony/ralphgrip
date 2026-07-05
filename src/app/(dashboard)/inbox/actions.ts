'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'

/** 프로젝트 쓰기 권한 검증 (멤버 + viewer 제외) */
async function requireWriteAccess(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '로그인이 필요합니다.', supabase: null, user: null }
  }

  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return { error: '해당 프로젝트의 멤버가 아닙니다.', supabase: null, user: null }
  }
  if (member.role === 'viewer') {
    return { error: '보기 전용 권한으로는 이 작업을 수행할 수 없습니다.', supabase: null, user: null }
  }

  return { error: null, supabase, user }
}

/** 프로젝트에서 이름으로 상태 id 조회 */
async function findStatusIdByName(
  supabase: NonNullable<Awaited<ReturnType<typeof requireWriteAccess>>['supabase']>,
  projectId: string,
  statusName: string,
) {
  const { data } = await supabase
    .from('statuses')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', statusName)
    .single()
  return data?.id ?? null
}

function revalidateInbox(userId: string, projectId: string) {
  revalidatePath('/inbox')
  revalidateTag(`user:${userId}:inbox`, 'max')
  revalidateTag(`project:${projectId}:items`, 'max')
}

/** 승인: work item을 'Closed' 상태로 전환 (오케스트레이터 최종 승인) */
export async function approveWorkItem(workItemId: string, projectId: string) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  const closedStatusId = await findStatusIdByName(supabase, projectId, 'Closed')
  if (!closedStatusId) {
    return { error: "'Closed' 상태를 찾을 수 없습니다. (이슈 프로젝트가 아닐 수 있습니다)" }
  }

  const { error } = await supabase
    .from('work_items')
    .update({ status_id: closedStatusId })
    .eq('id', workItemId)

  if (error) return { error: error.message }

  revalidateInbox(user.id, projectId)
  return { success: true }
}

/** 재작업 요청: 사유를 댓글로 남기고 'In Progress'로 되돌린다 */
export async function requestRework(workItemId: string, projectId: string, reason: string) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  const trimmed = reason.trim()
  if (!trimmed) {
    return { error: '재작업 사유를 입력해주세요.' }
  }

  const inProgressStatusId = await findStatusIdByName(supabase, projectId, 'In Progress')
  if (!inProgressStatusId) {
    return { error: "'In Progress' 상태를 찾을 수 없습니다. (이슈 프로젝트가 아닐 수 있습니다)" }
  }

  const { error: commentError } = await supabase
    .from('comments')
    .insert({
      work_item_id: workItemId,
      author_id: user.id,
      content: `**재작업 요청**\n\n${trimmed}`,
    })
  if (commentError) return { error: commentError.message }

  const { error: statusError } = await supabase
    .from('work_items')
    .update({ status_id: inProgressStatusId })
    .eq('id', workItemId)
  if (statusError) return { error: statusError.message }

  revalidateInbox(user.id, projectId)
  return { success: true }
}

// ============ 멘션 읽음 관리 (my-work에서 이동) ============

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

  revalidatePath('/inbox')
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

  revalidatePath('/inbox')
  return { success: true }
}

// ============ 작업 항목 핀 토글 (my-work에서 이동) ============

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

  revalidatePath('/inbox')
  return { success: true }
}
