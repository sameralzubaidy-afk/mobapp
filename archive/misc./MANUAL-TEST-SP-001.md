# MODULE-09 SP-001: Manual Testing Guide

## Prerequisites

1. **Run SQL Migration First**:
   ```bash
   # In Supabase SQL Editor, run:
   # File: supabase/migrations/092_sp_config_table.sql
   ```

2. **Test Users Required**:
   - User A: Active Kids Club+ subscriber
   - User B: Free tier user (no subscription)
   - User C: Subscriber in grace period
   - User D: New user (just registered)

3. **Verification Queries**:
   ```sql
   -- Verify sp_config table exists and is seeded
   SELECT config_key, config_value, category 
   FROM sp_config 
   ORDER BY category, config_key;

   -- Verify wallet was created
   SELECT * FROM sp_wallets WHERE user_id = '<TEST_USER_ID>';

   -- Verify ledger is working
   SELECT * FROM sp_ledger WHERE user_id = '<TEST_USER_ID>' ORDER BY created_at DESC;
   ```

---

## Test Case 1: Wallet Creation (Automatic)

**Objective**: Verify wallet is created automatically on first access

**Steps**:
1. Sign up as new user (User D)
2. Navigate to any screen that calls `getWallet(userId)`
3. Check database for wallet record

**Expected Results**:
- ✅ Wallet record created in `sp_wallets` table
- ✅ `available_balance = 0`
- ✅ `pending_balance = 0`
- ✅ `lifetime_earned = 0`
- ✅ `lifetime_spent = 0`
- ✅ `state = 'active'`
- ✅ `starter_pack_issued = false`

**SQL Verification**:
```sql
SELECT * FROM sp_wallets WHERE user_id = '<USER_D_ID>';
```

---

## Test Case 2: Balance Query

**Objective**: Verify balance retrieval works correctly

**Steps**:
1. Login as User A (active subscriber)
2. Call `getBalance(userId)` function
3. Verify result matches database

**Expected Results**:
- ✅ Returns numeric balance
- ✅ Matches `available_balance` in database
- ✅ Returns 0 for new users
- ✅ No errors thrown

**SQL Verification**:
```sql
SELECT available_balance FROM sp_wallets WHERE user_id = '<USER_A_ID>';
```

---

## Test Case 3: Subscription-Gated SP Spending (Active Subscriber)

**Objective**: Verify active subscribers can spend SP

**Steps**:
1. Login as User A (active Kids Club+ subscriber)
2. Call `canSpendSP(userId)`
3. Verify response

**Expected Results**:
- ✅ `allowed = true`
- ✅ `reason` is empty or positive message
- ✅ No errors thrown

**SQL Verification**:
```sql
SELECT s.status, s.tier, w.state
FROM subscriptions s
JOIN sp_wallets w ON w.user_id = s.user_id
WHERE s.user_id = '<USER_A_ID>';
```

---

## Test Case 4: Subscription-Gated SP Spending (Free User)

**Objective**: Verify free users cannot spend SP

**Steps**:
1. Login as User B (free tier, no subscription)
2. Call `canSpendSP(userId)`
3. Verify response

**Expected Results**:
- ✅ `allowed = false`
- ✅ `reason` contains "subscription required" or similar
- ✅ Error message is user-friendly

**SQL Verification**:
```sql
SELECT * FROM subscriptions WHERE user_id = '<USER_B_ID>';
-- Should return empty or inactive status
```

---

## Test Case 5: Subscription-Gated SP Spending (Grace Period)

**Objective**: Verify users in grace period have frozen wallets

**Steps**:
1. Login as User C (subscription in grace period)
2. Call `canSpendSP(userId)`
3. Verify response

**Expected Results**:
- ✅ `allowed = false`
- ✅ `reason` contains "wallet is frozen" or "grace period"
- ✅ Wallet state is `frozen` or `grace_period`

**SQL Verification**:
```sql
SELECT w.state, w.frozen_at, w.grace_period_ends_at
FROM sp_wallets w
WHERE w.user_id = '<USER_C_ID>';
```

---

## Test Case 6: Ledger History Retrieval

**Objective**: Verify ledger history pagination works

**Steps**:
1. Login as User A (has some SP activity)
2. Call `getLedgerHistory(userId, 0, 10)`
3. Verify results are paginated and ordered

**Expected Results**:
- ✅ Returns array of ledger entries
- ✅ Entries ordered by `created_at DESC`
- ✅ Maximum 10 entries returned
- ✅ Each entry has: `transaction_type`, `amount`, `created_at`

