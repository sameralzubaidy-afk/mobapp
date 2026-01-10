# 🚀 MSG-006-009 Testing - Action Plan

## You Are Here

You discovered two issues while testing:
1. ❌ Push tokens table empty
2. ❌ `edge_logs` table doesn't exist

**Good news:** Both issues are now fixed with documentation and code examples.

---

## What To Do Right Now (Next 10 Minutes)

### ✅ Step 1: Read This (2 min)
You're reading it! ✓

### ✅ Step 2: Understand What Happened (3 min)
Read: `MSG-006-009-FIXES-SUMMARY.md`
- What went wrong
- Why it happened
- How we fixed it

### ✅ Step 3: Plan Your Implementation (5 min)
Read: `MSG-006-009-NEXT-STEPS.md`
- What code you need to add
- Where to add it
- What to expect after

---

## What To Do Next (Next 1-2 Hours)

### Phase 1: Setup (30-45 min)

**Read these in order:**
1. `SIMULATOR-PUSH-SETUP-GUIDE.md` (complete guide)
2. `APP-CODE-PUSH-NOTIFICATIONS.md` (code examples)

**Add code to your app:**
```bash
# Create new file
touch p2p-kids-marketplace/src/services/notifications.ts

# Copy code from APP-CODE-PUSH-NOTIFICATIONS.md
# File 1 section → src/services/notifications.ts

# Update your auth context/login screen
# Copy code from File 2 or File 3 section
```

### Phase 2: Testing (1-1.5 hours)

**Run your app:**
```bash
npm run ios  # or npm run android
```

**Follow test procedures:**
1. Test Case 6-1: Push Token Registration
2. Test Case 6-2: Push Notification Delivery
3. Test Case 6-3: Multiple Notifications
4. Test Cases 7-1 to 9-4: Remaining tests

**Document results:**
- Copy `MSG-006-009-TEST-RESULTS.md` template (from main guide)
- Fill in PASS/FAIL for each test
- Note any errors

---

## The Three Documents You Need

### 1. Simulator Setup Guide
**File:** `SIMULATOR-PUSH-SETUP-GUIDE.md`

Contains:
- ✅ Complete iOS Simulator setup
- ✅ Complete Android Emulator setup
- ✅ How to verify token registration
- ✅ Troubleshooting section
- ✅ E2E test flow

**Read if:** You're setting up push notifications

---

### 2. App Code Examples
**File:** `APP-CODE-PUSH-NOTIFICATIONS.md`

Contains:
- ✅ Complete `notifications.ts` service (~200 lines)
- ✅ Integration in AuthContext (~30 lines)
- ✅ Integration in LoginScreen (~20 lines)
- ✅ How to verify it works
- ✅ Common errors & fixes

**Read if:** You're adding code to your app

---

### 3. Next Steps Checklist
**File:** `MSG-006-009-NEXT-STEPS.md`

Contains:
- ✅ Quick overview of issues
- ✅ Immediate actions checklist
- ✅ What you have now
- ✅ How to proceed
- ✅ Testing checklist for all tests
- ✅ Quick reference commands

**Read if:** You want a quick overview

---

## Complete Action Timeline

### Today
- [ ] **10 min:** Read `MSG-006-009-FIXES-SUMMARY.md`
- [ ] **5 min:** Read `MSG-006-009-NEXT-STEPS.md`
- [ ] **30-45 min:** Read `SIMULATOR-PUSH-SETUP-GUIDE.md` + `APP-CODE-PUSH-NOTIFICATIONS.md`
- [ ] **10 min:** Create `src/services/notifications.ts` with service code
- [ ] **10 min:** Update AuthContext/LoginScreen with initialization code
- [ ] **15 min:** Run app and verify notification initialization

### Total Time: ~2 hours

### Results Expected
- ✅ App console shows: `[Notifications] Expo Push Token registered: ExponentPushToken[...]`
- ✅ Database has token: `SELECT * FROM push_tokens;`
- ✅ Edge Function logs show invocation
- ✅ No errors in console

---

## Commands You'll Need

### Setup
```bash
# Start app
npm run ios
# or
npm run android

# Check iOS console (in Xcode)
# Look for: "[Notifications] Expo Push Token registered:"

# Check Android logcat
adb logcat | grep "Notifications"
```

