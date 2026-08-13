# Manual Test Cases: Notification Preferences

**MODULE-14: NOTIF-V2-001 - Notification Schema & Preferences**

**Last Updated:** 2025-01-XX  
**Test Environment:** iOS Simulator 17.0+ / Android Emulator API 33+  
**Precondition:** User must be logged in with email/password auth

---

## Test Setup

### Prerequisites

1. ✅ Supabase migrations applied (201_notifications_schema_v2.sql)
2. ✅ App built and running on simulator: `npm run ios` OR `npm run android`
3. ✅ Test user account created (or use existing account)
4. ✅ Network connectivity enabled on simulator

### Test Data Requirements

- **Test User:** Any registered user
- **Database State:** notification_preferences table should have 5 rows per user (auto-initialized)

---

## TC-NOTIF-001: View Default Notification Preferences

**Objective:** Verify default notification preferences are displayed correctly

### Preconditions

- User is logged in
- User has just been created (or preferences reset to defaults)

### Steps

1. From bottom tab navigation, tap **Profile** tab
2. Tap **Settings** in profile screen
3. Tap **Notification Preferences** row
4. Observe the screen content

### Expected Results

- ✅ Screen title displays "Notification Preferences"
- ✅ 5 category sections render:
  - Subscription Updates (with trophy icon)
  - Swap Points Events (with coins icon)
  - Badges & Achievements (with award icon)
  - Trade Activity (with package icon)
  - System Notifications (with bell icon)
- ✅ Each category shows 3 toggles:
  - Push Notifications (ON by default)
  - In-App Notifications (ON by default)
  - Email Notifications (ON for critical categories: subscription, system)
- ✅ Quiet Hours section displays:
  - "Enable Quiet Hours" toggle (ON by default)
  - Start time: 22:00 (default)
  - End time: 08:00 (default)
- ✅ No loading spinner visible
- ✅ No error messages displayed

### Pass/Fail Criteria

- **PASS:** All expected UI elements visible with correct default values
- **FAIL:** Any toggle shows incorrect default state, or UI elements missing

---

## TC-NOTIF-002: Toggle Push Notifications OFF

**Objective:** Verify user can disable push notifications for a category

### Preconditions

- User is on Notification Preferences screen
- Push notification toggle for "Subscription Updates" is ON

### Steps

1. Locate "Subscription Updates" section
2. Tap the **Push Notifications** toggle switch
3. Observe UI feedback
4. Wait 2 seconds
5. Navigate back to Settings screen
6. Re-enter Notification Preferences screen
7. Scroll to "Subscription Updates" section

### Expected Results

- ✅ Toggle switch animates OFF immediately (optimistic update)
- ✅ Toast/banner displays "Preference saved" OR "Saved" message
- ✅ No error alert appears
- ✅ After re-entering screen, toggle remains OFF (persistence verified)
- ✅ Other toggles in same category remain unchanged

### Pass/Fail Criteria

- **PASS:** Toggle persists OFF state after navigation
- **FAIL:** Toggle reverts to ON, or error occurs

---

## TC-NOTIF-003: Toggle Multiple Channels Simultaneously

**Objective:** Verify user can toggle multiple notification channels for a category

### Preconditions

- User is on Notification Preferences screen

### Steps

1. Locate "Trade Activity" section
2. Tap **Push Notifications** toggle (turn OFF)
3. Wait 1 second for save confirmation
4. Tap **In-App Notifications** toggle (turn OFF)
5. Wait 1 second for save confirmation
6. Tap **Email Notifications** toggle (turn ON)
7. Wait 1 second for save confirmation
8. Navigate back and re-enter screen

### Expected Results

- ✅ Each toggle change triggers a save confirmation
- ✅ No errors occur
- ✅ After re-entering:
  - Push: OFF
  - In-App: OFF
  - Email: ON
- ✅ Toggles in other categories remain unchanged

### Pass/Fail Criteria

- **PASS:** All 3 channel states persist correctly
- **FAIL:** Any toggle reverts to previous state

