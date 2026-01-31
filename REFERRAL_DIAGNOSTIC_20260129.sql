-- REFERRAL_DIAGNOSTIC_20260129.sql
-- Diagnose referral system issues for new user signup
--
-- New user: 1984alice.test@example.com
-- user_id: 8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3
-- profile_id: f74b0b3d-cbb4-42ed-8bc4-15080a6ad75a
-- Expected: Should have referral_code generated and referred_by populated

-- =============================================================================
-- DIAGNOSTIC 1: Check if handle_new_user trigger exists and what it does
-- =============================================================================
SELECT 
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'handle_new_user';

-- =============================================================================
-- DIAGNOSTIC 2: Check all triggers on auth.users
-- =============================================================================
SELECT 
  t.tgname AS trigger_name,
  t.tgenabled AS enabled,
  p.proname AS function_name,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- =============================================================================
-- DIAGNOSTIC 3: Check all triggers on profiles table
-- =============================================================================
SELECT 
  t.tgname AS trigger_name,
  t.tgenabled AS enabled,
  p.proname AS function_name,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- =============================================================================
-- DIAGNOSTIC 4: Check new user's current state
-- =============================================================================
SELECT 
  p.user_id,
  p.id AS profile_id,
  p.name,
  p.email,
  p.referral_code AS profile_referral_code,
  rc.code AS table_referral_code,
  p.referred_by,
  pr.name AS referrer_name,
  pr.referral_code AS referrer_code
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
LEFT JOIN public.profiles pr ON pr.user_id = p.referred_by
WHERE p.user_id = '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid;

-- =============================================================================
-- DIAGNOSTIC 5: Check if referral relationship exists for new user
-- =============================================================================
SELECT 
  r.*,
  p1.name AS referrer_name,
  p2.name AS referee_name
FROM public.referrals r
LEFT JOIN public.profiles p1 ON p1.user_id = r.referrer_user_id
LEFT JOIN public.profiles p2 ON p2.user_id = r.referred_user_id
WHERE r.referred_user_id = '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid
   OR r.referee_id = 'f74b0b3d-cbb4-42ed-8bc4-15080a6ad75a'::uuid;

-- =============================================================================
-- DIAGNOSTIC 6: Verify User 2's code exists and is correct
-- =============================================================================
SELECT 
  p.user_id,
  p.id AS profile_id,
  p.name,
  p.referral_code AS profile_code,
  rc.code AS table_code
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
WHERE p.user_id = '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid;

-- =============================================================================
-- DIAGNOSTIC 7: Check auth.users metadata for referral code
-- =============================================================================
SELECT 
  id,
  email,
  raw_user_meta_data,
  created_at
FROM auth.users
WHERE id = '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid;

-- =============================================================================
-- DIAGNOSTIC 8: Check apply_referral_code function definition
-- =============================================================================
SELECT 
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'apply_referral_code';
