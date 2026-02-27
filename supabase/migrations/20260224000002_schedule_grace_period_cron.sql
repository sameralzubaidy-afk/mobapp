-- ================================================================
-- Migration: 20260224000002_schedule_grace_period_cron.sql
-- Module: MODULE-11 SUB-009 - Grace Period Countdown, Reminders & Expiry
-- Description: Schedule daily cron job to check grace periods and send reminders
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Create RPC function to invoke Edge Function
-- ================================================================

CREATE OR REPLACE FUNCTION public.invoke_grace_period_cron()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_function_url TEXT;
  v_service_role_key TEXT;
  v_response TEXT;
BEGIN
  -- Get Supabase URL from database settings or environment
  v_function_url := current_setting('app.supabase_url', true) || '/functions/v1/grace-period-cron';
  v_service_role_key := current_setting('app.service_role_key', true);

  -- Validate configuration
  IF v_function_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE EXCEPTION 'Missing configuration: app.supabase_url or app.service_role_key not set';
  END IF;

  -- Call Edge Function via HTTP extension
  SELECT content::text INTO v_response
  FROM http((
    'POST',
    v_function_url,
    ARRAY[
      http_header('Authorization', 'Bearer ' || v_service_role_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);

  RETURN v_response;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'invoke_grace_period_cron failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.invoke_grace_period_cron() IS 
'MODULE-11 SUB-009: Invokes grace-period-cron Edge Function via HTTP to check grace periods and send reminders';

-- Verification: Test the RPC function (optional, comment out in production)
-- SELECT invoke_grace_period_cron();

-- ================================================================
-- BLOCK 2: Schedule pg_cron job (if available)
-- ================================================================

DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  -- Check if cron.schedule function exists
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'schedule' AND n.nspname = 'cron'
  ) THEN
    -- Unschedule existing job if present (idempotent)
    SELECT j.jobid INTO v_jobid
    FROM cron.job j
    WHERE j.jobname = 'grace-period-daily'
    LIMIT 1;

    IF v_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_jobid);
      RAISE NOTICE 'Unscheduled existing cron job: grace-period-daily';
    END IF;

    -- Schedule daily job at 3:00 AM UTC
    PERFORM cron.schedule(
      'grace-period-daily'::text,
      '0 3 * * *'::text,
      'SELECT public.invoke_grace_period_cron();'::text
    );

    RAISE NOTICE 'Successfully scheduled grace-period-daily cron job (3:00 AM UTC)';
  ELSE
    RAISE NOTICE 'cron.schedule is not available on this database; use external scheduler or Supabase Dashboard Cron Jobs';
  END IF;
END;
$$;

-- ================================================================
-- BLOCK 3: Verification Queries
-- ================================================================

-- Verify cron job exists (if pg_cron is available)
SELECT jobid, jobname, schedule, command, active, nodename
FROM cron.job
WHERE jobname = 'grace-period-daily';

-- Expected output:
-- jobid | jobname              | schedule    | command                              | active | nodename
-- ------+----------------------+-------------+--------------------------------------+--------+----------
-- <id>  | grace-period-daily   | 0 3 * * *   | SELECT invoke_grace_period_cron()    | true   | <node>

-- Manual test (invoke immediately):
-- SELECT invoke_grace_period_cron();

-- ================================================================
-- BLOCK 4: Alternative Setup Instructions
-- ================================================================

/*
ALTERNATIVE: Supabase Dashboard Cron Jobs Setup

If pg_cron is NOT enabled in your Supabase project:

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Click "Create Cron Job"
3. Configure:
   - Name: grace-period-daily
   - Schedule: 0 3 * * * (3 AM daily UTC)
   - Type: Edge Function
   - Edge Function: grace-period-cron
   - Method: POST
   - Auth: Service Role Key

4. Save

This will invoke the grace-period-cron Edge Function daily at 3 AM UTC.

MANUAL INVOCATION FOR TESTING:
curl -X POST \
  'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/grace-period-cron' \
  -H 'Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json'
*/

-- ================================================================
-- Configuration Instructions
-- ================================================================

/*
IMPORTANT: Before this migration can work, you must:

1. Enable http extension (for Edge Function invocation):
   CREATE EXTENSION IF NOT EXISTS http;

2. Set Supabase URL in Postgres settings:
   ALTER DATABASE postgres SET app.supabase_url = 'https://<YOUR_PROJECT_REF>.supabase.co';

3. Set service role key in Postgres settings:
   ALTER DATABASE postgres SET app.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';

4. Deploy the grace-period-cron Edge Function:
   cd supabase/functions
   supabase functions deploy grace-period-cron --no-verify-jwt

5. Set environment variable for SP expiry handler:
   - In Supabase Dashboard → Edge Functions → grace-period-cron → Settings
   - Add: SP_SUBSCRIPTION_EXPIRE_URL = https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/sp-subscription-expire
*/

-- ================================================================
-- Common Failure Modes
-- ================================================================

/*
FAILURE MODE 1: pg_cron extension not enabled
- Error: "extension pg_cron does not exist"
- Solution: Use Supabase Dashboard Cron Jobs instead (see above)

FAILURE MODE 2: http extension not enabled
- Error: "function http does not exist"
- Solution: Run: CREATE EXTENSION IF NOT EXISTS http;

FAILURE MODE 3: Missing app settings
- Error: "Missing configuration: app.supabase_url or app.service_role_key not set"
- Solution: Run ALTER DATABASE commands above

FAILURE MODE 4: Edge Function not deployed
- Error: HTTP 404 from Edge Function
- Solution: Deploy grace-period-cron Edge Function (see step 4 above)

BEST PRACTICE:
- For Supabase hosted projects, use Dashboard Cron Jobs (more reliable)
- For self-hosted Postgres with pg_cron, this migration works
*/

-- ================================================================
-- Rollback Instructions
-- ================================================================

/*
To disable the cron job without deleting it:
UPDATE cron.job 
SET active = false 
WHERE jobname = 'grace-period-daily';

To completely remove the cron job:
SELECT cron.unschedule('grace-period-daily');

To drop the RPC function:
DROP FUNCTION IF EXISTS invoke_grace_period_cron();
*/
