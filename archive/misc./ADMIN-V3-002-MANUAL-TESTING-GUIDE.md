// ADMIN-V3-002: Shared Types & Error Classes - Manual Testing Guide
# TASK ADMIN-V3-002 Manual Testing Guide

**Module:** MODULE-12-ADMIN-V3-CATEGORIES  
**Task:** Shared Types & Error Classes  
**Status:** Implementation Complete  
**Last Updated:** April 29, 2026

---

## Quick Summary

This task creates TypeScript type definitions and error classes. Since these are **pure types** (no runtime code other than error classes), testing is primarily done through:
1. **Type compilation** (TypeScript type checker)
2. **Unit tests** (error class behavior)
3. **Import verification** (ensure mobile doesn't import from admin)

---

## Prerequisites

- Node.js and npm installed
- Both `p2p-kids-admin` and `p2p-kids-marketplace` packages set up

---

## Test Cases

### TC-ADMIN-V3-002-01: Admin Portal Types Compilation

**Objective:** Verify admin portal type definitions compile without errors

**Steps:**
1. Navigate to admin portal:
   ```bash
   cd p2p-kids-admin
   ```

2. Run TypeScript type check:
   ```bash
   npm run type-check
   ```
   
   Or manually:
   ```bash
   npx tsc --noEmit
   ```

**Expected Results:**
- ✅ No TypeScript errors
- ✅ All type definitions in `src/types/category.ts` compile successfully
- ✅ All type definitions in `src/types/errors.ts` compile successfully

**Pass Criteria:**
- Exit code 0
- No errors related to `src/types/category.ts` or `src/types/errors.ts`

---

### TC-ADMIN-V3-002-02: Mobile Types Compilation

**Objective:** Verify mobile type definitions compile without errors and don't import from admin-portal

**Steps:**
1. Navigate to mobile app:
   ```bash
   cd p2p-kids-marketplace
   ```

2. Run TypeScript type check:
   ```bash
   npm run type-check
   ```
   
   Or manually:
   ```bash
   npx tsc --noEmit
   ```

**Expected Results:**
- ✅ No TypeScript errors
- ✅ Type definitions in `src/types/category.ts` compile successfully
- ✅ No import errors from `p2p-kids-admin` package

**Pass Criteria:**
- Exit code 0
- No errors related to `src/types/category.ts`
- Grep check shows no admin imports:
  ```bash
  grep -r "from.*p2p-kids-admin" src/types/category.ts
  # Should return nothing
  ```

---

### TC-ADMIN-V3-002-03: Admin Portal Unit Tests - Types

**Objective:** Verify type definitions pass unit tests

**Steps:**
1. Navigate to admin portal:
   ```bash
   cd p2p-kids-admin
   ```

2. Run unit tests for category types:
   ```bash
   npm test -- src/types/__tests__/category.test.ts
   ```

**Expected Results:**
- ✅ All tests pass
- ✅ `Category` interface tests pass
- ✅ `CreateCategoryInput` interface tests pass
- ✅ `UpdateCategoryInput` interface tests pass
- ✅ `SuggestionStatus` type tests pass
- ✅ `CategorySuggestion` interface tests pass
- ✅ `BonusCategory` interface tests pass
- ✅ `CategorySPAnalytics` interface tests pass
- ✅ `ValidationResult` interface tests pass
- ✅ `CategorySPPreview` interface tests pass

**Pass Criteria:**
- All test suites pass (green checkmarks)
- No test failures or errors

---

### TC-ADMIN-V3-002-04: Admin Portal Unit Tests - Error Classes

**Objective:** Verify error classes behave correctly

**Steps:**
1. Navigate to admin portal:
   ```bash
   cd p2p-kids-admin
   ```

2. Run unit tests for error classes:
   ```bash
   npm test -- src/types/__tests__/errors.test.ts
   ```

**Expected Results:**
- ✅ All tests pass
- ✅ `DuplicateNameError` has stable code `DUPLICATE_NAME`
- ✅ `CategoryNotEmptyError` has stable code `CATEGORY_NOT_EMPTY`
- ✅ `SPRateOutOfRangeError` has stable code `SP_RATE_OUT_OF_RANGE`
- ✅ `IconUploadError` has stable code `ICON_UPLOAD_ERROR`
- ✅ `UnauthorizedError` has stable code `UNAUTHORIZED`
- ✅ All error classes extend `Error`
- ✅ `isCategoryError` type guard works correctly
- ✅ `getErrorCode` utility works correctly
- ✅ Error codes are stable for switch statements

**Pass Criteria:**
- All test suites pass
- All error code constants are uppercase snake_case
- All error codes are unique

---

### TC-ADMIN-V3-002-05: Mobile Unit Tests - Types

**Objective:** Verify mobile type definitions pass unit tests

**Steps:**
1. Navigate to mobile app:
   ```bash
   cd p2p-kids-marketplace
   ```

2. Run unit tests for category types:
   ```bash
   npm test -- src/types/__tests__/category.test.ts
   ```

**Expected Results:**
- ✅ All tests pass
- ✅ `Category` interface tests pass (mobile subset)
- ✅ `BonusCategory` interface tests pass
- ✅ `CategorySPPreview` interface tests pass
- ✅ `CreateCategorySuggestionInput` interface tests pass
- ✅ `CategorySuggestion` interface tests pass (mobile view)
- ✅ `GetCategoriesOptions` interface tests pass
- ✅ Type independence from admin-portal verified

**Pass Criteria:**
- All test suites pass
- No admin-only fields present in mobile types
- No cross-package imports detected

---

### TC-ADMIN-V3-002-06: Type Safety - Admin Fields Not in Mobile

**Objective:** Verify mobile types don't expose admin-only fields

**Steps:**
1. Open `p2p-kids-marketplace/src/types/category.ts`

2. Verify the following admin-only fields are NOT present in mobile `Category` interface:
   - `description`
   - `sp_config_notes`
   - `sp_rate_change_notify`
   - `updated_at`

3. Check mobile `CategorySuggestion` interface doesn't have:
   - `seller` joined data (sellers don't see other sellers)
   - `approved_by` field

**Expected Results:**
- ✅ Mobile `Category` has 11 fields (not 15)
- ✅ Admin-only fields are not present
- ✅ TypeScript would error if code tried to access admin fields on mobile types

**Pass Criteria:**
- Manual code inspection confirms field subset
- TypeScript compilation prevents access to non-existent fields

---

### TC-ADMIN-V3-002-07: Error Code Stability

**Objective:** Verify error codes are stable for client-side switch statements

**Steps:**
1. Create a test file `test-error-codes.ts`:
   ```typescript
   import { DuplicateNameError, getErrorCode } from '../src/types/errors';

   const error = new DuplicateNameError('Books', 'id-123');

   // Switch statement should work with const error codes
   switch (error.code) {
     case 'DUPLICATE_NAME':
       console.log('Handled duplicate name');
       break;
     case 'CATEGORY_NOT_EMPTY':
       console.log('Handled not empty');
       break;
     default:
       console.log('Unknown error');
   }

   // getErrorCode should work
   console.log(getErrorCode(error)); // 'DUPLICATE_NAME'
   console.log(getErrorCode(new Error())); // 'UNKNOWN'
   ```

2. Run type check:
   ```bash
   cd p2p-kids-admin
   npx tsc --noEmit test-error-codes.ts
   ```

**Expected Results:**
- ✅ No TypeScript errors
- ✅ `error.code` is treated as a const literal type
- ✅ Switch statements work without type assertions

**Pass Criteria:**
- TypeScript compiles without errors
- Error codes are inferred as const string literals

---

### TC-ADMIN-V3-002-08: SP Rate Bounds Validation

**Objective:** Verify SP rate type bounds match database constraints

**Steps:**
1. Open `p2p-kids-admin/src/types/category.ts`

2. Verify documentation comments state:
   - `sp_earning_multiplier`: 1.05–1.40
   - `sp_spending_cap_percent`: 50–80

3. Open `supabase/migrations/20260420000006_add_category_management_columns.sql`

4. Verify CHECK constraints match type comments:
   ```sql
   CHECK (sp_earning_multiplier BETWEEN 1.05 AND 1.40)
   CHECK (sp_spending_cap_percent BETWEEN 50 AND 80)
   ```

**Expected Results:**
- ✅ Type comments match database constraints
- ✅ `SPRateOutOfRangeError` uses same bounds in constructor
- ✅ Documentation is consistent across types, errors, and database

**Pass Criteria:**
- Manual verification confirms consistency
- All three sources (types, errors, DB) use identical bounds

---

### TC-ADMIN-V3-002-09: Strict TypeScript - No Any

**Objective:** Verify no `any` types are used

**Steps:**
1. Search for `any` type in admin type files:
   ```bash
   cd p2p-kids-admin
   grep -n ": any" src/types/category.ts src/types/errors.ts
   ```

2. Search for `any` type in mobile type file:
   ```bash
   cd p2p-kids-marketplace
   grep -n ": any" src/types/category.ts
   ```

**Expected Results:**
- ✅ No `: any` found in category.ts files
- ✅ No `: any` found in errors.ts
- ✅ All fields have explicit types

**Pass Criteria:**
- Both grep commands return no matches

---

## Summary Checklist

Before marking ADMIN-V3-002 complete, verify:

- [ ] **TC-ADMIN-V3-002-01**: Admin types compile ✅
- [ ] **TC-ADMIN-V3-002-02**: Mobile types compile ✅
- [ ] **TC-ADMIN-V3-002-03**: Admin type unit tests pass ✅
- [ ] **TC-ADMIN-V3-002-04**: Error class unit tests pass ✅
- [ ] **TC-ADMIN-V3-002-05**: Mobile type unit tests pass ✅
- [ ] **TC-ADMIN-V3-002-06**: Mobile doesn't expose admin fields ✅
- [ ] **TC-ADMIN-V3-002-07**: Error codes work in switch statements ✅
- [ ] **TC-ADMIN-V3-002-08**: SP rate bounds consistent with DB ✅
- [ ] **TC-ADMIN-V3-002-09**: No `any` types used ✅

---

## Quick Test Commands (Run All)

### Admin Portal
```bash
cd p2p-kids-admin
npm run type-check
npm test -- src/types/__tests__/category.test.ts
npm test -- src/types/__tests__/errors.test.ts
grep -n ": any" src/types/category.ts src/types/errors.ts
```

### Mobile App
```bash
cd p2p-kids-marketplace
npm run type-check
npm test -- src/types/__tests__/category.test.ts
grep -n ": any" src/types/category.ts
grep -r "from.*p2p-kids-admin" src/types/category.ts
```

---

## Notes for iOS/Android Simulators

**Not applicable** for this task — these are pure TypeScript type definitions with no UI components. Testing is done via:
- Type compilation
- Unit tests (Jest)
- Static analysis

No simulator testing required.

---

## Troubleshooting

### Issue: TypeScript errors in type files

**Solution:**
1. Ensure TypeScript version matches `package.json`
2. Run `npm install` to sync dependencies
3. Clear TypeScript cache: `rm -rf node_modules/.cache`

### Issue: Unit tests fail

**Solution:**
1. Check Jest configuration in `jest.config.js`
2. Ensure test file paths are correct
3. Run with verbose output: `npm test -- --verbose`

### Issue: Import errors from admin-portal in mobile

**Solution:**
1. Mobile types MUST be independent
2. Do NOT import from `../../../p2p-kids-admin`
3. Duplicate common types if needed (mobile subset)

---

## Next Steps

After ADMIN-V3-002 verification completes:
1. Proceed to **ADMIN-V3-003** (Backend Services)
2. Services will consume these types
3. No SQL migration required for this task (types only)

---

## Verification Mapping

Maps to MODULE-12-VERIFICATION-V3.md:

- ✅ **Section 2: TYPES & ERRORS (ADMIN-V3-002)**
  - [x] `admin-portal/src/types/category.ts` exports all required types
  - [x] `admin-portal/src/types/errors.ts` exports error classes with stable codes
  - [x] `p2p-kids-marketplace/src/types/category.ts` mirrors subset (no admin fields)
  - [x] Strict TypeScript — no `any`
  - [x] Mobile types do NOT import from `admin-portal/`
