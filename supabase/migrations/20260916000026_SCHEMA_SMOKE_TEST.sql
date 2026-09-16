-- Schema Smoke Test for Admin User Management RPCs
-- Run this in Supabase SQL Editor BEFORE applying fixes
-- This verifies all referenced columns exist

-- ============================================
-- Test 1: Verify sp_wallets columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'sp_wallets'
ORDER BY ordinal_position;

-- Expected columns:
-- id, user_id, status, available_balance, pending_balance, lifetime_earned, lifetime_spent, last_activity_at, created_at, updated_at

-- ============================================
-- Test 2: Verify trades table columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'trades'
  AND column_name IN ('buyer_id', 'seller_id', 'status', 'completed_at')
ORDER BY ordinal_position;

-- Expected: buyer_id, seller_id, status, completed_at

-- ============================================
-- Test 3: Verify subscriptions columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'subscriptions'
  AND column_name IN ('user_id', 'status', 'tier_id', 'created_at', 'trial_end_date', 'current_period_end', 'cancelled_at')
ORDER BY ordinal_position;

-- Expected: tier_id (not tier), trial_end_date (not trial_ends_at)

-- ============================================
-- Test 4: Verify subscription_tiers columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'subscription_tiers'
  AND column_name IN ('id', 'name', 'display_name')
ORDER BY ordinal_position;

-- ============================================
-- Test 5: Verify profiles columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('id', 'user_id', 'name', 'avatar_url', 'date_of_birth', 'account_status', 'phone_verified', 'suspended_at', 'suspension_reason', 'deleted_at', 'created_at', 'updated_at', 'node_id')
ORDER BY ordinal_position;

-- ============================================
-- Test 6: Verify auth.users columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'auth' 
  AND table_name = 'users'
  AND column_name IN ('id', 'email', 'phone', 'email_confirmed_at', 'last_sign_in_at')
ORDER BY ordinal_position;

-- ============================================
-- Test 7: Verify user_badges columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_badges'
  AND column_name IN ('id', 'user_id', 'badge_id', 'awarded_at', 'revoked_at')
ORDER BY ordinal_position;

-- ============================================
-- Test 8: Verify badges columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'badges'
  AND column_name IN ('id', 'name', 'icon')
ORDER BY ordinal_position;

-- ============================================
-- Test 9: Verify sp_transactions columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'sp_transactions'
  AND column_name IN ('user_id', 'amount', 'transaction_type')
ORDER BY ordinal_position;

-- ============================================
-- Test 10: Verify admin_activity_log columns
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'admin_activity_log'
  AND column_name IN ('admin_id', 'action_type', 'entity_type', 'entity_id', 'notes', 'created_at')
ORDER BY ordinal_position;

-- ============================================
-- Summary Report
-- ============================================
SELECT 
  'All schema checks complete' AS status,
  'Review results above to identify missing columns' AS next_step;
