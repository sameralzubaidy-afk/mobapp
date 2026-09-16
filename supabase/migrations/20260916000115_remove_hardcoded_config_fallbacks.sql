-- =====================================================
-- FILE: supabase/migrations/20260804000001_remove_hardcoded_config_fallbacks.sql
-- TASK: REF-V2-007 follow-up — remove ALL hardcoded fallback values for
--   admin-configurable referral settings. When a config key is missing from
--   sp_config, functions must FAIL and REPORT (structured error, RAISE, or a
--   debug_logs entry) instead of silently using a hardcoded number.
--
--   Depends on public.sp_config_int() / public.sp_config_bool() which are
--   created in 20260803000001_fix_referral_sp_config_jsonb_casts.sql.
--
-- Behavior by function type:
--   * JSONB RPCs (apply_referral_code): return {success:false, error:'SP_CONFIG_MISSING', details:'<key>'}
--   * Read RPCs (get_referral_*_config): RAISE EXCEPTION so callers/admin see it
--   * Triggers (handle_*/process_*): NEVER raise (would block a user's trade/
--     listing transaction). Skip the reward AND log SP_CONFIG_MISSING to
--     debug_logs so the admin is aware.
--
-- Mode: Idempotent rerunnable migration (CREATE OR REPLACE FUNCTION).
-- =====================================================

-- =============================================================================
-- 1) apply_referral_code — First Trade / Signup referral reward (FAIL LOUD)
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
  v_referee_sp INTEGER;
  v_referrer_sp INTEGER;
  v_already_referred BOOLEAN;
  v_referrer_profile_id UUID;
  v_referee_profile_id UUID;
  v_clean_code TEXT;
BEGIN
  v_clean_code := LOWER(TRIM(p_code));

  -- Check if already referred
  SELECT (referred_by IS NOT NULL) INTO v_already_referred
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_already_referred THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already applied');
  END IF;

  -- Find referrer (case insensitive)
  SELECT user_id, id INTO v_referrer_id, v_referrer_profile_id
  FROM public.profiles
  WHERE LOWER(referral_code) = v_clean_code;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Reward amounts from config — FAIL LOUD if missing (no hardcoded fallback).
  v_referee_sp := public.sp_config_int('referral_reward_referee_sp');
  IF v_referee_sp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'referral_reward_referee_sp');
  END IF;

  v_referrer_sp := public.sp_config_int('referral_reward_referrer_sp');
  IF v_referrer_sp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'referral_reward_referrer_sp');
  END IF;

  -- Apply referral to profile (including the code string)
  UPDATE public.profiles
  SET
    referred_by = v_referrer_id,
    referred_by_code = v_clean_code
  WHERE user_id = p_user_id
  RETURNING id INTO v_referee_profile_id;

  -- Create record in referrals table so dashboard shows history
  INSERT INTO public.referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status
  )
  VALUES (
    v_referrer_id,
    p_user_id,
    v_clean_code,
    'pending'
  )
  ON CONFLICT DO NOTHING;

  -- Credit referee (immediate)
  PERFORM public.adjust_sp_wallet(p_user_id, v_referee_sp, 'referral_bonus', 'Referral bonus from ' || p_code);

  -- Credit referrer (initial signup reward)
  PERFORM public.adjust_sp_wallet(v_referrer_id, v_referrer_sp, 'referral_reward', 'Referral reward for ' || p_code);

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'referrer_id', v_referrer_id,
      'points_awarded', v_referee_sp
    )
  );
END;
$$;

