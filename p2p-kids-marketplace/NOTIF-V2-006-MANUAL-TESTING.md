# NOTIF-V2-006 Manual Testing Guide  
## In-App Notification Center

**Module:** MODULE-14 — Notifications V2  
**Task:** NOTIF-V2-006  
**Screen:** `NotificationCenterScreen`  
**Entry point:** BottomNavBar → 🔔 **Alerts** tab  
**Deep link:** `p2pkidsmarketplace://notifications`

---

## Prerequisites

- iOS Simulator (iPhone 15 Pro or later) **or** Android Emulator (Pixel 7 or later)
- Signed-in test user in staging Supabase
- At least 3 unread notifications in `user_notifications` for the test user
- At least 21 notifications total to test infinite scroll pagination

To seed test notifications run this SQL in Supabase Studio against the staging project:

```sql
-- Replace 'YOUR-USER-ID' with the actual auth.uid()
INSERT INTO user_notifications (user_id, category, type, title, body, channels, data, is_read)
SELECT
  'YOUR-USER-ID',
  'system',
  'test_notif_' || g,
  'Test Notification ' || g,
  'This is test body for notification ' || g,
  ARRAY['in_app'],
  '{"deep_link": "/wallet"}',
  CASE WHEN g % 3 = 0 THEN true ELSE false END
FROM generate_series(1, 25) AS g;
```

---

## TC Inventory

| ID | Description | Platform | Priority |
|---|---|---|---|
| TC-001 | Navigate to Notification Center via BottomNavBar | iOS + Android | P0 |
| TC-002 | Badge count shown on 🔔 Alerts tab | iOS + Android | P0 |
| TC-003 | Notification list renders | iOS + Android | P0 |
| TC-004 | Unread indicator displayed for unread items | iOS + Android | P0 |
| TC-005 | "Mark all read" button visible when unread exist | iOS + Android | P0 |
| TC-006 | Mark single notification as read | iOS + Android | P0 |
| TC-007 | Mark all notifications as read | iOS + Android | P0 |
| TC-008 | "Mark all read" button hidden after all read | iOS + Android | P1 |
| TC-009 | Pull-to-refresh reloads list | iOS + Android | P1 |
| TC-010 | Infinite scroll loads next page | iOS + Android | P1 |
| TC-011 | Empty state shown when no notifications | iOS + Android | P1 |
| TC-012 | Loading state shown on initial load | iOS + Android | P2 |
| TC-013 | Error state shown + retry works | iOS + Android | P1 |
| TC-014 | Deep link navigation from notification tap | iOS + Android | P1 |
| TC-015 | Back button returns to previous screen | iOS + Android | P0 |
| TC-016 | Realtime: new notification prepended to list | iOS + Android | P1 |
| TC-017 | Badge count decrements after mark-read | iOS + Android | P1 |
| TC-018 | Deep link `p2pkidsmarketplace://notifications` navigates to screen | iOS + Android | P2 |

---

## Test Cases

### TC-001 — Navigate to Notification Center via BottomNavBar

**Steps:**
1. Sign in with the test user.
2. Wait for the Home/Dashboard screen to fully load.
3. Locate the bottom navigation bar.
4. Tap the **🔔 Alerts** tab.

**Expected result:**
- The Notification Center screen opens.
- The screen title "Notifications" is visible at the top.
- A list of notifications is displayed (or an empty state message if none exist).

---

### TC-002 — Badge count shown on 🔔 Alerts tab

**Pre-condition:** Test user has at least 1 unread notification.

**Steps:**
1. Navigate to the Home/Dashboard screen.
2. Look at the **🔔 Alerts** tab in the bottom nav.

**Expected result:**
- A **red badge** with a number (e.g. `3`) appears in the top-right corner of the 🔔 emoji.
- The count matches the number of unread notifications in the DB.

---

### TC-003 — Notification list renders

**Pre-condition:** At least 3 seeded notifications exist.

**Steps:**
1. Navigate to the Notification Center screen (TC-001).
2. Observe the list.

**Expected result:**
- Each notification shows:
  - A category emoji icon (📢 for system, ✨ for sp_events, 🏆 for badges, etc.)
  - **Title** text (bold for unread)
  - Body text (2 lines max)
  - Relative time (e.g. "just now", "5m ago", "2h ago", "3d ago")
