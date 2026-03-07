-- RPC: 프로젝트 내 각 항목에 대해 연결된 외부 항목 중 가장 심각한 상태를 반환
-- 요구사항 프로젝트: 연결된 이슈의 worst status
-- 이슈 프로젝트: 연결된 요구사항의 worst status
-- 심각도 순서: Urgent > Open > In Progress > Draft > New > On Hold > Resolved > Verified > Confirmed > Closed
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
      ('Open', 2),
      ('In Progress', 3),
      ('Draft', 4),
      ('New', 5),
      ('On Hold', 6),
      ('Resolved', 7),
      ('Verified', 8),
      ('Confirmed', 9),
      ('Closed', 10)
  ),
  -- 양방향 링크에서 연결된 항목 찾기
  linked_items AS (
    -- source가 이 프로젝트, target이 연결 항목
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

    -- target이 이 프로젝트, source가 연결 항목
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
