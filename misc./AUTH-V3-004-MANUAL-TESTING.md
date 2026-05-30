# AUTH-V3-004: AccountService — Manual Testing Guide

**TASK:** AUTH-V3-004 — AccountService (Check / Link / Unlink / List Providers)  
**Module:** MODULE-03-AUTH-V3-SOCIAL-LOGIN.md  
**Testing Environment:** iOS Simulator + Android Emulator (Staging Supabase)

---

## Prerequisites

### 1. SQL Prerequisites (Run in Supabase SQL Editor)

```sql
-- Verify user_linked_providers view exists
SELECT table_name FROM information_schema.views
WHERE table_name = 'user_linked_providers';
-- Expected: 1 row

-- Verify link_social_account RPC exists
SELECT proname, prosecdef FROM pg_proc
WHERE proname = 'link_social_account';
-- Expected: 1 row, prosecdef = true

-- Verify admin_audit_logs table exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'admin_audit_logs';
-- Expected: 1 row
```

### 2. OAuth Provider Setup (Supabase Dashboard)

- **Google:** Enabled, client ID/secret configured
- **Facebook:** Enabled, app ID/secret configured  
- **Apple:** Enabled, team ID/key ID/private key configured

### 3. Test Accounts

Create 3 test accounts for these scenarios:
- **Account A:** Email+password only (`test-A@example.com` / `Password123!`)
- **Account B:** Google social login only (use real Google test account)
- **Account C:** Email+password + will link Google (` test-C@example.com` / `Password123!`)

---

## Test Cases

### TC-001: checkAccountExists — Existing Account

**Precondition:** Account A exists in staging database

**Steps:**
1. Open app (not signed in)
2. Navigate to Login screen
3. Tap "Continue with Google"
4. In Google OAuth flow, use email `test-A@example.com`
5. Observe account linking prompt appears

**Expected Result:**
- ✅ Prompt shows: "An account with this email already exists. Link your Google account?"
- ✅ Shows buttons: "Link Account" and "Maybe Later"

**Verification:**
```ts
// In code (for debugging):
const result = await checkAccountExists('test-A@example.com');
console.log(result);
// Expected: { exists: true, userId: '...', providers: [], hasPassword: true }
```

---

### TC-002: checkAccountExists — Non-Existent Account

**Steps:**
1. Open app (not signed in)
2. Navigate to Login screen
3. Tap "Continue with Google"
4. In Google OAuth flow, use a NEW email never seen before

**Expected Result:**
- ✅ No account linking prompt
- ✅ Google signup completes normally
- ✅ User lands on onboarding/home screen

---

### TC-003: linkSocialAccount — Password Re-Auth Success

**Precondition:** Signed in as Account C (email+password)

**Steps:**
1. Navigate to: Settings → Linked Accounts
2. Verify shows: "Password ✓ set"
3. Tap "Link" on Google card
4. OAuth flow opens → sign in with Google (`test-C@gmail.com`)
5. Observe password re-auth modal appears
6. Enter correct password: `Password123!`
7. Tap "Confirm"

**Expected Result:**
- ✅ Password verification succeeds
- ✅ Google account links successfully
- ✅ Google card now shows: "Linked • test-C@gmail.com • Unlink"
- ✅ Toast: "Google account linked"

**Verification (SQL):**
```sql
-- Check audit log
SELECT * FROM admin_audit_logs
WHERE action_type = 'link_social_account'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 1 row with payload containing provider='google'

-- Check user_linked_providers view
SELECT * FROM user_linked_providers
WHERE user_id = '<test-C-user-id>';
-- Expected: 1 row with provider='google'
```

---

### TC-004: linkSocialAccount — Password Re-Auth Failure

**Precondition:** Signed in as Account C (email+password)

**Steps:**
1. Navigate to: Settings → Linked Accounts
2. Tap "Link" on Facebook card
3. OAuth flow completes with matching email
4. In password re-auth modal, enter WRONG password: `WrongPassword`
5. Tap "Confirm"

**Expected Result:**
- ✅ Error message: "Password re-authentication failed"
- ✅ Facebook card remains "Not linked"
- ✅ No audit log entry created

---

### TC-005: linkSocialAccount — Email Mismatch

**Precondition:** Signed in as Account C (`test-C@example.com`)

