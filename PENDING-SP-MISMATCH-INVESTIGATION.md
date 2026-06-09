# Pending SP Mismatch Investigation & Fix

## 🔍 Issue Summary

**Observed Behavior:**
- Review Offer screen shows: **11 SP** (correct per new formula)
- SP Wallet screen shows: **13 SP pending** (discrepancy of 2 SP)

**Expected Behavior:**
- Both screens should show the same pending SP amount

---

## 🧐 Root Cause Analysis

The discrepancy likely comes from one of these scenarios:

### Scenario A: Old Formula Already Deployed
1. Migration **20260606** with WRONG formula was deployed to staging
2. A trade was completed using the wrong formula:
   - Item: $15, buyer offers 10 SP, multiplier 1.10
   - **WRONG formula**: `platform_sp = FLOOR($15 × 0.25 × 1.10) = 4 SP`
   - **Total to seller**: 10 SP (buyer) + 4 SP (platform) = **14 SP** ❌
3. Migration **20260607** with CORRECT formula was created but NOT YET deployed
4. New offer calculation uses the CORRECT formula from `spCalculatorService.ts`:
   - `total_sp = FLOOR(10 SP × 1.10) = 11 SP` ✅
5. Result: Wallet shows 14 SP (or multiple trades totaling 13 SP)

### Scenario B: Multiple Trades Contributing
- There might be 2+ completed trades contributing to the 13 SP total
- Each trade might have used different formulas (old vs new)

### Scenario C: Test Data Inconsistency
- Test database has stale data from manual SQL inserts
- Data doesn't match current formula logic

---

## 🛠️ Diagnostic Steps

### Step 1: Check Which Migration is Active

Run this SQL to see if migration 20260607 (correct formula) is deployed:

```sql
SELECT prosrc FROM pg_proc WHERE proname = 'fn_release_all_sp_on_complete';
```

**Look for:**
- ✅ CORRECT: `FLOOR(v_buyer_sp * v_category_multiplier)` (migration 20260607)
- ❌ WRONG: `FLOOR(((v_item_price_cents::numeric / 100) * 0.25) * v_category_multiplier)` (migration 20260606)

### Step 2: Find Trades Contributing to 13 SP

I've created a comprehensive debug script:

```bash
# Open Supabase SQL Editor and run:
cat debug-pending-sp-mismatch.sql
```

This will show:
1. Which migration is active
2. User with 13 SP pending
3. All completed trades contributing to pending balance
4. Ledger entries showing formula used
5. Current pending offers

---

## 🔧 Fix Options

### Option 1: Reset Test Data (Simplest)

If this is staging/test data, the cleanest fix is to reset:

```sql
-- ⚠️ USE WITH CAUTION - Deletes ALL test data
BEGIN;
  DELETE FROM sp_ledger WHERE transaction_type = 'earn_reward';
  UPDATE sp_wallets SET pending_balance = 0, lifetime_earned = 0, lifetime_spent = 0;
  UPDATE trades SET sp_earned_at_completion = 0, pending_sp_release_at = NULL;
COMMIT;
```

### Option 2: Recalculate Past Trades (Production-Safe)

If you need to preserve trade history and fix the SP amounts:

```bash
# Run the fix script (in transaction):
cat fix-pending-sp-amounts.sql
```

**What it does:**
1. Identifies trades with wrong SP amounts
2. Recalculates using CORRECT formula
3. Updates `sp_wallets.pending_balance`
4. Updates `trades.sp_earned_at_completion`
5. Updates `sp_ledger` descriptions with `[RECALCULATED]` tag
6. Shows preview before commit (manual review required)

**Safety:**
- ✅ Runs in transaction (can ROLLBACK)
- ✅ Shows preview of changes before commit
- ✅ Only affects pending SP (not yet released)
- ✅ Marks ledger entries as `[RECALCULATED]`

### Option 3: Document & Proceed (If Close to Production)

If the discrepancy is small (2 SP) and this is test data:
1. Document the issue
2. Ensure migration 20260607 is deployed going forward
3. Accept that some test users have slightly wrong pending SP
4. Reset test data before production launch

