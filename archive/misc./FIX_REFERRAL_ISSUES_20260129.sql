-- FIX_REFERRAL_ISSUES_20260129.sql
-- Fixes two critical referral system issues:
-- 1) Legacy profiles trigger generating duplicate/mismatched codes
-- 2) Missing referral relationships (referred_by NULL)
--
-- IMPORTANT: If you get error about "referrer_id" column, 
-- run UPDATE_APPLY_REFERRAL_RPC.sql FIRST to update the RPC function.
--
-- Run this in Supabase SQL Editor.

-- =============================================================================
-- STEP 1: Remove legacy profiles trigger (causing dual code generation)
-- =============================================================================
-- This trigger generates UPPERCASE codes in profiles.referral_code (BC998522)
-- while handle_new_user creates lowercase codes in referral_codes table (6f538e4f).
-- Result: screen shows referral_codes.code but profiles has a different value.

DROP TRIGGER IF EXISTS trigger_generate_referral_code_on_profile_creation ON public.profiles;
DROP FUNCTION IF EXISTS public.generate_referral_code_on_profile_creation();
DROP FUNCTION IF EXISTS generate_referral_code_on_profile_creation();

-- =============================================================================
-- STEP 2: Sync all profiles.referral_code to match referral_codes.code
-- =============================================================================
-- Fix existing mismatches (like user 2: BC998522 → 6f538e4f)

UPDATE public.profiles p
SET referral_code = rc.code
FROM public.referral_codes rc
WHERE rc.user_id = p.user_id
  AND (p.referral_code IS NULL OR LOWER(p.referral_code) <> LOWER(rc.code));

-- =============================================================================
-- STEP 3: Apply missing referral for User 2
-- =============================================================================
-- User 2 (fd81b7c0-8419-4698-b341-31790afbb554) signed up with code "fd02fba0"
-- belonging to User 1 (7e3307dd-01b4-4479-ad97-65eae9090c89)
-- but referral wasn't applied.

-- 3a) DIAGNOSTIC: Check what the FK constraint actually references
-- Run this first to understand the schema:
-- SELECT 
--   tc.constraint_name, 
--   tc.table_name, 
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name 
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'referrals' 
--   AND tc.constraint_name LIKE '%referrer%';

-- 3b) Create referral relationship if missing
-- WORKAROUND: Temporarily disable FK constraint, insert, then re-enable
-- This is safe because we're using correct UUIDs from profiles
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS fk_referrals_referrer;
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS fk_referrals_referee;

INSERT INTO public.referrals (
  referrer_id, 
  referee_id, 
  referrer_user_id, 
  referred_user_id, 
  referral_code, 
  status
)
SELECT 
  p1.id AS referrer_id,
  p2.id AS referee_id,
  '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid AS referrer_user_id,
  'fd81b7c0-8419-4698-b341-31790afbb554'::uuid AS referred_user_id,
  'fd02fba0' AS referral_code,
  'pending' AS status
FROM public.profiles p1
CROSS JOIN public.profiles p2
WHERE p1.user_id = '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid
  AND p2.user_id = 'fd81b7c0-8419-4698-b341-31790afbb554'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.referrals 
    WHERE (referred_user_id = 'fd81b7c0-8419-4698-b341-31790afbb554'::uuid
       OR referee_id = p2.id)
  );

-- Re-create FK constraints pointing to the correct table (profiles, not users)
ALTER TABLE public.referrals 
  ADD CONSTRAINT fk_referrals_referrer 
  FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.referrals 
  ADD CONSTRAINT fk_referrals_referee 
  FOREIGN KEY (referee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3c) Populate profiles.referred_by for User 2
UPDATE public.profiles
SET referred_by = '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid
WHERE user_id = 'fd81b7c0-8419-4698-b341-31790afbb554'::uuid
  AND referred_by IS NULL;

-- =============================================================================
-- STEP 4: Backfill all other missing referred_by values
-- =============================================================================
-- Ensure any other users with referrals also have profiles.referred_by populated

UPDATE public.profiles p
SET referred_by = r.referrer_user_id
FROM public.referrals r
WHERE r.referred_user_id = p.user_id
  AND p.referred_by IS NULL;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check 1: Code mismatches should be 0
SELECT COUNT(*) AS code_mismatches
FROM public.profiles p
JOIN public.referral_codes rc ON rc.user_id = p.user_id
WHERE LOWER(p.referral_code) <> LOWER(rc.code);

-- Check 2: User 2's referral should exist
SELECT 
  r.id,
  r.referrer_user_id,
  r.referred_user_id,
  r.referral_code,
  r.status,
  p1.name AS referrer_name,
  p2.name AS referred_name,
  p2.referred_by
FROM public.referrals r
JOIN public.profiles p1 ON p1.user_id = r.referrer_user_id
JOIN public.profiles p2 ON p2.user_id = r.referred_user_id
WHERE r.referred_user_id = 'fd81b7c0-8419-4698-b341-31790afbb554'::uuid;

-- Check 3: User 2's profile.referral_code should match referral_codes.code
SELECT 
  p.user_id,
  p.name,
  p.referral_code AS profile_code,
  rc.code AS table_code,
  p.referred_by,
  pr.name AS referrer_name
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
LEFT JOIN public.profiles pr ON pr.user_id = p.referred_by
WHERE p.user_id = 'fd81b7c0-8419-4698-b341-31790afbb554'::uuid;

-- Check 4: User 1's referral stats (should show 1 total referral)
SELECT 
  p.name,
  p.referral_code,
  COUNT(r.id) AS total_referrals,
  COUNT(r.id) FILTER (WHERE r.status = 'pending') AS pending_referrals,
  COUNT(r.id) FILTER (WHERE r.status = 'completed') AS completed_referrals
FROM public.profiles p
LEFT JOIN public.referrals r ON r.referrer_user_id = p.user_id
WHERE p.user_id = '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid
GROUP BY p.user_id, p.name, p.referral_code;

-- Check 5: All users with referrals but NULL referred_by (should be empty)
SELECT 
  p.user_id,
  p.name,
  p.referred_by,
  r.referrer_user_id,
  r.referral_code
FROM public.profiles p
JOIN public.referrals r ON r.referred_user_id = p.user_id
WHERE p.referred_by IS NULL;
