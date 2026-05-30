-- ============================================================================
-- AUTH-V3-001 SQL DEPLOYMENT SCRIPT
-- ============================================================================
-- Module: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md
-- Task: AUTH-V3-001 (Schema Migrations)
-- Target: Supabase Production Database
-- Created: April 30, 2026
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy this ENTIRE file
-- 3. Paste and RUN in SQL Editor
-- 4. Verify all queries return expected results (see comments)
-- 5. Then proceed to AUTH-V3-001-MANUAL-TESTING-GUIDE.md
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Create user_linked_providers View
-- ============================================================================
-- File: 20260420000011_create_user_linked_providers_view.sql

CREATE OR REPLACE VIEW public.user_linked_providers AS
SELECT
  i.user_id,
  i.provider,
  i.identity_data->>'email' AS provider_email,
  COALESCE(
    i.identity_data->>'name',
    i.identity_data->>'full_name',
    CONCAT(i.identity_data->>'given_name', ' ', i.identity_data->>'family_name')
  ) AS provider_name,
  COALESCE(
    CASE
      WHEN jsonb_typeof(i.identity_data->'picture') = 'string' THEN i.identity_data->>'picture'
      ELSE NULL
    END,
    i.identity_data->'picture'->'data'->>'url'
  ) AS provider_avatar,
  i.last_sign_in_at,
  i.created_at
FROM auth.identities i
ORDER BY i.user_id, i.provider;

GRANT SELECT ON public.user_linked_providers TO authenticated;

COMMENT ON VIEW public.user_linked_providers IS
'MODULE-03 AUTH V3: Friendly view over auth.identities exposing linked social providers for each user. '
'Includes provider email, name, avatar URL, and last sign-in timestamp. '
'Authenticated users can SELECT to see which providers they have linked and discover other users'' social accounts. '
'This view is READ-ONLY. To link/unlink providers, use link_social_account / unlinkSocialAccount service.';

-- Verify: Should return 1 row
SELECT 'Migration 1 VERIFY: user_linked_providers view created' AS checkpoint,
       COUNT(*) AS expected_1
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'user_linked_providers';

-- ============================================================================
-- MIGRATION 2: Add phone_verification_method Column and Index
-- ============================================================================
-- File: 20260420000012_add_phone_verification_tracking.sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verification_method TEXT
    CHECK (phone_verification_method IN ('sms', 'social_auto', 'manual'));

CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified
  ON public.profiles(phone_verified_at)
  WHERE phone_verified_at IS NULL;

COMMENT ON COLUMN public.profiles.phone_verification_method IS
'MODULE-03 AUTH V3: Method used to verify phone number. '
'Values: sms (SMS OTP), social_auto (OAuth provider verified phone), manual (admin override). '
'NULL if phone not yet verified.';

COMMENT ON INDEX public.idx_profiles_phone_verified IS
'MODULE-03 AUTH V3: Partial index for fast lookup of unverified-phone users. '
'Used by isPhoneRequired gate before first listing (MODULE-04 V3) or purchase (MODULE-06 V2).';

-- Verify: Should return 1 row
SELECT 'Migration 2 VERIFY: phone_verification_method column added' AS checkpoint,
       COUNT(*) AS expected_1
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'phone_verification_method';

-- Verify: Should return 1 row
SELECT 'Migration 2 VERIFY: idx_profiles_phone_verified index created' AS checkpoint,
       COUNT(*) AS expected_1
FROM pg_indexes
WHERE tablename = 'profiles' AND indexname = 'idx_profiles_phone_verified';

