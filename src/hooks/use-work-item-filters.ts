'use client'

import { useState, useCallback, useMemo } from 'react'
import type { WorkItemWithRelations } from '@/types/database'

export interface InitialFilters {
  statusFilter?: Set<string>
  assigneeFilter?: string | null
  levelFilter?: Set<number>
  visibilityFilter?: 'all' | 'internal' | 'public'
  showFolders?: boolean
}

export function useWorkItemFilters(
  workItems: WorkItemWithRelations[],
  currentUserId?: string,
  initialFilters?: InitialFilters
) {
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    () => initialFilters?.statusFilter ?? new Set()
  )
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(
    () => initialFilters?.assigneeFilter ?? null
  )
  const [levelFilter, setLevelFilter] = useState<Set<number>>(
    () => initialFilters?.levelFilter ?? new Set()
  )
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'internal' | 'public'>(
    () => initialFilters?.visibilityFilter ?? 'all'
  )
  const [showFolders, setShowFolders] = useState(
    () => initialFilters?.showFolders ?? true
  )

  const toggleStatusFilter = useCallback((statusId: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(statusId)) {
        next.delete(statusId)
      } else {
        next.add(statusId)
      }
      return next
    })
  }, [])

  const toggleLevelFilter = useCallback((level: number) => {
    setLevelFilter((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }, [])

  // 각 항목의 depth 계산 (parent 체인 워크업)
  const levelMap = useMemo(() => {
    const map = new Map<string, number>()
    const itemMap = new Map(workItems.map((w) => [w.id, w]))

    const getLevel = (id: string): number => {
      if (map.has(id)) return map.get(id)!
      const item = itemMap.get(id)
      if (!item || !item.parent_id) {
        map.set(id, 0)
        return 0
      }
      const parentLevel = getLevel(item.parent_id)
      const level = parentLevel + 1
      map.set(id, level)
      return level
    }

    for (const item of workItems) {
      getLevel(item.id)
    }
    return map
  }, [workItems])

  // 레벨별 카운트 (Folder 포함)
  const levelCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const [, level] of levelMap) {
      counts.set(level, (counts.get(level) || 0) + 1)
    }
    return counts
  }, [levelMap])

  // UI에서 버튼 개수 결정용
  const maxLevel = useMemo(() => {
    let max = 0
    for (const [, level] of levelMap) {
      if (level > max) max = level
    }
    return max
  }, [levelMap])

  const folderCount = useMemo(
    () => workItems.filter((w) => w.tracker?.name === 'Folder').length,
    [workItems]
  )

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of workItems) {
      if (!item.status_id) continue
      counts.set(item.status_id, (counts.get(item.status_id) || 0) + 1)
    }
    return counts
  }, [workItems])

  const visibilityCounts = useMemo(() => {
    const counts = { internal: 0, public: 0 }
    for (const item of workItems) {
      if (item.visibility === 'public') counts.public++
      else counts.internal++
    }
    return counts
  }, [workItems])

  const filteredWorkItems = useMemo(() => {
    const hasStatusFilter = statusFilter.size > 0
    const hasAssigneeFilter = assigneeFilter !== null
    const hasLevelFilter = levelFilter.size > 0
    const hasVisibilityFilter = visibilityFilter !== 'all'
    const hideFolders = !showFolders

    if (!hasStatusFilter && !hasAssigneeFilter && !hasLevelFilter && !hasVisibilityFilter && !hideFolders) return workItems

    function matchesCommonFilters(item: WorkItemWithRelations): boolean {
      if (hideFolders && item.tracker?.name === 'Folder') return false
      if (hasStatusFilter && (!item.status_id || !statusFilter.has(item.status_id))) return false
      if (hasAssigneeFilter) {
        if (assigneeFilter === 'mine' && item.assignee?.id !== currentUserId) return false
        if (assigneeFilter === 'unassigned' && item.assignee !== null) return false
        if (
          assigneeFilter !== 'mine' &&
          assigneeFilter !== 'unassigned' &&
          item.assignee?.id !== assigneeFilter
        ) return false
      }
      if (hasVisibilityFilter && item.visibility !== visibilityFilter) return false
      return true
    }

    // 레벨 필터가 활성화된 경우: 해당 depth 항목만 반환 (조상 포함 안 함)
    if (hasLevelFilter) {
      return workItems.filter((item) => {
        const level = levelMap.get(item.id)
        if (level === undefined || !levelFilter.has(level)) return false
        return matchesCommonFilters(item)
      })
    }

    // 레벨 필터 비활성: 기존 로직 (조상 포함)
    const matchedIds = new Set<string>()
    for (const item of workItems) {
      if (!matchesCommonFilters(item)) continue
      matchedIds.add(item.id)
    }

    const itemMap = new Map(workItems.map((w) => [w.id, w]))
    const includedIds = new Set(matchedIds)
    for (const id of matchedIds) {
      let current = itemMap.get(id)
      while (current?.parent_id) {
        if (includedIds.has(current.parent_id)) break
        includedIds.add(current.parent_id)
        current = itemMap.get(current.parent_id)
      }
    }

    return workItems.filter((w) => includedIds.has(w.id))
  }, [workItems, statusFilter, assigneeFilter, levelFilter, levelMap, visibilityFilter, showFolders, currentUserId])

  return {
    statusFilter,
    setStatusFilter,
    toggleStatusFilter,
    assigneeFilter,
    setAssigneeFilter,
    levelFilter,
    setLevelFilter,
    toggleLevelFilter,
    levelCounts,
    maxLevel,
    statusCounts,
    visibilityFilter,
    setVisibilityFilter,
    visibilityCounts,
    showFolders,
    setShowFolders,
    folderCount,
    filteredWorkItems,
  }
}
