'use client'

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import Pin from 'lucide-react/dist/esm/icons/pin'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkItemDetailDialog } from '@/components/projects/work-item-detail-dialog'
import type { MyWorkItem, SortField, SortOrder, StatusesByProject } from './types'
import { priorityLabels, priorityColors, toWorkItemWithRelations } from './types'

interface MyWorkListViewProps {
  items: MyWorkItem[]
  sortBy: SortField
  sortOrder: SortOrder
  onSortChange: (field: SortField) => void
  pinnedIds: Set<string>
  onTogglePin: (itemId: string) => void
  statusesByProject: StatusesByProject
  onStatusChange: (itemId: string, statusId: string, projectId: string) => Promise<void>
  onItemSelect: (item: MyWorkItem) => void
  onFieldChange: (itemId: string, projectId: string, updates: Record<string, unknown>) => Promise<void>
}

function SortIcon({ field, sortBy, sortOrder }: { field: SortField; sortBy: SortField; sortOrder: SortOrder }) {
  if (sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return sortOrder === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5" />
    : <ArrowDown className="h-3.5 w-3.5" />
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr: string | null, isClosed: boolean) {
  if (!dateStr || isClosed) return false
  return new Date(dateStr) < new Date()
}

function StatusCell({ item, statusesByProject, onStatusChange }: {
  item: MyWorkItem
  statusesByProject: StatusesByProject
  onStatusChange: (itemId: string, statusId: string, projectId: string) => Promise<void>
}) {
  const [isChanging, setIsChanging] = useState(false)
  const statuses = statusesByProject[item.project_id] ?? []

  if (statuses.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: item.status?.color || '#94a3b8' }}
        />
        {item.status?.name ?? '-'}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:bg-muted transition-colors',
            isChanging && 'opacity-50'
          )}
          onClick={(e) => e.stopPropagation()}
          disabled={isChanging}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.status?.color || '#94a3b8' }}
          />
          {item.status?.name ?? '-'}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
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

