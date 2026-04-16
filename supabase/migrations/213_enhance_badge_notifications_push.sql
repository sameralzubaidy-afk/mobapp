-- ================================================================
-- Migration: 213_enhance_badge_notifications_push.sql
-- Module: MODULE-14 NOTIF-V2-007 (Badge Notifications - Add Push)
-- Description:
--   Enhance create_badge_notification() to send BOTH:
--   1. In-app notifications (existing behavior via user_notifications)
--   2. Push notifications (NEW: call send-push-notification Edge Function)
--
--   This ensures badge award events trigger both in-app and push notifications.
--
-- Badge Events Covered:
--   - badge_earned (user receives when they earn a new badge)
--
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- ================================================================
-- STEP 1: Enhanced create_badge_notification() function
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_badge_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_channels        TEXT[];
  v_prefs           RECORD;
  v_supabase_url    TEXT;
  v_auth_jwt        TEXT;
  v_push_enabled    BOOLEAN := false;
BEGIN
  -- ========================================
  -- STEP 1: Get user's badge notification preferences
  -- ========================================
  SELECT * INTO v_prefs
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND category = 'badges';

  IF NOT FOUND THEN
    -- Default: all channels enabled for badges
    v_channels := ARRAY['push', 'in_app']::TEXT[];
    v_push_enabled := true;
  ELSE
    v_channels := ARRAY[]::TEXT[];
    IF v_prefs.push_enabled THEN
      v_channels := array_append(v_channels, 'push');
      v_push_enabled := true;
    END IF;
    IF v_prefs.in_app_enabled THEN
      v_channels := array_append(v_channels, 'in_app');
    END IF;
    IF v_prefs.email_enabled THEN
      v_channels := array_append(v_channels, 'email');
    END IF;
  END IF;

  -- ========================================
  -- STEP 2: Create in-app notification
  -- ========================================
  BEGIN
    INSERT INTO public.user_notifications (
      user_id,
      category,
      type,
      title,
      body,
      data,
      channels,
      is_read,
      created_at
    )
    VALUES (
      p_user_id,
      'badges',
      p_notification_type,
      p_title,
      p_body,
      p_data,
      v_channels,
      false,
      now()
    )
    RETURNING id INTO v_notification_id;

    RAISE LOG 'create_badge_notification: Created in-app notification id=% for user=%', v_notification_id, p_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'create_badge_notification: Failed to create in-app notification: %', SQLERRM;
      RETURN NULL;
  END;

  -- ========================================
  -- STEP 3: Send push notification via Edge Function
  -- (Only if push is enabled)
  -- ========================================

  IF NOT v_push_enabled THEN
    RAISE LOG 'create_badge_notification: Push disabled for user=%, skipping', p_user_id;
    RETURN v_notification_id;
  END IF;

  -- Check if pg_net is available
  IF to_regproc('net.http_post') IS NULL THEN
    RAISE WARNING 'create_badge_notification: pg_net not installed (net.http_post missing); skipping push';
    RETURN v_notification_id;
  END IF;

  -- Resolve Supabase URL
  v_supabase_url := current_setting('app.supabase_url', true);

  IF v_supabase_url IS NULL OR length(trim(v_supabase_url)) = 0 THEN
    SELECT ac.value INTO v_supabase_url
    FROM public.admin_config ac
    WHERE ac.key = 'supabase_url'
      AND ac.is_active = true
    LIMIT 1;
  END IF;

  IF v_supabase_url IS NULL OR length(trim(v_supabase_url)) = 0 THEN
    RAISE WARNING 'create_badge_notification: Supabase URL not configured; skipping push';
    RETURN v_notification_id;
  END IF;

  v_supabase_url := rtrim(v_supabase_url, '/');

  -- Resolve JWT for calling Edge Functions
  v_auth_jwt := current_setting('app.supabase_anon_key', true);

  IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
    SELECT ac.value INTO v_auth_jwt
    FROM public.admin_config ac
    WHERE ac.key = 'supabase_anon_key'
      AND ac.is_active = true
    LIMIT 1;
  END IF;

  -- Optional fallback: service role key
  IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
    v_auth_jwt := current_setting('app.supabase_service_role_key', true);
  END IF;

  IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
    SELECT ac.value INTO v_auth_jwt
    FROM public.admin_config ac
    WHERE ac.key = 'supabase_service_role_key'
      AND ac.is_active = true
    LIMIT 1;
  END IF;

  IF v_auth_jwt IS NULL OR length(trim(v_auth_jwt)) = 0 THEN
    RAISE WARNING 'create_badge_notification: Missing auth JWT; skipping push notification';
    RETURN v_notification_id;
  END IF;

  -- Call Edge Function for push notification
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
        'data', COALESCE(p_data, '{}'::jsonb) || jsonb_build_object(
          'notificationId', v_notification_id,
          'category', 'badges',
          'type', p_notification_type
        )
      )
    );

    RAISE LOG 'create_badge_notification: Push notification requested for user=%, notification=%', p_user_id, v_notification_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'create_badge_notification: Push notification failed for notification=%: %', v_notification_id, SQLERRM;
      -- Non-fatal: in-app notification was still created
  END;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify function updated
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'create_badge_notification';

-- Test the function manually (replace UUIDs with real values)
-- SELECT public.create_badge_notification(
--   '<user_id>'::uuid,
--   'badge_earned',
--   'New Badge Earned! 🏆',
--   'Congratulations! You earned the "Test Badge" badge.',
--   '{"badge_id":"test-badge-123","badge_name":"Test Badge","deep_link":"/profile/badges"}'::jsonb
-- );

-- Check notification was created
-- SELECT id, user_id, category, type, title, body, channels, is_read, created_at
-- FROM user_notifications
-- WHERE type = 'badge_earned'
-- ORDER BY created_at DESC
-- LIMIT 5;
