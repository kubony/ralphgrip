'use client'

import { cn } from '@/lib/utils'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Loader from 'lucide-react/dist/esm/icons/loader'
import AtSign from 'lucide-react/dist/esm/icons/at-sign'

interface InboxSummaryCardsProps {
  approvalCount: number
  blockerCount: number
  inProgressCount: number
  unreadMentionCount: number
}

export function InboxSummaryCards({ approvalCount, blockerCount, inProgressCount, unreadMentionCount }: InboxSummaryCardsProps) {
  const cards = [
    {
      key: 'approval',
      label: '승인 대기',
      value: approvalCount,
      icon: CheckCircle2,
      accent: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      key: 'blocker',
      label: '블로커',
      value: blockerCount,
      icon: AlertTriangle,
      accent: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      key: 'in_progress',
      label: '진행 중',
      value: inProgressCount,
      icon: Loader,
      accent: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      key: 'mentions',
      label: '안 읽은 멘션',
      value: unreadMentionCount,
      icon: AtSign,
      accent: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.key} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', card.bg)}>
            <card.icon className={cn('h-5 w-5', card.accent)} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums leading-none">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
