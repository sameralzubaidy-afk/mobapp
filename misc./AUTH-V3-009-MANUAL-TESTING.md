# AUTH-V3-009: Manual E2E Testing Guide
**Module:** MODULE-03-AUTH-V3-SOCIAL-LOGIN  
**Task:** AUTH-V3-009 (Tests)  
**Environment:** Staging (Production Supabase)  
**Devices:** iOS Simulator + Android Emulator  
**Real OAuth:** Google / Facebook / Apple test accounts required

---

## 📋 Pre-Testing Checklist

Before starting manual tests, verify:

- [ ] Supabase staging project has OAuth providers enabled (Google, Facebook, Apple)
- [ ] OAuth redirect URLs configured in provider dashboards
- [ ] Test accounts ready:
  - **Google:** `test-google@example.com` / password
  - **Facebook:** `test-facebook@example.com` / password
  - **Apple:** Apple ID with test mode enabled
- [ ] Twilio credentials configured in `send-phone-otp` Edge Function
- [ ] Phone numbers ready for OTP testing (use real numbers or Twilio test numbers)
- [ ] `avatars` storage bucket exists and is public
- [ ] Staging app installed on iOS Simulator + Android Emulator

---

## Test Suite 1: Google OAuth Signup

**Objective:** Verify Google signup creates account, auto-fills profile, activates trial, and skips email verification.

### TC-GOOGLE-001: Google Signup Happy Path

**Preconditions:**
- App is fresh install or user is logged out
- Google test account has NOT been used before in staging

**Steps:**

1. **Launch app** on iOS Simulator
   - Tap "Get Started" button
   - Verify signup screen appears

2. **Initiate Google Sign In**
   - Tap "Continue with Google" button
   - **Expected:** OAuth browser/WebView opens with Google login screen
   - **Screenshot required:** Google consent screen

3. **Complete Google OAuth**
   - Enter Google test email: `test-google@example.com`
   - Enter password
   - Tap "Next" / "Allow"
   - **Expected:** Redirects back to app with loading indicator

4. **Verify Session Created**
   - **Expected:** Home screen loads
   - **Expected:** User avatar appears in top bar
   - **Expected:** No email verification prompt (skip for OAuth)

5. **Verify Profile Auto-Filled**
   - Tap "Profile" tab
   - **Expected:** Display name = Google account name (e.g., "Test Google User")
   - **Expected:** Avatar shows Google profile picture (not default placeholder)
   - **Screenshot required:** Profile screen with auto-filled name + avatar

6. **Verify Trial Activated**
   - Navigate to Settings > Subscription
   - **Expected:** Status = "Kids Club+ Trial"
   - **Expected:** "30 days remaining" or similar countdown

7. **Verify Linked Providers**
   - Navigate to Settings > Linked Accounts
   - **Expected:** Google provider shows "Linked" status
   - **Expected:** Facebook and Apple show "Not Linked"
   - **Expected:** "Email & Password" section shows "Not Set" (social-only user)

8. **Logout and Re-Login with Google**
   - Tap "Logout"
   - Tap "Login"
   - Tap "Continue with Google"
   - **Expected:** Faster login (no re-consent)
   - **Expected:** Home screen loads with same user data

**Pass Criteria:**
- ✅ All steps complete without errors
- ✅ Profile name and avatar auto-filled from Google
- ✅ Trial subscription active
- ✅ Can re-login via Google

**Fail Criteria:**
- ❌ OAuth redirect fails or loops
- ❌ Profile name is empty or shows "User"
- ❌ Avatar is default placeholder (not Google photo)
- ❌ Trial not activated
- ❌ Email verification prompt appears (should skip)

---

### TC-GOOGLE-002: Google OAuth State Mismatch (Security Test)

**Objective:** Verify CSRF protection via state token validation.

**Preconditions:**
- Developer mode enabled to intercept OAuth flow

**Steps:**

1. **Initiate Google Sign In**
   - Tap "Continue with Google"
   - OAuth URL opens

2. **Manually Modify State Parameter**
   - In browser, edit URL to change `state` parameter value
   - Example: `state=abc123` → `state=malicious999`

