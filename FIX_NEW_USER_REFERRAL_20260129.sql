-- FIX_NEW_USER_REFERRAL_20260129.sql
-- Fix missing referral code + referral relationship for user 1984alice.test@example.com
--
-- User: 1984alice.test@example.com
-- user_id: 8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3
-- profile_id: f74b0b3d-cbb4-42ed-8bc4-15080a6ad75a
-- Used referral code: fd02fba0 (User 2's code)
--
-- INSTRUCTIONS:
-- 1. Run REFERRAL_DIAGNOSTIC_20260129.sql first to understand current state
-- 2. Then run this file to fix the issues
-- 3. Run verification queries at the bottom

-- =============================================================================
-- STEP 1: Generate referral code for new user (if missing)
-- =============================================================================
DO $$
DECLARE
  v_user_id UUID := '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid;
  v_code TEXT;
  v_existing_code TEXT;
BEGIN
  -- Check if user already has a code
  SELECT code INTO v_existing_code 
  FROM public.referral_codes 
  WHERE user_id = v_user_id;
  
  IF v_existing_code IS NULL THEN
    -- Generate new code
    v_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    
    -- Ensure uniqueness
    WHILE EXISTS(SELECT 1 FROM public.referral_codes WHERE LOWER(code) = v_code) LOOP
      v_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    END LOOP;
    
    -- Insert code
    INSERT INTO public.referral_codes (user_id, code)
    VALUES (v_user_id, v_code);
    
    -- Update profiles.referral_code to match
    UPDATE public.profiles
    SET referral_code = v_code
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Generated referral code % for user %', v_code, v_user_id;
  ELSE
    RAISE NOTICE 'User % already has referral code: %', v_user_id, v_existing_code;
  END IF;
END $$;

-- =============================================================================
-- STEP 2: Create referral relationship (new user referred by User 2)
-- =============================================================================
DO $$
DECLARE
  v_referee_user_id UUID := '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid;
  v_referrer_user_id UUID := '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid; -- User 2
  v_referral_code TEXT := 'fd02fba0';
  v_referee_profile_id UUID;
  v_referrer_profile_id UUID;
BEGIN
  -- Get profile IDs
  SELECT id INTO v_referee_profile_id 
  FROM public.profiles 
  WHERE user_id = v_referee_user_id;
  
  SELECT id INTO v_referrer_profile_id 
  FROM public.profiles 
  WHERE user_id = v_referrer_user_id;
  
  -- Check if referral already exists
  IF NOT EXISTS(
    SELECT 1 FROM public.referrals 
    WHERE referred_user_id = v_referee_user_id
       OR referee_id = v_referee_profile_id
  ) THEN
    -- Temporarily drop FK constraints to avoid schema issues
    ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS fk_referrals_referrer;
    ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS fk_referrals_referee;
    
    -- Insert referral (populate both old and new column sets)
    INSERT INTO public.referrals (
      referrer_id,
      referee_id,
      referrer_user_id,
      referred_user_id,
      referral_code,
      status,
      created_at
    ) VALUES (
      v_referrer_profile_id,
      v_referee_profile_id,
      v_referrer_user_id,
      v_referee_user_id,
      v_referral_code,
      'pending',
      now()
    );
    
    -- Recreate FK constraints pointing to profiles
    ALTER TABLE public.referrals 
      ADD CONSTRAINT fk_referrals_referrer 
      FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    
    ALTER TABLE public.referrals 
      ADD CONSTRAINT fk_referrals_referee 
      FOREIGN KEY (referee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    
    -- Update profiles.referred_by
    UPDATE public.profiles
    SET referred_by = v_referrer_user_id
    WHERE user_id = v_referee_user_id;
    
    RAISE NOTICE 'Created referral relationship: User 2 referred new user with code %', v_referral_code;
  ELSE
    RAISE NOTICE 'Referral relationship already exists for new user';
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check 1: New user should have referral code
SELECT 
  'New User Referral Code' AS check_name,
  p.user_id,
  p.name,
  p.referral_code AS profile_code,
  rc.code AS table_code,
  CASE 
    WHEN rc.code IS NOT NULL THEN '✓ Has code'
    ELSE '✗ Missing code'
  END AS status
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
WHERE p.user_id = '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid;

-- Check 2: New user should have referral relationship
SELECT 
  'New User Referral Relationship' AS check_name,
  r.id,
  r.referrer_user_id,
  p1.name AS referrer_name,
  p1.referral_code AS referrer_code,
  r.referred_user_id,
  p2.name AS referee_name,
  r.referral_code AS code_used,
  r.status,
  CASE 
    WHEN r.id IS NOT NULL THEN '✓ Relationship exists'
    ELSE '✗ Relationship missing'
  END AS status
FROM public.profiles p2
LEFT JOIN public.referrals r ON r.referred_user_id = p2.user_id
LEFT JOIN public.profiles p1 ON p1.user_id = r.referrer_user_id
WHERE p2.user_id = '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid;

-- Check 3: New user's referred_by should be populated
SELECT 
  'New User referred_by Field' AS check_name,
  p.user_id,
  p.name,
  p.referred_by,
  pr.name AS referrer_name,
  CASE 
    WHEN p.referred_by IS NOT NULL THEN '✓ referred_by populated'
    ELSE '✗ referred_by is NULL'
  END AS status
FROM public.profiles p
LEFT JOIN public.profiles pr ON pr.user_id = p.referred_by
WHERE p.user_id = '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid;

-- Check 4: User 2's referral dashboard (should show 2 total referrals now)
SELECT 
  'User 2 Referral Stats' AS check_name,
  p.name,
  p.referral_code,
  COUNT(r.id) AS total_referrals,
  COUNT(r.id) FILTER (WHERE r.status = 'pending') AS pending_referrals,
  COUNT(r.id) FILTER (WHERE r.status = 'completed') AS completed_referrals,
  CASE 
    WHEN COUNT(r.id) = 2 THEN '✓ Expected 2 referrals'
    ELSE '✗ Expected 2, got ' || COUNT(r.id)::text
  END AS status
FROM public.profiles p
LEFT JOIN public.referrals r ON r.referrer_user_id = p.user_id
WHERE p.user_id = '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid
GROUP BY p.user_id, p.name, p.referral_code;

-- Check 5: Summary of all issues
SELECT 
  'Summary' AS check_name,
  COUNT(DISTINCT p.user_id) FILTER (
    WHERE rc.code IS NULL
  ) AS users_missing_code,
  COUNT(DISTINCT p.user_id) FILTER (
    WHERE r.referred_user_id IS NOT NULL AND p.referred_by IS NULL
  ) AS users_missing_referred_by,
  COUNT(DISTINCT r.id) AS total_referrals,
  CASE 
    WHEN COUNT(DISTINCT p.user_id) FILTER (WHERE rc.code IS NULL) = 0 
     AND COUNT(DISTINCT p.user_id) FILTER (WHERE r.referred_user_id IS NOT NULL AND p.referred_by IS NULL) = 0
    THEN '✓ All issues fixed'
    ELSE '✗ Issues remaining'
  END AS status
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
LEFT JOIN public.referrals r ON r.referred_user_id = p.user_id;
