# MODULE 11 VERIFICATION V2.1: SUBSCRIPTIONS (Kids Club+)

**Target Module:** `MODULE-11-SUBSCRIPTIONS-V2.md`  
**Scope:** Kids Club+ subscription lifecycle, SP gating, fees, trials, grace period, Stripe integration, payment collection, billing history, and related UI/admin flows.  
**Status:** Draft for V2.1 – Enhanced with complete payment/billing implementation (tasks SUB-014 through SUB-019)

---

## 1. Business & Requirements Alignment

### 1.1 Core Product Rules

Verify that the implementation reflects these V2.1 rules:

- [ ] Single subscription tier **Kids Club+** at **$4.99/month** (updated V2.1 price).
- [ ] **30-day free trial** with **no credit card required** to start.
- [ ] **Payment collection via Stripe Payment Sheet** (in-app, mobile-first experience).
- [ ] **Payment method storage** using Stripe SetupIntent for seamless re-subscribe (saved card = 1-click renewal).
- [ ] **Anniversary billing cycle** – charges on subscription date (e.g., /day 15 every month).
- [ ] **Automatic retry logic for failed payments**:
  - [ ] Retry 1: 3 days after failure
  - [ ] Retry 2: 7 days after failure
  - [ ] Retry 3: 14 days after failure
  - [ ] After 3 failures → move to grace_period and freeze SP
- [ ] **Auto-renewal control** – users can toggle `auto_renew_enabled` to pause subscription (keeps access but no charge).
- [ ] **Pause option** instead of direct cancel (retention feature – 1-month pause before full cancellation).
- [ ] **90-day grace period** after loss of Kids Club+ access before SP are permanently deleted.
- [ ] **Subscription status states:** `free`, `trial`, `active`, `cancelled`, `paused`, `grace_period`, `expired`.
- [ ] **Billing history tracking** – all charges logged in `billing_history` table for invoice/receipt functionality.
- [ ] **Cancellation feedback** – collect `cancelled_reason` for analytics and churn analysis.
- [ ] Only `trial` and `active` users can **earn** and **spend** Swap Points.
- [ ] `paused` users keep access until pause ends, then auto-resume unless cancelled.
- [ ] `cancelled` users keep access until period end; SP remains usable until transition to `grace_period`.
- [ ] `grace_period` users have their SP wallet **frozen** (no earn/spend), with clear countdown.
- [ ] `expired` means SP are **permanently deleted** and wallet closed.
- [ ] Transaction fee is **$0.99** for subscribers (trial, active, paused) and **$2.99** for free, grace_period, and expired users.

### 1.2 Cross-Module Consistency

Confirm alignment with other modules:

- [ ] MODULE-09 SP wallet freeze/unfreeze/expiry APIs are called on subscription transitions to `grace_period` and `expired`.
- [ ] MODULE-02 Auth provides `user.id` and `stripe_customer_id` as expected by subscription services and edge functions.
- [ ] Any references to subscription status in trade flow, listing, or notifications modules are consistent with the state definitions here.

---

## 2. Database Schema Verification

### 2.1 Tables & Columns

**Tables to verify (structure + constraints):**

- [ ] `subscription_tiers`
  - [ ] Columns: `id`, `name`, `display_name`, `description`, `price_cents`, `currency`, `trial_days`, `grace_period_days`, `stripe_price_id`, `is_active`, `is_default`, `sort_order`, timestamps.
  - [ ] Seed row for `name = 'kids_club_plus'` with `price_cents = 499`, `trial_days = 30`, `grace_period_days = 90`, `is_active = true`, `is_default = true`.
  - [ ] Indexes on `is_active`, `is_default` exist.

- [ ] `subscription_features`
  - [ ] Columns: `id`, `tier_id` (FK → `subscription_tiers.id`), `feature_key`, `feature_name`, `feature_description`, `is_enabled`, `sort_order`, timestamps.
  - [ ] Seeded features for Kids Club+ (e.g., `can_earn_sp`, `can_spend_sp`, `can_donate`, `reduced_fee`, `priority_matching`, `early_access`, `priority_support`).

