import React from 'react'
import type { ZoomLevel } from '@/hooks/use-timeline-state'

interface HeaderMonth {
  date: Date
  label: string
  x: number
  width: number
}

interface HeaderCell {
  date: Date
  label: string
  x: number
  width: number
  isWeekend: boolean
  isToday: boolean
}

interface TimelineHeaderProps {
  headerMonths: HeaderMonth[]
  headerCells: HeaderCell[]
  zoomLevel: ZoomLevel
  totalWidth: number
}

const TimelineHeader = React.memo<TimelineHeaderProps>(({
  headerMonths,
  headerCells,
  zoomLevel,
  totalWidth
}) => {
  return (
    <div data-zoom-level={zoomLevel} style={{ width: totalWidth, position: 'relative' }}>
      {/* Top row: months - height 24px */}
      <div className="relative h-6 border-b bg-background">
        {headerMonths.map((month) => (
          <div
            key={`month-${month.date.getTime()}`}
            className="absolute flex items-center justify-center border-r text-xs font-medium text-muted-foreground"
            style={{
              left: month.x,
              width: month.width,
              height: '100%'
            }}
          >
            {month.label}
          </div>
        ))}
      </div>

      {/* Bottom row: days/weeks - height 22px */}
      <div className="relative h-[22px] border-b bg-background">
        {headerCells.map((cell) => (
          <div
            key={`cell-${cell.date.getTime()}`}
            className={`
              absolute flex items-center justify-center border-r text-[10px] text-center
              ${cell.isWeekend ? 'bg-muted/30' : ''}
              ${cell.isToday ? 'bg-primary/10 font-bold text-primary' : 'text-muted-foreground'}
            `}
            style={{
              left: cell.x,
              width: cell.width,
              height: '100%'
            }}
          >
            {cell.label}
          </div>
        ))}
      </div>
    </div>
  )
})

TimelineHeader.displayName = 'TimelineHeader'

export default TimelineHeader
