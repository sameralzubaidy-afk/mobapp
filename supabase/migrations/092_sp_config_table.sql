-- File: supabase/migrations/092_sp_config_table.sql
-- MODULE-09 SP-001: SP Configuration Table
-- Mode: Idempotent rerunnable migration
-- Purpose: Admin-configurable SP settings for earning, spending, expiration

-- =============================================================================
-- 1. CREATE SP_CONFIG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Config identification
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('number', 'boolean', 'string', 'json')),
  
  -- Metadata
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  
  -- Audit
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp_config_category ON sp_config(category);

-- Enable RLS
ALTER TABLE sp_config ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read SP config
DROP POLICY IF EXISTS "Anyone can read SP config" ON sp_config;
CREATE POLICY "Anyone can read SP config"
  ON sp_config FOR SELECT
  USING (true);

-- RLS: Only admins can modify SP config
DROP POLICY IF EXISTS "Admins can modify SP config" ON sp_config;
CREATE POLICY "Admins can modify SP config"
  ON sp_config FOR ALL
  USING (EXISTS (
    SELECT 1 FROM role_based_access_control WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- =============================================================================
-- 2. SEED DEFAULT SP CONFIGURATION
-- =============================================================================

INSERT INTO sp_config (config_key, config_value, value_type, description, category) VALUES
  -- Starter Pack
  ('starter_pack_enabled', 'true', 'boolean', 'Enable SP starter pack for new subscribers', 'starter_pack'),
  ('starter_pack_amount', '10', 'number', 'SP amount for starter pack', 'starter_pack'),
  ('starter_pack_requires_listing', 'true', 'boolean', 'Require first listing approval before issuing starter pack', 'starter_pack'),
  
  -- Expiration Settings
  ('expiration_enabled', 'true', 'boolean', 'Enable SP expiration', 'expiration'),
  ('expiration_period_days', '365', 'number', 'Days until SP expires from issuance', 'expiration'),
  ('expiration_trigger', '"issuance_date"', 'string', 'Trigger type: issuance_date, last_activity, subscription_cancel', 'expiration'),
  ('grace_period_days', '90', 'number', 'Days after expiration before SP is permanently deleted', 'expiration'),
  
  -- Expiration Warnings
  ('expiration_warning_days', '[30, 14, 7]', 'json', 'Days before expiration to send warnings', 'expiration'),
  
  -- Spending Rules
  ('sp_can_pay_buyer_fee', 'true', 'boolean', 'Allow SP to pay buyer protection fee', 'spending'),
  ('sp_can_pay_seller_fee', 'true', 'boolean', 'Allow SP to pay seller commission', 'spending'),
  ('sp_can_pay_delivery', 'false', 'boolean', 'Allow SP to pay delivery fee (real-world cost)', 'spending'),
  ('sp_minimum_spend', '0', 'number', 'Minimum SP amount per transaction (0 = no minimum)', 'spending'),
  
  -- Gamification Toggles
  ('show_progress_bars', 'true', 'boolean', 'Show progress bars in UI', 'gamification'),
  ('show_badges', 'true', 'boolean', 'Show badges on profiles', 'gamification'),
  ('show_celebrations', 'true', 'boolean', 'Show celebration animations on SP earn', 'gamification'),
  ('show_sp_counter', 'true', 'boolean', 'Show persistent SP balance counter', 'gamification')
ON CONFLICT (config_key) DO NOTHING;

-- =============================================================================
-- 3. HELPER FUNCTIONS
-- =============================================================================

-- Get SP config value
CREATE OR REPLACE FUNCTION get_sp_config(p_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT config_value INTO v_value
  FROM sp_config
  WHERE config_key = p_key;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update SP config value (admin only)
CREATE OR REPLACE FUNCTION update_sp_config(
  p_key TEXT,
  p_value JSONB,
  p_admin_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verify admin role
  SELECT EXISTS (
    SELECT 1 FROM role_based_access_control WHERE user_id = p_admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  -- Update config
  UPDATE sp_config
  SET 
    config_value = p_value,
    updated_by = p_admin_id,
    updated_at = NOW()
  WHERE config_key = p_key;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Query 1: Verify table exists
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'sp_config';
--
-- Query 2: Verify config values seeded
-- SELECT config_key, config_value, category FROM sp_config ORDER BY category, config_key;
--
-- Query 3: Test get_sp_config function
-- SELECT get_sp_config('starter_pack_amount');
-- Expected: "10"
