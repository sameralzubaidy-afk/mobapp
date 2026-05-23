# MODULE-15.1 FLOW-17: Notifications Redesign - Manual Testing Guide

## Overview

This guide provides detailed manual testing procedures for the Notifications redesign (FLOW-17) in the Kids P2P Marketplace mobile app.

**Scope**: 2 screens redesigned with Whisk design system
- `NotificationCenterScreen.tsx` (main notifications list)
- `NotificationSettingsScreen.tsx` (notification preferences)

**Testing Time**: ~45 minutes (30 min NotificationCenter + 15 min Settings)

---

## Prerequisites

1. **Test Environment**:
   - iOS Simulator (iPhone 14 or later, iOS 16+)
   - Android Emulator (Pixel 5 or later, Android 12+)
   - Supabase staging database with seeded notifications

2. **Test Accounts**:
   - **Free User**: `free-user@passitup.test` / `TestPass123!`
   - **Kids Club+ Subscriber**: `subscriber@passitup.test` / `TestPass123!`

3. **Test Data** (seed if missing):
   ```sql
   -- Insert test notifications for free-user@passitup.test
   INSERT INTO user_notifications (user_id, category, type, title, body, is_read)
   VALUES
     ((SELECT id FROM auth.users WHERE email = 'free-user@passitup.test'), 'trades', 'trade_request', 'New trade request', 'You have a new trade request for Lego Set', false),
     ((SELECT id FROM auth.users WHERE email = 'free-user@passitup.test'), 'sp_events', 'sp_earned', 'SP Earned', 'You earned 50 SP from your recent trade', true),
     ((SELECT id FROM auth.users WHERE email = 'free-user@passitup.test'), 'safety', 'recall_alert', 'Safety Alert', 'A recalled item was detected in your listings', false),
     ((SELECT id FROM auth.users WHERE email = 'free-user@passitup.test'), 'badges', 'badge_earned', 'New Badge!', 'You earned the "First Trade" badge', true),
     ((SELECT id FROM auth.users WHERE email = 'free-user@passitup.test'), 'referrals', 'referral_signup', 'Friend Joined', 'Your friend Sarah signed up using your referral code', false);
   ```

4. **Tools**:
   - Expo Go app or EAS Build
   - Color picker tool (e.g., Digital Color Meter on macOS, Developer Options on Android)
   - Ruler tool for measuring pixel sizes

---

## Test Cases

### TC-1: NotificationCenter Header Row (Phosphor Icons + "Mark All Read" Link)

**Objective**: Verify header uses Phosphor icons and "Mark All Read" is a text link (NOT button)

**Steps**:
1. Open app and login as `free-user@passitup.test`
2. Navigate to Dashboard
3. Tap the bell icon in header → Navigate to NotificationCenterScreen
4. Observe header row:
   - **Back button**: Verify it shows Phosphor `ArrowLeft` icon (24px, black), NOT "‹ Back" text
   - **Title**: Verify "Notifications" text is centered (17px, semibold)
   - **"Mark All Read"**: Verify it's a TEXT LINK in green (#5DBB8E), NOT a button with border/background

