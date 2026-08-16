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
| **A — Plans & Comparison** | SUB-TC-A01 | Subscription Plans screen — Free vs Kids Club+ cards |
| | SUB-TC-A02 | Plan Comparison table — feature-by-feature + POPULAR badge |
| | SUB-TC-A03 | Dynamic pricing & fees pulled from admin config |
| | SUB-TC-A04 | Current plan reflected (button disabled / "Current Plan") |
| | SUB-TC-A05 | Kids Club+ Overview screen by subscription status |
| **B — Start Trial & Payment** | SUB-TC-B01 | Start free trial from Plans → payment screen |
| | SUB-TC-B02 | Payment screen benefits + pricing + "Due today $0.00" (trial) |
| | SUB-TC-B03 | Complete Stripe payment → Success screen |
| | SUB-TC-B04 | Trial already used — blocked with support/subscribe options |
| | SUB-TC-B05 | Trial disabled globally — Free tier only |
| | SUB-TC-B06 | Continue Kids Club+ (mid-trial) urgency + benefits |
| | SUB-TC-B07 | Referred user warned about bonus loss before choosing Free |
| | SUB-TC-B08 | Admin changes trial-limit config → trial CTA updates |
| | SUB-TC-B09 | Cancel Stripe payment sheet — no error, retry available |
| | SUB-TC-B10 | Card declined — clear error + retry |
| | SUB-TC-B11 | Re-subscribe reuses saved payment method (1-click) |
| | SUB-TC-B12 | Network error during payment — retry succeeds |
| | SUB-TC-B13 | Apple Pay / Google Pay payment |
| **C — Manage & Cancel** | SUB-TC-C01 | My Subscription screen — paid member view |
| | SUB-TC-C02 | My Subscription quick menu (Billing / Payment / Help) |
| | SUB-TC-C03 | Manage Kids Club+ — status, next billing, days remaining |
| | SUB-TC-C04 | Cancel flow — retention screen "Keep My Benefits" |
| | SUB-TC-C05 | Cancel reason modal + final confirmation |
| | SUB-TC-C06 | Cancelled subscription stays active until period end |
| | SUB-TC-C07 | Auto-renew toggle / update payment method |
| | SUB-TC-C08 | Manage Kids Club+ free/no-subscription state |
| | SUB-TC-C09 | Manage Kids Club+ expired state |
| | SUB-TC-C10 | My Subscription free-user state |
| | SUB-TC-C11 | My Subscription "Learn More" link |
| | SUB-TC-C12 | My Subscription "Member Since" value (latent bug) |
| **D — Renewal, Grace & Expiry** | SUB-TC-D01 | Grace period banner + SP wallet frozen warning |
| | SUB-TC-D02 | Re-subscribe from grace period |
| | SUB-TC-D03 | Subscription Expired screen — benefits lost + Renew |
| | SUB-TC-D04 | Renew (isRenewal) — payment screen "Due today" = full price |
| | SUB-TC-D05 | Reactivate from cancelled state |
| | SUB-TC-D06 | Subscription event notifications (trial reminders, renewal, failure) |
| | SUB-TC-D07 | Grace reminder notifications follow configured thresholds |
| **E — Billing History & Status** | SUB-TC-E01 | Billing History list — records, status badges, amounts |
| | SUB-TC-E02 | Billing History empty state |
| | SUB-TC-E03 | Failed charge shows error message |
| | SUB-TC-E04 | Subscription Status screen — Stripe IDs + period + retries |
| **F — Payout Dashboard & Earnings** | SUB-TC-F01 | Payout Dashboard hero (SP balance + AUD equivalent) |
| | SUB-TC-F02 | Payout method section (add vs existing) |
| | SUB-TC-F03 | Payout history list (completed / pending) |
| | SUB-TC-F04 | Seller Earnings screen — totals, pending, payout breakdown |
| | SUB-TC-F05 | Seller Earnings empty state |
| | SUB-TC-F06 | Pending earnings release follows admin-configured delay |
| | SUB-TC-F07 | Seller Earnings error state + Retry |
| | SUB-TC-F08 | Seller Earnings Load More pagination |
| **G — Payout Methods & Verification** | SUB-TC-G01 | Add Stripe Connect payout method (onboarding) |
| | SUB-TC-G02 | Add PayPal / Venmo payout method |
| | SUB-TC-G03 | Add Bank ACH payout method |
| | SUB-TC-G04 | Set primary method / delete method (confirmation) |
| | SUB-TC-G05 | Unverified method blocks payout |
| | SUB-TC-G06 | requires_action payout → "Set Up Payout Method" |
| | SUB-TC-G07 | Payout Settings — "Edit Details" sheet |
| | SUB-TC-G08 | "Cannot Delete Primary/Only Method" guard |
| | SUB-TC-G09 | "Cannot Set as Primary" (unverified) guard |
| | SUB-TC-G10 | Payout history Load More |
| | SUB-TC-G11 | NoMethodModal flow |
| **H — Request & Withdraw** | SUB-TC-H01 | Request Payout — amount validation vs available |
| | SUB-TC-H02 | Fee + net summary by method type |
| | SUB-TC-H03 | Confirm Payout success |
| | SUB-TC-H04 | Request blocked when no method / unverified |
| | SUB-TC-H05 | Withdraw Now from Payout Settings hero |
| | SUB-TC-H06 | Admin minimum withdrawal blocks smaller payouts |
| | SUB-TC-H07 | Minimum withdrawal disabled when config = 0 |
| **I — SP Wallet Balance & Earn** | SUB-TC-I01 | SP Wallet hero balance + lifetime stats |
| | SUB-TC-I02 | Quick actions (Shop / Sell / History) |
| | SUB-TC-I03 | How to Earn SP section + Learn More |
| | SUB-TC-I04 | SP expiration info + expiring-soon alert |
| | SUB-TC-I05 | Wallet warning banner by state (active/grace/expired) |
| | SUB-TC-I06 | Free user SP wallet inactive state |
| | SUB-TC-I07 | SP Wallet — "Reserved in trades" card |
| | SUB-TC-I08 | SP Wallet — "Wallet Not Found" error |
| | SUB-TC-I09 | SP Wallet — pending-release summary note |
| **J — SP Transaction History** | SUB-TC-J01 | SP History tabs (All / Earned / Spent) |
| | SUB-TC-J02 | Transaction rows — type icon, label, signed amount |
| | SUB-TC-J03 | Empty state per tab |
| | SUB-TC-J04 | Pull-to-refresh updates ledger |
| **K — Transaction / Billing History (Profile)** | SUB-TC-K01 | Transaction History list + status badges |
| | SUB-TC-K02 | Transaction History empty + error/retry |
| **L — Webhooks & Reconciliation** | SUB-TC-L01 | Renewal webhook updates billing history and member state |
| | SUB-TC-L02 | Payment-failed webhook moves subscription into retry / grace state |
| | SUB-TC-L03 | Invalid webhook signature is rejected with no duplicate state change |
| | SUB-TC-L04 | Duplicate webhook delivery is idempotent |
| | SUB-TC-L05 | Payout-status webhook updates seller payout history |
| **M — Payment Methods (Card on File)** | SUB-TC-M01 | Payment Methods — loading state |
| | SUB-TC-M02 | Empty state + Add Payment Method (Stripe sheet) |
| | SUB-TC-M03 | Saved-card display + security banner |
| | SUB-TC-M04 | Update Payment Method |
| | SUB-TC-M05 | Remove This Card (confirm + success) |
| | SUB-TC-M06 | Go Back |
| | SUB-TC-M07 | Backend contract — attach / detach / retryFailedPayment branches |
| **N — Kids Club Join & Continue** | SUB-TC-N01 | JoinKidsClub value-prop + web CTA |
| | SUB-TC-N02 | JoinKidsClub web redirect (passitup.com) |
| | SUB-TC-N03 | Route-alias reachability (JoinKidsClub vs deep-link-only aliases) |
| | SUB-TC-N04 | ContinueKidsClub active-subscription variant |
| | SUB-TC-N05 | ContinueKidsClub loading state |
| | SUB-TC-N06 | ContinueKidsClub trial-ending urgency badge |

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

