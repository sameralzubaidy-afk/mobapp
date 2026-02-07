-- File: supabase/migrations/20260204000002_fix_referral_with_logging.sql
-- Mode B: Idempotent / rerunnable
-- Purpose: Fix referral attribution with comprehensive logging
--
-- This is a hardened version that:
-- 1. Creates a debug_logs table to capture execution flow
-- 2. Logs every step so we can diagnose failures
-- 3. Never silently swallows exceptions without recording them

-- =============================================================================
-- BLOCK 1 — Debug Infrastructure
-- =============================================================================

-- Create debug_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  process_name TEXT NOT NULL,
  user_id UUID,
  message TEXT,
  payload JSONB,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS debug_logs_created_at_idx ON public.debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS debug_logs_user_id_idx ON public.debug_logs(user_id);
CREATE INDEX IF NOT EXISTS debug_logs_process_name_idx ON public.debug_logs(process_name);

-- Helper function to log debug messages
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
  -- If logging itself fails, don't break the main flow
  NULL;
END;
$$;

-- =============================================================================
-- BLOCK 2 — Improved Functions with Logging
-- =============================================================================

-- create_referral_code() with logging
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

  -- Check if code already exists
  SELECT rc.code INTO v_code
  FROM public.referral_codes rc
  WHERE rc.user_id = p_user_id
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    PERFORM public.log_debug('create_referral_code', p_user_id, 'Code already exists',
      jsonb_build_object('code', v_code));
    
    -- Sync to profiles if needed
    UPDATE public.profiles p
    SET referral_code = v_code
    WHERE p.user_id = p_user_id
      AND p.referral_code IS NULL;

    RETURN jsonb_build_object('code', v_code, 'created', false);
  END IF;

  -- Generate new code
  v_code := public.generate_referral_code();
  PERFORM public.log_debug('create_referral_code', p_user_id, 'Generated code',
    jsonb_build_object('code', v_code));

  -- Insert into referral_codes
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (p_user_id, v_code);

  PERFORM public.log_debug('create_referral_code', p_user_id, 'Inserted into referral_codes',
    jsonb_build_object('code', v_code));

  -- Sync to profiles if profile exists
  UPDATE public.profiles p
  SET referral_code = v_code
  WHERE p.user_id = p_user_id
    AND p.referral_code IS NULL;

  PERFORM public.log_debug('create_referral_code', p_user_id, 'Updated profiles',
    jsonb_build_object('code', v_code));

  RETURN jsonb_build_object('code', v_code, 'created', true);
EXCEPTION 
  WHEN unique_violation THEN
    -- Race condition: another process inserted the code
    PERFORM public.log_debug('create_referral_code', p_user_id, 'Unique violation, retrying',
      NULL, SQLERRM);

    SELECT rc.code INTO v_code
    FROM public.referral_codes rc
    WHERE rc.user_id = p_user_id
    LIMIT 1;

    IF v_code IS NOT NULL THEN
      UPDATE public.profiles p
      SET referral_code = v_code
      WHERE p.user_id = p_user_id
        AND p.referral_code IS NULL;

      RETURN jsonb_build_object('code', v_code, 'created', false);
    END IF;

    RAISE;
  WHEN OTHERS THEN
    PERFORM public.log_debug('create_referral_code', p_user_id, 'Unexpected error',
      NULL, SQLERRM);
    RAISE;
END;
$$;

-- apply_referral_code() with logging
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
  v_clean_code TEXT;
  v_rows_updated INTEGER;
BEGIN
  v_clean_code := LOWER(TRIM(p_referral_code));

  PERFORM public.log_debug('apply_referral_code', p_referee_id, 'Starting',
    jsonb_build_object('input_code', p_referral_code, 'clean_code', v_clean_code));

  -- Find referrer by code
  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = v_clean_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    PERFORM public.log_debug('apply_referral_code', p_referee_id, 'Invalid code',
      jsonb_build_object('code', v_clean_code));
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  PERFORM public.log_debug('apply_referral_code', p_referee_id, 'Found referrer',
    jsonb_build_object('referrer_id', v_referrer_id));

  -- Prevent self-referral
  IF v_referrer_id = p_referee_id THEN
    PERFORM public.log_debug('apply_referral_code', p_referee_id, 'Self-referral attempted',
      jsonb_build_object('referrer_id', v_referrer_id));
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Check email match
  SELECT au.email INTO v_referee_email FROM auth.users au WHERE au.id = p_referee_id;
  SELECT au.email INTO v_referrer_email FROM auth.users au WHERE au.id = v_referrer_id;

  IF v_referee_email IS NOT NULL AND v_referrer_email IS NOT NULL AND v_referee_email = v_referrer_email THEN
    PERFORM public.log_debug('apply_referral_code', p_referee_id, 'Same email detected',
      jsonb_build_object('email', v_referee_email));
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Update profiles.referred_by (critical step)
  UPDATE public.profiles p
  SET referred_by = v_referrer_id
  WHERE p.user_id = p_referee_id
    AND p.referred_by IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  PERFORM public.log_debug('apply_referral_code', p_referee_id, 'Updated profiles.referred_by',
    jsonb_build_object('referrer_id', v_referrer_id, 'rows_updated', v_rows_updated));

  -- Check if referral already exists
  IF EXISTS(SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id) THEN
    PERFORM public.log_debug('apply_referral_code', p_referee_id, 'Referral already exists',
      jsonb_build_object('referrer_id', v_referrer_id));
    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;

  -- Insert into referrals
  INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer_id, p_referee_id, v_clean_code, 'pending');

  PERFORM public.log_debug('apply_referral_code', p_referee_id, 'Inserted into referrals',
    jsonb_build_object('referrer_id', v_referrer_id, 'status', 'pending'));

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_debug('apply_referral_code', p_referee_id, 'Unexpected error',
    jsonb_build_object('code', v_clean_code), SQLERRM);
  RAISE;
