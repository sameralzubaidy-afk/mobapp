-- ================================================================
-- Migration: 20260420000001_add_item_filter_columns.sql
-- Module: MODULE-05-DISCOVERY-V3-FILTERS
-- Task: DISCOVERY-V3-001
-- Description: Add 4 nullable filter columns (age_group, gender, brand, color)
--              to items table with CHECK constraints and partial indexes
-- ================================================================

-- =============================================================================
-- STEP 1: ADD COLUMNS (IDEMPOTENT)
-- =============================================================================

-- Add age_group column (nullable, CHECK constraint for valid values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'items' 
    AND column_name = 'age_group'
  ) THEN
    ALTER TABLE items ADD COLUMN age_group TEXT 
      CHECK (age_group IN ('0-2', '3-5', '6-8', '9-12', '13+'));
  END IF;
END $$;

-- Add gender column (nullable, CHECK constraint for valid values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'items' 
    AND column_name = 'gender'
  ) THEN
    ALTER TABLE items ADD COLUMN gender TEXT 
      CHECK (gender IN ('boy', 'girl', 'unisex'));
  END IF;
END $$;

-- Add brand column (nullable, CHECK constraint for max length)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'items' 
    AND column_name = 'brand'
  ) THEN
    ALTER TABLE items ADD COLUMN brand TEXT 
      CHECK (LENGTH(brand) <= 100);
  END IF;
END $$;

-- Add color column (nullable TEXT array, no CHECK constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'items' 
    AND column_name = 'color'
  ) THEN
    ALTER TABLE items ADD COLUMN color TEXT[];
  END IF;
END $$;

-- =============================================================================
-- STEP 2: ADD COLUMN COMMENTS
-- =============================================================================

COMMENT ON COLUMN items.age_group IS 'Target age group for the item. Values: 0-2, 3-5, 6-8, 9-12, 13+. Used for filtering in discovery.';
COMMENT ON COLUMN items.gender IS 'Target gender for the item. Values: boy, girl, unisex. Used for filtering in discovery.';
COMMENT ON COLUMN items.brand IS 'Brand name of the item. Max 100 characters. Used for filtering and autocomplete in discovery.';
COMMENT ON COLUMN items.color IS 'Array of color tags for the item. Used for multi-select color filtering in discovery. No server-side validation (client enforces 12 allowed colors).';

-- =============================================================================
-- STEP 3: CREATE PARTIAL INDEXES (IDEMPOTENT)
-- =============================================================================

-- Index 1: age_group (partial on status='available')
-- Keeps index size ~80% smaller by excluding draft/sold/deleted items
CREATE INDEX IF NOT EXISTS idx_items_age_group 
  ON items(age_group) 
  WHERE status = 'available';

-- Index 2: gender (partial on status='available')
CREATE INDEX IF NOT EXISTS idx_items_gender 
  ON items(gender) 
  WHERE status = 'available';

-- Index 3: brand (partial on status='available')
-- Case-insensitive searches use LOWER(brand) in queries
CREATE INDEX IF NOT EXISTS idx_items_brand 
  ON items(brand) 
  WHERE status = 'available';

-- Index 4: color (GIN index for array overlap queries, partial)
-- Supports queries like: WHERE color && ARRAY['blue','red']
CREATE INDEX IF NOT EXISTS idx_items_color 
  ON items USING GIN(color) 
  WHERE status = 'available';

-- Index 5: price (partial on status='available')
-- Supports price range queries and price sorting
CREATE INDEX IF NOT EXISTS idx_items_price 
  ON items(price) 
  WHERE status = 'available';

-- Index 6: composite (category_id, price) for efficient category browsing with sort
-- Supports queries filtering by category and sorting by price
CREATE INDEX IF NOT EXISTS idx_items_category_price 
  ON items(category_id, price) 
  WHERE status = 'available';

-- =============================================================================
-- VERIFICATION QUERY (FOR MANUAL SMOKE TEST)
-- =============================================================================

-- Run this query to verify all 4 columns exist with correct data types:
-- 
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable,
--   column_default
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'items' 
--   AND column_name IN ('age_group', 'gender', 'brand', 'color')
-- ORDER BY column_name;
-- 
-- Expected output:
-- age_group  | text      | YES | NULL
-- brand      | text      | YES | NULL
-- color      | ARRAY     | YES | NULL
-- gender     | text      | YES | NULL
--
-- Verify indexes with:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'items' 
--   AND indexname LIKE 'idx_items_%age_group%'
--    OR indexname LIKE 'idx_items_%gender%'
--    OR indexname LIKE 'idx_items_%brand%'
--    OR indexname LIKE 'idx_items_%color%'
--    OR indexname LIKE 'idx_items_%price%'
--    OR indexname LIKE 'idx_items_category_price%';
