'use client'

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import Link from 'next/link'
import { useTimelineState, type ZoomLevel, ROW_HEIGHT, BAR_HEIGHT } from '@/hooks/use-timeline-state'
import TimelineHeader from '@/components/projects/timeline-header'
import TimelineGrid from '@/components/projects/timeline-grid'
import { parseISO, differenceInCalendarDays, format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { PipelineProject, PipelineMember, PipelineCategoryOrUncategorized } from './types'
import { PHASE_CONFIG, PHASE_HEX_COLORS, CATEGORY_CONFIG } from './types'
import { SORT_LABELS, calcElapsedPct, calcCompletionPct, type SortKey, type SortDir, type ProgressMode, type GroupedRow } from './pipeline-client'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import CalendarSearch from 'lucide-react/dist/esm/icons/calendar-search'
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2'
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2'

const DEFAULT_LEFT_WIDTH = 600
const AVATAR_SIZE = 18
const HEADER_HEIGHT = 46
const ZOOM_ORDER: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'half', 'year']
const ZOOM_LABELS: Record<ZoomLevel, string> = {
  hour: 'Hour',
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  half: 'Half',
  year: 'Year',
}

const SORT_KEYS: SortKey[] = ['name', 'budget', 'owner', 'phase', 'progress']

type TypeFilter = 'all' | 'requirement' | 'issue'

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: '전체',
  requirement: '요구사항',
  issue: '이슈',
}

interface PipelineGanttProps {
  projects: PipelineProject[]
  groupedRows: GroupedRow[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  progressMode: ProgressMode
  onToggleProgressMode: () => void
  typeFilter: TypeFilter
  onTypeFilterChange: (type: TypeFilter) => void
  typeCounts: Record<TypeFilter, number>
  onSelectProject?: (project: PipelineProject) => void
}

const PROGRESS_LABELS: Record<ProgressMode, string> = {
  elapsed: '경과율',
  completion: '완료율',
}

function MemberAvatar({ member }: { member: PipelineMember }) {
  const initials = member.name?.charAt(0)?.toUpperCase() || '?'

  if (member.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt=""
        className="rounded-full flex-shrink-0 ring-1 ring-background"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center bg-muted text-[8px] font-medium ring-1 ring-background"
      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
    >
      {initials}
    </div>
  )
}

function BarAvatar({ member }: { member: PipelineMember }) {
  const initials = member.name?.charAt(0)?.toUpperCase() || '?'
  const size = 16

  if (member.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt=""
        className="rounded-full flex-shrink-0 ring-1 ring-white/50"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center bg-white/30 text-[9px] font-medium text-gray-800 dark:bg-black/30 dark:text-gray-200 ring-1 ring-white/30"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  )
}

export default function PipelineGantt({ projects, groupedRows, sortKey, sortDir, onSort, progressMode, onToggleProgressMode, typeFilter, onTypeFilterChange, typeCounts, onSelectProject }: PipelineGanttProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  // Left panel resizable width
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH)
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)

  // Hover row for highlight
  const [hoveredRow, setHoveredRow] = useState<number>(-1)

  // Sort dropdown
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  // Tooltip
  const [tooltip, setTooltip] = useState<{ x: number; y: number; project: PipelineProject } | null>(null)

