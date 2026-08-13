# SUB-016 & SUB-017 Manual Test Cases

**Module:** MODULE-11 Subscriptions  
**Tasks:** SUB-016 (Re-Subscribe Flow), SUB-017 (Payment Method Management)  
**Test Date:** _____________  
**Tester:** _____________  
**Environment:** ☐ iOS Simulator  ☐ Android Emulator  ☐ Physical Device  
**Supabase:** Production  
**Stripe:** ☐ Test Mode  ☐ Live Mode  

---

## 🧪 Test Configuration

### Prerequisites

Before starting tests, ensure:

- [ ] Supabase Edge Functions deployed (renew-subscription, get-payment-method, update-auto-renew)
- [ ] Stripe test mode configured with test keys
- [ ] Test users created with known credentials
- [ ] Admin config table has correct Kids Club+ pricing
- [ ] MODULE-09 SP wallet functions are deployed

### Test Data Setup

**Prerequisites:** Create 5 test auth users in Supabase first. Then run the SQL below, replacing `<USER_A_ID>`, `<USER_B_ID>`, etc. with actual UUID values.

#### User A - Active Subscriber
- Status: `active`
- Stripe subscription active
- Saved payment method: Visa 4242
- Auto-renew: enabled
- Has billing history (3+ records)

```sql
-- Create profile for User A
INSERT INTO public.profiles (user_id, name, age, phone_number, phone_verified, node_id)
VALUES ('<USER_A_ID>', 'Test User A', 25, '+11234567801', true, 1)
ON CONFLICT(user_id) DO NOTHING;

-- Create user_subscriptions for User A (Active)
INSERT INTO public.user_subscriptions (
  user_id, 
  status, 
  subscription_tier_id, 
  stripe_customer_id, 
  stripe_subscription_id, 
  stripe_payment_method_id,
  auto_renew_enabled,
  trial_started_at,
  trial_ends_at,
  subscription_started_at,
  current_period_start,
  current_period_end,
  next_billing_date,
  grace_period_starts_at,
  grace_period_ends_at,
  cancelled_at,
  payment_retry_count,
  created_at,
  updated_at
) VALUES (
  '<USER_A_ID>',
  'active'::subscription_status,
  1, -- Kids Club+ tier ID
  'cus_test_a123456789',
  'sub_test_a123456789',
  'pm_test_visa4242',
  true,
  NULL,
  NULL,
  NOW() - INTERVAL '2 months',
  NOW() - INTERVAL '1 month',
  NOW() + INTERVAL '1 month',
  NOW() + INTERVAL '1 month',
  NULL,
  NULL,
  NULL,
  0,
  NOW(),
  NOW()
) ON CONFLICT(user_id) DO UPDATE SET
  status = 'active'::subscription_status,
  stripe_payment_method_id = 'pm_test_visa4242',
  auto_renew_enabled = true;

-- Create sp_wallets for User A (unfrozen, has balance)
INSERT INTO public.sp_wallets (user_id, available_balance, pending_balance, frozen_balance, is_frozen, frozen_at, unfrozen_at)
VALUES ('<USER_A_ID>', 500, 100, 0, false, NULL, NULL)
ON CONFLICT(user_id) DO UPDATE SET
  available_balance = 500,
  pending_balance = 100,
  is_frozen = false;

-- Create billing history records for User A (3+ records)
-- Note: subscription_id is required and references user_subscriptions.id
INSERT INTO public.billing_history (user_id, subscription_id, charge_id, amount, currency, status, description, charged_at, created_at, updated_at)
VALUES
  ('<USER_A_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_A_ID>' LIMIT 1), 'ch_test_a001', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '2 months', NOW(), NOW()),
  ('<USER_A_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_A_ID>' LIMIT 1), 'ch_test_a002', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '1 month', NOW(), NOW()),
  ('<USER_A_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_A_ID>' LIMIT 1), 'ch_test_a003', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW(), NOW(), NOW());
```

#### User B - Grace Period
- Status: `grace_period`
- Cancelled 5 days ago
- Grace period ends in 85 days
- Saved payment method: Mastercard 5555
- SP frozen

