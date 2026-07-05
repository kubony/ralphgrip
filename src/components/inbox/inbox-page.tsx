'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { ActorAvatar } from '@/components/ui/actor-avatar'
import { WorkItemDetailDialog } from '@/components/projects/work-item-detail-dialog'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Loader from 'lucide-react/dist/esm/icons/loader'
import AtSign from 'lucide-react/dist/esm/icons/at-sign'
import Bot from 'lucide-react/dist/esm/icons/bot'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import { InboxSummaryCards } from './inbox-summary-cards'
import { InboxMentions } from './inbox-mentions'
import { AgentActivityFeed } from './agent-activity-feed'
import { ReworkDialog } from './rework-dialog'
import { PinnedProjectsPopover, type PinnedProject, type UserProject } from './pinned-projects'
import { useRealtimeInbox } from '@/hooks/use-realtime-inbox'
import { approveWorkItem, requestRework, toggleCommentRead, markAllCommentsRead } from '@/app/(dashboard)/inbox/actions'
import { INBOX_STATUS, toWorkItemWithRelations } from './types'
import type { InboxWorkItem, MentionedComment, AgentComment } from './types'

interface InboxPageProps {
  workItems: InboxWorkItem[]
  mentionedComments: MentionedComment[]
  readCommentIds: string[]
  agentComments: AgentComment[]
  pinnedProjects: PinnedProject[]
  allProjects: UserProject[]
}

function ProjectKeyBadge({ item }: { item: InboxWorkItem }) {
  return (
    <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">
      {item.project?.key}-{item.number}
    </span>
  )
}

function AgentCell({ item }: { item: InboxWorkItem }) {
  if (!item.agent_assignee) {
    return <span className="text-xs text-muted-foreground/60">미할당</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
      <ActorAvatar agent={{ ...item.agent_assignee, agent_kind: 'agent' }} size="sm" className="w-5 h-5 flex-shrink-0" />
      <span className="truncate">{item.agent_assignee.display_name}</span>
    </span>
  )
}

interface InboxRowProps {
  item: InboxWorkItem
  onOpen: (item: InboxWorkItem) => void
  actions?: React.ReactNode
}

function InboxRow({ item, onOpen, actions }: InboxRowProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onOpen(item)}
    >
      <ProjectKeyBadge item={item} />
      <span className="text-sm font-medium truncate flex-1 min-w-0">{item.title}</span>
      <div className="hidden sm:flex items-center w-[160px] shrink-0">
        <AgentCell item={item} />
      </div>
      <span className="hidden md:block text-[11px] text-muted-foreground w-[110px] text-right shrink-0">
        {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true, locale: ko })}
      </span>
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon: Icon, accent, title, count }: {
  icon: typeof CheckCircle2
  accent: string
  title: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className={cn('h-4 w-4', accent)} />
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </div>
  )
}

