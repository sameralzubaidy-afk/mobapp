-- ================================================================
-- Migration: 086_fix_notify_new_message_push_call.sql
-- Module: MODULE-07 MSG-006 - Push Notifications for New Messages
-- Description:
--   Harden notify_new_message() so it doesn't silently fail when
--   pg_net or app.supabase_url are missing; remove DB dependency on
--   app.supabase_service_role_key since the Edge Function currently
--   does not require Authorization.
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1 — Schema
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
BEGIN
  -- Get trade details
  SELECT * INTO v_trade
  FROM public.trades
  WHERE public.trades.id = NEW.trade_id;

  IF NOT FOUND THEN
    RAISE WARNING 'notify_new_message: trade not found for trade_id=%', NEW.trade_id;
    RETURN NEW;
  END IF;

  -- Determine recipient (the user who did NOT send the message)
  IF NEW.sender_id = v_trade.buyer_id THEN
    v_recipient_id := v_trade.seller_id;
  ELSE
    v_recipient_id := v_trade.buyer_id;
  END IF;

  -- Get sender profile for display name (optional)
  SELECT * INTO v_sender_profile
  FROM public.profiles
  WHERE public.profiles.user_id = NEW.sender_id;

  -- Guard: pg_net must be installed
  IF to_regproc('net.http_post') IS NULL THEN
    RAISE WARNING 'notify_new_message: pg_net not installed (net.http_post missing); skipping push';
    RETURN NEW;
  END IF;

  -- Guard: app.supabase_url must be configured
  v_supabase_url := current_setting('app.supabase_url', true);
  IF v_supabase_url IS NULL OR length(trim(v_supabase_url)) = 0 THEN
    RAISE WARNING 'notify_new_message: app.supabase_url is not set; skipping push';
    RETURN NEW;
  END IF;

  -- Call Edge Function to send push notification asynchronously
  -- NOTE: Edge Function currently does not require Authorization.
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'userId', v_recipient_id,
        'title', 'New message from ' || COALESCE(v_sender_profile.name, 'Someone'),
        'body', substring(NEW.content, 1, 100),
        'data', jsonb_build_object(
          'type', 'message',
          'tradeId', NEW.trade_id,
          'messageId', NEW.id
        ),
        'priority', 'high'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'notify_new_message: push http_post failed for message_id=%: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- BLOCK 2 — Verification
-- ================================================================

-- 1) Trigger enabled + attached
-- SELECT tgname, tgenabled, tgrelid::regclass, tgfoid::regprocedure
-- FROM pg_trigger
-- WHERE tgname = 'on_message_insert_notify';

-- 2) pg_net installed
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';

-- 3) app.supabase_url set
-- SELECT current_setting('app.supabase_url', true) AS app_supabase_url;

-- 4) Smoke test (insert a message for a valid trade)
-- INSERT INTO public.messages (id, trade_id, sender_id, content, created_at)
-- VALUES (gen_random_uuid(), '<TRADE_ID>', '<SENDER_ID>', 'Push smoke test', NOW());

-- ================================================================
-- Rollback
-- ================================================================
-- No automatic rollback provided (would require restoring prior function body).
