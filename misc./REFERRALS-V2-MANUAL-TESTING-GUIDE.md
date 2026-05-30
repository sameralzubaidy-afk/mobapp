# MODULE-11-REFERRALS-V2 Manual Testing Guide

**Version:** 2.0  
**Last Updated:** January 25, 2026  
**Testing Environment:** Supabase Production  

---

## Prerequisites

### Database Setup
✅ **MUST RUN FIRST**: Execute the SQL in `SQL_TO_RUN_IN_SUPABASE.sql` in Supabase SQL Editor

### App Setup
1. Build and install the app: `cd p2p-kids-marketplace && npm run build:ios` or `npm run build:android`
2. Ensure you have test users with different subscription statuses (trial, active, expired)
3. Clear app data between test runs for clean state

---

## Test Case 1: Referral Code Generation

### TC-001: Auto-generate referral code on signup
**Objective:** Verify referral code is created automatically when user signs up

**Steps:**
1. Open the app and navigate to signup screen
2. Create a new user account (any valid email/password)
3. Complete the signup process
4. Navigate to Profile → Referral Dashboard

**Expected Results:**
- ✅ User has a unique 8-character referral code (e.g., `abc123xy`)
- ✅ Code contains only lowercase letters and numbers
- ✅ Code is displayed prominently in the dashboard
- ✅ "Copy Code" button works and shows "Copied!" confirmation

**Pass Criteria:** User sees their referral code immediately after signup completion

---

## Test Case 2: Referral Code Sharing

### TC-002: Share referral link
**Objective:** Verify native share functionality works correctly

**Steps:**
1. In Referral Dashboard, tap "Share Link" button
2. Verify native share sheet opens
3. Share via SMS/WhatsApp to yourself
4. Tap the received link on another device/browser

**Expected Results:**
- ✅ Native share sheet opens (iOS/Android)
- ✅ Share message includes referral code and deep link
- ✅ Deep link format: `kidsclub://signup?ref=ABC123XY`
- ✅ Link opens the app and pre-fills referral code on signup screen

**Pass Criteria:** Complete share flow works and link opens app with pre-filled code

---

## Test Case 3: Referral Code Application

### TC-003: Apply valid referral code during signup
**Objective:** Verify referee can use referrer's code successfully

**Prerequisites:**
- Have User A's referral code (from TC-001)
- Use different device/account for User B

**Steps:**
1. On new device, open app and go to signup
2. Enter User A's referral code in the referral field
3. Complete signup process for User B
4. Check both User A and User B accounts

**Expected Results:**
- ✅ User B signup completes successfully
- ✅ User A's referral dashboard shows 1 total referral, 1 pending
- ✅ User B shows as referee in User A's referral history
- ✅ Referral status is 'PENDING'
- ✅ No SP rewards granted yet (rewards come on first trade)

**Pass Criteria:** Referral relationship created with status 'pending'

---

## Test Case 4: Self-Referral Prevention

### TC-004: Prevent self-referral attempts
**Objective:** Verify users cannot refer themselves

**Steps:**
1. Get your own referral code from dashboard
2. Try to create a new account using your own referral code
3. Attempt with same email address
4. Attempt with different email but same device

**Expected Results:**
- ✅ Error message: "Cannot refer yourself"
- ✅ Signup process continues but referral code is not applied
- ✅ No referral relationship created in database
- ✅ User's referral stats remain unchanged

**Pass Criteria:** All self-referral attempts are blocked with clear error messages

---

## Test Case 5: Referral Code Validation

### TC-005: Invalid referral code handling
**Objective:** Verify invalid codes are handled gracefully

**Steps:**
1. During signup, enter invalid referral codes:
   - `INVALID1` (invalid code)
   - `123` (too short)
   - `TOOLONGCODE` (too long)
   - `SPECI@L!` (special characters)
2. Complete signup process for each attempt

**Expected Results:**
- ✅ Error message: "Invalid referral code" for invalid codes
- ✅ Signup process continues successfully despite invalid code
- ✅ User account is created normally
- ✅ No referral relationship is created
- ✅ User gets their own referral code after signup

**Pass Criteria:** Invalid codes show error but don't block signup

---

## Test Case 6: Case Insensitive Code Application

### TC-006: Referral codes work regardless of case
**Objective:** Verify codes work in upper, lower, and mixed case

**Steps:**
1. Get referral code `abc123xy` from User A
2. Test with User B using variations:
   - `ABC123XY` (uppercase)
   - `Abc123Xy` (mixed case)
   - `abc123XY` (mixed case)
3. Verify all variations work

**Expected Results:**
- ✅ All case variations are accepted
- ✅ Code is normalized to lowercase in database
- ✅ Referral relationship created successfully
- ✅ Same referral shows in User A's dashboard

