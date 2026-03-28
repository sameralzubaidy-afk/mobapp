-- Migration: Fix ADMIN-V2-006 user detail tier lookup
-- Date: 2026-03-25
-- Mode: Idempotent rerunnable migration
-- Issue: admin_get_user_detail referenced subscriptions.tier which does not exist

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
    -- Identity
    'identity', jsonb_build_object(
      'user_id', p.user_id,
      'profile_id', p.id,
      'name', p.name,
      'email', au.email,
      'phone', au.phone,
      'avatar_url', p.avatar_url,
      'date_of_birth', p.date_of_birth,
      'account_status', p.account_status,
      'registered_at', p.created_at,
      'last_login_at', au.last_sign_in_at,
      'email_verified', au.email_confirmed_at IS NOT NULL,
      'phone_verified', p.phone_verified,
      'suspended_at', p.suspended_at,
      'suspension_reason', p.suspension_reason
    ),
    -- Subscription
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
    -- SP Wallet
    'sp_wallet', (
      SELECT jsonb_build_object(
        'available_balance', sw.available_balance,
        'pending_balance', sw.pending_balance,
        'status', sw.status,
        'lifetime_earned', (
          SELECT COALESCE(SUM(stx.amount), 0)
          FROM sp_transactions stx
          WHERE stx.user_id = p.user_id
            AND stx.transaction_type = 'earned'
        ),
        'lifetime_spent', (
          SELECT COALESCE(SUM(ABS(stx.amount)), 0)
          FROM sp_transactions stx
          WHERE stx.user_id = p.user_id
            AND stx.transaction_type = 'spent'
        )
      )
      FROM sp_wallets sw
      WHERE sw.user_id = p.user_id
    ),
    -- Trade Activity
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
    -- Badges
    'badges', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', b.name,
          'icon', b.icon,
          'awarded_at', ub.awarded_at
        )
      )
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = p.user_id
    ),
    -- Recent Admin Activity
    'recent_activity', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'action_type', aal.action_type,
          'performed_by', admin_user.email,
          'created_at', aal.created_at,
          'notes', aal.notes
        )
      )
      FROM admin_activity_log aal
      JOIN auth.users admin_user ON admin_user.id = aal.admin_id
      WHERE aal.entity_type = 'user'
        AND aal.entity_id = p.user_id::TEXT
      ORDER BY aal.created_at DESC
      LIMIT 10
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
-- SELECT admin_get_user_detail('<admin-user-id>'::uuid, '<target-user-id>'::uuid);
