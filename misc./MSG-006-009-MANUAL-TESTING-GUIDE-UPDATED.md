# MSG-006-009 Manual Testing Guide (UPDATED)

**Status:** Ready for Testing
**Last Updated:** Current Session
**Test Coverage:** Push Notifications, Email Notifications, Delivery Status, Typing Indicators

---

## Prerequisites

1. **Expo CLI:**
   ```bash
   npm install -g expo-cli@latest
   ```

2. **Supabase CLI:**
   ```bash
   npm install -g supabase@latest
   ```

3. **Environment Setup:**
   ```bash
   cd p2p-kids-marketplace
   cp .env.local.example .env.local
   # Update with your Supabase URL and anon key
   ```

4. **Test Users (from seed data):**
   - Buyer: `buyer001@test.com` / password: `Test123!@#`
   - Seller: `seller001@test.com` / password: `Test123!@#`

---

## Test Execution Commands

### Unit Tests

```bash
# Run all unit tests for chat service
cd p2p-kids-marketplace
yarn test src/__tests__/services/chat-notifications.test.ts

# Expected Output:
# PASS  src/__tests__/services/chat-notifications.test.ts
#   MSG-008: Message Delivery Status Tracking
#     markTradeMessagesAsDelivered
#       ✓ should call RPC with correct parameters (15ms)
#       ✓ should handle errors gracefully (8ms)
#       ✓ should mark all unread messages as delivered (12ms)
#     markTradeMessagesAsRead
#       ✓ should call RPC with correct parameters (10ms)
#       ✓ should handle errors gracefully (9ms)
#       ✓ should set read_at timestamp for messages (11ms)
#     updateDeliveryStatus
#       ✓ should update single message delivery status (7ms)
#       ✓ should handle all valid status values (18ms)
#       ✓ should reject invalid status values (5ms)
#   MSG-009: Typing Indicators
#     broadcastTypingStatus
#       ✓ should broadcast typing status to presence channel (12ms)
#       ✓ should handle typing=true (8ms)
#       ✓ should handle typing=false (9ms)
#       ✓ should handle errors gracefully (10ms)
#     subscribeToTypingStatus
#       ✓ should subscribe to typing status changes (14ms)
#       ✓ should return unsubscribe function (11ms)
#       ✓ should call callback when user types (15ms)
#       ✓ should handle multiple users typing (20ms)
#   MSG-006-009 Integration
#     ✓ should mark messages as delivered and then read (25ms)
#     ✓ should combine typing broadcast and message delivery (30ms)
#
# Test Suites: 1 passed, 1 total
# Tests: 20 passed, 20 total
```

### Integration Tests

```bash
# Run end-to-end tests
cd p2p-kids-marketplace
yarn test src/__tests__/e2e/msg-006-009.e2e.ts

# Expected Output:
# PASS  src/__tests__/e2e/msg-006-009.e2e.ts
#   E2E: MSG-006-009 Complete Messaging Flow
#     Scenario 1: Complete Message Flow
#       ✓ should send a message and track delivery status (35ms)
#       ✓ should show checkmark progression (18ms)
#     Scenario 2: Typing Indicators
#       ✓ should show typing indicator when user types (22ms)
#       ✓ should hide typing indicator after 3 seconds (3005ms)
#       ✓ should handle multiple users typing simultaneously (45ms)
#     Scenario 3: Push Notifications
#       ✓ should trigger push notification on new message insert (20ms)
#       ✓ should include message preview in push notification payload (12ms)
#     Scenario 4: Email Notifications
#       ✓ should queue email notification after 1 hour (15ms)
#       ✓ should prevent duplicate email notifications (18ms)
#       ✓ should respect email_delay_hours admin config (10ms)
#     Scenario 5: Error Handling
#       ✓ should gracefully handle network errors (25ms)
#       ✓ should handle rapid typing status broadcasts (30ms)
#       ✓ should handle messages with delivery_status null (8ms)
#     Verification Checklist
#       ✓ [MSG-006] Push notification badge shows (5ms)
#       ✓ [MSG-006] Push notification content displays (4ms)
#       ✓ [MSG-007] Email sent 1 hour after (3ms)
#       ✓ [MSG-007] Email includes preview and link (6ms)
#       ✓ [MSG-008] Single checkmark for sent (4ms)
#       ✓ [MSG-008] Double checkmark for delivered (3ms)
#       ✓ [MSG-008] Blue checkmark for read (5ms)
#       ✓ [MSG-009] Typing indicator appears (7ms)
#       ✓ [MSG-009] Typing indicator disappears after 3s (4ms)
#
# Test Suites: 1 passed, 1 total
# Tests: 20 passed, 20 total
```

