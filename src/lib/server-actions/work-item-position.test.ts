import { describe, expect, it } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'

import { isWorkItemPositionConflict, MAX_POSITION_INSERT_ATTEMPTS } from '@/lib/server-actions/work-item-position'

function makeError(code: string, message: string, details?: string): PostgrestError {
  return {
    code,
    details: details ?? '',
    hint: '',
    message,
    name: 'PostgrestError',
  }
}

describe('work item position helpers', () => {
  it('uses a bounded retry count', () => {
    expect(MAX_POSITION_INSERT_ATTEMPTS).toBe(5)
  })

  it('detects unique index conflicts for sibling positions', () => {
    expect(
      isWorkItemPositionConflict(
        makeError('23505', 'duplicate key value violates unique constraint', 'work_items_project_parent_position_unique')
      )
    ).toBe(true)

    expect(
      isWorkItemPositionConflict(
        makeError('23505', 'duplicate key value violates unique constraint', 'work_items_project_root_position_unique')
      )
    ).toBe(true)
  })

  it('ignores unrelated database errors', () => {
    expect(isWorkItemPositionConflict(makeError('22001', 'value too long'))).toBe(false)
    expect(isWorkItemPositionConflict(null)).toBe(false)
  })
})
