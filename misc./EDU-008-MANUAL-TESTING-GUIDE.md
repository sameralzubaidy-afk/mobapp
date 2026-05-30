# EDU-008 Manual Testing Guide

**MODULE:** 18 Trading Education V1  
**TASK:** EDU-008 Admin Education Content Management  
**Date:** January 2025  
**Tester:** ____________________

---

## Pre-Testing Setup

### ✅ Prerequisites Checklist
- [ ] Admin portal running locally or on staging
- [ ] Logged in with admin credentials
- [ ] Supabase connection active (production)
- [ ] "Education" navigation item visible in sidebar (under Content Management)

### Required Test Data
No SQL setup required - tables already exist from EDU-001 migration.

---

## Test Suite 1: Navigation & Page Load

### TC-EDU-008-001: Verify Education Page Navigation
**testID:** `education-content-page`

**Steps:**
1. Open admin sidebar
2. Locate "Education" navigation item (should be between "Categories" and "Policies")
3. Click "Education"

**Expected Results:**
- [ ] Page loads at `/education`
- [ ] Page title: "Education Content Management"
- [ ] 3 tabs visible: "Sections", "Examples", "Analytics"
- [ ] "Sections" tab is active by default
- [ ] "Add Section" button visible in top-right

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-002: Verify Tab Switching
**testID:** `tab-sections`, `tab-examples`, `tab-analytics`

**Steps:**
1. Click "Examples" tab
2. Click "Analytics" tab
3. Click "Sections" tab

**Expected Results:**
- [ ] "Examples" tab: Shows example table or empty state
- [ ] "Examples" tab: "Add Example" button visible
- [ ] "Analytics" tab: Shows "Coming Soon" placeholder with bar chart icon
- [ ] "Sections" tab: Returns to section view
- [ ] Active tab has blue background, white text

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

## Test Suite 2: Section CRUD Operations

### TC-EDU-008-003: Create New Section (Draft)
**testID:** `btn-add-section`, `section-form-modal`

**Steps:**
1. Click "Add Section" button
2. Fill form:
   - Title: "What are Swap Points?"
   - Section Type: "sp_definition"
   - Body: "Swap Points (SP) are rewards you earn when selling items. You can use them to reduce the cost of future purchases!"
   - Image URL: `https://example.com/sp-icon.png`
   - Display Order: 1
3. Click "Save Draft"

**Expected Results:**
- [ ] Modal opens with form fields
- [ ] Title shows character counter: "0/100" → updates as you type
- [ ] Body shows character counter: "0/2000" → updates as you type
- [ ] Section Type dropdown has all 6 options: general, sp_definition, sp_earning, sp_spending, safety, example
- [ ] Display Order defaults to 0
- [ ] "Cancel", "Preview", "Save Draft" buttons visible
- [ ] After save: Modal closes
- [ ] Success message: "Section created successfully"
- [ ] New section appears in table with "Draft" status (yellow badge)
- [ ] Section Type is "sp_definition"

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-004: Section Form Validation
**testID:** `input-section-title`, `input-section-body`

**Steps:**
1. Click "Add Section"
2. Try to save with empty fields
3. Try title with < 3 chars: "Hi"
4. Try title with > 100 chars: [paste 101-char string]
5. Try body with < 10 chars: "Test"
6. Try body with > 2000 chars: [paste 2001-char string]

**Expected Results:**
- [ ] Empty fields: "Title is required" error
- [ ] Title < 3 chars: "Title must be 3-100 characters" error
- [ ] Title > 100 chars: Input truncated OR error shown
- [ ] Body < 10 chars: "Body must be 10-2000 characters" error
- [ ] Body > 2000 chars: Input truncated OR error shown
- [ ] Character counter shows red when limit exceeded

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-005: Preview Section in Mobile Frame
**testID:** `btn-preview-section`, `mobile-preview-modal`

**Steps:**
1. Create or edit a section (with image URL: `https://via.placeholder.com/400x200`)
2. Click "Preview" button in form

**Expected Results:**
- [ ] Mobile preview modal opens
- [ ] iPhone frame visible (375×667 px, black border)
- [ ] Status bar shows "9:41 AM" and signal icons
- [ ] Header: "How Trading Works"
- [ ] Section type badge shows (e.g., "sp_definition")
- [ ] Section title displays correctly
- [ ] Image loads and displays (if provided)
- [ ] Body text displays with newlines preserved
- [ ] Yellow "📱 Preview Mode" indicator at bottom
- [ ] "Close Preview" button above frame
- [ ] Device label: "iPhone 8 / SE (375×667)"
- [ ] Esc key closes modal
- [ ] Click backdrop closes modal

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-006: Edit Existing Section
**testID:** `btn-edit-{id}`

**Steps:**
1. Click "Edit" button on a draft section
2. Modify title to: "Understanding Swap Points"
3. Note: Section Type dropdown is DISABLED (cannot change)
4. Click "Save Draft"

