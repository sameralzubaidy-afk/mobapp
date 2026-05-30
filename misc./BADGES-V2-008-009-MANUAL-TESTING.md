# Manual Test Cases: BADGES-V2-008 & BADGES-V2-009

**Module:** Badges & Achievements (V2)  
**Tasks Covered:**
- BADGES-V2-008: Retroactive Awarding & Dynamic Triggers
- BADGES-V2-009: Admin Sandbox & Real-time Integration  
**Test Environment:** Production Supabase  
**Date Created:** January 12, 2026

---

## Prerequisites

### Required Setup
1. ✅ Supabase production database with badges module implemented
2. ✅ Admin portal running (`p2p-kids-admin`)
3. ✅ Mobile app running (iOS Simulator or Android Emulator)
4. ✅ At least 2 test users created (1 free, 1 Kids Club+)
5. ✅ Badges populated in `badges` table with active badges in all categories

### Required Migrations
- ✅ `20260112000001_badge_admin_config.sql` (BADGES-V2-005)
- ✅ `20260112000002_retroactive_badges.sql` (BADGES-V2-008)

---

## TEST SUITE 1: Retroactive Awarding (BADGES-V2-008)

### TC-1.1: Preview Retroactive Awards
**Objective:** Verify `preview_retroactive_awards` RPC returns eligible users correctly.

**Steps:**
1. Open Supabase SQL Editor
2. Find an active badge:
   ```sql
   SELECT id, name, threshold, category 
   FROM badges 
   WHERE category = 'sp_earning' AND is_active = TRUE 
   LIMIT 1;
   ```
3. Note the badge ID
4. Run preview query:
   ```sql
   SELECT * FROM preview_retroactive_awards('BADGE_ID_FROM_STEP_2');
   ```

**Expected Result:**
- ✅ Returns table with columns: `o_user_id`, `o_display_name`, `o_current_value`, `o_already_has_badge`
- ✅ Shows users who meet threshold but don't have badge (`o_already_has_badge = FALSE`)
- ✅ Shows current SP/trade values for each user

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-1.2: Manual Retroactive Award Execution
**Objective:** Verify admin can manually trigger retroactive awarding.

**Steps:**
1. In admin portal, navigate to **Badges** page
2. Select a badge with moderate threshold (e.g., "50 SP Earned")
3. Lower the threshold to a smaller value (e.g., 25 SP)
4. Click **Save**
5. In Supabase SQL Editor, run:
   ```sql
   SELECT admin_trigger_retroactive_awards('BADGE_ID_YOU_EDITED');
   ```
6. Check results:
   ```sql
   SELECT COUNT(*) as awards_given
   FROM user_badges
   WHERE badge_id = 'BADGE_ID_YOU_EDITED';
   ```

**Expected Result:**
- ✅ Function executes without error
- ✅ New `user_badges` entries created for eligible users
- ✅ Users who already had the badge are not duplicated (unique constraint)
- ✅ Count increased from previous value

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-1.3: Trigger on Threshold Decrease
**Objective:** Verify trigger automatically awards badges when threshold is lowered.

**Steps:**
1. Identify a badge with high threshold (e.g., "500 SP Earned", threshold = 500)
2. Check current user badge count:
   ```sql
   SELECT COUNT(*) FROM user_badges WHERE badge_id = 'BADGE_ID';
   ```
3. In admin portal, edit badge and reduce threshold to 100
4. Wait 2 seconds for trigger to fire
5. Re-check user badge count:
   ```sql
   SELECT COUNT(*) FROM user_badges WHERE badge_id = 'BADGE_ID';
   ```

**Expected Result:**
- ✅ Count increases after threshold decrease
- ✅ New awards given to users who now meet lower threshold
- ✅ No duplicate awards

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-1.4: Retroactive Awarding for All Categories
**Objective:** Verify retroactive logic works for all badge categories.

**Categories to Test:**
- `sp_earning`
- `sp_spending`
- `trades`
- `subscription`

**Steps (repeat for each category):**
1. Find active badge in category:
   ```sql
   SELECT id, name, threshold FROM badges 
   WHERE category = 'CATEGORY_NAME' AND is_active = TRUE 
   LIMIT 1;
   ```
2. Run preview:
   ```sql
   SELECT * FROM preview_retroactive_awards('BADGE_ID');
   ```
3. Execute retroactive award:
   ```sql
   SELECT retroactive_award_badges('BADGE_ID');
   ```
4. Verify awards given:
   ```sql
   SELECT u.email, ub.awarded_at 
   FROM user_badges ub
   JOIN auth.users u ON u.id = ub.user_id
   WHERE ub.badge_id = 'BADGE_ID'
   ORDER BY ub.awarded_at DESC
   LIMIT 5;
   ```

