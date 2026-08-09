-- =============================================================================
-- N2 — Idempotency & Audit (Cross-Cutting)
-- Migration: 20260810000006_n2_idempotency_audit.sql
-- Mode B — idempotent rerunnable (safe to re-run; drop-then-create everywhere).
--
-- What this adds:
--   1. `financial_audit_log` — unified, append-only journal for every payment /
--      SP / fee / tax state transition (actor, entity, before/after, amount,
--      idempotency_key UNIQUE, node_id per N6). RLS: service-role + admin read.
--   2. `fn_log_financial_audit()` — idempotent audit writer (ON CONFLICT DO
--      NOTHING on idempotency_key) so a retried mutation never double-logs.
--   3. Unique guard on `trades.stripe_payment_intent_id` (partial WHERE NOT NULL)
--      — a retried offer submission can never attach two PIs to the same trade.
--   4. Unique guard on `trade_refunds.stripe_refund_id` (partial WHERE NOT NULL)
--      — closes the webhook-vs-EF TOCTOU race on refund dedupe.
--   5. `debit_sp_for_trade` / `credit_sp_for_cancelled_trade` made idempotent:
--      deterministic `sp_debit_<trade>` / `sp_refund_<trade>` keys, short-circuit
--      on an existing entry, ledger insert carries the key. (N2 R4.)
--   6. `admin_adjust_sp_wallet` accepts an optional `p_idempotency_key`; when
--      omitted it derives a deterministic key per (wallet, amount, actor, minute)
--      so a same-second double-click cannot double-credit. (N2 R5.)
--
-- Backward compatible: additive-only (new table, new partial unique indexes on
-- existing columns, function redefinitions keep the same signatures for existing
-- callers — the new `p_idempotency_key` arg on admin_adjust_sp_wallet has a
-- DEFAULT so 5-arg callers keep working). No columns dropped/renamed.
-- =============================================================================

-- =============================================================================
-- 1. financial_audit_log table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mutation_type  TEXT NOT NULL CHECK (mutation_type IN (
    'offer_created', 'payment_intent_created', 'payment_captured',
    'payment_capture_failed', 'payment_cancelled', 'refund_issued',
    'refund_voided', 'payout_initiated', 'payout_paid',
    'payout_requires_action', 'payout_failed',
    'sp_reserved', 'sp_restored', 'sp_released', 'sp_issued',
    'sp_deducted', 'sp_frozen', 'sp_unfrozen', 'sp_expired',
    'buyer_fee_charged', 'seller_fee_deducted',
    'tax_quoted', 'tax_collected', 'tax_voided', 'tax_refunded',
    'trade_cancelled', 'trade_completed'
  )),
  entity_type    TEXT,           -- 'trade' | 'refund' | 'payment' | 'payout' | 'wallet' | 'listing' | ...
  entity_id      UUID,
  actor_id       UUID,           -- auth.users.id; NULL for cron/system events
  before_state   JSONB DEFAULT '{}'::jsonb,
  after_state    JSONB DEFAULT '{}'::jsonb,
  amount_cents   INTEGER,        -- signed: + credit, - debit (SP/fees in same unit)
  idempotency_key TEXT UNIQUE,   -- N2: retried mutation with the same key -> no double-log
  node_id        UUID REFERENCES public.nodes(id) ON DELETE SET NULL, -- N6
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_log_entity_id ON public.financial_audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_log_actor_id ON public.financial_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_log_created_at ON public.financial_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_audit_log_node_id ON public.financial_audit_log(node_id);

-- RLS: append-only journal — authenticated users read their own rows (actor),
-- service role reads/writes all (used by EFs + admin portal).
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_audit_log_select_own" ON public.financial_audit_log;
CREATE POLICY "financial_audit_log_select_own"
  ON public.financial_audit_log FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

DROP POLICY IF EXISTS "financial_audit_log_service_role" ON public.financial_audit_log;
CREATE POLICY "financial_audit_log_service_role"
  ON public.financial_audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- 2. fn_log_financial_audit() — idempotent audit writer (best-effort, non-blocking)
