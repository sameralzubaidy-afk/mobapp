-- Migration: Add missing dispute_status and dispute_opened_at columns to trades
-- Date: 2026-07-03
-- Mode B: Idempotent rerunnable migration
-- Bug: Migration 20260528000002 added dispute_reason, dispute_notes, dispute_resolution,
-- and disputed_at but FORGOT dispute_status and dispute_opened_at.
-- Without dispute_status, the open-dispute Edge Function, admin dispute queue,
-- TradeTimelineScreen dispute banner, and payout trigger all silently fail.

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS dispute_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dispute_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add CHECK constraint for dispute_status valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint pc
    WHERE pc.conname = 'trades_dispute_status_check'
      AND pc.conrelid = 'public.trades'::regclass
  ) THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_dispute_status_check
      CHECK (dispute_status IN ('none', 'reported', 'under_review', 'resolved'));
  END IF;
END $$;

COMMENT ON COLUMN public.trades.dispute_status IS 'Dispute overlay: none | reported | under_review | resolved. Trade status remains in_progress while disputed.';
COMMENT ON COLUMN public.trades.dispute_opened_at IS 'When the buyer first reported the dispute';
COMMENT ON COLUMN public.trades.dispute_resolved_at IS 'When an admin resolved the dispute';
COMMENT ON COLUMN public.trades.dispute_resolved_by IS 'Admin user ID who resolved the dispute';

-- Verification query
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'trades' AND column_name LIKE 'dispute%'
-- ORDER BY ordinal_position;