- [ ] `user_subscriptions` (ENHANCED V2.1)
  - [ ] Core columns: `id`, `user_id`, `tier_id`, `status` (enum: `free`, `trial`, `active`, `cancelled`, `paused`, `grace_period`, `expired`), `has_used_trial`.
  - [ ] Trial fields: `trial_started_at`, `trial_ends_at`, reminder booleans (day 23/28/29).
  - [ ] **Billing fields (V2.1)**:
    - [ ] `stripe_customer_id`, `stripe_subscription_id`, `stripe_payment_method_id` (the saved payment method)
    - [ ] `current_period_start`, `current_period_end`, `monthly_price_cents`
    - [ ] `last_payment_date`, `last_payment_amount` (track recent charge)
    - [ ] `next_billing_date` (when next charge will occur)
  - [ ] **Payment failure fields (V2.1)**:
    - [ ] `payment_failed_at`, `payment_retry_count` (0–3, increments on failed charge)
  - [ ] **Cancellation & pause fields (V2.1)**:
    - [ ] `cancelled_at`, `cancel_reason` (text, why user cancelled – feedback)
    - [ ] `paused_until` (timestamp, nullable – when pause ends)
    - [ ] `auto_renew_enabled` (boolean, default true – can toggle to pause auto-charge)
  - [ ] **Grace period field**:
    - [ ] `grace_period_ends_at` (when grace period ends and SP expire)

- [ ] **NEW: `billing_history` table (V2.1)**
  - [ ] Columns: `id` (UUID, pk), `user_id` (UUID, FK to auth.users), `subscription_id` (UUID, FK to user_subscriptions)
  - [ ] `charge_id` (text, unique, Stripe invoice ID), `amount` (integer, cents), `currency` (text, default 'usd')
  - [ ] `status` (enum: `succeeded`, `failed`, `refunded`), `charged_at` (timestamp), `description` (text, optional)
  - [ ] `created_at` (timestamp, default now), `updated_at` (timestamp, auto-update on refund/status changes)
  - [ ] **Indexes**: `(user_id, created_at DESC)`, `(subscription_id, created_at DESC)`, `(charge_id)` [unique], `(status)`
  - [ ] **RLS**: Users can SELECT their own rows; updates/inserts only via trusted edge functions

### 2.2 RLS & Policies

- [ ] RLS is enabled for `subscription_tiers` and `subscription_features`.
- [ ] Public SELECT allowed for active tiers and features (pricing display) but only admins can modify.
- [ ] `user_subscriptions` is protected to prevent cross-user access; only the authenticated user (and admins) can read/write their row.

---

## 3. Functions & Services

### 3.1 SQL Helper Functions

Verify Supabase functions (by signature and semantics):

- [ ] `get_subscription_status(p_user_id)` returns the latest status and key dates.
- [ ] `can_user_earn_sp(p_user_id)` returns boolean aligned with status gating rules.
- [ ] `can_user_spend_sp(p_user_id)` returns boolean aligned with status gating rules.
- [ ] `get_user_transaction_fee(p_user_id)` returns **99** for `trial`/`active`/`cancelled`, **299** otherwise.
- [ ] `is_user_trial_eligible(p_user_id)` enforces **one trial per user**, checking `has_used_trial` and current/past status.
- [ ] `get_subscription_summary(p_user_id)` returns a JSON object used by frontend services (status, tier name, price, SP permissions, key timestamps).

### 3.2 TypeScript Types & Helpers

Confirm TypeScript types and helpers in `src/types/subscription.ts` and `src/services/subscription/index.ts`:

- [ ] `SubscriptionStatus` union includes the six expected states.
- [ ] `SubscriptionPermissions` and `getSubscriptionPermissions` match SP access and fee rules for each status.
- [ ] `formatPrice` converts `799` → `$7.99` and handles edge cases (0, null/undefined input).
- [ ] `getTrialDaysRemaining` and `getGraceDaysRemaining` never return negative values; they floor at 0 when past due.
- [ ] Service functions (`getSubscriptionSummary`, `canUserEarnSp`, `canUserSpendSp`, `getUserTransactionFee`, `isUserTrialEligible`) wrap the Supabase RPCs correctly and handle error cases.

