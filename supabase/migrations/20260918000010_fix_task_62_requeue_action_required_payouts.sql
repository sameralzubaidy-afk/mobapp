-- ============================================================================
-- FIX-Task-62 — un-strand `requires_action` payouts (Fix A + Fix E)
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B)
-- Classification: A (migration / RPC / trigger) + F (money & state machine)
--                 → Tier 2 required.
-- ============================================================================
-- WHY
--   `requires_action` is written ONCE by create_seller_payout_on_trade_completion()
--   (auto-payout ON + seller has no primary+verified method) and NO writer anywhere
--   cleared it: a whole-database census of function bodies finds exactly one
--   function referencing the state, and it is that creator. rpc_release_due_payouts
--   excluded the state behind a comment claiming it was "handled by its own
--   notification flow" — a flow that was never built. Consequence: 88 parked
--   payouts / $3,801.90 across 15 sellers, growing monotonically, including 6 rows
--   whose seller has been payable for ~10 weeks.
--   Evidence: e2e-test-results/fix-task-62-2026-09-18/report.md
--
-- WHAT
--   Fix A — rpc_release_due_payouts gains a SECOND selection pass: trades still in
--           `requires_action` whose seller NOW has a primary+verified method and
--           whose release date has passed are returned for dispatch. The existing
--           hourly `release-due-payouts` Edge Function already POSTs every id in
--           `trade_ids` to `initiate-payout`, so no new cron and no new function.
--   Fix E — a BEFORE DELETE trigger on `trades` terminalises payouts that a trade
--           deletion would otherwise orphan (seller_payouts.trade_id is
--           ON DELETE SET NULL ⇒ permanently unreachable), plus a backfill for the
--           rows already orphaned that way.
--
-- DESIGN NOTES — each one is a live-measured trap; do NOT "simplify" them away
--   1. Pass 2 must NOT set trades.payout_status = 'processing'. initiate-payout
--      returns early on that value (index.ts "already_processing") and the transfer
--      would never be created.
--   2. Pass 2 must NOT set trades.payout_status = 'pending' either. Pass 1 selects
--      on 'pending' and CREDITS seller_balance, so flipping the value would
--      double-credit the seller on the next hourly run. Leaving the state as
--      'requires_action' keeps pass 1 completely untouched — making that state
--      payable is Fix B's job in `initiate-payout`. Fix A and Fix B ship together.
--   3. Pass 2 is BALANCE-NEUTRAL by design. The completion trigger already credited
--      these trades, and the per-seller bucket varies (some sellers hold
--      available = 0 AND pending = 0 while their payouts are parked). Reconciling
--      seller_balance is a separate, deliberately out-of-scope task.
--   4. Pass 2 does NOT recompute payout_fee_cents / net_amount_cents. The creator
--      wrote fee = 0, net = gross, and initiate-payout transfers
--      trades.payout_amount_cents (gross) — so fee = 0 / net = gross is what
--      actually happens. Recomputing a fee here would MISSTATE the row, not fix it.
--      Only the descriptive columns (payout_method_id, provider, both NULL today)
--      are backfilled.
--   5. Re-payment safety: initiate-payout is idempotent (Stripe idempotency key
--      `payout-<trade_id>` + its payout_status guard), so a pass that runs again
--      before the dispatch lands cannot double-pay.
--   6. The orphan backfill is deliberately narrowed to `status = 'requires_action'`.
--      A trade-less row in 'processing' is a legitimate MANUAL withdrawal that
--      `dispatch-manual-payouts` sweeps for (7 such rows exist live) — marking
--      those failed would break manual payouts. Likewise the delete trigger skips
--      'processing' (the schema defines it as "submitted to provider") and any row
--      that already carries a provider reference, because a transferred payout is
--      real money and must stay auditable.
--   7. Grants are RE-ASSERTED after CREATE OR REPLACE (BP-79): the
--      dt61_guard_revoke_fn_public event trigger strips PUBLIC/anon/authenticated
--      EXECUTE on any replaced public function and the original GRANTs are not
--      replayed.
-- ============================================================================

