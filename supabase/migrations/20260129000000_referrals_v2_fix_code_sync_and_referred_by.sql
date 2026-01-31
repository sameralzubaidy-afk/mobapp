-- File: supabase/migrations/20260129000000_referrals_v2_fix_code_sync_and_referred_by.sql
-- Mode B (idempotent / rerunnable): Align legacy profiles.referral_code with V2 referral_codes.code
-- and ensure apply_referral_code sets profiles.referred_by.
--
-- This fixes:
-- 1) App shows referral_codes.code, but profiles.referral_code was generated separately (uppercase) via legacy trigger.
-- 2) profiles.referred_by stayed NULL because apply_referral_code didn't populate it.

-- =============================================================================
-- BLOCK 1 — Schema + Functions
-- Run Block 1 first.
-- =============================================================================

-- 1) Ensure V2 referral_codes table exists
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT referral_codes_code_length CHECK (char_length(code) = 8)
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_idx ON public.referral_codes(LOWER(code));
CREATE INDEX IF NOT EXISTS referral_codes_user_idx ON public.referral_codes(user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Policies (drop then create: rerunnable)
DROP POLICY IF EXISTS "Users can view own referral code" ON public.referral_codes;
CREATE POLICY "Users can view own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- 2) V2: generate_referral_code()
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS(
      SELECT 1 FROM public.referral_codes rc WHERE LOWER(rc.code) = v_code
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- 3) V2: create_referral_code(p_user_id)
CREATE OR REPLACE FUNCTION public.create_referral_code(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT rc.code INTO v_code
  FROM public.referral_codes rc
  WHERE rc.user_id = p_user_id
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RETURN jsonb_build_object('code', v_code, 'created', false);
  END IF;

  v_code := public.generate_referral_code();

  INSERT INTO public.referral_codes (user_id, code)
  VALUES (p_user_id, v_code);

  RETURN jsonb_build_object('code', v_code, 'created', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) V2: apply_referral_code(p_referee_id, p_referral_code)
-- Fix: also set profiles.referred_by
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
BEGIN
  p_referral_code := LOWER(TRIM(p_referral_code));

  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = p_referral_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  SELECT au.email INTO v_referee_email FROM auth.users au WHERE au.id = p_referee_id;
  SELECT au.email INTO v_referrer_email FROM auth.users au WHERE au.id = v_referrer_id;

  IF v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- If already referred, keep idempotent behavior
  IF EXISTS(SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id) THEN
    -- Ensure profiles.referred_by is populated even if referral row already exists
    UPDATE public.profiles p
    SET referred_by = v_referrer_id
    WHERE p.user_id = p_referee_id
      AND p.referred_by IS NULL;

    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer_id, p_referee_id, p_referral_code, 'pending');

  UPDATE public.profiles p
  SET referred_by = v_referrer_id
  WHERE p.user_id = p_referee_id
    AND p.referred_by IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Update handle_new_user() to:
-- - create/get referral_codes row
-- - write profiles.referral_code to match referral_codes.code
-- - apply referral_code from auth metadata (so referral works even if no session yet)
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
-- BLOCK 2 — Security + Performance + Backfills
-- Run Block 2 after Block 1.
-- =============================================================================

-- Remove the redundant auth.users trigger from legacy V2 setup (handle_new_user now owns referral code creation)
DROP TRIGGER IF EXISTS create_referral_code_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.create_referral_code_on_signup();
DROP FUNCTION IF EXISTS create_referral_code_on_signup();

-- Remove legacy profiles trigger that generates UPPERCASE codes in profiles.referral_code
-- This conflicts with handle_new_user which creates lowercase codes in referral_codes table
DROP TRIGGER IF EXISTS trigger_generate_referral_code_on_profile_creation ON public.profiles;
DROP FUNCTION IF EXISTS public.generate_referral_code_on_profile_creation();
DROP FUNCTION IF EXISTS generate_referral_code_on_profile_creation();

-- Dedupe referral_codes: enforce ONE code per user.
-- Keep the row that matches profiles.referral_code when possible; otherwise keep the earliest.
WITH ranked AS (
  SELECT
    rc.id,
    rc.user_id,
    ROW_NUMBER() OVER (
      PARTITION BY rc.user_id
      ORDER BY
        CASE WHEN p.user_id IS NOT NULL AND LOWER(rc.code) = LOWER(p.referral_code) THEN 0 ELSE 1 END,
        rc.created_at ASC,
        rc.id ASC
    ) AS rn
  FROM public.referral_codes rc
  LEFT JOIN public.profiles p ON p.user_id = rc.user_id
)
DELETE FROM public.referral_codes rc
USING ranked r
WHERE rc.id = r.id
  AND r.rn > 1;

-- One referral code per user going forward
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_unique_idx ON public.referral_codes(user_id);

-- Backfill: keep profiles.referral_code in sync with referral_codes.code
UPDATE public.profiles p
SET referral_code = rc.code
FROM public.referral_codes rc
WHERE rc.user_id = p.user_id
  AND (p.referral_code IS NULL OR LOWER(p.referral_code) <> LOWER(rc.code));

-- Backfill: populate profiles.referred_by from referrals table
UPDATE public.profiles p
SET referred_by = r.referrer_user_id
FROM public.referrals r
WHERE r.referred_user_id = p.user_id
  AND p.referred_by IS NULL;

-- Verification queries
-- 1) Mismatches should be 0
-- SELECT COUNT(*) AS mismatches
-- FROM public.profiles p
-- JOIN public.referral_codes rc ON rc.user_id = p.user_id
-- WHERE LOWER(p.referral_code) <> LOWER(rc.code);
--
-- 2) Recent referred users should have referred_by populated
-- SELECT p.user_id, p.referred_by, r.referrer_user_id, r.status
-- FROM public.profiles p
-- JOIN public.referrals r ON r.referred_user_id = p.user_id
-- ORDER BY r.created_at DESC
-- LIMIT 20;
