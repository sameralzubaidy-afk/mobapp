# MODULE-12-22-10 Subscriptions · Payouts · SP Wallet — Manual Testing Guide

**Source of truth:** `docs/flow-registry.md` (FLOW-10 SP Wallet Read · FLOW-11 SP Earn/Spend/Cap · FLOW-12 Subscriptions · FLOW-12A Subscription Payment (Stripe) · FLOW-17 Subscription Event Notifications · FLOW-22 Seller Payouts · FLOW-23 Payout Method Verification · FLOW-25 Manual Payout Admin · FLOW-26 Webhook Processing & Verification · FLOW-30 SP Wallet Admin Ops)
**Tasks covered:** Subscription Lifecycle (plans, comparison, trial, payment, manage, cancel, renew, grace, expiry, billing history) · Seller Payouts & Withdrawals (dashboard, methods, verification, request, earnings) · SP Wallet & Transaction History (balance, earn, expiry, ledger, billing) · Provider webhook reconciliation for subscription and payout state changes
**Last updated:** 2026-09-05 (DEV-TASK-117 — added per-case `**Surfaces:**` field mirroring the ADM guide so SUB rounds no longer re-derive mobile/admin scope; I05 doc-synced to the live wallet-state banner mapping; I06 rewritten to the live free-user 0-SP wallet + Join Kids Club+ upsell card (item-7 product change); ADM M03 grace behavior cross-referenced). Prior: 2026-09-03 guide-currency audit v4 — DEV-TASK-94 doc-sync: E01/E02/E03 `BillingHistoryScreen`→live `TransactionHistoryScreen` + live E02 empty copy; A05 `KidsClubOverview`→`JoinKidsClubScreen` alias with per-status coverage on `ManageKidsClubScreen`; Groups F/G/H already live on `PayoutSettingsScreen` since v3; v3 = 2026-09-02 webhook Group L refreshed to QA Task 21's live full-lifecycle verification — L01 renewal + L04 idempotency now **LIVE PASS**, L02/L03 remain PARTIAL with exact fixture needs; v2 retired the removed in-app subscription-purchase Group B and renewal D02/D04 to the web-first Web Subscription Purchase E2E; rewrote Groups F/G05/H to the live PayoutSettingsScreen; re-homed D06/D07 + flagged E04 fixture-gated)
**Scope:** End-user manual testing via app screens + admin portal screens (no SQL / no DB access required)
**Devices:** iOS Simulator + Android Emulator · Admin portal in browser

**Surfaces legend (DEV-TASK-117):** every runnable case body carries a `**Surfaces:**` field after `**Actors:**` (mirroring the ADM guide): `mobile` = app only; `admin, mobile` = needs an admin-portal config/action and a mobile verification leg; `n/a (…retired / …unconfigured / …server-webhook)` = non-runnable stub (retired Group B + D02/D04, unconfigured G02/G03, server-side L03) — those are never executed so they carry no runnable surface.

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Plans & Comparison** | SUB-TC-A01 | Subscription Plans screen — Free vs Kids Club+ cards |
| | SUB-TC-A02 | Plan Comparison table — feature-by-feature + POPULAR badge |
| | SUB-TC-A03 | Dynamic pricing & fees pulled from admin config |
| | SUB-TC-A04 | Current plan reflected (button disabled / "Current Plan") |
| | SUB-TC-A05 | Kids Club+ Overview screen by subscription status |
| **B — Start Trial & Payment 🔴 (retired — web-first)** | SUB-TC-B01 | 🔴 RETIRED — in-app payment removed; web-first → SUB-TC-N01/N02 + Web Subscription Purchase E2E (QA Task 20) |
| | SUB-TC-B02 | 🔴 RETIRED — in-app payment screen removed; coverage → Web Subscription Purchase E2E (QA Task 20) |
| | SUB-TC-B03 | 🔴 RETIRED — in-app Success screen removed; coverage → Web Subscription Purchase E2E (QA Task 20) |
| | SUB-TC-B04 | 🔴 RETIRED — in-app trial-gating removed; server-side trial config → QA Task 20 finding F-3 |
| | SUB-TC-B05 | 🔴 RETIRED — in-app trial-disabled alert removed; coverage → QA Task 20 finding F-3 |
| | SUB-TC-B06 | 🔴 RETIRED — ContinueKidsClub is deep-link-only; see SUB-TC-N03–N06 |
| | SUB-TC-B07 | 🔴 RETIRED — referral bonus-loss warning on removed Subscription Choice; see SUB-TC-N03 |
| | SUB-TC-B08 | 🔴 RETIRED — in-app trial-limit CTA removed; config reflection → SUB-TC-R05 |
| | SUB-TC-B09 | 🔴 RETIRED — in-app Stripe sheet removed; checkout UX → QA Task 20 scope 2 |
| | SUB-TC-B10 | 🔴 RETIRED — in-app decline handling removed; checkout decline → QA Task 20 scope 2 |
| | SUB-TC-B11 | 🔴 RETIRED — in-app saved-card resub removed; cards on file → Group M |
| | SUB-TC-B12 | 🔴 RETIRED — in-app payment network-error path removed; → QA Task 20 scope 2 |
| | SUB-TC-B13 | 🔴 RETIRED — in-app Apple/Google Pay removed; web wallet-pay → QA Task 20 scope 2 |
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
| | SUB-TC-D02 | 🔴 RETIRED — in-app re-subscribe payment removed; web-first → SUB-TC-N01/N02 + Web E2E |
| | SUB-TC-D03 | Subscription Expired screen — benefits lost + Renew |
| | SUB-TC-D04 | 🔴 RETIRED — in-app renewal payment removed; web-first → SUB-TC-N01/N02 + Web E2E |
| | SUB-TC-D05 | Reactivate from cancelled state |
| | SUB-TC-D06 | 📦 moved to Fixture-Gated Backlog (clock/push fixture) |
| | SUB-TC-D07 | 📦 moved to Fixture-Gated Backlog (clock/push fixture) |
| **E — Billing History & Status** | SUB-TC-E01 | Billing History list — records, status badges, amounts |
| | SUB-TC-E02 | Billing History empty state |
| | SUB-TC-E03 | Failed charge shows error message |
| | SUB-TC-E04 | ⏸ FIXTURE-GATED (push-payload) — Subscription Status screen diagnostics |
| **F — Payout Settings (live surface) 🔄** | SUB-TC-F01 | Payout Settings hero — Available / Pending / Lifetime Earned (live) |
| | SUB-TC-F02 | Payout method section (add vs existing) — live |
| | SUB-TC-F03 | Payout history list (completed / pending) — live |
| | SUB-TC-F04 | Earnings figures (Available/Pending/Lifetime) + history net/fee — live |
| | SUB-TC-F05 | Payout history empty state — live |
| | SUB-TC-F06 | Pending earnings figure follows admin release timing — live |
| | SUB-TC-F07 | Payout load error + recovery — live |
| | SUB-TC-F08 | Payout history Load More pagination (+5) — live |
| **G — Payout Methods & Verification** | SUB-TC-G01 | Add Stripe Connect payout method (onboarding) |
| | SUB-TC-G02 | 🚫 N/A — PayPal/Venmo unconfigured provider (UI lists, not drivable) |
| | SUB-TC-G03 | 🚫 N/A — Bank ACH unconfigured / no UI option |
| | SUB-TC-G04 | Set primary method / delete method (confirmation) |
| | SUB-TC-G05 | Unverified method blocks payout (live: cannot set primary / withdraw) |
| | SUB-TC-G06 | requires_action payout → "Set Up Payout Method" |
| | SUB-TC-G07 | Payout Settings — "Edit Details" sheet |
| | SUB-TC-G08 | "Cannot Delete Primary/Only Method" guard |
| | SUB-TC-G09 | "Cannot Set as Primary" (unverified) guard |
| | SUB-TC-G10 | Payout history Load More |
| | SUB-TC-G11 | NoMethodModal flow |
| **H — Request & Withdraw 🔄 (live)** | SUB-TC-H01 | Withdraw Now — no-balance guard (amount entry removed) |
| | SUB-TC-H02 | WithdrawModal summary — Available / Payout Fee / You'll Receive |
| | SUB-TC-H03 | Confirm Withdrawal success |
| | SUB-TC-H04 | Withdraw blocked when no verified primary method |
| | SUB-TC-H05 | Withdraw Now from Payout Settings hero (verified template) |
| | SUB-TC-H06 | Admin minimum withdrawal blocks full-balance requests below the floor |
| | SUB-TC-H07 | Minimum withdrawal disabled when config = 0 |
| **I — SP Wallet Balance & Earn** | SUB-TC-I01 | SP Wallet hero balance + lifetime stats |
| | SUB-TC-I02 | Quick actions (Shop / Sell / History) |
| | SUB-TC-I03 | How to Earn SP section + Learn More |
| | SUB-TC-I04 | SP expiration info + expiring-soon alert |
| | SUB-TC-I05 | Wallet warning banner by wallet state (active/grace/expired/frozen) |
| | SUB-TC-I06 | Free user SP wallet — 0-SP wallet + Join Kids Club+ upsell card |
| | SUB-TC-I07 | SP Wallet — "Reserved in trades" card |
| | SUB-TC-I08 | SP Wallet — "Wallet Not Found" error |
| | SUB-TC-I09 | SP Wallet — pending-release summary note |
| **J — SP Transaction History** | SUB-TC-J01 | SP History tabs (All / Earned / Spent) |
| | SUB-TC-J02 | Transaction rows — type icon, label, signed amount |
| | SUB-TC-J03 | Empty state per tab |
| | SUB-TC-J04 | Pull-to-refresh updates ledger |
| **K — Transaction / Billing History (Profile)** | SUB-TC-K01 | Transaction History list + status badges |
| | SUB-TC-K02 | Transaction History empty + error/retry |
| **L — Webhooks & Reconciliation 🔄** | SUB-TC-L01 | Renewal webhook → billing + member state — **LIVE PASS** (QA Task 21: real test-clock renewal advanced `current_period_end` + wrote `billing_history` row) |
| | SUB-TC-L02 | Payment-failed webhook → retry/grace — **PARTIAL** (mechanism live-subscribed; no live failing-renewal fixture driven) |
| | SUB-TC-L03 | Invalid webhook signature rejected — **PARTIAL** (source+deployed parity; negative-signature POST not driven) |
| | SUB-TC-L04 | Duplicate webhook delivery idempotent — **LIVE PASS** (QA Task 21: 4 webhook events → ONE `subscriptions` + ONE `subscription_events` row) |
| | SUB-TC-L05 | Payout-status webhook updates seller payout history (payout domain) |
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
| Expired | test-expired@kidsmarketplace.test | Expired (`status='expired'`, past dates) | **Standing fixture (2026-09-03, Dev Task R41)** — genuine expired membership + frozen wallet for SUB-TC-C09/D03; login lands on SubscriptionExpired. Password `TestExpired123!`; one-call login `qa-login-as?persona=test-expired` |
| Seller | test-seller@kidsmarketplace.test | Kids Club+ Active | Has payout balance + methods |
| Admin | test-admin@kidsmarketplace.test | — | Required for admin-side payout/SP cases |

