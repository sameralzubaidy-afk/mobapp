-- ============================================================================
-- FIX (2026-08-01): get_tax_summary_for_period 'refunds' report type was broken.
--
-- MODE: Idempotent rerunnable (CREATE OR REPLACE FUNCTION).
--
-- BUG (from 20260724000002_fix_tax_refund_reconciliation.sql):
--   The 'refunds' branch of get_tax_summary_for_period referenced `tr.*`
--   columns in the OUTER query (SUM(tr.refunded_tax_cents), COUNT(*), and
--   ORDER BY COALESCE(tr.refunded_at, tr.updated_at) inside jsonb_agg) while
--   `tr` is only in scope inside the inner subquery `j`. Postgres raised:
--       ERROR:  missing FROM-clause entry for table "tr"
--   This made the "Refunds" tab (and the whole reports page, since the admin
--   UI crashed on the undefined rows) fail.
--
-- FIX:
--   Compute total_refunded_cents / refund_count / rows all from a single
--   aliased subquery `rj` so no outer reference to `tr` remains. Sort key
--   `sort_at` is added so jsonb_agg(... ORDER BY) can order the array rows
--   without touching `tr`.
--
-- No other report types or the function signature/return shape changed.
-- Callers (admin tax reports page) are unaffected other than the Refunds tab
-- now returning valid JSON instead of a SQL error.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tax_summary_for_period(
  p_start_date   DATE,
  p_end_date     DATE,
  p_node_id      UUID    DEFAULT NULL,
  p_report_type  TEXT    DEFAULT 'summary',
  p_status_filter TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
-- SECURITY DEFINER: needed to read tax_records across all nodes for admin reporting
DECLARE
  v_result JSONB;
  v_status_filter TEXT;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'start/end required')
    );
  END IF;

  v_status_filter := COALESCE(NULLIF(TRIM(p_status_filter), ''), 'all');

  -- ── summary (default) ──────────────────────────────────────────────────────
  IF p_report_type = 'summary' THEN
    WITH
      date_ranged AS (
        SELECT * FROM public.tax_records tr
        WHERE
          CASE tr.tax_status
            WHEN 'collected' THEN tr.captured_at::date BETWEEN p_start_date AND p_end_date
            WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at)::date BETWEEN p_start_date AND p_end_date
            WHEN 'partially_refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at)::date BETWEEN p_start_date AND p_end_date
            ELSE tr.created_at::date BETWEEN p_start_date AND p_end_date
          END
          AND (p_node_id IS NULL OR tr.node_id = p_node_id)
      ),
      collected AS (
        SELECT * FROM date_ranged WHERE tax_status = 'collected'
      ),
      refunded AS (
        SELECT * FROM date_ranged WHERE tax_status IN ('refunded', 'partially_refunded')
      ),
      pending_tax AS (
        SELECT * FROM date_ranged WHERE tax_status = 'quoted'
      ),
      voided_tax AS (
        SELECT * FROM date_ranged WHERE tax_status = 'voided'
      ),
      capture_failed_tax AS (
        SELECT * FROM date_ranged WHERE tax_status = 'capture_failed'
      ),
      reconciliation_tax AS (
        SELECT * FROM date_ranged WHERE tax_status = 'reconciliation_required'
      ),
      pending_refund_tax AS (
        SELECT * FROM date_ranged WHERE tax_status = 'pending_refund'
      )
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date',              p_start_date,
        'end_date',                p_end_date,
        'node_id',                 p_node_id,
        'status_filter',           v_status_filter,
        'taxable_sales_cents',     COALESCE((SELECT SUM(trr.taxable_amount_cents) FROM collected trr), 0),
        'tax_collected_cents',     COALESCE((SELECT SUM(trr.tax_amount_cents) FROM collected trr), 0),
        'tax_refunded_cents',      COALESCE((SELECT SUM(trr.refunded_tax_cents) FROM refunded trr), 0),
        'tax_net_cents',           COALESCE((SELECT SUM(trr.tax_amount_cents) FROM collected trr), 0)
                                   - COALESCE((SELECT SUM(trr.refunded_tax_cents) FROM refunded trr), 0),
        'pending_tax_count',       (SELECT COUNT(*) FROM pending_tax),
        'pending_tax_cents',       COALESCE((SELECT SUM(trr.tax_amount_cents) FROM pending_tax trr), 0),
        'voided_tax_count',        (SELECT COUNT(*) FROM voided_tax),
        'voided_tax_cents',        COALESCE((SELECT SUM(trr.tax_amount_cents) FROM voided_tax trr), 0),
        'capture_failed_count',    (SELECT COUNT(*) FROM capture_failed_tax),
        'capture_failed_cents',    COALESCE((SELECT SUM(trr.tax_amount_cents) FROM capture_failed_tax trr), 0),
        'pending_refund_count',    (SELECT COUNT(*) FROM pending_refund_tax),
        'pending_refund_cents',    COALESCE((SELECT SUM(trr.tax_amount_cents) FROM pending_refund_tax trr), 0),
        'reconciliation_count',    (SELECT COUNT(*) FROM reconciliation_tax),
        'reconciliation_cents',    COALESCE((SELECT SUM(trr.tax_amount_cents) FROM reconciliation_tax trr), 0),
        'transaction_count',       (SELECT COUNT(*) FROM date_ranged),
        'by_jurisdiction', COALESCE(
          (SELECT jsonb_agg(row_to_json(j))
           FROM (
             SELECT
               COALESCE(trr.tax_jurisdiction, 'UNKNOWN') AS jurisdiction,
               COUNT(*)                                   AS transaction_count,
               SUM(trr.taxable_amount_cents)              AS taxable_total_cents,
               SUM(trr.tax_amount_cents)                  AS tax_collected_cents,
               SUM(trr.refunded_tax_cents)                AS tax_refunded_cents,
               SUM(trr.tax_amount_cents - trr.refunded_tax_cents) AS tax_net_cents
             FROM date_ranged trr
             WHERE trr.tax_status IN ('collected', 'refunded', 'partially_refunded')
             GROUP BY COALESCE(trr.tax_jurisdiction, 'UNKNOWN')
             ORDER BY 1
           ) j
          ),
          '[]'::jsonb
        )
      )
    ) INTO v_result;
    RETURN v_result;
  END IF;

  -- ── jurisdictions ──────────────────────────────────────────────────────────
  IF p_report_type = 'jurisdictions' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date', p_start_date,
        'end_date',   p_end_date,
        'rows', COALESCE(jsonb_agg(row_to_json(j)), '[]'::jsonb)
      )
    )
    INTO v_result
    FROM (
      SELECT
        COALESCE(tr.tax_jurisdiction, 'UNKNOWN') AS jurisdiction,
        COUNT(*)                                  AS transaction_count,
        SUM(tr.taxable_amount_cents)              AS taxable_total_cents,
        SUM(tr.tax_amount_cents)                  AS tax_collected_cents,
        SUM(tr.refunded_tax_cents)                AS tax_refunded_cents,
        SUM(tr.tax_amount_cents - tr.refunded_tax_cents) AS tax_net_cents
      FROM public.tax_records tr
      WHERE
        CASE tr.tax_status
          WHEN 'collected' THEN tr.captured_at::date BETWEEN p_start_date AND p_end_date
          WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at)::date BETWEEN p_start_date AND p_end_date
          WHEN 'partially_refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at)::date BETWEEN p_start_date AND p_end_date
          ELSE tr.created_at::date BETWEEN p_start_date AND p_end_date
        END
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
        AND tr.tax_status IN ('collected', 'refunded', 'partially_refunded')
      GROUP BY COALESCE(tr.tax_jurisdiction, 'UNKNOWN')
      ORDER BY 1
    ) j;
    RETURN v_result;
  END IF;

  -- ── transactions ───────────────────────────────────────────────────────────
  IF p_report_type = 'transactions' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date', p_start_date,
        'end_date',   p_end_date,
        'status_filter', v_status_filter,
        'rows', COALESCE(jsonb_agg(row_to_json(j)), '[]'::jsonb)
      )
    )
    INTO v_result
    FROM (
      SELECT
        tr.id, tr.trade_id, tr.buyer_id, tr.node_id,
        tr.taxable_amount_cents, tr.tax_rate, tr.tax_amount_cents,
        tr.tax_jurisdiction, tr.refunded_tax_cents,
        tr.tax_status, tr.captured_at, tr.voided_at, tr.refunded_at,
        tr.stripe_refund_id, tr.stripe_capture_id,
        tr.reconciliation_status, tr.reconciliation_reason,
        tr.tax_snapshot, tr.created_at AS offered_at, tr.updated_at
      FROM public.tax_records tr
      WHERE
        CASE tr.tax_status
          WHEN 'collected' THEN tr.captured_at::date BETWEEN p_start_date AND p_end_date
          WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at)::date BETWEEN p_start_date AND p_end_date
          WHEN 'partially_refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at)::date BETWEEN p_start_date AND p_end_date
          ELSE tr.created_at::date BETWEEN p_start_date AND p_end_date
        END
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
        AND (v_status_filter = 'all' OR tr.tax_status::TEXT = v_status_filter)
      ORDER BY
        CASE tr.tax_status
          WHEN 'collected' THEN tr.captured_at
          WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)
          ELSE tr.created_at
        END DESC
      LIMIT 1000
    ) j;
    RETURN v_result;
  END IF;

  -- ── refunds ────────────────────────────────────────────────────────────────
  -- FIXED (2026-08-01): previously the outer query referenced `tr.*` columns
  -- (SUM(tr.refunded_tax_cents), COUNT(*), ORDER BY COALESCE(tr.refunded_at,...))
  -- even though `tr` only existed inside the subquery → "missing FROM-clause
  -- entry for table tr". All values now come from the single alias `rj`.
  IF p_report_type = 'refunds' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date',           p_start_date,
        'end_date',             p_end_date,
        'total_refunded_cents', COALESCE(SUM(rj.refunded_tax_cents), 0),
        'refund_count',         COUNT(*),
        'rows', COALESCE(jsonb_agg(row_to_json(rj) ORDER BY rj.sort_at DESC), '[]'::jsonb)
      )
    )
    INTO v_result
    FROM (
      SELECT
        tr.id, tr.trade_id,
        tr.refunded_tax_cents, tr.tax_amount_cents,
        tr.refund_reason, tr.tax_jurisdiction,
        tr.tax_status, tr.stripe_refund_id,
        tr.refunded_at, tr.refund_status,
        tr.created_at AS offered_at, tr.updated_at,
        COALESCE(tr.refunded_at, tr.updated_at) AS sort_at
      FROM public.tax_records tr
      WHERE
        COALESCE(tr.refunded_at, tr.updated_at, tr.created_at)::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
        AND tr.refunded_tax_cents > 0
      ORDER BY COALESCE(tr.refunded_at, tr.updated_at) DESC
      LIMIT 500
    ) rj;
    RETURN v_result;
  END IF;

  -- ── by_period ──────────────────────────────────────────────────────────────
  IF p_report_type = 'by_period' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date', p_start_date,
        'end_date',   p_end_date,
        'period',     'daily',
        'rows', COALESCE(jsonb_agg(row_to_json(j)), '[]'::jsonb)
      )
    )
    INTO v_result
    FROM (
      SELECT
        CASE tr.tax_status
          WHEN 'collected' THEN tr.captured_at::date
          WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)::date
          WHEN 'partially_refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)::date
          ELSE tr.created_at::date
        END AS period_date,
        COUNT(*) AS transaction_count,
        SUM(tr.taxable_amount_cents) AS taxable_total_cents,
        SUM(CASE WHEN tr.tax_status = 'collected' THEN tr.tax_amount_cents ELSE 0 END) AS tax_collected_cents,
        SUM(CASE WHEN tr.tax_status IN ('refunded', 'partially_refunded') THEN tr.refunded_tax_cents ELSE 0 END) AS tax_refunded_cents,
        SUM(CASE WHEN tr.tax_status = 'collected' THEN tr.tax_amount_cents ELSE 0 END)
        - SUM(CASE WHEN tr.tax_status IN ('refunded', 'partially_refunded') THEN tr.refunded_tax_cents ELSE 0 END) AS tax_net_cents
      FROM public.tax_records tr
      WHERE
        CASE tr.tax_status
          WHEN 'collected' THEN tr.captured_at::date BETWEEN p_start_date AND p_end_date
          WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)::date BETWEEN p_start_date AND p_end_date
          WHEN 'partially_refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)::date BETWEEN p_start_date AND p_end_date
          ELSE tr.created_at::date BETWEEN p_start_date AND p_end_date
        END
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
      GROUP BY CASE tr.tax_status
        WHEN 'collected' THEN tr.captured_at::date
        WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)::date
        WHEN 'partially_refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)::date
        ELSE tr.created_at::date
      END
      ORDER BY 1
    ) j;
    RETURN v_result;
  END IF;

  -- ── tax_exempt ─────────────────────────────────────────────────────────────
  IF p_report_type = 'tax_exempt' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date', p_start_date,
        'end_date',   p_end_date,
        'rows', COALESCE(jsonb_agg(row_to_json(j)), '[]'::jsonb)
      )
    )
    INTO v_result
    FROM (
      SELECT
        tr.id, tr.trade_id, tr.buyer_id, tr.node_id,
        tr.taxable_amount_cents, tr.tax_rate, tr.tax_jurisdiction,
        tr.created_at AS offered_at, tr.captured_at, tr.tax_snapshot
      FROM public.tax_records tr
      WHERE
        tr.captured_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
        AND tr.taxable_amount_cents > 0
        AND tr.tax_amount_cents = 0
        AND tr.tax_status = 'collected'
      ORDER BY tr.captured_at DESC
      LIMIT 500
    ) j;
    RETURN v_result;
  END IF;

  -- ── audit_trail ────────────────────────────────────────────────────────────
  IF p_report_type = 'audit_trail' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date', p_start_date,
        'end_date',   p_end_date,
        'rows', COALESCE(jsonb_agg(row_to_json(j)), '[]'::jsonb)
      )
    )
    INTO v_result
    FROM (
      SELECT
        tr.id, tr.trade_id, tr.buyer_id, tr.node_id,
        tr.taxable_amount_cents, tr.tax_rate, tr.tax_amount_cents,
        tr.tax_jurisdiction, tr.refunded_tax_cents, tr.refund_reason,
        tr.tax_status, tr.captured_at, tr.voided_at, tr.refunded_at,
        tr.stripe_refund_id, tr.stripe_capture_id,
        tr.reconciliation_status, tr.reconciliation_reason,
        tr.tax_snapshot, tr.created_at, tr.updated_at
      FROM public.tax_records tr
      WHERE tr.updated_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
      ORDER BY tr.updated_at DESC
      LIMIT 2000
    ) j;
    RETURN v_result;
  END IF;

  -- ── reconciliation_required ────────────────────────────────────────────────
  IF p_report_type = 'reconciliation_required' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date', p_start_date,
        'end_date',   p_end_date,
        'rows', COALESCE(jsonb_agg(row_to_json(j)), '[]'::jsonb)
      )
    )
    INTO v_result
    FROM (
      SELECT
        tr.id, tr.trade_id, tr.buyer_id, tr.node_id,
        tr.taxable_amount_cents, tr.tax_rate, tr.tax_amount_cents,
        tr.tax_jurisdiction, tr.refunded_tax_cents,
        tr.tax_status, tr.reconciliation_status, tr.reconciliation_reason,
        tr.stripe_refund_id, tr.stripe_capture_id,
        tr.captured_at, tr.refunded_at, tr.tax_snapshot,
        tr.created_at, tr.updated_at
      FROM public.tax_records tr
      WHERE
        (tr.tax_status = 'reconciliation_required'::public.tax_status
         OR tr.reconciliation_status IS NOT NULL)
        AND tr.updated_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
      ORDER BY tr.updated_at DESC
      LIMIT 500
    ) j;
    RETURN v_result;
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object(
      'code',    'INVALID_REPORT_TYPE',
      'message', 'Valid report types: summary, jurisdictions, transactions, refunds, by_period, tax_exempt, audit_trail, reconciliation_required',
      'details', jsonb_build_object('received', p_report_type)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_tax_summary_for_period IS
'REPLACED (2026-08-01): fixed Refunds report-type SQL bug (missing FROM-clause entry for table tr). Otherwise identical to 2026-07-24 status-filtered version. Tax Collected = captured only. Tax Refunded = verified Stripe refunds only.';

GRANT EXECUTE ON FUNCTION public.get_tax_summary_for_period(DATE, DATE, UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- ============================================================================
-- BLOCK 2 — Verification
-- ============================================================================
-- Run these in the Supabase SQL Editor AFTER applying the migration above:
--
-- 1) Refunds report type must return valid JSON (no "missing FROM-clause"
--    error) — rows may be empty if there are no refunds in the window:
--   SELECT get_tax_summary_for_period(
--     CURRENT_DATE - 30, CURRENT_DATE, NULL, 'refunds', 'all'
--   );
--   -- Expected: {"success": true, "data": {..., "rows": [...]}}
--
-- 2) Every report type returns success without a SQL error:
--   SELECT
--     (get_tax_summary_for_period(CURRENT_DATE - 30, CURRENT_DATE, NULL, t, 'all')::jsonb ->> 'success') AS ok,
--     t
--   FROM (VALUES ('summary'),('jurisdictions'),('transactions'),('refunds'),
--                ('by_period'),('tax_exempt'),('audit_trail'),
--                ('reconciliation_required')) v(t);
--   -- Expected: ok = 'true' for all 8 rows.
--
-- 3) Signature unchanged (5 params):
--   SELECT pg_get_function_arguments(oid)
--   FROM pg_proc WHERE proname = 'get_tax_summary_for_period';
--   -- Expected: p_start_date date, p_end_date date, p_node_id uuid,
--   --           p_report_type text, p_status_filter text
-- ============================================================================