---

## TC-NOTIF-004: Enable and Configure Quiet Hours

**Objective:** Verify quiet hours can be enabled and time ranges configured

### Preconditions

- User is on Notification Preferences screen
- Quiet Hours toggle is OFF

### Steps

1. Scroll to "Quiet Hours" section at bottom
2. Tap **Enable Quiet Hours** toggle (turn ON)
3. Observe time picker controls appear
4. Tap **Start Time** picker
5. Select **23:00** from iOS/Android time picker
6. Tap **Done** or confirm selection
7. Tap **End Time** picker
8. Select **07:00** from iOS/Android time picker
9. Tap **Done** or confirm selection
10. Navigate back and re-enter screen

### Expected Results

- ✅ Quiet Hours toggle turns ON immediately
- ✅ Time pickers render below toggle
- ✅ Native time picker opens on tap (iOS Wheel Picker / Android Clock Picker)
- ✅ Selected times display correctly:
  - Start: 23:00
  - End: 07:00
- ✅ After re-entering screen, quiet hours remain enabled with correct times

### Pass/Fail Criteria

- **PASS:** Quiet hours enabled with correct time range, persists after navigation
- **FAIL:** Time pickers don't work, or values don't persist

---

## TC-NOTIF-005: Disable Quiet Hours

**Objective:** Verify quiet hours can be disabled

### Preconditions

- User is on Notification Preferences screen
- Quiet Hours toggle is ON

### Steps

1. Scroll to "Quiet Hours" section
2. Tap **Enable Quiet Hours** toggle (turn OFF)
3. Observe time picker controls
4. Navigate back and re-enter screen

### Expected Results

- ✅ Quiet Hours toggle turns OFF immediately
- ✅ Time pickers disappear or gray out
- ✅ After re-entering screen, quiet hours remain disabled
- ✅ Previously set times are preserved in database (for re-enabling)

### Pass/Fail Criteria

- **PASS:** Quiet hours disabled and persists
- **FAIL:** Time pickers still active, or state doesn't persist

---

## TC-NOTIF-006: Test Network Error Handling

**Objective:** Verify graceful error handling when network is unavailable

### Preconditions

- User is on Notification Preferences screen
- Network connectivity enabled

### Steps

1. On iOS Simulator: **Device → Trigger Condition → Network Link Conditioner → 100% Loss**
   OR on Android Emulator: **Extended Controls → Cellular → Data status OFF**
2. Tap any toggle switch (e.g., "Badges - Push Notifications")
3. Observe UI behavior
4. Wait 5 seconds
5. Re-enable network connectivity
6. Tap any toggle switch again

### Expected Results

- ✅ During network outage:
  - Toggle animates optimistically
  - After timeout (~3-5 seconds), error Alert displays:
    - Title: "Update Failed" OR "Network Error"
    - Message: Describes connection issue
    - Button: "OK"
  - Toggle reverts to previous state
- ✅ After network restored:
  - Toggle update succeeds
  - "Saved" confirmation appears
  - No lingering error state

### Pass/Fail Criteria

- **PASS:** App handles network errors gracefully with clear messaging
- **FAIL:** App crashes, hangs, or shows no error feedback

---

## TC-NOTIF-007: Test RLS Policy Enforcement (Security)

**Objective:** Verify users can only modify their own notification preferences

**⚠️ CRITICAL SECURITY TEST**

### Preconditions

- Two test user accounts:
  - User A (logged in)
  - User B (exists in database)
- User A's user_id known
- User B's user_id known

### Steps

1. Log in as **User A**
2. Navigate to Notification Preferences screen
3. Observe preferences loaded for User A
4. **(Manual DB Query)** In Supabase SQL Editor, execute:
   ```sql
   SELECT * FROM notification_preferences WHERE user_id = '<User_B_ID>';
   ```
