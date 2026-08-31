-- File: supabase/migrations/20260830230000_dev_task_68_global_tax_toggle.sql
-- DT-68 (2026-08-30) — P1 money-correctness bug (QA O03/P04).
--
-- The global tax toggle `admin_config.sales_tax_enabled` was being READ but never
-- CONDITIONED on by `calculate_tax`: the function selected the flag into
-- v_global_enabled, only surfaced it as `global_enabled` in the JSON response, and
-- then computed tax unconditionally. Net effect: an admin setting
-- `sales_tax_enabled=false` got NO real effect — every offer/read still returned
-- nonzero tax, so buyers could be charged tax the platform config says shouldn't
-- apply. Reproduced live on staging (drntwgporzabmxdqykrp) with the toggle OFF:
--   * read path: `calculate_tax(NULL, 3000, general_tangible_goods, 3000)`
--     -> { global_enabled: false, tax_amount_cents: 210 }   (should be 0)
--   * write path: real $30 cash-only offer stored trade.tax_amount_cents = 210.
--
-- Fix: `calculate_tax` now short-circuits to $0 tax (rate 0, jurisdiction NULL,
-- global_enabled=false) whenever the global switch is off. This is the canonical
-- server-authoritative source and automatically fixes:
--   * the read path (mobile `calculateTax` preview calls this RPC)
--   * `apply_tax_to_trade` (calls calculate_tax and persists its result; with the
--     short-circuit it writes 0 tax / no tax_records row when globally disabled)
-- The Edge Function write path (`create-trade-offer`) is fixed separately in TS
-- (it never read the flag at all); see the DT-68 EF change in that file.
--
-- Mode B: idempotent rerunnable migration (CREATE OR REPLACE; grants re-asserted
-- to match the live ACL — PUBLIC/anon/authenticated/service_role were live before
-- this migration, per aclexplode(pg_proc.proacl) on 2026-08-30).

BEGIN;

CREATE OR REPLACE FUNCTION public.calculate_tax(
  p_node_id              UUID,
  p_taxable_amount_cents INTEGER,
  p_tax_category_id      UUID DEFAULT NULL,
  p_item_price_cents     INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rate DECIMAL(5,4); v_tax_amount_cents INTEGER;
  v_jurisdiction TEXT; v_global_enabled BOOLEAN;
  v_rule RECORD;
BEGIN
  IF p_taxable_amount_cents IS NULL OR p_taxable_amount_cents < 0 THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_AMOUNT','message','taxable_amount_cents must be >= 0'));
  END IF;

  SELECT (value::boolean) INTO v_global_enabled FROM public.admin_config WHERE key='sales_tax_enabled' LIMIT 1;

  -- DT-68 (2026-08-30): GLOBAL TAX TOGGLE — short-circuit to $0 when the global switch
  -- is OFF. Previously v_global_enabled was selected but never acted on (QA O03/P04):
  -- the response even reported global_enabled=false while still returning a nonzero
  -- tax_amount_cents. When disabled, tax is provably 0 regardless of category rule or
  -- node rate, so skip all rate resolution. (BP-35 fail-safe preserved: exempt/none
  -- still returns 0 below via the category branch when enabled.)
  IF COALESCE(v_global_enabled, false) IS FALSE THEN
    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
      'taxable_amount_cents', p_taxable_amount_cents,
      'tax_rate', 0,
      'tax_amount_cents', 0,
      'tax_jurisdiction', NULL,
      'global_enabled', false
    ));
  END IF;

  IF p_tax_category_id IS NOT NULL THEN
    SELECT * INTO v_rule
    FROM public.get_applicable_tax_rule(p_tax_category_id, NOW(), p_item_price_cents)
    LIMIT 1;

    IF NOT FOUND OR v_rule.is_taxable IS FALSE THEN
      -- Exempt category, or no rule matches this item's price band: fail-safe non-taxable.
      RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
        'taxable_amount_cents', p_taxable_amount_cents,
        'tax_rate', 0,
        'tax_amount_cents', 0,
        'tax_jurisdiction', NULL,
        'global_enabled', COALESCE(v_global_enabled, false)
      ));
    END IF;

    v_jurisdiction := v_rule.jurisdiction;
    v_rate := COALESCE(v_rule.tax_rate, public.get_node_tax_rate(p_node_id));
  ELSE
    v_rate := public.get_node_tax_rate(p_node_id);
  END IF;

  v_tax_amount_cents := FLOOR((p_taxable_amount_cents::numeric * v_rate) + 0.5)::INTEGER;

  IF v_jurisdiction IS NULL AND p_node_id IS NOT NULL THEN
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

GRANT EXECUTE ON FUNCTION public.calculate_tax(UUID, INTEGER, UUID, INTEGER) TO authenticated, anon, service_role;

COMMIT;

-- =============================================================================
-- Verification (run AFTER applying):
-- 1) With sales_tax_enabled=false, the SAME read-path call that returned 210 must
--    now return 0:
--      SELECT public.calculate_tax(NULL, 3000, 'e14198fb-1357-44f7-874e-e1fc831e331b', 3000);
--      -- expect data.tax_amount_cents = 0, data.tax_rate = 0, data.global_enabled = false
-- 2) With sales_tax_enabled=true, the call must return the normal 210:
--      SELECT public.calculate_tax(NULL, 3000, 'e14198fb-1357-44f7-874e-e1fc831e331b', 3000);
--      -- expect data.tax_amount_cents = 210, data.tax_rate = 0.0699
-- 3) Live body check (BP-47): pg_get_functiondef must contain the short-circuit
--      SELECT position('global_enabled', pg_get_functiondef(oid)) > 0
--        AND position('IF COALESCE(v_global_enabled' , pg_get_functiondef(oid)) > 0
--      FROM pg_proc WHERE proname = 'calculate_tax';
-- =============================================================================
