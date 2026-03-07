'use client'

import { useState, useCallback, useRef, useOptimistic, useTransition, useMemo, useEffect } from 'react'
import { toast } from 'sonner'

// Native confirm for synchronous operations (keyboard handler)
const getNativeConfirm = () => {
  if (typeof window !== 'undefined') {
    return window.__nativeConfirm || window.confirm.bind(window)
  }
  return () => true
}

import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import Plus from 'lucide-react/dist/esm/icons/plus'
import ChevronsUpDown from 'lucide-react/dist/esm/icons/chevrons-up-down'
import ChevronsDownUp from 'lucide-react/dist/esm/icons/chevrons-down-up'
import Search from 'lucide-react/dist/esm/icons/search'
import X from 'lucide-react/dist/esm/icons/x'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { scrollMaskBoth } from '@/lib/motion'
import { type Selection } from './alm-layout'
import {
  createWorkItem,
  deleteWorkItem,
  moveWorkItem,
  moveWorkItems,
} from '@/app/(dashboard)/projects/[key]/actions'
import { TreeItemNode, StatusIcon, type DropIndicator, type DropPosition } from './tree-item-node'
import { TreeProvider } from '@/hooks/use-tree-context'
import type { TreeWorkItem, StatusRef, TrackerRef, LinkCount } from '@/types/database'

interface ALMTreePanelContentProps {
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

// 드래그 모드: auto(기본), sibling(Option/Alt: 같은 레벨 강제), nest(Ctrl: 하위 강제)
type DragMode = 'auto' | 'sibling' | 'nest'

function calculateDropPosition(
  mouseY: number,
  rect: DOMRect,
  mode: DragMode
): DropPosition {
  if (mode === 'nest') return 'inside'
  if (mode === 'sibling') {
    // 50/50 분할: 위쪽 = before, 아래쪽 = after
    return mouseY < rect.top + rect.height * 0.5 ? 'before' : 'after'
  }
  // auto: 상단 10% = before, 중앙 80% = inside, 하단 10% = after
  const topThreshold = rect.top + rect.height * 0.10
  const bottomThreshold = rect.top + rect.height * 0.90
  if (mouseY < topThreshold) return 'before'
  if (mouseY > bottomThreshold) return 'after'
  return 'inside'
}

// 트리 최상단 드롭 존 (첫 번째 아이템 위로 드래그 시 드롭 가능하게)
function TopDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: '__top-drop-zone__' })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-2 -mb-1 rounded-full transition-colors',
        isOver && 'h-1 bg-primary mx-2'
      )}
    />
  )
}

