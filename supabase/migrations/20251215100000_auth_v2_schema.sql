-- File: supabase/migrations/20251215100000_auth_v2_schema.sql
-- MODULE-03 AUTH-V2-001: User Schema & Authentication Types (V2)
-- Adds subscription and SP wallet linkage to profiles table

-- =============================================================================
-- 1. CREATE SUBSCRIPTIONS TABLE (for MODULE-11 integration)
-- =============================================================================

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

-- =============================================================================
-- 2. CREATE SP_WALLETS TABLE (for MODULE-09 integration)
-- =============================================================================

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

-- =============================================================================
-- 3. ADD V2 FIELDS TO PROFILES TABLE
-- =============================================================================

-- Add subscription and wallet linkage columns
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

-- Add comments for documentation
COMMENT ON COLUMN profiles.subscription_id IS 'V2: Link to active subscription record (MODULE-11)';
COMMENT ON COLUMN profiles.sp_wallet_id IS 'V2: Link to Swap Points wallet record (MODULE-09)';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'V2: Timestamp when user completed onboarding wizard';
COMMENT ON COLUMN profiles.parental_consent_verified IS 'V2: COPPA compliance - parental consent for users under 13';
COMMENT ON COLUMN profiles.age IS 'V2: User age for COPPA compliance (5-17 years old for kids marketplace)';
