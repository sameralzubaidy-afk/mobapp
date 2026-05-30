# SUB-014 Manual Testing Guide: Billing History

**Module:** MODULE-11-SUBSCRIPTIONS-V2.md  
**Task:** SUB-014 - Enhanced User Subscriptions Schema (Billing & Payment Fields)  
**Date:** 2026-03-03  
**Target:** iOS/Android Simulators

---

## Prerequisites

### 1. Database Migration Applied
Run the following SQL in **Supabase SQL Editor** (Production):

```sql
-- Copy and paste the entire contents of:
-- supabase/migrations/20260303000000_create_billing_history_sub_014.sql
```

**Expected Result:**
- ✅ `billing_history` table created
- ✅ 5 indexes created
- ✅ RLS policies enabled
- ✅ Verification queries return expected results

### 2. Test Users Setup
You need at least one test user with a subscription:

```sql
-- Get test user
SELECT 
  u.id AS user_id,
  u.email,
  s.id AS subscription_id,
  s.status AS subscription_status
FROM auth.users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.email = 'YOUR_TEST_EMAIL@example.com';
```

**Save the `user_id` and `subscription_id` for use in test cases below.**

### 3. App Environment
```bash
cd p2p-kids-marketplace
npm install
npm start
```

---

## Test Suite 1: Database Schema Verification

### TC-SUB014-001: Verify billing_history table structure
**Objective:** Confirm table has all required columns  
**Prerequisites:** Migration applied

**Steps:**
1. Open Supabase SQL Editor (Production)
2. Run:
```sql
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'billing_history'
ORDER BY ordinal_position;
```

**Expected Result:**
```
✅ Column: id (uuid, NOT NULL)
✅ Column: user_id (uuid, NOT NULL)
✅ Column: subscription_id (uuid, NOT NULL)
✅ Column: charge_id (text, NOT NULL, UNIQUE)
✅ Column: stripe_invoice_id (text, NULL)
✅ Column: amount (integer, NOT NULL)
✅ Column: currency (text, NOT NULL, default 'usd')
✅ Column: status (billing_status enum, NOT NULL)
✅ Column: charged_at (timestamptz, NOT NULL)
✅ Column: description (text, NULL)
✅ Column: error_message (text, NULL)
✅ Column: created_at (timestamptz, NOT NULL, default NOW())
✅ Column: updated_at (timestamptz, NOT NULL, default NOW())
```

**Result:** PASS / FAIL

---

### TC-SUB014-002: Verify RLS policies
**Objective:** Confirm RLS is enabled with correct policies  
**Prerequisites:** Migration applied

**Steps:**
1. Run in Supabase SQL Editor:
```sql
-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'billing_history';

-- Check policies exist
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'billing_history';
```

**Expected Result:**
```
✅ RLS enabled: rowsecurity = true
✅ Policy: billing_history_select_own (SELECT, authenticated)
✅ Policy: billing_history_service_role (ALL, service_role)
```

**Result:** PASS / FAIL

---

### TC-SUB014-003: Verify indexes
**Objective:** Confirm performance indexes are created  
**Prerequisites:** Migration applied

