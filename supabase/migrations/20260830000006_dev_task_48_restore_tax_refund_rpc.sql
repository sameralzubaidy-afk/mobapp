-- =====================================================
-- Migration: 20260830000006_dev_task_48_restore_tax_refund_rpc.sql
-- Task: DEV-TASK-48 item 5 (P2) — tax ledger not updated on partial refund (K08)
-- Root cause: migration 20260724000001 (tax_refund_and_reconciliation) was only PARTIALLY
--   applied on staging. BLOCK 1 (enum values), BLOCK 2 (columns) and BLOCK 5 (summary/export
--   RPCs) landed, but BLOCK 4 (rpc_record_stripe_refund) did not. The deployed
--   rpc_record_payment_refund calls public.rpc_record_stripe_refund(...) inside a swallowed
--   BEGIN...EXCEPTION WHEN OTHERS block, so every tax-component refund raised
--   'function rpc_record_stripe_refund(...) does not exist', was swallowed, and the refund
--   committed to Stripe/payments/trade_refunds while tax_records stayed 'collected' with
--   refunded_tax_cents = 0 (exact K08 symptom).
-- Fix: create the canonical rpc_record_stripe_refund (BLOCK 4 of 20260724000001) verbatim.
--   Deps already present: refund_tax, tax_status enum values, tax_records refund columns.
-- =====================================================

