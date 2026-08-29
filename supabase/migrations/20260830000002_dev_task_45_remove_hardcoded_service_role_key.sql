-- File: supabase/migrations/20260830000002_dev_task_45_remove_hardcoded_service_role_key.sql
-- Mode B: Idempotent rerunnable migration
--
-- DEV-TASK-45 (SECURITY, 2026-08-29) — Remove the hardcoded service_role JWT
-- from migration 20260811000005 (`rpc_trigger_process_extension_timeouts`).
--
-- EXPOSURE SCOPE (verified via git, 2026-08-29):
--   The same service_role JWT
--   (`eyJhbGciOiJIUzI1NiIs...6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss`)
--   has been committed since 2026-02-17 (6.5+ months) in SIX migrations:
--     20260215000002, 20260703000003, 20260708000001, 20260709000001,
--     20260810000001, 20260811000005
--   plus `apply_fix.mjs` and six `april_chats/*.jsonl` session logs, and the
--   repo origin is `github.com/sameralzubaidy-afk/mobapp` (HEAD pushed) — the
--   token is an ACTIVE leak on GitHub, not latent. Rotation is MANDATORY and
--   URGENT (manual Supabase Dashboard action — see MANUAL ACTION below).
--
-- FIX:
--   1) rpc_trigger_process_extension_timeouts() — drop the hardcoded JWT from
--      the COALESCE fallback. The service role key now resolves ONLY from the
--      config mechanism (custom GUC `app.service_role_key` /
--      `custom.service_role_key` → admin_config key `service_role_key`). If no
--      key resolves, fail loud with a structured CONFIG_UNAVAILABLE result
--      (BP-28 — never silently fall back to a baked-in credential).
--   2) New rpc_fire_process_extension_timeouts() — the scheduled cron entry
--      point. Resolves base URL + service key at EXECUTION time (mirrors the
--      established CPSC cron pattern, migration 304_schedule_cpsc_import.sql:
--      the cron calls a runtime function instead of baking a token into the
--      cron.job command). Self-healing: once the rotated key is set in config,
--      the cron picks it up with no further migration.
--   3) Re-point the `process-extension-timeouts` cron job at the runtime
--      function (idempotent unschedule + schedule; no key is baked at schedule
--      time, so this never fails on missing config — the runtime function
--      NOTICEs and skips until a key is configured).
--
-- MANUAL ACTION REQUIRED (rotation — dev agent must NOT source/guess the key):
--   a) Supabase Dashboard → Project Settings → API → Service Role → Regenerate.
--   b) Set the NEW key where the runtime function reads it (any one of):
--        - admin_config key 'service_role_key' (is_active=true), OR
--        - ALTER DATABASE postgres SET app.service_role_key = '<NEW KEY>';  (304-documented GUC)
--      and fix/remove the admin_config 'supabase_service_role_key' row which
--      currently holds an ANON JWT (Task 39 ops finding) — it must hold the
--      REAL service key or be deleted (do NOT leave an anon JWT in a row named
--      for the service key).
--   c) Update the gitignored local .env files (p2p-kids-marketplace/.env,
--      .env.staging, p2p-kids-admin/.env.local, p2p-kids-marketplace/detox/.env)
--      with the new key.
--
-- SAFETY: base URL fallback is KEPT (project URL is public, committed repo-wide);
--   only the KEY is secret. This migration changes no data and no RLS. The
--   old token is retired by rotation, which invalidates every committed copy.
--
-- Change classification: A (DB/migration/RPC) + SECURITY. Tier 0 (SQL only) +
--   Tier 1 (post-rotation live invocation) + Tier 2 (db reset) recommended.

-- ============================================================================
-- BLOCK 1: rpc_trigger_process_extension_timeouts — remove hardcoded JWT,
--          add NULL guard (fail loud instead of firing with a compromised key)
-- ============================================================================

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
  -- DEV-TASK-45: service role key resolves ONLY from config (GUC then
  -- admin_config). The hardcoded JWT fallback was a committed secret and was
  -- removed; fail loud (BP-28) if no key is configured.
  v_service_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1)
  );

  IF v_base_url IS NULL OR v_service_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONFIG_UNAVAILABLE',
      'message', 'Service role key or edge function base URL not configured (set app.service_role_key GUC or admin_config.service_role_key).'
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

-- ============================================================================
-- BLOCK 2: rpc_fire_process_extension_timeouts — scheduled cron entry point.
--          Resolves config at EXECUTION time so the cron never bakes a token
--          (CPSC-cron pattern, 304_schedule_cpsc_import.sql).
-- ============================================================================

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
  -- DEV-TASK-45: runtime config resolution — the scheduled cron reads the key
  -- here on every run, so a rotated key in config is picked up immediately.
  v_service_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1)
  );

  IF v_base_url IS NULL OR v_service_key IS NULL THEN
    RAISE NOTICE 'rpc_fire_process_extension_timeouts: service role key or base URL not configured — skipping run (set app.service_role_key GUC or admin_config.service_role_key).';
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

-- ============================================================================
-- BLOCK 3: Re-point the process-extension-timeouts cron at the runtime entry.
--          Idempotent: unschedule the old job (which may carry a baked old
--          token from the original scheduler) and schedule the runtime call.
--          No key is required to schedule — config is resolved at runtime.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'process-extension-timeouts';

    PERFORM cron.schedule(
      'process-extension-timeouts',
      '*/5 * * * *',
      'SELECT public.rpc_fire_process_extension_timeouts();'
    );
  END IF;
END;
$$;

-- ============================================================================
-- BLOCK 4: Grants (preserve the service_role EXECUTE on the on-demand trigger;
--          grant the new runtime entry point to service_role — cron caller).
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.rpc_trigger_process_extension_timeouts() TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_fire_process_extension_timeouts() TO service_role;

-- ============================================================================
-- Verification queries (SQL-3 / read-only)
-- ============================================================================
-- -- (1) No function body in this migration's scope may still contain the token:
-- SELECT p.proname,
--        position('6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss' IN p.prosrc) > 0 AS has_hardcoded_token
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('rpc_trigger_process_extension_timeouts','rpc_fire_process_extension_timeouts');
--
-- -- (2) Cron points at the runtime function, not a baked token:
-- SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'process-extension-timeouts';
-- -- EXPECT: command = 'SELECT public.rpc_fire_process_extension_timeouts();'
--
-- -- (3) Config resolution pre-rotation (classify the admin_config key values by
-- --     JWT role claim WITHOUT printing the full secret):
-- SELECT key, is_active,
--        (convert_from(decode(replace(replace(split_part(value,'.',2),'-','+'),'_','/'),'base64'),'UTF8')::jsonb)->>'role' AS jwt_role,
--        left(value, 12) AS prefix
-- FROM public.admin_config
-- WHERE key ILIKE '%service_role%' OR key ILIKE '%edge_function_base_url%'
-- ORDER BY key;
-- -- EXPECT after rotation: the canonical service-key row holds a jwt_role='service_role'
-- --                       token; the 'supabase_service_role_key' anon-JWT row (Task 39)
-- --                       must be corrected/deleted.
--
-- -- (4) Post-rotation functional smoke: SELECT public.rpc_fire_process_extension_timeouts();
-- --     EXPECT: {success:true,...} once a REAL rotated key is in config;
-- --     EXPECT: {success:false,error:'CONFIG_UNAVAILABLE'} while no key is configured
-- --             (the function must NOT fall back to the committed token).
-- ============================================================================
