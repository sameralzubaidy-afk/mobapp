# SAFETY-008: Admin Review Workflow - Manual Testing Guide

**Task:** Admin Review Workflow for Flagged Items (Approve/Reject/Request Edits)  
**Module:** MODULE-13-SAFETY-COMPLIANCE.md  
**Test Environment:** iOS/Android Simulators + Admin Web Portal  
**Database:** Supabase Production

---

## ⚠️ PRE-TESTING REQUIREMENTS

### 1. Apply Database Migration

**Run this SQL in Supabase SQL Editor BEFORE testing:**

```sql
-- File: supabase/migrations/20260330000001_safety_008_request_edits_status.sql
-- This migration must be applied to enable 'needs_edits' status
```

**Verification Query (Run after migration):**
```sql
-- Verify status constraint includes needs_edits
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.items'::regclass 
  AND conname LIKE '%status%';

-- Expected: constraint should include 'needs_edits' in the list
```

### 2. Create Test Data

**Run this SQL to create a flagged item for testing:**

```sql
-- Create a test flagged item (or use existing flagged items)
INSERT INTO public.items (
  id, 
  seller_id, 
  title, 
  description, 
  price_cents, 
  status, 
  flagged_at,
  flagged_reason
) 
VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1), -- Use real user ID
  'Test Flagged Item - SAFETY-008',
  'This item was flagged by AI moderation for testing',
  1500,
  'flagged',
  NOW(),
  'AI moderation flagged for inappropriate content'
)
RETURNING id;

-- Copy the returned ID for use in tests below
```

---

## 📱 TEST CASES

### TC-SAFETY-008-001: View Flagged Items Queue

**Preconditions:**
- Admin logged into web portal: `http://localhost:3000` (or staging URL)
- At least 1 item with status='flagged' exists in database
- Migration 20260330000001 applied

**Steps:**
1. Open admin portal in browser
2. Click "Flagged Items" in sidebar navigation
3. Observe the items list

**Expected Results:**
- ✅ Page title shows "Flagged Items Review"
- ✅ Filter tabs visible: All | Flagged | Rejected | Needs Edits
- ✅ "Flagged" tab is selected by default
- ✅ Items with status='flagged' are displayed
- ✅ Each item shows:
  - Item title
  - Price
  - Status badge (yellow background for 'flagged')
  - Flagged date
  - "Review" button

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

### TC-SAFETY-008-002: Open Review Modal

**Preconditions:**
- TC-001 passed
- At least 1 flagged item visible

**Steps:**
1. From flagged items page
2. Click "Review" button on any flagged item
3. Observe modal dialog

**Expected Results:**
- ✅ Modal opens with title "Review Flagged Item"
- ✅ Item details displayed:
  - Title
  - Description
  - Price
  - Images (if any)
  - Flagged date
  - Flagged reason
- ✅ Decision note text area visible with placeholder
- ✅ Three action buttons visible:
  - "Approve" (green)
  - "Reject" (red)
  - "Request Edits" (orange)

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

### TC-SAFETY-008-003: Approve Item (Happy Path)

**Preconditions:**
- TC-002 passed
- Review modal is open

**Steps:**
1. In review modal, enter decision note: "Item looks safe, approved for listing"
2. Click "Approve" button
3. Wait for confirmation
4. Close modal
5. Refresh page

**Expected Results:**
- ✅ Modal closes
- ✅ Success message shown: "Item approved"
- ✅ Item disappears from "Flagged" tab
- ✅ Item status changed to 'available' in database
- ✅ Seller receives notification (check `notifications` table):
  ```sql
  SELECT type, title, body 
  FROM notifications 
  WHERE data->>'item_id' = '<item_id>'
  ORDER BY created_at DESC LIMIT 1;
  ```

**Database Verification:**
```sql
SELECT id, title, status, moderation_note 
FROM items 
WHERE id = '<item_id>';
-- Expected: status='available', moderation_note='Item looks safe...'
```

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

### TC-SAFETY-008-004: Reject Item Without Reason (Validation Error)

**Preconditions:**
- TC-002 passed
- At least 1 flagged item exists

**Steps:**
1. Open review modal for a flagged item
2. Leave decision note field EMPTY
3. Click "Reject" button

**Expected Results:**
- ✅ Error message shown: "Please provide a reason for rejection"
- ✅ Modal remains open
- ✅ Item status NOT changed in database
- ✅ No notification sent to seller

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

### TC-SAFETY-008-005: Reject Item With Reason (Happy Path)

**Preconditions:**
- TC-002 passed
- At least 1 flagged item exists

**Steps:**
1. Open review modal for a flagged item
2. Enter decision note: "Item violates community guidelines - inappropriate imagery"
3. Click "Reject" button
4. Close modal
5. Refresh page

