-- Migration: Admin Trade Tools
-- Mode B: Idempotent rerunnable migration

-- BLOCK 1: Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Allow NULL for system actions
  action_type TEXT NOT NULL, -- e.g., 'force_cancel_trade', 'manual_refund', 'update_config'
  entity_type TEXT NOT NULL, -- e.g., 'trade', 'user', 'config'
  entity_id TEXT NOT NULL,
  payload JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id ON admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity_id ON admin_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);

-- BLOCK 2: Admin RPC for force-cancel (DB side)
CREATE OR REPLACE FUNCTION admin_force_cancel_trade_db(
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

-- BLOCK 3: Admin RPC for Trade Analytics
CREATE OR REPLACE FUNCTION admin_get_trade_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_volume INTEGER;
  v_status_counts JSONB;
  v_avg_sp_usage NUMERIC;
  v_total_fee_revenue_cents BIGINT;
BEGIN
  -- Total volume
  SELECT COUNT(*) INTO v_total_volume FROM trades;

  -- Status counts
  SELECT jsonb_object_agg(status, count) INTO v_status_counts
  FROM (
    SELECT status, COUNT(*) as count
    FROM trades
    GROUP BY status
  ) s;

  -- Avg SP usage (on trades where SP was used)
  SELECT AVG(sp_amount) INTO v_avg_sp_usage
  FROM trades
  WHERE sp_amount > 0;

  -- Total fee revenue
  SELECT SUM(buyer_transaction_fee_cents) INTO v_total_fee_revenue_cents
  FROM trades
  WHERE status = 'completed';

  RETURN jsonb_build_object(
    'total_volume', v_total_volume,
    'status_counts', COALESCE(v_status_counts, '{}'::jsonb),
    'avg_sp_usage', COALESCE(v_avg_sp_usage, 0),
    'total_fee_revenue_cents', COALESCE(v_total_fee_revenue_cents, 0)
  );
END;
$$;

-- Verification
SELECT table_name FROM information_schema.tables WHERE table_name = 'admin_audit_logs';
