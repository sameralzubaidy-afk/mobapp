# 📋 MSG-006-009 Quick Reference Card (UPDATED)

## The Two Issues You Hit

### Issue 1: Push Tokens Not Registering
```sql
SELECT * FROM push_tokens;
→ No rows (empty table)
```
**Root Cause:** App code wasn't calling token registration function  
**Solution:** Add `initializePushNotifications()` to login flow  
**Guide:** [APP-CODE-PUSH-NOTIFICATIONS.md](APP-CODE-PUSH-NOTIFICATIONS.md)

### Issue 2: edge_logs Table Doesn't Exist
```sql
SELECT * FROM edge_logs WHERE ...
→ ERROR: relation "edge_logs" does not exist
```
**Root Cause:** Supabase doesn't have this table  
**Solution:** Use app console + Supabase Dashboard for verification  
**Guide:** [SIMULATOR-PUSH-SETUP-GUIDE.md](SIMULATOR-PUSH-SETUP-GUIDE.md)

---

## What You Need to Do (TL;DR)

### Step 1: Add Code (30 min)
```bash
# File 1: Copy service code
p2p-kids-marketplace/src/services/notifications.ts

# File 2: Update auth
p2p-kids-marketplace/src/contexts/AuthContext.tsx
# OR
p2p-kids-marketplace/src/screens/auth/LoginScreen.tsx

# Source: APP-CODE-PUSH-NOTIFICATIONS.md
```

### Step 2: Run App (5 min)
```bash
npm run ios
# OR
npm run android
```

### Step 3: Verify (5 min)
✅ Check console for: `[Notifications] Expo Push Token registered: ExponentPushToken[...]`  
✅ Check database:  `SELECT * FROM push_tokens;`  
✅ Check Supabase Dashboard: Edge Functions → send-push-notification → Recent Invocations

### Step 4: Test (1 hour)
Run all 15 test cases (6-1 through 9-4)  
Use: [MSG-006-009-COMPLETE-TESTING-GUIDE.md](MSG-006-009-COMPLETE-TESTING-GUIDE.md)

**Total Time: 2-2.5 hours**

---

## The Three Documents You Need

| Priority | Document | What | How Long |
|----------|----------|------|----------|
| 1️⃣ | [START-HERE.md](MSG-006-009-START-HERE.md) | Action plan | 10 min |
| 2️⃣ | [APP-CODE.md](APP-CODE-PUSH-NOTIFICATIONS.md) | Code to add | 15 min |
| 3️⃣ | [SIMULATOR-GUIDE.md](SIMULATOR-PUSH-SETUP-GUIDE.md) | Setup reference | 20 min |

---

## Quick Commands

### Verify Token Registration
```bash
# Check app console while running
npm run ios  # or npm run android

# Look for: "[Notifications] Expo Push Token registered: ExponentPushToken[...]"
```

### Check Database
```sql
-- Token registered?
SELECT user_id, token FROM push_tokens WHERE user_id = '<YOUR_ID>';

-- Should return: 1 row with ExponentPushToken[...]
```

### Test Edge Function
```sql
-- Send test message
INSERT INTO messages (
  id, trade_id, sender_id, content, created_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM trades LIMIT 1),
  '<SENDER_ID>',
  'Test push',
  NOW()
);

-- Check Supabase Dashboard:
-- Edge Functions → send-push-notification → Recent Invocations
```

### Check Cron Job
```sql
-- Is cron job running?
SELECT * FROM pg_cron.job;

-- How many times has it run?
SELECT * FROM pg_cron.job_run_details LIMIT 5;
```

---

## Success Checklist

- [ ] App console shows push token registered
- [ ] Token appears in push_tokens table
- [ ] Edge Function shows invocation in Supabase Dashboard
- [ ] No errors in app console
- [ ] Test case 6-1 passes
- [ ] Test case 6-2 passes
- [ ] Test case 6-3 passes
- [ ] Test cases 7-1 through 9-4 pass
- [ ] Email notifications work
- [ ] Delivery status checkmarks work
- [ ] Typing indicators work

