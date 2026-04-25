-- ================================================================
-- Migration: 20260425000001_listing_approval_notifications.sql
-- Module: MODULE-14 Notifications / MODULE-04 Listings
-- Description:
--   1. Add preference-aware system notification helper for seller-facing approval events
--   2. Update admin_approve_listing() to notify seller when a listing is approved
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- ================================================================
-- BLOCK 1 — Schema / Functions
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_system_notification_with_preferences(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_channels TEXT[];
  v_push_enabled BOOLEAN;
  v_in_app_enabled BOOLEAN;
  v_email_enabled BOOLEAN;
  v_found BOOLEAN := FALSE;
  v_supabase_url TEXT;
  v_auth_jwt TEXT;
BEGIN
  SELECT np.push_enabled, np.in_app_enabled, np.email_enabled
    INTO v_push_enabled, v_in_app_enabled, v_email_enabled
    FROM public.notification_preferences np
   WHERE np.user_id = p_user_id
     AND np.category = 'system';

  IF FOUND THEN
    v_found := TRUE;
  END IF;

  IF NOT v_found THEN
    v_channels := ARRAY['push', 'in_app']::TEXT[];
  ELSE
    v_channels := ARRAY[]::TEXT[];

    IF v_push_enabled THEN
      v_channels := array_append(v_channels, 'push');
    END IF;

    IF v_in_app_enabled THEN
      v_channels := array_append(v_channels, 'in_app');
    END IF;

    IF v_email_enabled THEN
      v_channels := array_append(v_channels, 'email');
    END IF;
  END IF;

  IF array_length(v_channels, 1) IS NULL OR array_length(v_channels, 1) = 0 THEN
    RETURN NULL;
  END IF;

  IF 'in_app' = ANY(v_channels) THEN
    INSERT INTO public.user_notifications (
      user_id,
      category,
      type,
      title,
      body,
      channels,
      data,
      is_read,
      created_at
    )
    VALUES (
      p_user_id,
      'system',
      p_type,
      p_title,
      p_body,
      v_channels,
      COALESCE(p_data, '{}'::jsonb),
      FALSE,
      NOW()
    )
    RETURNING id INTO v_notification_id;
  END IF;

  IF 'push' = ANY(v_channels) THEN
    IF to_regproc('net.http_post') IS NULL THEN
      RAISE WARNING 'create_system_notification_with_preferences: pg_net missing, skipping push';
      RETURN v_notification_id;
    END IF;

    v_supabase_url := current_setting('app.supabase_url', TRUE);

    IF v_supabase_url IS NULL OR length(trim(v_supabase_url)) = 0 THEN
      SELECT ac.value
        INTO v_supabase_url
        FROM public.admin_config ac
       WHERE ac.key = 'supabase_url'
         AND ac.is_active = TRUE
       LIMIT 1;
    END IF;

    IF v_supabase_url IS NULL OR length(trim(v_supabase_url)) = 0 THEN
      RAISE WARNING 'create_system_notification_with_preferences: Supabase URL missing, skipping push';
      RETURN v_notification_id;
    END IF;

    v_supabase_url := rtrim(v_supabase_url, '/');

    v_auth_jwt := current_setting('app.supabase_anon_key', TRUE);

    IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
      SELECT ac.value
        INTO v_auth_jwt
        FROM public.admin_config ac
       WHERE ac.key = 'supabase_anon_key'
         AND ac.is_active = TRUE
       LIMIT 1;
    END IF;

    IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
      v_auth_jwt := current_setting('app.supabase_service_role_key', TRUE);
    END IF;

    IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
      SELECT ac.value
        INTO v_auth_jwt
        FROM public.admin_config ac
       WHERE ac.key = 'supabase_service_role_key'
         AND ac.is_active = TRUE
       LIMIT 1;
    END IF;

    IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
      RAISE WARNING 'create_system_notification_with_preferences: auth key missing, skipping push';
      RETURN v_notification_id;
    END IF;

    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_auth_jwt,
          'apikey', v_auth_jwt
        ),
        body := jsonb_build_object(
          'userId', p_user_id,
          'notificationId', v_notification_id,
          'title', p_title,
          'body', p_body,
          'skipNotificationRowCreate', v_notification_id IS NULL,
          'data', COALESCE(p_data, '{}'::jsonb) || jsonb_build_object(
            'notificationId', v_notification_id,
            'category', 'system',
            'type', p_type
          )
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'create_system_notification_with_preferences: push failed: %', SQLERRM;
    END;
  END IF;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_listing(
  p_listing_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_seller_id UUID;
  v_eligible_for_sp BOOLEAN;
  v_is_admin BOOLEAN;
  v_starter_pack_result JSONB;
  v_starter_pack_awarded BOOLEAN := FALSE;
  v_notification_body TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM public.role_based_access_control rbac
     WHERE rbac.user_id = p_admin_user_id
       AND rbac.role = 'admin'
  )
    INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only admins can approve listings'
    );
  END IF;

  SELECT i.*
    INTO v_listing
    FROM public.items i
   WHERE i.id = p_listing_id;

  IF v_listing IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Listing not found'
    );
  END IF;

  v_seller_id := v_listing.seller_id;

  IF v_listing.status = 'available' AND v_listing.approved_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Listing is already approved'
    );
  END IF;

  SELECT public.is_eligible_for_starter_pack(v_seller_id) INTO v_eligible_for_sp;

  UPDATE public.items i
     SET status = 'available',
         approved_at = NOW(),
         approved_by = p_admin_user_id,
         eligible_for_starter_pack = v_eligible_for_sp,
         updated_at = NOW()
   WHERE i.id = p_listing_id;

  IF v_eligible_for_sp AND COALESCE(v_listing.accepts_swap_points, FALSE) THEN
    SELECT public.issue_starter_pack(v_seller_id, p_listing_id) INTO v_starter_pack_result;

    IF COALESCE((v_starter_pack_result->>'success')::BOOLEAN, FALSE) THEN
      v_starter_pack_awarded := TRUE;

      UPDATE public.items i
         SET starter_pack_claimed = TRUE,
             starter_pack_claimed_at = NOW(),
             updated_at = NOW()
       WHERE i.id = p_listing_id;
    END IF;
  END IF;

  INSERT INTO public.admin_activity_log (admin_id, action_type, entity_type, entity_id, details, notes)
  VALUES (
    p_admin_user_id,
    'approve_listing',
    'item',
    p_listing_id,
    jsonb_build_object(
      'seller_id', v_seller_id,
      'eligible_for_starter_pack', v_eligible_for_sp,
      'starter_pack_awarded', v_starter_pack_awarded,
      'listing_title', v_listing.title
    ),
    p_reason
  );

  IF v_eligible_for_sp THEN
    INSERT INTO public.admin_notifications (admin_id, notification_type, entity_type, entity_id, title, message)
    SELECT au.id,
           'listing_starter_pack_eligible',
           'item',
           p_listing_id,
           'Listing Eligible for Starter Pack',
           FORMAT('Listing "%s" by seller %s is eligible for Starter Pack reward', v_listing.title, v_seller_id::TEXT)
      FROM public.role_based_access_control rbac
      JOIN auth.users au ON au.id = rbac.user_id
     WHERE rbac.role = 'admin'
       AND rbac.user_id <> p_admin_user_id;
  END IF;

  v_notification_body := CASE
    WHEN v_eligible_for_sp AND v_starter_pack_awarded THEN FORMAT('Your listing "%s" was approved and your Starter Pack reward has been applied.', v_listing.title)
    ELSE FORMAT('Your listing "%s" was approved and is now live.', v_listing.title)
  END;

  BEGIN
    PERFORM public.create_system_notification_with_preferences(
      v_seller_id,
      'listing_approved',
      'Listing Approved',
      v_notification_body,
      jsonb_build_object(
        'listing_id', p_listing_id::TEXT,
        'item_id', p_listing_id::TEXT,
        'item_title', COALESCE(v_listing.title, ''),
        'status', 'available',
        'deep_link', '/listing/' || p_listing_id::TEXT,
        'type', 'listing_approved'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'admin_approve_listing: seller notification failed for listing=%: %', p_listing_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'listing_id', p_listing_id,
    'status', 'available',
    'eligible_for_starter_pack', v_eligible_for_sp,
    'starter_pack_awarded', v_starter_pack_awarded,
    'approved_at', NOW(),
    'message', CASE
      WHEN v_eligible_for_sp AND v_starter_pack_awarded THEN 'Listing approved! Starter Pack awarded to seller.'
      WHEN v_eligible_for_sp THEN 'Listing approved! Seller is eligible for Starter Pack reward.'
      ELSE 'Listing approved (seller not eligible for Starter Pack - check subscription status)'
    END
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

-- ================================================================
-- BLOCK 2 — Security + Performance
-- ================================================================

GRANT EXECUTE ON FUNCTION public.create_system_notification_with_preferences(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_listing(UUID, UUID, TEXT) TO authenticated;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- 1. Verify helper + approval RPC exist
-- SELECT proname
-- FROM pg_proc
-- WHERE proname IN ('create_system_notification_with_preferences', 'admin_approve_listing');

-- 2. Approve a pending listing
-- SELECT public.admin_approve_listing('<listing-id>'::uuid, '<admin-user-id>'::uuid, 'approved in manual verification');

-- 3. Verify in-app notification row honors system preferences when enabled
-- SELECT un.user_id, un.type, un.title, un.channels, un.data
-- FROM public.user_notifications un
-- WHERE un.user_id = '<seller-user-id>'::uuid
--   AND un.type = 'listing_approved'
-- ORDER BY un.created_at DESC
-- LIMIT 5;

-- 4. Verify seller system preference row
-- SELECT np.user_id, np.category, np.push_enabled, np.in_app_enabled
-- FROM public.notification_preferences np
-- WHERE np.user_id = '<seller-user-id>'::uuid
--   AND np.category = 'system';

-- Common failure modes:
-- 1) Missing pg_net or Supabase URL/key config prevents push delivery while leaving approval successful.
-- 2) Missing notification_preferences row defaults to push + in_app enabled.
-- 3) Missing push_tokens creates no push but still preserves in-app delivery when enabled.