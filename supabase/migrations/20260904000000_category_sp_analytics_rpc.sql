-- ================================================================
-- Migration: 20260904000000_category_sp_analytics_rpc.sql
-- Module: ADMIN-V3-006 (SP Analytics Dashboard) / MODULE-12-ADMIN-V3-CATEGORIES
-- Mode: B (idempotent rerunnable — CREATE OR REPLACE FUNCTION)
--
-- DEV-TASK-109 (2026-09-04) — Item 1: fix the L02 FAIL on /sp-analytics.
--
-- The dashboard (`getSPAnalyticsByCategory` in spConfigCategoryService.ts) first
-- tried to read a table `category_sp_analytics` that has NEVER existed in any
-- migration, so PostgREST returned "Could not find the table
-- 'public.category_sp_analytics' in the schema cache" and the page showed an
-- error shell (no data, empty CSV). The spec (docx/ADMIN-CATEGORY-MANAGEMENT.md)
-- describes `getSPAnalyticsByCategory()` as computing metrics LIVE per category —
-- there is no designed snapshot table.
--
-- Because the UI needs a DATE WINDOW (Last 7/30/90 Days) and a plain view
-- cannot take a window over per-category aggregates, the correct source is a
-- SECURITY DEFINER RPC that aggregates REAL completed `trades` (joined through
-- `items` → `categories`) within [p_start, p_end). This is what the task's
-- "re-point the admin query to whatever the correct current source is" option
-- calls for: a working admin surface driven from real data, window-correct.
--
-- Per-category metrics over completed trades in the window (all real data):
--   earned_sp  = SUM(trades.seller_sp_earned)  — SP credited to sellers
--                (buyer SP + platform bonus; set at completion by
--                fn_release_all_sp_on_complete, DEV-TASK-41/62)
--   spent_sp   = SUM(trades.sp_amount)         — SP buyers applied
--   velocity   = earned / spent  (doc: "earn/spend ratio", ideal ~1.0; 0 when
--                spent = 0). The client flags <0.5 low_velocity, >2
--                spending_spike.
--   gap_percent = (earned − spent) / earned × 100  (0 when earned = 0). The
--                client flags >10 as "hoarding".
--   avg_cash_per_trade = average cash_amount_cents converted to DOLLARS (the
--                client renders "$X.XX"; the old fallback used dollars too).
-- Categories with no completed trade in the window are omitted.
--
-- ⚠️ SEMANTIC NOTE (read before "fixing" the formula): with the current SP
-- economy, platform-funded bonuses mean earned ≥ spent on most SP-eligible
-- trades, so velocity ≥ 1 and gap ≥ 0 typically — this measures earn-vs-spend
-- flow (incl. platform dilution), NOT user-level hoarding. User-level hoarding
-- needs wallet-balance-growth data (a different surface). Kept faithful to the
-- spec's earn/spend ratio on the closest real data available.
-- ================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1: RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_category_sp_analytics(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ
)
RETURNS TABLE (
  category_id         UUID,
  category_name       TEXT,
  velocity            NUMERIC,
  gap_percent         NUMERIC,
  avg_cash_per_trade  NUMERIC
)
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  IF p_start IS NULL OR p_end IS NULL THEN
    RAISE EXCEPTION 'p_start and p_end are required';
  END IF;

  IF p_end <= p_start THEN
    RETURN;
  END IF;

  -- ⚠️ NOTE: RETURNS TABLE out-params (category_id, category_name, velocity,
  -- gap_percent, avg_cash_per_trade) shadow plpgsql name resolution, so internal
  -- aliases use cat_id/cat_name (never bare out-param names) — otherwise any
  -- unqualified reference is 42702 "column reference is ambiguous".
  RETURN QUERY
  WITH per_trade AS (
    SELECT
      c.id                                     AS cat_id,
      c.name                                   AS cat_name,
      COALESCE(t.seller_sp_earned, 0)::NUMERIC AS earned_sp,
      COALESCE(t.sp_amount, 0)::NUMERIC        AS spent_sp,
      COALESCE(t.cash_amount_cents, 0)         AS cash_amount_cents
    FROM public.trades t
    JOIN public.items i      ON i.id = t.listing_id
    JOIN public.categories c ON c.id = i.category_id
    WHERE t.status = 'completed'
      AND t.completed_at >= p_start
      AND t.completed_at <  p_end
  ),
  agg AS (
    SELECT
      cat_id,
      cat_name,
      SUM(earned_sp)          AS earned_sp,
      SUM(spent_sp)           AS spent_sp,
      SUM(cash_amount_cents)  AS cash_total_cents,
      COUNT(*)                AS trade_count
    FROM per_trade
    GROUP BY cat_id, cat_name
  )
  SELECT
    a.cat_id,
    a.cat_name,
    CASE WHEN a.spent_sp > 0
         THEN ROUND((a.earned_sp / a.spent_sp)::NUMERIC, 4)
         ELSE 0
    END,
    CASE WHEN a.earned_sp > 0
         THEN ROUND(((a.earned_sp - a.spent_sp) / a.earned_sp * 100)::NUMERIC, 2)
         ELSE 0
    END,
    CASE WHEN a.trade_count > 0
         THEN ROUND(((a.cash_total_cents::NUMERIC / a.trade_count) / 100), 2)
         ELSE 0
    END
  FROM agg a
  ORDER BY 4 DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- BLOCK 2: Grants (idempotent). The analytics service runs in the BROWSER via
-- the anon client (existing architecture of this page — it reads categories/
-- items directly), and server-side via service_role. This RPC returns only
-- category-level aggregates (no user/PII), so anon EXECUTE is acceptable.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_category_sp_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION public.get_category_sp_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_sp_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ---------------------------------------------------------------------------
-- BLOCK 3: Verification queries (run after applying)
--   1) Object exists:
--      SELECT proname FROM pg_proc WHERE proname = 'get_category_sp_analytics';
--   2) Real data (last 90 days):
--      SELECT * FROM public.get_category_sp_analytics(now() - interval '90 days', now());
--   3) Cross-check totals vs the trades table:
--      SELECT count(*) FROM trades
--        WHERE status='completed' AND completed_at >= now() - interval '90 days';
-- ================================================================
