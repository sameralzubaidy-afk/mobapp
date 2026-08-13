# LISTING-V3-011: SP Earnings Preview - Manual Testing Guide

**Module:** MODULE-04 ITEM LISTING V3  
**Task:** LISTING-V3-011 - SP Earnings Preview for Single & Bulk Listing  
**Date:** April 29, 2026  
**Tester:** _____________  
**Device:** iOS Simulator / Android Emulator  

---

## Prerequisites

### Database Preparation
**⚠️ Run this SQL in Supabase before testing:**
```sql
-- Ensure categories have SP multipliers configured
UPDATE categories
SET sp_earning_multiplier = 1.20
WHERE name = 'Toys';

UPDATE categories  
SET sp_earning_multiplier = 1.10
WHERE name = 'Clothes';

UPDATE categories
SET sp_earning_multiplier = 1.30
WHERE name = 'Books';

-- Verify multipliers are set
SELECT id, name, sp_earning_multiplier FROM categories WHERE is_active = true;
```

### Test Users Required
- **Free User**: User without Kids Club+ subscription
- **Subscriber**: User with active Kids Club+ subscription

---

## Test Suite

### TC-001: Single Item SP Preview - Subscriber (Happy Path)
**Preconditions:**
- Logged in as **Subscriber**
- Navigate to Create Listing screen

**Steps:**
1. Upload a photo
2. Select category: "Toys" (1.20x multiplier)
3. Enter price: "$30"
4. Observe SP Earnings Preview card

**Expected Results:**
- [ ] SP preview card displays: "✅ You'll earn: ~36 SP"
- [ ] Shows "1.20x multiplier for this category"
- [ ] Green checkmark indicates subscriber status
- [ ] No upgrade button visible
- [ ] Info (i) icon is clickable and shows tooltip
- [ ] Calculation: 30 × 1.20 = 36 SP (Math.round)

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-002: Single Item SP Preview - Free User (Upgrade CTA)
**Preconditions:**
- Logged in as **Free User**
- Navigate to Create Listing screen

**Steps:**
1. Upload a photo
2. Select category: "Clothes" (1.10x multiplier)
3. Enter price: "$25"
4. Observe SP Earnings Preview card

**Expected Results:**
- [ ] SP preview shows: "🔒 You'll earn: ~28 SP"
- [ ] Text is grayed out
- [ ] Shows "(Upgrade to Kids Club+ to unlock)"
- [ ] "Upgrade Now" button is visible
- [ ] Tap "Upgrade Now" → navigates to SubscriptionChoice screen
- [ ] Calculation: 25 × 1.10 = 28 SP (rounded)

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-003: SP Preview - No Category Selected
**Preconditions:**
- On Create Listing screen
- No category selected yet

**Steps:**
1. Upload photo
2. Enter price: "$20"
3. Observe SP preview before selecting category

**Expected Results:**
- [ ] Shows placeholder: "💡 Select a category to see estimated SP earnings"
- [ ] No SP value displayed
- [ ] No upgrade button

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-004: SP Preview - No Price Entered
**Preconditions:**
- On Create Listing screen
- Category selected

**Steps:**
1. Upload photo
2. Select category: "Books" (1.30x multiplier)
3. Leave price empty or enter "$0"
4. Observe SP preview

**Expected Results:**
- [ ] Shows placeholder: "💵 Enter a price above to see SP estimate"
- [ ] No SP calculation shown

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-005: SP Preview - "Other" Category Disclaimer
**Preconditions:**
- On Create Listing screen

**Steps:**
1. Upload photo
2. Select category: "Other"
3. Enter price: "$30"
4. Observe SP preview

**Expected Results:**
- [ ] Shows SP estimate using 1.10x default multiplier: "~33 SP"
- [ ] Warning icon ⚠️ displayed
- [ ] Disclaimer: "Base rate - may change after admin approval"
- [ ] SP value: 30 × 1.10 = 33 SP

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-006: SP Preview - Real-time Updates (300ms Debounce)
**Preconditions:**
- On Create Listing screen
- Category selected

**Steps:**
1. Select category: "Toys" (1.20x)
2. Type price slowly: "$10" → "$20" → "$30"
3. Observe SP preview updates

**Expected Results:**
- [ ] SP updates as you type (with slight delay for debounce)
- [ ] Final value for $30: ~36 SP
- [ ] No flickering or excessive recalculations

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-007: SP Info Tooltip
**Preconditions:**
- SP preview card visible

**Steps:**
1. Tap the (i) icon next to "Swap Points Estimate"
2. Read tooltip content
3. Tap "Learn More About SP →" (if present)
4. Tap "Got it" to close

**Expected Results:**
- [ ] Tooltip modal opens with SP explanation
- [ ] Shows "What are Swap Points (SP)?" title
- [ ] Explains earning rates, multipliers, subscriber-only
- [ ] "Learn More" button triggers alert (TODO: navigate to SP screen)
- [ ] "Got it" closes modal

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-008: Bulk Listing SP Summary - Subscriber
**Preconditions:**
- Logged in as **Subscriber**
- Navigate to Bulk Listing screen

**Steps:**
1. Upload 5 photos (auto-groups into 5 items)
2. Set items:
   - Item 1: Toys, $30
   - Item 2: Toys, $20
   - Item 3: Clothes, $25
   - Item 4: Books, $40
   - Item 5: Clothes, $15
