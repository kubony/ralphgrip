'use client'

import Link from 'next/link'
import { AnimatedCard } from '@/components/ui/animated-card'
import { CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import type { ProjectCardSummary } from '@/lib/supabase/cached-queries'
import type { CrossProjectLink } from '@/types/database'

type Project = {
  id: string
  key: string
  name: string
  description: string | null
  project_type: string
  is_demo: boolean
}

function getInitial(name: string | null) {
  return name?.charAt(0)?.toUpperCase() ?? '?'
}

export function ProjectCard({
  project,
  summary,
  relatedProjects,
}: {
  project: Project
  summary?: ProjectCardSummary
  relatedProjects?: CrossProjectLink[]
}) {
  const progress = summary && summary.item_count > 0
    ? Math.round((summary.closed_count / summary.item_count) * 100)
    : null

  return (
    <Link href={`/projects/${project.key}`}>
      <AnimatedCard enableHoverLift className="hover:border-primary/50 transition-colors cursor-pointer h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
              {project.key}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              project.project_type === 'requirement'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
            }`}>
              {project.project_type === 'requirement' ? '요구사항' : '이슈'}
            </span>
            {project.is_demo && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                데모
              </span>
            )}
          </div>
          <CardTitle className="mt-2">{project.name}</CardTitle>
          {project.description && (
            <CardDescription className="line-clamp-2">{project.description}</CardDescription>
          )}
        </CardHeader>

        {summary && (
          <CardFooter className="mt-auto gap-3 text-xs text-muted-foreground">
            {/* 소유자 */}
            <div className="flex items-center gap-1.5 min-w-0 shrink-0">
              <Avatar size="sm">
                {summary.owner_avatar_url && (
                  <AvatarImage src={summary.owner_avatar_url} alt={summary.owner_name ?? ''} />
                )}
                <AvatarFallback>{getInitial(summary.owner_name)}</AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[5rem]">{summary.owner_name ?? '알 수 없음'}</span>
            </div>

            {/* 멤버 그룹 (소유자 제외) */}
            {summary.members.length > 0 && (
              <AvatarGroup className="shrink-0">
                {summary.members.slice(0, 2).map((m, i) => (
                  <Avatar key={i} size="sm">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.name ?? ''} />}
                    <AvatarFallback>{getInitial(m.name)}</AvatarFallback>
                  </Avatar>
                ))}
                {/* 소유자 제외 멤버가 3명 이상이면 오버플로우 표시 */}
                {summary.member_count - 1 > 2 && (
                  <AvatarGroupCount>
                    <span className="text-[10px]">+{summary.member_count - 1 - 2}</span>
                  </AvatarGroupCount>
                )}
              </AvatarGroup>
            )}

            {/* 스페이서 */}
            <div className="flex-1" />

            {/* 항목 수 */}
            <div className="flex items-center gap-1 shrink-0">
              <FileText className="size-3.5" />
              <span className="font-mono">{summary.item_count}</span>
            </div>

            {/* 진행률 */}
            {progress !== null && (
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="font-mono text-[11px]">{progress}%</span>
              </div>
            )}
          </CardFooter>
        )}

        {/* 연관 프로젝트 배지 스트립 */}
        {relatedProjects && relatedProjects.length > 0 && (
          <div className="border-t border-dashed px-4 py-1.5 flex items-center gap-1.5 flex-wrap">
            {relatedProjects.map((rp) => {
              const isOutgoing = rp.source_project_id === project.id
              const targetKey = isOutgoing ? rp.target_project_key : rp.source_project_key
              const targetName = isOutgoing ? rp.target_project_name : rp.source_project_name
              const arrow = isOutgoing ? '→' : '←'

              return (
                <Tooltip key={`${rp.source_project_id}-${rp.target_project_id}`}>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/projects/${targetKey}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="opacity-50">{arrow}</span>
                      <span>{targetKey}</span>
                      <span className="opacity-50">({rp.link_count})</span>
                      {rp.suspect_count > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {isOutgoing
                      ? `${project.key} → ${targetKey}: ${rp.link_count}개 항목 연결`
                      : `${targetKey} → ${project.key}: ${rp.link_count}개 항목 연결`
                    }
                    {rp.suspect_count > 0 && ` (${rp.suspect_count}개 변경 의심)`}
                    <br />
                    <span className="text-muted-foreground">{targetName}</span>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        )}
      </AnimatedCard>
    </Link>
  )
}
