-- Migration: Add deletion_type to profiles + user-callable request_account_deletion RPC
-- Mode B: idempotent / rerunnable
-- Covers: FLOW-25 self-deletion tracking, visible in admin users page

-- ==============================================================================
-- BLOCK 1: Schema + Functions
-- ==============================================================================

-- 1. Add deletion_type column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_type TEXT CHECK (deletion_type IN ('self', 'admin'));

-- 2. Create user-callable RPC: request_account_deletion
--    SECURITY DEFINER so it can update the profile and freeze the wallet
--    regardless of RLS policies on those tables.
--    The calling user's auth.uid() is the subject — no privilege escalation.
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_rows_updated INTEGER;
BEGIN
  -- SECURITY DEFINER: safe because we use auth.uid() — the caller can only
  -- delete their own account.
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Soft-delete the profile.
  -- deletion_type column added by this migration (ADD COLUMN IF NOT EXISTS).
  -- account_status enum is ('active','suspended','banned') — no 'deleted' value;
  -- admin_list_users derives 'deleted' from deleted_at IS NOT NULL.
  UPDATE public.profiles
  SET
    deleted_at      = now(),
    deleted_by      = v_user_id,
    deletion_reason = 'Self-requested account deletion',
    deletion_type   = 'self',
    updated_at      = now()
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found for user');
  END IF;

  -- Freeze SP wallet if it exists (no-op if wallet row absent)
  UPDATE public.sp_wallets
  SET state = 'frozen'
  WHERE user_id = v_user_id;

  -- Audit log — non-fatal: if table is unavailable, deletion still succeeds
  BEGIN
    INSERT INTO public.admin_activity_log (admin_id, action_type, entity_type, entity_id, notes)
    VALUES (v_user_id, 'self_delete_account', 'user', v_user_id, 'User self-requested account deletion');
  EXCEPTION WHEN OTHERS THEN
    -- Log the audit failure as a warning but do not roll back the deletion
    RAISE WARNING '[request_account_deletion] Audit log insert failed: % %', SQLERRM, SQLSTATE;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'Account marked for deletion');
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_account_deletion() FROM anon;

-- 3. Update admin_delete_user to set deletion_type = 'admin'
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_admin_id UUID,
  p_user_id  UUID,
  p_reason   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Prevent admin from deleting themselves
  IF p_user_id = p_admin_id THEN
    RAISE EXCEPTION 'Admin cannot delete their own account';
  END IF;

  -- Require a reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Deletion reason is required';
  END IF;

  -- Soft delete
  UPDATE public.profiles
  SET
    deleted_at      = now(),
    deleted_by      = p_admin_id,
    deletion_reason = p_reason,
    deletion_type   = 'admin',
    updated_at      = now()
  WHERE user_id = p_user_id;

  -- Freeze SP wallet
  UPDATE public.sp_wallets
  SET state = 'frozen'
  WHERE user_id = p_user_id;

  -- Audit log
  INSERT INTO public.admin_activity_log (admin_id, action_type, entity_type, entity_id, notes)
  VALUES (p_admin_id, 'delete_user', 'user', p_user_id::TEXT, p_reason);

  RETURN jsonb_build_object('success', true, 'message', 'User deleted successfully (soft delete)');
END;
$$;

