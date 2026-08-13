# AUTH-V3-003 Manual Testing Guide
# OAuth Service + Provider Config Implementation
# MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN

## Test Environment

**Platform:** iOS Simulator + Android Emulator
**Supabase:** Production instance
**Auth Providers:** Google, Facebook, Apple (must be enabled in Supabase Dashboard)

---

## Prerequisites Checklist

Before testing, verify these configuration steps are complete:

### Supabase Dashboard Configuration

> ⚠️ **Google Client Type Rule (Important)**
>
> This app currently uses `supabase.auth.signInWithOAuth` (browser-based OAuth via Supabase).
>
> For this flow, Supabase Google provider requires a **Google OAuth Web Application** client:
> - Use the Web client **Client ID** + **Client Secret** in Supabase.
> - Configure Google authorized redirect URI to Supabase callback URL:
>   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
>   - If using a custom Supabase domain, add that callback URL too.
>
> Android/iOS Google OAuth clients are **not required** for this current Supabase OAuth flow.
> They are only needed if you implement direct native Google SDK sign-in.

1. **Enable OAuth Providers**
   - Go to: Supabase Dashboard → Your Project → Authentication → Providers
   - Enable Google:
     - ✅ Enabled: ON
       - Client ID: (from **Google Web Application** OAuth client)
       - Client Secret: (from **Google Web Application** OAuth client)
       - Google Authorized Redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
       - Supabase Additional Redirect URL: `p2pkidsmarketplace://oauth-callback`
     
   - Enable Facebook:
     - ✅ Enabled: ON
     - App ID: (from Facebook Developers)
     - App Secret: (from Facebook Developers)
     - Redirect URL: `p2pkidsmarketplace://oauth-callback`
   - Enable Apple:
     - ✅ Enabled: ON
     - Services ID: (from Apple Developer)
     - Key ID: (from Apple Developer)
     - Redirect URL: `p2pkidsmarketplace://oauth-callback`

2. **Verify View Exists**
   - Go to: SQL Editor
   - Run: `SELECT * FROM public.user_linked_providers LIMIT 1;`
   - ✅ Expected: Query succeeds (even if empty result)

### Mobile App Configuration

1. **Install Dependencies**
   ```bash
   cd p2p-kids-marketplace
   npm install expo-apple-authentication
   npm install @react-native-google-signin/google-signin
   npm install react-native-fbsdk-next
   npm install expo-secure-store
   npm install expo-crypto
   ```

2. **Rebuild Native Projects** (if using bare workflow)
   ```bash
   npx expo prebuild --clean
   ```

3. **Verify app.json**
   - ✅ `scheme: "p2pkidsmarketplace"` present
   - ✅ `plugins` includes: `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `react-native-fbsdk-next`

4. **iOS Simulator Setup**
   - Sign in to iCloud on simulator (required for Apple Sign In testing)
   - Settings → Sign in to your Apple ID

5. **Android Emulator Setup**
   - Ensure Google Play Services installed
   - Sign in to Google account in emulator settings

---

## Test Cases

### TC-001: Google Sign In - Initiation

**Objective:** Verify OAuth initiation generates state and redirects to Google

**Steps:**
1. Launch app in simulator
2. Navigate to Login screen
3. Locate "Continue with Google" button (testID: `social-login-google-button`)
4. Tap button

**Expected Result:**
- ✅ Browser/WebView opens with Google sign-in page
- ✅ URL contains `state=` parameter
- ✅ No app crash or error toast

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

**Screenshot:** (attach if failure)

---

### TC-002: Google Sign In - User Cancel

**Objective:** Verify graceful handling of user cancellation

**Steps:**
1. Launch app
2. Tap "Continue with Google"
3. When Google sign-in page appears, tap "Cancel" or back button

**Expected Result:**
- ✅ Returns to Login screen
- ✅ No error toast shown
- ✅ No crash
- ✅ Can attempt sign-in again

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

---

### TC-003: Google Sign In - Success Flow

**Objective:** Verify complete OAuth flow with profile auto-fill

**Prerequisites:**
- Have a Google account ready for testing
- Account NOT previously used in this app

**Steps:**
1. Launch app
2. Tap "Continue with Google"
3. Select Google account
4. Grant permissions when prompted
5. Wait for redirect back to app

**Expected Result:**
- ✅ Redirected back to app automatically
- ✅ Profile auto-filled with Google name
- ✅ Avatar loaded from Google profile picture (if available)
- ✅ Email matches Google account email
- ✅ Trial subscription activated (30 days Kids Club+)
- ✅ Lands on Dashboard screen
- ✅ Can navigate app normally

**Verification Queries** (run in Supabase SQL Editor):
```sql
-- Check user was created
SELECT id, email, user_metadata->>'display_name' AS name
FROM auth.users
WHERE email = '<your-test-google-email>'
ORDER BY created_at DESC
LIMIT 1;

