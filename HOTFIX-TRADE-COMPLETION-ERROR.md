# 🚨 HOTFIX: Trade Completion Error

## Issue

**Error:** `unrecognized format() type specifier "."`

**Root Cause:** PostgreSQL `format()` function does NOT support C-style `%.2f` format specifiers. Migration 20260607 used `%.2f` which is invalid.

**Impact:** Cannot complete trades after applying migration 20260607.

---

## ✅ Fix (5 minutes)

### Step 1: Apply Hotfix Migration

1. Open **Supabase Dashboard** → SQL Editor
2. Copy and paste the entire contents of:
   ```
   supabase/migrations/20260607000002_hotfix_format_specifiers.sql
   ```
3. Click **Run**

### Step 2: Verify Fix Applied

Run this verification query:

```sql
SELECT 
  proname AS function_name,
  CASE 
    WHEN prosrc LIKE '%to_char(v_category_multiplier%' THEN '✅ HOTFIX APPLIED'
    WHEN prosrc LIKE '%%.2f%' THEN '❌ STILL HAS WRONG FORMAT'
    ELSE '⚠️ UNKNOWN'
  END AS status
FROM pg_proc 
WHERE proname = 'fn_release_all_sp_on_complete';
```

**Expected Result:** Should show `✅ HOTFIX APPLIED`

### Step 3: Test Trade Completion

1. Go to mobile app
2. Navigate to a pending trade
3. Tap "I Got It — Complete Trade"
4. **Expected:** Trade completes successfully (no error modal)

### Step 4: Verify SP Ledger Description

After completing a trade, check the ledger description format:

```sql
SELECT 
  amount,
  description,
  created_at
FROM sp_ledger
WHERE transaction_type = 'earn_reward'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Description Format:**
- With buyer SP: `Trade reward: 11 SP (buyer 10 SP × 1.10 multiplier)`
- All cash: `Trade reward: 55 SP (price $50.00 × 1.10 multiplier)`

---

## 📊 What Changed

### Before (BROKEN):
```sql
format('Trade reward: %s SP (buyer %s SP × %.2f multiplier)', ...)
--                                                ^^^^
--                                      ❌ PostgreSQL doesn't support this
```

### After (FIXED):
```sql
format('Trade reward: %s SP (buyer %s SP × %s multiplier)', 
       v_total_sp::text, 
       v_buyer_sp::text, 
       to_char(v_category_multiplier, 'FM999999999.00'))
--     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
--     ✅ PostgreSQL to_char() for decimal formatting
```

---

## 🔍 Technical Details

**PostgreSQL `format()` vs C `printf()`:**

| Specifier | PostgreSQL `format()` | C `printf()` |
|-----------|----------------------|--------------|
| `%s` | ✅ String | ✅ String |
| `%I` | ✅ Identifier | ❌ Not supported |
| `%L` | ✅ Literal | ❌ Not supported |
| `%.2f` | ❌ **Not supported** | ✅ Float with 2 decimals |

**Solution:**
- Use `to_char(value, 'FM999999999.00')` for decimal formatting
- Then pass to `format()` as `%s`

---

## ⚠️ If Fix Doesn't Work

1. **Check migration applied:**
   ```sql
   SELECT * FROM migrations WHERE version = '20260607000002';
   ```
   
2. **Force recreation of trigger:**
   ```sql
   DROP FUNCTION IF EXISTS fn_release_all_sp_on_complete() CASCADE;
   ```
   Then re-run the hotfix migration.

3. **Check for syntax errors:**
   ```sql
   SELECT proname, prosrc FROM pg_proc 
   WHERE proname = 'fn_release_all_sp_on_complete';
   ```
   Look for any `%.2f` remaining in the source.

---

## ✅ Expected Outcome

After applying this hotfix:
- ✅ Trade completion works without error
- ✅ SP ledger descriptions show properly formatted multipliers (e.g., "1.10")
- ✅ All 3 previous trades can be completed successfully
- ✅ New trades will work correctly

---

**Next Step:** After successful hotfix, proceed with Part 3 verification tests.
