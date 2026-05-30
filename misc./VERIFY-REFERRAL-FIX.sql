-- Quick Fix Verification Script
-- Run this after applying the database migration and mobile app fixes

-- =============================================================================
-- STEP 1: Apply the logging migration
-- =============================================================================
-- Run the file: supabase/migrations/20260204000002_fix_referral_with_logging.sql
-- This adds debug logging to track execution flow

-- =============================================================================
-- STEP 2: Test with a NEW signup
-- =============================================================================
-- 1. Get a valid referral code from an existing user:
SELECT rc.code, au.email AS referrer_email
FROM public.referral_codes rc
JOIN auth.users au ON au.id = rc.user_id
ORDER BY rc.created_at DESC
LIMIT 5;

-- 2. Sign up a new test user with that referral code via the mobile app
--    (use the Signup screen with referral code field)

-- 3. Find the new user's ID:
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- =============================================================================
-- STEP 3: Check debug logs
-- =============================================================================
-- Replace <new_user_id> with the user ID from step 2:
SELECT 
  created_at,
  process_name,
  message,
  payload,
  error_message
FROM public.debug_logs
WHERE user_id = '<new_user_id>'
ORDER BY created_at ASC;

-- Expected log sequence:
-- 1. handle_new_user: Trigger started
-- 2. handle_new_user: Extracted metadata (should show referral_input)
-- 3. create_referral_code: Starting
-- 4. create_referral_code: Generated code
-- 5. create_referral_code: Inserted into referral_codes
-- 6. handle_new_user: Created referral code
-- 7. handle_new_user: Inserted profile
-- 8. apply_referral_code: Starting
-- 9. apply_referral_code: Found referrer
-- 10. apply_referral_code: Updated profiles.referred_by (rows_updated should be 1)
-- 11. apply_referral_code: Inserted into referrals
-- 12. handle_new_user: Applied referral code
-- 13. handle_new_user: Trigger completed successfully

-- =============================================================================
-- STEP 4: Verify profile has correct values BEFORE onboarding
-- =============================================================================
SELECT 
  user_id,
  name,
  referral_code,
  referred_by,
  profile_completed,
  onboarding_completed,
  created_at
FROM public.profiles
WHERE user_id = '<new_user_id>';

-- Expected at this point:
-- - referral_code: NOT NULL (8-char code)
-- - referred_by: NOT NULL (referrer's user_id)
-- - profile_completed: false
-- - onboarding_completed: false

-- =============================================================================
-- STEP 5: Complete onboarding in the app
-- =============================================================================
-- Go through the onboarding flow (location picker, etc.)
-- This calls setupUserProfile() which previously clobbered the fields

-- =============================================================================
-- STEP 6: Verify profile AFTER onboarding (THE CRITICAL TEST)
-- =============================================================================
SELECT 
  user_id,
  name,
  referral_code,
  referred_by,
  profile_completed,
  onboarding_completed,
  zip_code,
  node_id,
  created_at,
  updated_at
FROM public.profiles
WHERE user_id = '<new_user_id>';

-- Expected after onboarding:
-- - referral_code: STILL NOT NULL (preserved) ✅
-- - referred_by: STILL NOT NULL (preserved) ✅
-- - profile_completed: true
-- - onboarding_completed: true
-- - zip_code: populated
-- - node_id: populated

-- =============================================================================
-- STEP 7: Verify referrals table
-- =============================================================================
SELECT 
  r.id,
  r.referrer_user_id,
  r.referred_user_id,
  r.referral_code,
  r.status,
  r.created_at,
  au_referrer.email AS referrer_email,
  au_referee.email AS referee_email
FROM public.referrals r
JOIN auth.users au_referrer ON au_referrer.id = r.referrer_user_id
JOIN auth.users au_referee ON au_referee.id = r.referred_user_id
WHERE r.referred_user_id = '<new_user_id>';

-- Expected:
-- - One row with status = 'pending'
-- - referrer_user_id matches the original code owner
-- - referral_code matches what was entered

-- =============================================================================
-- STEP 8: Verify referral_codes table
-- =============================================================================
SELECT 
  rc.user_id,
  rc.code,
  au.email
FROM public.referral_codes rc
JOIN auth.users au ON au.id = rc.user_id
WHERE rc.user_id = '<new_user_id>';

-- Expected:
-- - One row with the new user's own referral code
-- - Code matches profiles.referral_code

-- =============================================================================
-- SUCCESS CRITERIA
-- =============================================================================
-- ✅ Debug logs show complete execution without errors
-- ✅ Profile has referral_code BEFORE and AFTER onboarding
-- ✅ Profile has referred_by BEFORE and AFTER onboarding
-- ✅ referrals table has pending row
-- ✅ referral_codes table has new user's code

-- =============================================================================
-- CLEANUP (optional - for repeated testing)
-- =============================================================================
-- To test again with a fresh user, you can delete the test user:
-- DELETE FROM auth.users WHERE email = 'test+referral@example.com';
-- (This will cascade delete profile, referral_codes, referrals via FK constraints)
