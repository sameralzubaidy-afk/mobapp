# SUB-007 Manual Testing Guide — Stripe Webhook Handling

**Module:** MODULE-11-SUBSCRIPTIONS-V2.md  
**Task:** SUB-007 — Stripe Webhook Handling (Status & Billing Updates)  
**Edge Function:** `supabase/functions/stripe-webhook-subscriptions/index.ts`  
**UI Screen:** `SubscriptionStatus` (in-app verification screen)

---

## Prerequisites

Before running any test case:

1. **Deploy the Edge Function** to Supabase prod:
   ```
   supabase functions deploy stripe-webhook-subscriptions --project-ref <your-project-ref>
   ```

2. **Set environment variables** in Supabase Dashboard → Settings → Edge Functions:
   | Key | Value |
   |-----|-------|
   | `STRIPE_SECRET_KEY` | Your Stripe secret key |
   | `STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET` | Webhook signing secret (from Stripe Dashboard) |
   | `SUPABASE_URL` | Already set |
   | `SUPABASE_SERVICE_ROLE_KEY` | Already set |
   | `SP_SUBSCRIPTION_LAPSE_URL` | (Optional) Leave blank until MODULE-09 is deployed |

3. **Register webhook in Stripe Dashboard:**
   - Go to: Stripe Dashboard → Developers → Webhooks → Add Endpoint
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook-subscriptions`
   - Events to listen for:
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy the **Signing Secret** and set as `STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET`

4. **Verify subscription tier configuration (NEW — Dynamic Grace Period):**
   
   **Key Change**: The webhook function now fetches `grace_period_days` dynamically from `subscription_tiers.grace_period_days` instead of using a hardcoded value.
   
   ```sql
   -- Check the grace period setting for Kids Club+ tier
   SELECT id, name, grace_period_days FROM subscription_tiers WHERE name = 'kids_club_plus';
   -- Expected: grace_period_days = 90 (or custom value if reconfigured by admin)
   
   -- Verify test user has a subscription with the correct tier
   SELECT s.id, s.user_id, s.tier_id, st.grace_period_days 
   FROM subscriptions s
   JOIN subscription_tiers st ON st.id = s.tier_id
   WHERE s.user_id = '<TEST_USER_ID>';
   ```
   
   **Implementation Details:**
   - ✅ `handleSubscriptionUpdated()` calls `getGracePeriodDays(supabase, user_id)` 
   - ✅ `handleSubscriptionDeleted()` calls `getGracePeriodDays(supabase, user_id)`
   - ✅ `handleInvoicePaymentFailed()` uses RPC (which also fetches dynamic grace period)
   - ✅ **Graceful fallback:** Returns 90 days if tier fetch fails (with warning log)
   - ✅ **Non-negative validation:** Uses `Math.max(grace_period_days || 90, 0)` to ensure non-negative value

5. **Verify SUB-006 charge source of truth (NEW — Admin Config Driven):**

   **Key Change**: Stripe subscription charge amount and trial window are now read from `admin_config` in
   `setup-subscription-payment` and `create-subscription-payment`.

   ```sql
   -- Verify values used by charge logic
   SELECT key, value, data_type, is_active
   FROM admin_config
   WHERE key IN ('subscription_price_monthly', 'trial_period_days')
   ORDER BY key;

   -- Optional mismatch check: tier price can differ; charge logic still follows admin_config
   SELECT name, price_cents, trial_days
   FROM subscription_tiers
   WHERE name = 'kids_club_plus';
   ```

   **Expected:**
   - `subscription_price_monthly` is numeric and > 0
   - `trial_period_days` is numeric and >= 0
   - Both rows are `is_active = true`

6. **Have a test user** with an active subscription in Stripe (use Stripe test mode).

7. **Navigate to SubscriptionStatus screen** to watch state changes:
   - iOS Simulator: App → (navigate to AdminDashboard or use the link added in step 12)
   - Go to: Dashboard → SubscriptionStatus route

---

## How to Navigate to the Verification Screen

From the app running in iOS or Android simulator:

1. Log in as a test user who has a subscription
2. From the Dashboard screen, navigate to **Subscription Status** screen:
   - Route name: `SubscriptionStatus`
   - If not directly linked from dashboard, use the Dev Menu deep link or add a button temporarily

---

## Test Cases

---

### TC-007-00: Verify subscription charge config keys exist (admin_config)

**Objective:** Ensure SUB-006 charge logic dependencies are present before running webhook scenarios.

**Steps:**
1. In Supabase SQL Editor, run:
   ```sql
   SELECT key, value, data_type, is_active
   FROM admin_config
   WHERE key IN ('subscription_price_monthly', 'trial_period_days')
   ORDER BY key;
   ```

**Expected Result:**
- Two rows returned: `subscription_price_monthly`, `trial_period_days`
- Both rows are active (`is_active = true`)
- Values parse as numeric

**Pass Criteria:** ✅ Config keys exist and are valid

---

### TC-007-01: Webhook signature verification (invalid signature rejected)

**Objective:** Confirm the function rejects requests with invalid signatures.

**Steps:**
1. Open terminal
2. Send a POST with a bad signature:
   ```
   curl -X POST https://drntwgporzabmxdqykrp.supabase.co/functions/v1/stripe-webhook-subscriptions \
     -H "stripe-signature: t=bad,v1=notreal" \
     -H "Content-Type: application/json" \
     -d '{"type":"customer.subscription.updated","data":{"object":{}}}'
   ```

**Expected Result:**
- HTTP 400
- Body: `{"error":{"code":"INVALID_SIGNATURE","message":"..."}}`

**Pass Criteria:** ✅ 400 status, no DB change

> Note: `stripe trigger ...` uses Stripe CLI fixture data (commonly `$15.00`) and does **not** read your app's `admin_config.subscription_price_monthly`. This is expected for webhook signature/event-shape testing.

# forward a test trigger to your registered webhooks (Stripe will sign it)
stripe trigger customer.subscription.updated

stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
---

### TC-007-02: customer.subscription.updated → status stays 'active'

**Objective:** Active subscription renewal keeps status as active.

**Steps:**
1. In Stripe Dashboard (Test mode) → Subscriptions
2. Find your test subscription
3. Trigger a manual event: `customer.subscription.updated` with `status: "active"`, `cancel_at_period_end: false`
   - Via Stripe CLI: `stripe trigger 
   
