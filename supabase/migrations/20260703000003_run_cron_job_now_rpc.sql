-- File: supabase/migrations/20260703000003_run_cron_job_now_rpc.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: Provides a secure RPC to execute a pg_cron job's command immediately
--          (one-time run outside the scheduled interval).
--
-- For net.http_post commands that use current_setting(), the function extracts
-- the API path from the command and builds a fresh call using values from
-- admin_config (with fallback defaults). This avoids PostgreSQL permission
-- errors when trying to set custom config parameters in managed Supabase.

CREATE OR REPLACE FUNCTION public.run_cron_job_now(
  p_job_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_jobname text;
  v_command text;
  v_active boolean;
  v_result text;
  v_start_time timestamptz;
  v_edge_base_url text;
  v_service_key text;
  v_api_path text;
  v_url_match text[];
BEGIN
  IF p_job_id IS NULL OR p_job_id <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valid job ID is required');
  END IF;

  SELECT c.jobname, c.command, c.active
  INTO v_jobname, v_command, v_active
  FROM cron.job c
  WHERE c.jobid = p_job_id;

  IF v_jobname IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cron job not found: ' || p_job_id);
  END IF;

  IF NOT v_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot run inactive job "' || v_jobname || '".', 'jobname', v_jobname);
  END IF;

  v_start_time := clock_timestamp();

  -- Read settings from admin_config with hardcoded fallbacks for this project
  SELECT COALESCE(
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_url' AND ac.is_active = true LIMIT 1) || '/functions/v1',
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  ) INTO v_edge_base_url;

  SELECT COALESCE(
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3NzU2NSwiZXhwIjoyMDgwODUzNTY1fQ.6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss'
  ) INTO v_service_key;

  v_edge_base_url := rtrim(v_edge_base_url, '/');

  -- Check if this is a net.http_post command
  -- If so, extract the API path and build a fresh call with literal values
  IF v_command ~* 'net\.http_post\(' THEN
    v_url_match := regexp_match(v_command, '''(/[^'']+)''\s*\)');
    IF v_url_match IS NULL THEN
      v_url_match := regexp_match(v_command, '\|\|\s*''(/[^'']+)''');
    END IF;

    IF v_url_match IS NOT NULL THEN
      v_api_path := v_url_match[1];
      BEGIN
        PERFORM net.http_post(
          url     := v_edge_base_url || v_api_path,
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body    := '{}'::jsonb
        );
        v_result := 'Triggered ' || v_api_path || ' via ' || v_edge_base_url;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'jobname', v_jobname, 'error', SQLERRM, 'started_at', v_start_time);
      END;
    ELSE
      BEGIN
        EXECUTE v_command;
        v_result := 'Executed (fallback)';
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'jobname', v_jobname, 'error', SQLERRM, 'started_at', v_start_time);
      END;
    END IF;
  ELSE
    BEGIN
      EXECUTE v_command;
      v_result := 'Executed successfully';
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'jobname', v_jobname, 'error', SQLERRM, 'started_at', v_start_time);
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'jobname', v_jobname, 'result', v_result, 'started_at', v_start_time);
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_cron_job_now(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_cron_job_now(bigint) TO service_role;

COMMENT ON FUNCTION public.run_cron_job_now(bigint)
IS 'Executes a pg_cron job command immediately. For net.http_post commands, reads settings from admin_config and builds a fresh call with literal values.';
