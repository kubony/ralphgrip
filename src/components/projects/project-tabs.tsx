'use client'

import { Suspense, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3'
import LayoutPanelLeft from 'lucide-react/dist/esm/icons/layout-panel-left'
import List from 'lucide-react/dist/esm/icons/list'
import Columns3 from 'lucide-react/dist/esm/icons/columns-3'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import GanttChart from 'lucide-react/dist/esm/icons/gantt-chart'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Settings from 'lucide-react/dist/esm/icons/settings'

interface ProjectTabsProps {
  projectKey: string
  position?: 'left' | 'right'
}

function ProjectTabsInner({ projectKey, position = 'left' }: ProjectTabsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const basePath = `/projects/${projectKey}`
  const almPath = `${basePath}/alm`
  const isOnAlm = pathname.startsWith(almPath)
  const currentView = searchParams.get('view')

  const handleViewClick = useCallback((view?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (view) {
      params.set('view', view)
    } else {
      params.delete('view')
    }
    const qs = params.toString()

    if (isOnAlm) {
      // ALM 페이지에서는 replace로 필터 보존
      router.replace(`${almPath}${qs ? `?${qs}` : ''}`, { scroll: false })
    } else {
      router.push(`${almPath}${qs ? `?${qs}` : ''}`)
    }
  }, [isOnAlm, almPath, router, searchParams])

  const isViewActive = useCallback((view?: string) => {
    if (!isOnAlm) return false
    if (!view) return !currentView || currentView === 'alm'
    return currentView === view
  }, [isOnAlm, currentView])

  if (position === 'right') {
    const isActive = pathname.startsWith(`${basePath}/settings`)
    return (
      <nav aria-label="프로젝트 설정" className="flex items-center gap-0.5 flex-shrink-0">
        <Link
          href={`${basePath}/settings`}
          className={cn(
            'relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
            isActive
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {isActive && (
            <motion.div
              layoutId="project-tab-indicator"
              className="absolute inset-0 bg-primary/10 rounded-md"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            설정
          </span>
        </Link>
      </nav>
    )
  }

  const viewTabs = [
    { key: 'doc', label: '문서', icon: LayoutPanelLeft, view: undefined as string | undefined },
    { key: 'kanban', label: 'Kanban', icon: Columns3, view: 'kanban' },
    { key: 'timeline', label: 'Timeline', icon: GanttChart, view: 'timeline' },
    { key: 'list', label: 'List', icon: List, view: 'list' },
    { key: 'graph', label: 'Graph', icon: GitBranch, view: 'graph' },
  ]

  const isDashboardActive = pathname === basePath
  const isResourcesActive = pathname.startsWith(`${basePath}/resources`)

  return (
    <nav aria-label="프로젝트 네비게이션" className="flex items-center gap-0.5 flex-shrink-0">
      <Link
        href={basePath}
        className={cn(
          'relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
          isDashboardActive
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        {isDashboardActive && (
          <motion.div
            layoutId="project-tab-indicator"
            className="absolute inset-0 bg-primary/10 rounded-md"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" />
          현황
        </span>
      </Link>

      <div className="w-px h-4 bg-border mx-0.5" />

      {viewTabs.map((tab) => {
        const isActive = isViewActive(tab.view)
        return (
          <button
            key={tab.key}
            onClick={() => handleViewClick(tab.view)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
              isActive
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="project-tab-indicator"
                className="absolute inset-0 bg-primary/10 rounded-md"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </span>
          </button>
        )
      })}

      <div className="w-px h-4 bg-border mx-0.5" />

      <Link
        href={`${basePath}/resources`}
        className={cn(
          'relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
          isResourcesActive
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        {isResourcesActive && (
          <motion.div
            layoutId="project-tab-indicator"
            className="absolute inset-0 bg-primary/10 rounded-md"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          자료
        </span>
      </Link>
    </nav>
  )
}

export function ProjectTabs({ projectKey, position = 'left' }: ProjectTabsProps) {
  return (
    <Suspense fallback={
      <nav className="flex items-center gap-0.5 flex-shrink-0">
        <div className="h-8 w-16 bg-muted/50 rounded-md animate-pulse" />
      </nav>
    }>
      <ProjectTabsInner projectKey={projectKey} position={position} />
    </Suspense>
  )
}
