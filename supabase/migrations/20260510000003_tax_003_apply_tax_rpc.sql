-- File: supabase/migrations/20260510000003_tax_003_apply_tax_rpc.sql
-- MODULE-15.3-PART3 TAX-003
CREATE OR REPLACE FUNCTION public.apply_tax_to_trade(p_trade_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trade RECORD; v_rate DECIMAL(5,4);
  v_taxable_cents INTEGER; v_tax_cents INTEGER;
  v_jurisdiction TEXT; v_existing UUID;
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

  v_rate := public.get_node_tax_rate(v_trade.node_id);
  v_taxable_cents := GREATEST(0,
    COALESCE(v_trade.cash_amount_cents, 0) - COALESCE(v_trade.buyer_transaction_fee_cents, 0));
  v_tax_cents := FLOOR((v_taxable_cents::numeric * v_rate) + 0.5)::INTEGER;

  SELECT n.tax_jurisdiction INTO v_jurisdiction FROM public.nodes n WHERE n.id = v_trade.node_id LIMIT 1;
  IF v_jurisdiction IS NULL THEN
    SELECT value INTO v_jurisdiction FROM public.admin_config WHERE key='tax_remittance_jurisdiction' LIMIT 1;
  END IF;

  UPDATE public.trades
     SET tax_amount_cents     = v_tax_cents,
         taxable_amount_cents = v_taxable_cents,
         tax_rate_applied     = v_rate,
         tax_jurisdiction     = v_jurisdiction,
         updated_at           = NOW()
   WHERE id = p_trade_id;

  INSERT INTO public.tax_records
    (trade_id, buyer_id, node_id, taxable_amount_cents, tax_rate, tax_amount_cents, tax_jurisdiction)
  VALUES
    (p_trade_id, v_trade.buyer_id, v_trade.node_id, v_taxable_cents, v_rate, v_tax_cents, v_jurisdiction)
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'trade_id', p_trade_id, 'tax_record_id', v_existing,
    'tax_amount_cents', v_tax_cents,
    'taxable_amount_cents', v_taxable_cents,
    'tax_rate_applied', v_rate,
    'tax_jurisdiction', v_jurisdiction,
    'idempotent_hit', false));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false,
    'error', jsonb_build_object('code','APPLY_TAX_ERROR','message', SQLERRM));
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_tax_to_trade(UUID) TO authenticated, service_role;
