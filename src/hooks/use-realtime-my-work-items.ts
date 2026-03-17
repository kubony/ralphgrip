'use client'

import { useEffect, useMemo, useReducer, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { MyWorkItem } from '@/components/my-work/types'

type WorkItemRow = Record<string, unknown> & { id: string }

interface RealtimeState {
  baseItems: MyWorkItem[]
  overrides: Record<string, Partial<MyWorkItem>>
  deletedIds: Set<string>
}

type RealtimeAction =
  | { type: 'reset'; items: MyWorkItem[] }
  | { type: 'delete'; id: string }
  | { type: 'upsert'; item: Partial<MyWorkItem> & { id: string } }

function realtimeReducer(state: RealtimeState, action: RealtimeAction): RealtimeState {
  switch (action.type) {
    case 'reset':
      return {
        baseItems: action.items,
        overrides: {},
        deletedIds: new Set(),
      }
    case 'delete': {
      const nextOverrides = { ...state.overrides }
      delete nextOverrides[action.id]
      const nextDeletedIds = new Set(state.deletedIds)
      nextDeletedIds.add(action.id)
      return {
        ...state,
        overrides: nextOverrides,
        deletedIds: nextDeletedIds,
      }
    }
    case 'upsert':
      return {
        ...state,
        overrides: {
          ...state.overrides,
          [action.item.id]: action.item,
        },
      }
  }
}

export function useRealtimeMyWorkItems(
  initialItems: MyWorkItem[]
): MyWorkItem[] {
  const [state, dispatch] = useReducer(realtimeReducer, {
    baseItems: initialItems,
    overrides: {},
    deletedIds: new Set<string>(),
  })
  const itemIdsRef = useRef<Set<string>>(new Set(initialItems.map(i => i.id)))

  const items = useMemo(() => (
    state.baseItems
      .filter((item) => !state.deletedIds.has(item.id))
      .map((item) => {
        const patch = state.overrides[item.id]
        return patch ? { ...item, ...patch } : item
      })
  ), [state])

  useEffect(() => {
    dispatch({ type: 'reset', items: initialItems })
    itemIdsRef.current = new Set(initialItems.map(i => i.id))
  }, [initialItems])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('my-work-items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_items',
        },
        async (payload: RealtimePostgresChangesPayload<WorkItemRow>) => {
          if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id
            if (oldId && itemIdsRef.current.has(oldId)) {
              itemIdsRef.current.delete(oldId)
              dispatch({ type: 'delete', id: oldId })
            }
            return
          }

          const newId = payload.new?.id
          if (!newId || !itemIdsRef.current.has(newId)) return

          // Re-fetch the item with joins
          const { data, error } = await supabase
            .from('work_items')
            .select(`
              *,
              project:projects(id, name, key, project_type),
              tracker:trackers(id, name, color),
              status:statuses(id, name, color, position, is_closed),
              assignee:profiles!work_items_assignee_id_fkey(id, full_name, avatar_url),
              reporter:profiles!work_items_reporter_id_fkey(id, full_name, avatar_url)
            `)
            .eq('id', newId)
            .single()

          if (error || !data) {
            console.error('[Realtime] Failed to re-fetch my-work item:', error)
            return
          }

          dispatch({ type: 'upsert', item: data as Partial<MyWorkItem> & { id: string } })
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] my-work-items channel subscribed')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] my-work-items channel error:', err)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return items
}
