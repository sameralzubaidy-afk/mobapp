-- File: supabase/migrations/20260712000001_admin_cancellation_insights.sql
-- Module: Admin — Cancellation Insights Dashboard
-- Mode B: Idempotent rerunnable migration
--
-- Creates a read-only RPC that returns aggregated cancellation data
-- for the internal admin "Cancellation Insights" monitoring page.
--
-- BLOCK 1: RPC
-- BLOCK 2: Security (revoke public, grant service_role)
--
-- Run BLOCK 1 first, verify, then BLOCK 2.

-- ============================================================
-- BLOCK 1: RPC — admin_cancellation_insights
-- ============================================================
-- Returns:
--   summary     JSONB — { total_cancelled_offers, total_cancelled_trades,
--                        total_created_in_range, cancellation_rate_pct }
--   reasons     JSONB — [{ reason, count, pct_share, cancellation_type }]
--   top_users   JSONB  — [{ user_id, role, cancelled_offers, cancelled_trades,
--                           cancellation_rate, top_reason }]
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_cancellation_insights(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.admin_cancellation_insights(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_summary   JSONB;
  v_reasons   JSONB;
  v_top_users JSONB;
BEGIN
  -- ============================================================
  -- 1. Summary KPI cards
  -- ============================================================
  WITH cancelled AS (
    SELECT
      t.id,
      t.cancellation_reason,
      t.cash_amount_cents,
      t.sp_amount,
      t.buyer_id,
      t.seller_id,
      t.created_at,
      t.cancelled_at,
      CASE
        WHEN t.auto_complete_at IS NOT NULL THEN 'trade'
        ELSE 'offer'
      END AS cancellation_type
    FROM trades t
    WHERE t.status = 'cancelled'
      AND t.cancelled_at >= p_start
      AND t.cancelled_at <= p_end
  ),
  total_created AS (
    SELECT COUNT(*)::INTEGER AS cnt
    FROM trades
    WHERE created_at >= p_start
      AND created_at <= p_end
  )
  SELECT jsonb_build_object(
    'total_cancelled_offers',  COALESCE((SELECT COUNT(*) FROM cancelled WHERE cancellation_type = 'offer'), 0),
    'total_cancelled_trades',  COALESCE((SELECT COUNT(*) FROM cancelled WHERE cancellation_type = 'trade'), 0),
    'total_created_in_range',  COALESCE((SELECT cnt FROM total_created), 0),
    'cancellation_rate_pct',   ROUND(
      CASE
        WHEN (SELECT cnt FROM total_created) > 0
        THEN (SELECT COUNT(*)::NUMERIC FROM cancelled) / (SELECT cnt::NUMERIC FROM total_created) * 100
        ELSE 0
      END, 2
    )
  ) INTO v_summary;

  -- ============================================================
  -- 2. Top cancellation reasons breakdown (offers vs trades)
  -- ============================================================
  WITH cancelled AS (
    SELECT
      t.cancellation_reason,
      CASE
        WHEN t.auto_complete_at IS NOT NULL THEN 'trade'
        ELSE 'offer'
      END AS cancellation_type
    FROM trades t
    WHERE t.status = 'cancelled'
      AND t.cancelled_at >= p_start
      AND t.cancelled_at <= p_end
      AND t.cancellation_reason IS NOT NULL
  ),
  per_type_totals AS (
    SELECT
      cancellation_type,
      COUNT(*)::INTEGER AS type_total
    FROM cancelled
    GROUP BY cancellation_type
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'reason',             c.cancellation_reason,
      'cancellation_type',  c.cancellation_type,
      'count',              c.cnt,
      'pct_share',          ROUND(
        CASE
          WHEN pt.type_total > 0 THEN c.cnt::NUMERIC / pt.type_total::NUMERIC * 100
          ELSE 0
        END, 1
      )
    ) ORDER BY c.cnt DESC
  ) INTO v_reasons
  FROM (
    SELECT
      cr.cancellation_reason,
      cr.cancellation_type,
      COUNT(*)::INTEGER AS cnt
    FROM cancelled cr
    GROUP BY cr.cancellation_reason, cr.cancellation_type
  ) c
  JOIN per_type_totals pt ON pt.cancellation_type = c.cancellation_type;

  -- Ensure non-null for empty results
  IF v_reasons IS NULL THEN
    v_reasons := '[]'::JSONB;
  END IF;

  -- ============================================================
  -- 3. Top cancelling users (buyer & seller ranks)
  -- ============================================================
  WITH cancelled AS (
    SELECT
      t.id,
      t.cancellation_reason,
      t.buyer_id,
      t.seller_id,
      t.cash_amount_cents,
      CASE
        WHEN t.auto_complete_at IS NOT NULL THEN 'trade'
        ELSE 'offer'
      END AS cancellation_type
    FROM trades t
    WHERE t.status = 'cancelled'
      AND t.cancelled_at >= p_start
      AND t.cancelled_at <= p_end
  ),
  -- Buyer-side cancellations (buyer initiated)
  buyer_cancellations AS (
    SELECT
      c.buyer_id AS user_id,
      'buyer' AS role,
      COUNT(*) FILTER (WHERE c.cancellation_type = 'offer')::INTEGER AS cancelled_offers,
      COUNT(*) FILTER (WHERE c.cancellation_type = 'trade')::INTEGER AS cancelled_trades,
      COUNT(*)::INTEGER AS total_cancelled,
      (SELECT c2.cancellation_reason
       FROM cancelled c2
       WHERE c2.buyer_id = c.buyer_id
       GROUP BY c2.cancellation_reason
       ORDER BY COUNT(*) DESC
       LIMIT 1
      ) AS top_reason
    FROM cancelled c
    GROUP BY c.buyer_id
  ),
  -- Seller-side cancellations (seller initiated)
  seller_cancellations AS (
    SELECT
      c.seller_id AS user_id,
      'seller' AS role,
      COUNT(*) FILTER (WHERE c.cancellation_type = 'offer')::INTEGER AS cancelled_offers,
      COUNT(*) FILTER (WHERE c.cancellation_type = 'trade')::INTEGER AS cancelled_trades,
      COUNT(*)::INTEGER AS total_cancelled,
      (SELECT c2.cancellation_reason
       FROM cancelled c2
       WHERE c2.seller_id = c.seller_id
       GROUP BY c2.cancellation_reason
       ORDER BY COUNT(*) DESC
       LIMIT 1
      ) AS top_reason
    FROM cancelled c
    GROUP BY c.seller_id
  ),
  all_users AS (
    SELECT * FROM buyer_cancellations
    UNION ALL
    SELECT * FROM seller_cancellations
  ),
  user_totals AS (
    SELECT
      au.user_id,
      au.role,
      au.cancelled_offers,
      au.cancelled_trades,
      au.total_cancelled,
      au.top_reason,
      COALESCE(p.name, 'Unknown') AS display_name,
      COALESCE(p.email, '') AS email,
      p.admin_review_flagged_at
    FROM all_users au
    LEFT JOIN profiles p ON p.user_id = au.user_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id',                 ut.user_id::TEXT,
      'display_name',            ut.display_name,
      'email',                   ut.email,
      'role',                    ut.role,
      'cancelled_offers',        ut.cancelled_offers,
      'cancelled_trades',        ut.cancelled_trades,
      'total_cancelled',         ut.total_cancelled,
      'cancellation_rate',       NULL::NUMERIC, -- requires total trades per user — computed client-side or in a follow-up
      'top_reason',              ut.top_reason,
      'admin_review_flagged_at', ut.admin_review_flagged_at
    ) ORDER BY ut.total_cancelled DESC
  ) INTO v_top_users
  FROM user_totals ut;

  IF v_top_users IS NULL THEN
    v_top_users := '[]'::JSONB;
  END IF;

  -- ============================================================
  -- Return assembled result
  -- ============================================================
  RETURN jsonb_build_object(
    'summary',    v_summary,
    'reasons',    v_reasons,
    'top_users',  v_top_users
  );
END;
$$;

-- ============================================================
-- BLOCK 2: Security
-- ============================================================
REVOKE ALL ON FUNCTION public.admin_cancellation_insights(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancellation_insights(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ============================================================
-- Verification queries (run after applying BLOCK 1):
-- ============================================================
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'admin_cancellation_insights';
-- SELECT public.admin_cancellation_insights(
--   NOW() - INTERVAL '30 days',
--   NOW()
-- );
