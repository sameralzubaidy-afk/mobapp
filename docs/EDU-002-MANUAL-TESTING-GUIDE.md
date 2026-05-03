# EDU-002 Manual Testing Guide

**Task:** TASK EDU-002 - Shared Types & Error Classes  
**Module:** MODULE-18 TRADING EDUCATION V1  
**Date:** May 3, 2026  
**Tester:** Samer Al-Zubaidi  
**Environment:** iOS & Android Simulators  

---

## Prerequisites

- ✅ EDU-001 (schema migrations) must be deployed to production Supabase
- ✅ Both apps (`p2p-kids-marketplace` and `p2p-kids-admin`) must compile without errors
- ✅ Unit tests must pass (27 mobile + 34 admin = 61 total tests)

---

## Test Case 1: Mobile Type Imports

**Objective:** Verify education types are importable in mobile app services/components

**Steps:**
1. Open `p2p-kids-marketplace/src/services/` in your editor
2. Create a temporary test file: `p2p-kids-marketplace/src/services/__test-imports.ts`
3. Add the following code:
```typescript
import {
  SectionType,
  EducationSection,
  EducationExample,
  SPCalculation,
  SellSPCalculation,
  BuySPCalculation,
  EducationAnalyticsEventType,
  EducationAnalyticsEvent,
  BonusCategory,
} from '../types/education';

import {
  ContentValidationError,
  AnalyticsWriteError,
} from '../types/education-errors';

// TypeScript should not show any errors
const testTypes: SectionType = 'sp_definition';
const testError = new ContentValidationError('Test');
```
4. Run: `cd p2p-kids-marketplace && npm run typecheck`

**Expected Results:**
- ✅ No TypeScript errors
- ✅ All imports resolve correctly
- ✅ `testTypes` autocomplete shows 6 valid options
- ✅ `testError` has `.code` and `.field` properties

**Cleanup:**
- Delete `__test-imports.ts` after verification

---

## Test Case 2: Admin Type Imports

**Objective:** Verify admin education types include admin-only fields

**Steps:**
1. Open `p2p-kids-admin/src/services/` in your editor
2. Create a temporary test file: `p2p-kids-admin/src/services/__test-imports.ts`
3. Add the following code:
```typescript
import {
  EducationSection,
  CreateSectionInput,
  UpdateSectionInput,
  EducationExample,
  CreateExampleInput,
  UpdateExampleInput,
} from '../types/education';

import {
  ContentValidationError,
  UnauthorizedError,
  DuplicatePublishedSectionError,
} from '../types/education-errors';

// Admin types should have extra fields
const testSection: EducationSection = {
  id: '123',
  title: 'Test',
  body: 'Test body',
  image_url: null,
  display_order: 1,
  section_type: 'general',
  is_published: false,
  published_at: null,
  published_by: null, // Admin-only field
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(), // Admin-only field
};

const testError = new UnauthorizedError('Test', 'admin');
```
4. Run: `cd p2p-kids-admin && npm run typecheck`

**Expected Results:**
- ✅ No TypeScript errors
- ✅ `EducationSection` has `published_by` and `updated_at` fields
- ✅ `UnauthorizedError` has `.requiredRole` property
- ✅ All 3 error classes are importable

**Cleanup:**
- Delete `__test-imports.ts` after verification

---

## Test Case 3: BonusCategory Re-export (Mobile)

**Objective:** Verify BonusCategory is accessible from education.ts

**Steps:**
1. Check that `BonusCategory` can be imported from both locations:
```typescript
// From category.ts (original)
import { BonusCategory } from '../types/category';

// From education.ts (re-export)
import { BonusCategory } from '../types/education';
```
2. Run typecheck

**Expected Results:**
- ✅ Both imports work
- ✅ No duplicate type errors
- ✅ Type structure is identical (8 fields)

---

## Test Case 4: SectionType Enum Validation

**Objective:** Verify SectionType matches DB CHECK constraint exactly

**Steps:**
1. In Supabase SQL Editor, run:
```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname LIKE '%education_sections%section_type%';
```
2. Compare with TypeScript definition in `p2p-kids-marketplace/src/types/education.ts`

**Expected Results:**
- ✅ Both have exactly 6 values: `general`, `sp_definition`, `sp_earning`, `sp_spending`, `safety`, `example`
- ✅ No extra or missing values

---

## Test Case 5: EducationAnalyticsEventType Enum Validation

**Objective:** Verify event types match DB CHECK constraint exactly

**Steps:**
1. In Supabase SQL Editor, run:
```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname LIKE '%education_analytics%event_type%';
```
2. Compare with TypeScript definition in `p2p-kids-marketplace/src/types/education.ts`

**Expected Results:**
- ✅ Both have exactly 8 values: `onboarding_start`, `onboarding_complete`, `onboarding_skip`, `help_view`, `section_expand`, `calculator_use`, `seller_prompt_view`, `buyer_prompt_view`
- ✅ No typos or case mismatches

---

## Test Case 6: SPCalculation Discriminated Union

**Objective:** Verify SPCalculation type-safety via discriminated union

**Steps:**
1. Create a test function:
```typescript
function handleCalculation(calc: SPCalculation) {
  if (calc.mode === 'sell') {
    // TypeScript should know we have earn_sp
    console.log(calc.earn_sp);
    console.log(calc.max_sp_usable); // ❌ Should error
  } else {
    // TypeScript should know we have max_sp_usable
    console.log(calc.max_sp_usable);
    console.log(calc.earn_sp); // ❌ Should error
  }
}
```
2. Run typecheck

