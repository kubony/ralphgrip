import type { WorkItemWithRelations } from '@/types/database'

export interface InboxAgentRef {
  id: string
  name: string
  display_name: string
  avatar_url: string | null
}

// 인박스 행 렌더링 + 상세 다이얼로그 전환에 필요한 필드 (getInboxWorkItems가 `*`로 조회)
export interface InboxWorkItem {
  id: string
  number: number
  title: string
  description: string | null
  priority: number
  status_id: string | null
  tracker_id: string
  project_id: string
  parent_id: string | null
  assignee_id: string | null
  reporter_id: string
  due_date: string | null
  start_date: string | null
  created_at: string
  updated_at: string
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
  agent_assignee: InboxAgentRef | null
  // getInboxWorkItems가 `*`로 나머지 컬럼도 포함하므로 상세 다이얼로그 변환에 사용
  [key: string]: unknown
}

export interface MentionedComment {
  id: string
  content: string
  created_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
  agent: { id: string; display_name: string; avatar_url: string | null; agent_kind: string } | null
  work_item: {
    id: string
    number: number
    title: string
    project_id: string
    project: { id: string; name: string; key: string }
  }
}

export interface AgentComment {
  id: string
  content: string
  created_at: string
  agent: { id: string; display_name: string; avatar_url: string | null; agent_kind: string } | null
  work_item: {
    id: string
    number: number
    title: string
    project_id: string
    project: { id: string; name: string; key: string }
  }
}

// 인박스 상태 이름 상수 (프로젝트별 statuses.name과 매칭)
export const INBOX_STATUS = {
  RESOLVED: 'Resolved',
  ISSUE: 'Issue',
  IN_PROGRESS: 'In Progress',
} as const

/** 상세 다이얼로그(WorkItemDetailDialog)가 요구하는 형태로 변환 */
export function toWorkItemWithRelations(item: InboxWorkItem): WorkItemWithRelations {
  const rest = Object.fromEntries(
    Object.entries(item).filter(([key]) => key !== 'project')
  )
  return {
    ...rest,
    tracker: item.tracker ?? { id: item.tracker_id, name: 'Unknown', color: null },
  } as unknown as WorkItemWithRelations
}
