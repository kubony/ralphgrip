'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { CommentText } from '@/components/projects/comment-text'
import { ActorAvatar } from '@/components/ui/actor-avatar'
import Bot from 'lucide-react/dist/esm/icons/bot'
import type { AgentComment } from './types'

interface AgentActivityFeedProps {
  comments: AgentComment[]
}

export function AgentActivityFeed({ comments }: AgentActivityFeedProps) {
  const router = useRouter()

  if (comments.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground border rounded-lg">
        아직 에이전트 활동이 없습니다.
      </div>
    )
  }

  return (
    <div className="border rounded-lg divide-y overflow-hidden">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="flex gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
          onClick={() => {
            const key = comment.work_item.project.key
            router.push(`/projects/${key}/alm?item=${comment.work_item.id}`)
          }}
        >
          <ActorAvatar agent={comment.agent} size="sm" className="w-7 h-7 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium inline-flex items-center gap-1">
                <Bot className="h-3 w-3 text-violet-500" />
                {comment.agent?.display_name ?? '에이전트'}
              </span>
              <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                {comment.work_item.project.key}-{comment.work_item.number}
              </span>
              <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                {comment.work_item.title}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ko })}
              </span>
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
              <CommentText text={comment.content} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