**Expected Results:**
- [ ] Modal opens with existing data pre-filled
- [ ] Section Type dropdown is disabled/greyed out
- [ ] Can edit all other fields (title, body, image URL, display order)
- [ ] After save: Modal closes
- [ ] Success message: "Section updated successfully"
- [ ] Table refreshes with new title
- [ ] Section Type remains unchanged

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-007: Publish Section with Confirmation
**testID:** `btn-publish-{id}`, `publish-confirmation-modal`

**Steps:**
1. Click "Publish" button on a draft section
2. Read warning message in confirmation modal
3. Click "Confirm Publish"

**Expected Results:**
- [ ] Confirmation modal opens
- [ ] Warning icon (yellow circle with AlertCircle)
- [ ] Warning text: "⚠️ This will replace the current live section"
- [ ] Explanation mentions unpublishing other sections of same type
- [ ] Section details preview shows title, type, first 100 chars of body
- [ ] "Cancel" and "Confirm Publish" buttons visible
- [ ] Esc key closes modal without publishing
- [ ] After confirm: Modal closes
- [ ] Success message: "Section published successfully"
- [ ] Status badge changes to "Published" (green)
- [ ] "Publish" button changes to "Unpublish"

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-008: Unpublish Section
**testID:** `btn-unpublish-{id}`

**Steps:**
1. Click "Unpublish" button on a published section

**Expected Results:**
- [ ] No confirmation modal (immediate action)
- [ ] Success message: "Section unpublished successfully"
- [ ] Status badge changes to "Draft" (yellow)
- [ ] "Unpublish" button changes to "Publish"
- [ ] Section remains in table (not deleted)

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

## Test Suite 3: Example CRUD Operations

### TC-EDU-008-009: Create Example with SP Preview
**testID:** `btn-add-example`, `example-form-modal`

**Steps:**
1. Switch to "Examples" tab
2. Click "Add Example"
3. Fill form:
   - Item Name: "Pokemon Card Collection"
   - Price: $15.00
   - Category: Select "Toys & Games" (if available, or any category)
   - Display Order: 1
4. Observe SP Preview box while entering price and selecting category
5. Click "Save Draft"

**Expected Results:**
- [ ] Modal opens with empty form
- [ ] Price input shows "$" prefix
- [ ] Price validation: must be $0.01 - $10,000
- [ ] Category dropdown loads all categories (including inactive for admin)
- [ ] Bonus categories show "⭐" icon (multiplier > 1.10)
- [ ] SP Preview box appears when price > 0 AND category selected
- [ ] SP Preview shows: "Seller Earns X SP" and "Buyer Can Use Y SP max"
- [ ] SP values update in real-time when price or category changes
- [ ] After save: Modal closes
- [ ] Success message: "Example created successfully"
- [ ] New example appears in table with computed SP values
- [ ] Status: "Draft" (yellow badge)

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-010: Example SP Calculation Accuracy
**testID:** `example-row-{id}`

**Steps:**
1. Create example: Price = $10.00, Category = "Toys & Games" (multiplier 1.10, cap 50%)
2. Verify SP values in table

**Expected Results:**
- [ ] Earn SP = 11 (10 × 1.10)
- [ ] Max Use SP = 5 (10 × 50% = $5, rounded down)
- [ ] Bonus badge shows "⭐ Bonus" if multiplier > 1.10
- [ ] Category name displays correctly (not just ID)

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-011: Edit Example
**testID:** `btn-edit-{id}`

**Steps:**
1. Click "Edit" button on a draft example
2. Change price to $25.00
3. Change category
4. Observe SP preview updates
5. Click "Save Draft"

**Expected Results:**
- [ ] Modal pre-fills with existing data
- [ ] Can edit all fields (item name, price, category, display order)
- [ ] SP preview updates immediately when price or category changes
- [ ] After save: Table refreshes with new SP values

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-012: Delete Draft Example
**testID:** `btn-delete-{id}`

**Steps:**
1. Click "Delete" button on a DRAFT example
2. Confirm deletion in alert

**Expected Results:**
- [ ] Browser confirm() dialog appears
- [ ] After confirm: Example removed from table
- [ ] Success message: "Example deleted successfully"

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-013: Cannot Delete Published Example
**testID:** `btn-delete-{id}`

**Steps:**
1. Publish an example first
2. Hover over "Delete" button

**Expected Results:**
- [ ] "Delete" button is disabled (greyed out)
- [ ] Tooltip shows: "Unpublish first"
- [ ] Clicking does nothing

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-014: Publish/Unpublish Example
**testID:** `btn-publish-{id}`, `btn-unpublish-{id}`

**Steps:**
1. Click "Publish" on a draft example
2. Verify status changes to "Published" (green)
3. Click "Unpublish"
4. Verify status changes to "Draft" (yellow)

**Expected Results:**
- [ ] Publish: immediate action (no confirmation modal)
- [ ] Status badge updates to green "Published"
- [ ] Unpublish: immediate action
- [ ] Status badge updates to yellow "Draft"
- [ ] Delete button becomes enabled after unpublish

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

## Test Suite 4: Edge Cases & Error Handling

### TC-EDU-008-015: Empty State Display
**testID:** `empty-sections`, `empty-examples`

