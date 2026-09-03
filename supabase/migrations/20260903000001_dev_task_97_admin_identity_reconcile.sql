-- ============================================================================
-- DT97 (Item 2): Reconcile admin-identity checks to ONE canonical source
-- ============================================================================
-- MODE B: idempotent rerunnable migration (DROP-if-exists + CREATE OR REPLACE).
--
-- Problem (verified live on staging 2026-09-03):
--   * `public.is_admin(user_id uuid)` (SECURITY DEFINER) checked
--     `profiles.id = user_id AND role='admin'` — but `profiles` keys on
--     `user_id` (profiles.id is its own PK), so it matched NOBODY, and it
--     required an argument, so `rpc('is_admin')` (no-arg) always errored.
--     -> verifyAdminAuth's JWT path (method 2) could never authorize a real admin.
--   * `public.admin_has_role(p_user_id uuid)` was a multi-source helper but did
--     NOT check `role_based_access_control` (the admin portal's canonical role
--     store per the 2026-08-01 tax-export fix); it relied on the metadata
--     fallback for portal admins.
--   * Six admin RPCs (manual_award_badge, manual_revoke_badge, admin_pause_listing,
--     admin_unpause_listing, admin_force_delete_listing, admin_search_listings_v2)
--     each hard-coded a raw `auth.users.raw_user_meta_data->>'is_admin'='true'`
--     guard instead of calling the canonical helper.
--
-- Canonical decision (owner-approved 2026-09-03): rbac-first COMPAT SUPERSET.
--   role_based_access_control.role='admin'  (CANONICAL portal source)
--   -> profiles.role='admin'                 (app profiles, keyed on user_id)
--   -> user_roles.role='admin'               (legacy, only if table exists)
--   -> auth.users raw_user_meta_data.is_admin (fallback; no admin is locked out)
--
-- Implementation:
--   * `_is_admin_core(p_uid)` = the single shared multi-source check.
--   * `is_admin(p_uid uuid DEFAULT auth.uid())` delegates to the core, so both
--     `rpc('is_admin')` (no-arg) and `is_admin(auth.uid())` (RLS policy on
--     zip_waitlist) resolve identically.
--   * `admin_has_role(p_user_id)` delegates to the same core (removes the
--     is_admin()/admin_has_role() cross-call recursion risk).
--   * The six hard-coded-guard RPCs now call `public.admin_has_role(...)`.
--
-- Grants: the `dt61_guard_revoke_fn_public` EVENT TRIGGER auto-REVOKEs
-- PUBLIC/anon/authenticated on EVERY public-schema CREATE [OR REPLACE]
-- FUNCTION, so each function touched here is explicitly re-granted at the end
-- to its prior role set (BP-79 / BP-78).
--
-- Rollback: restore the prior live bodies captured in DT97 session notes
-- (is_admin was the profiles.id check; admin_has_role the pre-rbac helper; the
-- six RPCs used the raw-metadata EXISTS guard). Guard semantics are a strict
-- superset here, so re-applying is low-risk.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Shared canonical core: rbac -> profiles.role -> user_roles -> metadata
--    SECURITY DEFINER needed because it reads auth.users + role tables across
--    schemas (auth, public) and is called from RLS policies under any role.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_admin_core(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  IF p_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Source 1 (CANONICAL): role_based_access_control — the admin portal's role
  -- store (portal login assigns 'admin' here; 20260801000005 tax fix precedent).
  IF to_regclass('public.role_based_access_control') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.role_based_access_control rbac
      WHERE rbac.user_id = p_uid AND rbac.role = 'admin'
    ) INTO v_is_admin;
    IF v_is_admin THEN RETURN true; END IF;
  END IF;

  -- Source 2: profiles.role (app-level profiles, keyed on user_id).
  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.user_id = p_uid AND pr.role = 'admin'
    ) INTO v_is_admin;
    IF v_is_admin THEN RETURN true; END IF;
  END IF;

  -- Source 3 (legacy): user_roles, present only in older deployments.
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_uid AND ur.role = 'admin'
    ) INTO v_is_admin;
    IF v_is_admin THEN RETURN true; END IF;
  END IF;

  -- Source 4 (fallback): auth.users raw_user_meta_data.is_admin flag.
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = p_uid
      AND COALESCE(au.raw_user_meta_data->>'is_admin', 'false') = 'true'
  ) INTO v_is_admin;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2) is_admin — callable with no args (defaults to auth.uid()) or a specific
