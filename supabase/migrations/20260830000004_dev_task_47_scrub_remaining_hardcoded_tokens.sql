-- File: supabase/migrations/20260830000004_dev_task_47_scrub_remaining_hardcoded_tokens.sql
-- Mode B: Idempotent rerunnable migration
--
-- DEV-TASK-47 (2026-08-29), item 3 — scrub the now-inert committed service_role
-- token from the remaining functions/crons (low-priority hygiene; the key is
-- already rotated, so these tokens are inert). Follows the amended BP-22:
-- secrets resolve ONLY from config at runtime; cron jobs call a runtime
-- config-resolving wrapper; no literal credential is baked into a migration or
-- into cron.job.
--
-- Files cleaned (the committed token appears in these migrations + apply_fix.mjs):
--   20260215000002 (invoke_trial_conversion_edge_function)
--   20260703000003 (run_cron_job_now)
--   20260708000001 (send-auto-complete-reminders cron scheduler)
--   20260709000001 (send-offer-reminders cron scheduler + rpc_trigger_send_offer_reminders)
--   20260810000001 (send-pickup-reminders cron scheduler + rpc_trigger_send_pickup_reminders)
--   apply_fix.mjs   (JS file — separate edit, not part of this SQL)
--
-- Design:
--   1) rpc_fire_edge_function(p_path) — ONE generic runtime wrapper that
--      resolves base URL + service key (GUC -> admin_config service_role_key
--      -> admin_config supabase_service_role_key) at EXECUTION time and fires
--      net.http_post. Fail-closed CONFIG_UNAVAILABLE.
--   2) Re-point the 3 reminder crons to the wrapper (idempotent; nothing baked).
--      'trial-conversion-daily' needs no re-point — it already calls the
--      function directly, and that function is rewritten to config-only.
--   3) Rewrite invoke_trial_conversion_edge_function, the two rpc_trigger_*
--      (delegate to the wrapper), and run_cron_job_now (config-only + fail-closed).
--
-- Change classification: A (DB/migration/RPC) + Security hygiene. Tier 0 (SQL).

-- ============================================================================
-- BLOCK 1: generic runtime wrapper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_fire_edge_function(p_path text)
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
  -- Base URL: config with a NON-secret fallback (project URL is public).
  v_base_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    NULLIF(current_setting('custom.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_url' AND ac.is_active = true LIMIT 1) || '/functions/v1',
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  );
  -- DEV-TASK-47/BP-22: service key resolves ONLY from config (GUC then the two
  -- admin_config key-names in use). NO hardcoded fallback for a secret.
  v_service_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_service_role_key' AND ac.is_active = true LIMIT 1)
  );

  IF p_path IS NULL OR v_base_url IS NULL OR v_service_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONFIG_UNAVAILABLE',
      'message', 'Edge Function path / service role key / base URL not configured (set app.service_role_key GUC or admin_config.service_role_key / supabase_service_role_key).'
    );
  END IF;

  SELECT net.http_post(
    url := v_base_url || p_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := '{}'::jsonb
  ) INTO v_result;

  RETURN jsonb_build_object('success', true, 'http_response', v_result, 'path', p_path);
END;
$$;

-- ============================================================================
-- BLOCK 2: re-point the 3 reminder crons to the runtime wrapper (idempotent)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    PERFORM cron.unschedule(c.jobid) FROM cron.job c WHERE c.jobname = 'send-offer-reminders';
    PERFORM cron.schedule('send-offer-reminders', '*/5 * * * *', 'SELECT public.rpc_fire_edge_function(''/send-offer-reminders'');');

    PERFORM cron.unschedule(c.jobid) FROM cron.job c WHERE c.jobname = 'send-auto-complete-reminders';
    PERFORM cron.schedule('send-auto-complete-reminders', '*/5 * * * *', 'SELECT public.rpc_fire_edge_function(''/send-auto-complete-reminders'');');

    PERFORM cron.unschedule(c.jobid) FROM cron.job c WHERE c.jobname = 'send-pickup-reminders';
    PERFORM cron.schedule('send-pickup-reminders', '*/5 * * * *', 'SELECT public.rpc_fire_edge_function(''/send-pickup-reminders'');');
  END IF;
END;
$$;

