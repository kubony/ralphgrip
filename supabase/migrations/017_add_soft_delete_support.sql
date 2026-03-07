-- Add soft delete support (logical deletion) to major tables
-- This allows data recovery and maintains audit trail

-- Add deleted_at column to work_items table
alter table if exists public.work_items
  add column if not exists deleted_at timestamp with time zone default null;

-- Add deleted_at column to projects table
alter table if exists public.projects
  add column if not exists deleted_at timestamp with time zone default null;

-- Add deleted_at column to project_members table
alter table if exists public.project_members
  add column if not exists deleted_at timestamp with time zone default null;

-- Add deleted_at column to comments table
alter table if exists public.comments
  add column if not exists deleted_at timestamp with time zone default null;

-- Create index on deleted_at columns for efficient filtering
create index if not exists idx_work_items_deleted_at
  on public.work_items(deleted_at) where deleted_at is not null;

create index if not exists idx_projects_deleted_at
  on public.projects(deleted_at) where deleted_at is not null;

create index if not exists idx_project_members_deleted_at
  on public.project_members(deleted_at) where deleted_at is not null;

create index if not exists idx_comments_deleted_at
  on public.comments(deleted_at) where deleted_at is not null;

-- Create RPC function for soft delete work item
create or replace function public.soft_delete_work_item(p_work_item_id uuid)
returns boolean as $$
begin
  update public.work_items
  set deleted_at = now(), updated_at = now()
  where id = p_work_item_id and deleted_at is null;

  return found;
end;
$$ language plpgsql security definer;

-- Create RPC function for restore work item
create or replace function public.restore_work_item(p_work_item_id uuid)
returns boolean as $$
begin
  update public.work_items
  set deleted_at = null, updated_at = now()
  where id = p_work_item_id and deleted_at is not null;

  return found;
end;
$$ language plpgsql security definer;

-- Create RPC function for permanently delete work item (admin only)
create or replace function public.permanently_delete_work_item(p_work_item_id uuid)
returns boolean as $$
begin
  delete from public.work_items
  where id = p_work_item_id;

  return found;
end;
$$ language plpgsql security definer;

-- Create RPC function for soft delete project
create or replace function public.soft_delete_project(p_project_id uuid)
returns boolean as $$
begin
  update public.projects
  set deleted_at = now(), updated_at = now()
  where id = p_project_id and deleted_at is null;

  return found;
end;
$$ language plpgsql security definer;

-- Create RPC function for restore project
create or replace function public.restore_project(p_project_id uuid)
returns boolean as $$
begin
  update public.projects
  set deleted_at = null, updated_at = now()
  where id = p_project_id and deleted_at is not null;

  return found;
end;
$$ language plpgsql security definer;

-- Create view for active (non-deleted) work items
create or replace view public.active_work_items as
  select * from public.work_items
  where deleted_at is null;

-- Create view for active projects
create or replace view public.active_projects as
  select * from public.projects
  where deleted_at is null;

comment on view public.active_work_items is 'View of non-deleted work items';
comment on view public.active_projects is 'View of non-deleted projects';
