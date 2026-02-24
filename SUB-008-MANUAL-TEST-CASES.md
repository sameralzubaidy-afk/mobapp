# SUB-008 Manual Test Cases

## Module Reference
- **Task**: SUB-008 - User-Initiated Cancellation Flow
- **Module**: MODULE-11-SUBSCRIPTIONS-V2.md
- **Verification**: MODULE-11-VERIFICATION-V2.md

---

## Prerequisites

### Database Setup
Before testing, verify these tables exist and have proper data:

```sql
-- Check subscriptions table has test user
SELECT id, user_id, status, stripe_subscription_id 
FROM subscriptions 
WHERE status IN ('active', 'trial') 
LIMIT 5;

-- Check subscription_tiers has grace_period_days
SELECT id, name, grace_period_days 
FROM subscription_tiers;

-- Check sp_wallets exists for test users
SELECT user_id, available_balance, frozen_at 
FROM sp_wallets 
LIMIT 5;
```

### Required Test Users
| User Type | Subscription Status | SP Activity | Expected Outcome |
|-----------|---------------------|-------------|------------------|
| User A | `active` | Any | → `cancelled` (benefits until period end) |
| User B | `trial` | Has SP earned/spent | → `grace_period` (90 days) |
| User C | `trial` | No SP activity | → `free` |

---

## Test Cases

### TC-001: Navigate to ManageKidsClub Screen

**Platforms**: iOS Simulator, Android Emulator

**Steps**:
1. Launch app and sign in with subscribed user (active or trial)
2. Navigate to Profile/Settings
3. Locate "Manage Kids Club+" or equivalent menu item
4. Tap to open ManageKidsClubScreen

**Expected Results**:
- [ ] Screen loads without errors
- [ ] Current subscription status displayed correctly
- [ ] Subscription tier (plan) name shown
- [ ] Renewal/expiration date shown (if active)
- [ ] "Cancel Kids Club+" button visible and enabled

---

### TC-002: Open Cancellation Modal

**Platforms**: iOS Simulator, Android Emulator

**Precondition**: On ManageKidsClubScreen with active/trial subscription

**Steps**:
1. Tap "Cancel Kids Club+" button
2. Observe modal appearance

**Expected Results**:
- [ ] Modal slides up or fades in smoothly
- [ ] Title: "Cancel Kids Club+"
- [ ] Warning message about losing benefits displayed
- [ ] 6 cancellation reason options visible:
  - "Too expensive"
  - "Not enough items"
  - "Not using enough"
  - "Technical issues"
  - "Moving away"
  - "Other"
- [ ] "Other" allows text input when selected
- [ ] "Keep Subscription" button (dismiss)
- [ ] "Confirm Cancellation" button (danger/red style)

---

### TC-003: Cancel with Reason Selection

**Platforms**: iOS Simulator, Android Emulator

**Precondition**: Cancellation modal is open

**Steps**:
1. Select "Too expensive" reason
2. Tap "Confirm Cancellation"
3. Wait for API response

**Expected Results**:
- [ ] Loading indicator shown during API call
- [ ] Success alert displayed with message about benefits remaining
- [ ] Modal closes automatically
- [ ] Screen refreshes to show new status
- [ ] Status badge changes to "Cancelled" or "Grace Period"

**Database Verification** (run in Supabase SQL Editor):
```sql
SELECT 
  status, 
  cancelled_at, 
  cancel_reason,
  current_period_end
FROM subscriptions 
WHERE user_id = '<TEST_USER_ID>';
```
- [ ] `status` = 'cancelled' (or 'grace_period' for trial+SP)
- [ ] `cancelled_at` = current timestamp
- [ ] `cancel_reason` = 'Too expensive'

---

### TC-004: Active User Cancellation → cancelled

**Platforms**: iOS Simulator, Android Emulator

**Test User**: User with `status = 'active'` and valid Stripe subscription

**Steps**:
1. Sign in as active subscriber
2. Navigate to ManageKidsClub
3. Complete cancellation flow (TC-002 + TC-003)

**Expected Results**:
- [ ] API returns: `new_status = 'cancelled'`
- [ ] Message indicates benefits continue until `current_period_end`
- [ ] SP wallet NOT frozen (active users keep SP until period end)
- [ ] Stripe subscription marked `cancel_at_period_end = true`

