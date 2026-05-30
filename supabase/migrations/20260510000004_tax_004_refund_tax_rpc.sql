-- File: supabase/migrations/20260510000004_tax_004_refund_tax_rpc.sql
-- MODULE-15.3-PART3 TAX-004
CREATE OR REPLACE FUNCTION public.refund_tax(
  p_trade_id UUID, p_refund_amount_cents INTEGER, p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_record RECORD; v_already INTEGER; v_max_left INTEGER;
BEGIN
  IF p_trade_id IS NULL OR p_refund_amount_cents IS NULL OR p_refund_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_INPUT','message','trade_id + positive refund_amount_cents required'));
  END IF;
  SELECT * INTO v_record FROM public.tax_records WHERE trade_id = p_trade_id FOR UPDATE LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','NO_TAX_RECORD','message','No tax was collected for this trade'));
  END IF;
  v_already := COALESCE(v_record.refunded_tax_cents, 0);
  v_max_left := v_record.tax_amount_cents - v_already;
  IF p_refund_amount_cents > v_max_left THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','REFUND_EXCEEDS_COLLECTED',
        'message','Refund exceeds collected tax remaining',
        'details', jsonb_build_object('remaining_cents', v_max_left)));
  END IF;
  UPDATE public.tax_records
     SET refunded_tax_cents = v_already + p_refund_amount_cents,
         refund_reason      = COALESCE(p_reason, refund_reason),
         updated_at         = NOW()
   WHERE id = v_record.id;
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'tax_record_id', v_record.id,
    'refunded_total', v_already + p_refund_amount_cents,
    'tax_amount_cents', v_record.tax_amount_cents,
    'remaining_cents', v_record.tax_amount_cents - (v_already + p_refund_amount_cents)));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false,
    'error', jsonb_build_object('code','REFUND_TAX_ERROR','message', SQLERRM));
END;
$$;
GRANT EXECUTE ON FUNCTION public.refund_tax(UUID, INTEGER, TEXT) TO authenticated, service_role;
