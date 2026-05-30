-- ============================================================================
-- FILE: TRADE-V2-010-PRE-TEST-SETUP.sql
-- MODULE-06 TRADE-V2-010: Pre-Testing SQL Setup
--
-- PURPOSE: Set up test data required for running unit/E2E/manual tests
--
-- INSTRUCTIONS:
-- 1. Run this script in Supabase SQL Editor BEFORE running tests
-- 2. Update user_id values with your actual test user IDs from auth.users
-- 3. Verify all INSERT statements succeed
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify Admin Config Exists
-- ============================================================================

-- Check current admin config
SELECT * FROM admin_config LIMIT 1;

-- Create or update admin config with SP cap
INSERT INTO admin_config (
  id,
  sp_max_percentage_per_purchase,
  free_trial_days,
  created_at,
  updated_at
)
VALUES (
  'default',
  50, -- 50% SP cap per purchase
  30, -- 30-day trial (optional)
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET 
  sp_max_percentage_per_purchase = 50,
  updated_at = NOW();

-- Verify
SELECT id, sp_max_percentage_per_purchase FROM admin_config;

-- ============================================================================
-- STEP 2: Create/Update Test Users and Subscriptions
-- ============================================================================

-- IMPORTANT: Replace these user_ids with actual IDs from your auth.users table
-- Run this query first to get your test user IDs:
-- SELECT id, email FROM auth.users WHERE email LIKE '%test%' ORDER BY created_at DESC;

-- Subscriber Buyer (active subscription with SP)
INSERT INTO subscriptions (
  user_id, 
  status, 
  subscription_expires_at,
  stripe_customer_id,
  created_at,
  updated_at
)
VALUES (
  'REPLACE_WITH_SUBSCRIBER_BUYER_USER_ID', -- ⚠️ REPLACE THIS
  'active',
  NOW() + INTERVAL '30 days',
  'cus_test_subscriber_buyer',
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET 
  status = 'active',
  subscription_expires_at = NOW() + INTERVAL '30 days',
  updated_at = NOW();

-- Free User Buyer (no subscription)
INSERT INTO subscriptions (
  user_id,
  status,
  created_at,
  updated_at
)
VALUES (
  'REPLACE_WITH_FREE_BUYER_USER_ID', -- ⚠️ REPLACE THIS
  'free',
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET 
  status = 'free',
  updated_at = NOW();

-- Seller (active subscription for SP earning)
INSERT INTO subscriptions (
  user_id,
  status,
  subscription_expires_at,
  stripe_customer_id,
  created_at,
  updated_at
)
VALUES (
  'REPLACE_WITH_SELLER_USER_ID', -- ⚠️ REPLACE THIS
  'active',
  NOW() + INTERVAL '30 days',
  'cus_test_seller',
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET 
  status = 'active',
  subscription_expires_at = NOW() + INTERVAL '30 days',
  updated_at = NOW();

-- Verify subscriptions created
SELECT user_id, status, subscription_expires_at 
FROM subscriptions 
WHERE user_id IN (
  'REPLACE_WITH_SUBSCRIBER_BUYER_USER_ID',
  'REPLACE_WITH_FREE_BUYER_USER_ID',
  'REPLACE_WITH_SELLER_USER_ID'
);

-- ============================================================================
-- STEP 3: Grant Test SP to Subscriber Buyer
-- ============================================================================

-- Grant 100 SP to subscriber for testing
INSERT INTO sp_ledger (
  user_id,
  points_amount,
  source_type,
  source_id,
  description,
  created_at
)
VALUES (
  'REPLACE_WITH_SUBSCRIBER_BUYER_USER_ID', -- ⚠️ REPLACE THIS
  100,
  'admin_adjustment',
  NULL,
  'Test SP grant for TRADE-V2-010 testing',
  NOW()
)
RETURNING *;

-- Verify SP wallet balance
-- This RPC should exist from MODULE-09
SELECT * FROM sp_wallet 
WHERE user_id = 'REPLACE_WITH_SUBSCRIBER_BUYER_USER_ID';

-- If sp_wallet doesn't exist or needs refresh, you may need to call:
-- SELECT refresh_sp_wallet('REPLACE_WITH_SUBSCRIBER_BUYER_USER_ID');

-- ============================================================================
-- STEP 4: Create Test Node for Items
-- ============================================================================

INSERT INTO nodes (
  id,
  name,
  zipcode,
  city,
  state,
  status,
  max_members,
  created_at,
  updated_at
)
VALUES (
  'test-node-trade',
  'Test Node for Trade Testing',
  '12345',
  'Test City',
  'CA',
  'active',
  100,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET 
  status = 'active',
  updated_at = NOW();

-- Verify node created
SELECT id, name, status FROM nodes WHERE id = 'test-node-trade';

-- ============================================================================
-- STEP 5: Create Test Items for Trading
-- ============================================================================

-- Test Item 1: $25 item (allows 12 SP max at 50% cap)
INSERT INTO items (
  id,
  seller_id,
  title,
  description,
  price,
  status,
  node_id,
  accepts_swap_points,
  created_at,
  updated_at
)
VALUES (
  'test-item-trade-001',
  'REPLACE_WITH_SELLER_USER_ID', -- ⚠️ REPLACE THIS
  'Test Item $25',
  'Test item for trade testing - priced at $25',
  25.00,
  'available',
  'test-node-trade',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET 
  status = 'available',
  updated_at = NOW();

-- Test Item 2: $10 item (allows 5 SP max at 50% cap)
INSERT INTO items (
  id,
  seller_id,
  title,
  description,
  price,
  status,
  node_id,
  accepts_swap_points,
  created_at,
  updated_at
)
VALUES (
  'test-item-trade-002',
  'REPLACE_WITH_SELLER_USER_ID', -- ⚠️ REPLACE THIS
  'Test Item $10',
  'Test item for trade testing - priced at $10',
  10.00,
  'available',
  'test-node-trade',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET 
  status = 'available',
  updated_at = NOW();

-- Test Item 3: $50 item (allows 25 SP max at 50% cap)
INSERT INTO items (
  id,
  seller_id,
  title,
  description,
  price,
  status,
  node_id,
  accepts_swap_points,
  created_at,
  updated_at
)
VALUES (
  'test-item-trade-003',
  'REPLACE_WITH_SELLER_USER_ID', -- ⚠️ REPLACE THIS
  'Test Item $50',
  'Test item for trade testing - priced at $50',
  50.00,
  'available',
  'test-node-trade',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET 
  status = 'available',
  updated_at = NOW();

-- Verify items created
SELECT id, title, price, status, accepts_swap_points 
FROM items 
WHERE id LIKE 'test-item-trade-%'
ORDER BY price;

-- ============================================================================
-- STEP 6: Clean Up Old Test Trades (Optional)
-- ============================================================================

-- Optional: Delete old test trades to start fresh
-- DELETE FROM trades 
-- WHERE listing_id LIKE 'test-item-trade-%' 
-- AND created_at < NOW() - INTERVAL '1 day';

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================

-- Run these queries to verify setup:

-- 1. Admin config
SELECT 'Admin Config' AS check_type, COUNT(*) AS count, sp_max_percentage_per_purchase
FROM admin_config
GROUP BY sp_max_percentage_per_purchase;

-- 2. Test subscriptions
SELECT 'Subscriptions' AS check_type, status, COUNT(*) AS count
FROM subscriptions
WHERE user_id IN (
  'REPLACE_WITH_SUBSCRIBER_BUYER_USER_ID',
  'REPLACE_WITH_FREE_BUYER_USER_ID',
  'REPLACE_WITH_SELLER_USER_ID'
)
GROUP BY status;

-- 3. SP balances
SELECT 'SP Wallet' AS check_type, user_id, available_points
FROM sp_wallet
WHERE user_id = 'REPLACE_WITH_SUBSCRIBER_BUYER_USER_ID';

-- 4. Test items
SELECT 'Test Items' AS check_type, COUNT(*) AS count
FROM items
WHERE id LIKE 'test-item-trade-%' AND status = 'available';

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================

-- ✅ Admin config: sp_max_percentage_per_purchase = 50
-- ✅ Subscriptions: 
--    - 1 active (subscriber buyer)
--    - 1 free (free buyer)
--    - 1 active (seller)
-- ✅ SP Wallet: subscriber buyer has 100 available_points
-- ✅ Test Items: 3 items with status='available'

-- If all checks pass, you're ready to run tests! 🎉

-- ============================================================================
-- NOTES
-- ============================================================================

-- - Replace all REPLACE_WITH_*_USER_ID placeholders with actual user IDs
-- - To get user IDs: SELECT id, email FROM auth.users WHERE email LIKE '%test%';
-- - If sp_wallet doesn't auto-update, call: SELECT refresh_sp_wallet('user_id');
-- - Stripe configuration (STRIPE_SECRET_KEY) must be set in Edge Function secrets
-- - For manual testing, use iOS Simulator or Android Emulator

-- ============================================================================
-- END OF SETUP SCRIPT
-- ============================================================================