--    uid. The old required-arg overload is dropped first (BP-12: signature
--    change requires DROP). The zip_waitlist RLS policy is a tracked function
--    dependency, so it is dropped first and recreated below against the new
--    default-arg is_admin. No view/matview depends on is_admin (verified live).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "zip_waitlist_admin_all" ON public.zip_waitlist;

DROP FUNCTION IF EXISTS public.is_admin(uuid);

CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN COALESCE(public._is_admin_core(p_uid), false);
END;
$$;

-- Recreate the admin RLS policy on zip_waitlist (same definition as before the
-- DROP above: PERMISSIVE, TO PUBLIC, FOR ALL, USING is_admin(auth.uid()) —
-- now resolved by the default-arg is_admin).
CREATE POLICY "zip_waitlist_admin_all" ON public.zip_waitlist
  FOR ALL
  TO PUBLIC
  USING (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3) admin_has_role — same canonical core (rbac-first superset). Replaces the
--    old multi-source body that never checked role_based_access_control.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_has_role(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN COALESCE(public._is_admin_core(p_user_id), false);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4) manual_award_badge — guard swapped from raw metadata EXISTS to the
--    canonical admin_has_role(auth.uid()) (behavior-neutral for the current
--    metadata-flagged admin; now also true for rbac/profiles-only admins).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manual_award_badge(
  p_user_id UUID,
  p_badge_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id UUID;
  v_badge RECORD;
  v_existing_badge RECORD;
BEGIN
  -- Get admin user ID
  v_admin_id := auth.uid();

  -- Verify admin privileges (canonical admin_has_role: rbac-first superset)
  IF v_admin_id IS NULL OR NOT public.admin_has_role(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  -- Verify badge exists
  SELECT * INTO v_badge FROM public.badges WHERE id = p_badge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found';
  END IF;

  -- Check if user already has this badge
  SELECT * INTO v_existing_badge
  FROM public.user_badges
  WHERE user_id = p_user_id AND badge_id = p_badge_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User already has this badge',
      'badge_id', p_badge_id
    );
  END IF;

  -- Award the badge
  INSERT INTO public.user_badges (user_id, badge_id, awarded_at)
  VALUES (p_user_id, p_badge_id, NOW());

  -- Log the manual award
  INSERT INTO public.badge_audit_logs (
    badge_id,
    user_id,
    admin_id,
    action_type,
    reason,
    metadata,
    created_at
  ) VALUES (
    p_badge_id,
    p_user_id,
    v_admin_id,
    'manual_award',
    p_reason,
    jsonb_build_object(
      'badge_name', v_badge.name,
      'admin_action', true
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Badge awarded successfully',
    'badge_id', p_badge_id,
    'badge_name', v_badge.name
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5) manual_revoke_badge — same guard swap.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manual_revoke_badge(
  p_user_id UUID,
  p_badge_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id UUID;
  v_badge RECORD;
  v_deleted_count INT;
BEGIN
  -- Get admin user ID
  v_admin_id := auth.uid();

  -- Verify admin privileges (canonical admin_has_role: rbac-first superset)
  IF v_admin_id IS NULL OR NOT public.admin_has_role(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  -- Verify badge exists
  SELECT * INTO v_badge FROM public.badges WHERE id = p_badge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found';
  END IF;

  -- Delete user badge
  DELETE FROM public.user_badges
  WHERE user_id = p_user_id AND badge_id = p_badge_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User does not have this badge'
    );
  END IF;

  -- Log the revocation
  INSERT INTO public.badge_audit_logs (
    badge_id,
    user_id,
    admin_id,
    action_type,
    reason,
    metadata,
    created_at
  ) VALUES (
    p_badge_id,
    p_user_id,
    v_admin_id,
    'manual_revoke',
    p_reason,
    jsonb_build_object(
      'badge_name', v_badge.name,
      'admin_action', true
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Badge revoked successfully',
    'badge_id', p_badge_id,
    'badge_name', v_badge.name
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6) admin_pause_listing — guard swap to admin_has_role.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_pause_listing(
  p_listing_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
  v_old_status VARCHAR;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();

  -- Verify admin status (canonical admin_has_role: rbac-first superset)
  IF v_admin_id IS NULL OR NOT public.admin_has_role(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can pause listings' USING ERRCODE = '42501';
  END IF;

  -- Get current status
  SELECT status INTO v_old_status FROM public.items WHERE id = p_listing_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '22000';
  END IF;

  -- Pause listing if not already paused/deleted
  IF v_old_status NOT IN ('paused', 'deleted') THEN
    UPDATE public.items
    SET
      status = 'paused',
      updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Log admin action
  INSERT INTO public.admin_listing_actions (admin_id, action_type, listing_id, reason)
  VALUES (v_admin_id, 'pause', p_listing_id, p_reason);

  v_result := jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'action', 'pause',
    'old_status', v_old_status,
    'new_status', 'paused',
    'timestamp', NOW()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7) admin_unpause_listing — guard swap to admin_has_role.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_unpause_listing(
  p_listing_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
  v_old_status VARCHAR;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();

  -- Verify admin status (canonical admin_has_role: rbac-first superset)
  IF v_admin_id IS NULL OR NOT public.admin_has_role(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can unpause listings' USING ERRCODE = '42501';
  END IF;

  -- Get current status
  SELECT status INTO v_old_status FROM public.items WHERE id = p_listing_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '22000';
  END IF;

  -- Unpause listing if currently paused
  IF v_old_status = 'paused' THEN
    UPDATE public.items
    SET
      status = 'available',
      updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Log admin action
  INSERT INTO public.admin_listing_actions (admin_id, action_type, listing_id, reason)
  VALUES (v_admin_id, 'unpause', p_listing_id, p_reason);

  v_result := jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'action', 'unpause',
    'old_status', v_old_status,
    'new_status', 'available',
    'timestamp', NOW()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8) admin_force_delete_listing — guard swap to admin_has_role.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_force_delete_listing(
  p_listing_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
  v_old_status VARCHAR;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();

  -- Verify admin status (canonical admin_has_role: rbac-first superset)
  IF v_admin_id IS NULL OR NOT public.admin_has_role(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can force delete listings' USING ERRCODE = '42501';
  END IF;

  -- Get current status before deletion
  SELECT status INTO v_old_status FROM public.items WHERE id = p_listing_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '22000';
  END IF;

  -- If already deleted, skip update but still log
  IF v_old_status != 'deleted' THEN
    UPDATE public.items
    SET
      status = 'deleted',
      updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Log admin action
  INSERT INTO public.admin_listing_actions (admin_id, action_type, listing_id, reason)
  VALUES (v_admin_id, 'force_delete', p_listing_id, p_reason);

  v_result := jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'action', 'force_delete',
    'old_status', v_old_status,
    'new_status', 'deleted',
    'timestamp', NOW()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9) admin_search_listings_v2 — replace the inline metadata/profiles EXISTS
--    guard with the canonical admin_has_role (a strict superset of the old
--    inline check, now also honoring role_based_access_control).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_search_listings_v2(
  p_query TEXT DEFAULT ''::text,
  p_status TEXT DEFAULT 'all'::text,
  p_sp_eligible BOOLEAN DEFAULT false,
  p_page INTEGER DEFAULT 1,
  p_items_per_page INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id UUID;
  v_results JSONB;
  v_total_count INTEGER;
  v_offset INTEGER;
  v_status_db TEXT;
BEGIN
  v_admin_id := auth.uid();

  -- Verify admin status (canonical admin_has_role: rbac-first superset)
  IF v_admin_id IS NULL OR NOT public.admin_has_role(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required' USING ERRCODE = '42501';
  END IF;

  v_offset := (p_page - 1) * p_items_per_page;

  v_status_db := CASE
    WHEN p_status = 'active' THEN 'available'
    ELSE p_status
  END;

  SELECT COUNT(*)
    INTO v_total_count
    FROM public.items i
   WHERE (p_status = 'all' OR i.status = v_status_db)
     AND (NOT p_sp_eligible OR i.accepts_swap_points = TRUE)
     AND (p_query = '' OR i.title ILIKE '%' || p_query || '%');

  SELECT jsonb_build_object(
    'listings', COALESCE(jsonb_agg(t), '[]'::jsonb),
    'total_count', v_total_count
  )
    INTO v_results
    FROM (
      SELECT
        i.id,
        i.title,
        i.price,
        i.status,
        i.accepts_swap_points,
        i.seller_id,
        i.created_at,
        i.eligible_for_starter_pack,
        i.starter_pack_claimed,
        i.approved_at,
        -- Category fields (from 20260425000002)
        i.category_id,
        c.name                                                             AS category_name,
        i.requested_category_name,
        (i.requested_category_name IS NOT NULL
          AND btrim(i.requested_category_name) <> '')                     AS is_custom_category,
        -- Item detail fields (new in 20260425000003)
        i.description,
        i.condition,
        i.brand,
        i.color,
        i.age_group,
        i.gender,
        -- Seller info
        jsonb_build_object(
          'name',  COALESCE(p.name, 'Unknown'),
          'email', au.email
        ) AS seller,
        (
          SELECT COUNT(*)::INTEGER
            FROM public.items i2
           WHERE i2.seller_id = i.seller_id
             AND i2.status = 'available'
        ) AS seller_items_count,
        (
          SELECT COALESCE(
            jsonb_agg(jsonb_build_object('url', img.url, 'thumbnail_url', img.thumbnail_url)),
            '[]'::jsonb
          )
            FROM public.item_images img
           WHERE img.item_id = i.id
        ) AS images
      FROM public.items i
      LEFT JOIN public.categories c        ON c.id = i.category_id
      LEFT JOIN public.profiles p          ON i.seller_id = p.user_id
      LEFT JOIN auth.users au              ON i.seller_id = au.id
      WHERE (p_status = 'all' OR i.status = v_status_db)
        AND (NOT p_sp_eligible OR i.accepts_swap_points = TRUE)
        AND (p_query = '' OR i.title ILIKE '%' || p_query || '%')
      ORDER BY i.created_at DESC
      LIMIT p_items_per_page
      OFFSET v_offset
    ) t;

  RETURN v_results;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10) Re-grant EXECUTE to the pre-change role sets.
--     The DT-61 event trigger (dt61_guard_revoke_fn_public) revokes
--     PUBLIC/anon/authenticated on every public-schema CREATE [OR REPLACE]
--     FUNCTION above, so these explicit grants are REQUIRED to restore parity.
--     (BP-79 / BP-78: minimal per-function grant sets, verified via aclexplode.)
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public._is_admin_core(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_has_role(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manual_award_badge(uuid, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manual_revoke_badge(uuid, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_pause_listing(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_unpause_listing(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_force_delete_listing(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_search_listings_v2(text, text, boolean, integer, integer) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Verification queries (run separately via Supabase MCP / SQL editor):
--   1. Function signatures + bodies:
--        SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
--               (p.prosrc ~ 'role_based_access_control') AS has_rbac_core
--        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--        WHERE n.nspname='public'
--          AND p.proname IN ('_is_admin_core','is_admin','admin_has_role',
--                            'manual_award_badge','manual_revoke_badge',
--                            'admin_pause_listing','admin_unpause_listing',
--                            'admin_force_delete_listing','admin_search_listings_v2');
--   2. Live behavior (admin = 1a546991-5361-4b4e-b44b-eee9bf730757):
--        SELECT public.is_admin('1a546991-5361-4b4e-b44b-eee9bf730757');  -- expect true
--        SELECT public.admin_has_role('1a546991-5361-4b4e-b44b-eee9bf730757'); -- true
--        SELECT public.is_admin('<some-non-admin-uid>');  -- expect false
--        SELECT public.is_admin(NULL);                     -- expect false
--   3. Grants (aclexplode):
--        SELECT p.proname, array_agg(DISTINCT x.grantee::regrole::text)
--        FROM pg_proc p
--        LEFT JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) x ON true
--        WHERE p.proname IN ('is_admin','admin_has_role','_is_admin_core')
--        GROUP BY p.proname;
--   4. PostgREST no-arg RPC path (method-2 JWT) — call rpc('is_admin') with an
--      authenticated admin bearer token; expect true.
-- ============================================================================
