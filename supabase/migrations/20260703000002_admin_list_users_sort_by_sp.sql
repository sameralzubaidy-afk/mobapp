-- Migration: Add sort-by-SP-balance to admin_list_users RPC
-- Mode: Idempotent rerunnable migration (Mode B)
-- Date: 2026-07-03
-- Feature: ADMIN-V2-006 — Allow admin to sort user list by available SP balance
-- Changes:
--   1. Adds p_sort_by (TEXT, default 'registered_at') parameter
--   2. Adds p_sort_order (TEXT, default 'DESC') parameter
--   3. Uses whitelist-validated CASE expressions to prevent SQL injection
--   4. Fallback to p.created_at DESC for unrecognized sort values

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_admin_id           UUID,
  p_search             TEXT    DEFAULT NULL,
  p_account_status     TEXT    DEFAULT NULL,
  p_subscription_status TEXT   DEFAULT NULL,
  p_node_id            TEXT    DEFAULT NULL,
  p_page               INTEGER DEFAULT 1,
  p_page_size          INTEGER DEFAULT 20,
  p_sort_by            TEXT    DEFAULT 'registered_at',
  p_sort_order         TEXT    DEFAULT 'DESC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset            INTEGER;
  v_total             INTEGER;
  v_users             JSONB;
  v_node_id           UUID;
  v_show_deleted_only BOOLEAN;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1
    FROM public.role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  v_offset            := (p_page - 1) * p_page_size;
  v_show_deleted_only := (COALESCE(p_account_status, '') = 'deleted');

  -- Normalize optional node filter to UUID to avoid uuid=text comparison errors
  IF p_node_id IS NOT NULL AND btrim(p_node_id) <> '' THEN
    v_node_id := p_node_id::UUID;
  END IF;

  -- ============================================================================
  -- BLOCK 1: Total count (for pagination)
  -- ============================================================================
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

  -- ============================================================================
  -- BLOCK 2: Fetch paginated users with dynamic sort
  -- ============================================================================
  -- Safety: p_sort_by and p_sort_order are validated against a whitelist.
  -- CASE expressions prevent SQL injection — no dynamic EXECUTE is used.
  -- The ORDER BY is applied INSIDE the subquery (before LIMIT/OFFSET) so the
  -- correct page of users is selected. The outer jsonb_agg is just an identity
  -- aggregation since rows are already in the right order.
  -- Fallback: p.created_at DESC for any unrecognized sort_by value.
  SELECT jsonb_agg(p_row.user_json)
  INTO v_users
  FROM (
    SELECT
      p.user_id,
      p.name,
      p.created_at,
      au.email AS email,
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
    -- Dynamic ORDER BY: sort at the subquery level so LIMIT/OFFSET pick the right rows.
    -- PostgreSQL allows alias references in ORDER BY, so we reference computed values directly.
    ORDER BY
      -- sp_balance descending (highest SP first)
      CASE WHEN p_sort_by = 'sp_balance' AND UPPER(p_sort_order) = 'DESC'
        THEN COALESCE((SELECT sw.available_balance FROM public.sp_wallets sw WHERE sw.user_id = p.user_id), 0)
      END DESC NULLS LAST,
      -- sp_balance ascending (lowest SP first)
      CASE WHEN p_sort_by = 'sp_balance' AND UPPER(p_sort_order) = 'ASC'
        THEN COALESCE((SELECT sw.available_balance FROM public.sp_wallets sw WHERE sw.user_id = p.user_id), 0)
      END ASC NULLS LAST,
      -- trade_count descending
      CASE WHEN p_sort_by = 'trade_count' AND UPPER(p_sort_order) = 'DESC'
        THEN (SELECT COUNT(*) FROM public.trades t WHERE (t.buyer_id = p.user_id OR t.seller_id = p.user_id) AND t.status = 'completed')
      END DESC NULLS LAST,
      -- trade_count ascending
      CASE WHEN p_sort_by = 'trade_count' AND UPPER(p_sort_order) = 'ASC'
        THEN (SELECT COUNT(*) FROM public.trades t WHERE (t.buyer_id = p.user_id OR t.seller_id = p.user_id) AND t.status = 'completed')
      END ASC NULLS LAST,
      -- name descending
      CASE WHEN p_sort_by = 'name' AND UPPER(p_sort_order) = 'DESC' THEN p.name END DESC NULLS LAST,
      -- name ascending
      CASE WHEN p_sort_by = 'name' AND UPPER(p_sort_order) = 'ASC' THEN p.name END ASC NULLS LAST,
      -- email descending
      CASE WHEN p_sort_by = 'email' AND UPPER(p_sort_order) = 'DESC' THEN au.email END DESC NULLS LAST,
      -- email ascending
      CASE WHEN p_sort_by = 'email' AND UPPER(p_sort_order) = 'ASC' THEN au.email END ASC NULLS LAST,
      -- Default: registered_at (p.created_at) descending — also serves as tiebreaker
      p.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) AS p_row;

  RETURN jsonb_build_object(
    'users',      COALESCE(v_users, '[]'::jsonb),
    'total',      v_total,
    'page',       p_page,
    'page_size',  p_page_size,
    'total_pages', CEIL(v_total::NUMERIC / p_page_size)
  );
END;
$$;

-- Update the comment to reflect new parameters
COMMENT ON FUNCTION public.admin_list_users(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT)
  IS 'Returns paginated user list for admin. Supports sort by: registered_at, sp_balance, trade_count, name, email.';

-- ==============================================================================
-- Verification Queries (run after applying):
-- ==============================================================================
-- 1. Confirm new params exist:
--    SELECT pg_get_function_identity_arguments('admin_list_users(UUID,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER,TEXT,TEXT)'::regprocedure);
--
-- 2. Test sort by SP balance DESC:
--    SELECT admin_list_users(
--      p_admin_id := '<admin-uuid>'::UUID,
--      p_sort_by := 'sp_balance',
--      p_sort_order := 'DESC',
--      p_page := 1,
--      p_page_size := 5
--    ) -> 'users' -> 0 -> 'sp_balance';
--
-- 3. Test sort by SP balance ASC:
--    SELECT admin_list_users(
--      p_admin_id := '<admin-uuid>'::UUID,
--      p_sort_by := 'sp_balance',
--      p_sort_order := 'ASC',
--      p_page := 1,
--      p_page_size := 5
--    ) -> 'users' -> 0 -> 'sp_balance';
