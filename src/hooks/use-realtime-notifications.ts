'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface NotificationItem {
  id: string
  type: string
  project_key: string
  work_item_id: string | null
  work_item_number: number
  title: string
  body: string | null
  actor: { id: string; full_name: string | null; avatar_url: string | null } | null
  read_at: string | null
  created_at: string
}

export function useRealtimeNotifications(
  userId: string,
  initialNotifications: NotificationItem[],
  initialUnreadCount: number
): { notifications: NotificationItem[]; unreadCount: number } {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  void initialUnreadCount

  useEffect(() => {
    setNotifications(initialNotifications)
  }, [initialNotifications])

  // Derive unreadCount from notifications state (single source of truth)
  const unreadCount = useMemo(
    () => notifications.filter(n => n.read_at === null).length,
    [notifications]
  )

  // Subscribe to Supabase Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === 'INSERT') {
            // Fetch the inserted notification with actor join
            const { data } = await supabase
              .from('notifications')
              .select(
                'id, type, project_key, work_item_id, work_item_number, title, body, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)'
              )
              .eq('id', payload.new.id)
              .single()

            if (!data) return

            // Normalize actor FK join (may be array)
            const normalized: NotificationItem = {
              ...data,
              actor: Array.isArray(data.actor) ? (data.actor[0] ?? null) : data.actor,
            }

            setNotifications(prev => [normalized, ...prev].slice(0, 20))
          } else if (payload.eventType === 'UPDATE') {
            // Fetch the updated notification with actor join
            const { data } = await supabase
              .from('notifications')
              .select(
                'id, type, project_key, work_item_id, work_item_number, title, body, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)'
              )
              .eq('id', payload.new.id)
              .single()

            if (!data) return

            // Normalize actor FK join (may be array)
            const normalized: NotificationItem = {
              ...data,
              actor: Array.isArray(data.actor) ? (data.actor[0] ?? null) : data.actor,
            }

            // Update notification in list (unreadCount is derived automatically)
            setNotifications(prev =>
              prev.map(item => (item.id === normalized.id ? normalized : item))
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { notifications, unreadCount }
}
