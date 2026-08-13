# MSG-002 Manual Testing Guide
## Conversations List Screen - Manual Test Cases

**Module:** MODULE-07-MESSAGING  
**Task:** MSG-002: Create Chat UI (Conversation List, Chat Screen)  
**Date:** January 4, 2026

---

## Prerequisites

Before testing, ensure:
- ✅ Database migration `080_messages_table.sql` is applied
- ✅ At least 2 test users exist (e.g., buyer and seller)
- ✅ At least 1 trade exists between test users
- ✅ At least 1 message sent in the trade chat
- ✅ App is running on simulator/device
- ✅ User is logged in

---

## Test Case 1: Navigate to Conversations List from Dashboard

**Objective:** Verify Messages button navigates to Conversations List screen

**Steps:**
1. Log in to the app
2. Navigate to Dashboard (Home screen)
3. Look at the header section
4. Tap the **💬 Messages** button

**Expected Results:**
- ✅ Messages button is visible in the Dashboard header (between title and Payouts button)
- ✅ App navigates to Conversations List screen
- ✅ Screen title shows "Messages"

---

## Test Case 2: Display Empty State (No Conversations)

**Objective:** Verify empty state when user has no conversations

**Prerequisites:** 
- User has no trades OR no messages in any trades

**Steps:**
1. Navigate to Conversations List screen
2. Observe the screen content

**Expected Results:**
- ✅ Empty state emoji "💬" is displayed
- ✅ Title shows "No Messages Yet"
- ✅ Subtitle shows "Start a trade and chat with other users!"
- ✅ "Browse Items" button is visible
- ✅ No conversation cards are shown

---

## Test Case 3: Tap Browse Items Button in Empty State

**Objective:** Verify Browse Items button navigates correctly

**Steps:**
1. Navigate to Conversations List screen (with empty state)
2. Tap "Browse Items" button

**Expected Results:**
- ✅ App navigates to Browse Items screen
- ✅ User can browse available items

---

## Test Case 4: Display Conversations List with Messages

**Objective:** Verify conversations list displays correctly with data

**Prerequisites:**
- User has at least 2 trades with messages

**Steps:**
1. Navigate to Conversations List screen
2. Observe the list of conversations

**Expected Results:**
- ✅ Each conversation card shows:
  - Avatar circle with first letter of other user's name
  - Other user's name
  - Listing title and price (e.g., "Test Item • $25.50")
  - Last message preview (truncated to 2 lines)
  - Timestamp (e.g., "2m ago", "5h ago", "2d ago")
  - Right chevron icon
- ✅ Conversations are sorted by most recent message first
- ✅ Empty state is NOT visible

---

## Test Case 5: Display Unread Count Badge

**Objective:** Verify unread count badge appears correctly

**Prerequisites:**
- User has a conversation where other user sent messages in last 24 hours

**Steps:**
1. Navigate to Conversations List screen
2. Find a conversation with unread messages
3. Observe the avatar area

**Expected Results:**
- ✅ Red badge appears on top-right of avatar
- ✅ Badge shows unread count (e.g., "2", "5")
- ✅ For count > 9, badge shows "9+"
- ✅ Conversations with no unread messages have no badge

---

## Test Case 6: Navigate to Chat Screen from Conversation

**Objective:** Verify tapping a conversation opens the chat screen

**Steps:**
1. Navigate to Conversations List screen
2. Tap any conversation card

**Expected Results:**
- ✅ App navigates to Chat screen
- ✅ Chat screen shows messages for that trade
- ✅ Item header displays listing info
- ✅ Back button navigates back to Conversations List

---

## Test Case 7: Timestamp Formatting

**Objective:** Verify timestamp displays in relative format

**Prerequisites:**
- Conversations with messages at different times

**Steps:**
1. Navigate to Conversations List screen
2. Observe timestamps for different conversations

