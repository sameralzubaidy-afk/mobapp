-- ============================================================================
-- R4 — Stripe Connect Direct Charges & Dispute Cost Accounting
-- Mode B: Idempotent Rerunnable Migration
--
-- WHAT THIS DOES (owner summary):
--   R4 configures the platform's Stripe Connect charge type as Direct charges
--   (seller = merchant of record; Stripe debits the seller FIRST on a dispute).
--   The Direct-charge configuration itself is a NON-CODE Stripe Dashboard
--   setting (see docx/SYSTEM_REQUIREMENTS_V2.md §7.12 config guide). This
--   migration builds the CODE layer that accounts for dispute losses:
--
--   1. `dispute_costs` ledger — one row per Stripe dispute (idempotent, keyed on
--      the Stripe dispute id `dp_...`). Records the per-trade AOV, the admin-
--      configurable dispute fee + recovery rate, and the realized dispute cost:
--          dispute cost = $15 fee + (AOV x (1 - recovery_rate))
--      AOV = the disputed trade's charged amount (Stripe dispute.amount).
--      Won/withdrawn disputes realize NO loss (Stripe refunds the fee on a win).
--      Lost disputes record a seller loss; if the seller's balance can't cover
--      it, the outstanding amount is tracked as a negative-balance equivalent
--      (recovery_status = pending/partial/recovered/written_off) — mirroring
--      Stripe's own negative-balance recovery from the connected account's
--      future payouts under Direct charges.
--
--   2. `rpc_record_dispute_event` — idempotent atomic write path for the
--      `charge.dispute.*` webhook handler (HP-5: single RPC, no scattered
--      updates). Reads `dispute_fee_cents` / `dispute_recovery_rate` LIVE from
--      admin_config (BP-28) so finance can tune the formula without a deploy.
--
--   3. `rpc_apply_seller_recovery` — records recovery against an outstanding
--      loss (called by finance tooling / a future payout-clawback hook).
--
--   4. `admin_dispute_costs_view` — text-cast UUID view for the admin finance
--      reporting surface (BP-45: never ILIKE a UUID column).
--
--   5. `seller_payout_methods.stripe_charges_enabled` — additive flag so
--      `account.updated` / `sync-stripe-connect-status` can track Direct-charge
--      readiness (charges_enabled) on connected accounts.
--
--   RULES applied: SQL-0 (Mode B), BP-9 (table -> constraints -> RLS -> policies
--   -> functions -> triggers -> indexes), BP-1 (RLS in the same migration),
--   BP-5 (SECURITY DEFINER + search_path), p_/v_ naming, qualified columns,
--   HP-4 (CHECK invariants), HP-5 (atomic RPC), BP-45 (text-cast view),
--   BP-50 (unique timestamp 20260810000005).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1: Schema
-- ---------------------------------------------------------------------------

-- 1.1 Admin-configurable dispute-cost inputs (defaults flagged for finance
--     sign-off: $15 fee, 50% recovery rate). Mirrors 074_admin_payout_fee_config.sql.
INSERT INTO admin_config (key, value, description, category)
VALUES
  ('dispute_fee_cents', '1500', 'Stripe dispute fee in cents applied per LOST dispute ($15 default — finance sign-off)', 'fees'),
  ('dispute_recovery_rate', '0.50', 'Dispute recovery rate (0-1): probability the platform prevails. Expected loss on a dispute = AOV x (1 - recovery_rate). Default 0.50 — finance sign-off', 'fees')
ON CONFLICT (key) DO NOTHING;

