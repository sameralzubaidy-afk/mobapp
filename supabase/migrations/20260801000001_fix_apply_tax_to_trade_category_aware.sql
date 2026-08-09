-- File: supabase/migrations/20260801000001_fix_apply_tax_to_trade_category_aware.sql
-- Bug fix (2026-08-01): tax-exempt items were shown as taxed on the completed-trade
-- timeline (mobile), the admin Trade Details page, and the admin refund card, while
-- Stripe captured the correct amount with zero tax.
--
-- Root cause:
--   create-trade-offer computes the authoritative, category-aware tax at offer time
--   (tax_exempt_goods => $0) and stores it on trades. For exempt trades it does NOT
--   insert a tax_records row (only inserted when tax > 0).
--
--   On completion, completeTradeV2() (src/services/trade.ts) calls apply_tax_to_trade().
--   Because no tax_records row existed for the exempt trade, the old RPC's idempotency
--   check did not short-circuit, and it recomputed tax from the node's FLAT rate on
--   (cash_amount_cents - buyer_transaction_fee_cents):
--       FLOOR(9900 * 0.0635 + 0.5) = 629 cents   -- for a $100 exempt item with a $1 fee
--   and OVERWROTE trades.tax_amount_cents from 0 -> 629, plus inserted a bogus
--   tax_records row. Every screen reads trades.tax_amount_cents, so they showed $6.29.
--
-- Fix:
--   Make apply_tax_to_trade category-aware and consistent with create-trade-offer:
--     * Resolve the item's tax_category_id + full price (BP-37: SP/fee are NOT
--       discounts; taxable base = full item price, plus buyer platform fee only when
--       admin_config.include_fee_in_tax_base = true).
--     * Call the category-aware calculate_tax() RPC (deployed 20260729000001) so
--       tax_exempt_goods => $0, honoring the same rule as the offer-time path.
--     * Only persist nonzero tax (rate/jurisdiction) and only insert a tax_records
--       row when tax > 0 — mirroring create-trade-offer so exempt trades stay clean.
--   Legacy trades (item has no tax_category_id) fall back to the flat node rate,
--   preserving old behavior.
--
-- Mode B: idempotent rerunnable migration (CREATE OR REPLACE, signature unchanged —
-- no DROP required). Safe to re-run.

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_tax_to_trade(p_trade_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_rate DECIMAL(5,4);
  v_taxable_cents INTEGER;
  v_tax_cents INTEGER;
  v_jurisdiction TEXT;
  v_existing UUID;
  v_tax_category_id UUID;
  v_item_price_cents INTEGER;
  v_include_fee_in_base BOOLEAN;
  v_tax_result JSONB;
  v_tax_data JSONB;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_INPUT','message','p_trade_id required'));
  END IF;

  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','TRADE_NOT_FOUND','message','Trade does not exist'));
  END IF;

  SELECT id INTO v_existing FROM public.tax_records WHERE trade_id = p_trade_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
      'trade_id', p_trade_id, 'tax_record_id', v_existing,
      'tax_amount_cents', v_trade.tax_amount_cents,
      'taxable_amount_cents', v_trade.taxable_amount_cents,
      'tax_rate_applied', v_trade.tax_rate_applied,
      'tax_jurisdiction', v_trade.tax_jurisdiction,
      'idempotent_hit', true));
  END IF;

  -- Resolve the item's tax category + full price so the same category-aware rule
  -- (tax_exempt_goods => non-taxable) used by create-trade-offer is honored here.
  SELECT i.tax_category_id, (i.price * 100)::INTEGER
    INTO v_tax_category_id, v_item_price_cents
    FROM public.items i
   WHERE i.id = v_trade.listing_id
   LIMIT 1;

  -- BP-37: taxable base = full item price (SP is tender, not a discount).
  -- include_fee_in_tax_base toggle mirrors create-trade-offer.
  v_taxable_cents := COALESCE(v_item_price_cents, 0);
  SELECT (value::boolean) INTO v_include_fee_in_base
    FROM public.admin_config WHERE key = 'include_fee_in_tax_base' LIMIT 1;
  IF COALESCE(v_include_fee_in_base, false) THEN
    v_taxable_cents := v_taxable_cents + COALESCE(v_trade.buyer_transaction_fee_cents, 0);
  END IF;

  -- Category-aware calculation. For legacy trades (item has no tax_category_id,
  -- v_tax_category_id is NULL) calculate_tax falls back to the flat node rate,
  -- preserving the old behavior.
  v_tax_result := public.calculate_tax(
    v_trade.node_id,
    v_taxable_cents,
    v_tax_category_id,
    v_item_price_cents
  );

  IF (v_tax_result->>'success') <> 'true' THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','APPLY_TAX_ERROR','message','Tax calculation failed'));
  END IF;

  v_tax_data := v_tax_result->'data';
  v_tax_cents := (v_tax_data->>'tax_amount_cents')::INTEGER;
  v_rate := (v_tax_data->>'tax_rate')::DECIMAL(5,4);
  v_jurisdiction := v_tax_data->>'tax_jurisdiction';

  -- Only persist nonzero tax + rate; exempt trades stay clean (0 / NULL), which is
  -- exactly what the mobile timeline and admin views read.
  UPDATE public.trades
     SET tax_amount_cents     = v_tax_cents,
         taxable_amount_cents = CASE WHEN v_tax_cents > 0 THEN v_taxable_cents ELSE 0 END,
         tax_rate_applied     = CASE WHEN v_tax_cents > 0 THEN v_rate ELSE NULL END,
         tax_jurisdiction     = CASE WHEN v_tax_cents > 0 THEN v_jurisdiction ELSE NULL END,
         updated_at           = NOW()
   WHERE id = p_trade_id;

  -- Mirror create-trade-offer: exempt/zero-tax trades get NO tax_records row, so
  -- tax reports and the lifecycle RPCs treat them as zero-tax (noop).
  IF v_tax_cents > 0 THEN
    INSERT INTO public.tax_records
      (trade_id, buyer_id, node_id, taxable_amount_cents, tax_rate, tax_amount_cents, tax_jurisdiction)
    VALUES
      (p_trade_id, v_trade.buyer_id, v_trade.node_id, v_taxable_cents, v_rate, v_tax_cents, v_jurisdiction)
    RETURNING id INTO v_existing;
  END IF;

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'trade_id', p_trade_id,
    'tax_record_id', v_existing,
    'tax_amount_cents', v_tax_cents,
    'taxable_amount_cents', CASE WHEN v_tax_cents > 0 THEN v_taxable_cents ELSE 0 END,
    'tax_rate_applied', CASE WHEN v_tax_cents > 0 THEN v_rate ELSE NULL END,
    'tax_jurisdiction', CASE WHEN v_tax_cents > 0 THEN v_jurisdiction ELSE NULL END,
    'idempotent_hit', false));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false,
    'error', jsonb_build_object('code','APPLY_TAX_ERROR','message', SQLERRM));
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_tax_to_trade(UUID) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- Verification queries (run after applying this migration)
-- ============================================================================
-- 1) Confirm the RPC is category-aware (exempt item => 0 tax, no tax_records row):
--    SELECT public.apply_tax_to_trade('<TRADE_ID_OF_EXEMPT_ITEM>');
--    Expected: data.tax_amount_cents = 0, tax_rate_applied = null.
--    Then: SELECT COUNT(*) FROM public.tax_records WHERE trade_id = '<TRADE_ID>';
--    Expected: 0 (no record created for zero-tax).
--
-- 2) Confirm a taxable item still gets node-rate tax (no regression):
--    SELECT public.apply_tax_to_trade('<TRADE_ID_OF_TAXABLE_ITEM>');
--    Expected: data.tax_amount_cents > 0 and matches the offer-time value.
