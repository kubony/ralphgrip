'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { CommentsSection } from '@/components/projects/comments-section'
import { getProjectMetadata } from '@/app/(dashboard)/my-work/actions'
import type { MyWorkItem, StatusesByProject } from './types'
import type { StatusRef, TrackerRef, PersonRef } from '@/types/database'

import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Tag from 'lucide-react/dist/esm/icons/tag'
import Flag from 'lucide-react/dist/esm/icons/flag'
import User from 'lucide-react/dist/esm/icons/user'
import UserCircle from 'lucide-react/dist/esm/icons/user-circle'
import Calendar from 'lucide-react/dist/esm/icons/calendar'
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Timer from 'lucide-react/dist/esm/icons/timer'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'

interface ProjectMeta {
  statuses: StatusRef[]
  trackers: TrackerRef[]
  members: PersonRef[]
}

interface MyWorkPropertySheetProps {
  item: MyWorkItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  statusesByProject: StatusesByProject
  onFieldChange: (itemId: string, projectId: string, updates: Record<string, unknown>) => Promise<void>
  onStatusChange: (itemId: string, statusId: string, projectId: string) => Promise<void>
}

const priorityOptions = [
  { value: '0', label: '낮음', color: 'text-gray-500' },
  { value: '1', label: '보통', color: 'text-blue-500' },
  { value: '2', label: '높음', color: 'text-yellow-500' },
  { value: '3', label: '긴급', color: 'text-orange-500' },
  { value: '4', label: '즉시', color: 'text-red-500' },
]

