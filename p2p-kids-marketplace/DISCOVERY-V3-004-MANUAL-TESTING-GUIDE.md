# DISCOVERY-V3-004 Manual Testing Guide

**Module:** Search & Discovery V3 - Types & Utilities  
**Task:** DISCOVERY-V3-004  
**Test Date:** **\_\_**  
**Tester:** **\_\_**  
**Platform:** ☐ iOS Simulator ☐ Android Emulator

---

## Pre-Test Setup

### Prerequisites

- [ ] All DISCOVERY-V3-004 files are deployed
- [ ] Unit tests passed (`npm run test:unit -- --testPathPattern="filterHelpers|fuzzyMatch"`)
- [ ] TypeScript compilation successful (`npm run typecheck`)
- [ ] App builds and launches successfully

### Test Data

- None required (utility functions only)

---

## Test Cases

### TC-001: Verify Types Are Exported

**Objective:** Confirm all new types and constants are properly exported and accessible

**Steps:**

1. In Expo app, navigate to any screen
2. Open React Native Debugger or use console logs
3. Import and log the types/constants:

   ```typescript
   import {
     BrandSuggestion,
     PricePreset,
     COLOR_PALETTE,
     PRICE_PRESETS,
     STORAGE_KEYS,
   } from '../types/discovery';

   console.log('COLOR_PALETTE:', COLOR_PALETTE);
   console.log('PRICE_PRESETS:', PRICE_PRESETS);
   console.log('STORAGE_KEYS:', STORAGE_KEYS);
   ```

**Expected Result:**

- [ ] No import errors
- [ ] COLOR_PALETTE logs array of 12 color objects with id, label, hex
- [ ] PRICE_PRESETS logs array of 5 price range objects
- [ ] STORAGE_KEYS logs object with 3 keys

**Actual Result:** ******\_\_\_******

---

### TC-002: countActiveFilters - Default State

**Objective:** Verify countActiveFilters returns 0 for default filters

**Steps:**

1. In app code, import `getDefaultFilters` and `countActiveFilters`
2. Call `countActiveFilters(getDefaultFilters())`
3. Log the result

**Expected Result:**

- [ ] Returns `0`

**Actual Result:** ******\_\_\_******

---

### TC-003: countActiveFilters - Single Filter

**Objective:** Verify countActiveFilters counts individual filters correctly

**Test Data:**
| Filter | Value | Expected Count |
|--------|-------|----------------|
| query | "bicycle" | 1 |
| categoryIds | ["cat1"] | 1 |
| condition | "like_new" | 1 |
| minPrice | 10 | 1 |
| ageGroup | "3-5" | 1 |
| gender | "boy" | 1 |
| brand | "Nike" | 1 |
| colors | ["red"] | 1 |
| spEligibleOnly | true | 1 |

**Steps:**

1. For each filter in the table, create a filters object with only that filter set
2. Call `countActiveFilters(filters)`
3. Verify count matches expected

**Expected Result:**

- [ ] All counts return 1

**Actual Result:** ******\_\_\_******

---

### TC-004: countActiveFilters - Multiple Filters

**Objective:** Verify countActiveFilters correctly counts combined filters

**Steps:**

1. Create filters object:
   ```typescript
   const filters = {
     ...getDefaultFilters(),
     query: 'bicycle',
     categoryIds: ['cat1', 'cat2'],
     condition: 'good',
     minPrice: 10,
     maxPrice: 50,
     ageGroup: '6-8',
     gender: 'boy',
     brand: 'Schwinn',
     colors: ['red', 'blue'],
     spEligibleOnly: true,
   };
   ```
2. Call `countActiveFilters(filters)`

**Expected Result:**

- [ ] Returns `9` (all 9 filter dimensions)

**Actual Result:** ******\_\_\_******

---

### TC-005: formatFilterChipLabel - Common Cases

**Objective:** Verify formatFilterChipLabel produces correct readable labels

**Test Data:**
| Key | Value | Expected Label |
|-----|-------|----------------|
| ageGroup | "3-5" | "Age: 3-5" |
| condition | "like_new" | "Condition: Like New" |
| minPrice | 10 | "Min: $10" |
| maxPrice | 50 | "Max: $50" |
| gender | "boy" | "Gender: Boy" |
| brand | "Nike" | "Brand: Nike" |
| colors (single) | ["red"] | "Red" |
| colors (multiple) | ["red", "blue"] | "2 Colors" |
| spEligibleOnly | true | "SP Only" |

**Steps:**

1. For each row, call `formatFilterChipLabel(key, value)`
2. Verify output matches expected label

