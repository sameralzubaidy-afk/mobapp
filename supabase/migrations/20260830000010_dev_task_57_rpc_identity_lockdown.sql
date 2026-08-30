-- =============================================================================
-- Migration: P1 lockdown — self-declared identity in 4 trade/refund RPCs
-- Date: 2026-08-30
-- Mode: Idempotent Rerunnable (Mode B) — CREATE OR REPLACE + REVOKE/GRANT are
--       safe to re-run.
--
-- Context (Dev Task 57, Revision 2 — owner signed off 2026-08-30):
--   Task 55 money/server-trust audit flagged that these SECURITY DEFINER RPCs
--   trust a caller-supplied `p_user_id` (or `p_admin_user_id`) with no
--   auth.uid()-derived identity and, in two cases, no party check:
--
--     * complete_trade_v2(UUID, UUID)        — grants anon+authenticated;
--                                              p_user_id is self-declared
--     * cancel_trade_v2(UUID, UUID, TEXT)    — no explicit REVOKE -> PUBLIC
--                                              execute; party check is
--                                              fail-open on NULL p_user_id
--     * admin_force_cancel_trade_db(UUID,UUID,TEXT) — grants authenticated;
--                                              p_admin_user_id is self-declared
--     * rpc_record_payment_refund(UUID,TEXT,INT,INT,INT,TEXT,TEXT,TEXT) —
--                                              grants authenticated
--
-- Identity model (one pattern for all four):
--   v_actor_id := COALESCE(auth.uid(), p_user_id);
--     - User-JWT calls (authenticated role): auth.uid() is the real caller and
--       takes precedence, so a self-declared p_user_id can never be spoofed.
--     - service_role calls (EFs verify the user's JWT server-side and pass the
--       resolved id): auth.uid() is NULL -> p_user_id is used. service_role is a
--       trusted backend credential, never exposed to clients.
--
-- Caller analysis (verified against live code + migrations, 2026-08-30):
--   * complete_trade_v2 -> complete-trade EF (USER JWT -> auth.uid()=user),
--       resolve-dispute EF (service role -> p_user_id=buyer_id),
--       rpc_finalize_trade_after_capture (SECURITY DEFINER -> buyer_id),
--       E2E integration tests (service role -> real party ids)
--   * cancel_trade_v2   -> cancel-trade EF (service role -> user.id),
--       stripe-webhook EF (service role -> p_user_id=NULL, system action)
--       => the NULL-actor path is only legal for service_role (role GUC gate)
--   * admin_force_cancel_trade_db -> admin-trade-action EF (service role +
--       x-admin-secret/admin-JWT gate) -> service_role only + admin_has_role()
--       defense-in-depth for any (now impossible) authenticated direct call
--   * rpc_record_payment_refund -> trade-refund EF (service role + admin gate)
--       -> service_role only
--   Mobile app (p2p-kids-marketplace/src) never calls these RPCs directly —
--   it always goes through the EFs, so grant changes have no mobile impact.
--
-- Rollback (one-line reverse per function, restores pre-change state):
--   GRANT EXECUTE ON FUNCTION public.complete_trade_v2(uuid, uuid)
--     TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.cancel_trade_v2(uuid, uuid, text) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.admin_force_cancel_trade_db(uuid, uuid, text)
--     TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.rpc_record_payment_refund(uuid, text,
--     integer, integer, integer, text, text, text) TO authenticated;
--   (Function-body rollback = re-apply the previous definition, e.g. from
--    20260727000001 / 315 / 20251227_admin_trade_tools / 317.)
-- =============================================================================

