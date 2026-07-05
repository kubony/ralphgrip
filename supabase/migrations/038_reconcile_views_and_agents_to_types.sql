-- =============================================================================
-- 038: gen types(src/types/supabase.ts) 대조 결과 잔여 스키마 정합화
-- - agents.agent_type 제거 (canonical/oracle(worvgrip) 모두 부재)
-- - active_projects 뷰: is_demo 포함되도록 재생성 (025 이후 전체 컬럼 반영)
-- - active_work_items 뷰: canonical 명시 컬럼 목록으로 재생성
--   (agent_assignee_id/agent_reporter_id 제외, actual_resolved_date 포함)
-- 근거: supabase.ts Views Row 컬럼 목록. seed 데이터 보존 위해 push로 적용.
-- =============================================================================

-- 1. agents.agent_type 제거 (supabase.ts·worvgrip 오라클 모두 없음)
ALTER TABLE public.agents DROP COLUMN IF EXISTS agent_type;

-- 2. active_projects: 전체 projects 컬럼(SELECT *) — 이제 is_demo 포함
DROP VIEW IF EXISTS public.active_projects;
CREATE VIEW public.active_projects
  WITH (security_invoker = true) AS
  SELECT * FROM public.projects
  WHERE deleted_at IS NULL;

-- 3. active_work_items: canonical 명시 컬럼 목록 (supabase.ts 기준)
DROP VIEW IF EXISTS public.active_work_items;
CREATE VIEW public.active_work_items
  WITH (security_invoker = true) AS
  SELECT
    id, project_id, tracker_id, status_id, folder_id, parent_id, number,
    title, description, assignee_id, reporter_id, priority, due_date,
    "position", created_at, updated_at, external_url, start_date,
    actual_start_date, actual_end_date, actual_resolved_date,
    estimated_hours, actual_hours, level, ai_metadata, created_by_ai,
    visibility, deleted_at
  FROM public.work_items
  WHERE deleted_at IS NULL;
