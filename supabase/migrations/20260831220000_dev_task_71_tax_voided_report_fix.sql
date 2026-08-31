-- ============================================================================
-- DEV-TASK-71 (2026-08-31) — Tax reports: voided ≠ refunded (defense-in-depth)
--
-- MODE B: idempotent rerunnable migration (DROP + CREATE OR REPLACE).
--
-- BACKGROUND (QA Task 12 finding #5, re-verified live 2026-08-31):
--   The live Summary/By-Jurisdiction RPCs (20260801000004) ALREADY exclude
--   tax_status='voided' from "Tax Refunded". The $1.40 "Tax Refunded" in the
--   QA report was a LEGITIMATE refunded tax record (trade a01624a4 — real
--   Stripe refund re_3UABZ44I6kCJlvXo0EhPQLID), NOT the voided R06 trade
--   (e48557f6 — refunded_tax_cents=0). Live check confirmed NO voided row
--   carries a refund amount, so NO data cleanup is required.
--
--   This migration is therefore defense-in-depth + visibility hardening so
--   voided can never be counted as refunded anywhere, and the two events are
--   visually distinct in the admin report:
--
-- CHANGES:
--   1. get_tax_summary_for_period
--      a) 'refunds' report branch: add tax_status IN ('refunded','partially_refunded')
--         (previously only refunded_tax_cents > 0 — a voided row carrying a
--         stale refund amount would leak into the Refunds tab).
--      b) summary by_jurisdiction: add per-jurisdiction tax_voided_cents so the
--         admin By-Jurisdiction table can show a "Voided" column. All existing
--         columns unchanged (additive).
--   2. get_tax_export_data (RETURNS TABLE changed → DROP + CREATE OR REPLACE):
--      a) Status-guard refunded_amount_cents / tax_refunded_cents / net_tax_cents
--         so only refunded/partially_refunded rows report a refund.
--      b) Add tax_voided_cents output column.
--   3. rpc_void_tax_for_trade: zero refunded_tax_cents / refund_reason /
--      stripe_refund_id / refunded_at / refund_status when transitioning to
--      voided (a voided record must never carry stale refund fields).
--   4. refund_tax: refuse to record a refund on tax_status
--      voided / quoted / capture_failed (money was never collected).
--
-- NO destructive change. All functions rerunnable (Mode B).
-- ============================================================================

-- ============================================================================
-- BLOCK 1 — Schema (functions + grants)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. get_tax_summary_for_period — add Refunds-tab status filter + per-jurisdiction
--    tax_voided_cents. Body otherwise identical to 20260801000004.
-- ────────────────────────────────────────────────────────────────────────────
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
               SUM(trr.tax_amount_cents - trr.refunded_tax_cents) AS tax_net_cents,
               (SELECT COALESCE(SUM(v.tax_amount_cents), 0)
                FROM date_ranged v
                WHERE v.tax_status = 'voided'
                  AND v.tax_jurisdiction IS NOT DISTINCT FROM trr.tax_jurisdiction) AS tax_voided_cents
             FROM date_ranged trr
             WHERE trr.tax_status IN ('collected', 'refunded', 'partially_refunded')
             GROUP BY trr.tax_jurisdiction
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
  -- DT71: added tax_status IN ('refunded','partially_refunded') so a voided
  -- row carrying a stale refund amount can never appear in the Refunds tab.
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
        AND tr.tax_status IN ('refunded', 'partially_refunded')
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
'REPLACED (2026-08-31 DT71): identical to 2026-08-01 status-filtered version + Refunds-tab tax_status guard + per-jurisdiction tax_voided_cents. Tax Collected = captured only. Tax Refunded = verified Stripe refunds only. Voided tracked separately.';

