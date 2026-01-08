# MSG-005: Auto-Delete Expired Messages - Manual Testing Guide

**Module:** MODULE-07 MSG-005  
**Feature:** Scheduled job to auto-delete expired messages  
**Status:** Ready for Testing  
**Date:** January 6, 2026

---

## 📋 Overview

This guide walks through manual testing of the automated message cleanup system. The system soft-deletes messages X days after trade completion (default: 30 days).

**Components:**
1. `mark_expired_messages()` RPC function (runs the cleanup logic)
2. `cleanup-messages` Edge Function (scheduled wrapper)
3. Optional pg_cron job OR Supabase Dashboard Cron Job

---

## ⚙️ Prerequisites

Before testing, ensure:
- ✅ MSG-004 is complete (expiration function exists)
- ✅ Migration `081_message_expiration.sql` is applied
- ✅ Migration `082_message_cleanup_cron.sql` is applied (optional)
- ✅ Edge Function `cleanup-messages` is deployed
- ✅ Supabase Dashboard access (for cron setup)

**Check Prerequisites:**

```bash
# 1. Run this in Supabase SQL Editor to verify function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'mark_expired_messages';

# Expected: 1 row with function definition

# 2. Check admin config exists
SELECT key, value, data_type 
FROM admin_config 
WHERE key = 'message_expiration_days';

# Expected: 1 row with value = '30'

# 3. List deployed Edge Functions
npx supabase functions list --project-ref <YOUR_PROJECT_REF>

# Expected: cleanup-messages should be listed
```

---

## 🧪 Test Cases

### Test Case 1: Manual RPC Function Execution

**Objective:** Verify `mark_expired_messages()` works correctly

**Steps:**

1. **Setup test data** (run in Supabase SQL Editor):

```sql
-- Create a test trade that completed 35 days ago
INSERT INTO trades (id, buyer_id, seller_id, item_id, node_id, status, completed_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users OFFSET 1 LIMIT 1),
  (SELECT id FROM items LIMIT 1),
  (SELECT id FROM nodes LIMIT 1),
  'completed',
  NOW() - INTERVAL '35 days'
)
RETURNING id;

-- Note the returned trade_id, then insert messages
INSERT INTO messages (trade_id, sender_id, content)
VALUES 
  ('<TRADE_ID>', (SELECT id FROM auth.users LIMIT 1), 'Test message 1'),
  ('<TRADE_ID>', (SELECT id FROM auth.users OFFSET 1 LIMIT 1), 'Test message 2');
```

2. **Check messages are NOT deleted initially**:

```sql
SELECT id, content, deleted_at 
FROM messages 
WHERE trade_id = '<TRADE_ID>';

-- Expected: 2 rows, both with deleted_at = NULL
```

3. **Run cleanup function**:

```sql
SELECT mark_expired_messages();

-- Expected: Returns integer (number of messages deleted)
-- Should be at least 2 (our test messages)
```

4. **Verify messages are now soft deleted**:

```sql
SELECT id, content, deleted_at 
FROM messages 
WHERE trade_id = '<TRADE_ID>';

-- Expected: 2 rows, both with deleted_at = NOW() (approximately)
```

5. **Verify deleted messages are excluded from normal queries**:

```sql
SELECT COUNT(*) 
FROM messages 
WHERE trade_id = '<TRADE_ID>' 
  AND deleted_at IS NULL;

-- Expected: 0 (no active messages)
```

**✅ Pass Criteria:**
- Function returns count ≥ 2
- `deleted_at` is set to current timestamp
- Messages excluded from active queries

---

### Test Case 2: Edge Function Manual Invocation

**Objective:** Verify Edge Function calls RPC and returns correct response

**Steps:**

1. **Get your Supabase project details**:
   - Project URL: `https://<YOUR_PROJECT_REF>.supabase.co`
   - Anon Key: From Supabase Dashboard → Settings → API

2. **Invoke Edge Function via curl** (Terminal):

```bash
curl -X POST \
  'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/cleanup-messages' \
  -H 'Authorization: Bearer <YOUR_ANON_KEY>' \
  -H 'Content-Type: application/json'
```

3. **Verify response format**:

```json
{
  "success": true,
  "deleted_count": 5,
  "timestamp": "2026-01-06T12:00:00.000Z",
  "message": "Marked 5 messages as expired"
}
```

4. **Check Supabase logs** (Dashboard → Edge Functions → cleanup-messages → Logs):
   - Look for: `[cleanup-messages] Starting message cleanup job...`
   - Look for: `[cleanup-messages] Successfully marked X messages as expired`