---

## If Something Breaks

### Token Not Registering
```
1. Check app console for [Notifications] errors
2. Verify initializePushNotifications() is called
3. Verify supabase.from('push_tokens').upsert() works
4. Try: npm run ios --clean
```

### Can't Find Edge Function Logs
```
1. Go to Supabase Dashboard
2. Click Edge Functions (left sidebar)
3. Click send-push-notification
4. Go to "Recent Invocations" tab
5. Should show recent calls
```

### Supabase Connection Error
```
1. Check anon key in .env.local
2. Check RLS policies on push_tokens table
3. Verify migration 081 was applied
```

---

## All Documents at a Glance

```
📚 Documentation Index
├── 🎯 START HERE
│   ├── MSG-006-009-START-HERE.md ← Read first (10 min)
│   ├── MSG-006-009-FIXES-SUMMARY.md (10 min)
│   └── MSG-006-009-BEFORE-AND-AFTER.md (10 min)
│
├── 🛠️ IMPLEMENTATION
│   ├── SIMULATOR-PUSH-SETUP-GUIDE.md (20 min)
│   ├── APP-CODE-PUSH-NOTIFICATIONS.md (15 min)
│   └── MSG-006-009-NEXT-STEPS.md (10 min)
│
└── ✅ TESTING
    └── MSG-006-009-COMPLETE-TESTING-GUIDE.md (30 min)
```

---

## Key Insights

✅ **Push tokens are registered by app, not automatically**  
✅ **Edge Function logs are in Supabase Dashboard, not database**  
✅ **iOS Simulator can't display notifications, but flow works**  
✅ **Android Emulator needs FCM Server Key**  
✅ **All code is ready to copy, no modifications needed**

---

## Files You're Working With

| File | Location | Purpose |
|------|----------|---------|
| notifications.ts | src/services/ | NEW - Push token registration |
| AuthContext.tsx | src/contexts/ | EDIT - Call after login |
| LoginScreen.tsx | src/screens/auth/ | EDIT (optional) - Call after login |
| push_tokens | Database | VERIFY - Tokens stored here |
| send-push-notification | Edge Functions | VERIFY - Called by trigger |

---

## Expected Output (Copy-Paste Test)

### Test 6-1: Token Registration
```
1. npm run ios
2. Login with testuser@example.com
3. Check console: ✅ [Notifications] Expo Push Token registered: ExponentPushToken[abc...]
4. Query: SELECT * FROM push_tokens; 
5. Result: 1 row with token
✅ PASS
```

### Test 6-2: Push Notification Delivery
```
1. Send message from User A → User B
2. Check Edge Function logs (Supabase Dashboard)
3. Should show: {"success": true, "sent": 1}
✅ PASS
```

### Test 7-1: Email Notification
```
1. Send message, wait for cron job (hourly)
2. Check SendGrid Activity Log
3. Should show email sent
✅ PASS
```

---

## Minimal Setup (Skip Everything Else)

If you just want to make it work:

```typescript
// 1. Create notifications.ts (copy from APP-CODE.md)
// 2. Update AuthContext (copy initialization code)
// 3. Run: npm run ios
// 4. Check console for push token
// 5. Query database to verify
// Done!
```

**Time: 30 minutes**

---

## Full Understanding (Read Everything)

1. Read MSG-006-009-START-HERE.md
2. Read MSG-006-009-BEFORE-AND-AFTER.md
3. Read APP-CODE-PUSH-NOTIFICATIONS.md
4. Read SIMULATOR-PUSH-SETUP-GUIDE.md
5. Add code to app
6. Run all tests
7. Document results

**Time: 3-4 hours**

---

## One-Line Summary

**Add push token registration code to app's login flow, then verify in Supabase Dashboard**

---

## Next Action

→ Open [MSG-006-009-START-HERE.md](MSG-006-009-START-HERE.md)

---

**You've got this! 🚀**
