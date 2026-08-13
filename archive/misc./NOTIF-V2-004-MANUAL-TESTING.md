# Manual Testing Guide: Badge Award Notifications
**Task:** NOTIF-V2-004  
**Module:** MODULE-14-NOTIFICATIONS-V2  
**Feature:** Badge award push notifications + in-app celebration

---

## Prerequisites

- [ ] Migration `143_badge_notifications.sql` deployed to production Supabase
- [ ] Migration `201_notifications_schema_v2.sql` deployed (notification schema)
- [ ] Test user account with access to earn badges
- [ ] iOS and Android simulators configured
- [ ] Push notification permissions granted in simulator
- [ ] `send-push-notification` Edge Function deployed

---

## Test Cases

### TC-01: Badge Award Notification Created (Database Trigger)
**Objective:** Verify notification row created when badge awarded

**Prerequisites:**
- User exists in database
- Badge exists and is active

**Steps:**
1. Run SQL to award badge manually:
   ```sql
   -- Use a badge the user has NOT earned yet
   INSERT INTO user_badges (user_id, badge_id)
   SELECT '<your-user-id>'::uuid, b.id
   FROM badges b
   LEFT JOIN user_badges ub
     ON ub.badge_id = b.id
    AND ub.user_id = '<your-user-id>'::uuid
   WHERE ub.id IS NULL
   ORDER BY b.sort_order ASC, b.created_at ASC
   LIMIT 1
   ON CONFLICT DO NOTHING;
   ```
2. Query notifications table:
   ```sql
   SELECT * FROM user_notifications
   WHERE user_id = '<your-user-id>'
     AND category = 'badges'
     AND type = 'badge_earned'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

**Expected Result:**
- ✅ Notification row created with:
  - `category = 'badges'`
  - `type = 'badge_earned'`
  - `title` contains "New Badge Earned"
  - `body` contains badge name and description
  - `data` JSON includes `badge_id`, `badge_name`, `deep_link`
  - `channels` array includes `push` and `in_app`

---

### TC-02: Badge Celebration Modal Displays on Profile Screen
**Objective:** Verify celebration modal shows when badge earned

**Prerequisites:**
- App running on iOS or Android simulator
- User logged in
- Badge not yet earned

**Steps:**
1. Open app and navigate to Profile screen
2. Open Supabase SQL Editor in browser
3. Award badge to user (see TC-01 step 1)
   - Important: Use a new unearned badge; if the badge is already earned, no insert event is emitted.
4. Wait 2-3 seconds for realtime subscription to fire
5. Observe app UI

**Expected Result:**
- ✅ Celebration modal appears automatically
- ✅ If badge is earned off-profile, opening Profile later still shows pending celebration once
- ✅ Modal displays:
  - Badge icon/emoji (centered, large)
  - Title: "🎉 New Badge Earned! 🎉"
  - Badge name (e.g., "Trader 10")
  - Badge description
  - "Awesome!" button
- ✅ Confetti animation plays
- ✅ Modal has semi-transparent dark overlay
- ✅ Pressing "Awesome!" closes modal
- ✅ Pressing overlay closes modal
- ✅ Celebration does not show again for the same badge after dismissal

---

### TC-03: Badge Celebration Modal Does Not Re-appear
**Objective:** Verify celebration only shown once per badge

**Prerequisites:**
- TC-02 completed (badge awarded and celebration dismissed)

**Steps:**
1. After dismissing celebration modal
2. Navigate away from Profile screen (e.g., to Home)
3. Navigate back to Profile screen
4. Observe UI

**Expected Result:**
- ✅ Celebration modal does NOT re-appear
- ✅ Badge shows in BadgeShowcase as earned

---

### TC-04: Milestone Approaching Notification (Within 5 SP)
**Objective:** Verify milestone notification sent when user close to badge

**Status:** Deprecated for MVP (challenge/milestone flows decommissioned)

**Prerequisites:**
- User has 46 SP available in sp_wallet
- Badge exists with threshold 50 and category 'sp_earning'
- User has not earned badge yet

**Steps:**
1. Run SQL to check milestones:
   ```sql
   SELECT check_badge_milestones('<your-user-id>');
   ```
2. Query notifications:
   ```sql
   SELECT * FROM user_notifications
   WHERE user_id = '<your-user-id>'
     AND category = 'badges'
     AND type = 'badge_milestone_approaching'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

**Expected Result:**
- ✅ Notification row created with:
  - `title` contains "Almost There!"
  - `body` contains "You need 4 more SP to unlock..."
  - `data` includes `remaining`, `threshold`, `current_progress`
  - `deep_link` = '/discovery'

---

### TC-05: Milestone Notification Deduplication (7-day window)
**Objective:** Verify milestone notification not sent twice

**Status:** Deprecated for MVP (challenge/milestone flows decommissioned)

**Prerequisites:**
- TC-04 completed (milestone notification sent)

**Steps:**
1. Run SQL again:
   ```sql
   SELECT check_badge_milestones('<your-user-id>');
   ```
2. Query notifications count:
   ```sql
   SELECT COUNT(*) FROM user_notifications
   WHERE user_id = '<your-user-id>'
     AND category = 'badges'
     AND type = 'badge_milestone_approaching'
     AND data->>'badge_id' = '<badge-id>'
     AND created_at > now() - interval '7 days';
   ```

