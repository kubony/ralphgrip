/**
 * 프로젝트 현황 데이터 가공 유틸리티
 *
 * 서버에서 조회한 raw 데이터를 차트용 데이터로 변환합니다.
 * 모든 집계는 클라이언트 사이드에서 수행합니다.
 */

interface WorkItem {
  id: string
  status_id: string | null
  assignee_id: string | null
  due_date: string | null
  created_at: string
  status?: { id: string; name: string; color: string | null; is_closed: boolean } | null
  assignee?: { id: string; full_name: string | null } | null
}

interface Status {
  id: string
  name: string
  color: string | null
  position: number
  is_closed: boolean
}

interface AuditLog {
  id: string
  work_item_id: string
  operation: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[]
  changed_at: string
}

// --- 상태 분포 ---

export function computeStatusDistribution(
  workItems: WorkItem[],
  statuses: Status[]
): { name: string; color: string | null; count: number }[] {
  const countMap = new Map<string, number>()
  workItems.forEach((wi) => {
    if (!wi.status_id) return
    countMap.set(wi.status_id, (countMap.get(wi.status_id) || 0) + 1)
  })

  return statuses
    .map((s) => ({
      name: s.name,
      color: s.color,
      count: countMap.get(s.id) || 0,
    }))
    .filter((d) => d.count > 0)
}

// --- 마감 초과 ---

export function computeOverdueCount(workItems: WorkItem[]): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return workItems.filter((wi) => {
    if (!wi.due_date || wi.status?.is_closed) return false
    return new Date(wi.due_date) < today
  }).length
}

// --- 번다운 차트 ---

export function computeBurndownData(
  workItems: WorkItem[],
  auditLogs: AuditLog[],
  statuses: Status[],
): { date: string; remaining: number | null; ideal: number }[] {
  if (workItems.length === 0) return []

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayStr = now.toISOString().split('T')[0]

  // --- Status lookup ---
  const closedMap = new Map<string, boolean>()
  statuses.forEach((s) => closedMap.set(s.id, s.is_closed))

  // --- Ideal line: due_date 기반 계단식 ---
  const validDueDates = workItems
    .map((wi) => wi.due_date?.split('T')[0])
    .filter((d): d is string => !!d)

  const maxDueDate =
    validDueDates.length > 0
      ? validDueDates.reduce((a, b) => (a > b ? a : b))
      : todayStr

  // due_date 없는 항목 → maxDueDate에 배치
  const dueCountByDate = new Map<string, number>()
  workItems.forEach((wi) => {
    const d = wi.due_date?.split('T')[0] || maxDueDate
    dueCountByDate.set(d, (dueCountByDate.get(d) || 0) + 1)
  })

  // --- Date range: 30일 전 → max(오늘, maxDueDate) ---
  const LOOKBACK_DAYS = 30
  const rangeStart = new Date(now)
  rangeStart.setDate(rangeStart.getDate() - LOOKBACK_DAYS)
  rangeStart.setHours(0, 0, 0, 0)

  const rangeEndStr = maxDueDate > todayStr ? maxDueDate : todayStr
  const rangeEnd = new Date(rangeEndStr + 'T00:00:00')

  const dates: string[] = []
  const cursor = new Date(rangeStart)
  while (cursor <= rangeEnd) {
    dates.push(cursor.toISOString().split('T')[0])
    cursor.setDate(cursor.getDate() + 1)
  }

  if (dates.length === 0) return []

  // --- Delta map for remaining (actual) line ---
  const deltaByDate = new Map<string, number>()

  auditLogs.forEach((log) => {
    if (!log.changed_fields?.includes('status_id')) return
    const oldId = log.old_values?.status_id as string | undefined
    const newId = log.new_values?.status_id as string | undefined
    const wasClosed = oldId ? (closedMap.get(oldId) ?? false) : false
    const nowClosed = newId ? (closedMap.get(newId) ?? false) : false

    if (!wasClosed && nowClosed) {
      const d = log.changed_at.split('T')[0]
      deltaByDate.set(d, (deltaByDate.get(d) || 0) + 1)
    } else if (wasClosed && !nowClosed) {
      const d = log.changed_at.split('T')[0]
      deltaByDate.set(d, (deltaByDate.get(d) || 0) - 1)
    }
  })

  workItems.forEach((wi) => {
    const d = wi.created_at.split('T')[0]
    if (d >= dates[0]) {
      deltaByDate.set(d, (deltaByDate.get(d) || 0) - 1)
    }
  })

  // --- startRemaining: currentOpen에서 역산 ---
  const currentOpen = workItems.filter((wi) => !wi.status?.is_closed).length
  let startRemaining = currentOpen

  const pastDates = dates.filter((d) => d <= todayStr)
  for (let i = pastDates.length - 1; i >= 1; i--) {
    startRemaining += deltaByDate.get(pastDates[i]) || 0
  }

  // --- Ideal: 범위 시작 전에 이미 마감인 항목 누적 ---
  let cumulativeDue = 0
  workItems.forEach((wi) => {
    const d = wi.due_date?.split('T')[0] || maxDueDate
    if (d < dates[0]) cumulativeDue++
  })

  // --- Build data points ---
  let remaining = startRemaining

  return dates.map((date, i) => {
    // Ideal: 해당 날짜 마감 항목 수만큼 계단식 감소
    cumulativeDue += dueCountByDate.get(date) || 0
    const ideal = Math.max(0, currentOpen - cumulativeDue)

    // Remaining: 오늘까지만 실측, 미래는 null
    if (date <= todayStr) {
      if (i > 0) {
        remaining -= deltaByDate.get(date) || 0
      }
      return { date, remaining: Math.max(0, remaining), ideal }
    }
    return { date, remaining: null, ideal }
  })
}

// --- 활동 추이 ---

export function computeActivityTrend(
  workItems: WorkItem[],
  auditLogs: AuditLog[],
  statuses: Status[],
  days: number = 30
): { date: string; created: number; completed: number }[] {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - days)

  const startStr = startDate.toISOString().split('T')[0]

  // status_id → is_closed 룩업 맵
  const closedMap = new Map<string, boolean>()
  statuses.forEach((s) => closedMap.set(s.id, s.is_closed))

  // 일별 생성 카운트
  const createdByDate = new Map<string, number>()
  workItems.forEach((wi) => {
    const date = wi.created_at.split('T')[0]
    if (date >= startStr) {
      createdByDate.set(date, (createdByDate.get(date) || 0) + 1)
    }
  })

  // 일별 완료 카운트 (audit_logs 기반 - status_id로 is_closed 룩업)
  const completedByDate = new Map<string, number>()
  auditLogs.forEach((log) => {
    if (!log.changed_fields?.includes('status_id')) return
    const oldStatusId = log.old_values?.status_id as string | undefined
    const newStatusId = log.new_values?.status_id as string | undefined
    const oldClosed = oldStatusId ? (closedMap.get(oldStatusId) ?? false) : false
    const newClosed = newStatusId ? (closedMap.get(newStatusId) ?? false) : false
    if (!oldClosed && newClosed) {
      const date = log.changed_at.split('T')[0]
      completedByDate.set(date, (completedByDate.get(date) || 0) + 1)
    }
  })

  // 날짜 배열 생성
  const data: { date: string; created: number; completed: number }[] = []
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    data.push({
      date: dateStr,
      created: createdByDate.get(dateStr) || 0,
      completed: completedByDate.get(dateStr) || 0,
    })
  }

  return data
}
