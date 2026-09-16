-- =====================================================
-- FILE: supabase/migrations/142_sp_notifications.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-003)
-- TASK: SP Event Notifications
-- DESCRIPTION:
--   Create notification triggers for SP events:
--   1. SP earned (ledger insert with positive amount)
--   2. SP spent (ledger insert with negative amount)
--   3. Wallet frozen (wallet state changes to frozen)
--   4. Low balance warning (balance < 10 SP, once per 24h)
-- =====================================================

-- ==================================================
-- STEP 1: Create SP Notification Function
-- ==================================================

CREATE OR REPLACE FUNCTION create_sp_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb,
  p_check_subscription BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_channels TEXT[];
  v_prefs RECORD;
  v_subscription RECORD;
BEGIN
  -- Check if user has active subscription (only send SP notifications to subscribers)
  -- Exception: wallet_frozen notifications sent to all users
  IF p_check_subscription AND p_notification_type != 'sp_wallet_frozen' THEN
    SELECT * INTO v_subscription
    FROM subscriptions
    WHERE user_id = p_user_id
      AND status IN ('trial', 'active')
    LIMIT 1;

    IF NOT FOUND THEN
      -- User is not a subscriber, don't send SP notifications
      RETURN NULL;
    END IF;
  END IF;

  -- Get user's SP notification preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id AND category = 'sp_events';

  IF NOT FOUND THEN
    -- Default channels if no preferences set
    v_channels := ARRAY['push', 'in_app'];
  ELSE
    v_channels := ARRAY[]::TEXT[];
    IF v_prefs.push_enabled THEN
      v_channels := array_append(v_channels, 'push');
    END IF;
    IF v_prefs.in_app_enabled THEN
      v_channels := array_append(v_channels, 'in_app');
    END IF;
    IF v_prefs.email_enabled THEN
      v_channels := array_append(v_channels, 'email');
    END IF;
  END IF;

  -- Skip if all channels disabled
  IF array_length(v_channels, 1) IS NULL OR array_length(v_channels, 1) = 0 THEN
    RETURN NULL;
  END IF;

  -- Create notification
  INSERT INTO user_notifications (user_id, category, type, title, body, data, channels)
  VALUES (p_user_id, 'sp_events', p_notification_type, p_title, p_body, p_data, v_channels)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 2: Trigger for SP Earned/Spent Notifications
-- ==================================================

CREATE OR REPLACE FUNCTION send_sp_transaction_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet RECORD;
  v_title TEXT;
  v_body TEXT;
  v_notification_type TEXT;
