-- Migration: Fix Trade Analytics RPC
-- Mode B: Idempotent rerunnable migration

CREATE OR REPLACE FUNCTION admin_get_trade_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_volume INTEGER;
  v_status_counts JSONB;
  v_avg_sp_usage NUMERIC;
  v_total_fee_revenue_cents BIGINT;
BEGIN
  -- Total volume
  SELECT COUNT(*) INTO v_total_volume FROM trades;

  -- Status counts
  SELECT jsonb_object_agg(status, count) INTO v_status_counts
  FROM (
    SELECT status, COUNT(*) as count
    FROM trades
    GROUP BY status
  ) s;

  -- Avg SP usage (on trades where SP was used)
  -- FIX: Use sp_amount instead of legacy points_amount
  SELECT AVG(sp_amount) INTO v_avg_sp_usage
  FROM trades
  WHERE sp_amount > 0;

  -- Total fee revenue
  SELECT SUM(buyer_transaction_fee_cents) INTO v_total_fee_revenue_cents
  FROM trades
  WHERE status = 'completed';

  RETURN jsonb_build_object(
    'total_volume', v_total_volume,
    'status_counts', COALESCE(v_status_counts, '{}'::jsonb),
    'avg_sp_usage', COALESCE(v_avg_sp_usage, 0),
    'total_fee_revenue_cents', COALESCE(v_total_fee_revenue_cents, 0)
  );
END;
$$;

-- Verification
SELECT admin_get_trade_analytics();
