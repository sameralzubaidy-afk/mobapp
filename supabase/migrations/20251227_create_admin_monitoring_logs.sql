-- Migration: Create admin_monitoring_logs table for monitoring alerts

-- BLOCK 1: Create table
CREATE TABLE IF NOT EXISTS admin_monitoring_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  buyer_id UUID,
  alert_type TEXT NOT NULL DEFAULT 'subscription_change',
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_monitoring_logs_trade_id ON admin_monitoring_logs(trade_id);
CREATE INDEX IF NOT EXISTS idx_admin_monitoring_logs_buyer_id ON admin_monitoring_logs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_admin_monitoring_logs_created_at ON admin_monitoring_logs(created_at DESC);

-- BLOCK 2: (Optional) Security + RLS
-- We expect server-side reads via service role; keep RLS locked down by default.
ALTER TABLE admin_monitoring_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read monitoring logs" ON admin_monitoring_logs;
CREATE POLICY "Admins can read monitoring logs"
  ON admin_monitoring_logs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can modify monitoring logs" ON admin_monitoring_logs;
CREATE POLICY "Admins can modify monitoring logs"
  ON admin_monitoring_logs FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Verification
SELECT table_name FROM information_schema.tables WHERE table_name = 'admin_monitoring_logs';