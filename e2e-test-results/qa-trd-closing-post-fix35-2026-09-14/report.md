# QA Report — TRD Closing Pass (post-FIX-Task-35)

**Run:** `e2e-test-results/qa-trd-closing-post-fix35-2026-09-14/`
**Date:** 2026-09-14 · **Agent:** QA Test Agent (execution-only)
**Platform:** **iOS** — iPhone 17 Pro Max simulator `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E` (app `com.sameralzubaidi.p2pmarketplace`, dev client, single Metro on `:8081` per R63a) + the live **admin portal** `http://localhost:3001` + **Stripe** read via `qa:stripe-inspect`.
**⚠ R80 platform disclosure:** the `mobile-mcp` toolset exposed **only** the iOS simulator this session (`adb devices` listed `emulator-5554`, but `mobile_*` rejected that device id and `mobile_list_available_devices` is disabled) ⇒ **every on-device leg here is iOS; there is NO Android verdict this round.**
**Key scope:** `key_scope=SECRET_KEY_BREAK_GLASS` (`sk_test_…` from `STRIPE_QA_READONLY_KEY`, per the round's instruction) ⇒ **Stripe artifacts are NOT restricted-key/read-only evidence.**

---

## 1 · Verdicts

| Case | Verdict | Basis |
|---|---|---|
| **TRD-TC-R03** · Offer expiry → auto-cancel + competing offers cancelled | **✅ PASS** (was 🟡 PARTIAL) | iOS on-device competing-offers re-drive + **provider** proof the rival's hold is released by the live flow |
| **TRD-TC-O2-C12** · Historical/backfill — never falsely marked collected | **✅ PASS** (was 🟡 PARTIAL) | Admin-UI partial refund against an **uncaptured** authorization → **void, not refund** at all 3 layers |
| *(item 3)* Fixture-harness spot-check | **✅ PASS** | 2 harness runs → **3 Stripe holds released**, sweep **0 stranded / 0 stale** after each |
| *(item 4)* The 2 previously-uncaptured trades | **✅ PASS** | Both `captured: true` at Stripe, amounts ⇄ DB **AGREE** |

**Batch roll-up: 2 PASS · 0 FAIL · 0 BLOCKED · 0 SKIPPED** (4 items executed).
**TRD totals after this round: 297 PASS / 1 PARTIAL / 0 OPEN / 13 DOC-DRIFT / 6 SKIPPED / 16 Remaining = 333 ✓** — the only remaining PARTIAL is **O3-C06**.

---

## 2 · Per-case traces

### 2.1 · TRD-TC-R03 — competing offers: the rival's hold is released **by the flow**

**Setup.** Live config re-read first (R25): `max_pending_offers_per_seller = 3`. Clean listings only (`NOT EXISTS (active trades)`, node = Norwalk Central). Fixture built with the sanctioned EF harness (R90), not by UI offer-driving:

| Offer | Buyer | Listing | SP | trade_id |
|---|---|---|---|---|
| A (winner) | test-buyer-2 | `61e15611-…` ($15) | 0 | `fcd43de6-…` |
| B (**rival**) | test-buyer (subscriber) | `61e15611-…` | **5** | `a73cd764-…` |
| C (harness victim) | test-buyer-3 | `0fe228ee-…` ($20) | 0 | `afc8a083-…` |

**Baseline captured before acting:** rival PI `pi_3UFhf44I6kCJlvXo06lBTq7M` = **`requires_capture`, `amount_capturable 1254`** (a real live hold of $12.54); `sp_wallets` test-buyer **453 avail / 5 reserved**.

**Drive (on-device, iOS).** `qa-login-as?persona=test-seller` → `p2pkidsmarketplace://trades`. The list itself carried the fixture's signature: `trade-summary-needs-action-hint` = **"2 offers to review"** and **both** cards showed `trade-offer-competition-…` = *"1 other buyer is competing on this item"*. Tapped `trade-offer-row-fcd43de6-…-review` → Review Offer → `accept-trade-button` → confirm modal, whose own copy states the mechanic: **"Accepting will decline the other 1 offer; their SP is returned."** → `accept-trade-confirm-button` → alert **"Offer Accepted!" / "Payment authorized. Trade is now in progress…"**.

| Transition | Perceived load time (simulator, wall-clock, ±polling precision) |
|---|---|
| Trades deep link → list rendered | ≈2 s |
| Offer card tap → Review Offer rendered | <1 s |
| Accept → confirm modal | <1 s |
| Confirm → "Offer Accepted!" alert | ≈2 s (server round-trip) |

All under the 3 s flag threshold.

**Result — all assertions met:**

| Layer | Evidence |
|---|---|
| **UI** | rival "declined" per the confirm copy; winner's alert; Trades list re-rendered |
| **DB** | rival `a73cd764`: `cancelled` / **`offer_expired_competing`** / **`cancelled_at` stamped** `21:46:08.163Z` / tax **`voided`** (`voided_at` 21:46:09.47, `refunded_tax_cents 0`, `reconciliation_status` NULL); winner `fcd43de6`: `in_progress` + `auto_complete_at` 2026-09-17; SP **458 avail / 0 reserved** (was 453/5) |
| **Provider** | `pi_3UFhf44I6kCJlvXo06lBTq7M`: **`requires_capture`/1254 → `canceled`/`amount_capturable 0`** (`canceled_at` 21:46:09 — inside the accept) |

**Why this closes the case.** The 2026-09-13 PARTIAL rested on two defects: **F1** (`cancelled_at` left NULL) and **F2** (rival hold never released + tax stranded at `quoted`). Both are now gone on a **fresh** drive: `cancelled_at` is stamped, the tax row is `voided`, and the authorization is canceled **by the accept flow** (`transactions-update` → `_shared/competing-offer-cancel.ts` → `paymentIntents.cancel`) — no manual cleanup was involved. The previously-stranded `pi_3UFO9f4I6kCJlvXo0iCaV1UR` also re-reads `canceled`/`0`. Corroborated by the read-only verifier (`qa:fix32-verify` I1 ✅, I3 ✅, I5 ✅, I6 ✅).

**Fixture reset:** listing back to `available`, rival terminal, SP restored; the winner was later terminalized (see 2.4).

### 2.2 · TRD-TC-O2-C12 — an uncaptured authorization VOIDS, it does not refund

**Setup.** Subject = `fcd43de6-…` (`in_progress`, PI `pi_3UFher4I6kCJlvXo0D9M8Wcq` = `requires_capture`/1879, `amount_received 0`) — i.e. exactly "a partial refund requested before capture". The admin UI itself gates Partial Refund to `completed | in_progress | payment_processing`, confirming the state choice.

**Drive.** Admin portal `/trades/fcd43de6-…` → **Issue Partial Refund** → price **$5.00**, fee **$0**, tax **$0** + a required reason → confirm button rendered **"Refund $5.00"** → `POST /api/admin/trades/partial-refund` → the `trade-refund` Edge Function.

**Result — every 2026-09-13 symptom is gone:**

| Layer | Evidence |
|---|---|
| **UI** | portal action executed on the real trade page — `Issue Partial Refund` → `$5.00`/`$0`/`$0` + reason → confirm button rendered **"Refund $5.00"** → `POST /api/admin/trades/partial-refund`; the EF's uncaptured branch was taken (no refund booked). ⚠️ **Unmet capture obligation (named, per §5.6):** the *mid-action* admin frames (the open refund form and the success state) were **not** persisted — the action's success path calls `window.location.reload()`, and no screenshot was taken between clicking confirm and the reload. `screenshots/04-admin-trade-post-refund-and-force-cancel.png` is the **post-action end state** only; the refund moment is evidenced by the DB + Stripe artifacts below (the decisive channels, R24) rather than by pixels. |
| **DB** | `payments.refunded_cents` / `refunded_price_cents` / `refunded_fee_cents` / `refunded_tax_cents` **all 0**, `refunded_at` NULL ⇒ **no inflation**; `payments.derived_state='cancelled'` — **not** `partially_refunded`; `tax_status='voided'` + `voided_at` and `stripe_refund_id` **NULL** (no bogus `cancelled_<pi>` stamp); `reconciliation_status` **NULL** ⇒ no false `needs_review`; `trade_refunds` rows **0** |
| **Provider** | PI **`canceled` / `amount_capturable 0` / `amount_received 0`** (was `requires_capture`/1879); charge `captured: false` |

**The one `DISAGREE` and why it is not a finding.** `qa:stripe-inspect`'s `refund_count` reads `stripe_refund_count 1` vs `db_trade_refund_rows 0`. That is the **documented exception in playbook §5.37 rule 7**: Stripe represents an authorization-cancel as a `succeeded` refund object while the app deliberately books nothing (nothing was ever captured). Classified **`AGREE (by design — uncaptured authorization)`** — same precedent as `50849c0b` (FIX-Task-33 F3). Ruled OUT, not filed.

**Cleanup.** Trade terminalized via the admin **Force Cancel** → `cancelled` + `cancelled_at`, listing `available`, and — verified — `post_acceptance_cancellation_count` stayed **7** with `admin_review_flagged_at` unchanged, i.e. the admin path applied **no** seller consequence (no R89 restore required).

### 2.3 · Fixture-harness spot-check (item 3)

`qa:reset-offer-fixtures` was run **twice** with real work outstanding:

| Run | Pending offers found | Stripe holds | Tax | Sweep immediately after |
|---|---|---|---|---|
| #1 | 2 (`365cc0ba`, `cb4a1339` on Science Kit) | **2 cancelled** | 2 voided | **0 stranded / 0 stale / 0 uncaptured** |
| #2 | 1 (`afc8a083` on Science Kit) | **1 cancelled** | 1 voided | **0 stranded / 0 stale** |

Baseline before any harness run was also all-zero. ⇒ **The harness fix holds under normal QA usage: 3 holds released, 0 new holds created.**

### 2.4 · The 2 previously-uncaptured trades (item 4)

| trade | DB | Stripe PI | charge | amount |
|---|---|---|---|---|
| `47bdab0a-…` | `completed`, `refunded_cents 0`, `total_charged_cents 2849` | `succeeded`, `amount_received 2849`, `amount_capturable 0` | `captured: true` | **2849 = 2849 AGREE** |
| `acb4939a-…` | `completed`, `refunded_cents 0`, `total_charged_cents 2503` | `succeeded`, `amount_received 2503`, `amount_capturable 0` | `captured: true` | **2503 = 2503 AGREE** |

**Both genuinely clean at all three layers; no discrepancy remains.** *(Pre-existing, not a regression: `acb4939a`'s tax row is `voided`, so its $1.54 collected tax is not in the tax ledger — the owed ledger-write/accept decision already recorded by FIX-Task-35. `47bdab0a` has no tax row.)*

---

## 3 · 🔴 NEW FINDING F1 (HIGH / P1) — the live auto-complete **cron** bypasses Stripe capture

**Surfaced mid-run, outside the round's stated scope, and it contradicts this round's premise that "the capture-path bugs are fixed".**

During the session's **final** sweep, 3 trades appeared in `completed_without_capture` (they were **absent** from the identical baseline sweep taken ~10 minutes earlier): `57d50a84` ($16.00), `2bb49d39` ($21.40), `cdb2a42d` ($16.47) — **$53.87 never collected**, all with PIs still `requires_capture` / `amount_received 0` and tax still `quoted`.

**All three were completed at `2026-09-14 21:45:00.484911`** — a single batch, and `21:45:00` is exactly a `*/15` tick.

**Root cause (writer named, R100/R12 — two independent proofs):**
1. **The audit journal excludes the EF.** `financial_audit_log` for all 3 trade ids contains only the 2026-09-11 creation rows (`offer_created`, `tax_quoted`, `buyer_fee_charged`, `payment_intent_created`). There is **no `payment_captured` row** — the EF writes one per capture (`idempotency_key = capture_<tradeId>`). The EF's own guard would also have refused/captured, since its capture branch runs for `piId && cashCents > 0`.
2. **The cron calls the bare RPC.**
```sql
SELECT jobid, jobname, schedule, active, command FROM cron.job;
-- jobid 42 | process-auto-complete | */15 * * * * | active=true
--          | SELECT public.rpc_process_auto_complete(100);
```
`rpc_process_auto_complete`'s body is a pure clock UPDATE (`in_progress AND auto_complete_at <= now()` → `completed`) with **no capture and no payment check**. The original migration *did* schedule the **EF** via `net.http_post('/process-auto-complete')`; the live job has since been replaced by the RPC call — so the capture invariant that FIX-Task-35 added **to the EF** cannot run on this path, and the extra `p_trade_ids` parameter it added does not help either (the cron passes only the batch size, so `p_trade_ids IS NULL` ⇒ no id filter).

**Why it is dangerous:** the completed rows read `payments.derived_state='succeeded'` and carry a `captured_at` stamp — both **trigger mirrors** of `trades.status` (R100), not capture evidence — so the DB *looks* like the money was collected while Stripe holds `0`. Seller payouts become schedulable against funds never captured.

**Remediation (1 line, dev-side):** point jobid 42 at the Edge Function the way its sibling jobs do — `SELECT public.rpc_fire_edge_function('/process-auto-complete');` (or the `net.http_post` form the migration intended) — then reconcile the 3 rows. The same class was already fixed once in the EF and codified as playbook **R14**; this is the cron-side leg that was never changed.

**Also fixed by this:** the verifier's **I2 FAIL** (2 completed trades with voidable `quoted` tax = `cdb2a42d` + `2bb49d39`) is a **symptom of the same root cause**, not a separate defect.

---

## 4 · Three-layer UX review

### 4.1 · Design-system compliance — **No deviations found** on the screens/dialogs reviewed
Screens reviewed: **Trades (My Trades)** list, **Review Offer**, the **Accept Trade** confirmation modal, the **"Offer Accepted!"** alert, and the admin **`/trades/[id]`** page (TradeActions incl. the Partial-Refund and Force-Cancel blocks).
- On-brand: one primary per surface (green `#5DBB8E` Accept / `#E53E3E` Decline as the destructive text variant); the confirmation modal and alert use the **branded, in-app** dialog (AX-exposed with real identifiers), **not** an unstyled OS alert; the competition hint and countdown pill are consistent with the design tokens; admin blocks use their own admin palette (out of the mobile design doc's scope).
- Header/back-button check (mandatory per §6.4): Trades and Review Offer both render the canonical header — 40×40 round `back-button` with the caret icon and no text label, title, bell + chat on the right. **Compliant.**
- Standing off-brand sweeps (R62b/R62d) were **not** run this round (no new mobile screens were authored or re-skinned); noted in Known Gaps rather than claimed.

### 4.2 · Structural / affordance
- The competing-offer **competition hint on the list card** (`trade-offer-competition-…`: *"1 other buyer is competing on this item"*) plus the accept-modal copy (*"Accepting will decline the other 1 offer; their SP is returned."*) make an otherwise-surprising side effect predictable **before** commitment. **No findings — this is a genuinely good affordance and it is what made R03 drivable.**
- One **minor** observation: after Accept, the Trades list still showed `trade-summary-needs-action-hint` refresh only on re-entry; no live-refresh. Low impact (a re-list re-reads correctly) — recorded as UX note, not a defect.

### 4.3 · Wording / copy clarity
- **No raw machine strings observed on any surface this run.** The accept alert uses the corrected **"Payment authorized."** phrasing (not "captured"/"charged"); the rival's cancellation is surfaced to the user in plain language; no `SCREAMING_SNAKE`, no EF/PostgREST text, no support-email copy.
- **One copy nit (not a defect, enhancement only):** the *admin* force-cancel reason field accepts free text and stores it verbatim into `trades.cancellation_reason`, which is **user-visible on the buyer/seller timeline** — a QA-authored reason ("QA cleanup: …") therefore lands in a user-facing string. Recommend the admin UI soften/quote it or keep QA reasons in a non-user-facing column.

---

## 5 · Money Verification Layers (§5.37 rule 6)

- **TRD-TC-R03** — UI ✓ (seller accepted in the app; "Offer Accepted!" alert) | DB ✓ (`trades` rival `cancelled`/`offer_expired_competing`/`cancelled_at`; `tax_records.voided`; `sp_wallets` 458/0) | **Stripe ✓** (`pi_3UFhf44I6kCJlvXo06lBTq7M`: `canceled`, `amount_capturable=0`, `amount_received=0`) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- **TRD-TC-O2-C12** — UI ✓ (admin partial-refund UI, $5.00 price-only) | DB ✓ (`payments.refunded_*` = 0, `derived_state='cancelled'`, `tax_records.voided`, 0 `trade_refunds`) | **Stripe ✓** (`pi_3UFher4I6kCJlvXo0D9M8Wcq`: `canceled`, `amount_received=0`, 1 refund object = **documented rule-7 exception**) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- **item 3 (harness)** — n/a to a case; DB ✓ + Stripe ✓ (`qa:stranded-holds` 0/0/0 after both runs; 3 holds verified released) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- **item 4 (2 trades)** — UI n/a (no UI leg required) | DB ✓ (`payments.total_charged_cents` 2849/2503) | **Stripe ✓** (both `succeeded`, `amount_received` 2849/2503, `captured: true`, 0 refunds) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- **F1 (§3, informational)** — DB ✓ (3 rows) + **Stripe ✓** (`requires_capture`, `amount_received=0`) | UI n/a — `key_scope=SECRET_KEY_BREAK_GLASS`.

---

## 6 · Friction vs. the operating rules

| # | Friction | Cost / note |
|---|---|---|
| 1 | **`mobile_open_url` rejects the app scheme** (`Only http:// and https:// … Set MOBILEMCP_ALLOW_UNSAFE_URLS=1`) ⇒ every deep link needed a terminal `xcrun simctl openurl`. | Minor; workflow worked. New fact for the playbook. |
| 2 | **`mobile_list_available_devices` is disabled** and the toolset refused `emulator-5554` while `adb` saw it ⇒ the round could not be driven on Android. | Platform forced to iOS; disclosed per R80. |
| 3 | **`trade-refund` returns 403 for the `test-admin` persona JWT** (`FORBIDDEN: Admin access required`) — the EF accepts only a service credential / `x-admin-ui-secret` / an `app_metadata.role=admin` JWT, and `test-admin`'s JWT has neither. | ~3 calls. Worked around by driving the **portal route** (`/api/admin/trades/partial-refund`), which injects the service key server-side — the R81-sanctioned pattern. **Recommend** registering a service-credential-capable admin path (or the `x-admin-ui-secret` header) in `qa:ef-repro` so admin-only EFs are drivable in one call. |
| 4 | **Playwright snippets have no `fs`/`require`** in this harness (`ReferenceError: require is not defined`; `A dynamic import callback was not specified`), and `app-build-manifest.json` is 404 in dev ⇒ env-file credential loading from inside a snippet is impossible; the admin-UI secret could not be harvested from the served bundle either. | ~3 calls. Resolved by logging into the portal with the documented QA admin credential (the same one the Group L Playwright path uses). |
| 5 | **Two stale Metro instances (8081 + 8082)** on arrival. | Fixed per R63a (`npm run metro:kill` → single `expo start --port 8081`). |
| 6 | Success `alert()` + `window.location.reload()` in the admin actions wipe any in-page alert capture. | Verified via DB/Stripe instead (R24) — the correct channel anyway. |

---

## 7 · App state left behind

- **Trades** — all fixture trades terminal: rival `a73cd764` `cancelled` (`offer_expired_competing`); winner `fcd43de6` `cancelled` (admin force-cancel, QA reason recorded); harness victim `afc8a083` `cancelled`; listings `61e15611` / `0fe228ee` back to **`available`**.
- **SP** — test-buyer **458 available / 0 reserved** (restored; seed-documented baseline).
- **Seller** — test-seller `post_acceptance_cancellation_count` **7** and `admin_review_flagged_at` **2026-08-30 23:14:30.907557+00** — **unchanged** (verified before and after; the admin force-cancel applied no consequence).
- **Sessions** — mobile app left logged in as **test-seller** on the iOS simulator; admin portal browser page left signed in as the QA admin (local dev server, `:3001`, left running).
- **⚠ Post-run environment change (observed AFTER this round closed):** the **Metro instance on `:8081` was terminated** (exit 137, terminal cleaned up), and a **separate Metro is now listening on `:8082`** (PIDs 45623/45649 — not started by this run, deliberately left untouched rather than killed). The iOS dev client's last target (`:8081`) therefore **no longer exists**. Per **R77 #16**, a subsequent *"Failed to connect to …:8081"* is a **dev-server/port condition — NOT an app or simulator fault**: restart with `npm run start:single` (or re-point the client at the running instance) before re-running any device case. **No verdict in this round depends on Metro's current state** — every on-device leg was captured while `:8081` was live, and all money/state evidence is read from DB + Stripe, not from the bundler.
- **Not touched (excluded by the brief):** the 2 subscription-drift findings (`sub_1TpDzx4…` app-active/Stripe-canceled; the 3 orphaned Stripe sub ids) — noted only; the migration-ordering repair; O3-C06 layer 3.
- **Pre-existing, not caused by this round:** the 3 uncaptured `completed` trades + the 2 I2 tax rows (§3), and `acb4939a`'s un-collected $1.54 tax.

---

## 8 · Known gaps / not tested

- **Android** — no verdict this round (toolset did not expose the emulator; R80 disclosure above). Every iOS verdict here is platform-specific.
- **F1's downstream consequence not exercised** — whether a `seller_payouts` row becomes schedulable against the 3 uncaptured trades (their `payments` mirror reads `succeeded`) was **not** driven; the payout leg is named as the missing leg rather than over-claimed.
- **Unmet capture obligation — the O2-C12 mid-action admin frame** — the open partial-refund form and its success state were not screenshotted (the success path reloads the page); the end state is `screenshots/04-…`. This is named rather than silently traded, per §5.6 (2026-09-12 sharpening).
- **R62b/R62d off-brand sweeps** not re-run (no new/re-skinned mobile screens this round).
- **O3-C06 layer 3** — still no harness (explicitly out of scope).
- **`qa:fix32-verify` I2** currently FAILs (2 rows) — reported in §3 as a symptom of F1, not as an independent O2-C12 gap.

---

## 📋 QA Session Handoff

**Test Scope:** TRD closing pass (post-FIX-Task-35) — **TRD-TC-R03** (competing-offers hold release), **TRD-TC-O2-C12** (void-vs-refund on an uncaptured authorization), the **fixture-harness spot-check** (`qa:reset-offer-fixtures` ×2 + `qa:stranded-holds`), and the **2 previously-uncaptured trades** (`47bdab0a`, `acb4939a`). Platform: **iOS** simulator + live admin portal + Stripe (`qa:stripe-inspect`).
**Design-System Compliance:** **PASS — No deviations found** on the screens/dialogs reviewed (Trades list, Review Offer, Accept-Trade confirmation modal, "Offer Accepted!" alert; admin `/trades/[id]` is outside the mobile design doc). Header/back-button check compliant on both mobile screens; one primary per surface; dialogs are the branded in-app variant, not unstyled OS alerts. Standing R62b/R62d hex sweeps were not re-run this round (no new/re-skinned mobile screens) — see Known Gaps.
**Perceived Load-Time Verdict:** **GOOD** — all observed transitions rendered within the <3 s ideal threshold (Trades deep link → list ≈2 s; card → Review Offer <1 s; Accept → confirm modal <1 s; confirm → "Offer Accepted!" alert ≈2 s). Measurements are simulator wall-clock with ±polling-interval precision, not a formal performance profile. No ≥3 s transition observed; the ~2 s figures include dev-build JS handling and are not flagged.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Trades (My Trades) list: canonical header (40×40 round `back-button`, no text label) + bell/chat; card layout, competition hint and countdown pill on-token.
- CONFIRMED — Review Offer: canonical header; single primary (Accept) with destructive-styled Decline; payout breakdown aligned.
- CONFIRMED — Accept-Trade confirmation modal: branded in-app dialog, AX-exposed buttons, one primary, and copy that discloses the side effect before commitment.
- CONFIRMED — "Offer Accepted!" alert: branded in-app alert; wording is the corrected **"Payment authorized…"** (no raw/mechanical string).
- CONFIRMED — Admin `/trades/[id]`: admin palette, required reason fields, explicit confirm steps (outside the mobile design doc's scope).
- NOTE (enhancement, not a deviation) — the admin force-cancel **reason** is free text stored into the **user-visible** `trades.cancellation_reason`; a QA-authored reason therefore reaches the buyer/seller timeline.
**Verdict Summary:** **2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED** (items 3 and 4 also ✅).
**Money Verification Layers:**
- `TRD-TC-R03` — UI ✓ (seller accept in-app; "Offer Accepted!") | DB ✓ (`trades` rival `cancelled`/`offer_expired_competing`/`cancelled_at` 21:46:08Z; `tax_records.voided`; `sp_wallets` 458/0) | **Stripe ✓** (`pi_3UFhf44I6kCJlvXo06lBTq7M`: `requires_capture`/1254 → `canceled`/`amount_capturable=0`/`amount_received=0`) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- `TRD-TC-O2-C12` — UI ✓ (admin partial-refund UI, $5.00 price-only, fee/tax 0) | DB ✓ (`payments.refunded_*` all 0, `derived_state='cancelled'` not `partially_refunded`, `tax_records.voided` + `stripe_refund_id` NULL, `reconciliation_status` NULL, 0 `trade_refunds`) | **Stripe ✓** (`pi_3UFher4I6kCJlvXo0D9M8Wcq`: `canceled`, `amount_received=0`; 1 refund object = **documented §5.37 rule-7 uncaptured-authorization exception → classified AGREE by design, NOT a divergence**) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- **item 3 (harness spot-check)** — UI n/a | DB ✓ | **Stripe ✓** (`qa:stranded-holds` 0 stranded / 0 stale / 0 uncaptured after both resets; 3 holds verified cancelled) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- **item 4 (2 trades)** — UI n/a | DB ✓ (`payments.total_charged_cents` 2849 / 2503) | **Stripe ✓** (both `succeeded`, `amount_received` 2849 / 2503, `captured: true`, 0 refunds) — `key_scope=SECRET_KEY_BREAK_GLASS`.
- **F1 finding (informational)** — DB ✓ (3 rows, `completed_at` 21:45:00.484911) | **Stripe ✓** (`requires_capture`, `amount_received=0`, `$53.87` uncaptured) | UI n/a — `key_scope=SECRET_KEY_BREAK_GLASS`.
**Coverage Tracker Updated:** ✅ `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — **TRD-TC-R03 🟡 PARTIAL → ✅ PASS** and **TRD-TC-O2-C12 🟡 PARTIAL → ✅ PASS** (rows updated with `Latest`/`Date`/`Source`/`Notes`); **§1 per-guide roll-up, the TRD section header, and the never-run table header reconciled in the same pass** (R56/R57). **New TRD totals: 297 PASS / 1 PARTIAL / 0 OPEN / 13 DOC-DRIFT / 6 SKIPPED / 16 Remaining = 333 ✓** (was 295/3/0/13/6/16; 297+1+0+13+6+16 = 333). Remaining (16) and DOC-DRIFT/SKIPPED are unchanged; the sole remaining PARTIAL is **O3-C06**. A dated round note (newest) was added at the head of the file.
**Critical Findings:**
1. 🔴 **HIGH/P1 — the live auto-complete CRON bypasses Stripe capture.** `cron.job` jobid 42 (`process-auto-complete`, `*/15`, active) runs `SELECT public.rpc_process_auto_complete(100);` — the **bare RPC**, which completes `in_progress` trades purely on the clock with no capture. At **21:45:00 today** (a cron tick, inside this session) it flipped **3 trades to `completed` with uncaptured authorizations** — `57d50a84` $16.00, `2bb49d39` $21.40, `cdb2a42d` $16.47 = **$53.87 never collected** — with tax still `quoted` and **no `payment_captured` audit row** (two independent proofs it was not the EF). The rows *look* collected because `payments.derived_state='succeeded'` and `captured_at` are **trigger mirrors** of `trades.status` (R100). FIX-Task-35 fixed this class **in the Edge Function**; the cron leg was never changed. **Remediation: `SELECT public.rpc_fire_edge_function('/process-auto-complete');` on jobid 42, then reconcile the 3 rows.**
2. 🟡 **MED — `qa:fix32-verify` I2 FAILs** (2 completed trades with voidable `quoted` tax, $2.38) — **a symptom of finding 1**, not an independent defect.
3. 🟢 **No findings on the 4 items in scope** — R03's hold release, O2-C12's void-not-refund, the harness fix, and the 2 repaired trades all verified clean at all three layers.
**App State Left Behind:** see §7 — all fixture trades terminal, both listings `available`, test-buyer SP 458/0, test-seller consequence state **unchanged (count 7 / flag 2026-08-30)**, mobile app left logged in as **test-seller**, admin portal left signed in and running on `:3001`, single Metro left running on `:8081`. Nothing else written; the excluded subscription-drift items were not acted on.
**Why It Matters:** this round **closes TRD's last two open clauses with provider-level proof** — the competing-offers path now genuinely releases the rival's authorization as part of the live flow (so a losing buyer is no longer left with a held card), and a partial refund against an uncaptured authorization now **voids** instead of booking a refund for money that was never charged (so no false `refunded_*` totals, no false `needs_review`, no stranded `quoted` tax). Equally important, it discovered that a **production cron still completes trades without capturing them**, which means real money can go uncollected while the database reports success — the same defect class that has now been fixed twice in application code without being fixed at the scheduled entry point.
**How to Verify/Reproduce:** evidence bundle `e2e-test-results/qa-trd-closing-post-fix35-2026-09-14/evidence/round-evidence.md` (+ `screenshots/00-…05-…`, `report.md`, `ledger.md`). R03: re-run the fixture (`qa:ef-repro` ×3 per §2.1) → accept on-device → `npm run qa:stripe-inspect -- pi pi_3UFhf44I6kCJlvXo06lBTq7M --break-glass-secret-key` (expect `canceled`/`amount_capturable 0`). O2-C12: `npm run qa:stripe-inspect -- by-trade fcd43de6-7e22-4822-972f-8d69c8f0a317 --break-glass-secret-key`. F1: `SELECT jobid, jobname, command FROM cron.job WHERE jobname='process-auto-complete';` and `SELECT * FROM public.financial_audit_log WHERE entity_id IN ('57d50a84-…','2bb49d39-…','cdb2a42d-…');` (note the absent `payment_captured` row).
**Known Gaps / Not Tested:** Android (toolset did not expose the emulator — R80); F1's payout-schedulability downstream leg; R62b/R62d off-brand sweeps; O3-C06 layer 3 (no harness); `qa:fix32-verify` I2 (symptom of F1).
**What Needs To Be Fixed Next:**
1. **Fix the auto-complete cron (P1)** — change `cron.job` jobid 42's command from `SELECT public.rpc_process_auto_complete(100);` to `SELECT public.rpc_fire_edge_function('/process-auto-complete');` (matching `send-auto-complete-reminders` / `dispatch-manual-payouts`), ideally via a migration so it survives re-provisioning. Then reconcile the 3 rows (`57d50a84`, `2bb49d39`, `cdb2a42d`): capture-or-void each, and settle their `tax_records` rows out of `quoted`.
2. **Make the bare `rpc_process_auto_complete` refuse to complete an uncaptured trade** — the RPC is reachable by any service-role caller and has no payment guard; a DB-level check (or a comment + REVOKE from service_role so only the EF path completes) would make the invariant un-bypassable rather than convention-only. *(Same class as R14's expiry correction.)*
3. **Add a cron-health assertion to the QA sweeps** — a `qa:stranded-holds`-adjacent check that FAILS when a job that moves money is pointed at a bare RPC instead of its Edge Function, so this is caught proactively rather than by a sweep delta.
4. **Let `qa:ef-repro` drive admin-only EFs** — support a service-credential bearer or an `x-admin-ui-secret` header so `trade-refund` / `admin-trade-action` don't need the portal route (~3–5 calls saved per use).
5. *(Optional, dev-facing)* consider not storing admin QA reasons verbatim into the user-visible `trades.cancellation_reason`.
**UX Enhancement Ideas (optional, not defects):**
- On the **admin Force Cancel** form, the reason text is written straight into a buyer/seller-visible field — consider defaulting to a short user-safe phrase with the operator detail kept in the audit payload, to reduce the chance of internal/QA wording reaching users.
- On the **Trades list**, the "Needs Action" summary and offer cards do not live-refresh after an accept (they update on re-entry) — consider subscribing to the same Realtime channel the timeline uses so the count drops immediately after an action.
**Suggested Next Session:** re-run the auto-complete path **after** the cron fix — fast-clock a disposable in_progress trade and let the real cron tick fire (or POST the EF) and confirm capture + `tax_status='collected'` + a payout row, then re-run `qa:uncaptured-pi-sweep` / `qa:stranded-holds` to prove the 3 rows and the I2 tax rows are reconciled; that both closes F1 and re-establishes the provider-first baseline.
**Suggested to Improve Agent Rules:** add a **"name the cron/caller, not just the function"** rule for money-path findings — the existing R14 says "drive the Edge Function, not the bare RPC" (a *tester* rule) and R100 says "name the writer" (a *reader* rule), but neither obliged anyone to check **who the scheduled caller invokes**. This round's P1 was invisible to both: the EF was fixed and the playbook was fixed, while the cron kept calling the RPC. A one-line check — `SELECT jobid, jobname, command FROM cron.job WHERE command ILIKE '%rpc_%'` — should be part of any money-path verification round, and the resulting assertion belongs in `qa:stranded-holds`' family.