export function MyWorkPropertySheet({
  item,
  open,
  onOpenChange,
  statusesByProject,
  onFieldChange,
  onStatusChange,
}: MyWorkPropertySheetProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [localStartDate, setLocalStartDate] = useState('')
  const [localDueDate, setLocalDueDate] = useState('')
  const [localEstimatedHours, setLocalEstimatedHours] = useState('')
  const [localActualHours, setLocalActualHours] = useState('')

  // 메타데이터 lazy-load 캐시
  const [metaCache, setMetaCache] = useState<Record<string, ProjectMeta>>({})
  const [metaLoading, setMetaLoading] = useState(false)

  // 아이템 변경 시 로컬 상태 초기화
  useEffect(() => {
    if (!item) return
    setLocalStartDate(item.start_date ?? '')
    setLocalDueDate(item.due_date ?? '')
    setLocalEstimatedHours(item.estimated_hours?.toString() ?? '')
    setLocalActualHours(item.actual_hours?.toString() ?? '')
    setIsEditing(false)
  }, [item])

  // 메타데이터 lazy load
  useEffect(() => {
    if (!item || !open) return
    if (metaCache[item.project_id]) return

    setMetaLoading(true)
    getProjectMetadata(item.project_id)
      .then(meta => {
        setMetaCache(prev => ({ ...prev, [item.project_id]: meta }))
      })
      .catch(() => {
        // 메타데이터 로드 실패 시 statuses만으로 동작 (trackers/members 없이)
      })
      .finally(() => {
        setMetaLoading(false)
      })
  }, [item?.project_id, open, item, metaCache])

  const meta = item ? metaCache[item.project_id] : undefined
  const statuses = item ? (statusesByProject[item.project_id] ?? []) : []
  const trackers = meta?.trackers ?? []
  const members = meta?.members ?? []

  const handleFieldChange = useCallback(async (field: string, value: string | number | null) => {
    if (!item) return
    setIsSaving(true)
    try {
      if (field === 'status_id' && typeof value === 'string') {
        await onStatusChange(item.id, value, item.project_id)
      } else {
        await onFieldChange(item.id, item.project_id, { [field]: value })
      }
    } finally {
      setIsSaving(false)
    }
  }, [item, onFieldChange, onStatusChange])

  const handleTitleSave = useCallback(async () => {
    if (!item) return
    if (editedTitle.trim() && editedTitle !== item.title) {
      await handleFieldChange('title', editedTitle.trim())
    }
    setIsEditing(false)
  }, [item, editedTitle, handleFieldChange])

  if (!item) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto p-0"
        showCloseButton={true}
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          {/* 프로젝트 배지 + "프로젝트에서 열기" */}
          <div className="flex items-center gap-2 pr-8">
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
              {item.project?.key}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {item.project?.key}-{item.number}
            </span>
            <button
              className="ml-auto text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              onClick={() => {
                if (item.project?.key) {
                  router.push(`/projects/${item.project.key}/alm?item=${item.id}`)
                }
              }}
            >
              <ExternalLink className="h-3 w-3" />
              프로젝트에서 열기
            </button>
          </div>

          {/* 제목 인라인 편집 */}
          {isEditing ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              autoFocus
              className="text-lg font-semibold"
            />
          ) : (
            <SheetTitle
              className="cursor-pointer hover:text-primary transition-colors text-left"
              onClick={() => {
                setEditedTitle(item.title)
                setIsEditing(true)
              }}
            >
              {item.title}
            </SheetTitle>
          )}
          <SheetDescription className="sr-only">
            작업 속성 편집
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="p-4 space-y-2.5">
          {metaLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>메타데이터 로딩 중...</span>
            </div>
          )}

          {/* 상태 */}
          {item.tracker?.name !== 'Folder' && (
            <PropertyField icon={<AlertCircle className="h-4 w-4" />} label="상태">
              <Select
                value={item.status_id ?? undefined}
                onValueChange={(value) => handleFieldChange('status_id', value)}
                disabled={isSaving}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
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
            </PropertyField>
          )}

          {/* 트래커 */}
          <PropertyField icon={<Tag className="h-4 w-4" />} label="트래커">
            <Select
              value={item.tracker_id}
              onValueChange={(value) => handleFieldChange('tracker_id', value)}
              disabled={isSaving || trackers.length === 0}
            >
              <SelectTrigger className="h-8">
                <SelectValue>
                  {item.tracker?.name ?? '-'}
                </SelectValue>
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
          </PropertyField>

          {/* 우선순위 */}
          <PropertyField icon={<Flag className="h-4 w-4" />} label="우선순위">
            <Select
              value={String(item.priority)}
              onValueChange={(value) => handleFieldChange('priority', parseInt(value))}
              disabled={isSaving}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className={option.color}>{option.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyField>

          {/* 담당자 */}
          <PropertyField icon={<User className="h-4 w-4" />} label="담당자">
            <Select
              value={item.assignee?.id || 'unassigned'}
              onValueChange={(value) =>
                handleFieldChange('assignee_id', value === 'unassigned' ? null : value)
              }
              disabled={isSaving || members.length === 0}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="담당자 선택">
                  {item.assignee?.full_name || '미배정'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">미배정</span>
                </SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name || '이름 없음'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyField>

          {/* 생성자 */}
          <PropertyField icon={<UserCircle className="h-4 w-4" />} label="생성자">
            <div className="h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
              {item.reporter?.full_name || '알 수 없음'}
            </div>
          </PropertyField>

          {/* 계획 일정 */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 px-1">계획 일정</p>
            <div className="space-y-1">
              <PropertyField icon={<CalendarClock className="h-4 w-4" />} label="시작일">
                <DateInputField
                  value={localStartDate}
                  onChange={(e) => setLocalStartDate(e.target.value)}
                  onBlur={() => {
                    const val = localStartDate || null
                    if (val !== (item.start_date ?? null)) {
                      handleFieldChange('start_date', val)
                    }
                  }}
                  disabled={isSaving}
                />
              </PropertyField>
              <PropertyField icon={<Calendar className="h-4 w-4" />} label="마감일">
                <DateInputField
                  value={localDueDate}
                  onChange={(e) => setLocalDueDate(e.target.value)}
                  onBlur={() => {
                    const val = localDueDate || null
                    if (val !== (item.due_date ?? null)) {
                      handleFieldChange('due_date', val)
                    }
                  }}
                  disabled={isSaving}
                />
              </PropertyField>
            </div>
          </div>

          {/* 예상 공수 */}
          <PropertyField icon={<Timer className="h-4 w-4" />} label="예상 공수 (h)">
            <Input
              type="number"
              className="h-8"
              min="0"
              step="0.5"
              placeholder="0"
              value={localEstimatedHours}
              onChange={(e) => setLocalEstimatedHours(e.target.value)}
              onBlur={() => {
                const val = localEstimatedHours ? parseFloat(localEstimatedHours) : null
                if (val !== (item.estimated_hours ?? null)) {
                  handleFieldChange('estimated_hours', val)
                }
              }}
              disabled={isSaving}
            />
          </PropertyField>

          {/* 실적 공수 */}
          <PropertyField icon={<Timer className="h-4 w-4" />} label="실적 공수 (h)">
            <Input
              type="number"
              className="h-8"
              min="0"
              step="0.5"
              placeholder="0"
              value={localActualHours}
              onChange={(e) => setLocalActualHours(e.target.value)}
              onBlur={() => {
                const val = localActualHours ? parseFloat(localActualHours) : null
                if (val !== (item.actual_hours ?? null)) {
                  handleFieldChange('actual_hours', val)
                }
              }}
              disabled={isSaving}
            />
          </PropertyField>

          {/* 메타 정보 */}
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>생성: {new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>수정: {new Date(item.updated_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>

          {/* 댓글 섹션 */}
          {meta && (
            <>
              <Separator />
              <CommentsSection
                workItemId={item.id}
                projectId={item.project_id}
                members={members}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DateInputField({
  value,
  onChange,
  onBlur,
  disabled,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDoubleClick = () => {
    try {
      inputRef.current?.showPicker()
    } catch {
      // showPicker() 미지원 환경
    }
  }

  return (
    <Input
      ref={inputRef}
      type="date"
      className="h-8"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onDoubleClick={handleDoubleClick}
      disabled={disabled}
    />
  )
}

function PropertyField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 w-24 h-8">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
