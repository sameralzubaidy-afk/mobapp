-- =====================================================
-- Migration: 20260830000005_dev_task_48_restore_disclaimer_tracking.sql
-- Task: DEV-TASK-48 item 4 (P2) — acknowledge_trade_disclaimer RPC missing on staging
-- Root cause: migration 307 was RECORDED as applied in supabase_migrations.schema_migrations
--   but its DDL never executed on staging (BP-47 deployment drift): trades has no
--   disclaimer_* columns and neither create_trade_with_disclaimer_v2 nor
--   acknowledge_trade_disclaimer exist. QA I06 showed the client's best-effort
--   rpc('acknowledge_trade_disclaimer', ...) fails silently -> disclaimer never recorded.
-- Fix: idempotently re-apply the FULL canonical content of 307_liability_disclaimer_tracking.sql
--   (all statements are IF NOT EXISTS / CREATE OR REPLACE, safe to re-run).
-- =====================================================

-- Add disclaimer acknowledgment columns to trades table
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS disclaimer_acknowledged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS disclaimer_policy_id UUID REFERENCES platform_policies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS disclaimer_acknowledged_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS trades_disclaimer_idx ON trades(disclaimer_acknowledged);
CREATE INDEX IF NOT EXISTS trades_disclaimer_policy_idx ON trades(disclaimer_policy_id);

COMMENT ON COLUMN trades.disclaimer_acknowledged IS 'Whether buyer acknowledged liability disclaimer before purchase';
COMMENT ON COLUMN trades.disclaimer_policy_id IS 'Reference to the specific disclaimer version acknowledged';
COMMENT ON COLUMN trades.disclaimer_acknowledged_at IS 'Timestamp when disclaimer was acknowledged';

-- =====================================================
-- RPC: Create trade with disclaimer acknowledgment
-- =====================================================
CREATE OR REPLACE FUNCTION create_trade_with_disclaimer_v2(
  p_item_id UUID,
  p_sp_amount INTEGER,
  p_disclaimer_policy_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_trade_id UUID;
  v_buyer_id UUID;
  v_seller_id UUID;
  v_item_price_cents INTEGER;
  v_result JSON;
BEGIN
  -- Get authenticated user
  v_buyer_id := auth.uid();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify disclaimer policy exists and is published
  IF NOT EXISTS (
    SELECT 1 FROM platform_policies pp
    WHERE pp.id = p_disclaimer_policy_id
      AND pp.policy_type = 'liability_disclaimer'
      AND pp.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Invalid or unpublished disclaimer policy';
  END IF;

  -- Get item details
  SELECT i.seller_id, i.price_cents
  INTO v_seller_id, v_item_price_cents
  FROM items i
  WHERE i.id = p_item_id
    AND i.status = 'active';

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Item not found or not available';
  END IF;

  IF v_buyer_id = v_seller_id THEN
    RAISE EXCEPTION 'Cannot buy your own item';
  END IF;

  -- Create trade record with disclaimer tracking
  -- (Note: The full trade creation logic should call existing initiate_trade_v2 RPC
  --  and then update the disclaimer columns, or extend initiate_trade_v2 to accept these params)
  -- For this migration, we just add the columns. The app logic will handle the flow.

  RETURN json_build_object(
    'success', true,
    'message', 'Disclaimer tracking columns added. Use existing initiate_trade_v2 and update disclaimer fields after.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_trade_with_disclaimer_v2 TO authenticated;

-- =====================================================
-- RPC: Update trade with disclaimer acknowledgment (atomic)
-- =====================================================
CREATE OR REPLACE FUNCTION acknowledge_trade_disclaimer(
  p_trade_id UUID,
  p_disclaimer_policy_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_policy_version TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is the buyer
  IF NOT EXISTS (
    SELECT 1 FROM trades t
    WHERE t.id = p_trade_id
      AND t.buyer_id = v_user_id
      AND t.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Trade not found or not authorized';
  END IF;

  -- Verify disclaimer policy
  SELECT pp.version INTO v_policy_version
  FROM platform_policies pp
  WHERE pp.id = p_disclaimer_policy_id
    AND pp.policy_type = 'liability_disclaimer'
    AND pp.status = 'published';

  IF v_policy_version IS NULL THEN
    RAISE EXCEPTION 'Invalid disclaimer policy';
  END IF;

  -- Update trade with disclaimer acknowledgment
  UPDATE trades
  SET
    disclaimer_acknowledged = TRUE,
    disclaimer_policy_id = p_disclaimer_policy_id,
    disclaimer_acknowledged_at = NOW()
  WHERE id = p_trade_id;

  -- Also record in policy_acceptances for audit trail
  INSERT INTO policy_acceptances (
    user_id,
    policy_id,
    policy_type,
    policy_version,
    accepted_at
  ) VALUES (
    v_user_id,
    p_disclaimer_policy_id,
    'liability_disclaimer',
    v_policy_version,
    NOW()
  )
  ON CONFLICT (user_id, policy_id) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'policy_version', v_policy_version
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION acknowledge_trade_disclaimer TO authenticated;
