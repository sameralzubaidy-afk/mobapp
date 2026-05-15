# MODULE-15.1 FLOW-14: Messaging Manual Testing Guide

**Module:** MODULE-15.1-UI-REDESIGN  
**Task:** FLOW-14 - Messaging Screens Redesign  
**Screens:** ConversationsListScreen, ChatScreen  
**Design System:** Whisk-inspired (#5DBB8E green, Phosphor icons)  
**Test Environment:** iOS Simulator / Android Emulator (Staging Supabase)

---

## Prerequisites

1. **Two test users** with active session on staging Supabase
   - User A (Buyer): `test-buyer@example.com`
   - User B (Seller): `test-seller@example.com`

2. **Active trade** between User A and User B with:
   - At least 3-5 existing messages
   - Unread messages for both users
   - At least one image message
   - Listing with proper title and price

3. **Verified user** (User B should have `verification_status = 'approved'`)

4. **Environment:**
   - iOS Simulator (iOS 15+) OR Android Emulator (API 29+)
   - Expo Go or development build
   - Staging Supabase configured

---

## Test Cases

### **TC-001: Conversations List - Initial Render**

**Objective:** Verify conversations list loads correctly with Whisk design system

**Steps:**
1. Open app and log in as User A
2. Navigate to Messages tab (bottom nav)

**Expected Results:**
- ✅ Conversations list displays with white background (#FFFFFF)
- ✅ Search bar renders at top (pill-shaped, 48px height, #F0F0F0 fill, MagnifyingGlass Phosphor icon)
- ✅ Each conversation card shows:
  - Partner avatar (40px circle)
  - Partner name (15px, #1A1A1A, weight 600)
  - Last message preview (13px, #6B6B6B)
  - Timestamp (11px, #999999, right-aligned)
- ✅ Unread badge (if unread_count > 0): green circle (#5DBB8E, 20px, white text 11px)
- ✅ ShieldCheck Phosphor icon (14px, #5DBB8E, fill weight) for verified users
- ✅ Trade context chip: ArrowsLeftRight icon (12px, #5DBB8E) + listing title + price
- ✅ Smooth scrolling, no jank

**Notes:**
- Verify badge positions correctly next to user name
- Check spacing is consistent across cards

---

### **TC-002: Conversations List - Search Functionality**

**Objective:** Verify search filters conversations correctly

**Steps:**
1. On Conversations list screen
2. Tap search bar
3. Type "Alice" (partial match of a user name)
4. Observe filtered results
5. Clear search
6. Type "Lego" (partial match of a listing title)
7. Observe filtered results
8. Type "xyz123" (no match)

**Expected Results:**
- ✅ Search is case-insensitive
- ✅ Filters by: other_user_name, listing_title, last_message_content
- ✅ Results update as you type (debounced, ~250ms delay)
- ✅ "No conversations match 'xyz123'" empty state displays for no matches
- ✅ Clearing search restores full list

**Notes:**
- Check debounce timing feels responsive (not too fast/slow)

---

### **TC-003: Conversations List - Unread Badge**

**Objective:** Verify unread badge displays and clears correctly

**Prerequisites:** Conversation with `unread_count > 0`

**Steps:**
1. On Conversations list, note conversation with unread badge
2. Tap that conversation to open chat
3. Wait 2 seconds (simulate reading)
4. Tap back button to return to list

**Expected Results:**
- ✅ Unread badge visible BEFORE opening chat (green circle #5DBB8E, count in white)
- ✅ Badge disappears AFTER returning from chat (unread_count = 0)
- ✅ Badge count matches number of unread messages

**Notes:**
- `markAsRead` service call should be triggered when opening chat

---

### **TC-004: Conversations List - Empty State**

**Objective:** Verify empty state when no conversations exist

**Prerequisites:** Fresh user with no conversations

**Steps:**
1. Log in as new user with no messages
2. Navigate to Messages tab

**Expected Results:**
- ✅ ChatCircleSlash Phosphor icon (64px, #E0E0E0)
- ✅ "No conversations yet" headline (18px, #1A1A1A, weight 600)
- ✅ "Browse items and start trading!" subtext (14px, #6B6B6B)
- ✅ "Browse Items" button (green pill, #5DBB8E, height 52px, borderRadius 26)
- ✅ Tapping "Browse Items" navigates to Discovery tab

**Notes:**
- Empty state should feel inviting, not like an error

---

### **TC-005: Chat Screen - Header UI**

**Objective:** Verify chat header follows Whisk design system

**Prerequisites:** Open chat from conversations list

**Steps:**
1. From Conversations list, tap any conversation
2. Observe header

**Expected Results:**
- ✅ Back button: CaretLeft Phosphor icon (24px, #1A1A1A), left-aligned
- ✅ Partner avatar: 36px circle
- ✅ Partner name: 15px, #1A1A1A, weight 600
- ✅ ShieldCheck Phosphor icon (14px, #5DBB8E, fill) for verified seller
- ✅ Listing title (if trade context): 13px, #6B6B6B, below name
- ✅ Header background: #FFFFFF, bottom border #F0F0F0 (1px)

**Notes:**
- Tap back button → should return to Conversations list

---

### **TC-006: Chat Screen - Trade Context Banner**

**Objective:** Verify trade context banner renders correctly

**Steps:**
1. In ChatScreen, observe area below header

**Expected Results:**
- ✅ Banner background: #F7F7F7
- ✅ ArrowsLeftRight Phosphor icon (16px, #5DBB8E, regular weight)
- ✅ Listing thumbnail: 32×32px, borderRadius 6
- ✅ Item name + price: "Lego Star Wars Set • $45.99" (13px, #1A1A1A, flex 1)
- ✅ "View Trade" link: 13px, #5DBB8E, weight 600, right-aligned
- ✅ Tap "View Trade" → navigates to ListingDetail screen

**Notes:**
- Banner should be horizontally scrollable if text is long (rare)

---

### **TC-007: Chat Screen - Message Bubbles (Sent Messages)**

**Objective:** Verify sent message styling follows Whisk design system

**Prerequisites:** Chat with messages sent by logged-in user

**Steps:**
1. In ChatScreen, scroll to find your own sent messages

**Expected Results:**
- ✅ Right-aligned (alignSelf: flex-end)
- ✅ Background: #5DBB8E (green)
- ✅ Text color: #FFFFFF (white)
- ✅ borderRadius: 16px
- ✅ borderTopRightRadius: 4px (sharp corner on sender side)
- ✅ Padding: 16px horizontal, 10px vertical
- ✅ maxWidth: 75% of screen width

**Notes:**
- Green bubbles should be easy to distinguish as "your" messages

---

### **TC-008: Chat Screen - Message Bubbles (Received Messages)**

**Objective:** Verify received message styling

**Prerequisites:** Chat with messages sent by other user

**Steps:**
1. In ChatScreen, scroll to find messages from other user

**Expected Results:**
- ✅ Left-aligned (alignSelf: flex-start)
- ✅ Background: #F0F0F0 (gray)
- ✅ Text color: #1A1A1A (dark gray)
- ✅ borderRadius: 16px
- ✅ borderTopLeftRadius: 4px (sharp corner on sender side)
- ✅ Padding: 16px horizontal, 10px vertical
- ✅ maxWidth: 75% of screen width
- ✅ NO border (borderWidth removed)

**Notes:**
- Gray bubbles should contrast well with white background

---

### **TC-009: Chat Screen - Delivery Status (MSG-008)**

**Objective:** Verify delivery status uses Phosphor Check icons

**Prerequisites:** Chat with sent messages in different delivery states

**Steps:**
1. Send a new message
2. Observe delivery status below your message
3. Wait for status to transition (sent → delivered → read)

**Expected Results:**
- ✅ **Sent:** Single Check icon (12px, #9CA3AF, bold weight)
- ✅ **Delivered:** Double Check icons (12px, #9CA3AF, bold weight, marginLeft -4 for overlap)
- ✅ **Read:** Double Check icons (12px, #5DBB8E green, bold weight, marginLeft -4)
- ✅ Status visible ONLY for own messages (not received messages)
- ✅ Status positioned below message bubble, right-aligned

**Notes:**
- Delivery status should update in real-time via Supabase Realtime

---

### **TC-010: Chat Screen - Input Bar (Empty State)**

**Objective:** Verify input bar rendering when empty

**Steps:**
1. In ChatScreen, observe bottom input bar

**Expected Results:**
- ✅ Input bar background: #F7F7F7 (not white)
- ✅ PaperclipHorizontal Phosphor icon (20px, #6B6B6B, regular) on left
- ✅ Input field: filled style, #F0F0F0 bg, borderRadius 20, height 40px, NO border
- ✅ Placeholder: "Type a message..." (color #999999)
- ✅ Smiley Phosphor icon (20px, #6B6B6B, regular) on right
- ✅ Send button (PaperPlaneRight) is NOT visible when input is empty

**Notes:**
- PaperClip and Smiley icons should be gray, NOT green

---

### **TC-011: Chat Screen - Input Bar (With Text)**

**Objective:** Verify send button appears when text is entered

**Steps:**
1. In ChatScreen input field, type "Test message"
2. Observe input bar changes

**Expected Results:**
- ✅ Send button appears on far right (circular, 48×48px, #5DBB8E bg)
- ✅ PaperPlaneRight Phosphor icon (24px, #FFFFFF white, fill weight) inside button
- ✅ Smiley and PaperClip icons still visible
- ✅ Input field expands to fill available space (flex: 1)

**Notes:**
- Send button should animate in smoothly (not jarring)

---

### **TC-012: Chat Screen - Send Message**

**Objective:** Verify message sending flow

**Steps:**
1. Type "Manual test message - TC-012" in input field
2. Tap send button (green circle with PaperPlaneRight icon)
3. Observe message appears in chat

**Expected Results:**
- ✅ Message appears at bottom of list (or top if inverted)
- ✅ Message bubble is green (#5DBB8E) with white text
- ✅ Input field clears after sending
- ✅ Send button disappears after message sent
- ✅ Delivery status shows Single Check (sent)
- ✅ No error states or loading spinners

**Notes:**
- Message should appear instantly (optimistic UI)

---

### **TC-013: Chat Screen - Image Picker**

**Objective:** Verify image upload flow

**Steps:**
1. Tap PaperclipHorizontal icon (left side of input bar)
2. Select an image from photo library
3. Observe image upload

**Expected Results:**
- ✅ Image picker opens
- ✅ After selection, loading indicator appears briefly
- ✅ Image message appears in chat (as green bubble with image thumbnail)
- ✅ Tap image → opens full-screen image viewer
- ✅ Image viewer has X close button (Phosphor X icon, white)

**Notes:**
- Image should be compressed/optimized before upload

---

### **TC-014: Chat Screen - Typing Indicator (MSG-009)**

**Objective:** Verify typing indicator displays when other user is typing

**Prerequisites:** Two devices or manual DB update to simulate typing

**Steps:**
1. On User B's device, open the same chat
2. Start typing a message (don't send)
3. On User A's device, observe chat

**Expected Results:**
- ✅ Typing indicator appears at bottom (left-aligned gray bubble)
- ✅ Three animated dots (8px circles, #6B6B6B, fading in/out)
- ✅ Indicator disappears when User B stops typing

**Notes:**
- Typing events published via Supabase Realtime channel

---

### **TC-015: Chat Screen - Real-Time Message Receive**

**Objective:** Verify incoming messages appear in real-time

**Prerequisites:** Two devices

**Steps:**
1. User A has ChatScreen open
2. User B (on separate device) sends a message
3. Observe User A's screen

**Expected Results:**
- ✅ New message appears instantly (no refresh needed)
- ✅ Message bubble is gray (#F0F0F0) with dark text
- ✅ Message auto-scrolls into view

**Notes:**
- Powered by Supabase Realtime subscription

---

### **TC-016: Chat Screen - Scroll Performance**

**Objective:** Verify smooth scrolling with many messages

**Prerequisites:** Chat with 50+ messages

**Steps:**
1. Open chat with long message history
2. Scroll up to load older messages
3. Scroll down quickly to recent messages

**Expected Results:**
- ✅ No lag or dropped frames (60fps)
- ✅ Messages load progressively (pagination if implemented)
- ✅ Scroll position maintained during real-time updates

**Notes:**
- FlatList inverted prop used for chat-style scrolling

---

### **TC-017: Search - No Results State**

**Objective:** Verify no results message

**Steps:**
1. On Conversations list, type "xyz123" in search bar

**Expected Results:**
- ✅ Shows "No conversations match 'xyz123'" message
- ✅ Message is centered, gray text (#6B6B6B)
- ✅ Search bar still visible at top

---

### **TC-018: Navigation - Back from Chat to Conversations**

**Objective:** Verify back navigation flow

**Steps:**
1. From Conversations list, open a chat
2. Tap back button (CaretLeft icon)

**Expected Results:**
- ✅ Returns to Conversations list
- ✅ Conversation's unread badge cleared (if it was unread)
- ✅ Last message preview updated with latest message

---

### **TC-019: Accessibility - testID Props**

**Objective:** Verify all interactive elements have testID props for Maestro

**Steps:**
1. Review code for testID props on:
   - `conversations-search-input`
   - `conversation-${item.id}`
   - `unread-badge`
   - `verified-badge`
   - `browse-items-button`
   - `chat-header`
   - `back-button`
   - `trade-banner`
   - `view-trade-link`
   - `message-${item.id}`
   - `message-input-bar`
   - `image-picker-button`
   - `message-input`
   - `emoji-button`
   - `send-button`

**Expected Results:**
- ✅ All testIDs present in code
- ✅ Maestro YAML can target elements successfully

**Notes:**
- Run Maestro flow to validate: `npm run test:maestro:ios -- .maestro/module-15.1-flow-14-messaging.yaml`

---

### **TC-020: Phosphor Icons - Visual Verification**

**Objective:** Verify all Phosphor icons render correctly

**Steps:**
1. Open Conversations list and Chat screen
2. Visually verify icons:
   - MagnifyingGlass (search bar)
   - ChatCircleSlash (empty state)
   - ArrowsLeftRight (trade chip + banner)
   - ShieldCheck (verified badges)
   - CaretLeft (back button)
   - PaperclipHorizontal (image picker)
   - Smiley (emoji button)
   - PaperPlaneRight (send button)
   - Check (delivery status)
   - X (image viewer close)

**Expected Results:**
- ✅ All icons render as crisp SVG (not blurry)
- ✅ Icon sizes match specifications (12px, 14px, 16px, 20px, 24px)
- ✅ Icon colors match Whisk palette (#5DBB8E, #6B6B6B, #1A1A1A)
- ✅ Icon weights correct (regular, fill, bold)

**Notes:**
- phosphor-react-native@3.0.6 should be installed

---

### **TC-021: Edge Case - Empty Chat (No Messages)**

**Objective:** Verify chat screen when trade has no messages yet

**Prerequisites:** New trade with zero messages

**Steps:**
1. Navigate to chat screen for new trade

**Expected Results:**
- ✅ Empty state message: "No messages yet"
- ✅ "Start the conversation!" subtext
- ✅ Input bar fully functional
- ✅ No errors in console

---

### **TC-022: Regression - Existing Functionality**

**Objective:** Verify redesign didn't break core messaging features

**Steps:**
1. Send text message → ✅ works
2. Send image message → ✅ works
3. Receive message → ✅ appears in real-time
4. Mark as read → ✅ unread badge clears
5. Delivery status updates → ✅ transitions correctly
6. Navigate between screens → ✅ no crashes

**Expected Results:**
- ✅ All MODULE-07 MSG-001 through MSG-009 features still work
- ✅ No regressions in functionality
- ✅ Only visual changes (colors, icons, spacing)

---

## Regression Checklist

Run ALL of the following before marking FLOW-14 complete:

- [ ] `npm run typecheck` → PASS
- [ ] `npm run lint` → PASS (no new errors)
- [ ] `npm run test:unit` → PASS (messaging screen tests)
- [ ] `RUN_SUPABASE_E2E=true npm run test:e2e` → PASS (integration test)
- [ ] `npm run test:maestro:ios -- .maestro/module-15.1-flow-14-messaging.yaml` → PASS
- [ ] `npm run test:maestro:android -- .maestro/module-15.1-flow-14-messaging.yaml` → PASS
- [ ] All 22 manual test cases → PASS
- [ ] Visual QA on iOS Simulator → PASS
- [ ] Visual QA on Android Emulator → PASS
- [ ] No console errors during testing → PASS

---

## Known Limitations

1. **Apple Sign In:** Maestro cannot automate external OAuth flows (test manually)
2. **Real-time typing indicator:** Requires two active devices (cannot automate in single Maestro run)
3. **Image upload:** Maestro image picker may be flaky on some simulators

---

## Test Data Requirements (Staging Supabase)

Before testing, ensure staging DB has:
- ✅ 2+ test users with active sessions
- ✅ 1+ active trade between users
- ✅ 5+ messages in trade (mix of text + images)
- ✅ At least one user with `verification_status = 'approved'`
- ✅ At least one conversation with `unread_count > 0`

SQL to verify:
```sql
SELECT COUNT(*) FROM messages WHERE trade_id = 'test-trade-id';
SELECT verification_status FROM profiles WHERE user_id = 'test-user-id';
SELECT unread_count FROM trades_with_messages WHERE user_id = 'test-user-id';
```

---

## Sign-Off

**Tested By:** _________________  
**Date:** _________________  
**Environment:** iOS __ / Android __  
**All Tests Pass:** Yes ☐ / No ☐  
**Blockers:** _________________  

---

**End of Manual Testing Guide**
