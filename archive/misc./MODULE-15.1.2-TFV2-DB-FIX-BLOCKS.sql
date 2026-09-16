-- File: MODULE-15.1.2-TFV2-DB-FIX-BLOCKS.sql
-- Module: MODULE-15.1.2 Trade Flow V2
--
-- ⛔⛔ DEPRECATED — DO NOT RUN. THIS FILE WAS THE ROOT CAUSE OF FIX-Task-36. ⛔⛔
--
--   BLOCK 2 below re-creates the `process-auto-complete` cron job pointing at the
--   BARE RPC:
--       SELECT cron.schedule('process-auto-complete','*/15 * * * *',
--                            $$SELECT public.rpc_process_auto_complete(100);$$);
--
--   That command bypasses the `process-auto-complete` Edge Function, which is the
--   ONLY place the Stripe PaymentIntent CAPTURE happens. Running this block hands
--   the auto-complete job back to a clock-only path that completes trades without
--   collecting the buyer's money — on 2026-09-14 a single tick of exactly that job
--   completed 3 trades with uncaptured authorizations ($53.87 never collected), and
--   the database still read `payments.derived_state = 'succeeded'` because that
--   column is a trigger MIRROR of `trades.status`, not capture evidence (R100).
--
--   The correct command is:
--       SELECT public.rpc_fire_edge_function('/process-auto-complete');
--   and it is now enforced BOTH by migration
--   `20260914000003_fix_task_36_auto_complete_capture_guard_and_cron_ef.sql`
--   (which re-points the job) and by a database-level capture guard inside
--   `rpc_process_auto_complete` itself (which refuses to complete any trade
--   carrying money unless the caller names it).
--
--   Do not re-run this file, and do not copy BLOCK 2 from it. Verify cron health
--   with: `npm run qa:cron-health` (from p2p-kids-marketplace).
--
--   Kept in the archive only as a historical record of the TFV2 fix blocks.
--
-- Purpose:
--   Block 1: Verify TFV2 schema/functions/extensions exist.
--   Block 2: (SUPERSEDED — see the warning above) Create/recreate cron jobs for
--            offer expiry + auto-complete + pending SP release.
--
-- Run order:
--   1) Run BLOCK 1 and confirm results.
--   2) Run BLOCK 2.
--   3) Run the final verification queries at the bottom.

-- ============================================================================
-- BLOCK 1 - Preflight Verification (read-only)
-- ============================================================================

-- TFV2-001: admin_config timing fields (canonical column names)
SELECT
  ac.auto_complete_hours,
  ac.pending_sp_release_days,
  ac.offer_notif_1_hours_before,
  ac.offer_notif_2_hours_before,
  ac.auto_complete_notif_hours_before
FROM public.admin_config ac
LIMIT 1;

-- TFV2-004/005 dependencies: required RPCs exist
SELECT
  p.proname
FROM pg_proc p
WHERE p.proname IN (
  'rpc_process_expired_offers',
  'rpc_process_auto_complete',
  'rpc_release_pending_sp'
)
ORDER BY p.proname;

-- pg_cron extension must exist
SELECT
  e.extname
FROM pg_extension e
WHERE e.extname = 'pg_cron';


-- ============================================================================
-- BLOCK 2 - Scheduler Repair/Create (idempotent, safe rerun)
-- ============================================================================

-- Remove old jobs if they exist
SELECT cron.unschedule(c.jobid)
FROM cron.job c
WHERE c.jobname IN (
  'process-expired-offers',
  'process-auto-complete',
  'release-pending-sp'
);

-- Recreate canonical jobs
SELECT cron.schedule(
  'process-expired-offers',
  '*/5 * * * *',
  $$SELECT public.rpc_process_expired_offers(100);$$
);

SELECT cron.schedule(
  'process-auto-complete',
  '*/15 * * * *',
  $$SELECT public.rpc_process_auto_complete(100);$$
);

SELECT cron.schedule(
  'release-pending-sp',
  '0 * * * *',
  $$SELECT public.rpc_release_pending_sp(200);$$
);


-- ============================================================================
-- Final Verification (expected: 1 row + 2 rows)
-- ============================================================================

-- Expected: 1 row
SELECT
  c.jobname,
  c.schedule
FROM cron.job c
WHERE c.jobname = 'process-expired-offers';

-- Expected: 2 rows
SELECT
  c.jobname,
  c.schedule
FROM cron.job c
WHERE c.jobname IN ('process-auto-complete', 'release-pending-sp')
ORDER BY c.jobname;
