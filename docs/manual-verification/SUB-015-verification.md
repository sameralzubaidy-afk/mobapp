# Manual Verification: SUB-015 — Stripe Payment Sheet Integration

**Module:** MODULE-11 SUBSCRIPTIONS V2  
**Task:** SUB-015: Stripe Payment Sheet Integration (Initial Subscribe & Renew)  
**Platform:** iOS Simulator + Android Emulator  
**Prerequisite:** All automated tests passing ✅

---

## Automated Gates (confirm before opening simulator)
- [ ] `npm test` — PASSED (unit tests for usePaymentSheet and SubscribeButton)
- [ ] `RUN_SUPABASE_E2E=true npm run test:e2e` — PASSED (integration tests)
- [ ] `npm run test:maestro:ios` — PASSED
- [ ] `npm run test:maestro:android` — PASSED
- [ ] CI pipeline green

---

## Pre-Test Setup

### Required Stripe Test Cards
For manual testing with Stripe Payment Sheet, use these test cards:

1. **Success Card**: `4242 4242 4242 4242`
   - Any future expiry date (e.g., 12/34)
   - Any CVV (e.g., 123)
   - Any ZIP code (e.g., 90210)

2. **Decline Card**: `4000 0000 0000 0002`
   - Tests card declined error handling

3. **Insufficient Funds**: `4000 0000 0000 9995`
   - Tests payment failure

### Test User Setup
- **Option A**: Create new user via signup flow (no previous subscription)
- **Option B**: Use existing user in `grace_period` status (for renewal testing)

---

## TC-01: New Subscription — iOS Simulator

**Precondition:** User is logged in, status = `free`, has never subscribed

**Steps:**
1. Launch app on iOS Simulator
2. Tap "Home" tab
3. Tap "Kids Club+" banner or navigate to subscription overview
4. Verify screen shows "Join Kids Club+" header
5. Tap "Subscribe to Kids Club+" button
6. Wait for Stripe Payment Sheet to open (native modal)
7. Verify Payment Sheet displays:
   - "Kids P2P Marketplace" as merchant name
   - Option to enter card details
   - Apple Pay option (if available)
8. Enter test card: `4242 4242 4242 4242`, expiry `12/34`, CVV `123`
9. Tap "Add card" or "Subscribe"
10. Wait for Payment Sheet to close (2-5 seconds)
11. Verify success alert appears: "Success! Welcome to Kids Club+! Your 30-day free trial has started."
12. Tap "OK"
13. Verify navigation to Subscription Status screen
14. Verify subscription status shows `trial`
15. Verify next billing date shows ~30 days from now
16. Navigate to SP Wallet
17. Verify wallet is accessible (subscriber-only feature)

**Expected Result:**
- Payment Sheet opens and collects payment method
- Success alert shown
- User subscription status = `trial`
- Stripe customer ID saved to `profiles.stripe_customer_id`
- Stripe subscription ID saved to `user_subscriptions.stripe_subscription_id`
- Payment method ID saved to `user_subscriptions.stripe_payment_method_id`
- No charge until trial ends (30 days)

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
_________________________________

---

## TC-02: New Subscription — Android Emulator

**Precondition:** User is logged in, status = `free`, has never subscribed

**Steps:**
1. Launch app on Android Emulator
2. Tap "Home" tab
3. Tap "Kids Club+" banner or navigate to subscription overview
4. Verify screen shows "Join Kids Club+" header
5. Tap "Subscribe to Kids Club+" button
6. Wait for Stripe Payment Sheet to open (native modal)
7. Verify Payment Sheet displays:
   - "Kids P2P Marketplace" as merchant name
   - Option to enter card details
   - Google Pay option (if available)
8. Enter test card: `4242 4242 4242 4242`, expiry `12/34`, CVV `123`
9. Tap "Add card" or "Subscribe"
10. Wait for Payment Sheet to close (2-5 seconds)
11. Verify success alert appears
12. Tap "OK"
13. Verify navigation to Subscription Status screen
14. Verify subscription status shows `trial`

**Expected Result:**
- Same as TC-01 but on Android platform
- Google Pay option shown (if enabled)
- Payment collection successful

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
_________________________________

---

## TC-03: User Cancels Payment Sheet — iOS

**Precondition:** User is logged in, status = `free`

**Steps:**
1. Navigate to subscription payment screen
2. Tap "Subscribe to Kids Club+" button
3. Wait for Payment Sheet to open
4. Tap "X" or "Cancel" in Payment Sheet header
5. Verify Payment Sheet closes
6. Verify NO error alert is shown (cancellation is expected behavior)
7. Verify user remains on payment screen
8. Verify button is clickable again

