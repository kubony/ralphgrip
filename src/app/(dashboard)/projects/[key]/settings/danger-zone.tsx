'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { deleteProject } from '../../actions'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'

interface DangerZoneProps {
  projectId: string
  projectName: string
}

export function DangerZone({ projectId, projectName }: DangerZoneProps) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProject(projectId)
      if (result.success) {
        router.push('/projects')
      }
    })
  }

  return (
    <section id="danger-zone">
      <h2 className="text-base font-semibold text-destructive mb-4">Danger Zone</h2>
      <div className="rounded-lg border border-destructive/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">프로젝트 삭제</p>
            <p className="text-xs text-muted-foreground">
              프로젝트와 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
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
                <DialogTitle>프로젝트를 삭제하시겠습니까?</DialogTitle>
                <DialogDescription>
                  이 작업은 되돌릴 수 없습니다. 프로젝트의 모든 작업, 댓글, 설정이 영구적으로 삭제됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="confirm-delete" className="text-sm">
                  확인을 위해 <span className="font-mono font-semibold">{projectName}</span>을 입력하세요
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={projectName}
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
                  disabled={isPending || confirmText !== projectName}
                >
                  {isPending ? '삭제 중...' : '영구 삭제'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  )
}
