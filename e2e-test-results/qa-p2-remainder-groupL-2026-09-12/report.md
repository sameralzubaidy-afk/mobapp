# QA Task — Priority 2 remainder → Group L / O-1 C07 (gated on FIX-Task-23 item 3)

**Date:** 2026-09-12 · **Run folder:** `e2e-test-results/qa-p2-remainder-groupL-2026-09-12/`
**Platforms:** **Android `Medium_Phone_API_36.1`** (emulator `emulator-5554`, dev client on Metro :8081) + **live admin portal `http://localhost:3001`** + read-only Supabase (staging `drntwgporzabmxdqykrp`) + documented fixture scripts.
**iOS:** booted (`iPhone 17 Pro Max`) but **NOT driven — no iOS verdict is claimed anywhere in this report** (R80).
**HEAD:** `da131a69` (FIX-Task-23).
**Metro:** :8081 + :8082 both running (multi-session; neither killed — R77 #16 / 2026-09-10 precedent).

---

## 1. Roll-up

| Step (brief) | TC-ID | Verdict |
|---|---|---|
| 1 | TRD-TC-O2-C11 (duplicate webhook/retry) | ✅ **PASS** |
| 2 | TRD-TC-O2-C04 (SP used — taxable base unchanged, card auth) | ✅ **PASS** |
| 2 | TRD-TC-O2-C05 (seller accepts — tax stays quoted) | ✅ **PASS** |
| 3 | TRD-TC-O3-C05 (dispute route full refund + tax reversal) | 📄 **DOC-DRIFT** (unreachable as written) |
| 3 | TRD-TC-O3-C06 (duplicate refund idempotent) | 🟡 **PARTIAL** (sharper: 3-layer guard, source-verified + RPC leg driven) |
| 4 | TRD-TC-O07 (refund shows proportional tax refunded) | ✅ **PASS** (was PARTIAL) |
| 4 | TRD-TC-O03 / O04 / O06 / O08 | ✅ already PASS on record — **not owed** (see §1.1) |
| 5 | TRD-TC-O1-C07 (bulk listing tax category) | ✅ **PASS** (was STILL OPEN/BLOCKED) |
| — | FIX-Task-23 item 1 (`qa:r41-first-trade -- create`) | ✅ **FIXED** |
| — | FIX-Task-23 item 2 (admin auth hang) | ✅ **FIXED** (reproduced precondition) |
| — | FIX-Task-23 item 3 (photo-picker gate) | 🟡 **PARTIAL** → see §1.4 |
| — | FIX-Task-23 item 6 (Item-Detail Price Breakdown) | ✅ **NOT A DEFECT** (now on-device) |

**Verdict counts:** 7 PASS · 0 FAIL · 0 BLOCKED · 1 DOC-DRIFT · 2 PARTIAL.

### 1.1 Step 4 — O03/O04/O06/O08 are NOT owed (R78-2 registry re-verification)

The brief lists "O03/O04/O06/O07/O08" as remaining Phase-2 odds. Re-verified against the tracker (R78-2): **O03 ✅ (2026-08-30), O04 ✅ (2026-08-30), O05 ✅ (2026-08-30), O06 ✅ (2026-08-30), O08 ✅ (2026-08-30)** already carry PASS verdicts — only **O07** was genuinely PARTIAL, and it is now closed (§3.4). No re-drive of the four PASS rows was performed (that would be double-counting existing evidence, R80).

**O06 doc-drift (LOW), observed live:** O06 expects "Tax rate and jurisdiction are **NOT** shown (simplified for buyers)", but the shipped completed-trade Payment Details row reads **"Sales Tax (6.99%)"** — the rate IS appended. This is the already-reconciled convention from O3-C03 (`TaxBreakdownRow` appends the rate whenever one applies ⇒ 2026-09-12 note); **O06's "NOT shown" clause is the stale one** and should be reconciled the same way.

### 1.2 Step 1 — O-2 C11 (DB-driven, no device)

Fixture: disposable residue trade `3265ec84-3a2a-4ace-a1b6-152cc3d2ac2b` (cancelled, `tax_amount_cents`=161, `tax_status`='quoted').

| Call | Result |
|---|---|
| `rpc_mark_tax_collected(trade,'dup_charge_123')` #1 | `success:true`, `previous_status:'quoted'` → `new_status:'collected'`, `stripe_capture_id:'dup_charge_123'` |
| `rpc_mark_tax_collected(trade,'dup_charge_123')` #2 | `success:true`, **`action:'idempotent'`**, `new_status:'collected'` — **guide-exact** ✅ |
| `rpc_refund_tax_with_status(trade,100,'test_dup')` #1 | `refunded_total:100`, `remaining_cents:61`, `new_tax_status:'partially_refunded'` |
| `rpc_refund_tax_with_status(trade,100,'test_dup')` #2 | **`REFUND_EXCEEDS_COLLECTED`** `details.remaining_cents:61` — **no second addition** ✅ |

**Read-back (separate statement, R24):** `tax_status='partially_refunded'`, `refunded_tax_cents=100` (**NOT 200**), exactly **1** `tax_records` row, `updated_at` bumped.
**SP ledger:** exactly **2** rows = one per operation — `spend_purchase` −11 @offer (474→463) and `earn_refund` +11 @cancel (463→474), **net zero** ⇒ no duplicate SP event (and an independent re-confirmation of R02's SP-restore leg).
**Payouts:** `SELECT trade_id, count(*) FROM seller_payouts WHERE trade_id IS NOT NULL GROUP BY 1 HAVING count(*)>1` → **0 rows** ⇒ the "exactly 1 payout record" invariant holds table-wide.

**Nuance (LOW doc-vs-impl):** the guide's expected result for the refund replay is "*returns correct remaining refundable amount — no second addition*", which reads as an **idempotent acknowledgement**. The shipped RPC is a **cumulative ledger with a cap**, not an idempotent replay: it returns an *error* carrying `details.remaining_cents`, and the `action:'idempotent'` key exists **only** on `rpc_mark_tax_collected`. Worth stating in the guide.

### 1.3 Step 2 — O-2 C04 / C05 (live SP offer + card authorization)

**C04 — real UI drive as test-buyer** (the emulator was already parked on a Make Offer screen for `5e99402b`, "QA Bundle Fixture 2 of 3 (2026-09-11)", $25.00, test-seller-3 ⇒ zero navigation cost):

1. Tap `sp-amount-input` → type `15` → value stack reads **"YOU OFFER $10.00"** + **"15 SP applied"** badge; helper line **"Max: 18 SP (75% of price)"**.
2. IME gate (§5.19 Android addendum): screenshot proved the numeric IME was up; `BACK` dismissed it; **re-listed** with the IME down (tree height 1719→1592) before any coordinate tap.
3. `send-offer-button` → **Liability Disclaimer** modal (Amazon content — excluded from scope per the brief; passed through only). AX-exposed (`disclaimer-modal-checkbox` **pre-ticked**, `disclaimer-modal-accept-button`).
4. Accept & Continue → spinner → **"Trade Initiated!"** ("Your trade request has been sent… **You saved $15.00 using SP! You have 459 SP available.**") — perceived load ≈ 2–3 s (simulator, wall-clock, ±polling-interval precision).

**DB read-back (`472ef43a-727a-4114-b9d2-fddc25afe50e`):**

| Assertion (guide) | Expected | Observed | ✓ |
|---|---|---|---|
| `tax_status` | `quoted` | `quoted` | ✓ |
| `taxable_amount_cents` | **FULL item price, not price−SP** (BP-37) | **2500** (item $25.00; price−SP would be 1000) | ✓ |
| `tax_amount_cents` | on the full base | **175** = 2500 × 6.99% | ✓ |
| `tax_snapshot.items[0].item_price_cents` | item price | 2500, `is_taxable` true | ✓ |
| `cash_amount_cents` | guide: 1500 + fee | **1000** = price − SP; the fee is a **separate** column `buyer_transaction_fee_cents`=149 | ⚠ doc-drift |
| Stripe PI auth = cash + fee + tax | — | `payments.total_charged_cents` = **1324** = 1000+149+175 ✓, `status` = **`requires_capture`** | ✓ |

> **Doc-drift (LOW):** the guide's "`cash_amount_cents` = 1500 + fee" describes the *composite*; shipped `cash_amount_cents` is the item-cash portion and `buyer_transaction_fee_cents` holds the fee. The composite is `payments.total_charged_cents`.

**C05 — seller accept**, driven through the **same Edge Function the app calls** (`respondToOffer` → `transactions-update`, body `{trade_id, action:'accept'}`) authenticated as the real seller persona `test-seller-3` via the checked-in `qa:ef-repro` harness (R90 EF-over-UI setup; disclosed — the accept UI path itself is covered by L07/L08 and B-series rounds):
`HTTP 200 {"success":true,"status":"in_progress","auto_complete_at":"2026-09-16T00:09:29.312Z"}`.

| Assertion | Expected | Observed | ✓ |
|---|---|---|---|
| `trades.status` | `in_progress` | `in_progress` (+ `auto_complete_at` = +72 h) | ✓ |
| `tax_status` | `quoted` (unchanged) | `quoted` | ✓ |
| `tax_records.captured_at` | NULL | NULL | ✓ |
| Stripe PI still `requires_capture` | — | **NOT verifiable from the DB** — see the trap below | ⚠ |

> ### ⚠️ NEAR-MISS FALSE POSITIVE — `payments.status` is a DERIVED MIRROR, not the Stripe state (highest-value lesson of the round)
> The read-back showed `payments.status = 'captured'` with `captured_at` stamped **97 ms after the accept**. That looks like a HIGH money-integrity defect (capture at accept instead of at completion) — but the accept EF **never touches `payments`**, and its source explicitly logs *"authorization hold preserved (not captured) on seller accept"* (`transactions-update/index.ts` L188-194, capture deferred to `complete-trade`/auto-complete).
> Root cause found in one query: trigger **`trg_payments_sync_from_trade` → `fn_payments_sync_from_trade()`** maps `trades.status='in_progress'` ⇒ `payments.status='captured'` and stamps `captured_at = now()` for any `completed`/`in_progress` trade. It is a **projection table**.
> **Consequence for QA:** O-2 C05's "Stripe PI still in `requires_capture`" limb **cannot** be evaluated from `payments.status`; the true PI state needs Stripe. (Severity is bounded: `admin_health_strip` only counts `status='failed'`, so no metric is corrupted — but `admin_payments_view` and the `idx_payments_status` index expose the label.) **Reported as an instrument/interpretation finding, NOT a defect.**

### 1.4 Step 5 gate — FIX-Task-23 item 3 (photo picker): 🟡 PARTIAL

| Leg | Result |
|---|---|
| `npm run qa:android-seed-media` | Runs; pushes 13 assets; **MediaStore 24 → 24** and the script **fails loudly** ("Registration verification FAILED… cite R98") — the unchanged count is because the same 12 assets are already registered, so the guard is a false negative, not a failed push. NB the script falls back to `assets/` (app icons/splash) because `assets/qa-media/` does not exist — the "photos" are not representative. |
| Picker **surfaces** seeded media on a fresh mount | **YES — 1 image visible** (the pushed PassItUp icon), with the picker's own permission banner. The previous round's *completely blank* picker is gone. |
| Picker can supply **2+ seeded photos** | **NO** — the "Photos" tab rendered **one** thumbnail with empty space below, and the **"From this device" collection reports "No photos yet"**. Collections shows only Favorites / Camera / From-this-device (no QA album). |
| Single-select + Done round-trip | **Works** — tap image → ✓ overlay → selection bar `1 · Preview · Done` → **Done** returned to the app with `Photos 1/30` (⇒ the Android system picker **is** AX-drivable, re-confirming the 2026-09-08 J13 finding). |

**⇒ The picker fix is a real improvement but NOT a complete unblock:** it moves the picker from "empty" to "one image", which is enough for single-photo flows but **not** for a 2+ photo bulk session. Recommended dev follow-up: push the seed assets to a picker-visible location (e.g. `/sdcard/DCIM/Camera/`) and/or add a real `assets/qa-media/` set, and re-assert `content query` **and** picker visibility (not just the MediaStore row count).

### 1.5 Step 5 — O-1 C07: ✅ PASS (first real bulk session)

Path driven: **Sell → Bulk Upload** (4 steps: Photos → Group → Review → Publish) **→ real system photo picker (1 seeded image + Done) ⇒ a genuine bulk session was created** → `dev-set-item-categories` + `dev-fill-bulk-items` → step 3 "Review 1 item" (Bulk Listing SP Summary: 1 included / 0 SP-enabled / "1 item is set to Cash Only") → **Submit 1 Item for Review** → Confirm Submission (1 item, $20, Ready) → **"Submitting Items For Review…"** → **"Thanks for submitting!"** ✅

**DB read-back:** new item **`bef903a8-5864-4462-9bd9-8f4ba2cefa30`** — "QA Dev Fixture Item 1", $20.00, **`status='pending'`**, product category **Books** (`category_id 4b400d90`), `tax_category_id = 45d31930-60fb-4e60-8fd1-39170506cbab` = **`tax_exempt_goods`**.
⇒ The bulk-created item received **its category's MAPPED tax category**, **not** the flat `general_tangible_goods` default (`e14198fb`) — exactly C07's expected result. ✅

**Caveats (R40 — explicit, not implied):**
- **1 item, not the guide's 2+** — a direct consequence of the picker limitation in §1.4. The *bulk-session → mapped-tax-category* mechanism is proven; the *2+ item* breadth is not.
- The **dev-fixture photo path alone cannot complete**: with `dev-add-test-photos` (which injects photos but **does not create a bulk session**), Submit reproduces the previous round's blocker verbatim — "**Cannot submit for review / Missing bulk session or draft session.**" **FIX-Task-22 item 7 is live**: the actionable hint ("Add your photos from the camera or library to start a session, then submit for review.") + a **Start Over** button both render. ✅ This is the exact causal chain the previous round could only report as BLOCKED.
- The AI auto-fill ("Looks good — run AI auto-fill") was started and, after it did not settle, "Continue Without AI" was used to proceed along the manual path; the item's title/price came from the dev fixtures.

---

## 2. FIX-Task-23 verifications

### 2.1 Item 1 — `qa:r41-first-trade -- create` ✅ FIXED
```
[r41-first-trade] ✅ persona created (a1234567-0000-0000-0000-000000000017) + profile ensured (free tier by trigger — NO trial/active sub)
[r41-first-trade] ✅ saved card pm_1UF0zp4I6kCJlvXopRf0ubcu (MASTERCARD •••• 4444) attached to customer cus_VFW15l2phhKujO
[r41-first-trade] ✅ item f24968b7-5dde-4648-aa2d-d3682183185a ($25.00, Accept-SP) created for test-seller
```
Exit 0. The fixture that had been "still not provisioned" across multiple rounds now provisions cleanly at the new UUID `…017`.

### 2.2 Item 2 — admin auth hang ✅ FIXED (with a genuine reproduction of the precondition)
Reproducible test constructed (not a source read): from a **second same-origin page**, hold the supabase auth Web Lock forever —
`navigator.locks.request('lock:sb-drntwgporzabmxdqykrp-auth-token', {mode:'exclusive'}, () => new Promise(()=>{}))` → verified live `locksHeld.held = ["lock:sb-…-auth-token"]` (the exact F2 precondition) — then load `/reviews` on the main page.

| t | Observed |
|---|---|
| 0.5–3.5 s | "**Checking your admin session…** / **Session check started just now** / **Retry** / **Go to sign in**" (the new item-7 freshness UI) |
| ~4.0 s | **redirect → `/auth/login`** with console `Auth check failed or timed out: Error: AUTH_TIMEOUT` (`AdminShell.tsx:69`) |

**⇒ The gate can no longer hang.** The pre-fix behaviour ("Loading…" indefinitely, 19 pending lock waiters) does **not** reproduce. Evidence: `screenshots/FIX23-item2-auth-gate-lockheld.png`.

*Observation (INFO):* the `Multiple GoTrueClient instances detected in the same browser context` warning still logs — expected with multiple pages each constructing a client; the **stuck-lock precondition can still be created**, it just can no longer wedge the gate.

### 2.3 Item 6 — Item-Detail "Price Breakdown" ✅ NOT A DEFECT (now on-device)
Scroll-and-screenshot re-confirmation as owed: opening Item Detail for "Test cancel trade by seller" ($40.00) and scrolling renders the **Price Breakdown** card —
Item Price **$40.00** · Safety & Platform Fee **$1.49** · Sales Tax (6.99%) **$2.80** · **Total (before SP discount) $44.29** (4000+149+280 = 4429 ✓, 4000×6.99% = 279.6→280 ✓).
⇒ Confirms the dev's ruling: the earlier "did not render" was the documented Android below-fold AX-clipping artifact. **Caveat:** re-confirmed as a **subscriber** persona (test-buyer); the free-persona leg remains source-verified (`ItemDetailScreen.tsx` L776-830 renders unconditionally). Evidence: `screenshots/FIX23-item6-itemdetail-scrolled.png`.

---

## 3. Findings (ranked)

| # | Sev | Class | Finding |
|---|---|---|---|
| F1 | **MED** | **Interpretation trap / instrumentation (NEW)** | **`payments.status` is a derived mirror, not the Stripe PI state.** `fn_payments_sync_from_trade()` (trigger `trg_payments_sync_from_trade`) maps any `in_progress` trade to `payments.status='captured'` **and stamps `captured_at`**, so a QA reader can "prove" an early-capture money defect that does not exist (this round nearly filed it as HIGH). It also means O-2 C05's / O-2 C02's "PI in `requires_capture`" limbs are **not DB-checkable**. Live evidence: `472ef43a` → `payments.captured_at` = accept+97 ms. Consumers: `admin_payments_view`, `idx_payments_status`, `r4_dispute_cost_accounting` (`admin_health_strip` counts only `failed`, so no metric is corrupted). Fix: rename the mirror column/state (e.g. `derived_state`) or add a `stripe_status` column populated from Stripe. |
| F2 | **MED** | **QA drive-recipe defect (NEW)** | **The documented offer-expiry drive can never validate O2-C07's tax limb, and leaks pending tax.** `rpc_process_expired_offers` (the bare RPC) cancels the trade but **never voids the tax record and never cancels the PI**; both live in the **`process-expired-offers` EF**, which pg_cron invokes (`*/2`) — so the real path is correct. Driving the RPC directly (the standard fast-clock recipe, used by R03) **bypasses both legs** and leaves `tax_status='quoted'` permanently (the cron only re-processes `pending` trades). Live: **3** `Offer expired` rows stuck `quoted`, `voided_at` NULL. Fix: change the recipe to POST the EF (not the RPC) — or make the RPC self-sufficient. |
| F3 | **MED** | **Environment / fixture (partially fixed)** | **The Android photo picker still cannot supply 2+ seeded photos**, so any case needing a multi-photo flow remains capped at one. `qa:android-seed-media` registers MediaStore rows (24) but the picker shows **1** and its "From this device" collection is **empty**; the script's success guard is a false negative when assets are already registered. Blocks Group L-style photo paths and the 2+ item breadth of O-1 C07. |
| F4 | LOW–MED | Doc-drift | **O-3 C05 is unreachable as written** — `open-dispute` rejects non-`in_progress` trades, so "complete a trade with captured payment → open a dispute" can never be produced. Re-classified **DOC-DRIFT**; the underlying mechanic is proven via the admin refund path. |
| F5 | LOW | Doc-drift | **O-3 C06** expects `action:'idempotent'` on the refund path; no such field exists there (that key is only on `rpc_mark_tax_collected`). Actual protection = RPC cap guard (`REFUND_EXCEEDS_COLLECTED` + `remaining_cents`) + `resolve-dispute`'s `ALREADY_RESOLVED` + Stripe `charge_already_refunded` reconciliation. |
| F6 | LOW | Doc-drift | **O-2 C04's `cash_amount_cents = 1500 + fee`** describes the composite; shipped `cash_amount_cents` excludes the fee (`buyer_transaction_fee_cents`, `payments.total_charged_cents`). |
| F7 | LOW | Doc-drift | **O-06's "tax rate and jurisdiction are NOT shown"** is stale — the completed-trade row reads "Sales Tax (6.99%)" (same convention already reconciled for O3-C03). Also O-2 C04's "(max 50%)" vs the shipped per-category cap ("Max: 18 SP (75% of price)"). |
| F8 | LOW | Analytics hygiene (harness residue) | **25 cancelled trades carry `tax_status='quoted'` with `cancellation_reason='buyer_cancelled'`** — writers are all QA/seed harnesses (`cleanup-test-trades.ts`, `scripts/qa/reset-offer-fixtures.mjs`, `seed-staging-data.ts`), i.e. **harness residue, NOT a product defect** (verified by enumerating writers before judging). It inflates `pending_tax_cents` in period reports; the QA/seed cleanup paths should void tax (or the reports should exclude harness cancellations). |
| F9 | LOW | Dev-build friction (reproduced ×2) | The dev **LogBox notification overlay intercepts taps** on the bottom CTA band: it silently ate "Submit for Review" and "Looks good — run AI auto-fill" until dismissed via its ✕. Compounded by dev LogBox noise surfacing raw RPC errors (`[getRecommendations] RPC error`, `[subscription] Error getting transaction fee`) — dev-only surfaces, but they cost real taps. |
| F10 | INFO | Doc-drift (verification method) | The buyer's refund card shows **"Refunded on Sep 11, 2026"** while `trade_refunds.created_at` = `2026-09-12T01:46Z` — the card renders **local** time; a reader comparing `created_at::date` would wrongly file a mismatch. |

---

## 4. UX review (three layers)

**Structural / affordance**
- The Bulk Upload stepper (1 Photos → 2 Group → 3 Review → 4 Publish) is clear and the green CTA advances the mental model correctly. The empty state ("Add photos to get started") plus the grouping hint ("Long-press any photo to start selecting…") are genuinely helpful.
- The "Cannot submit for review" dialog is **actionable** (FIX-Task-22 item 7): it names the cause and offers Start Over. **CONFIRMED.** No dead-end.
- The trust band on Item Detail ("Trades are protected by our safety guidelines. Complete in-person exchanges only.") is present and legible.
- No deviation found in the **Refund** card's information architecture (status → amount → tax portion → method → date) — it mirrors the Review Offer money-row convention as the guide requires.

**Wording / copy clarity**
- "You saved $15.00 using SP! You have 459 SP available." — clear, specific, correctly uses the SP noun. No rewrite needed.
- "**1 item is set to Cash Only** / Enable 'Accept Swap Points' on item cards to include…" — the sentence is truncated by the container and reads as a fragment; consider completing it ("…include it in the SP summary") or shortening to "1 item is Cash Only".
- "**Submitting Items For Review…** / Please wait. We are uploading your items and preparing them for admin review." — good, calm, no raw codes.
- Dev LogBox strings leak raw internals (`subscription`, `getRecommendations`, JSON error objects) — dev-build only; not a user surface (flagged for hygiene, F9).

**Design-system compliance (vs `docx/design-system-passitup.md`)**
No deviations found on the screens checked (**Item Detail**, **Make Offer**, **Trade Timeline — Payment Details + Refund card**, **My Trades**, **Bulk Upload** ×4 steps, **Add Photos sheet**, **Confirm Submission**, **Liability Disclaimer**, **Home**, **Discover**): primary green `#5DBB8E` pills, the green success band, the money-row label/value convention, and the amber warning strip all match. The Liability Disclaimer's checkbox renders pre-ticked with the brand check glyph. **The modal's Amazon-derived body copy is out of scope per the brief and was not assessed.**

---

## 5. Friction vs. the operating rules

- **Cold dev-client start cost is large:** terminate → launch → splash → Dev Launcher → **tap the Metro row** → "Loading from 10.0.2.2:8081…" → blank first frame → Home took roughly **8:13 → 8:17 (~4 min)**. Screenshot-polling this is ~10+ calls (F9/memory's "several minutes / ~20 polls" reconfirmed). **Diagnosing via `adb logcat` + `dumpsys` instead of blind polls was the right call** and should be the standing technique.
- **The Android IME was invisible to the AX tree again** (§5.19 addendum holds): the numeric keypad was up while the tree reported pre-keyboard coordinates. Screenshot-gating before the tap was decisive.
- **`mobile_swipe_on_screen` worked** here (timeline + picker grid) when started over non-interactive content — no need for the `qa:scroll-to` tool (whose Android no-op is R94).
- The **LogBox tap-eating** (F9) cost 4 calls; the recovery is "dismiss the ✕ first", which is now a repeatable pattern.
- Dev fixtures **grey out** in the Bulk Upload "Group" step once a real photo is added ("Dev: Set Categories"/"Dev: Fill All Items" appeared muted/disabled), so the fixture route and the real route are not freely composable.

---

## 6. Ledger (manual tally — R71 fallback)

≈**130 executions** across: device calls (screenshots / AX listings / taps / swipes / app lifecycle) ≈78 · read-only SQL ≈24 · terminal (scripts, adb, greps, verification) ≈11 · browser/admin (Playwright) ≈2 · desk reads/greps/memory ≈15.
Verdict-items ≈12 ⇒ ≈**10.8 blended**, device-only verdicts (O2-C04, O07, O1-C07, item 3, item 6) ≈ 5 ⇒ ≈**15.6 device calls/verdict** — inflated by the ~10-call cold-start and the picker exploration.

---

## 7. App state left behind

- **Android emulator:** logged in as **test-buyer**, parked on the **Bulk Upload** success screen ("Thanks for submitting!"). New item `bef903a8` **pending** admin review (Clean-up candidate). The Bulk flow also left **2 unfinished listings** ("Action Items: You have 2 unfinished listings") — pre-existing from a prior round plus this one's session.
- **Data created:** trade **`472ef43a`** (test-buyer → test-seller-3, in_progress, 15 SP reserved, PI `pi_3UF0yS4I6kCJlvXo14VIbiFQ` authorized, `auto_complete_at` 2026-09-16 — will auto-complete; cancel it if not wanted); item `bef903a8` pending; `qa-first-trade` persona `…017` + item `f24968b7` provisioned; SP wallet 474 → **459** on offer then reserved (expected flow state).
- **Mutated residue:** tax record of `3265ec84` = `partially_refunded` (`refunded_tax_cents` 100, `stripe_capture_id` `dup_charge_123`) — disposable harness residue, flagged for cleanup.
- **Admin portal:** the shared page was left at **`/auth/login`** (the item-2 lock test intentionally forced the timeout redirect). **The admin session in that page is now signed out** — re-login to resume admin work. Route stubs were cleared (`page.unrouteAll` + `context().unrouteAll`) before and during; the lock-holder page was closed.
- **No app code, migrations, `.env`, or `admin_config` writes.** No `git push`. Metro :8081 and :8082 left running (multi-session; neither killed).

---

## 8. Suggested to Improve Agent Rules

**Add to §5.x: "a derived/projection table is not evidence of the external system's state — find the writer before filing."** This round produced two consecutive *near-miss false positives* from reading a database projection as ground truth: (a) `payments.status='captured'` on an `in_progress` trade looked like a HIGH early-capture money defect, but `fn_payments_sync_from_trade` maps `in_progress → 'captured'` by design; (b) the Refund card's "Sep 11" vs `created_at` `2026-09-12T01:46Z` looked like a date mismatch, but it is local-time rendering. Both were resolved in one query each (`pg_get_functiondef` / the raw timestamp) and both would have been *filed*. The rule: **before filing any finding whose evidence is a single column value, name the writer** (trigger/function/EF) — and prefer the *source-of-truth* column or the upstream system. This generalizes R83 (§5.72, DB-vs-app tiebreaker) from "which value is right" to "is this value even an observation".
