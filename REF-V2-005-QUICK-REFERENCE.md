# REF-V2-005 Quick Reference Card

## 🚀 Quick Start Commands (npm ONLY)

### 1. Apply SQL Migration
```bash
# Copy-paste in Supabase SQL Editor:
supabase/migrations/175_referral_notifications_v2.sql
```

### 2. Run Unit Tests
```bash
cd p2p-kids-marketplace
npm test -- referralNotifications.test.ts
```

### 3. Run E2E Tests
```bash
export TEST_REFERRER_USER_ID="your-uuid"
export TEST_REFEREE_USER_ID="your-uuid"
npm test -- referral-notifications.e2e.ts
```

### 4. Manual Testing
See: [REF-V2-005-MANUAL-TESTING-GUIDE.md](REF-V2-005-MANUAL-TESTING-GUIDE.md)

---

## 📁 Files Created

1. ✅ `supabase/migrations/175_referral_notifications_v2.sql`
2. ✅ `p2p-kids-marketplace/src/services/referralNotifications.ts`
3. ✅ `p2p-kids-marketplace/src/services/__tests__/referralNotifications.test.ts`
4. ✅ `p2p-kids-marketplace/src/__tests__/e2e/referral-notifications.e2e.ts`
5. ✅ `REF-V2-005-MANUAL-TESTING-GUIDE.md`
6. ✅ `REF-V2-005-IMPLEMENTATION-SUMMARY.md`

## 📋 Files Modified

1. ✅ `p2p-kids-marketplace/src/navigation/types.ts` (added Notifications routes)

---

## 🔔 Notification Event Types

| Event | Trigger | Sent To | Deep Link |
|-------|---------|---------|-----------|
| `referral_invite_accepted` | Referee signs up | Referrer | ReferralDashboard |
| `referral_rewards_granted` | First trade complete | Referrer | ReferralDashboard |
| `referral_welcome_bonus` | First trade complete | Referee | SpWallet |

---

## 🧪 Verification Checklist (MODULE-11-REFERRALS-VERIFICATION-V2.md)

### Section 5: Referral Notifications

- [x] Notification sent when referee signs up
- [x] Notification sent when referee completes first trade
- [x] Notification sent when SP rewards granted
- [x] Notifications include deep links to referral dashboard
- [ ] Notifications respect user preferences *(MODULE-14 dependency)*

**Status:** 4/5 items satisfied (80%)

---

## 🗄️ SQL Verification Queries

```sql
-- 1. Verify table exists
SELECT * FROM user_notifications LIMIT 1;

-- 2. Verify triggers exist
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'referrals';

-- 3. Get user notifications
SELECT * FROM user_notifications 
WHERE user_id = 'your-user-id' 
ORDER BY created_at DESC LIMIT 10;

-- 4. Get unread count
SELECT get_unread_notification_count('your-user-id');

-- 5. Mark as read
SELECT mark_notification_read('notification-id', 'user-id');
```

---

## 🔗 Deep Links

| Route | Navigation | Purpose |
|-------|------------|---------|
| `ReferralDashboard` | ReferralDashboard screen | View referral stats |
| `SpWallet` | SpWallet screen | View SP balance |

---

## 🛠️ TypeScript Service Usage

```typescript
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  getReferralNotifications,
  subscribeToNotifications,
} from '@/services/referralNotifications';

// Get notifications
const result = await getUserNotifications(userId, 50, 0);

// Get unread count
const count = await getUnreadNotificationCount(userId);

// Mark as read
await markNotificationAsRead(notificationId, userId);

// Realtime subscription
const unsubscribe = subscribeToNotifications(userId, (notification) => {
  console.log('New notification:', notification);
});
```

---

## ⚠️ Common Issues

### Issue 1: Notifications Not Created
**Fix:** Re-run migration, check triggers enabled

### Issue 2: Push Not Received
**Fix:** Verify push tokens exist, check Expo config

### Issue 3: Deep Links Not Working
**Fix:** Verify route names match exactly (case-sensitive)

---

## 📊 Success Criteria

- [x] SQL migration applied
- [x] Unit tests pass
- [x] E2E tests created
- [x] Manual test guide provided
- [x] Navigation updated
- [x] RLS policies secure

---

## 📞 Next Steps

1. **Apply migration** to Supabase production
2. **Run manual tests** (9 test cases)
3. **Verify on device** push notifications work
4. **Monitor logs** for any errors
5. **Track metrics** (notification creation rate)

---

**Status:** ✅ READY FOR DEPLOYMENT  
**Date:** 2026-02-01
