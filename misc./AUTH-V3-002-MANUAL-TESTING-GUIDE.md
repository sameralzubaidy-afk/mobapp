# AUTH-V3-002: Shared Types & Error Classes - Manual Testing Guide

**Module:** MODULE-03-AUTH-V3-SOCIAL-LOGIN  
**Task:** AUTH-V3-002  
**Status:** ✅ Implementation Complete  
**Last Updated:** 2026-05-01

---

## Overview

This task delivers shared TypeScript types and error classes for OAuth/social login functionality. Since this is a foundational types-only task with no UI or backend changes, manual testing focuses on verifying type safety and error class behavior in the codebase.

---

## Prerequisites

- ✅ TypeScript compiler configured (`tsconfig.json`)
- ✅ Jest test environment set up
- ✅ Files exist:
  - `p2p-kids-marketplace/src/types/auth-v3.ts`
  - `p2p-kids-marketplace/src/types/auth-v3-errors.ts`
  - `p2p-kids-marketplace/src/types/__tests__/auth-v3.test.ts`

---

## Test Cases

### TC-001: TypeScript Compilation Validation

**Objective:** Verify all types compile without errors and enforce strict typing

**Steps:**
1. Navigate to mobile app directory:
   ```bash
   cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
   ```

2. Run TypeScript type-check:
   ```bash
   npm run typecheck
   ```

**Expected Result:**
- ✅ Exit code 0
- ✅ No TypeScript errors
- ✅ All types in `auth-v3.ts` compile successfully
- ✅ All error classes in `auth-v3-errors.ts` compile successfully

**Pass Criteria:** TypeScript compilation succeeds with no errors

---

### TC-002: Unit Tests Execution

**Objective:** Verify all type and error class unit tests pass

**Steps:**
1. Run unit tests for auth-v3 types:
   ```bash
   npm run test:unit -- --testPathPattern='auth-v3'
   ```

**Expected Result:**
- ✅ All test suites pass
- ✅ `auth-v3 types` describe block: 8 test suites pass
- ✅ `auth-v3 error classes` describe block: 10 test suites pass
- ✅ No test failures or warnings

**Pass Criteria:** All 18+ tests pass

---

### TC-003: OAuthProvider Type Safety Validation

**Objective:** Verify `OAuthProvider` type is a strict union with no string escape hatch

**Steps:**
1. Open `src/types/auth-v3.ts` in VS Code
2. Inspect `OAuthProvider` type definition
3. Try to create a test file with invalid provider:
   ```typescript
   import { OAuthProvider } from './auth-v3';
   const provider: OAuthProvider = 'twitter'; // Should fail
   ```

**Expected Result:**
- ✅ TypeScript error: Type '"twitter"' is not assignable to type 'OAuthProvider'
- ✅ Only 'google' | 'facebook' | 'apple' are accepted
- ✅ No `string` escape hatch exists

**Pass Criteria:** TypeScript rejects non-whitelisted providers at compile time

---

### TC-004: Error Class Code Stability

**Objective:** Verify all error classes have stable `code` fields that are readonly

**Steps:**
1. Import error classes in a test file:
   ```typescript
   import {
     OAuthStateMismatchError,
     EmailMismatchError,
     OTPRateLimitError,
   } from './auth-v3-errors';
   ```

2. Inspect error codes:
   ```typescript
   const e1 = new OAuthStateMismatchError();
   console.log(e1.code); // Should be 'OAUTH_STATE_MISMATCH'
   
   const e2 = new EmailMismatchError('a@x.com', 'b@x.com');
   console.log(e2.code); // Should be 'EMAIL_MISMATCH'
   
   const e3 = new OTPRateLimitError(3600, '3 per hour');
   console.log(e3.code); // Should be 'OTP_RATE_LIMIT'
   ```

3. Try to modify error code (should fail):
   ```typescript
   e1.code = 'MODIFIED'; // TypeScript error
   ```

