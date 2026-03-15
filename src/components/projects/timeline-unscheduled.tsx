'use client'

import { memo } from 'react'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import CalendarPlus from 'lucide-react/dist/esm/icons/calendar-plus'
import FolderIcon from 'lucide-react/dist/esm/icons/folder'
import Circle from 'lucide-react/dist/esm/icons/circle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical'
import Bot from 'lucide-react/dist/esm/icons/bot'

import { cn } from '@/lib/utils'
import type { WorkItemWithRelations } from '@/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAssigneeDisplay } from '@/lib/assignee-utils'

interface TimelineUnscheduledProps {
  items: WorkItemWithRelations[]
  showTrackerId?: boolean
  projectKey: string
  onSelectItem: (id: string) => void
  onDoubleClickItem?: (id: string) => void
  selectedItemId: string | null
  isCollapsed: boolean
  onToggleCollapse: () => void
  onDragStart?: (item: WorkItemWithRelations, e: React.PointerEvent) => void
  getItemProjectKey?: (item: WorkItemWithRelations) => string
}

function TimelineUnscheduled({
  items,
  showTrackerId = true,
  projectKey,
  onSelectItem,
  onDoubleClickItem,
  selectedItemId,
  isCollapsed,
  onToggleCollapse,
  onDragStart,
  getItemProjectKey,
}: TimelineUnscheduledProps) {

  const getTrackerIcon = (item: WorkItemWithRelations) => {
    if (item.tracker?.name === 'Folder') {
      return <FolderIcon className="h-3.5 w-3.5 text-amber-500" />
    }

    const isClosed = item.status?.is_closed ?? false

    if (isClosed) {
      return (
        <CheckCircle2
          className="h-3.5 w-3.5"
          style={{ color: item.status?.name === 'Rejected' ? '#ef4444' : '#22c55e' }}
        />
      )
    }

    const statusColor = item.status?.color || '#64748b'
    return <Circle className="h-3.5 w-3.5" style={{ color: statusColor }} />
  }

  return (
    <div className="border-t">
      {/* Header */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/5 hover:bg-muted/10 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">일정 미배정</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2">
          {items.length}개
        </span>
        {onDragStart && !isCollapsed && (
          <span className="ml-auto text-[10px] text-muted-foreground/60">
            타임라인으로 드래그
          </span>
        )}
      </button>

      {/* Body */}
      {!isCollapsed && (
        <div className="divide-y">
          {items.map((item) => {
            const isSelected = item.id === selectedItemId

            const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
              // Only drag from the grip handle or the row itself (not buttons)
              if (!onDragStart) return
              e.preventDefault()
              onDragStart(item, e)
            }

            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 transition-colors group',
                  isSelected && 'bg-primary/10',
                  onDragStart ? 'cursor-grab' : 'cursor-pointer hover:bg-muted/50'
                )}
                onClick={() => onSelectItem(item.id)}
                onDoubleClick={() => onDoubleClickItem?.(item.id)}
                onPointerDown={onDragStart ? handlePointerDown : undefined}
              >
                {/* Drag grip handle (shown when onDragStart available) */}
                {onDragStart && (
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 flex-shrink-0" />
                )}

                {/* Tracker Icon */}
                {getTrackerIcon(item)}

                {/* Tracker ID */}
                {showTrackerId && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {(getItemProjectKey?.(item) ?? projectKey)}-{item.number}
                  </span>
                )}

                {/* Title */}
                <span className="text-xs truncate flex-1">{item.title}</span>

                {/* Assignee Avatar (person or agent) */}
                {(() => {
                  const display = getAssigneeDisplay(item)
                  if (!display) return null
                  if (display.isAgent) {
                    return (
                      <div className="flex items-center justify-center h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/30 flex-shrink-0">
                        <Bot className="h-3 w-3 text-violet-500" />
                      </div>
                    )
                  }
                  return (
                    <Avatar className="h-5 w-5">
                      {display.avatar && <AvatarImage src={display.avatar} />}
                      <AvatarFallback className="text-[10px]">
                        {display.name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                  )
                })()}

                {/* Date Set Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectItem(item.id)
                  }}
                  onPointerDown={(e) => e.stopPropagation()} // don't trigger drag from button
                  className="flex items-center gap-1 text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  날짜 설정
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default memo(TimelineUnscheduled)
