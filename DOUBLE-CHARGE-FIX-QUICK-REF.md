# Double-Charge Bug Fix - Quick Reference

## What Was Broken
Buyers see **TWO** "Spend Purchase" entries in SP History for the same trade (e.g., -35 SP charged twice).

## Root Cause
The completion trigger `fn_release_all_sp_on_complete()` was creating a duplicate `sp_ledger` entry, even though the buyer's SP was already deducted and logged at offer creation time.

**Timeline:**
1. Offer created → `fn_reserve_sp_on_offer()` logs `spend_purchase` ✅
2. Trade completed → `fn_release_all_sp_on_complete()` logs ANOTHER `spend_purchase` ❌

## Files Fixed

### 1. `supabase/migrations/20260607000002_hotfix_format_specifiers.sql`
- ✅ Removed duplicate `sp_ledger` INSERT in buyer section (lines 90-133)
- ✅ Added comment explaining why it was removed
- ✅ Pattern matches `fn_release_sp_on_cancel()` (which fixed same bug)

### 2. `cleanup-duplicate-sp-charges.sql` (NEW)
- ✅ Identifies and removes historical duplicate entries
- ✅ Safe to run multiple times (idempotent)
- ✅ Includes verification queries

## Deploy Commands

```bash
# 1. Apply migration fix
supabase db push

# 2. Clean up existing duplicates
supabase db execute --file cleanup-duplicate-sp-charges.sql

# 3. Verify no duplicates remain
# Run verification queries from cleanup script
```

## Verify Fix

```sql
-- Should return 0 rows (no duplicates)
SELECT 
  user_id,
  related_transaction_id,
  COUNT(*) as entry_count
FROM sp_ledger
WHERE 
  transaction_type = 'spend_purchase'
  AND related_transaction_id IS NOT NULL
GROUP BY user_id, related_transaction_id
HAVING COUNT(*) > 1;
```

## Test in Simulator

1. Create offer with 20 SP
2. Check SP History → should show: **-20 SP** (1 entry) ✅
3. Seller accepts and completes trade
4. Check SP History → should STILL show: **-20 SP** (1 entry) ✅
5. **NOT**: Two -20 SP entries ❌

## What This Fixes

✅ **New trades**: Only ONE ledger entry per buyer  
✅ **UI display**: No more duplicate "Spend Purchase" entries  
✅ **User trust**: SP History matches actual deductions  
⚠️ **Old duplicates**: Cleanup script removes them  

## Safe to Deploy?

YES - Backward compatible:
- Wallet balances unchanged (were always correct)
- Only removes duplicate UI entries
- Cleanup is idempotent

## Impact

- **Wallet balances**: ✅ NO CHANGE (were already correct)
- **SP ledger**: ✅ Duplicate entries removed
- **User experience**: ✅ SP History shows correct charges
- **Data integrity**: ✅ Improved (1:1 mapping)

## Questions?

See full guide: `DOUBLE-CHARGE-FIX-GUIDE.md`
