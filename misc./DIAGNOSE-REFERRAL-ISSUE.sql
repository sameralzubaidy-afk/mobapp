-- Diagnostic queries for referral attribution failure
-- Run these queries to understand what happened during the failed signup
-- User ID from report: cb7e018b-ca9b-422a-8f1a-27d40f24c37d

-- =============================================================================
-- STEP 1: Check if trigger exists and is enabled
-- =============================================================================
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  tgrelid::regclass AS table_name,
  tgfoid::regproc AS function_name
FROM pg_trigger 
WHERE tgname IN ('on_auth_user_created', 'on_auth_user_updated')
ORDER BY tgname;

-- Expected: Both triggers should exist and be enabled (tgenabled = 'O' for origin)

-- =============================================================================
-- STEP 2: Check auth.users metadata for the failed signup
-- =============================================================================
SELECT 
  id,
  email,
  phone,
  raw_user_meta_data,
  created_at
FROM auth.users
WHERE id = 'cb7e018b-ca9b-422a-8f1a-27d40f24c37d';

-- Check what metadata keys were present at signup
-- Look for: referral_code, referralCode, referrer_code, referrerCode

-- =============================================================================
-- STEP 3: Check if referral_codes table has entry for this user
-- =============================================================================
SELECT 
  rc.id,
  rc.user_id,
  rc.code,
  rc.created_at
FROM public.referral_codes rc
WHERE rc.user_id = 'cb7e018b-ca9b-422a-8f1a-27d40f24c37d';

-- Expected: Should have a row with an 8-character code
-- If missing: create_referral_code() failed silently

-- =============================================================================
-- STEP 4: Check if referrals table has entry (if referral code was provided)
-- =============================================================================
SELECT 
  r.id,
  r.referrer_user_id,
  r.referred_user_id,
  r.referral_code,
  r.status,
  r.created_at
FROM public.referrals r
WHERE r.referred_user_id = 'cb7e018b-ca9b-422a-8f1a-27d40f24c37d';

-- Expected: If a valid referral code was provided at signup, should have a row
-- If missing: apply_referral_code() failed or wasn't called

-- =============================================================================
-- STEP 5: Check profiles table current state
-- =============================================================================
SELECT 
  p.user_id,
  p.name,
  p.email,
  p.referral_code,
  p.referred_by,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.user_id = 'cb7e018b-ca9b-422a-8f1a-27d40f24c37d';

-- Current state shows both referral_code and referred_by as NULL

-- =============================================================================
-- STEP 6: Check if there are valid referral codes in the system
-- =============================================================================
SELECT 
  rc.user_id,
  rc.code,
  au.email,
  rc.created_at
FROM public.referral_codes rc
JOIN auth.users au ON au.id = rc.user_id
ORDER BY rc.created_at DESC
LIMIT 10;

-- Shows recent referral codes that should be valid for testing

-- =============================================================================
-- STEP 7: Test create_referral_code() function directly
-- =============================================================================
-- Uncomment to test with a different user_id (don't reuse the failed one)
-- SELECT public.create_referral_code('cb7e018b-ca9b-422a-8f1a-27d40f24c37d');

-- Expected: Returns JSONB with 'code' field
-- If errors: Function has a bug

-- =============================================================================
-- STEP 8: Check Postgres logs for warnings
-- =============================================================================
-- The trigger uses RAISE WARNING on failures
-- Check your Supabase logs for entries like:
-- "Referral code creation failed for user"
-- "Referral code apply failed for user"
-- "handle_new_user failed for user"

-- =============================================================================
-- DIAGNOSIS SUMMARY
-- =============================================================================
-- Based on the results above:
--
-- 1. If trigger doesn't exist → triggers weren't created
-- 2. If trigger exists but referral_codes table is empty → create_referral_code() failed
-- 3. If referral_codes has entry but profiles.referral_code is NULL → profile wasn't updated
-- 4. If metadata shows referral code but referrals table is empty → apply_referral_code() failed
-- 5. If everything looks correct but profile is NULL → profile was updated by app after trigger
