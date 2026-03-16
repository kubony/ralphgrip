import { format, parseISO } from 'date-fns'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_MINUTE_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/
const DATETIME_SECOND_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/

export const WORK_ITEM_DATETIME_FIELDS = [
  'start_date',
  'due_date',
  'actual_start_date',
  'actual_resolved_date',
  'actual_end_date',
] as const

type WorkItemDateTimeField = typeof WORK_ITEM_DATETIME_FIELDS[number]

function normalizeDateTimeSeparator(value: string): string {
  return value.trim().replace(' ', 'T')
}

export function parseWorkItemDateTime(value: string | null | undefined): Date | null {
  if (!value) return null

  const normalized = normalizeDateTimeSeparator(value)

  if (DATE_ONLY_RE.test(normalized)) {
    const parsed = parseISO(`${normalized}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (DATETIME_MINUTE_RE.test(normalized)) {
    const parsed = parseISO(`${normalized}:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (DATETIME_SECOND_RE.test(normalized)) {
    const parsed = parseISO(normalized)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function normalizeWorkItemDateTimeForStorage(value: string | null | undefined): string | null {
  const parsed = parseWorkItemDateTime(value)
  if (!parsed) return null
  return format(parsed, "yyyy-MM-dd'T'HH:mm:ss")
}

export function toDateTimeLocalInputValue(value: string | null | undefined): string {
  return normalizeWorkItemDateTimeForStorage(value) ?? ''
}

export function shiftWorkItemDateTimeByDays(value: string | null | undefined, deltaDays: number): string | null {
  const parsed = parseWorkItemDateTime(value)
  if (!parsed) return null

  const shifted = new Date(parsed)
  shifted.setDate(shifted.getDate() + deltaDays)
  return format(shifted, "yyyy-MM-dd'T'HH:mm:ss")
}

export function shiftWorkItemDateTimeByMilliseconds(value: string | null | undefined, deltaMs: number): string | null {
  const parsed = parseWorkItemDateTime(value)
  if (!parsed) return null

  return format(new Date(parsed.getTime() + deltaMs), "yyyy-MM-dd'T'HH:mm:ss")
}

export function redateWorkItemDateTime(
  value: string | null | undefined,
  targetDate: Date,
  fallbackTime?: { hours?: number; minutes?: number; seconds?: number }
): string {
  const parsed = parseWorkItemDateTime(value)
  const next = new Date(targetDate)

  next.setHours(
    parsed?.getHours() ?? fallbackTime?.hours ?? 0,
    parsed?.getMinutes() ?? fallbackTime?.minutes ?? 0,
    parsed?.getSeconds() ?? fallbackTime?.seconds ?? 0,
    0,
  )

  return format(next, "yyyy-MM-dd'T'HH:mm:ss")
}

export function normalizeWorkItemDateTimePatch<T extends Record<string, unknown>>(updates: T): T {
  const normalized: Record<string, unknown> = { ...updates }

  for (const field of WORK_ITEM_DATETIME_FIELDS) {
    if (!(field in normalized)) continue

    const value = normalized[field]
    if (typeof value === 'string' || value == null) {
      normalized[field] = normalizeWorkItemDateTimeForStorage(value)
    }
  }

  return normalized as T
}

export function formatWorkItemDateTime(
  value: string | null | undefined,
  locale: string = 'ko-KR',
  options?: { showSeconds?: boolean }
): string {
  const parsed = parseWorkItemDateTime(value)
  if (!parsed) return '-'

  return parsed.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(options?.showSeconds ?? true ? { second: '2-digit' } : {}),
  })
}

export function hasWorkItemDateTimeField(field: string): field is WorkItemDateTimeField {
  return (WORK_ITEM_DATETIME_FIELDS as readonly string[]).includes(field)
}
