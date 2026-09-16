-- Migration: 317 Payments Reconciliation + Partial Refunds
-- Mode: B — idempotent rerunnable (safe to re-run).
--
-- Adds three capabilities requested by product:
--   1. `payments` table — one row per trade: charged snapshot (item price / platform
--      fee / sales tax / SP / total) + running refunded totals + status. This is the
--      finance reconciliation source (what was charged vs. refunded per trade/bundle).
--   2. `trade_refunds` table — line-item refund history (per-refund price/fee/tax split).
--   3. `rpc_record_payment_refund` — atomic primitive for (partial) refunds: validates
--      per-component remaining amounts, writes the refund line item, updates the payment
--      row, and reverses the tax ledger proportionally (reusing refund_tax).
--
-- Ordering (BP-9): tables -> constraints -> RLS -> policies -> functions -> triggers -> indexes -> backfill.

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 — Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL UNIQUE REFERENCES public.trades(id) ON DELETE CASCADE,
  bundle_id UUID,
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT,
  buyer_id UUID,
  seller_id UUID,
  currency TEXT NOT NULL DEFAULT 'usd',
  item_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (item_price_cents >= 0),
  platform_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  tax_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount_cents >= 0),
  sp_amount INTEGER NOT NULL DEFAULT 0 CHECK (sp_amount >= 0),
  total_charged_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_charged_cents >= 0),
  refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  refunded_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_price_cents >= 0),
  refunded_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_fee_cents >= 0),
  refunded_tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_tax_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','requires_capture','processing','captured','succeeded',
    'refunded','partially_refunded','cancelled','failed'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  -- HP-4 invariant: refunded totals can never exceed the charged amounts
  CONSTRAINT payments_refunded_le_charged
    CHECK (refunded_cents <= total_charged_cents)
);

CREATE TABLE IF NOT EXISTS public.trade_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  stripe_refund_id TEXT,
  refund_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (refund_amount_cents >= 0),
  refund_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (refund_price_cents >= 0),
  refund_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (refund_fee_cents >= 0),
  refund_tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (refund_tax_cents >= 0),
  reason TEXT,
  initiating_actor TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded','pending','failed','canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- HP-4 invariant: line-item refund must reconcile to total
  CONSTRAINT trade_refunds_split_valid
    CHECK (refund_amount_cents = refund_price_cents + refund_fee_cents + refund_tax_cents)
);

-- RLS (BP-1): payments + refunds are financial records — service role only.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_service_role_all ON public.payments;
CREATE POLICY payments_service_role_all ON public.payments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS trade_refunds_service_role_all ON public.trade_refunds;
CREATE POLICY trade_refunds_service_role_all ON public.trade_refunds
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2 — Functions (BP-5: SECURITY DEFINER + search_path)
-- ─────────────────────────────────────────────────────────────────────────────

-- Keep payments snapshot in sync with trades. Refund-aware status derivation:
--   * fully refunded -> 'refunded'
--   * partially refunded -> 'partially_refunded'
--   * else derived from trade.status / PI presence.
-- NEVER overwrites refunded_* columns (those are owned by the refund flow).
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
    tax_amount_cents, sp_amount, total_charged_cents, status,
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
    status = EXCLUDED.status,
    captured_at = COALESCE(payments.captured_at, EXCLUDED.captured_at),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_sync_from_trade ON public.trades;
CREATE TRIGGER trg_payments_sync_from_trade
AFTER INSERT OR UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.fn_payments_sync_from_trade();

-- Atomic (HP-5) record of a (possibly partial) refund into payments + trade_refunds
-- + proportional tax reversal. Called by the trade-refund Edge Function AFTER the
-- Stripe refund/cancel has been created. Validates per-component remaining amounts.
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
  v_new_status TEXT;
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

  -- Update payment refunded totals + status
  v_new_price := v_payment.refunded_price_cents + COALESCE(p_refund_price_cents, 0);
  v_new_fee   := v_payment.refunded_fee_cents   + COALESCE(p_refund_fee_cents, 0);
  v_new_tax   := v_payment.refunded_tax_cents   + COALESCE(p_refund_tax_cents, 0);
  v_new_refunded_cents := v_new_price + v_new_fee + v_new_tax;

  IF v_new_refunded_cents >= v_payment.total_charged_cents AND v_payment.total_charged_cents > 0 THEN
    v_new_status := 'refunded';
  ELSIF v_new_refunded_cents > 0 THEN
    v_new_status := 'partially_refunded';
  ELSE
    v_new_status := v_payment.status;
  END IF;

  UPDATE public.payments p SET
    refunded_cents = v_new_refunded_cents,
    refunded_price_cents = v_new_price,
    refunded_fee_cents = v_new_fee,
    refunded_tax_cents = v_new_tax,
    stripe_refund_id = COALESCE(p.stripe_refund_id, p_stripe_refund_id),
    status = v_new_status,
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

