# PAY-004 & PAY-005 Manual Test Cases

**Module**: MODULE-06-TRADE-FLOW-sellerpayouts  
**Tasks**: PAY-004 (Stripe Connect Express Onboarding), PAY-005 (PayPal/Venmo Payouts)  
**Date**: December 29, 2025  
**Prerequisites**: 
- Supabase production access
- Stripe test account configured
- PayPal sandbox account configured
- Mobile app build with payout features

---

## ⚠️ BEFORE TESTING - SQL SETUP

**IMPORTANT**: You must run these SQL migrations in Supabase SQL Editor BEFORE starting manual tests:

### Step 1: Run Core Schema Migration
```sql
-- File: supabase/migrations/061_seller_payouts.sql
-- (Copy entire contents from the migration file)
```

### Step 2: Run Helper Functions Migration
```sql
-- File: supabase/migrations/061_seller_payouts_helpers.sql
-- (Copy entire contents from the migration file)
```

### Step 3: Verify Tables Created
```sql
-- Verify seller_payout_methods table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'seller_payout_methods';

-- Verify seller_payouts table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'seller_payouts';

-- Verify RPC function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'set_primary_payout_method';
```

**Expected Results**:
- `seller_payout_methods` table has 17 columns
- `seller_payouts` table has 17 columns
- `set_primary_payout_method` RPC function exists

---

## TEST SUITE 1: Stripe Connect Express Onboarding (PAY-004)

### Test Case 1.1: Create Stripe Connect Account

**Objective**: Verify Edge Function creates Stripe connected account

**Preconditions**:
- User is authenticated
- No existing Stripe Connect payout method for user

**Steps**:
1. Open the mobile app
2. Navigate to Profile → Payout Settings
3. Tap "Add Payout Method"
4. Select "Stripe (Bank Transfer)"
5. Tap "Continue to Stripe"

**Expected Results**:
- Loading indicator shown
- Edge Function `/create-stripe-connect-account` called
- Response contains `success: true`, `methodId`, and `stripeAccountId`
- Record created in `seller_payout_methods` table with:
  - `method_type = 'stripe_connect'`
  - `stripe_account_id` populated
  - `is_verified = false`
  - `stripe_onboarding_complete = false`
  - `stripe_payouts_enabled = false`

**Verification Query**:
```sql
SELECT * FROM seller_payout_methods 
WHERE user_id = '<YOUR_USER_ID>' 
AND method_type = 'stripe_connect'
ORDER BY created_at DESC 
LIMIT 1;
```

---

### Test Case 1.2: Create Stripe Account Onboarding Link

**Objective**: Verify Edge Function generates Stripe onboarding URL

**Preconditions**:
- Test Case 1.1 completed successfully
- Stripe Connect account created

**Steps**:
1. After Step 5 from Test Case 1.1
2. Wait for redirect to Stripe onboarding

**Expected Results**:
- Edge Function `/create-stripe-account-link` called
- Response contains `success: true` and valid `url`
- Browser/WebView opens with Stripe onboarding flow
- URL format: `https://connect.stripe.com/setup/s/...`

**Verification**:
- Check console logs for Edge Function call
- Verify URL is opened in browser

---

### Test Case 1.3: Complete Stripe Onboarding (Happy Path)

**Objective**: Verify webhook updates payout method after onboarding completion

**Preconditions**:
- Test Case 1.2 completed
- Stripe onboarding flow opened

**Steps**:
1. Complete Stripe onboarding form (use test data):
   - Business type: Individual
   - Personal details: Test Name, DOB: 01/01/1990
   - Address: 123 Test St, San Francisco, CA 94102
   - Phone: +15555555555
   - SSN (test): 000-00-0000
   - Bank account (test): Routing 110000000, Account 000123456789
2. Submit form
3. Wait for redirect back to app

**Expected Results**:
- Stripe sends `account.updated` webhook
- Webhook handler updates `seller_payout_methods`:
  - `stripe_onboarding_complete = true`
  - `stripe_payouts_enabled = true`
  - `is_verified = true`
- User redirected back to app (URL: `kidsmarketplace://payout-settings?stripe=success`)
- Payout Settings screen shows "Verified" status

**Verification Query**:
```sql
SELECT stripe_onboarding_complete, stripe_payouts_enabled, is_verified
FROM seller_payout_methods
WHERE user_id = '<YOUR_USER_ID>' 
AND method_type = 'stripe_connect';
```

**Expected Query Result**:
```
stripe_onboarding_complete | stripe_payouts_enabled | is_verified
--------------------------|------------------------|------------
true                      | true                   | true
```

