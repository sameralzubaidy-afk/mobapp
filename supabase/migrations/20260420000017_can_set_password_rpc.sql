-- File: supabase/migrations/20260420000017_can_set_password_rpc.sql
-- MODULE-03 AUTH V3: Create can_set_password SECURITY DEFINER RPC
-- Task: AUTH-V3-006 (deferred migration — now shipped)
-- Dependencies: auth.users (exists from project start)
-- Version: 1.0
-- Created: 2026-09-07
--
-- BACKGROUND (why this migration exists):
--   passwordService.canSetPassword() and accountService.checkIfUserHasPassword()
--   both call the RPC `can_set_password(p_user_id)`. AUTH-V3-006's design doc
--   (Prompts/V3/MODULE-03-AUTH-V3-SOCIAL-LOGIN.md) reserved this migration as
--   an "optional follow-up if RLS blocks direct reads" but it was never
--   created. On staging the RPC does NOT exist, so canSetPassword() fails
--   closed (false) and setPasswordForSocialUser() rejects EVERY attempt with
--   NOT_ALLOWED — which made the social-only "set a password" flow
--   (AUTH-TC-C07) undrivable even after the fixture's encrypted_password was
--   NULLed. This ships the RPC that the shipped client already calls — no
--   client code change required.
--
-- MODE: Mode B — idempotent rerunnable (CREATE OR REPLACE + REVOKE/GRANT +
--   COMMENT are safe to re-run; no tables/policies created).

-- =============================================================================
-- BLOCK 1 — Schema: CREATE can_set_password RPC
-- =============================================================================
-- SECURITY DEFINER: `authenticated` cannot read auth.users directly (restricted
--   schema). The social-only "set a password" flow needs a has-password check
--   over auth.users.encrypted_password. SET search_path per BP-5 and the
--   314_prod_p1_security_definer_search_path_hardening.sql convention.
-- RETURN TYPE = boolean (scalar): PostgREST returns a JSON boolean for a scalar
--   function, and the shipped client reads it as `data === true`
--   (passwordService.canSetPassword) — no RETURNS TABLE here on purpose.
CREATE OR REPLACE FUNCTION public.can_set_password(p_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_encrypted_password TEXT;
BEGIN
  -- Guard: a NULL/absent user id can never "set a password" (fail closed).
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- has_password semantics match check_account_exists_by_email: a non-empty
  -- encrypted_password means password login is enabled (social-only accounts
  -- store NULL / empty). Absent user row → treat as NULL → not password-able.
  SELECT u.encrypted_password
    INTO v_encrypted_password
    FROM auth.users u
   WHERE u.id = p_user_id;

  IF v_encrypted_password IS NULL THEN
    RETURN true;
  END IF;

  RETURN btrim(v_encrypted_password) = '';
END;
$$;

-- =============================================================================
-- BLOCK 2 — Security: revoke from PUBLIC + anon, grant to authenticated, comment
-- =============================================================================
-- Mirrors 20260420000015_check_account_exists_rpc.sql exactly: REVOKE FROM
-- PUBLIC alone does NOT remove Supabase's explicit per-role grants — an
-- explicit REVOKE ... FROM anon is required so unauthenticated callers cannot
-- probe which accounts have passwords. service_role keeps EXECUTE via the
-- Supabase default grant (needed by the seed's verification step).

REVOKE ALL ON FUNCTION public.can_set_password(UUID) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.can_set_password(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.can_set_password(UUID) TO authenticated;

COMMENT ON FUNCTION public.can_set_password(UUID) IS
'MODULE-03 AUTH V3: SECURITY DEFINER RPC powering passwordService.canSetPassword() '
'and accountService.checkIfUserHasPassword(). Returns true iff auth.users.encrypted_password '
'is NULL/empty for p_user_id (i.e. the user is password-less and eligible to set a password — '
'social-only signup fixture). anon/PUBLIC cannot call it (REVOKEd from PUBLIC).';
