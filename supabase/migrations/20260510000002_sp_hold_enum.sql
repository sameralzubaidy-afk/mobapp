-- Step 2: Update SP Transaction Types and Wallet Logic

-- Add 'hold' states to the sp_transaction_type enum
ALTER TYPE sp_transaction_type ADD VALUE IF NOT EXISTS 'hold';
ALTER TYPE sp_transaction_type ADD VALUE IF NOT EXISTS 'hold_release';
ALTER TYPE sp_transaction_type ADD VALUE IF NOT EXISTS 'hold_consumed';

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
