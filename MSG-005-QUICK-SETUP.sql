-- ================================================================
-- MSG-005 Quick Setup: Run this SQL in Supabase SQL Editor
-- ================================================================

-- Step 1: Verify Prerequisites
-- ================================================================

-- Check if mark_expired_messages() function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'mark_expired_messages';
-- Expected: 1 row returned

-- Check if admin_config exists
SELECT key, value, data_type 
FROM admin_config 
WHERE key = 'message_expiration_days';
-- Expected: 1 row with value = '30'

-- Step 2: Test RPC Function Manually
-- ================================================================

-- Run cleanup function (safe to execute, only soft deletes expired messages)
SELECT mark_expired_messages();
-- Returns: Integer (count of messages deleted)

-- Check what was deleted
SELECT 
  m.id,
  m.content,
  m.deleted_at,
  t.status,
  t.completed_at,
  AGE(NOW(), t.completed_at) as days_since_completion
FROM messages m
INNER JOIN trades t ON m.trade_id = t.id
WHERE m.deleted_at IS NOT NULL
  AND m.deleted_at > NOW() - INTERVAL '1 hour'
ORDER BY m.deleted_at DESC
LIMIT 10;

-- Step 3: Create Test Data (Optional)
-- ================================================================

-- Only run this if you want to test with dummy data
-- Skip this if you want to test with real production data

/*
-- Create a test trade completed 35 days ago
DO $$
DECLARE
  v_trade_id UUID := gen_random_uuid();
  v_buyer_id UUID;
  v_seller_id UUID;
  v_item_id UUID;
  v_node_id UUID;
BEGIN
  -- Get existing IDs (adjust as needed)
  SELECT id INTO v_buyer_id FROM auth.users LIMIT 1;
  SELECT id INTO v_seller_id FROM auth.users OFFSET 1 LIMIT 1;
  SELECT id INTO v_item_id FROM items WHERE deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_node_id FROM nodes LIMIT 1;

  -- Create test trade
  INSERT INTO trades (id, buyer_id, seller_id, item_id, node_id, status, completed_at)
  VALUES (v_trade_id, v_buyer_id, v_seller_id, v_item_id, v_node_id, 'completed', NOW() - INTERVAL '35 days');

  -- Create test messages
  INSERT INTO messages (trade_id, sender_id, content)
  VALUES 
    (v_trade_id, v_buyer_id, 'Test message 1 - should be expired'),
    (v_trade_id, v_seller_id, 'Test message 2 - should be expired');

  RAISE NOTICE 'Created test trade: %', v_trade_id;
END $$;

-- Verify test messages exist
SELECT COUNT(*) FROM messages WHERE content LIKE 'Test message%' AND deleted_at IS NULL;
-- Expected: 2

-- Run cleanup
SELECT mark_expired_messages();
-- Expected: Returns 2 (or more if other messages also expired)

-- Verify test messages are deleted
SELECT COUNT(*) FROM messages WHERE content LIKE 'Test message%' AND deleted_at IS NOT NULL;
-- Expected: 2
*/

-- Step 4: Monitoring Queries
-- ================================================================

-- Messages deleted in last 7 days
SELECT 
  DATE(deleted_at) as deletion_date,
  COUNT(*) as messages_deleted
FROM messages
WHERE deleted_at IS NOT NULL
  AND deleted_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(deleted_at)
ORDER BY deletion_date DESC;

-- Messages that will expire in next 5 days
SELECT COUNT(*) as messages_to_expire_soon
FROM messages m
INNER JOIN trades t ON m.trade_id = t.id
WHERE m.deleted_at IS NULL
  AND t.status = 'completed'
  AND t.completed_at IS NOT NULL
  AND t.completed_at BETWEEN (NOW() - INTERVAL '30 days') AND (NOW() - INTERVAL '25 days');

-- Total messages by status
SELECT 
  CASE 
    WHEN deleted_at IS NOT NULL THEN 'Deleted'
    ELSE 'Active'
  END as status,
  COUNT(*) as count
FROM messages
GROUP BY status;

-- Step 5: Apply pg_cron Migration (Optional)
-- ================================================================

-- Copy the entire contents of 082_message_cleanup_cron.sql and paste here
-- OR skip this and use Supabase Dashboard Cron Jobs instead (recommended)

-- ================================================================
-- DONE!
-- ================================================================

-- Next Steps:
-- 1. Deploy Edge Function: npx supabase functions deploy cleanup-messages
-- 2. Setup Cron Job in Supabase Dashboard (see MSG-005-MANUAL-TESTING-GUIDE.md)
-- 3. Test Edge Function: See curl command in implementation guide
