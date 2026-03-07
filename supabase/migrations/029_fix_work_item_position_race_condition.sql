-- Normalize active positions per sibling group, then enforce uniqueness.
with ranked as (
  select
    id,
    row_number() over (
      partition by project_id, parent_id
      order by position, created_at, id
    ) - 1 as new_position
  from public.work_items
  where deleted_at is null
)
update public.work_items w
set position = ranked.new_position
from ranked
where w.id = ranked.id
  and w.position is distinct from ranked.new_position;

create unique index if not exists work_items_project_parent_position_unique
  on public.work_items(project_id, parent_id, position)
  where deleted_at is null and parent_id is not null;

create unique index if not exists work_items_project_root_position_unique
  on public.work_items(project_id, position)
  where deleted_at is null and parent_id is null;
