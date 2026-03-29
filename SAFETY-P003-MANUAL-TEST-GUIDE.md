# SAFETY-P003 Manual Testing Guide

**Module:** MODULE-13-SAFETY-COMPLIANCE  
**Task:** SAFETY-P003 - Extend items.status + Add Seller Notification  
**Test Environment:** iOS/Android Simulators (Supabase Production)  
**Prerequisites:** Admin user account, test seller account, test item data

---

## ⚠️ IMPORTANT: Run SQL Migration First

**Before testing, run this migration in Supabase SQL Editor:**

```sql
-- File: supabase/migrations/301_items_flagged_rejected_statuses.sql
-- Copy and paste the ENTIRE migration file into Supabase SQL Editor
-- Verify each step completes successfully

-- File: supabase/migrations/302_safety_p003_add_appeal_reason.sql
-- Run after 301 to add appeal reason metadata fields
```

**Verification Queries (run after migration):**

```sql
-- 1. Verify new columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'items' 
AND column_name IN ('flagged_at', 'rejected_at', 'rejection_reason', 'appeal_count', 'appeal_reason', 'appealed_at');

-- Expected: 6 rows returned

-- 2. Verify CHECK constraint updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'items'::regclass 
AND conname = 'items_status_check';

-- Expected: Should include 'flagged' and 'rejected' in the constraint

-- 3. Verify trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_item_status_change_notify_seller';

-- Expected: 1 row with UPDATE event

-- 4. Verify RLS policy updated
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'items' 
AND policyname = 'Items visibility based on status';

-- Expected: 1 row with SELECT command
```

---

## Test Cases

### TC-SAFETY-P003-001: Verify Database Schema Changes

**Objective:** Confirm new columns and constraints are added correctly

**Preconditions:**
- Migration 301 has been run successfully
- Supabase SQL Editor access

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Run verification queries (see above)
3. Verify each query returns expected results

**Expected Results:**
- ✅ All 6 moderation columns exist (flagged_at, rejected_at, rejection_reason, appeal_count, appeal_reason, appealed_at)
- ✅ CHECK constraint includes 'flagged' and 'rejected' statuses
- ✅ Trigger `on_item_status_change_notify_seller` exists
- ✅ RLS policy `Items visibility based on status` exists

**Pass/Fail:** ___________

---

### TC-SAFETY-P003-002: Admin Flags an Item

**Objective:** Admin can mark an item as flagged, triggering seller notification

**Preconditions:**
- Admin user logged into admin portal
- Test item exists with status 'available'
- Test item ID: `___________`

**Steps:**
1. Open admin portal in browser: `http://localhost:3001/items/flagged`
2. Locate the test item in the admin items list (create via Supabase UI if needed):
   ```sql
   INSERT INTO items (seller_id, title, description, price, condition, status)
   VALUES ('<seller_user_id>', 'Test Item for Flagging', 'Test description', 25.00, 'good', 'available');
   ```
3. Manually update item status to 'flagged' via SQL Editor:
   ```sql
   UPDATE items SET status = 'flagged' WHERE id = '<item_id>';
   ```
4. Navigate to `/items/flagged` in admin portal
5. Verify the item appears in the flagged items list

**Expected Results:**
- ✅ Item displays with status badge "flagged" (yellow background)
- ✅ Item shows flagged timestamp
- ✅ "Review" button is visible

**Pass/Fail:** ___________

---

### TC-SAFETY-P003-003: Seller Receives Flagged Item Notification

**Objective:** Seller receives push/in-app notification when their item is flagged

**Preconditions:**
- Test item flagged (TC-002 completed)
- Seller user logged into mobile app (iOS/Android simulator)
- User notifications enabled

**Steps:**
1. Open Supabase → Table Editor → `user_notifications`
2. Filter by `user_id = '<seller_user_id>'` and `type = 'item_flagged'`
3. Verify notification row exists
4. On mobile app, navigate to Profile → Notifications
5. Locate the flagged item notification

