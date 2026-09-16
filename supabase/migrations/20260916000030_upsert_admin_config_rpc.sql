-- Migration: Create RPC function for admin_config upsert
-- Purpose: Atomically upsert admin_config records to avoid duplicate key conflicts

-- Drop existing function if it exists (using CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS upsert_admin_config_setting(text, text, admin_config_category, text, boolean, boolean) CASCADE;

-- Create the upsert function
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
) AS $$
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
$$ LANGUAGE plpgsql;

-- Grant execute to anon and authenticated users
GRANT EXECUTE ON FUNCTION upsert_admin_config_setting(text, text, admin_config_category, text, boolean, boolean) TO anon, authenticated;