GRANT EXECUTE ON FUNCTION public.get_tax_summary_for_period(DATE, DATE, UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. get_tax_export_data — status-guard refunded columns + add tax_voided_cents.
--    RETURNS TABLE changed → DROP first (BP-12). Body otherwise identical to
--    20260801000005 (admin guard = role_based_access_control).
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_tax_export_data(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

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
  tax_rate                NUMERIC(7,4),
  tax_voided_cents        INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Admin-only guard (canonical admin-role source = role_based_access_control,
  -- matching the admin portal login + all other admin RPCs).
  IF NOT EXISTS (
    SELECT 1 FROM public.role_based_access_control rbac
    WHERE rbac.user_id = auth.uid() AND rbac.role = 'admin'
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
    -- DT71: only refunded/partially_refunded rows report a refund amount; a
    -- voided row (or any non-refund status) must export refund = 0.
    CASE WHEN tr.tax_status IN ('refunded', 'partially_refunded')
      THEN COALESCE(tr.refunded_tax_cents, 0)
      ELSE 0
    END AS refunded_amount_cents,
    tr.tax_amount_cents,
    CASE WHEN tr.tax_status IN ('refunded', 'partially_refunded')
      THEN COALESCE(tr.refunded_tax_cents, 0)
      ELSE 0
    END AS tax_refunded_cents,
    tr.tax_amount_cents - CASE WHEN tr.tax_status IN ('refunded', 'partially_refunded')
      THEN COALESCE(tr.refunded_tax_cents, 0)
      ELSE 0
    END AS net_tax_cents,
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
    tr.tax_rate,
    -- DT71: voided rows export their (voided) tax amount under a dedicated column.
    CASE WHEN tr.tax_status = 'voided'
      THEN COALESCE(tr.tax_amount_cents, 0)
      ELSE 0
    END AS tax_voided_cents
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

-- ────────────────────────────────────────────────────────────────────────────
-- 3. rpc_void_tax_for_trade — zero refund fields on transition to voided.
--    Body otherwise identical to 20260723000002 (quoted/capture_failed only).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_void_tax_for_trade(
  p_trade_id UUID,
  p_reason TEXT DEFAULT 'trade_cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_current_status TEXT;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id is required')
    );
  END IF;

  -- Lock and load the tax record
  SELECT * INTO v_record FROM public.tax_records
  WHERE trade_id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No tax record exists — nothing to void (zero-tax offer)
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object('trade_id', p_trade_id, 'action', 'noop', 'reason', 'no_tax_record')
    );
  END IF;

  v_current_status := v_record.tax_status::TEXT;

  -- Only void quoted or capture_failed records
  IF v_current_status NOT IN ('quoted', 'capture_failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object(
        'code', 'INVALID_STATE',
        'message', format('Cannot void tax in status %s. Only quoted or capture_failed can be voided.', v_current_status),
        'details', jsonb_build_object('current_status', v_current_status, 'trade_id', p_trade_id)
      )
    );
  END IF;

  -- DT71: zero any stale refund fields so a voided record can never carry a
  -- refund amount that would leak into refund reports.
  UPDATE public.tax_records
  SET tax_status = 'voided'::public.tax_status,
      voided_at = COALESCE(voided_at, now()),
      refunded_tax_cents = 0,
      refund_reason = NULL,
      stripe_refund_id = NULL,
      refunded_at = NULL,
      refund_status = NULL,
      updated_at = now()
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'tax_record_id', v_record.id,
      'trade_id', p_trade_id,
      'previous_status', v_current_status,
      'new_status', 'voided',
      'reason', p_reason
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'VOID_TAX_ERROR', 'message', SQLERRM)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_void_tax_for_trade IS
'Transitions a tax record from quoted/capture_failed to voided, zeroing any stale refund fields. Safe on trades with no tax record (returns noop). Idempotent on already-voided records.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. refund_tax — add tax_status guard (voided/quoted/capture_failed refused).
--    Body otherwise identical to 20260830000012 (DT59 party check preserved).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refund_tax(
  p_trade_id UUID, p_refund_amount_cents INTEGER, p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_already INTEGER;
  v_max_left INTEGER;
  v_buyer_id UUID;
  v_seller_id UUID;
BEGIN
  IF p_trade_id IS NULL OR p_refund_amount_cents IS NULL OR p_refund_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_INPUT','message','trade_id + positive refund_amount_cents required'));
  END IF;

  -- DT59: a user JWT may only refund tax on a trade they are a party to.
  -- Service-role calls (auth.uid() NULL — refund EFs / rpc_record_stripe_refund)
  -- are unaffected.
  SELECT t.buyer_id, t.seller_id INTO v_buyer_id, v_seller_id
    FROM public.trades t WHERE t.id = p_trade_id;
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_buyer_id AND auth.uid() <> v_seller_id THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHORIZED','message','Only the buyer or seller can refund tax on this trade'));
  END IF;

  SELECT * INTO v_record FROM public.tax_records WHERE trade_id = p_trade_id FOR UPDATE LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','NO_TAX_RECORD','message','No tax was collected for this trade'));
  END IF;

  -- DT71: never record a refund on money-that-was-never-collected statuses.
  IF v_record.tax_status::TEXT IN ('voided', 'quoted', 'capture_failed') THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_STATE',
        'message','Cannot refund tax on a voided/quoted/capture_failed record',
        'details', jsonb_build_object('current_status', v_record.tax_status::TEXT)));
  END IF;

  v_already := COALESCE(v_record.refunded_tax_cents, 0);
  v_max_left := v_record.tax_amount_cents - v_already;
  IF p_refund_amount_cents > v_max_left THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','REFUND_EXCEEDS_COLLECTED',
        'message','Refund exceeds collected tax remaining',
        'details', jsonb_build_object('remaining_cents', v_max_left)));
  END IF;
  UPDATE public.tax_records
     SET refunded_tax_cents = v_already + p_refund_amount_cents,
         refund_reason      = COALESCE(p_reason, refund_reason),
         updated_at         = NOW()
   WHERE id = v_record.id;
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'tax_record_id', v_record.id,
    'refunded_total', v_already + p_refund_amount_cents,
    'tax_amount_cents', v_record.tax_amount_cents,
    'remaining_cents', v_record.tax_amount_cents - (v_already + p_refund_amount_cents)));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false,
    'error', jsonb_build_object('code','REFUND_TAX_ERROR','message', SQLERRM));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_tax(UUID, INTEGER, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_tax(UUID, INTEGER, TEXT) TO authenticated, service_role;

-- ============================================================================
-- BLOCK 2 — Verification (run AFTER applying BLOCK 1)
-- ============================================================================
-- 1) All 4 functions exist:
--    SELECT proname FROM pg_proc WHERE proname IN
--      ('get_tax_summary_for_period','get_tax_export_data',
--       'rpc_void_tax_for_trade','refund_tax') ORDER BY 1;
--    -- Expected: 4 rows.

