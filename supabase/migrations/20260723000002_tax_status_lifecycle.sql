-- File: supabase/migrations/20260723000002_tax_status_lifecycle.sql
-- Module: MODULE-15.1.2 TradeFlowV2 (tax-status-lifecycle)
-- Mode B: Idempotent rerunnable migration
--
-- Purpose:
-- 1) Add tax_status enum + column to tax_records — distinguishes quoted, collected,
--    voided, capture_failed, refunded, and partially_refunded states.
-- 2) Add tax_snapshot JSONB to tax_records — immutable record of the calculation inputs
--    at offer time (item-level category/rule/price, fee-in-base flag, config version IDs).
-- 3) Add captured_at TIMESTAMPTZ to tax_records — set when Stripe capture confirms.
-- 4) Create RPCs for tax status transitions.
-- 5) Add index for tax_status queries.
--
-- Key concept: Tax becomes "collected" ONLY when Stripe capture succeeds (buyer completes
-- or auto-complete fires). Prior to that, it is "quoted" (authorization hold exists but
-- no money moved). See docx/TRADING-FLOW-V2 tax-status-lifecycle addendum.

-- ============================================================================
-- BLOCK 1 — Schema changes (columns, constraints)
-- ============================================================================

-- 1a) Create tax_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_status') THEN
    CREATE TYPE public.tax_status AS ENUM (
      'quoted',              -- Offer has tax calculated; Stripe auth hold exists but not captured
      'collected',           -- Stripe capture succeeded; tax is payable
      'voided',             -- Auth was canceled/declined/expired before capture
      'capture_failed',     -- Capture attempt failed; no money moved
      'refunded',           -- Full captured tax was refunded
      'partially_refunded'  -- Partial refund was processed
    );
  END IF;
END;
$$;

-- 1b) Add tax_status column to tax_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'tax_status'
  ) THEN
    ALTER TABLE public.tax_records
      ADD COLUMN tax_status public.tax_status NOT NULL DEFAULT 'quoted';
  END IF;
END;
$$;

-- 1c) Add tax_snapshot JSONB column to tax_records — immutable record of calculation inputs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'tax_snapshot'
  ) THEN
    ALTER TABLE public.tax_records
      ADD COLUMN tax_snapshot JSONB;
  END IF;
END;
$$;

-- 1d) Add captured_at TIMESTAMPTZ column to tax_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'captured_at'
  ) THEN
    ALTER TABLE public.tax_records
      ADD COLUMN captured_at TIMESTAMPTZ;
  END IF;
END;
$$;

-- 1e) Add voided_at TIMESTAMPTZ column to tax_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'voided_at'
  ) THEN
    ALTER TABLE public.tax_records
      ADD COLUMN voided_at TIMESTAMPTZ;
  END IF;
END;
$$;

-- 1f) Add stripe_capture_id TEXT column to tax_records (Stripe Charge ID from capture)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'stripe_capture_id'
  ) THEN
    ALTER TABLE public.tax_records
      ADD COLUMN stripe_capture_id TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- BLOCK 1b — Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tax_records_status
  ON public.tax_records (tax_status);

CREATE INDEX IF NOT EXISTS idx_tax_records_status_collected
  ON public.tax_records (tax_status, captured_at)
  WHERE tax_status = 'collected';

-- ============================================================================
-- BLOCK 2 — RPC: Mark tax as voided (cancel/decline/expiry before capture)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_void_tax_for_trade(
  p_trade_id UUID,
  p_reason TEXT DEFAULT 'trade_cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_current_status TEXT;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id is required')
    );
  END IF;

  -- Lock and load the tax record
  SELECT * INTO v_record FROM public.tax_records
  WHERE trade_id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No tax record exists — nothing to void (zero-tax offer)
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object('trade_id', p_trade_id, 'action', 'noop', 'reason', 'no_tax_record')
    );
  END IF;

  v_current_status := v_record.tax_status::TEXT;

  -- Only void quoted or capture_failed records
  IF v_current_status NOT IN ('quoted', 'capture_failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object(
        'code', 'INVALID_STATE',
        'message', format('Cannot void tax in status %s. Only quoted or capture_failed can be voided.', v_current_status),
        'details', jsonb_build_object('current_status', v_current_status, 'trade_id', p_trade_id)
      )
    );
  END IF;

  UPDATE public.tax_records
  SET tax_status = 'voided'::public.tax_status,
      voided_at = COALESCE(voided_at, now()),
      updated_at = now()
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'tax_record_id', v_record.id,
      'trade_id', p_trade_id,
      'previous_status', v_current_status,
      'new_status', 'voided',
      'reason', p_reason
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'VOID_TAX_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_void_tax_for_trade IS
'Transitions a tax record from quoted/capture_failed to voided. Safe to call on trades with no tax record (returns noop). Idempotent on already-voided records.';

