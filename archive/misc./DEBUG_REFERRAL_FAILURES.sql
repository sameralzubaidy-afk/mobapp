-- DEBUG_REFERRAL_FAILURES.sql
-- Force logging of all referral issues so we can see what's happening internally
-- Run this in Supabase SQL Editor, then check Postgres Logs after signup

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
  -- Log entry
  RAISE WARNING 'DEBUG: apply_referral_code START: referee=% code=%', p_referee_id, p_referral_code;

  -- Normalize code to lowercase
  p_referral_code := LOWER(TRIM(p_referral_code));
  
  -- Get referrer's user_id from code
  SELECT rc.user_id INTO v_referrer_user_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = p_referral_code
  LIMIT 1;
  
  IF v_referrer_user_id IS NULL THEN
    RAISE WARNING 'DEBUG: Invalid code=%', p_referral_code;
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referral (same user_id)
  IF v_referrer_user_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Check if referee already has a referral
  IF EXISTS(SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id) THEN
    RAISE WARNING 'DEBUG: Referral already applied for user=%', p_referee_id;
    
    -- Update referred_by even if referral exists (recovery)
    UPDATE public.profiles p
    SET referred_by = v_referrer_user_id
    WHERE p.user_id = p_referee_id
      AND p.referred_by IS NULL;
    
    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;
  
  -- Get profiles.id for both users
  SELECT id INTO v_referrer_profile_id FROM public.profiles WHERE user_id = v_referrer_user_id;
  SELECT id INTO v_referee_profile_id FROM public.profiles WHERE user_id = p_referee_id;
  
  IF v_referrer_profile_id IS NULL THEN
    RAISE WARNING 'DEBUG: Referrer profile missing for user=%', v_referrer_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'Referrer profile not found');
  END IF;
  
  IF v_referee_profile_id IS NULL THEN
    RAISE WARNING 'DEBUG: Referee profile missing for user=%', p_referee_id;
    RETURN jsonb_build_object('success', false, 'error', 'Referee profile not found');
  END IF;
  
  -- Insert with detailed logging of values
  RAISE WARNING 'DEBUG: Inserting referral: referrer_id=% referee_id=% referrer_user=% referred_user=%', 
    v_referrer_profile_id, v_referee_profile_id, v_referrer_user_id, p_referee_id;

  BEGIN
    INSERT INTO public.referrals (
      referrer_id, referee_id, 
      referrer_user_id, referred_user_id, 
      referral_code, status
    ) VALUES (
      v_referrer_profile_id, v_referee_profile_id,
      v_referrer_user_id, p_referee_id,
      p_referral_code, 'pending'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'DEBUG: INSERT FAILED: %', SQLERRM;
    RAISE;
  END;
  
  -- Update profiles.referred_by
  UPDATE public.profiles p
  SET referred_by = v_referrer_user_id
  WHERE p.user_id = p_referee_id;
  
  RAISE WARNING 'DEBUG: SUCCESS for user=%', p_referee_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_user_id,
    'message', 'Referral code applied successfully'
  );

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'DEBUG: FATAL ERROR: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fix handle_new_user to ensure it doesn't fail silently
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_code TEXT;
  v_referral_input TEXT;
  v_profile_id UUID;
BEGIN
  RAISE WARNING 'DEBUG: handle_new_user START for %', NEW.id;

  -- 1. Create Profile First
  INSERT INTO public.profiles (
    user_id, name, email, phone, referral_code
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    NULL -- referral_code set later
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_profile_id;

  -- 2. Generate Own Code
  v_referral_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, v_referral_code)
  ON CONFLICT DO NOTHING;

  -- 3. Update Profile with Own Code
  UPDATE public.profiles SET referral_code = v_referral_code WHERE user_id = NEW.id;
  
  -- 4. Apply Referral Input (if any)
  v_referral_input := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')), '');
  
  IF v_referral_input IS NOT NULL THEN
     RAISE WARNING 'DEBUG: Applying code % for user %', v_referral_input, NEW.id;
     PERFORM public.apply_referral_code(NEW.id, v_referral_input);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'DEBUG: handle_new_user CRASHED: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