**Expected Results:**
- ✅ Modal closes
- ✅ Success message shown: "Item rejected"
- ✅ Item moves to "Rejected" tab (no longer in "Flagged")
- ✅ Item status changed to 'rejected' in database
- ✅ Rejection timestamp recorded (`rejected_at` field)
- ✅ Seller receives notification with type='item_rejected'

**Database Verification:**
```sql
SELECT id, title, status, rejected_at, rejection_reason 
FROM items 
WHERE id = '<item_id>';
-- Expected: 
--   status='rejected'
--   rejected_at IS NOT NULL
--   rejection_reason='Item violates community guidelines...'

SELECT type, title, body 
FROM notifications 
WHERE data->>'item_id' = '<item_id>' 
  AND type = 'item_rejected'
ORDER BY created_at DESC LIMIT 1;
-- Expected: Notification exists with rejection reason
```

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

### TC-SAFETY-008-006: Request Edits Without Reason (Validation Error)

**Preconditions:**
- TC-002 passed
- At least 1 flagged item exists

**Steps:**
1. Open review modal for a flagged item
2. Leave decision note field EMPTY
3. Click "Request Edits" button

**Expected Results:**
- ✅ Error message shown: "Please provide a reason for requesting edits"
- ✅ Modal remains open
- ✅ Item status NOT changed in database
- ✅ No notification sent to seller

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

### TC-SAFETY-008-007: Request Edits With Reason (Happy Path - NEW FEATURE)

**Preconditions:**
- TC-002 passed
- At least 1 flagged item exists
- Migration 20260330000001 applied (enables needs_edits status)

**Steps:**
1. Open review modal for a flagged item
2. Enter decision note: "Please upload clearer photos and update description to include age range"
3. Click "Request Edits" button
4. Close modal
5. Click "Needs Edits" filter tab
6. Observe items list

**Expected Results:**
- ✅ Modal closes
- ✅ Success message shown: "Edit request sent to seller"
- ✅ Item moves to "Needs Edits" tab
- ✅ Item status changed to 'needs_edits' in database
- ✅ Item badge shows orange background with "Needs Edits" label
- ✅ Seller receives notification with type='item_needs_edits'
- ✅ `rejected_at` field is NULL (not a rejection)
- ✅ `moderation_note` contains the edit request

**Database Verification:**
```sql
SELECT id, title, status, rejected_at, moderation_note 
FROM items 
WHERE id = '<item_id>';
-- Expected: 
--   status='needs_edits'
--   rejected_at IS NULL (important!)
--   moderation_note='Please upload clearer photos...'

SELECT type, title, body 
FROM notifications 
WHERE data->>'item_id' = '<item_id>' 
  AND type = 'item_needs_edits'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 
--   type='item_needs_edits'
--   title='Item Needs Updates'
--   body contains the moderation note
```

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

### TC-SAFETY-008-008: Filter by Status

**Preconditions:**
- Database has items with all 3 statuses: flagged, rejected, needs_edits

**Steps:**
1. On flagged items page, click "All" tab
2. Observe items count
3. Click "Flagged" tab
4. Observe items count
5. Click "Rejected" tab
6. Observe items count
7. Click "Needs Edits" tab
8. Observe items count

**Expected Results:**
- ✅ "All" tab shows items with any of: flagged, rejected, needs_edits
- ✅ "Flagged" tab shows ONLY items with status='flagged' (yellow badge)
- ✅ "Rejected" tab shows ONLY items with status='rejected' (red badge)
- ✅ "Needs Edits" tab shows ONLY items with status='needs_edits' (orange badge)
- ✅ Item counts are accurate for each filter
- ✅ No items missed or duplicated across filters

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

### TC-SAFETY-008-009: Seller Notification Content (Database Check)

**Preconditions:**
- TC-007 passed (Request Edits action completed)

**Steps:**
1. Open Supabase dashboard
2. Navigate to Table Editor → `notifications`
3. Filter by the seller's user ID
4. Find the most recent notification for the item

**Expected Results:**
- ✅ Notification exists with:
  - `type` = 'item_needs_edits'
  - `title` = 'Item Needs Updates'
  - `body` contains the exact decision note entered by admin
  - `data` JSON includes:
    - `item_id`: <UUID of the item>
    - `moderation_note`: <Admin's decision note>
  - `user_id` = seller's user ID
  - `read` = false (unread)

**Database Query:**
```sql
SELECT 
  id,
  type,
  title,
  body,
  data,
  read,
  created_at
FROM notifications
WHERE user_id = '<seller_user_id>'
  AND data->>'item_id' = '<item_id>'
ORDER BY created_at DESC
LIMIT 1;
```

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

### TC-SAFETY-008-010: Bulk Review Workflow

**Preconditions:**
- At least 3 flagged items exist

