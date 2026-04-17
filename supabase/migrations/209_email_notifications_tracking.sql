-- =====================================================
-- FILE: supabase/migrations/209_email_notifications_tracking.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-009)
-- TASK: Email Notifications - Tracking & Unsubscribe
-- DESCRIPTION:
--   1. Create email_logs table for delivery tracking
--   2. Create unsubscribe_tokens table
--   3. Add SendGrid template IDs to admin_config
--   4. Create RPCs for email tracking
-- =====================================================

-- ==================================================
-- STEP 1: Create email_logs table
-- ==================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  template_type TEXT NOT NULL,
  sendgrid_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounce_reason TEXT,
  unsubscribed_at TIMESTAMPTZ,
  error_message TEXT,
  template_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT email_status_check CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed'))
);

-- Reconcile legacy/partial schemas where email_logs exists without newer columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_logs'
      AND column_name = 'template'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_logs'
      AND column_name = 'template_type'
  ) THEN
    ALTER TABLE public.email_logs RENAME COLUMN template TO template_type;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_logs'
      AND column_name = 'template_name'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_logs'
      AND column_name = 'template_type'
  ) THEN
    ALTER TABLE public.email_logs RENAME COLUMN template_name TO template_type;
  END IF;
END;
$$;

ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS template_type TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS sendgrid_message_id TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS bounce_reason TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS template_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.email_logs
SET template_type = 'legacy_template'
WHERE template_type IS NULL;

ALTER TABLE public.email_logs ALTER COLUMN template_type SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN status SET DEFAULT 'pending';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_sendgrid_message_id ON email_logs(sendgrid_message_id) WHERE sendgrid_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON email_logs(template_type);

-- RLS: Users can view their own email logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email logs" ON email_logs;
CREATE POLICY "Users can view own email logs"
  ON email_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to email logs" ON email_logs;
CREATE POLICY "Service role full access to email logs"
  ON email_logs FOR ALL
  TO service_role
  USING (true);

-- ==================================================
-- STEP 2: Create unsubscribe_tokens table
-- ==================================================

CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  category notification_category NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '365 days')
);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON unsubscribe_tokens(token);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_user_id ON unsubscribe_tokens(user_id);

ALTER TABLE unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to unsubscribe tokens" ON unsubscribe_tokens;
CREATE POLICY "Service role full access to unsubscribe tokens"
  ON unsubscribe_tokens FOR ALL
  TO service_role
  USING (true);

-- ==================================================
-- STEP 3: Add SendGrid template IDs to admin_config
-- ==================================================

INSERT INTO admin_config (key, value, category, description, data_type)
VALUES
  ('sendgrid_template_payment_failed', 'd-payment-failed-xxxxx', 'email', 'SendGrid template ID for payment failure emails', 'string'),
  ('sendgrid_template_trial_expiring', 'd-trial-expiring-xxxxx', 'email', 'SendGrid template ID for trial expiration reminder', 'string'),
  ('sendgrid_template_subscription_cancelled', 'd-subscription-cancelled-xxxxx', 'email', 'SendGrid template ID for subscription cancellation', 'string'),
  ('sendgrid_template_security_alert', 'd-security-alert-xxxxx', 'email', 'SendGrid template ID for account security alerts', 'string'),
  ('sendgrid_template_password_changed', 'd-password-changed-xxxxx', 'email', 'SendGrid template ID for password change confirmation', 'string'),
  ('sendgrid_webhook_signature_key', '', 'email', 'SendGrid webhook signature verification key', 'string')
ON CONFLICT (key) DO UPDATE 
SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- ==================================================
-- STEP 4: RPC - Create email log entry
-- ==================================================

CREATE OR REPLACE FUNCTION create_email_log(
  p_user_id UUID,
  p_recipient_email TEXT,
  p_template_type TEXT,
  p_template_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_has_email_type BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'email_logs'
      AND c.column_name = 'email_type'
  ) INTO v_has_email_type;

  IF v_has_email_type THEN
    INSERT INTO email_logs (
      user_id,
      recipient_email,
      email_type,
      template_type,
      metadata,
      template_data,
      status
    )
    VALUES (
      p_user_id,
      p_recipient_email,
      p_template_type,
      p_template_type,
      COALESCE(p_template_data, '{}'::jsonb),
      COALESCE(p_template_data, '{}'::jsonb),
      'pending'
    )
    RETURNING id INTO v_log_id;
  ELSE
    INSERT INTO email_logs (
      user_id,
      recipient_email,
      template_type,
      template_data,
      status
    )
    VALUES (
      p_user_id,
      p_recipient_email,
      p_template_type,
      COALESCE(p_template_data, '{}'::jsonb),
      'pending'
    )
    RETURNING id INTO v_log_id;
  END IF;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 5: RPC - Update email log status
-- ==================================================