```sql
-- Create profile for User B
INSERT INTO public.profiles (user_id, name, age, phone_number, phone_verified, node_id)
VALUES ('<USER_B_ID>', 'Test User B', 28, '+11234567802', true, 1)
ON CONFLICT(user_id) DO NOTHING;

-- Create user_subscriptions for User B (Grace Period - cancelled 5 days ago)
INSERT INTO public.user_subscriptions (
  user_id,
  status,
  subscription_tier_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_payment_method_id,
  auto_renew_enabled,
  trial_started_at,
  trial_ends_at,
  subscription_started_at,
  current_period_start,
  current_period_end,
  next_billing_date,
  grace_period_starts_at,
  grace_period_ends_at,
  cancelled_at,
  payment_retry_count,
  created_at,
  updated_at
) VALUES (
  '<USER_B_ID>',
  'grace_period'::subscription_status,
  1, -- Kids Club+ tier ID
  'cus_test_b123456789',
  'sub_test_b123456789',
  'pm_test_mc5555',
  true,
  NULL,
  NULL,
  NOW() - INTERVAL '4 months',
  NOW() - INTERVAL '1 month',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  NOW() + INTERVAL '85 days',
  NOW() - INTERVAL '5 days',
  0,
  NOW(),
  NOW()
) ON CONFLICT(user_id) DO UPDATE SET
  status = 'grace_period'::subscription_status,
  grace_period_starts_at = NOW() - INTERVAL '5 days',
  grace_period_ends_at = NOW() + INTERVAL '85 days',
  cancelled_at = NOW() - INTERVAL '5 days';

-- Create sp_wallets for User B (frozen, has balance)
INSERT INTO public.sp_wallets (user_id, available_balance, pending_balance, frozen_balance, is_frozen, frozen_at, unfrozen_at)
VALUES ('<USER_B_ID>', 0, 0, 500, true, NOW() - INTERVAL '5 days', NULL)
ON CONFLICT(user_id) DO UPDATE SET
  available_balance = 0,
  pending_balance = 0,
  frozen_balance = 500,
  is_frozen = true,
  frozen_at = NOW() - INTERVAL '5 days';

-- Create billing history records for User B
INSERT INTO public.billing_history (user_id, subscription_id, charge_id, amount, currency, status, description, charged_at, created_at, updated_at)
VALUES
  ('<USER_B_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_B_ID>' LIMIT 1), 'ch_test_b001', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '3 months', NOW(), NOW()),
  ('<USER_B_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_B_ID>' LIMIT 1), 'ch_test_b002', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '2 months', NOW(), NOW()),
  ('<USER_B_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_B_ID>' LIMIT 1), 'ch_test_b003', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '1 month', NOW(), NOW());
```

#### User C - Expired Subscriber
- Status: `expired`
- Grace period ended 10 days ago
- Saved payment method: Amex 3782
- SP frozen

```sql
-- Create profile for User C
INSERT INTO public.profiles (user_id, name, age, phone_number, phone_verified, node_id)
VALUES ('<USER_C_ID>', 'Test User C', 32, '+11234567803', true, 1)
ON CONFLICT(user_id) DO NOTHING;

-- Create user_subscriptions for User C (Expired - grace period ended 10 days ago)
INSERT INTO public.user_subscriptions (
  user_id,
  status,
  subscription_tier_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_payment_method_id,
  auto_renew_enabled,
  trial_started_at,
  trial_ends_at,
  subscription_started_at,
  current_period_start,
  current_period_end,
  next_billing_date,
  grace_period_starts_at,
  grace_period_ends_at,
  cancelled_at,
  payment_retry_count,
  created_at,
  updated_at
) VALUES (
  '<USER_C_ID>',
  'expired'::subscription_status,
  1, -- Kids Club+ tier ID
  'cus_test_c123456789',
  'sub_test_c123456789',
  'pm_test_amex3782',
  true,
  NULL,
  NULL,
  NOW() - INTERVAL '6 months',
  NOW() - INTERVAL '2 months',
  NOW() - INTERVAL '1 month',
  NOW() - INTERVAL '1 month',
  NOW() - INTERVAL '2 months',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '2 months',
  0,
  NOW(),
  NOW()
) ON CONFLICT(user_id) DO UPDATE SET
  status = 'expired'::subscription_status,
  grace_period_ends_at = NOW() - INTERVAL '10 days',
  cancelled_at = NOW() - INTERVAL '2 months';

-- Create sp_wallets for User C (frozen, has balance)
INSERT INTO public.sp_wallets (user_id, available_balance, pending_balance, frozen_balance, is_frozen, frozen_at, unfrozen_at)
VALUES ('<USER_C_ID>', 0, 0, 750, true, NOW() - INTERVAL '2 months', NULL)
ON CONFLICT(user_id) DO UPDATE SET
  available_balance = 0,
  pending_balance = 0,
  frozen_balance = 750,
  is_frozen = true,
  frozen_at = NOW() - INTERVAL '2 months';

-- Create billing history records for User C
INSERT INTO public.billing_history (user_id, subscription_id, charge_id, amount, currency, status, description, charged_at, created_at, updated_at)
VALUES
  ('<USER_C_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_C_ID>' LIMIT 1), 'ch_test_c001', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '5 months', NOW(), NOW()),
  ('<USER_C_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_C_ID>' LIMIT 1), 'ch_test_c002', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '4 months', NOW(), NOW()),
  ('<USER_C_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_C_ID>' LIMIT 1), 'ch_test_c003', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '3 months', NOW(), NOW()),
  ('<USER_C_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_C_ID>' LIMIT 1), 'ch_test_c004', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '2 months', NOW(), NOW());
```

