import { describe, expect, it } from 'vitest'
import {
  formatWorkItemDateTime,
  normalizeWorkItemDateTimeForStorage,
  parseWorkItemDateTime,
  redateWorkItemDateTime,
  shiftWorkItemDateTimeByDays,
  shiftWorkItemDateTimeByMilliseconds,
  toDateTimeLocalInputValue,
} from './work-item-datetime'

describe('work-item datetime utilities', () => {
  it('normalizes date-only values to midnight with seconds', () => {
    expect(normalizeWorkItemDateTimeForStorage('2026-03-16')).toBe('2026-03-16T00:00:00')
  })

  it('pads minute precision values with seconds', () => {
    expect(normalizeWorkItemDateTimeForStorage('2026-03-16T09:30')).toBe('2026-03-16T09:30:00')
  })

  it('converts legacy date-only values into datetime-local input values', () => {
    expect(toDateTimeLocalInputValue('2026-03-16')).toBe('2026-03-16T00:00:00')
  })

  it('preserves time when moving a work item by days', () => {
    expect(shiftWorkItemDateTimeByDays('2026-03-16T09:30:45', 2)).toBe('2026-03-18T09:30:45')
  })

  it('preserves time when moving a work item by hour increments', () => {
    expect(shiftWorkItemDateTimeByMilliseconds('2026-03-16T09:30:45', 60 * 60 * 1000)).toBe('2026-03-16T10:30:45')
  })

  it('preserves the existing time when replacing only the date portion', () => {
    expect(redateWorkItemDateTime('2026-03-16T09:30:45', new Date('2026-04-01T00:00:00'))).toBe('2026-04-01T09:30:45')
  })

  it('supports explicit fallback time when a new datetime is seeded from an empty value', () => {
    expect(
      redateWorkItemDateTime(null, new Date('2026-04-01T00:00:00'), { hours: 23, minutes: 59, seconds: 59 })
    ).toBe('2026-04-01T23:59:59')
  })

  it('parses timezone-qualified datetimes for safe display/export formatting', () => {
    const parsed = parseWorkItemDateTime('2026-03-16T09:30:45Z')
    expect(parsed).not.toBeNull()
    expect(parsed?.toISOString()).toBe('2026-03-16T09:30:45.000Z')
  })

  it('can omit seconds from formatted output when requested', () => {
    const formatted = formatWorkItemDateTime('2026-03-16T09:30:45', 'en-US', { showSeconds: false })
    expect(formatted).toContain('09:30')
    expect(formatted).not.toContain(':45')
  })
})
