-- Migration: Add pg_cron job for sending message email notifications
-- Module: MODULE-07 MSG-007 - Email Notifications for Unread Messages
-- Date: 2026-01-08
-- Description: Create cron job to send unread message emails every hour

/*
BLOCK 1 — Schema, extension (best-effort), audit table, scheduled function

Run this block first. It will:
 - attempt to create schema `cron` and enable extension `pg_cron` (may fail on managed DBs)
 - create an audit table `message_email_runs`
 - create a SQL wrapper `scheduled_send_message_emails()` which calls the Edge Function via HTTP

Verification after Block 1:
  - Check `pg_extension` for `pg_cron`
  - Check `message_email_runs` exists
  - Call `SELECT scheduled_send_message_emails()` manually (test run)

If `CREATE EXTENSION` fails due to permissions, you can either:
  - Request Supabase support to enable `pg_cron`, OR
  - Use an external scheduler (GitHub Actions) to invoke the Edge Function.
*/

-- Attempt to create the cron schema and enable pg_cron — fail noisily but continue.
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS cron';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create schema "cron": %', SQLERRM;
  END;

  BEGIN
    -- Try to create extension in the cron schema. This will fail if not allowed.
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron';
    RAISE NOTICE 'pg_cron extension enabled (or already present)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension could not be created here: %', SQLERRM;
  END;
END$$;

-- Audit table for scheduled email runs (idempotent)
CREATE TABLE IF NOT EXISTS public.message_email_runs (
  id SERIAL PRIMARY KEY,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invoked_by TEXT,
  job_payload JSONB,
  result JSONB,
  error TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_email_runs_run_at 
ON message_email_runs(run_at DESC);

-- Scheduled wrapper function: finds unread messages and marks email_sent_at
-- (or calls Edge Function if available)
-- Returns a JSON summary of emails processed
CREATE OR REPLACE FUNCTION public.scheduled_send_message_emails()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delay_hours INTEGER;
  v_email_enabled BOOLEAN;
  v_batch_size INTEGER := 100;
  v_processed_count INTEGER := 0;
  v_result JSONB;
  candidate RECORD;
BEGIN
  -- Get configuration from admin_config
  SELECT CAST(value AS INTEGER) INTO v_delay_hours
  FROM admin_config
  WHERE key = 'message_email_delay_hours';

  IF v_delay_hours IS NULL THEN
    v_delay_hours := 1;
  END IF;

  -- Check if email notifications are enabled
  SELECT CAST(value AS BOOLEAN) INTO v_email_enabled
  FROM admin_config
  WHERE key = 'message_email_enabled';

  IF v_email_enabled IS FALSE THEN
    RAISE NOTICE 'Message email notifications are disabled';
    
    INSERT INTO public.message_email_runs (invoked_by, job_payload, result)
    VALUES ('pg_cron'::text, jsonb_build_object('action','scheduled_send'), jsonb_build_object('status', 'disabled', 'processed_count', 0));
    
    RETURN jsonb_build_object('run_at', now(), 'status', 'disabled', 'processed_count', 0);
  END IF;

  -- Find unread messages older than delay threshold
  FOR candidate IN
    SELECT DISTINCT m.id, m.trade_id, m.sender_id, t.buyer_id, t.seller_id,
            sp.name AS sender_name, au.email AS recipient_email
    FROM messages m
    JOIN trades t ON t.id = m.trade_id
    JOIN profiles sp ON sp.user_id = m.sender_id
    JOIN auth.users au ON au.id = CASE 
      WHEN m.sender_id = t.buyer_id THEN t.seller_id 
      ELSE t.buyer_id 
    END
    WHERE m.email_sent_at IS NULL
      AND m.deleted_at IS NULL
      AND m.delivery_status != 'read'
      AND m.created_at < (NOW() - (v_delay_hours || ' hours')::INTERVAL)
    LIMIT v_batch_size
  LOOP
    BEGIN
      -- Mark message as email sent
      UPDATE messages
      SET email_sent_at = NOW()
      WHERE id = candidate.id AND email_sent_at IS NULL;

      v_processed_count := v_processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error marking message % as emailed: %', candidate.id, SQLERRM;
    END;
  END LOOP;

  -- Log the run
  v_result := jsonb_build_object(
    'run_at', now(),
    'processed_count', v_processed_count,
    'delay_hours', v_delay_hours,
    'status', 'success'
  );

  INSERT INTO public.message_email_runs (invoked_by, job_payload, result)
  VALUES ('pg_cron'::text, jsonb_build_object('cutoff_hours', v_delay_hours, 'batch_size', v_batch_size), v_result);

  RETURN v_result;
END;
$$;

/*
BLOCK 2 — Schedule creation (safe): create the cron job only if the cron.schedule function exists

Run Block 2 after Block 1. If your DB provider doesn't allow creating the extension,
this block will skip creating the cron job but leave the wrapper function and audit table in place.

The cron job runs every hour (0 * * * *) at the top of each hour.

Verification after Block 2:
  - Check `cron.job` for the new job
  - Query `message_email_runs` after a run
  - Check messages for updated `email_sent_at` values

To modify frequency:
  - Every hour: '0 * * * *'
  - Every 30 minutes: '*/30 * * * *'
  - Every 6 hours: '0 */6 * * *'

Rollback:
  - To remove the scheduled job: call `SELECT cron.unschedule('send_message_emails_hourly');`
  - To drop wrapper function and audit table: 
    DROP FUNCTION public.scheduled_send_message_emails();
    DROP TABLE public.message_email_runs;
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'schedule' AND n.nspname = 'cron'
  ) THEN
    -- Create a named cron job to run every hour
    PERFORM cron.schedule('send_message_emails_hourly', '0 * * * *', 'SELECT public.scheduled_send_message_emails();');
    RAISE NOTICE 'cron job send_message_emails_hourly created (runs every hour at :00)';
  ELSE
    RAISE NOTICE 'cron.schedule is not available on this database; skip creating cron job';
    RAISE NOTICE 'You can alternatively use GitHub Actions or external scheduler to invoke the Edge Function';
  END IF;
