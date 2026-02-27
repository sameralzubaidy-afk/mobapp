-- MODULE-11 SUB-009
-- Fix silent NULL returns from invoke_grace_period_cron by returning structured errors.

CREATE OR REPLACE FUNCTION public.invoke_grace_period_cron()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_base_url TEXT;
  v_function_url TEXT;
  v_service_role_key TEXT;
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

  v_function_url := RTRIM(v_base_url, '/') || '/functions/v1/grace-period-cron';

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
    'message', 'grace-period-cron job triggered',
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

COMMENT ON FUNCTION public.invoke_grace_period_cron() IS
'MODULE-11 SUB-009: invokes grace-period-cron edge function using async net.http_post and returns structured request_id response.';

-- Verification queries:
-- SELECT public.invoke_grace_period_cron();
-- SELECT current_setting(''app.supabase_url'', true) AS supabase_url_set,
--        current_setting(''app.service_role_key'', true) IS NOT NULL AS service_role_key_set;
-- SELECT extname FROM pg_extension WHERE extname IN (''http'', ''pg_cron'') ORDER BY extname;
