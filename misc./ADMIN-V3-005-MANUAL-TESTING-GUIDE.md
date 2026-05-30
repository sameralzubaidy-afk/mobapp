# Manual Testing Guide - ADMIN-V3-005
# Category Suggestions Queue
**Task:** ADMIN-V3-005  
**Module:** MODULE-12-ADMIN-V3-CATEGORIES  
**Last Updated:** 2026-04-29  
**Tester:** _________________  
**Environment:** Production Supabase  
**Date Tested:** _________________

---

## Prerequisites

### SQL Setup Required

⚠️ **RUN IN SUPABASE SQL EDITOR BEFORE TESTING:**

```sql
-- 1. Verify category_suggestions table exists
SELECT tablename FROM pg_tables WHERE tablename = 'category_suggestions';
-- Expected: 1 row with 'category_suggestions'

-- 2. Verify RLS policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'category_suggestions';
-- Expected: At least 2 policies (admin manage + seller view)

-- 3. Create test data (if no suggestions exist)
-- Insert a test seller if needed
INSERT INTO profiles (user_id, full_name, email)
VALUES ('test-seller-suggestion-001', 'Test Seller', 'testseller@example.com')
ON CONFLICT DO NOTHING;

-- Insert a test item with "Other" category
INSERT INTO items (seller_id, name, description, price, status, category_id)
SELECT 
  'test-seller-suggestion-001',
  'Test Item Needing Category',
  'A test item for category suggestions',
  15.00,
  'available',
  id
FROM categories WHERE LOWER(name) = 'other'
RETURNING id;
-- Save the returned item_id for next step

-- Insert a pending suggestion (replace {ITEM_ID} with actual ID from above)
INSERT INTO category_suggestions (suggested_name, seller_id, item_id, status)
VALUES ('Vintage Collectibles', 'test-seller-suggestion-001', '{ITEM_ID}', 'pending')
RETURNING *;
-- Expected: 1 row with status = 'pending'

-- 4. Verify pending count
SELECT COUNT(*) FROM category_suggestions WHERE status = 'pending';
-- Expected: At least 1
```

**Wait for confirmation** before proceeding to UI tests.

---

## Test Cases

### TC-001: Navigate to Suggestions Tab ✅ ❌

**Precondition:** Admin logged into portal  
**Priority:** High

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Navigate to `/categories` | Categories page loads | |
| 2 | Observe tab bar | "Suggestions" tab visible with badge count (if pending > 0) | |
| 3 | Click "Suggestions" tab | Tab becomes active (blue underline) | |
| 4 | Observe badge count | Count matches SQL query result from prerequisites | |

**Pass Criteria:**
- Badge shows correct pending count
- Tab switches without error
- Badge has red background with white text

---

### TC-002: View Suggestions List (Empty State) ✅ ❌

**Precondition:** No pending suggestions exist  
**Priority:** Medium

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | On Suggestions tab | Empty state message visible | |
| 2 | Read message | "No pending category suggestions. Suggestions appear when sellers select 'Other'..." | |
| 3 | Verify UI | No table visible, only empty state card | |

**Pass Criteria:**
- Empty state shows helpful guidance text
- No errors in console

---

### TC-003: View Suggestions List (With Data) ✅ ❌

**Precondition:** At least 1 pending suggestion exists (from prerequisites SQL)  
**Priority:** Critical

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | On Suggestions tab | Table with columns: Suggested Name, Item, Seller, Date, Actions | |
| 2 | Verify first row | Suggested Name: "Vintage Collectibles" | |
| 3 | Verify Item column | Item name is a link with external icon | |
| 4 | Click item link | Opens `/items/{id}` in new tab | |
| 5 | Return to admin | Seller column shows name + email | |
| 6 | Verify Date column | Shows relative date ("Just now", "2 days ago", etc.) | |
| 7 | Verify Actions column | 3 buttons: Approve (green), Merge (blue), Reject (red) | |

**Pass Criteria:**
- All columns render correctly
- Item link opens in new tab
- Buttons have correct colors and icons
- Date format is user-friendly

---

### TC-004: Approve Suggestion (Happy Path) ✅ ❌

**Precondition:** At least 1 pending suggestion exists  
**Priority:** Critical

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Click "Approve" button on first suggestion | Approve modal opens | |
| 2 | Verify modal title | "Approve Category Suggestion" | |
| 3 | Verify pre-filled name | Name field contains suggested name | |
| 4 | Verify info card | Shows seller, item, suggested name | |
| 5 | Verify "Active" checkbox | Checked by default | |
| 6 | Click "Approve & Create Category" | Button shows "Creating..." | |
| 7 | Wait for completion | Modal closes | |
| 8 | Observe success message | "Category '{name}' created and item reassigned successfully" (green banner) | |
| 9 | Verify row removed | Suggestion no longer in pending list | |
| 10 | Verify badge count | Decremented by 1 | |
| 11 | Switch to "Categories" tab | New category appears in list | |
| 12 | Run SQL verification | See SQL block below | |

