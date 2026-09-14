-- File: fix-task-32-data-repair.sql
--
-- FIX-Task-32 item 4 (2026-09-14) — the owner-approved data corrections that
-- accompany the writer fixes. Owner decision (2026-09-13/14): uncaptured tax is
-- VOIDED, never collected and never booked as a refund.
--
-- WHAT THIS REPAIRS (all three were re-verified read-only on 2026-09-13 and are
-- re-verified by the pre-scans below before anything is touched):
--
--   A. 9 trades with status='completed' whose tax record is still `quoted`
--      (SUM(tax_amount_cents) = 8063 = $80.63), every one with
--      `captured_at IS NULL` and `stripe_refund_id IS NULL`. These are cash trades
--      where the platform never captured the tax, so marking them `collected`
--      would overstate collected tax by $80.63. Correct terminal state = `voided`.
--
--   B. The stranded tax record on trade 67ba29fc-cf01-4713-8e8b-21e3fc460701 (QA
--      finding F2's live proof case): a `cancelled` trade whose tax row is still
--      `quoted` because the competing-offer writer never voided it. Handled by a
--      SCOPE-COMPLETE sweep rather than a single-row patch: "cancelled ⇒ tax must
--      be voided" holds for every cancellation writer, so any row this finds is
--      inconsistent regardless of who cancelled it (the sweep deliberately subsumes
--      the named row and reports it explicitly).
--
--   C. 60 `cancelled` trades with `cancelled_at IS NULL` (by reason: seller_declined
--      50, NULL 7, offer_expired_competing 2, dispute_resolved_refund 1). The DB
--      trigger that used to stamp this only fired on the retired
--      `payment_processing` status. Backfilled with the best available proxy:
--      COALESCE(last_status_change_at, updated_at, created_at) — owner-selected
--      2026-09-14.
--
-- MECHANISM: every tax change goes through `public.rpc_void_tax_for_trade(...)` —
-- the sanctioned lifecycle RPC (BP-84: never a raw tax_records write; it also
-- zeroes stale refund fields per DT71).
--
-- Mode B — idempotent rerunnable (a second run finds 0 rows in every pre-scan).
--
-- RUN ONE STATEMENT PER CALL — `execute_sql` / the SQL Editor returns only the LAST
-- statement's result set, so batching these would hide the evidence.
--   STEP 1  pre-scan A      (READ-ONLY)  -> the rows + total that will be voided
--   STEP 2  mutation A      (MUTATION)   -> voids them, returns each RPC result
--   STEP 3  post-check A    (READ-ONLY)  -> expect 0
--   STEP 4  pre-scan B      (READ-ONLY)  -> cancelled trades with voidable tax
--   STEP 5  mutation B      (MUTATION)   -> voids them, returns each RPC result
--   STEP 6  post-check B    (READ-ONLY)  -> expect 0 + the F2 row explicitly voided
--   STEP 7  pre-scan C      (READ-ONLY)  -> the NULL cancelled_at rows by reason
--   STEP 8  mutation C      (MUTATION)   -> backfills, RETURNING the changed rows
--   STEP 9  post-check C    (READ-ONLY)  -> expect 0
--   STEP 10 final summary   (READ-ONLY)  -> all three invariants at once
--
-- Every MUTATION step is a SINGLE self-evidencing statement (the RPC/UPDATE result
-- is returned inline), so one call = one piece of evidence and a re-run is a clean
-- no-op that returns 0 rows.
--
-- ROLLBACK: none. These are corrections of rows that were already in an invalid
-- state (a completed-but-uncollected tax record, and a cancelled trade with no
-- cancel timestamp); the voided/cancelled_at values are the state the app's own
-- writers would have produced. Re-running is safe and changes nothing.

-- ============================================================================
-- STEP 1 — PRE-SCAN A (READ-ONLY): completed trades whose tax is still `quoted`
-- ============================================================================
SELECT
  t.id                                  AS trade_id,
  t.status                              AS trade_status,
  t.cancellation_reason,
  tr.tax_status::text                   AS tax_status,
  tr.tax_amount_cents,
  tr.captured_at,
  tr.stripe_refund_id,
  tr.reconciliation_status
FROM public.trades t
JOIN public.tax_records tr ON tr.trade_id = t.id
WHERE t.status = 'completed'
  AND tr.tax_status = 'quoted'
ORDER BY tr.tax_amount_cents DESC;

-- ============================================================================
-- STEP 2 — MUTATION A (MUTATION): void the completed-but-uncollected tax rows
--
-- A single statement: the RPC is called once per row and its JSONB result is
-- returned inline, so this call IS the before/after evidence. Guarded to
-- `quoted`/`capture_failed`, so a re-run returns 0 rows (clean no-op).
-- ============================================================================
SELECT
  v.trade_id,
  v.tax_amount_cents,
  public.rpc_void_tax_for_trade(v.trade_id, 'fix_task_32_completed_uncollected') AS void_result
FROM (
  SELECT t.id AS trade_id, tr.tax_amount_cents
  FROM public.trades t
  JOIN public.tax_records tr ON tr.trade_id = t.id
  WHERE t.status = 'completed'
    AND tr.tax_status IN ('quoted', 'capture_failed')
  ORDER BY t.id
) v;

-- ============================================================================
-- STEP 3 — POST-CHECK A (READ-ONLY): expect 0
-- ============================================================================
SELECT COUNT(*) AS remaining_completed_quoted
FROM public.trades t
JOIN public.tax_records tr ON tr.trade_id = t.id
WHERE t.status = 'completed'
  AND tr.tax_status IN ('quoted', 'capture_failed');

-- ============================================================================
-- STEP 4 — PRE-SCAN B (READ-ONLY): cancelled trades with voidable tax
-- ============================================================================
SELECT
  t.cancellation_reason,
  tr.tax_status::text                       AS tax_status,
  COUNT(*)                                  AS stuck_rows,
  COALESCE(SUM(tr.tax_amount_cents), 0)     AS sum_tax_amount_cents,
  BOOL_OR(t.id = '67ba29fc-cf01-4713-8e8b-21e3fc460701') AS includes_f2_proof_row
FROM public.trades t
JOIN public.tax_records tr ON tr.trade_id = t.id
WHERE t.status = 'cancelled'
  AND tr.tax_status IN ('quoted', 'capture_failed')
GROUP BY t.cancellation_reason, tr.tax_status::text
ORDER BY stuck_rows DESC;

-- ============================================================================
-- STEP 5 — MUTATION B (MUTATION): void EVERY voidable tax record on a cancelled
-- trade (scope-complete sweep; subsumes the F2 proof row on
-- 67ba29fc-cf01-4713-8e8b-21e3fc460701, which is listed in the output below).
--
-- Single statement; the RPC result comes back per row.
-- ============================================================================
SELECT
  v.trade_id,
  v.cancellation_reason,
  public.rpc_void_tax_for_trade(v.trade_id, 'fix_task_32_cancelled_backfill') AS void_result
FROM (
  SELECT t.id AS trade_id, t.cancellation_reason
  FROM public.trades t
  JOIN public.tax_records tr ON tr.trade_id = t.id
  WHERE t.status = 'cancelled'
    AND tr.tax_status IN ('quoted', 'capture_failed')
  ORDER BY t.cancelled_at ASC NULLS FIRST
) v;

-- ============================================================================
-- STEP 6 — POST-CHECK B (READ-ONLY): expect 0, and the F2 row explicitly voided
-- ============================================================================
SELECT
  (SELECT COUNT(*)
     FROM public.trades t
     JOIN public.tax_records tr ON tr.trade_id = t.id
    WHERE t.status = 'cancelled'
      AND tr.tax_status IN ('quoted', 'capture_failed'))       AS remaining_cancelled_voidable,
  (SELECT tr.tax_status::text
     FROM public.tax_records tr
    WHERE tr.trade_id = '67ba29fc-cf01-4713-8e8b-21e3fc460701') AS f2_proof_row_tax_status,
  (SELECT tr.voided_at
     FROM public.tax_records tr
    WHERE tr.trade_id = '67ba29fc-cf01-4713-8e8b-21e3fc460701') AS f2_proof_row_voided_at;

-- ============================================================================
-- STEP 7 — PRE-SCAN C (READ-ONLY): cancelled trades missing cancelled_at
-- ============================================================================
SELECT
  COALESCE(t.cancellation_reason, '<null>') AS cancellation_reason,
  COUNT(*)                                  AS null_cancelled_at_rows,
  MIN(t.updated_at)                         AS oldest_updated_at,
  MAX(t.updated_at)                         AS newest_updated_at
FROM public.trades t
WHERE t.status = 'cancelled'
  AND t.cancelled_at IS NULL
GROUP BY COALESCE(t.cancellation_reason, '<null>')
ORDER BY null_cancelled_at_rows DESC;

-- ============================================================================
-- STEP 8 — MUTATION C (MUTATION): backfill cancelled_at
--
-- Value = COALESCE(last_status_change_at, updated_at, created_at) — owner-selected
-- 2026-09-14 as the best available proxy for when the status actually changed.
-- `updated_at` is deliberately NOT touched, so the backfill adds no churn and the
-- trade-status notification trigger no-ops (status is unchanged).
--
-- Single statement: the UPDATE runs inside the CTE and the outer SELECT summarises
-- exactly what changed (count + per-reason breakdown + the value range), so this
-- call is the evidence.
-- ============================================================================
WITH updated AS (
  UPDATE public.trades t
  SET cancelled_at = COALESCE(t.last_status_change_at, t.updated_at, t.created_at)
  WHERE t.status = 'cancelled'
    AND t.cancelled_at IS NULL
  RETURNING t.id, t.cancellation_reason, t.cancelled_at
)
SELECT
  COUNT(*)                                                              AS rows_backfilled,
  COUNT(*) FILTER (WHERE cancellation_reason = 'seller_declined')        AS seller_declined,
  COUNT(*) FILTER (WHERE cancellation_reason IS NULL)                    AS reason_null,
  COUNT(*) FILTER (WHERE cancellation_reason = 'offer_expired_competing') AS offer_expired_competing,
  COUNT(*) FILTER (WHERE cancellation_reason = 'dispute_resolved_refund') AS dispute_resolved_refund,
  MIN(cancelled_at)                                                     AS earliest_backfilled,
  MAX(cancelled_at)                                                     AS latest_backfilled
FROM updated;

-- ============================================================================
-- STEP 9 — POST-CHECK C (READ-ONLY): expect 0
-- ============================================================================
SELECT COUNT(*) AS remaining_cancelled_at_null
FROM public.trades t
WHERE t.status = 'cancelled'
  AND t.cancelled_at IS NULL;

-- ============================================================================
-- STEP 10 — FINAL SUMMARY (READ-ONLY): all three invariants at once
-- ============================================================================
SELECT
  (SELECT COUNT(*)
     FROM public.trades t
     JOIN public.tax_records tr ON tr.trade_id = t.id
    WHERE t.status = 'completed'
      AND tr.tax_status IN ('quoted', 'capture_failed'))          AS completed_quoted_remaining,
  (SELECT COUNT(*)
     FROM public.trades t
     JOIN public.tax_records tr ON tr.trade_id = t.id
    WHERE t.status = 'cancelled'
      AND tr.tax_status IN ('quoted', 'capture_failed'))          AS cancelled_voidable_remaining,
  (SELECT COUNT(*)
     FROM public.trades t
    WHERE t.status = 'cancelled'
      AND t.cancelled_at IS NULL)                                 AS cancelled_at_null_remaining,
  (SELECT COUNT(*)
     FROM public.payments p
    WHERE p.refunded_cents > 0
      AND p.derived_state = 'cancelled')                          AS cancelled_payments_with_refunds;
