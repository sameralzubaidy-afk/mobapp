-- File: supabase/tests/auth_v3_check_account_exists.test.sql
-- MODULE-03 AUTH V3: PgTAP tests for check_account_exists_by_email RPC
-- Task: AUTH-V3-001 deferred migration (20260420000015_check_account_exists_rpc.sql)
-- Framework: PgTAP (PostgreSQL Testing Framework) — mirrors auth_v3.sql style
-- Run: psql -U postgres -d your_db -f supabase/tests/auth_v3_check_account_exists.test.sql
-- NOTE: Requires the migration applied AND the pgTAP extension installed.
-- NOTE (2026-08-16): authored but NOT yet executed — no local stack running at write time.

BEGIN;
SELECT plan(8); -- Total number of tests

-- ============================================================================
-- TEST SUITE 1: function metadata (signature, security, return type)
-- ============================================================================

SELECT has_function(
  'public',
  'check_account_exists_by_email',
  ARRAY['text'],
  'check_account_exists_by_email(text) should exist'
);

SELECT is(
  (SELECT p.prosecdef
     FROM pg_proc p
     JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_account_exists_by_email'),
  true,
  'check_account_exists_by_email should be SECURITY DEFINER'
);

SELECT is(
  (SELECT pg_get_function_result(p.oid)
     FROM pg_proc p
     JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_account_exists_by_email'),
  'jsonb',
  'check_account_exists_by_email should return jsonb (compat with shipped client)'
);

SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
     FROM pg_proc p
     JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_account_exists_by_email'),
  'p_email text',
  'check_account_exists_by_email should take (p_email text)'
);

-- ============================================================================
-- TEST SUITE 2: constructed collision scenario (auth.users level)
--   - password-protected account  -> has_password = true
--   - social-only account (no pwd)-> has_password = false, case-insensitive
-- NOTE: provider aggregation (auth.identities) is NOT asserted here; it needs
--   auth.identities inserts validated on a live DB first (DEFERRED). The RPC's
--   verification query #5 in the migration covers it manually.
-- ============================================================================

DO $$
BEGIN
  -- Password-protected account with email collision@example.com
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    '00000000-0000-0000-0000-0000000000a1',
    'collision@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Social-only account with email social@example.com (no password)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    '00000000-0000-0000-0000-0000000000a2',
    'social@example.com',
    '',
    now(),
    '{"provider":"google","providers":["google"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

-- No account -> exists=false, no user_id
SELECT is(
  (SELECT public.check_account_exists_by_email('nobody-' || md5(random()::text) || '@example.com')),
  '{"exists": false, "user_id": null, "providers": [], "has_password": false}'::jsonb,
  'nonexistent email should return exists=false'
);

-- Password account -> exists=true, has_password=true
SELECT is(
  (SELECT public.check_account_exists_by_email('collision@example.com')),
  '{"exists": true, "user_id": "00000000-0000-0000-0000-0000000000a1", "providers": [], "has_password": true}'::jsonb,
  'password account should report has_password=true'
);

-- Social-only account -> exists=true, has_password=false (case-insensitive lookup)
SELECT is(
  (SELECT public.check_account_exists_by_email('SOCIAL@example.com')),
  '{"exists": true, "user_id": "00000000-0000-0000-0000-0000000000a2", "providers": [], "has_password": false}'::jsonb,
  'social-only account should report has_password=false and lookup is case-insensitive'
);

-- NULL input -> exists=false (no error)
SELECT is(
  (SELECT public.check_account_exists_by_email(NULL)),
  '{"exists": false, "user_id": null, "providers": [], "has_password": false}'::jsonb,
  'NULL email should return exists=false, not throw'
);

ROLLBACK;
