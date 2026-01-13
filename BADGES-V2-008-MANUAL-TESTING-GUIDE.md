# BADGES-V2-008: Retroactive Awarding & Dynamic Triggers
## Manual Testing Guide

**Module:** MODULE-08-BADGES-V2.md  
**Task:** BADGES-V2-008  
**Test Date:** _____________  
**Tester:** _____________

---

## PREREQUISITES

Before starting these tests, ensure:

1. ✅ Migration `20260112000002_retroactive_badges.sql` has been applied in Supabase
2. ✅ You have admin access to the Supabase dashboard
3. ✅ Test users exist with varying SP amounts and trade counts
4. ✅ Badge data has been seeded (from earlier migrations)

---

## TEST SUITE 1: SQL MIGRATION VERIFICATION

### TC-1.1: Verify Functions Exist

**Steps:**
1. Open Supabase SQL Editor
2. Run this query:
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'retroactive_award_badges',
  'trigger_retroactive_award_on_threshold_decrease',
  'admin_trigger_retroactive_awards',
  'preview_retroactive_awards'
)
ORDER BY routine_name;
```

**Expected Result:**
- All 4 functions should be listed
- `routine_type` should be `FUNCTION`

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

### TC-1.2: Verify Trigger Exists

**Steps:**
1. In Supabase SQL Editor, run:
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_retroactive_award_on_threshold_decrease';
```

**Expected Result:**
- Trigger should exist on `badges` table
- `event_manipulation` should be `UPDATE`

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

### TC-1.3: Verify award_badge_if_eligible Checks is_active

**Steps:**
1. Run this query:
```sql
SELECT routine_definition
FROM information_schema.routines
WHERE routine_name = 'award_badge_if_eligible';
```

**Expected Result:**
- Function definition should contain `b.is_active = TRUE`

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

## TEST SUITE 2: PREVIEW RETROACTIVE AWARDS (DRY-RUN)

### TC-2.1: Preview SP Earning Badge

**Steps:**
1. Find an SP earning badge ID:
```sql
SELECT id, name, threshold, category
FROM badges
WHERE category = 'sp_earning' AND is_active = TRUE
LIMIT 1;
```

2. Run preview with the badge ID:
```sql
SELECT * FROM preview_retroactive_awards('YOUR_BADGE_ID_HERE');
```

**Expected Result:**
- Returns list of users eligible for the badge
- Each row shows: `o_user_id`, `o_display_name`, `o_current_value`, `o_already_has_badge`
- `o_current_value` should be >= badge threshold for all returned users
- Some users have `o_already_has_badge = true`, others `false`

**Status:** ☐ Pass ☐ Fail  
**Eligible Users Without Badge:** _______  
**Notes:** _______________________________________________

---

### TC-2.2: Preview Trade Badge

**Steps:**
1. Find a trade badge:
```sql
SELECT id, name, threshold, category
FROM badges
WHERE category = 'trades' AND is_active = TRUE
LIMIT 1;
```

2. Run preview:
```sql
SELECT * FROM preview_retroactive_awards('YOUR_BADGE_ID_HERE');
```

**Expected Result:**
- Returns users with >= threshold completed trades
- `current_value` reflects total trades (buyer + seller)

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

### TC-2.3: Preview for Inactive Badge (Should Fail)

**Steps:**
1. Find or create an inactive badge:
```sql
UPDATE badges SET is_active = FALSE WHERE name = 'Test Badge' RETURNING id;
```

2. Try to preview:
```sql
SELECT * FROM preview_retroactive_awards('YOUR_INACTIVE_BADGE_ID');
```

**Expected Result:**
- Should raise exception: "Badge not found or inactive"

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

## TEST SUITE 3: MANUAL RETROACTIVE AWARDING

### TC-3.1: Manually Trigger Retroactive Awards (Admin)

**Prerequisites:**
- You are logged in as an admin user

**Steps:**
1. Choose a badge with some eligible users (from TC-2.1):
```sql
-- Get badge details
SELECT id, name, threshold FROM badges WHERE name = 'SP Earner - Bronze';
```

2. Call the admin RPC:
```sql
SELECT * FROM admin_trigger_retroactive_awards(
  'YOUR_BADGE_ID_HERE',
  'Manual test: Verifying retroactive awarding'
);
```

**Expected Result:**
- Returns JSON with:
  - `success: true`
  - `badge_name: "SP Earner - Bronze"`
  - `awarded_count: <number>` (should match preview count from TC-2.1)

**Status:** ☐ Pass ☐ Fail  
**Awarded Count:** _______  
**Notes:** _______________________________________________

---

### TC-3.2: Verify Badges Were Actually Awarded

