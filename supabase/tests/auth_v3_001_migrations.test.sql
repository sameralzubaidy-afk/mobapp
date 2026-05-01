-- File: supabase/tests/auth_v3_001_migrations.test.sql
-- MODULE-03 AUTH V3: PgTAP unit tests for AUTH-V3-001 schema migrations
-- Task: AUTH-V3-001 (Schema Migrations — Linked Providers View, Phone Verification Columns, Link RPC, OTP Table)
-- Framework: PgTAP (PostgreSQL Testing Framework)
-- Created: April 30, 2026
-- Run: psql -U postgres -d your_db -f supabase/tests/auth_v3_001_migrations.test.sql

-- ============================================================================
-- SETUP
-- ============================================================================

BEGIN;
SELECT plan(35); -- Total number of tests

-- ============================================================================
-- TEST SUITE 1: user_linked_providers View
-- ============================================================================

SELECT has_view(
  'public', 
  'user_linked_providers', 
  'user_linked_providers view should exist'
);

SELECT has_column(
  'public', 
  'user_linked_providers', 
  'user_id', 
  'user_linked_providers should have user_id column'
);

SELECT has_column(
  'public', 
  'user_linked_providers', 
  'provider', 
  'user_linked_providers should have provider column'
);

SELECT has_column(
  'public', 
  'user_linked_providers', 
  'provider_email', 
  'user_linked_providers should have provider_email column'
);

SELECT has_column(
  'public', 
  'user_linked_providers', 
  'provider_name', 
  'user_linked_providers should have provider_name column'
);

SELECT has_column(
  'public', 
  'user_linked_providers', 
  'provider_avatar', 
  'user_linked_providers should have provider_avatar column'
);

SELECT has_column(
  'public', 
  'user_linked_providers', 
  'last_sign_in_at', 
  'user_linked_providers should have last_sign_in_at column'
);

SELECT has_column(
  'public', 
  'user_linked_providers', 
  'created_at', 
  'user_linked_providers should have created_at column'
);

-- Verify grant to authenticated role
SELECT ok(
  (
    SELECT COUNT(*) > 0
    FROM information_schema.role_table_grants
    WHERE table_name = 'user_linked_providers'
      AND grantee = 'authenticated'
      AND privilege_type = 'SELECT'
  ),
  'authenticated role should have SELECT privilege on user_linked_providers'
);

-- ============================================================================
-- TEST SUITE 2: profiles.phone_verification_method Column
-- ============================================================================

SELECT has_column(
  'public', 
  'profiles', 
  'phone_verification_method', 
  'profiles should have phone_verification_method column'
);

SELECT col_type_is(
  'public', 
  'profiles', 
  'phone_verification_method', 
  'text', 
  'phone_verification_method should be TEXT type'
);

SELECT col_is_null(
  'public', 
  'profiles', 
  'phone_verification_method', 
  'phone_verification_method should be nullable'
);

-- Verify CHECK constraint exists
SELECT ok(
  (
    SELECT COUNT(*) > 0
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%phone_verification_method%'
      AND pg_get_constraintdef(oid) LIKE '%sms%'
      AND pg_get_constraintdef(oid) LIKE '%social_auto%'
      AND pg_get_constraintdef(oid) LIKE '%manual%'
  ),
  'phone_verification_method should have CHECK constraint with sms/social_auto/manual values'
);

-- ============================================================================
-- TEST SUITE 3: idx_profiles_phone_verified Index
-- ============================================================================

SELECT has_index(
  'public', 
  'profiles', 
  'idx_profiles_phone_verified', 
  'idx_profiles_phone_verified index should exist'
);

-- Verify it's a partial index (WHERE clause)
SELECT ok(
  (
    SELECT indexdef LIKE '%WHERE%phone_verified_at IS NULL%'
    FROM pg_indexes
    WHERE tablename = 'profiles' AND indexname = 'idx_profiles_phone_verified'
  ),
  'idx_profiles_phone_verified should be a partial index on phone_verified_at IS NULL'
);

