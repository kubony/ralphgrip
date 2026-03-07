import { createClient } from '@/lib/supabase/server'
import { getUserAppRole, getProjectCardSummaries, getCrossProjectLinks } from '@/lib/supabase/cached-queries'
import { Card, CardContent } from '@/components/ui/card'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { ProjectsViewSwitcher } from '@/components/projects/projects-view-switcher'
import { ProjectCardGridWithEdges } from '@/components/projects/project-card-grid-edges'
import type { CrossProjectLink } from '@/types/database'


export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const appRole = user ? await getUserAppRole(user.id) : 'guest'
  const isGuest = appRole === 'guest'

  // 병렬 조회: memberRows와 rawProjects는 독립적
  const projectsQuery = supabase.from('projects').select('*').order('created_at', { ascending: false })

  // guest는 멤버인 프로젝트 + 데모 프로젝트만 조회
  const [{ data: memberRows }, { data: rawProjects }] = await Promise.all([
    supabase
      .from('project_members')
      .select('project_id, last_viewed_at')
      .eq('user_id', user?.id),
    projectsQuery,
  ])

  // guest 필터링: 멤버이거나 데모인 프로젝트만
  const memberProjectIds = new Set((memberRows ?? []).map(r => r.project_id))
  const filteredProjects = isGuest
    ? (rawProjects ?? []).filter(p => p.is_demo || memberProjectIds.has(p.id))
    : rawProjects

  const viewedMap = new Map(
    (memberRows ?? []).map(r => [r.project_id, r.last_viewed_at])
  )

  // 최근 본 프로젝트 우선, 안 본 프로젝트는 생성일 역순
  const projects = filteredProjects?.toSorted((a, b) => {
    const aViewed = viewedMap.get(a.id)
    const bViewed = viewedMap.get(b.id)
    if (aViewed && bViewed) return new Date(bViewed).getTime() - new Date(aViewed).getTime()
    if (aViewed) return -1
    if (bViewed) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // 카드 요약 정보 + 크로스 프로젝트 링크 병렬 조회
  const projectIds = projects?.map(p => p.id) ?? []
  const [summaries, crossLinks] = projects && projects.length > 0
    ? await Promise.all([
        getProjectCardSummaries(projectIds),
        getCrossProjectLinks(projectIds),
      ])
    : [new Map(), new Map<string, CrossProjectLink[]>()]

  // crossLinks는 source_project_id 기준이므로, 각 프로젝트가 target인 경우도 합산
  const allLinksMap = new Map<string, CrossProjectLink[]>()
  for (const [, links] of crossLinks) {
    for (const link of links) {
      // source 프로젝트에 추가
      const srcList = allLinksMap.get(link.source_project_id) ?? []
      if (!srcList.some(l => l.source_project_id === link.source_project_id && l.target_project_id === link.target_project_id)) {
        srcList.push(link)
        allLinksMap.set(link.source_project_id, srcList)
      }
      // target 프로젝트에도 추가 (incoming으로 표시)
      const tgtList = allLinksMap.get(link.target_project_id) ?? []
      if (!tgtList.some(l => l.source_project_id === link.source_project_id && l.target_project_id === link.target_project_id)) {
        tgtList.push(link)
        allLinksMap.set(link.target_project_id, tgtList)
      }
    }
  }

  // 그래프 뷰용 데이터 직렬화
  const crossLinksArray = Array.from(crossLinks.values()).flat()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">프로젝트</h1>
          <p className="text-muted-foreground">
            프로젝트를 관리하고 작업을 추적하세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isGuest && (
            <CreateProjectDialog />
          )}
        </div>
      </div>

      {projects && projects.length > 0 ? (
        <ProjectsViewSwitcher
          projects={projects}
          summaries={Object.fromEntries(summaries)}
          crossLinks={crossLinksArray}
        >
          <ProjectCardGridWithEdges
            projects={projects}
            summaries={summaries}
            allLinksMap={allLinksMap}
            crossLinks={crossLinksArray}
          />
        </ProjectsViewSwitcher>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            {isGuest ? (
              <>
                <p className="text-muted-foreground mb-2">접근 가능한 프로젝트가 없습니다.</p>
                <p className="text-sm text-muted-foreground">관리자에게 프로젝트 접근 권한을 요청하세요.</p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">아직 프로젝트가 없습니다.</p>
                <CreateProjectDialog />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