**Expected Result:**
- ✅ Count remains 1 (no duplicate notification created)

---

### TC-06: Notification Respects User Preferences (Push Disabled)
**Objective:** Verify badge notifications respect user preferences

**Prerequisites:**
- User has notification preferences configured

**Steps:**
1. Disable push notifications for badges category:
   ```sql
   SELECT update_notification_preference(
     '<your-user-id>',
     'badges'::notification_category,
     false, -- push_enabled
     true,  -- in_app_enabled
     null   -- email_enabled
   );
   ```
2. Award badge (see TC-01 step 1)
3. Query notification channels:
   ```sql
   SELECT channels FROM user_notifications
   WHERE user_id = '<your-user-id>'
     AND category = 'badges'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

**Expected Result:**
- ✅ Notification `channels` array does NOT include 'push'
- ✅ Channels array DOES include 'in_app'
- ✅ No push notification received on device

---

### TC-07: Badge Award Notification for All Users (Not Subscription-Gated)
**Objective:** Verify badge notifications sent to free users

**Prerequisites:**
- Free user account (no active subscription)

**Steps:**
1. Log in as free user
2. Award badge to free user
3. Observe celebration modal

**Expected Result:**
- ✅ Celebration modal displays for free user
- ✅ Notification created in database
- ✅ Badge notifications NOT gated by subscription

---

### TC-08: Push Notification Delivery (iOS Simulator)
**Objective:** Verify push notification received on iOS device

**Prerequisites:**
- iOS simulator running
- Push notification permissions granted
- User push token saved to `push_tokens` table

**Steps:**
1. Open iOS simulator
2. Launch app and ensure logged in
3. Navigate to Profile screen
4. Award badge via SQL (TC-01 step 1)
5. Wait for push notification to appear

**Expected Result:**
- ✅ Push notification banner appears at top of screen
- ✅ Notification title: "New Badge Earned! 🏆"
- ✅ Notification body: "Congratulations! You earned..."
- ✅ Tapping notification opens app to /profile/badges

**Note:** Push notifications may not work on iOS Simulator. Test on physical device if available.

---

### TC-09: Push Notification Delivery (Android Simulator)
**Objective:** Verify push notification received on Android device

**Prerequisites:**
- Android simulator running
- Push notification permissions granted

**Steps:**
1. Open Android simulator
2. Launch app and ensure logged in
3. Navigate to Profile screen
4. Award badge via SQL
5. Pull down notification shade

**Expected Result:**
- ✅ Push notification visible in notification shade
- ✅ Notification expands to show full text
- ✅ Tapping notification opens app

**Note:** Push notifications may not work on Android Emulator. Test on physical device if available.

---

### TC-10: Confetti Animation Plays
**Objective:** Verify celebration animation renders correctly

**Prerequisites:**
- React Native app running with `BadgeCelebrationModal` (Animated confetti particles)

**Steps:**
1. Award badge and trigger celebration modal
2. Observe confetti animation

**Expected Result:**
- ✅ Confetti particles burst from multiple positions
- ✅ Animation lasts ~3 seconds
- ✅ Confetti particles have multiple colors
- ✅ Animation does not block modal interaction

---

### TC-11: Badge Icon Displays Correctly
**Objective:** Verify badge icon renders in celebration modal

**Prerequisites:**
- Badge has `icon_url` set to valid image URL

**Steps:**
1. Award badge with `icon_url`
2. Observe celebration modal

**Expected Result:**
- ✅ Badge image displays (not emoji fallback)
- ✅ Image loads without errors
- ✅ Image scales correctly in circular container

---

### TC-12: Emoji Fallback When No Icon
**Objective:** Verify emoji fallback for badges without icon_url

**Prerequisites:**
- Badge has `icon_url = NULL` or empty string

**Steps:**
1. Award badge without icon_url
2. Observe celebration modal

**Expected Result:**
- ✅ Emoji "🏆" displays instead of image
- ✅ Emoji renders large and centered
- ✅ No image load errors logged

---

## Test Summary

| Test Case | Description | Status |
|-----------|-------------|--------|
| TC-01 | Notification created in DB | ⬜ |
| TC-02 | Celebration modal displays | ⬜ |
| TC-03 | Modal does not re-appear | ⬜ |
| TC-04 | Milestone notification sent | ⬜ |
| TC-05 | Milestone deduplication | ⬜ |
| TC-06 | Respects user preferences | ⬜ |
| TC-07 | Works for free users | ⬜ |
| TC-08 | Push notification (iOS) | ⬜ |
| TC-09 | Push notification (Android) | ⬜ |
| TC-10 | Confetti animation | ⬜ |
| TC-11 | Badge icon displays | ⬜ |
| TC-12 | Emoji fallback works | ⬜ |

---

## Rollback Plan

If critical issues found:

1. **Disable trigger:**
   ```sql
   DROP TRIGGER IF EXISTS badge_earned_notification ON user_badges;
   ```

2. **Revert ProfileScreen changes:**
   - Remove BadgeCelebrationModal import and usage
   - Redeploy app

3. **Monitor:**
   - Check `notifications` table for orphaned rows
   - Verify no push notification spam
