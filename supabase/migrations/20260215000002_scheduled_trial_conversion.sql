-- File: supabase/migrations/20260215000002_scheduled_trial_conversion.sql
-- MODULE-11 TASK SUB-005: Trial Conversion Scheduler
-- Creates Postgres RPC function + pg_cron job for daily trial conversion processing

-- =============================================================================
-- Part 1: Create RPC Function to Invoke Edge Function
-- =============================================================================

-- This function is called by pg_cron to trigger the trial-conversion Edge Function
DROP FUNCTION IF EXISTS invoke_trial_conversion_edge_function();
CREATE OR REPLACE FUNCTION invoke_trial_conversion_edge_function()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
request_id uuid;
url text;
headers jsonb;
response jsonb;
  v_service_role_key text;
BEGIN
request_id := gen_random_uuid();

-- Configure Edge Function URL (AUTO-POPULATED)
url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/trial-conversion';

v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3NzU2NSwiZXhwIjoyMDgwODUzNTY1fQ.6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss';

-- Invoke Edge Function using http extension
-- Note: Returns the full HTTP response as JSONB
SELECT 
jsonb_build_object(
  'status', status,
  'content', content::jsonb
) INTO response
FROM http((
'POST',
url,
ARRAY[
    http_header('Content-Type', 'application/json'),
    http_header('Authorization', 'Bearer ' || v_service_role_key)
  ],
  'application/json',
  '{}'
)::http_request);

  -- Log the result
  RAISE NOTICE 'trial-conversion invoked: request_id=%, response=%', request_id, response;
  
  RETURN response;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

COMMENT ON FUNCTION invoke_trial_conversion_edge_function IS 
'MODULE-11 SUB-005: Invokes trial-conversion Edge Function via HTTP. Called daily by pg_cron.';

-- =============================================================================
-- Part 2: Create pg_cron Job
-- =============================================================================

-- Schedule trial conversion to run once daily at 2:00 AM UTC
-- This checks for expired trials and converts/downgrades them
-- First unschedule if it already exists
SELECT cron.unschedule('trial-conversion-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-conversion-daily');

-- Now schedule with explicit type casting to resolve function overload
SELECT cron.schedule(
  'trial-conversion-daily'::text,
  '0 2 * * *'::text,
  $$SELECT invoke_trial_conversion_edge_function()$$::text
);

-- =============================================================================
-- Part 3: Verification Queries
-- =============================================================================

-- Verify the cron job was created successfully
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'trial-conversion-daily';

-- Expected output:
-- jobid | jobname                  | schedule    | command                                    | active
-- ------+--------------------------+-------------+-------------------------------------------+--------
-- <id>  | trial-conversion-daily   | 0 2 * * *   | SELECT invoke_trial_conversion_edge_f...  | true

-- =============================================================================
-- Part 4: Manual Testing
-- =============================================================================

-- To manually trigger the trial conversion job (for testing):
-- SELECT invoke_trial_conversion_edge_function();

-- To view cron job history/logs (if available):
-- SELECT * FROM cron.job_run_details WHERE jobid = (
--   SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily'
-- )
-- ORDER BY start_time DESC
-- LIMIT 10;

-- =============================================================================
-- Part 5: Configuration Instructions
-- =============================================================================

/*
IMPORTANT: Before this migration can work, you must:

1. Enable pg_cron extension (if not already enabled):
   - Contact Supabase support to enable pg_cron
   - OR use Supabase Dashboard → Database → Cron Jobs

2. Enable http extension (for Edge Function invocation):
   - Run: CREATE EXTENSION IF NOT EXISTS http;

3. Set service role key in Postgres settings:
   - Run: ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
   - Replace 'your-service-role-key' with actual service role key from Supabase dashboard

4. Update Edge Function URL in the RPC function:
   - Replace <YOUR-PROJECT-REF> in line 24 with your actual Supabase project reference
   - Example: https://abcdefghijk.supabase.co/functions/v1/trial-conversion

5. Deploy the trial-conversion Edge Function:
   - Run: supabase functions deploy trial-conversion --no-verify-jwt

Alternative: Use Supabase Dashboard Cron Jobs
If pg_cron is not available, you can create the job via Dashboard:
1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create new job:
   - Name: trial-conversion-daily
   - Schedule: 0 2 * * * (2:00 AM UTC daily)
   - Command: SELECT invoke_trial_conversion_edge_function()
*/

-- =============================================================================
-- Part 6: Unscheduling (if needed)
-- =============================================================================

-- To disable the cron job without deleting it:
-- UPDATE cron.job 
-- SET active = false 
-- WHERE jobname = 'trial-conversion-daily';

-- To completely remove the cron job:
-- SELECT cron.unschedule('trial-conversion-daily');

-- To drop the RPC function:
-- DROP FUNCTION IF EXISTS invoke_trial_conversion_edge_function();

-- =============================================================================
-- COMPLETION CHECKLIST
-- =============================================================================

/*
✓ invoke_trial_conversion_edge_function() RPC created
✓ pg_cron job 'trial-conversion-daily' scheduled for 2:00 AM UTC
✓ Verification query provided
✓ Manual testing command provided
✓ Configuration instructions documented
✓ Unscheduling instructions provided

NEXT STEPS:
1. Complete configuration steps in Part 5 above
2. Deploy trial-conversion Edge Function
3. Test manually: SELECT invoke_trial_conversion_edge_function();
4. Monitor logs in Supabase Dashboard or cron.job_run_details
*/
