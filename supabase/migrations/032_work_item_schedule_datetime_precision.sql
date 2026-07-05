-- Upgrade work item schedule fields from date-only to second-level datetime precision

-- [정합화] active_work_items 뷰(SELECT *)가 아래에서 타입 변경할 컬럼들에 의존하므로
-- ALTER COLUMN TYPE 전에 뷰를 내린다. 이 마이그레이션 하단에서 동일 뷰를 재생성한다.
DROP VIEW IF EXISTS public.active_work_items;

ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS start_date timestamp,
  ADD COLUMN IF NOT EXISTS actual_start_date timestamp,
  ADD COLUMN IF NOT EXISTS actual_end_date timestamp;

DO $$
DECLARE
  target_column text;
BEGIN
  FOREACH target_column IN ARRAY ARRAY[
    'start_date',
    'due_date',
    'actual_start_date',
    'actual_end_date'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'work_items'
        AND column_name = target_column
        AND data_type = 'date'
    ) THEN
      IF target_column IN ('due_date', 'actual_end_date') THEN
        EXECUTE format(
          'ALTER TABLE public.work_items ALTER COLUMN %I TYPE timestamp USING CASE WHEN %I IS NULL THEN NULL ELSE %I::timestamp + interval ''23 hours 59 minutes 59 seconds'' END',
          target_column,
          target_column,
          target_column
        );
      ELSE
        EXECUTE format(
          'ALTER TABLE public.work_items ALTER COLUMN %I TYPE timestamp USING %I::timestamp',
          target_column,
          target_column
        );
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.active_work_items
  WITH (security_invoker = true) AS
  SELECT *
  FROM public.work_items
  WHERE deleted_at IS NULL;