### 3.3 Unit Tests

Check `src/services/subscription/subscription.test.ts` or equivalent:

- [ ] Tests for `getSubscriptionPermissions` validate SP access across statuses (`trial`, `active`, `cancelled`, `grace_period`, `free`).
- [ ] Tests for `formatPrice` cover normal and boundary values.
- [ ] Tests for `getTrialDaysRemaining` and `getGraceDaysRemaining` ensure correct behavior for future and past timestamps.

---

## 4. Edge Functions (Supabase) – Behavioral Verification

For each function, confirm:
1. **Routing & Auth** – correct HTTP method, auth expectations, and error handling.  
2. **Business Logic** – matches V2 rules and state machine.  
3. **Side Effects** – DB updates, Stripe calls, and SP handlers.

### 4.1 `start-trial`

- [ ] Rejects non-POST requests.
- [ ] Authenticates the user and checks `is_user_trial_eligible`.
- [ ] Finds the default Kids Club+ tier.
- [ ] Creates/updates `user_subscriptions` with `status = 'trial'`, `trial_started_at = now`, `trial_ends_at ≈ now + 30 days`.
- [ ] Does **not** require or create a Stripe subscription.
- [ ] Sets `has_used_trial` only upon conversion/end (not at start).

### 4.2 `trial-reminders`

- [ ] Runs as a **scheduled daily job**.
- [ ] Selects `status = 'trial'` users with non-null `trial_ends_at`.
- [ ] Correctly computes days remaining and triggers reminders on effective **Day 23, 28, 29**.
- [ ] Sets reminder flags so notifications are **idempotent** (no duplicates across runs).

### 4.3 `trial-conversion`

- [ ] Runs as a **scheduled daily job**.
- [ ] Selects users where `status = 'trial'` and `trial_ends_at < now`.
- [ ] For users with active Stripe subscriptions:
  - [ ] Sets `status = 'active'` and `has_used_trial = true`.
- [ ] For users without an active sub:
  - [ ] Sets `status = 'grace_period'`, `has_used_trial = true`, `grace_period_ends_at ≈ now + 90 days`.
  - [ ] Calls SP wallet freeze handler (`SP_SUBSCRIPTION_LAPSE_URL`) with correct `userId`.

### 4.4 `create-kids-club-subscription`

- [ ] Requires POST and validates `userId` and `paymentMethodId` input.
- [ ] Loads the user and their `user_subscriptions` row.
- [ ] Creates or reuses Stripe customer (`stripe_customer_id` persisted back to users table).
- [ ] Attaches payment method and sets it as default for invoices.
- [ ] Creates a Stripe Subscription using tier’s `stripe_price_id` or inline `price_data` at `price_cents = 799`.
- [ ] If user is still in trial, sets `trial_end` to `trial_ends_at` so billing starts after trial.
- [ ] Updates `user_subscriptions` with Stripe IDs and `current_period_start`/`current_period_end`, without prematurely changing status from `trial` to `active`.

### 4.5 `stripe-webhook-subscriptions`

- [ ] Verifies Stripe webhook signature via `STRIPE_WEBHOOK_SECRET`.
- [ ] On `customer.subscription.updated`:
  - [ ] Updates `user_subscriptions` status to `active` when Stripe is active.
  - [ ] Sets status to `cancelled` when `cancel_at_period_end = true`.
  - [ ] If Stripe status becomes canceled immediately, transitions to `grace_period` and updates `current_period_end`.
- [ ] On `customer.subscription.deleted`:
  - [ ] Finds the corresponding `user_subscriptions` row by `stripe_subscription_id`.
  - [ ] Sets `status = 'grace_period'`, `grace_period_ends_at ≈ now + 90 days`.
  - [ ] Calls SP wallet freeze handler (`SP_SUBSCRIPTION_LAPSE_URL`).