---

### Test Case 1.4: Stripe Onboarding Refresh (Incomplete Flow)

**Objective**: Verify user can retry onboarding if incomplete

**Preconditions**:
- Stripe Connect account exists but onboarding incomplete

**Steps**:
1. Exit Stripe onboarding before completing
2. Return to Payout Settings screen
3. Tap on incomplete Stripe method
4. Tap "Complete Setup"

**Expected Results**:
- New account link generated
- User redirected to Stripe onboarding again
- Can complete from where they left off

---

### Test Case 1.5: Set Stripe as Primary Payout Method

**Objective**: Verify RPC sets Stripe method as primary

**Preconditions**:
- Test Case 1.3 completed
- Stripe method verified

**Steps**:
1. In Payout Settings, find Stripe method
2. Tap "Set as Primary"
3. Confirm prompt

**Expected Results**:
- RPC `set_primary_payout_method` called successfully
- Alert: "Success - Primary payout method updated"
- "PRIMARY" badge appears on Stripe method
- Any previous primary method loses badge

**Verification Query**:
```sql
SELECT method_type, is_primary, is_verified 
FROM seller_payout_methods 
WHERE user_id = '<YOUR_USER_ID>';
```

**Expected**: Exactly one row has `is_primary = true`

---

## TEST SUITE 2: PayPal Payouts Integration (PAY-005)

### Test Case 2.1: Add PayPal Payout Method

**Objective**: Verify user can add PayPal email for payouts

**Preconditions**:
- User authenticated
- No existing PayPal method for user

**Steps**:
1. Navigate to Profile → Payout Settings
2. Tap "Add Payout Method"
3. Select "PayPal"
4. Enter PayPal email: `seller-paypal@example.com`
5. Tap "Add PayPal"

**Expected Results**:
- Record inserted into `seller_payout_methods`:
  - `method_type = 'paypal'`
  - `paypal_email = 'seller-paypal@example.com'`
  - `is_primary = false`
  - `is_verified = false` (unverified; manually verify in DB for testing)
- Alert: "Success - PayPal method added successfully"
- Method appears in list with "Not Verified" status

**Verification Query**:
```sql
SELECT * FROM seller_payout_methods 
WHERE user_id = '<YOUR_USER_ID>' 
AND method_type = 'paypal';
```

**Manual Verification for Testing**:
```sql
UPDATE seller_payout_methods
SET is_verified = true, is_primary = true
WHERE user_id = '<YOUR_USER_ID>' 
AND method_type = 'paypal';
```

---

### Test Case 2.2: Add Venmo Payout Method (Handle)

**Objective**: Verify user can add Venmo handle for payouts

**Preconditions**:
- User authenticated

**Steps**:
1. Navigate to Payout Settings
2. Tap "Add Payout Method"
3. Select "Venmo"
4. Enter Venmo handle: `@test-venmo-seller`
5. Leave phone field empty
6. Tap "Add Venmo"

**Expected Results**:
- Record inserted with:
  - `method_type = 'venmo'`
  - `venmo_handle = '@test-venmo-seller'`
  - `venmo_phone_e164 = NULL`
  - `is_verified = false` (unverified; manually verify in DB for testing)
- Alert: "Success"
- Method appears in list with "Not Verified" status

**Verification Query**:
```sql
SELECT venmo_handle, venmo_phone_e164, is_verified 
FROM seller_payout_methods 
WHERE user_id = '<YOUR_USER_ID>' 
AND method_type = 'venmo';
```

**Manual Verification for Testing**:
```sql
UPDATE seller_payout_methods
SET is_verified = true, is_primary = true
WHERE user_id = '<YOUR_USER_ID>' 
AND method_type = 'venmo';
```

---

### Test Case 2.3: Add Venmo Payout Method (Phone)

**Objective**: Verify user can add Venmo phone for payouts

**Preconditions**:
- User authenticated

**Steps**:
1. Navigate to Payout Settings
2. Tap "Add Payout Method"
3. Select "Venmo"
4. Leave handle field empty
5. Enter phone: `+15555551234`
6. Tap "Add Venmo"

**Expected Results**:
- Record inserted with:
  - `venmo_phone_e164 = '+15555551234'`
  - `venmo_handle = NULL`
  - `is_verified = false` (unverified; manually verify in DB for testing)

---

### Test Case 2.4: Process PayPal Payout (Real End-to-End via App UI)

**Objective**: Verify withdrawal flow automatically submits PayPal payout (no curl required)

**Preconditions**:
- PayPal method added (auto-verified) and set as **Primary**
- Available seller balance > $0 (≥ minimum withdrawal amount from admin config)
- Supabase env has valid `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`

