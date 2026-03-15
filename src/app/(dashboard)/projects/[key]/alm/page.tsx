import { notFound } from 'next/navigation'
import { getProjectByKey, getProjectData, touchProjectView } from '@/lib/supabase/cached-queries'
import { ALMLayout } from '@/components/projects/alm-layout'

interface ALMPageProps {
  params: Promise<{ key: string }>
  searchParams: Promise<{ item?: string }>
}

export default async function ALMPage({ params, searchParams }: ALMPageProps) {
  const { key } = await params
  const { item: initialItemId } = await searchParams

  const project = await getProjectByKey(key)

  if (!project) {
    notFound()
  }

  // touchProjectView는 사이드이펙트이므로 fire-and-forget (렌더링 차단 제거)
  void touchProjectView(project.id)

  const { statuses, trackers, members, workItems, currentUserId, linkedIssueStatuses, agents } =
    await getProjectData(project.id)

  // ?item= 값이 숫자(번호)면 UUID로 변환, UUID면 그대로 사용
  let resolvedItemId = initialItemId
  if (initialItemId && /^\d+$/.test(initialItemId)) {
    const itemNumber = parseInt(initialItemId, 10)
    const found = workItems.find(w => w.number === itemNumber)
    resolvedItemId = found?.id
  }

  return (
    <ALMLayout
      projectId={project.id}
      projectKey={project.key}
      statuses={statuses}
      trackers={trackers}
      members={members}
      workItems={workItems}
      currentUserId={currentUserId}
      showTrackerId={project.settings?.show_tracker_id !== false}
      showTrackerIdInDocument={project.settings?.show_tracker_id_in_document !== false}
      autoInsertDate={project.settings?.auto_insert_date !== false}
      initialSelectedItemId={resolvedItemId}
      linkedIssueStatuses={linkedIssueStatuses}
      agents={agents}
    />
  )
}
