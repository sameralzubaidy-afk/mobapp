# MODULE-15.1 FLOW-16: Home Dashboard - Manual Testing Guide

## Overview
This document provides step-by-step test cases for manually verifying the Home Dashboard redesign (FLOW-16) on iOS and Android simulators/devices.

---

## Prerequisites

1. **Environment Setup:**
   - Supabase production URL and anon key configured in `.env.local`
   - Test user accounts created (free + Kids Club+ subscriber)
   - iOS Simulator or Android Emulator running
   - Expo app installed and running

2. **Test User Accounts:**
   - **Free User:** `freeuser@example.com` / `TestPassword123!`
   - **Subscribed User:** `subscriber@example.com` / `TestPassword123!`
   - Ensure subscriber has active subscription with `can_spend_sp = true`
   - Ensure subscriber has SP balance (available > 0, pending > 0 if possible)
   - Create 1-2 unread notifications for subscriber to test badge

3. **Commands to Run App:**
   ```bash
   npm start
   # Then: 'i' for iOS simulator, 'a' for Android emulator
   ```

---

## Test Case 1: Header Row - Avatar + Greeting + Notification Bell

**Objective:** Verify the header displays avatar (40px), time-based greeting, and Bell icon with badge.

**Steps:**
1. Login as subscribed user (`subscriber@example.com`)
2. Observe the header row at the top of the dashboard

**Expected Results:**
- ✅ Avatar is 40px, round, displays user's avatar (or placeholder emoji)
- ✅ Greeting text shows time-based message:
  - "Good morning, [Name]!" (5 AM - 12 PM)
  - "Good afternoon, [Name]!" (12 PM - 5 PM)
  - "Good evening, [Name]!" (5 PM - 5 AM)
