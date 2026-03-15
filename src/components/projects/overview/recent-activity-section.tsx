'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { ActorAvatar, getActorName } from '@/components/ui/actor-avatar'
import { Button } from '@/components/ui/button'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import ArrowRightLeft from 'lucide-react/dist/esm/icons/arrow-right-left'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'

// ---- Types ----

interface ActivityLog {
  id: string
  work_item_id: string
  operation: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[]
  changed_at: string
  user: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface RecentComment {
  id: string
  content: string
  created_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
  agent: { id: string; display_name: string; avatar_url: string | null; agent_kind: string } | null
  work_item: { id: string; number: number; title: string; project_id: string }
}

interface WorkItemRef {
  id: string
  number: number
  title: string
}

interface Status {
  id: string
  name: string
  color: string | null
}

interface Member {
  id: string
  full_name: string | null
}

type ActivityType = 'comment' | 'status_change' | 'assignee_change' | 'description_change' | 'title_change' | 'multi_change'

interface ActivityItem {
  id: string
  type: ActivityType
  timestamp: string
  user: { id: string; full_name: string | null; avatar_url: string | null } | null
  agent?: { id: string; display_name: string; avatar_url: string | null; agent_kind: string } | null
  workItem: WorkItemRef
  commentContent?: string
  description: string
  statusDot?: { old: string | null; new: string | null }
}

// ---- Props ----

interface RecentActivitySectionProps {
  activityLogs: ActivityLog[]
  recentComments: RecentComment[]
  workItems: { id: string; number: number; title: string }[]
  statuses: Status[]
  members: Member[]
  projectKey: string
}

// ---- Helpers ----

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}시간 전`

  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}일 전`

  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

// ---- Component ----

