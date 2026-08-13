# AUTH-V3-008 Manual Testing Guide

**Module:** MODULE-03-AUTH-V3-SOCIAL-LOGIN  
**Task:** AUTH-V3-008 — Mobile UI (LinkedAccountsScreen, Modals, Transaction Gating)  
**Platform:** iOS & Android Simulators  
**Last Updated:** May 3, 2026

---

## Prerequisites

### SQL Setup (Run in Supabase SQL Editor)
```sql
-- Verify phone verification columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN ('phone_verified_at', 'phone_verification_method');

-- Verify RLS is enabled on user_profiles
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_profiles';
```

### Environment Setup
1. Ensure you have test users created:
   - User A: Email+password only (no phone verified)
   - User B: Social login only (Google/Facebook/Apple)
   - User C: Multiple linked providers
2. Ensure navigation routes configured (see Navigation Setup section)
3. Run Tier 0 checks first (see Commands section)

---

## Test Cases

### TC-001: LinkedAccountsScreen — Email+Password User

**Objective:** Verify LinkedAccountsScreen renders correctly for email+password users

**Steps:**
1. Sign in as email+password user (User A)
2. Navigate to `Settings → Account → Linked Accounts`
3. Verify screen displays:
   - Email address (readonly)
   - Password status: "Password set" with change option
   - 3 provider cards (Google, Facebook, Apple)
   - All providers show "Unlinked" state
   - Each has a "Link" button

**Expected Result:**
- ✅ Screen renders without errors
- ✅ Email displayed correctly
- ✅ Password status shows "Password set"
- ✅ All 3 providers show as unlinked
- ✅ testID `linked-accounts-screen` present

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-002: Link Provider — Password Re-Auth Required

**Objective:** Verify password re-authentication when linking a provider

**Steps:**
1. From LinkedAccountsScreen (as email+password user)
2. Tap "Link" button on Google provider card
3. Verify password prompt modal appears
4. Enter correct password
5. Tap "Link Account"
6. (OAuth flow would open in production — for testing, check logs)

**Expected Result:**
- ✅ Password prompt modal displays
- ✅ Password field is secure (hidden text)
- ✅ Show/hide password button works
- ✅ "Link Account" button disabled until password entered
- ✅ On submit: OAuth flow initiated (check console logs)

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-003: Unlink Provider — Last Method Guard

**Objective:** Verify user cannot unlink last login method

**Setup:** User has only 1 login method (e.g., Google only)

**Steps:**
1. Navigate to LinkedAccountsScreen
2. Verify login method count = 1
3. Tap "Unlink" on the linked provider
4. Verify confirmation modal shows remaining methods list
5. Tap "Unlink" in confirmation modal

**Expected Result:**
- ✅ Error alert: "You must keep at least one login method"
- ✅ Provider remains linked
- ✅ Card state unchanged
- ✅ No RPC call made (check console)

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-004: Unlink Provider — Success Path

**Setup:** User has 2+ login methods

**Steps:**
1. Navigate to LinkedAccountsScreen
2. Verify login method count ≥ 2
3. Tap "Unlink" on a linked provider
4. Verify confirmation modal lists remaining methods
5. Tap "Unlink" in confirmation modal

**Expected Result:**
- ✅ Success toast: "<Provider> account unlinked successfully"
- ✅ Provider card flips to "Unlinked" state
- ✅ "Link" button now available
- ✅ Login method count decremented

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-005: Set Password Modal — Social-Only User

**Objective:** Verify social-only users can set a password backup

**Setup:** User signed in via social provider only (no password set)

**Steps:**
1. Navigate to LinkedAccountsScreen
2. Verify password status shows "No password set"
3. Tap "Set Password" button
4. Enter password: `weakpass`
5. Observe strength meter

**Expected Result:**
- ✅ SetPasswordModal opens
- ✅ Strength meter shows "Weak password" (orange/red)
- ✅ Requirement list shows failures (e.g., "Too short", "No digit")
- ✅ "Set Password" button disabled
- ⬜ Pass ⬜ Fail

