-- ================================================================
-- Migration: 210_enhance_message_notifications_in_app.sql
-- Module: MODULE-14 NOTIF-V2-007 (Message Notifications - Fix)
-- Description:
--   Enhance notify_new_message() trigger to create BOTH:
--   1. Push notifications (existing behavior via Edge Function)
--   2. In-app notifications (NEW: direct insert into user_notifications)
--
--   This ensures messages appear in the NotificationCenterScreen
--   and users get both push alerts and in-app notification history.
--
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- ================================================================
-- STEP 1: Enhanced notify_new_message() function
-- ================================================================

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade public.trades;
  v_recipient_id uuid;
  v_sender_profile public.profiles;
  v_supabase_url text;
  v_auth_jwt text;
  v_notification_id uuid;
  v_sender_name text;
  v_message_preview text;
BEGIN
  -- ========================================
  -- STEP 1: Determine recipient
  -- ========================================
  SELECT * INTO v_trade
  FROM public.trades
  WHERE public.trades.id = NEW.trade_id;

  IF NOT FOUND THEN
    RAISE WARNING 'notify_new_message: trade not found for trade_id=%', NEW.trade_id;
    RETURN NEW;
  END IF;

  -- Determine recipient based on sender
  IF NEW.sender_id = v_trade.buyer_id THEN
    v_recipient_id := v_trade.seller_id;
  ELSE
    v_recipient_id := v_trade.buyer_id;
  END IF;

  -- Get sender profile
  SELECT * INTO v_sender_profile
  FROM public.profiles
  WHERE public.profiles.user_id = NEW.sender_id;

  -- Prepare sender name and message preview
  v_sender_name := COALESCE(v_sender_profile.name, 'Someone');
  v_message_preview := substring(NEW.content, 1, 100);

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
      channels,
      data,
      is_read,
      created_at
    )
    VALUES (
      v_recipient_id,
      'messages',
      'new_message',
      'New message from ' || v_sender_name,
      v_message_preview,
      ARRAY['push', 'in_app'],
      jsonb_build_object(
        'type', 'message',
        'tradeId', NEW.trade_id::text,
        'messageId', NEW.id::text,
        'senderId', NEW.sender_id::text,
        'senderName', v_sender_name
      ),
      false,
      now()
    )
    RETURNING id INTO v_notification_id;

    RAISE LOG 'notify_new_message: Created in-app notification id=% for user=%', v_notification_id, v_recipient_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'notify_new_message: Failed to create in-app notification: %', SQLERRM;
      -- Continue to push notification step even if in-app creation fails
  END;

  -- ========================================
  -- STEP 3: Send push notification via Edge Function
  -- ========================================

  -- Check if pg_net is available
  IF to_regproc('net.http_post') IS NULL THEN
    RAISE WARNING 'notify_new_message: pg_net not installed (net.http_post missing); skipping push';
    RETURN NEW;
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
    RAISE WARNING 'notify_new_message: Supabase URL not configured; skipping push';
    RETURN NEW;
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
    RAISE WARNING 'notify_new_message: Missing auth JWT; skipping push notification';
    RETURN NEW;
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
        'userId', v_recipient_id,
        'notificationId', v_notification_id,
        'title', 'New message from ' || v_sender_name,
        'body', v_message_preview,
        'data', jsonb_build_object(
          'type', 'message',
          'category', 'messages',
          'tradeId', NEW.trade_id,
          'messageId', NEW.id,
          'senderId', NEW.sender_id,
          'senderName', v_sender_name,
          'notificationId', v_notification_id
        )
      )
    );

    RAISE LOG 'notify_new_message: Push notification requested for user=%, notification=%', v_recipient_id, v_notification_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'notify_new_message: Push notification failed for message=%: %', NEW.id, SQLERRM;
      -- Non-fatal: in-app notification was still created
  END;

  RETURN NEW;
END;
$$;

-- ================================================================
-- STEP 2: Ensure trigger is active
-- ================================================================

DROP TRIGGER IF EXISTS on_message_insert_notify ON public.messages;

CREATE TRIGGER on_message_insert_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify function exists
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'notify_new_message';

-- Verify trigger exists and is active
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_message_insert_notify';

-- Check recent message notifications (after sending a test message)
-- SELECT id, user_id, category, type, title, body, is_read, created_at
-- FROM user_notifications
-- WHERE type = 'new_message'
-- ORDER BY created_at DESC
-- LIMIT 5;

-- Manual test: Send a test message and verify notification appears
-- INSERT INTO messages (trade_id, sender_id, content)
-- VALUES ('<valid_trade_id>', '<sender_user_id>', 'Test message notification');
-- 
-- -- Then check user_notifications for the recipient:
-- SELECT * FROM user_notifications
-- WHERE user_id = '<recipient_user_id>'
-- AND type = 'new_message'
-- ORDER BY created_at DESC
-- LIMIT 1;