**SQL Verification (run after step 12):**
```sql
-- Verify category created
SELECT * FROM categories WHERE name ILIKE '%vintage%collectibles%';
-- Expected: 1 row with is_active = true

-- Verify suggestion status updated
SELECT status, approved_by, reviewed_at 
FROM category_suggestions 
WHERE suggested_name = 'Vintage Collectibles';
-- Expected: status = 'approved', reviewed_at IS NOT NULL

-- Verify item reassigned
SELECT i.name, c.name AS category_name
FROM items i
JOIN categories c ON i.category_id = c.id
WHERE i.name = 'Test Item Needing Category';
-- Expected: category_name = 'Vintage Collectibles'
```

**Pass Criteria:**
- All UI steps complete without error
- SQL verification passes
- Item count on new category = 1

---

### TC-005: Approve Suggestion (Validation Errors) ✅ ❌

**Precondition:** At least 1 pending suggestion exists  
**Priority:** High

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Click "Approve" on a suggestion | Modal opens | |
| 2 | Clear the name field | Name field is empty | |
| 3 | Click "Approve & Create Category" | Error appears: "Name is required" | |
| 4 | Enter "AB" (2 chars) | Error: "Name must be 3-50 characters" | |
| 5 | Enter "Invalid@Name!" | Error: "Name can only contain letters, numbers, and spaces" | |
| 6 | Enter a duplicate category name | Error: "A category with this name already exists" | |
| 7 | Enter valid unique name (3-50 chars, alphanumeric + spaces) | No error | |
| 8 | Click "Approve & Create Category" | Submission succeeds | |

**Pass Criteria:**
- All validation errors display correctly
- Submit is blocked until valid
- No console errors

---

### TC-006: Merge Suggestion (Happy Path) ✅ ❌

**Precondition:** At least 1 pending suggestion + 1 active category exist  
**Priority:** Critical

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Click "Merge" button on a suggestion | Merge modal opens | |
| 2 | Verify modal title | "Merge Into Existing Category" | |
| 3 | Verify info card | Shows suggestion details | |
| 4 | Verify dropdown | Lists active categories with item counts | |
| 5 | Select a category from dropdown | Selection updates | |
| 6 | Enter admin note (optional) | "Merging because similar to existing" | |
| 7 | Click "Merge Suggestion" | Button shows "Merging..." | |
| 8 | Wait for completion | Modal closes | |
| 9 | Observe success message | "Suggestion merged into '{category}' successfully" | |
| 10 | Verify row removed | Suggestion no longer in pending list | |
| 11 | Verify badge count | Decremented by 1 | |
| 12 | Run SQL verification | See SQL block below | |

**SQL Verification:**
```sql
-- Verify suggestion status
SELECT status, merged_to_category_id, admin_note
FROM category_suggestions
WHERE suggested_name = '{YOUR_SUGGESTION_NAME}';
-- Expected: status = 'merged', merged_to_category_id IS NOT NULL

-- Verify item reassigned to target category
SELECT i.name, c.name AS category_name
FROM items i
JOIN categories c ON i.category_id = c.id
WHERE i.id = '{ITEM_ID}';
-- Expected: category_name matches selected category
```

**Pass Criteria:**
- Item reassigned to selected category
- SQL verification passes
- No new category created

---

### TC-007: Merge Suggestion (No Category Selected) ✅ ❌

**Precondition:** At least 1 pending suggestion exists  
**Priority:** Medium

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Click "Merge" on a suggestion | Modal opens | |
| 2 | Leave dropdown at "-- Select a category --" | No category selected | |
| 3 | Click "Merge Suggestion" | Error: "Please select a category" (red banner) | |
| 4 | Submit button | Remains enabled but doesn't close modal | |
| 5 | Select a category | Error clears | |
| 6 | Click "Merge Suggestion" | Submission proceeds | |

**Pass Criteria:**
- Validation error blocks submission
- Clear error message displayed

---

### TC-008: Reject Suggestion (With Note) ✅ ❌

