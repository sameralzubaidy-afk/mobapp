-- ================================================================
-- Quick Verification Script for PAY-001
-- Run this in Supabase SQL Editor AFTER applying migration 073
-- ================================================================

-- =============================================================================
-- STEP 1: Verify Tables Exist
-- =============================================================================
SELECT 'STEP 1: Tables' as test_step, 
       COUNT(*) as expected_2,
       string_agg(table_name, ', ') as tables_found
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('seller_payout_methods', 'seller_payouts');

-- Expected: expected_2 = 2, tables_found = 'seller_payout_methods, seller_payouts'

-- =============================================================================
-- STEP 2: Verify seller_payout_methods Columns (should be 17)
-- =============================================================================
SELECT 'STEP 2: Payout Methods Columns' as test_step,
       COUNT(*) as expected_17
FROM information_schema.columns 
WHERE table_name = 'seller_payout_methods';

-- Expected: expected_17 = 17

-- =============================================================================
-- STEP 3: Verify seller_payouts Columns (should be 18)
-- =============================================================================
SELECT 'STEP 3: Payouts Columns' as test_step,
       COUNT(*) as expected_18
FROM information_schema.columns 
WHERE table_name = 'seller_payouts';

-- Expected: expected_18 = 18

-- =============================================================================
-- STEP 4: Verify Indexes Created
-- =============================================================================
SELECT 'STEP 4: Indexes' as test_step,
       tablename,
       COUNT(*) as index_count
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('seller_payout_methods', 'seller_payouts')
GROUP BY tablename
ORDER BY tablename;

-- Expected: 
-- seller_payout_methods: 5 indexes (pkey + 4 custom)
-- seller_payouts: 8 indexes (pkey + 7 custom)

-- =============================================================================
-- STEP 5: Verify RLS Enabled
-- =============================================================================
SELECT 'STEP 5: RLS Enabled' as test_step,
       tablename, 
       rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('seller_payout_methods', 'seller_payouts');

-- Expected: Both tables should have rowsecurity = true

-- =============================================================================
-- STEP 6: Count RLS Policies
-- =============================================================================
SELECT 'STEP 6: RLS Policies' as test_step,
       tablename,
       COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('seller_payout_methods', 'seller_payouts')
GROUP BY tablename
ORDER BY tablename;

-- Expected:
-- seller_payout_methods: 5 policies
-- seller_payouts: 4 policies

-- =============================================================================
-- STEP 7: Verify Constraints
-- =============================================================================
SELECT 'STEP 7: Constraints' as test_step,
       conrelid::regclass as table_name,
       conname as constraint_name,
       contype as constraint_type
FROM pg_constraint 
WHERE conrelid IN ('seller_payout_methods'::regclass, 'seller_payouts'::regclass)
AND contype IN ('c', 'f', 'p', 'u')  -- check, foreign key, primary key, unique
ORDER BY table_name, constraint_type, conname;

-- Expected constraints:
-- seller_payout_methods:
--   - PRIMARY KEY (pkey)
--   - UNIQUE (one_primary_idx)
--   - CHECK (stripe_fields_required_for_stripe)
--   - CHECK (paypal_email_required_for_paypal)
--   - CHECK (venmo_contact_required_for_venmo)
--   - FOREIGN KEY (user_id -> auth.users)
-- seller_payouts:
--   - PRIMARY KEY (pkey)
--   - UNIQUE (idempotency_key_idx)
--   - CHECK (status values)
--   - CHECK (net_amount_calculation_valid)
--   - CHECK (non-negative amounts x4)
--   - FOREIGN KEY (user_id -> auth.users)
--   - FOREIGN KEY (trade_id -> trades)
--   - FOREIGN KEY (payout_method_id -> seller_payout_methods)

-- =============================================================================
-- STEP 8: Verify Triggers
-- =============================================================================
SELECT 'STEP 8: Triggers' as test_step,
       trigger_name,
       event_object_table,
       action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table IN ('seller_payout_methods', 'seller_payouts')
AND trigger_name LIKE '%updated_at%';

-- Expected: 2 triggers (one per table) calling update_updated_at_column()

-- =============================================================================
-- STEP 9: Test Insert (should succeed)
-- =============================================================================
-- Replace YOUR_USER_ID with your actual auth user ID
-- Get your ID with: SELECT id FROM auth.users WHERE email = 'your-email@example.com';

/*
BEGIN;

INSERT INTO seller_payout_methods (
  user_id,
  method_type,
  is_primary,
  is_verified,
  stripe_account_id
) VALUES (
  'YOUR_USER_ID',  -- REPLACE THIS
  'stripe_connect',
  true,
  false,
  'acct_verify_test'
) RETURNING id, method_type, is_primary, created_at;

-- Should return 1 row with generated UUID

ROLLBACK;  -- Don't commit test data
*/

-- =============================================================================
-- STEP 10: Test One-Primary Constraint (should fail on second insert)
-- =============================================================================
-- Only run if you want to test constraint enforcement

/*
BEGIN;

-- First insert (should succeed)
INSERT INTO seller_payout_methods (
  user_id,
  method_type,
  is_primary,
  stripe_account_id
) VALUES (
  'YOUR_USER_ID',
  'stripe_connect',
  true,
  'acct_test_1'
);

-- Second insert with same user + is_primary=true (should FAIL)
INSERT INTO seller_payout_methods (
  user_id,
  method_type,
  is_primary,
  paypal_email
) VALUES (
  'YOUR_USER_ID',
  'paypal',
  true,
  'test@example.com'
);

ROLLBACK;
*/

-- =============================================================================
-- SUMMARY: All Checks
-- =============================================================================
SELECT '✅ VERIFICATION COMPLETE' as status,
       'If all steps returned expected results, PAY-001 is ready!' as message;

-- Next steps:
-- 1. Review each test result above
-- 2. If any failures, check migration log for errors
-- 3. If all pass, mark PAY-001 as COMPLETE in verification checklist
-- 4. Proceed to manual testing guide (PAY-001-MANUAL-TEST-GUIDE.md)
