'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '@/lib/motion'
import dynamic from 'next/dynamic'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ALMTreePanel } from './alm-tree-panel'
import { ALMDocumentView } from './alm-document-view'
import { ALMPropertyPanel } from './alm-property-panel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { useRealtimeWorkItems } from '@/hooks/use-realtime-work-items'
import { useRealtimeLinkCounts } from '@/hooks/use-realtime-links'
import { useRealtimeLinkedIssueStatus } from '@/hooks/use-realtime-linked-issue-status'
import { useALMSelection } from '@/hooks/use-alm-selection'
import { useWorkItemFilters } from '@/hooks/use-work-item-filters'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Layers from 'lucide-react/dist/esm/icons/layers'
import FolderIcon from 'lucide-react/dist/esm/icons/folder'
import PanelRightClose from 'lucide-react/dist/esm/icons/panel-right-close'
import PanelRightOpen from 'lucide-react/dist/esm/icons/panel-right-open'
import X from 'lucide-react/dist/esm/icons/x'
import Lock from 'lucide-react/dist/esm/icons/lock'
import Eye from 'lucide-react/dist/esm/icons/eye'
import Circle from 'lucide-react/dist/esm/icons/circle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import User from 'lucide-react/dist/esm/icons/user'
import Users from 'lucide-react/dist/esm/icons/users'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import Check from 'lucide-react/dist/esm/icons/check'
import { cn } from '@/lib/utils'
import type {
  WorkItemWithRelations,
  StatusRef,
  TrackerRef,
  PersonRef,
  AgentRef,
  LinkCount,
  LinkedIssueStatus,

} from '@/types/database'
import { CreateWorkItemDialog } from './create-work-item-dialog'

// Re-export types for backwards compatibility
export type { Selection, SelectionType } from '@/hooks/use-alm-selection'

const KanbanView = dynamic(() => import('./kanban-view'), { ssr: false })
const ListView = dynamic(() => import('./list-view'), { ssr: false })
const GraphView = dynamic(() => import('./graph-view'), { ssr: false })
const TimelineView = dynamic(() => import('./timeline-view'), { ssr: false })

type ViewMode = 'alm' | 'kanban' | 'list' | 'graph' | 'timeline'
const VALID_VIEW_MODES: ViewMode[] = ['alm', 'kanban', 'list', 'graph', 'timeline']

const EMPTY_LINK_COUNTS: LinkCount[] = []
const EMPTY_LINKED_ISSUE_STATUSES: LinkedIssueStatus[] = []

interface ALMLayoutProps {
  projectId: string
  projectKey: string
  statuses: StatusRef[]
  trackers: TrackerRef[]
  members: PersonRef[]
  agents?: AgentRef[]
  workItems: WorkItemWithRelations[]
  currentUserId?: string
  showTrackerId?: boolean
  showTrackerIdInDocument?: boolean
  autoInsertDate?: boolean
  initialSelectedItemId?: string
  linkCounts?: LinkCount[]
  linkedIssueStatuses?: LinkedIssueStatus[]
}

