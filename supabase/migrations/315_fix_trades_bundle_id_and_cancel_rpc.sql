-- File: supabase/migrations/315_fix_trades_bundle_id_and_cancel_rpc.sql
-- Fixes two database errors:
--   1. column trades.bundle_id does not exist (TradeListScreen.tsx:263)
--   2. column "seller_id" does not exist (trade.ts:845 - cancel-trade RPC)
--
-- Mode B: Idempotent rerunnable migration

-- ============================================================
-- FIX 1: Add bundle_id column to trades table
-- ============================================================
-- The TradeListScreen queries bundle_id from trades, but it was
-- only added to cart_items. This column is needed for bundle
-- grouping in the trade list UI.
-- ============================================================

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS bundle_id UUID;

CREATE INDEX IF NOT EXISTS idx_trades_bundle_id ON trades(bundle_id);

-- ============================================================
-- FIX 2: Fix cancel_trade_v2 RPC - "seller_id" column error
-- ============================================================
-- The error "column seller_id does not exist" occurs because the
-- cancel_trade_v2 RPC (from migration 068) has a bug at line 77:
--   (SELECT balance FROM sp_ledger ...).balance
-- The sp_ledger table has balance_before and balance_after, not
-- "balance". This causes a cascading error that manifests as
-- "seller_id does not exist" due to how PostgreSQL reports the
-- error in the context of the function.
--
-- Fix: Replace the broken sp_ledger query with the correct
-- credit_sp_for_cancelled_trade RPC (same approach as migration 069).
-- ============================================================

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
  UPDATE trades
  SET 
    status = 'cancelled',
    cancellation_reason = p_reason,
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

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'bundle_id';
-- SELECT proname FROM pg_proc WHERE proname = 'cancel_trade_v2';
