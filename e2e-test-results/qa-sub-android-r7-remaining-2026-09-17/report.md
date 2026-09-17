# QA run — SUB Android Round 7: remaining groups + grace spend confirmation

- **Guide:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
- **Platform:** Android emulator `Medium_Phone_API_36.1` (emulator-5554), 1080×2400 — AX coords are 1:1 with px (R77 #1). **iOS NOT driven** (R80 — no iOS verdict claimed or changed).
- **Date:** 2026-09-17
- **Metro:** single instance on `:8082` (`adb reverse` for 8081/8082 in place) — R63a single-instance discipline satisfied.
- **Personas:** `test-grace` → `test-buyer` → `test-free` → `test-seller` → `qa-payout-seller` (5 switches, persona-major batching per R19/R49).
- **Evidence:** `screenshots/` (**36 PNGs**, one per transition/dialog/final state per §5.6) + the execution trace in `ledger.md`.

## Verdict summary — 15 Android verdicts: **13 PASS · 2 PARTIAL · 0 FAIL · 0 BLOCKED**

| TC-ID | Case | Verdict | Evidence |
|---|---|---|---|
| P1 | FIX-Task-51 device leg — grace SP spendable | **✅ PASS** (+ 1 named gap) | `I07…`/`04-sp-wallet-poll.png`; DB+source |
| SUB-TC-E01 | Billing History list — records, badges, amounts | **✅ PASS** | `E01-E03-transaction-history-buyer.png` |
| SUB-TC-E02 | Billing History empty state | **✅ PASS** | `E02-transaction-history-empty-free.png` |
| SUB-TC-E03 | Failed charge shows error message | **✅ PASS** | `E01-E03-transaction-history-buyer.png` |
| SUB-TC-E04 | Subscription Status screen (push-payload) | **NOT DRIVEN** (fixture-gated) | — |
| SUB-TC-G01 | Add Stripe Connect payout method (onboarding) | **🟡 PARTIAL** | `G01-stripe-connect-selected.png`, `G01-add-method-result.png`, `G01-after-ok.png` |
| SUB-TC-G06 | requires_action → "Set Up Payout Method" | **✅ PASS** | `G06-setup-payout-method-tap.png` |
| SUB-TC-G07 | Payout Settings — "Edit Details" sheet | **✅ PASS** | `G07-edit-details-alert.png` |
| SUB-TC-G10 | Payout history Load More | **✅ PASS** | `G10-after-pull-refresh.png` |
| SUB-TC-H01 | Withdraw Now — no-balance guard | **✅ PASS** | `H01-no-balance-alert.png` |
| SUB-TC-H04 | Withdraw blocked when no verified primary method | **✅ PASS** | `H04-no-method-modal-seller.png` |
| SUB-TC-H06 | Admin minimum withdrawal blocks below the floor | **✅ PASS** | `H06-withdraw-modal-summary.png`, `H06-minimum-withdrawal-rejected.png` |
| SUB-TC-H07 | Minimum withdrawal disabled when config = 0 | **✅ PASS** | `H07-withdrawal-result.png`, `H07-payout-history-after-refresh.png` |
| SUB-TC-I07 | SP Wallet — "Reserved in trades" card | **🟡 PARTIAL → ✅ PASS** | `I07-sp-wallet-reserved-positive.png`, `I07-sp-wallet-reserved-negative.png` |
| SUB-TC-J04 | Pull-to-refresh updates ledger | **🟡 PARTIAL → ✅ PASS** | `J04-sp-history-before-refresh.png`, `J04-sp-history-after-pull-refresh.png` |
| SUB-TC-L05 | Payout-status webhook updates payout history | **🟡 PARTIAL (advanced)** | `H07-payout-history-completed.png` + provider read |

---

## 1. Priority 1 — FIX-Task-51 device leg (`test-grace`)

**FIX-Task-51's server fix is confirmed on-device, and the R6 spend model is what the user sees.**

**A · On-device (the owed leg) — ✅ PASS.** Relaunched cold and logged in as `test-grace`
(`status='grace_period'`, `sp_wallets.state='grace_period'`, `available_balance=0`, `grace_ends_at` 2026-11-09 — all
DB-verified *before* driving). SP Wallet (deep link `sp-wallet`) renders the **Grace Period Active** banner:

> *"You can keep spending existing Swap Points, but you won't earn new ones until you renew."*

Hero **0 Swap Points** (= DB `available_balance`). **No frozen/blocked/earning-suppressed wording anywhere on the
screen** — the AX tree exposes `Sp wallet shop/sell/history btn` + `Sp wallet earn sell/refer btn` and contains **no**
frozen-state element. This is the R6-correct, spendable-not-earning presentation.

**B · Server entitlement — ✅ PASS.** `fn_get_sp_entitlement(test-grace)` → **`can_spend_sp=true`, `can_earn_sp=false`**
(`wallet_state='grace_period'`, `subscription_status='grace_period'`). Discriminating controls: `test-buyer` active →
`true/true`; `test-expired` (frozen) → `false/false`; `test-free` → `false/false`. The narrowed window is exactly
"grace spends, grace does not earn, expired does not spend".

**C · Function-grant check (the new FIX-Task-51 rule) — ✅ CLEAN.** `has_function_privilege()` for all seven
recently-modified SP/subscription functions (`can_user_spend_sp`, `fn_get_sp_entitlement`, `get_subscription_summary`,
`get_subscription_status`, `get_user_sp_wallet_summary`, `fn_item_effective_sp_cap`, `fn_reserve_sp_on_offer`) returns
**true for `authenticated`, `anon` and `service_role`** ⇒ no repeat of the CREATE-OR-REPLACE grant stripping.

**D · ⚠️ RETRACTED (self-caught false inference — recorded deliberately).** I first ran
`qa:ef-repro --ef create-trade-offer` as `test-grace` and got `NO_PAYMENT_METHOD`, concluding "the SP gate passed".
**That inference was wrong**: in `supabase/functions/create-trade-offer/index.ts` the payment-method check is at
**L601** while `resolveSpRedemption` (the entitlement gate) is called at **L754** — the request never reached the SP
gate. Caught by reading the call site, **before** it reached this report. Do **not** cite the EF as a grace-SP-gate
discriminator without supplying `payment_method_id` **and** `cash_amount_cents` **and** `item_id`.

**E · ⚠️ The literal "small SP spend" — NOT DRIVABLE (named gap, R13).** `test-grace.sp_wallets.available_balance = 0`,
so there is no SP to spend; and the only SP-grant helper (`qa:set-sp-balance`) **unconditionally sets
`state='active'`**, which would destroy the `grace_period` precondition — with **no sanctioned helper to restore it**
(`qa:wallet-persona-fixture state` is pinned to the unrelated `qa-wallet` persona). Attempting it would have produced
a *false* result in either direction. **Recommended enabler:** a `--state` flag on `qa:set-sp-balance` (or an SP grant
that preserves wallet state) so the grace persona can hold spendable SP.

## 2. Group E — Billing History & Status

**E01 ✅ PASS (Android, first verdict).** `test-buyer` → Transaction History (deep link `billing-history`) renders
**4/4 records DB-exact** — 3 × `succeeded` (Jun 30 $0.00 / Jul 27 $5.99 / Aug 27 $5.99) + 1 × `failed`
(Sep 3 $5.99), each with date, description, formatted amount and a status badge (**Succeeded** green / **Failed**
red). Pull-to-refresh reloaded the list with no error and no duplication (see §7 for the gesture caveat).

**E02 ✅ PASS (Android, first verdict).** `test-free` → grey receipt icon + **"No billing history yet."** (the guide's
live copy, verbatim) + zero rows (DB-confirmed 0 `billing_history` rows for test-free).

**E03 ✅ PASS (Android, first verdict).** The failed row renders the red **FAILED** badge **plus the error message
below the amount** — *"Your payment was declined. Please update your payment method to keep your subscription
active."* — **verbatim** `billing_history.error_message` (`charge_id` `qa_r41_e03_failed_…`).

**E04 NOT DRIVEN — fixture-gated by design.** The Subscription Status screen has **no in-app navigation entry** (the
guide itself marks it ⏸ FIXTURE-GATED / push-payload-only), and no push-payload fixture exists. Recorded as
fixture-gated, **not** as a failure.

## 3. Group G remainder

**G06 ✅ PASS.** `test-seller` (18 `requires_action` payouts, 0 methods) → Payout History row renders **"Action
Required"** + a **`history-action-<id>` "Set Up Payout Method"** button (`$16.80 · Sep 16, 2026`). Tapping it opens the
**in-screen "Add Payout Method"** modal offering **Stripe Connect / PayPal / Venmo** (+ Cancel / Add Method) — the
seller resolves the state without leaving the screen, exactly as the case specifies. ✅ The summary line reconciles
**"18 payouts need a payout method" = DB 18**, and the new hint discloses the window ("5 of them are in the list below").

**G07 ✅ PASS.** Method-card kebab (`kebab-btn-<id>`) → sheet (`sheet-set-primary` / `sheet-edit-details` /
`sheet-delete-method` / `sheet-cancel`) → **Edit Details** → alert **"Edit Details" / "Editing payout method details
is not yet available. Contact support for changes."** (guide copy verbatim).

**G10 ✅ PASS — both clauses.** With 19 payouts (page size 5): tap **Load More** → the in-app counter advances
**"5 of them…" → "10 of them…"** = **exactly +5 per tap**; then a pull-to-refresh **resets the list to the first 5**
("5 of them are in the list below"), with `hasMorePayouts` correctly keeping the button present. (R6's F08 fix holds.)

**G01 🟡 PARTIAL.** ⚠️ **Entry-point label is doc-drift:** the guide says tap **[Add Payout Method]**; the live PAYOUT
METHOD CTA is **"+ Add Bank Account"** (no method) / **"+ Add Another Method"** (has method) — the string "Add Payout
Method" is only the *modal title* + the NoMethodModal button.
- ✅ **Verified:** [Add Another Method] → modal → **Stripe Connect** selected → **[Add Method]** → **"Success / Stripe
  account created! You will now be redirected to complete your onboarding."** → **Chrome opened
  `connect.stripe.com/setup/…`** ⇒ *"the Stripe onboarding flow launches"* **confirmed for real**.
- ❌ **Not observable:** *"until onboarding completes the method shows an incomplete/onboarding status"*. This persona
  already held a **verified** primary method; the provider read shows **exactly one** Connect account
  (`acct_1UGO3X3J8Vt0lE5T`, all three enable-flags true) and `seller_payout_methods` stayed at **1 row** — so there is
  no incomplete method to display. The hosted onboarding itself is not drivable on Android (R77 #13).

## 4. Group H — Withdrawals (3-layer: UI → DB → Provider)

| Case | UI | DB | Provider |
|---|---|---|---|
| **H01 ✅** | "No Balance / You have no available balance to withdraw"; no WithdrawModal | no payout row (0), balance unchanged | **N/A** (nothing dispatched) |
| **H04 ✅** | "Payment Method Required / To withdraw your earnings, you need to add and verify a payout method first." + [Add Payout Method]/[Cancel] | **test-seller payouts still 19** (no row created) | **N/A** |
| **H06 ✅** | "Withdrawal Failed / **Minimum withdrawal amount is $10.00**" | 0 rows, balance unchanged (700¢) | **N/A** |
| **H07 ✅** | "Withdrawal Requested — Your withdrawal of $7.00 has been initiated. After fees, you will receive $6.73."; row → **Completed** | row `e1893558…` `completed`, gross 700 / fee 27 / **net 673**, `provider_reference_id` set | **`tr_1UGeom4I6kCJlvXoMOti9yRj`**: amount **673**, destination **acct_1UGO3X3J8Vt0lE5T**, `livemode:false`, `metadata.payout_id` = the DB row id — `key_scope=SECRET_KEY_BREAK_GLASS` |

- **H01** was made discriminating by driving the **balance guard** with a verified method present (`available = 0`,
  method present) — the guard order in `handleWithdrawClick` is **balance first, then method** (source-verified).
- **H06** used the guide's *set-to-1000* variant with a balance of **$7.00** — deliberately **above the previous
  $2.00 floor and below the new $10.00 floor**, so the rejection proves the floor is read from **config**, not
  hardcoded. `qa:admin-config-set -- set --data-type number` (the `--data-type` flag passed explicitly per the R6 F4
  finding), read-back verified.
- **H07** disabled the floor (0) and confirmed the full-balance withdrawal succeeds. **The WithdrawModal summary is
  also exact**: Available **$7.00** / Payout processing fee (Stripe) **−$0.27** / You'll Receive **$6.73** — the fee
  matches `$0.25 + 0.25%` = $0.2675 → $0.27 as the guide's formula requires; the modal carries
  `withdraw-cancel`/`withdraw-confirm` and **no amount-entry field**.
- ⚠️ **Provider read scope (worth knowing):** a platform→connected transfer must be read **without** `--account`;
  passing `--account acct_…` looks for a transfer *created by that connected account* and returns **404**. I hit that
  once and diagnosed it as a read-scope artifact **before** filing it as a divergence (R100/R24).

## 5. Partial closures

**I07 ✅ PASS (both legs driven — closes the Round-2a PARTIAL).** `reserved_sp > 0` had **no fixture anywhere**
(platform-wide count was 0). I created one for real: a pending SP-backed offer as `test-buyer`
(`create-trade-offer`, 5 SP / $10.00 cash / $15 item) → `reserved_sp = 5`, `available` 458→453.
- **Positive:** SP Wallet hero **453 SP** (DB-exact) + card **"Reserved in trades — 5 SP"** with the guide's copy
  verbatim *"SP used in pending offers — returned if trade is cancelled."*
- **Negative:** after cancelling the offer via the **real app path** (Trade Timeline → Cancel Trade → CancellationReasonModal → "Changed mind" → confirm), `reserved_sp = 0`, `available = 458`, and the card is **absent**.
  ⚠️ `cleanup-test-trades.ts` cancels by **raw status UPDATE** (its own comment says so) and would **not** have fired
  the SP refund — using it here would have produced a false J04 result.

**J04 ✅ PASS (closes the Round-2a PARTIAL).** The cancellation wrote a genuine **SP-earning** ledger row
(`earn_refund +5`, balance 453→458, *"SP refunded for cancelled offer"*). With SP History already **stale** (top still
the 8:42 AM `spend_purchase`), a pull-to-refresh revealed the new top row **"Earn Refund · 9/17/2026 at 8:44 AM ·
+5 SP"** — the before/after **pair** is captured (§5.6 evidence-pair standard). Sub-note: the stale-then-refreshed
sequence is the **R59** class (a screen keeps pre-change content until it re-fetches) — reported as a product note,
not a content bug.

**L05 🟡 PARTIAL (advanced, gap narrowed).** The brief's precondition — *"needs a payout with a real provider
reference"* — is now **satisfied**: H07's withdrawal produced a `completed` row with
`provider_reference_id = tr_1UGeom4I6kCJlvXoMOti9yRj`, and the app surface renders the provider-reported status +
completion date + fee line. **Still not driven:** the *webhook-triggered* status flip (a signed `payout.*` webhook) —
no webhook signing secret is available under read-only discipline, and the observed
**`processing` → `completed`** transition came from the **DEV-TASK-124 dispatch trigger**
(`dispatch-manual-payouts`), **not** a provider webhook. Stated plainly so the verdict is not over-read.

## 6. Findings

| # | Sev | Area | Finding |
|---|---|---|---|
| F1 | **LOW-MED** | Copy (§6.3) | **G01 success alert over-claims.** `PayoutSettingsScreen.tsx:1512-1515` shows *"Stripe account created! You will now be redirected to complete your onboarding."* whenever `resumingOnboarding` is false — but the flow **idempotently reused an existing, already-verified** Connect account (provider still shows exactly 1 account; no new method row). `resumingOnboarding` is computed from the method list, so it cannot distinguish "new account" from "reused already-complete account". **Rewrite:** have `create-stripe-connect-account` return `created: true/false` and add a third branch — *"This payout account is already connected and verified."* |
| F2 | **LOW-MED** | Doc/copy drift | **G01 entry-point label drift:** guide says **[Add Payout Method]**; the live CTA is **"+ Add Bank Account"** / **"+ Add Another Method"**, and the modal that opens contains **no** "Bank Account" option despite that label. |
| F3 | **MED** | Tooling | `qa:stripe-inspect -- transfer <tr_…> --account <acct_…>` → **404** for a platform→connected transfer (a `Stripe-Account`-scoped read looks for the *connected account's own* transfers). Omit `--account`. Cost 1 call; recommend a note in the tool's usage text. |
| F4 | **MED** | Tooling | `qa:ef-repro --ef create-trade-offer` advertises `--items <listing_id>` and `--pm`, but the EF requires **`item_id` + `cash_amount_cents` + `payment_method_id` inside `--body`**; both flags are silently ignored (log prints `items: 0`). Cost 3 wasted calls (`MISSING_ITEM_ID` → `INVALID_AMOUNT` → `NO_PAYMENT_METHOD`). |
| F5 | **LOW** | Tooling | **MCP swipes do not reliably fire `RefreshControl`.** `mobile_swipe_on_screen` (down) failed to trigger pull-to-refresh on Payout Settings across **3** attempts; `adb shell input swipe x y1 x y2 800` (slow drag) did, first try. R77 #14 extension — prefer the anchored adb swipe for pull-to-refresh on Android. |
| F6 | **LOW** | Locator gap (BP-53) | The **NoMethodModal's Cancel** has **no `testID`/button role** (only a `ViewGroup label="Cancel"`) — derive coordinates from the tree. |
| F7 | **LOW** | Staleness (R59) | **Payout Settings keeps a pre-change payout status until re-fetch.** After H07 the row read **"Processing"** while the DB and Stripe both said `completed`; a pull-to-refresh corrected it. Recommend adding Payout Settings to the R59 known-stale list (the guide's H03 note already implies it). |
| F8 | **INFO** | §5.31 reversal | The **`WithdrawModal` buttons ARE AX-exposed** on this build (`withdraw-confirm` / `withdraw-cancel`) — the R5/QA-Task-33 "pixel-scan required" note is superseded for Android. Re-check per build. |

## 7. Perceived load times (§5.7 — simulator, wall-clock, ±polling precision; not a formal profile)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Cold launch → Dev Launcher row tap → app Home rendered | ~2 min (cold bundle load) | environment artifact (dev-client cold load), not app-behaviour |
| `qa-login-as` persona switch → new avatar/session rendered | < 5 s | ok |
| Deep link `payout-settings` → screen mounted | < 6 s | ok |
| Payout Settings with 19 payouts → Load More tap → list grew | < 2 s | ok |
| SP Wallet mount → wallet rendered | ~10 s (first mount, host under load) | borderline |
| Profile → Transaction History (deep link) → list | < 5 s | ok |

**No transition measured ≥ 3 s that was attributable to app behaviour.** The host was under load (the cold bundle
load and SP Wallet's ~10 s first mount are reported with that caveat).

## 8. Design & copy compliance (§6.4)

Screens/dialogs reviewed: Payout Settings (both personas), SP Wallet (grace + active), SP History, Transaction
History (populated + empty), Trade Timeline, CancellationReasonModal, Add Payout Method modal, method sheet,
WithdrawModal, NoMethodModal, Payment Method Required modal, "No Balance" / "Edit Details" / "Success"/"Withdrawal
Requested" / "Withdrawal Failed" GlobalAlert dialogs.

- **Alerts confirmed as `GlobalAlertProvider` in-app dialogs** (AX-instrumentable, e.g. `global-alert-button-0`, white
  card + single green pill primary) — **not** native OS alerts (§5.4 empirical verification).
- **CONFIRMED:** single primary per dialog; pill-primary styling; NoMethodModal + WithdrawModal + reason modal copy
  match the guide verbatim; status badges colour-coded consistently (Succeeded green / Failed red / Completed green /
  Action Required red).
- **DEVIATION (F1):** the G01 "Stripe account created!" alert is **inaccurate copy** on an idempotent reuse.
- **No raw support-email surfaces** observed; support routes to the in-app Contact Support form. No raw error-code/
  developer strings observed on any user-facing surface this round.
- ⚠️ **Off-brand hex sweep NOT re-run as a clean pass.** R62d's full-list grep was last run in R6 (≈150 hits / ≈50
  files) with **liveness triage incomplete**; this round's screens rendered on-brand, but per R62d a design pass is
  **not** reported clean on a partial sweep. Carried forward as an open item.

## 9. Environment / tooling notes

- Device free at start (R29: no Maestro/run-suite/agent process on the emulator). One leftover Playwright
  `test-server` for `p2p-kids-admin` was running but idle — the admin portal was not needed this round (all admin-side
  writes went through `qa:admin-config-set`, the sanctioned shared-RPC path).
- `view_image` **worked** this session (contradicts R5's "URI only" claim) — screenshots were read directly; the
  downsized-relative-to-file caveat (R104) still applied and tree coordinates were preferred.
- R111 reproduced: the first deep link after a `qa-login-as` switch was dropped (`payout-settings` landed on SP
  Wallet); a re-fire navigated.
- R107 respected throughout: no AX dump while any screen was loading (screenshot-only polling during bundle load).
- R31 reproduced and handled: `cancel-trade-button`'s centre fell inside the pill band (y2312 px ≈ 881 dp) and the tap
  no-opped; scrolling it clear (→ y1965) then tapping worked.

## 10. App state left behind

- `minimum_withdrawal_amount_cents` **restored 200 → read-back verified**; `data_type` stayed `number`.
- `qa-payout-seller`: balance **restored $50.00**; **1** method (unchanged); **1** payout row
  (`e1893558…`, `completed`, net 673) + the real test-mode transfer `tr_1UGeom4I6kCJlvXoMOti9yRj` — the intended H07
  fixture, left in place (test mode, reversible).
- `test-seller`: **unchanged** — 19 payouts, 0 methods (H04 created nothing).
- `test-buyer`: SP `reserved_sp = 0`, `available = 458`; the fixture trade `7312c94b…` is **`cancelled`**; two extra
  `sp_ledger` rows (`spend_purchase −5` + `earn_refund +5`) remain as the audit trail of the I07/J04 fixture.
- `test-grace` / `test-free` / `test-expired`: **untouched** (no writes).
- No session-local QA toggles armed. App left on Payout Settings as `qa-payout-seller`; emulator warm.

## 11. Coverage statement — is SUB now fully Android-covered?

**No — but it is now close, and the gap is smaller and precisely named.** This round cleared **10 of the 11** cases the
Round-6 handoff listed as lacking an Android verdict (E01/E02/E03, G01\*, G06, G07, G10, H01, H04, H06, H07) and
**closed 2 of the 3 outstanding PARTIALs** (I07, J04). Still outstanding, with reasons:

| Remaining | Status | Reason |
|---|---|---|
| **SUB-TC-E04** | NOT DRIVEN | Push-payload-only screen with **no in-app navigation entry**; the guide itself marks it ⏸ FIXTURE-GATED. Needs a push/deep-link fixture. |
| **SUB-TC-G01** | 🟡 PARTIAL | Onboarding launch ✅ verified; the "incomplete method status" clause is unobservable on a persona that already holds a verified method, and the hosted flow is not drivable on Android (R77 #13). Needs a **method-less** persona + a hosted-drive mechanism (or `qa:express-complete`). |
| **SUB-TC-L05** | 🟡 PARTIAL | Provider-reference precondition now met; the **signed webhook** leg needs the webhook signing secret. |
| **SUB-TC-F06** | 🟡 PARTIAL (carried) | Release-transition timing legs — unchanged from R6. |
| **SUB-TC-D06/D07** | 🔴 by design | Clock/push fixture-gated (moved to the Fixture-Gated Backlog). |
| **P1 "small SP spend"** | named gap | `test-grace` has 0 SP and the only SP-grant helper clobbers `wallet.state`. |

⇒ **SUB Android coverage: 13 of the 15 targeted verdicts delivered; 2 PARTIAL with named, non-overlapping enablers;
only E04 is wholly undriven.** The tracker's SUB roll-up moves **PASS 78 → 79 · PARTIAL 2 → 1** (I07 and J04 flip
PARTIAL→PASS; **G01 is newly recorded PARTIAL**, so it nets PASS down by one). Remaining Android work is
**fixture/tooling-gated, not untested surface area.** ⚠️ The **pre-existing ±1 row-set residual (99 vs 100)** and the
**PARTIAL row-vs-roll-up mismatch are deliberately NOT repaired here** (per the brief): the Latest-PARTIAL set is now
`{G01, L05, F06}` = 3 against the `PARTIAL 1` roll-up — the **same 2-row gap as before**, neither resolved nor widened.
