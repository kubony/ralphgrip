'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { format, addDays, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import { updateWorkItem } from '@/app/(dashboard)/projects/[key]/actions'
import {
  useTimelineState,
  ROW_HEIGHT,
  LEFT_PANEL_WIDTH,
} from '@/hooks/use-timeline-state'
import type { ZoomLevel } from '@/hooks/use-timeline-state'
import { WorkItemDetailDialog } from './work-item-detail-dialog'
import TimelineHeader from './timeline-header'
import TimelineGrid from './timeline-grid'
import TimelineRowLabel from './timeline-row'
import TimelineBar from './timeline-bar'
import TimelineUnscheduled from './timeline-unscheduled'
import type {
  WorkItemWithRelations,
  StatusRef,
  TrackerRef,
  PersonRef,
} from '@/types/database'
import type { Selection } from '@/hooks/use-alm-selection'
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in'
import ZoomOut from 'lucide-react/dist/esm/icons/zoom-out'
import CalendarSearch from 'lucide-react/dist/esm/icons/calendar-search'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2'
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2'
import PanelLeftClose from 'lucide-react/dist/esm/icons/panel-left-close'
import PanelLeftOpen from 'lucide-react/dist/esm/icons/panel-left-open'
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days'
import CalendarCheck from 'lucide-react/dist/esm/icons/calendar-check'
import Folder from 'lucide-react/dist/esm/icons/folder'
import Search from 'lucide-react/dist/esm/icons/search'
import X from 'lucide-react/dist/esm/icons/x'
import ChevronsUpDown from 'lucide-react/dist/esm/icons/chevrons-up-down'
import ChevronsDownUp from 'lucide-react/dist/esm/icons/chevrons-down-up'

interface TimelineViewProps {
  projectId: string
  projectKey: string
  workItems: WorkItemWithRelations[]
  statuses: StatusRef[]
  trackers: TrackerRef[]
  members: PersonRef[]
  selection: Selection
  onSelectionChange: (sel: Selection) => void
  showTrackerId?: boolean
  currentUserId?: string
  onOptimisticUpdate?: (id: string, updates: { start_date?: string | null; due_date?: string | null; actual_start_date?: string | null; actual_end_date?: string | null }) => void
}

interface FlatItem {
  item: WorkItemWithRelations
  level: number
  hasChildren: boolean
}

