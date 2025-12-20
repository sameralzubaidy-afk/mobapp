-- ================================================================
-- Migration: 20251220000001_add_search_vector_listings.sql
-- Module: MODULE-05-DISCOVERY-V2 - Full-Text Search Index
-- Task: DISCOVERY-V2-001
-- Description: Add PostgreSQL full-text search capability to items table
--              with relevance scoring for listing discovery
-- ================================================================

-- =============================================================================
-- STEP 1: ADD SEARCH_VECTOR TSVECTOR COLUMN
-- =============================================================================

-- Add tsvector column for full-text search (non-generated)
-- Will be populated by trigger function
ALTER TABLE items
ADD COLUMN IF NOT EXISTS search_vector tsvector;

COMMENT ON COLUMN items.search_vector IS 'Full-text search vector with weighted relevance. Updated automatically by trigger on item changes.';

-- =============================================================================
-- STEP 1B: CREATE TRIGGER FUNCTION TO UPDATE SEARCH_VECTOR
-- =============================================================================

-- Drop existing function if it exists (for idempotent migration)
DROP FUNCTION IF EXISTS update_items_search_vector() CASCADE;

-- Create trigger function that populates search_vector
-- Weights: title (A) > description (B) > category name (C)
CREATE FUNCTION update_items_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(
      (SELECT name FROM categories WHERE id = NEW.category_id),
      ''
    )), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call function on INSERT/UPDATE
DROP TRIGGER IF EXISTS items_search_vector_trigger ON items;

CREATE TRIGGER items_search_vector_trigger
BEFORE INSERT OR UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION update_items_search_vector();

-- Update existing items to populate search_vector
UPDATE items SET search_vector = (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(
    (SELECT name FROM categories WHERE id = category_id),
    ''
  )), 'C')
);

-- =============================================================================
-- STEP 2: CREATE GIN INDEX FOR FAST SEARCH
-- =============================================================================

-- Create GIN index for full-text search queries
-- GIN (Generalized Inverted Index) provides O(1) search performance
CREATE INDEX IF NOT EXISTS idx_items_search_vector ON items USING GIN (search_vector);

-- =============================================================================
-- STEP 3: ADD COMPOSITE INDEX FOR FILTERED SEARCH
-- =============================================================================

-- Index for common search filters (active items + SP eligibility)
CREATE INDEX IF NOT EXISTS idx_items_status_sp_search ON items(status, accepts_swap_points)
WHERE status = 'available';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify search_vector column was added:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'items' AND column_name = 'search_vector';

-- Verify GIN index was created:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'items' AND indexname = 'idx_items_search_vector';

-- Verify search functionality (test with sample data):
-- SELECT id, title, 
--   ts_rank(search_vector, plainto_tsquery('english', 'toy')) as relevance
-- FROM items
-- WHERE status = 'available' AND search_vector @@ plainto_tsquery('english', 'toy')
-- ORDER BY relevance DESC
-- LIMIT 5;