- [ ] On `invoice.payment_failed`:
  - [ ] Increments `payment_retry_count` and sets `payment_failed_at`.
  - [ ] After **3 failures**, sets status to `grace_period` and (if not already handled) ensures wallet freeze is triggered.

### 4.6 `cancel-kids-club-subscription`

- [ ] Requires POST and authenticated user.
- [ ] Loads `user_subscriptions` for the caller.
- [ ] For users with Stripe subscriptions:
  - [ ] Sets Stripe `cancel_at_period_end = true`.
- [ ] For `active` users:
  - [ ] Sets status to `cancelled`; preserves `current_period_end` and does **not** freeze SP yet.
- [ ] For `trial` users:
  - [ ] Ends trial immediately.
  - [ ] If the user has SP activity (per MODULE-09 summary RPC), moves to `grace_period` and sets `grace_period_ends_at ≈ now + 90 days`.
  - [ ] If no SP activity, moves to `free`.
- [ ] Persists `cancel_reason` and `cancelled_at`.

### 4.7 `grace-period-cron`

- [ ] Runs daily and selects users with `status = 'grace_period'` and `grace_period_ends_at` not null.
- [ ] Correctly computes days remaining and sends reminders at **60, 30, 7, and 1** days.
- [ ] When `daysRemaining <= 0`:
  - [ ] Sets status to `expired`.
  - [ ] Calls SP expiry handler (`SP_SUBSCRIPTION_EXPIRE_URL`) to permanently delete SP and close wallet.

### 4.8 `create-payment-setup-intent` (V2.1)

- [ ] Accepts POST request with `user_id` and optional `for_renewal` flag.
- [ ] Creates Stripe SetupIntent for securely collecting payment method.
- [ ] Returns `{ clientSecret, publishable_key, ephemeral_key_secret }` for Stripe Payment Sheet initialization.
- [ ] Handles Stripe API errors gracefully and returns actionable messages (e.g., card declined, network timeout).
- [ ] **Idempotency:** Returns same intent if called again within 5 minutes (handles Payment Sheet reopening without creating duplicate intents).

### 4.9 `create-subscription-from-payment-method` (V2.1)

- [ ] Accepts POST with `user_id`, `payment_method_id`, and `is_renewal` boolean.
- [ ] If `is_renewal = false`: Creates new Stripe subscription with payment method as default.
- [ ] If `is_renewal = true`: Updates existing subscription with payment method if re-subscribing after failure.
- [ ] Creates `billing_history` entry with `status = 'succeeded'`, `amount = monthly_price_cents`, and payment date.
- [ ] Updates `user_subscriptions`:
  - [ ] `stripe_payment_method_id` set to provided payment method ID
  - [ ] `status = 'active'`
  - [ ] `last_payment_date = now`, `last_payment_amount = monthly_price_cents`
  - [ ] `next_billing_date = current_period_end + 30 days` (anniversary billing)
  - [ ] `payment_retry_count = 0` (resets if renewing after failure)
- [ ] Returns `{ subscription_id, status, next_billing_date }`.
- [ ] On payment collection failure: returns error message and does NOT create subscription record.

### 4.10 `renew-subscription` (V2.1)

- [ ] Accepts POST with `user_id`, optional `new_payment_method_id`.
- [ ] Finds current `user_subscriptions` in `grace_period` or `expired` status.
- [ ] Uses provided `new_payment_method_id` or existing `stripe_payment_method_id` from DB.
- [ ] Creates NEW Stripe subscription (not resuming old one) with anniversary billing date = today.
- [ ] Updates `user_subscriptions`:
  - [ ] `status = 'active'`
  - [ ] `stripe_subscription_id = new_subscription_id`
  - [ ] `current_period_start = now`, `current_period_end = now + 30 days`
  - [ ] `paused_until = null`, `auto_renew_enabled = true`
- [ ] Calls MODULE-09 `unfreeze_sp` API to restore SP wallet access.
- [ ] Creates `billing_history` entry for reactivation charge.
- [ ] Returns `{ success: true, next_billing_date }`.

