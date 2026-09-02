# QA Task 21 (v2) — Full Real Subscription Lifecycle E2E + SUB Guide Closure — Run Report

**Date:** 2026-09-02 · **Agent:** QA Test Agent · **Device:** iPhone 17 Pro Max (iOS 26.1) UDID `3F3293A3` · **Backend:** staging `drntwgporzabmxdqykrp` · **Web target:** `p2p-kids-web` :3002 (real/non-mock, per Dev Task 90) · **Admin:** :3001 · **Stripe:** acct_1ShGft4I6kCJlvXo (test mode, key via `~/.dt11-stripe-key`)
**Run dir:** `e2e-test-results/qa-task21-sub-close-2026-09-02/`

---

## Executive summary

The **full real subscription lifecycle (Section A) is now verified end-to-end for the first time** on staging — real Stripe Checkout ($5.99/mo), webhook → `subscriptions` row, `subscription_events` audit row, free→active mobile transition without manual refresh, subscriber gating, in-app cancellation with Stripe `cancel_at_period_end`, and a **Stripe test-clock renewal that advanced `current_period_end` and wrote a new `billing_history` row** (the Dev Task 89 fix proven on a brand-new subscription). Strict cleanup left **zero residue** (DB + auth + Stripe all verified 0).

This was only possible after fixing a **newly-discovered environment blocker**: the `stripe-webhook-subscriptions` endpoint was subscribed to only 4 events and was **missing `checkout.session.completed` + `customer.subscription.created`** — the two events that bootstrap the `subscriptions` row for a web-first purchase. The user authorized applying the one-line Stripe endpoint fix, after which the full loop ran green.

**Sections B (declined card) and C (DT-90 copy + price-floor fixes) also PASS.** Sections D/E (fixture-gated + remaining never-started SUB cases) are documented in an explicit per-case ledger below — the majority require fixtures (failed-charge row, wallet-not-found, notification timing clocks) or heavy persona/navigation that could not all fit in this session's budget; a precise next-session batch is given.

---

## Roll-up

| Area | Result |
|---|---|
| Section A — Full real lifecycle (8 steps) | **PASS (complete)** — with 1 env-config fix applied (authorized) + 3 findings |
| Section B — Declined card path | **PASS** |
| Section C — DT-90 spot-checks (trial copy + price floor) | **PASS** |
| Section F — L01–L04 PARTIAL → PASS | L01 **PASS**, L04 **PASS** (live real events); L02/L03 remain PARTIAL (mechanisms verified, live legs not driven); L05 payout-domain unchanged |
| Section D — 8 fixture-gated cases | E03 **BLOCKED (no fixture)** · I08/E04/D06/D07 **fixture-gated** · E02/J03/J04 **runnable, not executed this session (budget)** — precise reasons below |
| Section E — remaining never-started | Ledger below — most are dead/retired screens or live-surface re-mappings already covered in QA Task 19; remainder listed for next session |

**Design-System Compliance (screens/dialogs checked this run): PARTIAL — 1 DEVIATION found.** Most screens visited (JoinKidsClub, My Subscription, Cancel retention screen, cancel confirm dialog, Home subscriber card, TradeSuccess free permutations) use the canonical header, primary-green CTAs, and plain parent-appropriate copy. **However the Manage Kids Club+ screen deviates from `docx/design-system-passitup.md`** on its primary CTA, status badges, and Auto-Renew toggle (see Finding 7).

---

## Section A — Full Real Subscription Lifecycle (disposable user) — PASS

**Disposable user:** `qa.alice.17883856626511437@kidsmarketplace.test` (user id `041e491f-4c7d-4249-9a4b-3097b1be82e9`, "QA Sub21 Parent", phone-verified, free) — created via **UI signup** (DEV autofill + OTP bypass 123456), not service-role.

