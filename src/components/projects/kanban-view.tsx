'use client'

import { useState, useRef, useOptimistic, useTransition, useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { scrollMaskBoth, cardVariants } from '@/lib/motion'
import { type Selection } from './alm-layout'
import { updateWorkItemStatus } from '@/app/(dashboard)/projects/[key]/actions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { WorkItemDetailDialog } from './work-item-detail-dialog'
import Circle from 'lucide-react/dist/esm/icons/circle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Folder from 'lucide-react/dist/esm/icons/folder'
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
import type {
  WorkItemWithRelations,
  StatusRef,
  TrackerRef,
  PersonRef,
  LinkedIssueStatus,

} from '@/types/database'


interface KanbanViewProps {
  projectId: string
  projectKey: string
  workItems: WorkItemWithRelations[]
  statuses: StatusRef[]
  trackers: TrackerRef[]
  members: PersonRef[]
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  linkedIssueStatuses?: LinkedIssueStatus[]
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

// Kanban Card (draggable)
const KanbanCard = memo(function KanbanCard({
  item,
  projectKey,
  linkedIssueStatus,
  isSelected,
  onSelect,
  onOpenDetail,
}: {
  item: WorkItemWithRelations
  projectKey: string
  linkedIssueStatus?: LinkedIssueStatus
  isSelected: boolean
  onSelect: () => void
  onOpenDetail: () => void
}) {
  const didDragRef = useRef(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // 드래그 시작 시 플래그 설정
  const wrappedListeners = {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      didDragRef.current = false
      listeners?.onPointerDown?.(e)
    },
    onPointerMove: (e: React.PointerEvent) => {
      didDragRef.current = true
      listeners?.onPointerMove?.(e)
    },
  }

  const handleShareLink = async () => {
    const url = `${window.location.origin}/projects/${projectKey}/alm?item=${item.id}`
    await navigator.clipboard.writeText(url)
    toast.success('링크가 복사되었습니다')
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          ref={setNodeRef}
          style={style}
          layout
          initial="initial"
          animate="animate"
          exit="exit"
          variants={cardVariants}
          {...attributes}
          {...wrappedListeners}
          className={cn(isDragging && 'opacity-50')}
        >
          <motion.div
            whileHover={isDragging ? undefined : { y: -2, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => {
              e.stopPropagation()
              if (didDragRef.current) return
              onSelect()
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onOpenDetail()
            }}
            className={cn(
              'group rounded-lg border bg-background p-3 shadow-sm cursor-grab active:cursor-grabbing',
              isSelected && 'ring-2 ring-primary',
            )}
          >
            {/* Top row: tracker icon + number */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrackerIcon tracker={item.tracker} status={item.status} />
              <span className="text-xs font-mono text-muted-foreground">{projectKey}-{item.number}</span>
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
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
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenDetail() }}>
                    <Eye className="h-4 w-4 mr-2" />
                    상세 보기
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {linkedIssueStatus && (
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: linkedIssueStatus.worst_status_color }}
                  title={linkedIssueStatus.worst_status_name}
                />
              )}
            </div>

            {/* Title */}
            <p className="text-sm font-medium line-clamp-2 mb-2">{item.title}</p>

            {/* Bottom row: assignee */}
            {item.assignee && (
              <div className="flex items-center gap-1.5">
                <Avatar size="sm">
                  <AvatarImage src={item.assignee.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(item.assignee.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate">
                  {item.assignee.full_name || '이름 없음'}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleShareLink}>
          <Link2 className="h-4 w-4 mr-2" />
          링크 복사
        </ContextMenuItem>
        <ContextMenuItem onClick={onOpenDetail}>
          <Eye className="h-4 w-4 mr-2" />
          상세 보기
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

// Drag overlay card (non-interactive copy)
function KanbanCardOverlay({
  item,
  projectKey,
  linkedIssueStatus,
}: {
  item: WorkItemWithRelations
  projectKey: string
  linkedIssueStatus?: LinkedIssueStatus
}) {
  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: 1.03, rotate: 0.5, boxShadow: '0 16px 32px rgba(0,0,0,0.15)' }}
      className="rounded-lg border bg-background p-3 shadow-lg w-[260px]"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <TrackerIcon tracker={item.tracker} status={item.status} />
        <span className="text-xs font-mono text-muted-foreground">{projectKey}-{item.number}</span>
        <div className="flex-1" />
        {linkedIssueStatus && (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: linkedIssueStatus.worst_status_color }}
            title={linkedIssueStatus.worst_status_name}
          />
        )}
      </div>
      <p className="text-sm font-medium line-clamp-2 mb-2">{item.title}</p>
      {item.assignee && (
        <div className="flex items-center gap-1.5">
          <Avatar size="sm">
            <AvatarImage src={item.assignee.avatar_url || undefined} />
            <AvatarFallback className="text-[10px]">
              {getInitials(item.assignee.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {item.assignee.full_name || '이름 없음'}
          </span>
        </div>
      )}
    </motion.div>
  )
}

// Kanban Column (droppable)
const KanbanColumn = memo(function KanbanColumn({
  status,
  items,
  projectKey,
  linkedIssueStatusMap,
  selection,
  onSelectionChange,
  onOpenDetail,
  isOver,
}: {
  status: StatusRef
  items: WorkItemWithRelations[]
  projectKey: string
  linkedIssueStatusMap: Map<string, LinkedIssueStatus>
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  onOpenDetail: (item: WorkItemWithRelations) => void
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: status.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[280px] max-w-[320px] flex-shrink-0 rounded-lg border bg-muted/30 h-full',
        isOver && 'bg-primary/5 border-primary/30'
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b flex-shrink-0">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: status.color || '#94a3b8' }}
        />
        <span className="text-sm font-medium truncate">{status.name}</span>
        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <div
        className="flex-1 overflow-hidden"
        style={{ WebkitMaskImage: scrollMaskBoth, maskImage: scrollMaskBoth }}
      >
      <div className="h-full overflow-y-auto p-2 space-y-2" data-kanban-bg>
        {items.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground" data-kanban-bg>
            아이템 없음
          </div>
        ) : (
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  projectKey={projectKey}
                  linkedIssueStatus={linkedIssueStatusMap.get(item.id)}
                  isSelected={
                    selection.type === 'workitem' &&
                    (selection.id === item.id || (selection.ids?.has(item.id) ?? false))
                  }
                  onSelect={() =>
                    onSelectionChange({
                      type: 'workitem',
                      id: item.id,
                      ids: new Set([item.id]),
                      lastSelectedId: item.id,
                    })
                  }
                  onOpenDetail={() => onOpenDetail(item)}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
        )}
      </div>
      </div>
    </div>
  )
})


export default function KanbanView({
  projectId,
  projectKey,
  workItems,
  statuses,
  selection,
  onSelectionChange,
  linkedIssueStatuses,
}: KanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<WorkItemWithRelations | null>(null)

  // Optimistic UI for card movement
  const [optimisticItems, addOptimisticUpdate] = useOptimistic(
    workItems,
    (current: WorkItemWithRelations[], action: { itemId: string; newStatusId: string }) =>
      current.map((item) =>
        item.id === action.itemId
          ? {
              ...item,
              status_id: action.newStatusId,
              status: statuses.find((s) => s.id === action.newStatusId) ?? item.status,
            }
          : item
      )
  )
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  // Sort statuses by position (메모이제이션)
  const sortedStatuses = useMemo(
    () => statuses.toSorted((a, b) => a.position - b.position),
    [statuses]
  )

  // 연결된 이슈 worst status → Map (work_item_id → LinkedIssueStatus)
  const linkedIssueStatusMap = useMemo(
    () => new Map((linkedIssueStatuses ?? []).map(s => [s.work_item_id, s])),
    [linkedIssueStatuses]
  )

  // Group items by status_id (flat, ignoring parent_id) (메모이제이션)
  const itemsByStatus = useMemo(
    () => sortedStatuses.reduce(
      (acc, status) => {
        acc[status.id] = optimisticItems
          .filter((item) => item.status_id === status.id && item.tracker.name !== 'Folder')
          .toSorted((a, b) => a.position - b.position)
        return acc
      },
      {} as Record<string, WorkItemWithRelations[]>
    ),
    [sortedStatuses, optimisticItems]
  )

  const activeItem = activeId ? optimisticItems.find((w) => w.id === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: { over: { id: string | number } | null }) => {
    if (!event.over) {
      setOverColumnId(null)
      return
    }

    const overId = String(event.over.id)

    // Check if over a status column
    if (statuses.some((s) => s.id === overId)) {
      setOverColumnId(overId)
    } else {
      // Over a card - find which column it belongs to
      const overItem = optimisticItems.find((w) => w.id === overId)
      if (overItem?.status_id) {
        setOverColumnId(overItem.status_id)
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverColumnId(null)

    if (!over) return

    const draggedItem = optimisticItems.find((w) => w.id === active.id)
    if (!draggedItem) return

    const overId = String(over.id)

    // Determine the target status
    let targetStatusId: string | null = null

    // Dropped on a status column
    if (statuses.some((s) => s.id === overId)) {
      targetStatusId = overId
    } else {
      // Dropped on a card - use that card's status
      const overItem = optimisticItems.find((w) => w.id === overId)
      if (overItem?.status_id) {
        targetStatusId = overItem.status_id
      }
    }

    if (!targetStatusId || targetStatusId === draggedItem.status_id || !draggedItem.status) return

    // Optimistic update + server action
    startTransition(async () => {
      addOptimisticUpdate({ itemId: draggedItem.id, newStatusId: targetStatusId })
      const result = await updateWorkItemStatus(draggedItem.id, targetStatusId, projectId)
      if (result?.error) {
        toast.error('상태 변경에 실패했습니다.')
      }
    })
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setOverColumnId(null)
  }

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 카드 또는 다른 인터랙티브 요소 클릭이 아닌 빈 영역 클릭 시 선택 해제
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-kanban-bg]')) {
      onSelectionChange({ type: null, id: null, ids: new Set(), lastSelectedId: null })
    }
  }

  return (
    <div className="h-full" onClick={handleBackgroundClick}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 px-4 pb-4 pt-2 h-full overflow-x-auto" data-kanban-bg>
          {sortedStatuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              items={itemsByStatus[status.id] || []}
              projectKey={projectKey}
              linkedIssueStatusMap={linkedIssueStatusMap}
              selection={selection}
              onSelectionChange={onSelectionChange}
              onOpenDetail={(item) => setDetailItem(item)}
              isOver={overColumnId === status.id}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem && (
            <KanbanCardOverlay
              item={activeItem}
              projectKey={projectKey}
              linkedIssueStatus={linkedIssueStatusMap.get(activeItem.id)}
            />
          )}
        </DragOverlay>
      </DndContext>

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
