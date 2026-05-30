-- ============================================================================
-- TC-016 FIX: Referral Rewards Should Use Historical SP Values
-- ============================================================================
-- Issue: When SP config values are changed, old referrals get new values instead of old ones.
-- Root Cause: award_referral_sp and notify_referral_rewards_granted fetch sp_config dynamically
--            instead of using sp_amount values stored in the referrals table.
-- Solution: 
--   1. Store sp_amount values when referral is created
--   2. Use stored values when awarding rewards
-- ============================================================================

-- ============================================================================
-- STEP 1: Alter referrals table to store captured SP amounts
-- ============================================================================

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS captured_sp_referrer_amount INTEGER;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS captured_sp_referee_amount INTEGER;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS captured_expiration_days INTEGER;

-- ============================================================================
-- STEP 2: Update apply_referral_code to capture SP amounts at creation time
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
  v_sp_referrer INTEGER;
  v_sp_referee INTEGER;
  v_expiration_days INTEGER;
BEGIN
  p_referral_code := LOWER(TRIM(p_referral_code));

  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = p_referral_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  SELECT au.email INTO v_referee_email FROM auth.users au WHERE au.id = p_referee_id;
  SELECT au.email INTO v_referrer_email FROM auth.users au WHERE au.id = v_referrer_id;

  IF v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- If already referred, keep idempotent behavior
  IF EXISTS(SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id) THEN
    UPDATE public.profiles p
    SET referred_by = v_referrer_id
    WHERE p.user_id = p_referee_id
      AND p.referred_by IS NULL;

    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;

  -- STEP 2 FIX: Capture current SP config values at time of referral creation
  SELECT (sc.config_value #>> '{}')::INTEGER 
  INTO v_sp_referrer
  FROM public.sp_config sc
  WHERE sc.config_key = 'referral_reward_referrer_sp';
  v_sp_referrer := COALESCE(v_sp_referrer, 50);

  SELECT (sc.config_value #>> '{}')::INTEGER 
  INTO v_sp_referee
  FROM public.sp_config sc
  WHERE sc.config_key = 'referral_reward_referee_sp';
  v_sp_referee := COALESCE(v_sp_referee, 25);

  SELECT (sc.config_value #>> '{}')::INTEGER 
  INTO v_expiration_days
  FROM public.sp_config sc
  WHERE sc.config_key = 'expiration_period_days';
  v_expiration_days := COALESCE(v_expiration_days, 365);

  -- Insert referral WITH captured SP amounts
  INSERT INTO public.referrals (
    referrer_user_id, 
    referred_user_id, 
    referral_code, 
    status,
    captured_sp_referrer_amount,
    captured_sp_referee_amount,
    captured_expiration_days
  ) VALUES (
    v_referrer_id, 
    p_referee_id, 
    p_referral_code, 
    'pending',
    v_sp_referrer,
    v_sp_referee,
    v_expiration_days
  );

  UPDATE public.profiles p
  SET referred_by = v_referrer_id
  WHERE p.user_id = p_referee_id
    AND p.referred_by IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Update award_referral_sp to use captured amounts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.award_referral_sp(
  p_referrer_id UUID,
  p_referee_id UUID,
  p_referral_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral_record RECORD;
  v_referrer_wallet_id UUID;
  v_referee_wallet_id UUID;
  v_referrer_sp INTEGER;
  v_referee_sp INTEGER;
  v_expiration_days INTEGER;
  v_referrer_batch_id UUID;
  v_referee_batch_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_is_referrer_subscriber BOOLEAN;
  v_is_referee_subscriber BOOLEAN;
  v_idempotency_base TEXT;
  v_idempotency_referrer TEXT;
  v_idempotency_referee TEXT;
  v_already_processed BOOLEAN;
  v_referrer_awarded INTEGER := 0;
  v_referee_awarded INTEGER := 0;
BEGIN
  v_idempotency_base := 'referral_' || p_referral_id::TEXT;
  v_idempotency_referrer := v_idempotency_base || '_referrer';
  v_idempotency_referee := v_idempotency_base || '_referee';

  -- Idempotency check
  SELECT EXISTS(
    SELECT 1
    FROM public.sp_ledger sl
    WHERE sl.idempotency_key IN (v_idempotency_referrer, v_idempotency_referee)
  ) INTO v_already_processed;

  IF v_already_processed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral reward already processed');
  END IF;

  -- STEP 3 FIX: Fetch referral record to get CAPTURED amounts (not dynamic config)
  SELECT * INTO v_referral_record
  FROM public.referrals
  WHERE id = p_referral_id;

  IF v_referral_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral not found');
  END IF;

  -- Use captured values from when referral was created
  v_referrer_sp := COALESCE(v_referral_record.captured_sp_referrer_amount, 50);
  v_referee_sp := COALESCE(v_referral_record.captured_sp_referee_amount, 25);
  v_expiration_days := COALESCE(v_referral_record.captured_expiration_days, 365);
  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- Subscriber status
  SELECT public.is_active_subscriber(p_referrer_id) INTO v_is_referrer_subscriber;
  SELECT public.is_active_subscriber(p_referee_id) INTO v_is_referee_subscriber;

  -- Award to referrer
  IF v_is_referrer_subscriber AND v_referrer_sp > 0 THEN
    SELECT w.id INTO v_referrer_wallet_id FROM public.sp_wallets w WHERE w.user_id = p_referrer_id;

    IF v_referrer_wallet_id IS NOT NULL THEN
      INSERT INTO public.sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp, source_type, source_id, expires_at
      ) VALUES (
        v_referrer_wallet_id, p_referrer_id, v_referrer_sp, v_referrer_sp, 'referral', p_referral_id, v_expires_at
      ) RETURNING id INTO v_referrer_batch_id;

      UPDATE public.sp_wallets
      SET available_balance = available_balance + v_referrer_sp, lifetime_earned = lifetime_earned + v_referrer_sp, updated_at = NOW()
      WHERE id = v_referrer_wallet_id;

      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description, related_batch_id, idempotency_key
      ) SELECT v_referrer_wallet_id, p_referrer_id, 'earn_referral', v_referrer_sp, w.available_balance - v_referrer_sp, w.available_balance, 'Referral Reward: Friend completed first trade', v_referrer_batch_id, v_idempotency_referrer
      FROM public.sp_wallets w WHERE w.id = v_referrer_wallet_id;

      v_referrer_awarded := v_referrer_sp;
    END IF;
  END IF;

  -- Award to referee
  IF v_is_referee_subscriber AND v_referee_sp > 0 THEN
    SELECT w.id INTO v_referee_wallet_id FROM public.sp_wallets w WHERE w.user_id = p_referee_id;

    IF v_referee_wallet_id IS NOT NULL THEN
      INSERT INTO public.sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp, source_type, source_id, expires_at
      ) VALUES (
        v_referee_wallet_id, p_referee_id, v_referee_sp, v_referee_sp, 'referral', p_referral_id, v_expires_at
      ) RETURNING id INTO v_referee_batch_id;

      UPDATE public.sp_wallets
      SET available_balance = available_balance + v_referee_sp, lifetime_earned = lifetime_earned + v_referee_sp, updated_at = NOW()
      WHERE id = v_referee_wallet_id;

      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description, related_batch_id, idempotency_key
      ) SELECT v_referee_wallet_id, p_referee_id, 'earn_referral', v_referee_sp, w.available_balance - v_referee_sp, w.available_balance, 'Referral Reward: Welcome bonus (first trade)', v_referee_batch_id, v_idempotency_referee
      FROM public.sp_wallets w WHERE w.id = v_referee_wallet_id;

      v_referee_awarded := v_referee_sp;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_sp_awarded', v_referrer_awarded,
    'referee_sp_awarded', v_referee_awarded,
    'referrer_batch_id', v_referrer_batch_id,
    'referee_batch_id', v_referee_batch_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- STEP 4: Update notify_referral_rewards_granted to use captured amounts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_referral_rewards_granted()
