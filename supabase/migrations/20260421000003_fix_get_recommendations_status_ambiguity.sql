-- ================================================================
-- Migration: 20260421000003_fix_get_recommendations_status_ambiguity.sql
-- Module: MODULE-05-DISCOVERY-V2 - Recommendations
-- Description: Fix ambiguous "status" reference in get_recommendations RPC
-- Mode: A (one-time migration)
-- ================================================================

DROP FUNCTION IF EXISTS public.get_recommendations(UUID, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_recommendations(
  p_user_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  accepts_swap_points BOOLEAN,
  status TEXT,
  seller_id UUID,
  category_id UUID,
  condition TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  score REAL,
  seller_name TEXT,
  seller_avatar_url TEXT,
  seller_verification_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_tier TEXT;
  v_is_subscriber BOOLEAN;
  v_available_points INTEGER DEFAULT 0;
  v_user_sp_balance INTEGER DEFAULT 0;
BEGIN
  SELECT COALESCE(
    (
      SELECT s.status
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
      ORDER BY s.created_at DESC NULLS LAST
      LIMIT 1
    ),
    'free'
  )
  INTO v_subscription_tier;

  v_is_subscriber := (v_subscription_tier IN ('trial', 'active', 'grace'));

  SELECT COALESCE(
    (
      SELECT w.available_balance
      FROM public.sp_wallets w
      WHERE w.user_id = p_user_id
      LIMIT 1
    ),
    0
  )
  INTO v_available_points;

  v_user_sp_balance := COALESCE(v_available_points, 0);

  RETURN QUERY
  SELECT
    i.id,
    i.title,
    i.description,
    i.price,
    i.accepts_swap_points,
    i.status,
    i.seller_id,
    i.category_id,
    i.condition,
    i.created_at,
    i.updated_at,
    CAST(
      CASE
        WHEN v_is_subscriber AND i.accepts_swap_points THEN 120.0
        WHEN v_is_subscriber THEN 100.0
        ELSE 10.0
      END
      + CASE
          WHEN v_is_subscriber
            AND v_user_sp_balance > 0
            AND i.price <= v_user_sp_balance::NUMERIC
          THEN 50.0
          ELSE 0.0
        END
      AS REAL
    ) AS score,
    p.name AS seller_name,
    p.avatar_url AS seller_avatar_url,
    COALESCE(v.verification_status, 'none') AS seller_verification_status
  FROM public.items i
  LEFT JOIN public.profiles p ON i.seller_id = p.user_id
  LEFT JOIN (
    SELECT
      ivr.user_id,
      ivr.status::TEXT AS verification_status,
      ROW_NUMBER() OVER (
        PARTITION BY ivr.user_id
        ORDER BY ivr.created_at DESC NULLS LAST
      ) AS rn
    FROM public.id_badge_verification_requests ivr
  ) v ON i.seller_id = v.user_id AND v.rn = 1
  WHERE i.status = 'available'
    AND i.seller_id != p_user_id
  ORDER BY
    CASE
      WHEN v_is_subscriber AND i.accepts_swap_points THEN 120.0
      WHEN v_is_subscriber THEN 100.0
      ELSE 10.0
    END
    + CASE
        WHEN v_is_subscriber
          AND v_user_sp_balance > 0
          AND i.price <= v_user_sp_balance::NUMERIC
        THEN 50.0
        ELSE 0.0
    END DESC,
    i.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Verification: function compiles and executes
-- SELECT proname, pg_get_function_arguments(oid)
-- FROM pg_proc
-- WHERE proname = 'get_recommendations' AND pronamespace = 'public'::regnamespace;

-- SELECT id, title, score, accepts_swap_points
-- FROM public.get_recommendations('49243010-f458-4744-add1-a6c84ab95f1f'::UUID, 5);

-- Common failure modes:
-- 1) column reference "status" is ambiguous -> caused by unqualified status in subquery.
-- 2) permission denied -> ensure SECURITY DEFINER function owner has SELECT on referenced tables.
