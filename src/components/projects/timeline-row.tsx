'use client'

import React from 'react'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import FolderIcon from 'lucide-react/dist/esm/icons/folder'
import Circle from 'lucide-react/dist/esm/icons/circle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'

import { cn } from '@/lib/utils'
import type { WorkItemWithRelations } from '@/types/database'
import { ROW_HEIGHT } from '@/hooks/use-timeline-state'

interface TimelineRowLabelProps {
  item: WorkItemWithRelations
  level: number
  isExpanded: boolean
  hasChildren: boolean
  isSelected: boolean
  onToggleExpand: (id: string) => void
  onClick: (id: string) => void
  onDoubleClick?: (id: string) => void
  showTrackerId?: boolean
  projectKey: string
  itemProjectKey?: string
}

const TimelineRowLabel = React.memo<TimelineRowLabelProps>(({
  item,
  level,
  isExpanded,
  hasChildren,
  isSelected,
  onToggleExpand,
  onClick,
  onDoubleClick,
  showTrackerId = true,
  projectKey,
  itemProjectKey,
}) => {
  const paddingLeft = level * 16 + 8

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand(item.id)
  }

  const handleClick = () => {
    onClick(item.id)
  }

  // Determine icon
  const isFolder = item.tracker?.name === 'Folder'
  const isClosed = item.status?.is_closed ?? false
  const statusColor = item.status?.color ?? '#94a3b8'

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 border-b border-border cursor-pointer transition-colors',
        isSelected && 'bg-primary/10',
        'hover:bg-muted/50'
      )}
      style={{ height: ROW_HEIGHT, paddingLeft }}
      onClick={handleClick}
      onDoubleClick={() => onDoubleClick?.(item.id)}
    >
      {/* Expand/collapse button or spacer */}
      {hasChildren ? (
        <button
          className="flex items-center justify-center w-4 h-4 hover:bg-muted rounded-sm transition-colors"
          onClick={handleToggleExpand}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      ) : (
        <div className="w-4" />
      )}

      {/* Tracker icon */}
      <div className="flex-shrink-0">
        {isFolder ? (
          <FolderIcon className="w-3.5 h-3.5 text-amber-500" />
        ) : isClosed ? (
          <CheckCircle2
            className="w-3.5 h-3.5"
            style={{ color: item.status?.name === 'Rejected' ? '#ef4444' : '#22c55e' }}
          />
        ) : (
          <Circle className="w-3.5 h-3.5" style={{ fill: statusColor, color: statusColor }} />
        )}
      </div>

      {/* Tracker ID */}
      {showTrackerId && (
        <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
          {itemProjectKey ?? projectKey}-{item.number}
        </span>
      )}

      {/* Title */}
      <span className="text-xs truncate flex-1 min-w-0">
        {item.title}
      </span>
    </div>
  )
})

TimelineRowLabel.displayName = 'TimelineRowLabel'

export default TimelineRowLabel