> Timer-based cases (trial reminders, renewal, grace expiry, payout processing) require QA to fast-forward the relevant clock or trigger the scheduled job in the test environment. The steps below describe what the end user sees once that time is reached.

---

## Group A — Plans & Comparison

### SUB-TC-A01 · Subscription Plans screen — Free vs Kids Club+ cards

**Ref:** FLOW-12 · SubscriptionPlansScreen
**Actors:** test-free
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** admin, mobile

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
**Surfaces:** mobile

**Objective:** Verify a current subscriber sees their active tier marked, with the upgrade CTA disabled.

**Steps:**
1. Log in as **test-buyer** and open **Plans** and **Upgrade Plan**.

**Expected Result:**
- The Kids Club+ card shows a "Current Plan" chip/badge and its CTA is disabled (no re-purchase path).
- The Free card's downgrade action is disabled.

---

### SUB-TC-A05 · Kids Club+ overview by subscription status (aliased to JoinKidsClub; per-status on Manage)

**Ref:** FLOW-12 · `JoinKidsClubScreen` (alias) + `ManageKidsClubScreen` (per-status) — DEV-TASK-94 doc-sync: `KidsClubOverviewScreen` is **dead/aliased** — the `KidsClubOverview` and `SubscriptionPlans` routes both render `JoinKidsClubScreen` (no distinct Overview/Plans screen; AppNavigator L771/L775; see the N-group aliasing note). Per-status CTA coverage lives on **Manage Kids Club+** (`ManageKidsClubScreen`), verified live in QA Task 22 §0.3 (active / grace / cancelled / free all PASS).
**Actors:** test-free, test-buyer, test-grace
**Surfaces:** mobile

**Objective:** Verify the Kids Club+ surface shows the correct primary CTA per subscription status.

**Steps:**
1. Open **Kids Club+** (JoinKidsClubScreen) as **test-free**, then **Manage Kids Club+** (`ManageKidsClubScreen`) as **test-buyer** (active) and **test-grace**.
2. (free) Confirm the join surface's value-prop + CTA; (active / grace) confirm the Manage surface per-status states.

**Expected Result:**
- **Free:** Join surface shows the Kids Club+ value-prop, the "Membership is managed on the web" card, and CTA **[Join Kids Club+]** (canonical non-trial label — the retired "Start 30-Day Free Trial" CTA is gone; trial_enabled=false).
- **Active/Trial:** Manage Kids Club+ shows the **Active** badge + Next Billing Date + cancel option + auto-renew toggle.
- **Grace period:** Manage Kids Club+ shows the **Grace Period** badge + SP-frozen warning + **[Re-subscribe]** (SP frozen messaging).
- Cancellation modal (if opened) is titled "We'll miss you!" with the six reason options including "Other".

---

## Group B — Start Trial & Payment — 🔴 RETIRED (web-first)

> 🔴 **Group retired 2026-09-02 — in-app subscription purchase removed; membership is web-first.** The in-app Stripe purchase flow (`SubscriptionPaymentScreen`/`SubscriptionSuccessScreen`) is gone; all join CTAs route to `JoinKidsClubScreen` → **Join on the web** (passitup.com). Each case below is a **RETIRED** stub cross-referencing where its intent now lives: the live join surface (**SUB-TC-N01/N02**) and the **Web Subscription Purchase E2E**. **The full web purchase journey is now LIVE-VERIFIED** — QA Task 21 (`e2e-test-results/qa-task21-sub-close-2026-09-02/report.md`, Section A) drove real Stripe Checkout ($5.99/mo, card 4242) → webhook → `subscriptions`/`subscription_events` rows on a disposable user (the QA Task 20 blockers — no linked `stripe_price_id`, `SUBSCRIPTION_DEV_MODE=true` — were resolved by DT-90). Live legs belong in QA Task 21's recipe (disposable user only), not in-app.

### SUB-TC-B01 · Start free trial from Plans → payment screen — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** tapping Start Trial → an in-app **Payment** screen (`SubscriptionPaymentScreen`), which no longer exists.
> **Coverage now lives in:** **SUB-TC-N01/N02** (live join surface — `JoinKidsClubScreen` → "Join on the web") and the **Web Subscription Purchase E2E** (QA Task 20: `e2e-test-results/qa-task20-web-sub-e2e-2026-09-02/report.md` — scope 1 mobile-entry PASS, scope 2 web checkout). Re-run after QA Task 20's unblock recipe (Stripe Price link + non-DEV web target).

---

### SUB-TC-B02 · Payment screen benefits + pricing + "Due today $0.00" (trial) — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** in-app payment-screen benefit/pricing/trial copy, which no longer exists.
> **Coverage now lives in:** **SUB-TC-N01/N02** (live value-prop/benefit rows) and the **Web Subscription Purchase E2E** (QA Task 20 — scope 2 web checkout UI shell; note trial copy now conflicts with `trial_enabled=false`, and "$1.49 flat fee" benefit copy conflicts with live $1.00 config). Re-run after QA Task 20's unblock recipe.

---

### SUB-TC-B03 · Complete Stripe payment → Success screen — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** completing an in-app Stripe sheet → an in-app Success screen, which no longer exists (`SubscriptionSuccessScreen` has no caller).
> **Coverage now lives in:** the **Web Subscription Purchase E2E** (QA Task 20 — web success page "🎉 You're all set!" + deep link `p2pkidsmarketplace://my-subscription`) and **SUB-TC-N01/N02** (live join + return-to-app). Re-run after QA Task 20's unblock recipe.

---

### SUB-TC-B04 · Trial already used — blocked with support/subscribe options — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** an in-app trial-eligibility block alert, tied to the removed Plans/Subscription Choice surfaces.
> **Coverage now lives in:** trial handling is server-side config (`admin_config.trial_enabled=false`); the **Web Subscription Purchase E2E** finding F-3 (trial terms inconsistency) documents that the checkout EF derives trial days from the tier without consulting `trial_enabled`. No live in-app trial-gating screen to test. Re-run after QA Task 20's unblock recipe.

---

### SUB-TC-B05 · Trial disabled globally — Free tier only — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** an in-app "trial disabled" alert on the removed Subscription Choice / Continue Kids Club+ surfaces.
> **Coverage now lives in:** `trial_enabled` is server-side config; the **Web Subscription Purchase E2E** finding F-3 documents that the checkout EF does not honor `trial_enabled`. No live in-app path to test. Re-run after QA Task 20's unblock recipe.

---

### SUB-TC-B06 · Continue Kids Club+ (mid-trial) urgency + benefits — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** the ContinueKidsClubScreen mid-trial urgency view. `ContinueKidsClubScreen` still exists but is **deep-link-only** (its `navigate()` callers live in the unregistered `SubscriptionChoiceScreen`); see **SUB-TC-N03/N04/N05/N06** for route-alias reachability notes.
> **Coverage now lives in:** **SUB-TC-N01/N02** (live join surface) + the **Web Subscription Purchase E2E** (QA Task 20).

