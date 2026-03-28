-- Migration: Fix admin_get_user_detail wallet state, DOB, SP lifetime source, badge icon column, and entity_id cast mismatches
-- Mode: Idempotent rerunnable migration (Mode B)
-- Issues:
--   1) profiles uses "dob" column, not "date_of_birth"
--   2) sp_wallets uses "state" column, not "status"
--   3) lifetime values should come from sp_wallets columns, not non-existent sp_transactions table
--   4) badges uses "icon_url" column, not "icon"
--   5) admin_activity_log.entity_id comparison must cast safely to text

CREATE OR REPLACE FUNCTION admin_get_user_detail(
  p_admin_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM role_based_access_control rbac
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
      'phone', au.phone,
      'avatar_url', p.avatar_url,
      'date_of_birth', p.dob,
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
      FROM subscriptions s
      LEFT JOIN subscription_tiers st ON st.id = s.tier_id
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
      FROM sp_wallets sw
      WHERE sw.user_id = p.user_id
    ),
    'trade_activity', jsonb_build_object(
      'total_completed', (
        SELECT COUNT(*)
        FROM trades t
        WHERE (t.buyer_id = p.user_id OR t.seller_id = p.user_id)
          AND t.status = 'completed'
      ),
      'as_seller', (
        SELECT COUNT(*)
        FROM trades t
        WHERE t.seller_id = p.user_id
          AND t.status = 'completed'
      ),
      'as_buyer', (
        SELECT COUNT(*)
        FROM trades t
        WHERE t.buyer_id = p.user_id
          AND t.status = 'completed'
      ),
      'last_trade_at', (
        SELECT MAX(t.completed_at)
        FROM trades t
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
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
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
        FROM admin_activity_log aal
        JOIN auth.users admin_user ON admin_user.id = aal.admin_id
        WHERE aal.entity_type = 'user'
          AND aal.entity_id::TEXT = p.user_id::TEXT
        ORDER BY aal.created_at DESC
        LIMIT 10
      ) AS v_activity
    )
  )
  INTO v_result
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE p.user_id = p_user_id;

  RETURN v_result;
END;
$$;

-- Verification
-- SELECT admin_get_user_detail(
--   p_admin_id := '<admin_uuid>'::UUID,
--   p_user_id := '<user_uuid>'::UUID
-- );
