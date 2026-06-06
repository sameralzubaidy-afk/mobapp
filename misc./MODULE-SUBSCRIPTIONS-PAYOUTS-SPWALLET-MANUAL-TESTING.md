# MODULE-12-22-10 Subscriptions · Payouts · SP Wallet — Manual Testing Guide

**Source of truth:** `docs/flow-registry.md` (FLOW-10 SP Wallet Read · FLOW-11 SP Earn/Spend/Cap · FLOW-12 Subscriptions · FLOW-12A Subscription Payment (Stripe) · FLOW-17 Subscription Event Notifications · FLOW-22 Seller Payouts · FLOW-23 Payout Method Verification · FLOW-25 Manual Payout Admin · FLOW-26 Webhook Processing & Verification · FLOW-30 SP Wallet Admin Ops)
**Tasks covered:** Subscription Lifecycle (plans, comparison, trial, payment, manage, cancel, renew, grace, expiry, billing history) · Seller Payouts & Withdrawals (dashboard, methods, verification, request, earnings) · SP Wallet & Transaction History (balance, earn, expiry, ledger, billing) · Provider webhook reconciliation for subscription and payout state changes
**Last updated:** 2026-05-30
**Scope:** End-user manual testing via app screens + admin portal screens (no SQL / no DB access required)
**Devices:** iOS Simulator + Android Emulator · Admin portal in browser

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Plans & Comparison** | TC-A01 | Subscription Plans screen — Free vs Kids Club+ cards |
| | TC-A02 | Plan Comparison table — feature-by-feature + POPULAR badge |
| | TC-A03 | Dynamic pricing & fees pulled from admin config |
| | TC-A04 | Current plan reflected (button disabled / "Current Plan") |
| | TC-A05 | Kids Club+ Overview screen by subscription status |
| **B — Start Trial & Payment** | TC-B01 | Start free trial from Plans → payment screen |
| | TC-B02 | Payment screen benefits + pricing + "Due today $0.00" (trial) |
| | TC-B03 | Complete Stripe payment → Success screen |
| | TC-B04 | Trial already used — blocked with support/subscribe options |
| | TC-B05 | Trial disabled globally — Free tier only |
| | TC-B06 | Continue Kids Club+ (mid-trial) urgency + benefits |
| | TC-B07 | Referred user warned about bonus loss before choosing Free |
| | TC-B08 | Admin changes trial-limit config → trial CTA updates |
| **C — Manage & Cancel** | TC-C01 | My Subscription screen — paid member view |
| | TC-C02 | My Subscription quick menu (Billing / Payment / Help) |
| | TC-C03 | Manage Kids Club+ — status, next billing, days remaining |
| | TC-C04 | Cancel flow — retention screen "Keep My Benefits" |
| | TC-C05 | Cancel reason modal + final confirmation |
| | TC-C06 | Cancelled subscription stays active until period end |
| | TC-C07 | Auto-renew toggle / update payment method |
| **D — Renewal, Grace & Expiry** | TC-D01 | Grace period banner + SP wallet frozen warning |
| | TC-D02 | Re-subscribe from grace period |
| | TC-D03 | Subscription Expired screen — benefits lost + Renew |
| | TC-D04 | Renew (isRenewal) — payment screen "Due today" = full price |
| | TC-D05 | Reactivate from cancelled state |
| | TC-D06 | Subscription event notifications (trial reminders, renewal, failure) |
| | TC-D07 | Grace reminder notifications follow configured thresholds |
| **E — Billing History & Status** | TC-E01 | Billing History list — records, status badges, amounts |
| | TC-E02 | Billing History empty state |
| | TC-E03 | Failed charge shows error message |
| | TC-E04 | Subscription Status screen — Stripe IDs + period + retries |
| **F — Payout Dashboard & Earnings** | TC-F01 | Payout Dashboard hero (SP balance + AUD equivalent) |
| | TC-F02 | Payout method section (add vs existing) |
| | TC-F03 | Payout history list (completed / pending) |
| | TC-F04 | Seller Earnings screen — totals, pending, payout breakdown |
| | TC-F05 | Seller Earnings empty state |
| | TC-F06 | Pending earnings release follows admin-configured delay |
| **G — Payout Methods & Verification** | TC-G01 | Add Stripe Connect payout method (onboarding) |
| | TC-G02 | Add PayPal / Venmo payout method |
| | TC-G03 | Add Bank ACH payout method |
| | TC-G04 | Set primary method / delete method (confirmation) |
| | TC-G05 | Unverified method blocks payout |
| | TC-G06 | requires_action payout → "Set Up Payout Method" |
| **H — Request & Withdraw** | TC-H01 | Request Payout — amount validation vs available |
| | TC-H02 | Fee + net summary by method type |
| | TC-H03 | Confirm Payout success |
| | TC-H04 | Request blocked when no method / unverified |
| | TC-H05 | Withdraw Now from Payout Settings hero |
| | TC-H06 | Admin minimum withdrawal blocks smaller payouts |
| | TC-H07 | Minimum withdrawal disabled when config = 0 |
| **I — SP Wallet Balance & Earn** | TC-I01 | SP Wallet hero balance + lifetime stats |
| | TC-I02 | Quick actions (Shop / Sell / History) |
| | TC-I03 | How to Earn SP section + Learn More |
| | TC-I04 | SP expiration info + expiring-soon alert |
| | TC-I05 | Wallet warning banner by state (active/grace/expired) |
| | TC-I06 | Free user SP wallet inactive state |
| **J — SP Transaction History** | TC-J01 | SP History tabs (All / Earned / Spent) |
| | TC-J02 | Transaction rows — type icon, label, signed amount |
| | TC-J03 | Empty state per tab |
| | TC-J04 | Pull-to-refresh updates ledger |
| **K — Transaction / Billing History (Profile)** | TC-K01 | Transaction History list + status badges |
| | TC-K02 | Transaction History empty + error/retry |
| **L — Webhooks & Reconciliation** | TC-L01 | Renewal webhook updates billing history and member state |
| | TC-L02 | Payment-failed webhook moves subscription into retry / grace state |
| | TC-L03 | Invalid webhook signature is rejected with no duplicate state change |
| | TC-L04 | Duplicate webhook delivery is idempotent |
| | TC-L05 | Payout-status webhook updates seller payout history |

---

## Pre-conditions (set up before testing)