**Expected Results:**
- ✅ Recent messages show "Just now" (< 1 min)
- ✅ Minutes show "Xm ago" (1-59 minutes)
- ✅ Hours show "Xh ago" (1-23 hours)
- ✅ Days show "Xd ago" (1-6 days)
- ✅ Older messages show date (e.g., "Dec 28")

---

## Test Case 8: Real-Time Updates (New Message Arrives)

**Objective:** Verify list updates when new message is received

**Prerequisites:**
- 2 devices or 2 users logged in
- Both users have access to same trade chat

**Steps:**
1. User A: Navigate to Conversations List screen
2. User B: Send a new message in an existing chat
3. User A: Observe Conversations List

**Expected Results:**
- ✅ Conversations List automatically updates
- ✅ Conversation with new message moves to top
- ✅ Last message preview updates to new message
- ✅ Timestamp updates to "Just now"
- ✅ Unread count increases (if applicable)
- ✅ No manual refresh required

---

## Test Case 9: Pull-to-Refresh

**Objective:** Verify pull-to-refresh reloads conversations

**Steps:**
1. Navigate to Conversations List screen
2. Pull down from top of list
3. Release to trigger refresh
4. Observe loading indicator and list

**Expected Results:**
- ✅ Loading spinner appears while refreshing
- ✅ List reloads with latest data
- ✅ Spinner disappears when complete
- ✅ Conversations are sorted correctly

---

## Test Case 10: Message Preview Truncation

**Objective:** Verify long messages are truncated correctly

**Prerequisites:**
- A conversation with a very long last message (> 200 characters)

**Steps:**
1. Navigate to Conversations List screen
2. Find conversation with long message
3. Observe last message preview

**Expected Results:**
- ✅ Message preview is truncated to 2 lines
- ✅ Ellipsis (...) appears at the end
- ✅ Text does not overflow card

---

## Test Case 11: Avatar Display

**Objective:** Verify avatar shows first letter of user's name

**Steps:**
1. Navigate to Conversations List screen
2. Observe avatars for different conversations

**Expected Results:**
- ✅ Each avatar shows a colored circle
- ✅ Circle contains first letter of other user's name (uppercase)
- ✅ Background color is consistent (blue)
- ✅ Letter is white and centered

---

## Test Case 12: Listing Price Formatting

**Objective:** Verify listing price displays correctly

**Prerequisites:**
- Conversations with different price amounts

**Steps:**
1. Navigate to Conversations List screen
2. Observe listing titles and prices

**Expected Results:**
- ✅ Price shows with dollar sign and 2 decimals (e.g., "$25.50")
- ✅ Format is "Title • $Price"
- ✅ Text truncates if title too long

---

## Test Case 13: Back Navigation from Conversations List

**Objective:** Verify user can navigate back to Dashboard

**Steps:**
1. Navigate to Conversations List screen from Dashboard
2. Use device back button or gesture
3. Observe navigation

**Expected Results:**
- ✅ App navigates back to Dashboard
- ✅ Dashboard shows normally
- ✅ Messages button still visible

---

## Test Case 14: Screen Focus Behavior

**Objective:** Verify list refreshes when screen comes into focus

**Steps:**
1. Navigate to Conversations List screen
2. Navigate to Chat screen for a conversation
3. Go back to Conversations List
4. Observe if list refreshes

**Expected Results:**
- ✅ List reloads when screen focuses
- ✅ Latest messages appear
- ✅ Sorting is updated

---

## Test Case 15: Empty Conversations After Load

**Objective:** Verify behavior when conversations become empty after initial load

**Prerequisites:**
- User has conversations initially
- All trades are deleted or messages are deleted

**Steps:**
1. Load Conversations List (shows conversations)
2. Delete all trades/messages via Supabase dashboard
3. Pull to refresh

**Expected Results:**
- ✅ List transitions to empty state
- ✅ Empty state UI displays correctly
- ✅ No crash or error

---

## Regression Tests