**Expected Results:**
- ✅ Notification exists in database with:
  - `title`: "Item Under Review 🔍"
  - `body`: Contains item title
  - `type`: "item_flagged"
  - `data->item_id`: Matches flagged item ID
- ✅ Notification appears in app notifications screen
- ✅ Tapping notification navigates to item details (if navigation implemented)

**Pass/Fail:** ___________

---

### TC-SAFETY-P003-004: Admin Rejects Item with Reason

**Objective:** Admin can reject a flagged item with a rejection reason

**Preconditions:**
- Item is flagged (TC-002 completed)
- Admin logged into admin portal at `/items/flagged`

**Steps:**
1. In flagged items list, click "Review" button for the test item
2. In the review modal, enter rejection reason:  
   `"Item matches CPSC safety recall for choking hazard"`
3. Click "Reject" button
4. Confirm the action in the confirmation dialog

**Expected Results:**
- ✅ Modal closes after success
- ✅ Success message displayed: "Item rejected successfully"
- ✅ Item status updates to 'rejected' in database
- ✅ Query to verify:
   ```sql
   SELECT status, rejected_at, rejection_reason, appeal_count
   FROM items WHERE id = '<item_id>';
   ```
   - status = 'rejected'
   - rejected_at is NOT NULL
   - rejection_reason = "Item matches CPSC safety recall for choking hazard"
   - appeal_count = 1

**Pass/Fail:** ___________

---

### TC-SAFETY-P003-005: Seller Receives Rejected Item Notification

**Objective:** Seller receives notification with rejection reason

**Preconditions:**
- Item rejected (TC-004 completed)
- Seller user logged into mobile app

**Steps:**
1. Open Supabase → Table Editor → `user_notifications`
2. Filter by `user_id = '<seller_user_id>'` and `type = 'item_rejected'`
3. Verify notification row exists with rejection reason
4. On mobile app, navigate to Profile → Notifications
5. Locate the rejected item notification
6. Read the notification body

**Expected Results:**
- ✅ Notification exists in database with:
  - `title`: "Item Rejected ❌"
  - `body`: Contains item title AND rejection reason
  - `type`: "item_rejected"
  - `data->rejection_reason`: Matches admin's input
- ✅ Notification appears in app notifications screen
- ✅ Rejection reason is visible in notification body

**Pass/Fail:** ___________

---

### TC-SAFETY-P003-006: RLS - Flagged Items Not Visible to Other Users

**Objective:** Buyers/other users cannot see flagged or rejected items

**Preconditions:**
- Test item is flagged or rejected
- Different user (not the seller) logged into mobile app

**Steps:**
1. Log out of seller account
2. Log in as a different user (buyer account)
3. Navigate to Home → Browse Listings
4. Search for the flagged item by title: "Test Item for Flagging"
5. Try to access the item directly via URL/deep link (if applicable)

