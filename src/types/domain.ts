/**
 * Domain Entity Types
 * 비즈니스 도메인 관련 타입 (컴포넌트와 독립적)
 */

import type { Priority, ProjectRole, ProjectType } from './database'

// ============ Common ============

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

export interface Assignee {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface Reporter {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface Author {
  id: string
  full_name: string | null
  avatar_url: string | null
}

// ============ Project ============

export interface ProjectInfo {
  id: string
  name: string
  key: string
  description: string | null
  project_type: ProjectType
  owner_id: string
  created_at: string
}

export interface Member {
  id: string
  user_id: string
  full_name: string | null
  email: string
  role: ProjectRole
  avatar_url: string | null
}

export interface MemberInfo {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: ProjectRole
}

// ============ Tracker & Status ============

export interface TrackerInfo {
  id: string
  name: string
  color: string | null
  icon: string | null
  position: number
}

export interface StatusInfo {
  id: string
  name: string
  color: string | null
  position: number
  is_closed: boolean
}

// ============ Work Item ============

export interface WorkItemStatus {
  id: string
  name: string
  color: string | null
  is_closed: boolean
}

export interface WorkItemTracker {
  id: string
  name: string
  color: string | null
}

export interface WorkItemDetail {
  id: string
  number: number
  title: string
  description: string | null
  priority: Priority
  position: number
  status_id: string | null
  parent_id: string | null
  due_date: string | null
  start_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  external_url: string | null
  created_at: string
  tracker: WorkItemTracker
  status: WorkItemStatus | null
  assignee: Assignee | null
  reporter: Reporter | null
}

// ============ Comments ============

export interface CommentDetail {
  id: string
  content: string
  created_at: string
  updated_at: string
  author: Author | null
}

// ============ UI State ============

export interface Selection {
  type: 'none' | 'workitem'
  id?: string
  ids?: Set<string>
}

export interface DropIndicator {
  itemId: string
  position: 'before' | 'after' | 'inside'
}

// ============ Export Formats ============

export interface CsvWorkItem {
  number: string
  title: string
  tracker: string
  status: string
  assignee: string
  priority: string
  dueDate: string
  description: string
}

export interface PdfWorkItem {
  number: number
  title: string
  tracker: string
  status: string
  assignee: string
  priority: number
  description: string | null
}

export interface ProjectPdfOptions {
  includeDescription: boolean
  showStatus: boolean
  showAssignee: boolean
}

export interface FolderData {
  id: string
  name: string
  children: FolderData[]
}

export interface FolderNodeProps {
  id: string
  name: string
  children: FolderNodeProps[]
}

export interface TreeNodeProps {
  id: string
  title: string
  children: TreeNodeProps[]
}

export interface TreeViewProps {
  readonly nodes: TreeNodeProps[]
  readonly onNodeClick?: (id: string) => void
}