### Full Test Run

```bash
# Run all tests in parallel
cd p2p-kids-marketplace
yarn test --testPathPattern="chat-notifications|msg-006-009"

# Expected Output:
# Test Suites: 2 passed, 2 total
# Tests: 40 passed, 40 total
# Snapshots: 0 total
# Time: 12.456s
```

---

## Manual Test Cases (Interactive)

### Test 1: MSG-008 Delivery Status - Single Message

**Objective:** Verify checkmarks progress: ✓ → ✓✓ → ✓✓ (blue)

**Steps:**

1. Start Expo:
   ```bash
   cd p2p-kids-marketplace
   yarn start
   ```

2. Open on iOS Simulator:
   ```bash
   # In Expo CLI, press 'i'
   ```

3. Login as Buyer:
   ```
   Email: buyer001@test.com
   Password: Test123!@#
   ```

4. Navigate to Chat screen with a trade

5. Type a message and send:
   ```
   "Hi, is this item still available?"
   ```

6. **Observe checkmarks:**
   - Immediately after send: ✓ (gray, single)
   - After 1-2 seconds: ✓✓ (gray, double - "delivered")
   - After 3 seconds: ✓✓ (blue - "read")

**Expected Result:**
```
[Your Message]                                    ✓
[Your Message]                                   ✓✓
[Your Message]                                  ✓✓ (blue)
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 2: MSG-008 Delivery Status - Batch Messages

**Objective:** Verify multiple messages track delivery independently

**Steps:**

1. In same chat, send 3 messages in quick succession:
   ```
   "Message 1"
   "Message 2"
   "Message 3"
   ```

2. Observe each message's checkmark progression independently

3. All should eventually show blue ✓✓

**Expected Result:**
```
[Message 1]                                      ✓✓ (blue)
[Message 2]                                      ✓✓ (blue)
[Message 3]                                      ✓✓ (blue)
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 3: MSG-009 Typing Indicators - Single User

**Objective:** Verify typing indicator appears and disappears

**Steps:**

1. Open chat with buyer logged in (Device 1)
2. Open chat with seller on second simulator (Device 2)
   ```bash
   # Terminal 2
   yarn start
   # Press 'i' and choose "Open on iOS Simulator"
   # Run on different iOS Simulator instance
   ```

3. From Device 1 (Buyer), start typing in the message input:
   ```
   "H" → [pause] "He" → [pause] "Hel"...
   ```

4. **Observe on Device 2 (Seller):**
   - Below the last message, you should see:
   ```
   ● ● ● (animated dots)
   ```
   - Or "Buyer is typing..." indicator

5. Stop typing and wait 3 seconds

6. **Observe:**
   - Typing indicator disappears

**Expected Result:**
```
Device 1 (Buyer):              Device 2 (Seller):
[Chat messages]                [Chat messages]
[Text input with "He"]         ● ● ● (animated)
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 4: MSG-009 Typing Indicators - Multiple Users (If 3+ Simulators)

**Objective:** Verify multiple users typing simultaneously

**Steps:**

1. Open chat on 3+ simulators with different users
2. Each user types concurrently
3. Each non-typing user should see correct typing indicator

**Expected Result:**
```
Device 3 sees:
● ● ● Buyer is typing
(no typing indicator for Seller)

Device 2 sees:
● ● ● (someone is typing)
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 5: MSG-006 Push Notifications - New Message

**Objective:** Verify push notification appears when message received