### RT-1: Verify MSG-001 Still Works

**Objective:** Ensure ChatScreen still functions correctly

**Steps:**
1. Navigate to Conversations List
2. Tap a conversation
3. Send a message in chat
4. Go back to Conversations List

**Expected Results:**
- ✅ Chat screen opens correctly
- ✅ Messages send successfully
- ✅ Back navigation works
- ✅ Conversations List shows updated message

---

### RT-2: Dashboard Integration

**Objective:** Ensure Dashboard changes don't break existing features

**Steps:**
1. Navigate to Dashboard
2. Test all header buttons:
   - Messages
   - Payouts
   - Settings
3. Test bottom navigation bar

**Expected Results:**
- ✅ All buttons work correctly
- ✅ Navigation doesn't conflict
- ✅ No UI overlaps or misalignment

---

## Performance Tests

### PT-1: Large Conversations List

**Objective:** Verify performance with many conversations

**Prerequisites:**
- 20+ conversations exist

**Steps:**
1. Navigate to Conversations List
2. Scroll through list
3. Observe performance

**Expected Results:**
- ✅ List renders smoothly (no lag)
- ✅ Scrolling is fluid
- ✅ No memory warnings

---

### PT-2: Real-Time Updates Performance

**Objective:** Verify real-time updates don't cause lag

**Steps:**
1. Keep Conversations List open
2. Have another user send 10+ messages rapidly
3. Observe list updates

**Expected Results:**
- ✅ List updates smoothly
- ✅ No lag or freezing
- ✅ App remains responsive

---

## Edge Cases

### EC-1: No Internet Connection

**Objective:** Verify graceful handling of offline state

**Steps:**
1. Turn off device internet
2. Navigate to Conversations List
3. Observe behavior

**Expected Results:**
- ✅ Screen loads (may show cached data)
- ✅ Pull-to-refresh fails gracefully
- ✅ Error message or indicator shown (if implemented)
- ✅ No crash

---

### EC-2: Very Long User Names

**Objective:** Verify truncation of long names

**Prerequisites:**
- Conversation with user who has very long name (50+ chars)

**Steps:**
1. Navigate to Conversations List
2. Find conversation with long name
3. Observe display

**Expected Results:**
- ✅ Name truncates with ellipsis
- ✅ UI doesn't break or overflow
- ✅ Card maintains proper height

---

### EC-3: Special Characters in Messages

**Objective:** Verify special characters display correctly

**Prerequisites:**
- Last message contains emojis, symbols, or special chars

**Steps:**
1. Navigate to Conversations List
2. Observe message preview

**Expected Results:**
- ✅ Emojis display correctly
- ✅ Special characters render properly
- ✅ No encoding issues

---

## Test Summary Checklist

After completing all tests, verify:

- [ ] Empty state displays correctly
- [ ] Conversations list displays with all required info
- [ ] Unread count badge works
- [ ] Navigation to chat screen works
- [ ] Real-time updates work
- [ ] Pull-to-refresh works
- [ ] Timestamps format correctly
- [ ] Avatar displays correctly
- [ ] No crashes or errors
- [ ] Performance is acceptable
- [ ] Edge cases handled gracefully
- [ ] MSG-001 (ChatScreen) still works correctly
- [ ] Dashboard integration works

---

## Bug Reporting Template

If you find a bug, report using this format:

```
**Bug Title:** [Brief description]
**Severity:** [Critical / High / Medium / Low]
**Test Case:** [Which test case revealed the bug]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots/Logs:**
[Attach if available]

**Device Info:**
- Device: [iPhone 15 Simulator / Pixel 7 / etc.]
- OS: [iOS 17.0 / Android 14]
- App Version: [1.0.0]
```

---

## Test Completion Sign-Off

**Tester Name:** ____________________  
**Date:** ____________________  
**Result:** [ ] PASS  [ ] FAIL  
**Notes:** ____________________

---

**End of Manual Test Guide**
