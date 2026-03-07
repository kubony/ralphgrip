'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { ChartWrapper } from '../charts/chart-wrapper'

interface BurndownData {
  date: string
  remaining: number | null
  ideal: number
}

interface BurndownChartProps {
  data: BurndownData[]
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number | null; dataKey: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const visiblePayload = payload.filter((p) => p.value != null)
  if (visiblePayload.length === 0) return null

  const LABELS: Record<string, string> = { remaining: '남은 작업', ideal: '계획' }

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium mb-1">{label ? formatDate(label) : ''}</p>
      {visiblePayload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span>{LABELS[p.dataKey] || p.dataKey}: {p.value}개</span>
        </div>
      ))}
    </div>
  )
}

export function BurndownChart({ data }: BurndownChartProps) {
  const todayStr = new Date().toISOString().split('T')[0]
  const hasFutureDates = data.some((d) => d.remaining === null)

  return (
    <ChartWrapper title="번다운 차트" isEmpty={data.length === 0} emptyMessage="데이터가 부족합니다.">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          {hasFutureDates && (
            <ReferenceLine x={todayStr} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5} />
          )}
          <Line
            type="stepAfter"
            dataKey="ideal"
            name="ideal"
            stroke="#94a3b8"
            strokeDasharray="5 5"
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="remaining"
            name="remaining"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={2}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
