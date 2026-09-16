-- Migration: Trial Extension System via Referrals
-- TASK: SUB-EXT-001
-- Allows users to extend their trial period by referring friends
-- Each successful referral adds 7 days (configurable), up to 3 extensions max (configurable)

-- =============================================================================
-- STEP 1: Create subscription_events table for audit trail
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at DESC);

-- Enable RLS
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own subscription events
DROP POLICY IF EXISTS "Users can view own subscription events" ON subscription_events;
CREATE POLICY "Users can view own subscription events"
  ON subscription_events FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Service role can insert events
DROP POLICY IF EXISTS "Service role can insert subscription events" ON subscription_events;
CREATE POLICY "Service role can insert subscription events"
  ON subscription_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

COMMENT ON TABLE subscription_events IS 'Audit log for subscription lifecycle events (trial extensions, cancellations, etc.)';

-- =============================================================================
-- STEP 2: Add referral_extensions_used column to subscriptions table
-- =============================================================================

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS referral_extensions_used INTEGER DEFAULT 0 CHECK (referral_extensions_used >= 0);

COMMENT ON COLUMN subscriptions.referral_extensions_used IS 'Number of trial extensions used via referrals (max controlled by admin_config)';

-- =============================================================================
-- STEP 3: Add admin config for trial extension settings
-- =============================================================================

INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active) VALUES
  ('max_referral_extensions', '3', 'Maximum number of trial extensions a user can earn via referrals', 'subscription', 'number', FALSE, TRUE),
  ('referral_extension_days', '7', 'Number of days added to trial per successful referral', 'subscription', 'number', FALSE, TRUE)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- STEP 4: Create extend_trial_period RPC function
-- =============================================================================

CREATE OR REPLACE FUNCTION extend_trial_period(
  p_user_id UUID,
  p_referral_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
  v_max_extensions INTEGER;
  v_extension_days INTEGER;
  v_new_trial_end TIMESTAMPTZ;
BEGIN
  -- Get current subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id 
    AND status IN ('trial', 'trialing', 'trial_ending');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No active trial found'
    );
  END IF;

  -- Get admin config values
  SELECT value::INTEGER INTO v_max_extensions
  FROM admin_config WHERE key = 'max_referral_extensions';
  
  SELECT value::INTEGER INTO v_extension_days
  FROM admin_config WHERE key = 'referral_extension_days';

  -- Validate we have config values
  IF v_max_extensions IS NULL OR v_extension_days IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Trial extension configuration not found'
    );
  END IF;

  -- Check if user has extensions remaining
  IF v_subscription.referral_extensions_used >= v_max_extensions THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Maximum trial extensions reached',
      'extensions_used', v_subscription.referral_extensions_used,
      'max_extensions', v_max_extensions
    );
  END IF;

  -- Calculate new trial end date
  v_new_trial_end := v_subscription.trial_end_date + (v_extension_days || ' days')::INTERVAL;

  -- Update subscription
  UPDATE subscriptions
  SET
    trial_end_date = v_new_trial_end,
    referral_extensions_used = referral_extensions_used + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the extension (audit trail)
  INSERT INTO subscription_events (
    user_id,
    event_type,
    metadata
  ) VALUES (
    p_user_id,
    'trial_extended',
    jsonb_build_object(
      'referral_user_id', p_referral_user_id,
      'days_added', v_extension_days,
      'new_trial_end', v_new_trial_end,
      'extensions_used', v_subscription.referral_extensions_used + 1,
      'extensions_remaining', v_max_extensions - (v_subscription.referral_extensions_used + 1)
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'new_trial_end', v_new_trial_end,
    'extensions_used', v_subscription.referral_extensions_used + 1,
    'extensions_remaining', v_max_extensions - (v_subscription.referral_extensions_used + 1),
    'days_added', v_extension_days
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION extend_trial_period IS 'Extends user trial period by configured days when they successfully refer a friend. Respects max extensions limit.';

-- =============================================================================
-- VERIFICATION QUERIES (Run these to confirm migration success)
-- =============================================================================

-- Verify referral_extensions_used column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'referral_extensions_used';
-- Expected: 1 row with data_type = 'integer', default = 0

-- Verify admin config entries exist
SELECT key, value, description
FROM admin_config
WHERE key IN ('max_referral_extensions', 'referral_extension_days');
-- Expected: 2 rows
-- max_referral_extensions = '3'
-- referral_extension_days = '7'

-- Verify extend_trial_period RPC exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'extend_trial_period';
-- Expected: 1 row with routine_type = 'FUNCTION'

-- Verify subscription_events table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'subscription_events';
-- Expected: 1 row
