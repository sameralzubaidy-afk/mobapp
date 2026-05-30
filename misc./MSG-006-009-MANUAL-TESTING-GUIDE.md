# MODULE-07 MSG-006 through MSG-009: Manual Testing Guide

## Overview

This guide covers manual testing for:
- **MSG-006**: Push Notifications for New Messages
- **MSG-007**: Email Notifications for Unread Messages  
- **MSG-008**: Message Delivery Status Tracking
- **MSG-009**: Typing Indicators

**Prerequisites:**
1. Run all 3 SQL migrations in Supabase SQL Editor (in order)
2. Deploy new Edge Function: `send-message-email`
3. Verify push notification setup (Expo tokens registered)
4. Configure SendGrid template for unread message emails

---

## Test Setup

### Pre-Test Database Setup

Run these SQL migrations in Supabase SQL Editor:

```sql
-- Step 1: Run migration 081 (Push notifications trigger)
\i supabase/migrations/081_message_notifications_trigger.sql

-- Step 2: Run migration 082 (Email tracking)
\i supabase/migrations/082_message_email_notifications.sql

-- Step 3: Run migration 083 (Delivery status)
\i supabase/migrations/083_message_delivery_status.sql
```

### Verification Queries

After running migrations, verify setup:

```sql
-- Verify push notification trigger
SELECT tgname, tgenabled FROM pg_trigger 
WHERE tgname = 'on_message_insert_notify';
-- Expected: 1 row, tgenabled = 'O' (enabled)

-- Verify email columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'messages' AND column_name = 'email_sent_at';
-- Expected: 1 row

-- Verify delivery status enum
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'message_delivery_status'::regtype 
ORDER BY enumsortorder;
-- Expected: 3 rows (sent, delivered, read)

-- Verify delivery status columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('delivery_status', 'delivered_at', 'read_at');
-- Expected: 3 rows
```

---

## MSG-006: Push Notifications for New Messages

### Test Case 1: Send Message → Push Notification Delivered

**Objective:** Verify push notification sent when user receives new message

**Prerequisites:**
- 2 test users (User A = sender, User B = recipient)
- Both users have registered push tokens
- User B's app is in background or closed

**Steps:**

1. **Setup:**
   ```sql
   -- Get test users' push tokens
   SELECT user_id, token FROM push_tokens 
   WHERE user_id IN ('<user_a_id>', '<user_b_id>');
   ```

2. **Execute:**
   - User A opens chat for a trade
   - User A types message: "Hey, is this item still available?"
   - User A sends message
   - Close User A's app

3. **Verify:**
   - Check Supabase Edge Function logs:
     ```
     SELECT * FROM edge_logs 
     WHERE function_name = 'send-push-notification'
     ORDER BY created_at DESC LIMIT 1;
     ```
   - Verify push notification appears on User B's device
   - Notification title: "New message from [User A Name]"
   - Notification body: "Hey, is this item still available?"

4. **Tap Notification:**
   - Tap notification on User B's device
   - App opens directly to chat screen for the trade
   - Chat displays the new message

**Expected Result:** ✅ Push notification delivered and deep link works

---

### Test Case 2: Multiple Messages → Multiple Notifications

**Objective:** Verify separate notifications for multiple messages

**Steps:**

1. User A sends 3 messages in quick succession:
   - "Hello"
   - "Are you there?"
   - "Please respond"

2. **Verify:**
   - User B receives 3 separate push notifications
   - Each notification shows correct sender and message preview

**Expected Result:** ✅ Each message triggers individual notification

---

### Test Case 3: No Push Token → Graceful Failure

**Objective:** Verify system handles missing push token

**Steps:**

1. Remove User B's push token:
   ```sql
   DELETE FROM push_tokens WHERE user_id = '<user_b_id>';
   ```

2. User A sends message to User B

3. **Verify:**
   - Message still saves successfully
   - No error shown to User A
   - Check Edge Function logs for warning:
     ```
     "No active push tokens for user"
     ```

**Expected Result:** ✅ Message delivered, no crash, warning logged

---

