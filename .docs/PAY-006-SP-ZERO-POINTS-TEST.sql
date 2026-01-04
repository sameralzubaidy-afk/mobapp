-- PAY-006: Zero SP points defensive tests
-- Run after re-applying migrations 061 and 078

-- Test A: Calling earn_sp_for_trade with 0 should return an error JSON (no batch created)
SELECT earn_sp_for_trade('00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid(), 0);
-- Expected: {"success": false, "error": "Invalid SP points amount"}

-- Test B: Complete a trade that has sp_amount = 0 (create minimal trade record)
-- NOTE: Replace buyer_id and seller_id with actual test users in your DB or create test users
WITH t AS (
  INSERT INTO trades (listing_id, buyer_id, seller_id, node_id, status, sp_amount, cash_amount_cents, platform_fee_cents, cash_currency, buyer_subscription_status, buyer_transaction_fee_cents, last_status_change_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), -- dummy listing id
    '00000000-0000-0000-0000-000000000001'::uuid, -- buyer (replace)
    '00000000-0000-0000-0000-000000000002'::uuid, -- seller (replace)
    NULL,
    'in_progress',
    0, -- sp_amount = 0
    5000,
    99,
    'usd',
    'active',
    99,
    NOW(), NOW(), NOW()
  ) RETURNING id AS trade_id, seller_id
)
SELECT complete_trade_v2(t.trade_id, t.seller_id) FROM t;
-- Expected: {"success": true, "trade_id": "...", "message": "Trade completed successfully", "sp_result": null, ...}

-- Cleanup: If desired, delete the test trade created above
-- DELETE FROM trades WHERE id = '<trade-id-from-test>';
