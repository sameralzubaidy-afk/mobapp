# MODULE-11 TASK SUB-002: Manual Testing Guide
## User Subscriptions Table & Status Management

**Test Environment:** iOS Simulator / Android Emulator  
**Prerequisites:**
- Migrations applied: `20260213000000_enhance_subscriptions_sub_002.sql` and `20260213000001_subscription_rpcs_sub_002.sql`
- `subscription_tiers` table seeded (TASK SUB-001)
- Test users created with different subscription statuses

---

## ⚙️ SETUP INSTRUCTIONS

### 1. Run SQL Migrations in Supabase

```bash
# Navigate to Supabase SQL Editor (Production)
```

**Step 1:** Run migration `20260213000000_enhance_subscriptions_sub_002.sql`  
**Step 2:** Run migration `20260213000001_subscription_rpcs_sub_002.sql`  
**Step 3:** Run verification queries at the end of each migration file to confirm success

### 2. Create Test Users

Run this SQL in Supabase SQL Editor to create test subscriptions:

```sql
-- Test User 1: Free user (no subscription)
-- Use existing user or create via signup - will default to 'free' status

-- Test User 2: Active trial user
INSERT INTO subscriptions (
  user_id,
  tier_id,
  status,
  trial_started_at,
  trial_ends_at,
  has_used_trial,
  stripe_customer_id,
  auto_renew_enabled
) VALUES (
  '<YOUR_TEST_USER_ID_2>',
  (SELECT id FROM subscription_tiers WHERE name = 'kids_club_plus'),
  'trial',
  NOW(),
  NOW() + INTERVAL '30 days',
  TRUE,
  'cus_test_trial',
  TRUE
);

-- Test User 3: Active paid subscriber
INSERT INTO subscriptions (
  user_id,
  tier_id,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_payment_method_id,
  current_period_start,
  current_period_end,
  next_billing_date,
  monthly_price_cents,
  last_payment_date,
  last_payment_amount,
  has_used_trial,
  auto_renew_enabled
) VALUES (
  '<YOUR_TEST_USER_ID_3>',
  (SELECT id FROM subscription_tiers WHERE name = 'kids_club_plus'),
  'active',
  'cus_test_active',
  'sub_test_active',
  'pm_test_123',
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '30 days',
  499,
  NOW() - INTERVAL '5 days',
  499,
  TRUE,
  TRUE
);

-- Test User 4: Grace period user (cancelled, SP frozen)
INSERT INTO subscriptions (
  user_id,
  tier_id,
  status,
  stripe_customer_id,
  stripe_payment_method_id,
  cancelled_at,
  cancel_reason,
  grace_started_at,
  grace_ends_at,
  has_used_trial,
  auto_renew_enabled,
  payment_retry_count
) VALUES (
  '<YOUR_TEST_USER_ID_4>',
  (SELECT id FROM subscription_tiers WHERE name = 'kids_club_plus'),
  'grace_period',
  'cus_test_grace',
  'pm_test_grace',
  NOW() - INTERVAL '1 day',
  'Too expensive for testing',
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '89 days',
  TRUE,
  FALSE,
  3
);

-- Test User 5: Paused subscription (keeps access)
INSERT INTO subscriptions (
  user_id,
  tier_id,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_payment_method_id,
  current_period_start,
  current_period_end,
  paused_until,
  has_used_trial,
  auto_renew_enabled
) VALUES (
  '<YOUR_TEST_USER_ID_5>',
  (SELECT id FROM subscription_tiers WHERE name = 'kids_club_plus'),
  'paused',
  'cus_test_paused',
  'sub_test_paused',
  'pm_test_paused',
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '30 days',
  TRUE,
  FALSE
);
```

### 3. Start the App

```bash
cd p2p-kids-marketplace
npm install
npm start
```

Choose iOS or Android simulator when prompted.

---

## 📋 TEST CASES

### Test Suite 1: Database Schema Verification

