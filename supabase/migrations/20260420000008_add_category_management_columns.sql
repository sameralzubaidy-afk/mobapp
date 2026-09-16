-- FILE: supabase/migrations/20260420000006_add_category_management_columns.sql
-- ADMIN-V3-001: Add 11 new category management columns + indexes + backfill
-- Module: MODULE-12-ADMIN-V3-CATEGORIES
-- Dependencies: categories table (from 20251217000002)

-- ===========================================================================
-- STEP 1: ALTER TABLE categories — Add 11 New Columns
-- ===========================================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS bonus_badge_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS sp_earning_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.10,
  ADD COLUMN IF NOT EXISTS sp_spending_cap_percent INT NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS sp_config_notes TEXT,
  ADD COLUMN IF NOT EXISTS sp_rate_change_notify BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS item_count INT NOT NULL DEFAULT 0;

-- ===========================================================================
-- STEP 2: Add CHECK Constraints
-- ===========================================================================

-- SP earning multiplier must be between 1.05 and 1.40
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categories_sp_earning_multiplier_check'
  ) THEN
    ALTER TABLE public.categories 
      ADD CONSTRAINT categories_sp_earning_multiplier_check 
      CHECK (sp_earning_multiplier BETWEEN 1.05 AND 1.40);
  END IF;
END
$$;

-- SP spending cap percent must be between 50 and 80
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categories_sp_spending_cap_percent_check'
  ) THEN
    ALTER TABLE public.categories 
      ADD CONSTRAINT categories_sp_spending_cap_percent_check 
      CHECK (sp_spending_cap_percent BETWEEN 50 AND 80);
  END IF;
END
$$;

-- Description length check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categories_description_length_check'
  ) THEN
    ALTER TABLE public.categories 
      ADD CONSTRAINT categories_description_length_check 
      CHECK (LENGTH(description) <= 200);
  END IF;
END
$$;

-- Icon length check (emoji or icon library name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categories_icon_length_check'
  ) THEN
    ALTER TABLE public.categories 
      ADD CONSTRAINT categories_icon_length_check 
      CHECK (LENGTH(icon) <= 50);
  END IF;
END
$$;

-- SP config notes length check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categories_sp_config_notes_length_check'
  ) THEN
    ALTER TABLE public.categories 
      ADD CONSTRAINT categories_sp_config_notes_length_check 
      CHECK (LENGTH(sp_config_notes) <= 500);
  END IF;
END
$$;

-- ===========================================================================
-- STEP 3: Backfill display_order Using ROW_NUMBER
-- ===========================================================================

-- Update existing categories with sequential display_order
UPDATE public.categories
SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS row_num
  FROM public.categories
  WHERE display_order = 0 OR display_order IS NULL
) AS subquery
WHERE categories.id = subquery.id
  AND (categories.display_order = 0 OR categories.display_order IS NULL);

-- ===========================================================================
-- STEP 4: Create Indexes
-- ===========================================================================

-- Partial index on active categories
CREATE INDEX IF NOT EXISTS idx_categories_active 
  ON public.categories(is_active) 
  WHERE is_active = TRUE;

-- Partial index on item_count (for quick "empty category" checks)
CREATE INDEX IF NOT EXISTS idx_categories_item_count 
  ON public.categories(item_count) 
  WHERE item_count > 0;

-- Partial index on bonus categories (sp_earning_multiplier > 1.10)
CREATE INDEX IF NOT EXISTS idx_categories_bonus 
  ON public.categories(sp_earning_multiplier) 
  WHERE sp_earning_multiplier > 1.10;

-- ===========================================================================
-- STEP 5: Add Column Comments
-- ===========================================================================

COMMENT ON COLUMN public.categories.description IS 
  'Category description for admin portal and buyer-facing tooltips (max 200 chars)';

COMMENT ON COLUMN public.categories.icon_url IS 
  'Custom uploaded category icon URL from Supabase Storage (category-icons bucket)';

COMMENT ON COLUMN public.categories.bonus_badge_icon_url IS 
  'Custom bonus badge icon URL (default ⭐) for categories with earning multiplier > 1.10';

COMMENT ON COLUMN public.categories.sp_earning_multiplier IS 
  'Swap Points earning multiplier (1.05 – 1.40); higher value = bonus category';

COMMENT ON COLUMN public.categories.sp_spending_cap_percent IS 
  'Swap Points spending cap percentage (50 – 80); max % of item price payable with SP';

COMMENT ON COLUMN public.categories.sp_config_notes IS 
  'Admin notes for SP rate configuration (max 500 chars)';

COMMENT ON COLUMN public.categories.sp_rate_change_notify IS 
  'One-shot flag: when TRUE, enqueue in-app banner notification on rate update';

COMMENT ON COLUMN public.categories.item_count IS 
  'Live count of active items in this category (maintained by trigger only)';

-- ===========================================================================
-- VERIFICATION QUERIES (Commented)
-- ===========================================================================

/*
-- Verify all 11 new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'categories' 
  AND column_name IN (
    'description', 'icon_url', 'bonus_badge_icon_url', 
    'sp_earning_multiplier', 'sp_spending_cap_percent', 
    'sp_config_notes', 'sp_rate_change_notify', 'item_count'
  )
ORDER BY column_name;

-- Verify CHECK constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.categories'::regclass
  AND contype = 'c'
ORDER BY conname;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'categories'
  AND indexname IN ('idx_categories_active', 'idx_categories_item_count', 'idx_categories_bonus')
ORDER BY indexname;

-- Verify display_order backfill
SELECT name, display_order 
FROM public.categories 
ORDER BY display_order;

-- Verify column comments
SELECT column_name, col_description('public.categories'::regclass, ordinal_position) AS description
FROM information_schema.columns
WHERE table_name = 'categories'
  AND col_description('public.categories'::regclass, ordinal_position) IS NOT NULL
ORDER BY column_name;
*/
