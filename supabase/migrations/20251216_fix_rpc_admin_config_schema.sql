-- File: supabase/migrations/20251216_fix_rpc_admin_config_schema.sql
-- Fix RPC functions to use new admin_config schema

-- =============================================================================
-- 1. Update is_trial_enabled() to use new schema
-- =============================================================================

CREATE OR REPLACE FUNCTION is_trial_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_enabled_value TEXT;
BEGIN
  SELECT value INTO trial_enabled_value
  FROM admin_config
  WHERE key = 'trial_enabled'
    AND is_active = TRUE;

  -- Return TRUE if value is 'true' or '1'
  RETURN COALESCE(trial_enabled_value = 'true', FALSE);
END;
$$;

COMMENT ON FUNCTION is_trial_enabled IS 'MODULE-12: Check if trial subscription enrollment is enabled (V2 schema)';

-- =============================================================================
-- 2. Update get_trial_duration_days() to use new schema
-- =============================================================================

CREATE OR REPLACE FUNCTION get_trial_duration_days()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  duration_value TEXT;
  duration INTEGER;
BEGIN
  SELECT value INTO duration_value
  FROM admin_config
  WHERE key = 'trial_period_days'
    AND is_active = TRUE;

  -- Default to 30 days if not found
  IF duration_value IS NULL THEN
    RETURN 30;
  END IF;

  -- Convert value to integer
  duration := duration_value::INTEGER;
  RETURN COALESCE(duration, 30);
END;
$$;

COMMENT ON FUNCTION get_trial_duration_days IS 'MODULE-12: Get configured trial duration in days (V2 schema)';

-- =============================================================================
-- 3. Test the functions
-- =============================================================================

-- Verify is_trial_enabled returns TRUE
-- SELECT is_trial_enabled();

-- Verify get_trial_duration_days returns 30
-- SELECT get_trial_duration_days();
