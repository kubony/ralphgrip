'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  getLinkableProjects,
  getProjectWorkItemsForLinking,
} from '@/app/(dashboard)/projects/[key]/actions'
import type { LinkableWorkItem } from '@/types/database'
import X from 'lucide-react/dist/esm/icons/x'
import Search from 'lucide-react/dist/esm/icons/search'
import Folder from 'lucide-react/dist/esm/icons/folder'
import Circle from 'lucide-react/dist/esm/icons/circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'

interface LinkSourcePanelProps {
  workItemId: string
  trackerName: string
  existingLinkIds: Set<string>
  onSelect: (targetId: string) => void
  onClose: () => void
  isLoading: boolean
}

interface LinkableProject {
  id: string
  name: string
  key: string
  project_type: string
}

export function LinkSourcePanel({
  workItemId,
  trackerName,
  existingLinkIds,
  onSelect,
  onClose,
  isLoading,
}: LinkSourcePanelProps) {
  const [projects, setProjects] = useState<LinkableProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [workItems, setWorkItems] = useState<LinkableWorkItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)

  // 프로젝트 목록 로드
  useEffect(() => {
    const load = async () => {
      const result = await getLinkableProjects()
      let available = result.data || []

      // 현재 작업이 Issue이면 requirement 프로젝트만 표시
      if (trackerName === 'Issue') {
        available = available.filter(p => p.project_type === 'requirement')
      }

      setProjects(available)
      if (available.length > 0) {
        setSelectedProjectId(available[0].id)
      }
      setLoadingProjects(false)
    }
    load()
  }, [trackerName])

  // 프로젝트 선택 시 작업 항목 로드
  useEffect(() => {
    if (!selectedProjectId) return
     
    queueMicrotask(() => setLoadingItems(true))
    const load = async () => {
      const result = await getProjectWorkItemsForLinking(selectedProjectId)
      setWorkItems(result.data || [])
       
      queueMicrotask(() => setLoadingItems(false))
    }
    load()
  }, [selectedProjectId])

  // 트리 구조로 정렬
  const treeItems = useMemo(() => {
    const rootItems = workItems.filter(w => !w.parent_id).toSorted((a, b) => a.position - b.position)

    const result: (LinkableWorkItem & { level: number })[] = []
    const addItems = (items: LinkableWorkItem[], level: number) => {
      for (const item of items) {
        result.push({ ...item, level })
        const children = workItems
          .filter(w => w.parent_id === item.id)
          .toSorted((a, b) => a.position - b.position)
        addItems(children, level + 1)
      }
    }
    addItems(rootItems, 0)
    return result
  }, [workItems])

  // 검색 필터
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return treeItems
    const query = searchQuery.toLowerCase()

    // 매칭 항목 + 부모 체인
    const matchingIds = new Set<string>()
    for (const item of treeItems) {
      if (item.title.toLowerCase().includes(query) || String(item.number).includes(searchQuery)) {
        matchingIds.add(item.id)
        // 부모 체인 추가
        let parentId = item.parent_id
        while (parentId) {
          matchingIds.add(parentId)
          const parent = workItems.find(w => w.id === parentId)
          parentId = parent?.parent_id || null
        }
      }
    }

    return treeItems.filter(item => matchingIds.has(item.id))
  }, [treeItems, searchQuery, workItems])

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">링크 대상 선택</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 프로젝트 선택 */}
      {loadingProjects ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          프로젝트 로딩 중...
        </div>
      ) : projects.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          연결 가능한 프로젝트가 없습니다
        </div>
      ) : (
        <>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="프로젝트 선택" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-mono text-muted-foreground mr-1">{p.key}</span>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색..."
              className="h-7 pl-7 text-xs"
            />
          </div>

          {/* 트리 목록 */}
          <div className="max-h-[400px] overflow-y-auto border rounded-md">
            {loadingItems ? (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-4">
                <Loader2 className="h-3 w-3 animate-spin" />
                로딩 중...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">
                {searchQuery ? '검색 결과가 없습니다' : '항목이 없습니다'}
              </div>
            ) : (
              filteredItems.map(item => {
                const isFolder = item.tracker_name === 'Folder'
                const isSelf = item.id === workItemId
                const isAlreadyLinked = existingLinkIds.has(item.id)
                // Issue↔Issue 차단
                const isIssueToIssue = trackerName === 'Issue' && item.tracker_name === 'Issue'
                const isDisabled = isFolder || isSelf || isAlreadyLinked || isIssueToIssue || isLoading

                return (
                  <button
                    key={item.id}
                    className={cn(
                      'w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-left hover:bg-muted/80 border-b last:border-b-0 transition-colors',
                      isDisabled && 'opacity-40 cursor-not-allowed'
                    )}
                    style={{ paddingLeft: `${item.level * 12 + 8}px` }}
                    onClick={() => !isDisabled && onSelect(item.id)}
                    disabled={isDisabled}
                    title={
                      isSelf ? '자기 자신' :
                      isAlreadyLinked ? '이미 연결됨' :
                      isFolder ? 'Folder 링크 불가' :
                      isIssueToIssue ? 'Issue간 링크 불가' :
                      undefined
                    }
                  >
                    {isFolder ? (
                      <Folder className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    ) : (
                      <Circle
                        className="h-3.5 w-3.5 flex-shrink-0"
                        style={{ color: item.tracker_color || '#6366f1', fill: item.tracker_color || '#6366f1' }}
                      />
                    )}
                    <span className="font-mono text-muted-foreground flex-shrink-0">
                      {selectedProject?.key}-{item.number}
                    </span>
                    <span className="truncate">{item.title}</span>
                    {isAlreadyLinked && (
                      <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">연결됨</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
