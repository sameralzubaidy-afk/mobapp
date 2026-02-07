-- Fix Referral Code Validation and Apply Logic
-- Mode: Idempotent Rerunnable Migration
-- Problem: check_referral_code_exists only checks referral_codes table, 
--          but many codes still live ONLY in profiles.referral_code.
--          Sync between tables might have failed for legacy users.

-- 1. Update check_referral_code_exists to check both tables
CREATE OR REPLACE FUNCTION public.check_referral_code_exists(p_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
  v_clean_code TEXT;
BEGIN
  v_clean_code := LOWER(TRIM(p_code));
  
  -- Check referral_codes table first
  SELECT EXISTS (
    SELECT 1 FROM public.referral_codes rc 
    WHERE LOWER(rc.code) = v_clean_code
  ) INTO v_exists;
  
  -- If not found, check profiles table
  IF NOT v_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE LOWER(p.referral_code) = v_clean_code
    ) INTO v_exists;
  END IF;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update apply_referral_code to be robust across both tables
CREATE OR REPLACE FUNCTION public.apply_referral_code(
    p_user_id UUID,
    p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_referrer_id UUID;
    v_referee_sp INTEGER := 20;
    v_referrer_sp INTEGER := 50;
    v_already_referred BOOLEAN;
    v_referrer_profile_id UUID;
    v_referee_profile_id UUID;
    v_clean_code TEXT;
BEGIN
    v_clean_code := LOWER(TRIM(p_code));

    -- [BP-3] Check if already referred
    SELECT (referred_by IS NOT NULL) INTO v_already_referred FROM profiles WHERE user_id = p_user_id;
    IF v_already_referred THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already applied');
    END IF;

    -- [BP-3] Check for own code prevention
    IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND LOWER(referral_code) = v_clean_code) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
    END IF;

    -- [BP-3] Find referrer - Try referral_codes table first for V2 compliance
    SELECT user_id INTO v_referrer_id
    FROM public.referral_codes
    WHERE LOWER(code) = v_clean_code
    LIMIT 1;

    -- Fallback to profiles table if not found in referral_codes
    IF v_referrer_id IS NULL THEN
        SELECT user_id, id INTO v_referrer_id, v_referrer_profile_id 
        FROM public.profiles 
        WHERE LOWER(referral_code) = v_clean_code
        LIMIT 1;
    ELSE
        -- Get profile ID for metrics/referrals table
        SELECT id INTO v_referrer_profile_id FROM public.profiles WHERE user_id = v_referrer_id;
    END IF;

    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
    END IF;

    IF v_referrer_id = p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
    END IF;

    -- Get values from sp_config (BP-3)
    SELECT COALESCE((config_value #>> '{}')::INTEGER, 20) INTO v_referee_sp FROM sp_config WHERE config_key = 'referral_reward_referee_sp';
    SELECT COALESCE((config_value #>> '{}')::INTEGER, 50) INTO v_referrer_sp FROM sp_config WHERE config_key = 'referral_reward_referrer_sp';

    -- Apply referral to profile
    UPDATE public.profiles 
    SET 
        referred_by = v_referrer_id, 
        referred_by_code = v_clean_code,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING id INTO v_referee_profile_id;

    -- Create record in referrals table (idempotent)
    INSERT INTO public.referrals (
        referrer_user_id, 
        referred_user_id, 
        referral_code, 
        status,
        created_at
    )
    VALUES (
        v_referrer_id, 
        p_user_id, 
        v_clean_code, 
        'pending',
        now()
    )
    ON CONFLICT DO NOTHING;

    -- Credit referee (immediate bonus)
    PERFORM public.adjust_sp_wallet(p_user_id, v_referee_sp, 'referral_bonus', 'Referral bonus from ' || p_code);

    -- Credit referrer (initial signup reward)
    PERFORM public.adjust_sp_wallet(v_referrer_id, v_referrer_sp, 'referral_reward', 'Referral reward for ' || p_code);

    -- [BP-4] Log success
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Success', jsonb_build_object(
        'referee_id', p_user_id,
        'referrer_id', v_referrer_id,
        'code', v_clean_code,
        'points_awarded', v_referee_sp
    ));

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'referrer_id', v_referrer_id,
            'points_awarded', v_referee_sp
        )
    );
EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'ERROR', jsonb_build_object('error', SQLERRM, 'user_id', p_user_id));
    RETURN jsonb_build_object('success', false, 'error', 'Internal error processing referral');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill referral_codes from profiles to ensure future consistency
INSERT INTO public.referral_codes (user_id, code, created_at)
SELECT user_id, referral_code, created_at
FROM public.profiles
WHERE referral_code IS NOT NULL
  AND referral_code != ''
  -- Ensure code length is 8 (per constraint)
  AND char_length(referral_code) = 8
  -- Don't insert if already exists
ON CONFLICT (user_id) DO NOTHING;

-- Also try to insert by code to avoid duplicates
INSERT INTO public.referral_codes (user_id, code, created_at)
SELECT user_id, referral_code, created_at
FROM public.profiles p
WHERE referral_code IS NOT NULL
  AND referral_code != ''
  AND char_length(referral_code) = 8
  AND NOT EXISTS (SELECT 1 FROM public.referral_codes rc WHERE LOWER(rc.code) = LOWER(p.referral_code))
ON CONFLICT DO NOTHING;

-- Verification
-- SELECT public.check_referral_code_exists('449611da');
