# FLOW: AUTH-V3-007-Social-Login-UI | TASK: AUTH-V3-007 | States covered: idle, loading, success, error (provider unavailable), user cancel
# Manual Test Cases for AUTH-V3-007: Social Login Buttons
# MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md
# Test Environment: iOS Simulator + Android Emulator
# Prerequisites: OAuth providers configured in Supabase dashboard

---

## Prerequisites Setup

### 1. Supabase OAuth Configuration
**Required Before Testing:**
```
✓ Google OAuth enabled in Supabase Dashboard
✓ Facebook OAuth enabled in Supabase Dashboard  
✓ Apple OAuth enabled in Supabase Dashboard
✓ Redirect URLs configured (both):
  - Expo Go: exp://<your-local-ip>:8081/--/oauth-callback
  - Expo Go fallback (if direct callback fails): https://auth.expo.io/@samer.alzubaidy/p2p-kids-marketplace
  - Dev build / standalone: p2pkidsmarketplace://oauth-callback
✓ OAuth secrets stored securely
```

**How to Verify:**
- Supabase Dashboard → Authentication → Providers
- Each provider shows "enabled: true"
- Redirect URLs include Expo scheme

### 1.1 Facebook Developer Dashboard (Required for TC-004)
**Facebook Login configuration must include Supabase callback domain:**
- Facebook Developers → App → Settings → Basic
  - App Domains includes: `<your-project-ref>.supabase.co`
- Facebook Developers → App → Facebook Login → Settings
  - Client OAuth Login: ON
  - Web OAuth Login: ON
  - Use Strict Mode for Redirect URIs: ON
  - Valid OAuth Redirect URIs includes:
    - `https://<your-project-ref>.supabase.co/auth/v1/callback`

**Important:**
- Do NOT set `exp://...` or `p2pkidsmarketplace://...` in Facebook "Valid OAuth Redirect URIs".
- Those app callbacks are configured in Supabase Auth redirect allow list, not in Facebook Login settings.

### 2. Test Data
```
Email (existing): test-existing@example.com (password: TestPass123)
Email (new): test-new-[timestamp]@example.com
```

---

## Test Suite 1: Component Rendering

### TC-AUTH-V3-007-001: Social Buttons Render on Login Screen
**Objective:** Verify all 3 social login buttons render correctly

**Steps:**
1. Open the app (clean install)
2. Navigate to Login screen
3. Scroll to social login section

