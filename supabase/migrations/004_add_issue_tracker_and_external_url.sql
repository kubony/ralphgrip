-- Add Issue tracker type and external_url field
-- ============================================

-- Add external_url column to work_items
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS external_url text;

-- Update the create_default_trackers_and_statuses function to include Issue
CREATE OR REPLACE FUNCTION public.create_default_trackers_and_statuses()
RETURNS trigger AS $$
BEGIN
  -- Default trackers (Folder first as it's used for sections)
  INSERT INTO public.trackers (project_id, name, color, position) VALUES
    (new.id, 'Folder', '#f59e0b', 0),      -- 폴더/섹션 (amber)
    (new.id, 'Feature', '#22c55e', 1),
    (new.id, 'Bug', '#ef4444', 2),
    (new.id, 'Task', '#3b82f6', 3),
    (new.id, 'Issue', '#ec4899', 4),       -- 이슈 (pink)
    (new.id, 'Improvement', '#8b5cf6', 5),
    (new.id, 'Documentation', '#6b7280', 6);

  -- Default statuses
  INSERT INTO public.statuses (project_id, name, color, position, is_closed) VALUES
    (new.id, 'To Do', '#94a3b8', 0, false),
    (new.id, 'In Progress', '#3b82f6', 1, false),
    (new.id, 'Done', '#22c55e', 2, true);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add Issue tracker to existing projects that don't have it
INSERT INTO public.trackers (project_id, name, color, position)
SELECT p.id, 'Issue', '#ec4899',
  (SELECT COALESCE(MAX(position), 0) + 1 FROM public.trackers t WHERE t.project_id = p.id)
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.trackers t
  WHERE t.project_id = p.id AND t.name = 'Issue'
);
