-- File: supabase/migrations/061_sp_ledger_and_trade_rpcs.sql
-- MODULE-06 TRADE-FLOW-V2: SP Ledger and Trade RPCs
-- Dependencies: MODULE-09 (SP Wallets)

-- =============================================================================
-- 1. CREATE SP_BATCHES TABLE (if not exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sp_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES sp_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Amount info
  initial_sp INTEGER NOT NULL CHECK (initial_sp > 0),
  remaining_sp INTEGER NOT NULL CHECK (remaining_sp >= 0),
  
  -- Source info
  source_type TEXT NOT NULL CHECK (source_type IN (
    'starter_pack', 'reward', 'referral', 'challenge', 'refund', 'admin_grant', 'promotion'
  )),
  source_id UUID, -- ID of the related transaction, challenge, etc.
  
  -- Expiration info
  expires_at TIMESTAMPTZ NOT NULL,
  is_expired BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp_batches_user_id ON sp_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_batches_wallet_id ON sp_batches(wallet_id);
CREATE INDEX IF NOT EXISTS idx_sp_batches_expires_at ON sp_batches(expires_at);

-- Enable RLS
ALTER TABLE sp_batches ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own batches
DROP POLICY IF EXISTS "Users can view own batches" ON sp_batches;
CREATE POLICY "Users can view own batches"
  ON sp_batches FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 2. CREATE SP_LEDGER TABLE (if not exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES sp_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'earn_starter_pack', 'earn_reward', 'earn_referral', 'earn_challenge',
    'earn_refund', 'earn_admin_grant', 'earn_promotion',
    'spend_purchase', 'spend_fee', 'spend_boost',
    'expire', 'freeze', 'unfreeze', 'admin_deduct'
  )),
  
  -- Amounts (positive for earn, negative for spend/expire)
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  
  -- Description
  description TEXT NOT NULL,
  
  -- Related entities
  related_transaction_id UUID,
  related_listing_id UUID,
  related_batch_id UUID REFERENCES sp_batches(id),
  
  -- Admin actions
  admin_id UUID REFERENCES auth.users(id),
  admin_note TEXT,
  
  -- Idempotency (prevent duplicate entries)
  idempotency_key TEXT UNIQUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp_ledger_user_id ON sp_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_ledger_wallet_id ON sp_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS idx_sp_ledger_related_transaction_id ON sp_ledger(related_transaction_id);

-- Enable RLS
ALTER TABLE sp_ledger ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own ledger entries
DROP POLICY IF EXISTS "Users can view own ledger" ON sp_ledger;
CREATE POLICY "Users can view own ledger"
  ON sp_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 3. RPC FUNCTIONS FOR TRADE SP OPERATIONS
-- =============================================================================

-- RPC: Debit SP for trade (Buyer)
CREATE OR REPLACE FUNCTION debit_sp_for_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_ledger_id UUID;
BEGIN
  -- 1. Get wallet and current balance
  SELECT id, available_balance INTO v_wallet_id, v_balance_before
  FROM sp_wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'SP wallet not found';
  END IF;

  IF v_balance_before < p_points THEN
    RAISE EXCEPTION 'Insufficient SP balance';
  END IF;

  -- 2. Update wallet balance
  UPDATE sp_wallets
  SET 
    available_balance = available_balance - p_points,
    lifetime_spent = lifetime_spent + p_points,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  v_balance_after := v_balance_before - p_points;

  -- 3. Create ledger entry
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

  -- 4. TODO: Implement FIFO batch deduction if needed for expiration logic
  -- For now, we just deduct from the total balance.

  RETURN jsonb_build_object(
    'success', true,
    'ledger_entry_id', v_ledger_id,
    'balance_after', v_balance_after
  );
END;
$$;

-- RPC: Credit SP for cancelled trade (Buyer Refund)
CREATE OR REPLACE FUNCTION credit_sp_for_cancelled_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_ledger_id UUID;
BEGIN
  -- 1. Get wallet and current balance
  SELECT id, available_balance INTO v_wallet_id, v_balance_before
  FROM sp_wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'SP wallet not found';
  END IF;

  -- 2. Update wallet balance
  UPDATE sp_wallets
  SET 
    available_balance = available_balance + p_points,
    lifetime_spent = lifetime_spent - p_points, -- Revert spent amount
    updated_at = NOW()
  WHERE id = v_wallet_id;

  v_balance_after := v_balance_before + p_points;

  -- 3. Create ledger entry
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
    'earn_refund',
    p_points,
    v_balance_before,
    v_balance_after,
    'Swap Points refunded for cancelled trade ' || p_trade_id,
    p_trade_id
  )
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'ledger_entry_id', v_ledger_id,
    'balance_after', v_balance_after
  );
END;
$$;

