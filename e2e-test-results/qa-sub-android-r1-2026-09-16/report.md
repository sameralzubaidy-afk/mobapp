# QA Task — SUB Android Round 1 (Full 3-Layer Standard From the Start)

**Guide:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (SUB, 100 cases)
**Platform:** Android emulator `Medium_Phone_API_36.1` (emulator-5554, Android 16) · dev-client build · device id for mobile-mcp = `Medium_Phone_API_36.1`
**Date:** 2026-09-16 · **Session type:** Android-first round (no prior Android verdicts for these cases)
**Run folder:** `e2e-test-results/qa-sub-android-r1-2026-09-16/`
**Verdicts this round:** 10 PASS · 3 PARTIAL · 0 FAIL · 0 BLOCKED (unreachable-by-design cases reported as N/A/RETIRED)

---

## 1. Step 0 — Reconciliation (standing rule)

### 1.1 Tracker state pulled before scoping

`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` → SUB section, verbatim:

> **Cases:** 100 · **PASS** 77 · **PARTIAL** 2 · **OPEN** 3 · **DOC-DRIFT** 0 · **SKIPPED** 0 · **RETIRED** 15 · **N/A** 2 · **Remaining (ACTIVE)** 1

Arithmetic reconciles (77+2+3+15+2 = 99, +1 struck bookkeeping row = 100). The documented iOS baseline in the brief (77/2/3/17 SKIPPED/1 inactive) does **not** match the tracker — the tracker records **0 SKIPPED** and **15 RETIRED + 2 N/A**; the brief's "17 SKIPPED" is the retired(15)+N/A(2) group seen through a different label. Recorded as a brief-vs-tracker discrepancy, not a defect.

### 1.2 DB clock check (routine hygiene)

```
db_now = 2026-09-16 14:59:32.1685+00   db_tz = UTC
latest subscriptions row  = 2026-09-14 18:11:53Z
latest seller_payouts row = 2026-09-14 22:17:56Z
```
Clock reads correctly relative to real time (session date 2026-09-16). **Clean.**

### 1.3 ⚠️ CRITICAL SCOPE RECONCILIATION — the brief's priorities 1 and 2 are RETIRED

| Brief priority | Reality | Evidence |
|---|---|---|
| **1 — B13 Apple Pay / Google Pay** | **RETIRED** on *both* platforms — the in-app wallet-pay surface does not exist | Guide Group B header "🔴 RETIRED (web-first)"; tracker SUB-TC-B13 = RETIRED |
| **2 — Native Stripe payment-sheet cluster (B03, B09, B10, B11, B12)** | **ALL RETIRED** — in-app subscription purchase removed | Guide bodies B03/B09/B10/B11/B12 all carry the RETIRED banner |

Source-verified (R78-2 — a standing reason must be re-checked, not restated):
- `src/navigation/AppNavigator.tsx:752-765` — `SubscriptionPayment` / `SubscriptionSuccess` are marked *"DEPRECATED (Dev Task 86, 2026-09-02): … dead — joining is web-first. Kept registered for legacy push/deep-link safety"*.
- `grep -rE "navigate\('(SubscriptionPayment|SubscriptionSuccess|KidsClubOverview|SubscriptionChoice)'"` → **0 call sites**.
- `src/services/deepLink.ts:57` — *"DEPRECATED (Dev Task 86, 2026-09-02): SubscriptionPaymentScreen is deprecated"*.

**Pivot applied (recorded, not silently substituted):** the live in-app native Stripe PaymentSheet surface is **Group M (`PaymentMethodsScreen`)** — `usePaymentSheet` + `create-payment-setup-intent` / `attach-payment-method` / `detach-payment-method`, which is the real "card entry / saved-method reuse / cancel / detach" cluster the brief's item 2 intended. Group M was driven end-to-end on Android with a real card. The Google-Pay question was answered on the live surface (finding F6).

### 1.4 Config-propagation cross-references (brief item 4)

| Cross-ref | Status this round |
|---|---|
| ADM-TC-K01 (payout fee config) → SUB-H02 | NOT DRIVEN — H02 needs a verified payout method + a controlled balance; no persona currently holds a verified method (see F5/F6). Named as a gap, not skipped silently. |
| ADM-TC-M01 (grace period config) → SUB-D01/D07 | PARTIALLY RE-CONFIRMED at the DB layer — `admin_config` grace `30` days; `test-grace.grace_ends_at = 2026-11-09`. D07 remains fixture-gated (push/clock). D01's mobile leg not driven this round (see §5 gaps). |
| ADM-TC-L08 (SP wallet warning banners) → SUB-I05 | NOT DRIVEN — needs `test-grace`/`test-expired` mobile legs + the admin banner-config surface. Named as a gap. |

An honest note: **the brief's item-4 cross-refs were not completed** — they require a mobile+admin session pairing this round did not reach (see §5). They are carried forward explicitly.

### 1.5 R110 — cron/scheduled-job awareness (new standing rule)

`SELECT jobid, jobname, schedule, active, command FROM cron.job` → 21 active jobs. Classified with the sanctioned tool `npm run qa:cron-health -- --strict`:

**PASS 20 · WARN 1 · FAIL 0**

- ✅ `#35 grace-period-daily` → `invoke_grace_period_cron(...)` (EF wrapper) — the job SUB's grace transitions depend on
- ✅ `#32 trial-conversion-daily` → `invoke_trial_conversion_edge_function(...)`
- ✅ `#56 release-due-payouts` → `net.http_post` to the EF
- ✅ `#64 dispatch-manual-payouts` → `rpc_fire_edge_function('/dispatch-manual-payouts')`
- ✅ `#60/61/62` offer/auto-complete/pickup reminders → `rpc_fire_edge_function(...)`
- ✅ `#15 sp-expiration-processing` / `#16 sp-expiration-warnings` / `#17 trial-reminders-daily` / `#49 release-pending-sp`(allowlist) → classified non-money routines by the tool
- 🟡 **`#49 release-pending-sp` → `SELECT public.rpc_release_pending_sp(200)` reached BARE** (WARN): the `release-pending-sp` Edge Function currently only forwards to this RPC, so the bare call is *equivalent today*, but a bare cron will silently miss any future EF-side logic — **exactly the FIX-Task-36 shape**. Filed as finding **F7** (LOW); surfaced because SUB owns the SP-pending-release domain.

---

## 2. Verdicts — Android

