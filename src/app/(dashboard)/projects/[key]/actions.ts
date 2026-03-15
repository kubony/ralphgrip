'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { getServiceClient } from '@/lib/supabase/service'
import type { ProjectSettings, ProjectRole, TraceabilityMatrixData, MatrixWorkItem, MatrixLink, MatrixColumnGroup, ExternalLinkEntry, CommentAttachment, WorkItem } from '@/types/database'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { trackEvent } from '@/lib/track-event'
import { notifySlack, buildWorkItemCreated, buildStatusChanged, buildDescriptionUpdated, buildCommentCreated, sendTestSlackMessage, inviteToSlackChannel } from '@/lib/slack-notify'
import { createNotification, createNotifications, extractMentionedUserIds, stripMentionMarkup } from '@/lib/notifications'
import { getNextWorkItemPosition, isWorkItemPositionConflict, MAX_POSITION_INSERT_ATTEMPTS } from '@/lib/server-actions/work-item-position'

async function requireWriteAccess(projectId: string): Promise<{
  error: string | null
  supabase: SupabaseClient | null
  user: User | null
}> {
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
    return { error: '프로젝트 멤버가 아닙니다.', supabase: null, user: null }
  }

  if (member.role === 'viewer') {
    return { error: '보기 전용 권한으로는 이 작업을 수행할 수 없습니다.', supabase: null, user: null }
  }

  return { error: null, supabase, user }
}

// 프로젝트 key lookup 캐시 (1시간 TTL, mutation마다 DB 조회 방지)
function getCachedProjectKey(projectId: string) {
  return unstable_cache(
    async () => {
      const supabase = getServiceClient()
      const { data } = await supabase
        .from('projects')
        .select('key')
        .eq('id', projectId)
        .single()
      return data?.key || projectId
    },
    [`project-key-${projectId}`],
    { tags: [`project:${projectId}:meta`], revalidate: 3600 }
  )()
}

// revalidatePath (Router Cache 무효화) + revalidateTag (Data Cache 무효화)
async function revalidateProject(projectId: string) {
  const key = await getCachedProjectKey(projectId)
  revalidatePath(`/projects/${key}`)
  revalidatePath(`/projects/${key}/settings`)
}

function invalidateProjectItems(projectId: string) {
  revalidateTag(`project:${projectId}:items`, 'max')
  revalidateTag(`project:${projectId}:links`, 'max')
}

function invalidateProjectMeta(projectId: string) {
  revalidateTag(`project:${projectId}:meta`, 'max')
}

function invalidateProjectMembers(projectId: string) {
  revalidateTag(`project:${projectId}:members`, 'max')
}

