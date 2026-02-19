# MODULE-11 SUB-006: Manual Testing Guide
## Trial-to-Paid Conversion with Stripe Payment

**Module:** MODULE-11-SUBSCRIPTIONS-V2.md  
**Task:** SUB-006 - Stripe Subscription Creation (Post-Trial Conversion)  
**Duration:** 30-45 minutes  
**Environment:** iOS Simulator or Android Emulator

---

## Prerequisites

### Database Setup
Run in Supabase SQL Editor:
```sql
-- Verify Kids Club+ tier exists
SELECT * FROM subscription_tiers WHERE name = 'kids_club_plus';

-- Should show: price_cents = 499 ($4.99), is_active = true
```

### Environment Variables
Verify in Supabase Edge Functions settings:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Edge Functions Deployed
```bash
# Deploy both functions
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase
npx supabase functions deploy setup-subscription-payment
npx supabase functions deploy create-subscription-payment
```

---

## Test Cases

### TEST CASE SUB-006-001: Setup Payment Sheet

**Objective:** Verify SetupIntent creation for payment collection

**Pre-conditions:**
- User has active trial subscription (`status='trial'`)
- User is logged in

**Steps:**
1. Open simulator: `npm run start:android` or `npm run start:ios`
2. Login as test user: `trial-test@test.com`
3. Navigate to "Continue Kids Club+" screen
   - Via app menu → Profile → "Continue Kids Club+"
   - Or via deep link: `navigation.navigate('ContinueKidsClub')`

**Expected Results:**
- ✅ Screen loads showing "Continue Kids Club+" title
- ✅ Shows trial days remaining badge (if < 7 days)
- ✅ Shows benefits list with 5 items
- ✅ Shows pricing card: "$4.99 per month"
- ✅ Shows primary CTA: "Continue Kids Club+" button
- ✅ No errors in console

**Verification Query:**
```sql
SELECT 
  s.status,
  s.trial_end_date,
  s.stripe_customer_id,
  (s.trial_end_date > NOW()) as trial_active
FROM subscriptions s
WHERE s.user_id = '<YOUR_TEST_USER_ID>';
```

---

### TEST CASE SUB-006-002: Present Stripe Payment Sheet

**Objective:** Verify Stripe Payment Sheet displays correctly

**Pre-conditions:**
- Completed TEST CASE SUB-006-001
- Stripe test keys configured

**Steps:**
1. On "Continue Kids Club+" screen, tap "Continue Kids Club+" button
2. Wait for Payment Sheet to load

**Expected Results:**
- ✅ Loading indicator appears during setup
- ✅ Stripe Payment Sheet modal opens
- ✅ Sheet shows "Kids Marketplace" merchant name
- ✅ Shows card input fields:
  - Card number
  - Expiration date
  - CVC
  - ZIP code
- ✅ Shows "Pay $4.99" button (or "Subscribe" depending on Stripe config)

**Console Output (Success):**
```
[useTrialToPaid] Setting up payment sheet...
[setup-subscription-payment] Setting up for user: <user_id>
[setup-subscription-payment] Creating Stripe customer...
[setup-subscription-payment] Creating ephemeral key...
[setup-subscription-payment] Creating setup intent...
[setup-subscription-payment] Setup complete
```

**Console Output (Failure):**
```
[useTrialToPaid] Payment sheet init error: <error message>
```

---

### TEST CASE SUB-006-003: Successful Payment Conversion

**Objective:** Convert trial to paid subscription with successful payment

**Pre-conditions:**
- Completed TEST CASE SUB-006-002
- Use Stripe test card: `4242 4242 4242 4242`

**Steps:**
1. In Payment Sheet, enter test card details:
   - **Card Number:** 4242 4242 4242 4242
   - **Expiration:** Any future date (e.g., 12/34)
   - **CVC:** Any 3 digits (e.g., 123)
   - **ZIP:** Any 5 digits (e.g., 12345)
2. Tap "Pay" button
3. Wait for confirmation

**Expected Results:**
- ✅ Payment Sheet shows processing indicator
- ✅ Payment Sheet closes automatically
- ✅ Success alert appears: "🎉 Success! Your Kids Club+ subscription is now active!"
- ✅ User redirected to Dashboard
- ✅ Profile badge shows "Kids Club+ (Active)" or "Kids Club+ (Trial)" if trial hasn't ended

**Verification Query:**
```sql
SELECT 
  s.status,
  s.stripe_subscription_id,
  s.stripe_payment_method_id,
  s.stripe_customer_id,
  s.current_period_start,
  s.current_period_end,
  s.trial_end_date,
  (s.status = 'active' OR (s.status = 'trial' AND s.stripe_subscription_id IS NOT NULL)) as conversion_success
FROM subscriptions s
WHERE s.user_id = '<YOUR_TEST_USER_ID>';
```

