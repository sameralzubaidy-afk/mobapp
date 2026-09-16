-- Migration: tax_008_backfill_defaults
-- Purpose: TAX-001 — add missing admin_config default_tax_rate entry and
--          idx_nodes_tax_enabled index that were missing from the initial schema.
-- Mode: idempotent rerunnable (INSERT ON CONFLICT DO NOTHING; CREATE INDEX IF NOT EXISTS)

-- 1. Add default_tax_rate to admin_config (system default fallback when node rate is 0)
INSERT INTO public.admin_config (key, value, category)
VALUES ('default_tax_rate', '0.0635', 'tax')
ON CONFLICT (key) DO NOTHING;

-- 2. Add idx_nodes_tax_enabled for fast filtering of tax-enabled nodes
CREATE INDEX IF NOT EXISTS idx_nodes_tax_enabled
  ON public.nodes (tax_enabled)
  WHERE tax_enabled = true;

-- ─── Verification queries (run after deploying) ─────────────────────────────
-- SELECT key, value FROM admin_config WHERE key = 'default_tax_rate';
-- --> should return: key=default_tax_rate, value=0.0635

-- SELECT indexname FROM pg_indexes WHERE tablename = 'nodes' AND indexname = 'idx_nodes_tax_enabled';
-- --> should return: idx_nodes_tax_enabled
