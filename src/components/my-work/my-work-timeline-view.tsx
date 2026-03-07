'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import { updateMyWorkItemDates } from '@/app/(dashboard)/my-work/actions'
import {
  useTimelineState,
  ROW_HEIGHT,
  LEFT_PANEL_WIDTH,
} from '@/hooks/use-timeline-state'
import type { ZoomLevel } from '@/hooks/use-timeline-state'
import type { WorkItemWithRelations } from '@/types/database'
import type { MyWorkItem, TimelineGroupMode } from './types'

import TimelineHeader from '@/components/projects/timeline-header'
import TimelineGrid from '@/components/projects/timeline-grid'
import TimelineRowLabel from '@/components/projects/timeline-row'
import TimelineBar from '@/components/projects/timeline-bar'
import TimelineUnscheduled from '@/components/projects/timeline-unscheduled'
import { WorkItemDetailDialog } from '@/components/projects/work-item-detail-dialog'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in'
import ZoomOut from 'lucide-react/dist/esm/icons/zoom-out'
import CalendarSearch from 'lucide-react/dist/esm/icons/calendar-search'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2'
import Layers from 'lucide-react/dist/esm/icons/layers'
import List from 'lucide-react/dist/esm/icons/list'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import type { StatusesByProject } from './types'

interface MyWorkTimelineViewProps {
  items: MyWorkItem[]
  statusesByProject: StatusesByProject
  onStatusChange: (itemId: string, statusId: string, projectId: string) => Promise<void>
}

interface FlatItem {
  item: MyWorkItem
  isGroupHeader: boolean
  groupLabel?: string
  groupCount?: number
}

// Unscheduled → timeline drag state
interface UnscheduledDragState {
  item: MyWorkItem
  ghostX: number
  ghostY: number
  targetDate: Date | null
}

const ZOOM_ORDER: ZoomLevel[] = ['day', 'week', 'month', 'quarter']
const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  half: 'Half',
  year: 'Year',
}

const HEADER_HEIGHT = 46

