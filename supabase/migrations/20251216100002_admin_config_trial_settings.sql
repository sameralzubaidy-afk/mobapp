-- File: supabase/migrations/20251216100002_admin_config_trial_settings.sql
-- MODULE-12 ADMIN: Admin configuration table for trial period and feature toggles

-- =============================================================================
-- 1. CREATE admin_config TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_config_key ON admin_config(config_key);
CREATE INDEX IF NOT EXISTS idx_admin_config_enabled ON admin_config(enabled);

-- Enable RLS
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can view and update config
-- NOTE: Admin role check should be done via auth.jwt() -> role = 'admin'
DROP POLICY IF EXISTS "Admins can view config" ON admin_config;
CREATE POLICY "Admins can view config"
  ON admin_config FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Admins can update config" ON admin_config;
CREATE POLICY "Admins can update config"
  ON admin_config FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_admin_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_config_updated_at_trigger ON admin_config;
CREATE TRIGGER admin_config_updated_at_trigger
  BEFORE UPDATE ON admin_config
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_config_updated_at();

-- =============================================================================
-- 2. INSERT DEFAULT ADMIN CONFIGURATIONS
-- =============================================================================

-- Trial period configuration
INSERT INTO admin_config (config_key, config_value, description, enabled)
VALUES (
  'trial_subscription',
  '{
    "enabled": true,
    "duration_days": 30,
    "description": "30-day no-card trial for new Kids Club+ subscribers"
  }'::JSONB,
  'Configuration for trial subscription enrollment',
  TRUE
)
ON CONFLICT (config_key) DO NOTHING;

-- SP (Swap Points) configuration
INSERT INTO admin_config (config_key, config_value, description, enabled)
VALUES (
  'swap_points_config',
  '{
    "enabled": true,
    "earning_enabled": true,
    "spending_enabled": true,
    "max_percent_payment": 50,
    "pending_days": 3,
    "expiry_days": 90,
    "description": "Swap Points configuration for marketplace"
  }'::JSONB,
  'Configuration for Swap Points system',
  TRUE
)
ON CONFLICT (config_key) DO NOTHING;

-- Feature flags
INSERT INTO admin_config (config_key, config_value, description, enabled)
VALUES (
  'feature_flags',
  '{
    "apple_signin": true,
    "google_signin": true,
    "social_sharing": false,
    "referral_program": true,
    "donation_mode": true,
    "description": "Feature toggles for the marketplace"
  }'::JSONB,
  'Feature flags and toggles',
  TRUE
)
ON CONFLICT (config_key) DO NOTHING;

-- =============================================================================
-- 3. CREATE RPC: Get admin config
-- =============================================================================

CREATE OR REPLACE FUNCTION get_admin_config(p_config_key TEXT)
RETURNS TABLE (config_value JSONB, enabled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.config_value,
    ac.enabled
  FROM admin_config ac
  WHERE ac.config_key = p_config_key
    AND ac.enabled = TRUE;
END;
$$;

COMMENT ON FUNCTION get_admin_config IS 'MODULE-12: Retrieve admin configuration by key';

-- =============================================================================
-- 4. CREATE RPC: Check if trial is enabled
-- =============================================================================

CREATE OR REPLACE FUNCTION is_trial_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_config JSONB;
  is_enabled BOOLEAN;
BEGIN
  SELECT config_value INTO trial_config
  FROM admin_config
  WHERE config_key = 'trial_subscription'
    AND enabled = TRUE;

  IF trial_config IS NULL THEN
    RETURN FALSE;
  END IF;

  is_enabled := (trial_config ->> 'enabled')::BOOLEAN;
  RETURN COALESCE(is_enabled, FALSE);
END;
$$;

COMMENT ON FUNCTION is_trial_enabled IS 'MODULE-12: Check if trial subscription enrollment is enabled';

-- =============================================================================
-- 5. CREATE RPC: Get trial duration days
-- =============================================================================

CREATE OR REPLACE FUNCTION get_trial_duration_days()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_config JSONB;
  duration INTEGER;
BEGIN
  SELECT config_value INTO trial_config
  FROM admin_config
  WHERE config_key = 'trial_subscription'
    AND enabled = TRUE;

  IF trial_config IS NULL THEN
    RETURN 30; -- Default 30 days
  END IF;

  duration := (trial_config ->> 'duration_days')::INTEGER;
  RETURN COALESCE(duration, 30);
END;
$$;

COMMENT ON FUNCTION get_trial_duration_days IS 'MODULE-12: Get configured trial duration in days';

-- =============================================================================
-- 6. UPDATE create_trial_subscription RPC TO USE CONFIG
-- =============================================================================

CREATE OR REPLACE FUNCTION create_trial_subscription(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions;
  v_trial_duration INTEGER;
BEGIN
  -- Check if subscription already exists
  SELECT * INTO v_subscription FROM subscriptions WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Subscription already exists for user %', p_user_id;
  END IF;

  -- Get trial duration from admin config
  v_trial_duration := get_trial_duration_days();

  -- Create trial subscription with configured duration
  INSERT INTO subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    stripe_customer_id,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'trial',
    NOW(),
    NOW() + (v_trial_duration || ' days')::INTERVAL,
    NULL, -- No Stripe customer during no-card trial
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

COMMENT ON FUNCTION create_trial_subscription IS 'MODULE-03/MODULE-12: Creates trial subscription with admin-configured duration';
