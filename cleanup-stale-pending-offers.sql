-- ==========================================================================
-- Cleanup stale pending offers for test-buyer@kidsmarketplace.test
-- Run this in Supabase SQL Editor (Staging DB)
-- ==========================================================================
-- Mode: One-time cleanup (NOT a migration)
-- Target buyer UUID: 49243010-f458-4744-add1-a6c84ab95f1f
-- ==========================================================================

-- STEP 1: Check how many stale pending trades exist
SELECT id, listing_id, status, created_at, offer_expires_at, cancellation_reason
FROM public.trades
WHERE buyer_id = '49243010-f458-4744-add1-a6c84ab95f1f'
  AND status = 'pending'
ORDER BY created_at DESC;

-- STEP 2: If the above returns 3+ rows, cancel them:
-- This marks them as cancelled so the MAX_PENDING_OFFERS check passes
UPDATE public.trades
SET
  status = 'cancelled',
  cancelled_at = now(),
  cancellation_reason = 'Cleaned up stale pending offers for testing',
  updated_at = now(),
  last_status_change_at = now()
WHERE buyer_id = '49243010-f458-4744-add1-a6c84ab95f1f'
  AND status = 'pending';

-- STEP 3: Verify cleanup
SELECT id, status, cancelled_at, cancellation_reason
FROM public.trades
WHERE buyer_id = '49243010-f458-4744-add1-a6c84ab95f1f'
  AND status = 'cancelled'
ORDER BY cancelled_at DESC;