**Steps:**
1. Check user_badges table for new awards:
```sql
-- Count user_badges for the test badge
SELECT COUNT(*) as total_awarded
FROM user_badges
WHERE badge_id = 'YOUR_BADGE_ID_HERE';
```

2. Pick a specific user from preview and verify:
```sql
SELECT ub.*, b.name as badge_name
FROM user_badges ub
JOIN badges b ON b.id = ub.badge_id
WHERE ub.user_id = 'USER_ID_FROM_PREVIEW'
  AND ub.badge_id = 'YOUR_BADGE_ID_HERE';
```

**Expected Result:**
- Total count matches or exceeds the `awarded_count` from TC-3.1
- Specific user now has the badge in `user_badges`

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

### TC-3.3: Verify Audit Log Entry

**Steps:**
1. Check badge_audit_logs:
```sql
SELECT *
FROM badge_audit_logs
WHERE badge_id = 'YOUR_BADGE_ID_HERE'
  AND action_type = 'bulk_award'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- Log entry exists with:
  - `action_type = 'bulk_award'`
  - `reason = 'Manual test: Verifying retroactive awarding'`
  - `admin_id` is your user ID
  - `metadata` contains award result JSON

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

### TC-3.4: Idempotency Test - Run Again, No New Awards

**Steps:**
1. Run the same RPC call again:
```sql
SELECT * FROM admin_trigger_retroactive_awards(
  'YOUR_BADGE_ID_HERE',
  'Second run - should award 0 new badges'
);
```

**Expected Result:**
- `awarded_count: 0` (no new awards because all eligible users already have the badge)

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

## TEST SUITE 4: AUTOMATIC TRIGGER ON THRESHOLD DECREASE

### TC-4.1: Automatic Retroactive Award When Threshold Lowered

**Steps:**
1. Choose a badge with high threshold:
```sql
SELECT id, name, threshold
FROM badges
WHERE category = 'sp_earning' AND threshold > 100
ORDER BY threshold DESC
LIMIT 1;
```

2. Preview current eligible users:
```sql
SELECT COUNT(*) as eligible_count
FROM preview_retroactive_awards('YOUR_BADGE_ID_HERE')
WHERE already_has_badge = FALSE;
```
Record count: __________

3. Lower the threshold significantly:
```sql
UPDATE badges
SET threshold = 10  -- Lower threshold
WHERE id = 'YOUR_BADGE_ID_HERE'
RETURNING name, threshold;
```

4. Wait 2-3 seconds for trigger to process

5. Check if new badges were awarded:
```sql
SELECT COUNT(*) as new_eligible_count
FROM preview_retroactive_awards('YOUR_BADGE_ID_HERE')
WHERE already_has_badge = FALSE;
```

**Expected Result:**
- `new_eligible_count` should be 0 or significantly less than original count
- Audit log should have entry with `action_type = 'bulk_award'` and trigger metadata

**Status:** ☐ Pass ☐ Fail  
**Original Eligible:** _______ → **After:** _______  
**Notes:** _______________________________________________

---

### TC-4.2: Verify Audit Log from Automatic Trigger

**Steps:**
1. Check audit log:
```sql
SELECT *
FROM badge_audit_logs
WHERE badge_id = 'YOUR_BADGE_ID_HERE'
  AND action_type = 'bulk_award'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- Log entry with:
  - `reason = 'Automatic retroactive award due to threshold decrease'`
  - `metadata` contains `old_threshold` and `new_threshold`
  - `metadata->>'triggered_by' = 'threshold_decrease'`

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

### TC-4.3: No Trigger When Threshold Increases

**Steps:**
1. Increase threshold:
```sql
-- Count current audit logs
SELECT COUNT(*) FROM badge_audit_logs WHERE badge_id = 'YOUR_BADGE_ID_HERE';
-- Record: _______

UPDATE badges
SET threshold = 500  -- Increase threshold
WHERE id = 'YOUR_BADGE_ID_HERE';
```

2. Wait 2 seconds

3. Check audit logs again:
```sql
SELECT COUNT(*) FROM badge_audit_logs WHERE badge_id = 'YOUR_BADGE_ID_HERE';
```

**Expected Result:**
- Audit log count should be THE SAME (no new bulk_award entry)
- Threshold increase should NOT trigger retroactive awarding

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

### TC-4.4: Restore Original Thresholds

**Steps:**
1. Restore badges to original thresholds:
```sql
-- SP Earner - Bronze: 10
UPDATE badges SET threshold = 10 WHERE name = 'SP Earner - Bronze';

-- SP Earner - Silver: 50
UPDATE badges SET threshold = 50 WHERE name = 'SP Earner - Silver';

-- SP Earner - Gold: 100
UPDATE badges SET threshold = 100 WHERE name = 'SP Earner - Gold';

-- Verify
SELECT name, threshold FROM badges WHERE category = 'sp_earning' ORDER BY threshold;
```

