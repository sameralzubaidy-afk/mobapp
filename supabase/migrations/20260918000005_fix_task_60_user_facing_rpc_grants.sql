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
-- Guarded apply (FIX-Task-63, 2026-09-18)
-- ----------------------------------------------------------------------------
-- These were 20 bare `GRANT` statements. That form is atomic and ALL-OR-NOTHING:
-- on staging the very first one failed — `public.search_listings(text,boolean,integer)`
-- does not exist there (staging's signature predates the repair) — so the whole file
-- aborted and NONE of the twenty grants landed, leaving the chain and staging
-- disagreeing in a way nothing recorded. A missing signature is an ENVIRONMENT
-- difference, not a chain defect, so each target is now applied only if it exists.
--
-- FAIL-LOUD IS PRESERVED (BP-90): if ZERO targets matched, the file was inert and it
-- raises. A partial match prints exactly which signatures were absent, so a genuine
-- chain gap cannot hide behind the environment difference.
--
-- Format: '<signature>|<roles>'. Signature resolution goes through
-- `to_regprocedure` (never string parsing), which fails to NULL rather than raising
-- for an unknown name.
-- ============================================================================
DO $fix60_grants$
DECLARE
  v_targets CONSTANT TEXT[] := ARRAY[
    -- Discovery (services/discovery.ts)
    'public.search_listings(text,boolean,integer)|authenticated',
    'public.search_listings_by_category(uuid,boolean,integer,integer)|authenticated',
    'public.search_listings_by_category_and_query(uuid,text,boolean,integer,integer)|authenticated',
    'public.get_recommendations(uuid,integer)|authenticated',
    -- SP display surfaces (services/sp.ts, contexts/AuthContext.tsx)
    'public.get_sp_config(text)|authenticated',
    'public.get_user_expiration_warnings(uuid)|authenticated',
    -- Notifications (services/referralNotifications.ts, services/notificationPreferences.ts)
    'public.get_unread_notification_count(uuid)|authenticated',
    'public.mark_notification_read(uuid,uuid)|authenticated',
    'public.mark_all_notifications_read(uuid)|authenticated',
    'public.get_notification_preferences(uuid)|authenticated',
    'public.update_notification_preference(uuid,public.notification_category,boolean,boolean,boolean,boolean,time without time zone,time without time zone)|authenticated',
    'public.initialize_user_preferences(uuid)|authenticated',
    -- Policy / ToS gate (services/tos.ts, services/privacyPolicy.ts, services/auth.ts)
    'public.get_current_policy(text)|authenticated',
    'public.has_accepted_current_policy(uuid,text)|authenticated',
    'public.record_policy_acceptance(uuid,uuid,text,text)|authenticated',
    -- Pre-session paths — reached before a session exists, so they also need `anon`
    -- (sibling precedent: the guarded-creation file grants anon to its node helpers).
    'public.check_referral_code_exists(text)|authenticated, anon',
    'public.process_unsubscribe(text)|authenticated, anon',
    -- Trade messaging receipts (services/chat.ts)
    'public.mark_trade_messages_read(uuid,uuid)|authenticated',
    'public.mark_trade_messages_delivered(uuid,uuid)|authenticated',
    'public.update_message_delivery_status(uuid,text)|authenticated'
  ];
  v_entry   TEXT;
  v_sig     TEXT;
  v_roles   TEXT;
  v_granted INTEGER := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOREACH v_entry IN ARRAY v_targets LOOP
    v_sig   := split_part(v_entry, '|', 1);
    v_roles := split_part(v_entry, '|', 2);

    IF to_regprocedure(v_sig) IS NULL THEN
      v_missing := v_missing || v_sig;
      CONTINUE;
    END IF;

    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s', v_sig, v_roles);
    v_granted := v_granted + 1;
  END LOOP;

  IF v_granted = 0 THEN
    RAISE EXCEPTION
      '[FIX-60] none of the % target signature(s) exist — this migration would be a silent no-op',
      array_length(v_targets, 1);
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE NOTICE
      '[FIX-60] granted %/% — absent in THIS environment (expected on staging, a DEFECT on a rebuilt chain): %',
      v_granted, array_length(v_targets, 1), array_to_string(v_missing, ', ');
  ELSE
    RAISE NOTICE '[FIX-60] granted %/% client-facing RPCs', v_granted, array_length(v_targets, 1);
  END IF;
END
$fix60_grants$;


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
