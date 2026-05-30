# MODULE-15.1 FLOW-04 Manual Testing Guide: Listing Management UI Redesign

**Module:** `Prompts/MODULE-15.1-UI-redesign.md`  
**Task:** TASK FLOW-04: Listing Management  
**Date:** 2026-05-07  
**Platform:** iOS Simulator + Android Emulator  
**Duration:** ~45 minutes  

---

## Prerequisites

###Before Testing

1. **Tier 0 Gates MUST PASS** (blocking):
   ```bash
   cd p2p-kids-marketplace
   npm run typecheck  # Must exit 0
   npm run lint        # Must exit 0
   npm run test:unit   # All tests green
   ```

2. **Supabase staging environment ready:**
   - Test user account created (free tier)
   - Test user account with Kids Club+ subscription
   - At least 2-3 test listings in database (various statuses: active, pending, rejected)

3. **Simulators running:**
   - iOS Simulator (iPhone 14 or newer, iOS 16+)
   - Android Emulator (Pixel 5, API 31+)

4. **App running in simulator:**
   ```bash
   cd p2p-kids-marketplace
   npm start
   # Press 'i' for iOS or 'a' for Android
   ```

---

## Test Cases

### TC-001: ItemCreateScreen - Photo Upload Empty Slots
**Objective:** Verify photo upload slots use Camera icon with dashed border

**Steps:**
1. Login as test user (free or Kids Club+)
2. Navigate to Create Listing screen
3. Observe empty photo upload slots

**Expected Results:**
- ✅ Empty slots show `Camera` icon (32px, gray `#6B6B6B`)
- ✅ Dashed border `#E0E0E0` around empty slots
- ✅ 1:1 aspect ratio (square slots)
- ✅ No solid borders

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-002: ItemCreateScreen - SP Earn Preview Badge
**Objective:** Verify SP earn badge is gold with Coins icon

**Steps:**
1. On Create Listing screen (as Kids Club+ subscriber)
2. Add at least 1 photo
3. Fill category (e.g., "Toys")
4. Fill price (e.g., "$25.00")
5. Scroll to see SP earn preview badge

**Expected Results:**
- ✅ SP badge visible with text like "Earn ~250 SP"
- ✅ `Coins` icon (16px) appears LEFT of text
- ✅ Background is gold `#FEF3C7`
- ✅ Text color is `#F59E0B` (amber/gold)
- ✅ Badge has 8px border radius

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-003: ItemCreateScreen - Filled Inputs Style
**Objective:** Verify all form inputs use filled style (no borders)

**Steps:**
1. On Create Listing screen
2. Tap into Title input
3. Tap into Description input
4. Tap into Price input
5. Observe Category selector button
6. Observe Condition selector chips

**Expected Results:**
- ✅ All text inputs have `#F0F0F0` background (light gray fill)
- ✅ 12px border radius on all inputs
- ✅ NO `borderWidth` or `borderColor` (no borders)
- ✅ Input height is 52px
- ✅ Placeholder text is `#999999` (light gray)

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-004: ItemCreateScreen - Publish Button Pill Shape
**Objective:** Verify "Publish Listing" button is green pill

**Steps:**
1. Fill all required fields on Create Listing screen
2. Scroll to bottom
3. Observe "Publish Listing" button

**Expected Results:**
- ✅ Button background is `#5DBB8E` (Whisk green)
- ✅ Button height is 52px
- ✅ `borderRadius` is 26 (52 ÷ 2 = pill shape)
- ✅ Button text is white
- ✅ Button spans full width
- ✅ NO border around button

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-005: BulkListingCreateScreen - Empty State Icon
**Objective:** Verify empty state shows Package icon

**Steps:**
1. Navigate to Bulk Listing Create screen
2. Observe screen before adding any photos

**Expected Results:**
- ✅ `Package` icon visible (64px, `#E0E0E0` gray)
- ✅ Icon is centered
- ✅ Text below icon: "Add photos to get started" (15px, `#6B6B6B`)
- ✅ No photos/upload slots visible yet

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-006: BulkListingCreateScreen - Photo Grid Matches Create
**Objective:** Verify photo grid uses same style as single create

