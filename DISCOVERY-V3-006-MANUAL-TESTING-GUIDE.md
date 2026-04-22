# SearchFilterModal Manual Testing Guide

**Module:** MODULE-05-DISCOVERY-V3  
**Task:** DISCOVERY-V3-006  
**Component:** SearchFilterModal  
**Platforms:** iOS Simulator, Android Emulator  
**Date:** April 22, 2026

---

## Prerequisites

✅ App is running on iOS Simulator or Android Emulator  
✅ User is logged in  
✅ At least 3 categories exist in the database  
✅ At least 20 items exist for testing filters  

---

## Test Cases

### TC-001: Modal Opens and Displays All Sections

**Objective:** Verify filter modal opens and shows all 8 filter sections in correct order

**Steps:**
1. Launch the app and navigate to Discover tab
2. Tap the "Filters" button (top-right of screen)

**Expected Results:**
- ✅ Modal slides up from bottom
- ✅ Header shows "Filters" title
- ✅ "Clear All" button visible in header
- ✅ Close button (X) visible in header-right
- ✅ All 8 sections visible in this order:
  1. CATEGORY
  2. CONDITION
  3. AGE GROUP
  4. GENDER
  5. COLOR
  6. BRAND
  7. PRICE RANGE
  8. SWAP POINTS ONLY
- ✅ "Apply Filters" button visible at bottom

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-002: Category Filter (Multi-Select)

**Objective:** Verify category multi-select functionality

**Steps:**
1. Open filter modal
2. Tap on "Toys" category pill
3. Tap on "Books" category pill
4. Tap on "Toys" again (deselect)

**Expected Results:**
- ✅ After step 2: "Toys" pill highlighted (blue background, white text)
- ✅ After step 2: Filter count shows "Filters (1)"
- ✅ After step 3: Both "Toys" and "Books" highlighted
- ✅ After step 3: Filter count still shows "Filters (1)" (multi-category = 1 filter)
- ✅ After step 4: "Toys" no longer highlighted
- ✅ Categories can scroll horizontally if many exist

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-003: Condition Filter (Single-Select)

**Objective:** Verify condition single-select functionality

**Steps:**
1. Open filter modal
2. Tap "New" pill
3. Tap "Like New" pill
4. Tap "Like New" again (deselect)

**Expected Results:**
- ✅ After step 2: "New" pill highlighted
- ✅ After step 2: Filter count shows "Filters (1)"
- ✅ After step 3: "Like New" highlighted, "New" no longer highlighted
- ✅ After step 3: Filter count still "Filters (1)"
- ✅ After step 4: No condition pill highlighted
- ✅ Filter count back to "Filters (0)" or just "Filters"

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-004: Age Group Filter (Single-Select)

**Objective:** Verify age group single-select functionality

**Steps:**
1. Open filter modal
2. Scroll down to Age Group section
3. Tap "3-5" pill
4. Tap "6-8" pill

**Expected Results:**
- ✅ After step 3: "3-5" pill highlighted
- ✅ After step 4: "6-8" highlighted, "3-5" no longer highlighted
- ✅ Only one age group can be selected at a time

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-005: Gender Filter with "Any" Option

**Objective:** Verify gender single-select with "Any" as default

**Steps:**
1. Open filter modal
2. Scroll to Gender section
3. Tap "Boy" pill
4. Tap "Any" pill

**Expected Results:**
- ✅ After step 3: "Boy" pill highlighted
- ✅ After step 3: Filter count increases by 1
- ✅ After step 4: "Any" highlighted, "Boy" no longer highlighted
- ✅ After step 4: Filter count decreases by 1 (Any = no filter)

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-006: Color Filter (Multi-Select with Swatches)

**Objective:** Verify color multi-select functionality with visual swatches

**Steps:**
1. Open filter modal
2. Scroll to Color section
3. Tap "Red" color chip
4. Tap "Blue" color chip
5. Tap "Red" again (deselect)

**Expected Results:**
- ✅ Each color chip shows a colored circle (swatch) matching the color
- ✅ After step 3: "Red" chip has blue border (selected state)
- ✅ After step 4: Both "Red" and "Blue" have blue borders
- ✅ After step 4: Filter count shows colors as 1 filter (multi-color = 1 filter)
- ✅ After step 5: "Red" no longer has blue border
- ✅ All 12 colors from COLOR_PALETTE visible

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-007: Brand Filter (Autocomplete)

**Objective:** Verify brand text input with autocomplete dropdown

**Steps:**
1. Open filter modal
2. Scroll to Brand section
3. Tap on brand input field
4. Type "a" (1 character)
5. Type "le" (total: "ale")
6. Wait 300ms
7. Tap on a suggestion from the dropdown
8. Tap on brand input again
9. Clear text and type "xyz123" (non-existent brand)

**Expected Results:**
- ✅ After step 4: No dropdown appears (requires min 2 chars)
- ✅ After step 6: Dropdown appears with up to 8 brand suggestions
- ✅ All suggestions contain "ale" (case-insensitive)
- ✅ After step 7: Selected brand fills input, dropdown closes
- ✅ After step 7: Filter count increases by 1
- ✅ After step 9: No dropdown appears (no matches)

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-008: Price Range Filter (Presets)

