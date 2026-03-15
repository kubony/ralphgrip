import type { WorkItemWithRelations } from '@/types/database'

export interface AssigneeDisplay {
  name: string | null
  avatar: string | null
  isAgent: boolean
}

export function getAssigneeDisplay(workItem: WorkItemWithRelations): AssigneeDisplay | null {
  if (workItem.assignee) {
    return { name: workItem.assignee.full_name, avatar: workItem.assignee.avatar_url, isAgent: false }
  }
  if (workItem.agent_assignee) {
    return { name: workItem.agent_assignee.display_name, avatar: workItem.agent_assignee.avatar_url, isAgent: true }
  }
  return null
}

export function getReporterDisplay(workItem: WorkItemWithRelations): AssigneeDisplay | null {
  if (workItem.reporter) {
    return { name: workItem.reporter.full_name, avatar: workItem.reporter.avatar_url, isAgent: false }
  }
  if (workItem.agent_reporter) {
    return { name: workItem.agent_reporter.display_name, avatar: workItem.agent_reporter.avatar_url, isAgent: true }
  }
  return null
}
