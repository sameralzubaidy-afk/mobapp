-- File: supabase/migrations/20260204000007_referrals_secure_apply_referral_code.sql
-- Mode B: Idempotent / rerunnable
-- Purpose:
-- - SECURITY: prevent unauthenticated/anon callers from invoking public.apply_referral_code()
--   (function is SECURITY DEFINER + row_security=off, so execute privilege MUST be locked down).
-- - UX: make apply_referral_code idempotent; if already applied, return success=true.
--
-- =============================================================================
-- BLOCK 1 — Function update
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
  v_referee_email TEXT;
  v_referrer_email TEXT;
  v_clean_code TEXT;
  v_existing_referrer_id UUID;
  v_referrer_profile_id UUID;
  v_referee_profile_id UUID;
BEGIN
  v_clean_code := LOWER(TRIM(p_referral_code));

  RAISE NOTICE 'apply_referral_code: p_referral_code=%, v_clean_code=%', p_referral_code, v_clean_code;

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

  -- Get referee profile info
  SELECT p.id, p.referred_by INTO v_referee_profile_id, v_existing_referrer_id
  FROM public.profiles p
  WHERE p.user_id = p_referee_id;

  IF v_referee_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referee profile not found');
  END IF;

  IF v_existing_referrer_id IS NOT NULL THEN
    -- Best-effort: if the provided code resolves to the same referrer, persist referred_by_code and
    -- ensure the referrals row exists (covers older rows missing referred_by_code).
    SELECT rc.user_id INTO v_referrer_id
    FROM public.referral_codes rc
    WHERE rc.code = v_clean_code
    LIMIT 1;

    RAISE NOTICE 'apply_referral_code: idempotent v_referrer_id=%', v_referrer_id;

    IF v_referrer_id IS NULL THEN
      SELECT p.user_id INTO v_referrer_id
      FROM public.profiles p
      WHERE p.referral_code IS NOT NULL
        AND p.referral_code = v_clean_code
      LIMIT 1;
    END IF;

    IF v_referrer_id IS NOT NULL AND v_referrer_id = v_existing_referrer_id THEN
      UPDATE public.profiles p
      SET referred_by_code = COALESCE(p.referred_by_code, v_clean_code)
      WHERE p.user_id = p_referee_id;

      IF NOT EXISTS(
        SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id
      ) THEN
        -- Get referrer profile id
        SELECT p.id INTO v_referrer_profile_id FROM public.profiles p WHERE p.user_id = v_existing_referrer_id;

        INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code, status, referrer_id, referee_id)
        VALUES (v_existing_referrer_id, p_referee_id, v_clean_code, 'pending', v_referrer_profile_id, v_referee_profile_id);
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'referrer_id', v_existing_referrer_id,
      'message', 'Referral already applied'
    );
  END IF;

  -- Primary source: referral_codes
  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE rc.code = v_clean_code
  LIMIT 1;

  RAISE NOTICE 'apply_referral_code: main v_referrer_id=%', v_referrer_id;

  -- Fallback: legacy profiles.referral_code
  IF v_referrer_id IS NULL THEN
    SELECT p.user_id INTO v_referrer_id
    FROM public.profiles p
    WHERE p.referral_code IS NOT NULL
      AND p.referral_code = v_clean_code
    LIMIT 1;
  END IF;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Get profile ids for the final application
  SELECT p.id INTO v_referrer_profile_id FROM public.profiles p WHERE p.user_id = v_referrer_id;
  
  IF v_referrer_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referrer profile not found');
  END IF;

  SELECT au.email INTO v_referee_email FROM auth.users au WHERE au.id = p_referee_id;
  SELECT au.email INTO v_referrer_email FROM auth.users au WHERE au.id = v_referrer_id;

  IF v_referee_email IS NOT NULL
     AND v_referrer_email IS NOT NULL
     AND v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  UPDATE public.profiles p
  SET
    referred_by = v_referrer_id,
    referred_by_code = COALESCE(p.referred_by_code, v_clean_code)
  WHERE p.id = v_referee_profile_id
    AND p.referred_by IS NULL;

  -- Insert event row if missing
  IF NOT EXISTS(
    SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id
  ) THEN
    INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code, status, referrer_id, referee_id)
    VALUES (v_referrer_id, p_referee_id, v_clean_code, 'pending', v_referrer_profile_id, v_referee_profile_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$;

-- =============================================================================
-- BLOCK 2 — Privileges + Verification
-- =============================================================================

-- Lock down execute privileges.
REVOKE ALL ON FUNCTION public.apply_referral_code(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO service_role;

-- Verification
-- 1) Confirm execute privileges are locked down
-- SELECT n.nspname, p.proname, p.proargtypes::regtype[] AS args,
--        has_function_privilege('anon', n.nspname||'.'||p.proname||'(uuid,text)', 'EXECUTE') AS anon_exec,
--        has_function_privilege('authenticated', n.nspname||'.'||p.proname||'(uuid,text)', 'EXECUTE') AS auth_exec
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname='public' AND p.proname='apply_referral_code';
--
-- 2) Backfill example (run as SQL editor / service role)
-- SELECT public.apply_referral_code('4b30ebe4-35b4-4007-a6b4-f37e2232faa4'::uuid, 'ca95f95d');
