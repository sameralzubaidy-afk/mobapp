-- File: supabase/migrations/20260724000002_fix_tax_refund_reconciliation.sql
-- Mode B: Idempotent rerunnable migration
--
-- Complete fix: re-runs all blocks from 20260724000001 that may have been
-- rolled back, plus DROP old function overloads before recreating.
--
-- This is self-contained: run this file directly, no dependency on 00001.
-- Safe to re-run multiple times.

-- ============================================================================
-- BLOCK 0a — Extend tax_status enum (idempotent)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'tax_status' AND e.enumlabel = 'pending_refund'
  ) THEN
    ALTER TYPE public.tax_status ADD VALUE 'pending_refund';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'tax_status' AND e.enumlabel = 'reconciliation_required'
  ) THEN
    ALTER TYPE public.tax_status ADD VALUE 'reconciliation_required';
  END IF;
END;
$$;

-- ============================================================================
-- BLOCK 0b — Add refund/reconciliation columns to tax_records (idempotent)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'stripe_refund_id') THEN
    ALTER TABLE public.tax_records ADD COLUMN stripe_refund_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'refunded_at') THEN
    ALTER TABLE public.tax_records ADD COLUMN refunded_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'refund_status') THEN
    ALTER TABLE public.tax_records ADD COLUMN refund_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'reconciliation_status') THEN
    ALTER TABLE public.tax_records ADD COLUMN reconciliation_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'reconciliation_reason') THEN
    ALTER TABLE public.tax_records ADD COLUMN reconciliation_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'capture_attempted_at') THEN
    ALTER TABLE public.tax_records ADD COLUMN capture_attempted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'capture_error') THEN
    ALTER TABLE public.tax_records ADD COLUMN capture_error TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- BLOCK 0c — Indexes (idempotent)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tax_records_stripe_refund_id
  ON public.tax_records (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tax_records_reconciliation
  ON public.tax_records (reconciliation_status) WHERE reconciliation_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tax_records_status_captured
  ON public.tax_records (tax_status, captured_at) WHERE tax_status IN ('collected', 'refunded', 'partially_refunded');

-- ============================================================================
-- BLOCK 1 — Drop old overloads of get_tax_summary_for_period
-- The old 4-param version (DATE, DATE, UUID, TEXT) conflicts with the new
-- 5-param version (DATE, DATE, UUID, TEXT, TEXT) because both have defaults
-- for the last params.
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_tax_summary_for_period(DATE, DATE, UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_tax_summary_for_period(DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.get_tax_summary_for_period(DATE, DATE);

-- Drop the new version too so we can recreate it cleanly
DROP FUNCTION IF EXISTS public.get_tax_summary_for_period(DATE, DATE, UUID, TEXT, TEXT);

-- ============================================================================
-- BLOCK 2 — Drop old overload of get_tax_export_data (3-param version)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_tax_export_data(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_tax_export_data(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

-- ============================================================================
-- BLOCK 3 — Re-create get_tax_summary_for_period (5-param, status-filtered)
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
  IF p_report_type = 'refunds' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date',           p_start_date,
        'end_date',             p_end_date,
        'total_refunded_cents', COALESCE(SUM(tr.refunded_tax_cents), 0),
        'refund_count',         COUNT(*),
        'rows', COALESCE(jsonb_agg(row_to_json(j) ORDER BY COALESCE(tr.refunded_at, tr.updated_at) DESC), '[]'::jsonb)
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
        tr.created_at AS offered_at, tr.updated_at
      FROM public.tax_records tr
      WHERE
        COALESCE(tr.refunded_at, tr.updated_at, tr.created_at)::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
        AND tr.refunded_tax_cents > 0
      ORDER BY COALESCE(tr.refunded_at, tr.updated_at) DESC
      LIMIT 500
    ) j;
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
'REPLACED (2026-07-24): Filters by tax_status for accurate reporting. Tax Collected = captured only. Tax Refunded = verified Stripe refunds only. Supports status_filter param.';

GRANT EXECUTE ON FUNCTION public.get_tax_summary_for_period(DATE, DATE, UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- ============================================================================
-- BLOCK 4 — Re-create get_tax_export_data (3-param, 31-column)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_tax_export_data(
  p_start_date TIMESTAMPTZ,
  p_end_date   TIMESTAMPTZ,
  p_status_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  trade_id                TEXT,
  buyer_id                TEXT,
  seller_id               TEXT,
  listing_ids             TEXT,
  tax_categories          TEXT,
  jurisdiction            TEXT,
  tax_rule_version        TEXT,
  item_subtotal_cents     INTEGER,
  taxable_item_subtotal   INTEGER,
  platform_fee_cents      INTEGER,
  fee_in_tax_base         TEXT,
  sp_tender_cents         INTEGER,
  card_authorization_cents INTEGER,
  captured_amount_cents   INTEGER,
  refunded_amount_cents   INTEGER,
  tax_amount_cents        INTEGER,
  tax_refunded_cents      INTEGER,
  net_tax_cents           INTEGER,
  tax_status              TEXT,
  trade_status            TEXT,
  stripe_payment_intent   TEXT,
  stripe_capture_id       TEXT,
  stripe_refund_ids       TEXT,
  offer_created_at        TEXT,
  capture_timestamp       TEXT,
  refund_timestamp        TEXT,
  reconciliation_status   TEXT,
  reconciliation_reason   TEXT,
  buyer_email             TEXT,
  node_name               TEXT,
  tax_rate                NUMERIC(7,4)
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Admin role required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: p_start_date and p_end_date are required';
  END IF;

  RETURN QUERY
  SELECT
    tr.trade_id::TEXT,
    tr.buyer_id::TEXT,
    COALESCE(t.seller_id::TEXT, '') AS seller_id,
    '' AS listing_ids,
    COALESCE(tr.tax_snapshot->>'categories', '') AS tax_categories,
    COALESCE(tr.tax_jurisdiction, '') AS jurisdiction,
    COALESCE(tr.tax_snapshot->>'rule_version', '') AS tax_rule_version,
    COALESCE((tr.tax_snapshot#>>'{items,0,item_price_cents}'), '0')::INTEGER AS item_subtotal_cents,
    tr.taxable_amount_cents AS taxable_item_subtotal,
    COALESCE(t.buyer_transaction_fee_cents, 0) AS platform_fee_cents,
    COALESCE(tr.tax_snapshot->>'include_fee_in_tax_base', 'false') AS fee_in_tax_base,
    COALESCE(t.sp_amount, 0) * 100 AS sp_tender_cents,
    COALESCE(t.cash_amount_cents + t.buyer_transaction_fee_cents + tr.tax_amount_cents, 0) AS card_authorization_cents,
    CASE WHEN tr.tax_status = 'collected'
      THEN COALESCE(t.cash_amount_cents + t.buyer_transaction_fee_cents + tr.tax_amount_cents, 0)
      ELSE 0
    END AS captured_amount_cents,
    COALESCE(tr.refunded_tax_cents, 0) AS refunded_amount_cents,
    tr.tax_amount_cents,
    COALESCE(tr.refunded_tax_cents, 0) AS tax_refunded_cents,
    tr.tax_amount_cents - COALESCE(tr.refunded_tax_cents, 0) AS net_tax_cents,
    tr.tax_status::TEXT,
    COALESCE(t.status::TEXT, '') AS trade_status,
    COALESCE(t.stripe_payment_intent_id, '') AS stripe_payment_intent,
    COALESCE(tr.stripe_capture_id, '') AS stripe_capture_id,
    COALESCE(tr.stripe_refund_id, '') AS stripe_refund_ids,
    to_char(tr.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS offer_created_at,
    to_char(tr.captured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS capture_timestamp,
    to_char(tr.refunded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS refund_timestamp,
    COALESCE(tr.reconciliation_status, '') AS reconciliation_status,
    COALESCE(tr.reconciliation_reason, '') AS reconciliation_reason,
    COALESCE(u.email::TEXT, '') AS buyer_email,
    COALESCE(n.name::TEXT, '') AS node_name,
    tr.tax_rate
  FROM public.tax_records tr
  LEFT JOIN public.trades t ON t.id = tr.trade_id
  LEFT JOIN auth.users u ON u.id = tr.buyer_id
  LEFT JOIN public.nodes n ON n.id = tr.node_id
  WHERE
    CASE tr.tax_status
      WHEN 'collected' THEN tr.captured_at BETWEEN p_start_date AND p_end_date
      WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at) BETWEEN p_start_date AND p_end_date
      WHEN 'partially_refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at) BETWEEN p_start_date AND p_end_date
      ELSE tr.created_at BETWEEN p_start_date AND p_end_date
    END
    AND (p_status_filter IS NULL OR tr.tax_status::TEXT = p_status_filter)
  ORDER BY
    CASE tr.tax_status
      WHEN 'collected' THEN tr.captured_at
      WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)
      ELSE tr.created_at
    END DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tax_export_data(TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
  TO authenticated, service_role;

-- ============================================================================
-- BLOCK 5 — Re-create rpc_flag_tax_reconciliation (safe to re-run)
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_flag_tax_reconciliation(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_flag_tax_reconciliation(
  p_trade_id UUID,
  p_reason TEXT DEFAULT 'Status mismatch between internal ledger and Stripe'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id is required')
    );
  END IF;

  SELECT * INTO v_record FROM public.tax_records
  WHERE trade_id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'No tax record found for this trade')
    );
  END IF;

  UPDATE public.tax_records
  SET tax_status = 'reconciliation_required'::public.tax_status,
      reconciliation_status = 'flagged',
      reconciliation_reason = p_reason,
      updated_at = now()
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'tax_record_id', v_record.id,
      'trade_id', p_trade_id,
      'previous_status', v_record.tax_status,
      'new_status', 'reconciliation_required',
      'reason', p_reason
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'FLAG_RECONCILIATION_ERROR', 'message', SQLERRM)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_flag_tax_reconciliation(UUID, TEXT)
  TO authenticated, service_role;

-- ============================================================================
-- BLOCK 6 — Backfill: flag records marked 'collected' without captured_at
-- (Re-insert comment so the backfill re-runs for the user's specific environment)
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.tax_records tr
  SET tax_status = 'reconciliation_required'::public.tax_status,
      reconciliation_status = 'legacy_unverified',
      reconciliation_reason = 'Backfill: Marked collected by status-only heuristic, no captured_at timestamp. Manual Stripe verification required.',
      updated_at = now()
  FROM public.trades t
  WHERE tr.trade_id = t.id
    AND tr.tax_status = 'collected'
    AND tr.captured_at IS NULL
    AND (tr.stripe_capture_id IS NULL OR tr.stripe_capture_id = '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE LOG '[tax-backfill] Flagged % collected-but-unverified legacy records as reconciliation_required', v_count;
END;
$$;

-- ============================================================================
-- BLOCK 7 — Verification
-- ============================================================================
-- Run these AFTER the fix:
--
-- 1. Verify enum values:
--    SELECT unnest(enum_range(NULL::public.tax_status)) AS status_values;
--    Expected: quoted, collected, voided, capture_failed, refunded, partially_refunded, pending_refund, reconciliation_required
--
-- 2. Verify columns exist:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'tax_records' AND column_name IN (
--      'stripe_refund_id', 'refunded_at', 'refund_status',
--      'reconciliation_status', 'reconciliation_reason',
--      'capture_attempted_at', 'capture_error'
--    );
--
-- 3. Check backfill results:
--    SELECT reconciliation_status, reconciliation_reason, COUNT(*)
--    FROM public.tax_records
--    WHERE reconciliation_status IS NOT NULL
--    GROUP BY reconciliation_status, reconciliation_reason;
--
-- 4. Verify function exists:
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname IN ('get_tax_summary_for_period', 'get_tax_export_data', 'rpc_record_stripe_refund', 'rpc_flag_tax_reconciliation');
