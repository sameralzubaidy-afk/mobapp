# TASK SAFETY-009: Seller Appeal Workflow - Manual Testing Guide

**Module:** MODULE-13-SAFETY-COMPLIANCE.md  
**Task:** SAFETY-009: Implement Seller Appeal Workflow (Resubmit with Changes)  
**Test Environment:** iOS Simulator / Android Emulator with staging Supabase  
**Prerequisites:**
- Supabase migrations 301 and 302 applied
- Test users seeded: 1 seller with at least 1 rejected listing
- Admin access to reject listings via admin portal

---

## 📋 TEST CHECKLIST

| ID | Test Case | Status | Notes |
|----|-----------|--------|-------|
| TC-001 | View rejected listing in My Listings | ⬜ | |
| TC-002 | Open safety review screen for rejected listing | ⬜ | |
| TC-003 | Verify rejection reason displayed | ⬜ | |
| TC-004 | Verify appeal count displayed | ⬜ | |
| TC-005 | Input appeal reason (too short) | ⬜ | |
| TC-006 | Input valid appeal reason (>= 10 chars) | ⬜ | |
| TC-007 | Submit appeal successfully | ⬜ | |
| TC-008 | Verify listing transitions rejected → flagged | ⬜ | |
| TC-009 | Verify appeal reason saved to DB | ⬜ | |
| TC-010 | Edit listing button works | ⬜ | |
| TC-011 | Admin sees appeal in moderation queue | ⬜ | |
| TC-012 | Multiple appeals increment appeal_count | ⬜ | |

---

## PRECONDITIONS

### SQL: Create Test Data
Run this SQL in Supabase SQL Editor BEFORE testing:

```sql
-- Step 1: Create a test seller user if not exists
-- (Replace with your actual test user ID or create via signup flow)
INSERT INTO auth.users (id, email, encrypted_password)
VALUES (
  'test-seller-appeal-001',
  'seller-appeal-test@example.com',
  '$2a$10$abcdefghijklmnopqrstuvwxyz' -- Dummy hash, use real signup
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Insert profile for seller
INSERT INTO profiles (user_id, name, email)
VALUES (
  'test-seller-appeal-001',
  'Test Seller Appeal',
  'seller-appeal-test@example.com'
)
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Create rejected listing for seller
INSERT INTO items (
  id,
  seller_id,
  title,
  description,
  price,
  status,
  rejection_reason,
  rejected_at,
  flagged_at,
  appeal_count
)
VALUES (
  'rejected-item-for-appeal-test',
  'test-seller-appeal-001',
  'Test Rejected Item for Appeal',
  'This listing was rejected to test seller appeal workflow',
  25.99,
  'rejected',
  'Item does not meet safety standards. Please ensure proper labeling and remove any hazardous materials.',
  NOW(),
  NOW() - INTERVAL '1 day',
  0
)
ON CONFLICT (id) DO UPDATE SET
  status = 'rejected',
  rejection_reason = EXCLUDED.rejection_reason,
  rejected_at = NOW(),
  appeal_count = 0;

-- Step 4: Verify test data created
SELECT id, title, status, rejection_reason, appeal_count
FROM items
WHERE id = 'rejected-item-for-appeal-test';
```

**Expected Result:**
```
✅ 1 row returned
✅ id = 'rejected-item-for-appeal-test'
✅ status = 'rejected'
✅ rejection_reason is not null
✅ appeal_count = 0
```

---

## TEST CASES

### **TC-001: View Rejected Listing in My Listings**

**Objective:** Seller can see their rejected listing in My Listings screen

**Steps:**
1. Open app in iOS Simulator or Android Emulator
2. Login as seller: `seller-appeal-test@example.com`
3. Navigate to My Listings (bottom tab)
4. Locate the listing "Test Rejected Item for Appeal"
5. Observe the status badge

**Expected Result:**
- ✅ Listing appears in My Listings
- ✅ Status badge shows "REJECTED" in red background
- ✅ Price "$25.99" visible
- ✅ Can tap on listing card

**Actual Result:**

---

### **TC-002: Open Safety Review Screen for Rejected Listing**

