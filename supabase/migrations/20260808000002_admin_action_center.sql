-- ============================================================================
-- Admin Action Center — Aggregation RPCs
-- Mode B: Idempotent Rerunnable Migration
--
-- PROBLEM:
--   Admins must hunt module-by-module to find pending work (flagged items,
--   disputes, ID badge requests, cancellation spikes, failed payouts, config
--   drift). This migration adds two READ-ONLY RPCs that aggregate every
--   pending admin action into a single feed:
--     1) admin_action_center_summary()         -> JSONB { generated_at, total, groups[] }
--     2) admin_action_center_detail(p_source)  -> JSONB [] rows for one source
--
--   These are DATA-ONLY (no writes). All mutations happen through the existing
--   admin endpoints (item status, dispute-action, id-badge decide, payout
--   retry), so the Action Center never re-implements a write path.
--
-- BLOCK 1: RPCs (run first, verify)
-- BLOCK 2: Security (revoke public, grant service_role)
--
-- Naming: p_ params, v_ locals, qualified columns (supabase-sql.instructions).
-- ============================================================================

-- ============================================================================
-- BLOCK 1: admin_action_center_summary()
-- ============================================================================
-- Returns a JSONB feed:
--   {
--     "generated_at": "<timestamptz>",
--     "total": <int>,                       -- total actionable items
--     "groups": [
--       { "source": "flagged_items",     "count": n },
--       { "source": "disputes",          "count": n },
--       { "source": "id_badge_requests", "count": n },
--       { "source": "cancel_anomalies",  "count": 0|1,
--         "detail": { "recent_7d": n, "prior_7d": n, "reasons": [...] } },
--       { "source": "failed_payouts",    "count": n },
--       { "source": "config_drift",      "count": n,
--         "detail": [ { "key", "value", "documented_default",
--                       "recommended_min", "recommended_max" } ] }
--     ]
--   }
--
-- Config drift reference (documented defaults + recommended ranges):
--   The defaults come from the seed migrations; the recommended ranges come
--   from the DB CHECK constraints in the trade-timing migration
--   (20260528000001_admin_config_trade_timing.sql) where they exist, else a
--   documented heuristic (flagged with a comment). A setting is "in drift"
--   when its active numeric value falls OUTSIDE [recommended_min, max].
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_action_center_summary();

CREATE OR REPLACE FUNCTION public.admin_action_center_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now            TIMESTAMPTZ;
  v_flagged_count  INTEGER;
  v_dispute_count  INTEGER;
  v_id_badge_count INTEGER;
  v_payout_count   INTEGER;
  v_recent         INTEGER;
  v_prior          INTEGER;
  v_anomaly        BOOLEAN;
  v_reasons        JSONB;
  v_drift          JSONB;
  v_drift_count    INTEGER;
  v_groups         JSONB;
  v_total          INTEGER;
