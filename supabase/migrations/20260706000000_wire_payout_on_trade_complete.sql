-- Migration: 20260706000000_wire_payout_on_trade_complete
-- Mode B: Idempotent rerunnable
--
-- Purpose:
--   1. Wire `create_seller_payout_on_trade_completion()` into `complete_trade_v2()`
--      so that every completed trade creates a `seller_payouts` record.
--   2. Update `create_seller_payout_on_trade_completion()` to also set
--      `trades.payout_status` and include `status` in its return value.
--
-- Spec: docx/TRADING-FLOW-V2.md §6.3.1, §6.3.3
--   - When seller has no verified payout method → `requires_action`
--   - Payout uses idempotency key to prevent duplicates

-- =============================================================================
-- BLOCK 1: Update create_seller_payout_on_trade_completion to return status
--          and update trades.payout_status
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_seller_payout_on_trade_completion(
  p_trade_id UUID,
  p_seller_id UUID,
  p_gross_amount_cents INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_config RECORD;
  v_primary_method RECORD;
  v_payout_fee_cents INTEGER;
  v_net_amount_cents INTEGER;
  v_payout_status TEXT;
  v_payout_id UUID;
  v_idempotency_key TEXT;
  v_existing_payout UUID;
BEGIN
  -- Generate idempotency key: matches spec §6.3.4 pattern
  v_idempotency_key := 'trade:' || p_trade_id::TEXT || ':seller:' || p_seller_id::TEXT;

  -- Check if payout already exists (idempotency)
  SELECT sp.id INTO v_existing_payout
  FROM public.seller_payouts sp
  WHERE sp.idempotency_key = v_idempotency_key;

  IF v_existing_payout IS NOT NULL THEN
    -- Return the existing status so caller can sync trades.payout_status
    SELECT sp.status INTO v_payout_status
    FROM public.seller_payouts sp
    WHERE sp.id = v_existing_payout;

    RETURN json_build_object(
      'success', true,
      'payout_id', v_existing_payout,
      'status', v_payout_status,
      'message', 'Payout already exists',
      'is_new', false
    );
  END IF;

  -- Get admin config (safe: uses existing function with safe parsing)
  SELECT * INTO v_config FROM public.get_admin_payout_config() LIMIT 1;

  -- Get seller's primary payout method
  SELECT * INTO v_primary_method
  FROM public.seller_payout_methods
  WHERE user_id = p_seller_id
    AND is_primary = TRUE
    AND is_verified = TRUE
  LIMIT 1;

  -- Determine payout status based on config and method availability (§6.3.1)
  IF NOT v_config.enable_automatic_seller_payout THEN
    -- Manual withdrawal mode: always create pending
    v_payout_status := 'pending';
    v_payout_fee_cents := 0;
    v_net_amount_cents := p_gross_amount_cents;
  ELSIF v_primary_method IS NULL THEN
    -- Auto-payout enabled but no verified method → requires_action (§6.3.3)
    v_payout_status := 'requires_action';
    v_payout_fee_cents := 0;
    v_net_amount_cents := p_gross_amount_cents;
  ELSE
    -- Auto-payout enabled and method available
    v_payout_fee_cents := public.calculate_payout_fee_cents(v_primary_method.method_type, p_gross_amount_cents);
    v_net_amount_cents := GREATEST(0, p_gross_amount_cents - v_payout_fee_cents);
    v_payout_status := 'processing';
  END IF;

  -- Create payout record
  INSERT INTO public.seller_payouts (
    user_id,
    trade_id,
    payout_method_id,
    currency,
    gross_amount_cents,
    platform_fee_cents,
    payout_fee_cents,
    net_amount_cents,
    status,
    provider,
    idempotency_key,
    initiated_at,
    created_at,
    updated_at
  ) VALUES (
    p_seller_id,
    p_trade_id,
    v_primary_method.id, -- NULL if requires_action or pending
    'usd',
    p_gross_amount_cents,
    0, -- Platform fee is $0 per policy
    v_payout_fee_cents,
    v_net_amount_cents,
    v_payout_status,
    CASE
      WHEN v_primary_method.id IS NOT NULL AND v_primary_method.method_type = 'stripe_connect' THEN 'stripe'
      WHEN v_primary_method.id IS NOT NULL AND v_primary_method.method_type IN ('paypal', 'venmo') THEN 'paypal'
      WHEN v_primary_method.id IS NOT NULL AND v_primary_method.method_type = 'bank_ach' THEN 'ach'
      ELSE NULL
    END,
    v_idempotency_key,
    CASE WHEN v_payout_status = 'processing' THEN now() ELSE NULL END,
    now(),
    now()
  ) RETURNING id INTO v_payout_id;

  -- Sync trades.payout_status to match the seller_payouts record (§6.3.2)
  UPDATE public.trades
  SET payout_status = v_payout_status,
      payout_idempotency_key = 'payout_' || p_trade_id::TEXT,
      updated_at = now()
  WHERE id = p_trade_id;

  RETURN json_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'status', v_payout_status,
    'is_new', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- BLOCK 2: Update complete_trade_v2 to call create_seller_payout_on_trade_completion
-- =============================================================================

CREATE OR REPLACE FUNCTION public.complete_trade_v2(
    p_trade_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_trade RECORD;
    v_seller_id UUID;
    v_buyer_id UUID;
    v_sp_amount INTEGER;
    v_cash_amount_cents INTEGER;
    v_listing_id UUID;
    v_payout_result JSONB;
BEGIN
    SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
    END IF;

    v_seller_id := v_trade.seller_id;
    v_buyer_id := v_trade.buyer_id;
    v_sp_amount := COALESCE((to_jsonb(v_trade.sp_amount) #>> '{}')::integer, 0);
    v_cash_amount_cents := COALESCE((to_jsonb(v_trade.cash_amount_cents) #>> '{}')::integer, 0);
    v_listing_id := v_trade.listing_id;

    -- CASE 1: SELLER marks complete (First step)
    IF p_user_id = v_seller_id THEN
        UPDATE public.trades
        SET seller_marked_completed_at = now(),
            status = CASE WHEN buyer_marked_completed_at IS NOT NULL THEN 'completed' ELSE status END,
            completed_at = CASE WHEN buyer_marked_completed_at IS NOT NULL THEN now() ELSE completed_at END
        WHERE id = p_trade_id
        RETURNING * INTO v_trade;

        IF v_trade.status = 'completed' THEN
            NULL; -- fall through to CASE 2
        ELSE
            RETURN jsonb_build_object('success', true, 'status', v_trade.status, 'trade', row_to_json(v_trade));
        END IF;
    END IF;

    -- CASE 2: BUYER marks complete (Second step / finalize)
    IF p_user_id = v_buyer_id OR v_trade.status = 'completed' THEN
        UPDATE public.trades
        SET buyer_marked_completed_at = now(),
            status = 'completed',
            completed_at = now()
        WHERE id = p_trade_id
        RETURNING * INTO v_trade;

        -- 1. Update Item
        UPDATE public.items SET status = 'sold', updated_at = now() WHERE id = v_listing_id;

        -- 2. SP is handled by fn_release_all_sp_on_complete() trigger — no manual SP call needed.

        -- 3. Create seller payout record (§6.3.1 / PAY-006)
        --    Called only when there's cash to pay out.
        v_payout_result := NULL;
        IF v_cash_amount_cents > 0 THEN
            SELECT public.create_seller_payout_on_trade_completion(
                p_trade_id,
                v_seller_id,
                v_cash_amount_cents
            ) INTO v_payout_result;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'completed',
            'payout_result', v_payout_result,
            'trade', row_to_json(v_trade)
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.complete_trade_v2(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_payout_on_trade_completion(UUID, UUID, INTEGER) TO anon, authenticated;

-- =============================================================================
-- Verification queries
-- =============================================================================
-- 1) Confirm functions exist with updated definitions
-- SELECT proname, prosrc FROM pg_proc WHERE proname IN ('complete_trade_v2', 'create_seller_payout_on_trade_completion');
--
-- 2) Confirm seller_payouts table structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'seller_payouts';
--
-- 3) Confirm trades.payout_status column exists
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'payout_status';