-- Reconciliation catch-all for the Stripe charge.refunded webhook. Covers FULL
-- refunds issued by ANY path (force-cancel, dispute-refund, cancel-trade, manual
-- Stripe dashboard). Idempotent: skips refunds already recorded by the trade-refund
-- EF (same stripe_refund_id in trade_refunds). Partial refunds with an UNKNOWN
-- component split are NOT auto-attributed (avoids guessing) — they return
-- 'needs_review' and must be done via the admin Partial Refund button instead.
CREATE OR REPLACE FUNCTION public.rpc_sync_payment_refund_webhook(
  p_trade_id UUID,
  p_stripe_refund_id TEXT,
  p_refund_amount_cents INTEGER,
  p_status TEXT DEFAULT 'succeeded'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_remaining_price INTEGER;
  v_remaining_fee INTEGER;
  v_remaining_tax INTEGER;
  v_remaining_total INTEGER;
  v_exists BOOLEAN;
  v_result JSONB;
BEGIN
  IF COALESCE(p_refund_amount_cents, 0) <= 0 THEN
    RETURN jsonb_build_object('success', true, 'action', 'noop');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.trade_refunds tr WHERE tr.stripe_refund_id = p_stripe_refund_id
  ) INTO v_exists;
  IF v_exists THEN
    -- Already recorded by the trade-refund EF (partial or full) — skip.
    RETURN jsonb_build_object('success', true, 'action', 'idempotent');
  END IF;

  SELECT * INTO v_payment FROM public.payments p WHERE p.trade_id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.payments (trade_id, buyer_id, seller_id)
    SELECT t.id, t.buyer_id, t.seller_id FROM public.trades t WHERE t.id = p_trade_id
    ON CONFLICT (trade_id) DO NOTHING;
    SELECT * INTO v_payment FROM public.payments p WHERE p.trade_id = p_trade_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'TRADE_NOT_FOUND',
        'message', 'Trade or payment record not found');
    END IF;
  END IF;

  v_remaining_price := v_payment.item_price_cents - v_payment.refunded_price_cents;
  v_remaining_fee   := v_payment.platform_fee_cents - v_payment.refunded_fee_cents;
  v_remaining_tax   := v_payment.tax_amount_cents   - v_payment.refunded_tax_cents;
  v_remaining_total := v_remaining_price + v_remaining_fee + v_remaining_tax;

  IF p_refund_amount_cents < v_remaining_total THEN
    -- Unknown component split for a partial refund — do NOT guess.
    RETURN jsonb_build_object('success', true, 'action', 'needs_review',
      'message', 'Partial refund with unknown split — use the admin Partial Refund button');
  END IF;

  v_result := public.rpc_record_payment_refund(
    p_trade_id,
    p_stripe_refund_id,
    v_remaining_price,
    v_remaining_fee,
    v_remaining_tax,
    'stripe_webhook_full_refund',
    'stripe_webhook',
    p_status
  );
  RETURN jsonb_build_object('success', true, 'action', 'recorded', 'detail', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_sync_payment_refund_webhook(UUID, TEXT, INTEGER, TEXT)
  TO service_role, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3 — Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payments_bundle_id ON public.payments(bundle_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_refunds_trade_id ON public.trade_refunds(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_refunds_stripe_refund_id ON public.trade_refunds(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_trade_refunds_payment_id ON public.trade_refunds(payment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4 — Backfill existing trades into payments (rerunnable, idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.payments (
  trade_id, bundle_id, stripe_payment_intent_id, stripe_refund_id,
  buyer_id, seller_id, item_price_cents, platform_fee_cents,
  tax_amount_cents, sp_amount, total_charged_cents, status
)
SELECT
  t.id, t.bundle_id, t.stripe_payment_intent_id, t.stripe_refund_id,
  t.buyer_id, t.seller_id,
  COALESCE(t.cash_amount_cents, 0),
  COALESCE(t.buyer_transaction_fee_cents, 0),
  COALESCE(t.tax_amount_cents, 0),
  COALESCE(t.sp_amount, 0),
  COALESCE(t.cash_amount_cents,0) + COALESCE(t.buyer_transaction_fee_cents,0) + COALESCE(t.tax_amount_cents,0),
  CASE WHEN t.status = 'completed' THEN 'succeeded'
       WHEN t.status = 'cancelled' THEN 'cancelled'
       WHEN t.status = 'in_progress' THEN 'captured'
       WHEN t.status = 'payment_processing' THEN 'processing'
       WHEN t.stripe_payment_intent_id IS NOT NULL THEN 'requires_capture'
       ELSE 'pending' END
FROM public.trades t
ON CONFLICT (trade_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 5 — Verification queries
-- ─────────────────────────────────────────────────────────────────────────────

-- V1: tables + columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('payments','trade_refunds') ORDER BY table_name, ordinal_position;

-- V2: RLS enabled on both
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('payments','trade_refunds');

-- V3: trigger registered
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_payments_sync_from_trade';

-- V4: function exists with correct args
SELECT proname FROM pg_proc WHERE proname = 'rpc_record_payment_refund';

-- V5: backfill populated (compare with trades count that have a PI)
SELECT
  (SELECT count(*) FROM public.payments) AS payment_rows,
  (SELECT count(*) FROM public.trades WHERE stripe_payment_intent_id IS NOT NULL) AS trades_with_pi;

-- Common failure modes:
--   - rpc_record_payment_refund signature mismatch -> DROP FUNCTION before changing args (BP-12).
--   - refunded totals stale -> the refund EF always calls rpc_record_payment_refund after Stripe; the
--     charge.refunded webhook can also call it (with only p_refund_tax/price/fee = 0) to sync totals.
--   - trigger clobbering refund status -> handled by refund-aware status derivation above.
