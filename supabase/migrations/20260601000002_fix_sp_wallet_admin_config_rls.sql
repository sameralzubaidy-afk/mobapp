-- File: supabase/migrations/20260601000002_fix_sp_wallet_admin_config_rls.sql
-- PROD-001 + PROD-002: Remove anon access from sp_wallets/sp_ledger and admin_config
--
-- Mode: idempotent rerunnable migration
--
-- Strategy (CONSERVATIVE — minimize blast radius):
--   * Drop ONLY the dangerous *_anon_* policies that were added by a test
--     migration (20260205000003_ultimate_test_alignment_fix.sql).
--   * Preserve all existing authenticated/service_role policies that
--     production flows depend on:
--        - sp_wallets:  "Users can view own wallet" + "Users can insert own wallet" + "Service role can access all sp_wallets"
--        - sp_ledger:   "Users can view own ledger" + "Service role can access all sp_ledger"
--   * For admin_config: drop the two USING(true) public-role SELECT policies,
--     add an authenticated-only SELECT (mobile app reads config post-login).
--     Service-role INSERT/UPDATE/DELETE policies are preserved.
--
-- After this migration:
--   * Anonymous (anon role) clients can NOT read or write sp_wallets / sp_ledger / admin_config.
--   * Authenticated users continue to read their own sp_wallets / sp_ledger rows.
--   * Authenticated users continue to read admin_config (needed for trial/fee display).
--   * Edge Functions using the service role key are unaffected.

-- ============================================
-- BLOCK 1: Drop anon policies on sp_wallets / sp_ledger
-- ============================================

DROP POLICY IF EXISTS "sp_wallets_anon_insert" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_update" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_select" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_delete" ON public.sp_wallets;

DROP POLICY IF EXISTS "sp_ledger_anon_insert" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_update" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_select" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_delete" ON public.sp_ledger;

-- Ensure RLS stays enabled (defensive — should already be true).
ALTER TABLE public.sp_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_ledger ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BLOCK 2: Restrict admin_config read access
-- ============================================

-- Drop the public-role USING(true) SELECT policies that allowed anon reads.
DROP POLICY IF EXISTS "Public read admin config" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_select_all" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_public_read" ON public.admin_config;
DROP POLICY IF EXISTS "Anyone can read admin_config" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_read" ON public.admin_config;

-- Recreate as authenticated-only SELECT (idempotent: drop then create).
DROP POLICY IF EXISTS "admin_config_authenticated_read" ON public.admin_config;
CREATE POLICY "admin_config_authenticated_read" ON public.admin_config
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