**Expected Results:**
- ✅ Flagged/rejected item does NOT appear in browse listings
- ✅ Item does NOT appear in search results
- ✅ Direct access returns empty/error (RLS blocks)
- ✅ Verify with test query (as buyer user's JWT):
   ```sql
   -- Should return 0 rows
   SELECT * FROM items WHERE id = '<item_id>';
   ```

**Pass/Fail:** ___________

---

### TC-SAFETY-P003-007: RLS - Seller Can View Own Flagged/Rejected Items

**Objective:** Seller can still view their own flagged/rejected items

**Preconditions:**
- Test item is flagged or rejected
- Seller user logged into mobile app

**Steps:**
1. Log in as the seller who owns the flagged/rejected item
2. Navigate to Profile → My Listings
3. Locate the flagged/rejected item in the list

**Expected Results:**
- ✅ Item appears in "My Listings" with status badge
- ✅ Status badge shows "flagged" or "rejected" with appropriate color
- ✅ Tapping rejected/flagged item opens "Listing Safety Review" screen
- ✅ If rejected, rejection reason is displayed
- ✅ If rejected, seller can enter an appeal reason before submitting

**Pass/Fail:** ___________

---

### TC-SAFETY-P003-008: Admin Approves Flagged Item

**Objective:** Admin can approve a flagged item, making it available again

**Preconditions:**
- Item is flagged
- Admin logged into admin portal at `/items/flagged`

**Steps:**
1. In flagged items list, click "Review" button for the test item
2. In the review modal, click "Approve & Make Available" button
3. Confirm the action

**Expected Results:**
- ✅ Modal closes after success
- ✅ Success message displayed: "Item approved successfully"
- ✅ Item removed from flagged items list
- ✅ Item status updates to 'available' in database
- ✅ Query to verify:
   ```sql
   SELECT status, flagged_at, rejected_at, rejection_reason
   FROM items WHERE id = '<item_id>';
   ```
   - status = 'available'
   - flagged_at = NULL (cleared)
   - rejected_at = NULL (cleared)
   - rejection_reason = NULL (cleared)

**Pass/Fail:** ___________

---

### TC-SAFETY-P003-009: Appeal Count Increments on Rejection

**Objective:** Each rejection increments the appeal count

**Preconditions:**
- Item initially flagged with appeal_count = 0

**Steps:**
1. Admin rejects item (TC-004)
2. Verify appeal_count = 1
3. Seller taps rejected item in My Listings → opens Listing Safety Review screen
4. Seller enters appeal reason text (example: "I removed the recalled toy and updated photos")
5. Seller taps "Appeal Decision" → item status changes back to 'flagged'
6. Admin opens flagged item review modal and verifies seller appeal note is visible
7. Admin rejects again
8. Verify appeal_count = 2

**Expected Results:**
- ✅ After first rejection: appeal_count = 1
- ✅ After second rejection: appeal_count = 2
- ✅ Seller appeal reason is saved in `items.appeal_reason`
- ✅ Seller appeal timestamp is saved in `items.appealed_at`
- ✅ Admin flagged review page shows latest seller appeal reason
- ✅ Query to verify:
   ```sql
   SELECT appeal_count, appeal_reason, appealed_at FROM items WHERE id = '<item_id>';
   ```

**Pass/Fail:** ___________

---

### TC-SAFETY-P003-010: TypeScript Type Compilation

**Objective:** Verify TypeScript types include new statuses and fields

**Preconditions:**
- Code changes applied to `src/types/listing.ts`

**Steps:**
1. Open terminal in `p2p-kids-marketplace/` directory
2. Run TypeScript type check:
   ```bash
   cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
   npm run typecheck
   ```
3. Verify no type errors related to `ListingStatus`
4. Open `src/types/listing.ts` and inspect the type definition

**Expected Results:**
- ✅ TypeScript compilation succeeds (exit code 0)
- ✅ `ListingStatus` type includes: 'flagged' and 'rejected'
- ✅ `Listing` interface includes:
  - `flagged_at: string | null`
  - `rejected_at: string | null`
  - `rejection_reason: string | null`
  - `appeal_count: number`
   - `appeal_reason: string | null`
   - `appealed_at: string | null`

**Pass/Fail:** ___________

---

## Summary Checklist

After completing all test cases, verify:

- [ ] Database migration applied successfully (TC-001)
- [ ] Admin can flag items (TC-002)
- [ ] Seller receives flagged notification (TC-003)
- [ ] Admin can reject items with reason (TC-004)
- [ ] Seller receives rejected notification with reason (TC-005)
- [ ] RLS prevents non-sellers from viewing flagged/rejected items (TC-006)
- [ ] RLS allows seller to view own flagged/rejected items (TC-007)
- [ ] Admin can approve flagged items (TC-008)
- [ ] Appeal count increments correctly (TC-009)
- [ ] TypeScript types updated correctly (TC-010)

**Overall Status:** PASS / FAIL / PARTIAL

**Notes:**
___________________________________________
___________________________________________
___________________________________________