**Steps:**
1. On flagged items page, review item #1 → Approve
2. Refresh page
3. Review item #2 → Reject with reason
4. Refresh page
5. Review item #3 → Request Edits with reason
6. Refresh page
7. Check all 3 filter tabs

**Expected Results:**
- ✅ Item #1 disappears from all views (status='available')
- ✅ Item #2 appears only in "Rejected" tab
- ✅ Item #3 appears only in "Needs Edits" tab
- ✅ "Flagged" tab now shows 3 fewer items
- ✅ All 3 sellers received appropriate notifications

**Actual Results:** _[Fill after testing]_

**Status:** [ ] PASS [ ] FAIL

---

## 🧪 AUTOMATED TEST COMMANDS

### Unit Tests (Admin Helper Library)
```bash
cd p2p-kids-admin
npm run test -- itemModerationStatus.test.ts
```

**Expected:** 7 tests pass
- validates status type guard
- rejects invalid status values
- requires reason for rejected/needs_edits
- allows available without reason
- builds correct payloads for each status

---

### E2E Tests (API Integration)
```bash
cd p2p-kids-admin
RUN_SUPABASE_E2E=true npm run test:e2e -- items-flagged-status.e2e.test.ts
```

**Expected:** 2 tests (1 pass, 1 skip if env var missing)
- Test 1: Rejects needs_edits without reason (validation)
- Test 2: Updates item status to needs_edits with seller note

**Note:** Test 2 requires env var `SAFETY_008_TEST_ITEM_ID` with a real flagged item ID

---

### Maestro UI Flow (Full Admin Workflow)
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
npm run test:maestro:ios -- .maestro/safety-008-admin-review-request-edits.yaml
```

**Flow Steps:**
1. Navigate to /items/flagged route
2. Verify "Flagged Items Review" title visible
3. Tap "Review" button on first item
4. Enter decision note in text area
5. Tap "Request Edits" button
6. Assert success message visible

---

## 📊 VERIFICATION SUMMARY

| Item | Location | Status |
|------|----------|--------|
| DB Migration | `supabase/migrations/20260330000001_safety_008_request_edits_status.sql` | ✅ Created |
| Helper Library | `p2p-kids-admin/src/lib/itemModerationStatus.ts` | ✅ Created |
| Admin UI | `p2p-kids-admin/src/app/items/flagged/page.tsx` | ✅ Extended |
| Admin API | `p2p-kids-admin/src/app/api/admin/items/[id]/status/route.ts` | ✅ Extended |
| Unit Tests | `p2p-kids-admin/src/lib/__tests__/itemModerationStatus.test.ts` | ✅ 7 tests pass |
| E2E Tests | `p2p-kids-admin/__tests__/e2e/items-flagged-status.e2e.test.ts` | ✅ Created |
| Maestro Flow | `.maestro/safety-008-admin-review-request-edits.yaml` | ✅ Created |
| Flow Registry | `docs/flow-registry.md` | ✅ Updated |
| Manual Tests | `SAFETY-008-MANUAL-TESTING-GUIDE.md` | ✅ This file |

---

## 🐛 KNOWN ISSUES & EDGE CASES

### Edge Case 1: Multiple Admins Reviewing Same Item
**Scenario:** Two admins open review modal for same item simultaneously  
**Current Behavior:** No row locking implemented  
**Expected:** Last action wins (APPROVED overrides REJECTED if done later)  
**Mitigation:** Use optimistic concurrency control (check updated_at) in future iteration

### Edge Case 2: Seller Edits Item While Admin Reviews
**Scenario:** Seller updates item while admin has review modal open  
**Current Behavior:** Admin decision applies to stale data  
**Expected:** Admin sees latest version before deciding  
**Mitigation:** Add version check or "Refresh" button in modal

### Edge Case 3: 1000+ Items in Queue
**Scenario:** Large backlog of flagged items  
**Current Behavior:** All items load (may be slow)  
**Expected:** Pagination or virtual scrolling  
**Mitigation:** Add pagination in future iteration (not blocking for SAFETY-008)

---

## 📝 TEST EXECUTION LOG

| TC ID | Test Date | Tester | Status | Notes |
|-------|-----------|--------|--------|-------|
| TC-001 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |
| TC-002 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |
| TC-003 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |
| TC-004 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |
| TC-005 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |
| TC-006 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |
| TC-007 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |
| TC-008 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |
| TC-009 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |
| TC-010 | ___ | ___ | [ ] PASS [ ] FAIL | ___ |

---

## ✅ SIGN-OFF

**Implementation Complete:** [ ] YES [ ] NO  
**All Tests Pass:** [ ] YES [ ] NO  
**Ready for Production:** [ ] YES [ ] NO  

**Tested By:** ___________________  
**Date:** ___________________  
**Signature:** ___________________
