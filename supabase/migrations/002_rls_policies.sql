-- Worvk RLS Policies
-- ============================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.trackers enable row level security;
alter table public.statuses enable row level security;
alter table public.folders enable row level security;
alter table public.work_items enable row level security;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is a member of the project
create or replace function public.is_project_member(p_project_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.project_members
    where project_id = p_project_id
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer stable;

-- Get user's role in the project
create or replace function public.get_project_role(p_project_id uuid)
returns public.project_role as $$
begin
  return (
    select role from public.project_members
    where project_id = p_project_id
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer stable;

-- Check if user has admin+ role
create or replace function public.is_project_admin(p_project_id uuid)
returns boolean as $$
begin
  return public.get_project_role(p_project_id) in ('owner', 'admin');
end;
$$ language plpgsql security definer stable;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read all profiles (for displaying names, avatars)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update only their own profile
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================
-- PROJECTS POLICIES
-- ============================================

-- Users can see projects they're members of
create policy "projects_select_member"
  on public.projects for select
  to authenticated
  using (public.is_project_member(id));

-- Any authenticated user can create projects
create policy "projects_insert_authenticated"
  on public.projects for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Only owner/admin can update projects
create policy "projects_update_admin"
  on public.projects for update
  to authenticated
  using (public.is_project_admin(id))
  with check (public.is_project_admin(id));

-- Only owner can delete projects
create policy "projects_delete_owner"
  on public.projects for delete
  to authenticated
  using (owner_id = auth.uid());

-- ============================================
-- PROJECT MEMBERS POLICIES
-- ============================================

-- Members can view other members in their projects
create policy "project_members_select_member"
  on public.project_members for select
  to authenticated
  using (public.is_project_member(project_id));

-- Owner/admin can add members
create policy "project_members_insert_admin"
  on public.project_members for insert
  to authenticated
  with check (public.is_project_admin(project_id));

-- Owner/admin can update member roles
create policy "project_members_update_admin"
  on public.project_members for update
  to authenticated
  using (public.is_project_admin(project_id))
  with check (public.is_project_admin(project_id));

-- Owner/admin can remove members (but owner can't remove themselves)
create policy "project_members_delete_admin"
  on public.project_members for delete
  to authenticated
  using (
    public.is_project_admin(project_id)
    and not (role = 'owner' and user_id = auth.uid())
  );

-- ============================================
-- TRACKERS POLICIES
-- ============================================

-- Members can view trackers
create policy "trackers_select_member"
  on public.trackers for select
  to authenticated
  using (public.is_project_member(project_id));

-- Owner/admin can manage trackers
create policy "trackers_insert_admin"
  on public.trackers for insert
  to authenticated
  with check (public.is_project_admin(project_id));

create policy "trackers_update_admin"
  on public.trackers for update
  to authenticated
  using (public.is_project_admin(project_id))
  with check (public.is_project_admin(project_id));

create policy "trackers_delete_admin"
  on public.trackers for delete
  to authenticated
  using (public.is_project_admin(project_id));

-- ============================================
-- STATUSES POLICIES
-- ============================================

-- Members can view statuses
create policy "statuses_select_member"
  on public.statuses for select
  to authenticated
  using (public.is_project_member(project_id));

-- Owner/admin can manage statuses
create policy "statuses_insert_admin"
  on public.statuses for insert
  to authenticated
  with check (public.is_project_admin(project_id));

create policy "statuses_update_admin"
  on public.statuses for update
  to authenticated
  using (public.is_project_admin(project_id))
  with check (public.is_project_admin(project_id));

create policy "statuses_delete_admin"
  on public.statuses for delete
  to authenticated
  using (public.is_project_admin(project_id));

-- ============================================
-- FOLDERS POLICIES
-- ============================================

-- Members can view folders
create policy "folders_select_member"
  on public.folders for select
  to authenticated
  using (public.is_project_member(project_id));

-- Owner/admin can manage folders
create policy "folders_insert_admin"
  on public.folders for insert
  to authenticated
  with check (public.is_project_admin(project_id));

create policy "folders_update_admin"
  on public.folders for update
  to authenticated
  using (public.is_project_admin(project_id))
  with check (public.is_project_admin(project_id));

create policy "folders_delete_admin"
  on public.folders for delete
  to authenticated
  using (public.is_project_admin(project_id));

-- ============================================
-- WORK ITEMS POLICIES
-- ============================================

-- Members can view work items
create policy "work_items_select_member"
  on public.work_items for select
  to authenticated
  using (public.is_project_member(project_id));

-- Members can create work items (as reporter)
create policy "work_items_insert_member"
  on public.work_items for insert
  to authenticated
  with check (
    public.is_project_member(project_id)
    and reporter_id = auth.uid()
  );

-- Members can update work items (owner/admin/member, not viewer)
create policy "work_items_update_member"
  on public.work_items for update
  to authenticated
  using (
    public.get_project_role(project_id) in ('owner', 'admin', 'member')
  )
  with check (
    public.get_project_role(project_id) in ('owner', 'admin', 'member')
  );

-- Only owner/admin can delete work items
create policy "work_items_delete_admin"
  on public.work_items for delete
  to authenticated
  using (public.is_project_admin(project_id));
