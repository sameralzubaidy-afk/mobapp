-- File: supabase/migrations/20260829000002_dev_task_39_fix_auto_complete_payout.sql
-- Mode B: Idempotent rerunnable migration
--
-- DEV-TASK-39 (P1, 2026-08-28) — Auto-completed trades never create a
-- `seller_payouts` row; the release-due-payouts cron never picks them up.
--
-- ROOT CAUSE (verified live on staging drntwgporzabmxdqykrp):
--   rpc_process_auto_complete only flipped status -> 'completed'. Manual
--   completion (complete_trade_v2) additionally:
--     1) marks items.status = 'sold'
--     2) sets trades.payout_amount_cents = max(0, cash_amount_cents -
--        seller_transaction_fee_cents)
--     3) calls create_seller_payout_on_trade_completion(...) -> inserts the
--        seller_payouts row and sets trades.payout_status / payout_release_at /
--        payout_idempotency_key
--   Without those, the hourly release-due-payouts cron filter
--   (rpc_release_due_payouts: payout_status='pending' AND
--   COALESCE(payout_amount_cents,0) > 0) never matches an auto-completed trade
--   (both NULL), so seller cash proceeds sit only in seller_balance with no
--   payout trail. In an env with buffer 0, initiate-payout's Path B would
--   create a payout row with payout_amount_cents ?? 0 = 0 (a $0 payout).
--
-- FIX: rewrite rpc_process_auto_complete to mirror complete_trade_v2's
--   completion side-effects synchronously per trade (mark sold -> set
--   payout_amount_cents -> create the seller_payouts row via the SAME
--   idempotent function manual completion uses). This is environment-
--   independent (does not depend on the async trigger's net.http_post config)
--   and idempotent (create_seller_payout_on_trade_completion returns the
--   existing row if the idempotency key already exists).
--
-- SAFETY: the payout-side work is wrapped so a payout-creation error can NEVER
--   block the trade from completing (BP-4 — logged to debug_logs + warning).
--
-- Change classification: A (DB/migration/RPC) + F (money). Tier 0 + Tier 1
--   (real fast-clock auto-complete) + Tier 2 (DB rebuild) required.

-- ============================================================================
-- BLOCK 1: rpc_process_auto_complete — completion side-effects for auto-complete
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_process_auto_complete(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
  v_trade RECORD;
  v_net_cash_cents integer;
  v_payout_result jsonb;
BEGIN
  -- Same eligibility guards as the pre-fix version (incl. R15 D2: skip trades
  -- with a pending extension request; skip unresolved disputes). FOR UPDATE
  -- SKIP LOCKED makes concurrent cron invocations safe (each trade processed
  -- exactly once; rows locked by a concurrent run are skipped).
  FOR v_trade IN
    SELECT t.id, t.seller_id, t.listing_id, t.cash_amount_cents, t.seller_transaction_fee_cents
    FROM public.trades t
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at <= now()
      AND (t.extension_status IS DISTINCT FROM 'requested')
      AND (
        t.disputed_at IS NULL
        OR t.dispute_resolution IS NOT NULL
      )
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Flip to completed (last_status_change_at keeps the notification trigger
    -- honest; the SP-release trigger fires on this status change as before).
    UPDATE public.trades t
    SET status = 'completed',
        completed_at = COALESCE(t.completed_at, now()),
        updated_at = now(),
        last_status_change_at = now()
    WHERE t.id = v_trade.id;

    v_updated_count := v_updated_count + 1;

    -- DT-39: mirror complete_trade_v2's completion side-effects.
    -- 1) Mark the listing sold (idempotent no-op if already sold).
    UPDATE public.items i SET status = 'sold', updated_at = now() WHERE i.id = v_trade.listing_id;

    -- 2) Persist the payout amount (net of seller fee) so the release cron's
    --    COALESCE(payout_amount_cents,0) > 0 filter matches. Same formula as
    --    complete_trade_v2: GREATEST(0, cash_amount_cents - seller_transaction_fee_cents).
    v_net_cash_cents := GREATEST(0,
      COALESCE(v_trade.cash_amount_cents, 0) - COALESCE(v_trade.seller_transaction_fee_cents, 0));

    UPDATE public.trades t
    SET payout_amount_cents = v_net_cash_cents,
        updated_at = now()
    WHERE t.id = v_trade.id;

    -- 3) Create the seller_payouts row with the SAME call manual completion
    --    uses. Idempotent: returns the existing row if already created (e.g.
    --    a re-run, or an async trigger/EF that got there first). A payout
    --    error is caught + logged and NEVER blocks auto-completion.
    BEGIN
      IF v_net_cash_cents > 0 THEN
        SELECT public.create_seller_payout_on_trade_completion(
          v_trade.id,
          v_trade.seller_id,
          v_net_cash_cents
        ) INTO v_payout_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      IF to_regclass('public.debug_logs') IS NOT NULL THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'rpc_process_auto_complete',
          'payout creation failed for trade ' || v_trade.id::text || ': ' || SQLERRM,
          jsonb_build_object('trade_id', v_trade.id::text, 'net_cash_cents', v_net_cash_cents)
        );
      END IF;
      RAISE WARNING 'rpc_process_auto_complete: payout creation failed for trade %: %', v_trade.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'auto_completed_count', v_updated_count,
    'processed_at', now()
  );
END;
$$;

-- Preserve the original grant (service_role — cron/EF invocation).
GRANT EXECUTE ON FUNCTION public.rpc_process_auto_complete(integer) TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES (run one statement at a time)
-- ============================================================================
-- 1) Deployed body now contains payout logic:
--    SELECT proname, (prosrc LIKE '%create_seller_payout_on_trade_completion%') AS has_payout
--    FROM pg_proc WHERE proname = 'rpc_process_auto_complete';
--
-- 2) Function still granted to service_role:
--    SELECT has_function_privilege('service_role', 'public.rpc_process_auto_complete(integer)', 'EXECUTE');
--
-- 3) Tier-1 fast-clock verify (a test in_progress trade):
--    UPDATE trades SET auto_complete_at = now() + interval '5 seconds' WHERE id = '<trade-uuid>';
--    SELECT public.rpc_process_auto_complete(10);
--    -- then confirm the seller_payouts row + trades.payout_amount_cents / items.status
--
-- Common failure modes:
--   - create_seller_payout_on_trade_completion throws (e.g. config) -> caught,
--     logged to debug_logs, auto-complete still commits (by design).
--   - Duplicate row impossible: the payout function is idempotent by
--     idempotency_key ('trade:<id>:seller:<seller>').
--   - Ambiguous columns: all columns are qualified with table aliases (t./i.).