**Objective:** Verify price preset selection

**Steps:**
1. Open filter modal
2. Scroll to Price Range section
3. Tap "$10-$25" preset chip
4. Tap "$25-$50" preset chip

**Expected Results:**
- ✅ After step 3: "$10-$25" chip highlighted
- ✅ After step 3: Custom min input shows "10", max shows "25"
- ✅ After step 3: Filter count increases by 1
- ✅ After step 4: "$25-$50" highlighted, "$10-$25" no longer highlighted
- ✅ After step 4: Custom inputs update to "25" and "50"

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-009: Price Range Filter (Custom Input - Valid)

**Objective:** Verify custom price input with valid range

**Steps:**
1. Open filter modal
2. Scroll to Price Range section
3. Tap "Min" input
4. Enter "15"
5. Tap "Max" input
6. Enter "75"
7. Dismiss keyboard

**Expected Results:**
- ✅ After step 4: Min input shows "15"
- ✅ After step 6: Max input shows "75"
- ✅ No error message appears
- ✅ Apply button is enabled (not greyed out)
- ✅ Filter count includes price as 1 filter

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-010: Price Range Validation (Invalid - Min > Max)

**Objective:** Verify price validation prevents invalid ranges

**Steps:**
1. Open filter modal
2. Scroll to Price Range section
3. Tap "Min" input and enter "100"
4. Tap "Max" input and enter "50"
5. Dismiss keyboard
6. Attempt to tap "Apply Filters" button

**Expected Results:**
- ✅ After step 4: Red error text appears below inputs
- ✅ Error text reads: "Min price must not exceed max price"
- ✅ "Apply Filters" button appears greyed out or disabled
- ✅ After step 6: Modal does NOT close (apply is blocked)
- ✅ Error persists until user fixes the range

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-011: Price Range Validation (Fix Invalid Range)

**Objective:** Verify error clears when range is corrected

**Steps:**
1. Create invalid range (min: 100, max: 50) per TC-010
2. Change max input to "150"
3. Dismiss keyboard

**Expected Results:**
- ✅ After step 2: Error message disappears
- ✅ "Apply Filters" button becomes enabled
- ✅ Filter count includes price as active filter

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-012: Swap Points Toggle

**Objective:** Verify SP-only toggle functionality

**Steps:**
1. Open filter modal
2. Scroll to bottom (Swap Points Only section)
3. Tap the toggle switch to ON
4. Tap the toggle switch to OFF

**Expected Results:**
- ✅ After step 3: Toggle animates to ON position
- ✅ After step 3: Filter count increases by 1
- ✅ Toggle has accessibility label announcing state
- ✅ After step 4: Toggle animates to OFF position
- ✅ After step 4: Filter count decreases by 1

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-013: Clear All Filters

**Objective:** Verify "Clear All" resets all filters to defaults

**Steps:**
1. Open filter modal
2. Select multiple filters across different sections:
   - Select 2 categories
   - Select condition: "Like New"
   - Select age: "3-5"
   - Select gender: "Boy"
   - Select 2 colors
   - Enter brand: "LEGO"
   - Set price: min 10, max 50
   - Toggle SP to ON
3. Verify filter count shows "Filters (8)"
4. Tap "Clear All" button

**Expected Results:**
- ✅ After step 4: All pill selections cleared (no pills highlighted)
- ✅ Brand input cleared
- ✅ Price inputs cleared
- ✅ SP toggle set to OFF
- ✅ Filter count shows "Filters" (no number) or "Filters (0)"
- ✅ All filters back to default state

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-014: Apply Filters (Local Draft State)

**Objective:** Verify changes only apply on "Apply Filters" tap

**Steps:**
1. Open filter modal
2. Select condition: "New"
3. Select age: "6-8"
4. Do NOT tap Apply
5. Tap Close (X) button
6. Re-open filter modal

**Expected Results:**
- ✅ After step 5: Modal closes
- ✅ After step 5: Discover screen shows NO active filter chips
- ✅ After step 6: Modal opens with default filters (NOT the "New" and "6-8" selections)
- ✅ Confirms changes were NOT applied (draft was discarded)

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-015: Apply Filters (Confirmed Application)

**Objective:** Verify filters apply correctly when "Apply Filters" is tapped

**Steps:**
1. Open filter modal
2. Select condition: "Like New"
3. Select age: "3-5"
4. Tap "Apply Filters" button
5. Observe Discover screen
6. Re-open filter modal

**Expected Results:**
- ✅ After step 4: Modal closes
- ✅ After step 5: Active filter chips appear on Discover screen (if implemented)
- ✅ After step 5: Filter button shows badge or count
- ✅ After step 5: Search results filtered (fewer items if applicable)
- ✅ After step 6: Modal shows "Like New" and "3-5" still selected
- ✅ Confirms filters were applied and persist

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-016: Keyboard Awareness (iOS)

**Objective:** Verify modal adjusts for keyboard on iOS

**Steps:**
1. Open filter modal on iOS Simulator
2. Scroll to Brand section
3. Tap brand input (keyboard appears)
4. Scroll to Price section
5. Tap min price input

