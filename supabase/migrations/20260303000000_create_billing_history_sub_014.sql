-- ============================================================================
-- Migration: Create Billing History Table for MODULE-11 TASK SUB-014
-- Purpose: Track all subscription billing events (charges, failures, refunds)
-- Date: 2026-03-03
-- ============================================================================

-- BLOCK 1: Create billing_history table
-- ============================================================================

-- Create billing status enum
DO $$ BEGIN
  CREATE TYPE billing_status AS ENUM ('succeeded', 'failed', 'refunded', 'pending');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create billing_history table
CREATE TABLE IF NOT EXISTS public.billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  
  -- Stripe reference
  charge_id TEXT UNIQUE NOT NULL,
  stripe_invoice_id TEXT,
  
  -- Amount details
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  
  -- Status and timing
  status billing_status NOT NULL DEFAULT 'pending',
  charged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata
  description TEXT,
  error_message TEXT, -- For failed charges
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add column comments for documentation
COMMENT ON TABLE public.billing_history IS 'SUB-014: Complete billing history for subscriptions (charges, failures, refunds)';
COMMENT ON COLUMN public.billing_history.user_id IS 'User who was charged';
COMMENT ON COLUMN public.billing_history.subscription_id IS 'Subscription that triggered the charge';
COMMENT ON COLUMN public.billing_history.charge_id IS 'Stripe charge ID (unique identifier from Stripe)';
COMMENT ON COLUMN public.billing_history.stripe_invoice_id IS 'Stripe invoice ID (for receipts/invoices)';
COMMENT ON COLUMN public.billing_history.amount IS 'Amount charged in cents (e.g., 499 for $4.99)';
COMMENT ON COLUMN public.billing_history.status IS 'Payment status: succeeded, failed, refunded, pending';
COMMENT ON COLUMN public.billing_history.charged_at IS 'When the charge was attempted/succeeded';
COMMENT ON COLUMN public.billing_history.description IS 'Human-readable description (e.g., "Kids Club+ Monthly - March 2026")';
COMMENT ON COLUMN public.billing_history.error_message IS 'Error message if charge failed';

-- ============================================================================
-- BLOCK 2: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_billing_history_user_id_created_at 
  ON public.billing_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_history_subscription_id_created_at 
  ON public.billing_history(subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_history_charge_id 
  ON public.billing_history(charge_id);

CREATE INDEX IF NOT EXISTS idx_billing_history_status 
  ON public.billing_history(status);

CREATE INDEX IF NOT EXISTS idx_billing_history_charged_at 
  ON public.billing_history(charged_at DESC);

-- ============================================================================
-- BLOCK 3: Enable RLS and create policies
-- ============================================================================

ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own billing history
DROP POLICY IF EXISTS "billing_history_select_own" ON public.billing_history;
CREATE POLICY "billing_history_select_own" ON public.billing_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role can manage all billing records (for webhooks/admin functions)
DROP POLICY IF EXISTS "billing_history_service_role" ON public.billing_history;
CREATE POLICY "billing_history_service_role" ON public.billing_history
  FOR ALL TO service_role
  USING (true);

-- ============================================================================
-- BLOCK 4: Auto-update updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_billing_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS billing_history_updated_at_trigger ON public.billing_history;
CREATE TRIGGER billing_history_updated_at_trigger
  BEFORE UPDATE ON public.billing_history
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_history_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration to confirm)
-- ============================================================================

-- Query 1: Verify table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'billing_history'
ORDER BY ordinal_position;

-- Query 2: Verify indexes created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'billing_history'
ORDER BY indexname;

-- Query 3: Verify RLS enabled and policies exist
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'billing_history';

SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'billing_history';

-- Query 4: Verify foreign key constraints
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.billing_history'::regclass
  AND contype = 'f';

-- Query 5: Test read access (run as authenticated user)
-- SELECT * FROM public.billing_history WHERE user_id = auth.uid() LIMIT 1;

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- ✅ billing_history table created with all required columns
-- ✅ 5 indexes created for query performance
-- ✅ RLS enabled with user and service role policies
-- ✅ Foreign keys to auth.users and subscriptions enforced
-- ✅ Auto-update trigger for updated_at column
-- ✅ Column comments document purpose of each field
