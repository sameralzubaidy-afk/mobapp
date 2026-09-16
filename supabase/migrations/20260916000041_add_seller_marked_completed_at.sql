-- filepath: supabase/migrations/066_add_seller_marked_completed_at.sql

-- Mode B: Idempotent rerunnable migration
-- Add seller_marked_completed_at to track when seller claims trade is done.

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS seller_marked_completed_at TIMESTAMPTZ;

-- Verification query
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'seller_marked_completed_at';