-- =============================================================================
-- 1. complete_trade_v2 — actor derived from auth.uid(); party-only
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_trade_v2(
    p_trade_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_trade RECORD;
    v_seller_id UUID;
    v_buyer_id UUID;
    v_actor_id UUID;
    v_sp_amount INTEGER;
    v_cash_amount_cents INTEGER;
    v_seller_fee_cents INTEGER;
    v_net_cash_cents INTEGER;
    v_listing_id UUID;
    v_payout_result JSONB;
BEGIN
    SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
    END IF;

    v_seller_id := v_trade.seller_id;
    v_buyer_id := v_trade.buyer_id;
    v_sp_amount := COALESCE((to_jsonb(v_trade.sp_amount) #>> '{}')::integer, 0);
    v_cash_amount_cents := COALESCE((to_jsonb(v_trade.cash_amount_cents) #>> '{}')::integer, 0);
    v_seller_fee_cents := COALESCE((to_jsonb(v_trade.seller_transaction_fee_cents) #>> '{}')::integer, 0);
    v_net_cash_cents := GREATEST(0, v_cash_amount_cents - v_seller_fee_cents);
    v_listing_id := v_trade.listing_id;

    -- DT57: identity is auth.uid()-derived when a user JWT is present (takes
    -- precedence over p_user_id), else p_user_id (trusted service_role callers
    -- only). Fail closed on NULL actor: every legitimate caller passes a party id.
    v_actor_id := COALESCE(auth.uid(), p_user_id);
    IF v_actor_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    IF v_actor_id <> v_seller_id AND v_actor_id <> v_buyer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- CASE 1: SELLER marks complete (First step)
    IF v_actor_id = v_seller_id THEN
        UPDATE public.trades
        SET seller_marked_completed_at = now(),
            status = CASE WHEN buyer_marked_completed_at IS NOT NULL THEN 'completed' ELSE status END,
            completed_at = CASE WHEN buyer_marked_completed_at IS NOT NULL THEN now() ELSE completed_at END
        WHERE id = p_trade_id
        RETURNING * INTO v_trade;

        IF v_trade.status = 'completed' THEN
            NULL; -- fall through to CASE 2
        ELSE
            RETURN jsonb_build_object('success', true, 'status', v_trade.status, 'trade', row_to_json(v_trade));
        END IF;
    END IF;

    -- CASE 2: BUYER marks complete (Second step / finalize)
    IF v_actor_id = v_buyer_id OR v_trade.status = 'completed' THEN
        UPDATE public.trades
        SET buyer_marked_completed_at = now(),
            status = 'completed',
            completed_at = now()
        WHERE id = p_trade_id
        RETURNING * INTO v_trade;

        -- 1. Update Item
        UPDATE public.items SET status = 'sold', updated_at = now() WHERE id = v_listing_id;

        -- 2. SP is handled by fn_release_all_sp_on_complete() trigger — no manual SP call needed.

        -- 3. Update payout_amount_cents on the trade with the net cash (after seller fee deduction)
        UPDATE public.trades
        SET payout_amount_cents = v_net_cash_cents,
            updated_at = now()
        WHERE id = p_trade_id;

        -- 4. Create seller payout record (§6.3.1 / PAY-006)
        v_payout_result := NULL;
        IF v_net_cash_cents > 0 THEN
            SELECT public.create_seller_payout_on_trade_completion(
                p_trade_id,
                v_seller_id,
                v_net_cash_cents
            ) INTO v_payout_result;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'completed',
            'payout_result', v_payout_result,
            'trade', row_to_json(v_trade)
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grants: authenticated (complete-trade EF calls with the user's JWT) +
-- service_role. anon/PUBLIC revoked (312 only revoked anon; restate idempotently).
REVOKE EXECUTE ON FUNCTION public.complete_trade_v2(UUID, UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_trade_v2(UUID, UUID) TO authenticated, service_role;

-- =============================================================================
-- 2. cancel_trade_v2 — actor derived from auth.uid(); party-only with a
--    service_role-only system path for NULL actor (stripe-webhook auto-cancel)
-- =============================================================================
CREATE OR REPLACE FUNCTION cancel_trade_v2(
  p_trade_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'User requested cancellation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_actor_id UUID;
  v_actor_role TEXT;
  v_sp_refund_amount INTEGER := 0;
  v_sp_refund_ledger_id UUID := NULL;
  v_sp_refund_error TEXT := NULL;
BEGIN
  -- 1. Load and verify trade exists
  SELECT * INTO v_trade FROM trades WHERE id = p_trade_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Trade not found. It may have already been cancelled or expired.'
    );
  END IF;

  -- 2. Verify authorization. Identity is auth.uid()-derived when a user JWT is
  --    present (takes precedence over p_user_id). For NULL actor (system actions
  --    such as the stripe-webhook external-refund auto-cancel) only service_role
  --    callers are allowed — anon/authenticated can never supply a NULL actor
  --    because auth.uid() would be set for them.
  -- NOTE: request.jwt.claim.role is NEVER set by this Supabase/PostgREST (it is
  --   always NULL even for service-role JWTs) — the reliable request-role signal
  --   is current_setting('role'), which PostgREST sets and which survives inside
  --   SECURITY DEFINER (verified live 2026-08-30).
  v_actor_id := COALESCE(auth.uid(), p_user_id);
  IF v_actor_id IS NOT NULL THEN
    IF v_actor_id <> v_trade.buyer_id AND v_actor_id <> v_trade.seller_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'You do not have permission to cancel this trade'
      );
    END IF;
  ELSE
    v_actor_role := COALESCE(current_setting('role', true), '');
    IF v_actor_role <> 'service_role' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'You do not have permission to cancel this trade'
      );
    END IF;
  END IF;

  -- 3. Verify trade status is cancellable (pending or in_progress)
  IF v_trade.status NOT IN ('pending', 'in_progress') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This trade cannot be cancelled. Current status: ' || v_trade.status
    );
  END IF;

  -- 4. Calculate SP refund amount if buyer spent SP on this trade
  IF v_trade.sp_debit_ledger_entry_id IS NOT NULL THEN
    SELECT amount INTO v_sp_refund_amount FROM sp_ledger WHERE id = v_trade.sp_debit_ledger_entry_id;
    IF v_sp_refund_amount IS NULL THEN
      v_sp_refund_amount := 0;
    END IF;

    IF v_sp_refund_amount > 0 THEN
      -- Use the existing RPC to credit SP for cancelled trade; handle failures gracefully
      BEGIN
        SELECT (credit_sp_for_cancelled_trade(v_trade.buyer_id, p_trade_id, v_sp_refund_amount))->>'ledger_entry_id' INTO v_sp_refund_ledger_id;
      EXCEPTION WHEN OTHERS THEN
        v_sp_refund_error := SQLERRM;
        v_sp_refund_ledger_id := NULL;
        v_sp_refund_amount := 0;
      END;
    END IF;
  END IF;

  -- 5. Update trade status to cancelled with reason
  UPDATE trades
  SET
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_at = NOW(),
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- 6. Build response
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'status', 'cancelled',
    'cancellation_reason', p_reason,
    'sp_refunded', v_sp_refund_amount,
    'sp_refund_ledger_id', COALESCE(v_sp_refund_ledger_id::TEXT, NULL),
    'sp_refund_error', COALESCE(v_sp_refund_error, NULL)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grants: authenticated + service_role. Was PUBLIC-by-default (no explicit
-- grant/revoke anywhere) — the fail-open NULL-party bug plus PUBLIC execute was
-- a P0 (anon could cancel any trade with p_user_id=NULL).
REVOKE EXECUTE ON FUNCTION public.cancel_trade_v2(UUID, UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_trade_v2(UUID, UUID, TEXT) TO authenticated, service_role;

-- =============================================================================
-- 3. admin_force_cancel_trade_db — service_role only + admin_has_role() defense-in-depth
-- =============================================================================
CREATE OR REPLACE FUNCTION admin_force_cancel_trade_db(
  p_trade_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_sp_refund_amount INTEGER := 0;
  v_sp_refund_ledger_id UUID := NULL;
BEGIN
  -- DT57: service_role-only caller (grant revoked from authenticated below).
  -- Defense-in-depth: if a user JWT is somehow present (direct authenticated
  -- call), the caller MUST be an admin. service_role calls (auth.uid() NULL)
  -- are the trusted admin channel — the admin-trade-action EF verifies
  -- admin credentials / x-admin-secret BEFORE invoking this RPC. Uses
  -- admin_has_role() (robust multi-source, verified live) — is_admin() (no-arg)
  -- does NOT exist on staging (only is_admin(user_id uuid)); plpgsql resolves
  -- referenced functions even in short-circuited branches, so a missing
  -- function here 500s every call.
  IF auth.uid() IS NOT NULL AND NOT public.admin_has_role(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  -- 1. Load trade with row lock (lock only the trades table, no joins)
  SELECT t.* INTO v_trade FROM trades t WHERE t.id = p_trade_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- 2. Calculate SP refund if applicable
  IF v_trade.sp_debit_ledger_entry_id IS NOT NULL THEN
    SELECT ABS(amount) INTO v_sp_refund_amount FROM sp_ledger WHERE id = v_trade.sp_debit_ledger_entry_id;

    IF v_sp_refund_amount > 0 THEN
      SELECT (credit_sp_for_cancelled_trade(v_trade.buyer_id, p_trade_id, v_sp_refund_amount))->>'ledger_entry_id'::TEXT INTO v_sp_refund_ledger_id;

      UPDATE trades
      SET sp_credit_ledger_entry_id = v_sp_refund_ledger_id
      WHERE id = p_trade_id;
    END IF;
  END IF;

  -- 3. Update trade status
  UPDATE trades
  SET
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_at = NOW(),
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- 4. Log admin action (allow NULL actor_id for system actions)
  INSERT INTO admin_audit_logs (actor_id, action_type, entity_type, entity_id, reason, payload)
  VALUES (
    p_admin_user_id,
    'force_cancel_trade',
    'trade',
    p_trade_id::TEXT,
    p_reason,
    jsonb_build_object('sp_refunded', v_sp_refund_amount, 'sp_ledger_id', v_sp_refund_ledger_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'sp_refunded', v_sp_refund_amount,
    'stripe_payment_intent_id', v_trade.stripe_payment_intent_id
  );
END;
$$;

-- Grants: service_role only (was authenticated + service_role). The admin portal
-- reaches this only through the admin-trade-action EF (service role + admin gate).
REVOKE EXECUTE ON FUNCTION public.admin_force_cancel_trade_db(UUID, UUID, TEXT)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_cancel_trade_db(UUID, UUID, TEXT)
  TO service_role;

-- =============================================================================
-- 4. rpc_record_payment_refund — service_role only (no body change needed)
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.rpc_record_payment_refund(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_payment_refund(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT)
  TO service_role;

-- =============================================================================
-- Verification queries (run live after applying)
-- =============================================================================
-- 1) Live grants (expected: complete_trade_v2/cancel_trade_v2 -> authenticated,
--    service_role; admin_force_cancel_trade_db/rpc_record_payment_refund ->
--    service_role only; NO anon/PUBLIC anywhere):
-- SELECT p.proname,
--        pg_get_function_identity_arguments(p.oid) AS sig,
--        COALESCE(array_agg(DISTINCT pr.grantee ORDER BY pr.grantee), '{}') AS grantees
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- LEFT JOIN information_schema.role_routine_grants pr ON pr.specific_name = p.oid::text
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('complete_trade_v2','cancel_trade_v2','admin_force_cancel_trade_db','rpc_record_payment_refund')
-- GROUP BY p.proname, p.oid
-- ORDER BY p.proname;
--
-- 2) Body sentinel check (each body contains the DT57 actor gate):
-- SELECT proname, prosrc LIKE '%COALESCE(auth.uid(), p_user_id)%' AS has_actor_gate
-- FROM pg_proc WHERE proname IN ('complete_trade_v2','cancel_trade_v2');
-- SELECT proname, prosrc LIKE '%NOT public.admin_has_role(auth.uid())%' AS has_admin_gate
-- FROM pg_proc WHERE proname = 'admin_force_cancel_trade_db';