- Items are ordered newest-first.

---

### TC-004 — Unread indicator displayed for unread items

**Pre-condition:** At least 1 notification has `is_read = false`.

**Steps:**
1. Open the Notification Center.
2. Observe unread notification rows.

**Expected result:**
- Unread notifications have a **blue left border** (3px, `#007AFF`).
- Unread notifications have a **small blue filled dot** (🔵) above the category icon.
- Unread titles appear **bold**.
- Read notifications have no left border and no dot.

---

### TC-005 — "Mark all read" button visible when unread exist

**Pre-condition:** At least 1 unread notification exists.

**Steps:**
1. Open the Notification Center.
2. Observe the header area.

**Expected result:**
- The **"Mark all read"** button is visible in the top-right of the header.

---

### TC-006 — Mark single notification as read

**Steps:**
1. Open the Notification Center.
2. Tap an **unread** notification (blue left border).

**Expected result:**
- The **blue left border and dot disappear immediately** (optimistic update).
- The title becomes normal weight (not bold).
- The notification is retained in the list (not removed).
- In the DB: `is_read = true` and `read_at` is set on that row (verify in Supabase Studio).
- If the notification has a `deep_link` in its `data` field, the user navigates to that screen.

---

### TC-007 — Mark all notifications as read

**Pre-condition:** At least 2 unread notifications exist.

**Steps:**
1. Open the Notification Center.
2. Tap **"Mark all read"**.

**Expected result:**
- All unread indicators (blue borders, dots) disappear immediately.
- The "Mark all read" button disappears from the header.
- In the DB: all `user_notifications.is_read = true` for this user.

---

### TC-008 — "Mark all read" button hidden after all read

**Steps (continuation of TC-007):**
1. After tapping "Mark all read" in TC-007.
2. Observe the header.

**Expected result:**
- The **"Mark all read" button is no longer visible**.
- The header shows only the back button (`‹ Back`) and the title.

---

### TC-009 — Pull-to-refresh reloads list

**Steps:**
1. Open the Notification Center.
2. While on the notifications tab, insert a new notification in Supabase Studio (or wait for a realtime insert).
3. Swipe **down** from the top of the list and release to trigger pull-to-refresh.

**Expected result:**
- A spinner/activity indicator appears briefly.
- The list refreshes and the newly inserted notification appears at the top.

---

### TC-010 — Infinite scroll loads next page

**Pre-condition:** At least 21 notifications exist in the DB for the test user.

**Steps:**
1. Open the Notification Center.
2. Scroll down through the first 20 items.
3. Keep scrolling past the last visible item.

**Expected result:**
- A small **loading spinner** (`load-more-indicator`) appears at the bottom briefly.
- Additional notifications load and are appended to the list.
- The list now shows more than 20 items.
- Once all notifications are loaded, no further spinner appears.

---

### TC-011 — Empty state shown when no notifications

**Pre-condition:** Use a fresh test user with 0 notifications, OR delete all rows for the test user.

**Steps:**
1. Sign in as the no-notifications test user.
2. Open the Notification Center.

**Expected result:**
- The empty state is shown:
  - 🔔 emoji icon
  - Text: "No notifications yet"
  - Body text explaining what kinds of notifications will appear

---

### TC-012 — Loading state shown on initial load

**Steps:**
1. Open the Notification Center on a **slow network** (simulate via simulator network throttle: Settings → Developer → Network Link Conditioner → Edge/3G).
2. Navigate to the Notification Center.

**Expected result:**
- A **full-screen loading spinner** (`ActivityIndicator`) is visible while data loads.
- Once loaded, the spinner disappears and the list (or empty state) renders.

---

### TC-013 — Error state shown + retry works

**Steps:**
1. **Disable network** on the simulator/emulator (Airplane Mode or remove Wi-Fi).
2. Navigate to the Notification Center.

**Expected result:**
- An **error state** is shown:
  - ⚠️ emoji
  - Title: "Something went wrong"
  - Error message text
  - **"Try again"** button visible

3. Re-enable network.
4. Tap **"Try again"**.

**Expected result after retry:**
- The loading spinner appears briefly.
- The notification list loads successfully.

---

### TC-014 — Deep link navigation from notification tap

**Pre-condition:** At least 1 notification has `data.deep_link = '/wallet'` or similar.