### SUB-TC-A01 · Subscription Plans screen — Free vs Kids Club+ cards

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

### SUB-TC-A02 · Plan Comparison table — feature-by-feature + POPULAR badge

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
- **[Free Plan]** returns to the previous screen; **[Start {N}-day Trial]** navigates to the payment screen with isRenewal = false.

---

### SUB-TC-A03 · Dynamic pricing & fees pulled from admin config

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

### SUB-TC-A04 · Current plan reflected (button disabled / "Current Plan")

**Ref:** FLOW-12 · UpgradePlanScreen / SubscriptionPlansScreen
**Actors:** test-buyer (subscriber)

**Objective:** Verify a current subscriber sees their active tier marked, with the upgrade CTA disabled.

**Steps:**
1. Log in as **test-buyer** and open **Plans** and **Upgrade Plan**.

**Expected Result:**
- The Kids Club+ card shows a "Current Plan" chip/badge and its CTA is disabled (no re-purchase path).
- The Free card's downgrade action is disabled.

---

### SUB-TC-A05 · Kids Club+ Overview screen by subscription status

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

### SUB-TC-B01 · Start free trial from Plans → payment screen

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** test-free (trial available)

**Objective:** Verify tapping Start Trial routes to the payment screen with trial context.

**Steps:**
1. As **test-free**, open Plans and tap **[Start {N}-day Trial]** on Kids Club+.

**Expected Result:**
- Navigates to the **Payment** screen with title "Join Kids Club+".
- Sub-title "Unlock Swap Points and reduced fees".

---

### SUB-TC-B02 · Payment screen benefits + pricing + "Due today $0.00" (trial)

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** test-free

**Objective:** Verify the payment screen content for a new trial.

**Steps:**
1. On the Payment screen (from SUB-TC-B01), review the benefits, pricing card, and totals.

