'use client'

import dynamic from 'next/dynamic'
import { type Selection } from './alm-layout'
import type { TreeWorkItem, StatusRef, TrackerRef, LinkCount } from '@/types/database'

// 로딩 스켈레톤 - 반드시 h-full w-full로 부모 공간을 채워야 함
function TreePanelSkeleton() {
  return (
    <div className="h-full w-full border-r bg-muted/20 flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Tracker Items
        </span>
      </div>
      <div className="flex-1 p-4">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Dynamic import - fallback이 h-full w-full을 가져야 패널 크기 유지됨
const ALMTreePanelContent = dynamic(
  () => import('./alm-tree-panel-content'),
  {
    ssr: false,
    loading: () => <TreePanelSkeleton />
  }
)

interface ALMTreePanelProps {
  projectId: string
  projectKey: string
  workItems: TreeWorkItem[]
  trackers: TrackerRef[]
  statuses: StatusRef[]
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  showTrackerId?: boolean
  linkCounts?: LinkCount[]
}

export function ALMTreePanel(props: ALMTreePanelProps) {
  return <ALMTreePanelContent {...props} />
}
