-- File: supabase/migrations/20260510000001_tax_001_sales_tax_schema.sql
-- MODULE-15.3-PART3 TAX-001
-- Idempotent (Mode B). Tax rate stored as DECIMAL FRACTION (0.0635 = 6.35%).

-- BLOCK 1: schema
ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS tax_rate         DECIMAL(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_jurisdiction TEXT,
  ADD COLUMN IF NOT EXISTS tax_enabled      BOOLEAN      NOT NULL DEFAULT FALSE;

ALTER TABLE public.nodes DROP CONSTRAINT IF EXISTS nodes_tax_rate_range_chk;
ALTER TABLE public.nodes ADD  CONSTRAINT nodes_tax_rate_range_chk CHECK (tax_rate >= 0 AND tax_rate <= 1);

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS tax_amount_cents     INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_amount_cents INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate_applied     DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS tax_jurisdiction     TEXT;

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_tax_amount_nonneg_chk;
ALTER TABLE public.trades ADD  CONSTRAINT trades_tax_amount_nonneg_chk CHECK (tax_amount_cents >= 0 AND taxable_amount_cents >= 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'admin_config_category' AND e.enumlabel = 'tax'
  ) THEN
    EXECUTE 'ALTER TYPE admin_config_category ADD VALUE ''tax''';
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.tax_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id              UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  buyer_id              UUID NOT NULL,
  node_id               UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
  taxable_amount_cents  INTEGER       NOT NULL CHECK (taxable_amount_cents >= 0),
  tax_rate              DECIMAL(5,4)  NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 1),
  tax_amount_cents      INTEGER       NOT NULL CHECK (tax_amount_cents >= 0),
  tax_jurisdiction      TEXT,
  refunded_tax_cents    INTEGER       NOT NULL DEFAULT 0 CHECK (refunded_tax_cents >= 0),
  refund_reason         TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_records_refund_le_collected_chk CHECK (refunded_tax_cents <= tax_amount_cents)
);

-- BLOCK 2: indexes + RLS + seed
CREATE INDEX IF NOT EXISTS idx_tax_records_trade_id   ON public.tax_records (trade_id);
CREATE INDEX IF NOT EXISTS idx_tax_records_buyer_id   ON public.tax_records (buyer_id);
CREATE INDEX IF NOT EXISTS idx_tax_records_node_id    ON public.tax_records (node_id);
CREATE INDEX IF NOT EXISTS idx_tax_records_created_at ON public.tax_records (created_at);
CREATE INDEX IF NOT EXISTS idx_trades_tax_amount_pos  ON public.trades (tax_amount_cents) WHERE tax_amount_cents > 0;

ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_records_select_own       ON public.tax_records;
DROP POLICY IF EXISTS tax_records_service_role_all ON public.tax_records;
DROP POLICY IF EXISTS tax_records_admin_select     ON public.tax_records;

CREATE POLICY tax_records_select_own       ON public.tax_records FOR SELECT TO authenticated USING (buyer_id = auth.uid());
CREATE POLICY tax_records_service_role_all ON public.tax_records FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY tax_records_admin_select     ON public.tax_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES
  ('sales_tax_enabled',           'false',  'Global on/off switch for sales tax collection',                    'tax', 'boolean', true),
  ('default_sales_tax_rate',      '0.0635', 'Fallback decimal tax rate if node has none (0.0635 = 6.35%)',      'tax', 'number',  true),
  ('subscription_fee_taxable',    'false',  'Whether subscription fees are subject to sales tax',               'tax', 'boolean', true),
  ('tax_remittance_jurisdiction', 'CT',     'Default jurisdiction for tax remittance / filing',                 'tax', 'string',  true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_node_tax_rate(p_node_id UUID)
RETURNS DECIMAL(5,4)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_global_enabled BOOLEAN; v_node_enabled BOOLEAN;
  v_node_rate DECIMAL(5,4); v_default_rate DECIMAL(5,4);
BEGIN
  SELECT (value::boolean) INTO v_global_enabled FROM public.admin_config WHERE key='sales_tax_enabled' LIMIT 1;
  IF NOT COALESCE(v_global_enabled, FALSE) THEN RETURN 0; END IF;
  IF p_node_id IS NULL THEN RETURN 0; END IF;
  SELECT n.tax_enabled, n.tax_rate INTO v_node_enabled, v_node_rate FROM public.nodes n WHERE n.id = p_node_id LIMIT 1;
  IF NOT COALESCE(v_node_enabled, FALSE) THEN RETURN 0; END IF;
  IF v_node_rate IS NULL OR v_node_rate = 0 THEN
    SELECT (value::numeric)::DECIMAL(5,4) INTO v_default_rate FROM public.admin_config WHERE key='default_sales_tax_rate' LIMIT 1;
    RETURN COALESCE(v_default_rate, 0);
  END IF;
  RETURN v_node_rate;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_node_tax_rate(UUID) TO authenticated, service_role;
