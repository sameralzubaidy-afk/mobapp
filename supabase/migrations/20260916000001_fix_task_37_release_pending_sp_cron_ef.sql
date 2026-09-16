-- =============================================================================
-- FIX-Task-37 item 5 — re-point the `release-pending-sp` cron at its Edge Function
-- =============================================================================
--
-- PROBLEM (same defect class as FIX-Task-36's auto-complete cron)
-- -----------------------------------------------------------------------------
-- `cron.job` jobid 49 (`release-pending-sp`, schedule `0 1 * * *`, ACTIVE) ran the
-- BARE RPC:
--
--     SELECT public.rpc_release_pending_sp(200);
--
-- A bare cron call by-passes the `release-pending-sp` Edge Function entirely. Today
-- that is *functionally equivalent*, because the EF is a pure pass-through (it only
-- forwards to the same RPC — verified by reading
-- `supabase/functions/release-pending-sp/index.ts`, 2026-09-16). That is precisely
-- why `npm run qa:cron-health` classified it WARN rather than FAIL, and why it was
-- left in place by FIX-Task-36.
--
-- The RISK is forward-looking and is the exact shape that cost real money on
-- 2026-09-14 (FIX-Task-36: 3 trades auto-completed with uncaptured authorizations,
-- $53.87 never collected): the moment any EF-side step is added to
-- `release-pending-sp` — a notification, an audit write, a ledger/provider call —
-- the bare cron will silently skip it. The schedule is the one caller that nothing
-- in a normal test run ever exercises (standards rule R110: "name the cron/caller,
-- not just the function").
--
-- THE FIX
-- -----------------------------------------------------------------------------
-- Point the job at the EF through the existing runtime-resolving wrapper, exactly
-- as FIX-Task-36 did for `process-auto-complete`:
--
--     SELECT public.rpc_fire_edge_function('/release-pending-sp');
--
-- `rpc_fire_edge_function(p_path text)` (created by
-- `20260830000004_dev_task_47_scrub_remaining_hardcoded_tokens.sql`) resolves the
-- base URL and the service-role key from GUC -> `admin_config` at RUN time and
-- fails closed with `CONFIG_UNAVAILABLE`. No credential is baked into `cron.job`
-- (BP-22). It is `service_role`-only.
--
-- SCHEDULE IS PRESERVED EXACTLY
-- -----------------------------------------------------------------------------
-- The live schedule is **`0 1 * * *`** (daily at 01:00 UTC), NOT `0 * * * *`.
-- The archived drift source `archive/misc./MODULE-15.1.2-TFV2-DB-FIX-BLOCKS.sql`
-- carries `0 * * * *` for this job and is WRONG — copying it would silently change
-- how often SP is released. The schedule below mirrors the LIVE value read from
-- `cron.job` on 2026-09-16.
--
-- DEPLOY ORDER
-- -----------------------------------------------------------------------------
-- No Edge Function redeploy is required. The EF accepts an empty body and defaults
-- `batchSize` to 200, so the wrapper's `body := '{}'` is compatible as-is.
--
-- MODE: B — idempotent rerunnable. The unschedule/schedule pair is safe to re-run:
--   it always removes every job named `release-pending-sp` before re-creating the
--   single intended one, so re-running cannot accumulate duplicate jobs.
--
-- ROLLBACK (restores the exact pre-change state):
--   DO $$
--   BEGIN
--     PERFORM cron.unschedule(c.jobid) FROM cron.job c
--      WHERE c.jobname = 'release-pending-sp';
--     PERFORM cron.schedule(
--       'release-pending-sp',
--       '0 1 * * *',
--       'SELECT public.rpc_release_pending_sp(200);'
--     );
--   END;
--   $$;
--   (Rolling back re-introduces the WARN, not a functional break — see PROBLEM.)
--
-- VERIFY (run separately; expected results in the trailing VERIFY block):
--   SELECT jobid, jobname, schedule, active, command FROM cron.job
--    WHERE jobname = 'release-pending-sp';
--   (from p2p-kids-marketplace) npm run qa:cron-health
-- =============================================================================

DO $$
BEGIN
  -- Same capability guard the sibling scheduling migrations use: only touch cron
  -- when both pg_cron and pg_net are actually present (BP-21 / BP-22).
  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'net' AND p.proname = 'http_post'
     ) THEN

    -- Address the job BY NAME, never by a hardcoded jobid: pg_cron assigns jobids
    -- sequentially at runtime, so 49 is an artifact, not an identifier (FIX-Task-36
    -- watched the sibling job move 42 -> 65 on re-schedule). `cron.unschedule`
    -- RAISES when its target is absent, so the set-based PERFORM — which passes zero
    -- rows and therefore never calls it — is the safe no-op form.
    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'release-pending-sp';

    PERFORM cron.schedule(
      'release-pending-sp',
      '0 1 * * *',
      'SELECT public.rpc_fire_edge_function(''/release-pending-sp'');'
    );

    RAISE NOTICE 'FIX-Task-37: release-pending-sp re-pointed at its Edge Function (schedule 0 1 * * *)';
  ELSE
    RAISE NOTICE 'FIX-Task-37: cron/pg_net unavailable — skipped re-pointing release-pending-sp';
  END IF;
END;
$$;

-- =============================================================================
-- VERIFY (run these separately):
--   SELECT jobid, jobname, schedule, active, command FROM cron.job
--    WHERE jobname = 'release-pending-sp';
--     expected: exactly ONE row, schedule '0 1 * * *', active = true,
--               command = SELECT public.rpc_fire_edge_function('/release-pending-sp');
--
--   (from p2p-kids-marketplace) npm run qa:cron-health
--     expected: 21 PASS / 0 WARN / 0 FAIL  (pre-fix baseline was 20/1/0)
--
--   (from p2p-kids-marketplace) npm run qa:cron-health -- --self-test
--     expected: all fixtures pass, including the new post-fix fixture
--
--   Prove a real invocation (after the next 01:00 UTC tick, or by running the
--   command manually as service_role):
--     SELECT net._http_response FROM net._http_response ORDER BY created DESC LIMIT 5;
-- =============================================================================
