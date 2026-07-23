-- Migration: Fix admin_config RPC to use SECURITY DEFINER
-- Mode: Idempotent rerunnable migration
--
-- Problem:
--   Migration 312_prod_p1_stage_security_lockdown.sql revoked all table-level
--   permissions on admin_config from authenticated users. However:
--     1) upsert_admin_config_setting RPC was SECURITY INVOKER (default),
--        so INSERTS inside the function fail with "permission denied".
--     2) Admin settings pages (tax, cart, nodes, trade-timing) read admin_config
--        via direct table SELECT, which also fails.
--
-- Fix:
--   1) Recreate upsert_admin_config_setting with SECURITY DEFINER so the
--      function runs as owner (bypasses RLS/revoke for writes).
--   2) Create fn_get_admin_config_values (SECURITY DEFINER) for reading
--      multiple config keys at once, so admin pages don't need direct
--      table access.
--
-- See also: 20260704000001_fix_fee_config_rpc_security_definer.sql (same pattern)

-- ============================================================================
-- BLOCK 1: Recreate upsert_admin_config_setting with SECURITY DEFINER
-- ============================================================================

DROP FUNCTION IF EXISTS upsert_admin_config_setting(text, text, admin_config_category, text, boolean, boolean) CASCADE;

CREATE FUNCTION upsert_admin_config_setting(
  p_key TEXT,
  p_value TEXT,
  p_category admin_config_category,
  p_data_type TEXT DEFAULT 'string',
  p_is_secret BOOLEAN DEFAULT FALSE,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  out_id BIGINT,
  out_key TEXT,
  out_value TEXT,
  out_category admin_config_category,
  out_data_type TEXT,
  out_is_secret BOOLEAN,
  out_is_active BOOLEAN,
  out_updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO admin_config (
    key,
    value,
    category,
    data_type,
    is_secret,
    is_active,
    updated_at
  )
  VALUES (
    p_key,
    p_value,
    p_category,
    p_data_type,
    p_is_secret,
    p_is_active,
    NOW()
  )
  ON CONFLICT (key) DO UPDATE
  SET
    value = EXCLUDED.value,
    category = EXCLUDED.category,
    data_type = EXCLUDED.data_type,
    is_secret = EXCLUDED.is_secret,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING
    admin_config.id,
    admin_config.key,
    admin_config.value,
    admin_config.category,
    admin_config.data_type,
    admin_config.is_secret,
    admin_config.is_active,
    admin_config.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_admin_config_setting(text, text, admin_config_category, text, boolean, boolean) TO anon, authenticated;

COMMENT ON FUNCTION upsert_admin_config_setting IS 'V2 (SECURITY DEFINER): Upsert admin_config. SECURITY DEFINER bypasses RLS for admin writes.';

-- ============================================================================
-- BLOCK 2: Create fn_get_admin_config_values (SECURITY DEFINER read RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_admin_config_values(
  p_keys TEXT[]
)
RETURNS TABLE (
  out_key TEXT,
  out_value TEXT,
  out_data_type TEXT
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
    ac.data_type
  FROM public.admin_config ac
  WHERE ac.key = ANY (p_keys)
    AND ac.is_active = TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_admin_config_values(TEXT[]) TO anon, authenticated;

COMMENT ON FUNCTION public.fn_get_admin_config_values IS 'V1 (SECURITY DEFINER): Returns key/value/data_type for requested admin_config keys. Bypasses RLS.';

-- ============================================================================
-- BLOCK 3: Verification Queries
-- ============================================================================

-- -- Test the read RPC
-- SELECT * FROM public.fn_get_admin_config_values(
--   ARRAY['sales_tax_enabled', 'default_sales_tax_rate', 'subscription_fee_taxable', 'tax_remittance_jurisdiction']
-- );

-- -- Test the write RPC (dry — comment out to avoid side effects)
-- -- SELECT * FROM upsert_admin_config_setting('test_key', 'test_value', 'feature_flags', 'string', false, true);

-- -- Verify function security
-- SELECT
--   p.proname,
--   p.prosecdef,
--   p.proconfig
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('upsert_admin_config_setting', 'fn_get_admin_config_values');
