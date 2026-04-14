# NOTIF-V2-005: Push Notification Delivery Engine - Manual Testing Guide

**Module:** MODULE-14-NOTIFICATIONS-V2  
**Task:** NOTIF-V2-005  
**Test Date:** _____________  
**Tester:** _____________  
**Platform:** ☐ iOS Simulator  ☐ Android Emulator

---

## Prerequisites

Before starting testing, ensure:
- [ ] SQL migration `202_push_delivery_engine_v2.sql` has been applied to Supabase
- [ ] User account created and logged in
- [ ] Push notification token registered (run "Enable Push Notifications" in Settings first)
- [ ] Test device/emulator is running

---

## Test Case 1: Push Token Storage & Update on Login

**Objective:** Verify push tokens are stored and updated correctly

### Steps:
1. Open the app (not logged in)
2. Navigate to Settings → "Enable Push Notifications"
3. Grant push notification permissions when prompted
4. Tap "Register for Push Notifications"
5. Log in with test account
6. Navigate to Settings → "Enable Push Notifications" again

### Expected Results:
- [ ] Permission prompt appears
- [ ] "Success! You're registered for push notifications" alert appears
- [ ] Token saved to `push_tokens` table in Supabase
- [ ] On subsequent logins, token is updated (not duplicated)

### Verification Query (Supabase SQL Editor):
```sql
SELECT * FROM push_tokens WHERE user_id = '<YOUR_USER_ID>';
```

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Test Case 2: Rate Limiting (10 Notifications/Hour)

**Objective:** Verify rate limiting enforces max 10 push notifications per hour

### Steps:
1. Log in to the app
2. Navigate to Settings → "Test Push Notification"
3. Tap the button **10 times** (wait 2 seconds between taps)
4. Observe each alert message
5. Tap the button an **11th time**

### Expected Results:
- [ ] First 10 taps: "Test Notification Sent ✅" alert appears
- [ ] Each notification arrives on device within 5-10 seconds
- [ ] 11th tap: "Rate Limited ⏱️" alert appears
- [ ] 11th notification does NOT arrive on device
- [ ] Wait 1 hour, then tap again → notification is sent successfully

### Verification Query (Supabase SQL Editor):
```sql
-- Check delivery log count in last hour
SELECT COUNT(*) 
FROM push_delivery_log 
WHERE user_id = '<YOUR_USER_ID>' 
  AND sent_at >= (now() - INTERVAL '1 hour');
-- Should return 10 after 11th attempt
```

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Test Case 3: Quiet Hours Enforcement (10pm-8am)

**Objective:** Verify push notifications are deferred during quiet hours

### Steps:
1. Log in to the app
2. Set quiet hours for current time:
   - Open Supabase SQL Editor
   - Run:
   ```sql
   UPDATE notification_preferences
   SET quiet_hours_enabled = true,
       quiet_hours_start = '<CURRENT_HOUR>:00:00',
       quiet_hours_end = '<CURRENT_HOUR + 1>:00:00'
   WHERE user_id = '<YOUR_USER_ID>' 
     AND category = 'subscription';

   -- Verify row exists + values were updated
   SELECT user_id, category, quiet_hours_enabled, quiet_hours_start, quiet_hours_end
   FROM notification_preferences
   WHERE user_id = '<YOUR_USER_ID>'::uuid
     AND category = 'subscription';

   -- Verify server-side check returns true before pressing Test Push Notification
   -- (Use an explicit in-window local time to avoid false negatives)
   SELECT is_in_quiet_hours(
     '<YOUR_USER_ID>'::uuid,
     (
       SELECT (np.quiet_hours_start + INTERVAL '1 minute')::time
       FROM notification_preferences np
       WHERE np.user_id = '<YOUR_USER_ID>'::uuid
         AND np.category = 'subscription'
       LIMIT 1
     )
   ) AS should_be_true;
   ```
3. Navigate to Settings → "Test Push Notification"
4. Tap the button

### Expected Results:
- [ ] "Quiet Hours 🌙" alert appears
- [ ] No push notification is delivered to device
- [ ] Notification is deferred (can be sent later when quiet hours end)

### Verification Query (Supabase SQL Editor):
```sql
-- Check if notification was blocked due to quiet hours
SELECT * FROM push_delivery_log 
WHERE user_id = '<YOUR_USER_ID>' 
ORDER BY created_at DESC 
LIMIT 5;
-- Should NOT show recent delivery during quiet hours
```

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Test Case 4: Duplicate Notification Prevention (5-Minute Window)

