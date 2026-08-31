-- =============================================================================
-- DEV-TASK-75 (2026-08-31) — Item 5: rpc_get_trade_refunds
-- End-user refund-detail read path for the Trade Timeline (TRD-TC-O07).
--
-- WHY: `trade_refunds` (and `payments`) are RLS-locked to service_role only
-- (migration 317). The mobile app's user JWT cannot read them directly, so the
-- Trade Timeline screen (buyer/seller) needs a read path to show the refund
-- detail section (refund amount, proportional tax, date/status, payment method)
-- when a trade was resolved with a refund (dispute-resolved-refund, seller-cancel
-- refund, admin force-cancel refund, partial refund).
--
-- SECURITY: SECURITY DEFINER (crosses the RLS boundary) but STRICTLY bounded:
--   - `auth.uid()` must be non-null (authenticated only).
--   - The caller MUST be the buyer or seller of the trade — anyone else gets an
--     empty `data` array (fail closed, no existence leak).
--   - Read-only: returns refund rows, never mutates anything.
--
-- Migration mode: B (idempotent rerunnable — CREATE OR REPLACE + explicit
-- REVOKE/GRANT; safe to re-run).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOCK 1 — Function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_trade_refunds(p_trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_is_party  boolean;
  v_refunds   jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required')
    );
  END IF;

  -- Caller must be the buyer or the seller of this trade (BP-78 party check).
  SELECT EXISTS (
    SELECT 1 FROM public.trades t
    WHERE t.id = p_trade_id
      AND (t.buyer_id = v_user_id OR t.seller_id = v_user_id)
  ) INTO v_is_party;

  IF NOT v_is_party THEN
    -- Fail closed: a non-party gets an empty result, never a leak of refund data.
    RETURN jsonb_build_object('success', true, 'data', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_refunds
  FROM (
    SELECT
      tr.id,
      tr.trade_id,
      tr.refund_amount_cents,
      tr.refund_price_cents,
      tr.refund_fee_cents,
      tr.refund_tax_cents,
      tr.reason,
      tr.status,
      tr.created_at
    FROM public.trade_refunds tr
    WHERE tr.trade_id = p_trade_id
  ) r;

  RETURN jsonb_build_object('success', true, 'data', v_refunds);
END;
$$;

-- -----------------------------------------------------------------------------
-- BLOCK 2 — Grants (BP-78: explicit minimal grants; the DT-61 guard auto-revokes
-- PUBLIC/anon/authenticated on new functions, so re-assert explicitly).
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.rpc_get_trade_refunds(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_trade_refunds(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- BLOCK 3 — Verification queries (SQL-3 / SQL-6)
-- -----------------------------------------------------------------------------
-- 1) Function exists with the correct grant set:
--    SELECT p.proname, pg_get_functiondef(p.oid) IS NOT NULL AS has_body
--    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'rpc_get_trade_refunds';
--    -- Expected: 1 row, has_body = true
--
-- 2) Only `authenticated` may execute (no anon / PUBLIC):
--    SELECT p.proname, g.grantee, g.privilege_type
--    FROM information_schema.routine_privileges g
--    JOIN pg_proc p ON p.proname = g.routine_name
--    WHERE g.routine_name = 'rpc_get_trade_refunds'
--    ORDER BY g.grantee;
--    -- Expected: only the `authenticated` role rows (anon must be absent).
--
-- 3) Caller-scoping check — as a party to a refunded trade, returns the rows:
--    SELECT public.rpc_get_trade_refunds('<trade-uuid>');
--    -- Expected: success true, data[] with the refund split (price/fee/tax).
--    -- As a NON-party, the same call returns success true, data: [] (no leak).