**Expected Result:**
- ✅ All 4 categories work correctly
- ✅ SP categories use `sp_ledger` aggregation
- ✅ Trades category uses `transactions` count
- ✅ Subscription category uses `subscriptions.created_at` duration

**Status:**  
- sp_earning: ☐ Pass ☐ Fail
- sp_spending: ☐ Pass ☐ Fail
- trades: ☐ Pass ☐ Fail
- subscription: ☐ Pass ☐ Fail

**Notes:** ___________________________________________

---

## TEST SUITE 2: Admin Sandbox (BADGES-V2-009)

### TC-2.1: Access Badge Sandbox
**Objective:** Verify admin can access sandbox page.

**Steps:**
1. Login to admin portal: `http://localhost:3000`
2. Navigate to **Badges** section
3. Click **Sandbox** link (should be in navigation or badges page)

**Expected Result:**
- ✅ Sandbox page loads without errors
- ✅ User dropdown populated with test users
- ✅ Badge lists populated by category
- ✅ SP simulation controls visible
- ✅ Trade simulation controls visible

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-2.2: Simulate SP Event
**Objective:** Verify sandbox can simulate SP earning/spending events.

**Steps:**
1. In sandbox, select a test user from dropdown
2. Choose **Category: SP Earning**
3. Enter **SP Amount: 50**
4. Click **Simulate SP Event**
5. Wait for result message
6. Verify in Supabase:
   ```sql
   SELECT * FROM sp_ledger 
   WHERE user_id = 'TEST_USER_ID'
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

**Expected Result:**
- ✅ Success message displayed: "Added 50 SP to sp_earning"
- ✅ New entry in `sp_ledger` table with `source_type = 'test_earning'`
- ✅ If threshold met, shows "Badge Awarded: [Badge Name]"
- ✅ Page updates with result (green success box)

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-2.3: Simulate Trade Completion
**Objective:** Verify sandbox can simulate trade completions.

**Steps:**
1. In sandbox, select a test user
2. Click **Complete Trade** button
3. Wait for result message
4. Verify in Supabase:
   ```sql
   SELECT * FROM transactions 
   WHERE buyer_id = 'TEST_USER_ID' OR seller_id = 'TEST_USER_ID'
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

**Expected Result:**
- ✅ Success message: "Completed trade simulation"
- ✅ New transaction entry with `status = 'completed'`
- ✅ If trade milestone met, badge awarded
- ✅ Shows badge name if awarded

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-2.4: Sandbox Badge Eligibility Display
**Objective:** Verify sandbox shows which badges are eligible for selected category.

**Steps:**
1. In sandbox, select **Category: SP Earning**
2. Observe "Eligible Badges" section below simulation controls

**Expected Result:**
- ✅ Lists all active SP earning badges
- ✅ Shows threshold for each badge
- ✅ Example: "SP Earner - Bronze (Threshold: 10)"
- ✅ List updates when category is changed

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

## TEST SUITE 3: Mobile Real-time Integration (BADGES-V2-009)

### TC-3.1: Real-time Badge Notification
**Objective:** Verify mobile app receives real-time badge awards.

**Steps:**
1. Open mobile app on iOS Simulator / Android Emulator
2. Login as test user
3. Navigate to **Profile → Badges** screen
4. Keep app open on Badges screen
5. In Supabase SQL Editor, manually award a new badge:
   ```sql
   INSERT INTO user_badges (user_id, badge_id)
   VALUES (
     'CURRENT_USER_ID',
     (SELECT id FROM badges WHERE name = '10 Trades' LIMIT 1)
   )
   ON CONFLICT DO NOTHING;
   ```
6. Observe mobile app

**Expected Result:**
- ✅ Badge appears immediately on screen (within 2 seconds)
- ✅ No manual refresh required
- ✅ Badge is added to top of badges list
- ✅ (Optional) Celebration modal/toast displayed

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-3.2: Real-time Subscription Isolation
**Objective:** Verify real-time subscription only triggers for the logged-in user.

**Steps:**
1. Login as User A on mobile app
2. Navigate to **Badges** screen
3. Keep User A's app open
4. In Supabase SQL Editor, award badge to **User B** (different user):
   ```sql
   INSERT INTO user_badges (user_id, badge_id)
   VALUES (
     'USER_B_ID',
     (SELECT id FROM badges WHERE name = 'First Trade' LIMIT 1)
   )
   ON CONFLICT DO NOTHING;
   ```
5. Observe User A's mobile app

**Expected Result:**
- ✅ User A's badge screen does NOT update
- ✅ No new badge appears for User A
- ✅ Real-time subscription filtered correctly by `user_id`

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-3.3: Badge Celebration Modal (Optional Feature)
**Objective:** If implemented, verify celebration modal shows when new badge is awarded.

**Steps:**
1. Open mobile app, login as test user
2. Navigate to **Home** or **Profile** screen
3. In admin sandbox, simulate an SP event that awards a badge
4. Observe mobile app