3. **Complete OAuth with Modified State**
   - Proceed with login
   - **Expected:** App rejects callback and shows error:
     - "OAuth state mismatch. Please try again."
   - **Expected:** User remains on signup/login screen (not authenticated)

**Pass Criteria:**
- ✅ Modified state rejected
- ✅ Error message shown
- ✅ No session created

**Fail Criteria:**
- ❌ Modified state accepted (SECURITY VULNERABILITY)
- ❌ User authenticated despite state mismatch

---

### TC-GOOGLE-003: Google Cancel Flow

**Objective:** Verify graceful handling when user cancels OAuth.

**Steps:**

1. **Initiate Google Sign In**
   - Tap "Continue with Google"
   - OAuth screen opens

2. **Cancel OAuth**
   - Tap "Cancel" or close browser without completing
   - **Expected:** App returns to signup/login screen
   - **Expected:** Error banner: "Sign in was cancelled. Please try again."

3. **Retry Sign In**
   - Tap "Continue with Google" again
   - Complete OAuth successfully
   - **Expected:** Login succeeds

**Pass Criteria:**
- ✅ Cancel handled gracefully
- ✅ User can retry without issue

---

## Test Suite 2: Facebook OAuth Signup

**Objective:** Same as Google but with Facebook provider.

### TC-FACEBOOK-001: Facebook Signup Happy Path

**Steps:** (Identical to TC-GOOGLE-001 but use Facebook button)

1. Launch app, tap "Get Started"
2. Tap "Continue with Facebook"
3. Enter Facebook test credentials: `test-facebook@example.com`
4. Complete OAuth
5. Verify profile auto-filled (Facebook name + photo)
6. Verify trial activated
7. Verify Facebook linked in Settings > Linked Accounts
8. Logout and re-login via Facebook

**Pass Criteria:** Same as TC-GOOGLE-001

---

### TC-FACEBOOK-002: Facebook Avatar Fetch Timeout

**Objective:** Verify avatar download never blocks signup (5s timeout + fallback).

**Steps:**

1. **Simulate Slow Network** (iOS Simulator → Developer → Network Link Conditioner → Very Bad Network)
2. Sign up via Facebook
3. **Expected:** Profile created even if avatar fetch times out
4. **Expected:** Avatar shows default placeholder (not broken image)
5. **Expected:** Display name still auto-filled from Facebook

**Pass Criteria:**
- ✅ Signup succeeds despite avatar timeout
- ✅ Default avatar shown (not broken)

---

## Test Suite 3: Apple Sign In

**Objective:** Verify Apple OAuth on both iOS and Android (cross-platform).

### TC-APPLE-001: Apple Signup Happy Path (iOS)

**Preconditions:**
- iOS Simulator with Apple ID configured
- Apple test account configured in App Store Connect

**Steps:**

1. Launch app on iOS Simulator, tap "Get Started"
2. Tap "Sign in with Apple"
3. **Expected:** Native Apple Sign In sheet appears
4. Select "Continue" with Face ID / Touch ID simulation
5. **On first sign-in:** Apple prompts "Share My Email" or "Hide My Email"
   - Select "Share My Email"
6. **Expected:** App redirects with session created
7. **Expected:** Profile name auto-filled from Apple ID (if provided)
8. **Expected:** Avatar = default placeholder (Apple does not provide photos)
9. Verify trial activated
10. Verify Apple linked in Settings > Linked Accounts

**Pass Criteria:**
- ✅ Apple Sign In native sheet works
- ✅ Profile name extracted (if user shared name on first sign-in)
- ✅ Default avatar used (Apple limitation)
- ✅ Trial activated

---

### TC-APPLE-002: Apple Signup Happy Path (Android)

**Objective:** Verify Apple button renders and works on Android too (web OAuth).

**Steps:**

1. Launch app on Android Emulator
2. Tap "Get Started"
3. **Expected:** Apple button is visible and enabled
4. Tap "Sign in with Apple"
5. **Expected:** Browser opens with Apple OAuth web flow
6. Complete Apple login
7. **Expected:** Redirects back to app
8. Verify profile created and trial activated

**Pass Criteria:**
- ✅ Apple button visible on Android
- ✅ Web OAuth flow works
- ✅ Signup succeeds

---

### TC-APPLE-003: Apple "Hide My Email" Scenario