BEGIN
  -- Get wallet details
  SELECT * INTO v_wallet
  FROM sp_wallets
  WHERE id = NEW.wallet_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determine if earned or spent based on transaction_type
  IF NEW.transaction_type LIKE 'earn_%' THEN
    -- Earned SP
    v_notification_type := 'sp_earned';
    v_title := '🎉 +' || NEW.amount || ' SP Earned!';
    
    -- Custom body based on transaction type
    v_body := CASE
      WHEN NEW.transaction_type = 'earn_starter_pack' THEN 'You earned ' || NEW.amount || ' SP as a welcome bonus!'
      WHEN NEW.transaction_type = 'earn_reward' THEN 'You earned ' || NEW.amount || ' SP from a reward!'
      WHEN NEW.transaction_type = 'earn_referral' THEN 'You earned ' || NEW.amount || ' SP from a referral!'
      WHEN NEW.transaction_type = 'earn_challenge' THEN 'You earned ' || NEW.amount || ' SP from completing a challenge!'
      WHEN NEW.transaction_type = 'earn_refund' THEN 'You received ' || NEW.amount || ' SP refund!'
      WHEN NEW.transaction_type = 'earn_admin_grant' THEN 'You received ' || NEW.amount || ' SP!'
      WHEN NEW.transaction_type = 'earn_promotion' THEN 'You earned ' || NEW.amount || ' SP from a promotion!'
      ELSE 'You earned ' || NEW.amount || ' SP!'
    END;

  ELSIF NEW.transaction_type LIKE 'spend_%' THEN
    -- Spent SP
    v_notification_type := 'sp_spent';
    v_title := '✨ ' || ABS(NEW.amount) || ' SP Spent';
    
    -- Custom body based on transaction type
    v_body := CASE
      WHEN NEW.transaction_type = 'spend_purchase' THEN 'You spent ' || ABS(NEW.amount) || ' SP on a purchase!'
      WHEN NEW.transaction_type = 'spend_fee' THEN 'You spent ' || ABS(NEW.amount) || ' SP on fees!'
      WHEN NEW.transaction_type = 'spend_boost' THEN 'You spent ' || ABS(NEW.amount) || ' SP on a boost!'
      ELSE 'You spent ' || ABS(NEW.amount) || ' SP!'
    END;

  ELSE
    -- Other transaction types (expire, freeze, unfreeze, admin_deduct)
    RETURN NEW;
  END IF;

  -- Create the notification
  PERFORM create_sp_notification(
    v_wallet.user_id,
    v_notification_type,
    v_title,
    v_body,
    jsonb_build_object(
      'amount', NEW.amount,
      'transaction_type', NEW.transaction_type,
      'balance_after', NEW.balance_after,
      'ledger_id', NEW.id,
      'deep_link', '/wallet'
    ),
    TRUE  -- check_subscription = TRUE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sp_transaction_notification ON sp_ledger;

-- Create trigger on sp_ledger
CREATE TRIGGER trigger_sp_transaction_notification
  AFTER INSERT ON sp_ledger
  FOR EACH ROW
  WHEN (NEW.transaction_type LIKE 'earn_%' OR NEW.transaction_type LIKE 'spend_%')
  EXECUTE FUNCTION send_sp_transaction_notification();

-- ==================================================
-- STEP 3: Trigger for Wallet Frozen Notification
-- ==================================================

CREATE OR REPLACE FUNCTION send_sp_wallet_frozen_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_new_state TEXT;
  v_old_state TEXT;
BEGIN
  -- Support both schemas (state/status) without hard column binding
  v_new_state := COALESCE(to_jsonb(NEW)->>'state', to_jsonb(NEW)->>'status');
  v_old_state := COALESCE(to_jsonb(OLD)->>'state', to_jsonb(OLD)->>'status');

  -- Only trigger when state changes to frozen
  IF v_new_state = 'frozen' AND (v_old_state IS NULL OR v_old_state != 'frozen') THEN
    PERFORM create_sp_notification(
      NEW.user_id,
      'sp_wallet_frozen',
      'SP Wallet Frozen ❄️',
      'Your Swap Points wallet has been frozen. Renew your subscription to reactivate it and continue earning SP!',
      jsonb_build_object(
        'wallet_id', NEW.id,
        'available_balance', NEW.available_balance,
        'state', v_new_state,
        'deep_link', '/subscription'
      ),
      FALSE  -- check_subscription = FALSE (send to all users)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sp_wallet_frozen_notification ON sp_wallets;

-- Create trigger on sp_wallets
CREATE TRIGGER trigger_sp_wallet_frozen_notification
  AFTER UPDATE ON sp_wallets
  FOR EACH ROW
  EXECUTE FUNCTION send_sp_wallet_frozen_notification();

-- ==================================================
-- STEP 4: Trigger for Low Balance Warning
-- ==================================================

CREATE OR REPLACE FUNCTION send_sp_low_balance_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_last_warning_sent TIMESTAMPTZ;
BEGIN
  -- Only trigger when balance drops below 10 SP
  IF NEW.available_balance < 10 AND (OLD.available_balance IS NULL OR OLD.available_balance >= 10) THEN
    
    -- Check if we already sent low balance warning in last 24 hours
    SELECT created_at INTO v_last_warning_sent
    FROM user_notifications
    WHERE user_id = NEW.user_id
      AND type = 'sp_balance_low'
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Only send if no warning sent in last 24 hours
    IF v_last_warning_sent IS NULL THEN
      PERFORM create_sp_notification(
        NEW.user_id,
        'sp_balance_low',
        'Low SP Balance ⚠️',
        'You have only ' || NEW.available_balance || ' SP remaining. Complete trades or challenges to earn more!',
        jsonb_build_object(
          'balance', NEW.available_balance,
          'wallet_id', NEW.id,
          'deep_link', '/discover'
        ),
        TRUE  -- check_subscription = TRUE
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sp_low_balance_notification ON sp_wallets;

-- Create trigger on sp_wallets for low balance
CREATE TRIGGER trigger_sp_low_balance_notification
  AFTER UPDATE ON sp_wallets
  FOR EACH ROW
  WHEN (NEW.available_balance < 10)
  EXECUTE FUNCTION send_sp_low_balance_notification();

-- ==================================================
-- STEP 5: Dispatch Push for SP Notifications
-- ==================================================

CREATE OR REPLACE FUNCTION dispatch_sp_notification_push()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_api_key TEXT;
  v_headers JSONB;
  v_request_id BIGINT;
  v_has_debug_logs BOOLEAN;
BEGIN
  v_has_debug_logs := to_regclass('public.debug_logs') IS NOT NULL;

  -- Guard: push channel must be enabled on this notification
  IF NEW.channels IS NULL OR NOT ('push' = ANY(NEW.channels)) THEN
    IF v_has_debug_logs THEN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'dispatch_sp_notification_push',
        'Skipped: push channel disabled',
        jsonb_build_object('notification_id', NEW.id, 'user_id', NEW.user_id, 'channels', NEW.channels)
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Guard: only dispatch SP event notifications here
  IF NEW.category != 'sp_events' THEN
    IF v_has_debug_logs THEN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'dispatch_sp_notification_push',
        'Skipped: non-sp_events category',
        jsonb_build_object('notification_id', NEW.id, 'user_id', NEW.user_id, 'category', NEW.category)
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Guard: pg_net must exist
  IF to_regproc('net.http_post') IS NULL THEN
    RAISE WARNING 'dispatch_sp_notification_push: pg_net is not installed; skipping push for notification_id=%', NEW.id;
    IF v_has_debug_logs THEN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'dispatch_sp_notification_push',
        'Skipped: pg_net missing',
        jsonb_build_object('notification_id', NEW.id, 'user_id', NEW.user_id)
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Read base URL from DB settings, with fallback to project URL
  v_supabase_url := COALESCE(
    NULLIF(current_setting('app.supabase_url', true), ''),
    'https://drntwgporzabmxdqykrp.supabase.co'
  );

  IF v_supabase_url IS NULL THEN
    RAISE WARNING 'dispatch_sp_notification_push: app.supabase_url is not set; skipping push for notification_id=%', NEW.id;
    IF v_has_debug_logs THEN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'dispatch_sp_notification_push',
        'Skipped: supabase URL missing',
        jsonb_build_object('notification_id', NEW.id, 'user_id', NEW.user_id)
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Try service key first, then anon key fallback
  v_api_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('app.supabase_service_role_key', true), ''),
    NULLIF(current_setting('app.supabase_anon_key', true), ''),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzc1NjUsImV4cCI6MjA4MDg1MzU2NX0.5lj-JNoBItZJCZgMV9DwFslmzud0PxcIjSS78TFRU0E'
  );

  v_headers := jsonb_build_object('Content-Type', 'application/json');
  IF v_api_key IS NOT NULL THEN
    v_headers := v_headers || jsonb_build_object(
      'Authorization', 'Bearer ' || v_api_key,
      'apikey', v_api_key
    );
  END IF;

  BEGIN
    SELECT net.http_post(
      url := rtrim(v_supabase_url, '/') || '/functions/v1/send-push-notification',
      headers := v_headers,
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'title', NEW.title,
        'body', NEW.body,
        'data', COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object(
          'notification_id', NEW.id,
          'category', NEW.category,
          'type', NEW.type
        ),
        'priority', 'high'
      )
    ) INTO v_request_id;

    -- Optional observability (if debug_logs exists)
    IF to_regclass('public.debug_logs') IS NOT NULL THEN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'dispatch_sp_notification_push',
        'Push dispatch queued',
        jsonb_build_object(
          'notification_id', NEW.id,
          'user_id', NEW.user_id,
          'request_id', v_request_id,
          'category', NEW.category,
          'type', NEW.type,
          'queued_at', NOW()
        )
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Never fail notification insert if push call fails
      RAISE WARNING 'dispatch_sp_notification_push: http_post failed for notification_id=%: %', NEW.id, SQLERRM;
      IF v_has_debug_logs THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'dispatch_sp_notification_push',
          'Dispatch failed',
          jsonb_build_object(
            'notification_id', NEW.id,
            'user_id', NEW.user_id,
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'failed_at', NOW()
          )
        );
      END IF;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sp_notification_push_dispatch ON user_notifications;

CREATE TRIGGER trigger_sp_notification_push_dispatch
  AFTER INSERT ON user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION dispatch_sp_notification_push();

-- ==================================================
-- VERIFICATION QUERIES (run after migration)
-- ==================================================

-- Verify functions created
-- SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%sp%notification%';

-- Verify triggers created
-- SELECT trigger_name, event_manipulation, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name LIKE '%sp%notification%';

-- Verify push dispatch trigger exists
-- SELECT trigger_name, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'trigger_sp_notification_push_dispatch';

-- Verify push token exists for target user (required for physical device push)
-- SELECT user_id, token, platform, updated_at
-- FROM push_tokens
-- WHERE user_id = '<user_id>'
-- ORDER BY updated_at DESC;

-- Test SP earned notification (requires active subscriber)
-- INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description)
-- VALUES ('<wallet_id>', '<user_id>', 'earn_starter_pack', 50, 0, 50, 'Welcome bonus');

-- Check notification created
-- SELECT * FROM user_notifications WHERE user_id = '<user_id>' ORDER BY created_at DESC LIMIT 5;
