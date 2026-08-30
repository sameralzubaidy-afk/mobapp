-- filepath: supabase/migrations/20260830190000_fix_cart_switch_saved_limit_copy.sql
-- QA Task 9 (M10) finding → fix: raw error string surfaced to users on the
-- saved-cart SWITCH path.
--
-- Problem: rpc_cart_switch_to_saved() did NOT pre-validate the 3-saved-cart
-- limit before moving the active cart to 'saved'. When a user had 3 saved
-- carts + an active cart and tapped Switch, the active→saved UPDATE hit the
-- fn_enforce_cart_limits trigger, which RAISEd the raw code-prefixed message
--   "SAVED_CART_LIMIT_REACHED: user already has 3 saved carts"
-- straight to the client (PostgREST surfaces trigger RAISE text verbatim in
-- error.message). The SAVE path (rpc_cart_save_current) pre-validates and
-- returns a friendly structured error instead, so the two paths disagreed.
--
-- Fix: mirror rpc_cart_save_current — pre-check the saved-cart count and
-- RETURN the structured friendly error {code:'SAVED_CART_LIMIT_REACHED',
-- message:'You already have 3 saved carts. Delete one to save a new one.'}
-- before the active→saved UPDATE, so the trigger never fires with the raw
-- message in the common case.
--
-- Mode B (idempotent rerunnable): CREATE OR REPLACE + GRANT.
-- Naming: p_ params, v_ locals, table-alias-qualified columns.

CREATE OR REPLACE FUNCTION public.rpc_cart_switch_to_saved(p_cart_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_active_cart_id uuid;
  v_target_exists boolean;
  v_saved_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  -- Verify target saved cart belongs to user
  SELECT EXISTS (
    SELECT 1 FROM public.cart_items
    WHERE user_id = v_user_id AND cart_id = p_cart_id AND cart_status = 'saved'
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','SAVED_CART_NOT_FOUND','message','Saved cart not found'));
  END IF;

  -- Save current active cart first (if any) — must respect 3-saved-cart limit
  SELECT cart_id INTO v_active_cart_id
  FROM public.cart_items
  WHERE user_id = v_user_id AND cart_status = 'active'
  LIMIT 1;

  IF v_active_cart_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT cart_id) INTO v_saved_count
    FROM public.cart_items
    WHERE user_id = v_user_id AND cart_status = 'saved';

    -- QA Task 9 fix: pre-validate BEFORE moving active→saved. Previously this
    -- fell through to the fn_enforce_cart_limits trigger, which raised the raw
    -- "SAVED_CART_LIMIT_REACHED: user already has 3 saved carts" text directly
    -- to the client (not user-friendly). Mirror rpc_cart_save_current's
    -- structured friendly error so the switch path surfaces the same copy as
    -- the save path.
    IF v_saved_count >= 3 THEN
      RETURN jsonb_build_object('success', false,
        'error', jsonb_build_object(
          'code','SAVED_CART_LIMIT_REACHED',
          'message','You already have 3 saved carts. Delete one to save a new one.',
          'details', jsonb_build_object('saved_count', v_saved_count)
        ));
    END IF;

    UPDATE public.cart_items SET cart_status = 'saved'
    WHERE user_id = v_user_id AND cart_id = v_active_cart_id AND cart_status = 'active';
  END IF;

  -- Activate the target saved cart
  UPDATE public.cart_items SET cart_status = 'active'
  WHERE user_id = v_user_id AND cart_id = p_cart_id AND cart_status = 'saved';

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('active_cart_id', p_cart_id,
                               'previously_active_cart_id', v_active_cart_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_cart_switch_to_saved(uuid) TO authenticated;

-- ── Verification (SQL-3) ────────────────────────────────────────────────────
-- Expect the function body to contain the friendly SAVED_CART_LIMIT_REACHED
-- pre-check, and authenticated to hold EXECUTE:
--   SELECT pg_get_functiondef(p.oid) FROM pg_proc p
--     WHERE p.proname = 'rpc_cart_switch_to_saved';
--   SELECT acl.privilege_type, acl.grantee FROM pg_proc p
--     CROSS JOIN LATERAL aclexplode(p.proacl) acl
--     WHERE p.proname = 'rpc_cart_switch_to_saved';
-- Behavioural check (as an authenticated buyer with 3 saved + 1 active cart,
-- attempting a switch): expect success=false with
--   error.code = 'SAVED_CART_LIMIT_REACHED'
--   error.message = 'You already have 3 saved carts. Delete one to save a new one.'
