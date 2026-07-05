-- ============================================
-- 021: Work Item Links (Traceability Links)
-- ============================================
-- depends_on 링크로 작업 항목 간 의존성 추적
-- 요구사항↔요구사항, 요구사항↔이슈 조합만 허용
-- 크로스 프로젝트 지원, suspect flag 자동 설정

-- ============================================
-- 1. 테이블 + 인덱스
-- ============================================

create table public.work_item_links (
  id uuid default gen_random_uuid() primary key,
  source_id uuid not null references public.work_items(id) on delete cascade,
  target_id uuid not null references public.work_items(id) on delete cascade,
  link_type text not null default 'depends_on' check (link_type = 'depends_on'),
  suspect boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint uq_work_item_links unique (source_id, target_id),
  constraint chk_no_self_link check (source_id != target_id)
);

create index idx_work_item_links_source on public.work_item_links(source_id);
create index idx_work_item_links_target on public.work_item_links(target_id);
create index idx_work_item_links_suspect on public.work_item_links(suspect) where suspect = true;

-- ============================================
-- 2. 이슈-이슈 / Folder 링크 차단 트리거
-- ============================================

create or replace function public.validate_work_item_link()
returns trigger as $$
declare
  v_source_tracker_name text;
  v_target_tracker_name text;
begin
  select t.name into v_source_tracker_name
  from public.work_items wi
  join public.trackers t on t.id = wi.tracker_id
  where wi.id = new.source_id;

  select t.name into v_target_tracker_name
  from public.work_items wi
  join public.trackers t on t.id = wi.tracker_id
  where wi.id = new.target_id;

  if v_source_tracker_name = 'Folder' or v_target_tracker_name = 'Folder' then
    raise exception 'Folder 타입에는 링크를 생성할 수 없습니다.';
  end if;

  if v_source_tracker_name = 'Issue' and v_target_tracker_name = 'Issue' then
    raise exception 'Issue 간에는 링크를 생성할 수 없습니다.';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_work_item_link_trigger
  before insert or update on public.work_item_links
  for each row
  execute function public.validate_work_item_link();

-- ============================================
-- 3. RLS 정책
-- ============================================

alter table public.work_item_links enable row level security;

-- SELECT: source or target project member
create policy "work_item_links_select"
  on public.work_item_links for select
  to authenticated
  using (
    exists (
      select 1 from public.work_items wi
      join public.project_members pm on pm.project_id = wi.project_id and pm.user_id = (select auth.uid())
      where wi.id = source_id
    )
    or exists (
      select 1 from public.work_items wi
      join public.project_members pm on pm.project_id = wi.project_id and pm.user_id = (select auth.uid())
      where wi.id = target_id
    )
  );

-- INSERT: source project member (not viewer) + target project member
create policy "work_item_links_insert"
  on public.work_item_links for insert
  to authenticated
  with check (
    exists (
      select 1 from public.work_items wi
      join public.project_members pm on pm.project_id = wi.project_id and pm.user_id = (select auth.uid())
      where wi.id = source_id and pm.role in ('owner', 'admin', 'member')
    )
    and exists (
      select 1 from public.work_items wi
      join public.project_members pm on pm.project_id = wi.project_id and pm.user_id = (select auth.uid())
      where wi.id = target_id
    )
    and created_by = (select auth.uid())
  );

-- UPDATE: source project member (not viewer) - for suspect clearing
create policy "work_item_links_update"
  on public.work_item_links for update
  to authenticated
  using (
    exists (
      select 1 from public.work_items wi
      join public.project_members pm on pm.project_id = wi.project_id and pm.user_id = (select auth.uid())
      where wi.id = source_id and pm.role in ('owner', 'admin', 'member')
    )
  );

-- DELETE: source project member (not viewer)
create policy "work_item_links_delete"
  on public.work_item_links for delete
  to authenticated
  using (
    exists (
      select 1 from public.work_items wi
      join public.project_members pm on pm.project_id = wi.project_id and pm.user_id = (select auth.uid())
      where wi.id = source_id and pm.role in ('owner', 'admin', 'member')
    )
  );

-- ============================================
-- 4. Suspect 트리거
-- ============================================

create or replace function public.set_suspect_on_work_item_change()
returns trigger as $$
begin
  if old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.status_id is distinct from new.status_id
  then
    update public.work_item_links
    set suspect = true
    where target_id = new.id
      and suspect = false;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger set_suspect_on_work_item_change_trigger
  after update on public.work_items
  for each row
  execute function public.set_suspect_on_work_item_change();

-- ============================================
-- 5. 감사 로그 트리거
-- ============================================

create or replace function public.log_work_item_link_change()
returns trigger as $$
declare
  v_work_item_id uuid;
  v_project_id uuid;
  v_operation text;
begin
  if tg_op = 'DELETE' then
    v_work_item_id := old.source_id;
    v_operation := 'LINK_DELETED';
  elsif tg_op = 'INSERT' then
    v_work_item_id := new.source_id;
    v_operation := 'LINK_CREATED';
  else
    v_work_item_id := new.source_id;
    v_operation := 'LINK_UPDATED';
  end if;

  -- work_item에서 project_id 조회
  select project_id into v_project_id
  from public.work_items
  where id = v_work_item_id;

  insert into public.work_item_audit_logs (
    work_item_id,
    project_id,
    operation,
    old_values,
    new_values,
    changed_fields,
    changed_by
  ) values (
    v_work_item_id,
    v_project_id,
    v_operation,
    case when tg_op in ('DELETE', 'UPDATE') then jsonb_build_object(
      'link_id', old.id,
      'target_id', old.target_id,
      'suspect', old.suspect
    ) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then jsonb_build_object(
      'link_id', new.id,
      'target_id', new.target_id,
      'suspect', new.suspect
    ) else null end,
    array['work_item_links'],
    coalesce(
      case when tg_op = 'DELETE' then old.created_by else new.created_by end,
      auth.uid()
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger log_work_item_link_change_trigger
  after insert or update or delete on public.work_item_links
  for each row
  execute function public.log_work_item_link_change();

-- ============================================
-- 6. 링크 카운트 RPC 함수
-- ============================================

create or replace function public.get_work_item_link_counts(p_project_id uuid)
returns table(work_item_id uuid, link_count bigint, has_suspect boolean)
language plpgsql security definer stable as $$
begin
  return query
  select
    wi.id as work_item_id,
    count(wil.id) as link_count,
    bool_or(wil.suspect) as has_suspect
  from public.work_items wi
  left join (
    select id, source_id as item_id, suspect from public.work_item_links
    union all
    select id, target_id as item_id, suspect from public.work_item_links
  ) wil on wil.item_id = wi.id
  where wi.project_id = p_project_id
    and wi.deleted_at is null
  group by wi.id
  having count(wil.id) > 0;
end;
$$;

-- ============================================
-- 7. Realtime 활성화
-- ============================================

alter publication supabase_realtime add table work_item_links;
