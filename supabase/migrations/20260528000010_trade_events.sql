-- TFV2-019: Trade events table — append-only instrumentation log

-- ============================================================
-- TRADE EVENTS TABLE (Section 16)
-- Insert-only append log. No PII in metadata.
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id   UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  user_id    UUID REFERENCES auth.users(id),  -- actor (null for system/cron events)
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_events_trade_id   ON trade_events(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_events_event_name ON trade_events(event_name);
CREATE INDEX IF NOT EXISTS idx_trade_events_created_at ON trade_events(created_at DESC);

-- Partial unique index for idempotency on cron-triggered events
-- (prevents double-logging when cron retries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_events_cron_idempotency
  ON trade_events(trade_id, event_name)
  WHERE event_name IN ('offer_expired', 'auto_completed', 'sp_released_to_seller', 'sp_restored_to_buyer');

ALTER TABLE trade_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access trade_events" ON trade_events;
CREATE POLICY "Service role full access trade_events" ON trade_events
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admin role read trade_events" ON trade_events;
CREATE POLICY "Admin role read trade_events" ON trade_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- HELPER: log_trade_event()
-- Call this from all triggers and Edge Functions.
-- ============================================================
CREATE OR REPLACE FUNCTION log_trade_event(
  p_trade_id   UUID,
  p_event_name TEXT,
  p_user_id    UUID DEFAULT NULL,
  p_metadata   JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO trade_events (trade_id, event_name, user_id, metadata)
  VALUES (p_trade_id, p_event_name, p_user_id, p_metadata)
  ON CONFLICT DO NOTHING;  -- idempotency for cron-triggered events
EXCEPTION WHEN OTHERS THEN
  -- Never let event logging break the primary operation
  RAISE WARNING 'log_trade_event failed for trade % event %: %', p_trade_id, p_event_name, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
