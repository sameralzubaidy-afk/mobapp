-- ============================================================================
-- Migration: 20260810000008_r3_delayed_payout_buffer
-- Mode B: Idempotent rerunnable migration
--
-- R3 — Delayed Seller Payout + Buffer (enforcement)
--
-- WHAT THIS DOES (owner summary):
--   The `payout_buffer_days` admin config key (seeded by 20260809000004,
--   default 2, range 0–30, admin-tunable at /settings/trade-timing →
--   Pickup & Payout) was previously "tunable but not enforced". This migration
--   enforces it: when a trade completes, the seller payout is created with a
--   stored `payout_release_at` computed from the ACTUAL completion timestamp
--   (`trades.completed_at`) + the buffer value in effect at completion. Funds
--   sit in `seller_balance.pending_balance_cents` until release, the payout
--   dispatch (trigger) is gated until `payout_release_at` passes, and a new
--   cron `release-due-payouts` (→ Edge Function → `rpc_release_due_payouts`)
--   dispatches due payouts to the existing `initiate-payout` flow.
--
--   Keying off `trades.completed_at` (not the expected `auto_complete_at`
--   window) means a trade completed later — e.g. via a granted extension —
--   naturally produces a correspondingly later release date with NO
--   special-case logic.
--
-- Spec: docx/SYSTEM_REQUIREMENTS_V2.md §1.6 (N1, payout buffer row) + §7.3/7.5
--       docx/BUSINESS_REQUIREMENTS_DOCUMENT_V2.md §6.8 N1-002(3) + §6.9
--       docx/TRADING-FLOW-V2.md §6.3
--
-- Backward compatible: ✅ additive — new nullable columns + backfill; existing
--   completed payouts are backfilled to release immediately (no retroactive
--   delay); buffer 0 preserves today's instant-payout behavior.
-- ============================================================================

-- ============================================================================
-- BLOCK 1 — Schema (additive, SQL-8)
-- ============================================================================

ALTER TABLE public.seller_payouts ADD COLUMN IF NOT EXISTS payout_release_at TIMESTAMPTZ;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS payout_release_at TIMESTAMPTZ;

-- Backfill existing completed trades + their pending payouts to release
-- immediately (backward compatible: no retroactive buffer on prior sales).
UPDATE public.trades t
SET payout_release_at = COALESCE(t.completed_at, t.updated_at, now())
WHERE t.status = 'completed'
  AND t.payout_release_at IS NULL;

UPDATE public.seller_payouts sp
SET payout_release_at = COALESCE(
  (SELECT t.completed_at FROM public.trades t WHERE t.id = sp.trade_id),
  sp.created_at,
  now()
)
WHERE sp.payout_release_at IS NULL;

-- Add 'payout_scheduled' to the financial audit mutation_type CHECK so
-- initiate-payout can audit a deferred (buffered) payout. Rerunnable.
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.financial_audit_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%mutation_type%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.financial_audit_log DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE public.financial_audit_log ADD CONSTRAINT financial_audit_log_mutation_type_check
    CHECK (mutation_type IN (
      'offer_created', 'payment_intent_created', 'payment_captured',
      'payment_capture_failed', 'payment_cancelled', 'refund_issued',
      'refund_voided', 'payout_initiated', 'payout_paid',
      'payout_requires_action', 'payout_failed', 'payout_scheduled',
      'sp_reserved', 'sp_restored', 'sp_released', 'sp_issued',
      'sp_deducted', 'sp_frozen', 'sp_unfrozen', 'sp_expired',
      'buyer_fee_charged', 'seller_fee_deducted',
      'tax_quoted', 'tax_collected', 'tax_voided', 'tax_refunded',
      'trade_cancelled', 'trade_completed'
    ));
END;
$$;

