# ADMIN-V3-009 Manual Testing Guide: Dynamic Category Management + SP Configuration

**Task:** MODULE-12-ADMIN-V3-CATEGORIES TASK ADMIN-V3-009
**Components:**
- Admin Portal: `/categories` page + components
- Mobile App: CategorySelectModal (buyer filter + seller suggestion)
**Purpose:** Verify category CRUD, DnD reordering, SP config, suggestion workflow, and buyer/seller category interactions.

---

## Preconditions

### Environment
- **Admin Portal:** Running on `http://localhost:3001` (Next.js dev server)
- **Mobile App:** iOS Simulator or Android Emulator (NO physical devices)
- **Supabase:** Production or Staging instance (NOT local)
- **Dependencies:**
  - ADMIN-V3-CATEGORIES migrations applied (categories table, triggers, RPC)
  - Edge Functions deployed (category APIs, suggestion approve/reject/merge)
  - Mobile services deployed (categoryService, spConfigService)

### Test User Setup

```sql
-- Admin user (for admin portal)
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';
-- Ensure user has admin role

-- Buyer user (Kids Club+ subscriber for SP preview)
SELECT id, email, subscription_tier FROM auth.users WHERE email = 'buyer@example.com';

-- Seller user (for category suggestion flow)
SELECT id, email FROM auth.users WHERE email = 'seller@example.com';
```

### Seed Data

```sql
-- Verify categories exist
SELECT id, name, item_count, is_active, sp_earning_multiplier, sp_spending_cap_percent
FROM categories
ORDER BY display_order;

-- Create test empty category (for delete test)
INSERT INTO categories (name, is_active, sp_earning_multiplier, sp_spending_cap_percent, display_order)
VALUES ('Test Empty', true, 1.10, 70, 98)
ON CONFLICT (name) DO NOTHING;

-- Create bonus category (multiplier > 1.10)
INSERT INTO categories (name, is_active, sp_earning_multiplier, sp_spending_cap_percent, display_order)
VALUES ('Electronics Bonus', true, 1.25, 75, 5)
ON CONFLICT (name) DO NOTHING;
```

---

## Admin Portal Tests

### TC-ADMIN-001: Category Table Loads with Data

**Objective:** Verify admin categories page loads and displays all categories.

**Platform:** Admin Portal (localhost:3001)

**Steps:**
1. Login as admin user
2. Navigate to `/categories`

**Expected Results:**
- ✅ Page title: "Category Management"
- ✅ "Create Category" button visible
- ✅ Table headers: Name, Icon, Items, SP Config, Status, Actions
- ✅ All categories from DB displayed in rows
- ✅ "Other" category visible (system category)
- ✅ Categories sorted by `display_order` ascending
- ✅ Drag handle icon visible on each row (for reordering)

**Pass/Fail:** [ ]

---

### TC-ADMIN-002: Create New Category (Happy Path)

**Objective:** Create a new category with all fields.

**Steps:**
1. Click "Create Category" button
2. **Basic Info tab:**
   - Name: "Art Supplies"
   - Description: "Art and craft items for kids"
   - Icon: 🎨 (emoji picker or text input)
3. **Icon & Badge tab:**
   - Upload icon image (optional)
   - Upload bonus badge icon (optional)
4. **SP Config tab:**
   - Earning Multiplier: 1.15 (slider or input)
   - Spending Cap: 72% (slider)
   - Config Notes: "Testing bonus for art"
   - sp_rate_change_notify: ✅ (checked)
5. Click "Create"

**Expected Results:**
- ✅ Form validates (no errors)
- ✅ Uniqueness check passes (no duplicate "Art Supplies")
- ✅ Success toast: "Category created"
- ✅ Modal closes
- ✅ "Art Supplies" appears in table
- ✅ Row shows: icon 🎨, item_count=0, "Active" badge
- ✅ SP config shown (1.15 / 72%)

**Pass/Fail:** [ ]

---

### TC-ADMIN-003: Edit Category SP Rates with Live Preview

**Objective:** Edit SP config and verify live $50 preview updates.

**Steps:**
1. Find "Books" category in table
2. Click "Edit" button
3. Navigate to "SP Config" tab
4. Note current preview values at $50:
   - Earn SP: (current value based on multiplier)
   - Max Spend SP: (current value based on cap)
5. Change Earning Multiplier: 1.10 → 1.30 (slider or input)
6. Wait 500ms (debounce)

**Expected Results:**
- ✅ Live preview updates:
  - Earn SP: `Math.round(50 * 1.30)` = **65 SP**
- ✅ Change Spending Cap: 70% → 80%
- ✅ Live preview updates:
  - Max Spend SP: `Math.floor(50 * 0.80)` = **40 SP**
7. Click "Save"
- ✅ Success toast: "Category updated"
- ✅ Table row reflects new SP config

**Pass/Fail:** [ ]

---

### TC-ADMIN-004: Reorder Categories via Drag-and-Drop

**Objective:** Verify DnD reordering persists to DB.

**Steps:**
1. Note initial order in table (e.g., Books → Toys → Clothes)
2. Drag "Books" row to position 3 (below Clothes)
3. Wait 1 second (optimistic update + API call)