-- 1.2 Dispute-cost ledger (one row per Stripe dispute; idempotency key = dispute_id)
CREATE TABLE IF NOT EXISTS public.dispute_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stripe dispute id (dp_...) — unique idempotency key for webhook replays
  dispute_id TEXT NOT NULL UNIQUE,
  charge_id TEXT,
  payment_intent_id TEXT,
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
  seller_id UUID,
  buyer_id UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','withdrawn')),
  dispute_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (dispute_fee_cents >= 0),
  aov_cents INTEGER NOT NULL DEFAULT 0 CHECK (aov_cents >= 0),
  recovery_rate NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (recovery_rate >= 0 AND recovery_rate <= 1),
  loss_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (loss_amount_cents >= 0),
  total_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cost_cents >= 0),
  recovery_status TEXT NOT NULL DEFAULT 'none' CHECK (recovery_status IN ('none','pending','partial','recovered','written_off')),
  recovered_cents INTEGER NOT NULL DEFAULT 0 CHECK (recovered_cents >= 0),
  outstanding_cents INTEGER NOT NULL DEFAULT 0 CHECK (outstanding_cents >= 0),
  node_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  -- HP-4 invariants: outstanding is only meaningful once a loss is realized
  -- (open/won rows carry informational expected cost with outstanding = 0).
  CONSTRAINT dispute_costs_outstanding_valid CHECK (
    (recovery_status = 'none' AND outstanding_cents = 0)
    OR (recovery_status <> 'none' AND outstanding_cents = total_cost_cents - recovered_cents)
  ),
  CONSTRAINT dispute_costs_recovered_le_total CHECK (recovered_cents <= total_cost_cents)
);

-- 1.3 Additive flag for Direct-charge readiness on connected accounts
ALTER TABLE public.seller_payout_methods ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false;

-- 1.4 RLS (BP-1): financial records — service role only (mirrors payments / trade_refunds)
ALTER TABLE public.dispute_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispute_costs_service_role_all ON public.dispute_costs;
CREATE POLICY dispute_costs_service_role_all ON public.dispute_costs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 1.5 FK node_id -> nodes (NOT VALID + guarded VALIDATE per N6 backward-compat pattern)
DO $$
DECLARE
  v_orphans INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dispute_costs_node_id' AND conrelid = 'public.dispute_costs'::regclass) THEN
    ALTER TABLE public.dispute_costs ADD CONSTRAINT fk_dispute_costs_node_id FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  SELECT COUNT(*) INTO v_orphans FROM public.dispute_costs d LEFT JOIN public.nodes n ON n.id = d.node_id WHERE d.node_id IS NOT NULL AND n.id IS NULL;
  IF v_orphans = 0 THEN ALTER TABLE public.dispute_costs VALIDATE CONSTRAINT fk_dispute_costs_node_id; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- BLOCK 2: Functions, trigger, RPCs, view
-- ---------------------------------------------------------------------------