**Objective:** Tapping rejected listing opens dedicated safety review screen

**Steps:**
1. From My Listings, tap on the rejected listing card
2. Wait for screen to load

**Expected Result:**
- ✅ "Listing Safety Review" screen opens
- ✅ Item title "Test Rejected Item for Appeal" displayed
- ✅ Item price "$25.99" displayed
- ✅ Status badge shows "REJECTED"
- ✅ No crash or blank screen

**Actual Result:**

---

### **TC-003: Verify Rejection Reason Displayed**

**Objective:** Admin's rejection reason is visible to seller

**Steps:**
1. On Listing Safety Review screen for rejected item
2. Scroll to "Rejection Reason" section

**Expected Result:**
- ✅ Section titled "Rejection Reason" visible
- ✅ Rejection text matches: "Item does not meet safety standards. Please ensure proper labeling and remove any hazardous materials."
- ✅ Text is legible and formatted clearly

**Actual Result:**

---

### **TC-004: Verify Appeal Count Displayed**

**Objective:** Seller can see how many times they've appealed

**Steps:**
1. On Listing Safety Review screen
2. Locate "Appeals submitted" meta row
3. Check the displayed count

**Expected Result:**
- ✅ Label "Appeals submitted" visible
- ✅ Value shows "0" (first time)
- ✅ "Last flagged at" and "Last rejected at" timestamps visible

**Actual Result:**

---

### **TC-005: Input Appeal Reason (Too Short)**

**Objective:** App validates appeal reason minimum length

**Steps:**
1. On Listing Safety Review screen for rejected item
2. Locate "Appeal Reason for Admin Review" text input
3. Tap on the text input
4. Type: "Fixed"
5. Tap "Appeal Decision" button

**Expected Result:**
- ✅ Alert appears: "Appeal Reason Too Short"
- ✅ Alert message: "Please provide at least 10 characters so admin can review context."
- ✅ Tap "OK" to dismiss
- ✅ Appeal NOT submitted to backend
- ✅ Listing still shows status = "rejected"

**Actual Result:**

---

### **TC-006: Input Valid Appeal Reason (>= 10 chars)**

**Objective:** App accepts valid appeal reason

**Steps:**
1. Clear previous text in appeal reason input
2. Type: "I have corrected the safety concerns and updated the listing details as requested."
3. Observe character counter below input

**Expected Result:**
- ✅ Characters typed: 89
- ✅ Character counter shows "89/500 characters"
- ✅ Appeal Decision button is now enabled (not grayed out)

**Actual Result:**

---

### **TC-007: Submit Appeal Successfully**

**Objective:** Seller can submit appeal and listing re-enters moderation queue

**Steps:**
1. With valid appeal reason entered (from TC-006)
2. Tap "Appeal Decision" button
3. Confirmation alert appears: "Submit Appeal"
4. Alert message: "This will send your listing back for admin review."
5. Tap "Submit Appeal" in alert
6. Wait for API call to complete (~2-3 seconds)

**Expected Result:**
- ✅ Loading state shown (button text: "Submitting...")
- ✅ Buttons disabled during submission
- ✅ After success, alert appears: "Appeal Submitted"
- ✅ Alert message: "Your listing is back under review."
- ✅ Tap "OK" to dismiss
- ✅ Status badge changes from "REJECTED" to "FLAGGED"
- ✅ Appeal Decision button disappears (only shows for rejected items)

**Actual Result:**

---

### **TC-008: Verify Listing Transitions Rejected → Flagged**

**Objective:** After appeal, listing status updates correctly in UI and DB

**Steps:**
1. After successful appeal (from TC-007)
2. Observe status badge on safety review screen
3. Navigate back to My Listings
4. Locate the same listing

**Expected Result:**
- ✅ Safety review screen shows "FLAGGED" badge (yellow)
- ✅ My Listings shows "FLAGGED" badge (yellow)
- ✅ No more "REJECTED" badge visible
- ✅ Listing no longer appears in "Rejected" filter (if admin queue filtered by status)

**Actual Result:**

---

### **TC-009: Verify Appeal Reason Saved to DB**

**Objective:** Appeal reason and timestamp persisted in database