**Steps:**
1. Navigate to: Settings → Linked Accounts
2. Tap "Link" on Facebook card
3. In Facebook OAuth, sign in with DIFFERENT email: `different@example.com`
4. (Password re-auth if needed)

**Expected Result:**
- ✅ Error toast: "Email mismatch: test-C@example.com vs different@example.com"
- ✅ Facebook card remains "Not linked"
- ✅ No audit log entry created

**Verification:**
```ts
// Error thrown:
// EmailMismatchError: test-C@example.com vs different@example.com
```

---

### TC-006: unlinkSocialAccount — Multiple Methods (Success)

**Precondition:** Account C has password + Google linked (from TC-003)

**Steps:**
1. Navigate to: Settings → Linked Accounts
2. Verify Google card shows "Linked"
3. Tap "Unlink" on Google card
4. Confirm modal appears listing remaining methods: "Password"
5. Tap "Confirm Unlink"

**Expected Result:**
- ✅ Google card now shows "Not linked • Link"
- ✅ Toast: "Google account unlinked"
- ✅ Password status still shows "Password ✓ set"

**Verification (SQL):**
```sql
-- Check audit log
SELECT * FROM admin_audit_logs
WHERE action_type = 'unlink_social_account'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 1 row with payload containing provider='google'

-- Check user_linked_providers view
SELECT * FROM user_linked_providers
WHERE user_id = '<test-C-user-id>';
-- Expected: 0 rows (Google unlinked)
```

---

### TC-007: unlinkSocialAccount — Last Method Guard (Blocked)

**Precondition:** Account B has ONLY Google (no password, no other providers)

**Steps:**
1. Sign in with Account B (Google only)
2. Navigate to: Settings → Linked Accounts
3. Verify shows: "No password set — Set Password"
4. Tap "Unlink" on Google card

**Expected Result:**
- ✅ Error toast: "You must keep at least one login method. Add another method first."
- ✅ Google card remains "Linked"
- ✅ No audit log entry created
- ✅ No unlinkIdentity call made

**Verification:**
```ts
// Error thrown:
// LastLoginMethodError: Cannot unlink google - it's your only login method
```

---

### TC-008: getLinkedProviders — Ordered by linkedAt

**Precondition:** Account has Google (linked 2026-04-01) and Facebook (linked 2026-04-15)

**Steps:**
1. Navigate to: Settings → Linked Accounts
2. Observe provider card order

**Expected Result:**
- ✅ Google card appears BEFORE Facebook card (oldest first)
- ✅ Google shows: "Linked • user@gmail.com"
- ✅ Facebook shows: "Linked • user@fb.com"

**Verification:**
```ts
const providers = await getLinkedProviders();
console.log(providers);
// Expected:
// [
//   { provider: 'google', providerEmail: 'user@gmail.com', linkedAt: '2026-04-01...' },
//   { provider: 'facebook', providerEmail: 'user@fb.com', linkedAt: '2026-04-15...' }
// ]
```

---

### TC-009: countLoginMethods — Password + 2 Providers

**Precondition:** Account C has password + Google + Facebook linked

**Steps:**
1. Sign in as Account C
2. Attempt to unlink Facebook
3. Observe no error (count is 3 → after unlink would be 2 → OK)

**Expected Result:**
- ✅ Unlink succeeds
- ✅ Remaining methods: Password + Google

**Verification:**
```ts
const count = await countLoginMethods(userId);
console.log(count); // Expected: 3 before unlink, 2 after
```

---

### TC-010: countLoginMethods — Social Only (No Password)

**Precondition:** Account B has Google only (no password)

**Steps:**
1. Sign in as Account B
2. Check method count

**Expected Result:**
- ✅ Count = 1 (Google only)
- ✅ Cannot unlink Google (last method guard)

**Verification:**
```ts
const count = await countLoginMethods(userId);
console.log(count); // Expected: 1
```

---

## iOS-Specific Tests

### TC-011: Apple Sign In — Link to Existing Account

**Platform:** iOS Simulator only

**Steps:**
1. Sign in as Account C (email+password)
2. Navigate to: Settings → Linked Accounts
3. Tap "Link" on Apple card
4. Apple Sign In modal appears
5. Use Apple ID with same email: `test-C@icloud.com` (if different, use matching email)
6. Complete Apple auth
7. Password re-auth if required

