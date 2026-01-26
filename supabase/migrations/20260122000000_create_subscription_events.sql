-- Migration: Subscription Events Audit Log
-- Purpose: Provide an audit trail table for subscription lifecycle events.
-- Note: Trial extensions are removed from product requirements.

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at DESC);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription events" ON subscription_events;
CREATE POLICY "Users can view own subscription events"
  ON subscription_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert subscription events" ON subscription_events;
CREATE POLICY "Service role can insert subscription events"
  ON subscription_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

COMMENT ON TABLE subscription_events IS 'Audit log for subscription lifecycle events (e.g., cancellations, renewals, status changes).';