- App is running on iOS Simulator and/or Android Emulator.
- The following test accounts exist and are confirmed (see Accounts table).
- Admin portal has `subscription_price`, `trial_days`, `transaction_fee_subscriber_cents`, `transaction_fee_non_subscriber_cents`, `grace_period_days`, and `sp_expiration_days` configured (so dynamic values render).
- test-seller has completed trades producing an available payout balance > 0 and lifetime earnings.
- test-buyer (subscriber) has a Swap Points balance with at least one earned and one spent ledger entry, and at least one batch expiring within 30 days.
- test-free has never started a trial (for trial-eligibility cases) — or a second free account `test-free-2` that has already used its trial.
- A valid test card / Stripe test payment method is available for subscription and payout flows.
- QA can trigger or replay signed test webhooks for subscription renewal, payment failure, and payout completion/failure in the staging environment.

## Accounts for testing

| Role | Email | Subscription | Notes |
|---|---|---|---|
| Subscriber | test-buyer@kidsmarketplace.test | Kids Club+ Active | Has SP balance + ledger history |
| Trial user | test-trial@kidsmarketplace.test | Kids Club+ Trial | Mid-trial, days remaining > 0 |
| Free (trial available) | test-free@kidsmarketplace.test | None | Never used trial |
| Free (trial used) | test-free-2@kidsmarketplace.test | None | `can_start_trial = false` |
| Grace period | test-grace@kidsmarketplace.test | Grace period | SP wallet frozen |
| Seller | test-seller@kidsmarketplace.test | Kids Club+ Active | Has payout balance + methods |
| Admin | test-admin@kidsmarketplace.test | — | Required for admin-side payout/SP cases |

> Timer-based cases (trial reminders, renewal, grace expiry, payout processing) require QA to fast-forward the relevant clock or trigger the scheduled job in the test environment. The steps below describe what the end user sees once that time is reached.

---

## Group A — Plans & Comparison

### TC-A01 · Subscription Plans screen — Free vs Kids Club+ cards

**Ref:** FLOW-12 · SubscriptionPlansScreen
**Actors:** test-free

**Objective:** Verify the Plans screen renders both tiers with correct icons, pricing, and CTAs.

**Steps:**
1. Log in as **test-free** and open **Plans** (from menu/settings).
2. Review the Free plan card and the Kids Club+ plan card.

**Expected Result:**
- Header reads "Plans" with sub-heading "Choose Your Plan".
- **Free** card: grey crown icon, "$0", "forever"; no trial CTA (free user already on free).
- **Kids Club+** card: green crown icon, the configured monthly price, and a "{N}-day free trial" label.
- Kids Club+ CTA reads **[Start {N}-day Trial]**.
- Feature rows show a check icon for included features and an X for excluded ones (Trade with PIPs, Reduced fees, transaction-fee comparison).

---

### TC-A02 · Plan Comparison table — feature-by-feature + POPULAR badge

**Ref:** FLOW-12 · PlanComparisonScreen
**Actors:** test-free

**Objective:** Verify the comparison table lays out Free vs Kids Club+ across all feature rows.

**Steps:**
1. From the Plans screen (or settings) open **Compare Plans**.
2. Review the three-column table and the highlight section.

**Expected Result:**
- Header "Compare Plans" with sub-heading "Choose What Works For You".
- Column 1 = feature names; Column 2 = Free (grey crown, $0, "Forever"); Column 3 = Kids Club+ (green crown, monthly price, "/month", **POPULAR** badge).
- Rows include monthly subscription, trial period ("{N} days"), and transaction fee (free fee vs subscriber fee), each with a check/X or text value.
- "Why Upgrade to Kids Club+?" section shows "Trade with PIPs" and "Lower fees".
- **[Choose Free]** returns to the previous screen; **[Choose Kids Club+]** navigates to the payment screen with isRenewal = false.

---

### TC-A03 · Dynamic pricing & fees pulled from admin config

**Ref:** FLOW-12 · FLOW-18 admin config
**Actors:** test-admin + test-free

**Objective:** Verify prices/fees shown in app come from admin config, not hardcoded.

**Steps:**
1. As **test-admin**, change the subscription monthly price (e.g., to a distinct value) and the subscriber transaction fee in admin config; save.
2. As **test-free**, open Plans, Compare Plans, and the payment screen.

**Expected Result:**
- The new monthly price appears on Plans, Comparison, Upgrade, and Payment screens.
- The new subscriber/non-subscriber transaction fee values appear in the comparison and on the payment "Lower Transaction Fees" benefit line.
- If config is missing, screens fail safe (show a loading spinner / $0.00 placeholder and log an error) rather than crashing.

---

### TC-A04 · Current plan reflected (button disabled / "Current Plan")

**Ref:** FLOW-12 · UpgradePlanScreen / SubscriptionPlansScreen
**Actors:** test-buyer (subscriber)

**Objective:** Verify a current subscriber sees their active tier marked, with the upgrade CTA disabled.

**Steps:**
1. Log in as **test-buyer** and open **Plans** and **Upgrade Plan**.

**Expected Result:**
- The Kids Club+ card shows a "Current Plan" chip/badge and its CTA is disabled (no re-purchase path).
- The Free card's downgrade action is disabled.

---

### TC-A05 · Kids Club+ Overview screen by subscription status

**Ref:** FLOW-12 · KidsClubOverviewScreen
**Actors:** test-free, test-buyer, test-grace

**Objective:** Verify the Overview screen shows the correct primary CTA per status.

**Steps:**
1. Open **Kids Club+** overview as **test-free**, then as **test-buyer** (active), then as **test-grace**.

**Expected Result:**
- **Free:** primary CTA **[Start 30-Day Free Trial]** + benefits overview.
- **Active/Trial:** renewal/countdown info + **[Manage Kids Club+]** + a cancel option.
- **Grace period:** urgency message with days remaining + **[Re-subscribe and Unlock SP]** (SP frozen messaging).
- Cancellation modal (if opened) is titled "We'll miss you!" with the six reason options including "Other".

---

## Group B — Start Trial & Payment

### TC-B01 · Start free trial from Plans → payment screen

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** test-free (trial available)

**Objective:** Verify tapping Start Trial routes to the payment screen with trial context.

**Steps:**
1. As **test-free**, open Plans and tap **[Start {N}-day Trial]** on Kids Club+.

**Expected Result:**
- Navigates to the **Payment** screen with title "Join Kids Club+".
- Sub-title "Unlock Swap Points and reduced fees".

---

