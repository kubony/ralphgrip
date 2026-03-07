'use server'

import { createClient } from '@/lib/supabase/server'

type EventName =
  | 'project.created'
  | 'project.updated'
  | 'project.settings_updated'
  | 'project.deleted'
  | 'work_item.created'
  | 'work_item.updated'
  | 'work_item.deleted'
  | 'work_item.moved'
  | 'work_item.copied'
  | 'work_item.status_changed'
  | 'work_item.batch_status_changed'
  | 'work_item.batch_deleted'
  | 'work_item.batch_updated'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'link.created'
  | 'link.deleted'
  | 'member.invited'
  | 'member.removed'
  | 'member.role_changed'
  | 'project.exported'

/**
 * 유저 행동 이벤트를 기록합니다.
 * fire-and-forget 방식으로 메인 로직을 블로킹하지 않습니다.
 */
export async function trackEvent(
  userId: string,
  eventName: EventName,
  projectId?: string | null,
  properties?: Record<string, unknown>
) {
  try {
    const supabase = await createClient()
    await supabase.from('user_events').insert({
      user_id: userId,
      event_name: eventName,
      project_id: projectId || null,
      properties: properties || {},
    })
  } catch {
    // 이벤트 기록 실패가 메인 로직에 영향을 주지 않음
  }
}
