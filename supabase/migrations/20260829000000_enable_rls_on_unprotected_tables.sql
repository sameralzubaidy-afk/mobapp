-- ============================================================================
-- Migration: Enable RLS on 12 public tables currently disabled
-- Dev Task 26 (surfaced by security-advisory tooling; pre-release hardening)
-- Mode: B (idempotent rerunnable migration)
--
-- Purpose: Close the security gap where 12 public tables have ROW LEVEL
-- SECURITY disabled. Each table section below is self-contained
-- (ENABLE RLS + DROP/CREATE policies) so it can be applied and rolled back in
-- isolation, one table at a time per the task constraint.
--
-- Access-model summary (all verified against app / Edge Function / admin-portal
-- code before authoring):
--   Group 1 — orphaned/legacy tables (no code references): locked to
--     service_role only. No anon/authenticated exposure.
--   Group 2 — backend cron-audit tables (written only by SECURITY DEFINER
--     wrappers or pg_cron): locked to service_role only.
--   Group 3 — admin-portal client-visible tables (admin user JWT): admin-only
--     via the new SECURITY DEFINER user_has_role() helper.
--   Group 4 — role_based_access_control: self-read (admin login) + admin-read +
--     service_role.
--
-- NEW helper: public.user_has_role(p_user_id, p_role) — SECURITY DEFINER so an
-- RLS policy can reference it (including on the RBAC table itself) without
-- infinite recursion (the function body runs as the owner and bypasses RLS).
-- It reads role_based_access_control, the canonical admin source across the
-- admin portal login and all admin RPCs.
--
-- ============================================================================

-- ============================================================================
-- BLOCK 1: Recursion-safe admin role helper (must exist before policies)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_has_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.role_based_access_control rbac
    WHERE rbac.user_id = p_user_id
      AND rbac.role = p_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_role(UUID, TEXT) TO authenticated, service_role;

-- ============================================================================
-- GROUP 1: Orphaned / legacy tables — service_role only (no client references)
--   swap_points_ledger (legacy predecessor of sp_ledger — not in any migration)
--   v_config_value, v_referrer_sp (legacy tables, not in any migration)
--   auto_complete_results (legacy predecessor of auto_complete_runs)
--   sms_rate_limit_log (created in 20241213000002; unused by current code —
--     real rate limiting lives in Edge Function _shared/rate-limiter.ts)
-- ============================================================================

-- 1. swap_points_ledger
ALTER TABLE public.swap_points_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "swap_points_ledger_service_role_all" ON public.swap_points_ledger;
CREATE POLICY "swap_points_ledger_service_role_all" ON public.swap_points_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. v_config_value
ALTER TABLE public.v_config_value ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "v_config_value_service_role_all" ON public.v_config_value;
CREATE POLICY "v_config_value_service_role_all" ON public.v_config_value
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. v_referrer_sp
ALTER TABLE public.v_referrer_sp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "v_referrer_sp_service_role_all" ON public.v_referrer_sp;
CREATE POLICY "v_referrer_sp_service_role_all" ON public.v_referrer_sp
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. auto_complete_results
ALTER TABLE public.auto_complete_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auto_complete_results_service_role_all" ON public.auto_complete_results;
CREATE POLICY "auto_complete_results_service_role_all" ON public.auto_complete_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. sms_rate_limit_log
ALTER TABLE public.sms_rate_limit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_rate_limit_log_service_role_all" ON public.sms_rate_limit_log;
CREATE POLICY "sms_rate_limit_log_service_role_all" ON public.sms_rate_limit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- GROUP 2: Backend cron-audit tables — service_role only
--   message_email_runs    (written by scheduled_send_message_emails — SECURITY DEFINER)
--   message_cleanup_runs  (written by scheduled_message_cleanup — SECURITY DEFINER)
--   auto_complete_runs    (written by scheduled_auto_complete_trades via pg_cron,
--                          runs as postgres superuser, bypasses RLS)
-- ============================================================================

