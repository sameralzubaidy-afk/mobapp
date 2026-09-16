-- ================================================================
-- Migration: 211_enhance_trade_notifications_push.sql
-- Module: MODULE-14 NOTIF-V2-007 (Trade Notifications - Add Push)
-- Description:
--   Enhance create_trade_notification() to send BOTH:
--   1. In-app notifications (existing behavior via user_notifications)
--   2. Push notifications (NEW: call send-push-notification Edge Function)
--
--   This ensures trade events trigger both in-app and push notifications
--   just like message notifications do.
--
-- Trade Events Covered:
--   - trade_request (seller receives when buyer initiates)
--   - trade_completion_requested (buyer receives when seller marks complete)
--   - trade_accepted (buyer receives when seller accepts - legacy)
--   - trade_rejected (buyer receives when seller rejects - legacy)
--   - trade_completed (both parties receive)
--   - trade_cancelled (both parties receive)
--
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- ================================================================
-- STEP 1: Enhanced create_trade_notification() function
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_trade_notification(
  p_user_id          UUID,
  p_notification_type TEXT,
  p_title            TEXT,
  p_body             TEXT,
  p_data             JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_channels        TEXT[];
  v_push_enabled    BOOLEAN;
  v_in_app_enabled  BOOLEAN;
  v_email_enabled   BOOLEAN;
  v_found           BOOLEAN := false;
  v_supabase_url    TEXT;
  v_auth_jwt        TEXT;
BEGIN
  -- ========================================
  -- STEP 1: Read user's trade notification preferences
  -- ========================================
  SELECT np.push_enabled, np.in_app_enabled, np.email_enabled
    INTO v_push_enabled, v_in_app_enabled, v_email_enabled
    FROM public.notification_preferences np
   WHERE np.user_id = p_user_id
     AND np.category = 'trades';

  IF FOUND THEN
    v_found := true;
  END IF;

  IF NOT v_found THEN
    -- Default: push + in_app enabled when no preference row exists
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

  -- Bail out if user has disabled all channels for trades
  IF array_length(v_channels, 1) IS NULL OR array_length(v_channels, 1) = 0 THEN
    RETURN NULL;
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
    ) VALUES (
      p_user_id,
      'trades',
      p_notification_type,
      p_title,
      p_body,
      COALESCE(p_data, '{}'::jsonb),
      v_channels,
      false,
      now()
    )
    RETURNING id INTO v_notification_id;

    RAISE LOG 'create_trade_notification: Created in-app notification id=% for user=%', v_notification_id, p_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'create_trade_notification: Failed to create in-app notification: %', SQLERRM;
      -- Return NULL if we can't create the notification
      RETURN NULL;
  END;

  -- ========================================
  -- STEP 3: Send push notification via Edge Function
  -- (Only if push is enabled in channels)
  -- ========================================
  
  -- Check if push is enabled for this notification
  IF NOT ('push' = ANY(v_channels)) THEN
    RAISE LOG 'create_trade_notification: Push disabled for user=%, skipping', p_user_id;
    RETURN v_notification_id;
  END IF;

  -- Check if pg_net is available
  IF to_regproc('net.http_post') IS NULL THEN
    RAISE WARNING 'create_trade_notification: pg_net not installed (net.http_post missing); skipping push';
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
    RAISE WARNING 'create_trade_notification: Supabase URL not configured; skipping push';
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
    RAISE WARNING 'create_trade_notification: Missing auth JWT; skipping push notification';
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
          'category', 'trades',
          'type', p_notification_type
        )
      )
    );

    RAISE LOG 'create_trade_notification: Push notification requested for user=%, notification=%', p_user_id, v_notification_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'create_trade_notification: Push notification failed for notification=%: %', v_notification_id, SQLERRM;
      -- Non-fatal: in-app notification was still created
  END;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify function updated
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'create_trade_notification';

-- Test the function manually (replace UUIDs with real values)
-- SELECT public.create_trade_notification(
--   '<user_id>'::uuid,
--   'trade_request',
--   'Test Trade Request 💬',
--   'Someone wants to trade for your item',
--   '{"trade_id":"test-123","item_id":"item-456","deep_link":"/trades/test-123","type":"trade_request"}'::jsonb
-- );

-- Check notification was created
-- SELECT id, user_id, category, type, title, body, channels, is_read, created_at
-- FROM user_notifications
-- WHERE type = 'trade_request'
-- ORDER BY created_at DESC
-- LIMIT 5;

-- Manual trade event test: Create a trade and verify both in-app and push notifications are sent
-- After creating a trade in the app, check:
-- SELECT * FROM user_notifications
-- WHERE user_id = '<seller_user_id>'
-- AND category = 'trades'
-- ORDER BY created_at DESC
-- LIMIT 1;
