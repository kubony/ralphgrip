-- ============================================
-- 030: Add agents table and agent_id FK columns
-- AI 에이전트를 1급 엔티티로 관리
-- ============================================

-- 1. Agent status enum
CREATE TYPE public.agent_status AS ENUM ('active', 'inactive', 'revoked');

-- 2. Agents table
CREATE TABLE public.agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  description text,
  agent_type text NOT NULL DEFAULT 'mcp',
  api_key_hash text,
  api_key_prefix text,
  status public.agent_status NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(project_id, name)
);

COMMENT ON TABLE public.agents IS 'AI 에이전트 (OpenClaw, 오케스트레이터, MCP 등)';

-- Indexes
CREATE INDEX idx_agents_project ON public.agents(project_id);

-- updated_at trigger
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Add agent_id FK columns to existing tables

-- 3-1. comments: agent_id
ALTER TABLE public.comments
  ADD COLUMN agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_author_or_agent
    CHECK (NOT (author_id IS NOT NULL AND agent_id IS NOT NULL));

CREATE INDEX idx_comments_agent ON public.comments(agent_id) WHERE agent_id IS NOT NULL;

-- 3-2. work_item_audit_logs: agent_id
ALTER TABLE public.work_item_audit_logs
  ADD COLUMN agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

CREATE INDEX idx_work_item_audit_logs_agent ON public.work_item_audit_logs(agent_id) WHERE agent_id IS NOT NULL;

-- 3-3. notifications: agent_actor_id
ALTER TABLE public.notifications
  ADD COLUMN agent_actor_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_actor_or_agent
    CHECK (NOT (actor_id IS NOT NULL AND agent_actor_id IS NOT NULL));

CREATE INDEX idx_notifications_agent_actor ON public.notifications(agent_actor_id) WHERE agent_actor_id IS NOT NULL;

-- 3-4. work_items: agent_reporter_id, agent_assignee_id
ALTER TABLE public.work_items
  ADD COLUMN agent_reporter_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN agent_assignee_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

ALTER TABLE public.work_items
  ADD CONSTRAINT work_items_reporter_or_agent
    CHECK (NOT (reporter_id IS NOT NULL AND agent_reporter_id IS NOT NULL));

ALTER TABLE public.work_items
  ADD CONSTRAINT work_items_assignee_or_agent
    CHECK (NOT (assignee_id IS NOT NULL AND agent_assignee_id IS NOT NULL));

CREATE INDEX idx_work_items_agent_reporter ON public.work_items(agent_reporter_id) WHERE agent_reporter_id IS NOT NULL;
CREATE INDEX idx_work_items_agent_assignee ON public.work_items(agent_assignee_id) WHERE agent_assignee_id IS NOT NULL;

-- 4. Update audit log trigger to support agent_id
CREATE OR REPLACE FUNCTION public.log_work_item_changes()
RETURNS trigger AS $$
DECLARE
  changed_fields text[];
  changed_by_id uuid;
  agent_actor_id uuid;
BEGIN
  -- Check for agent context first, then fall back to auth user
  agent_actor_id := nullif(current_setting('app.current_agent_id', true), '')::uuid;
  IF agent_actor_id IS NULL THEN
    changed_by_id := coalesce(
      (SELECT auth.uid()),
      (SELECT reporter_id FROM public.work_items WHERE id = NEW.id)
    );
  END IF;

  IF TG_OP = 'UPDATE' THEN
    changed_fields := array(
      SELECT key FROM jsonb_each(to_jsonb(OLD.*))
      WHERE key NOT IN ('created_at', 'updated_at')
        AND (to_jsonb(NEW.*) -> key IS DISTINCT FROM value)
    );

    INSERT INTO public.work_item_audit_logs (
      work_item_id, project_id, operation, old_values, new_values,
      changed_fields, changed_by, agent_id, changed_at
    ) VALUES (
      NEW.id, NEW.project_id, TG_OP, to_jsonb(OLD), to_jsonb(NEW),
      coalesce(changed_fields, '{}'), changed_by_id, agent_actor_id, now()
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.work_item_audit_logs (
      work_item_id, project_id, operation, old_values, new_values,
      changed_fields, changed_by, agent_id, changed_at
    ) VALUES (
      OLD.id, OLD.project_id, TG_OP, to_jsonb(OLD), NULL,
      array['title', 'description', 'status_id', 'assignee_id', 'priority'],
      changed_by_id, agent_actor_id, now()
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.work_item_audit_logs (
      work_item_id, project_id, operation, old_values, new_values,
      changed_fields, changed_by, agent_id, changed_at
    ) VALUES (
      NEW.id, NEW.project_id, TG_OP, NULL, to_jsonb(NEW),
      array['title', 'status_id', 'tracker_id'], changed_by_id, agent_actor_id, now()
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. RLS policies for agents table
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view agents"
  ON public.agents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = agents.project_id AND pm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Project admin/owner can insert agents"
  ON public.agents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = agents.project_id AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'admin')
  ));

CREATE POLICY "Project admin/owner can update agents"
  ON public.agents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = agents.project_id AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'admin')
  ));

CREATE POLICY "Project admin/owner can delete agents"
  ON public.agents FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = agents.project_id AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'admin')
  ));
