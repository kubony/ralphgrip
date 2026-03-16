-- Issue 프로젝트 기본 상태 워크플로우 업데이트
-- issue 타입 프로젝트는 Open → Todo → In Progress → Issue → Resolved → Closed
-- requirement 등 다른 타입 프로젝트는 기존 기본 상태 유지

CREATE OR REPLACE FUNCTION public.create_default_trackers_and_statuses()
RETURNS trigger AS $$
BEGIN
  -- Default trackers (Folder first as it's used for sections)
  INSERT INTO public.trackers (project_id, name, color, position) VALUES
    (new.id, 'Folder', '#f59e0b', 0),
    (new.id, 'Feature', '#22c55e', 1),
    (new.id, 'Bug', '#ef4444', 2),
    (new.id, 'Task', '#3b82f6', 3),
    (new.id, 'Issue', '#ec4899', 4),
    (new.id, 'Improvement', '#8b5cf6', 5),
    (new.id, 'Documentation', '#6b7280', 6);

  IF COALESCE(new.project_type, 'issue') = 'issue' THEN
    INSERT INTO public.statuses (project_id, name, color, position, is_closed) VALUES
      (new.id, 'Open', '#94a3b8', 0, false),
      (new.id, 'Todo', '#64748b', 1, false),
      (new.id, 'In Progress', '#3b82f6', 2, false),
      (new.id, 'Issue', '#f59e0b', 3, false),
      (new.id, 'Resolved', '#22c55e', 4, false),
      (new.id, 'Closed', '#475569', 5, true);
  ELSE
    INSERT INTO public.statuses (project_id, name, color, position, is_closed) VALUES
      (new.id, 'To Do', '#94a3b8', 0, false),
      (new.id, 'In Progress', '#3b82f6', 1, false),
      (new.id, 'Done', '#22c55e', 2, true);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.create_default_trackers_and_statuses() SET search_path = public;

-- 연결된 이슈 worst status 계산 시 새 issue 워크플로우 상태 반영
CREATE OR REPLACE FUNCTION get_linked_issue_worst_status(p_project_id uuid)
RETURNS TABLE (
  work_item_id uuid,
  worst_status_name text,
  worst_status_color text
)
LANGUAGE sql
STABLE
AS $$
  WITH severity_order(name, rank) AS (
    VALUES
      ('Urgent', 1),
      ('Issue', 2),
      ('Open', 3),
      ('Todo', 4),
      ('In Progress', 5),
      ('Draft', 6),
      ('New', 7),
      ('On Hold', 8),
      ('Resolved', 9),
      ('Verified', 10),
      ('Confirmed', 11),
      ('Closed', 12)
  ),
  linked_items AS (
    SELECT
      wl.source_id AS my_item_id,
      wi.id AS linked_id,
      s.name AS status_name,
      s.color AS status_color,
      COALESCE(so.rank, 50) AS severity_rank
    FROM work_item_links wl
    JOIN work_items wi ON wi.id = wl.target_id
    JOIN trackers t ON t.id = wi.tracker_id
    JOIN statuses s ON s.id = wi.status_id
    LEFT JOIN severity_order so ON so.name = s.name
    WHERE wi.deleted_at IS NULL
      AND t.name <> 'Folder'
      AND EXISTS (
        SELECT 1 FROM work_items my
        WHERE my.id = wl.source_id
          AND my.project_id = p_project_id
          AND my.deleted_at IS NULL
      )

    UNION ALL

    SELECT
      wl.target_id AS my_item_id,
      wi.id AS linked_id,
      s.name AS status_name,
      s.color AS status_color,
      COALESCE(so.rank, 50) AS severity_rank
    FROM work_item_links wl
    JOIN work_items wi ON wi.id = wl.source_id
    JOIN trackers t ON t.id = wi.tracker_id
    JOIN statuses s ON s.id = wi.status_id
    LEFT JOIN severity_order so ON so.name = s.name
    WHERE wi.deleted_at IS NULL
      AND t.name <> 'Folder'
      AND EXISTS (
        SELECT 1 FROM work_items my
        WHERE my.id = wl.target_id
          AND my.project_id = p_project_id
          AND my.deleted_at IS NULL
      )
  )
  SELECT DISTINCT ON (li.my_item_id)
    li.my_item_id AS work_item_id,
    li.status_name AS worst_status_name,
    li.status_color AS worst_status_color
  FROM linked_items li
  ORDER BY li.my_item_id, li.severity_rank ASC, li.status_name;
$$;