**Database Verification**:
```sql
-- Subscription should be cancelled
SELECT status, cancelled_at, current_period_end
FROM subscriptions WHERE user_id = '<USER_ID>';
-- Expected: status='cancelled', cancelled_at=NOW(), period_end=future

-- SP wallet should NOT be frozen
SELECT frozen_at, grace_period_ends_at
FROM sp_wallets WHERE user_id = '<USER_ID>';
-- Expected: frozen_at=NULL, grace_period_ends_at=NULL
```

---

### TC-005: Trial User with SP Activity → grace_period

**Platforms**: iOS Simulator, Android Emulator

**Test User**: User with `status = 'trial'` AND has records in `sp_ledger`

**Setup SQL** (if needed):
```sql
-- Create SP activity for trial user
INSERT INTO sp_ledger (user_id, amount, type, description)
VALUES ('<USER_ID>', 10, 'earned', 'Test SP for SUB-008');
```

**Steps**:
1. Sign in as trial user (with SP history)
2. Navigate to ManageKidsClub
3. Complete cancellation flow

**Expected Results**:
- [ ] API returns: `new_status = 'grace_period'`
- [ ] Message mentions 90-day grace period
- [ ] SP wallet IS frozen

**Database Verification**:
```sql
-- Subscription should be grace_period
SELECT status, grace_started_at, grace_ends_at
FROM subscriptions WHERE user_id = '<USER_ID>';
-- Expected: status='grace_period', grace_started_at=NOW(), grace_ends_at=NOW+90days

-- SP wallet should be frozen
SELECT frozen_at, grace_period_ends_at
FROM sp_wallets WHERE user_id = '<USER_ID>';
-- Expected: frozen_at=NOW(), grace_period_ends_at=NOW+90days
```

---

### TC-006: Trial User without SP Activity → free

**Platforms**: iOS Simulator, Android Emulator

**Test User**: User with `status = 'trial'` AND NO records in `sp_ledger`

**Verification SQL** (confirm no SP):
```sql
SELECT COUNT(*) FROM sp_ledger WHERE user_id = '<USER_ID>';
-- Should return 0
```

**Steps**:
1. Sign in as trial user (without SP)
2. Navigate to ManageKidsClub
3. Complete cancellation flow

**Expected Results**:
- [ ] API returns: `new_status = 'free'`
- [ ] Message indicates downgrade to free tier
- [ ] No grace period messaging

**Database Verification**:
```sql
-- Subscription should be free
SELECT status, cancelled_at
FROM subscriptions WHERE user_id = '<USER_ID>';
-- Expected: status='free', cancelled_at=NOW()

-- SP wallet unchanged (no freeze needed)
SELECT frozen_at, grace_period_ends_at
FROM sp_wallets WHERE user_id = '<USER_ID>';
-- Expected: frozen_at=NULL (no change)
```

---

### TC-007: Custom Cancellation Reason

**Platforms**: iOS Simulator, Android Emulator

**Steps**:
1. Open cancellation modal
2. Select "Other" reason
3. Enter custom text: "Moving to a different app"
4. Confirm cancellation

**Expected Results**:
- [ ] Cancellation succeeds
- [ ] Custom reason stored in database

**Database Verification**:
```sql
SELECT cancel_reason FROM subscriptions WHERE user_id = '<USER_ID>';
-- Expected: cancel_reason='Moving to a different app'
```

---

### TC-008: Dismiss Cancellation Modal

**Platforms**: iOS Simulator, Android Emulator

**Steps**:
1. Open cancellation modal
2. Tap "Keep Subscription" or close button
3. (Alternative) Tap outside modal

**Expected Results**:
- [ ] Modal closes
- [ ] No API call made
- [ ] Subscription status unchanged
- [ ] No database changes

---

### TC-009: Already Cancelled User

**Platforms**: iOS Simulator, Android Emulator

**Test User**: User with `status = 'cancelled'` or `status = 'grace_period'`

**Steps**:
1. Sign in as cancelled/grace_period user
2. Navigate to ManageKidsClub

**Expected Results**:
- [ ] "Cancel" button should be hidden or disabled
- [ ] Screen shows appropriate status badge
- [ ] "Re-subscribe" CTA visible instead
- [ ] Benefits remaining (if any) shown

