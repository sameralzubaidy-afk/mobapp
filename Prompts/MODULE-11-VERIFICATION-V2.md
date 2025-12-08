# MODULE 11 VERIFICATION V2: SUBSCRIPTIONS (Kids Club+)

**Target Module:** `MODULE-11-SUBSCRIPTIONS-V2.md`  
**Scope:** Kids Club+ subscription lifecycle, SP gating, fees, trials, grace period, Stripe integration, and related UI/admin flows.  
**Status:** Draft for V2 – aligned with SYSTEM_REQUIREMENTS_V2 and MODULE-09-POINTS-GAMIFICATION-V2.

---

## 1. Business & Requirements Alignment

### 1.1 Core Product Rules

Verify that the implementation reflects these V2 rules:

- [ ] Single subscription tier **Kids Club+** at **$7.99/month**.
- [ ] **30-day free trial** with **no credit card required** to start.
- [ ] **90-day grace period** after loss of Kids Club+ access before SP are permanently deleted.
- [ ] Subscription status states: `free`, `trial`, `active`, `cancelled`, `grace_period`, `expired`.
- [ ] Only `trial` and `active` users can **earn** and **spend** Swap Points.
- [ ] `cancelled` users keep reduced fee and access to features until period end; SP remains usable until they transition to `grace_period`.
- [ ] `grace_period` users have their SP wallet **frozen** (no earn/spend), with clear countdown.
- [ ] `expired` means SP are **permanently deleted** and wallet closed.
- [ ] Transaction fee is **$0.99** for subscribers (trial, active, cancelled) and **$2.99** for free, grace_period, and expired users.

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
  - [ ] Seed row for `name = 'kids_club_plus'` with `price_cents = 799`, `trial_days = 30`, `grace_period_days = 90`, `is_active = true`, `is_default = true`.
  - [ ] Indexes on `is_active`, `is_default` exist.

- [ ] `subscription_features`
  - [ ] Columns: `id`, `tier_id` (FK → `subscription_tiers.id`), `feature_key`, `feature_name`, `feature_description`, `is_enabled`, `sort_order`, timestamps.
  - [ ] Seeded features for Kids Club+ (e.g., `can_earn_sp`, `can_spend_sp`, `can_donate`, `reduced_fee`, `priority_matching`, `early_access`, `priority_support`).

- [ ] `user_subscriptions`
  - [ ] Columns for user link, tier, and core status: `id`, `user_id`, `tier_id`, `status`, `has_used_trial`.
  - [ ] Trial fields: `trial_started_at`, `trial_ends_at`, reminder booleans (day 23/28/29).
  - [ ] Billing fields: `stripe_customer_id`, `stripe_subscription_id`, `stripe_payment_method_id`, `current_period_start`, `current_period_end`, `monthly_price_cents`.
  - [ ] Cancellation & grace fields: `cancel_reason`, `cancelled_at`, `grace_period_ends_at`.
  - [ ] Payment failure fields: `payment_failed_at`, `payment_retry_count`.
  - [ ] Check `status` enum includes `free`, `trial`, `active`, `cancelled`, `grace_period`, `expired`.

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

1. **Happy Path – Free → Trial → Active**
   - [ ] New user starts on `free` tier, sees correct banner and trial messaging.
   - [ ] User starts 30-day free trial; status becomes `trial`, SP earning/spending enabled, fee reduces to $0.99.
   - [ ] Before trial ends, user adds card and converts; after trial end, status becomes `active` and billing begins.

2. **Trial → Non-Conversion → Grace → Expired**
   - [ ] User starts trial but does not add payment method.
   - [ ] After trial end, cron moves user to `grace_period`, SP wallet is frozen, countdown appears in UI.
   - [ ] At grace end, cron moves user to `expired`, SP wallet is permanently deleted.

3. **Active → Cancel at Period End**
   - [ ] Active subscriber cancels via Manage screen; UI explains timing and SP consequences.
   - [ ] Status becomes `cancelled`, benefits continue until period end, SP still usable.
   - [ ] At period end, webhook/cron transitions to `grace_period` and SP is frozen.

4. **Trial Cancellation With/Without SP Activity**
   - [ ] Trial user with no SP activity cancels; status returns to `free`, wallet behavior is consistent with MODULE-09.
   - [ ] Trial user with SP activity cancels; status becomes `grace_period`, SP frozen with 90-day countdown.

5. **Payment Failures**
   - [ ] Simulate 1–2 failed invoices; user remains `active` with retries incremented.
   - [ ] On 3rd failure, status becomes `grace_period` and SP is frozen.

6. **Admin View Sanity Check**
   - [ ] AdminSubscriptionsPage shows plausible counts and MRR after exercising the above scenarios.
   - [ ] Numbers reconcile with Stripe Dashboard for a sample of users.

---

## 9. Sign-Off

- [ ] Product Owner review completed (requirements and flows match BRD V2).  
- [ ] Engineering lead review completed (schemas, functions, and edge behaviors are feasible and consistent).  
- [ ] QA lead review completed (test coverage and manual QA plan sufficient for launch).  
- [ ] Compliance/legal review completed for subscription, billing, and retention flows.

**V2 MODULE-11 Verification Status:** ☐ Pending  ☐ In Progress  ☐ Complete
