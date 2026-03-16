-- 이슈 프로젝트에서 상태 변경 시 실적 일정 자동 업데이트
-- In Progress → actual_start_date 설정 (최초 1회만)
-- Resolved → actual_resolved_date 설정 (최초 1회만)
-- Closed → actual_end_date 설정 (최초 1회만)
-- 비완료 상태로 되돌아감 → actual_resolved_date, actual_end_date 초기화

-- actual_resolved_date 컬럼 추가
ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS actual_resolved_date timestamp without time zone;

CREATE OR REPLACE FUNCTION public.auto_update_actual_dates()
RETURNS trigger AS $$
DECLARE
  v_project_type text;
  v_new_status_name text;
BEGIN
  -- status_id가 변경되지 않았으면 스킵
  IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- 이슈 프로젝트인지 확인
  SELECT p.project_type INTO v_project_type
  FROM projects p
  WHERE p.id = NEW.project_id;

  IF v_project_type IS DISTINCT FROM 'issue' THEN
    RETURN NEW;
  END IF;

  -- 새 상태명 조회
  SELECT s.name INTO v_new_status_name
  FROM statuses s
  WHERE s.id = NEW.status_id;

  -- In Progress 진입 → actual_start_date 설정 (기존 값이 없을 때만)
  IF v_new_status_name = 'In Progress' AND NEW.actual_start_date IS NULL THEN
    NEW.actual_start_date := now();
  END IF;

  -- Resolved 진입 → actual_resolved_date 설정 (기존 값이 없을 때만)
  IF v_new_status_name = 'Resolved' AND NEW.actual_resolved_date IS NULL THEN
    NEW.actual_resolved_date := now();
  END IF;

  -- Closed 진입 → actual_end_date 설정 (기존 값이 없을 때만)
  IF v_new_status_name = 'Closed' AND NEW.actual_end_date IS NULL THEN
    NEW.actual_end_date := now();
  END IF;

  -- 비완료 상태로 되돌아감 → actual_resolved_date, actual_end_date 초기화
  IF v_new_status_name NOT IN ('Resolved', 'Closed') THEN
    IF NEW.actual_resolved_date IS NOT NULL THEN
      NEW.actual_resolved_date := NULL;
    END IF;
    IF NEW.actual_end_date IS NOT NULL THEN
      NEW.actual_end_date := NULL;
    END IF;
  END IF;

  -- Resolved로 되돌아감 (Closed → Resolved) → actual_end_date만 초기화
  IF v_new_status_name = 'Resolved' AND NEW.actual_end_date IS NOT NULL THEN
    NEW.actual_end_date := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.auto_update_actual_dates() SET search_path = public;

-- BEFORE UPDATE 트리거 생성
DROP TRIGGER IF EXISTS trg_auto_update_actual_dates ON public.work_items;
CREATE TRIGGER trg_auto_update_actual_dates
  BEFORE UPDATE ON public.work_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_actual_dates();
