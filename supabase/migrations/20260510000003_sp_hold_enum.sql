-- Step 2: Update SP Transaction Types and Wallet Logic

-- Add 'hold' states to the sp_transaction_type enum
-- FIX-Task-40 phase 3: this file belongs to a SUPERSEDED Swap Points design.
-- `sp_transaction_type` and `sp_transactions` (the table the function below reads)
-- are created by NO migration and exist in NEITHER the chain NOR staging -
-- verified against the captured staging fingerprint before touching this file:
-- 0 ENUM rows named sp_transaction_type, 0 columns for sp_transactions. The shipped
-- SP ledger is `sp_ledger` + `sp_wallets`.
-- The ALTERs are therefore guarded so the file is a no-op on a chain-built database
-- instead of inventing an enum with no producer and no consumer. (`ALTER TYPE ADD
-- VALUE` is permitted inside a transaction on PG12+, so the guard is safe under
-- `db reset`.)
DO $$
BEGIN
  IF to_regtype('public.sp_transaction_type') IS NOT NULL THEN
    ALTER TYPE public.sp_transaction_type ADD VALUE IF NOT EXISTS 'hold';
    ALTER TYPE public.sp_transaction_type ADD VALUE IF NOT EXISTS 'hold_release';
    ALTER TYPE public.sp_transaction_type ADD VALUE IF NOT EXISTS 'hold_consumed';
  END IF;
END $$;

-- Recreate or update wallet balance calculation function to include hold logic
CREATE OR REPLACE FUNCTION public.get_sp_wallet_balance(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_earned numeric;
  v_spent numeric;
  v_hold numeric;
  v_hold_release numeric;
  v_hold_consumed numeric;
  v_available numeric;
  v_on_hold numeric;
BEGIN
  -- Tally the respective transaction types
  SELECT 
    COALESCE(SUM(amount) FILTER (WHERE type = 'earn'), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'spend'), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'hold'), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'hold_release'), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'hold_consumed'), 0)
  INTO 
    v_earned, v_spent, v_hold, v_hold_release, v_hold_consumed
  FROM public.sp_transactions
  WHERE user_id = p_user_id;

  v_available := v_earned - v_spent - v_hold + v_hold_release;
  v_on_hold := v_hold - v_hold_release - v_hold_consumed;

  RETURN jsonb_build_object(
    'available_sp', v_available,
    'on_hold_sp', v_on_hold
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