export function ALMLayout({
  projectId,
  projectKey,
  statuses,
  trackers,
  members,
  agents,
  workItems,
  currentUserId,
  showTrackerId,
  showTrackerIdInDocument,
  autoInsertDate,
  initialSelectedItemId,
  linkCounts: initialLinkCounts,
  linkedIssueStatuses: initialLinkedIssueStatuses,
}: ALMLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsRef = useRef(searchParams)
  useEffect(() => { searchParamsRef.current = searchParams }, [searchParams])

  const liveWorkItems = useRealtimeWorkItems(projectId, workItems)
  const liveLinkCounts = useRealtimeLinkCounts(projectId, initialLinkCounts ?? EMPTY_LINK_COUNTS)
  const liveLinkedIssueStatuses = useRealtimeLinkedIssueStatus(projectId, initialLinkedIssueStatuses ?? EMPTY_LINKED_ISSUE_STATUSES)

  const { selection, setSelection, selectedWorkItem, selectedCount } =
    useALMSelection(liveWorkItems, initialSelectedItemId)

  // initialSelectedItemId 변경 시 선택 상태 동기화 (Cmd+K 등 외부 네비게이션)
  // selectionIdRef: 내부 선택에 의한 URL 변경과 외부 네비게이션을 구분하기 위한 ref
  const prevInitialItemIdRef = useRef(initialSelectedItemId)
  const selectionIdRef = useRef(selection.id)
  useEffect(() => { selectionIdRef.current = selection.id }, [selection.id])
  useEffect(() => {
    if (
      initialSelectedItemId &&
      initialSelectedItemId !== prevInitialItemIdRef.current &&
      initialSelectedItemId !== selectionIdRef.current
    ) {
      setSelection({
        type: 'workitem',
        id: initialSelectedItemId,
        ids: new Set([initialSelectedItemId]),
        lastSelectedId: initialSelectedItemId,
      })
    }
    prevInitialItemIdRef.current = initialSelectedItemId
  }, [initialSelectedItemId, setSelection])

  // Parse initial filter state from URL params
  const urlStatus = searchParams.get('status')
  const urlAssignee = searchParams.get('assignee')
  const urlLevel = searchParams.get('level')
  const urlVis = searchParams.get('vis')
  const urlFolders = searchParams.get('folders')

  const {
    statusFilter,
    setStatusFilter,
    toggleStatusFilter,
    assigneeFilter,
    setAssigneeFilter,
    levelFilter,
    setLevelFilter,
    toggleLevelFilter,
    levelCounts,
    maxLevel,
    statusCounts,
    visibilityFilter,
    setVisibilityFilter,
    visibilityCounts,
    showFolders,
    setShowFolders,
    folderCount,
    filteredWorkItems,
  } = useWorkItemFilters(liveWorkItems, currentUserId, {
    statusFilter: urlStatus ? new Set(urlStatus.split(',')) : undefined,
    assigneeFilter: urlAssignee || undefined,
    levelFilter: urlLevel ? new Set(urlLevel.split(',').map(Number)) : undefined,
    visibilityFilter: urlVis === 'internal' || urlVis === 'public' ? urlVis : undefined,
    showFolders: urlFolders === '0' ? false : undefined,
  })

  // Sync filter state → URL params (skip initial mount)
  const filterMountedRef = useRef(false)
  useEffect(() => {
    if (!filterMountedRef.current) {
      filterMountedRef.current = true
      return
    }
    const params = new URLSearchParams(searchParamsRef.current.toString())
    if (statusFilter.size > 0) params.set('status', [...statusFilter].join(','))
    else params.delete('status')
    if (assigneeFilter !== null) params.set('assignee', assigneeFilter)
    else params.delete('assignee')
    if (levelFilter.size > 0) params.set('level', [...levelFilter].join(','))
    else params.delete('level')
    if (visibilityFilter !== 'all') params.set('vis', visibilityFilter)
    else params.delete('vis')
    if (!showFolders) params.set('folders', '0')
    else params.delete('folders')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [statusFilter, assigneeFilter, levelFilter, visibilityFilter, showFolders, pathname, router])

  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [graphFocusItemId, setGraphFocusItemId] = useState<string | null>(null)

  // 타임라인 드래그 낙관적 날짜 패치 (Realtime 동기화 전 즉시 반영)
  const [datePatch, setDatePatch] = useState<{
    id: string
    start_date?: string | null
    due_date?: string | null
    actual_start_date?: string | null
    actual_end_date?: string | null
  } | null>(null)

  // Realtime이 새 날짜를 반영하면 패치 해제
  useEffect(() => {
    if (!datePatch) return
    const item = liveWorkItems.find((i) => i.id === datePatch.id)
    if (!item) return
    const targetMatch = datePatch.start_date === undefined || (
      item.start_date === datePatch.start_date &&
      item.due_date === datePatch.due_date
    )
    const actualMatch = datePatch.actual_start_date === undefined || (
      item.actual_start_date === datePatch.actual_start_date &&
      item.actual_end_date === datePatch.actual_end_date
    )
    if (targetMatch && actualMatch) {
       
      queueMicrotask(() => setDatePatch(null))
    }
  }, [liveWorkItems, datePatch])

  // 패치 적용된 selectedWorkItem
  const effectiveSelectedWorkItem = useMemo(() => {
    if (!selectedWorkItem || !datePatch || selectedWorkItem.id !== datePatch.id)
      return selectedWorkItem
    return {
      ...selectedWorkItem,
      ...(datePatch.start_date !== undefined && { start_date: datePatch.start_date }),
      ...(datePatch.due_date !== undefined && { due_date: datePatch.due_date }),
      ...(datePatch.actual_start_date !== undefined && { actual_start_date: datePatch.actual_start_date }),
      ...(datePatch.actual_end_date !== undefined && { actual_end_date: datePatch.actual_end_date }),
    }
  }, [selectedWorkItem, datePatch])

  const urlView = searchParams.get('view') as ViewMode | null
  const viewMode = urlView && VALID_VIEW_MODES.includes(urlView) ? urlView : 'alm'

  const setViewMode = useCallback((mode: ViewMode) => {
    if (mode !== 'graph') setGraphFocusItemId(null)
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'alm') {
      params.delete('view')
    } else {
      params.set('view', mode)
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [pathname, router, searchParams])

  const handleViewInGraph = useCallback((workItemId: string) => {
    setGraphFocusItemId(workItemId)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'graph')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  // 상태 목록 정렬 (불변성 유지 + 메모이제이션)
  const sortedStatuses = useMemo(
    () => statuses.toSorted((a, b) => a.position - b.position),
    [statuses]
  )

  // 속성 패널 ref (collapsible)
  const propertyPanelRef = useRef<PanelImperativeHandle>(null)

  // 칸반뷰: 카드 선택 시 속성 패널 자동 열기, 선택 해제 시 닫기
  const prevSelectionId = useRef<string | null>(null)
  useEffect(() => {
    if (viewMode !== 'kanban') return
    const panel = propertyPanelRef.current
    if (!panel) return

    if (selection.id && selection.id !== prevSelectionId.current) {
      if (panel.isCollapsed()) panel.expand()
    } else if (!selection.id && prevSelectionId.current) {
      if (!panel.isCollapsed()) panel.collapse()
    }
    prevSelectionId.current = selection.id
  }, [viewMode, selection.id])

  // URL 동기화: selection 변경 시 ?item= 업데이트
  useEffect(() => {
    const params = new URLSearchParams(searchParamsRef.current.toString())
    if (selection.id) {
      params.set('item', selection.id)
    } else {
      params.delete('item')
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [selection.id, pathname, router])

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* 필터 도구모음 + 작업 추가 버튼 */}
      <div data-filter-bar className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-1.5 border-b bg-background/95 backdrop-blur-sm z-20">
        {/* 왼쪽: 필터 (가로 스크롤) */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none min-w-0">
        {/* 상태 필터 칩 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 전체 선택/해제 버튼 */}
          <button
            onClick={() => {
              const allIds = sortedStatuses.map(s => s.id)
              const allSelected = allIds.length > 0 && allIds.every(id => statusFilter.has(id))
              setStatusFilter(allSelected ? new Set() : new Set(allIds))
            }}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors',
              statusFilter.size === sortedStatuses.length
                ? 'bg-primary/20 border-primary/50 text-foreground'
                : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title={statusFilter.size === sortedStatuses.length ? '필터 초기화' : '전체 선택'}
            aria-label={statusFilter.size === sortedStatuses.length ? '상태 필터 초기화' : '상태 전체 선택'}
          >
            <CheckCircle2 className="h-3 w-3" />
            전체
          </button>
          <div className="w-px h-3.5 bg-border" />
          {sortedStatuses.map(status => {
              const isActive = statusFilter.has(status.id)
              const count = statusCounts.get(status.id) || 0
              return (
                <button
                  key={status.id}
                  onClick={() => toggleStatusFilter(status.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-colors',
                    isActive
                      ? 'bg-primary/20 border-primary/50 text-foreground'
                      : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-pressed={isActive}
                  aria-label={`${status.name} 필터 ${isActive ? '활성' : '비활성'}`}
                >
                  {status.is_closed ? (
                    <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: status.name === 'Rejected' ? '#ef4444' : '#22c55e' }} />
                  ) : (
                    <Circle
                      className="h-3 w-3 flex-shrink-0"
                      style={{ color: status.color || '#94a3b8', fill: status.color || '#94a3b8' }}
                    />
                  )}
                  {status.name}
                  {count > 0 && <span className="ml-1 text-muted-foreground">{count}</span>}
                </button>
              )
            })}
          {statusFilter.size > 0 && (
            <button
              onClick={() => setStatusFilter(new Set())}
              className="flex items-center gap-1 px-1.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="필터 초기화"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* 레벨 필터 칩 */}
        {maxLevel > 0 && (
          <>
            <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />
            <div className="flex items-center gap-1 flex-shrink-0">
              <Layers className="h-3 w-3 text-muted-foreground mr-0.5" />
              {Array.from({ length: maxLevel + 1 }, (_, i) => {
                const isActive = levelFilter.has(i)
                const count = levelCounts.get(i) || 0
                return (
                  <button
                    key={i}
                    onClick={() => toggleLevelFilter(i)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors',
                      isActive
                        ? 'bg-primary/20 border-primary/50 text-foreground'
                        : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    aria-pressed={isActive}
                    aria-label={`레벨 ${i + 1} 필터 ${isActive ? '활성' : '비활성'}`}
                  >
                    L{i + 1}
                    {count > 0 && <span className="text-muted-foreground">{count}</span>}
                  </button>
                )
              })}
              {levelFilter.size > 0 && (
                <button
                  onClick={() => setLevelFilter(new Set())}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="레벨 필터 초기화"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </>
        )}

        {/* 공개 수준 필터 */}
        <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setVisibilityFilter(visibilityFilter === 'internal' ? 'all' : 'internal')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors',
              visibilityFilter === 'internal'
                ? 'bg-primary/20 border-primary/50 text-foreground'
                : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            aria-pressed={visibilityFilter === 'internal'}
            aria-label={`내부 필터 ${visibilityFilter === 'internal' ? '활성' : '비활성'}`}
          >
            <Lock className="h-3 w-3" />
            내부
            {visibilityCounts.internal > 0 && <span className="text-muted-foreground">{visibilityCounts.internal}</span>}
          </button>
          <button
            onClick={() => setVisibilityFilter(visibilityFilter === 'public' ? 'all' : 'public')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors',
              visibilityFilter === 'public'
                ? 'bg-green-500/20 border-green-500/50 text-foreground'
                : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            aria-pressed={visibilityFilter === 'public'}
            aria-label={`공개 필터 ${visibilityFilter === 'public' ? '활성' : '비활성'}`}
          >
            <Eye className="h-3 w-3" />
            공개
            {visibilityCounts.public > 0 && <span className="text-muted-foreground">{visibilityCounts.public}</span>}
          </button>
          {visibilityFilter !== 'all' && (
            <button
              onClick={() => setVisibilityFilter('all')}
              className="flex items-center gap-1 px-1.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="공개 수준 필터 초기화"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* 폴더 표시 토글 */}
        <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />
        <button
          onClick={() => setShowFolders(!showFolders)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors',
            !showFolders
              ? 'bg-amber-500/20 border-amber-500/50 text-foreground'
              : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          aria-pressed={!showFolders}
          aria-label={`폴더 ${showFolders ? '숨기기' : '보이기'}`}
          title={showFolders ? '폴더 숨기기' : '폴더 보이기'}
        >
          <FolderIcon className="h-3 w-3" style={{ color: showFolders ? undefined : '#f59e0b' }} />
          폴더
          {folderCount > 0 && <span className="text-muted-foreground">{folderCount}</span>}
        </button>

        {/* 담당자 필터 드롭다운 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-colors',
                  assigneeFilter !== null
                    ? 'bg-primary/10 border-primary/50 text-foreground'
                    : 'bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {assigneeFilter === null && (
                  <>
                    <Users className="h-3 w-3" />
                    담당자
                  </>
                )}
                {assigneeFilter === 'mine' && (
                  <>
                    <User className="h-3 w-3" />
                    내 것만
                  </>
                )}
                {assigneeFilter === 'unassigned' && (
                  <>
                    <UserX className="h-3 w-3" />
                    미지정
                  </>
                )}
                {assigneeFilter !== null && assigneeFilter !== 'mine' && assigneeFilter !== 'unassigned' && (
                  <>
                    {(() => {
                      const m = members.find(m => m.id === assigneeFilter)
                      return m ? (
                        <>
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={m.avatar_url || undefined} />
                            <AvatarFallback className="text-[8px]">
                              {m.full_name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          {m.full_name || '이름 없음'}
                        </>
                      ) : '담당자'
                    })()}
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuItem onClick={() => setAssigneeFilter(null)}>
                <Users className="h-4 w-4 mr-2" />
                전체
                {assigneeFilter === null && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAssigneeFilter('mine')}>
                <User className="h-4 w-4 mr-2" />
                내 것만
                {assigneeFilter === 'mine' && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAssigneeFilter('unassigned')}>
                <UserX className="h-4 w-4 mr-2" />
                미지정
                {assigneeFilter === 'unassigned' && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {members.length > 0 && <DropdownMenuSeparator />}
              {members.map(member => (
                <DropdownMenuItem key={member.id} onClick={() => setAssigneeFilter(member.id)}>
                  <Avatar className="h-4 w-4 mr-2">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">
                      {member.full_name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{member.full_name || '이름 없음'}</span>
                  {assigneeFilter === member.id && <Check className="h-3 w-3 ml-auto flex-shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {assigneeFilter !== null && (
            <button
              onClick={() => setAssigneeFilter(null)}
              className="flex items-center gap-1 px-1.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="담당자 필터 초기화"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        </div>

        {/* 오른쪽: 작업 추가 버튼 */}
        <CreateWorkItemDialog
          projectId={projectId}
          trackers={trackers}
          statuses={statuses}
          members={members}
        />
      </div>

      <div className="flex-1 overflow-hidden relative">
        <ResizablePanelGroup orientation="horizontal" id="alm-main">
          {/* 메인 콘텐츠 영역 */}
          <ResizablePanel defaultSize="75%" minSize="40%">
            <AnimatePresence mode="wait">
            {viewMode === 'alm' ? (
              <motion.div
                key="alm"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full w-full"
              >
                <ResizablePanelGroup orientation="horizontal" id="alm-tree">
                  <ResizablePanel defaultSize="25%" minSize="15%" maxSize="40%">
                    <ALMTreePanel
                      projectId={projectId}
                      projectKey={projectKey}
                      workItems={filteredWorkItems}
                      trackers={trackers}
                      statuses={statuses}
                      selection={selection}
                      onSelectionChange={setSelection}
                      showTrackerId={showTrackerId}
                      linkCounts={liveLinkCounts}
                    />
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel defaultSize="75%">
                    <div className="h-full overflow-hidden flex flex-col">
                      <ALMDocumentView
                        projectId={projectId}
                        projectKey={projectKey}
                        workItems={filteredWorkItems}
                        trackers={trackers}
                        statuses={statuses}
                        selection={selection}
                        onSelectionChange={setSelection}
                        showTrackerId={showTrackerIdInDocument}
                        autoInsertDate={autoInsertDate}
                        linkedIssueStatuses={liveLinkedIssueStatuses}
                      />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </motion.div>
            ) : viewMode === 'list' ? (
              <motion.div
                key="list"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full w-full overflow-auto"
              >
                <ListView
                  projectId={projectId}
                  projectKey={projectKey}
                  workItems={filteredWorkItems}
                  showTrackerId={showTrackerId}
                  onSelectItem={(id) => setSelection({ type: 'workitem', id, ids: new Set([id]), lastSelectedId: id })}
                  selectedItemId={selection.id}
                />
              </motion.div>
            ) : viewMode === 'kanban' ? (
              <motion.div
                key="kanban"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full w-full overflow-auto"
              >
                <KanbanView
                  projectId={projectId}
                  projectKey={projectKey}
                  workItems={filteredWorkItems}
                  statuses={statuses}
                  trackers={trackers}
                  members={members}
                  selection={selection}
                  onSelectionChange={setSelection}
                  linkedIssueStatuses={liveLinkedIssueStatuses}
                />
              </motion.div>
            ) : viewMode === 'graph' ? (
              <motion.div
                key="graph"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full w-full overflow-hidden"
              >
                <GraphView
                  projectId={projectId}
                  projectKey={projectKey}
                  workItems={filteredWorkItems}
                  trackers={trackers}
                  onSelectItem={(id, nodeProjectKey) => {
                    if (nodeProjectKey !== projectKey) {
                      router.push(`/projects/${nodeProjectKey}/alm?item=${id}`)
                    } else {
                      setSelection({ type: 'workitem', id, ids: new Set([id]), lastSelectedId: id })
                      setViewMode('alm')
                    }
                  }}
                  focusItemId={graphFocusItemId}
                  onClearFocus={() => setGraphFocusItemId(null)}
                />
              </motion.div>
            ) : viewMode === 'timeline' ? (
              <motion.div
                key="timeline"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full w-full overflow-hidden"
              >
                <TimelineView
                  projectId={projectId}
                  projectKey={projectKey}
                  workItems={filteredWorkItems}
                  statuses={statuses}
                  trackers={trackers}
                  members={members}
                  selection={selection}
                  onSelectionChange={setSelection}
                  showTrackerId={showTrackerId}
                  currentUserId={currentUserId}
                  onOptimisticUpdate={(id, updates) =>
                    setDatePatch({ id, ...updates })
                  }
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          </ResizablePanel>

          {/* 속성 패널 (collapsible) */}
          <ResizableHandle />
          <ResizablePanel
            panelRef={propertyPanelRef}
            defaultSize="30%"
            minSize="22%"
            maxSize="45%"
            collapsible
            collapsedSize="0%"
            onResize={(size) => setIsPanelOpen(size.asPercentage > 0)}
          >
            <ALMPropertyPanel
              workItem={effectiveSelectedWorkItem}
              allWorkItems={liveWorkItems}
              selectedCount={selectedCount}
              selectedIds={selection.ids}
              statuses={statuses}
              trackers={trackers}
              members={members}
              agents={agents}
              projectId={projectId}
              currentUserId={currentUserId}
              onViewInGraph={handleViewInGraph}
            />
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* 패널 토글 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 z-10"
          onClick={() => {
            const panel = propertyPanelRef.current
            if (panel) {
              if (panel.isCollapsed()) {
                panel.expand()
              } else {
                panel.collapse()
              }
            }
          }}
          title={isPanelOpen ? '속성 패널 닫기' : '속성 패널 열기'}
        >
          {isPanelOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
