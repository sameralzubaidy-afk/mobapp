-- File: FINAL-ULTIMATE-REFERRAL-FIX.sql
-- COMPLETE FIX for referred_by being NULL on signup
-- This script fixes both the trigger and the RPC function to be super-robust.

-- =============================================================================
-- STEP 1: Update apply_referral_code to be extremely robust
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
  v_referrer_profile_id UUID;
  v_referee_profile_id UUID;
BEGIN
  -- 1. Normalize input
  p_referral_code := LOWER(TRIM(p_referral_code));
  
  IF p_referral_code IS NULL OR p_referral_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code is empty');
  END IF;

  -- 2. Find the referrer
  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = p_referral_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RAISE WARNING 'apply_referral_code: Code % not found', p_referral_code;
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  -- 3. Prevent self-referral (by ID)
  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- 4. Prevent self-referral (by Email)
  SELECT au.email INTO v_referee_email FROM auth.users au WHERE au.id = p_referee_id;
  SELECT au.email INTO v_referrer_email FROM auth.users au WHERE au.id = v_referrer_id;

  IF v_referee_email IS NOT NULL AND v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- 5. Always update profiles.referred_by (Force sync)
  -- This ensures that even if referral creation fails, the link is established in profiles
  UPDATE public.profiles p
  SET referred_by = v_referrer_id
  WHERE p.user_id = p_referee_id
    AND (p.referred_by IS NULL OR p.referred_by != v_referrer_id);

  -- 6. Check if referral already recorded
  IF EXISTS(SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral already applied');
  END IF;

  -- 7. Get profile IDs for legacy support (if columns still exist)
  SELECT id INTO v_referrer_profile_id FROM public.profiles WHERE user_id = v_referrer_id;
  SELECT id INTO v_referee_profile_id FROM public.profiles WHERE user_id = p_referee_id;

  -- 8. Insert into referrals table
  -- We handle both old schema (referrer_id) and new schema (referrer_user_id) for safety
  INSERT INTO public.referrals (
    referrer_id,
    referee_id,
    referrer_user_id,
    referred_user_id,
    referral_code,
    status
  )
  VALUES (
    v_referrer_profile_id,
    v_referee_profile_id,
    v_referrer_id,
    p_referee_id,
    p_referral_code,
    'pending'
  );

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'apply_referral_code error for user %: %', p_referee_id, SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 2: Update handle_new_user trigger to handle multiple metadata keys
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_dob DATE;
  v_age INTEGER;
  v_referral_code TEXT;
  v_referral_input TEXT;
BEGIN
  -- 1. Extract metadata
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    'User'
  );

  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.phone
  );

  -- 2. ROBUST REFERRAL INPUT CHECK: Check multiple common keys
  v_referral_input := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'referral_code',
    NEW.raw_user_meta_data->>'referralCode',
    NEW.raw_user_meta_data->>'referrer_code',
    NEW.raw_user_meta_data->>'referrerCode',
    ''
  )), '');

  -- 3. Extract DOB
  IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::date;
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
    END;
  END IF;

  -- 4. Create/Get V2 referral code for the new user
  BEGIN
    SELECT (public.create_referral_code(NEW.id)->>'code') INTO v_referral_code;
  EXCEPTION WHEN OTHERS THEN
    v_referral_code := NULL;
    RAISE WARNING 'Referral code creation failed for user %: %', NEW.id, SQLERRM;
  END;

  -- 5. Initial profile insertion
  INSERT INTO public.profiles (
    user_id,
    name,
    email,
    phone,
    dob,
    age,
    phone_verified,
    phone_verified_at,
    referral_code
  )
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_phone,
    v_dob,
    v_age,
    false,
    NULL,
    v_referral_code
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    dob = EXCLUDED.dob,
    age = EXCLUDED.age,
    referral_code = COALESCE(EXCLUDED.referral_code, public.profiles.referral_code);

  -- 6. Apply referral code (best-effort)
  IF v_referral_input IS NOT NULL THEN
    BEGIN
      -- We perform this AFTER inserting the profile to ensure row exists for update
      PERFORM public.apply_referral_code(NEW.id, v_referral_input);
      RAISE LOG 'handle_new_user: Applied referral code % for user %', v_referral_input, NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: Referral code apply failed for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user: Profile creation failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 3: Manual Repair for the user you just created
-- =============================================================================
-- User: alice.test@example.com (e94912cd-8339-4358-9313-d2dc619ef545)
-- If you know the code they were SUPPOSED to use, run this (REPLACE 'CODE_HERE'):
/*
DO $$
BEGIN
  PERFORM public.apply_referral_code('e94912cd-8339-4358-9313-d2dc619ef545'::uuid, 'CODE_HERE');
END $$;
*/

-- =============================================================================
-- STEP 4: Verification
-- =============================================================================
-- List all users who signed up today and check their referral status
/*
SELECT 
  p.user_id,
  p.name,
  p.email,
  p.referred_by,
  r.referrer_user_id as referral_record_referrer,
  r.status as referral_status
FROM public.profiles p
LEFT JOIN public.referrals r ON r.referred_user_id = p.user_id
WHERE p.created_at > CURRENT_DATE
ORDER BY p.created_at DESC;
*/
