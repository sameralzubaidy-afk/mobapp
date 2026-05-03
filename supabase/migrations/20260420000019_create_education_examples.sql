-- Migration: 20260420000019_create_education_examples.sql
-- Module: MODULE-18 TRADING EDUCATION V1 (EDU-001)
-- Description: Create education_examples table with RLS, indexes, and triggers
-- Dependencies: 20260420000018 (trigger function), MODULE-12 V3 (categories)
-- Idempotent: YES (uses IF NOT EXISTS, CREATE OR REPLACE)

-- ============================================================================
-- PART 1: CREATE TABLE education_examples
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.education_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Example item details
  item_name TEXT NOT NULL,
  item_price NUMERIC(10,2) NOT NULL,
  
  -- Optional category link (admin will link via CMS after launch)
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  
  -- Organization
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Publishing state
  is_published BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_education_examples_item_name_length 
    CHECK (LENGTH(item_name) BETWEEN 1 AND 100),
  CONSTRAINT chk_education_examples_item_price_range 
    CHECK (item_price > 0 AND item_price <= 10000)
);

-- Add table comment
COMMENT ON TABLE public.education_examples IS 
  'MODULE-18: Example items for SP calculator demonstrations (SP values computed on read)';

COMMENT ON COLUMN public.education_examples.category_id IS 
  'Nullable FK to categories — admin links after launch; NULL = generic example';

COMMENT ON COLUMN public.education_examples.item_price IS 
  'Example price in dollars; SP calculations use this + category_id rates';

-- ============================================================================
-- PART 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_education_examples_published 
  ON public.education_examples (display_order)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_education_examples_category 
  ON public.education_examples (category_id)
  WHERE category_id IS NOT NULL;

-- ============================================================================
-- PART 3: REUSE UPDATED_AT TRIGGER FUNCTION FROM MIGRATION 000018
-- ============================================================================

-- Note: update_education_sections_updated_at() created in 000018
-- We reuse it for consistency (same logic across education tables)

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS education_examples_updated_at ON public.education_examples;

CREATE TRIGGER education_examples_updated_at
  BEFORE UPDATE ON public.education_examples
  FOR EACH ROW
  EXECUTE FUNCTION public.update_education_sections_updated_at();

-- ============================================================================
-- PART 4: ENABLE RLS
-- ============================================================================

ALTER TABLE public.education_examples ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 5: CREATE RLS POLICIES
-- ============================================================================

-- Drop existing policies (for idempotency)
DROP POLICY IF EXISTS education_examples_select_published ON public.education_examples;
DROP POLICY IF EXISTS education_examples_admin_all ON public.education_examples;

-- Policy 1: Anyone can view published examples
CREATE POLICY education_examples_select_published
  ON public.education_examples
  FOR SELECT
  USING (is_published = true);

COMMENT ON POLICY education_examples_select_published ON public.education_examples IS 
  'Allow all users (including anonymous) to read published example items';

-- Policy 2: Admins can manage all examples (CRUD)
CREATE POLICY education_examples_admin_all
  ON public.education_examples
  FOR ALL
  USING (public.edu_is_admin(auth.uid()))
  WITH CHECK (public.edu_is_admin(auth.uid()));

COMMENT ON POLICY education_examples_admin_all ON public.education_examples IS 
  'Admins can create, read, update, delete all examples (draft + published)';

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing in Supabase SQL Editor)
-- ============================================================================

-- Verify table exists
-- SELECT to_regclass('public.education_examples') IS NOT NULL AS examples_table_exists;

-- Verify RLS is enabled
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname='education_examples';
-- Expected: relrowsecurity = t

-- Verify constraints
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'public.education_examples'::regclass
-- ORDER BY conname;

-- Verify columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name='education_examples'
-- ORDER BY ordinal_position;

-- Verify trigger exists
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table='education_examples';

-- Verify policies
-- SELECT policyname, cmd, permissive, roles, qual
-- FROM pg_policies
-- WHERE tablename='education_examples';

-- Verify FK to categories
-- SELECT
--   tc.constraint_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name='education_examples' AND tc.constraint_type='FOREIGN KEY';
