-- ============================================================================
-- FIX-Task-60 — restore EXECUTE grants on the client-facing RPCs the rebuild lost
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B)
-- ============================================================================
--
-- THE DEFECT (found while chasing the fidelity gap; invisible to the fingerprint
-- gate, which does not capture `proacl`)
-- ---------------------------------------------------------------------------
-- `dt61_guard_revoke_fn_public` (DEV-TASK-61) REVOKEs PUBLIC/anon/authenticated on
-- every function created in `public`. That is a deliberate fail-closed default, and
-- it is why the money-mutating functions created after it are service-role-only.
--
-- But it applies to READ-ONLY, user-facing RPCs too — and those migrations never
-- had to write an explicit GRANT, because on staging the functions were created
-- BEFORE the guard existed and therefore kept Postgres' default PUBLIC EXECUTE.
-- Replaying the chain from scratch puts every file after the guard, so those grants
-- are simply never there.
--
-- MEASURED on the freshly rebuilt database (2026-09-18):
--   has_function_privilege('authenticated', <fn>, 'EXECUTE') = FALSE
-- for every function below, e.g.
--     search_listings(text,boolean,integer)                -> f
--     get_user_sp_wallet_summary(uuid)                     -> f  (fixed in 20260916000104)
-- Not one of them has a GRANT anywhere in the chain (checked: no migration grants
-- any of these names), so a from-scratch environment cannot call them at all.
-- The mobile app calls every one of them with the user's JWT, so on a rebuilt
-- database the discovery feed, notification centre, notification preferences, the
-- policy gate and referral-code validation all return "permission denied for
-- function". Staging is unaffected (it kept the grants).
--
-- SCOPE DISCIPLINE — what is deliberately NOT granted here
-- -------------------------------------------------------
-- `issue_starter_pack`, `award_referral_sp`, `award_listing_referral_sp`,
-- `upsert_admin_config_setting` and the `admin_*` family are also missing an
-- `authenticated` grant, and that is CORRECT: `20260916000136_dev_task_59_grant_lockdown.sql`
-- (owner-signed-off, 2026-08-30) locked them to `service_role` after an explicit
-- caller analysis, and `rpc_set_sp_wallet_state` / `rpc_void_tax_for_trade` /
-- `rpc_record_stripe_refund` / `process_sp_expiration` likewise.
-- `award_challenge_sp`, `refund_sp_for_cancelled_trade` and `extend_trial_period`
-- are NOT granted here either: they are money mutations whose only in-repo callers
-- are in `services/sp/earning.ts` / `trialExtension.ts`, which DT-59 characterised
-- as test-only — they need the same caller analysis DT-59 performed, not a
-- unilateral grant. See the FIX-Task-60 report, item "money RPCs pending analysis".
--
-- Rollback (per function): `REVOKE EXECUTE ON FUNCTION public.<name>(<sig>) FROM authenticated;`
-- plus `FROM anon` for the two marked below.

-- ============================================================================
-- Discovery (services/discovery.ts)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.search_listings(TEXT, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_listings_by_category(UUID, BOOLEAN, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_listings_by_category_and_query(UUID, TEXT, BOOLEAN, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recommendations(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- SP display surfaces (services/sp.ts, contexts/AuthContext.tsx)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_sp_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_expiration_warnings(UUID) TO authenticated;

-- ============================================================================
-- Notifications (services/referralNotifications.ts, services/notificationPreferences.ts)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_notification_preference(
  UUID, public.notification_category, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN,
  TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_user_preferences(UUID) TO authenticated;

-- ============================================================================
-- Policy / ToS gate (services/tos.ts, services/privacyPolicy.ts, services/auth.ts)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_current_policy(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_accepted_current_policy(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_policy_acceptance(UUID, UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- Pre-session paths — these two are reached before a session exists, so they also
-- need the `anon` role (the sibling precedent in the guarded-creation file grants
-- anon to its node helpers for the same reason).
--   * check_referral_code_exists — referral-code entry during signup
--   * process_unsubscribe        — the unsubscribe screen behind an email link
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.check_referral_code_exists(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_unsubscribe(TEXT) TO authenticated, anon;

-- ============================================================================
-- Trade messaging receipts (services/chat.ts)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.mark_trade_messages_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_trade_messages_delivered(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_message_delivery_status(UUID, TEXT) TO authenticated;

-- ============================================================================
-- Verification (SQL-3)
-- ============================================================================
-- SELECT p.oid::regprocedure::text,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_ok
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('search_listings','get_recommendations','get_user_sp_wallet_summary',
--                      'get_unread_notification_count','get_notification_preferences',
--                      'record_policy_acceptance','check_referral_code_exists','get_sp_config')
--  ORDER BY 1;
-- Expected: every row auth_ok = t.
--
-- Regression guard (must stay FALSE — intentional DT-59 lockdowns):
-- SELECT has_function_privilege('authenticated', 'public.issue_starter_pack(uuid,uuid)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.award_referral_sp(uuid,uuid,uuid)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.upsert_admin_config_setting(text,text,public.admin_config_category,text,boolean,boolean)', 'EXECUTE');
-- Expected: f, f, f
-- ============================================================================
