import 'server-only'

import { getServiceClient } from '@/lib/supabase/service'

export type NotificationType = 'mention' | 'assigned' | 'comment' | 'status_change'

export interface CreateNotificationParams {
  userId: string       // recipient
  type: NotificationType
  projectId: string
  projectKey: string
  workItemId: string
  workItemNumber: number
  title: string        // work item title
  body?: string        // preview text
  actorId: string      // who triggered (human profile)
  agentActorId?: string // who triggered (agent) — mutually exclusive with actorId
  commentId?: string   // for comment/mention types
}

/**
 * Extract user IDs from @[name](user_id:UUID) TipTap mention markup.
 */
export function extractMentionedUserIds(content: string): string[] {
  const regex = /@\[([^\]]+)\]\(user_id:([^)]+)\)/g
  const ids: string[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    ids.push(match[2])
  }

  return [...new Set(ids)]
}

/**
 * Strip mention markup for body preview: @[이름](user_id:UUID) → @이름
 */
export function stripMentionMarkup(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(user_id:[^)]+\)/g, '@$1')
}

/**
 * Create a single notification record.
 * Fire-and-forget — errors are caught silently so they never affect main logic.
 * Self-notifications (actorId === userId) are skipped.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  if (!params.agentActorId && params.actorId === params.userId) return

  try {
    const supabase = getServiceClient()
    await supabase.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      project_id: params.projectId,
      project_key: params.projectKey,
      work_item_id: params.workItemId,
      work_item_number: params.workItemNumber,
      title: params.title,
      body: params.body ?? null,
      actor_id: params.agentActorId ? null : params.actorId,
      agent_actor_id: params.agentActorId ?? null,
      comment_id: params.commentId ?? null,
    })
  } catch {
    // Notification failure must not affect main logic
  }
}

/**
 * Bulk-create notifications (e.g. for multiple mention recipients).
 * Uses a single insert. Self-notifications are filtered out before the call.
 * Fire-and-forget — errors are caught silently.
 */
export async function createNotifications(paramsList: CreateNotificationParams[]): Promise<void> {
  const rows = paramsList
    .filter((p) => p.agentActorId || p.actorId !== p.userId)
    .map((p) => ({
      user_id: p.userId,
      type: p.type,
      project_id: p.projectId,
      project_key: p.projectKey,
      work_item_id: p.workItemId,
      work_item_number: p.workItemNumber,
      title: p.title,
      body: p.body ?? null,
      actor_id: p.agentActorId ? null : p.actorId,
      agent_actor_id: p.agentActorId ?? null,
      comment_id: p.commentId ?? null,
    }))

  if (rows.length === 0) return

  try {
    const supabase = getServiceClient()
    await supabase.from('notifications').insert(rows)
  } catch {
    // Notification failure must not affect main logic
  }
}
