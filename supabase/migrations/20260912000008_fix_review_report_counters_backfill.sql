-- ============================================================================
-- FIX-Task-20 F9 companion (2026-09-12) — backfill stale review report counters
--
-- MODE A: one-time data change. Run the BLOCK 1a review query first.
-- PREREQUISITE: 20260912000007 (SECURITY DEFINER trigger) — otherwise the next
--               in-app report would leave the counters stale again.
--
-- Live evidence (staging, read-only, 2026-09-12):
--   review_reports rows = 13 · reviews = 36
--   reviews with report_count > 0 = 0 · reviews with has_been_reported = true = 0
--   reviews having >=1 report but report_count = 0 = 13
--
-- Statement 1 sets the TRUE count on every review that has reports (expected: 13 rows).
-- Statement 2 clears the flag on any review that carries has_been_reported = true with
--   no remaining reports — matching the admin "Keep" path, which deletes the
--   review_reports rows (see p2p-kids-admin .../api/reviews/[reviewId]/keep/route.ts,
--   updated in the same fix to reset has_been_reported). Expected today: 0 rows.
-- ============================================================================

-- ============================================================================
-- BLOCK 1a — REVIEW ONLY
-- ============================================================================
-- SELECT
--   (SELECT COUNT(*) FROM public.review_reports)                                        AS report_rows,
--   (SELECT COUNT(*) FROM public.reviews r
--     WHERE EXISTS (SELECT 1 FROM public.review_reports rr WHERE rr.review_id = r.id)
--       AND COALESCE(r.report_count, 0) = 0)                                            AS rows_to_backfill,
--   (SELECT COUNT(*) FROM public.reviews r
--     WHERE COALESCE(r.has_been_reported, FALSE)
--       AND NOT EXISTS (SELECT 1 FROM public.review_reports rr WHERE rr.review_id = r.id))
--                                                                                       AS flags_to_clear;

-- ============================================================================
-- BLOCK 1b — Data change
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- 1. Set the real report count (and flag) wherever reports exist.
  UPDATE public.reviews r
  SET report_count      = sub.report_count,
      has_been_reported = (sub.report_count > 0),
      updated_at        = now()
  FROM (
    SELECT rr.review_id AS review_id, COUNT(*)::integer AS report_count
    FROM public.review_reports rr
    GROUP BY rr.review_id
  ) sub
  WHERE r.id = sub.review_id
    AND (
      COALESCE(r.report_count, 0) <> sub.report_count
      OR COALESCE(r.has_been_reported, FALSE) IS DISTINCT FROM (sub.report_count > 0)
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[fix-task-20] backfilled report_count on % review rows', v_count;

  -- 2. Clear a stale flag on reviews whose reports were removed (admin "Keep").
  UPDATE public.reviews r
  SET report_count      = 0,
      has_been_reported = FALSE,
      updated_at        = now()
  WHERE COALESCE(r.has_been_reported, FALSE) = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.review_reports rr WHERE rr.review_id = r.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[fix-task-20] cleared stale has_been_reported on % review rows', v_count;
END;
$$;

-- ============================================================================
-- BLOCK 2 — Verification (expect mismatched_rows = 0)
-- ============================================================================
-- SELECT COUNT(*) AS mismatched_rows
-- FROM public.reviews r
-- WHERE COALESCE(r.report_count, 0) <> (
--   SELECT COUNT(*) FROM public.review_reports rr WHERE rr.review_id = r.id
-- );
--
-- Also confirm the ordering the mobile admin screen relies on now returns data:
-- SELECT id, report_count, has_been_reported, review_status
-- FROM public.reviews ORDER BY report_count DESC LIMIT 5;
--
-- ROLLBACK: re-zero report_count / has_been_reported (only meaningful before the
-- backfill; there is no dollar impact either way).
-- ============================================================================
