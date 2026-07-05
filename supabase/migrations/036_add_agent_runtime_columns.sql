-- =============================================
-- 036: agents 런타임 컬럼 정합화 (과거 Supabase MCP로 직접 적용됐던 분)
-- auth.ts / 웹 UI createGlobalAgent / supabase.ts agents Row 가 요구하는 4컬럼.
-- agents 테이블은 030에서 생성되므로 이 컬럼 보강은 그 이후(036)에 둔다.
-- =============================================
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS agent_kind    text NOT NULL DEFAULT 'mcp',
  ADD COLUMN IF NOT EXISTS agent_role    text NOT NULL DEFAULT 'worker',
  ADD COLUMN IF NOT EXISTS agent_runtime text NOT NULL DEFAULT 'claude-code',
  ADD COLUMN IF NOT EXISTS agent_model   text;