**Expected DB State:**
- `status`: `'active'` (if trial ended) or `'trial'` (if still in trial)
- `stripe_subscription_id`: NOT NULL (e.g., `sub_...`)
- `stripe_payment_method_id`: NOT NULL (e.g., `pm_...`)
- `stripe_customer_id`: NOT NULL (e.g., `cus_...`)
- `current_period_start` and `current_period_end`: NOT NULL

**Stripe Dashboard Verification:**
1. Go to https://dashboard.stripe.com/test/subscriptions
2. Find subscription by customer email
3. Verify:
   - Status: `active` or `trialing`
   - Amount: $4.99/month
   - Payment method attached

---

### TEST CASE SUB-006-004: Payment Cancelled by User

**Objective:** Handle user cancelling payment

**Pre-conditions:**
- Completed TEST CASE SUB-006-002

**Steps:**
1. In Payment Sheet, tap "X" close button OR tap outside modal
2. Observe behavior

**Expected Results:**
- ✅ Payment Sheet closes
- ✅ User returns to "Continue Kids Club+" screen
- ✅ No error alert shown
- ✅ No changes to subscription in database
- ✅ Console shows cancellation (not error):
  ```
  [useTrialToPaid] Payment sheet presentation error: Canceled
  ```

**Verification Query:**
```sql
SELECT stripe_subscription_id, stripe_payment_method_id
FROM subscriptions
WHERE user_id = '<YOUR_TEST_USER_ID>';
```

**Expected:** Both columns should be NULL (no changes)

---

### TEST CASE SUB-006-005: Payment Declined

**Objective:** Handle payment failure gracefully

**Pre-conditions:**
- Completed TEST CASE SUB-006-002
- Use Stripe test card: `4000 0000 0000 0002` (declined card)

**Steps:**
1. In Payment Sheet, enter declined test card:
   - **Card Number:** 4000 0000 0000 0002
   - **Expiration:** Any future date
   - **CVC:** Any 3 digits
   - **ZIP:** Any 5 digits
2. Tap "Pay" button

**Expected Results:**
- ✅ Payment Sheet shows error: "Your card was declined"
- ✅ Payment Sheet remains open (user can retry)
- ✅ No success alert shown
- ✅ User can try different card or cancel

**Verification Query:**
```sql
SELECT stripe_subscription_id, stripe_payment_method_id
FROM subscriptions
WHERE user_id = '<YOUR_TEST_USER_ID>';
```

**Expected:** Both columns should be NULL (no subscription created)

---

### TEST CASE SUB-006-006: Requires Authentication (3D Secure)

**Objective:** Handle 3D Secure authentication flow

**Pre-conditions:**
- Completed TEST CASE SUB-006-002
- Use Stripe test card: `4000 0025 0000 3155` (requires authentication)

**Steps:**
1. In Payment Sheet, enter 3DS test card:
   - **Card Number:** 4000 0025 0000 3155
   - **Expiration:** Any future date
   - **CVC:** Any 3 digits
   - **ZIP:** Any 5 digits
2. Tap "Pay" button
3. In 3DS modal, tap "Authorize Test Payment"

**Expected Results:**
- ✅ Payment Sheet shows authentication challenge
- ✅ 3DS modal appears with "Authorize Test Payment" button
- ✅ After authorization, payment completes successfully
- ✅ Success alert appears
- ✅ Subscription created with payment method attached

---

### TEST CASE SUB-006-007: Non-Trial User Can Start 30-Day Free Period

**Objective:** Verify non-trial users can access Kids Club+ and add payment without immediate charge

**Pre-conditions:**
- User has `status='free'` (no active trial and no active paid subscription)

**Steps:**
1. Login as free user: `free-test@test.com`
2. Navigate to "Continue Kids Club+" screen from Profile
3. Tap primary CTA (e.g., "Start 30-Day Free Trial")
4. Complete Payment Sheet with Stripe test card `4242 4242 4242 4242`
5. Confirm Payment Sheet closes and success alert appears

**Expected Results:**
- ✅ Profile shows Kids Club+ action button for non-active users
- ✅ Continue Kids Club+ screen is accessible for non-trial users
- ✅ Screen shows 30-day free period messaging (no charge today)
- ✅ Payment Sheet opens and accepts payment method
- ✅ User is not charged immediately
- ✅ Subscription is saved with trial window and payment method for future billing

**Verification Query:**
```sql
SELECT 
  s.status,
  s.trial_end_date,
  s.stripe_subscription_id,
  s.stripe_payment_method_id,
  (s.trial_end_date > NOW()) as trial_active
FROM subscriptions s
WHERE s.user_id = '<YOUR_TEST_USER_ID>';
```

**Expected DB State:**
- `status`: `'trial'`
- `trial_end_date`: NOT NULL and in the future (about 30 days)
- `stripe_subscription_id`: NOT NULL
- `stripe_payment_method_id`: NOT NULL

