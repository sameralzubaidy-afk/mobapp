-- File: supabase/migrations/20260510000006_tax_006_update_node_tax_rpc.sql
-- MODULE-15.3-PART3 TAX-006
CREATE OR REPLACE FUNCTION public.update_node_tax_config(
  p_node_id UUID, p_tax_rate DECIMAL(5,4), p_tax_jurisdiction TEXT, p_tax_enabled BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_is_admin BOOLEAN; v_before RECORD; v_actor UUID;
BEGIN
  v_actor := auth.uid();
  SELECT public.admin_has_role(v_actor) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','FORBIDDEN','message','Admin role required'));
  END IF;
  IF p_node_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_INPUT','message','p_node_id required'));
  END IF;
  IF p_tax_rate IS NOT NULL AND (p_tax_rate < 0 OR p_tax_rate > 1) THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_RATE','message','tax_rate must be in [0,1]'));
  END IF;
  SELECT * INTO v_before FROM public.nodes WHERE id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','NODE_NOT_FOUND','message','Node not found'));
  END IF;
  UPDATE public.nodes
     SET tax_rate         = COALESCE(p_tax_rate, tax_rate),
         tax_jurisdiction = COALESCE(p_tax_jurisdiction, tax_jurisdiction),
         tax_enabled      = COALESCE(p_tax_enabled, tax_enabled),
         updated_at       = NOW()
   WHERE id = p_node_id;
  BEGIN
    INSERT INTO public.admin_audit_log(admin_id, action, entity_type, entity_id, changes)
    VALUES (v_actor, 'update_node_tax_config', 'node', p_node_id, jsonb_build_object(
      'before', jsonb_build_object('tax_rate', v_before.tax_rate, 'tax_jurisdiction', v_before.tax_jurisdiction, 'tax_enabled', v_before.tax_enabled),
      'after',  jsonb_build_object('tax_rate', COALESCE(p_tax_rate, v_before.tax_rate), 'tax_jurisdiction', COALESCE(p_tax_jurisdiction, v_before.tax_jurisdiction), 'tax_enabled', COALESCE(p_tax_enabled, v_before.tax_enabled))
    ));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'node_id', p_node_id,
    'tax_rate', COALESCE(p_tax_rate, v_before.tax_rate),
    'tax_jurisdiction', COALESCE(p_tax_jurisdiction, v_before.tax_jurisdiction),
    'tax_enabled', COALESCE(p_tax_enabled, v_before.tax_enabled)));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false,
    'error', jsonb_build_object('code','UPDATE_NODE_TAX_ERROR','message', SQLERRM));
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_node_tax_config(UUID, DECIMAL, TEXT, BOOLEAN) TO authenticated, service_role;
