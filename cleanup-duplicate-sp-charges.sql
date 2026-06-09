-- ============================================================================
-- Cleanup Script: Remove Duplicate SP Charges (Double-Charge Bug Fix)
-- ============================================================================
-- 
-- Problem: Buyers were charged twice for SP purchases:
--   1. Once at offer creation (fn_reserve_sp_on_offer) ✅ CORRECT
--   2. Again at completion (fn_release_all_sp_on_complete) ❌ DUPLICATE
--
-- This script removes the duplicate completion-time entries from sp_ledger.
--
-- Safe to run multiple times (idempotent).
-- ============================================================================

BEGIN;

-- Step 1: Identify duplicate entries
-- ------------------------------------
-- Duplicates have:
--   - Same related_transaction_id (trade ID)
--   - Same user_id (buyer)
--   - transaction_type = 'spend_purchase'
--   - Two entries with different created_at timestamps
--   - Same negative amount

CREATE TEMP TABLE duplicate_entries AS
WITH ranked_entries AS (
  SELECT 
    sl.id,
    sl.wallet_id,
    sl.user_id,
    sl.related_transaction_id,
    sl.amount,
    sl.created_at,
    sl.description,
    -- Rank entries by created_at (earlier = 1, later = 2)
    ROW_NUMBER() OVER (
      PARTITION BY sl.user_id, sl.related_transaction_id 
      ORDER BY sl.created_at ASC
    ) as entry_rank,
    -- Count total entries for this trade + user
    COUNT(*) OVER (
      PARTITION BY sl.user_id, sl.related_transaction_id
    ) as entry_count
  FROM public.sp_ledger sl
  WHERE 
    sl.transaction_type = 'spend_purchase'
    AND sl.related_transaction_id IS NOT NULL
    AND sl.amount < 0
)
SELECT *
FROM ranked_entries
WHERE 
  entry_count > 1  -- Only trades with duplicate entries
  AND entry_rank = 2;  -- Keep first entry (reservation), delete second (completion)

-- Step 2: Show what will be deleted
-- -----------------------------------
SELECT 
  COUNT(*) as duplicate_count,
  SUM(ABS(amount)) as total_duplicate_sp
FROM duplicate_entries;

DO $$
DECLARE
  v_duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO v_duplicate_count FROM duplicate_entries;
  
  IF v_duplicate_count > 0 THEN
    RAISE NOTICE 'Found % duplicate SP charge entries to remove', v_duplicate_count;
  ELSE
    RAISE NOTICE 'No duplicate entries found - database is clean';
  END IF;
END $$;

-- Step 3: Delete duplicates
-- --------------------------
DELETE FROM public.sp_ledger
WHERE id IN (SELECT id FROM duplicate_entries);

-- Step 4: Verify cleanup
-- -----------------------
DO $$
DECLARE
  v_remaining_dupes integer;
BEGIN
  -- Check if any duplicates remain
  SELECT COUNT(*)
  INTO v_remaining_dupes
  FROM (
    SELECT 
      user_id, 
      related_transaction_id, 
      COUNT(*) as entry_count
    FROM public.sp_ledger
    WHERE 
      transaction_type = 'spend_purchase'
      AND related_transaction_id IS NOT NULL
      AND amount < 0
    GROUP BY user_id, related_transaction_id
    HAVING COUNT(*) > 1
  ) dupes;
  
  IF v_remaining_dupes = 0 THEN
    RAISE NOTICE '✅ Cleanup successful - no duplicate entries remain';
  ELSE
    RAISE WARNING '⚠️  Still found % trades with duplicate entries', v_remaining_dupes;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Verification Queries (Run AFTER cleanup)
-- ============================================================================

-- 1. Check for any remaining duplicates
SELECT 
  user_id,
  related_transaction_id,
  COUNT(*) as entry_count,
  STRING_AGG(created_at::text, ', ' ORDER BY created_at) as timestamps
FROM public.sp_ledger
WHERE 
  transaction_type = 'spend_purchase'
  AND related_transaction_id IS NOT NULL
  AND amount < 0
GROUP BY user_id, related_transaction_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)

-- 2. Verify spend_purchase entries match completed trades 1:1
SELECT 
  COUNT(DISTINCT t.id) as completed_trades_with_sp,
  COUNT(sl.id) as spend_purchase_entries,
  COUNT(DISTINCT t.id) - COUNT(sl.id) as difference
FROM public.trades t
LEFT JOIN public.sp_ledger sl ON (
  sl.related_transaction_id = t.id 
  AND sl.transaction_type = 'spend_purchase'
  AND sl.user_id = t.buyer_id
)
WHERE 
  t.sp_amount > 0
  AND t.sp_reserved_at IS NOT NULL;
-- Expected: difference = 0 (1:1 mapping)

-- 3. Sample recent spend_purchase entries (should see only ONE per trade)
SELECT 
  sl.user_id,
  sl.related_transaction_id as trade_id,
  sl.amount,
  sl.description,
  sl.created_at,
  t.status as trade_status,
  t.sp_reserved_at,
  t.updated_at as trade_updated_at
FROM public.sp_ledger sl
JOIN public.trades t ON t.id = sl.related_transaction_id
WHERE 
  sl.transaction_type = 'spend_purchase'
  AND sl.created_at > NOW() - INTERVAL '7 days'
ORDER BY sl.created_at DESC
LIMIT 20;
-- Verify: Each trade_id appears only ONCE