-- ============================================================================
-- BLOCK 3: rewrite invoke_trial_conversion_edge_function (config-only)
--          (cron 'trial-conversion-daily' already calls this function directly;
--           no cron re-point needed)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.invoke_trial_conversion_edge_function()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id uuid;
  v_url text;
  v_service_role_key text;
  v_response jsonb;
BEGIN
  v_request_id := gen_random_uuid();
  v_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    NULLIF(current_setting('custom.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_url' AND ac.is_active = true LIMIT 1) || '/functions/v1',
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  ) || '/trial-conversion';
  -- DEV-TASK-47/BP-22: config-only, no hardcoded secret.
  v_service_role_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_service_role_key' AND ac.is_active = true LIMIT 1)
  );

  IF v_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'invoke_trial_conversion_edge_function: service role key or base URL not configured — skipping (set app.service_role_key GUC or admin_config.service_role_key / supabase_service_role_key).';
    RETURN jsonb_build_object('success', false, 'error', 'CONFIG_UNAVAILABLE');
  END IF;

  SELECT jsonb_build_object('status', status, 'content', content::jsonb) INTO v_response
  FROM http((
    'POST', v_url,
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || v_service_role_key)
    ],
    'application/json',
    '{}'
  )::http_request);

  RAISE NOTICE 'trial-conversion invoked: request_id=%, response=%', v_request_id, v_response;
  RETURN v_response;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ============================================================================
-- BLOCK 4: rewrite on-demand triggers to delegate to the runtime wrapper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_trigger_send_offer_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.rpc_fire_edge_function('/send-offer-reminders');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_trigger_send_pickup_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.rpc_fire_edge_function('/send-pickup-reminders');
END;
$$;

-- ============================================================================
-- BLOCK 5: rewrite run_cron_job_now (config-only + fail-closed on missing key)
-- ============================================================================
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

  -- DEV-TASK-47: base URL from config with a NON-secret fallback (public URL).
  SELECT COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    NULLIF(current_setting('custom.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_url' AND ac.is_active = true LIMIT 1) || '/functions/v1',
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  ) INTO v_edge_base_url;

  -- DEV-TASK-47/BP-22: service key resolves ONLY from config. NO hardcoded fallback.
  SELECT COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_service_role_key' AND ac.is_active = true LIMIT 1)
  ) INTO v_service_key;

  v_edge_base_url := rtrim(v_edge_base_url, '/');

  -- net.http_post commands: rebuild the call with config-resolved values.
  IF v_command ~* 'net\.http_post\(' THEN
    IF v_service_key IS NULL THEN
      RETURN jsonb_build_object('success', false, 'jobname', v_jobname, 'error', 'CONFIG_UNAVAILABLE',
        'message', 'Service role key not configured (set app.service_role_key GUC or admin_config.service_role_key / supabase_service_role_key).');
    END IF;
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

-- ============================================================================
-- BLOCK 6: Grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.rpc_fire_edge_function(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.invoke_trial_conversion_edge_function() TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_trigger_send_offer_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_trigger_send_pickup_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_cron_job_now(bigint) TO authenticated, service_role;

-- ============================================================================
-- Verification queries (SQL-3 / read-only)
-- ============================================================================
-- -- (1) No function in scope may still contain the token:
-- SELECT p.proname, position('6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss' IN p.prosrc) > 0 AS has_token
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('rpc_fire_edge_function','invoke_trial_conversion_edge_function',
--     'rpc_trigger_send_offer_reminders','rpc_trigger_send_pickup_reminders','run_cron_job_now');
-- -- EXPECT: all has_token = false
--
-- -- (2) Re-pointed crons call the runtime wrapper (no baked token):
-- SELECT jobname, schedule, command FROM cron.job
-- WHERE jobname IN ('send-offer-reminders','send-auto-complete-reminders','send-pickup-reminders')
-- ORDER BY jobname;
-- -- EXPECT: command = SELECT public.rpc_fire_edge_function('<path>');
--
-- -- (3) Wrapper smoke (fires the EF with the rotated key — normal cron behavior):
-- SELECT public.rpc_fire_edge_function('/send-offer-reminders');
-- -- EXPECT: {success:true, http_response:<id>, path:'/send-offer-reminders'}
-- ============================================================================