- ✅ Name extracted from `user_metadata.full_name` (first name only)
- ✅ Fallback to "Friend" if no name exists
- ✅ Bell icon (Phosphor, 24px, #1A1A1A color) is visible
- ✅ Red badge (8px circle, #E85D75) appears on bell if `unreadCount > 0`
- ✅ Badge does NOT appear if `unreadCount = 0`

**Actions:**
1. Tap avatar → navigates to Profile screen
2. Tap Bell icon → navigates to Notifications screen

**Pass Criteria:**
- All visual elements match design specs (size, color, placement)
- Navigation works correctly
- Badge visibility matches unread count state

---

## Test Case 2: SP Balance Strip (Green Background)

**Objective:** Verify the SP balance strip displays correctly with Phosphor Coins icon.

**Steps:**
1. Login as subscribed user with SP balance
2. Scroll to top of dashboard (if needed)
3. Observe the green SP strip below the header

**Expected Results:**
- ✅ Background color is #5DBB8E (primary green)
- ✅ Phosphor Coins icon (white, regular weight) is shown on the left
- ✅ Balance text shows: `"250 SP"` (or actual available balance)
- ✅ Font: 18px, bold (700), white color
- ✅ "Earn More →" text is shown on the right (14px, white, opacity 0.9)
- ✅ Strip has 8px borderRadius, 16px horizontal padding, 12px vertical padding

**Actions:**
1. Tap anywhere on the SP strip → navigates to SpWallet screen

**Pass Criteria:**
- Strip only appears for subscribed users (`can_spend_sp = true`)
- Free users do NOT see the SP strip
- Navigation to SpWallet works

---

## Test Case 3: Quick Action Tiles (4-Column Grid)

**Objective:** Verify 4 action tiles display with correct Phosphor icons and navigation.

**Steps:**
1. Login as any user
2. Observe the 4-tile row below the SP strip (or below header if free user)

**Expected Results:**
- ✅ 4 tiles in a horizontal row with equal width (`flex: 1`)
- ✅ Each tile has:
  - White background (#FFFFFF)
  - 12px borderRadius
  - Subtle shadow (elevation: 2, shadowOpacity: 0.06)
  - 12px padding
  - Phosphor icon (24px, #1A1A1A) centered
  - Label text below icon (12px, #1A1A1A, fontWeight 500, marginTop 6px)
- ✅ Tile 1: **Storefront** icon + "Sell" label
- ✅ Tile 2: **ArrowsLeftRight** icon + "Trade" label
- ✅ Tile 3: **MagnifyingGlass** icon + "Discover" label
- ✅ Tile 4: **Package** icon + "My Trades" label
- ✅ Gap between tiles is 12px

**Actions:**
1. Tap "Sell" tile → navigates to ListingCreate screen
2. Tap "Trade" tile → navigates to Discovery screen
3. Tap "Discover" tile → navigates to Discovery screen
4. Tap "My Trades" tile → navigates to MyTrades screen

**Pass Criteria:**
- All icons use Phosphor React Native (NOT Ionicons)
- All navigation actions work correctly
- Visual styling matches Whisk design system

---

## Test Case 4: Section Headers with "See All" Links

**Objective:** Verify section headers follow the design specs (bold title + green "See All").

**Steps:**
1. Scroll down to the "Nearby Items" section (or any other section with a header)
2. Observe the section header row

**Expected Results:**
- ✅ Header row uses `flexDirection: 'row'`, `justifyContent: 'space-between'`
- ✅ Section title: "Nearby Items" (or other section name)
  - Font: 16px, fontWeight 600, color #1A1A1A
- ✅ "See All" link on the right:
  - Font: 14px, color #5DBB8E (primary green)
- ✅ Padding: 16px horizontal, 12px vertical

**Actions:**
1. Tap "See All" → navigates to Discovery screen (or appropriate target)

**Pass Criteria:**
- "See All" link is green (#5DBB8E), not blue
- Navigation works correctly

---

## Test Case 5: Free User Experience (No SP Strip)

**Objective:** Verify free users do NOT see the SP balance strip.

**Steps:**
1. Logout if logged in
2. Login as free user (`freeuser@example.com`)
3. Observe the dashboard

**Expected Results:**
- ✅ Header row is visible (avatar + greeting + bell)
- ✅ SP balance strip is NOT visible
- ✅ Quick action tiles are visible
- ✅ Section headers and content are visible
- ✅ SP wallet card is either not shown OR shows "Locked" state (depending on implementation)

**Pass Criteria:**
- Free users cannot see SP-related UI elements (except explanatory banners/cards)

---

## Test Case 6: Notification Badge Dynamic Update

**Objective:** Verify the notification badge count updates when new notifications arrive.

**Steps:**
1. Login as subscribed user
2. Note the current badge count on the Bell icon
3. Create a new notification for this user (via Supabase dashboard or another device)
4. Wait for realtime subscription to update

**Expected Results:**
- ✅ Badge count increments by 1 when new notification is received
- ✅ Badge appears if it was previously hidden (count went from 0 to 1)

**Pass Criteria:**
- Realtime subscription works
- Badge updates without manual refresh

---

## Test Case 7: Pull-to-Refresh

**Objective:** Verify pull-to-refresh updates dashboard data.

**Steps:**
1. Login as subscribed user
2. Pull down on the ScrollView to trigger refresh
3. Observe loading indicator

**Expected Results:**
- ✅ Pull-to-refresh gesture triggers refresh action
- ✅ Loading indicator appears briefly
- ✅ Dashboard data refreshes (SP balance, notifications, recommendations, etc.)

**Pass Criteria:**
- Refresh completes without errors
- UI updates with fresh data

---

## Test Case 8: Design System Compliance (Visual Inspection)

**Objective:** Manually verify the dashboard matches Whisk design system specs.

**Checklist:**
- ✅ Background color is white (#FFFFFF)
- ✅ All primary text is #1A1A1A
- ✅ All secondary text is #6B6B6B
- ✅ All green accents use #5DBB8E (primary green)
- ✅ Red badge uses #E85D75 (error red)
- ✅ Cards have 12px borderRadius, subtle shadows (elevation: 2)
- ✅ Spacing is consistent (16-24px padding)
- ✅ NO Ionicons used (all icons are Phosphor)
- ✅ NO emojis used in place of icons (except legacy placeholders if any)

**Pass Criteria:**
- Visual inspection confirms compliance
- No color/spacing deviations from design specs

---

## Test Case 9: Error States (No Session)

**Objective:** Verify dashboard handles missing session gracefully.

**Steps:**
1. Logout completely
2. Somehow navigate to dashboard without logging in (edge case)

**Expected Results:**
- ✅ Dashboard shows "Unable to load dashboard" error message
- ✅ No crash or white screen
- ✅ User is prompted to log in or refresh

**Pass Criteria:**
- Error handling is user-friendly

---

## Test Case 10: Cross-Platform Consistency (iOS vs Android)

**Objective:** Verify the dashboard looks consistent on both platforms.

**Steps:**
1. Run the same test cases on iOS Simulator
2. Run the same test cases on Android Emulator
3. Compare screenshots side-by-side

**Expected Results:**
- ✅ Layout is identical (or platform-specific differences are intentional)
- ✅ Icons render correctly on both platforms
- ✅ Shadows/elevations render correctly (Android uses elevation, iOS uses shadow props)
- ✅ Touch targets are accessible (minimum 44x44 points on iOS, 48x48 dp on Android)

**Pass Criteria:**
- No major visual regressions between platforms
- All interactions work on both platforms

---

## Summary

**Total Test Cases:** 10

**How to Report Issues:**
- Create a GitHub issue with:
  - Test case number (e.g., "TC-3: Quick Action Tiles")
  - Platform (iOS/Android)
  - Expected vs Actual behavior
  - Screenshot or screen recording
  - Device/Simulator info (e.g., "iPhone 15 Simulator, iOS 17.5")

**Commands Reference:**
```bash
# Run app
npm start

# Run unit tests
npm run test:unit

# Run integration tests
RUN_SUPABASE_E2E=true npm run test:e2e

# Run Maestro flow
npm run test:maestro:ios
npm run test:maestro:android

# Typecheck
npm run typecheck

# Lint
npm run lint
```

---

**Test Coverage:** This manual testing guide covers all MODULE-15.1 FLOW-16 acceptance criteria:
- ✅ Header row with avatar, greeting, bell + badge
- ✅ SP balance strip (subscribers only)
- ✅ Quick action tiles with Phosphor icons
- ✅ Section headers with green "See All" links
- ✅ Design system compliance (colors, spacing, typography)
- ✅ Navigation flows
- ✅ Free vs subscribed user experience
- ✅ Cross-platform consistency
