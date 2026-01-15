-- =====================================================
-- Migration: 030_reviews.sql
-- Description: Reviews table with RLS policies
-- Module: MODULE-08-REVIEWS-RATINGS (TASK REVIEW-001)
-- =====================================================

-- Drop table if exists (fresh start for idempotent migration)
DROP TABLE IF EXISTS reviews CASCADE;

-- Create reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  report_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_review_per_trade UNIQUE (trade_id, reviewer_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS reviews_reviewer_id_idx ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS reviews_reviewee_id_idx ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS reviews_trade_id_idx ON reviews(trade_id);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at DESC);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy: Users can view reviews about themselves
CREATE POLICY "Users can view reviews about them"
  ON reviews FOR SELECT
  USING (
    reviewee_id = auth.uid()
    AND is_hidden = FALSE
  );

-- Create RLS Policy: Users can view reviews they wrote
CREATE POLICY "Users can view own reviews"
  ON reviews FOR SELECT
  USING (reviewer_id = auth.uid());

-- Create RLS Policy: Users can create reviews for completed trades
CREATE POLICY "Users can create reviews for own trades"
  ON reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_id
      AND trades.status = 'completed'
      AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
      AND trades.completed_at IS NOT NULL
    )
  );

-- Create RLS Policy: Users can update own reviews (within 24 hours)
CREATE POLICY "Users can update own reviews within 24h"
  ON reviews FOR UPDATE
  USING (
    reviewer_id = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours'
  )
  WITH CHECK (reviewer_id = auth.uid());

-- Create or replace function for updated_at trigger
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_reviews_updated_at_trigger ON reviews;
CREATE TRIGGER update_reviews_updated_at_trigger
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();

-- =====================================================
-- VERIFICATION QUERIES (Run these after applying migration)
-- =====================================================

-- 1. Verify table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'reviews'
-- ORDER BY ordinal_position;

-- 2. Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'reviews';

-- 3. Verify RLS is enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename = 'reviews';

-- 4. Verify policies
-- SELECT policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'reviews';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