export async function updateProjectSettings(projectId: string, settings: ProjectSettings) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  const { error } = await supabase
    .from('projects')
    .update({ settings })
    .eq('id', projectId)

  if (error) {
    return { error: error.message }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) void trackEvent(user.id, 'project.settings_updated', projectId, { settings })

  invalidateProjectMeta(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function updateProjectCoverImage(
  projectId: string,
  coverImagePath: string | null
) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  // 현재 settings 읽기
  const { data: project } = await supabase
    .from('projects')
    .select('settings')
    .eq('id', projectId)
    .single()

  const currentSettings = (project?.settings as ProjectSettings) || {}
  const oldCoverPath = currentSettings.cover_image_path

  // settings 업데이트
  const newSettings: ProjectSettings = {
    ...currentSettings,
    cover_image_path: coverImagePath ?? undefined,
  }
  // null이면 키 자체를 제거
  if (coverImagePath === null) {
    delete newSettings.cover_image_path
  }

  const { error } = await supabase
    .from('projects')
    .update({ settings: newSettings })
    .eq('id', projectId)

  if (error) {
    return { error: error.message }
  }

  // 이전 커버 이미지 삭제
  if (oldCoverPath && oldCoverPath !== coverImagePath) {
    await supabase.storage.from('attachments').remove([oldCoverPath])
  }

  invalidateProjectMeta(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function addExternalLink(
  projectId: string,
  link: { label: string; url: string }
) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  // 현재 settings 읽기
  const { data: project } = await supabase
    .from('projects')
    .select('settings')
    .eq('id', projectId)
    .single()

  const currentSettings = (project?.settings as ProjectSettings) ?? {}
  const currentLinks = currentSettings.external_links ?? []

  const newLink: ExternalLinkEntry = {
    id: crypto.randomUUID(),
    label: link.label,
    url: link.url,
    created_at: new Date().toISOString(),
  }

  const updated: ProjectSettings = {
    ...currentSettings,
    external_links: [...currentLinks, newLink],
  }

  const { error } = await supabase
    .from('projects')
    .update({ settings: updated })
    .eq('id', projectId)

  if (error) return { error: error.message }

  invalidateProjectMeta(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function removeExternalLink(projectId: string, linkId: string) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  const { data: project } = await supabase
    .from('projects')
    .select('settings')
    .eq('id', projectId)
    .single()

  const currentSettings = (project?.settings as ProjectSettings) ?? {}
  const currentLinks = currentSettings.external_links ?? []

  const updated: ProjectSettings = {
    ...currentSettings,
    external_links: currentLinks.filter((l) => l.id !== linkId),
  }

  const { error } = await supabase
    .from('projects')
    .update({ settings: updated })
    .eq('id', projectId)

  if (error) return { error: error.message }

  invalidateProjectMeta(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function createWorkItem(formData: FormData) {
  const projectId = formData.get('projectId') as string
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }
  const title = formData.get('title') as string
  const trackerId = formData.get('trackerId') as string
  const statusId = formData.get('statusId') as string
  const priority = parseInt(formData.get('priority') as string || '0')
  const description = formData.get('description') as string || null
  const assigneeIdRaw = formData.get('assigneeId') as string || null
  const assigneeId = assigneeIdRaw && assigneeIdRaw !== '__none__' ? assigneeIdRaw : null
  const startDate = formData.get('startDate') as string || null
  const dueDate = formData.get('dueDate') as string || null
  const parentId = formData.get('parentId') as string || null
  const createdByAi = formData.get('createdByAi') === 'true'
  const aiMetadataRaw = formData.get('aiMetadata') as string | null
  let aiMetadata: Record<string, unknown> | null = null
  if (aiMetadataRaw) {
    try {
      const parsed = JSON.parse(aiMetadataRaw)
      aiMetadata = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
    } catch (error) {
      console.error('aiMetadata JSON parse failed:', error)
      aiMetadata = null
    }
  }

  // 유효성 검사
  if (!title || title.trim().length === 0) {
    return { error: '작업 제목을 입력해주세요.' }
  }

  if (!trackerId || !statusId) {
    return { error: '유형과 상태를 선택해주세요.' }
  }

  let data: WorkItem | null = null
  let error: { message: string } | null = null

  for (let attempt = 1; attempt <= MAX_POSITION_INSERT_ATTEMPTS; attempt += 1) {
    const newPosition = await getNextWorkItemPosition(supabase, projectId, parentId)
    const result = await supabase
      .from('work_items')
      .insert({
        project_id: projectId,
        title: title.trim(),
        tracker_id: trackerId,
        status_id: statusId,
        priority,
        description: description?.trim() || null,
        assignee_id: assigneeId || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        reporter_id: user.id,
        parent_id: parentId,
        position: newPosition,
        created_by_ai: createdByAi,
        ai_metadata: aiMetadata,
      })
      .select()
      .single()

    if (!result.error) {
      data = result.data
      error = null
      break
    }

    error = result.error
    if (!isWorkItemPositionConflict(result.error) || attempt === MAX_POSITION_INSERT_ATTEMPTS) {
      break
    }
  }

  if (error) {
    return { error: error.message }
  }
  if (!data) {
    return { error: '작업 생성에 실패했습니다.' }
  }

  void trackEvent(user.id, 'work_item.created', projectId, { work_item_id: data.id, title: title.trim() })

  // 임시 제목('새 아이템', '새 폴더')이면 알림 skip — 제목 확정 후 발송
  const trimmedTitle = title.trim()
  if (trimmedTitle !== '새 아이템' && trimmedTitle !== '새 폴더') {
    void (async () => {
      const [{ data: tracker }, { data: status }] = await Promise.all([
        supabase.from('trackers').select('name').eq('id', trackerId).single(),
        supabase.from('statuses').select('name').eq('id', statusId).single(),
      ])
      void notifySlack(projectId, (ctx) =>
        buildWorkItemCreated(ctx, trimmedTitle, data.number, tracker?.name ?? '', status?.name ?? ''),
      )
    })()
  }

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { data }
}

export async function updateWorkItemStatus(workItemId: string, statusId: string, projectId: string) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  // 알림용: 업데이트 전 현재 아이템 정보 캡처
  const { data: itemBefore } = await supabase
    .from('work_items')
    .select('title, number, status_id, assignee_id')
    .eq('id', workItemId)
    .single()

  const { error } = await supabase
    .from('work_items')
    .update({ status_id: statusId })
    .eq('id', workItemId)

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'work_item.status_changed', projectId, { work_item_id: workItemId, status_id: statusId })

  if (itemBefore) {
    void (async () => {
      const [{ data: oldStatus }, { data: newStatus }, projectKey] = await Promise.all([
        supabase.from('statuses').select('name').eq('id', itemBefore.status_id).single(),
        supabase.from('statuses').select('name').eq('id', statusId).single(),
        getCachedProjectKey(projectId),
      ])
      void notifySlack(projectId, (ctx) =>
        buildStatusChanged(ctx, itemBefore.title, itemBefore.number, oldStatus?.name ?? '', newStatus?.name ?? ''),
      )
      // 담당자에게 상태 변경 알림 (변경자 ≠ 담당자)
      if (itemBefore.assignee_id && itemBefore.assignee_id !== user.id) {
        void createNotification({
          userId: itemBefore.assignee_id,
          type: 'status_change',
          projectId,
          projectKey,
          workItemId,
          workItemNumber: itemBefore.number,
          title: itemBefore.title,
          body: `${oldStatus?.name ?? ''} → ${newStatus?.name ?? ''}`,
          actorId: user.id,
        })
      }
    })()
  }

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function deleteWorkItem(workItemId: string, projectId: string) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  // Use soft delete RPC function
  const { error } = await supabase
    .rpc('soft_delete_work_item', {
      p_work_item_id: workItemId,
    })

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'work_item.deleted', projectId, { work_item_id: workItemId })

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function updateWorkItem(
  workItemId: string,
  updates: {
    title?: string
    description?: string | null
    status_id?: string
    tracker_id?: string
    priority?: number
    assignee_id?: string | null
    due_date?: string | null
    start_date?: string | null
    actual_start_date?: string | null
    actual_end_date?: string | null
    estimated_hours?: number | null
    actual_hours?: number | null
    external_url?: string | null
    external_links?: { url: string; label?: string }[] | null
    parent_id?: string | null
    position?: number
    visibility?: 'internal' | 'public'
    ai_metadata?: Record<string, unknown> | null
  },
  projectId: string
) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  // 알림용: 업데이트 전 현재 상태 캡처 (상태 변경, 제목 확정, 본문 수정, 담당자 변경 알림)
  const PLACEHOLDER_TITLES = ['새 아이템', '새 폴더']
  let itemBefore: { title: string; number: number; status_id: string | null; tracker_id: string; assignee_id: string | null } | null = null
  if (updates.status_id || updates.title || updates.description !== undefined || updates.assignee_id !== undefined) {
    const { data } = await supabase
      .from('work_items')
      .select('title, number, status_id, tracker_id, assignee_id')
      .eq('id', workItemId)
      .single()
    itemBefore = data
  }

  const { error } = await supabase
    .from('work_items')
    .update(updates)
    .eq('id', workItemId)

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'work_item.updated', projectId, { work_item_id: workItemId, changed_fields: Object.keys(updates) })

  // 제목 확정 시 Slack "생성됨" 알림 (임시 제목 → 실제 제목으로 변경된 경우)
  if (updates.title && itemBefore && PLACEHOLDER_TITLES.includes(itemBefore.title) && !PLACEHOLDER_TITLES.includes(updates.title)) {
    void (async () => {
      const [{ data: tracker }, { data: status }] = await Promise.all([
        supabase.from('trackers').select('name').eq('id', itemBefore!.tracker_id).single(),
        supabase.from('statuses').select('name').eq('id', itemBefore!.status_id!).single(),
      ])
      void notifySlack(projectId, (ctx) =>
        buildWorkItemCreated(ctx, updates.title!, itemBefore!.number, tracker?.name ?? '', status?.name ?? ''),
      )
    })()
  }

  // 상태 변경 시 Slack 알림
  if (updates.status_id && itemBefore && itemBefore.status_id !== updates.status_id) {
    void (async () => {
      const [{ data: oldStatus }, { data: newStatus }] = await Promise.all([
        supabase.from('statuses').select('name').eq('id', itemBefore!.status_id!).single(),
        supabase.from('statuses').select('name').eq('id', updates.status_id!).single(),
      ])
      void notifySlack(projectId, (ctx) =>
        buildStatusChanged(ctx, updates.title ?? itemBefore!.title, itemBefore!.number, oldStatus?.name ?? '', newStatus?.name ?? ''),
      )
    })()
  }

  // 본문 수정 시 Slack 알림
  if (updates.description !== undefined && itemBefore) {
    void notifySlack(projectId, (ctx) =>
      buildDescriptionUpdated(ctx, itemBefore!.title, itemBefore!.number, updates.description ?? undefined),
    )
  }

  // 인앱 알림: 담당자 변경, 상태 변경
  if (itemBefore && !PLACEHOLDER_TITLES.includes(itemBefore.title)) {
    void (async () => {
      const projectKey = await getCachedProjectKey(projectId)
      const itemTitle = updates.title ?? itemBefore!.title

      // 담당자 변경 → 새 담당자에게 알림
      if (updates.assignee_id && updates.assignee_id !== itemBefore!.assignee_id) {
        void createNotification({
          userId: updates.assignee_id,
          type: 'assigned',
          projectId,
          projectKey,
          workItemId,
          workItemNumber: itemBefore!.number,
          title: itemTitle,
          actorId: user.id,
        })
      }

      // 상태 변경 → 담당자에게 알림 (변경자 ≠ 담당자)
      if (updates.status_id && itemBefore!.status_id !== updates.status_id && itemBefore!.assignee_id && itemBefore!.assignee_id !== user.id) {
        const [{ data: oldStatus }, { data: newStatus }] = await Promise.all([
          supabase.from('statuses').select('name').eq('id', itemBefore!.status_id!).single(),
          supabase.from('statuses').select('name').eq('id', updates.status_id!).single(),
        ])
        void createNotification({
          userId: itemBefore!.assignee_id,
          type: 'status_change',
          projectId,
          projectKey,
          workItemId,
          workItemNumber: itemBefore!.number,
          title: itemTitle,
          body: `${oldStatus?.name ?? ''} → ${newStatus?.name ?? ''}`,
          actorId: user.id,
        })
      }
    })()
  }

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function moveWorkItem(
  workItemId: string,
  newParentId: string | null,
  newPosition: number,
  projectId: string
) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  // 순환 참조 방지: 자기 자신을 부모로 설정 불가
  if (newParentId === workItemId) {
    return { error: '자기 자신을 부모로 설정할 수 없습니다.' }
  }

  // 순환 참조 방지: 자손을 부모로 설정 불가
  if (newParentId) {
    const { data: isCircular } = await supabase.rpc('check_circular_reference', {
      p_item_id: workItemId,
      p_new_parent_id: newParentId,
    })
    if (isCircular) {
      return { error: '자기 하위 항목으로 이동할 수 없습니다.' }
    }
  }

  // 1. 이동 대상 부모의 형제 목록 조회 (이동할 아이템 제외)
  let query = supabase
    .from('work_items')
    .select('id, position')
    .eq('project_id', projectId)
    .neq('id', workItemId)
    .order('position')

  if (newParentId === null) {
    query = query.is('parent_id', null)
  } else {
    query = query.eq('parent_id', newParentId)
  }

  const { data: siblings, error: fetchError } = await query
  if (fetchError) {
    return { error: fetchError.message }
  }

  // 2. 새 순서 구성: 형제 목록의 올바른 위치에 이동 아이템 삽입
  const sortedSiblings = (siblings || []).toSorted((a, b) => a.position - b.position)
  const orderedIds = sortedSiblings.map(s => s.id)
  const insertAt = Math.min(Math.max(0, newPosition), orderedIds.length)
  orderedIds.splice(insertAt, 0, workItemId)

  // 3. 변경된 아이템만 업데이트
  const updates = orderedIds
    .map((id, index) => {
      if (id === workItemId) {
        return supabase
          .from('work_items')
          .update({ parent_id: newParentId, position: index })
          .eq('id', id)
      }
      const oldSibling = sortedSiblings.find(s => s.id === id)
      if (oldSibling && oldSibling.position === index) {
        return null // position 변경 없음
      }
      return supabase
        .from('work_items')
        .update({ position: index })
        .eq('id', id)
    })
    .filter(Boolean)

  const results = await Promise.all(updates)
  const firstError = results.find(r => r && 'error' in r && r.error)
  if (firstError && 'error' in firstError) {
    return { error: String(firstError.error) }
  }

  const { data: { user: mover } } = await supabase.auth.getUser()
  if (mover) void trackEvent(mover.id, 'work_item.moved', projectId, { work_item_id: workItemId, new_parent_id: newParentId })

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function moveWorkItems(
  workItemIds: string[],
  newParentId: string | null,
  newPosition: number,
  projectId: string
) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  const movingSet = new Set(workItemIds)

  let query = supabase
    .from('work_items')
    .select('id, position')
    .eq('project_id', projectId)
    .order('position')

  if (newParentId === null) {
    query = query.is('parent_id', null)
  } else {
    query = query.eq('parent_id', newParentId)
  }

  const { data: allSiblings, error: fetchError } = await query
  if (fetchError) {
    return { error: fetchError.message }
  }

  const sortedSiblings = (allSiblings || [])
    .filter(s => !movingSet.has(s.id))
    .toSorted((a, b) => a.position - b.position)

  const orderedIds = sortedSiblings.map(s => s.id)
  const insertAt = Math.min(Math.max(0, newPosition), orderedIds.length)
  orderedIds.splice(insertAt, 0, ...workItemIds)

  // 이동 대상만 RPC로 parent_id + position 변경
  const movingMoves = orderedIds
    .map((id, index) => ({ id, parent_id: newParentId, position: index }))
    .filter(m => movingSet.has(m.id))

  const { error: rpcError } = await supabase
    .rpc('move_work_items_batch', {
      p_project_id: projectId,
      p_moves: movingMoves,
    })

  if (rpcError) {
    return { error: rpcError.message }
  }

  // 형제는 position만 개별 업데이트 (변경분만)
  const siblingUpdates = orderedIds
    .map((id, index) => ({ id, position: index }))
    .filter(({ id, position }) => {
      if (movingSet.has(id)) return false
      const old = sortedSiblings.find(s => s.id === id)
      return !old || old.position !== position
    })

  if (siblingUpdates.length > 0) {
    await Promise.all(
      siblingUpdates.map(({ id, position }) =>
        supabase.from('work_items').update({ position }).eq('id', id)
      )
    )
  }

  const { data: { user: batchMover } } = await supabase.auth.getUser()
  if (batchMover) void trackEvent(batchMover.id, 'work_item.moved', projectId, { work_item_ids: workItemIds, new_parent_id: newParentId })

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function copyWorkItem(workItemId: string, projectId: string) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  // 원본 아이템 조회
  const { data: original, error: fetchError } = await supabase
    .from('work_items')
    .select('*')
    .eq('id', workItemId)
    .single()

  if (fetchError || !original) {
    return { error: '원본 아이템을 찾을 수 없습니다.' }
  }

  // 같은 부모 아래에서 최대 position 찾기
  const { data: siblings } = await supabase
    .from('work_items')
    .select('position')
    .eq('project_id', projectId)
    .is('parent_id', original.parent_id)
    .order('position', { ascending: false })
    .limit(1)

  const newPosition = siblings && siblings.length > 0 ? siblings[0].position + 1 : 0

  // 복사본 생성
  const { data, error } = await supabase
    .from('work_items')
    .insert({
      project_id: original.project_id,
      tracker_id: original.tracker_id,
      status_id: original.status_id,
      parent_id: original.parent_id,
      title: `${original.title} (복사본)`,
      description: original.description,
      priority: original.priority,
      due_date: original.due_date,
      position: newPosition,
      reporter_id: user.id,
      visibility: original.visibility,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'work_item.copied', projectId, { source_id: workItemId, new_id: data.id })

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { data }
}