**Objective:** Verify app handles Apple's private relay email addresses.

**Steps:**

1. Sign up via Apple on iOS
2. **On Apple consent screen:** Select "Hide My Email"
3. **Expected:** Apple generates private relay email (e.g., `abc123@privaterelay.appleid.com`)
4. **Expected:** Profile created with relay email
5. **Expected:** App treats relay email as normal email

**Pass Criteria:**
- ✅ Private relay email accepted
- ✅ No email mismatch errors

---

## Test Suite 4: Account Linking

**Objective:** Verify linking providers to an existing account with password re-auth.

### TC-LINK-001: Link Google to Existing Email Account

**Preconditions:**
- User exists with email+password: `linktest@example.com` / `Password123!`

**Steps:**

1. **Login with Email+Password**
   - Enter email: `linktest@example.com`
   - Enter password: `Password123!`
   - Tap "Login"
   - **Expected:** Home screen loads

2. **Navigate to Linked Accounts**
   - Tap "Profile" → "Settings" → "Linked Accounts"
   - **Expected:** Email & Password shows "Linked"
   - **Expected:** Google, Facebook, Apple show "Not Linked"

3. **Initiate Link Google**
   - Tap "Link Google Account" button
   - **Expected:** Prompt: "Re-enter your password to continue"

4. **Re-Auth with Password**
   - Enter password: `Password123!`
   - Tap "Confirm"
   - **Expected:** OAuth browser opens for Google

5. **Complete Google OAuth with SAME EMAIL**
   - Login to Google with `linktest@example.com`
   - **Expected:** Redirects back to app
   - **Expected:** Success message: "Google account linked"

6. **Verify Link Succeeded**
   - **Expected:** Google now shows "Linked" status
   - **Expected:** Audit log entry created (verify in Supabase Dashboard → Database → `audit_log` table)

7. **Logout and Re-Login with Google**
   - Logout
   - Tap "Continue with Google"
   - **Expected:** Login succeeds with same account
   - **Expected:** Profile data intact

**Pass Criteria:**
- ✅ Password re-auth required before linking
- ✅ Link succeeds
- ✅ Can login via Google or email+password

---

### TC-LINK-002: Link Fails with Email Mismatch

**Objective:** Verify email mismatch blocked (security).

**Preconditions:**
- User logged in as `linktest@example.com`

**Steps:**

1. Navigate to Settings > Linked Accounts
2. Tap "Link Facebook Account"
3. Re-enter password
4. **Complete Facebook OAuth with DIFFERENT EMAIL:** `different@example.com`
5. **Expected:** Error: "Email mismatch. The Facebook account email does not match your account email."
6. **Expected:** Link fails, Facebook remains "Not Linked"

**Pass Criteria:**
- ✅ Email mismatch detected
- ✅ Link rejected
- ✅ Error message clear

**Fail Criteria:**
- ❌ Link succeeds despite mismatch (SECURITY VULNERABILITY)

---

### TC-LINK-003: Unlink Provider (Last-Method Guard)

**Objective:** Verify last login method cannot be removed.

**Preconditions:**
- User has Google + Facebook linked, NO password

**Steps:**

1. Navigate to Settings > Linked Accounts
2. **Expected:** Google = Linked, Facebook = Linked, Email = Not Set
3. **Unlink Google**
   - Tap "Unlink" on Google card
   - Confirm
   - **Expected:** Success, Google now "Not Linked"
   - **Expected:** Facebook still "Linked"

4. **Attempt to Unlink Facebook (Last Method)**
   - Tap "Unlink" on Facebook card
   - **Expected:** Error: "Cannot remove last login method. Link another account or set a password first."
   - **Expected:** Facebook remains "Linked"

5. **Set Password First**
   - Tap "Add Password"
   - Enter strong password
   - **Expected:** Password set successfully

6. **Now Unlink Facebook**
   - Tap "Unlink" on Facebook card
   - **Expected:** Success (password remains as fallback)

**Pass Criteria:**
- ✅ Cannot unlink last method
- ✅ Can unlink after setting password

---

## Test Suite 5: Deferred Phone Verification

**Objective:** Verify phone is optional at signup but required before first listing.

### TC-PHONE-001: Skip Phone at Signup, Prompt at First Listing

