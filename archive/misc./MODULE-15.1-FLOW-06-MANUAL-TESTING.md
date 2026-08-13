# MODULE-15.1-FLOW-06 Manual Testing Guide

**Task:** FLOW-06 Discovery & Search UI Redesign  
**Target Platforms:** iOS Simulator, Android Emulator  
**Test Environment:** Staging (Supabase production)  
**Package Manager:** npm (NOT yarn)

---

## Pre-Test Setup

### 1. Start iOS Simulator
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm start
# In separate terminal:
i  # Press 'i' to open iOS simulator
```

### 2. Start Android Emulator
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm start
# In separate terminal:
a  # Press 'a' to open Android emulator
```

### 3. Verify Tier 0 Checks Passed
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm run lint
npm run typecheck
```
**Expected:** Both commands exit with code 0, no errors in redesigned files.

---

## Test Cases

### TC-FLOW06-001: DiscoverScreen - Search Bar Redesign

**Steps:**
1. Navigate to Discover tab (bottom nav)
2. Observe search bar at top

**Expected Results:**
- ✅ Search bar has pill shape (borderRadius 24px)
- ✅ Background color: #F0F0F0 (light gray fill, NO border)
- ✅ Height: 48px
- ✅ MagnifyingGlass icon (Phosphor) on left (20px, #6B6B6B)
- ✅ Placeholder text: "Search items..." (#999999)
- ✅ When typing, X icon appears on right (20px, #6B6B6B)
- ✅ Tap X clears input and removes X icon

---

### TC-FLOW06-002: DiscoverScreen - Filter Button

**Steps:**
1. On Discover screen, locate filter button (top-right)

**Expected Results:**
- ✅ Circular button (44×44px, borderRadius 22px)
- ✅ FunnelSimple icon (Phosphor, 20px, #6B6B6B)
- ✅ White background, subtle shadow
- ✅ When filters are active, green badge appears (10px circle, #5DBB8E, top-right overlay)
- ✅ Tap opens SearchFilterModal

---

### TC-FLOW06-003: DiscoverScreen - 2-Column Item Grid

**Steps:**
1. Scroll Discover results list
2. Observe item card layout

**Expected Results:**
- ✅ 2 columns (numColumns={2})
- ✅ Gap between columns: 12px
- ✅ Screen padding: 16px horizontal
- ✅ Each ItemCard has:
  - Square image (aspectRatio 1)
  - Heart/Share overlay icons (top-right, 32×32px circles, white bg, shadow)
  - Title below image (14px, #1A1A1A, 2-line max)
  - Price (16px, bold, #1A1A1A)
  - SP badge if applicable (green chip, "SP" text, #5DBB8E bg)

---

### TC-FLOW06-004: ItemCard - Favorite Toggle

**Steps:**
1. On Discover screen, tap Heart icon on any item card
2. Observe icon change
3. Tap Heart again

**Expected Results:**
- ✅ First tap: Heart → HeartStraight (filled, #5DBB8E green)
- ✅ Second tap: HeartStraight → Heart (outline, #1A1A1A black)
- ✅ Icon size: 18px
- ✅ Button: 32×32px circle, white bg rgba(255,255,255,0.95), shadow

---

### TC-FLOW06-005: ItemCard - Share Button

**Steps:**
1. Tap Share icon (right of Heart) on any item card

**Expected Results:**
- ✅ Native share sheet opens (iOS/Android)
- ✅ Share icon: 18px, #1A1A1A
- ✅ Button: 32×32px circle, white bg, shadow

---

### TC-FLOW06-006: CategoryBrowseScreen - Header with Icon

**Steps:**
1. On Discover, tap a category chip (e.g., "Clothing")
2. Observe header

**Expected Results:**
- ✅ CaretLeft back button (left, 24px, #1A1A1A)
- ✅ Category icon (32px, #5DBB8E):
  - Clothing → TShirt
  - Shoes → Sneaker
  - Books → BookOpen
  - Toys → GameController
  - Default → Backpack
- ✅ Category name (20px, semibold, #1A1A1A, marginLeft 12)
- ✅ Header background: #FFFFFF, borderBottom #F0F0F0

---

### TC-FLOW06-007: CategoryBrowseScreen - 2-Column Grid

**Steps:**
1. On category browse, scroll results

**Expected Results:**
- ✅ Same 2-column layout as Discover screen
- ✅ Uses ItemCard component (same styling)
- ✅ Gap: 12px between columns, 12px marginBottom per row
- ✅ Padding: 16px

---

### TC-FLOW06-008: ItemDetailScreen - Image Overlay Icons

**Steps:**
1. Tap any item card to open detail screen
2. Observe top-right of main image

**Expected Results:**
- ✅ Heart icon (24px, #1A1A1A) in 40×40px white circle
- ✅ Share icon (24px, #1A1A1A) in 40×40px white circle
- ✅ Both have shadow (shadowOpacity 0.1, shadowRadius 4)
- ✅ Gap between icons: 8px
- ✅ Position: absolute, top 12, right 12
- ✅ Tap Heart → changes to HeartStraight (filled, #5DBB8E green)

---

### TC-FLOW06-009: ItemDetailScreen - SP Earn Badge

**Steps:**
1. On item detail, check for SP earn badge (only for subscribers on SP-eligible items)

**Expected Results:**
- ✅ Badge appears below price if:
  - User is Kids Club+ subscriber
  - Item accepts Swap Points
- ✅ Coins icon (16px, #F59E0B gold, left side)
- ✅ Text: "Earn 250 SP" (12px, semibold, #F59E0B)
- ✅ Background: #FEF3C7 (light yellow chip)
- ✅ Border radius: 8px
- ✅ Padding: 6px vertical, 10px horizontal

---

### TC-FLOW06-010: ItemDetailScreen - ShieldCheck Verified Badge

**Steps:**
1. On item detail, scroll to seller card
2. Check for verified badge (only if seller is verified)

**Expected Results:**
- ✅ Badge appears next to "Seller Info" title if seller verified
- ✅ ShieldCheck icon (16px, #5DBB8E green, fill weight)
- ✅ Text: "Verified Seller" (12px, semibold, #5DBB8E)
- ✅ Background: #E8F5F0 (light green chip)
- ✅ Border radius: 8px
- ✅ Padding: 6px vertical, 10px horizontal
- ✅ Gap between icon and text: 6px

---

### TC-FLOW06-011: ItemDetailScreen - Sticky Bottom Actions

**Steps:**
1. On item detail, scroll to bottom

**Expected Results:**
- ✅ Two buttons stacked vertically, sticky at bottom
- ✅ **Add to Cart Button** (top):
  - Height: 48px
  - Border radius: 24px (pill shape)
  - Border: 2px solid #5DBB8E
  - Background: #FFFFFF (white)
  - ShoppingCart icon (20px, #5DBB8E, left)
  - Text: "Add to Cart" (16px, semibold, #5DBB8E)
  - Gap between icon and text: 8px
- ✅ **Buy Now Button** (bottom):
  - Height: 52px
  - Border radius: 26px (pill shape)
  - Background: #5DBB8E (green)
  - Text: "Buy Now" (18px, bold, #FFFFFF white)
- ✅ Gap between buttons: 10px
- ✅ Container padding: 16px horizontal, 12px vertical
- ✅ Border top: 1px solid #F0F0F0

---

### TC-FLOW06-012: SearchFilterModal - Drag Handle

**Steps:**
1. On Discover, tap filter button
2. Observe top of modal

**Expected Results:**
- ✅ Drag handle at very top
- ✅ Dimensions: 40px wide × 4px tall
- ✅ Border radius: 2px (rounded ends)
- ✅ Color: #E0E0E0 (light gray)
- ✅ Centered horizontally
- ✅ Margin: 12px top, 8px bottom

---

### TC-FLOW06-013: SearchFilterModal - Header

**Steps:**
1. Filter modal open, observe header

**Expected Results:**
- ✅ FunnelSimple icon (20px, #1A1A1A, left)
- ✅ "Filters" text (20px, semibold, #1A1A1A, marginLeft 8)
- ✅ "Clear All" button (right-aligned, 16px, #5DBB8E green)
- ✅ Border bottom: 1px solid #F0F0F0
- ✅ Padding: 16px horizontal, 12px vertical

---

### TC-FLOW06-014: SearchFilterModal - Chip Styling

**Steps:**
1. Filter modal open, tap a category chip
2. Observe styling change

**Expected Results:**
- ✅ **Unselected chips:**
  - Background: #F0F0F0
  - Text: #6B6B6B, fontWeight 400
  - Border radius: 20px
  - Padding: 10px vertical, 14px horizontal
- ✅ **Selected chips:**
  - Background: #5DBB8E (green)
  - Text: #FFFFFF (white), fontWeight 500
  - Same border radius and padding

---

### TC-FLOW06-015: SearchFilterModal - Price Inputs

**Steps:**
1. Scroll to price range section
2. Tap min/max price inputs

**Expected Results:**
- ✅ Two inputs side-by-side with "–" separator
- ✅ Each input:
  - Background: #F0F0F0 (filled style, NO border)
  - Border radius: 12px
  - Padding: 14px vertical, 16px horizontal
  - Text: 16px, #1A1A1A
  - Placeholder: #999999

---

### TC-FLOW06-016: SearchFilterModal - Apply Button

**Steps:**
1. Scroll to bottom of filter modal

**Expected Results:**
- ✅ Sticky at bottom inside modal
- ✅ Green pill button:
  - Background: #5DBB8E
  - Border radius: 26px
  - Height: 52px
  - Text: "Apply Filters" (18px, bold, #FFFFFF)
- ✅ Container padding: 16px horizontal, 12px vertical (32px bottom on iOS)
- ✅ Border top: 1px solid #F0F0F0

---

### TC-FLOW06-017: Integration - Search + Filter

**Steps:**
1. On Discover, type "backpack" in search
2. Tap filter button
3. Select category "Toys"
4. Tap Apply

**Expected Results:**
- ✅ Search query retained ("backpack" still in input)
- ✅ Filter badge shows "1" (one active filter)
- ✅ Results filtered by category AND search query
- ✅ Tap filter button again → "Toys" chip still selected

---

### TC-FLOW06-018: Performance - Scroll Smoothness

**Steps:**
1. On Discover with 20+ items, rapidly scroll up/down

**Expected Results:**
- ✅ 60fps scroll (no jank)
- ✅ Images lazy load smoothly
- ✅ No layout shifts during scroll

---

## Regression Checks

### RG-FLOW06-001: Bottom Navigation Still Works
- ✅ Tap Home → navigates to Home
- ✅ Tap Messages → navigates to Messages
- ✅ Tap Profile → navigates to Profile

### RG-FLOW06-002: Existing Search Logic Unchanged
- ✅ Search debounce: 150-250ms (not 500ms+)
- ✅ No infinite loops or repeated re-renders
- ✅ Search results update correctly

### RG-FLOW06-003: ListingImage Component Unaffected
- ✅ Images load correctly
- ✅ Placeholder shows for missing images
- ✅ Aspect ratio maintained

---

## Known Issues / Limitations

1. **ItemCard favorite state:** Currently local only (not persisted to DB)
2. **Share sheet:** Platform-dependent behavior (iOS vs Android)
3. **Add to Cart:** Shows alert, but cart not implemented yet

---

## Success Criteria

- ✅ All 18 test cases pass on iOS simulator
- ✅ All 18 test cases pass on Android emulator
- ✅ No TypeScript errors
- ✅ No ESLint errors in redesigned files
- ✅ Tier 0 checks pass (lint + typecheck)

---

## Testing Commands

```bash
# Run unit tests
npm test -- --testPathPattern=ItemCard

# Run Maestro UI flow (iOS)
npm run test:maestro:ios -- .maestro/module-15.1-flow-06-discovery.yaml

# Run Maestro UI flow (Android)
npm run test:maestro:android -- .maestro/module-15.1-flow-06-discovery.yaml

# Lint check
npm run lint

# Typecheck
npm run typecheck
```

---

## Sign-off

**Tested by:** _______________  
**Date:** _______________  
**iOS Simulator:** ✅ / ❌  
**Android Emulator:** ✅ / ❌  
**Notes:** _______________
