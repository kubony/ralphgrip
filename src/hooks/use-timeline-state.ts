'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  differenceInCalendarDays,
  addDays,
  subDays,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWeekend,
  isSameDay,
  format,
} from 'date-fns'
import { ko } from 'date-fns/locale'
export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'

export interface TimelineItem {
  start_date: string | null
  due_date: string | null
}

const ZOOM_CONFIG = {
  day: { cellWidth: 40, pxPerDay: 40 },
  week: { cellWidth: 120, pxPerDay: 120 / 7 },
  month: { cellWidth: 160, pxPerDay: 160 / 30 },
  quarter: { cellWidth: 200, pxPerDay: 200 / 91 },
  half: { cellWidth: 240, pxPerDay: 240 / 182 },
  year: { cellWidth: 300, pxPerDay: 300 / 365 },
} as const

export const ROW_HEIGHT = 36
export const BAR_HEIGHT = 22
export const LEFT_PANEL_WIDTH = 250

interface DateRange {
  start: Date
  end: Date
}

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

export interface TimelineState {
  zoomLevel: ZoomLevel
  setZoomLevel: (level: ZoomLevel) => void
  pxPerDay: number
  dateToX: (date: Date) => number
  xToDate: (x: number) => Date
  dateRange: DateRange
  totalWidth: number
  headerMonths: HeaderMonth[]
  headerCells: HeaderCell[]
  today: Date
  todayX: number
}

function safeParse(dateStr: string): Date {
  return parseISO(dateStr)
}