**Preconditions:**
- New social-only user (no phone)

**Steps:**

1. **Sign up via Google**
   - Complete Google OAuth
   - **Expected:** Home screen loads (NO phone prompt)

2. **Browse Listings (No Phone Needed)**
   - Tap "Discover" tab
   - Browse items
   - **Expected:** No phone prompt

3. **Attempt to Create First Listing**
   - Tap "Sell" tab
   - Tap "Create Listing"
   - Fill title, description, price, category
   - Tap "Publish"
   - **Expected:** Phone Verification Modal appears (non-dismissible)
   - **Screenshot required:** Modal with title "Verify Phone to Continue"

4. **Enter Phone and Send Code**
   - Enter phone: `(555) 123-4567`
   - Tap "Send Code"
   - **Expected:** OTP sent via Twilio
   - **Expected:** Modal transitions to OTP entry step

5. **Enter OTP**
   - Check phone for SMS code
   - Enter 6 digits
   - **Expected:** Modal closes
   - **Expected:** Listing published successfully

6. **Verify Phone Saved**
   - Navigate to Profile → Settings → Account
   - **Expected:** Phone shows as `(555) 123-4567` with "Verified" badge

7. **Create Second Listing (No Phone Prompt)**
   - Create another listing
   - **Expected:** NO phone prompt (already verified)
   - **Expected:** Listing publishes immediately

**Pass Criteria:**
- ✅ Phone skipped at signup
- ✅ Phone required before first listing
- ✅ Phone NOT required for subsequent listings

---

### TC-PHONE-002: OTP Rate Limit (3 per phone per hour)

**Objective:** Verify rate limit prevents spam.

**Steps:**

1. **Send 3 OTPs in quick succession**
   - Enter phone number
   - Tap "Send Code" → wait 10s → tap "Resend" → wait 10s → tap "Resend"
   - **Expected:** All 3 succeed

2. **Attempt 4th OTP**
   - Tap "Resend" again
   - **Expected:** Error: "Too many attempts. Please try again in XX minutes."

3. **Wait 60 minutes and retry**
   - (Optional: manually delete `phone_verification_codes` rows in DB to fast-forward)
   - Retry send
   - **Expected:** Succeeds

**Pass Criteria:**
- ✅ Rate limit enforced at 3/hour
- ✅ Error message clear

---

### TC-PHONE-003: OTP Expired (5-minute window)

**Objective:** Verify codes expire after 5 minutes.

**Steps:**

1. Send OTP
2. **Wait 6 minutes** (or manually update `expires_at` in DB to past)
3. Enter the received code
4. **Expected:** Error: "Verification code has expired. Please request a new code."
5. Tap "Resend"
6. Enter new code
7. **Expected:** Success

**Pass Criteria:**
- ✅ Expired code rejected
- ✅ Resend works

---

### TC-PHONE-004: Invalid OTP Code

**Objective:** Verify incorrect codes rejected.

**Steps:**

1. Send OTP
2. Enter wrong code (e.g., `000000`)
3. **Expected:** Error: "Invalid verification code. Please try again."
4. Enter correct code
5. **Expected:** Success

**Pass Criteria:**
- ✅ Invalid code rejected
- ✅ User can retry

---

## Test Suite 6: Password Fallback

**Objective:** Social-only users can set password later.

### TC-PASSWORD-001: Set Password for Social-Only User

**Preconditions:**
- User signed up via Google (no password)

**Steps:**

1. Navigate to Settings > Linked Accounts
2. **Expected:** "Email & Password" shows "Not Set"
3. Tap "Add Password" button
4. **Expected:** "Set Password" modal appears
5. **Enter Weak Password**
   - Enter "123"
   - **Expected:** Error: "Password must be at least 8 characters"
6. **Enter Strong Password**
   - New Password: `SecurePass123!`
   - Confirm Password: `SecurePass123!`
   - Tap "Set Password"
7. **Expected:** Success message
8. **Expected:** "Email & Password" now shows "Linked"
9. **Logout**
10. **Login with Email+Password**
    - Enter email from Google account
    - Enter password: `SecurePass123!`
    - **Expected:** Login succeeds

**Pass Criteria:**
- ✅ Password strength validated
- ✅ Password set successfully
- ✅ Can login via email+password