### 4.11 `update-auto-renew` (V2.1)

- [ ] Accepts POST with `user_id` and `auto_renew_enabled` boolean.
- [ ] Updates `user_subscriptions.auto_renew_enabled`.
- [ ] If disabling (`false`): calls Stripe to set `cancel_at_period_end = true` on subscription.
- [ ] If enabling (`true`): calls Stripe to remove `cancel_at_period_end` flag.
- [ ] Updates `next_billing_date` calculation after toggle.
- [ ] Returns `{ success: true, auto_renew_enabled, next_billing_date }`.

### 4.12 `pause-subscription` (V2.1)

- [ ] Accepts POST with `user_id`.
- [ ] Finds active subscription and sets:
  - [ ] `paused_until = now + 30 days`
  - [ ] `auto_renew_enabled = false`
- [ ] Does NOT change Stripe subscription status; keeps active but with no auto-charge.
- [ ] User retains full access to Kids Club+ benefits during pause.
- [ ] In UI, shows clear resume option ("Resume Auto-Renew on [date]").
- [ ] Returns `{ success: true, paused_until, next_billing_date }`.

### 4.13 `resume-from-pause` (V2.1)

- [ ] Accepts POST with `user_id`.
- [ ] Finds subscription with `paused_until > now`.
- [ ] Clears `paused_until = null`, sets `auto_renew_enabled = true`.
- [ ] Calls Stripe to ensure subscription will renew at period end.
- [ ] Recalculates `next_billing_date`.
- [ ] Returns `{ success: true, next_billing_date }`.

---

## 5. Mobile UI & UX Verification

### 5.1 Member-Facing Screens

Verify navigation, copy, and state-aware behavior for:

- [ ] `TryKidsClubScreen`
  - [ ] Shows clear explanation of trial (30 days, no card required).
  - [ ] Trial CTA calls `start-trial` function and updates local subscription state.

- [ ] `KidsClubOverviewScreen`
  - [ ] Displays benefits list aligned with MODULE-11 overview.
  - [ ] Uses `SubscriptionStatusCard` and `useGracePeriodStatus` to show current state and any grace-period warning.
  - [ ] Primary CTA label and navigation vary correctly by status:
    - [ ] `free` → "Start 30-Day Free Trial" → `TryKidsClub`.
    - [ ] `trial` → "Continue Kids Club+" → payment screen.
    - [ ] `active`/`cancelled` → "Manage Kids Club+" → manage screen.
    - [ ] `grace_period` → "Re-subscribe and Unlock SP" → payment screen.
    - [ ] `expired` → "Re-subscribe (SP will start fresh)".

- [ ] `ManageKidsClubScreen`
  - [ ] Displays current status and `current_period_end` when relevant.
  - [ ] Presents clear, parent-friendly cancellation explanation (benefits until period end, SP freeze, and eventual deletion).
  - [ ] Cancel CTA triggers `cancel-kids-club-subscription` and surfaces different confirmation copy for `cancelled`, `grace_period`, and `free` outcomes.

### 5.2 Reusable Components & Hooks

- [ ] `SubscriptionStatusCard` shows:
  - [ ] Tier name (`Kids Club+`), status label, monthly price, and period end where applicable.
  - [ ] Grace-period message when provided.
- [ ] `SubscriptionBanner`:
  - [ ] Appears for non-active users in key flows (home, SP wallet, listing flow) per design.
  - [ ] Message and CTA label adjust based on `status` (`free`, `trial`, `grace_period`, `expired`).
  - [ ] Tapping banner routes to appropriate screen (`KidsClubOverview`, `AddPaymentForKidsClub`).
- [ ] `useGracePeriodStatus`:
  - [ ] Returns `isInGrace`, `daysRemaining`, and a message consistent with grace-period rules.
  - [ ] Handles edge cases around same-day expiry (`daysRemaining = 0`).

---

## 6. Admin & Analytics Verification

### 6.1 AdminSubscriptionsPage & API