---

### SUB-TC-B07 · Referred user warned about bonus loss before choosing Free — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** a referred-user bonus-loss warning on the removed Subscription Choice surface (which is unregistered; see **SUB-TC-N03**).
> **Coverage now lives in:** the **Web Subscription Purchase E2E** (QA Task 20) — the referral→Free downgrade path is not part of the web-first join journey; no live in-app Subscription Choice to test.

### SUB-TC-B08 · Admin changes trial-limit config and the trial CTA updates — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** an in-app trial CTA reacting to an admin trial-limit config — tied to the removed Plans/Subscription Choice surfaces.
> **Coverage now lives in:** trial/eligibility is server-side (`admin_config.trial_enabled`); **SUB-TC-R05** still covers config-change reflection on live surfaces. Re-run after QA Task 20's unblock recipe.

---

### SUB-TC-B09 · Cancel Stripe payment sheet — no error, retry available — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** cancelling an in-app Stripe Payment Sheet on the removed SubscriptionPaymentScreen.
> **Coverage now lives in:** hosted **Stripe Checkout** (web) owns payment-sheet UX; the **Web Subscription Purchase E2E** (QA Task 20 — scope 2) covers the checkout surface when unblocked. No live in-app sheet to cancel.

---

### SUB-TC-B10 · Card declined — clear error + retry — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** declined-card handling on the removed in-app payment sheet.
> **Coverage now lives in:** **Stripe-hosted Checkout** decline UX (web) — **live-verified in QA Task 21 Section B** (`e2e-test-results/qa-task21-sub-close-2026-09-02/report.md`): real checkout with card `4000 0000 0000 0002` returned Stripe's "Your card was declined. Please try a different card." error, no `subscriptions` row created, no partial/broken state. (QA Task 20's "not-yet-reachable / blocked by no `stripe_price_id`" note is superseded — DT-90 linked the price.)

---

### SUB-TC-B11 · Re-subscribe reuses saved payment method (1-click) — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** saved-card reuse on the removed in-app re-subscribe payment screen.
> **Coverage now lives in:** saved payment methods live in **Group M / SUB-TC-C05** (card on file) and Stripe Checkout (web) handles method reuse; the **Web Subscription Purchase E2E** (QA Task 20 — scope 2) covers checkout. No live in-app re-subscribe sheet.

---

### SUB-TC-B12 · Network error during payment — retry succeeds — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** network-failure handling on the removed in-app payment screen.
> **Coverage now lives in:** the **Web Subscription Purchase E2E** (QA Task 20 — scope 2) owns checkout retry/robustness when the Stripe leg is unblocked. No live in-app payment screen.

---

### SUB-TC-B13 · Apple Pay / Google Pay payment — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** Apple/Google Pay on the removed in-app payment sheet.
> **Coverage now lives in:** the **Web Subscription Purchase E2E** (QA Task 20) — web checkout advertises "pay with a card, Apple Pay, or Google Pay"; wallet-pay leg is reachable only once the Stripe Checkout leg is unblocked. No live in-app sheet.

---

## Group C — Manage & Cancel

### SUB-TC-C01 · My Subscription screen — paid member view

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-buyer (active)
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

**Objective:** Verify the free state and its subscribe CTA.

**Steps:**
1. As **test-free**, open **Manage Kids Club+**.

**Expected Result:**
- Card shows `You don't have an active Kids Club+ subscription.` with a **Subscribe to Kids Club+** button that navigates to **JoinKidsClub**.

### SUB-TC-C09 · Manage Kids Club+ expired state

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-buyer (expired)
**Surfaces:** mobile

**Objective:** Verify the expired info box and re-subscribe CTA.

**Steps:**
1. Open **Manage Kids Club+** with an expired subscription.

**Expected Result:**
- Info box **Your subscription has expired** with `Re-subscribe to restore Kids Club+ access and unfreeze any remaining Swap Points.` and a **Re-subscribe to Kids Club+** button.
- **Note:** the cancel-reason "Other reason" free-text input is already covered by the corrected SUB-TC-C05 — not duplicated here.

### SUB-TC-C10 · My Subscription free-user state

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-free
**Surfaces:** mobile

**Objective:** Verify the free plan view and upgrade CTA.

**Steps:**
1. As **test-free**, open **My Subscription**.

**Expected Result:**
- Plan card shows **Free Plan** (no `ACTIVE member` badge); footer shows **Renew Date** only (no **Member Since** row).
- Button **Upgrade to Kids Club+** navigates to `UpgradePlan`.

### SUB-TC-C11 · My Subscription "Learn More" link

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-buyer
**Surfaces:** mobile

**Objective:** Verify the benefits "Learn More" link routes to the SP-definition help section.

**Steps:**
1. As a paid member, open **My Subscription** and tap **Learn More**.

**Expected Result:**
- Navigates to the Help screen with the `sp_definition` section.

### SUB-TC-C12 · My Subscription "Member Since" value (latent bug)

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-buyer
**Surfaces:** mobile

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
**Surfaces:** mobile

**Objective:** Verify grace-period messaging and the SP-freeze warning.

**Steps:**
1. As **test-grace**, open Manage Kids Club+ / Kids Club+ overview.

**Expected Result:**
- An urgency message ("Your subscription ended on …") with days left in grace (default 90) is shown.
- A "Your SP wallet will be frozen if you don't re-subscribe" warning is displayed alongside a **[Re-subscribe]** CTA.

---

### SUB-TC-D02 · Re-subscribe from grace period — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** re-subscribing from grace via the removed in-app payment screen.
> **Coverage now lives in:** **SUB-TC-N01/N02** (live join surface) + the **Web Subscription Purchase E2E** (QA Task 20). Grace-state messaging on the live app is covered by **SUB-TC-I05** (SP wallet grace banner). Re-run after QA Task 20's unblock recipe.

---

### SUB-TC-D03 · Subscription Expired screen — benefits lost + Renew

> ⚠️ **Needs re-verification (2026-08-12):** Index title says "benefits lost" but the screen uses "What you're missing out on:" — verify the intended description matches current copy.

**Ref:** FLOW-12 · SubscriptionExpiredScreen
**Actors:** A user whose grace period has fully expired
**Surfaces:** mobile

**Objective:** Verify the expired screen content and CTAs.

**Steps:**
1. Trigger / fast-forward to a fully expired subscription and open the **Subscription Expired** screen.

**Expected Result:**
- Header "Subscription Expired" with "Your {planName} plan ended on {expiredDate}".
- "What you're missing out on:" lists Trade with PIPs, Reduced Fees, and Keep Your Points.
- **[Renew Plan]** → payment screen with isRenewal = true; **[Continue with Free Plan]** → Discover.

---

### SUB-TC-D04 · Renew (isRenewal) — payment screen "Due today" = full price — 🔴 RETIRED (web-first)

> 🔴 **RETIRED (2026-09-02) — in-app subscription purchase removed; membership is web-first.**
> **What this case described:** renewal payment via the removed in-app payment screen.
> **Coverage now lives in:** **SUB-TC-N01/N02** (live join surface) + the **Web Subscription Purchase E2E** (QA Task 20). The expired/grace entry state is covered by **SUB-TC-D03** (Subscription Expired screen) / **SUB-TC-D05** (reactivate from cancelled) as reachable. Re-run after QA Task 20's unblock recipe.

---

### SUB-TC-D05 · Reactivate from cancelled state

**Ref:** FLOW-12 · ManageKidsClubScreen — DEV-TASK-94 doc-sync: dropped the dangling `KidsClubOverviewScreen` alias (dead; reactivation lives on **Manage Kids Club+**)
**Actors:** A cancelled (not yet expired) user
**Surfaces:** mobile

**Objective:** Verify reactivation before expiry restores active status.

**Steps:**
1. As a cancelled user (still within period), tap **[Reactivate Membership]**.

**Expected Result:**
- The subscription returns to Active without a new charge if still within the paid period; messaging confirms reactivation.

> 📦 **SUB-TC-D06 · Subscription event notifications** and **SUB-TC-D07 · Grace reminder notifications** were **moved (2026-09-02) to the Fixture-Gated Backlog** at the end of this guide (clock/push-fixture dependent — not runnable on the live app without fast-forward tooling). Their full case bodies live there; see that section.

---

## Group E — Billing History & Status

### SUB-TC-E01 · Billing History list — records, status badges, amounts

**Ref:** FLOW-12 · `TransactionHistoryScreen` (route `TransactionHistory`) — DEV-TASK-94 doc-sync: the former `BillingHistoryScreen` is **dead/aliased** (DT-93); Profile's **"Billing History"** row opens the live `TransactionHistoryScreen` (QA Task 22 E01 PASS live)
**Actors:** test-buyer
**Surfaces:** mobile

**Objective:** Verify billing records render with date, status, description, amount.

**Steps:**
1. As **test-buyer**, open **Transaction History**: Profile → **Billing History** row.

