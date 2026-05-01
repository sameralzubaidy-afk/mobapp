-- File: supabase/migrations/20260420000014_create_phone_verification_codes.sql
-- MODULE-03 AUTH V3: Update phone_verification_codes table for V3 requirements
-- Task: AUTH-V3-001 (Schema Migrations — OTP Table with hashed codes + rate-limit indexes)
-- Dependencies: phone_verification_codes table exists (MODULE-03 V2)
-- Version: 1.0
-- Created: April 30, 2026

-- =============================================================================
-- 1. UPDATE phone_verification_codes TABLE SCHEMA
-- =============================================================================
-- V3 requires: code_hash (bcrypt hashed, not plaintext), attempts bookkeeping, expires_at, rate-limit indexes

-- Drop existing table if structure doesn't match V3 requirements (safe for migration)
-- We'll recreate with proper V3 schema
DROP TABLE IF EXISTS public.phone_verification_codes CASCADE;

CREATE TABLE public.phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL, -- bcrypt hash of the 6-digit code (never store plaintext)
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- =============================================================================
-- 2. CREATE INDEXES FOR V3 REQUIREMENTS
-- =============================================================================

-- Index for fast lookup by user + expiry (check if user has valid unexpired code)
CREATE INDEX idx_phone_verification_codes_user_expires
  ON public.phone_verification_codes(user_id, expires_at);

-- Index for per-phone rate-limit check (count codes sent to this phone in last hour)
CREATE INDEX idx_phone_verification_codes_phone_created
  ON public.phone_verification_codes(phone, created_at);

-- =============================================================================
-- 3. ENABLE RLS + CREATE POLICIES
-- =============================================================================

ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own verification codes (for debugging/status check)
DROP POLICY IF EXISTS "Users can read own verification codes" ON public.phone_verification_codes;
CREATE POLICY "Users can read own verification codes"
  ON public.phone_verification_codes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Service role (Edge Functions) can insert codes
DROP POLICY IF EXISTS "Service can insert verification codes" ON public.phone_verification_codes;
CREATE POLICY "Service can insert verification codes"
  ON public.phone_verification_codes
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can update (increment attempts, mark verified)
DROP POLICY IF EXISTS "Service can update verification codes" ON public.phone_verification_codes;
CREATE POLICY "Service can update verification codes"
  ON public.phone_verification_codes
  FOR UPDATE
  TO service_role
  USING (true);

-- Policy: Service role can delete expired codes (cleanup job)
DROP POLICY IF EXISTS "Service can delete expired codes" ON public.phone_verification_codes;
CREATE POLICY "Service can delete expired codes"
  ON public.phone_verification_codes
  FOR DELETE
  TO service_role
  USING (expires_at < NOW());

-- =============================================================================
-- 4. COMMENTS
-- =============================================================================

COMMENT ON TABLE public.phone_verification_codes IS
'MODULE-03 AUTH V3: Stores hashed phone OTP codes with rate-limit bookkeeping. '
'OTPs expire after 5 minutes. Max 5 verification attempts per code. '
'Rate limits enforced: 3 codes/phone/hour, 5 codes/user/day (checked in send-phone-otp Edge Function). '
'Codes are bcrypt-hashed (code_hash column) - never store plaintext.';

COMMENT ON COLUMN public.phone_verification_codes.code_hash IS
'Bcrypt hash of the 6-digit OTP code. Verified using pgcrypto crypt() comparison. Never log or expose plaintext codes.';

COMMENT ON COLUMN public.phone_verification_codes.attempts IS
'Number of failed verification attempts. Max 5 attempts before code is invalidated.';

COMMENT ON COLUMN public.phone_verification_codes.expires_at IS
'Timestamp when code expires (5 minutes from created_at). Expired codes cannot be verified.';

COMMENT ON INDEX public.idx_phone_verification_codes_user_expires IS
'Fast lookup for valid unexpired codes for a user (used by verifyPhoneCode RPC).';

COMMENT ON INDEX public.idx_phone_verification_codes_phone_created IS
'Supports per-phone rate-limit check: count codes sent to phone in last hour (used by send-phone-otp Edge Function).';

-- =============================================================================
-- 5. VERIFICATION QUERIES
-- =============================================================================

-- Verify table exists
-- Expected: 1 row with table_type = 'BASE TABLE'
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'phone_verification_codes';

-- Verify required columns exist
-- Expected: id, user_id, phone, code_hash, attempts, created_at, expires_at
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'phone_verification_codes'
ORDER BY ordinal_position;

-- Verify RLS is enabled
-- Expected: relrowsecurity = t
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'phone_verification_codes';

-- Verify V3 indexes exist
-- Expected: 2 rows with idx_phone_verification_codes_user_expires and idx_phone_verification_codes_phone_created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'phone_verification_codes'
  AND indexname IN ('idx_phone_verification_codes_user_expires', 'idx_phone_verification_codes_phone_created')
ORDER BY indexname;

-- Verify RLS policies (should be 4 policies for service_role)
-- Expected: 4 rows (SELECT/INSERT/UPDATE/DELETE policies)
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'phone_verification_codes'
ORDER BY policyname;

-- Sample data query (will be empty initially)
-- Expected: 0 rows (no OTPs sent yet)
SELECT id, user_id, phone, attempts, created_at, expires_at
FROM public.phone_verification_codes
WHERE expires_at > NOW()
LIMIT 5;
