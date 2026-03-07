-- Add Folder tracker type to default trackers
-- ============================================

-- Update the create_default_trackers_and_statuses function to include Folder
create or replace function public.create_default_trackers_and_statuses()
returns trigger as $$
begin
  -- Default trackers (Folder first as it's used for sections)
  insert into public.trackers (project_id, name, color, position) values
    (new.id, 'Folder', '#f59e0b', 0),      -- 폴더/섹션 (amber)
    (new.id, 'Feature', '#22c55e', 1),
    (new.id, 'Bug', '#ef4444', 2),
    (new.id, 'Task', '#3b82f6', 3),
    (new.id, 'Improvement', '#8b5cf6', 4),
    (new.id, 'Documentation', '#6b7280', 5);

  -- Default statuses
  insert into public.statuses (project_id, name, color, position, is_closed) values
    (new.id, 'To Do', '#94a3b8', 0, false),
    (new.id, 'In Progress', '#3b82f6', 1, false),
    (new.id, 'Done', '#22c55e', 2, true);

  return new;
end;
$$ language plpgsql security definer;

-- Add Folder tracker to existing projects that don't have it
insert into public.trackers (project_id, name, color, position)
select p.id, 'Folder', '#f59e0b', -1
from public.projects p
where not exists (
  select 1 from public.trackers t
  where t.project_id = p.id and t.name = 'Folder'
);

-- Update positions to make Folder first (position 0)
update public.trackers
set position = position + 1
where name != 'Folder';

update public.trackers
set position = 0
where name = 'Folder';