**Steps:**
1. On Bulk Create screen
2. Add 3-5 photos
3. Observe photo grid and empty slots

**Expected Results:**
- ✅ Same `Camera` icon (32px, dashed border) for empty slots as TC-001
- ✅ Same filled input style for bulk form fields as TC-003
- ✅ Photo thumbnails have 8px border radius
- ✅ Delete (X) icon appears on filled slots

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-007: BulkListingCreateScreen - Publish All Button
**Objective:** Verify "Publish All" button is green pill

**Steps:**
1. On Bulk Create screen with at least 2 items ready
2. Scroll to bottom
3. Observe "Publish All" or "Publish Listings" button

**Expected Results:**
- ✅ Button background is `#5DBB8E` (green)
- ✅ Button height is 52px
- ✅ `borderRadius` is 26 (pill shape)
- ✅ Button text is white
- ✅ Matches TC-004 style exactly

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-008: EditListingScreen - Pre-Filled Form Style
**Objective:** Verify edit screen mirrors create screen style

**Steps:**
1. Navigate to My Listings
2. Tap "Edit" icon on any active listing
3. Observe pre-filled form

**Expected Results:**
- ✅ Photo grid shows existing photos (same style as create)
- ✅ All inputs pre-filled with existing data
- ✅ Input style matches TC-003 (filled, no borders)
- ✅ SP badge visible if listing accepts SP (same as TC-002)
- ✅ Form layout identical to create screen

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-009: EditListingScreen - Save Changes Button
**Objective:** Verify "Save Changes" button is green pill

**Steps:**
1. On Edit Listing screen
2. Make a small change (e.g., edit title)
3. Scroll to bottom
4. Observe "Save Changes" button

**Expected Results:**
- ✅ Button background is `#5DBB8E` (green)
- ✅ Button height is 52px
- ✅ `borderRadius` is 26 (pill shape)
- ✅ Button text: "Save Changes" (not "Publish")
- ✅ Style matches TC-004 exactly

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-010: EditListingScreen - Delete Link Red
**Objective:** Verify "Delete Listing" link is red text below save button

**Steps:**
1. On Edit Listing screen
2. Scroll to bottom below "Save Changes" button
3. Observe "Delete Listing" link

**Expected Results:**
- ✅ Text: "Delete Listing"
- ✅ Text color is `#E85D75` (red/danger)
- ✅ Font size is 14px
- ✅ Positioned below save button (NOT a filled button)
- ✅ Tappable text link style

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-011: MyListingsScreen - Header Icon Storefront
**Objective:** Verify header shows Storefront icon with green color

**Steps:**
1. Navigate to My Listings screen
2. Observe screen header

**Expected Results:**
- ✅ `Storefront` icon visible (24px, `#5DBB8E` green)
- ✅ Text: "My Listings" next to icon
- ✅ Icon is Phosphor icon (not Ionicons or other)

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-012: MyListingsScreen - Listing Thumbnails
**Objective:** Verify listing row thumbnails are 72×72px with 8px radius

**Steps:**
1. On My Listings screen with at least 3 listings
2. Observe listing rows

**Expected Results:**
- ✅ Thumbnails are 72×72px (square)
- ✅ Border radius is 8px (slightly rounded corners)
- ✅ Title: 16px semibold, `#1A1A1A`, max 2 lines
- ✅ Price: 15px, `#1A1A1A`
- ✅ List view (NOT grid)

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-013: MyListingsScreen - Status Badge Colors
**Objective:** Verify status badges use correct color pairs

**Steps:**
1. On My Listings screen
2. Observe listings with different statuses (active, sold, expired, pending)
3. Check badge colors for each status

**Expected Results:**

| Status | Background | Text Color |
|--------|-----------|-----------|
| Active | `#E8F5F0` (light green) | `#5DBB8E` (green) |
| Sold | `#F5F5F5` (light gray) | `#6B6B6B` (gray) |
| Expired | `#FEF9C3` (light yellow) | `#CA8A04` (amber) |
| Pending | `#FEF3C7` (light orange) | `#D97706` (orange) |

- ✅ Badge shape: pill (borderRadius 12)
- ✅ Text size: 12px, fontWeight '500'

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-014: MyListingsScreen - Action Icons Phosphor
**Objective:** Verify action icons use Phosphor (PencilSimple, Trash, DotsThree)

