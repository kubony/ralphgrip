-- =============================================================================
-- 039: work_items.git_context 추가 (에이전트 작업의 git 컨텍스트)
-- 웹 UI에서 태스크를 볼 때 에이전트가 어느 레포/브랜치/워크트리에서 작업 중인지
-- 보여주기 위한 nullable jsonb 컬럼. MCP 보고 툴이 기록 시점에 교체(merge 아님)로 쓴다.
-- 계약: { repo_url?, branch?, worktree?, commit?, updated_at? }
-- 인덱스 불필요 (조회는 항상 특정 work_item 단위).
-- =============================================================================

ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS git_context jsonb;

COMMENT ON COLUMN public.work_items.git_context IS
  '에이전트 작업의 git 컨텍스트: { repo_url?, branch?, worktree?, commit?, updated_at? }. MCP 보고 툴이 기록 시점에 교체로 설정.';