// ============ Batch Operations ============

export async function batchUpdateStatus(
  workItemIds: string[],
  statusId: string,
  projectId: string
) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  const { error } = await supabase
    .from('work_items')
    .update({ status_id: statusId })
    .in('id', workItemIds)

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'work_item.batch_status_changed', projectId, { count: workItemIds.length, status_id: statusId })

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function batchDelete(
  workItemIds: string[],
  projectId: string
) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  // Use batch soft delete RPC instead of hard delete
  const { error } = await supabase
    .rpc('batch_soft_delete_work_items', {
      p_project_id: projectId,
      p_work_item_ids: workItemIds,
    })

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'work_item.batch_deleted', projectId, { count: workItemIds.length })

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function batchUpdateField(
  workItemIds: string[],
  updates: {
    status_id?: string
    tracker_id?: string
    priority?: number
    assignee_id?: string | null
    visibility?: 'internal' | 'public'
  },
  projectId: string
) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  const { error } = await supabase
    .from('work_items')
    .update(updates)
    .in('id', workItemIds)

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'work_item.batch_updated', projectId, { count: workItemIds.length, changed_fields: Object.keys(updates) })

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

// ============ Comments ============

export async function getComments(workItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles!author_id(id, full_name, avatar_url),
      agent:agents!agent_id(id, display_name, avatar_url, agent_kind)
    `)
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function createComment(workItemId: string, content: string, projectId: string, attachments: CommentAttachment[] = []) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  if (!content.trim() && attachments.length === 0) {
    return { error: '댓글 내용을 입력해주세요.' }
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      work_item_id: workItemId,
      author_id: user.id,
      content: content.trim(),
      attachments: attachments.length > 0 ? attachments : [],
    })
    .select(`
      *,
      author:profiles!author_id(id, full_name, avatar_url)
    `)
    .single()

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'comment.created', projectId, { work_item_id: workItemId })

  void (async () => {
    const [{ data: item }, projectKey] = await Promise.all([
      supabase.from('work_items').select('title, number, assignee_id, reporter_id').eq('id', workItemId).single(),
      getCachedProjectKey(projectId),
    ])
    if (!item) return

    void notifySlack(projectId, (ctx) =>
      buildCommentCreated(ctx, item.title, item.number, content.trim()),
    )

    const trimmed = content.trim()
    const bodyPreview = stripMentionMarkup(trimmed).slice(0, 100)
    const mentionedIds = extractMentionedUserIds(trimmed)
    const mentionedSet = new Set(mentionedIds)

    // 멘션 알림
    if (mentionedIds.length > 0) {
      void createNotifications(
        mentionedIds.map((uid) => ({
          userId: uid,
          type: 'mention' as const,
          projectId,
          projectKey,
          workItemId,
          workItemNumber: item.number,
          title: item.title,
          body: bodyPreview,
          actorId: user.id,
          commentId: data.id,
        }))
      )
    }

    // 댓글 알림: 담당자/보고자에게 (멘션 대상 제외, 본인 제외)
    const commentTargets = new Set<string>()
    if (item.assignee_id && item.assignee_id !== user.id && !mentionedSet.has(item.assignee_id)) {
      commentTargets.add(item.assignee_id)
    }
    if (item.reporter_id && item.reporter_id !== user.id && !mentionedSet.has(item.reporter_id)) {
      commentTargets.add(item.reporter_id)
    }
    if (commentTargets.size > 0) {
      void createNotifications(
        [...commentTargets].map((uid) => ({
          userId: uid,
          type: 'comment' as const,
          projectId,
          projectKey,
          workItemId,
          workItemNumber: item.number,
          title: item.title,
          body: bodyPreview,
          actorId: user.id,
          commentId: data.id,
        }))
      )
    }
  })()

  await revalidateProject(projectId)
  return { data }
}

export async function updateComment(commentId: string, content: string, projectId: string, attachments?: CommentAttachment[]) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  if (!content.trim()) {
    return { error: '댓글 내용을 입력해주세요.' }
  }

  const updateData: Record<string, unknown> = { content: content.trim() }
  if (attachments !== undefined) {
    updateData.attachments = attachments
  }

  const { error } = await supabase
    .from('comments')
    .update(updateData)
    .eq('id', commentId)
    .eq('author_id', user.id)

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'comment.updated', projectId, { comment_id: commentId })

  await revalidateProject(projectId)
  return { success: true }
}

export async function deleteComment(commentId: string, projectId: string) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  // 삭제 전 첨부파일 경로 조회 (Storage 정리용)
  const { data: comment } = await supabase
    .from('comments')
    .select('attachments')
    .eq('id', commentId)
    .eq('author_id', user.id)
    .single()

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', user.id)

  if (error) {
    return { error: error.message }
  }

  // 첨부파일 Storage 삭제 (fire-and-forget)
  if (comment?.attachments && Array.isArray(comment.attachments) && comment.attachments.length > 0) {
    const paths = (comment.attachments as CommentAttachment[]).map(a => a.storage_path)
    void supabase.storage.from('attachments').remove(paths)
  }

  void trackEvent(user.id, 'comment.deleted', projectId, { comment_id: commentId })

  await revalidateProject(projectId)
  return { success: true }
}

// ============ Work Item Links (Traceability) ============

export async function getWorkItemLinks(workItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  // Outgoing + Incoming links 병렬 조회
  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase
      .from('work_item_links')
      .select(`
        id, suspect, created_at,
        target:work_items!work_item_links_target_id_fkey(
          id, number, title, deleted_at,
          project:projects!inner(key),
          tracker:trackers!inner(name, color),
          status:statuses!inner(name, color)
        )
      `)
      .eq('source_id', workItemId),
    supabase
      .from('work_item_links')
      .select(`
        id, suspect, created_at,
        source:work_items!work_item_links_source_id_fkey(
          id, number, title, deleted_at,
          project:projects!inner(key),
          tracker:trackers!inner(name, color),
          status:statuses!inner(name, color)
        )
      `)
      .eq('target_id', workItemId),
  ])

  function unwrapJoin(val: unknown): Record<string, unknown> {
    if (Array.isArray(val)) return val[0] ?? {}
    return (val as Record<string, unknown>) ?? {}
  }

  const links = [
    ...(outgoing || []).map((row) => {
      const t = unwrapJoin(row.target)
      const project = unwrapJoin(t.project) as Record<string, string>
      const tracker = unwrapJoin(t.tracker) as Record<string, string>
      const status = unwrapJoin(t.status) as Record<string, string>
      return {
        id: row.id,
        direction: 'outgoing' as const,
        suspect: row.suspect,
        linked_item: {
          id: t.id as string,
          number: t.number as number,
          title: t.title as string,
          project_key: project.key,
          tracker_name: tracker.name,
          tracker_color: tracker.color || null,
          status_name: status.name,
          status_color: status.color || null,
          is_deleted: t.deleted_at !== null,
        },
      }
    }),
    ...(incoming || []).map((row) => {
      const s = unwrapJoin(row.source)
      const project = unwrapJoin(s.project) as Record<string, string>
      const tracker = unwrapJoin(s.tracker) as Record<string, string>
      const status = unwrapJoin(s.status) as Record<string, string>
      return {
        id: row.id,
        direction: 'incoming' as const,
        suspect: row.suspect,
        linked_item: {
          id: s.id as string,
          number: s.number as number,
          title: s.title as string,
          project_key: project.key,
          tracker_name: tracker.name,
          tracker_color: tracker.color || null,
          status_name: status.name,
          status_color: status.color || null,
          is_deleted: s.deleted_at !== null,
        },
      }
    }),
  ]

  return { data: links }
}

export async function createWorkItemLink(sourceId: string, targetId: string, projectId: string) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  const { error } = await supabase
    .from('work_item_links')
    .insert({
      source_id: sourceId,
      target_id: targetId,
      created_by: user.id,
    })

  if (error) {
    if (error.code === '23505') {
      return { error: '이미 연결된 항목입니다.' }
    }
    return { error: error.message }
  }

  void trackEvent(user.id, 'link.created', projectId, { source_id: sourceId, target_id: targetId })

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function deleteWorkItemLink(linkId: string, projectId: string) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  const { error } = await supabase
    .from('work_item_links')
    .delete()
    .eq('id', linkId)

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'link.deleted', projectId, { link_id: linkId })

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function clearSuspect(linkId: string, projectId: string) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  const { error } = await supabase
    .from('work_item_links')
    .update({ suspect: false })
    .eq('id', linkId)

  if (error) {
    return { error: error.message }
  }

  invalidateProjectItems(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function getLinkableProjects() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data } = await supabase
    .from('project_members')
    .select(`
      project:projects!inner(id, name, key, project_type)
    `)
    .eq('user_id', user.id)

  const projects = (data || []).map((row) => {
    const raw = row.project
    const p = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null
    if (!p) return null
    return {
      id: p.id as string,
      name: p.name as string,
      key: p.key as string,
      project_type: p.project_type as string,
    }
  }).filter((p): p is NonNullable<typeof p> => p !== null && !!p.id)

  return { data: projects }
}

export async function getProjectWorkItemsForLinking(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data } = await supabase
    .from('work_items')
    .select(`
      id, number, title, parent_id, position,
      tracker:trackers!inner(name, color)
    `)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('position')

  const items = (data || []).map((row) => {
    const raw = row.tracker
    const tracker = (Array.isArray(raw) ? raw[0] : raw) as Record<string, string>
    return {
      id: row.id,
      number: row.number,
      title: row.title,
      parent_id: row.parent_id,
      position: row.position,
      tracker_name: tracker?.name ?? '',
      tracker_color: tracker?.color || null,
    }
  })

  return { data: items }
}

export async function getTraceabilityMatrixData(projectId: string): Promise<{ data: TraceabilityMatrixData | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: '로그인이 필요합니다.' }

  // Helper function to unwrap Supabase join results
  function unwrapJoin(val: unknown): Record<string, unknown> {
    if (Array.isArray(val)) return val[0] ?? {}
    return (val as Record<string, unknown>) ?? {}
  }

  // 1~3. Work items + outgoing/incoming links 병렬 조회
  const [rowsResult, outgoingResult, incomingResult] = await Promise.all([
    supabase
      .from('work_items')
      .select(`
        id, number, title, parent_id, position,
        tracker:trackers!inner(id, name, color),
        status:statuses!inner(id, name, color, position, is_closed)
      `)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('position'),
    supabase
      .from('work_item_links')
      .select(`
        id, source_id, target_id, suspect,
        source:work_items!work_item_links_source_id_fkey!inner(project_id),
        target:work_items!work_item_links_target_id_fkey(
          id, number, title, parent_id, position, deleted_at,
          project:projects!inner(id, key, name),
          tracker:trackers!inner(id, name, color),
          status:statuses!inner(id, name, color, position, is_closed)
        )
      `)
      .eq('source.project_id', projectId),
    supabase
      .from('work_item_links')
      .select(`
        id, source_id, target_id, suspect,
        target:work_items!work_item_links_target_id_fkey!inner(project_id),
        source:work_items!work_item_links_source_id_fkey(
          id, number, title, parent_id, position, deleted_at,
          project:projects!inner(id, key, name),
          tracker:trackers!inner(id, name, color),
          status:statuses!inner(id, name, color, position, is_closed)
        )
      `)
      .eq('target.project_id', projectId),
  ])

  const { data: rowsData, error: rowsError } = rowsResult
  if (rowsError) {
    return { data: null, error: rowsError.message }
  }
  const { data: outgoingData } = outgoingResult
  const { data: incomingData } = incomingResult

  // 4. Build parentMap and compute level for each row
  const parentMap = new Map<string, string>()
  const rows = (rowsData || []).map((row) => {
    if (row.parent_id) {
      parentMap.set(row.id, row.parent_id)
    }
    const tracker = unwrapJoin(row.tracker) as Record<string, unknown>
    const status = unwrapJoin(row.status) as Record<string, unknown>
    return {
      id: row.id,
      number: row.number,
      title: row.title,
      parent_id: row.parent_id,
      position: row.position,
      tracker: {
        id: tracker.id as string,
        name: tracker.name as string,
        color: (tracker.color as string | null) || null,
      },
      status: {
        id: status.id as string,
        name: status.name as string,
        color: (status.color as string | null) || null,
        position: status.position as number,
        is_closed: (status.is_closed as boolean | null) ?? null,
      },
    }
  })

  // Compute level for each item
  function computeLevel(itemId: string, visited = new Set<string>()): number {
    if (visited.has(itemId)) return 0 // Circular reference protection
    visited.add(itemId)
    const parentId = parentMap.get(itemId)
    if (!parentId) return 1
    return computeLevel(parentId, visited) + 1
  }

  const matrixRows: MatrixWorkItem[] = rows
    .filter(row => row.tracker.name !== 'Folder')
    .map(row => ({
      ...row,
      level: computeLevel(row.id),
    }))

  // 5. Process linked items and group by project
  const projectGroups = new Map<string, {
    project_id: string
    project_key: string
    project_name: string
    itemsMap: Map<string, MatrixWorkItem>
  }>()

  const links: MatrixLink[] = []

  // Process outgoing links
  if (outgoingData) {
    for (const link of outgoingData) {
      const target = unwrapJoin(link.target)
      if (!target.id || target.deleted_at) continue

      const project = unwrapJoin(target.project) as Record<string, unknown>
      const tracker = unwrapJoin(target.tracker) as Record<string, unknown>
      const status = unwrapJoin(target.status) as Record<string, unknown>

      const projectId = project.id as string
      const projectKey = project.key as string
      const projectName = project.name as string

      if (!projectGroups.has(projectId)) {
        projectGroups.set(projectId, {
          project_id: projectId,
          project_key: projectKey,
          project_name: projectName,
          itemsMap: new Map(),
        })
      }

      const group = projectGroups.get(projectId)!
      const itemId = target.id as string

      if (!group.itemsMap.has(itemId)) {
        group.itemsMap.set(itemId, {
          id: itemId,
          number: target.number as number,
          title: target.title as string,
          parent_id: (target.parent_id as string | null) ?? null,
          position: target.position as number,
          level: 1, // External items default to level 1
          tracker: {
            id: tracker.id as string,
            name: tracker.name as string,
            color: (tracker.color as string | null) || null,
          },
          status: {
            id: status.id as string,
            name: status.name as string,
            color: (status.color as string | null) || null,
            position: status.position as number,
            is_closed: (status.is_closed as boolean | null) ?? null,
          },
        })
      }

      links.push({
        id: link.id,
        source_id: link.source_id,
        target_id: link.target_id,
        suspect: link.suspect,
      })
    }
  }

  // Process incoming links
  if (incomingData) {
    for (const link of incomingData) {
      const source = unwrapJoin(link.source)
      if (!source.id || source.deleted_at) continue

      const project = unwrapJoin(source.project) as Record<string, unknown>
      const tracker = unwrapJoin(source.tracker) as Record<string, unknown>
      const status = unwrapJoin(source.status) as Record<string, unknown>

      const projectId = project.id as string
      const projectKey = project.key as string
      const projectName = project.name as string

      if (!projectGroups.has(projectId)) {
        projectGroups.set(projectId, {
          project_id: projectId,
          project_key: projectKey,
          project_name: projectName,
          itemsMap: new Map(),
        })
      }

      const group = projectGroups.get(projectId)!
      const itemId = source.id as string

      if (!group.itemsMap.has(itemId)) {
        group.itemsMap.set(itemId, {
          id: itemId,
          number: source.number as number,
          title: source.title as string,
          parent_id: (source.parent_id as string | null) ?? null,
          position: source.position as number,
          level: 1, // External items default to level 1
          tracker: {
            id: tracker.id as string,
            name: tracker.name as string,
            color: (tracker.color as string | null) || null,
          },
          status: {
            id: status.id as string,
            name: status.name as string,
            color: (status.color as string | null) || null,
            position: status.position as number,
            is_closed: (status.is_closed as boolean | null) ?? null,
          },
        })
      }

      links.push({
        id: link.id,
        source_id: link.source_id,
        target_id: link.target_id,
        suspect: link.suspect,
      })
    }
  }

  // 6. Convert Map to sorted column groups
  const columnGroups: MatrixColumnGroup[] = Array.from(projectGroups.values()).map(group => ({
    project_id: group.project_id,
    project_key: group.project_key,
    project_name: group.project_name,
    items: Array.from(group.itemsMap.values()).toSorted((a, b) => a.position - b.position),
  }))

  return {
    data: {
      rows: matrixRows,
      columnGroups,
      links,
    },
  }
}

// ============ Project Settings (General, Members) ============

export async function updateProjectInfo(
  projectId: string,
  updates: { name?: string; description?: string | null }
) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  if (updates.name !== undefined && (!updates.name || updates.name.trim().length === 0)) {
    return { error: '프로젝트 이름을 입력해주세요.' }
  }

  const updateData: Record<string, unknown> = {}
  if (updates.name !== undefined) updateData.name = updates.name.trim()
  if (updates.description !== undefined) updateData.description = updates.description?.trim() || null

  const { error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)

  if (error) {
    return { error: error.message }
  }

  const { data: { user: editor } } = await supabase.auth.getUser()
  if (editor) void trackEvent(editor.id, 'project.updated', projectId, { changed_fields: Object.keys(updateData) })

  invalidateProjectMeta(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function searchUsers(projectId: string, query?: string) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { users: [] }

  // 현재 프로젝트 멤버 ID 목록
  const { data: members } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)

  const memberIds = (members || []).map((m) => m.user_id)

  // 이메일 또는 이름으로 검색 (이미 멤버인 사용자 제외)
  let queryBuilder = supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .order('full_name', { ascending: true })
    .limit(20)

  if (query && query.length >= 1) {
    // Sanitize input to prevent PostgREST filter injection
    const sanitized = query.replace(/[%,.*()\\]/g, '')
    if (sanitized.length >= 1) {
      queryBuilder = queryBuilder.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`)
    }
  }

  if (memberIds.length > 0) {
    queryBuilder = queryBuilder.not('id', 'in', `(${memberIds.join(',')})`)
  }

  const { data: users } = await queryBuilder

  return { users: users || [] }
}