// State for cross-component unscheduled drag
interface UnscheduledDragState {
  item: WorkItemWithRelations
  ghostX: number
  ghostY: number
  targetDate: Date | null // non-null when pointer is over the timeline grid
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

const HEADER_HEIGHT_BASE = 46 // px — month row + cell row
const SEARCH_BAR_HEIGHT = 36 // px — search input row

// ─── Folder auto-range helpers ───────────────────────────────────────────────

/** 폴더의 자동 범위 계산: 직계 자식 순회, Folder 자식은 자체 날짜만, 비폴더 자식은 재귀 */
function computeFolderRange(
  folderId: string,
  childrenMap: Map<string | null, WorkItemWithRelations[]>,
  dateMode: 'target' | 'actual',
  overrides?: Map<string, { start: string | null; end: string | null }>
): { minStart: string | null; maxEnd: string | null } {
  let minStart: string | null = null
  let maxEnd: string | null = null

  const directChildren = childrenMap.get(folderId) || []

  for (const child of directChildren) {
    if (child.deleted_at) continue

    let childStart: string | null
    let childEnd: string | null

    if (overrides?.has(child.id)) {
      const ov = overrides.get(child.id)!
      childStart = ov.start
      childEnd = ov.end
    } else if (dateMode === 'target') {
      childStart = child.start_date
      childEnd = child.due_date
    } else {
      childStart = child.actual_start_date ?? null
      childEnd = child.actual_end_date ?? null
    }

    if (childStart && (!minStart || childStart < minStart)) minStart = childStart
    if (childEnd && (!maxEnd || childEnd > maxEnd)) maxEnd = childEnd

    // 비폴더 자식: 하위 자식까지 재귀 탐색
    const isFolder = child.tracker?.name === 'Folder'
    if (!isFolder) {
      const desc = computeFolderRange(child.id, childrenMap, dateMode, overrides)
      if (desc.minStart && (!minStart || desc.minStart < minStart)) minStart = desc.minStart
      if (desc.maxEnd && (!maxEnd || desc.maxEnd > maxEnd)) maxEnd = desc.maxEnd
    }
  }

  return { minStart, maxEnd }
}

/** parent_id 체인을 따라 Folder인 조상만 수집 (직계→최상위 순서) */
function getAncestorFolders(
  itemId: string,
  itemById: Map<string, WorkItemWithRelations>
): string[] {
  const result: string[] = []
  const current = itemById.get(itemId)
  if (!current) return result

  let parentId = current.parent_id
  while (parentId) {
    const parent = itemById.get(parentId)
    if (!parent) break
    if (parent.tracker?.name === 'Folder') {
      result.push(parent.id)
    }
    parentId = parent.parent_id
  }

  return result
}

export default function TimelineView({
  projectId,
  projectKey,
  workItems,
  selection,
  onSelectionChange,
  showTrackerId = true,
  onOptimisticUpdate,
}: TimelineViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Optimistic items — updated immediately on drag, synced from server on revalidate
  const [optimisticItems, setOptimisticItems] = useState<WorkItemWithRelations[]>(workItems)
  const pendingUpdatesRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    setOptimisticItems((prev) => {
      if (pendingUpdatesRef.current.size === 0) return workItems
      // Preserve optimistic values for items with in-flight server actions
      return workItems.map((item) => {
        if (pendingUpdatesRef.current.has(item.id)) {
          const optimistic = prev.find((i) => i.id === item.id)
          return optimistic || item
        }
        return item
      })
    })
  }, [workItems])

  // Unscheduled → timeline cross-component drag state
  const [unscheduledDrag, setUnscheduledDrag] = useState<UnscheduledDragState | null>(null)
  const unscheduledDragRef = useRef<UnscheduledDragState | null>(null)
  unscheduledDragRef.current = unscheduledDrag

  // Stable refs for values used in window event handlers
  const effectiveLeftWidthRef = useRef(0)
  const xToDateRef = useRef<((x: number) => Date) | null>(null)
  const workItemsRef = useRef(workItems)
  workItemsRef.current = workItems

  // Detail dialog state
  const [detailItem, setDetailItem] = useState<WorkItemWithRelations | null>(null)

  // Responsive — hide left panel on small screens
  const [leftPanelVisible, setLeftPanelVisible] = useState(true)

  // Focused row index for keyboard navigation
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1)

  // Focus mode — hide header/tabs/filters for maximum timeline space
  const [isFocusMode, setIsFocusMode] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('timeline-focus-mode', isFocusMode)
    return () => document.documentElement.classList.remove('timeline-focus-mode')
  }, [isFocusMode])

  useEffect(() => {
    if (!isFocusMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFocusMode(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFocusMode])

  // Date mode toggle — target (planned) vs actual dates
  const [dateMode, setDateMode] = useState<'target' | 'actual'>('target')

  // Folder filter — true = show folders, false = hide folders (default: show)
  const [showFolders, setShowFolders] = useState(true)

  // Search query for left panel
  const [searchQuery, setSearchQuery] = useState('')

  // Expand/collapse state for tree hierarchy — all items expanded by default
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>()
    for (const item of workItems) {
      ids.add(item.id)
    }
    return ids
  })

  // Build children map from optimistic items
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, WorkItemWithRelations[]>()
    for (const item of optimisticItems) {
      if (item.deleted_at) continue
      const parentId = item.parent_id
      const existing = map.get(parentId) || []
      existing.push(item)
      map.set(parentId, existing)
    }
    for (const [key, children] of map.entries()) {
      map.set(key, children.toSorted((a, b) => a.position - b.position))
    }
    return map
  }, [optimisticItems])

  // Item lookup by ID
  const itemById = useMemo(() => {
    const map = new Map<string, WorkItemWithRelations>()
    for (const item of optimisticItems) {
      if (!item.deleted_at) map.set(item.id, item)
    }
    return map
  }, [optimisticItems])

  // Pre-compute children date range for all folders (used for folder drag clamping)
  const childrenDateRangeMap = useMemo(() => {
    const map = new Map<string, { minStart: string | null; maxEnd: string | null }>()
    for (const item of optimisticItems) {
      if (item.deleted_at || item.tracker?.name !== 'Folder') continue
      map.set(item.id, computeFolderRange(item.id, childrenMap, dateMode))
    }
    return map
  }, [optimisticItems, childrenMap, dateMode])

  // Separate scheduled vs unscheduled using optimistic items — based on dateMode
  const { scheduledItems, unscheduledItems } = useMemo(() => {
    const scheduled: WorkItemWithRelations[] = []
    const unscheduled: WorkItemWithRelations[] = []
    for (const item of optimisticItems) {
      if (item.deleted_at) continue
      const hasDate = dateMode === 'target'
        ? (item.start_date || item.due_date)
        : (item.actual_start_date || item.actual_end_date)
      if (hasDate) {
        scheduled.push(item)
      } else {
        unscheduled.push(item)
      }
    }
    return { scheduledItems: scheduled, unscheduledItems: unscheduled }
  }, [optimisticItems, dateMode])

  // Search filter — find matching items + ancestors
  const searchFilteredIds = useMemo(() => {
    if (!searchQuery.trim()) return null
    const query = searchQuery.toLowerCase()
    const itemMap = new Map(optimisticItems.filter(i => !i.deleted_at).map(i => [i.id, i]))

    const matchingItems = optimisticItems.filter(
      (item) =>
        !item.deleted_at &&
        (item.title.toLowerCase().includes(query) ||
          `${projectKey}-${item.number}`.toLowerCase().includes(query) ||
          String(item.number).includes(searchQuery))
    )

    const result = new Set<string>()
    for (const item of matchingItems) {
      result.add(item.id)
      let current = item
      while (current.parent_id) {
        if (result.has(current.parent_id)) break
        result.add(current.parent_id)
        const parent = itemMap.get(current.parent_id)
        if (!parent) break
        current = parent
      }
    }
    return result
  }, [searchQuery, optimisticItems, projectKey])

  // Auto-expand parents when searching
  useEffect(() => {
    if (searchFilteredIds && searchFilteredIds.size > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        for (const id of searchFilteredIds) {
          const children = childrenMap.get(id)
          if (children && children.length > 0) {
            next.add(id)
          }
        }
        return next
      })
    }
  }, [searchFilteredIds, childrenMap])

  // Folders without dates that have scheduled descendants — show as structural rows
  const structuralFolderIds = useMemo(() => {
    if (!showFolders) return new Set<string>()
    const result = new Set<string>()
    const scheduledIds = new Set(scheduledItems.map((i) => i.id))
    for (const item of scheduledItems) {
      let parentId = item.parent_id
      while (parentId) {
        if (result.has(parentId)) break
        const parent = itemById.get(parentId)
        if (!parent) break
        if (parent.tracker?.name === 'Folder' && !scheduledIds.has(parent.id)) {
          result.add(parent.id)
        }
        parentId = parent.parent_id
      }
    }
    return result
  }, [showFolders, scheduledItems, itemById])

  // Flatten the tree using DFS with expand/collapse
  const flatItems = useMemo<FlatItem[]>(() => {
    const result: FlatItem[] = []
    const scheduledIds = new Set(scheduledItems.map((i) => i.id))

    function dfs(parentId: string | null, level: number) {
      const children = childrenMap.get(parentId) || []
      for (const child of children) {
        const hasDate = scheduledIds.has(child.id)
        const childrenOfChild = childrenMap.get(child.id) || []
        const hasChildren = childrenOfChild.length > 0
        const isFolder = child.tracker?.name === 'Folder'
        const isStructuralFolder = structuralFolderIds.has(child.id)

        // 검색 필터: 매칭되지 않는 항목 건너뛰기
        if (searchFilteredIds && !searchFilteredIds.has(child.id)) continue

        // 폴더 숨김 모드에서 폴더 항목은 추가하지 않음
        const shouldShow = showFolders || !isFolder
        // 날짜 있는 항목 또는 구조용 폴더(날짜 없지만 하위에 일정 있음)를 표시
        const shouldInclude = (hasDate || isStructuralFolder) && shouldShow
        if (shouldInclude) {
          result.push({ item: child, level, hasChildren })
        }

        // 폴더 숨김 모드: 폴더의 자식들은 항상 탐색 (펼침 상태 무시)
        const alwaysExpand = !showFolders && isFolder
        if (!hasChildren || expandedIds.has(child.id) || alwaysExpand) {
          const nextLevel = shouldInclude ? level + 1 : level
          dfs(child.id, nextLevel)
        }
      }
    }

    dfs(null, 0)

    // Orphan 처리: DFS에서 방문하지 못한 일정 항목 추가
    // (접힌 조상 아래 숨겨진 항목은 제외)
    const addedIds = new Set(result.map((r) => r.item.id))
    for (const item of scheduledItems) {
      if (addedIds.has(item.id)) continue
      if (searchFilteredIds && !searchFilteredIds.has(item.id)) continue

      // 접힌 조상이 있으면 숨김 (orphan으로 추가하지 않음)
      let hiddenByCollapse = false
      let pid = item.parent_id
      while (pid) {
        const parent = itemById.get(pid)
        if (!parent) break // 부모가 삭제됨 — true orphan
        const parentChildren = childrenMap.get(pid)
        if (parentChildren && parentChildren.length > 0 && !expandedIds.has(pid)) {
          hiddenByCollapse = true
          break
        }
        pid = parent.parent_id
      }
      if (hiddenByCollapse) continue

      const isFolder = item.tracker?.name === 'Folder'
      if (showFolders || !isFolder) {
        const hasChildren = (childrenMap.get(item.id) || []).length > 0
        result.push({ item, level: 0, hasChildren })
      }
    }

    return result
  }, [scheduledItems, childrenMap, expandedIds, showFolders, searchFilteredIds, structuralFolderIds, itemById])

  // 미배정 섹션에서 구조용 폴더 제외 (타임라인 본문에 이미 표시됨)
  const displayUnscheduledItems = useMemo(
    () => unscheduledItems.filter((item) => !structuralFolderIds.has(item.id)),
    [unscheduledItems, structuralFolderIds]
  )

  // Timeline state (zoom, date range, px conversions)
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

  // Keep xToDate ref updated for use in window event handlers
  useEffect(() => {
    xToDateRef.current = xToDate
  }, [xToDate])

  // Virtualizer for rows
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const totalRowsHeight = rowVirtualizer.getTotalSize()

  // Left panel resizable width
  const [leftWidth, setLeftWidth] = useState(LEFT_PANEL_WIDTH)
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)

  // Unscheduled section: custom vertical resize
  const UNSCHEDULED_DEFAULT_HEIGHT = 200
  const UNSCHEDULED_HEADER_HEIGHT = 36
  const [unscheduledHeight, setUnscheduledHeight] = useState(UNSCHEDULED_DEFAULT_HEIGHT)
  const [isUnscheduledCollapsed, setIsUnscheduledCollapsed] = useState(false)
  const [isDraggingBottom, setIsDraggingBottom] = useState(false)

  const effectiveLeftWidth = leftPanelVisible ? leftWidth : 0
  // Keep ref updated every render
  effectiveLeftWidthRef.current = effectiveLeftWidth

  // Body cursor + user-select during panel drag
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

  // Handlers
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    const ids = new Set<string>()
    for (const item of optimisticItems) {
      if (!item.deleted_at) ids.add(item.id)
    }
    setExpandedIds(ids)
  }, [optimisticItems])

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  const handleSelectItem = useCallback(
    (id: string) => {
      onSelectionChange({
        type: 'workitem',
        id,
        ids: new Set([id]),
        lastSelectedId: id,
      })
      const idx = flatItems.findIndex((f) => f.item.id === id)
      if (idx >= 0) setFocusedRowIndex(idx)
    },
    [onSelectionChange, flatItems]
  )

  const handleDoubleClick = useCallback(
    (id: string) => {
      const item = optimisticItems.find((w) => w.id === id)
      if (item) setDetailItem(item)
    },
    [optimisticItems]
  )

  // Ref to track folder bar DOM elements modified during drag (for cleanup)
  const modifiedFolderBarsRef = useRef<Set<string>>(new Set())

  // Drag move callback — updates ancestor folder bars in real-time via DOM
  const handleBarDragMove = useCallback(
    (childId: string, tentativeStart: string | null, tentativeEnd: string | null) => {
      const overrides = new Map([[childId, { start: tentativeStart, end: tentativeEnd }]])
      const ancestors = getAncestorFolders(childId, itemById)

      for (const folderId of ancestors) {
        const range = computeFolderRange(folderId, childrenMap, dateMode, overrides)
        const folder = itemById.get(folderId)!
        const curStart = dateMode === 'target' ? folder.start_date : (folder.actual_start_date ?? null)
        const curEnd = dateMode === 'target' ? folder.due_date : (folder.actual_end_date ?? null)

        const newStart = range.minStart ?? curStart
        const newEnd = range.maxEnd ?? curEnd

        // Update folder bar DOM directly for real-time visual feedback
        const el = document.querySelector(`[data-bar-id="${folderId}"]`) as HTMLDivElement | null
        if (el && newStart && newEnd) {
          const newLeft = dateToX(parseISO(newStart))
          const newRight = dateToX(parseISO(newEnd))
          el.style.left = `${newLeft}px`
          el.style.width = `${Math.max(newRight - newLeft + pxPerDay, pxPerDay)}px`
          modifiedFolderBarsRef.current.add(folderId)
        }

        // Cascade: accumulate this folder's new range for its parent
        overrides.set(folderId, { start: newStart, end: newEnd })
      }
    },
    [childrenMap, dateMode, itemById, dateToX, pxPerDay]
  )

  // Optimistic bar drag — update UI immediately, then persist to server
  const handleBarDragEnd = useCallback(
    async (itemId: string, newStart: string | null, newEnd: string | null, mode: 'target' | 'actual') => {
      modifiedFolderBarsRef.current.clear()
      pendingUpdatesRef.current.add(itemId)

      // Compute ancestor folder updates
      const ancestors = getAncestorFolders(itemId, itemById)
      const folderUpdates: { id: string; start: string | null; end: string | null }[] = []

      if (ancestors.length > 0) {
        const overrides = new Map([[itemId, { start: newStart, end: newEnd }]])

        for (const folderId of ancestors) {
          const range = computeFolderRange(folderId, childrenMap, mode, overrides)
          const folder = itemById.get(folderId)!
          const curStart = mode === 'target' ? folder.start_date : (folder.actual_start_date ?? null)
          const curEnd = mode === 'target' ? folder.due_date : (folder.actual_end_date ?? null)

          const folderNewStart = range.minStart ?? curStart
          const folderNewEnd = range.maxEnd ?? curEnd

          if (folderNewStart !== curStart || folderNewEnd !== curEnd) {
            folderUpdates.push({ id: folderId, start: folderNewStart, end: folderNewEnd })
            pendingUpdatesRef.current.add(folderId)
          }

          overrides.set(folderId, { start: folderNewStart, end: folderNewEnd })
        }
      }

      // Optimistic update: child + all ancestor folders in one setState call
      const ancestorSet = new Set(ancestors)
      if (mode === 'target') {
        setOptimisticItems((prev) =>
          prev.map((i) => {
            if (i.id === itemId) return { ...i, start_date: newStart, due_date: newEnd }
            const fu = folderUpdates.find((f) => f.id === i.id)
            if (fu) return { ...i, start_date: fu.start, due_date: fu.end }
            // Force re-render for ancestor folders to reset DOM styles
            if (ancestorSet.has(i.id)) return { ...i }
            return i
          })
        )
        onOptimisticUpdate?.(itemId, { start_date: newStart, due_date: newEnd })

        // Server action: child item
        const result = await updateWorkItem(itemId, { start_date: newStart, due_date: newEnd }, projectId)
        pendingUpdatesRef.current.delete(itemId)
        if (result.error) {
          toast.error(result.error)
          setOptimisticItems(workItemsRef.current)
          for (const fu of folderUpdates) pendingUpdatesRef.current.delete(fu.id)
          return
        }

        // Server actions: ancestor folders in parallel
        if (folderUpdates.length > 0) {
          const results = await Promise.all(
            folderUpdates.map((fu) =>
              updateWorkItem(fu.id, { start_date: fu.start, due_date: fu.end }, projectId)
            )
          )
          for (const fu of folderUpdates) pendingUpdatesRef.current.delete(fu.id)
          const failed = results.find((r) => r.error)
          if (failed) {
            toast.error(failed.error!)
            setOptimisticItems(workItemsRef.current)
          }
        }
      } else {
        setOptimisticItems((prev) =>
          prev.map((i) => {
            if (i.id === itemId) return { ...i, actual_start_date: newStart, actual_end_date: newEnd }
            const fu = folderUpdates.find((f) => f.id === i.id)
            if (fu) return { ...i, actual_start_date: fu.start, actual_end_date: fu.end }
            if (ancestorSet.has(i.id)) return { ...i }
            return i
          })
        )
        onOptimisticUpdate?.(itemId, { actual_start_date: newStart, actual_end_date: newEnd })

        const result = await updateWorkItem(itemId, { actual_start_date: newStart, actual_end_date: newEnd }, projectId)
        pendingUpdatesRef.current.delete(itemId)
        if (result.error) {
          toast.error(result.error)
          setOptimisticItems(workItemsRef.current)
          for (const fu of folderUpdates) pendingUpdatesRef.current.delete(fu.id)
          return
        }

        if (folderUpdates.length > 0) {
          const results = await Promise.all(
            folderUpdates.map((fu) =>
              updateWorkItem(fu.id, { actual_start_date: fu.start, actual_end_date: fu.end }, projectId)
            )
          )
          for (const fu of folderUpdates) pendingUpdatesRef.current.delete(fu.id)
          const failed = results.find((r) => r.error)
          if (failed) {
            toast.error(failed.error!)
            setOptimisticItems(workItemsRef.current)
          }
        }
      }
    },
    [projectId, onOptimisticUpdate, childrenMap, itemById]
  )

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
    requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return
      const containerWidth = scrollContainerRef.current.clientWidth
      scrollContainerRef.current.scrollLeft = todayX - containerWidth / 2 + effectiveLeftWidth
    })
  }, [todayX, effectiveLeftWidth, scheduledItems.length])



  // Keyboard navigation
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setFocusedRowIndex((prev) => {
            const next = Math.min(prev + 1, flatItems.length - 1)
            if (next >= 0 && flatItems[next]) {
              handleSelectItem(flatItems[next].item.id)
              rowVirtualizer.scrollToIndex(next, { align: 'auto' })
            }
            return next
          })
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setFocusedRowIndex((prev) => {
            const next = Math.max(prev - 1, 0)
            if (flatItems[next]) {
              handleSelectItem(flatItems[next].item.id)
              rowVirtualizer.scrollToIndex(next, { align: 'auto' })
            }
            return next
          })
          break
        }
        case 'Enter': {
          if (focusedRowIndex >= 0 && flatItems[focusedRowIndex]) {
            e.preventDefault()
            handleSelectItem(flatItems[focusedRowIndex].item.id)
          }
          break
        }
        case '+':
        case '=': {
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            handleZoomIn()
          }
          break
        }
        case '-': {
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            handleZoomOut()
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [flatItems, focusedRowIndex, handleSelectItem, handleZoomIn, handleZoomOut, rowVirtualizer])

  // ────────────────────────────────────────────────────────────────────────────
  // Unscheduled → Timeline drag: window-level pointer events
  // ────────────────────────────────────────────────────────────────────────────

  const handleUnscheduledDragStart = useCallback(
    (item: WorkItemWithRelations, e: React.PointerEvent) => {
      setUnscheduledDrag({ item, ghostX: e.clientX, ghostY: e.clientY, targetDate: null })
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

      // Check if pointer is inside the scrollable timeline area (past left panel, within viewport)
      const isOverGrid =
        clientX >= rect.left + elw &&
        clientX <= rect.right &&
        clientY >= rect.top + HEADER_HEIGHT_BASE + SEARCH_BAR_HEIGHT &&
        clientY <= rect.bottom

      if (!isOverGrid) return { isOverGrid: false, targetDate: null }

      const contentX = clientX - rect.left + scrollContainer.scrollLeft
      const gridX = Math.max(0, contentX - elw)
      const targetDate = xToDateRef.current ? xToDateRef.current(gridX) : null

      return { isOverGrid, targetDate }
    }

    const handleMove = (e: PointerEvent) => {
      const { targetDate } = getGridInfo(e.clientX, e.clientY)
      setUnscheduledDrag((prev) =>
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

      // Optimistic update — field depends on dateMode
      const updates = dateMode === 'target'
        ? { start_date: startDateStr, due_date: dueDateStr }
        : { actual_start_date: startDateStr, actual_end_date: dueDateStr }

      pendingUpdatesRef.current.add(drag.item.id)
      setOptimisticItems((prev) =>
        prev.map((i) =>
          i.id === drag.item.id ? { ...i, ...updates } : i
        )
      )

      const result = await updateWorkItem(
        drag.item.id,
        updates,
        projectId
      )
      pendingUpdatesRef.current.delete(drag.item.id)
      if (result.error) {
        toast.error(result.error)
        setOptimisticItems(workItemsRef.current) // rollback
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isDraggingUnscheduled, projectId, dateMode])

  // Empty states
  if (optimisticItems.filter((i) => !i.deleted_at).length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">작업 항목을 추가하면 타임라인이 표시됩니다.</p>
        </div>
      </div>
    )
  }

  if (scheduledItems.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">일정이 설정된 항목이 없습니다.</p>
            <p className="text-xs mt-1">
              각 항목의 시작일/마감일을 설정하거나, 아래 항목을 타임라인으로 드래그하세요.
            </p>
          </div>
        </div>
        {displayUnscheduledItems.length > 0 && (
          <TimelineUnscheduled
            items={displayUnscheduledItems}
            showTrackerId={showTrackerId}
            projectKey={projectKey}
            onSelectItem={handleSelectItem}
            onDoubleClickItem={handleDoubleClick}
            selectedItemId={selection.id}
            isCollapsed={isUnscheduledCollapsed}
            onToggleCollapse={() => setIsUnscheduledCollapsed(v => !v)}
            onDragStart={handleUnscheduledDragStart}
          />
        )}

        {/* Drag ghost for empty-state unscheduled section */}
        {unscheduledDrag && (
          <UnscheduledGhost drag={unscheduledDrag} />
        )}
      </div>
    )
  }

  // --- Main layout ---

  const headerHeight = leftPanelVisible ? HEADER_HEIGHT_BASE + SEARCH_BAR_HEIGHT : HEADER_HEIGHT_BASE

  const cssGridContent = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${effectiveLeftWidth}px ${totalWidth}px`,
        gridTemplateRows: `${headerHeight}px ${Math.max(totalRowsHeight, 200)}px`,
        width: effectiveLeftWidth + totalWidth,
      }}
    >
      {/* Q1: Corner (sticky top + left) — Items header + search + expand/collapse */}
      {leftPanelVisible && (
        <div
          className="bg-background border-b border-r z-30 flex flex-col"
          style={{ position: 'sticky', top: 0, left: 0 }}
        >
          {/* Header row: label + expand/collapse */}
          <div className="flex items-center justify-between px-2 pt-1">
            <span className="text-[10px] text-muted-foreground">
              {flatItems.length}개 항목
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleExpandAll}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="모두 펼치기"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleCollapseAll}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="모두 접기"
              >
                <ChevronsDownUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Search input */}
          <div className="px-2 pb-1 pt-0.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색..."
                className="w-full h-6 pl-6 pr-6 text-xs bg-muted/50 border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {!leftPanelVisible && (
        <div
          className="bg-background border-b z-30"
          style={{ position: 'sticky', top: 0, left: 0, width: 0 }}
        />
      )}

      {/* Q2: Time axis header (sticky top) */}
      <div
        className="bg-background border-b z-20 flex flex-col justify-end"
        style={{ position: 'sticky', top: 0 }}
      >
        <TimelineHeader
          headerMonths={headerMonths}
          headerCells={headerCells}
          zoomLevel={zoomLevel}
          totalWidth={totalWidth}
        />
      </div>

      {/* Q3: Item labels (sticky left) */}
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
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const { item, level, hasChildren } = flatItems[virtualRow.index]
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
                    item={item}
                    level={level}
                    isExpanded={expandedIds.has(item.id)}
                    hasChildren={hasChildren}
                    isSelected={selection.id === item.id}
                    onToggleExpand={handleToggleExpand}
                    onClick={handleSelectItem}
                    onDoubleClick={handleDoubleClick}
                    showTrackerId={showTrackerId}
                    projectKey={projectKey}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
      {!leftPanelVisible && <div style={{ width: 0 }} />}

      {/* Q4: Gantt bars area */}
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

        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const { item } = flatItems[virtualRow.index]
          return (
            <TimelineBar
              key={item.id}
              item={item}
              dateToX={dateToX}
              xToDate={xToDate}
              pxPerDay={pxPerDay}
              rowIndex={virtualRow.index}
              isSelected={selection.id === item.id}
              onClick={handleSelectItem}
              onDoubleClick={handleDoubleClick}
              onDragEnd={handleBarDragEnd}
              dateMode={dateMode}
              onDragMove={handleBarDragMove}
              childrenDateRange={childrenDateRangeMap.get(item.id) ?? null}
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
    <div className="h-full flex flex-col" role="grid" aria-label="프로젝트 타임라인">
      {/* Zoom controls */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-0.5 bg-muted/80 rounded-md p-0.5 border shadow-sm">
          {ZOOM_ORDER.map((level) => (
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
          onClick={() => setIsFocusMode((v) => !v)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            isFocusMode
              ? 'text-foreground bg-muted font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={isFocusMode ? '집중 모드 해제 (Esc)' : '집중 모드'}
        >
          {isFocusMode ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{isFocusMode ? '해제' : '집중'}</span>
        </button>

        <button
          onClick={() => setLeftPanelVisible((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors md:hidden"
          title={leftPanelVisible ? '목록 숨기기' : '목록 보기'}
        >
          {leftPanelVisible ? (
            <PanelLeftClose className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="w-px h-4 bg-border md:hidden" />

        <button
          onClick={() => setShowFolders((v) => !v)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            showFolders
              ? 'text-foreground bg-muted font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={showFolders ? '폴더 숨기기' : '폴더 보이기'}
        >
          <Folder className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">폴더</span>
        </button>

        <button
          onClick={() => setDateMode((v) => (v === 'target' ? 'actual' : 'target'))}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            dateMode === 'actual'
              ? 'text-foreground bg-muted font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={dateMode === 'target' ? '실적 일정으로 전환' : '목표 일정으로 전환'}
        >
          {dateMode === 'target' ? (
            <CalendarDays className="h-3.5 w-3.5" />
          ) : (
            <CalendarCheck className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{dateMode === 'target' ? '목표' : '실적'}</span>
        </button>

        <div className="flex-1" />

        {displayUnscheduledItems.length > 0 && (
          <span className="text-xs text-muted-foreground">
            미배정 {displayUnscheduledItems.length}개
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

      {/* Unscheduled section with custom vertical drag */}
      {displayUnscheduledItems.length > 0 && (
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
              items={displayUnscheduledItems}
              showTrackerId={showTrackerId}
              projectKey={projectKey}
              onSelectItem={handleSelectItem}
              onDoubleClickItem={handleDoubleClick}
              selectedItemId={selection.id}
              isCollapsed={isUnscheduledCollapsed}
              onToggleCollapse={() => setIsUnscheduledCollapsed(v => !v)}
              onDragStart={handleUnscheduledDragStart}
            />
          </div>
        </>
      )}

      {/* Unscheduled drag ghost — follows cursor across the entire page */}
      {unscheduledDrag && (
        <UnscheduledGhost drag={unscheduledDrag} />
      )}

      {/* Detail dialog */}
      {detailItem && (
        <WorkItemDetailDialog
          item={detailItem}
          projectId={projectId}
          projectKey={projectKey}
          open={!!detailItem}
          onOpenChange={(open) => {
            if (!open) setDetailItem(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Ghost UI component ───────────────────────────────────────────────────────

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
