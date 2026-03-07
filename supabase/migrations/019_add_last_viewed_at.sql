-- project_members에 last_viewed_at 컬럼 추가
alter table public.project_members
  add column if not exists last_viewed_at timestamptz;

-- 인덱스: 최근 본 프로젝트 정렬에 사용
create index if not exists idx_project_members_user_last_viewed
  on public.project_members(user_id, last_viewed_at desc nulls last);

-- RPC 함수: 프로젝트 조회 시 last_viewed_at 업데이트
create or replace function public.touch_project_view(p_project_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.project_members
  set last_viewed_at = now()
  where project_id = p_project_id
    and user_id = (select auth.uid());
end;
$$;
