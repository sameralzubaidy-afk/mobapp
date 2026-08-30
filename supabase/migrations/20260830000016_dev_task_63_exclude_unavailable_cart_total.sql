-- filepath: supabase/migrations/20260830000016_dev_task_63_exclude_unavailable_cart_total.sql
-- Dev Task 63 — QA Task 7 · Item 1 (M13): exclude realtime-unavailable items
-- from the server-side cart total.
--
-- Problem: rpc_cart_validate_for_checkout() summed EVERY cart item's price into
-- v_total_cents, including items whose listing is no longer 'available'. The
-- client cart screen (after DT-63) excludes those items from the displayed
-- subtotal, so the server total and the client subtotal disagreed — e.g. a user
-- with an unavailable item saw "Subtotal $13.00" on the cart but the blocked-
-- checkout modal's "Your current total is $18.00" (which included it).
--
-- Fix: sum only items whose listing status = 'available' into v_total_cents.
-- The UNAVAILABLE_ITEMS error (checkout block) is unchanged; this only makes
-- the returned cart_total_cents and the MIN_CART_VALUE comparison match what
-- the buyer can actually check out.
--
-- Naming convention: p_ params, v_ locals, table-alias-qualified columns.
-- Idempotent: CREATE OR REPLACE + GRANT (grants survive CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.rpc_cart_validate_for_checkout()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_min_cents integer;
  v_item_count integer;
  v_total_cents integer;
  v_seller_count integer;
  v_unavailable_count integer;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  SELECT COALESCE(ac.value::integer, 0)
    INTO v_min_cents
  FROM public.admin_config ac
  WHERE ac.key = 'cart_min_value_cents' AND ac.is_active = true
  LIMIT 1;
  v_min_cents := COALESCE(v_min_cents, 0);

  -- DT-63: v_total_cents sums ONLY listings still 'available'. Unavailable items
  -- remain counted (v_item_count) and still produce the UNAVAILABLE_ITEMS error,
  -- but their price is excluded from the tradeable total and the minimum check.
  SELECT COUNT(*)::integer,
         COALESCE(SUM((i.price * 100)::integer) FILTER (WHERE i.status = 'available'), 0)::integer,
         COUNT(DISTINCT ci.seller_id)::integer,
         COUNT(*) FILTER (WHERE i.status <> 'available')::integer
    INTO v_item_count, v_total_cents, v_seller_count, v_unavailable_count
  FROM public.cart_items ci
  JOIN public.items i ON i.id = ci.listing_id
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active';

  IF v_item_count = 0 THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code','CART_EMPTY','message','Your cart is empty'));
  END IF;

  IF v_seller_count > 1 THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code','MULTIPLE_SELLERS','message','Cart contains items from multiple sellers'));
  END IF;

  IF v_unavailable_count > 0 THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code','UNAVAILABLE_ITEMS','message','One or more items are no longer available',
      'details', jsonb_build_object('count', v_unavailable_count)));
  END IF;

  IF v_total_cents < v_min_cents THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code','MIN_CART_VALUE_NOT_MET',
      'message','Cart total is below the minimum required',
      'details', jsonb_build_object('min_cart_value_cents', v_min_cents,
                                    'cart_total_cents', v_total_cents)));
  END IF;

  RETURN jsonb_build_object(
    'success', jsonb_array_length(v_errors) = 0,
    'data', jsonb_build_object(
      'cart_total_cents', v_total_cents,
      'item_count', v_item_count,
      'seller_count', v_seller_count,
      'min_cart_value_cents', v_min_cents,
      'errors', v_errors
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_cart_validate_for_checkout() TO authenticated;
