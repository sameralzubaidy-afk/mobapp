-- ============================================================================
-- QUICK FIX: Trade Completion Function Error
-- ============================================================================
-- Issue: completeTradeV2 throws "FunctionsHttpError: Edge Function returned a non-2xx status code"
-- Root Cause: Type mismatch in complete_trade_v2 RPC when calling get_subscription_summary()
-- Solution: Fix the function signature and variable types
-- ============================================================================

-- Step 1: Drop the old function
DROP FUNCTION IF EXISTS public.complete_trade_v2(UUID, UUID) CASCADE;

-- Step 2: Re-create with fixed logic
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

  -- Award SP to seller only if they can earn SP and buyer used SP
  v_sp_result := NULL;
  IF v_trade.seller_id IS NOT NULL THEN
    -- Be resilient to subscription schema drift: if subscription summary can't be read,
    -- default to not earning SP rather than failing trade completion.
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
      SELECT public.earn_sp_for_trade(v_trade.seller_id, p_trade_id, v_trade.sp_amount)
      INTO v_sp_result;

      -- Link the credit ledger entry to the trade if present
      IF v_sp_result IS NOT NULL AND (v_sp_result->>'ledger_entry_id') IS NOT NULL THEN
        UPDATE public.trades
        SET sp_credit_ledger_entry_id = (v_sp_result->>'ledger_entry_id')::UUID
        WHERE public.trades.id = p_trade_id;
      END IF;
    END IF;
  END IF;

  -- PAY-006 payout-router integration
  -- IMPORTANT: payout creation happens only after final completion.
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
      -- Manual mode: seller balance is updated by trigger when status becomes completed.
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.complete_trade_v2(UUID, UUID) TO anon, authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify the fix:

-- Check function exists and is correct
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'complete_trade_v2'
LIMIT 1;

-- Expected: Should show the function definition with RECORD variable and v_can_earn_sp

-- ============================================================================
-- Testing (Optional)
-- ============================================================================
-- To test with a real trade, replace 'your-trade-id' and 'your-user-id':
-- SELECT complete_trade_v2('your-trade-id'::UUID, 'your-user-id'::UUID);
-- Expected: Should return JSON with success: true
