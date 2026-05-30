# PAY-001 Manual Testing Guide

**Module:** MODULE-06-TRADE-FLOW-sellerpayouts.md  
**Task:** PAY-001 - Database Schema (Payout Methods + Payout Ledger)  
**Date:** December 28, 2025

---

## Prerequisites

✅ **Before testing:**
1. Migration `073_seller_payouts.sql` must be applied to Supabase production
2. You must have access to Supabase SQL Editor
3. You must be signed in as a test user in the mobile app (for RLS policy tests)

---

## Test Case 1: Verify Tables Exist

**Objective:** Confirm both tables were created successfully

### Steps:
1. Open Supabase Dashboard → SQL Editor
2. Run the following query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('seller_payout_methods', 'seller_payouts');
```

### Expected Result:
```
table_name
----------------------------
seller_payout_methods
seller_payouts
```

**✅ PASS:** Both tables listed  
**❌ FAIL:** One or both tables missing → Re-run migration

---

## Test Case 2: Verify Column Schema

**Objective:** Confirm all columns exist with correct types

### Steps:
1. Run for payout methods:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'seller_payout_methods' 
ORDER BY ordinal_position;
```

2. Run for payouts:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'seller_payouts' 
ORDER BY ordinal_position;
```

### Expected Columns (seller_payout_methods):
- `id` (uuid, NOT NULL)
- `user_id` (uuid, NOT NULL)
- `method_type` (text, NOT NULL)
- `is_primary` (boolean, NOT NULL)
- `is_verified` (boolean, NOT NULL)
- `stripe_account_id` (text, NULL)
- `stripe_onboarding_complete` (boolean, NOT NULL)
- `stripe_payouts_enabled` (boolean, NOT NULL)
- `paypal_email` (text, NULL)
- `venmo_handle` (text, NULL)
- `venmo_phone_e164` (text, NULL)
- `bank_account_token` (text, NULL)
- `bank_account_last4` (text, NULL)
- `bank_routing_last4` (text, NULL)
- `bank_verification_status` (text, NULL)
- `created_at` (timestamp with time zone, NOT NULL)
- `updated_at` (timestamp with time zone, NOT NULL)

### Expected Columns (seller_payouts):
- `id` (uuid, NOT NULL)
- `user_id` (uuid, NOT NULL)
- `trade_id` (uuid, NULL)
- `payout_method_id` (uuid, NULL)
- `currency` (text, NOT NULL)
- `gross_amount_cents` (integer, NOT NULL)
- `platform_fee_cents` (integer, NOT NULL)
- `payout_fee_cents` (integer, NOT NULL)
- `net_amount_cents` (integer, NOT NULL)
- `status` (text, NOT NULL)
- `provider` (text, NULL)
- `provider_reference_id` (text, NULL)
- `idempotency_key` (text, NULL)
- `initiated_at` (timestamp with time zone, NULL)
- `completed_at` (timestamp with time zone, NULL)
- `failure_reason` (text, NULL)
- `created_at` (timestamp with time zone, NOT NULL)
- `updated_at` (timestamp with time zone, NOT NULL)

**✅ PASS:** All columns present with correct types  
**❌ FAIL:** Missing columns → Re-run migration

---

## Test Case 3: Verify Indexes

**Objective:** Confirm performance indexes are created

### Steps:
Run:

```sql
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('seller_payout_methods', 'seller_payouts')
ORDER BY tablename, indexname;
```

### Expected Indexes:

**seller_payout_methods:**
- `seller_payout_methods_pkey` (PRIMARY KEY on id)
- `seller_payout_methods_one_primary_idx` (UNIQUE on user_id WHERE is_primary = TRUE)
- `seller_payout_methods_user_id_idx` (on user_id)
- `seller_payout_methods_method_type_idx` (on method_type)
- `seller_payout_methods_verified_idx` (on user_id, is_verified WHERE is_verified = TRUE)

**seller_payouts:**
- `seller_payouts_pkey` (PRIMARY KEY on id)
- `seller_payouts_user_id_idx` (on user_id)
- `seller_payouts_trade_id_idx` (on trade_id)
- `seller_payouts_status_idx` (on status)
- `seller_payouts_idempotency_key_idx` (UNIQUE on idempotency_key WHERE idempotency_key IS NOT NULL)
- `seller_payouts_provider_reference_idx` (on provider, provider_reference_id)
- `seller_payouts_created_at_idx` (on created_at DESC)

**✅ PASS:** All indexes present  
**❌ FAIL:** Missing indexes → Re-run migration

---

## Test Case 4: Test One-Primary-Method Constraint

**Objective:** Verify only one method can be primary per user

### Steps:
1. Get your user ID from auth:

```sql
SELECT id FROM auth.users WHERE email = 'your-test-email@example.com';
```

2. Insert first primary method (should succeed):

```sql
INSERT INTO seller_payout_methods (
  user_id, 
  method_type, 
  is_primary, 
  is_verified,
  stripe_account_id
) VALUES (
  'YOUR_USER_ID_HERE',
  'stripe_connect',
  true,
  false,
  'acct_test_12345'
) RETURNING id;
```

3. Try to insert second primary method (should fail):

```sql
INSERT INTO seller_payout_methods (
  user_id, 
  method_type, 
  is_primary, 
  is_verified,
  paypal_email
) VALUES (
  'YOUR_USER_ID_HERE',
  'paypal',
  true,
  true,
  'test@example.com'
);
```

### Expected Result:
- First insert: ✅ Success (returns UUID)
- Second insert: ❌ Error containing `seller_payout_methods_one_primary_idx`

**✅ PASS:** Constraint enforced  
**❌ FAIL:** Both inserts succeeded → Constraint not working

**Cleanup:**
```sql
DELETE FROM seller_payout_methods WHERE user_id = 'YOUR_USER_ID_HERE';
```

---

## Test Case 5: Test Net Amount Calculation Constraint

**Objective:** Verify net_amount must equal (gross - platform_fee - payout_fee)

### Steps:
1. Insert payout with correct calculation (should succeed):

```sql
INSERT INTO seller_payouts (
  user_id,
  gross_amount_cents,
  platform_fee_cents,
  payout_fee_cents,
  net_amount_cents,
  status,
  idempotency_key
) VALUES (
  'YOUR_USER_ID_HERE',
  5000,  -- $50.00 gross
  0,     -- $0 platform fee
  50,    -- $0.50 payout fee
  4950,  -- $49.50 net (CORRECT: 5000 - 0 - 50 = 4950)
  'pending',
  'test_valid_calculation'
) RETURNING id;
```

2. Try to insert payout with incorrect calculation (should fail):

```sql
INSERT INTO seller_payouts (
  user_id,
  gross_amount_cents,
  platform_fee_cents,
  payout_fee_cents,
  net_amount_cents,
  status,
  idempotency_key
) VALUES (
  'YOUR_USER_ID_HERE',
  5000,
  0,
  50,
  9999,  -- WRONG: should be 4950
  'pending',
  'test_invalid_calculation'
);
```

### Expected Result:
- First insert: ✅ Success
- Second insert: ❌ Error containing `net_amount_calculation_valid`

**✅ PASS:** Constraint enforced  
**❌ FAIL:** Both inserts succeeded → Constraint not working

**Cleanup:**
```sql
DELETE FROM seller_payouts WHERE user_id = 'YOUR_USER_ID_HERE';
```

---

## Test Case 6: Test Idempotency Key Uniqueness

**Objective:** Verify same idempotency_key cannot be used twice

### Steps:
1. Insert payout with key (should succeed):

```sql
INSERT INTO seller_payouts (
  user_id,
  gross_amount_cents,
  platform_fee_cents,
  payout_fee_cents,
  net_amount_cents,
  status,
  idempotency_key
) VALUES (
  'YOUR_USER_ID_HERE',
  1000,
  0,
  10,
  990,
  'pending',
  'test_unique_key_12345'
) RETURNING id;
```

2. Try to insert another payout with same key (should fail):

```sql
INSERT INTO seller_payouts (
  user_id,
  gross_amount_cents,
  platform_fee_cents,
  payout_fee_cents,
  net_amount_cents,
  status,
  idempotency_key
) VALUES (
  'YOUR_USER_ID_HERE',
  2000,
  0,
  20,
  1980,
  'pending',
  'test_unique_key_12345'  -- SAME KEY
);
```

### Expected Result:
- First insert: ✅ Success
- Second insert: ❌ Error containing `seller_payouts_idempotency_key_idx`

**✅ PASS:** Uniqueness enforced  
**❌ FAIL:** Both inserts succeeded → Index not working

**Cleanup:**
```sql
DELETE FROM seller_payouts WHERE idempotency_key = 'test_unique_key_12345';
```

---

## Test Case 7: Test Method Type Constraints

**Objective:** Verify required fields per method type

### 7A: Stripe Connect (should fail without stripe_account_id)

```sql
INSERT INTO seller_payout_methods (
  user_id, 
  method_type, 
  is_primary
) VALUES (
  'YOUR_USER_ID_HERE',
  'stripe_connect',
  false
);
```

**Expected:** ❌ Error containing `stripe_fields_required_for_stripe`

### 7B: PayPal (should fail without paypal_email)

```sql
INSERT INTO seller_payout_methods (
  user_id, 
  method_type, 
  is_primary
) VALUES (
  'YOUR_USER_ID_HERE',
  'paypal',
  false
);
```

**Expected:** ❌ Error containing `paypal_email_required_for_paypal`

### 7C: Venmo (should fail without venmo_handle OR venmo_phone_e164)

```sql
INSERT INTO seller_payout_methods (
  user_id, 
  method_type, 
  is_primary
) VALUES (
  'YOUR_USER_ID_HERE',
  'venmo',
  false
);
```

**Expected:** ❌ Error containing `venmo_contact_required_for_venmo`

### 7D: Valid Venmo with handle (should succeed)

```sql
INSERT INTO seller_payout_methods (
  user_id, 
  method_type, 
  is_primary,
  venmo_handle
) VALUES (
  'YOUR_USER_ID_HERE',
  'venmo',
  false,
  '@test-user'
) RETURNING id;
```

**Expected:** ✅ Success

**Cleanup:**
```sql
DELETE FROM seller_payout_methods WHERE user_id = 'YOUR_USER_ID_HERE';
```

---

## Test Case 8: Test RLS Policies

**Objective:** Verify users can only see their own data

### Prerequisites:
- Must be signed in to mobile app as test user
- Get your session token from app storage/network inspector

### Steps:
1. In mobile app (or Supabase client with user auth), query:

```typescript
const { data, error } = await supabase
  .from('seller_payout_methods')
  .select('*')
  .eq('user_id', currentUserId);
