# EDU-006 Manual Testing Guide
## SP Calculator Widget + BonusCategoryBadge (3 Placements)

**Task:** MODULE-18 EDU-006  
**Test Environment:** iOS Simulator + Android Emulator  
**Prerequisites:**
- App built with latest code (`npm start`)
- Test user logged in
- At least 2 categories seeded (one bonus, one regular)
- Test items available for purchase

---

## Test Suite 1: BonusCategoryBadge Component

### TC-001: Bonus Badge with Custom Icon URL
**Objective:** Verify custom bonus badge icon loads correctly

**Steps:**
1. Navigate to Help screen
2. Open SP Calculator
3. Select a bonus category (sp_earning_multiplier > 1.10)
4. Enter price: $25.00
5. Wait for results

**Expected Results:**
- ✅ Sell panel shows bonus badge next to SP value
- ✅ If category has `bonus_badge_icon_url`, image loads
- ✅ If category has no icon URL, shows ⭐ emoji
- ✅ Badge has yellow background (#FEF3C7) with border

**Pass Criteria:**
- [ ] Badge visible
- [ ] Icon or emoji displayed correctly
- [ ] No layout overflow

---

### TC-002: Bonus Badge Fallback on Image Error
**Objective:** Verify fallback to emoji when image fails

**Steps:**
1. Using Supabase SQL Editor, temporarily set a category's `bonus_badge_icon_url` to invalid URL: `'https://invalid.broken.url/404.png'`
2. Navigate to Help screen → SP Calculator
3. Select that category
4. Enter price: $20.00

**Expected Results:**
- ✅ Initial attempt to load image
- ✅ On error, fallback to ⭐ emoji
- ✅ No crash or blank badge

**Pass Criteria:**
- [ ] Emoji renders after image error
- [ ] Badge still styled correctly

---

## Test Suite 2: SPCalculator - Free Mode (HelpScreen)

### TC-003: Free Mode Initial State
**Objective:** Verify empty state in free mode

**Steps:**
1. Navigate to Settings → Help
2. Scroll to "Try the SP Calculator" section
3. Observe initial state

**Expected Results:**
- ✅ Title: "Calculate Your Swap Points"
- ✅ Category dropdown shows "Select a category"
- ✅ Price input is empty (placeholder: "0.00")
- ✅ Empty state message: "Select a category to see your SP"
- ✅ No results panels visible

**Pass Criteria:**
- [ ] All elements visible
- [ ] No panels shown
- [ ] Empty state text correct

---

### TC-004: Free Mode - Select Category and Enter Price
**Objective:** Verify both sell and buy panels render

**Steps:**
1. From Help screen calculator
2. Tap category dropdown
3. Select "LEGO Sets" (or first category)
4. Tap price input
5. Enter: `35.00`
6. Wait ~0.2-0.5 seconds (live calculation runs automatically)

**Expected Results:**
- ✅ Loading indicator briefly appears
- ✅ Both panels render within 100ms:
  - "If You Sell:" panel with earn_sp value
  - "If You Buy:" panel with max_sp_usable, cash_paid (after SP), platform fee (from admin config), total_cost
- ✅ If category is bonus (multiplier > 1.10):
  - Bonus badge next to earn_sp
  - Text: "Bonus category! Earns X× SP"

**Pass Criteria:**
- [ ] Both panels visible
- [ ] Values populated correctly
- [ ] Bonus badge if applicable
- [ ] Update within 100ms

---

### TC-005: Free Mode - Change Category
**Objective:** Verify calculator recalculates on category change

**Steps:**
1. With calculator showing results from TC-004
2. Tap category dropdown again
3. Select different category (e.g., "Books")
4. Observe

**Expected Results:**
- ✅ Panels update with new category's rates
- ✅ earn_sp changes based on new multiplier
- ✅ max_sp_usable changes based on new cap
- ✅ Bonus badge appears/disappears appropriately

**Pass Criteria:**
- [ ] Values recalculated
- [ ] No stale data
- [ ] Smooth transition

---

### TC-006: Free Mode - Price Boundaries
**Objective:** Verify price input enforces 0-10000 limit

**Steps:**
1. Enter price: `-5`
2. Observe (should reject)
3. Enter price: `15000`
4. Observe (should reject)
5. Enter price: `9999.99`
6. Observe (should accept)

**Expected Results:**
- ✅ Negative prices rejected (input cleared or not accepted)
- ✅ Prices > 10000 rejected
- ✅ Valid prices (0.01-10000) accepted
- ✅ Decimal precision: 2 places max

**Pass Criteria:**
- [ ] Min/max enforced
- [ ] Valid range accepted
- [ ] No crashes

---

## Test Suite 3: SPCalculator - Auto Mode (ItemCreateScreen)

### TC-007: Auto Mode with Category Pre-fill
**Objective:** Verify calculator auto-fills category from listing draft

**Steps:**
1. Navigate to Sell tab
2. Tap "Create Listing"
3. Upload photo
4. Select category: "Toys"
5. Scroll down to "See Your Potential SP" section

**Expected Results:**
- ✅ Calculator visible
- ✅ Category picker shows "Toys" (pre-filled)
- ✅ Category picker is EDITABLE (not disabled)
- ✅ Price input is EDITABLE

**Pass Criteria:**
- [ ] Category pre-filled correctly
- [ ] User can change category
- [ ] Price input works

---

### TC-008: Auto Mode - Price Sync with Manual Input
**Objective:** Verify calculator updates when user enters price

**Steps:**
1. From TC-007 state
2. Scroll to "Price" field
3. Enter: `45.00`
4. Observe calculator above

**Expected Results:**
- ✅ Calculator reflects new price
- ✅ Both panels update automatically
- ✅ earn_sp and max_sp_usable recalculated

**Pass Criteria:**
- [ ] Price syncs
- [ ] Results accurate

---

### TC-009: Auto Mode - Override Category
**Objective:** Verify user can override pre-filled category

**Steps:**
1. From TC-007 state
2. Tap calculator's category picker
3. Select different category (e.g., "Books")

**Expected Results:**
- ✅ Calculator updates to new category
- ✅ Listing form category UNCHANGED (calculator override does not affect form)
- ✅ Results recalculated

**Pass Criteria:**
- [ ] Category change works
- [ ] Form not affected
- [ ] Independent operation

---

## Test Suite 4: TradeInitiationScreen - Legacy Checkout + SP Info Tooltip

### TC-010: No Calculator on Checkout
**Objective:** Verify TradeInitiationScreen uses legacy checkout layout (no embedded SPCalculator)

**Steps:**
1. Navigate to Home tab
2. Tap any item card
3. Tap "Buy Now"
4. Observe the checkout sections

**Expected Results:**
- ✅ "Understand Your Swap Points" calculator section is NOT shown
- ✅ Legacy "Swap Points Discount" section is shown
- ✅ Legacy "Order Summary" and payment sections remain unchanged

**Pass Criteria:**
- [ ] No calculator visible on checkout
- [ ] Legacy checkout sections visible
- [ ] No layout regressions

---

### TC-011: SP Info Icon + Tooltip
**Objective:** Verify users can open SP explanation modal from checkout using info icon

**Steps:**
1. From TC-010 state
2. In "Swap Points Discount" section, tap the info icon (`i`)
3. Verify modal content
4. Tap "Got it" to dismiss

**Expected Results:**
- ✅ SP info tooltip modal opens with title "What are Swap Points (SP)?"
- ✅ Tooltip content matches create-listing SP info content
- ✅ "Got it" closes the modal
- ✅ Checkout screen remains interactive after closing

**Pass Criteria:**
- [ ] Info icon visible
- [ ] Modal opens and closes correctly
- [ ] No crashes or blocked interactions

---

## Test Suite 5: Analytics

### TC-012: Analytics Event Tracking
**Objective:** Verify `calculator_use` event fires

**Prerequisites:**
- Access to Supabase dashboard or logs

**Steps:**
1. Use calculator in free or auto mode
2. Select category + enter price
3. Wait for results
4. Check Supabase `education_analytics` table

**Expected Results:**
- ✅ One row inserted per calculation
- ✅ Fields:
  - `event_type`: "calculator_use"
  - `event_data`: `{ mode: 'free'|'auto', category_id: '...', price_bucket: '<10'|'10-50'|'50-100'|'>100' }`
  - NO exact price logged (privacy)

**Pass Criteria:**
- [ ] Event logged
- [ ] Correct bucket
- [ ] No PII

---

## Test Suite 6: Accessibility

### TC-013: Screen Reader Labels
**Objective:** Verify accessibility labels present

**Steps:**
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Navigate to Help screen calculator
3. Focus on each element

**Expected Results:**
- ✅ Category picker: "Category, button"
- ✅ Price input: "Item price, currency"
- ✅ Results container: "Live region" (announces updates)
- ✅ Bonus badge: "Bonus category badge, image"

**Pass Criteria:**
- [ ] All labels present
- [ ] Live region works
- [ ] Keyboard navigation smooth

---

## Test Suite 7: Cross-Platform (iOS + Android)

### TC-014: iOS Simulator
**Objective:** Verify all 3 placements on iOS

**Steps:**
1. Run `npm start` → press `i` for iOS
2. Execute TC-003 through TC-011
3. Verify no iOS-specific crashes

**Pass Criteria:**
- [ ] All tests pass on iOS
- [ ] No layout issues

---

### TC-015: Android Emulator
**Objective:** Verify all 3 placements on Android

**Steps:**
1. Run `npm start` → press `a` for Android
2. Execute TC-003 through TC-011
3. Verify no Android-specific crashes

**Pass Criteria:**
- [ ] All tests pass on Android
- [ ] No layout issues

---

## Regression Checks

### TC-016: Existing SPEarningsPreview Not Broken
**Objective:** Verify existing SP preview still works on ItemCreateScreen

**Steps:**
1. Navigate to Create Listing
2. Upload photo, select category, enter price
3. Scroll to "SP Earnings Preview" (existing component below price)

**Expected Results:**
- ✅ Existing preview still renders
- ✅ New calculator does NOT conflict
- ✅ Both components work independently

**Pass Criteria:**
- [ ] No regression
- [ ] Both components visible

---

## Summary Checklist

**Before marking EDU-006 complete:**
- [ ] All 16 test cases executed on iOS
- [ ] All 16 test cases executed on Android
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Integration tests pass (`RUN_SUPABASE_E2E=true npm run test:e2e`)
- [ ] Maestro flow passes (`npm run test:maestro:ios` and `npm run test:maestro:android`)
- [ ] No console errors/warnings
- [ ] Analytics events verified in Supabase
- [ ] Code reviewed against acceptance criteria in MODULE-18-TRADING-EDUCATION.md

**Sign-off:**
- Tester: ________________  
- Date: ________________  
- Environment: iOS _____ / Android _____  
- Result: PASS ☐ / FAIL ☐ (with notes: _________________)
