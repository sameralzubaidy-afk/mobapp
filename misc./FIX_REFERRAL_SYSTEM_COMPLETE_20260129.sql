-- FIX_REFERRAL_SYSTEM_COMPLETE_20260129.sql
-- COMPLETE FIX for Referral System:
-- 1. Updated `apply_referral_code` RPC to handle profiles FKs correctly
-- 2. Updated `handle_new_user` trigger to create referral codes properly
-- 3. Data repair for all users with NULL referral codes or missing relationships
-- 
-- Run this ENTIRE file in Supabase SQL Editor.

-- =============================================================================
-- SECTION 1: FIX RPC FUNCTION (Foreign Key Issue)
-- =============================================================================

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
-- SECTION 2: FIX TRIGGER FUNCTION (Code Generation Issue)
-- =============================================================================

-- Ensure create_referral_code function exists and is robust
CREATE OR REPLACE FUNCTION public.create_referral_code(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Check if user already has a code
  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = p_user_id LIMIT 1;
  
  IF v_code IS NOT NULL THEN
    RETURN jsonb_build_object('code', v_code, 'created', false);
  END IF;
  
  -- Generate unique code loop
  LOOP
    v_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE LOWER(code) = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  -- Insert code
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (p_user_id, v_code);
  
  -- Sync to profile immediately
  UPDATE public.profiles 
  SET referral_code = v_code 
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object('code', v_code, 'created', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update handle_new_user to ensure it invokes create_referral_code properly
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

  v_referral_input := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')), '');

  IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::date;
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
    END;
  END IF;

  -- Ensure the user has a V2 referral code
  BEGIN
    SELECT (public.create_referral_code(NEW.id)->>'code') INTO v_referral_code;
  EXCEPTION WHEN OTHERS THEN
    v_referral_code := NULL;
    RAISE WARNING 'Referral code creation failed for user %: %', NEW.id, SQLERRM;
  END;

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

  -- Apply referral code from signup metadata (best-effort)
  IF v_referral_input IS NOT NULL THEN
    BEGIN
      PERFORM public.apply_referral_code(NEW.id, v_referral_input);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Referral code apply failed for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SECTION 3: CLEANUP LEGACY TRIGGERS (Prevent Conflicts)
-- =============================================================================

-- Remove legacy profiles trigger that might generate uppercase codes
DROP TRIGGER IF EXISTS trigger_generate_referral_code_on_profile_creation ON public.profiles;
DROP FUNCTION IF EXISTS public.generate_referral_code_on_profile_creation();
DROP FUNCTION IF EXISTS generate_referral_code_on_profile_creation();

-- Remove legacy auth.users trigger (handle_new_user does the job)
DROP TRIGGER IF EXISTS create_referral_code_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.create_referral_code_on_signup();
DROP FUNCTION IF EXISTS create_referral_code_on_signup();

-- =============================================================================
-- SECTION 4: DATA REPAIR (Fix Broken Records)
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- 1. Generate codes for any user missing one
  FOR rec IN SELECT user_id FROM public.profiles WHERE referral_code IS NULL LOOP
    PERFORM public.create_referral_code(rec.user_id);
  END LOOP;
  
  -- 2. Sync profiles.referral_code to match referral_codes.code
  UPDATE public.profiles p
  SET referral_code = rc.code
  FROM public.referral_codes rc
  WHERE rc.user_id = p.user_id
    AND (p.referral_code IS NULL OR LOWER(p.referral_code) <> LOWER(rc.code));
    
  -- 3. Backfill profiles.referred_by from referrals table
  UPDATE public.profiles p
  SET referred_by = r.referrer_user_id
  FROM public.referrals r
  WHERE r.referred_user_id = p.user_id
    AND p.referred_by IS NULL;

END $$;

-- =============================================================================
-- SECTION 5: FIX SPECIFIC USER '6e18a540-3966' (Bob.demo)
-- =============================================================================
-- Manually apply User 2's code (fd02fba0) for this user if missing referral
-- User 2 ID: 7e3307dd-01b4-4479-ad97-65eae9090c89

DO $$
DECLARE
  v_referee_id UUID := '6e18a540-3966-435c-9c1f-6431039a58e5'::uuid;
  v_code TEXT := 'fd02fba0';
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_referee_id AND referred_by IS NULL) THEN
     PERFORM public.apply_referral_code(v_referee_id, v_code);
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

SELECT 
  'FINAL CHECK' as check_name,
  (SELECT COUNT(*) FROM public.profiles WHERE referral_code IS NULL) as missing_own_codes,
  (SELECT COUNT(*) FROM public.profiles p JOIN public.referrals r ON r.referred_user_id = p.user_id WHERE p.referred_by IS NULL) as missing_referred_by,
  (SELECT referral_code FROM public.profiles WHERE user_id = '6e18a540-3966-435c-9c1f-6431039a58e5'::uuid) as bob_referral_code,
  (SELECT referred_by FROM public.profiles WHERE user_id = '6e18a540-3966-435c-9c1f-6431039a58e5'::uuid) as bob_referred_by;
