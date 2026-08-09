-- ============================================================================
-- Fix 42804 drift in fn_get_admin_config_meta / fn_resolve_admin_emails
-- Mode B: Idempotent Rerunnable Migration
--
-- PROBLEM (owner summary):
--   The admin settings pages showed no "Last updated · <ts> · by <email>" labels
--   because two SECURITY DEFINER read RPCs returned auth.users.email
--   (character varying(255)) into a declared TEXT column WITHOUT a cast.
--   Postgres raised 42804 ("Returned type character varying(255) does not match
--   expected type text in column N"), PostgREST surfaced it as a 400, and the
--   client's settingsAudit helper swallowed it — so every settings page silently
--   lost its editor labels.
--
-- FIX:
--   Add the explicit ::text cast on au.email (the same pattern already used by
--   174_admin_referral_analytics.sql and the tax RPCs, e.g.
--   COALESCE(u.email::TEXT, '')). Signatures are UNCHANGED, so plain
--   CREATE OR REPLACE FUNCTION is safe (no DROP needed — BP-12 N/A).
--
-- Naming: p_ params, v_ locals, qualified columns (supabase-sql.instructions).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1: fn_get_admin_config_meta (editor email cast)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_admin_config_meta(
  p_keys TEXT[]
)
RETURNS TABLE (
  out_key TEXT,
  out_value TEXT,
  out_data_type TEXT,
  out_updated_at TIMESTAMP WITH TIME ZONE,
  out_updated_by UUID,
  out_updated_by_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.key,
    ac.value,
    ac.data_type,
    ac.updated_at,
    ac.updated_by,
    au.email::text          -- 42804 fix: auth.users.email is varchar(255)
  FROM public.admin_config ac
  LEFT JOIN auth.users au ON au.id = ac.updated_by
  WHERE ac.key = ANY (p_keys)
    AND ac.is_active = TRUE
  ORDER BY ac.key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_admin_config_meta(TEXT[]) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- BLOCK 2: fn_resolve_admin_emails (email cast)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_resolve_admin_emails(
  p_user_ids UUID[]
)
RETURNS TABLE (
  out_user_id UUID,
  out_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email::text   -- 42804 fix: auth.users.email is varchar(255)
  FROM auth.users au
  WHERE au.id = ANY (p_user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_resolve_admin_emails(UUID[]) TO anon, authenticated, service_role;

-- ============================================================================
-- VERIFICATION (run one statement at a time — result-granularity rule):
--
-- 1) fn_get_admin_config_meta returns editor emails (no 42804):
--    SELECT * FROM public.fn_get_admin_config_meta(
--      ARRAY['sales_tax_enabled','cart_min_value_cents']);
--    -- Expected: rows with out_updated_by_email = a valid email (or NULL), no error.
--
-- 2) fn_resolve_admin_emails returns emails (no 42804):
--    SELECT * FROM public.fn_resolve_admin_emails(
--      ARRAY[(SELECT updated_by FROM public.admin_config
--             WHERE updated_by IS NOT NULL LIMIT 1)]);
--    -- Expected: one row, out_email = an email string, no error.
-- ============================================================================