export async function inviteProjectMember(
  projectId: string,
  email: string,
  role: ProjectRole
) {
  const { error: authError, supabase } = await requireWriteAccess(projectId)
  if (authError || !supabase) return { error: authError || '권한 확인 실패' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) {
    return { error: '해당 이메일의 사용자를 찾을 수 없습니다.' }
  }

  const { data: existing } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', profile.id)
    .single()

  if (existing) {
    return { error: '이미 프로젝트 멤버입니다.' }
  }

  const { error } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: profile.id,
      role,
    })

  if (error) {
    return { error: error.message }
  }

  const { data: { user: inviter } } = await supabase.auth.getUser()
  if (inviter) void trackEvent(inviter.id, 'member.invited', projectId, { invited_email: email, role })

  // Slack 채널 자동 초대 (fire-and-forget)
  void inviteToSlackChannel(projectId, email)

  invalidateProjectMembers(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'member.removed', projectId, { member_id: memberId })

  invalidateProjectMembers(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

export async function updateProjectMemberRole(
  projectId: string,
  memberId: string,
  role: ProjectRole
) {
  const { error: authError, supabase, user } = await requireWriteAccess(projectId)
  if (authError || !supabase || !user) return { error: authError || '권한 확인 실패' }

  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', memberId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  void trackEvent(user.id, 'member.role_changed', projectId, { member_id: memberId, new_role: role })

  invalidateProjectMembers(projectId)
  await revalidateProject(projectId)
  return { success: true }
}

// ============ Slack Integration ============

export async function testSlackNotification(projectId: string) {
  const { error: authError } = await requireWriteAccess(projectId)
  if (authError) return { error: authError }

  return sendTestSlackMessage(projectId)
}

// ============ Agents ============

async function requireAdminAccess(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', supabase: null }

  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return { error: '관리자 권한이 필요합니다.', supabase: null }
  }

  return { error: null, supabase }
}

