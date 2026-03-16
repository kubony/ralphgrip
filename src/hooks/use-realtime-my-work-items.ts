'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { MyWorkItem } from '@/components/my-work/types'

type WorkItemRow = Record<string, unknown> & { id: string }

export function useRealtimeMyWorkItems(
  initialItems: MyWorkItem[]
): MyWorkItem[] {
  const [items, setItems] = useState<MyWorkItem[]>(initialItems)
  const itemIdsRef = useRef<Set<string>>(new Set(initialItems.map(i => i.id)))

  useEffect(() => {
    setItems(initialItems)
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
              setItems(prev => prev.filter(item => item.id !== oldId))
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

          setItems(prev =>
            prev.map(item => {
              if (item.id !== data.id) return item
              return { ...item, ...data }
            })
          )
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
