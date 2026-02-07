-- File: supabase/migrations/20260204000005_referrals_apply_store_typed_code.sql
-- Mode B: Idempotent / rerunnable
-- Purpose:
-- - Ensure the referral code a user ENTERS at signup is persisted and applied.
-- - Fix a common failure mode where apply_referral_code() fails under RLS because referrals has no INSERT policy.
--
-- Outcome:
-- - profiles.referred_by is set to the referrer's user_id
-- - profiles.referred_by_code stores the normalized referral code the user entered
-- - referrals row is inserted (append-only record)

-- =============================================================================
-- BLOCK 1 — Schema + Functions
-- Run Block 1 first.
-- =============================================================================

-- Store the typed referral code for audit / support visibility.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

-- Harden apply_referral_code against RLS by running with row_security=off,
-- while still enforcing that a client can only apply a code for themselves.
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

  -- Authorization: when called from the client, only allow applying for yourself.
  -- Note: when called from auth.users trigger, auth.uid() is NULL (allowed).
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

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

  -- Persist the fact the user typed this code (even if referral row already exists).
  UPDATE public.profiles p
  SET
    referred_by = COALESCE(p.referred_by, v_referrer_id),
    referred_by_code = COALESCE(p.referred_by_code, v_clean_code)
  WHERE p.user_id = p_referee_id
    AND (p.referred_by IS NULL OR p.referred_by_code IS NULL);

  -- Only allow one referral per referred user.
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

GRANT EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO authenticated;

-- =============================================================================
-- BLOCK 2 — Verification
-- =============================================================================
-- 1) Confirm column exists
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='profiles' AND column_name='referred_by_code';
--
-- 2) Confirm function has row_security=off
-- SELECT proname, pg_get_functiondef(p.oid)
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname='public' AND p.proname='apply_referral_code';
--
-- 3) After a signup with a referral code, verify:
-- SELECT p.user_id, p.referred_by, p.referred_by_code
-- FROM public.profiles p
-- ORDER BY p.created_at DESC
-- LIMIT 10;
--
-- SELECT r.referrer_user_id, r.referred_user_id, r.referral_code, r.status, r.created_at
-- FROM public.referrals r
-- ORDER BY r.created_at DESC
-- LIMIT 10;