-- ============================================================================
-- TEST SUITE 4: link_social_account RPC
-- ============================================================================

SELECT has_function(
  'public', 
  'link_social_account', 
  ARRAY['text', 'text', 'text', 'jsonb'], 
  'link_social_account function should exist with correct signature'
);

SELECT function_returns(
  'public', 
  'link_social_account', 
  ARRAY['text', 'text', 'text', 'jsonb'], 
  'void', 
  'link_social_account should return void'
);

SELECT function_lang_is(
  'public', 
  'link_social_account', 
  ARRAY['text', 'text', 'text', 'jsonb'], 
  'plpgsql', 
  'link_social_account should be written in plpgsql'
);

-- Verify SECURITY DEFINER
SELECT ok(
  (
    SELECT prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'link_social_account'
  ),
  'link_social_account should be SECURITY DEFINER'
);

-- ============================================================================
-- TEST SUITE 5: phone_verification_codes Table (V3)
-- ============================================================================

SELECT has_table(
  'public', 
  'phone_verification_codes', 
  'phone_verification_codes table should exist'
);

SELECT has_column(
  'public', 
  'phone_verification_codes', 
  'id', 
  'phone_verification_codes should have id column'
);

SELECT has_column(
  'public', 
  'phone_verification_codes', 
  'user_id', 
  'phone_verification_codes should have user_id column'
);

SELECT has_column(
  'public', 
  'phone_verification_codes', 
  'phone', 
  'phone_verification_codes should have phone column'
);

SELECT has_column(
  'public', 
  'phone_verification_codes', 
  'code_hash', 
  'phone_verification_codes should have code_hash column (not code)'
);

SELECT col_type_is(
  'public', 
  'phone_verification_codes', 
  'code_hash', 
  'text', 
  'code_hash should be TEXT type'
);

SELECT has_column(
  'public', 
  'phone_verification_codes', 
  'attempts', 
  'phone_verification_codes should have attempts column'
);

SELECT col_default_is(
  'public', 
  'phone_verification_codes', 
  'attempts', 
  '0', 
  'attempts should default to 0'
);

SELECT has_column(
  'public', 
  'phone_verification_codes', 
  'created_at', 
  'phone_verification_codes should have created_at column'
);

SELECT has_column(
  'public', 
  'phone_verification_codes', 
  'expires_at', 
  'phone_verification_codes should have expires_at column'
);

-- ============================================================================
-- TEST SUITE 6: phone_verification_codes Indexes
-- ============================================================================

SELECT has_index(
  'public', 
  'phone_verification_codes', 
  'idx_phone_verification_codes_user_expires', 
  'idx_phone_verification_codes_user_expires index should exist'
);

SELECT has_index(
  'public', 
  'phone_verification_codes', 
  'idx_phone_verification_codes_phone_created', 
  'idx_phone_verification_codes_phone_created index should exist'
);

-- ============================================================================
-- TEST SUITE 7: phone_verification_codes RLS
-- ============================================================================

SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE relname = 'phone_verification_codes'
  ),
  'phone_verification_codes should have RLS enabled'
);

SELECT ok(
  (
    SELECT COUNT(*) >= 4
    FROM pg_policies
    WHERE tablename = 'phone_verification_codes'
  ),
  'phone_verification_codes should have at least 4 RLS policies'
);

-- Verify authenticated can SELECT own rows
SELECT ok(
  (
    SELECT COUNT(*) > 0
    FROM pg_policies
    WHERE tablename = 'phone_verification_codes'
      AND policyname LIKE '%read%'
      AND cmd = 'SELECT'
      AND qual LIKE '%user_id%auth.uid%'
  ),
  'phone_verification_codes should have SELECT policy for authenticated users on own rows'
);

-- ============================================================================
-- TEARDOWN
-- ============================================================================

SELECT * FROM finish();
ROLLBACK;
