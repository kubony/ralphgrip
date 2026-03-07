-- Create audit log table for tracking changes to work items
create table if not exists public.work_item_audit_logs (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_fields text[] not null default '{}',
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

-- Create indexes for efficient querying
create index if not exists idx_work_item_audit_logs_work_item_id
  on public.work_item_audit_logs(work_item_id);
create index if not exists idx_work_item_audit_logs_project_id
  on public.work_item_audit_logs(project_id);
create index if not exists idx_work_item_audit_logs_changed_at
  on public.work_item_audit_logs(changed_at desc);

-- Create trigger function for tracking work item changes
create or replace function public.log_work_item_changes()
returns trigger as $$
declare
  changed_fields text[];
  changed_by_id uuid;
begin
  changed_by_id := coalesce(
    (select auth.uid()),
    (select reporter_id from public.work_items where id = new.id)
  );

  -- Determine which fields changed
  if tg_op = 'UPDATE' then
    changed_fields := array(
      select key from jsonb_each(to_jsonb(old.*))
      where key not in ('created_at', 'updated_at')
        and (to_jsonb(new.*) -> key is distinct from value)
    );

    insert into public.work_item_audit_logs (
      work_item_id, project_id, operation, old_values, new_values,
      changed_fields, changed_by, changed_at
    ) values (
      new.id, new.project_id, tg_op, to_jsonb(old), to_jsonb(new),
      coalesce(changed_fields, '{}'), changed_by_id, now()
    );
  elsif tg_op = 'DELETE' then
    insert into public.work_item_audit_logs (
      work_item_id, project_id, operation, old_values, new_values,
      changed_fields, changed_by, changed_at
    ) values (
      old.id, old.project_id, tg_op, to_jsonb(old), null,
      array['title', 'description', 'status_id', 'assignee_id', 'priority'],
      changed_by_id, now()
    );
  elsif tg_op = 'INSERT' then
    insert into public.work_item_audit_logs (
      work_item_id, project_id, operation, old_values, new_values,
      changed_fields, changed_by, changed_at
    ) values (
      new.id, new.project_id, tg_op, null, to_jsonb(new),
      array['title', 'status_id', 'tracker_id'], changed_by_id, now()
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql;

-- Create trigger on work_items table
drop trigger if exists work_item_audit_log_trigger on public.work_items;
create trigger work_item_audit_log_trigger
  after insert or update or delete on public.work_items
  for each row
  execute function public.log_work_item_changes();

-- Also track changes to projects
create table if not exists public.project_audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_fields text[] not null default '{}',
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

-- Create indexes for project audit logs
create index if not exists idx_project_audit_logs_project_id
  on public.project_audit_logs(project_id);
create index if not exists idx_project_audit_logs_changed_at
  on public.project_audit_logs(changed_at desc);

-- Create trigger function for tracking project changes
create or replace function public.log_project_changes()
returns trigger as $$
declare
  changed_fields text[];
  changed_by_id uuid;
begin
  changed_by_id := coalesce(
    (select auth.uid()),
    (select owner_id from public.projects where id = new.id)
  );

  if tg_op = 'UPDATE' then
    -- Find changed fields (excluding timestamps)
    changed_fields := array(
      select key from jsonb_each(to_jsonb(old.*))
      where key not in ('created_at', 'updated_at')
        and (to_jsonb(new.*) -> key is distinct from value)
    );

    insert into public.project_audit_logs (
      project_id, operation, old_values, new_values,
      changed_fields, changed_by, changed_at
    ) values (
      new.id, tg_op, to_jsonb(old), to_jsonb(new),
      coalesce(changed_fields, '{}'), changed_by_id, now()
    );
  elsif tg_op = 'DELETE' then
    insert into public.project_audit_logs (
      project_id, operation, old_values, new_values,
      changed_fields, changed_by, changed_at
    ) values (
      old.id, tg_op, to_jsonb(old), null,
      array['name', 'description', 'settings'], changed_by_id, now()
    );
  elsif tg_op = 'INSERT' then
    insert into public.project_audit_logs (
      project_id, operation, old_values, new_values,
      changed_fields, changed_by, changed_at
    ) values (
      new.id, tg_op, null, to_jsonb(new),
      array['name', 'key', 'project_type'], changed_by_id, now()
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql;

-- Create trigger on projects table
drop trigger if exists project_audit_log_trigger on public.projects;
create trigger project_audit_log_trigger
  after insert or update or delete on public.projects
  for each row
  execute function public.log_project_changes();
