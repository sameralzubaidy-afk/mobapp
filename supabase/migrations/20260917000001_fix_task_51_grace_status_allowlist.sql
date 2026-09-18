-- Migration: FIX-Task-51 — SP-spend allow-lists must accept BOTH grace spellings
-- Mode: Idempotent rerunnable migration (function-body install only; no data writes).
--   FIX-Task-57 (2026-09-18): `get_subscription_summary` needs a DROP FUNCTION IF EXISTS
--   prologue first (BP-12) because a renumbered legacy file installs a narrower row type on
--   a fresh replay — see BLOCK 1c. The other two functions are CREATE OR REPLACE only.
-- Dependencies: public.subscriptions, public.sp_wallets
--
-- WHY (measured, 2026-09-17 — FIX-Task-51, staging drntwgporzabmxdqykrp):
--   `public.subscriptions.status` has TWO legal spellings for the same state —
--   the legacy `'grace'` and the canonical `'grace_period'` — because the CHECK
--   constraint added by 20260213000000_enhance_subscriptions_sub_002.sql allows
--   both (`status IN ('free','trial','active','grace','canceled','expired',
--   'paused','grace_period','cancelled')`).
--
--   Live data today: grace_period = 446 rows, grace = 1 row (the QA persona
--   `test-grace@kidsmarketplace.test`, subscriptions.id
--   23a5609d-39a2-45fe-a93a-0ebc799a852e). The CLIENT accepts both spellings
--   (`src/services/subscription.ts` canSpendSp includes 'grace'), so the app
--   offers the SP flow — while every SERVER gate listed only 'grace_period' and
--   refused it. Observed live before this migration:
--     SELECT * FROM public.fn_get_sp_entitlement('<grace persona>');
--       -> {can_earn_sp:false, can_spend_sp:false,
--           wallet_state:'grace_period', subscription_status:'grace'}
--   i.e. the EF gate REFUSED a spend the DB trigger (fn_reserve_sp_on_offer,
--   which keys on WALLET state) would have ALLOWED. That is the same
--   promise-vs-enforcement contradiction class FIX-Task-50 fixed in the copy.
--
--   Fix (owner-approved 2026-09-17): make the two SP-spend gates tolerant of the
--   legacy spelling so they can never disagree with the client or with R6, and
--   re-assert them from a file numbered LAST so a full migration replay installs
--   these bodies instead of the pre-R6 ones.
--
-- CHAIN CONTEXT (why this file exists at all):
--   20260916000104_enforce_wallet_state_on_spend_earn.sql is a RENUMBERED legacy
--   file (its original task is ADMIN-V2-003, pre-R6) that replaced
--   `can_user_spend_sp` with a body blocking `grace_period`. Because it is
--   numbered AFTER the R6 migration 20260810000010_r11_r6_sp_caps_and_entitlement
--   (which defines the R6 body), a fresh full replay would install the PRE-R6
--   rule. This file is numbered after both, so it wins on a replay.
--   NOTE (deliberate, out of scope): `debit_sp_for_trade` has the same numbering
--   problem, but it has NO caller — verified live:
--     SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--     WHERE n.nspname='public' AND (p.prosrc ILIKE '%can_user_spend_sp%'
--                                   OR p.prosrc ILIKE '%debit_sp_for_trade%');
--     -> 0 rows
--   so it is left untouched here and flagged in the FIX-Task-51 handoff.
--
-- R6 SEMANTICS (owner decision 2026-08-09) — UNCHANGED by this migration:
--   * grace may SPEND existing SP (wallet state 'grace_period'), never EARNS
--   * the wallet is frozen only when the grace window ENDS
--   * `can_earn_sp` stays exactly ('trial','active') — 'grace' is deliberately
--     NOT added there.
--
-- ROLLBACK (state it before executing; all three bodies captured live in the
-- FIX-Task-51 session via pg_get_functiondef):
--   Re-run the CREATE OR REPLACE statements with the previous bodies —
--   `can_user_spend_sp`: the R6 block in
--   20260810000010_r11_r6_sp_caps_and_entitlement.sql lines 694-728 (status list
--   without 'grace'); `fn_get_sp_entitlement`: that same file, lines 179-228;
--   `get_subscription_summary`: the live body captured in the FIX-Task-51 session
--   (status list without 'grace'). No data is touched, so rollback is limited to
--   those three function bodies. BLOCK 1d's grants are behaviour-neutral (they
--   restore the pre-change ACLs) and need no rollback.

-- =============================================================================
-- BLOCK 1 — Functions (attributes preserved verbatim from the live definitions:
--           SECURITY DEFINER + SET search_path = public; fn_get_sp_entitlement is
--           also STABLE. CREATE OR REPLACE preserves the existing ACLs; the one
--           DROP FUNCTION (BLOCK 1c) discards them, so BLOCK 1d re-asserts all three.)
-- =============================================================================