5. Note User B's current push_enabled state for 'subscription' category
6. **(Attempted RLS Bypass)** In Supabase SQL Editor, execute:
   ```sql
   UPDATE notification_preferences
   SET push_enabled = false
   WHERE user_id = '<User_B_ID>' AND category = 'subscription';
   ```
   _(Using anon key context, not service role)_
7. Check query result

### Expected Results

- ✅ User A sees only their own preferences in the app
- ✅ Manual SQL query in Step 4 fails with RLS error **OR** returns 0 rows updated
- ✅ User B's preferences remain unchanged
- ✅ No cross-user data leakage

### Pass/Fail Criteria

- **PASS:** RLS prevents User A from modifying User B's preferences
- **FAIL:** Update succeeds, indicating RLS policy misconfiguration

---

## TC-NOTIF-008: Test All Categories Independently

**Objective:** Verify each of the 5 categories can be configured independently

### Preconditions

- User is on Notification Preferences screen
- All categories show default states

### Steps

1. For **Subscription Updates**:
   - Turn OFF Push, Keep In-App ON, Keep Email ON
2. For **Swap Points Events**:
   - Keep Push ON, Turn OFF In-App, Turn OFF Email
3. For **Badges & Achievements**:
   - Turn OFF Push, Turn OFF In-App, Keep Email ON
4. For **Trade Activity**:
   - Keep Push ON, Keep In-App ON, Turn OFF Email
5. For **System Notifications**:
   - Keep Push ON, Keep In-App ON, Keep Email ON
6. Navigate back and re-enter screen
7. Verify all 5 categories show configured states

### Expected Results

- ✅ Each category updates independently
- ✅ No cross-contamination between categories
- ✅ All 15 toggles (5 categories × 3 channels) persist correctly
- ✅ Database contains 5 distinct rows for user, each with correct channel states

### Pass/Fail Criteria

- **PASS:** All categories maintain independent configurations
- **FAIL:** Changing one category affects another, or any state doesn't persist

---

## TC-NOTIF-009: Test Rapid Toggle Spam (Optimistic Update Stress Test)

**Objective:** Verify optimistic updates handle rapid user interactions without race conditions

### Preconditions

- User is on Notification Preferences screen
- Network connectivity good (no throttling)

### Steps

1. Rapidly tap the same toggle switch 10 times in quick succession (e.g., "Badges - Push")
2. Observe UI behavior during spam
3. Wait 3 seconds after last tap
4. Navigate back and re-enter screen
5. Check final state of the spammed toggle

### Expected Results

- ✅ Toggle animates on each tap (responsive)
- ✅ No duplicate API calls logged in Supabase (debounced)
- ✅ Final state matches last tap (ON or OFF)
- ✅ No error messages appear
- ✅ App does not crash or freeze
- ✅ After re-entering screen, toggle shows consistent final state

### Pass/Fail Criteria

- **PASS:** App handles rapid taps gracefully, final state is correct
- **FAIL:** App crashes, freezes, or shows inconsistent state

---

## TC-NOTIF-010: Test Loading State (First Load)

**Objective:** Verify loading indicator displays during initial preference fetch

### Preconditions

- User is logged in
- User has NOT yet visited Notification Preferences screen in this session
- Network connectivity good

### Steps

1. From Settings screen, tap **Notification Preferences** row
2. Observe screen immediately after tap (first 0-500ms)
3. Wait for preferences to load

### Expected Results

- ✅ Loading spinner/skeleton displays while fetching
- ✅ No error messages during load
- ✅ After load completes (< 2 seconds):
  - Loading spinner disappears
  - All 5 categories render with data
  - Toggles show correct states
- ✅ No flash of incorrect data (FOUC)

### Pass/Fail Criteria

- **PASS:** Loading state visible, then correct data renders
- **FAIL:** No loading indicator, or data never loads

---

## TC-NOTIF-011: Test Database Trigger (Auto-initialization)

**Objective:** Verify new users automatically get default notification preferences

**⚠️ Requires creating a new test user**

### Preconditions

- Supabase migration 201_notifications_schema_v2.sql applied
- Auth system functional

### Steps

