-- filepath: VERIFY_TRADES_SCHEMA.sql
-- 
-- Purpose: Complete schema verification and diagnostic queries for PGRST204 errors
-- 
-- Usage: Copy and paste each block into Supabase SQL Editor and run
-- 
-- This file helps diagnose and fix:
-- - PGRST204: Could not find the 'cash_amount' column
-- - Schema cache stale issues
-- - Column name mismatches

-- ============================================================================
-- BLOCK 1: View All Trades Table Columns (PRIMARY DIAGNOSTIC)
-- ============================================================================
-- Run this FIRST to see what columns actually exist
-- 
-- Expected columns:
--   id (uuid) - primary key
--   buyer_id (uuid) - buyer reference
--   seller_id (uuid) - seller reference  
--   listing_id (uuid) - item reference
--   sp_amount (integer) - swap points used
--   cash_amount_cents (integer) - CRITICAL: NOT "cash_amount"
--   buyer_transaction_fee_cents (integer) - platform fee
--   cash_currency (text) - e.g., 'usd'
--   status (text) - trade state
--   ... and others

SELECT 
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'trades'
ORDER BY ordinal_position;

-- INTERPRETATION:
-- If you see a column called "cash_amount" (without _cents), that's OLD and needs to be dropped
-- If you DON'T see "cash_amount_cents", that's the problem - it needs to be added

-- ============================================================================
-- BLOCK 2: Check for Problematic Column Names
-- ============================================================================
-- Run this to find old/wrong column names that might conflict
-- 
-- Expected result: 0 rows (no bad columns should exist)

SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'trades'
AND column_name IN (
  'cash_amount',          -- Old name without _cents
  'amount_cash',          -- Wrong naming pattern
  'amount_points',        -- Wrong naming pattern
  'price_cents',          -- Very old name
  'platform_fee_cents',   -- Old name for fee
  'item_id',              -- Should be listing_id
  'swap_points_used'      -- Should be sp_amount
);

-- INTERPRETATION:
-- If you see ANY rows here, run BLOCK 7 to drop these columns

-- ============================================================================
-- BLOCK 3: Verify Critical Columns Exist
-- ============================================================================
-- Check that the most important columns exist

SELECT
  'cash_amount_cents' as column_name,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'cash_amount_cents') as exists_flag
UNION ALL
SELECT 'sp_amount', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'sp_amount')
UNION ALL
SELECT 'buyer_transaction_fee_cents', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'buyer_transaction_fee_cents')
UNION ALL
SELECT 'listing_id', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'listing_id')
UNION ALL
SELECT 'buyer_id', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'buyer_id')
UNION ALL
SELECT 'seller_id', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'seller_id')
UNION ALL
SELECT 'cash_currency', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'cash_currency');

-- INTERPRETATION:
-- All values should be 'true' (represented as 't')
-- If any is 'false', that column is missing and needs to be added

-- ============================================================================
-- BLOCK 4: View Trade Status Constraint
-- ============================================================================
-- Verify the valid status values

SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'trades'::regclass 
AND conname = 'trades_status_check';

-- INTERPRETATION:
-- Should show: CHECK (status IN ('pending', 'payment_processing', 'payment_failed', 'in_progress', 'completed', 'cancelled'))
-- If it shows old values like 'initiated', 'accepted', etc., schema is outdated

-- ============================================================================
-- BLOCK 5: Count Trades (Optional)
-- ============================================================================
-- Just to see if there are any trades in the database

SELECT COUNT(*) as total_trades FROM trades;

-- ============================================================================
-- BLOCK 6: Trigger POSTG REST Cache Refresh
-- ============================================================================
-- This notifies PostgREST to reload its schema cache
-- 
-- After running this, wait 5-10 seconds before retrying your app

NOTIFY pgrst, 'reload schema';

-- RESULT: You should see "NOTIFY 1" - this means the message was sent

-- ============================================================================
-- BLOCK 7: ADD MISSING COLUMNS (If needed)
-- ============================================================================
-- Run only if BLOCK 3 shows any FALSE values

