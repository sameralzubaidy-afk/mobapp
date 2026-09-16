-- filepath: supabase/migrations/062_fix_trades_v2_columns.sql

-- Mode B: Idempotent rerunnable migration
-- Fix trades table columns to match V2 requirements and Trade interface.

-- 1. Rename columns if they exist under old names to match V2 spec
DO $$
BEGIN
    -- Rename item_id to listing_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'item_id') THEN
        ALTER TABLE trades RENAME COLUMN item_id TO listing_id;
    END IF;

    -- Rename swap_points_used to sp_amount if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'swap_points_used') THEN
        ALTER TABLE trades RENAME COLUMN swap_points_used TO sp_amount;
    END IF;

    -- Rename price_cents to cash_amount_cents if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'price_cents') THEN
        ALTER TABLE trades RENAME COLUMN price_cents TO cash_amount_cents;
    END IF;
    
    -- Rename platform_fee_cents to buyer_transaction_fee_cents if it exists
    -- Note: 060_trades_v2.sql might have already added buyer_transaction_fee_cents
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'platform_fee_cents') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'buyer_transaction_fee_cents') THEN
        ALTER TABLE trades RENAME COLUMN platform_fee_cents TO buyer_transaction_fee_cents;
    END IF;
END $$;

-- 2. Add missing columns if they don't exist (ensuring correct types)
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES items(id),
  ADD COLUMN IF NOT EXISTS sp_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_amount_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_transaction_fee_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_currency TEXT DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS buyer_subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS sp_debit_ledger_entry_id UUID REFERENCES sp_ledger(id),
  ADD COLUMN IF NOT EXISTS sp_credit_ledger_entry_id UUID REFERENCES sp_ledger(id),
  ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Ensure status constraint is correct for V2
ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_status_check;
ALTER TABLE trades ADD CONSTRAINT trades_status_check 
  CHECK (status IN ('pending', 'payment_processing', 'payment_failed', 'in_progress', 'completed', 'cancelled'));

-- 4. Verification queries
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trades';