- [ ] `getSubscriptionSummaryForAdmin` queries `user_subscriptions` and returns counts by status and calculated `mrr_cents`.
- [ ] `AdminSubscriptionsPage`:
  - [ ] Displays MRR in dollars and status breakdown (Active, Trial, Grace Period, Expired, Free).
  - [ ] Clarifies that Stripe Dashboard remains the source of truth for billing actions.

### 6.2 Metrics & Observability (TODOs)

- [ ] Key events are logged or tagged for analytics:
  - [ ] Trial started, trial converted, trial ended without conversion.
  - [ ] Subscription created, cancelled, moved to grace, expired.
  - [ ] SP wallet frozen/unfrozen/expired (coordinated with MODULE-09).
- [ ] Add TODO notes where metrics should be instrumented (e.g., logging calls in edge functions, analytics events in UI flows).

---

## 7. Edge Cases & Failure Handling

### 7.1 Error Scenarios

- [ ] `start-trial` gracefully handles:
  - [ ] Users who already used a trial (returns clear error).
  - [ ] Missing tier or misconfigured DB rows.

- [ ] `create-kids-club-subscription` handles:
  - [ ] Stripe errors (card declined, network failures) and returns actionable error messages.
  - [ ] Missing `paymentMethodId`.

- [ ] `stripe-webhook-subscriptions`:
  - [ ] Rejects invalid signatures.
  - [ ] Logs unexpected event types without crashing.
  - [ ] Handles missing local `user_subscriptions` rows defensively.

- [ ] `cancel-kids-club-subscription` and `grace-period-cron` handle missing or malformed DB records with logs and safe fallbacks.

### 7.2 Race Conditions & Idempotency

- [ ] Trial reminder and conversion jobs are idempotent and safe to run multiple times per day.
- [ ] Webhook and cron functions avoid double-freezing/double-expiring SP by checking current status before calling MODULE-09 handlers.
- [ ] Cancellation plus webhook events (e.g., user cancels, Stripe deletes subscription) result in a consistent final status.

---

## 8. Manual QA Checklist

Use this as a **test script** for end-to-end QA in staging:

1. **Happy Path – Free → Trial → Active → Payment**
   - [ ] New user starts on `free` tier, sees correct banner and trial messaging.
   - [ ] User starts 30-day free trial; status becomes `trial`, SP earning/spending enabled, fee reduces to $0.99.
   - [ ] Before trial ends, user adds card via Stripe Payment Sheet; payment method saved to `stripe_payment_method_id`.
   - [ ] User confirms subscription; `billing_history` entry created with status `succeeded`.
   - [ ] After conversion, status becomes `active`, billing begins on anniversary date.

2. **Payment Collection – Trial to Active with Card**
   - [ ] Initiate conversion, tap "Add Payment Method".
   - [ ] Stripe Payment Sheet opens (no redirect), collects card details.
   - [ ] On success: saved payment method shown in Manage screen (e.g., "Visa ending in 4242").
   - [ ] First charge processed immediately; next charge scheduled for +30 days.

3. **Saved Card – One-Click Re-Subscribe**
   - [ ] User in grace_period taps "Re-Subscribe Now".
   - [ ] Saved payment method pre-filled; user taps "Confirm" (no re-entry).
   - [ ] Status returns to `active`, SP unfrozen immediately.
   - [ ] Verify `billing_history` entry created for reactivation charge.

4. **Payment Method Update**
   - [ ] In Manage screen, tap "Update Payment Method".
   - [ ] Stripe Payment Sheet opens, new card entered & saved.
   - [ ] Old payment method replaced in `stripe_payment_method_id`.
   - [ ] Next charge uses new card.

5. **Auto-Renew Toggle**
   - [ ] In Manage screen, toggle "Auto-renew subscription" OFF.
   - [ ] Verify Stripe `cancel_at_period_end = true` set.
   - [ ] Warning shown: "Subscription ends on [date]".
   - [ ] Toggle ON again; subscription resumes normal renewal.

