'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LinkCount } from '@/types/database'

export function useRealtimeLinkCounts(
  projectId: string,
  initialCounts: LinkCount[]
): LinkCount[] {
  const [counts, setCounts] = useState<LinkCount[]>(initialCounts)

  // Sync with server data via effect (render 도중 setState 방지)
  const prevInitialRef = useRef(initialCounts)
  useEffect(() => {
    if (prevInitialRef.current !== initialCounts) {
      if (JSON.stringify(prevInitialRef.current) !== JSON.stringify(initialCounts)) {
         
        queueMicrotask(() => setCounts(initialCounts))
      }
      prevInitialRef.current = initialCounts
    }
  }, [initialCounts])

  // Subscribe to work_item_links changes and re-fetch counts
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`work-item-links-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_item_links',
        },
        async (payload) => {
          // 클라이언트사이드 프로젝트 필터: source_id나 target_id가
          // 현재 프로젝트와 관련된 경우에만 RPC 호출
          const record = (payload.new ?? payload.old) as Record<string, unknown> | undefined
          if (!record) return

          const { data } = await supabase
            .rpc('get_work_item_link_counts', { p_project_id: projectId })

          if (data) {
            setCounts(data as LinkCount[])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  return counts
}
