'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * 인박스 실시간 동기화.
 * work_items / comments 변경을 구독하고, 변경이 감지되면 서버 컴포넌트 데이터를
 * 디바운스하여 router.refresh()로 갱신한다. (요약 카드/섹션이 서버에서 재계산됨)
 */
export function useRealtimeInbox() {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        router.refresh()
      }, 800)
    }

    const channel = supabase
      .channel('inbox-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_items' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, scheduleRefresh)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] inbox channel subscribed')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] inbox channel error:', err)
        }
      })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [router])
}
