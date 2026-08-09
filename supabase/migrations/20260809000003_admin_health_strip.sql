-- ============================================================================
-- Admin Dashboard — System Health Strip
-- Mode B: Idempotent Rerunnable Migration
--
-- PROBLEM:
--   The dashboard has no at-a-glance view of key health signals. This migration
--   adds ONE read-only RPC (admin_health_summary) that aggregates 6 indicators:
--     1) payments        — failed payment rate (last 7d)      from `payments`
--     2) email_delivery  — delivery success % (last 7d)       from `email_logs`
--     3) nodes_active    — active/total nodes                 from `nodes`
--     4) failed_payouts  — count needing attention            from `seller_payouts`
--     5) uptime          — config-driven input                (BRD NFR-AVAIL-001: 99.9%)
--     6) gmv_7d          — completed-trade volume (last 7d)   from `trades`
--
--   Every indicator carries its own warn/crit THRESHOLDS stored in admin_config
--   (category 'health'; the enum value is added by the dedicated migration
--   20260809000002_add_health_config_category.sql) so they can be tuned WITHOUT
--   a code change. The RPC returns value + thresholds; the admin UI derives the
--   dot color from them.
--
--   Uptime has no telemetry table, so it is a config-driven input
--   (`health_uptime_percent`, default 99.9 per BRD NFR-AVAIL-001 / SR line 102).
--   "Email Delivery" is used instead of "SMS Delivery" because `email_logs` is
--   the only delivery-status table that exists (sms_rate_limit_log tracks
--   sends, not outcomes; email_logs tracks delivered/failed/bounced).
--
-- BLOCK 1: threshold seeds (run first, verify)
-- BLOCK 2: RPC + security grants
--
-- Naming: p_ params, v_ locals, qualified columns (supabase-sql.instructions).
-- ============================================================================