**Expected Result:**
- Payment Sheet closes gracefully
- No error message
- User can retry

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
_________________________________

---

## TC-04: Card Declined Error Handling — iOS

**Precondition:** User is logged in, status = `free`

**Steps:**
1. Navigate to subscription payment screen
2. Tap "Subscribe to Kids Club+" button
3. Wait for Payment Sheet to open
4. Enter declined test card: `4000 0000 0000 0002`, expiry `12/34`, CVV `123`
5. Tap "Add card" or "Subscribe"
6. Wait for Payment Sheet to show error
7. Verify Payment Sheet shows "Your card was declined" message
8. Tap "OK" or close Payment Sheet
9. Verify error alert appears: "Payment Error - Unable to process payment"
10. Tap "OK"
11. Verify user remains on payment screen
12. Verify button is clickable again for retry

**Expected Result:**
- Card decline detected
- Clear error message shown
- User can retry with different card

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
_________________________________

---

## TC-05: Re-Subscribe from Grace Period — iOS

**Precondition:** User is logged in, status = `grace_period`, has frozen SP wallet

**Setup:**
- Manually set user's `user_subscriptions.status` to `grace_period` in Supabase
- Set `grace_ends_at` to 30 days from now
- Ensure SP wallet is frozen

**Steps:**
1. Launch app
2. Navigate to Home or Kids Club+ overview
3. Verify UI shows "grace_period" status
4. Verify message: "Your Swap Points are frozen. You have X days to re-subscribe"
5. Tap "Re-subscribe Now" button
6. Wait for Payment Sheet to open
7. Verify Payment Sheet shows:
   - Previously saved payment method (if any) OR option to add new card
8. If new card needed, enter: `4242 4242 4242 4242`, expiry `12/34`, CVV `123`
9. Tap "Subscribe"
10. Wait for Payment Sheet to close
11. Verify success alert: "Welcome back to Kids Club+! Your Swap Points have been unfrozen."
12. Tap "OK"
13. Verify subscription status changes to `active`
14. Verify `grace_ends_at` is cleared
15. Navigate to SP Wallet
16. Verify wallet shows `status = 'active'` and balance is accessible

**Expected Result:**
- Re-subscription successful
- SP wallet unfrozen
- Status = `active`
- Billing starts immediately (charge today)
- `billing_history` entry created

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
_________________________________

---

## TC-06: Re-Subscribe with Saved Payment Method — iOS

**Precondition:** User previously subscribed and has saved payment method, currently in `grace_period`

**Steps:**
1. Navigate to subscription payment screen
2. Tap "Re-subscribe Now"
3. Wait for Payment Sheet to open
4. Verify Payment Sheet shows saved payment method (e.g., "Visa •••• 4242")
5. Verify "Pay with Visa •••• 4242" is pre-selected
6. Tap "Subscribe" (no need to re-enter card details)
7. Wait for Payment Sheet to close
8. Verify success alert appears
9. Tap "OK"
10. Verify subscription status = `active`

**Expected Result:**
- Saved payment method used
- No need to re-enter card details
- 1-click re-subscribe experience

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
_________________________________

---

## TC-07: Network Error Handling — iOS

**Precondition:** User is logged in

**Setup:**
- Enable Airplane Mode or disable WiFi on simulator
- OR use Network Link Conditioner to simulate poor network

**Steps:**
1. Navigate to subscription payment screen
2. Tap "Subscribe" button
3. Wait for timeout (10-15 seconds)
4. Verify error alert: "Payment Error - Unable to process payment. Please check your connection."
5. Tap "OK"
6. Re-enable network
7. Tap "Subscribe" button again
8. Verify payment succeeds

**Expected Result:**
- Network error handled gracefully
- Clear error message
- Retry succeeds once network restored

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
_________________________________

---

## TC-08: First Charge Creates Billing History — iOS

**Precondition:** User completes new subscription OR re-subscribes from grace

**Steps:**
1. Complete subscription payment (TC-01 or TC-05)
2. After success, open Supabase Studio
3. Go to `billing_history` table
4. Filter by `user_id` = (test user ID)
5. Verify row exists with:
   - `charge_id` = Stripe charge ID (starts with `ch_`)
   - `stripe_invoice_id` = Stripe invoice ID (starts with `in_`)
   - `amount` = 499 (cents)
   - `currency` = 'usd'
   - `status` = 'succeeded'
   - `charged_at` = ~now
   - `description` = 'Kids Club+ Subscription - Initial Payment' OR similar
