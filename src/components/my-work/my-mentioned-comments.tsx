'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CommentText } from '@/components/projects/comment-text'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import AtSign from 'lucide-react/dist/esm/icons/at-sign'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import type { MentionedComment } from './types'

interface MyMentionedCommentsProps {
  comments: MentionedComment[]
}

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
        className="w-6 h-6 rounded-full flex-shrink-0"
      />
    )
  }
  const initial = author?.full_name?.[0] ?? '?'
  return (
    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium flex-shrink-0">
      {initial}
    </div>
  )
}

export function MyMentionedComments({ comments }: MyMentionedCommentsProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(true)

  if (comments.length === 0) return null

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <AtSign className="h-4 w-4 text-purple-500 flex-shrink-0" />
        <span className="text-sm font-medium">내가 언급된 댓글</span>
        <span className="text-xs text-muted-foreground">{comments.length}</span>
        <div className="flex-1" />
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
      </button>

      {/* Comment list */}
      {isExpanded && (
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
              onClick={() => {
                const key = comment.work_item.project.key
                router.push(`/projects/${key}/alm?item=${comment.work_item.id}`)
              }}
            >
              {/* Work item context */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                  {comment.work_item.project.key}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {comment.work_item.project.key}-{comment.work_item.number} {comment.work_item.title}
                </span>
              </div>

              {/* Comment body */}
              <div className="flex gap-2 ml-[18px]">
                <AuthorAvatar author={comment.author} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium">{comment.author?.full_name ?? '알 수 없음'}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    <CommentText text={comment.content} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
