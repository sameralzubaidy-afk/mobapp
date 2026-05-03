-- Migration: 20260420000021_education_publish_rpcs.sql
-- Module: MODULE-18 TRADING EDUCATION V1 (EDU-001)
-- Description: Create publish_section and unpublish_section SECURITY DEFINER RPCs
-- Dependencies: 20260420000018 (education_sections + edu_is_admin helper)
-- Idempotent: YES (uses CREATE OR REPLACE)

-- ============================================================================
-- PART 1: CREATE publish_section RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.publish_section(p_section_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section_type TEXT;
  v_admin_user_id UUID;
BEGIN
  -- Step 1: Verify caller is admin
  v_admin_user_id := auth.uid();
  
  IF NOT public.edu_is_admin(v_admin_user_id) THEN
    RAISE EXCEPTION 'UnauthorizedError: Only admins can publish sections';
  END IF;
  
  -- Step 2: Get the section_type of the target row
  SELECT es.section_type INTO v_section_type
  FROM public.education_sections es
  WHERE es.id = p_section_id;
  
  IF v_section_type IS NULL THEN
    RAISE EXCEPTION 'SectionNotFoundError: Section with id % not found', p_section_id;
  END IF;
  
  -- Step 3: Unpublish any existing published row of the same section_type
  -- (partial unique index enforces only one published per type)
  UPDATE public.education_sections
  SET 
    is_published = false,
    published_at = NULL,
    published_by = NULL
  WHERE section_type = v_section_type
    AND is_published = true
    AND id <> p_section_id;
  
  -- Step 4: Publish the target row
  UPDATE public.education_sections
  SET 
    is_published = true,
    published_at = now(),
    published_by = auth.uid()
  WHERE id = p_section_id;
  
  -- Step 5: Log to audit trail (if admin_activity_log exists; graceful skip if not)
  BEGIN
    INSERT INTO public.admin_activity_log (
      admin_user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      auth.uid(),
      'publish_education_section',
      'education_section',
      p_section_id,
      jsonb_build_object(
        'section_type', v_section_type,
        'action', 'publish'
      )
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- admin_activity_log doesn't exist yet; skip logging
      NULL;
  END;
END;
$$;

COMMENT ON FUNCTION public.publish_section IS 
  'MODULE-18: Publish an education section (admin-only; unpublishes previous row of same section_type atomically)';

-- ============================================================================
-- PART 2: CREATE unpublish_section RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unpublish_section(p_section_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section_type TEXT;
  v_admin_user_id UUID;
BEGIN
  -- Step 1: Verify caller is admin
  v_admin_user_id := auth.uid();
  
  IF NOT public.edu_is_admin(v_admin_user_id) THEN
    RAISE EXCEPTION 'UnauthorizedError: Only admins can unpublish sections';
  END IF;
  
  -- Step 2: Get the section_type (for audit logging)
  SELECT es.section_type INTO v_section_type
  FROM public.education_sections es
  WHERE es.id = p_section_id;
  
  IF v_section_type IS NULL THEN
    RAISE EXCEPTION 'SectionNotFoundError: Section with id % not found', p_section_id;
  END IF;
  
  -- Step 3: Unpublish the target row
  UPDATE public.education_sections
  SET 
    is_published = false,
    published_at = NULL,
    published_by = NULL
  WHERE id = p_section_id;
  
  -- Step 4: Log to audit trail (if admin_activity_log exists; graceful skip if not)
  BEGIN
    INSERT INTO public.admin_activity_log (
      admin_user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      auth.uid(),
      'unpublish_education_section',
      'education_section',
      p_section_id,
      jsonb_build_object(
        'section_type', v_section_type,
        'action', 'unpublish'
      )
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- admin_activity_log doesn't exist yet; skip logging
      NULL;
  END;
END;
$$;

COMMENT ON FUNCTION public.unpublish_section IS 
  'MODULE-18: Unpublish an education section (admin-only; sets is_published=false)';

-- ============================================================================
-- PART 3: GRANT PERMISSIONS
-- ============================================================================

-- Revoke all from public (start with clean slate)
REVOKE ALL ON FUNCTION public.publish_section(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpublish_section(UUID) FROM PUBLIC;

-- Grant EXECUTE to authenticated users (admin check happens inside function)
GRANT EXECUTE ON FUNCTION public.publish_section(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_section(UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing in Supabase SQL Editor)
-- ============================================================================

-- Verify functions exist and are SECURITY DEFINER
-- SELECT proname, prosecdef, provolatile, pronargs
-- FROM pg_proc
-- WHERE proname IN ('publish_section', 'unpublish_section')
--   AND pronamespace = 'public'::regnamespace;
-- Expected: 2 rows, prosecdef = t

-- Test 1: Admin publishes a section
-- SELECT public.publish_section('<section-id-here>');

-- Test 2: Verify only one published row per section_type
-- SELECT section_type, COUNT(*) AS published_count
-- FROM public.education_sections
-- WHERE is_published = true
-- GROUP BY section_type;
-- Expected: Each section_type has at most 1 published row

-- Test 3: Non-admin attempts to publish (should raise exception)
-- (Run as non-admin user via anon key):
-- SELECT public.publish_section('<section-id-here>');
-- Expected: ERROR: UnauthorizedError: Only admins can publish sections

-- Test 4: Admin unpublishes a section
-- SELECT public.unpublish_section('<section-id-here>');

-- Test 5: Verify published_at and published_by are set correctly
-- SELECT id, section_type, is_published, published_at, published_by
-- FROM public.education_sections
-- WHERE is_published = true;

-- Test 6: Publish section A (sp_definition) → then publish section B (also sp_definition)
--         → Verify section A is auto-unpublished
-- SELECT id, section_type, is_published FROM public.education_sections
-- WHERE section_type = 'sp_definition'
-- ORDER BY is_published DESC;
-- Expected: Only 1 row with is_published=true
