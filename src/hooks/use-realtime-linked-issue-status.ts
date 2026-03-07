'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LinkedIssueStatus } from '@/types/database'

export function useRealtimeLinkedIssueStatus(
  projectId: string,
  initialStatuses: LinkedIssueStatus[]
): LinkedIssueStatus[] {
  const [statuses, setStatuses] = useState<LinkedIssueStatus[]>(initialStatuses)

  // Sync with server data via effect (render 도중 setState 방지)
  const prevInitialRef = useRef(initialStatuses)
  useEffect(() => {
    if (prevInitialRef.current !== initialStatuses) {
      if (JSON.stringify(prevInitialRef.current) !== JSON.stringify(initialStatuses)) {
         
        queueMicrotask(() => setStatuses(initialStatuses))
      }
      prevInitialRef.current = initialStatuses
    }
  }, [initialStatuses])

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .rpc('get_linked_issue_worst_status', { p_project_id: projectId })
    if (data) {
      setStatuses(data as LinkedIssueStatus[])
    }
  }, [projectId])

  // Subscribe to work_item_links + work_items changes and re-fetch
  useEffect(() => {
    const supabase = createClient()

    // work_item_links 변경 시 (링크 추가/삭제)
    const linksChannel = supabase
      .channel(`linked-issue-status-links-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_item_links',
        },
        () => void refetch()
      )
      .subscribe()

    // work_items 변경 시 (이슈 상태 변경) — filter로 프로젝트 필터링
    const itemsChannel = supabase
      .channel(`linked-issue-status-items-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'work_items',
          filter: `project_id=eq.${projectId}`,
        },
        () => void refetch()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(linksChannel)
      supabase.removeChannel(itemsChannel)
    }
  }, [projectId, refetch])

  return statuses
}