**Objective:** Verify duplicate notifications within 5 minutes are blocked

### Steps:
1. Log in to the app
2. Disable quiet hours (if enabled from previous test):
   ```sql
   UPDATE notification_preferences
   SET quiet_hours_enabled = false
   WHERE user_id = '<YOUR_USER_ID>' AND category = 'subscription';
   ```
3. Clear rate limit by waiting 1+ hour OR run:
   ```sql
   DELETE FROM push_delivery_log WHERE user_id = '<YOUR_USER_ID>';
   ```
4. Navigate to Settings → "Test Push Notification"
5. Tap the button
6. Wait 2 seconds
7. Tap the button again (same fingerprint)

### Expected Results:
- [ ] First tap: "Test Notification Sent ✅" appears
- [ ] First notification arrives on device
- [ ] Second tap: "Test Notification Sent ✅" appears (but **duplicate is blocked internally**)
- [ ] Only **1 notification** arrives on device (not 2)

### Verification Query (Supabase SQL Editor):
```sql
-- Check deduplication table
SELECT * FROM notification_deduplication 
WHERE user_id = '<YOUR_USER_ID>' 
ORDER BY created_at DESC;
-- Should show fingerprint recorded

-- Check delivery log (should show only 1 delivery for same fingerprint)
SELECT COUNT(*) 
FROM push_delivery_log 
WHERE user_id = '<YOUR_USER_ID>' 
  AND sent_at >= (now() - INTERVAL '5 minutes');
```

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Test Case 5: Failed Delivery Retry Mechanism (Up to 3 Attempts)

**Objective:** Verify failed push deliveries are retried up to 3 times

### Steps:
1. Log in to the app
2. Simulate a delivery failure by creating a notification with an invalid token:
   - Open Supabase SQL Editor
   - Run:
   ```sql
   -- Create a test notification
   INSERT INTO user_notifications (user_id, category, type, title, body, channels, data)
   VALUES (
     '<YOUR_USER_ID>'::uuid,
     'system',
     'test_retry',
     'Retry Test',
     'Testing retry mechanism',
     ARRAY['push']::text[],
     '{}'::jsonb
   )
   RETURNING id;
   -- Note the notification ID
   
   -- Add to retry queue
   SELECT add_to_retry_queue(
     '<NOTIFICATION_ID>'::uuid,
     '<YOUR_USER_ID>'::uuid,
     'Simulated error - DeviceNotRegistered',
     '{"test": true}'::jsonb
   );
   ```
3. Wait 1 minute (first retry window)
4. Check retry queue status

### Expected Results:
- [ ] Notification appears in `notification_retry_queue` table
- [ ] `attempt_count` starts at 0
- [ ] `max_attempts` is 3
- [ ] `next_retry_at` is set to 1 minute from now
- [ ] After 1 minute, retry is attempted (attempt_count increments)
- [ ] After 3 failed attempts, notification is marked as permanently failed

### Verification Query (Supabase SQL Editor):
```sql
-- Check retry queue
SELECT * FROM notification_retry_queue 
WHERE user_id = '<YOUR_USER_ID>' 
ORDER BY created_at DESC;

-- Check pending retries view
SELECT * FROM v_pending_retries 
WHERE user_id = '<YOUR_USER_ID>';
```

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Test Case 6: Push Notification Receipts Tracking

**Objective:** Verify push notification receipts are tracked correctly

### Steps:
1. Log in to the app
2. Navigate to Settings → "Test Push Notification"
3. Tap the button (ensure not rate-limited)
4. Wait for notification to arrive
5. Check Supabase for receipt information

### Expected Results:
- [ ] Notification sent successfully
- [ ] `push_delivery_log` table contains entry with `expo_receipt_id`
- [ ] `receipt_status` is initially 'ok'
- [ ] If delivery fails, receipt contains error details

### Verification Query (Supabase SQL Editor):
```sql
SELECT 
  id,
  user_id,
  notification_id,
  sent_at,
  expo_receipt_id,
  receipt_status,
  receipt_message,
  retry_count
FROM push_delivery_log 
WHERE user_id = '<YOUR_USER_ID>' 
ORDER BY sent_at DESC 
LIMIT 10;
```

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Test Case 7: Critical Notifications Bypass Checks