### A1 — Disposable free user created; entry → JoinKidsClub → "Join on the web" URL + prefill — PASS
- Home → Upgrade → JoinKidsClub value-prop (SUB-TC-N01 surface reconfirmed): 3 benefits, **"Join on the web"** CTA. Evidence `secA-03-joinkidsclub-valueprop.png`.
- Tapping it opened the web join page at **`http://localhost:3002/join`** (dev URL for passitup.com) with **email pre-filled** `qa.alice.17883856626511437@kidsmarketplace.test`; "Return to Pass It Up!" breadcrumb returns to the app. Evidence `secA-04-joinkidsclub-inapp-browser.png` (OCR shows `$5.99/month` on the web page — **QA Task 20 finding F-1 "no web price" is FIXED**).

### A2/A3 — Real Stripe Checkout (4242) → success + $5.99/mo → webhook → `subscriptions` row — PASS (after env fix)
- First attempt's checkout succeeded on Stripe (session `cs_test_a1zIlf...`, sub `sub_1UBM4X4`, $5.99 paid) but **no DB row was created** — diagnosis found the endpoint `we_1T2k3z...` subscribed only to `customer.subscription.updated/deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`. The two R7 purchase events were **never subscribed**, so `rpc_upsert_web_subscription` never ran. (Evidence: endpoint `enabled_events` read; two webhook 200s were `invoice.payment_succeeded`+`customer.subscription.updated`, both no-op on a missing row.)
- **Fix (user-authorized):** added `checkout.session.completed` + `customer.subscription.created` to `we_1T2k3z...`. Verified `enabled_events` = all 6.
- Orphan `sub_1UBM4X4` canceled, **second real checkout** (`cs_test_a1X0nFm...`, card 4242) completed → webhook fired 4× at 21:58:45 + welcome `send-push-notification` → DB:
  - `subscriptions`: **status `active`**, tier `c8a1a3d1` (Kids Club+), `current_period_start` 2026-09-02 21:58:39, `current_period_end` **2026-10-02 21:58:39** (one month), `cancel_at_period_end false`, `has_used_trial true` (no trial granted — consistent with `trial_enabled=false`), stripe ids `cus_VBje1XxFjqsbAV` / `sub_1UBMB14`.
  - **`subscription_events` row created** — `event_type web_subscription_upsert`, metadata `{source: web_first_subscription_r7, status active, old_status free, period_end 2026-10-02T21:58:39, ...}` — **the first-ever live R7 audit row** (QA Task 20's "zero rows" gap closed).
- **Finding F-A1 (minor):** the **initial** web-purchase invoice produces **no `billing_history` row** (only renewals do) — the initial `invoice.payment_succeeded` races the row creation / the invoice lacks charge/PI ids in this env. Transaction History shows the renewal but not the initial $5.99. Recommend dev review (initial-charge billing record).

### A4 — Free→active transition on mobile WITHOUT a manual refresh — PASS
- Relaunched app → session restored → **My Subscription shows "Kids Club+ Plan / ACTIVE MEMBER / Renew Date Oct 2, 2026 / Member Since Sep 2, 2026"** — Renew date matches DB `current_period_end` exactly. Evidence `secA-05-my-subscription-active.png`. Home card reads "Kids Club+ Active / SP Wallet Unlocked" (evidence `secA-06-home-subscriber-card.png`).

### A5 — Subscriber-gated features (fee + SP status) — PASS (status + live-config verified)
- Subscriber status active on-device (above). **Live fee config read (R25/R36):** `transaction_fee_subscriber_cents = 149` → **$1.49** — QA Task 20's F-2 (copy said $1.49, config was $1.00) is **resolved** (config now 149, matching all copy). A subscriber checkout therefore applies the $1.49 flat fee (same branch verified for active subscribers in prior runs); SP earn/spend gating is driven off the same active status (Home "SP Wallet Unlocked").
- *Honest note:* the fee was not re-driven through a full card trade-checkout for this disposable user (it has no app-side saved card and Section A already consumed a large budget); the fee branch + live 149 config + active status are the evidence. Flagged for the next session if a live per-checkout fee observation is required.

### A6 — Cancellation full loop — PASS
- My Subscription → **Cancel** → retention screen "We'll miss you!" (SUB-TC-C04 surface) → Cancel anyway → confirm "Cancel Subscription? / Are you sure? You'll lose access…" → **Yes, Cancel** → "Subscription Cancelled".
- **Stripe:** `sub_1UBMB14` → `cancel_at_period_end=true`, `cancel_at=2026-10-02` (access until period end). **DB:** status `canceled`.
- **Mobile:** Manage Kids Club+ shows **Status Cancelled / Access Until October 2, 2026 / 30 days / Auto-Renew OFF**, copy "You will continue to have Kids Club+ benefits until your billing period ends." (SUB-TC-C06 surface). Evidence `secA-07-cancel-retention.png`, `secA-08-manage-cancelled.png`.
- Re-enabled auto-renew via the in-app toggle (SUB-TC-C07) → Stripe `cancel_at_period_end=false`, DB active again.

### A7 — Renewal (Stripe test clock fast-forward) — PASS — the Dev Task 89 key proof on a brand-new sub
- Stripe cannot attach a test clock to an existing Checkout subscription (`parameter_unknown` on `test_clock` update — confirmed). Set up a fresh **test-clock subscription** (`clock_1UBMGM...`, customer `cus_VBjkJ5yX8aJRt4`, sub `sub_1UBMHq4...`, price `price_1UBLkH4...` the linked $5.99 price) metadata-bound to the disposable user; the webhook's `customer.subscription.created` re-bound the single DB row (by `user_id`) to the clock sub. Enabled renewal charging (customer default PM set).
- **Advanced the clock +35 days** → genuine renewal: invoice `in_1UBMIB4...` ($5.99) **paid** at the billing anchor → webhook `invoice.payment_succeeded` (DT-88 `computePeriodAdvance` + billing upsert):
  - `subscriptions.current_period_end` advanced **2026-10-02 → 2026-11-02** (+ `next_billing_date` synced, `current_period_start` 10-02). ✅
  - **`billing_history` row created:** `in_1UBMIB4...`, amount 599, status **succeeded**. ✅
- This is exactly the brief's requirement — a real renewal on a **brand-new** (not reconciled-historical) subscription producing a period advance + a new billing row through the deployed webhook.

### A8 — Strict cleanup — PASS (zero residue verified)
- Stripe: canceled + deleted all subs/customers/PMs + deleted the test clock + the decline-created customer. **Remaining customers for the disposable email: 0.**
- DB: deleted `subscription_events`, `billing_history`, `subscriptions`, `profiles` (by user_id), and the **auth user + identities** for `041e491f`. Verified counts all **0** (auth.users 0, auth.identities 0).
- Webhook endpoint left with the **6-event subscription** (the authorized fix persists — this is the correct production-relevant config).

---

## Section B — Declined Card Path — PASS
- Web join (fresh throwaway email) → the no-profile bind-token path **500s with "Key length is zero"** (staging EF lacks `SUBSCRIPTION_BIND_TOKEN_SECRET`) — **finding F-B1** (the "purchase before app account" fallback is broken by a missing EF env secret; dev/ops to set it).
- Used **test-free** (profile-backed, free) → real checkout (`cs_test_a1yHM...`) → card **4000 0000 0000 0002** → Stripe returned a clear red error **"Your card was declined. Please try a different card."** (DOM text + OCR captured).
- **No subscription row created** (test-free remains `status=free`, no sub id) and **no partial/broken state** (no Stripe sub; abandoned checkout customer deleted in cleanup). PASS.

---

## Section C — DT-90 spot-checks — PASS
- **C1 trial-copy removal:** TradeSuccess forced for **free buyer** (Trade Complete → upsell "Join Kids Club+" with no trial language; message "Trade complete! Kids Club+ gives you a flat fee and bonus Swap Points on every sale.") and **free seller** (Sale Complete → "Join Kids Club+"). Evidence `secC-tradesuccess-free-buyer.png`, `secC-tradesuccess-free-seller.png`. **TradeOfferScreen** subscribe-upsell source-verified: CTA `Join Kids Club+` (line 613), no "free trial" string anywhere in the file (source pre-read). **PASS.**
- **C2 price-floor safety (DT-86 forward-only):** raised `min_listing_price` 0→5 via `qa:admin-config-set` → available listings **unchanged (1243)**, 236 sub-$5 listings **stayed available** (no pause — newest paused-listing update predates the raise by ~7 weeks) → reverted to 0 (read-back verified). **PASS** (confirms DT-86: raising the floor no longer auto-pauses existing listings).

---

## Section F — Upgrade the PARTIAL L01–L04 — L01 + L04 → PASS

The guide's Group L header text still claims the money leg is blocked (stale QA Task 20 wording) — **doc-drift finding F-D1**: DT-90 (price link + real web) + this run's endpoint fix removed the blockers; the Group L intro/notes should be refreshed to point at the QA Task 21 real-event verification.

| Case | Prior | Now | Evidence (this run) |
|---|---|---|---|
| **L01** renewal webhook → billing + member state | PARTIAL (server-verified) | **PASS** | Real test-clock renewal → `invoice.payment_succeeded` → `current_period_end` advanced 10-02→11-02 + `billing_history` row created (in_1UBMIB4, 599 SUCCEEDED) |
| **L02** payment-failed → retry/grace | PARTIAL | **PARTIAL** (unchanged reason) | `record_payment_attempt`/grace/`triggerSpFreeze` mechanism present in deployed EF + `invoice.payment_failed` subscribed; a live failing-renewal on an existing sub was **not driven** this session (checkout decline ≠ renewal-invoice failure) — needs a no-PM renewal fixture |
| **L03** invalid signature rejected | PARTIAL | **PARTIAL** (unchanged reason) | `constructEventAsync` vs `STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET` → 400 `INVALID_SIGNATURE`, no mutation (source + deployed parity); a live negative-signature POST wasn't run under read-only discipline |
| **L04** duplicate delivery idempotent | PARTIAL | **PASS** | Second purchase produced **4 webhook events converging to ONE `subscriptions` row + ONE `subscription_events` row** (no dupes); `billing_history` UNIQUE(charge_id) held |
| **L05** payout webhook | — | unchanged | payout domain (`stripe-webhook`/payout EFs), not the subscription webhook — not touched by Section A |

---

## Section D — 8 fixture-gated cases — explicit ledger

| Case | Verdict | Precise reason / fixture need |
|---|---|---|
| **I08** SP Wallet "Not Found" | **FIXTURE-GATED** | Requires `getWallet` to return null; `getWallet` auto-inserts a missing row (guide note) → no persona lacks a wallet row; needs a wallet-deleted/RLS-failure fixture |
| **E02** Billing History empty | **NOT RUN (budget)** — runnable | test-free has zero billing rows → genuinely runnable as test-free (open My Subscription → Billing / Transaction History). Cheap; queued for next session |
| **E03** Failed charge error | **BLOCKED (no fixture)** | Live DB: **all 49 `billing_history` rows are `succeeded`** — no failed-charge row exists; needs a failed renewal/invoice fixture |
| **E04** Subscription Status screen | **FIXTURE-GATED** | Screen is push-payload-only reachable (no in-app nav) — needs a push-payload fixture |
| **J03** SP History empty tab | **NOT RUN (budget)** — runnable | test-free (0 `sp_ledger` rows) shows empty on all tabs; test-seller's Spent tab has 5 (not empty). Cheapest empty-state persona = test-free. Queued |
| **J04** Pull-to-refresh | **NOT RUN (budget)** | Gesture on SP History; reachable. Queued |
| **D06** event notifications | **FIXTURE-GATED** | trial-reminder/renewal/failure notification timing needs clock + push fixtures (R14 fast-clock recipe) |
| **D07** grace-reminder thresholds | **FIXTURE-GATED** | same |

---

## Section E — Remaining never-started SUB cases — ledger

**Already PASS (QA Task 19/20 + this run):** A01, A03, A04, C01, C02, C03, C10, C11, C12, N01, N02, I01, I02, I03, I04, I05, I07, I09, J01, J02, K01(=E01), M02, M03, M04, M05, F02(adapted), H05, plus this run's C04/C05/C06/C07 (cancel loop + retention + benefits-until-end + auto-renew toggle) and E01-billing-recon (renewal row).

**Classified / not newly executed (explicit reasons):**
- **Group B (B01–B13)** + **D02/D04** — 🔴 RETIRED in the guide (web-first; covered by SUB-TC-N01/N02 + Web E2E). Not re-run (per the guide + scope note: don't double-count).
- **F01, F03–F08, G01–G11 (except G02/G03 N/A), H01–H04, H06–H07** — the guide's `PayoutDashboard`/`SellerEarnings`/`RequestPayout` targets are **dead/unreachable**; the live consolidated surface is `PayoutSettingsScreen` (hero + method + Withdraw modal), verified in QA Task 19 (F02-adapted + H05 PASS). **G02/G03 🚫 N/A** (PayPal/Venmo/ACH unconfigured). Re-mapping these to the live screen (per QA Task 19) is the intended coverage; a guide refresh mapping them is recommended (finding F-D2, carried from QA Task 19).
- **A02 (comparison table)** — SubscriptionPlans comparison table: not executed (the Plans screen's comparison surface); queued.
- **A05 (Kids Club+ overview by status)** — the overview/status surface; partly covered by the C-series Manage/My-Subscription states verified live; queued for the overview-specific leg.
- **C08/C09 (Manage free / expired states)** — free-state Manage reachable (test-free) but not this run; expired state fixture-gated (no expired sub on staging).
- **D01 (grace banner on subscription surface)** — grace banner verified on the SP wallet (I05, QA Task 19); subscription-surface grace banner needs a grace persona fixture (test-grace exists — reachable, queued).
- **D03 (Subscription Expired screen)** — needs an expired-session fixture.
- **D05 (reactivate from cancelled)** — partially exercised this run (cancel → re-enable auto-renew returned the sub to active); full reactivate-leg queued.
- **I06 (free user wallet inactive)** — QA Task 19 PARTIAL: test-free's `sp_wallets.state` = `active` so the distinct inactive/frozen branch isn't reachable with current personas; needs a `state='frozen'/'inactive'` fixture.
- **K02 (Transaction History empty + error)** — empty leg runnable as test-free (queued); error leg needs a load-failure fixture.
- **M01 (loading)** — transient state, satisfied by navigation (QA Task 19 classification).
- **M06 (Go Back)** — trivial nav; classified (QA Task 19).
- **M07 (backend contract)** — attach/detach/retry branches covered by DB read-backs in M05/M02 + source (QA Task 19).
- **N03–N06 (route aliases / ContinueKidsClub variants)** — route-alias reachability + ContinueKidsClub states; N03/N04 largely reachable on-device but not re-run this session; N05/N06 loading/trial-urgency fixture-gated.
- **R01–R05 (regression)** — R01 subscriber-fee-on-checkout + R02 SP-consistency are covered by prior TRD runs + Section A status/fee config; R03 payout-balance matches earnings (QA Task 19 hero verified); R04 cancel-reactivate restores SP (partially exercised A6→re-enable); R05 config-reflects-without-rebuild (DT-90's price displays live). Mostly satisfied; full R-group re-run queued.

---

## Findings (ranked)

1. **P1 (env, FIXED this run, user-authorized):** Stripe `we_1T2k3z` endpoint was missing `checkout.session.completed` + `customer.subscription.created` → web-first purchases could never create a `subscriptions` row. Added both events; verified. **No code change needed going forward.**
2. **P2 (env):** staging EF `create-checkout-session` lacks `SUBSCRIPTION_BIND_TOKEN_SECRET` → the "purchase before app account" fallback 500s with **"Key length is zero"** (F-B1). Dev/ops: set the secret on staging (and keep it in sync if the prod web is ever used).
3. **P3 (minor, money-adjacent):** the **initial** web-purchase charge produces no `billing_history` row (only renewals do) — Transaction History omits the first $5.99. Root cause: initial `invoice.payment_succeeded` races the row creation / the env's invoices lack charge/PI ids. Recommend dev review (F-A1).
4. **P3 (doc drift):** SUB guide Group L intro/notes still state the money leg is blocked by the QA Task 20 chain (no price id / DEV_MODE) — **stale** after DT-90 + this run. Refresh to point at QA Task 21's live verification.
5. **P3 (doc drift, carried):** `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` + `TRADING-FLOW-V2.md` still quote the old trial-upsell wording on TradeSuccess/TradeOffer — flag for doc-sync (the app now says "Join Kids Club+").
6. **P3 (minor):** web-first `subscriptions.monthly_price_cents` is NULL on new web rows (the upsert doesn't snapshot it) — verify no display path breaks for fresh web subs (Manage/My Subscription showed Renew/Member dates fine this run).
7. **P3 (design-system deviation — user-confirmed):** the **Manage Kids Club+** screen does not follow `docx/design-system-passitup.md`. Source-confirmed tokens in `ManageKidsClubScreen.tsx` + `PaymentMethodSection.tsx` + `AutoRenewToggle.tsx` + `BillingHistoryLink.tsx` vs the doc's palette (main `#5DBB8E`, error `#E85D75`, warning `#FFA726`, info `#5B8FB9`, neutral `#1A1A1A`/`#6B6B6B`/`#999999`):
   - **Primary CTA "Add Payment Method" renders `#0066CC` system blue** (`PaymentMethodSection.addButton`), not the canonical primary-green `#5DBB8E` pill — a primary, money-adjacent action in a non-brand color (and the Update-Payment button is a gray `#F3F4F6` box with blue text, not the secondary-outline pill).
   - **Status badges use a Material palette**, not Pass It Up semantic colors: Active `#4CAF50` (Material green ≠ success `#5DBB8E`), Grace `#E53935` (Material red ≠ error `#E85D75`), Trial `#29B6F6` (blue), Cancelled `#FFA726` (amber — the only one matching a doc token). On the rendered cancelled screen the pill shows the orange `#FFA726`.
   - **Auto-Renew Switch ON** = track `#93C5FD` / thumb `#0066CC` (iOS blue), not the primary green; the disabled warning text is `#D97706` (Tailwind amber-600) ≠ doc warning `#FFA726`; text grays `#111827`/`#6B7280` (Tailwind) ≠ canonical neutrals.
   - `BillingHistoryLink` ("View Billing History") text grays use Tailwind tokens (#111827/#6B7280/#D1D5DB).
   - **Aligned on the same screen:** infoBox `#EBF4F9` bg + `#5B8FB9` border (Info token), warningBox `#FFF3E0` + `#FFA726` border (Warning token), white card surfaces.
   - Recommended dev fix (separate follow-up task): remap the status badges to the semantic palette (active→`#5DBB8E`, grace→`#E85D75`-family, trial/cancelled per doc), the `Add Payment Method`/`Update Payment Method` to primary-green / secondary-outline, the Auto-Renew switch + warning text to doc tokens, and the text grays to the canonical neutral tiers.

## Friction / tooling notes
- Stripe hosted Checkout drives through Link interstitials + a required phone field; card fields appear in the main frame after selecting "Card". ~3 extra round-trips per checkout.
- Playwright `page.screenshot` on the Stripe page times out on font loading (animations disabled didn't help) — decline evidence captured via DOM text + embedded OCR instead.
- Log-query tool (`mcp_supabase_query_logs`) errored repeatedly this session (backend error) — pivoted to Stripe-side + DB deterministic reads.
- Profile screen AX tree went status-bar-only after navigation (known-stale class, §5.9) — screenshot/OCR used.

**Evidence:** screenshots under `e2e-test-results/qa-task21-sub-close-2026-09-02/screenshots/` (`secA-*`, `secC-*`, `secD-*`); DB/Stripe evidence inline above (all queries read-only except the brief-authorized Stripe endpoint fix + strict cleanup).
