# Apply Corrective Script: Step-by-Step Guide

## 🎯 Objective

Recalculate SP amounts for past trades that used the wrong formula, fixing the pending SP discrepancy (13 SP showing instead of 11 SP).

---

## 📋 Prerequisites

- [ ] Access to Supabase Dashboard SQL Editor
- [ ] Staging database (DO NOT run on production yet)
- [ ] Backup recommended (optional but safe)

---

## 🔍 STEP 1: Run Diagnostic (Understand the Problem)

### 1.1 Check Which Formula is Active

Copy and paste this in Supabase SQL Editor:

```sql
SELECT 
  proname AS function_name,
  CASE 
    WHEN prosrc LIKE '%FLOOR(v_buyer_sp * v_category_multiplier)%' THEN '✅ CORRECT (20260607)'
    WHEN prosrc LIKE '%FLOOR(((v_item_price_cents::numeric / 100) * 0.25) * v_category_multiplier)%' THEN '❌ WRONG (20260606)'
    ELSE '⚠️ UNKNOWN'
  END AS formula_status
FROM pg_proc 
WHERE proname = 'fn_release_all_sp_on_complete';
```

**Expected Result:**
- ✅ If shows "CORRECT (20260607)" → Migration already deployed
- ❌ If shows "WRONG (20260606)" → Need to deploy migration 20260607 first
- ⚠️ If shows "UNKNOWN" → Function doesn't exist or formula changed

**👉 Action:** Note the result here: ___________________

---

### 1.2 Find User with 13 SP Pending

```sql
SELECT 
  u.id AS user_id,
  u.email,
  w.pending_balance,
  w.available_balance,
  w.lifetime_earned,
  w.lifetime_spent
FROM auth.users u
JOIN sp_wallets w ON w.user_id = u.id
WHERE w.pending_balance = 13
ORDER BY w.updated_at DESC;
```

**Expected Result:**
- Should show the test user from the screenshots

**👉 Copy the `user_id` here:** ___________________

---

### 1.3 Find Trades Contributing to 13 SP

**⚠️ IMPORTANT:** Replace `<user-id>` below with the actual user_id from Step 1.2

```sql
SELECT 
  t.id AS trade_id,
  t.status,
  t.sp_amount AS buyer_used_sp,
  t.sp_earned_at_completion,
  t.sp_category_multiplier,
  t.completed_at,
  i.price AS item_price,
  i.title AS item_title,
  -- Calculate what it SHOULD be:
  CASE 
    WHEN t.sp_amount > 0 THEN 
      FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10))
    ELSE 
      FLOOR((i.price::numeric) * COALESCE(t.sp_category_multiplier, 1.10))
  END AS correct_sp,
  -- Calculate the difference:
  CASE 
    WHEN t.sp_amount > 0 THEN 
      FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10))
    ELSE 
      FLOOR((i.price::numeric) * COALESCE(t.sp_category_multiplier, 1.10))
  END - t.sp_earned_at_completion AS sp_difference
FROM trades t
JOIN items i ON i.id = t.listing_id
WHERE t.seller_id = '<user-id>'  -- ⚠️ REPLACE THIS
  AND t.status = 'completed'
  AND t.sp_earned_at_completion > 0
  AND t.pending_sp_release_at IS NOT NULL
ORDER BY t.completed_at DESC;
```

**Expected Result:**
- Should show 1+ trades
- Look at `sp_difference` column: 
  - **Negative number** (e.g., -2) = current SP is too high (used wrong formula)
  - **Positive number** (e.g., +2) = current SP is too low
  - **Zero** (0) = SP is already correct

**👉 Total SP difference:** ___________________

---

### 1.4 Check Ledger Descriptions

**⚠️ IMPORTANT:** Replace `<user-id>` with the actual user_id

```sql
SELECT 
  l.id,
  l.amount,
  l.description,
  l.created_at
FROM sp_ledger l
WHERE l.user_id = '<user-id>'  -- ⚠️ REPLACE THIS
  AND l.transaction_type = 'earn_reward'
ORDER BY l.created_at DESC
LIMIT 5;
```

**Expected Result:**
- Look at `description` column
- If it shows wrong formula like: "Trade reward: 13 SP (buyer 10 SP × 1.10 multiplier)"
  - ❌ This is WRONG (should be 11 SP, not 13 SP)
- If it shows correct formula like: "Trade reward: 11 SP (buyer 10 SP × 1.10 multiplier)"
  - ✅ This is CORRECT

---

## 🛠️ STEP 2: Apply the Fix (Runs in Transaction)

### ⚠️ CRITICAL SAFETY RULES

1. **Review the output** from Step 1 first
2. **DO NOT SKIP** the transaction review
3. **Start with BEGIN** (this starts a transaction)
4. **Review changes** before commit
5. **ROLLBACK if anything looks wrong**
6. **COMMIT only if everything is correct**

---

### 2.1 Start Transaction and Identify Trades to Fix

Copy and paste this entire block:

