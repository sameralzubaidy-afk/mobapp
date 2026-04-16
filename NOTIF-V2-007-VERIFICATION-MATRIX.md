# NOTIF-V2-007 Verification Matrix

**Module:** MODULE-14-NOTIFICATIONS-V2  
**Task:** Complete Push + In-App Notification Coverage  
**Verification Date:** _____________

---

## Notification Coverage Matrix

| Event Category | Event Type | In-App | Push | Migration | Status |
|---------------|------------|--------|------|-----------|--------|
| **Messages** | new_message | ✅ | ✅ | 210 | Complete |
| **Trades** | trade_request | ✅ | ✅ | 211 | NEW |
| **Trades** | trade_completion_requested | ✅ | ✅ | 211 | NEW |
| **Trades** | trade_accepted | ✅ | ✅ | 211 | NEW |
| **Trades** | trade_rejected | ✅ | ✅ | 211 | NEW |
| **Trades** | trade_completed | ✅ | ✅ | 211 | NEW |
| **Trades** | trade_cancelled | ✅ | ✅ | 211 | NEW |
| **Referrals** | referral_invite_accepted | ✅ | ✅ | 212 | NEW |
| **Referrals** | referral_reward_earned | ✅ | ✅ | 212 | NEW |
| **Referrals** | referee_welcome | ✅ | ✅ | 212 | NEW |
| **Badges** | badge_earned | ✅ | ✅ | 213 | NEW |
| **SP Events** | sp_earned | ✅ | ✅ | 142 | Complete |
| **SP Events** | sp_spent | ✅ | ✅ | 142 | Complete |
| **SP Events** | sp_released | ✅ | ✅ | 142 | Complete |
| **SP Events** | sp_wallet_frozen | ✅ | ✅ | 142 | Complete |
| **SP Events** | sp_low_balance | ✅ | ✅ | 142 | Complete |

**Total Events:** 16  
**In-App Coverage:** 16/16 (100%) ✅  
**Push Coverage:** 16/16 (100%) ✅

---

## Pre-Deployment Checklist

### Database Readiness

- [ ] pg_net extension installed
  ```sql
  SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';
  ```

- [ ] All required tables exist
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename IN (
    'user_notifications', 
    'notification_preferences', 
    'push_tokens', 
    'push_delivery_logs'
  )
  ORDER BY tablename;
  ```

- [ ] All indexes created
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND indexname LIKE '%notification%'
  ORDER BY indexname;
  ```

### Configuration

- [ ] admin_config has required keys
  ```sql
  SELECT key, is_active 
  FROM admin_config 
  WHERE key IN ('supabase_url', 'supabase_anon_key', 'supabase_service_role_key')
  ORDER BY key;
  ```

- [ ] Edge Function deployed
  ```bash
  # Check in Supabase Dashboard > Edge Functions
  # send-push-notification should be listed and deployed
  ```

- [ ] Edge Function environment variables set
  ```bash
  # In Supabase Dashboard > Edge Functions > send-push-notification > Secrets
  # SUPABASE_URL: set
  # SUPABASE_SERVICE_ROLE_KEY: set
  ```

### Migration Status

- [ ] Migration 210 applied (messages)
  ```sql
  SELECT proname FROM pg_proc 
  WHERE proname = 'notify_new_message' 
  AND prosrc LIKE '%net.http_post%';
  ```

- [ ] Migration 211 applied (trades)
  ```sql
  SELECT proname FROM pg_proc 
  WHERE proname = 'create_trade_notification' 
  AND prosrc LIKE '%net.http_post%';
  ```

- [ ] Migration 212 applied (referrals)
  ```sql
  SELECT proname FROM pg_proc 
  WHERE proname = 'create_notification' 
  AND prosrc LIKE '%net.http_post%';
  ```

- [ ] Migration 213 applied (badges)
  ```sql
  SELECT proname FROM pg_proc 
  WHERE proname = 'create_badge_notification' 
  AND prosrc LIKE '%net.http_post%';
  ```

- [ ] All triggers active
  ```sql
  SELECT trigger_name, event_object_table, tgenabled 
  FROM information_schema.triggers t
  JOIN pg_trigger pt ON pt.tgname = t.trigger_name
  WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'on_message_insert_notify',
    'trade_request_notification',
    'trade_status_notification',
    'referral_invite_accepted_trigger',
    'badge_earned_trigger'
  )
  ORDER BY trigger_name;
  ```

---

## Functional Testing Checklist

### Test 1: Message Notification