**✅ Pass Criteria:**
- HTTP status 200
- Response contains `success: true`
- `deleted_count` is a number (can be 0 if no expired messages)
- Logs show execution

---

### Test Case 3: Edge Function Error Handling

**Objective:** Verify Edge Function handles errors gracefully

**Test 3a: Missing Environment Variables**

**Steps:**

1. **Temporarily remove environment variable** (Supabase Dashboard):
   - Go to Edge Functions → cleanup-messages → Settings
   - Remove `SUPABASE_SERVICE_ROLE_KEY` temporarily

2. **Invoke Edge Function**:

```bash
curl -X POST \
  'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/cleanup-messages' \
  -H 'Authorization: Bearer <YOUR_ANON_KEY>'
```

3. **Expected response**:

```json
{
  "error": "Server configuration error",
  "details": "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
}
```

4. **Restore environment variable** after test

**Test 3b: Invalid HTTP Method**

**Steps:**

1. **Use PUT method** (not allowed):

```bash
curl -X PUT \
  'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/cleanup-messages' \
  -H 'Authorization: Bearer <YOUR_ANON_KEY>'
```

2. **Expected response**:

```json
{
  "error": "Method not allowed"
}
```

3. **HTTP status**: 405

**✅ Pass Criteria:**
- Error responses have correct structure
- HTTP status codes are appropriate (500, 405)
- Logs show error details

---

### Test Case 4: Cron Job Setup (Supabase Dashboard)

**Objective:** Schedule automatic daily cleanup

**Steps:**

1. **Go to Supabase Dashboard**:
   - Navigate to: Database → Cron Jobs
   - Click: "Create Cron Job"

2. **Configure cron job**:
   ```
   Name: cleanup-expired-messages
   Schedule: 0 2 * * * (2 AM daily UTC)
   Type: Edge Function
   Edge Function: cleanup-messages
   Method: POST
   Auth: Service Role Key
   ```

3. **Save and enable**

4. **Verify cron job is listed**:
   - Should appear in Cron Jobs list
   - Status: Enabled
   - Next run: Tomorrow at 2 AM UTC

5. **Manual trigger** (to test immediately):
   - Click "Run Now" button
   - Check execution logs

**✅ Pass Criteria:**
- Cron job created successfully
- Shows next scheduled run
- Manual trigger works
- Logs show execution results

---

### Test Case 5: Admin Config Modification

**Objective:** Verify expiration period is configurable

**Steps:**

1. **Change expiration days to 7** (run in SQL Editor):

```sql
UPDATE admin_config
SET value = '7'
WHERE key = 'message_expiration_days';
```

2. **Create test messages from 10 days ago**:

```sql
-- Create completed trade from 10 days ago
INSERT INTO trades (id, buyer_id, seller_id, item_id, node_id, status, completed_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users OFFSET 1 LIMIT 1),
  (SELECT id FROM items LIMIT 1),
  (SELECT id FROM nodes LIMIT 1),
  'completed',
  NOW() - INTERVAL '10 days'
)
RETURNING id;

-- Insert message
INSERT INTO messages (trade_id, sender_id, content)
VALUES ('<NEW_TRADE_ID>', (SELECT id FROM auth.users LIMIT 1), 'Should expire with 7-day config');
```

3. **Run cleanup**:

```sql
SELECT mark_expired_messages();
```

4. **Verify message is deleted** (10 days > 7 days):

```sql
SELECT deleted_at FROM messages WHERE content = 'Should expire with 7-day config';

-- Expected: deleted_at IS NOT NULL
```

5. **Reset config to 30 days**:

```sql
UPDATE admin_config
SET value = '30'
WHERE key = 'message_expiration_days';
```

**✅ Pass Criteria:**
- Config change is respected
- Messages deleted based on new threshold
- Cleanup function reads config correctly

---

### Test Case 6: Idempotency Test

**Objective:** Verify cleanup can run multiple times safely

**Steps:**

1. **Run cleanup twice in a row**:

```sql
-- First run
SELECT mark_expired_messages();
-- Returns: X messages deleted

-- Second run immediately after
SELECT mark_expired_messages();
-- Returns: 0 (no more expired messages)
```

2. **Verify no errors on second run**

3. **Check messages are not "double deleted"**:

```sql
-- Count messages with deleted_at set
SELECT COUNT(*) FROM messages WHERE deleted_at IS NOT NULL;
-- Should match first run count
```

**✅ Pass Criteria:**
- Second run returns 0
- No errors thrown
- deleted_at timestamps unchanged

---

### Test Case 7: Messages NOT Expired Yet

**Objective:** Verify recent messages are NOT deleted

**Steps:**

1. **Create completed trade from 10 days ago** (within 30-day window):

