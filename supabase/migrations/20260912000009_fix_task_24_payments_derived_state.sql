-- File: supabase/migrations/20260912000009_fix_task_24_payments_derived_state.sql
--
-- FIX-Task-24 item 1 (2026-09-12) — `payments.status` is a DERIVED PROJECTION,
-- not the Stripe PaymentIntent's real state.
--
-- WHY (source of a near-miss false HIGH): `fn_payments_sync_from_trade()` (trigger
-- `trg_payments_sync_from_trade`, AFTER INSERT OR UPDATE ON trades) maps ANY
-- `trades.status = 'in_progress'` row to `payments.status = 'captured'` and stamps
-- `captured_at = now()`. At that moment the Stripe PI is only an *authorization hold*
-- (`requires_capture`) — real capture happens at completion (or auto-complete).
-- QA Task (2026-09-12, Group L) read `payments.status='captured'` + a `captured_at`
-- 97 ms after the accept and nearly filed it as HIGH "early capture". That label is
-- ALSO why O-2 C02/C05's "PI still requires_capture" limb is not DB-checkable today.
--
-- FIX (owner decision 2026-09-12): rename the column to `derived_state` so nobody
-- mistakes a trade-derived projection for Stripe ground truth, and document it.
-- A genuine Stripe-sourced `stripe_status` column was explicitly NOT added (it would
-- need a new sync path across create-trade-offer / transactions-update / complete-trade
-- / trade-refund / process-expired-offers + a webhook, and could itself go stale).
--
-- DEPENDENCY AUDIT (BP: "check dependencies before renaming") — every reader/writer
-- of `payments.status` in the repo, verified by grep before writing this migration:
--   1. `fn_payments_sync_from_trade()`          — writes it  (recreated below)
--   2. `rpc_record_payment_refund()`            — reads+writes it (recreated below)
--   3. `admin_health_summary()`                 — reads `p.status = 'failed'`
--                                                 (recreated below; plpgsql resolves
--                                                  column names at RUN time, so the
--                                                  rename would break it)
--   4. `admin_payments_view`                    — exposes it to the admin API
--                                                 (DROPPED + recreated below: a view
--                                                  survives a column rename but keeps
--                                                  the OLD output name, which would
--                                                  silently preserve the trap)
--   5. `idx_payments_status`                    — index (replaced below)
--   6. `p2p-kids-admin/src/app/api/admin/payments/route.ts` + `app/payments/page.tsx`
--      — app code, updated in the same change (field `status` → `derived_state`).
-- NOT affected (verified): `trade-refund/index.ts` (selects explicit columns, no
-- status), `r4_dispute_cost_accounting` (uses `total_charged_cents` only),
-- `rpc_sync_payment_refund_webhook` (uses `payments%ROWTYPE`, never `.status`),
-- `fn_set_payment_node_id` / n2 / n6 (node_id only). The admin deep link
-- `/payments?status=failed` keeps working — the URL param name is unchanged; only the
-- PostgREST field it maps to changed.
--
-- Mode B — idempotent rerunnable (safe to re-run; `RENAME COLUMN` itself is not
-- idempotent, so it is guarded by a DO block).
--
-- BLOCK 1: column rename + COMMENT + the triggered/RPC readers
-- BLOCK 2: index + admin view
-- BLOCK 3: verification queries (run one statement at a time)

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 — rename the column + document what it actually is
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'derived_state'
  ) THEN
    ALTER TABLE public.payments RENAME COLUMN status TO derived_state;
    RAISE NOTICE 'FIX-Task-24: payments.status renamed to derived_state.';
  ELSE
    RAISE NOTICE 'FIX-Task-24: payments.status already renamed (or derived_state present) — no-op.';
  END IF;
END $$;

-- The inline CHECK created with the column keeps its original auto-generated name
-- after a rename; rename it too so the constraint list stays self-describing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_status_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments RENAME CONSTRAINT payments_status_check TO payments_derived_state_check;
    RAISE NOTICE 'FIX-Task-24: constraint payments_status_check renamed to payments_derived_state_check.';
  ELSE
    RAISE NOTICE 'FIX-Task-24: constraint already renamed (or absent) — no-op.';
  END IF;