export function useTimelineState(
  workItems: TimelineItem[],
  initialZoom?: ZoomLevel
): TimelineState {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(initialZoom ?? 'day')
  const today = useMemo(() => new Date(), [])

  const { pxPerDay } = ZOOM_CONFIG[zoomLevel]

  // 날짜 범위 계산: 모든 항목의 min(start_date)~max(due_date) + 양쪽 여유
  const dateRange = useMemo<DateRange>(() => {
    const dates: Date[] = []
    for (const item of workItems) {
      if (item.start_date) dates.push(safeParse(item.start_date))
      if (item.due_date) dates.push(safeParse(item.due_date))
    }

    if (dates.length === 0) {
      // 날짜가 모두 null: 오늘 기준 전후 3개월
      return {
        start: startOfMonth(subDays(today, 90)),
        end: endOfMonth(addDays(today, 90)),
      }
    }

    let minDate = dates[0]
    let maxDate = dates[0]
    for (const d of dates) {
      if (d < minDate) minDate = d
      if (d > maxDate) maxDate = d
    }

    // 양쪽 2주 여유 + 월 시작/끝으로 정렬
    const start = startOfMonth(subDays(minDate, 14))
    const end = endOfMonth(addDays(maxDate, 14))
    return { start, end }
  }, [workItems, today])

  const dateToX = useCallback(
    (date: Date) => {
      const days = differenceInCalendarDays(date, dateRange.start)
      return days * pxPerDay
    },
    [dateRange.start, pxPerDay]
  )

  const xToDate = useCallback(
    (x: number) => {
      const days = Math.round(x / pxPerDay)
      return addDays(dateRange.start, days)
    },
    [dateRange.start, pxPerDay]
  )

  const totalWidth = useMemo(() => {
    const totalDays = differenceInCalendarDays(dateRange.end, dateRange.start) + 1
    return totalDays * pxPerDay
  }, [dateRange, pxPerDay])

  const todayX = useMemo(() => dateToX(today), [dateToX, today])

  // 상단 행: 월 라벨 (quarter 줌에서는 연도 라벨)
  const headerMonths = useMemo<HeaderMonth[]>(() => {
    if (zoomLevel === 'quarter' || zoomLevel === 'half' || zoomLevel === 'year') {
      const startYear = dateRange.start.getFullYear()
      const endYear = dateRange.end.getFullYear()
      const yearHeaders: HeaderMonth[] = []
      for (let y = startYear; y <= endYear; y++) {
        const yearStart = new Date(y, 0, 1)
        const yearEnd = new Date(y, 11, 31)
        const clampedStart = yearStart < dateRange.start ? dateRange.start : yearStart
        const clampedEnd = yearEnd > dateRange.end ? dateRange.end : yearEnd
        const x = dateToX(clampedStart)
        const endX = dateToX(clampedEnd) + pxPerDay
        yearHeaders.push({
          date: yearStart,
          label: `${y}년`,
          x,
          width: endX - x,
        })
      }
      return yearHeaders
    }

    const months = eachMonthOfInterval(dateRange)
    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart)
      const clampedStart = monthStart < dateRange.start ? dateRange.start : monthStart
      const clampedEnd = monthEnd > dateRange.end ? dateRange.end : monthEnd
      const x = dateToX(clampedStart)
      const endX = dateToX(clampedEnd) + pxPerDay
      return {
        date: monthStart,
        label: format(monthStart, 'yyyy년 M월', { locale: ko }),
        x,
        width: endX - x,
      }
    })
  }, [zoomLevel, dateRange, dateToX, pxPerDay])

  // 하단 행: 줌에 따라 일/주 셀
  const headerCells = useMemo<HeaderCell[]>(() => {
    if (zoomLevel === 'day') {
      const days = eachDayOfInterval(dateRange)
      return days.map((d) => ({
        date: d,
        label: format(d, 'd'),
        x: dateToX(d),
        width: ZOOM_CONFIG.day.cellWidth,
        isWeekend: isWeekend(d),
        isToday: isSameDay(d, today),
      }))
    }

    if (zoomLevel === 'week') {
      const weeks = eachWeekOfInterval(dateRange, { weekStartsOn: 1 })
      return weeks.map((weekStart) => ({
        date: weekStart,
        label: format(weekStart, 'M/d'),
        x: dateToX(weekStart),
        width: ZOOM_CONFIG.week.cellWidth,
        isWeekend: false,
        isToday: false,
      }))
    }

    if (zoomLevel === 'month') {
      // month - 각 월을 하나의 셀로
      const months = eachMonthOfInterval(dateRange)
      return months.map((monthStart) => {
        const monthEnd = endOfMonth(monthStart)
        const clampedEnd = monthEnd > dateRange.end ? dateRange.end : monthEnd
        const totalDays = differenceInCalendarDays(clampedEnd, monthStart) + 1
        return {
          date: monthStart,
          label: format(monthStart, 'M월'),
          x: dateToX(monthStart),
          width: totalDays * pxPerDay,
          isWeekend: false,
          isToday: false,
        }
      })
    }

    // quarter - 각 분기를 하나의 셀로
    if (zoomLevel === 'quarter') {
      const cells: HeaderCell[] = []
      let qStart = startOfQuarter(dateRange.start)
      while (qStart <= dateRange.end) {
        const qEnd = endOfQuarter(qStart)
        const clampedEnd = qEnd > dateRange.end ? dateRange.end : qEnd
        const totalDays = differenceInCalendarDays(clampedEnd, qStart) + 1
        const quarterNum = Math.floor(qStart.getMonth() / 3) + 1
        cells.push({
          date: qStart,
          label: `Q${quarterNum}`,
          x: dateToX(qStart),
          width: totalDays * pxPerDay,
          isWeekend: false,
          isToday: false,
        })
        qStart = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1)
      }
      return cells
    }

    // half - 반기를 하나의 셀로 (H1: 1~6월, H2: 7~12월)
    if (zoomLevel === 'half') {
      const cells: HeaderCell[] = []
      const startYear = dateRange.start.getFullYear()
      const endYear = dateRange.end.getFullYear()
      for (let y = startYear; y <= endYear; y++) {
        for (let h = 0; h < 2; h++) {
          const halfStart = new Date(y, h * 6, 1)
          const halfEnd = endOfMonth(new Date(y, h * 6 + 5, 1))
          if (halfStart > dateRange.end || halfEnd < dateRange.start) continue
          const clampedStart = halfStart < dateRange.start ? dateRange.start : halfStart
          const clampedEnd = halfEnd > dateRange.end ? dateRange.end : halfEnd
          const totalDays = differenceInCalendarDays(clampedEnd, clampedStart) + 1
          cells.push({
            date: halfStart,
            label: `H${h + 1}`,
            x: dateToX(clampedStart),
            width: totalDays * pxPerDay,
            isWeekend: false,
            isToday: false,
          })
        }
      }
      return cells
    }

    // year - 각 연도를 하나의 셀로
    const yearCells: HeaderCell[] = []
    const startYear = dateRange.start.getFullYear()
    const endYear = dateRange.end.getFullYear()
    for (let y = startYear; y <= endYear; y++) {
      const yearStart = new Date(y, 0, 1)
      const yearEnd = new Date(y, 11, 31)
      const clampedStart = yearStart < dateRange.start ? dateRange.start : yearStart
      const clampedEnd = yearEnd > dateRange.end ? dateRange.end : yearEnd
      const totalDays = differenceInCalendarDays(clampedEnd, clampedStart) + 1
      yearCells.push({
        date: yearStart,
        label: `${y}`,
        x: dateToX(clampedStart),
        width: totalDays * pxPerDay,
        isWeekend: false,
        isToday: false,
      })
    }
    return yearCells
  }, [zoomLevel, dateRange, dateToX, today, pxPerDay])

  return {
    zoomLevel,
    setZoomLevel,
    pxPerDay,
    dateToX,
    xToDate,
    dateRange,
    totalWidth,
    headerMonths,
    headerCells,
    today,
    todayX,
  }
}
