'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { InboxWorkItem } from './types'

interface ReworkDialogProps {
  item: InboxWorkItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (reason: string) => Promise<void>
}

export function ReworkDialog({ item, open, onOpenChange, onSubmit }: ReworkDialogProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit() {
    if (!reason.trim() || isSubmitting) return
    setIsSubmitting(true)
    await onSubmit(reason.trim())
    setIsSubmitting(false)
    setReason('')
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('')
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>재작업 요청</DialogTitle>
          <DialogDescription>
            {item ? (
              <span className="font-mono text-xs">
                {item.project?.key}-{item.number}
              </span>
            ) : null}{' '}
            에이전트에게 다시 작업을 요청합니다. 사유는 댓글로 기록되고 상태가 <b>In Progress</b>로 변경됩니다.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="무엇을 왜 다시 작업해야 하는지 구체적으로 적어주세요."
          rows={5}
          autoFocus
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!reason.trim() || isSubmitting}>
            {isSubmitting ? '요청 중...' : '재작업 요청'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
