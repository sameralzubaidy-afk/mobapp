-- Migration: Fix processed_count default and re-schedule auto-complete to every 12 hours
-- Date: 2025-12-26

-- 1) Ensure `processed_count` column exists and has a default of 0 so INSERTs won't fail
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'auto_complete_runs' AND column_name = 'processed_count'
  ) THEN
    BEGIN
      -- Set default 0 for existing column
      ALTER TABLE public.auto_complete_runs ALTER COLUMN processed_count SET DEFAULT 0;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not alter processed_count default: %', SQLERRM;
    END;
  ELSE
    BEGIN
      ALTER TABLE public.auto_complete_runs ADD COLUMN processed_count integer NOT NULL DEFAULT 0;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add processed_count column: %', SQLERRM;
    END;
  END IF;
END$$;

-- 2) Normalize any existing NULLs to 0
UPDATE public.auto_complete_runs SET processed_count = 0 WHERE processed_count IS NULL;

-- 3) Replace any existing cron job that calls the wrapper with a new job scheduled every 12 hours
DO $$
DECLARE
  rec RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'schedule' AND n.nspname = 'cron'
  ) THEN
    -- Unschedule any existing jobs that call the wrapper
    FOR rec IN SELECT jobid FROM cron.job WHERE command ILIKE '%scheduled_auto_complete_trades%' LOOP
      BEGIN
        PERFORM cron.unschedule(rec.jobid);
        RAISE NOTICE 'Unscheduled job %', rec.jobid;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not unschedule job %: %', rec.jobid, SQLERRM;
      END;
    END LOOP;

    -- Create a new cron job that runs every 12 hours at minute 0
    BEGIN
      PERFORM cron.schedule('auto_complete_trades_every_12h', '0 */12 * * *', 'SELECT public.scheduled_auto_complete_trades();');
      RAISE NOTICE 'Scheduled auto_complete_trades_every_12h (every 12 hours)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create cron job: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron not available; skipping job reschedule';
  END IF;
END$$;

-- Verification hints:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='auto_complete_runs';
-- SELECT * FROM public.auto_complete_runs ORDER BY run_at DESC LIMIT 5;
-- SELECT jobid, schedule, command, nodename, active FROM cron.job ORDER BY jobid;
