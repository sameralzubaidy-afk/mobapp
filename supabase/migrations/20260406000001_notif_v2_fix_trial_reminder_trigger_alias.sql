-- Migration: NOTIF-V2-002 trial reminder trigger alias
-- Mode B: idempotent rerunnable migration
-- Purpose:
-- 1) Add compatibility RPC public.trigger_trial_reminders() used by manual test guide
-- 2) Invoke trial-reminders edge function directly with DB settings and structured diagnostics

CREATE OR REPLACE FUNCTION public.trigger_trial_reminders()
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
    'trigger_trial_reminders',
    'Edge function queued',
    jsonb_build_object('request_id', v_request_id, 'url', v_function_url, 'run_at', now(), 'used_fallback_defaults', v_used_fallback)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'queued',
    'message', 'trial-reminders job triggered',
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

GRANT EXECUTE ON FUNCTION public.trigger_trial_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_trial_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_trial_reminders() TO postgres;

-- Verification:
-- SELECT public.trigger_trial_reminders();
-- SELECT public.scheduled_trial_reminders();