END;
$$;

-- handle_new_user() with comprehensive logging
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
  v_create_result JSONB;
  v_apply_result JSONB;
BEGIN
  PERFORM public.log_debug('handle_new_user', NEW.id, 'Trigger started',
    jsonb_build_object('email', NEW.email, 'metadata', NEW.raw_user_meta_data));

  -- Extract name
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    'User'
  );

  -- Extract phone
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.phone
  );

  -- Extract referral code from metadata (multiple key variants)
  v_referral_input := NULLIF(
    TRIM(
      COALESCE(
        NEW.raw_user_meta_data->>'referral_code',
        NEW.raw_user_meta_data->>'referralCode',
        NEW.raw_user_meta_data->>'referrer_code',
        NEW.raw_user_meta_data->>'referrerCode',
        ''
      )
    ),
    ''
  );

  PERFORM public.log_debug('handle_new_user', NEW.id, 'Extracted metadata',
    jsonb_build_object('name', v_name, 'phone', v_phone, 'referral_input', v_referral_input));

  -- Parse DOB
  IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::date;
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
      PERFORM public.log_debug('handle_new_user', NEW.id, 'DOB parse failed', NULL, SQLERRM);
    END;
  END IF;

  -- Create referral code for this user
  BEGIN
    v_create_result := public.create_referral_code(NEW.id);
    v_referral_code := v_create_result->>'code';
    
    PERFORM public.log_debug('handle_new_user', NEW.id, 'Created referral code',
      jsonb_build_object('code', v_referral_code, 'result', v_create_result));
  EXCEPTION WHEN OTHERS THEN
    v_referral_code := NULL;
    PERFORM public.log_debug('handle_new_user', NEW.id, 'create_referral_code failed',
      NULL, SQLERRM);
  END;

  -- Insert profile
  INSERT INTO public.profiles (
    user_id,
    name,
    email,
    phone,
    dob,
    age,
    phone_verified,
    phone_verified_at,
    referral_code,
    created_at,
    updated_at
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
    v_referral_code,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    dob = EXCLUDED.dob,
    age = EXCLUDED.age,
    referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code),
    updated_at = NOW();

  PERFORM public.log_debug('handle_new_user', NEW.id, 'Inserted profile',
    jsonb_build_object('referral_code', v_referral_code));

  -- Apply referral code from signup metadata
  IF v_referral_input IS NOT NULL THEN
    BEGIN
      v_apply_result := public.apply_referral_code(NEW.id, v_referral_input);
      
      PERFORM public.log_debug('handle_new_user', NEW.id, 'Applied referral code',
        jsonb_build_object('input_code', v_referral_input, 'result', v_apply_result));
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_debug('handle_new_user', NEW.id, 'apply_referral_code failed',
        jsonb_build_object('input_code', v_referral_input), SQLERRM);
    END;
  ELSE
    PERFORM public.log_debug('handle_new_user', NEW.id, 'No referral code in metadata', NULL);
  END IF;

  PERFORM public.log_debug('handle_new_user', NEW.id, 'Trigger completed successfully', NULL);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_debug('handle_new_user', NEW.id, 'Trigger failed catastrophically',
    NULL, SQLERRM);
  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCK 3 — Recreate Triggers
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, phone, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_update();

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- After running this migration and testing a new signup, check logs:
-- SELECT * FROM public.debug_logs WHERE user_id = '<new_user_id>' ORDER BY created_at;

-- To see all recent signup flows:
-- SELECT * FROM public.debug_logs WHERE process_name LIKE '%new_user%' ORDER BY created_at DESC LIMIT 50;

-- To find failed operations:
-- SELECT * FROM public.debug_logs WHERE error_message IS NOT NULL ORDER BY created_at DESC LIMIT 20;
