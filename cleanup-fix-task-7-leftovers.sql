-- =============================================================================
-- FIX-Task-7 (2026-09-08) — Data cleanup of the QA Task TRD-R1 P1 residue
-- Run in Supabase SQL Editor / MCP against STAGING (drntwgporzabmxdqykrp).
-- MODE: one-time cleanup (NOT a migration). Idempotent/guarded (safe to re-run).
-- =============================================================================
-- Scope:
--  (a) Trade c2d0d8f7-29f0-4f1d-956a-3c5f17461207 (Puzzle Set — 4 Pack, $18):
--      auto-completed by the P1 bug at 21:55:56 while dispute_status='reported'
--      (no_show). It is COMPLETED (can't go through the in-progress dispute
--      queue) and its stale 'reported' overlay pollutes the admin dispute queue.
--      → Clear the dispute overlay (mirror qa:r41-dispute reset) + mark the
--        wrongly-queued $14.40 requires_action seller payout terminal (failed).
--  (b) test-buyer (49243010-f458-4744-add1-a6c84ab95f1f) phantom reserved_sp=10:
--      verified NO backing open/pending/in_progress SP trade exists.
--      → Zero the phantom reservation (available_balance unchanged — recurring
--        pre-existing QA artifact; documented in TRD-R1 ledger.md).
-- =============================================================================

BEGIN;

-- (a1) Clear the stale dispute overlay on the completed P1-artifact trade.
--      dispute_status -> 'none' also fires trg_sync_disputed_at_from_status
--      (clears disputed_at) — explicit NULLs are belt-and-braces.
UPDATE public.trades
SET dispute_status      = 'none',
    dispute_reason      = NULL,
    dispute_notes       = NULL,
    dispute_opened_at   = NULL,
    disputed_at         = NULL,
    dispute_resolution  = NULL,
    dispute_resolved_at = NULL,
    dispute_resolved_by = NULL,
    updated_at          = now()
WHERE id = 'c2d0d8f7-29f0-4f1d-956a-3c5f17461207'
  AND dispute_status IN ('reported', 'under_review');

-- (a2) Remove the open-dispute EF's event + notification rows (mirror r41 reset).
DELETE FROM public.trade_events
WHERE trade_id = 'c2d0d8f7-29f0-4f1d-956a-3c5f17461207'
  AND event_type = 'trade_disputed';

DELETE FROM public.trade_notification_log
WHERE trade_id = 'c2d0d8f7-29f0-4f1d-956a-3c5f17461207'
  AND notification_type = 'trade_dispute_opened';

-- (a3) The payout queued by the bug (money never moved — requires_action on a
--      test account) → terminal 'failed' so it drops out of active payout
--      dispatch + reports. status enum: requires_action|pending|processing|completed|failed.
UPDATE public.seller_payouts
SET status         = 'failed',
    failure_reason = 'qa cleanup: FIX-Task-7 P1 auto-complete artifact (dispute should have paused auto-complete)',
    updated_at     = now()
WHERE trade_id = 'c2d0d8f7-29f0-4f1d-956a-3c5f17461207'
  AND status = 'requires_action';

-- (a4) Mirror on trades.payout_status (valid enum includes 'failed') so the
--      artifact reads as terminal/not-paid, never as a live queued payout.
UPDATE public.trades
SET payout_status = 'failed',
    updated_at    = now()
WHERE id = 'c2d0d8f7-29f0-4f1d-956a-3c5f17461207'
  AND payout_status = 'requires_action';

-- (b) test-buyer phantom 10-SP reservation → 0 (no backing trade; available_balance untouched).
UPDATE public.sp_wallets
SET reserved_sp = 0,
    updated_at  = now()
WHERE user_id = '49243010-f458-4744-add1-a6c84ab95f1f'
  AND reserved_sp = 10;

COMMIT;

-- =============================================================================
-- Verification (run after commit):
--  (a) Trade row should read: status='completed', dispute_status='none',
--      disputed_at=NULL, payout_status='failed'.
--   SELECT id, status, dispute_status, dispute_resolution, disputed_at, payout_status
--   FROM public.trades WHERE id = 'c2d0d8f7-29f0-4f1d-956a-3c5f17461207';
--
--  (a) Payout row should read status='failed' with the cleanup reason.
--   SELECT id, trade_id, status, net_amount_cents, failure_reason
--   FROM public.seller_payouts WHERE trade_id = 'c2d0d8f7-29f0-4f1d-956a-3c5f17461207';
--
--  (a) No leftover open-dispute event/notification rows.
--   SELECT count(*) FROM public.trade_events
--     WHERE trade_id='c2d0d8f7-29f0-4f1d-956a-3c5f17461207' AND event_type='trade_disputed';
--
--  (b) test-buyer wallet reserved_sp = 0, available_balance unchanged.
--   SELECT user_id, available_balance, reserved_sp FROM public.sp_wallets
--   WHERE user_id = '49243010-f458-4744-add1-a6c84ab95f1f';
-- =============================================================================