**Expected Result:**
- "What you get:" lists four benefits: Earn & Spend Swap Points; Lower Transaction Fees (showing subscriber vs non-subscriber fee); Priority Matching; Early Access.
- Pricing card: "Kids Club+ monthly membership" + monthly price, "First charge after trial ends", and a "{N}-day free trial" badge.
- Payment method row shows "Secure checkout with Stripe".
- **Due today** = **$0.00** (because it's a trial).
- Terms text states automatic monthly billing, cancel anytime, no refunds for partial months.

---

### SUB-TC-B03 · Complete Stripe payment → Success screen

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

### SUB-TC-B04 · Trial already used — blocked with support/subscribe options

**Ref:** FLOW-12 · trial limit
**Actors:** test-free-2 (`can_start_trial = false`)

**Objective:** Verify a user who already used their trial cannot start another.

**Steps:**
1. As **test-free-2**, attempt to start a trial from Plans / Continue Kids Club+ / Subscription Choice.

**Expected Result:**
- An alert "You've already used your free trial" appears with options to contact support or subscribe directly (no second free trial granted).

---

### SUB-TC-B05 · Trial disabled globally — Free tier only

**Ref:** FLOW-12 · admin `isTrialEnabled`
**Actors:** test-admin + test-free

**Objective:** Verify disabling trials hides/blocks the trial path.

**Steps:**
1. As **test-admin**, disable trial subscriptions in config.
2. As **test-free**, open Subscription Choice / Continue Kids Club+.

**Expected Result:**
- An alert states "Trial subscription is not currently available. Please choose Free Tier." (or the trial CTA is hidden), and only the Free path proceeds.

---

### SUB-TC-B06 · Continue Kids Club+ (mid-trial) urgency + benefits

> ⚠️ **Needs re-verification (2026-08-12):** The exact phrase "{N} days left in trial" was not found in the source — verify the actual days-remaining badge wording.

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

### SUB-TC-B07 · Referred user warned about bonus loss before choosing Free

**Ref:** FLOW-13 referrals × FLOW-12
**Actors:** A referred new user during onboarding (SubscriptionChoiceScreen)

**Objective:** Verify a referred user is warned before downgrading to Free.

**Steps:**
1. Sign up via a referral code, reach **Subscription Choice** in onboarding, and tap the Free tier option.

**Expected Result:**
- A "Wait! Potential Bonus Loss" alert warns about losing the sign-up bonus before the Free choice is confirmed.
- Confirming proceeds to Free (profile_completed = true); cancelling keeps the trial choice available.

### SUB-TC-B08 · Admin changes trial-limit config and the trial CTA updates

**Ref:** FLOW-12 · `max_trial_uses`
**Actors:** test-admin + test-free-2

**Objective:** Verify changing the trial-limit config updates eligibility without an app rebuild.

**Steps:**
1. As **test-admin**, open **/config**, set `max_trial_uses` to `0`, and save.
2. As **test-free-2** (the exhausted-trial user from SUB-TC-B04), reopen **Subscription Choice** / **Plans**.
3. Set `max_trial_uses` back to `1` and reload the same screens.

**Expected Result:**
- With `max_trial_uses = 0`, the previously blocked user sees the trial CTA enabled again because the limit is now unlimited.
- Restoring the limit removes the CTA again for the exhausted user on next load.

---

### SUB-TC-B09 · Cancel Stripe payment sheet — no error, retry available

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** test-free

**Objective:** Verify cancelling the Stripe sheet is a non-error path.

**Steps:**
1. Open the payment screen and tap **[Subscribe]**.
2. Tap ✕ / Cancel in the Payment Sheet header.

**Expected Result:**
- Sheet closes; no error alert shown; user stays on the payment screen and the Subscribe button is immediately tappable again.

---

### SUB-TC-B10 · Card declined — clear error + retry

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** test-free (declining test card `4000 0000 0000 0002`)

**Objective:** Verify decline detection and a clear error.

**Steps:**
1. Enter the declining card and attempt to subscribe.
2. Close the sheet and review the alert.

**Expected Result:**
- The sheet surfaces "Your card was declined"; an app alert "Payment Error — Unable to process payment" appears; the user remains on the payment screen and can retry with a valid card.

---

### SUB-TC-B11 · Re-subscribe reuses saved payment method (1-click)

**Ref:** FLOW-12A · SubscriptionPaymentScreen (isRenewal)
**Actors:** test-grace (with a saved method)

**Objective:** Verify saved-card pre-selection for re-subscribe.

**Steps:**
1. From grace, tap **[Re-subscribe Now]**.
2. Review the Payment Sheet.
3. Tap **[Subscribe]** without re-entering card details.

**Expected Result:**
- The sheet pre-selects the saved method (e.g., "Visa •••• 4242"); no re-entry required; success restores Active.

---

### SUB-TC-B12 · Network error during payment — retry succeeds

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** test-free

**Objective:** Verify graceful network failure and recovery.

**Steps:**
1. Enable airplane mode and tap **[Subscribe]**; wait for timeout.
2. Re-enable network and tap **[Subscribe]** again.

**Expected Result:**
- Error alert "Unable to process payment. Please check your connection."; after restoring connectivity the retry succeeds.

---

### SUB-TC-B13 · Apple Pay / Google Pay payment

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** test-free

**Objective:** Verify wallet-pay entry points.

**Steps:**
1. Open the Payment Sheet and confirm Apple Pay (iOS) / Google Pay (Android) is visible.
2. Complete wallet authentication.

**Expected Result:**
- The wallet option is visible; payment completes with the same success flow as card entry.

---

## Group C — Manage & Cancel

### SUB-TC-C01 · My Subscription screen — paid member view

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

### SUB-TC-C02 · My Subscription quick menu (Billing / Payment / Help)

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

### SUB-TC-C03 · Manage Kids Club+ — status, next billing, days remaining

> ⚠️ **Needs re-verification (2026-08-12):** The helper text "You'll continue to have access until the end of your current billing period." was not found verbatim — verify the actual helper copy.

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

### SUB-TC-C04 · Cancel flow — retention screen "Keep My Benefits"

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

### SUB-TC-C05 · Cancel reason modal + final confirmation

**Ref:** FLOW-12 · ManageKidsClubScreen (reason modal) — the retention screen (CancelSubscriptionScreen) does not collect a reason.
**Actors:** test-buyer

**Objective:** Verify cancellation requires a reason and a final confirmation.

**Steps:**
1. On **Manage Kids Club+**, tap **[Cancel Kids Club+]** to open the cancel-reason modal.
2. Select a cancellation reason (e.g., "Too expensive"); for "Other reason" enter free text.
3. Confirm by tapping **[Confirm Cancellation]**.

**Expected Result:**
- The reason modal ("Cancel Kids Club+?") shows the predefined reasons including "Other reason" with a text input; **[Confirm Cancellation]** is disabled until a reason is selected; **[Keep Subscription]** dismisses without cancelling.
- After confirming, the subscription is set to cancel at period end (a trial ends immediately) and the status updates; a "Cancellation Confirmed" message appears.
- Note: the separate retention screen (CancelSubscriptionScreen, reached from My Subscription) has **no** reason selector — "I still want to cancel" there confirms via a "Cancel Subscription?" alert using a hardcoded reason.

**Setup:**
- Logged in as **test-buyer** who is an **active Kids Club+ subscriber** (trial or paid) so the Manage Kids Club+ cancel path is reachable. A seeded active subscriber is required; a cancelled/expired account will not render the [Cancel Kids Club+] button.

**Locator hints:**
- Now fully instrumented (`src/screens/subscription/ManageKidsClubScreen.tsx`, 2026-08-13):
  - [Cancel Kids Club+] button → `testID="cancel-kids-club-button"` (`accessible` + `accessibilityRole="button"` + `accessibilityLabel="Cancel Kids Club+"`).
  - Cancel-reason modal container → `testID="cancel-reason-modal"` (title "Cancel Kids Club+?").
  - Reason options → `testID={\`cancel-reason-${reason.id}\`}` — e.g. `cancel-reason-too_expensive`, `cancel-reason-not_using`, `cancel-reason-child_lost_interest`, `cancel-reason-found_alternative`, `cancel-reason-technical_issues`, `cancel-reason-other` (`accessible` + `accessibilityRole="button"` + `accessibilityLabel={reason.label}`).
  - Custom-reason TextInput (shown when "Other reason" selected) → `testID="cancel-reason-other-input"`.
  - [Confirm Cancellation] (disabled until a reason is selected) → `testID="cancel-confirm-button"`.
  - [Keep Subscription] → `testID="cancel-keep-button"`.

**Assert:**
1. Tapping [Cancel Kids Club+] opens the "Cancel Kids Club+?" modal listing predefined reasons incl. "Other reason"; selecting "Other reason" reveals the free-text input.
2. [Confirm Cancellation] is disabled until a reason is selected; [Keep Subscription] closes the modal with the subscription unchanged.
3. After confirming with a reason, status updates to cancel-at-period-end (trial ends immediately) and a "Cancellation Confirmed" message appears.

**Dependencies:**
- Real subscription mutation: cancel calls `cancelSubscription(reason)` → server + Stripe. Deterministic given the seeded active subscriber, but it **changes the seed account's state** — use a dedicated disposable subscriber or re-seed between runs. No timers.

---

### SUB-TC-C06 · Cancelled subscription stays active until period end

> ⚠️ **Needs re-verification (2026-08-12):** The "can reactivate" message was not found verbatim — verify the actual reactivation messaging.

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-buyer (just cancelled)

**Objective:** Verify benefits persist until the end of the billing period after cancellation.

**Steps:**
1. After cancelling (SUB-TC-C05), reopen Manage Kids Club+ / My Subscription before the period ends.

**Expected Result:**
- Status shows cancelled but still active until the period end date.
- SP wallet remains usable until the period ends; a "can reactivate" message is shown.

---

### SUB-TC-C07 · Auto-renew toggle / update payment method

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-buyer

**Objective:** Verify the auto-renew toggle and payment-method update entry points.

**Steps:**
1. On Manage Kids Club+, toggle auto-renew off then on.
2. Tap **Update** on the payment-method section.

**Expected Result:**
- Auto-renew state persists across screen reloads.
- The payment-method action opens the update flow (or the appropriate add/update entry point).

### SUB-TC-C08 · Manage Kids Club+ free/no-subscription state

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-free

**Objective:** Verify the free state and its subscribe CTA.

**Steps:**
1. As **test-free**, open **Manage Kids Club+**.

**Expected Result:**
- Card shows `You don't have an active Kids Club+ subscription.` with a **Subscribe to Kids Club+** button that navigates to **JoinKidsClub**.

### SUB-TC-C09 · Manage Kids Club+ expired state

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-buyer (expired)

**Objective:** Verify the expired info box and re-subscribe CTA.

**Steps:**
1. Open **Manage Kids Club+** with an expired subscription.

**Expected Result:**
- Info box **Your subscription has expired** with `Re-subscribe to restore Kids Club+ access and unfreeze any remaining Swap Points.` and a **Re-subscribe to Kids Club+** button.
- **Note:** the cancel-reason "Other reason" free-text input is already covered by the corrected SUB-TC-C05 — not duplicated here.

### SUB-TC-C10 · My Subscription free-user state

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-free

**Objective:** Verify the free plan view and upgrade CTA.

**Steps:**
1. As **test-free**, open **My Subscription**.

**Expected Result:**
- Plan card shows **Free Plan** (no `ACTIVE member` badge); footer shows **Renew Date** only (no **Member Since** row).
- Button **Upgrade to Kids Club+** navigates to `UpgradePlan`.

### SUB-TC-C11 · My Subscription "Learn More" link

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-buyer

**Objective:** Verify the benefits "Learn More" link routes to the SP-definition help section.

**Steps:**
1. As a paid member, open **My Subscription** and tap **Learn More**.

**Expected Result:**
- Navigates to the Help screen with the `sp_definition` section.

### SUB-TC-C12 · My Subscription "Member Since" value (latent bug)

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-buyer

**Objective:** Document the hardcoded "Member Since" value as a latent bug to verify.

**Steps:**
1. As a paid member, open **My Subscription** and read the **Member Since** row.

**Expected Result:**
- The row renders the literal `May 2024` regardless of the actual subscription start date.
- **Flag for product:** this is a hardcoded string, not derived from the subscription record — worth a product-side look.

---

## Group D — Renewal, Grace & Expiry

### SUB-TC-D01 · Grace period banner + SP wallet frozen warning

**Ref:** FLOW-12 · FLOW-10 · ManageKidsClubScreen
**Actors:** test-grace

**Objective:** Verify grace-period messaging and the SP-freeze warning.

**Steps:**
1. As **test-grace**, open Manage Kids Club+ / Kids Club+ overview.

**Expected Result:**
- An urgency message ("Your subscription ended on …") with days left in grace (default 90) is shown.
- A "Your SP wallet will be frozen if you don't re-subscribe" warning is displayed alongside a **[Re-subscribe]** CTA.

---

### SUB-TC-D02 · Re-subscribe from grace period

**Ref:** FLOW-12A · SubscriptionPaymentScreen (isRenewal)
**Actors:** test-grace

**Objective:** Verify re-subscribing from grace restores the subscription and unlocks SP.

**Steps:**
1. As **test-grace**, tap **[Re-subscribe]** / **[Re-subscribe and Unlock SP]** and complete payment.

**Expected Result:**
- Payment screen title reads "Re-subscribe to Kids Club+" with **Due today** = the full monthly price (no trial badge).
- After success, status returns to Active and the SP wallet warning banner clears (wallet usable again).

---

### SUB-TC-D03 · Subscription Expired screen — benefits lost + Renew

> ⚠️ **Needs re-verification (2026-08-12):** Index title says "benefits lost" but the screen uses "What you're missing out on:" — verify the intended description matches current copy.

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

### SUB-TC-D04 · Renew (isRenewal) — payment screen "Due today" = full price

**Ref:** FLOW-12A · SubscriptionPaymentScreen
**Actors:** Expired/cancelled user renewing

**Objective:** Verify renewal payment charges immediately (no trial).

**Steps:**
1. From Expired/Manage, tap **[Renew Plan]** and review the payment screen.

**Expected Result:**
- Title "Re-subscribe to Kids Club+", no "{N}-day free trial" badge, and **Due today** equals the full monthly price.
- Success routes to the Success screen with the "Welcome back! Your subscription is active." copy.

---

### SUB-TC-D05 · Reactivate from cancelled state

**Ref:** FLOW-12 · ManageKidsClubScreen / KidsClubOverviewScreen
**Actors:** A cancelled (not yet expired) user

**Objective:** Verify reactivation before expiry restores active status.

**Steps:**
1. As a cancelled user (still within period), tap **[Reactivate Membership]**.

**Expected Result:**
- The subscription returns to Active without a new charge if still within the paid period; messaging confirms reactivation.

---

### SUB-TC-D06 · Subscription event notifications (trial reminders, renewal, failure)

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

### SUB-TC-D07 · Grace reminder notifications follow configured thresholds

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

### SUB-TC-E01 · Billing History list — records, status badges, amounts

**Ref:** FLOW-12 · BillingHistoryScreen
**Actors:** test-buyer

**Objective:** Verify billing records render with date, status, description, amount.

**Steps:**
1. As **test-buyer**, open **Billing History**.

**Expected Result:**
- Each record shows the date, a status badge (Succeeded green / Pending orange / Failed red / Refunded grey), description ("Kids Club+ Subscription"), and the formatted amount.
- Pull-to-refresh reloads the list.

---

### SUB-TC-E02 · Billing History empty state

**Ref:** FLOW-12 · BillingHistoryScreen
**Actors:** test-free

**Objective:** Verify the empty state for a user who's never been charged.

**Steps:**
1. As **test-free**, open Billing History.

**Expected Result:**
- "No Billing History" with "You haven't been charged yet…" message; no records listed.

---

### SUB-TC-E03 · Failed charge shows error message

**Ref:** FLOW-12 · BillingHistoryScreen
**Actors:** A user with a failed charge record

**Objective:** Verify failed billing records surface the error.

**Steps:**
1. Open Billing History for a user that has a failed charge.

**Expected Result:**
- The failed record shows a red "Failed" badge and the error message text below the amount.

---

### SUB-TC-E04 · Subscription Status screen — Stripe IDs + period + retries

**Ref:** FLOW-12 · SubscriptionStatusScreen
**Actors:** test-admin / QA

**Objective:** Verify the diagnostic status screen surfaces billing internals.

**Steps:**
1. Open the **Subscription Status** screen for a subscriber.

**Expected Result:**
- Shows a status badge, Stripe customer & subscription IDs, billing period start/end + days remaining, next billing date, auto-renew flag, payment-failure retry count (max 3 before grace), grace-period info (if any) with the SP-freeze warning, trial end date, and last-updated timestamp.
- Loading, error (with Retry), and "No subscription record found" states render appropriately.

---

## Group F — Payout Dashboard & Earnings

### SUB-TC-F01 · Payout Dashboard hero (SP balance + AUD equivalent)

**Ref:** FLOW-22 · PayoutDashboardScreen
**Actors:** test-seller

**Objective:** Verify the dashboard hero shows balance and currency equivalent.

**Steps:**
1. As **test-seller**, open **Payouts**.

**Expected Result:**
- Header "Payouts"; hero card shows a Coins icon, "SP Balance", "{spCount} SP", and an "≈ ${AUD} AUD" equivalent.
- Hero CTA **[Request Payout]** is present.

---

### SUB-TC-F02 · Payout method section (add vs existing)

**Ref:** FLOW-22 / FLOW-23 · PayoutDashboardScreen
**Actors:** test-seller (with method) + a seller without a method

**Objective:** Verify the method section reflects whether a method exists.

**Steps:**
1. Open Payouts as a seller **with** a saved method, then as a seller **without** one.

**Expected Result:**
- With method: shows a bank icon + method name + masked account (e.g., "Bank ••••1234"); tapping opens Payout Settings.
- Without method: shows a "+ Add Bank Account" row; tapping opens the add flow.

---

### SUB-TC-F03 · Payout history list (completed / pending)

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

### SUB-TC-F04 · Seller Earnings screen — totals, pending, payout breakdown

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

### SUB-TC-F05 · Seller Earnings empty state

**Ref:** FLOW-22 · SellerEarningsScreen
**Actors:** A seller with no payouts

**Objective:** Verify the earnings empty state.

**Steps:**
1. Open My Earnings as a seller with no completed payouts.

**Expected Result:**
- "No Earnings Yet" + "Complete trades to start earning and receiving payouts".

### SUB-TC-F06 · Pending earnings release follows admin-configured delay

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

### SUB-TC-F07 · Seller Earnings error state + Retry

**Ref:** FLOW-22 · SellerEarningsScreen
**Actors:** test-seller

**Objective:** Verify the error state and the Retry re-load.

**Steps:**
1. Open **My Earnings** while the earnings fetch fails (e.g., network error).
2. Tap **Retry**.

**Expected Result:**
- Shows **Failed to Load Earnings** with the error message and a **Retry** button.
- Retry re-runs the load and shows the earnings once it succeeds.

### SUB-TC-F08 · Seller Earnings Load More pagination

**Ref:** FLOW-22 · SellerEarningsScreen
**Actors:** test-seller

**Objective:** Verify payout-list pagination.

**Steps:**
1. As **test-seller** with more than 20 payouts, open **My Earnings** and tap **Load More**.

**Expected Result:**
- The list grows by 20 per tap; **Load More** disappears when no more payouts remain; refreshing resets the list to the first 20.

---

## Group G — Payout Methods & Verification

### SUB-TC-G01 · Add Stripe Connect payout method (onboarding)

**Ref:** FLOW-23 · PayoutSettingsScreen / payoutMethods
**Actors:** test-seller (no Stripe method)

**Objective:** Verify the Stripe Connect onboarding entry.

**Steps:**
1. On **Payout Settings**, tap **[Add Payout Method]** → choose **Stripe Connect**.

**Expected Result:**
- The Stripe onboarding flow launches; until onboarding completes, the method shows an incomplete/onboarding status and is not usable for withdrawal.
- After onboarding completes, the method shows verified / payouts-enabled.

---

### SUB-TC-G02 · Add PayPal / Venmo payout method

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify PayPal/Venmo method creation.

**Steps:**
1. On Payout Settings → Add Payout Method → choose **PayPal** (enter email) and separately **Venmo** (enter handle + phone).

**Expected Result:**
- PayPal saves with the masked email; Venmo saves with handle/phone; each appears in the method list with the correct display name and verification state.

---

### SUB-TC-G03 · Add Bank ACH payout method

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify Bank ACH method creation + verification.

**Steps:**
1. On Payout Settings → Add Payout Method → choose **Bank ACH** (routing + account) and complete verification.

**Expected Result:**
- The method saves showing "Bank ••••{last4}" and a verification status; it is only usable once verified.

---

### SUB-TC-G04 · Set primary method / delete method (confirmation)

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

### SUB-TC-G05 · Unverified method blocks payout

**Ref:** FLOW-23 · RequestPayoutScreen
**Actors:** test-seller (unverified method only)

**Objective:** Verify an unverified method cannot be used to withdraw.

**Steps:**
1. With only an unverified method, attempt **Request Payout**.

**Expected Result:**
- A "Verification Required" alert states the payout method must be verified before withdrawing; the payout is not submitted.

---

### SUB-TC-G06 · requires_action payout → "Set Up Payout Method"

**Ref:** FLOW-22 · SellerEarningsScreen / PayoutSettingsScreen
**Actors:** A seller with a requires_action payout

**Objective:** Verify the requires_action CTA routes to setup.

**Steps:**
1. Open My Earnings / Payout Settings for a seller with a requires_action payout.

**Expected Result:**
- The payout shows an "ACTION REQUIRED" badge with a **[Set Up Payout Method]** button that opens the method setup flow.

### SUB-TC-G07 · Payout Settings — "Edit Details" sheet

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify the bottom-sheet "Edit Details" option.

**Steps:**
1. Open **Payout Settings**, tap a payout method's kebab menu, then tap **Edit Details**.

**Expected Result:**
- Alert **Edit Details** shows `Editing payout method details is not yet available. Contact support for changes.`

### SUB-TC-G08 · "Cannot Delete Primary/Only Method" guard

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify the delete guards for a primary and for an only method.

**Steps:**
1. With only one method (which is primary), open the method sheet and tap **Delete Method**.
2. With a primary plus at least one other method, attempt to delete the primary.

**Expected Result:**
- Only method → **Cannot Delete Only Method** / `Add another payout method first before removing this one.`
- Primary with others → **Cannot Delete Primary Method** / `Please set another method as primary first, then delete this one.`

### SUB-TC-G09 · "Cannot Set as Primary" (unverified) guard

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller (with an unverified method)

**Objective:** Verify an unverified method cannot be set primary.

**Steps:**
1. Attempt to set an unverified method as primary (via the radio or the sheet's **Set as Primary**).

**Expected Result:**
- Alert **Cannot Set as Primary** shows: This method has status "{status_message}". Please wait until it is verified before setting it as primary.
- The sheet's **Set as Primary** option is disabled with the subtext `Verification required before setting as primary`.

### SUB-TC-G10 · Payout history Load More

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify payout-history pagination.

**Steps:**
1. With more than 5 payouts, open **Payout Settings** and tap **Load More** in **Payout History**.

**Expected Result:**
- The list grows by 5 per tap; refreshing resets the list to the first 5.

### SUB-TC-G11 · NoMethodModal flow

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller (no payout method)

**Objective:** Verify the no-method withdrawal guard modal.

**Steps:**
1. With no payout method configured, tap **Withdraw Now**.

**Expected Result:**
- Modal **Payment Method Required** shows `To withdraw your earnings, you need to add and verify a payout method first.` with **Add Payout Method** (opens the add flow) and **Cancel**.

---

## Group H — Request & Withdraw

### SUB-TC-H01 · Request Payout — amount validation vs available

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

### SUB-TC-H02 · Fee + net summary by method type

**Ref:** FLOW-22 · RequestPayoutScreen
**Actors:** test-seller

**Objective:** Verify the fee and net calculation per method type.

**Steps:**
1. With a valid amount entered, review the sticky fee note and the summary card for Stripe, PayPal/Venmo, and Bank ACH methods.

**Expected Result:**
- Fee note matches the method: Stripe "$0.25 + 0.25%"; PayPal/Venmo "2% (max $20.00)"; Bank ACH "$0.25".
- Summary card shows Amount ({SP} / {AUD}), Transfer fee ({AUD} or "Free"), and a highlighted "You receive" net = amount − fee.

---

### SUB-TC-H03 · Confirm Payout success

**Ref:** FLOW-22 · RequestPayoutScreen
**Actors:** test-seller (verified method)

**Objective:** Verify a successful payout request.

**Steps:**
1. Enter a valid amount, select a verified method, tap **[Confirm Payout]**.

**Expected Result:**
- A "Payout Requested" alert confirms "Your payout of {amount} AUD is being processed."; tapping Done returns to the dashboard, and the payout appears as PENDING in history.

---

### SUB-TC-H04 · Request blocked when no method / unverified

**Ref:** FLOW-22 / FLOW-23 · RequestPayoutScreen
**Actors:** test-seller (no method)

**Objective:** Verify guard rails when a method is missing.

**Steps:**
1. With no payout method, tap **[Request Payout]** / **[Confirm Payout]**.

**Expected Result:**
- A "No Payout Method" / "Payout Method Required" alert appears with an **[Add Method]** action routing to Payout Settings; no payout is created.

---

### SUB-TC-H05 · Withdraw Now from Payout Settings hero

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller (balance > 0)

**Objective:** Verify the Withdraw Now hero path.

**Steps:**
1. On **Payout Settings**, tap **[Withdraw Now]** on the balance hero.

**Expected Result:**
- With a balance and a verified method, the withdrawal flow proceeds and shows a "Withdrawal Requested" confirmation (amount + net + status).
- With no balance: "No Balance" alert. With no method: "Please add a verified payout method first."

### SUB-TC-H06 · Admin minimum withdrawal amount blocks smaller payouts

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

### SUB-TC-H07 · Minimum withdrawal disabled when config = 0

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

### SUB-TC-I01 · SP Wallet hero balance + lifetime stats

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

### SUB-TC-I02 · Quick actions (Shop / Sell / History)

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the three quick-action buttons navigate correctly.

**Steps:**
1. On the wallet, tap **Shop**, then back; tap **Sell**, then back; tap **History**.

**Expected Result:**
- Shop → Discover; Sell → item creation; History → SP Transaction History.

---

### SUB-TC-I03 · How to Earn SP section + Learn More

**Ref:** FLOW-11 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the earn section and learn link.

**Steps:**
1. On the wallet, review "How to Earn SP" and tap "How Trading Works" / Learn More.

**Expected Result:**
- Rows: "Sell an item" (→ item create) and "Refer a friend" (→ referrals / Learn More).
- "How Trading Works" routes to the Help/education screen.

---

### SUB-TC-I04 · SP expiration info + expiring-soon alert

**Ref:** FLOW-11 · SpWalletScreen
**Actors:** test-buyer (batch expiring ≤30 days)

**Objective:** Verify expiration messaging.

**Steps:**
1. On the wallet, review the expiration info box and the expiring-soon alert.

**Expected Result:**
- Info box: "Swap Points Expire" — "Points expire after {N} days of inactivity. Use them or lose them!" (N from config).
- An "⚠️ {N} SP will expire in 30 days" alert appears when batches are expiring within 30 days.

---

### SUB-TC-I05 · Wallet warning banner by state (active/grace/expired)

**Ref:** FLOW-10 · WalletWarningBanner
**Actors:** test-buyer (active), test-grace (grace), an expired user

**Objective:** Verify the wallet state banner changes by subscription/wallet state.

**Steps:**
1. Open the wallet as active, grace, and expired users.

**Expected Result:**
- Active: green / no warning. Grace period: red banner indicating SP frozen. Expired: red banner indicating SP deleted/unavailable.

---

### SUB-TC-I06 · Free user SP wallet inactive state

**Ref:** FLOW-10 / FLOW-11
**Actors:** test-free

**Objective:** Verify a free (non-subscriber) user's wallet is inactive.

**Steps:**
1. As **test-free**, open the wallet.

**Expected Result:**
- The wallet shows an inactive state (cannot earn/spend SP) with messaging directing to subscribe; balance actions are gated.

### SUB-TC-I07 · SP Wallet — "Reserved in trades" card

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the reserved-SP card appears only when SP is reserved in pending offers.

**Steps:**
1. As a subscriber with an active SP-backed offer (`reserved_sp > 0`), open **SP Wallet**.

**Expected Result:**
- Card **Reserved in trades** shows `{reserved_sp} SP` and `SP used in pending offers — returned if trade is cancelled.`
- The card is absent when `reserved_sp = 0`.

### SUB-TC-I08 · SP Wallet — "Wallet Not Found" error

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the wallet-not-found error state.

**Steps:**
1. Open **SP Wallet** under a condition where the wallet cannot be loaded.

**Expected Result:**
- Shows `💳` **Wallet Not Found** with `Unable to load your SP wallet.`
- **Flag:** this requires `getWallet` to return null (e.g., an RLS/read failure) — `getWallet` auto-inserts a missing wallet row, so this state is rare.

### SUB-TC-I09 · SP Wallet — pending-release summary note

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the pending-release summary when SP releases are scheduled.

**Steps:**
1. As a subscriber with pending SP releases, open **SP Wallet**.

**Expected Result:**
- Note `{totalPending} SP Pending Release` with `Your pending SPs will be released individually, {releaseDays} days after each trade you complete.`

---

## Group J — SP Transaction History

### SUB-TC-J01 · SP History tabs (All / Earned / Spent)

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** test-buyer

**Objective:** Verify the three filter tabs.

**Steps:**
1. From the wallet tap **History**; switch between **All**, **Earned**, and **Spent**.

**Expected Result:**
- Header "SP History".
- All shows every entry; Earned shows only positive amounts; Spent shows only negative amounts. The active tab is bold with a green underline.

---

### SUB-TC-J02 · Transaction rows — type icon, label, signed amount

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** test-buyer

**Objective:** Verify each ledger row's icon, label, and color.

**Steps:**
1. Review individual rows across types (sale, purchase, redeem, referral, pending).

**Expected Result:**
- Each row shows a type-specific icon, a human-readable label (type capitalized, underscores → spaces), date/time, and a signed amount: green "+{n} SP" for earned, red "-{n} SP" for spent.

---

### SUB-TC-J03 · Empty state per tab

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** A user with no spent entries

**Objective:** Verify the per-tab empty state.

**Steps:**
1. On a tab with no matching entries (e.g., Spent for a user who never spent), review the empty state.

**Expected Result:**
- A grey Coins icon with "No transactions yet".

---

### SUB-TC-J04 · Pull-to-refresh updates ledger

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** test-buyer

**Objective:** Verify refresh reloads recent ledger entries.

**Steps:**
1. Trigger an SP-earning event (e.g., complete a sale) then pull-to-refresh the SP History.

**Expected Result:**
- The newest entry appears at the top after refresh.

---

## Group K — Transaction / Billing History (Profile)

### SUB-TC-K01 · Transaction History list + status badges

**Ref:** FLOW-12 · TransactionHistoryScreen (profile)
**Actors:** test-buyer

**Objective:** Verify the profile-level billing/transaction history.

**Steps:**
1. From My Subscription → Billing History (or profile menu), open **Transaction History**.

**Expected Result:**
- Header "Transaction History"; each item shows a description, formatted amount, date, and a status badge (Succeeded green / Failed red).
- Pull-to-refresh reloads.

---

### SUB-TC-K02 · Transaction History empty + error/retry

**Ref:** FLOW-12 · TransactionHistoryScreen
**Actors:** test-free / forced error

**Objective:** Verify empty and error states.

**Steps:**
1. Open Transaction History with no records, then simulate a load failure.

**Expected Result:**
- Empty: a receipt icon + "No billing history yet."
- Error: a receipt icon + error text + **[Retry]** that reloads.

## Group L — Webhooks & Reconciliation

### SUB-TC-L01 · Renewal webhook updates billing history and member state

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

### SUB-TC-L02 · Payment-failed webhook moves subscription into retry / grace state

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

### SUB-TC-L03 · Invalid webhook signature is rejected with no duplicate state change

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

### SUB-TC-L04 · Duplicate webhook delivery is idempotent

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

### SUB-TC-L05 · Payout-status webhook updates seller payout history

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

## Group M — Payment Methods (Card on File)

### SUB-TC-M01 · Payment Methods — loading state

**Ref:** FLOW-12A · PaymentMethodsScreen
**Actors:** test-buyer

**Objective:** Verify the loading state while the saved card is fetched.

**Steps:**
1. Open **Settings → Manage Payment Methods** (route `PaymentMethods`).
2. Observe the screen immediately on mount.

**Expected Result:**
- A spinner with the text `Loading payment methods...` shows while `get-payment-method` resolves.
- The header reads "Payment Methods".

**Locator hints:**
- Screen: `src/screens/profile/PaymentMethodsScreen.tsx` (instrumented 2026-08-15).
- Loading spinner → `pm-loading-spinner`; assert `Loading payment methods...` by text.

### SUB-TC-M02 · Empty state + Add Payment Method (Stripe sheet)

**Ref:** FLOW-12A · PaymentMethodsScreen · `create-payment-setup-intent` + `attach-payment-method`
**Actors:** test-free

**Objective:** Verify the no-card empty state and the Stripe Payment Sheet add flow.

**Steps:**
1. As **test-free** (no saved card), open Payment Methods.
2. Observe the empty state.
3. Tap **Add Payment Method**.
4. In the Stripe Payment Sheet, complete a test card.

**Expected Result:**
- Empty state shows **No Payment Method** with `Add a credit or debit card to submit offers on items. Your payment information is securely stored with Stripe.`
- The button shows `Adding...` while the sheet opens; the Stripe Payment Sheet is a SetupIntent flow (no immediate charge).
- On success, a success alert appears (one of `Payment Method Added` / `Payment Method Saved` / `Success`) and the Saved Card view replaces the empty state.
- The `create-payment-setup-intent` and `attach-payment-method` edge functions are invoked.

**Locator hints:**
- Empty state → `pm-empty-state` · Add Payment Method → `pm-add-button`.
- Stripe Payment Sheet is native — not instrumentable; assert the sheet visually.
- Success alerts are native `Alert.alert` — assert by title (Payment Method Added / Saved / Success).

### SUB-TC-M03 · Saved-card display + security banner

**Ref:** FLOW-12A · PaymentMethodsScreen
**Actors:** test-buyer

**Objective:** Verify the saved card renders brand/last4/expiry and the security banner.

**Steps:**
1. As **test-buyer** (with a saved card), open Payment Methods.

**Expected Result:**
- The card shows **Saved Card**, the capitalized brand, the mask `•••• •••• •••• {last4}`, and **Expiry Date** `MM/YYYY`.
- Buttons **Update Payment Method** and **Remove This Card** are present.
- Security banner shows **Secure Payments** with `Your payment information is encrypted and processed securely through Stripe. We never store your full card details on our servers.`
- A **Go Back** link appears at the bottom.

**Locator hints:**
- Saved card container → `pm-saved-card` · Update Payment Method → `pm-update-button` · Remove This Card → `pm-remove-button` · security banner → `pm-security-banner` · Go Back → `pm-back-button`.

### SUB-TC-M04 · Update Payment Method

**Ref:** FLOW-12A · PaymentMethodsScreen · `attach-payment-method`
**Actors:** test-buyer

**Objective:** Verify updating the saved card reuses the Stripe sheet and refreshes the card.

**Steps:**
1. Tap **Update Payment Method**.
2. Enter a new test card in the Stripe Payment Sheet.

**Expected Result:**
- The button shows `Updating...` while busy.
- After success, the card view refreshes with the new brand/last4 and a success alert appears.

**Locator hints:**
- Update Payment Method → `pm-update-button` · saved card → `pm-saved-card`.
- Stripe sheet + success alerts not instrumentable — assert by text.

### SUB-TC-M05 · Remove This Card (confirm + success)

**Ref:** FLOW-12A · PaymentMethodsScreen · `detach-payment-method`
**Actors:** test-buyer

**Objective:** Verify card removal requires confirmation and invokes detach.

**Steps:**
1. Tap **Remove This Card**.
2. In the confirm alert, tap **Cancel** (first pass).
3. Repeat and tap **Remove**.

**Expected Result:**
- Alert **Remove Payment Method** shows `Are you sure you want to remove this payment method? You will need to add a new one before submitting any paid offers.` with **Cancel** / **Remove**.
- **Cancel** leaves the card intact.
- **Remove** shows **Removed** / `Your payment method has been removed.` and the empty state returns.
- The `detach-payment-method` edge function is invoked.

**Locator hints:**
- Remove This Card → `pm-remove-button`.
- Confirm alert is native `Alert.alert` (Cancel/Remove) — not instrumentable; handle by text.
- After remove, empty state → `pm-empty-state`.

### SUB-TC-M06 · Go Back

**Ref:** FLOW-12A · PaymentMethodsScreen
**Actors:** test-buyer

**Objective:** Verify the Go Back link returns to the previous screen.

**Steps:**
1. Tap **Go Back**.

**Expected Result:**
- The app returns to the prior screen (Settings).

**Locator hints:**
- Go Back → `pm-back-button`.

### SUB-TC-M07 · Backend contract — attach / detach / retryFailedPayment branches

**Ref:** FLOW-12A · `attach-payment-method` · `detach-payment-method` · `retry-failed-payment`
**Actors:** test-free, test-buyer

**Objective:** Document and verify the three backend paths and the retry-result alert variants.

**Steps:**
1. Add a card and observe the attach + retry sequence.
2. Remove the card and observe detach.
3. Add a card when the account has no failed payment (normal) and again when a failed payment exists.

**Expected Result:**
- Add → `create-payment-setup-intent` (Stripe), then `attach-payment-method`.
- After attach, `retryFailedPayment` runs; a true success shows **Payment Method Added**; `NO_FAILED_PAYMENT` / `NO_OPEN_INVOICE` / `NOT_FOUND` show **Payment Method Saved**; other non-success falls through to **Success** (`Payment method added successfully.`).
- Remove → `detach-payment-method`; an unauthenticated remove shows `You must be logged in to manage payment methods.`

**Locator hints:**
- Add → `pm-add-button` (or `pm-update-button` with a saved card) · Remove → `pm-remove-button`.
- Alerts are native `Alert.alert` — assert by title (Payment Method Added / Saved / Success / Removed).

---

## Group N — Kids Club Join & Continue

### SUB-TC-N01 · JoinKidsClub value-prop + web CTA

**Ref:** FLOW-12 · JoinKidsClubScreen · JoinKidsClubButton
**Actors:** test-free

**Objective:** Verify the static value-prop, web-managed card, footnote, and CTA.

**Steps:**
1. From the free-user SP strip, Plans, or an upsell, navigate to **JoinKidsClub**.

**Expected Result:**
- Header "Kids Club+"; headline **Get more out of every trade**; subheadline `Kids Club+ is a membership that rewards the way you buy and sell on Pass It Up.`
- Three benefit rows: **Earn Swap Points on every sale** · **Pay a flat $1.49 fee instead of a percentage** · **Spend SP on purchases (up to 50%)**.
- Web card **Membership is managed on the web** with `Complete your Kids Club+ membership on our website. It takes about a minute, and you can pay with a card, Apple Pay, or Google Pay.` and `Your benefits unlock automatically in the app right after you subscribe.`
- CTA **Join on the web** with hint `Manage your membership at passitup.com`.
- Footnote `No charge in the app. You'll be taken to passitup.com to complete your membership securely.`
- No price cards and no in-app purchase UI.

### SUB-TC-N02 · JoinKidsClub web redirect (passitup.com)

**Ref:** FLOW-12 · `subscriptionWeb.openJoinKidsClubWeb`
**Actors:** test-free

**Objective:** Verify the CTA opens the external membership page with the user's email.

**Steps:**
1. Tap **Join on the web**.
2. Observe the external browser.

**Expected Result:**
- The external browser opens `https://passitup.com/join?email=<user email>`.
- No charge occurs in-app; after returning, the CTA is re-enabled.

### SUB-TC-N03 · Route-alias reachability (JoinKidsClub vs deep-link-only aliases)

**Ref:** FLOW-12 · AppNavigator route registration
**Actors:** test-free

**Objective:** Document which Kids Club routes are reachable by navigation and flag the orphan aliases.

**Steps:**
1. Navigate to **JoinKidsClub** from the app (SP strip / Plans / upsell).
2. Confirm the other three route names are not reachable by in-app navigation.

**Expected Result:**
- Only `JoinKidsClub` opens `JoinKidsClubScreen` via navigation.
- `SubscriptionChoice`, `KidsClubOverview`, and `SubscriptionPlans` all render `JoinKidsClubScreen` but have no `navigate()` call sites — deep-link only.
- **Flag:** orphan files `SubscriptionChoiceScreen.tsx`, `KidsClubOverviewScreen.tsx`, `SubscriptionPlansScreen.tsx` exist but are unregistered; the existing Group A cases target those names.

### SUB-TC-N04 · ContinueKidsClub active-subscription variant

**Ref:** FLOW-12 · ContinueKidsClubScreen
**Actors:** test-buyer

**Objective:** Verify the active-subscription early-return view.

**Steps:**
1. Open **ContinueKidsClub** while the account already has an active subscription.

**Expected Result:**
- Shows `✅ Kids Club+ Active` with `Your subscription is already active and your premium benefits are available.` and a **Go Back** button.
- **Flag:** the `Already Subscribed` alert is unreachable (the active state early-returns before the CTA renders); the `ContinueKidsClub` route is itself effectively deep-link-only (its `navigate()` call sites live in the unregistered `SubscriptionChoiceScreen.tsx`).

### SUB-TC-N05 · ContinueKidsClub loading state

**Ref:** FLOW-12 · ContinueKidsClubScreen
**Actors:** test-free

**Objective:** Verify the loading state while trial status loads.

**Steps:**
1. Open **ContinueKidsClub**.

**Expected Result:**
- A `Loading...` spinner shows while `getTrialStatus` resolves, then the content renders.

### SUB-TC-N06 · ContinueKidsClub trial-ending urgency badge

**Ref:** FLOW-12 · ContinueKidsClubScreen
**Actors:** test-trial

**Objective:** Verify the urgency badge copy when 7 or fewer trial days remain.

**Steps:**
1. As a trial user with 7 or fewer days remaining, open **ContinueKidsClub**.

**Expected Result:**
- The badge reads `{N} day left in trial` (1 day) or `{N} days left in trial` (2–7 days).
- With more than 7 days, the badge reads `{trialDays} free days • no charge today`.

---

## Regression

### SUB-TC-R01 · Subscriber fee applied in trade checkout
**Objective:** Confirm an active subscriber is charged the subscriber transaction fee in a real trade checkout.
**Steps:** 1. As a subscriber, start a trade checkout and view the fee line.
**Expected Result:** The subscriber fee (config value) is shown, not the non-subscriber fee.

### SUB-TC-R02 · SP balance consistent across wallet, trade, and history
**Objective:** Confirm the SP available balance matches across the wallet hero, an SP offer slider max, and the ledger sum.
**Steps:** 1. Compare the wallet balance, the max SP usable on an Accept SP listing, and the running ledger.
**Expected Result:** All three reconcile.

### SUB-TC-R03 · Payout available balance matches earnings
**Objective:** Confirm the Payout Dashboard available balance equals the Seller Earnings available figure.
**Steps:** 1. Compare Payout Dashboard hero vs My Earnings totals.
**Expected Result:** Available balances reconcile (Lifetime − Pending − Withdrawn).

### SUB-TC-R04 · Cancel then reactivate restores SP access
**Objective:** Confirm cancel-before-period-end keeps SP usable and reactivation restores active status.
**Steps:** 1. Cancel, confirm SP still usable, reactivate.
**Expected Result:** SP remains usable through the period; reactivation returns Active.

### SUB-TC-R05 · Config change reflects without app rebuild
**Objective:** Confirm changing `subscription_price`, `trial_days`, `transaction_fee_subscriber_cents`, `transaction_fee_non_subscriber_cents`, `grace_period_days`, and `sp_expiration_days` in admin reflects in the app on next load.
**Steps:** 1. Change one or more of those config values to distinct numbers. 2. Reload Plans, Compare Plans, Manage Kids Club+, Subscription Payment, and SP Wallet.
**Expected Result:** The new monthly price, trial length, fee comparison, grace countdown, and SP expiration messaging all render without requiring reinstall or rebuild.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Plans screen — Free vs Kids Club+ (FLOW-12) | SUB-TC-A01 |
| Plan comparison table + POPULAR badge | SUB-TC-A02 |
| Dynamic pricing/fees from admin config | SUB-TC-A03, SUB-TC-R05 |
| Current plan marked / disabled | SUB-TC-A04 |
| Kids Club+ Overview by status | SUB-TC-A05 |
| Start trial → payment screen | SUB-TC-B01 |
| Payment benefits + Due today $0.00 (trial) | SUB-TC-B02 |
| Stripe payment → Success screen (FLOW-12A) | SUB-TC-B03 |
| Trial already used blocked | SUB-TC-B04 |
| Trial disabled globally | SUB-TC-B05 |
| Trial limit config updates eligibility | SUB-TC-B04, SUB-TC-B08 |
| Continue Kids Club+ urgency + benefits | SUB-TC-B06 |
| Referred user bonus-loss warning | SUB-TC-B07 |
| My Subscription paid view | SUB-TC-C01 |
| My Subscription quick menu routes | SUB-TC-C02 |
| Manage Kids Club+ status + billing | SUB-TC-C03 |
| Cancel retention "Keep My Benefits" | SUB-TC-C04 |
| Cancel reason modal + final confirm | SUB-TC-C05 |
| Cancelled active until period end | SUB-TC-C06, SUB-TC-R04 |
| Auto-renew toggle / update payment | SUB-TC-C07 |
| Grace period banner + SP freeze warning (FLOW-10/12) | SUB-TC-D01 |
| Re-subscribe from grace unlocks SP | SUB-TC-D02 |
| Subscription Expired screen | SUB-TC-D03 |
| Renewal payment full charge | SUB-TC-D04 |
| Reactivate from cancelled | SUB-TC-D05 |
| Subscription event notifications (FLOW-17) | SUB-TC-D06 |
| Grace reminder thresholds from admin config | SUB-TC-D07 |
| Billing history list + badges | SUB-TC-E01 |
| Billing history empty | SUB-TC-E02 |
| Failed charge error message | SUB-TC-E03 |
| Subscription Status diagnostics | SUB-TC-E04 |
| Payout dashboard hero balance/AUD (FLOW-22) | SUB-TC-F01 |
| Payout method section add/existing | SUB-TC-F02 |
| Payout history list | SUB-TC-F03 |
| Seller Earnings totals + breakdown | SUB-TC-F04, SUB-TC-R03 |
| Seller Earnings empty | SUB-TC-F05 |
| Pending earnings release delay from admin config | SUB-TC-F06 |
| Add Stripe Connect method (FLOW-23) | SUB-TC-G01 |
| Add PayPal / Venmo method | SUB-TC-G02 |
| Add Bank ACH method | SUB-TC-G03 |
| Set primary / delete method | SUB-TC-G04 |
| Unverified method blocks payout | SUB-TC-G05 |
| requires_action → setup CTA | SUB-TC-G06 |
| Request payout amount validation | SUB-TC-H01 |
| Fee + net summary by method | SUB-TC-H02 |
| Confirm payout success | SUB-TC-H03 |
| Request blocked no/unverified method | SUB-TC-H04 |
| Withdraw Now hero path | SUB-TC-H05 |
| Minimum withdrawal config | SUB-TC-H06, SUB-TC-H07 |
| SP wallet hero + lifetime stats (FLOW-10) | SUB-TC-I01, SUB-TC-R02 |
| SP wallet quick actions | SUB-TC-I02 |
| How to Earn SP + Learn More (FLOW-11) | SUB-TC-I03 |
| SP expiration info + expiring-soon alert | SUB-TC-I04 |
| Wallet warning banner by state | SUB-TC-I05 |
| Free user SP wallet inactive | SUB-TC-I06 |
| SP history tabs All/Earned/Spent | SUB-TC-J01 |
| SP history rows icon/label/amount | SUB-TC-J02 |
| SP history empty per tab | SUB-TC-J03 |
| SP history pull-to-refresh | SUB-TC-J04 |
| Transaction history list + badges | SUB-TC-K01 |
| Transaction history empty + error/retry | SUB-TC-K02 |
| Subscriber fee in trade checkout | SUB-TC-R01 |
