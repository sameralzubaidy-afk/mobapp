-- File: supabase/migrations/20241213000002_add_referral_system_tables.sql
-- Module 02: Referral System & Bonus Points
-- This migration adds tables and functions for referral tracking and bonus point allocation

-- =============================================================================
-- 1. CREATE referrals TABLE
-- =============================================================================
-- Tracks referral relationships and bonus distribution

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  
  -- Status of the referral
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Referred user exists but not claimed
    'claimed',     -- Referred user completed onboarding
    'expired'      -- Referral window expired (60 days)
  )),
  
  -- Bonus tracking
  bonus_points INTEGER DEFAULT 0,
  bonus_claimed_at TIMESTAMPTZ,
  bonus_points_referrer INTEGER DEFAULT 0,
  bonus_claimed_referrer_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  UNIQUE(referrer_user_id, referred_user_id)
);

-- Create indexes for fast lookups (conditionally if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='referrer_user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON referrals(referrer_user_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='referred_user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='referral_code') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals(referral_code)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC)';
  END IF;
END$$;

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='referrer_user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='referred_user_id') THEN
    DROP POLICY IF EXISTS "Users can view their referrals" ON referrals;
    CREATE POLICY "Users can view their referrals"
      ON referrals FOR SELECT
      USING (
        referrer_user_id = auth.uid() OR 
        referred_user_id = auth.uid()
      );
  END IF;
END$$;