**Expected Results:**
- ✓ "Or sign in with" divider text visible
- ✓ Google button visible with "Sign in with Google" label
- ✓ Facebook button visible with "Sign in with Facebook" label  
- ✓ Apple button visible with "Sign in with Apple" label
- ✓ Buttons use official provider styles:
  - Google: White background (#FFFFFF) with gray border (#DADCE0) and Google icon - **aligned with other buttons (height 50, borderRadius 8)**
  - Facebook: Blue (#1877F2)
  - Apple: Black (#000000)
- ✓ Buttons appear ABOVE the email/password form

**Test ID References:**
- `login-social-buttons`
- `google-login-button`
- `facebook-login-button`
- `apple-login-button`

---

### TC-AUTH-V3-007-002: Social Buttons Render on Signup Screen
**Objective:** Verify button labels change to "Continue with" in signup mode

**Steps:**
1. Navigate to Signup screen
2. Scroll to social login section

**Expected Results:**
- ✓ "Or continue with" divider text visible
- ✓ Google button shows "Continue with Google"
- ✓ Facebook button shows "Continue with Facebook"
- ✓ Apple button shows "Continue with Apple"
- ✓ All 3 buttons render on both iOS AND Android (Apple parity)

**Test ID References:**
- `signup-social-buttons`
- `google-login-button`
- `facebook-login-button`
- `apple-login-button`

---

## Test Suite 2: OAuth Flow - Success Cases

### TC-AUTH-V3-007-003: Google Login - Existing User
**Objective:** Test successful Google OAuth login for existing user

**Prerequisites:**
- Existing account: test-existing@example.com (linked to Google)

**Steps:**
1. Navigate to Login screen
2. Tap "Sign in with Google" button
3. **Observe:** Button shows loading indicator
4. **Simulator Action:** Complete Google OAuth in modal (select test account)
5. Wait for callback

**Expected Results:**
- ✓ Google button shows ActivityIndicator during OAuth flow
- ✓ Other buttons (Facebook, Apple) remain idle (not loading)
- ✓ OAuth modal opens (Google sign-in page)
- ✓ After selecting account: modal closes
- ✓ App navigates to Home screen automatically
- ✓ User is logged in (session created)
- ✓ NO error banner appears
- ✓ NO profile auto-fill (login mode)

**Verification:**
- Check auth context: `user.email === 'test-existing@example.com'`
- Check console logs: `[LoginScreen] Social login successful`

---

### TC-AUTH-V3-007-004: Facebook Signup - New User (Auto-Fill Profile)
**Objective:** Test Facebook OAuth signup + profile auto-fill

**Prerequisites:**
- New unique email: test-new-fb@example.com (not in database)

**Steps:**
1. Navigate to Signup screen
2. Tap "Continue with Facebook" button
3. Complete Facebook OAuth in modal
4. Wait for callback

**Expected Results:**
- ✓ Facebook button shows loading indicator
- ✓ OAuth modal opens (Facebook login)
- ✓ After authorization: modal closes
- ✓ **Profile auto-fill triggered** (signup mode):
  - `profileService.autoFillProfile` called with Facebook data
  - Name extracted from Facebook profile
  - Avatar downloaded (if available)
- ✓ Success alert: "Welcome to Kids Club+! 🎉"
- ✓ App navigates to Home screen
- ✓ New user created in database

**Verification:**
- Check database: `SELECT * FROM user_profiles WHERE email = 'test-new-fb@example.com'`
- Verify `name` field populated from Facebook
- Verify `avatar_url` populated (if Facebook provided photo)
- Check console logs: `[SignupScreen] Social signup successful`

---

### TC-AUTH-V3-007-005: Apple Signup - iOS Simulator
**Objective:** Test Apple Sign In on iOS (with limited data)

**Steps:**
1. **iOS Simulator Only** (Apple Sign In not available on Android simulator)
2. Navigate to Signup screen
3. Tap "Continue with Apple" button
4. Complete Apple ID authentication in modal
5. Select "Share My Email" or "Hide My Email"

**Expected Results:**
- ✓ Apple button shows loading indicator
- ✓ Apple Sign In modal appears (native iOS modal)
- ✓ User completes authentication
- ✓ Profile auto-fill triggered:
  - Name extracted (firstName + lastName on FIRST sign-in only)
  - Email extracted (or Apple private relay email)
  - Avatar: `undefined` (Apple doesn't provide photos)
- ✓ Success alert: "Welcome to Kids Club+! 🎉"
- ✓ App navigates to Home

**Special Note:**
- Apple returns name ONLY on first authorization
- Subsequent sign-ins return email only (name must be stored on first signup)

---

## Test Suite 3: Account Linking Detection

### TC-AUTH-V3-007-006: Email Collision - Existing Account Detected
**Objective:** Verify account linking prompt when email already exists

**Prerequisites:**
- Existing account: test-existing@example.com (created via email+password)
- Google account with SAME email: test-existing@example.com

**Steps:**
1. Navigate to Signup screen (NOT login)
2. Tap "Continue with Google" button
3. Complete Google OAuth with test-existing@example.com
4. Wait for callback

**Expected Results:**
- ✓ `accountService.checkAccountExists` returns `exists: true`
- ✓ `onAccountExists` callback triggered
- ✓ Alert appears: "Account Exists - An account with test-existing@example.com already exists..."
- ✓ User is NOT auto-logged in
- ✓ NO navigation to Home
- ✓ Alert provides option: "Go to Login"
- ✓ Tapping "Go to Login" navigates to LoginScreen

**Verification:**
- Check console logs: `[SignupScreen] Account exists: { email, provider: 'google' }`
- Verify no duplicate user created in database

**Note:** Full account linking UI (AccountLinkingPrompt modal) is implemented in AUTH-V3-008

---

## Test Suite 4: Error Handling

### TC-AUTH-V3-007-007: Provider Unavailable Error (Simulated)
**Objective:** Verify graceful handling of provider outage

**Setup:**
**To simulate provider unavailable:**
- Temporarily disable Google OAuth in Supabase Dashboard
- OR use mock/test environment with provider timeout

**Steps:**
1. Navigate to Signup screen
2. Create ref to email input (scroll to view it)
3. Tap "Continue with Google" button
4. Wait for error

**Expected Results:**
- ✓ Google button shows loading briefly
- ✓ Error banner appears ABOVE social buttons:
  - "Google is temporarily unavailable. Sign up with email instead?"
  - Orange background (#FFF3E0)
  - Orange left border (#FF9800)
  - "Use Email" CTA button visible
- ✓ Google button returns to idle state (no loading)
- ✓ Other buttons (Facebook, Apple) remain idle

**User Action:**
5. Tap "Use Email" CTA button

**Expected Results:**
- ✓ Email input receives focus (keyboard appears)
- ✓ Error banner disappears
- ✓ User can proceed with email signup

**Test ID References:**
- `provider-unavailable-banner`
- `provider-error-cta`

---

### TC-AUTH-V3-007-008: User Cancels OAuth Flow
**Objective:** Verify no error UI on user-initiated cancel

**Steps:**
1. Navigate to Login screen
2. Tap "Sign in with Facebook" button
3. **In OAuth modal:** Tap "Cancel" or close modal

**Expected Results:**
- ✓ Facebook button returns to idle state (loading stops)
- ✓ NO error banner appears
- ✓ NO alert appears
- ✓ User remains on Login screen
- ✓ Can retry Facebook or use email

**Verification:**
- Check console logs: `[SocialLoginButtons] OAuth flow cancelled or failed: USER_CANCELLED`
- No error logged

---

## Test Suite 5: Loading State

### TC-AUTH-V3-007-009: Loading Indicator During OAuth
**Objective:** Verify loading state isolates to pressed button

**Steps:**
1. Navigate to Login screen
2. Tap "Sign in with Google" button
3. **Observe immediately** (before completing OAuth)

**Expected Results:**
- ✓ Google button shows ActivityIndicator (spinning wheel)
- ✓ Google button label text disappears (replaced by indicator)
- ✓ Facebook button remains idle (not loading)
- ✓ Apple button remains idle (not loading)
- ✓ Google button is disabled (cannot tap again)

**User Action:**
4. Complete or cancel OAuth

**Expected Results:**
- ✓ Google button returns to idle state after callback

---

## Test Suite 6: Accessibility

### TC-AUTH-V3-007-010: VoiceOver/TalkBack Announces Correct Labels
**Objective:** Verify accessibility labels for screen readers

**Setup:**
- Enable VoiceOver (iOS) or TalkBack (Android)

**Steps:**
1. Navigate to Login screen
2. Swipe to focus on Google button (using VoiceOver/TalkBack)

**Expected Results:**
- ✓ Screen reader announces: "Sign in with Google, button"
- ✓ Button is recognized as a button element

**User Action:**
3. Tap Google button
4. Swipe to focus button again during loading

**Expected Results:**
- ✓ Screen reader announces: "Signing you in…"
- ✓ Busy state is announced

**Platform-Specific:**
- iOS: Use VoiceOver gesture (two-finger swipe)
- Android: Use TalkBack navigation

**Test ID References:**
- Check `accessibilityLabel` prop on buttons
- Check `accessibilityRole="button"`
- Check `accessibilityState.busy` during loading

---

## Test Suite 7: Cross-Platform Parity

### TC-AUTH-V3-007-011: Apple Button Renders on Android
**Objective:** Verify Apple button appears on Android (App Store compliance)

**Steps:**
1. **Android Emulator Only**
2. Navigate to Login screen
3. Scroll to social login section

**Expected Results:**
- ✓ Apple button visible on Android
- ✓ Label: "Sign in with Apple"
- ✓ Same styling as iOS (black button)
- ✓ Button is interactive (not disabled)

**Rationale:**
- Apple requires Apple Sign In when other third-party logins are offered
- Including on Android maintains UX parity across platforms

---

## Test Suite 8: Email Input Focus Fallback

### TC-AUTH-V3-007-012: Error CTA Focuses Email Input
**Objective:** Verify "Use Email" CTA scrolls to and focuses email field

**Prerequisites:**
- Simulated provider unavailable error (see TC-007)

**Steps:**
1. Navigate to Signup screen
2. Scroll to social login section (email form may be off-screen)
3. Trigger provider unavailable error (tap disabled provider)
4. Wait for error banner to appear
5. Tap "Use Email" CTA

**Expected Results:**
- ✓ Screen scrolls to email input field (if off-screen)
- ✓ Email input receives focus
- ✓ Keyboard appears
- ✓ Error banner disappears
- ✓ User can start typing email immediately

**Implementation Note:**
- Uses `emailInputRef.current.focus()` to programmatically focus
- ScrollView should auto-scroll to focused input

**Test ID References:**
- `signup-email-input`
- `provider-error-cta`

---

## Test Execution Summary

### Test Environment
- iOS Simulator: iPhone 15 Pro (iOS 17.5)
- Android Emulator: Pixel 7 (API 34)
- Expo Go: Latest version
- Supabase: Production instance with OAuth providers enabled

### Coverage Matrix

| Test Case | iOS Sim | Android Sim | Pass/Fail | Notes |
|-----------|---------|-------------|-----------|-------|
| TC-001 Render Login | ☐ | ☐ | | |
| TC-002 Render Signup | ☐ | ☐ | | |
| TC-003 Google Login | ☐ | ☐ | | |
| TC-004 Facebook Signup | ☐ | ☐ | | |
| TC-005 Apple Signup | ☐ iOS only | N/A | | |
| TC-006 Account Linking | ☐ | ☐ | | |
| TC-007 Provider Unavailable | ☐ | ☐ | | |
| TC-008 User Cancel | ☐ | ☐ | | |
| TC-009 Loading State | ☐ | ☐ | | |
| TC-010 Accessibility | ☐ | ☐ | | |
| TC-011 Apple on Android | N/A | ☐ Android | | |
| TC-012 Email Focus | ☐ | ☐ | | |

### Pass Criteria
- All 12 test cases must pass on target platforms
- Zero regression bugs introduced in email+password flow
- Social login buttons do NOT block email signup (fallback always available)

---

## Known Limitations / Future Work

1. **AccountLinkingPrompt Modal** (AUTH-V3-008):
   - Currently shows basic alert
   - Full modal with password re-auth will be implemented in next task

2. **Provider Icons**:
   - Currently using placeholder text icons
   - TODO: Replace with official brand assets from `src/assets/brands/`

3. **Deep Link Handling**:
   - Expo URL scheme configured: `kidsmarketplace://`
   - OAuth redirects tested via Expo Go only
   - Standalone builds require additional native config (tracked in INFRA tasks)

4. **Maestro Automation**:
   - Maestro YAML flow created (`.maestro/auth-v3-007-social-login-ui.yaml`)
   - OAuth modal interactions require manual testing (Maestro cannot automate native OAuth screens)

---

## Troubleshooting Guide

### Issue: "OAuth provider not enabled"
**Solution:** Verify Supabase Dashboard → Authentication → Providers shows "enabled: true"

### Issue: Facebook error "Can't load URL ... domain isn't included in the app's domains"
**Solution:**
1. Open Facebook Developers → App → Settings → Basic.
2. Add your Supabase host to **App Domains**:
  - `<your-project-ref>.supabase.co`
3. Open Facebook Login → Settings.
4. Add Supabase callback to **Valid OAuth Redirect URIs**:
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Save changes, then retry Facebook signup from app.

### Issue: Facebook error "Invalid Scopes: email"
**Solution:**
1. Use latest app code where Facebook OAuth requests only `public_profile` scope.
2. Restart Expo with cache clear: `npm start -- --clear`.
3. In Supabase Dashboard → Authentication → Providers → Facebook:
  - Set provider scopes to `public_profile` (or leave blank)
  - Remove `email` if present
4. In Facebook Developers → App → Facebook Login → Settings, keep only the Supabase callback in **Valid OAuth Redirect URIs**.
5. Retry Facebook signup flow.

**Note:**
- Email may be unavailable from Facebook in this mode, so profile auto-fill can still proceed with name/avatar when provided.

### Issue: "Redirect URL mismatch"
**Solution:** Ensure both callback URLs are in allowed redirect URLs (Supabase providers):
- `exp://<your-local-ip>:8081/--/oauth-callback` (Expo Go preferred)
- `https://auth.expo.io/@samer.alzubaidy/p2p-kids-marketplace` (Expo Go fallback)
- `p2pkidsmarketplace://oauth-callback` (dev build / standalone)

### Issue: Safari opens `localhost:3000` with `error_code=bad_oauth_state`
**Solution:**
1. Pull latest app code (OAuth state handling fix in `oauthService.ts`).
2. Restart Expo with clean cache: `npm start -- --clear`.
3. Re-run Google login from app UI (do not reuse old Safari tab/session).
4. If it persists, remove stale/old redirects and keep the current app callbacks only:
  - `exp://<your-local-ip>:8081/--/oauth-callback`
  - `p2pkidsmarketplace://oauth-callback`

### Issue: Safari opens `localhost:3000/#access_token=...` and does not return to app
**Solution:**
1. Add Expo Go callback URLs to Supabase redirect allow list:
  - `https://auth.expo.io/@samer.alzubaidy/p2p-kids-marketplace`
  - `exp://<your-local-ip>:8081/--/oauth-callback`
2. Keep `p2pkidsmarketplace://oauth-callback` for non-Expo-Go builds.
3. Restart Expo with cache clear and retry from app.

### Issue: `auth.expo.io` shows "Something went wrong trying to finish signing in"
**Solution:**
1. Use latest app code with OAuth session recovery + automatic fallback retry.
2. The app now retries OAuth automatically with `https://auth.expo.io/@samer.alzubaidy/p2p-kids-marketplace` if direct `exp://` callback does not return.
3. If auth sheet still stays open, close it using the top-left `X`.
4. Wait ~1-3 seconds on app screen for recovered session handling.
5. Verify logs include:
  - `[SocialLoginButtons] Retrying OAuth with fallback redirect URI...`
  - `[SocialLoginButtons] OAuth flow cancelled or dismissed - checking session...`
  - `[SocialLoginButtons] Recovered OAuth session after dismiss`

### Issue: Apple button not showing on iOS
**Solution:** Check `app.json` includes Apple entitlements

### Issue: "ProviderUnavailableError" on all providers
**Solution:** Check network connectivity + Supabase status page

### Issue: Profile not auto-filled on signup
**Solution:** Verify `profileService.autoFillProfile` is called (check console logs)

---

## Sign-Off

**Tester Name:** ___________________  
**Date:** ___________________  
**Platform:** ☐ iOS  ☐ Android  
**Result:** ☐ All Pass  ☐ Failed (attach bug reports)  
**Notes:** _________________________________________________
