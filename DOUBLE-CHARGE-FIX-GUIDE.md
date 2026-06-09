# Double-Charge Bug Fix Guide

## Problem Summary

**User Report**: "Buyers are being charged twice - once at offer stage and another time when trade completed"

**Screenshot Evidence**: SP History shows duplicate "Spend Purchase" entries within minutes of each other (e.g., two -35 SP entries at 1:05 PM and 12:59 PM for the same trade).

**Root Cause**: The `fn_release_all_sp_on_complete()` trigger creates a **duplicate** `sp_ledger` entry when a trade completes, even though the buyer's SP was already deducted and logged at offer creation time.

### How It Happened

1. **Offer Creation** (CORRECT):
   - Trigger: `fn_reserve_sp_on_offer()`
   - Action: Deducts SP from `available_balance` → `reserved_sp`
   - Logging: Creates `sp_ledger` entry with `transaction_type='spend_purchase'` ✅

2. **Trade Completion** (BUG):
   - Trigger: `fn_release_all_sp_on_complete()`
   - Action: Moves `reserved_sp` → 0, increments `lifetime_spent` ✅
   - Logging: Creates **ANOTHER** `sp_ledger` entry with `transaction_type='spend_purchase'` ❌
   - Result: User sees **TWO** "Spend Purchase" entries in SP History

### Impact

- **User-facing**: Buyers see duplicate charges in SP History (confusing, looks like a bug)
- **Data integrity**: `sp_ledger` has duplicate entries for same transaction
- **Wallet balance**: **NOT affected** (balance was only deducted once, at reservation)
- **Severity**: HIGH (user trust issue, appears as payment bug)

---

## Files Changed

### 1. `supabase/migrations/20260607000002_hotfix_format_specifiers.sql`

**Lines 90-133** — Removed duplicate `sp_ledger` INSERT

**Before**:
```sql
IF v_buyer_sp > 0 AND NEW.sp_reserved_at IS NOT NULL THEN
  -- ... wallet updates ...
  
  -- ❌ BUG: This creates a duplicate entry
  INSERT INTO public.sp_ledger (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after, description,
    related_transaction_id, created_at
  ) VALUES (
    v_buyer_wallet_id, NEW.buyer_id, 'spend_purchase', -v_buyer_sp,
    v_buyer_balance_before, v_buyer_balance_after,
    'Swap Points spent on trade #' || NEW.id,
    NEW.id, now()
  );
END IF;
```

**After**:
```sql
IF v_buyer_sp > 0 AND NEW.sp_reserved_at IS NOT NULL THEN
  UPDATE public.sp_wallets w
  SET
    reserved_sp = GREATEST(0, w.reserved_sp - v_buyer_sp),
    lifetime_spent = w.lifetime_spent + v_buyer_sp,
    updated_at = now()
  WHERE w.id = v_buyer_wallet_id;
  
  -- ✅ FIX: No sp_ledger entry here — already created at reservation time
END IF;
```

---

## Deployment Steps

### Prerequisites
- Supabase CLI installed and authenticated
- Access to Supabase SQL Editor
- Backup of `sp_ledger` table (recommended)

### Step 1: Apply Migration Fix

```bash
# Navigate to project root
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Apply the corrected migration
supabase db push
```

