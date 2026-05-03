-- Migration: 20260420000018_create_education_sections.sql
-- Module: MODULE-18 TRADING EDUCATION V1 (EDU-001)
-- Description: Create education_sections table with RLS, partial unique index, and triggers
-- Dependencies: MODULE-01 (admin role source), profiles table
-- Idempotent: YES (uses IF NOT EXISTS, CREATE OR REPLACE)

-- ============================================================================
-- PART 1: CREATE TABLE education_sections
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.education_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content fields
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  
  -- Organization
  display_order INTEGER NOT NULL DEFAULT 0,
  section_type TEXT NOT NULL,
  
  -- Publishing state
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_education_sections_title_length 
    CHECK (LENGTH(title) BETWEEN 3 AND 100),
  CONSTRAINT chk_education_sections_body_length 
    CHECK (LENGTH(body) BETWEEN 10 AND 2000),
  CONSTRAINT chk_education_sections_image_url_length 
    CHECK (image_url IS NULL OR LENGTH(image_url) <= 500),
  CONSTRAINT chk_education_sections_section_type 
    CHECK (section_type IN (
      'general',
      'sp_definition',
      'sp_earning',
      'sp_spending',
      'safety',
      'example'
    ))
);

-- Add table comment
COMMENT ON TABLE public.education_sections IS 
  'MODULE-18: Configurable education content sections for onboarding and help screens';

COMMENT ON COLUMN public.education_sections.section_type IS 
  'Content type: general|sp_definition|sp_earning|sp_spending|safety|example';

COMMENT ON COLUMN public.education_sections.is_published IS 
  'Only one row per section_type can be published (enforced by partial unique index)';

-- ============================================================================
-- PART 2: CREATE PARTIAL UNIQUE INDEX (one published row per section_type)
-- ============================================================================

-- Drop if exists (for idempotency)
DROP INDEX IF EXISTS public.uq_education_sections_one_published_per_type;

CREATE UNIQUE INDEX uq_education_sections_one_published_per_type
  ON public.education_sections (section_type)
  WHERE is_published = true;

COMMENT ON INDEX public.uq_education_sections_one_published_per_type IS 
  'Ensures only one published row per section_type at any time';

-- ============================================================================
-- PART 3: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_education_sections_published 
  ON public.education_sections (display_order)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_education_sections_type 
  ON public.education_sections (section_type, is_published);

-- ============================================================================
-- PART 4: CREATE UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_education_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS education_sections_updated_at ON public.education_sections;

CREATE TRIGGER education_sections_updated_at
  BEFORE UPDATE ON public.education_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_education_sections_updated_at();

-- ============================================================================
-- PART 4.5: CREATE ADMIN CHECK HELPER (COMPATIBLE ACROSS ROLE SCHEMAS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.edu_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Prefer shared helper when available.
  IF to_regprocedure('public.admin_has_role(uuid)') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.admin_has_role($1)' INTO v_is_admin USING p_user_id;
      IF COALESCE(v_is_admin, FALSE) THEN
        RETURN TRUE;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_is_admin := FALSE;
    END;
  END IF;

  -- Fallback to common helper variants.
  IF to_regprocedure('public.is_admin()') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.is_admin()' INTO v_is_admin;
      IF COALESCE(v_is_admin, FALSE) THEN
        RETURN TRUE;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_is_admin := FALSE;
    END;
  END IF;

  IF to_regprocedure('public.is_admin(uuid)') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.is_admin($1)' INTO v_is_admin USING p_user_id;
      IF COALESCE(v_is_admin, FALSE) THEN
        RETURN TRUE;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_is_admin := FALSE;
    END;
  END IF;

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

  IF to_regclass('public.role_based_access_control') IS NOT NULL THEN
    EXECUTE '
      SELECT EXISTS (
        SELECT 1
        FROM public.role_based_access_control rbac
        WHERE rbac.user_id = $1
          AND rbac.role = ''admin''
      )
    ' INTO v_is_admin USING p_user_id;

    IF COALESCE(v_is_admin, FALSE) THEN
      RETURN TRUE;
    END IF;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    BEGIN
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
    EXCEPTION
      WHEN undefined_column THEN
        NULL;
    END;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users au
    WHERE au.id = p_user_id
      AND COALESCE(au.raw_user_meta_data ->> 'is_admin', 'false') = 'true'
  ) INTO v_is_admin;

  RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

COMMENT ON FUNCTION public.edu_is_admin(UUID) IS
  'MODULE-18 helper: admin check compatible with admin_has_role, is_admin, user_roles, role_based_access_control, profiles.role, or auth metadata.';

GRANT EXECUTE ON FUNCTION public.edu_is_admin(UUID) TO authenticated, service_role;

-- ============================================================================
-- PART 5: ENABLE RLS
-- ============================================================================

ALTER TABLE public.education_sections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 6: CREATE RLS POLICIES
-- ============================================================================

-- Drop existing policies (for idempotency)
DROP POLICY IF EXISTS education_sections_select_published ON public.education_sections;
DROP POLICY IF EXISTS education_sections_admin_all ON public.education_sections;

-- Policy 1: Anyone can view published sections
CREATE POLICY education_sections_select_published
  ON public.education_sections
  FOR SELECT
  USING (is_published = true);

COMMENT ON POLICY education_sections_select_published ON public.education_sections IS 
  'Allow all users (including anonymous) to read published sections';

-- Policy 2: Admins can manage all sections (CRUD)
CREATE POLICY education_sections_admin_all
  ON public.education_sections
  FOR ALL
  USING (public.edu_is_admin(auth.uid()))
  WITH CHECK (public.edu_is_admin(auth.uid()));

COMMENT ON POLICY education_sections_admin_all ON public.education_sections IS 
  'Admins can create, read, update, delete all sections (draft + published)';

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing in Supabase SQL Editor)
-- ============================================================================

-- Verify table exists
-- SELECT to_regclass('public.education_sections') IS NOT NULL AS sections_table_exists;

-- Verify RLS is enabled
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname='education_sections';
-- Expected: relrowsecurity = t

-- Verify partial unique index exists
-- SELECT COUNT(*) FROM pg_indexes 
-- WHERE tablename='education_sections' 
--   AND indexname='uq_education_sections_one_published_per_type';
-- Expected: 1

-- Verify constraints
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'public.education_sections'::regclass
-- ORDER BY conname;

-- Verify columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name='education_sections'
-- ORDER BY ordinal_position;

-- Verify trigger exists
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table='education_sections';

-- Verify policies
-- SELECT policyname, cmd, permissive, roles, qual
-- FROM pg_policies
-- WHERE tablename='education_sections';
