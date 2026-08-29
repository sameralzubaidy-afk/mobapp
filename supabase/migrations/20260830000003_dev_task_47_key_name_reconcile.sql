-- File: supabase/migrations/20260830000003_dev_task_47_key_name_reconcile.sql
-- Mode B: Idempotent rerunnable migration
--
-- DEV-TASK-47 (2026-08-29), item 1 — reconcile the service-role-key config
-- chain for the R15 functions after rotation.
--
-- DIAGNOSIS (verified live on staging drntwgporzabmxdqykrp, read-only):
--   After the owner rotated the key and corrected admin_config, the rotated
--   service-role key lives in admin_config key 'supabase_service_role_key'
--   (jwt_role='service_role'), but the DT45 functions resolve ONLY from:
--     GUC app/custom.service_role_key -> admin_config 'service_role_key'
--   and there is NO admin_config 'service_role_key' row. So both
--   rpc_trigger_process_extension_timeouts() and rpc_fire_process_extension_timeouts()
--   returned CONFIG_UNAVAILABLE even though a real key IS configured.
--
-- FIX: extend the service-key COALESCE in both R15 functions to ALSO read
--   admin_config key 'supabase_service_role_key' (the key-name the admin
--   config surface actually uses). Resolution order becomes:
--     GUC 'app.service_role_key' -> GUC 'custom.service_role_key'
--     -> admin_config 'service_role_key' -> admin_config 'supabase_service_role_key'
--   Fail-closed CONFIG_UNAVAILABLE if none resolve (BP-22 — never a hardcoded
--   fallback for secret keys).
--
-- Note: this same combined chain is what the item-3 cleanup (20260830000004)
-- uses across the other affected cron functions, so the whole DB reads the
-- one admin-config key-name that holds the rotated key.
--
-- Change classification: A (DB/migration/RPC) + Security. Tier 0 (SQL only).

CREATE OR REPLACE FUNCTION public.rpc_trigger_process_extension_timeouts()
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
  v_base_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  );
  -- DEV-TASK-47: service key resolves ONLY from config (GUC then the two
  -- admin_config key-names in use across the repo). Fail loud if none resolves.
  v_service_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_service_role_key' AND ac.is_active = true LIMIT 1)
  );

  IF v_base_url IS NULL OR v_service_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONFIG_UNAVAILABLE',
      'message', 'Service role key or edge function base URL not configured (set app.service_role_key GUC or admin_config.service_role_key / supabase_service_role_key).'
    );
  END IF;

  SELECT net.http_post(
    url := v_base_url || '/process-extension-timeouts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := '{}'::jsonb
  ) INTO v_result;

  RETURN jsonb_build_object('success', true, 'http_response', v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_fire_process_extension_timeouts()
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
  v_base_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  );
  -- DEV-TASK-47: runtime config resolution — includes the admin_config
  -- 'supabase_service_role_key' key-name (the one that holds the rotated key).
  v_service_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_service_role_key' AND ac.is_active = true LIMIT 1)
  );

  IF v_base_url IS NULL OR v_service_key IS NULL THEN
    RAISE NOTICE 'rpc_fire_process_extension_timeouts: service role key or base URL not configured — skipping run (set app.service_role_key GUC or admin_config.service_role_key / supabase_service_role_key).';
    RETURN jsonb_build_object('success', false, 'error', 'CONFIG_UNAVAILABLE');
  END IF;

  SELECT net.http_post(
    url := v_base_url || '/process-extension-timeouts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := '{}'::jsonb
  ) INTO v_result;

  RETURN jsonb_build_object('success', true, 'http_response', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_trigger_process_extension_timeouts() TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_fire_process_extension_timeouts() TO service_role;

-- ============================================================================
-- Verification queries (SQL-3 / read-only)
-- ============================================================================
-- SELECT public.rpc_fire_process_extension_timeouts();        -- EXPECT success:true
-- SELECT public.rpc_trigger_process_extension_timeouts();     -- EXPECT success:true
-- SELECT position('6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss' IN prosrc) > 0
-- FROM pg_proc WHERE proname LIKE '%extension_timeouts%';     -- EXPECT all false
-- ============================================================================