**OR** via Supabase SQL Editor:
1. Open Supabase Dashboard → SQL Editor
2. Open `supabase/migrations/20260607000002_hotfix_format_specifiers.sql`
3. Run the entire file (it's idempotent)

### Step 2: Clean Up Existing Duplicate Entries

Run `cleanup-duplicate-sp-charges.sql` to remove historical duplicates:

```bash
# Via Supabase CLI
supabase db execute --file cleanup-duplicate-sp-charges.sql

# OR paste into Supabase SQL Editor
```

**Expected Output**:
```
NOTICE:  Found X duplicate SP charge entries to remove
NOTICE:  ✅ Cleanup successful - no duplicate entries remain
```

### Step 3: Verify Fix

Run verification queries (included at bottom of `cleanup-duplicate-sp-charges.sql`):

**Query 1**: Check for remaining duplicates
```sql
SELECT 
  user_id,
  related_transaction_id,
  COUNT(*) as entry_count
FROM public.sp_ledger
WHERE 
  transaction_type = 'spend_purchase'
  AND related_transaction_id IS NOT NULL
GROUP BY user_id, related_transaction_id
HAVING COUNT(*) > 1;
```
**Expected**: 0 rows

**Query 2**: Verify 1:1 mapping (trades ↔ ledger entries)
```sql
SELECT 
  COUNT(DISTINCT t.id) as completed_trades_with_sp,
  COUNT(sl.id) as spend_purchase_entries,
  COUNT(DISTINCT t.id) - COUNT(sl.id) as difference
FROM public.trades t
LEFT JOIN public.sp_ledger sl ON (
  sl.related_transaction_id = t.id 
  AND sl.transaction_type = 'spend_purchase'
)
WHERE t.sp_amount > 0;
```
**Expected**: difference = 0

### Step 4: Test in App

1. Create a new offer using SP (e.g., buyer offers 30 SP)
2. Seller accepts and completes trade
3. Check buyer's SP History
4. **Expected**: ONE "Spend Purchase" entry (at offer time) ✅
5. **Not Expected**: TWO "Spend Purchase" entries ❌

---

## Testing Checklist

### Pre-Deployment
- [ ] Migration file syntax is valid (no SQL errors)
- [ ] Cleanup script tested on staging database
- [ ] Backup of `sp_ledger` table created

### Post-Deployment
- [ ] Migration applied successfully
- [ ] Cleanup script removed duplicate entries
- [ ] Verification queries show no duplicates
- [ ] New trades create only ONE ledger entry
- [ ] Existing trades unaffected by cleanup
- [ ] User SP balances remain correct

### End-to-End Test
- [ ] Buyer creates offer with 20 SP
- [ ] SP History shows: -20 SP "Spend Purchase" (1 entry)
- [ ] Seller accepts offer
- [ ] Trade completes
- [ ] SP History shows: Still only 1 entry (no new duplicate)
- [ ] Seller receives SP correctly
- [ ] Both wallets show correct balances

---

## Rollback Plan

If issues occur after deployment:

### Rollback Migration

```sql
-- Restore previous version of fn_release_all_sp_on_complete()
-- from migration: 20260606000001_fix_sp_ledger_missing_on_trade_complete.sql

CREATE OR REPLACE FUNCTION public.fn_release_all_sp_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
-- (Paste original function code from backup)
$$;
```

### Verify Rollback

```sql
-- Check function source
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'fn_release_all_sp_on_complete';

-- Confirm it contains the INSERT INTO sp_ledger for buyer
-- (You'll see duplicate entries resume, but this proves rollback worked)
```

---

## Success Criteria

✅ **Migration applied** without errors  
✅ **Cleanup removed** all duplicate entries  
✅ **New trades** create only ONE `sp_ledger` entry per buyer  
✅ **SP History UI** shows single "Spend Purchase" entry per trade  
✅ **Wallet balances** remain accurate  
✅ **No user reports** of missing/incorrect SP amounts

---

## Technical Details

### Database Objects Modified

**Function**: `public.fn_release_all_sp_on_complete()`
- **Type**: TRIGGER function
- **Fires**: AFTER UPDATE ON `trades` (when status → 'completed')
- **Change**: Removed duplicate `sp_ledger` INSERT for buyer

**Table**: `public.sp_ledger`
- **Cleanup**: Removed duplicate `spend_purchase` entries
- **Criteria**: Same `related_transaction_id` + `user_id`, kept earliest entry

### Related Code (Unchanged)

**Function**: `fn_reserve_sp_on_offer()` (NO CHANGES)
- Still creates the FIRST (and only) `spend_purchase` entry ✅
- This is the correct behavior

**Edge Function**: `create-trade-offer/index.ts` (NO CHANGES)
- Triggers `fn_reserve_sp_on_offer()` automatically on INSERT

### Why This Fix is Safe

1. **Wallet balances unchanged**: Only `available_balance` deduction at reservation time counts
2. **Ledger cleanup is safe**: We only remove DUPLICATE entries (second occurrence)
3. **Forward-compatible**: New trades will never create duplicates
4. **Backward-compatible**: Old trades unaffected (cleanup handles historical data)
5. **Idempotent**: Running cleanup multiple times is safe (no duplicates = no deletions)

---

## Monitoring & Alerts

After deployment, monitor for:

### Key Metrics
- **Duplicate entry count** (should remain 0):
  ```sql
  SELECT COUNT(*) FROM (
    SELECT user_id, related_transaction_id
    FROM sp_ledger
    WHERE transaction_type = 'spend_purchase'
    GROUP BY user_id, related_transaction_id
    HAVING COUNT(*) > 1
  ) dupes;
  ```

- **Ledger entry rate** (should match trade completion rate):
  ```sql
  SELECT 
    COUNT(*) as new_ledger_entries,
    COUNT(DISTINCT related_transaction_id) as unique_trades
  FROM sp_ledger
  WHERE 
    transaction_type = 'spend_purchase'
    AND created_at > NOW() - INTERVAL '1 hour';
  ```

### Alert Conditions
- ⚠️ **If duplicate count > 0**: Trigger was not updated correctly
- ⚠️ **If ledger entries << completed trades**: Trigger may be failing
- ⚠️ **If user reports missing SP deductions**: Reservation trigger may have issues

---

## FAQ

**Q: Will this fix affect existing SP balances?**  
A: No. Wallet balances were always correct (only deducted once). This fix only removes duplicate LEDGER ENTRIES (UI display issue).

**Q: What happens to trades that already completed with duplicate entries?**  
A: The cleanup script removes the second entry. The first entry (at reservation time) remains, which is correct.

**Q: Will buyers see their SP refunded after cleanup?**  
A: No. Cleanup only removes duplicate ledger entries (which were display-only). No actual SP amounts change.

**Q: Can I run the cleanup multiple times?**  
A: Yes, it's idempotent. If no duplicates exist, it does nothing.

**Q: How do I verify a specific trade?**  
```sql
SELECT * FROM sp_ledger 
WHERE related_transaction_id = '<trade_id>'
  AND transaction_type = 'spend_purchase'
ORDER BY created_at;
-- Should show exactly 1 row after fix
```

---

## Related Issues

- **SP Mismatch Bug** (fixed 2026-06-07): Category multiplier not stored → wrong SP amount
- **Double Refund Bug** (fixed 2026-06-06): Similar pattern in `fn_release_sp_on_cancel()` 
- **Missing Ledger Entries** (fixed 2026-06-06): `fn_reserve_sp_on_offer()` wasn't logging

---

## Next Steps

1. ✅ Apply migration to staging
2. ✅ Run cleanup script on staging
3. ✅ Test end-to-end trade flow
4. ✅ Verify no new duplicates appear
5. ⏳ Deploy to production
6. ⏳ Monitor duplicate count for 24 hours
7. ⏳ Confirm zero user reports of double charges
