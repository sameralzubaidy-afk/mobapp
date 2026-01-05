# MODULE-07 MSG-001: Real-time Chat - Manual Testing Guide

**Status:** Implementation Complete ✅  
**Module:** MODULE-07-MESSAGING  
**Task:** MSG-001 - Implement Supabase Realtime Chat (Text Messages)  
**Date:** January 3, 2026

---

## Pre-Requisites

### 1. Database Migration
**REQUIRED:** Run this SQL in Supabase SQL Editor BEFORE testing

```bash
# Navigate to Supabase Dashboard → SQL Editor
# Copy and paste the entire contents of:
supabase/migrations/080_messages_table.sql

# Click "Run" to execute
```

**Expected Result:**
- ✅ Table `messages` created
- ✅ Indexes created
- ✅ RLS policies enabled
- ✅ Trigger created for `updated_at`

**Verification Query:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'messages';
-- Expected: 1 row returned
```

### 2. Test Data Setup
You need at least:
- 2 test users (buyer and seller)
- 1 active trade between them

**Quick Test Data SQL:**
```sql
-- Check if you have test trades
SELECT id, buyer_id, seller_id, status FROM trades WHERE status = 'in_progress' LIMIT 5;

-- If you need to create a test trade, use the app to initiate a trade first
```

---

## Test Cases

### Test Case 1: Load Chat Screen

**Objective:** Verify ChatScreen loads without errors

**Steps:**
1. Open the app
2. Navigate to a trade detail screen (with trade_id)
3. Tap "Message Seller" or "Message Buyer" button (if implemented)
4. OR manually navigate to Chat screen with a valid trade_id

**Expected Results:**
- ✅ Chat screen opens
- ✅ Loading indicator appears briefly
- ✅ Message list loads (empty or with existing messages)
- ✅ Input field appears at bottom
- ✅ "Send" button appears
- ✅ No console errors

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 2: Send Text Message (Buyer)

**Objective:** Buyer sends a message and sees it appear

**Pre-conditions:**
- Logged in as buyer
- Chat screen open for a trade

**Steps:**
1. Type "Hello from buyer" in the input field
2. Tap "Send" button
3. Observe the message list

**Expected Results:**
- ✅ Input field clears immediately
- ✅ Message appears in the chat (right-aligned, blue bubble)
- ✅ Timestamp displays below the message
- ✅ No sender name shown (own message)
- ✅ Message saved to database
- ✅ Send button re-enables

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 3: Receive Message (Real-time)

**Objective:** Seller receives buyer's message in real-time

**Pre-conditions:**
- 2 devices OR 2 browser tabs
- Device A: Logged in as buyer, chat screen open
- Device B: Logged in as seller, chat screen open for the SAME trade

**Steps:**
1. On Device A (buyer): Type "Testing real-time" and send
2. On Device B (seller): Observe the rmessage list

**Expected Results:**
- ✅ Message appears on Device B within 1-2 seconds
- ✅ Message left-aligned (white bubble with border)
- ✅ Sender name "Buyer Name" displayed above message
- ✅ Timestamp displays below message
- ✅ No page refresh needed

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 4: Auto-Scroll to Bottom

**Objective:** New messages trigger auto-scroll

**Pre-conditions:**
- Chat screen open with multiple messages

**Steps:**
1. Scroll up to view older messages
2. Send a new message from the same device

**Expected Results:**
- ✅ Screen auto-scrolls to bottom
- ✅ New message visible immediately
- ✅ Smooth scroll animation (not jarring)

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 5: Message Character Limit

**Objective:** Enforce 2000 character limit

**Steps:**
1. Type a message with exactly 2000 characters
2. Tap "Send"
3. Observe result
4. Type a message with 2001 characters
5. Tap "Send"

**Expected Results (2000 chars):**
- ✅ Message sends successfully
- ✅ No error displayed

**Expected Results (2001 chars):**
- ✅ Input field truncates at 2000 chars
- ✅ Cannot type beyond 2000 chars

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 6: Empty Message Validation

**Objective:** Prevent sending empty messages

**Steps:**
1. Leave input field empty
2. Attempt to tap "Send" button
3. Type only spaces ("   ")
4. Attempt to tap "Send" button

**Expected Results:**
- ✅ "Send" button is disabled (grayed out)
- ✅ No message sent to database
- ✅ No error displayed

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 7: Sending Indicator

**Objective:** Show loading state while sending

**Steps:**
1. Type a message
2. Tap "Send"
3. Observe the "Send" button

**Expected Results:**
- ✅ "Send" button shows loading spinner briefly
- ✅ Button disabled during send
- ✅ Button re-enables after send completes

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 8: Message History Persistence

**Objective:** Messages persist across app restarts

**Steps:**
1. Send 3 messages
2. Close the app completely
3. Reopen the app
4. Navigate back to the same chat

**Expected Results:**
- ✅ All 3 messages still visible
- ✅ Messages in correct chronological order
- ✅ Timestamps unchanged

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 9: RLS Policy - Unauthorized Access

**Objective:** Non-trade participants cannot view messages

**Pre-conditions:**
- Trade between User A and User B
- User C (not involved in the trade)

**Steps:**
1. Log in as User C
2. Attempt to navigate to the trade's chat screen (if possible)
3. OR query messages table directly via SQL

**Expected Results:**
- ✅ User C cannot see any messages
- ✅ OR navigation is blocked
- ✅ Database returns empty array

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 10: RLS Policy - Unauthorized Send

**Objective:** Non-trade participants cannot send messages

**Steps:**
1. Log in as User C (not in the trade)
2. Attempt to insert a message via SQL:

```sql
INSERT INTO messages (trade_id, sender_id, content, message_type)
VALUES ('<trade_id>', '<user_c_id>', 'Unauthorized message', 'text');
```

**Expected Results:**
- ✅ Insert fails with RLS policy violation
- ✅ Error message: "new row violates row-level security policy"

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 11: Multiple Messages Rapid Fire

**Objective:** Handle rapid message sending

**Steps:**
1. Type and send 5 messages quickly (< 5 seconds)
2. Observe the message list

**Expected Results:**
- ✅ All 5 messages appear in order
- ✅ No duplicates
- ✅ No missing messages
- ✅ Timestamps increase sequentially

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 12: Keyboard Behavior (iOS/Android)

**Objective:** Input field adjusts with keyboard

**Steps:**
1. Tap the input field
2. Observe keyboard and input position
3. Type a long message (multiple lines)
4. Tap "Send"
5. Keyboard dismisses

**Expected Results:**
- ✅ Keyboard pushes input container up
- ✅ Input field expands for multiline text
- ✅ Keyboard doesn't cover input field
- ✅ Keyboard dismisses after send (iOS may vary)

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

### Test Case 13: Error Handling - Network Failure

**Objective:** Graceful error handling when offline

**Steps:**
1. Enable Airplane Mode on device
2. Type a message
3. Tap "Send"
4. Observe result

**Expected Results:**
- ✅ Error alert displays: "Failed to send message"
- ✅ Message text remains in input field (not lost)
- ✅ User can retry after re-enabling network

**Actual Result:** _____________

**Status:** ⬜ Pass | ⬜ Fail

---

## Database Verification Queries

Run these in Supabase SQL Editor to verify data integrity:

### Query 1: Check messages table structure
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;
```

