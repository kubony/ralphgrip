'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import { cn } from '@/lib/utils'
import { ProjectGraphView } from './project-graph-view'
import type { ProjectCardSummary } from '@/lib/supabase/cached-queries'
import type { CrossProjectLink } from '@/types/database'

interface ProjectsViewSwitcherProps {
  children: React.ReactNode
  projects: {
    id: string
    key: string
    name: string
    project_type: string
    description: string | null
  }[]
  summaries: Record<string, ProjectCardSummary>
  crossLinks: CrossProjectLink[]
}

export function ProjectsViewSwitcher({
  children,
  projects,
  summaries,
  crossLinks,
}: ProjectsViewSwitcherProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const view = searchParams.get('view') ?? 'grid'

  const setView = useCallback((v: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (v === 'grid') {
      params.delete('view')
    } else {
      params.set('view', v)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }, [searchParams, router, pathname])

  return (
    <div>
      {/* 뷰 토글 버튼 */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setView('grid')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
            view === 'grid'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          <span>카드</span>
        </button>
        <button
          onClick={() => setView('graph')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
            view === 'graph'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          <GitBranch className="h-4 w-4" />
          <span>관계도</span>
        </button>
      </div>

      {/* 컨텐츠 */}
      {view === 'graph' ? (
        <div className="h-[calc(100vh-16rem)] border rounded-lg bg-background overflow-hidden">
          <ProjectGraphView
            projects={projects}
            summaries={summaries}
            crossLinks={crossLinks}
          />
        </div>
      ) : (
        children
      )}
    </div>
  )
}
