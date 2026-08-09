-- Migration: 20260727000001_add_seller_transaction_fee_cents
-- Mode B: Idempotent rerunnable migration
--
-- Purpose: Add seller_transaction_fee_cents column to the trades table.
--          This stores the platform's seller-side commission calculated at
--          offer creation time using admin_config.platform_fee_seller_percentage.
--
-- Spec: docx/SYSTEM_REQUIREMENTS_V2.md § Fee Configuration
--        The seller fee is deducted from the seller's payout at trade completion.
--        New offers only — existing trades will have 0 (no backfill).
--
-- BP-30 cross-reference: platform_fee_seller_percentage is defined in
--   supabase/migrations/20250113_create_admin_config.sql (default '5').

-- =============================================================================
-- BLOCK 1: Schema
-- =============================================================================

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS seller_transaction_fee_cents INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- BLOCK 2: Update complete_trade_v2 to deduct seller fee from payout
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
    v_seller_fee_cents INTEGER;
    v_net_cash_cents INTEGER;
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
    v_seller_fee_cents := COALESCE((to_jsonb(v_trade.seller_transaction_fee_cents) #>> '{}')::integer, 0);
    v_net_cash_cents := GREATEST(0, v_cash_amount_cents - v_seller_fee_cents);
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

        -- 3. Update payout_amount_cents on the trade with the net cash (after seller fee deduction)
        UPDATE public.trades
        SET payout_amount_cents = v_net_cash_cents,
            updated_at = now()
        WHERE id = p_trade_id;

        -- 4. Create seller payout record (§6.3.1 / PAY-006)
        --    Called only when there's cash to pay out.
        --    The gross amount passed is v_net_cash_cents (cash minus seller platform fee).
        v_payout_result := NULL;
        IF v_net_cash_cents > 0 THEN
            SELECT public.create_seller_payout_on_trade_completion(
                p_trade_id,
                v_seller_id,
                v_net_cash_cents
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

-- Grant execute permissions (idempotent)
GRANT EXECUTE ON FUNCTION public.complete_trade_v2(UUID, UUID) TO anon, authenticated;

-- =============================================================================
-- Verification queries
-- =============================================================================
-- 1) Verify the column exists
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'trades' AND column_name = 'seller_transaction_fee_cents';
--
-- 2) Verify the RPC deducts seller fee correctly:
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'complete_trade_v2';
-- Expected: the function body should contain 'seller_transaction_fee_cents' and 'v_net_cash_cents'
