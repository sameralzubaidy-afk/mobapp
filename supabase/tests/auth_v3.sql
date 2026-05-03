-- File: supabase/tests/auth_v3.sql
-- PgTAP tests for AUTH-V3 Social Login (AUTH-V3-009)
-- Tests link_social_account RPC, OTP rate limits, and last-method guard

BEGIN;

-- Load pgTAP extension
SELECT plan(12);

-- ============================================================================
-- TEST SUITE 1: link_social_account RPC
-- ============================================================================

-- Test 1.1: link_social_account throws exception on email mismatch
PREPARE link_mismatch AS
  SELECT public.link_social_account(
    p_provider_name := 'google',
    p_provider_user_id := 'google-test-123',
    p_provider_email := 'wrong@example.com',
    p_provider_data := '{"name": "Test User"}'::jsonb
  );

DO $$
BEGIN
  -- Create test user with different email
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'correct@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  -- Create profile
  INSERT INTO public.user_profiles (id, user_id, email, display_name)
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001',
    'correct@example.com',
    'Test User'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if already exists
    NULL;
END $$;

-- Set session to test user
SET request.jwt.claims TO '{"sub":"00000000-0000-0000-0000-000000000001","email":"correct@example.com"}';

SELECT throws_ok(
  'EXECUTE link_mismatch',
  'Email mismatch',
  'link_social_account should throw on email mismatch'
);

-- Test 1.2: link_social_account succeeds with matching email
PREPARE link_success AS
  SELECT public.link_social_account(
    p_provider_name := 'google',
    p_provider_user_id := 'google-test-456',
    p_provider_email := 'correct@example.com',
    p_provider_data := '{"name": "Test User", "avatar": "https://example.com/avatar.jpg"}'::jsonb
  );

SELECT lives_ok(
  'EXECUTE link_success',
  'link_social_account should succeed with matching email'
);

-- Test 1.3: Verify audit log entry created
SELECT ok(
  EXISTS(
    SELECT 1 FROM public.audit_log
    WHERE action = 'link_social_account'
      AND user_id = '00000000-0000-0000-0000-000000000001'
      AND details->>'provider' = 'google'
  ),
  'link_social_account should create audit log entry'
);

-- ============================================================================
-- TEST SUITE 2: phone_verification_codes + OTP rate limits
-- ============================================================================

-- Test 2.1: Table exists with correct structure
SELECT has_table('public', 'phone_verification_codes', 'phone_verification_codes table should exist');

SELECT has_column('public', 'phone_verification_codes', 'id', 'phone_verification_codes.id should exist');
SELECT has_column('public', 'phone_verification_codes', 'user_id', 'phone_verification_codes.user_id should exist');
SELECT has_column('public', 'phone_verification_codes', 'phone', 'phone_verification_codes.phone should exist');
SELECT has_column('public', 'phone_verification_codes', 'code_hash', 'phone_verification_codes.code_hash should exist');
SELECT has_column('public', 'phone_verification_codes', 'attempts', 'phone_verification_codes.attempts should exist');
SELECT has_column('public', 'phone_verification_codes', 'created_at', 'phone_verification_codes.created_at should exist');
SELECT has_column('public', 'phone_verification_codes', 'expires_at', 'phone_verification_codes.expires_at should exist');

-- Test 2.2: RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'phone_verification_codes'),
  'phone_verification_codes should have RLS enabled'
);

-- Test 2.3: OTP rate limit (3 per phone per hour)
-- Insert 3 codes in the past hour
DO $$
DECLARE
  v_test_phone TEXT := '+15551112222';
  v_test_user_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- Create test user
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_test_user_id,
    'ratelimit@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create profile
  INSERT INTO public.user_profiles (id, user_id, email, display_name, phone)
  VALUES (
    gen_random_uuid(),
    v_test_user_id,
    'ratelimit@example.com',
    'Rate Test User',
    v_test_phone
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert 3 OTP codes in the past hour
  FOR i IN 1..3 LOOP
    INSERT INTO public.phone_verification_codes (user_id, phone, code_hash, created_at, expires_at)
    VALUES (
      v_test_user_id,
      v_test_phone,
      crypt('123456', gen_salt('bf')),
      now() - (i * interval '15 minutes'),
      now() + interval '5 minutes'
    );
  END LOOP;
END $$;

-- Test 2.4: Verify rate limit check (should have 3 codes)
SELECT is(
  (
    SELECT COUNT(*)::int
    FROM public.phone_verification_codes
    WHERE phone = '+15551112222'
      AND created_at > now() - interval '1 hour'
  ),
  3,
  'Should have 3 OTP codes for test phone in past hour'
);

-- Note: Actual rate limit enforcement happens in the send-phone-otp Edge Function
-- This test verifies the data structure supports the rate limit query

-- ============================================================================
-- TEST SUITE 3: Unlink last method guard (via user_linked_providers view)
-- ============================================================================

-- Test 3.1: user_linked_providers view exists
SELECT has_view('public', 'user_linked_providers', 'user_linked_providers view should exist');

-- Test 3.2: View correctly identifies providers
DO $$
DECLARE
  v_test_user_id UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
  -- Create test user with Google identity
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_test_user_id,
    'multimethod@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"google","providers":["google","email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert Google identity
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_test_user_id,
    'google-user-123',
    '{"sub":"google-user-123","email":"multimethod@example.com"}'::jsonb,
    'google',
    now(),
    now()
  )
  ON CONFLICT DO NOTHING;

  -- Create profile
  INSERT INTO public.user_profiles (id, user_id, email, display_name)
  VALUES (
    gen_random_uuid(),
    v_test_user_id,
    'multimethod@example.com',
    'Multi Method User'
  )
  ON CONFLICT (user_id) DO NOTHING;
END $$;

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.user_linked_providers
    WHERE user_id = '00000000-0000-0000-0000-000000000003'
      AND google = true
      AND has_password = true
  ),
  'user_linked_providers should show google linked and password present'
);

-- Note: Actual unlink last-method guard is enforced in accountService.ts
-- The view provides the data needed to check method counts

-- ============================================================================
-- Cleanup & Finish
-- ============================================================================

-- Reset session
RESET request.jwt.claims;

-- Clean up test data
DELETE FROM public.phone_verification_codes WHERE phone = '+15551112222';
DELETE FROM public.audit_log WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);
DELETE FROM public.user_profiles WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);
DELETE FROM auth.identities WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);

SELECT finish();

ROLLBACK;
