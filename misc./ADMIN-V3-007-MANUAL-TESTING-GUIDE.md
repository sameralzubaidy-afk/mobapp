# ADMIN-V3-007 Manual Testing Guide
**Task**: Mobile Integration — Bonus Badges, Item Counts, Other Flow Wiring  
**Module**: MODULE-12-ADMIN-V3-CATEGORIES  
**Test Environment**: iOS and Android Simulators  

---

## Prerequisites

✅ **Database Setup Required**:  
Run the following SQL in Supabase SQL Editor before testing:

```sql
-- 1. Ensure at least one category has sp_earning_multiplier > 1.10
UPDATE categories 
SET sp_earning_multiplier = 1.25, 
    sp_spending_cap_percent = 70,
    bonus_badge_icon_url = 'https://example.com/bonus.png' -- Optional: add custom icon
WHERE name = 'Electronics';

-- 2. Ensure at least one category has item_count = 0 (to verify visibility without count filtering)
UPDATE categories 
SET item_count = 0, 
    is_active = true
WHERE name = 'Empty Category';

-- 3. Verify item_count trigger is working
SELECT id, name, item_count, sp_earning_multiplier, sp_spending_cap_percent 
FROM categories 
ORDER BY display_order;
```

✅ **App Configuration**:
- Logged in as a Kids Club+ subscriber (for SP features)
- At least 50 SP in wallet (for checkout testing)
- Supabase staging environment configured

---

## Test Case 1: Category SelectModal Shows Item Counts & Bonus Badges

**Goal**: Verify category modal shows category names (without counts) and bonus badges  

**Steps**:
1. Open the app in iOS or Android simulator
2. Navigate to Create Listing screen
3. Tap "+ Add Photos" and select at least one photo
4. Scroll down to "Category" section
5. Tap on the category input field to open CategorySelectModal

**Expected Results**:
- ✅ Each category displays only category name (e.g., "Toys")
- ✅ Categories with `sp_earning_multiplier > 1.10` show ⭐ or custom bonus badge icon next to the name
- ✅ Categories with `item_count = 0` are visible in the list when active
- ✅ Custom category icons (`icon_url`) render correctly
- ✅ Bonus badge fallback emoji (⭐) renders when `bonus_badge_icon_url` is null

**Test ID**: TC-ADMIN-V3-007-001  
**Platform**: iOS ✓ | Android ✓

---

## Test Case 2: Price Suggestion Card Shows SP Earning/Spending

**Goal**: Verify SP preview appears when price is set  

**Steps**:
1. Continue from TC-001 (category selected)
2. Scroll down to "Price" section
3. Select a suggested price tier OR enter manual price (e.g., $50)
4. Observe the blue SP preview box

**Expected Results**:
- ✅ SP preview box appears with light blue background
- ✅ Shows "You'll earn: X SP" (where X = Math.round(price * sp_earning_multiplier))
- ✅ Shows "Buyer can use up to: Y SP" (where Y = Math.floor(price * sp_spending_cap_percent / 100))
- ✅ SP values match server calculation exactly (no re-implementation)
- ✅ Preview updates when price changes
- ✅ Loading indicator appears briefly during calculation

**Test ID**: TC-ADMIN-V3-007-002  
**Platform**: iOS ✓ | Android ✓

---

## Test Case 3: "Other" Category Dual-Writes to Admin Queue

**Goal**: Verify publishing "Other" item writes to both review_flag AND category_suggestions  

**Steps**:
1. Continue from TC-002 (price set)
2. In category modal, tap "+ Other (Custom Category)"
3. Enter custom category name: "Test Custom Category"
4. Tap "Submit"
5. Complete the listing form (title, description, condition)
6. Tap "Publish" button
7. Wait for success message

**Expected Results**:
- ✅ Listing publishes successfully (does NOT fail due to suggestion write)
- ✅ Success message appears
- ✅ No error toasts or alerts during publish

**Verification (Admin Portal)**:
8. Open admin portal in browser
9. Navigate to Settings → Categories
10. Click "Suggestions" tab

**Expected Admin Results**:
- ✅ New suggestion row appears with:
  - `suggested_name`: "Test Custom Category"
  - `status`: "pending"
  - `item_id`: (the created item ID)
  - `reviewed_at`: null

**Test ID**: TC-ADMIN-V3-007-003  
**Platform**: iOS ✓ | Android ✓

---

## Test Case 4: Checkout Enforces Category-Specific SP Cap

**Goal**: Verify SP input is hard-capped at category's `max_spend_sp`  

**Prerequisites**:
- Category "Electronics" has `sp_spending_cap_percent = 70`
- User has 100+ SP in wallet
- Item price is $50 (so max_spend_sp = Math.floor(50 * 0.70) = 35 SP)

