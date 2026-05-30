# MODULE-15.1-FLOW-07: Cart & Bundling - Manual Testing Guide

**Module:** MODULE-15.1-UI-REDESIGN  
**Task:** FLOW-07 Cart & Bundling  
**Screens:** CartScreen, BundleBuilderScreen  
**Platform:** iOS Simulator + Android Emulator

---

## Prerequisites

1. **Build the app:**
   ```bash
   cd p2p-kids-marketplace
   npm run ios
   # OR
   npm run android
   ```

2. **Ensure you're logged in** to a test account

3. **Navigate to Cart tab** from bottom navigation

---

## Test Cases

### TC-001: Empty Cart State (P0)

**Preconditions:** Cart has no items

**Steps:**
1. Open the app
2. Navigate to Cart tab

**Expected Results:**
- ✅ Cart icon (Phosphor `ShoppingCart`, 24px) visible in header
- ✅ "My Cart" title visible
- ✅ Large empty cart icon (Phosphor `ShoppingCart`, 64px, `#E0E0E0` color) centered
- ✅ "Your cart is empty" heading displayed
- ✅ "Start adding items you love to your cart" subtext displayed
- ✅ "Browse Items" button visible (green pill, 52px height, `#5DBB8E`)
- ✅ NO item count badge visible when cart is empty

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

### TC-002: Browse Items Button Navigation (P0)

**Preconditions:** Empty cart state visible

**Steps:**
1. Tap "Browse Items" button

**Expected Results:**
- ✅ Navigates to Discover screen
- ✅ Can see item listings
- ✅ Bottom nav still accessible

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

### TC-003: Cart Header Design System Compliance (P1)

**Preconditions:** None

**Steps:**
1. Navigate to Cart tab
2. Inspect header elements

**Expected Results:**
- ✅ Header has "My Cart" title in correct typography (24px, semibold, `#1A1A1A`)
- ✅ Cart icon uses Phosphor (NOT Ionicons)
- ✅ No hardcoded orange colors (must be `#5DBB8E` green)
- ✅ Screen padding is 20-24px horizontal
- ✅ Header border bottom is subtle (`#F0F0F0`)

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

### TC-004: Empty State Icon Design (P1)

**Preconditions:** Cart is empty

**Steps:**
1. Navigate to Cart tab
2. Verify empty state icon

**Expected Results:**
- ✅ Icon is Phosphor `ShoppingCart` (NOT cart-outline from Ionicons)
- ✅ Icon size is 64px
- ✅ Icon color is `#E0E0E0` (neutral gray)
- ✅ Icon weight is "regular" (2px stroke)

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

### TC-005: Browse Button Styling (P1)

**Preconditions:** Cart is empty

**Steps:**
1. Navigate to Cart tab
2. Inspect "Browse Items" button

**Expected Results:**
- ✅ Button is pill-shaped (`borderRadius: 26`, height `52px`)
- ✅ Background color is `#5DBB8E` (Whisk green, NOT orange)
- ✅ Text color is white
- ✅ Full width on smaller screens
- ✅ Max width 300px on larger screens
- ✅ Button has proper touchable area (no delay, activeOpacity works)

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

### TC-006: Bundle Builder - Header & Close Button (P1)

**Preconditions:** Navigate to Bundle Builder screen (manual navigation via deep link or code)

**Steps:**
1. Open Bundle Builder screen
2. Verify header elements

**Expected Results:**
- ✅ "Build a Bundle" heading visible (24px semibold, `#1A1A1A`)
- ✅ Subtext "Add more items from [seller name] to save" visible (15px, `#6B6B6B`)
- ✅ Close button (X icon, 24px) visible in top-right
- ✅ Tapping X button shows confirmation if items selected
- ✅ Tapping X button closes immediately if no selection

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

### TC-007: Bundle Builder - Empty State (P1)

**Preconditions:** Seller has no available items for bundling

**Steps:**
1. Open Bundle Builder for a seller with no items
2. Verify empty state

**Expected Results:**
- ✅ Phosphor `Tag` icon (64px, `#E0E0E0`) centered
- ✅ "No More Items Available" heading
- ✅ Subtext explaining no other items available
- ✅ No summary bar at bottom

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

### TC-008: Bottom Navigation Accessibility (P0)

**Preconditions:** None

**Steps:**
1. Navigate to Cart tab
2. Verify bottom nav is still visible and functional

**Expected Results:**
- ✅ Bottom navigation visible
- ✅ Cart tab is highlighted/active
- ✅ Can navigate to other tabs (Discover, My Listings, Profile)
- ✅ Returning to Cart preserves state

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

### TC-009: iOS Simulator-Specific Checks (P2)

**Preconditions:** Testing on iOS Simulator

**Steps:**
1. Navigate to Cart tab
2. Check iOS-specific rendering

**Expected Results:**
- ✅ SafeAreaView respects notch/status bar
- ✅ Bottom nav respects home indicator area
- ✅ No visual glitches or overlapping elements
- ✅ Icons render crisp (not pixelated)

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

### TC-010: Android Emulator-Specific Checks (P2)

**Preconditions:** Testing on Android Emulator

**Steps:**
1. Navigate to Cart tab
2. Check Android-specific rendering

**Expected Results:**
- ✅ StatusBar renders correctly
- ✅ Bottom nav respects navigation bar
- ✅ No elevation/shadow rendering issues
- ✅ Icons render crisp (not pixelated)
- ✅ Ripple effect works on touchable elements

**Actual Result:** _______________

**Status:** [ ] PASS [ ] FAIL

---

## Design System Regression Checklist

After completing all test cases, verify:

- [ ] **Primary Color:** All CTAs use `#5DBB8E` (NOT orange `#FF6B35`)
- [ ] **Button Shape:** All primary buttons are pill-shaped (`borderRadius = height/2`)
- [ ] **Icons:** Only Phosphor icons used (NO Ionicons/MaterialIcons)
- [ ] **Icon Weight:** All icons use `weight="regular"` (2px stroke)
- [ ] **Typography:** Correct font sizes (24px heading, 15px body, 14px labels)
- [ ] **Spacing:** 20-24px screen padding, 16-20px section spacing
- [ ] **Background:** All screens white (`#FFFFFF`)
- [ ] **Text Colors:** `#1A1A1A` primary, `#6B6B6B` secondary, `#999999` tertiary

---

## Known Limitations (TODO Items)

1. **Cart State Persistence:** Cart items currently load as empty (state management not implemented)
2. **Bundle Builder Navigation:** Direct navigation from Item Detail not yet wired
3. **Item Addition:** "Add to Cart" functionality from Item Detail not yet implemented
4. **Checkout Flow:** Checkout button shows placeholder alert (FLOW-08 implementation pending)

---

## Test Summary

**Total Test Cases:** 10  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____  

**Tested By:** _______________  
**Date:** _______________  
**Platform:** [ ] iOS Simulator [ ] Android Emulator [ ] Both  

**Notes:**
_______________________________________________________________________________
_______________________________________________________________________________
_______________________________________________________________________________