**Expected:** 9 columns (id, trade_id, sender_id, content, message_type, image_url, created_at, updated_at, deleted_at)

---

### Query 2: Check RLS policies
```sql
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'messages';
```

**Expected:** 3 policies (view, send, delete)

---

### Query 3: View messages for a specific trade
```sql
SELECT
  m.id,
  m.trade_id,
  m.sender_id,
  m.content,
  m.created_at,
  p.name AS sender_name
FROM messages m
LEFT JOIN profiles p ON m.sender_id = p.user_id
WHERE m.trade_id = '<your_trade_id>'
AND m.deleted_at IS NULL
ORDER BY m.created_at DESC
LIMIT 10;
```

---

### Query 4: Check indexes
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'messages';
```

**Expected:** 4 indexes (trade_id, sender_id, created_at, deleted_at)

---

## Performance Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| Message send latency | < 500ms | _____ |
| Message receive latency (Realtime) | < 2s | _____ |
| Load 50 messages | < 1s | _____ |
| Realtime subscription connect time | < 1s | _____ |

---

## Known Issues / Limitations

1. **Realtime subscriptions require stable network**
   - If network is unstable, messages may arrive delayed
   - Workaround: Implement reconnection logic (Post-MVP)

2. **No read receipts**
   - Deferred to MSG-008 (Post-MVP)

3. **No typing indicators**
   - Deferred to MSG-009 (Post-MVP)

4. **Image sharing not yet implemented**
   - Covered in MSG-003

---

## Rollback Plan

If critical issues are found:

1. **Disable Realtime subscriptions:**
   - Comment out `subscribeToMessages` call in ChatScreen
   - Rely on manual refresh only

2. **Revert migration:**
```sql
DROP TABLE IF EXISTS messages CASCADE;
```

---

## Sign-Off

**Tested By:** _____________  
**Date:** _____________  
**Environment:** ⬜ Development | ⬜ Staging | ⬜ Production  
**Overall Status:** ⬜ Pass | ⬜ Fail | ⬜ Pass with Minor Issues

**Notes:**
_______________________________________________________
_______________________________________________________
_______________________________________________________

---

## Next Steps

After all tests pass:
- [ ] Deploy to staging environment
- [ ] Conduct load testing (50+ concurrent users)
- [ ] Implement MSG-002: Conversation List UI
- [ ] Implement MSG-003: Image Sharing
- [ ] Implement MSG-004: Message Expiration

---

**MODULE-07 MSG-001 - Manual Testing Guide Complete**
