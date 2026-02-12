-- File: supabase/migrations/20260212000000_subscription_tiers.sql
-- MODULE-11 SUB-001: Kids Club+ Subscription Tier Schema
-- Creates subscription tier configuration with Kids Club+ as the single MVP tier

-- =============================================================================
-- 0. UTILITY FUNCTIONS
-- =============================================================================

-- Ensure update_timestamp function exists
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. CREATE OR UPGRADE SUBSCRIPTION_TIERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add/Update columns to match V2 Schema
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS price_cents INTEGER DEFAULT 0;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd';
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE public.subscription_tiers ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Update defaults and constraints for existing columns if they were null
UPDATE public.subscription_tiers SET display_name = name WHERE display_name IS NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN price_cents SET NOT NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN trial_days SET NOT NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN grace_period_days SET NOT NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN is_default SET NOT NULL;
ALTER TABLE public.subscription_tiers ALTER COLUMN sort_order SET NOT NULL;

-- Add check constraints safely
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_cents_non_negative') THEN
    ALTER TABLE public.subscription_tiers ADD CONSTRAINT price_cents_non_negative CHECK (price_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trial_days_non_negative') THEN
    ALTER TABLE public.subscription_tiers ADD CONSTRAINT trial_days_non_negative CHECK (trial_days >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grace_period_days_non_negative') THEN
    ALTER TABLE public.subscription_tiers ADD CONSTRAINT grace_period_days_non_negative CHECK (grace_period_days >= 0);
  END IF;
  
  -- Add unique constraint to stripe_price_id if it doesn't have one
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_tiers_stripe_price_id_key') THEN
    ALTER TABLE public.subscription_tiers ADD CONSTRAINT subscription_tiers_stripe_price_id_key UNIQUE (stripe_price_id);
  END IF;
END $$;

-- =============================================================================
-- 2. CREATE SUBSCRIPTION_FEATURES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to tier
  tier_id UUID NOT NULL REFERENCES public.subscription_tiers(id) ON DELETE CASCADE,
  
  -- Feature definition
  feature_key TEXT NOT NULL,                    -- Programmatic key (e.g., 'can_earn_sp')
  feature_name TEXT NOT NULL,                   -- User-facing name (e.g., 'Earn Swap Points')
  feature_description TEXT,                     -- Marketing copy for this feature
  
  -- Feature state
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,     -- Is this feature active for this tier?
  sort_order INTEGER NOT NULL DEFAULT 0,        -- Display order in benefits list
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique feature keys per tier
  UNIQUE(tier_id, feature_key)
);

-- Ensure columns exist for features table
ALTER TABLE public.subscription_features ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.subscription_features ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.subscription_features ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.subscription_features ALTER COLUMN updated_at SET NOT NULL;

-- =============================================================================
-- 3. CREATE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_subscription_tiers_is_active ON public.subscription_tiers(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_is_default ON public.subscription_tiers(is_default);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_name ON public.subscription_tiers(name);

CREATE INDEX IF NOT EXISTS idx_subscription_features_tier_id ON public.subscription_features(tier_id);
CREATE INDEX IF NOT EXISTS idx_subscription_features_is_enabled ON public.subscription_features(is_enabled);

-- =============================================================================
-- 4. CREATE TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =============================================================================

-- Trigger for subscription_tiers.updated_at
DROP TRIGGER IF EXISTS update_subscription_tiers_updated_at ON public.subscription_tiers;
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON public.subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- Trigger for subscription_features.updated_at
DROP TRIGGER IF EXISTS update_subscription_features_updated_at ON public.subscription_features;
CREATE TRIGGER update_subscription_features_updated_at
  BEFORE UPDATE ON public.subscription_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- =============================================================================
-- 5. SEED KIDS CLUB+ TIER
-- =============================================================================

INSERT INTO public.subscription_tiers (
  name,
  display_name,
  description,
  price_cents,
  currency,
  trial_days,
  grace_period_days,
  stripe_price_id,
  is_active,
  is_default,
  sort_order
) VALUES (
  'kids_club_plus',
  'Kids Club+',
  'Join Kids Club+ to unlock Swap Points, reduced fees, and exclusive benefits!',
  499,                    -- $4.99/month
  'usd',
  30,                     -- 30-day free trial
  90,                     -- 90-day grace period after cancellation
  NULL,                   -- Stripe Price ID to be configured in admin panel
  TRUE,                   -- Active tier
  TRUE,                   -- Default tier (only tier for MVP)
  1                       -- Sort order
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  trial_days = EXCLUDED.trial_days,
  grace_period_days = EXCLUDED.grace_period_days,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

-- =============================================================================
-- 6. SEED KIDS CLUB+ FEATURES
-- =============================================================================

INSERT INTO public.subscription_features (
  tier_id,
  feature_key,
  feature_name,
  feature_description,
  is_enabled,
  sort_order
)
SELECT 
  st.id,
  f.feature_key,
  f.feature_name,
  f.feature_description,
  f.is_enabled,
  f.sort_order
FROM public.subscription_tiers st, (VALUES
  ('can_earn_sp', 'Earn Swap Points', 'Earn points on every successful trade', TRUE, 1),
  ('can_spend_sp', 'Spend Swap Points', 'Use points to reduce purchase prices', TRUE, 2),
  ('can_donate', 'Donate Items', 'Donate items for community impact', TRUE, 3),
  ('reduced_fee', 'Reduced Fees', 'Only $0.99 transaction fee (vs $2.99 for free users)', TRUE, 4),
  ('priority_matching', 'Priority Matching', 'Your listings appear higher in search results', TRUE, 5),
  ('early_access', 'Early Access', 'Be first to see new features', TRUE, 6),
  ('priority_support', 'Priority Support', 'Get faster help when you need it', TRUE, 7)
) AS f(feature_key, feature_name, feature_description, is_enabled, sort_order)
WHERE st.name = 'kids_club_plus'
ON CONFLICT (tier_id, feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  feature_description = EXCLUDED.feature_description,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- =============================================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_features ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 8. CREATE RLS POLICIES
-- =============================================================================

-- SUBSCRIPTION_TIERS: Anyone can view active tiers (for pricing/marketing display)
DROP POLICY IF EXISTS "subscription_tiers_select_public" ON public.subscription_tiers;
CREATE POLICY "subscription_tiers_select_public"
  ON public.subscription_tiers FOR SELECT
  TO authenticated, anon
  USING (is_active = TRUE);

-- SUBSCRIPTION_TIERS: Only admins can modify tiers
DROP POLICY IF EXISTS "subscription_tiers_admin_all" ON public.subscription_tiers;
CREATE POLICY "subscription_tiers_admin_all"
  ON public.subscription_tiers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.role_based_access_control rbac
      WHERE rbac.user_id = auth.uid()
      AND rbac.role = 'admin'
    )
  );

-- SUBSCRIPTION_FEATURES: Anyone can view enabled features for active tiers
DROP POLICY IF EXISTS "subscription_features_select_public" ON public.subscription_features;
CREATE POLICY "subscription_features_select_public"
  ON public.subscription_features FOR SELECT
  TO authenticated, anon
  USING (
    is_enabled = TRUE
    AND EXISTS (
      SELECT 1 FROM public.subscription_tiers
      WHERE subscription_tiers.id = subscription_features.tier_id
      AND subscription_tiers.is_active = TRUE
    )
  );

-- SUBSCRIPTION_FEATURES: Only admins can modify features
DROP POLICY IF EXISTS "subscription_features_admin_all" ON public.subscription_features;
CREATE POLICY "subscription_features_admin_all"
  ON public.subscription_features FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.role_based_access_control rbac
      WHERE rbac.user_id = auth.uid()
      AND rbac.role = 'admin'
    )
  );

-- =============================================================================
-- 9. ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.subscription_tiers IS 'MODULE-11 SUB-001: Subscription tier configuration (Kids Club+ is the MVP tier)';
COMMENT ON TABLE public.subscription_features IS 'MODULE-11 SUB-001: Feature flags and benefits for each subscription tier';

COMMENT ON COLUMN public.subscription_tiers.name IS 'Unique internal identifier for programmatic access';
COMMENT ON COLUMN public.subscription_tiers.display_name IS 'User-facing tier name shown in UI';
COMMENT ON COLUMN public.subscription_tiers.price_cents IS 'Monthly price in cents (e.g., 499 = $4.99)';
COMMENT ON COLUMN public.subscription_tiers.trial_days IS 'Number of days for free trial period';
COMMENT ON COLUMN public.subscription_tiers.grace_period_days IS 'Days before SP expiration after cancellation';
COMMENT ON COLUMN public.subscription_tiers.stripe_price_id IS 'Stripe Price ID for Stripe billing integration';

COMMENT ON COLUMN public.subscription_features.feature_key IS 'Programmatic key for feature checks (e.g., can_earn_sp)';
COMMENT ON COLUMN public.subscription_features.feature_name IS 'User-facing feature name for marketing display';
