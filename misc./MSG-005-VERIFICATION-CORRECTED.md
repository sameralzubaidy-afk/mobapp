# MSG-005: Auto-Delete Expired Messages – Verification Guide (CORRECTED)

**Goal**: Verify that messages are automatically deleted 30 days AFTER their trade is completed (trade-linked expiration).

---

## Key Logic (Already Implemented Correctly)

Messages expire when:
1. `messages.trade_id` → points to a trade
2. `trades.status = 'completed'`
3. `trades.completed_at < (NOW() - 30 days)`

The expiration period (30 days) is configurable via `admin_config.message_expiration_days`.

---

## Step 1: Verify Prerequisites ✓

Run this SQL query to confirm the migrations are applied:

```sql
-- Check if mark_expired_messages function exists
SELECT EXISTS(
  SELECT 1 FROM pg_proc 
  WHERE proname = 'mark_expired_messages'
) as mark_expired_exists;

-- Check if message_cleanup_runs table exists
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'message_cleanup_runs'
) as message_cleanup_runs_exists;

-- Check admin_config has message_expiration_days
SELECT value FROM admin_config WHERE key = 'message_expiration_days';
```

**Expected Result**: All should return `true` / `30` (or your configured value).

---

## Step 2: Prepare Test Data

### A. Get Real User IDs, Item ID, Node ID

```sql
-- Get 2 user IDs
SELECT id, email FROM auth.users LIMIT 2;

-- Get an item ID (from a listing)
SELECT id, title FROM items LIMIT 1;

-- Get a node ID
SELECT id, name FROM geographic_nodes LIMIT 1;
```
Copy these IDs for use in Steps 3-4.

---

## Step 3: Create an "Expired" Trade (completed 31+ days ago)

Messages are tied to trades. They only expire if their trade was `completed` more than 30 days ago.

```sql
DO $$
DECLARE
  user1_id UUID := 'PUT_USER_1_ID_HERE'::UUID;
  user2_id UUID := 'PUT_USER_2_ID_HERE'::UUID;
  item_id UUID := 'PUT_ITEM_ID_HERE'::UUID;
  node_id UUID := 'PUT_NODE_ID_HERE'::UUID;
  v_trade_id UUID;
BEGIN
  -- Create a trade that completed 31 days ago
  INSERT INTO trades (buyer_id, seller_id, item_id, status, node_id, completed_at, created_at)
  VALUES (
    user1_id, user2_id, item_id, 'completed', node_id,
    now() - interval '31 days',  -- Completed 31 days ago (> 30-day threshold)
    now() - interval '31 days'
  )
  RETURNING id INTO v_trade_id;

  -- Insert messages for that OLD trade
  INSERT INTO public.messages (sender_id, receiver_id, trade_id, content)
  VALUES
    (user1_id, user2_id, v_trade_id, 'OLD TRADE MSG 1: trade completed 31 days ago (should delete)'),
    (user1_id, user2_id, v_trade_id, 'OLD TRADE MSG 2: trade completed 31 days ago (should delete)');
  
  RAISE NOTICE 'Created old trade % with completed_at = 31 days ago', v_trade_id;
END $$;
```

---

## Step 4: Create a "Recent" Trade (completed < 30 days ago)

```sql
DO $$
DECLARE
  user1_id UUID := 'PUT_USER_1_ID_HERE'::UUID;
  user2_id UUID := 'PUT_USER_2_ID_HERE'::UUID;
  item_id UUID := 'PUT_ITEM_ID_HERE'::UUID;
  node_id UUID := 'PUT_NODE_ID_HERE'::UUID;
  v_trade_id UUID;
BEGIN
  -- Create a trade that completed only 5 days ago
  INSERT INTO trades (buyer_id, seller_id, item_id, status, node_id, completed_at, created_at)
  VALUES (
    user1_id, user2_id, item_id, 'completed', node_id,
    now() - interval '5 days',  -- Completed only 5 days ago (< 30-day threshold)
    now() - interval '5 days'
  )
  RETURNING id INTO v_trade_id;

  -- Insert message for RECENT trade
  INSERT INTO public.messages (sender_id, receiver_id, trade_id, content)
  VALUES (user1_id, user2_id, v_trade_id, 'RECENT TRADE MSG: trade completed only 5 days ago (should stay)');
  
  RAISE NOTICE 'Created recent trade % with completed_at = 5 days ago', v_trade_id;
END $$;
```

---

## Step 5: Verify Both Trades & Messages Exist

```sql
SELECT 
  t.id as trade_id,
  t.status,
  t.completed_at,
  ROUND(EXTRACT(DAY FROM NOW() - t.completed_at))::INTEGER as trade_days_old,
  COUNT(m.id) as message_count
FROM trades t
LEFT JOIN messages m ON t.id = m.trade_id AND (m.content LIKE '%OLD TRADE%' OR m.content LIKE '%RECENT TRADE%')
WHERE EXISTS (
  SELECT 1 FROM messages m2 WHERE m2.trade_id = t.id 
  AND (m2.content LIKE '%OLD TRADE%' OR m2.content LIKE '%RECENT TRADE%')
)
GROUP BY t.id, t.status, t.completed_at
ORDER BY t.completed_at DESC;
```

