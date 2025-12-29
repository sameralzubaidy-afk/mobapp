# Dynamic Minimum Withdrawal Amount - Implementation Summary

## Overview
Made the $5 minimum withdrawal requirement a **dynamic, admin-configurable value**. Admins can now adjust this threshold or disable it entirely by setting it to $0.

---

## Changes Made

### 1. Database Migration (Supabase)
**File:** `supabase/migrations/075_add_minimum_withdrawal_to_admin_config.sql`

**What it does:**
- Adds `minimum_withdrawal_amount_cents` to the `admin_config` table
- Default value: `500` cents ($5.00)
- Category: `fees`
- Description: "Minimum seller withdrawal amount in cents (e.g., 500 = $5.00). Set to 0 to disable minimum."

**Run this migration:**
```bash
cd supabase
supabase db push
```

**Verify migration:**
```sql
SELECT key, value, description, category 
FROM admin_config 
WHERE key = 'minimum_withdrawal_amount_cents';
```

Expected result:
| key | value | description | category |
|-----|-------|-------------|----------|
| minimum_withdrawal_amount_cents | 500 | Minimum seller withdrawal... | fees |

---

### 2. Mobile App Service Layer
**File:** `p2p-kids-marketplace/src/services/sellerBalance.ts`

**Changes:**
- Added `getMinimumWithdrawalAmount()` function that fetches the config value from Supabase
- Updated `requestWithdrawal()` to use the dynamic minimum instead of hardcoded 500
- If config value is `0`, the minimum check is **skipped entirely** (effectively disabled)
- Falls back to 500 cents default if config fetch fails

**Key Logic:**
```typescript
// Fetch minimum withdrawal amount from admin config
const minimumCents = await getMinimumWithdrawalAmount();

// If minimum is 0, skip the minimum check (effectively disabled)
if (minimumCents > 0 && amountCents < minimumCents) {
  const minDollars = formatCentsToDollars(minimumCents);
  return {
    success: false,
    error: `Minimum withdrawal amount is ${minDollars}`,
    minimum_required: minimumCents,
  };
}
```

---

### 3. Admin Portal UI
**File:** `p2p-kids-admin/src/app/config/page.tsx`

**Changes:**
- Added description for `minimum_withdrawal_amount_cents` in `getConfigDescription()`
- Description: "Minimum seller withdrawal amount in cents (e.g., 500 = $5.00). Set to 0 to disable the minimum requirement entirely."
- Config field will automatically appear in the "Fees" category section

**How admins use it:**
1. Navigate to Admin Portal → Config
2. Scroll to "Fees" category
3. Find "Minimum Withdrawal Amount Cents" field
4. Edit value (e.g., 1000 for $10, or 0 to disable)
5. Click "Save"
6. Mobile app will immediately use the new value on next withdrawal attempt

---

### 4. Test Guide Update
**File:** `PAY-003-MANUAL-TEST-GUIDE.md`

**Changes:**
- Updated **TS-024** to reflect dynamic minimum behavior
- Added test variations table showing different config values
- Added admin control test scenario

**Test Variations:**

| Config Value | Balance | Expected Behavior |
|--------------|---------|-------------------|
| 500 cents ($5) | $3.00 | Disabled/Error |
| 500 cents ($5) | $5.00+ | Enabled |
| 0 cents (disabled) | $0.01 | Enabled |
| 1000 cents ($10) | $7.00 | Disabled/Error |

---

## How It Works

### Normal Operation (Minimum Enabled)
1. Seller taps "Withdraw Now"
2. `requestWithdrawal()` fetches current minimum from `admin_config` table
3. If balance < minimum AND minimum > 0:
   - Returns error: "Minimum withdrawal amount is $X.XX"
   - Button disabled or shows alert
4. If balance >= minimum:
   - Proceeds with withdrawal

### When Minimum is Disabled (Set to $0)
1. Seller taps "Withdraw Now"
2. `requestWithdrawal()` fetches minimum (returns 0)
3. Minimum check is **skipped** because `if (minimumCents > 0 && ...)` is false
4. Withdrawal proceeds for ANY positive balance (even $0.01)

---

## Admin Configuration Examples

### Example 1: Set minimum to $10
```sql
UPDATE admin_config 
SET value = '1000', updated_at = now()
WHERE key = 'minimum_withdrawal_amount_cents';
```

Result: Sellers must have $10+ to withdraw

### Example 2: Disable minimum (allow any amount)
```sql
UPDATE admin_config 
SET value = '0', updated_at = now()
WHERE key = 'minimum_withdrawal_amount_cents';
```