-- 2.1 Node resolution trigger (fills ONLY when NULL; mirrors payments/trade_refunds)
CREATE OR REPLACE FUNCTION public.set_dispute_cost_node_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL THEN
    SELECT t.node_id INTO NEW.node_id
    FROM public.trades t
    WHERE t.id = NEW.trade_id;
  END IF;
  IF NEW.node_id IS NULL AND NEW.seller_id IS NOT NULL THEN
    NEW.node_id := public.get_seller_node_id(NEW.seller_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_dispute_cost_node_id ON public.dispute_costs;
CREATE TRIGGER trg_set_dispute_cost_node_id
  BEFORE INSERT OR UPDATE ON public.dispute_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_dispute_cost_node_id();

-- 2.2 Idempotent dispute-event write path (HP-5). Handles charge.dispute.created /
--     updated / closed / funds_withdrawn / funds_reinstated.
--     Status normalization (Stripe -> ours): won -> won; lost -> lost;
--     charge_refunded / warning_closed / withdrawn -> withdrawn; else open.
CREATE OR REPLACE FUNCTION public.rpc_record_dispute_event(
  p_dispute_id TEXT,
  p_event_type TEXT,
  p_charge_id TEXT,
  p_payment_intent_id TEXT,
  p_status TEXT,
  p_amount_cents INTEGER,
  p_outcome TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade_id UUID;
  v_seller_id UUID;
  v_buyer_id UUID;
  v_node_id UUID;
  v_fee_cents INTEGER;
  v_recovery_rate NUMERIC(4,3);
  v_aov_cents INTEGER;
  v_loss_cents INTEGER;
  v_total_cents INTEGER;
  v_normalized_status TEXT;
  v_row_found BOOLEAN := FALSE;
BEGIN
  -- Normalize Stripe dispute status to our enum (closed event carries the verdict
  -- in dispute.status = 'won' | 'lost'; outcome is a cross-check).
  IF p_status = 'won' OR (p_event_type = 'charge.dispute.closed' AND p_outcome = 'won') THEN
    v_normalized_status := 'won';
  ELSIF p_status = 'lost' OR (p_event_type = 'charge.dispute.closed' AND p_outcome = 'lost') THEN
    v_normalized_status := 'lost';
  ELSIF p_status IN ('withdrawn','charge_refunded','warning_closed') THEN
    v_normalized_status := 'withdrawn';
  ELSE
    v_normalized_status := 'open';
  END IF;

  -- Resolve the trade by PaymentIntent (Direct-charge disputes carry the PI on the charge)
  IF p_payment_intent_id IS NOT NULL THEN
    SELECT t.id, t.seller_id, t.buyer_id, t.node_id
      INTO v_trade_id, v_seller_id, v_buyer_id, v_node_id
      FROM public.trades t
      WHERE t.stripe_payment_intent_id = p_payment_intent_id
      LIMIT 1;
  END IF;

  -- AOV = per-trade charged amount. Prefer Stripe dispute.amount (authoritative);
  -- fall back to the DB derivation (payments.total_charged_cents else trade columns).
  v_aov_cents := COALESCE(NULLIF(p_amount_cents, 0), 0);
  IF v_aov_cents = 0 AND v_trade_id IS NOT NULL THEN
    SELECT COALESCE(pay.total_charged_cents,
                    t.cash_amount_cents + COALESCE(t.buyer_transaction_fee_cents, 0) + COALESCE(t.tax_amount_cents, 0))
      INTO v_aov_cents
      FROM public.trades t
      LEFT JOIN public.payments pay ON pay.trade_id = t.id
      WHERE t.id = v_trade_id
      LIMIT 1;
  END IF;

  -- Admin-configurable cost inputs (BP-13: fallbacks mirror the seed in THIS
  -- migration 20260810000005_r4_dispute_cost_accounting.sql; tune live via
  -- admin_config without a deploy).
  v_fee_cents := COALESCE((SELECT value::INTEGER FROM public.admin_config WHERE key = 'dispute_fee_cents'), 1500);
  v_recovery_rate := COALESCE((SELECT value::NUMERIC FROM public.admin_config WHERE key = 'dispute_recovery_rate'), 0.50);
  IF v_recovery_rate < 0 THEN v_recovery_rate := 0; END IF;
  IF v_recovery_rate > 1 THEN v_recovery_rate := 1; END IF;

  -- Dispute cost formula: fee + AOV x (1 - recovery_rate)
  v_loss_cents := ROUND(v_aov_cents * (1 - v_recovery_rate))::INTEGER;
  v_total_cents := v_fee_cents + v_loss_cents;

  -- Idempotent upsert keyed on the Stripe dispute id
  SELECT EXISTS(SELECT 1 FROM public.dispute_costs d WHERE d.dispute_id = p_dispute_id) INTO v_row_found;

  IF v_row_found THEN
    IF v_normalized_status = 'lost' THEN
      -- Realize the loss; keep any amount already recovered from the seller.
      UPDATE public.dispute_costs d SET
        status             = 'lost',
        charge_id          = COALESCE(p_charge_id, d.charge_id),
        payment_intent_id  = COALESCE(p_payment_intent_id, d.payment_intent_id),
        trade_id           = COALESCE(v_trade_id, d.trade_id),
        seller_id          = COALESCE(v_seller_id, d.seller_id),
        buyer_id           = COALESCE(v_buyer_id, d.buyer_id),
        dispute_fee_cents  = v_fee_cents,
        aov_cents          = v_aov_cents,
        recovery_rate      = v_recovery_rate,
        loss_amount_cents  = v_loss_cents,
        total_cost_cents   = v_total_cents,
        recovery_status    = CASE WHEN d.recovery_status IN ('pending','partial') THEN d.recovery_status ELSE 'pending' END,
        recovered_cents    = LEAST(d.recovered_cents, v_total_cents),
        outstanding_cents  = v_total_cents - LEAST(d.recovered_cents, v_total_cents),
        closed_at          = COALESCE(d.closed_at, now()),
        updated_at         = now()
      WHERE d.dispute_id = p_dispute_id;
    ELSIF v_normalized_status IN ('won','withdrawn') THEN
      -- No loss (Stripe refunds the dispute fee on a win); reset cost + recovery.
      UPDATE public.dispute_costs d SET
        status             = v_normalized_status,
        charge_id          = COALESCE(p_charge_id, d.charge_id),
        payment_intent_id  = COALESCE(p_payment_intent_id, d.payment_intent_id),
        trade_id           = COALESCE(v_trade_id, d.trade_id),
        seller_id          = COALESCE(v_seller_id, d.seller_id),
        buyer_id           = COALESCE(v_buyer_id, d.buyer_id),
        dispute_fee_cents  = 0,
        loss_amount_cents  = 0,
        total_cost_cents   = 0,
        recovered_cents    = 0,
        outstanding_cents  = 0,
        recovery_status    = 'none',
        closed_at          = COALESCE(d.closed_at, now()),
        updated_at         = now()
      WHERE d.dispute_id = p_dispute_id;
    ELSE
      -- open / update — informational expected cost; no realized loss yet.
      -- Terminal states (won/lost/withdrawn) MUST never regress to 'open' on a
      -- late/replayed event (out-of-order webhook delivery safety).
      UPDATE public.dispute_costs d SET
        status             = CASE WHEN d.status IN ('won','lost','withdrawn') THEN d.status ELSE v_normalized_status END,
        charge_id          = COALESCE(p_charge_id, d.charge_id),
        payment_intent_id  = COALESCE(p_payment_intent_id, d.payment_intent_id),
        trade_id           = COALESCE(v_trade_id, d.trade_id),
        seller_id          = COALESCE(v_seller_id, d.seller_id),
        buyer_id           = COALESCE(v_buyer_id, d.buyer_id),
        dispute_fee_cents  = v_fee_cents,
        aov_cents          = v_aov_cents,
        recovery_rate      = v_recovery_rate,
        loss_amount_cents  = v_loss_cents,
        total_cost_cents   = v_total_cents,
        updated_at         = now()
      WHERE d.dispute_id = p_dispute_id;
    END IF;
  ELSE
    -- First sight of this dispute
    INSERT INTO public.dispute_costs (
      dispute_id, charge_id, payment_intent_id, trade_id, seller_id, buyer_id,
      status, dispute_fee_cents, aov_cents, recovery_rate, loss_amount_cents,
      total_cost_cents, recovery_status, recovered_cents, outstanding_cents, node_id, closed_at
    ) VALUES (
      p_dispute_id, p_charge_id, p_payment_intent_id, v_trade_id, v_seller_id, v_buyer_id,
      v_normalized_status,
      CASE WHEN v_normalized_status IN ('won','withdrawn') THEN 0 ELSE v_fee_cents END,
      v_aov_cents, v_recovery_rate,
      CASE WHEN v_normalized_status IN ('won','withdrawn') THEN 0 ELSE v_loss_cents END,
      CASE WHEN v_normalized_status IN ('won','withdrawn') THEN 0 ELSE v_total_cents END,
      CASE WHEN v_normalized_status = 'lost' THEN 'pending' ELSE 'none' END,
      0,
      CASE WHEN v_normalized_status = 'lost' THEN v_total_cents ELSE 0 END,
      v_node_id,
      CASE WHEN v_normalized_status IN ('won','lost','withdrawn') THEN now() ELSE NULL END
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', p_dispute_id,
    'status', v_normalized_status,
    'dispute_fee_cents', CASE WHEN v_normalized_status IN ('won','withdrawn') THEN 0 ELSE v_fee_cents END,
    'aov_cents', v_aov_cents,
    'loss_amount_cents', CASE WHEN v_normalized_status IN ('won','withdrawn') THEN 0 ELSE v_loss_cents END,
    'total_cost_cents', CASE WHEN v_normalized_status IN ('won','withdrawn') THEN 0 ELSE v_total_cents END
  );
END;
$$;

-- 2.3 Record recovery against an outstanding (negative-balance-equivalent) loss.
CREATE OR REPLACE FUNCTION public.rpc_apply_seller_recovery(
  p_dispute_id TEXT,
  p_amount_cents INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outstanding INTEGER;
  v_recovered INTEGER;
  v_total INTEGER;
  v_status TEXT;
  v_apply INTEGER;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT d.outstanding_cents, d.recovered_cents, d.total_cost_cents, d.status
    INTO v_outstanding, v_recovered, v_total, v_status
    FROM public.dispute_costs d
    WHERE d.dispute_id = p_dispute_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'DISPUTE_NOT_FOUND');
  END IF;

  IF v_status <> 'lost' THEN
    RETURN jsonb_build_object('success', false, 'error', 'DISPUTE_NOT_LOST', 'status', v_status);
  END IF;

  v_apply := LEAST(p_amount_cents, v_outstanding);

  UPDATE public.dispute_costs d SET
    recovered_cents   = v_recovered + v_apply,
    outstanding_cents = v_total - (v_recovered + v_apply),
    recovery_status   = CASE WHEN (v_total - (v_recovered + v_apply)) = 0 THEN 'recovered' ELSE 'partial' END,
    updated_at        = now()
  WHERE d.dispute_id = p_dispute_id;

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', p_dispute_id,
    'applied_cents', v_apply,
    'recovered_cents', v_recovered + v_apply,
    'outstanding_cents', v_total - (v_recovered + v_apply),
    'recovery_status', CASE WHEN (v_total - (v_recovered + v_apply)) = 0 THEN 'recovered' ELSE 'partial' END
  );
END;
$$;

-- 2.4 Finance reporting view — text-cast UUIDs for admin search (BP-45).
CREATE OR REPLACE VIEW public.admin_dispute_costs_view AS
SELECT
  d.id,
  d.dispute_id,
  d.charge_id,
  d.payment_intent_id,
  d.trade_id,
  d.trade_id::text AS trade_id_text,
  d.seller_id,
  d.seller_id::text AS seller_id_text,
  COALESCE(p.name, 'Unknown') AS seller_name,
  COALESCE(p.email, '') AS seller_email,
  d.buyer_id,
  d.buyer_id::text AS buyer_id_text,
  d.status,
  d.dispute_fee_cents,
  d.aov_cents,
  d.recovery_rate,
  d.loss_amount_cents,
  d.total_cost_cents,
  d.recovery_status,
  d.recovered_cents,
  d.outstanding_cents,
  d.node_id,
  d.node_id::text AS node_id_text,
  d.created_at,
  d.updated_at,
  d.closed_at
FROM public.dispute_costs d
LEFT JOIN public.profiles p ON p.user_id = d.seller_id;

-- ---------------------------------------------------------------------------
-- BLOCK 3: Indexes, grants, verification
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_dispute_costs_trade_id  ON public.dispute_costs(trade_id);
CREATE INDEX IF NOT EXISTS idx_dispute_costs_seller_id ON public.dispute_costs(seller_id);
CREATE INDEX IF NOT EXISTS idx_dispute_costs_status    ON public.dispute_costs(status);
CREATE INDEX IF NOT EXISTS idx_dispute_costs_node_id   ON public.dispute_costs(node_id);

GRANT EXECUTE ON FUNCTION public.rpc_record_dispute_event(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_apply_seller_recovery(TEXT, INTEGER) TO service_role;
GRANT SELECT ON public.admin_dispute_costs_view TO service_role;
GRANT SELECT ON public.admin_dispute_costs_view TO authenticated;

-- Verification (SQL-3 / BP-10) — run one statement per call:
--   SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='dispute_costs' ORDER BY ordinal_position;
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='dispute_costs';
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='dispute_costs';
--   SELECT key, value FROM public.admin_config WHERE key IN ('dispute_fee_cents','dispute_recovery_rate') ORDER BY key;
--   SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='seller_payout_methods' AND column_name='stripe_charges_enabled';