-- 4. Update admin_list_users to include deletion_type in the returned JSON
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_admin_id           UUID,
  p_search             TEXT    DEFAULT NULL,
  p_account_status     TEXT    DEFAULT NULL,
  p_subscription_status TEXT   DEFAULT NULL,
  p_node_id            TEXT    DEFAULT NULL,
  p_page               INTEGER DEFAULT 1,
  p_page_size          INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset          INTEGER;
  v_total           INTEGER;
  v_users           JSONB;
  v_node_id         UUID;
  v_show_deleted_only BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  v_offset            := (p_page - 1) * p_page_size;
  v_show_deleted_only := (COALESCE(p_account_status, '') = 'deleted');

  IF p_node_id IS NOT NULL AND btrim(p_node_id) <> '' THEN
    v_node_id := p_node_id::UUID;
  END IF;

  -- Count
  SELECT COUNT(*)
  INTO v_total
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
    AND s.id = (
      SELECT s2.id FROM public.subscriptions s2
      WHERE s2.user_id = p.user_id
      ORDER BY s2.created_at DESC LIMIT 1
    )
  WHERE (
      (v_show_deleted_only     AND p.deleted_at IS NOT NULL)
      OR (NOT v_show_deleted_only AND p.deleted_at IS NULL)
    )
    AND (
      p_search IS NULL
      OR p.name    ILIKE '%' || p_search || '%'
      OR au.email  ILIKE '%' || p_search || '%'
      OR au.phone  ILIKE '%' || p_search || '%'
    )
    AND (
      p_account_status IS NULL
      OR p_account_status = ''
      OR p_account_status = 'deleted'
      OR p.account_status::TEXT = p_account_status
    )
    AND (
      p_subscription_status IS NULL
      OR (p_subscription_status = 'none' AND s.id IS NULL)
      OR s.status = p_subscription_status
    )
    AND (v_node_id IS NULL OR p.node_id = v_node_id);

  -- Rows
  SELECT jsonb_agg(v_row.user_json ORDER BY v_row.created_at DESC)
  INTO v_users
  FROM (
    SELECT
      p.created_at,
      jsonb_build_object(
        'id',                   p.id,
        'user_id',              p.user_id,
        'name',                 p.name,
        'email',                au.email,
        'phone',                au.phone,
        'avatar_url',           p.avatar_url,
        'account_status',       CASE
                                  WHEN p.deleted_at IS NOT NULL THEN 'deleted'
                                  ELSE p.account_status::TEXT
                                END,
        'deletion_type',        p.deletion_type,
        'subscription_status',  COALESCE(s.status, 'none'),
        'subscription_tier',    COALESCE(st.display_name, st.name, 'free'),
        'node_id',              p.node_id,
        'registered_at',        p.created_at,
        'last_login_at',        au.last_sign_in_at,
        'trade_count', (
          SELECT COUNT(*) FROM public.trades t
          WHERE (t.buyer_id = p.user_id OR t.seller_id = p.user_id)
            AND t.status = 'completed'
        ),
        'sp_balance', COALESCE(
          (SELECT sw.available_balance FROM public.sp_wallets sw WHERE sw.user_id = p.user_id),
          0
        ),
        'badge_count', (
          SELECT COUNT(*) FROM public.user_badges ub WHERE ub.user_id = p.user_id
        )
      ) AS user_json
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.user_id
    LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
      AND s.id = (
        SELECT s2.id FROM public.subscriptions s2
        WHERE s2.user_id = p.user_id
        ORDER BY s2.created_at DESC LIMIT 1
      )
    LEFT JOIN public.subscription_tiers st ON st.id = s.tier_id
    WHERE (
        (v_show_deleted_only     AND p.deleted_at IS NOT NULL)
        OR (NOT v_show_deleted_only AND p.deleted_at IS NULL)
      )
      AND (
        p_search IS NULL
        OR p.name    ILIKE '%' || p_search || '%'
        OR au.email  ILIKE '%' || p_search || '%'
        OR au.phone  ILIKE '%' || p_search || '%'
      )
      AND (
        p_account_status IS NULL
        OR p_account_status = ''
        OR p_account_status = 'deleted'
        OR p.account_status::TEXT = p_account_status
      )
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
    'users',      COALESCE(v_users, '[]'::jsonb),
    'total',      v_total,
    'page',       p_page,
    'page_size',  p_page_size,
    'total_pages', CEIL(v_total::NUMERIC / p_page_size)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_list_users(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER)
  IS 'Returns paginated user list for admin. Includes deletion_type (self/admin) for deleted users.';

-- ==============================================================================
-- BLOCK 2: Verification queries (run after applying)
-- ==============================================================================
-- 1. Confirm column exists:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'profiles' AND column_name = 'deletion_type';
--
-- 2. Confirm RPC exists:
--    SELECT proname FROM pg_proc WHERE proname = 'request_account_deletion';
--
-- 3. Confirm admin_list_users includes deletion_type:
--    SELECT proname, prosrc FROM pg_proc WHERE proname = 'admin_list_users'
--    AND prosrc LIKE '%deletion_type%';