-- ============================================================================
-- BLOCK 1: health threshold seeds (category 'health')
-- ============================================================================
-- Threshold semantics per indicator (direction is a UI concern; the RPC only
-- returns value + thresholds):
--   payments        failure %  (higher = worse)
--   email_delivery  success %  (lower  = worse)
--   nodes_active    active %   (lower  = worse)
--   failed_payouts  count      (higher = worse)
--   uptime          %          (lower  = worse)
--   gmv_7d          USD        (lower  = worse)
-- Seeds go through the shared upsert_admin_config_setting RPC (BP-48: never a
-- direct admin_config INSERT/UPDATE from app/EF/seed code). p_admin_id = NULL
-- marks these as system defaults; COALESCE keeps any existing editor intact.
--
-- CATEGORY NOTE: category = 'health' is used here; the enum label is added by
-- the dedicated migration 20260809000002_add_health_config_category.sql which
-- runs before this one. A new enum value CANNOT be added and used in the same
-- migration (SQLSTATE 55P04 "unsafe use of new value ... New enum values must be
-- committed before they can be used"), hence the separate enum migration.

SELECT public.upsert_admin_config_setting('health_payment_failure_warn_pct', '2',   'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_payment_failure_crit_pct', '5',   'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_email_delivery_warn_pct', '95',   'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_email_delivery_crit_pct', '90',   'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_nodes_active_warn_pct', '80',     'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_nodes_active_crit_pct', '50',     'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_failed_payouts_warn', '1',        'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_failed_payouts_crit', '4',        'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_uptime_percent', '99.9',          'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_uptime_warn_pct', '99.9',         'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_uptime_crit_pct', '99.0',         'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_gmv_warn_usd', '2500',            'health', 'number', FALSE, TRUE, NULL);
SELECT public.upsert_admin_config_setting('health_gmv_crit_usd', '500',             'health', 'number', FALSE, TRUE, NULL);

-- ============================================================================
-- BLOCK 2: admin_health_summary()
-- ============================================================================
-- Returns a JSONB feed:
--   {
--     "generated_at": "<timestamptz>",
--     "indicators": [
--       { "id": "payments",        "value": 1.2, "display": "1.2%",
--         "thresholds": { "warn": 2, "crit": 5 } },
--       { "id": "email_delivery",  "value": 98.4, "display": "98.4%", ... },
--       { "id": "nodes_active",    "value": 100, "display": "14/14",
--         "detail": "14 of 14 nodes active", ... },
--       { "id": "failed_payouts",  "value": 3, "display": "3", ... },
--       { "id": "uptime",          "value": 99.9, "display": "99.9%", ... },
--       { "id": "gmv_7d",          "value": 12450, "display": "$12450", ... }
--     ]
--   }
-- Data-only (no writes). Thresholds are read from admin_config with documented
-- hardcoded fallbacks (BP-22: COALESCE chain always ends in the canonical
-- default; these defaults match the BLOCK 1 seeds).
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_health_summary();

CREATE OR REPLACE FUNCTION public.admin_health_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now            TIMESTAMPTZ;
  -- computed metrics
  v_pay_total      INTEGER;
  v_pay_failed     INTEGER;
  v_pay_rate       NUMERIC;
  v_email_ok       INTEGER;
  v_email_bad      INTEGER;
  v_email_rate     NUMERIC;
  v_nodes_total    INTEGER;
  v_nodes_active   INTEGER;
  v_nodes_pct      NUMERIC;
  v_payout_failed  INTEGER;
  v_uptime         NUMERIC;
  v_gmv_cents      BIGINT;
  v_gmv_usd        NUMERIC;
  -- thresholds (from admin_config, category 'health')
  v_pay_warn       NUMERIC;
  v_pay_crit       NUMERIC;
  v_email_warn     NUMERIC;
  v_email_crit     NUMERIC;
  v_nodes_warn     NUMERIC;
  v_nodes_crit     NUMERIC;
  v_payout_warn    NUMERIC;
  v_payout_crit    NUMERIC;
  v_uptime_warn    NUMERIC;
  v_uptime_crit    NUMERIC;
  v_gmv_warn       NUMERIC;
  v_gmv_crit       NUMERIC;
  v_indicators     JSONB;
BEGIN
  v_now := NOW();

  -- 1) Payments — failed payment rate over the last 7 days.
  SELECT COUNT(*)::INTEGER INTO v_pay_total
  FROM public.payments p
  WHERE p.created_at >= v_now - INTERVAL '7 days';

  SELECT COUNT(*)::INTEGER INTO v_pay_failed
  FROM public.payments p
  WHERE p.created_at >= v_now - INTERVAL '7 days'
    AND p.status = 'failed';

  v_pay_rate := COALESCE(
    ROUND(100.0 * v_pay_failed / NULLIF(v_pay_total, 0), 1),
    0
  );

  -- 2) Email delivery — success % over the last 7 days. Delivery outcomes only
  --    (delivered/opened/clicked = success; failed/bounced = failure). In-flight
  --    'pending'/'sent' and 'unsubscribed' are excluded. No emails in window =
  --    nothing failed = healthy (COALESCE 100).
  SELECT COUNT(*)::INTEGER INTO v_email_ok
  FROM public.email_logs e
  WHERE e.created_at >= v_now - INTERVAL '7 days'
    AND e.status IN ('delivered', 'opened', 'clicked');

  SELECT COUNT(*)::INTEGER INTO v_email_bad
  FROM public.email_logs e
  WHERE e.created_at >= v_now - INTERVAL '7 days'
    AND e.status IN ('failed', 'bounced');

  v_email_rate := COALESCE(
    ROUND(100.0 * v_email_ok / NULLIF(v_email_ok + v_email_bad, 0), 1),
    100
  );

  -- 3) Nodes — active vs total (current snapshot).
  SELECT COUNT(*)::INTEGER INTO v_nodes_total
  FROM public.nodes n;

  SELECT COUNT(*)::INTEGER INTO v_nodes_active
  FROM public.nodes n
  WHERE n.is_active = TRUE;

  v_nodes_pct := COALESCE(
    ROUND(100.0 * v_nodes_active / NULLIF(v_nodes_total, 0), 0),
    0
  );

  -- 4) Failed payouts needing manual retry (PAY-008) — mirrors the Action Center.
  SELECT COUNT(*)::INTEGER INTO v_payout_failed
  FROM public.seller_payouts sp
  WHERE sp.status = 'failed';

  -- 5) Uptime — config-driven input (BRD NFR-AVAIL-001 default 99.9).
  SELECT (ac.value)::NUMERIC INTO v_uptime
  FROM public.admin_config ac
  WHERE ac.key = 'health_uptime_percent'
    AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$'
  LIMIT 1;
  v_uptime := COALESCE(v_uptime, 99.9);

  -- 6) GMV (7d) — completed-trade volume (USD, rounded).
  SELECT COALESCE(SUM(t.cash_amount_cents), 0)::BIGINT INTO v_gmv_cents
  FROM public.trades t
  WHERE t.status = 'completed'
    AND t.completed_at >= v_now - INTERVAL '7 days';

  v_gmv_usd := ROUND(v_gmv_cents / 100.0, 0);

  -- Threshold reads (regex-guarded numeric cast + documented fallback).
  SELECT (ac.value)::NUMERIC INTO v_pay_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_payment_failure_warn_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_pay_warn := COALESCE(v_pay_warn, 2.0);

  SELECT (ac.value)::NUMERIC INTO v_pay_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_payment_failure_crit_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_pay_crit := COALESCE(v_pay_crit, 5.0);

  SELECT (ac.value)::NUMERIC INTO v_email_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_email_delivery_warn_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_email_warn := COALESCE(v_email_warn, 95.0);

  SELECT (ac.value)::NUMERIC INTO v_email_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_email_delivery_crit_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_email_crit := COALESCE(v_email_crit, 90.0);

  SELECT (ac.value)::NUMERIC INTO v_nodes_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_nodes_active_warn_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_nodes_warn := COALESCE(v_nodes_warn, 80.0);

  SELECT (ac.value)::NUMERIC INTO v_nodes_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_nodes_active_crit_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_nodes_crit := COALESCE(v_nodes_crit, 50.0);

  SELECT (ac.value)::NUMERIC INTO v_payout_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_failed_payouts_warn' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_payout_warn := COALESCE(v_payout_warn, 1.0);

  SELECT (ac.value)::NUMERIC INTO v_payout_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_failed_payouts_crit' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_payout_crit := COALESCE(v_payout_crit, 4.0);

  SELECT (ac.value)::NUMERIC INTO v_uptime_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_uptime_warn_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_uptime_warn := COALESCE(v_uptime_warn, 99.9);

  SELECT (ac.value)::NUMERIC INTO v_uptime_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_uptime_crit_pct' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_uptime_crit := COALESCE(v_uptime_crit, 99.0);

  SELECT (ac.value)::NUMERIC INTO v_gmv_warn
  FROM public.admin_config ac
  WHERE ac.key = 'health_gmv_warn_usd' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_gmv_warn := COALESCE(v_gmv_warn, 2500.0);

  SELECT (ac.value)::NUMERIC INTO v_gmv_crit
  FROM public.admin_config ac
  WHERE ac.key = 'health_gmv_crit_usd' AND ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$' LIMIT 1;
  v_gmv_crit := COALESCE(v_gmv_crit, 500.0);

  v_indicators := jsonb_build_array(
    jsonb_build_object(
      'id', 'payments', 'value', v_pay_rate, 'display', v_pay_rate || '%',
      'thresholds', jsonb_build_object('warn', v_pay_warn, 'crit', v_pay_crit)
    ),
    jsonb_build_object(
      'id', 'email_delivery', 'value', v_email_rate, 'display', v_email_rate || '%',
      'thresholds', jsonb_build_object('warn', v_email_warn, 'crit', v_email_crit)
    ),
    jsonb_build_object(
      'id', 'nodes_active', 'value', v_nodes_pct,
      'display', v_nodes_active || '/' || v_nodes_total,
      'detail', v_nodes_active || ' of ' || v_nodes_total || ' nodes active',
      'thresholds', jsonb_build_object('warn', v_nodes_warn, 'crit', v_nodes_crit)
    ),
    jsonb_build_object(
      'id', 'failed_payouts', 'value', v_payout_failed,
      'display', v_payout_failed::TEXT,
      'thresholds', jsonb_build_object('warn', v_payout_warn, 'crit', v_payout_crit)
    ),
    jsonb_build_object(
      'id', 'uptime', 'value', v_uptime, 'display', v_uptime || '%',
      'thresholds', jsonb_build_object('warn', v_uptime_warn, 'crit', v_uptime_crit)
    ),
    jsonb_build_object(
      'id', 'gmv_7d', 'value', v_gmv_usd, 'display', '$' || v_gmv_usd,
      'thresholds', jsonb_build_object('warn', v_gmv_warn, 'crit', v_gmv_crit)
    )
  );

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'indicators',   v_indicators
  );
END;
$$;

-- ============================================================================
-- BLOCK 2 (cont): Security — admin-only, service role (read-only)
-- ============================================================================
REVOKE ALL ON FUNCTION public.admin_health_summary() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_health_summary() TO service_role;

-- ============================================================================
-- Verification (run one statement at a time):
--   SELECT key, value, category, is_active FROM public.admin_config
--     WHERE category = 'health' ORDER BY key;
--   SELECT public.admin_health_summary();
--   SELECT tablename, rowsecurity FROM pg_tables
--     WHERE schemaname = 'public' AND tablename IN ('payments','email_logs','nodes','seller_payouts','trades');
-- ============================================================================