export async function getAgents(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!member) return { error: '프로젝트 접근 권한이 없습니다.' }

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function createAgent(
  projectId: string,
  input: { name: string; display_name: string; agent_kind: string; agent_role: string; agent_model?: string; agent_runtime: string; description?: string },
) {
  const { error: authError, supabase } = await requireAdminAccess(projectId)
  if (authError || !supabase) return { error: authError }

  const rawKey = `ag_${crypto.randomUUID().replace(/-/g, '')}`
  const prefix = rawKey.slice(0, 11) + '...'

  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const apiKeyHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  const { data, error } = await supabase
    .from('agents')
    .insert({
      project_id: projectId,
      name: input.name,
      display_name: input.display_name,
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
  return { data, apiKey: rawKey }
}

export async function updateAgent(
  agentId: string,
  projectId: string,
  input: { display_name?: string; agent_kind?: string; agent_role?: string; agent_model?: string | null; agent_runtime?: string; status?: string; description?: string },
) {
  const { error: authError, supabase } = await requireAdminAccess(projectId)
  if (authError || !supabase) return { error: authError }

  const { error } = await supabase
    .from('agents')
    .update(input)
    .eq('id', agentId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteAgent(agentId: string, projectId: string) {
  const { error: authError, supabase } = await requireAdminAccess(projectId)
  if (authError || !supabase) return { error: authError }

  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', agentId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function regenerateAgentApiKey(agentId: string, projectId: string) {
  const { error: authError, supabase } = await requireAdminAccess(projectId)
  if (authError || !supabase) return { error: authError }

  const rawKey = `ag_${crypto.randomUUID().replace(/-/g, '')}`
  const prefix = rawKey.slice(0, 11) + '...'

  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const apiKeyHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  const { error } = await supabase
    .from('agents')
    .update({ api_key_hash: apiKeyHash, api_key_prefix: prefix })
    .eq('id', agentId)
    .eq('project_id', projectId)

  if (error) return { error: error.message }
  return { apiKey: rawKey }
}
