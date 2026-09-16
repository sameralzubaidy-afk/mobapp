-- =====================================================
-- Migration: 308_reviews_public_read_policy.sql
-- Description: Allow authenticated users to read non-hidden reviews
-- Reason: Public Seller Profile must show seller rating/review counts
-- Mode: Idempotent rerunnable migration
-- =====================================================

-- Ensure reviews table has RLS enabled.
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Replace policy idempotently (Postgres does not support CREATE POLICY IF NOT EXISTS).
DROP POLICY IF EXISTS "Authenticated users can view non-hidden reviews" ON public.reviews;
CREATE POLICY "Authenticated users can view non-hidden reviews"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (
    is_hidden IS NOT TRUE
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- 1) Verify RLS is enabled on reviews
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'reviews';

-- 2) Verify policies on reviews
-- SELECT policyname, cmd, permissive, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'reviews'
-- ORDER BY policyname;

-- 3) Verify public read path for non-hidden reviews
-- EXPLAIN (VERBOSE)
-- SELECT r.rating
-- FROM public.reviews r
-- WHERE r.reviewee_id = '<seller-user-id-uuid>'
--   AND r.is_hidden IS NOT TRUE;

-- COMMON FAILURE MODES
-- - If ratings still show empty, confirm the app user is authenticated (anon role will not match).
-- - If ratings still show empty, confirm review rows exist for the target seller in public.reviews.
-- - If ratings still show empty, confirm review rows are not marked hidden (is_hidden = true).