-- =============================================================================
-- 2) get_referral_config_values — read config; RAISE on missing key
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_referral_config_values()
RETURNS TABLE (referee_sp INTEGER, referrer_sp INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referee_sp INTEGER;
  v_referrer_sp INTEGER;
BEGIN
  v_referee_sp := public.sp_config_int('referral_reward_referee_sp');
  IF v_referee_sp IS NULL THEN
    RAISE EXCEPTION 'SP_CONFIG_MISSING: referral_reward_referee_sp';
  END IF;

  v_referrer_sp := public.sp_config_int('referral_reward_referrer_sp');
  IF v_referrer_sp IS NULL THEN
    RAISE EXCEPTION 'SP_CONFIG_MISSING: referral_reward_referrer_sp';
  END IF;

  RETURN QUERY SELECT v_referee_sp, v_referrer_sp;
END;
$$;

-- =============================================================================
-- 3) get_referral_listing_config — read config; RAISE on missing key
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_referral_listing_config()
RETURNS TABLE (
  referrer_listing_sp INTEGER,
  referee_listing_sp INTEGER,
  first_listing_enabled BOOLEAN,
  referrer_sp INTEGER,
  referee_sp INTEGER,
  program_enabled BOOLEAN,
  first_trade_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_listing_sp INTEGER;
  v_referee_listing_sp INTEGER;
  v_referrer_sp INTEGER;
  v_referee_sp INTEGER;
  v_first_listing_enabled BOOLEAN;
  v_program_enabled BOOLEAN;
  v_first_trade_enabled BOOLEAN;
BEGIN
  v_referrer_listing_sp := public.sp_config_int('referral_reward_referrer_listing_sp');
  IF v_referrer_listing_sp IS NULL THEN
    RAISE EXCEPTION 'SP_CONFIG_MISSING: referral_reward_referrer_listing_sp';
  END IF;

  v_referee_listing_sp := public.sp_config_int('referral_reward_referee_listing_sp');
  IF v_referee_listing_sp IS NULL THEN
    RAISE EXCEPTION 'SP_CONFIG_MISSING: referral_reward_referee_listing_sp';
  END IF;

  v_first_listing_enabled := public.sp_config_bool('referral_first_listing_enabled');
  IF v_first_listing_enabled IS NULL THEN
    RAISE EXCEPTION 'SP_CONFIG_MISSING: referral_first_listing_enabled';
  END IF;

  v_referrer_sp := public.sp_config_int('referral_reward_referrer_sp');
  IF v_referrer_sp IS NULL THEN
    RAISE EXCEPTION 'SP_CONFIG_MISSING: referral_reward_referrer_sp';
  END IF;

  v_referee_sp := public.sp_config_int('referral_reward_referee_sp');
  IF v_referee_sp IS NULL THEN
    RAISE EXCEPTION 'SP_CONFIG_MISSING: referral_reward_referee_sp';
  END IF;

  v_program_enabled := public.sp_config_bool('referral_program_enabled');
  IF v_program_enabled IS NULL THEN
    RAISE EXCEPTION 'SP_CONFIG_MISSING: referral_program_enabled';
  END IF;

  v_first_trade_enabled := public.sp_config_bool('referral_first_trade_enabled');
  IF v_first_trade_enabled IS NULL THEN
    RAISE EXCEPTION 'SP_CONFIG_MISSING: referral_first_trade_enabled';
  END IF;

  RETURN QUERY SELECT
    v_referrer_listing_sp,
    v_referee_listing_sp,
    v_first_listing_enabled,
    v_referrer_sp,
    v_referee_sp,
    v_program_enabled,
    v_first_trade_enabled;
END;
$$;

-- =============================================================================
-- 4) handle_referral_rewards_on_trade_completion — trigger on trades
--    NEVER raises (would block the trade transaction). Missing config → skip
--    the reward AND log SP_CONFIG_MISSING to debug_logs so the admin is aware.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_referral_rewards_on_trade_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_sp INTEGER;
  v_program_enabled BOOLEAN;
  v_trade_enabled BOOLEAN;
