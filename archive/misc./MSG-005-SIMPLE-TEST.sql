-- ================================================================
-- MSG-005: Simple Test (No Trigger Disabling)
-- ================================================================
-- This version avoids the permission error by not trying to disable system triggers
-- Instead, we insert then update the timestamps

-- STEP 1: Get two real user IDs
-- Run this first and copy the IDs
SELECT id, email FROM auth.users LIMIT 2;

-- ================================================================
-- STEP 2: Insert test messages (timestamps will be auto-set to NOW)
-- ================================================================
-- Replace USER_1_ID and USER_2_ID with actual UUIDs from STEP 1

DO $$
DECLARE
  user1_id UUID := 'PUT_USER_1_ID_HERE'::UUID;
  user2_id UUID := 'PUT_USER_2_ID_HERE'::UUID;
BEGIN
  -- Insert 2 test messages (timestamps will be NOW initially)
  INSERT INTO public.messages (sender_id, receiver_id, content)
  VALUES
    (user1_id, user2_id, 'MSG-005 TEST: OLD message (should delete)'),
    (user1_id, user2_id, 'MSG-005 TEST: RECENT message (should stay)');
  
  RAISE NOTICE 'Test messages inserted with current timestamps';
END $$;

-- ================================================================
-- STEP 3: Backdate the OLD message (set last_edited_at to 91 days ago)
-- ================================================================
-- This UPDATE will change the timestamp without trying to disable triggers

UPDATE public.messages
SET last_edited_at = now() - interval '91 days'
WHERE content = 'MSG-005 TEST: OLD message (should delete)';

UPDATE public.messages
SET last_edited_at = now() - interval '30 days'
WHERE content = 'MSG-005 TEST: RECENT message (should stay)';

-- ================================================================
-- STEP 4: Verify both messages exist with correct timestamps
-- ================================================================

SELECT
  id,
  content,
  last_edited_at,
  deleted_at,
  ROUND(EXTRACT(DAY FROM NOW() - last_edited_at))::INTEGER as days_old
FROM public.messages
WHERE content LIKE 'MSG-005 TEST:%'
ORDER BY last_edited_at ASC;

-- Expected output:
-- Row 1: OLD message, last_edited_at ~91 days ago, deleted_at = NULL, days_old = 91
-- Row 2: RECENT message, last_edited_at ~30 days ago, deleted_at = NULL, days_old = 30

-- ================================================================
-- STEP 5: Run the cleanup (manually trigger the wrapper RPC)
-- ================================================================

SELECT public.scheduled_message_cleanup('manual', jsonb_build_object('source','test-sql-editor'));

-- Expected: JSON response with processed_count = 1 (the old message)

-- ================================================================
-- STEP 6: Verify cleanup worked
-- ================================================================

SELECT
  id,
  content,
  last_edited_at,
  deleted_at,
  CASE 
    WHEN deleted_at IS NOT NULL THEN 'DELETED ✓'
    ELSE 'ACTIVE'
  END as status
FROM public.messages
WHERE content LIKE 'MSG-005 TEST:%'
ORDER BY last_edited_at ASC;

-- Expected:
-- Row 1: OLD message - DELETED ✓ (deleted_at is NOT NULL)
-- Row 2: RECENT message - ACTIVE (deleted_at is NULL)

-- ================================================================
-- STEP 7: Verify audit log
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
LIMIT 3;

-- Expected: Latest row shows:
--   invoked_by = 'manual'
--   processed_count = 1 (the old message)
--   errors_count = 0
--   error = NULL

-- ================================================================
-- CLEANUP (Optional: Delete test messages)
-- ================================================================

-- DELETE FROM public.messages WHERE content LIKE 'MSG-005 TEST:%';
-- SELECT COUNT(*) FROM public.messages WHERE content LIKE 'MSG-005 TEST:%';
