-- =====================================================
-- FILE: supabase/migrations/305_item_safety_flags_and_cpsc_matching.sql
-- MODULE: MODULE-13-SAFETY-COMPLIANCE
-- TASK: SAFETY-002 - CPSC Recall Matching Logic
-- DESCRIPTION:
--   1. Create item_safety_flags table for tracking flagged items
--   2. Create check_cpsc_recalls() function for fuzzy matching
--   3. Enable pg_trgm extension for similarity matching
--   4. Create RLS policies for safety flags
-- MODE: Idempotent (safe to re-run)
-- =====================================================

-- =============================================================================
-- STEP 1: ENABLE pg_trgm EXTENSION FOR FUZZY MATCHING
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- STEP 2: CREATE item_safety_flags TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS item_safety_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('cpsc_recall', 'ai_moderation', 'user_report')),
  flag_reason TEXT NOT NULL,
  confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000 for AI/matching scores
  recall_id UUID REFERENCES cpsc_recalls(id) ON DELETE SET NULL, -- NULL for non-CPSC flags
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')) DEFAULT 'pending',
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_safety_flags_item_id ON item_safety_flags(item_id);
CREATE INDEX IF NOT EXISTS idx_item_safety_flags_status ON item_safety_flags(status);
CREATE INDEX IF NOT EXISTS idx_item_safety_flags_flag_type ON item_safety_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_item_safety_flags_created_at ON item_safety_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_safety_flags_recall_id ON item_safety_flags(recall_id) WHERE recall_id IS NOT NULL;

-- =============================================================================
-- STEP 3: CREATE AUTO-UPDATE TRIGGER FOR item_safety_flags
-- =============================================================================

CREATE OR REPLACE FUNCTION update_item_safety_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_item_safety_flags_updated_at ON item_safety_flags;
CREATE TRIGGER tr_update_item_safety_flags_updated_at
  BEFORE UPDATE ON item_safety_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_item_safety_flags_updated_at();

-- =============================================================================
-- STEP 4: CREATE check_cpsc_recalls() FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION check_cpsc_recalls(
  p_title TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
  recall_id UUID,
  recall_number TEXT,
  product_name TEXT,
  manufacturer TEXT,
  hazard TEXT,
  similarity_score DECIMAL
) AS $$
DECLARE
  v_search_text TEXT;
BEGIN
  -- Combine title and description for matching
  v_search_text := p_title;
  IF p_description IS NOT NULL AND p_description != '' THEN
    v_search_text := v_search_text || ' ' || p_description;
  END IF;

  -- Full-text search + fuzzy matching against CPSC recalls
  RETURN QUERY
  SELECT
    cr.id AS recall_id,
    cr.recall_number,
    cr.product_name,
    cr.manufacturer,
    cr.hazard,
    GREATEST(
      -- Trigram similarity between title and product name
      similarity(p_title, cr.product_name),
      -- Trigram similarity between description and product description
      CASE 
        WHEN p_description IS NOT NULL AND cr.product_description IS NOT NULL
        THEN similarity(p_description, cr.product_description)
        ELSE 0.0
      END,
      -- Trigram similarity between combined text and product name
      similarity(v_search_text, cr.product_name),
      -- Full-text search score (converted to 0-1 range)
      CASE 
        WHEN to_tsvector('english', cr.product_name || ' ' || COALESCE(cr.product_description, '')) 
             @@ plainto_tsquery('english', v_search_text)
        THEN 0.4
        ELSE 0.0
      END
    )::DECIMAL(5,4) AS similarity_score
  FROM cpsc_recalls cr
  WHERE
    -- At least some match exists (fuzzy or full-text)
    (
      -- Fuzzy match on product name (threshold: 0.3)
      similarity(p_title, cr.product_name) > 0.3
      OR similarity(v_search_text, cr.product_name) > 0.3
      -- Full-text search match
      OR to_tsvector('english', cr.product_name || ' ' || COALESCE(cr.product_description, '')) 
         @@ plainto_tsquery('english', v_search_text)
      -- Match on manufacturer if mentioned in title
      OR (cr.manufacturer IS NOT NULL AND p_title ILIKE '%' || cr.manufacturer || '%')
    )
  ORDER BY similarity_score DESC, cr.recall_date DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- STEP 5: CREATE RLS POLICIES FOR item_safety_flags
-- =============================================================================

ALTER TABLE item_safety_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all safety flags
DROP POLICY IF EXISTS "Admins can view all safety flags" ON item_safety_flags;
CREATE POLICY "Admins can view all safety flags"
  ON item_safety_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Policy: Item owners can view flags on their own items
DROP POLICY IF EXISTS "Owners can view own item flags" ON item_safety_flags;
CREATE POLICY "Owners can view own item flags"
  ON item_safety_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items i
      WHERE i.id = item_safety_flags.item_id
      AND i.seller_id = auth.uid()
    )
  );

-- Policy: Service role can insert flags (for automated checks)
DROP POLICY IF EXISTS "Service role can insert flags" ON item_safety_flags;
CREATE POLICY "Service role can insert flags"
  ON item_safety_flags FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Policy: Admins can update flags (for review actions)
DROP POLICY IF EXISTS "Admins can update flags" ON item_safety_flags;
CREATE POLICY "Admins can update flags"
  ON item_safety_flags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================

-- Check table exists
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'item_safety_flags' 
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'item_safety_flags';

-- Check RLS policies
-- SELECT policyname, cmd, permissive, roles, qual 
-- FROM pg_policies 
-- WHERE tablename = 'item_safety_flags';

-- Test check_cpsc_recalls function
-- SELECT * FROM check_cpsc_recalls('Fisher-Price Baby Toy', 'Colorful plastic toy for infants');

-- =============================================================================
-- SUCCESS
-- =============================================================================

-- Migration 305 complete: item_safety_flags table + check_cpsc_recalls function ready
