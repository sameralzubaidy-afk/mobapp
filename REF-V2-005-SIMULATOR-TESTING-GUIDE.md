# REF-V2-005: Simulator Testing Quick Start

**For iOS/Android Simulator Environments (No Physical Device)**

---

## 🎯 Quick Summary

Since you're testing with iOS/Android simulators instead of physical devices, the testing approach is **database-first** rather than push-notification-first.

### Testing Strategy:
1. **Apply migration** to Supabase (creates triggers and notification tables)
2. **Verify database records** are created automatically when events occur
3. **Verify in-app notifications** appear (if UI layer is implemented)
4. **Defer push notifications** to Phase 2 (requires physical device or simulator with full APNs/FCM setup)

---

## ✅ Pre-Testing Checklist

Before starting manual tests, ensure:

- [ ] Supabase migration applied (`175_referral_notifications_v2.sql`)
- [ ] Mobile app built: `npm run build` (or equivalent)
- [ ] iOS Simulator or Android Simulator running
- [ ] Test user accounts ready (Referrer + Referee)
- [ ] Access to Supabase SQL Editor for verification queries

---

## 🚀 Quick Test (5 minutes)

### Step 1: Verify Migration
```sql
-- Run in Supabase SQL Editor:
SELECT tablename FROM pg_tables 
WHERE tablename = 'user_notifications';

-- Expected: Returns user_notifications table
```

### Step 2: Trigger First Event (Invite Accepted)
1. User A (Referrer) logs in on simulator
2. User B (Referee) signs up with User A's referral code
3. Wait 2 seconds for trigger to fire

### Step 3: Verify Database Record
```sql
-- Run in Supabase SQL Editor:
SELECT type, title, body, is_read 
FROM user_notifications
WHERE type = 'referral_invite_accepted'
ORDER BY created_at DESC LIMIT 1;

-- Expected:
-- type: referral_invite_accepted
-- title: Your Invite Was Accepted! 🎉
-- is_read: false
```

### ✅ Success Criteria
- ✅ Migration applied
- ✅ Notification row created in DB
- ✅ Title and body correct
- ✅ is_read = false

---

## 🔄 Full Test Suite (30 minutes)

For comprehensive testing, follow **9 test cases** in the updated manual guide:

1. **Invite Accepted** - Verify referrer notification when referee signs up
2. **Rewards Granted** - Verify referrer gets SP when referee trades
3. **Welcome Bonus** - Verify referee gets SP when completing first trade
4. **Subscription Gating** - Verify rewards DON'T trigger if subscriptions expired
5. **Mark as Read** - Verify notification read status updates work
6. **Deep Links** - Verify notification data has correct deep link targets
7. **Realtime Subscription** - Verify realtime database updates (if UI implemented)
8. **Admin Config** - Verify SP amounts configurable from admin
9. **Preferences** - Verify notification preferences respected (if implemented)

**Each test case:** 2-5 minutes  
**All test cases:** ~30-45 minutes total

---

## 📝 Key Differences vs. Physical Device

| Aspect | Simulator | Physical Device |
|--------|-----------|-----------------|
| **Push Notifications** | ❌ Won't deliver | ✅ Will deliver |
| **Real Push Tokens** | ❌ Placeholder tokens | ✅ Real FCM/APNs tokens |
| **Database Records** | ✅ Created normally | ✅ Created normally |
| **In-App Notifications** | ✅ Can test UI | ✅ Can test UI |
| **Deep Links** | ✅ Test manually | ✅ Test by tapping |

---

## 🛠 Troubleshooting

### Issue: "No rows returned" for notifications

**Check 1:** Migration applied?
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'referrals';
-- Should show 2 triggers: referral_invite_accepted_trigger, referral_rewards_notification_trigger
```

**Check 2:** Trigger fired?
```sql
SELECT * FROM referrals ORDER BY created_at DESC LIMIT 1;
-- Verify recent referral created with status = 'pending'
```

**Check 3:** Trigger function has error?
```sql
-- Check trigger function definition:
SELECT pg_get_functiondef('public.notify_referral_invite_accepted()'::regprocedure);
```

---

## 📚 Full Documentation

For complete test procedures, see:
- **REF-V2-005-MANUAL-TESTING-GUIDE.md** - All 9 test cases with SQL queries
- **REF-V2-005-IMPLEMENTATION-SUMMARY.md** - Architecture details
- **REF-V2-005-QUICK-REFERENCE.md** - Command cheat sheet

---

## ✔️ Sign-Off

After completing all tests:

- [ ] All 9 test cases PASS
- [ ] No database errors in Supabase logs
- [ ] Notifications created automatically via triggers
- [ ] Deep links configured correctly
- [ ] Admin config used for SP amounts

---

**Next Phase (Requires Physical Device):**
- Push notification delivery testing
- Deep link tap testing from notifications
- Notification preferences in-app settings UI

