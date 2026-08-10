-- =============================================================================
-- Migration: 20260811000002_n4_min_age_18_registration_gate.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: N4 Data Privacy — HARD 18+ registration gate (reverses the
--          2026-06-20 COPPA deprecation per owner decision 2026-08-09).
--          No user under 18 may register. Enforcement is layered:
--           1. Client + service layer (primary): signup never calls
--              supabase.auth.signUp for under-18 (nothing is persisted).
--           2. DB backstop (this migration): a BEFORE INSERT trigger on
--              auth.users raises when raw_user_meta_data.dob is present and
--              the computed age is below the minimum, which ABORTS the
--              auth.users insert so no row / profile / subscription is created.
--
-- New objects:
--   * public.is_signup_age_allowed(p_dob DATE, p_min_age INTEGER DEFAULT 18)
--   * public.enforce_min_age_on_signup() BEFORE INSERT trigger on auth.users
--   * admin_config key 'min_registration_age' (default '18')
--
-- Notes:
--   - Users created WITHOUT a dob in raw_user_meta_data are NOT blocked here
--     (cannot verify age); the client gate is authoritative for those flows.
--   - Seed/test users using dob >= 18 (e.g. 2000-01-01) are unaffected.
--   - scripts/create-test-users.js currently generates under-18 DOBs and MUST
--     be updated to 18+ (handled separately).
--
-- Common failure modes:
--   - auth.signUp returns "Database error saving new user" for under-18: this
--     is the intended hard block (the trigger raised and aborted the insert).
--   - admin_config key UNIQUE: use INSERT ... ON CONFLICT DO NOTHING.
--   - COALESCE default 18 (BP-22) so a missing config row still enforces 18.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Age eligibility RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_signup_age_allowed(
  p_dob DATE,
  p_min_age INTEGER DEFAULT 18
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
-- N4: returns TRUE when the given DOB means the user is at least p_min_age.
-- NULL dob or NULL min_age -> FALSE (fail closed: cannot verify -> not allowed).
DECLARE
  v_age INTEGER;
BEGIN
  IF p_dob IS NULL OR p_min_age IS NULL THEN
    RETURN FALSE;
  END IF;

  v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_dob))::INTEGER;
  RETURN v_age >= p_min_age;
END;
$$;

COMMENT ON FUNCTION public.is_signup_age_allowed(DATE, INTEGER) IS
  'N4: TRUE if the DOB implies age >= p_min_age (default 18). NULL -> FALSE (fail closed).';

GRANT EXECUTE ON FUNCTION public.is_signup_age_allowed(DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_signup_age_allowed(DATE, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.is_signup_age_allowed(DATE, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Hard server-side backstop: BEFORE INSERT trigger on auth.users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_min_age_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- SECURITY DEFINER: reads admin_config. Search path pinned to public.
-- BEFORE INSERT on auth.users: raising here ABORTS the auth.users insert, so
-- NO auth.users row / profile / subscription is persisted for under-18 users.
DECLARE
  v_dob_raw TEXT;
  v_dob DATE;
  v_age INTEGER;
  v_min_age INTEGER;
BEGIN
  v_dob_raw := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'dob', '')), '');

  -- No DOB supplied: cannot verify age. Client gate is authoritative here.
  IF v_dob_raw IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_dob := v_dob_raw::DATE;
  EXCEPTION WHEN OTHERS THEN
    -- Unparseable DOB: treat as unverifiable, do not block (client gate handles it).
    RETURN NEW;
  END;

  v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;

  -- Min age from admin_config (BP-22 COALESCE default 18; key is UNIQUE).
  SELECT COALESCE(NULLIF(ac.value, '')::INTEGER, 18)
    INTO v_min_age
  FROM public.admin_config ac
  WHERE ac.key = 'min_registration_age'
    AND ac.is_active = TRUE;

  IF v_min_age IS NULL THEN
    v_min_age := 18;
  END IF;

  IF v_age < v_min_age THEN
    -- Audit the block (must never be swallowed per BP-4).
    BEGIN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'enforce_min_age_on_signup',
        'BLOCKED_UNDER_MIN_AGE',
        jsonb_build_object(
          'email', NEW.email,
          'age', v_age,
          'min_age', v_min_age,
          'attempted_at', NOW()
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RAISE EXCEPTION 'AGE_MINIMUM_REQUIRED: You must be at least % years old to use Pass It Up', v_min_age
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_min_age_on_signup() IS
  'N4: BEFORE INSERT trigger on auth.users that aborts signup for users whose '
  'dob implies age < min_registration_age (default 18). Aborting the insert '
  'ensures no account data is persisted.';

DROP TRIGGER IF EXISTS on_auth_user_min_age ON auth.users;
CREATE TRIGGER on_auth_user_min_age
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_min_age_on_signup();

-- ---------------------------------------------------------------------------
-- 3) Admin-configurable minimum registration age (default 18)
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'min_registration_age',
  '18',
  'N4: Minimum age required to register. Under this age, signup is blocked (hard gate).',
  'safety',
  'number',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) Verification queries
-- ---------------------------------------------------------------------------
-- A) RPC exists + smoke test (TRUE for 18+ / 2000-01-01, FALSE for 17 / 2010-01-01).
-- SELECT public.is_signup_age_allowed('2000-01-01'::DATE);  -- TRUE
-- SELECT public.is_signup_age_allowed('2010-01-01'::DATE);  -- FALSE
--
-- B) Trigger attached to auth.users.
-- SELECT tgname FROM pg_trigger
-- WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_min_age';
--
-- C) Config seeded.
-- SELECT key, value FROM public.admin_config WHERE key = 'min_registration_age';
