-- ================================================================
-- Migration: 081_message_notifications_trigger.sql
-- Module: MODULE-07 MSG-006 - Push Notifications for New Messages
-- Description: Database trigger to send push notifications when new message inserted
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Schema (functions, triggers)
-- ================================================================

-- 1. Create function to notify new message
DROP FUNCTION IF EXISTS notify_new_message() CASCADE;

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_trade trades;
  v_recipient_id UUID;
  v_sender_profile profiles;
BEGIN
  -- Log the trigger execution
  RAISE LOG 'notify_new_message trigger fired for message_id=%', NEW.id;

  -- Get trade details
  SELECT * INTO v_trade
  FROM trades
  WHERE id = NEW.trade_id;

  IF NOT FOUND THEN
    RAISE WARNING 'Trade not found for trade_id=%', NEW.trade_id;
    RETURN NEW;
  END IF;

  -- Determine recipient (the user who did NOT send the message)
  IF NEW.sender_id = v_trade.buyer_id THEN
    v_recipient_id := v_trade.seller_id;
  ELSE
    v_recipient_id := v_trade.buyer_id;
  END IF;

  -- Get sender profile for display name
  SELECT * INTO v_sender_profile
  FROM profiles
  WHERE user_id = NEW.sender_id;

  -- Call Edge Function to send push notification asynchronously
  -- Using pg_net.http_post (requires pg_net extension)
  -- Note: If pg_net is not available, this will fail gracefully
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
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

    RAISE LOG 'Push notification request sent for message_id=%', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Failed to send push notification for message_id=%: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger on message insert
DROP TRIGGER IF EXISTS on_message_insert_notify ON messages;

CREATE TRIGGER on_message_insert_notify
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- ================================================================
-- BLOCK 2: Verification Queries
-- ================================================================

-- Verify function exists
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'notify_new_message';

-- Verify trigger exists
-- SELECT tgname, tgtype, tgenabled FROM pg_trigger WHERE tgname = 'on_message_insert_notify';

-- Test the trigger (run as authenticated user with valid trade_id)
-- INSERT INTO messages (trade_id, sender_id, content) VALUES ('<valid_trade_id>', auth.uid(), 'Test notification');

-- ================================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================================
-- To rollback this migration:
-- DROP TRIGGER IF EXISTS on_message_insert_notify ON messages;
-- DROP FUNCTION IF EXISTS notify_new_message() CASCADE;