**Steps**:
1. Navigate to Profile → Payout Settings
2. Verify PayPal method shows "PRIMARY" and "Verified" badges
3. Check **Available Balance** section (e.g., "$50.00 available")
4. Tap **"Withdraw Now"** button
5. Confirm the withdrawal amount (or tap "Withdraw Full Amount")
6. Observe alert message

**Expected Results** (✨ **NEW** in-app submission):
- A `seller_payouts` record created with `status = 'pending'`
- **Immediately after**, the app calls `/process-paypal-payout` Edge Function
- Payout transitions to `status = 'processing'` with `provider_reference_id` set
- Alert shows:
  ```
  Withdrawal Requested
  Your withdrawal of $50.00 has been initiated. After fees, you will receive $49.00.
  
  Submitted to PayPal. Status: processing.
  ```
- PayPal Payouts API batch created in PayPal sandbox (visible in PayPal dashboard)
- `seller_payouts` record updated:
  - `status = 'processing'`
  - `provider = 'paypal'`
  - `provider_reference_id` = PayPal batch ID
  - `initiated_at` timestamp set

**Verification Query**:
```sql
SELECT status, provider, provider_reference_id, initiated_at, net_amount_cents
FROM seller_payouts
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Query Result**:
```
status     | provider | provider_reference_id | initiated_at
-----------|----------|----------------------|---------
processing | paypal   | <batch_id>           | 2025-12-31 12:00:00+00
```

---

### Test Case 2.5: PayPal Payout Idempotency

**Objective**: Verify duplicate withdrawal attempts don't create duplicate PayPal payouts

**Preconditions**:
- Test Case 2.4 completed
- Payout is in `processing` status with a `provider_reference_id`

**Steps** (Optional - for error case testing):
1. Call `/process-paypal-payout` again with same `payoutId` via curl:
```bash
curl -X POST \
  '<SUPABASE_URL>/functions/v1/process-paypal-payout' \
  -H 'Authorization: Bearer <USER_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"payoutId": "<PAYOUT_ID>"}'
```

**Expected Results**:
- Response returns `{"success": true, "payoutId": "...", "batchId": "<same_id>", "status": "processing"}`
- No duplicate payout created in PayPal (same batch ID returned)
- Database shows same `provider_reference_id`
- Payout remains in `processing` (not double-charged)

**Note**: The withdrawal UI prevents accidental duplicate clicks via the mobile app by disabling the button during submission.

---

### Test Case 2.6: PayPal Webhook - Success Event

**Objective**: Verify webhook updates payout status when PayPal confirms success

**Preconditions**:
- Test Case 2.4 completed (payout in `processing` status)
- PayPal webhook endpoint configured in PayPal sandbox
- Webhook URL: `<SUPABASE_URL>/functions/v1/paypal-webhook`

**Steps**:
1. In PayPal Sandbox, simulate a payout success (or wait for real processing to complete)
2. PayPal will send `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` webhook
3. Supabase webhook handler processes and updates the payout

**For Manual Testing** (if PayPal webhook is not configured yet):
```bash
# Manually trigger webhook handler
curl -X POST \
  '<SUPABASE_URL>/functions/v1/paypal-webhook' \
  -H 'Content-Type: application/json' \
  -H 'paypal-transmission-id: test-id' \
  -H 'paypal-transmission-time: 2025-12-31T00:00:00Z' \
  -H 'paypal-transmission-sig: test-sig' \
  -H 'paypal-cert-url: https://example.com' \
  -H 'paypal-auth-algo: SHA256withRSA' \
  -d '{
    "event_type": "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
    "resource": {
      "payout_batch_id": "<BATCH_ID_FROM_TEST_2.4>",
      "payout_item_id": "test-item-id"
    }
  }'
```

**Expected Results**:
- Webhook handler processes event successfully
- `seller_payouts` updated:
  - `status = 'completed'`
  - `completed_at` timestamp set
- User's balance no longer shows the withdrawn amount (deducted at request time)

**Verification Query**:
```sql
SELECT status, completed_at
FROM seller_payouts
WHERE provider_reference_id = '<BATCH_ID>';
```

---

### Test Case 2.7: PayPal Webhook - Failure Event

**Objective**: Verify webhook handles payout failure (refunds balance)

**Steps**:
1. Simulate PayPal failure webhook:
```bash
curl -X POST \
  '<SUPABASE_URL>/functions/v1/paypal-webhook' \
  -H 'Content-Type: application/json' \
  -H 'paypal-transmission-id: test-id-2' \
  -H 'paypal-transmission-time: 2025-12-31T00:00:00Z' \
  -H 'paypal-transmission-sig: test-sig' \
  -H 'paypal-cert-url: https://example.com' \
  -H 'paypal-auth-algo: SHA256withRSA' \
  -d '{
    "event_type": "PAYMENT.PAYOUTS-ITEM.FAILED",
    "resource": {
      "payout_batch_id": "<BATCH_ID_FROM_TEST_2.4>",
      "payout_item_id": "test-item-id",
      "errors": [{"message": "Insufficient funds in recipient account"}]
    }
  }'
