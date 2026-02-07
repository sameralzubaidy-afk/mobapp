-- File: supabase/migrations/20260205000002_fix_referral_and_items_schema_mismatch.sql
-- Mode B: Idempotent / rerunnable
-- Purpose: 
-- 1. Fix "null value in column 'referrer_id'" by making it and referee_id nullable in referrals table.
-- 2. Ensure all referral related columns are unified.
-- 3. Update apply_referral_code to be highly resilient to schema drift.

-- =============================================================================
-- BLOCK 1 — Alter referrals table
-- =============================================================================

DO $$
BEGIN
    -- Check if referrer_id column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'referrals' 
        AND column_name = 'referrer_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.referrals ALTER COLUMN referrer_id DROP NOT NULL;
    END IF;

    -- Check if referee_id column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'referrals' 
        AND column_name = 'referee_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.referrals ALTER COLUMN referee_id DROP NOT NULL;
    END IF;

    -- Ensure we have the modern UUID columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referrer_user_id') THEN
        ALTER TABLE public.referrals ADD COLUMN referrer_user_id UUID REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referred_user_id') THEN
        ALTER TABLE public.referrals ADD COLUMN referred_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- =============================================================================
-- BLOCK 2 — Update apply_referral_code to handle both column sets
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_referrer_id UUID; -- This will be the user_id (auth.users.id)
  v_clean_code TEXT;
  v_existing_referrer_id UUID;
  v_referrer_profile_id UUID;
  v_referee_profile_id UUID;
  v_has_profile_cols BOOLEAN;
BEGIN
  v_clean_code := LOWER(TRIM(p_referral_code));

  IF v_clean_code IS NULL OR v_clean_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code is required');
  END IF;

  -- Authorization
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get referee profile info
  SELECT p.id, p.referred_by INTO v_referee_profile_id, v_existing_referrer_id
  FROM public.profiles p
  WHERE p.user_id = p_referee_id;

  IF v_referee_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referee profile not found');
  END IF;

  -- If already has a referrer, we might want to return success or error
  -- For idempotency, if the code matches the existing referrer, we return success.
  IF v_existing_referrer_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Referral already applied');
  END IF;

  -- Resolve referral code to user_id (v_referrer_id)
  -- 1. Check referral_codes table
  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE rc.code = v_clean_code
  LIMIT 1;

  -- 2. Fallback to profiles.referral_code
  IF v_referrer_id IS NULL THEN
    SELECT p.user_id INTO v_referrer_id
    FROM public.profiles p
    WHERE p.referral_code = v_clean_code
    LIMIT 1;
  END IF;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Get profile ids for legacy support
  SELECT p.id INTO v_referrer_profile_id FROM public.profiles p WHERE p.user_id = v_referrer_id;

  -- Update profile
  UPDATE public.profiles p
  SET 
    referred_by = v_referrer_id,
    referred_by_code = v_clean_code
  WHERE p.user_id = p_referee_id;

  -- Detect schema of referrals table
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referrer_id') INTO v_has_profile_cols;

  -- Create referral entry
  IF v_has_profile_cols THEN
    INSERT INTO public.referrals (
      referrer_user_id, referred_user_id, referral_code, status, 
      referrer_id, referee_id
    )
    VALUES (
      v_referrer_id, p_referee_id, v_clean_code, 'pending',
      v_referrer_profile_id, v_referee_profile_id
    )
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.referrals (
      referrer_user_id, referred_user_id, referral_code, status
    )
    VALUES (
      v_referrer_id, p_referee_id, v_clean_code, 'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$;