export default function ALMTreePanelContent({
  projectId,
  projectKey,
  workItems,
  trackers,
  statuses,
  selection,
  onSelectionChange,
  showTrackerId,
  linkCounts = [],
}: ALMTreePanelContentProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set())
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const [dragMode, setDragMode] = useState<DragMode>('auto')
  const dragModeRef = useRef<DragMode>('auto')
  const lastOverRef = useRef<{ id: string; rect: DOMRect; mouseY: number } | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Feature 2: Search/Filter state
  const [searchQuery, setSearchQuery] = useState('')

  // Feature 3: Inline editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Feature 4: Keyboard navigation state
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)

  // Optimistic UI: 드래그앤드롭 시 즉시 트리 반영
  type OptimisticAction =
    | { itemId: string; newParentId: string | null; newPosition: number }
    | { items: Array<{ itemId: string; newParentId: string | null; newPosition: number }> }

  const [optimisticTreeWorkItems, addOptimisticUpdate] = useOptimistic(
    workItems,
    (currentItems: TreeWorkItem[], action: OptimisticAction) => {
      if ('items' in action) {
        let result = currentItems
        for (const update of action.items) {
          result = result.map(item =>
            item.id === update.itemId
              ? { ...item, parent_id: update.newParentId, position: update.newPosition }
              : item
          )
        }
        return result
      }
      return currentItems.map(item =>
        item.id === action.itemId
          ? { ...item, parent_id: action.newParentId, position: action.newPosition }
          : item
      )
    }
  )
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  )

  // Link counts map for badge display
  const linkCountMap = useMemo(() => {
    const map = new Map<string, { count: number; hasSuspect: boolean }>()
    for (const lc of linkCounts) {
      map.set(lc.work_item_id, { count: lc.link_count, hasSuspect: lc.has_suspect })
    }
    return map
  }, [linkCounts])

  // Pre-build children map for O(1) lookup
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, TreeWorkItem[]>()
    for (const item of optimisticTreeWorkItems) {
      const key = item.parent_id ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    // Sort each group by position
    for (const [key, children] of map.entries()) {
      map.set(key, children.toSorted((a, b) => a.position - b.position))
    }
    return map
  }, [optimisticTreeWorkItems])

  // Feature 1: Compute all parent IDs from childrenMap (O(n) instead of O(n²))
  const allParentIds = useMemo(() => {
    const parentIds = new Set<string>()
    for (const [key, children] of childrenMap) {
      if (key !== null && children.length > 0) {
        parentIds.add(key)
      }
    }
    return parentIds
  }, [childrenMap])

  const handleExpandAll = useCallback(() => {
    setExpandedItems(new Set(allParentIds))
  }, [allParentIds])

  const handleCollapseAll = useCallback(() => {
    setExpandedItems(new Set())
  }, [])

  const toggleItem = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  // 선택된 항목의 부모 체인 자동 펼치기 + 스크롤
  // Cmd+K 등 외부 네비게이션 시에도 동작하도록 마지막 처리한 ID를 추적
  const lastAutoExpandedId = useRef<string | null>(null)
  useEffect(() => {
    if (
      selection.type === 'workitem' &&
      selection.id &&
      selection.id !== lastAutoExpandedId.current
    ) {
      lastAutoExpandedId.current = selection.id
      const itemMap = new Map(optimisticTreeWorkItems.map(w => [w.id, w]))
      const parentsToExpand = new Set<string>()
      let current = itemMap.get(selection.id)
      while (current?.parent_id) {
        parentsToExpand.add(current.parent_id)
        current = itemMap.get(current.parent_id)
      }
      if (parentsToExpand.size > 0) {
        setExpandedItems(prev => {
          const next = new Set(prev)
          for (const id of parentsToExpand) next.add(id)
          return next
        })
      }
      // Double RAF + retry: wait for expanded nodes to render
      const targetId = selection.id!
      let cancelled = false
      let attempts = 0
      const maxAttempts = 8

      const tryScroll = () => {
        if (cancelled) return
        const element = itemRefs.current.get(targetId)
        if (element) {
          element.scrollIntoView({ block: 'nearest' })
          return
        }
        attempts++
        if (attempts < maxAttempts) {
          requestAnimationFrame(tryScroll)
        }
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(tryScroll)
      })

      return () => { cancelled = true }
    }
  }, [selection, optimisticTreeWorkItems])

  // "유효 루트" 계산: parent_id === null OR parent_id가 현재 세트에 없는 항목
  // 레벨 필터로 중간 depth만 남기면 항목의 parent_id가 필터된 세트에 없을 수 있음
  const rootItems = useMemo(() => {
    const itemIdSet = new Set(optimisticTreeWorkItems.map(w => w.id))
    const naturalRoots = childrenMap.get(null) ?? []
    // parent가 현재 세트에 없는 항목 = orphan root
    const orphanRoots = optimisticTreeWorkItems.filter(
      w => w.parent_id !== null && !itemIdSet.has(w.parent_id!)
    )
    if (orphanRoots.length === 0) return naturalRoots
    // 중복 제거 후 position으로 정렬
    const rootIdSet = new Set(naturalRoots.map(w => w.id))
    const combined = [...naturalRoots]
    for (const item of orphanRoots) {
      if (!rootIdSet.has(item.id)) {
        combined.push(item)
        rootIdSet.add(item.id)
      }
    }
    return combined.toSorted((a, b) => a.position - b.position)
  }, [childrenMap, optimisticTreeWorkItems])

  const getChildren = useCallback(
    (parentId: string) => childrenMap.get(parentId) ?? [],
    [childrenMap]
  )

  // Feature 2: Search/Filter logic (itemMap for O(1) parent lookup)
  const filteredIds = useMemo(() => {
    if (!searchQuery.trim()) return null
    const query = searchQuery.toLowerCase()

    // Build itemMap for O(1) parent walk-up
    const itemMap = new Map(optimisticTreeWorkItems.map(w => [w.id, w]))

    // Find matching items
    const matchingItems = optimisticTreeWorkItems.filter(
      item =>
        item.title.toLowerCase().includes(query) ||
        `${projectKey}-${item.number}`.toLowerCase().includes(query) ||
        String(item.number).includes(searchQuery)
    )

    const result = new Set<string>()

    // Add matching items and all their ancestors
    for (const item of matchingItems) {
      result.add(item.id)
      // Walk up parent chain using O(1) map lookup
      let current = item
      while (current.parent_id) {
        if (result.has(current.parent_id)) break // already traced this chain
        result.add(current.parent_id)
        const parent = itemMap.get(current.parent_id)
        if (!parent) break
        current = parent
      }
    }

    return result
  }, [searchQuery, optimisticTreeWorkItems, projectKey])

  // Auto-expand parents of matching items when searching
  useEffect(() => {
    if (filteredIds && filteredIds.size > 0) {
      const parentsToExpand = new Set<string>()
      for (const id of filteredIds) {
        if (allParentIds.has(id)) {
          parentsToExpand.add(id)
        }
      }
      if (parentsToExpand.size > 0) {
        setExpandedItems(prev => {
          const next = new Set(prev)
          for (const id of parentsToExpand) {
            next.add(id)
          }
          return next
        })
      }
    }
  }, [filteredIds, allParentIds])

  // Apply filtering to rootItems and getChildren
  const filteredRootItems = useMemo(() => {
    if (!filteredIds) return rootItems
    return rootItems.filter(w => filteredIds.has(w.id))
  }, [rootItems, filteredIds])

  const getFilteredChildren = useCallback(
    (parentId: string) => {
      const children = getChildren(parentId)
      if (!filteredIds) return children
      return children.filter(w => filteredIds.has(w.id))
    },
    [getChildren, filteredIds]
  )

  // Feature 4: Build flat list of visible items for keyboard navigation
  const visibleItems = useMemo(() => {
    const result: TreeWorkItem[] = []
    const addItems = (items: TreeWorkItem[]) => {
      for (const item of items) {
        if (filteredIds && !filteredIds.has(item.id)) continue
        result.push(item)
        if (expandedItems.has(item.id)) {
          addItems(getFilteredChildren(item.id))
        }
      }
    }
    addItems(filteredRootItems)
    return result
  }, [filteredRootItems, expandedItems, getFilteredChildren, filteredIds])

  // 드래그 중 modifier key 감지 (Ctrl = nest, Option/Alt = sibling)
  useEffect(() => {
    if (!activeId) {
      dragModeRef.current = 'auto'
      setDragMode('auto')
      lastOverRef.current = null
      return
    }

    const resolveMode = (e: KeyboardEvent | { altKey: boolean; ctrlKey: boolean }): DragMode => {
      if (e.ctrlKey) return 'nest'
      if (e.altKey) return 'sibling'
      return 'auto'
    }

    const updateMode = (mode: DragMode) => {
      if (dragModeRef.current === mode) return
      dragModeRef.current = mode
      setDragMode(mode)
      // 모드 변경 시 드롭 인디케이터 즉시 재계산
      const last = lastOverRef.current
      if (last) {
        const position = calculateDropPosition(last.mouseY, last.rect, mode)
        setDropIndicator({ itemId: last.id, position })
      }
    }

    const onKeyDown = (e: KeyboardEvent) => updateMode(resolveMode(e))
    const onKeyUp = (e: KeyboardEvent) => updateMode(resolveMode(e))

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [activeId])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedItemId) {
      const element = itemRefs.current.get(focusedItemId)
      if (element) {
        element.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [focusedItemId])

  const activeItem = activeId ? optimisticTreeWorkItems.find((w) => w.id === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    // Feature 3: Prevent DnD during inline editing
    if (editingItemId) return
    // 드래그 시작 시점의 modifier key 감지
    const e = event.activatorEvent as MouseEvent
    if (e.ctrlKey) {
      dragModeRef.current = 'nest'
      setDragMode('nest')
    } else if (e.altKey) {
      dragModeRef.current = 'sibling'
      setDragMode('sibling')
    }
    const dragId = event.active.id as string
    setActiveId(dragId)

    // Multi-drag: 선택된 항목 중 하나를 드래그하면 모두 같이 이동
    if (selection.ids && selection.ids.size > 1 && selection.ids.has(dragId)) {
      setDraggedIds(new Set(selection.ids))
    } else {
      setDraggedIds(new Set([dragId]))
    }
  }

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      setDropIndicator(null)
      lastOverRef.current = null
      return
    }

    const overElement = itemRefs.current.get(over.id as string)
    if (!overElement) {
      setDropIndicator(null)
      lastOverRef.current = null
      return
    }

    const rect = overElement.getBoundingClientRect()
    const mouseY = (event.activatorEvent as MouseEvent).clientY + (event.delta?.y || 0)

    // modifier key 변경 시 재계산 용도로 저장
    lastOverRef.current = { id: over.id as string, rect, mouseY }

    const position = calculateDropPosition(mouseY, rect, dragModeRef.current)
    setDropIndicator({ itemId: over.id as string, position })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const currentDraggedIds = draggedIds

    setActiveId(null)
    const currentIndicator = dropIndicator
    setDropIndicator(null)
    setDraggedIds(new Set())

    if (!over || active.id === over.id) return

    // 드롭 위치 계산
    let newParentId: string | null = null
    let newPosition: number = 0

    if (over.id === '__top-drop-zone__') {
      newParentId = null
      newPosition = 0
    } else {
      if (!currentIndicator) return
      const overItem = optimisticTreeWorkItems.find((w) => w.id === over.id)
      if (!overItem) return

      if (currentIndicator.position === 'inside') {
        newParentId = overItem.id
        const children = getChildren(overItem.id)
        newPosition = children.length > 0 ? Math.max(...children.map(c => c.position)) + 1 : 0
        setExpandedItems(prev => new Set([...prev, overItem.id]))
      } else if (currentIndicator.position === 'before') {
        newParentId = overItem.parent_id
        newPosition = overItem.position
      } else if (currentIndicator.position === 'after') {
        newParentId = overItem.parent_id
        newPosition = overItem.position + 1
      }
    }

    // 순환 참조 방지: 자기 자신 또는 자손을 부모로 설정 불가
    if (newParentId) {
      const isDescendant = (itemId: string, targetId: string): boolean => {
        const children = childrenMap.get(itemId) ?? []
        for (const child of children) {
          if (child.id === targetId) return true
          if (isDescendant(child.id, targetId)) return true
        }
        return false
      }
      const draggingIds = currentDraggedIds.size > 0 ? currentDraggedIds : new Set([active.id as string])
      for (const dragId of draggingIds) {
        if (dragId === newParentId || isDescendant(dragId, newParentId)) {
          toast.error('자기 하위 항목으로 이동할 수 없습니다.')
          return
        }
      }
    }

    if (currentDraggedIds.size > 1) {
      // Multi-drag: 시각적 순서 유지하면서 일괄 이동
      const sortedIds = visibleItems
        .filter(item => currentDraggedIds.has(item.id))
        .map(item => item.id)

      startTransition(async () => {
        addOptimisticUpdate({
          items: sortedIds.map((id, i) => ({
            itemId: id,
            newParentId,
            newPosition: newPosition + i,
          })),
        })
        await moveWorkItems(sortedIds, newParentId, newPosition, projectId)
      })
    } else {
      // Single drag
      const draggedItem = optimisticTreeWorkItems.find((w) => w.id === active.id)
      if (!draggedItem) return
      startTransition(async () => {
        addOptimisticUpdate({ itemId: draggedItem.id, newParentId, newPosition })
        const result = await moveWorkItem(draggedItem.id, newParentId, newPosition, projectId)
        if (result?.error) {
          toast.error('이동에 실패했습니다.')
        }
      })
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setDropIndicator(null)
    setDraggedIds(new Set())
  }

  const handleCreateItem = useCallback(async (parentId: string | null, isFolder: boolean) => {
    const folderTracker = trackers.find((t) => t.name === 'Folder')
    const defaultTracker = trackers.find((t) => t.name !== 'Folder') || trackers[0]
    const defaultStatus = statuses.find((s) => !s.is_closed) || statuses[0]

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('title', isFolder ? '새 폴더' : '새 아이템')
    formData.set('trackerId', isFolder && folderTracker ? folderTracker.id : defaultTracker.id)
    formData.set('statusId', defaultStatus.id)
    formData.set('priority', '0')
    if (parentId) {
      formData.set('parentId', parentId)
    }

    const result = await createWorkItem(formData)
    if (result?.error) {
      toast.error('생성에 실패했습니다.')
    } else {
      toast.success(isFolder ? '폴더가 생성되었습니다.' : '아이템이 생성되었습니다.')
    }
  }, [projectId, trackers, statuses])

  const rootItemsRef = useRef(rootItems)
  rootItemsRef.current = rootItems

  const handleMoveToRoot = useCallback((itemId: string) => {
    const currentRootItems = rootItemsRef.current
    const maxPosition = currentRootItems.length > 0 ? Math.max(...currentRootItems.map(i => i.position)) + 1 : 0
    startTransition(async () => {
      addOptimisticUpdate({ itemId, newParentId: null, newPosition: maxPosition })
      const result = await moveWorkItem(itemId, null, maxPosition, projectId)
      if (result?.error) {
        toast.error('최상위로 이동하지 못했습니다.')
      }
    })
  }, [projectId, startTransition, addOptimisticUpdate])

  const registerRef = useCallback((id: string, element: HTMLElement | null) => {
    if (element) {
      itemRefs.current.set(id, element)
    } else {
      itemRefs.current.delete(id)
    }
  }, [])

  // TreeItemNode에서 _shift/_ctrl 플래그 기반 클릭 처리 wrapper
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const visibleItemsForClickRef = useRef(visibleItems)
  visibleItemsForClickRef.current = visibleItems

  const handleNodeSelect = useCallback((sel: Selection) => {
    const extended = sel as Selection & { _shift?: boolean; _ctrl?: boolean }
    const clickedId = sel.id!

    if (extended._shift) {
      const currentSelection = selectionRef.current
      const currentVisibleItems = visibleItemsForClickRef.current
      if (currentSelection.lastSelectedId) {
        const lastIndex = currentVisibleItems.findIndex(i => i.id === currentSelection.lastSelectedId)
        const currentIndex = currentVisibleItems.findIndex(i => i.id === clickedId)
        if (lastIndex !== -1 && currentIndex !== -1) {
          const [start, end] = lastIndex < currentIndex
            ? [lastIndex, currentIndex]
            : [currentIndex, lastIndex]
          const rangeIds = new Set(
            currentVisibleItems.slice(start, end + 1).map(i => i.id)
          )
          const newIds = new Set([...(currentSelection.ids || []), ...rangeIds])
          onSelectionChange({
            type: 'workitem',
            id: clickedId,
            ids: newIds,
            lastSelectedId: clickedId,
          })
          return
        }
      }
      // fallback: 일반 선택
      onSelectionChange({
        type: 'workitem',
        id: clickedId,
        ids: new Set([clickedId]),
        lastSelectedId: clickedId,
      })
      return
    }

    if (extended._ctrl) {
      const currentSelection = selectionRef.current
      const newIds = new Set(currentSelection.ids || [])
      if (newIds.has(clickedId)) {
        newIds.delete(clickedId)
      } else {
        newIds.add(clickedId)
      }
      onSelectionChange({
        type: 'workitem',
        id: newIds.size > 0 ? clickedId : null,
        ids: newIds,
        lastSelectedId: clickedId,
      })
      return
    }

    // 일반 클릭: 그대로 전달
    onSelectionChange(sel)
  }, [onSelectionChange])

  // Feature 4: Keyboard navigation handler
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Don't handle keyboard nav during inline editing
    if (editingItemId) return

    const currentIndex = focusedItemId
      ? visibleItems.findIndex(item => item.id === focusedItemId)
      : -1

    const currentItem = currentIndex >= 0 ? visibleItems[currentIndex] : null

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        let targetId: string | null = null
        const nextIndex = currentIndex + 1
        if (nextIndex < visibleItems.length) {
          targetId = visibleItems[nextIndex].id
        } else if (visibleItems.length > 0 && currentIndex === -1) {
          targetId = visibleItems[0].id
        }
        if (targetId) {
          setFocusedItemId(targetId)
          onSelectionChange({
            type: 'workitem',
            id: targetId,
            ids: new Set([targetId]),
            lastSelectedId: targetId,
          })
        }
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        let targetId: string | null = null
        if (currentIndex > 0) {
          targetId = visibleItems[currentIndex - 1].id
        } else if (currentIndex === -1 && visibleItems.length > 0) {
          targetId = visibleItems[visibleItems.length - 1].id
        }
        if (targetId) {
          setFocusedItemId(targetId)
          onSelectionChange({
            type: 'workitem',
            id: targetId,
            ids: new Set([targetId]),
            lastSelectedId: targetId,
          })
        }
        break
      }
      case 'ArrowRight': {
        e.preventDefault()
        if (!currentItem) break
        if (allParentIds.has(currentItem.id) && !expandedItems.has(currentItem.id)) {
          // Expand collapsed node
          toggleItem(currentItem.id)
        } else if (expandedItems.has(currentItem.id)) {
          // Focus + select first child
          const children = getFilteredChildren(currentItem.id)
          if (children.length > 0) {
            const childId = children[0].id
            setFocusedItemId(childId)
            onSelectionChange({
              type: 'workitem',
              id: childId,
              ids: new Set([childId]),
              lastSelectedId: childId,
            })
          }
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        if (!currentItem) break
        if (expandedItems.has(currentItem.id)) {
          // Collapse expanded node
          toggleItem(currentItem.id)
        } else if (currentItem.parent_id) {
          // Focus + select parent
          setFocusedItemId(currentItem.parent_id)
          onSelectionChange({
            type: 'workitem',
            id: currentItem.parent_id,
            ids: new Set([currentItem.parent_id]),
            lastSelectedId: currentItem.parent_id,
          })
        }
        break
      }
      case 'Enter':
      case ' ': {
        e.preventDefault()
        if (currentItem) {
          onSelectionChange({
            type: 'workitem',
            id: currentItem.id,
            ids: new Set([currentItem.id]),
            lastSelectedId: currentItem.id,
          })
        }
        break
      }
      case 'Delete': {
        e.preventDefault()
        if (currentItem) {
          if (getNativeConfirm()('정말 삭제하시겠습니까?')) {
            deleteWorkItem(currentItem.id, projectId)
          }
        }
        break
      }
      case 'F2': {
        e.preventDefault()
        if (currentItem) {
          setEditingItemId(currentItem.id)
        }
        break
      }
      case 'Home': {
        e.preventDefault()
        if (visibleItems.length > 0) {
          const targetId = visibleItems[0].id
          setFocusedItemId(targetId)
          onSelectionChange({
            type: 'workitem',
            id: targetId,
            ids: new Set([targetId]),
            lastSelectedId: targetId,
          })
        }
        break
      }
      case 'End': {
        e.preventDefault()
        if (visibleItems.length > 0) {
          const targetId = visibleItems[visibleItems.length - 1].id
          setFocusedItemId(targetId)
          onSelectionChange({
            type: 'workitem',
            id: targetId,
            ids: new Set([targetId]),
            lastSelectedId: targetId,
          })
        }
        break
      }
      case 'a':
      case 'A': {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          const allIds = new Set(visibleItems.map(item => item.id))
          if (allIds.size > 0) {
            const lastItem = visibleItems[visibleItems.length - 1]
            onSelectionChange({
              type: 'workitem',
              id: lastItem.id,
              ids: allIds,
              lastSelectedId: lastItem.id,
            })
          }
        }
        break
      }
    }
  }, [editingItemId, focusedItemId, visibleItems, expandedItems, allParentIds, getFilteredChildren, onSelectionChange, projectId, toggleItem])

  return (
    <div className="h-full border-r bg-muted/20 flex flex-col">
      {/* 헤더 */}
      <div className="p-2 border-b flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Items
        </span>
        <div className="flex items-center gap-0.5">
          {/* Feature 1: Expand All */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleExpandAll}
            title="모두 펼치기"
            aria-label="모두 펼치기"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
          {/* Feature 1: Collapse All */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCollapseAll}
            title="모두 접기"
            aria-label="모두 접기"
          >
            <ChevronsDownUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleCreateItem(null, false)}
            title="새 아이템 추가"
            aria-label="새 아이템 추가"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Feature 2: Search input */}
      <div className="px-2 py-1.5 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="검색..."
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* 트리 */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          WebkitMaskImage: scrollMaskBoth,
          maskImage: scrollMaskBoth,
        }}
      >
      <div
        className="h-full overflow-y-auto p-2 select-none"
        role="tree"
        aria-label="작업 항목 트리"
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
      >
        <TreeProvider
          projectId={projectId}
          projectKey={projectKey}
          showTrackerId={showTrackerId !== false}
          linkCountMap={linkCountMap}
          onToggle={toggleItem}
          onSelect={handleNodeSelect}
          onCreateItem={handleCreateItem}
          onMoveToRoot={handleMoveToRoot}
          getChildren={getChildren}
          getFilteredChildren={getFilteredChildren}
          registerRef={registerRef}
          setEditingItemId={setEditingItemId}
          setFocusedItemId={setFocusedItemId}
          visibleItems={visibleItems}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={filteredRootItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {activeId && <TopDropZone />}
              {filteredRootItems.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  {searchQuery ? '검색 결과가 없습니다' : '아이템이 없습니다'}
                </div>
              ) : (
                filteredRootItems.map((item) => (
                  <TreeItemNode
                    key={item.id}
                    item={item}
                    level={0}
                    isSelected={selection.type === 'workitem' && (selection.id === item.id || (selection.ids?.has(item.id) ?? false))}
                    isExpanded={expandedItems.has(item.id)}
                    isFocused={focusedItemId === item.id}
                    isEditing={editingItemId === item.id}
                    dropPosition={dropIndicator?.itemId === item.id ? dropIndicator.position : null}
                    hasChildren={getChildren(item.id).length > 0}
                    selection={selection}
                    expandedItems={expandedItems}
                    dropIndicator={dropIndicator}
                    editingItemId={editingItemId}
                    focusedItemId={focusedItemId}
                  />
                ))
              )}
            </SortableContext>

            <DragOverlay>
              {activeItem && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-background border rounded-md shadow-lg">
                  <StatusIcon status={activeItem.status} tracker={activeItem.tracker} />
                  <span className="text-sm">{activeItem.title}</span>
                  {draggedIds.size > 1 && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                      {draggedIds.size}
                    </span>
                  )}
                  {dragMode !== 'auto' && (
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded',
                      dragMode === 'nest' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                    )}>
                      {dragMode === 'nest' ? '하위로' : '같은 레벨'}
                    </span>
                  )}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </TreeProvider>
      </div>
      </div>
    </div>
  )
}
