-- ============================================
-- 034: MCP Server Support
-- reporter_id NOT NULL 해제 + set_agent_context() 함수
-- ============================================

-- 1. reporter_id NOT NULL 제약 해제
-- 에이전트가 work item 생성 시 reporter_id 대신 agent_reporter_id 사용
-- 기존 CHECK: NOT (reporter_id IS NOT NULL AND agent_reporter_id IS NOT NULL)
-- UI의 createWorkItem은 항상 user.id를 설정하므로 기존 동작에 영향 없음
ALTER TABLE public.work_items ALTER COLUMN reporter_id DROP NOT NULL;

-- 2. set_agent_context() — 에이전트 컨텍스트를 DB 세션에 설정
-- work_item_audit_logs 트리거의 current_setting('app.current_agent_id', true)와 연동
CREATE OR REPLACE FUNCTION public.set_agent_context(p_agent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_agent_id', p_agent_id::text, true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_agent_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_agent_context(uuid) TO service_role;