**Expected Results:**
- ✅ After step 3: Brand input NOT hidden by keyboard
- ✅ Modal content scrollable while keyboard is visible
- ✅ After step 5: Price input NOT hidden by keyboard
- ✅ KeyboardAvoidingView prevents UI from being obscured

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-017: Keyboard Awareness (Android)

**Objective:** Verify modal adjusts for keyboard on Android

**Steps:**
1. Open filter modal on Android Emulator
2. Scroll to Brand section
3. Tap brand input (keyboard appears)
4. Type "lego"
5. Tap outside input (keyboard dismisses)

**Expected Results:**
- ✅ After step 3: Brand input visible above keyboard
- ✅ Modal content adjusts for keyboard height
- ✅ After step 5: Keyboard dismisses smoothly
- ✅ Modal returns to normal scroll state

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-018: Active Filter Count Live Update

**Objective:** Verify filter count updates in real-time as selections change

**Steps:**
1. Open filter modal
2. Observe "Filters" title (should show "Filters" with no count)
3. Select condition: "New"
4. Observe title
5. Select age: "3-5"
6. Observe title
7. Tap "Clear All"
8. Observe title

**Expected Results:**
- ✅ After step 3: Title shows "Filters (1)"
- ✅ After step 5: Title shows "Filters (2)"
- ✅ After step 7: Title shows "Filters" (no count)
- ✅ Count updates immediately without lag

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-019: Accessibility - VoiceOver (iOS)

**Objective:** Verify accessibility for VoiceOver users

**Steps:**
1. Enable VoiceOver on iOS Simulator (Cmd+F5 or Settings > Accessibility > VoiceOver)
2. Open filter modal
3. Swipe through elements
4. Focus on a category pill
5. Double-tap to select
6. Focus on Close button

**Expected Results:**
- ✅ VoiceOver announces "Filters" when modal opens
- ✅ Each pill announces label and selected state
- ✅ Example: "Category: Toys, button, selected" or "not selected"
- ✅ Clear All button announced as "Clear all filters, button"
- ✅ Close button announced as "Close filter modal, button"
- ✅ Apply button announced with enabled/disabled state

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-020: Accessibility - TalkBack (Android)

**Objective:** Verify accessibility for TalkBack users

**Steps:**
1. Enable TalkBack on Android Emulator (Settings > Accessibility > TalkBack)
2. Open filter modal
3. Swipe through elements
4. Focus on SP toggle
5. Double-tap to toggle

**Expected Results:**
- ✅ TalkBack announces modal title
- ✅ Toggle announces state: "Swap points only enabled" or "disabled"
- ✅ All interactive elements have proper labels
- ✅ Selected state announced for pills
- ✅ Navigation order is logical (top to bottom)

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-021: Brand Autocomplete Dropdown Closes

**Objective:** Verify brand dropdown closes when expected

**Steps:**
1. Open filter modal
2. Scroll to Brand section
3. Type "lego" (wait for dropdown to appear)
4. Tap on first suggestion
5. Type "nike" again
6. Tap outside the dropdown (on modal background)

**Expected Results:**
- ✅ After step 4: Dropdown closes, selected brand fills input
- ✅ After step 6: Dropdown closes when tapping outside
- ✅ Dropdown doesn't persist inappropriately

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

### TC-022: Complex Multi-Filter Scenario

**Objective:** Verify all 8 filter dimensions can be active simultaneously

**Steps:**
1. Open filter modal
2. Select:
   - Categories: Toys, Books
   - Condition: Like New
   - Age Group: 3-5
   - Gender: Boy
   - Colors: Blue, Red, Green
   - Brand: LEGO
   - Price: $10-$50
   - SP Toggle: ON
3. Verify filter count shows "Filters (8)"
4. Tap "Apply Filters"
5. Observe Discover screen

**Expected Results:**
- ✅ All 8 filters can be selected without conflicts
- ✅ Filter count correctly shows "Filters (8)"
- ✅ Apply button remains enabled
- ✅ After apply: Discover screen shows filtered results
- ✅ Re-opening modal shows all 8 selections still active

**Status:** ☐ Pass ☐ Fail  
**Notes:** ___________________________________________

---

## Summary

**Total Test Cases:** 22  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____  

**Critical Issues Found:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Minor Issues Found:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Tester Name:** _____________________  
**Date:** _____________________  
**Platform:** ☐ iOS Simulator ☐ Android Emulator  
**Build Version:** _____________________  

---

## Commands to Run

### Unit Tests
```bash
cd p2p-kids-marketplace
npm run test:unit -- SearchFilterModal
```

### Integration Tests
```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- discovery-v3-006
```

### Maestro UI Tests
```bash
cd p2p-kids-marketplace
npm run test:maestro:ios -- .maestro/discovery-v3-006-filter-modal.yaml
npm run test:maestro:android -- .maestro/discovery-v3-006-filter-modal.yaml
```

### TypeScript Check
```bash
cd p2p-kids-marketplace
npm run typecheck
```

### Lint
```bash
cd p2p-kids-marketplace
npm run lint
```