**Steps:**
1. Run:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'billing_history'
ORDER BY indexname;
```

**Expected Result:**
```
✅ idx_billing_history_user_id_created_at
✅ idx_billing_history_subscription_id_created_at
✅ idx_billing_history_charge_id
✅ idx_billing_history_status
✅ idx_billing_history_charged_at
```

**Result:** PASS / FAIL

---

## Test Suite 2: Create Billing Records (SQL)

### TC-SUB014-004: Create successful charge record
**Objective:** Insert a billing record with status='succeeded'  
**Prerequisites:** Test user with subscription

**Steps:**
1. Replace `<USER_ID>` and `<SUBSCRIPTION_ID>` with your test values
2. Run:
```sql
INSERT INTO public.billing_history (
  user_id,
  subscription_id,
  charge_id,
  stripe_invoice_id,
  amount,
  currency,
  status,
  charged_at,
  description
) VALUES (
  '<USER_ID>',
  '<SUBSCRIPTION_ID>',
  'ch_test_manual_001',
  'in_test_manual_001',
  499,
  'usd',
  'succeeded',
  NOW(),
  'Kids Club+ Monthly - March 2026'
) RETURNING *;
```

**Expected Result:**
```
✅ Record created with id
✅ amount = 499
✅ status = 'succeeded'
✅ currency = 'usd'
✅ created_at and updated_at populated
```

**Result:** PASS / FAIL

---

### TC-SUB014-005: Create failed charge record
**Objective:** Insert a billing record with status='failed' and error_message  
**Prerequisites:** Test user with subscription

**Steps:**
1. Run:
```sql
INSERT INTO public.billing_history (
  user_id,
  subscription_id,
  charge_id,
  amount,
  status,
  charged_at,
  description,
  error_message
) VALUES (
  '<USER_ID>',
  '<SUBSCRIPTION_ID>',
  'ch_test_manual_002',
  499,
  'failed',
  NOW(),
  'Kids Club+ Monthly - Failed Attempt',
  'Card declined - insufficient funds'
) RETURNING *;
```

**Expected Result:**
```
✅ Record created
✅ status = 'failed'
✅ error_message = 'Card declined - insufficient funds'
```

**Result:** PASS / FAIL

---

### TC-SUB014-006: Prevent duplicate charge_id
**Objective:** Verify unique constraint on charge_id  
**Prerequisites:** TC-SUB014-004 passed

**Steps:**
1. Attempt to insert duplicate:
```sql
INSERT INTO public.billing_history (
  user_id,
  subscription_id,
  charge_id,
  amount,
  status
) VALUES (
  '<USER_ID>',
  '<SUBSCRIPTION_ID>',
  'ch_test_manual_001', -- Same as TC-SUB014-004
  499,
  'succeeded'
);
```

**Expected Result:**
```
❌ ERROR: duplicate key value violates unique constraint
✅ Previous record remains unchanged
```

**Result:** PASS / FAIL

---

## Test Suite 3: Query Billing History (SQL)

### TC-SUB014-007: Fetch user's billing history
**Objective:** Query all billing records for a user  
**Prerequisites:** At least one billing record exists

**Steps:**
1. Run:
```sql
SELECT 
  id,
  charge_id,
  amount,
  status,
  charged_at,
  description
FROM public.billing_history
WHERE user_id = '<USER_ID>'
ORDER BY charged_at DESC;
```

**Expected Result:**
```
✅ Returns all user's billing records
✅ Ordered by charged_at descending (most recent first)
✅ No records from other users visible
```

**Result:** PASS / FAIL

---

### TC-SUB014-008: Filter by status
**Objective:** Query billing records by status  
**Prerequisites:** Multiple records with different statuses

**Steps:**
1. Run:
```sql
SELECT charge_id, status, amount
FROM public.billing_history
WHERE user_id = '<USER_ID>' AND status = 'succeeded';

SELECT charge_id, status, error_message
FROM public.billing_history
WHERE user_id = '<USER_ID>' AND status = 'failed';
```

**Expected Result:**
```
✅ First query returns only 'succeeded' records
✅ Second query returns only 'failed' records with error_message
```

**Result:** PASS / FAIL

---

### TC-SUB014-009: Calculate billing summary
**Objective:** Aggregate billing totals  
**Prerequisites:** Multiple billing records exist

**Steps:**
1. Run:
```sql
SELECT 
  COUNT(*) AS total_charges,
  COUNT(*) FILTER (WHERE status = 'succeeded') AS successful_charges,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_charges,
  COUNT(*) FILTER (WHERE status = 'refunded') AS refunded_charges,
  SUM(amount) FILTER (WHERE status = 'succeeded') AS total_charged_cents,
  SUM(amount) FILTER (WHERE status = 'refunded') AS total_refunded_cents
FROM public.billing_history
WHERE user_id = '<USER_ID>';
```

**Expected Result:**
```
✅ total_charges = count of all records
✅ successful_charges = count of 'succeeded' status
✅ failed_charges = count of 'failed' status
✅ total_charged_cents = sum of succeeded amounts
✅ Calculations match manual count
```

**Result:** PASS / FAIL

---

## Test Suite 4: Update Billing Records

### TC-SUB014-010: Update status from pending to succeeded
**Objective:** Update billing record status  
**Prerequisites:** Create pending record first

**Steps:**
1. Create pending charge:
```sql
INSERT INTO public.billing_history (
  user_id, subscription_id, charge_id, amount, status
) VALUES (
  '<USER_ID>', '<SUBSCRIPTION_ID>', 'ch_test_update_001', 499, 'pending'
) RETURNING id, status, updated_at;
```

2. Update to succeeded:
```sql
UPDATE public.billing_history
SET status = 'succeeded'
WHERE charge_id = 'ch_test_update_001'
RETURNING id, status, updated_at;
```

**Expected Result:**
```
✅ Status changed from 'pending' to 'succeeded'
✅ updated_at timestamp changed to NOW()
```

**Result:** PASS / FAIL

---

### TC-SUB014-011: Update to failed with error message
**Objective:** Add error message when marking as failed  
**Prerequisites:** Pending charge exists

**Steps:**
1. Update:
```sql
UPDATE public.billing_history
SET 
  status = 'failed',
  error_message = 'Payment method expired'
