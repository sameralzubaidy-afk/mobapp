-- Migration: Fix cancel_trade_v2 to clear dispute_status on cancel
-- Date: 2026-07-03
-- Mode B: Idempotent rerunnable migration
-- Bug: cancel_trade_v2 sets status='cancelled' but doesn't clear dispute_status,
-- so a previously disputed trade (dispute_status='reported') shows the dispute
-- banner on the TradeTimelineScreen even after being cancelled.

CREATE OR REPLACE FUNCTION cancel_trade_v2(
  p_trade_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'User requested cancellation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade RECORD;
  v_sp_refund_amount INTEGER := 0;
  v_sp_refund_ledger_id UUID := NULL;
  v_sp_refund_error TEXT := NULL;
BEGIN
  -- 1. Load and verify trade exists
  SELECT * INTO v_trade FROM trades WHERE id = p_trade_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Trade not found. It may have already been cancelled or expired.'
    );
  END IF;

  -- 2. Verify authorization (only buyer or seller can cancel)
  IF p_user_id <> v_trade.buyer_id AND p_user_id <> v_trade.seller_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You do not have permission to cancel this trade'
    );
  END IF;

  -- 3. Verify trade status is cancellable (pending or in_progress)
  IF v_trade.status NOT IN ('pending', 'in_progress') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This trade cannot be cancelled. Current status: ' || v_trade.status
    );
  END IF;

  -- 4. Calculate SP refund amount if buyer spent SP on this trade
  IF v_trade.sp_debit_ledger_entry_id IS NOT NULL THEN
    SELECT amount INTO v_sp_refund_amount FROM sp_ledger WHERE id = v_trade.sp_debit_ledger_entry_id;
    IF v_sp_refund_amount IS NULL THEN
      v_sp_refund_amount := 0;
    END IF;

    IF v_sp_refund_amount > 0 THEN
      -- Use the existing RPC to credit SP for cancelled trade; handle failures gracefully
      BEGIN
        SELECT (credit_sp_for_cancelled_trade(v_trade.buyer_id, p_trade_id, v_sp_refund_amount))->>'ledger_entry_id' INTO v_sp_refund_ledger_id;
      EXCEPTION WHEN OTHERS THEN
        v_sp_refund_error := SQLERRM;
        v_sp_refund_ledger_id := NULL;
        v_sp_refund_amount := 0;
      END;
    END IF;
  END IF;

  -- 5. Update trade status to cancelled with reason
  -- ⭐ FIX: Clear dispute_status so cancelled trades don't show dispute banner
  UPDATE trades
  SET 
    status = 'cancelled',
    cancellation_reason = p_reason,
    dispute_status = 'none',
    cancelled_at = NOW(),
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- 6. Build response
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'status', 'cancelled',
    'cancellation_reason', p_reason,
    'sp_refunded', v_sp_refund_amount,
    'sp_refund_ledger_id', COALESCE(v_sp_refund_ledger_id::TEXT, NULL),
    'sp_refund_error', COALESCE(v_sp_refund_error, NULL)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION cancel_trade_v2 IS 'Cancels a trade (pending or in_progress). Clears dispute_status. Refunds SP via credit_sp_for_cancelled_trade if applicable.';

-- Verification query
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'cancel_trade_v2';
