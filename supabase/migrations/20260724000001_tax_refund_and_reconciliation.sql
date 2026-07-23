-- File: supabase/migrations/20260724000001_tax_refund_and_reconciliation.sql
-- Module: MODULE-15.1.2 TradeFlowV2 (tax-refund-reconciliation)
-- Mode B: Idempotent rerunnable migration
--
-- Purpose:
-- 1) Add pending_refund and reconciliation_required to tax_status enum
-- 2) Add refund and reconciliation tracking columns to tax_records
-- 3) Create idempotent RPC for Stripe-refund-first-then-tax-reversal flow
-- 4) Replace get_tax_summary_for_period with status-filtered version
-- 5) Replace get_tax_export_data with full-column CSV export
-- 6) Add reconciliation RPC for cron/operations use
-- 7) Backfill: mark unverifiable records as reconciliation_required
--
-- Key concept: Tax becomes "refunded" ONLY after a verified Stripe refund succeeds.
-- "pending_refund" means Stripe refund was initiated but not yet confirmed.
-- "reconciliation_required" means internal and Stripe status disagree.

-- ============================================================================
-- BLOCK 1 — Extend tax_status enum with pending_refund and reconciliation_required
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
-- BLOCK 2 — Add refund/reconciliation columns to tax_records
-- ============================================================================
DO $$
BEGIN
  -- stripe_refund_id: Stripe Refund object ID from successful refund
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'stripe_refund_id'
  ) THEN
    ALTER TABLE public.tax_records ADD COLUMN stripe_refund_id TEXT;
  END IF;

  -- refunded_at: timestamp when Stripe confirmed the refund
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'refunded_at'
  ) THEN
    ALTER TABLE public.tax_records ADD COLUMN refunded_at TIMESTAMPTZ;
  END IF;

  -- refund_status: Stripe refund status (succeeded, pending, failed, canceled)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'refund_status'
  ) THEN
    ALTER TABLE public.tax_records ADD COLUMN refund_status TEXT;
  END IF;

  -- reconciliation_status: tracks internal-vs-Stripe mismatch
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'reconciliation_status'
  ) THEN
    ALTER TABLE public.tax_records ADD COLUMN reconciliation_status TEXT;
  END IF;

  -- reconciliation_reason: explanation of mismatch
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'reconciliation_reason'
  ) THEN
    ALTER TABLE public.tax_records ADD COLUMN reconciliation_reason TEXT;
  END IF;

  -- capture_attempted_at: when capture was last attempted
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'capture_attempted_at'
  ) THEN
    ALTER TABLE public.tax_records ADD COLUMN capture_attempted_at TIMESTAMPTZ;
  END IF;

  -- capture_error: last capture error message
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_records' AND column_name = 'capture_error'
  ) THEN
    ALTER TABLE public.tax_records ADD COLUMN capture_error TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- BLOCK 3 — Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tax_records_stripe_refund_id
  ON public.tax_records (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tax_records_reconciliation
  ON public.tax_records (reconciliation_status)
  WHERE reconciliation_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tax_records_status_captured
  ON public.tax_records (tax_status, captured_at)
  WHERE tax_status IN ('collected', 'refunded', 'partially_refunded');

-- ============================================================================
-- BLOCK 4 — RPC: Issue Stripe refund + reverse tax (idempotent, server-side only)
-- This RPC does NOT call Stripe (it's a DB-level guard). The Edge Function
-- must call Stripe first, then call this RPC with the refund result.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_record_stripe_refund(
  p_trade_id UUID,
  p_stripe_refund_id TEXT,
  p_refund_amount_cents INTEGER,
  p_refund_status TEXT DEFAULT 'succeeded',
  p_refund_reason TEXT DEFAULT NULL,
  p_initiating_actor TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tax_record RECORD;
  v_existing_refund_id TEXT;
  v_current_status TEXT;
  v_refund_result JSONB;
BEGIN
  IF p_trade_id IS NULL OR p_stripe_refund_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id and p_stripe_refund_id are required')
    );
  END IF;

  -- Lock the tax record
  SELECT * INTO v_tax_record FROM public.tax_records
  WHERE trade_id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object('trade_id', p_trade_id, 'action', 'noop', 'reason', 'no_tax_record')
    );
  END IF;

  -- Idempotency: check if this exact refund ID is already recorded
  IF v_tax_record.stripe_refund_id = p_stripe_refund_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'tax_record_id', v_tax_record.id,
        'trade_id', p_trade_id,
        'action', 'idempotent',
        'stripe_refund_id', p_stripe_refund_id,
        'message', 'Refund already recorded'
      )
    );
  END IF;

  v_current_status := v_tax_record.tax_status::TEXT;

  -- Only process refund for collected or partially_refunded records
  IF v_current_status NOT IN ('collected', 'partially_refunded', 'pending_refund') THEN
    -- If the record is voided/quoted, a refund should NOT be applied — money was never collected
    IF p_refund_status = 'succeeded' THEN
      -- Stripe says refund succeeded but we have no collected tax — this needs reconciliation
      UPDATE public.tax_records
      SET stripe_refund_id = p_stripe_refund_id,
          refund_status = p_refund_status,
          refunded_at = CASE WHEN p_refund_status = 'succeeded' THEN now() ELSE NULL END,
          reconciliation_status = 'needs_review',
          reconciliation_reason = format('Stripe refund %s issued but tax status is %s', p_stripe_refund_id, v_current_status),
          updated_at = now()
      WHERE id = v_tax_record.id;

      RETURN jsonb_build_object(
        'success', true,
        'warning', 'RECONCILIATION_NEEDED',
        'data', jsonb_build_object(
          'tax_record_id', v_tax_record.id,
          'trade_id', p_trade_id,
          'action', 'reconciliation',
          'stripe_refund_id', p_stripe_refund_id,
          'tax_status', v_current_status,
          'reconciliation_status', 'needs_review'
        )
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object(
        'code', 'INVALID_STATE',
        'message', format('Cannot record refund for tax in status %s. Only collected or partially_refunded can be refunded.', v_current_status)
      )
    );
  END IF;

  -- Handle pending refund status (Stripe refund initiated but not confirmed)
  IF p_refund_status IN ('pending', 'processing') THEN
    UPDATE public.tax_records
    SET tax_status = 'pending_refund'::public.tax_status,
        stripe_refund_id = COALESCE(stripe_refund_id, p_stripe_refund_id),
        refund_status = p_refund_status,
        refund_reason = COALESCE(p_refund_reason, refund_reason),
        reconciliation_status = NULL,
        reconciliation_reason = NULL,
        updated_at = now()
    WHERE id = v_tax_record.id;

    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'tax_record_id', v_tax_record.id,
        'trade_id', p_trade_id,
        'action', 'pending_refund',
        'stripe_refund_id', p_stripe_refund_id,
        'refund_status', p_refund_status
      )
    );
  END IF;

  -- Handle failed/canceled refund
  IF p_refund_status IN ('failed', 'canceled') THEN
    UPDATE public.tax_records
    SET stripe_refund_id = COALESCE(stripe_refund_id, p_stripe_refund_id),
        refund_status = p_refund_status,
        refund_reason = COALESCE(p_refund_reason, refund_reason),
        reconciliation_status = 'refund_failed',
        reconciliation_reason = format('Stripe refund %s returned status: %s', p_stripe_refund_id, p_refund_status),
        updated_at = now()
    WHERE id = v_tax_record.id;

    RETURN jsonb_build_object(
      'success', true,
      'warning', 'REFUND_FAILED',
      'data', jsonb_build_object(
        'tax_record_id', v_tax_record.id,
        'trade_id', p_trade_id,
        'action', 'refund_failed',
        'stripe_refund_id', p_stripe_refund_id,
        'refund_status', p_refund_status
      )
    );
  END IF;

  -- Handle successful refund — record it via refund_tax RPC and update status
  IF p_refund_status = 'succeeded' THEN
    -- Call the existing proportional refund RPC
    v_refund_result := public.refund_tax(p_trade_id, p_refund_amount_cents,
      COALESCE(p_refund_reason, 'stripe_refund'));

    IF (v_refund_result->>'success') IS DISTINCT FROM 'true' THEN
      -- Refund tax failed — mark for reconciliation
      UPDATE public.tax_records
      SET stripe_refund_id = p_stripe_refund_id,
          refund_status = p_refund_status,
          reconciliation_status = 'refund_record_failed',
          reconciliation_reason = format('Stripe refund %s succeeded but refund_tax RPC failed: %s',
            p_stripe_refund_id, (v_refund_result->>'error')::TEXT),
          updated_at = now()
      WHERE id = v_tax_record.id;

      RETURN jsonb_build_object(
        'success', true,
        'warning', 'REFUND_RECORD_FAILED',
        'data', jsonb_build_object(
          'tax_record_id', v_tax_record.id,
          'trade_id', p_trade_id,
          'action', 'refund_record_failed',
          'stripe_refund_id', p_stripe_refund_id,
          'refund_tax_error', v_refund_result->'error'
        )
      );
    END IF;

    -- Determine new tax_status based on remaining cents
    DECLARE
      v_remaining_cents INTEGER;
      v_total_cents INTEGER;
      v_new_tax_status public.tax_status;
    BEGIN
      v_remaining_cents := ((v_refund_result->'data'->>'remaining_cents')::INTEGER);
      v_total_cents := ((v_refund_result->'data'->>'tax_amount_cents')::INTEGER);

      IF v_remaining_cents <= 0 THEN
        v_new_tax_status := 'refunded'::public.tax_status;
      ELSIF v_remaining_cents < v_total_cents THEN
        v_new_tax_status := 'partially_refunded'::public.tax_status;
      ELSE
        v_new_tax_status := 'collected'::public.tax_status;
      END IF;

      UPDATE public.tax_records
      SET tax_status = v_new_tax_status,
          stripe_refund_id = COALESCE(stripe_refund_id, p_stripe_refund_id),
          refunded_at = now(),
          refund_status = 'succeeded',
          refund_reason = COALESCE(p_refund_reason, refund_reason),
          reconciliation_status = NULL,
          reconciliation_reason = NULL,
          updated_at = now()
      WHERE id = v_tax_record.id;
    END;

    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'tax_record_id', v_tax_record.id,
        'trade_id', p_trade_id,
        'action', 'refund_recorded',
        'stripe_refund_id', p_stripe_refund_id,
        'refund_tax_result', v_refund_result->'data'
      )
    );
  END IF;

  -- Unknown refund_status
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'INVALID_REFUND_STATUS', 'message', format('Unknown refund_status: %s', p_refund_status))
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'RECORD_REFUND_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_record_stripe_refund IS
'Records a Stripe refund result on the tax ledger. Idempotent — safe to call multiple times with the same stripe_refund_id. Only processes refunds for collected/partially_refunded/pending_refund records. Handles succeeded/pending/failed/canceled refund statuses.';

