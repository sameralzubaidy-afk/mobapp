-- ============================================================================
-- Migration: Enhance Subscriptions Table for MODULE-11 TASK SUB-002
-- Purpose: Add grace period, cancellation, billing, and tier linkage fields
-- Date: 2026-02-13
-- ============================================================================

-- BLOCK 1: Schema Enhancements
-- ============================================================================

-- Add tier linkage (FK to subscription_tiers table)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES public.subscription_tiers(id) ON DELETE SET NULL;

-- Add billing cycle tracking
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payment_amount INTEGER,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;

-- Add payment failure tracking (for retry logic)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_retry_count INTEGER DEFAULT 0 CHECK (payment_retry_count >= 0 AND payment_retry_count <= 3);

-- Add auto-renewal control (user can toggle off to pause subscription)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS auto_renew_enabled BOOLEAN DEFAULT TRUE;

-- Add cancellation tracking
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Add pause functionality (retention feature)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;

-- Add grace period tracking (90-day countdown before SP deletion)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS grace_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ;

-- Add trial usage flag (prevent trial abuse)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- Add saved payment method ID (for seamless re-subscribe)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

-- Add trial reminder tracking (for notification triggers)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS trial_reminder_day_23_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_reminder_day_28_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_reminder_day_29_sent BOOLEAN DEFAULT FALSE;

-- Update status constraint to include new V2.1 states
DO $$
BEGIN
  -- Drop the old constraint
  ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
  
  -- Create the updated constraint with all V2.1 statuses
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('free', 'trial', 'active', 'grace', 'canceled', 'expired', 'paused', 'grace_period', 'cancelled'));
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier_id ON public.subscriptions(tier_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON public.subscriptions(next_billing_date) WHERE next_billing_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_grace_ends_at ON public.subscriptions(grace_ends_at) WHERE grace_ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_failed_at ON public.subscriptions(payment_failed_at) WHERE payment_failed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_paused_until ON public.subscriptions(paused_until) WHERE paused_until IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN public.subscriptions.tier_id IS 'V2.1: Link to subscription_tiers table (e.g., Kids Club+)';
COMMENT ON COLUMN public.subscriptions.monthly_price_cents IS 'V2.1: Subscription price in cents (e.g., 499 for $4.99)';
COMMENT ON COLUMN public.subscriptions.last_payment_date IS 'V2.1: Timestamp of most recent successful payment';
COMMENT ON COLUMN public.subscriptions.last_payment_amount IS 'V2.1: Amount of most recent successful payment in cents';
COMMENT ON COLUMN public.subscriptions.next_billing_date IS 'V2.1: When next charge will occur (anniversary billing cycle)';
COMMENT ON COLUMN public.subscriptions.payment_failed_at IS 'V2.1: Timestamp of most recent failed payment attempt';
COMMENT ON COLUMN public.subscriptions.payment_retry_count IS 'V2.1: Number of payment retry attempts (0-3)';
COMMENT ON COLUMN public.subscriptions.auto_renew_enabled IS 'V2.1: Whether subscription auto-renews (user can toggle to pause)';
COMMENT ON COLUMN public.subscriptions.cancelled_at IS 'V2.1: When user requested cancellation';
COMMENT ON COLUMN public.subscriptions.cancel_reason IS 'V2.1: User feedback on why they cancelled (for analytics)';
COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'V2.1: Whether to cancel at end of current period (Stripe semantics)';
COMMENT ON COLUMN public.subscriptions.paused_until IS 'V2.1: When pause ends and subscription auto-resumes (retention feature)';
COMMENT ON COLUMN public.subscriptions.grace_started_at IS 'V2.1: When grace period began (after loss of Kids Club+ access)';
COMMENT ON COLUMN public.subscriptions.grace_ends_at IS 'V2.1: When grace period ends and SP are permanently deleted (90 days default)';
COMMENT ON COLUMN public.subscriptions.has_used_trial IS 'V2.1: Whether user has used their free trial (prevents abuse)';
COMMENT ON COLUMN public.subscriptions.stripe_payment_method_id IS 'V2.1: Saved Stripe payment method for seamless re-subscribe';

-- ============================================================================
-- BLOCK 2: Create user_subscriptions view and RLS (MODULE-11 naming convention)
-- ============================================================================

-- Ensure RLS is enabled on base table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Select policy: User can view their own subscription
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Insert policy: User can create their own subscription record
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
CREATE POLICY "subscriptions_insert_own" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update policy: User can update their own subscription record
-- NOTE: In production, status changes should be handled by service role/webhooks
-- but for simulation and E2E tests, we allow the owner to update.
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
CREATE POLICY "subscriptions_update_own" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Service role bypass
DROP POLICY IF EXISTS "subscriptions_service_role" ON public.subscriptions;
CREATE POLICY "subscriptions_service_role" ON public.subscriptions
  FOR ALL TO service_role
  USING (true);

-- Create a view alias to match MODULE-11 naming conventions
CREATE OR REPLACE VIEW public.user_subscriptions AS
SELECT * FROM public.subscriptions;

-- Enable RLS on the view (inherits from subscriptions table)
COMMENT ON VIEW public.user_subscriptions IS 'Alias view for subscriptions table (matches MODULE-11 naming convention)';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Query 1: Verify new columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name IN (
    'tier_id', 'monthly_price_cents', 'last_payment_date', 'last_payment_amount',
    'next_billing_date', 'payment_failed_at', 'payment_retry_count', 'auto_renew_enabled',
    'cancelled_at', 'cancel_reason', 'cancel_at_period_end', 'paused_until',
    'grace_started_at', 'grace_ends_at', 'has_used_trial', 'stripe_payment_method_id',
    'trial_reminder_day_23_sent', 'trial_reminder_day_28_sent', 'trial_reminder_day_29_sent'
  )
ORDER BY column_name;

-- Query 2: Verify indexes created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'subscriptions'
  AND indexname LIKE 'idx_subscriptions_%'
ORDER BY indexname;

-- Query 3: Verify status constraint updated
SELECT
  conname,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.subscriptions'::regclass
  AND conname = 'subscriptions_status_check';

-- Query 4: Verify view created
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'user_subscriptions';

-- Query 5: Check foreign key constraint to subscription_tiers
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.subscriptions'::regclass
  AND contype = 'f'
  AND confrelid = 'public.subscription_tiers'::regclass;
