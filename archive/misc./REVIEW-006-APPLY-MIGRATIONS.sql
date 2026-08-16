-- =====================================================
-- REVIEW-006: Complete Migration Script
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 0: Add role column to profiles (if not exists)
-- =====================================================

-- Add role column to profiles table (safe to re-run)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
    RAISE NOTICE 'Added role column to profiles table';
  ELSE
    RAISE NOTICE 'Role column already exists in profiles table';
  END IF;
END $$;

-- Add is_hidden and report_count columns to reviews (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE reviews ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added is_hidden column to reviews table';
  ELSE
    RAISE NOTICE 'is_hidden column already exists in reviews table';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name = 'report_count'
  ) THEN
    ALTER TABLE reviews ADD COLUMN report_count INTEGER DEFAULT 0;
    RAISE NOTICE 'Added report_count column to reviews table';
  ELSE
    RAISE NOTICE 'report_count column already exists in reviews table';
  END IF;
END $$;

-- =====================================================
-- STEP 1: Create review_reports table
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

-- Users can create reports
DROP POLICY IF EXISTS "Users can create review reports" ON review_reports;
CREATE POLICY "Users can create review reports"
  ON review_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- Users can view own reports
DROP POLICY IF EXISTS "Users can view own reports" ON review_reports;
CREATE POLICY "Users can view own reports"
  ON review_reports FOR SELECT
  USING (reporter_id = auth.uid());

-- Function to auto-hide reviews with 3+ reports
CREATE OR REPLACE FUNCTION check_review_reports()
RETURNS TRIGGER AS $$
BEGIN
  -- Update report count
  UPDATE reviews
  SET report_count = (
    SELECT COUNT(*) FROM review_reports WHERE review_id = NEW.review_id
  )
  WHERE id = NEW.review_id;

  -- Auto-hide if 3+ reports
  UPDATE reviews
  SET is_hidden = TRUE
  WHERE id = NEW.review_id
    AND report_count >= 3;

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
-- STEP 2: Admin RLS Policies
-- =====================================================

-- Admin policy for review_reports (view all)
DROP POLICY IF EXISTS "Admins can view all review reports" ON review_reports;
CREATE POLICY "Admins can view all review reports"
  ON review_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin policy for reviews (view hidden reviews)
DROP POLICY IF EXISTS "Admins can view all reviews including hidden" ON reviews;
CREATE POLICY "Admins can view all reviews including hidden"
  ON reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin can update reviews (approve/delete)
DROP POLICY IF EXISTS "Admins can update reviews" ON reviews;
CREATE POLICY "Admins can update reviews"
  ON reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin can delete reviews
DROP POLICY IF EXISTS "Admins can delete reviews" ON reviews;
CREATE POLICY "Admins can delete reviews"
  ON reviews FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin can delete review reports
DROP POLICY IF EXISTS "Admins can delete review reports" ON review_reports;
CREATE POLICY "Admins can delete review reports"
  ON review_reports FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- STEP 3: Verification Queries
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

-- Verify admin policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('reviews', 'review_reports')
  AND policyname LIKE '%Admin%'
ORDER BY tablename, policyname;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ REVIEW-006 migrations applied successfully!';
  RAISE NOTICE 'Tables created: review_reports';
  RAISE NOTICE 'Columns added to reviews: is_hidden, report_count';
  RAISE NOTICE 'Trigger created: check_review_reports()';
  RAISE NOTICE 'Admin RLS policies created';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run typecheck: npm run type-check';
  RAISE NOTICE '2. Run tests: npm test';
  RAISE NOTICE '3. Follow manual testing guide in REVIEW-006-MANUAL-TESTING-GUIDE.md';
END $$;
