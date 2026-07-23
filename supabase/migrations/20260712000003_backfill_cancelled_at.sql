-- File: supabase/migrations/20260712000003_backfill_cancelled_at.sql
-- Mode B: Idempotent rerunnable migration
--
-- Backfill `cancelled_at` for trades where status = 'cancelled'
-- but `cancelled_at` is NULL (the seller_decline code path in
-- transactions-update EF was not setting this column).
--
-- Uses `updated_at` as the best available timestamp for when
-- the cancellation actually occurred.

UPDATE trades
SET cancelled_at = updated_at
WHERE status = 'cancelled'
  AND cancelled_at IS NULL;

-- Verification:
-- SELECT COUNT(*) FROM trades WHERE status = 'cancelled' AND cancelled_at IS NULL;
-- Expected: 0
