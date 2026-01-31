-- DEBUG_REFERRAL_FAILURES_V2.sql
-- STRATEGY V2: Write logs to a table so they are visible immediately
-- Run this entire script in Supabase SQL Editor

-- 1. Create a debug table (visible in your Table Editor)
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id SERIAL PRIMARY KEY,
    log_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    process_name TEXT,
    message TEXT,
    payload JSONB
);

-- Disable RLS on debug table so the trigger can ALWAYS write to it
ALTER TABLE public.debug_logs DISABLE ROW LEVEL SECURITY;

-- Grant access to everyone (for debugging purposes only)
GRANT ALL ON public.debug_logs TO postgres, service_role, authenticated, anon;


-- 2. Debug-Enabled REFERRAL FUNCTION
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_user_id UUID;
  v_referrer_profile_id UUID;
  v_referee_profile_id UUID;
BEGIN
  -- Log 1: Start
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('apply_referral_code', 'Started execution', jsonb_build_object('referee_id', p_referee_id, 'code', p_referral_code));

  -- Normalize code
  p_referral_code := LOWER(TRIM(p_referral_code));
  
  -- Get referrer's user_id
  SELECT rc.user_id INTO v_referrer_user_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = p_referral_code
  LIMIT 1;
  
  IF v_referrer_user_id IS NULL THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Invalid code', jsonb_build_object('code', p_referral_code));
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  -- Self-referral check
  IF v_referrer_user_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Get profiles IDs (CRITICAL DEBUG POINT)
  SELECT id INTO v_referrer_profile_id FROM public.profiles WHERE user_id = v_referrer_user_id;
  SELECT id INTO v_referee_profile_id FROM public.profiles WHERE user_id = p_referee_id;
  
  -- Log Data Lookup
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('apply_referral_code', 'Profile Lookup', jsonb_build_object(
      'referrer_user_id', v_referrer_user_id,
      'referrer_profile_id', v_referrer_profile_id,
      'referee_profile_id', v_referee_profile_id
  ));

  BEGIN
    -- Insert Referral
    INSERT INTO public.referrals (
      referrer_id, referee_id, 
      referrer_user_id, referred_user_id, 
      referral_code, status
    ) VALUES (
      v_referrer_profile_id, v_referee_profile_id,
      v_referrer_user_id, p_referee_id,
      p_referral_code, 'pending'
    );
    
    -- Update Profile
    UPDATE public.profiles 
    SET referred_by = v_referrer_user_id
    WHERE user_id = p_referee_id;
    
    INSERT INTO public.debug_logs (process_name, message) VALUES ('apply_referral_code', 'Success');

    RETURN jsonb_build_object('success', true);

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'CRASH DURING INSERT', jsonb_build_object('error', SQLERRM));
    RAISE WARNING 'CRASH DURING INSERT: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Debug-Enabled NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_code TEXT;
  v_referral_input TEXT;
  v_profile_id UUID;
BEGIN
  -- Log Start
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('handle_new_user', 'Trigger Start', jsonb_build_object('user_id', NEW.id, 'meta', NEW.raw_user_meta_data));

  -- 1. Create Profile
  INSERT INTO public.profiles (
    user_id, name, email
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_profile_id;
  
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('handle_new_user', 'Profile Created', jsonb_build_object('profile_id', v_profile_id));

  -- 2. Generate Code
  v_referral_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  
  INSERT INTO public.referral_codes (user_id, code) VALUES (NEW.id, v_referral_code)
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET referral_code = v_referral_code WHERE user_id = NEW.id;

  -- 3. Check for Incoming Referral
  v_referral_input := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')), '');
  
  IF v_referral_input IS NOT NULL THEN
     INSERT INTO public.debug_logs (process_name, message, payload)
     VALUES ('handle_new_user', 'Found Input Code', jsonb_build_object('code', v_referral_input));
     
     PERFORM public.apply_referral_code(NEW.id, v_referral_input);
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Log Fatal Crash
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('handle_new_user', 'FATAL CRASH', jsonb_build_object('error', SQLERRM));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