**Steps**:
1. Navigate to Browse/Home screen
2. Find and tap an item in "Electronics" category with price $50
3. Tap "Buy Now"
4. On checkout screen, observe SP input section
5. Tap on SP input field
6. Enter "50" (intentionally above the 35 SP cap)
7. Observe behavior

**Expected Results**:
- ✅ SP input auto-caps to 35 SP (or shows inline error)
- ✅ Alert appears: "SP Limit Exceeded. For this category, you can use up to 35 SP (70% of item price)."
- ✅ Cannot proceed with SP amount > 35
- ✅ Slider max position is 35 SP (if slider exists)
- ✅ Input validation prevents values > max_spend_sp

**Edge Case Test**:
8. Enter "35" SP (exactly at cap)
9. Verify purchase proceeds normally with no error

**Test ID**: TC-ADMIN-V3-007-004  
**Platform**: iOS ✓ | Android ✓

---

## Test Case 5: CategoryFilterChip Hides Zero-Count Categories

**Goal**: Verify discovery screens show all active categories  

**Steps**:
1. Navigate to Browse/Discovery screen (if exists)
2. Observe category filter chips at top
3. Check visible category list

**Expected Results**:
- ✅ Categories with `item_count = 0` are rendered when active
- ✅ Active categories appear regardless of item_count
- ✅ Bonus badges render on filter chips when `sp_earning_multiplier > 1.10`
- ✅ Custom category icons render correctly

**Test ID**: TC-ADMIN-V3-007-005  
**Platform**: iOS ✓ | Android ✓

---

## Test Case 6: BonusBadge Component Rendering

**Goal**: Verify BonusBadge component renders correctly in all states  

**Test Matrix**:

| State | iconUrl | Expected Render |
|---|---|---|
| Custom icon | Valid URL | Image component with source={{ uri }} |
| Fallback emoji | null or empty | Text component with ⭐ |
| Small size | Any | width: 16, height: 16 |
| Medium size | Any | width: 24, height: 24 |
| Large size | Any | width: 32, height: 32 |

**Steps**:
1. Open CategorySelectModal (TC-001)
2. Inspect bonus badges on categories
3. Verify size and rendering

**Expected Results**:
- ✅ Custom icons load and display correctly
- ✅ Fallback emoji displays when icon_url is null
- ✅ Badge size matches "small" (16px) in category modal context

**Test ID**: TC-ADMIN-V3-007-006  
**Platform**: iOS ✓ | Android ✓

---

## Regression Tests

### R1: Existing Listing Flow Still Works
- ✅ Can create listing without selecting bonus category
- ✅ Can create listing with standard category (no bonus badge)
- ✅ Publish succeeds even if category suggestion write fails

### R2: Non-Subscriber Experience
- ✅ Non-subscribers see category modal (but no SP preview)
- ✅ Non-subscribers cannot access SP slider in checkout

### R3: "Other" Category Review Flag (Legacy)
- ✅ `flagForCategoryReview` still executes (backward compatibility)
- ✅ Both `review_flag` and `category_suggestions` rows created

---

## Commands to Run

### Unit Tests
```bash
cd p2p-kids-marketplace
npm run test:unit -- --testPathPattern=categoryService-admin-v3-007
npm run test:unit -- --testPathPattern=BonusBadge
```

### Integration Tests
```bash
RUN_SUPABASE_E2E=true npm run test:e2e -- admin-v3-007-category-sp-integration
```

### Maestro UI Tests
```bash
# iOS
npm run test:maestro:ios -- .maestro/category-bonus-badges.yaml
npm run test:maestro:ios -- .maestro/checkout-sp-cap.yaml

# Android
npm run test:maestro:android -- .maestro/category-bonus-badges.yaml
npm run test:maestro:android -- .maestro/checkout-sp-cap.yaml
```

---

## Known Limitations

1. **Discovery CategoryFilterChip** - Discovery screen may not exist yet; chip component is created for future use
2. **Custom Icons** - If staging DB has no custom icons uploaded, fallback emojis will always render
3. **SP Cap Alert** - Current implementation shows Alert; may be replaced with inline error in future UX iteration

---

## Rollback Plan

If critical bugs found:
1. Revert commits related to ADMIN-V3-007
2. Category modal still shows categories (without counts/badges)
3. PriceSuggestionCard works without SP preview
4. Checkout uses global SP cap instead of category-specific

---

**Test Completed By**: ___________________  
**Date**: ___________________  
**iOS Version Tested**: ___________________  
**Android Version Tested**: ___________________  
**All Tests Passed**: ☐ Yes  ☐ No (see notes below)

**Notes**:
