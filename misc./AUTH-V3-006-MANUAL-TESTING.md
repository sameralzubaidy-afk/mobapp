# Manual Testing Guide — AUTH-V3-006: PhoneService + PasswordService

**Task:** AUTH-V3-006 (PhoneService + PasswordService)  
**Module:** MODULE-03-AUTH-V3-SOCIAL-LOGIN  
**Date:** 2026-05-01  
**Platform:** iOS Simulator + Android Emulator

---

## Prerequisites

### 1. SQL Setup (Run in Supabase SQL Editor)

```sql
-- Run migration for OTP hashing RPCs
-- File: supabase/migrations/20260501000001_phone_otp_hashing_rpcs.sql
-- (Copy and run the entire SQL file in Supabase Dashboard → SQL Editor)

-- Verify functions exist
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('hash_otp_code', 'verify_otp_code', 'can_set_password')
ORDER BY proname;
-- Expected: 3 rows
```

### 2. Edge Function Deployment

```bash
# Deploy send-phone-otp Edge Function
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
npx supabase functions deploy send-phone-otp --project-ref <YOUR_PROJECT_REF>

# Set Twilio secrets
npx supabase secrets set r_ACCOUNT_SID=<your_twilio_sid> --project-ref <YOUR_PROJECT_REF>
npx supabase secrets set TWILIO_AUTH_TOKEN=<your_twilio_token> --project-ref <YOUR_PROJECT_REF>
npx supabase secrets set TWILIO_FROM_NUMBER=<your_twilio_phone> --project-ref <YOUR_PROJECT_REF>

# Verify secrets are set
npx supabase secrets list --project-ref <YOUR_PROJECT_REF>
```

### 3. App Build

```bash
cd p2p-kids-marketplace

# Install dependencies
npm install

# Run Tier 0 checks
npm run typecheck
npm run lint

# Run unit tests
npm run test:unit -- --testPathPattern=phoneService
npm run test:unit -- --testPathPattern=passwordService

# Start app
npm run ios  # or npm run android
```

---

## Test Cases

### TC-001: Check if Phone Verification Required

**Precondition:** User signed up via OAuth (Google/Facebook/Apple), no phone verified yet

**Steps:**
1. Open app
2. Navigate to **Settings** → **Account**
3. Observe "Phone Verification" section

**Expected Result:**
- ✅ Shows "Phone: Not Verified"
- ✅ Shows "Verify Phone" button
- ✅ `isPhoneRequired(userId)` returns `true`

---

### TC-002: Send Phone Verification Code (Happy Path)

**Precondition:** Phone not verified

**Steps:**
1. Tap "Verify Phone"
2. Enter phone: `+1<your_real_phone>`
3. Tap "Send Code"

**Expected Result:**
- ✅ Shows "Code sent to +1..." message
- ✅ SMS arrives within 30 seconds
- ✅ Code is 6 digits
- ✅ DB: `phone_verification_codes` has new row with:
  - `code_hash` starting with `$2b$` (bcrypt)
  - `attempts = 0`
  - `expires_at` ~10 minutes from now

**SQL Verification:**
```sql
SELECT phone, code_hash, attempts, expires_at
FROM phone_verification_codes
WHERE user_id = '<your_user_id>'
ORDER BY created_at DESC
LIMIT 1;
```

---

### TC-003: Verify Phone Code (Valid Code)

**Precondition:** Code sent in TC-002

**Steps:**
1. Enter the 6-digit code from SMS
2. Tap "Verify"

**Expected Result:**
- ✅ Shows "Phone verified successfully"
- ✅ Navigates back to Settings
- ✅ Shows "Phone: Verified ✓"
- ✅ DB: `user_profiles.phone_verified_at` is set
- ✅ DB: `user_profiles.phone_verification_method = 'sms'`
- ✅ DB: `admin_audit_logs` has entry: `action = 'phone_verified'`

**SQL Verification:**
```sql
SELECT phone_verified_at, phone_verification_method
FROM user_profiles
WHERE id = '<your_user_id>';

SELECT action, details
FROM admin_audit_logs
WHERE user_id = '<your_user_id>'
  AND action = 'phone_verified'
ORDER BY created_at DESC
LIMIT 1;
```

---

### TC-004: Verify Phone Code (Invalid Code)

**Precondition:** Code sent, not verified yet

**Steps:**
1. Enter wrong code: `000000`
2. Tap "Verify"

**Expected Result:**
- ✅ Shows "Invalid verification code" error
- ✅ DB: `attempts` incremented to 1
- ✅ Code input remains visible (can retry)

**SQL Verification:**
```sql
SELECT attempts FROM phone_verification_codes
WHERE user_id = '<your_user_id>'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: 1
```

---

### TC-005: Verify Phone Code (Max Attempts)

**Precondition:** 2 failed attempts already

**Steps:**
1. Enter wrong code again: `111111`
2. Tap "Verify"

**Expected Result:**
- ✅ Shows "Maximum verification attempts exceeded"
- ✅ "Verify" button disabled
- ✅ Shows "Request New Code" button

---

### TC-006: Rate Limit — 3 per Phone per Hour

**Precondition:** Phone not verified

**Steps:**
1. Request code (1st)
2. Wait 5 seconds, request code (2nd)
3. Wait 5 seconds, request code (3rd)
4. Wait 5 seconds, request code (4th)

**Expected Result:**
- ✅ First 3 requests succeed
- ✅ 4th request fails with: "Too many attempts. Please try again in X seconds"
- ✅ Error is `OTPRateLimitError` with `retryAfterSeconds` ~3600

**SQL Verification:**
```sql
SELECT COUNT(*) FROM phone_verification_codes
WHERE phone = '<your_phone>'
  AND created_at > NOW() - INTERVAL '1 hour';
-- Expected: 3
```

---

### TC-007: Rate Limit — 5 per User per Day

**Precondition:** User with multiple phones (or test with multiple accounts)

**Steps:**
1. Request codes for 5 different phone numbers within 24 hours

**Expected Result:**
- ✅ First 5 succeed
- ✅ 6th fails with rate limit error

---

### TC-008: Expired OTP Code

**Precondition:** Code sent >10 minutes ago

**Steps:**
1. Wait 11 minutes after sending code
2. Enter the code
3. Tap "Verify"

**Expected Result:**
- ✅ Throws `OTPExpiredError`
- ✅ Shows "Verification code expired. Please request a new one"

---

### TC-009: Password Strength — Too Short

**Precondition:** Social user (no password set)

**Steps:**
1. Navigate to **Settings** → **Account Security** → **Set Password**
2. Enter password: `Short1`
3. Tap "Set Password"

**Expected Result:**
- ✅ Shows "Password must be at least 8 characters long"
- ✅ `validatePasswordStrength` returns `{ valid: false, reasons: ['TOO_SHORT'] }`

---

### TC-010: Password Strength — No Letter

**Precondition:** Social user

**Steps:**
1. Enter password: `12345678`
2. Tap "Set Password"

**Expected Result:**
- ✅ Shows "Password must contain at least one letter"
- ✅ Reasons include `NO_LETTER`

---

### TC-011: Password Strength — No Digit

**Precondition:** Social user

**Steps:**
1. Enter password: `NoDigitsHere`
2. Tap "Set Password"

**Expected Result:**
- ✅ Shows "Password must contain at least one digit"
- ✅ Reasons include `NO_DIGIT`

---

### TC-012: Password Strength — Common Password

**Precondition:** Social user

**Steps:**
1. Enter password: `password123`
2. Tap "Set Password"

**Expected Result:**
- ✅ Shows "This password is too common. Please choose a stronger password"
- ✅ Reasons include `COMMON_PASSWORD`

---

### TC-013: Password Strength — Multiple Failures

**Precondition:** Social user

**Steps:**
1. Enter password: `pass` (too short + no digit)
2. Tap "Set Password"

**Expected Result:**
- ✅ Shows multiple error reasons
- ✅ `reasons` array contains `['TOO_SHORT', 'NO_DIGIT']`

---

### TC-014: Set Password Successfully

**Precondition:** Social user (Google/Facebook/Apple signup)

**Steps:**
1. Enter password: `MySecurePass123!`
2. Tap "Set Password"

**Expected Result:**
- ✅ Shows "Password set successfully"
- ✅ User can now sign in with email + password
- ✅ `canSetPassword(userId)` now returns `false`

**SQL Verification:**
```sql
SELECT can_set_password('<your_user_id>');
-- Expected: false (now has password)
```

---

### TC-015: Cannot Set Password Twice

**Precondition:** User already has password (from TC-014)

**Steps:**
1. Try to set password again
2. Enter strong password

**Expected Result:**
- ✅ Error: "You already have a password set"
- ✅ Code: `NOT_ALLOWED`
- ✅ No password change occurs

---

### TC-016: Sign In with New Password

**Precondition:** Password set in TC-014

**Steps:**
1. Sign out
2. Sign in with:
   - Email: `<user_email>`
   - Password: `MySecurePass123!`

**Expected Result:**
- ✅ Sign in succeeds
- ✅ Navigates to Dashboard
- ✅ User can use both OAuth and password to sign in

---

## Regression Tests

After completing all TCs, run:

```bash
# Unit tests
npm run test:unit -- --testPathPattern=phoneService
npm run test:unit -- --testPathPattern=passwordService

# Integration tests (requires Supabase connection)
RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=phoneService.integration
RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=passwordService.integration

# Maestro flow (iOS)
npm run test:maestro:ios -- .maestro/auth-v3-006-phone-password-services.yaml

# Maestro flow (Android)
npm run test:maestro:android -- .maestro/auth-v3-006-phone-password-services.yaml
```

---

## Cleanup

```sql
-- Reset test data
DELETE FROM phone_verification_codes WHERE user_id = '<your_user_id>';
UPDATE user_profiles SET phone_verified_at = NULL WHERE id = '<your_user_id>';
DELETE FROM admin_audit_logs WHERE user_id = '<your_user_id>' AND action = 'phone_verified';
```
