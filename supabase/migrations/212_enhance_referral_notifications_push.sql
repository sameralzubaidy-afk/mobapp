-- ================================================================
-- Migration: 212_enhance_referral_notifications_push.sql
-- Module: MODULE-14 NOTIF-V2-007 (Referral Notifications - Add Push)
-- Description:
--   Enhance create_notification() to send BOTH:
--   1. In-app notifications (existing behavior via user_notifications)
--   2. Push notifications (NEW: call send-push-notification Edge Function)
--
--   This ensures referral events trigger both in-app and push notifications.
--
-- Referral Events Covered:
--   - referral_invite_accepted (referrer receives when referee signs up)
--   - referral_reward_earned (referrer receives when reward is granted)
--   - referee_welcome (new user receives welcome notification)
--
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- ================================================================
-- STEP 1: Enhanced create_notification() function
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_notification_id UUID;
  v_supabase_url    TEXT;
  v_auth_jwt        TEXT;
BEGIN
  -- ========================================
  -- STEP 1: Create in-app notification
  -- ========================================
  BEGIN
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
      ARRAY['push', 'in_app'],
      p_data,
      false,
      now()
    )
    RETURNING id INTO v_notification_id;

    RAISE LOG 'create_notification: Created in-app notification id=% for user=%', v_notification_id, p_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'create_notification: Failed to create in-app notification: %', SQLERRM;
      RETURN;
  END;

  -- ========================================
  -- STEP 2: Send push notification via Edge Function
  -- ========================================

  -- Check if pg_net is available
  IF to_regproc('net.http_post') IS NULL THEN
    RAISE WARNING 'create_notification: pg_net not installed (net.http_post missing); skipping push';
    RETURN;
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
    RAISE WARNING 'create_notification: Supabase URL not configured; skipping push';
    RETURN;
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
    RAISE WARNING 'create_notification: Missing auth JWT; skipping push notification';
    RETURN;
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
          'category', 'system',
          'type', p_type
        )
      )
    );

    RAISE LOG 'create_notification: Push notification requested for user=%, notification=%', p_user_id, v_notification_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'create_notification: Push notification failed for notification=%: %', v_notification_id, SQLERRM;
      -- Non-fatal: in-app notification was still created
  END;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify function updated
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'create_notification';

-- Test the function manually (replace UUID with real value)
-- SELECT public.create_notification(
--   '<user_id>'::uuid,
--   'referral_invite_accepted',
--   'Your Invite Was Accepted! 🎉',
--   'Someone just signed up using your referral code.',
--   '{"deep_link":"ReferralDashboard","referral_id":"test-123"}'::jsonb
-- );

-- Check notification was created
-- SELECT id, user_id, category, type, title, body, channels, is_read, created_at
-- FROM user_notifications
-- WHERE type = 'referral_invite_accepted'
-- ORDER BY created_at DESC
-- LIMIT 5;
