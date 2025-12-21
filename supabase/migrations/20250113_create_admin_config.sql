-- Migration: Create admin_config table in PRODUCTION Supabase
-- This table stores dynamic configuration values that admins can adjust
-- Created via supabase/migrations for version control & consistency across environments

-- Create enum for config categories
CREATE TYPE admin_config_category AS ENUM (
  'subscription',
  'swap_points',
  'fees',
  'sms',
  'email',
  'moderation',
  'safety',
  'analytics',
  'feature_flags'
);

-- Create admin_config table
CREATE TABLE admin_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  category admin_config_category NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  is_secret BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  
  -- Constraints
  CONSTRAINT valid_data_type CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
  CONSTRAINT valid_key_format CHECK (key ~ '^[a-z0-9_]+$')
);

-- Create indexes
CREATE INDEX idx_admin_config_key ON admin_config(key);
CREATE INDEX idx_admin_config_category ON admin_config(category);
CREATE INDEX idx_admin_config_is_active ON admin_config(is_active);

-- Enable RLS
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public SELECT (anyone can read config)
CREATE POLICY admin_config_select_all ON admin_config
  FOR SELECT
  USING (TRUE);

-- RLS Policy: Service role only for UPDATE/DELETE
CREATE POLICY admin_config_update_service_role ON admin_config
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY admin_config_delete_service_role ON admin_config
  FOR DELETE
  USING (auth.role() = 'service_role');

CREATE POLICY admin_config_insert_service_role ON admin_config
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Seed configuration values (36 settings across 9 categories)
INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active) VALUES
-- Subscription Settings (5 settings)
('subscription_price_monthly', '7.99', 'Monthly subscription price in USD', 'subscription', 'number', FALSE, TRUE),
('subscription_price_yearly', '79.99', 'Annual subscription price in USD (12% discount)', 'subscription', 'number', FALSE, TRUE),
('trial_period_days', '30', 'Trial period duration in days', 'subscription', 'number', FALSE, TRUE),
('trial_enabled', 'true', 'Enable free trial for new subscribers', 'subscription', 'boolean', FALSE, TRUE),
('grace_period_days', '90', 'Grace period after subscription cancellation (SP frozen)', 'subscription', 'number', FALSE, TRUE),

-- Swap Points Settings (7 settings)
('sp_earn_multiplier', '1.0', 'Multiplier for SP earned per $1 spent by buyer', 'swap_points', 'number', FALSE, TRUE),
('sp_max_percentage_per_purchase', '50', 'Max % of item price payable with SP (0-100)', 'swap_points', 'number', FALSE, TRUE),
('sp_pending_days', '3', 'Days SP stays pending before release (cancelable on return)', 'swap_points', 'number', FALSE, TRUE),
('sp_expiration_days', '90', 'Days until SP expires if inactive', 'swap_points', 'number', FALSE, TRUE),
('sp_min_balance_for_redemption', '100', 'Minimum SP balance required to spend', 'swap_points', 'number', FALSE, TRUE),
('sp_redemption_multiplier', '1.0', 'Exchange rate: 1 SP = X cents in discount', 'swap_points', 'number', FALSE, TRUE),
('sp_subscriber_only', 'true', 'Only Kids Club+ subscribers can earn/spend SP', 'swap_points', 'boolean', FALSE, TRUE),

