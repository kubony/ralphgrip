import { redirect } from 'next/navigation'
import {
  getCurrentUser,
  getInboxWorkItems,
  getMyMentionedComments,
  getMyReadCommentIds,
  getRecentAgentComments,
  getPinnedProjects,
  getUserProjects,
} from '@/lib/supabase/cached-queries'
import { InboxPage } from '@/components/inbox/inbox-page'
import type { InboxWorkItem, MentionedComment, AgentComment } from '@/components/inbox/types'

export default async function InboxServerPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [workItems, mentionedComments, readCommentIds, agentComments, pinnedProjects, allProjects] = await Promise.all([
    getInboxWorkItems(user.id),
    getMyMentionedComments(user.id),
    getMyReadCommentIds(user.id),
    getRecentAgentComments(user.id),
    getPinnedProjects(user.id),
    getUserProjects(user.id),
  ])

  return (
    <InboxPage
      workItems={workItems as unknown as InboxWorkItem[]}
      mentionedComments={mentionedComments as unknown as MentionedComment[]}
      readCommentIds={[...readCommentIds]}
      agentComments={agentComments as unknown as AgentComment[]}
      pinnedProjects={pinnedProjects}
      allProjects={allProjects}
    />
  )
}