**Setup:**
- User A (sender)
- User B (recipient)
- Active trade conversation

**Steps:**
1. [ ] User A sends message to User B
2. [ ] Wait 2-3 seconds
3. [ ] Check User B's notification center (in-app notification appears)
4. [ ] Check User B's device (push notification received)

**Verification SQL:**
```sql
SELECT 
  un.id,
  un.type,
  un.title,
  un.channels,
  pdl.receipt_status,
  un.created_at
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.user_id = '<user_b_id>'
AND un.type = 'new_message'
ORDER BY un.created_at DESC
LIMIT 1;
```

**Expected Result:**
- [ ] In-app notification created (un.id exists)
- [ ] Push attempted (pdl.receipt_status exists)
- [ ] Receipt status is 'ok' or valid error code

---

### Test 2: Trade Request Notification

**Setup:**
- User A (seller with active listing)
- User B (buyer)

**Steps:**
1. [ ] User B requests trade for User A's listing
2. [ ] Wait 2-3 seconds
3. [ ] Check User A's notification center (in-app)
4. [ ] Check User A's device (push)

**Verification SQL:**
```sql
SELECT 
  un.type,
  un.title,
  un.channels,
  pdl.receipt_status,
  un.created_at
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.user_id = '<user_a_id>'
AND un.type = 'trade_request'
ORDER BY un.created_at DESC
LIMIT 1;
```

**Expected Result:**
- [ ] Notification type = 'trade_request'
- [ ] Title contains "New Trade Request"
- [ ] Push status = 'ok'

---

### Test 3: Trade Completed Notification

**Setup:**
- Existing trade in 'active' status
- User A (seller)
- User B (buyer)

**Steps:**
1. [ ] User A marks trade as complete
2. [ ] User B confirms completion
3. [ ] Wait 2-3 seconds
4. [ ] Check both users' notifications

**Verification SQL:**
```sql
-- Check both parties received notification
SELECT 
  un.user_id,
  un.type,
  un.title,
  pdl.receipt_status
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.type = 'trade_completed'
AND un.created_at > now() - interval '5 minutes'
ORDER BY un.created_at DESC;
```

**Expected Result:**
- [ ] 2 notifications created (one for each party)
- [ ] Both show receipt_status = 'ok'

---

### Test 4: Badge Earned Notification

**Setup:**
- User A completes action that awards badge

**Steps:**
1. [ ] Trigger badge award (e.g., complete 5 trades)
2. [ ] Wait 2-3 seconds
3. [ ] Check User A's notifications

**Verification SQL:**
```sql
SELECT 
  un.type,
  un.title,
  un.data->>'badge_name' as badge_name,
  pdl.receipt_status,
  un.created_at
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.user_id = '<user_a_id>'
AND un.type = 'badge_earned'
ORDER BY un.created_at DESC
LIMIT 1;
```

**Expected Result:**
- [ ] Badge name present in notification data
- [ ] Title contains "Badge Earned"
- [ ] Push status = 'ok'

---

### Test 5: Referral Accepted Notification

**Setup:**
- User A (referrer with referral code)
- User B (new user)

**Steps:**
1. [ ] User A shares referral code
2. [ ] User B signs up using code
3. [ ] Wait 2-3 seconds
4. [ ] Check User A's notifications

**Verification SQL:**
```sql
SELECT 
  un.type,
  un.title,
  un.data->>'referral_id' as referral_id,
  pdl.receipt_status,
  un.created_at
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.user_id = '<user_a_id>'
AND un.type = 'referral_invite_accepted'
ORDER BY un.created_at DESC
LIMIT 1;
```

**Expected Result:**
- [ ] Title contains "Invite Was Accepted"
- [ ] Referral ID present in data
- [ ] Push status = 'ok'

---

## Performance Testing

### Test 6: Notification Latency

**Measurement:**
- Time from event trigger to notification creation
- Time from notification creation to push delivery

**SQL:**
```sql
-- Check recent notification latency
SELECT 
  un.type,
  un.created_at as notification_created,
  pdl.created_at as push_attempted,
  EXTRACT(EPOCH FROM (pdl.created_at - un.created_at)) as latency_seconds
FROM user_notifications un
JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.created_at > now() - interval '1 hour'
ORDER BY un.created_at DESC
LIMIT 20;
```

**Acceptance Criteria:**
- [ ] Average latency < 3 seconds
- [ ] 95th percentile < 5 seconds
- [ ] No failures due to timeout

---

### Test 7: Push Delivery Success Rate