-- 6. message_email_runs
ALTER TABLE public.message_email_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message_email_runs_service_role_all" ON public.message_email_runs;
CREATE POLICY "message_email_runs_service_role_all" ON public.message_email_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. message_cleanup_runs
ALTER TABLE public.message_cleanup_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message_cleanup_runs_service_role_all" ON public.message_cleanup_runs;
CREATE POLICY "message_cleanup_runs_service_role_all" ON public.message_cleanup_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. auto_complete_runs
ALTER TABLE public.auto_complete_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auto_complete_runs_service_role_all" ON public.auto_complete_runs;
CREATE POLICY "auto_complete_runs_service_role_all" ON public.auto_complete_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- GROUP 3: Admin-portal client-visible tables — admin-only via user_has_role()
--   admin_audit_log  (singular) — written by admin portal pages
--     (settings/nodes, settings/trade-timing, tax/settings, NodeFormModal),
--     read by nodes/page + tax/nodes; also written by SECURITY DEFINER RPCs
--     (update_node_tax_config).
--   admin_audit_logs (plural) — SELECT by admin portal (trades/[id]);
--     INSERT by mobile app with user JWT (accountService.writeAuditLog →
--     unlink_social_account) so a self-insert policy is required, plus admin
--     INSERT from admin Edge Functions (service role).
-- ============================================================================

-- 9. admin_audit_log (singular)
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit_log_admin_insert" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_admin_insert" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (admin_id = auth.uid() OR public.user_has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_audit_log_admin_select" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_admin_select" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.user_has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_audit_log_service_role_all" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_service_role_all" ON public.admin_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. admin_audit_logs (plural)
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit_logs_insert_self_or_admin" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_insert_self_or_admin" ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.user_has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_audit_logs_select_admin" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_select_admin" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.user_has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_audit_logs_service_role_all" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_service_role_all" ON public.admin_audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- GROUP 4: role_based_access_control + zip_codes
--   role_based_access_control — self-read keeps the admin portal login working
--     (login page: SELECT role FROM role_based_access_control WHERE user_id =
--     auth.uid() AND role='admin'); admin-read via user_has_role() (no
--     recursion — SECURITY DEFINER); service_role ALL for role management
--     RPCs/API routes. Anon gets nothing.
--   zip_codes — vestigial public geo mapping (no app/EF/admin references; node
--     resolution reads nodes.zip_code via resolve_active_node_for_signup).
--     Locked to authenticated-read + service_role (no anon exposure).
-- ============================================================================

-- 11. role_based_access_control
ALTER TABLE public.role_based_access_control ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_select_own" ON public.role_based_access_control;
CREATE POLICY "rbac_select_own" ON public.role_based_access_control
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "rbac_select_admin" ON public.role_based_access_control;
CREATE POLICY "rbac_select_admin" ON public.role_based_access_control
  FOR SELECT TO authenticated
  USING (public.user_has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "rbac_service_role_all" ON public.role_based_access_control;
CREATE POLICY "rbac_service_role_all" ON public.role_based_access_control
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12. zip_codes
ALTER TABLE public.zip_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zip_codes_authenticated_select" ON public.zip_codes;
CREATE POLICY "zip_codes_authenticated_select" ON public.zip_codes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "zip_codes_service_role_all" ON public.zip_codes;
CREATE POLICY "zip_codes_service_role_all" ON public.zip_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- Verification queries (run manually after apply)
-- ============================================================================
-- 1) Per-table RLS + policy count:
--    SELECT c.relname, c.relrowsecurity,
--           (SELECT count(*) FROM pg_policies p
--             WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count
--    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--    WHERE n.nspname='public'
--      AND c.relname IN ('zip_codes','role_based_access_control',
--        'admin_audit_logs','admin_audit_log','message_email_runs',
--        'message_cleanup_runs','auto_complete_runs','sms_rate_limit_log',
--        'swap_points_ledger','v_config_value','v_referrer_sp','auto_complete_results')
--    ORDER BY c.relname;
--
-- 2) Final gap check (must return 0 rows):
--    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
--    ORDER BY 1;
--
-- Common failure modes:
--   1) Missing user_has_role() before a policy references it -> run BLOCK 1 first.
--   2) Policy names colliding with an existing policy -> DROP POLICY IF EXISTS is
--      always run before CREATE in this file.
--   3) RBAC recursion if a policy on role_based_access_control called a helper
--      that is NOT SECURITY DEFINER -> user_has_role() is SECURITY DEFINER.
--   4) Admin login breaking if RBAC self-read is removed -> rbac_select_own is
--      intentionally included.
