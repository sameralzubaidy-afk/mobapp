-- File: supabase/migrations/20241213000001_add_auth_module_tables.sql
-- Module 02: Authentication & User Management - Core Schema
-- This migration creates all tables and columns required for phone verification,
-- profile management, and referral system

-- =============================================================================
-- 1. ADD MISSING COLUMNS TO users TABLE (if they don't exist)
-- =============================================================================

-- Add phone verification columns to users table
-- NOTE: Do not alter `auth.users` (managed by Supabase Auth).
-- All user profile fields (name, avatar, bio, zip, node, referral_code,
-- phone_verified, onboarding flags, etc.) are stored in the `profiles` table
-- created later in this migration. Use `profiles.user_id` (references auth.users)
-- to link authentication records to public profile data.

-- =============================================================================
-- 2. CREATE phone_verification_codes TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 3),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_user_id 
  ON phone_verification_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_phone 
  ON phone_verification_codes(phone);

CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_created_at 
  ON phone_verification_codes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_expires_at 
  ON phone_verification_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own verification codes
DROP POLICY IF EXISTS "Users can view their own verification codes" ON phone_verification_codes;
CREATE POLICY "Users can view their own verification codes"
  ON phone_verification_codes FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: System can insert verification codes
DROP POLICY IF EXISTS "System can insert verification codes" ON phone_verification_codes;
CREATE POLICY "System can insert verification codes"
  ON phone_verification_codes FOR INSERT
  WITH CHECK (true);

-- RLS Policy: System can update verification codes
DROP POLICY IF EXISTS "System can update verification codes" ON phone_verification_codes;
CREATE POLICY "System can update verification codes"
  ON phone_verification_codes FOR UPDATE
  USING (true);

-- RLS Policy: Users can delete their own verification codes (after verification)
DROP POLICY IF EXISTS "Users can delete their own verification codes" ON phone_verification_codes;
CREATE POLICY "Users can delete their own verification codes"
  ON phone_verification_codes FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- 3. CREATE profiles TABLE (public profile data)
