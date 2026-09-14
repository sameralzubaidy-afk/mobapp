-- File: supabase/migrations/20260914000001_fix_task_32_void_uncaptured_payment.sql
--
-- FIX-Task-32 item 3 (2026-09-14) — the partial-refund path booked UNCAPTURED
-- money as a refund, then routed the tax leg to a refund RPC that refuses a
-- `quoted` record and stamps `reconciliation_status='needs_review'` on it.
--
-- WHY (QA Task — TRD Closing O2-C12, 2026-09-13):
--   `trade-refund` gets the Stripe half RIGHT: when the PI is still an
--   uncaptured authorization hold (`requires_capture` / `processing`) it CANCELS
--   the hold (`stripe.paymentIntents.cancel`, `stripeAction='cancelled_uncaptured'`)
--   instead of capture-then-refund. But its ledger leg then calls
--   `rpc_record_payment_refund` UNCONDITIONALLY:
--     * `payments.refunded_*` are incremented and `derived_state` becomes
--       'partially_refunded' for money that was NEVER charged; and
--     * `rpc_record_payment_refund` forwards the tax leg to
--       `rpc_record_stripe_refund`, which refuses a `quoted` row but still stamps
--       `stripe_refund_id='cancelled_<pi>'`, `refunded_at` and
--       `reconciliation_status='needs_review'` — the tax record is left `quoted`
--       forever and a spurious reconciliation row is raised.
--
--   The correct discriminator already ships in this repo: `admin-trade-action`
--   and `resolve-dispute` branch on the `cancelled_` prefix of the Stripe refund
--   id and call `rpc_void_tax_for_trade` instead of a refund RPC. `trade-refund`
--   was the one writer missing it.
--
-- FIX (owner decision 2026-09-13 — "void the uncaptured portion"):
--   BLOCK 1 adds `rpc_void_uncaptured_payment(p_trade_id, p_reason)` — the
--   atomic, sanctioned replacement for the wrong ledger leg. It voids the trade's
--   tax record via `rpc_void_tax_for_trade` (the SAME lifecycle RPC every other
--   cancellation writer uses) and marks the `payments` row `cancelled` WITHOUT
--   touching `refunded_*` (no money moved, so nothing may be booked as refunded).
--   Multi-table mutation -> one RPC (HP-5), never scattered EF updates.
--
--   BLOCK 2 re-asserts `rpc_record_payment_refund` with ONE addition — a
--   fail-closed defense-in-depth guard: a Stripe PI CANCELLATION
--   (`p_stripe_refund_id` beginning `cancelled_`) is never a refund, so the RPC
--   now refuses it (`REFUND_ON_CANCELLED_PI`). That makes the bug class
--   impossible to re-introduce from ANY future caller. Every other predicate in
--   the body is preserved verbatim (BP-90: re-assert what you did NOT intend to
--   change, and invoke the patched object immediately afterwards).
--
-- NOTE on the guard's key: it deliberately keys on the `cancelled_` prefix, NOT
--   on `payments.captured_at`. Per the FIX-Task-24 COMMENT on
--   `payments.derived_state`, `captured_at` is a TRADE-MIRROR (set when the trade
--   is in_progress/completed by `fn_payments_sync_from_trade`) and is NOT proof
--   the Stripe PI was captured — it reads `captured` while the real PI is still
--   an uncaptured hold (QA R100).
--
-- Mode B — idempotent rerunnable (CREATE OR REPLACE + explicit grant re-assertion).
--
-- BLOCK 1: rpc_void_uncaptured_payment (new) + grants
-- BLOCK 2: rpc_record_payment_refund (guard added) + grants
-- BLOCK 3: verification queries (run ONE statement at a time — execute_sql
--          returns only the LAST statement's result set)

BEGIN;

-- =============================================================================
-- BLOCK 1 — rpc_void_uncaptured_payment
--
-- Void the tax leg + mark the payment row cancelled for a payment whose Stripe
-- authorization hold was CANCELLED (never captured). Writes NO refund totals.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_void_uncaptured_payment(
  p_trade_id UUID,
  p_reason   TEXT DEFAULT 'uncaptured_void'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tax_result    JSONB;
  v_payment       public.payments%ROWTYPE;
  v_payments_rows INTEGER := 0;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id is required')
    );
  END IF;

  -- ── Tax leg ───────────────────────────────────────────────────────────────
  -- The sanctioned lifecycle RPC. Safe on a trade with no tax record (returns
  -- noop) and on an already-voided record (returns INVALID_STATE, which we
  -- surface but do not fail on — the record is already in the wanted state).
  v_tax_result := public.rpc_void_tax_for_trade(p_trade_id, p_reason);

  -- ── Payment leg ───────────────────────────────────────────────────────────
  -- Mirror the cancellation onto the payments row. `refunded_*` and
  -- `refunded_at` are deliberately NOT touched: no money moved, so booking a
  -- refund here is exactly the defect this migration removes.
  UPDATE public.payments p
  SET derived_state = 'cancelled',
      updated_at    = now()
  WHERE p.trade_id = p_trade_id
    AND p.derived_state <> 'cancelled';

  GET DIAGNOSTICS v_payments_rows = ROW_COUNT;

  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.trade_id = p_trade_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'voided_uncaptured',
    'trade_id', p_trade_id,
    'tax_result', v_tax_result,
    'payments_rows_updated', v_payments_rows,
    'refunded_cents', COALESCE(v_payment.refunded_cents, 0),
    'derived_state', v_payment.derived_state
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'VOID_UNCAPTURED_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_void_uncaptured_payment(UUID, TEXT) IS
'FIX-Task-32 item 3: voids the tax record (via rpc_void_tax_for_trade) and marks payments.derived_state=''cancelled'' for a payment whose Stripe authorization hold was CANCELLED rather than captured. Writes NO refunded_* totals. Atomic replacement for the wrong rpc_record_payment_refund call on the cancelled_uncaptured path.';

-- BP-78: explicit minimal grants (never leave PUBLIC/anon/authenticated executable).
REVOKE EXECUTE ON FUNCTION public.rpc_void_uncaptured_payment(UUID, TEXT) FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_void_uncaptured_payment(UUID, TEXT) TO service_role;

-- =============================================================================
-- BLOCK 2 — rpc_record_payment_refund: fail-closed guard on a cancelled PI
--
-- Body otherwise IDENTICAL to 20260912000009_fix_task_24_payments_derived_state.sql
-- (BLOCK 1 cont, L185-321). The ONLY addition is the guard block immediately
-- after the INVALID_INPUT check, marked FIX-Task-32.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_record_payment_refund(
  p_trade_id UUID,
  p_stripe_refund_id TEXT,
  p_refund_price_cents INTEGER DEFAULT 0,
  p_refund_fee_cents INTEGER DEFAULT 0,
  p_refund_tax_cents INTEGER DEFAULT 0,
  p_reason TEXT DEFAULT NULL,
  p_initiating_actor TEXT DEFAULT 'admin',
  p_refund_status TEXT DEFAULT 'succeeded'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_total INTEGER;
  v_new_refunded_cents INTEGER;
  v_new_price INTEGER;
  v_new_fee INTEGER;
  v_new_tax INTEGER;
  v_new_derived_state TEXT;
  v_tax_remaining INTEGER;
  v_tax_result JSONB;
  v_trade_exists BOOLEAN;
BEGIN
  v_total := COALESCE(p_refund_price_cents, 0) + COALESCE(p_refund_fee_cents, 0) + COALESCE(p_refund_tax_cents, 0);
  IF v_total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
      'message', 'Refund amount must be greater than zero');
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- FIX-Task-32 item 3 (defense-in-depth): a Stripe PI CANCELLATION is never a
  -- refund. The `cancelled_<pi>` id shape is the repo-wide discriminator used by
  -- admin-trade-action / resolve-dispute to mean "the hold was voided, not
  -- captured" — callers on that path must void (rpc_void_uncaptured_payment /
  -- rpc_void_tax_for_trade), never record a refund for money that never moved.
  -- Fail CLOSED so the bug class cannot be re-introduced from any future caller.
  -- ─────────────────────────────────────────────────────────────────────────
  IF p_stripe_refund_id IS NOT NULL AND starts_with(p_stripe_refund_id, 'cancelled_') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'REFUND_ON_CANCELLED_PI',
      'message', 'This payment intent was cancelled (never captured) — void it instead of recording a refund'
    );
  END IF;

  -- Ensure a payments row exists (should be created by trigger; create on the fly if not)
  SELECT * INTO v_payment FROM public.payments p WHERE p.trade_id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.payments (trade_id, buyer_id, seller_id)
    SELECT t.id, t.buyer_id, t.seller_id
    FROM public.trades t WHERE t.id = p_trade_id
    ON CONFLICT (trade_id) DO NOTHING;
    SELECT * INTO v_payment FROM public.payments p WHERE p.trade_id = p_trade_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'TRADE_NOT_FOUND',
        'message', 'Trade or payment record not found');
    END IF;
  END IF;

  -- Per-component remaining validation (HP-4)
  IF p_refund_price_cents > (v_payment.item_price_cents - v_payment.refunded_price_cents) THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_EXCEEDS_PRICE',
      'message', 'Refund price exceeds remaining item price');
  END IF;
  IF p_refund_fee_cents > (v_payment.platform_fee_cents - v_payment.refunded_fee_cents) THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_EXCEEDS_FEE',
      'message', 'Refund fee exceeds remaining platform fee');
  END IF;
  IF p_refund_tax_cents > (v_payment.tax_amount_cents - v_payment.refunded_tax_cents) THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_EXCEEDS_TAX',
      'message', 'Refund tax exceeds remaining sales tax');
  END IF;
  IF v_payment.refunded_cents + v_total > v_payment.total_charged_cents THEN
    RETURN jsonb_build_object('success', false, 'code', 'REFUND_EXCEEDS_TOTAL',
      'message', 'Refund exceeds total charged');
  END IF;

  -- Insert refund line item
  INSERT INTO public.trade_refunds (
    trade_id, payment_id, stripe_refund_id,
    refund_amount_cents, refund_price_cents, refund_fee_cents, refund_tax_cents,
    reason, initiating_actor, status
  ) VALUES (
    p_trade_id, v_payment.id, p_stripe_refund_id,
    v_total, COALESCE(p_refund_price_cents,0), COALESCE(p_refund_fee_cents,0), COALESCE(p_refund_tax_cents,0),
    p_reason, p_initiating_actor,
    CASE WHEN p_refund_status IN ('succeeded') THEN 'succeeded'
         WHEN p_refund_status IN ('pending','processing') THEN 'pending'
         WHEN p_refund_status IN ('failed','canceled','cancelled') THEN 'failed'
         ELSE 'succeeded' END
  );

  -- Update payment refunded totals + derived state
  v_new_price := v_payment.refunded_price_cents + COALESCE(p_refund_price_cents, 0);
  v_new_fee   := v_payment.refunded_fee_cents   + COALESCE(p_refund_fee_cents, 0);
  v_new_tax   := v_payment.refunded_tax_cents   + COALESCE(p_refund_tax_cents, 0);
  v_new_refunded_cents := v_new_price + v_new_fee + v_new_tax;

  IF v_new_refunded_cents >= v_payment.total_charged_cents AND v_payment.total_charged_cents > 0 THEN
    v_new_derived_state := 'refunded';
  ELSIF v_new_refunded_cents > 0 THEN
    v_new_derived_state := 'partially_refunded';
  ELSE
    v_new_derived_state := v_payment.derived_state;
  END IF;

  UPDATE public.payments p SET
    refunded_cents = v_new_refunded_cents,
    refunded_price_cents = v_new_price,
    refunded_fee_cents = v_new_fee,
    refunded_tax_cents = v_new_tax,
    stripe_refund_id = COALESCE(p.stripe_refund_id, p_stripe_refund_id),
    derived_state = v_new_derived_state,
    refunded_at = CASE WHEN v_new_refunded_cents > 0 THEN now() ELSE p.refunded_at END,
    updated_at = now()
  WHERE p.id = v_payment.id;

  -- Sync latest refund id onto the trade (history preserved in trade_refunds)
  IF p_stripe_refund_id IS NOT NULL THEN
    UPDATE public.trades t SET stripe_refund_id = p_stripe_refund_id, updated_at = now()
    WHERE t.id = p_trade_id;
  END IF;

  -- Proportional tax reversal (BP-32: verify the ledger actually updates)
  IF COALESCE(p_refund_tax_cents, 0) > 0 THEN
    BEGIN
      v_tax_result := public.rpc_record_stripe_refund(
        p_trade_id,
        p_stripe_refund_id,
        COALESCE(p_refund_tax_cents, 0),
        p_refund_status,
        COALESCE(p_reason, 'admin_partial_refund'),
        COALESCE(p_initiating_actor, 'admin')
      );
    EXCEPTION WHEN OTHERS THEN
      v_tax_result := jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  ELSE
    v_tax_result := jsonb_build_object('success', true, 'action', 'noop');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'recorded',
    'refunded_cents', v_new_refunded_cents,
    'remaining_cents', GREATEST(v_payment.total_charged_cents - v_new_refunded_cents, 0),
    'tax_result', v_tax_result
  );
