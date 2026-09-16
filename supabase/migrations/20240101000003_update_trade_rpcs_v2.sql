-- File: supabase/migrations/064_update_trade_rpcs_v2.sql
-- MODULE-06 TRADE-FLOW-V2: Update Trade RPCs for correct SP earning and robustness

-- Mode B: Idempotent rerunnable migration

-- 1. Update complete_trade_v2 to correctly credit seller SP based on item price
CREATE OR REPLACE FUNCTION complete_trade_v2(
  p_trade_id UUID,
  p_user_id UUID DEFAULT NULL -- The user calling the function (NULL for system/auto-complete)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade RECORD;
  v_listing RECORD;
  v_seller_sub JSONB;
  v_earn_result JSONB;
  v_earned_points INTEGER;
  v_item_price_cents INTEGER;
BEGIN
  -- 1. Load trade and verify existence
  SELECT * INTO v_trade FROM trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- 2. Verify status
  IF v_trade.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade is not in progress');
  END IF;

  -- 3. Verify authorization (only buyer or seller can complete, or system if p_user_id is NULL)
  IF p_user_id IS NOT NULL AND p_user_id <> v_trade.buyer_id AND p_user_id <> v_trade.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 4. Load listing to get item price
  SELECT * INTO v_listing FROM items WHERE id = v_trade.listing_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  v_item_price_cents := (v_listing.price * 100)::INTEGER;

  -- 5. Update trade status
  UPDATE trades
  SET 
    status = 'completed',
    completed_at = NOW(),
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- 6. Update item status
  UPDATE items
  SET 
    status = 'sold',
    updated_at = NOW()
  WHERE id = v_trade.listing_id;

  -- 7. Credit SP to seller if they are eligible (Kids Club+ subscribers)
  -- V2 Rule: Seller earns SP equal to item price in dollars.
  
  -- Get seller subscription summary
  SELECT get_subscription_summary(v_trade.seller_id) INTO v_seller_sub;
  
  IF (v_seller_sub->>'can_earn_sp')::BOOLEAN = TRUE THEN
    v_earned_points := floor(v_item_price_cents / 100);
    
    IF v_earned_points > 0 THEN
      SELECT earn_sp_for_trade(
        v_trade.seller_id,
        v_trade.id,
        v_earned_points
      ) INTO v_earn_result;

      -- Link the credit ledger entry to the trade
      UPDATE trades
      SET sp_credit_ledger_entry_id = (v_earn_result->>'ledger_entry_id')::UUID
      WHERE id = p_trade_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'status', 'completed',
    'sp_earned', COALESCE(v_earned_points, 0)
  );
END;
$$;

-- 2. Update cancel_trade_v2 to handle Stripe refund logic (via metadata or flag)
-- Note: Actual Stripe refund happens in Edge Function, but RPC handles SP refund.
CREATE OR REPLACE FUNCTION cancel_trade_v2(
  p_trade_id UUID,
  p_user_id UUID, -- The user calling the function
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade RECORD;
  v_refund_result JSONB;
BEGIN
  -- 1. Load trade
  SELECT * INTO v_trade FROM trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- 2. Verify status (can only cancel if not already completed/cancelled)
  IF v_trade.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade already finalized');
  END IF;

  -- 3. Verify authorization (buyer or seller)
  IF p_user_id <> v_trade.buyer_id AND p_user_id <> v_trade.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 4. Update trade status
  UPDATE trades
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = p_reason,
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- 5. Update item status back to available
  UPDATE items
  SET 
    status = 'available',
    updated_at = NOW()
  WHERE id = v_trade.listing_id;

  -- 6. Refund SP to buyer if they spent any
  -- Only refund if the trade was already paid (in_progress or payment_processing)
  IF v_trade.sp_amount > 0 AND v_trade.status IN ('in_progress', 'payment_processing') THEN
    SELECT credit_sp_for_cancelled_trade(
      v_trade.buyer_id,
      v_trade.id,
      v_trade.sp_amount
    ) INTO v_refund_result;

    -- Link the refund ledger entry
    UPDATE trades
    SET sp_credit_ledger_entry_id = (v_refund_result->>'ledger_entry_id')::UUID
    WHERE id = p_trade_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'status', 'cancelled',
    'sp_refunded', CASE WHEN v_trade.status IN ('in_progress', 'payment_processing') THEN v_trade.sp_amount ELSE 0 END
  );
END;
$$;

-- 3. Verification query
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'trades'::regclass AND conname = 'trades_status_check';