### TC-B02 · Payment screen benefits + pricing + "Due today $0.00" (trial)

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** test-free

**Objective:** Verify the payment screen content for a new trial.

**Steps:**
1. On the Payment screen (from TC-B01), review the benefits, pricing card, and totals.

**Expected Result:**
- "What you get:" lists four benefits: Earn & Spend Swap Points; Lower Transaction Fees (showing subscriber vs non-subscriber fee); Priority Matching; Early Access.
- Pricing card: "Kids Club+ monthly membership" + monthly price, "First charge after trial ends", and a "{N}-day free trial" badge.
- Payment method row shows "Secure checkout with Stripe".
- **Due today** = **$0.00** (because it's a trial).
- Terms text states automatic monthly billing, cancel anytime, no refunds for partial months.

---

### TC-B03 · Complete Stripe payment → Success screen

**Ref:** FLOW-12A · SubscriptionSuccessScreen
**Actors:** test-free

**Objective:** Verify successful payment lands on the success screen and activates membership.

**Steps:**
1. On the Payment screen tap **[Subscribe to Kids Club+]** and complete the Stripe test sheet.

**Expected Result:**
- Success screen animates in: "You're now a Kids Club+ member!" with sub-title "Your subscription is now active. Let's get started!".
- Three benefit chips: "Earn and spend PIPs", "Low Fees", "Save Together".
- **[Start Exploring]** resets navigation to Discover.
- Re-opening My Subscription shows status Trial/Active.

---

### TC-B04 · Trial already used — blocked with support/subscribe options

**Ref:** FLOW-12 · trial limit
**Actors:** test-free-2 (`can_start_trial = false`)

**Objective:** Verify a user who already used their trial cannot start another.

**Steps:**
1. As **test-free-2**, attempt to start a trial from Plans / Continue Kids Club+ / Subscription Choice.

**Expected Result:**
- An alert "You've already used your free trial" appears with options to contact support or subscribe directly (no second free trial granted).

---

### TC-B05 · Trial disabled globally — Free tier only

**Ref:** FLOW-12 · admin `isTrialEnabled`
**Actors:** test-admin + test-free

**Objective:** Verify disabling trials hides/blocks the trial path.

**Steps:**
1. As **test-admin**, disable trial subscriptions in config.
2. As **test-free**, open Subscription Choice / Continue Kids Club+.

**Expected Result:**
- An alert states "Trial subscription is not currently available. Please choose Free Tier." (or the trial CTA is hidden), and only the Free path proceeds.

---

### TC-B06 · Continue Kids Club+ (mid-trial) urgency + benefits

**Ref:** FLOW-12 · ContinueKidsClubScreen
**Actors:** test-trial (mid-trial)

**Objective:** Verify the Continue screen shows trial countdown and premium benefits.

**Steps:**
1. As **test-trial**, open **Continue Kids Club+**.

**Expected Result:**
- Title "Continue Kids Club+" with the 🚀 emoji.
- A days-remaining badge ("{N} days left in trial", orange) when the trial is ending soon.
- Five benefit rows (Earn & spend Swap Points; Priority listing visibility; Donation option; Advanced trading insights; Exclusive badges).
- Pricing card with monthly price + "Cancel anytime".
- Fine print explains the first charge happens when the trial ends, cancel anytime to avoid charges.
- **[Maybe later]** returns without subscribing.

---

### TC-B07 · Referred user warned about bonus loss before choosing Free

**Ref:** FLOW-13 referrals × FLOW-12
**Actors:** A referred new user during onboarding (SubscriptionChoiceScreen)

**Objective:** Verify a referred user is warned before downgrading to Free.

**Steps:**
1. Sign up via a referral code, reach **Subscription Choice** in onboarding, and tap the Free tier option.

**Expected Result:**
- A "Wait! Potential Bonus Loss" alert warns about losing the sign-up bonus before the Free choice is confirmed.
- Confirming proceeds to Free (profile_completed = true); cancelling keeps the trial choice available.

### TC-B08 · Admin changes trial-limit config and the trial CTA updates

**Ref:** FLOW-12 · `max_trial_uses`
**Actors:** test-admin + test-free-2

**Objective:** Verify changing the trial-limit config updates eligibility without an app rebuild.

**Steps:**
1. As **test-admin**, open **/config**, set `max_trial_uses` to `0`, and save.
2. As **test-free-2** (the exhausted-trial user from TC-B04), reopen **Subscription Choice** / **Plans**.
3. Set `max_trial_uses` back to `1` and reload the same screens.

**Expected Result:**
- With `max_trial_uses = 0`, the previously blocked user sees the trial CTA enabled again because the limit is now unlimited.
- Restoring the limit removes the CTA again for the exhausted user on next load.

---

## Group C — Manage & Cancel

### TC-C01 · My Subscription screen — paid member view

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-buyer (active)

**Objective:** Verify the My Subscription screen for an active member.

**Steps:**
1. As **test-buyer**, open **My Subscription**.

**Expected Result:**
- Plan card shows a green crown, "Kids Club+ Plan", the monthly price, an "ACTIVE member" badge, the renewal date, and a "Member Since" date.
- Benefits list shows the three subscription benefits with green check icons.
- A **[Manage Subscription]** action is present (not the upgrade CTA shown to free users).

---

### TC-C02 · My Subscription quick menu (Billing / Payment / Help)

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-buyer

**Objective:** Verify the quick menu rows route correctly.

**Steps:**
1. On My Subscription, tap **Billing History**, then back; tap **Payment Method**, then back; tap **Get Help**.

**Expected Result:**
- Billing History → Transaction/Billing History screen.
- Payment Method → Manage Kids Club+ screen.
- Get Help → an alert with the support email.

---

### TC-C03 · Manage Kids Club+ — status, next billing, days remaining

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-buyer (active)

**Objective:** Verify the manage screen shows current status and billing details.

**Steps:**
1. As **test-buyer**, open **Manage Kids Club+**.

**Expected Result:**
- Shows current status, next billing date, and days remaining (rounded up).
- Includes **[Cancel Subscription]**, **[View Billing History]**, an auto-renew toggle, and a payment-method section (with masked card / "Add Payment Method").
- Helper text: "You'll continue to have access until the end of your current billing period."

---

### TC-C04 · Cancel flow — retention screen "Keep My Benefits"

**Ref:** FLOW-12 · CancelSubscriptionScreen
**Actors:** test-buyer

**Objective:** Verify the retention screen and that "Keep My Benefits" aborts cancellation.

**Steps:**
1. From Manage Kids Club+, tap **[Cancel Subscription]**.
2. On the retention screen, tap **[Keep My Benefits]**.

**Expected Result:**
- Retention screen shows a heart icon, "We'll miss you!", a "Benefits you'll lose immediately" list (X icons, red), the "1,000+ parents saving an average of $45/month" value line, and the end-of-cycle disclaimer.
- **[Keep My Benefits]** returns to the previous screen with the subscription unchanged.

---

### TC-C05 · Cancel reason modal + final confirmation

**Ref:** FLOW-12 · CancelSubscriptionScreen / ManageKidsClubScreen
**Actors:** test-buyer

**Objective:** Verify cancellation requires a reason and a final confirmation.

**Steps:**
1. On the retention screen tap **[I still want to cancel]**.
2. Select a cancellation reason (e.g., "Too expensive"); for "Other" enter free text.
3. Confirm at the "Cancel Subscription?" alert by tapping **[Yes, Cancel]**.

**Expected Result:**
- The reason list shows the predefined reasons including "Other" with a text input.
- The final alert reads "Are you sure? You'll lose access to all Kids Club+ benefits." with **[Go Back]** and **[Yes, Cancel]**.
- After confirming, the subscription is set to cancel at period end and the status updates accordingly.

---

### TC-C06 · Cancelled subscription stays active until period end

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-buyer (just cancelled)

**Objective:** Verify benefits persist until the end of the billing period after cancellation.

**Steps:**
1. After cancelling (TC-C05), reopen Manage Kids Club+ / My Subscription before the period ends.

**Expected Result:**
- Status shows cancelled but still active until the period end date.
- SP wallet remains usable until the period ends; a "can reactivate" message is shown.

---

### TC-C07 · Auto-renew toggle / update payment method

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-buyer

**Objective:** Verify the auto-renew toggle and payment-method update entry points.

**Steps:**
1. On Manage Kids Club+, toggle auto-renew off then on.
2. Tap **Update** on the payment-method section.

**Expected Result:**
- Auto-renew state persists across screen reloads.
- The payment-method action opens the update flow (or the appropriate add/update entry point).

---

## Group D — Renewal, Grace & Expiry

### TC-D01 · Grace period banner + SP wallet frozen warning

**Ref:** FLOW-12 · FLOW-10 · ManageKidsClubScreen
**Actors:** test-grace

**Objective:** Verify grace-period messaging and the SP-freeze warning.

**Steps:**
1. As **test-grace**, open Manage Kids Club+ / Kids Club+ overview.

**Expected Result:**
- An urgency message ("Your subscription ended on …") with days left in grace (default 90) is shown.
- A "Your SP wallet will be frozen if you don't re-subscribe" warning is displayed alongside a **[Re-subscribe]** CTA.

---

### TC-D02 · Re-subscribe from grace period

**Ref:** FLOW-12A · SubscriptionPaymentScreen (isRenewal)
**Actors:** test-grace

**Objective:** Verify re-subscribing from grace restores the subscription and unlocks SP.

**Steps:**
1. As **test-grace**, tap **[Re-subscribe]** / **[Re-subscribe and Unlock SP]** and complete payment.

**Expected Result:**
- Payment screen title reads "Re-subscribe to Kids Club+" with **Due today** = the full monthly price (no trial badge).
- After success, status returns to Active and the SP wallet warning banner clears (wallet usable again).

---

### TC-D03 · Subscription Expired screen — benefits lost + Renew

**Ref:** FLOW-12 · SubscriptionExpiredScreen
**Actors:** A user whose grace period has fully expired

**Objective:** Verify the expired screen content and CTAs.

**Steps:**
1. Trigger / fast-forward to a fully expired subscription and open the **Subscription Expired** screen.

**Expected Result:**
- Header "Subscription Expired" with "Your {planName} plan ended on {expiredDate}".
- "What you're missing out on:" lists Trade with PIPs, Reduced Fees, and Keep Your Points.
- **[Renew Plan]** → payment screen with isRenewal = true; **[Continue with Free Plan]** → Discover.

---

### TC-D04 · Renew (isRenewal) — payment screen "Due today" = full price

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** Expired/cancelled user renewing

**Objective:** Verify renewal payment charges immediately (no trial).

**Steps:**
1. From Expired/Manage, tap **[Renew Plan]** and review the payment screen.

**Expected Result:**
- Title "Re-subscribe to Kids Club+", no "{N}-day free trial" badge, and **Due today** equals the full monthly price.
- Success routes to the Success screen with the "Welcome back! Your subscription is active." copy.

---

### TC-D05 · Reactivate from cancelled state

**Ref:** FLOW-12 · ManageKidsClubScreen / KidsClubOverviewScreen
**Actors:** A cancelled (not yet expired) user

**Objective:** Verify reactivation before expiry restores active status.

**Steps:**
1. As a cancelled user (still within period), tap **[Reactivate Membership]**.

**Expected Result:**
- The subscription returns to Active without a new charge if still within the paid period; messaging confirms reactivation.

---

### TC-D06 · Subscription event notifications (trial reminders, renewal, failure)

**Ref:** FLOW-17 subscription event notifications
**Actors:** test-trial, test-buyer

**Objective:** Verify subscription lifecycle notifications fire at the right moments.

**Steps:**
1. Fast-forward the trial clock to 7/3/1 days before trial end (test-trial).
2. Fast-forward to a successful renewal charge (test-buyer).
3. Simulate a failed renewal charge.

**Expected Result:**
- Trial reminder notifications are delivered at 7-day, 3-day, and 1-day marks.
- A renewal-success notification is delivered on successful charge.
- A payment-failure notification is delivered (and is treated as critical — bypasses quiet hours) prompting payment-method update.
- A cancellation produces a cancellation-confirmation notification.

### TC-D07 · Grace reminder notifications follow configured thresholds

**Ref:** FLOW-17 × admin `grace_reminder_thresholds`
**Actors:** test-admin + test-grace

**Objective:** Verify grace reminder timing uses the admin-configured threshold array.

**Steps:**
1. As **test-admin**, set `grace_reminder_thresholds` to a distinct set such as `[30, 7, 1]` and save.
2. Fast-forward a grace-period user to just above, then exactly at, each configured threshold.
3. Check both push delivery and the in-app notification center after each threshold.

**Expected Result:**
- Reminder notifications are delivered at 30, 7, and 1 days remaining, with the correct days-left copy.
- Thresholds removed from the config no longer fire after the change.

---

## Group E — Billing History & Status

### TC-E01 · Billing History list — records, status badges, amounts

**Ref:** FLOW-12 · BillingHistoryScreen
**Actors:** test-buyer

**Objective:** Verify billing records render with date, status, description, amount.

**Steps:**
1. As **test-buyer**, open **Billing History**.

**Expected Result:**
- Each record shows the date, a status badge (Succeeded green / Pending orange / Failed red / Refunded grey), description ("Kids Club+ Subscription"), and the formatted amount.
- Pull-to-refresh reloads the list.

---

### TC-E02 · Billing History empty state

**Ref:** FLOW-12 · BillingHistoryScreen
**Actors:** test-free

**Objective:** Verify the empty state for a user who's never been charged.

**Steps:**
1. As **test-free**, open Billing History.

**Expected Result:**
- "No Billing History" with "You haven't been charged yet…" message; no records listed.

---

### TC-E03 · Failed charge shows error message

**Ref:** FLOW-12 · BillingHistoryScreen
**Actors:** A user with a failed charge record

**Objective:** Verify failed billing records surface the error.

**Steps:**
1. Open Billing History for a user that has a failed charge.

**Expected Result:**
- The failed record shows a red "Failed" badge and the error message text below the amount.

---

### TC-E04 · Subscription Status screen — Stripe IDs + period + retries

**Ref:** FLOW-12 · SubscriptionStatusScreen
**Actors:** test-admin / QA

**Objective:** Verify the diagnostic status screen surfaces billing internals.

**Steps:**
1. Open the **Subscription Status** screen for a subscriber.

**Expected Result:**
- Shows a status badge, Stripe customer & subscription IDs, billing period start/end + days remaining, payment-failure retry count (max 3 before grace), grace-period info (if any) with the SP-freeze warning, trial end date, and last-updated timestamp.
- Loading, error (with Retry), and "No subscription record found" states render appropriately.

---

## Group F — Payout Dashboard & Earnings

### TC-F01 · Payout Dashboard hero (SP balance + AUD equivalent)

**Ref:** FLOW-22 · PayoutDashboardScreen
**Actors:** test-seller

**Objective:** Verify the dashboard hero shows balance and currency equivalent.

**Steps:**
1. As **test-seller**, open **Payouts**.

**Expected Result:**
- Header "Payouts"; hero card shows a Coins icon, "SP Balance", "{spCount} SP", and an "≈ ${AUD} AUD" equivalent.
- Hero CTA **[Request Payout]** is present.

---

### TC-F02 · Payout method section (add vs existing)

**Ref:** FLOW-22 / FLOW-23 · PayoutDashboardScreen
**Actors:** test-seller (with method) + a seller without a method

**Objective:** Verify the method section reflects whether a method exists.

**Steps:**
1. Open Payouts as a seller **with** a saved method, then as a seller **without** one.

**Expected Result:**
- With method: shows a bank icon + method name + masked account (e.g., "Bank ••••1234"); tapping opens Payout Settings.
- Without method: shows a "+ Add Bank Account" row; tapping opens the add flow.

---

### TC-F03 · Payout history list (completed / pending)

**Ref:** FLOW-22 · PayoutDashboardScreen
**Actors:** test-seller

**Objective:** Verify the payout history rows render with status.

**Steps:**
1. On Payouts, review the "PAYOUT HISTORY" section.

**Expected Result:**
- Empty: "No payouts yet".
- Populated: rows with a status icon (CheckCircle green / Clock orange), amount, date, and status text ("COMPLETED" / "PENDING").
- Pull-to-refresh reloads.

---

### TC-F04 · Seller Earnings screen — totals, pending, payout breakdown

**Ref:** FLOW-22 · SellerEarningsScreen
**Actors:** test-seller

**Objective:** Verify the earnings screen totals and per-payout breakdown.

**Steps:**
1. As **test-seller**, open **My Earnings**.

**Expected Result:**
- Two summary cards: "Total Earnings" and "Pending" (pending in orange).
- Each payout card shows date, method, net amount, a status badge (ACTION REQUIRED / PENDING / PROCESSING / COMPLETED / FAILED with the documented colors), and a breakdown: Gross, Payout Fee (red), Platform Fee (if > 0).
- Failed payouts show a "⚠️ {reason}" line; requires_action payouts show a **[Set Up Payout Method]** button.

---

### TC-F05 · Seller Earnings empty state

**Ref:** FLOW-22 · SellerEarningsScreen
**Actors:** A seller with no payouts

**Objective:** Verify the earnings empty state.

**Steps:**
1. Open My Earnings as a seller with no completed payouts.

**Expected Result:**
- "No Earnings Yet" + "Complete trades to start earning and receiving payouts".

### TC-F06 · Pending earnings release follows admin-configured delay

**Ref:** FLOW-22 × admin `pending_sp_release_days`
**Actors:** test-admin + test-seller

**Objective:** Verify the pending-release delay controls when completed trade earnings move from Pending to Available.

**Steps:**
1. As **test-admin**, open **/settings/trade-timing**, set `pending_sp_release_days` to a distinct value (for example `1`), and save.
2. As **test-seller**, complete a trade that creates pending seller earnings / pending SP.
3. Open **My Earnings** immediately after completion, then again after QA fast-forwards past the configured release window.

**Expected Result:**
- Immediately after completion, the amount appears in **Pending**, not **Available**.
- After the configured release delay passes, the same amount moves into the available balance.
- New trades follow the updated delay without requiring an app rebuild.

---

## Group G — Payout Methods & Verification

### TC-G01 · Add Stripe Connect payout method (onboarding)

**Ref:** FLOW-23 · PayoutSettingsScreen / payoutMethods
**Actors:** test-seller (no Stripe method)

**Objective:** Verify the Stripe Connect onboarding entry.

**Steps:**
1. On **Payout Settings**, tap **[Add Payout Method]** → choose **Stripe Connect**.

**Expected Result:**
- The Stripe onboarding flow launches; until onboarding completes, the method shows an incomplete/onboarding status and is not usable for withdrawal.
- After onboarding completes, the method shows verified / payouts-enabled.

---

### TC-G02 · Add PayPal / Venmo payout method

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify PayPal/Venmo method creation.

**Steps:**
1. On Payout Settings → Add Payout Method → choose **PayPal** (enter email) and separately **Venmo** (enter handle + phone).

**Expected Result:**
- PayPal saves with the masked email; Venmo saves with handle/phone; each appears in the method list with the correct display name and verification state.

---

### TC-G03 · Add Bank ACH payout method

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify Bank ACH method creation + verification.

**Steps:**
1. On Payout Settings → Add Payout Method → choose **Bank ACH** (routing + account) and complete verification.

**Expected Result:**
- The method saves showing "Bank ••••{last4}" and a verification status; it is only usable once verified.

---

### TC-G04 · Set primary method / delete method (confirmation)

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller (≥2 methods)

**Objective:** Verify primary selection and deletion with confirmation.

**Steps:**
1. With two methods saved, tap **[Set as Primary]** on the non-primary one.
2. Tap **[Delete]** on a method and confirm.

**Expected Result:**
- Exactly one method is marked primary (highlighted); changing primary updates the highlight.
- Delete shows "Delete Payout Method?" confirmation; confirming removes it from the list.

---

### TC-G05 · Unverified method blocks payout

**Ref:** FLOW-23 · RequestPayoutScreen
**Actors:** test-seller (unverified method only)

**Objective:** Verify an unverified method cannot be used to withdraw.

**Steps:**
1. With only an unverified method, attempt **Request Payout**.

**Expected Result:**
- A "Verification Required" alert states the payout method must be verified before withdrawing; the payout is not submitted.

---

### TC-G06 · requires_action payout → "Set Up Payout Method"

**Ref:** FLOW-22 · SellerEarningsScreen / PayoutSettingsScreen
**Actors:** A seller with a requires_action payout

**Objective:** Verify the requires_action CTA routes to setup.

**Steps:**
1. Open My Earnings / Payout Settings for a seller with a requires_action payout.

**Expected Result:**
- The payout shows an "ACTION REQUIRED" badge with a **[Set Up Payout Method]** button that opens the method setup flow.

---

## Group H — Request & Withdraw

### TC-H01 · Request Payout — amount validation vs available

**Ref:** FLOW-22 · RequestPayoutScreen
**Actors:** test-seller

**Objective:** Verify amount validation against the available balance.

**Steps:**
1. As **test-seller**, open **Request Payout**.
2. Enter an amount greater than available, then a valid amount.

**Expected Result:**
- "Available: {N} SP" is shown.
- An over-balance amount shows a red border and "Amount exceeds available balance ({availableCents} SP)" and disables Confirm.
- A valid amount shows the "≈ {AUD}" equivalent and enables Confirm.

---

### TC-H02 · Fee + net summary by method type

**Ref:** FLOW-22 · RequestPayoutScreen
**Actors:** test-seller

**Objective:** Verify the fee and net calculation per method type.

**Steps:**
1. With a valid amount entered, review the sticky fee note and the summary card for Stripe, PayPal/Venmo, and Bank ACH methods.

**Expected Result:**
- Fee note matches the method: Stripe "$0.25 + 0.25%"; PayPal/Venmo "2% (max $20.00)"; Bank ACH "$0.25".
- Summary card shows Amount ({SP} / {AUD}), Transfer fee ({AUD} or "Free"), and a highlighted "You receive" net = amount − fee.

---

### TC-H03 · Confirm Payout success

**Ref:** FLOW-22 · RequestPayoutScreen
**Actors:** test-seller (verified method)

**Objective:** Verify a successful payout request.

**Steps:**
1. Enter a valid amount, select a verified method, tap **[Confirm Payout]**.

**Expected Result:**
- A "Payout Requested" alert confirms "Your payout of {amount} AUD is being processed."; tapping Done returns to the dashboard, and the payout appears as PENDING in history.

---

### TC-H04 · Request blocked when no method / unverified

**Ref:** FLOW-22 / FLOW-23 · RequestPayoutScreen
**Actors:** test-seller (no method)

**Objective:** Verify guard rails when a method is missing.

**Steps:**
1. With no payout method, tap **[Request Payout]** / **[Confirm Payout]**.

**Expected Result:**
- A "No Payout Method" / "Payout Method Required" alert appears with an **[Add Method]** action routing to Payout Settings; no payout is created.

---

### TC-H05 · Withdraw Now from Payout Settings hero

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller (balance > 0)

**Objective:** Verify the Withdraw Now hero path.

**Steps:**
1. On **Payout Settings**, tap **[Withdraw Now]** on the balance hero.

**Expected Result:**
- With a balance and a verified method, the withdrawal flow proceeds and shows a "Withdrawal Requested" confirmation (amount + net + status).
- With no balance: "No Balance" alert. With no method: "Please add a verified payout method first."

### TC-H06 · Admin minimum withdrawal amount blocks smaller payouts

**Ref:** FLOW-22 × admin `minimum_withdrawal_amount_cents`
**Actors:** test-admin + test-seller

**Objective:** Verify the configured minimum withdrawal amount is enforced in the payout flow.

**Steps:**
1. As **test-admin**, set `minimum_withdrawal_amount_cents` to `1000` and save.
2. As **test-seller** with an available balance above $10, open **Request Payout** and enter an amount below the configured minimum (for example $7.00).
3. Enter an amount at or above the configured minimum.

**Expected Result:**
- Amounts below the configured minimum show a clear minimum-withdrawal validation and disable **Confirm**.
- Amounts at or above the configured minimum proceed normally.

### TC-H07 · Minimum withdrawal disabled when config = 0

**Ref:** FLOW-22 × admin `minimum_withdrawal_amount_cents`
**Actors:** test-admin + test-seller

**Objective:** Verify a zero minimum disables the payout floor entirely.

**Steps:**
1. As **test-admin**, set `minimum_withdrawal_amount_cents` to `0` and save.
2. As **test-seller** with a small available balance, open **Request Payout** and enter a small amount that is otherwise valid.

**Expected Result:**
- No minimum-withdrawal warning appears.
- Only balance availability, payout-method, and provider-fee validations remain.

---

## Group I — SP Wallet Balance & Earn

### TC-I01 · SP Wallet hero balance + lifetime stats

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the wallet hero and lifetime stats.

**Steps:**
1. As **test-buyer**, open the **Swap Points** wallet.

**Expected Result:**
- Header "Swap Points"; green hero card shows "{balance} Swap Points".
- Lifetime stat chips: "Total Earned", "Total Spent", and "Pending" with amounts.
- Footer note "🔒 SP can only be used for item purchases".

---

### TC-I02 · Quick actions (Shop / Sell / History)

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the three quick-action buttons navigate correctly.

**Steps:**
1. On the wallet, tap **Shop**, then back; tap **Sell**, then back; tap **History**.

**Expected Result:**
- Shop → Discover; Sell → item creation; History → SP Transaction History.

---

### TC-I03 · How to Earn SP section + Learn More

**Ref:** FLOW-11 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the earn section and learn link.

**Steps:**
1. On the wallet, review "How to Earn SP" and tap "How Trading Works" / Learn More.

**Expected Result:**
- Rows: "Sell an item" (→ item create) and "Refer a friend" (→ referrals / Learn More).
- "How Trading Works" routes to the Help/education screen.

---

### TC-I04 · SP expiration info + expiring-soon alert

**Ref:** FLOW-11 · SpWalletScreen
**Actors:** test-buyer (batch expiring ≤30 days)

**Objective:** Verify expiration messaging.

**Steps:**
1. On the wallet, review the expiration info box and the expiring-soon alert.

**Expected Result:**
- Info box: "Swap Points Expire" — "Points expire after {N} days of inactivity. Use them or lose them!" (N from config).
- An "⚠️ {N} SP will expire in 30 days" alert appears when batches are expiring within 30 days.

---

### TC-I05 · Wallet warning banner by state (active/grace/expired)

**Ref:** FLOW-10 · WalletWarningBanner
**Actors:** test-buyer (active), test-grace (grace), an expired user

**Objective:** Verify the wallet state banner changes by subscription/wallet state.

**Steps:**
1. Open the wallet as active, grace, and expired users.

**Expected Result:**
- Active: green / no warning. Grace period: red banner indicating SP frozen. Expired: red banner indicating SP deleted/unavailable.

---

### TC-I06 · Free user SP wallet inactive state

**Ref:** FLOW-10 / FLOW-11
**Actors:** test-free

**Objective:** Verify a free (non-subscriber) user's wallet is inactive.

**Steps:**
1. As **test-free**, open the wallet.

**Expected Result:**
- The wallet shows an inactive state (cannot earn/spend SP) with messaging directing to subscribe; balance actions are gated.

---

## Group J — SP Transaction History

### TC-J01 · SP History tabs (All / Earned / Spent)

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** test-buyer

**Objective:** Verify the three filter tabs.

**Steps:**
1. From the wallet tap **History**; switch between **All**, **Earned**, and **Spent**.

**Expected Result:**
- Header "SP History".
- All shows every entry; Earned shows only positive amounts; Spent shows only negative amounts. The active tab is bold with a green underline.

---

### TC-J02 · Transaction rows — type icon, label, signed amount

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** test-buyer

**Objective:** Verify each ledger row's icon, label, and color.

**Steps:**
1. Review individual rows across types (sale, purchase, redeem, referral, pending).

**Expected Result:**
- Each row shows a type-specific icon, a human-readable label (type capitalized, underscores → spaces), date/time, and a signed amount: green "+{n} SP" for earned, red "-{n} SP" for spent.

---

### TC-J03 · Empty state per tab

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** A user with no spent entries

**Objective:** Verify the per-tab empty state.

**Steps:**
1. On a tab with no matching entries (e.g., Spent for a user who never spent), review the empty state.

**Expected Result:**
- A grey Coins icon with "No transactions yet".

---

### TC-J04 · Pull-to-refresh updates ledger

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** test-buyer

**Objective:** Verify refresh reloads recent ledger entries.

**Steps:**
1. Trigger an SP-earning event (e.g., complete a sale) then pull-to-refresh the SP History.

**Expected Result:**
- The newest entry appears at the top after refresh.

---

## Group K — Transaction / Billing History (Profile)

### TC-K01 · Transaction History list + status badges

**Ref:** FLOW-12 · TransactionHistoryScreen (profile)
**Actors:** test-buyer

**Objective:** Verify the profile-level billing/transaction history.

**Steps:**
1. From My Subscription → Billing History (or profile menu), open **Transaction History**.

**Expected Result:**
- Header "Transaction History"; each item shows a description, formatted amount, date, and a status badge (Succeeded green / Failed red).
- Pull-to-refresh reloads.

---

### TC-K02 · Transaction History empty + error/retry

**Ref:** FLOW-12 · TransactionHistoryScreen
**Actors:** test-free / forced error

**Objective:** Verify empty and error states.

**Steps:**
1. Open Transaction History with no records, then simulate a load failure.

**Expected Result:**
- Empty: a receipt icon + "No billing history yet."
- Error: a receipt icon + error text + **[Retry]** that reloads.

## Group L — Webhooks & Reconciliation

### TC-L01 · Renewal webhook updates billing history and member state

**Ref:** FLOW-26 · subscription renewal webhook
**Actors:** test-buyer

**Objective:** Verify a valid renewal webhook reconciles the subscription state and billing history.

**Steps:**
1. Ensure **test-buyer** has an active renewable subscription.
2. Trigger the signed renewal webhook event in staging.
3. Reopen **My Subscription** and **Billing History**.

**Expected Result:**
- The subscription remains active with the next billing period advanced as expected.
- Billing History shows a single new successful renewal record.
- The user receives the expected renewal notification if that channel is enabled.

### TC-L02 · Payment-failed webhook moves subscription into retry / grace state

**Ref:** FLOW-26 · payment failure webhook
**Actors:** test-grace

**Objective:** Verify a payment-failed webhook updates the user-visible subscription state.

**Steps:**
1. Trigger a signed `invoice.payment_failed` or equivalent payment-failure webhook for the test subscription.
2. Reopen the subscription screens for the affected user.

**Expected Result:**
- The billing history shows a failed charge record.
- The subscription status screen reflects the retry or grace-period state.
- User-facing banners and renewal reminders align with the failed-payment state.

### TC-L03 · Invalid webhook signature is rejected with no duplicate state change

**Ref:** FLOW-26 · signature verification
**Actors:** QA

**Objective:** Verify an invalid webhook payload is rejected and does not mutate user-visible state.

**Steps:**
1. Record the current subscription or payout state for a test account.
2. Send the same webhook type with an invalid signature.
3. Reload the affected app screens.

**Expected Result:**
- No new billing-history row or payout-state change appears.
- No duplicate notification is sent.
- Existing subscription or payout data remains unchanged.

### TC-L04 · Duplicate webhook delivery is idempotent

**Ref:** FLOW-26 · idempotent processing
**Actors:** QA

**Objective:** Verify replaying the same valid webhook does not create duplicate side effects.

**Steps:**
1. Send a valid signed webhook once and confirm the expected state change.
2. Replay the exact same webhook payload.
3. Reload the relevant app screens.

**Expected Result:**
- The original state change remains correct after the first delivery.
- Replaying the same event does not create a second billing row, second payout update, or duplicate notification.
- The user-visible state is unchanged by the duplicate delivery.

### TC-L05 · Payout-status webhook updates seller payout history

**Ref:** FLOW-26 · payout provider webhooks
**Actors:** test-seller

**Objective:** Verify provider payout webhooks reconcile seller payout status in the app.

**Steps:**
1. Ensure **test-seller** has a payout in `pending` or `processing` state.
2. Trigger a signed payout-completed or payout-failed webhook for that payout.
3. Open the Payout Dashboard and Seller Earnings screens.

**Expected Result:**
- The payout row changes to the provider-reported status.
- Completed payouts show the completion state/date; failed payouts show the failure state and reason if available.
- No second payout row is created for the same provider event.

---

## Regression

### TC-R01 · Subscriber fee applied in trade checkout
**Objective:** Confirm an active subscriber is charged the subscriber transaction fee in a real trade checkout.
**Steps:** 1. As a subscriber, start a trade checkout and view the fee line.
**Expected Result:** The subscriber fee (config value) is shown, not the non-subscriber fee.

### TC-R02 · SP balance consistent across wallet, trade, and history
**Objective:** Confirm the SP available balance matches across the wallet hero, an SP offer slider max, and the ledger sum.
**Steps:** 1. Compare the wallet balance, the max SP usable on an Accept SP listing, and the running ledger.
**Expected Result:** All three reconcile.

### TC-R03 · Payout available balance matches earnings
**Objective:** Confirm the Payout Dashboard available balance equals the Seller Earnings available figure.
**Steps:** 1. Compare Payout Dashboard hero vs My Earnings totals.
**Expected Result:** Available balances reconcile (Lifetime − Pending − Withdrawn).

### TC-R04 · Cancel then reactivate restores SP access
**Objective:** Confirm cancel-before-period-end keeps SP usable and reactivation restores active status.
**Steps:** 1. Cancel, confirm SP still usable, reactivate.
**Expected Result:** SP remains usable through the period; reactivation returns Active.

### TC-R05 · Config change reflects without app rebuild
**Objective:** Confirm changing `subscription_price`, `trial_days`, `transaction_fee_subscriber_cents`, `transaction_fee_non_subscriber_cents`, `grace_period_days`, and `sp_expiration_days` in admin reflects in the app on next load.
**Steps:** 1. Change one or more of those config values to distinct numbers. 2. Reload Plans, Compare Plans, Manage Kids Club+, Subscription Payment, and SP Wallet.
**Expected Result:** The new monthly price, trial length, fee comparison, grace countdown, and SP expiration messaging all render without requiring reinstall or rebuild.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Plans screen — Free vs Kids Club+ (FLOW-12) | TC-A01 |
| Plan comparison table + POPULAR badge | TC-A02 |
| Dynamic pricing/fees from admin config | TC-A03, TC-R05 |
| Current plan marked / disabled | TC-A04 |
| Kids Club+ Overview by status | TC-A05 |
| Start trial → payment screen | TC-B01 |
| Payment benefits + Due today $0.00 (trial) | TC-B02 |
| Stripe payment → Success screen (FLOW-12A) | TC-B03 |
| Trial already used blocked | TC-B04 |
| Trial disabled globally | TC-B05 |
| Trial limit config updates eligibility | TC-B04, TC-B08 |
| Continue Kids Club+ urgency + benefits | TC-B06 |
| Referred user bonus-loss warning | TC-B07 |
| My Subscription paid view | TC-C01 |
| My Subscription quick menu routes | TC-C02 |
| Manage Kids Club+ status + billing | TC-C03 |
| Cancel retention "Keep My Benefits" | TC-C04 |
| Cancel reason modal + final confirm | TC-C05 |
| Cancelled active until period end | TC-C06, TC-R04 |
| Auto-renew toggle / update payment | TC-C07 |
| Grace period banner + SP freeze warning (FLOW-10/12) | TC-D01 |
| Re-subscribe from grace unlocks SP | TC-D02 |
| Subscription Expired screen | TC-D03 |
| Renewal payment full charge | TC-D04 |
| Reactivate from cancelled | TC-D05 |
| Subscription event notifications (FLOW-17) | TC-D06 |
| Grace reminder thresholds from admin config | TC-D07 |
| Billing history list + badges | TC-E01 |
| Billing history empty | TC-E02 |
| Failed charge error message | TC-E03 |
| Subscription Status diagnostics | TC-E04 |
| Payout dashboard hero balance/AUD (FLOW-22) | TC-F01 |
| Payout method section add/existing | TC-F02 |
| Payout history list | TC-F03 |
| Seller Earnings totals + breakdown | TC-F04, TC-R03 |
| Seller Earnings empty | TC-F05 |
| Pending earnings release delay from admin config | TC-F06 |
| Add Stripe Connect method (FLOW-23) | TC-G01 |
| Add PayPal / Venmo method | TC-G02 |
| Add Bank ACH method | TC-G03 |
| Set primary / delete method | TC-G04 |
| Unverified method blocks payout | TC-G05 |
| requires_action → setup CTA | TC-G06 |
| Request payout amount validation | TC-H01 |
| Fee + net summary by method | TC-H02 |
| Confirm payout success | TC-H03 |
| Request blocked no/unverified method | TC-H04 |
| Withdraw Now hero path | TC-H05 |
| Minimum withdrawal config | TC-H06, TC-H07 |
| SP wallet hero + lifetime stats (FLOW-10) | TC-I01, TC-R02 |
| SP wallet quick actions | TC-I02 |
| How to Earn SP + Learn More (FLOW-11) | TC-I03 |
| SP expiration info + expiring-soon alert | TC-I04 |
| Wallet warning banner by state | TC-I05 |
| Free user SP wallet inactive | TC-I06 |
| SP history tabs All/Earned/Spent | TC-J01 |
| SP history rows icon/label/amount | TC-J02 |
| SP history empty per tab | TC-J03 |
| SP history pull-to-refresh | TC-J04 |
| Transaction history list + badges | TC-K01 |
| Transaction history empty + error/retry | TC-K02 |
| Subscriber fee in trade checkout | TC-R01 |
