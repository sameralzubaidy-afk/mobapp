-- File: supabase/migrations/20260712000002_admin_cancellation_user_detail.sql
-- Module: Admin — Cancellation Insights Dashboard (per-user drill-down)
-- Mode B: Idempotent rerunnable migration
--
-- RPC that returns a single user's full cancellation history for the
-- per-user drill-down view in the Cancellation Insights page.
--
-- BLOCK 1: RPC
-- BLOCK 2: Security

-- ============================================================
-- BLOCK 1: RPC — admin_cancellation_user_detail
-- ============================================================
-- Returns: JSONB array of cancelled trades for the given user
--   Each entry includes: trade_id, cancellation_type (offer/trade),
--   cancellation_reason, cancelled_at, counterparty name, amount,
--   and the previous status before cancellation.
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_cancellation_user_detail(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.admin_cancellation_user_detail(
  p_user_id UUID,
  p_start   TIMESTAMPTZ,
  p_end     TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH cancelled_trades AS (
    SELECT
      t.id AS trade_id,
      t.listing_id,
      CASE
        WHEN t.auto_complete_at IS NOT NULL THEN 'trade'
        ELSE 'offer'
      END AS cancellation_type,
      t.cancellation_reason,
      t.cancelled_at,
      t.cash_amount_cents,
      t.sp_amount,
      CASE
        WHEN t.buyer_id = p_user_id THEN 'buyer'
        WHEN t.seller_id = p_user_id THEN 'seller'
        ELSE 'unknown'
      END AS actor_role,
      CASE
        WHEN t.buyer_id = p_user_id THEN t.seller_id
        ELSE t.buyer_id
      END AS counterparty_id,
      CASE
        WHEN t.buyer_id = p_user_id THEN COALESCE(ps.name, 'Unknown')
        ELSE COALESCE(pb.name, 'Unknown')
      END AS counterparty_name,
      COALESCE(i.title, 'Unknown Item') AS item_title,
      t.offer_expires_at,
      t.stripe_payment_intent_id
    FROM trades t
    LEFT JOIN profiles pb ON pb.user_id = t.buyer_id
    LEFT JOIN profiles ps ON ps.user_id = t.seller_id
    LEFT JOIN items i ON i.id = t.listing_id
    WHERE t.status = 'cancelled'
      AND (t.buyer_id = p_user_id OR t.seller_id = p_user_id)
      AND t.cancelled_at >= p_start
      AND t.cancelled_at <= p_end
    ORDER BY t.cancelled_at DESC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'trade_id',            ct.trade_id::TEXT,
      'listing_id',          ct.listing_id::TEXT,
      'item_title',          ct.item_title,
      'cancellation_type',   ct.cancellation_type,
      'cancellation_reason', ct.cancellation_reason,
      'cancelled_at',        ct.cancelled_at,
      'actor_role',          ct.actor_role,
      'counterparty_id',     ct.counterparty_id::TEXT,
      'counterparty_name',   ct.counterparty_name,
      'cash_amount_cents',   ct.cash_amount_cents,
      'sp_amount',           ct.sp_amount,
      'had_payment_intent',  ct.stripe_payment_intent_id IS NOT NULL
    )
  ) INTO v_result
  FROM cancelled_trades ct;

  IF v_result IS NULL THEN
    v_result := '[]'::JSONB;
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================
-- BLOCK 2: Security
-- ============================================================
REVOKE ALL ON FUNCTION public.admin_cancellation_user_detail(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancellation_user_detail(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ============================================================
-- Verification queries:
-- ============================================================
-- SELECT proname FROM pg_proc WHERE proname = 'admin_cancellation_user_detail';
-- SELECT public.admin_cancellation_user_detail(
--   'some-uuid-here',
--   NOW() - INTERVAL '30 days',
--   NOW()
-- );
