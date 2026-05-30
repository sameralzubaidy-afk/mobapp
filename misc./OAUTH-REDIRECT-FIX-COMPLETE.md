# OAuth Redirect Fix - Complete Implementation

## 🎯 Problem Summary

**Test Case**: TC-AUTH-V3-007-003 (Google Login - Existing User)
**Expected**: App navigates to Home screen automatically after OAuth completion
**Actual**: Safari opens `localhost:3000` instead of deep-linking back to Expo app

**Root Cause**: The OAuth redirect URL (`exp://10.0.0.151:8081/--/oauth-callback`) was not whitelisted in Supabase Dashboard, causing Supabase to fall back to the Site URL (`localhost:3000`).

---

## ✅ Changes Made

### 1. **SocialLoginButtons.tsx** - Switched to Proper OAuth API
**File**: `p2p-kids-marketplace/src/components/auth/SocialLoginButtons.tsx`

**Changed from**: `WebBrowser.openBrowserAsync()` with manual deep link listeners
**Changed to**: `WebBrowser.openAuthSessionAsync()` (proper OAuth flow handler)

**Why**: 
- `openAuthSessionAsync()` is specifically designed for OAuth flows
- It automatically handles the redirect back to the app
- It uses SFSafariViewController on iOS, which properly supports deep linking
- Returns the callback URL synchronously (no need for manual listeners)

**Key improvements**:
```typescript
// OLD (manual listener approach - complex and error-prone)
const linkingListener = Linking.addEventListener('url', ({ url }) => { ... });
await WebBrowser.openBrowserAsync(url);

// NEW (proper OAuth API - simple and reliable)
const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
if (result.type === 'success' && result.url) {
  // Process callback
}
```

**Error detection added**:
- Detects if redirect goes to `localhost` (means URL not whitelisted)
- Provides clear error message with exact fix steps
- Fails fast with actionable guidance

### 2. **Removed Manual Deep Link Management**
- Removed `activeOAuthFlow` ref (no longer needed)
- Removed `cleanupOAuthFlow()` function
- Removed `useEffect` cleanup hook
- Removed `Linking` import (not needed for openAuthSessionAsync)

**Why**: `openAuthSessionAsync()` handles all of this internally, making our code simpler and more reliable.

### 3. **oauthService.ts** - Removed skipBrowserRedirect
**File**: `p2p-kids-marketplace/src/services/oauthService.ts`

**Removed**: `skipBrowserRedirect: true` option from `supabase.auth.signInWithOAuth()`

**Why**: This option was preventing Supabase from properly handling the redirect. By removing it, Supabase now correctly redirects to the URL we specify in `redirectTo`.

---

## 🚨 CRITICAL CONFIGURATION REQUIRED

### Supabase Dashboard Setup (MUST DO BEFORE TESTING)

1. **Navigate to Supabase Dashboard**:
   ```
   https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/auth/url-configuration
   ```

2. **Add Redirect URL**:
   - Scroll to section: **"Redirect URLs"**
   - Click **"Add URL"** button
   - Paste your redirect URL (see below for how to get it)
   - Click **"Save"**

3. **Get Your Redirect URL**:
   ```bash
   cd p2p-kids-marketplace
   bash scripts/test-oauth-redirect.sh
   ```
   
   This will output something like:
   ```
   🔗 Expected Redirect URI: exp://10.0.0.151:8081/--/oauth-callback
   ```
   
   **Copy that exact URL** and add it to Supabase Dashboard.

4. **Verify**:
   - Check that the URL appears in the "Redirect URLs" list
   - URL should start with `exp://` (Expo Go scheme)
   - Should end with `/--/oauth-callback`

---

## 🧪 Testing Instructions

### Prerequisites
- ✅ Redirect URL added to Supabase Dashboard (see above)
- ✅ TypeScript compilation passed (verified)
- ✅ Expo Go app installed on iOS Simulator

### Test Steps

1. **Start the development server**:
   ```bash
   npm start
   ```

2. **Open Expo Go** on iPhone simulator

3. **Navigate to Login screen**

4. **Click "Continue with Google"**
   - Console should show:
     ```
     🌐 Opening OAuth URL with redirect: exp://10.0.0.151:8081/--/oauth-callback
     ```

5. **Complete Google sign-in** in Safari

6. **Expected Result**:
   - ✅ Safari automatically closes
   - ✅ Expo Go app comes back to foreground
   - ✅ Console shows: `📨 Callback URL received: exp://...`
   - ✅ Console shows: `✅ OAuth callback parsed: { hasAccessToken: true, ... }`
   - ✅ **App navigates to Home screen** ← THIS IS THE TEST CASE REQUIREMENT

7. **If you see localhost**:
   - ❌ Safari shows `localhost:3000/#access_token=...`
   - ❌ Console shows: `❌ REDIRECT URL NOT WHITELISTED!`
   - **Fix**: Go back to step "CRITICAL CONFIGURATION REQUIRED" above

---

## 🐛 Troubleshooting

### Issue 1: "OAuth redirect failed" error
**Symptom**: Error message in console with "ADD THIS URL TO SUPABASE DASHBOARD"
**Cause**: Redirect URL not whitelisted in Supabase
**Fix**: Follow "CRITICAL CONFIGURATION REQUIRED" section above

### Issue 2: Safari shows localhost:3000
**Symptom**: OAuth succeeds but browser shows localhost instead of redirecting to app
**Cause**: Same as Issue 1 - redirect URL not whitelisted
**Fix**: Same as Issue 1

