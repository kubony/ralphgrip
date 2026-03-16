'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  differenceInCalendarDays,
  differenceInMilliseconds,
  addDays,
  addHours,
  subDays,
  subHours,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  startOfQuarter,
  endOfQuarter,
  eachDayOfInterval,
  eachHourOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWeekend,
  isSameDay,
  isSameHour,
  format,
} from 'date-fns'
import { ko } from 'date-fns/locale'
export type ZoomLevel = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'

export interface TimelineItem {
  start_date: string | null
  due_date: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

const ZOOM_CONFIG = {
  hour: { cellWidth: 64, pxPerDay: 64 * 24, snapMs: 60 * 60 * 1000 },
  day: { cellWidth: 40, pxPerDay: 40, snapMs: DAY_MS },
  week: { cellWidth: 120, pxPerDay: 120 / 7, snapMs: DAY_MS },
  month: { cellWidth: 160, pxPerDay: 160 / 30, snapMs: DAY_MS },
  quarter: { cellWidth: 200, pxPerDay: 200 / 91, snapMs: DAY_MS },
  half: { cellWidth: 240, pxPerDay: 240 / 182, snapMs: DAY_MS },
  year: { cellWidth: 300, pxPerDay: 300 / 365, snapMs: DAY_MS },
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
  snapMs: number
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
  const snapMs = ZOOM_CONFIG[zoomLevel].snapMs ?? 24 * 60 * 60 * 1000

  // 날짜 범위 계산: 모든 항목의 min(start_date)~max(due_date) + 양쪽 여유
  const dateRange = useMemo<DateRange>(() => {
    const dates: Date[] = []
    for (const item of workItems) {
      if (item.start_date) dates.push(safeParse(item.start_date))
      if (item.due_date) dates.push(safeParse(item.due_date))
    }

    if (dates.length === 0) {
      if (zoomLevel === 'hour') {
        return {
          start: startOfDay(subHours(today, 24)),
          end: endOfDay(addHours(today, 24)),
        }
      }

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

    if (zoomLevel === 'hour') {
      return {
        start: startOfDay(subHours(minDate, 24)),
        end: endOfDay(addHours(maxDate, 24)),
      }
    }

    // 양쪽 2주 여유 + 월 시작/끝으로 정렬
    const start = startOfMonth(subDays(minDate, 14))
    const end = endOfMonth(addDays(maxDate, 14))
    return { start, end }
  }, [workItems, today, zoomLevel])

  const dateToX = useCallback(
    (date: Date) => {
      if (zoomLevel === 'hour') {
        return differenceInMilliseconds(date, dateRange.start) * (pxPerDay / (24 * 60 * 60 * 1000))
      }
      const days = differenceInCalendarDays(date, dateRange.start)
      return days * pxPerDay
    },
    [dateRange.start, pxPerDay, zoomLevel]
  )

  const xToDate = useCallback(
    (x: number) => {
      if (zoomLevel === 'hour') {
        const hours = Math.round(x / ZOOM_CONFIG.hour.cellWidth)
        return addHours(dateRange.start, hours)
      }
      const days = Math.round(x / pxPerDay)
      return addDays(dateRange.start, days)
    },
    [dateRange.start, pxPerDay, zoomLevel]
  )

  const totalWidth = useMemo(() => {
    if (zoomLevel === 'hour') {
      return differenceInMilliseconds(dateRange.end, dateRange.start) * (pxPerDay / (24 * 60 * 60 * 1000))
    }
    const totalDays = differenceInCalendarDays(dateRange.end, dateRange.start) + 1
    return totalDays * pxPerDay
  }, [dateRange, pxPerDay, zoomLevel])

  const todayX = useMemo(() => dateToX(today), [dateToX, today])

  // 상단 행: 월 라벨 (quarter 줌에서는 연도 라벨)
  const headerMonths = useMemo<HeaderMonth[]>(() => {
    if (zoomLevel === 'hour') {
      const days = eachDayOfInterval(dateRange)
      return days.map((dayStart) => {
        const x = dateToX(dayStart)
        const nextDay = addDays(dayStart, 1)
        const width = Math.max(dateToX(nextDay) - x, ZOOM_CONFIG.hour.cellWidth)
        return {
          date: dayStart,
          label: format(dayStart, 'M/d (EEE)', { locale: ko }),
          x,
          width,
        }
      })
    }

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
    if (zoomLevel === 'hour') {
      const hours = eachHourOfInterval(dateRange)
      return hours.map((hour) => ({
        date: hour,
        label: format(hour, 'HH:mm'),
        x: dateToX(hour),
        width: ZOOM_CONFIG.hour.cellWidth,
        isWeekend: isWeekend(hour),
        isToday: isSameHour(hour, today),
      }))
    }

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
    snapMs,
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