**Expected Result:**
- Thresholds restored to documented values

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

## TEST SUITE 5: BADGE CATEGORIES

### TC-5.1: SP Spending Badge Retroactive Award

**Steps:**
1. Find SP spending badge:
```sql
SELECT id, name, threshold
FROM badges
WHERE category = 'sp_spending' AND is_active = TRUE
LIMIT 1;
```

2. Trigger retroactive award:
```sql
SELECT * FROM admin_trigger_retroactive_awards(
  'YOUR_BADGE_ID_HERE',
  'Testing SP spending category'
);
```

**Expected Result:**
- Returns success with `category = 'sp_spending'`
- Awards to users who have spent >= threshold SP

**Status:** ☐ Pass ☐ Fail  
**Awarded Count:** _______  
**Notes:** _______________________________________________

---

### TC-5.2: Subscription Badge Retroactive Award

**Steps:**
1. Find subscription badge:
```sql
SELECT id, name, threshold
FROM badges
WHERE category = 'subscription' AND is_active = TRUE
LIMIT 1;
```

2. Trigger retroactive award:
```sql
SELECT * FROM admin_trigger_retroactive_awards(
  'YOUR_BADGE_ID_HERE',
  'Testing subscription category'
);
```

**Expected Result:**
- Returns success with `category = 'subscription'`
- Awards to users with active subscriptions >= threshold days

**Status:** ☐ Pass ☐ Fail  
**Awarded Count:** _______  
**Notes:** _______________________________________________

---

## TEST SUITE 6: EDGE CASES

### TC-6.1: Badge with Zero Eligible Users

**Steps:**
1. Set very high threshold:
```sql
UPDATE badges
SET threshold = 999999
WHERE name = 'SP Earner - Bronze'
RETURNING id;
```

2. Trigger retroactive award:
```sql
SELECT * FROM admin_trigger_retroactive_awards(
  'YOUR_BADGE_ID_HERE',
  'Testing zero eligible users'
);
```

**Expected Result:**
- `success = true`
- `awarded_count = 0`

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

### TC-6.2: Archived Badge (Should Fail)

**Steps:**
1. Archive a badge:
```sql
UPDATE badges SET is_archived = TRUE WHERE name = 'Test Badge' RETURNING id;
```

2. Try to trigger retroactive award:
```sql
SELECT * FROM admin_trigger_retroactive_awards('YOUR_BADGE_ID_HERE');
```

**Expected Result:**
- Should raise exception: "Badge not found or inactive"

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

## TEST SUITE 7: MOBILE APP INTEGRATION (OPTIONAL)

### TC-7.1: Badge Service Functions

**Prerequisites:**
- Mobile app is running
- You are logged in as a test user

**Steps:**
1. In mobile app code, add temporary button to trigger:
```typescript
import { previewRetroactiveAwards, triggerRetroactiveAwards } from '../services/badges';

// Add button handler
const handlePreview = async () => {
  const preview = await previewRetroactiveAwards('BADGE_ID_HERE');
  console.log('Preview:', preview);
};

const handleTrigger = async () => {
  const result = await triggerRetroactiveAwards('BADGE_ID_HERE', 'Mobile test');
  console.log('Result:', result);
};
```

2. Test preview function
3. Test trigger function (as admin)

**Expected Result:**
- Both functions work without errors
- Preview returns array of eligible users
- Trigger returns success response

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________________________________________

---

## VERIFICATION CHECKLIST

From `MODULE-08-Badges & Achievements VERIFICATION-V2.md`:

### 8. RETROACTIVE AWARDING (BADGES-V2-008)

- ☐ Migration `20260112000002_retroactive_badges.sql` applied
- ☐ RPC `retroactive_award_badges` functional
- ☐ RPC `admin_trigger_retroactive_awards` functional (admin only)
- ☐ RPC `preview_retroactive_awards` functional
- ☐ Trigger `trigger_retroactive_award_on_threshold_decrease` functional
- ☐ Verification: Lowering threshold awards badges to eligible users automatically
- ☐ Verification: Increasing threshold does NOT trigger retroactive awarding
- ☐ Verification: Preview accurately predicts award count
- ☐ Verification: Idempotency - running twice awards no additional badges
- ☐ Verification: Audit logs capture all retroactive award events
- ☐ Verification: Works for all badge categories (sp_earning, sp_spending, trades, subscription)

---

## TEST EXECUTION SUMMARY

**Total Test Cases:** 22  
**Passed:** _______  
**Failed:** _______  
**Skipped:** _______

**Critical Issues Found:**
1. _______________________________________________
2. _______________________________________________

**Recommendations:**
1. _______________________________________________
2. _______________________________________________

**Tester Signature:** _______________  
**Date:** _______________
