# 🚀 PAY-001 Quick Start Guide

**PLEASE READ THIS FIRST before testing**

---

## ⚡ What You Need to Do (3 Steps)

### Step 1: Apply Migration to Supabase Production ⭐ REQUIRED

1. Open your Supabase Dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **"+ New query"**
4. Copy the ENTIRE contents of this file:
   ```
   supabase/migrations/073_seller_payouts.sql
   ```
5. Paste into SQL Editor
6. Click **"Run"** button
7. Wait for success message ✅

**Expected result:** "Success. No rows returned"

---

### Step 2: Verify Migration Success ⭐ REQUIRED

1. In SQL Editor, open a new query
2. Copy the ENTIRE contents of this file:
   ```
   supabase/migrations/073_verify_payout_schema.sql
   ```
3. Paste and click **"Run"**
4. Review results from each step

**Expected results:**
- STEP 1: expected_2 = 2 ✅
- STEP 2: expected_17 = 17 ✅
- STEP 3: expected_18 = 18 ✅
- STEP 4: 5 indexes for methods, 8 for payouts ✅
- STEP 5: Both tables rowsecurity = true ✅
- STEP 6: 5 policies for methods, 4 for payouts ✅
- STEP 7: List of constraints ✅
- STEP 8: 2 triggers ✅

**If any step fails:** See Troubleshooting section below

---

### Step 3: Manual Testing (Optional but Recommended)

Follow the guide: `PAY-001-MANUAL-TEST-GUIDE.md`

This includes 11 detailed test cases to validate:
- Constraints work correctly
- RLS policies protect data
- Indexes improve performance
- Triggers update timestamps

---

## 🎯 Files You Created

| File | Purpose | Location |
|------|---------|----------|
| **Migration** | Creates tables, indexes, RLS | `supabase/migrations/073_seller_payouts.sql` |
| **Verification SQL** | Quick health check | `supabase/migrations/073_verify_payout_schema.sql` |
| **Types** | TypeScript definitions | `p2p-kids-marketplace/src/types/payout.types.ts` |
| **E2E Tests** | Automated validation | `p2p-kids-marketplace/src/__tests__/e2e/pay-001-schema.test.ts` |
| **Manual Tests** | Production test guide | `PAY-001-MANUAL-TEST-GUIDE.md` |
| **Summary** | Implementation details | `PAY-001-IMPLEMENTATION-SUMMARY.md` |

---

## ✅ Success Criteria

PAY-001 is COMPLETE when:

- [x] Migration applied successfully (Step 1)
- [x] Verification script passes all checks (Step 2)
- [ ] Manual tests pass (Step 3) - YOU MUST DO THIS
- [ ] E2E tests pass (Step 3) - OPTIONAL

---

## 🔧 Troubleshooting

### Problem: Migration fails with "relation already exists"
**Cause:** Migration was already run  
**Solution:** This is OK! Migration is idempotent. The tables are already there.

### Problem: Verification script shows wrong counts
**Cause:** Migration partially failed  
**Solution:** 
1. Check Supabase logs for errors
2. Re-run migration (it's safe to re-run)
3. Contact support if persists

### Problem: RLS policies not working in tests
**Cause:** User not authenticated  
**Solution:** 
1. Ensure you're signed in to the app
2. Check `auth.uid()` returns valid UUID
3. Verify user exists in `auth.users` table

### Problem: Tests fail with "network error"
**Cause:** Wrong Supabase URL or key  
**Solution:** Check `.env.local` has correct credentials

---

## 📋 Quick Reference: What PAY-001 Does

### Creates 2 Tables:

**1. seller_payout_methods**
- Stores seller payout method configs (Stripe/PayPal/Venmo/ACH)
- Enforces one primary method per user
- Tracks verification status

**2. seller_payouts**
- Payout ledger (one record per payout)
- Links to trades
- Tracks status (pending → processing → completed/failed)
- Enforces idempotency

### Adds Security:
- RLS policies (users see only their data)
- Admin policies (admins see all)
- Constraints (data validation)

### Optimizes Performance:
- 13 indexes for fast queries
- Triggers for auto-updates

---

## 🔗 Next Steps After PAY-001

Once PAY-001 is verified:

1. ✅ Update `MODULE-06-VERIFICATION-V2.md` checklist (Section A)
2. → Proceed to **PAY-002**: Payout Fee Model + Helpers
3. → Then **PAY-003**: Seller Payout Setup UI
4. → Then **PAY-004**: Stripe Connect Onboarding

---

## 💡 Tips

- **Don't panic if migration takes 5-10 seconds** - It's creating indexes
- **Verification script should run instantly** - If slow, check database load
- **Manual testing is CRITICAL** - Don't skip Step 3
- **Keep this guide open while testing** - Reference as needed

---

## 📞 Need Help?

**Common Issues:**
- Check `PAY-001-MANUAL-TEST-GUIDE.md` Troubleshooting section
- Review `PAY-001-IMPLEMENTATION-SUMMARY.md` for details

**Still Stuck?**
- Check Supabase Dashboard → Logs for errors
- Review migration file for any syntax issues
- Verify Supabase project is active and not paused

---

## ✨ You're Ready!

**Just 3 steps:**
1. Run migration SQL (5 minutes)
2. Run verification SQL (2 minutes)
3. Run manual tests (30 minutes)

**Total time:** ~40 minutes

Go to Step 1 now! 👆

---

**Status:** ⬜ Not Started  
**When complete, mark:** ✅ DONE

Good luck! 🚀
