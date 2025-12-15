-- File: supabase/migrations/20241215000001_add_referral_bonus_logic.sql
-- Module 02: AUTH-011 - Referral Bonus Logic
-- Award 5 points to both referrer and referee when referee completes their first trade

-- =============================================================================
-- 1. ADD referral_code COLUMN TO profiles TABLE (IF NOT EXISTS)
-- =============================================================================
-- Each user gets a unique 8-character referral code

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referral_code TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
  END IF;
END $$;

-- =============================================================================
-- 2. ADD onboarding_completed COLUMNS TO profiles TABLE (IF NOT EXISTS)
-- =============================================================================
-- Track onboarding completion status

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- =============================================================================
-- 3. CREATE FUNCTION: process_referral_bonus_on_trade
-- =============================================================================
-- Trigger function that awards referral bonus when referee completes first trade
-- Awards 5 points to both referrer and referee
-- Updates referral status to 'claimed'

CREATE OR REPLACE FUNCTION process_referral_bonus_on_trade()
RETURNS TRIGGER AS $$
DECLARE
  v_referral RECORD;
  v_trade_count INTEGER;
  v_referral_bonus INTEGER := 5; -- 5 points per referral
BEGIN
  -- Only process for completed trades
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Check if buyer has a pending referral
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_user_id = NEW.buyer_id
    AND status = 'pending'
  LIMIT 1;

  -- No pending referral found
  IF v_referral IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this is the buyer's first completed trade
  SELECT COUNT(*) INTO v_trade_count
  FROM trades
  WHERE buyer_id = NEW.buyer_id
    AND status = 'completed'
    AND id != NEW.id;

  -- Not the first trade
  IF v_trade_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Award 5 points to referrer
  INSERT INTO points_transactions (
    user_id,
    points,
    transaction_type,
    description,
    related_id,
    created_at
  ) VALUES (
    v_referral.referrer_user_id,
    v_referral_bonus,
    'referral_bonus',
    'Referral bonus: ' || v_referral.referral_code,
    v_referral.id,
    NOW()
  );

  -- Award 5 points to referee
  INSERT INTO points_transactions (
    user_id,
    points,
    transaction_type,
    description,
    related_id,
    created_at
  ) VALUES (
    v_referral.referred_user_id,
    v_referral_bonus,
    'referral_bonus',
    'Referral bonus: ' || v_referral.referral_code,
    v_referral.id,
    NOW()
  );

  -- Update referral status to claimed
  UPDATE referrals
  SET
    status = 'claimed',
    bonus_points = v_referral_bonus,
    bonus_claimed_at = NOW(),
    bonus_points_referrer = v_referral_bonus,
    bonus_claimed_referrer_at = NOW(),
    claimed_at = NOW()
  WHERE id = v_referral.id;

  -- TODO: Create notifications for both users
  -- TODO: Track analytics event

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. CREATE TRIGGER: trigger_process_referral_bonus_on_trade
-- =============================================================================
-- Fires after trade status is updated to 'completed'

DROP TRIGGER IF EXISTS trigger_process_referral_bonus_on_trade ON trades;

CREATE TRIGGER trigger_process_referral_bonus_on_trade
  AFTER INSERT OR UPDATE OF status ON trades
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION process_referral_bonus_on_trade();

-- =============================================================================
-- 5. CREATE FUNCTION: generate_referral_code_on_profile_creation
-- =============================================================================
-- Auto-generate referral code when profile is created

CREATE OR REPLACE FUNCTION generate_referral_code_on_profile_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 10;
BEGIN
  -- Only generate if referral_code is NULL
  IF NEW.referral_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Generate unique 8-character code
  LOOP
    v_code := UPPER(
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8)
    );
    
    -- Check if code exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = v_code) THEN
      NEW.referral_code := v_code;
      EXIT;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', v_max_attempts;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. CREATE TRIGGER: trigger_generate_referral_code_on_profile_creation
-- =============================================================================
-- Fires before profile insert to auto-generate referral code

DROP TRIGGER IF EXISTS trigger_generate_referral_code_on_profile_creation ON profiles;

CREATE TRIGGER trigger_generate_referral_code_on_profile_creation
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code_on_profile_creation();

-- =============================================================================
-- 7. BACKFILL: Generate referral codes for existing users
-- =============================================================================
-- Update existing profiles that don't have referral codes

UPDATE profiles
SET referral_code = UPPER(
  SUBSTRING(MD5(RANDOM()::TEXT || user_id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8)
)
WHERE referral_code IS NULL;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify referral codes exist for all users
-- SELECT COUNT(*) as total_users, 
--        COUNT(referral_code) as users_with_codes,
--        COUNT(*) - COUNT(referral_code) as users_without_codes
-- FROM profiles;

-- Verify referral bonus trigger works
-- SELECT * FROM referrals WHERE status = 'claimed';
-- SELECT * FROM points_transactions WHERE transaction_type = 'referral_bonus';

-- Test referral code uniqueness
-- SELECT referral_code, COUNT(*) 
-- FROM profiles 
-- WHERE referral_code IS NOT NULL
-- GROUP BY referral_code 
-- HAVING COUNT(*) > 1;
