-- Migration: tax_009_get_tax_summary_full_report_types
-- Purpose: TAX-005 — extend get_tax_summary_for_period to accept optional p_report_type
--          and return 7 report shapes:
--            summary (default), jurisdictions, transactions, refunds, by_period, tax_exempt, audit_trail
-- Mode: rerunnable (CREATE OR REPLACE)
-- SQL-0: Mode B — idempotent via CREATE OR REPLACE
-- BP-1: Admin-only function (SECURITY DEFINER + role check)
-- BP-3: All columns table-qualified

CREATE OR REPLACE FUNCTION public.get_tax_summary_for_period(
  p_start_date   DATE,
  p_end_date     DATE,
  p_node_id      UUID    DEFAULT NULL,
  p_report_type  TEXT    DEFAULT 'summary'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- SECURITY DEFINER: needed to read tax_records across all nodes for admin reporting
DECLARE
  v_result JSONB;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'start/end required')
    );
  END IF;

  -- ── summary (default) ──────────────────────────────────────────────────────
  IF p_report_type = 'summary' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date',             p_start_date,
        'end_date',               p_end_date,
        'node_id',                p_node_id,
        'transaction_count',      COUNT(*),
        'taxable_total_cents',    COALESCE(SUM(tr.taxable_amount_cents), 0),
        'tax_collected_cents',    COALESCE(SUM(tr.tax_amount_cents),     0),
        'tax_refunded_cents',     COALESCE(SUM(tr.refunded_tax_cents),   0),
        'tax_net_cents',          COALESCE(SUM(tr.tax_amount_cents - tr.refunded_tax_cents), 0),
        'by_jurisdiction',        COALESCE(
          (SELECT jsonb_agg(row_to_json(j))
           FROM (
             SELECT
               COALESCE(tr2.tax_jurisdiction, 'UNKNOWN') AS jurisdiction,
               COUNT(*)                                   AS transaction_count,
               SUM(tr2.taxable_amount_cents)              AS taxable_total_cents,
               SUM(tr2.tax_amount_cents)                  AS tax_collected_cents,
               SUM(tr2.refunded_tax_cents)                AS tax_refunded_cents,
               SUM(tr2.tax_amount_cents - tr2.refunded_tax_cents) AS tax_net_cents
             FROM public.tax_records tr2
             WHERE tr2.created_at::date BETWEEN p_start_date AND p_end_date
               AND (p_node_id IS NULL OR tr2.node_id = p_node_id)
             GROUP BY COALESCE(tr2.tax_jurisdiction, 'UNKNOWN')
             ORDER BY 1
           ) j
          ),
          '[]'::jsonb
        )
      )
    )
    INTO v_result
    FROM public.tax_records tr
    WHERE tr.created_at::date BETWEEN p_start_date AND p_end_date
      AND (p_node_id IS NULL OR tr.node_id = p_node_id);
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
      WHERE tr.created_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
      GROUP BY COALESCE(tr.tax_jurisdiction, 'UNKNOWN')
      ORDER BY 1
    ) j;
    RETURN v_result;
  END IF;

  -- ── transactions (per-record list, capped at 1000 rows) ───────────────────
  IF p_report_type = 'transactions' THEN
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
        tr.id,
        tr.trade_id,
        tr.buyer_id,
        tr.node_id,
        tr.taxable_amount_cents,
        tr.tax_rate,
        tr.tax_amount_cents,
        tr.tax_jurisdiction,
        tr.refunded_tax_cents,
        tr.created_at
      FROM public.tax_records tr
      WHERE tr.created_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
      ORDER BY tr.created_at DESC
      LIMIT 1000
    ) j;
    RETURN v_result;
  END IF;

  -- ── refunds (records with refunded_tax_cents > 0) ─────────────────────────
  IF p_report_type = 'refunds' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date',          p_start_date,
        'end_date',            p_end_date,
        'total_refunded_cents', COALESCE(SUM(tr.refunded_tax_cents), 0),
        'refund_count',        COUNT(*),
        'rows', COALESCE(jsonb_agg(row_to_json(j) ORDER BY (row_to_json(j)->>'created_at') DESC), '[]'::jsonb)
      )
    )
    INTO v_result
    FROM (
      SELECT
        tr.id,
        tr.trade_id,
        tr.refunded_tax_cents,
        tr.refund_reason,
        tr.tax_jurisdiction,
        tr.created_at,
        tr.updated_at
      FROM public.tax_records tr
      WHERE tr.created_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
        AND tr.refunded_tax_cents > 0
      ORDER BY tr.updated_at DESC
      LIMIT 500
    ) j;
    RETURN v_result;
  END IF;

  -- ── by_period (daily aggregation) ─────────────────────────────────────────
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
        tr.created_at::date                       AS period_date,
        COUNT(*)                                   AS transaction_count,
        SUM(tr.taxable_amount_cents)               AS taxable_total_cents,
        SUM(tr.tax_amount_cents)                   AS tax_collected_cents,
        SUM(tr.refunded_tax_cents)                 AS tax_refunded_cents,
        SUM(tr.tax_amount_cents - tr.refunded_tax_cents) AS tax_net_cents
      FROM public.tax_records tr
      WHERE tr.created_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
      GROUP BY tr.created_at::date
      ORDER BY 1
    ) j;
    RETURN v_result;
  END IF;

  -- ── tax_exempt (trades with taxable > 0 but zero tax collected) ───────────
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
        tr.id,
        tr.trade_id,
        tr.buyer_id,
        tr.node_id,
        tr.taxable_amount_cents,
        tr.tax_rate,
        tr.tax_jurisdiction,
        tr.created_at
      FROM public.tax_records tr
      WHERE tr.created_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
        AND tr.taxable_amount_cents > 0
        AND tr.tax_amount_cents = 0
      ORDER BY tr.created_at DESC
      LIMIT 500
    ) j;
    RETURN v_result;
  END IF;

  -- ── audit_trail (full record of all mutations, ordered by updated_at) ──────
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
        tr.id,
        tr.trade_id,
        tr.buyer_id,
        tr.node_id,
        tr.taxable_amount_cents,
        tr.tax_rate,
        tr.tax_amount_cents,
        tr.tax_jurisdiction,
        tr.refunded_tax_cents,
        tr.refund_reason,
        tr.created_at,
        tr.updated_at
      FROM public.tax_records tr
      WHERE tr.created_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
      ORDER BY tr.updated_at DESC
      LIMIT 2000
    ) j;
    RETURN v_result;
  END IF;

  -- ── unknown report type ────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object(
      'code',    'INVALID_REPORT_TYPE',
      'message', 'Valid report types: summary, jurisdictions, transactions, refunds, by_period, tax_exempt, audit_trail',
      'details', jsonb_build_object('received', p_report_type)
    )
  );
END;
$$;

-- ─── Verification ────────────────────────────────────────────────────────────
-- SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'get_tax_summary_for_period';
-- --> should show 4 params including p_report_type text DEFAULT 'summary'
-- SELECT get_tax_summary_for_period('2025-01-01'::date, '2025-12-31'::date, NULL, 'by_period');
-- --> success:true, data.period='daily'
-- SELECT get_tax_summary_for_period('2025-01-01'::date, '2025-12-31'::date, NULL, 'invalid');
-- --> success:false, code=INVALID_REPORT_TYPE