### Verify
```sql
-- Check token registered
SELECT user_id, token FROM push_tokens 
WHERE user_id = '<YOUR_USER_ID>';

-- Test push notification
INSERT INTO messages (
  id, trade_id, sender_id, content, created_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM trades LIMIT 1),
  '<SENDER_ID>',
  'Test notification',
  NOW()
);

-- Check Edge Function
-- Supabase Dashboard → Edge Functions → send-push-notification
```

### Troubleshoot
```bash
# If token not registering
# 1. Check app console for [Notifications] logs
# 2. Verify initializePushNotifications() is called on login
# 3. Try clean rebuild:
npm run ios --clean

# Check Supabase connection
# In Supabase:
SELECT count(*) FROM profiles;
# Should return user count
```

---

## Success Criteria

You'll know it's working when:

### ✅ Token Registration
- App console shows: `[Notifications] Expo Push Token registered: ExponentPushToken[...]`
- No errors below that message

### ✅ Database
- Query returns one row: `SELECT * FROM push_tokens WHERE user_id = '...';`
- Token starts with `ExponentPushToken`
- `updated_at` is recent (within 1 minute)

### ✅ Edge Function
- Supabase Dashboard → Edge Functions → send-push-notification
- "Recent Invocations" tab shows recent calls
- Status shows "Success" (green)

### ✅ (iOS only)
- Notification appears in Notification Center
- Swipe down from top of simulator to see

### ✅ (Android only)
- Notification appears in status bar
- Tap to open app

---

## If Something Breaks

### App won't compile
- Check for TypeScript errors: `yarn typecheck`
- Check syntax: `yarn lint`
- All example code is copy-paste ready

### Token not registering
1. Check app console for `[Notifications]` logs
2. Look for error messages
3. Verify `initializePushNotifications()` is called
4. Try: `npm run ios --clean`

### Edge Function not called
1. Check database: is message inserted?
2. Check cron job: `SELECT * FROM pg_cron.job;`
3. Check trigger: `SELECT * FROM pg_triggers WHERE tgname = 'on_message_insert_notify';`
4. Check migration 084 was applied

### Still stuck?
- Check the troubleshooting section in each guide
- Look for exact error message
- Compare to "Common Errors & Fixes" in `APP-CODE-PUSH-NOTIFICATIONS.md`

---

## Files Summary

| File | What It Is | Read Time | Action |
|------|-----------|-----------|--------|
| `MSG-006-009-FIXES-SUMMARY.md` | Executive summary | 5 min | **Start here** |
| `MSG-006-009-NEXT-STEPS.md` | Action plan | 10 min | **Read second** |
| `SIMULATOR-PUSH-SETUP-GUIDE.md` | Setup instructions | 20 min | **Read before setup** |
| `APP-CODE-PUSH-NOTIFICATIONS.md` | Code to copy | 15 min | **Read while coding** |
| `MSG-006-009-COMPLETE-TESTING-GUIDE.md` | Testing procedures | 30 min | **Read while testing** |

---

## Recommended Reading Order

1. ✅ This file (you are here)
2. → `MSG-006-009-FIXES-SUMMARY.md` (understand what happened)
3. → `MSG-006-009-NEXT-STEPS.md` (plan your work)
4. → `SIMULATOR-PUSH-SETUP-GUIDE.md` (set up system)
5. → `APP-CODE-PUSH-NOTIFICATIONS.md` (add code to app)
6. → `MSG-006-009-COMPLETE-TESTING-GUIDE.md` (run tests)

---

## Success Is Just 2 Hours Away 🎯

Once you:
1. ✅ Add the notification service code
2. ✅ Integrate with auth context
3. ✅ Run app and verify token registers
4. ✅ Run all 15 test cases

You will have fully working messaging notifications with:
- ✅ Push notifications (with token registration)
- ✅ Email notifications (with SendGrid + cron)
- ✅ Delivery status (checkmarks)
- ✅ Typing indicators (animated dots)

All tested and verified! 🚀

---

## Current Status

**Before:** 
- ❌ Push tokens not registering
- ❌ Database errors on verification

**After (Now):**
- ✅ Complete setup guide
- ✅ App code examples
- ✅ Updated testing procedures
- ✅ Troubleshooting for all issues
- ✅ Ready to implement

**Next:** Read the guides and add code to your app

---

**Let's Go! 🚀**