**Steps:**
1. Delete all sections
2. Verify empty state shows
3. Switch to Examples tab (if no examples exist)

**Expected Results:**
- [ ] Empty sections: "No sections yet. Click "Add Section" to create one."
- [ ] Empty examples: "No examples yet. Click "Add Example" to create one."
- [ ] Empty states have light background and centered text

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-016: Modal Accessibility
**testID:** All modals

**Steps:**
1. Open any modal (SectionForm, ExampleForm, MobilePreview, PublishConfirmation)
2. Press Tab key multiple times
3. Press Shift+Tab
4. Press Esc key

**Expected Results:**
- [ ] Focus trap: Tab cycles through focusable elements within modal only
- [ ] Shift+Tab cycles backwards
- [ ] Esc key closes modal without saving
- [ ] First element receives focus when modal opens
- [ ] Background is click-to-dismiss (except for MobilePreview content area)

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-017: Success/Error Message Display
**testID:** `success-message`, `error-message`

**Steps:**
1. Perform any successful action (create, update, publish)
2. Wait 5 seconds
3. Trigger an error (e.g., invalid category ID)

**Expected Results:**
- [ ] Success message: Green background, white text, appears at top of page
- [ ] Success message auto-clears after 5 seconds
- [ ] Error message: Red background, white text, appears at top of page
- [ ] Error message auto-clears after 5 seconds
- [ ] Only one message shows at a time (no stacking)

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-018: Example Without Category
**testID:** `example-form-modal`

**Steps:**
1. Create example with price $10 but NO category selected
2. Save draft
3. Verify in table

**Expected Results:**
- [ ] SP Preview does NOT show (no category = no SP calculation)
- [ ] Example saves successfully
- [ ] In table: Category shows "Other"
- [ ] Earn SP = 0, Max Use SP = 0
- [ ] No bonus badge

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

### TC-EDU-008-019: Loading States During Actions
**testID:** All action buttons

**Steps:**
1. Click "Publish" on a section (while action is processing)
2. Verify button state

**Expected Results:**
- [ ] Button shows "Publishing..." text (or similar loading indicator)
- [ ] Button is disabled during action
- [ ] Button re-enables after success/error
- [ ] No double-submission possible

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

## Test Suite 5: Multi-Section-Type Behavior

### TC-EDU-008-020: Publish Replaces Same Type
**testID:** `btn-publish-{id}`

**Steps:**
1. Create 2 sections of type "sp_definition":
   - Section A: "What are Swap Points?" (publish first)
   - Section B: "Understanding SP" (draft)
2. Publish Section A
3. Verify Section A is "Published"
4. Publish Section B
5. Check Section A status

**Expected Results:**
- [ ] After publishing A: Only A is published
- [ ] After publishing B: B becomes published, A becomes draft
- [ ] Only ONE section per type can be published at a time
- [ ] Warning modal explained this behavior before confirming

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

## Test Suite 6: Data Persistence & Refresh

### TC-EDU-008-021: Data Persists Across Page Reload
**Steps:**
1. Create a section and publish it
2. Refresh the page (F5 or Cmd+R)
3. Navigate away and back to /education

**Expected Results:**
- [ ] Section still shows as published after refresh
- [ ] All data (title, body, status) persists
- [ ] Examples persist across reload

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

## Test Suite 7: Display Order

### TC-EDU-008-022: Display Order Affects Table Sort
**testID:** `section-table`, `example-table`

**Steps:**
1. Create 3 sections with display_order: 2, 1, 3
2. Verify table sort

**Expected Results:**
- [ ] Sections appear in order: 1, 2, 3 (ascending by display_order)
- [ ] Same behavior for examples

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ___________________________________________________________________

---

## Test Summary

**Total Test Cases:** 22  
**Passed:** _____ / 22  
**Failed:** _____ / 22  
**Blocked:** _____ / 22  

---

## Notes & Issues

| TC ID | Issue Description | Severity | Status |
|-------|-------------------|----------|--------|
|       |                   |          |        |
|       |                   |          |        |
|       |                   |          |        |

---

## Sign-Off

**Tester:** _____________________  
**Date:** _____________________  
**Approved By:** _____________________  
**Date:** _____________________  

---

## Appendix: Quick Test Data Templates

### Section Example 1
```
Title: Earning Swap Points
Type: sp_earning
Body: Every time you sell an item, you earn Swap Points based on the sale price and category. These points appear as "pending" for 3 days to allow for returns.
Image URL: https://via.placeholder.com/400x200/blue/white?text=Earning+SP
Display Order: 2
```

### Section Example 2
```
Title: Using Swap Points
Type: sp_spending
Body: You can use up to 50% of an item's price in Swap Points! Simply adjust the slider during checkout. Note: You always pay the platform fee in cash.
Image URL: https://via.placeholder.com/400x200/green/white?text=Using+SP
Display Order: 3
```

### Example Example 1
```
Item Name: LEGO Star Wars Set
Price: $45.00
Category: Toys & Games
Display Order: 1
```

### Example Example 2
```
Item Name: Mountain Bike
Price: $120.00
Category: Sports & Outdoors
Display Order: 2
```
