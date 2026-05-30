-- File: supabase/migrations/312_prod_p1_stage_security_lockdown.sql
-- Module: MODULE-15.5 PROD-001 + PROD-002 (+ PROD-013 critical fallout)
-- Mode: idempotent rerunnable migration
--
-- Purpose:
-- 1) Remove dangerous anon policies introduced by 20260205000003_ultimate_test_alignment_fix.sql.
-- 2) Enforce strict wallet/ledger owner-scoped access for authenticated users.
-- 3) Restrict admin_config to service_role only (no anon/authenticated direct reads).
-- 4) Revoke anon EXECUTE on high-risk RPCs.

-- ============================================
-- BLOCK 1: Remove dangerous anon policies
-- ============================================

-- sp_wallets
DROP POLICY IF EXISTS "sp_wallets_anon_insert" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_update" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_select" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_delete" ON public.sp_wallets;

-- sp_ledger
DROP POLICY IF EXISTS "sp_ledger_anon_insert" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_update" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_select" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_delete" ON public.sp_ledger;

-- profiles
DROP POLICY IF EXISTS "profiles_anon_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_select" ON public.profiles;

-- subscriptions
DROP POLICY IF EXISTS "subscriptions_anon_insert" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_anon_update" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_anon_select" ON public.subscriptions;

-- referrals
DROP POLICY IF EXISTS "referrals_anon_insert" ON public.referrals;
DROP POLICY IF EXISTS "referrals_anon_update" ON public.referrals;
DROP POLICY IF EXISTS "referrals_anon_select" ON public.referrals;

-- user_notifications
DROP POLICY IF EXISTS "user_notifications_anon_insert" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_anon_update" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_anon_select" ON public.user_notifications;

-- Enforce RLS enabled
ALTER TABLE public.sp_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BLOCK 2: Harden wallet/ledger policies
-- ============================================

-- Remove legacy/broad policies first
DROP POLICY IF EXISTS "sp_wallets_select_authenticated" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_insert_authenticated" ON public.sp_wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.sp_wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.sp_wallets;
DROP POLICY IF EXISTS "Service role can access all sp_wallets" ON public.sp_wallets;

DROP POLICY IF EXISTS "Users can view own ledger" ON public.sp_ledger;
DROP POLICY IF EXISTS "Service role can access all sp_ledger" ON public.sp_ledger;

-- Canonical wallet policies
DROP POLICY IF EXISTS "sp_wallets_select_own_user" ON public.sp_wallets;
CREATE POLICY "sp_wallets_select_own_user" ON public.sp_wallets
  FOR SELECT TO authenticated
  USING (sp_wallets.user_id = auth.uid());

DROP POLICY IF EXISTS "sp_wallets_insert_own_user" ON public.sp_wallets;
CREATE POLICY "sp_wallets_insert_own_user" ON public.sp_wallets
  FOR INSERT TO authenticated
  WITH CHECK (sp_wallets.user_id = auth.uid());

DROP POLICY IF EXISTS "sp_wallets_update_own_user" ON public.sp_wallets;
CREATE POLICY "sp_wallets_update_own_user" ON public.sp_wallets
  FOR UPDATE TO authenticated
  USING (sp_wallets.user_id = auth.uid())
  WITH CHECK (sp_wallets.user_id = auth.uid());

DROP POLICY IF EXISTS "sp_wallets_service_role_all" ON public.sp_wallets;
CREATE POLICY "sp_wallets_service_role_all" ON public.sp_wallets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Canonical ledger policies
DROP POLICY IF EXISTS "sp_ledger_select_own_user" ON public.sp_ledger;
CREATE POLICY "sp_ledger_select_own_user" ON public.sp_ledger
  FOR SELECT TO authenticated
  USING (sp_ledger.user_id = auth.uid());

DROP POLICY IF EXISTS "sp_ledger_service_role_all" ON public.sp_ledger;
CREATE POLICY "sp_ledger_service_role_all" ON public.sp_ledger
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Explicit grants lockdown for anon on financial tables
REVOKE ALL ON TABLE public.sp_wallets FROM anon;
REVOKE ALL ON TABLE public.sp_ledger FROM anon;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = 'sp_transactions'
  ) THEN
    EXECUTE 'REVOKE ALL ON TABLE public.sp_transactions FROM anon';
  END IF;
END;
$$;

-- ============================================
-- BLOCK 3: Restrict admin_config to service_role only
-- ============================================

DROP POLICY IF EXISTS "admin_config_select_all" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_public_read" ON public.admin_config;
DROP POLICY IF EXISTS "Anyone can read admin_config" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_read" ON public.admin_config;
DROP POLICY IF EXISTS "Public read admin config" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_authenticated_read" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_service_role_all" ON public.admin_config;

CREATE POLICY "admin_config_service_role_all" ON public.admin_config
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.admin_config FROM anon;
REVOKE ALL ON TABLE public.admin_config FROM authenticated;

-- ============================================
-- BLOCK 4: Revoke anon execute on sensitive RPCs
-- ============================================

DO $$
DECLARE
  v_has_complete_trade_v2 BOOLEAN;
  v_has_get_admin_payout_config BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'complete_trade_v2'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid'
  ) INTO v_has_complete_trade_v2;

  IF v_has_complete_trade_v2 THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.complete_trade_v2(uuid, uuid) FROM anon';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_admin_payout_config'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) INTO v_has_get_admin_payout_config;

  IF v_has_get_admin_payout_config THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_admin_payout_config() FROM anon';
  END IF;
END;
$$;

-- ============================================
-- Verification queries (run manually)
-- ============================================
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename='sp_wallets' AND roles::text LIKE '%anon%';
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename='sp_ledger' AND roles::text LIKE '%anon%';
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename='admin_config';
-- SELECT grantee, privilege_type, table_name
-- FROM information_schema.role_table_grants
-- WHERE table_name IN ('sp_wallets','sp_ledger','sp_transactions','admin_config')
--   AND grantee IN ('anon','authenticated')
-- ORDER BY table_name, grantee;

-- Common failure modes:
-- 1) Policy names differ from expected and legacy broad policies remain (check pg_policies output).
-- 2) RPC signature drift prevents REVOKE EXECUTE (check pg_proc identity arguments).
-- 3) Existing grants reintroduced outside migrations (check role_table_grants for anon/authenticated).
