# Dev Task R41 — Combined Fixture-Build Session (SUB + MSG gated cases) — Runbook

Date: 2026-09-03. Owner: dev team. This is the **fixture engineering** record for
making currently-unreachable QA states reachable. It accompanies the code/scripts
(Phase 1) and lists exactly what still needs staging execution (Phase 2, requires
Samer's approval per the MCP Usage Protocol / BP-80).

**Two-phase status convention:** every item below is either ✅ **fixture built
(Phase 1 code shipped — NOT executed against staging)** / 🚫 **not buildable +
why** / 🟡 **needs a product/infra decision first**. Execution against staging is
separately approval-gated; nothing here was run on staging in this session.

---

## New/updated artifacts (this session)

| Artifact | Purpose |
|---|---|
| `src/services/devTestingService.ts` | New session-local toggle `sp_wallet_not_found` (SUB-TC-I08) |
| `src/services/sp/wallet.ts` | `getWallet` short-circuits to `null` when the I08 toggle is armed (dev/test only) |
| `scripts/seed-staging-data.ts` | New standing persona `test-expired` (+ `seedExpiredPersonaFixture()`) |
| `src/services/qaPersonas.ts` | `test-expired` added to the `qa-login-as` registry |
| `scripts/qa/lib/r41-common.mjs` | Shared env/client/persona/JWT/EF helpers for the R41 scripts |
| `scripts/qa/r41-sub-fixtures.mjs` | `billing-failed` (E03) · `notif-sub-status` (E04) · `notif-sub-event` (D06/D07/R02) · `wallet-state` (I06/I05) |
| `scripts/qa/r41-moderation-fixtures.mjs` | MSG G01–G07 / G09: `list` / `apply` / `reset` a listing's moderation state |
| `scripts/qa/r41-dispute-fixture.mjs` | MSG H05/H06: `find` / `open` (real open-dispute EF) / `reset` a trade dispute |
| `scripts/qa/r41-in-progress-trade.mjs` | QA 31-M FG-1 (DEV-TASK-110): `find` / `create` / `reset` a sanctioned in_progress single trade (dispute + changed-value timing legs) |
| `scripts/qa/r41-reported-review-fixture.mjs` | QA 31-M FG-2 (DEV-TASK-110): `find` / `create` / `reset` a reported review (Q01–Q06 + mobile display leg) |
| `scripts/qa/r41-first-trade-free.mjs` | DEV-TASK-113 (F08 leg): standing FREE genuinely-first-trade persona `qa-first-trade` — `create` (persona + saved card + tagged item) · `verify-fee` (headless fn_get_buyer_fee_for_checkout) · `drive-offer` (headless real create-trade-offer) · `reset` (BP-70 full persona cleanup) |
| `scripts/qa/dev-task-r41-l02-failing-renewal.mjs` | SUB-TC-L02: real test-clock 3-failure renewal cycle on a disposable user |
| `package.json` | `qa:r41-sub`, `qa:r41-moderation`, `qa:r41-dispute`, `qa:r41-l02-failing-renewal`, `qa:r41-in-progress-trade`, `qa:r41-review`, `qa:r41-first-trade` |

All commands run from `p2p-kids-marketplace/`. All writes are service-role against
**staging** — dev-team run, one call at a time, with Samer's approval. `--dry-run`
on every script is read-only.

---

## PART 0 — DEV-TASK-113 (2026-09-05) — genuinely-first-trade FREE persona fixture (F08 remaining leg)

- **Fixture built (Phase 1 code):** `npm run qa:r41-first-trade -- create` provisions a standing free persona `qa-first-trade` (`a1234567-…-000000000014`, `qa-first-trade@kidsmarketplace.test`, `TestFirstTrade123!`, registered in `r41-common.mjs PERSONAS` + `qaPersonas.ts`) with a saved Stripe test card (MASTERCARD •••• 4444, `tok_mastercard`) and NO `trial|active` subscription (signup trigger `status='free'` row only), so `profiles.fee_state` stays `no_completed_trade` / `completed_trade_count` 0 — plus one tagged Accept-SP item on test-seller.
- **Phase 2 — EXECUTED (owner-approved 2026-09-05, this run):** `create` ✅ (persona `a1234567-0000-0000-0000-000000000014`, card `pm_1UCIuV4I6kCJlvXoSovEnPNm` / customer `cus_VCiLNyxeb4WDix`, item `89a6573a-ae66-488e-9805-6979dc6e5c27` $25 Accept-SP on test-seller) → `verify-fee` ✅ (`profiles.fee_state=no_completed_trade` `completed_trade_count=0`; `fn_get_buyer_fee_for_checkout` → **fee_cents=149** = `buyer_fee_first_trade_cents`). **Persona + item left STAGED for the QA on-device F08 leg (do NOT reset yet).**
- **Remaining Phase 2 (QA on-device):** make a real offer as `qa-first-trade` (offer fee snapshot 149 + `buyer_fee_state`) → complete the FIRST trade → second offer on the same persona must revert to the normal fee → `reset` (0 residue). `drive-offer` offers a headless real create-trade-offer leg (voids its own auth hold) if wanted.
- **Registration:** persona registry `/memories/repo/qa-test-accounts.md` updated.

---

## PART 1 — SUB items

### SUB-TC-I08 · SP Wallet "Not Found" — ✅ built (app toggle)
- **Fixture:** session-local QA toggle `sp_wallet_not_found` (`value=not_found`).
  When armed, `getWallet` returns `null` before any DB read → `SpWalletScreen`
  renders the 💳 "Wallet Not Found" / "Unable to load your SP wallet." branch.
- **Why a toggle (not a persona):** `getWallet` auto-inserts a missing row on
  read, so "no wallet row" can never surface this branch on a healthy session;
  the branch is only reachable via a select/insert failure. The toggle
  reproduces exactly that without breaking the auto-insert safety net for real
  users (dev/test-gated, fail-closed in release, 60-min TTL, cleared on logout).
- **QA usage:** `xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=sp_wallet_not_found&value=not_found"` → login → open SP Wallet → expect 💳 Wallet Not Found. Disarm with `value=none`.

### SUB-TC-E03 · Failed-charge billing row — ✅ built (`r41-sub billing-failed`)
- **Fixture:** inserts one `billing_history` row `status='failed'` +
  `error_message` for a standing persona (default **test-buyer**, its current
  `subscriptions` row is the FK). Idempotent by a distinctive `charge_id`;
  `--remove` deletes it. Transaction History (Profile → Billing History) then
  shows the red **Failed** badge + the error message text.
- **Run:** `npm run qa:r41-sub -- billing-failed --persona test-buyer` (+ `--remove` after).
- **Note:** this is a direct-seed fixture (a live Stripe failure is impractical
  for a standing persona's UI row and would also mutate real Stripe state). The
  genuine-failure path is covered separately by L02.

### SUB-TC-E04 · Subscription Status screen — ✅ built (`r41-sub notif-sub-status`)
- **Fixture:** inserts an in-app `user_notifications` row whose
  `data.deep_link='/subscription/status'` — the **only** way to reach
  `SubscriptionStatusScreen` (no in-app nav entry, not in React-Nav linking).
  No push round-trip needed; QA taps it in the Notification Center.
- **Run:** `npm run qa:r41-sub -- notif-sub-status --persona test-buyer` (+ `--remove`).

### SUB-TC-D06 / D07 · Notification timing (reminders / grace thresholds) — 🟡 partial; see below
- **Fast-clock confirmation:** ✅ the R14/QA-Task-21 test-clock technique **still
  applies** post-DT89/94 webhook changes — the webhook EF (v50) is exactly what
  DT94's live repro + QA Task 21 used on 2026-09-03 to advance `current_period_end`
  and write `billing_history`. Renewal-success and payment-failure legs are
  drivable via real clock-advanced invoices (see L02).
- **Built (in-app fixture half):** `r41-sub notif-sub-event` inserts the
  producer-faithful in-app rows (`trial_reminder_7d/3d/1d`, `renewal_success`,
  `payment_failed` (data.critical), `cancellation`, `grace_reminder_30/7/1`) so
  QA can observe the correct copy/icon/critical treatment + tap-through to
  Manage Kids Club+. `--type-override` forces the granular NotificationCenter
  icon (e.g. red `payment_failed`) for icon-level assertions.
- **🟡 NOT fixture-buildable here — needs decision/infra:** the *"fires at the
  exact real moment"* legs require the daily pg_cron jobs (`trial-reminders-daily`
  10:00, `grace-period-daily` 03:00) to run against backdated trial/grace rows
  AND real push delivery. The grace cron also has two known defects (writes to a
  non-existent `notifications` table for the in-app leg; references
  `grace_reminder_sent_day_*` columns that exist in NO migration). Those are
  infra/defect items, not fixtures — flag for a decision before D06/D07 can be
  fully closed.

### SUB-TC-L02 · Live failing-renewal leg — ✅ script built (`qa:r41-l02-failing-renewal`)
- **Fixture:** disposable user + Stripe test clock + `tok_visa` PM (period 1 paid
  → active), then the default PM is **removed** (the QA Task 21/22 no-PM
  precondition) and the clock advanced past the period-2 anchor and through
  Stripe's dunning cadence, reading back `subscriptions.payment_retry_count` /
  `payment_failed_at` / grace fields / `sp_wallets.state` / critical
  notifications each step. Targets the real `record_payment_attempt` →
  3-failure → grace-entry path.
- **DEV-TASK-99 (2026-09-03) — grace entry now wired (R6 model):** the Phase-2
  log below shows the 3rd failure left the sub `active` + wallet `active` (the
  old `triggerSpFreeze` no-oped on an unset `SP_SUBSCRIPTION_LAPSE_URL`). DT99
  replaced that HTTP seam with first-party RPCs in the webhook: on the 3rd
  failure the sub → `grace_period` (with grace dates) and the wallet →
  `grace_period` (R6 spendable-grace; **NOT `frozen`** — the grace-period cron
  freezes it only after the window ends). The script's PASS assertion now
  expects `sub.status='grace_period'` AND `wallet.state='grace_period'`.
- **Run (Phase 2, approval-gated):** `npm run qa:r41-l02-failing-renewal`.
- **Caveat:** Stripe's retry schedule is account-specific; if the full 3-cycle
  doesn't complete within the advance window the script reports how far
  `payment_retry_count` got rather than fabricating a pass (retry ≥ 1 still
  exercises the real path).

### SUB-TC-C09 / D03 · Populated expired-date leg — ✅ persona built (`test-expired`)
- **Fixture:** new standing persona **test-expired**
  (`test-expired@kidsmarketplace.test` / `TestExpired123!`, fixed UUID
  `a1234567-…-000013`) provisioned by `seed:staging`
  (`seedExpiredPersonaFixture()`): `subscriptions.status='expired'` with past
  period/grace dates + `sp_wallets.state='frozen'` (the shape the grace cron
  produces on lapse). Login lands on the navigator's `SubscriptionExpired`
  initial route (D03's reachable branch) and Manage Kids Club+ shows the
  expired info box + Re-subscribe CTA (C09). One-call login via
  `p2pkidsmarketplace://qa-login-as?persona=test-expired`.
- **🟡 gap flagged (needs product decision):** `SubscriptionExpiredScreen`'s
  *"Your {planName} plan ended on {expiredDate}"* branch only renders when
  navigation passes `{planName, expiredDate}` params — nothing in production
  passes them (the navigator mounts it with no params → "no longer active"
  copy). If the real date should be derived from the subscription row rather
  than route params, that is a small product/UX decision + code change.

### SUB-TC-I06 (free wallet) / I05 (frozen banner) — ✅ helper built
- **Fact check that reshapes this item:** `sp_wallets.state` CHECK allows only
  `active|frozen|grace_period|suspended` — **`inactive` is NOT a valid DB value**;
  it is an app-only fallback when no wallet row exists (summary RPC), and
  `getWallet` auto-inserts on the wallet screen anyway. So I06's free-user
  "inactive" visual (banner suppressed, spend gated) is already the standing
  **test-free** persona — no new fixture needed for the free case.
- **Built:** `r41-sub wallet-state` sets a persona's `sp_wallets.state`
  (`frozen|suspended|grace_period|active`) with the freeze/clear-frozen fields,
  for the frozen/suspended banner legs (I05 + TRD freeze cases). NOTE: session
  `wallet_state` is cached — refresh (pull-to-refresh / `qa:refresh` deep link)
  after setting. Restore with `--state active`.

---

## PART 2 — MSG items

### MSG-TC-G01–G05 (Safety Review screen: flagged/rejected/needs_edits) — ✅ built
- **Task-premise correction:** the premise "the recall/AI-flagging check runs
  inside the listing-creation EF (no DB trigger), so it can't be seeded via SQL"
  is **wrong for the item STATE**. `items.status` allows all three values, no
  trigger overrides a service-role UPDATE, and the BEFORE-UPDATE trigger
  `on_item_status_change_notify_seller` auto-creates the seller's in-app
  notification — so the states (and their notifications) ARE SQL-seedable on a
  standing persona. The EF-only part is the optional `item_safety_flags` side
  row, which the fixture also inserts.
- **Fixture:** `npm run qa:r41-moderation -- list` (pick a test-seller QA_POOL
  item) → `npm run qa:r41-moderation -- apply --listing-id <id> --state flagged|rejected|needs_edits [--flag-type cpsc_recall]` → QA logs in as the seller → My
  Listings → tap → Safety Review (G01), appeal (G02), needs-edits resubmit
  (G03), remove (G04). `--flag-type cpsc_recall` adds the recall side-flag for
  the G05/G09 banner leg. Reset after: `reset --listing-id <id>`.
- **🟡 G05/R03 gap (needs product decision):** no production code creates a
  `recall_alert` ("Safety Alert") **notification** — `check-item-safety` only
  flags the item (which triggers the generic `item_flagged` "Item Under Review"
  notification). The guide's recall-notification wording is unverified (flagged
  in the guide 2026-08-12). Until a recall-alert notification producer is
  decided/built, the G05/R03 *notification* leg is not testable as written; the
  item-flagged banner leg IS reachable via this fixture.

### MSG-TC-G06 · Appeal max attempts — ✅ fixture + config round-trip
- `apply --state rejected --appeal-count 3` presets the counter the client
  checks (`appeal_count >= moderation_appeal_max_attempts` (default 3)) → a
  fresh appeal hits "Appeal limit reached…". To verify the config-driven path,
  set `moderation_appeal_max_attempts` to `1` via
  `npm run qa:admin-config-set -- set --key moderation_appeal_max_attempts --value 1 --category moderation --data-type number` → appeal once (edit first:
  `edited_since_rejection` is required by the client) → admin re-rejects (or
  `apply` again) → second appeal blocked → **revert to `3`** and read back.

### MSG-TC-G07 · Appeal window days — ✅ built (backdate)
- `apply --state rejected --backdate-days 15` backdates `rejected_at` past the
  14-day `moderation_appeal_window_days` default → appeal attempts hit the
  "Appeal window has expired…" check. Compare against a fresh (≤24h) rejection
  for the contrast leg. To verify the config-driven variant, temporarily set
  `moderation_appeal_window_days` to `1` (qa:admin-config-set) and revert to
  `14` after.

### MSG-TC-G08 · AI moderation toggle — 🟡 NOT a fixture problem; needs infra
- **Verdict:** not solvable as a pure fixture. It depends on whether the Google
  Vision `analyze-item-image`/`moderate-image` Edge Functions are actually
  reachable/configured from staging AND on an image fixture that consistently
  triggers them. This session did NOT verify that infrastructure (would require
  live EF invocations against staging + billed external calls). Until the AI
  vision service availability on staging is confirmed, G08 stays gated — do not
  build a fake fixture that doesn't test the real path. The config toggle
  (`moderation_ai_enabled` true/false) round-trip is trivial via
  `qa:admin-config-set` (category `moderation`), but the *behavioral* assertion
  needs the real service. **Product/infra decision required.**

### MSG-TC-G09 · Recall toggle/threshold — 🟡 partial (config + banner fixture built; live-create leg gated)
- Config toggle round-trip built (`cpsc_recall_check_enabled` category `safety`,
  boolean; `cpsc_match_threshold` numeric — note there is no seed row for
  `cpsc_match_threshold`, the EF falls back to 0.5). The G05 banner fixture
  (`apply --flag-type cpsc_recall`) reaches the flagged state + `item_safety_flags`
  row. The true "recall check runs at listing creation and flags it" comparison
  leg still needs a `cpsc_recalls` row for a known product + a real New-Item
  create through the app (or a lighter scripted EF call to `check-item-safety`),
  which depends on the G05/G08 infra decisions above.

### MSG-TC-H05 / H06 · Dispute under-review / resolve — ✅ fixture built
- **Fixture:** `npm run qa:r41-dispute -- find` lists in_progress unreported
  trades on the standing pair → `open --trade-id <id>` drives the **real**
  buyer-report path (buyer JWT → `open-dispute` EF → `dispute_status='reported'`).
  The admin Dispute queue then has a real dispute for H05 (Mark Under Review)
  and H06 (Resolve Complete / Refund). `reset --trade-id <id>` restores to
  'none' + removes the EF-created event/notification rows.
- **Caveat:** requires an existing in_progress (not pending-offer) trade between
  test-buyer & test-seller. Seeded offers are `pending`; in_progress trades come
  from prior runs / extended bundle seeds. If none exists, drive a real offer →
  accept first (app or `qa:ef-repro` + accept), then `open`.

### MSG-TC-R02 · Notification tap-through — ✅ built (presets)
- Message tap-through is already verified (I07). The remaining legs:
  `r41-sub notif-sub-event --preset trade_completed --trade-id <id>` (buyer) and
  `--preset listing_approved --listing-id <id>` (seller) insert correctly-shaped
  in-app rows (deep_link `/trades/<id>` and `/listing/<id>`) → tap routes to the
  right screen and read state updates. Clean with `--remove`.

### MSG-TC-R03 · Recall non-suppressibility — 🟡 depends on G05 product decision
- The "critical safety push still delivered with all Safety toggles off" leg
  needs a real recall-alert push producer (which doesn't exist — see G05 gap)
  and real push delivery (simulator limitation). Notification-preference
  structure (safety category always-on helper copy) can be verified statically,
  but the end-to-end suppression leg is gated on the same product decision as
  G05.

---

## Config round-trip baselines (revert targets)

| Key | Baseline (staging 2026-09-03) | Category | Written via |
|---|---|---|---|
| `moderation_appeal_max_attempts` | `3` | moderation | qa:admin-config-set |
| `moderation_appeal_window_days` | `14` | moderation | qa:admin-config-set |
| `moderation_ai_enabled` | `true` | moderation | qa:admin-config-set |
| `cpsc_recall_check_enabled` | `true` | safety | qa:admin-config-set |
| `cpsc_match_threshold` | (no row → EF default 0.5) | safety | qa:admin-config-set |
| `grace_period_days` | `30` (DT94; display clamp 60) | subscription | qa:admin-config-set |
| `grace_reminder_thresholds` | `[60,30,7,1]` | subscription | qa:admin-config-set |
| editor | `1a546991-5361-4b4e-b44b-eee9bf730757` (samer) | — | BP-48 RPC |

Discipline: scope to the test value → verify on-device → revert → verify revert via
read-only SQL. Record writes/reverts in the run report.

## Standing-persona registry additions (this session)

| Persona | Email / password | Fixed UUID | Purpose |
|---|---|---|---|
| `test-expired` | `test-expired@kidsmarketplace.test` / `TestExpired123!` | `a1234567-0000-0000-0000-000000000013` | SUB-TC-C09/D03 genuinely-expired membership (subscriptions.status='expired', wallet frozen) |

Login via `p2pkidsmarketplace://qa-login-as?persona=test-expired` (registered in
`src/services/qaPersonas.ts`).

## Phase-2 execution log — 2026-09-03 (owner-approved; project drntwgporzabmxdqykrp)

All steps below were EXECUTED against staging and verified by read-back.

| Step | Result |
|---|---|
| `npm run seed:staging` | ✅ exit 0 — `test-expired` provisioned (`subscriptions.status='expired'`, `sp_wallets.state='frozen'`, VERIFY OK). Pre-existing seed warnings (SP-ledger `wallet_id` null + "Trade Master" badge CHECK) unrelated to R41. |
| `qa:r41-sub billing-failed` (test-buyer) | ✅ staged + read-back FOUND — `billing_history` row `charge_id=qa_r41_e03_failed_49243010`, `status='failed'`, `amount=599`, `error_message` set. LEFT for QA (E03). |
| `qa:r41-sub notif-sub-status` (test-buyer) | ✅ staged — row `62dfdbf5…`, `data.deep_link='/subscription/status'`. LEFT for QA (E04). |
| `qa:r41-moderation apply` ×5 (test-seller, leftover "Cash-Only Item" listings) | ✅ staged + read-back — set-aside for the G-series (reset after QA):<br>• **flagged** `ba6345ce-ed31-4a78-903f-32ccacbf53c4`<br>• **rejected (fresh, G02)** `ccf97ae4-d74a-4e42-a78a-023202ae56af`<br>• **rejected backdated 15d (G07)** `e2096de2-6194-4e12-93d0-8eb18a921ce3` (`rejected_at=2026-08-19`)<br>• **needs_edits (G03)** `afd3384a-d38c-4d64-a9e9-0929e5dd1933`<br>• **rejected appeal_count=3 (G06)** `ce322cd9-d516-4a8e-b5c3-e78db8da6b2e`<br>Seller in-app notifications auto-created for all (item_flagged/item_rejected×2/item_needs_edits) via the status trigger. |
| `qa:r41-dispute open` | ✅ staged + read-back — trade `943097a5-89bd-4361-9525-d1a1689682b9` (in_progress, non-bundle) → `dispute_status='reported'` via real `open-dispute` EF (buyer JWT, HTTP 200); `trade_events.trade_disputed` + `trade_notification_log.trade_dispute_opened` (→ seller) verified. LEFT for QA (H05/H06). |
| `qa:r41-l02-failing-renewal --advances 22` | ✅ LIVE VERIFIED (disposable, residue-clean): real 3-failure cycle → `payment_retry_count=3/3`, `payment_failed_at` set, **3 critical `payment_failed` notifications** (`data.critical=true`). ⚠️ **Finding:** the subscription stayed `active` and the wallet stayed `active` — the intended grace-entry + SP-freeze after max retries does **NOT** fire on staging: `record_payment_attempt` only increments the counter, and `triggerSpFreeze` is a no-op because `SP_SUBSCRIPTION_LAPSE_URL` is unset (webhook EF `// TODO(MODULE-09)`) and no lapse EF is deployed; the grace cron only processes rows already `grace_period`. → **Infra/product decision needed** to fully close L02's expected-result bullet. |

### Staged state QA should know about (App State Left Behind)
- **test-expired** persona is live for C09/D03 (`qa-login-as?persona=test-expired`).
- test-buyer now shows a **failed** billing row (E03) and a **/subscription/status** notification (E04).
- test-seller owns **5 set-aside moderation listings** above (flagged/rejected×2/needs_edits). Reset each after the G-series:
  `npm run qa:r41-moderation -- reset --listing-id <id>` (per id).
- Trade `943097a5…` carries a **reported** dispute (H05/H06). Reset after: `npm run qa:r41-dispute -- reset --trade-id 943097a5-89bd-4361-9525-d1a1689682b9`.
- These do NOT touch the seed's named fixtures (LEGO/Kids Bicycle/QA_POOL etc.) — trade legs are unaffected.

### Remaining Phase-2 (approval-gated / decision-gated — NOT run)
- D06/D07 `notif-sub-event` presets: apply on demand at the QA run (they are run-specific; several map to states test-buyer isn't in). Requires the D06/D07 infra decisions.
- I06/I05 `wallet-state`: dev applies on demand at the QA run; do NOT leave a shared persona frozen.
- G08/G05/R03/G09 live-create legs: gated on the AI-vision reachability / recall-alert-producer decisions.
- L02 grace/freeze leg: gated on the `SP_SUBSCRIPTION_LAPSE_URL` / grace-cron decision.

---

## DEV-TASK-110 addendum (2026-09-04) — QA Task 31-M fixture enablers (FG-1 / FG-2) + moderation cleanup fix

Date: 2026-09-04. Owner: dev team. Phase 1 only — nothing below was executed against staging
in this session (BP-80 two-phase; approval-gated).

### New artifacts (see table above)
- `scripts/qa/r41-in-progress-trade.mjs` — **FG-1** (unblocks ADM-TC-I03/I04/X06 dispute-reflection +
  F03/F05/F06/F08 changed-value timing legs). `find | create [--with-auto-complete] | reset`.
  - `create` stages ONE disposable in_progress non-bundle trade (test-buyer → test-seller) with
    `dispute_status='none'` — report it with `qa:r41-dispute open --trade-id <id>`; `reset` deletes
    every tagged trade (notes `fixture:qa_r41_inprog_trade:*`) + its item + EF side rows.
  - `--with-auto-complete` sets `auto_complete_at` from current `pickup_window_hours` (fallback
    `auto_complete_hours` → 72h, mirroring `fn_set_auto_complete_at`) so the mobile pickup/
    auto-complete countdown reflects the CURRENT admin_config timing (F-group changed-value legs).
    Default (no flag) leaves it NULL so the auto-complete cron never touches the fixture.
  - Command: `npm run qa:r41-in-progress-trade -- create` (then `qa:r41-dispute open --trade-id …`).
- `scripts/qa/r41-reported-review-fixture.mjs` — **FG-2** (unblocks ADM-TC-Q01–Q06 commit + mobile
  display leg). `find | create [--reason …] | reset`.
  - `create` stages ONE disposable completed trade + review (test-buyer → test-seller, tagged
    `(QA fixture <marker>)` in the comment) + ONE `review_reports` row (reporter = reviewee/test-seller,
    default reason `offensive`) → the trigger flips `review_status='pending_review'`. It then appears
    in the admin `/reviews` reported queue AND on test-seller's mobile profile (`is_hidden=false`).
  - `reset` deletes all tagged reviews (found by the comment tag, which survives Hide AND Keep) +
    their reports/trades/items.
  - Command: `npm run qa:r41-review -- create` (then admin /reviews Q02 Hide / Q03 Keep).
- **`r41-moderation-fixtures.mjs` cleanup fix (QA 31-M finding 2, LOW):** `cmdReset` no longer calls
  `.catch()` on a supabase-js builder (builders are thenables, not Promises → threw “...catch is not a
  function” and silently skipped the `item_safety_flags` cleanup). Now `await` + `{ error }` check,
  matching r41-dispute's DEV-TASK-108 pattern. `reset` fully clears the safety-flag side rows.