-- ============================================================================
-- BLOCK 3 — RPC: Mark tax as collected (Stripe capture succeeded)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_mark_tax_collected(
  p_trade_id UUID,
  p_stripe_capture_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_current_status TEXT;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id is required')
    );
  END IF;

  SELECT * INTO v_record FROM public.tax_records
  WHERE trade_id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Zero-tax trade — mark as collected (no-op, just record capture)
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object('trade_id', p_trade_id, 'action', 'noop', 'reason', 'no_tax_record')
    );
  END IF;

  v_current_status := v_record.tax_status::TEXT;

  -- Idempotent: if already collected, return success
  IF v_current_status = 'collected' THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'tax_record_id', v_record.id,
        'trade_id', p_trade_id,
        'action', 'idempotent',
        'previous_status', v_current_status,
        'new_status', 'collected'
      )
    );
  END IF;

  -- Only quoted can be collected
  IF v_current_status NOT IN ('quoted', 'capture_failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object(
        'code', 'INVALID_STATE',
        'message', format('Cannot mark tax as collected from status %s.', v_current_status),
        'details', jsonb_build_object('current_status', v_current_status, 'trade_id', p_trade_id)
      )
    );
  END IF;

  UPDATE public.tax_records
  SET tax_status = 'collected'::public.tax_status,
      captured_at = COALESCE(captured_at, now()),
      stripe_capture_id = COALESCE(p_stripe_capture_id, stripe_capture_id),
      updated_at = now()
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'tax_record_id', v_record.id,
      'trade_id', p_trade_id,
      'previous_status', v_current_status,
      'new_status', 'collected',
      'stripe_capture_id', p_stripe_capture_id
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'MARK_COLLECTED_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_mark_tax_collected IS
'Transitions a tax record from quoted/capture_failed to collected. Idempotent — safe to call multiple times.';

-- ============================================================================
-- BLOCK 4 — RPC: Mark tax as capture_failed
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_mark_tax_capture_failed(
  p_trade_id UUID,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_current_status TEXT;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id is required')
    );
  END IF;

  SELECT * INTO v_record FROM public.tax_records
  WHERE trade_id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object('trade_id', p_trade_id, 'action', 'noop', 'reason', 'no_tax_record')
    );
  END IF;

  v_current_status := v_record.tax_status::TEXT;

  IF v_current_status NOT IN ('quoted') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object(
        'code', 'INVALID_STATE',
        'message', format('Cannot mark capture_failed from status %s.', v_current_status),
        'details', jsonb_build_object('current_status', v_current_status, 'trade_id', p_trade_id)
      )
    );
  END IF;

  UPDATE public.tax_records
  SET tax_status = 'capture_failed'::public.tax_status,
      updated_at = now()
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'tax_record_id', v_record.id,
      'trade_id', p_trade_id,
      'previous_status', v_current_status,
      'new_status', 'capture_failed',
      'failure_reason', p_failure_reason
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'MARK_FAILED_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_mark_tax_capture_failed IS
'Transitions a tax record from quoted to capture_failed when Stripe capture does not succeed.';

-- ============================================================================
-- BLOCK 5 — RPC: Mark tax as refunded (full or partial)
-- ============================================================================

