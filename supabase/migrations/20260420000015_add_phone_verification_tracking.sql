-- File: supabase/migrations/20260420000012_add_phone_verification_tracking.sql
-- MODULE-03 AUTH V3: Add phone_verification_method column and partial index
-- Task: AUTH-V3-001 (Schema Migrations — Phone Verification Columns)
-- Dependencies: profiles table exists (MODULE-01)
-- Version: 1.0
-- Created: April 30, 2026

-- =============================================================================
-- 1. ADD phone_verification_method COLUMN
-- =============================================================================
-- Tracks how the user verified their phone: 'sms', 'social_auto' (provider had verified phone), 'manual' (admin override)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verification_method TEXT
    CHECK (phone_verification_method IN ('sms', 'social_auto', 'manual'));

-- =============================================================================
-- 2. CREATE PARTIAL INDEX FOR UNVERIFIED PHONE LOOKUPS
-- =============================================================================
-- Fast lookup for users who haven't verified phone yet (used by MODULE-04 V3 and MODULE-06 V2 transaction gates)

CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified
  ON public.profiles(phone_verified_at)
  WHERE phone_verified_at IS NULL;

-- =============================================================================
-- 3. COMMENTS
-- =============================================================================

COMMENT ON COLUMN public.profiles.phone_verification_method IS
'MODULE-03 AUTH V3: Method used to verify phone number. '
'Values: sms (SMS OTP), social_auto (OAuth provider verified phone), manual (admin override). '
'NULL if phone not yet verified.';

COMMENT ON INDEX public.idx_profiles_phone_verified IS
'MODULE-03 AUTH V3: Partial index for fast lookup of unverified-phone users. '
'Used by isPhoneRequired gate before first listing (MODULE-04 V3) or purchase (MODULE-06 V2).';

-- =============================================================================
-- 4. VERIFICATION QUERIES
-- =============================================================================

-- Verify column exists with correct CHECK constraint
-- Expected: 1 row with data_type = 'text'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'phone_verification_method';

-- Verify CHECK constraint exists
-- Expected: 1+ rows with constraint containing ('sms', 'social_auto', 'manual')
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%phone_verification_method%';

-- Verify partial index exists
-- Expected: 1 row with indexdef containing 'WHERE (phone_verified_at IS NULL)'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
  AND indexname = 'idx_profiles_phone_verified';

-- Sample data: users with unverified phones (will use index)
-- Expected: 0+ rows depending on existing data
SELECT id, user_id, name, phone_verified_at, phone_verification_method
FROM public.profiles
WHERE phone_verified_at IS NULL
LIMIT 5;