#### User D - No Payment Method
- Status: `grace_period`
- No stripe_payment_method_id in database
- Grace period ends in 60 days

```sql
-- Create profile for User D
INSERT INTO public.profiles (user_id, name, age, phone_number, phone_verified, node_id)
VALUES ('<USER_D_ID>', 'Test User D', 30, '+11234567804', true, 1)
ON CONFLICT(user_id) DO NOTHING;

-- Create user_subscriptions for User D (Grace Period - NO PAYMENT METHOD)
INSERT INTO public.user_subscriptions (
  user_id,
  status,
  subscription_tier_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_payment_method_id,
  auto_renew_enabled,
  trial_started_at,
  trial_ends_at,
  subscription_started_at,
  current_period_start,
  current_period_end,
  next_billing_date,
  grace_period_starts_at,
  grace_period_ends_at,
  cancelled_at,
  payment_retry_count,
  created_at,
  updated_at
) VALUES (
  '<USER_D_ID>',
  'grace_period'::subscription_status,
  1, -- Kids Club+ tier ID
  'cus_test_d123456789',
  'sub_test_d123456789',
  NULL, -- NO PAYMENT METHOD
  true,
  NULL,
  NULL,
  NOW() - INTERVAL '3 months',
  NOW() - INTERVAL '1 month',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  NOW() + INTERVAL '60 days',
  NOW() - INTERVAL '5 days',
  0,
  NOW(),
  NOW()
) ON CONFLICT(user_id) DO UPDATE SET
  status = 'grace_period'::subscription_status,
  stripe_payment_method_id = NULL,
  grace_period_starts_at = NOW() - INTERVAL '5 days',
  grace_period_ends_at = NOW() + INTERVAL '60 days';

-- Create sp_wallets for User D (frozen)
INSERT INTO public.sp_wallets (user_id, available_balance, pending_balance, frozen_balance, is_frozen, frozen_at, unfrozen_at)
VALUES ('<USER_D_ID>', 0, 0, 300, true, NOW() - INTERVAL '5 days', NULL)
ON CONFLICT(user_id) DO UPDATE SET
  available_balance = 0,
  pending_balance = 0,
  frozen_balance = 300,
  is_frozen = true,
  frozen_at = NOW() - INTERVAL '5 days';

-- Create billing history records for User D
INSERT INTO public.billing_history (user_id, subscription_id, charge_id, amount, currency, status, description, charged_at, created_at, updated_at)
VALUES
  ('<USER_D_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_D_ID>' LIMIT 1), 'ch_test_d001', 999, 'USD', 'succeeded'::billing_status, 'Kids Club+ Subscription', NOW() - INTERVAL '2 months', NOW(), NOW()),
  ('<USER_D_ID>', (SELECT id FROM user_subscriptions WHERE user_id = '<USER_D_ID>' LIMIT 1), 'ch_test_d002', 999, 'USD', 'succeeded', 'Kids Club+ Subscription', NOW() - INTERVAL '1 month', NOW(), NOW());
```

#### User E - Free User
- Status: null (never subscribed)
- Has listed items, trades
- No subscription record

```sql
-- Create profile for User E (Free User)
INSERT INTO public.profiles (user_id, name, age, phone_number, phone_verified, node_id)
VALUES ('<USER_E_ID>', 'Test User E', 22, '+11234567805', true, 1)
ON CONFLICT(user_id) DO NOTHING;

-- Note: DO NOT create user_subscriptions record for User E - they are a free user
-- If testing trial flow, user_subscriptions will be created during trial signup

-- Create sp_wallets for User E (unfrozen but zero balance - free users can't earn SP)
INSERT INTO public.sp_wallets (user_id, available_balance, pending_balance, frozen_balance, is_frozen, frozen_at, unfrozen_at)
VALUES ('<USER_E_ID>', 0, 0, 0, false, NULL, NULL)
ON CONFLICT(user_id) DO UPDATE SET
  available_balance = 0,
  pending_balance = 0,
  frozen_balance = 0,
  is_frozen = false;

-- Create a sample listing for User E (optional - for testing)
INSERT INTO public.items (user_id, node_id, title, description, category, condition, price_cents, status, created_at)
VALUES (
  '<USER_E_ID>',
  1,
  'Sample Item for Testing',
  'This is a test item created by User E',
  'toys',
  'like-new',
  2999, -- $29.99
  'active',
  NOW()
) ON CONFLICT DO NOTHING;
```

### How to Run the SQL

