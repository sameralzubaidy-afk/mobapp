-- =====================================================
-- FILE: supabase/migrations/20260811000003_referral_action_gating_and_notifications.sql
-- MODE: B (idempotent rerunnable migration)
-- TASK: R12 Referral SP Action-Gating + MODULE-11 REF-V2-002/008 consolidation
--
-- PURPOSE:
--   1. apply_referral_code: NO SP awarded at signup (kills the signup "bounce").
--      Respects referral_program_enabled (fail-loud on missing key). Creates the
--      pending referral relationship only.
--   2. handle_referral_rewards_on_trade_completion: FIRST-completed-trade gate
--      (buyer side), routes through the idempotent award_referral_sp (credits
--      BOTH parties, subscriber-gated), marks the referral completed + records
--      trade_bonus_awarded_at. Never blocks the trade transaction.
--   3. process_referral_bonus_on_listing_v2: adds completion marking after a
--      successful listing award. Listing bonus is INDEPENDENT of trade bonus.
--   4. notify_referral_rewards_granted: fires per bonus (trade/listing) with
--      dynamic amounts from sp_config; REMOVES the hardcoded 25/10 fallbacks
--      (fail-loud SP_CONFIG_MISSING -> skip + log).
--   5. Schema: adds nullable trade_bonus_awarded_at / listing_bonus_awarded_at.
--
-- Backward compatible: additive columns (NULL), CREATE OR REPLACE functions keep
-- their existing signatures, triggers re-attached via drop/create (rerunnable).
-- =====================================================

-- =============================================================================
-- BLOCK 1 — Schema (idempotent)
-- =============================================================================

-- Per-bonus award tracking on referrals (drives notifications + idempotency).
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS trade_bonus_awarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_bonus_awarded_at TIMESTAMPTZ;

-- =============================================================================
-- BLOCK 2 — apply_referral_code (R12: NO signup award)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_already_referred BOOLEAN;
  v_program_enabled BOOLEAN;
  v_clean_code TEXT;
