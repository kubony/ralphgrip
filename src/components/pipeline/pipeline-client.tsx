'use client'

import React, { useCallback, useState, useMemo } from 'react'
import { PipelineSummary } from './pipeline-summary'
import { PipelineStats } from './pipeline-stats'
import PipelineGantt from './pipeline-gantt'
import { PipelineDetailSheet } from './pipeline-detail-sheet'
import type { PipelineProject, PipelineCategoryOrUncategorized } from './types'
import { CATEGORY_ORDER } from './types'
import type { ProjectSettings } from '@/types/database'
import type { ProjectCardSummary } from '@/lib/supabase/cached-queries'
import { updatePipelineInfo } from '@/app/(dashboard)/pipeline/actions'

type TypeFilter = 'all' | 'requirement' | 'issue'

interface PipelineClientProps {
  projects: {
    id: string
    key: string
    name: string
    project_type: string
    settings: ProjectSettings | null
  }[]
  summaries: Record<string, ProjectCardSummary>
  dateRanges: Record<string, { minStart: string | null; maxDue: string | null }>
}

const FIELD_MAP: Record<string, string> = {
  startDate: 'pipeline_start_date',
  endDate: 'pipeline_end_date',
  budget: 'pipeline_budget',
  phase: 'pipeline_phase',
  note: 'pipeline_note',
  category: 'pipeline_category',
}

export type GroupedRow =
  | { type: 'header'; category: PipelineCategoryOrUncategorized; count: number; budgetSum: string }
  | { type: 'project'; project: PipelineProject; globalIndex: number }

export type SortKey = 'name' | 'budget' | 'owner' | 'phase' | 'progress'
export type SortDir = 'asc' | 'desc'
export type ProgressMode = 'elapsed' | 'completion'

export const SORT_LABELS: Record<SortKey, string> = {
  name: '프로젝트명',
  budget: '금액',
  owner: '소유자',
  phase: '단계',
  progress: '진행률',
}

export function calcElapsedPct(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const now = new Date()
  const total = end.getTime() - start.getTime()
  if (total <= 0) return 0
  const elapsed = now.getTime() - start.getTime()
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)))
}

export function calcCompletionPct(closedCount: number, itemCount: number): number {
  return itemCount > 0 ? Math.round((closedCount / itemCount) * 100) : 0
}

function parseBudget(s: string | null): number {
  if (!s) return -Infinity
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : -Infinity
}

const PHASE_ORDER: Record<string, number> = { prospect: 0, sales: 1, contracted: 2, active: 3, delivered: 4, settled: 5 }

const DEFAULT_SUMMARY_HEIGHT = 240
const MIN_SUMMARY_HEIGHT = 100
const MAX_SUMMARY_HEIGHT = 600