RETURNS TRIGGER AS $$
DECLARE
  v_trial_extended BOOLEAN;
  v_referrer_sp INT;
  v_referee_sp INT;
BEGIN
  -- Only trigger on status change to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    v_trial_extended := COALESCE(NEW.trial_extension_applied, FALSE);
    
    -- STEP 4 FIX: Use captured values from referral row (not dynamic sp_config)
    v_referrer_sp := COALESCE(NEW.captured_sp_referrer_amount, 50);
    v_referee_sp := COALESCE(NEW.captured_sp_referee_amount, 25);

    -- Notify referrer about rewards
    PERFORM public.create_notification(
      NEW.referrer_user_id,
      'referral_rewards_granted',
      format('You Earned %s SP! 💰', v_referrer_sp),
      CASE
        WHEN v_trial_extended THEN 
          format('Your referral completed their first trade! You earned %s SP and 7 extra trial days.', v_referrer_sp)
        ELSE 
          format('Your referral completed their first trade! You earned %s SP.', v_referrer_sp)
      END,
      jsonb_build_object(
        'deep_link', 'ReferralDashboard',
        'sp_earned', v_referrer_sp,
        'trial_extended', v_trial_extended,
        'referral_id', NEW.id
      )
    );

    -- Notify referee about welcome bonus
    PERFORM public.create_notification(
      NEW.referred_user_id,
      'referral_welcome_bonus',
      format('Welcome Bonus: %s SP! 🎁', v_referee_sp),
      format('You completed your first trade and earned a welcome bonus of %s SP!', v_referee_sp),
      jsonb_build_object(
        'deep_link', 'SpWallet',
        'sp_earned', v_referee_sp,
        'referral_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- STEP 5: Backfill existing referrals with captured amounts from current config
-- ============================================================================

DO $$
DECLARE
  v_sp_referrer INTEGER;
  v_sp_referee INTEGER;
  v_expiration_days INTEGER;
BEGIN
  -- Get current config values
  SELECT (sc.config_value #>> '{}')::INTEGER INTO v_sp_referrer
  FROM public.sp_config sc WHERE sc.config_key = 'referral_reward_referrer_sp';
  v_sp_referrer := COALESCE(v_sp_referrer, 50);

  SELECT (sc.config_value #>> '{}')::INTEGER INTO v_sp_referee
  FROM public.sp_config sc WHERE sc.config_key = 'referral_reward_referee_sp';
  v_sp_referee := COALESCE(v_sp_referee, 25);

  SELECT (sc.config_value #>> '{}')::INTEGER INTO v_expiration_days
  FROM public.sp_config sc WHERE sc.config_key = 'expiration_period_days';
  v_expiration_days := COALESCE(v_expiration_days, 365);

  -- Backfill existing referrals that don't have captured amounts yet
  UPDATE public.referrals
  SET 
    captured_sp_referrer_amount = v_sp_referrer,
    captured_sp_referee_amount = v_sp_referee,
    captured_expiration_days = v_expiration_days
  WHERE captured_sp_referrer_amount IS NULL
    OR captured_sp_referee_amount IS NULL
    OR captured_expiration_days IS NULL;

  RAISE NOTICE 'Backfilled % referrals with captured SP amounts (referrer: %, referee: %, expiration: % days)',
    FOUND, v_sp_referrer, v_sp_referee, v_expiration_days;
END;
$$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Verify captured columns exist and are populated
SELECT COUNT(*) as total_referrals, 
       COUNT(captured_sp_referrer_amount) as with_referrer_sp,
       COUNT(captured_sp_referee_amount) as with_referee_sp
FROM public.referrals;

-- 2. Verify new referrals capture values properly
SELECT id, referrer_user_id, referred_user_id, status, 
       captured_sp_referrer_amount, captured_sp_referee_amount, 
       created_at
FROM public.referrals 
ORDER BY created_at DESC 
LIMIT 5;
