'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChartWrapper } from '../charts/chart-wrapper'
import { cn } from '@/lib/utils'

interface WorkItemForChart {
  assignee_id: string | null
  due_date: string | null
  status?: { is_closed: boolean } | null
  tracker?: { name: string } | null
}

interface MemberForChart {
  id: string
  full_name: string | null
}

export interface TeamWorkloadChartProps {
  workItems: WorkItemForChart[]
  members: MemberForChart[]
  className?: string
}

interface ChartDataPoint {
  name: string
  inProgress: number
  overdue: number
  closed: number
}

const SEGMENT_COLORS = {
  inProgress: '#3b82f6',
  overdue: '#ef4444',
  closed: '#22c55e',
}

const SEGMENT_LABELS: Record<string, string> = {
  inProgress: '진행 중',
  overdue: '마감 초과',
  closed: '완료',
}

function CustomTooltip({
  active,
  payload,
  label,
  showCompleted,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
  showCompleted: boolean
}) {
  if (!active || !payload?.length) return null

  const visiblePayload = payload.filter((p) => {
    if (p.dataKey === 'closed' && !showCompleted) return false
    return p.value > 0
  })

  if (visiblePayload.length === 0) return null

  const total = visiblePayload.reduce((sum, p) => sum + p.value, 0)

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium mb-1">{label}</p>
      {visiblePayload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span>
            {SEGMENT_LABELS[p.dataKey] || p.dataKey}: {p.value}개
          </span>
        </div>
      ))}
      {visiblePayload.length > 1 && (
        <div className="mt-1 pt-1 border-t text-muted-foreground font-medium">합계: {total}개</div>
      )}
    </div>
  )
}

export function TeamWorkloadChart({ workItems, members, className }: TeamWorkloadChartProps) {
  const [showCompleted, setShowCompleted] = useState(false)
  const [excludeFolders, setExcludeFolders] = useState(true)
  const [showUnassigned, setShowUnassigned] = useState(true)

  const chartData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let items = workItems

    if (excludeFolders) {
      items = items.filter((wi) => wi.tracker?.name !== 'Folder')
    }

    const memberMap = new Map<string | null, { inProgress: number; overdue: number; closed: number }>()

    items.forEach((wi) => {
      const key = wi.assignee_id
      if (!showUnassigned && !key) return

      if (!memberMap.has(key)) {
        memberMap.set(key, { inProgress: 0, overdue: 0, closed: 0 })
      }
      const data = memberMap.get(key)!

      if (wi.status?.is_closed) {
        data.closed++
      } else if (wi.due_date && new Date(wi.due_date) < today) {
        data.overdue++
      } else {
        data.inProgress++
      }
    })

    const nameMap = new Map<string, string>()
    members.forEach((m) => nameMap.set(m.id, m.full_name || m.id.slice(0, 8)))

    const result: ChartDataPoint[] = []
    memberMap.forEach((data, key) => {
      result.push({
        name: key ? nameMap.get(key) || key.slice(0, 8) : '미할당',
        ...data,
      })
    })

    return result.toSorted((a, b) => {
      if (a.name === '미할당') return 1
      if (b.name === '미할당') return -1
      const totalA = a.inProgress + a.overdue + a.closed
      const totalB = b.inProgress + b.overdue + b.closed
      return totalB - totalA
    })
  }, [workItems, members, excludeFolders, showUnassigned])

  const isEmpty = chartData.length === 0

  const filters = (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        aria-pressed={showCompleted}
        onClick={() => setShowCompleted((v) => !v)}
        className={cn(
          'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
          showCompleted
            ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
            : 'border-border text-muted-foreground/50 line-through'
        )}
      >
        완료
      </button>
      <button
        type="button"
        aria-pressed={!excludeFolders}
        onClick={() => setExcludeFolders((v) => !v)}
        className={cn(
          'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
          !excludeFolders
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
            : 'border-border text-muted-foreground/50 line-through'
        )}
      >
        Folder
      </button>
      <button
        type="button"
        aria-pressed={showUnassigned}
        onClick={() => setShowUnassigned((v) => !v)}
        className={cn(
          'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
          showUnassigned
            ? 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400'
            : 'border-border text-muted-foreground/50 line-through'
        )}
      >
        미할당
      </button>
    </div>
  )

  return (
    <ChartWrapper
      title="팀원별 부하"
      headerAction={filters}
      isEmpty={isEmpty}
      emptyMessage="팀원 데이터가 없습니다."
      className={className}
    >
      <div className="h-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 8, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={64} tick={{ fontSize: 12 }} interval={0} />
            <Tooltip content={<CustomTooltip showCompleted={showCompleted} />} />
            <Legend
              formatter={(value: string) => <span className="text-xs">{SEGMENT_LABELS[value] || value}</span>}
            />
            <Bar dataKey="inProgress" stackId="a" fill={SEGMENT_COLORS.inProgress} radius={[0, 0, 0, 0]} />
            <Bar
              dataKey="overdue"
              stackId="a"
              fill={SEGMENT_COLORS.overdue}
              radius={showCompleted ? [0, 0, 0, 0] : [0, 4, 4, 0]}
            />
            {showCompleted && (
              <Bar dataKey="closed" stackId="a" fill={SEGMENT_COLORS.closed} radius={[0, 4, 4, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  )
}