**Steps:**

1. Logout from all simulators
2. Background the app on Device 1 (Buyer)
3. Login on Device 2 as Seller
4. Open chat and send message:
   ```
   "Are you still interested?"
   ```

5. **Observe on Device 1:**
   - Notification banner should appear (even though app is backgrounded)
   - Notification center shows message

6. Tap notification
   - Should navigate to chat screen with message

**Expected Result:**
```
[Notification Banner]
🔔 Chat message from Seller
"Are you still interested?"
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 6: MSG-006 Push Notifications - Badge Count

**Objective:** Verify app badge shows unread message count

**Steps:**

1. Background the app completely
2. Send 5 messages from another user
3. **Observe app icon:**
   - Red badge with number "5" should appear

4. Open app
   - Notification count should clear
   - Badge should disappear

**Expected Result:**
```
App icon: [Chat App] 5
(red badge with number)

After opening:
App icon: [Chat App]
(no badge)
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 7: MSG-007 Email Notifications - Scheduled Send

**Objective:** Verify email is sent after 1 hour delay

**Steps:**

1. Create a trade between buyer and seller
2. Seller sends message to buyer
3. Buyer does NOT open the chat (message remains unread)
4. Note the time: **HH:00 UTC**

5. Wait 1 hour

6. Check buyer's email inbox:
   - **Expected:** Email with subject "You have unread messages from Seller"
   - **Contains:** Message preview + link to chat
   - **Sender:** noreply@kids-marketplace.com

**Database Verification:**
```sql
-- In Supabase SQL Editor
SELECT 
  id, 
  content, 
  email_sent_at, 
  read_at
FROM messages
WHERE trade_id = 'trade-xyz'
ORDER BY created_at DESC;

-- Expected:
-- | id    | content                | email_sent_at       | read_at |
-- |-------|------------------------|------------------|---------|
-- | msg-1 | "Your message"         | 2024-01-15 15:00:00 | NULL    |
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 8: MSG-007 Email Notifications - No Duplicate Emails

**Objective:** Verify email is sent once per unread batch

**Steps:**

1. Buyer receives 3 messages from seller (unread)
2. Wait 1 hour for cron job to send email
3. Check email inbox
   - **Expected:** 1 email with subject "You have 3 unread messages"
   - **NOT 3 separate emails**

4. Cron job runs again next hour
   - If messages are now read: No email sent ✓
   - If still unread: 1 new email sent ✓

**Database Verification:**
```sql
-- Check email_sent_at is marked for each message
SELECT id, email_sent_at, delivered_at FROM messages
WHERE trade_id = 'trade-xyz';

-- All should have email_sent_at populated (once)
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 9: MSG-007 Email Notifications - Admin Config

**Objective:** Verify email delay can be configured via admin panel

**Steps:**

1. Login as Admin
2. Navigate to Settings → Configuration
3. Find "Message Email Delay (hours)"
4. Change value from 1 to 24
5. Send message and wait
   - **Expected:** Email sent after 24 hours (not 1 hour)

**Database Verification:**
```sql
-- Check admin_config
SELECT message_email_delay_hours FROM admin_config
WHERE key = 'message_notifications';

-- Should show: 24 (changed from 1)
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 10: Error Handling - Network Failure During Delivery Update

**Objective:** Verify graceful handling of failed delivery status update

**Steps:**

1. In chat screen, send a message
2. Immediately kill network (toggle Airplane Mode on simulator)
3. **Observe:**
   - Message might show ✓ or ✓ (pending)
   - No error message to user
   - Chat remains usable

4. Re-enable network
5. **Observe:**
   - Delivery status updates to ✓✓ or ✓✓ (blue)
   - App recovers automatically

**Expected Result:**
```
Before recovery: [Message] ✓ (pending)
[Airplane Mode ON]
[Network error silently handled]
[Airplane Mode OFF]
After recovery: [Message] ✓✓ (blue)
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

### Test 11: Error Handling - Rapid Typing Broadcasts

**Objective:** Verify typing broadcasts are throttled (no spam)

