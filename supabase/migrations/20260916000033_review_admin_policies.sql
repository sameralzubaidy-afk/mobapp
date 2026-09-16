-- =====================================================
-- Migration: 032_review_admin_policies.sql
-- Description: Admin RLS policies for review moderation
-- Module: MODULE-08-REVIEWS-RATINGS (TASK REVIEW-006/007)
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
-- VERIFICATION QUERIES
-- =====================================================

-- Verify admin policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('reviews', 'review_reports')
  AND policyname LIKE '%Admin%'
ORDER BY tablename, policyname;

-- Test admin access (as admin user)
-- This should return all reviews including hidden ones:
-- SELECT id, is_hidden, report_count FROM reviews;

-- Test non-admin access
-- This should only return visible reviews or fail:
-- SET LOCAL ROLE authenticated;
-- SELECT id, is_hidden, report_count FROM reviews WHERE is_hidden = true;