**Expected Results**:
- ✅ Back button shows only the Phosphor ArrowLeft icon
- ✅ "Mark All Read" is plain text in green (#5DBB8E), right-aligned
- ✅ "Mark All Read" only visible when unread notifications exist

**Pass Criteria**: All 3 checks ✅

---

### TC-2: Unread Notification Row (#F7F7F7 Background + Bold Title)

**Objective**: Verify unread notifications use correct background and bold title

**Steps**:
1. From NotificationCenterScreen, locate an UNREAD notification (should have 2-3 unread from test data)
2. Inspect the unread notification row:
   - **Background color**: Use color picker → should be `#F7F7F7` (light gray)
   - **Title text**: Should be BOLD (fontWeight 700)
   - **No left border**: Verify there's NO blue border on left side (old design had this)
   - **No unread dot**: Verify there's NO red dot indicator on right side (old design had this)

**Expected Results**:
- ✅ Unread row background is `#F7F7F7` (not `#F0F7FF` blue tint from old design)
- ✅ Title is bold (e.g., "New trade request" in bold)
- ✅ No blue left border
- ✅ No red unread dot indicator

**Pass Criteria**: All 4 checks ✅

---

### TC-3: Read Notification Row (White Background + Regular Title)

**Objective**: Verify read notifications use white background and regular font weight

**Steps**:
1. From NotificationCenterScreen, locate a READ notification (should have "SP Earned" and "New Badge!" marked as read)
2. Inspect the read notification row:
   - **Background color**: Use color picker → should be `#FFFFFF` (white)
   - **Title text**: Should be REGULAR weight (fontWeight 400), NOT bold
   - **No visual indicators**: Should look identical to other read rows

**Expected Results**:
- ✅ Read row background is pure white `#FFFFFF`
- ✅ Title is regular weight (e.g., "SP Earned" in regular font)
- ✅ Visually distinct from unread rows (no gray background)

**Pass Criteria**: All 3 checks ✅

---

### TC-4: Notification Icon Colors by Category (FLOW-17 Spec)

**Objective**: Verify type-specific icon colors match FLOW-17 acceptance criteria

**Steps**:
1. From NotificationCenterScreen, locate each notification category:
   - **Trade** ("New trade request")
   - **SP Events** ("SP Earned")
   - **Safety** ("Safety Alert")
   - **Badges** ("New Badge!")
   - **Referrals** ("Friend Joined")

2. For each notification, inspect the icon circle (40px diameter):
   - **Trade/Message/Sale** (category: `trades`):
     - Background: `#E8F5F0` (green tint)
     - Icon: Phosphor `ShoppingCart`, color `#5DBB8E` (primary green)
   - **SP Events** (category: `sp_events`):
     - Background: `#FEF3C7` (gold tint)
     - Icon: Phosphor `CurrencyCircleDollar`, color `#F59E0B` (gold)
   - **Safety Alerts** (category: `safety`):
     - Background: `#FEE2E2` (red tint)
     - Icon: Phosphor `Warning`, color `#E85D75` (error red)
   - **Badges** (category: `badges`):
     - Background: `#FEF3C7` (gold tint)
     - Icon: Phosphor `Trophy`, color `#F59E0B` (gold)
   - **Referrals** (category: `referrals`):
     - Background: `#E8F5F0` (green tint)
     - Icon: Phosphor `Gift`, color `#5DBB8E` (green)

**Expected Results**:
- ✅ All icon circles are 40px diameter (measure with ruler tool)
- ✅ Trade notification icon has green tint background + green icon
- ✅ SP notification icon has gold tint background + gold icon
- ✅ Safety notification icon has red tint background + red icon
- ✅ Badge notification icon has gold tint background + trophy icon
- ✅ Referral notification icon has green tint background + gift icon
- ✅ NO emoji icons anywhere (🔔, 💳, ✨, etc.) - only Phosphor SVG icons

**Pass Criteria**: All 7 checks ✅

---

### TC-5: Empty State (Phosphor Bell Icon + "You're all caught up!")

**Objective**: Verify empty state uses Phosphor Bell icon and correct text

**Prerequisites**:
- Mark all notifications as read first (tap "Mark All Read")
- Then delete all notifications from database OR use a new test account with 0 notifications

**Steps**:
1. Navigate to NotificationCenterScreen with 0 notifications
2. Observe empty state:
   - **Icon**: Phosphor `Bell` icon, 64px, color `#E0E0E0` (light gray)
   - **Title**: "You're all caught up!" (18px, semibold)
   - **Body text**: "You'll see trade updates, SP events, badge awards, and more here."

**Expected Results**:
- ✅ Empty state icon is Phosphor Bell (NOT emoji 🔔)
- ✅ Icon size is 64px (measure with ruler)
- ✅ Icon color is light gray `#E0E0E0`
- ✅ Title says "You're all caught up!" (NOT "No notifications yet")
- ✅ Body text is descriptive and helpful

**Pass Criteria**: All 5 checks ✅

---

### TC-6: "Mark All Read" Functionality

**Objective**: Verify "Mark All Read" link marks all notifications as read

**Steps**:
1. Ensure there are 3+ unread notifications in the list
2. Count the number of unread rows (gray background `#F7F7F7`)
3. Tap "Mark All Read" link in header
4. Observe changes:
   - All notification rows should now have WHITE background
   - All titles should now be REGULAR weight (not bold)
   - "Mark All Read" link should DISAPPEAR from header

**Expected Results**:
- ✅ All rows transition from gray to white background
- ✅ All titles become regular weight
- ✅ "Mark All Read" link disappears after action
- ✅ No errors or crashes

**Pass Criteria**: All 4 checks ✅

---

### TC-7: Tap Notification → Mark as Read + Deep Link Navigation

**Objective**: Verify tapping a notification marks it as read and navigates to detail screen

**Steps**:
1. Locate an UNREAD notification (gray background)
2. Tap the notification row
3. Observe:
   - App should navigate to the relevant detail screen (e.g., TradeDetailScreen for trade notifications)
   - When navigating back to NotificationCenter, the tapped notification should now be READ (white background, regular title)

**Expected Results**:
- ✅ Notification is marked as read after tap
- ✅ Deep link navigation works correctly
- ✅ Background changes from gray to white
- ✅ Title changes from bold to regular

**Pass Criteria**: All 4 checks ✅

---

### TC-8: NotificationSettingsScreen - Header & Layout

**Objective**: Verify NotificationSettingsScreen header and section layout

**Prerequisites**:
- Navigate to NotificationSettingsScreen (TODO: verify navigation path once implemented)
- For now, you can manually navigate via deep link or directly open the screen in dev mode

**Steps**:
1. Open NotificationSettingsScreen
2. Observe header:
   - **Back button**: Phosphor `ArrowLeft` icon (24px, black)
   - **Title**: "Notification Settings" (17px, semibold, centered)
3. Observe sections:
   - **Section 1**: "Content Preferences" with description text
   - **Section 2**: "Delivery Methods" with description text

**Expected Results**:
- ✅ Back button shows Phosphor ArrowLeft icon
- ✅ Title is "Notification Settings"
- ✅ Two distinct sections with titles + descriptions
- ✅ Layout is clean with proper spacing

**Pass Criteria**: All 4 checks ✅

---

### TC-9: NotificationSettings - Switch Colors (FLOW-17 Spec)

**Objective**: Verify switches use correct Whisk trackColor values

**Steps**:
1. On NotificationSettingsScreen, locate all 6 setting rows:
   - Trade Updates
   - Swap Points
   - Badges & Achievements
   - Safety Alerts
   - Email Notifications
   - Push Notifications

2. For each switch, observe:
   - **OFF state**: Track color should be `#E0E0E0` (light gray)
   - **ON state**: Track color should be `#5DBB8E` (Whisk green)
   - **Thumb color**: Should be white `#FFFFFF` in both states

3. Toggle each switch ON and OFF to verify color transitions

**Expected Results**:
- ✅ OFF switches have light gray track (`#E0E0E0`)
- ✅ ON switches have green track (`#5DBB8E`)
- ✅ Thumb is always white
- ✅ Color transitions are smooth (no flicker)

**Pass Criteria**: All 4 checks ✅

---

### TC-10: NotificationSettings - Row Dividers (1px #F0F0F0)

**Objective**: Verify setting rows have correct bottom dividers

**Steps**:
1. On NotificationSettingsScreen, inspect the setting rows in each group:
   - **Content Preferences group**:
     - Trade Updates → SHOULD have divider
     - Swap Points → SHOULD have divider
     - Badges & Achievements → SHOULD have divider
     - Safety Alerts → NO divider (last in group)
   - **Delivery Methods group**:
     - Email Notifications → SHOULD have divider
     - Push Notifications → NO divider (last in group)

2. Measure divider properties:
   - **Height**: 1px
   - **Color**: `#F0F0F0` (very light gray)

**Expected Results**:
- ✅ First 3 rows in Content Preferences have bottom dividers
- ✅ Safety Alerts row has NO divider (last in group)
- ✅ Email row has divider
- ✅ Push row has NO divider (last in group)
- ✅ Dividers are 1px height, color `#F0F0F0`

**Pass Criteria**: All 5 checks ✅

---

### TC-11: NotificationSettings - Toggle Functionality

**Objective**: Verify toggles update state correctly

**Steps**:
1. On NotificationSettingsScreen, toggle each setting:
   - Trade Updates: OFF → ON → OFF
   - Swap Points: OFF → ON → OFF
   - Badges: OFF → ON → OFF
   - Safety Alerts: OFF → ON → OFF (note: footer says "always enabled" but toggle still works)
   - Email: ON → OFF → ON
   - Push: OFF → ON → OFF

2. Observe:
   - Switch should animate smoothly
   - Track color should change from gray to green (ON) or green to gray (OFF)
   - No crashes or errors

**Expected Results**:
- ✅ All switches toggle correctly
- ✅ State persists during session (TODO: verify persistence after app restart once backend integration is added)
- ✅ No crashes

**Pass Criteria**: All 3 checks ✅

---

### TC-12: NotificationSettings - Footer Note

**Objective**: Verify safety footer note with gold background

**Steps**:
1. Scroll to bottom of NotificationSettingsScreen
2. Observe footer note:
   - **Background**: `#FEF3C7` (gold tint)
   - **Left border**: 3px, color `#F59E0B` (gold accent)
   - **Text**: "Safety alerts are always enabled to keep you and your family safe."
   - **Text color**: `#1A1A1A` (Whisk black)

**Expected Results**:
- ✅ Footer note has gold background `#FEF3C7`
- ✅ Left border is 3px gold `#F59E0B`
- ✅ Text is clear and visible
- ✅ Message emphasizes safety is always on

**Pass Criteria**: All 4 checks ✅

---

### TC-13: Cross-Platform Consistency (iOS vs Android)

**Objective**: Verify FLOW-17 redesign looks identical on iOS and Android

**Steps**:
1. Run all above test cases on iOS Simulator
2. Run all above test cases on Android Emulator
3. Compare:
   - Icon sizes and colors
   - Background colors
   - Font weights (bold vs regular)
   - Switch track colors
   - Divider heights and colors

**Expected Results**:
- ✅ All colors match exactly on both platforms
- ✅ Icon sizes are consistent
- ✅ Font weights render correctly on both
- ✅ Switch colors match the spec on both
- ✅ No platform-specific bugs

**Pass Criteria**: All 5 checks ✅

---

### TC-14: Accessibility

**Objective**: Verify accessibility features work correctly

**Steps**:
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Navigate through NotificationCenterScreen:
   - Verify back button announces "Go back"
   - Verify "Mark All Read" announces "Mark all notifications as read"
   - Verify each notification row is tappable and announces title + body
3. Navigate through NotificationSettingsScreen:
   - Verify each switch announces setting label + current state
   - Verify toggle actions are accessible

**Expected Results**:
- ✅ All interactive elements have accessibility labels
- ✅ Screen reader announces correct text
- ✅ All actions are accessible via VoiceOver/TalkBack

**Pass Criteria**: All 3 checks ✅

---

## Summary Checklist

Before marking FLOW-17 as complete, verify:

- [ ] TC-1: Header uses Phosphor icons + "Mark All Read" is text link ✅
- [ ] TC-2: Unread rows have `#F7F7F7` background + bold title ✅
- [ ] TC-3: Read rows have white background + regular title ✅
- [ ] TC-4: Icon colors match spec (trade=green, SP=gold, safety=red) ✅
- [ ] TC-5: Empty state uses Phosphor Bell (64px, #E0E0E0) + "You're all caught up!" ✅
- [ ] TC-6: "Mark All Read" functionality works ✅
- [ ] TC-7: Tap notification → mark as read + navigate ✅
- [ ] TC-8: NotificationSettingsScreen header + layout ✅
- [ ] TC-9: Switches use trackColor `#E0E0E0` (off) and `#5DBB8E` (on) ✅
- [ ] TC-10: Setting rows have 1px `#F0F0F0` dividers (except last) ✅
- [ ] TC-11: Toggle functionality works ✅
- [ ] TC-12: Footer note has gold background ✅
- [ ] TC-13: Cross-platform consistency (iOS vs Android) ✅
- [ ] TC-14: Accessibility (VoiceOver/TalkBack) ✅

**Total Test Cases**: 14  
**Estimated Time**: 45 minutes  
**PASS Threshold**: 14/14 (100%)

---

## Known Limitations

1. **NotificationSettingsScreen Navigation**: Navigation path not yet integrated into main app flow. May need to access via deep link or dev mode for testing.
2. **Persistence**: Toggle state currently stored in component state only (not persisted to backend/AsyncStorage).
3. **Real-time Updates**: Notification badge count on dashboard may not update immediately after marking as read (refresh required).

---

## Reporting Issues

If any test case fails, report with:
- Test Case ID (e.g., TC-4)
- Platform (iOS/Android)
- Device (Simulator model)
- Screenshot showing the issue
- Expected vs Actual behavior
- Steps to reproduce

Create GitHub issue with label: `MODULE-15.1`, `FLOW-17`, `bug`
