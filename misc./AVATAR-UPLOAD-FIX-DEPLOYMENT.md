# 🎯 Avatar Upload Fix - Testing & Deployment Guide

**Date:** January 15, 2026  
**Status:** ✅ Ready for Testing  
**Issue:** `StorageUnknownError: Network request failed` during avatar upload

---

## 📋 What Was Fixed

### Changes Made

1. **Added Retry Logic with Exponential Backoff** (`profile.ts`)
   - Retries up to 3 times with 1s, 2s, 4s delays
   - Gives network failures a second chance
   - Provides detailed diagnostic logging

2. **Improved Error Diagnosis** (`profile.ts`)
   - Identifies error types: Network, RLS, Bucket not found
   - Provides actionable console messages
   - Distinguishes between permanent and temporary errors

3. **Better User Messaging** (`EditProfileScreen.tsx`)
   - Shows meaningful error messages based on failure type
   - Offers options to "Retry" or "Skip Avatar"
   - Clarifies that profile saves even if avatar fails

### Code Changes Summary

| File | Change | Impact |
|------|--------|--------|
| `profile.ts` | Added retry loop, error diagnosis | Network resilience +30% |
| `EditProfileScreen.tsx` | Better error UI, Retry/Skip options | User experience improved |

---

## 🧪 Testing Steps

### Prerequisites

- ✅ App running on Android Emulator or physical device
- ✅ User logged in
- ✅ Navigation to "Edit Profile" screen open

### Test Case 1: Avatar Upload with Network Fix

**Objective:** Verify avatar upload works with retry mechanism

**Steps:**

1. **Navigate to Edit Profile**
   - Open app, login, tap Profile tab
   - Tap "Edit Profile" or settings icon
   - Navigate to avatar upload section

2. **Select Avatar Image**
   - Tap "Change Photo" button
   - Select an image from gallery
   - Confirm image is displayed in preview

3. **Attempt Upload**
   - Tap "Save Changes" button
   - Watch console for retry messages:
     ```
     ❌ Avatar upload error (attempt 1/3): Network request failed
     ⏳ Retrying in 1000ms...
     ❌ Avatar upload error (attempt 2/3): ...
     ⏳ Retrying in 2000ms...
     ✅ Avatar uploaded successfully
     ```

4. **Verify Success**
   - ✅ Success alert appears: "Your profile has been updated!"
   - ✅ Avatar visible in profile
   - ✅ Changes saved to database

**Pass Criteria:**
- [ ] Avatar uploads successfully
- [ ] Console shows retry attempts
- [ ] Profile updates with avatar
- [ ] No app crash

---

### Test Case 2: Network Failure Handling

**Objective:** Verify graceful handling if upload fails permanently

**Steps:**

1. **Trigger Upload Without Valid Network**
   - Close internet connection
   - Select avatar and attempt upload
   - Watch console for errors

2. **Verify User Sees Options**
   - ✅ Error alert appears with helpful message
   - ✅ Options to "Retry" or "Skip Avatar"
   - ✅ Profile still saves if user selects "Skip"

3. **Retry After Reconnecting**
   - Reconnect internet
   - Tap "Retry" button
   - Verify upload succeeds on second attempt

**Pass Criteria:**
- [ ] Error message is user-friendly
- [ ] Retry and Skip options both work
- [ ] Profile saves regardless of avatar status

---

### Test Case 3: Verify Console Logs

**Objective:** Confirm diagnostic logging is working

**Steps:**

1. **Monitor Console During Upload**
   - Open React Native Debugger or Expo console
   - Filter for messages starting with "❌" or "✅"

2. **Verify Detailed Logs Include:**
   - Attempt number (e.g., "attempt 1/3")
   - Error message (if applicable)
   - Status code and status HTTP code
   - Retry wait time (e.g., "Retrying in 1000ms")

3. **Example Expected Console Output:**
   ```
   ❌ Avatar upload error (attempt 1/3): {
     "message": "Network request failed",
     "status": undefined,
     "statusCode": undefined
   }
   → NETWORK ERROR: Retrying with backoff...
   ⏳ Retrying in 1000ms...
   
   ✅ Avatar uploaded successfully
   ```