-- ============================================================================
-- BLOCK 2 — create_seller_payout_on_trade_completion: compute + store
--           payout_release_at from ACTUAL completion timestamp + buffer
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_seller_payout_on_trade_completion(
  p_trade_id UUID,
  p_seller_id UUID,
  p_gross_amount_cents INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_config RECORD;
  v_primary_method RECORD;
  v_payout_fee_cents INTEGER;
  v_net_amount_cents INTEGER;
  v_payout_status TEXT;
  v_payout_id UUID;
  v_idempotency_key TEXT;
  v_existing_payout UUID;
  v_buffer_days INTEGER;
  v_completed_at TIMESTAMPTZ;
  v_release_at TIMESTAMPTZ;
BEGIN
  -- Idempotency key: matches spec TRADING-FLOW-V2 §6.3.4 pattern
  v_idempotency_key := 'trade:' || p_trade_id::TEXT || ':seller:' || p_seller_id::TEXT;

  -- R3: resolve the payout release date from the ACTUAL completion timestamp +
  -- the buffer value in effect when the trade completes (N1 payout_buffer_days).
  -- fn_admin_config_int('payout_buffer_days', 0) → 0 (immediate) if missing,
  -- so a missing/invalid key preserves pre-feature behavior (backward compat).
  SELECT t.completed_at INTO v_completed_at
  FROM public.trades t
  WHERE t.id = p_trade_id;

  v_buffer_days := GREATEST(0, LEAST(30, COALESCE(public.fn_admin_config_int('payout_buffer_days', 0), 0)));
  v_release_at := COALESCE(v_completed_at, now()) + make_interval(days => v_buffer_days);

  -- Check existing payout (idempotency)
  SELECT sp.id INTO v_existing_payout
  FROM public.seller_payouts sp
  WHERE sp.idempotency_key = v_idempotency_key;

  IF v_existing_payout IS NOT NULL THEN
    SELECT sp.status INTO v_payout_status
    FROM public.seller_payouts sp
    WHERE sp.id = v_existing_payout;

    RETURN json_build_object(
      'success', true,
      'payout_id', v_existing_payout,
      'status', v_payout_status,
      'payout_release_at', v_release_at,
      'message', 'Payout already exists',
      'is_new', false
    );
  END IF;

  SELECT * INTO v_config FROM public.get_admin_payout_config() LIMIT 1;

  SELECT * INTO v_primary_method
  FROM public.seller_payout_methods
  WHERE user_id = p_seller_id
    AND is_primary = TRUE
    AND is_verified = TRUE
  LIMIT 1;

  -- Determine payout status based on config, method availability, and buffer
  IF NOT v_config.enable_automatic_seller_payout THEN
    -- Manual withdrawal mode: always create pending
    v_payout_status := 'pending';
    v_payout_fee_cents := 0;
    v_net_amount_cents := p_gross_amount_cents;
  ELSIF v_primary_method IS NULL THEN
    -- Auto-payout enabled but no verified method → requires_action (§6.3.3)
    v_payout_status := 'requires_action';
    v_payout_fee_cents := 0;
    v_net_amount_cents := p_gross_amount_cents;
  ELSE
    -- Auto-payout enabled and method available
    v_payout_fee_cents := public.calculate_payout_fee_cents(v_primary_method.method_type, p_gross_amount_cents);
    v_net_amount_cents := GREATEST(0, p_gross_amount_cents - v_payout_fee_cents);
    -- R3: buffered payouts stay 'pending' until the release date; only a
    -- buffer of 0 (release now) dispatches immediately as 'processing'.
    IF v_release_at > now() THEN
      v_payout_status := 'pending';
    ELSE
      v_payout_status := 'processing';
    END IF;
  END IF;

  INSERT INTO public.seller_payouts (
    user_id,
    trade_id,
    payout_method_id,
    currency,
    gross_amount_cents,
    platform_fee_cents,
    payout_fee_cents,
    net_amount_cents,
    status,
    provider,
    idempotency_key,
    initiated_at,
    payout_release_at,
    created_at,
    updated_at
  ) VALUES (
    p_seller_id,
    p_trade_id,
    v_primary_method.id, -- NULL if requires_action or pending
    'usd',
    p_gross_amount_cents,
    0, -- Platform fee is $0 per policy
    v_payout_fee_cents,
    v_net_amount_cents,
    v_payout_status,
    CASE
      WHEN v_primary_method.id IS NOT NULL AND v_primary_method.method_type = 'stripe_connect' THEN 'stripe'
      WHEN v_primary_method.id IS NOT NULL AND v_primary_method.method_type IN ('paypal', 'venmo') THEN 'paypal'
      WHEN v_primary_method.id IS NOT NULL AND v_primary_method.method_type = 'bank_ach' THEN 'ach'
      ELSE NULL
    END,
    v_idempotency_key,
    CASE WHEN v_payout_status = 'processing' THEN now() ELSE NULL END,
    v_release_at,
    now(),
    now()
  ) RETURNING id INTO v_payout_id;

  -- Sync trades.payout_status + release date (§6.3.2)
  UPDATE public.trades
  SET payout_status = v_payout_status,
      payout_idempotency_key = 'payout_' || p_trade_id::TEXT,
      payout_release_at = COALESCE(payout_release_at, v_release_at),
      updated_at = now()
  WHERE id = p_trade_id;

  RETURN json_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'status', v_payout_status,
    'payout_release_at', v_release_at,
    'is_new', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_seller_payout_on_trade_completion(UUID, UUID, INTEGER) TO anon, authenticated;

-- ============================================================================
-- BLOCK 3 — fn_queue_payout_on_complete: gate dispatch until release date
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_queue_payout_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_ef_url TEXT;
  v_auth_jwt TEXT;
  v_buffer_days INTEGER;
  v_release_at TIMESTAMPTZ;
BEGIN
  -- Only queue if no active dispute (D-26 guard) — preserved from prior version
  IF NEW.dispute_status IS DISTINCT FROM 'reported'
    AND NEW.dispute_status IS DISTINCT FROM 'under_review'
  THEN
    -- R3: only dispatch when the payout is due (completed_at + buffer <= now).
    -- NEW.completed_at is set in the SAME UPDATE that flipped status, so this is
    -- ordering-safe. buffer 0 ⇒ due immediately (existing behavior preserved).
    v_buffer_days := GREATEST(0, LEAST(30, COALESCE(public.fn_admin_config_int('payout_buffer_days', 0), 0)));
    v_release_at := COALESCE(NEW.completed_at, now()) + make_interval(days => v_buffer_days);

    IF v_release_at > now() THEN
      RAISE NOTICE 'fn_queue_payout_on_complete: trade % payout deferred until % (buffer % days) — release-due-payouts cron will dispatch',
        NEW.id, v_release_at, v_buffer_days;
      RETURN NEW;
    END IF;

    -- Set idempotency key (only if not already set)
    UPDATE public.trades
    SET payout_idempotency_key = 'payout_' || NEW.id::text
    WHERE id = NEW.id AND payout_idempotency_key IS NULL;

    -- Resolve Edge Function base URL (pattern preserved from 20260707000000)
    v_ef_url := NULLIF(current_setting('app.edge_function_base_url', true), '');
    IF v_ef_url IS NULL THEN
      v_ef_url := NULLIF(current_setting('app.supabase_url', true), '');
      IF v_ef_url IS NOT NULL THEN
        v_ef_url := rtrim(v_ef_url, '/') || '/functions/v1';
      ELSE
        SELECT ac.value INTO v_ef_url
        FROM public.admin_config ac
        WHERE ac.key = 'supabase_url'
          AND ac.is_active = true
        LIMIT 1;

        IF v_ef_url IS NOT NULL THEN
          v_ef_url := rtrim(v_ef_url, '/') || '/functions/v1';
        END IF;
      END IF;
    END IF;

    -- Resolve auth JWT (pattern preserved from 20260707000000)
    v_auth_jwt := NULLIF(current_setting('app.service_role_key', true), '');
    IF v_auth_jwt IS NULL THEN
      SELECT ac.value INTO v_auth_jwt
      FROM public.admin_config ac
      WHERE ac.key = 'supabase_service_role_key'
        AND ac.is_active = true
      LIMIT 1;
    END IF;

    -- Only attempt net.http_post if we have both URL and auth
    IF v_ef_url IS NOT NULL AND v_auth_jwt IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_ef_url || '/initiate-payout',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_auth_jwt
        ),
        body    := jsonb_build_object('trade_id', NEW.id::text)
      );
    ELSE
      RAISE WARNING 'fn_queue_payout_on_complete: Cannot queue payout for trade % — missing URL or auth config. URL set: %, Auth set: %',
        NEW.id, v_ef_url IS NOT NULL, v_auth_jwt IS NOT NULL;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let payout queueing break trade completion
  RAISE WARNING 'fn_queue_payout_on_complete error for trade %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the trigger is correctly re-linked
