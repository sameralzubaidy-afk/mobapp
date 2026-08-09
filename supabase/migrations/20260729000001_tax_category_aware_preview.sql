-- File: supabase/migrations/20260729000001_tax_category_aware_preview.sql
-- Bug fix: TC-O2-C02 — client-side tax PREVIEW ignored an item's tax_category_id,
-- so a Tax Exempt Goods item showed 6.35% tax on screen (Make Offer / Cart Checkout)
-- even though the server-side charge (create-trade-offer Edge Function) was already
-- correctly computing $0 tax for that category. This migration makes the shared
-- `calculate_tax` RPC category-aware (opt-in via new optional params, fully
-- backward-compatible — existing 2-arg callers behave exactly as before) and fixes
-- `get_applicable_tax_rule` to honor a rule's min/max price band, which was
-- previously ignored everywhere (server AND client), so price-threshold rules
-- (e.g. "CT Clothing — Under $50") were never actually enforced by price.
--
-- Mode B: idempotent rerunnable migration (DROP + CREATE for changed signatures).

BEGIN;

-- ============================================================================
-- 1) get_applicable_tax_rule — now optionally price-band aware.
--    p_item_price_cents = NULL (default) preserves old behavior (ignores price).
--    When supplied, only a rule whose [min_item_price_cents, max_item_price_cents]
--    band contains the item's price is considered applicable.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_applicable_tax_rule(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_applicable_tax_rule(
  p_tax_category_id  UUID,
  p_check_date       TIMESTAMPTZ DEFAULT NOW(),
  p_item_price_cents INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  tax_category_id      UUID,
  version              INTEGER,
  display_name         TEXT,
  is_taxable           BOOLEAN,
  tax_rate             DECIMAL(5,4),
  jurisdiction         TEXT,
  min_item_price_cents INTEGER,
  max_item_price_cents INTEGER
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tr.id,
    tr.tax_category_id,
    tr.version,
    tr.display_name,
    tr.is_taxable,
    tr.tax_rate,
    tr.jurisdiction,
    tr.min_item_price_cents,
    tr.max_item_price_cents
  FROM public.tax_rules tr
  WHERE tr.tax_category_id = p_tax_category_id
    AND tr.is_active = TRUE
    AND tr.effective_from <= p_check_date
    AND (tr.effective_to IS NULL OR tr.effective_to > p_check_date)
    AND (
      p_item_price_cents IS NULL
      OR (
        (tr.min_item_price_cents IS NULL OR p_item_price_cents >= tr.min_item_price_cents)
        AND (tr.max_item_price_cents IS NULL OR p_item_price_cents <= tr.max_item_price_cents)
      )
    )
  ORDER BY tr.version DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_applicable_tax_rule(UUID, TIMESTAMPTZ, INTEGER) TO authenticated, anon, service_role;

-- ============================================================================
-- 2) calculate_tax — now optionally category-aware.
--    p_tax_category_id = NULL (default) preserves old behavior (flat node rate).
--    When supplied: honors the category's is_taxable + rate + price-band rule.
--    No matching rule (e.g. price outside the rule's band) is treated as
--    non-taxable — same fail-safe already used in create-trade-offer (BP-35).
-- ============================================================================

DROP FUNCTION IF EXISTS public.calculate_tax(UUID, INTEGER);

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

-- ============================================================================
-- 3) rpc_cart_get_items — expose each cart item's tax_category_id so the client
--    can compute correct line-level tax per item (was previously not selected
--    at all, so CartCheckoutScreen could only tax the whole bundle at once).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cart_get_items()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_subscriber boolean;
  v_active jsonb;
  v_saved jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  v_is_subscriber := COALESCE(public.is_active_subscriber(v_user_id), false);

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.added_at DESC), '[]'::jsonb)
    INTO v_active
  FROM (
    SELECT
      ci.id                AS cart_item_id,
      ci.cart_id,
      ci.listing_id,
      ci.seller_id,
      ci.added_at,
      ci.item_title        AS snapshot_title,
      ci.item_price_cents  AS snapshot_price_cents,
      ci.item_image_url    AS snapshot_image_url,
      ci.item_payment_preference AS snapshot_payment_preference,
      i.title              AS live_title,
      (i.price * 100)::integer AS live_price_cents,
      COALESCE(i.status, 'unavailable') AS live_status,
      COALESCE(i.accepts_swap_points, false) AS live_accepts_sp,
      i.tax_category_id    AS tax_category_id,
      sp.name              AS seller_name,
      CASE
        WHEN v_is_subscriber AND (i.accepts_swap_points IS TRUE) THEN ((i.price * 100)::integer / 2)
        ELSE 0
      END AS max_sp_available
    FROM public.cart_items ci
    LEFT JOIN public.items i ON i.id = ci.listing_id
    LEFT JOIN public.profiles sp ON sp.user_id = ci.seller_id
    WHERE ci.user_id = v_user_id
      AND ci.cart_status = 'active'
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.last_updated DESC), '[]'::jsonb)
    INTO v_saved
  FROM (
    SELECT
      ci.cart_id,
      (array_agg(ci.seller_id ORDER BY ci.updated_at DESC NULLS LAST, ci.added_at DESC NULLS LAST))[1]::uuid AS seller_id,
      MAX(sp.name)                 AS seller_name,
      COUNT(*)                     AS item_count,
      SUM(ci.item_price_cents)::integer AS total_price_cents,
      MAX(ci.updated_at)           AS last_updated
    FROM public.cart_items ci
    LEFT JOIN public.profiles sp ON sp.user_id = ci.seller_id
    WHERE ci.user_id = v_user_id
      AND ci.cart_status = 'saved'
    GROUP BY ci.cart_id
  ) s;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'active_cart_items', v_active,
      'saved_carts', v_saved,
      'is_subscriber', v_is_subscriber
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_cart_get_items() TO authenticated;

COMMIT;

-- ============================================================================
-- Verification queries (run after applying):
-- ============================================================================
-- 1) Confirm old 2-arg calculate_tax is gone and new 4-arg version exists:
--    SELECT proname, pronargs FROM pg_proc WHERE proname = 'calculate_tax';
--    -- expect exactly one row with pronargs = 4
--
-- 2) Exempt category still returns $0 (backward compat, no category passed):
--    SELECT calculate_tax(NULL, 10000);
--
-- 3) Category-aware: exempt category returns $0 regardless of node rate:
--    SELECT calculate_tax(
--      (SELECT id FROM nodes LIMIT 1),
--      10000,
--      (SELECT id FROM tax_categories WHERE key = 'tax_exempt_goods'),
--      10000
--    );
--    -- expect data.tax_amount_cents = 0
--
-- 4) Price-threshold rule only applies inside its band:
--    SELECT * FROM get_applicable_tax_rule(
--      (SELECT id FROM tax_categories WHERE key = 'clothing_footwear'),
--      NOW(),
--      10000  -- $100.00, likely outside a "$0-$50" band rule
--    );
--    -- expect zero rows if the only active rule for that category has max_item_price_cents = 5000
--
-- 5) Cart items now carry tax_category_id:
--    SELECT jsonb_pretty((rpc_cart_get_items()->'data'->'active_cart_items'));
