-- =====================================================
-- FILE: supabase/migrations/145_trade_notifications.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-007)
-- TASK: Trade Event Notifications
-- DESCRIPTION:
--   1. create_trade_notification(user_id, type, title, body, data)
--      - Respects notification_preferences for 'trades' category
--      - Inserts into user_notifications table
--   2. send_trade_request_notification() trigger → fires AFTER INSERT on trades
--      - Notifies seller of new trade request
--   3. send_trade_status_notification() trigger → fires AFTER UPDATE on trades
--      - trade_completion_requested → notify buyer when seller marks complete (two-step flow)
--      - trade_completed → notify buyer AND seller
--      - trade_cancelled → notify buyer AND seller
-- DEPENDENCIES:
--   - 175_referral_notifications_v2.sql  (user_notifications table)
--   - 201_notifications_schema_v2.sql    (notification_preferences with 'trades' category)
-- MODE: idempotent / rerunnable (all CREATE OR REPLACE, DROP IF EXISTS before CREATE TRIGGER)
-- =====================================================

-- =====================================================
-- BLOCK 1: create_trade_notification helper function
-- =====================================================

-- SECURITY DEFINER needed because:
-- Triggers run in the session of the calling user; this function must insert
-- into user_notifications and read notification_preferences for OTHER users
-- (e.g. the seller when a buyer creates a trade).  Explicit search_path set to public.

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
BEGIN
  -- Read user's trade notification preferences
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

  -- Insert notification record
  INSERT INTO public.user_notifications (
    user_id,
    category,
    type,
    title,
    body,
    data,
    channels
  ) VALUES (
    p_user_id,
    'trades',
    p_notification_type,
    p_title,
    p_body,
    COALESCE(p_data, '{}'::jsonb),
    v_channels
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- BLOCK 2: Trigger function — trade_request (INSERT)
-- Notifies SELLER when a new trade is created.
-- =====================================================

CREATE OR REPLACE FUNCTION public.send_trade_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_item_title       TEXT;
  v_buyer_name       TEXT;
  v_listing_id_text  TEXT;
BEGIN
  -- Support both legacy trades.item_id and V2 trades.listing_id.
  v_listing_id_text := COALESCE(to_jsonb(NEW)->>'listing_id', to_jsonb(NEW)->>'item_id');

  -- Resolve item title (table-qualified to avoid ambiguity)
  SELECT i.title
    INTO v_item_title
    FROM public.items i
   WHERE i.id::text = v_listing_id_text;

  -- Resolve buyer display name from canonical profiles.name.
  SELECT COALESCE(p.name, 'Someone')
    INTO v_buyer_name
    FROM public.profiles p
   WHERE p.user_id = NEW.buyer_id;

  -- Notify seller
  PERFORM public.create_trade_notification(
    NEW.seller_id,
    'trade_request',
    'New Trade Request! 💬',
    COALESCE(v_buyer_name, 'Someone') || ' wants to trade for your "' || COALESCE(v_item_title, 'item') || '"',
    jsonb_build_object(
      'trade_id',   NEW.id::text,
      'item_id',    COALESCE(v_listing_id_text, ''),
      'item_title', COALESCE(v_item_title, ''),
      'buyer_id',   NEW.buyer_id::text,
      'buyer_name', COALESCE(v_buyer_name, ''),
      'deep_link',  '/trades/' || NEW.id::text,
      'type',       'trade_request'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  IF to_regclass('public.debug_logs') IS NOT NULL THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES (
      'send_trade_request_notification',
      'ERROR',
      jsonb_build_object(
        'trade_id', NEW.id,
        'error', SQLERRM,
        'state', SQLSTATE
      )
    );
  END IF;

  -- Do not fail the trade INSERT — log warning only
  RAISE WARNING '[send_trade_request_notification] Error for trade %: % (SQLSTATE: %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trade_request_notification ON public.trades;
CREATE TRIGGER trade_request_notification
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.send_trade_request_notification();

-- =====================================================
-- BLOCK 3: Trigger function — trade_status_change (UPDATE)
-- Routes notifications based on new trade status.
-- =====================================================

CREATE OR REPLACE FUNCTION public.send_trade_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_item_title       TEXT;
  v_buyer_name       TEXT;
  v_seller_name      TEXT;
  v_listing_id_text  TEXT;
  v_seller_marked_before TEXT;
  v_seller_marked_after  TEXT;
BEGIN
  -- Detect seller mark-complete transition using schema-tolerant json access.
  v_seller_marked_before := to_jsonb(OLD)->>'seller_marked_completed_at';
  v_seller_marked_after := to_jsonb(NEW)->>'seller_marked_completed_at';

  -- Bail out only when neither status nor seller_marked_completed_at changed.
  IF NEW.status = OLD.status
     AND COALESCE(v_seller_marked_before, '') = COALESCE(v_seller_marked_after, '') THEN
    RETURN NEW;
  END IF;

  -- Support both legacy trades.item_id and V2 trades.listing_id.
  v_listing_id_text := COALESCE(to_jsonb(NEW)->>'listing_id', to_jsonb(NEW)->>'item_id');

  -- Resolve item title
  SELECT i.title
    INTO v_item_title
    FROM public.items i
   WHERE i.id::text = v_listing_id_text;

  -- Resolve participant names from canonical profiles.name.
  SELECT COALESCE(p.name, 'Buyer') INTO v_buyer_name  FROM public.profiles p WHERE p.user_id = NEW.buyer_id;
  SELECT COALESCE(p.name, 'Seller') INTO v_seller_name FROM public.profiles p WHERE p.user_id = NEW.seller_id;

  -- -------------------------------------------------------
  -- trade_completion_requested: seller marked complete first
  -- in two-step completion; buyer must confirm.
  -- -------------------------------------------------------
  IF v_seller_marked_before IS NULL
     AND v_seller_marked_after IS NOT NULL
     AND NEW.status <> 'completed' THEN

    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_completion_requested',
      'Trade Ready for Your Confirmation',
      COALESCE(v_seller_name, 'The seller') || ' marked your trade for "' || COALESCE(v_item_title, 'item') || '" as complete. Please confirm once received.',
      jsonb_build_object(
        'trade_id',   NEW.id::text,
        'item_id',    COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''),
        'deep_link',  '/trades/' || NEW.id::text,
        'type',       'trade_completion_requested'
      )
    );
  END IF;

  -- -------------------------------------------------------
  -- Legacy compatibility branch (older environments may use accepted)
  -- trade_accepted: pending → accepted  (notify buyer)
  -- -------------------------------------------------------
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN

    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_accepted',
      'Trade Accepted! ✅',
      COALESCE(v_seller_name, 'The seller') || ' accepted your trade request for "' || COALESCE(v_item_title, 'item') || '"',
      jsonb_build_object(
        'trade_id',   NEW.id::text,
        'item_id',    COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''),
        'deep_link',  '/trades/' || NEW.id::text,
        'type',       'trade_accepted'
      )
    );

  -- -------------------------------------------------------
  -- Legacy compatibility branch (older environments may use rejected)
  -- trade_rejected: pending → rejected  (notify buyer)
  -- -------------------------------------------------------
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN

    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_rejected',
      'Trade Declined',
      COALESCE(v_seller_name, 'The seller') || ' declined your trade request for "' || COALESCE(v_item_title, 'item') || '"',
      jsonb_build_object(
        'trade_id',   NEW.id::text,
        'item_id',    COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''),
        'deep_link',  '/browse',
        'type',       'trade_rejected'
      )
    );

  -- -------------------------------------------------------
  -- trade_completed: any → completed  (notify BOTH parties)
  -- -------------------------------------------------------
  ELSIF NEW.status = 'completed' AND OLD.status <> 'completed' THEN

    -- Notify buyer
    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_completed',
      'Trade Complete! 🎉',
      'Your trade for "' || COALESCE(v_item_title, 'item') || '" is complete! Don''t forget to leave a review.',
      jsonb_build_object(
        'trade_id',   NEW.id::text,
        'item_id',    COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''),
        'deep_link',  '/trades/' || NEW.id::text,
        'type',       'trade_completed'
      )
    );

    -- Notify seller (only if different person)
    IF NEW.seller_id <> NEW.buyer_id THEN
      PERFORM public.create_trade_notification(
        NEW.seller_id,
        'trade_completed',
        'Trade Complete! 🎉',
        'Your trade with ' || COALESCE(v_buyer_name, 'the buyer') || ' for "' || COALESCE(v_item_title, 'item') || '" is complete!',
        jsonb_build_object(
          'trade_id',   NEW.id::text,
          'item_id',    COALESCE(v_listing_id_text, ''),
          'item_title', COALESCE(v_item_title, ''),
          'deep_link',  '/trades/' || NEW.id::text,
          'type',       'trade_completed'
        )
      );
    END IF;

  -- -------------------------------------------------------
  -- trade_cancelled: any → cancelled  (notify BOTH parties)
  -- -------------------------------------------------------
  ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN

    -- Notify buyer
    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_cancelled',
      'Trade Cancelled',
      'The trade for "' || COALESCE(v_item_title, 'item') || '" has been cancelled.',
      jsonb_build_object(
        'trade_id',   NEW.id::text,
        'item_id',    COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''),
        'deep_link',  '/trades',
        'type',       'trade_cancelled'
      )
    );

    -- Notify seller (only if different person)
    IF NEW.seller_id <> NEW.buyer_id THEN
      PERFORM public.create_trade_notification(
        NEW.seller_id,
        'trade_cancelled',
        'Trade Cancelled',
        'The trade for "' || COALESCE(v_item_title, 'item') || '" has been cancelled.',
        jsonb_build_object(
          'trade_id',   NEW.id::text,
          'item_id',    COALESCE(v_listing_id_text, ''),
          'item_title', COALESCE(v_item_title, ''),
          'deep_link',  '/trades',
          'type',       'trade_cancelled'
        )
      );
    END IF;

  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  IF to_regclass('public.debug_logs') IS NOT NULL THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES (
      'send_trade_status_notification',
      'ERROR',
      jsonb_build_object(
        'trade_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'error', SQLERRM,
        'state', SQLSTATE
      )
    );
  END IF;

  -- Do not fail the trade UPDATE — log warning only
  RAISE WARNING '[send_trade_status_notification] Error for trade %: % (SQLSTATE: %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trade_status_notification ON public.trades;
CREATE TRIGGER trade_status_notification
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.send_trade_status_notification();

-- =====================================================
-- BLOCK 4: Verification queries (run after applying)
-- =====================================================

-- 1. Verify functions created:
-- SELECT proname FROM pg_proc
--  WHERE proname IN ('create_trade_notification','send_trade_request_notification','send_trade_status_notification');

-- 2. Verify triggers created:
-- SELECT trigger_name, event_manipulation, event_object_table
--   FROM information_schema.triggers
--  WHERE trigger_schema = 'public' AND trigger_name IN ('trade_request_notification','trade_status_notification');

-- 3. Smoke test the helper function (replace UUID with a real user_id):
-- SELECT public.create_trade_notification(
--   '<real-user-uuid>'::uuid,
--   'trade_request',
--   'Test Trade Request 💬',
--   'Someone wants to swap your item',
--   '{"trade_id":"test-trade","item_id":"test-item","deep_link":"/trades/test-trade","type":"trade_request"}'::jsonb
-- );

-- 4. Verify the row was inserted:
-- SELECT id, user_id, category, type, title, body, channels, created_at
--   FROM public.user_notifications
--  WHERE category = 'trades'
--  ORDER BY created_at DESC
--  LIMIT 5;
