-- Migration: 090_fix_trade_sp_credit_integrity.sql
-- Module: MODULE-06 TRADE-FLOW-V2
-- Purpose: 
--   1. Ensure `complete_trade_v2` ALWAYS credits SP if the trade has `sp_amount > 0`
--   2. Fix `get_subscription_summary` to include 'grace' status and handle multiple rows
--   3. Resolve reported issue where `sp_credit_ledger_entry_id` was NULL for completed trades

-- =============================================================================
-- 1. DROP FUNCTIONS FIRST (Avoid 42P13: cannot change return type)
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_subscription_summary(uuid);
DROP FUNCTION IF EXISTS public.complete_trade_v2(uuid, uuid);

-- =============================================================================
-- 2. FIX get_subscription_summary (Handle multiple rows & include grace)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_subscription_summary(p_user_id UUID)
RETURNS TABLE (
  status TEXT,
  can_spend_sp BOOLEAN,
  trial_end_date TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.status,
    CASE 
      WHEN s.status IN ('trial', 'active', 'grace') THEN TRUE
      ELSE FALSE
    END AS can_spend_sp,
    s.trial_end_date,
    s.current_period_end
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY 
    CASE WHEN s.status IN ('active', 'trial', 'grace') THEN 0 ELSE 1 END,
    s.created_at DESC
  LIMIT 1;
END;
$$;

-- =============================================================================
-- 3. FIX complete_trade_v2 (Robust SP crediting)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.complete_trade_v2(
  p_trade_id UUID,
  p_user_id UUID DEFAULT NULL -- NULL allowed for system/auto-complete
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade public.trades%ROWTYPE;
  v_sp_result JSONB;
  v_payout_result JSON;
  v_config RECORD;
  v_can_earn_sp BOOLEAN;
BEGIN
  -- Lock trade row for update
  SELECT * INTO v_trade
  FROM public.trades
  WHERE public.trades.id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- Verify trade is in_progress
  IF v_trade.status <> 'in_progress' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Trade must be in_progress to complete. Current status: ' || v_trade.status
    );
  END IF;

  -- Verify authorization (buyer or seller) unless system call
  IF p_user_id IS NOT NULL AND p_user_id <> v_trade.buyer_id AND p_user_id <> v_trade.seller_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Seller-initiated completion: record timestamp only, do NOT complete trade
  IF p_user_id = v_trade.seller_id THEN
    IF v_trade.seller_marked_completed_at IS NULL THEN
      UPDATE public.trades
      SET seller_marked_completed_at = NOW(),
          updated_at = NOW()
      WHERE public.trades.id = p_trade_id;
    END IF;

    RETURN json_build_object(
      'success', true,
      'trade_id', p_trade_id,
      'status', 'in_progress',
      'message', 'Seller marked trade as completed. Awaiting buyer confirmation.'
    );
  END IF;

  -- Buyer (or system) finalizes the trade
  UPDATE public.trades
  SET status = 'completed',
      completed_at = NOW(),
      last_status_change_at = NOW(),
      updated_at = NOW()
  WHERE public.trades.id = p_trade_id;

  UPDATE public.items
  SET status = 'sold',
      updated_at = NOW()
  WHERE public.items.id = v_trade.listing_id;

  -- Link SP and create ledger entries
  v_sp_result := NULL;
  
  -- AWARD SP: Robust lookup to avoid crashes
  IF COALESCE(v_trade.sp_amount, 0) > 0 THEN
    SELECT public.earn_sp_for_trade(v_trade.seller_id, p_trade_id, v_trade.sp_amount)
    INTO v_sp_result;

    -- Link the credit ledger entry to the trade if present
    IF v_sp_result IS NOT NULL AND (v_sp_result->>'ledger_entry_id') IS NOT NULL THEN
      UPDATE public.trades
      SET sp_credit_ledger_entry_id = (v_sp_result->>'ledger_entry_id')::UUID
      WHERE public.trades.id = p_trade_id;
    END IF;
  END IF;

  -- PAY-006 payout-router integration
  v_payout_result := NULL;
  IF v_trade.seller_id IS NOT NULL AND COALESCE(v_trade.cash_amount_cents, 0) > 0 THEN
    SELECT * INTO v_config FROM public.get_admin_payout_config() LIMIT 1;

    IF COALESCE(v_config.enable_automatic_seller_payout, FALSE) THEN
      SELECT public.create_seller_payout_on_trade_completion(
        p_trade_id,
        v_trade.seller_id,
        v_trade.cash_amount_cents
      ) INTO v_payout_result;
    ELSE
      v_payout_result := json_build_object(
        'success', true,
        'message', 'Manual withdrawal mode - seller can request payout from balance',
        'auto_payout_enabled', false
      );
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'status', 'completed',
    'message', 'Trade completed successfully',
    'sp_result', v_sp_result,
    'payout_result', v_payout_result
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =============================================================================
-- 4. BACKFILL FOR REPORTED TRADE (77f12e7d-90a1-4e66-b78c-b6913e1f648b)
-- =============================================================================

DO $$
DECLARE
  v_trade_id UUID := '77f12e7d-90a1-4e66-b78c-b6913e1f648b';
  v_trade RECORD;
  v_sp_result JSONB;
BEGIN
  -- Load the trade
  SELECT * INTO v_trade FROM trades WHERE id = v_trade_id;
  
  IF FOUND AND v_trade.status = 'completed' AND v_trade.sp_amount > 0 AND v_trade.sp_credit_ledger_entry_id IS NULL THEN
    -- Force credit the points
    SELECT public.earn_sp_for_trade(v_trade.seller_id, v_trade.id, v_trade.sp_amount)
    INTO v_sp_result;
    
    IF v_sp_result->>'ledger_entry_id' IS NOT NULL THEN
      UPDATE trades 
      SET sp_credit_ledger_entry_id = (v_sp_result->>'ledger_entry_id')::UUID
      WHERE id = v_trade_id;
      
      RAISE NOTICE 'Manually fixed missing SP credit for trade %', v_trade_id;
    END IF;
  END IF;
END;
$$;
