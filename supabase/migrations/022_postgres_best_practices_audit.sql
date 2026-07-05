-- =============================================
-- Postgres Best Practices Audit Fix
-- Based on supabase-postgres-best-practices skill
-- Scope: Performance + Security (RLS 제외)
-- =============================================

-- =============================================
-- 1. Missing FK Indexes (3건)
-- Best Practice: schema-foreign-key-indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_project_audit_logs_changed_by
  ON public.project_audit_logs (changed_by)
  WHERE changed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_item_audit_logs_changed_by
  ON public.work_item_audit_logs (changed_by)
  WHERE changed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_item_links_created_by
  ON public.work_item_links (created_by)
  WHERE created_by IS NOT NULL;

-- =============================================
-- 2. Function search_path hardening (26건)
-- Best Practice: security-privileges
-- Prevents search_path injection attacks
-- =============================================
ALTER FUNCTION public.add_owner_as_member() SET search_path = public;
ALTER FUNCTION public.batch_soft_delete_work_items(uuid, uuid[]) SET search_path = public;
ALTER FUNCTION public.create_default_trackers_and_statuses() SET search_path = public;
ALTER FUNCTION public.get_project_role(uuid) SET search_path = public;
ALTER FUNCTION public.get_work_item_link_counts(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.init_work_item_sequence() SET search_path = public;
ALTER FUNCTION public.is_project_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_project_member(uuid) SET search_path = public;
ALTER FUNCTION public.log_project_changes() SET search_path = public;
ALTER FUNCTION public.log_work_item_changes() SET search_path = public;
ALTER FUNCTION public.log_work_item_link_change() SET search_path = public;
ALTER FUNCTION public.move_work_items_batch(uuid, work_item_move[]) SET search_path = public;
ALTER FUNCTION public.permanently_delete_work_item(uuid) SET search_path = public;
ALTER FUNCTION public.reorder_work_items(uuid, uuid, uuid[]) SET search_path = public;
ALTER FUNCTION public.restore_project(uuid) SET search_path = public;
ALTER FUNCTION public.restore_work_item(uuid) SET search_path = public;
ALTER FUNCTION public.set_suspect_on_work_item_change() SET search_path = public;
ALTER FUNCTION public.set_work_item_number() SET search_path = public;
ALTER FUNCTION public.soft_delete_project(uuid) SET search_path = public;
ALTER FUNCTION public.soft_delete_work_item(uuid) SET search_path = public;
ALTER FUNCTION public.touch_project_view(uuid) SET search_path = public;
ALTER FUNCTION public.update_comments_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
-- update_work_item_level()는 마이그레이션에 정의되지 않은 함수(과거 Supabase MCP로 직접 생성됨).
-- 깨끗한 순차 적용 시 부재하므로, 존재할 때만 search_path 하드닝을 적용하도록 가드한다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_work_item_level'
  ) THEN
    ALTER FUNCTION public.update_work_item_level() SET search_path = public;
  END IF;
END $$;
ALTER FUNCTION public.validate_work_item_link() SET search_path = public;

-- =============================================
-- 3. Views: SECURITY DEFINER → SECURITY INVOKER
-- Best Practice: security-privileges
-- =============================================
-- [정합화] 017이 이 뷰들을 SELECT * 로 생성했고, project_type/settings 등 신규 컬럼이
-- 중간에 삽입되면 CREATE OR REPLACE로는 컬럼 순서 변경 불가(42P16). 또한 명시 컬럼 목록은
-- 아직 존재하지 않는 컬럼(start_date는 032에서 추가)을 참조한다. 따라서 DROP 후 SELECT * 로
-- 재생성하여 security_invoker만 적용한다(017/032와 동일한 SELECT * 방식).
DROP VIEW IF EXISTS public.active_projects;
CREATE VIEW public.active_projects
  WITH (security_invoker = true) AS
  SELECT * FROM public.projects
  WHERE deleted_at IS NULL;

DROP VIEW IF EXISTS public.active_work_items;
CREATE VIEW public.active_work_items
  WITH (security_invoker = true) AS
  SELECT * FROM public.work_items
  WHERE deleted_at IS NULL;

-- =============================================
-- 4. Move pg_trgm extension to extensions schema
-- Best Practice: extension should not be in public
-- =============================================
-- Drop dependent GIN indexes first
DROP INDEX IF EXISTS public.idx_projects_name_trgm;
DROP INDEX IF EXISTS public.idx_work_items_title_trgm;

-- [정합화] pg_trgm은 과거 MCP로 설치됐고 마이그레이션엔 CREATE EXTENSION이 없다.
-- fresh DB엔 부재하므로 extensions 스키마에 직접 설치. 이미 public에 있으면 extensions로 이동.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

-- Recreate GIN indexes with extensions schema operator class
CREATE INDEX idx_projects_name_trgm
  ON public.projects USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_work_items_title_trgm
  ON public.work_items USING gin (title extensions.gin_trgm_ops);
