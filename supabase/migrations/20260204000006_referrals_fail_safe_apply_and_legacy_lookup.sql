-- File: supabase/migrations/20260204000006_referrals_fail_safe_apply_and_legacy_lookup.sql
-- Mode B: Idempotent / rerunnable
-- Purpose:
-- - Fix referred_by staying NULL when the referrer code exists only in legacy profiles.referral_code
--   (referral_codes row missing/desynced) by adding a safe fallback lookup.
-- - Add a fail-safe profiles trigger that applies the signup referral metadata even if the auth.users
--   trigger was missing/disabled at the time of signup.
--
-- Outcome:
-- - public.apply_referral_code() resolves referrer from referral_codes OR profiles.referral_code
-- - profiles.referred_by_code is stored when referral is applied
-- - profiles trigger attempts to apply auth.users.raw_user_meta_data referral code once per profile insert

-- =============================================================================
-- BLOCK 1 — Schema + Functions
-- =============================================================================

-- Ensure core referral columns exist (some environments may have drift)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID;

-- Ensure audit column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

-- Harden apply_referral_code:
-- - row_security=off so it works from triggers even when RLS/policies are incomplete
-- - fallback lookup to legacy profiles.referral_code for older environments
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
  v_referrer_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
  v_clean_code TEXT;
BEGIN
  v_clean_code := LOWER(TRIM(p_referral_code));

  IF v_clean_code IS NULL OR v_clean_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code is required');
  END IF;

  -- Authorization:
  -- - Client calls must be authenticated AND can only apply a referral code to themselves.
  -- - Trigger/SQL-editor contexts typically have auth.role() / auth.uid() = NULL; allow those.
  IF auth.uid() IS NULL THEN
    IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
  ELSE
    IF auth.uid() <> p_referee_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
  END IF;

  -- Primary source: V2 referral_codes
  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = v_clean_code
  LIMIT 1;

  -- Fallback: legacy profiles.referral_code
  IF v_referrer_id IS NULL THEN
    SELECT p.user_id INTO v_referrer_id
    FROM public.profiles p
    WHERE p.referral_code IS NOT NULL
      AND LOWER(p.referral_code) = v_clean_code
    LIMIT 1;
  END IF;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  SELECT au.email INTO v_referee_email FROM auth.users au WHERE au.id = p_referee_id;
  SELECT au.email INTO v_referrer_email FROM auth.users au WHERE au.id = v_referrer_id;

  IF v_referee_email IS NOT NULL
     AND v_referrer_email IS NOT NULL
     AND v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Persist the fact the user typed this code (even if referral row already exists).
  UPDATE public.profiles p
  SET
    referred_by = COALESCE(p.referred_by, v_referrer_id),
    referred_by_code = COALESCE(p.referred_by_code, v_clean_code)
  WHERE p.user_id = p_referee_id
    AND (p.referred_by IS NULL OR p.referred_by_code IS NULL);

  -- Only allow one referral per referred user.
  IF EXISTS(
    SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id
  ) THEN
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

-- SECURITY: apply_referral_code is SECURITY DEFINER + row_security=off, so EXECUTE must be restricted.
REVOKE ALL ON FUNCTION public.apply_referral_code(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO service_role;

-- Fail-safe: apply referral based on auth.users metadata when profile is created.
-- This covers cases where the auth.users trigger was not attached/enabled.
CREATE OR REPLACE FUNCTION public.apply_profile_signup_referral_from_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_referral_input TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only attempt when linkage not set yet
  IF NEW.referred_by IS NOT NULL AND NEW.referred_by_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(
    TRIM(
      COALESCE(
        au.raw_user_meta_data->>'referral_code',
        au.raw_user_meta_data->>'referralCode',
        au.raw_user_meta_data->>'referrer_code',
        au.raw_user_meta_data->>'referrerCode',
        ''
      )
    ),
    ''
  )
  INTO v_referral_input
  FROM auth.users au
  WHERE au.id = NEW.user_id;

  IF v_referral_input IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.apply_referral_code(NEW.user_id, v_referral_input);
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort: never block profile creation
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCK 2 — Triggers + Verification
-- =============================================================================

DROP TRIGGER IF EXISTS trg_profiles_apply_signup_referral_ins ON public.profiles;
CREATE TRIGGER trg_profiles_apply_signup_referral_ins
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referred_by IS NULL OR NEW.referred_by_code IS NULL)
  EXECUTE FUNCTION public.apply_profile_signup_referral_from_metadata();

-- Verification (run manually in Supabase SQL Editor)
-- 1) Confirm function definitions include fallback + row_security=off
-- SELECT proname, pg_get_functiondef(p.oid)
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname='public' AND p.proname IN ('apply_referral_code','apply_profile_signup_referral_from_metadata');
--
-- 2) Confirm trigger exists
-- SELECT tgname, tgenabled, pg_get_triggerdef(t.oid)
-- FROM pg_trigger t
-- WHERE t.tgrelid = 'public.profiles'::regclass
--   AND t.tgname = 'trg_profiles_apply_signup_referral_ins';
--
-- 3) Backfill a known impacted user (example)
-- SELECT public.apply_referral_code('4b30ebe4-35b4-4007-a6b4-f37e2232faa4'::uuid, 'ca95f95d');
-- SELECT p.user_id, p.referred_by, p.referred_by_code FROM public.profiles p
-- WHERE p.user_id = '4b30ebe4-35b4-4007-a6b4-f37e2232faa4'::uuid;