6. Navigate to app → Profile → Billing History (if screen exists)
7. Verify billing record appears in UI

**Expected Result:**
- Billing history entry created automatically
- All fields populated correctly
- Visible in app UI (if billing history screen implemented)

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
_________________________________

---

## TC-09: Apple Pay / Google Pay Integration — iOS/Android

**Precondition:** Device/simulator supports Apple Pay / Google Pay

**Steps (iOS):**
1. Navigate to subscription payment screen
2. Tap "Subscribe" button
3. Wait for Payment Sheet to open
4. Verify "Apple Pay" option is visible
5. Tap "Apple Pay"
6. Complete Apple Pay authentication (Touch ID / Face ID simulation)
7. Verify payment succeeds
8. Verify success alert shown

**Steps (Android):**
1. Same as above but with Google Pay

**Expected Result:**
- Apple Pay / Google Pay option visible
- Payment completes via native wallet
- Same success flow as card entry

**Status:** ⬜ Pass (iOS) / ⬜ Fail (iOS) | ⬜ Pass (Android) / ⬜ Fail (Android)

**Notes:**
_________________________________

---

## TC-10: Subscription Data Synced to Database — iOS

**Precondition:** User completes new subscription

**Steps:**
1. Complete TC-01 successfully
2. Open Supabase Studio
3. Go to `user_subscriptions` table
4. Filter by `user_id` = (test user ID)
5. Verify fields are populated:
   - `status` = 'trial'
   - `stripe_customer_id` = (starts with `cus_`)
   - `stripe_subscription_id` = (starts with `sub_`)
   - `stripe_payment_method_id` = (starts with `pm_`)
   - `current_period_start` = ~now
   - `current_period_end` = ~30 days from now
   - `next_billing_date` = ~30 days from now
   - `monthly_price_cents` = 499
   - `auto_renew_enabled` = true
   - `trial_ends_at` = ~30 days from now
6. Go to `profiles` table
7. Verify `stripe_customer_id` is saved

**Expected Result:**
- All subscription data synced to DB
- Ready for webhook processing
- Stripe IDs saved correctly

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
_________________________________

---

## Post-Test Verification

### Database Checks (run after TC-01 passes)

```sql
-- Verify subscription record
SELECT 
  status, 
  stripe_customer_id, 
  stripe_subscription_id, 
  stripe_payment_method_id,
  current_period_end,
  next_billing_date
FROM user_subscriptions
WHERE user_id = '<test_user_id>';

-- Verify billing history
SELECT 
  charge_id, 
  amount, 
  status, 
  charged_at, 
  description
FROM billing_history
WHERE user_id = '<test_user_id>'
ORDER BY charged_at DESC
LIMIT 1;

-- Verify Stripe customer ID saved
SELECT stripe_customer_id
FROM profiles
WHERE user_id = '<test_user_id>';
```

**Expected:** All queries return valid data

---

## Summary Checklist

- [ ] TC-01: New subscription on iOS — PASSED
- [ ] TC-02: New subscription on Android — PASSED
- [ ] TC-03: User cancels payment — PASSED
- [ ] TC-04: Card declined error — PASSED
- [ ] TC-05: Re-subscribe from grace — PASSED
- [ ] TC-06: Re-subscribe with saved payment method — PASSED
- [ ] TC-07: Network error handling — PASSED
- [ ] TC-08: Billing history created — PASSED
- [ ] TC-09: Apple Pay / Google Pay — PASSED
- [ ] TC-10: Database sync — PASSED

---

## Regression Impact

Per `ADMIN-CONFIG-IMPACT-REGISTRY.md`, this task does **NOT** change any admin-configurable values.

**Mobile Maestro flows to run:** None (no config value changes)

---

## Known Limitations

1. **Stripe Payment Sheet cannot be fully automated** in Maestro — requires manual card entry
2. **Apple Pay / Google Pay** require device-specific setup — may not work on all simulators
3. **3D Secure authentication** not tested (requires specific test cards)

---

## Test Data Cleanup

After completing all tests, clean up:

```sql
-- Delete test billing records
DELETE FROM billing_history WHERE user_id = '<test_user_id>';

-- Reset subscription status (optional)
UPDATE user_subscriptions 
SET status = 'free', 
    stripe_subscription_id = NULL,
    stripe_payment_method_id = NULL
WHERE user_id = '<test_user_id>';
```

---

**Tester:** _________________  
**Date:** _________________  
**Build:** _________________  
**Result:** ⬜ All Pass / ⬜ Some Failed (see notes)
