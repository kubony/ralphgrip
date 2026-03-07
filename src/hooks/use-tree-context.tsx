'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { TreeWorkItem } from '@/types/database'
import type { Selection } from '@/hooks/use-alm-selection'

export interface TreeContextValue {
  // 정적 데이터 (세션 수명)
  projectId: string
  projectKey: string
  showTrackerId: boolean
  linkCountMap: Map<string, { count: number; hasSuspect: boolean }>

  // 안정화된 콜백 (ref 기반 → stable reference)
  onToggle: (id: string) => void
  onSelect: (selection: Selection) => void
  onCreateItem: (parentId: string | null, isFolder: boolean) => void
  onMoveToRoot: (itemId: string) => void
  getChildren: (parentId: string) => TreeWorkItem[]
  getFilteredChildren: (parentId: string) => TreeWorkItem[]
  registerRef: (id: string, element: HTMLElement | null) => void
  setEditingItemId: (id: string | null) => void
  setFocusedItemId: (id: string | null) => void

  // Shift+클릭 범위 선택용
  getVisibleItemRange: (fromId: string, toId: string) => Set<string>
}

const TreeContext = createContext<TreeContextValue | null>(null)

export function useTreeContext(): TreeContextValue {
  const ctx = useContext(TreeContext)
  if (!ctx) {
    throw new Error('useTreeContext must be used within a TreeProvider')
  }
  return ctx
}

interface TreeProviderProps {
  children: ReactNode

  // 정적 데이터
  projectId: string
  projectKey: string
  showTrackerId: boolean
  linkCountMap: Map<string, { count: number; hasSuspect: boolean }>

  // 원본 콜백 (매 렌더 변할 수 있음 → ref로 안정화)
  onToggle: (id: string) => void
  onSelect: (selection: Selection) => void
  onCreateItem: (parentId: string | null, isFolder: boolean) => void
  onMoveToRoot: (itemId: string) => void
  getChildren: (parentId: string) => TreeWorkItem[]
  getFilteredChildren: (parentId: string) => TreeWorkItem[]
  registerRef: (id: string, element: HTMLElement | null) => void
  setEditingItemId: (id: string | null) => void
  setFocusedItemId: (id: string | null) => void
  visibleItems: TreeWorkItem[]
}

export function TreeProvider({
  children,
  projectId,
  projectKey,
  showTrackerId,
  linkCountMap,
  onToggle,
  onSelect,
  onCreateItem,
  onMoveToRoot,
  getChildren,
  getFilteredChildren,
  registerRef,
  setEditingItemId,
  setFocusedItemId,
  visibleItems,
}: TreeProviderProps) {
  // ref 기반 stable 콜백 패턴:
  // 함수 참조가 변해도 Context 값은 동일 → 구독자 리렌더 방지
  const onToggleRef = useRef(onToggle)
  useEffect(() => {
    onToggleRef.current = onToggle
  }, [onToggle])
  const stableOnToggle = useCallback((id: string) => onToggleRef.current(id), [])

  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])
  const stableOnSelect = useCallback((sel: Selection) => onSelectRef.current(sel), [])

  const onCreateItemRef = useRef(onCreateItem)
  useEffect(() => {
    onCreateItemRef.current = onCreateItem
  }, [onCreateItem])
  const stableOnCreateItem = useCallback(
    (parentId: string | null, isFolder: boolean) => onCreateItemRef.current(parentId, isFolder),
    []
  )

  const onMoveToRootRef = useRef(onMoveToRoot)
  useEffect(() => {
    onMoveToRootRef.current = onMoveToRoot
  }, [onMoveToRoot])
  const stableOnMoveToRoot = useCallback((itemId: string) => onMoveToRootRef.current(itemId), [])

  const getChildrenRef = useRef(getChildren)
  useEffect(() => {
    getChildrenRef.current = getChildren
  }, [getChildren])
  const stableGetChildren = useCallback(
    (parentId: string) => getChildrenRef.current(parentId),
    []
  )

  const getFilteredChildrenRef = useRef(getFilteredChildren)
  useEffect(() => {
    getFilteredChildrenRef.current = getFilteredChildren
  }, [getFilteredChildren])
  const stableGetFilteredChildren = useCallback(
    (parentId: string) => getFilteredChildrenRef.current(parentId),
    []
  )

  const setEditingItemIdRef = useRef(setEditingItemId)
  useEffect(() => {
    setEditingItemIdRef.current = setEditingItemId
  }, [setEditingItemId])
  const stableSetEditingItemId = useCallback(
    (id: string | null) => setEditingItemIdRef.current(id),
    []
  )

  const setFocusedItemIdRef = useRef(setFocusedItemId)
  useEffect(() => {
    setFocusedItemIdRef.current = setFocusedItemId
  }, [setFocusedItemId])
  const stableSetFocusedItemId = useCallback(
    (id: string | null) => setFocusedItemIdRef.current(id),
    []
  )

  const visibleItemsRef = useRef(visibleItems)
  useEffect(() => {
    visibleItemsRef.current = visibleItems
  }, [visibleItems])
  const getVisibleItemRange = useCallback((fromId: string, toId: string): Set<string> => {
    const items = visibleItemsRef.current
    const fromIndex = items.findIndex(i => i.id === fromId)
    const toIndex = items.findIndex(i => i.id === toId)
    if (fromIndex === -1 || toIndex === -1) return new Set()
    const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex]
    return new Set(items.slice(start, end + 1).map(i => i.id))
  }, [])

  const value: TreeContextValue = useMemo(() => ({
    projectId,
    projectKey,
    showTrackerId,
    linkCountMap,
    onToggle: stableOnToggle,
    onSelect: stableOnSelect,
    onCreateItem: stableOnCreateItem,
    onMoveToRoot: stableOnMoveToRoot,
    getChildren: stableGetChildren,
    getFilteredChildren: stableGetFilteredChildren,
    registerRef,
    setEditingItemId: stableSetEditingItemId,
    setFocusedItemId: stableSetFocusedItemId,
    getVisibleItemRange,
  }), [
    projectId,
    projectKey,
    showTrackerId,
    linkCountMap,
    stableOnToggle,
    stableOnSelect,
    stableOnCreateItem,
    stableOnMoveToRoot,
    stableGetChildren,
    stableGetFilteredChildren,
    registerRef,
    stableSetEditingItemId,
    stableSetFocusedItemId,
    getVisibleItemRange,
  ])

  return <TreeContext value={value}>{children}</TreeContext>
}
