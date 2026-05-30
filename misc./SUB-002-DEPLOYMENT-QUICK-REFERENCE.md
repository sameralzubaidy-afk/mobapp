---
title: SUB-002 Dynamic Fees - Quick Deployment Guide
date: 2025-02-14
type: Quick Reference
estimated_time: 5 minutes
---

# Quick Deployment: Dynamic Transaction Fees

## Pre-Flight Check ✈️

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# 1. Verify migration file exists
ls supabase/migrations/20260214000001_dynamic_transaction_fees_from_admin_config.sql
# Output: supabase/migrations/20260214000001_dynamic_transaction_fees_from_admin_config.sql

# 2. Verify TypeScript service updated
grep -n "await getTransactionFee(userId)" p2p-kids-marketplace/src/services/subscription.ts
# Output: Should show updated line in getSubscriptionSummary()

# 3. Verify no TypeScript errors
cd p2p-kids-marketplace && yarn typecheck
# Expected: No errors
# If errors exist: fix before deploying migration
```

---

## Deploy to Supabase (2 steps)

### Step 1: Push Migration

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Deploy the migration
supabase db push

# Expected output:
# → Validating migrations
# → Pushing migrations
# → Migration 20260214000001_dynamic_transaction_fees_from_admin_config.sql ✓
```

**What this does:**
- ✅ Adds two new config keys to `admin_config` table
- ✅ Updates `get_user_transaction_fee()` RPC to read from config
- ✅ Falls back to defaults (99, 299) if config missing

---

### Step 2: Verify Deployment

**In Supabase SQL Editor:**

```sql
-- Check 1: Config keys exist
SELECT key, value, is_active
FROM public.admin_config
WHERE key LIKE 'transaction_fee%'
ORDER BY key;

-- Expected:
-- transaction_fee_non_subscriber_cents | 299 | true
-- transaction_fee_subscriber_cents | 99 | true
```

```sql
-- Check 2: RPC works with trial user
SELECT public.get_user_transaction_fee('ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb');
-- Expected: 99
```

```sql
-- Check 3: RPC works with free user (create one or use existing)
-- First find a free user:
SELECT user_id, status FROM subscriptions WHERE status = 'free' LIMIT 1;

-- Then test RPC with that user_id:
SELECT public.get_user_transaction_fee('<USER_ID_FROM_ABOVE>');
-- Expected: 299
```

**All checks passed? ✅ Continue to Step 3**

---

## Deploy to Mobile App (1 step)

### Step 3: Pull and Test

```bash
cd p2p-kids-marketplace

# Pull latest code (if you haven't committed yet)
git pull origin main

# Install dependencies
yarn install

# Typecheck
yarn typecheck
# Expected: No errors

# Run subscription tests
yarn test subscription.test.ts
# Expected: All tests pass

# Optional: Run specific test for dynamic fees
yarn test TC-SUB002-008
# Expected: All assertions pass
```

---

## Manual Testing (5 minutes)

### In Supabase SQL Editor

**Test 1: Verify Dynamic Behavior**

```sql
-- Step 1: Update fee to new value
UPDATE public.admin_config
SET value = '150'
WHERE key = 'transaction_fee_subscriber_cents';

-- Step 2: Get fee (should return 150, not 99)
SELECT public.get_user_transaction_fee('ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb');
-- Expected: 150 ← PROVES it's reading from admin_config

-- Step 3: Restore to original
UPDATE public.admin_config
SET value = '99'
WHERE key = 'transaction_fee_subscriber_cents';

-- Step 4: Get fee again
SELECT public.get_user_transaction_fee('ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb');
-- Expected: 99
```

✅ **PASS** if Step 2 returns 150 (not 99)

---

### In React Native App

**Test 2: Fee in Subscription Summary**

```typescript
// In app console or test file:
import { getSubscriptionSummary } from './services/subscription';

const summary = await getSubscriptionSummary('ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb');
console.log('Transaction fee:', summary.transaction_fee_cents);
// Expected: 99 (should match admin_config value)
```

✅ **PASS** if matches admin_config value

---

## Rollback (If Needed)

### Quick Rollback (Disable Dynamic Fees)

```sql
-- Disables dynamic fee queries; RPC falls back to defaults (99/299)
UPDATE public.admin_config
SET is_active = FALSE
WHERE key IN ('transaction_fee_subscriber_cents', 'transaction_fee_non_subscriber_cents');

-- Verify:
SELECT public.get_user_transaction_fee('ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb');
-- Expected: 99 (fallback default)
```

### Full Rollback (Revert Migration)

```bash
# In terminal:
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Revert migration
supabase db reset  # Careful! This resets your LOCAL database

# Or in Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Run: DROP TABLE IF EXISTS admin_config; (restores old version)
# 3. Re-apply older migrations only
```

---

## Deployment Checklist

- [ ] **Pre-flight:** Migration file exists
- [ ] **Pre-flight:** TypeScript compiles (`yarn typecheck`)
- [ ] **Step 1:** Migration deployed (`supabase db push`)
- [ ] **Step 2:** Config keys exist in admin_config
- [ ] **Step 2:** RPC returns correct fees
- [ ] **Step 3:** TypeScript typecheck passes
- [ ] **Step 3:** Subscription tests pass
- [ ] **Manual Test:** Dynamic fee update works (Step 2 returns updated fee)
- [ ] **Manual Test:** App displays correct fee
- [ ] ✅ **DEPLOYED**

---

## Support References

| Issue | Solution |
|-------|----------|
| Migration won't apply | Check: `supabase status` → restart if needed → `supabase db push` |
| Config keys missing | Run migration again: `supabase db push --dry-run` → check output |
| RPC returns wrong fee | Verify config keys: `SELECT * FROM admin_config WHERE key LIKE 'transaction_fee%'` |
| TypeScript errors | Run: `yarn typecheck` (fix before migrating) |
| Tests failing | Check: RPC updated correctly, service calling it properly |

---

## Verification Links

- **Full Implementation Details:** See `SUB-002-DYNAMIC-TRANSACTION-FEES-IMPLEMENTATION.md`
- **Test Cases:** See `TC-SUB002-008-DYNAMIC-TRANSACTION-FEES-TESTING.md`
- **Migration File:** `supabase/migrations/20260214000001_dynamic_transaction_fees_from_admin_config.sql`
- **TypeScript Changes:** `p2p-kids-marketplace/src/services/subscription.ts`

---

## Done? 🎉

Once both checks pass:

1. ✅ Config keys exist in Supabase
2. ✅ RPC returns updated fees
3. ✅ TypeScript compiles
4. ✅ Tests pass

**You're ready for production!**

To enable admin fee updates (if UI doesn't exist yet):
- Admins can edit `admin_config` directly in Supabase Dashboard
- Or add admin UI form to update these two config keys

---

## Summary

- **Migration:** `20260214000001_dynamic_transaction_fees_from_admin_config.sql` (94 lines)
- **Service update:** `subscription.ts` - 2 sections updated
- **Deployment time:** ~5 minutes
- **Rollback time:** ~2 minutes
- **Status:** ✅ Ready to deploy