## MSG-007: Email Notifications for Unread Messages

### Test Case 4: Unread Message → Email After 1 Hour

**Objective:** Verify email sent after configured delay

**Prerequisites:**
- User A sends message to User B
- User B does NOT open the app

**Steps:**

1. **Setup:**
   ```sql
   -- Verify email config
   SELECT key, value FROM admin_config 
   WHERE key IN ('message_email_delay_hours', 'message_email_enabled');
   -- Expected: delay_hours = '1', enabled = 'true'
   ```

2. **Send Test Message:**
   - User A sends message: "Can we meet tomorrow?"
   - Note the timestamp
   - User B does NOT open app

3. **Wait 1 Hour** (or adjust message created_at for faster testing):
   ```sql
   -- Fast-forward for testing (use with caution in prod)
   UPDATE messages 
   SET created_at = created_at - INTERVAL '2 hours'
   WHERE id = '<message_id>';
   ```

4. **Trigger Email Job:**
   - Manually trigger Edge Function:
     ```bash
     curl -X POST \
       'https://[your-project].supabase.co/functions/v1/send-message-email' \
       -H 'Authorization: Bearer [SERVICE_ROLE_KEY]' \
       -H 'Content-Type: application/json' \
       -d '{"limit": 10}'
     ```

5. **Verify:**
   - Check function response:
     ```json
     {
       "success": true,
       "sent": 1,
       "failed": 0,
       "errors": [],
       "total": 1
     }
     ```
   - Check User B's email inbox
   - Email subject: "New message from [User A]"
   - Email body includes message preview
   - Click "View Chat" link → Opens app to trade chat

6. **Verify Database:**
   ```sql
   SELECT email_sent_at FROM messages WHERE id = '<message_id>';
   -- Expected: timestamp populated
   ```

**Expected Result:** ✅ Email delivered after 1 hour, email_sent_at updated

---

### Test Case 5: Message Read → No Email Sent

**Objective:** Verify email NOT sent if user already read message

**Steps:**

1. User A sends message to User B
2. User B opens app within 1 hour and reads message
3. Wait 2 hours
4. Trigger email job

5. **Verify:**
   ```sql
   SELECT id, email_sent_at FROM messages WHERE id = '<message_id>';
   -- Expected: email_sent_at IS NULL (because user already read it)
   ```
   - Email job returns: `"sent": 0`
   - No email delivered to User B

**Expected Result:** ✅ No email sent for already-read messages

---

### Test Case 6: Email Disabled → No Emails Sent

**Objective:** Verify admin can disable email notifications

**Steps:**

1. Disable email notifications:
   ```sql
   UPDATE admin_config 
   SET value = 'false' 
   WHERE key = 'message_email_enabled';
   ```

2. Create unread message older than 1 hour
3. Trigger email job

4. **Verify:**
   - Function logs: "Email notifications disabled"
   - Response: `"sent": 0`
   - No emails delivered

5. **Re-enable:**
   ```sql
   UPDATE admin_config 
   SET value = 'true' 
   WHERE key = 'message_email_enabled';
   ```

**Expected Result:** ✅ Email notifications respect admin config

---

## MSG-008: Message Delivery Status Tracking

### Test Case 7: Message Sent → Status = 'sent'

**Objective:** Verify new messages default to 'sent' status

**Steps:**

1. User A sends message to User B

2. **Verify:**
   ```sql
   SELECT id, delivery_status, delivered_at, read_at 
   FROM messages 
   WHERE id = '<message_id>';
   ```
   - Expected:
     - delivery_status = 'sent'
     - delivered_at = NULL
     - read_at = NULL

**Expected Result:** ✅ New message has 'sent' status

---

### Test Case 8: Chat Opened → Status = 'delivered'

**Objective:** Verify status changes to 'delivered' when recipient opens chat

**Prerequisites:**
- User A sent message to User B
- User B has NOT opened chat yet

**Steps:**

1. User B opens the chat screen for the trade

