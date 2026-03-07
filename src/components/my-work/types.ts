export type RoleType = 'assigned' | 'created' | 'mentioned'
export type RoleFilter = RoleType | null

export interface MyWorkItem {
  id: string
  number: number
  title: string
  description: string | null
  priority: number
  position: number
  status_id: string | null
  tracker_id: string
  project_id: string
  parent_id: string | null
  assignee_id: string | null
  reporter_id: string
  due_date: string | null
  start_date: string | null
  actual_start_date?: string | null
  actual_end_date?: string | null
  estimated_hours: number | null
  actual_hours: number | null
  external_url: string | null
  created_at: string
  updated_at: string
  matchReasons: RoleType[]
  project: {
    id: string
    name: string
    key: string
    project_type: string
  } | null
  tracker: {
    id: string
    name: string
    color: string | null
  } | null
  status: {
    id: string
    name: string
    color: string | null
    position: number
    is_closed: boolean
  } | null
  assignee: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
  reporter: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface MentionedComment {
  id: string
  content: string
  created_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
  work_item: {
    id: string
    number: number
    title: string
    project_id: string
    project: { id: string; name: string; key: string }
  }
}

export type Phase = 'todo' | 'in_progress' | 'done'
export type MyWorkTab = 'my-work' | 'mentions'
export type DueDateFilter = 'all' | 'overdue' | 'today' | 'this_week' | 'unset'
export type SortField = 'due_date' | 'priority' | 'updated_at' | 'status' | 'project'
export type SortOrder = 'asc' | 'desc'
export type ViewMode = 'list' | 'kanban' | 'timeline'
export type TimelineGroupMode = 'project' | 'flat'
export type StatFilter = 'in_progress' | 'completed' | 'due_soon' | 'urgent' | null

export interface StatusOption {
  id: string
  name: string
  color: string | null
  position: number
  is_closed: boolean
}

export type StatusesByProject = Record<string, StatusOption[]>

export interface Filters {
  projects: string[]
  phases: Phase[]
  priorities: number[]
  dueDate: DueDateFilter
}

const TODO_STATUS_NAMES = new Set(['open', 'draft', 'to do', 'new'])

export function getPhase(status: MyWorkItem['status']): Phase {
  if (!status) return 'todo'
  if (status.is_closed) return 'done'
  if (status.position === 0) return 'todo'
  if (TODO_STATUS_NAMES.has(status.name.toLowerCase())) return 'todo'
  return 'in_progress'
}

export const phaseLabels: Record<Phase, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

export const priorityLabels: Record<number, string> = {
  0: 'None',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical',
}

export const priorityColors: Record<number, string> = {
  0: 'bg-gray-400',
  1: 'bg-blue-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
}

export function toWorkItemWithRelations(item: MyWorkItem): import('@/types/database').WorkItemWithRelations {
  const rest = Object.fromEntries(
    Object.entries(item).filter(([key]) => key !== 'matchReasons' && key !== 'project')
  )
  return {
    ...rest,
    tracker: item.tracker ?? { id: item.tracker_id, name: 'Unknown', color: null },
  } as unknown as import('@/types/database').WorkItemWithRelations
}
