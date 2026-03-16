'use client'

import { useState, useMemo, useOptimistic, useTransition, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import List from 'lucide-react/dist/esm/icons/list'
import Columns3 from 'lucide-react/dist/esm/icons/columns-3'
import GanttChartSquare from 'lucide-react/dist/esm/icons/gantt-chart-square'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MyWorkStats } from './my-work-stats'
import { MyWorkFilters } from './my-work-filters'
import { MyWorkRoleFilter } from './my-work-role-filter'
import { MyWorkListView } from './my-work-list-view'
import { MyWorkKanbanView } from './my-work-kanban-view'
import { MyMentionsTab } from './my-mentions-tab'
import { PinnedProjectsPopover } from './pinned-projects'
import { MyWorkPropertySheet } from './my-work-property-sheet'
import { useRealtimeMyWorkItems } from '@/hooks/use-realtime-my-work-items'
import { toggleWorkItemPin, updateMyWorkItemStatus, updateMyWorkItemField, toggleCommentRead, markAllCommentsRead } from '@/app/(dashboard)/my-work/actions'
import type { MyWorkItem, MentionedComment, MyWorkTab, ViewMode, Filters, SortField, SortOrder, DueDateFilter, StatFilter, RoleFilter, StatusesByProject } from './types'
import type { PinnedProject, UserProject } from './pinned-projects'
import { getPhase } from './types'

const MyWorkTimelineView = dynamic(
  () => import('./my-work-timeline-view'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">타임라인 로딩 중...</div>
      </div>
    ),
  }
)

interface MyWorkPageProps {
  workItems: MyWorkItem[]
  mentionedComments: MentionedComment[]
  pinnedItemIds: string[]
  readCommentIds: string[]
  pinnedProjects: PinnedProject[]
  allProjects: UserProject[]
  statusesByProject: StatusesByProject
}

function isInThisWeek(dateStr: string): boolean {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(now.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  const date = new Date(dateStr)
  return date >= monday && date <= sunday
}

function applyDueDateFilter(item: MyWorkItem, filter: DueDateFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'unset') return !item.due_date
  if (filter === 'overdue') {
    if (!item.due_date || item.status?.is_closed) return false
    return new Date(item.due_date) < new Date()
  }
  if (filter === 'today') {
    if (!item.due_date) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const due = new Date(item.due_date)
    return due >= today && due < tomorrow
  }
  if (filter === 'this_week') {
    if (!item.due_date) return false
    return isInThisWeek(item.due_date)
  }
  return true
}

const validViews: ViewMode[] = ['list', 'kanban', 'timeline']
const validTabs: MyWorkTab[] = ['my-work', 'mentions']
const validRoles: RoleFilter[] = ['assigned', 'created', 'mentioned']

