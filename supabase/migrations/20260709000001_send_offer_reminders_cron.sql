-- File: supabase/migrations/20260709000001_send_offer_reminders_cron.sql
-- Module: MODULE-15.1.2 TradeFlowV2 — Offer Expiry Reminders (TC-G01)
-- Mode B: Idempotent rerunnable migration
-- Purpose:
--   The RPC rpc_send_offer_reminders was refactored to data-only in
--   20260609000002_fix_rpc_remove_http_calls.sql but the corresponding
--   cron job to call the send-offer-reminders Edge Function was never created.
--
--   This migration creates that cron job, following the same pattern as
--   send-auto-complete-reminders in 20260708000001_auto_complete_reminders.sql.
--
--   Without this cron, the RPC finds trades and marks reminder_6h_sent_at /
--   reminder_1h_sent_at, but no push or in-app notification is ever sent
--   because the send-offer-reminders Edge Function is never triggered.

-- =============================================================================
-- 1) Scheduler wiring: call send-offer-reminders Edge Function every 5 minutes
-- =============================================================================
DO $$
DECLARE
  v_base_url text;
  v_service_role_key text;
  v_job_sql text;
BEGIN
  v_base_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    NULLIF(current_setting('custom.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_url' AND ac.is_active = true LIMIT 1) || '/functions/v1',
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  );

  v_service_role_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3NzU2NSwiZXhwIjoyMDgwODUzNTY1fQ.6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss'
  );

  IF v_base_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'Skipping send-offer-reminders cron schedule: could not resolve base URL or service role key.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    -- Unschedule any existing job with this name (safe to run if none exists)
    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'send-offer-reminders';

    v_job_sql := format(
      $f$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );$f$,
      v_base_url || '/send-offer-reminders',
      v_service_role_key
    );

    PERFORM cron.schedule(
      'send-offer-reminders',
      '*/5 * * * *',
      v_job_sql
    );

    RAISE NOTICE 'send-offer-reminders cron scheduled successfully (every 5 minutes)';
  ELSE
    RAISE NOTICE 'pg_cron or net.http_post not available; send-offer-reminders cron not scheduled';
  END IF;
END;
$$;

-- =============================================================================
-- 2) On-demand trigger RPC for testing (simple one-liner)
-- =============================================================================
-- Usage from Supabase SQL Editor:
--   SELECT public.rpc_trigger_send_offer_reminders();
--
-- This calls the send-offer-reminders Edge Function immediately, which will:
--   1. Run rpc_send_offer_reminders to find trades needing reminders
--   2. Create user_notifications rows (in-app)
--   3. Send pushes via send-trade-notifications
CREATE OR REPLACE FUNCTION public.rpc_trigger_send_offer_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_url text;
  v_service_key text;
  v_result jsonb;
BEGIN
  -- Read settings (same sources as the cron job above)
  v_base_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    NULLIF(current_setting('custom.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_url' AND ac.is_active = true LIMIT 1) || '/functions/v1'
  );

  v_service_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1)
  );

  -- Hardcoded fallback for this project (same pattern as run_cron_job_now)
  IF v_base_url IS NULL THEN
    v_base_url := 'https://drntwgporzabmxdqykrp.supabase.co/functions/v1';
  END IF;

  IF v_service_key IS NULL THEN
    v_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3NzU2NSwiZXhwIjoyMDgwODUzNTY1fQ.6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss';
  END IF;

  -- Call the Edge Function via net.http_post
  v_result := (
    SELECT net.http_post(
      url := v_base_url || '/send-offer-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := '{}'::jsonb
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'send-offer-reminders Edge Function triggered',
    'request_id', v_result,
    'edge_function_url', v_base_url || '/send-offer-reminders'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_trigger_send_offer_reminders() TO service_role;

COMMENT ON FUNCTION public.rpc_trigger_send_offer_reminders IS 
'On-demand trigger for send-offer-reminders Edge Function. Use for testing: SELECT public.rpc_trigger_send_offer_reminders();';

-- =============================================================================
-- Verification
-- =============================================================================
-- Check that the cron job was created:
-- SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'send-offer-reminders';
--
-- Expected: jobname = 'send-offer-reminders', schedule = '*/5 * * * *'
--
-- Trigger manually:
-- SELECT public.rpc_trigger_send_offer_reminders();
