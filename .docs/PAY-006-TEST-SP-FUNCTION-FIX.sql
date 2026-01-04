-- PAY-006: Test SP Function Fix
-- Run this after applying migration 078 to verify the earn_sp_for_trade function call is fixed

-- Test 1: Verify earn_sp_for_trade function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'earn_sp_for_trade';

-- Expected: 1 row with earn_sp_for_trade

-- Test 2: Verify complete_trade_v2 function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'complete_trade_v2';

-- Expected: 1 row with complete_trade_v2

-- Test 3: Check if we have a test trade to work with
SELECT id, status, seller_id, buyer_id, sp_amount, cash_amount_cents
FROM trades
WHERE status = 'in_progress'
LIMIT 1;

-- If no test trade exists, create one for testing:
-- INSERT INTO trades (listing_id, buyer_id, seller_id, status, sp_amount, cash_amount_cents, item_price_cents)
-- VALUES ('test-listing-id', 'test-buyer-id', 'test-seller-id', 'in_progress', 10, 500, 1000);

-- Test 4: Test earn_sp_for_trade function directly (replace with real user/trade IDs)
-- SELECT earn_sp_for_trade('user-id-here', 'trade-id-here', 10);

-- Expected: {"success": true, "ledger_entry_id": "...", "balance_after": ...}

-- Test 4b: Calling earn_sp_for_trade with 0 points should return a failure result (no batch created)
-- SELECT earn_sp_for_trade('user-id-here', 'trade-id-here', 0);
-- Expected: {"success": false, "error": "Invalid SP points amount"}

-- Test 5: Test complete_trade_v2 function directly (replace with real IDs)
-- SELECT complete_trade_v2('trade-id-here', 'user-id-here');

-- Expected: {"success": true, "trade_id": "...", "message": "Trade completed successfully", ...}