```

**Expected:** ✅ Returns your methods

2. Try to query another user's methods:

```typescript
const fakeUserId = '00000000-0000-0000-0000-000000000000';
const { data, error } = await supabase
  .from('seller_payout_methods')
  .select('*')
  .eq('user_id', fakeUserId);
```

**Expected:** Returns empty array (RLS blocks access)

### Manual SQL Test (as service role):
1. Create test data for two different users
2. Try to SELECT as first user → should only see their own rows
3. Try to SELECT as second user → should only see their own rows

**✅ PASS:** RLS policies working  
**❌ FAIL:** Can see other users' data → RLS policies broken

---

## Test Case 9: Test Updated_At Trigger

**Objective:** Verify updated_at timestamp changes on UPDATE

### Steps:
1. Insert a method:

```sql
INSERT INTO seller_payout_methods (
  user_id, 
  method_type, 
  is_primary,
  stripe_account_id,
  created_at,
  updated_at
) VALUES (
  'YOUR_USER_ID_HERE',
  'stripe_connect',
  false,
  'acct_test_99999',
  NOW(),
  NOW()
) RETURNING id, created_at, updated_at;
```

2. Wait 2 seconds, then update:

```sql
UPDATE seller_payout_methods
SET is_verified = true
WHERE user_id = 'YOUR_USER_ID_HERE'
AND stripe_account_id = 'acct_test_99999'
RETURNING created_at, updated_at;
```

### Expected Result:
- `updated_at` should be > `created_at` (at least 2 seconds difference)
- `created_at` should remain unchanged

**✅ PASS:** Trigger working  
**❌ FAIL:** updated_at unchanged → Trigger not working

**Cleanup:**
```sql
DELETE FROM seller_payout_methods WHERE user_id = 'YOUR_USER_ID_HERE';
```

---

## Test Case 10: Test Foreign Key Cascades

**Objective:** Verify ON DELETE CASCADE for user_id

### Steps:
1. Create test user in auth.users (or use existing test user)
2. Insert payout method for that user:

```sql
INSERT INTO seller_payout_methods (
  user_id, 
  method_type, 
  is_primary,
  stripe_account_id
) VALUES (
  'TEST_USER_ID',
  'stripe_connect',
  false,
  'acct_test_cascade'
);
```

3. Verify method exists:

```sql
SELECT COUNT(*) FROM seller_payout_methods WHERE user_id = 'TEST_USER_ID';
```

4. Delete user from auth.users:

```sql
DELETE FROM auth.users WHERE id = 'TEST_USER_ID';
```

5. Verify method was cascade-deleted:

```sql
SELECT COUNT(*) FROM seller_payout_methods WHERE user_id = 'TEST_USER_ID';
```

### Expected Result:
- Before delete: COUNT = 1
- After delete: COUNT = 0 (cascaded)

**✅ PASS:** CASCADE working  
**❌ FAIL:** Method still exists → CASCADE not working

---

## Test Case 11: Performance Test - Query by Status

**Objective:** Verify index improves query speed

### Steps:
1. Insert 100 test payout records with various statuses
2. Run query with EXPLAIN ANALYZE:

```sql
EXPLAIN ANALYZE
SELECT * FROM seller_payouts
WHERE status = 'completed';
```

### Expected Result:
- Query plan shows `Index Scan` (not `Seq Scan`)
- Execution time < 50ms

**✅ PASS:** Index used, fast query  
**❌ FAIL:** Sequential scan or slow → Index not working

---

## Summary Checklist

After completing all tests, verify:

- [x] Tables created
- [x] All columns present with correct types
- [x] All indexes created
- [x] One-primary-method constraint enforced
- [x] Net amount calculation constraint enforced
- [x] Idempotency key uniqueness enforced
- [x] Method type field requirements enforced
- [x] RLS policies protect user data
- [x] Updated_at trigger working
- [x] Foreign key cascades working
- [x] Query performance acceptable

---

## Troubleshooting

### Issue: Migration fails with "relation already exists"
**Solution:** Migration is idempotent. Re-run it; it will skip existing objects.

### Issue: RLS policies blocking all queries
**Solution:** Ensure you're authenticated. Check `auth.uid()` returns valid user ID.

### Issue: Constraints not enforcing
**Solution:** Verify constraint exists in pg_constraint table. Drop and re-create if needed.

### Issue: Indexes not improving performance
**Solution:** Run `ANALYZE seller_payouts;` and `ANALYZE seller_payout_methods;` to update statistics.

---

## Next Steps

After all tests pass:
1. ✅ Mark PAY-001 complete
2. ✅ Update MODULE-06-VERIFICATION-V2.md checklist (Section A)
3. → Proceed to PAY-002 (Payout Fee Model + Helpers)

---

**Test Results:**

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: Tables exist | ⬜ | |
| TC2: Columns correct | ⬜ | |
| TC3: Indexes created | ⬜ | |
| TC4: One primary constraint | ⬜ | |
| TC5: Net amount constraint | ⬜ | |
| TC6: Idempotency uniqueness | ⬜ | |
| TC7: Method type constraints | ⬜ | |
| TC8: RLS policies | ⬜ | |
| TC9: Updated_at trigger | ⬜ | |
| TC10: FK cascades | ⬜ | |
| TC11: Performance | ⬜ | |

**Overall Status:** ⬜ PENDING / ✅ PASS / ❌ FAIL

**Tested By:** _______________  
**Date:** _______________  
**Environment:** Production Supabase
