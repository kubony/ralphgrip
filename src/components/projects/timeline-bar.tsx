'use client'

import React, { useRef, useCallback, useState } from 'react'
import { parseISO, isBefore, startOfDay, format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { WorkItemWithRelations } from '@/types/database'
import { getAssigneeDisplay } from '@/lib/assignee-utils'
import {
  redateWorkItemDateTime,
  shiftWorkItemDateTimeByMilliseconds,
} from '@/lib/work-item-datetime'
import { ROW_HEIGHT, BAR_HEIGHT } from '@/hooks/use-timeline-state'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Diamond from 'lucide-react/dist/esm/icons/diamond'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'

interface TimelineBarProps {
  item: WorkItemWithRelations
  dateToX: (date: Date) => number
  xToDate: (x: number) => Date
  pxPerDay: number
  snapMs?: number
  rowIndex: number
  isSelected: boolean
  onClick: (id: string) => void
  onDoubleClick: (id: string) => void
  onDragEnd: (id: string, newStart: string | null, newEnd: string | null, mode: 'target' | 'actual') => void
  dateMode: 'target' | 'actual'
  onDragMove?: (id: string, newStart: string | null, newEnd: string | null) => void
  childrenDateRange?: { minStart: string | null; maxEnd: string | null } | null
}

const PRIORITY_COLORS: Record<number, string> = {
  0: 'transparent',
  1: '#3b82f6', // blue
  2: '#eab308', // yellow
  3: '#f97316', // orange
  4: '#ef4444', // red
}

const FOLDER_BAR_HEIGHT = 4
const AVATAR_SIZE = 16
const DAY_MS = 24 * 60 * 60 * 1000

function AssigneeAvatar({ assignee }: { assignee: { name: string | null; avatar: string | null; isAgent: boolean } }) {
  const initials = assignee.name?.charAt(0)?.toUpperCase() || '?'

  if (assignee.isAgent) {
    return (
      <div
        className="rounded-full flex-shrink-0 flex items-center justify-center bg-violet-200/60 dark:bg-violet-800/40 ring-1 ring-violet-300/50"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        title={assignee.name || 'Agent'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600 dark:text-violet-300"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
      </div>
    )
  }

  if (assignee.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={assignee.avatar}
        alt=""
        className="rounded-full flex-shrink-0 ring-1 ring-white/50"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center bg-white/30 text-[9px] font-medium text-gray-800 dark:bg-black/30 dark:text-gray-200 ring-1 ring-white/30"
      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
    >
      {initials}
    </div>
  )
}

const TimelineBar = React.memo<TimelineBarProps>(function TimelineBar({
  item,
  dateToX,
  xToDate,
  pxPerDay,
  snapMs = DAY_MS,
  rowIndex,
  isSelected,
  onClick,
  onDoubleClick,
  onDragEnd,
  dateMode,
  onDragMove,
  childrenDateRange,
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    active: boolean
    type: 'move' | 'resize-start' | 'resize-end'
    startX: number
    startLeft: number
    startWidth: number
    originalStart: string | null
    originalDue: string | null
  } | null>(null)

  const [hoverZone, setHoverZone] = useState<'left' | 'right' | 'center' | null>(null)
  const [dragTooltip, setDragTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  // Track last emitted drag-move dates to avoid redundant calls
  const lastEmittedRef = useRef<{ start: string | null; end: string | null }>({ start: null, end: null })

  // Active fields depend on dateMode — main bar uses active, reference bar uses opposite
  const activeStartDate = dateMode === 'target' ? item.start_date : (item.actual_start_date ?? null)
  const activeEndDate = dateMode === 'target' ? item.due_date : (item.actual_end_date ?? null)
  const refStartDate = dateMode === 'target' ? (item.actual_start_date ?? null) : item.start_date
  const refEndDate = dateMode === 'target' ? (item.actual_end_date ?? null) : item.due_date

  const hasStart = !!activeStartDate
  const hasDue = !!activeEndDate
  const isFolder = item.tracker?.name === 'Folder'
  const stepPx = Math.max((snapMs / DAY_MS) * pxPerDay, 1)
  const minBarWidth = Math.max(stepPx, 10)
  const isSubDayPrecision = snapMs < DAY_MS

  const today = startOfDay(new Date())
  const isOverdue =
    hasDue &&
    isBefore(parseISO(activeEndDate!), today) &&
    !(item.status?.is_closed ?? false)

  const hasBothDates = hasStart && hasDue

  // #3: Data error - start_date > due_date
  const isInvalidRange =
    hasBothDates && isBefore(parseISO(activeEndDate!), parseISO(activeStartDate!))

  // Calculate position using active date fields
  const left = hasStart ? dateToX(parseISO(activeStartDate!)) : 0
  const width = hasBothDates
    ? Math.max(dateToX(parseISO(activeEndDate!)) - left, minBarWidth)
    : hasDue
      ? 0
      : hasStart
        ? Math.max(3 * stepPx, pxPerDay / 2)
        : 0

  // Zone B-2: diamond position (hoisted for use in drag handler)
  const diamondX = !hasStart && hasDue ? dateToX(parseISO(activeEndDate!)) + stepPx / 2 : 0

  const barHeight = isFolder ? FOLDER_BAR_HEIGHT : BAR_HEIGHT
  const top = rowIndex * ROW_HEIGHT + (ROW_HEIGHT - barHeight) / 2

  const statusColor = item.status?.color || '#94a3b8'
  const priorityColor = PRIORITY_COLORS[item.priority || 0]
  const timelineTitle = activeStartDate && activeEndDate
    ? `${item.title}\n${format(parseISO(activeStartDate), 'M/d HH:mm:ss')} → ${format(parseISO(activeEndDate), 'M/d HH:mm:ss')}`
    : activeStartDate
      ? `${item.title}\n시작: ${format(parseISO(activeStartDate), 'M/d HH:mm:ss')}`
      : activeEndDate
        ? `${item.title}\n마감: ${format(parseISO(activeEndDate), 'M/d HH:mm:ss')}`
        : item.title

  // Compute tooltip text from drag state — uses dragRef for resize positions
  const computeTooltipText = useCallback(
    (type: 'move' | 'resize-start' | 'resize-end', deltaX: number, originalStart: string | null, originalDue: string | null) => {
      const startLeft = dragRef.current?.startLeft ?? 0
      const startWidth = dragRef.current?.startWidth ?? 0

      if (type === 'move') {
        const deltaSteps = Math.round(deltaX / stepPx)
        const deltaMs = deltaSteps * snapMs
        if (originalStart && originalDue) {
          const s = shiftWorkItemDateTimeByMilliseconds(originalStart, deltaMs)
          const d = shiftWorkItemDateTimeByMilliseconds(originalDue, deltaMs)
          if (s && d) return `${format(parseISO(s), 'M/d HH:mm:ss')} → ${format(parseISO(d), 'M/d HH:mm:ss')}`
        } else if (originalStart) {
          const s = shiftWorkItemDateTimeByMilliseconds(originalStart, deltaMs)
          if (s) return `시작: ${format(parseISO(s), 'M/d HH:mm:ss')}`
        } else if (originalDue) {
          const d = shiftWorkItemDateTimeByMilliseconds(originalDue, deltaMs)
          if (d) return `마감: ${format(parseISO(d), 'M/d HH:mm:ss')}`
        }
      } else if (type === 'resize-start') {
        const newDate = xToDate(startLeft + deltaX)
        const next = isSubDayPrecision
          ? format(newDate, "yyyy-MM-dd'T'HH:mm:ss")
          : redateWorkItemDateTime(originalStart, newDate)
        return `시작: ${format(parseISO(next), 'M/d HH:mm:ss')}`
      } else {
        const newDate = xToDate(startLeft + startWidth + deltaX)
        const next = isSubDayPrecision
          ? format(newDate, "yyyy-MM-dd'T'HH:mm:ss")
          : redateWorkItemDateTime(originalDue, newDate, { hours: 23, minutes: 59, seconds: 59 })
        return `마감: ${format(parseISO(next), 'M/d HH:mm:ss')}`
      }
      return ''
    },
    [isSubDayPrecision, snapMs, stepPx, xToDate]
  )

  // Compute tentative dates from drag delta — shared by handlePointerMove and handlePointerUp
  const computeTentativeDates = useCallback(
    (type: 'move' | 'resize-start' | 'resize-end', deltaX: number, originalStart: string | null, originalDue: string | null) => {
      const startLeft = dragRef.current?.startLeft ?? 0
      const startWidth = dragRef.current?.startWidth ?? 0

      let newStart = originalStart
      let newEnd = originalDue

      if (type === 'move') {
        const deltaSteps = Math.round(deltaX / stepPx)
        const deltaMs = deltaSteps * snapMs
        if (deltaMs !== 0) {
          if (originalStart) newStart = shiftWorkItemDateTimeByMilliseconds(originalStart, deltaMs)
          if (originalDue) newEnd = shiftWorkItemDateTimeByMilliseconds(originalDue, deltaMs)
        }
      } else if (type === 'resize-start') {
        const newDate = xToDate(startLeft + deltaX)
        newStart = isSubDayPrecision
          ? format(newDate, "yyyy-MM-dd'T'HH:mm:ss")
          : redateWorkItemDateTime(originalStart, newDate)
      } else if (type === 'resize-end') {
        const newDate = xToDate(startLeft + startWidth + deltaX)
        newEnd = isSubDayPrecision
          ? format(newDate, "yyyy-MM-dd'T'HH:mm:ss")
          : redateWorkItemDateTime(originalDue, newDate, { hours: 23, minutes: 59, seconds: 59 })
      }

      return { start: newStart, end: newEnd }
    },
    [isSubDayPrecision, snapMs, stepPx, xToDate]
  )

  // Clamp folder dates so they can't shrink below children range
  const clampFolderDates = useCallback(
    (start: string | null, end: string | null): { start: string | null; end: string | null } => {
      if (!isFolder || !childrenDateRange) return { start, end }
      const { minStart, maxEnd } = childrenDateRange
      let cStart = start
      let cEnd = end
      // Can't shrink start past children's earliest
      if (cStart && minStart && cStart > minStart) cStart = minStart
      // Can't shrink end before children's latest
      if (cEnd && maxEnd && cEnd < maxEnd) cEnd = maxEnd
      return { start: cStart, end: cEnd }
    },
    [isFolder, childrenDateRange]
  )

  // Unified pointer down for Zone A (both dates) and Zone B-1 (start only)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const offsetX = e.clientX - rect.left

      let type: 'move' | 'resize-start' | 'resize-end' = 'move'

      // Resize handles only available when both dates present
      if (hasBothDates) {
        if (offsetX <= 6) {
          type = 'resize-start'
        } else if (offsetX >= rect.width - 6) {
          type = 'resize-end'
        }
      }

      e.currentTarget.setPointerCapture(e.pointerId)

      dragRef.current = {
        active: true,
        type,
        startX: e.clientX,
        startLeft: left,
        startWidth: width,
        originalStart: activeStartDate,
        originalDue: activeEndDate,
      }
      lastEmittedRef.current = { start: null, end: null }

      e.preventDefault()
      e.stopPropagation()
    },
    [hasBothDates, activeStartDate, activeEndDate, left, width]
  )

  // Pointer down specifically for Zone B-2 (due only diamond)
  const handleDiamondPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)

      lastEmittedRef.current = { start: null, end: null }
      dragRef.current = {
        active: true,
        type: 'move',
        startX: e.clientX,
        startLeft: diamondX - 6,
        startWidth: 12,
        originalStart: null,
        originalDue: activeEndDate,
      }

      e.preventDefault()
      e.stopPropagation()
    },
    [diamondX, activeEndDate]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current?.active || !barRef.current) return

      const deltaX = e.clientX - dragRef.current.startX
      const { type, startLeft, startWidth, originalStart, originalDue } = dragRef.current

      if (type === 'move') {
        barRef.current.style.left = `${startLeft + deltaX}px`
      } else if (type === 'resize-start') {
        const newLeft = startLeft + deltaX
        const newWidth = startWidth - deltaX
        if (newWidth >= minBarWidth) {
          barRef.current.style.left = `${newLeft}px`
          barRef.current.style.width = `${newWidth}px`
        }
      } else if (type === 'resize-end') {
        const newWidth = startWidth + deltaX
        if (newWidth >= minBarWidth) {
          barRef.current.style.width = `${newWidth}px`
        }
      }

      // Drag tooltip
      const text = computeTooltipText(type, deltaX, originalStart, originalDue)
      setDragTooltip({ x: e.clientX, y: e.clientY, text })

      // Emit drag move for ancestor folder auto-adjustment
      if (onDragMove) {
        const tentative = computeTentativeDates(type, deltaX, originalStart, originalDue)
        const clamped = clampFolderDates(tentative.start, tentative.end)
        if (clamped.start !== lastEmittedRef.current.start || clamped.end !== lastEmittedRef.current.end) {
          lastEmittedRef.current = clamped
          onDragMove(item.id, clamped.start, clamped.end)
        }
      }

      e.preventDefault()
      e.stopPropagation()
    },
    [computeTooltipText, onDragMove, computeTentativeDates, clampFolderDates, item.id, minBarWidth]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current?.active || !barRef.current) return

      const deltaX = e.clientX - dragRef.current.startX
      const { type, originalStart, originalDue, startLeft, startWidth } = dragRef.current

      let newStart = originalStart
      let newDue = originalDue

      if (type === 'move') {
        const deltaSteps = Math.round(deltaX / stepPx)
        const deltaMs = deltaSteps * snapMs
        if (deltaMs !== 0) {
          if (originalStart && originalDue) {
            newStart = shiftWorkItemDateTimeByMilliseconds(originalStart, deltaMs)
            newDue = shiftWorkItemDateTimeByMilliseconds(originalDue, deltaMs)
          } else if (originalStart && !originalDue) {
            newStart = shiftWorkItemDateTimeByMilliseconds(originalStart, deltaMs)
          } else if (!originalStart && originalDue) {
            newDue = shiftWorkItemDateTimeByMilliseconds(originalDue, deltaMs)
          }
        }
      } else if (type === 'resize-start') {
        const newDate = xToDate(startLeft + deltaX)
        newStart = isSubDayPrecision
          ? format(newDate, "yyyy-MM-dd'T'HH:mm:ss")
          : redateWorkItemDateTime(originalStart, newDate)
      } else if (type === 'resize-end') {
        const newDate = xToDate(startLeft + startWidth + deltaX)
        newDue = isSubDayPrecision
          ? format(newDate, "yyyy-MM-dd'T'HH:mm:ss")
          : redateWorkItemDateTime(originalDue, newDate, { hours: 23, minutes: 59, seconds: 59 })
      }

      // Apply folder clamping on final values
      const clamped = clampFolderDates(newStart, newDue)
      newStart = clamped.start
      newDue = clamped.end

      // 변경이 없을 때만 CSS 리셋 (변경 있을 때는 드래그 중 CSS 상태 유지 → React가 새 위치로 렌더링)
      if (newStart === originalStart && newDue === originalDue) {
        barRef.current.style.left = `${startLeft}px`
        barRef.current.style.width = `${startWidth}px`
      }

      dragRef.current = null
      setDragTooltip(null)

      if (newStart !== originalStart || newDue !== originalDue) {
        onDragEnd(item.id, newStart, newDue, dateMode)
      } else {
        onClick(item.id)
      }

      e.preventDefault()
      e.stopPropagation()
    },
    [clampFolderDates, dateMode, isSubDayPrecision, item.id, onClick, onDragEnd, snapMs, stepPx, xToDate]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!hasBothDates || dragRef.current?.active) return

      const rect = e.currentTarget.getBoundingClientRect()
      const offsetX = e.clientX - rect.left

      if (offsetX <= 6) {
        setHoverZone('left')
      } else if (offsetX >= rect.width - 6) {
        setHoverZone('right')
      } else {
        setHoverZone('center')
      }
    },
    [hasBothDates]
  )

  const handleMouseLeave = useCallback(() => {
    if (!dragRef.current?.active) {
      setHoverZone(null)
    }
  }, [])

  const getCursor = () => {
    if (!hasStart && !hasDue) return 'cursor-pointer'
    if (!hasBothDates) return 'cursor-grab' // partial dates — move only
    if (hoverZone === 'left' || hoverZone === 'right') return 'cursor-col-resize'
    if (hoverZone === 'center') return 'cursor-grab'
    return 'cursor-pointer'
  }

  // Zone B-2: Due date only (milestone diamond) — draggable
  if (!hasStart && hasDue) {
    return (
      <>
        <div
          ref={barRef}
          data-bar-id={item.id}
          className="absolute flex items-center justify-center cursor-grab select-none"
          title={timelineTitle}
          style={{
            left: diamondX - 6,
            top: rowIndex * ROW_HEIGHT + (ROW_HEIGHT - 12) / 2,
            width: 12,
            height: 12,
          }}
          onPointerDown={handleDiamondPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={() => onDoubleClick(item.id)}
        >
          <Diamond
            size={12}
            className="rotate-0"
            style={{ color: statusColor, fill: statusColor }}
          />
        </div>

        {/* Drag tooltip */}
        {dragTooltip && (
          <div
            className="fixed z-50 bg-popover text-popover-foreground border rounded px-2 py-1 text-xs shadow-md pointer-events-none"
            style={{
              left: dragTooltip.x + 12,
              top: dragTooltip.y - 28,
            }}
          >
            {dragTooltip.text}
          </div>
        )}
      </>
    )
  }

  // Zone B-1: Start date only (open-ended arrow) — draggable (move only)
  if (hasStart && !hasDue) {
    return (
      <>
        <div
          ref={barRef}
          data-bar-id={item.id}
          className={cn(
            'absolute rounded-l border border-dashed flex items-center px-2 text-xs select-none',
             
            getCursor(),
            isSelected && 'ring-2 ring-blue-500'
          )}
          title={timelineTitle}
          style={{
            left,
            width,
            top,
            height: barHeight,
            backgroundColor: `${statusColor}4D`, // 30% opacity
            borderColor: statusColor,
            borderLeftWidth: 3,
            borderLeftColor: priorityColor,
            borderLeftStyle: 'solid',
            borderRight: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={() => onDoubleClick(item.id)}
        >
          <span className="truncate text-gray-700 dark:text-gray-200 flex-1 min-w-0">{item.title}</span>
          {(() => { const d = getAssigneeDisplay(item); return d ? <AssigneeAvatar assignee={d} /> : null })()}
          <ArrowRight size={14} className="flex-shrink-0 ml-1" style={{ color: statusColor }} />
        </div>

        {/* Drag tooltip */}
        {dragTooltip && (
          <div
            className="fixed z-50 bg-popover text-popover-foreground border rounded px-2 py-1 text-xs shadow-md pointer-events-none"
            style={{
              left: dragTooltip.x + 12,
              top: dragTooltip.y - 28,
            }}
          >
            {dragTooltip.text}
          </div>
        )}
      </>
    )
  }

  // Reference bar — shows the opposite date fields (target ↔ actual)
  const hasRefStart = !!refStartDate
  const hasRefEnd = !!refEndDate
  const hasAnyRef = hasRefStart || hasRefEnd

  const refLeft = hasRefStart
    ? dateToX(parseISO(refStartDate!))
    : hasRefEnd
      ? dateToX(parseISO(refEndDate!)) - stepPx
      : 0

  const refWidth =
    hasRefStart && hasRefEnd
      ? Math.max(dateToX(parseISO(refEndDate!)) - refLeft, minBarWidth)
      : minBarWidth

  // Zone A: Both dates (normal bar or folder summary)
  if (hasBothDates) {
    // Folder summary bar with brackets — draggable
    if (isFolder) {
      const bracketSize = 6
      return (
        <>
          <div
            ref={barRef}
            data-bar-id={item.id}
          className={cn(
            'absolute select-none',
             
            getCursor(),
            isSelected && 'ring-2 ring-blue-500'
          )}
            title={timelineTitle}
            style={{
              left,
              width,
              top: rowIndex * ROW_HEIGHT + (ROW_HEIGHT - bracketSize * 2) / 2,
              height: bracketSize * 2,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={() => onDoubleClick(item.id)}
          >
            {/* Center line */}
            <div
              className="absolute bg-amber-500/60"
              style={{
                left: 0,
                right: 0,
                top: bracketSize - FOLDER_BAR_HEIGHT / 2,
                height: FOLDER_BAR_HEIGHT,
              }}
            />
            {/* Left bracket */}
            <div
              className="absolute border-l-2 border-b-2 border-amber-500/80"
              style={{
                left: 0,
                top: 0,
                width: bracketSize,
                height: bracketSize * 2,
                borderBottomLeftRadius: 2,
              }}
            />
            {/* Right bracket */}
            <div
              className="absolute border-r-2 border-b-2 border-amber-500/80"
              style={{
                right: 0,
                top: 0,
                width: bracketSize,
                height: bracketSize * 2,
                borderBottomRightRadius: 2,
              }}
            />
          </div>

          {/* Drag tooltip */}
          {dragTooltip && (
            <div
              className="fixed z-50 bg-popover text-popover-foreground border rounded px-2 py-1 text-xs shadow-md pointer-events-none"
              style={{
                left: dragTooltip.x + 12,
                top: dragTooltip.y - 28,
              }}
            >
              {dragTooltip.text}
            </div>
          )}
        </>
      )
    }

    // Normal bar
    const showText = width > 60

    return (
      <>
        <div
          ref={barRef}
          data-bar-id={item.id}
          className={cn(
            'absolute rounded flex items-center px-2 text-xs select-none',
             
            getCursor(),
            isSelected && 'ring-2 ring-blue-500',
            isInvalidRange && 'border-2 border-dashed border-red-500',
            !isInvalidRange && isOverdue && 'border-2 border-red-500'
          )}
          title={timelineTitle}
          style={{
            left,
            width,
            top,
            height: barHeight,
            backgroundColor: `${statusColor}BF`, // 75% opacity
            borderLeftWidth: isInvalidRange ? undefined : 3,
            borderLeftColor: isInvalidRange ? undefined : priorityColor,
            borderLeftStyle: isInvalidRange ? undefined : 'solid',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={() => onDoubleClick(item.id)}
        >
          {isInvalidRange && (
            <AlertTriangle size={14} className="mr-1 flex-shrink-0 text-red-500" />
          )}
          {!isInvalidRange && isOverdue && (
            <AlertTriangle size={14} className="mr-1 flex-shrink-0 text-red-500" />
          )}
          {showText && (
            <span className="truncate text-gray-700 dark:text-gray-200 flex-1 min-w-0">{item.title}</span>
          )}
          {!showText && <span className="flex-1" />}
          {(() => { const d = getAssigneeDisplay(item); return d ? <AssigneeAvatar assignee={d} /> : null })()}
        </div>

        {/* 참조 바 (메인 바 아래에 표시 — 반대 모드의 날짜) */}
        {hasAnyRef && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: refLeft,
              width: refWidth,
              top: top + barHeight + 1,
              height: 4,
              backgroundColor: dateMode === 'target' ? '#06b6d4' : '#8b5cf6',
              borderRadius: 1,
            }}
          />
        )}

        {/* Drag tooltip */}
        {dragTooltip && (
          <div
            className="fixed z-50 bg-popover text-popover-foreground border rounded px-2 py-1 text-xs shadow-md pointer-events-none"
            style={{
              left: dragTooltip.x + 12,
              top: dragTooltip.y - 28,
            }}
          >
            {dragTooltip.text}
          </div>
        )}
      </>
    )
  }

  // No dates: render nothing
  return null
})

TimelineBar.displayName = 'TimelineBar'

export default TimelineBar
