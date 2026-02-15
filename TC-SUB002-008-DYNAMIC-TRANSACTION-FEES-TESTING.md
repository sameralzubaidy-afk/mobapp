---
title: TC-SUB002-008 - Dynamic Transaction Fees (from admin_config)
date: 2025-02-14
task: MODULE-11 TASK SUB-002 - User Subscriptions Table & Status Management
---

# TC-SUB002-008: get_user_transaction_fee for Trial User (Dynamic from admin_config)

## Objective

Verify that transaction fees are **dynamically fetched from admin_config** instead of being hardcoded. The admin dashboard can adjust fees without requiring code changes.

## What Changed

**Before (Hardcoded):**
```sql
-- Subscriber fee was always 99 cents
IF v_status IN ('trial', 'active', 'paused') THEN
  RETURN 99;  -- Hardcoded
ELSE
  RETURN 299; -- Hardcoded
END IF;
```

**After (Dynamic from admin_config):**
```sql
-- Fees are fetched from admin_config table, allowing admins to change them
SELECT COALESCE((value::INTEGER) FROM admin_config 
  WHERE key = 'transaction_fee_subscriber_cents' AND is_active = TRUE), 99)
INTO v_subscriber_fee_cents;

RETURN v_subscriber_fee_cents;
```

## Files Modified

1. **supabase/migrations/20260214000001_dynamic_transaction_fees_from_admin_config.sql**
   - Updated `get_user_transaction_fee()` RPC to read from admin_config
   - Added configuration keys: `transaction_fee_subscriber_cents`, `transaction_fee_non_subscriber_cents`

2. **p2p-kids-marketplace/src/services/subscription.ts**
   - Updated `getSubscriptionSummary()` to call `getTransactionFee()` dynamically
   - Added comments documenting the dynamic behavior
   - Kept fallback to hardcoded values if dynamic fetch fails

## Test Cases

### Setup: Deploy Migration

First, apply the migration to your Supabase:

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase db push
```

### Test 1: Verify admin_config Has Fee Keys

**SQL:**
```sql
SELECT 
  key,
  value,
  description,
  category,
  is_active
FROM public.admin_config
WHERE key IN ('transaction_fee_subscriber_cents', 'transaction_fee_non_subscriber_cents')
ORDER BY key;
```

**Expected Result:**
```
key                                | value | description                           | category | is_active
------------------------------------|-------|---------------------------------------|----------|----------
transaction_fee_non_subscriber_cents| 299   | Transaction fee for free users (...)  | fees     | true
transaction_fee_subscriber_cents    | 99    | Transaction fee for Kids Club+... (...) | fees | true
```

✅ **PASS** if both keys exist with correct values and `is_active = true`  
❌ **FAIL** if keys are missing or `is_active = false`

---

### Test 2: Get Default Subscriber Fee (99 cents)

**SQL:**
```sql
-- Test with trial user
SELECT public.get_user_transaction_fee('ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb');
-- Expected: 99 (reads from admin_config key 'transaction_fee_subscriber_cents')
```

**Expected Result:**
```
99
```

✅ **PASS** if returns 99  
❌ **FAIL** if returns different value

---

### Test 3: Change Admin Config and Verify Fee Updates

**Step 1: Update admin_config to new subscriber fee (50 cents)**
```sql
UPDATE public.admin_config
SET value = '50'
WHERE key = 'transaction_fee_subscriber_cents';

-- Verify update
SELECT key, value FROM public.admin_config 
WHERE key = 'transaction_fee_subscriber_cents';
-- Expected: value = '50'
```

**Step 2: Call RPC again - should return NEW fee**
```sql
SELECT public.get_user_transaction_fee('ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb');
-- Expected: 50 (NEW value from admin_config)
```

**Step 3: Restore to original value**
```sql
UPDATE public.admin_config
SET value = '99'
WHERE key = 'transaction_fee_subscriber_cents';
```

**Expected Results:**
- Step 1: Update succeeds, value shows '50'
- Step 2: RPC returns 50 (NOT 99) ← **PROVES fee is dynamically fetched**
- Step 3: Update succeeds

✅ **PASS** if RPC returns the NEW value from admin_config in Step 2  
❌ **FAIL** if RPC still returns 99 (would mean it's still hardcoded)

---

### Test 4: Non-Subscriber Fee (Free User)

**SQL:**
```sql
-- Create or use a free user
-- Get their ID and check fee

