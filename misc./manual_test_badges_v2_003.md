# Manual Test Cases: BADGES-V2-003 - Trade Milestone & Subscription Tenure Badges

**Module:** MODULE-08-BADGES-V2  
**Task:** BADGES-V2-003  
**Test Date:** ___________  
**Tester:** ___________

---

## Prerequisites

Before testing, ensure:
1. ✅ Migration `20260110000002_trade_badges.sql` has been applied in Supabase
2. ✅ Edge Function `award-tenure-badges` has been deployed
3. ✅ Test users exist with known credentials
4. ✅ At least one active subscription exists in the database

---

## Test Suite 1: Trade Milestone Badges

### Test Case 1.1: First Trade Badge (Buyer)
**Objective:** Verify that completing the first trade awards "First Trade" badge to buyer.

**Steps:**
1. Log in to Supabase Dashboard > SQL Editor
2. Identify a test buyer user ID (or create one)
3. Create a trade record:
   ```sql
   INSERT INTO trades (buyer_id, seller_id, item_id, cash_amount_cents, status)
   VALUES ('<buyer_id>', '<seller_id>', '<item_id>', 1000, 'pending')
   RETURNING id;
   ```
4. Update trade to completed:
   ```sql
   UPDATE trades SET status = 'completed' WHERE id = '<trade_id>';
   ```
5. Check if badge was awarded:
   ```sql
   SELECT ub.*, b.name, b.description
   FROM user_badges ub
   JOIN badges b ON ub.badge_id = b.id
   WHERE ub.user_id = '<buyer_id>' AND b.name = 'First Trade';
   ```

**Expected Result:**
- ✅ One row returned with badge "First Trade"
- ✅ `awarded_at` timestamp is recent
- ✅ No errors in Supabase logs

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 1.2: First Trade Badge (Seller)
**Objective:** Verify that completing the first trade awards "First Trade" badge to seller.

**Steps:**
1. Use the same trade from Test Case 1.1
2. Check if seller received badge:
   ```sql
   SELECT ub.*, b.name, b.description
   FROM user_badges ub
   JOIN badges b ON ub.badge_id = b.id
   WHERE ub.user_id = '<seller_id>' AND b.name = 'First Trade';
   ```

**Expected Result:**
- ✅ One row returned with badge "First Trade"
- ✅ Both buyer and seller have the badge

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 1.3: 10 Trades Badge
**Objective:** Verify that completing 10 trades awards "10 Trades" badge.

**Steps:**
1. Identify or create a user with 9 completed trades
2. Complete one more trade (total = 10):
   ```sql
   -- Check current count
   SELECT COUNT(*) FROM trades WHERE buyer_id = '<user_id>' AND status = 'completed';
   
   -- Complete 10th trade
   UPDATE trades SET status = 'completed' WHERE id = '<10th_trade_id>';
   ```
3. Verify badge awarded:
   ```sql
   SELECT ub.*, b.name, b.threshold
   FROM user_badges ub
   JOIN badges b ON ub.badge_id = b.id
   WHERE ub.user_id = '<user_id>' AND b.name = '10 Trades';
   ```

**Expected Result:**
- ✅ "10 Trades" badge awarded
- ✅ User also has "First Trade" badge from earlier

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 1.4: 50 Trades Badge
**Objective:** Verify that completing 50 trades awards "50 Trades" badge.

**Steps:**
1. Simulate a user with 50 completed trades using RPC:
   ```sql
   SELECT award_badge_if_eligible('<user_id>', 'trades', 50);
   ```
2. Verify all trade badges awarded:
   ```sql
   SELECT b.name, b.threshold, ub.awarded_at
   FROM user_badges ub
   JOIN badges b ON ub.badge_id = b.id
   WHERE ub.user_id = '<user_id>' AND b.category = 'trades'
   ORDER BY b.threshold ASC;
   ```

**Expected Result:**
- ✅ User has 3 badges: "First Trade", "10 Trades", "50 Trades"
- ✅ Badges awarded in chronological order based on threshold

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 1.5: No Duplicate Badges
**Objective:** Ensure UNIQUE constraint prevents duplicate badge awards.

**Steps:**
1. Award "First Trade" badge twice to the same user:
   ```sql
   SELECT award_badge_if_eligible('<user_id>', 'trades', 1);
   SELECT award_badge_if_eligible('<user_id>', 'trades', 1);
   ```
2. Check badge count:
   ```sql
   SELECT COUNT(*) FROM user_badges WHERE user_id = '<user_id>' AND badge_id = (SELECT id FROM badges WHERE name = 'First Trade');
   ```

**Expected Result:**
- ✅ Count = 1 (only one badge, no duplicates)
- ✅ No errors in logs (ON CONFLICT DO NOTHING worked)

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Test Suite 2: Subscription Tenure Badges

### Test Case 2.1: Trial Member Badge
**Objective:** Verify that trial users get "Trial Member" badge.

**Steps:**
1. Create or identify a user with trial subscription:
   ```sql
   INSERT INTO subscriptions (user_id, tier, status, created_at)
   VALUES ('<user_id>', 'kids_club_plus', 'trial', NOW())
   RETURNING id;
   ```
2. Call the RPC function:
   ```sql
   SELECT award_badge_if_eligible('<user_id>', 'subscription', 0);
   ```
3. Verify badge:
   ```sql
   SELECT b.name FROM user_badges ub
   JOIN badges b ON ub.badge_id = b.id
   WHERE ub.user_id = '<user_id>' AND b.name = 'Trial Member';
   ```