4. Open the SubscriptionStatus screen in the simulator
5. Pull down to refresh

**Expected Result:**
- Status badge shows **ACTIVE**
- `current_period_end` updates to new date
- No grace period fields set

**Pass Criteria:** ✅ status = 'active'

> Important: The amount shown on Stripe objects created by `stripe trigger customer.subscription.updated` is fixture-driven and may appear as `$15.00`. This does not indicate a pricing bug in app billing logic.

### TC-007-02A: Validate real subscription charge amount from admin_config (NEW)

**Objective:** Verify the actual app-created Stripe subscription uses `admin_config.subscription_price_monthly`.

**Steps:**
1. Confirm configured value in DB:
   ```sql
   SELECT key, value, data_type, is_active
   FROM admin_config
   WHERE key = 'subscription_price_monthly';
   ```
2. In the app, start/continue Kids Club+ using the normal payment flow (calls `setup-subscription-payment` then `create-subscription-payment`).
3. In Stripe Dashboard, open the new subscription created from that app flow (not Stripe CLI fixture).
4. Verify line item amount matches configured admin price.

**Expected Result:**
- Stripe subscription amount equals `admin_config.subscription_price_monthly` interpreted in dollars (e.g., `1500` => `$1500.00`, `15` => `$15.00`).
- CLI fixture subscriptions may still show `$15.00` and should be ignored for pricing assertions.

**Pass Criteria:** ✅ App-created subscription amount matches admin config

---

### TC-007-03: customer.subscription.updated → status becomes 'cancelled' (cancel_at_period_end = true)

**Objective:** When user schedules cancellation, status becomes 'cancelled'.

**Steps:**
1. In Stripe Dashboard → find test subscription → Cancel at period end
   - Or via Stripe CLI (Recommended for instant webhook):
     ```bash
     stripe trigger customer.subscription.updated \
          --override subscription_updated:cancel_at_period_end=true
     ```
   - Or update actual subscription (slower, relies on Stripe retry schedule):
     ```bash
     stripe subscriptions update sub_1T3jfR4I6kCJlvXotmkeWMDv -d cancel_at_period_end=true
     ```
2. Verify webhook delivery in Stripe Dashboard → Developers → Webhooks → endpoint `stripe-webhook-subscriptions`.
    - Confirm event type is `customer.subscription.updated`
    - Confirm delivery response is `2xx`
3. Check Supabase Edge Function logs to confirm handler logs:
    - `Received event: customer.subscription.updated`
    - `handleSubscriptionUpdated: user=... status=cancelled`
4. Refresh SubscriptionStatus screen.

