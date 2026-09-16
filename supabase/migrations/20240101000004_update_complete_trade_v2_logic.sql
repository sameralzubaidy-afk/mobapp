-- filepath: supabase/migrations/067_update_complete_trade_v2_logic.sql

-- Mode B: Idempotent rerunnable migration
-- Update complete_trade_v2 to require buyer confirmation if seller initiates completion.

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

  -- 3. Verify authorization
  IF p_user_id IS NOT NULL AND p_user_id <> v_trade.buyer_id AND p_user_id <> v_trade.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 4. Logic for Seller-initiated completion
  IF p_user_id = v_trade.seller_id THEN
    UPDATE trades
    SET 
      seller_marked_completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_trade_id;

    RETURN jsonb_build_object(
      'success', true,
      'trade_id', p_trade_id,
      'status', 'in_progress',
      'message', 'Seller marked trade as completed. Awaiting buyer confirmation.'
    );
  END IF;

  -- 5. Logic for Buyer or System-initiated completion
  -- (If p_user_id is buyer or NULL, we proceed to full completion)

  -- Load listing to get item price
  SELECT * INTO v_listing FROM items WHERE id = v_trade.listing_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  v_item_price_cents := (v_listing.price * 100)::INTEGER;

  -- Update trade status
  UPDATE trades
  SET 
    status = 'completed',
    completed_at = NOW(),
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- Update item status
  UPDATE items
  SET 
    status = 'sold',
    updated_at = NOW()
  WHERE id = v_trade.listing_id;

  -- Credit SP to seller only when buyer used Swap Points (sp_amount > 0)
  -- and seller is eligible to earn SP. Previously this awarded points
  -- equal to the item price which incorrectly granted points on cash-only trades.
  SELECT get_subscription_summary(v_trade.seller_id) INTO v_seller_sub;

  IF (v_seller_sub->>'can_earn_sp')::BOOLEAN = TRUE AND COALESCE(v_trade.sp_amount, 0) > 0 THEN
    -- In V2, seller earns SP equal to the Swap Points used by the buyer for this trade.
    v_earned_points := COALESCE(v_trade.sp_amount, 0);

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
