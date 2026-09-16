-- Migration: 20260905000002_dev_task_116_fix_education_audit_columns.sql
-- Module: MODULE-18 TRADING EDUCATION — Dev Task 116 (item 3 unblock)
-- Description: Fix publish_section / unpublish_section / delete_section audit
--   INSERTs to match the LIVE admin_activity_log schema.
--
-- WHY: publish_section/unpublish_section (20260420000021) and delete_section
--   (20260905000001, DT-116) inserted into public.admin_activity_log using
--   columns `admin_user_id` and `action`. The live table (created by
--   20251216_create_geographic_nodes_table.sql, later reshaped) has
--   `admin_id` + `action_type` (not `admin_user_id`/`action`), so every call
--   failed with 42703 "column admin_user_id of relation admin_activity_log
--   does not exist" AFTER the DT-116 client arg fix (item 3) let the function
--   body actually execute. Published sections that predate the reshape still
--   exist, masking this until now.
-- Mode: B (idempotent rerunnable — CREATE OR REPLACE + explicit grants)

-- ============================================================================
-- publish_section (fixed audit insert)
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
  v_admin_user_id := auth.uid();

  IF NOT public.edu_is_admin(v_admin_user_id) THEN
    RAISE EXCEPTION 'UnauthorizedError: Only admins can publish sections';
  END IF;

  SELECT es.section_type INTO v_section_type
  FROM public.education_sections es
  WHERE es.id = p_section_id;

  IF v_section_type IS NULL THEN
    RAISE EXCEPTION 'SectionNotFoundError: Section with id % not found', p_section_id;
  END IF;

  UPDATE public.education_sections
  SET
    is_published = false,
    published_at = NULL,
    published_by = NULL
  WHERE section_type = v_section_type
    AND is_published = true
    AND id <> p_section_id;

  UPDATE public.education_sections
  SET
    is_published = true,
    published_at = now(),
    published_by = auth.uid()
  WHERE id = p_section_id;

  -- Audit (live admin_activity_log schema: admin_id, action_type, details)
  BEGIN
    INSERT INTO public.admin_activity_log (
      admin_id,
      action_type,
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
      NULL;
  END;
END;
$$;

-- ============================================================================
-- unpublish_section (fixed audit insert)
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
  v_admin_user_id := auth.uid();

  IF NOT public.edu_is_admin(v_admin_user_id) THEN
    RAISE EXCEPTION 'UnauthorizedError: Only admins can unpublish sections';
  END IF;

  SELECT es.section_type INTO v_section_type
  FROM public.education_sections es
  WHERE es.id = p_section_id;

  IF v_section_type IS NULL THEN
    RAISE EXCEPTION 'SectionNotFoundError: Section with id % not found', p_section_id;
  END IF;

  UPDATE public.education_sections
  SET
    is_published = false,
    published_at = NULL,
    published_by = NULL
  WHERE id = p_section_id;

  BEGIN
    INSERT INTO public.admin_activity_log (
      admin_id,
      action_type,
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
      NULL;
  END;
END;
$$;

-- ============================================================================
-- delete_section (fixed audit insert — supersedes 20260905000001 body)
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
  v_admin_user_id := auth.uid();

  IF NOT public.edu_is_admin(v_admin_user_id) THEN
    RAISE EXCEPTION 'UnauthorizedError: Only admins can delete sections';
  END IF;

  SELECT es.section_type, es.is_published
    INTO v_section_type, v_is_published
  FROM public.education_sections es
  WHERE es.id = p_section_id;

  IF v_section_type IS NULL THEN
    RAISE EXCEPTION 'SectionNotFoundError: Section with id % not found', p_section_id;
  END IF;

  IF v_is_published THEN
    RAISE EXCEPTION 'PublishedSectionError: Unpublish the section before deleting it';
  END IF;

  DELETE FROM public.education_sections es
  WHERE es.id = p_section_id;

  BEGIN
    INSERT INTO public.admin_activity_log (
      admin_id,
      action_type,
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
      NULL;
  END;
END;
$$;

-- ============================================================================
-- Grants (fail-closed then restore authenticated)
-- ============================================================================
REVOKE ALL ON FUNCTION public.publish_section(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_section(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.publish_section(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.publish_section(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.unpublish_section(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpublish_section(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.unpublish_section(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_section(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_section(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_section(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.delete_section(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_section(UUID) TO authenticated;
