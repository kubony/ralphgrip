'use client'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import type { CrossProjectLink } from '@/types/database'

interface RelatedProjectsSectionProps {
  currentProjectKey: string
  relatedProjects: CrossProjectLink[]
}

export function RelatedProjectsSection({ currentProjectKey, relatedProjects }: RelatedProjectsSectionProps) {
  const router = useRouter()

  const relatedWithDirection = relatedProjects.map((link) => {
    const isOutgoing = link.source_project_key === currentProjectKey
    return {
      ...link,
      direction: isOutgoing ? ('outgoing' as const) : ('incoming' as const),
      targetKey: isOutgoing ? link.target_project_key : link.source_project_key,
      targetName: isOutgoing ? link.target_project_name : link.source_project_name,
    }
  })

  return (
    <Card className="p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <h2 className="text-lg font-semibold mb-4">관련 프로젝트</h2>

      {relatedWithDirection.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          연결된 프로젝트가 없습니다. 작업 항목의 의존성을 추가하면 관련 프로젝트가 자동으로 표시됩니다.
        </p>
      ) : (
        <div className="space-y-2">
          {relatedWithDirection.map((link, idx) => (
            <button
              key={idx}
              onClick={() => router.push(`/projects/${link.targetKey}`)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
            >
              {/* 프로젝트 키 + 이름 */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge variant="secondary" className="font-mono shrink-0">
                  {link.targetKey}
                </Badge>
                <span className="font-medium truncate">{link.targetName}</span>
              </div>

              {/* 방향 아이콘 + 라벨 */}
              <div
                className={`flex items-center gap-1.5 shrink-0 ${
                  link.direction === 'outgoing'
                    ? 'text-blue-500 dark:text-blue-400'
                    : 'text-green-500 dark:text-green-400'
                }`}
              >
                {link.direction === 'outgoing' ? (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span className="text-xs font-medium">이 프로젝트에서 참조</span>
                  </>
                ) : (
                  <>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-xs font-medium">이 프로젝트를 참조</span>
                  </>
                )}
              </div>

              {/* 링크 카운트 */}
              <Badge variant="outline" className="shrink-0">
                {link.link_count}개 링크
              </Badge>

              {/* suspect 카운트 */}
              {link.suspect_count > 0 && (
                <Badge variant="outline" className="shrink-0 border-amber-500 text-amber-500 dark:border-amber-400 dark:text-amber-400">
                  {link.suspect_count}개 변경 의심
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
