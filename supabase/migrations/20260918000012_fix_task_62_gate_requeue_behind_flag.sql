-- ============================================================================
-- FIX-Task-62 (D2) — gate the self-heal sweep behind an explicit admin flag
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B)
-- Classification: A (migration / RPC) + F (money) → Tier 2
-- ============================================================================
-- WHY (owner decision D2, 2026-09-18)
--   Fix A's pass 2 dispatches REAL money. Its first live run correctly paid 6
--   long-parked payouts — but the same seller had ALREADY been paid the same
--   $205.00 via an aggregate manual payout (tr_1UChi74I6kCJlvXoCmZ5YSdS, completed
--   2026-09-06), so the run double-paid in test mode. See
--   e2e-test-results/fix-task-62-2026-09-18/report.md §12.
--
--   The mechanism (re-evaluate a parked payout when its blocker clears) is correct
--   and proven; what is not yet defined is the precondition that the proceeds have
--   NOT already been settled another way. Until that rule is agreed, pass 2 must be
--   FAIL-CLOSED: the code stays deployed, but it does nothing.
--
-- WHAT
--   * Seeds `admin_config.payout_requeue_enabled` = '0' (Mode B, ON CONFLICT DO NOTHING,
--     so an operator's later choice is never overwritten).
--   * Wraps pass 2 in `fn_admin_config_int('payout_requeue_enabled', 0) = 1` and
--     RAISEs a NOTICE with the number of rows left parked while it is off.
--   * Pass 1 is untouched. When the flag is OFF the function behaves exactly as it did
--     before FIX-Task-62 for pass 1, and returns an empty requeue set.
--
-- ROLLBACK
--   Re-apply the FIX-Task-62 body without the gate, or simply set the flag:
--     SELECT * FROM public.upsert_admin_config_setting(
--       p_key => 'payout_requeue_enabled', p_value => '1', p_category => 'feature_flags',
--       p_data_type => 'number', p_is_secret => false, p_is_active => true,
--       p_admin_id => '<admin user id>');   -- BP-48: shared RPC, never a raw table write
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seed the kill switch (fail-closed). Never clobber an operator's value.
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_config (key, value, category, data_type, is_active)
VALUES ('payout_requeue_enabled', '0', 'feature_flags', 'number', TRUE)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Re-create the function with pass 2 gated.
-- ---------------------------------------------------------------------------
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
  v_requeue_ids    uuid[] := ARRAY[]::uuid[];
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
  -- FAIL-CLOSED kill switch (D2). Dispatches real money ⇒ OFF until the
  -- "proceeds not already settled" precondition is agreed (report §12.4).
  IF COALESCE(public.fn_admin_config_int('payout_requeue_enabled', 0), 0) = 1 THEN

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

    -- Descriptive backfill only (no status, amount or balance change).
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

  ELSE
    RAISE NOTICE 'rpc_release_due_payouts: pass 2 DISABLED (payout_requeue_enabled=0); % requires_action trade(s) left parked — see FIX-Task-62 report §12',
      (SELECT count(*) FROM public.trades t
        WHERE t.status = 'completed'
          AND t.payout_status = 'requires_action'
          AND COALESCE(t.payout_amount_cents, 0) > 0);
  END IF;

  RETURN jsonb_build_object(
    'success',            true,
    'released_count',     v_released_count,
    'requeued_count',     v_requeued_count,
    'trade_ids',          COALESCE(v_trade_ids, ARRAY[]::uuid[]) || v_requeue_ids,
    'requeued_trade_ids', v_requeue_ids,
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
-- VERIFICATION QUERIES (one statement per call)
-- ============================================================================
-- V1 — the switch exists and is OFF (expect value '0'):
--   SELECT key, value, is_active FROM public.admin_config WHERE key = 'payout_requeue_enabled';
-- V2 — the gate is in the live body (expect true):
--   SELECT prosrc LIKE '%payout_requeue_enabled%' FROM pg_proc
--   WHERE oid = 'public.rpc_release_due_payouts(integer)'::regprocedure;
-- V3 — grants still service_role-only (BP-79):
--   SELECT array_to_string(proacl, ' | ') FROM pg_proc
--   WHERE oid = 'public.rpc_release_due_payouts(integer)'::regprocedure;
-- NOTE: do NOT invoke this function by hand to "check" it. Pass 1 moves
-- seller_balance pending → available WITHOUT dispatching, so a manual call would
-- make the next Edge-Function run credit those trades twice. Gate behaviour is
-- proven in the local harness instead (local-harness/10-tests.sql T11/T12).
-- ============================================================================
