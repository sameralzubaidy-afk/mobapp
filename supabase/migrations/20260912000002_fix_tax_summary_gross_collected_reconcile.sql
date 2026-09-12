-- ============================================================================
-- FIX-Task-20 item 2 (2026-09-12) — tax summary header contradicted its own breakdown
--
-- MODE B: idempotent rerunnable migration (CREATE OR REPLACE, same signature).
--         Body copied VERBATIM from 20260831220000_dev_task_71_tax_voided_report_fix.sql
--         (lines 47-422) with ONE change: the summary `collected` CTE.
--
-- Symptom (QA F4 / O2)
--   For the same window the header and by_jurisdiction disagreed:
--     header            : tax_collected_cents = 0    · refunded = 175 · net = -175
--     by_jurisdiction CT: tax_collected_cents = 175  · refunded = 175 · net = 0
--   One fully-refunded record (tax_amount_cents = 175, refunded_tax_cents = 175,
--   tax_status = 'refunded') was in the window. Live re-measured 2026-09-12 over
--   2026-07-01..2026-09-12:
--     header            : collected 16968 · refunded 175 · net 16793
--     by_jurisdiction CT: collected 17143 · refunded 175 · net 16968
--   (difference = 175 = the refunded row.)
--
-- Root cause
--   The two aggregations defined "collected" differently:
--     * header `collected` CTE  = tax_status = 'collected'                       (excludes refunded rows)
--     * by_jurisdiction         = tax_status IN ('collected','refunded','partially_refunded')
--   so by_jurisdiction reported the refunded row's GROSS tax as collected while the
--   header reported it as never collected — a permanent, unexplainable gap between
--   the headline and its own drill-down.
--
-- Fix (owner decision 2026-09-12: GROSS convention)
--   Both aggregations now use the SAME status set. A record that was captured and
--   later refunded is counted at GROSS in "Tax Collected" with the refund surfaced
--   separately in "Tax Refunded"; net = gross − refunds. For the live window above
--   the header becomes 17143 / 175 / 16968 — identical to by_jurisdiction.
--
--   NOTE — this changes the SEMANTICS of the on-screen "Tax Collected" figure (it now
--   includes the gross tax of transactions later refunded). The reports-page copy is
--   updated in the same change, and the QA guide's P05/O3-C14 expectations are
--   reconciled in FIX-Task-20 item 12.
--
-- Verification: BLOCK 2 asserts header == SUM(by_jurisdiction) for all three figures.
--
-- ⚠️ APPLIED TO STAGING 2026-09-12 as an asserted in-place body substitution (pg_get_functiondef
--    + a single-match assertion + replace + EXECUTE), because this body is ~15 KB / 376 lines.
--    The live effect is identical to applying this file. See supabase/migrations/README.md
--    "Exception 2".
-- ⚠️ ANY replacement of this function MUST re-issue the GRANT EXECUTE line below: the repo's
--    dt61_guard_revoke_fn_public EVENT TRIGGER revokes PUBLIC/anon/authenticated on every
--    CREATE OR REPLACE FUNCTION, and without the GRANT the admin portal fails with
--    "permission denied for function get_tax_summary_for_period".
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
      -- FIX-Task-20 item 2 (2026-09-12): GROSS convention. This MUST stay identical to
      -- the status set used by `by_jurisdiction` below (L~147 of the body), otherwise a
      -- refunded record is invisible to the header while still counted by the
      -- drill-down — the 0/-175 vs 175/0 gap this migration fixes.
      collected AS (
        SELECT * FROM date_ranged
        WHERE tax_status IN ('collected', 'refunded', 'partially_refunded')
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
'REPLACED (2026-09-12 FIX-Task-20 item 2): header now uses the GROSS-collected convention — collected = tax_status IN (collected, refunded, partially_refunded), matching the by_jurisdiction breakdown, with net = gross collected - refunds. Previously based on 2026-08-31 DT71 (Refunds-tab guard + per-jurisdiction tax_voided_cents). Voided tracked separately. Tax Refunded = verified Stripe refunds only.';

GRANT EXECUTE ON FUNCTION public.get_tax_summary_for_period(DATE, DATE, UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- ============================================================================
-- BLOCK 2 — Verification (header must equal SUM(by_jurisdiction) on all three figures)
-- ============================================================================
-- SELECT
--   d->'data'->>'tax_collected_cents'                                      AS header_collected,
--   d->'data'->>'tax_refunded_cents'                                       AS header_refunded,
--   d->'data'->>'tax_net_cents'                                            AS header_net,
--   (SELECT SUM((j->>'tax_collected_cents')::int)
--      FROM jsonb_array_elements(d->'data'->'by_jurisdiction') j)           AS juris_collected,
--   (SELECT SUM((j->>'tax_refunded_cents')::int)
--      FROM jsonb_array_elements(d->'data'->'by_jurisdiction') j)           AS juris_refunded,
--   (SELECT SUM((j->>'tax_net_cents')::int)
--      FROM jsonb_array_elements(d->'data'->'by_jurisdiction') j)           AS juris_net
-- FROM (SELECT public.get_tax_summary_for_period('2026-07-01'::date, '2026-09-12'::date, NULL, 'summary', NULL) AS d) s;
--
-- 2026-09-12 measured BEFORE this migration: header 16968 / 175 / 16793  vs
-- by_jurisdiction 17143 / 175 / 16968. EXPECT AFTER: both 17143 / 175 / 16968.
--
-- ROLLBACK: re-apply 20260831220000 (restores `WHERE tax_status = 'collected'` in the
-- summary CTE).
-- ============================================================================