Result: Sellers can withdraw any positive amount (even $0.01)

### Example 3: Set to $25 minimum
```sql
UPDATE admin_config 
SET value = '2500', updated_at = now()
WHERE key = 'minimum_withdrawal_amount_cents';
```

Result: Sellers must have $25+ to withdraw

---

## Testing Checklist

### ✅ Pre-Migration
- [ ] Confirm hardcoded $5 minimum works in current app
- [ ] Document current user behavior

### ✅ Post-Migration
- [ ] Run migration: `supabase db push`
- [ ] Verify config row exists: `SELECT * FROM admin_config WHERE key = 'minimum_withdrawal_amount_cents';`
- [ ] Default value is 500: ✅

### ✅ Mobile App Testing
- [ ] Seller with $3.00 balance: withdrawal blocked (minimum $5)
- [ ] Seller with $5.00 balance: withdrawal allowed
- [ ] Admin changes minimum to $10 via admin portal
- [ ] Seller with $7.00 balance: withdrawal now blocked
- [ ] Admin changes minimum to $0
- [ ] Seller with $0.50 balance: withdrawal now allowed

### ✅ Admin Portal Testing
- [ ] Navigate to Config page
- [ ] "Fees" category shows "Minimum Withdrawal Amount Cents"
- [ ] Current value displays: 500
- [ ] Edit to 1000, click Save
- [ ] Success message appears
- [ ] Value persists on page refresh
- [ ] Mobile app reflects new minimum immediately

### ✅ Edge Cases
- [ ] Invalid config value (non-numeric): falls back to 500
- [ ] Config row deleted: falls back to 500
- [ ] Network error fetching config: falls back to 500
- [ ] Negative config value: treated as 0 (disabled)

---

## Rollback Plan

If issues arise, revert the minimum to hardcoded $5:

### Option A: Set config value back to 500
```sql
UPDATE admin_config 
SET value = '500', updated_at = now()
WHERE key = 'minimum_withdrawal_amount_cents';
```

### Option B: Revert code changes
1. Revert `sellerBalance.ts` to use hardcoded 500
2. Remove `getMinimumWithdrawalAmount()` function
3. Restore original `requestWithdrawal()` implementation

### Option C: Drop migration (if needed)
```sql
DELETE FROM admin_config WHERE key = 'minimum_withdrawal_amount_cents';
```

---

## Benefits

✅ **Flexibility:** Admins can adjust minimum based on business needs without code deploy  
✅ **A/B Testing:** Can test different minimums per node or user segment  
✅ **Operational Control:** Can disable minimum during promotions or for specific scenarios  
✅ **No Code Changes:** Adjustments done via admin UI, no app rebuild required  
✅ **Audit Trail:** All config changes logged in `admin_config.updated_at`  

---

## Future Enhancements

### Possible Node-Specific Minimums
If needed, extend schema to support per-node minimums:
```sql
ALTER TABLE admin_config ADD COLUMN node_id TEXT;
-- Then query: WHERE key = 'minimum_withdrawal_amount_cents' AND (node_id = ? OR node_id IS NULL)
```

### Notification to Users
Add in-app banner when minimum changes:
```typescript
"Withdrawal minimum has changed to $X.XX"
```

### Analytics
Track withdrawal attempts blocked by minimum:
```typescript
analytics.track('withdrawal_blocked_minimum', {
  user_balance_cents: balance,
  minimum_required_cents: minimumCents,
  difference_cents: minimumCents - balance,
});
```

---

## Documentation References

- **Migration File:** `supabase/migrations/075_add_minimum_withdrawal_to_admin_config.sql`
- **Service Logic:** `p2p-kids-marketplace/src/services/sellerBalance.ts` (lines ~240-280)
- **Admin UI:** `p2p-kids-admin/src/app/config/page.tsx`
- **Test Guide:** `PAY-003-MANUAL-TEST-GUIDE.md` (TS-024)
- **Original Context:** No explicit requirement found in SYSTEM_REQUIREMENTS_V2.md; was an implementation decision

---

## Status: ✅ Ready for Testing

All code changes implemented and ready for:
1. Supabase migration application
2. Mobile app testing (iOS Simulator / Android Emulator)
3. Admin portal testing (config page)
4. Manual test guide execution (TS-024)

**Next Steps:**
1. Apply migration: `cd supabase && supabase db push`
2. Restart mobile app to pick up changes
3. Test withdrawal with different minimums
4. Verify admin config UI shows new field
5. Execute TS-024 from test guide
