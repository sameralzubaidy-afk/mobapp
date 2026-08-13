# MSG-002: Unread Badge Fix - Complete Test Guide

## ✅ Compilation Gate (MUST PASS FIRST)

Run these commands to verify the code compiles:

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# TypeScript check
yarn type-check

# Lint check
yarn lint
```

**Expected Results**:
- No TypeScript errors
- No duplicate identifier warnings
- No ESLint errors
- Exit code: 0

---

## Unit Test Verification

If you have existing unit tests for the chat service:

```bash
cd p2p-kids-marketplace
yarn test src/services/__tests__/chat.test.ts
```

**Expected**: Tests pass (or skip if file doesn't exist yet)

---

## E2E Smoke Tests

### Test Setup
You'll need:
- 2 test users in Supabase (one free, one Kids Club+)
- At least 2 trades between them with messages
- Both users should have the app open on separate devices/simulators

### Test Case 1: Basic Unread Clearing
**Objective**: Verify unread badge clears when opening a conversation

**Steps**:
1. Start the app on Device A (Buyer)
2. Navigate to Dashboard
3. Click Messages button (💬) → Conversations List loads
4. **Check**: See conversation with sender (e.g., "Alice") showing unread count (e.g., "9+")
5. Tap the conversation → ChatScreen opens
6. **Check**: Messages display correctly, oldest first
7. Tap back button → Return to Conversations List
8. **Check**: Same conversation now shows "0" unread (badge may disappear)

**Expected Results**: ✅
- Badge cleared after viewing messages
- ConversationsListScreen shows updated count
- No errors in console

**Debugging**:
- Check Xcode/Android Studio console for `[chat.markAsRead]` log
- Verify AsyncStorage has key: `last_viewed_{userId}_{tradeId}`
- Check Supabase logs for any query errors

---

### Test Case 2: Multiple Conversations Handling
**Objective**: Verify each conversation tracks unread independently

**Steps**:
1. In Conversations List, observe 3+ conversations with different unread counts
2. Example: Conversation A: "5", Conversation B: "3", Conversation C: "2"
3. Tap Conversation A → ChatScreen opens
4. Go back to Conversations List
5. **Check**: Conversation A now shows "0", B still shows "3", C still shows "2"
6. Tap Conversation B → ChatScreen opens
7. Go back to Conversations List
8. **Check**: Conversation B now shows "0", A still shows "0", C still shows "2"

**Expected Results**: ✅
- Each conversation's unread count tracks independently
- Opening one conversation doesn't affect others
- AsyncStorage stores separate timestamps per conversation

---

### Test Case 3: New Messages After Reading
**Objective**: Verify unread badge shows again when new messages arrive

**Prerequisites**:
- Complete Test Case 1
- Have conversation cleared (0 unread)
- Access to second device/simulator or TestFlight build

**Steps**:
1. Device A: Open Conversations List with conversation showing "0" unread
2. Device B: Send a new message in the same conversation
3. Device A: Wait for real-time update (should appear within 1-2 seconds)
4. **Check**: Conversation now shows "1" unread badge
5. (Repeat: send 3 more messages)
6. **Check**: Badge updates to "4", then "5", etc.

**Expected Results**: ✅
- Real-time updates work correctly
- New messages counted correctly
- Badge increments as messages arrive

**Debugging**:
- Check Supabase Realtime subscription logs
- Verify `messages` table has new rows
- Check console for `[ConversationsListScreen] New message received`

---

### Test Case 4: App Restart Persistence
**Objective**: Verify AsyncStorage persists across app restarts

**Steps**:
1. Device A: Open conversation (marks as read)
2. Device A: Go back to Conversations List (badge shows 0)
3. Device A: Fully close the app (swipe up/kill process)
4. Device A: Reopen the app
5. **Check**: Navigate back to Conversations List
6. **Check**: Same conversation still shows 0 unread
7. Device B: Send new message
8. Device A: Conversations List refreshes
9. **Check**: Badge now shows "1"

**Expected Results**: ✅
- AsyncStorage values survive app restart
- Unread count calculation still works after restart

---

### Test Case 5: ChatScreen Direct Opening
**Objective**: Verify unread badge clears when ChatScreen opens (via back/notification)

**Steps**:
1. Device A: Open Conversations List with unread conversation
2. Tap conversation → ChatScreen opens
3. **Important**: DO NOT go back yet
4. **Check**: Console should show `[ChatScreen] Marked trade ... as read on mount`
5. Wait 3 seconds
6. Tap back button → Return to Conversations List
7. **Check**: Badge shows 0

**Expected Results**: ✅
- `markAsRead()` is called in ChatScreen's useEffect
- Badge clears even if user doesn't tap conversation from list first

---

### Test Case 6: Edge Cases

#### 6a: Very Old Messages
**Objective**: Verify unread count doesn't count messages older than last view

**Steps**:
1. Open conversation with 50 old messages
2. Tap to open → mark as read at Time T
3. Go back → check badge shows 0
4. Wait 1 second
5. Other user sends 2 new messages (after Time T)
6. Check badge shows 2 (not 52)

**Expected Results**: ✅ Unread count is accurate

#### 6b: Rapid Message Flood
**Objective**: Verify unread count handles many rapid messages

**Steps**:
1. Other user sends 10 messages very quickly (< 1 second)
2. Watch badge increment: 1 → 2 → 3 ... → 10
3. Open conversation
4. Go back
5. Check badge shows 0

**Expected Results**: ✅ No race conditions, count is stable

#### 6c: Different Users in Same Trade
**Objective**: If trade has buyer + seller, verify each sees correct unread

**Steps**:
1. Buyer (Device A) taps conversation → marks as read at Time T₁
2. Seller (Device B) has same conversation with different last_viewed timestamp
3. Send message from Buyer
4. Check Seller's badge shows 1 (message after their last view)
5. Check Buyer's badge still shows 1 (message after their last view)

**Expected Results**: ✅ Each user's unread count is independent

---

## Console Logging Verification

While running tests, watch for these log messages:

### In ConversationsListScreen:
```
[ConversationsListScreen] Screen focused, loading conversations
[ConversationsListScreen] Loaded X conversations
[ConversationsListScreen] Opening chat for trade: ...
[ConversationsListScreen] Marked trade ... as read
[ConversationsListScreen] New message received, refreshing list
```

### In ChatScreen:
```
[ChatScreen] Mounting with tradeId: ...
[ChatScreen] Marked trade ... as read on mount
[ChatScreen] Realtime message received: ...
[ChatScreen] Unmounting, unsubscribing from messages
```

### In chat.ts service:
```
[chat.markAsRead] Marked trade ... as read at ...
[chat.getUnreadCount] Checking unread for trade: ...
```

**If you see errors**:
- `[chat.markAsRead] Error: ...` → AsyncStorage write failed
- `[chat.getUnreadCount] Error: ...` → Query failed
- Missing logs → Function not called, check imports

---

## Performance Verification

### Test 1: List Loading Speed
**Objective**: Verify ConversationsListScreen loads quickly

**Steps**:
1. Start timer when clicking Messages button
2. Stop timer when conversation list is visible
3. **Expected**: < 2 seconds

### Test 2: Badge Update Speed
**Objective**: Verify unread count updates quickly when new message arrives

**Steps**:
1. Have device B send a message
2. Watch device A's Conversations List for badge update
3. **Expected**: < 1 second for badge to show

### Test 3: Navigation Speed
**Objective**: Verify opening conversation is fast

**Steps**:
1. Start timer when tapping conversation
2. Stop timer when ChatScreen messages load
3. **Expected**: < 3 seconds

---

## Failure Troubleshooting

### Issue: Badge still shows "9+" after viewing
**Checks**:
1. [ ] Is `yarn type-check` passing? (compile issue)
2. [ ] Check console for `[chat.markAsRead]` log
3. [ ] Is AsyncStorage available? (check Xcode console for storage errors)
4. [ ] Try: Force quit app + reopen + retry
5. [ ] Try: Clear AsyncStorage in DevTools (if available)
6. [ ] Check: Is `getUnreadCount()` being called? (add logging)

### Issue: Badge disappears but doesn't update with new messages
**Checks**:
1. [ ] Is Realtime subscription active? (check `[ConversationsListScreen] Subscription status`)
2. [ ] Are messages being inserted in DB? (check Supabase Studio)
3. [ ] Is `loadConversations()` being called on new message? (check logs)
4. [ ] Try: Pull-to-refresh Conversations List (should update)

### Issue: Badge shows wrong count
**Checks**:
1. [ ] Check AsyncStorage timestamp format is ISO
2. [ ] Verify message timestamps are in correct timezone
3. [ ] Check if `getUnreadCount()` has correct date comparison logic
4. [ ] Try: Close and reopen app (AsyncStorage might be stale)

### Issue: Compilation fails
**Steps**:
1. [ ] Run `yarn type-check` to see exact error
2. [ ] Check if `markAsRead` is exported from chat.ts
3. [ ] Check imports in ConversationsListScreen and ChatScreen
4. [ ] Verify AsyncStorage import in chat.ts
5. [ ] Run `yarn lint --fix` to auto-fix formatting

---

## Full Integration Flow Checklist

- [ ] Code compiles (yarn type-check passes)
- [ ] No import errors
- [ ] Dashboard loads with Messages button
- [ ] Messages button navigates to ConversationsListScreen
- [ ] Conversations List shows all conversations
- [ ] Unread badges display with correct counts
- [ ] Tapping conversation calls markAsRead()
- [ ] ChatScreen opens and shows messages
- [ ] Going back to Conversations List shows 0 unread
- [ ] Real-time updates work (new message shows new badge)
- [ ] Multiple conversations handled independently
- [ ] App restart preserves AsyncStorage data
- [ ] No crashes or console errors
- [ ] Pull-to-refresh updates list correctly
- [ ] Pagination/scrolling works for long conversation lists

---

## Sign-Off

Once all tests pass:

✅ **Sign-off**: MSG-002 Unread Badge Fix is **COMPLETE** and **READY FOR PRODUCTION**

---

## Additional Resources

- **Flow Registry**: FLOW-14 (Messaging – Real-time Chat)
- **Related Modules**: 
  - MODULE-07-MESSAGING.md (implementation spec)
  - MODULE-07-VERIFICATION.md (checklist)
- **Dependencies**: AsyncStorage, Supabase Realtime, React Navigation
- **Post-MVP**: MSG-008 (Full read receipts with DB tracking)