**Precondition:** At least 1 pending suggestion exists  
**Priority:** High

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Click "Reject" button on a suggestion | Reject modal opens | |
| 2 | Verify modal title | "Reject Category Suggestion" | |
| 3 | Verify warning card | Amber background with warning icon + text | |
| 4 | Verify info card | Shows suggestion details | |
| 5 | Enter admin note | "Too specific, use general category instead" | |
| 6 | Verify character count | Shows "X/500 characters" | |
| 7 | Click "Reject Suggestion" | Button shows "Rejecting..." | |
| 8 | Wait for completion | Modal closes | |
| 9 | Observe success message | "Suggestion '{name}' rejected successfully" | |
| 10 | Verify row removed | Suggestion no longer in pending list | |
| 11 | Verify badge count | Decremented by 1 | |
| 12 | Run SQL verification | See SQL block below | |

**SQL Verification:**
```sql
-- Verify suggestion status
SELECT status, admin_note, reviewed_at
FROM category_suggestions
WHERE suggested_name = '{YOUR_SUGGESTION_NAME}';
-- Expected: status = 'rejected', admin_note = '{your note}', reviewed_at IS NOT NULL

-- Verify item NOT reassigned (stays in "Other")
SELECT i.name, c.name AS category_name
FROM items i
JOIN categories c ON i.category_id = c.id
WHERE i.id = '{ITEM_ID}';
-- Expected: category_name = 'Other' (unchanged)
```

**Pass Criteria:**
- Suggestion marked as rejected
- Admin note saved
- Item remains in original category

---

### TC-009: Reject Suggestion (Without Note) ✅ ❌

**Precondition:** At least 1 pending suggestion exists  
**Priority:** Medium

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Click "Reject" on a suggestion | Modal opens | |
| 2 | Leave admin note field empty | Field is blank | |
| 3 | Click "Reject Suggestion" | Submission proceeds (note is optional) | |
| 4 | Wait for completion | Modal closes, success message appears | |
| 5 | Run SQL verification | `admin_note` should be NULL | |

**SQL Verification:**
```sql
SELECT status, admin_note FROM category_suggestions
WHERE suggested_name = '{YOUR_SUGGESTION_NAME}';
-- Expected: status = 'rejected', admin_note IS NULL
```

**Pass Criteria:**
- Rejection succeeds without note
- admin_note = NULL in database

---

### TC-010: Modal Close Behavior ✅ ❌

**Precondition:** Any pending suggestion exists  
**Priority:** Medium

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Click "Approve" on a suggestion | Modal opens | |
| 2 | Click X button in top-right | Modal closes, no changes saved | |
| 3 | Click "Approve" again | Modal opens | |
| 4 | Click "Cancel" button | Modal closes, no changes saved | |
| 5 | Click "Approve" again | Modal opens | |
| 6 | Click outside modal (on overlay) | Modal closes, no changes saved | |
| 7 | Verify suggestions list | No changes (all suggestions still pending) | |

**Pass Criteria:**
- All close methods work
- No data changes when closing without submit

---

### TC-011: Polling / Realtime Count Update ✅ ❌

**Precondition:** Admin portal open on Suggestions tab  
**Priority:** Low (optional test)

**Method 1: Polling (60s interval)**

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Note current badge count | Count = N | |
| 2 | In Supabase SQL Editor, insert a new suggestion manually | New row created | |
| 3 | Wait 60 seconds (max) | Badge count updates to N+1 | |

**Method 2: Realtime (if implemented)**

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Note current badge count | Count = N | |
| 2 | In Supabase SQL Editor, insert a new suggestion | New row created | |
| 3 | Observe badge (should update within 1-2 seconds) | Badge count = N+1 immediately | |

**SQL to add suggestion:**
```sql
INSERT INTO category_suggestions (suggested_name, seller_id, item_id, status)
VALUES ('Realtime Test Category', 'test-seller-suggestion-001', '{ITEM_ID}', 'pending');
```

**Pass Criteria:**
- Count updates automatically (either after 60s or immediately)

---

## Test Summary

**Total Test Cases:** 11  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____  

### Critical Issues Found:
```
(List any blocking issues here)
```

### Minor Issues Found:
```
(List any non-blocking issues here)
```

### Tested By:
- Name: _________________
- Date: _________________
- Signature: _________________

---

## Cleanup Script (Run After Testing)

```sql
-- Remove test suggestions
DELETE FROM category_suggestions
WHERE seller_id = 'test-seller-suggestion-001';

-- Remove test items
DELETE FROM items
WHERE seller_id = 'test-seller-suggestion-001';

-- Remove test seller
DELETE FROM profiles
WHERE user_id = 'test-seller-suggestion-001';

-- Remove any test categories created during approval tests
DELETE FROM categories
WHERE name ILIKE '%vintage%collectibles%'
   OR name ILIKE '%test%category%';
```

---

## Notes
- All tests assume production Supabase environment
- Admin user ID is resolved from the current authenticated Supabase session
- Badge count may take up to 60 seconds to update if realtime is not enabled
