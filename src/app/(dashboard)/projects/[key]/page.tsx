import { notFound } from 'next/navigation'
import { getProjectByKey, getProjectOverview, touchProjectView, getCrossProjectLinks, getUserProfile, getCurrentUser } from '@/lib/supabase/cached-queries'
import { ProjectOverview } from '@/components/projects/overview/project-overview'
import type { ProjectSettings } from '@/types/database'

interface ProjectPageProps {
  params: Promise<{ key: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { key } = await params

  const project = await getProjectByKey(key)

  if (!project) {
    notFound()
  }

  // touchProjectView는 사이드이펙트이므로 fire-and-forget (렌더링 차단 제거)
  void touchProjectView(project.id)

  const [{ workItems, statuses, members, auditLogs, activityLogs, recentComments }, crossLinksMap, ownerProfile, currentUser] = await Promise.all([
    getProjectOverview(project.id),
    getCrossProjectLinks([project.id]),
    project.owner_id ? getUserProfile(project.owner_id) : Promise.resolve(null),
    getCurrentUser(),
  ])

  // 현재 프로젝트 관련 링크 추출 (source와 target 모두)
  const relatedLinks: import('@/types/database').CrossProjectLink[] = []
  for (const [, links] of crossLinksMap) {
    for (const link of links) {
      if (link.source_project_id === project.id || link.target_project_id === project.id) {
        if (!relatedLinks.some(l => l.source_project_id === link.source_project_id && l.target_project_id === link.target_project_id)) {
          relatedLinks.push(link)
        }
      }
    }
  }

  // canEdit: 현재 사용자가 viewer가 아닌 멤버인지 확인
  const canEdit = currentUser
    ? members.some((m) => m.id === currentUser.id)
    : false

  const settings = project.settings as ProjectSettings | null

  return (
    <ProjectOverview
      workItems={workItems}
      statuses={statuses}
      members={members}
      auditLogs={auditLogs}
      activityLogs={activityLogs}
      recentComments={recentComments}
      relatedProjects={relatedLinks}
      currentProjectKey={project.key}
      projectId={project.id}
      projectName={project.name}
      projectType={project.project_type}
      description={project.description}
      coverImagePath={settings?.cover_image_path ?? null}
      owner={ownerProfile}
      memberCount={members.length}
      createdAt={project.created_at}
      canEdit={canEdit}
    />
  )
}
