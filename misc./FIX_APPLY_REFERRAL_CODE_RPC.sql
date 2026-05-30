-- FIX_APPLY_REFERRAL_CODE_RPC.sql
-- Fix the apply_referral_code RPC to use profiles.id instead of auth.users.id
-- for referrer_id and referee_id columns
--
-- ROOT CAUSE: The old columns (referrer_id, referee_id) reference profiles.id
-- but the function was passing auth.users.id values, causing FK violations.
--
-- Run this in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_user_id UUID;
  v_referrer_profile_id UUID;
  v_referee_profile_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
BEGIN
  -- Normalize code to lowercase
  p_referral_code := LOWER(TRIM(p_referral_code));
  
  -- Get referrer's user_id from code
  SELECT rc.user_id INTO v_referrer_user_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = p_referral_code
  LIMIT 1;
  
  IF v_referrer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referral (same user_id)
  IF v_referrer_user_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Prevent self-referral (same email)
  SELECT au.email INTO v_referee_email FROM auth.users au WHERE au.id = p_referee_id;
  SELECT au.email INTO v_referrer_email FROM auth.users au WHERE au.id = v_referrer_user_id;
  
  IF v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Check if referee already has a referral
  IF EXISTS(
    SELECT 1 FROM public.referrals r 
    WHERE r.referred_user_id = p_referee_id 
       OR r.referee_id = (SELECT id FROM public.profiles WHERE user_id = p_referee_id)
  ) THEN
    -- Update referred_by even if referral exists (idempotent)
    UPDATE public.profiles p
    SET referred_by = v_referrer_user_id
    WHERE p.user_id = p_referee_id
      AND p.referred_by IS NULL;
    
    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;
  
  -- ✅ FIX: Get profiles.id for both users (not just auth.users.id)
  SELECT id INTO v_referrer_profile_id 
  FROM public.profiles 
  WHERE user_id = v_referrer_user_id;
  
  SELECT id INTO v_referee_profile_id 
  FROM public.profiles 
  WHERE user_id = p_referee_id;
  
  -- Ensure both profiles exist before inserting referral
  IF v_referrer_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referrer profile not found');
  END IF;
  
  IF v_referee_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referee profile not found');
  END IF;
  
  -- Insert with both old and new columns (using correct profile IDs)
  INSERT INTO public.referrals (
    referrer_id,           -- profiles.id (old column)
    referee_id,            -- profiles.id (old column)
    referrer_user_id,      -- auth.users.id (new column)
    referred_user_id,      -- auth.users.id (new column)
    referral_code, 
    status
  )
  VALUES (
    v_referrer_profile_id, -- ✅ CORRECT: profiles.id
    v_referee_profile_id,  -- ✅ CORRECT: profiles.id
    v_referrer_user_id,    -- ✅ CORRECT: auth.users.id
    p_referee_id,          -- ✅ CORRECT: auth.users.id
    p_referral_code, 
    'pending'
  );
  
  -- Update profiles.referred_by
  UPDATE public.profiles p
  SET referred_by = v_referrer_user_id
  WHERE p.user_id = p_referee_id
    AND p.referred_by IS NULL;
  
  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_user_id,
    'message', 'Referral code applied successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details for debugging
    RAISE WARNING 'apply_referral_code failed for referee %: %', p_referee_id, SQLERRM;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Database error: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- VERIFICATION: Test the fixed function
-- =============================================================================

-- Test 1: Apply valid referral code for new user
SELECT public.apply_referral_code(
  '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid,  -- New user ID
  'fd02fba0'  -- User 2's code
) AS test_result;

-- Test 2: Check if referral was created
SELECT 
  r.id,
  r.referrer_id AS referrer_profile_id,
  r.referee_id AS referee_profile_id,
  r.referrer_user_id,
  r.referred_user_id,
  r.referral_code,
  r.status,
  p1.name AS referrer_name,
  p2.name AS referee_name
FROM public.referrals r
JOIN public.profiles p1 ON p1.id = r.referrer_id
JOIN public.profiles p2 ON p2.id = r.referee_id
WHERE r.referred_user_id = '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid;

-- Test 3: Check if profiles.referred_by was updated
SELECT 
  user_id,
  name,
  referred_by,
  (SELECT name FROM public.profiles WHERE user_id = referred_by) AS referrer_name
FROM public.profiles
WHERE user_id = '8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3'::uuid;

-- Test 4: User 2's referral count (should be 2 now)
SELECT 
  p.name,
  p.referral_code,
  COUNT(r.id) AS total_referrals
FROM public.profiles p
LEFT JOIN public.referrals r ON r.referrer_user_id = p.user_id
WHERE p.user_id = '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid
GROUP BY p.user_id, p.name, p.referral_code;