1. Open Supabase Dashboard → Project → SQL Editor
2. Create a new query
3. Copy one of the SQL blocks above
4. **Replace placeholders** with actual UUIDs:
   - `<USER_A_ID>` → actual UUID of test user A from auth.users
   - `<USER_B_ID>` → actual UUID of test user B, etc.
5. Click "Run" button
6. Verify no errors in results

**To get user UUIDs from Supabase:**
```sql
SELECT id, email FROM auth.users LIMIT 10;
```

### Stripe Test Cards

Use these for testing:

- **Success:** `4242 4242 4242 4242` (Visa) - expires 12/25, CVC 123
- **Declined:** `4000 0000 0000 0002` - will be declined with card_declined error
- **Requires Auth:** `4000 0025 0000 3155` - requires 3D Secure authentication
- **Expired:** `5200 0000 0000 0007` - past expiry date (12/20)
- **Insufficient Funds:** `4000 0000 0000 9995` - will decline with insufficient_funds

For all test cards, use:
- **Expiry:** Any future date (e.g., 12/25)
- **CVC:** Any 3 digits (e.g., 123)
- **Zip:** Any 5 digits (e.g., 12345)

---

## 📋 Test Cases - SUB-016: Re-Subscribe Flow

### TC-016-01: Grace Period User Re-subscribes with Saved Payment Method

**Objective:** Verify user in grace_period can successfully renew using saved payment method.

**Test User:** User B (Grace Period)

**Steps:**

1. Open app and log in as User B
2. Navigate to: Profile → Manage Kids Club+
3. **Verify:** Status badge shows "Grace Period" in amber
4. **Verify:** Warning message displays: "Your subscription is cancelled. You have X days remaining in your grace period."
5. **Verify:** "Re-subscribe to Kids Club+" button is visible
6. Tap "Re-subscribe to Kids Club+" button
7. **Verify:** Loading indicator appears
8. Wait for API response
9. **Verify:** Success alert displays: "Successfully renewed your Kids Club+ subscription!"
10. Tap "OK" on alert
11. **Verify:** Screen refreshes and shows:
    - Status badge: "Active" (green)
    - Next billing date displayed
    - "Cancel Subscription" button visible
    - No grace period warning
12. Navigate to: Profile → SP Wallet
13. **Verify:** SP wallet is unfrozen (can earn/spend SP)

**Expected Stripe Behavior:**

- Stripe subscription resumed with `cancel_at_period_end=false`
- Immediate charge processed for subscription amount
- Subscription status: `active`

**Expected Database State:**

```sql
-- Check user_subscriptions table
SELECT status, grace_period_ends_at, grace_started_at, next_billing_date, auto_renew_enabled
FROM user_subscriptions
WHERE user_id = '<User B ID>';

-- Expected:
-- status: 'active'
-- grace_period_ends_at: NULL
-- grace_started_at: NULL
-- next_billing_date: <today + 1 month>
-- auto_renew_enabled: true
```

**Pass Criteria:**

- [ ] Status changes from grace_period → active
- [ ] Success alert displayed
- [ ] UI refreshes correctly
- [ ] SP wallet unfrozen
- [ ] Stripe subscription active
- [ ] Billing history record created

---

### TC-016-02: Expired User Re-subscribes

**Objective:** Verify user in expired status can renew subscription.

**Test User:** User C (Expired)

**Steps:**

1. Log in as User C
2. Navigate to: Profile → Manage Kids Club+
3. **Verify:** Status badge shows "Expired" (red or gray)
4. **Verify:** Message: "Your subscription has expired. Re-subscribe to unlock Kids Club+ features."
5. Tap "Re-subscribe to Kids Club+" button
6. **Verify:** Loading indicator appears
7. **Verify:** Success alert: "Successfully renewed your Kids Club+ subscription!"
8. **Verify:** Status changes to "Active"
9. **Verify:** SP wallet unfrozen

**Pass Criteria:**

- [ ] Expired user can re-subscribe
- [ ] Stripe creates new subscription (or resumes if exists)
- [ ] Database status updated to 'active'
- [ ] SP wallet unfrozen

---

### TC-016-03: Grace Period User with No Payment Method

**Objective:** Verify user without saved payment method is prompted to add one.

**Test User:** User D (No Payment Method)

**Steps:**

1. Log in as User D
2. Navigate to: Profile → Manage Kids Club+
3. **Verify:** Status "Grace Period"
4. Tap "Re-subscribe to Kids Club+" button
5. **Verify:** Alert displays: "Payment Method Required" with message "Please add a payment method to renew your subscription."
6. **Verify:** Two buttons: "Cancel" and "Add Payment"
7. Tap "Add Payment"
8. **Verify:** Navigates to SubscriptionPaymentScreen (payment collection screen)
9. Go through payment collection flow
10. **Verify:** Can add card and complete subscription