#### TC-SUB002-001: Verify New Columns Exist
**Objective:** Confirm all V2.1 columns were added to subscriptions table

**Steps:**
1. Open Supabase SQL Editor
2. Run verification query from migration file:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'subscriptions'
   AND column_name IN (
     'tier_id', 'monthly_price_cents', 'grace_started_at',
     'grace_ends_at', 'cancelled_at', 'cancel_reason',
     'paused_until', 'auto_renew_enabled',
     'payment_retry_count', 'payment_failed_at',
     'has_used_trial', 'stripe_payment_method_id'
   )
   ORDER BY column_name;
   ```

**Expected Result:**
- All columns listed above should appear in results
- ✅ PASS if all columns exist
- ❌ FAIL if any column is missing

---

#### TC-SUB002-002: Verify Indexes Created
**Objective:** Confirm performance indexes were created

**Steps:**
1. Run query:
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'subscriptions'
   AND indexname LIKE 'idx_subscriptions_%'
   ORDER BY indexname;
   ```

**Expected Result:**
- Should see indexes for: `tier_id`, `next_billing_date`, `grace_ends_at`, `payment_failed_at`, `paused_until`
- ✅ PASS if all indexes exist
- ❌ FAIL if any index is missing

---

#### TC-SUB002-003: Verify Status Constraint Updated
**Objective:** Confirm status enum includes new V2.1 states

**Steps:**
1. Run query:
   ```sql
   SELECT pg_get_constraintdef(oid) AS constraint_definition
   FROM pg_constraint
   WHERE conrelid = 'public.subscriptions'::regclass
   AND conname = 'subscriptions_status_check';
   ```

**Expected Result:**
- Constraint should include: 'free', 'trial', 'active', 'grace', 'canceled', 'expired', 'paused', 'grace_period', 'cancelled'
- ✅ PASS if all statuses in constraint
- ❌ FAIL if any status missing

---

### Test Suite 2: RPC Function Testing

#### TC-SUB002-004: get_subscription_status for Free User
**Objective:** Verify RPC returns empty for free user

**Steps:**
1. Login as Test User 1 (free user)
2. In Supabase SQL Editor, run:
   ```sql
   SELECT * FROM get_subscription_status('<TEST_USER_1_ID>');
   ```

**Expected Result:**
- Returns empty array `[]`
- ✅ PASS if empty
- ❌ FAIL if returns data

---

#### TC-SUB002-005: get_subscription_status for Trial User
**Objective:** Verify complete status retrieval for trial user

**Steps:**
1. Run:
   ```sql
   SELECT * FROM get_subscription_status('<TEST_USER_2_ID>');
   ```

**Expected Result:**
- Returns 1 row
- Fields populated: `status='trial'`, `has_used_trial=TRUE`, `trial_ends_at` set, `auto_renew_enabled=TRUE`
- ✅ PASS if data matches expectations
- ❌ FAIL if data incorrect or missing

---

#### TC-SUB002-006: can_user_earn_sp for Trial User
**Objective:** Trial users should be able to earn SP

**Steps:**
1. Run:
   ```sql
   SELECT can_user_earn_sp('<TEST_USER_2_ID>');
   ```

**Expected Result:**
- Returns `TRUE`
- ✅ PASS
- ❌ FAIL if FALSE

---

#### TC-SUB002-007: can_user_earn_sp for Grace Period User
**Objective:** Grace period users should NOT be able to earn SP (wallet frozen)

**Steps:**
1. Run:
   ```sql
   SELECT can_user_earn_sp('<TEST_USER_4_ID>');
   ```

**Expected Result:**
- Returns `FALSE`
- ✅ PASS
- ❌ FAIL if TRUE

---

#### TC-SUB002-008: get_user_transaction_fee for Trial User
**Objective:** Trial users pay subscriber fee ($0.99)

**Steps:**
1. Run:
   ```sql
   SELECT get_user_transaction_fee('<TEST_USER_2_ID>');
   ```