export function MyWorkPage({ workItems, mentionedComments, pinnedItemIds, readCommentIds, pinnedProjects, allProjects, statusesByProject }: MyWorkPageProps) {
  const liveWorkItems = useRealtimeMyWorkItems(workItems)
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL에서 초기 상태 복원
  const urlView = searchParams.get('view') as ViewMode | null
  const urlStat = searchParams.get('stat') as StatFilter | null
  const urlItem = searchParams.get('item')
  const urlTab = searchParams.get('tab') as MyWorkTab | null
  const urlRole = searchParams.get('role') as RoleFilter | null

  const [activeTab, setActiveTab] = useState<MyWorkTab>(
    urlTab && validTabs.includes(urlTab) ? urlTab : 'my-work'
  )
  const [viewMode, setViewMode] = useState<ViewMode>(
    urlView && validViews.includes(urlView) ? urlView : 'kanban'
  )
  const [filters, setFilters] = useState<Filters>({
    projects: [],
    phases: [],
    priorities: [],
    dueDate: 'all',
  })
  const [statFilter, setStatFilter] = useState<StatFilter>(
    urlStat && ['in_progress', 'completed', 'due_soon', 'urgent'].includes(urlStat) ? urlStat : null
  )
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(
    urlRole && validRoles.includes(urlRole) ? urlRole : 'assigned'
  )
  const [sortBy, setSortBy] = useState<SortField>('updated_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Sheet 상태
  const [selectedItem, setSelectedItem] = useState<MyWorkItem | null>(null)

  // URL ?item= 복원 (workItems가 비동기 업데이트될 수 있으므로 의존성 포함)
  useEffect(() => {
    if (urlItem && !selectedItem) {
      const found = liveWorkItems.find(w => w.id === urlItem)
      if (found) setSelectedItem(found)
    }
  }, [urlItem, liveWorkItems, selectedItem])

  // URL 동기화 헬퍼
  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const current = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(params)) {
      if (value === null) {
        current.delete(key)
      } else {
        current.set(key, value)
      }
    }
    const qs = current.toString()
    router.replace(qs ? `?${qs}` : '/my-work', { scroll: false })
  }, [searchParams, router])

  // 탭 변경
  const handleTabChange = useCallback((tab: string) => {
    const t = tab as MyWorkTab
    setActiveTab(t)
    updateUrl({ tab: t === 'my-work' ? null : t })
  }, [updateUrl])

  // 뷰 모드 변경
  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    updateUrl({ view: mode === 'kanban' ? null : mode })
  }, [updateUrl])

  // 스탯 필터 변경
  const handleStatFilterChange = useCallback((filter: StatFilter) => {
    setStatFilter(filter)
    updateUrl({ stat: filter })
  }, [updateUrl])

  // 역할 필터 변경
  const handleRoleFilterChange = useCallback((filter: RoleFilter) => {
    setRoleFilter(filter)
    updateUrl({ role: filter })
  }, [updateUrl])

  // 아이템 선택 (Sheet 열기)
  const handleItemSelect = useCallback((item: MyWorkItem) => {
    setSelectedItem(item)
    updateUrl({ item: item.id })
  }, [updateUrl])

  // Sheet 닫기
  const handleSheetClose = useCallback(() => {
    setSelectedItem(null)
    updateUrl({ item: null })
  }, [updateUrl])

  // 핀 상태: optimistic update
  const [, startTransition] = useTransition()
  const [optimisticPins, toggleOptimisticPin] = useOptimistic(
    new Set(pinnedItemIds),
    (state: Set<string>, itemId: string) => {
      const next = new Set(state)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    }
  )

  // 읽음 상태: optimistic update
  const [optimisticReadIds, dispatchReadIds] = useOptimistic(
    new Set(readCommentIds),
    (state: Set<string>, action: { type: 'toggle'; id: string } | { type: 'mark_all'; ids: string[] }) => {
      if (action.type === 'toggle') {
        const next = new Set(state)
        if (next.has(action.id)) {
          next.delete(action.id)
        } else {
          next.add(action.id)
        }
        return next
      }
      return new Set([...state, ...action.ids])
    }
  )

  const handleToggleRead = (commentId: string) => {
    const willRead = !optimisticReadIds.has(commentId)
    startTransition(async () => {
      dispatchReadIds({ type: 'toggle', id: commentId })
      await toggleCommentRead(commentId, willRead)
    })
  }

  const handleMarkAllRead = () => {
    const unreadIds = mentionedComments
      .filter(c => !optimisticReadIds.has(c.id))
      .map(c => c.id)
    if (unreadIds.length === 0) return
    startTransition(async () => {
      dispatchReadIds({ type: 'mark_all', ids: unreadIds })
      await markAllCommentsRead(unreadIds)
    })
  }

  const unreadMentionCount = useMemo(
    () => mentionedComments.filter(c => !optimisticReadIds.has(c.id)).length,
    [mentionedComments, optimisticReadIds]
  )

  const handleTogglePin = (itemId: string) => {
    const willPin = !optimisticPins.has(itemId)
    startTransition(async () => {
      toggleOptimisticPin(itemId)
      await toggleWorkItemPin(itemId, willPin)
    })
  }

  const handleStatusChange = async (itemId: string, statusId: string, projectId: string) => {
    const result = await updateMyWorkItemStatus(itemId, statusId, projectId)
    if (result?.error) {
      const { toast } = await import('sonner')
      toast.error(result.error)
    }
  }

  const handleFieldChange = async (itemId: string, projectId: string, updates: Record<string, unknown>) => {
    const result = await updateMyWorkItemField(itemId, projectId, updates)
    if (result?.error) {
      const { toast } = await import('sonner')
      toast.error(result.error)
    }
  }

  const handleSortChange = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'priority' || field === 'updated_at' ? 'desc' : 'asc')
    }
  }

  const filteredItems = useMemo(() => {
    const now = new Date()
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    let result = liveWorkItems

    // 역할 필터
    if (roleFilter) {
      result = result.filter(item => item.matchReasons.includes(roleFilter))
    }

    // 스탯 카드 필터
    if (statFilter === 'in_progress') {
      result = result.filter(item => !item.status?.is_closed)
    } else if (statFilter === 'completed') {
      result = result.filter(item => item.status?.is_closed)
    } else if (statFilter === 'due_soon') {
      result = result.filter(item => {
        if (item.status?.is_closed || !item.due_date) return false
        return new Date(item.due_date) <= threeDaysLater
      })
    } else if (statFilter === 'urgent') {
      result = result.filter(item => !item.status?.is_closed && item.priority >= 3)
    }

    if (filters.projects.length > 0) {
      result = result.filter(item => item.project && filters.projects.includes(item.project.id))
    }
    if (filters.phases.length > 0) {
      result = result.filter(item => filters.phases.includes(getPhase(item.status)))
    }
    if (filters.priorities.length > 0) {
      result = result.filter(item => filters.priorities.includes(item.priority))
    }
    if (filters.dueDate !== 'all') {
      result = result.filter(item => applyDueDateFilter(item, filters.dueDate))
    }

    return result
  }, [liveWorkItems, filters, statFilter, roleFilter])

  const sortedItems = useMemo(() => {
    const sorted = filteredItems.toSorted((a, b) => {
      // 핀 고정 항목 최상단
      const aPinned = optimisticPins.has(a.id) ? 1 : 0
      const bPinned = optimisticPins.has(b.id) ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned

      let cmp = 0
      if (sortBy === 'priority') {
        cmp = a.priority - b.priority
      } else if (sortBy === 'due_date') {
        const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity
        const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity
        cmp = aDate - bDate
      } else if (sortBy === 'updated_at') {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      } else if (sortBy === 'status') {
        const aPos = a.status?.position ?? Infinity
        const bPos = b.status?.position ?? Infinity
        cmp = aPos - bPos
      } else if (sortBy === 'project') {
        const aKey = a.project?.key ?? ''
        const bKey = b.project?.key ?? ''
        cmp = aKey.localeCompare(bKey)
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [filteredItems, sortBy, sortOrder, optimisticPins])

  // 언급된 work items (mentions 탭용)
  const mentionedWorkItems = useMemo(
    () => liveWorkItems.filter(item => item.matchReasons.includes('mentioned')),
    [liveWorkItems]
  )

  const isTimeline = viewMode === 'timeline'
  const isMyWorkTab = activeTab === 'my-work'

  return (
    <div className={isTimeline && isMyWorkTab ? 'flex flex-col h-full p-4 pb-0' : 'flex flex-col gap-3 p-4'}>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* 통합 도구모음: Tabs | Stats | RoleFilter | Filters | ViewTabs | Pin */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 탭 */}
          <TabsList variant="line">
            <TabsTrigger value="my-work">
              내 작업
            </TabsTrigger>
            <TabsTrigger value="mentions">
              언급됨
              {unreadMentionCount > 0 ? (
                <span className="text-xs text-primary font-medium ml-1 tabular-nums">
                  {unreadMentionCount}
                </span>
              ) : mentionedComments.length > 0 ? (
                <span className="text-xs text-muted-foreground ml-1 tabular-nums">
                  {mentionedComments.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* 내 작업 탭에서만: 스탯 + 역할필터 + 필터 + 뷰전환 */}
          {isMyWorkTab && (
            <>
              <div className="h-4 w-px bg-border" />

              {/* 스탯 칩 */}
              <MyWorkStats items={liveWorkItems} activeFilter={statFilter} onFilterChange={handleStatFilterChange} />

              <div className="h-4 w-px bg-border" />

              {/* 역할 필터 */}
              <MyWorkRoleFilter
                roleFilter={roleFilter}
                onRoleFilterChange={handleRoleFilterChange}
                items={liveWorkItems}
              />

              {!isTimeline && (
                <>
                  <div className="h-4 w-px bg-border" />

                  {/* 필터 */}
                  <MyWorkFilters
                    items={liveWorkItems}
                    filters={filters}
                    onFiltersChange={setFilters}
                    statFilter={statFilter}
                    onStatFilterClear={() => handleStatFilterChange(null)}
                  />
                </>
              )}

              {/* 우측: 뷰 탭 + 핀 */}
              <div className="flex items-center gap-0.5 ml-auto">
                <button
                  onClick={() => handleViewChange('list')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'list'
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-label="리스트 뷰"
                  title="리스트"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleViewChange('kanban')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'kanban'
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-label="칸반 뷰"
                  title="칸반"
                >
                  <Columns3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleViewChange('timeline')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'timeline'
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-label="타임라인 뷰"
                  title="타임라인"
                >
                  <GanttChartSquare className="h-4 w-4" />
                </button>

                {!isTimeline && (
                  <>
                    <div className="h-4 w-px bg-border mx-0.5" />
                    <PinnedProjectsPopover
                      pinnedProjects={pinnedProjects}
                      allProjects={allProjects}
                      workItems={liveWorkItems}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* 내 작업 탭 */}
        <TabsContent value="my-work" className={isTimeline ? 'flex-1 min-h-0' : ''}>
          {viewMode === 'timeline' ? (
            <div className="flex-1 min-h-0 -mx-4 border-t" style={{ height: 'calc(100vh - 130px)' }}>
              <MyWorkTimelineView
                items={filteredItems}
                statusesByProject={statusesByProject}
                onStatusChange={handleStatusChange}
              />
            </div>
          ) : viewMode === 'list' ? (
            <MyWorkListView
              items={sortedItems}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              pinnedIds={optimisticPins}
              onTogglePin={handleTogglePin}
              statusesByProject={statusesByProject}
              onStatusChange={handleStatusChange}
              onItemSelect={handleItemSelect}
              onFieldChange={handleFieldChange}
            />
          ) : (
            <MyWorkKanbanView
              items={sortedItems}
              pinnedIds={optimisticPins}
              onTogglePin={handleTogglePin}
              statusesByProject={statusesByProject}
              onStatusChange={handleStatusChange}
              onItemSelect={handleItemSelect}
            />
          )}
        </TabsContent>

        {/* 언급됨 탭 */}
        <TabsContent value="mentions">
          <MyMentionsTab
            mentionedComments={mentionedComments}
            mentionedWorkItems={mentionedWorkItems}
            readCommentIds={optimisticReadIds}
            onToggleRead={handleToggleRead}
            onMarkAllRead={handleMarkAllRead}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Peek Sheet */}
      <MyWorkPropertySheet
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) handleSheetClose()
        }}
        statusesByProject={statusesByProject}
        onFieldChange={handleFieldChange}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
