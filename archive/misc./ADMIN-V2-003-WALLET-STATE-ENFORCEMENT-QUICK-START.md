# ADMIN-V2-003 Wallet State Enforcement — Quick Start Guide

**Date:** 2026-03-23  
**Task:** ADMIN-V2-003 SP Wallet State Enforcement (Security Fix)  
**Priority:** P0 (Security Critical)  

---

## 🎯 What Was Fixed

**Problem:** Admin can freeze/suspend wallets, but mobile app doesn't enforce it — users can still spend/earn SP from frozen/suspended wallets (security vulnerability).

**Solution:** 5-part fix enforcing wallet state at backend + frontend + UI layers.

---

## 📦 Files Changed (7 files)

### SQL Migrations (1):
- ✅ `supabase/migrations/20260323000001_enforce_wallet_state_on_spend_earn.sql` (NEW)

### Mobile App TypeScript (5):
- ✅ `p2p-kids-marketplace/src/types/user.ts` (UPDATED)
- ✅ `p2p-kids-marketplace/src/contexts/AuthContext.tsx` (UPDATED)
- ✅ `p2p-kids-marketplace/src/services/auth.ts` (UPDATED)
- ✅ `p2p-kids-marketplace/src/screens/auth/LandingScreen.tsx` (UPDATED)
- ✅ `p2p-kids-marketplace/src/screens/auth/LoginScreen.tsx` (UPDATED)
- ✅ `p2p-kids-marketplace/src/components/molecules/WalletWarningBanner.tsx` (NEW)

### Documentation (2):
- ✅ `docs/flow-registry.md` (UPDATED)
- ✅ `ADMIN-V2-003-WALLET-STATE-ENFORCEMENT-IMPLEMENTATION.md` (NEW — full details)

---

## ⚡ Quick Commands (Copy-Paste)

### Step 1: Apply SQL Migration (Local Supabase)

**Option A: Full Reset (Recommended for Dev)**
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase db reset
```

**Option B: Apply Single Migration**
```sql
-- Copy contents of supabase/migrations/20260323000001_enforce_wallet_state_on_spend_earn.sql
-- Paste into Supabase Dashboard → SQL Editor → Run
```

### Step 2: Verify Migration Applied

```sql
-- Check that all 4 functions were updated
SELECT proname FROM pg_proc WHERE proname IN (
  'debit_sp_for_trade',
  'earn_sp_for_trade',
  'can_user_spend_sp',
  'get_user_sp_wallet_summary'
);
-- Expected: 4 rows

-- Verify function signature (should return 5 columns now, not 4)
SELECT 
  proname,
  prosrc
FROM pg_proc 
WHERE proname = 'get_user_sp_wallet_summary';
-- prosrc should contain: wallet_state TEXT
```

### Step 3: Tier 0 Gates (Mobile App)

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# TypeScript compile check
npx tsc -p tsconfig.json --noEmit
# Expected: No errors (exit code 0)

# ESLint (will show pre-existing warnings, but no NEW errors)
npx eslint . --max-warnings 0
# Expected: No NEW errors from wallet_state changes
```

---

## 🧪 Manual Testing (End-to-End Verification)

### Test 1: Freeze Wallet Blocks SP Spending (Most Critical)

**Setup:**
1. Create/identify a test user with `available_balance >= 10` in `sp_wallets`
2. Note the user UUID: `test_user_id`

**Steps:**
```sql
-- 1. Verify user has active wallet with balance
SELECT user_id, state, available_balance 
FROM sp_wallets 
WHERE user_id = '<test_user_id>';
-- Expected: state='active', available_balance=10+

-- 2. Test that spend works BEFORE freeze
SELECT public.debit_sp_for_trade('<test_user_id>', gen_random_uuid(), 5);
-- Expected: {"success": true, "balance_after": <balance-5>, ...}

-- 3. Freeze the wallet (simulate admin action)
UPDATE sp_wallets SET state = 'frozen' WHERE user_id = '<test_user_id>';

-- 4. Test that spend is BLOCKED after freeze
SELECT public.debit_sp_for_trade('<test_user_id>', gen_random_uuid(), 5);
-- Expected: ERROR: Cannot spend SP: wallet is frozen. Please renew your subscription to restore access.

-- 5. Test RPC eligibility check
SELECT public.can_user_spend_sp('<test_user_id>');
-- Expected: FALSE (was TRUE before freeze)

-- 6. Restore to active for next test
UPDATE sp_wallets SET state = 'active' WHERE user_id = '<test_user_id>';
```

**Expected Results:**
- ✅ Active wallet: spend succeeds
- ✅ Frozen wallet: spend fails with clear error message
- ✅ `can_user_spend_sp()` returns FALSE when frozen

**What This Validates:** Backend enforcement (P0 — Security Critical)

---

### Test 2: Suspend Wallet Blocks SP Earning

**Steps:**
```sql
-- 1. Suspend the wallet
UPDATE sp_wallets SET state = 'suspended' WHERE user_id = '<test_user_id>';

-- 2. Test that earning is BLOCKED
SELECT public.earn_sp_for_trade('<test_user_id>', gen_random_uuid(), 15);
-- Expected: ERROR: Cannot earn SP: wallet is suspended. Contact support for assistance.

-- 3. Restore wallet
UPDATE sp_wallets SET state = 'active' WHERE user_id = '<test_user_id>';
```

**Expected Results:**
- ✅ Suspended wallet: earn fails with clear error message

**What This Validates:** Backend enforcement for earning (P0)

---

### Test 3: Mobile App AuthContext Wallet State Sync

**Prerequisites:**
- iOS simulator or physical device with mobile app running
- Test user logged in
- Metro bundler running

