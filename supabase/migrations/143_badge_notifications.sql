-- filepath: supabase/migrations/143_badge_notifications.sql
-- Migration: Badge Award Notifications
-- Task: NOTIF-V2-004 from MODULE-14-NOTIFICATIONS-V2.md
-- Purpose: Send push and in-app notifications when badges are awarded
-- Dependencies: 201_notifications_schema_v2.sql (notification schema)

-- =====================================================
-- Function to create badge notification
-- =====================================================
CREATE OR REPLACE FUNCTION create_badge_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_channels TEXT[];
  v_prefs RECORD;
BEGIN
  -- Get user's badge notification preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id AND category = 'badges';

  IF NOT FOUND THEN
    -- Default: all channels enabled for badges
    v_channels := ARRAY['push', 'in_app']::TEXT[];
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

  -- Create notification
  INSERT INTO user_notifications (user_id, category, type, title, body, data, channels)
  VALUES (p_user_id, 'badges', p_notification_type, p_title, p_body, p_data, v_channels)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Trigger: Send badge earned notification
-- =====================================================
CREATE OR REPLACE FUNCTION send_badge_earned_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_badge RECORD;
  v_notification_id UUID;
BEGIN
  -- Only send notification for new badge awards (not revocations)
  IF (to_jsonb(NEW)->>'revoked_at') IS NULL THEN
    -- Get badge details
    SELECT * INTO v_badge
    FROM badges
    WHERE id = NEW.badge_id;

    -- Create notification
    v_notification_id := create_badge_notification(
      NEW.user_id,
      'badge_earned',
      'New Badge Earned! 🏆',
      'Congratulations! You earned the "' || v_badge.name || '" badge: ' || v_badge.description,
      jsonb_build_object(
        'badge_id', v_badge.id,
        'badge_name', v_badge.name,
        'badge_icon', COALESCE(v_badge.icon_url, ''),
        'badge_description', v_badge.description,
        'category', v_badge.category,
        'deep_link', '/profile/badges'
      )
    );

    -- If push channel enabled, call edge function to send push notification
    -- This is done async via pg_net or external scheduler
    -- For MVP, we'll rely on app polling or realtime subscription
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS badge_earned_notification ON user_badges;

CREATE TRIGGER badge_earned_notification
  AFTER INSERT ON user_badges
  FOR EACH ROW
  EXECUTE FUNCTION send_badge_earned_notification();

-- =====================================================
-- Function to check and send milestone approaching notifications
-- =====================================================
CREATE OR REPLACE FUNCTION check_badge_milestones(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Milestone/challenge flows are decommissioned in MVP.
  -- Keep this RPC as a no-op for backward compatibility with existing app calls.
  PERFORM p_user_id;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Verify function exists
SELECT proname, prosrc FROM pg_proc WHERE proname IN ('create_badge_notification', 'send_badge_earned_notification', 'check_badge_milestones');

-- Verify trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND event_object_table = 'user_badges';

-- Test notification creation (replace with actual user_id)
-- SELECT create_badge_notification(
--   '<user_id>'::uuid,
--   'badge_earned',
--   'Test Badge',
--   'Test notification body',
--   '{"badge_id": "test", "deep_link": "/badges"}'::jsonb
-- );
