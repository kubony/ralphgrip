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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createWorkItem } from '@/app/(dashboard)/projects/[key]/actions'
import Plus from 'lucide-react/dist/esm/icons/plus'
import type { TrackerRef, StatusRef, PersonRef } from '@/types/database'

interface CreateWorkItemDialogProps {
  projectId: string
  trackers: TrackerRef[]
  statuses: StatusRef[]
  members: PersonRef[]
}

const priorities = [
  { value: '0', label: '없음' },
  { value: '1', label: '낮음' },
  { value: '2', label: '보통' },
  { value: '3', label: '높음' },
  { value: '4', label: '긴급' },
]

export function CreateWorkItemDialog({ projectId, trackers, statuses, members }: CreateWorkItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const defaultTracker = trackers.find(t => t.name !== 'Folder') || trackers[0]
  const defaultStatus = statuses.find(s => !s.is_closed) || statuses[0]

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    formData.append('projectId', projectId)

    startTransition(async () => {
      const result = await createWorkItem(formData)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      toast.success('작업이 생성되었습니다.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          작업 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>새 작업 만들기</DialogTitle>
            <DialogDescription>
              작업 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                name="title"
                placeholder="작업 제목을 입력하세요"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="trackerId">유형 *</Label>
                <Select name="trackerId" defaultValue={defaultTracker?.id}>
                  <SelectTrigger>
                    <SelectValue placeholder="유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {trackers.map((tracker) => (
                      <SelectItem key={tracker.id} value={tracker.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tracker.color || '#6366f1' }}
                          />
                          {tracker.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="statusId">상태 *</Label>
                <Select name="statusId" defaultValue={defaultStatus?.id}>
                  <SelectTrigger>
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: status.color || '#94a3b8' }}
                          />
                          {status.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">우선순위</Label>
                <Select name="priority" defaultValue="0">
                  <SelectTrigger>
                    <SelectValue placeholder="우선순위 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="assigneeId">담당자</Label>
                <Select name="assigneeId" defaultValue="__none__">
                  <SelectTrigger>
                    <SelectValue placeholder="미지정" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">미지정</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name || '(이름 없음)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">목표 시작일</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dueDate">목표 마감일</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="작업에 대한 상세 설명"
                rows={24}
                className="field-sizing-normal"
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
            <AnimatedButton type="submit" isLoading={isPending}>작업 만들기</AnimatedButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