### Issue 3: "OAuth flow cancelled by user"
**Symptom**: Console shows this message but you completed Google sign-in
**Cause**: User closed Safari before auth completed
**Fix**: Try again, make sure to complete the Google sign-in flow

### Issue 4: App doesn't come back to foreground
**Symptom**: Safari stays open after OAuth completion
**Possible causes**:
1. Redirect URL not whitelisted (see Issue 1)
2. iOS Simulator doesn't support deep linking properly
   **Fix**: Test on a real iOS device instead
3. Expo Go app not running in foreground
   **Fix**: Make sure Expo Go is running before clicking "Continue with Google"

---

## 📊 Verification Checklist

Before marking TC-AUTH-V3-007-003 as PASSED:

- [ ] TypeScript compilation passed (`npm run -s typecheck`) ✅ VERIFIED
- [ ] Redirect URL added to Supabase Dashboard
- [ ] OAuth URL opens in Safari (not in-app browser)
- [ ] Google sign-in completes successfully
- [ ] Safari automatically closes after sign-in
- [ ] Expo Go app comes back to foreground
- [ ] Console shows callback URL received
- [ ] Console shows OAuth callback parsed
- [ ] **App navigates to Home screen automatically** ← TEST CASE REQUIREMENT
- [ ] No errors in console

---

## 🔍 Code Changes Summary

### Files Modified:
1. `p2p-kids-marketplace/src/components/auth/SocialLoginButtons.tsx`
   - Switched from `openBrowserAsync()` to `openAuthSessionAsync()`
   - Removed manual deep link listeners
   - Added localhost detection error
   - Simplified error handling

2. `p2p-kids-marketplace/src/services/oauthService.ts`
   - Removed `skipBrowserRedirect: true` option

### Files Created:
1. `p2p-kids-marketplace/scripts/test-oauth-redirect.sh`
   - Helper script to identify redirect URL
   - Provides step-by-step configuration guide

2. `OAUTH-REDIRECT-FIX-COMPLETE.md` (this file)
   - Complete implementation documentation

---

## ✅ Definition of Done

**Change Classification**: OAuth Flow / Deep Linking / Authentication  
**Impacted Flows**: FLOW-01 (Auth – Signup/Login/Logout/Session Restore)  
**Regression Plan**: Tier 1 (targeted smoke for auth flows)

**Tier 0 (Always)**:
- ✅ TypeScript compilation: PASSED (no output from `npm run -s typecheck`)
- ✅ ESLint: PASSED (only warnings, no blocking errors)

**Tier 1 (Targeted - Auth Flow)**:
Required manual verification:
1. Google OAuth login flow
2. Redirect back to app
3. Navigation to Home screen
4. Session persistence

**Commands to Run**:
```bash
# 1. Verify Tier 0
npm run -s typecheck  # Should produce no output
npm run lint          # Should show only warnings

# 2. Get redirect URL
bash scripts/test-oauth-redirect.sh

# 3. Add URL to Supabase Dashboard (manual step)
# https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/auth/url-configuration

# 4. Test OAuth flow
npm start
# Then test in Expo Go app on simulator
```

**Expected Results**:
- Tier 0: No TypeScript errors, ESLint warnings only
- Tier 1: OAuth completes → Safari redirects to app → Home screen appears

---

## 📝 Next Steps

1. **Add redirect URL to Supabase** (CRITICAL - must do before testing)
2. **Run test script** to verify redirect URL format
3. **Test OAuth flow** in Expo Go app
4. **Verify test case passes** (TC-AUTH-V3-007-003)
5. **Document any issues** encountered

---

## 💡 Why This Fix Works

### Previous Approach (Manual Listener)
```typescript
// Set up listener BEFORE opening browser
const listener = Linking.addEventListener('url', handleCallback);
await WebBrowser.openBrowserAsync(url);  // Opens Safari
// Wait for deep link callback... (sometimes never arrives)
```

**Problems**:
- Supabase redirects to localhost when URL not whitelisted
- Manual listener never fires because Safari doesn't deep-link
- Complex state management with refs and cleanup
- Race conditions between browser open and listener setup

### New Approach (Proper OAuth API)
```typescript
// Open auth session and WAIT for result
const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
// Result contains callback URL (or cancel/dismiss status)
if (result.type === 'success') {
  // Process callback immediately
}
```

**Advantages**:
- ✅ Synchronous API - no race conditions
- ✅ Built-in deep link handling - no manual listeners
- ✅ Clear error states (success/cancel/dismiss)
- ✅ Proper SFSafariViewController on iOS - better UX
- ✅ Detects configuration issues immediately

### Critical Configuration
The redirect URL MUST be whitelisted because:
- Supabase validates redirect URLs for security
- If URL not in whitelist, Supabase uses fallback (Site URL = localhost:3000)
- The `exp://` scheme is Expo Go's custom URL scheme
- iOS only deep-links to schemes registered by apps
- `localhost:3000` isn't a registered scheme → Safari stays open

By whitelisting `exp://10.0.0.151:8081/--/oauth-callback`:
- Supabase redirects to our Expo Go app
- iOS recognizes the `exp://` scheme
- Expo Go handles the deep link
- App processes the OAuth callback
- Navigation to Home screen completes

---

## 🎉 Summary

This fix combines three essential changes:

1. **Code**: Use proper OAuth API (`openAuthSessionAsync`)
2. **Config**: Whitelist redirect URL in Supabase Dashboard  
3. **Validation**: Early detection of configuration issues

All three are required for the OAuth flow to work correctly. The code changes alone won't fix the issue - you MUST add the redirect URL to Supabase Dashboard.

**Ready to test!** Just add the redirect URL to Supabase and run the test steps above.
