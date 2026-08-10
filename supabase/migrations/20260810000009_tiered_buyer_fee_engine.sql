-- ============================================================================
-- R1 — Tiered Buyer-Fee Engine (first-trade protection)
-- Mode B: Idempotent rerunnable migration
--
-- WHAT THIS DOES (owner summary):
--   Replaces the single flat buyer fee ($0.99/$2.99) with a TIERED engine:
--     1. Active members (trial or active)      -> flat "Safety & Platform Fee" ($1.49 default)
--     2. Free users with NO completed trade    -> flat $1.49 on their first trade
--     3. Free users with 1+ completed trades   -> 5% of the cash portion + $1.99, capped at $4.99
--   The fee is computed SERVER-SIDE at checkout from a stored buyer fee-state.
--   First-trade eligibility is a STATE (not a counter): it is consumed ONLY when
--   a trade is successfully captured AND completed (status -> 'completed'); it is
--   NOT consumed on cancel / timeout / failed capture / refund. All fee amounts
--   are DYNAMIC from admin_config (fees category) — the numbers here are seeds only.
--
-- FEE-STATE MACHINE (stored on profiles.fee_state):
--   no_completed_trade -> first_trade_in_progress -> first_trade_completed
--                        -> subsequent_free -> active_member
--   - no_completed_trade / first_trade_in_progress -> flat first-trade fee
--   - first_trade_completed (exactly 1) / subsequent_free (2+) -> percentage fee
--   - active_member (subscription trial|active) -> flat active-member fee
--
-- CONSUMPTION RULE (strictly completion-event driven, never elapsed time):
--   profiles.completed_trade_count increments ONLY on trades.status -> 'completed'.
--   A full refund of the trade that consumed first-trade eligibility decrements
--   the counter and restores eligibility (owner decision, 2026-08-09).
--
-- BLOCKS:
--   BLOCK 1: schema (columns + constraints + backfill)
--   BLOCK 2: config seeds + RPCs + triggers
--   BLOCK 3: verification queries
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1a: columns (additive — old rows get defaults, then backfilled)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fee_state TEXT DEFAULT 'no_completed_trade',
  ADD COLUMN IF NOT EXISTS completed_trade_count INTEGER DEFAULT 0;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS buyer_fee_state TEXT,                          -- snapshot of buyer's tier at offer time
  ADD COLUMN IF NOT EXISTS consumed_first_trade_eligibility BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- BLOCK 1b: constraints (HP-4 — state must be a closed set, counts non-negative)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_fee_state_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_fee_state_check CHECK (
      fee_state IN ('no_completed_trade','first_trade_in_progress','first_trade_completed','subsequent_free','active_member')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_completed_trade_count_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_completed_trade_count_check CHECK (completed_trade_count >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_buyer_fee_state_check') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_buyer_fee_state_check CHECK (
      buyer_fee_state IS NULL OR buyer_fee_state IN
        ('no_completed_trade','first_trade_in_progress','first_trade_completed','subsequent_free','active_member')
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- BLOCK 1c: backfill existing rows (count + state), best-effort snapshots
-- ---------------------------------------------------------------------------
UPDATE public.profiles p
SET completed_trade_count = (
  SELECT COUNT(*) FROM public.trades t
  WHERE t.buyer_id = p.user_id AND t.status = 'completed'
);

UPDATE public.profiles p
SET fee_state = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p.user_id AND s.status IN ('trial','active')
  ) THEN 'active_member'
  WHEN p.completed_trade_count >= 2 THEN 'subsequent_free'
  WHEN p.completed_trade_count = 1 THEN 'first_trade_completed'
  WHEN EXISTS (
    SELECT 1 FROM public.trades t
    WHERE t.buyer_id = p.user_id
      AND t.status IN ('pending','payment_processing','payment_failed','in_progress')
  ) THEN 'first_trade_in_progress'
  ELSE 'no_completed_trade'
END;

UPDATE public.trades t
SET buyer_fee_state = p.fee_state
FROM public.profiles p
WHERE t.buyer_id = p.user_id AND t.buyer_fee_state IS NULL;

-- ---------------------------------------------------------------------------
-- BLOCK 2a: seed tiered buyer-fee config keys (fees category)
--           ON CONFLICT DO NOTHING preserves admin edits across replays.
--           These are SEED DEFAULTS (examples) — admin can change any of them.
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES
  ('buyer_fee_active_member_cents','149','Flat Safety & Platform Fee (cents) charged to active members (trial or active). Tiered Buyer-Fee Engine (R1).','fees','number',true),
  ('buyer_fee_first_trade_cents','149','Flat Safety & Platform Fee (cents) charged to free users on their first trade (first-trade protection). Consumed only on successful capture + completion. Tiered Buyer-Fee Engine (R1).','fees','number',true),
  ('buyer_fee_subsequent_percentage','5.0','Percentage fee (% of the cash portion) charged to free users with 1+ completed trades. Applies ONLY to the cash portion — never to Swap-Points-covered amounts. Tiered Buyer-Fee Engine (R1).','fees','number',true),
  ('buyer_fee_subsequent_fixed_cents','199','Fixed fee component (cents) for free users with 1+ completed trades. Tiered Buyer-Fee Engine (R1).','fees','number',true),
  ('buyer_fee_subsequent_max_cents','499','Maximum total buyer fee (cents) for free users with 1+ completed trades. Cap applies to the TOTAL (fixed + percentage). Tiered Buyer-Fee Engine (R1).','fees','number',true),
  ('buyer_fee_label','Safety & Platform Fee','Display label for the buyer fee line on checkout / order summary. Tiered Buyer-Fee Engine (R1).','fees','string',true)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- BLOCK 2b: fn_get_buyer_fee_for_checkout — authoritative fee resolver
--   Returns the buyer's current fee-state + the exact fee cents for a checkout.
--   Both the mobile app (display) and create-trade-offer (authoritative charge)
--   call this SAME function, so preview and charge always agree.
--   SECURITY DEFINER: bypasses user-scoped RLS on profiles/subscriptions/admin_config.
--   Fail-loud (BP-28): if a required config key is missing, fee_cents is NULL so
--   the Edge Function returns CONFIG_UNAVAILABLE instead of silently charging $0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_buyer_fee_for_checkout(
  p_user_id UUID,
  p_cash_portion_cents INTEGER DEFAULT 0
)
RETURNS TABLE (
  fee_state TEXT,
  fee_cents INTEGER,
  label TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_fee_state TEXT;
  v_active_member_cents INTEGER;
  v_first_trade_cents INTEGER;
  v_subsequent_pct NUMERIC;
  v_subsequent_fixed_cents INTEGER;
  v_subsequent_max_cents INTEGER;
  v_label TEXT;
  v_pct_cents INTEGER;
  v_fee INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT 'no_completed_trade'::TEXT, 0::INTEGER, 'Safety & Platform Fee'::TEXT;
    RETURN;
  END IF;

  -- 1. Active member? (trial or active ONLY — owner decision 2026-08-09)
  SELECT s.status INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id AND s.status IN ('trial','active')
  ORDER BY s.updated_at DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    v_fee_state := 'active_member';
  ELSE
    -- 2. Free user — use the stored fee-state (trigger-maintained, backfilled).
    SELECT COALESCE(p.fee_state, 'no_completed_trade') INTO v_fee_state
    FROM public.profiles p
    WHERE p.user_id = p_user_id;
    IF v_fee_state IS NULL THEN
      v_fee_state := 'no_completed_trade';
    END IF;
  END IF;

  -- 3. Read dynamic config (NULL when a required key is missing -> fail loud).
  v_active_member_cents   := public.fn_admin_config_int('buyer_fee_active_member_cents', NULL);
  v_first_trade_cents     := public.fn_admin_config_int('buyer_fee_first_trade_cents', NULL);
  v_subsequent_pct        := NULLIF((SELECT ac.value::NUMERIC FROM public.admin_config ac WHERE ac.key = 'buyer_fee_subsequent_percentage' AND ac.is_active = TRUE LIMIT 1), NULL);
  v_subsequent_fixed_cents:= public.fn_admin_config_int('buyer_fee_subsequent_fixed_cents', NULL);
  v_subsequent_max_cents  := public.fn_admin_config_int('buyer_fee_subsequent_max_cents', NULL);
  v_label := COALESCE(
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'buyer_fee_label' AND ac.is_active = TRUE LIMIT 1),
    'Safety & Platform Fee'
  );

  -- 4. Resolve fee.
  IF v_fee_state = 'active_member' THEN
    v_fee := v_active_member_cents;
  ELSIF v_fee_state IN ('no_completed_trade','first_trade_in_progress') THEN
    v_fee := v_first_trade_cents;
  ELSE
    -- Percentage tier: min(fixed + round(pct% * cash_portion), max)
    v_pct_cents := 0;
    IF COALESCE(p_cash_portion_cents, 0) > 0 AND v_subsequent_pct IS NOT NULL THEN
      v_pct_cents := ROUND(p_cash_portion_cents * v_subsequent_pct / 100.0)::INTEGER;
    END IF;
    IF v_subsequent_fixed_cents IS NULL THEN
      v_fee := NULL; -- fail loud: fixed component missing
    ELSE
      v_fee := v_subsequent_fixed_cents + v_pct_cents;
      IF v_subsequent_max_cents IS NOT NULL THEN
        v_fee := LEAST(v_fee, v_subsequent_max_cents);
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_fee_state, v_fee, v_label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_buyer_fee_for_checkout(UUID, INTEGER) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.fn_get_buyer_fee_for_checkout IS
  'R1: Returns the buyer fee-state + fee cents for a checkout. Server-authoritative; used by create-trade-offer and the mobile order summary. Config keys read from admin_config (fees). fee_cents is NULL when required config is missing (fail-loud, BP-28).';

-- ---------------------------------------------------------------------------
-- BLOCK 2c: fn_recompute_buyer_fee_state — single source of truth for the
--           fee-state after any trade/subscription change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_recompute_buyer_fee_state(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_count INTEGER;
  v_has_active_trade BOOLEAN;
  v_new_state TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT s.status INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id AND s.status IN ('trial','active')
  LIMIT 1;

  SELECT COALESCE(p.completed_trade_count, 0) INTO v_count
  FROM public.profiles p
  WHERE p.user_id = p_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.trades t
    WHERE t.buyer_id = p_user_id
      AND t.status IN ('pending','payment_processing','payment_failed','in_progress')
  ) INTO v_has_active_trade;

  IF v_status IS NOT NULL THEN
    v_new_state := 'active_member';
  ELSIF v_count >= 2 THEN
    v_new_state := 'subsequent_free';
  ELSIF v_count = 1 THEN
    v_new_state := 'first_trade_completed';
  ELSIF v_has_active_trade THEN
    v_new_state := 'first_trade_in_progress';
  ELSE
    v_new_state := 'no_completed_trade';
  END IF;

  UPDATE public.profiles
  SET fee_state = v_new_state
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_recompute_buyer_fee_state(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- BLOCK 2d: trigger on trades — increment completed count on completion,
--           recompute fee-state on every status change (offer/cancel/timeout/
--           payment-failed all flow through recompute).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_buyer_fee_state_on_trade()
RETURNS TRIGGER AS $$
DECLARE
  v_old_count INTEGER;
BEGIN
  -- Completion (status -> 'completed') increments the counter ONCE, and only on
  -- the actual transition (guards against UPDATEs that keep status = 'completed').
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT COALESCE(p.completed_trade_count, 0) INTO v_old_count
    FROM public.profiles p
    WHERE p.user_id = NEW.buyer_id;

    UPDATE public.profiles p
    SET completed_trade_count = p.completed_trade_count + 1
    WHERE p.user_id = NEW.buyer_id;

    -- First completion consumes first-trade eligibility -> mark this trade so a
    -- full refund can restore eligibility precisely (see refund trigger below).
    IF v_old_count = 0 THEN
      UPDATE public.trades t
      SET consumed_first_trade_eligibility = TRUE
      WHERE t.id = NEW.id;
    END IF;
  END IF;

  PERFORM public.fn_recompute_buyer_fee_state(NEW.buyer_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- BP-4: never bare-catch; log to debug_logs, warn, but do NOT fail the trade op.
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('fn_sync_buyer_fee_state_on_trade', 'ERROR', jsonb_build_object(
      'trade_id', NEW.id, 'buyer_id', NEW.buyer_id, 'status', NEW.status,
      'error', SQLERRM, 'state', SQLSTATE));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE WARNING 'buyer fee-state sync failed for trade %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_buyer_fee_state_on_trade ON public.trades;
CREATE TRIGGER trg_sync_buyer_fee_state_on_trade
  AFTER INSERT OR UPDATE OF status ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_buyer_fee_state_on_trade();

-- ---------------------------------------------------------------------------
-- BLOCK 2e: trigger on subscriptions — entering/leaving trial|active flips
--           between active_member and the free fee-state.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_buyer_fee_state_on_subscription()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.fn_recompute_buyer_fee_state(NEW.user_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('fn_sync_buyer_fee_state_on_subscription', 'ERROR', jsonb_build_object(
      'user_id', NEW.user_id, 'status', NEW.status, 'error', SQLERRM, 'state', SQLSTATE));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE WARNING 'buyer fee-state sync failed for subscription %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_buyer_fee_state_on_subscription ON public.subscriptions;
CREATE TRIGGER trg_sync_buyer_fee_state_on_subscription
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_buyer_fee_state_on_subscription();

-- ---------------------------------------------------------------------------
-- BLOCK 2f: trigger on trade_refunds — a FULL refund of the trade that consumed
--           first-trade eligibility RESTORES it (decrement + recompute).
--           Partial refunds never restore eligibility.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_restore_first_trade_eligibility_on_full_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_trade RECORD;
  v_total_refunded INTEGER;
  v_collected INTEGER;
BEGIN
  SELECT t.id, t.buyer_id, t.consumed_first_trade_eligibility,
         COALESCE(t.cash_amount_cents,0) + COALESCE(t.buyer_transaction_fee_cents,0) + COALESCE(t.tax_amount_cents,0) AS collected
  INTO v_trade
  FROM public.trades t
  WHERE t.id = NEW.trade_id;

  IF v_trade IS NULL OR NOT v_trade.consumed_first_trade_eligibility THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(tr.refund_amount_cents), 0) INTO v_total_refunded
  FROM public.trade_refunds tr
  WHERE tr.trade_id = NEW.trade_id AND tr.status = 'succeeded';

  -- Full refund: every collected cent (price + fee + tax) returned.
  IF v_trade.collected > 0 AND v_total_refunded >= v_trade.collected THEN
    UPDATE public.profiles p
    SET completed_trade_count = GREATEST(p.completed_trade_count - 1, 0)
    WHERE p.user_id = v_trade.buyer_id;

    PERFORM public.fn_recompute_buyer_fee_state(v_trade.buyer_id);

    UPDATE public.trades t
    SET consumed_first_trade_eligibility = FALSE
    WHERE t.id = NEW.trade_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('fn_restore_first_trade_eligibility_on_full_refund', 'ERROR', jsonb_build_object(
      'trade_id', NEW.trade_id, 'error', SQLERRM, 'state', SQLSTATE));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE WARNING 'first-trade eligibility restore failed for trade %: %', NEW.trade_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_restore_first_trade_eligibility_on_full_refund ON public.trade_refunds;
CREATE TRIGGER trg_restore_first_trade_eligibility_on_full_refund
  AFTER INSERT ON public.trade_refunds
  FOR EACH ROW EXECUTE FUNCTION public.fn_restore_first_trade_eligibility_on_full_refund();

-- ---------------------------------------------------------------------------
-- BLOCK 2g: fn_admin_get_fee_tier_stats — admin stats: how many users are in
--           each fee tier (flat vs percentage). Used by the Trade Timing page
--           and the Analytics page (fee-tier distribution).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_get_fee_tier_stats()
RETURNS TABLE (
  fee_state TEXT,
  user_count BIGINT,
  fee_tier TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.fee_state AS fee_state,
    COUNT(*)::BIGINT AS user_count,
    CASE
      WHEN p.fee_state IN ('active_member','no_completed_trade','first_trade_in_progress') THEN 'flat'
      WHEN p.fee_state IN ('first_trade_completed','subsequent_free') THEN 'percentage'
      ELSE 'unknown'
    END AS fee_tier
  FROM public.profiles p
  WHERE p.user_id IS NOT NULL AND p.fee_state IS NOT NULL
  GROUP BY p.fee_state
  ORDER BY user_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_get_fee_tier_stats() TO service_role;

-- ============================================================================
-- BLOCK 3: VERIFICATION (run one statement at a time — result-granularity rule)
--
-- 1) Columns exist:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name IN ('profiles','trades') AND column_name IN
--      ('fee_state','completed_trade_count','buyer_fee_state','consumed_first_trade_eligibility')
--    ORDER BY column_name;
--
-- 2) New config keys seeded:
--    SELECT key, value, category, data_type FROM public.admin_config
--    WHERE key LIKE 'buyer_fee_%' ORDER BY key;
--    -- Expected: 6 rows (active_member_cents, first_trade_cents, label,
--    --            subsequent_fixed_cents, subsequent_max_cents, subsequent_percentage)
--
-- 3) Fee resolver — active member (subscriber) should return flat active-member cents:
--    SELECT * FROM public.fn_get_buyer_fee_for_checkout('<SUBSCRIBER_UUID>'::uuid, 5000);
--    -- Expected: fee_state='active_member', fee_cents=149
--
-- 4) Fee resolver — percentage tier:
--    SELECT * FROM public.fn_get_buyer_fee_for_checkout('<FREE_1PLUS_UUID>'::uuid, 5000);
--    -- Expected: fee_state='first_trade_completed'|'subsequent_free',
--    --           fee_cents = min(199 + round(5000*5/100), 499) = 449
--
-- 5) Fee resolver — first-trade flat:
--    SELECT * FROM public.fn_get_buyer_fee_for_checkout('<FREE_0_UUID>'::uuid, 5000);
--    -- Expected: fee_state='no_completed_trade'|'first_trade_in_progress', fee_cents=149
--
-- 6) Admin stats:
--    SELECT * FROM public.fn_admin_get_fee_tier_stats();
--    -- Expected: one row per fee_state with a user count + flat/percentage tier
--
-- 7) Trigger + counter (state-machine smoke):
--    -- Insert a trade with status='pending' for a free buyer -> fee_state becomes 'first_trade_in_progress'
--    -- Update that trade to 'completed' -> completed_trade_count = 1, fee_state = 'first_trade_completed'
--    -- Update it to 'cancelled' (or insert a full refund) -> see consumption/restore rules
-- ============================================================================