CREATE OR REPLACE FUNCTION update_email_log_status(
  p_log_id UUID,
  p_sendgrid_message_id TEXT,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  UPDATE email_logs
  SET
    sendgrid_message_id = COALESCE(p_sendgrid_message_id, sendgrid_message_id),
    status = p_status,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
    bounced_at = CASE WHEN p_status = 'bounced' THEN now() ELSE bounced_at END,
    error_message = p_error_message,
    updated_at = now()
  WHERE id = p_log_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 6: RPC - Track email event from SendGrid webhook
-- ==================================================

CREATE OR REPLACE FUNCTION track_email_event(
  p_sendgrid_message_id TEXT,
  p_event_type TEXT,
  p_bounce_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  -- Find log entry by SendGrid message ID
  UPDATE email_logs
  SET
    status = CASE
      WHEN p_event_type = 'delivered' THEN 'delivered'
      WHEN p_event_type = 'open' THEN 'opened'
      WHEN p_event_type = 'click' THEN 'clicked'
      WHEN p_event_type = 'bounce' THEN 'bounced'
      WHEN p_event_type = 'dropped' THEN 'failed'
      ELSE status
    END,
    delivered_at = CASE WHEN p_event_type = 'delivered' THEN now() ELSE delivered_at END,
    opened_at = CASE WHEN p_event_type = 'open' THEN now() ELSE opened_at END,
    clicked_at = CASE WHEN p_event_type = 'click' THEN now() ELSE clicked_at END,
    bounced_at = CASE WHEN p_event_type = 'bounce' THEN now() ELSE bounced_at END,
    bounce_reason = CASE WHEN p_event_type = 'bounce' THEN p_bounce_reason ELSE bounce_reason END,
    updated_at = now()
  WHERE sendgrid_message_id = p_sendgrid_message_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 7: RPC - Generate unsubscribe token
-- ==================================================

CREATE OR REPLACE FUNCTION generate_unsubscribe_token(
  p_user_id UUID,
  p_category notification_category
)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate a secure random token
  v_token := encode(gen_random_bytes(32), 'base64url');

  -- Insert token
  INSERT INTO unsubscribe_tokens (user_id, token, category)
  VALUES (p_user_id, v_token, p_category);

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 8: RPC - Process unsubscribe
-- ==================================================

CREATE OR REPLACE FUNCTION process_unsubscribe(
  p_token TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Find and validate token
  SELECT * INTO v_token_record
  FROM unsubscribe_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  -- Mark token as used
  UPDATE unsubscribe_tokens
  SET used_at = now()
  WHERE token = p_token;

  -- Update notification preferences (disable email for category)
  UPDATE notification_preferences
  SET 
    email_enabled = false,
    updated_at = now()
  WHERE user_id = v_token_record.user_id
    AND category = v_token_record.category;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_token_record.user_id,
    'category', v_token_record.category
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 9: RPC - Get email delivery stats (for admin dashboard)
-- ==================================================

CREATE OR REPLACE FUNCTION get_email_delivery_stats(
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
  total_sent BIGINT,
  total_delivered BIGINT,
  total_opened BIGINT,
  total_clicked BIGINT,
  total_bounced BIGINT,
  total_failed BIGINT,
  delivery_rate NUMERIC,
  open_rate NUMERIC,
  click_rate NUMERIC,
  bounce_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_sent,
    COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT AS total_delivered,
    COUNT(*) FILTER (WHERE status = 'opened')::BIGINT AS total_opened,
    COUNT(*) FILTER (WHERE status = 'clicked')::BIGINT AS total_clicked,
    COUNT(*) FILTER (WHERE status = 'bounced')::BIGINT AS total_bounced,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS total_failed,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked')) / NULLIF(COUNT(*), 0),
      2
    ) AS delivery_rate,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status IN ('opened', 'clicked')) / NULLIF(COUNT(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked')), 0),
      2
    ) AS open_rate,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'clicked') / NULLIF(COUNT(*) FILTER (WHERE status IN ('opened', 'clicked')), 0),
      2
    ) AS click_rate,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'bounced') / NULLIF(COUNT(*), 0),
      2
    ) AS bounce_rate
  FROM email_logs
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- 1. Check if tables exist
-- SELECT * FROM information_schema.tables WHERE table_name IN ('email_logs', 'unsubscribe_tokens');

-- 2. Check email_logs RLS
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'email_logs';

-- 3. Test create email log
-- SELECT create_email_log(
--   auth.uid(),
--   'test@example.com',
--   'payment_failed',
--   '{"amount": 9.99, "reason": "Insufficient funds"}'::jsonb
-- );

-- 4. Test generate unsubscribe token
-- SELECT generate_unsubscribe_token(auth.uid(), 'subscription');

-- 5. Test email delivery stats
-- SELECT * FROM get_email_delivery_stats();
