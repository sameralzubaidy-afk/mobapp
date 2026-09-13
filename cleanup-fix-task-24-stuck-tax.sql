-- File: cleanup-fix-task-24-stuck-tax.sql
--
-- FIX-Task-24 items 2 + 4 (2026-09-12) — ONE-OFF cleanup of tax records left in a
-- live (`quoted`) state on CANCELLED trades.
--
-- WHY THIS DATA IS INCONSISTENT BY DEFINITION:
--   A cancelled trade can never have collectible tax, so `tax_status='quoted'` on a
--   cancelled trade is always wrong — there is no path that repairs it, because the
--   expiry cron only re-processes trades still in `pending`. Two sources produced it:
--     (a) the offer-expiry RPC driven directly (3 rows, reason 'Offer expired') —
--         fixed going forward by 20260912000010_fix_task_24_expiry_rpc_voids_tax.sql;
--     (b) QA/seed harness scripts that cancel offers with a raw UPDATE
--         (25 rows, reason 'buyer_cancelled') — fixed going forward by the harness
--         scripts voiding tax themselves (item 4).
--   Left alone, these rows inflate `pending_tax_cents` in the period/tax reports.
--
-- MECHANISM: voids through `public.rpc_void_tax_for_trade(...)` — the sanctioned
--   lifecycle RPC (which also zeroes stale refund fields per DT71) — never a raw
--   UPDATE of tax_records.
--
-- SCOPE: EVERY cancelled trade whose tax record is still voidable. This is
--   deliberately broader than the 3+25 reported rows: the rule "cancelled =>
--   tax must be voided" holds for any cancellation writer, so any row found here is
--   inconsistent regardless of who cancelled it. Verified harmless on already-voided
--   rows: they are excluded by the WHERE clause.
--
-- Mode B — idempotent rerunnable (a second run finds 0 rows).
--
-- RUN IN THREE SEPARATE CALLS (execute_sql returns only the LAST statement's result
-- set, so never combine these):
--   STEP 1  = pre-scan (READ-ONLY)      -> shows exactly what will change
--   STEP 2  = the DO block (MUTATION)   -> voids + reports counts
--   STEP 3  = post-check (READ-ONLY)    -> expected 0
--   Optional STEP 4 = period-report sanity check.

-- ============================================================================
-- STEP 1 — PRE-SCAN (READ-ONLY; run this FIRST and eyeball the rows)
-- ============================================================================
SELECT
  t.cancellation_reason,
  tr.tax_status::text                  AS tax_status,
  COUNT(*)                             AS stuck_rows,
  COUNT(*) FILTER (WHERE tr.voided_at IS NULL) AS with_null_voided_at,
  COALESCE(SUM(tr.tax_amount_cents),0) AS sum_tax_amount_cents
FROM public.trades t
JOIN public.tax_records tr ON tr.trade_id = t.id
WHERE t.status = 'cancelled'
  AND tr.tax_status IN ('quoted','capture_failed')
GROUP BY t.cancellation_reason, tr.tax_status::text
ORDER BY stuck_rows DESC;

-- ============================================================================
-- STEP 2 — MUTATION: void every voidable tax record on a cancelled trade
-- ============================================================================
DO $$
DECLARE
  v_row     RECORD;
  v_result  JSONB;
  v_voided  INTEGER := 0;
  v_failed  INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT
      t.id                            AS trade_id,
      t.cancellation_reason           AS cancellation_reason,
      tr.tax_status::text             AS tax_status,
      tr.tax_amount_cents             AS tax_amount_cents
    FROM public.trades t
    JOIN public.tax_records tr ON tr.trade_id = t.id
    WHERE t.status = 'cancelled'
      AND tr.tax_status IN ('quoted','capture_failed')
    ORDER BY t.cancelled_at ASC NULLS FIRST
  LOOP
    v_result := public.rpc_void_tax_for_trade(
      v_row.trade_id,
      'fix_task_24_backfill'
    );

    IF (v_result ->> 'success')::boolean IS TRUE THEN
      v_voided := v_voided + 1;
      RAISE NOTICE 'FIX-Task-24 backfill: voided trade % (% $%) prev=% -> %',
        v_row.trade_id,
        v_row.cancellation_reason,
        (v_row.tax_amount_cents / 100.0),
        v_row.tax_status,
        (v_result -> 'data' ->> 'new_status');
    ELSE
      v_failed := v_failed + 1;
      RAISE WARNING 'FIX-Task-24 backfill: FAILED trade % (%): %',
        v_row.trade_id, v_row.cancellation_reason, v_result;
    END IF;
  END LOOP;

  RAISE NOTICE 'FIX-Task-24 backfill COMPLETE: % voided, % failed', v_voided, v_failed;
END $$;

-- ============================================================================
-- STEP 3 — POST-CHECK (READ-ONLY; expected: 0 rows)
-- ============================================================================
SELECT
  COUNT(*)                                    AS remaining_stuck_rows,
  COUNT(*) FILTER (WHERE tr.tax_status = 'quoted')           AS still_quoted,
  COUNT(*) FILTER (WHERE tr.tax_status = 'capture_failed')   AS still_capture_failed,
  COUNT(*) FILTER (WHERE tr.tax_status = 'voided')           AS now_voided
FROM public.trades t
JOIN public.tax_records tr ON tr.trade_id = t.id
WHERE t.status = 'cancelled'
  AND tr.tax_status IN ('quoted','capture_failed');

-- ============================================================================
-- STEP 4 (optional) — period-report sanity: pending vs. voided tax after cleanup
-- ============================================================================
SELECT
  tr.tax_status::text                        AS tax_status,
  COUNT(*)                                   AS rows,
  COALESCE(SUM(tr.tax_amount_cents),0)       AS sum_tax_amount_cents
FROM public.tax_records tr
GROUP BY tr.tax_status::text
ORDER BY rows DESC;

-- ============================================================================
-- Rollback plan
-- ============================================================================
-- This cleanup is intentionally one-directional: it moves inconsistent rows
-- ('quoted' on a cancelled trade) to the only valid state ('voided'). Reverting it
-- would re-create the phantom pending-tax residue, so NO rollback is provided and
-- none is needed. If the void itself were wrong, the diagnosis would be a
-- cancellation that should never have happened — fix that trade, not the tax row.
-- ============================================================================
