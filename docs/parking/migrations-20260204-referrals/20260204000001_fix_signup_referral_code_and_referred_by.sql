-- File: supabase/migrations/20260204000001_fix_signup_referral_code_and_referred_by.sql
-- Mode B: Idempotent / rerunnable
-- Purpose:
-- - Ensure every new signup gets a referral code persisted to profiles.referral_code
-- - Ensure signup metadata referral codes populate profiles.referred_by + referrals row (server-side)
--
-- Root cause addressed:
-- Some environments had an older handle_new_user() that only called create_referral_code()
-- but never persisted the generated code to profiles.referral_code, and never applied referral codes.
--
-- This migration makes the auth.users trigger authoritative and self-contained.

-- =============================================================================
-- BLOCK 1 — Schema + Functions
-- Run Block 1 first.
-- =============================================================================

-- 1) Safety: ensure profile referral columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID;

-- 2) Ensure referral_codes exists (minimal definition; full policies live elsewhere)
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

-- 3) generate_referral_code(): stable lowercase 8-char
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
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
$$;

-- 4) create_referral_code(p_user_id): return JSONB (contract used by mobile + tests)
-- Also: if a profile exists and referral_code is NULL, backfill it.
CREATE OR REPLACE FUNCTION public.create_referral_code(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT rc.code INTO v_code
  FROM public.referral_codes rc
  WHERE rc.user_id = p_user_id
  LIMIT 1;

  IF v_code IS NULL THEN
    v_code := public.generate_referral_code();

    INSERT INTO public.referral_codes (user_id, code)
    VALUES (p_user_id, v_code);
  END IF;

  -- Best-effort: sync profiles.referral_code if profile row exists
  UPDATE public.profiles p
  SET referral_code = v_code
  WHERE p.user_id = p_user_id
    AND p.referral_code IS NULL;

  RETURN jsonb_build_object('code', v_code, 'created', true);
EXCEPTION WHEN unique_violation THEN
  -- If a race inserts the same user_id/code, re-read.
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
END;
$$;

-- 5) apply_referral_code(p_referee_id, p_referral_code)
-- Must set profiles.referred_by even when idempotently returning "already applied".
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
BEGIN
  v_clean_code := LOWER(TRIM(p_referral_code));

  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = v_clean_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  SELECT au.email INTO v_referee_email FROM auth.users au WHERE au.id = p_referee_id;
  SELECT au.email INTO v_referrer_email FROM auth.users au WHERE au.id = v_referrer_id;

  IF v_referee_email IS NOT NULL AND v_referrer_email IS NOT NULL AND v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Ensure profile linkage is set even if referral row already exists
  UPDATE public.profiles p
  SET referred_by = v_referrer_id
  WHERE p.user_id = p_referee_id
    AND p.referred_by IS NULL;

  IF EXISTS(SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer_id, p_referee_id, v_clean_code, 'pending');

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$;

-- 6) handle_new_user(): insert profile, persist referral_code, apply referral from metadata
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

  -- Normalize metadata key variants (app historically sent different keys)
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

  IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::date;
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
    END;
  END IF;

  -- Ensure the user has a referral code; then persist it to profiles.referral_code
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

  -- Apply referral code from signup metadata (best-effort, server-side)
  IF v_referral_input IS NOT NULL THEN
    BEGIN
      PERFORM public.apply_referral_code(NEW.id, v_referral_input);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Referral code apply failed for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 7) handle_user_update(): keep email/phone in sync; never null out referral fields
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET
    email = NEW.email,
    phone = COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone)
  WHERE p.user_id = NEW.id;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCK 2 — Triggers + Backfills
-- Run Block 2 after Block 1.
-- =============================================================================

-- 1) Ensure triggers are attached to auth.users
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

-- 2) Backfill missing referral_codes + profiles.referral_code
INSERT INTO public.referral_codes (user_id, code)
SELECT p.user_id, public.generate_referral_code()
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
WHERE rc.user_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.profiles p
SET referral_code = rc.code
FROM public.referral_codes rc
WHERE rc.user_id = p.user_id
  AND p.referral_code IS NULL;

-- 3) Backfill referred_by from referrals (safe / idempotent)
UPDATE public.profiles p
SET referred_by = r.referrer_user_id
FROM public.referrals r
WHERE r.referred_user_id = p.user_id
  AND p.referred_by IS NULL;

-- =============================================================================
-- VERIFICATION QUERIES (run manually)
-- =============================================================================
-- -- A) Confirm triggers exist
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname IN ('on_auth_user_created','on_auth_user_updated');
--
-- -- B) Confirm function definitions are current
-- SELECT proname, pg_get_functiondef(p.oid)
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname IN ('handle_new_user','apply_referral_code','create_referral_code');
--
-- -- C) After a new signup, validate:
-- SELECT p.user_id, p.referral_code, p.referred_by
-- FROM public.profiles p
-- ORDER BY p.created_at DESC
-- LIMIT 20;
