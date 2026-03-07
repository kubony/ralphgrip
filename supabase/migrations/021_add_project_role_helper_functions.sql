-- Helper functions for project role/membership checks
-- Used by security definer RPC functions (020_fix_security_issues)

-- Returns current user's role in a project (null if not a member)
create or replace function public.get_project_role(p_project_id uuid)
returns text as $$
  select role::text
  from public.project_members
  where project_id = p_project_id
    and user_id = (select auth.uid())
    and deleted_at is null
  limit 1;
$$ language sql security definer stable;

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
