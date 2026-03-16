// MCP Server specific types — self-contained, no dependency on main app's types

export interface ProjectSummary {
  id: string
  key: string
  name: string
  description: string | null
  project_type: string
  created_at: string
}

export interface ProjectMeta {
  project: { id: string; key: string; name: string; description: string | null }
  statuses: StatusRef[]
  trackers: TrackerRef[]
  members: MemberRef[]
}

export interface StatusRef {
  id: string
  name: string
  color: string | null
  position: number
  is_closed: boolean | null
}

export interface TrackerRef {
  id: string
  name: string
  color: string | null
}

export interface MemberRef {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface WorkItemSummary {
  id: string
  number: number
  title: string
  description: string | null
  priority: number
  position: number
  parent_id: string | null
  start_date: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  tracker: TrackerRef | null
  status: StatusRef | null
  assignee: MemberRef | null
  agent_assignee: AgentRef | null
}

export interface AgentRef {
  id: string
  name: string
  display_name: string
  avatar_url: string | null
}

export interface TreeNode extends WorkItemSummary {
  children: TreeNode[]
}

export interface CommentSummary {
  id: string
  content: string
  created_at: string
  author: MemberRef | null
  agent: AgentRef | null
}

export interface LinkSummary {
  id: string
  direction: 'outgoing' | 'incoming'
  suspect: boolean
  linked_item: {
    id: string
    number: number
    title: string
    project_key: string
    status_name: string
    status_color: string | null
  }
}

// Error codes used across all tools
export type ErrorCode =
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export interface ToolError {
  error: ErrorCode
  message: string
  details?: Record<string, unknown>
}

export function toolSuccess(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  }
}

export function toolError(code: ErrorCode, message: string, details?: Record<string, unknown>) {
  const payload: ToolError = { error: code, message, ...(details && { details }) }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    isError: true as const,
  }
}
