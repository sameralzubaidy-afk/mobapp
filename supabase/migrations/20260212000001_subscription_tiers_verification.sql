-- File: supabase/migrations/20260212000001_subscription_tiers_verification.sql
-- MODULE-11 SUB-001: Verification queries for subscription_tiers schema

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- 1. Verify subscription_tiers table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'subscription_tiers'
ORDER BY ordinal_position;

-- 2. Verify subscription_features table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'subscription_features'
ORDER BY ordinal_position;

-- 3. Verify Kids Club+ tier was seeded correctly
SELECT 
  id,
  name,
  display_name,
  price_cents,
  trial_days,
  grace_period_days,
  is_active,
  is_default
FROM public.subscription_tiers
WHERE name = 'kids_club_plus';

-- Expected result:
-- name: 'kids_club_plus'
-- display_name: 'Kids Club+'
-- price_cents: 499
-- trial_days: 30
-- grace_period_days: 90
-- is_active: TRUE
-- is_default: TRUE

-- 4. Verify Kids Club+ features were seeded correctly
SELECT 
  sf.feature_key,
  sf.feature_name,
  sf.is_enabled,
  sf.sort_order
FROM public.subscription_features sf
JOIN public.subscription_tiers st ON st.id = sf.tier_id
WHERE st.name = 'kids_club_plus'
ORDER BY sf.sort_order;

-- Expected result: 7 features
-- can_earn_sp, can_spend_sp, can_donate, reduced_fee, priority_matching, early_access, priority_support

-- 5. Verify RLS is enabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('subscription_tiers', 'subscription_features');

-- Expected: Both tables should have rowsecurity = true

-- 6. Verify RLS policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('subscription_tiers', 'subscription_features')
ORDER BY tablename, policyname;

-- Expected: 4 policies total
-- - subscription_tiers: subscription_tiers_select_public, subscription_tiers_admin_all
-- - subscription_features: subscription_features_select_public, subscription_features_admin_all

-- 7. Verify indexes exist
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('subscription_tiers', 'subscription_features')
ORDER BY tablename, indexname;

-- Expected indexes:
-- subscription_tiers: idx_subscription_tiers_is_active, idx_subscription_tiers_is_default, idx_subscription_tiers_name
-- subscription_features: idx_subscription_features_tier_id, idx_subscription_features_is_enabled

-- 8. Verify triggers exist
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('subscription_tiers', 'subscription_features')
ORDER BY event_object_table, trigger_name;

-- Expected triggers:
-- update_subscription_tiers_updated_at on subscription_tiers
-- update_subscription_features_updated_at on subscription_features

-- =============================================================================
-- QUICK SMOKE TEST
-- =============================================================================

-- Test 1: Verify feature count for Kids Club+
DO $$
DECLARE
  v_feature_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_feature_count
  FROM public.subscription_features sf
  JOIN public.subscription_tiers st ON st.id = sf.tier_id
  WHERE st.name = 'kids_club_plus' AND sf.is_enabled = TRUE;
  
  IF v_feature_count != 7 THEN
    RAISE EXCEPTION 'Expected 7 features for Kids Club+, found %', v_feature_count;
  END IF;
  
  RAISE NOTICE 'SUCCESS: Kids Club+ has % enabled features', v_feature_count;
END $$;

-- Test 2: Verify price is $4.99
DO $$
DECLARE
  v_price_cents INTEGER;
BEGIN
  SELECT price_cents INTO v_price_cents
  FROM public.subscription_tiers
  WHERE name = 'kids_club_plus';
  
  IF v_price_cents != 499 THEN
    RAISE EXCEPTION 'Expected price_cents = 499, found %', v_price_cents;
  END IF;
  
  RAISE NOTICE 'SUCCESS: Kids Club+ price is $%.%% (% cents)', 
    v_price_cents / 100, 
    LPAD((v_price_cents % 100)::TEXT, 2, '0'),
    v_price_cents;
END $$;

-- Test 3: Verify trial period is 30 days
DO $$
DECLARE
  v_trial_days INTEGER;
BEGIN
  SELECT trial_days INTO v_trial_days
  FROM public.subscription_tiers
  WHERE name = 'kids_club_plus';
  
  IF v_trial_days != 30 THEN
    RAISE EXCEPTION 'Expected trial_days = 30, found %', v_trial_days;
  END IF;
  
  RAISE NOTICE 'SUCCESS: Kids Club+ trial period is % days', v_trial_days;
END $$;

-- Test 4: Verify grace period is 90 days
DO $$
DECLARE
  v_grace_days INTEGER;
BEGIN
  SELECT grace_period_days INTO v_grace_days
  FROM public.subscription_tiers
  WHERE name = 'kids_club_plus';
  
  IF v_grace_days != 90 THEN
    RAISE EXCEPTION 'Expected grace_period_days = 90, found %', v_grace_days;
  END IF;
  
  RAISE NOTICE 'SUCCESS: Kids Club+ grace period is % days', v_grace_days;
END $$;