---

## Automated Test Execution

### Unit Tests
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm run test:unit -- --testPathPattern=subscription-sub-006.unit.test.ts
```

**Expected Output:**
```
PASS  src/__tests__/services/subscription-sub-006.unit.test.ts
  SUB-006: Trial-to-Paid Conversion Service
    setupSubscriptionPaymentSheet
      ✓ should return payment setup data on success
      ✓ should return null on error
      ✓ should handle unexpected errors
    convertTrialToPaidSubscription
      ✓ should successfully convert trial to paid subscription
      ✓ should handle API errors
      ✓ should handle missing payment method
      ✓ should handle unexpected errors

Tests: 7 passed, 7 total
```

### E2E Tests
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=subscription-sub-006.e2e.ts --runInBand
```

**Expected Output:**
```
PASS  src/__tests__/e2e/subscription-sub-006.e2e.ts
  SUB-006 E2E: Trial-to-Paid Conversion
    ✓ should verify subscription_tiers table has Kids Club+ tier
    ✓ should verify setup-subscription-payment function is deployed
    ✓ should verify create-subscription-payment function is deployed
    ✓ should verify subscriptions table has stripe columns
    ✓ should verify user has trial subscription
    ✓ should verify Stripe payment method can be attached

Tests: 6 passed, 6 total
```

---

## Troubleshooting

### Issue: Payment Sheet doesn't open
**Cause:** Stripe keys not configured or invalid  
**Fix:**
1. Check Supabase Edge Functions settings
2. Verify `STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`
3. Check console for specific error

### Issue: "Missing authorization header"
**Cause:** User not logged in  
**Fix:**
1. Verify user is logged in: `supabase.auth.getUser()`
2. Check auth token in request headers

### Issue: "Kids Club+ tier not found"
**Cause:** subscription_tiers table not seeded  
**Fix:**
```sql
-- Run this in Supabase SQL Editor
INSERT INTO subscription_tiers (name, display_name, price_cents, is_active, is_default)
VALUES ('kids_club_plus', 'Kids Club+', 499, true, true);
```

### Issue: Subscription created but status still "trial"
**Behavior:** Expected if trial hasn't ended yet  
**Reason:** Stripe subscription respects `trial_end` parameter  
**Verification:** Check `stripe_subscription_id IS NOT NULL` in database

---

## Success Criteria

All test cases must pass with:
- ✅ Payment Sheet displays correctly
- ✅ Test card 4242... completes successfully
- ✅ Declined card 0002 shows error gracefully
- ✅ 3DS card 3155 completes after authentication
- ✅ Database updated with Stripe IDs
- ✅ User receives success confirmation
- ✅ No console errors
- ✅ Unit tests: 7/7 passing
- ✅ E2E tests: 6/6 passing

---

## MODULE-11-VERIFICATION-V2.md Mapping

These test cases satisfy the following verification items:

| Verification Item | Test Case | Status |
|-------------------|-----------|--------|
| VER-SUB-006-001: Edge function `create-subscription-payment` exists | TC SUB-006-001 | ✅ |
| VER-SUB-006-002: Payment Sheet integration works | TC SUB-006-002 | ✅ |
| VER-SUB-006-003: Successful payment creates subscription | TC SUB-006-003 | ✅ |
| VER-SUB-006-004: Payment cancellation handled | TC SUB-006-004 | ✅ |
| VER-SUB-006-005: Payment decline handled | TC SUB-006-005 | ✅ |
| VER-SUB-006-006: 3DS authentication works | TC SUB-006-006 | ✅ |
| VER-SUB-006-007: Non-trial users can start Kids Club+ with 30 free days | TC SUB-006-007 | ✅ |
| VER-SUB-006-008: Stripe IDs saved to DB | TC SUB-006-003 Verification | ✅ |
| VER-SUB-006-009: Mobile UI "Continue Kids Club+" button | TC SUB-006-001 | ✅ |

---

**Test Report Template:**

```
## SUB-006 Manual Test Results
Date: __________
Tester: __________
Environment: iOS Simulator / Android Emulator

| Test Case | Result | Notes |
|-----------|--------|-------|
| SUB-006-001 | ☐ Pass ☐ Fail | |
| SUB-006-002 | ☐ Pass ☐ Fail | |
| SUB-006-003 | ☐ Pass ☐ Fail | |
| SUB-006-004 | ☐ Pass ☐ Fail | |
| SUB-006-005 | ☐ Pass ☐ Fail | |
| SUB-006-006 | ☐ Pass ☐ Fail | |
| SUB-006-007 | ☐ Pass ☐ Fail | |

Overall Result: ☐ PASS ☐ FAIL

Issues Found:
1. 
2. 

Additional Notes:

```
