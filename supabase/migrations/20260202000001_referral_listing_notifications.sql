-- File: supabase/migrations/20260202000001_referral_listing_notifications.sql
-- Mode B: Idempotent rerunnable migration
-- Purpose: Add notifications for referral listing rewards

CREATE OR REPLACE FUNCTION public.award_listing_referral_sp(
  p_referrer_id UUID,
  p_referee_id UUID,
  p_referral_id UUID,
  p_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_wallet_id UUID;
  v_referee_wallet_id UUID;
  v_referrer_sp INTEGER;
  v_referee_sp INTEGER;
  v_referrer_batch_id UUID;
  v_referee_batch_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiration_days INTEGER;
  v_is_referrer_subscriber BOOLEAN;
  v_is_referee_subscriber BOOLEAN;
  v_idempotency_base TEXT;
  v_idempotency_referrer TEXT;
  v_idempotency_referee TEXT;
  v_already_processed BOOLEAN;
  v_referrer_awarded INTEGER := 0;
  v_referee_awarded INTEGER := 0;
BEGIN
  v_idempotency_base := 'referral_listing_' || p_item_id::TEXT;
  v_idempotency_referrer := v_idempotency_base || '_referrer';
  v_idempotency_referee := v_idempotency_base || '_referee';

  -- Idempotency check: check if either reward was already granted for this item
  SELECT EXISTS(
    SELECT 1
    FROM public.sp_ledger sl
    WHERE sl.idempotency_key IN (v_idempotency_referrer, v_idempotency_referee)
  ) INTO v_already_processed;

  IF v_already_processed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Referral listing bonus already processed for this item'
    );
  END IF;

  -- Subscriber status check
  SELECT public.is_active_subscriber(p_referrer_id) INTO v_is_referrer_subscriber;
  SELECT public.is_active_subscriber(p_referee_id) INTO v_is_referee_subscriber;

  -- Amounts from config
  SELECT (sc.config_value)::INTEGER INTO v_referrer_sp
  FROM public.sp_config sc
  WHERE sc.config_key = 'referral_reward_referrer_listing_sp';

  SELECT (sc.config_value)::INTEGER INTO v_referee_sp
  FROM public.sp_config sc
  WHERE sc.config_key = 'referral_reward_referee_listing_sp';

  v_referrer_sp := COALESCE(v_referrer_sp, 25);
  v_referee_sp := COALESCE(v_referee_sp, 10);

  -- Expiration config
  SELECT (sc.config_value)::INTEGER INTO v_expiration_days
  FROM public.sp_config sc
  WHERE sc.config_key = 'expiration_period_days';

  v_expiration_days := COALESCE(v_expiration_days, 365);
  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- Award to Referrer
  IF v_is_referrer_subscriber AND v_referrer_sp > 0 THEN
    SELECT w.id INTO v_referrer_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = p_referrer_id;

    IF v_referrer_wallet_id IS NOT NULL THEN
      INSERT INTO public.sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp,
        source_type, source_id, expires_at
      ) VALUES (
        v_referrer_wallet_id, p_referrer_id, v_referrer_sp, v_referrer_sp,
        'referral', p_item_id, v_expires_at
      ) RETURNING id INTO v_referrer_batch_id;

      UPDATE public.sp_wallets
      SET
        available_balance = available_balance + v_referrer_sp,
        lifetime_earned = lifetime_earned + v_referrer_sp,
        updated_at = NOW()
      WHERE id = v_referrer_wallet_id;

      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_batch_id, idempotency_key, related_listing_id
      )
      SELECT
        v_referrer_wallet_id,
        p_referrer_id,
        'earn_referral',
        v_referrer_sp,
        w.available_balance - v_referrer_sp,
        w.available_balance,
        'Referral Bonus: Friend approved first listing',
        v_referrer_batch_id,
        v_idempotency_referrer,
        p_item_id
      FROM public.sp_wallets w
      WHERE w.id = v_referrer_wallet_id;

      v_referrer_awarded := v_referrer_sp;

      -- Send Notification
      PERFORM public.create_notification(
        p_referrer_id,
        'referral_listing_reward_referrer',
        format('Bonus Earned: %s SP! 📈', v_referrer_sp),
        format('Your friend just listed their first item. You earned %s SP!', v_referrer_sp),
        jsonb_build_object(
          'deep_link', 'ReferralDashboard',
          'sp_earned', v_referrer_sp,
          'item_id', p_item_id
        )
      );
    END IF;
  END IF;

  -- Award to Referee
  IF v_is_referee_subscriber AND v_referee_sp > 0 THEN
    SELECT w.id INTO v_referee_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = p_referee_id;

    IF v_referee_wallet_id IS NOT NULL THEN
      INSERT INTO public.sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp,
        source_type, source_id, expires_at
      ) VALUES (
        v_referee_wallet_id, p_referee_id, v_referee_sp, v_referee_sp,
        'referral', p_item_id, v_expires_at
      ) RETURNING id INTO v_referee_batch_id;

      UPDATE public.sp_wallets
      SET
        available_balance = available_balance + v_referee_sp,
        lifetime_earned = lifetime_earned + v_referee_sp,
        updated_at = NOW()
      WHERE id = v_referee_wallet_id;

      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_batch_id, idempotency_key, related_listing_id
      )
      SELECT
        v_referee_wallet_id,
        p_referee_id,
        'earn_referral',
        v_referee_sp,
        w.available_balance - v_referee_sp,
        w.available_balance,
        'Referral Bonus: First listing approved',
        v_referee_batch_id,
        v_idempotency_referee,
        p_item_id
      FROM public.sp_wallets w
      WHERE w.id = v_referee_wallet_id;

      v_referee_awarded := v_referee_sp;

      -- Send Notification
      PERFORM public.create_notification(
        p_referee_id,
        'referral_listing_reward_referee',
        format('Welcome Bonus: %s SP! 🏠', v_referee_sp),
        format('Your first listing was approved! You earned %s SP welcome bonus.', v_referee_sp),
        jsonb_build_object(
          'deep_link', 'SpWallet',
          'sp_earned', v_referee_sp,
          'item_id', p_item_id
        )
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_sp_awarded', v_referrer_awarded,
    'referee_sp_awarded', v_referee_awarded
  );
END;
$$ SET search_path = public;
