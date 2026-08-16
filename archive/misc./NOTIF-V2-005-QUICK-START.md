# NOTIF-V2-005 Quick Start Guide

**Task:** Push Notification Delivery Engine  
**Time to Test:** ~30 minutes

---

## 🚀 Quick Deploy (3 Steps)

### Step 1: Apply SQL Migration (Supabase)

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copy the entire content of: `supabase/migrations/202_push_delivery_engine_v2.sql`
3. Paste and run
4. Verify success (should see "Success. No rows returned"):

```sql
-- Verification query
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('push_delivery_log', 'notification_deduplication', 'notification_retry_queue');
-- Expected: 3 rows
```

### Step 2: Install Dependencies

```bash
cd p2p-kids-marketplace
npm install
```

### Step 3: Test in Simulator

```bash
# iOS Simulator
npm start
# Press 'i' for iOS

# OR Android Emulator
npm start
# Press 'a' for Android
```

---

## 🧪 Quick Manual Test (5 Minutes)

1. **Log in to app**
2. **Navigate:** Profile tab → Settings button → Scroll to "Test Push Notification"
3. **Tap button 1 time**
   - ✅ Expected: "Test Notification Sent ✅" alert
   - ✅ Expected: Notification appears on device in 5-10 seconds

4. **Tap button 10 more times (rapidly)**
   - ✅ Expected: First 9 succeed
   - ✅ Expected: 10th shows "Rate Limited ⏱️"

5. **Done!** Core functionality verified.

---

## 📋 Full Test Coverage (Optional - 30 Minutes)

Follow: `NOTIF-V2-005-MANUAL-TESTING-GUIDE.md`

---

## ✅ Accept Criteria Checklist

From task acceptance criteria:

- [ ] Push tokens stored and updated on login  
  → Verify: Settings → "Enable Push Notifications" → Check `push_tokens` table

- [ ] Rate limiting enforced (10 notifications/hour per user)  
  → Verify: Tap test button 11 times → 11th blocked

- [ ] Quiet hours respected (no push notifications 10pm-8am)  
  → Verify: Set quiet hours in Supabase → Tap test button → Blocked

- [ ] Duplicate notifications prevented (5-minute window)  
  → Verify: Tap test button twice rapidly → Only 1 notification arrives

- [ ] Failed push deliveries retried up to 3 times  
  → Verify: Check `notification_retry_queue` table after simulated failure

- [ ] Push notification receipts tracked  
  → Verify: Check `push_delivery_log` table for `expo_receipt_id`

---

## 🐛 If Something Fails

1. **Check migration applied:**
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' 
     AND routine_name = 'check_push_rate_limit';
   -- Should return 1 row
   ```

2. **Check dependency installed:**
   ```bash
   npm list expo-server-sdk
   # Should show: expo-server-sdk@3.10.0
   ```

3. **Check logs:**
   ```bash
   # iOS: Xcode console
   # Android: npm run logs:android
   ```

4. **Common issues:**
   - "No push tokens registered" → Run "Enable Push Notifications" first
   - Migration error → Drop tables and re-run migration
   - Type errors → Run `npm run typecheck` to see exact errors

---

## 📄 Key Files

- SQL Migration: `supabase/migrations/202_push_delivery_engine_v2.sql`
- Service: `p2p-kids-marketplace/src/services/pushDelivery.ts`
- Tests: `p2p-kids-marketplace/src/services/__tests__/pushDelivery.test.ts`
- Manual Guide: `NOTIF-V2-005-MANUAL-TESTING-GUIDE.md`
- Implementation Summary: `NOTIF-V2-005-IMPLEMENTATION-SUMMARY.md`

---

## 🎯 Success Criteria

✅ Migration applied without errors  
✅ Test notification sends successfully  
✅ Rate limiting blocks 11th notification  
✅ All tables created (push_delivery_log, notification_deduplication, notification_retry_queue)  
✅ Unit tests pass (`npm run test:unit`)

**If all above pass → READY FOR PRODUCTION** 🚀

---

## Next Task

After NOTIF-V2-005 is verified, continue to:
- **NOTIF-V2-006:** In-App Notification Center UI
- Or next task in MODULE-14-NOTIFICATIONS-V2.md

---

**Need Help?**  
- Check full implementation summary: `NOTIF-V2-005-IMPLEMENTATION-SUMMARY.md`
- Check manual test guide: `NOTIF-V2-005-MANUAL-TESTING-GUIDE.md`
- Check verification file: `Prompts/MODULE-14-VERIFICATION-V2.md` Section 5