6. **Payment Failure – Automatic Retry**
   - [ ] Use test card that declines (e.g., Stripe test card `4000000000000002`).
   - [ ] At period end, charge fails; `payment_retry_count` increments to 1.
   - [ ] Banner appears: "Payment Declined – Update Payment Method".
   - [ ] User taps banner, updates card, charge retried immediately.
   - [ ] On success: `payment_retry_count` reset to 0, `billing_history` shows succeeded charge.

7. **Triple-Failure → Grace Period**
   - [ ] Simulate 3 failed payment attempts (using Stripe test declined cards).
   - [ ] After 3rd failure: status transitions to `grace_period`, SP frozen, countdown appears.
   - [ ] `billing_history` shows status `failed` for all 3 attempts.
   - [ ] User must re-subscribe to restore access.

8. **Trial Cancellation With SP Activity**
   - [ ] Trial user with SP earned cancels mid-trial.
   - [ ] Cancellation modal offers "Pause for 1 month" as first option.
   - [ ] If user confirms cancel: status becomes `grace_period`, SP frozen, 90-day countdown starts.

9. **Pause vs Cancel**
   - [ ] Active subscriber in Manage screen taps "Cancel".
   - [ ] Modal shows "Want to pause instead?" with benefits list.
   - [ ] If user chooses "Pause", subscription paused for 1 month, access continues, no charge.
   - [ ] If user chooses "Cancel", cancellation reason collected, status → `cancelled`.
   - [ ] Both flows show clear end/resume dates.

10. **Grace Period – Reminders & Expiry**
    - [ ] User in `grace_period` with 63 days remaining.
    - [ ] Countdown banner shows: "60 days to re-subscribe".
    - [ ] Verify reminders at 60, 30, 7, 1 days appear as in-app messages.
    - [ ] On day 91: cron moves status to `expired`, SP permanently deleted.

11. **Billing History Screen**
    - [ ] In Manage screen, tap "Billing History" or similar.
    - [ ] Table shows past charges: Date, Amount ($4.99), Status (Succeeded/Failed).
    - [ ] Sort by recent; pagination works if > 10 entries.
    - [ ] User can see full invoice history of their subscription.

12. **Admin View – New Metrics**
    - [ ] AdminSubscriptionsPage shows:
      - [ ] Total active subscribers
      - [ ] MRR (sum of `monthly_price_cents * active_count / 100`)
      - [ ] Grace period count, expired count
      - [ ] Payment failure rate (failed attempts ÷ total attempts)
    - [ ] Reconcile metrics with sample of users in Stripe Dashboard.

---

---

## 9. Sign-Off

- [ ] Product Owner review completed (requirements and flows match BRD V2 + V2.1 billing features).  
- [ ] Engineering lead review completed (schemas, functions, and edge behaviors are feasible and consistent).  
- [ ] QA lead review completed (test coverage and manual QA plan sufficient for launch).  
- [ ] Compliance/legal review completed for subscription, billing, payment retry, and retention flows.
- [ ] Payment processor (Stripe) integration reviewed and test keys verified.
- [ ] Data privacy (PCI compliance, payment data handling) verified.

**V2.1 MODULE-11 Verification Status:** ☐ Pending  ☐ In Progress  ☐ Complete

---

## 10. V2.1 Key Enhancements Summary

- **Payment Collection:** Stripe Payment Sheet for secure, in-app card collection (no redirects).
- **Payment Method Storage:** SetupIntent + `stripe_payment_method_id` for 1-click re-subscribe.
- **Billing History:** `billing_history` table tracking all charges, failures, and receipts.
- **Auto-Renewal Control:** `auto_renew_enabled` toggle to pause subscription without full cancellation.
- **Payment Retry Logic:** Automatic 3-retry system (3, 7, 14 days) with user notifications.
- **Smart Cancellation:** Pause option before cancel, cancellation reason collection for analytics.
- **Re-Subscribe:** Easy renewal from grace period with saved payment method.
- **Anniversary Billing:** Charges on subscription date (consistent 30-day cycles).
- **Pause Feature:** Temporary suspension (1 month) for retention without losing data.
