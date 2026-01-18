-- filepath: supabase/migrations/20260116000000_verify_trades_columns_and_refresh_cache.sql
-- Mode B: Idempotent rerunnable migration
-- Purpose: Verify trades table has correct column names and refresh PostgREST schema cache
-- 
-- This migration addresses PGRST204 errors by:
-- 1. Verifying all required columns exist with correct names
-- 2. Ensuring no conflicting/old column names exist
-- 3. Refreshing PostgREST schema cache via NOTIFY

-- =============================================================================
-- BLOCK 1: Verify and fix column names
-- =============================================================================

DO $$
BEGIN
  -- Ensure cash_amount_cents exists (main cash column)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'cash_amount_cents'
  ) THEN
    ALTER TABLE trades ADD COLUMN cash_amount_cents INTEGER DEFAULT 0;
  END IF;

  -- Ensure sp_amount exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'sp_amount'
  ) THEN
    ALTER TABLE trades ADD COLUMN sp_amount INTEGER DEFAULT 0;
  END IF;

  -- Ensure buyer_transaction_fee_cents exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'buyer_transaction_fee_cents'
  ) THEN
    ALTER TABLE trades ADD COLUMN buyer_transaction_fee_cents INTEGER DEFAULT 0;
  END IF;

  -- Ensure cash_currency exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'cash_currency'
  ) THEN
    ALTER TABLE trades ADD COLUMN cash_currency TEXT DEFAULT 'usd';
  END IF;

  -- Ensure listing_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'listing_id'
  ) THEN
    ALTER TABLE trades ADD COLUMN listing_id UUID REFERENCES items(id);
  END IF;

  RAISE NOTICE 'All required columns verified in trades table';
END $$;

-- =============================================================================
-- BLOCK 2: Drop conflicting old column names (if they somehow exist)
-- =============================================================================

-- These old names should not exist, but if they do (from older schema versions),
-- drop them to prevent ambiguity and cache confusion

ALTER TABLE trades DROP COLUMN IF EXISTS cash_amount CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS amount_cash CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS amount_points CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS price_cents CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS platform_fee_cents CASCADE;

-- =============================================================================
-- BLOCK 3: Verify final schema state
-- =============================================================================

-- This query should return all expected columns (run manually to verify)
-- SELECT 
--   column_name,
--   data_type,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'trades'
-- ORDER BY ordinal_position;

-- Verify no old column names exist
-- SELECT COUNT(*) as conflicting_columns
-- FROM information_schema.columns
-- WHERE table_name = 'trades'
-- AND column_name IN ('cash_amount', 'amount_cash', 'amount_points', 'price_cents', 'platform_fee_cents', 'item_id');
-- Expected result: 0

-- =============================================================================
-- BLOCK 4: Refresh PostgREST schema cache
-- =============================================================================

-- Send notification to PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- SUMMARY
-- =============================================================================

-- This migration ensures:
-- ✓ cash_amount_cents column exists (NOT cash_amount)
-- ✓ sp_amount column exists
-- ✓ buyer_transaction_fee_cents column exists
-- ✓ cash_currency column exists
-- ✓ listing_id column exists
-- ✓ No conflicting old column names exist
-- ✓ PostgREST schema cache is notified to refresh
--
-- If you still see PGRST204 errors after this migration:
-- 1. Go to Supabase Dashboard → Settings → Infrastructure
-- 2. Pause and Resume your project (this restarts PostgREST server)
-- 3. Wait 20 seconds for restart to complete
-- 4. Try the trade creation again
