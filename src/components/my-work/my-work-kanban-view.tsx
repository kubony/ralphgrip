'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { scrollMaskBoth } from '@/lib/motion'
import Pin from 'lucide-react/dist/esm/icons/pin'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkItemDetailDialog } from '@/components/projects/work-item-detail-dialog'
import type { MyWorkItem, Phase, StatusesByProject } from './types'
import { getPhase, phaseLabels, priorityColors, toWorkItemWithRelations } from './types'

interface MyWorkKanbanViewProps {
  items: MyWorkItem[]
  pinnedIds: Set<string>
  onTogglePin: (itemId: string) => void
  statusesByProject: StatusesByProject
  onStatusChange: (itemId: string, statusId: string, projectId: string) => Promise<void>
  onItemSelect: (item: MyWorkItem) => void
}

const phaseConfig: { phase: Phase; color: string }[] = [
  { phase: 'todo', color: '#94a3b8' },
  { phase: 'in_progress', color: '#3b82f6' },
  { phase: 'done', color: '#22c55e' },
]

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr: string | null, isClosed: boolean) {
  if (!dateStr || isClosed) return false
  return new Date(dateStr) < new Date()
}

function KanbanStatusBadge({ item, statusesByProject, onStatusChange }: {
  item: MyWorkItem
  statusesByProject: StatusesByProject
  onStatusChange: (itemId: string, statusId: string, projectId: string) => Promise<void>
}) {
  const [isChanging, setIsChanging] = useState(false)
  const statuses = statusesByProject[item.project_id] ?? []

  if (statuses.length === 0) {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded"
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
            'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded hover:ring-1 hover:ring-foreground/20 transition-all',
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

function KanbanCard({ item, isPinned, onTogglePin, onItemSelect, onItemDoubleClick, statusesByProject, onStatusChange }: {
  item: MyWorkItem
  isPinned: boolean
  onTogglePin: (id: string) => void
  onItemSelect: (item: MyWorkItem) => void
  onItemDoubleClick: (item: MyWorkItem) => void
  statusesByProject: StatusesByProject
  onStatusChange: (itemId: string, statusId: string, projectId: string) => Promise<void>
}) {
  const router = useRouter()
  const overdue = isOverdue(item.due_date, item.status?.is_closed ?? false)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClick = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      onItemDoubleClick(item)
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        onItemSelect(item)
      }, 250)
    }
  }, [item, onItemSelect, onItemDoubleClick])

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-background p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer',
        isPinned && 'ring-1 ring-foreground/10'
      )}
      onClick={handleClick}
    >
      {/* Action buttons (top-right) */}
      <div className="absolute top-2 right-2 flex items-center gap-0.5">
        {/* Link to project */}
        <button
          className="p-0.5 rounded transition-all text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-primary"
          onClick={(e) => {
            e.stopPropagation()
            if (item.project?.key) {
              router.push(`/projects/${item.project.key}/alm?item=${item.id}`)
            }
          }}
          aria-label="프로젝트에서 보기"
          title="프로젝트에서 보기"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
        {/* Pin button */}
        <button
          className={cn(
            'p-0.5 rounded transition-all',
            isPinned
              ? 'text-foreground opacity-100'
              : 'text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-muted-foreground'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin(item.id)
          }}
          aria-label={isPinned ? '고정 해제' : '상단 고정'}
        >
          <Pin className={cn('h-3 w-3', isPinned && 'fill-current')} />
        </button>
      </div>

      {/* Top row: project badge + priority */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
          {item.project?.key}
        </span>
        <span className="text-xs font-mono text-muted-foreground">
          {item.project?.key}-{item.number}
        </span>
        <div className="flex-1" />
        <div className={cn('w-2 h-2 rounded-full', priorityColors[item.priority] || 'bg-gray-400')} />
      </div>

      {/* Title */}
      <div className="mb-2 pr-5">
        <p className="text-sm font-medium line-clamp-2">{item.title}</p>
        {item.matchReasons.includes('mentioned') && (
          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 mt-1">
            언급됨
          </span>
        )}
      </div>

      {/* Bottom row: status badge + due date */}
      <div className="flex items-center gap-2">
        <KanbanStatusBadge
          item={item}
          statusesByProject={statusesByProject}
          onStatusChange={onStatusChange}
        />
        <div className="flex-1" />
        {item.due_date && (
          <span className={cn('text-[10px]', overdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
            {formatDate(item.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({ phase, color, items, pinnedIds, onTogglePin, onItemSelect, onItemDoubleClick, statusesByProject, onStatusChange }: {
  phase: Phase
  color: string
  items: MyWorkItem[]
  pinnedIds: Set<string>
  onTogglePin: (id: string) => void
  onItemSelect: (item: MyWorkItem) => void
  onItemDoubleClick: (item: MyWorkItem) => void
  statusesByProject: StatusesByProject
  onStatusChange: (itemId: string, statusId: string, projectId: string) => Promise<void>
}) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[360px] flex-1 rounded-lg border bg-muted/30">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium">{phaseLabels[phase]}</span>
        <span className="text-xs text-muted-foreground ml-auto">{items.length}</span>
      </div>

      {/* Cards */}
      <div
        className="flex-1 overflow-hidden"
        style={{ WebkitMaskImage: scrollMaskBoth, maskImage: scrollMaskBoth }}
      >
        <div className="h-full overflow-y-auto p-2 space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              아이템 없음
            </div>
          ) : (
            items.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                isPinned={pinnedIds.has(item.id)}
                onTogglePin={onTogglePin}
                onItemSelect={onItemSelect}
                onItemDoubleClick={onItemDoubleClick}
                statusesByProject={statusesByProject}
                onStatusChange={onStatusChange}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function MyWorkKanbanView({ items, pinnedIds, onTogglePin, statusesByProject, onStatusChange, onItemSelect }: MyWorkKanbanViewProps) {
  const grouped: Record<Phase, MyWorkItem[]> = { todo: [], in_progress: [], done: [] }
  const [detailItem, setDetailItem] = useState<MyWorkItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  items.forEach(item => {
    const phase = getPhase(item.status)
    grouped[phase].push(item)
  })

  const handleItemDoubleClick = (item: MyWorkItem) => {
    setDetailItem(item)
    setDetailOpen(true)
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
        {phaseConfig.map(({ phase, color }) => (
          <KanbanColumn
            key={phase}
            phase={phase}
            color={color}
            items={grouped[phase]}
            pinnedIds={pinnedIds}
            onTogglePin={onTogglePin}
            onItemSelect={onItemSelect}
            onItemDoubleClick={handleItemDoubleClick}
            statusesByProject={statusesByProject}
            onStatusChange={onStatusChange}
          />
        ))}
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
