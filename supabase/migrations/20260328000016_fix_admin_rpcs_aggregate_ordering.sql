-- Migration: Fix admin RPC aggregate ordering errors
-- Mode: Idempotent rerunnable migration (Mode B)
-- Issue: "column p.created_at must appear in the GROUP BY clause"
-- Root cause: jsonb_agg used with top-level ORDER BY/LIMIT in same SELECT.

-- =====================================================================
-- BLOCK 1: Fix admin_list_users aggregation ordering
-- =====================================================================
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
      SELECT s2.id FROM subscriptions s2
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

  -- Fetch page rows first, then aggregate.
  SELECT jsonb_agg(v_row.user_json ORDER BY v_row.created_at DESC)
  INTO v_users
  FROM (
    SELECT
      p.created_at,
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
      ) AS user_json
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
    OFFSET v_offset
  ) AS v_row;

  RETURN jsonb_build_object(
    'users', COALESCE(v_users, '[]'::jsonb),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(v_total::NUMERIC / p_page_size)
  );
END;
$$;

-- =====================================================================
-- BLOCK 2: Fix admin_get_user_detail recent_activity aggregation ordering
-- =====================================================================
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

-- =====================================================================
-- BLOCK 3: Verification queries
-- =====================================================================
-- 1) Verify function text no longer includes top-level aggregate ORDER BY on p.created_at:
-- SELECT proname FROM pg_proc
-- WHERE proname = 'admin_list_users' AND prosrc LIKE '%ORDER BY p.created_at DESC%LIMIT p_page_size%';

-- 2) Verify RPC compiles and returns payload:
-- SELECT admin_list_users(
--   p_admin_id := '<admin_uuid>'::UUID,
--   p_page := 1,
--   p_page_size := 5
-- );

-- 3) Verify user detail recent activity compiles:
-- SELECT admin_get_user_detail(
--   p_admin_id := '<admin_uuid>'::UUID,
--   p_user_id := '<user_uuid>'::UUID
-- );