**Expected Result:**
- ✅ All error codes are stable strings
- ✅ Error codes match specification:
  - `OAUTH_STATE_MISMATCH`
  - `EMAIL_MISMATCH`
  - `LAST_LOGIN_METHOD`
  - `OTP_EXPIRED`
  - `OTP_RATE_LIMIT`
  - `WEAK_PASSWORD`
  - `AVATAR_DOWNLOAD_FAILED`
  - `PROVIDER_UNAVAILABLE`
- ✅ TypeScript error when trying to modify `code` (readonly)

**Pass Criteria:** All error codes are stable and readonly

---

### TC-005: Error Class Metadata Validation

**Objective:** Verify error classes carry typed metadata as specified

**Steps:**
1. Test `EmailMismatchError` metadata:
   ```typescript
   const error = new EmailMismatchError('provider@x.com', 'account@y.com');
   console.log(error.providerEmail); // 'provider@x.com'
   console.log(error.accountEmail);  // 'account@y.com'
   ```

2. Test `OTPRateLimitError` metadata:
   ```typescript
   const error = new OTPRateLimitError(3600, '3 per hour');
   console.log(error.retryAfterSeconds); // 3600
   console.log(error.limitType);          // '3 per hour'
   ```

3. Test `WeakPasswordError` metadata:
   ```typescript
   const error = new WeakPasswordError(['Too short', 'No digits']);
   console.log(error.reasons); // ['Too short', 'No digits']
   ```

**Expected Result:**
- ✅ All metadata fields are typed correctly
- ✅ Metadata is accessible via public readonly properties
- ✅ Error messages include metadata values

**Pass Criteria:** All error class metadata is correctly typed and accessible

---

### TC-006: ProviderProfile Type Validation

**Objective:** Verify `ProviderProfile` structure matches specification

**Steps:**
1. Create a valid `ProviderProfile` with all fields:
   ```typescript
   const profile: ProviderProfile = {
     name: 'John Doe',
     email: 'john@example.com',
     avatar: 'https://example.com/photo.jpg',
     provider: 'google',
     providerUserId: 'google-123456',
   };
   ```

2. Create a valid `ProviderProfile` without avatar (Apple case):
   ```typescript
   const appleProfile: ProviderProfile = {
     name: 'Jane Smith',
     email: 'jane@privaterelay.appleid.com',
     provider: 'apple',
     providerUserId: 'apple-789',
   };
   ```

3. Try to create invalid profile (should fail):
   ```typescript
   const invalid: ProviderProfile = {
     name: 'Test',
     email: 'test@x.com',
     provider: 'twitter', // TypeScript error
     providerUserId: '123',
   };
   ```

**Expected Result:**
- ✅ Valid profiles compile without errors
- ✅ Avatar field is optional
- ✅ Invalid provider triggers TypeScript error
- ✅ All required fields enforce presence

**Pass Criteria:** ProviderProfile type enforces correct structure

---

### TC-007: PasswordStrengthResult Type Validation

**Objective:** Verify `PasswordStrengthResult` is a value return type (never throws)

**Steps:**
1. Create valid password result:
   ```typescript
   const valid: PasswordStrengthResult = {
     valid: true,
     reasons: [],
   };
   ```

2. Create invalid password result with reasons:
   ```typescript
   const invalid: PasswordStrengthResult = {
     valid: false,
     reasons: [
       'Password must be at least 8 characters',
       'Password must contain at least one digit',
     ],
   };
   ```

**Expected Result:**
- ✅ Both structures compile correctly
- ✅ `valid` is a boolean
- ✅ `reasons` is an array of strings
- ✅ Type does not include thrown errors (value return pattern)

**Pass Criteria:** PasswordStrengthResult type supports value return pattern

---

### TC-008: PhoneVerificationCode Type Validation

**Objective:** Verify `PhoneVerificationCode` structure for database records

**Steps:**
1. Create a valid phone verification code:
   ```typescript
   const code: PhoneVerificationCode = {
     id: 'uuid-123',
     userId: 'user-456',
     phone: '+14155551234',
     codeHash: '$2b$10$hashedcode',
     attempts: 0,
     createdAt: '2026-04-20T10:00:00Z',
     expiresAt: '2026-04-20T10:05:00Z',
   };
   ```