**SQL Verification**:
```sql
SELECT transaction_type, amount, created_at
FROM sp_ledger
WHERE user_id = '<USER_A_ID>'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Test Case 7: SP Config Retrieval

**Objective**: Verify admin config values can be read

**Steps**:
1. Call `getSPConfig('starter_pack_amount')`
2. Call `getSPConfig('expiration_enabled')`
3. Call `getSPConfig('invalid_key_xyz')`

**Expected Results**:
- ✅ `starter_pack_amount` returns numeric value (e.g., 10)
- ✅ `expiration_enabled` returns boolean value (e.g., true)
- ✅ `invalid_key_xyz` returns null (graceful failure)

**SQL Verification**:
```sql
SELECT config_key, config_value FROM sp_config WHERE config_key IN (
  'starter_pack_amount',
  'expiration_enabled'
);
```

---

## Test Case 8: Wallet Summary RPC

**Objective**: Verify wallet summary calculation works

**Steps**:
1. Login as User A
2. Call `getWalletSummary(userId)`
3. Verify all fields are present

**Expected Results**:
- ✅ `available_points` is numeric
- ✅ `pending_points` is numeric
- ✅ `lifetime_earned` is numeric
- ✅ `lifetime_spent` is numeric
- ✅ `wallet_status` is 'active', 'frozen', or 'grace_period'

**SQL Verification**:
```sql
SELECT * FROM get_user_sp_wallet_summary('<USER_A_ID>');
```

---

## Test Case 9: SP Config Update (Admin Only)

**Objective**: Verify only admins can update config

**Steps**:
1. Login as admin user
2. Call `update_sp_config('starter_pack_amount', '20', '<ADMIN_ID>')`
3. Verify config updated
4. Login as non-admin user
5. Attempt to call `update_sp_config()` (should fail)

**Expected Results**:
- ✅ Admin can update config successfully
- ✅ Config value changes in database
- ✅ Non-admin gets permission error

**SQL Verification**:
```sql
-- As admin:
SELECT update_sp_config('starter_pack_amount', '20'::jsonb, '<ADMIN_ID>');

-- Verify update:
SELECT config_value FROM sp_config WHERE config_key = 'starter_pack_amount';

-- As non-admin (should fail):
SELECT update_sp_config('starter_pack_amount', '999'::jsonb, '<NON_ADMIN_ID>');
```

---

## Test Case 10: RLS Policies

**Objective**: Verify Row Level Security is enforced

**Steps**:
1. Login as User A
2. Attempt to read User B's wallet data
3. Verify access is denied

**Expected Results**:
- ✅ User can only see their own wallet
- ✅ User can only see their own ledger entries
- ✅ SP config is publicly readable
- ✅ Direct updates to sp_wallets are blocked (must use RPCs)

**SQL Verification**:
```sql
-- As User A, try to read User B's wallet (should fail):
SELECT * FROM sp_wallets WHERE user_id = '<USER_B_ID>';

-- As User A, read own wallet (should succeed):
SELECT * FROM sp_wallets WHERE user_id = '<USER_A_ID>';
```

---

## Automated Test Commands

```bash
# Run unit tests
cd p2p-kids-marketplace
npm run test src/__tests__/sp/wallet.test.ts

# Run E2E tests
npm run test:e2e src/__tests__/e2e/sp-001-wallet.e2e.ts

# Run all SP tests
npm run test -- --grep "SP-001"
```

---

## Rollback Plan

If issues are found:

1. **Rollback SQL Migration**:
   ```sql
   DROP FUNCTION IF EXISTS update_sp_config(text, jsonb, uuid);
   DROP FUNCTION IF EXISTS get_sp_config(text);
   DROP TABLE IF EXISTS sp_config;
   ```

2. **Remove Service Files**:
   ```bash
   rm p2p-kids-marketplace/src/services/sp/wallet.ts
   ```

3. **Revert Code Changes**: Use git to revert commits related to SP-001

---

## Known Issues / Limitations

1. **Starter Pack Not Yet Implemented**: SP-001 only covers wallet foundation, starter pack issuance is in SP-002
2. **No UI Yet**: SP-001 is backend-only, UI screens are in SP-003
3. **No Earning/Spending Yet**: Full earning and spending flows are in SP-002 and SP-003
4. **Grace Period Logic**: Grace period state transitions require subscription webhook integration (MODULE-11)

---

## Next Steps

After SP-001 verification:
1. Implement SP-002 (Earning flows: starter pack, referrals, challenges)
2. Implement SP-003 (Spending flows: deductions, FIFO, no cap)
3. Implement SP-004 (Expiration flows: time-based, action-based triggers)
4. Implement SP-005 (UI screens: wallet, history, progress)
5. Implement SP-006 (Admin UI: config management, adjustments)