```sql
BEGIN;

-- Create temp table with trades needing correction
CREATE TEMP TABLE trades_to_fix AS
SELECT 
  t.id AS trade_id,
  t.seller_id,
  t.sp_amount AS buyer_sp,
  t.sp_earned_at_completion AS current_sp_earned,
  i.price AS item_price,
  COALESCE(t.sp_category_multiplier, 1.10) AS multiplier,
  -- Calculate CORRECT SP amount
  CASE 
    WHEN t.sp_amount > 0 THEN 
      FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10))
    ELSE 
      FLOOR((i.price::numeric) * COALESCE(t.sp_category_multiplier, 1.10))
  END AS correct_sp_earned,
  -- Calculate difference
  CASE 
    WHEN t.sp_amount > 0 THEN 
      FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10))
    ELSE 
      FLOOR((i.price::numeric) * COALESCE(t.sp_category_multiplier, 1.10))
  END - t.sp_earned_at_completion AS sp_difference
FROM trades t
JOIN items i ON i.id = t.listing_id
WHERE t.status = 'completed'
  AND t.sp_earned_at_completion > 0
  AND t.pending_sp_release_at IS NOT NULL
  AND t.sp_released_at IS NULL  -- Still pending
  -- Filter for trades with wrong SP amount
  AND t.sp_earned_at_completion != (
    CASE 
      WHEN t.sp_amount > 0 THEN 
        FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10))
      ELSE 
        FLOOR((i.price::numeric) * COALESCE(t.sp_category_multiplier, 1.10))
    END
  );

-- Show what will be fixed
SELECT * FROM trades_to_fix;
```

**👉 CHECKPOINT 1:** Review the output

- How many trades will be fixed? ___________
- Do the `correct_sp_earned` values look right? ___________
- Do the `sp_difference` values make sense? ___________

**🚨 If anything looks wrong, run:** `ROLLBACK;` **and STOP**

---

### 2.2 Update Wallets

```sql
-- Update pending_balance for affected sellers
UPDATE sp_wallets w
SET 
  pending_balance = w.pending_balance + COALESCE(
    (SELECT SUM(sp_difference) 
     FROM trades_to_fix 
     WHERE seller_id = w.user_id
     GROUP BY seller_id),
    0
  ),
  lifetime_earned = w.lifetime_earned + COALESCE(
    (SELECT SUM(sp_difference) 
     FROM trades_to_fix 
     WHERE seller_id = w.user_id
     GROUP BY seller_id),
    0
  ),
  updated_at = now()
WHERE w.user_id IN (SELECT DISTINCT seller_id FROM trades_to_fix);

-- Show updated wallets
SELECT 
  u.email,
  w.pending_balance AS new_pending,
  w.lifetime_earned AS new_lifetime,
  w.updated_at
FROM sp_wallets w
JOIN auth.users u ON u.id = w.user_id
WHERE w.user_id IN (SELECT DISTINCT seller_id FROM trades_to_fix);
```

**👉 CHECKPOINT 2:** Review the output

- Does the new pending_balance look correct? ___________
- Example: If was 13 SP and difference is -2, should now be 11 SP
- Does the new lifetime_earned make sense? ___________

**🚨 If anything looks wrong, run:** `ROLLBACK;` **and STOP**

---

### 2.3 Update Trades

```sql
-- Update trades.sp_earned_at_completion
UPDATE trades t
SET 
  sp_earned_at_completion = ttf.correct_sp_earned,
  updated_at = now()
FROM trades_to_fix ttf
WHERE t.id = ttf.trade_id;

-- Show updated trades
SELECT 
  t.id,
  t.sp_earned_at_completion AS new_sp_earned,
  ttf.current_sp_earned AS old_sp_earned,
  ttf.sp_difference
FROM trades t
JOIN trades_to_fix ttf ON ttf.trade_id = t.id;
```

**👉 CHECKPOINT 3:** Review the output

- Do the new_sp_earned values match correct_sp_earned from Step 2.1? ___________
- Example: 10 SP × 1.10 = 11 SP (not 13-14 SP)

**🚨 If anything looks wrong, run:** `ROLLBACK;` **and STOP**

---

### 2.4 Update Ledger

```sql
-- Update sp_ledger entries
UPDATE sp_ledger l
SET 
  amount = ttf.correct_sp_earned,
  balance_after = l.balance_before + ttf.correct_sp_earned,
  description = CASE 
    WHEN ttf.buyer_sp > 0 THEN 
      format('Trade reward: %s SP (buyer %s SP × %.2f multiplier) [RECALCULATED]', 
             ttf.correct_sp_earned, ttf.buyer_sp, ttf.multiplier)
    ELSE
      format('Trade reward: %s SP (price $%.2f × %.2f multiplier) [RECALCULATED]', 
             ttf.correct_sp_earned, ttf.item_price, ttf.multiplier)
  END,
  updated_at = now()
FROM trades_to_fix ttf
WHERE l.related_transaction_id = ttf.trade_id
  AND l.transaction_type = 'earn_reward'
  AND l.user_id = ttf.seller_id;

-- Show updated ledger
SELECT 
  l.amount AS new_amount,
  l.description AS new_description,
  l.updated_at
FROM sp_ledger l
WHERE l.related_transaction_id IN (SELECT trade_id FROM trades_to_fix)
  AND l.transaction_type = 'earn_reward';
```

