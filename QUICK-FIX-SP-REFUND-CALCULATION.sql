-- File: QUICK-FIX-SP-REFUND-CALCULATION.sql
-- IMMEDIATE FIX: SP refund not calculated correctly in admin_force_cancel_trade_db
-- 
-- The bug: admin_force_cancel_trade_db was checking IF v_sp_refund_amount > 0
-- but v_sp_refund_amount was pulling a NEGATIVE amount from sp_ledger (e.g., -8)
-- so the refund was never issued.
--
-- Fix: Use ABS() to get the positive value

DROP FUNCTION IF EXISTS admin_force_cancel_trade_db(UUID, UUID, TEXT);

CREATE FUNCTION admin_force_cancel_trade_db(
  p_trade_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade RECORD;
  v_sp_refund_amount INTEGER := 0;
  v_sp_refund_ledger_id UUID := NULL;
BEGIN
  -- 1. Load trade with row lock (lock only the trades table, no joins)
  SELECT t.* INTO v_trade FROM trades t WHERE t.id = p_trade_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- 2. Calculate SP refund if applicable
  -- Note: sp_debit_ledger_entry_id stores a negative amount (e.g., -8 for 8 SP spent)
  -- We need to refund the absolute value
  IF v_trade.sp_debit_ledger_entry_id IS NOT NULL THEN
    SELECT ABS(amount) INTO v_sp_refund_amount FROM sp_ledger WHERE id = v_trade.sp_debit_ledger_entry_id;
    
    -- Only refund if there was actually SP spent (v_sp_refund_amount > 0)
    IF v_sp_refund_amount > 0 THEN
      SELECT (credit_sp_for_cancelled_trade(v_trade.buyer_id, p_trade_id, v_sp_refund_amount))->>'ledger_entry_id'::TEXT INTO v_sp_refund_ledger_id;
      
      -- Link the refund ledger entry to the trade
      UPDATE trades
      SET sp_credit_ledger_entry_id = v_sp_refund_ledger_id
      WHERE id = p_trade_id;
    END IF;
  END IF;

  -- 3. Update trade status
  UPDATE trades
  SET 
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_at = NOW(),
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- 4. Log admin action (allow NULL actor_id for system actions)
  INSERT INTO admin_audit_logs (actor_id, action_type, entity_type, entity_id, reason, payload)
  VALUES (
    p_admin_user_id, 
    'force_cancel_trade', 
    'trade', 
    p_trade_id::TEXT, 
    p_reason, 
    jsonb_build_object('sp_refunded', v_sp_refund_amount, 'sp_ledger_id', v_sp_refund_ledger_id)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'trade_id', p_trade_id, 
    'sp_refunded', v_sp_refund_amount,
    'stripe_payment_intent_id', v_trade.stripe_payment_intent_id
  );
END;
$$;

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- After running the fix, test with the trade ID that had the issue:
-- 
-- SELECT 
--   t.id,
--   t.status,
--   t.sp_amount,
--   (SELECT amount FROM sp_ledger WHERE id = t.sp_debit_ledger_entry_id) as spent_amount,
--   (SELECT amount FROM sp_ledger WHERE id = t.sp_credit_ledger_entry_id) as refunded_amount
-- FROM trades t
-- WHERE t.id = 'b7554050-4c79-4983-8e71-1dec0cfe6ae2';
-- 
-- Expected: 
-- - status: 'cancelled'
-- - spent_amount: -8
-- - refunded_amount: 8 (positive)
--
-- Then check wallet summary:
-- SELECT * FROM get_user_sp_wallet_summary('79919419-47dc-43af-a55c-e58597096026'::UUID);
--
-- Expected:
-- - available_points: 468 (460 + 8 refunded)
-- - lifetime_earned: 569 (561 + 8 refund counted as earn)
