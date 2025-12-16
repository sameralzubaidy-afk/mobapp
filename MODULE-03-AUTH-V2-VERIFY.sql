-- MODULE-03 AUTH-V2: Verification Queries
-- Run these AFTER running the main setup SQL to confirm everything is installed correctly
-- =========================================================================

-- =========================================================================
-- 1. VERIFY TABLES EXIST
-- =========================================================================

-- Check if subscriptions table exists
SELECT 
  table_name,
  (SELECT COUNT(*) FROM subscriptions) as row_count,
  'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema='public' AND table_name='subscriptions'
UNION ALL
SELECT 
  table_name,
  (SELECT COUNT(*) FROM sp_wallets) as row_count,
  'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema='public' AND table_name='sp_wallets'
UNION ALL
SELECT 
  table_name,
  (SELECT COUNT(*) FROM admin_config) as row_count,
  'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema='public' AND table_name='admin_config';

-- Expected output:
-- subscriptions | 0 | EXISTS
-- sp_wallets    | 0 | EXISTS
-- admin_config  | 3 | EXISTS

-- =========================================================================
-- 2. VERIFY COLUMNS ADDED TO PROFILES
-- =========================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='profiles' AND column_name IN (
  'subscription_id', 'sp_wallet_id', 'onboarding_completed_at', 
  'parental_consent_verified', 'age'
)
ORDER BY column_name;

-- Expected output:
-- age                         | integer | YES
-- onboarding_completed_at     | timestamp with time zone | YES
-- parental_consent_verified   | boolean | YES
-- sp_wallet_id                | uuid | YES
-- subscription_id             | uuid | YES

-- =========================================================================
-- 3. VERIFY RPC FUNCTIONS EXIST
-- =========================================================================

SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema='public' 
  AND routine_type='FUNCTION'
  AND routine_name IN (
    'create_trial_subscription',
    'initialize_sp_wallet',
    'get_subscription_summary',
    'get_user_sp_wallet_summary',
    'is_trial_enabled',
    'get_trial_duration_days'
  )
ORDER BY routine_name;

-- Expected output (6 functions):
-- create_trial_subscription    | FUNCTION | subscriptions
-- get_admin_config             | FUNCTION | record
-- get_subscription_summary     | FUNCTION | record
-- get_trial_duration_days      | FUNCTION | integer
-- get_user_sp_wallet_summary   | FUNCTION | record
-- initialize_sp_wallet         | FUNCTION | sp_wallets
-- is_trial_enabled             | FUNCTION | boolean

-- =========================================================================
-- 4. VERIFY ADMIN_CONFIG DEFAULT VALUES
-- =========================================================================

SELECT 
  config_key,
  config_value as settings,
  enabled,
  created_at
FROM admin_config
ORDER BY config_key;

-- Expected output:
-- feature_flags       | {"apple_signin": true, ...} | true | [timestamp]
-- swap_points_config  | {"enabled": true, ...}      | true | [timestamp]
-- trial_subscription  | {"enabled": true, ...}      | true | [timestamp]

-- =========================================================================
-- 5. TEST: Call is_trial_enabled()
-- =========================================================================

SELECT is_trial_enabled() as trial_enabled;

-- Expected output:
-- trial_enabled | true

-- =========================================================================
-- 6. TEST: Call get_trial_duration_days()
-- =========================================================================

SELECT get_trial_duration_days() as duration_days;

-- Expected output:
-- duration_days | 30

-- =========================================================================
-- 7. VERIFY INDEXES CREATED
-- =========================================================================

SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname='public' 
  AND tablename IN ('subscriptions', 'sp_wallets', 'admin_config', 'profiles')
  AND indexname LIKE '%idx_%'
ORDER BY tablename, indexname;

-- Expected indexes:
-- idx_admin_config_enabled
-- idx_admin_config_key
-- idx_profiles_onboarding_completed_at
-- idx_profiles_sp_wallet_id
-- idx_profiles_subscription_id
-- idx_sp_wallets_status
-- idx_sp_wallets_user_id
-- idx_subscriptions_status
-- idx_subscriptions_stripe_customer_id
-- idx_subscriptions_user_id

-- =========================================================================
-- 8. VERIFY RLS POLICIES
-- =========================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual as policy_expression
FROM pg_policies
WHERE schemaname='public' 
  AND tablename IN ('subscriptions', 'sp_wallets', 'admin_config')
ORDER BY tablename, policyname;

-- Expected policies:
-- subscriptions:
--   - Users can view own subscription
--   - Users can insert own subscription
-- sp_wallets:
--   - Users can view own wallet
--   - Users can insert own wallet
-- admin_config:
--   - Admins can view config
--   - Admins can update config

-- =========================================================================
-- 9. CHECK CONSTRAINTS VERIFICATION
-- =========================================================================

SELECT 
  tablename,
  conname as constraint_name,
  contype as constraint_type,
  consrc as constraint_definition
FROM pg_constraint
WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
  AND tablename IN ('subscriptions', 'sp_wallets')
ORDER BY tablename, conname;

-- Expected constraints:
-- subscriptions: status CHECK
-- sp_wallets: status CHECK, balance checks (>= 0)

-- =========================================================================
-- 10. TRIGGERS VERIFICATION
-- =========================================================================

SELECT 
  trigger_name,
  event_object_table,
  event_manipulation,
  action_orientation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema='public'
  AND event_object_table IN ('subscriptions', 'sp_wallets', 'admin_config')
ORDER BY event_object_table, trigger_name;

-- Expected triggers (auto-update updated_at):
-- subscriptions_updated_at_trigger
-- sp_wallets_updated_at_trigger
-- admin_config_updated_at_trigger

-- =========================================================================
-- SUMMARY
-- =========================================================================
-- If all queries above return expected results, setup is complete!
--
-- Tables:        ✓ subscriptions, sp_wallets, admin_config
-- Columns:       ✓ 5 new columns added to profiles
-- Functions:     ✓ 6 RPC functions created
-- Configurations:✓ 3 default admin configs inserted
-- Indexes:       ✓ 10+ indexes created
-- RLS Policies:  ✓ Row-level security enabled
-- Triggers:      ✓ Auto-update triggers for updated_at
-- Constraints:   ✓ Check constraints on balances and status
--
-- ✅ SETUP VERIFIED - Ready for testing!
