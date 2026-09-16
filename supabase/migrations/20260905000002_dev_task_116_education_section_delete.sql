-- Migration: 20260905000001_dev_task_116_education_section_delete.sql
-- Module: MODULE-18 TRADING EDUCATION V1 (EDU) — Dev Task 116 item 9
-- Description: Create delete_section SECURITY DEFINER RPC (admin-only; refuses published sections)
-- Dependencies: 20260420000018 (education_sections table + edu_is_admin helper)
--              20260420000021 (publish_section / unpublish_section — mirror for grants)
-- Mode: B (idempotent rerunnable — uses CREATE OR REPLACE; REVOKE/GRANT re-run safely)

-- ============================================================================
-- PART 1: CREATE delete_section RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_section(p_section_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section_type TEXT;
  v_is_published BOOLEAN;
  v_admin_user_id UUID;
BEGIN
  -- Step 1: Verify caller is admin
  v_admin_user_id := auth.uid();

  IF NOT public.edu_is_admin(v_admin_user_id) THEN
    RAISE EXCEPTION 'UnauthorizedError: Only admins can delete sections';
  END IF;

  -- Step 2: Load the target row's section_type + published state
  SELECT es.section_type, es.is_published
    INTO v_section_type, v_is_published
  FROM public.education_sections es
  WHERE es.id = p_section_id;

  IF v_section_type IS NULL THEN
    RAISE EXCEPTION 'SectionNotFoundError: Section with id % not found', p_section_id;
  END IF;

  -- Step 3: Refuse published rows (mirrors deleteExample behavior — a live
  -- section must be unpublished first; never hard-delete published content)
  IF v_is_published THEN
    RAISE EXCEPTION 'PublishedSectionError: Unpublish the section before deleting it';
  END IF;

  -- Step 4: Delete the draft row
  DELETE FROM public.education_sections es
  WHERE es.id = p_section_id;

  -- Step 5: Log to audit trail (graceful skip if admin_activity_log absent)
  BEGIN
    INSERT INTO public.admin_activity_log (
      admin_user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      auth.uid(),
      'delete_education_section',
      'education_section',
      p_section_id,
      jsonb_build_object(
        'section_type', v_section_type,
        'action', 'delete'
      )
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- admin_activity_log doesn't exist yet; skip logging
      NULL;
  END;
END;
$$;

COMMENT ON FUNCTION public.delete_section IS
  'MODULE-18 / DT-116: Delete a draft education section (admin-only; refuses published sections)';

-- ============================================================================
-- PART 2: GRANT PERMISSIONS (fail-closed: revoke PUBLIC/anon first, then
-- restore authenticated EXECUTE — BP-78/BP-79 discipline)
-- ============================================================================

REVOKE ALL ON FUNCTION public.delete_section(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_section(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.delete_section(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_section(UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (manual: run as admin in the SQL editor)
-- ============================================================================

-- V1: Function exists + SECURITY DEFINER (expect 1 row, prosecdef = t)
-- SELECT p.proname, p.prosecdef, p.provolatile
-- FROM pg_proc p
-- WHERE p.proname = 'delete_section'
--   AND p.pronamespace = 'public'::regnamespace;

-- V2: Only admins can run it (expect raise: UnauthorizedError ...) — run via anon key
-- SELECT public.delete_section('<section-id-here>');

-- V3: Admin deletes a DRAFT section (expect success; row gone)
-- SELECT public.delete_section('<draft-section-id-here>');

-- V4: delete_section refuses a PUBLISHED section (expect raise: PublishedSectionError ...)
-- SELECT public.delete_section('<published-section-id-here>');

-- V5: Audit row recorded (expect 1 row, action = delete_education_section)
-- SELECT admin_user_id, action, entity_type, entity_id
-- FROM public.admin_activity_log
-- WHERE action = 'delete_education_section'
-- ORDER BY created_at DESC LIMIT 1;
