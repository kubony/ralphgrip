'use client'

import { cn } from '@/lib/utils'
import type { PipelineProject } from './types'
import FolderKanban from 'lucide-react/dist/esm/icons/folder-kanban'
import Activity from 'lucide-react/dist/esm/icons/activity'
import Target from 'lucide-react/dist/esm/icons/target'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'

interface PipelineStatsProps {
  projects: PipelineProject[]
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function PipelineStats({ projects, isCollapsed, onToggleCollapse }: PipelineStatsProps) {
  const totalCount = projects.length
  let salesCount = 0, activeCount = 0, completedCount = 0
  for (const p of projects) {
    if (p.phase === 'prospect' || p.phase === 'sales' || p.phase === 'contracted') salesCount++
    else if (p.phase === 'active') activeCount++
    else if (p.phase === 'delivered' || p.phase === 'settled') completedCount++
  }

  const stats = [
    { label: '전체', value: totalCount, icon: FolderKanban, color: '' },
    { label: '영업/계약', value: salesCount, icon: Target, color: 'text-blue-600' },
    { label: '수행중', value: activeCount, icon: Activity, color: 'text-amber-600' },
    { label: '완료', value: completedCount, icon: CheckCircle2, color: 'text-green-600' },
  ]

  return (
    <div className="flex-shrink-0">
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 mb-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 transition-transform', !isCollapsed && 'rotate-90')}
        />
        <span>통계</span>
      </button>
      {!isCollapsed && (
        <div className="grid grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5"
            >
              <stat.icon className={cn('h-4 w-4 text-muted-foreground shrink-0', stat.color)} />
              <div className="flex items-baseline gap-1.5">
                <span className={cn('text-xl font-bold leading-none', stat.color)}>
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
