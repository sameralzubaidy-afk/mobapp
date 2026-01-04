-- ================================================================
-- CRITICAL VALIDATION: Verify all complete_trade_v2 fields exist
-- ================================================================
-- Run this query to ensure migration 078 will work correctly

-- Check all required trade fields
SELECT 'FIELD VERIFICATION' as test;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trades'
  AND column_name IN (
    'id',
    'buyer_id',
    'seller_id', 
    'listing_id',
    'status',
    'cash_amount_cents',
    'item_price_cents',
    'completed_at',
    'last_status_change_at',
    'seller_marked_completed_at'
  )
ORDER BY column_name;

-- Expected: Should return all 10 columns (all required by complete_trade_v2)

-- If any column is MISSING, the migration 078 will fail
-- Common issues:
-- - 'listing_id' doesn't exist → use correct field name
-- - 'seller_marked_completed_at' doesn't exist → migration 066 not applied
-- - 'item_price_cents' doesn't exist → need to verify name

-- ================================================================
-- Check items table structure
-- ================================================================

SELECT 'ITEMS TABLE STRUCTURE' as test;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'items'
  AND column_name IN ('id', 'status')
ORDER BY column_name;

-- Expected: Should have 'id' and 'status' columns
-- Status should be: draft, available, pending, sold, deleted, paused

-- ================================================================
-- Verify item status constraint
-- ================================================================

SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'items_status_check';

-- Expected check_clause should include: 'available' as valid value

-- ================================================================
-- If all checks pass, you can safely apply migration 078
-- ================================================================
