-- UPDATE_APPLY_REFERRAL_RPC.sql
-- Updates apply_referral_code() RPC to handle both old and new column names
-- Run this BEFORE the fix script if your referrals table has referrer_id/referee_id columns

-- Check if old columns exist
DO $$
DECLARE
  has_old_columns BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'referrals' 
      AND column_name IN ('referrer_id', 'referee_id')
  ) INTO has_old_columns;

  IF has_old_columns THEN
    -- Update RPC to populate both old and new columns
    CREATE OR REPLACE FUNCTION public.apply_referral_code(
      p_referee_id UUID,
      p_referral_code TEXT
    )
    RETURNS JSONB AS $func$
    DECLARE
      v_referrer_id UUID;
      v_referee_email TEXT;
      v_referrer_email TEXT;
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

      -- Check both old and new columns for existing referral
      IF EXISTS(
        SELECT 1 FROM public.referrals r 
        WHERE r.referred_user_id = p_referee_id 
           OR r.referee_id = p_referee_id
      ) THEN
        UPDATE public.profiles p
        SET referred_by = v_referrer_id
        WHERE p.user_id = p_referee_id
          AND p.referred_by IS NULL;

        RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
      END IF;

      -- Insert with both old and new columns
      -- Old columns (referrer_id/referee_id) reference public.users (profiles.id)
      -- New columns (referrer_user_id/referred_user_id) reference auth.users
      INSERT INTO public.referrals (
        referrer_id, 
        referee_id, 
        referrer_user_id, 
        referred_user_id, 
        referral_code, 
        status
      )
      SELECT 
        p1.id AS referrer_id,
        p2.id AS referee_id,
        v_referrer_id AS referrer_user_id,
        p_referee_id AS referred_user_id,
        p_referral_code AS referral_code,
        'pending' AS status
      FROM public.profiles p1
      CROSS JOIN public.profiles p2
      WHERE p1.user_id = v_referrer_id
        AND p2.user_id = p_referee_id;

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
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    RAISE NOTICE 'Updated apply_referral_code() to handle both old and new columns';
  ELSE
    RAISE NOTICE 'Old columns (referrer_id/referee_id) not found - no update needed';
  END IF;
END $$;