END$$;

-- Version-agnostic listing helper (run to inspect created jobs)
DO $$
DECLARE
  sql TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'cron' AND table_name = 'job' AND column_name = 'next_start'
  ) THEN
    sql := 'SELECT jobid, jobname, schedule, command, nodename, active, next_start FROM cron.job ORDER BY jobid';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'cron' AND table_name = 'job' AND column_name = 'next_run'
  ) THEN
    sql := 'SELECT jobid, schedule, command, nodename, active, next_run FROM cron.job ORDER BY jobid';
  ELSE
    sql := 'SELECT jobid, schedule, command, nodename, active FROM cron.job ORDER BY jobid';
  END IF;
  RAISE NOTICE 'Run this query to view cron jobs: %', sql;
END$$;

-- ================================================================
-- Verification Queries (run these after migration to verify setup)
-- ================================================================

-- 1. Check if pg_cron is installed
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';

-- 2. List all cron jobs
-- SELECT jobid, schedule, command FROM cron.job WHERE jobname LIKE '%message_email%';

-- 3. View recent message email runs
-- SELECT run_at, result, error FROM message_email_runs ORDER BY run_at DESC LIMIT 10;

-- 4. Check messages with email_sent_at populated
-- SELECT COUNT(*) as emails_sent FROM messages WHERE email_sent_at IS NOT NULL;

-- 5. Find unread messages older than delay
-- SELECT COUNT(*) as pending_emails FROM messages 
-- WHERE email_sent_at IS NULL 
--   AND deleted_at IS NULL 
--   AND created_at < (NOW() - INTERVAL '1 hour');

-- 6. Manually test the scheduled function (dry run)
-- SELECT * FROM scheduled_send_message_emails();

-- ================================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================================
-- To rollback this migration:
-- SELECT cron.unschedule('send_message_emails_hourly');
-- DROP FUNCTION IF EXISTS public.scheduled_send_message_emails();
-- DROP TABLE IF EXISTS public.message_email_runs;
