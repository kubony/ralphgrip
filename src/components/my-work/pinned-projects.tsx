'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Pin from 'lucide-react/dist/esm/icons/pin'
import PinOff from 'lucide-react/dist/esm/icons/pin-off'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import { cn } from '@/lib/utils'
import { toggleProjectPin } from '@/app/(dashboard)/projects/actions'
import type { MyWorkItem } from './types'

export interface PinnedProject {
  id: string
  name: string
  key: string
  project_type: string
  is_demo: boolean
}

export interface UserProject {
  id: string
  name: string
  key: string
  project_type: string
  is_pinned: boolean
}

interface PinnedProjectsPopoverProps {
  pinnedProjects: PinnedProject[]
  allProjects: UserProject[]
  workItems: MyWorkItem[]
}

export function PinnedProjectsPopover({ pinnedProjects, allProjects, workItems }: PinnedProjectsPopoverProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const openCountByProject = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of workItems) {
      if (!item.status?.is_closed && item.project) {
        map[item.project.id] = (map[item.project.id] ?? 0) + 1
      }
    }
    return map
  }, [workItems])

  const unpinnedProjects = allProjects.filter(p => !p.is_pinned)
  const typeLabel = (type: string) => type === 'requirement' ? '요구사항' : '이슈'

  function handlePin(projectId: string) {
    startTransition(async () => {
      await toggleProjectPin(projectId, true)
    })
  }

  function handleUnpin(projectId: string) {
    startTransition(async () => {
      await toggleProjectPin(projectId, false)
    })
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'p-1.5 rounded-md transition-colors relative',
            'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          aria-label="프로젝트 바로가기"
          title="프로젝트 바로가기"
        >
          <Pin className="h-4 w-4" />
          {pinnedProjects.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
              {pinnedProjects.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        {/* 고정된 프로젝트 */}
        {pinnedProjects.length > 0 && (
          <div className="p-2 space-y-0.5">
            <p className="text-xs text-muted-foreground px-2 py-1">고정된 프로젝트</p>
            {pinnedProjects.map(project => {
              const openCount = openCountByProject[project.id] ?? 0
              return (
                <div
                  key={project.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => {
                    router.push(`/projects/${project.key}/alm`)
                    setPopoverOpen(false)
                  }}
                >
                  <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                    {project.key}
                  </Badge>
                  <span className="truncate flex-1">{project.name}</span>
                  {openCount > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums">{openCount}</span>
                  )}
                  <ExternalLink className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  <button
                    className="relative p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all flex-shrink-0 after:absolute after:-inset-2 after:content-['']"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnpin(project.id)
                    }}
                    aria-label={`${project.name} 고정 해제`}
                  >
                    <PinOff className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* 프로젝트 추가 */}
        {unpinnedProjects.length > 0 && (
          <>
            {pinnedProjects.length > 0 && <div className="border-t" />}
            <div className="p-2 space-y-0.5">
              <p className="text-xs text-muted-foreground px-2 py-1">프로젝트 고정 추가</p>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {unpinnedProjects.map(project => (
                  <button
                    key={project.id}
                    className={cn(
                      'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      'hover:bg-muted',
                      isPending && 'opacity-50 pointer-events-none'
                    )}
                    onClick={() => handlePin(project.id)}
                    disabled={isPending}
                  >
                    <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                      {project.key}
                    </Badge>
                    <span className="truncate flex-1">{project.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {typeLabel(project.project_type)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {pinnedProjects.length === 0 && unpinnedProjects.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            참여 중인 프로젝트가 없습니다.
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// 하위 호환 (기존 PinnedProjects 제거 → PinnedProjectsPopover로 대체)
export const PinnedProjects = PinnedProjectsPopover