**Steps:**
1. **Freeze wallet via admin portal:**
   - Navigate to `http://localhost:3001/sp-wallet`
   - Search for test user UUID
   - Click "Frozen" button
   - Confirm success message

2. **Mobile app: Force session refresh:**
   - Kill mobile app (swipe up from app switcher)
   - Relaunch app
   - Watch Metro logs for: `[AUTH] 💰 SP spending eligibility:` log

3. **Verify AuthContext state:**
   - Expected log output:
     ```
     [AUTH] 💰 SP spending eligibility: {
       subscriptionStatus: 'trial' or 'active',
       wallet_state: 'frozen',
       canSpendSP: false
     }
     ```

4. **Navigate to checkout:**
   - Browse to an item that accepts SP
   - Tap item → "Buy Now"
   - Expected: SP slider should be DISABLED (or hidden)

5. **Restore wallet:**
   - Admin portal: Click "Active" button
   - Mobile app: Kill + relaunch
   - Checkout: SP slider should be ENABLED again

**Expected Results:**
- ✅ `can_spend_sp === false` when wallet is frozen
- ✅ SP slider disabled in checkout
- ✅ Log shows correct wallet_state

**What This Validates:** Frontend enforcement (P1 — UX Critical)

---

### Test 4: Admin Portal End-to-End (TC-011 + TC-013 Regression)

**Run existing manual test cases:**
```bash
# Open manual test guide
open docs/manual-verification/ADMIN-V2-003-SP-WALLET-MANUAL-TEST-CASES.md
```

**Re-run:**
- ✅ TC-011: Freeze Wallet (status changes in UI)
- ✅ TC-013: Suspend Wallet (status changes in UI)

**New Verification (not in original TCs):**
- After TC-011/TC-013: Attempt SP purchase in mobile app
- Expected: Backend error "Cannot spend SP: wallet is frozen/suspended"

**What This Validates:** Admin portal + backend enforcement work together

---

## 🚨 Troubleshooting

### Issue: "function get_user_sp_wallet_summary does not exist"
**Cause:** Base migration not applied  
**Fix:** Run `supabase db reset` or apply base migrations first

---

### Issue: TypeScript error "Property 'wallet_state' is missing"
**Cause:** Changes not compiled or stale cache  
**Fix:**
```bash
cd p2p-kids-marketplace
rm -rf node_modules/.cache
npx tsc -p tsconfig.json --noEmit
```

---

### Issue: SP slider still enabled despite frozen wallet
**Cause:** AuthContext not re-fetching wallet state  
**Fix:** Kill and relaunch app to force session refresh

---

### Issue: "ERROR: column w.state does not exist"
**Cause:** Migration 093 not applied (renamed status → state)  
**Fix:** Apply all migrations in order: `supabase db reset`

---

### Issue: Backend allows spending despite frozen wallet
**Cause:** New migration not applied  
**Fix:** Verify function was updated:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'debit_sp_for_trade';
-- Should contain: IF v_wallet_state = 'frozen' THEN RAISE EXCEPTION...
```

---

## ✅ Success Criteria

- ✅ SQL migration applies without errors
- ✅ All 4 RPCs return expected results in verification queries
- ✅ `npx tsc --noEmit` passes (no NEW errors)
- ✅ Test 1: Frozen wallet blocks SP spending (backend error)
- ✅ Test 2: Suspended wallet blocks SP earning
- ✅ Test 3: AuthContext logs show `wallet_state: 'frozen'` and `canSpendSP: false`
- ✅ Test 4: TC-011 + TC-013 still work (admin can freeze/suspend)
- ✅ No regression: TC-006 (add SP) still works

---

## 🔄 Rollback Plan (If Needed)

### If SQL Migration Fails:
```sql
-- Restore original RPCs from previous migrations
-- (Keep backups of migration 061 and fix_sub_002_final)
```

### If Mobile App Breaks:
```bash
cd p2p-kids-marketplace
git checkout HEAD -- src/types/user.ts
git checkout HEAD -- src/contexts/AuthContext.tsx
git checkout HEAD -- src/services/auth.ts
git checkout HEAD -- src/screens/auth/LandingScreen.tsx
git checkout HEAD -- src/screens/auth/LoginScreen.tsx
rm -rf src/components/molecules/WalletWarningBanner.tsx
npx tsc --noEmit  # Verify rollback succeeded
```

---

## 📚 Full Documentation

For complete implementation details, see:
- **Implementation Summary:** `ADMIN-V2-003-WALLET-STATE-ENFORCEMENT-IMPLEMENTATION.md`
- **Manual Test Cases:** `docs/manual-verification/ADMIN-V2-003-SP-WALLET-MANUAL-TEST-CASES.md`
- **Flow Registry:** `docs/flow-registry.md` (FLOW-30)

---

## 🎯 Pending Work (TODO)

### Immediate Next (P2 — UX Enhancement):
1. Add `WalletWarningBanner` to `src/screens/wallet/WalletScreen.tsx`
2. Add `WalletWarningBanner` to `src/screens/trade/CheckoutScreen.tsx`

**Usage Example:**
```tsx
import WalletWarningBanner from '@/components/molecules/WalletWarningBanner';
import { useAuth } from '@/contexts/AuthContext';

function WalletScreen() {
  const { session } = useAuth();
  
  return (
    <ScrollView>
      <WalletWarningBanner walletState={session?.wallet_state || 'inactive'} />
      {/* ... rest of wallet UI ... */}
    </ScrollView>
  );
}
```

---

**Questions? Issues?**  
Refer to full implementation doc: `ADMIN-V2-003-WALLET-STATE-ENFORCEMENT-IMPLEMENTATION.md`
