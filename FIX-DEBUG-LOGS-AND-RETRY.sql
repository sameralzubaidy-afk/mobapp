-- File: SUPABASE-FIX-DEBUG-LOGS.sql
-- Run this in Supabase SQL Editor
-- This forces a reset of the debug logging infrastructure to ensure we catch errors.

-- 1. Force cleanup of potentially broken debug table
DROP TABLE IF EXISTS public.debug_logs CASCADE;

-- 2. Recreate cleanly with known schema
CREATE TABLE public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  process_name TEXT NOT NULL,
  user_id UUID,
  message TEXT,
  payload JSONB,
  error_message TEXT
);

CREATE INDEX debug_logs_created_at_idx ON public.debug_logs(created_at DESC);
CREATE INDEX debug_logs_user_id_idx ON public.debug_logs(user_id);

-- 3. Recreate the logging function to match
CREATE OR REPLACE FUNCTION public.log_debug(
  p_process_name TEXT,
  p_user_id UUID,
  p_message TEXT,
  p_payload JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.debug_logs (process_name, user_id, message, payload, error_message)
  VALUES (p_process_name, p_user_id, p_message, p_payload, p_error_message);
EXCEPTION WHEN OTHERS THEN
  -- Raise notice so we can see it in SQL Editor / Logs if manual testing
  RAISE WARNING 'Logging failed: %', SQLERRM;
END;
$$;

-- 4. Re-run the core logic migration content (Functions + Triggers)
-- We paste the critical parts of 20260204000002 here to ensure they are active.

-- create_referral_code()
CREATE OR REPLACE FUNCTION public.create_referral_code(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  PERFORM public.log_debug('create_referral_code', p_user_id, 'Starting', 
    jsonb_build_object('user_id', p_user_id));

  SELECT rc.code INTO v_code
  FROM public.referral_codes rc
  WHERE rc.user_id = p_user_id
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    PERFORM public.log_debug('create_referral_code', p_user_id, 'Code already exists',
      jsonb_build_object('code', v_code));
    
    UPDATE public.profiles p
    SET referral_code = v_code
    WHERE p.user_id = p_user_id
      AND p.referral_code IS NULL;

    RETURN jsonb_build_object('code', v_code, 'created', false);
  END IF;

  v_code := public.generate_referral_code();
  
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (p_user_id, v_code);

  UPDATE public.profiles p
  SET referral_code = v_code
  WHERE p.user_id = p_user_id
    AND p.referral_code IS NULL;

  PERFORM public.log_debug('create_referral_code', p_user_id, 'Created new code',
    jsonb_build_object('code', v_code));

  RETURN jsonb_build_object('code', v_code, 'created', true);
EXCEPTION 
  WHEN unique_violation THEN
    PERFORM public.log_debug('create_referral_code', p_user_id, 'Race condition retry', NULL, SQLERRM);
    SELECT rc.code INTO v_code FROM public.referral_codes rc WHERE rc.user_id = p_user_id LIMIT 1;
    IF v_code IS NOT NULL THEN
      UPDATE public.profiles p SET referral_code = v_code WHERE p.user_id = p_user_id AND p.referral_code IS NULL;
      RETURN jsonb_build_object('code', v_code, 'created', false);
    END IF;
    RAISE;
  WHEN OTHERS THEN
    PERFORM public.log_debug('create_referral_code', p_user_id, 'Error', NULL, SQLERRM);
    RAISE;
END;
$$;

-- handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_dob DATE;
  v_age INTEGER;
  v_referral_code TEXT;
  v_referral_input TEXT;
BEGIN
  PERFORM public.log_debug('handle_new_user', NEW.id, 'Trigger started',
    jsonb_build_object('meta', NEW.raw_user_meta_data));

  v_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', 'User');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone);
  
  v_referral_input := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'referral_code',
    NEW.raw_user_meta_data->>'referralCode',
    NEW.raw_user_meta_data->>'referrer_code'
  )), '');

  IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::date;
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL; v_age := NULL;
    END;
  END IF;

  -- Create referral code
  BEGIN
    v_referral_code := (public.create_referral_code(NEW.id)->>'code');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_debug('handle_new_user', NEW.id, 'create_referral_code failed', NULL, SQLERRM);
    v_referral_code := NULL;
  END;

  -- Insert Profile
  INSERT INTO public.profiles (
    user_id, name, email, phone, dob, age, 
    phone_verified, referral_code, created_at, updated_at
  )
  VALUES (
    NEW.id, v_name, NEW.email, v_phone, v_dob, v_age, 
    false, v_referral_code, NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code),
    updated_at = NOW();

  -- Apply referral if present
  IF v_referral_input IS NOT NULL THEN
    BEGIN
      PERFORM public.apply_referral_code(NEW.id, v_referral_input);
      PERFORM public.log_debug('handle_new_user', NEW.id, 'Applied referral', jsonb_build_object('code', v_referral_input));
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_debug('handle_new_user', NEW.id, 'Apply failed', NULL, SQLERRM);
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_debug('handle_new_user', NEW.id, 'Trigger crashed', NULL, SQLERRM);
  RETURN NEW;
END;
$$;

-- 5. Force Re-bind Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Manually fix the failed user fa0db18d-2544-42cc-8e19-0055e4521076
-- We run the create logic manually for them
DO $$
DECLARE
  v_target_user UUID := 'fa0db18d-2544-42cc-8e19-0055e4521076';
BEGIN
  -- 1. Create code
  PERFORM public.create_referral_code(v_target_user);
  
  -- 2. Try to apply referral if we knew what code they used (we can't know from here without metadata)
  -- But at least they will have their OWN code now.
  -- You can verify this by running the DIAGNOSE script again.
END;
$$;