-- R6 + legacy-spelling tolerance. can_user_spend_sp is an ORPHAN today (no live
-- caller — see the header query), but it is granted to authenticated/service_role
-- and is part of the public API surface, so it must not contradict the other gate.
CREATE OR REPLACE FUNCTION public.can_user_spend_sp(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_wallet_state TEXT;
BEGIN
  SELECT s.status INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- FIX-Task-51: 'grace' is the legacy spelling of 'grace_period' and IS a legal
  -- value of subscriptions.status (see the CHECK constraint). Both must be
  -- accepted or a grace user is refused SP while the client offers it.
  IF v_status IS NULL OR v_status NOT IN ('trial', 'active', 'paused', 'cancelled', 'canceled', 'grace_period', 'grace') THEN
    RETURN FALSE;
  END IF;

  SELECT w.state INTO v_wallet_state
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id;

  IF v_wallet_state IN ('frozen', 'suspended') THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$function$;

-- The SERVER-AUTHORITATIVE gate: supabase/functions/create-trade-offer calls this
-- (resolveSpRedemption) and blocks when can_spend_sp is false.
CREATE OR REPLACE FUNCTION public.fn_get_sp_entitlement(p_user_id uuid)
 RETURNS TABLE(can_earn_sp boolean, can_spend_sp boolean, wallet_state text, subscription_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_wallet_state TEXT;
BEGIN
  SELECT s.status
  INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC
  LIMIT 1;

  SELECT w.state
  INTO v_wallet_state
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id
  LIMIT 1;

  v_status := COALESCE(v_status, 'free');
  v_wallet_state := COALESCE(v_wallet_state, 'inactive');

  RETURN QUERY SELECT
    -- R6: only an ACTIVE trial/paid member earns. 'grace' is NOT added here —
    -- grace users spend, never earn.
    (v_status IN ('trial','active') AND v_wallet_state IN ('active','grace_period')) AS can_earn_sp,
    -- FIX-Task-51: both grace spellings spend; frozen/suspended/expired cannot.
    (v_status IN ('trial','active','paused','cancelled','canceled','grace_period','grace')
       AND v_wallet_state IN ('active','grace_period')) AS can_spend_sp,
    v_wallet_state,
    v_status;
END;
$function$;

-- =============================================================================
-- BLOCK 1c — The CLIENT-facing SP permission flag (same gap, same fix).
--   `src/contexts/AuthContext.tsx` and `src/services/auth.ts` read this on every
--   session refresh, so it decides whether the app OFFERS the SP flow at all.
--   Live body before this migration: can_spend_sp TRUE for
--   ('trial','active','paused','cancelled','canceled','grace_period') — i.e. a
--   `'grace'`-spelled row was refused by the client AND by the EF, while a
--   correctly-spelled grace user was allowed (no asymmetry for the 446 real rows,
--   but the same vocabulary hole).
--
-- ⚠️ FIX-Task-57 (2026-09-18) — A DROP **IS** REQUIRED HERE (BP-12), and the
--   earlier claim that "signature is UNCHANGED, no DROP needed" was TRUE AGAINST
--   LIVE STAGING BUT FALSE ON A FRESH REPLAY. Measured by
--   `node scripts/migrations/replay-probe.mjs`: this file was the ONLY unresolved
--   file of 531 (`ERROR: cannot change return type of existing function |
--   DETAIL: Row type defined by OUT parameters is different`).
--
--   WHY: `20260916000064_fix_trade_sp_credit_integrity.sql` is a RENUMBERED LEGACY
--   file (its own header still reads `090_fix_trade_sp_credit_integrity.sql`) and it
--   is numbered AFTER the R6 file `20260810000010_r11_r6_sp_caps_and_entitlement.sql`.
--   It re-declares this function with the PRE-R6 FOUR-column row type
--   (status, can_spend_sp, trial_end_date, current_period_end) — no `can_earn_sp`.
--   Live staging carries the R6 FIVE-column row type (verified against the captured
--   `staging-fp3.txt` fingerprint: `TABLE(status text, can_spend_sp boolean,
--   can_earn_sp boolean, trial_end_date timestamp with time zone, current_period_end
--   timestamp with time zone)`), so the live signature has always matched THIS file.
--   The 4-column row type exists ONLY in the replay — i.e. the same "renumbered
--   legacy file lands after R6" class the header already describes for
--   `can_user_spend_sp` in `20260916000104_…`, except this instance is worse: it
--   does not merely install an older BODY, it makes the newer definition fail to
--   apply at all, so a from-scratch rebuild silently kept the PRE-R6 4-column shape.
--
--   The DROP is safe: the callers of this function are plpgsql bodies
--   (`20240101000003_update_trade_rpcs_v2.sql`, `20240101000004_…`,
--   `20260103000000_…`, `20260203000000_…`) plus the mobile client via PostgREST —
--   none is a view or rule, so nothing is dropped by dependency. The GRANTs it
--   discards are re-asserted in BLOCK 1d below.
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_subscription_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_subscription_summary(p_user_id uuid)
 RETURNS TABLE(status text, can_spend_sp boolean, can_earn_sp boolean, trial_end_date timestamp with time zone, current_period_end timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.status,
    CASE
      -- FIX-Task-51: both grace spellings may spend (R6).
      WHEN s.status IN ('trial', 'active', 'paused', 'cancelled', 'canceled', 'grace_period', 'grace') THEN TRUE
      ELSE FALSE
    END AS can_spend_sp,
    CASE
      -- R6: unchanged — grace never earns, so 'grace' is deliberately absent here.
      WHEN s.status IN ('trial', 'active') THEN TRUE
      ELSE FALSE
    END AS can_earn_sp,
    s.trial_end_date,
    s.current_period_end
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC
  LIMIT 1;
END;
$function$;

-- =============================================================================
-- BLOCK 1d — Re-assert the EXECUTE grants (MANDATORY after CREATE OR REPLACE here).
--
--   MEASURED during the FIX-Task-51 apply (before/after via `aclexplode(pg_proc.proacl)`
--   and `has_function_privilege`): replacing these three functions STRIPPED
--   PUBLIC/anon/authenticated EXECUTE, leaving only postgres+service_role — while
--   untouched sibling functions (get_subscription_status, get_user_sp_wallet_summary,
--   fn_item_effective_sp_cap, fn_reserve_sp_on_offer) still carry the permissive
--   baseline. That is a client-visible regression, because `get_subscription_summary`
--   is called from `src/contexts/AuthContext.tsx` / `src/services/auth.ts` with the
--   user's JWT (role `authenticated`) on every session refresh.
--
--   Do NOT remove these GRANTs. If the platform-wide decision is to stop granting
--   PUBLIC EXECUTE (BP-78/BP-79), that is a separate security task covering EVERY
--   function — not a silent side effect of a vocabulary fix.
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.can_user_spend_sp(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_sp_entitlement(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_subscription_summary(uuid) TO PUBLIC, anon, authenticated, service_role;

-- =============================================================================
-- BLOCK 2 — Verification (run ONE statement at a time; the MCP tools return only
--           the last result set).
-- =============================================================================
--
-- 1) All three bodies are the R6+tolerant versions (expect 'grace_period', 'grace' in each):
--    SELECT proname, prosrc FROM pg_proc
--    WHERE proname IN ('can_user_spend_sp','fn_get_sp_entitlement','get_subscription_summary');
--
-- 1b) The client-facing flag agrees with the EF gate for the grace persona:
--    SELECT * FROM public.get_subscription_summary('a1234567-0000-0000-0000-000000000011');
--    -- expected: status='grace', can_spend_sp=true, can_earn_sp=false
--
-- 2) The grace persona is now spendable / still non-earning:
--    SELECT * FROM public.fn_get_sp_entitlement('a1234567-0000-0000-0000-000000000011');
--    -- expected: can_earn_sp=false, can_spend_sp=true, wallet_state='grace_period',
--    --           subscription_status='grace'
--
-- 3) Branch coverage (real invocation of every branch this migration changed):
--    -- grace (either spelling) + wallet active/grace_period        -> can_spend_sp = true
--    -- free / expired status                                     -> can_spend_sp = false
--    -- frozen or suspended wallet                                -> can_spend_sp = false
--    SELECT s.status, w.state, e.can_earn_sp, e.can_spend_sp
--    FROM public.subscriptions s
--    LEFT JOIN public.sp_wallets w ON w.user_id = s.user_id
--    LEFT JOIN LATERAL public.fn_get_sp_entitlement(s.user_id) e ON true
--    WHERE s.user_id IN (
--      'a1234567-0000-0000-0000-000000000011',  -- test-grace  (status 'grace')
--      'a1234567-0000-0000-0000-000000000012',  -- test-expired
--      'a1234567-0000-0000-0000-000000000001'   -- test-buyer  (active)
--    );
--
-- 4) ACLs unchanged (BP-78: verify via the LIVE catalog, not a migration grep):
--    SELECT p.proname, a.grantee::regrole::text AS grantee, a.privilege_type
--    FROM pg_proc p, aclexplode(p.proacl) a
--    WHERE p.proname IN ('can_user_spend_sp','fn_get_sp_entitlement','get_subscription_summary');
