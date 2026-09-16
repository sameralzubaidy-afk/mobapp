-- File: supabase/migrations/20260510000005_tax_005_get_tax_summary_rpc.sql
-- MODULE-15.3-PART3 TAX-005
CREATE OR REPLACE FUNCTION public.get_tax_summary_for_period(
  p_start_date DATE, p_end_date DATE, p_node_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_collected BIGINT; v_total_refunded BIGINT; v_total_taxable BIGINT;
  v_txn_count BIGINT; v_by_jurisdiction JSONB;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_INPUT','message','start/end required'));
  END IF;
  SELECT COALESCE(SUM(tr.tax_amount_cents),0), COALESCE(SUM(tr.refunded_tax_cents),0),
         COALESCE(SUM(tr.taxable_amount_cents),0), COUNT(*)
    INTO v_total_collected, v_total_refunded, v_total_taxable, v_txn_count
    FROM public.tax_records tr
    WHERE tr.created_at::date BETWEEN p_start_date AND p_end_date
      AND (p_node_id IS NULL OR tr.node_id = p_node_id);
  SELECT COALESCE(jsonb_agg(row_to_json(j)), '[]'::jsonb) INTO v_by_jurisdiction FROM (
    SELECT COALESCE(tr.tax_jurisdiction,'UNKNOWN') AS jurisdiction,
           COUNT(*) AS transaction_count,
           SUM(tr.taxable_amount_cents) AS taxable_total_cents,
           SUM(tr.tax_amount_cents)     AS tax_collected_cents,
           SUM(tr.refunded_tax_cents)   AS tax_refunded_cents,
           SUM(tr.tax_amount_cents - tr.refunded_tax_cents) AS tax_net_cents
    FROM public.tax_records tr
    WHERE tr.created_at::date BETWEEN p_start_date AND p_end_date
      AND (p_node_id IS NULL OR tr.node_id = p_node_id)
    GROUP BY COALESCE(tr.tax_jurisdiction,'UNKNOWN') ORDER BY 1
  ) j;
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'start_date', p_start_date, 'end_date', p_end_date, 'node_id', p_node_id,
    'transaction_count', v_txn_count, 'taxable_total_cents', v_total_taxable,
    'tax_collected_cents', v_total_collected, 'tax_refunded_cents', v_total_refunded,
    'tax_net_cents', v_total_collected - v_total_refunded,
    'by_jurisdiction', v_by_jurisdiction));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_tax_summary_for_period(DATE, DATE, UUID) TO authenticated, service_role;
