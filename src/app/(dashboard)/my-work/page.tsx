import { redirect } from 'next/navigation'
import { getCurrentUser, getUserProfile, getMyWorkItems, getMyMentionedComments, getMyPinnedItemIds, getMyReadCommentIds, getPinnedProjects, getUserProjects, getProjectStatuses } from '@/lib/supabase/cached-queries'
import { MyWorkPage } from '@/components/my-work/my-work-page'
import type { RoleType } from '@/components/my-work/types'

export default async function MyWorkServerPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // 병렬화: getUserProfile과 독립적인 쿼리를 동시에 실행
  const profilePromise = getUserProfile(user.id)
  const workItemsPromise = profilePromise.then(p =>
    getMyWorkItems(user.id, p?.full_name ?? null)
  )

  const [profile, workItemsRaw, mentionedComments, pinnedItemIds, readCommentIds, pinnedProjects, allProjects] = await Promise.all([
    profilePromise,
    workItemsPromise,
    getMyMentionedComments(user.id),
    getMyPinnedItemIds(user.id),
    getMyReadCommentIds(user.id),
    getPinnedProjects(user.id),
    getUserProjects(user.id),
  ])
  const fullName = profile?.full_name ?? null

  // matchReasons 계산: assigned / created / mentioned (복수 가능)
  const workItems = workItemsRaw.map(item => {
    const matchReasons: RoleType[] = []
    if (item.assignee_id === user.id) matchReasons.push('assigned')
    if (item.reporter_id === user.id) matchReasons.push('created')
    if (fullName && item.description?.includes(fullName)) matchReasons.push('mentioned')
    return { ...item, matchReasons }
  })

  // 프로젝트별 상태 목록 fetch (상태 변경 드롭다운용)
  const projectIds = [...new Set(workItems.map(w => w.project_id))]
  const statusesByProject: Record<string, { id: string; name: string; color: string | null; position: number; is_closed: boolean }[]> = {}
  await Promise.all(
    projectIds.map(async (pid) => {
      const statuses = await getProjectStatuses(pid)
      statusesByProject[pid] = statuses.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        position: s.position,
        is_closed: s.is_closed,
      }))
    })
  )

  return (
    <MyWorkPage
      workItems={workItems}
      mentionedComments={mentionedComments}
      pinnedItemIds={[...pinnedItemIds]}
      readCommentIds={[...readCommentIds]}
      pinnedProjects={pinnedProjects}
      allProjects={allProjects}
      statusesByProject={statusesByProject}
    />
  )
}
