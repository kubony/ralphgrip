'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartWrapper } from '../charts/chart-wrapper'

interface StatusData {
  name: string
  color: string | null
  count: number
}

interface StatusDistributionChartProps {
  data: StatusData[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: StatusData }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || '#94a3b8' }} />
        <span className="font-medium">{item.name}</span>
      </div>
      <p className="text-muted-foreground mt-1">{item.count}개</p>
    </div>
  )
}

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <ChartWrapper title="상태 분포" isEmpty={total === 0} emptyMessage="작업이 없습니다.">
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color || '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* 중앙 텍스트 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">전체</p>
          </div>
        </div>
      </div>
      {/* 범례 */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {data.filter(d => d.count > 0).map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color || '#94a3b8' }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-medium">{d.count}</span>
          </div>
        ))}
      </div>
    </ChartWrapper>
  )
}
