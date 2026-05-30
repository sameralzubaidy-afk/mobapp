-- TFV2-016: Trade notification log + throttle helper

-- Track sent notifications for throttling (max 3 non-payout per user per trade)
CREATE TABLE IF NOT EXISTS trade_notification_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id          UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  notification_type TEXT NOT NULL,  -- 'offer_expiry_1', 'auto_complete_1', 'payout_requires_action_1', etc.
  sent_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_id, user_id, notification_type)  -- prevent duplicate sends
);

CREATE INDEX IF NOT EXISTS idx_trade_notif_log_trade_user
  ON trade_notification_log(trade_id, user_id);

ALTER TABLE trade_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only notif_log" ON trade_notification_log;
CREATE POLICY "Service role only notif_log" ON trade_notification_log
  USING (auth.role() = 'service_role');

-- Helper function: check if a notification can be sent (throttle check)
CREATE OR REPLACE FUNCTION can_send_trade_notification(
  p_trade_id          UUID,
  p_user_id           UUID,
  p_type              TEXT,
  p_is_payout_related BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check if this exact notification type was already sent
  IF EXISTS (
    SELECT 1 FROM trade_notification_log
    WHERE trade_id        = p_trade_id
      AND user_id         = p_user_id
      AND notification_type = p_type
  ) THEN
    RETURN FALSE;
  END IF;

  -- Skip global cap check for payout notifications
  IF p_is_payout_related THEN
    RETURN TRUE;
  END IF;

  -- Global cap: max 3 non-payout notifications per user per trade
  SELECT COUNT(*) INTO v_count
  FROM trade_notification_log
  WHERE trade_id = p_trade_id
    AND user_id  = p_user_id
    AND notification_type NOT LIKE 'payout%';

  RETURN v_count < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
