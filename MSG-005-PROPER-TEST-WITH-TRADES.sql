-- ================================================================
-- MSG-005: PROPER TEST (with Trade-Linked Messages)
-- ================================================================
-- Messages only expire if:
-- 1. messages.trade_id points to a trade
-- 2. trades.status = 'completed'
-- 3. trades.completed_at < (NOW() - 30 days)
-- ================================================================

-- STEP 1: Get two real user IDs (for creating users + trade)
SELECT id, email FROM auth.users LIMIT 2;

-- STEP 2: Get a node ID (needed for trades table)
SELECT id, name FROM geographic_nodes LIMIT 1;

-- ================================================================
-- STEP 3: Create a completed trade from 31+ days ago
-- ================================================================
-- Replace these with real IDs:
-- USER_1_ID = buyer
-- USER_2_ID = seller
-- ITEM_ID = item being traded
-- NODE_ID = node from Step 2

DO $$
DECLARE
  user1_id UUID := 'PUT_USER_1_ID_HERE'::UUID;
  user2_id UUID := 'PUT_USER_2_ID_HERE'::UUID;
  item_id UUID := 'PUT_ITEM_ID_HERE'::UUID;
  node_id UUID := 'PUT_NODE_ID_HERE'::UUID;
  v_trade_id UUID;
BEGIN
  -- Create a trade that was completed 31 days ago
  INSERT INTO trades (
    id,
    buyer_id,
    seller_id,
    item_id,
    status,
    created_at,
    node_id,
    completed_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    user1_id,
    user2_id,
    item_id,
    'completed',
    now() - interval '31 days',
    node_id,
    now() - interval '31 days',  -- Completed 31 days ago (> 30 day expiration threshold)
    now()
  )
  RETURNING id INTO v_trade_id;

  -- Now create messages FOR THAT TRADE
  INSERT INTO messages (sender_id, receiver_id, trade_id, content)
  VALUES
    (user1_id, user2_id, v_trade_id, 'MSG-005 TEST: OLD message (should delete - trade completed 31 days ago)'),
    (user1_id, user2_id, v_trade_id, 'MSG-005 TEST: Another OLD message in expired trade');

  RAISE NOTICE 'Created trade % with completed_at = 31 days ago', v_trade_id;
  RAISE NOTICE 'Created 2 messages for that trade';
END $$;

-- ================================================================
-- STEP 4: Create a RECENT completed trade (less than 30 days)
-- ================================================================

DO $$
DECLARE
  user1_id UUID := 'PUT_USER_1_ID_HERE'::UUID;
  user2_id UUID := 'PUT_USER_2_ID_HERE'::UUID;
  item_id UUID := 'PUT_ITEM_ID_HERE'::UUID;
  node_id UUID := 'PUT_NODE_ID_HERE'::UUID;
  v_trade_id UUID;
BEGIN
  -- Create a trade that was completed only 5 days ago
  INSERT INTO trades (
    id,
    buyer_id,
    seller_id,
    item_id,
    status,
    created_at,
    node_id,
    completed_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    user1_id,
    user2_id,
    item_id,
    'completed',
    now() - interval '5 days',
    node_id,
    now() - interval '5 days',  -- Completed only 5 days ago (< 30 day threshold)
    now()
  )
  RETURNING id INTO v_trade_id;

  -- Create messages FOR THAT RECENT TRADE
  INSERT INTO messages (sender_id, receiver_id, trade_id, content)
  VALUES
    (user1_id, user2_id, v_trade_id, 'MSG-005 TEST: RECENT message (should stay - trade only completed 5 days ago)');

  RAISE NOTICE 'Created trade % with completed_at = 5 days ago', v_trade_id;
  RAISE NOTICE 'Created 1 message for that recent trade';
END $$;

-- ================================================================
-- STEP 5: Verify the setup (both trades and messages exist)
-- ================================================================