BEGIN
  v_now := NOW();

  -- 1) Flagged items pending admin review (moderation queue, SAFETY-P003)
  SELECT COUNT(*)::INTEGER INTO v_flagged_count
  FROM public.items i
  WHERE i.status = 'flagged';

  -- 2) Open disputes (TFV2-017): reported + under_review
  SELECT COUNT(*)::INTEGER INTO v_dispute_count
  FROM public.trades t
  WHERE t.dispute_status IN ('reported', 'under_review');

  -- 3) Pending ID badge verification requests (BADGE-010)
  SELECT COUNT(*)::INTEGER INTO v_id_badge_count
  FROM public.id_badge_verification_requests r
  WHERE r.status = 'pending';

  -- 4) Failed payouts needing manual retry (PAY-008)
  SELECT COUNT(*)::INTEGER INTO v_payout_count
  FROM public.seller_payouts sp
  WHERE sp.status = 'failed';

  -- 5) Cancellation anomaly: a "spike" = last-7d cancellations >= 3 AND at
  --    least double the prior-7d baseline (heuristic; there is no DB-level
  --    anomaly flag — see admin_cancellation_insights RPC).
  SELECT COUNT(*)::INTEGER INTO v_recent
  FROM public.trades t
  WHERE t.status = 'cancelled'
    AND t.cancelled_at >= v_now - INTERVAL '7 days';

  SELECT COUNT(*)::INTEGER INTO v_prior
  FROM public.trades t
  WHERE t.status = 'cancelled'
    AND t.cancelled_at >= v_now - INTERVAL '14 days'
    AND t.cancelled_at <  v_now - INTERVAL '7 days';

  v_anomaly := (v_recent >= 3) AND (v_recent >= 2 * v_prior);

  IF v_anomaly THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'reason', x.reason,
        'count',  x.cnt
      ) ORDER BY x.cnt DESC
    ), '[]'::jsonb) INTO v_reasons
    FROM (
      SELECT t.cancellation_reason AS reason, COUNT(*)::INTEGER AS cnt
      FROM public.trades t
      WHERE t.status = 'cancelled'
        AND t.cancelled_at >= v_now - INTERVAL '7 days'
        AND t.cancellation_reason IS NOT NULL
      GROUP BY t.cancellation_reason
    ) x;
  ELSE
    v_reasons := '[]'::jsonb;
  END IF;

  -- 6) Config drift: active admin_config values outside the documented
  --    recommended range. Defaults/ranges are the canonical seeds + CHECK
  --    constraints cited above. Only numeric values are evaluated.
  WITH drift AS (
    SELECT d.key, d.default_val, d.min_val, d.max_val
    FROM (VALUES
      -- subscription: grace_period_days default 90 (20250113_create_admin_config.sql);
      -- recommended 30-180 = "significantly far above the 90-day default" heuristic.
      ('grace_period_days',                 90,   30,  180),
      -- trade timing (20260528000001_admin_config_trade_timing.sql) — ranges are
      -- the migration's own CHECK constraints (authoritative).
      ('offer_timeout_hours',               48,   1,   168),
      ('offer_notif_1_hours_before',        24,   1,   168),
      ('offer_notif_2_hours_before',        6,    1,   168),
      ('auto_complete_hours',               72,   24,  336),
      ('auto_complete_notif_hours_before',  12,   1,   72),
      ('pending_sp_release_days',           3,    1,   30),
      -- fees (20260528000001) — cents ranges from CHECK constraints.
      ('transaction_fee_member_cents',      99,   0,   10000),
      ('transaction_fee_non_member_cents',  299,  0,   10000),
      -- swap points (20251222_add_sp_max_percentage_config.sql): 0-100 documented.
      ('sp_max_percentage_per_purchase',    50,   0,   100),
      -- listings (20260721000002_min_listing_price.sql): default $0 = no floor.
      ('min_listing_price',                 0,    0,   10000)
    ) AS d(key, default_val, min_val, max_val)
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'key',               ac.key,
      'value',             ac.value,
      'documented_default', d.default_val,
      'recommended_min',   d.min_val,
      'recommended_max',   d.max_val
    ) ORDER BY ac.key
  ), '[]'::jsonb) INTO v_drift
  FROM public.admin_config ac
  JOIN drift d ON d.key = ac.key
  WHERE ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    AND (ac.value)::NUMERIC NOT BETWEEN d.min_val AND d.max_val;

  v_drift_count := COALESCE(jsonb_array_length(v_drift), 0);

  v_groups := jsonb_build_array(
    jsonb_build_object('source', 'flagged_items',     'count', v_flagged_count),
    jsonb_build_object('source', 'disputes',          'count', v_dispute_count),
    jsonb_build_object('source', 'id_badge_requests', 'count', v_id_badge_count),
    jsonb_build_object(
      'source', 'cancel_anomalies',
      'count',  CASE WHEN v_anomaly THEN 1 ELSE 0 END,
      'detail', jsonb_build_object(
        'recent_7d', v_recent,
        'prior_7d',  v_prior,
        'reasons',   v_reasons
      )
    ),
    jsonb_build_object('source', 'failed_payouts', 'count', v_payout_count),
    jsonb_build_object('source', 'config_drift',   'count', v_drift_count, 'detail', v_drift)
  );

  v_total := v_flagged_count + v_dispute_count + v_id_badge_count
           + (CASE WHEN v_anomaly THEN 1 ELSE 0 END)
           + v_payout_count + v_drift_count;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'total',        v_total,
    'groups',       v_groups
  );