BEGIN
  v_clean_code := LOWER(TRIM(p_code));

  -- Program toggle — FAIL LOUD if the key is missing (no hardcoded default).
  v_program_enabled := public.sp_config_bool('referral_program_enabled');
  IF v_program_enabled IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'referral_program_enabled');
  END IF;
  IF NOT v_program_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral program is disabled');
  END IF;

  -- Already referred?
  SELECT (p2.referred_by IS NOT NULL) INTO v_already_referred
  FROM public.profiles p2
  WHERE p2.user_id = p_user_id;

  IF v_already_referred THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already applied');
  END IF;

  -- Find referrer (case insensitive) — profiles first, then referral_codes.
  SELECT p2.user_id INTO v_referrer_id
  FROM public.profiles p2
  WHERE LOWER(p2.referral_code) = v_clean_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    SELECT rc.user_id INTO v_referrer_id
    FROM public.referral_codes rc
    WHERE LOWER(rc.code) = v_clean_code
    LIMIT 1;
  END IF;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Link profile (idempotent).
  UPDATE public.profiles
  SET referred_by = v_referrer_id,
      referred_by_code = v_clean_code,
      updated_at = now()
  WHERE user_id = p_user_id AND referred_by IS NULL;

  -- Create pending referral — NO SP is awarded here (R12: action-gated).
  INSERT INTO public.referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status,
    created_at
  )
  VALUES (
    v_referrer_id,
    p_user_id,
    v_clean_code,
    'pending',
    now()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO debug_logs (process_name, message, payload)
  VALUES ('apply_referral_code', 'Applied (pending, no SP at signup)',
    jsonb_build_object('referee_id', p_user_id, 'referrer_id', v_referrer_id, 'code', v_clean_code));

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'status', 'pending',
    'points_awarded', 0,
    'message', 'Referral code applied. Rewards unlock after their first trade or approved listing.'
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO debug_logs (process_name, message, payload)
  VALUES ('apply_referral_code', 'ERROR', jsonb_build_object('error', SQLERRM, 'user_id', p_user_id, 'code', p_code));
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =============================================================================
-- BLOCK 3 — handle_referral_rewards_on_trade_completion (FIRST-trade gate)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_referral_rewards_on_trade_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
  v_award JSONB;
  v_referrer_awarded INTEGER := 0;
  v_referee_awarded INTEGER := 0;
  v_program_enabled BOOLEAN;
  v_trade_enabled BOOLEAN;
BEGIN
  -- Toggle checks — FAIL LOUD (skip + log) if a key is missing.
  v_program_enabled := public.sp_config_bool('referral_program_enabled');
  v_trade_enabled := public.sp_config_bool('referral_first_trade_enabled');

  IF v_program_enabled IS NULL OR v_trade_enabled IS NULL THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('referral_reward', 'SP_CONFIG_MISSING (toggle) — referral trade reward skipped',
      jsonb_build_object('program_enabled', v_program_enabled, 'trade_enabled', v_trade_enabled, 'trade_id', NEW.id));
    RETURN NEW;
  END IF;

  IF NOT v_program_enabled OR NOT v_trade_enabled THEN
    RETURN NEW;
  END IF;

  -- Only process the transition into 'completed'.
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Buyer is the referee (decision: buyer side only).
    SELECT p2.referred_by INTO v_referrer_id
    FROM public.profiles p2
    WHERE p2.user_id = NEW.buyer_id AND p2.referred_by IS NOT NULL;

    IF v_referrer_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- FIRST completed trade as buyer (count-based gate).
    IF EXISTS (
      SELECT 1 FROM public.trades t
      WHERE t.buyer_id = NEW.buyer_id AND t.status = 'completed' AND t.id <> NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    -- Find a referral that has not yet been trade-rewarded.
    SELECT r.id INTO v_referral_id
    FROM public.referrals r
    WHERE r.referrer_user_id = v_referrer_id
      AND r.referred_user_id = NEW.buyer_id
      AND r.trade_bonus_awarded_at IS NULL
    ORDER BY r.created_at ASC
    LIMIT 1;

    IF v_referral_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Award via the idempotent RPC (credits BOTH parties, subscriber-gated).
    v_award := public.award_referral_sp(v_referrer_id, NEW.buyer_id, v_referral_id);

    IF (v_award->>'success')::BOOLEAN IS TRUE THEN
      v_referrer_awarded := COALESCE((v_award->>'referrer_sp_awarded')::INTEGER, 0);
      v_referee_awarded := COALESCE((v_award->>'referee_sp_awarded')::INTEGER, 0);

      IF v_referrer_awarded > 0 OR v_referee_awarded > 0 THEN
        UPDATE public.referrals
        SET trade_bonus_awarded_at = now(),
            status = 'completed',
            completed_at = now(),
            captured_sp_referrer_amount = v_referrer_awarded,
            captured_sp_referee_amount = v_referee_awarded
        WHERE id = v_referral_id AND trade_bonus_awarded_at IS NULL;

        INSERT INTO debug_logs (process_name, message, payload)
        VALUES ('referral_reward', 'Trade reward granted',
          jsonb_build_object('trade_id', NEW.id, 'referral_id', v_referral_id,
            'referrer_id', v_referrer_id, 'referee_id', NEW.buyer_id,
            'referrer_sp', v_referrer_awarded, 'referee_sp', v_referee_awarded));
      ELSE
        INSERT INTO debug_logs (process_name, message, payload)
        VALUES ('referral_reward', 'Trade reward skipped — both users must be active/trial subscribers',
          jsonb_build_object('trade_id', NEW.id, 'referral_id', v_referral_id,
            'referrer_id', v_referrer_id, 'referee_id', NEW.buyer_id));
      END IF;
    ELSE
      INSERT INTO debug_logs (process_name, message, payload)
      VALUES ('referral_reward', COALESCE(v_award->>'error', 'award_referral_sp failed'),
        jsonb_build_object('trade_id', NEW.id, 'referral_id', v_referral_id, 'result', v_award));
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- BP-4: never block the trade; log to debug_logs.
  INSERT INTO debug_logs (process_name, message, payload)
  VALUES ('handle_referral_rewards_on_trade_completion', 'CRITICAL ERROR',
    jsonb_build_object('error', SQLERRM, 'trade_id', NEW.id));
  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCK 4 — process_referral_bonus_on_listing_v2 (+ completion marking)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_referral_bonus_on_listing_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_id UUID;
  v_referrer_user_id UUID;
  v_referee_user_id UUID;
  v_is_first_listing BOOLEAN;
  v_result JSONB;
  v_referrer_awarded INTEGER := 0;
  v_referee_awarded INTEGER := 0;
  v_program_enabled BOOLEAN;
  v_listing_enabled BOOLEAN;
BEGIN
  v_program_enabled := public.sp_config_bool('referral_program_enabled');
  v_listing_enabled := public.sp_config_bool('referral_first_listing_enabled');

  IF v_program_enabled IS NULL OR v_listing_enabled IS NULL THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('referral_listing_bonus', 'SP_CONFIG_MISSING (toggle) — listing bonus skipped',
      jsonb_build_object(
        'program_enabled', v_program_enabled,
        'listing_enabled', v_listing_enabled,
        'item_id', NEW.id
      ));
    RETURN NEW;
  END IF;

  IF NOT v_program_enabled OR NOT v_listing_enabled THEN
    RETURN NEW;
  END IF;

  -- We trigger when a listing becomes 'available' (approved).
  IF (NEW.status = 'available' AND (OLD.status IS NULL OR OLD.status <> 'available')) THEN
    v_referee_user_id := NEW.seller_id;

    -- 1. Check if user was referred.
    SELECT p2.referred_by INTO v_referrer_user_id
    FROM public.profiles p2
    WHERE p2.user_id = v_referee_user_id;

    IF v_referrer_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- 2. Find the referral record (pending or completed — listing is independent).
    SELECT r.id INTO v_referral_id
    FROM public.referrals r
    WHERE r.referrer_user_id = v_referrer_user_id
      AND r.referred_user_id = v_referee_user_id
    ORDER BY r.created_at DESC
    LIMIT 1;

    IF v_referral_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- 3. FIRST approved listing check.
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.items i
      WHERE i.seller_id = v_referee_user_id
        AND i.status IN ('available', 'pending', 'sold')
        AND i.id <> NEW.id
        AND i.approved_at IS NOT NULL
    ) INTO v_is_first_listing;

    IF NOT v_is_first_listing THEN
      RETURN NEW;
    END IF;

    -- 4. Award rewards (award_listing_referral_sp is per-item idempotent).
    SELECT public.award_listing_referral_sp(
      v_referrer_user_id,
      v_referee_user_id,
      v_referral_id,
      NEW.id
    ) INTO v_result;

    IF (v_result->>'success')::BOOLEAN THEN
      v_referrer_awarded := COALESCE((v_result->>'referrer_sp_awarded')::INTEGER, 0);
      v_referee_awarded := COALESCE((v_result->>'referee_sp_awarded')::INTEGER, 0);

      IF v_referrer_awarded > 0 OR v_referee_awarded > 0 THEN
        -- Mark listing bonus awarded + referral completed (per-bonus tracking).
        UPDATE public.referrals
        SET listing_bonus_awarded_at = now(),
            status = 'completed',
            completed_at = now(),
            listing_bonus_item_id = NEW.id,
            captured_sp_referrer_amount = v_referrer_awarded,
            captured_sp_referee_amount = v_referee_awarded
        WHERE id = v_referral_id AND listing_bonus_awarded_at IS NULL;

        RAISE NOTICE 'Referral listing bonus granted for user % (item %)', v_referee_user_id, NEW.id;
      ELSE
        INSERT INTO debug_logs (process_name, message, payload)
        VALUES ('referral_listing_bonus', 'Listing bonus skipped — both users must be active/trial subscribers',
          jsonb_build_object('item_id', NEW.id, 'referee_user_id', v_referee_user_id,
            'referral_id', v_referral_id));
      END IF;
    ELSE
      INSERT INTO debug_logs (process_name, message, payload)
      VALUES ('referral_listing_bonus', COALESCE(v_result->>'error', 'award_listing_referral_sp failed'),
        jsonb_build_object(
          'item_id', NEW.id,
          'referee_user_id', v_referee_user_id,
          'result', v_result
        ));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCK 5 — notify_referral_rewards_granted (per bonus, dynamic amounts, no fallbacks)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.notify_referral_rewards_granted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_sp INTEGER;
  v_referee_sp INTEGER;
  v_trade_bonus BOOLEAN;
  v_listing_bonus BOOLEAN;
BEGIN
  v_trade_bonus := NEW.trade_bonus_awarded_at IS NOT NULL
    AND OLD.trade_bonus_awarded_at IS DISTINCT FROM NEW.trade_bonus_awarded_at;
  v_listing_bonus := NEW.listing_bonus_awarded_at IS NOT NULL
    AND OLD.listing_bonus_awarded_at IS DISTINCT FROM NEW.listing_bonus_awarded_at;

  IF NOT v_trade_bonus AND NOT v_listing_bonus THEN
    RETURN NEW;
  END IF;

  -- Trade bonus notification.
  IF v_trade_bonus THEN
    v_referrer_sp := public.sp_config_int('referral_reward_referrer_sp');
    v_referee_sp := public.sp_config_int('referral_reward_referee_sp');
    IF v_referrer_sp IS NULL OR v_referee_sp IS NULL THEN
      INSERT INTO debug_logs (process_name, message, payload)
      VALUES ('referral_notification', 'SP_CONFIG_MISSING — trade reward notification skipped',
        jsonb_build_object('referral_id', NEW.id,
          'referrer_sp', v_referrer_sp, 'referee_sp', v_referee_sp));
      RETURN NEW;
    END IF;

    PERFORM public.create_notification(
      NEW.referrer_user_id,
      'referral_rewards_granted',
      format('You Earned %s SP! 💰', v_referrer_sp),
      format('Your referral completed their first trade! You earned %s SP.', v_referrer_sp),
      jsonb_build_object('deep_link', 'ReferralDashboard', 'sp_earned', v_referrer_sp, 'referral_id', NEW.id)
    );

    PERFORM public.create_notification(
      NEW.referred_user_id,
      'referral_welcome_bonus',
      format('Welcome Bonus: %s SP! 🎁', v_referee_sp),
      format('You completed your first trade and earned a welcome bonus of %s SP!', v_referee_sp),
      jsonb_build_object('deep_link', 'SpWallet', 'sp_earned', v_referee_sp, 'referral_id', NEW.id)
    );
  END IF;

  -- Listing bonus notification (independent of trade bonus).
  IF v_listing_bonus THEN
    v_referrer_sp := public.sp_config_int('referral_reward_referrer_listing_sp');
    v_referee_sp := public.sp_config_int('referral_reward_referee_listing_sp');
    IF v_referrer_sp IS NULL OR v_referee_sp IS NULL THEN
      INSERT INTO debug_logs (process_name, message, payload)
      VALUES ('referral_notification', 'SP_CONFIG_MISSING — listing reward notification skipped',
        jsonb_build_object('referral_id', NEW.id,
          'referrer_sp', v_referrer_sp, 'referee_sp', v_referee_sp));
      RETURN NEW;
    END IF;

    PERFORM public.create_notification(
      NEW.referrer_user_id,
      'referral_rewards_granted',
      format('You Earned %s SP! 💰', v_referrer_sp),
      format('Your referral had their first listing approved! You earned %s SP.', v_referrer_sp),
      jsonb_build_object('deep_link', 'ReferralDashboard', 'sp_earned', v_referrer_sp, 'referral_id', NEW.id)
    );

    PERFORM public.create_notification(
      NEW.referred_user_id,
      'referral_welcome_bonus',
      format('Listing Bonus: %s SP! 🎁', v_referee_sp),
      format('Your first listing was approved — welcome bonus of %s SP!', v_referee_sp),
      jsonb_build_object('deep_link', 'SpWallet', 'sp_earned', v_referee_sp, 'referral_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCK 6 — Re-attach triggers (rerunnable: drop/create)
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_referral_rewards_on_trade_completion ON public.trades;
CREATE TRIGGER trigger_referral_rewards_on_trade_completion
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_referral_rewards_on_trade_completion();

DROP TRIGGER IF EXISTS trigger_process_referral_bonus_on_listing ON public.items;
CREATE TRIGGER trigger_process_referral_bonus_on_listing
  AFTER UPDATE OF status ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_bonus_on_listing_v2();

DROP TRIGGER IF EXISTS referral_rewards_notification_trigger ON public.referrals;
CREATE TRIGGER referral_rewards_notification_trigger
  AFTER UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_referral_rewards_granted();

-- =============================================================================
-- VERIFICATION QUERIES (run in Supabase SQL Editor / via MCP after applying)
-- =============================================================================
-- 1) Columns added:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='referrals'
--      AND column_name IN ('trade_bonus_awarded_at','listing_bonus_awarded_at');
--
-- 2) apply_referral_code has NO immediate award:
--    SELECT position('adjust_sp_wallet' in prosrc) > 0 AS still_awards_on_signup
--    FROM pg_proc WHERE proname='apply_referral_code'
--      AND pronamespace='public'::regnamespace;  -- expect false
--
-- 3) Trade trigger has first-trade gate + calls idempotent award:
--    SELECT position('award_referral_sp' in prosrc) > 0 AS calls_idempotent_award,
--           position('trade_bonus_awarded_at' in prosrc) > 0 AS marks_completed
--    FROM pg_proc WHERE proname='handle_referral_rewards_on_trade_completion'
--      AND pronamespace='public'::regnamespace;  -- expect true, true
--
-- 4) Notification trigger has NO hardcoded fallbacks:
--    SELECT position('25' in prosrc) > 0 AS hardcoded_25,
--           position('10' in prosrc) > 0 AS hardcoded_10
--    FROM pg_proc WHERE proname='notify_referral_rewards_granted'
--      AND pronamespace='public'::regnamespace;  -- expect false, false
--
-- 5) Triggers attached:
--    SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgname IN ('trigger_referral_rewards_on_trade_completion',
--                     'trigger_process_referral_bonus_on_listing',
--                     'referral_rewards_notification_trigger');
