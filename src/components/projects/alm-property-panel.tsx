'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateWorkItem, batchUpdateStatus, batchDelete, batchUpdateField } from '@/app/(dashboard)/projects/[key]/actions'
import { CommentsSection } from './comments-section'
import { DependencySection } from './dependency-section'
import { AnimatedAccordion } from '@/components/ui/animated-accordion'
import { cn } from '@/lib/utils'
import type { WorkItemWithRelations, StatusRef, TrackerRef, PersonRef, AgentRef, AiMetadata, WorkItemExternalLink } from '@/types/database'
import { getAssigneeDisplay, getReporterDisplay } from '@/lib/assignee-utils'
import { detectLinkDomain } from '@/lib/external-link-utils'
import { scrollMaskBoth } from '@/lib/motion'
import { LinkDomainIcon } from './link-domain-icon'
import Calendar from 'lucide-react/dist/esm/icons/calendar'
import User from 'lucide-react/dist/esm/icons/user'
import UserCircle from 'lucide-react/dist/esm/icons/user-circle'
import Flag from 'lucide-react/dist/esm/icons/flag'
import Tag from 'lucide-react/dist/esm/icons/tag'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Clock from 'lucide-react/dist/esm/icons/clock'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Plus from 'lucide-react/dist/esm/icons/plus'
import XIcon from 'lucide-react/dist/esm/icons/x'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Timer from 'lucide-react/dist/esm/icons/timer'
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock'
import Users from 'lucide-react/dist/esm/icons/users'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3'
import History from 'lucide-react/dist/esm/icons/history'
import Layers from 'lucide-react/dist/esm/icons/layers'
import Lock from 'lucide-react/dist/esm/icons/lock'
import Eye from 'lucide-react/dist/esm/icons/eye'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Bot from 'lucide-react/dist/esm/icons/bot'

interface ALMPropertyPanelProps {
  workItem: WorkItemWithRelations | null | undefined
  allWorkItems?: WorkItemWithRelations[]
  selectedCount?: number
  selectedIds?: Set<string>
  statuses: StatusRef[]
  trackers: TrackerRef[]
  members: PersonRef[]
  agents?: AgentRef[]
  projectId: string
  currentUserId?: string
  onViewInGraph?: (workItemId: string) => void
}

type WorkItemWithPropertyExtras = WorkItemWithRelations & {
  actual_start_date?: string | null
  actual_end_date?: string | null
  external_links?: WorkItemExternalLink[] | null
}

const priorityOptions = [
  { value: '0', label: '낮음', color: 'text-gray-500' },
  { value: '1', label: '보통', color: 'text-blue-500' },
  { value: '2', label: '높음', color: 'text-yellow-500' },
  { value: '3', label: '긴급', color: 'text-orange-500' },
  { value: '4', label: '즉시', color: 'text-red-500' },
]

const visibilityOptions = [
  { value: 'internal', label: '내부', icon: Lock, color: 'text-muted-foreground' },
  { value: 'public', label: '공개', icon: Eye, color: 'text-green-500' },
]