BEGIN
  v_program_enabled := public.sp_config_bool('referral_program_enabled');
  v_trade_enabled := public.sp_config_bool('referral_first_trade_enabled');

  IF v_program_enabled IS NULL OR v_trade_enabled IS NULL THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('referral_reward', 'SP_CONFIG_MISSING (toggle) — referral reward skipped',
      jsonb_build_object(
        'program_enabled', v_program_enabled,
        'trade_enabled', v_trade_enabled,
        'trade_id', NEW.id
      ));
    RETURN NEW;
  END IF;

  IF NOT v_program_enabled OR NOT v_trade_enabled THEN
    RETURN NEW;
  END IF;

  -- Only process completed trades
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Check if buyer was referred
    SELECT referred_by INTO v_referrer_id
    FROM public.profiles
    WHERE user_id = NEW.buyer_id AND referred_by IS NOT NULL;

    IF v_referrer_id IS NOT NULL THEN
      v_referrer_sp := public.sp_config_int('referral_reward_referrer_sp');
      IF v_referrer_sp IS NULL THEN
        INSERT INTO debug_logs (process_name, message, payload)
        VALUES ('referral_reward', 'SP_CONFIG_MISSING: referral_reward_referrer_sp — reward skipped',
          jsonb_build_object('trade_id', NEW.id, 'referrer_id', v_referrer_id));
        RETURN NEW;
      END IF;

      -- Credit referrer
      PERFORM public.adjust_sp_wallet(
        v_referrer_id,
        v_referrer_sp,
        'referral_reward',
        'Referral reward for completed trade ' || NEW.id
      );

      INSERT INTO debug_logs (process_name, message, payload)
      VALUES ('referral_reward', 'Trade completion reward',
        jsonb_build_object(
          'trade_id', NEW.id,
          'referrer_id', v_referrer_id,
          'buyer_id', NEW.buyer_id,
          'amount', v_referrer_sp
        ));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 5) process_referral_bonus_on_listing_v2 — trigger on items
--    NEVER raises (would block the listing transaction). Missing config → skip
--    and log SP_CONFIG_MISSING to debug_logs so the admin is aware.
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

  -- We trigger when a listing becomes 'available'
  IF (NEW.status = 'available' AND (OLD.status IS NULL OR OLD.status <> 'available')) THEN
    v_referee_user_id := NEW.seller_id;

    -- 1. Check if user was referred
    SELECT referred_by INTO v_referrer_user_id
    FROM public.profiles
    WHERE user_id = v_referee_user_id;

    IF v_referrer_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- 2. Find the referral record (pending or completed)
    SELECT id INTO v_referral_id
    FROM public.referrals
    WHERE referrer_user_id = v_referrer_user_id
      AND referred_user_id = v_referee_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_referral_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- 3. FIRST approved listing check
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

    -- 4. Award rewards (award_listing_referral_sp itself fails loud on missing
    --    config; surface that failure to debug_logs so the admin is aware).
    SELECT public.award_listing_referral_sp(
      v_referrer_user_id,
      v_referee_user_id,
      v_referral_id,
      NEW.id
    ) INTO v_result;

    IF (v_result->>'success')::BOOLEAN THEN
      RAISE NOTICE 'Referral listing bonus granted for user % (item %)', v_referee_user_id, NEW.id;
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
-- Grants (idempotent)
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_referral_config_values() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_listing_config() TO authenticated, service_role, anon;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- 1) No function may contain a hardcoded config fallback any more:
--    SELECT proname FROM pg_proc WHERE proname IN ('apply_referral_code',
--      'award_referral_sp','award_listing_referral_sp','get_referral_config_values',
--      'get_referral_listing_config','handle_referral_rewards_on_trade_completion',
--      'process_referral_bonus_on_listing_v2')
--      AND prosrc ~ '#>> ''\{\}''\)::(INTEGER|BOOLEAN|NUMERIC|TEXT), (true|false|[0-9]+)';
--    -> expect 0 rows.
--
-- 2) Sanity: delete a key in a transaction and confirm the RPC fails loud:
--    BEGIN; DELETE FROM sp_config WHERE config_key='referral_reward_referee_sp';
--    SELECT public.award_referral_sp(<uuid>,<uuid>,<uuid>);
--    -> expect {success:false, error:'SP_CONFIG_MISSING', details:'referral_reward_referee_sp'}
--    ROLLBACK;
--
-- 3) Full E2E: re-run REF-V2-007 admin-config suite with RUN_SUPABASE_E2E=true.
