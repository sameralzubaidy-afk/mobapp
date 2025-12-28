-- Admin Force Cancel Trade RPC Function
-- This function allows admins to force-cancel trades with proper SP refunds and audit logging

-- Drop existing function if it exists (to handle return type changes)
DROP FUNCTION IF EXISTS admin_force_cancel_trade_db(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION admin_force_cancel_trade_db(
  p_trade_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT 'Admin force-cancel'
) 
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade RECORD;
  v_original_buyer_sp_used DECIMAL(10,2);
  v_sp_refunded BOOLEAN := false;
  v_result JSON;
BEGIN
  -- 1. Get the trade details with proper locks
  SELECT t.*, u.email as buyer_email, s.email as seller_email
  INTO v_trade
  FROM trades t
  LEFT JOIN auth.users u ON t.buyer_id = u.id
  LEFT JOIN auth.users s ON t.seller_id = s.id
  WHERE t.id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- 2. Validate that trade can be cancelled (not already completed/cancelled/refunded)
  IF v_trade.status IN ('cancelled', 'refunded') THEN
    RETURN json_build_object('success', false, 'error', 'Trade is already ' || v_trade.status);
  END IF;

  -- Store original SP used before update
  v_original_buyer_sp_used := COALESCE(v_trade.buyer_sp_used, 0);

  -- 3. Update trade status to cancelled
  UPDATE trades 
  SET 
    status = 'cancelled',
    updated_at = CURRENT_TIMESTAMP,
    cancellation_reason = p_reason,
    cancelled_by = 'admin',
    cancelled_at = CURRENT_TIMESTAMP
  WHERE id = p_trade_id;

  -- 4. Refund SP to buyer if any was used
  IF v_original_buyer_sp_used > 0 THEN
    -- Add SP back to buyer's wallet
    INSERT INTO swap_points_transactions (
      user_id,
      amount,
      transaction_type,
      status,
      trade_id,
      description,
      created_at
    ) VALUES (
      v_trade.buyer_id,
      v_original_buyer_sp_used,
      'refund',
      'completed',
      p_trade_id,
      'SP refund for admin-cancelled trade',
      CURRENT_TIMESTAMP
    );

    v_sp_refunded := true;
  END IF;

  -- 5. Log the admin action for audit
  INSERT INTO admin_audit_logs (
    actor_id,
    action_type,
    entity_type,
    entity_id,
    reason,
    payload,
    created_at
  ) VALUES (
    p_admin_user_id,
    'force_cancel_trade',
    'trade',
    p_trade_id,
    p_reason,
    json_build_object(
      'original_status', v_trade.status,
      'buyer_sp_used', v_original_buyer_sp_used,
      'sp_refunded', v_sp_refunded,
      'stripe_payment_intent_id', v_trade.stripe_payment_intent_id
    ),
    CURRENT_TIMESTAMP
  );

  -- 6. Build successful result
  v_result := json_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'sp_refunded', v_sp_refunded,
    'stripe_payment_intent_id', v_trade.stripe_payment_intent_id,
    'original_status', v_trade.status
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    INSERT INTO admin_audit_logs (
      actor_id,
      action_type,
      entity_type,
      entity_id,
      reason,
      payload,
      created_at
    ) VALUES (
      p_admin_user_id,
      'force_cancel_trade_error',
      'trade',
      p_trade_id,
      'Error during force cancel: ' || SQLERRM,
      json_build_object('error', SQLERRM),
      CURRENT_TIMESTAMP
    );

    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users (RLS will handle actual access control)
GRANT EXECUTE ON FUNCTION admin_force_cancel_trade_db(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_force_cancel_trade_db(UUID, UUID, TEXT) TO service_role;

-- Verification query
SELECT 'admin_force_cancel_trade_db function created successfully' as status;