-- Fee Settings (8 settings)
('platform_fee_buyer_fixed_cents', '25', 'Fixed buyer fee in cents ($0.25)', 'fees', 'number', FALSE, TRUE),
('platform_fee_buyer_percentage', '2.5', 'Buyer fee as % of item price', 'fees', 'number', FALSE, TRUE),
('platform_fee_seller_percentage', '5', 'Seller fee as % of item price', 'fees', 'number', FALSE, TRUE),
('platform_fee_seller_discount_percentage_freemium', '0', 'Seller fee discount for free users (%)', 'fees', 'number', FALSE, TRUE),
('platform_fee_seller_discount_percentage_kids_club_plus', '0', 'Seller fee discount for Kids Club+ (%)', 'fees', 'number', FALSE, TRUE),
('stripe_transaction_fee_percentage', '2.9', 'Stripe transaction fee (%)', 'fees', 'number', FALSE, TRUE),
('stripe_transaction_fee_fixed_cents', '30', 'Stripe transaction fee (fixed cents)', 'fees', 'number', FALSE, TRUE),
('min_transaction_amount_cents', '100', 'Minimum transaction amount in cents ($1.00)', 'fees', 'number', FALSE, TRUE),

-- SMS Settings (3 settings)
('twilio_enabled', 'true', 'Enable SMS verification via Twilio', 'sms', 'boolean', FALSE, TRUE),
('sms_verification_timeout_minutes', '10', 'SMS verification code expiration in minutes', 'sms', 'number', FALSE, TRUE),
('sms_daily_limit_per_user', '5', 'Max SMS verification attempts per user per day', 'sms', 'number', FALSE, TRUE),

-- Email Settings (2 settings)
('sendgrid_enabled', 'true', 'Enable transactional emails via SendGrid', 'email', 'boolean', FALSE, TRUE),
('email_from_address', 'noreply@kidsp2p.com', 'Sender email address for transactional emails', 'email', 'string', FALSE, TRUE),

-- Moderation Settings (3 settings)
('moderation_ai_enabled', 'true', 'Enable AI content moderation', 'moderation', 'boolean', FALSE, TRUE),
('moderation_human_review_threshold', 'medium', 'Trigger human review for: low/medium/high risk items', 'moderation', 'string', FALSE, TRUE),
('moderation_auto_reject_high_risk', 'false', 'Auto-reject high-risk items without review', 'moderation', 'boolean', FALSE, TRUE),

-- Safety Settings (2 settings)
('cpsc_recall_check_enabled', 'true', 'Enable CPSC product recall checking', 'safety', 'boolean', FALSE, TRUE),
('prohibited_items_check_enabled', 'true', 'Enable prohibited items list checking', 'safety', 'boolean', FALSE, TRUE),

-- Analytics Settings (2 settings)
('firebase_analytics_enabled', 'true', 'Enable Firebase analytics event tracking', 'analytics', 'boolean', FALSE, TRUE),
('analytics_user_session_tracking', 'true', 'Track detailed user session analytics', 'analytics', 'boolean', FALSE, TRUE),

-- Feature Flags (3 settings)
('feature_flag_sp_redemption_enabled', 'true', 'Enable Swap Points redemption feature', 'feature_flags', 'boolean', FALSE, TRUE),
('feature_flag_referral_program_enabled', 'false', 'Enable referral program (future feature)', 'feature_flags', 'boolean', FALSE, TRUE),
('feature_flag_bundle_purchases_enabled', 'false', 'Enable purchasing multiple items at once', 'feature_flags', 'boolean', FALSE, TRUE);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_config_updated_at_trigger
BEFORE UPDATE ON admin_config
FOR EACH ROW
EXECUTE FUNCTION update_admin_config_timestamp();

-- Add comments for documentation
COMMENT ON TABLE admin_config IS 'Dynamic configuration table managed by admin portal. Read by client apps and Edge Functions.';
COMMENT ON COLUMN admin_config.key IS 'Unique configuration key (e.g., "subscription_price_monthly")';
COMMENT ON COLUMN admin_config.value IS 'Configuration value (stored as text, interpreted based on data_type)';
COMMENT ON COLUMN admin_config.data_type IS 'Type hint for parsing value: string, number, boolean, json';
COMMENT ON COLUMN admin_config.is_secret IS 'If true, value should not be exposed to client apps (server-only)';
COMMENT ON COLUMN admin_config.is_active IS 'Toggle to disable configuration without deleting it';
