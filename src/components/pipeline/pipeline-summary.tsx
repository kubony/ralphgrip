'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { PipelineProject } from './types'
import { PHASE_CONFIG, CATEGORY_CONFIG, CATEGORIES } from './types'
import type { PipelinePhase } from '@/types/database'
import type { GroupedRow } from './pipeline-client'
import Users from 'lucide-react/dist/esm/icons/users'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'

interface PipelineSummaryProps {
  projects: PipelineProject[]
  groupedRows: GroupedRow[]
  onUpdate: (projectId: string, updates: Record<string, string | undefined>) => Promise<void>
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSelectProject?: (project: PipelineProject) => void
}

const PHASES: PipelinePhase[] = ['prospect', 'sales', 'contracted', 'active', 'delivered', 'settled']

function ProjectRow({
  project,
  isEven,
  onUpdate,
  onSelectProject,
}: {
  project: PipelineProject
  isEven: boolean
  onUpdate: (projectId: string, updates: Record<string, string | undefined>) => Promise<void>
  onSelectProject?: (project: PipelineProject) => void
}) {
  const [, startTransition] = useTransition()
  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [endDate, setEndDate] = useState(project.endDate ?? '')
  const [budget, setBudget] = useState(project.budget ?? '')
  const [note, setNote] = useState(project.note ?? '')
  const [localCategory, setLocalCategory] = useState(project.category === 'uncategorized' ? '' : project.category)

  const progressPct =
    project.itemCount > 0
      ? Math.round((project.closedCount / project.itemCount) * 100)
      : 0

  function commitField(field: string, value: string) {
    startTransition(async () => {
      await onUpdate(project.id, { [field]: value || undefined })
    })
  }

  function handlePhaseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newPhase = e.target.value as PipelinePhase
    startTransition(async () => {
      await onUpdate(project.id, { phase: newPhase })
    })
  }

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setLocalCategory(val)
    startTransition(async () => {
      await onUpdate(project.id, { category: val || undefined })
    })
  }

  const phaseConfig = PHASE_CONFIG[project.phase]
  const effectiveCategory = localCategory || 'uncategorized'
  const catConfig = CATEGORY_CONFIG[effectiveCategory as keyof typeof CATEGORY_CONFIG]

  function handleRowClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.closest('input, select, a, button')) return
    onSelectProject?.(project)
  }

  return (
    <div
      className={cn(
        'grid items-center gap-x-2 px-3 py-2 text-sm',
        'grid-cols-[minmax(140px,1.5fr)_80px_minmax(200px,2fr)_minmax(80px,1fr)_minmax(80px,1fr)_80px_60px_minmax(80px,1fr)]',
        isEven ? 'bg-muted/30' : 'bg-transparent',
        onSelectProject && 'cursor-pointer hover:bg-muted/50',
      )}
      onClick={handleRowClick}
    >
      {/* 프로젝트명 */}
      <Link
        href={`/projects/${project.key}`}
        className="truncate font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
      >
        {project.name}
      </Link>

      {/* 분류 */}
      <select
        value={localCategory}
        onChange={handleCategoryChange}
        className={cn(
          'border-0 rounded px-1 py-0.5 text-[10px] font-medium outline-none focus:outline-none cursor-pointer',
          catConfig.bgColor,
          catConfig.color,
        )}
      >
        <option value="">미분류</option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {CATEGORY_CONFIG[cat].label}
          </option>
        ))}
      </select>

      {/* 기간 */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={startDate}
          className="w-[90px] border-0 border-b border-transparent focus:border-primary bg-transparent text-xs outline-none focus:outline-none"
          onChange={(e) => setStartDate(e.target.value)}
          onBlur={(e) => commitField('startDate', e.target.value)}
        />
        <span className="text-muted-foreground text-xs">~</span>
        <input
          type="date"
          value={endDate}
          className="w-[90px] border-0 border-b border-transparent focus:border-primary bg-transparent text-xs outline-none focus:outline-none"
          onChange={(e) => setEndDate(e.target.value)}
          onBlur={(e) => commitField('endDate', e.target.value)}
        />
      </div>

      {/* 진행률 */}
      <div className="flex flex-col gap-1">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {project.closedCount}/{project.itemCount}
        </span>
      </div>

      {/* 금액 */}
      <input
        type="text"
        value={budget}
        placeholder="미입력"
        className="border-0 border-b border-transparent focus:border-primary bg-transparent text-sm text-right outline-none focus:outline-none w-full placeholder:text-muted-foreground/50"
        onChange={(e) => setBudget(e.target.value)}
        onBlur={(e) => commitField('budget', e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
      />

      {/* 단계 */}
      <select
        value={project.phase}
        onChange={handlePhaseChange}
        className={cn(
          'border-0 rounded px-1 py-0.5 text-xs font-medium outline-none focus:outline-none cursor-pointer',
          phaseConfig.bgColor,
          phaseConfig.color,
        )}
      >
        {PHASES.map((phase) => (
          <option key={phase} value={phase}>
            {PHASE_CONFIG[phase].label}
          </option>
        ))}
      </select>

      {/* 인원 */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-center">
        <Users className="h-3.5 w-3.5 shrink-0" />
        <span>{project.memberCount}</span>
      </div>

      {/* 비고 */}
      <input
        type="text"
        value={note}
        placeholder="비고"
        className="border-0 border-b border-transparent focus:border-primary bg-transparent text-sm outline-none focus:outline-none w-full placeholder:text-muted-foreground/50"
        onChange={(e) => setNote(e.target.value)}
        onBlur={(e) => commitField('note', e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

export function PipelineSummary({ projects, groupedRows, onUpdate, isCollapsed, onToggleCollapse, onSelectProject }: PipelineSummaryProps) {
  let groupItemIndex = 0

  return (
    <div className="h-full flex flex-col">
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 px-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 transition-transform', !isCollapsed && 'rotate-90')}
        />
        <span>프로젝트 목록</span>
        <span className="text-[10px] tabular-nums text-muted-foreground/60">{projects.length}건</span>
      </button>

      {!isCollapsed && (
        <div className="rounded-lg border bg-card overflow-auto flex-1 min-h-0">
          {/* Header row */}
          <div
            className={cn(
              'grid items-center gap-x-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 border-b sticky top-0 z-10',
              'grid-cols-[minmax(140px,1.5fr)_80px_minmax(200px,2fr)_minmax(80px,1fr)_minmax(80px,1fr)_80px_60px_minmax(80px,1fr)]',
            )}
          >
            <span>프로젝트</span>
            <span>분류</span>
            <span>기간</span>
            <span>진행률</span>
            <span className="text-right">금액</span>
            <span>단계</span>
            <span className="text-center">인원</span>
            <span>비고</span>
          </div>

          {/* Rows */}
          {projects.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              프로젝트가 없습니다.
            </div>
          ) : (
            groupedRows.map((row) => {
              if (row.type === 'header') {
                const catConfig = CATEGORY_CONFIG[row.category]
                groupItemIndex = 0
                return (
                  <div
                    key={`header-${row.category}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 border-b',
                      catConfig.bgColor,
                    )}
                  >
                    <span className={cn('text-xs font-semibold', catConfig.color)}>{catConfig.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{row.count}건</span>
                    {row.budgetSum && (
                      <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">{row.budgetSum}</span>
                    )}
                  </div>
                )
              }

              const isEven = groupItemIndex % 2 === 1
              groupItemIndex++
              return (
                <ProjectRow
                  key={`${row.project.id}-${row.project.startDate}-${row.project.endDate}-${row.project.budget}-${row.project.note}-${row.project.category}`}
                  project={row.project}
                  isEven={isEven}
                  onUpdate={onUpdate}
                  onSelectProject={onSelectProject}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