**Steps:**
1. After successful appeal (from TC-007)
2. Open Supabase SQL Editor
3. Run query:
   ```sql
   SELECT id, status, appeal_reason, appealed_at, appeal_count
   FROM items
   WHERE id = 'rejected-item-for-appeal-test';
   ```

**Expected Result:**
- ✅ Query returns 1 row
- ✅ `status` = 'flagged'
- ✅ `appeal_reason` = "I have corrected the safety concerns and updated the listing details as requested."
- ✅ `appealed_at` is recent timestamp (within last 5 minutes)
- ✅ `appeal_count` is still 0 (incremented by trigger on next admin action, or manually)

**Actual Result:**

---

### **TC-010: Edit Listing Button Works**

**Objective:** Seller can edit rejected/flagged listing details

**Steps:**
1. On Listing Safety Review screen (before or after appeal)
2. Tap "Edit Listing" button
3. Edit Listing screen should open

**Expected Result:**
- ✅ Edit Listing screen opens with listing ID passed correctly
- ✅ Form pre-filled with current listing data (title, price, description)
- ✅ Seller can modify fields
- ✅ Save button functional (if tested)

**Actual Result:**

---

### **TC-011: Admin Sees Appeal in Moderation Queue**

**Objective:** Admin portal displays appealed items for review

**Steps:**
1. Open admin portal: `http://localhost:3001` (or deployed admin URL)
2. Navigate to "Items" → "Flagged" (or "Moderation Queue")
3. Locate the listing "Test Rejected Item for Appeal"
4. Check appeal columns

**Expected Result:**
- ✅ Listing appears in "Flagged" tab
- ✅ Status shows "Flagged"
- ✅ "Appeals" column shows "0" or "1" (depending on appeal_count logic)
- ✅ "Latest Appeal Note" column shows seller's appeal reason
- ✅ "Review" button available

**Actual Result:**

---

### **TC-012: Multiple Appeals Increment Appeal Count**

**Objective:** Repeated appeals are tracked correctly

**Precondition:** Admin rejects listing again after first appeal

**Steps:**
1. Admin rejects the flagged listing again (via admin portal):
   - Set status = 'rejected'
   - Add new rejection_reason: "Still does not meet standards"
2. Seller logs in, opens safety review screen again
3. Submit second appeal with reason: "Made additional corrections as requested"
4. Check database:
   ```sql
   SELECT id, status, appeal_count, appeal_reason, appealed_at
   FROM items
   WHERE id = 'rejected-item-for-appeal-test';
   ```

**Expected Result:**
- ✅ After second appeal, `status` = 'flagged'
- ✅ `appeal_count` = 1 (or incremented from previous value)
- ✅ `appeal_reason` = "Made additional corrections as requested" (latest reason)
- ✅ `appealed_at` updated to new timestamp

**Actual Result:**

---

## CLEANUP

### SQL: Remove Test Data
After testing, run this SQL to cleanup:

```sql
-- Delete test listing
DELETE FROM items WHERE id = 'rejected-item-for-appeal-test';

-- Optionally delete test user (admin operation, may require service role)
-- DELETE FROM auth.users WHERE id = 'test-seller-appeal-001';
-- DELETE FROM profiles WHERE user_id = 'test-seller-appeal-001';
```

---

## TROUBLESHOOTING

### Issue: Appeal button does not enable after entering text
**Fix:** Ensure text input is at least 10 characters and not just whitespace

### Issue: Alert "You are not authorized to appeal this listing"
**Fix:** Verify logged-in user ID matches listing's `seller_id`

### Issue: Appeal submission fails with network error
**Fix:** Check Supabase URL/anon key in `.env.local` and ensure staging DB is accessible

### Issue: Status does not change from rejected to flagged
**Fix:** Verify `submitListingAppeal()` service function updates `status` and `flagged_at` fields

---

## SIGN-OFF

**Tested By:** ___________________  
**Date:** ___________________  
**Environment:** iOS Simulator / Android Emulator  
**Supabase:** Staging  

**All Tests Passed?** ✅ YES / ❌ NO  

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

**Ready for Production?** ✅ YES / ❌ NO