**Expected Result:**
- Each record shows the date, a status badge (Succeeded green / Pending orange / Failed red / Refunded grey), description ("Kids Club+ Subscription"), and the formatted amount.
- Pull-to-refresh reloads the list.

---

### SUB-TC-E02 · Billing History empty state

**Ref:** FLOW-12 · `TransactionHistoryScreen` (route `TransactionHistory`) — DEV-TASK-94 doc-sync: `BillingHistoryScreen` is **dead/aliased** (DT-93); live surface is `TransactionHistory` (Profile → **Billing History** row). QA Task 22 E02 PASS live.
**Actors:** test-free
**Surfaces:** mobile

**Objective:** Verify the empty state for a user who's never been charged.

**Steps:**
1. As **test-free**, open **Transaction History** (Profile → **Billing History** row).

**Expected Result:**
- Empty state shows a grey receipt icon with **"No billing history yet."** (live copy, verified QA Task 22 E02); no records listed.

---

### SUB-TC-E03 · Failed charge shows error message

**Ref:** FLOW-12 · `TransactionHistoryScreen` (route `TransactionHistory`) — DEV-TASK-94 doc-sync: `BillingHistoryScreen` is **dead/aliased** (DT-93); live surface is `TransactionHistory` (Profile → **Billing History** row).
**Actors:** A user with a failed charge record
**Surfaces:** mobile

**Objective:** Verify failed billing records surface the error.

**Steps:**
1. Open **Transaction History** (Profile → **Billing History** row) for a user that has a failed charge.

**Expected Result:**
- The failed record shows a red "Failed" badge and the error message text below the amount.

---

### SUB-TC-E04 · Subscription Status screen — Stripe IDs + period + retries — ⏸ FIXTURE-GATED (push-payload)

> ⏸ **FIXTURE-GATED (2026-09-02):** The **Subscription Status** screen (`SubscriptionStatusScreen`) is only reachable via a push-payload deep link — there is no in-app navigation entry. Executing this case requires a QA-driven push payload / fixture to land on the screen. Case body retained as written below; do not attempt via normal app navigation.

**Ref:** FLOW-12 · SubscriptionStatusScreen (push-payload only)
**Actors:** test-admin / QA (requires push-payload fixture)
**Surfaces:** mobile

**Objective:** Verify the diagnostic status screen surfaces billing internals.

**Steps:**
1. Drive a push payload / deep link to the **Subscription Status** screen for a subscriber (fixture-gated entry).

**Expected Result:**
- Shows a status badge, Stripe customer & subscription IDs, billing period start/end + days remaining, next billing date, auto-renew flag, payment-failure retry count (max 3 before grace), grace-period info (if any) with the SP-freeze warning, trial end date, and last-updated timestamp.
- Loading, error (with Retry), and "No subscription record found" states render appropriately.

---

## Group F — Payout Settings (live surface)

> 🔄 **Group rewritten 2026-09-02** to the **live** payout surface, `PayoutSettingsScreen` (route `PayoutSettings` — Dashboard **Payouts** tile). The former targets (`PayoutDashboardScreen`/`SellerEarningsScreen`) are **dead/unreachable**: `PayoutDashboard` is unregistered, and `SellerEarnings`' only caller was the dead dashboard. The live screen shows a balance hero (Available/Pending/Lifetime in **$**, not SP/AUD), a PAYOUT METHOD section, a PAYOUT HISTORY section with `Load More` (+5), and a **Withdraw Now** modal flow. Verified live in QA Task 19 (F02-adapted/H05 PASS).

### SUB-TC-F01 · Payout Settings hero — Available Balance, Pending, Lifetime Earned

**Ref:** FLOW-22 · PayoutSettingsScreen (route `PayoutSettings`, Dashboard → **Payouts** tile)
**Actors:** test-seller
**Surfaces:** mobile

**Objective:** Verify the live balance hero shows the three seller-balance figures and the Withdraw Now CTA.

**Steps:**
1. As **test-seller**, open **Payout Settings** (Dashboard → Payouts).

**Expected Result:**
- Header reads "Payout Settings".
- Hero card (`balance-hero-card`) shows "Available Balance" with the amount (`balance-amount`, **$** USD — not SP and no AUD equivalent), plus **Pending** (`balance-pending`) and **Lifetime Earned** (`balance-lifetime`) stats.
- Hero CTA **[Withdraw Now]** (`request-payout-btn`) is present.

---

### SUB-TC-F02 · Payout method section (add vs existing)

**Ref:** FLOW-22 / FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller (with a method) + a seller without a method
**Surfaces:** mobile

**Objective:** Verify the PAYOUT METHOD section reflects whether a method exists.

**Steps:**
1. Open Payout Settings as a seller **with** a saved method.
2. Open Payout Settings as a seller **without** one.

**Expected Result:**
- With method: a method card (`method-card-{id}`) shows the provider name + account identifier + status badge; an "Add Another Method" row (`add-another-method-row`) follows.
- Without method: an "Add Bank Account" row (`add-bank-row`) is shown; tapping it opens the Add Payout Method modal.
- Tapping a method card opens the method bottom sheet (Set as Primary / Edit Details / Delete Method / Cancel).

---

### SUB-TC-F03 · Payout history list (completed / pending)

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller
**Surfaces:** mobile

**Objective:** Verify the PAYOUT HISTORY rows render with status.

**Steps:**
1. On Payout Settings, review the "PAYOUT HISTORY" section.

**Expected Result:**
- Empty: "No payouts yet" (`empty-history`).
- Populated: rows (`history-row-{id}`) with a status icon (green check for completed / orange clock for pending, processing, or requires_action), the net amount (`history-amount-{id}`), a formatted date, and a status label (`history-status-{id}`).
- Rows with a payout fee show "Fee: {amount}"; rows with a failure reason show "⚠️ {reason}".
- A **Load More** control appears when there are more rows than the initial page (starts at 5) and pulls the next 5.
- Pull-to-refresh reloads and resets the list to the first 5.

---

### SUB-TC-F04 · Earnings figures — Available / Pending / Lifetime (was Seller Earnings)

**Ref:** FLOW-22 · PayoutSettingsScreen — replaces the unreachable `SellerEarningsScreen`
**Actors:** test-seller
**Surfaces:** mobile

**Objective:** Verify the earnings totals and the per-payout net/fee figures on the live surface.

**Steps:**
1. As **test-seller**, open Payout Settings and read the hero stats.
2. Cross-check a completed payout row in PAYOUT HISTORY.

**Expected Result:**
- Hero shows the three earnings figures: **Available Balance**, **Pending**, and **Lifetime Earned** (all $ USD).
- Each payout row shows the **net amount** and, when applicable, "Fee: {amount}" — the payout breakdown (gross/platform fee cards from the old Seller Earnings screen) does not exist on the live surface.
- A failed payout shows the failure reason line; a completed payout shows the completed state.
- **Note:** the legacy per-payout status-color legend (ACTION REQUIRED / PENDING / PROCESSING / COMPLETED / FAILED) is now rendered as status *labels* on the history rows; verify against `formatPayoutStatus` colors.

---

### SUB-TC-F05 · Payout history empty state (was Seller Earnings empty)

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** A seller with no payouts
**Surfaces:** mobile

**Objective:** Verify the history empty state on the live surface.

**Steps:**
1. Open Payout Settings as a seller with no payouts.

**Expected Result:**
- The PAYOUT HISTORY section shows "No payouts yet" (`empty-history`); there is no separate earnings empty state on the live surface.

### SUB-TC-F06 · Pending earnings figure follows admin-configured release timing

**Ref:** FLOW-22 × admin `pending_sp_release_days` · PayoutSettingsScreen hero Pending stat
**Actors:** test-admin + test-seller
**Surfaces:** admin, mobile

**Objective:** Verify the hero **Pending** figure reflects the release delay before earnings move to Available.

**Steps:**
1. As **test-admin**, open **/settings/trade-timing**, set `pending_sp_release_days` to a distinct value (for example `1`), and save.
2. As **test-seller**, complete a trade that creates pending seller earnings.
3. Open Payout Settings immediately after completion, then again after QA fast-forwards past the configured release window.

**Expected Result:**
- Immediately after completion, the amount appears under **Pending** (`balance-pending`), not in Available Balance (`balance-amount`).
- After the configured release delay passes, the figure moves into the available balance on reload.
- New trades follow the updated delay without requiring an app rebuild.
- Cross-check the figures against the seller-balance DB read-back (R11/R24).

### SUB-TC-F07 · Payout load error + recovery (was Seller Earnings error + Retry)

**Ref:** FLOW-22 · PayoutSettingsScreen (Alert + pull-to-refresh recovery)
**Actors:** test-seller
**Surfaces:** mobile

**Objective:** Verify a payout-data load failure surfaces an error and can be recovered.

**Steps:**
1. Open Payout Settings while the payout-data fetch fails (e.g., network error / forced offline).
2. Restore connectivity and pull-to-refresh (or reopen the screen).