**Pass Criteria:**

- [ ] Error handled gracefully
- [ ] User prompted to add payment method
- [ ] Navigation to payment screen works
- [ ] Can complete subscription after adding payment

---

### TC-016-04: Re-subscribe with Declined Card

**Objective:** Verify payment failure handling.

**Test User:** User B (but change saved PM to declined card)

**Setup:**

1. Use Supabase SQL Editor to update User B's payment method to a declined test card
2. Or manually add declined card before test

**Steps:**

1. Log in as User B
2. Navigate to: Profile → Manage Kids Club+
3. Tap "Re-subscribe" button
4. **Verify:** Error alert displays: "Your card was declined. Please update your payment method and try again."
5. **Verify:** Status remains "Grace Period"
6. **Verify:** SP wallet remains frozen

**Pass Criteria:**

- [ ] Stripe payment failure caught
- [ ] User-friendly error message displayed
- [ ] Subscription status unchanged
- [ ] No charges to card
- [ ] User can retry

---

### TC-016-05: SP Wallet Integration

**Objective:** Verify SP wallet is properly unfrozen after re-subscribe.

**Test User:** User B (Grace Period with frozen SP)

**Prerequisites:**

- User B has SP balance (e.g., 500 SP frozen)
- Verified frozen in database: `sp_wallets.is_frozen = true`

**Steps:**

1. Log in as User B
2. Navigate to: Profile → SP Wallet
3. **Verify:** Wallet shows frozen state with message
4. **Verify:** Cannot earn or spend SP
5. Navigate back to: Profile → Manage Kids Club+
6. Tap "Re-subscribe" button
7. **Verify:** Success alert
8. Navigate to: Profile → SP Wallet
9. **Verify:** Wallet is unfrozen
10. **Verify:** SP balance still intact (500 SP)
11. **Verify:** Can now earn SP (complete a trade as seller)
12. **Verify:** Can now spend SP (attempt purchase with SP slider)

**Expected Database State:**

```sql
-- Check sp_wallets table
SELECT available_balance, is_frozen, frozen_at, unfrozen_at
FROM sp_wallets
WHERE user_id = '<User B ID>';

-- Expected:
-- available_balance: 500 (unchanged)
-- is_frozen: false
-- frozen_at: <previous timestamp>
-- unfrozen_at: <current timestamp>
```

**Pass Criteria:**

- [ ] SP wallet unfrozen immediately after re-subscribe
- [ ] SP balance preserved
- [ ] Can earn SP again
- [ ] Can spend SP again
- [ ] Database correctly updated

---

## 📋 Test Cases - SUB-017: Payment Method Management

### TC-017-01: Display Saved Payment Method

**Objective:** Verify saved payment method displays correctly.

**Test User:** User A (Active with saved Visa 4242)

**Steps:**

1. Log in as User A
2. Navigate to: Profile → Manage Kids Club+
3. Scroll down to "Payment Method" section
4. **Verify:** Card icon displayed (Visa logo or generic card)
5. **Verify:** Card brand displayed: "Visa"
6. **Verify:** Last 4 digits: "•••• 4242"
7. **Verify:** Expiry date formatted: "12/2025" (or current test card expiry)
8. **Verify:** "Update Payment Method" button visible and enabled
9. **Verify:** No error messages

**Pass Criteria:**

- [ ] Payment method section visible for active user
- [ ] Card details accurate
- [ ] Update button available
- [ ] Loading state not stuck

---

### TC-017-02: No Payment Method State

**Objective:** Verify correct display when no payment method saved.

**Test User:** User E (Free User, never subscribed)

**Steps:**

1. Log in as User E
2. Attempt to start trial (if available)
3. Navigate to: Profile → Manage Kids Club+
4. Look for "Payment Method" section
5. **Verify:** Message: "No payment method saved"
6. **Verify:** "Add Payment Method" button visible
7. Tap "Add Payment Method"
8. **Verify:** Opens payment collection flow (placeholder or Stripe sheet)

**Pass Criteria:**

- [ ] Empty state handled gracefully
- [ ] Clear CTA to add payment method
- [ ] No error shown

---

### TC-017-03: Update Payment Method (Placeholder)

**Objective:** Verify update payment method flow (placeholder implementation).

**Test User:** User A (Active)

**Steps:**

1. Log in as User A
2. Navigate to: Profile → Manage Kids Club+
3. Tap "Update Payment Method" button
4. **Verify:** Alert or placeholder message: "Payment method update coming soon" (or similar)
5. **Verify:** App doesn't crash
6. **Verify:** Returns to Manage screen

**Note:** Full implementation requires Stripe SetupIntent integration (see TODOs in implementation summary).

