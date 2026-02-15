-- Migration: Scheduled Trial Reminders
-- Creates Postgres RPC function + pg_cron job for daily trial reminders
-- Matches pattern of scheduled_auto_complete_trades() and scheduled_send_message_emails()

-- ============================================
-- Part 1: Create RPC Function
-- ============================================
-- IMPORTANT: Replace <YOUR-PROJECT-REF> and <YOUR-SERVICE-ROLE-KEY> with actual values
-- Get these from: Supabase Dashboard → Project Settings → API

CREATE OR REPLACE FUNCTION public.scheduled_trial_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  -- We fix the "column does not exist" error by using PERFORM or capturing the bigint ID.
  -- net.http_post is ASYNCHRONOUS. It triggers the job and returns a request ID immediately.
  
  SELECT net.http_post(
    url := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/trial-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <YOUR-SERVICE-ROLE-KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  -- Log the result to your audit table
  INSERT INTO debug_logs (process_name, message, payload)
  VALUES ('scheduled_trial_reminders', 'Edge function triggered', jsonb_build_object('request_id', v_request_id));

  -- Return a status object matching your successful pattern
  RETURN jsonb_build_object(
    'run_at', now(),
    'status', 'success',
    'request_id', v_request_id,
    'processed_count', 'Check Edge Function logs for details'
  );
END;
$$;

-- Grant execute permission to postgres role (for cron job)
GRANT EXECUTE ON FUNCTION public.scheduled_trial_reminders() TO postgres;

-- ============================================
-- Part 2: Create pg_cron Job
-- ============================================

-- Schedule daily at 10:00 AM UTC
SELECT cron.schedule(
  'trial-reminders-daily',
  '0 10 * * *',
  $$SELECT public.scheduled_trial_reminders();$$
);

-- ============================================
-- Verification Queries
-- ============================================

-- Check if function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'scheduled_trial_reminders';

-- Check if cron job is scheduled
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'trial-reminders-daily';

-- Manual test (run this to verify it works)
-- SELECT public.scheduled_trial_reminders();
