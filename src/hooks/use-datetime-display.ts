'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'agentgrip:show-datetime-seconds'
const EVENT_NAME = 'agentgrip:show-datetime-seconds-changed'

function readShowSeconds(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored == null ? true : stored === 'true'
}

export function useDateTimeDisplay() {
  const [showSeconds, setShowSecondsState] = useState<boolean>(readShowSeconds)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const sync = () => setShowSecondsState(readShowSeconds())
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(EVENT_NAME, sync as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(EVENT_NAME, sync as EventListener)
    }
  }, [])

  const setShowSeconds = useCallback((next: boolean) => {
    setShowSecondsState(next)
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, String(next))
    window.dispatchEvent(new Event(EVENT_NAME))
  }, [])

  const toggleShowSeconds = useCallback(() => {
    setShowSeconds(!showSeconds)
  }, [setShowSeconds, showSeconds])

  return { showSeconds, setShowSeconds, toggleShowSeconds }
}
