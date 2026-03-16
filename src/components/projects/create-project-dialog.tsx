'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AnimatedButton } from '@/components/ui/animated-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createProject } from '@/app/(dashboard)/projects/actions'
import Plus from 'lucide-react/dist/esm/icons/plus'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import { cn } from '@/lib/utils'

type ProjectType = 'requirement' | 'issue'

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [projectType, setProjectType] = useState<ProjectType>('issue')
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    setError(null)

    startTransition(async () => {
      const result = await createProject(formData)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      toast.success('프로젝트가 생성되었습니다.')
      setOpen(false)
      setProjectType('issue')
      if (result.data) {
        router.push(`/projects/${result.data.key}`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setProjectType('issue') }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          새 프로젝트
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={handleSubmit}>
          <input type="hidden" name="projectType" value={projectType} />
          <DialogHeader>
            <DialogTitle>새 프로젝트 만들기</DialogTitle>
            <DialogDescription>
              프로젝트 유형을 선택하고 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* 프로젝트 유형 선택 */}
            <div className="grid gap-2">
              <Label>프로젝트 유형 *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProjectType('requirement')}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors hover:bg-muted/50',
                    projectType === 'requirement'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted'
                  )}
                >
                  <FileText className="h-6 w-6 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium">요구사항</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Draft / New / Verified / Confirmed
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setProjectType('issue')}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors hover:bg-muted/50',
                    projectType === 'issue'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted'
                  )}
                >
                  <AlertCircle className="h-6 w-6 text-pink-500" />
                  <div>
                    <div className="text-sm font-medium">이슈</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Open / Todo / In Progress / Issue / Resolved / Closed
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">프로젝트 이름 *</Label>
              <Input
                id="name"
                name="name"
                placeholder="예: 신규 프로젝트"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="key">프로젝트 키 *</Label>
              <Input
                id="key"
                name="key"
                placeholder="예: WRV"
                maxLength={10}
                className="uppercase"
                required
              />
              <p className="text-xs text-muted-foreground">
                2-10자의 영문 대문자 (예: WRV, PROJ, TYMPRISS)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="프로젝트에 대한 간단한 설명"
                rows={3}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <AnimatedButton type="submit" isLoading={isPending}>프로젝트 만들기</AnimatedButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