-- =============================================================================
-- This is separate from auth.users to allow public profile visibility

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  
  -- Profile completion status
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  
  -- Verification status
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified_at TIMESTAMPTZ,
  
  -- Referral
  referral_code TEXT UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_node_id ON profiles(node_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view public profiles (except private fields)
DROP POLICY IF EXISTS "Public profiles are viewable" ON profiles;
CREATE POLICY "Public profiles are viewable"
  ON profiles FOR SELECT
  USING (true);

-- RLS Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at_trigger ON profiles;
CREATE TRIGGER profiles_updated_at_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- =============================================================================
-- 4. CREATE nodes TABLE (if not exists - for auth module reference)
-- =============================================================================

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waitlist', 'inactive')),
  launch_date DATE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 5. CREATE zip_codes TABLE (for location mapping)
-- =============================================================================

CREATE TABLE IF NOT EXISTS zip_codes (
  zip TEXT PRIMARY KEY,
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
  city TEXT,
  state TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zip_codes_node_id ON zip_codes(node_id);
CREATE INDEX IF NOT EXISTS idx_zip_codes_city_state ON zip_codes(city, state);

-- =============================================================================
-- 6. CREATE waitlist TABLE (for inactive nodes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  zip TEXT NOT NULL,
  kids_count INTEGER,
  kids_ages TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  converted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_phone ON waitlist(phone);
CREATE INDEX IF NOT EXISTS idx_waitlist_zip ON waitlist(zip);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

-- Enable Row Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join waitlist" ON waitlist;
CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view waitlist" ON waitlist;
CREATE POLICY "Admins can view waitlist"
  ON waitlist FOR SELECT
  USING (
    auth.role() = 'service_role'
  );

-- =============================================================================
-- 7. CREATE FUNCTION: generate_referral_code
-- =============================================================================
-- Generates a unique 8-character alphanumeric referral code

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  found BOOLEAN;
BEGIN
  LOOP
    -- Generate random 8-character code (A-Z, 0-9)
    code := UPPER(substr(md5(gen_random_uuid()::TEXT), 1, 8));
    
    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM profiles WHERE referral_code = code
    ) INTO found;
    
    -- If code doesn't exist, return it
    IF NOT found THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. CREATE FUNCTION: get_nearest_node
-- =============================================================================
-- Finds the nearest active node based on latitude/longitude
-- Uses simple distance formula (not PostGIS for now)

CREATE OR REPLACE FUNCTION get_nearest_node(
  user_lat DECIMAL,
  user_lng DECIMAL,
  p_status TEXT DEFAULT 'active'
)
RETURNS TABLE(node_id TEXT, node_name TEXT, distance DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.name,
    -- Simple distance formula (not Haversine - requires PostGIS)
    CAST(
      SQRT(
        POWER(CAST(n.latitude AS DECIMAL) - user_lat, 2) +
        POWER(CAST(n.longitude AS DECIMAL) - user_lng, 2)
      ) AS DECIMAL
    ) AS dist
  FROM nodes n
  WHERE n.status = p_status
  ORDER BY dist ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. CREATE FUNCTION: assign_node_by_zip
-- =============================================================================
-- Assigns user to node based on ZIP code

CREATE OR REPLACE FUNCTION assign_node_by_zip(p_zip TEXT)
RETURNS TEXT AS $$
DECLARE
  v_node_id TEXT;
BEGIN
  SELECT node_id INTO v_node_id
  FROM zip_codes
  WHERE zip = p_zip
  LIMIT 1;
  
  IF v_node_id IS NULL THEN
    -- ZIP not found, return NULL
    RETURN NULL;
  END IF;
  
  RETURN v_node_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 10. CREATE FUNCTION: verify_phone_code
-- =============================================================================
-- Verifies a phone verification code and updates user status

CREATE OR REPLACE FUNCTION verify_phone_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  user_id UUID
) AS $$
DECLARE
  v_record RECORD;
  v_attempts INTEGER;
BEGIN
  -- Find the verification code
  SELECT * INTO v_record
  FROM phone_verification_codes
  WHERE user_id = p_user_id
    AND code = p_code
    AND verified = false
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Code not found or expired
  IF v_record IS NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Invalid or expired verification code'::TEXT,
      p_user_id;
    RETURN;
  END IF;
  
  -- Check attempts
  IF v_record.attempts >= 3 THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Too many attempts. Please request a new code.'::TEXT,
      p_user_id;
    RETURN;
  END IF;
  
  -- Mark as verified
  UPDATE phone_verification_codes
  SET verified = true
  WHERE id = v_record.id;
  
  -- Update user profile
  UPDATE profiles
  SET 
    phone_verified = true,
    phone_verified_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN QUERY SELECT 
    true::BOOLEAN,
    'Phone number verified successfully'::TEXT,
    p_user_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 11. CREATE FUNCTION: increment_verification_attempts
-- =============================================================================
-- Increments failed attempt count for a verification code

CREATE OR REPLACE FUNCTION increment_verification_attempts(
  p_user_id UUID,
  p_code TEXT
)
RETURNS TABLE(attempts INTEGER, max_attempts INTEGER) AS $$
DECLARE
  v_current_attempts INTEGER;
BEGIN
  UPDATE phone_verification_codes
  SET attempts = attempts + 1
  WHERE user_id = p_user_id
    AND code = p_code
    AND verified = false
  RETURNING attempts INTO v_current_attempts;
  
  RETURN QUERY SELECT 
    COALESCE(v_current_attempts, 0)::INTEGER,
    3::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 12. INDEXES FOR PERFORMANCE
-- =============================================================================

-- NOTE: `auth.users` is managed by Supabase Auth and should not be altered.
-- Use indexes on `profiles` (public profile data) for performance instead.

-- TODO: After running this migration, regenerate TypeScript types:
-- npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts

-- TODO: Seed initial nodes and zip codes via admin panel or separate seed script
-- Example: INSERT INTO nodes (id, name, status) VALUES ('norwalk_ct', 'Norwalk, CT', 'active');

-- TODO: If using PostGIS, enable the extension and update get_nearest_node() to use ST_Distance
-- CREATE EXTENSION IF NOT EXISTS postgis;
