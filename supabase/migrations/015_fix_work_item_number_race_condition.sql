-- Fix race condition in work item number generation using PostgreSQL SEQUENCE

-- Create a sequence table to track project sequences
create table if not exists public.work_item_sequences (
  project_id uuid primary key references public.projects(id) on delete cascade,
  next_number int not null default 1,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

comment on table public.work_item_sequences is '프로젝트별 작업 번호 시퀀스 (Race condition 방지)';

-- Create index
create index if not exists idx_work_item_sequences_project_id
  on public.work_item_sequences(project_id);

-- Create function to initialize sequence for new projects
create or replace function public.init_work_item_sequence()
returns trigger as $$
begin
  -- Insert initial sequence for new project
  insert into public.work_item_sequences (project_id, next_number)
  values (new.id, 1)
  on conflict (project_id) do nothing;

  return new;
end;
$$ language plpgsql;

-- Create trigger to initialize sequence on project creation
drop trigger if exists init_work_item_sequence_trigger on public.projects;
create trigger init_work_item_sequence_trigger
  after insert on public.projects
  for each row
  execute function public.init_work_item_sequence();

-- Update the work item number function to use the sequence table
-- This replaces the buggy max(number) + 1 approach
create or replace function public.set_work_item_number()
returns trigger as $$
declare
  next_num int;
begin
  -- Use FOR UPDATE to lock the row and prevent race conditions
  select next_number into next_num
  from public.work_item_sequences
  where project_id = new.project_id
  for update;

  if next_num is null then
    -- Fallback if sequence row doesn't exist
    select coalesce(max(number), 0) + 1 into next_num
    from public.work_items
    where project_id = new.project_id;

    insert into public.work_item_sequences (project_id, next_number)
    values (new.project_id, next_num + 1)
    on conflict (project_id) do update
    set next_number = next_num + 1;
  else
    -- Update the sequence to the next number
    update public.work_item_sequences
    set next_number = next_number + 1,
        updated_at = now()
    where project_id = new.project_id;
  end if;

  new.number := next_num;
  return new;
end;
$$ language plpgsql;

-- Migrate existing projects to have sequences
-- For each project, find the max work item number and initialize the sequence
insert into public.work_item_sequences (project_id, next_number)
select p.id, coalesce(max(w.number), 0) + 1
from public.projects p
left join public.work_items w on w.project_id = p.id
group by p.id
on conflict (project_id) do update
set next_number = excluded.next_number,
    updated_at = now();