export function PipelineClient({ projects, summaries, dateRanges }: PipelineClientProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('requirement')
  const [sortKey, setSortKey] = useState<SortKey>('phase')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [progressMode, setProgressMode] = useState<ProgressMode>('elapsed')

  // Layout state
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false)
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(true)
  const [summaryHeight, setSummaryHeight] = useState(DEFAULT_SUMMARY_HEIGHT)
  const [, setIsDraggingBottom] = useState(false)

  // Detail sheet
  const [selectedProject, setSelectedProject] = useState<PipelineProject | null>(null)

  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const pipelineProjects: PipelineProject[] = useMemo(
    () =>
      projects.map((p) => {
        const s = p.settings ?? {}
        const summary = summaries[p.id]
        const range = dateRanges[p.id]

        const startDate = s.pipeline_start_date ?? range?.minStart ?? null
        const endDate = s.pipeline_end_date ?? range?.maxDue ?? null

        return {
          id: p.id,
          key: p.key,
          name: p.name,
          projectType: p.project_type,
          startDate,
          endDate,
          budget: s.pipeline_budget ?? null,
          phase: s.pipeline_phase ?? 'active',
          category: s.pipeline_category ?? 'uncategorized',
          note: s.pipeline_note ?? null,
          itemCount: summary?.item_count ?? 0,
          closedCount: summary?.closed_count ?? 0,
          memberCount: summary?.member_count ?? 0,
          members: summary?.members ?? [],
          ownerName: summary?.owner_name ?? null,
          ownerAvatarUrl: summary?.owner_avatar_url ?? null,
          settings: s,
        }
      }),
    [projects, summaries, dateRanges]
  )

  const filteredProjects = useMemo(() => {
    let result = pipelineProjects
    if (typeFilter !== 'all') {
      result = result.filter((p) => p.projectType === typeFilter)
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return result.toSorted((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name, 'ko')
        case 'budget':
          return dir * (parseBudget(a.budget) - parseBudget(b.budget))
        case 'owner':
          return dir * (a.ownerName ?? '').localeCompare(b.ownerName ?? '', 'ko')
        case 'phase':
          return dir * ((PHASE_ORDER[a.phase] ?? 9) - (PHASE_ORDER[b.phase] ?? 9))
        case 'progress': {
          const pctA = progressMode === 'elapsed'
            ? calcElapsedPct(a.startDate, a.endDate)
            : calcCompletionPct(a.closedCount, a.itemCount)
          const pctB = progressMode === 'elapsed'
            ? calcElapsedPct(b.startDate, b.endDate)
            : calcCompletionPct(b.closedCount, b.itemCount)
          return dir * (pctA - pctB)
        }
        default:
          return 0
      }
    })
  }, [pipelineProjects, typeFilter, sortKey, sortDir, progressMode])

  const groupedRows: GroupedRow[] = useMemo(() => {
    const groups = new Map<PipelineCategoryOrUncategorized, PipelineProject[]>()
    for (const cat of CATEGORY_ORDER) {
      const items = filteredProjects.filter((p) => p.category === cat)
      if (items.length > 0) groups.set(cat, items)
    }

    const rows: GroupedRow[] = []
    let globalIndex = 0
    for (const [cat, items] of groups) {
      let budgetTotal = 0
      let hasBudget = false
      for (const p of items) {
        if (p.budget) {
          const m = p.budget.match(/[\d.]+/)
          if (m) {
            budgetTotal += parseFloat(m[0])
            hasBudget = true
          }
        }
      }
      const unit = items.find((p) => p.budget)?.budget?.replace(/[\d.,\s]/g, '') ?? ''
      const budgetSum = hasBudget ? `${budgetTotal.toLocaleString()}${unit}` : ''

      rows.push({ type: 'header', category: cat, count: items.length, budgetSum })
      for (const p of items) {
        rows.push({ type: 'project', project: p, globalIndex })
        globalIndex++
      }
    }
    return rows
  }, [filteredProjects])

  const handleUpdate = useCallback(
    async (projectId: string, updates: Record<string, string | undefined>) => {
      const project = pipelineProjects.find((p) => p.id === projectId)
      if (!project) return

      const mapped: Record<string, string | undefined> = {}
      for (const [key, value] of Object.entries(updates)) {
        const dbKey = FIELD_MAP[key] ?? key
        mapped[dbKey] = value
      }

      const result = await updatePipelineInfo(projectId, project.settings, mapped)
      if (result?.error) {
        console.error('[pipeline] update failed:', result.error)
      }
    },
    [pipelineProjects]
  )

  const typeCounts = useMemo(() => {
    let requirement = 0, issue = 0
    for (const p of pipelineProjects) {
      if (p.projectType === 'requirement') requirement++
      else if (p.projectType === 'issue') issue++
    }
    return { all: pipelineProjects.length, requirement, issue }
  }, [pipelineProjects])

  const handleSelectProject = useCallback((project: PipelineProject) => {
    setSelectedProject(project)
  }, [])

  // Bottom resize handler (same pattern as timeline-view.tsx)
  const handleBottomResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setIsDraggingBottom(true)
      const startY = e.clientY
      const startHeight = summaryHeight

      const onMove = (moveE: PointerEvent) => {
        const delta = startY - moveE.clientY
        setSummaryHeight(Math.min(MAX_SUMMARY_HEIGHT, Math.max(MIN_SUMMARY_HEIGHT, startHeight + delta)))
      }
      const onUp = (upE: PointerEvent) => {
        el.releasePointerCapture(upE.pointerId)
        setIsDraggingBottom(false)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [summaryHeight]
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Stats section */}
      <PipelineStats
        projects={filteredProjects}
        isCollapsed={isStatsCollapsed}
        onToggleCollapse={() => setIsStatsCollapsed((v) => !v)}
      />

      {/* Gantt section — takes remaining space */}
      <div className="flex-1 min-h-0 mt-3">
        <PipelineGantt
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          typeCounts={typeCounts}
          projects={filteredProjects}
          groupedRows={groupedRows}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          progressMode={progressMode}
          onToggleProgressMode={() => setProgressMode((m) => (m === 'elapsed' ? 'completion' : 'elapsed'))}
          onSelectProject={handleSelectProject}
        />
      </div>

      {/* Resize handle (between gantt and summary) */}
      {!isSummaryCollapsed && (
        <div
          className="flex-shrink-0 h-1.5 cursor-row-resize group relative mt-1"
          onPointerDown={handleBottomResizePointerDown}
          onDoubleClick={() => setSummaryHeight(DEFAULT_SUMMARY_HEIGHT)}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border group-hover:bg-primary/50 transition-colors" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
        </div>
      )}

      {/* Summary section */}
      <div
        className="flex-shrink-0"
        style={{ height: isSummaryCollapsed ? 36 : summaryHeight }}
      >
        <PipelineSummary
          projects={filteredProjects}
          groupedRows={groupedRows}
          onUpdate={handleUpdate}
          isCollapsed={isSummaryCollapsed}
          onToggleCollapse={() => setIsSummaryCollapsed((v) => !v)}
          onSelectProject={handleSelectProject}
        />
      </div>

      {/* Detail Sheet */}
      <PipelineDetailSheet
        project={selectedProject}
        open={selectedProject !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedProject(null)
        }}
      />
    </div>
  )
}
