# PAY-004 & PAY-005 Quick Start Guide

**⚠️ CRITICAL: Run these SQL commands in Supabase SQL Editor BEFORE testing**

---

## Step 1: Verify Prerequisites

First, check if the core schema from PAY-001 exists:

```sql
-- Check if seller_payout_methods table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('seller_payout_methods', 'seller_payouts');
```

**Expected Result**: Should return 2 rows

**If tables don't exist**: You must run the PAY-001 migration first. See the module document for the full schema.

---

## Step 2: Run Helper Functions Migration

```sql
-- PAY-004 & PAY-005: Additional helper functions
-- File: supabase/migrations/061_seller_payouts_helpers.sql

-- RPC function to atomically set primary payout method
CREATE OR REPLACE FUNCTION set_primary_payout_method(
  p_user_id UUID,
  p_method_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify method belongs to user and is verified
  IF NOT EXISTS (
    SELECT 1 FROM seller_payout_methods
    WHERE id = p_method_id
    AND user_id = p_user_id
    AND is_verified = TRUE
  ) THEN
    RAISE EXCEPTION 'Payout method not found or not verified';
  END IF;

  -- Clear any existing primary for this user
  UPDATE seller_payout_methods
  SET is_primary = FALSE,
      updated_at = NOW()
  WHERE user_id = p_user_id
  AND is_primary = TRUE
  AND id != p_method_id;

  -- Set new primary
  UPDATE seller_payout_methods
  SET is_primary = TRUE,
      updated_at = NOW()
  WHERE id = p_method_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_primary_payout_method TO authenticated;

-- Verification query
SELECT 'RPC function set_primary_payout_method created successfully' AS status;
```

**Expected Output**: "RPC function set_primary_payout_method created successfully"

---

## Step 3: Verify Setup

```sql
-- Verify RPC function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'set_primary_payout_method';

-- Verify indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'seller_payout_methods' 
AND indexname LIKE '%primary%';
```

**Expected Results**:
- RPC function `set_primary_payout_method` exists
- Index `seller_payout_methods_one_primary_idx` exists

---

## Step 4: Deploy Edge Functions

```bash
# Navigate to your project root
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Deploy Stripe Connect functions
supabase functions deploy create-stripe-connect-account
supabase functions deploy create-stripe-account-link

# Deploy PayPal payout function
supabase functions deploy process-paypal-payout

# Deploy webhook handlers
supabase functions deploy paypal-webhook
supabase functions deploy stripe-webhook
```

---

## Step 5: Set Environment Variables

In Supabase Dashboard → Settings → Edge Functions → Secrets:

```bash
STRIPE_SECRET_KEY=<your_stripe_secret_key>
STRIPE_WEBHOOK_SECRET=<your_stripe_webhook_secret>
PAYPAL_CLIENT_ID=<your_paypal_client_id>
PAYPAL_CLIENT_SECRET=<your_paypal_client_secret>
PAYPAL_WEBHOOK_ID=<your_paypal_webhook_id>
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

---

## Step 6: Configure Webhooks

### Stripe Webhook:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://drntwgporzabmxdqykrp.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `account.updated`
   - `payout.created`
   - `payout.paid`
   - `payout.failed`
4. Copy the webhook secret and set as `STRIPE_WEBHOOK_SECRET`

### PayPal Webhook:
1. Go to PayPal Developer Dashboard → Webhooks
2. Add webhook: `https://<your-project>.supabase.co/functions/v1/paypal-webhook`
3. Select all `PAYMENT.PAYOUTS-ITEM.*` events
4. Copy the webhook ID and set as `PAYPAL_WEBHOOK_ID`

---

## Step 7: Test Setup

### Quick Smoke Test:

```sql
-- Insert a test payout method
INSERT INTO seller_payout_methods (
  user_id,
  method_type,
  paypal_email,
  is_primary,
  is_verified,
  stripe_onboarding_complete,
  stripe_payouts_enabled
) VALUES (
  '<YOUR_USER_ID>',
  'paypal',
  'test@example.com',
  false,
  true,
  false,
  false
)
RETURNING id;

-- Get the returned ID and use it below
-- Set it as primary using RPC
SELECT set_primary_payout_method(
  '<YOUR_USER_ID>'::uuid,
  '<METHOD_ID_FROM_ABOVE>'::uuid
);

-- Verify it's primary
SELECT method_type, is_primary, is_verified
FROM seller_payout_methods
WHERE user_id = '<YOUR_USER_ID>';

-- Cleanup
DELETE FROM seller_payout_methods WHERE user_id = '<YOUR_USER_ID>';
```

**Expected**: Method should have `is_primary = true` after RPC call

---

## Step 8: Run Unit Tests

```bash
cd p2p-kids-marketplace

# Run payout fee calculation tests
npm test src/__tests__/payoutFees.test.ts

# Expected: All tests pass
```

---

## Step 9: Manual Testing

Follow **PAY-004-005-MANUAL-TEST-CASES.md** for complete test scenarios.

**Quick test checklist**:
- [ ] Add Stripe Connect method
- [ ] Complete Stripe onboarding
- [ ] Add PayPal method
- [ ] Add Venmo method
- [ ] Set primary method
- [ ] Verify webhook updates

---

## Troubleshooting

**Issue**: RPC function not found
```sql
-- Re-run the CREATE OR REPLACE FUNCTION from Step 2
-- Then grant permissions:
GRANT EXECUTE ON FUNCTION set_primary_payout_method TO authenticated;
```

**Issue**: Edge Function deployment fails
```bash
# Check Supabase CLI is installed
supabase --version

# Login if needed
supabase login

# Link project
supabase link --project-ref <your-project-ref>
```

**Issue**: Webhook signature verification fails
- Ensure `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Ensure `PAYPAL_WEBHOOK_ID` matches PayPal Developer Dashboard

---

## Next Steps

After completing setup and testing:
1. ✅ Verify all test cases in PAY-004-005-MANUAL-TEST-CASES.md
2. ✅ Check MODULE-06-VERIFICATION-V2.md items are satisfied
3. ➡️ Proceed to PAY-006 (Payout Router + Trade Completion Trigger)

---

**End of Quick Start Guide**