-- =============================================================================
-- 2. CREATE SESSION TRACKING TABLE (for auth hardening)
-- =============================================================================
-- Tracks device-level sessions for security

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT, -- ios, android, web
  
  -- Session tracking
  ip_address INET,
  user_agent TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'revoked', 'expired'
  )),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  revoked_at TIMESTAMPTZ,
  
  UNIQUE(user_id, device_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id 
  ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_device_id 
  ON auth_sessions(device_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_status 
  ON auth_sessions(status);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at 
  ON auth_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sessions" ON auth_sessions;
CREATE POLICY "Users can view their own sessions"
  ON auth_sessions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can revoke their own sessions" ON auth_sessions;
CREATE POLICY "Users can revoke their own sessions"
  ON auth_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- =============================================================================
-- 3. SMS RATE LIMITING TRACKING
-- =============================================================================
-- Tracks SMS sending for rate limiting purposes

CREATE TABLE IF NOT EXISTS sms_rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sms_type TEXT NOT NULL CHECK (sms_type IN (
    'verification_code',
    'password_reset',
    'notification'
  )),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN (
    'sent', 'failed'
  ))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sms_rate_limit_log_phone 
  ON sms_rate_limit_log(phone);

CREATE INDEX IF NOT EXISTS idx_sms_rate_limit_log_user_id 
  ON sms_rate_limit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_sms_rate_limit_log_sent_at 
  ON sms_rate_limit_log(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_rate_limit_log_sms_type 
  ON sms_rate_limit_log(sms_type);

-- =============================================================================
-- 4. PASSWORD RESET TOKENS TABLE
-- =============================================================================
-- Manages password reset tokens with expiration

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  
  -- Status
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  
  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id 
  ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token 
  ON password_reset_tokens(token);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at 
  ON password_reset_tokens(expires_at);

-- Enable Row Level Security
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reset tokens" ON password_reset_tokens;
CREATE POLICY "Users can view their own reset tokens"
  ON password_reset_tokens FOR SELECT
  USING (user_id = auth.uid());

-- =============================================================================
-- 5. CREATE FUNCTION: process_referral_bonus
-- =============================================================================
-- Awards referral bonus points to both referrer and referred user
-- This is called after referred user completes onboarding

CREATE OR REPLACE FUNCTION process_referral_bonus(
  p_referred_user_id UUID,
  p_referral_code TEXT,
  p_bonus_amount INTEGER DEFAULT 50
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  referrer_user_id UUID,
  referred_user_id UUID
) AS $$
DECLARE
  v_referrer_user_id UUID;
  v_referral_record RECORD;
BEGIN
  -- Find the referral code owner
  SELECT id INTO v_referrer_user_id
  FROM profiles
  WHERE referral_code = p_referral_code
  LIMIT 1;
  
  IF v_referrer_user_id IS NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Invalid referral code'::TEXT,
      NULL::UUID,
      p_referred_user_id;
    RETURN;
  END IF;
  
  -- Check if referral already exists
  SELECT * INTO v_referral_record
  FROM referrals
  WHERE referrer_user_id = v_referrer_user_id
    AND referred_user_id = p_referred_user_id;
  
  IF v_referral_record IS NOT NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Referral already processed'::TEXT,
      v_referrer_user_id,
      p_referred_user_id;
    RETURN;
  END IF;
  
  -- Create referral record
  INSERT INTO referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status,
    bonus_points,
    bonus_points_referrer,
    claimed_at,
    bonus_claimed_at,
    bonus_claimed_referrer_at
  ) VALUES (
    v_referrer_user_id,
    p_referred_user_id,
    p_referral_code,
    'claimed',
    p_bonus_amount,
    p_bonus_amount,
    NOW(),
    NOW(),
    NOW()
  );
  
  RETURN QUERY SELECT 
    true::BOOLEAN,
    'Referral bonus awarded successfully'::TEXT,
    v_referrer_user_id,
    p_referred_user_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. CREATE FUNCTION: mark_referral_claimed
-- =============================================================================
-- Marks a referral as claimed after user completes onboarding

CREATE OR REPLACE FUNCTION mark_referral_claimed(
  p_referred_user_id UUID,
  p_referral_code TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_referrer_user_id UUID;
BEGIN
  -- Find referrer by code
  SELECT id INTO v_referrer_user_id
  FROM profiles
  WHERE referral_code = p_referral_code
  LIMIT 1;
  
  IF v_referrer_user_id IS NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Invalid referral code'::TEXT;
    RETURN;
  END IF;
  
  -- Update referral status
  UPDATE referrals
  SET status = 'claimed', claimed_at = NOW()
  WHERE referrer_user_id = v_referrer_user_id
    AND referred_user_id = p_referred_user_id
    AND status = 'pending';
  
  RETURN QUERY SELECT 
    true::BOOLEAN,
    'Referral marked as claimed'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. CREATE FUNCTION: revoke_session
-- =============================================================================
-- Revokes a specific session (for logout from specific device)

CREATE OR REPLACE FUNCTION revoke_session(
  p_user_id UUID,
  p_device_id TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
  UPDATE auth_sessions
  SET status = 'revoked', revoked_at = NOW()
  WHERE user_id = p_user_id
    AND device_id = p_device_id
    AND status = 'active';
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      'Session revoked successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Session not found or already revoked'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. CREATE FUNCTION: check_sms_rate_limit
-- =============================================================================
-- Checks if phone number has exceeded SMS rate limit

CREATE OR REPLACE FUNCTION check_sms_rate_limit(
  p_phone TEXT,
  p_max_per_hour INTEGER DEFAULT 10
)
RETURNS TABLE(
  allowed BOOLEAN,
  sms_count_this_hour INTEGER,
  limit_count INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count SMS sent in last hour
  SELECT COUNT(*) INTO v_count
  FROM sms_rate_limit_log
  WHERE phone = p_phone
    AND sent_at > NOW() - INTERVAL '1 hour'
    AND status = 'sent';
  
  RETURN QUERY SELECT 
    (v_count < p_max_per_hour)::BOOLEAN,
    v_count::INTEGER,
    p_max_per_hour::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. PERIODIC CLEANUP JOBS (Run via pg_cron or Edge Function)
-- =============================================================================

-- Mark expired password reset tokens as expired
-- Run daily at midnight:
-- SELECT cron.schedule('cleanup-expired-reset-tokens', '0 0 * * *', $$
--   UPDATE password_reset_tokens
--   SET used = true
--   WHERE expires_at < NOW() AND used = false;
-- $$);

-- Mark expired referrals as expired (60-day window)
-- Run daily at midnight:
-- SELECT cron.schedule('mark-expired-referrals', '0 0 * * *', $$
--   UPDATE referrals
--   SET status = 'expired'
--   WHERE status = 'pending'
--     AND created_at < NOW() - INTERVAL '60 days';
-- $$);

-- Mark expired auth sessions
-- Run daily at midnight:
-- SELECT cron.schedule('cleanup-expired-sessions', '0 0 * * *', $$
--   UPDATE auth_sessions
--   SET status = 'expired'
--   WHERE expires_at < NOW() AND status = 'active';
-- $$);

-- TODO: After running this migration, regenerate TypeScript types:
-- npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts

-- TODO: Configure pg_cron in Supabase dashboard for periodic cleanup jobs

-- TODO: Seed admin_config values for SMS rate limiting:
-- INSERT INTO admin_config (key, value, description)
-- VALUES 
--   ('sms_rate_limit_per_hour', '10', 'Max SMS per hour per phone number'),
--   ('max_login_attempts', '5', 'Max failed login attempts before lockout'),
--   ('password_reset_expiry_minutes', '15', 'Password reset token expiry in minutes'),
--   ('referral_bonus_points', '50', 'Points awarded for successful referral'),
--   ('referral_window_days', '60', 'Days to claim referral bonus');
