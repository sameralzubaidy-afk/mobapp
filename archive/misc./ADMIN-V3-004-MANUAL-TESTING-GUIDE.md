# ADMIN-V3-004 Manual Testing Guide

**Task:** Category Management Page (CRUD + Suggestions + SP Config)  
**Module:** MODULE-12-ADMIN-V3-CATEGORIES  
**Date:** 2026-04-21  
**Agent:** Kids P2P App Builder  

---

## Prerequisites
1. supabase/migrations/20260420000006_add_category_management_columns.sql
2. supabase/migrations/20260420000007_create_category_suggestions.sql
3. supabase/migrations/20260420000008_category_item_count_trigger.sql
4. supabase/migrations/20260420000009_reorder_categories_rpc.sql
5. supabase/migrations/20260420000010_create_category_icons_storage_bucket.sql

1. **Install Dependencies:**
   ```bash
   cd p2p-kids-admin
   npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

2. **Environment Setup:**
   - Supabase project configured with ADMIN-V3-001/002 migrations applied
   - Admin user with valid session
   - At least 3 test categories seeded (including "Other")

3. **Tier 0 Checks:**
   ```bash
   npm run typecheck  # MUST pass
   npm run lint       # MUST pass
   npm run build      # MUST compile successfully
   ```

4. **Start Dev Server:**
   ```bash
   npm run dev
   # Navigate to http://localhost:3001/categories
   ```

---

## Test Cases

### TC-001: Page Load & Navigation
**Priority:** P0 (Blocker)  
**Steps:**
1. Log in as admin
2. Click "Categories" in sidebar
3. Verify URL is `/categories`

**Expected Results:**
- ✅ Page loads without errors
- ✅ "Categories" tab selected by default
- ✅ Badge shows pending suggestion count (if any)
- ✅ Search box visible
- ✅ Filter tabs visible (All / Active / Inactive / Bonus)
- ✅ "+ New Category" button visible
- ✅ Category table rendered with data

**iOS/Android Notes:** N/A (admin portal is Next.js web app)

---

### TC-002: Create Category (Valid Data)
**Priority:** P0  
**Steps:**
1. Click "+ New Category"
2. Enter name: "Test Books"
3. Enter description: "Children's books and educational materials"
4. Tab to "Icon & Badge"
5. Enter icon: 📚
6. Tab to "SP Config"
7. Set earning multiplier: 1.15×
8. Set spending cap: 75%
9. Enter notes: "Promote educational items"
10. Click "Create Category"

**Expected Results:**
- ✅ Modal opens
- ✅ "Create Category" title displayed
- ✅ Basic Info tab auto-selected
- ✅ Name uniqueness check shows "Checking availability..." then clears (no existing match)
- ✅ Live preview shows: Earn 58 SP, Max spend 38 SP (for $50 item)
- ✅ Submit button enabled
- ✅ On submit: success message "Category created successfully"
- ✅ Modal closes, table refreshes
- ✅ New category appears in table with correct values

---

### TC-003: Create Category (Duplicate Name)
**Priority:** P1  
**Steps:**
1. Click "+ New Category"
2. Enter name: "Books" (existing category)
3. Wait 500ms

**Expected Results:**
- ✅ Name field shows error: "A category with this name already exists"
- ✅ Submit button disabled
- ✅ Error persists even if user tries to submit

---

### TC-004: Create Category (Invalid Name)
**Priority:** P1  
**Steps:**
1. Click "+ New Category"
2. Try each invalid name:
   - "ab" (too short)
   - "a".repeat(51) (too long)
   - "Books & Toys" (special char)

**Expected Results:**
- ✅ Name validation error displayed for each case
- ✅ Submit button disabled
- ✅ Error clears when valid name entered

---

### TC-005: Create Category (SP Rates Out of Range)
**Priority:** P1  
**Steps:**
1. Click "+ New Category"
2. Fill valid Basic Info
3. Go to "SP Config" tab
4. Try to set earning multiplier to 1.45× (drag slider past 1.40)
5. Try to set spending cap to 85% (drag slider past 80)

**Expected Results:**
- ✅ Sliders cannot exceed 1.40× and 80%
- ✅ Validation error shown if values manually entered out of range
- ✅ Submit blocked

---

### TC-006: Edit Category
**Priority:** P0  
**Steps:**
1. Click "Edit" button on an existing category (not "Other")
2. Change name to "Updated Name"
3. Change description
4. Go to "SP Config"
5. Change earning multiplier to 1.20×
6. Check "Notify users about rate change"
7. Click "Update Category"

**Expected Results:**
- ✅ Modal opens with "Edit Category" title
- ✅ Form pre-populated with existing values
- ✅ Name uniqueness check excludes current category ID
- ✅ Live preview updates as sliders move
- ✅ On submit: success message "Category updated successfully"
- ✅ Table shows updated values
- ✅ `sp_rate_change_notify` set to true in DB (verify in Supabase Dashboard)

---

### TC-007: Delete Category (Item Count = 0)
**Priority:** P0  
**Steps:**
1. Find category with item_count = 0
2. Click delete button (trash icon)
3. Confirm deletion

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ On confirm: category deleted from DB
- ✅ Table refreshes, category no longer visible
- ✅ Display order of remaining categories adjusted

---

### TC-008: Delete Category (Item Count > 0)
**Priority:** P1  
**Steps:**
1. Find category with item_count > 0 (or manually set one in DB)
2. Hover over delete button

**Expected Results:**
- ✅ Delete button disabled (grayed out)
- ✅ Tooltip shows: "Cannot delete: 5 items in this category"

---

### TC-009: Delete "Other" Category
**Priority:** P1  
**Steps:**
1. Try to delete the "Other" category (even if item_count = 0)

**Expected Results:**
- ✅ Delete button disabled
- ✅ Tooltip shows: "Cannot delete system-required category"

---

### TC-010: Toggle Active/Inactive
**Priority:** P0  
**Steps:**
1. Find an active category (not "Other")
2. Click toggle button
3. Verify state changes to inactive
4. Click toggle again

**Expected Results:**
- ✅ Toggle button changes state immediately (optimistic UI)
- ✅ DB updated (verify in Supabase Dashboard: `is_active` field)
- ✅ Category disappears from "Active" filter view
- ✅ Category appears in "Inactive" filter view
- ✅ Re-toggle restores active state

---

### TC-011: Toggle "Other" Category Inactive
**Priority:** P1  
**Steps:**
1. Try to toggle the "Other" category to inactive

**Expected Results:**
- ✅ Toggle button disabled
- ✅ Tooltip shows: "Other category cannot be deactivated"

---

### TC-012: Drag-and-Drop Reorder
**Priority:** P0  
**Steps:**
1. Drag category #3 above category #1 using the grip handle
2. Drop it
3. Verify visual reorder happens immediately
4. Refresh page

**Expected Results:**
- ✅ Category moves to new position instantly (optimistic UI)
- ✅ RPC `reorder_categories` called
- ✅ After page refresh, order persists (verify `display_order` in DB)
- ✅ If RPC fails, order reverts with error message

---

### TC-013: Search Categories
**Priority:** P1  
**Steps:**
1. Enter "Book" in search box
2. Wait 300ms (debounce)

**Expected Results:**
- ✅ Table filters to show only categories matching "Book" (case-insensitive)
- ✅ Clear search shows all categories again

---

### TC-014: Filter Tabs
**Priority:** P1  
**Steps:**
1. Click "Active" filter tab
2. Click "Inactive" filter tab
3. Click "Bonus" filter tab (sp_earning_multiplier > 1.10)
4. Click "All" filter tab

**Expected Results:**
- ✅ Active tab shows only `is_active = true`
- ✅ Inactive tab shows only `is_active = false`
- ✅ Bonus tab shows only categories with earning multiplier > 1.10 AND active
- ✅ All tab shows everything

---

### TC-015: Bulk Select
**Priority:** P1  
**Steps:**
1. Click "select all" checkbox in table header
2. Verify all visible rows selected
3. Uncheck one row
4. Verify "select all" checkbox becomes indeterminate

**Expected Results:**
- ✅ All rows toggle checkboxes on select all
- ✅ Bulk Actions dropdown appears when ≥1 selected
- ✅ Indeterminate state shown when partial selection

---

### TC-016: Bulk Activate
**Priority:** P1  
**Steps:**
1. Select 2 inactive categories
2. Click "Bulk Actions" → "Activate"
3. Confirm

**Expected Results:**
- ✅ Confirmation dialog shows count: "Activate 2 categories?"
- ✅ On confirm: both categories set to `is_active = true`
- ✅ Table refreshes
- ✅ Success message shown

---

### TC-017: Bulk Deactivate (No Items)
**Priority:** P1  
**Steps:**
1. Select 2 active categories with item_count = 0
2. Click "Bulk Actions" → "Deactivate"

**Expected Results:**
- ✅ Confirmation dialog: "Deactivate 2 categories?"
- ✅ On confirm: both set to inactive
- ✅ No "will hide items" warning if all item_count = 0

---

### TC-018: Bulk Deactivate (With Items)
**Priority:** P1  
**Steps:**
1. Select 2 active categories, at least 1 with item_count > 0
2. Click "Bulk Actions" → "Deactivate"

**Expected Results:**
- ✅ Confirmation shows: "1 have items and will be hidden from search"
- ✅ On confirm: deactivation proceeds
- ✅ Items in those categories hidden from buyer search (verify in mobile app)

---

### TC-019: Bulk Delete (All Empty)
**Priority:** P1  
**Steps:**
1. Select 2 categories with item_count = 0
2. Click "Bulk Actions" → "Delete"
3. Confirm

**Expected Results:**
- ✅ Delete button enabled
- ✅ Confirmation: "Delete 2 categories? This action cannot be undone."
- ✅ On confirm: both deleted
- ✅ Table refreshes

---

### TC-020: Bulk Delete (Some Have Items)
**Priority:** P1  
**Steps:**
1. Select 2 categories, 1 with item_count > 0
2. Click "Bulk Actions" → "Delete"

**Expected Results:**
- ✅ Delete button disabled (grayed out)
- ✅ Shows text: "(some have items)"
- ✅ Clicking does nothing or shows alert: "Cannot delete: Some categories have items"

---

### TC-021: Bulk Export CSV
**Priority:** P2  
**Steps:**
1. Select 3 categories
2. Click "Bulk Actions" → "Export CSV"

**Expected Results:**
- ✅ CSV file downloads: `categories-export-YYYY-MM-DD.csv`
- ✅ Contains columns: id, name, description, is_active, item_count, display_order, sp_earning_multiplier, sp_spending_cap_percent, created_at
- ✅ Data matches selected categories
- ✅ Quoted fields properly escaped

---

### TC-022: Live SP Preview Calculation
**Priority:** P1  
**Steps:**
1. Open CategoryForm (create or edit)
2. Go to "SP Config" tab
3. Set earning multiplier to 1.25×
4. Set spending cap to 60%
5. Observe live preview panel

**Expected Results:**
- ✅ Preview shows: "Seller earns: 63 SP" (Math.round(50 * 1.25))
- ✅ Preview shows: "Buyer can use up to: 30 SP" (Math.floor(50 * 0.60))
- ✅ Preview updates in real-time as sliders move
- ✅ Text shows: "Buyer always pays 40% cash minimum + platform fee"

---

### TC-023: Suggestions Tab (Pending Badge)
**Priority:** P2  
**Steps:**
1. Create a pending suggestion in DB (or wait for real seller submission)
2. Refresh page
3. Verify "Suggestions" tab shows badge with count

**Expected Results:**
- ✅ Badge displays pending count
- ✅ Clicking "Suggestions" tab shows "Coming soon" placeholder (ADMIN-V3-005)
- ✅ Pending count polls every 60s (verify network requests)

---

### TC-024: Icon Display
**Priority:** P2  
**Steps:**
1. Create category with emoji icon: 📚
2. Verify in table
3. Create category with custom icon_url
4. Verify in table

**Expected Results:**
- ✅ Emoji displayed correctly
- ✅ Custom icon_url rendered as `<img>`
- ✅ Fallback to 📦 if no icon set

---

### TC-025: Bonus Badge Display
**Priority:** P2  
**Steps:**
1. Create category with sp_earning_multiplier = 1.25 (> 1.10)
2. Verify in table
3. Set custom bonus_badge_icon_url
4. Verify in table

**Expected Results:**
- ✅ Default ⭐ badge shown next to category name
- ✅ Custom bonus badge icon shown if `bonus_badge_icon_url` set
- ✅ Badge only shown for multiplier > 1.10

---

### TC-026: Modal Accessibility
**Priority:** P2  
**Steps:**
1. Open CategoryForm modal
2. Press Esc key
3. Click outside modal
4. Tab through form fields

**Expected Results:**
- ✅ Esc key closes modal
- ✅ Clicking backdrop closes modal (optional, depending on implementation)
- ✅ Tab order logical (name → description → active → tabs → fields → buttons)
- ✅ Focus trapped within modal

---

### TC-027: Validation on Blur
**Priority:** P2  
**Steps:**
1. Open CategoryForm
2. Enter invalid name: "ab"
3. Click description field (trigger blur on name)

**Expected Results:**
- ✅ Name validation error shown on blur
- ✅ Error persists until fixed

---

### TC-028: Character Counters
**Priority:** P3  
**Steps:**
1. Open CategoryForm
2. Type in description field
3. Type in SP config notes field

**Expected Results:**
- ✅ Description counter shows: "50/200 characters"
- ✅ SP notes counter shows: "100/500 characters"
- ✅ Counters update in real-time

---

## Edge Cases

### EC-001: Network Failure on Create
**Steps:**
1. Disconnect network
2. Try to create category
**Expected:** Error message shown, modal stays open

### EC-002: Network Failure on Reorder
**Steps:**
1. Drag category to new position
2. Simulate RPC failure (block network)
**Expected:** Optimistic UI reverts, error message shown

### EC-003: Concurrent Edit
**Steps:**
1. Open category in edit mode
2. Another admin deletes it in Supabase Dashboard
3. Try to save
**Expected:** Error: "Category not found"

### EC-004: Very Long Description
**Steps:**
1. Paste 201-character text in description
**Expected:** Validation error, submit blocked

---

## Regression Tests (from flow-registry.md)

**FLOW-XX: Category Management (to be added)**
- Covers: CRUD operations, drag-and-drop reorder, SP config, bulk actions, suggestions (ADMIN-V3-005)
- Tier 1: Run TC-001, TC-002, TC-006, TC-007, TC-010, TC-012
- Tier 2: Run all TCs + verify no broken constraints/triggers

---

## Notes for iOS/Android

This is a **Next.js web admin portal**, not a mobile app.  
Testing is done in browser (Chrome/Safari recommended).  
No iOS Simulator or Android Emulator required.

---

## Post-Testing Checklist

- [ ] All P0 test cases pass
- [ ] All P1 test cases pass
- [ ] Tier 0 gates pass (`npm run typecheck && npm run lint && npm run build`)
- [ ] No console errors
- [ ] Supabase DB state verified after each CRUD operation
- [ ] flow-registry.md updated with FLOW-XX
- [ ] ADMIN-V3-004 marked complete in MODULE-12-VERIFICATION-V3.md

---

**Created by:** Kids P2P App Builder Agent  
**Review Status:** Pending user verification  
**Next Steps:** Run Tier 0, then execute TCs P0 → P1 → P2 → P3 → EC