**Expected Result:**
- Returns `99` (cents)
- ✅ PASS
- ❌ FAIL if not 99

---

#### TC-SUB002-009: get_user_transaction_fee for Free User
**Objective:** Free users pay non-subscriber fee ($2.99)

**Steps:**
1. Run:
   ```sql
   SELECT get_user_transaction_fee('<TEST_USER_1_ID>');
   ```

**Expected Result:**
- Returns `299` (cents)
- ✅ PASS
- ❌ FAIL if not 299

---

#### TC-SUB002-010: get_user_transaction_fee for Grace Period User
**Objective:** Grace period users pay non-subscriber fee

**Steps:**
1. Run:
   ```sql
   SELECT get_user_transaction_fee('<TEST_USER_4_ID>');
   ```

**Expected Result:**
- Returns `299` (cents)
- ✅ PASS
- ❌ FAIL if not 299

---

#### TC-SUB002-011: is_user_trial_eligible for New User
**Objective:** User who hasn't used trial should be eligible

**Steps:**
1. Create new user via signup
2. Run:
   ```sql
   SELECT is_user_trial_eligible('<NEW_USER_ID>');
   ```

**Expected Result:**
- Returns `TRUE`
- ✅ PASS
- ❌ FAIL if FALSE

---

#### TC-SUB002-012: is_user_trial_eligible for User Who Used Trial
**Objective:** User who already used trial should NOT be eligible

**Steps:**
1. Run:
   ```sql
   SELECT is_user_trial_eligible('<TEST_USER_2_ID>');
   ```

**Expected Result:**
- Returns `FALSE` (test user 2 has `has_used_trial=TRUE`)
- ✅ PASS
- ❌ FAIL if TRUE

---

#### TC-SUB002-013: record_payment_attempt - Successful Payment
**Objective:** Successful payment resets retry count

**Steps:**
1. First, set retry count to 2:
   ```sql
   UPDATE subscriptions 
   SET payment_retry_count = 2 
   WHERE user_id = '<TEST_USER_3_ID>';
   ```
2. Record successful payment:
   ```sql
   SELECT record_payment_attempt(
     '<TEST_USER_3_ID>',
     TRUE,
     499,
     'ch_test_success'
   );
   ```
3. Check result:
   ```sql
   SELECT payment_retry_count, last_payment_amount, payment_failed_at
   FROM subscriptions
   WHERE user_id = '<TEST_USER_3_ID>';
   ```

**Expected Result:**
- RPC returns `{"success": true, "payment_succeeded": true, "retry_count_reset": true}`
- `payment_retry_count` = 0
- `last_payment_amount` = 499
- `payment_failed_at` = NULL
- ✅ PASS if all match
- ❌ FAIL otherwise

---

#### TC-SUB002-014: record_payment_attempt - Failed Payment
**Objective:** Failed payment increments retry count

**Steps:**
1. Reset retry count:
   ```sql
   UPDATE subscriptions 
   SET payment_retry_count = 0, payment_failed_at = NULL
   WHERE user_id = '<TEST_USER_3_ID>';
   ```
2. Record failed payment:
   ```sql
   SELECT record_payment_attempt(
     '<TEST_USER_3_ID>',
     FALSE
   );
   ```
3. Check result:
   ```sql
   SELECT payment_retry_count, payment_failed_at
   FROM subscriptions
   WHERE user_id = '<TEST_USER_3_ID>';
   ```

**Expected Result:**
- RPC returns `{"success": true, "payment_failed": true, "retry_count": 1, "max_retries_reached": false}`
- `payment_retry_count` = 1
- `payment_failed_at` IS NOT NULL (recent timestamp)
- ✅ PASS if all match
- ❌ FAIL otherwise

---

#### TC-SUB002-015: record_payment_attempt - Max Retries Reached
**Objective:** After 3 failed attempts, flag should be set