---

## Test Suite 7: Cross-Platform (iOS + Android)

**Objective:** Verify all OAuth flows work on both platforms.

### TC-CROSS-001: Test All Providers on iOS

**Steps:**

1. Sign up via Google on iOS Simulator → ✅
2. Logout, sign up via Facebook on iOS Simulator → ✅
3. Logout, sign up via Apple on iOS Simulator → ✅

**Pass Criteria:** All 3 providers work

---

### TC-CROSS-002: Test All Providers on Android

**Steps:**

1. Sign up via Google on Android Emulator → ✅
2. Logout, sign up via Facebook on Android Emulator → ✅
3. Logout, sign up via Apple on Android Emulator → ✅

**Pass Criteria:** All 3 providers work

---

## 📊 Test Execution Summary

| Test Case | iOS | Android | Status | Notes |
|---|---|---|---|---|
| TC-GOOGLE-001 | ⬜ | ⬜ | ⬜ | |
| TC-GOOGLE-002 | ⬜ | ⬜ | ⬜ | |
| TC-GOOGLE-003 | ⬜ | ⬜ | ⬜ | |
| TC-FACEBOOK-001 | ⬜ | ⬜ | ⬜ | |
| TC-FACEBOOK-002 | ⬜ | ⬜ | ⬜ | |
| TC-APPLE-001 | ⬜ | N/A | ⬜ | iOS native only |
| TC-APPLE-002 | N/A | ⬜ | ⬜ | Android web only |
| TC-APPLE-003 | ⬜ | ⬜ | ⬜ | |
| TC-LINK-001 | ⬜ | ⬜ | ⬜ | |
| TC-LINK-002 | ⬜ | ⬜ | ⬜ | |
| TC-LINK-003 | ⬜ | ⬜ | ⬜ | |
| TC-PHONE-001 | ⬜ | ⬜ | ⬜ | |
| TC-PHONE-002 | ⬜ | ⬜ | ⬜ | |
| TC-PHONE-003 | ⬜ | ⬜ | ⬜ | |
| TC-PHONE-004 | ⬜ | ⬜ | ⬜ | |
| TC-PASSWORD-001 | ⬜ | ⬜ | ⬜ | |
| TC-CROSS-001 | ⬜ | N/A | ⬜ | iOS only |
| TC-CROSS-002 | N/A | ⬜ | ⬜ | Android only |

**Legend:**
- ⬜ Not Run
- ✅ Pass
- ❌ Fail
- ⚠️ Blocked

---

## 🚨 Critical Security Checks

**MUST verify before sign-off:**

- [ ] **OAuth state CSRF protection** (TC-GOOGLE-002): Modified state token rejected
- [ ] **Email mismatch blocked** (TC-LINK-002): Cannot link provider with different email
- [ ] **Last-method guard** (TC-LINK-003): Cannot remove last login method
- [ ] **OTP rate limit** (TC-PHONE-002): 3/hour enforced
- [ ] **No credentials in logs:** Review Xcode/Logcat output — OTP codes, provider tokens, passwords NEVER logged

---

## 📷 Required Screenshots for PR

Please attach screenshots for:

1. Google signup success with auto-filled avatar
2. Facebook signup success with auto-filled avatar
3. Apple signup success (iOS native sheet)
4. Phone verification modal (non-dismissible at listing)
5. Linked Accounts screen showing all 3 providers linked
6. Last-method guard error message

---

## 🛠️ Troubleshooting

**OAuth redirect fails:**
- Check Supabase Dashboard → Auth → Providers → Redirect URLs
- Verify `app.json` scheme: `kidsmarketplace://`

**Avatar not loading:**
- Check `avatars` bucket is public
- Check network logs for 403/404

**OTP not received:**
- Check Twilio logs
- Verify `send-phone-otp` Edge Function env vars set

**Link email mismatch:**
- EXPECTED behavior — verify error shown

---

## ✅ Sign-Off

**Tester Name:** ___________________  
**Date:** ___________________  
**Platform Tested:** iOS ☐  Android ☐  
**All Critical Tests Pass:** ☐ Yes ☐ No  
**Ready for Production:** ☐ Yes ☐ No  

**Notes:**