3. Navigate to Review step
4. Observe Bulk SP Summary Card above item list

**Expected Results:**
- [ ] Summary card shows "📊 Bulk Listing SP Summary"
- [ ] Shows "Included items" count
- [ ] Shows "SP-enabled items" count (only items with Accept SP ON)
- [ ] Total estimated SP is calculated from SP-enabled items only (not all included items)
- [ ] If any item has Accept SP OFF, card shows warning row: "⚠️ X item(s) are set to Cash Only"
- [ ] Per-category breakdown includes only SP-enabled items
- [ ] Green confirmation text indicates earnings from SP-enabled items
- [ ] No upgrade button (subscriber)

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-009: Bulk SP Summary - Per-Category Breakdown
**Preconditions:**
- Bulk SP Summary visible with multiple categories

**Steps:**
1. Tap "▶ Per-category breakdown" toggle
2. Observe expanded breakdown
3. Tap again to collapse

**Expected Results:**
- [ ] Breakdown expands showing each category
- [ ] Each row shows: category name, item count, SP total, multiplier
- [ ] Example: "• Toys (2 items): ~60 SP (1.20x)"
- [ ] Toggle collapses breakdown

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-010: Bulk SP Summary - Excluded Items Not Counted
**Preconditions:**
- On Bulk Listing Review step

**Steps:**
1. Have 3 items with prices/categories
2. Uncheck "Include in publish" for item 2
3. Observe SP summary recalculation

**Expected Results:**
- [ ] Total SP only includes items 1 and 3
- [ ] Total item count: 2
- [ ] Excluded item's SP not in total

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-011: Bulk SP Summary - Free User
**Preconditions:**
- Logged in as **Free User**
- On Bulk Review step with items

**Steps:**
1. Set up 3 items with categories and prices
2. Observe Bulk SP Summary

**Expected Results:**
- [ ] Total SP shown but grayed out
- [ ] Lock icon 🔒 displayed
- [ ] Message: "Upgrade to Kids Club+ to earn these points when items sell"
- [ ] "Upgrade Now" button visible
- [ ] Per-category breakdown available

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-012: Cache Performance - Fresh Load
**Preconditions:**
- Clear AsyncStorage cache (reinstall app or clear data)

**Steps:**
1. Open Create Listing screen
2. Observe "Loading SP rates..." message
3. Wait for cache to load
4. Select category and enter price

**Expected Results:**
- [ ] Brief loading state on first load
- [ ] API called to fetch category multipliers
- [ ] Cache saved to AsyncStorage
- [ ] SP preview works after load completes

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-013: Cache Performance - Subsequent Loads
**Preconditions:**
- Cache already populated (ran TC-012)

**Steps:**
1. Close and reopen app
2. Navigate to Create Listing
3. Observe SP preview load time

**Expected Results:**
- [ ] No "Loading SP rates..." message (cache used)
- [ ] Instant SP calculation when category/price entered
- [ ] No API call made (24h cache TTL)

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-014: Network Error Handling
**Preconditions:**
- Enable airplane mode AFTER cache expires

**Steps:**
1. Ensure cache is stale (or clear it)
2. Enable airplane mode
3. Open Create Listing screen
4. Attempt to see SP preview

**Expected Results:**
- [ ] Error message: "⚠️ SP rates unavailable (network issue)"
- [ ] OR uses stale cache with warning: "Using cached data (network unavailable)"
- [ ] App doesn't crash
- [ ] User can still create listing (SP preview is non-blocking)

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-015: Accessibility - Screen Reader
**Preconditions:**
- Enable VoiceOver (iOS) or TalkBack (Android)

**Steps:**
1. Navigate through SP preview card with screen reader
2. Focus on info (i) icon
3. Focus on upgrade button (if free user)

**Expected Results:**
- [ ] Info icon announces: "What are Swap Points? Tap to learn more"
- [ ] SP estimate is readable
- [ ] Upgrade button announces: "Upgrade to Kids Club Plus to earn Swap Points"
- [ ] All interactive elements are focusable

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

## Regression Checks

### RC-001: Existing Listing Flow Not Broken
**Steps:**
1. Create a listing without using SP preview (ignore it)
2. Publish item successfully

**Expected Results:**
- [ ] SP preview doesn't interfere with normal flow
- [ ] Item publishes correctly
- [ ] No crashes or validation errors

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

### RC-002: Bulk Listing Flow Not Broken
**Steps:**
1. Complete bulk listing end-to-end
2. Publish all items

**Expected Results:**
- [ ] Bulk summary card doesn't block UI
- [ ] Items publish successfully
- [ ] Apply to All still works

**Status:** ☐ PASS ☐ FAIL  
**Notes:**

---

## Final Sign-Off

**Total Tests:** 17  
**Passed:** ____  
**Failed:** ____  
**Blocked:** ____  

**Critical Issues Found:**
- 

**Tester Signature:** _____________  
**Date Completed:** _____________  
**Approved By:** _____________  

---

## Quick Test Commands

```bash
# Run unit tests
cd p2p-kids-marketplace
npm run test:unit -- --testPathPattern=spCalculations
npm run test:unit -- --testPathPattern=useCategorySPCache

# Run lint
npm run lint

# Run typecheck
npm run typecheck

# Start iOS simulator
npm run ios

# Start Android emulator
npm run android
```
