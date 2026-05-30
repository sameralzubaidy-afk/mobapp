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
      EXECUTE v_alter_sql;
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
