'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { deleteAccount } from './actions'
import LogOut from 'lucide-react/dist/esm/icons/log-out'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'

interface AccountSettingsProps {
  email: string
}

export function AccountSettings({ email }: AccountSettingsProps) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  const confirmPhrase = 'DELETE'

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAccount()
      if (result.success) {
        router.push('/login')
      }
    })
  }

  return (
    <section id="account">
      <h2 className="text-base font-semibold mb-4">Account</h2>
      <div className="space-y-4">
        {/* Sign out */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">로그아웃</p>
              <p className="text-xs text-muted-foreground">현재 세션에서 로그아웃합니다</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>

        {/* Delete account */}
        <div className="rounded-lg border border-destructive/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">계정 삭제</p>
              <p className="text-xs text-muted-foreground">
                계정과 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText('') }}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />
                  삭제
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>계정을 삭제하시겠습니까?</DialogTitle>
                  <DialogDescription>
                    <span className="font-medium">{email}</span> 계정이 영구 삭제됩니다.
                    소유한 프로젝트, 작업, 댓글 등 모든 데이터가 함께 삭제됩니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-delete-account" className="text-sm">
                    확인을 위해 <span className="font-mono font-semibold">{confirmPhrase}</span>를 입력하세요
                  </Label>
                  <Input
                    id="confirm-delete-account"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={confirmPhrase}
                    disabled={isPending}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                    취소
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isPending || confirmText !== confirmPhrase}
                  >
                    {isPending ? '삭제 중...' : '영구 삭제'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </section>
  )
}