WHERE charge_id = 'ch_test_update_001'
RETURNING charge_id, status, error_message, updated_at;
```

**Expected Result:**
```
✅ status = 'failed'
✅ error_message = 'Payment method expired'
✅ updated_at timestamp updated
```

**Result:** PASS / FAIL

---

## Test Suite 5: Service Layer (TypeScript)

### TC-SUB014-012: getBillingHistory() service function
**Objective:** Test TypeScript service fetches records  
**Prerequisites:** App running in simulator, test user logged in

**Steps:**
1. Add temporary debug code to subscription screen:
```typescript
import { getBillingHistory } from '../services/billingHistory';

// In component:
const testBillingHistory = async () => {
  const records = await getBillingHistory({ user_id: currentUserId });
  console.log('[BillingHistory]', records);
  alert(`Found ${records.length} billing records`);
};
```

2. Open simulator
3. Navigate to subscription screen
4. Trigger the test function

**Expected Result:**
```
✅ Console shows billing records array
✅ Alert displays correct count
✅ No errors thrown
```

**Result:** PASS / FAIL

---

### TC-SUB014-013: getBillingHistorySummary() service function
**Objective:** Test summary calculation  
**Prerequisites:** Multiple billing records exist

**Steps:**
1. Add debug code:
```typescript
import { getBillingHistorySummary } from '../services/billingHistory';

const testSummary = async () => {
  const summary = await getBillingHistorySummary(currentUserId);
  console.log('[Billing Summary]', summary);
  alert(`Total: ${summary.total_charges}, Succeeded: ${summary.successful_charges}`);
};
```

2. Trigger in simulator

**Expected Result:**
```
✅ summary.total_charges matches database count
✅ summary.successful_charges matches 'succeeded' count
✅ summary.total_amount_cents matches sum of succeeded amounts
✅ summary.most_recent_charge is populated
```

**Result:** PASS / FAIL

---

## Test Suite 6: Unit Tests (Automated)

### TC-SUB014-014: Run unit tests
**Objective:** Verify all service unit tests pass  
**Prerequisites:** Jest configured

**Steps:**
```bash
cd p2p-kids-marketplace
npm test src/services/__tests__/billingHistory.test.ts
```

**Expected Result:**
```
✅ All test suites passed
✅ getBillingHistory tests: 3/3 passed
✅ getBillingRecordByChargeId tests: 2/2 passed
✅ createBillingRecord tests: 2/2 passed
✅ updateBillingRecordStatus tests: 2/2 passed
✅ getBillingHistorySummary tests: 2/2 passed
✅ getRecentBillingHistory tests: 2/2 passed
Total: 13 tests passed
```

**Result:** PASS / FAIL

---

## Test Suite 7: E2E Tests (Automated)

### TC-SUB014-015: Run E2E tests
**Objective:** Verify end-to-end integration with real Supabase  
**Prerequisites:** SUPABASE_URL and keys configured, test user exists

**Steps:**
```bash
export TEST_USER_ID="<YOUR_TEST_USER_ID>"
export TEST_SUBSCRIPTION_ID="<YOUR_TEST_SUBSCRIPTION_ID>"
npm test src/__tests__/e2e/billing-history-sub-014.e2e.ts
```

**Expected Result:**
```
✅ Table Structure suite: 3/3 passed
✅ Create Billing Record suite: 4/4 passed
✅ Read Billing History suite: 6/6 passed
✅ Update Billing Record suite: 3/3 passed
✅ Billing Summary suite: 1/1 passed
✅ RLS Policies suite: 1/1 passed
Total: 18 tests passed
```

**Result:** PASS / FAIL

---

## Test Suite 8: RLS Security

### TC-SUB014-016: User can only see own billing history
**Objective:** Verify RLS prevents cross-user access  
**Prerequisites:** Two test users with billing records

**Steps:**
1. As User A, query:
```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<USER_A_ID>';

SELECT * FROM public.billing_history;
```

2. Query should only return User A's records

3. Repeat as User B and verify isolation

**Expected Result:**
```
✅ User A sees only their own records
✅ User B sees only their own records
✅ No cross-user data leakage
```

**Result:** PASS / FAIL

---

### TC-SUB014-017: Service role can access all records
**Objective:** Verify service role bypasses RLS  
**Prerequisites:** Billing records exist for multiple users

**Steps:**
1. Use service role key to query:
```typescript
// In Edge Function with service role
const { data } = await supabaseAdmin
  .from('billing_history')
  .select('*');