**Steps:**
1. Set retry count to 2:
   ```sql
   UPDATE subscriptions 
   SET payment_retry_count = 2
   WHERE user_id = '<TEST_USER_3_ID>';
   ```
2. Record 3rd failed payment:
   ```sql
   SELECT record_payment_attempt(
     '<TEST_USER_3_ID>',
     FALSE
   );
   ```

**Expected Result:**
- RPC returns `{"success": true, "payment_failed": true, "retry_count": 3, "max_retries_reached": true}`
- `payment_retry_count` = 3
- ✅ PASS if `max_retries_reached` = true
- ❌ FAIL otherwise

---

### Test Suite 3: TypeScript Service Integration (iOS/Android Simulator)

#### TC-SUB002-016: getSubscriptionSummary for Free User
**Objective:** Service returns correct summary for free user

**Prerequisites:**
- Test module loaded (you can add a test button in Settings screen)
- Or use React Native Debugger console

**Steps:**
1. Login as Test User 1 (free)
2. Call service function (via test button or console):
   ```typescript
   import { getSubscriptionSummary } from './services/subscription';
   const summary = await getSubscriptionSummary('<USER_ID>');
   console.log(summary);
   ```

**Expected Result:**
```json
{
  "status": "free",
  "is_subscriber": false,
  "can_earn_sp": false,
  "can_spend_sp": false,
  "transaction_fee_cents": 299,
  "tier_name": "Free",
  "subscription_expires_at": null,
  "has_used_trial": false,
  "auto_renew_enabled": true,
  "payment_retry_count": 0
}
```
- ✅ PASS if matches
- ❌ FAIL if any field incorrect

---

#### TC-SUB002-017: getSubscriptionSummary for Trial User
**Objective:** Service returns correct summary for trial user

**Steps:**
1. Login as Test User 2 (trial)
2. Call service function and log result

**Expected Result:**
```json
{
  "status": "trial",
  "is_subscriber": true,
  "can_earn_sp": true,
  "can_spend_sp": true,
  "transaction_fee_cents": 99,
  "tier_name": "Kids Club+",
  "trial_ends_at": "<ISO_DATE>",
  "has_used_trial": true,
  "auto_renew_enabled": true
}
```
- ✅ PASS if matches
- ❌ FAIL if any field incorrect

---

#### TC-SUB002-018: getSubscriptionSummary for Grace Period User
**Objective:** Service correctly identifies frozen SP wallet

**Steps:**
1. Login as Test User 4 (grace_period)
2. Call service function and log result

**Expected Result:**
```json
{
  "status": "grace_period",
  "is_subscriber": false,
  "can_earn_sp": false,
  "can_spend_sp": false,
  "transaction_fee_cents": 299,
  "grace_ends_at": "<ISO_DATE>",
  "cancelled_at": "<ISO_DATE>",
  "payment_retry_count": 3,
  "auto_renew_enabled": false
}
```
- ✅ PASS if SP features disabled and fee is 299
- ❌ FAIL otherwise

---

#### TC-SUB002-019: isTrialEligible Function
**Objective:** Check trial eligibility correctly

**Steps:**
1. For new user (no subscription):
   ```typescript
   const eligible = await isTrialEligible('<NEW_USER_ID>');
   console.log(eligible); // Should be TRUE
   ```
2. For user who used trial:
   ```typescript
   const eligible = await isTrialEligible('<TEST_USER_2_ID>');
   console.log(eligible); // Should be FALSE
   ```

**Expected Result:**
- New users: `TRUE`
- Used trial users: `FALSE`
- ✅ PASS if both correct
- ❌ FAIL otherwise

---

#### TC-SUB002-020: getTransactionFee Function
**Objective:** Correct fee returned based on status

**Steps:**
1. Test with free user:
   ```typescript
   const fee = await getTransactionFee('<TEST_USER_1_ID>');
   console.log(fee); // Should be 299
   ```
2. Test with trial user:
   ```typescript
   const fee = await getTransactionFee('<TEST_USER_2_ID>');
   console.log(fee); // Should be 99
   ```

