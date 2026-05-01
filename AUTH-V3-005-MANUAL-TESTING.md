# AUTH-V3-005 Manual Testing Guide

**Module:** MODULE-03-AUTH-V3-SOCIAL-LOGIN.md  
**Task:** AUTH-V3-005 — ProfileService (Auto-Fill + Avatar Download)  
**Test Environment:** iOS/Android Simulators + Staging Supabase  

---

## Prerequisites

✅ Staging Supabase project accessible  
✅ `user-avatars` storage bucket exists (public = true)  
✅ Google/Facebook/Apple OAuth providers enabled in Supabase Dashboard  
✅ iOS Simulator or Android Emulator running  

---

## Test Cases

### TC-1: Auto-Fill Profile — First-Time Google Login

**Objective:** Verify `autoFillProfile` creates profile with provider name

**Steps:**
1. Open app in simulator
2. Tap "Sign in with Google"
3. Complete Google OAuth flow (use test account)
4. After successful login, navigate to Profile screen

**Expected Results:**
- ✅ Profile shows `name` = Google account name
- ✅ No manual input required
- ✅ Database check:
  ```sql
  SELECT name, auto_filled_from_provider 
  FROM profiles 
  WHERE user_id = '<test-user-id>';
  ```
  Returns: `name` = "Your Google Name", `auto_filled_from_provider` = true (if column exists)

**Pass/Fail:** ___

---

### TC-2: Auto-Fill Profile — Facebook Login with Avatar

**Objective:** Verify avatar download and upload to Storage

**Steps:**
1. Open app in simulator
2. Tap "Sign in with Facebook"
3. Complete Facebook OAuth flow
4. After login, check Profile screen avatar

**Expected Results:**
- ✅ Avatar displays Facebook profile picture
- ✅ Storage check:
  ```sql
  SELECT COUNT(*) FROM storage.objects 
  WHERE bucket_id = 'user-avatars' 
    AND name LIKE '<user-id>/social_avatar.%';
  ```
  Returns: 1 row
- ✅ Public URL accessible: `https://<supabase-url>/storage/v1/object/public/user-avatars/<user-id>/social_avatar.jpg`

**Pass/Fail:** ___

---

### TC-3: Auto-Fill Profile — Apple Login (No Avatar)

**Objective:** Verify graceful fallback when Apple provides no avatar

**Steps:**
1. Open app in iOS simulator
2. Tap "Sign in with Apple"
3. Complete Apple Sign In
4. Check Profile screen