function PriorityCell({ item, onFieldChange }: {
  item: MyWorkItem
  onFieldChange: (itemId: string, projectId: string, updates: Record<string, unknown>) => Promise<void>
}) {
  const [isChanging, setIsChanging] = useState(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:bg-muted transition-colors',
            isChanging && 'opacity-50'
          )}
          onClick={(e) => e.stopPropagation()}
          disabled={isChanging}
        >
          <span className={cn('w-2 h-2 rounded-full', priorityColors[item.priority])} />
          {item.priority > 0 ? priorityLabels[item.priority] : '-'}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {[0, 1, 2, 3, 4].map((priority) => (
          <DropdownMenuItem
            key={priority}
            className={cn(
              'flex items-center gap-2 text-xs cursor-pointer',
              priority === item.priority && 'bg-muted'
            )}
            onClick={async () => {
              if (priority === item.priority) return
              setIsChanging(true)
              await onFieldChange(item.id, item.project_id, { priority })
              setIsChanging(false)
            }}
          >
            <span className={cn('w-2 h-2 rounded-full', priorityColors[priority])} />
            {priorityLabels[priority]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MyWorkListView({ items, sortBy, sortOrder, onSortChange, pinnedIds, onTogglePin, statusesByProject, onStatusChange, onItemSelect, onFieldChange }: MyWorkListViewProps) {
  const [detailItem, setDetailItem] = useState<MyWorkItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRowClick = useCallback((item: MyWorkItem) => {
    if (clickTimerRef.current) {
      // 더블클릭: 타이머 취소하고 다이얼로그 열기
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      setDetailItem(item)
      setDetailOpen(true)
    } else {
      // 싱글클릭: 짧은 지연 후 Sheet 열기 (더블클릭 감지 대기)
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        onItemSelect(item)
      }, 250)
    }
  }, [onItemSelect])

  const columns: { key: SortField | 'project' | 'number' | 'title' | 'status' | 'pin'; label: string; sortable: boolean; className: string }[] = [
    { key: 'pin', label: '', sortable: false, className: 'w-[36px]' },
    { key: 'project', label: '프로젝트', sortable: true, className: 'w-[100px]' },
    { key: 'number', label: '번호', sortable: false, className: 'w-[100px]' },
    { key: 'title', label: '제목', sortable: false, className: 'flex-1 min-w-[200px]' },
    { key: 'status', label: '상태', sortable: true, className: 'w-[120px]' },
    { key: 'priority', label: '우선순위', sortable: true, className: 'w-[100px]' },
    { key: 'due_date', label: '마감일', sortable: true, className: 'w-[100px]' },
    { key: 'updated_at', label: '업데이트', sortable: true, className: 'w-[100px]' },
  ]

  return (
    <>
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-muted/50 border-b text-xs font-medium text-muted-foreground">
        {columns.map((col) => (
          <div
            key={col.key}
            className={cn('px-3 py-2.5', col.className, col.sortable && 'cursor-pointer hover:text-foreground select-none')}
            onClick={() => col.sortable && onSortChange(col.key as SortField)}
          >
            <span className="flex items-center gap-1">
              {col.label}
              {col.sortable && <SortIcon field={col.key as SortField} sortBy={sortBy} sortOrder={sortOrder} />}
            </span>
          </div>
        ))}
      </div>

      {/* Rows */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          작업이 없습니다.
        </div>
      ) : (
        <div className="divide-y">
          {items.map((item, i) => {
            const isPinned = pinnedIds.has(item.id)
            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-center hover:bg-muted/30 transition-colors cursor-pointer',
                  'animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200',
                  isPinned && 'bg-muted/20'
                )}
                style={{ animationDelay: `${Math.min(i * 30, 500)}ms` }}
                onClick={() => handleRowClick(item)}
              >
                {/* 핀 */}
                <div className="w-[36px] px-1.5 py-2.5 flex justify-center">
                  <button
                    className={cn(
                      'p-1 rounded transition-colors',
                      isPinned
                        ? 'text-foreground'
                        : 'text-muted-foreground/30 hover:text-muted-foreground'
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTogglePin(item.id)
                    }}
                    aria-label={isPinned ? '고정 해제' : '상단 고정'}
                  >
                    <Pin className={cn('h-3.5 w-3.5', isPinned && 'fill-current')} />
                  </button>
                </div>

                {/* 프로젝트 */}
                <div className="w-[100px] px-3 py-2.5">
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                    {item.project?.key ?? '-'}
                  </span>
                </div>

                {/* 번호 */}
                <div className="w-[100px] px-3 py-2.5 text-xs font-mono text-muted-foreground">
                  {item.project?.key}-{item.number}
                </div>

                {/* 제목 */}
                <div className="flex-1 min-w-[200px] px-3 py-2.5">
                  <span className="text-sm font-medium truncate flex items-center gap-1.5">
                    {item.title}
                    {item.matchReasons.includes('mentioned') && (
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 flex-shrink-0">
                        언급됨
                      </span>
                    )}
                  </span>
                </div>

                {/* 상태 */}
                <div className="w-[120px] px-3 py-2.5">
                  <StatusCell
                    item={item}
                    statusesByProject={statusesByProject}
                    onStatusChange={onStatusChange}
                  />
                </div>

                {/* 우선순위 */}
                <div className="w-[100px] px-3 py-2.5">
                  <PriorityCell
                    item={item}
                    onFieldChange={onFieldChange}
                  />
                </div>

                {/* 마감일 */}
                <div className="w-[100px] px-3 py-2.5">
                  <span className={cn(
                    'text-xs',
                    isOverdue(item.due_date, item.status?.is_closed ?? false) && 'text-red-500 font-medium'
                  )}>
                    {formatDate(item.due_date)}
                  </span>
                </div>

                {/* 업데이트 */}
                <div className="w-[100px] px-3 py-2.5 text-xs text-muted-foreground">
                  {formatDate(item.updated_at)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>

    {detailItem && detailItem.project && (
      <WorkItemDetailDialog
        item={toWorkItemWithRelations(detailItem)}
        projectId={detailItem.project_id}
        projectKey={detailItem.project.key}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    )}
    </>
  )
}