**Expected Result:**

- [ ] All labels match expected format

**Actual Result:** ******\_\_\_******

---

### TC-006: validatePriceRange - Valid Ranges

**Objective:** Verify validatePriceRange returns true for valid ranges

**Test Data:**
| Min | Max | Expected |
|-----|-----|----------|
| 10 | 20 | true |
| 10 | 10 | true |
| 0 | 100 | true |
| undefined | 20 | true |
| 10 | undefined | true |
| undefined | undefined | true |

**Steps:**

1. For each row, call `validatePriceRange(min, max)`
2. Verify result matches expected

**Expected Result:**

- [ ] All return true

**Actual Result:** ******\_\_\_******

---

### TC-007: validatePriceRange - Invalid Ranges

**Objective:** Verify validatePriceRange returns false when min > max

**Test Data:**
| Min | Max | Expected |
|-----|-----|----------|
| 20 | 10 | false |
| 50 | 25 | false |
| 100 | 99 | false |

**Steps:**

1. For each row, call `validatePriceRange(min, max)`
2. Verify result matches expected

**Expected Result:**

- [ ] All return false

**Actual Result:** ******\_\_\_******

---

### TC-008: getDefaultFilters - Structure

**Objective:** Verify getDefaultFilters returns correct default structure

**Steps:**

1. Call `getDefaultFilters()`
2. Verify structure:
   - sortBy = 'relevance'
   - spEligibleOnly = false
   - All other fields undefined

**Expected Result:**

- [ ] sortBy is 'relevance'
- [ ] spEligibleOnly is false
- [ ] query, categoryIds, condition, minPrice, maxPrice, ageGroup, gender, brand, colors, limit, offset all undefined

**Actual Result:** ******\_\_\_******

---

### TC-009: COLOR_PALETTE - Verify Structure

**Objective:** Verify COLOR_PALETTE has correct structure and data

**Steps:**

1. Import and inspect `COLOR_PALETTE`
2. Verify:
   - Length is 12
   - Each item has id, label, hex
   - Contains: red, blue, green, yellow, pink, purple, black, white, gray, brown, orange, multicolor

**Expected Result:**

- [ ] 12 colors total
- [ ] All have id, label, hex properties
- [ ] All expected color ids present

**Actual Result:** ******\_\_\_******

---

### TC-010: PRICE_PRESETS - Verify Structure

**Objective:** Verify PRICE_PRESETS has correct structure and data

**Steps:**

1. Import and inspect `PRICE_PRESETS`
2. Verify:
   - Length is 5
   - Each item has id, label, min, max
   - Ranges: Under $10, $10-$25, $25-$50, $50-$100, Over $100

**Expected Result:**

- [ ] 5 presets total
- [ ] All have id, label, min, max properties
- [ ] All expected ranges present

**Actual Result:** ******\_\_\_******

---

### TC-011: STORAGE_KEYS - Verify Keys

**Objective:** Verify STORAGE_KEYS has correct key names

**Steps:**

1. Import and inspect `STORAGE_KEYS`
2. Verify keys:
   - RECENT_SEARCHES = '@kids_marketplace:recent_searches'
   - ACTIVE_FILTERS = '@kids_marketplace:active_filters'
   - BRAND_CACHE = '@kids_marketplace:brand_cache'

**Expected Result:**

- [ ] All 3 keys present with correct values

**Actual Result:** ******\_\_\_******

---

### TC-012: Fuzzy Match Integration

**Objective:** Verify fuzzyMatch utilities work with discovery types

**Steps:**

1. Import `levenshteinDistance` and `findClosestMatch` from fuzzyMatch
2. Test with COLOR_PALETTE:
   ```typescript
   const colorNames = COLOR_PALETTE.map((c) => c.label);
   const closest = findClosestMatch('bule', colorNames, 3);
   ```
3. Verify closest match

**Expected Result:**

- [ ] Returns 'Blue' (typo correction)

**Actual Result:** ******\_\_\_******

---

## Test Summary

**Total Test Cases:** 12  
**Passed:** **\_\_**  
**Failed:** **\_\_**  
**Blocked:** **\_\_**

### Issues Found

| ID  | Description | Severity | Status |
| --- | ----------- | -------- | ------ |
|     |             |          |        |

### Notes

---

---

## Sign-off

**Tester Signature:** ****\_\_\_\_****  
**Date:** ****\_\_\_\_****  
**Status:** ☐ PASS ☐ FAIL ☐ BLOCKED

---

**End of Manual Testing Guide for DISCOVERY-V3-004**