**Pass Criteria:**

- [ ] Button tap doesn't crash
- [ ] User notified of placeholder state
- [ ] Can return to manage screen

---

### TC-017-04: Auto-Renew Toggle - Enable to Disable

**Objective:** Verify user can disable auto-renewal with confirmation.

**Test User:** User A (Active, auto_renew_enabled=true)

**Prerequisites:**

- Verify in database: `user_subscriptions.auto_renew_enabled = true`
- Verify in Stripe: subscription `cancel_at_period_end = false`

**Steps:**

1. Log in as User A
2. Navigate to: Profile → Manage Kids Club+
3. Scroll to "Auto-Renewal" section
4. **Verify:** Toggle switch is ON (iOS blue/Android green)
5. **Verify:** Label: "Auto-Renewal Enabled"
6. Tap the toggle switch to OFF
7. **Verify:** Confirmation dialog appears:
    - Title: "Disable Auto-Renewal?"
    - Message: "Your subscription will end on [next billing date]. You'll need to manually renew to continue."
    - Buttons: "Cancel" and "Disable"
8. Tap "Cancel" button
9. **Verify:** Dialog closes, toggle remains ON
10. Tap toggle switch again
11. Tap "Disable" button on dialog
12. **Verify:** Loading indicator appears on toggle
13. **Verify:** Success alert: "Auto-renewal disabled. Your subscription will end on [date]."
14. **Verify:** Toggle switch now OFF
15. **Verify:** Warning box appears: "⚠️ Auto-renewal is disabled. Your subscription will end on [date]. Enable auto-renewal to continue uninterrupted access."

**Expected Stripe State:**

```
Subscription cancel_at_period_end: true
Current period end: <next billing date>
Status: active (remains active until period end)
```

**Expected Database State:**

```sql
-- Check user_subscriptions
SELECT auto_renew_enabled, next_billing_date, status
FROM user_subscriptions
WHERE user_id = '<User A ID>';

-- Expected:
-- auto_renew_enabled: false
-- next_billing_date: <unchanged>
-- status: 'active'
```

**Pass Criteria:**

- [ ] Confirmation dialog appears when disabling
- [ ] Cancel button works (no change)
- [ ] Disable button updates toggle
- [ ] Warning appears after disable
- [ ] Stripe subscription updated
- [ ] Database updated
- [ ] Success message accurate

---

### TC-017-05: Auto-Renew Toggle - Disable to Enable

**Objective:** Verify user can re-enable auto-renewal without confirmation.

**Test User:** User A (after TC-017-04, auto_renew_enabled=false)

**Prerequisites:**

- User A has auto_renew_enabled = false
- Subscription still active (before period end)

**Steps:**

1. Log in as User A
2. Navigate to: Profile → Manage Kids Club+
3. **Verify:** Toggle switch is OFF
4. **Verify:** Warning box visible: "Auto-renewal is disabled..."
5. Tap toggle switch to ON
6. **Verify:** NO confirmation dialog appears (immediate action)
7. **Verify:** Loading indicator briefly shown
8. **Verify:** Success alert: "Auto-renewal enabled. Your subscription will automatically renew on [date]."
9. **Verify:** Toggle switch now ON
10. **Verify:** Warning box disappears

**Expected Stripe State:**

```
Subscription cancel_at_period_end: false
Status: active
```

**Expected Database State:**

```sql
-- auto_renew_enabled: true
```

**Pass Criteria:**

- [ ] No confirmation needed when enabling
- [ ] Toggle updates immediately
- [ ] Warning disappears
- [ ] Stripe updated
- [ ] Database updated

---

### TC-017-06: Auto-Renew Toggle - Network Error Handling

**Objective:** Verify error handling when API call fails.

**Test User:** User A

**Setup:**

- Temporarily disable WiFi/data OR use network throttling
- Or temporarily pause Supabase Edge Functions

**Steps:**

1. Log in as User A
2. Disconnect from network
3. Navigate to: Profile → Manage Kids Club+
4. Tap auto-renew toggle
5. **Verify:** Loading indicator appears
6. Wait 10-15 seconds
7. **Verify:** Error alert: "Failed to update auto-renewal. Please check your connection and try again."
8. **Verify:** Toggle reverts to original state
9. Reconnect to network
10. Tap toggle again
11. **Verify:** Success this time

**Pass Criteria:**

- [ ] Network errors caught
- [ ] User-friendly error message
- [ ] Toggle reverts on failure
- [ ] Can retry successfully

---

### TC-017-07: Billing History - View Records

**Objective:** Verify billing history displays correctly.

**Test User:** User A (Active with 3+ billing records)

**Prerequisites:**

- User A has billing_history records:
  - At least 1 succeeded charge
  - At least 1 pending charge (if possible)
  - At least 1 failed charge (optional)

