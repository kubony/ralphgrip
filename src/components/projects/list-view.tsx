'use client'

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { WorkItemDetailDialog } from './work-item-detail-dialog'
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import Circle from 'lucide-react/dist/esm/icons/circle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Folder from 'lucide-react/dist/esm/icons/folder'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import Link2 from 'lucide-react/dist/esm/icons/link-2'
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal'
import Eye from 'lucide-react/dist/esm/icons/eye'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import Bot from 'lucide-react/dist/esm/icons/bot'
import { getAssigneeDisplay } from '@/lib/assignee-utils'
import type {
  WorkItemWithRelations,
  StatusRef,
  TrackerRef,
} from '@/types/database'

interface ListViewProps {
  projectId: string
  projectKey: string
  workItems: WorkItemWithRelations[]
  showTrackerId?: boolean
  onSelectItem: (id: string) => void
  selectedItemId: string | null
}

type SortField = 'number' | 'title' | 'status' | 'priority' | 'due_date' | 'updated_at'
type SortDirection = 'asc' | 'desc'

interface SortState {
  field: SortField
  direction: SortDirection
}

interface FlatItem {
  item: WorkItemWithRelations
  level: number
  hasChildren: boolean
}

const priorityLabels: Record<number, string> = {
  0: '-',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical',
}

const priorityColors: Record<number, string> = {
  0: 'bg-gray-400',
  1: 'bg-blue-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
}

function TrackerIcon({ tracker, status }: { tracker: TrackerRef; status: StatusRef | null }) {
  if (tracker.name === 'Folder') {
    return <Folder className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
  }
  if (!status) {
    return <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
  }
  if (status.is_closed) {
    const isRejected = status.name === 'Rejected'
    return <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: isRejected ? '#ef4444' : '#22c55e' }} />
  }
  const color = status.color || '#94a3b8'
  return <Circle className="h-3.5 w-3.5 flex-shrink-0" style={{ color, fill: color }} />
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr: string | null, isClosed: boolean): boolean {
  if (!dateStr || isClosed) return false
  return new Date(dateStr) < new Date()
}

