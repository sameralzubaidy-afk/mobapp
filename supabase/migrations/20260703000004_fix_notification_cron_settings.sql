-- File: supabase/migrations/20260703000004_fix_notification_cron_settings.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: Fix trade-notifications and payout-trigger cron jobs to use
--          current_setting(..., true) so missing settings don't crash.
--
-- Root cause: current_setting('app.edge_function_base_url') without the
--             second argument (true) throws "unrecognized configuration parameter"
--             if the setting hasn't been configured. All other functions use
--             current_setting('app.edge_function_base_url', true) which returns
--             NULL gracefully.

-- Fix 1: Reschedule trade-notifications with safe current_setting calls
DO $$
DECLARE
  v_base_url text;
  v_service_role_key text;
BEGIN
  -- Look up settings safely (returns NULL if not set)
  v_base_url := NULLIF(current_setting('app.edge_function_base_url', true), '');
  v_service_role_key := NULLIF(current_setting('app.service_role_key', true), '');

  -- Fall back to app.supabase_url for the base URL if edge_function_base_url isn't set
  IF v_base_url IS NULL THEN
    v_base_url := NULLIF(current_setting('app.supabase_url', true), '');
    IF v_base_url IS NOT NULL THEN
      v_base_url := v_base_url || '/functions/v1';
    END IF;
  END IF;

  -- Only reschedule if we have the required settings
  IF v_base_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    -- Unschedule old version
    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'trade-notifications';

    -- Reschedule with safe current_setting calls
    PERFORM cron.schedule(
      'trade-notifications',
      '*/5 * * * *',
      format(
        $f$SELECT net.http_post(
          url     := COALESCE(
            NULLIF(current_setting('app.edge_function_base_url', true), ''),
            NULLIF(current_setting('app.supabase_url', true), '') || '/functions/v1'
          ) || '/check-trade-notifications',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || NULLIF(current_setting('app.service_role_key', true), '')
          ),
          body    := '{}'::jsonb
        );$f$
      )
    );

    RAISE NOTICE 'Rescheduled trade-notifications cron job with safe settings lookup';
  ELSE
    RAISE WARNING 'Cannot reschedule trade-notifications: app.edge_function_base_url and app.service_role_key are not set. Set them via: ALTER DATABASE postgres SET app.edge_function_base_url TO ''https://your-project.supabase.co/functions/v1''; ALTER DATABASE postgres SET app.service_role_key TO ''your-service-role-key'';';
  END IF;
END;
$$;

-- Fix 2: Reschedule payout-trigger with safe current_setting calls (if it exists)
DO $$
DECLARE
  v_base_url text;
  v_service_role_key text;
  v_job_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'payout-trigger') INTO v_job_exists;

  IF v_job_exists THEN
    v_base_url := NULLIF(current_setting('app.edge_function_base_url', true), '');
    v_service_role_key := NULLIF(current_setting('app.service_role_key', true), '');

    IF v_base_url IS NULL THEN
      v_base_url := NULLIF(current_setting('app.supabase_url', true), '');
      IF v_base_url IS NOT NULL THEN
        v_base_url := v_base_url || '/functions/v1';
      END IF;
    END IF;

    IF v_base_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
      PERFORM cron.unschedule(c.jobid)
      FROM cron.job c
      WHERE c.jobname = 'payout-trigger';

      PERFORM cron.schedule(
        'payout-trigger',
        '0 * * * *',
        format(
          $f$SELECT net.http_post(
            url     := COALESCE(
              NULLIF(current_setting('app.edge_function_base_url', true), ''),
              NULLIF(current_setting('app.supabase_url', true), '') || '/functions/v1'
            ) || '/initiate-payout',
            headers := jsonb_build_object(
              'Content-Type',  'application/json',
              'Authorization', 'Bearer ' || NULLIF(current_setting('app.service_role_key', true), '')
            ),
            body    := '{}'::jsonb
          );$f$
        )
      );

      RAISE NOTICE 'Rescheduled payout-trigger cron job with safe settings lookup';
    ELSE
      RAISE WARNING 'Cannot reschedule payout-trigger: settings not configured';
    END IF;
  END IF;
END;
$$;

-- Verification queries:
-- Check the current command stored for trade-notifications:
-- SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'trade-notifications';
-- SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'payout-trigger';