-- Check linked provider
SELECT provider, provider_email
FROM public.user_linked_providers
WHERE user_id = '<user-id-from-above>';

-- Check profile created
SELECT display_name, avatar_url, phone_verified_at
FROM public.user_profiles
WHERE user_id = '<user-id-from-above>';

-- Check trial subscription
SELECT subscription_tier, subscription_status, trial_ends_at
FROM public.user_profiles
WHERE user_id = '<user-id-from-above>';
```

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

**Screenshot:** (attach profile screen)

---

### TC-004: Facebook Sign In - Initiation

**Objective:** Verify Facebook OAuth flow initiation

**Steps:**
1. Launch app
2. Tap "Continue with Facebook" button (testID: `social-login-facebook-button`)

**Expected Result:**
- ✅ Facebook sign-in page opens
- ✅ URL contains `state=` parameter
- ✅ Scopes requested: `email,public_profile`

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

---

### TC-005: Facebook Sign In - Profile Extraction

**Objective:** Verify Facebook profile data extraction (especially nested avatar URL)

**Prerequisites:**
- Facebook account with profile picture set

**Steps:**
1. Complete Facebook sign-in flow
2. After redirect, check profile data

**Expected Result:**
- ✅ Name extracted correctly
- ✅ Avatar URL extracted from `picture.data.url` (nested structure)
- ✅ Email matches Facebook account

**Verification:**
```sql
SELECT display_name, avatar_url, email
FROM auth.users u
JOIN public.user_profiles p ON u.id = p.user_id
WHERE u.email = '<your-facebook-email>';
```

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

---

### TC-006: Apple Sign In - First Authorization (iOS only)

**Objective:** Verify Apple's firstName/lastName capture on first sign-in

**Prerequisites:**
- iOS Simulator with iCloud signed in
- Apple ID NOT previously used in this app

**Steps:**
1. Launch app on iOS Simulator
2. Tap "Sign in with Apple" button (testID: `social-login-apple-button`)
3. Enter Apple ID credentials
4. When prompted, select "Share My Email" or "Hide My Email"
5. Wait for redirect

**Expected Result:**
- ✅ Name extracted from firstName + lastName
- ✅ Email captured (real or relay email)
- ✅ Avatar is undefined (Apple doesn't provide photos)
- ✅ Profile created successfully

**Verification:**
```sql
SELECT display_name, avatar_url, email
FROM auth.users u
JOIN public.user_profiles p ON u.id = p.user_id
WHERE provider = 'apple'
ORDER BY u.created_at DESC
LIMIT 1;
```

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

**Notes:** Apple only sends firstName/lastName ONCE. Subsequent sign-ins will not include name fields.

---

### TC-007: Apple Sign In - Subsequent Authorization

**Objective:** Verify Apple sign-in after first use (no name data)

**Prerequisites:**
- Same Apple ID used in TC-006

**Steps:**
1. Sign out from app
2. Tap "Sign in with Apple" again
3. Complete sign-in

**Expected Result:**
- ✅ Sign-in succeeds
- ✅ Name is NOT updated (Apple doesn't re-send it)
- ✅ Uses previously cached display_name

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

---

### TC-008: OAuth State Mismatch Error

**Objective:** Verify CSRF protection rejects mismatched state

**Steps:**
1. Developer: Manually modify stored state in expo-secure-store
   - Use React Native Debugger or Flipper
   - Change value of `oauth_state_google` key
2. Attempt Google sign-in
3. Complete OAuth flow

**Expected Result:**
- ✅ App throws `OAuthStateMismatchError`
- ✅ Error toast: "OAuth state token mismatch - possible CSRF attack"
- ✅ Session NOT created
- ✅ User returned to Login screen

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

---

### TC-009: Provider Unavailable Error

**Objective:** Verify graceful handling of provider outages

**Steps:**
1. Developer: Temporarily disable Google provider in Supabase Dashboard
2. Attempt Google sign-in
3. Wait for timeout (10 seconds)

**Expected Result:**
- ✅ After 10s, shows error toast: "Google is temporarily unavailable"
- ✅ Offers fallback button: "Sign up with email instead?"
- ✅ Tapping fallback navigates to email signup
- ✅ No app crash

**Cleanup:** Re-enable Google provider after test

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

---

### TC-010: State Expiry (30 Minutes)

**Objective:** Verify expired state is rejected

**Steps:**
1. Initiate OAuth flow
2. Wait 31 minutes (or manually adjust stored createdAt timestamp)
3. Complete OAuth callback

**Expected Result:**
- ✅ Throws `OAuthStateMismatchError` with message "OAuth state expired"
- ✅ User prompted to retry sign-in

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

---

### TC-011: Multiple Providers - Same Email

**Objective:** Verify account linking prompt when email matches existing account

**Prerequisites:**
- Existing account created via Google with email: test@example.com

**Steps:**
1. Sign out
2. Attempt Facebook sign-in with SAME email (test@example.com)

**Expected Result:**
- ✅ App detects existing account
- ✅ Shows account linking prompt: "Link Facebook to your existing account?"
- ✅ Requires password verification (if password set) OR sign-in via already-linked provider
- ⚠️ **Note:** Full linking flow is AUTH-V3-004 - this test just verifies detection

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

---

### TC-012: isProviderLinked Query

**Objective:** Verify user can check linked providers

**Prerequisites:**
- User signed in via Google

**Steps:**
1. Sign in via Google
2. Developer: Call `isProviderLinked(userId, 'google')` from code/console

**Expected Result:**
- ✅ Returns `true` for Google
- ✅ Returns `false` for Facebook (not linked)
- ✅ Returns `false` for Apple (not linked)

**Actual Result:**
- [ ] PASS
- [ ] FAIL (describe issue):

---

## Regression Tests

After implementing AUTH-V3-003, verify these existing flows still work:

### R-001: Email/Password Signup (MODULE-03 V2)
- [ ] PASS: Can still create account with email/password
- [ ] PASS: Trial subscription still activates
- [ ] PASS: SP wallet still initializes

### R-002: Email/Password Login (MODULE-03 V2)
- [ ] PASS: Can still log in with email/password
- [ ] PASS: Session persists across app restarts

---

## Known Limitations & Notes

1. **Maestro Cannot Automate Full OAuth Flow**
   - Maestro cannot interact with external OAuth pages (Google/Facebook/Apple)
   - Manual testing REQUIRED for success paths
   - Maestro can only test button presence and cancel flow

2. **Apple Sign In Requires iOS Device or Simulator**
   - Cannot test on Android (button should still render, per spec)
   - Requires signed-in iCloud account in simulator

3. **Facebook Testing Requires App Review**
   - Facebook app must be in "Development" mode for testing
   - Only registered test users can sign in before app review

4. **Provider Configuration is Manual Ops Task**
   - Supabase Dashboard provider enablement cannot be automated
   - Must be done before testing begins

---

## SQL Cleanup (After Testing)

To remove test users created during OAuth testing:

```sql
-- Delete test users (CAREFUL - this is permanent)
DELETE FROM auth.users
WHERE email IN (
  'your-google-test@example.com',
  'your-facebook-test@example.com',
  'your-apple-relay@privaterelay.appleid.com'
);

-- Profiles and linked providers auto-cascade delete
```

---

## Test Summary

**Total Test Cases:** 12
**Passed:** ___ / 12
**Failed:** ___ / 12

**Regression Tests:**
**Passed:** ___ / 2
**Failed:** ___ / 2

**Overall Status:**
- [ ] ✅ READY FOR PRODUCTION
- [ ] ⚠️ MINOR ISSUES (describe below)
- [ ] ❌ BLOCKING ISSUES (describe below)

**Issues Found:**
1. ...
2. ...

**Tested By:** _______________
**Date:** _______________
**Environment:** iOS ___ / Android ___
