'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { WorkItem, WorkItemWithRelations } from '@/types/database'

export function useRealtimeWorkItems(
  projectId: string,
  initialWorkItems: WorkItemWithRelations[]
): WorkItemWithRelations[] {
  const [items, setItems] = useState<WorkItemWithRelations[]>(initialWorkItems)

  useEffect(() => {
    setItems(initialWorkItems)
  }, [initialWorkItems])

  // Subscribe to Supabase Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`work-items-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_items',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload: RealtimePostgresChangesPayload<WorkItem>) => {
          if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(item => item.id !== payload.old.id))
            return
          }

          // For INSERT and UPDATE, re-fetch the item with joins
          const { data, error } = await supabase
            .from('work_items')
            .select(`
              *,
              tracker:trackers(*),
              status:statuses(*),
              assignee:profiles!work_items_assignee_id_fkey(id, full_name, avatar_url),
              reporter:profiles!work_items_reporter_id_fkey(id, full_name, avatar_url),
              agent_assignee:agents!work_items_agent_assignee_id_fkey(id, name, display_name, avatar_url),
              agent_reporter:agents!work_items_agent_reporter_id_fkey(id, name, display_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (error || !data) {
            console.error('[Realtime] Failed to re-fetch work item:', error)
            return
          }

          if (payload.eventType === 'INSERT') {
            setItems(prev => [...prev, data])
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(item => (item.id === data.id ? data : item)))
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] work-items channel subscribed for project:', projectId)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] work-items channel error:', err)
        } else if (status === 'TIMED_OUT') {
          console.error('[Realtime] work-items channel timed out')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  return items
}