**Expected Result:**
- ✅ (If implemented) Celebration modal/toast appears
- ✅ Shows badge icon and name
- ✅ Displays congratulatory message
- ✅ User can dismiss modal
- ✅ Badge persists in Badges screen after dismissal

**Status:** ☐ Pass ☐ Fail ☐ Not Implemented  
**Notes:** ___________________________________________

---

### TC-3.4: Reconnection After Network Loss
**Objective:** Verify real-time subscription reconnects after network interruption.

**Steps:**
1. Open mobile app, navigate to Badges screen
2. Enable **Airplane Mode** on simulator/emulator
3. Wait 10 seconds
4. Disable **Airplane Mode**
5. Wait for reconnection (check network indicator)
6. In Supabase SQL Editor, award a badge:
   ```sql
   INSERT INTO user_badges (user_id, badge_id)
   VALUES ('CURRENT_USER_ID', (SELECT id FROM badges LIMIT 1))
   ON CONFLICT DO NOTHING;
   ```
7. Observe mobile app

**Expected Result:**
- ✅ Real-time subscription reconnects automatically
- ✅ Newly awarded badge appears on screen
- ✅ No manual app restart required

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

## TEST SUITE 4: Integration & Edge Cases

### TC-4.1: Badge Deduplication
**Objective:** Verify users cannot receive the same badge twice.

**Steps:**
1. In admin sandbox, select a user
2. Simulate SP event that awards a badge
3. Wait for badge to be awarded
4. Immediately simulate **the same event again** (same category/amount)
5. Check Supabase:
   ```sql
   SELECT COUNT(*) as duplicate_count 
   FROM user_badges 
   WHERE user_id = 'TEST_USER_ID' AND badge_id = 'BADGE_ID';
   ```

**Expected Result:**
- ✅ Count remains 1 (no duplicate)
- ✅ Unique constraint `(user_id, badge_id)` prevents duplicates
- ✅ Sandbox shows "No new badge awarded (may already have it)"

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-4.2: Inactive Badge Not Awarded
**Objective:** Verify inactive badges are not awarded retroactively or via triggers.

**Steps:**
1. In admin portal, set a badge to `is_active = FALSE`
2. Run retroactive award:
   ```sql
   SELECT retroactive_award_badges('INACTIVE_BADGE_ID');
   ```
3. Simulate SP event in sandbox that would meet threshold

**Expected Result:**
- ✅ Retroactive function skips inactive badge (or returns error)
- ✅ Trigger does not award inactive badge
- ✅ Preview function returns "Badge not found or inactive"

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-4.3: Archived Badge Not Awarded
**Objective:** Verify archived badges are not awarded.

**Steps:**
1. Set badge to `is_archived = TRUE`
2. Run retroactive preview:
   ```sql
   SELECT * FROM preview_retroactive_awards('ARCHIVED_BADGE_ID');
   ```

**Expected Result:**
- ✅ Returns error: "Badge not found or inactive"
- ✅ No awards given to users

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-4.4: Badge Config History Logged
**Objective:** Verify threshold changes are logged in `badge_config_history`.

**Steps:**
1. In admin portal, edit badge threshold from 100 → 50
2. Click Save
3. Check history:
   ```sql
   SELECT * FROM badge_config_history 
   WHERE badge_id = 'EDITED_BADGE_ID'
   ORDER BY changed_at DESC 
   LIMIT 1;
   ```

**Expected Result:**
- ✅ New entry in `badge_config_history`
- ✅ `old_threshold = 100`, `new_threshold = 50`
- ✅ `admin_id` populated
- ✅ `changed_at` is recent timestamp

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

## Summary

### Total Test Cases
- **BADGES-V2-008 (Retroactive):** 4 test cases
- **BADGES-V2-009 (Sandbox):** 4 test cases
- **BADGES-V2-009 (Real-time):** 4 test cases
- **Integration/Edge Cases:** 4 test cases
- **Total:** 16 test cases

### Completion Checklist
- [ ] All SQL migrations applied
- [ ] Admin portal accessible
- [ ] Mobile app running
- [ ] Test users created
- [ ] All test cases executed
- [ ] Defects logged (if any)

---

## Commands Reference

### Run Mobile App
```bash
cd p2p-kids-marketplace
npm start
# Then press 'i' for iOS or 'a' for Android
```

### Run Admin Portal
```bash
cd p2p-kids-admin
npm run dev
# Open http://localhost:3000
```

### Run Unit Tests
```bash
cd p2p-kids-marketplace
npm test -- src/hooks/__tests__/useUserBadges.test.ts
```

### Run E2E Test
```bash
cd p2p-kids-marketplace
npm test -- src/__tests__/e2e/badgeRealtimeIntegration.e2e.ts
```

---

**End of Manual Testing Guide**
