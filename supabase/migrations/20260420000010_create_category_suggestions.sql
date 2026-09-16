-- FILE: supabase/migrations/20260420000007_create_category_suggestions.sql
-- ADMIN-V3-001: Create category_suggestions table + RLS + indexes
-- Module: MODULE-12-ADMIN-V3-CATEGORIES
-- Dependencies: categories, items, auth.users

-- ===========================================================================
-- STEP 1: Create category_suggestions Table
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.category_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_name TEXT NOT NULL,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  merged_to_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT category_suggestions_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  CONSTRAINT category_suggestions_item_id_unique 
    UNIQUE (item_id)
);

-- ===========================================================================
-- STEP 2: Add Column Comments
-- ===========================================================================

COMMENT ON TABLE public.category_suggestions IS 
  'Seller-requested category suggestions from "Other" category flow';

COMMENT ON COLUMN public.category_suggestions.suggested_name IS 
  'Category name suggested by seller (not validated against existing categories)';

COMMENT ON COLUMN public.category_suggestions.seller_id IS 
  'User who suggested the category (FK to auth.users)';

COMMENT ON COLUMN public.category_suggestions.item_id IS 
  'Item for which category was suggested (UNIQUE — one suggestion per item)';

COMMENT ON COLUMN public.category_suggestions.status IS 
  'Suggestion status: pending | approved | rejected | merged';

COMMENT ON COLUMN public.category_suggestions.approved_by IS 
  'Admin user who approved/rejected/merged the suggestion';

COMMENT ON COLUMN public.category_suggestions.merged_to_category_id IS 
  'If status=merged, the existing category this suggestion was merged into';

COMMENT ON COLUMN public.category_suggestions.admin_note IS 
  'Admin note explaining rejection or merge reasoning';

COMMENT ON COLUMN public.category_suggestions.reviewed_at IS 
  'Timestamp when admin took action (approved/rejected/merged)';

-- ===========================================================================
-- STEP 3: Enable Row Level Security
-- ===========================================================================

ALTER TABLE public.category_suggestions ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- STEP 4: Admin Role Helper (supports multiple role sources)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.admin_has_role(
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Prefer existing helper when available.
  IF to_regprocedure('public.is_admin()') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.is_admin()' INTO v_is_admin;
      IF COALESCE(v_is_admin, FALSE) THEN
        RETURN TRUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_is_admin := FALSE;
    END;
  END IF;

  -- Legacy deployments may have user_roles.
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    EXECUTE '
      SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = $1
          AND ur.role = ''admin''
      )
    ' INTO v_is_admin USING p_user_id;

    IF COALESCE(v_is_admin, FALSE) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Some deployments store role in profiles.role.
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE '
      SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = $1
          AND p.role = ''admin''
      )
    ' INTO v_is_admin USING p_user_id;

    IF COALESCE(v_is_admin, FALSE) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Final fallback: auth.users metadata flag.
  SELECT EXISTS (
    SELECT 1
    FROM auth.users au
    WHERE au.id = p_user_id
      AND COALESCE(au.raw_user_meta_data ->> 'is_admin', 'false') = 'true'
  ) INTO v_is_admin;

  RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

COMMENT ON FUNCTION public.admin_has_role(UUID) IS
  'Returns true when user is admin. Compatible with is_admin(), user_roles, profiles.role, or auth metadata.';

GRANT EXECUTE ON FUNCTION public.admin_has_role(UUID) TO authenticated, service_role;

-- ===========================================================================
-- STEP 5: Create RLS Policies
-- ===========================================================================

-- Policy: Admin can manage all suggestions (CRUD)
DROP POLICY IF EXISTS "Admin can manage all category suggestions" 
  ON public.category_suggestions;

CREATE POLICY "Admin can manage all category suggestions"
  ON public.category_suggestions
  FOR ALL
  TO authenticated
  USING (public.admin_has_role(auth.uid()))
  WITH CHECK (public.admin_has_role(auth.uid()));

-- Policy: Seller can view own suggestions (SELECT only)
DROP POLICY IF EXISTS "Seller can view own category suggestions" 
  ON public.category_suggestions;

CREATE POLICY "Seller can view own category suggestions"
  ON public.category_suggestions
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- ===========================================================================
-- STEP 6: Create Indexes
-- ===========================================================================

-- Partial index on pending status (for admin queue)
CREATE INDEX IF NOT EXISTS idx_category_suggestions_status 
  ON public.category_suggestions(status, created_at DESC) 
  WHERE status = 'pending';

-- Index on seller_id for "my suggestions" queries
CREATE INDEX IF NOT EXISTS idx_category_suggestions_seller 
  ON public.category_suggestions(seller_id, created_at DESC);

-- Index on item_id for UNIQUE constraint enforcement + lookups
CREATE INDEX IF NOT EXISTS idx_category_suggestions_item_id 
  ON public.category_suggestions(item_id);

-- ===========================================================================
-- VERIFICATION QUERIES (Commented)
-- ===========================================================================

/*
-- Verify table exists with all columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'category_suggestions'
ORDER BY ordinal_position;

-- Verify UNIQUE constraint on item_id
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.category_suggestions'::regclass
  AND conname = 'category_suggestions_item_id_unique';

-- Verify status CHECK constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.category_suggestions'::regclass
  AND conname = 'category_suggestions_status_check';

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'category_suggestions';

-- Verify RLS policies
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'category_suggestions'
ORDER BY policyname;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'category_suggestions'
ORDER BY indexname;

-- Test INSERT with UPSERT behavior (for MODULE-04 V3 integration)
-- (This would fail if run multiple times without the ON CONFLICT clause in app code)
/*
INSERT INTO public.category_suggestions (seller_id, item_id, suggested_name, status)
VALUES (
  auth.uid(),
  '00000000-0000-0000-0000-000000000001', -- Replace with actual item_id
  'Test Category',
  'pending'
)
ON CONFLICT (item_id) DO UPDATE
SET suggested_name = EXCLUDED.suggested_name,
    status = 'pending',
    reviewed_at = NULL;
*/
*/