**Expected Results:**
- ✅ Sell mode: `earn_sp` accessible, `max_sp_usable` causes error
- ✅ Buy mode: `max_sp_usable` accessible, `earn_sp` causes error
- ✅ Discriminated union works correctly

---

## Test Case 7: Error Class Inheritance

**Objective:** Verify error classes extend Error correctly

**Steps:**
1. In mobile or admin, create a test:
```typescript
try {
  throw new ContentValidationError('Title too short', 'title');
} catch (err) {
  console.log(err instanceof Error); // Should be true
  console.log(err instanceof ContentValidationError); // Should be true
  if (err instanceof ContentValidationError) {
    console.log(err.code); // Should be 'CONTENT_VALIDATION'
    console.log(err.field); // Should be 'title'
  }
}
```
2. Run in Node.js or browser console

**Expected Results:**
- ✅ Error is instance of both `Error` and `ContentValidationError`
- ✅ `.code` property is stable (`CONTENT_VALIDATION`)
- ✅ `.field` property is accessible
- ✅ Stack trace is present

---

## Test Case 8: Mobile Does NOT Import Admin

**Objective:** Verify package independence (mobile doesn't import admin)

**Steps:**
1. Run: `cd p2p-kids-marketplace && grep -r "admin-portal" src/types/`
2. Check result

**Expected Results:**
- ✅ No matches found (exit code 1)
- ✅ No import statements from `admin-portal` in mobile types

---

## Test Case 9: Admin Does NOT Import Mobile

**Objective:** Verify package independence (admin doesn't import mobile)

**Steps:**
1. Run: `cd p2p-kids-admin && grep -r "p2p-kids-marketplace" src/types/ | grep -v "^.*:.*//"`
2. Check result (excluding comments)

**Expected Results:**
- ✅ No import statements found
- ✅ Comments mentioning "p2p-kids-marketplace" are allowed
- ✅ Packages remain independent

---

## Test Case 10: No `any` Types

**Objective:** Verify strict TypeScript (no `any`)

**Steps:**
1. Run for mobile:
```bash
cd p2p-kids-marketplace && grep -n " any" src/types/education.ts src/types/education-errors.ts
```
2. Run for admin:
```bash
cd p2p-kids-admin && grep -n " any" src/types/education.ts src/types/education-errors.ts
```

**Expected Results:**
- ✅ No matches in mobile files
- ✅ No matches in admin files
- ✅ Exit code 1 (no matches)

---

## Verification Checklist (MODULE-18-VERIFICATION-TRADING-EDUCATION.md)

### Section 2: Shared Types (EDU-002)

| # | Check | Result | Notes |
|---|---|---|---|
| 2.1 | `p2p-kids-marketplace/src/types/education.ts` exists | ✅ | Created |
| 2.2 | `p2p-kids-marketplace/src/types/education-errors.ts` exists | ✅ | Created |
| 2.3 | `p2p-kids-admin/src/types/education.ts` exists | ✅ | Created |
| 2.4 | `p2p-kids-admin/src/types/education-errors.ts` exists | ✅ | Created |
| 2.5 | `SectionType` union matches DB CHECK verbatim | ✅ | 6 values match |
| 2.6 | `npm run typecheck` passes (both packages) | ✅ | Mobile + Admin both pass |
| 2.7 | No `any` in EDU type files | ✅ | Verified via grep |

**Additional Checks:**
- ✅ `SPCalculation` is discriminated union on `mode`
- ✅ `BonusCategory` re-exported from mobile `education.ts`
- ✅ `EducationAnalyticsEvent.event_type` union matches DB (8 values)
- ✅ Every error class extends `Error` with stable `code`
- ✅ Mobile type file does NOT import from `admin-portal`
- ✅ Admin type file does NOT import from `p2p-kids-marketplace`

---

## Test Summary

**Total Test Cases:** 10  
**Expected Passing:** 10  
**Manual Steps:** ~15 minutes  

**Test Coverage:**
- ✅ Type imports (mobile + admin)
- ✅ Admin-only fields
- ✅ BonusCategory re-export
- ✅ Enum validation against DB
- ✅ Discriminated unions
- ✅ Error class inheritance
- ✅ Package independence
- ✅ Strict TypeScript (no `any`)

---

## Known Limitations

1. **No runtime validation** - Types are compile-time only. Runtime validation (zod/yup) is out of scope for EDU-002.
2. **No service implementations** - Services will be implemented in EDU-003.
3. **BonusCategory duplicated** - Intentionally duplicated between mobile and admin to keep packages independent (per MODULE-18 spec).

---

## Next Steps

After EDU-002 is verified:
1. ✅ Proceed to EDU-003 (Backend Services)
2. Services will consume these types
3. Integration tests in EDU-003 will validate type-to-DB alignment

---

## Troubleshooting

### Issue: TypeScript errors in imports
**Solution:** Run `npm install` in both packages to ensure dependencies are installed

### Issue: Typecheck fails with "Cannot find module"
**Solution:** Verify file paths are correct and files were created in correct locations

### Issue: Tests fail in Vitest (admin)
**Solution:** Vitest uses different syntax than Jest. Use `npm test <pattern>` instead of `--testPathPattern`

### Issue: BonusCategory import error
**Solution:** Ensure `category.ts` exists in mobile app from ADMIN-V3-002

---

## Sign-off

**Tester:** ________________________  
**Date:** ________________________  
**Result:** ☐ PASS  ☐ FAIL  
**Notes:**

---

**End of EDU-002 Manual Testing Guide**
