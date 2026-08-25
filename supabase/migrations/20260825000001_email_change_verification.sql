-- =============================================================================
-- Migration: 20260825000001_email_change_verification.sql
-- Mode: B (idempotent rerunnable migration)
-- Module: MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md -> ACC-TC-B02
-- Task: Email change requires re-verification (Dev Task B02, Option A)
--
-- What this migration does:
--   * Creates the email_change_verifications table that stores a pending email
--     change request (the NEW email, a bcrypt hash of the 6-digit code, expiry,
--     attempt counter). The OLD email stays active on auth.users + profiles
--     until the code is verified, then the auth-email-change Edge Function
--     flips auth.users.email + profiles.email and seals the record via
--     complete_email_change().
--   * RLS: service_role full access (Edge Function uses it); authenticated users
--     may read their OWN pending request only (drives a future "pending
--     verification" banner).
--   * RPCs (all SECURITY DEFINER with `SET search_path = public, extensions` so
--     pgcrypto resolves — same fix class as 20260820000001):
--       create_email_change_request  - mint a new request (invalidates prior ones)
--       resend_email_change_code     - re-hash/re-arm the LATEST pending request
--       verify_email_change_code     - bcrypt-check the code, returns new_email
--       complete_email_change        - seal: mark all requests used for the user
--       get_pending_email_change     - read the active pending request (for UI)
--
-- Reuses the EXISTING public.hash_otp_code() RPC (20260820000001) from the
-- Edge Function for hashing; verify_email_change_code() compares with crypt()
-- directly so the code never needs to be stored in plaintext.
--
-- Signatures are all NEW (no CREATE OR REPLACE over an existing signature), so
-- no BP-12 DROP is required. Rerun-safe: CREATE TABLE IF NOT EXISTS + DROP
-- POLICY IF EXISTS + CREATE OR REPLACE FUNCTION.
-- =============================================================================

-- ==================================================
-- STEP 1: email_change_verifications table
-- ==================================================

CREATE TABLE IF NOT EXISTS public.email_change_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_change_verifications_new_email_check
    CHECK (new_email <> '' AND new_email LIKE '%@%'),
  CONSTRAINT email_change_verifications_attempts_check
    CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_email_change_verifications_user_created
  ON public.email_change_verifications(user_id, created_at DESC);

-- RLS: users can read only their own pending requests (write path is the
-- Edge Function via service role).
ALTER TABLE public.email_change_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email change requests" ON public.email_change_verifications;
CREATE POLICY "Users can view own email change requests"
  ON public.email_change_verifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to email change verifications" ON public.email_change_verifications;
CREATE POLICY "Service role full access to email change verifications"
  ON public.email_change_verifications FOR ALL
  TO service_role
  USING (true);

-- ==================================================
-- STEP 2: RPC - create_email_change_request
--   Mints a new pending email-change request for the user. Any prior
--   unverified/unused request is invalidated (used_at = now()) so only ONE
--   request is ever active. Returns the new request id.
-- ==================================================

CREATE OR REPLACE FUNCTION public.create_email_change_request(
  p_user_id UUID,
  p_new_email TEXT,
  p_code_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  IF p_new_email IS NULL OR p_new_email = '' OR p_new_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  IF p_code_hash IS NULL OR p_code_hash = '' THEN
    RAISE EXCEPTION 'INVALID_CODE_HASH';
  END IF;

  -- Invalidate any prior open requests so at most one is active per user.
  UPDATE public.email_change_verifications
  SET used_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id
    AND verified_at IS NULL
    AND used_at IS NULL;

  INSERT INTO public.email_change_verifications (
    user_id,
    new_email,
    code_hash,
    expires_at
  )
  VALUES (
    p_user_id,
    p_new_email,
    p_code_hash,
    now() + INTERVAL '24 hours'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.create_email_change_request IS
'Mint a pending email-change request (bcrypt-hashed code). Old email stays active until verified.';

-- ==================================================
-- STEP 3: RPC - resend_email_change_code
--   Re-hashes a fresh code onto the LATEST still-pending request and resets its
--   expiry + attempt counter. Returns success + the target new_email so the
--   Edge Function knows where to resend.
-- ==================================================

CREATE OR REPLACE FUNCTION public.resend_email_change_code(
  p_user_id UUID,
  p_code_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request_id UUID;
  v_new_email TEXT;
BEGIN
  IF p_code_hash IS NULL OR p_code_hash = '' THEN
    RAISE EXCEPTION 'INVALID_CODE_HASH';
  END IF;

  SELECT e.id, e.new_email
    INTO v_request_id, v_new_email
  FROM public.email_change_verifications e
  WHERE e.user_id = p_user_id
    AND e.verified_at IS NULL
    AND e.used_at IS NULL
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_PENDING_REQUEST');
  END IF;

  UPDATE public.email_change_verifications
  SET code_hash = p_code_hash,
      attempts = 0,
      expires_at = now() + INTERVAL '24 hours',
      updated_at = now()
  WHERE id = v_request_id;

  RETURN jsonb_build_object('success', true, 'new_email', v_new_email);
END;
$$;

COMMENT ON FUNCTION public.resend_email_change_code IS
'Re-arm the latest pending email-change request with a fresh code hash + 24h expiry.';

-- ==================================================
-- STEP 4: RPC - verify_email_change_code
--   Looks up the latest pending request for the user, enforces expiry + attempt
--   limit (max 5), bcrypt-compares the submitted code, and on success marks the
--   request verified and returns the new_email for the Edge Function to apply.
-- ==================================================

CREATE OR REPLACE FUNCTION public.verify_email_change_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT, new_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request RECORD;
  v_is_valid BOOLEAN;
BEGIN
  -- 1. Fetch the latest active (unverified, unused) request.
  SELECT e.*
    INTO v_request
  FROM public.email_change_verifications e
  WHERE e.user_id = p_user_id
    AND e.verified_at IS NULL
    AND e.used_at IS NULL
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'No active verification request. Request a new code.', NULL::TEXT;
    RETURN;
  END IF;

  -- 2. Expiry check.
  IF v_request.expires_at < now() THEN
    RETURN QUERY SELECT FALSE, 'This code has expired. Request a new one.', NULL::TEXT;
    RETURN;
  END IF;

  -- 3. Attempt limit (max 5).
  IF v_request.attempts >= 5 THEN
    RETURN QUERY SELECT FALSE, 'Too many attempts. Request a new code.', NULL::TEXT;
    RETURN;
  END IF;

  -- 4. bcrypt compare: crypt(input, stored_hash) = stored_hash on match.
  v_is_valid := (crypt(p_code, v_request.code_hash) = v_request.code_hash);

  -- 5. Increment attempts regardless.
  UPDATE public.email_change_verifications
  SET attempts = attempts + 1,
      updated_at = now()
  WHERE id = v_request.id;

  -- 6. On success, mark verified and surface the target email.
  IF v_is_valid THEN
    UPDATE public.email_change_verifications
    SET verified_at = now(),
        updated_at = now()
    WHERE id = v_request.id;

    RETURN QUERY SELECT TRUE, 'Code verified'::TEXT, v_request.new_email::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT FALSE, 'That code didn''t match. Check it and try again.', NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.verify_email_change_code IS
'Verify the email-change code (bcrypt). Max 5 attempts; 24h expiry. Returns the new email on success.';

-- ==================================================
-- STEP 5: RPC - complete_email_change
--   Seals the change after the Edge Function has applied the new email to
--   auth.users + profiles: marks all requests for the user as used so the
--   verified row cannot be replayed.
-- ==================================================

CREATE OR REPLACE FUNCTION public.complete_email_change(
  p_user_id UUID,
  p_new_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.email_change_verifications
  SET used_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id
    AND used_at IS NULL;

  RETURN jsonb_build_object('success', true, 'new_email', p_new_email);
END;
$$;

COMMENT ON FUNCTION public.complete_email_change IS
'Seal all email-change requests for the user after the new email is applied (prevents replay).';

-- ==================================================
-- STEP 6: RPC - get_pending_email_change
--   Returns the latest still-active request (for a UI "pending verification"
--   banner). NULL/empty when there is nothing pending.
-- ==================================================

CREATE OR REPLACE FUNCTION public.get_pending_email_change(
  p_user_id UUID
)
RETURNS TABLE(new_email TEXT, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT e.new_email, e.created_at, e.expires_at
  FROM public.email_change_verifications e
  WHERE e.user_id = p_user_id
    AND e.verified_at IS NULL
    AND e.used_at IS NULL
  ORDER BY e.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_pending_email_change IS
'Read the active pending email-change request for a user (drives pending-verification UI).';

-- ==================================================
-- STEP 7: Grants
-- ==================================================

GRANT EXECUTE ON FUNCTION public.create_email_change_request TO service_role;
GRANT EXECUTE ON FUNCTION public.resend_email_change_code TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_email_change_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_email_change TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_email_change TO authenticated;

-- ==================================================
-- VERIFICATION QUERIES (run after applying)
-- ==================================================
-- 1) Table + RLS:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE tablename = 'email_change_verifications';
--    -- Expected: rowsecurity = true
--
-- 2) Policies:
--    SELECT policyname, cmd, roles FROM pg_policies
--    WHERE tablename = 'email_change_verifications' ORDER BY policyname;
--
-- 3) RPCs present:
--    SELECT proname FROM pg_proc
--    WHERE proname IN ('create_email_change_request','resend_email_change_code',
--                      'verify_email_change_code','complete_email_change',
--                      'get_pending_email_change')
--    ORDER BY proname;
--    -- Expected: 5 rows
--
-- 4) pgcrypto resolves inside verify_email_change_code (search_path includes
--    extensions):
--    SELECT proname, proconfig FROM pg_proc
--    WHERE proname IN ('create_email_change_request','verify_email_change_code',
--                      'resend_email_change_code','complete_email_change',
--                      'get_pending_email_change')
--    ORDER BY proname;
--    -- Expected: proconfig contains {search_path=public, extensions}
