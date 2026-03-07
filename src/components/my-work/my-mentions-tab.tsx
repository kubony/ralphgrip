'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { scrollMaskBoth } from '@/lib/motion'
import { CommentText } from '@/components/projects/comment-text'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Circle from 'lucide-react/dist/esm/icons/circle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Check from 'lucide-react/dist/esm/icons/check'
import type { MentionedComment, MyWorkItem } from './types'
import { priorityColors } from './types'

interface MyMentionsTabProps {
  mentionedComments: MentionedComment[]
  mentionedWorkItems: MyWorkItem[]
  readCommentIds: Set<string>
  onToggleRead: (commentId: string) => void
  onMarkAllRead: () => void
}

type MentionView = 'comments' | 'items'

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function AuthorAvatar({ author }: { author: MentionedComment['author'] }) {
  if (author?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatar_url}
        alt={author.full_name ?? ''}
        className="w-5 h-5 rounded-full flex-shrink-0"
      />
    )
  }
  const initial = author?.full_name?.[0] ?? '?'
  return (
    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium flex-shrink-0">
      {initial}
    </div>
  )
}

function MentionedCommentCard({ comment, isRead, onToggleRead }: { comment: MentionedComment; isRead: boolean; onToggleRead: (id: string) => void }) {
  const router = useRouter()

  return (
    <div
      className={cn(
        'rounded-lg border p-3 shadow-sm hover:shadow-md transition-all cursor-pointer relative',
        isRead
          ? 'bg-muted/30 opacity-60'
          : 'bg-background border-primary/20'
      )}
      onClick={() => {
        const key = comment.work_item.project.key
        router.push(`/projects/${key}/alm?item=${comment.work_item.id}`)
      }}
    >
      {/* 안 읽음 표시: 왼쪽 위 파란 점 */}
      {!isRead && (
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-primary" />
      )}

      {/* 읽음 토글 버튼 */}
      <button
        className={cn(
          'absolute top-2 right-2 p-0.5 rounded transition-colors',
          isRead
            ? 'text-primary hover:text-primary/80'
            : 'text-muted-foreground/30 hover:text-muted-foreground/60'
        )}
        title={isRead ? '안 읽음으로 표시' : '읽음으로 표시'}
        onClick={(e) => {
          e.stopPropagation()
          onToggleRead(comment.id)
        }}
      >
        {isRead ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Circle className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Work item context */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
          {comment.work_item.project.key}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {comment.work_item.project.key}-{comment.work_item.number}
        </span>
      </div>

      {/* Title */}
      <p className="text-xs text-muted-foreground truncate mb-1.5">
        {comment.work_item.title}
      </p>

      {/* Comment body */}
      <div className="flex gap-2">
        <AuthorAvatar author={comment.author} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-medium">{comment.author?.full_name ?? '알 수 없음'}</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2">
            <CommentText text={comment.content} />
          </div>
        </div>
      </div>
    </div>
  )
}

function MentionedWorkItemCard({ item }: { item: MyWorkItem }) {
  const router = useRouter()
  const isClosed = item.status?.is_closed ?? false

  return (
    <div
      className="rounded-lg border bg-background p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => {
        if (item.project?.key) {
          router.push(`/projects/${item.project.key}/alm?item=${item.id}`)
        }
      }}
    >
      {/* Top row: project badge + priority */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
          {item.project?.key}
        </span>
        <span className="text-xs font-mono text-muted-foreground">
          {item.project?.key}-{item.number}
        </span>
        <div className="flex-1" />
        <div className={cn('w-2 h-2 rounded-full', priorityColors[item.priority] || 'bg-gray-400')} />
      </div>

      {/* Title */}
      <p className="text-sm font-medium line-clamp-2 mb-2">{item.title}</p>

      {/* Bottom row: status + link */}
      <div className="flex items-center gap-2">
        {isClosed ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
        ) : (
          <Circle
            className="h-3.5 w-3.5 flex-shrink-0"
            style={{ color: item.status?.color || '#94a3b8', fill: item.status?.color || '#94a3b8' }}
          />
        )}
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: item.status?.color ? `${item.status.color}20` : '#94a3b820',
            color: item.status?.color || '#94a3b8',
          }}
        >
          {item.status?.name}
        </span>
        <div className="flex-1" />
        <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
      </div>
    </div>
  )
}

export function MyMentionsTab({ mentionedComments, mentionedWorkItems, readCommentIds, onToggleRead, onMarkAllRead }: MyMentionsTabProps) {
  const [view, setView] = useState<MentionView>('comments')
  const unreadCount = mentionedComments.filter(c => !readCommentIds.has(c.id)).length

  return (
    <div className="space-y-3">
      {/* Sub-navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setView('comments')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
            view === 'comments' ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50'
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          댓글
          {unreadCount > 0 ? (
            <span className="text-xs text-primary font-medium ml-0.5 tabular-nums">{unreadCount}</span>
          ) : (
            <span className="text-xs text-muted-foreground ml-0.5 tabular-nums">{mentionedComments.length}</span>
          )}
        </button>
        <button
          onClick={() => setView('items')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
            view === 'items' ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50'
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          작업 항목
          <span className="text-xs text-muted-foreground ml-0.5 tabular-nums">{mentionedWorkItems.length}</span>
        </button>

        {/* 모두 읽음 버튼 */}
        {view === 'comments' && unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            모두 읽음
          </button>
        )}
      </div>

      {/* Content */}
      {view === 'comments' ? (
        <div
          className="overflow-hidden"
          style={{ WebkitMaskImage: scrollMaskBoth, maskImage: scrollMaskBoth }}
        >
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            {mentionedComments.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">
                언급된 댓글이 없습니다.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mentionedComments.map((comment) => (
                  <MentionedCommentCard
                    key={comment.id}
                    comment={comment}
                    isRead={readCommentIds.has(comment.id)}
                    onToggleRead={onToggleRead}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="overflow-hidden"
          style={{ WebkitMaskImage: scrollMaskBoth, maskImage: scrollMaskBoth }}
        >
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            {mentionedWorkItems.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">
                description에 언급된 작업 항목이 없습니다.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mentionedWorkItems.map((item) => (
                  <MentionedWorkItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
