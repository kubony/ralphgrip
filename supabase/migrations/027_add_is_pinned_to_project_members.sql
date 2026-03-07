-- Add is_pinned column to project_members
-- ============================================

-- Add is_pinned boolean column with default false
alter table public.project_members
  add column is_pinned boolean default false not null;

comment on column public.project_members.is_pinned is '프로젝트를 내 작업 페이지에 고정했는지 여부';
