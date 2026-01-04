-- PAY-006: Test Admin Config & Payout Setup
-- Run this after applying ALL payout-related migrations to verify complete setup

-- =============================================================================
-- TEST 1: Verify Required Tables Exist
-- =============================================================================

-- Check payout tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('seller_payout_methods', 'seller_payouts', 'admin_config')
ORDER BY table_name;

-- Expected: 3 rows (seller_payout_methods, seller_payouts, admin_config)

-- =============================================================================
-- TEST 2: Verify Required Functions Exist
-- =============================================================================

-- Check payout functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_admin_payout_config',
  'calculate_payout_fee_cents',
  'create_seller_payout_on_trade_completion',
  'complete_trade_v2',
  'earn_sp_for_trade'
)
ORDER BY routine_name;

-- Expected: 5 rows

-- =============================================================================
-- TEST 3: Verify Admin Config Keys Exist
-- =============================================================================

-- Check payout config keys exist
SELECT key, value, description
FROM admin_config
WHERE key IN (
  'enable_automatic_seller_payout',
  'minimum_withdrawal_amount_cents',
  'payout_fee_stripe_fixed_cents',
  'payout_fee_stripe_percentage',
  'payout_fee_paypal_percentage',
  'payout_fee_paypal_cap_cents'
)
ORDER BY key;

-- Expected: 6 rows with proper values

-- =============================================================================
-- TEST 4: Test get_admin_payout_config Function
-- =============================================================================

-- Test the payout config function
SELECT * FROM get_admin_payout_config();

-- Expected: 1 row with non-null values:
-- enable_automatic_seller_payout: false
-- minimum_withdrawal_amount_cents: 500
-- stripe_payout_fee_fixed_cents: 25
-- stripe_payout_fee_percentage: 0.25
-- paypal_payout_fee_percentage: 2.0
-- paypal_payout_fee_cap_cents: 2000

-- =============================================================================
-- TEST 5: Test Fee Calculation Function
-- =============================================================================

-- Test Stripe fee calculation ($100 = $0.25 + 0.25%)
SELECT calculate_payout_fee_cents('stripe_connect', 10000);
-- Expected: 50 (25 fixed + 25 percentage)

-- Test PayPal fee calculation ($50 = 2%)
SELECT calculate_payout_fee_cents('paypal', 5000);
-- Expected: 100

-- Test PayPal cap ($2000 hits $20 cap)
SELECT calculate_payout_fee_cents('paypal', 200000);
-- Expected: 2000

-- =============================================================================
-- TEST 6: Test SP Function (if you have test users)
-- =============================================================================

-- Replace with real user/trade IDs if available
-- SELECT earn_sp_for_trade('user-id-here', 'trade-id-here', 10);
-- Expected: {"success": true, "ledger_entry_id": "...", "balance_after": ...}

-- =============================================================================
-- TEST 7: Test Complete Trade (if you have test data)
-- =============================================================================

-- Replace with real IDs if available
-- SELECT complete_trade_v2('trade-id-here', 'user-id-here');
-- Expected: {"success": true, "trade_id": "...", "message": "Trade completed successfully", ...}

-- =============================================================================
-- TROUBLESHOOTING CHECKLIST
-- =============================================================================

-- If any test fails, check these:

-- ❌ Tables missing: Run migrations 073, 20250113_create_admin_config.sql
-- ❌ Functions missing: Run migration 078
-- ❌ Config keys missing: Run migrations 074, 075, 077
-- ❌ Config function returns NULLs: Check key names match exactly
-- ❌ Fee calculation wrong: Check admin_config values
-- ❌ SP function fails: Check sp_wallets table exists (migration 061)
-- ❌ Complete trade fails: Check all dependencies above

-- =============================================================================
-- SUCCESS CRITERIA
-- =============================================================================

-- ✅ All tables exist
-- ✅ All functions exist
-- ✅ All config keys exist with proper values
-- ✅ get_admin_payout_config() returns valid config
-- ✅ calculate_payout_fee_cents() computes correct fees
-- ✅ earn_sp_for_trade() works (if test data available)
-- ✅ complete_trade_v2() works (if test data available)