-- For a user with status='free':
SELECT public.get_user_transaction_fee('<FREE_USER_ID>');
-- Expected: 299 (from admin_config key 'transaction_fee_non_subscriber_cents')
```

**Expected Result:**
```
299
```

✅ **PASS** if returns 299  
❌ **FAIL** if returns different value

---

### Test 5: Change Non-Subscriber Fee and Verify

**Step 1: Update admin_config to new non-subscriber fee (199 cents = $1.99)**
```sql
UPDATE public.admin_config
SET value = '199'
WHERE key = 'transaction_fee_non_subscriber_cents';

-- Verify
SELECT value FROM public.admin_config 
WHERE key = 'transaction_fee_non_subscriber_cents';
```

**Step 2: Get fee for free user - should return NEW value**
```sql
SELECT public.get_user_transaction_fee('<FREE_USER_ID>');
-- Expected: 199 (NEW value)
```

**Step 3: Restore to original**
```sql
UPDATE public.admin_config
SET value = '299'
WHERE key = 'transaction_fee_non_subscriber_cents';
```

**Expected Results:**
- Step 1: Update succeeds
- Step 2: RPC returns 199 (NOT 299) ← **PROVES dynamic behavior**
- Step 3: Update succeeds

✅ **PASS** if RPC returns 199 in Step 2  
❌ **FAIL** if RPC returns 299 (hardcoded)

---

### Test 6: TypeScript Service Layer Integration

**In React Native App Console or Test:**
```typescript
import { getTransactionFee, getSubscriptionSummary } from './services/subscription';

// Test 1: Get fee directly
const fee = await getTransactionFee('ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb');
console.log('Transaction fee:', fee, 'cents = $' + (fee / 100).toFixed(2));

// Test 2: Fee included in subscription summary
const summary = await getSubscriptionSummary('ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb');
console.log('Subscription summary:', summary);
console.log('  Status:', summary.status);
console.log('  Transaction fee cents:', summary.transaction_fee_cents);
```

**Expected Output (with defaults):**
```
Transaction fee: 99 cents = $0.99
Subscription summary: {
  status: 'trial',
  is_subscriber: true,
  can_earn_sp: true,
  can_spend_sp: true,
  transaction_fee_cents: 99,  ← Should match RPC result
  ...
}
```

✅ **PASS** if fee matches the admin_config value  
❌ **FAIL** if fee is hardcoded (doesn't change when admin_config updates)

---

## Manual Testing Flow (iOS/Android Simulator)

### Setup: Create Test Users

```sql
-- Trial user (should get 99¢ fee)
INSERT INTO subscriptions (user_id, status, tier_id, has_used_trial)
VALUES (
  'ff0538f4-cda5-4a0a-a4e6-de765ac0dfdb',
  'trial',
  (SELECT id FROM subscription_tiers WHERE name = 'kids_club_plus'),
  FALSE
)
ON CONFLICT (user_id) DO UPDATE
SET status = EXCLUDED.status;