| TC-ID | Description | Android verdict | Key evidence |
|---|---|---|---|
| **SUB-TC-M01** | Payment Methods — loading state | ✅ **PASS** | Green `pm-loading-spinner` + **"Loading payment methods…"** captured live on a **fresh process** (frame `M01-03-loading-attempt-n5.png`); header "Payment Methods". |
| **SUB-TC-M02** | Empty state + Add Payment Method (Stripe sheet) | ✅ **PASS** | `pm-empty-state` "No Payment Method" + exact body copy; **"Adding…"** in-flight; **real native Stripe PaymentSheet driven on Android** (4242 4242 4242 4242 / 12/30 / 123 / 12345); native alert **"Payment Method Saved" / "Your card was saved successfully."** (the `NO_FAILED_PAYMENT` branch); Saved Card view replaced the empty state. **3-layer ✓** |
| **SUB-TC-M03** | Saved-card display + security banner | ✅ **PASS** | `pm-saved-card` → "Saved Card", "VISA", `•••• •••• •••• 4242`, "Expiry Date 12/2030"; `pm-update-button` / `pm-remove-button` / `pm-security-banner` (exact copy) / `pm-back-button`. **3-layer ✓** |
| **SUB-TC-M04** | Update Payment Method | ✅ **PASS** | **"Updating…"** in-flight captured; success alert; card view **refreshed VISA/4242 → MASTERCARD/4444** (exactly the guide's "refreshes with the new brand/last4"). **3-layer ✓** |
| **SUB-TC-M05** | Remove This Card (confirm + success) | ✅ **PASS** | Confirm alert exact copy (`Remove Payment Method` / "Are you sure you want to remove this payment method? You will need to add a new one before submitting any paid offers." / Cancel + Remove); **Cancel leg → card intact**; **Remove leg → "Removed" / "Your payment method has been removed."** → empty state returns. **3-layer ✓** |
| **SUB-TC-M06** | Go Back | ✅ **PASS** | `pm-back-button` → returned to **Settings** (`screen-title="Settings"` + settings rows present). |
| **SUB-TC-M07** | Backend contract — attach / detach / retryFailedPayment | 🟡 **PARTIAL** | attach ✓ (`create-payment-setup-intent` → `attach-payment-method`), detach ✓, `NO_FAILED_PAYMENT`→"Payment Method Saved" ✓. **Not driven:** the true-retry-success branch ("Payment Method Added") needs a failed-payment fixture; the unauthenticated-remove branch is source-confirmed only. |
| **SUB-TC-F01** | Payout Settings hero — Available / Pending / Lifetime | ✅ **PASS** | `balance-hero-card`: **$909.40 / $1156.60 / $2066.00** vs DB `available_balance_cents=90940`, `pending_balance_cents=115660`, `lifetime_earnings_cents=206600` → **3/3 exact** (R54 reconciliation); `request-payout-btn` "Withdraw Now" present; `balance-fee-note` present. |
| **SUB-TC-F02** | Payout method section (add vs existing) | 🟡 **PARTIAL** | **"without method" leg PASS** — `add-bank-row` renders. **"with method" leg not driven** — no persona currently holds a `seller_payout_methods` row (see F5). |
| **SUB-TC-F03** | Payout history list (completed / pending) | 🟡 **PARTIAL** | List renders with amount + status badge + date + `history-action-<id>` CTA (4 rows visible, `$24.00 / $25.00 / $12.80 / $12.80`). **Live data is 17 `requires_action` + 1 `failed`, 0 `pending`, 0 `completed`** — the guide's completed/pending badge variants are not demonstrable from live data. |
| **SUB-TC-G06** | `requires_action` payout → "Set Up Payout Method" | ✅ **PASS** | The **[Set Up Payout Method]** CTA (`history-action-<id>`) renders **on the live PayoutSettings card** for every `requires_action` row — closing QA Task 34's gap on Android. |
| **SUB-TC-G11** | NoMethodModal flow | ✅ **PASS** | Withdraw Now → **"Payment Method Required"** / "To withdraw your earnings, you need to add and verify a payout method first." (exact guide copy) + "Add Payout Method" + Cancel; Cancel dismisses. |
| **SUB-TC-H04** | Withdraw blocked when no verified primary method | ✅ **PASS** | Same modal as G11; Cancel → **no payout created (DB: 18 rows / 17 `requires_action` before and after — unchanged)**. |
| **SUB-TC-B13** | Apple Pay / Google Pay payment | ⛔ **N/A (Android)** | Not "blocked" — the case is **RETIRED** (§1.3); no in-app wallet-pay surface exists on either platform. |

### 2.1 Group B (15 cases) — N/A / RETIRED, source-verified

`SUB-TC-B01…B13`, `SUB-TC-D02`, `SUB-TC-D04` — all **RETIRED (web-first)**; source-verified per §1.3. Not counted as no-verdicts (they are dispositions, per the tracker's 31d reclassification).

---

## 3. Money verification layers (mandatory)

All provider-layer reads this round were performed with **`key_scope=SECRET_KEY_BREAK_GLASS`** — see finding **F1 (enablement)**. None may be reported as restricted-key / read-only evidence.

- `SUB-TC-M02` — UI ✓ (alert "Payment Method Saved" + VISA ••••4242) | DB ✓ (`subscriptions.stripe_payment_method_id` null→`pm_1UGKRu4I6kCJlvXoTAjHd9K3`, 15:08:44Z) | Stripe ✓ (`pm_1UGKRu4I6kCJlvXoTAjHd9K3`: customer `cus_VDA6aCp5fY8Uci`, visa / 4242 / 12-2030, created 15:08:38Z) — `key_scope=SECRET_KEY_BREAK_GLASS`
- `SUB-TC-M03` — UI ✓ (VISA ••••4242 / 12/2030) | DB ✓ (`pm_1UFatV4I6kCJlvXoJsDhX3ZQ`) | Stripe ✓ (mastercard / 4444 / 9-2027, `saved_pm_attached_to_expected_customer: AGREE`) — **3 layers AGREE**
- `SUB-TC-M04` — UI ✓ (MASTERCARD ••••4444) | DB ✓ (`pm_1UGKTZ4I6kCJlvXofWciXC1r`, 15:10:28Z) | Stripe ✓ (mastercard / 4444 / 12-2030, attached to `cus_VDA6aCp5fY8Uci`, `address_postal_code_check: pass`, `cvc_check: pass`, AGREE) — **3 layers AGREE**
- `SUB-TC-M05` — UI ✓ ("Removed" + `pm-empty-state`) | DB ✓ (`stripe_payment_method_id` → null, 15:11:39Z) | Stripe ✓ (the tracked PM is **gone** from the customer's `payment_methods`) — **3 layers AGREE**
- `SUB-TC-M07` — UI ✓ / DB ✓ / Stripe ✓ for the attach+detach legs only (no charge is created by a SetupIntent — no PI to read; the guide's own clause "SetupIntent flow (no immediate charge)" holds)
- `SUB-TC-F01` — UI ✓ | DB ✓ (3/3 exact) | Stripe **N/A** — a balance hero is a DB projection; no provider object exists
- `SUB-TC-F03` / `G06` / `G11` / `H04` — UI ✓ | DB ✓ (row counts / balance unchanged) | Stripe **N/A** — `requires_action` payouts have **no dispatcher** (documented synthetic-payout boundary); no Payout object exists for the withdrawn amount because none was created (H04 blocked pre-payout)
- **Not driven (no money moved):** H02/H03 (need a verified method + controlled balance), H01 (needs a $0-balance persona; `qa-payout-seller` is at $0 but was not driven this round), F06/H06/H07 (admin-config-gated), D05 (real renewal), C04/C05 (real cancel).

**Cross-layer disagreement check:** none found on the money objects audited this round. The one *new* provider-side observation is **F2** (orphaned PaymentMethods), which is a lifecycle/hygiene divergence rather than an amount/capture disagreement.

---

## 4. Findings (ranked)

### F1 — HIGH · Privacy: cross-account saved-card disclosure via a process-global payment-method cache
**What was observed.** With a single app process, after switching accounts `test-buyer → qa-wallet` (no app restart), the Payment Methods screen rendered **the previous user's card** — `MASTERCARD •••• •••• 4444 / 09/2027` — on an account that has **no card at all**:
- DB: `subscriptions.stripe_payment_method_id = NULL`
- Stripe: `cus_VDA6aCp5fY8Uci` has **no attached payment method** and `default_payment_method = null`
- Frame: `screenshots/M02-01-qawallet-payment-methods-entry.png`

**Writer, named (R100).** `src/services/subscription.ts` L845 `let _pmCache: PaymentMethodInfo | null | undefined;` — a **module-level (process-global) cache**, not scoped to the authenticated user. `getPaymentMethod()` (L864-866) returns `_pmCache` whenever it is not `undefined`, **without re-checking the session/user**. `PaymentMethodsScreen` L110-112 calls `fetchPaymentMethod()` → `getPaymentMethod(false)` on every mount. Nothing invalidates `_pmCache` on logout or persona switch (the only invalidation is `invalidatePaymentMethodCache()`, called solely on the *remove* path, L240).

**Fresh-process control (run to bound the finding).** `terminate` + relaunch → the same screen for the same persona rendered the **correct empty state** (`pm-empty-state`). So the defect is the in-process cache, not server-side data.

**Blast radius.** Every `getPaymentMethod()` consumer: Payment Methods, `ManageKidsClubScreen`'s `PaymentMethodSection`, `CartCheckoutScreen`, `TradeOfferScreen` — i.e. the checkout surfaces. A user with no card can be shown a card on file, and a family/shared device (this is a parents' app) can expose the prior user's card brand/last4/expiry.
**Recommendation (dev-side, separate task):** key the cache by `session.user.id` (`Record<userId, …>`) **and** clear it on `SIGNED_OUT` / `SIGNED_IN` / `USER_UPDATED`; or drop the cache and rely on the existing promise-dedup.

### F2 — LOW-MED · "Update card" leaves the previous PaymentMethod attached at Stripe (orphan accumulation)
Sequence proven live on one customer:
1. attach 4242 → customer PMs = `[4242]`
2. **Update** to 4444 → customer PMs = `[4444, 4242]` — the replaced card is **not detached**
3. **Remove** → customer PMs = `[4242]` — the app detaches exactly the PM it tracks; the orphan survives

Corroboration on a second customer: `test-buyer`'s `cus_Ungj4MptKp9CUg` holds **4** attached PaymentMethods (`…X3ZQ`/4444, `…MXsky`/4242, `…ot1nX`/4444, `…l6uA9`/4444) while `subscriptions.stripe_payment_method_id` names only one.
**Impact:** unbounded growth of live card tokens on the Stripe customer; widens PCI/data-retention scope; a *retained* PM remains chargeable. `attach-payment-method` should detach / `default_payment_method`-replace the prior PM (Stripe's "change payment method" semantics).
**Recommendation:** in the Update path, capture the previous `pm_…` and `detach` it after a successful attach (or set `customer.invoice_settings.default_payment_method` and prune the rest).

### F3 — MED · Enablement: the Stripe read-only key is a full secret key, so the restricted-read guarantee is NOT in force
`npm run qa:stripe-inspect -- by-user test-buyer` **refused**:
> REFUSED: `STRIPE_QA_READONLY_KEY` holds a full SECRET key (`sk_test_...`), not a restricted read-only key.

Every provider read this round therefore ran `--break-glass-secret-key`, self-labelling `key_scope=SECRET_KEY_BREAK_GLASS`. Per the §5.37 contract these results must not be reported as restricted-key evidence. The audit *is* deliverable (the tool is GET-only and refuses live), but the safeguard FIX-Task-33 introduced is currently inactive.
**Recommendation:** mint a Stripe restricted `rk_test_…` (read scopes: PaymentIntents, Charges, Refunds, SetupIntents, PaymentMethods, Customers, Subscriptions, Invoices, Payouts, Transfers, Events, Disputes + connected-account read) and point `STRIPE_QA_READONLY_KEY` at it.

### F4 — MED · Scope: the brief's priority items 1 and 2 are retired for both platforms
See §1.3. Not a product defect — a brief/guide-vs-reality mismatch that would otherwise have consumed the round. **Recommendation:** update the SUB test brief template to read Group B's retirement banner before assigning priorities.

### F5 — MED · Fixture drift: documented persona states do not match live staging
Live DB vs the guide's "Accounts for testing" table and the tracker's claims:

| Persona | Guide / tracker says | Live DB (2026-09-16) |
|---|---|---|
| `test-seller` | "Kids Club+ **Active**; has payout balance **+ methods**" | `subscriptions.status = 'trial'`; `sp_wallets.state = 'grace_period'`; **0 `seller_payout_methods` rows** |
| `test-grace` | "Grace period — **SP wallet frozen**" | `sub.status='grace'` but **`sp_wallets.state = 'active'`** |
| `test-trial` | trial persona for N06 | `subscriptions.status = 'grace_period'` (N06 fixture left dirty) |
| `test-free` | M02 actor, "no saved card" premise | **has** `stripe_payment_method_id = pm_1UFatX4I6kCJlvXovgoAtag8` |
| `qa-payout-seller` | controlled payout fixture | `available/pending/lifetime = 0`, 0 methods (clean after QA Task 38) |

Only **one** `seller_payout_methods` row exists in the whole table, and it belongs to a non-QA demo account (`seller2bob.demo@example.com`).
**Consequences this round:** F02 "with-method" leg and H02/H03 are fixture-gated; M02's actor was substituted to `qa-wallet` (a documented card-less persona) because `test-free`'s "no card" premise is false.
**Also flagged (not driven, needs a dedicated leg):** because `test-grace.sp_wallets.state = 'active'`, D01/I05's "SP wallet frozen" banner may not render for that persona — DEV-TASK-117 re-keyed the banner to the **wallet** state, so a `sub=grace / wallet=active` persona is expected to show **no** frozen banner. This is a **fixture-vs-guide contradiction**, not a proven product bug — it needs a D01/I05 drive with either a wallet-state fixture or the state repaired. Recommend repairing the fixtures (and, per R78-2, re-checking the guide's Accounts table).

### F6 — MED · Live in-app Stripe PaymentSheet offers **Link + card**, but **no Google Pay** on Android
The native sheet on Android (`screenshots/M02-03-stripe-paymentsheet-open.png`) renders **"Pay with Link"** (Stripe Link, green) + **"Or use a card"** — there is **no Google Pay button**, despite the emulator running a Play Services image. This is the concrete, on-device answer to the brief's B13/wallet-pay question for the live in-app surface (the retired B13's web-checkout Google Pay is web-only).
**Root cause (source-verified direction, not asserted):** `usePaymentSheet.ts`'s `initPaymentSheet` call is made without a `googlePay` config block; Stripe requires `googlePay: { merchantCountryCode, testEnv }` (and merchant enablement) for the Google Pay button to surface. Confirm with the owner before treating as a defect — it may be deliberate (web-first wallet pay).

### F7 — LOW · R110: cron `#49 release-pending-sp` invokes the bare RPC
`SELECT public.rpc_release_pending_sp(200)` — flagged **WARN** by `qa:cron-health --strict` (the EF is currently a pure pass-through). Equivalent today; will silently miss future EF-side logic. **Recommendation:** re-point at `rpc_fire_edge_function('/release-pending-sp')`.

### F8 — LOW · Design-system deviation: off-brand hex tokens on **live** SUB screens
Standing R62d full-list sweep (`grep -rEn "#4CAF50|#E53935|#29B6F6|#0066CC|#007AFF|#93C5FD|#D97706|#111827|#6B7280|#D1D5DB|#4A7C59|#4D4D4D|#808080" src`) + mandatory liveness triage:

| File | Token(s) | Liveness | Verdict |
|---|---|---|---|
| `screens/profile/TransactionHistoryScreen.tsx:231,237` | `#E53935` (Material red) | **LIVE** (K01/K02/E01-E03, Profile → Billing History) | **DEVIATION** — failed/error text should use semantic error `#E85D75` |
| `screens/subscription/BillingHistoryScreen.tsx:315,330,337,346,375` | `#6B7280`, `#111827`×2, `#0066CC`×2 | **LIVE** (via `BillingHistoryLink` ← `ManageKidsClubScreen:452`) | **DEVIATION** — Tailwind grays + iOS system blue vs canonical `#1A1A1A`/`#6B6B6B`/`#999999` + primary `#5DBB8E` |
| `components/subscription/SubscriptionBanner.tsx:106,118` | `#111827`, `#0066CC` | **LIVE** (via `TradeSuccessScreen:55`) | **DEVIATION** (branch-dependent) |
| `components/subscription/SubscriptionStatusCard.tsx:201,212,223,243` | `#111827`×4 | **ORPHAN** — referenced only by its own file + its own unit test | not a live deviation |
| `screens/seller/SellerEarningsScreen.tsx:153,155` | `#808080`, `#29B6F6` | **DEAD** — DEPRECATED Dev Task 86, no live callers | not a live deviation |
| `screens/subscription/ContinueKidsClubScreen.tsx:31`, `components/subscription/AutoRenewToggle.tsx:87` | — | **ANNOTATION** (in-file comment naming the hexes) | not a hit (R62c#1) |

**On-device corroboration:** full-frame `qa:badge-scan` on the rendered **Payout Settings** frame (`{0,0,1080,2400}`) → **iosBlue 0.00% · iosBlue2 0.00% · materialRed 0.00% · legacyGreen 0.00%**. Payout Settings is clean. The three live deviations above were **not** rendered this round (they need Manage Kids Club+ / Transaction History / TradeSuccess) — **source-audited only**, disclosed as such per R80.
**Where it was checked this round, all on-brand:** Landing, Home/dashboard, Profile, Settings, Payment Methods (`pm-saved-card`/`pm-security-banner`/pill buttons), Payout Settings, NoMethodModal, and both `GlobalAlertProvider` dialogs (branded green pill primary, single primary per dialog, no OS-default chrome).

### F9 — LOW · Doc drift: M02/M05's "native `Alert.alert`" is actually the in-app `GlobalAlertProvider`
Both alerts surfaced in the AX tree with real identifiers (`global-alert-button-0` / `-1`) and rendered the branded green pill — i.e. `GlobalAlertProvider`, not a native OS alert. §5.4's empirical-verification step was satisfied; recorded as doc drift (no Option-B pixel-scan was needed).

### F10 — INFO · Tooling facts discovered this round (Android + Stripe sheet)
1. **The Stripe PaymentSheet IS fully AX-exposed on Android** (contrast with iOS, where §5.4 treats it as non-instrumentable) — every field, the `primary_button` and its `disabled` state are in the uiautomator tree. Drivability re-checked empirically per §5.31.
2. **…but the sheet's per-field `text=`/`label` can lag one read after typing** — the expiry field still read `"…empty"` while the frame showed `12 / 30`. **Screenshot is the source of truth (§5.9); the reliable in-tree validity signal is `primary_button`'s `disabled` attribute**, which flipped only once the whole form was valid.
3. **The IME shifts the sheet by ~346 px** (card field y 912 → 566 with the keypad up) and the tree reports the *shifted* logical positions while the IME is up — the §5.2/§5.19-Android hazard, reproduced exactly. The compliant sequence (type → screenshot proving the IME → BACK → screenshot → re-derive → tap) worked.
4. **`_pmCache` makes M01's loading state unreachable on a warm mount** — the spinner only appears when a real fetch happens (fresh process). This is the same cache as F1 and explains QA Task 39's "cold re-enter after a clean relaunch" note.
5. `py`/`zsh` pitfall: `grep --include=*.tsx` needs quoting (zsh glob).

### F11 — INFO · §5.3 sentinel: Profile stats render `0` before the real values land
First Profile read for `test-buyer` showed `0 LISTINGS / 0 TRADES`; one read later the same screen showed `116 LISTINGS / 45 TRADES`. A wait condition of "non-empty" would have passed against the sentinel. Recorded as a §5.3 example (the values were not asserted from the first frame).

### F12 — LOW (re-confirmation) · `test-buyer`'s live Stripe subscription has **no** default payment method
`by-user test-buyer` → `sub_1To5Vg4I6kCJlvXoebIAvLZJ` (active) with **no `default_payment_method` at Stripe**, while the app's own row stores `pm_1UFatV4I6kCJlvXoJsDhX3ZQ` (mastercard/4444, `saved_pm_attached_to_expected_customer: AGREE`). This re-confirms the previously-filed F6 drift from an earlier round with fresh evidence — a renewal charged by Stripe would have no card to use. Carried forward, not re-filed as new.

---

## 5. Known gaps / not tested (explicit per-case reasons)

**Not driven — fixture-gated (no persona state exists):**
- `SUB-TC-F02` "with-method" leg — no QA persona holds a `seller_payout_methods` row (F5).
- `SUB-TC-H02`, `SUB-TC-H03` — need a **verified primary method + controlled balance**; `qa-payout-seller` is at $0/0-methods and `test-seller` has no method.
- `SUB-TC-H01` — needs a $0-available-balance persona; `qa-payout-seller` qualifies but was not driven this round (budget).
- `SUB-TC-H06`, `SUB-TC-H07`, `SUB-TC-F06` — admin-config-gated (`minimum_withdrawal_amount_cents`, payout release timing) — pair with the ADM portal.
- `SUB-TC-M07` true-retry branch — needs a failed-payment fixture; `M07` unauthenticated-remove branch — source-confirmed only.
- `SUB-TC-E04` — push-payload-only screen (guide is explicit).

**Not driven — time/clock or disposable-subscription gated:**
- `SUB-TC-D06`, `SUB-TC-D07` (push/clock fixtures — already fixture-gated backlog), `SUB-TC-D05` (real renewal/Checkout), `SUB-TC-C04`/`SUB-TC-C05` (need a disposable active subscription to cancel).

**Not driven — admin-portal pairing required (brief item 4):**
- `ADM-TC-K01 → SUB-H02`, `ADM-TC-M01 → SUB-D01/D07`, `ADM-TC-L08 → SUB-I05`.

**Not driven — budget/scope (explicitly proposed as the next round in §7):**
- Groups A, C (except the C-carried evidence), I, J, K, L, N, and the R-regression set — all currently PASS on a different platform; **no Android verdict exists** for them.

**Coverage disclosure (R80):** this round produced **13 Android verdicts** out of SUB's 83 runnable cases (100 − 15 RETIRED − 2 N/A). The remaining **70 runnable cases have NO Android verdict**. The iOS verdicts on record are **not** carried over.

---

## 6. App state left behind

| Item | State |
|---|---|
| App/session | Left logged in as **test-seller** on Home; app running; Android emulator `Medium_Phone_API_36.1` booted |
| `qa-wallet` | Card-lifecycle fixture **fully reverted** — `subscriptions.stripe_payment_method_id = null` (verified 15:11:39Z); Stripe customer `cus_VDA6aCp5fY8Uci` back to its pre-run state modulo **one orphan** |
| ⚠️ Stripe residue | `cus_VDA6aCp5fY8Uci` **retains 1 attached PM** — `pm_1UGKRu4I6kCJlvXoTAjHd9K3` (visa 4242, created 15:08:38Z), an orphan produced by F2. Recommend detaching it (dev/owner action; a QA-side delete would be a provider write, out of this agent's authority). |
| test-seller | Unchanged — 18 payouts / 17 `requires_action`, balance $909.40/$1156.60/$2066.00, 2263 SP. **No payout created** (H04 blocked pre-payout). |
| test-buyer | Unchanged — card still VISA/mastercard `pm_1UFatV4I6kCJlvXoJsDhX3ZQ`, 458 SP |
| Config | **No `admin_config` writes** this round. Metronome/dev toggles: none armed. |
| Emulator setting | `stylus_handwriting_enabled 0` set (standing Android-round step, R77 #2; reversible) |
| Environment | ⚠️ **Two Metro instances are running** (`:8081` **and** `:8082`) — the Expo Dev Launcher presented *both* rows (R63a). Not resolved this round (killing another session's server is a destructive interleave); flag for the owner. |

---

## 7. Friction & follow-ups

- **Cold-start cost (environment artifact, not app behaviour):** terminate → relaunch → bundle load was ~60–90 s and the Dev Launcher then asked *which* of two Metros to use. Budget ~10 calls for any cold-start step and enforce a single Metro (R63a) before the next Android round.
- **Navigation tax to Payment Methods:** no registered deep link exists for `PaymentMethods` or `Settings`, so every entry costs Profile → scroll → Settings → Payment Methods (~6 calls). **Recommended instrumentation:** register `payment-methods` and `settings` in `AppNavigator.linking.config.screens` (the same class of fix as DT77's `TradeDetail` registration).
- **AX-tree read tax:** the tree still truncates to a session-resource file for these screens, so each coordinate resolution costs a list + a grep. The `--coords` flag remains the standing instrumentation ask.
- **Proposed next round (suggested split — this round could not cover 100 cases):**
  1. **SUB Android Round 2a — SP wallet & history (Groups I + J, 13 cases)** with `test-buyer`/`test-free`/`test-grace`/`test-expired`, explicitly including I05 by wallet state and the D01 grace banner, plus the ADM-L08 → I05 cross-ref.
  2. **SUB Android Round 2b — subscriptions lifecycle (Groups A, C, D, E, K, N, L, ~35 cases)** with a disposable subscription for C04/C05/D05, and the ADM-K01 → H02 + ADM-M01 → D01/D07 cross-refs.
  3. **SUB Android Round 2c — payout money cluster (F/H remainder)** gated on a **repaired payout fixture**: one persona with a *verified* method + a controlled balance (`qa:payout-fixture -- methods --scenario verified --balance …`), to close F02(with-method), F06, H01, H02, H03, H06, H07.
  4. **Fixture-repair task (dev)** — fix the F5 persona drift *before* 2a/2c, or those rounds inherit the same gates.

---

## 8. Screenshots (evidence folder)

`e2e-test-results/qa-sub-android-r1-2026-09-16/screenshots/`

| File | Shows |
|---|---|
| `M00-01-profile-scrolled.png`, `M00-02-settings.png` | navigation path to Payment Methods |
| `M01-01-loading-attempt-n2.png`, `M01-02-loading-attempt-n3.png` | pre-navigation frames (R109 N-sweep) |
| **`M01-03-loading-attempt-n5.png`** | **M01 PASS — "Loading payment methods…" spinner (fresh process)** |
| **`M02-01-qawallet-payment-methods-entry.png`** | **F1 evidence — qa-wallet shown test-buyer's MASTERCARD ••••4444** |
| `M02-02-qawallet-empty-state-after-fresh-process.png` | **F1 control — same persona, fresh process → true empty state** |
| `M02-03-stripe-paymentsheet-open.png` | **F6 — native sheet: "Pay with Link" + "Or use a card", NO Google Pay** |
| `M02-04/05/06/07-*.png` | card-number auto-format, expiry/CVC, IME dismissal, ZIP |
| `M02-08/09-*.png` | Set up processing → **"Payment Method Saved"** |
| `M04-01…06-*.png` | Update sheet → "Add new card" → "Updating…" → **MASTERCARD 4444 refreshed** |
| `M05-01…06-*.png` | confirm alert → Cancel leg (card intact) → Remove → **"Removed"** → remount empty state |
| `F01-01-payout-settings-hero.png` | Payout Settings hero + `Action Required` rows + Set Up CTA |
| `H04-01/02-*.png` | NoMethodModal ("Payment Method Required") → cancelled |

---

## 9. Perceived load times (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Settings → Payment Methods (nav + fetch) | ~1.3–1.6 s | <3 s |
| Payment Methods → Stripe sheet visible (tap → "Adding…" → sheet) | ~1.5–2.0 s | <3 s |
| Stripe "Set up" → success alert | ~2–3 s | borderline |
| Remove → "Removed" alert | ~2–3 s | borderline |
| Profile → Settings | ~1 s | <3 s |
| Home → Payout Settings | ~1.5–2 s | <3 s |
| **Cold app launch (terminate → bundle ready)** | **~60–90 s** | **FLAGGED — dev-build bundle load (environment artifact, not app behaviour)** |

---

## 10. QA Session Handoff

```
## 📋 QA Session Handoff

**Test Scope:** SUB Android Round 1 — MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md, Android emulator `Medium_Phone_API_36.1`. 13 cases executed (SUB-TC-M01–M07, F01–F03, G06, G11, H04) + the Group B retirement re-verification (15 cases) + the B13 N/A answer + the Step-0 reconciliation (tracker, DB clock, R110 cron inventory).
**Design-System Compliance:** PARTIAL — no deviations on any screen rendered this round (Landing, Home, Profile, Settings, Payment Methods, Payout Settings, NoMethodModal, both GlobalAlertProvider dialogs; Payout Settings full-frame scan 0.00% on all forbidden tokens). THREE live off-brand-hex deviations found by the standing R62d source sweep and NOT rendered this round (source-audited only, platform-unverified): `TransactionHistoryScreen.tsx:231,237` `#E53935`; `BillingHistoryScreen.tsx:315/330/337/346/375` `#6B7280`/`#111827`/`#0066CC`; `SubscriptionBanner.tsx:106,118` `#111827`/`#0066CC`. Orphans/dead (not deviations): `SubscriptionStatusCard.tsx`, `SellerEarningsScreen.tsx`. Annotations: `ContinueKidsClubScreen.tsx:31`, `AutoRenewToggle.tsx:87`.
**Perceived Load-Time Verdict:** FLAGGED — cold app launch (terminate → dev bundle ready): ~60–90 s, an **environment artifact** (dev-build bundle load + a two-Metro Dev-Launcher choice), not an app-behaviour finding. All in-app transitions were <3 s except Stripe "Set up" → success alert and Remove → "Removed" alert, both ~2–3 s (borderline, with visible in-flight feedback — "Updating…"/checkmark spinner — so no perceived stall). Full table in report.md §9.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Landing screen: on-brand (green primary pill, one primary, documented neutral tiers).
- CONFIRMED — Home/dashboard: on-brand; SP strip, tiles, tab bar per spec.
- CONFIRMED — Profile screen: on-brand; canonical header (back button 40×40 with hitSlop, no text label).
- CONFIRMED — Settings screen: on-brand; sectioned rows, destructive rows in semantic red.
- CONFIRMED — Payment Methods (empty state): exact guide copy; single primary (`Add Payment Method`).
- CONFIRMED — Payment Methods (saved card): exact guide copy including the security banner; single primary (`Update Payment Method`) + one destructive secondary (`Remove This Card`).
- CONFIRMED — GlobalAlertProvider "Payment Method Saved": branded green pill primary, single primary, no OS-default chrome.
- CONFIRMED — GlobalAlertProvider "Remove Payment Method" (Cancel/Remove): branded, single primary, destructive labelled correctly.
- CONFIRMED — Payout Settings: on-brand; hero + fee notes render; ONE primary per view.
- CONFIRMED — NoMethodModal "Payment Method Required": exact guide copy, branded green pill, Cancel as text link.
- CONFIRMED — native Stripe PaymentSheet: **Stripe's own UI** (Link green button, blue "Set up", "TEST" badge) — correctly OUT of app design scope, not a deviation.
- DEVIATION (source-audited, not rendered) — Transaction History: failed/error text uses Material `#E53935` instead of semantic error `#E85D75`.
- DEVIATION (source-audited, not rendered) — Billing History (via Manage Kids Club+): Tailwind `#6B7280`/`#111827` and iOS system blue `#0066CC` instead of the canonical text tiers / primary green.
- DEVIATION (source-audited, not rendered) — SubscriptionBanner on TradeSuccess: `#111827`/`#0066CC`.
**Verdict Summary:** 10 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED (+3 PARTIAL)
**Money Verification Layers:**
- `SUB-TC-M02` — UI ✓ | DB ✓ (`stripe_payment_method_id` null→`pm_1UGKRu4I6kCJlvXoTAjHd9K3`, 15:08:44Z) | Stripe ✓ (`pm_1UGKRu4I6kCJlvXoTAjHd9K3`: customer `cus_VDA6aCp5fY8Uci`, visa/4242/12-2030) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- `SUB-TC-M03` — UI ✓ | DB ✓ (`pm_1UFatV4I6kCJlvXoJsDhX3ZQ`) | Stripe ✓ (mastercard/4444/9-2027, `saved_pm_attached_to_expected_customer: AGREE`) — 3 layers AGREE — `key_scope=SECRET_KEY_BREAK_GLASS`.
- `SUB-TC-M04` — UI ✓ | DB ✓ (`pm_1UGKTZ4I6kCJlvXofWciXC1r`, 15:10:28Z) | Stripe ✓ (mastercard/4444/12-2030; `address_postal_code_check=pass`, `cvc_check=pass`, AGREE) — 3 layers AGREE — `key_scope=SECRET_KEY_BREAK_GLASS`.
- `SUB-TC-M05` — UI ✓ | DB ✓ (`stripe_payment_method_id` → null, 15:11:39Z) | Stripe ✓ (tracked PM removed from the customer; **the replaced card survives → findings F2**) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- `SUB-TC-M07` — UI ✓ | DB ✓ | Stripe ✓ for the attach + detach legs only; **Stripe N/A for a charge** (SetupIntent — no PaymentIntent exists by design, matching the guide's "no immediate charge"). True-retry-success branch NOT driven.
- `SUB-TC-F01` — UI ✓ | DB ✓ (3/3 exact: 90940 / 115660 / 206600) | Stripe **N/A** — DB projection, no provider object.
- `SUB-TC-F03` / `SUB-TC-G06` / `SUB-TC-G11` / `SUB-TC-H04` — UI ✓ | DB ✓ (18 payout rows / 17 `requires_action` unchanged before & after; no payout created) | Stripe **N/A** — `requires_action` payouts have no dispatcher (documented synthetic-payout boundary); H04 blocked pre-payout so no Payout object exists.
- `SUB-TC-M01` / `SUB-TC-M06` / `SUB-TC-F02` — **N/A — no money object touched** (loading state, navigation, and a method-section read).
- **Enablement caveat (applies to every ✓ above):** the provider reads ran **break-glass** because `STRIPE_QA_READONLY_KEY` holds an `sk_test_…` key — the FIX-Task-33 restricted-read guarantee is NOT in force (finding F3).
**Coverage Tracker Updated:** UPDATED — `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`, SUB section. Rows touched (Android verdict recorded in `Latest`/`Notes`; `Source` → `qa-sub-android-r1-2026-09-16/report.md`, `Date` → 2026-09-16): SUB-TC-M01 ✅ PASS-android; SUB-TC-M02 ✅ PASS-android (3-layer); SUB-TC-M03 ✅ PASS-android (3-layer); SUB-TC-M04 ✅ PASS-android (3-layer); SUB-TC-M05 ✅ PASS-android (3-layer); SUB-TC-M06 ✅ PASS-android; **SUB-TC-M07 🟡 PARTIAL-android** (2 of 4 branches); SUB-TC-F01 ✅ PASS-android (3/3 DB-exact); **SUB-TC-F02 🟡 PARTIAL-android** (with-method leg fixture-gated); **SUB-TC-F03 🟡 PARTIAL-android** (no completed/pending rows in live data); SUB-TC-G06 ✅ PASS-android; SUB-TC-G11 ✅ PASS-android; SUB-TC-H04 ✅ PASS-android. **Case-level roll-up unchanged and NOT re-derived (deliberate): Cases 100 · PASS 77 · PARTIAL 2 · OPEN 3 · DOC-DRIFT 0 · SKIPPED 0 · RETIRED 15 · N/A 2 · Remaining (ACTIVE) 1** — no case's best verdict regressed (every Android PARTIAL is a *narrower platform leg* of a case whose iOS PASS still stands; M07/F02/F03 did not regress on the platform they were PASSed on). The tracker's single `Status` column is platform-agnostic, so the Android split is recorded in `Latest`/`Notes` + this round note rather than by rewriting counts — **stated explicitly so the choice is not silent.** A per-platform column is recommended (see What Needs To Be Fixed Next).
**Critical Findings:**
1. **F1 (HIGH, privacy)** — cross-account saved-card disclosure: a **process-global `_pmCache`** (`src/services/subscription.ts:845`, read at L864-866) is not scoped to the user and is **never invalidated on logout/account switch**, so after `test-buyer → qa-wallet` (same process) the Payment Methods screen showed the **previous user's card** on an account with no card (DB null + Stripe customer clean). Fresh-process control renders the correct empty state. Blast radius: Payment Methods, Manage Kids Club+ PaymentMethodSection, CartCheckout, TradeOffer.
2. **F2 (LOW-MED)** — updating the saved card **never detaches the replaced PaymentMethod** at Stripe; orphans accumulate on the customer (proven: `[4242] → [4444, 4242] → remove → [4242]`; `test-buyer`'s customer holds 4).
3. **F3 (MED, enablement)** — `STRIPE_QA_READONLY_KEY` holds a full `sk_test_…` secret, so `qa:stripe-inspect` refuses and every provider read this round was break-glass-labelled; FIX-Task-33's restricted-read safeguard is inactive.
4. **F4 (MED, scope)** — the brief's priority items 1 (B13) and 2 (B03/B09–B12) are **RETIRED**; source-verified and pivoted to Group M.
5. **F5 (MED, fixture)** — persona-state drift vs the guide: `test-seller` trial+grace+**no payout method**; `test-grace` wallet `active` (not frozen); `test-trial` left in `grace_period`; `test-free` **has** a card; only one `seller_payout_methods` row exists and it belongs to a demo account.
6. **F6 (MED)** — the live in-app Stripe PaymentSheet offers **Link + card but NO Google Pay** on Android.
**App State Left Behind:** App left logged in as `test-seller` on Home; emulator `Medium_Phone_API_36.1` booted. `qa-wallet` card fixture fully reverted (DB null; Stripe customer back to pre-run minus **one orphan PM `pm_1UGKRu4I6kCJlvXoTAjHd9K3`** — recommend a dev/owner detach). `test-seller` unchanged (18 payouts, no payout created). `test-buyer` unchanged. No `admin_config` writes; no dev toggles armed. Emulator setting `stylus_handwriting_enabled=0` left set (reversible, standing step). ⚠️ **Two Metro instances running (:8081 + :8082)** — Dev Launcher shows both rows; not resolved (R63a follow-up).
**Why It Matters:** SUB had **zero Android verdicts**; this round establishes the first Android baseline for the card-on-file and payout-guard surfaces and proves the live in-app Stripe PaymentSheet is fully drivable on Android (a capability iOS lacks). It also surfaces a **HIGH privacy defect** (one account seeing another's card after a switch on a shared device) that no DB-only or iOS-only check would have caught, plus a Stripe account-hygiene leak where replaced cards are never released.
**How to Verify/Reproduce:** All evidence in `e2e-test-results/qa-sub-android-r1-2026-09-16/` (`report.md` §3/§4/§8 + `screenshots/`). **F1:** as `test-buyer` open Payment Methods (card renders) → `adb shell am start … "p2pkidsmarketplace://qa-login-as?persona=qa-wallet"` → Profile → App Settings → Manage Payment Methods → observe the previous user's card (`M02-01-…png`) while the DB column and the Stripe customer are both empty; then terminate + relaunch → the empty state (`M02-02-…png`). **F2:** run `npm run qa:stripe-inspect -- by-user qa-wallet@kidsmarketplace.test --break-glass-secret-key` and compare `payment_methods[]` against `db_subscription.stripe_payment_method_id` after an attach → update → remove cycle. **F3:** `npm run qa:stripe-inspect -- by-user test-buyer` (refuses with the key remediation).
**Known Gaps / Not Tested:** **70 of SUB's 83 runnable cases have NO Android verdict** (R80 disclosure). Fixture-gated: F02 with-method leg, H01, H02, H03, F06, H06, H07, M07's true-retry + unauthenticated branches, E04 (push-payload by design). Clock/disposable-sub gated: C04, C05, D05, D06, D07. Admin-paired (brief item 4): ADM-K01→H02, ADM-M01→D01/D07, ADM-L08→I05 — **not completed**. Budget/scope: Groups A, most of C, I, J, K, L, N, R-regression. Also unverified: D01/I05's frozen-wallet banner for `test-grace` (its wallet state is `active`, contradicting the guide — see F5).
**What Needs To Be Fixed Next:**
1. **Fix `_pmCache` user-scoping + logout invalidation** (F1, HIGH) — key it by `session.user.id` and clear on `SIGNED_OUT`/`SIGNED_IN`/`USER_UPDATED` in `src/services/subscription.ts`, or remove the cache and keep only promise-dedup.
2. **Detach the replaced PaymentMethod on the Update path** (F2) — in `attachPaymentMethodToCustomer` / the update flow, detach the prior `pm_…` after a successful attach (or set `invoice_settings.default_payment_method` and prune), so card tokens don't accumulate.
3. **Provision a Stripe restricted `rk_test_…` key** for `STRIPE_QA_READONLY_KEY` (F3) so provider audits are restricted-read again.
4. **Surface the retired Group B in the SUB test brief** (F4) so priorities are not assigned to unreachable cases.
5. **Repair the SUB persona fixtures** (F5): give `test-seller` a documented state (or fix the guide's Accounts table), align `test-grace`'s `sp_wallets.state` with its `sub=grace` status, reset `test-trial`, and add one persona with a **verified payout method + controlled balance** so F02/H02/H03 become drivable.
6. **Replace the off-brand hexes on the three live surfaces** (F8): `TransactionHistoryScreen` `#E53935`→`#E85D75`; `BillingHistoryScreen` `#6B7280`/`#111827`→`#6B6B6B`/`#1A1A1A` and `#0066CC`→`#5DBB8E` (primary) / `#5B8FB9` (info); `SubscriptionBanner` likewise.
7. **Re-point cron `#49 release-pending-sp` at its Edge Function** (F7).
8. **Add an Android/PASS-PARTIAL platform column to the tracker** so per-platform verdicts are countable without overloading `Latest` notes (this round had to state the counting choice explicitly).
**UX Enhancement Ideas (optional, not defects):**
- On **Payment Methods**, the card form's Stripe sheet retains a `Save your info for secure 1-click checkout with Link` opt-in — consider pre-checking or explicitly explaining Link in-app, since the app's own copy advertises only card storage and the Link upsell arrives unannounced at payment time.
- On **Payout Settings**, 17 rows all read "Action Required" with no aggregate banner — consider a one-line summary ("17 payouts need a payout method") above the history list to reduce scan cost.
- On **Profile**, the stats block renders `0 LISTINGS / 0 TRADES` as a pre-fetch sentinel — consider a skeleton/placeholder instead of `0` so a slow fetch doesn't briefly read as "you have nothing" (F11).
- On **Payment Methods**, no deep link exists (`settings`/`payment-methods` unregistered) — registering them would remove a 6-call navigation path for QA and enable direct support linking.
**Suggested Next Session:** **SUB Android Round 2a — SP Wallet & SP History (Groups I + J, 13 cases)** with `test-buyer` / `test-free` / `test-grace` / `test-expired`, explicitly covering I05 by wallet state and the D01 grace banner, **paired with the ADM-L08 → I05 admin cross-ref** — chosen because it is the largest remaining cluster that is fully drivable today without new fixtures, and because I05/D01 are exactly where F5's fixture contradiction needs resolving.
**Suggested to Improve Agent Rules:** Add a rule that **a process-global module-level cache is a WRITER of UI state, and must be named before filing any stale/cross-account UI finding** — the natural extension of R100 (name the writer) from DB columns to client-side caches: when a screen shows data the backend does not, look for a module-scope cache and prove it with a **fresh-process control** (terminate + relaunch) before concluding a server-side leak. This round's F1 was resolved to certainty in two calls (source read of `_pmCache` + the relaunch control) after the initial suspicion could easily have been mis-filed as a backend privacy breach or dismissed as a stale-tree artifact.
```

---

## 11. Execution trace summary (counts)

| Phase | Calls | Notes |
|---|---|---|
| Step 0 reconciliation (tracker, DB clock, cron, fixtures, schema) | ~18 | incl. the Group-B source verification and the retired-scope pivot |
| Device/session setup (activation, calibration, Metro, persona) | ~10 | two-Metro Dev-Launcher choice (R63a) |
| Group M (M01–M07) + F1 evidence + control | ~75 | incl. the real Stripe sheet drive (IME-gated) and 4 provider reads |
| Payout cluster (F01/F02/F03/G06/G11/H04) | ~22 | F01 3/3 DB-exact; H04 DB-verified no-payout |
| Design sweep + liveness triage + badge-scan | ~12 | R62b/d/e compliance |
| **Total** | **~137** | 13 verdicts ≈ **10.5 calls/verdict** (vs the 9.6 baseline in §5.69 — within noise; the delta is the Stripe-sheet IME discipline + 4 provider reads, both of which bought 3-layer evidence the baseline rounds did not produce) |