function SortIcon({ field, sortState }: { field: SortField; sortState: SortState }) {
  if (sortState.field !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return sortState.direction === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5" />
    : <ArrowDown className="h-3.5 w-3.5" />
}

type ColumnDef = {
  key: SortField | 'assignee'
  label: string
  sortable: boolean
  className: string
}

const columns: ColumnDef[] = [
  { key: 'number', label: '번호', sortable: true, className: 'w-[100px]' },
  { key: 'title', label: '제목', sortable: true, className: 'flex-1 min-w-[200px]' },
  { key: 'status', label: '상태', sortable: true, className: 'w-[120px]' },
  { key: 'priority', label: '우선순위', sortable: true, className: 'w-[100px]' },
  { key: 'assignee', label: '담당자', sortable: false, className: 'w-[120px]' },
  { key: 'due_date', label: '마감일', sortable: true, className: 'w-[100px]' },
  { key: 'updated_at', label: '수정일', sortable: true, className: 'w-[100px]' },
]

export default function ListView({
  projectId,
  projectKey,
  workItems,
  showTrackerId,
  onSelectItem,
  selectedItemId,
}: ListViewProps) {
  const [sortState, setSortState] = useState<SortState>({
    field: 'number',
    direction: 'asc',
  })
  const [detailItem, setDetailItem] = useState<WorkItemWithRelations | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string> | 'all'>('all')

  const activeItems = useMemo(
    () => workItems.filter((item) => !item.deleted_at),
    [workItems]
  )

  // 초기 로드 시 모든 항목 펼침 (activeItems 변경 시 expandedIds 초기화)
  const resolvedExpandedIds = useMemo(() => {
    if (expandedIds === 'all') {
      return new Set(activeItems.map((item) => item.id))
    }
    return expandedIds
  }, [expandedIds, activeItems])

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const current = prev === 'all'
        ? new Set(workItems.filter((item) => !item.deleted_at).map((item) => item.id))
        : new Set(prev)
      if (current.has(id)) {
        current.delete(id)
      } else {
        current.add(id)
      }
      return current
    })
  }, [workItems])

  // childrenMap + 정렬 함수
  const sortChildren = useCallback((children: WorkItemWithRelations[], field: SortField, direction: SortDirection) => {
    if (field === 'number' && direction === 'asc') {
      // 기본: position 순서 (트리 순서)
      return children.toSorted((a, b) => a.position - b.position)
    }
    const sorted = children.toSorted((a, b) => {
      let aVal: string | number
      let bVal: string | number
      switch (field) {
        case 'number':
          aVal = a.number; bVal = b.number; break
        case 'title':
          aVal = a.title.toLowerCase(); bVal = b.title.toLowerCase(); break
        case 'status':
          aVal = a.status?.position ?? 999; bVal = b.status?.position ?? 999; break
        case 'priority':
          aVal = a.priority; bVal = b.priority; break
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          aVal = new Date(a.due_date).getTime(); bVal = new Date(b.due_date).getTime(); break
        case 'updated_at':
          aVal = new Date(a.updated_at).getTime(); bVal = new Date(b.updated_at).getTime(); break
        default: return 0
      }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [])

  const flatItems = useMemo(() => {
    const activeSet = new Set(activeItems.map((item) => item.id))
    // childrenMap 생성
    const childrenMap = new Map<string | null, WorkItemWithRelations[]>()
    for (const item of activeItems) {
      const parentKey = item.parent_id && activeSet.has(item.parent_id) ? item.parent_id : null
      const arr = childrenMap.get(parentKey)
      if (arr) {
        arr.push(item)
      } else {
        childrenMap.set(parentKey, [item])
      }
    }

    // DFS 순회
    const result: FlatItem[] = []
    const { field, direction } = sortState

    function dfs(parentId: string | null, level: number) {
      const children = childrenMap.get(parentId)
      if (!children) return
      const sorted = sortChildren(children, field, direction)
      for (const item of sorted) {
        const hasChildren = childrenMap.has(item.id)
        result.push({ item, level, hasChildren })
        if (hasChildren && resolvedExpandedIds.has(item.id)) {
          dfs(item.id, level + 1)
        }
      }
    }

    dfs(null, 0)
    return result
  }, [activeItems, sortState, resolvedExpandedIds, sortChildren])

  const handleHeaderClick = (field: SortField) => {
    setSortState((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  if (flatItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">표시할 작업 항목이 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center bg-muted/50 border-b text-xs font-medium text-muted-foreground">
          {columns.map((col) => (
            <div
              key={col.key}
              className={cn(
                'px-3 py-2.5',
                col.className,
                col.sortable && 'cursor-pointer hover:text-foreground select-none'
              )}
              onClick={() => col.sortable && handleHeaderClick(col.key as SortField)}
            >
              <span className="flex items-center gap-1">
                {col.label}
                {col.sortable && <SortIcon field={col.key as SortField} sortState={sortState} />}
              </span>
            </div>
          ))}
          <div className="w-[40px] flex-shrink-0" />
        </div>

        {/* Rows */}
        <div className="divide-y">
          {flatItems.map(({ item, level, hasChildren }) => {
            const handleShareLink = async () => {
              const url = `${window.location.origin}/projects/${projectKey}/alm?item=${item.id}`
              await navigator.clipboard.writeText(url)
              toast.success('링크가 복사되었습니다')
            }
            const isExpanded = resolvedExpandedIds.has(item.id)
            return (
              <ContextMenu key={item.id}>
                <ContextMenuTrigger asChild>
                  <div
                    onClick={() => onSelectItem(item.id)}
                    onDoubleClick={() => setDetailItem(item)}
                    className={cn(
                      'flex items-center transition-colors cursor-pointer group',
                      selectedItemId === item.id
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    {/* 번호 */}
                    <div className="w-[100px] px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <TrackerIcon tracker={item.tracker} status={item.status} />
                        {showTrackerId && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {projectKey}-{item.number}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 제목 (인덴트 + 체브론) */}
                    <div className="flex-1 min-w-[200px] px-3 py-2.5">
                      <div className="flex items-center" style={{ paddingLeft: level * 20 }}>
                        {hasChildren ? (
                          <button
                            className="flex-shrink-0 p-0.5 -ml-1 mr-1 rounded hover:bg-muted/50"
                            onClick={(e) => toggleExpand(item.id, e)}
                          >
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            }
                          </button>
                        ) : (
                          <span className="w-[22px] flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">{item.title}</span>
                      </div>
                    </div>

                    {/* 상태 */}
                    <div className="w-[120px] px-3 py-2.5">
                      {item.status ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.status.color || '#94a3b8' }}
                          />
                          {item.status.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>

                    {/* 우선순위 */}
                    <div className="w-[100px] px-3 py-2.5">
                      {item.priority > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className={cn('w-2 h-2 rounded-full', priorityColors[item.priority])} />
                          {priorityLabels[item.priority]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>

                    {/* 담당자 */}
                    <div className="w-[120px] px-3 py-2.5">
                      {(() => {
                        const display = getAssigneeDisplay(item)
                        if (!display) return <span className="text-xs text-muted-foreground">-</span>
                        return (
                          <div className="flex items-center gap-1.5">
                            {display.isAgent ? (
                              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/30 flex-shrink-0">
                                <Bot className="h-3 w-3 text-violet-500" />
                              </div>
                            ) : (
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={display.avatar || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(display.name)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                              {display.name || '이름 없음'}
                            </span>
                          </div>
                        )
                      })()}
                    </div>

                    {/* 마감일 */}
                    <div className="w-[100px] px-3 py-2.5">
                      <span className={cn(
                        'text-xs',
                        isOverdue(item.due_date, item.status?.is_closed ?? false)
                          ? 'text-red-500 font-medium'
                          : 'text-muted-foreground'
                      )}>
                        {formatDate(item.due_date)}
                      </span>
                    </div>

                    {/* 수정일 */}
                    <div className="w-[100px] px-3 py-2.5 text-xs text-muted-foreground">
                      {formatDate(item.updated_at)}
                    </div>

                    {/* ⋮ 메뉴 */}
                    <div className="w-[40px] px-1 py-2.5 flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleShareLink}>
                            <Link2 className="h-4 w-4 mr-2" />
                            링크 복사
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDetailItem(item)}>
                            <Eye className="h-4 w-4 mr-2" />
                            상세 보기
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={handleShareLink}>
                    <Link2 className="h-4 w-4 mr-2" />
                    링크 복사
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => setDetailItem(item)}>
                    <Eye className="h-4 w-4 mr-2" />
                    상세 보기
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>
      </div>

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