**Continue:**
6. Change password to: `SecurePass123!`
7. Verify strength meter updates to "Strong password" (green)
8. Enter matching confirm password
9. Tap "Set Password"

**Expected Result:**
- ✅ Success toast: "Password set"
- ✅ Modal closes
- ✅ Password status updates to "Password set"
- ✅ Login method count incremented

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-006: PhoneVerificationModal — Step 1 (Enter Phone)

**Objective:** Verify phone input and code sending

**Setup:** User with no phone verified

**Steps:**
1. Navigate to Create Listing screen
2. Fill in required fields (title, category, condition, price)
3. Tap "Submit for Review" (publish button)
4. Verify PhoneVerificationModal opens (transaction gate)
5. Enter phone: `202` (partial)
6. Verify auto-format adds `+1` prefix
7. Complete phone: `+12025551234`
8. Tap "Send Code"

**Expected Result:**
- ✅ Modal opens with step 1 (phone input)
- ✅ Title: "Verify Your Phone"
- ✅ Description mentions transaction requirement
- ✅ NO close button (required=true)
- ✅ Phone auto-formats to E.164 (+1...)
- ✅ "Send Code" button disabled until phone valid
- ✅ On submit: transitions to step 2
- ✅ Resend timer starts at 60s

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-007: PhoneVerificationModal — Step 2 (Enter Code)

**Objective:** Verify 6-digit code input and auto-advance

**Pre-condition:** Step 1 completed, code sent

**Steps:**
1. Observe step 2 UI (code entry)
2. Verify 6 individual digit boxes displayed
3. Enter digits one-by-one: `1`, `2`, `3`, `4`, `5`, `6`
4. Observe auto-advance behavior
5. Verify auto-submit triggers after 6th digit
6. (In production: OTP validates server-side)
7. For testing: Check console logs for `verifyPhoneCode` call

**Expected Result:**
- ✅ Step 2 title: "Enter Verification Code"
- ✅ Phone number displayed: `+12025551234`
- ✅ 6 digit boxes rendered
- ✅ Each digit auto-advances to next box
- ✅ Auto-submit when 6 digits entered
- ✅ Loading indicator shown during verify
- ✅ (Production) On success: modal closes, listing publishes

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-008: PhoneVerificationModal — Resend Code

**Objective:** Verify resend timer and code resend

**Pre-condition:** At step 2 (code entry)

**Steps:**
1. Observe resend UI below code input
2. Verify timer text: "Resend code in 60s"
3. Verify "Resend Code" button disabled
4. Wait or fast-forward timer to 0s
5. Verify "Resend Code" button enabled
6. Tap "Resend Code"

**Expected Result:**
- ✅ Timer counts down from 60 to 0
- ✅ Resend button disabled during countdown
- ✅ Resend button enabled at 0s
- ✅ On tap: new code sent (check logs)
- ✅ Timer resets to 60s
- ✅ Previous code cleared

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-009: PhoneVerificationModal — Error Handling

**Objective:** Verify error states (expired, invalid, rate limit)

**Test 9a: Invalid Code**
1. At step 2, enter incorrect code: `000000`
2. Tap "Verify" or wait for auto-submit

**Expected Result:**
- ✅ Error message: "Invalid verification code. Please try again."
- ✅ Code input cleared
- ✅ User can retry

**Test 9b: Expired Code**
1. (Simulate expired code error from server)

**Expected Result:**
- ✅ Error: "Code expired. Please request a new one."
- ✅ Step resets to phone entry

**Test 9c: Rate Limit**
1. (Simulate rate limit error)

**Expected Result:**
- ✅ Error: "Too many attempts. Please try again in X seconds."
- ✅ Countdown shown
- ✅ Send button disabled during cooldown

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-010: Transaction Gating — Listing Creation

**Objective:** Verify phone verification blocks listing publish

**Setup:** User with no phone verified

**Steps:**
1. Navigate to Create Listing
2. Fill all required fields
3. Upload at least 1 photo
4. Tap "Submit for Review"
5. Verify PhoneVerificationModal opens (required=true)
6. Complete phone verification successfully
7. Verify listing publish proceeds automatically

