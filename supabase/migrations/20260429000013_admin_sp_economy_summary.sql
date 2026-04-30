-- File: supabase/migrations/20260429000013_admin_sp_economy_summary.sql
-- Module: SP Economy Hub (consolidation)
-- Purpose: Single canonical RPC powering the SP Economy Health tab.
--          Returns date-ranged + optional node-scoped KPIs in ONE call so every
--          widget reads the same numbers (kills KPI drift across pages).
--
-- Mode: idempotent rerunnable migration
--
-- BP-3: every column qualified with table aliases
-- BP-5: SECURITY DEFINER required because aggregation needs to bypass RLS on
--       sp_wallets / sp_ledger / trades. Caller authorization is enforced at
--       the API route layer (x-admin-secret + service-role client).

-- Drop first so re-run is safe and signature changes are picked up
DROP FUNCTION IF EXISTS public.admin_sp_economy_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID);

CREATE OR REPLACE FUNCTION public.admin_sp_economy_summary(
  p_start    TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end      TIMESTAMPTZ DEFAULT NOW(),
  p_node_id  UUID        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Circulation snapshot (point-in-time)
  v_available_total      BIGINT := 0;
  v_pending_total        BIGINT := 0;
  v_circulation_total    BIGINT := 0;
  v_active_wallets       INTEGER := 0;
  v_frozen_wallets       INTEGER := 0;
  v_suspended_wallets    INTEGER := 0;

  -- Flow within window (from sp_ledger)
  v_earned_in_window     BIGINT := 0;
  v_spent_in_window      BIGINT := 0;
  v_admin_grants_count   INTEGER := 0;
  v_admin_grants_total   BIGINT := 0;
  v_admin_deducts_count  INTEGER := 0;
  v_admin_deducts_total  BIGINT := 0;

  -- Trade-level signals
  v_trades_total         INTEGER := 0;
  v_trades_with_sp       INTEGER := 0;
  v_avg_sp_per_trade     NUMERIC := 0;
  v_avg_cash_per_trade   NUMERIC := 0;

  -- Risk / health
  v_stuck_pending_count  INTEGER := 0;

  -- Derived ratios (computed at the end)
  v_earn_spend_ratio     NUMERIC := 0;
  v_sp_adoption_pct      NUMERIC := 0;
BEGIN
  -- ─── 1. Circulation snapshot (filtered by node via profile.node_id) ────
  SELECT
    COALESCE(SUM(w.available_balance), 0),
    COALESCE(SUM(w.pending_balance), 0),
    COALESCE(SUM(w.available_balance + w.pending_balance), 0),
    COUNT(*) FILTER (WHERE w.state = 'active'),
    COUNT(*) FILTER (WHERE w.state = 'frozen'),
    COUNT(*) FILTER (WHERE w.state = 'suspended')
  INTO
    v_available_total,
    v_pending_total,
    v_circulation_total,
    v_active_wallets,
    v_frozen_wallets,
    v_suspended_wallets
  FROM public.sp_wallets w
  LEFT JOIN public.profiles p ON p.user_id = w.user_id
  WHERE (p_node_id IS NULL OR p.node_id = p_node_id);

  -- ─── 2. Ledger flow within window ──────────────────────────────────────
  SELECT
    COALESCE(SUM(l.amount) FILTER (WHERE l.amount > 0), 0),
    COALESCE(SUM(ABS(l.amount)) FILTER (WHERE l.amount < 0), 0),
    COUNT(*) FILTER (WHERE l.transaction_type = 'earn_admin_grant'),
    COALESCE(SUM(l.amount) FILTER (WHERE l.transaction_type = 'earn_admin_grant'), 0),
    COUNT(*) FILTER (WHERE l.transaction_type = 'admin_deduct'),
    COALESCE(SUM(ABS(l.amount)) FILTER (WHERE l.transaction_type = 'admin_deduct'), 0)
  INTO
    v_earned_in_window,
    v_spent_in_window,
    v_admin_grants_count,
    v_admin_grants_total,
    v_admin_deducts_count,
    v_admin_deducts_total
  FROM public.sp_ledger l
  LEFT JOIN public.profiles p ON p.user_id = l.user_id
  WHERE l.created_at >= p_start
    AND l.created_at <  p_end
    AND (p_node_id IS NULL OR p.node_id = p_node_id);

  -- ─── 3. Trade-level signals ────────────────────────────────────────────
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE COALESCE(t.sp_amount, 0) > 0),
    COALESCE(AVG(t.sp_amount) FILTER (WHERE COALESCE(t.sp_amount, 0) > 0), 0),
    COALESCE(AVG(t.cash_amount_cents) FILTER (WHERE COALESCE(t.cash_amount_cents, 0) > 0), 0) / 100.0
  INTO
    v_trades_total,
    v_trades_with_sp,
    v_avg_sp_per_trade,
    v_avg_cash_per_trade
  FROM public.trades t
  WHERE t.created_at >= p_start
    AND t.created_at <  p_end
    AND t.status IN ('completed', 'in_progress', 'payment_processing')
    AND (p_node_id IS NULL OR t.node_id = p_node_id);

  -- ─── 4. Stuck pending: SP earned >3 days ago that's still pending ──────
  -- Heuristic: pending_balance > 0 on a wallet whose most recent earn entry is
  -- older than 3 days.
  SELECT COUNT(DISTINCT w.user_id)
  INTO v_stuck_pending_count
  FROM public.sp_wallets w
  LEFT JOIN public.profiles p ON p.user_id = w.user_id
  WHERE w.pending_balance > 0
    AND w.last_activity_at IS NOT NULL
    AND w.last_activity_at < NOW() - INTERVAL '3 days'
    AND (p_node_id IS NULL OR p.node_id = p_node_id);

  -- ─── 5. Derived ratios ─────────────────────────────────────────────────
  IF v_spent_in_window > 0 THEN
    v_earn_spend_ratio := ROUND(v_earned_in_window::NUMERIC / v_spent_in_window, 3);
  END IF;

  IF v_trades_total > 0 THEN
    v_sp_adoption_pct := ROUND((v_trades_with_sp::NUMERIC / v_trades_total) * 100, 2);
  END IF;

  RETURN jsonb_build_object(
    'window', jsonb_build_object(
      'start',   p_start,
      'end',     p_end,
      'node_id', p_node_id
    ),
    'circulation', jsonb_build_object(
      'available',         v_available_total,
      'pending',           v_pending_total,
      'total',             v_circulation_total,
      'active_wallets',    v_active_wallets,
      'frozen_wallets',    v_frozen_wallets,
      'suspended_wallets', v_suspended_wallets
    ),
    'flow', jsonb_build_object(
      'earned',             v_earned_in_window,
      'spent',              v_spent_in_window,
      'earn_spend_ratio',   v_earn_spend_ratio,
      'admin_grants_count', v_admin_grants_count,
      'admin_grants_total', v_admin_grants_total,
      'admin_deducts_count', v_admin_deducts_count,
      'admin_deducts_total', v_admin_deducts_total
    ),
    'trades', jsonb_build_object(
      'total',              v_trades_total,
      'with_sp',            v_trades_with_sp,
      'sp_adoption_pct',    v_sp_adoption_pct,
      'avg_sp_per_trade',   ROUND(v_avg_sp_per_trade, 2),
      'avg_cash_per_trade', ROUND(v_avg_cash_per_trade, 2)
    ),
    'risk', jsonb_build_object(
      'stuck_pending_wallets', v_stuck_pending_count
    )
  );
