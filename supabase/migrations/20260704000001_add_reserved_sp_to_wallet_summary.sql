-- Migration: 20260704000001_add_reserved_sp_to_wallet_summary
-- Mode: Idempotent rerunnable migration
-- Purpose:
-- 1) Update get_user_sp_wallet_summary RPC to return reserved_points
-- 2) Fix notification copy: spend_purchase → "reserved" instead of "spent" to avoid confusion

-- =============================================================================
-- BLOCK 1: Update get_user_sp_wallet_summary to return reserved_points
-- =============================================================================

-- Must DROP first because the RETURN TABLE signature changed (added reserved_points)
DROP FUNCTION IF EXISTS get_user_sp_wallet_summary(UUID);

CREATE FUNCTION get_user_sp_wallet_summary(p_user_id UUID)
RETURNS TABLE (
  available_points INTEGER,
  pending_points INTEGER,
  lifetime_earned INTEGER,
  lifetime_spent INTEGER,
  reserved_points INTEGER,
  wallet_state TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_wallet_state TEXT;
  v_available INTEGER := 0;
  v_pending INTEGER := 0;
  v_earned INTEGER := 0;
  v_spent INTEGER := 0;
  v_reserved INTEGER := 0;
BEGIN
  -- 1. Get the wallet for this user
  SELECT id, state INTO v_wallet_id, v_wallet_state 
  FROM sp_wallets 
  WHERE user_id = p_user_id;
  
  -- If no wallet exists, return all zeros with 'inactive' status
  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, 'inactive'::TEXT;
    RETURN;
  END IF;

  -- 2. Use wallet table balances directly (including reserved_sp)
  SELECT 
    w.available_balance, 
    w.pending_balance, 
    w.lifetime_earned, 
    w.lifetime_spent,
    w.reserved_sp
  INTO v_available, v_pending, v_earned, v_spent, v_reserved
  FROM sp_wallets w
  WHERE w.id = v_wallet_id;

  -- 3. Return values with wallet state
  RETURN QUERY SELECT v_available, v_pending, v_earned, v_spent, v_reserved, v_wallet_state;
END;
$$;

-- =============================================================================
-- BLOCK 2: Fix notification copy — spend_purchase says "reserved" not "spent"
-- =============================================================================

CREATE OR REPLACE FUNCTION send_sp_transaction_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet RECORD;
  v_title TEXT;
  v_body TEXT;
  v_notification_type TEXT;
BEGIN
  -- Get wallet details
  SELECT * INTO v_wallet
  FROM sp_wallets
  WHERE id = NEW.wallet_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determine if earned or spent based on transaction_type
  IF NEW.transaction_type LIKE 'earn_%' THEN
    -- Earned SP
    v_notification_type := 'sp_earned';
    v_title := '🎉 +' || NEW.amount || ' SP Earned!';
    
    -- Custom body based on transaction type
    v_body := CASE
      WHEN NEW.transaction_type = 'earn_starter_pack' THEN 'You earned ' || NEW.amount || ' SP as a welcome bonus!'
      WHEN NEW.transaction_type = 'earn_reward' THEN 'You earned ' || NEW.amount || ' SP from a reward!'
      WHEN NEW.transaction_type = 'earn_referral' THEN 'You earned ' || NEW.amount || ' SP from a referral!'
      WHEN NEW.transaction_type = 'earn_challenge' THEN 'You earned ' || NEW.amount || ' SP from completing a challenge!'
      WHEN NEW.transaction_type = 'earn_refund' THEN 'You received ' || NEW.amount || ' SP refund!'
      WHEN NEW.transaction_type = 'earn_admin_grant' THEN 'You received ' || NEW.amount || ' SP!'
      WHEN NEW.transaction_type = 'earn_promotion' THEN 'You earned ' || NEW.amount || ' SP from a promotion!'
      ELSE 'You earned ' || NEW.amount || ' SP!'
    END;

  ELSIF NEW.transaction_type LIKE 'spend_%' THEN
    -- Spent SP
    v_notification_type := 'sp_spent';
    v_title := '✨ ' || ABS(NEW.amount) || ' SP Reserved';
    
    -- Custom body based on transaction type
    v_body := CASE
      WHEN NEW.transaction_type = 'spend_purchase' THEN ABS(NEW.amount) || ' SP reserved for your offer — returned if trade is cancelled.'
      WHEN NEW.transaction_type = 'spend_fee' THEN 'You spent ' || ABS(NEW.amount) || ' SP on fees!'
      WHEN NEW.transaction_type = 'spend_boost' THEN 'You spent ' || ABS(NEW.amount) || ' SP on a boost!'
      ELSE 'You spent ' || ABS(NEW.amount) || ' SP!'
    END;

  ELSE
    -- Other transaction types (expire, freeze, unfreeze, admin_deduct)
    RETURN NEW;
  END IF;

  -- Create the notification
  PERFORM create_sp_notification(
    v_wallet.user_id,
    v_notification_type,
    v_title,
    v_body,
    jsonb_build_object(
      'amount', NEW.amount,
      'transaction_type', NEW.transaction_type,
      'balance_after', NEW.balance_after,
      'ledger_id', NEW.id,
      'deep_link', '/wallet'
    ),
    TRUE  -- check_subscription = TRUE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Verification queries
-- =============================================================================
-- SELECT proname FROM pg_proc WHERE proname = 'get_user_sp_wallet_summary';
-- Expected: 1 row with returns 6 columns (available_points, pending_points, lifetime_earned, lifetime_spent, reserved_points, wallet_state)
--
-- Test with a user who has a pending SP offer:
-- SELECT * FROM get_user_sp_wallet_summary('user-uuid');
-- Expected: reserved_points > 0 if user has a pending trade with sp_amount > 0
--
-- Common failure modes:
-- 1) If sp_wallets table doesn't have reserved_sp column, run 20260528000002 migration first
-- 2) If send_sp_transaction_notification doesn't exist, run 142_sp_notifications migration first