export function RecentActivitySection({
  activityLogs,
  recentComments,
  workItems,
  statuses,
  members,
  projectKey,
}: RecentActivitySectionProps) {
  const [displayCount, setDisplayCount] = useState(10)

  // Build lookup maps
  const workItemMap = useMemo(() => {
    const map = new Map<string, WorkItemRef>()
    for (const wi of workItems) {
      map.set(wi.id, { id: wi.id, number: wi.number, title: wi.title })
    }
    return map
  }, [workItems])

  const statusMap = useMemo(() => {
    const map = new Map<string, Status>()
    for (const s of statuses) {
      map.set(s.id, s)
    }
    return map
  }, [statuses])

  const memberMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of members) {
      map.set(m.id, m.full_name ?? '(이름 없음)')
    }
    return map
  }, [members])

  // Merge and sort activities
  const activities = useMemo(() => {
    const items: ActivityItem[] = []

    // Convert audit logs
    for (const log of activityLogs) {
      const wi = workItemMap.get(log.work_item_id)
      if (!wi) continue // skip if work item was deleted

      const meaningfulFields = log.changed_fields.filter(f =>
        ['title', 'description', 'status_id', 'assignee_id'].includes(f)
      )
      if (meaningfulFields.length === 0) continue

      // Determine activity type and description
      if (meaningfulFields.length > 1) {
        // Multi-change
        const parts: string[] = []
        let statusDot: { old: string | null; new: string | null } | undefined

        for (const field of meaningfulFields) {
          if (field === 'status_id') {
            const oldStatus = statusMap.get(log.old_values?.status_id as string)
            const newStatus = statusMap.get(log.new_values?.status_id as string)
            parts.push(`상태를 ${oldStatus?.name ?? '?'} → ${newStatus?.name ?? '?'}`)
            statusDot = { old: oldStatus?.color ?? null, new: newStatus?.color ?? null }
          } else if (field === 'assignee_id') {
            const oldName = memberMap.get(log.old_values?.assignee_id as string) ?? '없음'
            const newName = memberMap.get(log.new_values?.assignee_id as string) ?? '없음'
            parts.push(`담당자를 ${oldName} → ${newName}`)
          } else if (field === 'description') {
            parts.push('설명')
          } else if (field === 'title') {
            parts.push('제목')
          }
        }

        items.push({
          id: log.id,
          type: 'multi_change',
          timestamp: log.changed_at,
          user: log.user,
          workItem: wi,
          description: parts.join(', ') + '(을)를 변경',
          statusDot,
        })
      } else {
        const field = meaningfulFields[0]
        let type: ActivityType
        let description: string
        let statusDot: { old: string | null; new: string | null } | undefined

        if (field === 'status_id') {
          type = 'status_change'
          const oldStatus = statusMap.get(log.old_values?.status_id as string)
          const newStatus = statusMap.get(log.new_values?.status_id as string)
          description = `상태를 ${oldStatus?.name ?? '?'} → ${newStatus?.name ?? '?'}(으)로 변경`
          statusDot = { old: oldStatus?.color ?? null, new: newStatus?.color ?? null }
        } else if (field === 'assignee_id') {
          type = 'assignee_change'
          const oldName = memberMap.get(log.old_values?.assignee_id as string) ?? '없음'
          const newName = memberMap.get(log.new_values?.assignee_id as string) ?? '없음'
          description = `담당자를 ${oldName} → ${newName}(으)로 변경`
        } else if (field === 'description') {
          type = 'description_change'
          description = '설명을 수정했습니다'
        } else {
          type = 'title_change'
          description = '제목을 수정했습니다'
        }

        items.push({
          id: log.id,
          type,
          timestamp: log.changed_at,
          user: log.user,
          workItem: wi,
          description,
          statusDot,
        })
      }
    }

    // Convert comments
    for (const comment of recentComments) {
      items.push({
        id: `comment-${comment.id}`,
        type: 'comment',
        timestamp: comment.created_at,
        user: comment.author,
        agent: comment.agent,
        workItem: {
          id: comment.work_item.id,
          number: comment.work_item.number,
          title: comment.work_item.title,
        },
        description: '댓글을 남겼습니다',
        commentContent: comment.content.length > 80
          ? comment.content.slice(0, 80) + '...'
          : comment.content,
      })
    }

    // Sort by timestamp DESC
    return items.toSorted((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [activityLogs, recentComments, workItemMap, statusMap, memberMap])

  const visibleItems = activities.slice(0, displayCount)
  const hasMore = activities.length > displayCount

  const activityIcon = (type: ActivityType) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
      case 'status_change':
        return <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500" />
      case 'assignee_change':
        return <ArrowRightLeft className="h-3.5 w-3.5 text-purple-500" />
      case 'description_change':
        return <FileText className="h-3.5 w-3.5 text-green-500" />
      case 'title_change':
        return <Pencil className="h-3.5 w-3.5 text-orange-500" />
      case 'multi_change':
        return <ArrowRightLeft className="h-3.5 w-3.5 text-rose-500" />
    }
  }

  return (
    <Card className="p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <h2 className="text-lg font-semibold mb-4">최근 활동</h2>

      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          최근 7일간 활동이 없습니다.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            {visibleItems.map((item) => (
              <Link
                key={item.id}
                href={`/projects/${projectKey}/alm?item=${item.workItem.id}`}
                className="flex gap-3 p-2 rounded-lg hover:bg-accent transition-colors group"
              >
                {/* Avatar */}
                <ActorAvatar profile={item.user} agent={item.agent} size="sm" className="h-7 w-7 shrink-0 mt-0.5" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-medium truncate">
                      {getActorName(item.user, item.agent)}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {activityIcon(item.type)}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {item.description}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono shrink-0">
                      {projectKey}-{item.workItem.number}
                    </span>
                    <span className="truncate">{item.workItem.title}</span>
                    <span className="shrink-0 ml-auto">{timeAgo(item.timestamp)}</span>
                  </div>

                  {/* Comment preview */}
                  {item.type === 'comment' && item.commentContent && (
                    <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1 italic">
                      &ldquo;{item.commentContent}&rdquo;
                    </p>
                  )}

                  {/* Status dots */}
                  {item.statusDot && (
                    <div className="flex items-center gap-1.5 text-xs mt-0.5">
                      {item.statusDot.old && (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: item.statusDot.old }}
                        />
                      )}
                      <span className="text-muted-foreground">→</span>
                      {item.statusDot.new && (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: item.statusDot.new }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3"
              onClick={() => setDisplayCount((prev) => prev + 10)}
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              더보기 ({activities.length - displayCount}건 남음)
            </Button>
          )}
        </>
      )}
    </Card>
  )
}
