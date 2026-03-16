'use client'

import React from 'react'
import { eachDayOfInterval, isWeekend } from 'date-fns'
import type { ZoomLevel } from '@/hooks/use-timeline-state'

interface TimelineGridProps {
  totalWidth: number
  totalHeight: number
  pxPerDay: number
  zoomLevel: ZoomLevel
  todayX: number
  dateRange: { start: Date; end: Date }
  dateToX: (date: Date) => number
}

const TimelineGrid = React.memo<TimelineGridProps>(({
  totalWidth,
  totalHeight,
  pxPerDay,
  zoomLevel,
  todayX,
  dateRange,
  dateToX,
}) => {
  // Calculate cell width based on zoom level
  const cellWidth =
    zoomLevel === 'hour'
      ? pxPerDay / 24
      : zoomLevel === 'day'
        ? pxPerDay
        : zoomLevel === 'week'
          ? pxPerDay * 7
          : pxPerDay * 30

  // Calculate weekend shading
  const weekendRanges = React.useMemo(() => {
    if (zoomLevel !== 'day' && zoomLevel !== 'hour') return []

    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end })
    return days.filter((d) => isWeekend(d)).map((day) => ({
      left: dateToX(day),
      width: zoomLevel === 'hour' ? pxPerDay : cellWidth,
    }))
  }, [zoomLevel, dateRange.start, dateRange.end, dateToX, pxPerDay, cellWidth])

  // Check if today marker should be visible
  const showTodayMarker = todayX >= 0 && todayX <= totalWidth

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        width: totalWidth,
        height: totalHeight,
        backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${cellWidth - 1}px, hsl(var(--border)) ${cellWidth - 1}px, hsl(var(--border)) ${cellWidth}px)`,
        backgroundSize: `${cellWidth}px 100%`,
      }}
    >
      {/* Weekend shading (day zoom only) */}
      {weekendRanges.map((range, idx) => (
        <div
          key={idx}
          className="absolute top-0 bottom-0 bg-muted/20"
          style={{
            left: range.left,
            width: range.width,
          }}
        />
      ))}

      {/* Today marker */}
      {showTodayMarker && (
        <>
          {/* Red vertical line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500/70"
            style={{ left: todayX }}
          />

          {/* "Today" label */}
          <div
            className="absolute top-1 bg-red-500 text-white rounded px-1 text-[9px] font-medium"
            style={{ left: todayX + 4 }}
          >
            Today
          </div>
        </>
      )}
    </div>
  )
})

TimelineGrid.displayName = 'TimelineGrid'

export default TimelineGrid