**Expected Results:**
- ✅ `name` = Apple first name + last name (first login only)
- ✅ Avatar = default avatar (Apple doesn't provide avatar URL)
- ✅ No storage errors in console
- ✅ Log shows: `[profileService.downloadProviderAvatar] No avatar URL provided (Apple?), skipping`

**Pass/Fail:** ___

---

### TC-4: Auto-Fill Does NOT Overwrite Existing Name

**Objective:** Verify existing `name` is preserved

**Setup:**
1. Sign up with email+password
2. Manually set name = "My Custom Name"
3. Log out

**Steps:**
1. Sign in with Google (using same email)
2. Complete account linking flow
3. Check Profile screen

**Expected Results:**
- ✅ `name` still shows "My Custom Name" (NOT Google name)
- ✅ Database check:
  ```sql
  SELECT name, auto_filled_from_provider 
  FROM profiles 
  WHERE user_id = '<user-id>';
  ```
  Returns: `name` = "My Custom Name" and remains unchanged

**Pass/Fail:** ___

---

### TC-5: Avatar Download — Timeout Handling

**Objective:** Verify graceful failure on slow avatar download

**Setup:**
1. Modify test to use a slow/timeout URL:
   ```typescript
   // In test file, override avatar URL
   const slowUrl = 'https://httpstat.us/200?sleep=10000';
   await downloadProviderAvatar(slowUrl, userId);
   ```

**Expected Results:**
- ✅ Function returns `null` after 5s timeout
- ✅ Log shows: `[profileService.downloadProviderAvatar] Fetch timeout`
- ✅ No app crash or blocking behavior
- ✅ User proceeds to app with default avatar

**Pass/Fail:** ___

---

### TC-6: Avatar Download — Invalid Image Type

**Objective:** Verify rejection of non-image content

**Setup:**
1. Test with URL returning HTML instead of image:
   ```typescript
   const htmlUrl = 'https://www.google.com';
   await downloadProviderAvatar(htmlUrl, userId);
   ```

**Expected Results:**
- ✅ Function returns `null`
- ✅ Log shows: `[profileService.downloadProviderAvatar] Invalid content-type: text/html`
- ✅ No upload to Storage
- ✅ User gets default avatar

**Pass/Fail:** ___

---

### TC-7: Avatar Download — Image Too Large (> 2 MB)

**Objective:** Verify size validation

**Setup:**
1. Test with large image URL (> 2 MB)

**Expected Results:**
- ✅ Function returns `null`
- ✅ Log shows: `[profileService.downloadProviderAvatar] Image too large: <size> bytes`
- ✅ No upload to Storage

**Pass/Fail:** ___

---

### TC-8: Avatar Download — Image Too Small (< 100×100)

**Objective:** Verify dimension validation

**Setup:**
1. Test with tiny image URL (e.g., 50×50 px)

**Expected Results:**
- ✅ Function returns `null`
- ✅ Log shows: `[profileService.downloadProviderAvatar] Image too small: { width: 50, height: 50 }`
- ✅ No upload to Storage

**Pass/Fail:** ___

---

## Regression Checks

### RC-1: Existing Email+Password Signup Unaffected

**Steps:**
1. Sign up with email+password (no social login)
2. Complete profile manually
3. Verify `auto_filled_from_provider` = false (or NULL)

**Expected:** ✅ No impact on existing signup flow

**Pass/Fail:** ___

---

### RC-2: Profile Update Still Works

**Steps:**
1. Sign in with Google (auto-filled profile)
2. Navigate to Edit Profile
3. Change name
4. Save

**Expected:** ✅ Update succeeds, `auto_filled_from_provider` remains true (or changes to false based on update logic)

**Pass/Fail:** ___

---

## Database Verification Queries

Run these in Supabase SQL Editor after test runs:

```sql
-- Check auto-filled profiles
SELECT user_id, name, auto_filled_from_provider, created_at
FROM profiles
WHERE auto_filled_from_provider = true
ORDER BY created_at DESC
LIMIT 10;

-- Check uploaded avatars
SELECT name, created_at, metadata
FROM storage.objects
WHERE bucket_id = 'user-avatars'
  AND name LIKE '%/social_avatar.%'
ORDER BY created_at DESC
LIMIT 10;

-- Check for orphaned profiles (no user_id match)
SELECT p.user_id
FROM profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE u.id IS NULL;
-- Expected: 0 rows
```

---

## Test Summary

| Test Case | iOS | Android | Notes |
|-----------|-----|---------|-------|
| TC-1: Google auto-fill | ☐ | ☐ | |
| TC-2: Facebook avatar | ☐ | ☐ | |
| TC-3: Apple (no avatar) | ☐ | N/A | iOS only |
| TC-4: No overwrite | ☐ | ☐ | |
| TC-5: Timeout | ☐ | ☐ | |
| TC-6: Invalid type | ☐ | ☐ | |
| TC-7: Too large | ☐ | ☐ | |
| TC-8: Too small | ☐ | ☐ | |
| RC-1: Email signup | ☐ | ☐ | |
| RC-2: Profile update | ☐ | ☐ | |

---

## Troubleshooting

### Issue: Avatar not showing after login
- Check: Storage bucket permissions (should be public)
- Check: Browser console for CORS errors
- Check: `getPublicUrl` returns valid URL

### Issue: Display name not auto-filled
- Check: Provider actually returned `name` field in OAuth response
- Check: User already had `name` set (won't overwrite)
- Check: Logs for `[profileService.autoFillProfile]` warnings

### Issue: Tests failing with "Not authenticated"
- Check: Test user signed in via `supabase.auth.signUp/signIn`
- Check: JWT token present in `supabase.auth.getUser()`
- Check: RLS policies allow authenticated users to upsert their own profile

---

## Sign-Off

**Tester:** _______________  
**Date:** _______________  
**Overall Result:** PASS / FAIL  
**Notes:**  
_______________________________________________  
_______________________________________________  