DROP TRIGGER IF EXISTS trg_queue_payout_on_complete ON trades;
CREATE TRIGGER trg_queue_payout_on_complete
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION public.fn_queue_payout_on_complete();

-- ============================================================================
-- BLOCK 4 — update_seller_balance_on_trade_completion: buffered funds → pending
-- ============================================================================

CREATE OR REPLACE FUNCTION update_seller_balance_on_trade_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seller_proceeds_cents INTEGER;
  v_buffer_days INTEGER;
  v_release_at TIMESTAMPTZ;
  v_pending BOOLEAN;
  v_available_add INTEGER;
  v_pending_add INTEGER;
BEGIN
  -- Ensure stable name resolution under SECURITY DEFINER
  PERFORM set_config('search_path', 'public', true);

  -- Only process when trade moves to 'completed' status
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN

    -- Seller proceeds come from the CASH portion only (unchanged).
    v_seller_proceeds_cents := COALESCE(NEW.cash_amount_cents, 0);

    -- R3: if a payout buffer applies (release date in the future), the proceeds
    -- sit in pending_balance_cents until the release date; the release cron
    -- (rpc_release_due_payouts) moves them to available when due. Buffer 0
    -- preserves the previous immediate-available behavior.
    v_buffer_days := GREATEST(0, LEAST(30, COALESCE(public.fn_admin_config_int('payout_buffer_days', 0), 0)));
    v_release_at := COALESCE(NEW.completed_at, now()) + make_interval(days => v_buffer_days);
    v_pending := v_release_at > now();

    v_available_add := CASE WHEN v_pending THEN 0 ELSE v_seller_proceeds_cents END;
    v_pending_add   := CASE WHEN v_pending THEN v_seller_proceeds_cents ELSE 0 END;

    INSERT INTO seller_balance (
      user_id,
      available_balance_cents,
      pending_balance_cents,
      lifetime_earnings_cents,
      total_trades_completed,
      created_at,
      updated_at
    ) VALUES (
      NEW.seller_id,
      v_available_add,
      v_pending_add,
      v_seller_proceeds_cents,
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      available_balance_cents = seller_balance.available_balance_cents + v_available_add,
      pending_balance_cents = seller_balance.pending_balance_cents + v_pending_add,
      lifetime_earnings_cents = seller_balance.lifetime_earnings_cents + v_seller_proceeds_cents,
      total_trades_completed = seller_balance.total_trades_completed + 1,
      updated_at = NOW();

    RAISE DEBUG 'Updated seller balance for user % with amount % (pending: %)', NEW.seller_id, v_seller_proceeds_cents, v_pending;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-link the balance trigger
DROP TRIGGER IF EXISTS trigger_update_seller_balance_on_completion ON trades;
CREATE TRIGGER trigger_update_seller_balance_on_completion
  AFTER UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_balance_on_trade_completion();

-- ============================================================================
-- BLOCK 5 — rpc_release_due_payouts: move pending→available for due payouts,
--           return the due trade ids for the release-due-payouts EF to dispatch
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
  v_trade_ids uuid[];
  v_rec record;
BEGIN
  -- Select trades whose payout has reached its release date and is not yet
  -- paid/processing (includes admin-retried failed → pending). excludes
  -- requires_action (no verified method — handled by its own notification flow).
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

  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released_count,
    'trade_ids', v_trade_ids,
    'processed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_release_due_payouts(integer) TO service_role;

-- ============================================================================
-- BLOCK 6 — get_admin_payouts: expose payout_release_at (BP-12: DROP first)
-- ============================================================================

-- admin_payouts_view depends on get_admin_payouts; drop it first, then the
-- function (signature change requires DROP + CREATE per BP-12), then recreate
-- the convenience view against the new function.
DROP VIEW IF EXISTS admin_payouts_view CASCADE;
DROP FUNCTION IF EXISTS public.get_admin_payouts(text, text, integer, integer);

CREATE OR REPLACE FUNCTION get_admin_payouts(
  p_status TEXT DEFAULT 'all',
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  trade_id UUID,
  payout_method_id UUID,
  currency TEXT,
  gross_amount_cents INT,
  platform_fee_cents INT,
  payout_fee_cents INT,
  net_amount_cents INT,
  status TEXT,
  provider TEXT,
  provider_reference_id TEXT,
  idempotency_key TEXT,
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  payout_release_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  seller_name TEXT,
  seller_email TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  sp.id,
  sp.user_id,
  sp.trade_id,
  sp.payout_method_id,
  sp.currency,
  sp.gross_amount_cents,
  sp.platform_fee_cents,
  sp.payout_fee_cents,
  sp.net_amount_cents,
  sp.status,
  sp.provider,
  sp.provider_reference_id,
  sp.idempotency_key,
  sp.initiated_at,
  sp.completed_at,
  sp.failure_reason,
  sp.payout_release_at,
  sp.created_at,
  sp.updated_at,
  p.name,
  au.email
FROM seller_payouts sp
LEFT JOIN profiles p ON sp.user_id = p.user_id
LEFT JOIN auth.users au ON au.id = sp.user_id
WHERE (p_status = 'all' OR sp.status = p_status)
  AND (p_search IS NULL OR
       sp.user_id::text ILIKE '%' || p_search || '%' OR
       sp.trade_id::text ILIKE '%' || p_search || '%' OR
       p.name ILIKE '%' || p_search || '%' OR
       au.email ILIKE '%' || p_search || '%')
ORDER BY sp.created_at DESC
LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_payouts(text, text, integer, integer) TO authenticated, service_role;

-- Recreate the admin convenience view against the new function signature
CREATE OR REPLACE VIEW admin_payouts_view AS
SELECT * FROM get_admin_payouts('all', NULL, 10000, 0);

GRANT SELECT ON admin_payouts_view TO authenticated;
GRANT SELECT ON admin_payouts_view TO service_role;

-- ============================================================================
-- BLOCK 7 — admin_trades_view: expose payout_release_at (append-only, SQL-8)
-- ============================================================================

DROP VIEW IF EXISTS admin_trades_view CASCADE;

CREATE OR REPLACE VIEW admin_trades_view AS
SELECT
  t.id::text,
  t.listing_id::text,
  t.buyer_id::text,
  t.seller_id::text,
  t.status,
  t.sp_amount,
  t.cash_amount_cents,
  t.buyer_transaction_fee_cents,
  t.cash_currency,
  t.buyer_subscription_status,
  t.stripe_payment_intent_id,
  t.stripe_refund_id,
  t.sp_debit_ledger_entry_id,
  t.sp_credit_ledger_entry_id,
  t.cancellation_reason,
  t.bundle_id::text,
  t.bundle_size,
  t.created_at,
  t.updated_at,
  t.completed_at,
  t.cancelled_at,
  t.last_status_change_at,
  pb.name as buyer_name,
  pb.email as buyer_email,
  pb.phone as buyer_phone,
  ps.name as seller_name,
  ps.email as seller_email,
  ps.phone as seller_phone,
  t.offer_expires_at,
  t.auto_complete_at,
  t.authorization_expires_at,
  t.dispute_status,
  t.dispute_resolution,
  -- R3: payout schedule visibility for the admin pipeline
  t.payout_status,
  t.payout_release_at
FROM trades t
LEFT JOIN profiles pb ON t.buyer_id = pb.user_id
LEFT JOIN profiles ps ON t.seller_id = ps.user_id;

GRANT SELECT ON admin_trades_view TO authenticated;
GRANT SELECT ON admin_trades_view TO service_role;

-- ============================================================================
-- BLOCK 8 — schedule the release-due-payouts cron (BP-21: cron with the RPC)
-- ============================================================================

DO $$
DECLARE
  v_base_url text;
  v_service_role_key text;
  v_release_sql text;
BEGIN
  v_base_url := COALESCE(
    current_setting('app.edge_function_base_url', true),
    current_setting('custom.edge_function_base_url', true)
  );

  v_service_role_key := COALESCE(
    current_setting('app.service_role_key', true),
    current_setting('custom.service_role_key', true)
  );

  IF v_base_url IS NULL OR v_service_role_key IS NULL OR v_base_url = '' OR v_service_role_key = '' THEN
    RAISE NOTICE 'Skipping release-due-payouts schedule: missing base URL or service role key setting';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'release-due-payouts';

    v_release_sql := format(
      $f$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );$f$,
      v_base_url || '/release-due-payouts',
      v_service_role_key
    );

    PERFORM cron.schedule('release-due-payouts', '0 * * * *', v_release_sql);
  END IF;
END;
$$;

-- ============================================================================
-- VERIFICATION QUERIES (run one statement at a time — result-granularity rule)
-- ============================================================================
-- 1) Columns added:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'seller_payouts' AND column_name = 'payout_release_at';
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'trades' AND column_name = 'payout_release_at';
--
-- 2) Function present + latest body:
--    SELECT proname FROM pg_proc WHERE proname IN
--      ('create_seller_payout_on_trade_completion','fn_queue_payout_on_complete',
--       'update_seller_balance_on_trade_completion','rpc_release_due_payouts');
--
-- 3) Trigger linked:
--    SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.trades'::regclass
--      AND tgname IN ('trg_queue_payout_on_complete','trigger_update_seller_balance_on_completion');
--
-- 4) Payout release date math (R3 DoD #4 — actual completion, not expected window):
--    SELECT t.id, t.completed_at, t.auto_complete_at,
--           t.payout_release_at,
--           (t.payout_release_at = t.completed_at + make_interval(days => public.fn_admin_config_int('payout_buffer_days',0))) AS keyed_off_completed_at
--    FROM public.trades t
--    WHERE t.status = 'completed' AND t.payout_release_at IS NOT NULL
--    ORDER BY t.completed_at DESC LIMIT 20;
--
-- 5) Cron scheduled:
--    SELECT jobname, schedule FROM cron.job WHERE jobname = 'release-due-payouts';
-- ============================================================================