export function InboxPage({ workItems, mentionedComments, readCommentIds, agentComments, pinnedProjects, allProjects }: InboxPageProps) {
  useRealtimeInbox()

  const [, startTransition] = useTransition()
  const [detailItem, setDetailItem] = useState<InboxWorkItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [reworkItem, setReworkItem] = useState<InboxWorkItem | null>(null)
  const [reworkOpen, setReworkOpen] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  // 멘션 읽음 상태: optimistic
  const [optimisticReadIds, dispatchReadIds] = useOptimistic(
    new Set(readCommentIds),
    (state: Set<string>, action: { type: 'toggle'; id: string } | { type: 'mark_all'; ids: string[] }) => {
      if (action.type === 'toggle') {
        const next = new Set(state)
        if (next.has(action.id)) next.delete(action.id)
        else next.add(action.id)
        return next
      }
      return new Set([...state, ...action.ids])
    }
  )

  const { approvalItems, blockerItems, inProgressItems } = useMemo(() => {
    const approval: InboxWorkItem[] = []
    const blocker: InboxWorkItem[] = []
    const progress: InboxWorkItem[] = []
    for (const item of workItems) {
      const name = item.status?.name
      if (name === INBOX_STATUS.RESOLVED) approval.push(item)
      else if (name === INBOX_STATUS.ISSUE) blocker.push(item)
      else if (name === INBOX_STATUS.IN_PROGRESS) progress.push(item)
    }
    return { approvalItems: approval, blockerItems: blocker, inProgressItems: progress }
  }, [workItems])

  const unreadMentionCount = useMemo(
    () => mentionedComments.filter(c => !optimisticReadIds.has(c.id)).length,
    [mentionedComments, optimisticReadIds]
  )

  const openDetail = (item: InboxWorkItem) => {
    setDetailItem(item)
    setDetailOpen(true)
  }

  const withPending = async (id: string, fn: () => Promise<{ error?: string } | void>) => {
    setPendingIds(prev => new Set(prev).add(id))
    const result = await fn()
    setPendingIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (result && 'error' in result && result.error) {
      const { toast } = await import('sonner')
      toast.error(result.error)
    }
  }

  const handleApprove = (item: InboxWorkItem) =>
    withPending(item.id, () => approveWorkItem(item.id, item.project_id))

  const handleReworkSubmit = async (reason: string) => {
    if (!reworkItem) return
    await withPending(reworkItem.id, () => requestRework(reworkItem.id, reworkItem.project_id, reason))
  }

  const handleToggleRead = (commentId: string) => {
    const willRead = !optimisticReadIds.has(commentId)
    startTransition(async () => {
      dispatchReadIds({ type: 'toggle', id: commentId })
      await toggleCommentRead(commentId, willRead)
    })
  }

  const handleMarkAllRead = () => {
    const unreadIds = mentionedComments
      .filter(c => !optimisticReadIds.has(c.id))
      .map(c => c.id)
    if (unreadIds.length === 0) return
    startTransition(async () => {
      dispatchReadIds({ type: 'mark_all', ids: unreadIds })
      await markAllCommentsRead(unreadIds)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-5xl mx-auto w-full">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold">인박스</h1>
        <p className="text-sm text-muted-foreground hidden sm:block">에이전트 작업을 승인·개입·관찰하세요</p>
        <div className="ml-auto">
          <PinnedProjectsPopover
            pinnedProjects={pinnedProjects}
            allProjects={allProjects}
            workItems={workItems}
          />
        </div>
      </div>

      {/* 요약 카드 */}
      <InboxSummaryCards
        approvalCount={approvalItems.length}
        blockerCount={blockerItems.length}
        inProgressCount={inProgressItems.length}
        unreadMentionCount={unreadMentionCount}
      />

      {/* 섹션 A: 승인 대기 */}
      <section>
        <SectionHeader icon={CheckCircle2} accent="text-green-600 dark:text-green-400" title="승인 대기" count={approvalItems.length} />
        {approvalItems.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
            승인 대기 중인 작업이 없습니다.
          </div>
        ) : (
          <div className="border rounded-lg divide-y overflow-hidden">
            {approvalItems.map((item) => {
              const isPending = pendingIds.has(item.id)
              return (
                <InboxRow
                  key={item.id}
                  item={item}
                  onOpen={openDetail}
                  actions={
                    <>
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        disabled={isPending}
                        onClick={() => handleApprove(item)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        disabled={isPending}
                        onClick={() => {
                          setReworkItem(item)
                          setReworkOpen(true)
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        재작업
                      </Button>
                    </>
                  }
                />
              )
            })}
          </div>
        )}
      </section>

      {/* 섹션 B: 블로커 */}
      <section>
        <SectionHeader icon={AlertTriangle} accent="text-amber-600 dark:text-amber-400" title="블로커" count={blockerItems.length} />
        {blockerItems.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
            보고된 블로커가 없습니다.
          </div>
        ) : (
          <div className="border rounded-lg divide-y overflow-hidden">
            {blockerItems.map((item) => (
              <InboxRow key={item.id} item={item} onOpen={openDetail} />
            ))}
          </div>
        )}
      </section>

      {/* 섹션 C: 진행 중 (기본 접힘) */}
      <section>
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-2 w-full mb-2">
            <Loader className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold">진행 중</h2>
            <span className="text-xs text-muted-foreground tabular-nums">{inProgressItems.length}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {inProgressItems.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                진행 중인 작업이 없습니다.
              </div>
            ) : (
              <div className="border rounded-lg divide-y overflow-hidden">
                {inProgressItems.map((item) => (
                  <InboxRow key={item.id} item={item} onOpen={openDetail} />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>

      {/* 섹션 D: 멘션 */}
      <section>
        <SectionHeader icon={AtSign} accent="text-purple-600 dark:text-purple-400" title="나를 언급한 댓글" count={mentionedComments.length} />
        <InboxMentions
          mentionedComments={mentionedComments}
          readCommentIds={optimisticReadIds}
          onToggleRead={handleToggleRead}
          onMarkAllRead={handleMarkAllRead}
        />
      </section>

      {/* 섹션 E: 에이전트 활동 피드 */}
      <section>
        <SectionHeader icon={Bot} accent="text-violet-600 dark:text-violet-400" title="에이전트 활동" count={agentComments.length} />
        <AgentActivityFeed comments={agentComments} />
      </section>

      {/* 상세 다이얼로그 */}
      {detailItem && detailItem.project && (
        <WorkItemDetailDialog
          item={toWorkItemWithRelations(detailItem)}
          projectId={detailItem.project_id}
          projectKey={detailItem.project.key}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}

      {/* 재작업 요청 다이얼로그 */}
      <ReworkDialog
        item={reworkItem}
        open={reworkOpen}
        onOpenChange={setReworkOpen}
        onSubmit={handleReworkSubmit}
      />
    </div>
  )
}
