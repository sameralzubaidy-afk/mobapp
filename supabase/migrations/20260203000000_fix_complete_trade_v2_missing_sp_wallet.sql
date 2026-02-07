-- Migration: 20260203000000_fix_complete_trade_v2_missing_sp_wallet.sql
-- Mode B: Idempotent rerunnable migration
-- Purpose: Fix `complete_trade_v2` to handle missing SP wallet gracefully
--          Ensure wallet is created if missing before awarding SP

-- =============================================================================
-- BLOCK 1 — Update earn_sp_for_trade to ensure wallet exists
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_sp_wallet_exists(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet
  SELECT w.id INTO v_wallet_id
  FROM public.sp_wallets AS w
  WHERE w.user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    -- Create new wallet if missing.
    -- IMPORTANT: Insert only user_id so this function works across schema versions
    -- (e.g., status->state rename, additional columns added later).
    INSERT INTO public.sp_wallets (user_id)
    VALUES (p_user_id)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_sp_wallet_exists(UUID) TO authenticated;

-- =============================================================================
-- BLOCK 2 — Update earn_sp_for_trade to ensure wallet exists first
-- =============================================================================

CREATE OR REPLACE FUNCTION public.earn_sp_for_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_ledger_id UUID;
BEGIN
  -- Validate p_points is positive
  IF p_points IS NULL OR p_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid SP points amount');
  END IF;

  -- 1. Ensure wallet exists
  v_wallet_id := public.ensure_sp_wallet_exists(p_user_id);

  -- 2. Get current balance
  SELECT available_balance INTO v_balance_before
  FROM public.sp_wallets AS w
  WHERE w.id = v_wallet_id;

  IF v_balance_before IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to retrieve wallet balance');
  END IF;

  -- 3. Update wallet balance
  UPDATE public.sp_wallets AS w
  SET 
    available_balance = w.available_balance + p_points,
    lifetime_earned = w.lifetime_earned + p_points,
    updated_at = NOW()
  WHERE w.id = v_wallet_id;

  v_balance_after := v_balance_before + p_points;

  -- 4. Create ledger entry
  INSERT INTO public.sp_ledger (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    related_transaction_id
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    'earn_reward',
    p_points,
    v_balance_before,
    v_balance_after,
    'Swap Points earned from trade ' || p_trade_id,
    p_trade_id
  )
  RETURNING id INTO v_ledger_id;

  -- 5. Create a new batch for these points (expires in 90 days)
  INSERT INTO public.sp_batches (
    wallet_id,
    user_id,
    initial_sp,
    remaining_sp,
    source_type,
    source_id,
    expires_at
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    p_points,
    p_points,
    'reward',
    p_trade_id,
    NOW() + INTERVAL '90 days'
  );

  RETURN jsonb_build_object(
    'success', true,
    'ledger_entry_id', v_ledger_id,
    'balance_after', v_balance_after
  );
END;
$$;

-- =============================================================================
-- BLOCK 3 — Update complete_trade_v2 with better error handling
-- =============================================================================

CREATE OR REPLACE FUNCTION public.complete_trade_v2(
  p_trade_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade public.trades%ROWTYPE;
  v_sp_result JSONB;
  v_payout_result JSON;
  v_config RECORD;
  v_can_earn_sp BOOLEAN;
  v_error_msg TEXT;
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

  -- Award SP to seller only if they can earn SP and buyer used SP
  v_sp_result := NULL;
  IF v_trade.seller_id IS NOT NULL THEN
    -- Be resilient to subscription schema drift
    v_can_earn_sp := FALSE;
    BEGIN
      SELECT gss.can_spend_sp
      INTO v_can_earn_sp
      FROM public.get_subscription_summary(v_trade.seller_id) AS gss;
    EXCEPTION
      WHEN OTHERS THEN
        v_can_earn_sp := FALSE;
    END;

    IF v_can_earn_sp = TRUE AND COALESCE(v_trade.sp_amount, 0) > 0 THEN
      BEGIN
        SELECT public.earn_sp_for_trade(v_trade.seller_id, p_trade_id, v_trade.sp_amount)
        INTO v_sp_result;

        -- Link the credit ledger entry to the trade if present
        IF v_sp_result IS NOT NULL AND (v_sp_result->>'ledger_entry_id') IS NOT NULL THEN
          UPDATE public.trades
          SET sp_credit_ledger_entry_id = (v_sp_result->>'ledger_entry_id')::UUID
          WHERE public.trades.id = p_trade_id;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log but don't fail trade completion if SP awarding fails
          v_sp_result := jsonb_build_object(
            'success', false,
            'error', 'Failed to award SP: ' || SQLERRM
          );
          RAISE WARNING 'complete_trade_v2 SP award error: %', SQLERRM;
      END;
    END IF;
  END IF;

  -- PAY-006 payout-router integration
  v_payout_result := NULL;
  IF v_trade.seller_id IS NOT NULL AND COALESCE(v_trade.cash_amount_cents, 0) > 0 THEN
    BEGIN
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
    EXCEPTION
      WHEN OTHERS THEN
        v_payout_result := json_build_object(
          'success', false,
          'error', 'Failed to create payout: ' || SQLERRM
        );
        RAISE WARNING 'complete_trade_v2 payout error: %', SQLERRM;
    END;
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
      'error', SQLERRM,
      'details', 'Unexpected error completing trade'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_trade_v2(UUID, UUID) TO anon, authenticated;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify functions exist
SELECT proname, prosrc
FROM pg_proc
WHERE proname IN ('ensure_sp_wallet_exists', 'earn_sp_for_trade', 'complete_trade_v2')
ORDER BY proname;