**Expected Results:**
- ✅ Table updates optimistically:
  - New order: Toys → Clothes → Books
- ✅ Reload page (`/categories`)
- ✅ Order persists (still Toys → Clothes → Books)
- ✅ DB verification:

```sql
SELECT name, display_order FROM categories ORDER BY display_order;
-- Books.display_order should now be 3 (or higher)
```

**Pass/Fail:** [ ]

---

### TC-ADMIN-005: Deactivate Category (Non-Other)

**Objective:** Deactivate a category, verify hidden from buyers.

**Steps:**
1. Find "Art Supplies" category (created in TC-002)
2. Click toggle button (Active → Inactive)
3. Wait for confirmation

**Expected Results:**
- ✅ Row shows "Inactive" badge
- ✅ No error toast
- ✅ **Mobile verification:**
  - Login as buyer on mobile
  - Open category filter modal
  - "Art Supplies" should NOT appear in list

**Pass/Fail:** [ ]

---

### TC-ADMIN-006: Attempt to Deactivate "Other" Category

**Objective:** Verify system category protection.

**Steps:**
1. Find "Other" category in table
2. Click toggle button

**Expected Results:**
- ✅ Error toast: "Cannot deactivate system category"
- ✅ "Other" remains Active

**Pass/Fail:** [ ]

---

### TC-ADMIN-007: Delete Empty Category (item_count=0)

**Objective:** Delete a category with no items.

**Steps:**
1. Find "Test Empty" category (seeded with item_count=0)
2. Click "Delete" button
3. Confirm in modal

**Expected Results:**
- ✅ Delete button is **enabled**
- ✅ Confirmation modal appears
- ✅ After confirm: category removed from table
- ✅ DB verification:

```sql
SELECT id FROM categories WHERE name = 'Test Empty';
-- Should return 0 rows
```

**Pass/Fail:** [ ]

---

### TC-ADMIN-008: Delete Button Disabled when item_count > 0

**Objective:** Verify deletion protection for categories with items.

**Steps:**
1. Find "Books" category (assume item_count > 0)
2. Observe "Delete" button state

**Expected Results:**
- ✅ Delete button is **disabled** (grayed out or hidden)
- ✅ Tooltip or warning: "Cannot delete category with items"

**Pass/Fail:** [ ]

---

### TC-ADMIN-009: Approve Category Suggestion

**Objective:** Approve a seller suggestion, verify category created + item reassigned.

**Steps:**
1. Navigate to `/categories/suggestions`
2. Find a pending suggestion (e.g., "Art Supplies Test" from seller)
3. Click "Approve" button
4. Fill SP config:
   - Earning: 1.10
   - Spending: 70%
5. Click "Confirm"

**Expected Results:**
- ✅ Success toast: "Suggestion approved"
- ✅ Suggestion status changes to "approved"
- ✅ Navigate to `/categories`
- ✅ New category "Art Supplies Test" appears in table
- ✅ DB verification:

```sql
SELECT id, name FROM categories WHERE name = 'Art Supplies Test';

-- Verify item reassigned
SELECT item_id, category_id FROM category_suggestions WHERE status = 'approved' LIMIT 1;
-- Check items.category_id updated
```

**Pass/Fail:** [ ]

---

### TC-ADMIN-010: Reject Category Suggestion with Note

**Objective:** Reject a suggestion with admin note.

**Steps:**
1. Navigate to `/categories/suggestions`
2. Find a pending suggestion
3. Click "Reject"
4. Enter admin note: "Too generic, please be more specific"
5. Click "Confirm"

**Expected Results:**
- ✅ Success toast: "Suggestion rejected"
- ✅ Suggestion status changes to "rejected"
- ✅ Admin note visible in rejected row

**Pass/Fail:** [ ]

---

### TC-ADMIN-011: Merge Suggestion into Existing Category

**Objective:** Merge duplicate suggestion into canonical category.

**Steps:**
1. Navigate to `/categories/suggestions`
2. Find pending suggestion "Toys Test"
3. Click "Merge"
4. Select target category: "Toys" (from dropdown)
5. Click "Confirm Merge"

**Expected Results:**
- ✅ Success toast: "Suggestion merged"
- ✅ Item reassigned to "Toys" category
- ✅ Suggestion removed from pending list

**Pass/Fail:** [ ]

---

## Mobile App Tests (Buyer)

### TC-MOBILE-001: Category Filter Modal (Empty Categories Hidden)

**Objective:** Verify buyer only sees categories with items (item_count > 0).

**Platform:** iOS/Android Simulator

**Steps:**
1. Login as buyer
2. Navigate to Browse/Discovery tab
3. Tap "Filter" or "Category" button
4. Observe category list in modal

**Expected Results:**
- ✅ Modal title: "Select Category"
- ✅ **Only** categories with `item_count > 0 AND is_active = true` appear
- ✅ Empty categories (item_count=0) NOT shown
- ✅ Inactive categories NOT shown
- ✅ Bonus categories show badge icon (if sp_earning_multiplier > 1.10)

