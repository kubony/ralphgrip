-- ============================================
-- 031: Global agents — 에이전트를 글로벌/카테고리 기반으로 확장
-- ============================================

-- 1. agents 테이블 확장
ALTER TABLE public.agents
  ALTER COLUMN project_id DROP NOT NULL,
  ADD COLUMN category text NOT NULL DEFAULT 'owned',
  ADD COLUMN owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 카테고리 제약조건
ALTER TABLE public.agents
  ADD CONSTRAINT agents_category_check CHECK (
    category IN ('global', 'owned', 'restricted')
  );

-- UNIQUE 제약조건 수정: project_id가 NULL인 글로벌 에이전트를 허용
-- 기존 UNIQUE(project_id, name) 제거 후 조건부 UNIQUE 생성
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_project_id_name_key;

CREATE UNIQUE INDEX idx_agents_project_name ON public.agents(project_id, name)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX idx_agents_global_name ON public.agents(name)
  WHERE project_id IS NULL;

-- owner_id 인덱스
CREATE INDEX idx_agents_owner ON public.agents(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_agents_category ON public.agents(category);

-- 2. agent_permissions 테이블 (restricted 에이전트 접근 권한)
CREATE TABLE public.agent_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(agent_id, user_id)
);

CREATE INDEX idx_agent_permissions_agent ON public.agent_permissions(agent_id);
CREATE INDEX idx_agent_permissions_user ON public.agent_permissions(user_id);

ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own permissions"
  ON public.agent_permissions FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Agent owner can manage permissions"
  ON public.agent_permissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = agent_permissions.agent_id AND a.owner_id = (SELECT auth.uid())
  ));

-- 3. agent_logs 테이블 (에이전트 활동 로그)
CREATE TABLE public.agent_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_agent_logs_agent ON public.agent_logs(agent_id);
CREATE INDEX idx_agent_logs_created ON public.agent_logs(created_at DESC);

ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agent logs"
  ON public.agent_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert agent logs"
  ON public.agent_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. RLS 정책 업데이트 — 글로벌 에이전트는 모든 인증 사용자 조회 가능
DROP POLICY IF EXISTS "Project members can view agents" ON public.agents;

CREATE POLICY "Users can view accessible agents"
  ON public.agents FOR SELECT
  USING (
    -- 글로벌 에이전트: 인증된 모든 사용자
    (project_id IS NULL AND category = 'global' AND auth.uid() IS NOT NULL)
    OR
    -- owned 에이전트: 본인이 생성한 에이전트
    (category = 'owned' AND owner_id = (SELECT auth.uid()))
    OR
    -- restricted 에이전트: 권한 부여된 사용자
    (category = 'restricted' AND EXISTS (
      SELECT 1 FROM public.agent_permissions ap
      WHERE ap.agent_id = agents.id AND ap.user_id = (SELECT auth.uid())
    ))
    OR
    -- restricted 에이전트: 생성자 본인
    (category = 'restricted' AND owner_id = (SELECT auth.uid()))
    OR
    -- 프로젝트 에이전트: 프로젝트 멤버
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = agents.project_id AND pm.user_id = (SELECT auth.uid())
    ))
  );

-- INSERT 정책 업데이트 — 글로벌 에이전트 생성도 허용
DROP POLICY IF EXISTS "Project admin/owner can insert agents" ON public.agents;

CREATE POLICY "Users can create agents"
  ON public.agents FOR INSERT
  WITH CHECK (
    -- 글로벌/owned/restricted 에이전트: 인증된 사용자 누구나 생성 가능
    (project_id IS NULL AND auth.uid() IS NOT NULL)
    OR
    -- 프로젝트 에이전트: admin/owner만
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = agents.project_id AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'admin')
    ))
  );

-- UPDATE 정책 업데이트
DROP POLICY IF EXISTS "Project admin/owner can update agents" ON public.agents;

CREATE POLICY "Users can update their agents"
  ON public.agents FOR UPDATE
  USING (
    -- 본인이 생성한 에이전트
    (owner_id = (SELECT auth.uid()))
    OR
    -- 프로젝트 에이전트: admin/owner
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = agents.project_id AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'admin')
    ))
  );

-- DELETE 정책 업데이트
DROP POLICY IF EXISTS "Project admin/owner can delete agents" ON public.agents;

CREATE POLICY "Users can delete their agents"
  ON public.agents FOR DELETE
  USING (
    -- 본인이 생성한 에이전트
    (owner_id = (SELECT auth.uid()))
    OR
    -- 프로젝트 에이전트: admin/owner
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = agents.project_id AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'admin')
    ))
  );