**Expected Result:**
- ✅ All fields required
- ✅ Phone is E.164 format string
- ✅ Code is stored as bcrypt hash (never plaintext)
- ✅ Timestamps are ISO strings

**Pass Criteria:** PhoneVerificationCode type matches database schema

---

### TC-009: Lint Validation

**Objective:** Verify all files pass linting rules

**Steps:**
1. Run ESLint on new files:
   ```bash
   npm run lint -- src/types/auth-v3.ts src/types/auth-v3-errors.ts src/types/__tests__/auth-v3.test.ts
   ```

**Expected Result:**
- ✅ No lint errors
- ✅ No lint warnings
- ✅ Code style consistent with project conventions

**Pass Criteria:** All files pass linting

---

### TC-010: Import Validation in Other Files

**Objective:** Verify types can be imported and used in service files

**Steps:**
1. Create a test service file that imports types:
   ```typescript
   import type { OAuthProvider, ProviderProfile, AuthResult } from '../types/auth-v3';
   import { OAuthStateMismatchError } from '../types/auth-v3-errors';
   
   export const testFunction = (provider: OAuthProvider): AuthResult => {
     if (provider !== 'google' && provider !== 'facebook' && provider !== 'apple') {
       throw new OAuthStateMismatchError();
     }
     return { success: true };
   };
   ```

2. Run type-check:
   ```bash
   npm run typecheck
   ```

**Expected Result:**
- ✅ Import statements work correctly
- ✅ Types are recognized
- ✅ Error classes are usable
- ✅ No compilation errors

**Pass Criteria:** Types are importable and usable across the codebase

---

## Summary

### Files Created

- ✅ `p2p-kids-marketplace/src/types/auth-v3.ts` (226 lines)
- ✅ `p2p-kids-marketplace/src/types/auth-v3-errors.ts` (253 lines)
- ✅ `p2p-kids-marketplace/src/types/__tests__/auth-v3.test.ts` (463 lines)

### Verification Checklist

From `MODULE-03-VERIFICATION-V3-SOCIAL-LOGIN.md`:

- [x] **V-AUTH-V3-002.1:** `OAuthProvider` is strict union 'google' | 'facebook' | 'apple' (no string escape)
- [x] **V-AUTH-V3-002.2:** `ProviderProfile` has required fields: name, email, provider, providerUserId; avatar is optional
- [x] **V-AUTH-V3-002.3:** `LinkedProvider` has provider, providerEmail, linkedAt
- [x] **V-AUTH-V3-002.4:** `PasswordStrengthResult` has valid: boolean, reasons: string[] (value return, never throws)
- [x] **V-AUTH-V3-002.5:** All error classes extend Error with stable `code` field
- [x] **V-AUTH-V3-002.6:** `OTPRateLimitError` has `retryAfterSeconds: number` metadata
- [x] **V-AUTH-V3-002.7:** `WeakPasswordError` has `reasons: string[]` metadata
- [x] **V-AUTH-V3-002.8:** No `any` types used
- [x] **V-AUTH-V3-002.9:** No `as unknown as` casts used
- [x] **V-AUTH-V3-002.10:** All error classes maintain instanceof checks after serialization
- [x] **V-AUTH-V3-002.11:** Unit tests cover all types and error classes (18+ tests)

### Test Execution Shortcuts

```bash
# Run all checks in sequence
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Type-check
npm run typecheck

# Lint
npm run lint

# Unit tests
npm run test:unit -- --testPathPattern='auth-v3'

# All tests
npm test -- --testPathPattern='auth-v3'
```

---

## Notes for iOS/Android Simulators

Since this task only creates TypeScript types and error classes (no UI changes), there is no simulator testing required. All validation is done via:
1. TypeScript compiler
2. ESLint
3. Jest unit tests

The types will be consumed by future tasks (AUTH-V3-003 through AUTH-V3-009) which WILL require simulator testing.

---

## Sign-Off

- [ ] All 10 test cases pass ✅
- [ ] TypeScript compilation succeeds
- [ ] All unit tests pass (18+ tests)
- [ ] ESLint passes
- [ ] Ready for next task (AUTH-V3-003: OAuthService implementation)
