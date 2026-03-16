-- Upgrade work item schedule fields from date-only to second-level datetime precision

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