**Expected Result**: 
- 2 rows: one ~31 days old (2 messages), one ~5 days old (1 message)

---

## Step 6: Manually Trigger the Cleanup

```sql
SELECT public.scheduled_message_cleanup(
  'manual', 
  jsonb_build_object('source','test-sql-editor')
);
```

**Expected Result**: JSON response with `processed_count = 2` (the 2 messages from the 31-day-old trade)

---

## Step 7: Verify Cleanup Worked Correctly

```sql
SELECT
  m.content,
  m.deleted_at,
  t.completed_at,
  ROUND(EXTRACT(DAY FROM NOW() - t.completed_at))::INTEGER as trade_days_old,
  CASE 
    WHEN m.content LIKE '%OLD TRADE%' THEN 'OLD (should be deleted)'
    WHEN m.content LIKE '%RECENT TRADE%' THEN 'RECENT (should stay)'
    ELSE 'OTHER'
  END as expected
FROM public.messages m
LEFT JOIN trades t ON m.trade_id = t.id
WHERE m.content LIKE '%OLD TRADE%' OR m.content LIKE '%RECENT TRADE%'
ORDER BY t.completed_at DESC;
```

**Expected Result**:
| content | trade_days_old | deleted_at | expected |
|---------|---|-----------|-----------|
| OLD TRADE MSG 1... | 31 | `2026-01-XX XX:XX:XX` | OLD (should be deleted) ✓ |
| OLD TRADE MSG 2... | 31 | `2026-01-XX XX:XX:XX` | OLD (should be deleted) ✓ |
| RECENT TRADE MSG... | 5 | `NULL` | RECENT (should stay) ✓ |

---

## Step 8: Verify Audit Log Entry

```sql
SELECT
  run_at,
  invoked_by,
  processed_count,
  errors_count,
  error,
  result
FROM public.message_cleanup_runs
ORDER BY run_at DESC
LIMIT 1;
```

**Expected Result**: 
- `invoked_by = 'manual'`
- `processed_count = 2`
- `errors_count = 0`
- `error = NULL`

---

## Step 9: Test the Edge Function (Optional)

If deployed:

```bash
curl -i --request POST 'https://[YOUR_PROJECT_ID].supabase.co/functions/v1/cleanup-messages' \
  --header 'Authorization: Bearer [YOUR_SERVICE_ROLE_KEY]'
```

**Expected Response**:
```json
{
  "success": true,
  "deleted_count": 0,
  "timestamp": "2026-01-08T12:34:56.789Z",
  "message": "Marked 0 messages as expired",
  "result": {
    "processed_count": 0,
    "errors_count": 0,
    "status": "success"
  }
}
```

(Count is 0 because we already ran cleanup in Step 6)

---

## Troubleshooting

### ❌ "Marked 0 messages"
- **Check 1**: Is the trade `status = 'completed'`?
  ```sql
  SELECT status, completed_at FROM trades ORDER BY completed_at ASC LIMIT 5;
  ```
- **Check 2**: Is `completed_at` older than 30 days?
  ```sql
  SELECT NOW() - INTERVAL '30 days' as threshold;
  SELECT t.completed_at FROM trades t WHERE status = 'completed' 
  AND t.completed_at < (NOW() - INTERVAL '30 days');
  ```
- **Check 3**: Do messages exist for that trade?
  ```sql
  SELECT COUNT(*) FROM messages WHERE trade_id IN (
    SELECT id FROM trades WHERE status = 'completed' 
    AND completed_at < (NOW() - INTERVAL '30 days')
  ) AND deleted_at IS NULL;
  ```

### ❌ "Foreign key violation on trade_id"
- Ensure the trade IDs you're inserting actually exist, or insert a valid trade first

### ❌ "Auth error" when calling Edge Function
- Use `SUPABASE_SERVICE_ROLE_KEY` (not anon key)
- Function must be deployed: `supabase functions deploy cleanup-messages`

---

## Production Scheduling

Once verified, set up automated runs:
- **Supabase Dashboard Cron Jobs**: Create cron to call `cleanup-messages` Edge Function daily
- **GitHub Actions**: Schedule a workflow to POST to the function
- **pg_cron** (if available): Migration 082 sets this up

---

## Monitoring Query

```sql
-- Check message deletion volume over time
SELECT 
  DATE(deleted_at) as deletion_date,
  COUNT(*) as messages_deleted
FROM messages
WHERE deleted_at IS NOT NULL
  AND deleted_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(deleted_at)
ORDER BY deletion_date DESC;
```
