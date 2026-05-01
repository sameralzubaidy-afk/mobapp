-- File: supabase/migrations/20260420000011_create_user_linked_providers_view.sql
-- MODULE-03 AUTH V3: Create user_linked_providers view over auth.identities
-- Task: AUTH-V3-001 (Schema Migrations — Linked Providers View)
-- Dependencies: Supabase Auth enabled with OAuth providers
-- Version: 1.0
-- Created: April 30, 2026

-- =============================================================================
-- 1. CREATE user_linked_providers VIEW
-- =============================================================================
-- Provides a friendly SELECT interface over auth.identities for linked social accounts.
-- Exposes: user_id, provider, provider_email, provider_name, provider_avatar, last_sign_in_at, created_at

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

-- =============================================================================
-- 2. GRANT SELECT TO AUTHENTICATED ROLE
-- =============================================================================
-- Only authenticated users can view linked providers (their own + other users' public social info)

GRANT SELECT ON public.user_linked_providers TO authenticated;

-- =============================================================================
-- 3. COMMENTS
-- =============================================================================

COMMENT ON VIEW public.user_linked_providers IS
'MODULE-03 AUTH V3: Friendly view over auth.identities exposing linked social providers for each user. '
'Includes provider email, name, avatar URL, and last sign-in timestamp. '
'Authenticated users can SELECT to see which providers they have linked and discover other users'' social accounts. '
'This view is READ-ONLY. To link/unlink providers, use link_social_account / unlinkSocialAccount service.';

-- =============================================================================
-- 4. VERIFICATION QUERIES
-- =============================================================================

-- Verify view exists and is accessible
-- Expected: 1 row with view name
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'user_linked_providers';

-- Verify authenticated role has SELECT grant
-- Expected: at least 1 row with privilege_type = 'SELECT'
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'user_linked_providers' AND grantee = 'authenticated';

-- Verify view columns
-- Expected: user_id, provider, provider_email, provider_name, provider_avatar, last_sign_in_at, created_at
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_linked_providers'
ORDER BY ordinal_position;

-- Sample data query (will be empty if no OAuth identities exist yet)
-- Expected: 0+ rows depending on existing social logins
SELECT user_id, provider, provider_email, provider_name
FROM public.user_linked_providers
LIMIT 5;
