-- ============================================================
-- FORCE FIX cancel_trade_v2 RPC
-- ============================================================
-- This script DROPS the old broken function and recreates it
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Force drop ALL variants of cancel_trade_v2
DROP FUNCTION IF EXISTS cancel_trade_v2(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS cancel_trade_v2(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_trade_v2(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_trade_v2(UUID, UUID) CASCADE;

-- Step 2: Recreate with fixed code
CREATE FUNCTION public.cancel_trade_v2(
  p_trade_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'User requested cancellation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_sp_refund_amount INTEGER := 0;
  v_sp_refund_ledger_id UUID := NULL;
  v_sp_refund_error TEXT := NULL;
BEGIN
  -- 1. Load and verify trade exists
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  
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
    SELECT amount INTO v_sp_refund_amount 
    FROM public.sp_ledger 
    WHERE id = v_trade.sp_debit_ledger_entry_id;
    
    IF v_sp_refund_amount IS NULL THEN
      v_sp_refund_amount := 0;
    END IF;

    IF v_sp_refund_amount > 0 THEN
      -- FIXED: Use RPC instead of broken sp_ledger.balance query
      BEGIN
        SELECT (public.credit_sp_for_cancelled_trade(
          v_trade.buyer_id, 
          p_trade_id, 
          v_sp_refund_amount
        ))->>'ledger_entry_id' 
        INTO v_sp_refund_ledger_id;
      EXCEPTION WHEN OTHERS THEN
        v_sp_refund_error := SQLERRM;
        v_sp_refund_ledger_id := NULL;
        v_sp_refund_amount := 0;
      END;
    END IF;
  END IF;

  -- 5. Update trade status to cancelled with reason
  UPDATE public.trades
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

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.cancel_trade_v2(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trade_v2(UUID, UUID, TEXT) TO service_role;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after to confirm the fix worked:

-- 1. Verify function exists
SELECT proname, pronamespace::regnamespace, proargtypes, prosrc 
FROM pg_proc 
WHERE proname = 'cancel_trade_v2';

-- 2. Test the RPC with your trade ID
SELECT public.cancel_trade_v2(
  '231f65ea-49f0-49a7-a0f9-1e337947affa'::uuid,
  'e9b9bd3d-5754-46ef-9a6f-bbc7848845ee'::uuid,
  'SQL Editor test after force drop'
);

-- If Query 2 returns success=true, YOU'RE FIXED! Test in your app.
-- If Query 2 still shows seller_id error, copy the prosrc from Query 1 and paste it here.