--    SECURITY DEFINER: EFs call this via service-role RPC; the function guarantees
--    the ON CONFLICT dedupe so a retry with the same key never double-logs.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_log_financial_audit(
  p_mutation_type  TEXT,
  p_entity_type    TEXT,
  p_entity_id      UUID,
  p_actor_id       UUID DEFAULT NULL,
  p_before_state   JSONB DEFAULT NULL,
  p_after_state    JSONB DEFAULT NULL,
  p_amount_cents   INTEGER DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_node_id        UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted BOOLEAN;
BEGIN
  INSERT INTO public.financial_audit_log (
    mutation_type, entity_type, entity_id, actor_id,
    before_state, after_state, amount_cents,
    idempotency_key, node_id
  )
  VALUES (
    p_mutation_type, p_entity_type, p_entity_id, p_actor_id,
    COALESCE(p_before_state, '{}'::jsonb), COALESCE(p_after_state, '{}'::jsonb),
    p_amount_cents, p_idempotency_key, p_node_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING true INTO v_inserted;

  RETURN COALESCE(v_inserted, false);
END;
$$;

-- Fill node_id from the referenced entity when the caller did not provide it
-- (defense-in-depth mirror of the N6 fill-only-when-NULL pattern).
CREATE OR REPLACE FUNCTION public.fn_fill_financial_audit_node_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_node uuid;
BEGIN
  IF NEW.node_id IS NOT NULL OR NEW.entity_id IS NULL OR NEW.entity_type IS NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.entity_type
    WHEN 'trade' THEN
      SELECT t.node_id INTO v_node FROM public.trades t WHERE t.id = NEW.entity_id;
    WHEN 'refund' THEN
      SELECT r.node_id INTO v_node FROM public.trade_refunds r WHERE r.id = NEW.entity_id;
    WHEN 'payment' THEN
      SELECT p.node_id INTO v_node FROM public.payments p WHERE p.id = NEW.entity_id;
    WHEN 'payout' THEN
      SELECT sp.node_id INTO v_node FROM public.seller_payouts sp WHERE sp.id = NEW.entity_id;
    WHEN 'wallet' THEN
      SELECT w.node_id INTO v_node FROM public.sp_wallets w WHERE w.id = NEW.entity_id;
    WHEN 'listing' THEN
      SELECT i.node_id INTO v_node FROM public.items i WHERE i.id = NEW.entity_id;
    ELSE
      v_node := NULL;
  END CASE;

  NEW.node_id := v_node;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_financial_audit_node_id ON public.financial_audit_log;
CREATE TRIGGER trg_fill_financial_audit_node_id
BEFORE INSERT ON public.financial_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.fn_fill_financial_audit_node_id();

-- =============================================================================
-- 3. Unique guard: trades.stripe_payment_intent_id (one PI per trade)
-- =============================================================================
DROP INDEX IF EXISTS idx_trades_stripe_payment_intent_id;
CREATE UNIQUE INDEX idx_trades_stripe_payment_intent_id
  ON public.trades (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- =============================================================================
-- 4. Unique guard: trade_refunds.stripe_refund_id (no double refund per Stripe id)
-- =============================================================================
DROP INDEX IF EXISTS idx_trade_refunds_stripe_refund_id;
CREATE UNIQUE INDEX idx_trade_refunds_stripe_refund_id
  ON public.trade_refunds (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

-- =============================================================================
-- 5. debit_sp_for_trade — idempotent (N2 R4)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.debit_sp_for_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_ledger_id UUID;
  v_idempotency_key TEXT;
  v_existing UUID;
BEGIN
  -- N2: deterministic key per trade. A retried call returns the original entry
  -- instead of double-debiting the wallet.
  v_idempotency_key := 'sp_debit_' || p_trade_id::text;

  SELECT l.id INTO v_existing
  FROM public.sp_ledger l
  WHERE l.idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'ledger_entry_id', v_existing,
      'note', 'SP debit already applied for this trade'
    );
  END IF;

  -- 1. Get wallet and current balance
  SELECT w.id, w.available_balance INTO v_wallet_id, v_balance_before
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'SP wallet not found';
  END IF;

  IF v_balance_before < p_points THEN
    RAISE EXCEPTION 'Insufficient SP balance';
  END IF;

  -- 2. Update wallet balance
  UPDATE public.sp_wallets w
  SET
    available_balance = w.available_balance - p_points,
    lifetime_spent = w.lifetime_spent + p_points,
    updated_at = NOW()
  WHERE w.id = v_wallet_id;

  v_balance_after := v_balance_before - p_points;

  -- 3. Create ledger entry (idempotency-keyed)
  INSERT INTO public.sp_ledger (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after, description,
    related_transaction_id, idempotency_key
  )
  VALUES (
    v_wallet_id, p_user_id, 'spend_purchase', -p_points,
    v_balance_before, v_balance_after,
    'Swap Points used for trade ' || p_trade_id,
    p_trade_id, v_idempotency_key
  )
  RETURNING id INTO v_ledger_id;

  -- 4. N2 audit (best-effort; same key -> no double-log)
  PERFORM public.fn_log_financial_audit(
    'sp_reserved', 'trade', p_trade_id, p_user_id,
    jsonb_build_object('available_balance', v_balance_before),
    jsonb_build_object('available_balance', v_balance_after),
    -p_points, v_idempotency_key, NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'ledger_entry_id', v_ledger_id,
    'balance_after', v_balance_after
  );
END;
$$;

-- =============================================================================
-- 6. credit_sp_for_cancelled_trade — idempotent (N2 R4)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.credit_sp_for_cancelled_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_ledger_id UUID;
  v_idempotency_key TEXT;
  v_existing UUID;
BEGIN
  -- N2: deterministic key per trade. A retried cancel must not double-refund.
  v_idempotency_key := 'sp_refund_' || p_trade_id::text;

  SELECT l.id INTO v_existing
  FROM public.sp_ledger l
  WHERE l.idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'ledger_entry_id', v_existing,
      'note', 'SP refund already applied for this trade'
    );
  END IF;

  -- 1. Get wallet and current balance
  SELECT w.id, w.available_balance INTO v_wallet_id, v_balance_before
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'SP wallet not found';
  END IF;

  -- 2. Update wallet balance
  UPDATE public.sp_wallets w
  SET
    available_balance = w.available_balance + p_points,
    lifetime_spent = GREATEST(0, w.lifetime_spent - p_points),
    updated_at = NOW()
  WHERE w.id = v_wallet_id;

  v_balance_after := v_balance_before + p_points;

  -- 3. Create ledger entry (idempotency-keyed)
  INSERT INTO public.sp_ledger (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after, description,
    related_transaction_id, idempotency_key
  )
  VALUES (
    v_wallet_id, p_user_id, 'earn_refund', p_points,
    v_balance_before, v_balance_after,
    'Swap Points refunded for cancelled trade ' || p_trade_id,
    p_trade_id, v_idempotency_key
  )
  RETURNING id INTO v_ledger_id;

  -- 4. N2 audit (best-effort; same key -> no double-log)
  PERFORM public.fn_log_financial_audit(
    'sp_restored', 'trade', p_trade_id, p_user_id,
    jsonb_build_object('available_balance', v_balance_before),
    jsonb_build_object('available_balance', v_balance_after),
    p_points, v_idempotency_key, NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'ledger_entry_id', v_ledger_id,
    'balance_after', v_balance_after
  );
END;
$$;

-- =============================================================================
-- 7. admin_adjust_sp_wallet — optional p_idempotency_key + deterministic fallback
--    (N2 R5). Signature is backward compatible: existing 5-arg callers still work
--    (new 6th arg has a DEFAULT). We DROP BOTH overloads first so exactly one
--    (the idempotent 6-arg) version exists after a fresh `supabase db reset`.
-- =============================================================================
DROP FUNCTION IF EXISTS public.admin_adjust_sp_wallet(p_user_id UUID, p_amount INTEGER, p_reason TEXT, p_admin_notes TEXT, p_actor_id UUID);
DROP FUNCTION IF EXISTS public.admin_adjust_sp_wallet(p_user_id UUID, p_amount INTEGER, p_reason TEXT, p_admin_notes TEXT, p_actor_id UUID, p_idempotency_key TEXT);
CREATE OR REPLACE FUNCTION public.admin_adjust_sp_wallet(
  p_user_id      UUID,
  p_amount       INTEGER,   -- positive = add, negative = deduct
  p_reason       TEXT,      -- mandatory reason for adjustment
  p_admin_notes  TEXT DEFAULT NULL,
  p_actor_id     UUID DEFAULT NULL,          -- admin's auth.users.id
  p_idempotency_key TEXT DEFAULT NULL        -- N2: caller-supplied stable token
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id       UUID;
  v_balance_before  INTEGER;
  v_balance_after   INTEGER;
  v_tx_type         TEXT;
  v_ledger_id       UUID;
  v_idempotency_key TEXT;
  v_existing        UUID;
  v_node_id         UUID;
BEGIN
  -- Validate inputs
  IF p_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount cannot be zero');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is mandatory for SP adjustments');
  END IF;

  -- Get wallet (+ node for N6 audit tagging)
  SELECT w.id, w.available_balance, w.node_id
    INTO v_wallet_id, v_balance_before, v_node_id
    FROM public.sp_wallets w
   WHERE w.user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP wallet not found for user');
  END IF;

  -- N2: idempotency key. Caller-provided when available; otherwise derive a
  -- deterministic key per (wallet, amount, actor, minute) so a same-second
  -- double-click of the SAME adjustment cannot double-credit. Distinct amounts,
  -- times, or actors produce distinct keys.
  v_idempotency_key := COALESCE(
    p_idempotency_key,
    'admin_adj_' || v_wallet_id::text || '_' || p_amount::text || '_'
      || COALESCE(p_actor_id::text, 'sys') || '_'
      || to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI')
  );

  SELECT l.id INTO v_existing
  FROM public.sp_ledger l
  WHERE l.idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'wallet_id', v_wallet_id,
      'ledger_entry_id', v_existing,
      'note', 'SP adjustment already applied (idempotent replay)'
    );
  END IF;

  -- Check negative-balance prevention
  IF p_amount < 0 AND (v_balance_before + p_amount) < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Insufficient balance: cannot deduct ' || ABS(p_amount) || ' SP (current: ' || v_balance_before || ')'
    );
  END IF;

  -- Determine transaction type and lifetime counters
  IF p_amount > 0 THEN
    v_tx_type := 'earn_admin_grant';
  ELSE
    v_tx_type := 'admin_deduct';
  END IF;

  v_balance_after := v_balance_before + p_amount;

  -- Update wallet atomically
  UPDATE public.sp_wallets
     SET available_balance  = v_balance_after,
         lifetime_earned    = CASE WHEN p_amount > 0 THEN lifetime_earned + p_amount ELSE lifetime_earned END,
         lifetime_spent     = CASE WHEN p_amount < 0 THEN lifetime_spent + ABS(p_amount) ELSE lifetime_spent END,
         last_activity_at   = NOW(),
         updated_at         = NOW()
   WHERE id = v_wallet_id;

  -- Create ledger entry (idempotency-keyed)
  INSERT INTO public.sp_ledger (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after, description,
    admin_id, admin_note, idempotency_key, metadata
  ) VALUES (
    v_wallet_id, p_user_id, v_tx_type, p_amount,
    v_balance_before, v_balance_after,
    COALESCE(p_reason, 'Admin adjustment'),
    p_actor_id, p_admin_notes, v_idempotency_key,
    jsonb_build_object(
      'adjustment_reason', p_reason,
      'admin_notes',       p_admin_notes,
      'actor_id',          p_actor_id
    )
  )
  RETURNING id INTO v_ledger_id;

  -- N2 audit (best-effort; same key -> no double-log)
  PERFORM public.fn_log_financial_audit(
    CASE WHEN p_amount > 0 THEN 'sp_issued' ELSE 'sp_deducted' END,
    'wallet', v_wallet_id, p_actor_id,
    jsonb_build_object('available_balance', v_balance_before),
    jsonb_build_object('available_balance', v_balance_after),
    p_amount, v_idempotency_key, v_node_id
  );

  -- Existing admin audit trail (kept — N2 journal is additive, not a replacement)
  INSERT INTO public.admin_audit_logs (
    actor_id, action_type, entity_type, entity_id, reason, payload
  ) VALUES (
    p_actor_id, 'sp_adjustment', 'sp_wallet', v_wallet_id::TEXT, p_reason,
    jsonb_build_object(
      'user_id',        p_user_id,
      'amount',         p_amount,
      'balance_before', v_balance_before,
      'balance_after',  v_balance_after,
      'ledger_id',      v_ledger_id
    )
  );

  RETURN jsonb_build_object(
    'success',         true,
    'wallet_id',       v_wallet_id,
    'new_balance',     v_balance_after,
    'ledger_entry_id', v_ledger_id
  );