**Steps:**
1. On My Listings screen
2. Observe each listing row
3. Look for action icons on the right

**Expected Results:**
- ✅ `PencilSimple` icon (20px) for edit action
- ✅ `Trash` icon (20px) for delete action
- ✅ `DotsThree` icon (20px) for more options
- ✅ All icons are Phosphor style (NOT Ionicons)
- ✅ Icon color: `#6B6B6B` (gray)

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-015: MyListingsScreen - Empty State
**Objective:** Verify empty state shows Storefront icon and green CTA

**Steps:**
1. Login as new test user with 0 listings
2. Navigate to My Listings screen
3. Observe empty state

**Expected Results:**
- ✅ `Storefront` icon (64px, `#E0E0E0` light gray) centered
- ✅ Text: "No listings yet"
- ✅ Button: "Create Listing" (green pill, matches TC-004)
- ✅ No listing rows visible

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-016: ListingSafetyReviewScreen - Alert Banner Style
**Objective:** Verify alert banner has red tint background and ShieldWarning icon

**Steps:**
1. Navigate to a rejected or flagged listing (via My Listings)
2. Tap to open Listing Safety Review screen
3. Observe alert banner at top

**Expected Results:**
- ✅ Banner background: `#FEE2E2` (light red)
- ✅ `ShieldWarning` icon (20px, `#E85D75` red) on left
- ✅ Text color: `#E85D75` (red)
- ✅ Text: rejection reason or safety alert
- ✅ Banner spans full width
- ✅ Icon is Phosphor (not Ionicons)

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-017: ListingSafetyReviewScreen - Remove Listing Button RED
**Objective:** Verify "Remove Listing" button is RED pill (danger), NOT green

**Steps:**
1. On Listing Safety Review screen (rejected listing)
2. Scroll to bottom
3. Observe "Remove Listing" button

**Expected Results:**
- ✅ Button background is `#E85D75` (RED/danger) — NOT `#5DBB8E` green
- ✅ Button height is 52px
- ✅ `borderRadius` is 26 (pill shape)
- ✅ Button text is white
- ✅ Button spans full width

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-018: ListingSafetyReviewScreen - Appeal Button Outlined
**Objective:** Verify "Appeal This Decision" button is outlined (NOT filled)

**Steps:**
1. On Listing Safety Review screen (rejected listing)
2. Scroll below "Remove Listing" button
3. Observe "Appeal This Decision" button

**Expected Results:**
- ✅ Button has BORDER (1px, `#6B6B6B` gray) — NOT filled background
- ✅ Button height is 48px (smaller than primary)
- ✅ `borderRadius` is 24 (48 ÷ 2 = pill shape)
- ✅ Text color is `#6B6B6B` (gray) — NOT white
- ✅ Background is transparent/white — NOT filled
- ✅ Positioned below danger button

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-019: ItemCreateScreen - AI Slow/Failure Fallback (Non-Blocking)
**Objective:** Verify users can continue listing creation when AI analysis is slow or fails

**Steps:**
1. Navigate to Create Listing screen
2. Add at least 1 photo
3. Wait for AI analysis overlay to appear
4. Confirm either:
   - Tap "Continue Without AI", or
   - Wait ~7 seconds for auto-unblock
5. Fill Title, Description, Category, and Price while AI is still processing
6. If AI later finishes, verify suggestion card appears and can be applied
7. If AI fails, verify retry card appears and form remains editable

**Expected Results:**
- ✅ User is never permanently blocked by AI analyzing state
- ✅ "Continue Without AI" action dismisses blocking overlay
- ✅ Overlay auto-releases after timeout (~7s) even without user action
- ✅ Form inputs are editable after fallback is activated
- ✅ AI suggestions can still appear later and be applied to empty fields
- ✅ AI error state shows retry option without blocking listing flow

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

### TC-020: BulkListingCreateScreen - AI Slow/Failure Fallback (Non-Blocking)
**Objective:** Verify users can continue bulk item review/editing when AI analysis is slow or fails

