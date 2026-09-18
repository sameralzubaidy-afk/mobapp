-- ============================================================================
-- FIX-Task-60 — admin-scoped policies that staging has and the chain never created
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B)
-- ============================================================================
--
-- SELECTED DELIBERATELY, NOT EXHAUSTIVELY. The fidelity gate reports 31 staging-only
-- policies; most of them are NOT backfilled, with a stated reason (full per-item
-- verdicts in e2e-test-results/fix-task-60-2026-09-18/fidelity-exceptions.md):
--
--   * 13 `*_anon_*` policies (profiles, referrals, subscriptions, user_notifications,
--     items) → staging is LOOSER than the chain; reproducing them would hand the
--     unauthenticated role read/write access in every rebuilt environment. This is a
--     staging SECURITY finding, not a gap in the chain.
--   * `admin_config_authenticated_read` (SELECT, authenticated, USING true) →
--     DELIBERATELY REMOVED by
--     20260916000158_prod_p1_stage_security_lockdown.sql ("Restrict admin_config to
--     service_role only", which also REVOKEs anon/authenticated on the table).
--     Re-adding it would expose the whole admin configuration to every signed-in
--     user. Staging still carrying it is a staging security finding.
--   * `Items visibility based on status` → DELIBERATELY REPLACED by
--     20260916000021_prod_p1_node_isolation_hardening.sql, which installs
--     `items_select_same_node_or_own`. Re-adding the old policy would widen item
--     visibility back to the pre-node-isolation model.
--   * `items_insert_own_seller`, `items_update_own_seller` — redundant: permissive
--     policies are ORed, and the rebuilt schema already grants the identical access
--     via `items_insert_authenticated` (WITH CHECK true) and `items_update_own`.
--   * the two `referrals` policies using the LEGACY `referrer_id` / `referee_id`
--     columns — dead rules that modern code (which writes referrer_user_id /
--     referred_user_id) can never satisfy.
--   * `Service role bypass - seller_payout_methods/-seller_payouts`,
--     `email_logs_service_role`, `Service role can update profiles` — `service_role`
--     already bypasses RLS, so these grant nothing extra.
--   * `trades_insert_own` / `trades_update_own` — the rebuilt schema already carries
--     `Users can insert trades` / `Users can update their trades`; the staging twins
--     are narrower duplicates of the same access.
--   * `email_logs_select_own`, `ai_logs_system_create`, `subscription_tiers_public` —
--     no shipped code path reads/writes these with a user JWT (email delivery is
--     service-role, AI moderation logging is Edge-Function/service-role, tier pricing
--     is read through existing policies). Adding them would widen access with no
--     caller to serve.
--
-- The three below ARE added: each is admin-scoped (no meaningful widening — they grant
-- trusted admins what the live system already grants them) and each is reachable from
-- a shipped admin surface that authenticates with the user JWT + anon key
-- (`p2p-kids-admin/src/lib/adminAuth.ts`), where RLS applies.

-- ============================================================================
-- 1. subscription_tiers — admin management
-- ============================================================================
DROP POLICY IF EXISTS subscription_tiers_admin ON public.subscription_tiers;
CREATE POLICY subscription_tiers_admin ON public.subscription_tiers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'::text
    )
  );

-- ============================================================================
-- 2. trades — admin read
-- ============================================================================
DROP POLICY IF EXISTS trades_admin_select ON public.trades;
CREATE POLICY trades_admin_select ON public.trades
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'::text
    )
  );

-- ============================================================================
-- 3. ai_moderation_logs — admin read
-- ============================================================================
DROP POLICY IF EXISTS ai_logs_admin_select ON public.ai_moderation_logs;
CREATE POLICY ai_logs_admin_select ON public.ai_moderation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'::text
    )
  );

-- ============================================================================
-- Verification (SQL-3)
-- ============================================================================
-- SELECT policyname, cmd, roles::text FROM pg_policies
--   WHERE schemaname='public'
--     AND policyname IN ('subscription_tiers_admin','trades_admin_select','ai_logs_admin_select')
--   ORDER BY 1;
-- Expected: 3 rows (ai_logs_admin_select/SELECT/{public}, subscription_tiers_admin/ALL/{public},
--           trades_admin_select/SELECT/{authenticated}).
-- ============================================================================
