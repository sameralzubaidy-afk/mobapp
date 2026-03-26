-- Migration: Enforce wallet state checks on SP spend/earn operations
-- Mode: Idempotent rerunnable migration
-- Task: ADMIN-V2-003 SP Wallet State Enforcement
-- Dependencies: sp_wallets table (with 'state' column), sp_ledger, debit_sp_for_trade, can_user_spend_sp

-- =============================================================================
-- BLOCK 1: Update debit_sp_for_trade to check wallet state before allowing spend
-- =============================================================================

CREATE OR REPLACE FUNCTION debit_sp_for_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_wallet_state TEXT;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_ledger_id UUID;
BEGIN
  -- 1. Get wallet, current balance, AND state
  SELECT id, available_balance, state 
    INTO v_wallet_id, v_balance_before, v_wallet_state
  FROM sp_wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'SP wallet not found';
  END IF;

  -- 2. NEW: Check wallet state before allowing spend
  IF v_wallet_state = 'frozen' THEN
    RAISE EXCEPTION 'Cannot spend SP: wallet is frozen. Please renew your subscription to restore access.';
  END IF;

  IF v_wallet_state = 'suspended' THEN
    RAISE EXCEPTION 'Cannot spend SP: wallet is suspended. Contact support for assistance.';
  END IF;

  IF v_wallet_state = 'grace_period' THEN
    RAISE EXCEPTION 'Cannot spend SP: wallet is in grace period. Renew subscription to restore access.';
  END IF;

  -- 3. Check sufficient balance
  IF v_balance_before < p_points THEN
    RAISE EXCEPTION 'Insufficient SP balance';
  END IF;

  -- 4. Update wallet balance
  UPDATE sp_wallets
  SET 
    available_balance = available_balance - p_points,
    lifetime_spent = lifetime_spent + p_points,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  v_balance_after := v_balance_before - p_points;

  -- 5. Create ledger entry
  INSERT INTO sp_ledger (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    related_transaction_id
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    'spend_purchase',
    -p_points,
    v_balance_before,
    v_balance_after,
    'Swap Points used for trade ' || p_trade_id,
    p_trade_id
  )
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'balance_after', v_balance_after,
    'ledger_entry_id', v_ledger_id
  );
END;
$$;

-- =============================================================================
-- BLOCK 2: Update earn_sp_for_trade to block earning when suspended
-- =============================================================================

CREATE OR REPLACE FUNCTION earn_sp_for_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_wallet_state TEXT;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_ledger_id UUID;
BEGIN
  -- 1. Get wallet and state
  SELECT id, pending_balance, state
    INTO v_wallet_id, v_balance_before, v_wallet_state
  FROM sp_wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'SP wallet not found';
  END IF;

  -- 2. NEW: Block earning for suspended wallets only
  -- Note: frozen and grace_period users can still earn (they already completed the transaction),
  -- but suspended users are blocked entirely
  IF v_wallet_state = 'suspended' THEN
    RAISE EXCEPTION 'Cannot earn SP: wallet is suspended. Contact support for assistance.';
  END IF;

  -- 3. Add to pending balance (3-day hold)
  UPDATE sp_wallets
  SET 
    pending_balance = pending_balance + p_points,
    lifetime_earned = lifetime_earned + p_points,
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE id = v_wallet_id;

  v_balance_after := v_balance_before + p_points;

  -- 4. Create ledger entry with pending status
  INSERT INTO sp_ledger (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    related_transaction_id
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    'earn_reward',
    p_points,
    v_balance_before,
    v_balance_after,
    'Swap Points earned from trade ' || p_trade_id || ' (pending 3 days)',
    p_trade_id
  )
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'pending_balance_after', v_balance_after,
    'ledger_entry_id', v_ledger_id
  );
END;
$$;

-- =============================================================================
-- BLOCK 3: Update can_user_spend_sp to check wallet state
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_user_spend_sp(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_wallet_state TEXT;
BEGIN
  -- Check subscription status
  SELECT s.status INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Must have active subscription
  IF v_status IS NULL OR v_status NOT IN ('trial', 'active', 'paused') THEN
    RETURN FALSE;
  END IF;

  -- NEW: Also check wallet state
  SELECT w.state INTO v_wallet_state
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id;

  -- Block if wallet is frozen, suspended, or in grace period
  IF v_wallet_state IN ('frozen', 'suspended', 'grace_period') THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- =============================================================================
-- BLOCK 4: Update get_user_sp_wallet_summary to return wallet state
-- =============================================================================

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
SET search_path = public
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
  SELECT id, state INTO v_wallet_id, v_wallet_state 
  FROM sp_wallets 
  WHERE user_id = p_user_id;
  
  -- If no wallet exists, return all zeros with 'inactive' status
  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, 'inactive'::TEXT;
    RETURN;
  END IF;

  -- 2. Use wallet table balances directly
  SELECT 
    w.available_balance, 
    w.pending_balance, 
    w.lifetime_earned, 
    w.lifetime_spent
  INTO v_available, v_pending, v_earned, v_spent
  FROM sp_wallets w
  WHERE w.id = v_wallet_id;

  -- 3. Return values with wallet state
  RETURN QUERY SELECT v_available, v_pending, v_earned, v_spent, v_wallet_state;
END;
$$;

-- =============================================================================
-- Verification queries (run after applying this migration):
-- =============================================================================
-- SELECT proname FROM pg_proc WHERE proname IN (
--   'debit_sp_for_trade',
--   'earn_sp_for_trade',
--   'can_user_spend_sp',
--   'get_user_sp_wallet_summary'
-- );
-- Expected: 4 rows.
--
-- Test wallet state blocking:
-- UPDATE sp_wallets SET state = 'frozen' WHERE user_id = '<test_user_uuid>';
-- SELECT public.can_user_spend_sp('<test_user_uuid>');
-- Expected: FALSE
--
-- SELECT public.debit_sp_for_trade('<test_user_uuid>', gen_random_uuid(), 5);
-- Expected: ERROR: Cannot spend SP: wallet is frozen...