-- ============================================================================
-- Fix A — pass 2 in rpc_release_due_payouts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_release_due_payouts(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_count integer := 0;
  v_requeued_count integer := 0;
  v_trade_ids      uuid[];
  v_requeue_ids    uuid[];
  v_rec            record;
BEGIN
  -- ── PASS 1 (unchanged): due `pending` payouts — release pending → available ──
  v_trade_ids := ARRAY(
    SELECT t.id
    FROM public.trades t
    WHERE t.status = 'completed'
      AND t.dispute_status IS DISTINCT FROM 'reported'
      AND t.dispute_status IS DISTINCT FROM 'under_review'
      AND t.payout_status = 'pending'
      AND COALESCE(t.payout_release_at, t.completed_at) <= now()
      AND COALESCE(t.payout_amount_cents, 0) > 0
    ORDER BY t.payout_release_at ASC NULLS FIRST
    LIMIT p_batch_size
  );

  -- Move seller_balance pending → available for each due trade (the release
  -- moment). Uses the same gross cash basis the completion trigger credited.
  -- NOTE: this loop must only ever see PASS 1 ids — see DESIGN NOTES 2 and 3.
  FOR v_rec IN
    SELECT t.id, t.seller_id, COALESCE(t.cash_amount_cents, 0) AS proceeds_cents
    FROM public.trades t
    WHERE t.id = ANY(v_trade_ids)
  LOOP
    UPDATE public.seller_balance sb
    SET available_balance_cents = sb.available_balance_cents + v_rec.proceeds_cents,
        pending_balance_cents = GREATEST(0, sb.pending_balance_cents - v_rec.proceeds_cents),
        updated_at = now()
    WHERE sb.user_id = v_rec.seller_id;

    v_released_count := v_released_count + 1;
  END LOOP;

  -- ── PASS 2 (FIX-Task-62 Fix A): self-heal stranded `requires_action` rows ──
  -- A parked payout stops being correct the moment its seller becomes payable.
  -- This pass re-derives that eligibility every hour; it writes no status and no
  -- balance, and lets the existing dispatch loop do the paying (DESIGN NOTES 1-4).
  v_requeue_ids := ARRAY(
    SELECT t.id
    FROM public.trades t
    WHERE t.status = 'completed'
      AND t.dispute_status IS DISTINCT FROM 'reported'
      AND t.dispute_status IS DISTINCT FROM 'under_review'
      AND t.payout_status = 'requires_action'
      AND COALESCE(t.payout_release_at, t.completed_at) <= now()
      AND COALESCE(t.payout_amount_cents, 0) > 0
      AND EXISTS (
        SELECT 1
        FROM public.seller_payout_methods m
        WHERE m.user_id = t.seller_id
          AND m.is_primary = TRUE
          AND m.is_verified = TRUE
      )
    ORDER BY t.payout_release_at ASC NULLS FIRST
    LIMIT p_batch_size
  );

  v_requeued_count := COALESCE(array_length(v_requeue_ids, 1), 0);

  -- Descriptive backfill only (DESIGN NOTE 4): record which method now pays these
  -- rows. No status / amount / balance change.
  IF v_requeued_count > 0 THEN
    UPDATE public.seller_payouts sp
    SET payout_method_id = m.id,
        provider         = CASE m.method_type
                             WHEN 'stripe_connect' THEN 'stripe'
                             WHEN 'paypal'         THEN 'paypal'
                             WHEN 'venmo'          THEN 'paypal'
                             WHEN 'bank_ach'       THEN 'ach'
                           END,
        updated_at       = now()
    FROM public.trades t
    JOIN public.seller_payout_methods m
      ON m.user_id = t.seller_id
     AND m.is_primary = TRUE
     AND m.is_verified = TRUE
    WHERE t.id = ANY(v_requeue_ids)
      AND sp.trade_id = t.id
      AND sp.status = 'requires_action';
  END IF;

  -- `trade_ids` carries BOTH populations so the existing Edge Function dispatches
  -- them without change; the two counts stay separately auditable. COALESCE guards
  -- an empty (or NULL) pass from nulling the whole array and silently stopping
  -- pass 1 dispatch.
  RETURN jsonb_build_object(
    'success',            true,
    'released_count',     v_released_count,
    'requeued_count',     v_requeued_count,
    'trade_ids',          COALESCE(v_trade_ids, ARRAY[]::uuid[]) || COALESCE(v_requeue_ids, ARRAY[]::uuid[]),
    'requeued_trade_ids', COALESCE(v_requeue_ids, ARRAY[]::uuid[]),
    'processed_at',       now()
  );
END;
$$;

-- BP-79 — re-assert the grants stripped by the CREATE OR REPLACE above.
REVOKE ALL ON FUNCTION public.rpc_release_due_payouts(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_release_due_payouts(integer) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_release_due_payouts(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_release_due_payouts(integer) TO service_role;

-- ============================================================================
-- Fix E — never orphan a payout again: terminalise on trade delete
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_terminalize_payouts_on_trade_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- seller_payouts.trade_id is `ON DELETE SET NULL`, so a deleted trade leaves its
  -- payout row permanently unreachable by every trade-keyed path (release,
  -- requeue, initiate-payout). Record an honest terminal state instead.
  -- Deliberately scoped: only states that mean "never submitted to a provider";
  -- 'processing' means submitted, and a row that already carries a provider
  -- reference is real money that must stay auditable (DESIGN NOTE 6).
  UPDATE public.seller_payouts sp
  SET status         = 'failed',
      failure_reason = COALESCE(sp.failure_reason, 'trade_deleted'),
      updated_at     = now()
  WHERE sp.trade_id = OLD.id
    AND sp.status IN ('requires_action', 'pending')
    AND sp.provider_reference_id IS NULL;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_terminalize_payouts_on_trade_delete ON public.trades;
CREATE TRIGGER trg_terminalize_payouts_on_trade_delete
  BEFORE DELETE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_terminalize_payouts_on_trade_delete();

-- BP-79 — the trigger function needs no client EXECUTE at all.
REVOKE ALL ON FUNCTION public.fn_terminalize_payouts_on_trade_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_terminalize_payouts_on_trade_delete() FROM anon;
REVOKE ALL ON FUNCTION public.fn_terminalize_payouts_on_trade_delete() FROM authenticated;

-- ============================================================================
-- Fix E (backfill) — rows ALREADY orphaned: 4 real rows + 1 fixture residue
-- ============================================================================
-- Narrowed to 'requires_action' on purpose (DESIGN NOTE 6): a trade-less
-- 'processing' row is a legitimate manual withdrawal awaiting
-- `dispatch-manual-payouts`, and a 'requires_action' row can never be dispatched
-- by that path (its predicate requires status='processing').
UPDATE public.seller_payouts sp
SET status         = 'failed',
    failure_reason = COALESCE(sp.failure_reason, 'trade_deleted'),
    updated_at     = now()
WHERE sp.trade_id IS NULL
  AND sp.status = 'requires_action'
  AND sp.provider_reference_id IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES (run one statement at a time — result-granularity rule)
-- ============================================================================
-- V1 — the function still exists with the two-pass body:
--   SELECT pg_get_functiondef('public.rpc_release_due_payouts(integer)'::regprocedure);
-- V2 — grants survived (expect postgres + service_role ONLY, no PUBLIC/anon/authenticated):
--   SELECT coalesce(array_to_string(proacl, ' | '), '(null = default PUBLIC EXECUTE)')
--   FROM pg_proc WHERE oid = 'public.rpc_release_due_payouts(integer)'::regprocedure;
-- V3 — the delete trigger is attached and enabled:
--   SELECT tgname, tgenabled FROM pg_trigger
--   WHERE tgrelid = 'public.trades'::regclass
--     AND tgname = 'trg_terminalize_payouts_on_trade_delete';
-- V4 — pass 2's eligible set (EXPECT the currently-recoverable rows; 0 after dispatch):
--   SELECT count(*) FROM public.trades t
--   WHERE t.status = 'completed' AND t.payout_status = 'requires_action'
--     AND COALESCE(t.payout_release_at, t.completed_at) <= now()
--     AND COALESCE(t.payout_amount_cents, 0) > 0
--     AND EXISTS (SELECT 1 FROM public.seller_payout_methods m
--                 WHERE m.user_id = t.seller_id AND m.is_primary AND m.is_verified);
-- V5 — no orphan was left parked (expect 0):
--   SELECT count(*) FROM public.seller_payouts
--   WHERE trade_id IS NULL AND status = 'requires_action';
-- V6 — balance must be UNCHANGED by pass 2 (compare before/after a manual run).
-- ============================================================================
