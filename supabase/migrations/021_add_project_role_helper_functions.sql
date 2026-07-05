-- Helper functions for project role/membership checks
-- Used by security definer RPC functions (020_fix_security_issues)

-- Returns current user's role in a project (null if not a member)
-- 002에서 enum(project_role) 반환으로 정의된 get_project_role을 text 반환으로 변경한다.
-- CREATE OR REPLACE로는 반환 타입을 바꿀 수 없으므로, 유일한 하드(카탈로그) 의존 정책인
-- work_items_update_member 를 내렸다가 함수 재생성 후 002 원문 그대로 복원한다.
drop policy if exists "work_items_update_member" on public.work_items;
drop function if exists public.get_project_role(uuid);

create function public.get_project_role(p_project_id uuid)
returns text as $$
  select role::text
  from public.project_members
  where project_id = p_project_id
    and user_id = (select auth.uid())
    and deleted_at is null
  limit 1;
$$ language sql security definer stable;

-- 002_rls_policies.sql 228~236행 원문 복원
create policy "work_items_update_member"
  on public.work_items for update
  to authenticated
  using (
    public.get_project_role(project_id) in ('owner', 'admin', 'member')
  )
  with check (
    public.get_project_role(project_id) in ('owner', 'admin', 'member')
  );

-- Returns true if current user is admin or owner of the project
create or replace function public.is_project_admin(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id = (select auth.uid())
      and role in ('admin', 'owner')
      and deleted_at is null
  );
$$ language sql security definer stable;

-- Returns true if current user is any member of the project
create or replace function public.is_project_member(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id = (select auth.uid())
      and deleted_at is null
  );
$$ language sql security definer stable;