CREATE OR REPLACE FUNCTION public.rpc_record_stripe_refund(
  p_trade_id UUID,
  p_stripe_refund_id TEXT,
  p_refund_amount_cents INTEGER,
  p_refund_status TEXT DEFAULT 'succeeded',
  p_refund_reason TEXT DEFAULT NULL,
  p_initiating_actor TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tax_record RECORD;
  v_existing_refund_id TEXT;
  v_current_status TEXT;
  v_refund_result JSONB;
BEGIN
  IF p_trade_id IS NULL OR p_stripe_refund_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id and p_stripe_refund_id are required')
    );
  END IF;

  -- Lock the tax record
  SELECT * INTO v_tax_record FROM public.tax_records
  WHERE trade_id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object('trade_id', p_trade_id, 'action', 'noop', 'reason', 'no_tax_record')
    );
  END IF;

  -- Idempotency: check if this exact refund ID is already recorded
  IF v_tax_record.stripe_refund_id = p_stripe_refund_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'tax_record_id', v_tax_record.id,
        'trade_id', p_trade_id,
        'action', 'idempotent',
        'stripe_refund_id', p_stripe_refund_id,
        'message', 'Refund already recorded'
      )
    );
  END IF;

  v_current_status := v_tax_record.tax_status::TEXT;

  -- Only process refund for collected or partially_refunded records
  IF v_current_status NOT IN ('collected', 'partially_refunded', 'pending_refund') THEN
    -- If the record is voided/quoted, a refund should NOT be applied — money was never collected
    IF p_refund_status = 'succeeded' THEN
      -- Stripe says refund succeeded but we have no collected tax — this needs reconciliation
      UPDATE public.tax_records
      SET stripe_refund_id = p_stripe_refund_id,
          refund_status = p_refund_status,
          refunded_at = CASE WHEN p_refund_status = 'succeeded' THEN now() ELSE NULL END,
          reconciliation_status = 'needs_review',
          reconciliation_reason = format('Stripe refund %s issued but tax status is %s', p_stripe_refund_id, v_current_status),
          updated_at = now()
      WHERE id = v_tax_record.id;

      RETURN jsonb_build_object(
        'success', true,
        'warning', 'RECONCILIATION_NEEDED',
        'data', jsonb_build_object(
          'tax_record_id', v_tax_record.id,
          'trade_id', p_trade_id,
          'action', 'reconciliation',
          'stripe_refund_id', p_stripe_refund_id,
          'tax_status', v_current_status,
          'reconciliation_status', 'needs_review'
        )
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object(
        'code', 'INVALID_STATE',
        'message', format('Cannot record refund for tax in status %s. Only collected or partially_refunded can be refunded.', v_current_status)
      )
    );
  END IF;

  -- Handle pending refund status (Stripe refund initiated but not confirmed)
  IF p_refund_status IN ('pending', 'processing') THEN
    UPDATE public.tax_records
    SET tax_status = 'pending_refund'::public.tax_status,
        stripe_refund_id = COALESCE(stripe_refund_id, p_stripe_refund_id),
        refund_status = p_refund_status,
        refund_reason = COALESCE(p_refund_reason, refund_reason),
        reconciliation_status = NULL,
        reconciliation_reason = NULL,
        updated_at = now()
    WHERE id = v_tax_record.id;

    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'tax_record_id', v_tax_record.id,
        'trade_id', p_trade_id,
        'action', 'pending_refund',
        'stripe_refund_id', p_stripe_refund_id,
        'refund_status', p_refund_status
      )
    );
  END IF;

  -- Handle failed/canceled refund
  IF p_refund_status IN ('failed', 'canceled') THEN
    UPDATE public.tax_records
    SET stripe_refund_id = COALESCE(stripe_refund_id, p_stripe_refund_id),
        refund_status = p_refund_status,
        refund_reason = COALESCE(p_refund_reason, refund_reason),
        reconciliation_status = 'refund_failed',
        reconciliation_reason = format('Stripe refund %s returned status: %s', p_stripe_refund_id, p_refund_status),
        updated_at = now()
    WHERE id = v_tax_record.id;

    RETURN jsonb_build_object(
      'success', true,
      'warning', 'REFUND_FAILED',
      'data', jsonb_build_object(
        'tax_record_id', v_tax_record.id,
        'trade_id', p_trade_id,
        'action', 'refund_failed',
        'stripe_refund_id', p_stripe_refund_id,
        'refund_status', p_refund_status
      )
    );
  END IF;

  -- Handle successful refund — record it via refund_tax RPC and update status
  IF p_refund_status = 'succeeded' THEN
    -- Call the existing proportional refund RPC
    v_refund_result := public.refund_tax(p_trade_id, p_refund_amount_cents,
      COALESCE(p_refund_reason, 'stripe_refund'));

    IF (v_refund_result->>'success') IS DISTINCT FROM 'true' THEN
      -- Refund tax failed — mark for reconciliation
      UPDATE public.tax_records
      SET stripe_refund_id = p_stripe_refund_id,
          refund_status = p_refund_status,
          reconciliation_status = 'refund_record_failed',
          reconciliation_reason = format('Stripe refund %s succeeded but refund_tax RPC failed: %s',
            p_stripe_refund_id, (v_refund_result->>'error')::TEXT),
          updated_at = now()
      WHERE id = v_tax_record.id;

      RETURN jsonb_build_object(
        'success', true,
        'warning', 'REFUND_RECORD_FAILED',
        'data', jsonb_build_object(
          'tax_record_id', v_tax_record.id,
          'trade_id', p_trade_id,
          'action', 'refund_record_failed',
          'stripe_refund_id', p_stripe_refund_id,
          'refund_tax_error', v_refund_result->'error'
        )
      );
    END IF;

    -- Determine new tax_status based on remaining cents
    DECLARE
      v_remaining_cents INTEGER;
      v_total_cents INTEGER;
      v_new_tax_status public.tax_status;
    BEGIN
      v_remaining_cents := ((v_refund_result->'data'->>'remaining_cents')::INTEGER);
      v_total_cents := ((v_refund_result->'data'->>'tax_amount_cents')::INTEGER);

      IF v_remaining_cents <= 0 THEN
        v_new_tax_status := 'refunded'::public.tax_status;
      ELSIF v_remaining_cents < v_total_cents THEN
        v_new_tax_status := 'partially_refunded'::public.tax_status;
      ELSE
        v_new_tax_status := 'collected'::public.tax_status;
      END IF;

      UPDATE public.tax_records
      SET tax_status = v_new_tax_status,
          stripe_refund_id = COALESCE(stripe_refund_id, p_stripe_refund_id),
          refunded_at = now(),
          refund_status = 'succeeded',
          refund_reason = COALESCE(p_refund_reason, refund_reason),
          reconciliation_status = NULL,
          reconciliation_reason = NULL,
          updated_at = now()
      WHERE id = v_tax_record.id;
    END;

    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'tax_record_id', v_tax_record.id,
        'trade_id', p_trade_id,
        'action', 'refund_recorded',
        'stripe_refund_id', p_stripe_refund_id,
        'refund_tax_result', v_refund_result->'data'
      )
    );
  END IF;

  -- Unknown refund_status
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'INVALID_REFUND_STATUS', 'message', format('Unknown refund_status: %s', p_refund_status))
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'RECORD_REFUND_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_record_stripe_refund IS
'Records a Stripe refund result on the tax ledger. Idempotent — safe to call multiple times with the same stripe_refund_id. Only processes refunds for collected/partially_refunded/pending_refund records. Handles succeeded/pending/failed/canceled refund statuses.';

GRANT EXECUTE ON FUNCTION public.rpc_record_stripe_refund(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT)
  TO authenticated, service_role;
