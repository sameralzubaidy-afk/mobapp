-- File: supabase/migrations/20260704000001_fix_trade_notifications_cron_bake_url.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: Fix trade-notifications cron job to bake URL+key at schedule time
--          instead of evaluating current_setting() at runtime.
--
-- Root cause: The cron command called current_setting('app.edge_function_base_url', true)
--             and current_setting('app.supabase_url', true) at runtime every 5 minutes.
--             If these database custom parameters are not set, both return NULL,
--             producing a NULL URL → net.http_post crashes with:
--             "null value in column 'url' of relation 'http_request_queue'"
--
-- Fix: Read settings into variables at schedule time (inside DO block), bail early
--      if missing, then use format() with %L to bake the literal URL+key into
--      the cron command string. Same pattern as process-expired-offers and
--      process-auto-complete cron jobs, which do NOT have this bug.

DO $$
DECLARE
  v_base_url text;
  v_service_role_key text;
  v_job_sql text;
BEGIN
  -- Read settings at schedule time (runs once when migration is applied)
  v_base_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    NULLIF(current_setting('custom.edge_function_base_url', true), '')
  );

  -- Fallback: construct from supabase_url
  IF v_base_url IS NULL THEN
    v_base_url := NULLIF(current_setting('app.supabase_url', true), '');
    IF v_base_url IS NOT NULL THEN
      v_base_url := v_base_url || '/functions/v1';
    END IF;
  END IF;

  v_service_role_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), '')
  );

  -- Bail if settings are missing — cron won't be scheduled
  IF v_base_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'Skipping trade-notifications cron schedule: missing base URL or service role key setting. Set via: ALTER DATABASE postgres SET app.edge_function_base_url TO ''https://your-project.supabase.co/functions/v1''; ALTER DATABASE postgres SET app.service_role_key TO ''your-service-role-key'';';
    RETURN;
  END IF;

  -- Unschedule any existing version
  PERFORM cron.unschedule(c.jobid)
  FROM cron.job c
  WHERE c.jobname = 'trade-notifications';

  -- Schedule with URL and key BAKED IN at schedule time (runtime evaluation uses
  -- the literal string, NOT current_setting() — prevents NULL URL crash)
  v_job_sql := format(
    $f$SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || %L
      ),
      body := '{}'::jsonb
    );$f$,
    v_base_url || '/check-trade-notifications',
    v_service_role_key
  );

  PERFORM cron.schedule(
    'trade-notifications',
    '*/5 * * * *',
    v_job_sql
  );

  RAISE NOTICE 'Scheduled trade-notifications cron job with baked URL: %', v_base_url || '/check-trade-notifications';
END;
$$;

-- Verification queries:
-- Check the current command stored for trade-notifications (should show literal URL, not current_setting() calls):
-- SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'trade-notifications';
--
-- Expected: command should contain the literal URL like 'https://xxxxx.supabase.co/functions/v1/check-trade-notifications'
-- NOT: current_setting('app.edge_function_base_url', true)
