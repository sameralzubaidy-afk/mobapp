-- =====================================================
-- Migration: 031_review_reports.sql
-- Description: Review reporting system (admin-only hiding)
-- Module: MODULE-08-REVIEWS-RATINGS (TASK REVIEW-006)
-- =====================================================

-- Drop tables if they exist (for idempotent migration)
DROP TABLE IF EXISTS review_reports CASCADE;

-- Create review_reports table
CREATE TABLE review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'offensive', 'false_info', 'other')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One report per user per review
  CONSTRAINT unique_report_per_review UNIQUE (review_id, reporter_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS review_reports_review_id_idx ON review_reports(review_id);
CREATE INDEX IF NOT EXISTS review_reports_reporter_id_idx ON review_reports(reporter_id);
CREATE INDEX IF NOT EXISTS review_reports_created_at_idx ON review_reports(created_at DESC);

-- Enable RLS
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports (ONLY if they are the reviewee of the review)
DROP POLICY IF EXISTS "Users can create review reports" ON review_reports;
CREATE POLICY "Users can create review reports"
  ON review_reports FOR INSERT
  WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM reviews
      WHERE id = review_id
      AND reviewee_id = auth.uid()
    )
  );

-- Users can view own reports
DROP POLICY IF EXISTS "Users can view own reports" ON review_reports;
CREATE POLICY "Users can view own reports"
  ON review_reports FOR SELECT
  USING (reporter_id = auth.uid());

-- Function to update report count (NO auto-hide - admin only)
CREATE OR REPLACE FUNCTION check_review_reports()
RETURNS TRIGGER AS $$
BEGIN
  -- Update report count only
  -- Hiding is done manually by admin through moderation actions
  UPDATE reviews
  SET report_count = (
    SELECT COUNT(*) FROM review_reports WHERE review_id = NEW.review_id
  )
  WHERE id = NEW.review_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_review_report_insert ON review_reports;

-- Create trigger on report insert
CREATE TRIGGER on_review_report_insert
  AFTER INSERT ON review_reports
  FOR EACH ROW
  EXECUTE FUNCTION check_review_reports();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify review_reports table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'review_reports'
ORDER BY ordinal_position;

-- Verify indexes exist
SELECT indexname
FROM pg_indexes
WHERE tablename = 'review_reports';

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'review_reports';

-- Verify trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'review_reports';

-- Test report reason constraint
-- This should fail:
-- INSERT INTO review_reports (review_id, reporter_id, reason) 
-- VALUES (gen_random_uuid(), auth.uid(), 'invalid_reason');
