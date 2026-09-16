-- filepath: supabase/migrations/060_trades_v2.sql

-- Mode B: Idempotent rerunnable migration
-- Refine the trades table to support V2 state machine and dual-tender tracking.

-- 1. Add new columns for V2 trade flow
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS cash_currency TEXT DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS buyer_subscription_status TEXT, -- snapshot at time of trade (e.g., 'active', 'trial', 'free')
  ADD COLUMN IF NOT EXISTS buyer_transaction_fee_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS sp_debit_ledger_entry_id UUID, -- FK to sp_ledger (MODULE-09)
  ADD COLUMN IF NOT EXISTS sp_credit_ledger_entry_id UUID, -- FK to sp_ledger (MODULE-09)
  ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Normalize status values if needed
-- The V2 state machine uses: pending, payment_processing, payment_failed, in_progress, completed, cancelled.
-- We drop the old check constraint if it exists and add the new one.

DO $$
BEGIN
    -- Attempt to drop the old constraint if it exists. 
    -- In V1 it was: CHECK (status IN ('initiated', 'accepted', 'meetup_scheduled', 'completed', 'cancelled', 'disputed'))
    ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_status_check;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Map old statuses to new V2 statuses
UPDATE trades SET status = 'pending' WHERE status = 'initiated';
UPDATE trades SET status = 'in_progress' WHERE status IN ('accepted', 'meetup_scheduled', 'disputed');

-- Add the new V2 status constraint
ALTER TABLE trades ADD CONSTRAINT trades_status_check 
  CHECK (status IN ('pending', 'payment_processing', 'payment_failed', 'in_progress', 'completed', 'cancelled'));

-- Update default value for status to 'pending'
ALTER TABLE trades ALTER COLUMN status SET DEFAULT 'pending';

-- 3. Create index for performance on status changes
CREATE INDEX IF NOT EXISTS trades_last_status_change_at_idx
  ON trades(last_status_change_at);

-- 4. Verification queries
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trades';
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'trades'::regclass AND conname = 'trades_status_check';