END $$;

COMMENT ON COLUMN public.payments.derived_state IS
'DERIVED trade-mirror state — NOT the Stripe PaymentIntent status. Written by the trigger trg_payments_sync_from_trade -> fn_payments_sync_from_trade() from trades.status / refunded totals. NOTE: this reads ''captured'' while the trade is in_progress, when the real Stripe PI is still an uncaptured authorization hold (requires_capture). For the true PI state read Stripe (or payments.stripe_payment_intent_id) — never this column. Renamed from payments.status by FIX-Task-24 (2026-09-12) to remove that interpretation trap.';

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 (cont) — fn_payments_sync_from_trade()
-- Body otherwise identical to 317_payments_reconciliation_and_partial_refunds.sql
-- (L93-171); only the column name changed (status -> derived_state).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_payments_sync_from_trade()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_refunded INTEGER := 0;
  v_status TEXT;
  v_existing_refunded INTEGER;
BEGIN
  v_total := COALESCE(NEW.cash_amount_cents, 0)
           + COALESCE(NEW.buyer_transaction_fee_cents, 0)
           + COALESCE(NEW.tax_amount_cents, 0);

  SELECT p.refunded_cents INTO v_existing_refunded
  FROM public.payments p
  WHERE p.trade_id = NEW.id;
  IF FOUND THEN
    v_refunded := COALESCE(v_existing_refunded, 0);
  END IF;

  -- Refund-aware status (must not regress a refunded payment on trade updates)
  IF v_total > 0 AND v_refunded >= v_total THEN
    v_status := 'refunded';
  ELSIF v_refunded > 0 THEN
    v_status := 'partially_refunded';
  ELSIF NEW.status = 'completed' THEN
    v_status := 'succeeded';
  ELSIF NEW.status = 'cancelled' THEN
    v_status := 'cancelled';
  ELSIF NEW.status = 'in_progress' THEN
    v_status := 'captured';
  ELSIF NEW.status = 'payment_processing' THEN
    v_status := 'processing';
  ELSIF NEW.stripe_payment_intent_id IS NOT NULL THEN
    v_status := 'requires_capture';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.payments (
    trade_id, bundle_id, stripe_payment_intent_id, stripe_refund_id,
    buyer_id, seller_id, item_price_cents, platform_fee_cents,
    tax_amount_cents, sp_amount, total_charged_cents, derived_state,
    captured_at, updated_at
  ) VALUES (
    NEW.id, NEW.bundle_id, NEW.stripe_payment_intent_id, NEW.stripe_refund_id,
    NEW.buyer_id, NEW.seller_id,
    COALESCE(NEW.cash_amount_cents, 0),
    COALESCE(NEW.buyer_transaction_fee_cents, 0),
    COALESCE(NEW.tax_amount_cents, 0),
    COALESCE(NEW.sp_amount, 0),
    v_total, v_status,
    CASE WHEN NEW.status IN ('completed','in_progress') THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (trade_id) DO UPDATE SET
    bundle_id = EXCLUDED.bundle_id,
    stripe_payment_intent_id = COALESCE(EXCLUDED.stripe_payment_intent_id, payments.stripe_payment_intent_id),
    stripe_refund_id = COALESCE(payments.stripe_refund_id, EXCLUDED.stripe_refund_id),
    buyer_id = EXCLUDED.buyer_id,
    seller_id = EXCLUDED.seller_id,
    item_price_cents = EXCLUDED.item_price_cents,
    platform_fee_cents = EXCLUDED.platform_fee_cents,
    tax_amount_cents = EXCLUDED.tax_amount_cents,
    sp_amount = EXCLUDED.sp_amount,
    total_charged_cents = EXCLUDED.total_charged_cents,
    derived_state = EXCLUDED.derived_state,
    captured_at = COALESCE(payments.captured_at, EXCLUDED.captured_at),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_sync_from_trade ON public.trades;
CREATE TRIGGER trg_payments_sync_from_trade
AFTER INSERT OR UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.fn_payments_sync_from_trade();

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 (cont) — rpc_record_payment_refund()
-- Body otherwise identical to 317_payments_reconciliation_and_partial_refunds.sql
-- (L176-308); only the column name changed (status -> derived_state) and the local
-- v_new_status renamed to v_new_derived_state for clarity.
-- ─────────────────────────────────────────────────────────────────────────────

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

GRANT EXECUTE ON FUNCTION public.rpc_record_payment_refund(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT)
  TO service_role, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 (cont) — admin_health_summary()
-- Body otherwise identical to 20260809000003_admin_health_strip.sql (BLOCK 2);
-- ONLY the failed-payment predicate changed: `p.status` -> `p.derived_state`.
-- (Required: plpgsql resolves column names at run time, so the rename above would
-- otherwise make this RPC raise 42703 on every call.)
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_health_summary();

CREATE OR REPLACE FUNCTION public.admin_health_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now            TIMESTAMPTZ;
  -- computed metrics
  v_pay_total      INTEGER;
  v_pay_failed     INTEGER;
  v_pay_rate       NUMERIC;
  v_email_ok       INTEGER;
  v_email_bad      INTEGER;
  v_email_rate     NUMERIC;
  v_nodes_total    INTEGER;
  v_nodes_active   INTEGER;
  v_nodes_pct      NUMERIC;
  v_payout_failed  INTEGER;
  v_uptime         NUMERIC;
  v_gmv_cents      BIGINT;
  v_gmv_usd        NUMERIC;
  -- thresholds (from admin_config, category 'health')
  v_pay_warn       NUMERIC;
  v_pay_crit       NUMERIC;
  v_email_warn     NUMERIC;
  v_email_crit     NUMERIC;
  v_nodes_warn     NUMERIC;
  v_nodes_crit     NUMERIC;
  v_payout_warn    NUMERIC;
  v_payout_crit    NUMERIC;
  v_uptime_warn    NUMERIC;
  v_uptime_crit    NUMERIC;
  v_gmv_warn       NUMERIC;
  v_gmv_crit       NUMERIC;
  v_indicators     JSONB;
BEGIN
  v_now := NOW();

  -- 1) Payments — failed payment rate over the last 7 days.
  --    FIX-Task-24: reads the renamed column (derived_state).
  SELECT COUNT(*)::INTEGER INTO v_pay_total
  FROM public.payments p
  WHERE p.created_at >= v_now - INTERVAL '7 days';

  SELECT COUNT(*)::INTEGER INTO v_pay_failed
  FROM public.payments p
  WHERE p.created_at >= v_now - INTERVAL '7 days'
    AND p.derived_state = 'failed';

  v_pay_rate := COALESCE(
    ROUND(100.0 * v_pay_failed / NULLIF(v_pay_total, 0), 1),
    0
  );

  -- 2) Email delivery — success % over the last 7 days. Delivery outcomes only
  --    (delivered/opened/clicked = success; failed/bounced = failure). In-flight
  --    'pending'/'sent' and 'unsubscribed' are excluded. No emails in window =
  --    nothing failed = healthy (COALESCE 100).
  SELECT COUNT(*)::INTEGER INTO v_email_ok
  FROM public.email_logs e
  WHERE e.created_at >= v_now - INTERVAL '7 days'
    AND e.status IN ('delivered', 'opened', 'clicked');

  SELECT COUNT(*)::INTEGER INTO v_email_bad
  FROM public.email_logs e
  WHERE e.created_at >= v_now - INTERVAL '7 days'
    AND e.status IN ('failed', 'bounced');

  v_email_rate := COALESCE(
    ROUND(100.0 * v_email_ok / NULLIF(v_email_ok + v_email_bad, 0), 1),
    100
  );

  -- 3) Nodes — active vs total (current snapshot).
  SELECT COUNT(*)::INTEGER INTO v_nodes_total
  FROM public.nodes n;

  SELECT COUNT(*)::INTEGER INTO v_nodes_active
  FROM public.nodes n
  WHERE n.is_active = TRUE;

  v_nodes_pct := COALESCE(
    ROUND(100.0 * v_nodes_active / NULLIF(v_nodes_total, 0), 0),
    0
  );

  -- 4) Failed payouts needing manual retry (PAY-008) — mirrors the Action Center.
  SELECT COUNT(*)::INTEGER INTO v_payout_failed
  FROM public.seller_payouts sp
  WHERE sp.status = 'failed';

  -- 5) Uptime — config-driven input (BRD NFR-AVAIL-001 default 99.9).
  SELECT (ac.value)::NUMERIC INTO v_uptime
  FROM public.admin_config ac
  WHERE ac.key = 'health_uptime_percent'
    AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$'
  LIMIT 1;
  v_uptime := COALESCE(v_uptime, 99.9);

  -- 6) GMV (7d) — completed-trade volume (USD, rounded).
  SELECT COALESCE(SUM(t.cash_amount_cents), 0)::BIGINT INTO v_gmv_cents
  FROM public.trades t
  WHERE t.status = 'completed'
    AND t.completed_at >= v_now - INTERVAL '7 days';

  v_gmv_usd := ROUND(v_gmv_cents / 100.0, 0);

  -- Threshold reads (regex-guarded numeric cast + documented fallback).
  SELECT (ac.value)::NUMERIC INTO v_pay_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_payment_failure_warn_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_pay_warn := COALESCE(v_pay_warn, 2.0);

  SELECT (ac.value)::NUMERIC INTO v_pay_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_payment_failure_crit_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_pay_crit := COALESCE(v_pay_crit, 5.0);

  SELECT (ac.value)::NUMERIC INTO v_email_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_email_delivery_warn_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_email_warn := COALESCE(v_email_warn, 95.0);

  SELECT (ac.value)::NUMERIC INTO v_email_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_email_delivery_crit_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_email_crit := COALESCE(v_email_crit, 90.0);

  SELECT (ac.value)::NUMERIC INTO v_nodes_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_nodes_active_warn_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_nodes_warn := COALESCE(v_nodes_warn, 80.0);

  SELECT (ac.value)::NUMERIC INTO v_nodes_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_nodes_active_crit_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_nodes_crit := COALESCE(v_nodes_crit, 50.0);

  SELECT (ac.value)::NUMERIC INTO v_payout_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_failed_payouts_warn' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_payout_warn := COALESCE(v_payout_warn, 1.0);

  SELECT (ac.value)::NUMERIC INTO v_payout_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_failed_payouts_crit' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_payout_crit := COALESCE(v_payout_crit, 4.0);

  SELECT (ac.value)::NUMERIC INTO v_uptime_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_uptime_warn_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_uptime_warn := COALESCE(v_uptime_warn, 99.9);

  SELECT (ac.value)::NUMERIC INTO v_uptime_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_uptime_crit_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_uptime_crit := COALESCE(v_uptime_crit, 99.0);

  SELECT (ac.value)::NUMERIC INTO v_gmv_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_gmv_warn_usd' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_gmv_warn := COALESCE(v_gmv_warn, 2500.0);

  SELECT (ac.value)::NUMERIC INTO v_gmv_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_gmv_crit_usd' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_gmv_crit := COALESCE(v_gmv_crit, 500.0);

  v_indicators := jsonb_build_array(
    jsonb_build_object(
      'id', 'payments', 'value', v_pay_rate, 'display', v_pay_rate || '%',
      'thresholds', jsonb_build_object('warn', v_pay_warn, 'crit', v_pay_crit)
    ),
    jsonb_build_object(
      'id', 'email_delivery', 'value', v_email_rate, 'display', v_email_rate || '%',
      'thresholds', jsonb_build_object('warn', v_email_warn, 'crit', v_email_crit)
    ),
    jsonb_build_object(
      'id', 'nodes_active', 'value', v_nodes_pct,
      'display', v_nodes_active || '/' || v_nodes_total,
      'detail', v_nodes_active || ' of ' || v_nodes_total || ' nodes active',
      'thresholds', jsonb_build_object('warn', v_nodes_warn, 'crit', v_nodes_crit)
    ),
    jsonb_build_object(
      'id', 'failed_payouts', 'value', v_payout_failed,
      'display', v_payout_failed::TEXT,
      'thresholds', jsonb_build_object('warn', v_payout_warn, 'crit', v_payout_crit)
    ),
    jsonb_build_object(
      'id', 'uptime', 'value', v_uptime, 'display', v_uptime || '%',
      'thresholds', jsonb_build_object('warn', v_uptime_warn, 'crit', v_uptime_crit)
    ),
    jsonb_build_object(
      'id', 'gmv_7d', 'value', v_gmv_usd, 'display', '$' || v_gmv_usd,
      'thresholds', jsonb_build_object('warn', v_gmv_warn, 'crit', v_gmv_crit)
    )
  );

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'indicators',   v_indicators
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_health_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_health_summary() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2 — index + admin view
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_payments_status;
CREATE INDEX IF NOT EXISTS idx_payments_derived_state ON public.payments(derived_state);

