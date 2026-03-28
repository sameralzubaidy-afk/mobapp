-- Migration: Backfill profile phone/DOB and harden admin_get_user_detail identity sourcing
-- Mode: Idempotent rerunnable migration (Mode B)
-- Why:
-- 1) Existing users can have phone/dob in auth metadata but NULL/blank in profiles.
-- 2) admin_get_user_detail previously read au.phone + p.dob only, causing TC-009 to show N/A.

-- BLOCK 1: Schema logic (function update)
CREATE OR REPLACE FUNCTION admin_get_user_detail(
  p_admin_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  SELECT jsonb_build_object(
    'identity', jsonb_build_object(
      'user_id', p.user_id,
      'profile_id', p.id,
      'name', p.name,
      'email', au.email,
      'phone', COALESCE(
        NULLIF(BTRIM(p.phone), ''),
        NULLIF(BTRIM(au.phone), ''),
        NULLIF(BTRIM(au.raw_user_meta_data ->> 'phone'), '')
      ),
      'avatar_url', p.avatar_url,
      'date_of_birth', COALESCE(
        p.dob,
        CASE
          WHEN COALESCE(
            NULLIF(BTRIM(au.raw_user_meta_data ->> 'dob'), ''),
            NULLIF(BTRIM(au.raw_user_meta_data ->> 'date_of_birth'), '')
          ) ~ '^\d{4}-\d{2}-\d{2}$'
          THEN COALESCE(
            NULLIF(BTRIM(au.raw_user_meta_data ->> 'dob'), ''),
            NULLIF(BTRIM(au.raw_user_meta_data ->> 'date_of_birth'), '')
          )::DATE
          ELSE NULL
        END
      ),
      'account_status', p.account_status,
      'registered_at', p.created_at,
      'last_login_at', au.last_sign_in_at,
      'email_verified', au.email_confirmed_at IS NOT NULL,
      'phone_verified', p.phone_verified,
      'suspended_at', p.suspended_at,
      'suspension_reason', p.suspension_reason
    ),
    'subscription', (
      SELECT jsonb_build_object(
        'status', s.status,
        'tier', COALESCE(st.display_name, st.name, 'free'),
        'started_at', s.created_at,
        'trial_ends_at', s.trial_end_date,
        'period_end_at', s.current_period_end,
        'cancelled_at', s.cancelled_at
      )
      FROM public.subscriptions s
      LEFT JOIN public.subscription_tiers st ON st.id = s.tier_id
      WHERE s.user_id = p.user_id
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    'sp_wallet', (
      SELECT jsonb_build_object(
        'available_balance', sw.available_balance,
        'pending_balance', sw.pending_balance,
        'status', sw.state,
        'lifetime_earned', sw.lifetime_earned,
        'lifetime_spent', sw.lifetime_spent
      )
      FROM public.sp_wallets sw
      WHERE sw.user_id = p.user_id
    ),
    'trade_activity', jsonb_build_object(
      'total_completed', (
        SELECT COUNT(*)
        FROM public.trades t
        WHERE (t.buyer_id = p.user_id OR t.seller_id = p.user_id)
          AND t.status = 'completed'
      ),
      'as_seller', (
        SELECT COUNT(*)
        FROM public.trades t
        WHERE t.seller_id = p.user_id
          AND t.status = 'completed'
      ),
      'as_buyer', (
        SELECT COUNT(*)
        FROM public.trades t
        WHERE t.buyer_id = p.user_id
          AND t.status = 'completed'
      ),
      'last_trade_at', (
        SELECT MAX(t.completed_at)
        FROM public.trades t
        WHERE (t.buyer_id = p.user_id OR t.seller_id = p.user_id)
          AND t.status = 'completed'
      )
    ),
    'badges', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', b.name,
          'icon', b.icon_url,
          'awarded_at', ub.awarded_at
        )
      )
      FROM public.user_badges ub
      JOIN public.badges b ON b.id = ub.badge_id
      WHERE ub.user_id = p.user_id
    ),
    'recent_activity', (
      SELECT jsonb_agg(v_activity.activity_json ORDER BY v_activity.created_at DESC)
      FROM (
        SELECT
          aal.created_at,
          jsonb_build_object(
            'action_type', aal.action_type,
            'performed_by', admin_user.email,
            'created_at', aal.created_at,
            'notes', aal.notes
          ) AS activity_json
        FROM public.admin_activity_log aal
        JOIN auth.users admin_user ON admin_user.id = aal.admin_id
        WHERE aal.entity_type = 'user'
          AND aal.entity_id::TEXT = p.user_id::TEXT
        ORDER BY aal.created_at DESC
        LIMIT 10
      ) AS v_activity
    )
  )
  INTO v_result
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE p.user_id = p_user_id;

  RETURN v_result;
END;
$$;

-- BLOCK 2: Security + performance/data repair
-- Backfill missing/blank profile.phone and missing profile.dob from auth.users metadata.
UPDATE public.profiles p
SET
  phone = COALESCE(
    NULLIF(BTRIM(p.phone), ''),
    NULLIF(BTRIM(au.phone), ''),
    NULLIF(BTRIM(au.raw_user_meta_data ->> 'phone'), '')
  ),
  dob = COALESCE(
    p.dob,
    CASE
      WHEN COALESCE(
        NULLIF(BTRIM(au.raw_user_meta_data ->> 'dob'), ''),
        NULLIF(BTRIM(au.raw_user_meta_data ->> 'date_of_birth'), '')
      ) ~ '^\d{4}-\d{2}-\d{2}$'
      THEN COALESCE(
        NULLIF(BTRIM(au.raw_user_meta_data ->> 'dob'), ''),
        NULLIF(BTRIM(au.raw_user_meta_data ->> 'date_of_birth'), '')
      )::DATE
      ELSE NULL
    END
  )
FROM auth.users au
WHERE au.id = p.user_id
  AND (
    NULLIF(BTRIM(p.phone), '') IS NULL
    OR p.dob IS NULL
  );

-- Verification queries:
-- 1) Columns present
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'profiles'
--   AND column_name IN ('phone', 'dob', 'phone_verified');

-- 2) Function exists
-- SELECT proname
-- FROM pg_proc
-- WHERE proname = 'admin_get_user_detail';

-- 3) Remaining missing mandatory identity values in profiles
-- SELECT
--   COUNT(*) FILTER (WHERE NULLIF(BTRIM(p.phone), '') IS NULL) AS missing_phone,
--   COUNT(*) FILTER (WHERE p.dob IS NULL) AS missing_dob
-- FROM public.profiles p;

-- 4) RPC smoke test
-- SELECT public.admin_get_user_detail(
--   p_admin_id := '<admin_uuid>'::UUID,
--   p_user_id := '<target_user_uuid>'::UUID
-- );

-- Common failure modes:
-- - Invalid DOB metadata format (non-YYYY-MM-DD) will not be cast.
-- - Some legacy accounts may still be missing phone/dob if metadata is absent.
-- - If admin role check fails, RPC raises "User <uuid> is not an admin".