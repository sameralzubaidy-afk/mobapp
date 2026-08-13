# MSG-005: Auto-Delete Expired Messages – Complete Manual Verification Guide

**Goal**: Verify that messages are soft deleted (set `deleted_at`) once a trade has been `completed` for `admin_config.message_expiration_days` days (default: **30 days**).

---

## Step 1: Verify Prerequisites ✓

Run this SQL query to confirm the migrations are applied:

```sql
-- Check if mark_expired_messages function exists
SELECT EXISTS(
  SELECT 1 FROM pg_proc 
  WHERE proname = 'mark_expired_messages'
) as mark_expired_exists;

-- Check if scheduled_message_cleanup wrapper exists
SELECT EXISTS(
  SELECT 1 FROM pg_proc
  WHERE proname = 'scheduled_message_cleanup'
) as scheduled_cleanup_exists;

-- Check if message_cleanup_runs table exists
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'message_cleanup_runs'
) as audit_table_exists;

-- Check the retention setting (defaults to 30 if missing)
SELECT key, value
FROM public.admin_config
WHERE key = 'message_expiration_days';

-- Check the messages.expires_at column exists (added by a later fix migration)
SELECT EXISTS(
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'messages'
    AND column_name = 'expires_at'
) as messages_expires_at_exists;
```

**Expected Result**:
- `mark_expired_exists = true`
- `scheduled_cleanup_exists = true`
- `audit_table_exists = true`
- `message_expiration_days` row exists (value typically `30`)
- `messages_expires_at_exists = true`

---

## Step 2: Prepare Test Data

### A. Pick Two Completed Trades (One “Old”, One “Recent”)

Message expiration is based on **trade completion age**, not message age.

1) First, read the current retention days:

```sql
SELECT COALESCE(NULLIF(TRIM(value), ''), '30')::INTEGER AS message_expiration_days
FROM public.admin_config
WHERE key = 'message_expiration_days'
LIMIT 1;
```

2) Find candidate completed trades (replace `30 days` in the WHERE clauses if you changed the config):

```sql
-- OLD completed trades: completed long enough ago to be eligible for cleanup
SELECT
  t.id AS trade_id,
  t.buyer_id,
  t.seller_id,
  t.status,
  t.completed_at,
  NOW() - t.completed_at AS completed_age
FROM public.trades t
WHERE t.status = 'completed'
  AND t.completed_at IS NOT NULL
  AND t.completed_at < (NOW() - INTERVAL '31 days')
ORDER BY t.completed_at ASC
LIMIT 5;

-- RECENT completed trades: should NOT be cleaned up yet
SELECT
  t.id AS trade_id,
  t.buyer_id,
  t.seller_id,
  t.status,
  t.completed_at,
  NOW() - t.completed_at AS completed_age
FROM public.trades t
WHERE t.status = 'completed'
  AND t.completed_at IS NOT NULL
  AND t.completed_at > (NOW() - INTERVAL '29 days')
ORDER BY t.completed_at DESC
LIMIT 5;
```

**If you don’t have any OLD completed trades in your dev DB:**
- In a non-production environment, temporarily set `message_expiration_days` to a smaller number (e.g. `1`) and rerun the queries above using `INTERVAL '2 days'` and `INTERVAL '0 days'`.
- Reset the config back to `30` when done.

---

## Step 3: Insert a Message for the OLD Completed Trade

Run this in your **Supabase SQL Editor**.

```sql
-- IMPORTANT: Replace trade_id + sender_id with values from Step 2.
-- sender_id must be either the buyer_id or seller_id for that trade.
INSERT INTO public.messages (trade_id, sender_id, content, created_at, updated_at)
VALUES (
  '<OLD_TRADE_ID>'::uuid,
  '<OLD_TRADE_BUYER_OR_SELLER_ID>'::uuid,
  'MSG-005 TEST: OLD completed trade message (should be deleted after cleanup)',
  NOW(),
  NOW()
);
```

**Verify Insertion**:
```sql
-- Check that the message exists and is NOT deleted
SELECT 
  id, 
  trade_id,
  sender_id,
  content, 
  created_at,
  deleted_at
FROM public.messages
WHERE content LIKE '%MSG-005 TEST: OLD completed trade message%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result**:
- `deleted_at` should be `NULL` (not yet deleted)

---

## Step 4: Insert a Message for the RECENT Completed Trade (Control)

This verifies the cleanup only affects trades completed “long enough ago”.

```sql
-- IMPORTANT: Replace trade_id + sender_id with values from Step 2.
INSERT INTO public.messages (trade_id, sender_id, content, created_at, updated_at)
VALUES (
  '<RECENT_TRADE_ID>'::uuid,
  '<RECENT_TRADE_BUYER_OR_SELLER_ID>'::uuid,
  'MSG-005 TEST: RECENT completed trade message (should NOT be deleted after cleanup)',
  NOW(),
  NOW()
);
```

**Verify Both Exist**:
```sql
SELECT 
  id, 
  content, 
  trade_id,
  created_at,
  deleted_at,
  ROUND(EXTRACT(DAY FROM NOW() - created_at))::INTEGER as days_old
FROM public.messages
WHERE content LIKE '%MSG-005 TEST: OLD completed trade message%'
   OR content LIKE '%MSG-005 TEST: RECENT completed trade message%'