END;
$$;

-- Grant execute to authenticated + service_role (caller authz at API layer)
GRANT EXECUTE ON FUNCTION public.admin_sp_economy_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_sp_economy_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID) IS
  'SP Economy Hub: returns Health-tab KPIs (circulation, flow, trades, risk) for the given window and optional node. Authorization enforced at API layer.';

-- =============================================================================
-- Verification queries (run after applying):
-- =============================================================================
-- 1. Function exists
-- SELECT proname FROM pg_proc WHERE proname = 'admin_sp_economy_summary';
-- Expected: 1 row.
--
-- 2. Smoke call (last 30 days, no node filter)
-- SELECT public.admin_sp_economy_summary();
-- Expected: JSONB with keys window/circulation/flow/trades/risk.
--
-- 3. Smoke call with node filter
-- SELECT public.admin_sp_economy_summary(
--   NOW() - INTERVAL '7 days',
--   NOW(),
--   (SELECT id FROM public.nodes LIMIT 1)
-- );
-- Expected: same shape, numbers scoped to that node.
--
-- =============================================================================
-- Common failure modes:
-- - "column w.state does not exist": migration 093 not applied (sp_wallets uses
--   `state` not `status`). Apply 093 first.
-- - "column profiles.node_id does not exist": apply 20241213000001.
-- - "column trades.node_id does not exist": apply 089_fix_trades_node_id_trigger.
-- =============================================================================