2. **Verify:**
   ```sql
   SELECT id, delivery_status, delivered_at 
   FROM messages 
   WHERE id = '<message_id>' AND sender_id = '<user_a_id>';
   ```
   - Expected:
     - delivery_status = 'delivered'
     - delivered_at = (timestamp populated)

3. **Check UI:**
   - User A's chat screen shows double checkmark (✓✓) next to message

**Expected Result:** ✅ Message marked as delivered when chat opened

---

### Test Case 9: Message Viewed → Status = 'read'

**Objective:** Verify status changes to 'read' when recipient actively views message

**Steps:**

1. User B views chat for 3+ seconds (chat is in foreground)

2. **Verify:**
   ```sql
   SELECT id, delivery_status, delivered_at, read_at 
   FROM messages 
   WHERE id = '<message_id>';
   ```
   - Expected:
     - delivery_status = 'read'
     - delivered_at = (timestamp)
     - read_at = (timestamp)

3. **Check UI:**
   - User A's chat shows blue double checkmark (✓✓) or "Read" indicator

**Expected Result:** ✅ Message marked as read when actively viewed

---

### Test Case 10: Delivery Status UI Indicators

**Objective:** Verify UI shows correct status icons

**Steps:**

1. User A sends 3 messages:
   - Message 1: User B hasn't opened chat yet
   - Message 2: User B opened chat but hasn't viewed yet
   - Message 3: User B viewed

