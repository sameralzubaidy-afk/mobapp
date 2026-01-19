-- File: supabase/migrations/093_fix_sp_wallets_table_schema.sql
-- MODULE-09 SP-001: Fix SP Wallets Table Schema
-- Mode: Idempotent rerunnable migration
-- Purpose: 
-- 1. Rename 'status' to 'state' to match manual test and service interface
-- 2. Add missing columns: lifetime_expired, frozen_at, grace_period_ends_at, starter_pack_issued, starter_pack_issued_at

-- =============================================================================
-- 1. ALTER SP_WALLETS TABLE
-- =============================================================================

DO $$ 
BEGIN
  -- 1.1 Rename status to state
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp_wallets' AND column_name = 'status') THEN
    ALTER TABLE public.sp_wallets RENAME COLUMN status TO state;
  END IF;

  -- 1.2 Update check constraint for state
  ALTER TABLE public.sp_wallets DROP CONSTRAINT IF EXISTS sp_wallets_status_check;
  ALTER TABLE public.sp_wallets DROP CONSTRAINT IF EXISTS sp_wallets_state_check;
  ALTER TABLE public.sp_wallets ADD CONSTRAINT sp_wallets_state_check CHECK (state IN ('active', 'frozen', 'grace_period', 'suspended'));

  -- 1.3 Add lifetime_expired
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp_wallets' AND column_name = 'lifetime_expired') THEN
    ALTER TABLE public.sp_wallets ADD COLUMN lifetime_expired INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_expired >= 0);
  END IF;

  -- 1.4 Add frozen_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp_wallets' AND column_name = 'frozen_at') THEN
    ALTER TABLE public.sp_wallets ADD COLUMN frozen_at TIMESTAMPTZ;
  END IF;

  -- 1.5 Add grace_period_ends_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp_wallets' AND column_name = 'grace_period_ends_at') THEN
    ALTER TABLE public.sp_wallets ADD COLUMN grace_period_ends_at TIMESTAMPTZ;
  END IF;

  -- 1.6 Add starter_pack_issued
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp_wallets' AND column_name = 'starter_pack_issued') THEN
    ALTER TABLE public.sp_wallets ADD COLUMN starter_pack_issued BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- 1.7 Add starter_pack_issued_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp_wallets' AND column_name = 'starter_pack_issued_at') THEN
    ALTER TABLE public.sp_wallets ADD COLUMN starter_pack_issued_at TIMESTAMPTZ;
  END IF;

END $$;

-- =============================================================================
-- 2. UPDATE INDEXES
-- =============================================================================

DROP INDEX IF EXISTS idx_sp_wallets_status;
CREATE INDEX IF NOT EXISTS idx_sp_wallets_state ON public.sp_wallets(state);

-- =============================================================================
-- 3. UPDATE RPC FUNCTIONS
-- =============================================================================

-- 3.1 Update get_user_sp_wallet_summary to return wallet_state instead of wallet_status

-- DROP existing function if present to allow changing the OUT-parameter row type safely
DROP FUNCTION IF EXISTS get_user_sp_wallet_summary(uuid);

CREATE OR REPLACE FUNCTION get_user_sp_wallet_summary(p_user_id UUID)
RETURNS TABLE (
  available_points INTEGER,
  pending_points INTEGER,
  lifetime_earned INTEGER,
  lifetime_spent INTEGER,
  wallet_state TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_wallet_id UUID;
  v_wallet_state TEXT;
  v_available INTEGER := 0;
  v_pending INTEGER := 0;
  v_earned INTEGER := 0;
  v_spent INTEGER := 0;
BEGIN
  -- 1. Get the wallet for this user
  SELECT id, state INTO v_wallet_id, v_wallet_state FROM sp_wallets WHERE user_id = p_user_id;
  
  -- If no wallet exists, return all zeros with 'inactive' status
  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, 'inactive'::TEXT;
    RETURN;
  END IF;

  -- 2. Use wallet table balances directly (sync is maintained by ledger triggers or concurrent updates)
  -- Qualify all columns with table name to avoid ambiguity
  SELECT w.available_balance, w.pending_balance, w.lifetime_earned, w.lifetime_spent
  INTO v_available, v_pending, v_earned, v_spent
  FROM sp_wallets w
  WHERE w.id = v_wallet_id;

  -- 3. Return the calculated values with wallet status
  RETURN QUERY SELECT v_available, v_pending, v_earned, v_spent, v_wallet_state;
END;
$$;

-- 3.2 Update sync RPCs (debit/credit/earn) to use the new 'state' column name if needed
-- (They actually use available_balance but we should double check if any referenced status)

-- No changes needed for: debit_sp_for_trade, credit_sp_for_cancelled_trade, earn_sp_for_trade
-- as they only touch balances and updated_at.

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'sp_wallets' AND column_name IN ('state', 'starter_pack_issued');
