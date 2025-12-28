# 🚀 QUICK START: Admin Config Phase 1 - What to Do Next

**TL;DR**: Code is done ✅ → Deploy migrations → Test → Move to Phase 2

---

## 🎯 Your Next Actions (In Order)

### 1️⃣ Deploy Migrations to Supabase (5 minutes)
```bash
# Go to: https://drntwgporzabmxdqykrp.supabase.co/project/default/sql/new
# Copy-paste these two SQL files:

1. supabase/migrations/20251216_fix_rpc_admin_config_schema.sql
   (if not already deployed)
2. supabase/migrations/20250117_fix_hardcoded_trial_days.sql
   (NEW - must run)

# Run each one in Supabase SQL Editor
# Expected: No errors, both functions created/updated
```

### 2️⃣ Test Trial Enrollment Works (10 minutes)
**See**: `ADMIN-CONFIG-TESTING-CHECKLIST.md` → "Test A: Trial Enrollment with Default Config"

Quick test:
```
1. App: Signup → phone verify → profile → Subscription Choice screen
2. Verify: "30-Day Free Trial" shows (or whatever config value is)
3. Verify: "Spend Swap Points (up to 50%)" shows SP percentage dynamically
4. Click "Try Free Trial"
5. Verify: Trial created in database with correct end date
6. Verify: No errors in console
```

### 3️⃣ Test Admin Config Changes Propagate (5 minutes)
**See**: `ADMIN-CONFIG-TESTING-CHECKLIST.md` → "Test B & C"

Quick test:
```
1. Admin portal: Change trial_period_days from 30 → 14
2. Save (should see success message)
3. App: Logout completely
4. App: Create NEW account
5. Verify: "14-Day Free Trial" shows (not 30-day)
```

### 4️⃣ Run All Tests (see Checklist)
- ✅ Test A: Default values work
- ✅ Test B: Trial days change propagates
- ✅ Test C: SP percentage changes propagate
- ✅ Regression A-D: Everything still works

### 5️⃣ Approve & Move to Phase 2
When all tests pass → ready to tackle fee calculations!

---

## 📁 Key Files You'll Need

| File | Purpose | Action |
|------|---------|--------|
| `ADMIN-CONFIG-TESTING-CHECKLIST.md` | How to test | **READ THIS FIRST** |
| `supabase/migrations/20250117_fix_hardcoded_trial_days.sql` | Run in Supabase | Deploy |
| `p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx` | App code | Already updated |
| `p2p-kids-marketplace/src/services/adminConfig.ts` | Service layer | Already created |
| `ADMIN-CONFIG-IMPLEMENTATION-ROADMAP.md` | Future phases | Reference for Phase 2 |

---

## ❓ FAQ

**Q: Do I need to rebuild the app?**  
A: Yes, rebuild the app after the code changes are in place

**Q: Will this break existing users?**  
A: No, all changes are backward compatible. Defaults are in place.

**Q: What if a test fails?**  
A: See debugging section in ADMIN-CONFIG-TESTING-CHECKLIST.md

**Q: Can I skip Phase 2?**  
A: No, fees are critical. Phase 2 must be done before release.

**Q: How long is Phase 2?**  
A: ~1 week (fee service, edge functions, testing)

---

## 📊 What Changed

**In SubscriptionChoiceScreen.tsx:**
- ✅ Added dynamic SP percentage fetch
- ✅ Removed hardcoded "50%"
- ✅ Added cache invalidation on screen focus

**In Migrations:**
- ✅ Created migration to fix RPC function
- ✅ Trial now uses configurable duration instead of hardcoded 30

**Result**: Admin can change prices/trial/SP% without code deploy! 🎉

---

## 🎯 Success Looks Like

✅ All tests pass  
✅ Admin portal changes show on app immediately (after cache refresh)  
✅ No console errors  
✅ Trial enrollments work with configurable duration  
✅ SP percentage displays dynamically  

---

## 🔧 If Something Breaks

**Migration won't run?**
- Check: Admin_config table exists
- Check: Columns are correct (key, value, data_type, is_active)
- Check: RPC functions don't already exist with same name

**Tests fail?**
- Check: Migrations deployed
- Check: Admin_config table has data
- Check: App rebuilt with latest code

**SP percentage doesn't change?**
- Check: Cache invalidation working (`invalidateConfigCache()` called)
- Check: adminConfig service getting fresh data
- Check: Admin portal actually saved the change

**Still need help?** → See ADMIN-CONFIG-TESTING-CHECKLIST.md for detailed debugging

---

## 🚀 Ready to Get Started?

1. ✅ Read the testing checklist
2. ✅ Deploy the migration
3. ✅ Run tests
4. ✅ Report back results!

**Estimated time**: 30 minutes total (including testing)

---

**Questions?** See the comprehensive docs or debugging section in testing checklist!