**Objective:** Verify critical notifications bypass rate limits and quiet hours

### Steps:
1. Log in to the app
2. Set quiet hours to current time (from Test Case 3)
3. Trigger 10 notifications to exceed rate limit
4. Send a critical notification via Supabase SQL Editor:
   ```sql
   -- This simulates a payment failure notification (critical)
   -- In real implementation, critical flag must be set in service
   -- For testing, we verify the RPC allows bypass
   ```

### Expected Results:
- [ ] Critical notifications are sent even during quiet hours
- [ ] Critical notifications are sent even when rate limit exceeded
- [ ] Non-critical notifications are still blocked

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Test Case 8: Multiple Devices Support

**Objective:** Verify push notifications are sent to all user's devices

### Steps:
1. Log in to the same account on 2 different devices/emulators
2. Register push tokens on both
3. Navigate to Settings → "Test Push Notification" on Device 1
4. Tap the button
5. Observe both devices

### Expected Results:
- [ ] Both devices receive the push notification
- [ ] `push_tokens` table shows 2 entries for the user
- [ ] `push_delivery_log` shows 2 entries (one per device)

### Verification Query (Supabase SQL Editor):
```sql
-- Check all tokens for user
SELECT * FROM push_tokens 
WHERE user_id = '<YOUR_USER_ID>';

-- Check deliveries
SELECT * FROM push_delivery_log 
WHERE user_id = '<YOUR_USER_ID>' 
ORDER BY sent_at DESC 
LIMIT 5;
```

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Test Case 9: Cleanup Expired Deduplication Entries

**Objective:** Verify expired deduplication entries are cleaned up

### Steps:
1. Open Supabase SQL Editor
2. Create a deduplication entry that expires in the past:
   ```sql
   INSERT INTO notification_deduplication (user_id, notification_type, notification_fingerprint, expires_at)
   VALUES (
     '<YOUR_USER_ID>'::uuid,
     'test',
     'expired-fingerprint',
     now() - INTERVAL '10 minutes'
   );
   ```
3. Run cleanup function:
   ```sql
   SELECT cleanup_expired_deduplications();
   ```
4. Check if expired entry was deleted

### Expected Results:
- [ ] Function returns count of deleted entries (should be >= 1)
- [ ] Expired entry is removed from `notification_deduplication` table
- [ ] Active (non-expired) entries remain

### Verification Query (Supabase SQL Editor):
```sql
SELECT * FROM notification_deduplication 
WHERE user_id = '<YOUR_USER_ID>';
```

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Test Case 10: End-to-End Push Notification Flow

**Objective:** Verify complete push notification delivery flow works end-to-end

### Steps:
1. Log in to the app
2. Ensure no rate limits or quiet hours are active
3. Navigate to Settings → "Test Push Notification"
4. Tap the button
5. Observe notification arrival
6. Tap the notification to open the app
7. Verify deep link navigation works

### Expected Results:
- [ ] Alert confirms "Test Notification Sent ✅"
- [ ] Notification appears on device within 5-10 seconds
- [ ] Notification displays correct title and body
- [ ] Notification sound plays
- [ ] Tapping notification opens the app to Home screen
- [ ] All database tables updated correctly:
  - `push_delivery_log` has entry
  - `notification_deduplication` has fingerprint
  - No errors in `notification_retry_queue`

### Verification Query (Supabase SQL Editor):
```sql
-- Full audit of notification delivery
SELECT 
  pdl.sent_at,
  pdl.expo_receipt_id,
  pdl.receipt_status,
  pdl.retry_count,
  nd.notification_fingerprint,
  nd.expires_at
FROM push_delivery_log pdl
LEFT JOIN notification_deduplication nd 
  ON pdl.user_id = nd.user_id 
  AND pdl.sent_at >= nd.created_at 
  AND pdl.sent_at <= nd.expires_at
WHERE pdl.user_id = '<YOUR_USER_ID>'
ORDER BY pdl.sent_at DESC
LIMIT 1;
```

**Actual Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

## Summary

**Total Test Cases:** 10  
**Passed:** _____ / 10  
**Failed:** _____ / 10

**Critical Issues Found:**

**Notes/Observations:**

**Recommendation:** ☐ READY FOR PRODUCTION  ☐ NEEDS FIXES

**Tester Signature:** _______________  
**Date:** _______________