**Steps:**
1. Navigate to Bulk Listing Create screen
2. Add photos and confirm grouping to start AI auto-fill
3. Wait for AI analysis overlay to appear
4. Confirm either:
   - Tap "Continue Without AI", or
   - Wait ~7 seconds for auto-unblock
5. Verify review cards become available while AI is still processing
6. Edit at least one item field (title/price/category) while background AI continues
7. Verify background AI status banner appears and then clears after analysis finishes

**Expected Results:**
- ✅ User is not blocked waiting for all AI calls to finish
- ✅ "Continue Without AI" immediately opens review/edit flow
- ✅ Auto-timeout also releases blocking state (~7s)
- ✅ Review cards stay editable while AI continues in background
- ✅ Per-item AI results can still appear after unblock
- ✅ AI failures do not block submit flow once required fields are complete

**Actual Result:** ☐ PASS ☐ FAIL  
**Notes:**

---

## Summary Checklist

### ItemCreateScreen (5 tests)
- [ ] TC-001: Photo upload Camera icon + dashed border
- [ ] TC-002: SP badge gold with Coins icon
- [ ] TC-003: Filled inputs (no borders)
- [ ] TC-004: Publish button green pill
- [ ] TC-019: AI fallback is non-blocking (slow/failure)

### BulkListingCreateScreen (4 tests)
- [ ] TC-005: Empty state Package icon
- [ ] TC-006: Photo grid matches create
- [ ] TC-007: Publish All button green pill
- [ ] TC-020: AI fallback is non-blocking (slow/failure)

### EditListingScreen (3 tests)
- [ ] TC-008: Pre-filled form style matches create
- [ ] TC-009: Save Changes button green pill
- [ ] TC-010: Delete link red text

### MyListingsScreen (5 tests)
- [ ] TC-011: Header Storefront icon green
- [ ] TC-012: Thumbnails 72×72px
- [ ] TC-013: Status badge colors correct
- [ ] TC-014: Action icons Phosphor
- [ ] TC-015: Empty state Storefront + CTA

### ListingSafetyReviewScreen (3 tests)
- [ ] TC-016: Alert banner red with ShieldWarning icon
- [ ] TC-017: Remove button RED pill (danger)
- [ ] TC-018: Appeal button outlined

---

## Pass Criteria

✅ **PASS if:**
- All 20 test cases PASS on both iOS and Android
- Tier 0 gates passed (typecheck + lint + unit tests)
- No visual regressions vs MODULE-15.1 design specs

❌ **FAIL if:**
- Any test case FAIL
- Tier 0 gates did not pass
- Business logic broken (listing creation/edit fails functionally)
- Navigation broken (cannot navigate between screens)

---

## Troubleshooting

### Issue: "Camera icon not showing" in empty photo slots
**Fix:** Verify `phosphor-react-native` is installed:
```bash
npm list phosphor-react-native
# Should show: phosphor-react-native@3.0.6
```

### Issue: "Status badges showing wrong colors"
**Fix:** Check `MyListingsScreen.tsx` StyleSheet - verify badge styles match spec:
```typescript
badgeActive: { backgroundColor: '#E8F5F0', color: '#5DBB8E' }
badgeSold: { backgroundColor: '#F5F5F5', color: '#6B6B6B' }
// etc.
```

### Issue: "Remove Listing button is green instead of red"
**Fix:** Check `ListingSafetyReviewScreen.tsx` - verify danger button uses `#E85D75` not `#5DBB8E`

### Issue: "App crashes when opening Create Listing"
**Fix:** Run Tier 0 checks first - likely a TypeScript compile error:
```bash
npm run typecheck
npm run lint
```

---

## Test Execution Log

| TC | iOS Result | Android Result | Tester | Date | Notes |
|----|-----------|---------------|--------|------|-------|
| TC-001 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-002 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-003 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-004 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-005 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-006 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-007 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-008 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-009 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-010 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-011 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-012 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-013 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-014 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-015 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-016 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-017 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-018 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-019 | ☐ P ☐ F | ☐ P ☐ F | | | |
| TC-020 | ☐ P ☐ F | ☐ P ☐ F | | | |

**Overall Result:** ☐ PASS ☐ FAIL  
**Sign-off:** _______________ **Date:** _______________

---

**End of Manual Testing Guide**
