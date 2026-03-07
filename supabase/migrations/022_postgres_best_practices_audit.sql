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
ALTER FUNCTION public.update_work_item_level() SET search_path = public;
ALTER FUNCTION public.validate_work_item_link() SET search_path = public;

-- =============================================
-- 3. Views: SECURITY DEFINER → SECURITY INVOKER
-- Best Practice: security-privileges
-- =============================================
CREATE OR REPLACE VIEW public.active_projects
  WITH (security_invoker = true) AS
  SELECT id, name, description, key, owner_id, created_at, updated_at,
         project_type, settings, deleted_at
  FROM public.projects
  WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.active_work_items
  WITH (security_invoker = true) AS
  SELECT id, project_id, tracker_id, status_id, parent_id, number, title,
         description, assignee_id, reporter_id, priority, due_date,
         "position", created_at, updated_at, external_url,
         estimated_hours, actual_hours, start_date, deleted_at
  FROM public.work_items
  WHERE deleted_at IS NULL;

-- =============================================
-- 4. Move pg_trgm extension to extensions schema
-- Best Practice: extension should not be in public
-- =============================================
-- Drop dependent GIN indexes first
DROP INDEX IF EXISTS public.idx_projects_name_trgm;
DROP INDEX IF EXISTS public.idx_work_items_title_trgm;

-- Move extension to extensions schema
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Recreate GIN indexes with extensions schema operator class
CREATE INDEX idx_projects_name_trgm
  ON public.projects USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_work_items_title_trgm
  ON public.work_items USING gin (title extensions.gin_trgm_ops);