---

### TC-010: Free User (No Subscription)

**Platforms**: iOS Simulator, Android Emulator

**Test User**: User with `status = 'free'` or no subscription record

**Steps**:
1. Sign in as free user
2. Attempt to navigate to ManageKidsClub

**Expected Results**:
- [ ] Either screen redirects to subscribe flow
- [ ] OR shows "No active subscription" message
- [ ] Cancel button NOT available

---

### TC-011: Network Error Handling

**Platforms**: iOS Simulator, Android Emulator

**Steps**:
1. Enable Airplane Mode on device/simulator
2. Attempt to confirm cancellation

**Expected Results**:
- [ ] Error alert shown: "Network error" or similar
- [ ] Modal remains open (can retry)
- [ ] No partial state changes

---

### TC-012: API Error Handling

**Platforms**: iOS Simulator, Android Emulator

**Simulate**: Edge Function returns error (can use invalid token)

**Expected Results**:
- [ ] Error alert shown with helpful message
- [ ] Modal remains open
- [ ] Subscription state unchanged

---

## Deep Link Testing

### TC-013: Deep Link to ManageKidsClub

**iOS Simulator**:
```bash
xcrun simctl openurl booted 'p2pkidsmarketplace://manage-kids-club'
```

**Android Emulator**:
```bash
adb shell am start -a android.intent.action.VIEW -d "p2pkidsmarketplace://manage-kids-club"
```

**Expected Results**:
- [ ] App opens to ManageKidsClub screen directly
- [ ] Works when app is closed (cold start)
- [ ] Works when app is backgrounded (resume)

---

## Stripe CLI Webhook Testing

### Setup
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local Edge Function
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook-subscriptions
```

### TC-014: Webhook - subscription.updated

```bash
stripe trigger customer.subscription.updated
```

**Expected Results**:
- [ ] Webhook received and processed
- [ ] Local function logs show processing
- [ ] Database updated if applicable

### TC-015: Webhook - subscription.deleted

```bash
stripe trigger customer.subscription.deleted
```

**Expected Results**:
- [ ] Webhook received
- [ ] User moved to grace_period (if SP) or free
- [ ] SP wallet frozen appropriately

---

## Verification Summary Checklist

After all tests pass:

- [ ] **V-SUB-008-01**: User can initiate cancellation from UI
- [ ] **V-SUB-008-02**: Active subscription → cancelled status
- [ ] **V-SUB-008-03**: Trial + SP → grace_period (90 days)
- [ ] **V-SUB-008-04**: Trial - SP → free
- [ ] **V-SUB-008-05**: Cancel reason stored for analytics
- [ ] **V-SUB-008-06**: SP wallet frozen when entering grace_period
- [ ] **V-SUB-008-07**: Benefits preserved until period end
- [ ] **V-SUB-008-08**: Edge Function handles all error cases
- [ ] **V-SUB-008-09**: UI provides clear feedback
- [ ] **V-SUB-008-10**: Deep linking works correctly

---

## Troubleshooting

### Error: "Not logged in"
- Ensure test user is signed in
- Check AuthContext has valid session
- Verify JWT token is passed to Edge Function

### Error: "Subscription not found"
- Verify user has a subscription record
- Check RLS policies on subscriptions table
- Confirm user_id matches authenticated user

### Error: "Stripe error"
- Check STRIPE_SECRET_KEY env var in Edge Function
- Verify stripe_subscription_id is valid
- Confirm Stripe test mode matches env

### Grace period not applied
- Verify sp_ledger has entries for user
- Check subscription_tiers.grace_period_days exists
- Confirm hasSpActivity() query is correct

---

## Related Files

| File | Description |
|------|-------------|
| `supabase/functions/cancel-subscription/index.ts` | Edge Function handler |
| `src/screens/subscription/ManageKidsClubScreen.tsx` | UI screen |
| `src/services/subscription.ts` | Client service (cancelSubscription) |
| `src/navigation/AppNavigator.tsx` | Navigation config (deep link) |
| `src/__tests__/services/subscription-sub-008.unit.test.ts` | Unit tests |
| `src/__tests__/e2e/subscription-sub-008.e2e.ts` | E2E tests |