-- The view MUST be dropped and recreated: a view survives an underlying column
-- rename (its attribute reference is bound by attnum) but KEEPS its old OUTPUT
-- column name — so without this, the admin API would still receive `status` and
-- the interpretation trap would survive the rename.
DROP VIEW IF EXISTS public.admin_payments_view;

CREATE OR REPLACE VIEW public.admin_payments_view AS
SELECT
  p.id::text,
  p.trade_id::text,
  p.bundle_id::text,
  p.stripe_payment_intent_id,
  p.stripe_refund_id,
  p.buyer_id,
  p.seller_id,
  p.currency,
  p.item_price_cents,
  p.platform_fee_cents,
  p.tax_amount_cents,
  p.sp_amount,
  p.total_charged_cents,
  p.refunded_cents,
  p.refunded_price_cents,
  p.refunded_fee_cents,
  p.refunded_tax_cents,
  p.derived_state,
  p.created_at,
  p.updated_at,
  p.captured_at,
  p.refunded_at
FROM public.payments p;

GRANT SELECT ON public.admin_payments_view TO service_role;
GRANT SELECT ON public.admin_payments_view TO authenticated;

COMMIT;

-- ============================================================================
-- BLOCK 3 — Verification queries (run ONE statement per call — BP: execute_sql
-- returns only the last statement's result set)
-- ============================================================================
-- V1) The column was renamed and the old name is GONE:
--     SELECT column_name, data_type FROM information_schema.columns
--      WHERE table_schema = 'public' AND table_name = 'payments'
--        AND column_name IN ('status','derived_state');
--     Expected: exactly ONE row -> derived_state | text.
--
-- V2) The view exposes derived_state (and NOT status):
--     SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'admin_payments_view'
--        AND column_name IN ('status','derived_state');
--     Expected: exactly ONE row -> derived_state.
--
-- V3) The index was replaced:
--     SELECT indexname FROM pg_indexes
--      WHERE schemaname='public' AND tablename='payments' AND indexname LIKE 'idx_payments_%'
--      ORDER BY indexname;
--     Expected: idx_payments_bundle_id, idx_payments_created_at, idx_payments_derived_state,
--               idx_payments_stripe_payment_intent_id  (NO idx_payments_status).
--
-- V4) The health RPC still works (this is the one that would break on a missed rename):
--     SELECT public.admin_health_summary();
--     Expected: JSONB with generated_at + 6 indicators (payments, email_delivery,
--               nodes_active, failed_payouts, uptime, gmv_7d).
--
-- V5) The trade->payments projection still writes:
--     SELECT p.derived_state, p.captured_at FROM public.payments p ORDER BY p.updated_at DESC LIMIT 3;
--
-- Common failure modes:
--   - 42703 "column p.status does not exist" from admin_health_summary() -> the
--     redefinition above did not land; re-apply this migration.
--   - The admin Payments page showing an empty/undefined status pill -> the view
--     recreate did not run (V2 fails).
-- ============================================================================
