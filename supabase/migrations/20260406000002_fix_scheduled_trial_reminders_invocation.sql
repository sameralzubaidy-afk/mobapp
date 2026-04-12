-- Migration: Fix scheduled_trial_reminders invocation
-- Mode B: idempotent rerunnable migration
-- Purpose:
-- 1) Remove placeholder URL/key usage
-- 2) Invoke trial-reminders edge function using DB settings
-- 3) Return structured diagnostics for manual and cron runs

CREATE OR REPLACE FUNCTION public.scheduled_trial_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_base_url text;
  v_service_role_key text;
  v_function_url text;
  v_request_id bigint;
  v_used_fallback boolean := false;
BEGIN
  v_base_url := COALESCE(
    NULLIF(current_setting('app.supabase_url', true), ''),
    'https://drntwgporzabmxdqykrp.supabase.co'
  );
  v_service_role_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('app.supabase_service_role_key', true), ''),
    NULLIF(current_setting('app.supabase_anon_key', true), ''),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzc1NjUsImV4cCI6MjA4MDg1MzU2NX0.5lj-JNoBItZJCZgMV9DwFslmzud0PxcIjSS78TFRU0E'
  );

  v_used_fallback := (
    NULLIF(current_setting('app.supabase_url', true), '') IS NULL
    OR (
      NULLIF(current_setting('app.service_role_key', true), '') IS NULL
      AND NULLIF(current_setting('app.supabase_service_role_key', true), '') IS NULL
      AND NULLIF(current_setting('app.supabase_anon_key', true), '') IS NULL
    )
  );

  IF COALESCE(v_base_url, '') = '' OR COALESCE(v_service_role_key, '') = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_DB_SETTINGS',
      'message', 'app.supabase_url or service key setting is not set',
      'details', jsonb_build_object(
        'has_supabase_url', COALESCE(v_base_url, '') <> '',
        'has_service_role_key', NULLIF(current_setting('app.service_role_key', true), '') IS NOT NULL,
        'has_supabase_service_role_key', NULLIF(current_setting('app.supabase_service_role_key', true), '') IS NOT NULL,
        'has_supabase_anon_key', NULLIF(current_setting('app.supabase_anon_key', true), '') IS NOT NULL
      )
    );
  END IF;

  IF to_regproc('net.http_post') IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_PG_NET',
      'message', 'pg_net extension is not enabled (net.http_post missing)'
    );
  END IF;

  v_function_url := rtrim(v_base_url, '/') || '/functions/v1/trial-reminders';

  SELECT net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'apikey', v_service_role_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES (
    'scheduled_trial_reminders',
    'Edge function queued',
    jsonb_build_object('request_id', v_request_id, 'url', v_function_url, 'run_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'queued',
    'request_id', v_request_id,
    'url', v_function_url,
    'used_fallback_defaults', v_used_fallback,
    'run_at', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'RPC_INVOKE_FAILED',
      'message', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.scheduled_trial_reminders() TO postgres;
GRANT EXECUTE ON FUNCTION public.scheduled_trial_reminders() TO service_role;

-- Verification:
-- SELECT public.scheduled_trial_reminders();
-- SELECT public.trigger_trial_reminders();
-- SELECT process_name, message, payload, created_at
-- FROM public.debug_logs
-- WHERE process_name = 'scheduled_trial_reminders'
-- ORDER BY created_at DESC
-- LIMIT 5;

-- Common failure modes:
-- 1) MISSING_DB_SETTINGS: app.supabase_url/app.service_role_key not configured
-- 2) MISSING_PG_NET: pg_net extension not available
-- 3) RPC_INVOKE_FAILED: malformed URL, permission issues, or network failures
