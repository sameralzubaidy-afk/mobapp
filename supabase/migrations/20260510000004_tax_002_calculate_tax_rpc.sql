-- File: supabase/migrations/20260510000002_tax_002_calculate_tax_rpc.sql
-- MODULE-15.3-PART3 TAX-002
CREATE OR REPLACE FUNCTION public.calculate_tax(
  p_node_id              UUID,
  p_taxable_amount_cents INTEGER
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rate DECIMAL(5,4); v_tax_amount_cents INTEGER;
  v_jurisdiction TEXT; v_global_enabled BOOLEAN;
BEGIN
  IF p_taxable_amount_cents IS NULL OR p_taxable_amount_cents < 0 THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_AMOUNT','message','taxable_amount_cents must be >= 0'));
  END IF;
  SELECT (value::boolean) INTO v_global_enabled FROM public.admin_config WHERE key='sales_tax_enabled' LIMIT 1;
  v_rate := public.get_node_tax_rate(p_node_id);
  v_tax_amount_cents := FLOOR((p_taxable_amount_cents::numeric * v_rate) + 0.5)::INTEGER;
  IF p_node_id IS NOT NULL THEN
    SELECT n.tax_jurisdiction INTO v_jurisdiction FROM public.nodes n WHERE n.id = p_node_id LIMIT 1;
  END IF;
  IF v_jurisdiction IS NULL THEN
    SELECT value INTO v_jurisdiction FROM public.admin_config WHERE key='tax_remittance_jurisdiction' LIMIT 1;
  END IF;
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'taxable_amount_cents', p_taxable_amount_cents,
    'tax_rate',             v_rate,
    'tax_amount_cents',     v_tax_amount_cents,
    'tax_jurisdiction',     v_jurisdiction,
    'global_enabled',       COALESCE(v_global_enabled, false)
  ));
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_tax(UUID, INTEGER) TO authenticated, anon, service_role;
