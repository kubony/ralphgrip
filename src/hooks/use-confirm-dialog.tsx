'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
  title: string
  description?: string
  actionLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  isAsync?: boolean
}

const initialState: ConfirmState = {
  open: false,
  title: '',
}

declare global {
  interface Window {
    __confirmAsync?: (opts: ConfirmOptions) => Promise<boolean>
    __nativeConfirm?: (message?: string) => boolean
  }
}

export function ConfirmDialogProvider() {
  const [state, setState] = useState<ConfirmState>(initialState)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)
  const syncResultRef = useRef<boolean | null>(null)

  const handleConfirm = () => {
    syncResultRef.current = true
    resolveRef.current?.(true)
    setState(initialState)
    resolveRef.current = null
  }

  const handleCancel = () => {
    syncResultRef.current = false
    resolveRef.current?.(false)
    setState(initialState)
    resolveRef.current = null
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const nativeConfirm = window.confirm.bind(window)
    window.__confirmAsync = (opts: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve
        syncResultRef.current = null
        setState({ ...opts, open: true, isAsync: true })
      })
    }
    window.__nativeConfirm = nativeConfirm

    return () => {
      delete window.__confirmAsync
      delete window.__nativeConfirm
    }
  }, [])

  return (
    <Dialog open={state.open} onOpenChange={(open) => {
      if (!open) handleCancel()
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && (
            <DialogDescription>{state.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {state.cancelLabel || '취소'}
          </Button>
          <Button
            onClick={handleConfirm}
            variant={state.variant === 'destructive' ? 'destructive' : 'default'}
          >
            {state.actionLabel || '확인'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function useConfirmDialog() {
  return async (opts: ConfirmOptions): Promise<boolean> => {
    if (typeof window !== 'undefined' && window.__confirmAsync) {
      return window.__confirmAsync(opts)
    }
    // Fallback
    return Promise.resolve(window.confirm(opts.title))
  }
}
