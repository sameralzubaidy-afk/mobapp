# QA — SUB Android Round 3 (Groups K / L / N + Group M remaining legs)

**Guide:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
**Platform:** Android emulator — `Medium_Phone_API_36.1` (`emulator-5554`), 1080×2400 px (AX tree coords == pixels, R77 #1)
**Date:** 2026-09-16 · **Personas:** test-buyer, test-seller, test-trial, test-payfail, qa-payout-seller
**Evidence:** `screenshots/` (25 frames) · `ledger.md`

---

## 0 · Session setup & shared-resource check (R29 / R63 / R63a)

| Check | Result |
|---|---|
| `adb devices` | `emulator-5554` present |
| `pgrep -l -f "expo start"` | **exactly one** Metro (pid 11063) |
| `lsof -iTCP:8082` | **no listener** (R63a satisfied) |
| `pgrep -f "run-suite\|maestro\|playwright\|uiautomator"` | one `playwright test-server` (p2p-kids-admin) — a *server*, not a device driver; no concurrent device driver |
| `find e2e-test-results -newermt '-6 hours'` | only my own run folder + today's completed predecessors |

**Verdict: CLEAR to run.** No other agent was driving the emulator or the admin browser session.

---

## 1 · Step 0 — Reconciliation (standing rule)

### 1a · SUB-TC-I09 re-point (required by the brief)

FIX-Task-39 item 6 renamed the SP Wallet pending-release note. Re-pointed with **fresh on-device evidence** (test-seller):

- Title: **"39 SP Releasing Soon"** (the new copy — no longer "39 SP Pending Release")
- Body: "This SP comes from your completed sales and isn't spendable yet — each batch unlocks **3** days after its trade."
- Screenshot: `screenshots/I09-releasing-soon-note.png`

**Both numbers DB-reconciled freshly (R54 / R100 — writers named, not assumed):**

| UI figure | Source (exact query) | Value | Match |
|---|---|---|---|
| "39" | `sum(trades.sp_earned_at_completion)` over `status='completed' AND sp_released_at IS NULL AND seller_id=test-seller` (18 rows) | **39** | ✅ exact |
| "Pending" chip 503 | `sp_wallets.pending_balance` | **503** | ✅ exact |
| "Total Earned" 2741 | `sp_wallets.lifetime_earned` | **2741** | ✅ exact |
| "Total Spent" 0 | `sp_wallets.lifetime_spent` | **0** | ✅ exact |

They are **different concepts and are NOT a contradiction** (the tracker's existing note stands): the note sums the release queue, the chip reads the wallet's pending balance.

> **Schema correction surfaced by this read:** `sp_wallets` has **`lifetime_expired`** and **`starter_pack_issued_at`**, neither of which was in `/memories/repo/schema-cheat-sheet.md`. Also: `available_balance` ≠ `lifetime_earned − lifetime_spent − pending_balance` (2263+503=2766 vs 2741). **Not filed** — the counters are independently maintained and the 25 delta tracks `lifetime_expired`. Cheat-sheet updated (R-NEW-3 standing duty).

### 1b · Tracker row-set audit (R52 / R56 / R57)

`grep` enumeration of every SUB table row was used to reconcile the tracker against the guide's 100-case index.

- **§1 roll-up was STALE (R56):** the top table read SUB `PASS 77 / OPEN 3 / Remaining 1` while the section header read `PASS 78 / OPEN 2` — the newer truth (Round 2a's own note records the 77→78 / 3→2 I08 flip). **Corrected.**
- **Row-set arithmetic now reconciles:** 101 SUB table rows = **84 Completed rows → 83 distinct** (one **duplicate `I06` row** — R57 item 3) **+ 15 RETIRED + 2 N/A = 100** ✅ = the canonical case count.
- **Remaining (never-run) = 0.** The ACTIVE table's single row is a struck-through duplicate of the Completed `G01` row.
- **6 rows were malformed** (7 cells — the `iOS`/`Android` columns were never inserted by the FIX-Task-37 item-7 script): `M01`, `M06`, `M07`, `N05`, `N06` (and the same shape elsewhere). **Fixed.**
- **Round 1's Android verdicts were prose-only** (M02–M06, F01, F03, G06, G11, H04 — the section note records them but the per-row `Android` cell stayed `—`). **Android column populated.**
- ⚠️ **Residual ±1 — flagged, NOT forced:** the per-status split `78 PASS + 2 PARTIAL + 2 OPEN + 15 RETIRED + 2 N/A = 99` accounts for **99 of the 100** canonical cases. One canonical case holds a row whose status is not in the header tally. Named as an **open reconciliation item** rather than silently renumbered (R57: report the reconciliation, don't just fix silently).

---

## 2 · Results

| TC-ID | Verdict (Android) | Headline | Top finding |
|---|---|---|---|
| SUB-TC-K01 | ✅ **PASS** | PASS (unchanged) | 4 rows, DB 4/4 exact incl. failed `error_message` verbatim; pull-to-refresh spinner + reload |
| SUB-TC-K02 | ✅ **PASS** | PASS (unchanged) | empty + error/retry both driven; **DOC-DRIFT** on the error-state icon; Retry **locator gap** |
| SUB-TC-N01 | ✅ **PASS** | PASS (unchanged) | full value-prop copy + web card + CTA exact |
| SUB-TC-N02 | ✅ **PASS** | PASS (unchanged) | browser opened with `?email=`; host variance (dev `localhost:3002`) |
| SUB-TC-N03 | ✅ **PASS** | PASS (unchanged) | `subscription-plans` alias renders JoinKidsClubScreen on-device |
| SUB-TC-N04 | ✅ **PASS** | PASS (unchanged) | "Kids Club+ Active" + Go Back |
| SUB-TC-N05 | ✅ **PASS** | PASS (unchanged) | loading state **source-confirmed** (transient; same limitation as QA Task 39) |
| SUB-TC-N06 | ✅ **PASS** | PASS (unchanged) | ≤7-d branch: warning pill **"5 days left in trial"** |
| SUB-TC-L01 | ✅ **PASS** | PASS (unchanged) | **first provider-layer (Stripe) confirmation** of a renewal row |
| SUB-TC-L02 | ✅ **PASS** | PASS (unchanged) | user-visible retry-tier banner, DB-exact |
| SUB-TC-L03 | 🚫 **N/A (platform-independent)** | PASS (unchanged) | server/webhook-domain; not re-POSTed (network discipline) |
| SUB-TC-L04 | ✅ **PASS** | PASS (unchanged) | table-wide idempotency: **0 duplicate invoice groups in 53 rows** |
| SUB-TC-L05 | 🟡 **PARTIAL (Android)** | PARTIAL | **3-layer AGREES** + idempotency; only the live-webhook re-drive leg remains |
| SUB-TC-M07 | 🟡 **PARTIAL (unchanged)** | PARTIAL | both remaining legs **still blocked** — evidenced, not assumed |
| SUB-TC-F02 | ✅ **PARTIAL → PASS (Android)** | PASS (unchanged) | **fixture gate cleared** — "with method" leg driven |
| SUB-TC-I09 | ✅ **PASS** | PASS | tracker evidence **re-pointed** to the current copy |

**Roll-up this round: 13 Android verdicts added (11 new PASS · 1 PARTIAL · 1 N/A) · 1 PARTIAL→PASS (F02) · 0 FAIL · 0 new BLOCKED.**

---

## 3 · Per-case detail

### SUB-TC-K01 · Transaction History list + status badges — ✅ PASS (Android)

Screen: `TransactionHistoryScreen` via `p2pkidsmarketplace://billing-history` (test-buyer).

- Header **"Transaction History"** ✅ · 4 rows with description, formatted amount, date, status badge.
- **DB reconciliation — 4/4 exact (R54):**

| UI row | DB (`billing_history`) | Match |
|---|---|---|
| "Kids Club+ Subscription" · $5.99 · Sep 3, 2026 · **FAILED** + "Your payment was declined…" | `95d98ab0` amount **599**, status **failed**, `charged_at` 2026-09-03, `error_message` **verbatim** | ✅ |
| "Kids Club+ subscription renewal" · $5.99 · Aug 27, 2026 · SUCCEEDED | `a3d709c1` 599 / succeeded / 2026-08-27 | ✅ |
| "Kids Club+ subscription renewal" · $5.99 · Jul 27, 2026 · SUCCEEDED | `8e45a7bd` 599 / succeeded / 2026-07-27 | ✅ |
| "Kids Club+ Subscription - Renewal Payment" · $0.00 · Jun 30, 2026 · SUCCEEDED | `4ae4d0d4` amount **0** / succeeded / 2026-06-30 | ✅ |

- **Pull-to-refresh** driven — green refresh spinner captured mid-flight, list reloaded intact.
- **Also evidences SUB-TC-E01 and SUB-TC-E03 on Android** (same live TransactionHistory surface; the FAILED badge + decline copy are E03's assertion).
- Evidence: `K01-identity-spwallet.png`, `06-poll.png`, `K01-pull-to-refresh-mid.png`

### SUB-TC-K02 · Transaction History empty + error/retry — ✅ PASS (Android)

- **Error leg:** armed `payout_fetch_failure=fetch_failure` (read-back alert verified: *"[QA] Toggle Applied … verified read-back: fetch_failure"*) → pull-to-refresh → **"Failed to load billing history"** + green **Retry** pill.
- **Recovery leg:** disarmed (read-back `none`) → tap Retry → error clears, 4-row list reloads.
- **Empty leg:** test-seller (0 billing rows) → receipt icon + **"No billing history yet."** (exact copy).
- **DOC-DRIFT:** the guide's error state says "a receipt icon + error text + [Retry]". The live error branch (`TransactionHistoryScreen.tsx` L118-124) renders **error text + Retry only** — the `Receipt` icon is exclusive to the empty branch (L125-130). Confirmed by contrast: the icon IS present in the empty state.
- **Locator gap (instrumentation ask):** the Retry control is a `ViewGroup label="Retry"` with **no `testID` and no `accessibilityRole`** — resolvable by label only (BP-53 class).
- Evidence: `K02-error-state-settled.png`, `K02-retry-recovered.png`, `K02-after-persona-switch.png`

### SUB-TC-N01 · JoinKidsClub value-prop + web CTA — ✅ PASS (Android)

Header "Kids Club+"; **"Get more out of every trade"**; subheadline verbatim; three benefit rows (**"Earn Swap Points on every sale"**, **"Pay a flat $1.49 fee instead of a percentage"**, **"Spend SP on purchases (up to 50%)"**); web card **"Membership is managed on the web"** with both body lines; CTA **"Join on the web"** (`join-kids-club-button`) + hint "Manage your membership at passitup.com"; footnote verbatim; **no price cards / no in-app purchase UI**. Evidence: `N01-joinkidsclub-header-recheck.png`

### SUB-TC-N02 · JoinKidsClub web redirect — ✅ PASS (Android)

Tapping **Join on the web** opened the external browser. Address bar read **`localhost:3002/join?ema…`**.
- The **user's email query param is present** (`?email=`) → the case's core assertion holds. (Value **redacted** in this report — it is the persona's identifier.)
- **Variance (config, not a defect):** the guide hardcodes `https://passitup.com/join`; the dev build's web-base is `localhost:3002`, which an emulator cannot reach (should be `10.0.2.2:3002`) — the page rendered a load error. Host-aware web-base URL is the recommended follow-up.
- Environment friction: Chrome's first-run "Make Chrome your own" + notifications prompts had to be dismissed first (2 taps).
- Evidence: `N02-web-redirect.png`, `N02-chrome-target-url.png`

### SUB-TC-N03 · Route-alias reachability — ✅ PASS (Android)

Fired the deep-link-only alias `p2pkidsmarketplace://subscription-plans` → rendered **JoinKidsClubScreen** (header "Kids Club+"). Matches the source claim; all four route names are registered in `AppNavigator.linking.config.screens` (verified by grep before firing, per R42). Evidence: `N03-alias-subscription-plans.png`

### SUB-TC-N04 · ContinueKidsClub active variant — ✅ PASS (Android)

🎉 + **"Kids Club+ Active"** + "✓ You're all set" + **"Your subscription is already active and your premium benefits are available."** (verbatim) + benefits list + primary **"Manage Kids Club+"** + secondary **"Go Back"**.
- No `Already Subscribed` alert (the guide's flag that it is unreachable — consistent).
- **Design note (LOW):** this screen renders with **no shared header** at all (no `back-button` / `screen-title` / bell / chat), unlike JoinKidsClub which has the canonical detail header. It supplies its own in-body "Go Back" pill, so the affordance exists — flagged as a header-consistency observation, not a defect.
- Evidence: `N04-continue-kids-club-active.png`

### SUB-TC-N05 · ContinueKidsClub loading state — ✅ PASS (Android, source-confirmed)

`ContinueKidsClubScreen` L117-121 renders `<LoadingSpinner/>` + "Loading..." while `getTrialStatus` resolves. The frame is transient and was **not captured live** (the deep-link→capture window misses it) — **the same accepted limitation recorded on iOS in QA Task 39**; the resolved content rendered on-device this round. Stated explicitly rather than implied.

### SUB-TC-N06 · ContinueKidsClub trial-ending urgency badge — ✅ PASS (Android, ≤7-d branch)

Fixture `qa:r41-trial -- ensure --days-remaining 5` → subscription `trial`, `trial_end_date` **2026-09-21**, `days_remaining 5`, wallet `active`.
- Title **"Continue Kids Club+"** + warning pill **"5 days left in trial"** (amber/warning token family) ✅
- **No** `{trialDays} free days • no charge today` pill ✅ (correct for a trial member)
- Price card $5.99/mo · CTA **"Continue on the web"** · "Maybe later"
- The **>7-d branch** (no countdown badge) remains iOS-verified (QA Task 40); not re-driven.
- Evidence: `N06-trial-badge-retry.png`

### SUB-TC-L01 · Renewal webhook → billing + member state — ✅ PASS (Android, + NEW provider layer)

**First time this case has a provider-side (Stripe) read.** Three layers now agree on the Aug-27 renewal:

| Layer | Evidence | Value |
|---|---|---|
| **UI** (Android) | Transaction History row | "$5.99 · Aug 27, 2026 · SUCCEEDED" |
| **DB** | `billing_history` `a3d709c1` | amount **599**, status `succeeded`, `charged_at` 2026-08-27 |
| **Provider** | `qa:stripe-inspect invoice in_1U92cw4I6kCJlvXoGLADfGFN` | `status: paid`, `amount_paid: **599**`, `subscription: sub_1To5Vg4I6kCJlvXoebIAvLZJ` (= `subscriptions.stripe_subscription_id`), `created` → 2026-08-27, `attempt_count: 1` |

**⚠️ `key_scope=SECRET_KEY_BREAK_GLASS`** — F3 (`STRIPE_QA_READONLY_KEY` is still an `sk_test_…` secret) means this is **break-glass-labelled evidence, NOT restricted-key read-only evidence**. Reported as such per the brief's standing rule.

### SUB-TC-L02 · Payment-failed webhook → retry/grace — ✅ PASS (Android, user-visible leg)

Fixture `qa:payfail -- ensure --retry-count 1` → `status='active'`, `payment_retry_count=1`, `payment_failed_at` 2026-09-16, `current_period_end` 2026-09-21.

Dashboard renders the **Payment Failed** banner: ⚠️ icon · title · **"Your payment was declined. Please update your payment method to keep your subscription active."** · **"Retry 1 of 3 • Next retry in 3 days"** · **[Update Payment]** (destructive) + **Dismiss**.

| Layer | Evidence |
|---|---|
| **UI** | the banner above (`L02-home-settled2.png`) — retry tier and copy DB-exact |
| **DB** | `subscriptions.payment_retry_count=1`, `payment_failed_at` set, `status='active'` (still active at retry 1 — grace only at failure 3, per the R6 model) |
| **Provider** | **Stripe N/A for this leg** — the failing renewal was driven on a since-deleted disposable (DT99); this round verifies the *mobile surfacing*, and the genuine Stripe failing-renewal leg is already PASS via the DT99 live 3-failure cycle (3rd failure → `grace_period` + wallet `grace_period` + 3 critical notifications) |

### SUB-TC-L03 · Invalid webhook signature rejected — 🚫 N/A (Android) · PASS overall

This is a **server/webhook-domain** case with no mobile surface — a platform-specific Android verdict does not apply, and inventing one would be misleading (R80).
The recorded PASS stands (live negative POST → `HTTP 400 INVALID_SIGNATURE`, no mutation — `qa-task22-sub-remainder-2026-09-02`). **Deliberately not re-POSTed:** §5.14 forbids ad-hoc remote-network commands (`curl`/`wget`) without explicit approval, and re-issuing a signed-webhook request is a mutation-capable call, not a read. Flagged as a **named untested leg** with the reason.

### SUB-TC-L04 · Duplicate webhook delivery idempotent — ✅ PASS (Android + table-wide DB)

| Layer | Evidence |
|---|---|
| **UI** (Android) | Transaction History shows **exactly one row per invoice** (4 rows / 4 invoices, no duplicates) |
| **DB** | **0 duplicate `stripe_invoice_id` groups** across the whole `billing_history` table — `SELECT stripe_invoice_id, count(*) … GROUP BY 1 HAVING count(*) > 1` → `[]` |
| **DB (scope)** | 53 rows · 52 distinct invoice ids (the 53rd row has `NULL` invoice id) · **53 distinct `charge_id`s** — `UNIQUE(charge_id)` holds |
| **Provider** | Stripe N/A — idempotency is an app-side/DB property; no provider object asserts it |

This confirms QA Task 36's "two `billing_history` rows for one invoice" MED is still fixed by DT121 — now asserted **table-wide**, not just for one user.

### SUB-TC-L05 · Payout-status webhook updates seller payout history — 🟡 PARTIAL (Android)

| Layer | Evidence | Result |
|---|---|---|
| **UI** | Payout Settings history renders payout rows with amount + status + date + `history-action-<id>` CTA (Round 1 Android drive today; cross-referenced, same build) | ✅ (cross-ref) |
| **DB** | `seller_payouts`: 127 rows — `requires_action` 85 · `processing` 26 · `pending` 11 · **`completed` 3** · `failed` 2 | ✅ |
| **DB (idempotency)** | **0 duplicate `provider_reference_id` groups** across all 127 rows (`GROUP BY … HAVING count(*)>1` → 0) → no second payout row per provider event ✅ | ✅ |
| **Provider** | `qa:stripe-inspect transfer tr_1UChi74I6kCJlvXoCmZ5YSdS` → **`amount: 20424`** = DB `net_amount_cents 20424`, `reversed: false`, `livemode: false`, and **`metadata.payout_id = "082d46d6-c4e0-4e82-8169-1c61764f9ba3"` = the DB row id** | ✅ **AGREE** |

**Why still PARTIAL:** (a) the guide's *failed*-payout UI leg (the ⚠️ failure-state/reason line) was not re-driven this round, and (b) the **live webhook re-drive** (a provider event flipping a row's status) was not performed — only 2 of 127 payouts have a provider reference, and neither belongs to a QA persona, so there is no fixture to flip on demand. Both are named gaps.
**⚠️ `key_scope=SECRET_KEY_BREAK_GLASS`** (same F3 caveat as L01).

### SUB-TC-M07 · Backend contract — attach / detach / retryFailedPayment — 🟡 PARTIAL (both remaining legs STILL BLOCKED)

**Direct answer to the brief's question: FIX-Task-37's `qa-payout-seller` did NOT unblock M07.** Evidence (source read + live DB, not assumption):

- **true-retry-success branch ("Payment Method Added")** — the client calls `retryFailedPayment(userId, { resolveWithoutInvoice: true })`. That branch requires, in order: `payment_retry_count > 0` **AND** `payment_failed_at` set **AND** `stripe_subscription_id` **AND** `stripe_customer_id` present (`retry-failed-payment/index.ts` L112-127) before it can reach the "no open invoice → clear flags → success" path (L138-160).
  **Live DB:** the only persona carrying failure flags is `test-payfail` — `payment_retry_count=1`, `payment_failed_at` set, **`stripe_subscription_id` = NULL and `stripe_customer_id` = NULL** → the EF returns **`MISSING_STRIPE_DATA` (400)**, which is *not* in the client's 3-code list → the UI falls through to the generic **"Success / Payment method added successfully."**, never the asserted **"Payment Method Added"**.
  → **Still fixture-gated.**
- **unauthenticated-remove branch** — needs a mounted Payment Methods screen with no session; not constructible in a signed-in run. **Source-confirmed only.** *(Running the attach flow on a persona solely to reach a 400 guard was deliberately not done: it mutates a shared saved card for no assertion gain.)*
- **Unlock recipe (recommendation, not executed):** a payfail-shaped fixture **with real Stripe ids and no open invoice** — the cheapest reliable enabler; `qa:r41-l02-failing-renewal` also produces a genuine open-invoice retry but is documented as dev-team/owner-approved only.
- Note: the FIX-Task-37 **DEV-TASK-127** fix *was* re-confirmed incidentally — after the earlier attach/remove cycle the screen showed the true empty state on remount (no stale card).

### SUB-TC-F02 · Payout method section (add vs existing) — ✅ **PARTIAL → PASS (Android)**

**The single most valuable side-effect of the brief's question.** Round 1 recorded F02's "with method" leg as fixture-gated because *no QA persona held a `seller_payout_methods` row*. FIX-Task-37 item 4 created exactly that fixture, and it is **still live**:

```
npm run qa:start-state -- qa-payout-seller
  user  a1234567-0000-0000-0000-0000000000f2
  balance  avail 5000¢ · pending 0¢ · lifetime 5000¢
  method   stripe_connect PRIMARY verified=true onboard=true payouts=true acct=acct_1UGKzW3uefDqBl4z
  connect  submitted=true payouts=true charges=true due=[] disabled=—
```

On-device (Android, `payout-settings`):
- Hero **Available Balance $50.00 / Pending $0.00 / Lifetime Earned $50.00** → **3/3 DB-exact** (5000¢ / 0 / 5000¢)
- **PAYOUT METHOD renders the EXISTING method**: "**Stripe** / `acct_****Bl4z`" + **"✓ Verified & Active"** + primary radio + kebab — **not** the `add-bank-row` empty state ✅ *(the mask suffix `Bl4z` matches `acct_1UGKzW3uefDqBl4z` exactly)*
- "**+ Add Another Method**" ✅ · PAYOUT HISTORY: **"No payouts yet"** ✅ (re-confirms F05)
- **Consequence:** the G/H withdraw family (H02/H03/H05, G04/G05/G08/G09) is now drivable on a clean controlled balance — recommended as the next round's highest-value work.
- Evidence: `F02-payout-settings-with-method.png`

---

## 4 · Findings

### F1 · LOW-MED — JoinKidsClub header renders a ghost notification bell

`src/screens/subscription/JoinKidsClubScreen.tsx` (screen family also covering `SubscriptionPlans` / `KidsClubOverview` aliases).

- The header renders an **empty 40px grey circular disc** where the notification bell normally sits, immediately left of the working chat button.
- **The AX tree for this screen exposes NO notifications control at all** — `header-notifications-btn` and its bell `SvgView` are **absent** (the tree jumps from `screen-title` straight to `header-chat-btn`).
- **Contrast (same session, same build):** the Transaction History and Home headers both expose `header-notifications-btn` + `phosphor-react-native-bell-bold` and render the bell correctly.
- Reproduced on **two persistent frames** (not a transient load artifact).
- **Impact:** an empty grey circle beside a live control reads as a broken or disabled affordance, and it is invisible to assistive tech. Cosmetic + affordance, no functional loss.
- Evidence: `N03-alias-subscription-plans.png` + `N01-joinkidsclub-header-recheck.png` + the AX tree capture.

### F2 · LOW — DOC-DRIFT: K02 error state has no receipt icon
Guide: "Error: a receipt icon + error text + [Retry]". Live (`TransactionHistoryScreen.tsx` L118-130): the error branch is text + Retry; the `Receipt` icon belongs to the empty branch only. Guide text should be corrected (or the icon added for consistency).

### F3 · LOW — Locator gap: K02 Retry control
`ViewGroup label="Retry"` — **no `testID`, no `accessibilityRole="button"`**. Recommend `transaction-history-retry-button` + `accessible`/role.

### F4 · LOW-MED (config, not a defect) — N02 web host is emulator-unreachable
The CTA opens the dev web-base `localhost:3002/join?email=…`; from an emulator `localhost` is the device, so the page fails to load (`Reload`/`Details` error surface). The `?email=` param is correctly passed. Recommend a host-aware web-base (`10.0.2.2` on Android emulators) so the dev flow completes. The guide's hardcoded `passitup.com` is production copy.

### F5 · OBSERVATION (not filed) — warm account switch can wedge the Payment Methods fetch
Warm `qa-login-as` while `PaymentMethods` was mounted → `[subscription] 📤 Fetching payment method...` logged and **never resolved** (spinner >1 min, no error line, no completion line). **Terminate + cold relaunch resolved it instantly** (R101 signature: it did **not** reproduce on a fresh process, so per R101/R92 this is an in-process wedge and is **not filed as a defect**). It touches the FIX-Task-37 item-1 cache/`onAuthStateChange` path, so it is flagged for dev attention with the exact repro.

### F6 · OBSERVATION (not filed, R100) — platform-wide legacy subscription/wallet state spread
Recorded for the dev team because it is large, but **not filed** (no writer named; out of case scope; FIX-Task-37 already documents the pre-R6 legacy class):
`subscriptions` 5849 rows (`free` 3636 · `expired` 1431 · `grace_period` 446 · `trial` 300 · `active` 34 · `cancelled` 1 · `grace` 1) vs `sp_wallets` 5652 rows (`active` 4013 · `frozen` 1266 · `grace_period` **373**). The R6 reconcile snippet referenced in FIX-Task-37 remains the remediation path.

---

## 5 · Three-layer money verification (per applicable case)

| Case | UI | DB | Provider (Stripe) |
|---|---|---|---|
| **L01** | ✅ renewal row renders | ✅ `billing_history.a3d709c1` 599/succeeded | ✅ `in_1U92cw…`: `paid`, `amount_paid 599`, sub id matches — **AGREE** · `key_scope=SECRET_KEY_BREAK_GLASS` |
| **L02** | ✅ "Retry 1 of 3" banner | ✅ `payment_retry_count=1` + `payment_failed_at` | **N/A** — failing renewal lives on a deleted disposable (DT99 already drove the live leg) |
| **L04** | ✅ one row per invoice | ✅ 0 dup invoice groups / 53 rows | **N/A** — app-side idempotency property |
| **L05** | ✅ history statuses (Round 1, same build) | ✅ 127 rows; 0 dup `provider_reference_id` | ✅ `tr_1UChi7…`: `amount 20424` = DB net; `metadata.payout_id` = DB row id — **AGREE** · `key_scope=SECRET_KEY_BREAK_GLASS` |
| **F02** | ✅ hero 3/3 + method card | ✅ 5000¢/0/5000¢ + verified primary method | **N/A** — no withdrawal executed this round (no money moved) |
| **K01/K02** | ✅ list/empty/error | ✅ 4/4 rows exact | **N/A** — display-only, no money movement |

**No DB↔Stripe disagreement was found this round.** Both provider reads carry the break-glass label (F3), so they are **not** quotable as restricted-key read-only evidence.

---

## 6 · Perceived load times (§5.7)

Wall-clock, ±polling precision, simulator/emulator — **not a formal performance profile**.

| Transition | Elapsed | Flag |
|---|---|---|
| `qa-login-as` switch → role restore | ~2 s | — |
| Deep link → target screen rendered | <1 s | — |
| `billing-history` cold app start → bundle load → screen | **~35 s** | ⚠️ **dev cold-start bundle load** (environment artifact of the dev client, not an app-behavior measure) |
| Transaction History error → Retry → recovered list | <1 s | — |
| `payout-settings` deep link → hero rendered | <1 s | — |

**No in-app transition exceeded 3 s.** The single flagged entry is the dev-build cold bundle load.

---

## 7 · Friction log

1. **First deep link after `qa-login-as` is reliably dropped (3×).** The app restores a retained route instead (R96 family). Workaround: re-fire once. Recommend the QA deep-link handler queue until the auth change settles.
2. **Chrome stays in the task stack** and steals `BACK` after N02 — the app had to be re-launched to the foreground.
3. **Expo Dev Launcher `Recently opened` keeps a stale `http://10.0.0.151:8082`** entry (R63a residue) — first launch after a failed deep link landed on the launcher.
4. **`sp-wallet` appeared dead once** — it failed after an auth switch, then worked on the clean retry (same root cause as #1; **not** a dead link — recorded to avoid re-filing).
5. `qa:ax-tree` inline truncation and `logcat` buffer rotation: `adb logcat -d -s ReactNativeJS` returned an empty buffer twice mid-run (entries rotated away); screenshots carried the evidence instead.
6. `billing_history.status` is a Postgres **enum** (`billing_status`) — `string_agg(DISTINCT status, ',')` throws 42883; cast `status::text` (1 retry, R7).
7. `subscriptions.subscription_tier` does **not** exist (42703 — matches the `tier —` the start-state helper prints). One retry with the column dropped.

---

## 8 · App state left behind

| Item | State |
|---|---|
| Session | Signed in as **qa-payout-seller** on the emulator |
| Dev toggles | `payout_fetch_failure` armed → **disarmed + read-back verified** (`none`). No other toggle armed. |
| `test-trial` | Fixture re-applied (`trial`, `trial_end_date` 2026-09-21, 5 days) — **left in place** for reuse; `qa:r41-trial -- reset` to clear |
| `test-payfail` | Fixture re-applied (`active`, `payment_retry_count=1`, `payment_failed_at` 2026-09-16) — **left in place**; `qa:payfail -- reset` to clear |
| `qa-payout-seller` | **Unchanged** — verified primary Connect method + $50.00 balance still intact (no withdrawal driven) |
| `test-buyer` / `test-seller` | Unchanged (no card edits; `test-buyer` retains its MASTERCARD •••• 4444) |
| DB writes | **None.** Every DB interaction this round was read-only. |
| Chrome | Left open on the failed `localhost:3002/join` page (harmless) |

---

## 9 · Known gaps / not tested (explicit per-case reasons)

| Case | Missing leg | Why (code/fixture named, not "deferred") |
|---|---|---|
| **M07** | true-retry-success ("Payment Method Added") | `test-payfail` has NULL `stripe_subscription_id`/`stripe_customer_id` → EF `MISSING_STRIPE_DATA` guard fires before the `resolve_without_invoice` branch. Needs a payfail-shaped fixture **with real Stripe ids**. |
| **M07** | unauthenticated-remove | Requires a session-less mounted screen; not constructible. Source-confirmed. |
| **L05** | live webhook status-flip re-drive | Only 2 of 127 payouts carry a provider reference; neither belongs to a QA persona → no fixture to flip. |
| **L05** | failed-payout ⚠️ reason line in the history UI | Not re-driven this round (statuses render; the failure-reason row variant was not exercised). |
| **L03** | live negative-signature re-POST | §5.14 forbids ad-hoc remote-network commands without explicit approval; the recorded PASS stands. |
| **N05** | live "Loading..." frame | Transient; missed by the deep-link→capture window (same accepted limitation as QA Task 39). |
| **N06** | >7-day branch | iOS-verified (QA Task 40); only the ≤7-d branch re-driven on Android. |
| **I07** | positive reserved-SP leg | **Table-wide proof it is still gated:** `SELECT count(*) FROM sp_wallets WHERE reserved_sp > 0` → **0** (max 0). No wallet anywhere holds reserved SP. |
| **I04** | expiring-soon positive alert | Needs a ≤30-day expiry batch; no such fixture was identified — **not attempted** rather than asserted as a zero I cannot evidence (R105). |
| **J04** | new-earning-event leg | Requires a new SP-earning event (a completed trade) — not created this round. |
| **C04 / C05** | clock-gated legs | Not attempted (subscription-period timing fixtures). |
| **D06 / D07** | clock/push-gated | Unchanged — BLOCKED on fixture. |
| **H02 / H03 / H05, G04 / G05 / G08 / G09** | Android verdicts | **Now unblocked** by the live `qa-payout-seller` fixture but not driven this round (out of the round's priority list) — recommended for the next session. |

---

## 10 · What this round proves

Groups **K** and **N** now hold complete Android verdicts, Group **L** moved from "no Android evidence" to three cases with **provider-layer (Stripe) confirmation** and a fourth with table-wide idempotency evidence, and the brief's central fixture question is answered with a concrete result: FIX-Task-37's `qa-payout-seller` **does** clear a previously-blocked leg (F02) and unblocks the whole G/H withdraw family — while it does **not** clear M07, whose blocker is now named to the exact EF guard and the exact missing columns. Zero FAIL, zero money-state writes, every displayed number reconciled to a named query.