**Steps:**

1. Log in as User A
2. Navigate to: Profile → Manage Kids Club+
3. Scroll to "Billing History" section
4. **Verify:** Link card displays:
    - Icon: 📄 (document icon)
    - Title: "View Billing History"
    - Description: "See your past payments and download invoices"
    - Chevron arrow →
5. Tap "View Billing History" link
6. **Verify:** Navigates to BillingHistoryScreen
7. **Verify:** Screen title: "Billing History"
8. **Verify:** Back button visible and functional
9. **Verify:** List of billing records displayed
10. For each record, verify:
    - Date formatted: "MMM DD, YYYY" (e.g., "Jan 15, 2025")
    - Status badge color:
      - Green for "Succeeded"
      - Amber for "Pending"
      - Red for "Failed"
      - Gray for "Refunded"
    - Description: "Kids Club+ Subscription"
    - Amount: "$9.99" (or configured price)
    - "View Invoice" button visible
11. **Verify:** Records sorted by date (newest first)
12. Tap "View Invoice" on succeeded charge
13. **Verify:** Placeholder message or Stripe invoice opens (if implemented)

**Pass Criteria:**

- [ ] Navigation works
- [ ] All billing records displayed
- [ ] Status badges correct colors
- [ ] Dates formatted correctly
- [ ] Amounts formatted correctly
- [ ] Invoice button present
- [ ] Back navigation works

---

### TC-017-08: Billing History - Empty State

**Objective:** Verify empty state when no billing history exists.

**Test User:** User E (Free user, no billing history)

**Steps:**

1. Log in as User E
2. Start a trial or new subscription
3. Navigate to: Profile → Manage Kids Club+
4. Tap "View Billing History"
5. **Verify:** Empty state displayed:
    - Message: "No billing history yet"
    - Subtext: "Your payment history will appear here"
6. **Verify:** No loading spinner stuck
7. **Verify:** No error message

**Pass Criteria:**

- [ ] Empty state handled gracefully
- [ ] Clear messaging
- [ ] No errors

---

### TC-017-09: Billing History - Pull to Refresh

**Objective:** Verify pull-to-refresh reloads billing records.

**Test User:** User A

**Steps:**

1. Log in as User A
2. Navigate to: BillingHistoryScreen
3. Pull down from top of list (pull-to-refresh gesture)
4. **Verify:** Refresh spinner appears
5. **Verify:** List reloads
6. **Verify:** Spinner disappears after load
7. **Verify:** Records still displayed correctly

**Pass Criteria:**

- [ ] Pull-to-refresh works
- [ ] Data reloads
- [ ] No duplicate records
- [ ] No crashes

---

### TC-017-10: Billing History - Failed Payment Details

**Objective:** Verify failed payment shows error message.

**Test User:** User with failed billing record

**Prerequisites:**

- Create a billing_history record with status='failed' and error_message='Your card was declined'

**Steps:**

1. Log in as test user
2. Navigate to: BillingHistoryScreen
3. Locate failed payment record
4. **Verify:** Status badge is red with text "Failed"
5. **Verify:** Error message displayed below amount: "Your card was declined" (or actual error)
6. **Verify:** Different styling (red text, warning icon, etc.)

**Pass Criteria:**

- [ ] Failed status visually distinct
- [ ] Error message displayed
- [ ] User understands what went wrong

---

## 🧩 Integration Test Cases

### TC-INT-01: Complete Grace Period Recovery Flow

**Objective:** End-to-end test of grace period → re-subscribe → active flow.

**Test User:** User B (Grace Period)

**Steps:**

1. **Initial State:** User B in grace_period, SP frozen
2. Log in to app
3. Navigate to SwipeScreen → attempt to use SP
4. **Verify:** SP slider disabled with message: "Frozen during grace period"
5. Navigate to: Profile → SP Wallet
6. **Verify:** Frozen banner displayed
7. Navigate to: Profile → Manage Kids Club+
8. **Verify:** Grace period warning
9. Tap "Re-subscribe" button
10. **Verify:** Success alert
11. **Verify:** Status → Active
12. Navigate to: Profile → SP Wallet
13. **Verify:** Unfrozen immediately
14. Navigate to: SwipeScreen
15. Complete a purchase with SP slider
16. **Verify:** SP deducted successfully
17. Navigate to: BillingHistoryScreen
18. **Verify:** New billing record appears for renewal

**Pass Criteria:**

- [ ] Complete flow works end-to-end
- [ ] No manual intervention required
- [ ] All state transitions correct
- [ ] SP functionality restored
- [ ] Billing recorded

---

### TC-INT-02: Auto-Renew Disable → Period End → Re-subscribe

