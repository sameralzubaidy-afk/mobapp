# MSG-004: Message Expiration - Manual Testing Guide

## Module: MODULE-07 MSG-004
**Feature:** Automatically delete messages 30 days after trade completion  
**Test Environment:** Supabase Production (no local)  
**Test Duration:** 30-45 minutes

---

## Prerequisites

Before testing, ensure:
- [ ] Migration `081_message_expiration.sql` has been run in Supabase SQL Editor
- [ ] Edge Function `cleanup-messages` has been deployed
- [ ] You have access to Supabase Dashboard (SQL Editor)
- [ ] At least ONE completed trade exists in the database
- [ ] Admin access to change `admin_config` values (optional for config testing)

---

## Test Case 1: Verify Admin Config

**Objective:** Confirm message_expiration_days is configured correctly

### Steps:
1. Open **Supabase Dashboard** → **SQL Editor**
2. Run the following query:

```sql
SELECT key, value, value_type, description, updated_at
FROM admin_config
WHERE key = 'message_expiration_days';
```

### Expected Results:
| key | value | value_type | description |
|-----|-------|-----------|-------------|
| message_expiration_days | 30 | number | Days after trade completion before messages are soft deleted |

**✅ PASS if:** Config exists with value = '30'  
**❌ FAIL if:** Config is missing or value is not '30'

---

## Test Case 2: Verify mark_expired_messages() Function Exists

**Objective:** Confirm the RPC function is installed

### Steps:
1. In **SQL Editor**, run:

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'mark_expired_messages';
```

### Expected Results:
- Function named `mark_expired_messages` exists
- Function source code includes logic to UPDATE messages SET deleted_at

**✅ PASS if:** Function exists  
**❌ FAIL if:** Function does not exist (returns 0 rows)

---

## Test Case 3: DRY RUN - Check Eligible Messages

**Objective:** See how many messages WOULD be deleted without actually deleting

### Steps:
1. In **SQL Editor**, run:

```sql
-- Count messages eligible for expiration (31+ days old)
SELECT COUNT(*) AS eligible_messages
FROM messages m
INNER JOIN trades t ON m.trade_id = t.id
WHERE m.deleted_at IS NULL
  AND t.status = 'completed'
  AND t.completed_at IS NOT NULL
  AND t.completed_at < (NOW() - INTERVAL '30 days');
```

### Expected Results:
- Returns a count (could be 0 if no old completed trades exist)
- If count > 0, messages are eligible for deletion

**✅ PASS if:** Query runs without error  
**⚠️ WARN if:** Count = 0 (no old messages exist, proceed to Test Case 4 to create test data)

---

## Test Case 4: Create Test Data (If Needed)

**Objective:** Create a completed trade with messages for testing

### Steps:
1. Find an existing completed trade:

```sql
SELECT id, status, completed_at
FROM trades
WHERE status = 'completed'
  AND completed_at IS NOT NULL
LIMIT 1;
```

2. If no completed trades exist, complete one via the mobile app first.

3. Create test messages for this trade:

```sql
-- Replace <TRADE_ID> with actual trade ID from step 1
INSERT INTO messages (trade_id, sender_id, content, message_type)
VALUES (
  '<TRADE_ID>',
  (SELECT buyer_id FROM trades WHERE id = '<TRADE_ID>'),
  'Test message for expiration',
  'text'
);
```

4. Manually set the trade's completed_at to 31 days ago:

```sql
-- Replace <TRADE_ID>
UPDATE trades
SET completed_at = NOW() - INTERVAL '31 days'
WHERE id = '<TRADE_ID>';
```

### Expected Results:
- Test message created
- Trade completion date set to 31 days ago

**✅ PASS if:** Data created successfully

---

## Test Case 5: Execute mark_expired_messages() Function

**Objective:** Run the expiration function and verify messages are soft deleted

### Steps:
1. In **SQL Editor**, run:

```sql
SELECT mark_expired_messages();
```

### Expected Results:
- Function returns an INTEGER (count of deleted messages)
- If you created test data in Test Case 4, count should be ≥ 1

**✅ PASS if:** Function executes without error and returns a number  
**❌ FAIL if:** Function throws an error

---

## Test Case 6: Verify Messages Are Soft Deleted

**Objective:** Confirm deleted_at timestamp is set on expired messages

### Steps:
1. In **SQL Editor**, run:

```sql
-- Check soft deleted messages
SELECT id, trade_id, content, deleted_at
FROM messages
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 10;
```

### Expected Results:
- Messages have `deleted_at` timestamp set
- Timestamps should be recent (within last few minutes)

**✅ PASS if:** Deleted messages have deleted_at populated  
**❌ FAIL if:** deleted_at is still NULL after running function

---

## Test Case 7: Verify Deleted Messages Excluded from Queries

**Objective:** Confirm deleted messages don't appear in normal chat queries

### Steps:
1. Pick a trade ID from Test Case 6
2. Query messages with and without deleted filter:

```sql
-- Without filter (includes deleted)
SELECT COUNT(*) AS total_messages
FROM messages
WHERE trade_id = '<TRADE_ID>';

-- With filter (excludes deleted) - THIS IS WHAT APP USES
SELECT COUNT(*) AS active_messages
FROM messages
WHERE trade_id = '<TRADE_ID>'
  AND deleted_at IS NULL;
```

### Expected Results:
- `total_messages` > `active_messages`
- Difference = number of deleted messages

**✅ PASS if:** active_messages excludes deleted ones  
**❌ FAIL if:** Both queries return same count

---

## Test Case 8: Test Edge Function Invocation

**Objective:** Verify the cleanup-messages Edge Function can be called

### Steps:
1. Get your Supabase URL and Anon Key from Dashboard → Settings → API
2. Use `curl` or Postman to call the function:

```bash
curl -X POST https://<YOUR_PROJECT>.supabase.co/functions/v1/cleanup-messages \
  -H "Authorization: Bearer <YOUR_ANON_KEY>" \
  -H "Content-Type: application/json"
