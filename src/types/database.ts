// 앱 레벨 타입 정의
// DB 타입의 단일 원천: src/types/supabase.ts (supabase gen types로 생성)

import type { Tables, Enums } from './supabase'
export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from './supabase'

// ── DB Row 타입 (Supabase 생성 타입에서 파생) ──────────────

export type WorkItemRow = Tables<'work_items'>
export type StatusRow = Tables<'statuses'>
export type TrackerRow = Tables<'trackers'>
export type ProfileRow = Tables<'profiles'>
export type CommentRow = Tables<'comments'>
export type ProjectMemberRow = Tables<'project_members'>
export type WorkItemAuditLogRow = Tables<'work_item_audit_logs'>
export type ProjectAuditLogRow = Tables<'project_audit_logs'>

// ── AI 메타데이터 ─────────────────────────────────────────

export interface AiMetadata {
  model: string
  prompt_summary?: string
  last_action?: 'create' | 'update'
  updated_fields?: string[]
}

// ── 시멘틱 타입 ────────────────────────────────────────────

export type ProjectRole = Enums<'project_role'>
export type AppRole = Enums<'app_role'>
export type Priority = 0 | 1 | 2 | 3 | 4
export type ProjectType = 'requirement' | 'issue'

export interface ExternalLinkEntry {
  id: string
  label: string
  url: string
  created_at: string
}

export interface WorkItemExternalLink {
  url: string
  label?: string
}

export type PipelinePhase = 'prospect' | 'sales' | 'contracted' | 'active' | 'delivered' | 'settled'
export type PipelineCategory = 'internal' | 'government' | 'contract'

export interface ProjectSettings {
  show_tracker_id?: boolean
  show_tracker_id_in_document?: boolean
  auto_insert_date?: boolean
  slack_channel_id?: string
  google_drive_url?: string
  external_links?: ExternalLinkEntry[]
  pipeline_start_date?: string
  pipeline_end_date?: string
  pipeline_budget?: string
  pipeline_phase?: PipelinePhase
  pipeline_note?: string
  pipeline_category?: PipelineCategory
  cover_image_path?: string
}

// Project (settings를 Json → ProjectSettings로 오버라이드)
export interface Project extends Omit<Tables<'projects'>, 'settings' | 'project_type'> {
  project_type: ProjectType
  settings: ProjectSettings | null
}

// ── 컴포넌트용 조합 타입 (조인 쿼리 결과) ──────────────────

// 담당자/보고자 (프로필 부분 조인)
export interface PersonRef {
  id: string
  full_name: string | null
  avatar_url: string | null
}

// 에이전트 참조 (agents 테이블 부분 조인)
export interface AgentRef {
  id: string
  name: string
  display_name: string
  avatar_url: string | null
}

// 트래커 서브셋 (컴포넌트 표시용)
export interface TrackerRef {
  id: string
  name: string
  color: string | null
}

// 상태 서브셋 (컴포넌트 표시용 + 필터 칩)
export interface StatusRef {
  id: string
  name: string
  color: string | null
  position: number
  is_closed: boolean | null
}

// Work item + 조인 관계 (alm-layout, kanban, realtime hook에서 사용)
export interface WorkItemWithRelations extends WorkItemRow {
  tracker: TrackerRef
  status: StatusRef | null
  assignee: PersonRef | null
  reporter: PersonRef | null
  agent_assignee: AgentRef | null
  agent_reporter: AgentRef | null
}

// 트리 패널용 최소 work item
export type TreeWorkItem = Pick<
  WorkItemWithRelations,
  'id' | 'number' | 'title' | 'parent_id' | 'position' | 'status' | 'tracker' | 'visibility' | 'created_by_ai'
>

// ── 링크 타입 ────────────────────────────────────────────

export interface WorkItemLinkSummary {
  id: string
  direction: 'outgoing' | 'incoming'
  suspect: boolean
  linked_item: {
    id: string
    number: number
    title: string
    project_key: string
    tracker_name: string
    tracker_color: string | null
    status_name: string
    status_color: string | null
    is_deleted: boolean
  }
}

export interface LinkableWorkItem {
  id: string
  number: number
  title: string
  parent_id: string | null
  position: number
  tracker_name: string
  tracker_color: string | null
}

export interface LinkCount {
  work_item_id: string
  link_count: number
  has_suspect: boolean
}

export interface LinkedIssueStatus {
  work_item_id: string
  worst_status_name: string
  worst_status_color: string
}

// ── 추적성 매트릭스 타입 ───────────────────────────────────

// 매트릭스 행 (현재 프로젝트의 작업 항목)
export interface MatrixWorkItem {
  id: string
  number: number
  title: string
  parent_id: string | null
  position: number
  level: number
  tracker: TrackerRef
  status: StatusRef
}

// 매트릭스 컬럼 그룹 (외부 프로젝트의 작업 항목)
export interface MatrixColumnGroup {
  project_id: string
  project_key: string
  project_name: string
  items: MatrixWorkItem[]
}

// 매트릭스 링크 (행-컬럼 연결)
export interface MatrixLink {
  id: string
  source_id: string
  target_id: string
  suspect: boolean
}

// 추적성 매트릭스 데이터
export interface TraceabilityMatrixData {
  rows: MatrixWorkItem[]
  columnGroups: MatrixColumnGroup[]
  links: MatrixLink[]
}

// ── 크로스 프로젝트 링크 ─────────────────────────────────────

export interface CrossProjectLink {
  source_project_id: string
  source_project_key: string
  source_project_name: string
  target_project_id: string
  target_project_key: string
  target_project_name: string
  link_count: number
  suspect_count: number
}

// ── 댓글 첨부 이미지 ────────────────────────────────────────

export interface CommentAttachment {
  id: string
  storage_path: string
  file_name: string
  file_size: number
  content_type: string
}

// ── 하위 호환 별칭 ─────────────────────────────────────────

export type WorkItem = WorkItemRow
export type Status = StatusRow
export type Tracker = TrackerRow
export type Profile = ProfileRow
export type Comment = CommentRow
export type ProjectMember = ProjectMemberRow
export type WorkItemAuditLog = WorkItemAuditLogRow
export type ProjectAuditLog = ProjectAuditLogRow

// Agent types (agents table added in migration 030)
export type AgentStatus = 'active' | 'inactive' | 'revoked'