ORDER BY created_at DESC;
```

**Expected Result**:
- 2 rows
- Both have `deleted_at = NULL`

---

## Step 5: Manually Trigger the Cleanup Function

```sql
-- Preferred: Call the scheduled wrapper (also writes to message_cleanup_runs)
SELECT public.scheduled_message_cleanup('manual', jsonb_build_object('source', 'sql-editor'));

-- Alternative (core logic only, no audit log)
-- SELECT mark_expired_messages() as messages_marked_deleted;
```

**Expected Result**: `processed_count` should be `1` (or higher if other old messages exist)

---

## Step 6: Verify Messages Were Deleted

```sql
-- Check both test messages
SELECT 
  id, 
  content, 
  deleted_at,
  CASE 
    WHEN content LIKE '%MSG-005 TEST: OLD completed trade message%' THEN 'OLD trade (should be deleted)'
    WHEN content LIKE '%MSG-005 TEST: RECENT completed trade message%' THEN 'RECENT trade (should NOT be deleted)'
    ELSE 'OTHER'
  END as test_type
FROM public.messages
WHERE content LIKE '%MSG-005 TEST: OLD completed trade message%'
   OR content LIKE '%MSG-005 TEST: RECENT completed trade message%'
ORDER BY created_at DESC;
```

**Expected Result**:
| content | test_type | deleted_at |
|---------|-----------|-----------|
| MSG-005 TEST: OLD... | OLD trade (should be deleted) | non-NULL timestamp |
| MSG-005 TEST: RECENT... | RECENT trade (should NOT be deleted) | `NULL` |

---

## Step 7: Verify Audit Log Entry

```sql
-- Check the audit table
SELECT 
  id,
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
- Latest row should have `invoked_by = 'manual'`, `'edge_function'`, or `'pg_cron'` (depending on how it was triggered)
- `processed_count` should be >= 1
- `errors_count` should be 0
- `error` should be `NULL`

---

## Step 8: Test the Edge Function (Optional – Production Only)

If the Edge Function is deployed, you can invoke it via curl.

Important: Do **not** put your Supabase `service_role` key into curl commands. The Edge Function already uses `SUPABASE_SERVICE_ROLE_KEY` on the server side.

### Local Testing (if running `supabase functions serve`)
```bash
curl -i --request GET 'http://127.0.0.1:54321/functions/v1/cleanup-messages' \
  --header 'Content-Type: application/json'
```

### Production Testing
```bash
curl -i --request POST 'https://[YOUR_PROJECT_ID].supabase.co/functions/v1/cleanup-messages' \
  --header 'Content-Type: application/json'
```

**Expected Response**:
```json
{
  "success": true,
  "deleted_count": 0,
  "timestamp": "2026-01-08T12:34:56.789Z",
  "message": "Marked 0 messages as expired"
}
```

(Count is 0 because we already ran the cleanup in Step 5)

---

## Step 9: Cleanup Test Data (Optional)

```sql
-- Delete the test messages
DELETE FROM public.messages
WHERE content LIKE '%MSG-005 TEST: OLD completed trade message%'
  OR content LIKE '%MSG-005 TEST: RECENT completed trade message%';

-- Verify deletion
SELECT COUNT(*) as remaining_test_messages
FROM public.messages
WHERE content LIKE '%MSG-005 TEST:%';
```

---

## Summary – What Should Happen?

| Step | Action | Expected Outcome |
|------|--------|------------------|
| 3 | Insert message 91 days old | Message created with `deleted_at = NULL` |
| 4 | Insert message 30 days old | Message created with `deleted_at = NULL` |
| 5 | Call `mark_expired_messages()` | Returns `1` (one message marked deleted) |
| 6 | Query messages | OLD message has `deleted_at` timestamp, RECENT message is unchanged |
| 7 | Query audit table | Latest run shows `processed_count = 1`, `errors_count = 0` |
| 8 | Invoke Edge Function | Returns `200 OK` with success flag |

---

## Troubleshooting

### ❌ "Function mark_expired_messages does not exist"
- **Fix**: Run migration [081_message_expiration.sql](supabase/migrations/081_message_expiration.sql)

### ❌ "Table message_cleanup_runs does not exist"
- **Fix**: Run migration [083_message_cleanup_audit.sql](supabase/migrations/083_message_cleanup_audit.sql)

### ❌ "Function scheduled_message_cleanup does not accept parameters"
- **Fix**: Run migration [084_message_cleanup_wrapper_update.sql](supabase/migrations/084_message_cleanup_wrapper_update.sql)

### ❌ "Marked 0 messages"
- **Check**: Ensure the OLD trade is actually completed long enough ago
- **Verify**: `SELECT id, status, completed_at FROM public.trades WHERE id = '<OLD_TRADE_ID>'::uuid;`
- **Note**: Cleanup is keyed off `trades.completed_at` (not message timestamps)

### ❌ "Auth error" when calling Edge Function
- **Check**: Function is deployed and environment variables are set in Supabase
- **Note**: If you want to restrict who can trigger cleanup, add authorization checks inside the Edge Function (recommended for production)

---

## Production Scheduling (Next Step)

Once verified locally, set up automated cleanup in production via:
- **GitHub Actions**: Cron job that calls the Edge Function daily
- **Supabase Webhooks**: External scheduler pointing to the function endpoint
- **Manual**: Run `SELECT mark_expired_messages();` via scheduled job

