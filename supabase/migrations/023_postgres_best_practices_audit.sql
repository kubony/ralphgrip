-- =============================================
-- Postgres Best Practices Audit (2026-02-09)
-- =============================================

-- 1. Function search_path: create_default_trackers_and_statuses
-- SECURITY DEFINER 함수에 search_path가 설정되지 않아 보안 위험
-- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
ALTER FUNCTION public.create_default_trackers_and_statuses() SET search_path = public;