END;
$$;

-- ============================================================================
-- BLOCK 1 (cont): admin_action_center_detail(p_source)
-- ============================================================================
-- Returns the individual rows for one source so the Action Center can drill
-- into a card. Each row carries the id/fields the existing admin endpoints
-- need to act on it (no write happens here).

DROP FUNCTION IF EXISTS public.admin_action_center_detail(TEXT);

CREATE OR REPLACE FUNCTION public.admin_action_center_detail(p_source TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result   JSONB;
  v_now      TIMESTAMPTZ;
  v_recent   INTEGER;
  v_prior    INTEGER;
  v_reasons  JSONB;
  v_top_users JSONB;
BEGIN
  v_now := NOW();

  IF p_source = 'flagged_items' THEN
    -- items.seller_id references profiles.user_id (auth user id), NOT profiles.id (BP-2).
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',           i.id,
        'title',        i.title,
        'price',        i.price,
        'status',       i.status,
        'flagged_at',   i.flagged_at,
        'seller_id',    i.seller_id,
        'seller_name',  pr.name,
        'seller_email', pr.email
      ) ORDER BY i.flagged_at DESC
    ), '[]'::jsonb) INTO v_result
    FROM public.items i
    LEFT JOIN public.profiles pr ON pr.user_id = i.seller_id
    WHERE i.status = 'flagged';

  ELSIF p_source = 'disputes' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',                 t.id,
        'item_title',         it.title,
        'dispute_status',     t.dispute_status,
        'dispute_reason',     t.dispute_reason,
        'dispute_opened_at',  t.dispute_opened_at,
        'cash_amount_cents',  t.cash_amount_cents,
        'sp_amount',          t.sp_amount
      ) ORDER BY t.dispute_opened_at ASC
    ), '[]'::jsonb) INTO v_result
    FROM public.trades t
    LEFT JOIN public.items it ON it.id = t.listing_id
    WHERE t.dispute_status IN ('reported', 'under_review');

  ELSIF p_source = 'id_badge_requests' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',           r.id,
        'user_id',      r.user_id,
        'first_name',   r.first_name,
        'last_name',    r.last_name,
        'email',        r.email,
        'submitted_at', r.submitted_at,
        'node_id',      r.node_id
      ) ORDER BY r.submitted_at ASC
    ), '[]'::jsonb) INTO v_result
    FROM public.id_badge_verification_requests r
    WHERE r.status = 'pending';

  ELSIF p_source = 'cancel_anomalies' THEN
    -- Same spike heuristic as the summary RPC, plus top cancelled users.
    SELECT COUNT(*)::INTEGER INTO v_recent
    FROM public.trades t
    WHERE t.status = 'cancelled'
      AND t.cancelled_at >= v_now - INTERVAL '7 days';

    SELECT COUNT(*)::INTEGER INTO v_prior
    FROM public.trades t
    WHERE t.status = 'cancelled'
      AND t.cancelled_at >= v_now - INTERVAL '14 days'
      AND t.cancelled_at <  v_now - INTERVAL '7 days';

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'reason', x.reason,
        'count',  x.cnt
      ) ORDER BY x.cnt DESC
    ), '[]'::jsonb) INTO v_reasons
    FROM (
      SELECT t.cancellation_reason AS reason, COUNT(*)::INTEGER AS cnt
      FROM public.trades t
      WHERE t.status = 'cancelled'
        AND t.cancelled_at >= v_now - INTERVAL '7 days'
        AND t.cancellation_reason IS NOT NULL
      GROUP BY t.cancellation_reason
    ) x;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'user_id',      q.user_id,
        'seller_name',  q.seller_name,
        'seller_email', q.seller_email,
        'cancelled_7d', q.cnt
      ) ORDER BY q.cnt DESC
    ), '[]'::jsonb) INTO v_top_users
    FROM (
      SELECT
        y.user_id,
        pr.name  AS seller_name,
        pr.email AS seller_email,
        y.cnt
      FROM (
        SELECT t.seller_id AS user_id, COUNT(*)::INTEGER AS cnt
        FROM public.trades t
        WHERE t.status = 'cancelled'
          AND t.cancelled_at >= v_now - INTERVAL '7 days'
        GROUP BY t.seller_id
        ORDER BY cnt DESC
        LIMIT 5
      ) y
      LEFT JOIN public.profiles pr ON pr.user_id = y.user_id
    ) q;

    v_result := jsonb_build_object(
      'recent_7d', v_recent,
      'prior_7d',  v_prior,
      'reasons',   v_reasons,
      'top_users', v_top_users
    );

  ELSIF p_source = 'failed_payouts' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',              sp.id,
        'user_id',         sp.user_id,
        'trade_id',        sp.trade_id,
        'net_amount_cents', sp.net_amount_cents,
        'status',          sp.status,
        'failure_reason',  sp.failure_reason,
        'created_at',      sp.created_at,
        'seller_name',     pr.name,
        'seller_email',    au.email
      ) ORDER BY sp.created_at DESC
    ), '[]'::jsonb) INTO v_result
    FROM public.seller_payouts sp
    LEFT JOIN public.profiles pr ON pr.user_id = sp.user_id
    LEFT JOIN auth.users au ON au.id = sp.user_id
    WHERE sp.status = 'failed';

  ELSIF p_source = 'config_drift' THEN
    WITH drift AS (
      SELECT d.key, d.default_val, d.min_val, d.max_val
      FROM (VALUES
        ('grace_period_days',                 90,   30,  180),
        ('offer_timeout_hours',               48,   1,   168),
        ('offer_notif_1_hours_before',        24,   1,   168),
        ('offer_notif_2_hours_before',        6,    1,   168),
        ('auto_complete_hours',               72,   24,  336),
        ('auto_complete_notif_hours_before',  12,   1,   72),
        ('pending_sp_release_days',           3,    1,   30),
        ('transaction_fee_member_cents',      99,   0,   10000),
        ('transaction_fee_non_member_cents',  299,  0,   10000),
        ('sp_max_percentage_per_purchase',    50,   0,   100),
        ('min_listing_price',                 0,    0,   10000)
      ) AS d(key, default_val, min_val, max_val)
    )
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'key',               ac.key,
        'value',             ac.value,
        'documented_default', d.default_val,
        'recommended_min',   d.min_val,
        'recommended_max',   d.max_val
      ) ORDER BY ac.key
    ), '[]'::jsonb) INTO v_result
    FROM public.admin_config ac
    JOIN drift d ON d.key = ac.key
    WHERE ac.is_active = TRUE
      AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND (ac.value)::NUMERIC NOT BETWEEN d.min_val AND d.max_val;

  ELSE
    RETURN jsonb_build_object('error', 'unknown_source');
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- BLOCK 2: Security — admin-only, service role (bypasses RLS; data is read-only)
-- ============================================================================
REVOKE ALL ON FUNCTION public.admin_action_center_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_action_center_detail(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_action_center_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_action_center_detail(TEXT) TO service_role;

-- ============================================================================
-- Verification (run one statement at a time):
--   SELECT public.admin_action_center_summary();
--   SELECT public.admin_action_center_detail('flagged_items');
--   SELECT public.admin_action_center_detail('disputes');
--   SELECT public.admin_action_center_detail('id_badge_requests');
--   SELECT public.admin_action_center_detail('cancel_anomalies');
--   SELECT public.admin_action_center_detail('failed_payouts');
--   SELECT public.admin_action_center_detail('config_drift');
--   SELECT public.admin_action_center_detail('unknown');
-- ============================================================================
