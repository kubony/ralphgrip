-- Create RPC function for batch move work items operation
-- This improves performance for bulk reordering in the tree view

-- Define the input type for batch move operations
create type public.work_item_move as (
  id uuid,
  parent_id uuid,
  position integer
);

-- Create RPC function for batch moving work items
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
  v_count integer;
  v_parent_id uuid;
  v_position integer;
begin
  -- Validate project exists and user has access
  if not exists (
    select 1 from public.projects
    where id = p_project_id
  ) then
    raise exception 'Project not found';
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
          select id, parent_id from public.work_items
          where id = move_record.id
          union all
          select w.id, w.parent_id
          from public.work_items w
          join ancestors a on w.id = a.parent_id
        )
        select 1 from ancestors where id = v_parent_id
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

comment on function public.move_work_items_batch(uuid, public.work_item_move[])
  is 'Batch move/reorder work items with validation. Returns success/error for each item.';

-- Create RPC function for reordering items at the same level
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
  -- Validate project exists
  if not exists (
    select 1 from public.projects where id = p_project_id
  ) then
    raise exception 'Project not found';
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

comment on function public.reorder_work_items(uuid, uuid, uuid[])
  is 'Reorder work items at the same parent level. Returns new position for each item.';