**Expected Result:**
- Free: 299 cents
- Trial/Active/Paused: 99 cents
- Grace/Expired/Cancelled: 299 cents
- ✅ PASS if all correct
- ❌ FAIL otherwise

---

## 🧪 AUTOMATED TEST EXECUTION

### Run Unit Tests

```bash
cd p2p-kids-marketplace
npm test src/services/__tests__/subscription.test.ts
```

**Expected:** All tests pass (0 failures)

### Run E2E Tests

```bash
npm test src/__tests__/e2e/subscription-sub-002.e2e.ts
```

**Expected:** All E2E tests pass (requires Supabase connection)

---

## ✅ ACCEPTANCE CRITERIA

Task SUB-002 is complete when:

- [ ] All schema columns added successfully
- [ ] All indexes created
- [ ] All 7 RPC functions work correctly
- [ ] TypeScript service functions return correct data
- [ ] Unit tests pass (0 failures)
- [ ] E2E tests pass (0 failures)
- [ ] All manual test cases pass
- [ ] Grace period logic works (SP frozen, 90-day countdown)
- [ ] Payment retry logic works (up to 3 attempts)
- [ ] Transaction fee calculation correct for all statuses
- [ ] Trial eligibility check prevents abuse

---

## 🐛 TROUBLESHOOTING

### Issue: RPC function not found
**Solution:** Ensure migration `20260213000001_subscription_rpcs_sub_002.sql` was applied

### Issue: Column does not exist
**Solution:** Ensure migration `20260213000000_enhance_subscriptions_sub_002.sql` was applied

### Issue: TypeScript service returns free tier for trial user
**Solution:** Check that subscriptions table has a row for the test user with status='trial'

### Issue: Unit tests fail with supabase.rpc is not a function
**Solution:** Check that supabase mock is configured correctly in test file

---

## 📝 TEST RESULTS TEMPLATE

Copy this template to record your test results:

```markdown
# SUB-002 Test Results - [DATE]

## Environment
- [ ] iOS Simulator (version: ___)
- [ ] Android Emulator (version: ___)
- [ ] Supabase Production

## Schema Tests
- [ ] TC-SUB002-001: PASS / FAIL
- [ ] TC-SUB002-002: PASS / FAIL
- [ ] TC-SUB002-003: PASS / FAIL

## RPC Tests
- [ ] TC-SUB002-004: PASS / FAIL
- [ ] TC-SUB002-005: PASS / FAIL
- [ ] TC-SUB002-006: PASS / FAIL
- [ ] TC-SUB002-007: PASS / FAIL
- [ ] TC-SUB002-008: PASS / FAIL
- [ ] TC-SUB002-009: PASS / FAIL
- [ ] TC-SUB002-010: PASS / FAIL
- [ ] TC-SUB002-011: PASS / FAIL
- [ ] TC-SUB002-012: PASS / FAIL
- [ ] TC-SUB002-013: PASS / FAIL
- [ ] TC-SUB002-014: PASS / FAIL
- [ ] TC-SUB002-015: PASS / FAIL

## Service Tests
- [ ] TC-SUB002-016: PASS / FAIL
- [ ] TC-SUB002-017: PASS / FAIL
- [ ] TC-SUB002-018: PASS / FAIL
- [ ] TC-SUB002-019: PASS / FAIL
- [ ] TC-SUB002-020: PASS / FAIL

## Automated Tests
- [ ] Unit tests: PASS / FAIL (X passed, Y failed)
- [ ] E2E tests: PASS / FAIL (X passed, Y failed)

## Notes
[Add any observations, issues, or deviations here]

## Overall Result
- [ ] ✅ ALL TESTS PASSED - SUB-002 COMPLETE
- [ ] ❌ FAILURES DETECTED - SEE NOTES
```

---

**Testing completed by:** _______________  
**Date:** _______________  
**Approved by:** _______________
