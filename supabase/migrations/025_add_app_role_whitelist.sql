-- 1. app_role enum 생성
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'guest');

-- 2. profiles에 app_role 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN app_role public.app_role NOT NULL DEFAULT 'guest';

-- 3. 기존 @maum.ai 사용자를 'user'로
UPDATE public.profiles SET app_role = 'user' WHERE email LIKE '%@maum.ai';

-- 4. 프로젝트 소유자를 admin으로
UPDATE public.profiles SET app_role = 'admin' WHERE email = 'inkeun.seo@maum.ai';

-- 5. projects에 is_demo 컬럼 추가
ALTER TABLE public.projects ADD COLUMN is_demo boolean NOT NULL DEFAULT false;

-- 6. handle_new_user 트리거 수정 (가입 시 도메인 기반 역할 자동 부여)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE v_role public.app_role;
BEGIN
  IF new.email LIKE '%@maum.ai' THEN
    v_role := 'user';
  ELSE
    v_role := 'guest';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, app_role)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    v_role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS 헬퍼 함수: app_role 조회
CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS text AS $$
  SELECT app_role::text FROM public.profiles WHERE id = (SELECT auth.uid()) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 8. RLS 헬퍼 함수: user 이상 여부
CREATE OR REPLACE FUNCTION public.is_app_user()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND app_role IN ('user', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 9. admin용 역할 변경 RPC
CREATE OR REPLACE FUNCTION public.update_user_app_role(p_user_id uuid, p_new_role text)
RETURNS boolean AS $$
BEGIN
  -- admin만 호출 가능
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND app_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  -- 자기 자신 역할 변경 금지
  IF p_user_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Cannot change own role';
  END IF;

  UPDATE public.profiles
  SET app_role = p_new_role::public.app_role, updated_at = now()
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. app_role 인덱스 (guest 필터링 빈번)
CREATE INDEX idx_profiles_app_role ON public.profiles(app_role);
