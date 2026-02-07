-- File: supabase/migrations/20260204000009_referrals_starter_pack_config.sql
-- Mode B: Idempotent rerunnable migration
-- Purpose:
-- 1) Add tracking for Listing Bonuses and Starter Pack rewards in the referrals table
-- 2) Update listing trigger to record these rewards on the referral record
-- 3) Ensure Starter Pack configuration can be managed properly

-- BLOCK 1 — Schema Changes
-- Add columns to track listing-specific rewards in referrals
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS bonus_points_listing INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_points_referrer_listing INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_points_starter_pack INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_bonus_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL;

-- BLOCK 2 — Logic Updates
-- Update the listing trigger to record the rewards in the referrals table
CREATE OR REPLACE FUNCTION public.process_referral_bonus_on_listing_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_id UUID;
  v_referrer_user_id UUID;
  v_referee_user_id UUID;
  v_is_first_listing BOOLEAN;
  v_result JSONB;
  v_starter_pack_amount INTEGER := 0;
BEGIN
  -- We trigger when a listing becomes 'available' (approved)
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
    -- Try to find by user IDs first as it's most robust
    SELECT id INTO v_referral_id
    FROM public.referrals
    WHERE referred_user_id = v_referee_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Fallback for profile-id based schema if user IDs are missing/different
    IF v_referral_id IS NULL THEN
       SELECT r.id INTO v_referral_id
       FROM public.referrals r
       JOIN public.profiles p ON p.id = r.referee_id
       WHERE p.user_id = v_referee_user_id
       ORDER BY r.created_at DESC
       LIMIT 1;
    END IF;

    IF v_referral_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- 3. FIRST approved listing check
    -- Count listings that were already approved/sold for this user, excluding current
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

    -- 4. Determine Starter Pack amount if awarded
    IF NEW.starter_pack_claimed THEN
      SELECT (config_value)::INTEGER INTO v_starter_pack_amount
      FROM public.sp_config
      WHERE config_key = 'starter_pack_amount';
      
      v_starter_pack_amount := COALESCE(v_starter_pack_amount, 10);
    END IF;

    -- 5. Award rewards (Listing Bonus for Referrer/Referee)
    SELECT public.award_listing_referral_sp(
      v_referrer_user_id,
      v_referee_user_id,
      v_referral_id,
      NEW.id
    ) INTO v_result;

    -- 6. Update referral record with ALL listing-related bonuses
    IF COALESCE((v_result->>'success')::BOOLEAN, FALSE) OR v_starter_pack_amount > 0 THEN
      UPDATE public.referrals
      SET
        bonus_points_listing = COALESCE((v_result->>'referee_sp_awarded')::INTEGER, 0),
        bonus_points_referrer_listing = COALESCE((v_result->>'referrer_sp_awarded')::INTEGER, 0),
        bonus_points_starter_pack = v_starter_pack_amount,
        listing_bonus_item_id = NEW.id
      WHERE id = v_referral_id;
      
      RAISE NOTICE 'Updated referral % with listing bonuses: referrer=%, referee=%, starter_pack=%', 
        v_referral_id, 
        (v_result->>'referrer_sp_awarded'), 
        (v_result->>'referee_sp_awarded'),
        v_starter_pack_amount;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Verification
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'referrals';