**Expected Result:**
- A load failure surfaces an error alert **Failed to load payout data. Please try again.** (there is no inline error screen/Retry button on the live surface).
- Pull-to-refresh re-runs the load and the hero/history render once the fetch succeeds.
- **Note:** the old "Failed to Load Earnings + Retry" screen does not exist on the live surface.

### SUB-TC-F08 · Payout history Load More pagination (was Seller Earnings Load More)

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller
**Surfaces:** mobile

**Objective:** Verify payout-history pagination on the live surface.

**Steps:**
1. As **test-seller** with more than 5 payouts, open Payout Settings and tap **Load More** in PAYOUT HISTORY.

**Expected Result:**
- The list grows by **5** per tap (initial page = 5); **Load More** disappears when no more payouts remain; pull-to-refresh resets the list to the first 5.

---

## Group G — Payout Methods & Verification

### SUB-TC-G01 · Add Stripe Connect payout method (onboarding)

**Ref:** FLOW-23 · PayoutSettingsScreen / payoutMethods
**Actors:** test-seller (no Stripe method)
**Surfaces:** mobile

**Objective:** Verify the Stripe Connect onboarding entry.

**Steps:**
1. On **Payout Settings**, tap **[Add Payout Method]** → choose **Stripe Connect**.

**Expected Result:**
- The Stripe onboarding flow launches; until onboarding completes, the method shows an incomplete/onboarding status and is not usable for withdrawal.
- After onboarding completes, the method shows verified / payouts-enabled.

---

### SUB-TC-G02 · Add PayPal / Venmo payout method — 🚫 N/A (unconfigured providers)

> 🚫 **N/A (2026-09-02) — unconfigured providers.** Only **Stripe Connect** is a configured/verifiable payout provider. The live `AddPayoutMethodModal` does list **PayPal** and **Venmo** type buttons, but their provider integration is not configured/drivable (QA Task 19: "PayPal/Venmo/ACH method-type onboarding is not drivable — Stripe Connect is the only configured provider"). Do not execute as a live E2E case; revisit only after a PayPal/Venmo provider is configured.

---

### SUB-TC-G03 · Add Bank ACH payout method — 🚫 N/A (unconfigured / no UI option)

> 🚫 **N/A (2026-09-02) — unconfigured provider / no UI entry.** There is **no Bank ACH option** in the live `AddPayoutMethodModal` (only Stripe Connect, PayPal, Venmo are listed), and no bank_ach provider is configured. Do not execute as a live E2E case; revisit only if Bank ACH onboarding is added.

---

### SUB-TC-G04 · Set primary method / delete method (confirmation)

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller (≥2 methods)
**Surfaces:** mobile

**Objective:** Verify primary selection and deletion with confirmation.

**Steps:**
1. With two methods saved, tap **[Set as Primary]** on the non-primary one.
2. Tap **[Delete]** on a method and confirm.

**Expected Result:**
- Exactly one method is marked primary (highlighted); changing primary updates the highlight.
- Delete shows "Delete Payout Method?" confirmation; confirming removes it from the list.

---

### SUB-TC-G05 · Unverified method blocks payout (live: cannot set primary / withdraw)

**Ref:** FLOW-23 · PayoutSettingsScreen (radio + Withdraw Now guard) — replaces the unreachable `RequestPayoutScreen` variant
**Actors:** test-seller (unverified method only)
**Surfaces:** mobile

**Objective:** Verify an unverified method cannot be made primary and therefore cannot be the withdrawal method.

**Steps:**
1. With only an unverified method (status Verification required / Verification pending / Onboarding required), open Payout Settings.
2. Tap the method's radio (`radio-btn-{id}`) and, separately, open the method sheet and try **Set as Primary**.
3. Tap **Withdraw Now** (`request-payout-btn`).

**Expected Result:**
- Setting primary: the radio shows alert **Cannot Set as Primary** — "This method has status \"{status}\". Please wait until it is verified before setting it as primary." The sheet's **Set as Primary** option is disabled with subtext "Verification required before setting as primary".
- Withdrawing: since there is no verified primary method, **Withdraw Now** opens the **Payment Method Required** modal (not a payout form) — the payout is not submitted.

---

### SUB-TC-G06 · requires_action payout → "Set Up Payout Method"

**Ref:** FLOW-22 · PayoutSettingsScreen (live payout-history row)
**Actors:** A seller with a requires_action payout
**Surfaces:** mobile

**Objective:** Verify a requires_action payout row offers a way to resolve the state.

**Steps:**
1. Open Payout Settings for a seller with a requires_action payout (e.g. a
   completed trade created while no verified payout method existed).
2. Locate the payout in the PAYOUT HISTORY list.

**Expected Result:**
- The payout row shows an "Action Required" status.
- The row shows a **[Set Up Payout Method]** button (`testID` `history-action-*`).
- Tapping it opens the in-screen Add Payout Method flow (Stripe Connect
  onboarding / bank / PayPal / Venmo), so the seller can resolve the state
  without leaving the screen.

**Notes (DT-119):** The earlier `SellerEarningsScreen` surface that hosted this
CTA is DEPRECATED (Dev Task 86); G06 now targets the live PayoutSettings row.

### SUB-TC-G07 · Payout Settings — "Edit Details" sheet

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller
**Surfaces:** mobile

**Objective:** Verify the bottom-sheet "Edit Details" option.

**Steps:**
1. Open **Payout Settings**, tap a payout method's kebab menu, then tap **Edit Details**.

**Expected Result:**
- Alert **Edit Details** shows `Editing payout method details is not yet available. Contact support for changes.`

### SUB-TC-G08 · "Cannot Delete Primary/Only Method" guard

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller
**Surfaces:** mobile

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
**Surfaces:** mobile

**Objective:** Verify an unverified method cannot be set primary.