END;
$$;

-- =============================================================================
-- VERIFICATION BLOCK (run separately after applying — see SQL-4)
-- =============================================================================
-- 1. Table + RLS:
--    SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='financial_audit_log';
--    SELECT policyname, cmd FROM pg_policies WHERE tablename='financial_audit_log';
-- 2. Helper + trigger:
--    SELECT proname FROM pg_proc WHERE proname IN ('fn_log_financial_audit','fn_fill_financial_audit_node_id');
--    SELECT trigger_name FROM information_schema.triggers WHERE event_object_table='financial_audit_log';
-- 3. Unique guards:
--    SELECT indexname FROM pg_indexes WHERE tablename IN ('trades','trade_refunds')
--      AND indexname IN ('idx_trades_stripe_payment_intent_id','idx_trade_refunds_stripe_refund_id');
-- 4. Idempotency: call twice, expect 1 ledger row:
--    SELECT public.debit_sp_for_trade('<user>','<trade>',1);  -- run twice
--    SELECT count(*) FROM sp_ledger WHERE idempotency_key='sp_debit_<trade>';
-- 5. No double-log:
--    SELECT public.fn_log_financial_audit('sp_reserved','trade','<uuid>',NULL,'{}','{}',-1,'k1',NULL); -- run twice -> 1 row
--    SELECT count(*) FROM financial_audit_log WHERE idempotency_key='k1';
