# REF-V2-005: Simulator Environment Adaptation - Complete

**Status:** ✅ READY FOR SIMULATOR TESTING  
**Date:** 2026-02-01  
**Environment:** iOS/Android Simulators (No Physical Device)

---

## 📋 Summary of Changes

All manual testing guide documentation has been updated to be **simulator-compatible**. The previous push-notification-focused approach has been replaced with a **database-first verification strategy**.

### Files Updated

**REF-V2-005-MANUAL-TESTING-GUIDE.md** (Primary Update)
- ✅ Added simulator limitations section at top
- ✅ Test Case 1 (Invite Accepted) - Converted to SQL verification + manual navigation
- ✅ Test Case 2 (Rewards Granted) - Converted to SQL verification + manual navigation
- ✅ Test Case 3 (Welcome Bonus) - Converted to SQL verification + manual navigation
- ✅ Test Case 4 (Subscription Gating) - Already SQL-based (no change needed)
- ✅ Test Case 5 (Mark as Read) - Already SQL-based (no change needed)
- ✅ Test Case 6 (Deep Links) - Converted to deep link data verification + manual nav
- ✅ Test Case 7 (Realtime) - Converted to realtime code inspection + manual INSERT
- ✅ Test Case 8 (Admin Config) - Converted to config verification + manual trigger
- ✅ Test Case 9 (Preferences) - Converted to preferences table check + optional testing

### Files Created

**REF-V2-005-SIMULATOR-TESTING-GUIDE.md** (New Quick Start)
- ✅ 5-minute quick test procedure
- ✅ Pre-testing checklist
- ✅ Troubleshooting guide
- ✅ Simulator vs. physical device comparison table
- ✅ Phase 2 planning notes

---

## 🔄 Testing Strategy Shift

### Before (Physical Device Focus)
```
Event Triggers
      ↓
Push Notification Sent
      ↓
Device Receives Push
      ↓
Tap Notification
      ↓
Deep Link Navigation
      ↓
Verify Screen Content
```

### After (Simulator Database-First)
```
Event Triggers
      ↓
Database Trigger Fires
      ↓
Notification Row Created
      ↓
SQL Query Verification
      ↓
Manual Screen Navigation
      ↓
Verify UI Content (if implemented)
```

---

## ✅ What Simulators CAN Test

- ✅ Database schema and triggers
- ✅ RLS policies
- ✅ Notification data structure
- ✅ SP amount calculations
- ✅ Subscription gating logic
- ✅ Deep link data structure (not the tap)
- ✅ Realtime subscriptions (if UI implements them)
- ✅ Admin config integration
- ✅ Notification preferences storage (if table exists)
- ✅ Read status updates
- ✅ Manual screen navigation

---

## ❌ What Simulators CANNOT Test

- ❌ Push notification delivery
- ❌ Real APNs/FCM token generation
- ❌ Notification center appearance (simulator shows placeholder)
- ❌ Tap-to-deep-link from notification
- ❌ Background notification handling

**Note:** These will be tested in Phase 2 with physical devices.

---

## 📝 Testing Procedure (Step-by-Step)

### Before You Start
1. [ ] Apply migration to Supabase: `supabase/migrations/175_referral_notifications_v2.sql`
2. [ ] Build mobile app: `npm run build`
3. [ ] Start iOS Simulator or Android Simulator
4. [ ] Create test users (or reuse existing ones)
5. [ ] Open Supabase SQL Editor in separate browser tab

### Run Quick Test (5 minutes)
Follow **REF-V2-005-SIMULATOR-TESTING-GUIDE.md**:
1. Verify migration applied
2. Trigger one referral event
3. Check database for notification row
4. Confirm title and body correct

### Run Full Test Suite (30 minutes)
Follow **REF-V2-005-MANUAL-TESTING-GUIDE.md**:
1. Complete all 9 test cases
2. Check each verification query
3. Mark pass/fail for each case
4. Note any issues found

### Regression Tests
- [ ] Existing referrals not broken
- [ ] No duplicate notifications created

### Cleanup
```sql
DELETE FROM user_notifications 
WHERE created_at > 'YYYY-MM-DD HH:MM:SS';
```

---

## 🎯 Key Changes Per Test Case

