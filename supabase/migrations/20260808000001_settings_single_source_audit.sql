-- ============================================================================
-- Settings Single-Source & Audit Trail
-- Mode: Idempotent Rerunnable Migration
--
-- Problem being fixed:
--   The /config hub and the standalone settings pages (Tax Settings, Cart
--   Settings, Trade Timing, Node Settings) all read/write the SAME admin_config
--   table, but each surface records the editor differently (or not at all):
--     - /config API  -> secure_upsert_admin_config (sets updated_by, but the
--       API passes user_id = NULL, and its audit write targets `audit_logs`,
--       a table that does NOT exist -> silently dropped).
--     - standalone pages -> upsert_admin_config_setting (does NOT set
--       updated_by; some pages write their own admin_audit_log row).
--   Result: an admin can edit a value in one place and the other place cannot
--   tell WHO changed it or WHEN, and edits from /config leave no audit row.
--
-- Fix (single source of truth):
--   1) upsert_admin_config_setting gains an optional p_admin_id. When present
--      it records admin_config.updated_by (the canonical "last updated by"
--      source). Existing 6-arg callers keep working via the DEFAULT.
--   2) /config path already records updated_at/updated_by via
--      secure_upsert_admin_config; the API change (separate PR/frontend) passes
--      the real admin user id and writes admin_audit_log.
--   3) fn_get_admin_config_meta   - SECURITY DEFINER read RPC returning value +
--      updated_at + updated_by + editor email (joined from auth.users). Used by
--      standalone settings pages to render the same "Last updated" label that
--      the /config hub shows.
--   4) fn_resolve_admin_emails   - SECURITY DEFINER helper mapping admin user
--      ids -> emails for the /config hub and per-node/per-rule labels.
--
-- Naming: p_ prefix for params, v_ prefix for locals, qualified columns.
-- ============================================================================

-- ============================================================================
-- BLOCK 1: upsert_admin_config_setting (adds optional p_admin_id)
-- ============================================================================
-- Signature change (BP-12): DROP before recreating with the extra trailing
-- param. The 7-arg version is a superset of the old 6-arg one; existing 6-arg
-- callers resolve via the DEFAULT p_admin_id = NULL.

DROP FUNCTION IF EXISTS public.upsert_admin_config_setting(
  text, text, public.admin_config_category, text, boolean, boolean
) CASCADE;
DROP FUNCTION IF EXISTS public.upsert_admin_config_setting(
  text, text, public.admin_config_category, text, boolean, boolean, uuid
) CASCADE;

CREATE FUNCTION public.upsert_admin_config_setting(
  p_key TEXT,
  p_value TEXT,
  p_category public.admin_config_category,
  p_data_type TEXT DEFAULT 'string',
  p_is_secret BOOLEAN DEFAULT FALSE,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_admin_id UUID DEFAULT NULL
)
RETURNS TABLE (
  out_id BIGINT,
  out_key TEXT,
  out_value TEXT,
  out_category public.admin_config_category,
  out_data_type TEXT,
  out_is_secret BOOLEAN,
  out_is_active BOOLEAN,
  out_updated_at TIMESTAMP WITH TIME ZONE,
  out_updated_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.admin_config (
    key,
    value,
    category,
    data_type,
    is_secret,
    is_active,
    updated_at,
    updated_by
  )
  VALUES (
    p_key,
    p_value,
    p_category,
    p_data_type,
    p_is_secret,
    p_is_active,
    NOW(),
    p_admin_id
  )
  ON CONFLICT (key) DO UPDATE
  SET
    value = EXCLUDED.value,
    category = EXCLUDED.category,
    data_type = EXCLUDED.data_type,
    is_secret = EXCLUDED.is_secret,
    is_active = EXCLUDED.is_active,
    updated_at = NOW(),
    -- Never wipe the recorded editor when p_admin_id is absent (e.g. a 6-arg
    -- legacy/system caller). COALESCE keeps the previous editor intact.
    updated_by = COALESCE(p_admin_id, admin_config.updated_by)
  RETURNING
    admin_config.id,
    admin_config.key,
    admin_config.value,
    admin_config.category,
    admin_config.data_type,
    admin_config.is_secret,
    admin_config.is_active,
    admin_config.updated_at,
    admin_config.updated_by;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_admin_config_setting(
  text, text, public.admin_config_category, text, boolean, boolean, uuid
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.upsert_admin_config_setting IS
'Single-source admin_config upsert (SECURITY DEFINER). p_admin_id (7th arg) records admin_config.updated_by so every editing surface shows the same "last updated by" editor.';

-- ============================================================================
-- BLOCK 2: fn_get_admin_config_meta (read values + last-updated + editor)
-- ============================================================================
-- Mirrors fn_get_admin_config_values (active-only filter) but also returns
-- updated_at / updated_by / editor email so standalone settings pages can show
-- the identical "Last updated" metadata the /config hub shows.

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
    au.email
  FROM public.admin_config ac
  LEFT JOIN auth.users au ON au.id = ac.updated_by
  WHERE ac.key = ANY (p_keys)
    AND ac.is_active = TRUE
  ORDER BY ac.key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_admin_config_meta(TEXT[]) TO anon, authenticated, service_role;

-- ============================================================================
-- BLOCK 3: fn_resolve_admin_emails (user_id -> email map for editor labels)
-- ============================================================================

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
  SELECT au.id, au.email
  FROM auth.users au
  WHERE au.id = ANY (p_user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_resolve_admin_emails(UUID[]) TO anon, authenticated, service_role;

-- ============================================================================
-- Verification (run one statement at a time)
--   SELECT * FROM public.fn_get_admin_config_meta(ARRAY['sales_tax_enabled','cart_min_value_cents']);
--   SELECT * FROM public.fn_resolve_admin_emails(ARRAY[(SELECT updated_by FROM public.admin_config WHERE updated_by IS NOT NULL LIMIT 1)]);
--   SELECT proname, pg_get_function_arguments(oid) FROM pg_proc
--   WHERE proname IN ('upsert_admin_config_setting','fn_get_admin_config_meta','fn_resolve_admin_emails') ORDER BY proname;
-- ============================================================================