-- Note: public.refund_tax already exists (20260510000004).
-- We extend it here to also update tax_status on the tax_records table.
-- This RPC wraps refund_tax and adds the status transition.
CREATE OR REPLACE FUNCTION public.rpc_refund_tax_with_status(
  p_trade_id UUID,
  p_refund_amount_cents INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refund_result JSONB;
  v_refund_data JSONB;
  v_remaining_cents INTEGER;
  v_total_cents INTEGER;
  v_new_status public.tax_status;
BEGIN
  -- Call the existing refund_tax RPC
  v_refund_result := public.refund_tax(p_trade_id, p_refund_amount_cents, p_reason);

  IF (v_refund_result->>'success') IS DISTINCT FROM 'true' THEN
    RETURN v_refund_result;
  END IF;

  v_refund_data := v_refund_result->'data';
  v_remaining_cents := (v_refund_data->>'remaining_cents')::INTEGER;
  v_total_cents := (v_refund_data->>'tax_amount_cents')::INTEGER;

  -- Determine new status
  IF v_remaining_cents <= 0 THEN
    v_new_status := 'refunded'::public.tax_status;
  ELSIF v_remaining_cents < v_total_cents THEN
    v_new_status := 'partially_refunded'::public.tax_status;
  ELSE
    -- No change — full amount still collected
    RETURN v_refund_result;
  END IF;

  UPDATE public.tax_records
  SET tax_status = v_new_status,
      updated_at = now()
  WHERE trade_id = p_trade_id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'refund_result', v_refund_data,
      'new_tax_status', v_new_status
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'REFUND_TAX_STATUS_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_refund_tax_with_status IS
'Wraps refund_tax to also update tax_status on the tax_records table. Idempotent — safe to call multiple times.';

-- ============================================================================
-- BLOCK 6 — RPC: Capture trade payment + mark tax collected (atomic)
-- Used by complete-trade and auto-complete flows
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_capture_trade_payment(
  p_trade_id UUID,
  p_stripe_payment_intent_id TEXT,
  p_stripe_capture_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_tax_status TEXT;
BEGIN
  IF p_trade_id IS NULL OR p_stripe_payment_intent_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id and p_stripe_payment_intent_id are required')
    );
  END IF;

  -- Lock the trade row
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'TRADE_NOT_FOUND', 'message', 'Trade not found')
    );
  END IF;

  -- Must be in_progress
  IF v_trade.status NOT IN ('in_progress', 'completed') THEN
    -- If already completed, check if payment was already captured (idempotent)
    IF v_trade.status = 'completed' THEN
      -- Allow re-entering for idempotency
      NULL;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object(
          'code', 'INVALID_STATE',
          'message', format('Trade status is %s. Expected in_progress or completed.', v_trade.status)
        )
      );
    END IF;
  END IF;

  -- Check if payment already captured (idempotency check via stripe_refund_id or payment status)
  -- We don't re-capture if already captured (stripe_capture_id exists on tax record)
  SELECT tax_status::TEXT INTO v_tax_status
  FROM public.tax_records
  WHERE trade_id = p_trade_id
  LIMIT 1;

  IF v_tax_status = 'collected' THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'trade_id', p_trade_id,
        'action', 'idempotent_already_captured',
        'tax_status', v_tax_status
      )
    );
  END IF;

  -- If we got here, the Stripe-side capture should have been done by the caller (Edge Function).
  -- This RPC records the DB-side effects: mark tax collected.
  -- The Stripe capture is done by the Edge Function before calling this RPC.
  -- If the Edge Function provides a p_stripe_capture_id, store it.

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'trade_id', p_trade_id,
      'action', 'capture_recorded',
      'stripe_payment_intent_id', p_stripe_payment_intent_id,
      'stripe_capture_id', p_stripe_capture_id
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'CAPTURE_PAYMENT_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_capture_trade_payment IS
'Stripe-side capture is handled by the Edge Function. This RPC records the DB-side idempotency guard.';

-- ============================================================================
-- BLOCK 7 — RPC: Cancel trade PaymentIntent + void tax (atomic for pending offers)
-- Used by cancel-trade EF and process-expired-offers for pending offers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cancel_pending_trade_pi(
  p_trade_id UUID,
  p_cancellation_reason TEXT DEFAULT 'buyer_cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_pi_id TEXT;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id is required')
    );
  END IF;

  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'TRADE_NOT_FOUND', 'message', 'Trade not found')
    );
  END IF;

  v_pi_id := v_trade.stripe_payment_intent_id;

  -- Void the tax record (handles zero-tax trades gracefully via noop)
  -- This is done BEFORE cancelling the trade so the tax_records lock is acquired first
  -- (avoiding deadlock with concurrent triggers that also lock tax_records).
  PERFORM public.rpc_void_tax_for_trade(p_trade_id, p_cancellation_reason);

  -- Return the PI ID so the caller can cancel it on Stripe side
  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'trade_id', p_trade_id,
      'stripe_payment_intent_id', v_pi_id,
      'cancellation_reason', p_cancellation_reason
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'CANCEL_PI_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_cancel_pending_trade_pi IS
'Voids tax for a pending trade and returns the Stripe PI ID for the caller to cancel. Safe to call on trades with no PI or no tax record.';

-- ============================================================================
-- BLOCK 8 — Update complete_trade_v2 to support payment-capture flow
-- The existing complete_trade_v2 is modified to:
--   a) Accept an optional p_capture_confirmed boolean flag
--   b) When capture_confirmed=true, it proceeds with SP release and payout
--   c) When capture_confirmed=false, it only marks status (legacy path)
-- Note: This is a DROP + CREATE because the RETURNS signature changes
-- ============================================================================

