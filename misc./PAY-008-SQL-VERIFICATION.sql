/**
 * SQL Verification for PAY-008
 * Run these queries in Supabase SQL Editor BEFORE manual testing
 */

-- =============================================================================
-- STEP 1: Verify Tables Exist
-- =============================================================================

-- Check if seller_payout_methods table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'seller_payout_methods'
) as payout_methods_exists;

-- Check if seller_payouts table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'seller_payouts'
) as payouts_exists;


-- =============================================================================
-- STEP 2: Verify Data Exists
-- =============================================================================

-- Count total payouts
SELECT 
    COUNT(*) as total_payouts,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN status = 'requires_action' THEN 1 ELSE 0 END) as requires_action
FROM seller_payouts;


-- =============================================================================
-- STEP 3: Check Sample Payouts
-- =============================================================================

-- Get last 5 payouts with user info
SELECT 
    sp.id,
    sp.user_id,
    u.email as seller_email,
    sp.status,
    sp.net_amount_cents / 100.0 as net_amount_usd,
    sp.provider,
    sp.created_at
FROM seller_payouts sp
LEFT JOIN auth.users u ON u.id = sp.user_id
ORDER BY sp.created_at DESC
LIMIT 5;


-- =============================================================================
-- STEP 4: Verify RLS Policies
-- =============================================================================

-- Check if RLS is enabled on seller_payouts
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'seller_payouts';


-- =============================================================================
-- STEP 5: Test Data Generation (IF NEEDED)
-- =============================================================================

-- If you have NO payouts, you can insert test data:
-- WARNING: Only run if you need test data

-- First, clean up any existing test data to avoid duplicate key errors
DELETE FROM seller_payouts WHERE idempotency_key LIKE 'test-%';

-- Get a test user ID first (replace with actual user ID from your database)
-- SELECT id, email FROM auth.users LIMIT 1;

-- Then insert test payouts (replace 'YOUR-USER-ID' with actual user ID)
INSERT INTO seller_payouts (
    user_id,
    trade_id,
    payout_method_id,
    currency,
    gross_amount_cents,
    platform_fee_cents,
    payout_fee_cents,
    net_amount_cents,
    status,
    provider,
    idempotency_key,
    created_at
) VALUES
    ('YOUR-USER-ID', NULL, NULL, 'usd', 5000, 0, 50, 4950, 'completed', 'stripe', 'test-1', NOW() - INTERVAL '5 days'),
    ('YOUR-USER-ID', NULL, NULL, 'usd', 3000, 0, 60, 2940, 'processing', 'paypal', 'test-2', NOW() - INTERVAL '3 days'),
    ('YOUR-USER-ID', NULL, NULL, 'usd', 2000, 0, 40, 1960, 'pending', 'paypal', 'test-3', NOW() - INTERVAL '1 day'),
    ('YOUR-USER-ID', NULL, NULL, 'usd', 1000, 0, 20, 980, 'failed', 'stripe', 'test-4', NOW()),
    ('YOUR-USER-ID', NULL, NULL, 'usd', 1500, 0, 0, 1500, 'requires_action', NULL, 'test-5', NOW());


-- =============================================================================
-- STEP 6: Verification Summary
-- =============================================================================

-- This query gives you a summary to confirm everything is ready
SELECT 
    'VERIFICATION SUMMARY' as check_type,
    (SELECT COUNT(*) FROM seller_payouts) as total_payouts,
    (SELECT COUNT(DISTINCT user_id) FROM seller_payouts) as unique_sellers,
    (SELECT COUNT(DISTINCT status) FROM seller_payouts) as status_variety,
    (SELECT SUM(net_amount_cents) / 100.0 FROM seller_payouts WHERE status = 'completed') as total_completed_usd;


-- =============================================================================
-- EXPECTED RESULTS FOR PAY-008 TESTING
-- =============================================================================

/*
For successful PAY-008 testing, you should have:

1. ✅ Both tables exist (payout_methods_exists = true, payouts_exists = true)
2. ✅ At least 5 payouts total
3. ✅ Payouts in at least 3 different statuses
4. ✅ At least 1 completed payout (to test earnings calculation)
5. ✅ At least 1 failed payout (to test retry functionality)
6. ✅ RLS enabled (rowsecurity = true)

If any of these are missing, follow the test data generation section above.
*/