**Objective:** Test subscription expiry after disabling auto-renew, then re-subscribe.

**Test User:** User A (Active)

**Steps:**

1. Log in as User A (active subscription, next_billing_date in 5 days)
2. Navigate to: Manage Kids Club+
3. Disable auto-renew
4. **Verify:** Warning appears
5. Wait for subscription period to end (or manually expire in database/Stripe)
6. **Verify:** Subscription status changes to 'expired' (or 'grace_period' depending on config)
7. **Verify:** SP wallet frozen
8. Navigate to: Manage Kids Club+
9. **Verify:** "Re-subscribe" button appears
10. Tap "Re-subscribe"
11. **Verify:** Success, status → active
12. **Verify:** SP unfrozen
13. **Verify:** Auto-renew re-enabled by default

**Pass Criteria:**

- [ ] Auto-renew disable respected
- [ ] Subscription not renewed automatically
- [ ] Grace period or expiry handled
- [ ] Re-subscribe restores access
- [ ] SP wallet lifecycle correct

---

## 🔄 Regression Test Cases

These ensure existing functionality still works.

### TC-REG-01: Cancel Subscription Still Works

**Test User:** User A (Active)

**Steps:**

1. Navigate to: Manage Kids Club+
2. Tap "Cancel Subscription" button
3. Complete cancellation flow (select reason, confirm)
4. **Verify:** Subscription cancelled successfully
5. **Verify:** Status → grace_period or cancelled
6. **Verify:** SP frozen
7. **Verify:** "Re-subscribe" button now appears

**Pass Criteria:**

- [ ] Cancellation flow unchanged
- [ ] No regressions introduced

---

### TC-REG-02: New Subscription Purchase Still Works

**Test User:** User E (Free)

**Steps:**

1. Navigate to: Profile → Continue Kids Club+
2. Enter payment details using Stripe Payment Sheet
3. Complete purchase
4. **Verify:** Trial starts (if configured)
5. **Verify:** Payment method saved to profile
6. Navigate to: Manage Kids Club+
7. **Verify:** New components display:
    - Payment method section shows new card
    - Auto-renew toggle shows ON
    - Billing history shows initial charge

**Pass Criteria:**

- [ ] New subscriptions work
- [ ] Payment method auto-saved
- [ ] New UI components appear for new subscribers

---

## 📊 Test Results Summary

| Test Case | Status | Notes | Tester | Date |
|-----------|--------|-------|--------|------|
| TC-016-01 | ⬜ | | | |
| TC-016-02 | ⬜ | | | |
| TC-016-03 | ⬜ | | | |
| TC-016-04 | ⬜ | | | |
| TC-016-05 | ⬜ | | | |
| TC-017-01 | ⬜ | | | |
| TC-017-02 | ⬜ | | | |
| TC-017-03 | ⬜ | | | |
| TC-017-04 | ⬜ | | | |
| TC-017-05 | ⬜ | | | |
| TC-017-06 | ⬜ | | | |
| TC-017-07 | ⬜ | | | |
| TC-017-08 | ⬜ | | | |
| TC-017-09 | ⬜ | | | |
| TC-017-10 | ⬜ | | | |
| TC-INT-01 | ⬜ | | | |
| TC-INT-02 | ⬜ | | | |
| TC-REG-01 | ⬜ | | | |
| TC-REG-02 | ⬜ | | | |

**Legend:** ☑️ Pass | ❌ Fail | ⏸️ Blocked | ⏭️ Skipped | ⬜ Not Run

---

## 🐛 Bug Report Template

When a test fails, document using this template:

**Test Case ID:** TC-XXX-XX  
**Status:** Failed  
**Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low  

**Description:**  
[Brief description of the bug]

**Steps to Reproduce:**  
1. 
2. 
3. 

**Expected Result:**  
[What should happen]

**Actual Result:**  
[What actually happened]

**Environment:**  
- Device: iOS Simulator / Android Emulator / iPhone 13 / etc.
- OS Version: iOS 17.2 / Android 13 / etc.
- App Version: 
- Supabase: Production
- Stripe Mode: Test / Live

**Screenshots/Logs:**  
[Attach relevant screenshots or console logs]

**Database State (if relevant):**  
```sql
-- Query results showing unexpected state
```

**Workaround:**  
[If available]

**Priority:** ☐ P0 (Blocker) ☐ P1 (Critical) ☐ P2 (Normal) ☐ P3 (Low)

---

## 📝 Notes & Observations

[Space for tester notes during testing session]

- 
- 
- 

---

**Test Session Complete**  
**Date:** _____________  
**Total Test Cases:** 19  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____  
**Pass Rate:** _____%  

**Sign-off:**  
**Tester:** _____________ **Date:** _____________  
**Reviewer:** _____________ **Date:** _____________  
