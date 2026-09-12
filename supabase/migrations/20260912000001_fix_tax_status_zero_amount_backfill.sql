-- ============================================================================
-- FIX-Task-20 item 1 (2026-09-12) — completed trades left in tax_status='quoted'
--
-- MODE A: one-time data migration. Apply once, after running the BLOCK 1a review
--         query. The UPDATE itself is idempotent (its `tax_status = 'quoted'`
--         guard makes a second run match 0 rows), but this file is declared Mode A
--         because it targets one specific historical population.
--
-- BACKGROUND (live staging evidence, read-only, 2026-09-12):
--   Completed trades grouped by tax_records.tax_status:
--     quoted    / completed_at <  2026-07-23 : 34 rows, SUM(tax_amount_cents) = 0
--     quoted    / completed_at >= 2026-07-23 :  9 rows, SUM(tax_amount_cents) = 8063
--     collected                              : 40 rows
--     refunded                               :  1 row (175)
--     voided                                 :  4 rows
--
--   QA finding F2 / case O2-C12 reported "34 historical completed trades are still
--   classified `quoted`". FACT CORRECTION established during this fix: all 34 rows
--   carry tax_amount_cents = 0 (exempt / $0-tax records). This is therefore a
--   REPORTING-COUNT defect, not a misreported-dollars defect — the 34 rows inflate
--   the operational "Pending/Authorized" count (81 rows / $162.59 for
--   2026-07-01..2026-09-12) while contributing $0.00.
--
--   Root cause: the original BLOCK 9 backfill (20260723000002, L676-690)
--   deliberately skipped them via `AND tr.tax_amount_cents > 0`, so a completed
--   trade with $0 tax was never classified out of the 'quoted' default.
--
-- WHAT THIS MIGRATION DOES
--   Marks ZERO-AMOUNT completed + quoted records as 'collected', stamping
--   captured_at from completed_at. No money figure changes ($0 either way); the
--   phantom "pending" count for finished trades disappears.
--
-- WHAT IT DELIBERATELY LEAVES ALONE
--   The 9 completed + quoted rows with tax_amount_cents > 0. All 9 have
--   trades.payment_method = 'cash' with captured_at IS NULL, no capture attempt and
--   no capture error — no card capture ever happened, so marking them 'collected'
--   would overstate collected tax by $80.63. They need a separate semantic decision
--   (void, or collect-off-platform) and are OUT OF SCOPE for FIX-Task-20.
--   The `tr.tax_amount_cents = 0` predicate below excludes them explicitly.
-- ============================================================================

-- ============================================================================
-- BLOCK 1a — REVIEW ONLY (run first; expect rows_to_mark = 34, total_tax_cents = 0)
-- ============================================================================
-- SELECT COUNT(*) AS rows_to_mark,
--        COALESCE(SUM(tr.tax_amount_cents), 0) AS total_tax_cents
-- FROM public.tax_records tr
-- JOIN public.trades t ON t.id = tr.trade_id
-- WHERE tr.tax_status = 'quoted'
--   AND t.status = 'completed'
--   AND tr.tax_amount_cents = 0
--   AND t.stripe_refund_id IS NULL;

-- ============================================================================
-- BLOCK 1b — Schema/Data change
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.tax_records tr
  SET tax_status  = 'collected'::public.tax_status,
      captured_at = COALESCE(tr.captured_at, t.completed_at, t.updated_at),
      updated_at  = now()
  FROM public.trades t
  WHERE tr.trade_id = t.id
    AND tr.tax_status = 'quoted'
    AND tr.tax_amount_cents = 0        -- zero-tax records only (see header note)
    AND t.status = 'completed'
    AND t.stripe_refund_id IS NULL;    -- refunded trades stay with BLOCK 9's branch

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[fix-task-20] marked % zero-amount completed tax records as collected', v_count;
END;
$$;

-- ============================================================================
-- BLOCK 2 — Verification (expect: quoted = 0 for pre-2026-07-23 completed trades)
-- ============================================================================
-- SELECT tr.tax_status, COUNT(*) AS n, COALESCE(SUM(tr.tax_amount_cents), 0) AS tax_cents
-- FROM public.tax_records tr
-- JOIN public.trades t ON t.id = tr.trade_id
-- WHERE t.status = 'completed'
--   AND t.completed_at < '2026-07-23'
-- GROUP BY tr.tax_status
-- ORDER BY tr.tax_status;
--
-- Re-run the summary RPC and confirm the pending count drops by 34 (window
-- 2026-07-01..2026-09-12 was 81 rows / $162.59 before this migration):
-- SELECT public.get_tax_summary_for_period('2026-07-01'::date, '2026-09-12'::date, NULL, 'summary', NULL)
--        -> 'data' -> 'pending_tax_count';
--
-- ROLLBACK: there is no destructive change and no dollar impact. To revert, set the
-- same rows back to 'quoted' and captured_at = NULL, matched by the same predicate
-- (tax_amount_cents = 0 AND trade completed AND completed_at < '2026-07-23').
-- ============================================================================