**Expected Result:**
- ✅ Apple card shows "Linked • test-C@icloud.com"
- ✅ Audit log entry created

---

## Android-Specific Tests

### TC-012: All Providers Render on Android

**Platform:** Android Emulator

**Steps:**
1. Navigate to: Settings → Linked Accounts
2. Observe provider cards

**Expected Result:**
- ✅ Google card visible
- ✅ Facebook card visible
- ✅ **Apple card visible** (parity with iOS per module requirements)

---

## Regression Tests

### TC-013: Audit Log Written on Link

**Steps:**
1. Complete TC-003 (link Google)
2. Run SQL:

```sql
SELECT * FROM admin_audit_logs
WHERE action_type = 'link_social_account'
AND entity_type = 'user'
AND entity_id = '<user-id>'
ORDER BY created_at DESC LIMIT 1;
```

**Expected Result:**
```json
{
  "action_type": "link_social_account",
  "payload": {
    "provider": "google",
    "provider_email": "test-C@gmail.com"
  },
  "reason": "User-initiated link_social_account"
}
```

---

### TC-014: Audit Log Written on Unlink

**Steps:**
1. Complete TC-006 (unlink Google)
2. Run SQL:

```sql
SELECT * FROM admin_audit_logs
WHERE action_type = 'unlink_social_account'
AND entity_type = 'user'
AND entity_id = '<user-id>'
ORDER BY created_at DESC LIMIT 1;
```

**Expected Result:**
```json
{
  "action_type": "unlink_social_account",
  "payload": {
    "provider": "google",
    "identity_id": "..."
  },
  "reason": "User-initiated unlink_social_account"
}
```

---

## Error Scenarios

### TC-015: Not Authenticated

**Steps:**
1. Sign out completely
2. Try to call `linkSocialAccount` or `unlinkSocialAccount` directly (via dev console or API call)

**Expected Result:**
- ✅ Error: "Not authenticated"
- ✅ No audit log entry created

---

### TC-016: Provider Unavailable (Network Error)

**Steps:**
1. Enable airplane mode
2. Navigate to: Settings → Linked Accounts
3. Tap "Link" on Google card

**Expected Result:**
- ✅ Error toast: "Network error. Please check your connection and try again."
- ✅ Google card remains "Not linked"

---

## Test Data Cleanup

After completing all tests, run:

```sql
-- Delete test users (replace with actual user IDs)
DELETE FROM auth.users WHERE email LIKE 'test-account-linking-%@example.com';
DELETE FROM auth.users WHERE email = 'test-A@example.com';
DELETE FROM auth.users WHERE email = 'test-C@example.com';

-- Clean audit logs
DELETE FROM admin_audit_logs
WHERE created_at > now() - interval '1 hour'
AND action_type IN ('link_social_account', 'unlink_social_account');
```

---

## Summary Checklist

- [ ] TC-001: checkAccountExists — existing ✅
- [ ] TC-002: checkAccountExists — non-existent ✅
- [ ] TC-003: linkSocialAccount — password re-auth success ✅
- [ ] TC-004: linkSocialAccount — password re-auth failure ✅
- [ ] TC-005: linkSocialAccount — email mismatch ✅
- [ ] TC-006: unlinkSocialAccount — multiple methods ✅
- [ ] TC-007: unlinkSocialAccount — last method guard ✅
- [ ] TC-008: getLinkedProviders — ordered ✅
- [ ] TC-009: countLoginMethods — password + 2 providers ✅
- [ ] TC-010: countLoginMethods — social only ✅
- [ ] TC-011: Apple Sign In (iOS only) ✅
- [ ] TC-012: All providers render (Android) ✅
- [ ] TC-013: Audit log on link ✅
- [ ] TC-014: Audit log on unlink ✅
- [ ] TC-015: Not authenticated error ✅
- [ ] TC-016: Provider unavailable error ✅

---

**Testing Complete:** ______ (Date)  
**Tested By:** ______  
**Platform:** iOS ☐ Android ☐  
**Environment:** Staging Supabase ☐  
**All Tests Passed:** ☐ Yes ☐ No (see notes below)

**Notes:**
