-- ============================================================================
-- Migration: Add trades.payout_paid_at + trades.stripe_transfer_id
-- Purpose: initiate-payout (TFV2-018) writes these two columns on a successful
--          Stripe Connect transfer, but they were never created — the PostgREST
--          update silently 400'd, so a real transfer left trades.payout_status
--          stuck at 'pending' (money moved, DB not recorded). 2026-08-28.
-- Mode: B (idempotent rerunnable migration)
-- ============================================================================

-- BLOCK 1: Schema
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS payout_paid_at TIMESTAMPTZ;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;

-- BLOCK 2: Performance (index on the transfer id for reconciliation lookups)
CREATE INDEX IF NOT EXISTS idx_trades_stripe_transfer_id
  ON public.trades(stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES (run after apply)
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='trades'
--   AND column_name IN ('payout_paid_at','stripe_transfer_id');
-- SELECT indexname FROM pg_indexes
--   WHERE schemaname='public' AND tablename='trades'
--   AND indexname='idx_trades_stripe_transfer_id';
