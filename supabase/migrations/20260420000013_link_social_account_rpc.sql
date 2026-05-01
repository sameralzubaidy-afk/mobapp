-- File: supabase/migrations/20260420000013_link_social_account_rpc.sql
-- MODULE-03 AUTH V3: Create link_social_account SECURITY DEFINER RPC
-- Task: AUTH-V3-001 (Schema Migrations — Link RPC)
-- Dependencies: profiles table, admin_audit_logs table
-- Version: 1.0
-- Created: April 30, 2026

-- =============================================================================
-- 1. CREATE link_social_account RPC
-- =============================================================================
-- SECURITY DEFINER: Allows linking providers even when RLS would normally block reads of other users' identities.
-- Email-match guard: Throws EmailMismatchError if auth.users.email != provider_email for the authenticated user.
-- Audit logging: Writes to admin_audit_logs on success.

CREATE OR REPLACE FUNCTION public.link_social_account(
  p_provider_name TEXT,
  p_provider_user_id TEXT,
  p_provider_email TEXT,
  p_provider_data JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- 1. Verify user is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NotAuthenticated: User must be signed in to link a social account.';
  END IF;

  -- 2. Get user's primary email from auth.users
  SELECT u.email INTO v_user_email
  FROM auth.users u
  WHERE u.id = v_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'UserNotFound: No email found for authenticated user %.', v_user_id;
  END IF;

  -- 3. Validate email match (case-insensitive)
  IF LOWER(v_user_email) <> LOWER(p_provider_email) THEN
    RAISE EXCEPTION 'EmailMismatchError: User email (%) does not match provider email (%). Cannot link account.',
      v_user_email, p_provider_email;
  END IF;

  -- 4. Write audit log (using admin_audit_logs table)
  -- Note: The actual linking happens in auth.identities managed by Supabase Auth.
  -- This RPC validates the preconditions and logs the action.
  -- The calling code (AccountService) must call supabase.auth.linkIdentity after this RPC succeeds.
  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    details,
    created_at
  ) VALUES (
    v_user_id,
    'link_social_account',
    'auth_identity',
    v_user_id, -- entity_id is user_id (identity doesn't have separate ID exposed)
    jsonb_build_object(
      'provider', p_provider_name,
      'provider_user_id', p_provider_user_id,
      'provider_email', p_provider_email,
      'provider_data_keys', jsonb_object_keys(p_provider_data)
    ),
    NOW()
  );

  -- Success (no return value needed)
END;
$$;

-- =============================================================================
-- 2. GRANT EXECUTE TO AUTHENTICATED ROLE
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.link_social_account(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- =============================================================================
-- 3. COMMENTS
-- =============================================================================

COMMENT ON FUNCTION public.link_social_account(TEXT, TEXT, TEXT, JSONB) IS
'MODULE-03 AUTH V3: SECURITY DEFINER RPC to validate preconditions for linking a social provider. '
'Verifies user is authenticated and provider email matches auth.users.email (case-insensitive). '
'Throws EmailMismatchError on mismatch. Writes audit_log on success. '
'The actual provider linking (auth.identities insert) is performed by Supabase Auth via supabase.auth.linkIdentity call from AccountService.';

-- =============================================================================
-- 4. VERIFICATION QUERIES
-- =============================================================================

-- Verify function exists and is SECURITY DEFINER
-- Expected: 1 row with prosecdef = true
SELECT p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'link_social_account';

-- Verify function has correct signature
-- Expected: 1 row with 4 parameters (TEXT, TEXT, TEXT, JSONB)
SELECT p.proname,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'link_social_account';

-- Test email mismatch guard (should throw EmailMismatchError)
-- NOTE: This will only work if you're authenticated. Run manually as a signed-in user.
-- Expected: ERROR with message containing 'EmailMismatchError'
-- SELECT public.link_social_account('google', 'test123', 'wrong@example.com', '{}'::jsonb);

-- Verify audit log writes (check after successful link)
-- Expected: 1+ rows with action = 'link_social_account' after running the function successfully
SELECT actor_id, action, entity_type, details->>'provider' AS provider, created_at
FROM public.admin_audit_logs
WHERE action = 'link_social_account'
ORDER BY created_at DESC
LIMIT 5;