-- RPC: Earn SP for trade (Seller)
CREATE OR REPLACE FUNCTION earn_sp_for_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_ledger_id UUID;
BEGIN
  -- 1. Get wallet and current balance
  SELECT id, available_balance INTO v_wallet_id, v_balance_before
  FROM sp_wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'SP wallet not found';
  END IF;

  -- 2. Update wallet balance
  UPDATE sp_wallets
  SET 
    available_balance = available_balance + p_points,
    lifetime_earned = lifetime_earned + p_points,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  v_balance_after := v_balance_before + p_points;

  -- 3. Create ledger entry
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
    'Swap Points earned from trade ' || p_trade_id,
    p_trade_id
  )
  RETURNING id INTO v_ledger_id;

  -- 4. Create a new batch for these points (expires in 90 days)
  INSERT INTO sp_batches (
    wallet_id,
    user_id,
    initial_sp,
    remaining_sp,
    source_type,
    source_id,
    expires_at
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    p_points,
    p_points,
    'reward',
    p_trade_id,
    NOW() + INTERVAL '90 days'
  );

  RETURN jsonb_build_object(
    'success', true,
    'ledger_entry_id', v_ledger_id,
    'balance_after', v_balance_after
  );
END;
$$;

-- =============================================================================
-- 4. ADD FOREIGN KEY CONSTRAINTS TO TRADES TABLE
-- =============================================================================

ALTER TABLE trades
  ADD CONSTRAINT fk_trades_sp_debit_ledger_entry_id 
  FOREIGN KEY (sp_debit_ledger_entry_id) REFERENCES sp_ledger(id) ON DELETE SET NULL;

ALTER TABLE trades
  ADD CONSTRAINT fk_trades_sp_credit_ledger_entry_id 
  FOREIGN KEY (sp_credit_ledger_entry_id) REFERENCES sp_ledger(id) ON DELETE SET NULL;

-- =============================================================================
-- 5. COMPLETE TRADE RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION complete_trade_v2(
  p_trade_id UUID,
  p_user_id UUID -- The user calling the function (must be buyer or seller)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade RECORD;
  v_listing RECORD;
  v_earn_result JSONB;
BEGIN
  -- 1. Load trade and verify existence
  SELECT * INTO v_trade FROM trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- 2. Verify status
  IF v_trade.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade is not in progress');
  END IF;

  -- 3. Verify authorization (only buyer or seller can complete)
  IF p_user_id <> v_trade.buyer_id AND p_user_id <> v_trade.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 4. Load listing to check payment preference
  SELECT * INTO v_listing FROM items WHERE id = v_trade.listing_id;

  -- 5. Update trade status
  UPDATE trades
  SET 
    status = 'completed',
    completed_at = NOW(),
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- 6. Update item status
  UPDATE items
  SET 
    status = 'sold',
    updated_at = NOW()
  WHERE id = v_trade.listing_id;

  -- 7. Credit SP to seller if they accept SP or Donate
  -- In V2, seller earns SP equal to the sp_amount used by buyer.
  IF v_trade.sp_amount > 0 THEN
    SELECT earn_sp_for_trade(
      v_trade.seller_id,
      v_trade.id,
      v_trade.sp_amount
    ) INTO v_earn_result;

    -- Link the credit ledger entry to the trade
    UPDATE trades
    SET sp_credit_ledger_entry_id = (v_earn_result->>'ledger_entry_id')::UUID
    WHERE id = p_trade_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'status', 'completed',
    'sp_earned', v_trade.sp_amount
  );
END;
$$;

-- =============================================================================
-- 6. CANCEL TRADE RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION cancel_trade_v2(
  p_trade_id UUID,
  p_user_id UUID, -- The user calling the function
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade RECORD;
  v_refund_result JSONB;
BEGIN
  -- 1. Load trade
  SELECT * INTO v_trade FROM trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- 2. Verify status (can only cancel if not already completed/cancelled)
  IF v_trade.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade already finalized');
  END IF;

  -- 3. Verify authorization (buyer, seller, or admin)
  -- For MVP, we allow buyer or seller to cancel.
  IF p_user_id <> v_trade.buyer_id AND p_user_id <> v_trade.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 4. Update trade status
  UPDATE trades
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = p_reason,
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- 5. Update item status back to available
  UPDATE items
  SET 
    status = 'available',
    updated_at = NOW()
  WHERE id = v_trade.listing_id;

  -- 6. Refund SP to buyer if they spent any.
  -- Refund when a SP debit exists (sp_debit_ledger_entry_id) and a refund has not
  -- already been recorded (sp_credit_ledger_entry_id IS NULL). This covers
  -- cancellations that happen before the trade reached `in_progress` while
  -- avoiding double refunds.
  IF v_trade.sp_amount > 0 AND v_trade.sp_debit_ledger_entry_id IS NOT NULL AND v_trade.sp_credit_ledger_entry_id IS NULL THEN
    SELECT credit_sp_for_cancelled_trade(
      v_trade.buyer_id,
      v_trade.id,
      v_trade.sp_amount
    ) INTO v_refund_result;

    -- Link the refund ledger entry
    UPDATE trades
    SET sp_credit_ledger_entry_id = (v_refund_result->>'ledger_entry_id')::UUID
    WHERE id = p_trade_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'status', 'cancelled',
    'sp_refunded', CASE WHEN v_trade.status IN ('in_progress', 'payment_processing') THEN v_trade.sp_amount ELSE 0 END
  );
END;
$$;
