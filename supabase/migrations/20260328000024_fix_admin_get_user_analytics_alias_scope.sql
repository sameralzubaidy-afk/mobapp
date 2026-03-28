-- Hotfix: ADMIN-V2-006 / TC-002 Analytics Header Display
-- Mode A: one-time migration
-- Fixes admin_get_user_analytics() alias scope bug causing:
--   ERROR: missing FROM-clause entry for table "s"

CREATE OR REPLACE FUNCTION public.admin_get_user_analytics(
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1
    FROM public.role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id
      AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  SELECT jsonb_build_object(
    'total_users', (
      SELECT COUNT(*)
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
    ),
    'active_users', (
      SELECT COUNT(*)
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND p.account_status = 'active'
    ),
    'suspended_users', (
      SELECT COUNT(*)
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND p.account_status = 'suspended'
    ),
    'deleted_users', (
      SELECT COUNT(*)
      FROM public.profiles p
      WHERE p.deleted_at IS NOT NULL
    ),
    'new_this_month', (
      SELECT COUNT(*)
      FROM public.profiles p
      WHERE p.created_at >= date_trunc('month', now())
        AND p.deleted_at IS NULL
    ),
    'dau', (
      SELECT COUNT(DISTINCT au.id)
      FROM auth.users au
      JOIN public.profiles p ON p.user_id = au.id
      WHERE au.last_sign_in_at >= now() - interval '1 day'
        AND p.deleted_at IS NULL
    ),
    'mau', (
      SELECT COUNT(DISTINCT au.id)
      FROM auth.users au
      JOIN public.profiles p ON p.user_id = au.id
      WHERE au.last_sign_in_at >= now() - interval '30 days'
        AND p.deleted_at IS NULL
    ),
    'subscription_breakdown', COALESCE((
      SELECT jsonb_object_agg(sub.status, sub.cnt)
      FROM (
        SELECT COALESCE(s.status, 'none') AS status, COUNT(*) AS cnt
        FROM public.profiles p
        LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
          AND s.id = (
            SELECT s2.id
            FROM public.subscriptions s2
            WHERE s2.user_id = p.user_id
            ORDER BY s2.created_at DESC
            LIMIT 1
          )
        WHERE p.deleted_at IS NULL
        GROUP BY COALESCE(s.status, 'none')
      ) sub
    ), '{}'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_get_user_analytics(UUID)
IS 'Admin dashboard user analytics (counts, DAU/MAU, subscription breakdown). Fixed alias scope bug in subscription breakdown aggregation.';
