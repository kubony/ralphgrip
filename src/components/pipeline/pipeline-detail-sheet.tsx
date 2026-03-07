'use client'

import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PipelineProject } from './types'
import { PHASE_CONFIG, CATEGORY_CONFIG } from './types'
import { calcElapsedPct, calcCompletionPct } from './pipeline-client'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock'
import Users from 'lucide-react/dist/esm/icons/users'
import User from 'lucide-react/dist/esm/icons/user'
import Banknote from 'lucide-react/dist/esm/icons/banknote'
import StickyNote from 'lucide-react/dist/esm/icons/sticky-note'
import Tag from 'lucide-react/dist/esm/icons/tag'
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'

interface PipelineDetailSheetProps {
  project: PipelineProject | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AVATAR_SIZE = 28

function MemberAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const initials = name?.charAt(0)?.toUpperCase() || '?'

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name ?? ''}
        className="rounded-full ring-1 ring-border"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div
      className="rounded-full flex items-center justify-center bg-muted text-[10px] font-medium ring-1 ring-border"
      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
    >
      {initials}
    </div>
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
      <div className="flex-1 min-w-0 flex items-center h-8">
        {children}
      </div>
    </div>
  )
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) {
    return `${startDate} ~ ${endDate}`
  }
  if (startDate) return `${startDate} ~`
  if (endDate) return `~ ${endDate}`
  return null
}

function calcDaysRemaining(endDate: string | null): { days: number; label: string; color: string } | null {
  if (!endDate) return null
  const end = new Date(endDate)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (days < 0) return { days: Math.abs(days), label: `${Math.abs(days)}일 초과`, color: 'text-red-500' }
  if (days === 0) return { days: 0, label: '오늘 마감', color: 'text-amber-500' }
  if (days <= 7) return { days, label: `${days}일 남음`, color: 'text-amber-500' }
  return { days, label: `${days}일 남음`, color: 'text-muted-foreground' }
}

export function PipelineDetailSheet({ project, open, onOpenChange }: PipelineDetailSheetProps) {
  if (!project) return null

  const phaseConfig = PHASE_CONFIG[project.phase]
  const catConfig = CATEGORY_CONFIG[project.category]
  const elapsedPct = calcElapsedPct(project.startDate, project.endDate)
  const completionPct = calcCompletionPct(project.closedCount, project.itemCount)
  const dateRange = formatDateRange(project.startDate, project.endDate)
  const remaining = calcDaysRemaining(project.endDate)

  // 경과율 vs 완료율 차이로 건강 상태 판단
  const healthGap = elapsedPct - completionPct
  const healthStatus = healthGap > 20
    ? { label: '지연', color: 'text-red-500', bgColor: 'bg-red-500/10' }
    : healthGap > 5
      ? { label: '주의', color: 'text-amber-500', bgColor: 'bg-amber-500/10' }
      : { label: '정상', color: 'text-green-500', bgColor: 'bg-green-500/10' }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto p-0"
        showCloseButton={true}
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 pr-8">
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
              {project.key}
            </Badge>
            <div className="flex items-center gap-1.5 ml-auto">
              <span
                className={cn(
                  'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded',
                  phaseConfig.bgColor,
                  phaseConfig.color,
                )}
              >
                {phaseConfig.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded',
                  catConfig.bgColor,
                  catConfig.color,
                )}
              >
                {catConfig.label}
              </span>
            </div>
          </div>

          <SheetTitle className="text-left text-lg">
            {project.name}
          </SheetTitle>

          <SheetDescription className="sr-only">
            프로젝트 상세 정보
          </SheetDescription>

          <Link
            href={`/projects/${project.key}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors w-fit"
          >
            <ExternalLink className="h-3 w-3" />
            프로젝트에서 열기
          </Link>
        </SheetHeader>

        <Separator />

        {/* 진행 현황 — 시각적 하이라이트 섹션 */}
        <div className="px-4 py-4 space-y-3">
          {/* 건강 상태 + D-day */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md',
                healthStatus.bgColor,
                healthStatus.color,
              )}
            >
              <AlertCircle className="h-3 w-3" />
              {healthStatus.label}
            </span>
            {remaining && (
              <span className={cn('text-xs font-medium', remaining.color)}>
                {remaining.label}
              </span>
            )}
          </div>

          {/* 듀얼 프로그레스 */}
          <div className="space-y-2.5">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  경과율
                </span>
                <span className="font-medium tabular-nums">{elapsedPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${elapsedPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  완료율
                </span>
                <span className="font-medium tabular-nums">
                  {completionPct}%
                  <span className="text-muted-foreground ml-1">({project.closedCount}/{project.itemCount})</span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* 속성 섹션 */}
        <div className="px-4 py-3 space-y-1">
          {/* 기간 */}
          <PropertyField icon={<CalendarClock className="h-4 w-4" />} label="기간">
            <span className="text-sm">
              {dateRange ?? <span className="text-muted-foreground">미설정</span>}
            </span>
          </PropertyField>

          {/* 금액 */}
          <PropertyField icon={<Banknote className="h-4 w-4" />} label="금액">
            <span className="text-sm">
              {project.budget
                ? <span className="font-medium">{project.budget}</span>
                : <span className="text-muted-foreground">미입력</span>
              }
            </span>
          </PropertyField>

          {/* 단계 */}
          <PropertyField icon={<Tag className="h-4 w-4" />} label="단계">
            <span
              className={cn(
                'inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded',
                phaseConfig.bgColor,
                phaseConfig.color,
              )}
            >
              {phaseConfig.label}
            </span>
          </PropertyField>

          {/* 분류 */}
          <PropertyField icon={<Tag className="h-4 w-4" />} label="분류">
            <span
              className={cn(
                'inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded',
                catConfig.bgColor,
                catConfig.color,
              )}
            >
              {catConfig.label}
            </span>
          </PropertyField>

          {/* 소유자 */}
          <PropertyField icon={<User className="h-4 w-4" />} label="소유자">
            {project.ownerName || project.ownerAvatarUrl ? (
              <div className="flex items-center gap-1.5">
                <MemberAvatar name={project.ownerName} avatarUrl={project.ownerAvatarUrl} />
                <span className="text-sm">{project.ownerName ?? '이름 없음'}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">미배정</span>
            )}
          </PropertyField>
        </div>

        <Separator />

        {/* 멤버 섹션 */}
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>멤버</span>
            <span className="text-[10px] tabular-nums ml-auto">{project.memberCount}명</span>
          </div>
          {project.members.length > 0 ? (
            <div className="space-y-1.5">
              {project.members.map((member, i) => (
                <div key={i} className="flex items-center gap-2">
                  <MemberAvatar name={member.name} avatarUrl={member.avatar_url} />
                  <span className="text-sm truncate">{member.name ?? '이름 없음'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">멤버 없음</p>
          )}
        </div>

        {/* 비고 섹션 */}
        {project.note && (
          <>
            <Separator />
            <div className="px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StickyNote className="h-4 w-4" />
                <span>비고</span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.note}</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