**Pass Criteria:** Referral codes work regardless of case input

---

## Test Case 7: Referral Dashboard Statistics

### TC-007: Dashboard displays accurate statistics
**Objective:** Verify dashboard calculations are correct

**Prerequisites:**
- User A has made 3 referrals: 1 pending, 2 completed (simulated)

**Steps:**
1. Navigate to User A's Referral Dashboard
2. Review all statistics cards
3. Check referral history list

**Expected Results:**
- ✅ **Total Referrals:** Correct count (3)
- ✅ **Completed:** Shows completed referrals (2)
- ✅ **SP Earned:** Calculated correctly (2 × 25 SP = 50 SP)
- ✅ **Trial Extensions:** Shows count of extensions used
- ✅ **History List:** Shows all referrals with correct status badges
- ✅ **Date Format:** Referral dates display correctly
- ✅ **Status Badges:** Color-coded (pending=yellow, completed=green)

**Pass Criteria:** All statistics are accurate and properly formatted

---

## Test Case 8: Navigation Integration

### TC-008: Referral dashboard accessible from main navigation
**Objective:** Verify navigation integration works

**Steps:**
1. From main dashboard, navigate to Referral Dashboard
2. Use back navigation
3. Test deep linking to referral dashboard

**Expected Results:**
- ✅ Referral Dashboard accessible from main navigation
- ✅ Screen loads quickly (< 500ms)
- ✅ Back navigation returns to previous screen
- ✅ Screen title displays correctly
- ✅ No navigation errors or crashes

**Pass Criteria:** Seamless navigation to/from referral dashboard

---

## Test Case 9: Empty State Display

### TC-009: Empty state for new users
**Objective:** Verify appropriate messaging for users with no referrals

**Steps:**
1. Create new user account
2. Navigate to Referral Dashboard immediately after signup
3. Review empty state messaging

**Expected Results:**
- ✅ **Referral Code:** Displayed correctly (8 characters)
- ✅ **Statistics:** All show 0 (Total: 0, Completed: 0, SP: 0, Extensions: 0)
- ✅ **History:** Shows empty state message
- ✅ **Empty Message:** "No referrals yet. Share your code to get started!"
- ✅ **CTA Buttons:** Copy and Share buttons work even with no referrals

**Pass Criteria:** Appropriate empty state messaging encourages first referral

---

## Test Case 10: Error Handling & Edge Cases

### TC-010: Network and error conditions
**Objective:** Verify app handles errors gracefully

**Steps:**
1. Disconnect internet during referral dashboard load
2. Enter referral code during poor network conditions
3. Test with invalid user sessions
4. Test rapid consecutive referral code applications

**Expected Results:**
- ✅ Loading states display appropriately
- ✅ Error messages are user-friendly
- ✅ App doesn't crash on network errors
- ✅ Retry mechanisms work where appropriate
- ✅ Duplicate referral attempts handled correctly

**Pass Criteria:** Robust error handling with good UX

---

## Performance Test Cases

### TC-P01: Dashboard Load Performance
**Objective:** Verify dashboard loads quickly

**Steps:**
1. Navigate to referral dashboard with 10+ referrals
2. Measure load time
3. Test on older devices

**Expected Results:**
- ✅ Dashboard loads in < 500ms
- ✅ Statistics calculate quickly
- ✅ Referral history loads smoothly
- ✅ No UI lag or freezing

**Pass Criteria:** Dashboard remains responsive with large datasets

### TC-P02: Code Generation Performance
**Objective:** Verify code generation is fast

**Steps:**
1. Create multiple new accounts rapidly
2. Monitor code generation time
3. Verify no duplicate codes

**Expected Results:**
- ✅ Code generated in < 100ms
- ✅ No duplicate codes created
- ✅ Unique collision handling works
- ✅ Database constraints enforced

**Pass Criteria:** Fast, reliable code generation at scale

---

## Security Test Cases

### TC-S01: Data Privacy
**Objective:** Verify user data is properly protected

**Steps:**
1. Log in as User A
2. Try to access User B's referral dashboard
3. Check API responses for data leakage

**Expected Results:**
- ✅ Users can only see their own referral data
- ✅ RLS policies prevent cross-user access
- ✅ No sensitive data in error messages
- ✅ Referral codes cannot be enumerated

**Pass Criteria:** Proper data isolation between users

### TC-S02: Referral Code Security  
**Objective:** Verify referral codes are secure

**Steps:**
1. Attempt to guess referral codes
2. Try code enumeration attacks
3. Test for predictable patterns

**Expected Results:**
- ✅ Codes are sufficiently random (8 alphanumeric)
- ✅ No predictable patterns in generation
- ✅ Invalid codes don't leak information
- ✅ Rate limiting prevents abuse (future)

