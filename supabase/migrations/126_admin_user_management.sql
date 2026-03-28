-- Migration 126: Admin User Management Dashboard
-- Mode: Idempotent rerunnable migration
-- Task: ADMIN-V2-006
-- Adds account status tracking, suspension/deletion columns, and user management RPCs

-- ===============================================
-- BLOCK 1: Schema Changes
-- ===============================================

-- Account status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned');
  END IF;
END $$;

-- Add account-management columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_status account_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Indexes for status-based admin queries
CREATE INDEX IF NOT EXISTS profiles_account_status_idx ON profiles(account_status);
CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx ON profiles(deleted_at) WHERE deleted_at IS NULL;

-- Verification: Check columns exist
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('account_status', 'suspended_at', 'deleted_at');

-- ===============================================
-- BLOCK 2: RPC — Paginated User List with Filters
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

  -- Normalize optional node filter to UUID to avoid uuid=text comparison errors.
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
      SELECT id FROM subscriptions s2
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

  -- Fetch paginated users in a subquery, then aggregate.
  -- This avoids aggregate + top-level ORDER BY/LIMIT conflicts.
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
        'sp_balance', COALESCE((
          SELECT sw.available_balance
          FROM sp_wallets sw
          WHERE sw.user_id = p.user_id
        ), 0),
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

-- ===============================================
-- BLOCK 3: RPC — User Analytics
-- ===============================================
CREATE OR REPLACE FUNCTION admin_get_user_analytics(
  p_admin_id UUID
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
    'total_users', (
      SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL
    ),
    'active_users', (
      SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL AND account_status = 'active'
    ),
    'suspended_users', (
      SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL AND account_status = 'suspended'
    ),
    'deleted_users', (
      SELECT COUNT(*) FROM profiles WHERE deleted_at IS NOT NULL
    ),
    'new_this_month', (
      SELECT COUNT(*) FROM profiles
      WHERE created_at >= date_trunc('month', now())
        AND deleted_at IS NULL
    ),
    'dau', (
      SELECT COUNT(DISTINCT au.id)
      FROM auth.users au
      JOIN profiles p ON p.user_id = au.id
      WHERE au.last_sign_in_at >= now() - interval '1 day'
        AND p.deleted_at IS NULL
    ),
    'mau', (
      SELECT COUNT(DISTINCT au.id)
      FROM auth.users au
      JOIN profiles p ON p.user_id = au.id
      WHERE au.last_sign_in_at >= now() - interval '30 days'
        AND p.deleted_at IS NULL
    ),
    'subscription_breakdown', (
      SELECT jsonb_object_agg(
        COALESCE(s.status, 'none'),
        cnt
      )
      FROM (
        SELECT COALESCE(s.status, 'none') AS status, COUNT(*) AS cnt
        FROM profiles p
        LEFT JOIN subscriptions s ON s.user_id = p.user_id
          AND s.id = (
            SELECT id FROM subscriptions s2
            WHERE s2.user_id = p.user_id
            ORDER BY s2.created_at DESC
            LIMIT 1
          )
        WHERE p.deleted_at IS NULL
        GROUP BY COALESCE(s.status, 'none')
      ) sub
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- ===============================================
-- BLOCK 4: RPC — User Detail (Full Profile)
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
      'date_of_birth', p.dob,
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
        'status', sw.state,
        'lifetime_earned', sw.lifetime_earned,
        'lifetime_spent', sw.lifetime_spent
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
          'icon', b.icon_url,
          'awarded_at', ub.awarded_at
        )
      )
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = p.user_id
    ),
    -- Recent Admin Activity
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

-- ===============================================
-- BLOCK 5: RPC — Suspend User
-- ===============================================
CREATE OR REPLACE FUNCTION admin_suspend_user(
  p_admin_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Prevent empty reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Suspension reason is required';
  END IF;

  -- Suspend the user
  UPDATE profiles
  SET
    account_status = 'suspended',
    suspended_at = now(),
    suspended_by = p_admin_id,
    suspension_reason = p_reason,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Log the action
  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, notes)
  VALUES (p_admin_id, 'suspend_user', 'user', p_user_id, p_reason);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User suspended successfully'
  );
END;
$$;

-- ===============================================
-- BLOCK 6: RPC — Unsuspend User
-- ===============================================
CREATE OR REPLACE FUNCTION admin_unsuspend_user(
  p_admin_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Prevent empty reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Unsuspension reason is required';
  END IF;

  -- Unsuspend the user
  UPDATE profiles
  SET
    account_status = 'active',
    suspended_at = NULL,
    suspended_by = NULL,
    suspension_reason = NULL,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Log the action
  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, notes)
  VALUES (p_admin_id, 'unsuspend_user', 'user', p_user_id, p_reason);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User unsuspended successfully'
  );
END;
$$;

-- ===============================================
-- BLOCK 7: RPC — Soft Delete User
-- ===============================================
CREATE OR REPLACE FUNCTION admin_delete_user(
  p_admin_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Prevent admin from deleting themselves
  IF p_user_id = p_admin_id THEN
    RAISE EXCEPTION 'Admin cannot delete their own account';
  END IF;

  -- Prevent empty reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Deletion reason is required';
  END IF;

  -- Soft delete the user
  UPDATE profiles
  SET
    deleted_at = now(),
    deleted_by = p_admin_id,
    deletion_reason = p_reason,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Freeze the SP wallet (if exists)
  UPDATE sp_wallets
  SET state = 'frozen'
  WHERE user_id = p_user_id;

  -- Log the action
  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, notes)
  VALUES (p_admin_id, 'delete_user', 'user', p_user_id, p_reason);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User deleted successfully (soft delete)'
  );
END;
$$;

-- ===============================================
-- VERIFICATION QUERIES
-- ===============================================
-- Run these queries to verify the migration succeeded:

-- 1. Verify account_status enum exists
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'account_status'::regtype;

-- 2. Verify columns added to profiles
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
--   AND column_name IN ('account_status', 'suspended_at', 'suspended_by', 'suspension_reason', 'deleted_at', 'deleted_by', 'deletion_reason');

-- 3. Verify indexes exist
-- SELECT indexname FROM pg_indexes WHERE tablename = 'profiles' AND indexname IN ('profiles_account_status_idx', 'profiles_deleted_at_idx');

-- 4. Verify RPCs exist
-- SELECT proname FROM pg_proc WHERE proname IN ('admin_list_users', 'admin_get_user_analytics', 'admin_get_user_detail', 'admin_suspend_user', 'admin_unsuspend_user', 'admin_delete_user');
