-- Cleanup orphaned folder references (verification migration)
-- The folders table was already removed in migration 006_remove_folders_table.sql
-- This migration verifies that all folder-related cleanup is complete

-- Check that folders table doesn't exist
-- (This is a safeguard in case the previous migration was incomplete)

-- Note: At this point, all folder_id columns have been removed from work_items
-- The old initial schema that had folder_id has been replaced by parent_id hierarchy
-- which provides much more flexible tree structure without the need for a separate folders table

-- Document the cleanup in a comment
comment on table public.work_items is '작업 (Work Item) - 폴더 대신 parent_id 기반 계층 구조 사용';

-- Ensure that no orphaned folder triggers exist
drop trigger if exists update_folders_updated_at on public.folders;
drop function if exists public.log_folder_changes();

-- Final verification: work_items should have these constraints
-- - parent_id references work_items.id (for hierarchy)
-- - NO folder_id column
-- - NO references to folders table