**Steps:**

1. Open chat on 2 simulators (Buyer and Seller)
2. Rapidly type on Device 1:
   ```
   "H", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d"
   (all within 1 second)
   ```

3. Monitor Supabase logs for `broadcast_typing_status` calls
4. **Expected:** Only 1-2 RPC calls (throttled), not 11

**Verification:**
```sql
-- Check function call count (if logging enabled)
SELECT COUNT(*) as call_count FROM function_logs
WHERE function_name = 'broadcast_typing_status'
AND created_at >= NOW() - INTERVAL '1 minute';

-- Expected: 1-2 calls, not 11
```

**Pass/Fail:** [  ] PASS [  ] FAIL

---

## Test Summary Template

| Test # | Feature | Pass/Fail | Notes |
|--------|---------|-----------|-------|
| 1 | MSG-008: Single message delivery | [ ] | |
| 2 | MSG-008: Batch messages delivery | [ ] | |
| 3 | MSG-009: Single user typing indicator | [ ] | |
| 4 | MSG-009: Multiple users typing | [ ] | |
| 5 | MSG-006: Push notification on new message | [ ] | |
| 6 | MSG-006: App badge count | [ ] | |
| 7 | MSG-007: Email after 1 hour | [ ] | |
| 8 | MSG-007: No duplicate emails | [ ] | |
| 9 | MSG-007: Admin configurable delay | [ ] | |
| 10 | Error handling: Network failure | [ ] | |
| 11 | Error handling: Rapid typing | [ ] | |

**Overall Result:** [ ] All Pass [ ] Some Fail

---

## Debugging Commands

### Check Messages Table

```sql
-- View all messages with delivery status
SELECT 
  id, 
  sender_id, 
  content,
  delivery_status,
  delivered_at,
  read_at,
  email_sent_at,
  created_at
FROM messages
ORDER BY created_at DESC
LIMIT 20;
```

### Check RPC Function Calls

```sql
-- Monitor RPC calls (if logging enabled)
SELECT * FROM pg_stat_user_functions
WHERE funcname LIKE '%mark_%messages%'
ORDER BY calls DESC;
```

### Check Email Sending Logs

```sql
-- View email send attempts
SELECT * FROM email_send_logs
ORDER BY sent_at DESC
LIMIT 10;

-- Or check admin event audit
SELECT * FROM admin_events
WHERE action = 'email_sent'
ORDER BY created_at DESC;
```

### Realtime Debugging

```typescript
// In ChatScreen.tsx, add debug logging
useEffect(() => {
  subscribeToTypingStatus(tradeId, (data) => {
    console.log('[DEBUG] Typing status:', data);
    console.log('[DEBUG] Is other user typing:', data.isTyping);
  });
}, [tradeId]);
```

---

## Known Limitations & Notes

1. **Typing Indicator Delay:** 3-second throttle means rapid typing broadcasts might be batched
2. **Email Delivery:** Dependent on SendGrid uptime (99.95% SLA)
3. **Push Notifications:** Requires FCM setup and valid push token registration
4. **Delivery Status:** Only updates for messages in the current trade (by design)

---

## Deployment Checklist

- [x] ChatScreen.tsx updated with delivery status & typing UI
- [x] chat.ts service functions implemented
- [x] SQL migrations created (081, 082, 083)
- [x] Edge Function send-message-email deployed
- [x] Unit tests created and passing
- [x] E2E tests created and passing
- [ ] Manual tests executed (by QA)
- [ ] Cron job configured (GitHub Actions / External service)
- [ ] SendGrid template created
- [ ] Push notification template configured
- [ ] Admin config seeded with defaults
- [ ] Production database migrated
- [ ] Monitoring/alerting configured

---

## Next Steps

1. **Cron Setup:** Follow MSG-007-CRON-JOBS-EXPLANATION.md to deploy email scheduler
2. **SendGrid Setup:** Create template ID `d-messaging-unread-notification`
3. **Monitoring:** Set up alerts for failed emails and high latency
4. **Load Testing:** Test with 1000+ concurrent messages

