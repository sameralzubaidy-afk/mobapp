-- File: supabase/migrations/20241214000002_phone_verification_codes.sql
-- Phone verification codes table for SMS verification

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 3),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_user_id ON phone_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_phone ON phone_verification_codes(phone);
CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_created_at ON phone_verification_codes(created_at DESC);

-- RLS Policies
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own verification codes" ON phone_verification_codes;
CREATE POLICY "Users can view their own verification codes"
  ON phone_verification_codes FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert verification codes" ON phone_verification_codes;
CREATE POLICY "System can insert verification codes"
  ON phone_verification_codes FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update verification codes" ON phone_verification_codes;
CREATE POLICY "System can update verification codes"
  ON phone_verification_codes FOR UPDATE
  USING (true);

-- Add phone verification fields to profiles table (not users - users is in auth schema)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;