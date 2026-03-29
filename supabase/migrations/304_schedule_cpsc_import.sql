-- filepath: supabase/migrations/304_schedule_cpsc_import.sql
-- SAFETY-001: Schedule daily CPSC import via pg_cron
-- This migration sets up automated daily imports at 2:00 AM UTC
-- Mode: idempotent (safe to re-run)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- STEP 1: Create wrapper RPC that invokes the Edge Function
-- SECURITY DEFINER is required because pg_cron runs in DB context and must read DB settings.
CREATE OR REPLACE FUNCTION public.invoke_cpsc_import_cron()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_base_url TEXT;
  v_service_role_key TEXT;
  v_function_url TEXT;
  v_request_id BIGINT;
BEGIN
  v_base_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.service_role_key', true);

  IF COALESCE(v_base_url, '') = '' OR COALESCE(v_service_role_key, '') = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_DB_SETTINGS',
      'message', 'app.supabase_url or app.service_role_key is not set',
      'details', jsonb_build_object(
        'has_supabase_url', COALESCE(v_base_url, '') <> '',
        'has_service_role_key', COALESCE(v_service_role_key, '') <> ''
      )
    )::text;
  END IF;

  IF to_regproc('net.http_post') IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_PG_NET',
      'message', 'pg_net extension is not enabled (net.http_post missing)'
    )::text;
  END IF;

  v_function_url := RTRIM(v_base_url, '/') || '/functions/v1/import-cpsc-recalls';

  SELECT net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'apikey', v_service_role_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'queued',
    'message', 'cpsc import job triggered',
    'request_id', v_request_id,
    'url', v_function_url,
    'run_at', now()
  )::text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'RPC_INVOKE_FAILED',
      'message', SQLERRM,
      'sqlstate', SQLSTATE
    )::text;
END;
$$;

-- STEP 2: Remove existing job if it exists (idempotent)
SELECT cron.unschedule('cpsc-daily-import') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cpsc-daily-import'
);

-- STEP 3: Schedule daily CPSC import at 2:00 AM UTC
SELECT cron.schedule(
  'cpsc-daily-import'::text,      -- job name
  '0 2 * * *'::text,              -- cron expression: 2:00 AM daily
  'SELECT public.invoke_cpsc_import_cron();'::text
);

/*
==================================================
MANUAL CONFIGURATION REQUIRED
==================================================

Before this cron job will work, you MUST set DB settings:
1. app.supabase_url (your project URL)
2. app.service_role_key (your service role key)

IMPORTANT: Do NOT commit service role keys to git.
Get key from: Supabase Dashboard > Settings > API > service_role key

ALTERNATIVE SECURE APPROACH:
Instead of hardcoding tokens in this migration, store them in Supabase Vault
and reference them via vault functions. See Supabase Vault documentation.

==================================================
HOW TO MANUALLY CONFIGURE (run in Supabase SQL Editor)
==================================================

-- IMPORTANT: Run as postgres role in SQL Editor.
-- 1. Set DB settings used by invoke_cpsc_import_cron()
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- 2. Validate settings in your current session
SELECT current_setting('app.supabase_url', true) AS app_supabase_url;
SELECT current_setting('app.service_role_key', true) IS NOT NULL AS has_service_role_key;

-- 3. Test wrapper function immediately
SELECT public.invoke_cpsc_import_cron();

-- 4. Verify the schedule:
SELECT 
  jobid, 
  jobname, 
  schedule, 
  active, 
  database,
  LEFT(command, 100) as command_preview
FROM cron.job 
WHERE jobname = 'cpsc-daily-import';

-- Check execution logs:
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cpsc-daily-import')
ORDER BY start_time DESC 
LIMIT 10;

==================================================
VERIFICATION STEPS AFTER CONFIGURATION
==================================================

1. Wait for next 2:00 AM UTC run, OR manually trigger the Edge Function:
  SELECT public.invoke_cpsc_import_cron();

2. Check import logs:
   SELECT * FROM public.cpsc_import_log ORDER BY import_date DESC LIMIT 5;

3. Verify recalls imported:
   SELECT COUNT(*) FROM public.cpsc_recalls;
   SELECT * FROM public.cpsc_recalls ORDER BY recall_date DESC LIMIT 10;

4. Check cron execution logs:
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cpsc-daily-import')
   ORDER BY start_time DESC LIMIT 5;

==================================================
TROUBLESHOOTING
==================================================

If imports fail:
1. Check Edge Function logs in Supabase Dashboard > Edge Functions > import-cpsc-recalls > Logs
2. Verify CPSC API is accessible: https://www.saferproducts.gov/RestWebServices/Recall?format=json
3. Check pg_net extension is enabled: SELECT * FROM pg_extension WHERE extname = 'pg_net';
4. Verify DB settings are present:
   SELECT current_setting('app.supabase_url', true), current_setting('app.service_role_key', true);
5. Verify service role key has not expired
6. Check error messages in cpsc_import_log table

To disable the job temporarily:
  SELECT cron.unschedule('cpsc-daily-import');

To re-enable:
  SELECT cron.schedule(
    'cpsc-daily-import'::text,
    '0 2 * * *'::text,
    'SELECT public.invoke_cpsc_import_cron();'::text
  );

To delete the job:
  SELECT cron.unschedule('cpsc-daily-import');

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ pg_cron extension enabled
✓ pg_net extension enabled
✓ Job scheduled to run daily at 2:00 AM UTC
✓ Job command matches platform pattern: SELECT public.invoke_cpsc_import_cron();
✓ DB settings configured with correct Edge Function URL and auth
✓ Job logs successful executions
✓ Recalls are imported daily without duplicates

==================================================
NEXT STEPS
==================================================

1. Manually configure URL and service role key (see above)
2. Test wrapper function to verify setup
3. Monitor first automated run at 2:00 AM UTC
4. Set up alerting for failed imports (optional)
*/