**Pass/Fail:** [ ]

---

### TC-MOBILE-002: SP Preview Shown for Subscribers

**Objective:** Verify Kids Club+ users see SP preview in category modal.

**Platform:** iOS/Android Simulator

**Steps:**
1. Login as buyer (Kids Club+ subscriber)
2. Open category filter modal
3. Tap on "Books" category (or any category)

**Expected Results:**
- ✅ SP preview shown:
  - "Earn up to X SP"
  - "Spend up to Y SP"
- ✅ Values match category's sp_earning_multiplier / sp_spending_cap_percent

**Pass/Fail:** [ ]

---

### TC-MOBILE-003: Bonus Badge Visible for High-Multiplier Categories

**Objective:** Verify bonus badge icon appears for categories with multiplier > 1.10.

**Steps:**
1. Open category filter modal
2. Find "Electronics Bonus" category (multiplier=1.25)

**Expected Results:**
- ✅ Row shows bonus badge icon (e.g., ⭐ or custom icon)
- ✅ Badge positioned next to category name or icon

**Pass/Fail:** [ ]

---

## Mobile App Tests (Seller)

### TC-MOBILE-004: Seller Selects "Other" → Custom Name Input Appears

**Objective:** Verify "Other" category triggers custom name input.

**Platform:** iOS/Android Simulator

**Steps:**
1. Login as seller
2. Navigate to Create Listing
3. Add at least 1 photo
4. Tap "Category" selector
5. Select "Other" from modal

**Expected Results:**
- ✅ Modal closes
- ✅ Custom category input field appears:
  - Label: "Suggest a category name"
  - Placeholder: "e.g., Art Supplies"
- ✅ Input is empty (no pre-filled text)

**Pass/Fail:** [ ]

---

### TC-MOBILE-005: Publish Listing with "Other" → Suggestion Created

**Objective:** Verify category suggestion is created on publish.

**Steps:**
1. Continue from TC-004
2. Enter custom name: "Puzzles & Games"
3. Fill required fields (title, price, condition)
4. Tap "Publish"

**Expected Results:**
- ✅ Success: "Listing published"
- ✅ Informational banner: "Your category suggestion has been submitted for review"
- ✅ DB verification:

```sql
SELECT item_id, suggested_name, seller_id, status
FROM category_suggestions
WHERE suggested_name = 'Puzzles & Games';
-- Should have 1 row with status='pending'
```

**Pass/Fail:** [ ]

---

### TC-MOBILE-006: Duplicate Suggestion → Upserts (No Error)

**Objective:** Verify UNIQUE(item_id) constraint on suggestions.

**Steps:**
1. Edit the same item from TC-005
2. Change custom category name: "Puzzles & Games" → "Board Games"
3. Save changes

**Expected Results:**
- ✅ No error (ON CONFLICT DO UPDATE or silent upsert)
- ✅ DB verification:

```sql
SELECT item_id, suggested_name FROM category_suggestions WHERE item_id = '<item_id>';
-- Should have 1 row with suggested_name='Board Games' (updated)
```

**Pass/Fail:** [ ]

---

## Regression / Integration Tests

### TC-REG-001: SP Calculation Parity (Admin vs Mobile)

**Objective:** Verify admin preview math matches mobile checkout math.

**Steps:**
1. **Admin Portal:**
   - Edit "Books" category
   - SP Config tab: multiplier=1.20, cap=75%
   - Note preview at $50: Earn=60 SP, Max Spend=37 SP
2. **Mobile App:**
   - Create listing in "Books" category with price=$50
   - Observe SP preview in checkout

**Expected Results:**
- ✅ Mobile preview matches admin preview:
  - Earn SP: 60
  - Max Spend SP: 37

**Pass/Fail:** [ ]

---

### TC-REG-002: Reorder After Bulk Deactivate

**Objective:** Verify reordering works after bulk operations.

**Steps:**
1. Bulk-select 2 categories
2. Click "Deactivate"
3. Drag remaining active category to new position

**Expected Results:**
- ✅ Reorder succeeds without error
- ✅ display_order updated correctly

**Pass/Fail:** [ ]

---

## Post-Test Cleanup

```sql
-- Remove test categories
DELETE FROM categories WHERE name IN ('Test Empty', 'Art Supplies', 'Art Supplies Test', 'Electronics Bonus', 'Puzzles & Games', 'Board Games');

-- Remove test suggestions
DELETE FROM category_suggestions WHERE suggested_name LIKE '%Test%';
```

---

## Summary Checklist

- [ ] All admin portal tests pass (TC-ADMIN-001 to TC-ADMIN-011)
- [ ] All mobile buyer tests pass (TC-MOBILE-001 to TC-MOBILE-003)
- [ ] All mobile seller tests pass (TC-MOBILE-004 to TC-MOBILE-006)
- [ ] Regression tests pass (TC-REG-001 to TC-REG-002)
- [ ] No console errors or warnings during tests
- [ ] DB state cleaned up after tests

**Tester:** _______________  
**Date:** _______________  
**Environment:** Staging / Production  
**Overall Result:** PASS / FAIL