| Test Case | Change | Why |
|-----------|--------|-----|
| 1. Invite Accepted | Push → SQL verification | Simulator can't receive push |
| 2. Rewards Granted | Push → SQL verification | Simulator can't receive push |
| 3. Welcome Bonus | Push → SQL verification | Simulator can't receive push |
| 4. Subscription Gating | No change | Already SQL-based |
| 5. Mark as Read | No change | Already SQL-based |
| 6. Deep Links | Tap → Data verification + manual nav | Simulator deep links unreliable |
| 7. Realtime | Realtime → Code inspection + manual INSERT | Focus on subscription code |
| 8. Admin Config | Manual UI → SQL verification | Config stored in DB |
| 9. Preferences | App settings → SQL verification | Optional MVP feature |

---

## 📊 Verification Results Template

After running each test case, use this template:

```
## Test Case X: [Name]

**Result:** ✅ PASS / ❌ FAIL

**Database Checks:**
- [ ] Query 1 executed successfully
- [ ] Query 2 returned expected results
- [ ] Query 3 (if any) passed

**SQL Results:**
```
[Paste actual SQL output here]
```

**Notes:**
[Any observations or issues]

---

**Evidence:**
- Screenshot of SQL Editor with query
- Console output from mobile app (if relevant)
```

---

## 🚀 Next Steps

### Immediate (Do Now)
1. [ ] Apply migration to Supabase
2. [ ] Review REF-V2-005-SIMULATOR-TESTING-GUIDE.md
3. [ ] Run 5-minute quick test
4. [ ] Report if issues found

### Short Term (This Week)
1. [ ] Complete all 9 test cases
2. [ ] Document results
3. [ ] Fix any bugs found
4. [ ] Prepare Phase 2 planning

### Medium Term (Next Sprint)
1. [ ] Test with physical device (iOS + Android)
2. [ ] Verify push notifications work
3. [ ] Test deep link tapping from notifications
4. [ ] Implement notification preferences UI (if needed)

### Long Term (Optimization)
1. [ ] Notification analytics
2. [ ] A/B testing notification text
3. [ ] Notification scheduling
4. [ ] Advanced preferences (quiet hours, digest mode)

---

## 📚 Documentation Files

All documentation is in the repo root:

- **REF-V2-005-SIMULATOR-TESTING-GUIDE.md** ← Start here (5-min guide)
- **REF-V2-005-MANUAL-TESTING-GUIDE.md** ← Comprehensive (9 test cases + regression)
- **REF-V2-005-IMPLEMENTATION-SUMMARY.md** ← Architecture details
- **REF-V2-005-QUICK-REFERENCE.md** ← Command cheat sheet

Also available:
- `supabase/migrations/175_referral_notifications_v2.sql` - Database schema
- `p2p-kids-marketplace/src/services/referralNotifications.ts` - Service layer
- `p2p-kids-marketplace/src/services/__tests__/referralNotifications.test.ts` - Unit tests
- `p2p-kids-marketplace/src/__tests__/e2e/referral-notifications.e2e.ts` - E2E tests

---

## ✨ Tier 0 Quality Gate

Before marking work complete, run:

```bash
# Mobile app type checking
cd p2p-kids-marketplace
npm typecheck
npm lint

# Database migration verification
supabase db lint supabase/migrations/175_referral_notifications_v2.sql
```

Expected results:
- ✅ No TypeScript errors
- ✅ No ESLint warnings
- ✅ SQL syntax valid

---

## 🎉 Success Criteria

REF-V2-005 is **COMPLETE** when:

- ✅ Migration applied to Supabase production
- ✅ All 9 test cases PASS on simulator
- ✅ Database records created automatically via triggers
- ✅ All SQL verification queries return expected results
- ✅ Deep link data is correct (ready for Phase 2 device testing)
- ✅ No database errors or warnings
- ✅ Tier 0 quality gates pass
- ✅ Documentation complete and tested

---

## 📞 Support

If you encounter issues:

1. **Check Troubleshooting section** in REF-V2-005-MANUAL-TESTING-GUIDE.md
2. **Verify migration applied** with: `SELECT * FROM user_notifications LIMIT 1;`
3. **Check Supabase logs** for trigger errors
4. **Review SQL syntax** for ambiguous columns or missing table references
5. **Confirm test user setup** with referral codes and subscriptions

---

**Document Status:** ✅ Complete and Ready  
**Last Updated:** 2026-02-01  
**Next Review:** After Phase 1 testing complete

