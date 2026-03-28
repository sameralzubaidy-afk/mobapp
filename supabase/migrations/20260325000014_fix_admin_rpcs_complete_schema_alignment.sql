-- Migration: Fix ADMIN-V2-006 schema mismatches: transactions→trades + balance→available_balance
-- Date: 2026-03-25
-- Mode: Idempotent rerunnable migration
-- Issues Fixed:
--   1. admin_list_users and admin_get_user_detail referenced non-existent "transactions" table (should be "trades")
--   2. admin RPCs referenced sw.balance which does not exist (should be sw.available_balance)
--   3. admin_get_user_detail missing sw.pending_balance in response

-- ===============================================
-- RPC 1: admin_list_users (complete fix)
-- ===============================================
CREATE OR REPLACE FUNCTION admin_list_users(
  p_admin_id UUID,
  p_search TEXT DEFAULT NULL,
  p_account_status TEXT DEFAULT NULL,
  p_subscription_status TEXT DEFAULT NULL,
  p_node_id TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INTEGER;
  v_total INTEGER;
  v_users JSONB;
  v_node_id UUID;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  -- Normalize optional node filter to UUID to avoid uuid=text comparison errors
  IF p_node_id IS NOT NULL AND btrim(p_node_id) <> '' THEN
    v_node_id := p_node_id::UUID;
  END IF;

  -- Total count (for pagination)
  SELECT COUNT(*)
  INTO v_total
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  LEFT JOIN subscriptions s ON s.user_id = p.user_id
    AND s.id = (
      SELECT s2.id
      FROM subscriptions s2
      WHERE s2.user_id = p.user_id
      ORDER BY s2.created_at DESC
      LIMIT 1
    )
  LEFT JOIN subscription_tiers st ON st.id = s.tier_id
  WHERE p.deleted_at IS NULL
    AND (
      p_search IS NULL
      OR p.name ILIKE '%' || p_search || '%'
      OR au.email ILIKE '%' || p_search || '%'
      OR au.phone ILIKE '%' || p_search || '%'
    )
    AND (p_account_status IS NULL OR p.account_status::TEXT = p_account_status)
    AND (
      p_subscription_status IS NULL
      OR (p_subscription_status = 'none' AND s.id IS NULL)
      OR s.status = p_subscription_status
    )
    AND (v_node_id IS NULL OR p.node_id = v_node_id);

  -- Fetch paginated users
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'user_id', p.user_id,
      'name', p.name,
      'email', au.email,
      'phone', au.phone,
      'avatar_url', p.avatar_url,
      'account_status', p.account_status,
      'subscription_status', COALESCE(s.status, 'none'),
      'subscription_tier', COALESCE(st.display_name, st.name, 'free'),
      'node_id', p.node_id,
      'registered_at', p.created_at,
      'last_login_at', au.last_sign_in_at,
      'trade_count', (
        SELECT COUNT(*)
        FROM trades t
        WHERE (t.buyer_id = p.user_id OR t.seller_id = p.user_id)
          AND t.status = 'completed'
      ),
      'sp_balance', COALESCE(
        (
          SELECT sw.available_balance
          FROM sp_wallets sw
          WHERE sw.user_id = p.user_id
        ),
        0
      ),
      'badge_count', (
        SELECT COUNT(*)
        FROM user_badges ub
        WHERE ub.user_id = p.user_id
      )
    )
  )
  INTO v_users
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  LEFT JOIN subscriptions s ON s.user_id = p.user_id
    AND s.id = (
      SELECT s2.id
      FROM subscriptions s2
      WHERE s2.user_id = p.user_id
      ORDER BY s2.created_at DESC
      LIMIT 1
    )
  LEFT JOIN subscription_tiers st ON st.id = s.tier_id
  WHERE p.deleted_at IS NULL
    AND (
      p_search IS NULL
      OR p.name ILIKE '%' || p_search || '%'
      OR au.email ILIKE '%' || p_search || '%'
      OR au.phone ILIKE '%' || p_search || '%'
    )
    AND (p_account_status IS NULL OR p.account_status::TEXT = p_account_status)
    AND (
      p_subscription_status IS NULL
      OR (p_subscription_status = 'none' AND s.id IS NULL)
      OR s.status = p_subscription_status
    )
    AND (v_node_id IS NULL OR p.node_id = v_node_id)
  ORDER BY p.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;

  RETURN jsonb_build_object(
    'users', COALESCE(v_users, '[]'::jsonb),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(v_total::NUMERIC / p_page_size)
  );
END;
$$;

-- ===============================================
-- RPC 2: admin_get_user_detail (complete fix)
-- ===============================================
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

-- ===============================================
-- Verification Queries
-- ===============================================
-- After applying this migration, run these queries in Supabase SQL Editor:

-- 1. Verify functions were updated:
-- SELECT proname, pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('admin_list_users', 'admin_get_user_detail');

-- 2. Verify no "transactions" references remain:
-- SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('admin_list_users', 'admin_get_user_detail') AND pg_get_functiondef(oid) LIKE '%FROM transactions%';
-- Expected: 0 rows

-- 3. Verify no "sw.balance" references remain:
-- SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('admin_list_users', 'admin_get_user_detail') AND pg_get_functiondef(oid) LIKE '%sw.balance%';
-- Expected: 0 rows

-- 4. Test admin_list_users (replace <admin-user-id> with your admin UUID):
-- SELECT admin_list_users('<admin-user-id>'::uuid, NULL, NULL, NULL, NULL, 1, 20);

-- 5. Test admin_get_user_detail (replace both UUIDs):
-- SELECT admin_get_user_detail('<admin-user-id>'::uuid, '<target-user-id>'::uuid);