-- Note: Run each ADD COLUMN separately if one fails
-- They're idempotent (won't fail if column already exists)

ALTER TABLE trades ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES items(id);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS sp_amount INTEGER DEFAULT 0;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS cash_amount_cents INTEGER DEFAULT 0;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS buyer_transaction_fee_cents INTEGER DEFAULT 0;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS cash_currency TEXT DEFAULT 'usd';

-- After adding columns:
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- BLOCK 8: DROP OLD/CONFLICTING COLUMNS (If found in BLOCK 2)
-- ============================================================================
-- Run only if BLOCK 2 showed any problematic columns

ALTER TABLE trades DROP COLUMN IF EXISTS cash_amount CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS amount_cash CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS amount_points CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS price_cents CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS platform_fee_cents CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS item_id CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS swap_points_used CASCADE;

-- After dropping columns:
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- BLOCK 9: Quick Test Insert (Optional - Advanced)
-- ============================================================================
-- This attempts to insert a minimal trade record to verify the schema works
-- 
-- WARNING: Only run this if you have test user IDs
-- Replace the UUID values with actual IDs from your users table

-- Uncomment and modify to test:
/*
INSERT INTO trades (
  buyer_id,
  seller_id, 
  listing_id,
  sp_amount,
  cash_amount_cents,
  buyer_transaction_fee_cents,
  cash_currency,
  status
) VALUES (
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid,  -- Replace with test buyer ID
  'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'::uuid,  -- Replace with test seller ID
  'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz'::uuid,  -- Replace with test listing ID
  500,      -- 500 swap points
  1500,     -- $15.00 in cents
  99,       -- $0.99 platform fee
  'usd',
  'pending'
);
*/

-- ============================================================================
-- BLOCK 10: Diagnostic Summary
-- ============================================================================
-- Run this at the END to get a summary of your schema state

WITH column_check AS (
  SELECT 
    COUNT(*) as total_columns,
    COUNT(CASE WHEN column_name IN ('cash_amount_cents', 'sp_amount', 'buyer_transaction_fee_cents', 'listing_id', 'buyer_id', 'seller_id', 'cash_currency', 'status') THEN 1 END) as critical_columns_present,
    COUNT(CASE WHEN column_name IN ('cash_amount', 'amount_cash', 'amount_points', 'item_id', 'swap_points_used') THEN 1 END) as bad_columns_present
  FROM information_schema.columns
  WHERE table_name = 'trades'
)
SELECT 
  'TRADES TABLE DIAGNOSTIC' as diagnostic,
  'PASS' as status
FROM column_check
WHERE critical_columns_present >= 8 AND bad_columns_present = 0

UNION ALL

SELECT 
  'TRADES TABLE DIAGNOSTIC' as diagnostic,
  'FAIL - Missing columns' as status
FROM column_check
WHERE critical_columns_present < 8

UNION ALL

SELECT 
  'TRADES TABLE DIAGNOSTIC' as diagnostic,
  'FAIL - Conflicting columns found' as status
FROM column_check
WHERE bad_columns_present > 0;

-- ============================================================================
-- DETAILED RECOMMENDATIONS
-- ============================================================================
-- 
-- If your diagnostic shows:
-- 
-- ✅ PASS:
--   Your schema is correct. The PGRST204 error is due to stale cache.
--   Solution: 
--     1. Go to Supabase Dashboard → Settings → Infrastructure
--     2. Pause your project (wait 10 seconds)
--     3. Resume your project (wait 20 seconds)
--     4. Try your app again
--
-- ❌ FAIL - Missing columns:
--   Run BLOCK 7 to add them
--   Then run BLOCK 6 or Pause/Resume project
--   Then run BLOCK 10 again to verify
--
-- ❌ FAIL - Conflicting columns:
--   Run BLOCK 8 to drop them
--   Then run BLOCK 6 or Pause/Resume project
--   Then run BLOCK 10 again to verify
--
-- Still failing after all above?
--   Contact Supabase support with screenshots of BLOCK 10 results
--
-- ============================================================================