END;
$$;

-- Preserve the existing grant exactly (scope containment — no widening/narrowing here).
GRANT EXECUTE ON FUNCTION public.rpc_record_payment_refund(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT)
  TO service_role, authenticated;

COMMIT;

-- =============================================================================
-- BLOCK 3 — VERIFICATION (run ONE statement at a time)
-- =============================================================================

-- V1. Both functions present, with the expected identities.
-- SELECT p.proname,
--        pg_get_function_identity_arguments(p.oid) AS args,
--        p.prosecdef                               AS security_definer,
--        p.proconfig                               AS config
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('rpc_void_uncaptured_payment', 'rpc_record_payment_refund')
-- ORDER BY p.proname;

-- V2. Grants: the new RPC must be service_role-only (no PUBLIC/anon/authenticated).
-- SELECT p.proname,
--        COALESCE(r.rolname, 'PUBLIC') AS grantee,
--        a.privilege_type
-- FROM pg_proc p
-- CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS a
-- LEFT JOIN pg_roles r ON r.oid = a.grantee
-- WHERE p.proname = 'rpc_void_uncaptured_payment'
-- ORDER BY grantee, a.privilege_type;

-- V3. The guard rejects a cancelled_ id (MUST return success=false /
--     REFUND_ON_CANCELLED_PI) — run against ANY existing trade id:
-- SELECT public.rpc_record_payment_refund(
--   (SELECT t.id FROM public.trades t LIMIT 1),
--   'cancelled_pi_fixture_guard_check',
--   100, 0, 0, 'guard check', 'admin', 'succeeded'
-- );

-- V4. The new RPC is invocable and writes no refund totals (run on a cancelled
--     trade whose tax is still `quoted`, then read the payments row back):
-- SELECT public.rpc_void_uncaptured_payment('<trade-uuid>', 'fix_task_32_verify');
-- SELECT p.trade_id, p.derived_state, p.refunded_cents, p.refunded_tax_cents
-- FROM public.payments p WHERE p.trade_id = '<trade-uuid>';
