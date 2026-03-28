-- Hotfix: ADMIN-V2-006 / TC-005 follow-up
-- Mode A: one-time migration
-- Fix null boolean bug in admin_list_users where p_account_status = NULL returned zero rows.

CREATE OR REPLACE FUNCTION public.admin_list_users(
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
SET search_path = public
AS $$
DECLARE
  v_offset INTEGER;
  v_total INTEGER;
  v_users JSONB;
  v_node_id UUID;
  v_show_deleted_only BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id
      AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  v_offset := (p_page - 1) * p_page_size;
  v_show_deleted_only := (COALESCE(p_account_status, '') = 'deleted');

  IF p_node_id IS NOT NULL AND btrim(p_node_id) <> '' THEN
    v_node_id := p_node_id::UUID;
  END IF;

  SELECT COUNT(*)
  INTO v_total
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
    AND s.id = (
      SELECT s2.id
      FROM public.subscriptions s2
      WHERE s2.user_id = p.user_id
      ORDER BY s2.created_at DESC
      LIMIT 1
    )
  WHERE (
      (v_show_deleted_only AND p.deleted_at IS NOT NULL)
      OR (NOT v_show_deleted_only AND p.deleted_at IS NULL)
    )
    AND (
      p_search IS NULL
      OR p.name ILIKE '%' || p_search || '%'
      OR au.email ILIKE '%' || p_search || '%'
      OR au.phone ILIKE '%' || p_search || '%'
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
        'account_status', CASE
          WHEN p.deleted_at IS NOT NULL THEN 'deleted'
          ELSE p.account_status::TEXT
        END,
        'subscription_status', COALESCE(s.status, 'none'),
        'subscription_tier', COALESCE(st.display_name, st.name, 'free'),
        'node_id', p.node_id,
        'registered_at', p.created_at,
        'last_login_at', au.last_sign_in_at,
        'trade_count', (
          SELECT COUNT(*)
          FROM public.trades t
          WHERE (t.buyer_id = p.user_id OR t.seller_id = p.user_id)
            AND t.status = 'completed'
        ),
        'sp_balance', COALESCE(
          (
            SELECT sw.available_balance
            FROM public.sp_wallets sw
            WHERE sw.user_id = p.user_id
          ),
          0
        ),
        'badge_count', (
          SELECT COUNT(*)
          FROM public.user_badges ub
          WHERE ub.user_id = p.user_id
        )
      ) AS user_json
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.user_id
    LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
      AND s.id = (
        SELECT s2.id
        FROM public.subscriptions s2
        WHERE s2.user_id = p.user_id
        ORDER BY s2.created_at DESC
        LIMIT 1
      )
    LEFT JOIN public.subscription_tiers st ON st.id = s.tier_id
    WHERE (
        (v_show_deleted_only AND p.deleted_at IS NOT NULL)
        OR (NOT v_show_deleted_only AND p.deleted_at IS NULL)
      )
      AND (
        p_search IS NULL
        OR p.name ILIKE '%' || p_search || '%'
        OR au.email ILIKE '%' || p_search || '%'
        OR au.phone ILIKE '%' || p_search || '%'
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
    'users', COALESCE(v_users, '[]'::jsonb),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(v_total::NUMERIC / p_page_size)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_list_users(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER)
IS 'Admin user list filter supports deleted and safely handles NULL account_status without hiding all users.';