**Steps:**
1. Attempt to set an unverified method as primary (via the radio or the sheet's **Set as Primary**).

**Expected Result:**
- Alert **Cannot Set as Primary** shows: This method has status "{status_message}". Please wait until it is verified before setting it as primary.
- The sheet's **Set as Primary** option is disabled with the subtext `Verification required before setting as primary`.

### SUB-TC-G10 · Payout history Load More

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller
**Surfaces:** mobile

**Objective:** Verify payout-history pagination.

**Steps:**
1. With more than 5 payouts, open **Payout Settings** and tap **Load More** in **Payout History**.

**Expected Result:**
- The list grows by 5 per tap; refreshing resets the list to the first 5.

### SUB-TC-G11 · NoMethodModal flow

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller (no payout method)
**Surfaces:** mobile

**Objective:** Verify the no-method withdrawal guard modal.

**Steps:**
1. With no payout method configured, tap **Withdraw Now**.

**Expected Result:**
- Modal **Payment Method Required** shows `To withdraw your earnings, you need to add and verify a payout method first.` with **Add Payout Method** (opens the add flow) and **Cancel**.

---

## Group H — Withdraw (Payout Settings — live surface)

> 🔄 **Group rewritten 2026-09-02** to the **live** full-balance Withdraw flow on `PayoutSettingsScreen` (**Withdraw Now** → **WithdrawModal**). The former `RequestPayoutScreen` amount-entry flow is dead (its only caller was the unregistered `PayoutDashboard`). Withdrawals are **full-available-balance only** — there is no manual amount field. Verified live in QA Task 19 (H05 PASS; WithdrawModal Cancel → clean dismiss, zero residue).

### SUB-TC-H01 · Withdraw Now — no-balance guard (amount entry removed)

**Ref:** FLOW-22 · PayoutSettingsScreen (WithdrawModal) — replaces the unreachable `RequestPayoutScreen` amount-entry flow
**Actors:** test-seller
**Surfaces:** mobile

**Objective:** Verify the Withdraw path guards against a zero balance. (The live surface withdraws the **full available balance** — there is no manual amount-entry field, so old "over-balance amount" validation does not exist.)

**Steps:**
1. As **test-seller** with no available balance (or $0.00), open **Payout Settings** and tap **[Withdraw Now]**.

**Expected Result:**
- Alert **No Balance** — "You have no available balance to withdraw".
- No WithdrawModal opens and no withdrawal is created.

---

### SUB-TC-H02 · WithdrawModal summary — Available / Payout Fee / You'll Receive

**Ref:** FLOW-22 · PayoutSettingsScreen (WithdrawModal, `calculatePayoutFee`)
**Actors:** test-seller (verified method + balance > 0)
**Surfaces:** mobile

**Objective:** Verify the fee and net calculation shown for the full-balance withdrawal.

**Steps:**
1. As **test-seller** with a verified primary method and balance > 0, open Payout Settings and tap **[Withdraw Now]**.

**Expected Result:**
- **WithdrawModal** ("Withdraw Funds") shows: **Available Balance:** {available}, **Payout Fee:** -{fee}, **You'll Receive:** {available − fee}, and **Payout Method:** {primary method label}.
- Fee matches `calculatePayoutFee(primaryMethod.method_type, available)` for the primary method (Stripe: $0.25 + 0.25%; PayPal/Venmo: 2% capped at $20.00).
- There is no amount-entry field — the withdrawal is for the full available balance.

---

### SUB-TC-H03 · Confirm Withdrawal success

**Ref:** FLOW-22 · PayoutSettingsScreen (WithdrawModal → `requestFullWithdrawal`) · `request_seller_payout` RPC
**Actors:** test-seller (verified method)
**Surfaces:** mobile

**Objective:** Verify a successful full-balance withdrawal request.

**Steps:**
1. With a verified method and balance > 0, open the WithdrawModal and tap **[Confirm Withdrawal]**.

**Expected Result:**
- Alert **Withdrawal Requested** — "Your withdrawal of {amount} has been initiated. After fees, you will receive {net}."
- The modal closes, the balance refreshes, and the payout appears as PENDING in PAYOUT HISTORY.
- DB read-back confirms the `seller_payouts` row (R11/R24) — **zero residue only if this is the intended withdrawal fixture**.

---

### SUB-TC-H04 · Withdraw blocked when no verified primary method

**Ref:** FLOW-22 / FLOW-23 · PayoutSettingsScreen (handleWithdrawClick → NoMethodModal)
**Actors:** test-seller (no primary method)
**Surfaces:** mobile

**Objective:** Verify the no-method guard on Withdraw Now.

**Steps:**
1. As **test-seller** with balance > 0 but **no primary (verified) method**, open Payout Settings and tap **[Withdraw Now]**.

**Expected Result:**
- NoMethodModal **Payment Method Required** opens — "To withdraw your earnings, you need to add and verify a payout method first."
- **Add Payout Method** opens the add flow; **Cancel** dismisses; no payout is created.

---

### SUB-TC-H05 · Withdraw Now from Payout Settings hero

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller (balance > 0)
**Surfaces:** mobile

**Objective:** Verify the Withdraw Now hero path.

**Steps:**
1. On **Payout Settings**, tap **[Withdraw Now]** on the balance hero.

**Expected Result:**
- With a balance and a verified method, the withdrawal flow proceeds and shows a "Withdrawal Requested" confirmation (amount + net + status).
- With no balance: "No Balance" alert. With no method: "Please add a verified payout method first."

### SUB-TC-H06 · Admin minimum withdrawal blocks full-balance withdrawals below the floor

**Ref:** FLOW-22 × admin `minimum_withdrawal_amount_cents` · PayoutSettingsScreen WithdrawModal → `request_seller_payout`
**Actors:** test-admin + test-seller
**Surfaces:** admin, mobile

**Objective:** Verify the configured minimum withdrawal amount is enforced on the full-balance withdrawal request.

**Steps:**
1. As **test-admin**, set `minimum_withdrawal_amount_cents` to `1000` and save.
2. As **test-seller** whose available balance is below the configured minimum (e.g., $7.00 < $10.00), open Payout Settings, tap **[Withdraw Now]**, and tap **[Confirm Withdrawal]** in the WithdrawModal.

**Expected Result:**
- The full-balance request is rejected — alert **Withdrawal Failed** with "Minimum withdrawal amount is $10.00" (client + RPC `request_seller_payout` enforce the configured floor).
- No payout row is created; the available balance is unchanged.

### SUB-TC-H07 · Minimum withdrawal disabled when config = 0

**Ref:** FLOW-22 × admin `minimum_withdrawal_amount_cents` · PayoutSettingsScreen WithdrawModal
**Actors:** test-admin + test-seller
**Surfaces:** admin, mobile

**Objective:** Verify a zero minimum disables the withdrawal floor entirely.

**Steps:**
1. As **test-admin**, set `minimum_withdrawal_amount_cents` to `0` and save.
2. As **test-seller** with a small available balance, open Payout Settings and confirm a full-balance withdrawal in the WithdrawModal.

**Expected Result:**
- No minimum-withdrawal rejection occurs; the full-balance withdrawal proceeds (subject only to balance availability, a verified primary method, and provider fees).
- DB read-back confirms the payout row for the small amount (R11/R24); clean up the withdrawal fixture after.

---

## Group I — SP Wallet Balance & Earn

### SUB-TC-I01 · SP Wallet hero balance + lifetime stats

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer
**Surfaces:** mobile

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
**Surfaces:** mobile

**Objective:** Verify the three quick-action buttons navigate correctly.

**Steps:**
1. On the wallet, tap **Shop**, then back; tap **Sell**, then back; tap **History**.

**Expected Result:**
- Shop → Discover; Sell → item creation; History → SP Transaction History.

---

### SUB-TC-I03 · How to Earn SP section + Learn More

**Ref:** FLOW-11 · SpWalletScreen
**Actors:** test-buyer
**Surfaces:** mobile

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
**Surfaces:** mobile

**Objective:** Verify expiration messaging.

**Steps:**
1. On the wallet, review the expiration info box and the expiring-soon alert.

**Expected Result:**
- Info box: "Swap Points Expire" — "Points expire after {N} days of inactivity. Use them or lose them!" (N from config).
- An "⚠️ {N} SP will expire in 30 days" alert appears when batches are expiring within 30 days.

---

### SUB-TC-I05 · Wallet warning banner by wallet state (active/grace/expired/frozen)

**Ref:** FLOW-10 · WalletWarningBanner (`src/components/molecules/WalletWarningBanner.tsx`) — DEV-TASK-117 doc-sync: the banner keys off the **wallet `state`** (not the subscription), and `active`/`inactive` return **no banner**
**Actors:** test-buyer (active), test-grace (grace), an expired user (frozen)
**Surfaces:** mobile

**Objective:** Verify the wallet state banner changes by wallet state.

**Steps:**
1. Open the wallet as active, grace, and expired users.

**Expected Result:**
- Active: no banner (WalletWarningBanner returns null for `active`).
- Grace period (`wallet.state='grace_period'`): amber **"Grace Period Active"** banner — "You can keep spending existing Swap Points, but you won't earn new ones until you renew." (warning tint `#FFF3E0`/`#FFA726`, NOT red).
- Expired (wallet becomes `frozen`): info-blue **"Swap Points Frozen"** banner — "Your Swap Points are frozen. Renew your subscription to use them again." (info tint `#EBF4F9`/`#5B8FB9`, NOT red/deleted).
- A `suspended` wallet shows the red **"Wallet Suspended"** error banner (contact support).

---

### SUB-TC-I06 · Free user SP wallet — earning is gated behind Kids Club+ (0-SP wallet + upsell card)

**Ref:** FLOW-10 / FLOW-11 · SpWalletScreen — DEV-TASK-117 doc-sync: the guide previously described an "inactive, subscribe-to-unlock" lock state that does not exist. The live wallet renders a **normal 0-SP wallet with no lock** — free SP gating happens at Home's SP strip, the offer/checkout "Accept SP" gate, and now an inline Join Kids Club+ upsell card on the wallet itself (item-7 product change, 2026-09-05)
**Actors:** test-free
**Surfaces:** mobile

**Objective:** Verify a free (non-subscriber) user's wallet renders normally at 0 SP with the Join Kids Club+ upsell card; SP gating stays enforced at the earn/spend surfaces.

**Steps:**
1. As **test-free**, open the wallet.
2. Confirm the 0-SP hero, the quick actions, and the upsell card.
3. (Optional) Tap the upsell card → **Join Kids Club+**.

**Expected Result:**
- The wallet renders a **normal 0-SP wallet**: hero shows `0` Swap Points; **Shop / Sell / History** quick actions all work; no lock overlay and no gated balance actions.
- An inline **"Join Kids Club+ to start earning Swap Points"** card (`testID="sp-wallet-join-kids-club-card"`) appears under the hero; tapping it navigates to **Join Kids Club+** (web-first join surface).
- `WalletWarningBanner` shows nothing for this state (returns null for `active`/`inactive`) — there is deliberately no lock banner on the wallet itself.
- Earning is genuinely Kids Club+-gated **elsewhere** (Home's SP strip upsell, the offer/checkout Accept-SP gate), so the wallet's "How to Earn SP" list is read alongside the card that makes the gate explicit.

### SUB-TC-I07 · SP Wallet — "Reserved in trades" card

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer
**Surfaces:** mobile

**Objective:** Verify the reserved-SP card appears only when SP is reserved in pending offers.

**Steps:**
1. As a subscriber with an active SP-backed offer (`reserved_sp > 0`), open **SP Wallet**.

**Expected Result:**
- Card **Reserved in trades** shows `{reserved_sp} SP` and `SP used in pending offers — returned if trade is cancelled.`
- The card is absent when `reserved_sp = 0`.

### SUB-TC-I08 · SP Wallet — "Wallet Not Found" error

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer
**Surfaces:** mobile

**Objective:** Verify the wallet-not-found error state.

**Steps:**
1. Open **SP Wallet** under a condition where the wallet cannot be loaded.

**Expected Result:**
- Shows `💳` **Wallet Not Found** with `Unable to load your SP wallet.`
- **Flag:** this requires `getWallet` to return null (e.g., an RLS/read failure) — `getWallet` auto-inserts a missing wallet row, so this state is rare.

### SUB-TC-I09 · SP Wallet — pending-release summary note

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

**Objective:** Verify each ledger row's icon, label, and color.

**Steps:**
1. Review individual rows across types (sale, purchase, redeem, referral, pending).

**Expected Result:**
- Each row shows a type-specific icon, a human-readable label (type capitalized, underscores → spaces), date/time, and a signed amount: green "+{n} SP" for earned, red "-{n} SP" for spent.

---

### SUB-TC-J03 · Empty state per tab

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** A user with no spent entries
**Surfaces:** mobile

**Objective:** Verify the per-tab empty state.

**Steps:**
1. On a tab with no matching entries (e.g., Spent for a user who never spent), review the empty state.

**Expected Result:**
- A grey Coins icon with "No transactions yet".

---

### SUB-TC-J04 · Pull-to-refresh updates ledger

**Ref:** FLOW-10 · SpTransactionHistoryScreen
**Actors:** test-buyer
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

**Objective:** Verify empty and error states.

**Steps:**
1. Open Transaction History with no records, then simulate a load failure.

**Expected Result:**
- Empty: a receipt icon + "No billing history yet."
- Error: a receipt icon + error text + **[Retry]** that reloads.

## Group L — Webhooks & Reconciliation

> 🔄 **Group refreshed 2026-09-02 (QA Task 21):** Webhook cases are **server/webhook-domain** (not end-user-executable via the mobile app alone), but the real money leg is now **UNBLOCKED and verified live**. QA Task 21 (`e2e-test-results/qa-task21-sub-close-2026-09-02/report.md`, Section A + F) drove a full real lifecycle on a disposable user: real Stripe Checkout ($5.99/mo) → webhook → `subscriptions` + `subscription_events` rows → free→active mobile transition → in-app cancel → **Stripe test-clock renewal that advanced `current_period_end` and wrote a new `billing_history` row**. The prior blockers are resolved: the Kids Club+ tier has a linked real Stripe test price (DT-90) and `stripe-webhook-subscriptions` is now subscribed to the 6 purchase+renewal events — the missing R7 `checkout.session.completed` + `customer.subscription.created` subscriptions were the blocker (QA Task 21 Finding 1, fixed). **L01 (renewal) and L04 (idempotency) PASS live; L02/L03 remain PARTIAL** (mechanism + deployed parity verified; live failing-renewal and negative-signature legs need the fixtures noted per-case). Re-drive live legs on a **disposable user** (never test-buyer — stale-active sub).

### SUB-TC-L01 · Renewal webhook updates billing history and member state

**Ref:** FLOW-26 · subscription webhook (`stripe-webhook-subscriptions`) — **LIVE PASS in QA Task 21** (2026-09-02, Section A7 + F/L01)
**Actors:** disposable user (QA Task 21 recipe) — NOT test-buyer (stale-active sub — see note)
**Surfaces:** mobile

**Objective:** Verify a valid renewal webhook reconciles the subscription state and billing history.

**Steps (as driven in QA Task 21 A7):**
1. Create a fresh test-clock subscription metadata-bound to the disposable user's `user_id` (a test clock cannot be retro-attached to an existing Checkout subscription — `parameter_unknown`).
2. Advance the clock past the billing anchor so a genuine renewal invoice is created and paid.
3. Reopen **My Subscription** and **Billing History**.

**Expected Result (achieved in QA Task 21 A7):**
- Stripe `invoice.payment_succeeded` → DB `subscriptions.current_period_end` **advanced** (2026-10-02 → 2026-11-02, `next_billing_date` synced) and a new **`billing_history` row** was created (`in_1UBMIB4`, amount 599, status `succeeded`) — the DT-88 renewal-advance fix proven on a brand-new subscription.
- **Note:** test-buyer's real Stripe sub remains **stale-active** (`current_period_end` 2026-07-27; no billing since 2026-06-30) — do not use it for renewal legs; use a disposable user (QA Task 21 recipe).

### SUB-TC-L02 · Payment-failed webhook moves subscription into retry / grace state

**Ref:** FLOW-26 · payment failure webhook — **PARTIAL** (mechanism verified; live failing-renewal not driven)
**Actors:** disposable user with an active subscription and NO saved payment method
**Surfaces:** mobile

**Objective:** Verify a payment-failed webhook updates the user-visible subscription state.

**Steps (deferred — needs a no-PM renewal fixture):**
1. Trigger a genuine failing renewal on an existing subscription (a checkout decline is NOT the same as a renewal-invoice failure).
2. Reopen the subscription screens for the affected user.

**Expected Result:**
- Mechanism verified: the deployed EF has `invoice.payment_failed` subscribed; `record_payment_attempt` increments `payment_retry_count`, sets `payment_failed_at`, and after 3 failures enters grace with SP freeze (`triggerSpFreeze`) + a critical payment-failure notification. Grace-state UX verified separately as **SUB-TC-I05**.
- Live failing-renewal leg not yet driven (QA Task 21 L02 remains PARTIAL) — needs a no-PM renewal fixture.

### SUB-TC-L03 · Invalid webhook signature is rejected with no duplicate state change

**Ref:** FLOW-26 · signature verification — **PARTIAL** (source + deployed parity verified; live negative POST not driven)
**Actors:** QA
**Surfaces:** n/a (server/webhook; QA-driven)

**Objective:** Verify an invalid webhook payload is rejected and does not mutate user-visible state.

**Steps (deferred — read-only discipline):**
1. Send the same webhook type with an invalid signature to the deployed webhook EF.

**Expected Result:**
- Source + deployed parity verified: `constructEventAsync` against `STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET` returns **400 `INVALID_SIGNATURE` with no DB mutation** (`verify_jwt=false`, public webhook URL). A live negative-signature POST was not run under QA read-only discipline (QA Task 21 L03 remains PARTIAL); direct-call recipe in QA Task 21 §F/L03.

### SUB-TC-L04 · Duplicate webhook delivery is idempotent

**Ref:** FLOW-26 · idempotent processing — **LIVE PASS in QA Task 21** (2026-09-02, Section A2 + F/L04)
**Actors:** QA
**Surfaces:** mobile

**Objective:** Verify replaying the same valid webhook does not create duplicate side effects.

**Steps:**
1. Complete a real web purchase (fresh disposable user); observe the converging webhook events.

**Expected Result (achieved in QA Task 21 A2):**
- The purchase produced **4 webhook events converging to ONE `subscriptions` row + ONE `subscription_events` row** (no dupes); `billing_history` UNIQUE(`charge_id`) held; `rpc_upsert_web_subscription` is replay-safe regardless of Checkout/webhook ordering. Audit trail: the upsert writes a `subscription_events` row (`event_type='web_subscription_upsert'`) — QA Task 21 produced the **first-ever live R7 audit row**, closing QA Task 20's "zero rows" gap.

### SUB-TC-L05 · Payout-status webhook updates seller payout history

**Ref:** FLOW-26 · payout provider webhooks (`stripe-webhook`/payout EFs, not `stripe-webhook-subscriptions`)
**Actors:** test-seller
**Surfaces:** mobile

**Objective:** Verify provider payout webhooks reconcile seller payout status in the app.

**Steps:**
1. Ensure **test-seller** has a payout in `pending` or `processing` state.
2. Trigger a signed payout-completed or payout-failed webhook for that payout.
3. Open **Payout Settings** → PAYOUT HISTORY (the live surface — the legacy Payout Dashboard/Seller Earnings screens are dead).

**Expected Result:**
- The payout row changes to the provider-reported status; completed payouts show the completion state/date; failed payouts show the failure state and reason (⚠️ line) if available.
- No second payout row is created for the same provider event (idempotent reconciliation).
- **Classification note (QA Task 20):** L05 belongs to the **payout domain** (unchanged from prior classification) — its source is `stripe-webhook`/payout EFs, not the subscription webhook.

---

## Group M — Payment Methods (Card on File)

### SUB-TC-M01 · Payment Methods — loading state

**Ref:** FLOW-12A · PaymentMethodsScreen
**Actors:** test-buyer
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

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
**Surfaces:** mobile

**Objective:** Verify the active-subscription early-return view.

**Steps:**
1. Open **ContinueKidsClub** while the account already has an active subscription.

**Expected Result:**
- Shows `✅ Kids Club+ Active` with `Your subscription is already active and your premium benefits are available.` and a **Go Back** button.
- **Flag:** the `Already Subscribed` alert is unreachable (the active state early-returns before the CTA renders); the `ContinueKidsClub` route is itself effectively deep-link-only (its `navigate()` call sites live in the unregistered `SubscriptionChoiceScreen.tsx`).

### SUB-TC-N05 · ContinueKidsClub loading state

**Ref:** FLOW-12 · ContinueKidsClubScreen
**Actors:** test-free
**Surfaces:** mobile

**Objective:** Verify the loading state while trial status loads.

**Steps:**
1. Open **ContinueKidsClub**.

**Expected Result:**
- A `Loading...` spinner shows while `getTrialStatus` resolves, then the content renders.

### SUB-TC-N06 · ContinueKidsClub trial-ending urgency badge

**Ref:** FLOW-12 · ContinueKidsClubScreen
**Actors:** test-trial
**Surfaces:** mobile

**Objective:** Verify the urgency badge copy when 7 or fewer trial days remain.

**Steps:**
1. As a trial user with 7 or fewer days remaining, open **ContinueKidsClub**.

**Expected Result:**
- The badge reads `{N} day left in trial` (1 day) or `{N} days left in trial` (2–7 days).
- With more than 7 days, the badge reads `{trialDays} free days • no charge today`.

---

## Fixture-Gated Backlog

> 📦 **Fixture-Gated Backlog (created 2026-09-02):** Cases moved out of their original groups because they require clock fast-forward and/or push-payload fixtures that are not drivable on the live staging app without dedicated tooling (real push delivery, scheduled-job triggers, or Stripe test clocks). They remain valid test cases for a fixture-equipped session; do not attempt during standard on-device runs.
>
> **Moved from Group D:** SUB-TC-D06, SUB-TC-D07.

### SUB-TC-D06 · Subscription event notifications (trial reminders, renewal, failure) — 📦 FIXTURE-GATED

**Ref:** FLOW-17 subscription event notifications
**Actors:** test-trial, test-buyer
**Surfaces:** mobile

**Objective:** Verify subscription lifecycle notifications fire at the right moments.

**Steps (require clock fast-forward + real push fixture):**
1. Fast-forward the trial clock to 7/3/1 days before trial end (test-trial).
2. Fast-forward to a successful renewal charge (test-buyer).
3. Simulate a failed renewal charge.

**Expected Result:**
- Trial reminder notifications are delivered at 7-day, 3-day, and 1-day marks.
- A renewal-success notification is delivered on successful charge.
- A payment-failure notification is delivered (and is treated as critical — bypasses quiet hours) prompting payment-method update.
- A cancellation produces a cancellation-confirmation notification.

### SUB-TC-D07 · Grace reminder notifications follow configured thresholds — 📦 FIXTURE-GATED

**Ref:** FLOW-17 × admin `grace_reminder_thresholds`
**Actors:** test-admin + test-grace
**Surfaces:** mobile

**Objective:** Verify grace reminder timing uses the admin-configured threshold array.

**Steps (require clock fast-forward + real push fixture):**
1. As **test-admin**, set `grace_reminder_thresholds` to a distinct set such as `[30, 7, 1]` and save.
2. Fast-forward a grace-period user to just above, then exactly at, each configured threshold.
3. Check both push delivery and the in-app notification center after each threshold.

**Expected Result:**
- Reminder notifications are delivered at 30, 7, and 1 days remaining, with the correct days-left copy.
- Thresholds removed from the config no longer fire after the change.

---

## Regression

### SUB-TC-R01 · Subscriber fee applied in trade checkout
**Surfaces:** mobile
**Objective:** Confirm an active subscriber is charged the subscriber transaction fee in a real trade checkout.
**Steps:** 1. As a subscriber, start a trade checkout and view the fee line.
**Expected Result:** The subscriber fee (config value) is shown, not the non-subscriber fee.

### SUB-TC-R02 · SP balance consistent across wallet, trade, and history
**Surfaces:** mobile
**Objective:** Confirm the SP available balance matches across the wallet hero, an SP offer slider max, and the ledger sum.
**Steps:** 1. Compare the wallet balance, the max SP usable on an Accept SP listing, and the running ledger.
**Expected Result:** All three reconcile.

### SUB-TC-R03 · Payout available balance matches earnings
**Surfaces:** mobile
**Objective:** Confirm the Payout Dashboard available balance equals the Seller Earnings available figure.
**Steps:** 1. Compare Payout Dashboard hero vs My Earnings totals.
**Expected Result:** Available balances reconcile (Lifetime − Pending − Withdrawn).

### SUB-TC-R04 · Cancel then reactivate restores SP access
**Surfaces:** mobile
**Objective:** Confirm cancel-before-period-end keeps SP usable and reactivation restores active status.
**Steps:** 1. Cancel, confirm SP still usable, reactivate.
**Expected Result:** SP remains usable through the period; reactivation returns Active.

### SUB-TC-R05 · Config change reflects without app rebuild
**Surfaces:** admin, mobile
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
| 🔴 RETIRED — in-app start-trial → payment (web-first; coverage → Web Subscription Purchase E2E) | SUB-TC-B01 |
| 🔴 RETIRED — in-app payment benefits/"Due today" (coverage → QA Task 20 scope 2) | SUB-TC-B02 |
| 🔴 RETIRED — in-app Stripe payment → Success (coverage → QA Task 20) | SUB-TC-B03 |
| 🔴 RETIRED — trial-already-used blocked (server-side trial config → QA Task 20 F-3) | SUB-TC-B04 |
| 🔴 RETIRED — trial disabled globally (coverage → QA Task 20 F-3) | SUB-TC-B05 |
| 🔴 RETIRED — Continue Kids Club+ urgency (deep-link only → see N03–N06) | SUB-TC-B06 |
| 🔴 RETIRED — referred-user bonus-loss warning (removed surface → see N03) | SUB-TC-B07 |
| Config change reflects without app rebuild (trial-limit leg) | SUB-TC-R05 (retired B08 leg removed) |
| My Subscription paid view | SUB-TC-C01 |
| My Subscription quick menu routes | SUB-TC-C02 |
| Manage Kids Club+ status + billing | SUB-TC-C03 |
| Cancel retention "Keep My Benefits" | SUB-TC-C04 |
| Cancel reason modal + final confirm | SUB-TC-C05 |
| Cancelled active until period end | SUB-TC-C06, SUB-TC-R04 |
| Auto-renew toggle / update payment | SUB-TC-C07 |
| Grace period banner + SP freeze warning (FLOW-10/12) | SUB-TC-D01 |
| 🔴 RETIRED — in-app re-subscribe from grace (web-first; → N01/N02 + Web E2E) | SUB-TC-D02 |
| Subscription Expired screen | SUB-TC-D03 |
| 🔴 RETIRED — in-app renewal payment (web-first; → N01/N02 + Web E2E) | SUB-TC-D04 |
| Reactivate from cancelled | SUB-TC-D05 |
| 📦 Subscription event notifications (FLOW-17) — fixture-gated backlog | SUB-TC-D06 |
| 📦 Grace reminder thresholds — fixture-gated backlog | SUB-TC-D07 |
| Billing history list + badges | SUB-TC-E01 |
| Billing history empty | SUB-TC-E02 |
| Failed charge error message | SUB-TC-E03 |
| ⏸ Subscription Status diagnostics (push-payload fixture-gated) | SUB-TC-E04 |
| Payout Settings hero Available/Pending/Lifetime (FLOW-22, live) | SUB-TC-F01 |
| Payout method section add/existing (live) | SUB-TC-F02 |
| Payout history list (live) | SUB-TC-F03 |
| Earnings figures + history net/fee (live; replaces Seller Earnings) | SUB-TC-F04, SUB-TC-R03 |
| Payout history empty state (live) | SUB-TC-F05 |
| Pending earnings figure follows admin release timing | SUB-TC-F06 |
| Payout load error + recovery (live) | SUB-TC-F07 |
| Payout history Load More +5 (live) | SUB-TC-F08 |
| Add Stripe Connect method (FLOW-23) | SUB-TC-G01 |
| 🚫 N/A — Add PayPal / Venmo (unconfigured) | SUB-TC-G02 |
| 🚫 N/A — Add Bank ACH (unconfigured / no UI) | SUB-TC-G03 |
| Set primary / delete method | SUB-TC-G04 |
| Unverified method blocks payout (live guard) | SUB-TC-G05 |
| requires_action → setup CTA | SUB-TC-G06 |
| Withdraw no-balance guard (live; amount entry removed) | SUB-TC-H01 |
| WithdrawModal fee + net summary (live) | SUB-TC-H02 |
| Confirm Withdrawal success (live) | SUB-TC-H03 |
| Withdraw blocked when no verified method (live) | SUB-TC-H04 |
| Withdraw Now hero path (live, verified template) | SUB-TC-H05 |
| Minimum withdrawal config (full-balance, live) | SUB-TC-H06, SUB-TC-H07 |
| SP wallet hero + lifetime stats (FLOW-10) | SUB-TC-I01, SUB-TC-R02 |
| SP wallet quick actions | SUB-TC-I02 |
| How to Earn SP + Learn More (FLOW-11) | SUB-TC-I03 |
| SP expiration info + expiring-soon alert | SUB-TC-I04 |
| Wallet warning banner by wallet state | SUB-TC-I05 |
| Free user SP wallet — 0-SP wallet + Join Kids Club+ upsell card | SUB-TC-I06 |
| SP history tabs All/Earned/Spent | SUB-TC-J01 |
| SP history rows icon/label/amount | SUB-TC-J02 |
| SP history empty per tab | SUB-TC-J03 |
| SP history pull-to-refresh | SUB-TC-J04 |
| Transaction history list + badges | SUB-TC-K01 |
| Transaction history empty + error/retry | SUB-TC-K02 |
| Subscriber fee in trade checkout | SUB-TC-R01 |
