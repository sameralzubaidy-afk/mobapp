-- =============================================================================
-- Migration: Dev Task 59 (Revision 2) — Systemic Grant Sweep (catch-all)
-- File: grant-lockdown portion (grants + broken-pattern carry-forward fix)
-- Date: 2026-08-30
-- Mode: Idempotent Rerunnable (Mode B) — REVOKE/GRANT + CREATE OR REPLACE are
--       safe to re-run.
--
-- Context (Dev Task 59, Revision 2 — owner signed off 2026-08-30):
--   Task 55's root-cause finding: money-mutating DB functions without an
--   explicit, minimal grant list default to PUBLIC/anon/authenticated access.
--   Tasks 56a/56b/57 fixed the specific instances found. This is the systemic
--   catch-all sweep for everything left in the same class, plus two gotchas
--   found in Task 57:
--     (a) request.jwt.claim.role is NEVER set by this Supabase/PostgREST —
--         the reliable request-role signal is current_setting('role');
--     (b) plpgsql resolves referenced helper functions even inside
--         short-circuited branches, so a missing helper 500s EVERY call.
--
-- THIS FILE = grants + the sub_020 carry-forward fix.
-- Companion file 20260830000012 = identity (auth.uid()) fixes for functions
-- that keep a legitimate user-JWT caller.
--
-- Caller → credential analysis (verified against supabase/functions/** and the
-- mobile app, 2026-08-30):
--   * All Edge Functions use service-role keys (svcClient / supabaseServiceKey /
--     adminClient). The only user-JWT EF client is complete-trade, and it does
--     NOT call any function locked here (apply_tax_to_trade is called from the
--     mobile app, handled in the identity-fix file).
--   * The admin portal calls these RPCs ONLY through service-role Next.js API
--     routes guarded by x-admin-secret (BP-49): admin_toggle_sp_wallet_status,
--     admin_delete_user, admin_suspend_user, admin_unsuspend_user,
--     create_seller_payout_on_trade_completion (via initiate-payout EF).
--   * SP-mint / referral-award / starter-pack functions are called ONLY from
--     SECURITY DEFINER triggers / other RPCs (owner context) — no direct
--     external caller needs EXECUTE. The mobile sp/earning.ts:issueStarterPack
--     is test-only (no production screen calls it; verified 2026-08-30).
--   * increment_trial_uses is called only inside create_trial_subscription
--     (owner context); the mobile app calls create_trial_subscription, not this.
--   * convert_trial_to_active / downgrade_trial_to_grace are called only by the
--     trial-conversion EF (service role) + a stub e2e that skips (no test user).
--
-- So every function locked to service_role here has NO legitimate user-JWT
-- caller, and every internal/trigger caller runs as the SECURITY DEFINER owner,
-- which bypasses grants. Mobile impact: none.
--
-- Rollback (one-line reverse per function):
--   GRANT EXECUTE ON FUNCTION public.<name>(<sig>) TO <the revoked roles>;
--   (admin_reset_trial_uses body rollback = re-apply 20260312000000 definition.)
-- =============================================================================

-- =============================================================================
-- SECTION A — Carry-forward: admin_reset_trial_uses (sub_020)
--   Broken pattern: request.jwt.claim.role is always NULL on this PostgREST, so
--   the old guard (v_actor_role='service_role' OR auth.jwt() role='admin')
--   rejected BOTH the only legitimate caller (service_role) AND admin JWTs.
--   The grant is already service_role-only; the body's role check is the gate.
--   Fix: current_setting('role') per the DT-57 pattern. No missing-helper risk:
--   the body references only public.profiles + public.subscription_events
--   (tables), both confirmed present.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_trial_uses(p_user_id UUID, p_reason TEXT DEFAULT 'support_reset')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_old_count INTEGER;
BEGIN
  -- DT59: request.jwt.claim.role is NEVER set by this Supabase/PostgREST (it is
  -- always NULL even for service-role JWTs, verified live in DT-57) — the old
  -- guard here was dead code that rejected every caller. The reliable
  -- request-role signal is current_setting('role'), which PostgREST sets and
  -- which survives inside SECURITY DEFINER.
  v_actor_role := COALESCE(current_setting('role', true), '');

  -- Grant is service_role-only; this is the in-function gate (fail closed).
  IF v_actor_role <> 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: only service_role can reset trial usage';
  END IF;

  SELECT p.trial_uses_count INTO v_old_count
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;

  IF v_old_count IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: profile missing for user %', p_user_id;
  END IF;

  UPDATE public.profiles p
  SET trial_uses_count = 0,
      updated_at = NOW()
  WHERE p.user_id = p_user_id;

  INSERT INTO public.subscription_events (user_id, event_type, metadata, created_at)
  VALUES (
    p_user_id,
    'trial_uses_reset',
    jsonb_build_object('old_count', v_old_count, 'new_count', 0, 'reason', p_reason),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'old_count', v_old_count,
    'new_count', 0,
    'reason', p_reason
  );
END;
$$;

-- Re-assert the minimal grant (service_role only).
REVOKE EXECUTE ON FUNCTION public.admin_reset_trial_uses(UUID, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_trial_uses(UUID, TEXT) TO service_role;

-- =============================================================================
-- SECTION B — Grant-only lockdowns → service_role only.
--   These money-mutating SECURITY DEFINER functions have NO legitimate
--   user-JWT/anon caller (verified above). Default posture: REVOKE anon +
--   authenticated + PUBLIC, GRANT service_role. Internal (owner-context)
--   callers are unaffected. REVOKE/GRANT are idempotent.
-- =============================================================================

-- 1. Creates seller_payouts rows (money). Called by initiate-payout EF (service
--    role) + complete_trade_v2/rpc_process_auto_complete (owner). Was anon.
REVOKE EXECUTE ON FUNCTION public.create_seller_payout_on_trade_completion(UUID, UUID, INTEGER) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_seller_payout_on_trade_completion(UUID, UUID, INTEGER) TO service_role;

-- 2. SP wallet/ledger write (SP mint path). Called by referral signup trigger
--    (owner). Was anon + authenticated.
REVOKE EXECUTE ON FUNCTION public.adjust_sp_wallet(UUID, INTEGER, TEXT, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_sp_wallet(UUID, INTEGER, TEXT, TEXT) TO service_role;

-- 3. SP award (referral trade bonus). Called by process_referral_bonus_on_trade_v2
--    trigger (owner). Was authenticated + service_role.
REVOKE EXECUTE ON FUNCTION public.award_referral_sp(UUID, UUID, UUID) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_referral_sp(UUID, UUID, UUID) TO service_role;

-- 4. SP award (referral listing bonus). Called by process_referral_bonus_on_listing_v2
--    trigger (owner). Was authenticated.
REVOKE EXECUTE ON FUNCTION public.award_listing_referral_sp(UUID, UUID, UUID, UUID) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_listing_referral_sp(UUID, UUID, UUID, UUID) TO service_role;

-- 5. SP award (starter pack). Called by apply_starter_pack_on_approval (owner).
--    Mobile sp/earning.ts:issueStarterPack is TEST-ONLY (no production screen
--    calls it — verified 2026-08-30). Was authenticated.
REVOKE EXECUTE ON FUNCTION public.issue_starter_pack(UUID, UUID) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_starter_pack(UUID, UUID) TO service_role;

-- 6. Shared starter-pack-on-approval helper (awards SP). Called by
--    admin_approve_listing/admin_approve_flagged_listing (owner). Was
--    authenticated + service_role.
REVOKE EXECUTE ON FUNCTION public.apply_starter_pack_on_approval(UUID, UUID, UUID, BOOLEAN) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_starter_pack_on_approval(UUID, UUID, UUID, BOOLEAN) TO service_role;

-- 7. Freeze/suspend/activate SP wallets (money state). Called by admin API route
--    /api/admin/sp-wallet/actions (service-role client + x-admin-secret gate).
--    Was PUBLIC-by-default (no grant/revoke anywhere).
REVOKE EXECUTE ON FUNCTION public.admin_toggle_sp_wallet_status(UUID, TEXT, TEXT, UUID) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_toggle_sp_wallet_status(UUID, TEXT, TEXT, UUID) TO service_role;

-- 8-10. Admin user lifecycle (freezes SP wallet on delete; blocks earning via
--    suspend). Called by admin API routes /api/admin/users/** (service-role
--    client + x-admin-secret gate). Were PUBLIC-by-default.
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(UUID, UUID, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID, UUID, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_suspend_user(UUID, UUID, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(UUID, UUID, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_unsuspend_user(UUID, UUID, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend_user(UUID, UUID, TEXT) TO service_role;

-- 11. SP expiry processing (expires balances + writes sp_ledger). pg_cron only.
--    Was PUBLIC-by-default.
REVOKE EXECUTE ON FUNCTION public.process_sp_expiration() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_sp_expiration() TO service_role;

-- 12-13. Subscription lifecycle: trial → grace (freezes spendable SP) and
--    trial → active. Called by trial-conversion EF (service role). Were
--    PUBLIC-by-default.
REVOKE EXECUTE ON FUNCTION public.downgrade_trial_to_grace(UUID) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.downgrade_trial_to_grace(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.convert_trial_to_active(UUID) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_trial_to_active(UUID) TO service_role;

-- 14. Void collected tax for a cancelled/declined/expired trade (money). Called
--    by cancel-trade / transactions-* / process-expired-offers /
--    check-authorization-expiry / trade-extension / resolve-dispute /
--    admin-trade-action EFs — ALL service-role clients. Was PUBLIC-by-default.
REVOKE EXECUTE ON FUNCTION public.rpc_void_tax_for_trade(UUID, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_void_tax_for_trade(UUID, TEXT) TO service_role;

-- 15. Record Stripe refund against tax ledger. Called by stripe-webhook /
--    resolve-dispute / admin-trade-action / trade-refund EFs (service role).
--    Was authenticated + service_role.
REVOKE EXECUTE ON FUNCTION public.rpc_record_stripe_refund(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_stripe_refund(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) TO service_role;

-- 16. Set SP wallet state (freeze/unfreeze/grace). Called by renew-subscription /
--    create-subscription-from-payment-method / grace-period-cron EFs (service
--    role — all verified to use service keys). Was authenticated + service_role.
REVOKE EXECUTE ON FUNCTION public.rpc_set_sp_wallet_state(UUID, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_set_sp_wallet_state(UUID, TEXT) TO service_role;

-- 17. increment_trial_uses — handled in the identity-fix file (20260830000012)
--    with an auth.uid() self-gate instead of a grant lockdown: the sub-020 E2E
--    calls it with a user JWT (src/__tests__/e2e/sub-020-trial-limit.e2e.ts), so
--    it must stay authenticated+service_role with the real-caller gate.

-- =============================================================================
-- SECTION C — Admin listing force-delete / pause: keep authenticated (mobile
--   admin-path test + future admin UI) but they carry an internal auth.uid() +
--   is_admin gate, so the exposure is contained. Explicitly grant
--   authenticated + service_role and REVOKE anon/PUBLIC (they were PUBLIC).
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.admin_force_delete_listing(UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_delete_listing(UUID, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_pause_listing(UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_pause_listing(UUID, TEXT) TO authenticated, service_role;

-- =============================================================================
-- SECTION D — Defensive: legacy 6-arg upsert_admin_config_setting
--   (no p_admin_id — no editor audit trail). Dropped in 20260808000001; if it
--   somehow still exists live (drift), revoke anon/authenticated. Guarded so the
--   migration is safe to re-run whether or not it exists.
-- =============================================================================
DO $$
BEGIN
  IF to_regprocedure('public.upsert_admin_config_setting(text,text,public.admin_config_category,text,boolean,boolean)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.upsert_admin_config_setting(text,text,public.admin_config_category,text,boolean,boolean) FROM anon, authenticated, PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_admin_config_setting(text,text,public.admin_config_category,text,boolean,boolean) TO service_role';
  END IF;
END;
$$;

-- =============================================================================
-- VERIFICATION QUERIES (run after apply; one statement per MCP call)
-- 1) Live grant sweep for every function locked here:
--    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
--           r.privilege_type, r.grantee
--    FROM pg_proc p
--    JOIN pg_namespace n ON n.oid = p.pronamespace
--    LEFT JOIN information_schema.role_routine_grants r
--      ON r.specific_name = p.oid::text AND r.routine_schema = 'public'
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('admin_reset_trial_uses','create_seller_payout_on_trade_completion',
--        'adjust_sp_wallet','award_referral_sp','award_listing_referral_sp','issue_starter_pack',
--        'apply_starter_pack_on_approval','admin_toggle_sp_wallet_status','admin_delete_user',
--        'admin_suspend_user','admin_unsuspend_user','process_sp_expiration','downgrade_trial_to_grace',
--        'convert_trial_to_active','rpc_void_tax_for_trade','rpc_record_stripe_refund',
--        'rpc_set_sp_wallet_state','increment_trial_uses','admin_force_delete_listing',
--        'admin_pause_listing')
--    ORDER BY p.proname, r.grantee;
--    EXPECTED: only service_role (and postgres owner) for Section B; service_role
--    + authenticated for Section C; service_role for admin_reset_trial_uses.
-- 2) No request.jwt.claim.role left in money functions:
--    SELECT proname FROM pg_proc WHERE prosrc ILIKE '%request.jwt.claim.role%';
--    EXPECTED: empty.
-- =============================================================================