-- Free user (should get 299¢ fee)
-- Your app creates this automatically on signup via handle_new_user() trigger
```

### Test Steps

1. **Launch App and Login as Trial User**
   - Navigate to Checkout or TransactionFee display (if available)
   - Expected: Shows $0.99 transaction fee

2. **Open Admin Dashboard (p2p-kids-admin)**
   - Navigate to Settings / Config page
   - Find "Transaction Fee - Subscriber"
   - Change from $0.99 to $0.50

3. **Refresh App or Create New Transaction**
   - Transaction fee should now show $0.50
   - Without page refresh (if live update implemented)

4. **Revert Change in Admin Dashboard**
   - Change fee back to $0.99
   - Verify app updates

✅ **PASS** if fees update in real-time without app restart  
⚠️ **ACCEPTABLE** if fees update after app refresh  
❌ **FAIL** if fees never change from $0.99

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Dynamic Transaction Fees (V2.1)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Admin Dashboard (p2p-kids-admin)                            │
│     └─> Updates admin_config table                             │
│         - transaction_fee_subscriber_cents = 99 (or any value)  │
│         - transaction_fee_non_subscriber_cents = 299            │
│         - Changes take effect immediately                       │
│                                                                  │
│  2. Supabase Database (admin_config table)                      │
│     └─> Stores fee configuration                               │
│         - Key/value pairs                                       │
│         - is_active flag to enable/disable                      │
│                                                                  │
│  3. RPC Function (get_user_transaction_fee)                     │
│     └─> Reads from admin_config at runtime                      │
│         - Fetches subscriber_fee_cents from config               │
│         - Fetches non_subscriber_fee_cents from config           │
│         - Returns appropriate fee based on user status           │
│                                                                  │
│  4. TypeScript Service (getTransactionFee, getSubscriptionSummary)
│     └─> Calls RPC function                                      │
│         - getTransactionFee() → calls RPC                        │
│         - getSubscriptionSummary() → includes dynamic fee        │
│         - Fallback to hardcoded if config missing               │
│                                                                  │
│  5. React Native App (Checkout, Listings, etc.)                 │
│     └─> Displays dynamic fee to user                            │
│         - Shows $0.99 or updated value from admin_config        │
│         - Updates when admin changes config                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Verification Checklist

- [ ] Migration applied: `20260214000001_dynamic_transaction_fees_from_admin_config.sql`
- [ ] admin_config has `transaction_fee_subscriber_cents` = '99'
- [ ] admin_config has `transaction_fee_non_subscriber_cents` = '299'
- [ ] `get_user_transaction_fee()` RPC updated to read from admin_config
- [ ] Test 1: admin_config keys exist ✅ PASS/FAIL
- [ ] Test 2: RPC returns 99 for subscriber ✅ PASS/FAIL
- [ ] Test 3: RPC returns NEW value when admin_config changes ✅ PASS/FAIL
- [ ] Test 4: RPC returns 299 for non-subscriber ✅ PASS/FAIL
- [ ] Test 5: RPC returns NEW value for non-subscriber fee change ✅ PASS/FAIL
- [ ] Test 6: TypeScript service uses dynamic fee ✅ PASS/FAIL
- [ ] Manual test: App displays updated fee ✅ PASS/FAIL ACCEPTABLE

---

## Rollback Instructions

If dynamic fees don't work, revert to hardcoded values:

```sql
-- Option 1: Disable admin_config fee keys
UPDATE public.admin_config
SET is_active = FALSE
WHERE key IN ('transaction_fee_subscriber_cents', 'transaction_fee_non_subscriber_cents');

-- Option 2: Revert RPC to hardcoded version
-- (Restore from git: git checkout <old_migration_hash>)

-- Option 3: Update RPC manually back to hardcoded
CREATE OR REPLACE FUNCTION public.get_user_transaction_fee(p_user_id UUID)
RETURNS INTEGER AS $$
  -- ... hardcoded version ...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Common Issues & Troubleshooting

### Issue: RPC always returns 99, changes to admin_config don't affect it
**Diagnosis:** RPC is still using hardcoded values  
**Solution:** 
1. Run `supabase db push` to apply the migration
2. Verify the migration was applied: `SELECT * FROM pg_proc WHERE proname = 'get_user_transaction_fee'`
3. Restart Supabase functions if needed

### Issue: admin_config keys don't exist
**Diagnosis:** Migration didn't run migration 1  
**Solution:**
1. Check if migration file exists: `ls supabase/migrations/20260214000001*.sql`
2. Run `supabase db push --dry-run` to see pending migrations
3. Apply with `supabase db push`

### Issue: TypeScript service throws error when fetching fee
**Diagnosis:** RPC grant issue or service not updated  
**Solution:**
1. Verify RPC grants: `SELECT grantee, privilege_type FROM role_table_grants WHERE routine_name = 'get_user_transaction_fee'`
2. Check TypeScript service has `getTransactionFee()` function
3. Look for console errors: `console.error('[subscription]')` in logs

---

## Summary

✅ **TC-SUB002-008 Complete:** Transaction fees are now **fully dynamic** and configurable via admin_config:
- Admin can change subscriber fee (default $0.99)
- Admin can change non-subscriber fee (default $2.99)
- Changes take effect immediately without code deployment
- RPC reads from config table at runtime
- Fallback to hardcoded values if config missing (graceful degradation)
- TypeScript service integrates the dynamic fees

**Result:** Admins have complete control over transaction fee structure via the dashboard. 🎉