**Steps:**
1. Open the Notification Center.
2. Tap a notification that has a known deep link (e.g. type `sp_earned` → routes to `/wallet`).

**Expected result:**
- The app navigates to the deep link target screen (e.g. SP Wallet screen).
- The notification is marked as read.

---

### TC-015 — Back button returns to previous screen

**Steps:**
1. Navigate from the **Home dashboard** to Notification Center.
2. Tap the **"‹ Back"** button at the top-left.

**Expected result:**
- The app returns to the **Home/Dashboard screen**.
- The BottomNavBar is visible on the dashboard.

---

### TC-016 — Realtime: new notification prepended to list

**Pre-condition:** The Notification Center is open and visible.

**Steps:**
1. Open the Notification Center.
2. In Supabase Studio, insert a new notification row for the test user (`is_read = false`).

**Expected result:**
- Within ~1–2 seconds, the **new notification appears at the top** of the list without any manual refresh.
- The badge count on the 🔔 Alerts tab increments by 1.

---

### TC-017 — Badge count decrements after marking all as read

**Pre-condition:** Test user has 3+ unread notifications. Badge shows `3`.

**Steps:**
1. Observe the badge count on the 🔔 Alerts tab (should show `3`).
2. Open the Notification Center.
3. Tap **"Mark all read"**.
4. Navigate back to the dashboard.

**Expected result:**
- The badge on the 🔔 Alerts tab is **no longer visible** (unreadCount = 0).

---

### TC-018 — Deep link `p2pkidsmarketplace://notifications` navigates to screen

**Platform:** iOS only (deep link testing via simulator URL open)

**Steps:**
1. With the app running, open Simulator → Device → Open URL.
2. Enter: `p2pkidsmarketplace://notifications`
3. Tap **Open**.

**Expected result (iOS):**
- The app brings the Notification Center screen into focus.
- If the app was in the background, it foregrounds and navigates directly to Notifications.

**Platform:** Android

**Steps:**
1. Run in terminal:
   ```bash
   adb shell am start -W -a android.intent.action.VIEW -d "p2pkidsmarketplace://notifications" com.sameralzubaidi.p2pkidsmarketplace
   ```

**Expected result (Android):**
- The Notification Center screen is displayed.

---

## Regression Checklist

After completing all test cases, verify:

- [ ] TC-001 PASS: Bottom nav navigates to Notification Center
- [ ] TC-002 PASS: Badge count shown for unread
- [ ] TC-003 PASS: List renders with icon, title, body, time
- [ ] TC-004 PASS: Unread items have blue border + dot
- [ ] TC-005 PASS: "Mark all read" visible when unread exist
- [ ] TC-006 PASS: Single tap marks notification read
- [ ] TC-007 PASS: "Mark all read" updates all items
- [ ] TC-008 PASS: Button hidden after all read
- [ ] TC-009 PASS: Pull-to-refresh works
- [ ] TC-010 PASS: Infinite scroll loads page 2+
- [ ] TC-011 PASS: Empty state renders
- [ ] TC-012 PASS: Loading spinner on initial load
- [ ] TC-013 PASS: Error state + retry works
- [ ] TC-014 PASS: Deep link navigation from tap
- [ ] TC-015 PASS: Back button works
- [ ] TC-016 PASS: Realtime insert appears in list
- [ ] TC-017 PASS: Badge count clears after mark-all-read
- [ ] TC-018 PASS: `p2pkidsmarketplace://notifications` deep link

---

## Automated Tests

```bash
# Unit tests (always run locally)
cd p2p-kids-marketplace
npm run test:unit -- --testPathPattern=NotificationCenterScreen

# E2E tests (requires live Supabase staging)
RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=notification-center

# Maestro UI tests
npm run test:maestro:ios    # iOS Simulator
npm run test:maestro:android  # Android Emulator
```

---

## Known Limitations

- TC-016 (Realtime) requires network connectivity and Supabase Realtime to be active; will not work in fully offline test.
- TC-018 deep link requires the app to be built with the correct URL scheme; Expo Go may not support custom deep links — use a development build.
- The `useNotificationBadge` hook increments the badge count optimistically on realtime insert without re-fetching from DB; after mark-all-read, count resets to 0 via local state (not re-fetched until next mount or manual `refresh()` call).