```

### Expected Results:
```json
{
  "success": true,
  "deleted_count": 0,
  "timestamp": "2026-01-05T...",
  "message": "Marked 0 messages as expired"
}
```

**✅ PASS if:** Returns 200 status and success: true  
**❌ FAIL if:** Returns error or 500 status

---

## Test Case 9: Test Admin Config Change

**Objective:** Verify expiration period can be changed via admin_config

### Steps:
1. Change expiration period to 60 days:

```sql
UPDATE admin_config
SET value = '60', updated_at = NOW()
WHERE key = 'message_expiration_days';
```

2. Create a message on a trade completed 45 days ago (between 30 and 60):

```sql
-- Set trade to 45 days old
UPDATE trades
SET completed_at = NOW() - INTERVAL '45 days'
WHERE id = '<TRADE_ID>';
```

3. Run expiration function:

```sql
SELECT mark_expired_messages();
```

4. Verify message is NOT deleted (because 45 < 60 days):

```sql
SELECT id, deleted_at
FROM messages
WHERE trade_id = '<TRADE_ID>';
```

5. Restore config to default:

```sql
UPDATE admin_config
SET value = '30', updated_at = NOW()
WHERE key = 'message_expiration_days';
```

### Expected Results:
- Message NOT deleted when completed_at is within config window
- Message WOULD be deleted if completed_at > config days

**✅ PASS if:** Function respects admin_config value  
**❌ FAIL if:** Function always uses hardcoded 30 days

---

## Test Case 10: Test Messages from Incomplete Trades

**Objective:** Verify only completed trades trigger expiration

### Steps:
1. Find a trade with status != 'completed':

```sql
SELECT id, status, completed_at
FROM trades
WHERE status != 'completed'
LIMIT 1;
```

2. Create a message for this trade:

```sql
INSERT INTO messages (trade_id, sender_id, content, message_type)
VALUES (
  '<INCOMPLETE_TRADE_ID>',
  (SELECT buyer_id FROM trades WHERE id = '<INCOMPLETE_TRADE_ID>'),
  'Message on incomplete trade',
  'text'
);
```

3. Run expiration function:

```sql
SELECT mark_expired_messages();
```

4. Verify message is NOT deleted:

```sql
SELECT id, deleted_at
FROM messages
WHERE trade_id = '<INCOMPLETE_TRADE_ID>';
```

### Expected Results:
- Message on incomplete trade has deleted_at = NULL
- Only messages from completed trades are eligible for expiration

**✅ PASS if:** Incomplete trade messages are ignored  
**❌ FAIL if:** Messages deleted regardless of trade status

---

## Test Case 11: Mobile App Integration (Chat Screen)

**Objective:** Verify deleted messages don't appear in mobile app chat

### Steps:
1. Open mobile app and navigate to a trade with expired messages
2. Open chat screen for that trade
3. Observe message list

### Expected Results:
- Deleted messages do NOT appear in chat
- Only active messages (deleted_at IS NULL) are shown
- No error messages or crashes

**✅ PASS if:** App shows only active messages  
**❌ FAIL if:** Deleted messages appear or app crashes

---

## Test Case 12: Schedule Edge Function as Cron (Optional)

**Objective:** Set up automated daily cleanup

### Steps:
1. In **Supabase Dashboard** → **Database** → **Cron Jobs**
2. Create a new cron job:
   - **Name:** cleanup-messages-daily
   - **Schedule:** `0 2 * * *` (runs at 2 AM daily)
   - **Command:** 
   ```sql
   SELECT net.http_post(
     url := 'https://<YOUR_PROJECT>.supabase.co/functions/v1/cleanup-messages',
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
     )
   );
   ```

3. Wait 24 hours or trigger manually to verify

### Expected Results:
- Cron job executes daily without errors
- Messages are cleaned up automatically

**✅ PASS if:** Cron job runs successfully  
**⚠️ OPTIONAL:** Can skip if not ready for automated cleanup

---

## Summary Checklist

After completing all test cases, verify:

- [x] Admin config `message_expiration_days` exists with value '30'
- [x] Function `mark_expired_messages()` exists and is callable
- [x] Function soft deletes messages (sets deleted_at timestamp)
- [x] Deleted messages are excluded from app queries (deleted_at IS NULL filter)
- [x] Only completed trades trigger expiration
- [x] Only messages older than config days are deleted
- [x] Edge Function `/cleanup-messages` is accessible and returns success
- [x] Admin can change expiration period via admin_config
- [x] Mobile app chat excludes deleted messages
- [x] (Optional) Cron job scheduled for daily cleanup

---

## Cleanup After Testing

To remove test data:

```sql
-- Delete test messages
DELETE FROM messages
WHERE content LIKE '%Test message for expiration%';

-- Restore trades to original completed_at
-- (Manual restore if you have original dates)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Function returns 0 but messages should be deleted | Check trade `completed_at` is NOT NULL and > 30 days old |
| Function doesn't exist error | Re-run migration `081_message_expiration.sql` |
| Edge Function returns 500 | Check Supabase logs in Dashboard → Edge Functions → Logs |
| Messages still appear in app | Verify `getMessages()` service includes `.is('deleted_at', null)` filter |
| Admin config missing | Run: `INSERT INTO admin_config ...` from migration |

---

## Next Steps

- [ ] Review test results
- [ ] Fix any failed test cases
- [ ] Schedule cron job for production (optional)
- [ ] Monitor message cleanup logs in Supabase Dashboard
- [ ] Proceed to MSG-005 verification (if implementing pg_cron trigger)