```sql
INSERT INTO trades (id, buyer_id, seller_id, item_id, node_id, status, completed_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users OFFSET 1 LIMIT 1),
  (SELECT id FROM items LIMIT 1),
  (SELECT id FROM nodes LIMIT 1),
  'completed',
  NOW() - INTERVAL '10 days'
)
RETURNING id;

INSERT INTO messages (trade_id, sender_id, content)
VALUES ('<TRADE_ID>', (SELECT id FROM auth.users LIMIT 1), 'Should NOT be deleted');
```

2. **Run cleanup**:

```sql
SELECT mark_expired_messages();
```

3. **Verify message is NOT deleted**:

```sql
SELECT id, deleted_at 
FROM messages 
WHERE content = 'Should NOT be deleted';

-- Expected: deleted_at IS NULL
```

**✅ Pass Criteria:**
- Recent messages (< 30 days) are preserved
- deleted_at remains NULL
- Function only deletes truly expired messages

---

### Test Case 8: In-Progress Trades (Edge Case)

**Objective:** Verify messages from incomplete trades are NOT deleted

**Steps:**

1. **Create old in-progress trade** (not completed):

```sql
INSERT INTO trades (id, buyer_id, seller_id, item_id, node_id, status, created_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users OFFSET 1 LIMIT 1),
  (SELECT id FROM items LIMIT 1),
  (SELECT id FROM nodes LIMIT 1),
  'in_progress',
  NOW() - INTERVAL '60 days'  -- Very old, but not completed
)
RETURNING id;

INSERT INTO messages (trade_id, sender_id, content)
VALUES ('<TRADE_ID>', (SELECT id FROM auth.users LIMIT 1), 'Old trade, still in progress');
```

2. **Run cleanup**:

```sql
SELECT mark_expired_messages();
```

3. **Verify message is NOT deleted** (trade not completed):

```sql
SELECT id, deleted_at 
FROM messages 
WHERE content = 'Old trade, still in progress';

-- Expected: deleted_at IS NULL
```

**✅ Pass Criteria:**
- Messages from non-completed trades are preserved
- Only completed trades trigger expiration

---

## 🔍 Monitoring & Verification Queries

**Check recent cleanup activity:**

```sql
-- Messages deleted in last 7 days
SELECT 
  DATE(deleted_at) as deletion_date,
  COUNT(*) as messages_deleted
FROM messages
WHERE deleted_at IS NOT NULL
  AND deleted_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(deleted_at)
ORDER BY deletion_date DESC;
```

**Check upcoming expirations:**

```sql
-- Messages that will expire in next 5 days
SELECT COUNT(*) as messages_to_expire_soon
FROM messages m
INNER JOIN trades t ON m.trade_id = t.id
WHERE m.deleted_at IS NULL
  AND t.status = 'completed'
  AND t.completed_at IS NOT NULL
  AND t.completed_at BETWEEN (NOW() - INTERVAL '30 days') AND (NOW() - INTERVAL '25 days');
```

**Check cron job execution history** (if pg_cron enabled):

```sql
SELECT 
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-messages')
ORDER BY start_time DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Function returns 0 but should delete messages | Check trade `completed_at` is NOT NULL and > 30 days old |
| Function doesn't exist error | Re-run migration `081_message_expiration.sql` |
| Edge Function returns 500 | Check environment variables are set correctly |
| Cron job doesn't run | Verify it's enabled in Supabase Dashboard |
| Messages still appear in app | Verify app queries include `.is('deleted_at', null)` filter |
| pg_cron not available | Use Supabase Dashboard Cron Jobs instead |

---

## 📝 Test Summary Checklist

After completing all test cases, verify:

- [ ] ✅ RPC function `mark_expired_messages()` works correctly
- [ ] ✅ Edge Function `cleanup-messages` can be invoked manually
- [ ] ✅ Edge Function returns correct response format
- [ ] ✅ Edge Function handles errors gracefully
- [ ] ✅ Cron job is scheduled in Supabase Dashboard
- [ ] ✅ Admin config is respected (expiration days)
- [ ] ✅ Cleanup is idempotent (safe to run multiple times)
- [ ] ✅ Recent messages are NOT deleted
- [ ] ✅ In-progress trade messages are NOT deleted
- [ ] ✅ Deleted messages are excluded from app queries

---

## 🚀 Next Steps

- [ ] Review test results with team
- [ ] Monitor cleanup logs for first week
- [ ] Adjust expiration period if needed (via admin_config)
- [ ] Proceed to MSG-006 (Push Notifications for Messages)

---

**MSG-005 Manual Testing Guide - Complete**