2. **Verify UI (User A's perspective):**
   - Message 1: Single checkmark (✓) - sent
   - Message 2: Double checkmark (✓✓) - delivered
   - Message 3: Blue double checkmark (✓✓) or "Read" - read

**Expected Result:** ✅ Status indicators match message state

---

## MSG-009: Typing Indicators

### Test Case 11: User Typing → Indicator Shows

**Objective:** Verify "User is typing..." appears when other user types

**Prerequisites:**
- User A and User B both in same chat screen

**Steps:**

1. User A starts typing (any character input)

2. **Verify (User B's screen):**
   - Within 1 second, typing indicator appears:
     - Text: "[User A Name] is typing..."
     - Location: Below chat header or above input box
     - Animation: Animated dots or pulsing text

3. User A stops typing (no input for 3 seconds)

4. **Verify:**
   - Typing indicator disappears after 3 seconds of inactivity

**Expected Result:** ✅ Typing indicator shows and hides correctly

---

### Test Case 12: Multiple Users Typing (Future: Group Chat)

**Objective:** Verify typing indicator handles multiple users

**Steps:**

1. User A and User C both type at same time in trade chat

2. **Verify (User B's screen):**
   - Indicator shows: "Multiple people are typing..."
   - OR: "[User A] and [User C] are typing..."

**Expected Result:** ✅ Multiple typers handled gracefully

**Note:** This is future-proof for group chat feature

---

### Test Case 13: Typing Indicator Performance

**Objective:** Verify typing updates don't cause lag

**Steps:**

1. User A types rapidly (fast typing)

2. **Verify:**
   - No lag in User A's input
   - User B sees indicator with max 500ms delay
   - No excessive Realtime bandwidth usage

3. Check Realtime connection:
   ```javascript
   console.log(channel.presenceState());
   // Should show recent typing status
   ```

**Expected Result:** ✅ Typing updates are smooth and performant

---

## Integration Tests (Cross-Feature)

### Test Case 14: Full Message Flow

**Objective:** Test complete message lifecycle

**Steps:**

1. User A sends message → Status: sent (✓)
2. Push notification sent to User B
3. User B opens app → Status: delivered (✓✓)
4. User B views chat → Status: read (blue ✓✓)
5. User B types response → Typing indicator shows for User A
6. User B sends response → Push sent to User A
7. Wait 1 hour → Email sent to User A (if not read)

**Expected Result:** ✅ All features work together seamlessly

---

### Test Case 15: Offline/Online Transition

**Objective:** Verify features work across connectivity changes

**Steps:**

1. User A sends message while User B is offline
2. User B comes online → Message delivered, status updates
3. Push notification catchup (if supported by OS)

**Expected Result:** ✅ Messages sync correctly when back online

---

## Performance & Edge Cases

### Test Case 16: High Message Volume

**Objective:** Verify system handles rapid message sending

**Steps:**

1. User A sends 50 messages in 1 minute
2. **Verify:**
   - All messages delivered
   - All notifications sent (may be batched by OS)
   - Delivery status tracked correctly
   - No database deadlocks

**Expected Result:** ✅ System handles burst traffic

---

### Test Case 17: Error Handling

**Objective:** Verify graceful failure modes

**Test Scenarios:**

1. **No internet:**
   - User A sends message → Queued locally
   - Message sends when back online

2. **Push notification fails:**
   - Message still delivered
   - User sees message when opens app

3. **Email service down:**
   - Email job logs error
   - Doesn't block other operations
   - Retries on next run

**Expected Result:** ✅ Failures don't block core messaging

---

## Rollback Testing

### Test Case 18: Disable Features

**Objective:** Verify features can be safely disabled

**Steps:**

1. **Disable push notifications:**
   ```sql
   DROP TRIGGER on_message_insert_notify ON messages;
   ```
   - Verify: Messages still work, no notifications

2. **Disable email notifications:**
   ```sql
   UPDATE admin_config SET value = 'false' 
   WHERE key = 'message_email_enabled';
   ```
   - Verify: No emails sent

3. **Re-enable:**
   ```sql
   -- Re-run migration 081 to recreate trigger
   ```

**Expected Result:** ✅ Features can be toggled without breaking chat

---

## Summary Checklist

Before marking tasks complete, verify:

- [ ] **MSG-006**: Push notifications delivered for new messages
- [ ] **MSG-006**: Deep links open correct chat screen
- [ ] **MSG-007**: Email notifications sent after configured delay
- [ ] **MSG-007**: Emails not sent for already-read messages
- [ ] **MSG-008**: Delivery status progresses (sent → delivered → read)
- [ ] **MSG-008**: Status icons display correctly in UI
- [ ] **MSG-009**: Typing indicators show/hide correctly
- [ ] **MSG-009**: Typing updates are smooth (no lag)
- [ ] All migrations run successfully
- [ ] Edge Function deployed and working
- [ ] Admin config values set correctly
- [ ] Error scenarios handled gracefully

---

## Troubleshooting

### Push Notifications Not Working

1. Check push token registered:
   ```sql
   SELECT * FROM push_tokens WHERE user_id = '<user_id>';
   ```

2. Check Edge Function logs:
   ```sql
   SELECT * FROM edge_logs 
   WHERE function_name = 'send-push-notification'
   ORDER BY created_at DESC LIMIT 10;
   ```

3. Verify trigger enabled:
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger 
   WHERE tgname = 'on_message_insert_notify';
   ```

### Emails Not Sending

1. Check admin config:
   ```sql
   SELECT * FROM admin_config 
   WHERE key IN ('message_email_enabled', 'message_email_delay_hours');
   ```

2. Check SendGrid API key configured:
   ```bash
   # In Supabase Edge Function settings
   echo $SENDGRID_API_KEY
   ```

3. Check function logs for errors

### Delivery Status Not Updating

1. Verify RPC functions exist:
   ```sql
   SELECT proname FROM pg_proc 
   WHERE proname LIKE '%message%status%';
   ```

2. Check RLS policies allow updates:
   ```sql
   SELECT policyname FROM pg_policies 
   WHERE tablename = 'messages';
   ```

### Typing Indicators Not Showing

1. Check Realtime enabled in Supabase dashboard
2. Verify presence subscription in app logs
3. Check channel state:
   ```javascript
   console.log(channel.presenceState());
   ```

---

## Next Steps After Testing

1. **Create unit tests** for all new functions
2. **Create E2E tests** for critical flows
3. **Update navigation** if needed for deep links
4. **Document admin config** for email settings
5. **Create SendGrid email template** for unread messages

---

**Testing Complete!** 

Report any failures with:
- Test case number
- Expected vs actual result
- Error messages
- Screenshots/logs

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-08  
**Module:** MODULE-07 MSG-006, MSG-007, MSG-008, MSG-009