-- ============================================================================
-- MIGRATION 3: Create link_social_account RPC
-- ============================================================================
-- File: 20260420000013_link_social_account_rpc.sql

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

  -- 4. Write audit log
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
    v_user_id,
    jsonb_build_object(
      'provider', p_provider_name,
      'provider_user_id', p_provider_user_id,
      'provider_email', p_provider_email,
      'provider_data_keys', jsonb_object_keys(p_provider_data)
    ),
    NOW()
  );

  -- Success
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_social_account(TEXT, TEXT, TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.link_social_account(TEXT, TEXT, TEXT, JSONB) IS
'MODULE-03 AUTH V3: SECURITY DEFINER RPC to validate preconditions for linking a social provider. '
'Verifies user is authenticated and provider email matches auth.users.email (case-insensitive). '
'Throws EmailMismatchError on mismatch. Writes audit_log on success. '
'The actual provider linking (auth.identities insert) is performed by Supabase Auth via supabase.auth.linkIdentity call from AccountService.';

-- Verify: Should return 1 row with prosecdef = true
SELECT 'Migration 3 VERIFY: link_social_account RPC created' AS checkpoint,
       p.proname,
       p.prosecdef AS expected_true
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'link_social_account';

-- ============================================================================
-- MIGRATION 4: Update phone_verification_codes Table for V3
-- ============================================================================
-- File: 20260420000014_create_phone_verification_codes.sql

-- Drop and recreate with V3 schema
DROP TABLE IF EXISTS public.phone_verification_codes CASCADE;

CREATE TABLE public.phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX idx_phone_verification_codes_user_expires
  ON public.phone_verification_codes(user_id, expires_at);

CREATE INDEX idx_phone_verification_codes_phone_created
  ON public.phone_verification_codes(phone, created_at);

ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own verification codes" ON public.phone_verification_codes;
CREATE POLICY "Users can read own verification codes"
  ON public.phone_verification_codes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service can insert verification codes" ON public.phone_verification_codes;
CREATE POLICY "Service can insert verification codes"
  ON public.phone_verification_codes
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update verification codes" ON public.phone_verification_codes;
CREATE POLICY "Service can update verification codes"
  ON public.phone_verification_codes
  FOR UPDATE
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service can delete expired codes" ON public.phone_verification_codes;
CREATE POLICY "Service can delete expired codes"
  ON public.phone_verification_codes
  FOR DELETE
  TO service_role
  USING (expires_at < NOW());

COMMENT ON TABLE public.phone_verification_codes IS
'MODULE-03 AUTH V3: Stores hashed phone OTP codes with rate-limit bookkeeping. '
'OTPs expire after 5 minutes. Max 5 verification attempts per code. '
'Rate limits enforced: 3 codes/phone/hour, 5 codes/user/day (checked in send-phone-otp Edge Function). '
'Codes are bcrypt-hashed (code_hash column) - never store plaintext.';

COMMENT ON COLUMN public.phone_verification_codes.code_hash IS
'Bcrypt hash of the 6-digit OTP code. Verified using pgcrypto crypt() comparison. Never log or expose plaintext codes.';

-- Verify: Should return 1 row
SELECT 'Migration 4 VERIFY: phone_verification_codes table created' AS checkpoint,
       COUNT(*) AS expected_1
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'phone_verification_codes';

-- Verify: Should return 2 rows (the V3 indexes)
SELECT 'Migration 4 VERIFY: V3 indexes created' AS checkpoint,
       COUNT(*) AS expected_2
FROM pg_indexes
WHERE tablename = 'phone_verification_codes'
  AND indexname IN ('idx_phone_verification_codes_user_expires', 'idx_phone_verification_codes_phone_created');

-- ============================================================================
-- FINAL VERIFICATION SUMMARY
-- ============================================================================

SELECT '=== AUTH-V3-001 DEPLOYMENT COMPLETE ===' AS status;

SELECT 
  'user_linked_providers view' AS object,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_linked_providers'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;

SELECT 
  'profiles.phone_verification_method column' AS object,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_verification_method'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;

SELECT 
  'idx_profiles_phone_verified index' AS object,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'profiles' AND indexname = 'idx_profiles_phone_verified'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;

SELECT 
  'link_social_account RPC' AS object,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'link_social_account'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;

SELECT 
  'phone_verification_codes table (V3)' AS object,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phone_verification_codes' AND column_name = 'code_hash'
  ) THEN '✅ EXISTS (V3)' ELSE '❌ MISSING OR OLD VERSION' END AS status;

SELECT 
  'V3 rate-limit indexes' AS object,
  CASE WHEN (
    SELECT COUNT(*) FROM pg_indexes
    WHERE tablename = 'phone_verification_codes'
      AND indexname IN ('idx_phone_verification_codes_user_expires', 'idx_phone_verification_codes_phone_created')
  ) = 2 THEN '✅ BOTH EXISTS' ELSE '❌ MISSING OR INCOMPLETE' END AS status;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- 1. Review verification results above (all should show ✅ EXISTS)
-- 2. Proceed to AUTH-V3-001-MANUAL-TESTING-GUIDE.md
-- 3. Run all 12 test cases
-- 4. If all PASS, move to AUTH-V3-002 (Shared Types & Error Classes)
-- ============================================================================