GRANT EXECUTE ON FUNCTION public.rpc_record_stripe_refund(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

-- ============================================================================
-- BLOCK 5 — RPC: Get tax summary with status filtering (replaces old version)
-- Full 9-status breakdown with proper inclusion/exclusion rules
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

  -- Normalize status filter
  v_status_filter := COALESCE(NULLIF(TRIM(p_status_filter), ''), 'all');

  -- ==========================================================================
  -- Helper: date filter uses captured_at for collected records, created_at for
  -- all others. This ensures tax is reported by the date money moved, not the
  -- date the offer was submitted.
  -- ==========================================================================
  -- We define a CTE that computes the "reporting date" for each record.
  -- For collected/refunded/partially_refunded: use captured_at / refunded_at.
  -- For all others (quoted, voided, capture_failed, pending_refund, reconciliation_required): use created_at.
  -- ==========================================================================

  -- ── summary (default) ──────────────────────────────────────────────────────
  IF p_report_type = 'summary' THEN
    WITH
      date_ranged AS (
        SELECT * FROM public.tax_records tr
        WHERE
          -- For collected/refunded, use captured_at/refunded_at as the reportable date
          -- For others, use created_at
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

        -- Taxable Sales: taxable base from captured transactions only
        'taxable_sales_cents',     COALESCE((SELECT SUM(taxable_amount_cents) FROM collected), 0),

        -- Tax Collected: tax from captured transactions only
        'tax_collected_cents',     COALESCE((SELECT SUM(tax_amount_cents) FROM collected), 0),

        -- Tax Refunded: tax from verified Stripe refunds only
        'tax_refunded_cents',      COALESCE((SELECT SUM(refunded_tax_cents) FROM refunded), 0),

        -- Net Tax Payable: collected minus refunded
        'tax_net_cents',           COALESCE((SELECT SUM(tax_amount_cents) FROM collected), 0)
                                   - COALESCE((SELECT SUM(refunded_tax_cents) FROM refunded), 0),

        -- Pending/Authorized Tax: quoted on active trades, never in Net
        'pending_tax_count',       (SELECT COUNT(*) FROM pending_tax),
        'pending_tax_cents',       COALESCE((SELECT SUM(tax_amount_cents) FROM pending_tax), 0),

        -- Voided/Expired Tax: canceled/declined/expired pre-capture, never in Net
        'voided_tax_count',        (SELECT COUNT(*) FROM voided_tax),
        'voided_tax_cents',        COALESCE((SELECT SUM(tax_amount_cents) FROM voided_tax), 0),

        -- Capture Failed Tax: uncaptured, never in Net
        'capture_failed_count',    (SELECT COUNT(*) FROM capture_failed_tax),
        'capture_failed_cents',    COALESCE((SELECT SUM(tax_amount_cents) FROM capture_failed_tax), 0),

        -- Pending Refund Tax: refund initiated but not confirmed
        'pending_refund_count',    (SELECT COUNT(*) FROM pending_refund_tax),
        'pending_refund_cents',    COALESCE((SELECT SUM(tax_amount_cents) FROM pending_refund_tax), 0),

        -- Reconciliation Required: internal-vs-Stripe mismatch
        'reconciliation_count',    (SELECT COUNT(*) FROM reconciliation_tax),
        'reconciliation_cents',    COALESCE((SELECT SUM(tax_amount_cents) FROM reconciliation_tax), 0),

        -- Total transaction count (all statuses)
        'transaction_count',       (SELECT COUNT(*) FROM date_ranged),

        -- By Jurisdiction (collected + refunded only)
        'by_jurisdiction', COALESCE(
          (SELECT jsonb_agg(row_to_json(j))
           FROM (
             SELECT
               COALESCE(tr.tax_jurisdiction, 'UNKNOWN') AS jurisdiction,
               COUNT(*)                                   AS transaction_count,
               SUM(tr.taxable_amount_cents)              AS taxable_total_cents,
               SUM(tr.tax_amount_cents)                  AS tax_collected_cents,
               SUM(tr.refunded_tax_cents)                AS tax_refunded_cents,
               SUM(tr.tax_amount_cents - tr.refunded_tax_cents) AS tax_net_cents
             FROM date_ranged tr
             WHERE tr.tax_status IN ('collected', 'refunded', 'partially_refunded')
             GROUP BY COALESCE(tr.tax_jurisdiction, 'UNKNOWN')
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

  -- ── transactions (per-record list, filtered by status) ─────────────────────
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
        tr.id,
        tr.trade_id,
        tr.buyer_id,
        tr.node_id,
        tr.taxable_amount_cents,
        tr.tax_rate,
        tr.tax_amount_cents,
        tr.tax_jurisdiction,
        tr.refunded_tax_cents,
        tr.tax_status,
        tr.captured_at,
        tr.voided_at,
        tr.refunded_at,
        tr.stripe_refund_id,
        tr.stripe_capture_id,
        tr.reconciliation_status,
        tr.reconciliation_reason,
        tr.tax_snapshot,
        tr.created_at AS offered_at,
        tr.updated_at
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

  -- ── refunds (records with refunded_tax_cents > 0) ─────────────────────────
  IF p_report_type = 'refunds' THEN
    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'start_date',          p_start_date,
        'end_date',            p_end_date,
        'total_refunded_cents', COALESCE(SUM(tr.refunded_tax_cents), 0),
        'refund_count',        COUNT(*),
        'rows', COALESCE(jsonb_agg(row_to_json(j) ORDER BY COALESCE(tr.refunded_at, tr.updated_at) DESC), '[]'::jsonb)
      )
    )
    INTO v_result
    FROM (
      SELECT
        tr.id,
        tr.trade_id,
        tr.refunded_tax_cents,
        tr.tax_amount_cents,
        tr.refund_reason,
        tr.tax_jurisdiction,
        tr.tax_status,
        tr.stripe_refund_id,
        tr.refunded_at,
        tr.refund_status,
        tr.created_at AS offered_at,
        tr.updated_at
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

  -- ── by_period (daily aggregation, captured-date basis for collected, refunded_date for refunds) ──
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
        COUNT(*)                                   AS transaction_count,
        SUM(tr.taxable_amount_cents)               AS taxable_total_cents,
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
      GROUP BY
        CASE tr.tax_status
          WHEN 'collected' THEN tr.captured_at::date
          WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)::date
          WHEN 'partially_refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)::date
          ELSE tr.created_at::date
        END
      ORDER BY 1
    ) j;
    RETURN v_result;
  END IF;

  -- ── tax_exempt (trades with taxable > 0 but zero tax, captured only) ───────
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
        tr.created_at AS offered_at,
        tr.captured_at,
        tr.tax_snapshot
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
        tr.tax_status,
        tr.captured_at,
        tr.voided_at,
        tr.refunded_at,
        tr.stripe_refund_id,
        tr.stripe_capture_id,
        tr.reconciliation_status,
        tr.reconciliation_reason,
        tr.tax_snapshot,
        tr.created_at,
        tr.updated_at
      FROM public.tax_records tr
      WHERE tr.updated_at::date BETWEEN p_start_date AND p_end_date
        AND (p_node_id IS NULL OR tr.node_id = p_node_id)
      ORDER BY tr.updated_at DESC
      LIMIT 2000
    ) j;
    RETURN v_result;
  END IF;

  -- ── reconciliation_required (records with mismatch status) ─────────────────
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
        tr.id,
        tr.trade_id,
        tr.buyer_id,
        tr.node_id,
        tr.taxable_amount_cents,
        tr.tax_rate,
        tr.tax_amount_cents,
        tr.tax_jurisdiction,
        tr.refunded_tax_cents,
        tr.tax_status,
        tr.reconciliation_status,
        tr.reconciliation_reason,
        tr.stripe_refund_id,
        tr.stripe_capture_id,
        tr.captured_at,
        tr.refunded_at,
        tr.tax_snapshot,
        tr.created_at,
        tr.updated_at
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

  -- ── unknown report type ────────────────────────────────────────────────────
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
'REPLACED (2026-07-24): Now filters by tax_status for accurate reporting. Tax Collected = captured only. Tax Refunded = verified Stripe refunds only. Pending/Voided tax shown operationally but excluded from Net Tax Payable. Supports status_filter param for transaction and refund views.';

GRANT EXECUTE ON FUNCTION public.get_tax_summary_for_period(DATE, DATE, UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- ============================================================================
-- BLOCK 6 — Replace get_tax_export_data with full-column export
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_tax_export_data(TIMESTAMPTZ, TIMESTAMPTZ);

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
  -- Admin-only guard
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
    COALESCE((SELECT string_agg(DISTINCT i.id::TEXT, ', ') FROM public.trades t2
              LEFT JOIN public.items i ON i.id = t2.listing_id
              WHERE t2.id = tr.trade_id), '') AS listing_ids,
    COALESCE(tr.tax_snapshot->>'categories', '') AS tax_categories,
    COALESCE(tr.tax_jurisdiction, '') AS jurisdiction,
    COALESCE(tr.tax_snapshot->>'rule_version', '') AS tax_rule_version,
    COALESCE(tr.tax_snapshot#>>'{items,0,item_price_cents}', '0')::INTEGER AS item_subtotal_cents,
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
-- BLOCK 7 — Reconciliation: RPC to verify a tax record against Stripe
-- This is called by a reconciliation cron job or manually by Operations.
-- It does NOT call Stripe itself — it marks records for manual review when
-- the internal state doesn't match expectations.
-- ============================================================================
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

COMMENT ON FUNCTION public.rpc_flag_tax_reconciliation IS
'Flags a tax record as reconciliation_required. Used by Operations when a Stripe/internal mismatch is detected.';

GRANT EXECUTE ON FUNCTION public.rpc_flag_tax_reconciliation(UUID, TEXT)
  TO authenticated, service_role;

-- ============================================================================
-- BLOCK 8 — Backfill: flag records that were marked 'collected' but have no
-- captured_at or never had a Stripe capture (legacy data before the lifecycle migration)
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Find tax records that are 'collected' but have no captured_at
  -- These are records from before the lifecycle migration that were classified
  -- as collected based on trade.status = 'completed' but may not have a real capture.
  -- We flag them as reconciliation_required so Operations can verify.
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
-- BLOCK 9 — Verification queries (safe to re-run)
-- ============================================================================
-- SELECT unnest(enum_range(NULL::public.tax_status)) AS status_values;
-- Expected: quoted, collected, voided, capture_failed, refunded, partially_refunded, pending_refund, reconciliation_required

-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'tax_records'
-- ORDER BY ordinal_position;

-- SELECT tax_status, COUNT(*) FROM public.tax_records GROUP BY tax_status;
