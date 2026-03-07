-- Fix security issues in RPC functions
-- 1. Add auth + membership checks to all security definer functions
-- 2. Create batch_soft_delete_work_items RPC

-- ============================================
-- 1. Fix soft_delete_work_item: add membership check
-- ============================================
create or replace function public.soft_delete_work_item(p_work_item_id uuid)
returns boolean as $$
declare
  v_project_id uuid;
begin
  -- Get the project_id for membership check
  select project_id into v_project_id
  from public.work_items
  where id = p_work_item_id and deleted_at is null;

  if v_project_id is null then
    raise exception 'Work item not found';
  end if;

  -- Check caller is a project member with write access
  if public.get_project_role(v_project_id) is null then
    raise exception 'Not a member of this project';
  end if;

  update public.work_items
  set deleted_at = now(), updated_at = now()
  where id = p_work_item_id and deleted_at is null;

  return found;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. Fix restore_work_item: add membership check
-- ============================================
create or replace function public.restore_work_item(p_work_item_id uuid)
returns boolean as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id
  from public.work_items
  where id = p_work_item_id and deleted_at is not null;

  if v_project_id is null then
    raise exception 'Deleted work item not found';
  end if;

  if public.get_project_role(v_project_id) is null then
    raise exception 'Not a member of this project';
  end if;

  update public.work_items
  set deleted_at = null, updated_at = now()
  where id = p_work_item_id and deleted_at is not null;

  return found;
end;
$$ language plpgsql security definer;

-- ============================================
-- 3. Fix permanently_delete_work_item: require admin role
-- ============================================
create or replace function public.permanently_delete_work_item(p_work_item_id uuid)
returns boolean as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id
  from public.work_items
  where id = p_work_item_id;

  if v_project_id is null then
    raise exception 'Work item not found';
  end if;

  if not public.is_project_admin(v_project_id) then
    raise exception 'Admin role required';
  end if;

  delete from public.work_items
  where id = p_work_item_id;

  return found;
end;
$$ language plpgsql security definer;

-- ============================================
-- 4. Fix soft_delete_project: require owner role
-- ============================================
create or replace function public.soft_delete_project(p_project_id uuid)
returns boolean as $$
begin
  -- Only project owner can soft-delete a project
  if not exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = (select auth.uid()) and deleted_at is null
  ) then
    raise exception 'Only the project owner can delete this project';
  end if;

  update public.projects
  set deleted_at = now(), updated_at = now()
  where id = p_project_id and deleted_at is null;

  return found;
end;
$$ language plpgsql security definer;

-- ============================================
-- 5. Fix restore_project: require owner role
-- ============================================
create or replace function public.restore_project(p_project_id uuid)
returns boolean as $$
begin
  if not exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = (select auth.uid()) and deleted_at is not null
  ) then
    raise exception 'Only the project owner can restore this project';
  end if;

  update public.projects
  set deleted_at = null, updated_at = now()
  where id = p_project_id and deleted_at is not null;

  return found;
end;
$$ language plpgsql security definer;

-- ============================================
-- 6. Fix move_work_items_batch: add membership check
-- ============================================
create or replace function public.move_work_items_batch(
  p_project_id uuid,
  p_moves public.work_item_move[]
)
returns table (
  id uuid,
  success boolean,
  error_message text
) as $$
declare
  move_record public.work_item_move;
  v_parent_id uuid;
  v_position integer;
begin
  -- Validate project exists AND user is a member
  if not exists (
    select 1 from public.projects where id = p_project_id
  ) then
    raise exception 'Project not found';
  end if;

  if not public.is_project_member(p_project_id) then
    raise exception 'Not a member of this project';
  end if;

  -- Process each move operation
  foreach move_record in array p_moves
  loop
    v_parent_id := move_record.parent_id;
    v_position := move_record.position;

    -- Validate work item exists and belongs to the project
    if not exists (
      select 1 from public.work_items
      where id = move_record.id and project_id = p_project_id
    ) then
      return query select
        move_record.id,
        false,
        'Work item not found in this project'::text;
      continue;
    end if;

    -- Validate parent_id if provided (must be in same project)
    if v_parent_id is not null then
      if not exists (
        select 1 from public.work_items
        where id = v_parent_id and project_id = p_project_id
      ) then
        return query select
          move_record.id,
          false,
          'Parent work item not found in this project'::text;
        continue;
      end if;

      -- Prevent circular references
      if exists (
        with recursive ancestors as (
          select wi.id, wi.parent_id from public.work_items wi
          where wi.id = move_record.id
          union all
          select w.id, w.parent_id
          from public.work_items w
          join ancestors a on w.id = a.parent_id
        )
        select 1 from ancestors where ancestors.id = v_parent_id
      ) then
        return query select
          move_record.id,
          false,
          'Cannot move item to its own descendant'::text;
        continue;
      end if;
    end if;

    -- Perform the update
    update public.work_items
    set
      parent_id = v_parent_id,
      position = coalesce(v_position, position),
      updated_at = now()
    where id = move_record.id;

    return query select
      move_record.id,
      true,
      null::text;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================
-- 7. Fix reorder_work_items: add membership check
-- ============================================
create or replace function public.reorder_work_items(
  p_project_id uuid,
  p_parent_id uuid,
  p_item_ids uuid[]
)
returns table (
  id uuid,
  success boolean,
  new_position integer
) as $$
declare
  v_position integer := 0;
  item_id uuid;
begin
  -- Validate project exists AND user is a member
  if not exists (
    select 1 from public.projects where id = p_project_id
  ) then
    raise exception 'Project not found';
  end if;

  if not public.is_project_member(p_project_id) then
    raise exception 'Not a member of this project';
  end if;

  -- Validate parent_id if provided
  if p_parent_id is not null then
    if not exists (
      select 1 from public.work_items
      where id = p_parent_id and project_id = p_project_id
    ) then
      raise exception 'Parent work item not found';
    end if;
  end if;

  -- Process each item in order
  foreach item_id in array p_item_ids
  loop
    -- Verify item exists in project and has correct parent
    if not exists (
      select 1 from public.work_items
      where id = item_id
        and project_id = p_project_id
        and (parent_id is not distinct from p_parent_id)
    ) then
      return query select
        item_id,
        false,
        null::integer;
      continue;
    end if;

    -- Update position
    update public.work_items
    set position = v_position, updated_at = now()
    where id = item_id;

    return query select
      item_id,
      true,
      v_position;

    v_position := v_position + 1;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================
-- 8. NEW: batch_soft_delete_work_items RPC
-- ============================================
create or replace function public.batch_soft_delete_work_items(
  p_project_id uuid,
  p_work_item_ids uuid[]
)
returns integer as $$
declare
  v_count integer;
begin
  -- Validate membership
  if not public.is_project_member(p_project_id) then
    raise exception 'Not a member of this project';
  end if;

  -- Soft delete all specified items that belong to this project
  update public.work_items
  set deleted_at = now(), updated_at = now()
  where id = any(p_work_item_ids)
    and project_id = p_project_id
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

comment on function public.batch_soft_delete_work_items(uuid, uuid[])
  is 'Batch soft-delete work items with membership validation. Returns count of deleted items.';