export function ALMPropertyPanel({
  workItem,
  allWorkItems = [],
  selectedCount = 0,
  selectedIds,
  statuses,
  trackers,
  members,
  agents = [],
  projectId,
  currentUserId,
  onViewInGraph,
}: ALMPropertyPanelProps) {
  const workItemWithExtras = workItem as WorkItemWithPropertyExtras | null | undefined
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [localEstimatedHours, setLocalEstimatedHours] = useState('')
  const [localActualHours, setLocalActualHours] = useState('')
  const [localExternalLinks, setLocalExternalLinks] = useState<WorkItemExternalLink[]>([])
  const [localStartDate, setLocalStartDate] = useState('')
  const [localDueDate, setLocalDueDate] = useState('')
  const [localActualStartDate, setLocalActualStartDate] = useState('')
  const [localActualEndDate, setLocalActualEndDate] = useState('')

  // 항목 변경 시 모든 필드 초기화
  useEffect(() => {
     
    queueMicrotask(() => {
      setLocalEstimatedHours(workItem?.estimated_hours?.toString() ?? '')
      setLocalActualHours(workItem?.actual_hours?.toString() ?? '')
      setLocalExternalLinks(workItemWithExtras?.external_links ?? [])
      setLocalStartDate(workItem?.start_date ?? '')
      setLocalDueDate(workItem?.due_date ?? '')
      setLocalActualStartDate(workItemWithExtras?.actual_start_date ?? '')
      setLocalActualEndDate(workItemWithExtras?.actual_end_date ?? '')
    })
  }, [
    workItem?.id,
    workItem?.estimated_hours,
    workItem?.actual_hours,
    workItem?.start_date,
    workItem?.due_date,
    workItemWithExtras?.actual_start_date,
    workItemWithExtras?.actual_end_date,
    workItemWithExtras?.external_links,
  ])

  // 날짜 필드 전용: 서버/Realtime/부모 낙관적 업데이트 시 즉시 반영
  useEffect(() => {
    if (!workItem) return
     
    queueMicrotask(() => {
      setLocalStartDate(workItem.start_date ?? '')
      setLocalDueDate(workItem.due_date ?? '')
      setLocalActualStartDate(workItemWithExtras?.actual_start_date ?? '')
      setLocalActualEndDate(workItemWithExtras?.actual_end_date ?? '')
    })
  }, [workItem, workItem?.start_date, workItem?.due_date, workItemWithExtras?.actual_start_date, workItemWithExtras?.actual_end_date])

  // 다중 선택 시
  if (selectedCount > 1 && selectedIds && selectedIds.size > 1) {
    return (
      <BatchPropertyPanel
        selectedIds={selectedIds}
        selectedCount={selectedCount}
        statuses={statuses}
        members={members}
        projectId={projectId}
      />
    )
  }

  if (!workItem) {
    return (
      <ProjectSummaryPanel
        allWorkItems={allWorkItems}
        statuses={statuses}
        members={members}
      />
    )
  }

  const handleFieldChange = async (field: string, value: string | number | { url: string; label?: string }[] | null) => {
    setIsSaving(true)
    const result = await updateWorkItem(workItem.id, { [field]: value }, projectId)
    setIsSaving(false)

    if (result?.error) {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle !== workItem.title) {
      await handleFieldChange('title', editedTitle.trim())
    }
    setIsEditing(false)
  }

  return (
    <div
      className="h-full bg-muted/20 overflow-y-auto"
      style={{ WebkitMaskImage: scrollMaskBoth, maskImage: scrollMaskBoth }}
    >
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <h3 className="font-medium">속성</h3>
      </div>

      {/* 제목 */}
      <div className="px-4 py-3 border-b">
        {isEditing ? (
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
            autoFocus
          />
        ) : (
          <h2
            className="font-semibold text-lg cursor-pointer hover:text-primary"
            onClick={() => {
              setEditedTitle(workItem.title)
              setIsEditing(true)
            }}
          >
            {workItem.title}
          </h2>
        )}
      </div>

      {/* 속성 섹션 */}
      <AnimatedAccordion title="속성" defaultOpen={true}>
        <div className="space-y-2.5">
          {/* 상태 (폴더는 상태 없음) */}
          {workItem.tracker.name !== 'Folder' && (
            <PropertyField
              icon={<AlertCircle className="h-4 w-4" />}
              label="상태"
            >
              <Select
                value={workItem.status_id ?? undefined}
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
          <PropertyField
            icon={<Tag className="h-4 w-4" />}
            label="트래커"
          >
            <Select
              value={workItem.tracker.id}
              onValueChange={(value) => handleFieldChange('tracker_id', value)}
              disabled={isSaving}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
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
          <PropertyField
            icon={<Flag className="h-4 w-4" />}
            label="우선순위"
          >
            <Select
              value={String(workItem.priority)}
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

          {/* 공개 수준 */}
          <PropertyField
            icon={<Lock className="h-4 w-4" />}
            label="공개 수준"
          >
            <Select
              value={workItem.visibility ?? undefined}
              onValueChange={(value) => handleFieldChange('visibility', value)}
              disabled={isSaving}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <opt.icon className={cn("h-3.5 w-3.5", opt.color)} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyField>

          {/* 담당자 */}
          <PropertyField
            icon={<User className="h-4 w-4" />}
            label="담당자"
          >
            <Select
              value={
                workItem.assignee?.id
                  ? `profile:${workItem.assignee.id}`
                  : workItem.agent_assignee?.id
                    ? `agent:${workItem.agent_assignee.id}`
                    : 'unassigned'
              }
              onValueChange={async (value) => {
                setIsSaving(true)
                let updates: Record<string, string | null>
                if (value === 'unassigned') {
                  updates = { assignee_id: null, agent_assignee_id: null }
                } else if (value.startsWith('agent:')) {
                  updates = { agent_assignee_id: value.slice(6), assignee_id: null }
                } else {
                  updates = { assignee_id: value.slice(8), agent_assignee_id: null }
                }
                const result = await updateWorkItem(workItem.id, updates, projectId)
                setIsSaving(false)
                if (result?.error) {
                  toast.error('저장에 실패했습니다.')
                }
              }}
              disabled={isSaving}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="담당자 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">미배정</span>
                </SelectItem>
                {members.length > 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground font-medium">멤버</div>
                )}
                {members.map((member) => (
                  <SelectItem key={member.id} value={`profile:${member.id}`}>
                    {member.full_name || '이름 없음'}
                  </SelectItem>
                ))}
                {agents.filter((a) => a.category !== 'global').length > 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground font-medium">프로젝트 에이전트</div>
                )}
                {agents.filter((a) => a.category !== 'global').map((agent) => (
                  <SelectItem key={agent.id} value={`agent:${agent.id}`}>
                    <div className="flex items-center gap-1.5">
                      <Bot className="h-3 w-3 text-violet-500 flex-shrink-0" />
                      {agent.display_name}
                    </div>
                  </SelectItem>
                ))}
                {agents.filter((a) => a.category === 'global').length > 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground font-medium">글로벌 에이전트</div>
                )}
                {agents.filter((a) => a.category === 'global').map((agent) => (
                  <SelectItem key={agent.id} value={`agent:${agent.id}`}>
                    <div className="flex items-center gap-1.5">
                      <Bot className="h-3 w-3 text-violet-500 flex-shrink-0" />
                      {agent.display_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyField>

          {/* 생성자 */}
          <PropertyField
            icon={<UserCircle className="h-4 w-4" />}
            label="생성자"
          >
            <div className="h-8 px-3 flex items-center gap-1.5 text-sm bg-muted/50 rounded-md">
              {workItem.agent_reporter && <Bot className="h-3 w-3 text-violet-500 flex-shrink-0" />}
              {(() => {
                const reporter = getReporterDisplay(workItem)
                return reporter?.name || '알 수 없음'
              })()}
            </div>
          </PropertyField>

          {/* AI 생성 정보 */}
          {workItem.created_by_ai && (
            <PropertyField
              icon={<Sparkles className="h-4 w-4 text-violet-500" />}
              label="AI 생성"
            >
              <div className="h-8 px-3 flex items-center gap-2 text-sm bg-violet-50 dark:bg-violet-950/30 rounded-md">
                <span className="text-violet-600 dark:text-violet-400">
                  {(workItem.ai_metadata as AiMetadata | null)?.model || 'AI'}
                </span>
              </div>
            </PropertyField>
          )}

          {/* 레벨 */}
          <PropertyField
            icon={<Layers className="h-4 w-4" />}
            label="레벨"
          >
            <div className="h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
              {workItem.level}
            </div>
          </PropertyField>

          {/* 메타 정보 */}
          <div className="text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>생성: {new Date(workItem.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </AnimatedAccordion>

      {/* 일정 섹션 */}
      <AnimatedAccordion title="일정" defaultOpen={true}>
        <div className="space-y-2.5">
          {/* 계획 일정 그룹 */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">계획 일정</p>
            <div className="space-y-1">
              <PropertyField icon={<CalendarClock className="h-4 w-4" />} label="목표 시작일">
                <DateInputField
                  value={localStartDate}
                  onChange={(e) => setLocalStartDate(e.target.value)}
                  onBlur={() => {
                    const val = localStartDate || null
                    if (val !== (workItem.start_date ?? null)) {
                      handleFieldChange('start_date', val)
                    }
                  }}
                  disabled={isSaving}
                />
              </PropertyField>
              <PropertyField icon={<Calendar className="h-4 w-4" />} label="목표 마감일">
                <DateInputField
                  value={localDueDate}
                  onChange={(e) => setLocalDueDate(e.target.value)}
                  onBlur={() => {
                    const val = localDueDate || null
                    if (val !== (workItem.due_date ?? null)) {
                      handleFieldChange('due_date', val)
                    }
                  }}
                  disabled={isSaving}
                />
              </PropertyField>
            </div>
          </div>

          {/* 실적 일정 그룹 */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">실적 일정</p>
            <div className="space-y-1">
              <PropertyField icon={<CalendarClock className="h-4 w-4" />} label="시작일">
                <DateInputField
                  value={localActualStartDate}
                  onChange={(e) => setLocalActualStartDate(e.target.value)}
                  onBlur={() => {
                    const val = localActualStartDate || null
                    if (val !== (workItemWithExtras?.actual_start_date ?? null)) {
                      handleFieldChange('actual_start_date', val)
                    }
                  }}
                  disabled={isSaving}
                />
              </PropertyField>
              <PropertyField icon={<Calendar className="h-4 w-4" />} label="종료일">
                <DateInputField
                  value={localActualEndDate}
                  onChange={(e) => setLocalActualEndDate(e.target.value)}
                  onBlur={() => {
                    const val = localActualEndDate || null
                    if (val !== (workItemWithExtras?.actual_end_date ?? null)) {
                      handleFieldChange('actual_end_date', val)
                    }
                  }}
                  disabled={isSaving}
                />
              </PropertyField>
            </div>
          </div>

          {/* 예상 공수 */}
          <PropertyField
            icon={<Timer className="h-4 w-4" />}
            label="예상 공수 (h)"
          >
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
                if (val !== (workItem.estimated_hours ?? null)) {
                  handleFieldChange('estimated_hours', val)
                }
              }}
              disabled={isSaving}
            />
          </PropertyField>

          {/* 실적 공수 */}
          <PropertyField
            icon={<Timer className="h-4 w-4" />}
            label="실적 공수 (h)"
          >
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
                if (val !== (workItem.actual_hours ?? null)) {
                  handleFieldChange('actual_hours', val)
                }
              }}
              disabled={isSaving}
            />
          </PropertyField>

          {/* 인원별 공수 합산 (하위 항목이 있을 때만) */}
          <ManHourSummary workItem={workItem} allWorkItems={allWorkItems} />
        </div>
      </AnimatedAccordion>

      {/* 외부 링크 섹션 */}
      <AnimatedAccordion title="외부 링크" defaultOpen={true} count={localExternalLinks.filter(l => l.url.trim()).length || undefined}>
        <div className="space-y-1.5">
          {localExternalLinks.map((link, idx) => {
            const domain = link.url ? detectLinkDomain(link.url) : null
            return (
              <div key={idx} className="flex items-center gap-1">
                {domain && <LinkDomainIcon domain={domain} className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                <Input
                  type="url"
                  className="h-7 text-xs flex-1"
                  placeholder="https://..."
                  value={link.url}
                  onChange={(e) => {
                    const updated = [...localExternalLinks]
                    updated[idx] = { ...updated[idx], url: e.target.value }
                    setLocalExternalLinks(updated)
                  }}
                  onBlur={() => {
                    const cleaned = localExternalLinks.filter((l) => l.url.trim())
                    handleFieldChange('external_links', cleaned.length > 0 ? cleaned : null)
                  }}
                  disabled={isSaving}
                />
                {link.url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => window.open(link.url, '_blank')}
                    title="새 탭에서 열기"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const updated = localExternalLinks.filter((_, i) => i !== idx)
                    setLocalExternalLinks(updated)
                    handleFieldChange('external_links', updated.length > 0 ? updated : null)
                  }}
                  disabled={isSaving}
                  title="삭제"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
          {localExternalLinks.length < 5 && (
            <button
              onClick={() => setLocalExternalLinks([...localExternalLinks, { url: '' }])}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              disabled={isSaving}
            >
              <Plus className="h-3 w-3" />
              링크 추가
            </button>
          )}
        </div>
      </AnimatedAccordion>

      {/* 의존성 섹션 (Folder는 링크 불가) */}
      {workItem.tracker.name !== 'Folder' && (
        <AnimatedAccordion title="의존성" defaultOpen={true}>
          <DependencySection
            workItemId={workItem.id}
            projectId={projectId}
            trackerName={workItem.tracker.name}
            onViewInGraph={onViewInGraph ? () => onViewInGraph(workItem.id) : undefined}
          />
        </AnimatedAccordion>
      )}

      {/* 댓글 섹션 */}
      <AnimatedAccordion title="댓글" defaultOpen={true}>
        <CommentsSection
          workItemId={workItem.id}
          projectId={projectId}
          currentUserId={currentUserId}
          members={members}
        />
      </AnimatedAccordion>
    </div>
  )
}

function BatchPropertyPanel({
  selectedIds,
  selectedCount,
  statuses,
  members,
  projectId,
}: {
  selectedIds: Set<string>
  selectedCount: number
  statuses: StatusRef[]
  members: PersonRef[]
  projectId: string
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const ids = Array.from(selectedIds)

  const handleBatchStatusChange = async (statusId: string) => {
    setIsSaving(true)
    await batchUpdateStatus(ids, statusId, projectId)
    setIsSaving(false)
  }

  const handleBatchPriorityChange = async (priority: string) => {
    setIsSaving(true)
    await batchUpdateField(ids, { priority: parseInt(priority) }, projectId)
    setIsSaving(false)
  }

  const handleBatchAssigneeChange = async (assigneeId: string) => {
    setIsSaving(true)
    await batchUpdateField(
      ids,
      { assignee_id: assigneeId === 'unassigned' ? null : assigneeId },
      projectId
    )
    setIsSaving(false)
  }

  const handleBatchDelete = async () => {
    setIsSaving(true)
    await batchDelete(ids, projectId)
    setIsSaving(false)
    setShowDeleteDialog(false)
  }

  return (
    <div
      className="h-full bg-muted/20 overflow-y-auto"
      style={{ WebkitMaskImage: scrollMaskBoth, maskImage: scrollMaskBoth }}
    >
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <h3 className="font-medium">일괄 편집</h3>
      </div>

      <div className="p-4 space-y-2.5">
        {/* 선택 개수 */}
        <div className="text-center py-4">
          <p className="text-2xl font-bold text-primary mb-1">{selectedCount}</p>
          <p className="text-sm text-muted-foreground">개 항목 선택됨</p>
        </div>

        <Separator />

        {/* 상태 일괄 변경 */}
        <PropertyField
          icon={<AlertCircle className="h-4 w-4" />}
          label="상태 변경"
        >
          <Select
            onValueChange={handleBatchStatusChange}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8">
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
        </PropertyField>

        {/* 우선순위 일괄 변경 */}
        <PropertyField
          icon={<Flag className="h-4 w-4" />}
          label="우선순위 변경"
        >
          <Select
            onValueChange={handleBatchPriorityChange}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="우선순위 선택" />
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

        {/* 공개 수준 일괄 변경 */}
        <PropertyField
          icon={<Lock className="h-4 w-4" />}
          label="공개 수준 변경"
        >
          <Select
            onValueChange={async (value) => {
              setIsSaving(true)
              await batchUpdateField(ids, { visibility: value as 'internal' | 'public' }, projectId)
              setIsSaving(false)
            }}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="공개 수준 선택" />
            </SelectTrigger>
            <SelectContent>
              {visibilityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <opt.icon className={cn("h-3.5 w-3.5", opt.color)} />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyField>

        {/* 담당자 일괄 변경 */}
        <PropertyField
          icon={<User className="h-4 w-4" />}
          label="담당자 변경"
        >
          <Select
            onValueChange={handleBatchAssigneeChange}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="담당자 선택" />
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

        <Separator />

        {/* 로딩 인디케이터 */}
        {isSaving && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>처리 중...</span>
          </div>
        )}

        {/* 일괄 삭제 */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isSaving}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {selectedCount}개 항목 삭제
        </Button>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>일괄 삭제 확인</DialogTitle>
              <DialogDescription>
                선택한 {selectedCount}개 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isSaving}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleBatchDelete}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function ManHourSummary({ workItem, allWorkItems }: { workItem: WorkItemWithRelations; allWorkItems: WorkItemWithRelations[] }) {
  // childrenMap으로 O(1) 자식 조회 (O(n²) → O(n))
  const childrenMap = useMemo(() => {
    const map = new Map<string, WorkItemWithRelations[]>()
    for (const item of allWorkItems) {
      if (!item.parent_id) continue
      if (!map.has(item.parent_id)) map.set(item.parent_id, [])
      map.get(item.parent_id)!.push(item)
    }
    return map
  }, [allWorkItems])

  function getDescendants(parentId: string): WorkItemWithRelations[] {
    const children = childrenMap.get(parentId) ?? []
    return children.flatMap(c => [c, ...getDescendants(c.id)])
  }

  const descendants = getDescendants(workItem.id)
  if (descendants.length === 0) return null

  // 인원별 집계 (담당자 기준 — 사람 + 에이전트)
  const byPerson = new Map<string, { name: string; estimated: number; actual: number }>()
  for (const item of descendants) {
    const display = getAssigneeDisplay(item)
    const key = display ? (item.assignee?.id || `agent:${item.agent_assignee?.id}`) : '__unassigned__'
    const name = display?.name || '미배정'
    const entry = byPerson.get(key) || { name, estimated: 0, actual: 0 }
    entry.estimated += item.estimated_hours || 0
    entry.actual += item.actual_hours || 0
    byPerson.set(key, entry)
  }

  // 자기 자신도 포함
  const selfDisplay = getAssigneeDisplay(workItem)
  const selfKey = selfDisplay ? (workItem.assignee?.id || `agent:${workItem.agent_assignee?.id}`) : '__unassigned__'
  const selfName = selfDisplay?.name || '미배정'
  if (workItem.estimated_hours || workItem.actual_hours) {
    const entry = byPerson.get(selfKey) || { name: selfName, estimated: 0, actual: 0 }
    entry.estimated += workItem.estimated_hours || 0
    entry.actual += workItem.actual_hours || 0
    byPerson.set(selfKey, entry)
  }

  const entries = Array.from(byPerson.values()).filter(e => e.estimated > 0 || e.actual > 0)
  if (entries.length === 0) return null

  const totalEstimated = entries.reduce((sum, e) => sum + e.estimated, 0)
  const totalActual = entries.reduce((sum, e) => sum + e.actual, 0)

  return (
    <>
      <Separator />
      <PropertyField
        icon={<Users className="h-4 w-4" />}
        label="인원별 공수 합산"
      >
        <div className="space-y-1.5 text-sm">
          {entries.toSorted((a, b) => b.estimated - a.estimated).map((entry) => (
            <div key={entry.name} className="flex items-center justify-between">
              <span className="text-muted-foreground truncate max-w-[120px]">{entry.name}</span>
              <span className="font-mono text-xs">
                <span className="text-muted-foreground">{entry.actual}h</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span>{entry.estimated}h</span>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 border-t font-medium">
            <span>합계</span>
            <span className="font-mono text-xs">
              <span className={cn(totalActual > totalEstimated && 'text-red-500')}>{totalActual}h</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span>{totalEstimated}h</span>
            </span>
          </div>
        </div>
      </PropertyField>
    </>
  )
}

function ProjectSummaryPanel({
  allWorkItems,
}: {
  allWorkItems: WorkItemWithRelations[]
  statuses: StatusRef[]
  members: PersonRef[]
}) {
  if (allWorkItems.length === 0) {
    return (
      <div className="h-full bg-muted/20 p-4">
        <div className="mb-4">
          <h3 className="font-medium">프로젝트 요약</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          작업이 없습니다. 새 아이템을 추가하세요.
        </p>
      </div>
    )
  }

  const closedCount = allWorkItems.filter(
    (w) => w.status && (w.status.is_closed || w.status.name === '완료')
  ).length
  const completionRate = Math.round((closedCount / allWorkItems.length) * 100)

  // 상태별 카운트
  const statusMap = new Map<string, { status: StatusRef; count: number }>()
  for (const item of allWorkItems) {
    if (!item.status_id || !item.status) continue
    const existing = statusMap.get(item.status_id)
    if (existing) {
      existing.count++
    } else {
      statusMap.set(item.status_id, { status: item.status, count: 1 })
    }
  }
  const statusEntries = [...statusMap.values()]
    .toSorted((a, b) => (a.status.position ?? 0) - (b.status.position ?? 0))

  // 담당자별 카운트 (사람 + 에이전트)
  const assigneeMap = new Map<string, { name: string; count: number; isAgent: boolean }>()
  let unassignedCount = 0
  for (const item of allWorkItems) {
    const display = getAssigneeDisplay(item)
    if (display) {
      const key = item.assignee?.id || `agent:${item.agent_assignee?.id}`
      const existing = assigneeMap.get(key)
      if (existing) {
        existing.count++
      } else {
        assigneeMap.set(key, {
          name: display.name || '이름 없음',
          count: 1,
          isAgent: display.isAgent,
        })
      }
    } else {
      unassignedCount++
    }
  }
  const topAssignees = [...assigneeMap.values()]
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 4)

  // 최근 변경 3개
  const recentItems = allWorkItems
    .toSorted(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
    )
    .slice(0, 3)

  return (
    <div
      className="h-full bg-muted/20 overflow-y-auto"
      style={{ WebkitMaskImage: scrollMaskBoth, maskImage: scrollMaskBoth }}
    >
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <h3 className="font-medium">프로젝트 요약</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* 완료율 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">완료율</span>
            <span className="font-medium">{completionRate}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {closedCount} / {allWorkItems.length} 완료
          </p>
        </div>

        <Separator />

        {/* 상태별 분포 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span>상태별 분포</span>
          </div>
          <div className="space-y-1.5">
            {statusEntries.map(({ status, count }) => (
              <div key={status.id} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: status.color || '#94a3b8' }}
                />
                <span className="text-sm flex-1 truncate">{status.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{count}</span>
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / allWorkItems.length) * 100}%`,
                      backgroundColor: status.color || '#94a3b8',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* 담당자별 작업 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>담당자별 작업</span>
          </div>
          <div className="space-y-1.5">
            {topAssignees.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[160px]">{entry.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{entry.count}</span>
              </div>
            ))}
            {unassignedCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">미배정</span>
                <span className="text-xs text-muted-foreground font-mono">{unassignedCount}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* 공개 수준별 분포 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span>공개 수준</span>
          </div>
          <div className="space-y-1.5">
            {(() => {
              const internalCount = allWorkItems.filter(w => w.visibility !== 'public').length
              const publicCount = allWorkItems.filter(w => w.visibility === 'public').length
              return (
                <>
                  <div className="flex items-center gap-2">
                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm flex-1">내부</span>
                    <span className="text-xs text-muted-foreground font-mono">{internalCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-3 w-3 text-green-500 flex-shrink-0" />
                    <span className="text-sm flex-1">공개</span>
                    <span className="text-xs text-muted-foreground font-mono">{publicCount}</span>
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        <Separator />

        {/* 최근 변경 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <History className="h-4 w-4" />
            <span>최근 변경</span>
          </div>
          <div className="space-y-1.5">
            {recentItems.map((item) => {
              const date = new Date(item.updated_at || item.created_at)
              const formatted = `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
              return (
                <div key={item.id} className="text-sm">
                  <p className="truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{formatted}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// 날짜 입력 필드: 단일 클릭 = 텍스트 편집, 더블 클릭 = 캘린더 피커
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
      // showPicker() 미지원 환경 (Safari 구버전 등) → 무시
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