  // Focus mode
  const [isFocusMode, setIsFocusMode] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('pipeline-focus-mode', isFocusMode)
    return () => { document.documentElement.classList.remove('pipeline-focus-mode') }
  }, [isFocusMode])

  useEffect(() => {
    if (!isFocusMode) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFocusMode(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFocusMode])

  // Collapsed categories
  const [collapsedCategories, setCollapsedCategories] = useState<Set<PipelineCategoryOrUncategorized>>(new Set())

  const toggleCategory = useCallback((cat: PipelineCategoryOrUncategorized) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  // Visible rows (respecting collapsed state)
  const visibleRows = useMemo(() => {
    const rows: GroupedRow[] = []
    let currentCategory: PipelineCategoryOrUncategorized | null = null
    for (const row of groupedRows) {
      if (row.type === 'header') {
        currentCategory = row.category
        rows.push(row)
      } else {
        if (currentCategory && !collapsedCategories.has(currentCategory)) {
          rows.push(row)
        }
      }
    }
    return rows
  }, [groupedRows, collapsedCategories])

  // Close sort menu on outside click
  useEffect(() => {
    if (!sortMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [sortMenuOpen])

  const timelineItems = useMemo(
    () => projects.map((p) => ({ start_date: p.startDate, due_date: p.endDate })),
    [projects]
  )

  const timeline = useTimelineState(timelineItems, 'quarter')
  const {
    zoomLevel,
    setZoomLevel,
    pxPerDay,
    dateToX,
    dateRange,
    totalWidth,
    headerMonths,
    headerCells,
    todayX,
  } = timeline

  const totalHeight = visibleRows.length * ROW_HEIGHT

  // Body cursor during panel drag
  useEffect(() => {
    if (isDraggingLeft) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      return () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDraggingLeft])

  // Left panel resize handler (same pattern as timeline-view.tsx)
  const handleLeftResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setIsDraggingLeft(true)
      const startX = e.clientX
      const startWidth = leftWidth
      const onMove = (moveE: PointerEvent) => {
        const delta = moveE.clientX - startX
        setLeftWidth(Math.min(800, Math.max(180, startWidth + delta)))
      }
      const onUp = (upE: PointerEvent) => {
        el.releasePointerCapture(upE.pointerId)
        setIsDraggingLeft(false)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [leftWidth]
  )

  // Scroll to today on mount (refs avoid stale closure + unnecessary deps)
  const initialScrollDone = useRef(false)
  const todayXRef = useRef(todayX)
  const leftWidthRef = useRef(leftWidth)
  useEffect(() => {
    todayXRef.current = todayX
    leftWidthRef.current = leftWidth
  }, [todayX, leftWidth])
  useEffect(() => {
    if (initialScrollDone.current || !scrollContainerRef.current || projects.length === 0) return
    initialScrollDone.current = true
    requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return
      const containerWidth = scrollContainerRef.current.clientWidth
      scrollContainerRef.current.scrollLeft = todayXRef.current - containerWidth / 2 + leftWidthRef.current
    })
  }, [projects.length])

  const handleScrollToToday = useCallback(() => {
    if (!scrollContainerRef.current) return
    const containerWidth = scrollContainerRef.current.clientWidth
    scrollContainerRef.current.scrollLeft = todayX - containerWidth / 2 + leftWidth
  }, [todayX, leftWidth])

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border border-b-0 rounded-t-lg bg-background/95 backdrop-blur-sm">
        <h1 className="text-lg font-semibold">사업현황</h1>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-0.5">
          {(['all', 'requirement', 'issue'] as const).map((type) => (
            <button
              key={type}
              onClick={() => onTypeFilterChange(type)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                typeFilter === type
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {TYPE_LABELS[type]}
              <span
                className={cn(
                  'text-[10px] tabular-nums',
                  typeFilter === type ? 'text-primary-foreground/70' : 'text-muted-foreground/60'
                )}
              >
                {typeCounts[type]}
              </span>
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-0.5 bg-muted/80 rounded-md p-0.5 border shadow-sm">
          {ZOOM_ORDER.map((level) => (
            <button
              key={level}
              onClick={() => setZoomLevel(level)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                zoomLevel === level
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {ZOOM_LABELS[level]}
            </button>
          ))}
        </div>

        <button
          onClick={handleScrollToToday}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="오늘로 이동"
        >
          <CalendarSearch className="h-3.5 w-3.5" />
          <span>오늘</span>
        </button>

        <button
          onClick={() => setIsFocusMode((v) => !v)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            isFocusMode
              ? 'text-foreground bg-muted font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={isFocusMode ? '집중 모드 해제 (Esc)' : '집중 모드'}
        >
          {isFocusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{isFocusMode ? '해제' : '집중'}</span>
        </button>

        <div className="ml-auto" />

        {/* Progress mode toggle */}
        <button
          onClick={onToggleProgressMode}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border"
          title={`현재: ${PROGRESS_LABELS[progressMode]} (클릭하여 전환)`}
        >
          <span className="font-medium text-foreground">{PROGRESS_LABELS[progressMode]}</span>
        </button>
      </div>

      {/* Gantt grid */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto border rounded-b-lg flex-1 min-h-0"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${leftWidth}px ${totalWidth}px`,
            gridTemplateRows: `${HEADER_HEIGHT}px auto`,
            minWidth: leftWidth + totalWidth,
          }}
        >
          {/* Q1: top-left corner — sort dropdown */}
          <div
            ref={sortMenuRef}
            className="sticky left-0 top-0 z-30 flex items-center px-3 border-b border-r bg-background relative"
            style={{ height: HEADER_HEIGHT }}
          >
            <button
              onClick={() => setSortMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowUpDown className="h-3 w-3" />
              <span>{SORT_LABELS[sortKey]}</span>
              {sortDir === 'asc' ? (
                <ArrowUp className="h-3 w-3 text-primary" />
              ) : (
                <ArrowDown className="h-3 w-3 text-primary" />
              )}
            </button>

            {sortMenuOpen && (
              <div className="absolute top-full left-2 mt-1 w-32 bg-popover border rounded-md shadow-lg py-1 z-50">
                {SORT_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      onSort(key)
                      setSortMenuOpen(false)
                    }}
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-1.5 text-xs transition-colors',
                      sortKey === key
                        ? 'text-primary font-medium bg-primary/5'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <span>{SORT_LABELS[key]}</span>
                    {sortKey === key ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <span className="w-3" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Q2: top-right — timeline header */}
          <div className="sticky top-0 z-20 border-b bg-background">
            <TimelineHeader
              headerMonths={headerMonths}
              headerCells={headerCells}
              zoomLevel={zoomLevel}
              totalWidth={totalWidth}
            />
          </div>

          {/* Q3: bottom-left — project labels */}
          <div className="sticky left-0 z-10 border-r bg-background relative">
            {visibleRows.map((row, idx) => {
              if (row.type === 'header') {
                const catConfig = CATEGORY_CONFIG[row.category]
                const isCollapsed = collapsedCategories.has(row.category)
                return (
                  <div
                    key={`header-${row.category}`}
                    className={cn('flex items-center gap-2 px-3 border-b cursor-pointer select-none', catConfig.bgColor)}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => toggleCategory(row.category)}
                  >
                    <ChevronRight
                      className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !isCollapsed && 'rotate-90')}
                    />
                    <span className={cn('text-xs font-semibold', catConfig.color)}>{catConfig.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{row.count}건</span>
                    {row.budgetSum && (
                      <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">{row.budgetSum}</span>
                    )}
                  </div>
                )
              }

              const project = row.project
              const progressPct = progressMode === 'elapsed'
                ? calcElapsedPct(project.startDate, project.endDate)
                : calcCompletionPct(project.closedCount, project.itemCount)
              const phaseConfig = PHASE_CONFIG[project.phase]
              const owner = project.ownerAvatarUrl || project.ownerName
                ? { name: project.ownerName, avatar_url: project.ownerAvatarUrl }
                : null

              return (
                <div
                  key={project.id}
                  className={cn(
                    'flex items-center gap-2 px-3 border-b transition-colors cursor-pointer',
                    hoveredRow === idx && 'bg-muted/40'
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onMouseEnter={() => setHoveredRow(idx)}
                  onMouseLeave={() => setHoveredRow(-1)}
                  onClick={() => onSelectProject?.(project)}
                >
                  {/* Budget */}
                  <span className={cn(
                    'text-[11px] shrink-0 w-14 text-right tabular-nums',
                    project.budget ? 'font-medium text-foreground' : 'text-muted-foreground/50'
                  )}>
                    {project.budget || '미정'}
                  </span>
                  {/* Project name */}
                  <Link
                    href={`/projects/${project.key}`}
                    className="truncate text-sm font-medium hover:underline min-w-0 flex-1"
                    title={project.name}
                  >
                    {project.name}
                  </Link>
                  {/* Owner avatar */}
                  {owner ? (
                    <MemberAvatar member={owner} />
                  ) : (
                    <div className="shrink-0" style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} />
                  )}
                  {/* Phase */}
                  <span
                    className={cn(
                      'inline-flex items-center text-[10px] font-medium px-1 rounded leading-[14px] shrink-0',
                      phaseConfig.bgColor,
                      phaseConfig.color
                    )}
                  >
                    {phaseConfig.label}
                  </span>
                  {/* Progress */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-7 text-right">
                      {progressPct}%
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Resize handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-20"
              onPointerDown={handleLeftResizePointerDown}
              onDoubleClick={() => setLeftWidth(DEFAULT_LEFT_WIDTH)}
            />
          </div>

          {/* Q4: bottom-right — grid + bars */}
          <div className="relative" style={{ height: totalHeight }}>
            <TimelineGrid
              totalWidth={totalWidth}
              totalHeight={totalHeight}
              pxPerDay={pxPerDay}
              zoomLevel={zoomLevel}
              todayX={todayX}
              dateRange={dateRange}
              dateToX={dateToX}
            />

            {/* Row dividers + hover highlight + bars */}
            {visibleRows.map((row, idx) => {
              if (row.type === 'header') {
                const catConfig = CATEGORY_CONFIG[row.category]
                return (
                  <div
                    key={`header-${row.category}`}
                    className={cn('absolute left-0 right-0 border-b', catConfig.bgColor)}
                    style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT, opacity: 0.4 }}
                  />
                )
              }

              const project = row.project
              const top = idx * ROW_HEIGHT

              return (
                <React.Fragment key={project.id}>
                  {/* Row divider + hover */}
                  <div
                    className={cn(
                      'absolute left-0 right-0 border-b border-border/50',
                      hoveredRow === idx && 'bg-muted/20'
                    )}
                    style={{ top, height: ROW_HEIGHT }}
                    onMouseEnter={() => setHoveredRow(idx)}
                    onMouseLeave={() => setHoveredRow(-1)}
                  />

                  {/* Bar */}
                  {project.startDate && project.endDate && (() => {
                    const startDate = parseISO(project.startDate!)
                    const endDate = parseISO(project.endDate!)
                    const x = dateToX(startDate)
                    const barWidth = Math.max(
                      (differenceInCalendarDays(endDate, startDate) + 1) * pxPerDay,
                      4
                    )
                    const barTop = top + (ROW_HEIGHT - BAR_HEIGHT) / 2
                    const phaseColor = PHASE_HEX_COLORS[project.phase]
                    const showText = barWidth > 80
                    const maxBarAvatars = Math.min(Math.floor((barWidth - (showText ? 60 : 0)) / 14), 5, project.members.length)
                    const barMembers = project.members.slice(0, Math.max(maxBarAvatars, 0))
                    const barExtraCount = project.members.length - barMembers.length

                    return (
                      <Link
                        href={`/projects/${project.key}`}
                        className={cn(
                          'absolute rounded flex items-center px-2 text-xs select-none transition-opacity hover:opacity-90',
                          hoveredRow === idx && 'ring-1 ring-white/30'
                        )}
                        style={{
                          left: x,
                          top: barTop,
                          width: barWidth,
                          height: BAR_HEIGHT,
                          backgroundColor: `${phaseColor}BF`,
                          borderLeftWidth: 3,
                          borderLeftColor: phaseColor,
                          borderLeftStyle: 'solid',
                        }}
                        title={`${project.name} (${format(startDate, 'yyyy.M.d')} ~ ${format(endDate, 'yyyy.M.d')})`}
                        onClick={(e) => {
                          if (!e.metaKey && !e.ctrlKey && onSelectProject) {
                            e.preventDefault()
                            onSelectProject(project)
                          }
                        }}
                        onMouseEnter={(e) =>
                          setTooltip({ x: e.clientX, y: e.clientY, project })
                        }
                        onMouseLeave={() => setTooltip(null)}
                        onMouseMove={(e) => {
                          if (tooltip) setTooltip({ x: e.clientX, y: e.clientY, project })
                        }}
                      >
                        {showText && (
                          <span className="truncate text-gray-100 dark:text-gray-200 flex-1 min-w-0 font-medium">
                            {project.name}
                          </span>
                        )}
                        {!showText && <span className="flex-1" />}
                        {barMembers.length > 0 && (
                          <div className="flex items-center shrink-0">
                            {barMembers.map((m, i) => (
                              <div key={i} style={{ marginLeft: i === 0 ? 0 : -4 }}>
                                <BarAvatar member={m} />
                              </div>
                            ))}
                            {barExtraCount > 0 && (
                              <span className="text-[9px] text-white/70 ml-0.5">+{barExtraCount}</span>
                            )}
                          </div>
                        )}
                      </Link>
                    )
                  })()}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-popover text-popover-foreground border rounded-lg px-3 py-2 shadow-lg pointer-events-none"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y - 40,
          }}
        >
          <div className="text-sm font-medium">{tooltip.project.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {tooltip.project.startDate && tooltip.project.endDate
              ? `${format(parseISO(tooltip.project.startDate), 'yyyy.M.d')} ~ ${format(parseISO(tooltip.project.endDate), 'yyyy.M.d')}`
              : '기간 미설정'}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>
              {PROGRESS_LABELS[progressMode]}{' '}
              {progressMode === 'elapsed'
                ? calcElapsedPct(tooltip.project.startDate, tooltip.project.endDate)
                : calcCompletionPct(tooltip.project.closedCount, tooltip.project.itemCount)}%
            </span>
            {tooltip.project.budget && <span>{tooltip.project.budget}</span>}
            <span>{tooltip.project.memberCount}명</span>
          </div>
        </div>
      )}
    </div>
  )
}
