-- File: supabase/migrations/314_prod_p1_security_definer_search_path_hardening.sql
-- Module: MODULE-15.5 P1 hardening follow-up
-- Mode: idempotent rerunnable migration
--
-- Purpose:
-- Ensure every SECURITY DEFINER function in public schema sets explicit search_path.

-- ============================================
-- BLOCK 1: Schema assertions
-- ============================================
-- No schema objects created in this block.

-- ============================================
-- BLOCK 2: Security hardening
-- ============================================

DO $$
DECLARE
  v_fn RECORD;
  v_alter_sql TEXT;
BEGIN
  FOR v_fn IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    IF v_fn.proconfig IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM unnest(v_fn.proconfig) AS p_config
         WHERE p_config LIKE 'search_path=%'
       ) THEN
      v_alter_sql := format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
        v_fn.proname,
        v_fn.identity_args
      );
      -- NOTE (FIX-Task-40): the sweep ran over EVERY SECURITY DEFINER function
      -- in `public`, including extension-owned ones (PostGIS st_estimatedextent),
      -- which belong to another role — ALTER FUNCTION then aborted the whole
      -- migration with "must be owner of function".  Not being able to harden a
      -- function we do not own is not a migration failure; skip it loudly.
      BEGIN
        EXECUTE v_alter_sql;
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'FIX-Task-40: skipped (not owner): %', v_fn.proname;
      END;
    END IF;
  END LOOP;
END;
$$;

-- ============================================
-- Verification queries (run manually)
-- ============================================
-- SELECT
--   p.proname,
--   pg_get_function_identity_arguments(p.oid) AS args,
--   p.proconfig
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname='public' AND p.prosecdef=true
-- ORDER BY p.proname;

-- Common failure modes:
-- 1) Functions in non-public schema are intentionally untouched by this migration.
-- 2) Functions with custom required search_path may need explicit override after this sweep.
-- 3) New SECURITY DEFINER functions created later can reintroduce missing search_path.
