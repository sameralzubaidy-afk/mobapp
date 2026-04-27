# LISTING-V3-009 Manual Testing Guide
**Task:** Reused / Shared Components (import — do not duplicate)
**Module:** MODULE-04-ITEM-LISTING-V3  
**Test Date:** _________
**Tester:** _________

---

## Prerequisites

- iOS Simulator or Android Emulator running
- Supabase production configured  
- Test user account with login credentials
- Network connection (required for brand autocomplete)

---

## Test Case 1: ColorPicker Uses Shared COLOR_PALETTE

**Objective:** Verify ColorPicker imports COLOR_PALETTE from `@/types/discovery` and displays correct colors.

**Steps:**
1. Open the app in simulator
2. Navigate to: **Create Listing** screen
   - From Home tab → Tap "+" button (or "Sell" tab)
3. Upload at least 1 photo to proceed past photo step  
4. Scroll down to the **Color** section

**Expected Result:**
- ✅ ColorPicker displays exactly **12 color swatches**
- ✅ Colors match MODULE-05 V3 palette:
  - Red, Blue, Green, Yellow, Pink, Purple
  - Black, White, Gray, Brown, Orange, Multicolor
- ✅ Each swatch has correct label text
- ✅ Tap behavior: checkmark appears on selected colors
- ✅ Can select up to 3 colors (counter shows "X/3 selected")

**Actual Result:**
___________________________________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## Test Case 2: BrandAutocompleteInput Shows Predefined Brands

**Objective:** Verify BrandAutocompleteInput uses `getBrandSuggestions` from `@/services/brandAutocomplete`.

**Steps:**
1. From **Create Listing** screen (with 1+ photo uploaded)
2. Scroll to **Brand** input field
3. Tap on Brand input
4. Type: `le`

**Expected Result:**
- ✅ After typing 2 characters, autocomplete dropdown appears (150ms debounce)
- ✅ Suggestions include predefined brands like:
  - LEGO
  - Melissa & Doug
- ✅ Dropdown shows up to 8 suggestions
- ✅ Loading spinner shows briefly while fetching

**Actual Result:**
___________________________________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## Test Case 3: BrandAutocompleteInput - Selection

**Objective:** Verify brand selection updates input and dismisses dropdown.

**Steps:**
1. Continue from TC-2  
2. While dropdown is visible with LEGO suggestion
3. Tap on **LEGO** suggestion

**Expected Result:**
- ✅ Brand input value becomes "LEGO"
- ✅ Dropdown disappears
- ✅ Keyboard dismisses

**Actual Result:**
___________________________________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## Test Case 4: BrandAutocompleteInput - Fuzzy Matching

**Objective:** Verify fuzzy matching works (uses levenshteinDistance from shared utils).

**Steps:**
1. Clear Brand input
2. Type: `nik` (misspelled Nike)

**Expected Result:**
- ✅ Suggestions include "Nike" (fuzzy match tolerance = 3 edits)
- ✅ Other partial matches may appear (e.g., "Nike Kids" if in DB)

**Actual Result:**
___________________________________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## Test Case 5: BrandAutocompleteInput - No Results

**Objective:** Verify empty results handled gracefully.

**Steps:**
1. Clear Brand input
2. Type: `xyz123notabrand`

**Expected Result:**
- ✅ No dropdown appears (or empty dropdown)
- ✅ No error displayed
- ✅ Input remains editable

**Actual Result:**
___________________________________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## Test Case 6: BrandAutocompleteInput - Query < 2 Characters

**Objective:** Verify autocomplete does not trigger for 1-character queries.

**Steps:**
1. Clear Brand input
2. Type: `a` (single character)

**Expected Result:**
- ✅ NO dropdown appears
- ✅ No network request made (check console logs if needed)

**Actual Result:**
___________________________________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## Test Case 7: ColorPicker Multi-Select Limit

**Objective:** Verify max 3 colors can be selected.

**Steps:**
1. Return to **Create Listing** > **Color** section  
2. Tap Red swatch → ✅ selected  
3. Tap Blue swatch → ✅ selected  
4. Tap Green swatch → ✅ selected  
5. Tap Yellow swatch (4th color attempt)

**Expected Result:**
- ✅ Yellow does NOT get selected (limit reached)
- ✅ Only Red, Blue, Green have checkmarks
- ✅ Counter shows "3/3 selected"
- ✅ Limit text appears: "Maximum 3 colors"

**Actual Result:**
___________________________________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## Test Case 8: ColorPicker Deselect

**Objective:** Verify color deselection works.

**Steps:**
1. Continue from TC-7 (3 colors selected)
2. Tap Red swatch again (already selected)

**Expected Result:**
- ✅ Red checkmark disappears
- ✅ Only Blue and Green remain selected
- ✅ Counter updates to "2/3 selected"
- ✅ Can now select a different color

**Actual Result:**
___________________________________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## Test Case 9: Complete Listing Creation with Shared Components

**Objective:** End-to-end test using all shared components.

**Steps:**
1. From **Create Listing** screen
2. Upload 1 photo
3. Enter Title: "Test Item - Shared Components"
4. Select Category: "Toys"
5. Select Condition: "Good"
6. Use **BrandAutocompleteInput**: type "lego" → select "LEGO"
7. Use **ColorPicker**: select Red, Blue
8. Select Age Group: "3-5"
9. Select Gender: "Unisex"
10. Enter Price: "15"
11. Tap **Publish** button

**Expected Result:**
- ✅ Item submits successfully  
- ✅ Success modal shows: "Item submitted for review"
- ✅ Redirects to draft list or success screen
- ✅ Item visible in admin review queue with:
  - Brand = "LEGO"
  - Color = ["red", "blue"]

**Actual Result:**
___________________________________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## Code Verification (Developer Check)

### Grep Checks (Run in terminal from `p2p-kids-marketplace/`)

```bash
# Verify only ONE PREDEFINED_BRANDS definition
grep -r "export const PREDEFINED_BRANDS" src/ --include="*.ts" --include="*.tsx" | wc -l
# Expected: 1

# Verify only ONE COLOR_PALETTE definition
grep -r "export const COLOR_PALETTE" src/ --include="*.ts" --include="*.tsx" | wc -l
# Expected: 1

# Verify only ONE levenshteinDistance implementation
grep -r "function levenshteinDistance" src/ --include="*.ts" --include="*.tsx" | wc -l
# Expected: 1

# Verify BrandAutocompleteInput imported correctly
grep -r "import.*BrandAutocompleteInput" src/screens/ --include="*.tsx"
# Expected: src/screens/ItemCreateScreen.tsx:import { BrandAutocompleteInput } from '../components/molecules/BrandAutocompleteInput';
```

**Results:**
- PREDEFINED_BRANDS count: _____
- COLOR_PALETTE count: _____
- levenshteinDistance count: _____
- BrandAutocompleteInput import: ⬜ Found ⬜ Not Found

---

## Summary

**Total Test Cases:** 9  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____

**Overall Status:** ⬜ PASS ⬜ FAIL  

**Notes:**
___________________________________________________
___________________________________________________
___________________________________________________

**Tester Signature:** _______________ **Date:** ___________