**Expected Result:**
- ✅ "Trial Member" badge awarded
- ✅ Threshold = 0 days

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 2.2: 1-Month Subscriber Badge
**Objective:** Verify that 30+ day subscribers get "1-Month Subscriber" badge.

**Steps:**
1. Create subscription with created_at = 35 days ago:
   ```sql
   INSERT INTO subscriptions (user_id, tier, status, created_at)
   VALUES ('<user_id>', 'kids_club_plus', 'active', NOW() - INTERVAL '35 days')
   RETURNING id;
   ```
2. Manually trigger badge award:
   ```sql
   SELECT award_badge_if_eligible('<user_id>', 'subscription', 35);
   ```
3. Verify badge:
   ```sql
   SELECT b.name, b.threshold FROM user_badges ub
   JOIN badges b ON ub.badge_id = b.id
   WHERE ub.user_id = '<user_id>' AND b.name = '1-Month Subscriber';
   ```

**Expected Result:**
- ✅ "1-Month Subscriber" badge awarded (threshold = 30 days)
- ✅ "Trial Member" also awarded (threshold = 0)

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 2.3: 6-Month Subscriber Badge
**Objective:** Verify 180+ day subscribers get "6-Month Subscriber" badge.

**Steps:**
1. Award badge for 180 days:
   ```sql
   SELECT award_badge_if_eligible('<user_id>', 'subscription', 180);
   ```
2. Check all subscription badges:
   ```sql
   SELECT b.name, b.threshold FROM user_badges ub
   JOIN badges b ON ub.badge_id = b.id
   WHERE ub.user_id = '<user_id>' AND b.category = 'subscription'
   ORDER BY b.threshold ASC;
   ```

**Expected Result:**
- ✅ User has: "Trial Member", "1-Month Subscriber", "6-Month Subscriber"

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 2.4: 1-Year Subscriber Badge
**Objective:** Verify 365+ day subscribers get "1-Year Subscriber" badge.

**Steps:**
1. Award badge for 365 days:
   ```sql
   SELECT award_badge_if_eligible('<user_id>', 'subscription', 365);
   ```
2. Verify all 4 subscription badges:
   ```sql
   SELECT b.name, b.threshold FROM user_badges ub
   JOIN badges b ON ub.badge_id = b.id
   WHERE ub.user_id = '<user_id>' AND b.category = 'subscription'
   ORDER BY b.threshold ASC;
   ```

**Expected Result:**
- ✅ User has all 4 badges: Trial, 1-Month, 6-Month, 1-Year

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Test Suite 3: Edge Function (award-tenure-badges)

### Test Case 3.1: Deploy Edge Function
**Objective:** Deploy `award-tenure-badges` function successfully.

**Steps:**
1. Open terminal in repository root
2. Run deployment command:
   ```bash
   cd supabase/functions
   npx supabase functions deploy award-tenure-badges
   ```

**Expected Result:**
- ✅ Function deploys without errors
- ✅ Function appears in Supabase Dashboard > Edge Functions

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 3.2: Manual Invocation
**Objective:** Manually invoke Edge Function and verify response.

**Steps:**
1. Get your Supabase project URL and anon key
2. Run cURL command:
   ```bash
   curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/award-tenure-badges \
     -H "Authorization: Bearer <ANON_KEY>" \
     -H "Content-Type: application/json"
   ```
3. Check response JSON

**Expected Result:**
- ✅ Status code: 200
- ✅ Response: `{"success": true, "processed": X, "errors": 0, "total": X}`
- ✅ `processed` count > 0 if active subscriptions exist

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 3.3: Verify Badges Awarded by Cron
**Objective:** Confirm that badges were awarded after function execution.

**Steps:**
1. Run the Edge Function manually (Test Case 3.2)
2. Check user_badges table:
   ```sql
   SELECT u.email, b.name, ub.awarded_at
   FROM user_badges ub
   JOIN badges b ON ub.badge_id = b.id
   JOIN auth.users u ON ub.user_id = u.id
   WHERE b.category = 'subscription'
   ORDER BY ub.awarded_at DESC
   LIMIT 10;
   ```

**Expected Result:**
- ✅ Recent `awarded_at` timestamps
- ✅ Badges match subscription tenure

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Test Suite 4: Mobile App UI Verification

### Test Case 4.1: View Badges on Profile
**Objective:** Ensure badges display correctly in mobile app.

**Steps:**
1. Open mobile app (iOS Simulator or Android Emulator)
2. Log in as a user with badges
3. Navigate to Profile screen
4. Look for badge display component

**Expected Result:**
- ✅ Badges are visible on profile
- ✅ Badge icons/names render correctly
- ✅ Badge count is accurate

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

### Test Case 4.2: Real-time Badge Notification
**Objective:** Verify real-time badge award notification.

**Steps:**
1. Keep mobile app open on profile screen
2. In Supabase SQL Editor, manually award a new badge:
   ```sql
   INSERT INTO user_badges (user_id, badge_id)
   VALUES ('<current_user_id>', (SELECT id FROM badges WHERE name = '10 Trades'))
   ON CONFLICT DO NOTHING;
   ```
3. Observe mobile app

**Expected Result:**
- ✅ Badge appears immediately (real-time subscription working)
- ✅ (Optional) Celebration modal/toast shown

**Status:** ☐ Pass ☐ Fail  
**Notes:** _________________________________

---

## Summary

**Total Test Cases:** 14  
**Passed:** ____  
**Failed:** ____  
**Blocked:** ____  

**Overall Status:** ☐ All tests passed ☐ Some failures ☐ Blocked

**Additional Notes:**
_____________________________________________________________________________
_____________________________________________________________________________

**Sign-off:**
- Tester: _________________ Date: _________
- Reviewer: _______________ Date: _________