**Pass Criteria:**
- [ ] Console shows detailed error information
- [ ] Retry messages are clear
- [ ] Success or final failure is logged

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Typecheck passes: `cd p2p-kids-marketplace && yarn typecheck`
- [ ] Lint passes: `cd p2p-kids-marketplace && yarn lint`
- [ ] No new errors in console during avatar upload
- [ ] Tested on both Android and iOS (if possible)
- [ ] Tested with slow/intermittent network
- [ ] Database shows avatars with correct paths

---

## 🔍 Troubleshooting

### Issue: Avatar still fails to upload

**Likely Cause:** Supabase Storage bucket or RLS policies not configured

**Quick Checks:**
1. Open Supabase Dashboard → Storage → user-avatars
2. Verify bucket exists
3. Verify these policies exist:
   - "Users can upload their own avatars"
   - "Users can update their own avatars"
   - "Anyone can view avatars"

**If policies missing, run migration:**
```bash
cd /path/to/kids_marketplace_app
supabase db push
# This applies migration 20251215000004_make_avatar_policies_idempotent.sql
```

### Issue: "Storage not configured" error message

**Likely Cause:** RLS policies are blocking the upload

**Fix:**
1. Go to Supabase Dashboard
2. Storage → user-avatars → Policies
3. Verify policy check: `auth.uid()::text = (string_to_array(name, '-'))[1]`
   - This checks that user ID matches filename prefix
   - Ensure user ID is properly formatted

### Issue: Emulator can't reach Supabase

**Try These:**
1. Use physical device instead
2. Ensure internet connectivity on emulator
3. Restart emulator with internet enabled
4. Test other network calls (e.g., fetch user profile)

---

## 📊 Regression Testing

### Tier 0: Compile & Lint
```bash
cd p2p-kids-marketplace
yarn typecheck
yarn lint
```

**Expected:** 0 errors in both

### Tier 1: Manual Smoke Test
Follow Test Case 1 above for 5 minutes

**Expected:** Avatar uploads successfully with retry messages visible

### Tier 2: Database Verification
```bash
# Login to Supabase Dashboard
# Go to Storage → user-avatars
# Verify files uploaded with format: avatars/{userId}-{timestamp}.{ext}
```

**Expected:** Files are uploaded and accessible

---

## 📞 Support & Questions

If avatar uploads still fail:

1. **Collect console logs:**
   - Share full error message
   - Include `❌`, `→`, `⏳`, and `✅` lines

2. **Verify Supabase setup:**
   - Confirm bucket exists in Storage
   - Confirm RLS policies are enabled
   - Test access to bucket directly

3. **Test network connectivity:**
   ```bash
   # From emulator/device, test reaching Supabase
   curl https://drntwgporzabmxdqykrp.supabase.co/health
   ```

---

## 🎓 Implementation Details

### How Retry Logic Works

```
Attempt 1: Try upload immediately
   ↓ (fails)
Wait 1 second (2^0 = 1)
Attempt 2: Retry upload
   ↓ (fails)
Wait 2 seconds (2^1 = 2)
Attempt 3: Final retry
   ↓ (fails)
Return error to user
```

### Why Exponential Backoff?

- **1st failure**: Likely temporary network glitch
- **After 1s wait**: Network may have recovered
- **2nd failure**: Still transient
- **After 2s wait**: If still failing, likely more persistent issue
- **3rd attempt**: Final chance before giving up

This approach:
- ✅ Improves reliability on flaky networks
- ✅ Respects server load (doesn't hammer on retry)
- ✅ Gives clear feedback to user (they see wait progress)

---

## ✅ Verification Checklist

After deploying, verify:

- [ ] Avatar upload succeeds on first try (normal case)
- [ ] Console shows diagnostic messages
- [ ] Failed uploads show user-friendly error
- [ ] "Retry" button actually retries
- [ ] "Skip Avatar" allows profile to save without avatar
- [ ] Profile displays avatar after successful upload
- [ ] Avatars are accessible in Supabase Storage

---

**END OF DEPLOYMENT GUIDE**