**Expected Result:**
- Status badge shows **CANCELED** (or **CANCELLED** if your UI label still uses UK spelling)
- `current_period_end` still shows future date (access not revoked yet)
- `grace_started_at` is **null** (grace hasn't started yet)

**Pass Criteria:** ✅ status = 'canceled' (or legacy 'cancelled'), no grace fields set yet

---

### TC-007-04: customer.subscription.deleted → status becomes 'grace_period' + 90-day window

**Objective:** Stripe deletion moves user into 90-day grace period.

**Steps:**
1. In Stripe Dashboard → find test subscription → Cancel immediately
   - Or via Stripe CLI: `stripe trigger customer.subscription.deleted`
2. Open SubscriptionStatus screen → pull to refresh

**Expected Result:**
- Status badge shows **GRACE_PERIOD** (red)
- **Grace Period Active** card appears
- `grace_started_at` = time you triggered the webhook
- `grace_ends_at` = approximately 90 days from now
- **Remaining** shows ~90 days

**Pass Criteria:** ✅ status = 'grace_period', grace_ends_at ≈ now + 90 days

---

### When are TC-007-05/06/07 retry tests valid?

These retry test cases are valid when all of the following are true:
- Subscription is still billable (`active` or `trialing`), not already deleted.
- Stripe attempts to charge and emits `invoice.payment_failed`.
- Multiple failed payment attempts are sent for the same user/subscription lifecycle.

Important:
- `cancel_at_period_end=true` is a cancellation-scheduling scenario (TC-007-03), not a payment-retry scenario.
- For retry tests with your real test subscription, use `sub_1T2NO44I6kCJlvXo9rj26jW9` and force card-decline payment attempts.

---

### TC-007-05: invoice.payment_failed (1st failure) → retry_count = 1, status still active

**Objective:** First payment failure increments retry count, access not revoked.

**Steps:**
1. Get customer for your subscription:
   ```bash
   stripe subscriptions retrieve sub_1T2NO44I6kCJlvXo9rj26jW9
   ```
   - Copy `customer` value (`cus_...`).
2. Use Stripe's built-in decline test PaymentMethod ID (no raw card number input):
   ```bash
   export PM_DECLINE=pm_card_chargeDeclined
   ```
   - This avoids passing full PAN data to Stripe API.
3. Attach + set as default:
   ```bash
   stripe payment_methods attach "$PM_DECLINE" -d customer=<cus_id>
   stripe customers update <cus_id> -d "invoice_settings[default_payment_method]=$PM_DECLINE"
   stripe subscriptions update sub_1T2NO44I6kCJlvXo9rj26jW9 -d default_payment_method=$PM_DECLINE -d cancel_at_period_end=false
   ```
4. Create/finalize/pay invoice to force first `invoice.payment_failed`:
   ```bash
   stripe invoices create -d customer=<cus_id> -d subscription=sub_1T2NO44I6kCJlvXo9rj26jW9 -d auto_advance=false
   stripe invoices finalize_invoice <in_id>
   stripe invoices pay <in_id>
   ```
5. Verify webhook delivery + refresh SubscriptionStatus.
6. Verify DB:
   ```sql
   SELECT stripe_subscription_id, status, payment_retry_count, payment_failed_at, grace_ends_at
   FROM subscriptions
   WHERE stripe_subscription_id = 'sub_1T2NO44I6kCJlvXo9rj26jW9';
   ```

**Expected Result:**
- **Payment Failures** card appears (amber border)
- Retry count shows: **1 / 3**
- Status still shows **ACTIVE**

**Pass Criteria:** ✅ payment_retry_count = 1, status = 'active'

---

### TC-007-06: invoice.payment_failed (2nd failure) → retry_count = 2

**Objective:** Second failure increments to 2.

**Steps:**
1. Trigger second failed attempt (same unpaid invoice):
   ```bash
   stripe invoices pay <in_id>
   ```
   - If invoice is no longer payable, create a new one with the same `create/finalize/pay` flow from TC-007-05.
2. Verify webhook delivery includes `invoice.payment_failed`.
3. Refresh SubscriptionStatus.
4. Verify DB:
   ```sql
   SELECT stripe_subscription_id, status, payment_retry_count, payment_failed_at, grace_ends_at
   FROM subscriptions
   WHERE stripe_subscription_id = 'sub_1T2NO44I6kCJlvXo9rj26jW9';
   ```

**Expected Result:**
- Retry count shows: **2 / 3**
- Status still **ACTIVE**

**Pass Criteria:** ✅ payment_retry_count = 2, status = 'active'

---

### TC-007-07: invoice.payment_failed (3rd failure) → grace_period + SP frozen

**Objective:** After 3 failures, user enters grace period.

**Steps:**
1. Trigger third failed attempt:
   ```bash
   stripe invoices pay <in_id>
   ```
   - If needed, use a new invoice with the same decline payment method.
2. Verify webhook delivery includes `invoice.payment_failed`.
3. Refresh SubscriptionStatus.
4. Verify DB:
   ```sql
   SELECT stripe_subscription_id, status, payment_retry_count, payment_failed_at, grace_started_at, grace_ends_at
   FROM subscriptions
   WHERE stripe_subscription_id = 'sub_1T2NO44I6kCJlvXo9rj26jW9';
   ```

**Expected Result:**
- Retry count shows: **3 / 3**
- Status badge changes to **GRACE_PERIOD**
- Warning: "Max retries reached — user has entered grace period."
- Grace Period card appears with 90-day countdown
- Check Supabase prod → subscriptions table → confirm: `status = 'grace_period'`, `grace_ends_at` is set

**Pass Criteria:** ✅ payment_retry_count = 3, status = 'grace_period', grace_ends_at set

---

### TC-007-08: SP cannot be earned in grace_period

**Objective:** Confirm `can_user_earn_sp` RPC returns false for grace_period users.

**Steps:**
1. After TC-007-07 (user is in grace_period)
2. In Supabase SQL Editor (prod), run:
   ```sql
   SELECT public.can_user_earn_sp('<TEST_USER_UUID>');
   ```

**Expected Result:**
- Returns `false`

**Pass Criteria:** ✅ `can_user_earn_sp = false`

---

### TC-007-09: Stripe webhook signature missing → 400 error

**Objective:** Confirm missing signature header returns 400, not 500.

**Steps:**
1. Send POST without stripe-signature header:
   ```
   curl -X POST https://<project>.supabase.co/functions/v1/stripe-webhook-subscriptions \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

**Expected Result:**
- HTTP 400
- Body includes `"code":"MISSING_SIGNATURE"`

**Pass Criteria:** ✅ 400, structured error body

---

### TC-007-10: Verify subscriptions lookups use stripe_subscription_id

**Objective:** Confirm no ambiguous column errors — webhook can find the user's subscription.

**Steps:**
1. In Supabase SQL Editor (prod), run:
   ```sql
   EXPLAIN (VERBOSE)
   SELECT id, user_id, status
   FROM subscriptions s
   WHERE s.stripe_subscription_id = 'sub_test_123';
   ```

**Expected Result:**
- No "column reference is ambiguous" error
- Uses index on `stripe_subscription_id`

**Pass Criteria:** ✅ Query executes without errors

---

## Database Verification Queries

Run these in Supabase SQL Editor after tests:

```sql
-- 1. Check subscription state for a user
SELECT
  id, status, payment_retry_count, payment_failed_at,
  grace_started_at, grace_ends_at, current_period_end, updated_at
FROM subscriptions
WHERE user_id = '<TEST_USER_UUID>'
ORDER BY updated_at DESC
LIMIT 1;

-- 2. Verify can_user_earn_sp respects grace_period
SELECT public.can_user_earn_sp('<TEST_USER_UUID>');

-- 3. Verify record_payment_attempt RPC increments correctly
SELECT public.record_payment_attempt('<TEST_USER_UUID>', false);

-- 4. Check edge function is deployed
SELECT
  name, status
FROM pg_stat_user_functions
WHERE proname LIKE 'stripe%';
```

---

## Supabase Dashboard Verification

1. Go to: Supabase Dashboard → Edge Functions → `stripe-webhook-subscriptions`
2. Check **Logs** tab after triggering each test case
3. Confirm log messages like:
   - `[stripe-webhook-subscriptions] Received event: customer.subscription.updated id=evt_...`
   - `[stripe-webhook-subscriptions] handleSubscriptionUpdated: user=<uuid> status=active`
   - `[stripe-webhook-subscriptions] handleInvoicePaymentFailed: user=<uuid> retry_count=1 max=false`

### Common Failure Mode: Stripe deliveries return `401 Missing authorization header`

**Cause:** JWT verification is enabled for `stripe-webhook-subscriptions`, but Stripe does not send Supabase Authorization headers.

**Fix:** Disable JWT verification for this function and redeploy.

```toml
# supabase/config.toml
[functions.stripe-webhook-subscriptions]
verify_jwt = false
```

Then redeploy:

```bash
supabase functions deploy stripe-webhook-subscriptions --project-ref <your-project-ref>
```

Optional explicit deploy flag (if your CLI supports it):

```bash
supabase functions deploy stripe-webhook-subscriptions --project-ref <your-project-ref> --no-verify-jwt
```

**Verify fix:** In Stripe Dashboard → Webhooks → endpoint deliveries, retries should switch from `401` to `2xx`.

---

## Regression Plan

| Tier | When to run |
|------|-------------|
| Tier 0 | Always: typecheck + lint |
| Tier 1 | When webhook logic changes |
| Tier 2 | When touching subscriptions migration or record_payment_attempt RPC |

**Change Classification:** B (Edge Function) + F (Subscription state machine)  
**Impacted Flows:** FLOW-12 (Subscriptions)

---

## Open Questions / TODOs

- `TODO(MODULE-09)` — Configure `SP_SUBSCRIPTION_LAPSE_URL` once MODULE-09 SP freeze endpoint is deployed
- `TODO(UX)` — SubscriptionStatusScreen layout to be refined per final Figma design