**Expected Result:**
- ✅ Modal opens on publish attempt
- ✅ Modal is NON-DISMISSIBLE (no X button)
- ✅ User MUST verify to proceed
- ✅ On success: modal closes, listing publishes
- ✅ Success modal shows "Thanks for submitting!"

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-011: Navigation — Routes Wired Correctly

**Objective:** Verify LinkedAccountsScreen accessible from Settings

**Steps:**
1. Sign in as any user
2. Navigate to `Settings` tab (bottom nav or profile menu)
3. Tap `Account` section
4. Tap `Linked Accounts` option
5. Verify LinkedAccountsScreen renders

**Expected Result:**
- ✅ Route exists: `Settings → Account → Linked Accounts`
- ✅ Screen loads without crash
- ✅ Back button navigates to Settings

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

### TC-012: Accessibility — Focus Management

**Objective:** Verify modals are accessible

**Test on PhoneVerificationModal:**
1. Open modal
2. Verify focus auto-set to phone input (step 1)
3. Tab through inputs
4. Verify focus moves: phone → send button
5. At step 2, verify focus on first digit box
6. Tab through all 6 digits

**Expected Result:**
- ✅ Auto-focus on first input
- ✅ Tab order logical
- ✅ All inputs have accessibility labels
- ✅ Screen reader announces "Digit 1 of 6", etc.
- ✅ Esc key closes modal (web) OR swipe-down (mobile)

**Actual Result:** _________________

**Status:** ⬜ Pass ⬜ Fail

---

## Summary Checklist

| Test Case | Component | Status |
|-----------|-----------|--------|
| TC-001 | LinkedAccountsScreen | ⬜ Pass ⬜ Fail |
| TC-002 | AccountLinkingPrompt (password re-auth) | ⬜ Pass ⬜ Fail |
| TC-003 | Unlink guard (last method) | ⬜ Pass ⬜ Fail |
| TC-004 | Unlink success | ⬜ Pass ⬜ Fail |
| TC-005 | SetPasswordModal | ⬜ Pass ⬜ Fail |
| TC-006 | PhoneVerificationModal Step 1 | ⬜ Pass ⬜ Fail |
| TC-007 | PhoneVerificationModal Step 2 | ⬜ Pass ⬜ Fail |
| TC-008 | Resend code | ⬜ Pass ⬜ Fail |
| TC-009 | Error handling | ⬜ Pass ⬜ Fail |
| TC-010 | Transaction gating (listing) | ⬜ Pass ⬜ Fail |
| TC-011 | Navigation | ⬜ Pass ⬜ Fail |
| TC-012 | Accessibility | ⬜ Pass ⬜ Fail |

---

## Commands

### Tier 0 (Required Before Testing)
```bash
cd p2p-kids-marketplace
npm run lint
npm run typecheck  # or: npx tsc -p tsconfig.json --noEmit
```

### Unit Tests
```bash
cd p2p-kids-marketplace
npm run test -- useLinkedProviders
npm run test -- usePhoneVerification
```

### Integration Tests (Requires Staging Supabase)
```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- phoneService.integration.test
```

### Maestro UI Tests (After Manual Verification)
```bash
cd p2p-kids-marketplace
npm run test:maestro:ios -- linked-accounts-flow
npm run test:maestro:android -- linked-accounts-flow
```

---

## Notes for Testers

- **Simulator Only:** All tests designed for iOS Simulator + Android Emulator (no physical devices required)
- **OAuth Testing:** Full OAuth flows require production/staging environment. For local testing, check console logs for OAuth initiation calls.
- **Phone Verification:** Use test phone number `+12025551234` with code `123456` (if configured in staging)
- **Rate Limits:** If you hit rate limits during testing, wait or reset DB test data

---

**Tester Name:** _________________  
**Date:** _________________  
**Environment:** ⬜ iOS Simulator ⬜ Android Emulator  
**Supabase:** ⬜ Staging ⬜ Production  
**Build:** _________________
