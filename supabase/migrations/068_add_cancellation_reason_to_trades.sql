-- filepath: supabase/migrations/068_add_cancellation_reason_to_trades.sql

-- Mode B: Idempotent rerunnable migration
-- Add cancellation_reason and cancelled_at columns to trades table to support trade cancellation with reason tracking.

-- 1. Add cancellation tracking columns
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Create the cancel_trade_v2 RPC function
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
  v_buyer_sub JSONB;
  v_ledger_entry RECORD;
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
    SELECT amount INTO v_ledger_entry 
    FROM sp_ledger 
    WHERE id = v_trade.sp_debit_ledger_entry_id;
    
    IF FOUND THEN
      v_sp_refund_amount := v_ledger_entry.amount;
      
      -- Insert refund entry into SP ledger
      INSERT INTO sp_ledger (
        user_id,
        trade_id,
        transaction_type,
        amount,
        balance_after,
        status,
        notes,
        created_at
      ) VALUES (
        v_trade.buyer_id,
        p_trade_id,
        'credit',
        v_sp_refund_amount,
        (SELECT balance FROM sp_ledger 
         WHERE user_id = v_trade.buyer_id 
         ORDER BY created_at DESC 
         LIMIT 1).balance + v_sp_refund_amount,
        'released',
        'Refunded due to trade cancellation',
        NOW()
      );
    END IF;
  END IF;

  -- 5. Update trade status to cancelled with reason
  UPDATE trades
  SET 
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_at = NOW(),
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- 6. If seller had earned SP from this trade, we should NOT refund it (it was for a completed sale)
  -- The sp_credit_ledger_entry_id stays as-is; only buyer gets refund

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'status', 'cancelled',
    'cancellation_reason', p_reason,
    'sp_refunded', v_sp_refund_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 3. Verification queries
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trades' ORDER BY ordinal_position;
-- SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'cancellation_reason');
-- SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'cancelled_at');
