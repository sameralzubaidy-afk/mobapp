-- File: supabase/migrations/20260420000015_check_account_exists_rpc.sql
-- MODULE-03 AUTH V3: Create check_account_exists_by_email SECURITY DEFINER RPC
-- Task: AUTH-V3-001 / AUTH-V3-004 (deferred migration — now shipped)
-- Dependencies: auth.users, auth.identities (both exist from project start)
-- Version: 1.0
-- Created: 2026-08-16
--
-- BACKGROUND (why this migration exists):
--   AUTH-V3-004 shipped accountService.checkAccountExists() already CALLING this
--   RPC, but the migration was deferred ("optional follow-up ... decided during
--   AUTH-V3-004 implementation" — MODULE-03-AUTH-V3-SOCIAL-LOGIN.md) and never
--   created. Without it, checkAccountExists() falls back to a CURRENT-USER-ONLY
--   check, which can never fire the AccountLinkingPrompt (userId-mismatch) branch
--   and disables the password re-auth guard that prevents account takeover
--   (docx/SOCIAL-LOGIN-REQUIREMENTS.md §2 "Security"). This ships the RPC that
--   the shipped client already calls — no client code change required.
--
-- MODE: Mode B — idempotent rerunnable (CREATE OR REPLACE + REVOKE/GRANT +
--   COMMENT are safe to re-run; no tables/policies created).

-- =============================================================================
-- BLOCK 1 — Schema: CREATE check_account_exists_by_email RPC
-- =============================================================================
-- SECURITY DEFINER: `authenticated` cannot read auth.users directly (restricted
--   schema). The OAuth callback path needs a CROSS-ACCOUNT existence lookup to
--   detect a different user already owning the email — this drives the account
--   linking prompt + password re-auth guard. SET search_path per BP-5 and the
--   314_prod_p1_security_definer_search_path_hardening.sql convention.
-- RETURN TYPE = jsonb (NOT TABLE): PostgREST returns a JSON ARRAY for a
--   RETURNS TABLE function even with one row, but the shipped client reads the
--   object fields directly (userData.exists / user_id / providers /
--   has_password), so jsonb keeps the deployed client and its unit tests
--   working unchanged (Backward Compatibility Gate / SQL-8).
CREATE OR REPLACE FUNCTION public.check_account_exists_by_email(
  p_email TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_has_password BOOLEAN;
  v_providers TEXT[];
BEGIN
  -- Normalize + guard input
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN jsonb_build_object(
      'exists', false,
      'user_id', NULL,
      'providers', '[]'::jsonb,
      'has_password', false
    );
  END IF;

  -- 1. Cross-account existence lookup (case-insensitive) across ALL auth.users.
  --    Returns the owning user's id so the client can compare it against the
  --    current session user and decide prompt-vs-continue.
  SELECT u.id
    INTO v_user_id
    FROM auth.users u
   WHERE lower(u.email) = lower(btrim(p_email))
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'exists', false,
      'user_id', NULL,
      'providers', '[]'::jsonb,
      'has_password', false
    );
  END IF;

  -- 2. has_password: a non-empty encrypted_password means password login is
  --    enabled (social-only accounts store an empty string). This is more
  --    accurate than the client's "email identity present" approximation.
  SELECT (u.encrypted_password IS NOT NULL AND btrim(u.encrypted_password) <> '')
    INTO v_has_password
    FROM auth.users u
   WHERE u.id = v_user_id;

  -- 3. providers: distinct identity providers (incl. 'email') on the account.
  SELECT COALESCE(array_agg(DISTINCT i.provider ORDER BY i.provider), ARRAY[]::TEXT[])
    INTO v_providers
    FROM auth.identities i
   WHERE i.user_id = v_user_id;

  RETURN jsonb_build_object(
    'exists', true,
    'user_id', v_user_id,
    'providers', COALESCE(v_providers, ARRAY[]::TEXT[]),
    'has_password', COALESCE(v_has_password, false)
  );
END;
$$;

-- =============================================================================
-- BLOCK 2 — Security: revoke from PUBLIC + anon, grant to authenticated, comment
-- =============================================================================
-- NOTE: Supabase default privileges grant EXECUTE to anon/authenticated/
-- service_role at CREATE time (owner = postgres). REVOKE ... FROM PUBLIC alone
-- does NOT remove those explicit per-role grants — an explicit
-- REVOKE ... FROM anon is required so unauthenticated callers cannot use this
-- as an email-existence/has-password oracle. (Verified live 2026-08-16:
-- proacl showed anon=X/postgres until this REVOKE was applied.)

REVOKE ALL ON FUNCTION public.check_account_exists_by_email(TEXT) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.check_account_exists_by_email(TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.check_account_exists_by_email(TEXT) TO authenticated;

COMMENT ON FUNCTION public.check_account_exists_by_email(TEXT) IS
'MODULE-03 AUTH V3: SECURITY DEFINER RPC powering accountService.checkAccountExists(). '
'Cross-account email-existence lookup over auth.users (case-insensitive), returning '
'{exists, user_id, providers, has_password} as jsonb. Drives the AccountLinkingPrompt '
'(userId-mismatch) branch and the password re-auth guard that prevents account takeover. '
'NOTE: exposes an email-existence oracle to any AUTHENTICATED caller — inherent to the '
'account-linking feature; anon/PUBLIC cannot call it (REVOKEd from PUBLIC).';

-- =============================================================================
-- VERIFICATION QUERIES (BP-6 / BP-10)
-- =============================================================================

-- 1. Function exists, is SECURITY DEFINER, correct signature
-- Expected: 1 row, prosecdef = true, args = (p_email TEXT)
SELECT p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'check_account_exists_by_email';

-- 2. Return type is jsonb
-- Expected: 1 row, result = jsonb
SELECT p.proname, pg_get_function_result(p.oid) AS result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'check_account_exists_by_email';

-- 3. Grants: EXECUTE granted to authenticated, NOT to anon/PUBLIC
-- Expected: 1 row with grantee = authenticated (and NO 'PUBLIC' grantee)
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'check_account_exists_by_email'
  AND privilege_type = 'EXECUTE';

-- 4. Sample call — nonexistent email
-- Expected: {"exists": false, "user_id": null, "providers": [], "has_password": false}
SELECT public.check_account_exists_by_email(
  'definitely-not-a-real-email-' || md5(random()::text) || '@example.com'
);

-- 5. Sample call — existing email (replace with a known account email)
-- Expected: {"exists": true, "user_id": "<uuid>", "providers": ["email", ...], "has_password": true|false}
-- SELECT public.check_account_exists_by_email('known-account-email@example.com');

-- COMMON FAILURE MODES:
-- * Do NOT change RETURNS jsonb to RETURNS TABLE — the deployed client reads
--   object fields directly and would silently break (array/object mismatch).
-- * lower(u.email) has no dedicated index on auth.users; full scan is acceptable
--   for a low-frequency OAuth callback check (account count is small).
-- * Removing SECURITY DEFINER breaks this (authenticated cannot read auth.users).