1. Create a brand new test user:
   - Email: `new-user-${Date.now()}@test.com`
   - Password: TestPassword123!
2. Confirm sign-up successful
3. **(Manual DB Query)** In Supabase SQL Editor, execute:
   ```sql
   SELECT COUNT(*) as pref_count
   FROM notification_preferences
   WHERE user_id = '<new_user_id>';
   ```
4. Log in as the new user
5. Navigate to Notification Preferences screen
6. Observe default states

### Expected Results

- ✅ Database query returns `pref_count = 5` (one row per category)
- ✅ All 5 categories display in UI
- ✅ Default toggle states match specification:
  - Push: ON for all categories
  - In-App: ON for all categories
  - Email: ON for subscription and system, OFF for others
  - Quiet Hours: ON with 22:00-08:00 range
- ✅ Trigger executed automatically (no manual RPC call needed)

### Pass/Fail Criteria

- **PASS:** New user has 5 preference rows auto-created with correct defaults
- **FAIL:** No preferences exist, or defaults are incorrect

---

## TC-NOTIF-012: Test Foreign Key Cascade (User Deletion)

**Objective:** Verify notification preferences are deleted when user account is deleted

**⚠️ DESTRUCTIVE TEST - Use dedicated test account**

### Preconditions

- Test user account exists with notification preferences
- Test user user_id known

### Steps

1. **(Manual DB Query)** Verify preferences exist:
   ```sql
   SELECT COUNT(*) FROM notification_preferences WHERE user_id = '<test_user_id>';
   ```
   _(Should return 5)_
2. Delete the test user account:
   - Via Supabase Dashboard: Authentication → Users → Delete User
   - OR via SQL: `DELETE FROM auth.users WHERE id = '<test_user_id>';`
3. **(Manual DB Query)** Check preferences deleted:
   ```sql
   SELECT COUNT(*) FROM notification_preferences WHERE user_id = '<test_user_id>';
   ```

### Expected Results

- ✅ Before deletion: Query returns 5 rows
- ✅ After deletion: Query returns 0 rows
- ✅ Foreign key cascade deletes preferences automatically
- ✅ No orphaned preference rows remain

### Pass/Fail Criteria

- **PASS:** Preferences deleted automatically with user
- **FAIL:** Orphaned preference rows remain after user deletion

---

## Test Execution Checklist

### Pre-Test

- [ ] Migrations applied to Supabase staging/local
- [ ] App built and running on iOS simulator
- [ ] App built and running on Android emulator
- [ ] Test user accounts created
- [ ] Supabase SQL Editor accessible for manual queries

### Execute

- [ ] TC-NOTIF-001: View Default Preferences
- [ ] TC-NOTIF-002: Toggle Push OFF
- [ ] TC-NOTIF-003: Toggle Multiple Channels
- [ ] TC-NOTIF-004: Enable Quiet Hours
- [ ] TC-NOTIF-005: Disable Quiet Hours
- [ ] TC-NOTIF-006: Network Error Handling
- [ ] TC-NOTIF-007: RLS Policy Enforcement
- [ ] TC-NOTIF-008: All Categories Independent
- [ ] TC-NOTIF-009: Rapid Toggle Spam
- [ ] TC-NOTIF-010: Loading State
- [ ] TC-NOTIF-011: Database Trigger Auto-init
- [ ] TC-NOTIF-012: Foreign Key Cascade

### Post-Test

- [ ] All tests passed (12/12)
- [ ] No regressions in other features
- [ ] Test results documented
- [ ] Cleanup: Delete test accounts and data

---

## Known Issues / Limitations

_(To be filled during testing)_

- None as of initial implementation

---

## Test Sign-Off

| Role          | Name           | Date     | Signature  |
| ------------- | -------------- | -------- | ---------- |
| Tester        | ****\_\_\_**** | **\_\_** | ****\_**** |
| Reviewer      | ****\_\_\_**** | **\_\_** | ****\_**** |
| Product Owner | ****\_\_\_**** | **\_\_** | ****\_**** |
