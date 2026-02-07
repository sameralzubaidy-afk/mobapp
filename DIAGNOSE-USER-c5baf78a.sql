-- Diagnostic queries for user: c5baf78a-4da3-4e43-aa6f-97e9d7292ea0
-- Email: bob.demo744@example.com
-- Referral code used: 7717c60b

-- =============================================================================
-- STEP 1: Check if debug_logs table exists and has entries
-- =============================================================================
SELECT COUNT(*) as log_count
FROM public.debug_logs
WHERE user_id = 'c5baf78a-4da3-4e43-aa6f-97e9d7292ea0';

-- If 0: The logging migration didn't run or the trigger isn't using the logging version
-- If >0: Continue to next step

-- =============================================================================
-- STEP 2: Check ALL debug logs for this user (see execution flow)
-- =============================================================================
SELECT 
  created_at,
  process_name,
  message,
  payload,
  error_message
FROM public.debug_logs
WHERE user_id = 'c5baf78a-4da3-4e43-aa6f-97e9d7292ea0'
ORDER BY created_at ASC;

-- Expected sequence if working correctly:
-- 1. handle_new_user: Trigger started
-- 2. handle_new_user: Extracted metadata (should show referral_input = '7717c60b')
-- 3. create_referral_code: Starting
-- 4. create_referral_code: Generated code
-- 5. create_referral_code: Inserted into referral_codes
-- 6. handle_new_user: Created referral code
-- 7. handle_new_user: Inserted profile
-- 8. apply_referral_code: Starting
-- 9. apply_referral_code: Found referrer
-- 10. apply_referral_code: Updated profiles.referred_by
-- 11. apply_referral_code: Inserted into referrals
-- 12. handle_new_user: Applied referral code
-- 13. handle_new_user: Trigger completed successfully

-- =============================================================================
-- STEP 3: Check auth.users metadata (was referral code passed?)
-- =============================================================================
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data
FROM auth.users
WHERE id = 'c5baf78a-4da3-4e43-aa6f-97e9d7292ea0';

-- Look for keys: referral_code, referralCode, referrer_code, referrerCode
-- The trigger checks all these variants

-- =============================================================================
-- STEP 4: Verify referral code 7717c60b exists and is valid
-- =============================================================================
SELECT 
  rc.id,
  rc.user_id,
  rc.code,
  au.email as referrer_email,
  rc.created_at
FROM public.referral_codes rc
JOIN auth.users au ON au.id = rc.user_id
WHERE LOWER(rc.code) = '7717c60b';

-- Expected: Should return 1 row with a valid user
-- If empty: The code doesn't exist (invalid code)

-- =============================================================================
-- STEP 5: Check if referral_codes has entry for NEW user
-- =============================================================================
SELECT 
  rc.id,
  rc.user_id,
  rc.code,
  rc.created_at
FROM public.referral_codes rc
WHERE rc.user_id = 'c5baf78a-4da3-4e43-aa6f-97e9d7292ea0';

-- Expected: Should have a row with new user's own referral code
-- If missing: create_referral_code() failed

-- =============================================================================
-- STEP 6: Check if referrals table has entry
-- =============================================================================
SELECT 
  r.id,
  r.referrer_user_id,
  r.referred_user_id,
  r.referral_code,
  r.status,
  r.created_at
FROM public.referrals r
WHERE r.referred_user_id = 'c5baf78a-4da3-4e43-aa6f-97e9d7292ea0';

-- Expected: Should have a row with status='pending' if referral code was valid
-- If missing: apply_referral_code() failed or wasn't called

-- =============================================================================
-- STEP 7: Check current profile state
-- =============================================================================
SELECT 
  user_id,
  name,
  email,
  referral_code,
  referred_by,
  created_at,
  updated_at
FROM public.profiles
WHERE user_id = 'c5baf78a-4da3-4e43-aa6f-97e9d7292ea0';

-- Current state (from your report):
-- referral_code: NULL
-- referred_by: NULL
-- created_at: 2026-02-04 12:06:44.424124+00
-- updated_at: 2026-02-04 12:07:06.222141+00
-- 
-- Notice: updated_at is 22 seconds after created_at
-- This suggests the mobile app called setupUserProfile() and overwrote the fields!

-- =============================================================================
-- STEP 8: Check which version of handle_new_user is active
-- =============================================================================
SELECT 
  p.proname,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname = 'handle_new_user';

-- Check if the function includes calls to log_debug()
-- If it does: the logging version is active
-- If not: the old version is still active

-- =============================================================================
-- STEP 9: Check if trigger is attached and enabled
-- =============================================================================
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  tgrelid::regclass AS table_name,
  tgfoid::regproc AS function_name
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Expected: enabled = 'O' (origin/always enabled)

-- =============================================================================
-- DIAGNOSIS SUMMARY
-- =============================================================================
-- Based on the 22-second delay between created_at and updated_at:
-- 
-- LIKELY CAUSE: The mobile app is still running OLD CODE that overwrites 
-- referral_code and referred_by to NULL during onboarding.
--
-- The database trigger correctly sets the fields, but then the app 
-- calls setupUserProfile() which uses .upsert() without preserving them.
--
-- SOLUTION: Deploy the mobile app fix from profile.ts
-- The fix fetches existing referral fields before upserting to preserve them.
--
-- ALTERNATE CHECK: If debug_logs is empty, the logging migration didn't 
-- actually run or the old trigger version is still active.
