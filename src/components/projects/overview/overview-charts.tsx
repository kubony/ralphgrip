'use client'

import dynamic from 'next/dynamic'

// recharts는 SSR 비호환 → dynamic import로 클라이언트 전용 로드
const StatusDistributionChart = dynamic(
  () => import('./status-distribution-chart').then(m => ({ default: m.StatusDistributionChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const TeamWorkloadChart = dynamic(
  () => import('./team-workload-chart').then(m => ({ default: m.TeamWorkloadChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const BurndownChart = dynamic(
  () => import('./burndown-chart').then(m => ({ default: m.BurndownChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const ActivityTrendChart = dynamic(
  () => import('./activity-trend-chart').then(m => ({ default: m.ActivityTrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

function ChartSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="h-4 w-24 bg-muted rounded mb-4 animate-pulse" />
      <div className="h-[200px] bg-muted/50 rounded animate-pulse" />
    </div>
  )
}

interface StatusData {
  name: string
  color: string | null
  count: number
}

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

interface BurndownData {
  date: string
  remaining: number | null
  ideal: number
}

interface ActivityData {
  date: string
  created: number
  completed: number
}

interface OverviewChartsProps {
  statusData: StatusData[]
  workItems: WorkItemForChart[]
  members: MemberForChart[]
  burndownData: BurndownData[]
  activityData: ActivityData[]
}

export function OverviewCharts({ statusData, workItems, members, burndownData, activityData }: OverviewChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <StatusDistributionChart data={statusData} />
      <TeamWorkloadChart workItems={workItems} members={members} className="md:row-span-2 md:h-full" />
      <BurndownChart data={burndownData} />
      <ActivityTrendChart data={activityData} />
    </div>
  )
}
