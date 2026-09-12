-- ============================================================================
-- FIX-Task-20 F9 (2026-09-12) — review report counters never updated in-app
--
-- MODE B: idempotent rerunnable migration (CREATE OR REPLACE + DROP/CREATE trigger).
--
-- Symptom (QA F9)
--   reviews.report_count / reviews.has_been_reported are stale: 13 real
--   review_reports rows exist, yet every counter reads 0. Verified live 2026-09-12:
--     report_rows = 13 · reviews with report_count > 0 = 0 · has_been_reported = 0
--     · rows where a report exists but report_count = 0 = 13
--
-- Root cause
--   public.check_review_reports() (latest body: 20260802000001, L78-93) maintains the
--   counters with `UPDATE public.reviews ... WHERE id = NEW.review_id`. That function
--   is NOT SECURITY DEFINER, so the UPDATE runs as the *reporting* user — and the only
--   UPDATE policy on reviews is 030_reviews.sql L61-68:
--       "Users can update own reviews within 24h" USING (reviewer_id = auth.uid() ...)
--   The in-app reporter is the REVIEWEE (031_review_reports.sql L35-42 allows INSERT by
--   the reviewee), so the trigger's UPDATE matches ZERO RLS-visible rows and silently
--   no-ops. Service-role fixtures bypass RLS, which is why QA fixtures DID flip the
--   counter while real in-app reports never did.
--
-- Fix
--   Make the trigger function SECURITY DEFINER with a hardened search_path so its
--   counter maintenance is not subject to the caller's RLS. Documented rationale: this
--   is a narrow, single-purpose maintenance routine that must write one derived column
--   pair on the row that was just reported; it performs no reads or writes beyond
--   public.reviews / public.review_reports and takes no client input.
--
--   EXECUTE grants: withheld from PUBLIC/anon (trigger firing does not require the
--   caller to hold EXECUTE, and the function cannot be usefully invoked directly since
--   `NEW` only exists in trigger context).
--
-- Companion: 20260912000008 backfills the 13 rows that already drifted.
-- ============================================================================

-- ============================================================================
-- BLOCK 1 — Function + trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_review_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.reviews
  SET
    report_count = (
      SELECT COUNT(*) FROM public.review_reports rr WHERE rr.review_id = NEW.review_id
    ),
    has_been_reported = TRUE,
    review_status = CASE
      WHEN public.reviews.review_status IN ('active', 'reviewed') THEN 'pending_review'
      ELSE public.reviews.review_status
    END,
    updated_at = now()
  WHERE public.reviews.id = NEW.review_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_review_reports() IS
'SECURITY DEFINER (2026-09-12 FIX-Task-20 F9): maintained report_count/has_been_reported/review_status on reviews when a report is inserted. Must bypass RLS because the reporter is the reviewee and the only reviews UPDATE policy is scoped to the reviewer.';

DROP TRIGGER IF EXISTS on_review_report_insert ON public.review_reports;
CREATE TRIGGER on_review_report_insert
  AFTER INSERT ON public.review_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.check_review_reports();

REVOKE EXECUTE ON FUNCTION public.check_review_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_review_reports() TO authenticated, service_role;

-- ============================================================================
-- BLOCK 2 — Verification
-- ============================================================================
-- A) Security posture:
-- SELECT prosecdef FROM pg_proc WHERE proname = 'check_review_reports';   -- expect true
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.review_reports'::regclass;
--
-- B) Live trigger test — insert a report in a rolled-back transaction and confirm the
--    counter moves (use a review that currently has report_count = 0):
-- BEGIN;
--   INSERT INTO public.review_reports (review_id, reporter_id, reason)
--   SELECT r.id, r.reviewee_id, 'other' FROM public.reviews r
--   WHERE COALESCE(r.report_count, 0) = 0 LIMIT 1;
--   SELECT report_count, has_been_reported, review_status FROM public.reviews
--   WHERE id = (SELECT review_id FROM public.review_reports ORDER BY created_at DESC LIMIT 1);
-- ROLLBACK;   -- expect report_count >= 1 and has_been_reported = true
--
-- ROLLBACK: re-apply the 20260802000001 body (drop SECURITY DEFINER). The trigger
-- definition is unchanged in shape.
-- ============================================================================
