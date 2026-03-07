'use client'

import { useState } from 'react'
import type { WorkItemWithRelations } from '@/types/database'

export type SelectionType = 'workitem' | null

export interface Selection {
  type: SelectionType
  id: string | null
  ids?: Set<string>
  lastSelectedId?: string | null
}

export function useALMSelection(
  workItems: WorkItemWithRelations[],
  initialSelectedItemId?: string
) {
  const [selection, setSelection] = useState<Selection>(() => {
    if (initialSelectedItemId) {
      return {
        type: 'workitem',
        id: initialSelectedItemId,
        ids: new Set([initialSelectedItemId]),
        lastSelectedId: initialSelectedItemId,
      }
    }
    return { type: null, id: null, ids: new Set(), lastSelectedId: null }
  })

  const selectedWorkItem =
    selection.type === 'workitem' && selection.id
      ? workItems.find((w) => w.id === selection.id)
      : null

  const selectedCount = selection.ids?.size || (selection.id ? 1 : 0)

  return { selection, setSelection, selectedWorkItem, selectedCount }
}
