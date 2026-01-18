-- =====================================================
-- Migration: 033_add_reviewed_status_tracking.sql
-- Description: Track which reviews have been reported (historical tracking)
-- Module: MODULE-08-REVIEWS-RATINGS (TASK REVIEW-006)
-- =====================================================

-- Add column to track if review has ever been reported (admin moderation view)
ALTER TABLE reviews ADD COLUMN has_been_reported BOOLEAN DEFAULT FALSE;

-- Create index for filtering moderation queue
CREATE INDEX IF NOT EXISTS reviews_has_been_reported_idx ON reviews(has_been_reported) WHERE has_been_reported = TRUE;

-- Update existing reviews that have reports to mark them as reported
UPDATE reviews
SET has_been_reported = TRUE
WHERE EXISTS (
  SELECT 1 FROM review_reports WHERE review_reports.review_id = reviews.id
);

-- Update the trigger to set has_been_reported flag when first report is created
CREATE OR REPLACE FUNCTION check_review_reports()
RETURNS TRIGGER AS $$
BEGIN
  -- Update report count
  UPDATE reviews
  SET 
    report_count = (
      SELECT COUNT(*) FROM review_reports WHERE review_id = NEW.review_id
    ),
    has_been_reported = TRUE
  WHERE id = NEW.review_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify new column exists
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'reviews' AND column_name = 'has_been_reported';

-- Verify index exists
-- SELECT indexname FROM pg_indexes WHERE tablename = 'reviews' AND indexname LIKE '%has_been_reported%';

-- Check reviews marked as reported
-- SELECT id, is_hidden, report_count, has_been_reported FROM reviews WHERE has_been_reported = TRUE;