console.log(`Total records: ${data?.length}`);
```

**Expected Result:**
```
✅ Service role sees all billing records across all users
✅ Used for webhooks and admin functions
```

**Result:** PASS / FAIL

---

## Test Suite 9: Data Integrity

### TC-SUB014-018: Foreign key constraints enforced
**Objective:** Verify FK to auth.users and subscriptions  
**Prerequisites:** Database with constraints

**Steps:**
1. Attempt to insert with nonexistent user_id:
```sql
INSERT INTO public.billing_history (
  user_id, subscription_id, charge_id, amount, status
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '<SUBSCRIPTION_ID>',
  'ch_test_fk_001',
  499,
  'succeeded'
);
```

**Expected Result:**
```
❌ ERROR: violates foreign key constraint "billing_history_user_id_fkey"
✅ Record not created
```

**Result:** PASS / FAIL

---

### TC-SUB014-019: Amount must be non-negative
**Objective:** Verify CHECK constraint on amount  
**Prerequisites:** Database constraints

**Steps:**
1. Attempt negative amount:
```sql
INSERT INTO public.billing_history (
  user_id, subscription_id, charge_id, amount, status
) VALUES (
  '<USER_ID>',
  '<SUBSCRIPTION_ID>',
  'ch_test_negative',
  -499,
  'succeeded'
);
```

**Expected Result:**
```
❌ ERROR: new row violates check constraint
✅ Negative amounts not allowed
```

**Result:** PASS / FAIL

---

### TC-SUB014-020: Auto-update trigger for updated_at
**Objective:** Verify trigger updates timestamp  
**Prerequisites:** Billing record exists

**Steps:**
1. Note current updated_at:
```sql
SELECT charge_id, updated_at 
FROM public.billing_history 
WHERE charge_id = 'ch_test_manual_001';
```

2. Update any field:
```sql
UPDATE public.billing_history
SET description = 'Updated description'
WHERE charge_id = 'ch_test_manual_001'
RETURNING charge_id, description, updated_at;
```

3. Compare timestamps

**Expected Result:**
```
✅ updated_at timestamp is newer than before
✅ Difference is within 1 second of NOW()
```

**Result:** PASS / FAIL

---

## Summary Template

**Test Run Date:** ____________  
**Tester:** ____________  
**Environment:** iOS Simulator / Android Emulator (circle one)  

| Test Case | Result | Notes |
|-----------|--------|-------|
| TC-SUB014-001 Schema | ☐ PASS ☐ FAIL | |
| TC-SUB014-002 RLS | ☐ PASS ☐ FAIL | |
| TC-SUB014-003 Indexes | ☐ PASS ☐ FAIL | |
| TC-SUB014-004 Create Success | ☐ PASS ☐ FAIL | |
| TC-SUB014-005 Create Failed | ☐ PASS ☐ FAIL | |
| TC-SUB014-006 Duplicate Prevention | ☐ PASS ☐ FAIL | |
| TC-SUB014-007 Fetch History | ☐ PASS ☐ FAIL | |
| TC-SUB014-008 Filter Status | ☐ PASS ☐ FAIL | |
| TC-SUB014-009 Summary Calc | ☐ PASS ☐ FAIL | |
| TC-SUB014-010 Update Pending | ☐ PASS ☐ FAIL | |
| TC-SUB014-011 Update Failed | ☐ PASS ☐ FAIL | |
| TC-SUB014-012 Service getBilling | ☐ PASS ☐ FAIL | |
| TC-SUB014-013 Service getSummary | ☐ PASS ☐ FAIL | |
| TC-SUB014-014 Unit Tests | ☐ PASS ☐ FAIL | |
| TC-SUB014-015 E2E Tests | ☐ PASS ☐ FAIL | |
| TC-SUB014-016 RLS Own Data | ☐ PASS ☐ FAIL | |
| TC-SUB014-017 Service Role | ☐ PASS ☐ FAIL | |
| TC-SUB014-018 FK Constraints | ☐ PASS ☐ FAIL | |
| TC-SUB014-019 Amount Check | ☐ PASS ☐ FAIL | |
| TC-SUB014-020 Auto-Update | ☐ PASS ☐ FAIL | |

**Overall Result:** ☐ ALL PASS  ☐ SOME FAILURES

**Blockers/Issues:**
_________________________________
_________________________________

---

## Cleanup

After testing, remove test billing records:

```sql
DELETE FROM public.billing_history
WHERE charge_id LIKE 'ch_test_%';
```

**Confirmation:** ✅ Test data removed