```

**Expected Results**:
- `seller_payouts` updated:
  - `status = 'failed'`
  - `failure_reason = 'Insufficient funds in recipient account'`
- **TODO**: Balance refund logic should be implemented (currently deducted at request time; failed payout does not auto-refund)

**Note**: For now, if a payout fails, the seller must contact support for a manual balance refund.

---

## TEST SUITE 3: Integration Tests

### Test Case 3.1: End-to-End Payout Flow (PayPal)

**Objective**: Verify complete PayPal flow from withdrawal to completion via webhook

**Preconditions**:
- PayPal method added and set as Primary
- Seller balance > minimum withdrawal amount
- PayPal sandbox env configured

**Steps**:
1. Seller navigates to Payout Settings
2. Taps "Withdraw Now" (full or custom amount)
3. App submits withdrawal and immediately submits to PayPal
4. Wait for PayPal webhook (or manually simulate success webhook)

**Expected Results**:
- `seller_payouts` created with `status='pending'`
- Immediately transitions to `status='processing'` with `provider_reference_id` set
- Upon webhook success: `status='completed'` with `completed_at` timestamp
- Payout visible in Payouts History with final status

---

### Test Case 3.2: Multiple Payout Methods Management

**Objective**: Verify user can manage multiple methods

**Steps**:
1. Add Stripe method → Verify → Set as primary
2. Add PayPal method
3. Add Venmo method
4. Switch primary from Stripe to PayPal
5. Delete Venmo method

**Expected Results**:
- All methods visible in list
- Only one primary at a time
- Deleted method removed from list

---

## TEST SUITE 4: Error Handling

### Test Case 4.1: Withdraw with Unverified Stripe Method

**Objective**: Verify cannot withdraw with unverified Stripe method (PayPal/Venmo auto-verified)

**Steps**:
1. Add Stripe Connect method (not yet completed onboarding)
2. Try to tap "Withdraw Now"

**Expected Results**:
- Button disabled OR
- Alert: "Primary payout method is not verified. Complete Stripe setup first."

---

### Test Case 4.2: Missing PayPal Credentials

**Objective**: Verify error handling when credentials missing

**Steps**:
1. Remove `PAYPAL_CLIENT_ID` from Edge Function secrets
2. Try to process PayPal payout

**Expected Results**:
- Edge Function returns 500 error
- Payout status remains `pending`
- Error logged

---

## VERIFICATION SUMMARY CHECKLIST

After completing all tests, verify in MODULE-06-VERIFICATION-V2.md:

- [x] **PAY-004: Stripe Connect Express Onboarding**
  - [x] Edge Function `create-stripe-connect-account` deployed
  - [x] Edge Function `create-stripe-account-link` deployed
  - [x] Webhook handler processes `account.updated` events
  - [x] Payout method marked as verified when payouts enabled

- [x] **PAY-005: PayPal/Venmo Payouts Integration**
  - [x] Edge Function `process-paypal-payout` deployed
  - [x] Idempotency enforced
  - [x] Provider reference ID stored
  - [x] Webhook handler processes payout success/failure events

---

## CLEANUP AFTER TESTING

```sql
-- Remove test payout methods
DELETE FROM seller_payout_methods 
WHERE user_id = '<YOUR_USER_ID>';

-- Remove test payouts
DELETE FROM seller_payouts 
WHERE user_id = '<YOUR_USER_ID>';
```

---

## TROUBLESHOOTING

**Issue**: Stripe onboarding link doesn't open
- **Solution**: Check deep link configuration in app.json
- Verify `returnUrl` and `refreshUrl` format

**Issue**: PayPal webhook signature verification fails
- **Solution**: Implement full certificate verification (currently simplified for MVP)
- Check `PAYPAL_WEBHOOK_ID` matches PayPal dashboard

**Issue**: RPC function not found
- **Solution**: Ensure `061_seller_payouts_helpers.sql` migration was run
- Grant execute permission to authenticated role

---

**End of Manual Test Cases**