**SQL:**
```sql
SELECT 
  receipt_status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM push_delivery_logs
WHERE created_at > now() - interval '24 hours'
GROUP BY receipt_status
ORDER BY count DESC;
```

**Acceptance Criteria:**
- [ ] 'ok' status > 90%
- [ ] 'DeviceNotRegistered' < 5% (expected for uninstalled apps)
- [ ] 'error' < 3%

---

## Edge Case Testing

### Test 8: User With Disabled Push Preferences

**Setup:**
- User A with push disabled for 'trades' category

**Steps:**
1. [ ] Disable push in notification preferences
  ```sql
  UPDATE notification_preferences
  SET push_enabled = false
  WHERE user_id = '<user_a_id>' AND category = 'trades';
  ```
2. [ ] Trigger trade notification for User A
3. [ ] Verify behavior

**Verification:**
```sql
SELECT 
  un.channels,
  pdl.id as push_log_exists
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.user_id = '<user_a_id>'
AND un.type = 'trade_request'
ORDER BY un.created_at DESC
LIMIT 1;
```

**Expected Result:**
- [ ] In-app notification created
- [ ] 'push' NOT in channels array
- [ ] No push_delivery_log entry

---

### Test 9: User Without Push Token

**Setup:**
- User A with no registered push_token

**Steps:**
1. [ ] Ensure no push token exists
  ```sql
  DELETE FROM push_tokens WHERE user_id = '<user_a_id>';
  ```
2. [ ] Trigger notification for User A

**Verification:**
```sql
SELECT 
  un.id,
  pdl.receipt_status,
  pdl.receipt_message
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.user_id = '<user_a_id>'
ORDER BY un.created_at DESC
LIMIT 1;
```

**Expected Result:**
- [ ] In-app notification created
- [ ] Push attempted but logged as 'no tokens'
- [ ] No crash or error blocking transaction

---

### Test 10: Concurrent Notifications

**Setup:**
- Trigger multiple notifications simultaneously

**Steps:**
1. [ ] Create multiple events at once (e.g., complete 3 trades)
2. [ ] Verify all notifications created

**SQL:**
```sql
SELECT 
  type,
  COUNT(*) as notification_count,
  COUNT(DISTINCT pdl.id) as push_count
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.user_id = '<user_a_id>'
AND un.created_at > now() - interval '1 minute'
GROUP BY type
ORDER BY notification_count DESC;
```

**Expected Result:**
- [ ] All notifications created
- [ ] No duplicates
- [ ] All pushes attempted

---

## Rollback Verification

### Test 11: Rollback to Previous Version

**Steps:**
1. [ ] Note current notification count
2. [ ] Apply rollback migrations
3. [ ] Trigger notification event
4. [ ] Verify in-app still works, push is skipped

**SQL:**
```sql
-- Check function version
SELECT 
  proname,
  CASE 
    WHEN prosrc LIKE '%net.http_post%' THEN 'Enhanced (with push)'
    ELSE 'Original (in-app only)'
  END as version
FROM pg_proc
WHERE proname IN (
  'create_trade_notification',
  'create_notification',
  'create_badge_notification'
)
ORDER BY proname;
```

**Expected Result:**
- [ ] Functions show 'Original (in-app only)'
- [ ] In-app notifications still work
- [ ] No push notifications sent

---

## Sign-Off

| Stakeholder | Role | Sign-Off | Date |
|------------|------|----------|------|
| Developer | Implementation | _________ | _____ |
| QA Lead | Testing | _________ | _____ |
| DevOps | Deployment | _________ | _____ |
| Product | Acceptance | _________ | _____ |

---

## Post-Deployment Monitoring

**Week 1 Metrics:**
- [ ] Push delivery success rate > 90%
- [ ] Average notification latency < 3 seconds
- [ ] No increase in user complaints about notifications
- [ ] No spike in push_delivery_logs errors

**Queries to monitor:**
```sql
-- Daily success rate
SELECT 
  DATE(created_at) as date,
  receipt_status,
  COUNT(*) as count
FROM push_delivery_logs
WHERE created_at > now() - interval '7 days'
GROUP BY DATE(created_at), receipt_status
ORDER BY date DESC, count DESC;

-- Notification volume by type
SELECT 
  type,
  COUNT(*) as count,
  DATE(created_at) as date
FROM user_notifications
WHERE created_at > now() - interval '7 days'
GROUP BY type, DATE(created_at)
ORDER BY date DESC, count DESC;
```

---

**Verification Complete:** _____________  
**Approved for Production:** [ ] Yes [ ] No  
**Notes:** _____________________________________________