function TimelineStatusBadge({ item, statusesByProject, onStatusChange }: {
  item: MyWorkItem
  statusesByProject: StatusesByProject
  onStatusChange: (itemId: string, statusId: string, projectId: string) => Promise<void>
}) {
  const [isChanging, setIsChanging] = useState(false)
  const statuses = statusesByProject[item.project_id] ?? []

  if (statuses.length === 0) {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
        style={{
          backgroundColor: item.status?.color ? `${item.status.color}20` : '#94a3b820',
          color: item.status?.color || '#94a3b8',
        }}
      >
        {item.status?.name}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded hover:ring-1 hover:ring-foreground/20 transition-all shrink-0',
            isChanging && 'opacity-50'
          )}
          style={{
            backgroundColor: item.status?.color ? `${item.status.color}20` : '#94a3b820',
            color: item.status?.color || '#94a3b8',
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={isChanging}
        >
          {item.status?.name}
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {statuses.map((status) => (
          <DropdownMenuItem
            key={status.id}
            className={cn(
              'flex items-center gap-2 text-xs cursor-pointer',
              status.id === item.status_id && 'bg-muted'
            )}
            onClick={async () => {
              if (status.id === item.status_id) return
              setIsChanging(true)
              await onStatusChange(item.id, status.id, item.project_id)
              setIsChanging(false)
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: status.color || '#94a3b8' }}
            />
            {status.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function MyWorkTimelineView({ items, statusesByProject, onStatusChange }: MyWorkTimelineViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Group mode
  const [groupMode, setGroupMode] = useState<TimelineGroupMode>('project')

  // Optimistic items — updated immediately on drag, synced from props on change
  const [optimisticItems, setOptimisticItems] = useState<MyWorkItem[]>(items)
  useEffect(() => {
    setOptimisticItems(items)
  }, [items])

  // Unscheduled drag state
  const [unscheduledDrag, setUnscheduledDrag] = useState<UnscheduledDragState | null>(null)
  const unscheduledDragRef = useRef<UnscheduledDragState | null>(null)
  unscheduledDragRef.current = unscheduledDrag

  // Refs for window event handlers
  const effectiveLeftWidthRef = useRef(0)
  const xToDateRef = useRef<((x: number) => Date) | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Selection state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  // Detail dialog state
  const [detailItem, setDetailItem] = useState<MyWorkItem | null>(null)

  // Left panel
  const [leftPanelVisible] = useState(true)
  const [leftWidth, setLeftWidth] = useState(LEFT_PANEL_WIDTH)
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)

  // Unscheduled section
  const UNSCHEDULED_DEFAULT_HEIGHT = 200
  const UNSCHEDULED_HEADER_HEIGHT = 36
  const [unscheduledHeight, setUnscheduledHeight] = useState(UNSCHEDULED_DEFAULT_HEIGHT)
  const [isUnscheduledCollapsed, setIsUnscheduledCollapsed] = useState(false)
  const [isDraggingBottom, setIsDraggingBottom] = useState(false)

  const effectiveLeftWidth = leftPanelVisible ? leftWidth : 0
  effectiveLeftWidthRef.current = effectiveLeftWidth

  // Separate scheduled vs unscheduled
  const { scheduledItems, unscheduledItems } = useMemo(() => {
    const scheduled: MyWorkItem[] = []
    const unscheduled: MyWorkItem[] = []
    for (const item of optimisticItems) {
      if (item.start_date || item.due_date) {
        scheduled.push(item)
      } else {
        unscheduled.push(item)
      }
    }
    return { scheduledItems: scheduled, unscheduledItems: unscheduled }
  }, [optimisticItems])

  // Build flat items list (with optional group headers)
  const flatItems = useMemo<FlatItem[]>(() => {
    const sorted = scheduledItems.toSorted((a, b) => {
      const aDate = a.start_date || a.due_date || ''
      const bDate = b.start_date || b.due_date || ''
      return aDate.localeCompare(bDate)
    })

    if (groupMode === 'flat') {
      return sorted.map(item => ({ item, isGroupHeader: false }))
    }

    // Group by project
    const projectGroups = new Map<string, MyWorkItem[]>()
    const projectOrder: string[] = []

    for (const item of sorted) {
      const key = item.project?.id ?? 'unknown'
      if (!projectGroups.has(key)) {
        projectGroups.set(key, [])
        projectOrder.push(key)
      }
      projectGroups.get(key)!.push(item)
    }

    const result: FlatItem[] = []
    for (const projectId of projectOrder) {
      const groupItems = projectGroups.get(projectId)!
      const first = groupItems[0]
      const label = first.project?.name ?? '알 수 없는 프로젝트'

      // Group header (uses first item as placeholder — not rendered as a bar)
      result.push({
        item: first,
        isGroupHeader: true,
        groupLabel: label,
        groupCount: groupItems.length,
      })

      for (const item of groupItems) {
        result.push({ item, isGroupHeader: false })
      }
    }

    return result
  }, [scheduledItems, groupMode])

  // Timeline state
  const timelineState = useTimelineState(scheduledItems)
  const {
    zoomLevel,
    setZoomLevel,
    pxPerDay,
    dateToX,
    xToDate,
    dateRange,
    totalWidth,
    headerMonths,
    headerCells,
    todayX,
  } = timelineState

  useEffect(() => {
    xToDateRef.current = xToDate
  }, [xToDate])

  // Virtualizer
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const totalRowsHeight = rowVirtualizer.getTotalSize()

  // Body cursor during panel drag
  useEffect(() => {
    if (isDraggingLeft || isDraggingBottom) {
      document.body.style.cursor = isDraggingLeft ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
      return () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDraggingLeft, isDraggingBottom])

  // Body cursor for unscheduled drag
  const hasUnscheduledDrag = !!unscheduledDrag
  useEffect(() => {
    if (hasUnscheduledDrag) {
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      return () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [hasUnscheduledDrag])

  // Left panel resize
  const handleLeftResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setIsDraggingLeft(true)
      const startX = e.clientX
      const startWidth = leftWidth
      const onMove = (moveE: PointerEvent) => {
        const delta = moveE.clientX - startX
        setLeftWidth(Math.min(500, Math.max(150, startWidth + delta)))
      }
      const onUp = (upE: PointerEvent) => {
        el.releasePointerCapture(upE.pointerId)
        setIsDraggingLeft(false)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [leftWidth]
  )

  // Bottom resize (unscheduled section)
  const handleBottomResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setIsDraggingBottom(true)
      const startY = e.clientY
      const startHeight = unscheduledHeight
      const onMove = (moveE: PointerEvent) => {
        const delta = startY - moveE.clientY
        setUnscheduledHeight(Math.min(500, Math.max(80, startHeight + delta)))
      }
      const onUp = (upE: PointerEvent) => {
        el.releasePointerCapture(upE.pointerId)
        setIsDraggingBottom(false)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [unscheduledHeight]
  )

  // Select item
  const handleSelectItem = useCallback((id: string) => {
    setSelectedItemId(id)
  }, [])

  // Double-click → open detail dialog
  const handleDoubleClick = useCallback((id: string) => {
    const item = optimisticItems.find((i) => i.id === id)
    if (item) setDetailItem(item)
  }, [optimisticItems])

  // Optimistic bar drag end — persist to server
  const handleBarDragEnd = useCallback(
    async (itemId: string, newStart: string | null, newEnd: string | null) => {
      const item = optimisticItems.find(i => i.id === itemId)
      if (!item) return

      setOptimisticItems(prev =>
        prev.map(i => (i.id === itemId ? { ...i, start_date: newStart, due_date: newEnd } : i))
      )

      const result = await updateMyWorkItemDates(itemId, item.project_id, {
        start_date: newStart,
        due_date: newEnd,
      })
      if (result.error) {
        toast.error(result.error)
        setOptimisticItems(itemsRef.current)
      }
    },
    [optimisticItems]
  )

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const idx = ZOOM_ORDER.indexOf(zoomLevel)
    if (idx > 0) setZoomLevel(ZOOM_ORDER[idx - 1])
  }, [zoomLevel, setZoomLevel])

  const handleZoomOut = useCallback(() => {
    const idx = ZOOM_ORDER.indexOf(zoomLevel)
    if (idx < ZOOM_ORDER.length - 1) setZoomLevel(ZOOM_ORDER[idx + 1])
  }, [zoomLevel, setZoomLevel])

  const handleScrollToToday = useCallback(() => {
    if (!scrollContainerRef.current) return
    const containerWidth = scrollContainerRef.current.clientWidth
    scrollContainerRef.current.scrollLeft = todayX - containerWidth / 2 + effectiveLeftWidth
  }, [todayX, effectiveLeftWidth])

  // 첫 진입 시 오늘 날짜 위치로 자동 스크롤
  const initialScrollDone = useRef(false)
  useEffect(() => {
    if (initialScrollDone.current || !scrollContainerRef.current || scheduledItems.length === 0) return
    initialScrollDone.current = true
    // 다음 프레임에서 실행 (레이아웃 완료 후)
    requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return
      const containerWidth = scrollContainerRef.current.clientWidth
      scrollContainerRef.current.scrollLeft = todayX - containerWidth / 2 + effectiveLeftWidth
    })
  }, [todayX, effectiveLeftWidth, scheduledItems.length])

  const handleFitAll = useCallback(() => {
    if (!scrollContainerRef.current || flatItems.length === 0) return
    const container = scrollContainerRef.current
    const containerWidth = container.clientWidth - effectiveLeftWidth

    let minX = Infinity
    let maxX = -Infinity
    for (const { item, isGroupHeader } of flatItems) {
      if (isGroupHeader) continue
      if (item.start_date) {
        const x = dateToX(new Date(item.start_date))
        if (x < minX) minX = x
      }
      if (item.due_date) {
        const x = dateToX(new Date(item.due_date)) + pxPerDay
        if (x > maxX) maxX = x
      }
    }

    if (minX === Infinity || maxX === -Infinity) return
    const barsWidth = maxX - minX
    const padding = 40
    if (barsWidth + padding * 2 <= containerWidth) {
      container.scrollLeft = minX - (containerWidth - barsWidth) / 2
    } else {
      container.scrollLeft = minX - padding
    }
  }, [flatItems, dateToX, pxPerDay, effectiveLeftWidth])

  // Unscheduled drag handlers
  const handleUnscheduledDragStart = useCallback(
    (item: WorkItemWithRelations, e: React.PointerEvent) => {
      const myItem = item as unknown as MyWorkItem
      setUnscheduledDrag({ item: myItem, ghostX: e.clientX, ghostY: e.clientY, targetDate: null })
    },
    []
  )

  const isDraggingUnscheduled = unscheduledDrag !== null

  useEffect(() => {
    if (!isDraggingUnscheduled) return

    const getGridInfo = (clientX: number, clientY: number) => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) return { isOverGrid: false, targetDate: null }

      const rect = scrollContainer.getBoundingClientRect()
      const elw = effectiveLeftWidthRef.current

      const isOverGrid =
        clientX >= rect.left + elw &&
        clientX <= rect.right &&
        clientY >= rect.top + HEADER_HEIGHT &&
        clientY <= rect.bottom

      if (!isOverGrid) return { isOverGrid: false, targetDate: null }

      const contentX = clientX - rect.left + scrollContainer.scrollLeft
      const gridX = Math.max(0, contentX - elw)
      const targetDate = xToDateRef.current ? xToDateRef.current(gridX) : null

      return { isOverGrid, targetDate }
    }

    const handleMove = (e: PointerEvent) => {
      const { targetDate } = getGridInfo(e.clientX, e.clientY)
      setUnscheduledDrag(prev =>
        prev ? { ...prev, ghostX: e.clientX, ghostY: e.clientY, targetDate } : null
      )
    }

    const handleUp = async (e: PointerEvent) => {
      const drag = unscheduledDragRef.current
      setUnscheduledDrag(null)
      if (!drag) return

      const { isOverGrid, targetDate } = getGridInfo(e.clientX, e.clientY)
      if (!isOverGrid || !targetDate) return

      const startDateStr = format(targetDate, 'yyyy-MM-dd')
      const dueDateStr = format(addDays(targetDate, 7), 'yyyy-MM-dd')

      setOptimisticItems(prev =>
        prev.map(i =>
          i.id === drag.item.id
            ? { ...i, start_date: startDateStr, due_date: dueDateStr }
            : i
        )
      )

      const result = await updateMyWorkItemDates(drag.item.id, drag.item.project_id, {
        start_date: startDateStr,
        due_date: dueDateStr,
      })
      if (result.error) {
        toast.error(result.error)
        setOptimisticItems(itemsRef.current)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isDraggingUnscheduled])

  // Helper to get project key for an item
  const getItemProjectKey = useCallback(
    (item: WorkItemWithRelations) => {
      const myItem = item as unknown as MyWorkItem
      return myItem.project?.key ?? '?'
    },
    []
  )

  // Empty states
  if (optimisticItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">담당 작업이 없습니다.</p>
        </div>
      </div>
    )
  }

  if (scheduledItems.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">일정이 설정된 작업이 없습니다.</p>
            <p className="text-xs mt-1">
              각 항목의 시작일/마감일을 설정하거나, 아래 항목을 타임라인으로 드래그하세요.
            </p>
          </div>
        </div>
        {unscheduledItems.length > 0 && (
          <TimelineUnscheduled
            items={unscheduledItems as unknown as WorkItemWithRelations[]}
            showTrackerId
            projectKey=""
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItemId}
            isCollapsed={isUnscheduledCollapsed}
            onToggleCollapse={() => setIsUnscheduledCollapsed(v => !v)}
            onDragStart={handleUnscheduledDragStart}
            getItemProjectKey={getItemProjectKey}
          />
        )}
        {unscheduledDrag && <UnscheduledGhost drag={unscheduledDrag} />}
      </div>
    )
  }

  // Compute row index → actual flat index (skipping group headers for bar rendering)
  const cssGridContent = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${effectiveLeftWidth}px ${totalWidth}px`,
        gridTemplateRows: `${HEADER_HEIGHT}px ${Math.max(totalRowsHeight, 200)}px`,
        width: effectiveLeftWidth + totalWidth,
      }}
    >
      {/* Q1: Corner */}
      {leftPanelVisible && (
        <div
          className="bg-background border-b border-r z-30"
          style={{ position: 'sticky', top: 0, left: 0 }}
        >
          <div className="h-full flex items-end px-3 pb-1">
            <span className="text-[10px] text-muted-foreground">
              {scheduledItems.length}개 항목
            </span>
          </div>
        </div>
      )}
      {!leftPanelVisible && (
        <div
          className="bg-background border-b z-30"
          style={{ position: 'sticky', top: 0, left: 0, width: 0 }}
        />
      )}

      {/* Q2: Time axis header */}
      <div
        className="bg-background border-b z-20"
        style={{ position: 'sticky', top: 0 }}
      >
        <TimelineHeader
          headerMonths={headerMonths}
          headerCells={headerCells}
          zoomLevel={zoomLevel}
          totalWidth={totalWidth}
        />
      </div>

      {/* Q3: Item labels */}
      {leftPanelVisible && (
        <div
          className="bg-background border-r z-10"
          style={{ position: 'sticky', left: 0 }}
        >
          <div
            style={{
              height: totalRowsHeight,
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const flatItem = flatItems[virtualRow.index]

              // Group header row
              if (flatItem.isGroupHeader) {
                return (
                  <div
                    key={`group-${flatItem.item.project_id}`}
                    className="flex items-center gap-2 px-3 bg-muted/30 border-b border-border"
                    style={{
                      position: 'absolute',
                      top: virtualRow.start,
                      left: 0,
                      width: '100%',
                      height: ROW_HEIGHT,
                    }}
                  >
                    <span className="text-xs font-semibold text-foreground truncate">
                      {flatItem.groupLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5">
                      {flatItem.groupCount}
                    </span>
                  </div>
                )
              }

              // Normal item row
              const { item } = flatItem
              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    top: virtualRow.start,
                    left: 0,
                    width: '100%',
                    height: ROW_HEIGHT,
                  }}
                >
                  <TimelineRowLabel
                    item={item as unknown as WorkItemWithRelations}
                    level={0}
                    isExpanded={false}
                    hasChildren={false}
                    isSelected={selectedItemId === item.id}
                    onToggleExpand={() => {}}
                    onClick={handleSelectItem}
                    showTrackerId
                    projectKey={item.project?.key ?? '?'}
                    itemProjectKey={item.project?.key}
                  />
                  <div
                    className="absolute inset-y-0 right-1 flex items-center"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <TimelineStatusBadge
                      item={item}
                      statusesByProject={statusesByProject}
                      onStatusChange={onStatusChange}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {!leftPanelVisible && <div style={{ width: 0 }} />}

      {/* Q4: Gantt bars */}
      <div style={{ position: 'relative', height: totalRowsHeight }}>
        <TimelineGrid
          totalWidth={totalWidth}
          totalHeight={totalRowsHeight}
          pxPerDay={pxPerDay}
          zoomLevel={zoomLevel}
          todayX={todayX}
          dateRange={dateRange}
          dateToX={dateToX}
        />

        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const flatItem = flatItems[virtualRow.index]

          // Group header — render empty row (no bar)
          if (flatItem.isGroupHeader) {
            return (
              <div
                key={`group-bar-${flatItem.item.project_id}`}
                className="border-b border-border/30 bg-muted/10"
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  left: 0,
                  width: totalWidth,
                  height: ROW_HEIGHT,
                }}
              />
            )
          }

          const { item } = flatItem
          return (
            <TimelineBar
              key={item.id}
              item={item as unknown as WorkItemWithRelations}
              dateToX={dateToX}
              xToDate={xToDate}
              pxPerDay={pxPerDay}
              rowIndex={virtualRow.index}
              isSelected={selectedItemId === item.id}
              onClick={handleSelectItem}
              onDoubleClick={handleDoubleClick}
              onDragEnd={handleBarDragEnd}
              dateMode="target"
            />
          )
        })}
      </div>
    </div>
  )

  const leftResizeHandle = leftPanelVisible ? (
    <div
      className={cn(
        'absolute top-0 bottom-0 w-px z-[25] cursor-col-resize touch-none',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-4 after:-translate-x-1/2',
        isDraggingLeft ? 'bg-primary/30' : 'bg-transparent hover:bg-primary/20'
      )}
      style={{ left: effectiveLeftWidth }}
      onPointerDown={handleLeftResizePointerDown}
      onDoubleClick={() => setLeftWidth(LEFT_PANEL_WIDTH)}
    />
  ) : null

  return (
    <div className="h-full flex flex-col" role="grid" aria-label="내 작업 타임라인">
      {/* Zoom + group controls */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-0.5 bg-muted/80 rounded-md p-0.5 border shadow-sm">
          {ZOOM_ORDER.map(level => (
            <button
              key={level}
              onClick={() => setZoomLevel(level)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                zoomLevel === level
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {ZOOM_LABELS[level]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom In (+)"
            disabled={zoomLevel === 'day'}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom Out (-)"
            disabled={zoomLevel === 'month'}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>

        <div className="w-px h-4 bg-border" />

        <button
          onClick={handleScrollToToday}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="오늘로 이동"
        >
          <CalendarSearch className="h-3.5 w-3.5" />
          오늘
        </button>

        <button
          onClick={handleFitAll}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="전체 맞춤"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">맞춤</span>
        </button>

        <div className="w-px h-4 bg-border" />

        {/* Group mode toggle */}
        <div className="flex items-center gap-0.5 bg-muted/80 rounded-md p-0.5 border shadow-sm">
          <button
            onClick={() => setGroupMode('project')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
              groupMode === 'project'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="프로젝트별 그룹"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">프로젝트별</span>
          </button>
          <button
            onClick={() => setGroupMode('flat')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
              groupMode === 'flat'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="플랫 목록"
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">전체</span>
          </button>
        </div>

        <div className="flex-1" />

        {unscheduledItems.length > 0 && (
          <span className="text-xs text-muted-foreground">
            미배정 {unscheduledItems.length}개
          </span>
        )}
      </div>

      {/* Main timeline scroll area */}
      <div className="flex-1 min-h-0 relative">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-auto"
          tabIndex={0}
        >
          {cssGridContent}
        </div>
        {leftResizeHandle}
      </div>

      {/* Unscheduled section */}
      {unscheduledItems.length > 0 && (
        <>
          {!isUnscheduledCollapsed && (
            <div
              className={cn(
                'h-px w-full cursor-row-resize touch-none flex-shrink-0',
                'after:absolute after:inset-x-0 after:top-1/2 after:h-3 after:-translate-y-1/2',
                'relative',
                isDraggingBottom ? 'bg-primary/30' : 'bg-border hover:bg-primary/20'
              )}
              onPointerDown={handleBottomResizePointerDown}
              onDoubleClick={() => setUnscheduledHeight(UNSCHEDULED_DEFAULT_HEIGHT)}
            />
          )}

          <div
            className="flex-shrink-0 overflow-y-auto"
            style={{
              height: isUnscheduledCollapsed
                ? UNSCHEDULED_HEADER_HEIGHT
                : unscheduledHeight,
            }}
          >
            <TimelineUnscheduled
              items={unscheduledItems as unknown as WorkItemWithRelations[]}
              showTrackerId
              projectKey=""
              onSelectItem={handleSelectItem}
              selectedItemId={selectedItemId}
              isCollapsed={isUnscheduledCollapsed}
              onToggleCollapse={() => setIsUnscheduledCollapsed(v => !v)}
              onDragStart={handleUnscheduledDragStart}
              getItemProjectKey={getItemProjectKey}
            />
          </div>
        </>
      )}

      {/* Unscheduled drag ghost */}
      {unscheduledDrag && <UnscheduledGhost drag={unscheduledDrag} />}

      {/* Detail dialog */}
      {detailItem && (
        <WorkItemDetailDialog
          item={detailItem as unknown as WorkItemWithRelations}
          projectId={detailItem.project_id}
          projectKey={detailItem.project?.key ?? ''}
          open={!!detailItem}
          onOpenChange={(open) => {
            if (!open) setDetailItem(null)
          }}
        />
      )}
    </div>
  )
}

// Ghost UI for unscheduled → timeline drag
function UnscheduledGhost({ drag }: { drag: UnscheduledDragState }) {
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: drag.ghostX + 14, top: drag.ghostY - 24 }}
    >
      <div
        className={cn(
          'rounded px-2.5 py-1 text-xs shadow-lg border flex items-center gap-1.5 max-w-56',
          drag.targetDate
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-popover text-muted-foreground border-border opacity-75'
        )}
      >
        <span className="truncate">{drag.item.title}</span>
        {drag.targetDate && (
          <span className="shrink-0 opacity-80 text-[10px]">
            {format(drag.targetDate, 'M/d')}~{format(addDays(drag.targetDate, 7), 'M/d')}
          </span>
        )}
      </div>
    </div>
  )
}
