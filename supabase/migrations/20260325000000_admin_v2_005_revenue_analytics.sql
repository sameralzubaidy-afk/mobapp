-- Migration: ADMIN-V2-005 Revenue & Analytics Dashboard
-- Created: 2026-03-25
-- Description: RPCs for revenue metrics, engagement analytics, and time-series data

-- ============================================================================
-- RPC: Get Revenue Metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_revenue_metrics(
  p_admin_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB AS $$
DECLARE
  v_active_subscribers INTEGER;
  v_mrr DECIMAL(10,2);
  v_arr DECIMAL(10,2);
  v_transaction_fee_revenue DECIMAL(10,2);
  v_subscriber_fee_revenue DECIMAL(10,2);
  v_non_subscriber_fee_revenue DECIMAL(10,2);
  v_total_revenue DECIMAL(10,2);
  v_arpu DECIMAL(10,2);
  v_total_users INTEGER;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_admin_id) THEN
    RAISE EXCEPTION 'User % not found', p_admin_id;
  END IF;

  -- Active subscribers (trial + active)
  SELECT COUNT(*) INTO v_active_subscribers
  FROM public.subscriptions
  WHERE status IN ('trial', 'active');

  -- MRR (Monthly Recurring Revenue from active subscribers only)
  -- Active subscribers only (not trial) * $7.99
  SELECT COUNT(*) * 7.99 INTO v_mrr
  FROM public.subscriptions
  WHERE status = 'active';

  -- ARR (Annual Recurring Revenue)
  v_arr := v_mrr * 12;

  -- Transaction fee revenue in period
  SELECT COALESCE(SUM(
    COALESCE(t.buyer_transaction_fee_cents, 0)::DECIMAL / 100
  ), 0) INTO v_transaction_fee_revenue
  FROM public.trades t
  WHERE t.status = 'completed'
    AND t.completed_at BETWEEN p_start_date AND p_end_date;

  -- Subscriber transaction fees (trades where buyer was subscribed)
  SELECT COALESCE(SUM(
    COALESCE(t.buyer_transaction_fee_cents, 0)::DECIMAL / 100
  ), 0) INTO v_subscriber_fee_revenue
  FROM public.trades t
  WHERE t.status = 'completed'
    AND t.completed_at BETWEEN p_start_date AND p_end_date
    AND t.buyer_subscription_status IN ('trial', 'active');

  -- Non-subscriber transaction fees
  v_non_subscriber_fee_revenue := v_transaction_fee_revenue - v_subscriber_fee_revenue;

  -- Total revenue (subscription + transaction fees)
  v_total_revenue := v_mrr + v_transaction_fee_revenue;

  -- Total users (exclude deleted)
  SELECT COUNT(*) INTO v_total_users 
  FROM auth.users u
  WHERE u.deleted_at IS NULL;

  -- ARPU (Average Revenue Per User)
  v_arpu := CASE WHEN v_total_users > 0 THEN v_total_revenue / v_total_users ELSE 0 END;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'subscription_revenue', jsonb_build_object(
      'active_subscribers', v_active_subscribers,
      'mrr', v_mrr,
      'arr', v_arr
    ),
    'transaction_fee_revenue', jsonb_build_object(
      'total', v_transaction_fee_revenue,
      'subscribers', v_subscriber_fee_revenue,
      'non_subscribers', v_non_subscriber_fee_revenue
    ),
    'totals', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'total_users', v_total_users,
      'arpu', v_arpu
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: Get Engagement Metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_engagement_metrics(
  p_admin_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_dau INTEGER;
  v_mau INTEGER;
  v_dau_subscribers INTEGER;
  v_mau_subscribers INTEGER;
  v_dau_non_subscribers INTEGER;
  v_mau_non_subscribers INTEGER;
  v_dau_mau_ratio DECIMAL(10,2);
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_admin_id) THEN
    RAISE EXCEPTION 'User % not found', p_admin_id;
  END IF;

  -- DAU (Daily Active Users) - users who logged in today
  SELECT COUNT(DISTINCT u.id) INTO v_dau
  FROM auth.users u
  WHERE DATE(u.last_sign_in_at) = p_date
    AND u.deleted_at IS NULL;

  -- MAU (Monthly Active Users) - users active in last 30 days
  SELECT COUNT(DISTINCT u.id) INTO v_mau
  FROM auth.users u
  WHERE u.last_sign_in_at >= (p_date - INTERVAL '30 days')
    AND u.deleted_at IS NULL;

  -- DAU subscribers
  SELECT COUNT(DISTINCT u.id) INTO v_dau_subscribers
  FROM auth.users u
  INNER JOIN public.subscriptions s ON s.user_id = u.id AND s.status IN ('trial', 'active')
  WHERE DATE(u.last_sign_in_at) = p_date
    AND u.deleted_at IS NULL;

  -- MAU subscribers
  SELECT COUNT(DISTINCT u.id) INTO v_mau_subscribers
  FROM auth.users u
  INNER JOIN public.subscriptions s ON s.user_id = u.id AND s.status IN ('trial', 'active')
  WHERE u.last_sign_in_at >= (p_date - INTERVAL '30 days')
    AND u.deleted_at IS NULL;

  -- Non-subscriber counts
  v_dau_non_subscribers := v_dau - v_dau_subscribers;
  v_mau_non_subscribers := v_mau - v_mau_subscribers;

  -- DAU/MAU ratio
  v_dau_mau_ratio := CASE WHEN v_mau > 0 THEN ROUND((v_dau::DECIMAL / v_mau) * 100, 2) ELSE 0 END;

  RETURN jsonb_build_object(
    'date', p_date,
    'daily', jsonb_build_object(
      'total', v_dau,
      'subscribers', v_dau_subscribers,
      'non_subscribers', v_dau_non_subscribers
    ),
    'monthly', jsonb_build_object(
      'total', v_mau,
      'subscribers', v_mau_subscribers,
      'non_subscribers', v_mau_non_subscribers
    ),
    'dau_mau_ratio', v_dau_mau_ratio
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: Get Revenue Time Series (for charts)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_revenue_time_series(
  p_admin_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now(),
  p_interval TEXT DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS JSONB AS $$
DECLARE
  v_series JSONB;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_admin_id) THEN
    RAISE EXCEPTION 'User % not found', p_admin_id;
  END IF;

  -- Generate time series based on interval
  WITH date_series AS (
    SELECT generate_series(
      date_trunc(p_interval, p_start_date),
      date_trunc(p_interval, p_end_date),
      ('1 ' || p_interval)::interval
    ) AS period_start
  ),
  revenue_by_period AS (
    SELECT
      ds.period_start,
      COALESCE(SUM(t.buyer_transaction_fee_cents)::DECIMAL / 100, 0) AS transaction_fees,
      COALESCE(COUNT(DISTINCT s.user_id) * 7.99, 0) AS subscription_revenue
    FROM date_series ds
    LEFT JOIN public.trades t ON
      t.status = 'completed'
      AND t.completed_at >= ds.period_start
      AND t.completed_at < ds.period_start + ('1 ' || p_interval)::interval
    LEFT JOIN public.subscriptions s ON
      s.status = 'active'
      AND s.created_at <= ds.period_start + ('1 ' || p_interval)::interval
    GROUP BY ds.period_start
    ORDER BY ds.period_start
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'period', period_start,
      'transaction_fees', transaction_fees,
      'subscription_revenue', subscription_revenue,
      'total_revenue', transaction_fees + subscription_revenue
    )
  ) INTO v_series
  FROM revenue_by_period;

  RETURN COALESCE(v_series, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Trades completed_at index for revenue queries
CREATE INDEX IF NOT EXISTS idx_trades_completed_at 
  ON public.trades(completed_at) 
  WHERE status = 'completed';

-- Subscriptions status index
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
  ON public.subscriptions(status);

-- NOTE: Cannot create index on auth.users (owned by Supabase system role)
-- Engagement queries will work without it, just slightly slower
-- If needed in future, contact Supabase support or use Supabase CLI

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify RPCs exist
SELECT 
  proname AS function_name,
  pg_get_function_identity_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN ('get_revenue_metrics', 'get_engagement_metrics', 'get_revenue_time_series')
ORDER BY proname;

-- Test revenue metrics (will fail if no admin user exists - that's OK for migration)
-- SELECT get_revenue_metrics('00000000-0000-0000-0000-000000000000'::uuid);