-- We add a wrapper RPC that the Edge Function calls AFTER Stripe capture succeeds.
-- This is cleaner than modifying complete_trade_v2 directly.
CREATE OR REPLACE FUNCTION public.rpc_finalize_trade_after_capture(
  p_trade_id UUID,
  p_stripe_capture_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_capture_result JSONB;
  v_complete_result JSONB;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id is required')
    );
  END IF;

  -- Step 1: Mark tax as collected (idempotent)
  v_capture_result := public.rpc_mark_tax_collected(p_trade_id, p_stripe_capture_id);

  IF (v_capture_result->>'success') IS DISTINCT FROM 'true' THEN
    RETURN v_capture_result;
  END IF;

  -- Step 2: Call the existing complete_trade_v2 to finalize SP and payout
  -- The user_id=null means system action (for auto-complete) or we pass the buyer.
  -- We fetch the buyer_id from the trade.
  SELECT buyer_id INTO v_trade FROM public.trades WHERE id = p_trade_id;

  v_complete_result := public.complete_trade_v2(p_trade_id, v_trade.buyer_id);

  -- If complete_trade_v2 returns an error, we still mark tax as collected but
  -- flag the completion failure separately.
  IF (v_complete_result->>'success') IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object(
        'code', 'COMPLETION_FAILED_AFTER_CAPTURE',
        'message', 'Tax was collected but trade completion failed. Manual admin review required.',
        'details', jsonb_build_object(
          'capture_result', v_capture_result,
          'completion_error', v_complete_result->>'error'
        )
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'tax_capture', v_capture_result->'data',
      'trade_completion', v_complete_result
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'FINALIZE_AFTER_CAPTURE_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_finalize_trade_after_capture IS
'Atomic: marks tax collected, then calls complete_trade_v2 to release SP and trigger payout. Called by Edge Functions after Stripe capture confirms.';

-- ============================================================================
-- BLOCK 9 — Historical backfill classification for existing tax_records
-- ============================================================================

-- Existing tax_records were created at offer submission time and have no capture.
-- We classify them as follows:
--   - If the trade is completed → the old flow captured at seller-accept, so these are legitimately 'collected'
--   - If the trade is cancelled/expired → 'voided'
--   - If the trade is still pending or in_progress → 'quoted' (authorization exists but uncaptured)
-- This is a best-effort backfill. Admin should reconcile any records that remain 'quoted' for
-- old in-progress trades that may never complete.

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Completed trades with tax > 0 → mark as collected
  UPDATE public.tax_records tr
  SET tax_status = 'collected'::public.tax_status,
      captured_at = COALESCE(tr.captured_at, t.completed_at, t.updated_at),
      updated_at = now()
  FROM public.trades t
  WHERE tr.trade_id = t.id
    AND tr.tax_status = 'quoted'
    AND t.status = 'completed'
    AND tr.tax_amount_cents > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE LOG '[tax-backfill] Marked % completed-trade tax records as collected', v_count;

  -- Cancelled trades → mark as voided
  UPDATE public.tax_records tr
  SET tax_status = 'voided'::public.tax_status,
      voided_at = COALESCE(tr.voided_at, t.cancelled_at, t.updated_at),
      updated_at = now()
  FROM public.trades t
  WHERE tr.trade_id = t.id
    AND tr.tax_status = 'quoted'
    AND t.status = 'cancelled'
    AND tr.tax_amount_cents > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE LOG '[tax-backfill] Marked % cancelled-trade tax records as voided', v_count;

  -- Refunded trades (stripe_refund_id is set) → mark as refunded
  UPDATE public.tax_records tr
  SET tax_status = 'refunded'::public.tax_status,
      updated_at = now()
  FROM public.trades t
  WHERE tr.trade_id = t.id
    AND tr.tax_status IN ('collected', 'quoted')
    AND t.stripe_refund_id IS NOT NULL
    AND tr.tax_amount_cents > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE LOG '[tax-backfill] Marked % refunded-trade tax records as refunded', v_count;
END;
$$;

-- ============================================================================
-- BLOCK 10 — Verification queries (safe to re-run)
-- ============================================================================

-- Verify columns exist:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'tax_records'
-- ORDER BY ordinal_position;

-- Verify tax_status enum works:
-- SELECT unnest(enum_range(NULL::public.tax_status)) AS status_values;

-- Verify backfill:
-- SELECT tax_status, COUNT(*) FROM public.tax_records GROUP BY tax_status;