SELECT
  t.id as trade_id,
  t.status,
  t.completed_at,
  ROUND(EXTRACT(DAY FROM NOW() - t.completed_at))::INTEGER as days_since_completion,
  COUNT(m.id) as message_count
FROM trades t
LEFT JOIN messages m ON t.id = m.trade_id AND content LIKE 'MSG-005 TEST:%'
WHERE content LIKE 'MSG-005 TEST:%' OR EXISTS (
  SELECT 1 FROM messages m2 
  WHERE m2.trade_id = t.id AND m2.content LIKE 'MSG-005 TEST:%'
)
GROUP BY t.id, t.status, t.completed_at
ORDER BY t.completed_at DESC;

-- Expected output:
-- Row 1: RECENT trade, completed 5 days ago, 1 message
-- Row 2: OLD trade, completed 31 days ago, 2 messages

-- ================================================================
-- STEP 6: Check messages before cleanup
-- ================================================================

SELECT
  m.id,
  m.trade_id,
  m.content,
  m.deleted_at,
  t.status,
  t.completed_at,
  ROUND(EXTRACT(DAY FROM NOW() - t.completed_at))::INTEGER as trade_days_old
FROM messages m
LEFT JOIN trades t ON m.trade_id = t.id
WHERE m.content LIKE 'MSG-005 TEST:%'
ORDER BY t.completed_at DESC, m.created_at ASC;

-- Expected:
-- All messages have deleted_at = NULL before cleanup

-- ================================================================
-- STEP 7: Run the cleanup (this should delete only the OLD trade's messages)
-- ================================================================

SELECT public.scheduled_message_cleanup(
  'manual', 
  jsonb_build_object(
    'source', 'test-sql-editor',
    'expected', 'Should delete 2 messages from 31-day-old trade, keep 1 from 5-day-old trade'
  )
);

-- Expected: processed_count = 2 (only the messages from the 31-day-old trade)

-- ================================================================
-- STEP 8: Verify cleanup worked CORRECTLY
-- ================================================================

SELECT
  m.id,
  m.content,
  m.deleted_at,
  t.completed_at,
  ROUND(EXTRACT(DAY FROM NOW() - t.completed_at))::INTEGER as trade_days_old,
  CASE 
    WHEN m.deleted_at IS NOT NULL THEN '✓ DELETED (correct)'
    WHEN m.deleted_at IS NULL AND EXTRACT(DAY FROM NOW() - t.completed_at) > 30 THEN '✗ NOT DELETED (ERROR - should be deleted!)'
    WHEN m.deleted_at IS NULL AND EXTRACT(DAY FROM NOW() - t.completed_at) <= 30 THEN '✓ ACTIVE (correct - within 30 days)'
    ELSE '? UNKNOWN'
  END as validation
FROM messages m
LEFT JOIN trades t ON m.trade_id = t.id
WHERE m.content LIKE 'MSG-005 TEST:%'
ORDER BY t.completed_at DESC, m.created_at ASC;

-- Expected:
-- Row 1: "Another OLD message..." - DELETED ✓
-- Row 2: "OLD message..." - DELETED ✓
-- Row 3: "RECENT message..." - ACTIVE ✓

-- ================================================================
-- STEP 9: Verify audit log
-- ================================================================

SELECT
  run_at,
  invoked_by,
  processed_count,
  errors_count,
  error,
  job_payload,
  result
FROM public.message_cleanup_runs
ORDER BY run_at DESC
LIMIT 5;

-- Expected latest row:
--   invoked_by = 'manual'
--   processed_count = 2 (the 2 messages from 31-day-old trade)
--   errors_count = 0
--   error = NULL

-- ================================================================
-- CLEANUP: Delete test data (optional)
-- ================================================================

-- DELETE FROM messages WHERE content LIKE 'MSG-005 TEST:%';
-- DELETE FROM trades WHERE id IN (
--   SELECT DISTINCT trade_id FROM messages WHERE content LIKE 'MSG-005 TEST:%'
-- );
