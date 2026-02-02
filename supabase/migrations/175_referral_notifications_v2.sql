-- =====================================================
-- FILE: supabase/migrations/175_referral_notifications_v2.sql
-- MODULE: MODULE-17-REFERRALS-V2 (REF-V2-005)
-- TASK: Referral Notifications
-- DESCRIPTION:
--   Create notification triggers for referral events:
--   1. Invite accepted (referee signs up)
--   2. First trade completed (referee completes first trade)
--   3. SP rewards granted
-- =====================================================

-- ==================================================
-- STEP 1: Create user_notifications table (if not exists)
-- ==================================================

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'system',
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channels TEXT[] DEFAULT ARRAY['push', 'in_app'],
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);

-- RLS: Users can only view their own notifications
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON user_notifications;
CREATE POLICY "Users can view own notifications"
  ON user_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON user_notifications;
CREATE POLICY "Users can update own notifications"
  ON user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ==================================================
-- STEP 2: Notification Template Helper Function
-- ==================================================

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_notifications (
    user_id,
    category,
    type,
    title,
    body,
    channels,
    data
  )
  VALUES (
    p_user_id,
    'system',
    p_type,
    p_title,
    p_body,
    ARRAY['push', 'in_app'],
    p_data
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 3: Notification Trigger - Invite Accepted
-- ==================================================

CREATE OR REPLACE FUNCTION notify_referral_invite_accepted()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_profile_id UUID;
BEGIN
  -- Get referrer's profile ID
  SELECT id INTO v_referrer_profile_id
  FROM profiles
  WHERE user_id = NEW.referrer_user_id;

  -- Notify referrer that their invite was accepted
  PERFORM create_notification(
    NEW.referrer_user_id,
    'referral_invite_accepted',
    'Your Invite Was Accepted! 🎉',
    'Someone just signed up using your referral code. They''ll earn you SP when they complete their first trade!',
    jsonb_build_object(
      'deep_link', 'ReferralDashboard',
      'referral_id', NEW.id,
      'referee_id', NEW.referred_user_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS referral_invite_accepted_trigger ON referrals;
CREATE TRIGGER referral_invite_accepted_trigger
AFTER INSERT ON referrals
FOR EACH ROW
EXECUTE FUNCTION notify_referral_invite_accepted();

-- ==================================================
-- STEP 4: Notification Trigger - Rewards Granted
-- ==================================================

CREATE OR REPLACE FUNCTION notify_referral_rewards_granted()
RETURNS TRIGGER AS $$
DECLARE
  v_trial_extended BOOLEAN;
  v_referrer_sp INT;
  v_referee_sp INT;
BEGIN
  -- Only trigger on status change to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    v_trial_extended := NEW.trial_extension_applied;
    
    -- Get SP amounts from sp_config (V2 system) or use defaults
    v_referrer_sp := COALESCE(
      (SELECT (config_value)::INT FROM sp_config WHERE config_key = 'referral_reward_referrer_sp'),
      25
    );
    v_referee_sp := COALESCE(
      (SELECT (config_value)::INT FROM sp_config WHERE config_key = 'referral_reward_referee_sp'),
      10
    );

    -- Notify referrer about rewards
    PERFORM create_notification(
      NEW.referrer_user_id,
      'referral_rewards_granted',
      format('You Earned %s SP! 💰', v_referrer_sp),
      CASE
        WHEN v_trial_extended THEN 
          format('Your referral completed their first trade! You earned %s SP and 7 extra trial days.', v_referrer_sp)
        ELSE 
          format('Your referral completed their first trade! You earned %s SP.', v_referrer_sp)
      END,
      jsonb_build_object(
        'deep_link', 'ReferralDashboard',
        'sp_earned', v_referrer_sp,
        'trial_extended', v_trial_extended,
        'referral_id', NEW.id
      )
    );

    -- Notify referee about welcome bonus
    PERFORM create_notification(
      NEW.referred_user_id,
      'referral_welcome_bonus',
      format('Welcome Bonus: %s SP! 🎁', v_referee_sp),
      format('You completed your first trade and earned a welcome bonus of %s SP!', v_referee_sp),
      jsonb_build_object(
        'deep_link', 'SpWallet',
        'sp_earned', v_referee_sp,
        'referral_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS referral_rewards_notification_trigger ON referrals;
CREATE TRIGGER referral_rewards_notification_trigger
AFTER UPDATE ON referrals
FOR EACH ROW
EXECUTE FUNCTION notify_referral_rewards_granted();

-- ==================================================
-- STEP 5: RPC - Get Unread Notification Count
-- ==================================================

CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_user_id UUID
)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_count
  FROM user_notifications
  WHERE user_id = p_user_id
    AND is_read = false;
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 6: RPC - Mark Notification as Read
-- ==================================================

CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
BEGIN
  UPDATE user_notifications
  SET is_read = true,
      read_at = now()
  WHERE id = p_notification_id
    AND user_id = p_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Notification not found');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 7: RPC - Mark All Notifications as Read
-- ==================================================

CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_updated_count INT;
BEGIN
  UPDATE user_notifications
  SET is_read = true,
      read_at = now()
  WHERE user_id = p_user_id
    AND is_read = false;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================

-- Verify table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_notifications'
ORDER BY ordinal_position;

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'user_notifications';

-- Verify triggers created
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND event_object_table = 'referrals'
ORDER BY trigger_name;

-- Verify functions created
SELECT proname, prosrc
FROM pg_proc
WHERE proname IN ('notify_referral_invite_accepted', 'notify_referral_rewards_granted', 'create_notification')
ORDER BY proname;
