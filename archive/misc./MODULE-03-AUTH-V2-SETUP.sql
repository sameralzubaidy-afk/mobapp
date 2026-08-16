-- MODULE-03 AUTH-V2: Complete SQL Setup for Supabase
-- Run this entire script in Supabase SQL Editor
-- Date: December 16, 2025
-- =========================================================================

-- =========================================================================
-- PART 1: CREATE SUBSCRIPTIONS TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'trial', 'active', 'grace', 'canceled')),
  
  -- Trial info
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  
  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  
  -- Payment info
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own subscription
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Users can insert their own subscription
DROP POLICY IF EXISTS "Users can insert own subscription" ON subscriptions;
CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at_trigger ON subscriptions;
CREATE TRIGGER subscriptions_updated_at_trigger
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- =========================================================================
-- PART 2: CREATE SP_WALLETS TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS sp_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended')),
  
  -- Balance tracking
  available_balance INTEGER NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance INTEGER NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  lifetime_spent INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0),
  
  -- Timestamps
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp_wallets_user_id ON sp_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_wallets_status ON sp_wallets(status);

-- Enable RLS
ALTER TABLE sp_wallets ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own wallet
DROP POLICY IF EXISTS "Users can view own wallet" ON sp_wallets;
CREATE POLICY "Users can view own wallet"
  ON sp_wallets FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Users can insert their own wallet
DROP POLICY IF EXISTS "Users can insert own wallet" ON sp_wallets;
CREATE POLICY "Users can insert own wallet"
  ON sp_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sp_wallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sp_wallets_updated_at_trigger ON sp_wallets;
CREATE TRIGGER sp_wallets_updated_at_trigger
  BEFORE UPDATE ON sp_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_sp_wallets_updated_at();

-- =========================================================================
-- PART 3: ADD V2 FIELDS TO PROFILES TABLE
-- =========================================================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sp_wallet_id UUID REFERENCES sp_wallets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS parental_consent_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age >= 5 AND age <= 17);

-- Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id ON profiles(subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_sp_wallet_id ON profiles(sp_wallet_id);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed_at ON profiles(onboarding_completed_at);

-- =========================================================================
-- PART 4: RPC FUNCTIONS
-- =========================================================================

-- RPC: create_trial_subscription
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

  -- Get trial duration from admin config (or use default 30)
  v_trial_duration := COALESCE((
    SELECT (config_value ->> 'duration_days')::INTEGER 
    FROM admin_config 
    WHERE config_key = 'trial_subscription' AND enabled = TRUE
  ), 30);

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
    NULL,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

-- RPC: initialize_sp_wallet
CREATE OR REPLACE FUNCTION initialize_sp_wallet(p_user_id UUID)
RETURNS sp_wallets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet sp_wallets;
BEGIN
  -- Check if wallet already exists
  SELECT * INTO v_wallet FROM sp_wallets WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'SP wallet already exists for user %', p_user_id;
  END IF;

  -- Create SP wallet with zero balance
  INSERT INTO sp_wallets (
    user_id,
    status,
    available_balance,
    pending_balance,
    lifetime_earned,
    lifetime_spent,
    last_activity_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'active',
    0,
    0,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING * INTO v_wallet;

  RETURN v_wallet;
END;
$$;

-- RPC: get_subscription_summary
CREATE OR REPLACE FUNCTION get_subscription_summary(p_user_id UUID)
RETURNS TABLE (
  status TEXT,
  can_spend_sp BOOLEAN,
  trial_end_date TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.status,
    CASE 
      WHEN s.status IN ('trial', 'active') THEN TRUE
      ELSE FALSE
    END AS can_spend_sp,
    s.trial_end_date,
    s.current_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id;
END;
$$;

-- RPC: get_user_sp_wallet_summary
CREATE OR REPLACE FUNCTION get_user_sp_wallet_summary(p_user_id UUID)
RETURNS TABLE (
  available_points INTEGER,
  pending_points INTEGER,
  lifetime_earned INTEGER,
  lifetime_spent INTEGER,
  wallet_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.available_balance AS available_points,
    w.pending_balance AS pending_points,
    w.lifetime_earned,
    w.lifetime_spent,
    w.status AS wallet_status
  FROM sp_wallets w
  WHERE w.user_id = p_user_id;
END;
$$;

-- RPC: is_trial_enabled
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

-- RPC: get_trial_duration_days
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
    RETURN 30;
  END IF;

  duration := (trial_config ->> 'duration_days')::INTEGER;
  RETURN COALESCE(duration, 30);
END;
$$;

-- =========================================================================
-- PART 5: ADMIN_CONFIG TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_config_key ON admin_config(config_key);
CREATE INDEX IF NOT EXISTS idx_admin_config_enabled ON admin_config(enabled);

-- Enable RLS
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can view/update (for now, allow authenticated users to view)
DROP POLICY IF EXISTS "Admins can view config" ON admin_config;
CREATE POLICY "Admins can view config"
  ON admin_config FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' IS NOT NULL);

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

-- =========================================================================
-- PART 6: INSERT DEFAULT ADMIN CONFIGURATIONS
-- =========================================================================

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
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

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
    "expiry_days": 90
  }'::JSONB,
  'Configuration for Swap Points system',
  TRUE
)
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Feature flags
INSERT INTO admin_config (config_key, config_value, description, enabled)
VALUES (
  'feature_flags',
  '{
    "apple_signin": true,
    "google_signin": true,
    "social_sharing": false,
    "referral_program": true,
    "donation_mode": true
  }'::JSONB,
  'Feature toggles for the marketplace',
  TRUE
)
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- =========================================================================
-- PART 7: VERIFICATION QUERIES (Run these to confirm setup)
-- =========================================================================

-- Check tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema='public' AND table_name IN ('subscriptions', 'sp_wallets', 'admin_config');

-- Check functions exist
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema='public' AND routine_type='FUNCTION';

-- Check admin_config data
-- SELECT config_key, config_value, enabled FROM admin_config;

-- =========================================================================
-- ✅ SETUP COMPLETE
-- =========================================================================
-- Tables created: subscriptions, sp_wallets, admin_config
-- Functions created: create_trial_subscription, initialize_sp_wallet, 
--                    get_subscription_summary, get_user_sp_wallet_summary,
--                    is_trial_enabled, get_trial_duration_days
-- Default configs inserted: trial_subscription (enabled, 30 days), 
--                           swap_points_config, feature_flags