**Pass Criteria:** Referral codes are cryptographically secure

---

## Database Verification Queries

### Run these in Supabase SQL Editor to verify data integrity:

```sql
-- Check referral code format compliance
SELECT code, char_length(code) as length
FROM referral_codes 
WHERE char_length(code) != 8 OR code !~ '^[a-z0-9]+$';
-- Expected: 0 rows (all codes should be 8 chars, lowercase alphanumeric)

-- Check referral relationship integrity  
SELECT r.*, rc.code
FROM referrals r
JOIN referral_codes rc ON r.referrer_user_id = rc.user_id
WHERE r.referral_code != rc.code;
-- Expected: 0 rows (referral_code should match referrer's actual code)

-- Verify no self-referrals exist
SELECT * FROM referrals WHERE referrer_user_id = referred_user_id;
-- Expected: 0 rows (no self-referrals allowed)

-- Check one referrer per referee constraint
SELECT referred_user_id, COUNT(*) as referrer_count
FROM referrals 
GROUP BY referred_user_id 
HAVING COUNT(*) > 1;
-- Expected: 0 rows (each referee should have max 1 referrer)

-- Verify RLS policies are active
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('referral_codes', 'referrals');
-- Expected: Should show RLS policies for both tables
```

---

## Test Environment Setup Commands

### For each test run:

```bash
# Mobile app commands (use npm not yarn)
cd p2p-kids-marketplace

# Install dependencies
npm install

# Run TypeScript check (Tier 0 gate)  
npm run typecheck

# Run linting (Tier 0 gate)
npm run lint

# Run unit tests
npm test -- referralCodeV2.test.ts

# Run E2E tests
npm test -- referrals-v2.e2e.ts

# Build for iOS testing
npm run build:ios

# Build for Android testing  
npm run build:android
```

---

## Test Data Setup

### Create test users with these characteristics:

1. **User A (Referrer)**
   - Email: `tester-a+${timestamp}@example.com`
   - Subscription: Trial (for trial extension testing)
   - Referral code: Will be auto-generated

2. **User B (Referee)**  
   - Email: `tester-b+${timestamp}@example.com`
   - Will use User A's referral code
   - Subscription: Trial

3. **User C (Control)**
   - Email: `tester-c+${timestamp}@example.com` 
   - No referral code used
   - For comparison testing

### Test Data Cleanup

After testing, clean up with:
```sql
-- Remove test referrals
DELETE FROM referrals WHERE referrer_user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'tester-%@example.com'
);

-- Remove test referral codes
DELETE FROM referral_codes WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'tester-%@example.com'
);
```

---

## Success Criteria Summary

**✅ PASS:** All test cases pass with expected results  
**⚠️ PARTIAL:** Some test cases pass, non-critical issues only  
**❌ FAIL:** Critical test cases fail, implementation needs fixes

### Critical Test Cases (Must Pass):
- TC-001: Referral code generation
- TC-003: Valid referral code application  
- TC-004: Self-referral prevention
- TC-007: Dashboard statistics accuracy
- TC-S01: Data privacy/security

### Nice-to-Have Test Cases:
- TC-P01/P02: Performance tests
- TC-010: Advanced error handling
- TC-S02: Advanced security

---

## Issue Reporting Template

**Test Case:** TC-XXX  
**Environment:** iOS/Android, App Version X.X.X  
**Steps to Reproduce:**  
1. Step 1
2. Step 2  

**Expected Result:** [What should happen]  
**Actual Result:** [What actually happened]  
**Screenshots:** [If applicable]  
**Severity:** Critical/High/Medium/Low

---

## MODULE-11-REFERRALS-VERIFICATION-V2.md Mapping

This testing guide satisfies these verification checklist items:

### ✅ Referral Code Generation & Storage
- [x] Each user gets unique 8-character code on signup (TC-001)
- [x] Codes are case-insensitive (TC-006)
- [x] Self-referral prevention (TC-004)
- [x] Referral relationships stored with status tracking (TC-003)

### ✅ Referral Dashboard & Sharing  
- [x] Referral code displayed prominently (TC-001)
- [x] Share button opens native share sheet (TC-002)
- [x] Statistics display correct data (TC-007)
- [x] Empty state displayed when no referrals (TC-009)

### ✅ Cross-Module Integration
- [x] Navigation integration works (TC-008)
- [x] Deep link handling (TC-002)
- [x] Database integrity (Database Verification)

### ✅ Security & Performance
- [x] RLS policies prevent unauthorized access (TC-S01)
- [x] Dashboard loads quickly (TC-P01)
- [x] Error handling (TC-010)

This manual testing guide provides comprehensive coverage of the MODULE-11-REFERRALS-V2 implementation and ensures V2 specification compliance.