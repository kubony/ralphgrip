'use client'

import { useMemo } from 'react'
import { OverviewStats } from './overview-stats'
import { OverviewCharts } from './overview-charts'
import { RecentActivitySection } from './recent-activity-section'
import { RelatedProjectsSection } from './related-projects-section'
import { ProjectIntroSection } from './project-intro-section'
import type { CrossProjectLink } from '@/types/database'
import {
  computeStatusDistribution,
  computeOverdueCount,
  computeBurndownData,
  computeActivityTrend,
} from './utils'

interface WorkItem {
  id: string
  number: number
  title: string
  status_id: string
  assignee_id: string | null
  due_date: string | null
  created_at: string
  status?: { id: string; name: string; color: string | null; is_closed: boolean; position: number } | null
  assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null
  tracker?: { id: string; name: string } | null
  [key: string]: unknown
}

interface Status {
  id: string
  name: string
  color: string | null
  position: number
  is_closed: boolean
}

interface Member {
  id: string
  full_name: string | null
  avatar_url: string | null
}

interface AuditLog {
  id: string
  work_item_id: string
  operation: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[]
  changed_at: string
}

interface ActivityLog {
  id: string
  work_item_id: string
  operation: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[]
  changed_at: string
  user: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface RecentComment {
  id: string
  content: string
  created_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
  work_item: { id: string; number: number; title: string; project_id: string }
}

interface ProjectOverviewProps {
  workItems: WorkItem[]
  statuses: Status[]
  members: Member[]
  auditLogs: AuditLog[]
  activityLogs: ActivityLog[]
  recentComments: RecentComment[]
  relatedProjects?: CrossProjectLink[]
  currentProjectKey?: string
  projectId?: string
  projectName?: string
  projectType?: string
  description?: string | null
  coverImagePath?: string | null
  owner?: { id: string; full_name: string | null; avatar_url: string | null } | null
  memberCount?: number
  createdAt?: string
  canEdit?: boolean
}

export function ProjectOverview({ workItems, statuses, members, auditLogs, activityLogs, recentComments, relatedProjects, currentProjectKey, projectId, projectName, projectType, description, coverImagePath, owner, memberCount, createdAt, canEdit }: ProjectOverviewProps) {
  const stats = useMemo(() => {
    const total = workItems.length
    const completed = workItems.filter((wi) => wi.status?.is_closed).length
    const inProgress = total - completed
    const overdue = computeOverdueCount(workItems)
    return { total, inProgress, completed, overdue }
  }, [workItems])

  const statusData = useMemo(
    () => computeStatusDistribution(workItems, statuses),
    [workItems, statuses]
  )

  const burndownData = useMemo(
    () => computeBurndownData(workItems, auditLogs, statuses),
    [workItems, auditLogs, statuses]
  )

  const activityData = useMemo(
    () => computeActivityTrend(workItems, auditLogs, statuses),
    [workItems, auditLogs, statuses]
  )

  return (
    <div className="space-y-6 p-6 overflow-auto h-full">
      {projectId && projectName && currentProjectKey && projectType && createdAt && (
        <ProjectIntroSection
          projectId={projectId}
          projectKey={currentProjectKey}
          projectName={projectName}
          projectType={projectType}
          description={description ?? null}
          coverImagePath={coverImagePath ?? null}
          owner={owner ?? null}
          memberCount={memberCount ?? members.length}
          createdAt={createdAt}
          canEdit={canEdit ?? false}
        />
      )}
      <OverviewStats
        total={stats.total}
        inProgress={stats.inProgress}
        completed={stats.completed}
        overdue={stats.overdue}
      />
      <OverviewCharts
        statusData={statusData}
        workItems={workItems}
        members={members}
        burndownData={burndownData}
        activityData={activityData}
      />
      {currentProjectKey && (
        <RecentActivitySection
          activityLogs={activityLogs}
          recentComments={recentComments}
          workItems={workItems}
          statuses={statuses}
          members={members}
          projectKey={currentProjectKey}
        />
      )}
      {relatedProjects && relatedProjects.length > 0 && currentProjectKey && (
        <RelatedProjectsSection
          currentProjectKey={currentProjectKey}
          relatedProjects={relatedProjects}
        />
      )}
    </div>
  )
}