-- 2) get_tax_summary_for_period has the new guards:
--    SELECT prosrc LIKE '%AND tr.tax_status IN (''refunded'', ''partially_refunded'')%' AS refunds_guard,
--           prosrc LIKE '%tax_voided_cents%' AS has_voided_col
--    FROM pg_proc WHERE proname = 'get_tax_summary_for_period';
--    -- Expected: both true.

-- 3) get_tax_export_data has the new column + guards:
--    SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname='get_tax_export_data';
--    -- Expected: 'TIMESTAMPTZ, TIMESTAMPTZ, TEXT'
--    SELECT prosrc LIKE '%tax_voided_cents INTEGER%' AS has_col
--    FROM pg_proc WHERE proname='get_tax_export_data';
--    -- Expected: true.

-- 4) All 8 report types succeed:
--    SELECT
--      (get_tax_summary_for_period(CURRENT_DATE - 30, CURRENT_DATE, NULL, t, 'all')::jsonb ->> 'success') AS ok,
--      t
--    FROM (VALUES ('summary'),('jurisdictions'),('transactions'),('refunds'),
--                 ('by_period'),('tax_exempt'),('audit_trail'),
--                 ('reconciliation_required')) v(t);
--    -- Expected: ok = 'true' for all 8 rows.

-- 5) Summary numbers unchanged vs pre-migration (refund still $1.40, voided shown separately):
--    SELECT get_tax_summary_for_period('2026-08-30','2026-08-31',NULL,'summary','all')
--      #>> '{data,tax_collected_cents}'  AS collected,
--      get_tax_summary_for_period('2026-08-30','2026-08-31',NULL,'summary','all')
--      #>> '{data,tax_refunded_cents}'   AS refunded,
--      get_tax_summary_for_period('2026-08-30','2026-08-31',NULL,'summary','all')
--      #>> '{data,voided_tax_cents}'     AS voided;
--    -- Expected: refunded = 140 (legit refund a01624a4), voided = 140 (R06 e48557f6).

-- 6) refund_tax refuses a voided record (expect INVALID_STATE):
--    SELECT public.refund_tax('e48557f6-d14f-4de0-8e87-43e0985bea5f', 100)
--      ->> 'error' FROM (SELECT 1) x;
--    -- Expected: JSON containing "code":"INVALID_STATE".

-- 7) rpc_void_tax_for_trade is idempotent on already-voided R06 record (noop/voided),
--    and refund fields remain 0:
--    SELECT public.rpc_void_tax_for_trade('e48557f6-d14f-4de0-8e87-43e0985bea5f')
--      ->> 'data' FROM (SELECT 1) x;
--    SELECT refunded_tax_cents, refund_reason, stripe_refund_id, refunded_at, refund_status
--    FROM public.tax_records WHERE trade_id='e48557f6-d14f-4de0-8e87-43e0985bea5f';
--    -- Expected: all NULL/0.
-- ============================================================================
