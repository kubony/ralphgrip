'use client'

import Clock from 'lucide-react/dist/esm/icons/clock'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import X from 'lucide-react/dist/esm/icons/x'
import { cn } from '@/lib/utils'
import type { MyWorkItem, StatFilter } from './types'

interface MyWorkStatsProps {
  items: MyWorkItem[]
  activeFilter: StatFilter
  onFilterChange: (filter: StatFilter) => void
}

export function MyWorkStats({ items, activeFilter, onFilterChange }: MyWorkStatsProps) {
  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const inProgress = items.filter(item => !item.status?.is_closed).length
  const completed = items.filter(item => item.status?.is_closed).length
  const dueSoon = items.filter(item => {
    if (item.status?.is_closed || !item.due_date) return false
    const due = new Date(item.due_date)
    return due <= threeDaysLater
  }).length
  const urgent = items.filter(item => !item.status?.is_closed && item.priority >= 3).length

  const stats: { key: StatFilter; label: string; value: number; icon: typeof Clock; activeClass: string; activeBg: string }[] = [
    { key: 'in_progress', label: '진행', value: inProgress, icon: Clock, activeClass: 'text-blue-600 dark:text-blue-400', activeBg: 'bg-blue-500/10 ring-1 ring-blue-500/30' },
    { key: 'completed', label: '완료', value: completed, icon: CheckCircle2, activeClass: 'text-green-600 dark:text-green-400', activeBg: 'bg-green-500/10 ring-1 ring-green-500/30' },
    { key: 'due_soon', label: '임박', value: dueSoon, icon: AlertTriangle, activeClass: 'text-yellow-600 dark:text-yellow-400', activeBg: 'bg-yellow-500/10 ring-1 ring-yellow-500/30' },
    { key: 'urgent', label: '긴급', value: urgent, icon: AlertCircle, activeClass: 'text-red-600 dark:text-red-400', activeBg: 'bg-red-500/10 ring-1 ring-red-500/30' },
  ]

  return (
    <div className="flex items-center gap-1">
      {stats.map((stat) => {
        const isActive = activeFilter === stat.key
        return (
          <button
            key={stat.key}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all',
              isActive
                ? cn(stat.activeBg, stat.activeClass, 'font-medium')
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={() => onFilterChange(isActive ? null : stat.key)}
          >
            {isActive ? (
              <X className="h-3 w-3" />
            ) : (
              <stat.icon className="h-3 w-3" />
            )}
            <span>{stat.label}</span>
            <span className={cn(
              'font-mono tabular-nums',
              isActive ? 'font-bold' : 'text-muted-foreground'
            )}>
              {stat.value}
            </span>
          </button>
        )
      })}
    </div>
  )
}
