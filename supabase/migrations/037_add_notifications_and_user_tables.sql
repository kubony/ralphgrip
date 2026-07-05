-- =============================================================================
-- 037: out-of-band 잔여 스키마 정합화 — notifications / user_events /
--      user_pinned_items 테이블 + profiles Google 토큰 컬럼
-- -----------------------------------------------------------------------------
-- 배경: 과거 Supabase MCP로 직접 적용되어 마이그레이션 파일이 없는 객체들.
-- 0212가 projects/work_items 컬럼을 정합화했고, 이 파일이 나머지를 채운다.
-- 근거: 앱 사용처 —
--   notifications: lib/notifications.ts, notification-actions.ts,
--     hooks/use-realtime-notifications.ts, layout/header.tsx(알림벨), cached-queries.ts
--   user_events: lib/track-event.ts, settings/activity/page.tsx
--   user_pinned_items: my-work/actions.ts(upsert/delete), cached-queries.ts
--   profiles.google_*: auth/callback/route.ts, api/drive/files (Drive 연동 토큰)
-- 주의: supabase.ts에 notifications가 없는 것은 타입 생성 시점이 오래된 탓(stale).
--   030의 agent_actor_id 블록은 테이블 부재 시 건너뛰도록 가드되어 있었으므로,
--   여기서 테이블 생성 직후 해당 컬럼/제약/인덱스도 함께 적용한다.
-- =============================================================================

-- 1. profiles: Google OAuth 토큰 컬럼 (Drive 연동)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_access_token     text,
  ADD COLUMN IF NOT EXISTS google_refresh_token    text,
  ADD COLUMN IF NOT EXISTS google_token_expires_at timestamptz;

-- 2. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type             text NOT NULL,   -- mention | assigned | comment | status_change
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_key      text NOT NULL,
  work_item_id     uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  work_item_number integer NOT NULL,
  title            text NOT NULL,
  body             text,
  actor_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  comment_id       uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  read_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS '인앱 알림 (멘션/할당/댓글/상태변경)';

-- 030의 agent_actor_id 블록 재적용 (030 실행 시점엔 테이블이 없어 건너뛰었음)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS agent_actor_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_actor_or_agent') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_actor_or_agent
        CHECK (NOT (actor_id IS NOT NULL AND agent_actor_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_project
  ON public.notifications (project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_work_item
  ON public.notifications (work_item_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor
  ON public.notifications (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_comment
  ON public.notifications (comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_agent_actor
  ON public.notifications (agent_actor_id) WHERE agent_actor_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select_own') THEN
    CREATE POLICY "notifications_select_own"
      ON public.notifications FOR SELECT TO authenticated
      USING (user_id = (select auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update_own') THEN
    CREATE POLICY "notifications_update_own"
      ON public.notifications FOR UPDATE TO authenticated
      USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

-- Realtime 구독 (use-realtime-notifications)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 3. user_events
CREATE TABLE IF NOT EXISTS public.user_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_events IS '유저 행동 이벤트 추적 (fire-and-forget)';

CREATE INDEX IF NOT EXISTS idx_user_events_user_created
  ON public.user_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_project
  ON public.user_events (project_id) WHERE project_id IS NOT NULL;

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_events' AND policyname='user_events_insert_own') THEN
    CREATE POLICY "user_events_insert_own"
      ON public.user_events FOR INSERT TO authenticated
      WITH CHECK (user_id = (select auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_events' AND policyname='user_events_select_own') THEN
    CREATE POLICY "user_events_select_own"
      ON public.user_events FOR SELECT TO authenticated
      USING (user_id = (select auth.uid()));
  END IF;
END $$;

-- 4. user_pinned_items (복합 PK — my-work upsert의 onConflict 대상)
CREATE TABLE IF NOT EXISTS public.user_pinned_items (
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  pinned_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_item_id)
);

COMMENT ON TABLE public.user_pinned_items IS '유저가 고정한 작업 항목 (My Work 고정)';

CREATE INDEX IF NOT EXISTS idx_user_pinned_items_work_item
  ON public.user_pinned_items (work_item_id);

ALTER TABLE public.user_pinned_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_pinned_items' AND policyname='user_pinned_items_all_own') THEN
    CREATE POLICY "user_pinned_items_all_own"
      ON public.user_pinned_items FOR ALL TO authenticated
      USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;
