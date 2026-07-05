-- =============================================
-- 0212: 과거 Supabase MCP로 out-of-band 적용됐던 스키마의 정합화
-- (마이그레이션 파일엔 없으나 supabase.ts / 이후 마이그레이션·뷰가 참조하는 컬럼들)
-- 순서: 020 이후 ~ 022 이전 (022 뷰/이후 마이그레이션이 참조하기 전에 존재해야 함)
-- 모든 컬럼은 supabase.ts Row 타입에서 도출. 기본값이 시맨틱을 좌우하지 않도록 처리.
-- =============================================

-- projects: project_type / settings
-- project_type 기본값 'issue'는 033 트리거의 COALESCE(new.project_type, 'issue') 시맨틱과 일치.
-- (앱 createProject는 항상 project_type을 명시 insert하므로 실사용 영향은 제한적)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text NOT NULL DEFAULT 'issue';
-- settings: supabase.ts Row가 Json|null 이므로 기본값 없이 nullable
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS settings jsonb;

-- work_items: supabase.ts에 있으나 어떤 마이그레이션도 ADD하지 않는 MCP-only 컬럼들.
-- 전부 nullable(| null)이라 기본값이 시맨틱을 좌우하지 않음. 타입은 supabase.ts에서 도출.
ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS estimated_hours numeric,      -- number | null
  ADD COLUMN IF NOT EXISTS actual_hours    numeric,      -- number | null
  ADD COLUMN IF NOT EXISTS level           integer,      -- number | null (update_work_item_level 대상; 함수는 MCP-only라 생략)
  ADD COLUMN IF NOT EXISTS ai_metadata     jsonb,        -- Json | null
  ADD COLUMN IF NOT EXISTS created_by_ai   boolean,      -- boolean | null
  ADD COLUMN IF NOT EXISTS visibility      text;         -- string | null