---

## 🎯 Recommended Action Plan

### For Staging Environment:

**Step 1: Deploy Migration 20260607**
```bash
# Apply the corrected migration
supabase db push
# Or via Supabase Dashboard SQL Editor
```

**Step 2: Run Diagnostic**
```sql
-- Run debug-pending-sp-mismatch.sql to identify the issue
```

**Step 3: Choose Fix Based on Findings**

If test data:
```sql
-- Option 1: Reset (simplest)
-- Run the DELETE/UPDATE queries above
```

If preserving data matters:
```sql
-- Option 2: Recalculate
-- Run fix-pending-sp-amounts.sql
```

**Step 4: Verify Fix**
1. Complete a new test trade
2. Verify SP amount matches formula: `FLOOR(buyer_sp × multiplier)`
3. Check wallet pending balance is correct

### For Production Environment:

**⚠️ DO NOT RESET DATA**

Must use Option 2 (recalculation script) if wrong formula was already deployed.

---

## 📊 Example Calculations

### Correct Formula (Migration 20260607):

| Item Price | Buyer Offers | Multiplier | Formula | Result |
|-----------|--------------|------------|---------|--------|
| $15 | 10 SP + $5 | 1.10× | FLOOR(10 × 1.10) | **11 SP** ✅ |
| $15 | $15 cash | 1.10× | FLOOR(15 × 1.10) | **16 SP** ✅ |

### Wrong Formula (Migration 20260606):

| Item Price | Buyer Offers | Multiplier | Formula | Result |
|-----------|--------------|------------|---------|--------|
| $15 | 10 SP + $5 | 1.10× | 10 + FLOOR(15 × 0.25 × 1.10) | **14 SP** ❌ |
| $15 | $15 cash | 1.10× | 0 + FLOOR(15 × 0.25 × 1.10) | **4 SP** ❌ |

---

## 🧪 Verification Checklist

After applying fix:

- [ ] Migration 20260607 deployed to staging
- [ ] Run diagnostic script to identify affected trades
- [ ] Run fix script if needed (or reset test data)
- [ ] Create new test trade: $15 item, buyer offers 10 SP, 1.10× multiplier
- [ ] Verify Review Offer screen shows: **11 SP**
- [ ] Complete the trade
- [ ] Verify wallet pending balance increases by: **11 SP** (not 14 SP)
- [ ] Check ledger description shows: `"buyer 10 SP × 1.10 multiplier"`
- [ ] Wait 3 days (or manually trigger release)
- [ ] Verify available balance increases by: **11 SP**

---

## 📝 Files Created

1. **debug-pending-sp-mismatch.sql**
   - Comprehensive diagnostic queries
   - Identifies which formula is active
   - Shows all trades contributing to pending SP
   - Helps understand where 13 SP came from

2. **fix-pending-sp-amounts.sql**
   - Production-safe recalculation script
   - Runs in transaction with manual review
   - Fixes past trades with wrong formula
   - Preserves trade history

---

## 💡 Why This Happened

The issue occurred because:

1. **Two migrations created**: 20260606 (wrong formula) and 20260607 (correct formula)
2. **UI updated independently**: `spCalculatorService.ts` was fixed with correct formula
3. **Timing mismatch**: If migration 20260606 ran first and completed a trade, then UI was updated, we get:
   - Database: 13-14 SP (wrong formula from old migration)
   - UI preview: 11 SP (correct formula from updated service)

This is a classic **data vs code version skew** issue common during phased deployments.

---

## 🚀 Next Steps

1. **Run diagnostic**: Use `debug-pending-sp-mismatch.sql` to understand the exact state
2. **Report findings**: Let me know which scenario matches (A, B, or C)
3. **Apply fix**: Based on findings, choose Option 1 (reset) or Option 2 (recalculate)
4. **Verify**: Complete the verification checklist above
5. **Deploy to production**: Only after staging verification passes

Would you like me to help run the diagnostic queries?
