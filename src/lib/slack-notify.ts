import { createClient } from '@/lib/supabase/server'
import type { ProjectSettings } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SlackBlock = Record<string, any>

interface SlackMessage {
  blocks: SlackBlock[]
  text: string // fallback for notifications
  unfurl_links?: boolean
  unfurl_media?: boolean
}

interface ProjectContext {
  projectKey: string
  projectName: string
  userName: string
  agentName?: string
}

interface ResolvedProject {
  ctx: ProjectContext
  channelId: string
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://madspeed.app').trim().replace(/\/+$/, '')

function itemUrl(projectKey: string, itemNumber: number) {
  return `${APP_URL}/projects/${projectKey}/alm?item=${itemNumber}`
}

function projectUrl(projectKey: string) {
  return `${APP_URL}/projects/${projectKey}/alm`
}

/** @[이름](user_id:UUID) → @이름 으로 변환 */
function stripMentionIds(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(user_id:[^)]+\)/g, '@$1')
}

// ── Slack API Helpers ────────────────────────────────────────

function getToken(): string | undefined {
  return process.env.SLACK_BOT_TOKEN
}

async function slackFetch(endpoint: string, options?: RequestInit) {
  const token = getToken()
  return fetch(`https://slack.com/api/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
}

async function resolveProject(projectId: string): Promise<ResolvedProject | null> {
  const supabase = await createClient()

  const [{ data: project }, { data: { user } }] = await Promise.all([
    supabase.from('projects').select('key, name, settings').eq('id', projectId).single(),
    supabase.auth.getUser(),
  ])

  if (!project) return null

  const settings = (project.settings ?? {}) as ProjectSettings
  const channelId = settings.slack_channel_id
  if (!channelId) return null

  let userName = 'Unknown'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    userName = profile?.full_name || user.email || 'Unknown'
  }

  return {
    ctx: { projectKey: project.key, projectName: project.name, userName },
    channelId,
  }
}

// ── Block Helpers ────────────────────────────────────────────

function viewButton(url: string): SlackBlock {
  return {
    type: 'button',
    text: { type: 'plain_text', text: 'View', emoji: true },
    url,
    action_id: 'view_item',
  }
}

function actorLabel(ctx: ProjectContext): string {
  if (ctx.agentName) return `${ctx.agentName} (Bot)`
  return ctx.userName
}

function contextBlock(ctx: ProjectContext): SlackBlock {
  return {
    type: 'context',
    elements: [
      { type: 'plain_text', text: `${actorLabel(ctx)} · ${ctx.projectKey}`, emoji: true },
    ],
  }
}

function fieldsSection(fields: [string, string][]): SlackBlock {
  return {
    type: 'section',
    fields: fields.map(([label, value]) => ({
      type: 'mrkdwn',
      text: `*${label}:*\n${value}`,
    })),
  }
}

function itemMessage(
  ctx: ProjectContext,
  fallbackText: string,
  number: number,
  bodyMrkdwn: string,
  extra: SlackBlock[],
): SlackMessage {
  const url = itemUrl(ctx.projectKey, number)
  return {
    text: fallbackText,
    unfurl_links: false,
    unfurl_media: false,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: bodyMrkdwn },
        accessory: viewButton(url),
      },
      ...extra,
      contextBlock(ctx),
    ],
  }
}

// ── Message Builders ─────────────────────────────────────────

export function buildWorkItemCreated(
  ctx: ProjectContext,
  title: string,
  number: number,
  trackerName: string,
  statusName: string,
): SlackMessage {
  const itemId = `${ctx.projectKey}-${number}`
  return itemMessage(
    ctx,
    `[${ctx.projectName}] ${ctx.userName}님이 새 ${trackerName}을 생성했습니다: ${title}`,
    number,
    `*${itemId} ${title}*\n${ctx.userName} created a new ${trackerName}`,
    [fieldsSection([['Project', ctx.projectName], ['Status', statusName]])],
  )
}

export function buildStatusChanged(
  ctx: ProjectContext,
  title: string,
  number: number,
  oldStatus: string,
  newStatus: string,
): SlackMessage {
  const itemId = `${ctx.projectKey}-${number}`
  return itemMessage(
    ctx,
    `[${ctx.projectName}] ${ctx.userName}님이 ${itemId}의 상태를 변경했습니다: ${oldStatus} → ${newStatus}`,
    number,
    `*${itemId} ${title}*\n~${oldStatus}~ → *${newStatus}*`,
    [fieldsSection([['Project', ctx.projectName], ['Changed by', ctx.userName]])],
  )
}

export function buildDescriptionUpdated(
  ctx: ProjectContext,
  title: string,
  number: number,
  description?: string,
): SlackMessage {
  const itemId = `${ctx.projectKey}-${number}`
  const extra: SlackBlock[] = [fieldsSection([['Project', ctx.projectName], ['Updated by', ctx.userName]])]
  if (description) {
    const cleaned = stripMentionIds(description)
    const preview = cleaned.length > 200 ? cleaned.slice(0, 200) + '...' : cleaned
    extra.push({ type: 'section', text: { type: 'mrkdwn', text: `> ${preview}` } })
  }
  return itemMessage(
    ctx,
    `[${ctx.projectName}] ${ctx.userName}님이 ${itemId}의 본문을 수정했습니다`,
    number,
    `*${itemId} ${title}*\n${ctx.userName} updated description`,
    extra,
  )
}

export function buildCommentCreated(
  ctx: ProjectContext,
  title: string,
  number: number,
  commentPreview: string,
): SlackMessage {
  const itemId = `${ctx.projectKey}-${number}`
  const cleaned = stripMentionIds(commentPreview)
  const preview = cleaned.length > 200
    ? cleaned.slice(0, 200) + '...'
    : cleaned
  return itemMessage(
    ctx,
    `[${ctx.projectName}] ${ctx.userName}님이 ${itemId}에 댓글을 남겼습니다`,
    number,
    `*${itemId} ${title}*\n${ctx.userName} commented:`,
    [{ type: 'section', text: { type: 'mrkdwn', text: `> ${preview}` } }],
  )
}

export function buildTestMessage(ctx: ProjectContext): SlackMessage {
  return {
    text: `[${ctx.projectName}] Slack 연동 테스트 메시지입니다.`,
    unfurl_links: false,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${ctx.projectName}* 프로젝트의 Slack 알림이 정상적으로 연동되었습니다.\n\n작업 생성, 상태 변경, 본문 수정, 댓글 추가 시 이 채널로 알림이 전송됩니다.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open Project', emoji: true },
            url: projectUrl(ctx.projectKey),
            action_id: 'open_project',
            style: 'primary',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          { type: 'plain_text', text: `Sent by ${ctx.userName} via RalphGrip`, emoji: true },
        ],
      },
    ],
  }
}

// ── Core Sender ──────────────────────────────────────────────

async function postToSlack(channelId: string, message: SlackMessage): Promise<boolean> {
  if (!getToken()) return false

  try {
    const res = await slackFetch('chat.postMessage', {
      method: 'POST',
      body: JSON.stringify({
        channel: channelId,
        text: message.text,
        blocks: message.blocks,
        unfurl_links: message.unfurl_links ?? false,
        unfurl_media: message.unfurl_media ?? false,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      console.warn(`[Slack] chat.postMessage failed: ${data.error}`)
      return false
    }
    return true
  } catch (err) {
    console.warn('[Slack] Network error:', err)
    return false
  }
}

// ── Slack Channel Invite ─────────────────────────────────────

/**
 * 이메일로 Slack 유저를 찾아 지정된 채널에 초대합니다.
 * fire-and-forget 방식: 실패해도 멤버 추가에 영향 없음.
 */
export async function inviteToSlackChannel(
  projectId: string,
  memberEmail: string,
): Promise<void> {
  try {
    if (!getToken()) return

    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('settings')
      .eq('id', projectId)
      .single()

    if (!project) return

    const settings = (project.settings ?? {}) as ProjectSettings
    const channelId = settings.slack_channel_id
    if (!channelId) return

    // 1. 이메일로 Slack 유저 ID 조회
    const lookupRes = await slackFetch(`users.lookupByEmail?email=${encodeURIComponent(memberEmail)}`, {
      method: 'GET',
    })
    const lookupData = await lookupRes.json()
    if (!lookupData.ok) {
      console.warn(`[Slack] users.lookupByEmail failed for ${memberEmail}: ${lookupData.error}`)
      return
    }

    const slackUserId = lookupData.user?.id
    if (!slackUserId) return

    // 2. 채널에 초대
    const inviteRes = await slackFetch('conversations.invite', {
      method: 'POST',
      body: JSON.stringify({ channel: channelId, users: slackUserId }),
    })
    const inviteData = await inviteRes.json()
    if (!inviteData.ok && inviteData.error !== 'already_in_channel') {
      console.warn(`[Slack] conversations.invite failed: ${inviteData.error}`)
    }
  } catch {
    // fire-and-forget
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * 프로젝트에 연결된 Slack 채널로 메시지를 전송합니다.
 * fire-and-forget 방식: 실패해도 앱 동작에 영향 없음.
 */
export async function notifySlack(
  projectId: string,
  buildMessage: (ctx: ProjectContext) => SlackMessage,
) {
  try {
    if (!getToken()) return

    const resolved = await resolveProject(projectId)
    if (!resolved) return

    await postToSlack(resolved.channelId, buildMessage(resolved.ctx))
  } catch {
    // fire-and-forget
  }
}

/**
 * Slack 테스트 메시지 전송 (설정 페이지용).
 * 결과를 반환하여 UI에 성공/실패 피드백을 줍니다.
 */
export async function sendTestSlackMessage(
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!getToken()) {
    return { success: false, error: 'SLACK_BOT_TOKEN이 설정되지 않았습니다.' }
  }

  const resolved = await resolveProject(projectId)
  if (!resolved) {
    return { success: false, error: '프로젝트를 찾을 수 없거나 Slack 채널 ID가 설정되지 않았습니다.' }
  }

  const ok = await postToSlack(resolved.channelId, buildTestMessage(resolved.ctx))
  if (!ok) {
    return { success: false, error: '메시지 전송에 실패했습니다. 채널 ID와 봇 권한을 확인해주세요.' }
  }
  return { success: true }
}
