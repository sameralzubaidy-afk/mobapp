-- ================================================================
-- Migration: 20260802000001_review_moderation_status_and_notifications.sql
-- Module: MODULE-08-REVIEWS-RATINGS (TASK REVIEW-007)
-- Description:
--   1. Add review_status column to reviews to track the moderation lifecycle
--      (active → pending_review → reviewed | hidden).
--   2. Backfill existing reviews.
--   3. Update check_review_reports() trigger to set pending_review when a
--      report is created.
--
-- Admin "Keep" action (previously "Approve") marks a reported review
-- review_status = 'reviewed' and keeps it visible (the report is REJECTED).
-- Admin "Hide" marks review_status = 'hidden'.
--
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- ================================================================
-- BLOCK 1 — Schema
-- ================================================================

-- 1. Add review_status column (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'review_status'
  ) THEN
    ALTER TABLE public.reviews
      ADD COLUMN review_status TEXT NOT NULL DEFAULT 'active'
      CHECK (review_status IN ('active', 'pending_review', 'reviewed', 'hidden'));
  END IF;
END $$;

-- 1b. Defensively ensure has_been_reported exists (defined in migration 033).
--     This makes this migration order-independent: if 033 was NOT applied,
--     the column is still created here so the trigger below works. If 033 WAS
--     applied, this is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'has_been_reported'
  ) THEN
    ALTER TABLE public.reviews
      ADD COLUMN has_been_reported BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 1c. Defensively ensure the partial index from migration 033 exists too
--     (keeps the moderation queue filter fast; no-op if already created).
CREATE INDEX IF NOT EXISTS reviews_has_been_reported_idx
  ON public.reviews(has_been_reported)
  WHERE has_been_reported = TRUE;

-- 2. Backfill existing rows (only touch rows still in the default 'active' state)
--    Ground truth = existence of rows in review_reports (NOT the has_been_reported
--    flag, which may not have been maintained if migration 033 was skipped).
UPDATE public.reviews
SET review_status = 'hidden'
WHERE review_status = 'active'
  AND is_hidden = TRUE;

UPDATE public.reviews
SET review_status = 'pending_review'
WHERE review_status = 'active'
  AND is_hidden = FALSE
  AND EXISTS (
    SELECT 1 FROM public.review_reports rr WHERE rr.review_id = public.reviews.id
  );

-- 3. Update trigger function: a new report marks the review pending_review
--    (unless it is already hidden by an admin decision).
CREATE OR REPLACE FUNCTION public.check_review_reports()
RETURNS TRIGGER AS $$
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
    END
  WHERE public.reviews.id = NEW.review_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- BLOCK 2 — Verification queries
-- ================================================================

-- 1. Verify column exists with correct CHECK constraint
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'review_status';

-- 2. Verify constraint
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.reviews'::regclass
--   AND conname LIKE '%review_status%';

-- 3. Verify status distribution after backfill
-- SELECT review_status, COUNT(*) FROM public.reviews GROUP BY review_status;

-- 4. Verify trigger function reflects review_status logic
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'check_review_reports';

-- ================================================================
-- ROLLBACK
-- ================================================================
-- ALTER TABLE public.reviews DROP COLUMN review_status;
-- CREATE OR REPLACE FUNCTION public.check_review_reports() ... (restore prior version from 033)
-- ================================================================
