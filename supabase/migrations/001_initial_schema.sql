-- Worvk Initial Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.profiles is '사용자 프로필 (Supabase Auth 확장)';

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- PROJECTS
-- ============================================
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  key text not null unique,  -- e.g., "WRV" (3-5 uppercase letters)
  owner_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  constraint projects_key_format check (key ~ '^[A-Z]{2,5}$')
);

comment on table public.projects is '프로젝트';

create index idx_projects_owner on public.projects(owner_id);

-- ============================================
-- PROJECT MEMBERS
-- ============================================
create type public.project_role as enum ('owner', 'admin', 'member', 'viewer');

create table public.project_members (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.project_role default 'member' not null,
  created_at timestamptz default now() not null,

  unique(project_id, user_id)
);

comment on table public.project_members is '프로젝트 멤버';

create index idx_project_members_project on public.project_members(project_id);
create index idx_project_members_user on public.project_members(user_id);

-- Auto-add owner as project member
create or replace function public.add_owner_as_member()
returns trigger as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_project_created_add_owner
  after insert on public.projects
  for each row execute procedure public.add_owner_as_member();

-- ============================================
-- TRACKERS
-- ============================================
create table public.trackers (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,  -- Feature, Bug, Task, Improvement, Documentation
  color text default '#6366f1',
  icon text,
  position int default 0 not null,
  created_at timestamptz default now() not null,

  unique(project_id, name)
);

comment on table public.trackers is '작업 유형 (트래커)';

create index idx_trackers_project on public.trackers(project_id);

-- ============================================
-- STATUSES
-- ============================================
create table public.statuses (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,  -- To Do, In Progress, Done
  color text default '#94a3b8',
  position int default 0 not null,
  is_closed boolean default false,  -- Done = true (완료 상태)
  created_at timestamptz default now() not null,

  unique(project_id, name)
);

comment on table public.statuses is '작업 상태';

create index idx_statuses_project on public.statuses(project_id);

-- ============================================
-- FOLDERS
-- ============================================
create table public.folders (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  position int default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.folders is '폴더 (작업 그룹화)';

create index idx_folders_project on public.folders(project_id);
create index idx_folders_parent on public.folders(parent_id) where parent_id is not null;

-- ============================================
-- WORK ITEMS
-- ============================================
create table public.work_items (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  tracker_id uuid references public.trackers(id) on delete restrict not null,
  status_id uuid references public.statuses(id) on delete restrict not null,
  folder_id uuid references public.folders(id) on delete set null,
  parent_id uuid references public.work_items(id) on delete cascade,

  -- Core fields
  number int not null,  -- Auto-increment per project (e.g., WRV-1, WRV-2)
  title text not null,
  description text,

  -- Assignment
  assignee_id uuid references public.profiles(id) on delete set null,
  reporter_id uuid references public.profiles(id) on delete set null not null,

  -- Metadata
  priority int default 0 not null,  -- 0=none, 1=low, 2=medium, 3=high, 4=critical
  due_date date,
  position int default 0 not null,  -- 칸반 내 순서

  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  unique(project_id, number)
);

comment on table public.work_items is '작업 (Work Item)';

create index idx_work_items_project on public.work_items(project_id);
create index idx_work_items_tracker on public.work_items(tracker_id);
create index idx_work_items_status on public.work_items(status_id);
create index idx_work_items_folder on public.work_items(folder_id) where folder_id is not null;
create index idx_work_items_parent on public.work_items(parent_id) where parent_id is not null;
create index idx_work_items_assignee on public.work_items(assignee_id) where assignee_id is not null;

-- Auto-increment work item number per project
create or replace function public.set_work_item_number()
returns trigger as $$
begin
  new.number := coalesce(
    (select max(number) + 1 from public.work_items where project_id = new.project_id),
    1
  );
  return new;
end;
$$ language plpgsql;

create trigger work_item_number_trigger
  before insert on public.work_items
  for each row execute procedure public.set_work_item_number();

-- ============================================
-- AUTO-CREATE DEFAULT TRACKERS & STATUSES
-- ============================================
create or replace function public.create_default_trackers_and_statuses()
returns trigger as $$
begin
  -- Default trackers
  insert into public.trackers (project_id, name, color, position) values
    (new.id, 'Feature', '#22c55e', 0),
    (new.id, 'Bug', '#ef4444', 1),
    (new.id, 'Task', '#3b82f6', 2),
    (new.id, 'Improvement', '#f59e0b', 3),
    (new.id, 'Documentation', '#8b5cf6', 4);

  -- Default statuses
  insert into public.statuses (project_id, name, color, position, is_closed) values
    (new.id, 'To Do', '#94a3b8', 0, false),
    (new.id, 'In Progress', '#3b82f6', 1, false),
    (new.id, 'Done', '#22c55e', 2, true);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_project_created_defaults
  after insert on public.projects
  for each row execute procedure public.create_default_trackers_and_statuses();

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

create trigger update_projects_updated_at
  before update on public.projects
  for each row execute procedure public.update_updated_at();

create trigger update_folders_updated_at
  before update on public.folders
  for each row execute procedure public.update_updated_at();

create trigger update_work_items_updated_at
  before update on public.work_items
  for each row execute procedure public.update_updated_at();