**👉 CHECKPOINT 4:** Review the output

- Do the descriptions show `[RECALCULATED]`? ___________
- Do they show the correct formula? ___________
- Example: "Trade reward: 11 SP (buyer 10 SP × 1.10 multiplier) [RECALCULATED]"

**🚨 If anything looks wrong, run:** `ROLLBACK;` **and STOP**

---

### 2.5 Final Decision

**✅ If ALL checkpoints passed and everything looks correct:**

```sql
COMMIT;
```

**❌ If ANYTHING looks wrong:**

```sql
ROLLBACK;
```

---

## ✅ STEP 3: Verify the Fix

After committing, run these verification queries:

### 3.1 Check Wallet Balance

**⚠️ Replace `<user-id>` with actual user_id:**

```sql
SELECT 
  u.email,
  w.pending_balance,
  w.available_balance,
  w.lifetime_earned
FROM sp_wallets w
JOIN auth.users u ON u.id = w.user_id
WHERE w.user_id = '<user-id>';
```

**Expected:** `pending_balance` should now be **11 SP** (not 13 SP)

---

### 3.2 Check Trades

**⚠️ Replace `<user-id>` with actual user_id:**

```sql
SELECT 
  t.id,
  t.sp_earned_at_completion,
  i.title
FROM trades t
JOIN items i ON i.id = t.listing_id
WHERE t.seller_id = '<user-id>'
  AND t.status = 'completed'
  AND t.sp_earned_at_completion > 0
ORDER BY t.completed_at DESC;
```

**Expected:** `sp_earned_at_completion` should show **11 SP** (not 13-14 SP)

---

### 3.3 Check Ledger

**⚠️ Replace `<user-id>` with actual user_id:**

```sql
SELECT 
  l.amount,
  l.description,
  l.created_at
FROM sp_ledger l
WHERE l.user_id = '<user-id>'
  AND l.transaction_type = 'earn_reward'
ORDER BY l.created_at DESC
LIMIT 3;
```

**Expected:** Descriptions should show:
- `[RECALCULATED]` tag
- Correct SP amount (11 SP)
- Correct formula (buyer 10 SP × 1.10 multiplier)

---

## 🎯 STEP 4: Test with New Trade

After fixing past data, test that NEW trades use the correct formula:

1. **Create new test trade:**
   - Item: $15, category with 1.10× multiplier
   - Buyer offers: 10 SP + $5 cash

2. **Complete the trade**

3. **Check seller wallet:**
   ```sql
   -- Should increase by exactly 11 SP (not 13-14)
   ```

4. **Check ledger description:**
   ```sql
   -- Should show: "Trade reward: 11 SP (buyer 10 SP × 1.10 multiplier)"
   -- Should NOT have [RECALCULATED] tag
   ```

---

## 📊 Expected Results Summary

| Check | Before Fix | After Fix |
|-------|-----------|-----------|
| Wallet pending_balance | 13 SP | 11 SP |
| Trade sp_earned_at_completion | 13-14 SP | 11 SP |
| Ledger description | Wrong formula | "...11 SP... [RECALCULATED]" |
| New trades | N/A | 11 SP (correct formula) |

---

## ⚠️ Troubleshooting

### Issue: No trades found in Step 2.1

**Cause:** All trades already have correct SP amounts  
**Action:** No fix needed! Migration 20260607 was likely already applied

### Issue: sp_difference is positive (not negative)

**Cause:** Trades were under-rewarded (rare)  
**Action:** The fix script will ADD SP (increase pending_balance)

### Issue: ROLLBACK doesn't work

**Cause:** Transaction already committed  
**Action:** Cannot undo. Need to manually reverse changes OR restore from backup

### Issue: Multiple users affected

**Cause:** Fix script runs for ALL users with wrong SP  
**Action:** This is normal. Review the wallet update output in Step 2.2

---

## 🚀 Next Steps

After successfully applying the fix:

1. ✅ Mark this task complete
2. ✅ Test new trade flow (Step 4)
3. ✅ Proceed with Part 3 verification tests
4. ✅ Deploy migration 20260607 to production (if not already deployed)
5. ✅ Apply same fix to production (if needed)

---

## 📝 Execution Log

Use this section to track your progress:

- [ ] Step 1.1: Check formula status → Result: ____________
- [ ] Step 1.2: Find user → user_id: ____________
- [ ] Step 1.3: Find trades → sp_difference: ____________
- [ ] Step 1.4: Check ledger → Formula used: ____________
- [ ] Step 2.1: Identify trades → Count: ____________
- [ ] Step 2.2: Update wallets → New pending: ____________
- [ ] Step 2.3: Update trades → New SP earned: ____________
- [ ] Step 2.4: Update ledger → [RECALCULATED]: ____________
- [ ] Step 2.5: Decision → ☐ COMMIT ☐ ROLLBACK
- [ ] Step 3: Verification → All passed: ☐ YES ☐ NO
- [ ] Step 4: New trade test → Correct SP: ☐ YES ☐ NO

---

**🎉 Once all steps pass, the fix is complete!**
