# QA Task — FIX-Task-17 Verification + TRD Stage-4 Wrap-Up (combined session)

**Date:** 2026-09-11 (evening session, 23:00–23:15 UTC device work)
**Platform this round:** Android `Medium_Phone_API_36.1` (Android 16, emulator-5554). iOS `iPhone 17 Pro Max` (3F3293A3) booted but **not driven**.
**Run folder:** `e2e-test-results/qa-fix17-verify-trd-stage4-2026-09-11/` (report.md + ledger.md + screenshots/ 9)
**HEAD at start:** `9d995b77` (FIX-Task-16v2) — app code **not modified** by this agent (execution-only boundary).

> ### ⚠️ HEADLINE: PHASE 1 = 12 PASS / 1 PARTIAL. PHASE 2 = PARTIAL — a genuine sub-batch only, not the requested wrap-up.
> Phase 1 (FIX-Task-17 verification) is **fully discharged**: every numbered item verified, MCP restored (hard
> precondition met), and the two items that can't be fully closed are stated with their exact missing leg.
> Phase 2 is **NOT complete**: this session converted **8 Phase-2 TRD case verdicts** (7 PASS · 1 PARTIAL) plus 4 by-product legs — the buyer-side bundle harvest was executed on a *fresh QA-owned* bundle instead of the
> Stage-3 bundle, and Phase 2b/2c (K–T backlog, Round-3 groups U–Y/N2) were **not reached**. Root causes and
> the exact not-reached scope are in §4 (R40 explicit per-scope statement, no "deferred" hand-wave).

---

## Phase 1 · FIX-Task-17 verification (13 items)

| # | Item (FIX-Task-17) | Verdict | Evidence |
|---|---|---|---|
| **0** | Supabase MCP restored | ✅ **PASS** | `mcp_supabase_execute_sql` `SELECT current_database(), now()` → `postgres / 2026-09-11 22:59:29+00`. **Hard precondition for Phase 2 satisfied**; every DB read-back below used it. |
| **1** | Cold-start My Trades fix (F1) | ✅ **PASS** | Terminate → cold launch (Dev-Launcher → `10.0.2.2:8081`) → **first mount** of My Trades as `test-buyer` rendered **Your Offers 1 / In Progress 0 / Needs Action 0 / Completed 32 + the pending offer card + completed rows immediately** — no false empty state, no manual remount. `screenshots/p1-item2-coldstart-mytrades-first-paint.png` |
| **2** | Singular/plural copy (F3) | ✅ **PASS** | Same first-paint card reads **`Offer · 1 item`** (AX text) for the 1-item offer — not "Bundle Offer · 1 items". Re-confirmed later on the buyer's Your Offers card. `p1-item2-coldstart-mytrades-first-paint.png` |
| **3** | Checkout-failure copy (F6) | ✅ **PASS** | Real rejection driven with the R93 fixture (`qa:invalidate-payment-method --persona test-buyer`): branded alert **`Checkout Failed` / "Payment method declined. Please update your card."** — one surface, buyer vocabulary, **no "Payout method" language**, no LogBox. Metro log: `[cartService.checkoutCart] Batch offer failed: {"code":"INVALID_PAYMENT_METHOD", …}` logged as **WARN** (the console.error→warn downgrade holds). `p1-item4-6-checkout-failed-alert.png` |
| **4** | Disclaimer persistence (F5) | ✅ **PASS** | First checkout in the session: modal renders **unchecked** with Accept **disabled**; after tick+accept, the **second** checkout in the same session renders with **`disclaimer-modal-checkbox` = checked** and Accept **enabled** — it does **not** re-render unchecked. `p1-item4-disclaimer-first-render-unchecked.png`, `p1-item4-disclaimer-second-attempt-preticked.png` |
| **5** | Failure banner contrast/placement (F5/F6 deviation) | ✅ **PASS** | Screenshot: the alert is an **opaque white card** with elevation over a clearly dimmed (0.55 scrim) background; the Order Summary card behind it is visibly dimmed and **does not bleed through** the alert. Contrast legible (near-black title on white; gray body; primary-green `#5DBB8E` OK pill). `p1-item4-6-checkout-failed-alert.png` |
| **6** | Review Offer payout-row copy (F2) | ✅ **PASS (on-device)** | Seller **Review Offer** payout breakdown renders **`Safety & Platform Fee  −$2.50`** (Cash Amount $25.00 → Net Cash Payout $22.50). `p1-item6-seller-review-offer-safety-platform-fee.png` ⚠️ **Known deferred decision re-observed:** the *pending-offer Trade Timeline* "Payment Details" block still reads **`Platform Fee:`** — that is the documented FIX-Task-17 `DEFERRED-DECISION (2026-09-11)` (Timeline / TradeDetail / SellerEarnings kept), **not** a regression. |
| **7** | L07 guide locator hints (F7) | ✅ **PASS** | Guide line 2527 now names `accept-bundle-confirm-button` / `accept-bundle-cancel-button`; **both verified live** in the confirm modal's AX tree (the stale `btn-accept-all-confirm` ids are gone). `p1-item7-accept-bundle-confirm-locators.png` |
| **8** | Single-item cart CTA testID (F10) | ✅ **PASS** | `CartScreen.tsx:824` → `testID={cartItems.length >= 2 ? 'bundle-cta-button' : 'single-item-cta-button'}`; on-device a **3-item** cart renders the CTA as **`bundle-cta-button`** ("Make offer") — consistent with the ≥2 branch. |
| **9** | Metro / cold-connect (F9) | ✅ **PASS** | `npm run metro:kill` found and killed **TWO** stray Metros (`:8081` pid 15240, `:8082` pid 15465) — the exact F9 condition; `npm run start:single` then started exactly one (`:8081`). **Cold-connect measured:** Dev-Launcher row tap → usable Home ≈ **20–30 s** (±polling), of which Metro bundling was only **2 013 ms** (`Android Bundled 2013ms index.ts (5406 modules)`); a **warm** terminate+relaunch bundled in **261 ms** yet still showed a **blank first frame for several seconds**. ⇒ the residual cold-connect cost is **native dev-client init, not bundling** (F9's ~90 s figure did not reproduce once a single Metro was guaranteed). |
| **10** | Tracker count reconciliation (F8) | ✅ **PASS** | `QA-TESTCASE-STATUS-2026-09-03.md` never-run header = **(17)**; the table holds **17** data rows (A03, A04, D05, D06, E05, E06, N2, Q10, Q11, Q13, Q14, Q16, R01, R02, R03, R04, R05); §1 roll-up TRD Remaining = **17**; TRD section header = **17**; 238+25+1+5+2+17 = 288 ✓. ⚠️ LOW residual: one *baseline note* inside the TRD block still quotes `236 PASS / 27 PARTIAL` while §1 + the section header both say `238 PASS / 25 PARTIAL` (both sum to 271 completed — note-level drift only, not a header/roll-up mismatch). |
| **11** | Buyer-fixture resolution (F11) | ✅ **PASS** | Fresh QA-owned bundle fixture intact and usable: `cart_items` ×3 on cart `73d5eb11-…` (`bundle_id 0f6c1ac0-…`), all $25.00 `accept_sp`, buyer `49243010-…` = **`test-buyer`** (registered persona → `qa-login-as` worked), listings `5e99402b… / 71e82561… / 9252df82…` all `available` under `test-seller-3` (`a1234567-…0012`). Buyer drove the real checkout end-to-end (§2a). |
| **12** | Migration recorded / column boolean (F12) | 🟡 **PARTIAL** | `admin_config` → `charge_one_fee_per_bundle` = `'true'`, **`data_type='boolean'`**, `is_active=true` (**column leg PASS**). **BUT** `supabase_migrations.schema_migrations WHERE version LIKE '20260911%'` → **0 rows**: the migration file exists in the repo (`supabase/migrations/20260911000001_fix_task_16_charge_one_fee_per_bundle_data_type.sql`) but is **NOT recorded** — confirming the FIX-Task-17 memory's "applied out-of-band (BP-81)" finding. **Do not re-apply blindly** (the data state is already correct). |

**Phase 1 result: 12 PASS · 1 PARTIAL · 0 FAIL.** No Phase-2 dependency was left unsatisfied — item 0 (MCP) passed, and item 12's dependency (buyer-side harvest) was satisfied by item 11.

---

## Phase 2a · Buyer-side bundle harvest (executed, but on a *fresh* bundle)

**Fixture used:** the QA-owned bundle `73d5eb11-…` (cart) / items under `test-seller-3` — **NOT** the Stage-3
bundle `330427dc` (whose buyer `d84bcc68…` is still not a QA persona). `qa:reset-offer-fixtures` was **never run**.

**Flow driven (one continuous flow, R82 one-flow-many-verdicts):** buyer login → Basket (3 items) → bundle
checkout → disclaimer accept → **Send Offer · $79.99** → "Trade Initiated" (3 pending trades created,
DB-verified) → seller login → Needs Action bundle card → Review Each → **Accept All 3** → "Bundle Accepted!"
(3 trades `in_progress`, DB-verified) → buyer → In Progress bundle card → open bundle timeline → **I Got It** →
"Confirm all 3 items received?" → **Just This One** → "Complete Trade" → Complete (**1 of 3 completed**,
DB-verified) → reopen → I Got It → **no Confirm-All prompt** → Complete (**2 of 3 completed**).

| TC-ID | Case | Verdict | Evidence |
|---|---|---|---|
| **L01** | Bundle banner on trade detail | ✅ **PASS** | `bundle-context-banner` "Bundle offer · 3 items" (seller *and* buyer view) + "View all items"; **live count re-rendered as "Bundle offer · 2 items"** after one sibling completed. `p2a-buyer-bundle-timeline-inprogress.png`, `p1-item6-…` |
| **L02** | Confirm All shortcut (buyer) | 🟡 **PARTIAL** | **`Just This One` leg PASS + DB-verified:** `I Got It` → **"Confirm all 3 items received?"** with `confirm-all-cancel-button` ("Just This One") / `confirm-all-trades-button` ("Confirm All 3") → Just This One → second confirm (`complete-trade-confirm-button`) → **exactly 1 of 3 trades `completed`**, siblings still `in_progress`. **`Confirm All N` leg NOT reproduced:** on the reopened *partially-completed* bundle, `I Got It` went **straight to the single "Complete Trade" dialog with no Confirm-All prompt** → the "Confirm All N completes both trades" assertion is unverified **and** the prompt's absence in that state is a new LOW observation (below). |
| **L03** | Bundle offer rows in Offers tab (seller) | ✅ **PASS** | Seller Needs Action: `trade-bundle-73d5eb11-…-card` = "📦 Bundle Offer · 3 items" / OFFER + 3 priced line items + Review Each / Accept All / Decline All. |
| **L05** | In-progress bundles section (Buying tab) | ✅ **PASS (Android, buyer)** | Buyer My Trades → **IN PROGRESS** group renders `trade-bundle-73d5eb11-…-view` labelled **"📦 Bundle · 3 items"** with all 3 items + "View →"; counts reconcile with the header tiles (In Progress 3). `p2a-buyer-inprogress-bundle-card.png` |
| **L06** | Bundle banner in Review Offer screen | ✅ **PASS** | `bundle-context-banner` "Bundle offer · 3 items" + `review-bundle-toggle` "View all items"; BUYER OFFERS rows + payout card. |
| **L07** | Accept All N Items (Review Offer) | ✅ **PASS** | `accept-bundle-button` "Accept All 3 Items" → confirm copy *"Accept all 3 items? Accepting will authorize the buyer's payment and move all trades in progress."* → `accept-bundle-confirm-button` → **"Bundle Accepted! Payment authorized. Trades are now in progress."** → 3 trades `in_progress` (DB-verified). |
| **L09** | Bundle card in Your Offers (buyer) | ✅ **PASS (Android, buyer)** | Buyer "YOUR OFFERS" card + the in-progress bundle card; the 1-item pending offer card reads **"Offer · 1 item"** (FIX-17 item 2 re-confirmed on the live surface). |
| **R01** | Buyer cancels pending trade → cancelled, auth voided, SP restored | ✅ **PASS (SP leg N/A)** | Real drive on pending trade `91a76811…`: pending Trade Timeline → `cancel-trade-button` → `CancellationReasonModal` (`cancellation-reason-found_elsewhere/changed_mind/other`, buyer-scoped reasons) → **Changed mind** → `cancel-trade-confirm-button`. **DB read-back:** `status='cancelled'`, `cancellation_reason='Changed mind'`, `cancelled_at=2026-09-11 23:10:09.729988+00`. EF response `{"cancelledTrades":["91a76811…"],"consequence_level":null,"sp_refunded":0,"success":true}`. **SP-restoration leg N/A** — the offer had `sp_amount=0` (0 SP reserved), so `sp_refunded 0` is correct-for-state, not untested behaviour. |

**Also harvested as by-product (no new IDs):** K04/K05 **steps 7–10** buyer-side totals on the 3-item bundle
checkout — Subtotal **$75.00** / Safety & Platform Fee **$1.49** (one fee per bundle, toggle ON) / Sales Tax
**(4.67 %)** **$3.50** / Cash Total **$79.99**, with `tax-label` a11y label `Sales Tax, 4.67%, CT` and the
per-item SP blocks (`sp-input-<listing>`, "You can use up to 18/12/17 SP", "Limited by this item's category")
plus the `points-remaining-banner` **"Points remaining: 474"** (T06-family counter, cash-only run). **M12**
re-confirmed: `Accepts Points · Up to {12,17,18} SP` per cart item. Completion logs: real Stripe captures
(`stripe_capture_id ch_3UEdW2…`, `ch_3UEdW3…`) + `[trade] tax applied: 175 cents (idempotent_hit=true)` then
`0 cents (idempotent_hit=false)`.

### Not reached from this harvest (honest list)
`T08–T11` (points-*redemption* bundle legs — need a **SP>0** bundle checkout; this checkout was cash-only
`sp_amount=0` for all 3 trades) · `M08/M09/M10` (cart remove/clear/saved-carts — the cart was consumed by the
checkout) · `L02`'s Confirm-All-completes-both leg (see above) · the Stage-3 bundle `330427dc` buyer legs
(still persona-inaccessible — buyer `d84bcc68…`).

---

## Phase 2b / 2c · NOT REACHED

Stated per R40 as an explicit per-scope statement, **not** a "deferred" note:

- **2b (O, O-1, O-2, O-3, P, Q, R-rest, M-rest, N-rest, S-rest, T-rest, K02/K07–K09): NOT STARTED.** Zero cases from this scope were driven. Tier-1 money/tax groups (O/P) and the R refund/cancellation remainder need fresh fixtures + admin legs that this round's remaining budget could not cover after Phase 1 + 2a.
- **2c (U, V, W, X, Y, N2 — Round 3, never dispatched): NOT STARTED.**
- **R62b off-brand-hex grep (carried-forward owed item): RAN — CLEAN.** `grep -rEn "#4A7C59|#4D4D4D|#808080" p2p-kids-marketplace/src` → **0 hits**. Owed item closed.
- **R94 / `qa-scroll-to`:** not used this round; reachability was achieved with mobile-mcp swipes + tree-driven taps only.

---

## 3 · Findings

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **N1** | **LOW** | **The "Confirm all N items received?" shortcut does not appear once a bundle is partially completed.** With **3** in-progress siblings, `I Got It` raised the confirm-all prompt (Just This One / Confirm All 3). Reopening the same bundle with **2** in-progress siblings, `I Got It` went **straight to the single-item "Complete Trade" dialog** — so the buyer has no "confirm the rest" shortcut from that state, and L02's `Confirm All N` assertion could not be exercised. Product-intent question (may be deliberate), but the inconsistency is user-visible. | AX trees at the two states (see §2a L02); no alert/LogBox logged. |
| **N2** | **LOW (doc/tracker)** | TRD tracker **note-level drift**: a baseline note inside the TRD block still quotes `236 PASS / 27 PARTIAL` while §1 + the TRD section header both read `238 PASS / 25 PARTIAL` (both sum to 271 completed → 288). Header/roll-up/table-header all reconcile; only that note is stale. | `QA-TESTCASE-STATUS-2026-09-03.md` (TRD block baseline notes). |
| **N3** | **LOW (known, re-observed)** | **`Platform Fee:`** still renders in the *pending-offer Trade Timeline* "Payment Details" block (buyer, $1.49) while Review Offer + Checkout now read "Safety & Platform Fee". This is the **documented FIX-Task-17 `DEFERRED-DECISION (2026-09-11)`** (Timeline/TradeDetail/SellerEarnings kept deliberately) — recorded here only so the next round does not file it as a new defect. | `screenshots/…` + AX text on the pending timeline. |
| **N4** | **LOW (fixture/schema)** | At checkout the app stamps **`trades.bundle_id = cart_id`** (`73d5eb11-…`), not the `cart_items.bundle_id` (`0f6c1ac0-…`) the `qa:create-bundle-fixture` helper writes. Functionally the bundle groups correctly (one card, one authorization, one fee) — worth knowing before writing fixture-based assertions on `bundle_id`. | `cart_items` vs `trades` read-back. |
| **F4 (carry)** | **CRITICAL (pre-existing, standalone)** | The liability disclaimer still renders **Amazon's commercial-insurance boilerplate** (re-observed verbatim on-screen). Standalone legal-copy task per the dispatch — **not** part of this round. | `p1-item4-disclaimer-first-render-unchecked.png` |

---

## 4 · Perceived load time (§5.7)

> *Perceived load time (emulator, wall-clock, ±polling-interval precision) — not a formal performance profile.*

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Dev-Launcher row (`10.0.2.2:8081`) → usable Home (cold) | **~20–30 s** (bundle 2 013 ms; blank frame observed) | ⚠️ FLAGGED — dev-harness native init, **not** bundling, **not** app behaviour |
| terminate → launch → row tap → Home (warm) | **~8–12 s** (bundle 261 ms; blank frame still several s) | ⚠️ FLAGGED — same harness cost |
| Basket → Checkout | < 1 s | OK |
| Checkout → rejection alert (`Send Offer`) | ~2 s | OK |
| Checkout → TradeSuccess (3 real Stripe authorizations) | ~10 s | ⚠️ ≥3 s — expected for a real money round-trip |
| Review Offer → "Bundle Accepted!" (3 authorizations) | ~3 s | ⚠️ ≥3 s — real money round-trip |
| `qa-login-as` deep link → usable session | ~5–10 s (single delivery) | OK (no 2nd-delivery retry needed this round) |
| Pending timeline → reason sheet → confirm → cancelled | < 1 s | OK |

---

## 5 · App state left behind

- **App: logged OUT** (`qa-logout` → Landing verified by screenshot, `session-end-logged-out.png`). Metro `:8081` left running (single instance); both devices left booted.
- **New trades created (this round's fixture, buyer `test-buyer` × seller `test-seller-3`):** `0788cc0e…`, `4d50a44e…`, `f2899f12…` (bundle/cart `73d5eb11-…`). **2 completed** (real Stripe captures, tax applied), **1 left `in_progress`** (`0788cc0e…`, buyer payment authorized, auto-completes in ~72 h). Buyer My Trades now: Your Offers **0**, In Progress **1**, Completed **34**.
- **Fixture consumed:** the 3 `QA Bundle Fixture N of 3 (2026-09-11)` listings are now `sold`/consumed into those trades; the 3 `cart_items` rows were consumed by the checkout. The `qa:create-bundle-fixture` bundle is **no longer reusable**.
- **Stage-3 bundle `330427dc…` untouched** — still `in_progress` (3 trades), buyer still not a QA persona.
- **`qa:invalidate-payment-method` blast radius (R93):** test-buyer's previously-stored card (`pm_1UEcDF4I…`) stayed detached; persona **restored** with one fresh valid MASTERCARD •••• 4444 (`pm_1UEdUX4I6kCJlvXoO6rl6uA9`) attached to `cus_Ungj4MptKp9CUg` — restore VERIFIED (Stripe retrieve + attach + DB read-back).
- **No `admin_config` writes** were made this round (read-only only). Session-local dev toggles: none armed.
- **Android emulator setting changed (reversible, standing):** `settings put secure stylus_handwriting_enabled 0` (R77 #2 — prevents the Gboard stylus tutorial stealing field focus).

---

## 6 · Evidence index (screenshots/)

| File | Shows |
|---|---|
| `p1-item2-coldstart-mytrades-first-paint.png` | Phase-1 items 1 & 2 — cold-start My Trades first paint (1 / 0 / 0 / 32) + "Offer · 1 item" |
| `p1-item4-disclaimer-first-render-unchecked.png` | Item 4 — first session checkout: unchecked box, Accept disabled (+ F4 Amazon boilerplate) |
| `p1-item4-6-checkout-failed-alert.png` | Items 3 & 5 — "Checkout Failed / Payment method declined…" over a 0.55 scrim |
| `p1-item4-disclaimer-second-attempt-preticked.png` | Item 4 — second checkout in-session: box pre-ticked, Accept enabled |
| `p1-item6-seller-review-offer-safety-platform-fee.png` | Item 6 — Review Offer payout row "Safety & Platform Fee" |
| `p1-item7-accept-bundle-confirm-locators.png` | Item 7 — live `accept-bundle-confirm-button` / `accept-bundle-cancel-button` |
| `p2a-buyer-bundle-trade-success.png` | Phase 2a — buyer bundle checkout committed |
| `p2a-buyer-inprogress-bundle-card.png` | Phase 2a L05/L09 — buyer IN PROGRESS bundle card |
| `p2a-buyer-bundle-timeline-inprogress.png` | Phase 2a L01/L02 — buyer bundle timeline (banner, I Got It CTA, 72 h auto-complete) |
| `session-end-logged-out.png` | Session close — clean Landing |

---

## 7 · Friction vs the operating rules

1. **Emulator 1:1 coordinate model held** (R77 #1) — every tree coordinate tapped was correct; the one ambiguity (a *pinned* CTA reporting a y that overlaps the next-steps card) was resolved by screenshot before tapping (§5.9/R22).
2. **Swipe-over-interactive-content no-ops** (R77 #10/#14) — two `mobile_swipe_on_screen` calls started over item cards and did **not** scroll; starting the swipe on a label/non-interactive band scrolled reliably. No switch to `adb input swipe` was needed.
3. **A DB read fired too early once** — I queried trade `91a76811` in the same parallel call as the post-cancel tree read and saw `pending`; the Metro log (`Trade cancellation response … success:true`) proved the write landed ~1 s later and the immediate re-query confirmed `cancelled`. **Lesson (small): after a money/state action, read the app's own EF/analytics line or wait one poll before the DB read-back** — otherwise a correct write reads as a failure.
4. **Schema surprises cost 3 calls** (`trades.price_cents`, `trades.accepted_at`, `trades.cancelled_by`, `trades.escrow_status`, `items.price_cents` all absent) — I did not run the §5.34 schema-first pull before the first `trades` query. Add the verified `trades`/`items` column sets to `/memories/repo/schema-cheat-sheet.md`.
5. **Self-inflicted waste:** ~5 calls lost to grepping a stale AX resource file instead of re-listing the tree (R77 #8 is for *below-fold rows of the current* file only).

---

## 📋 QA Session Handoff

**Test Scope:** Phase 1 — FIX-Task-17 items 0–12 (13 checks, Android `Medium_Phone_API_36.1` + source/DB). Phase 2a — TRD bundle harvest: TRD-TC-L01/L02/L03/L05/L06/L07/L09 + TRD-TC-R01, plus by-product evidence for K04/K05 (steps 7–10), M12 and the T06-family counter. Phase 2b/2c NOT reached.
**Design-System Compliance:** **PASS** — no new deviations. Re-checked surfaces: CartCheckout (fee/tax rows, per-item SP blocks, payment-method cards, Order Summary), Review Offer (bundle banner, payout card), Trade Timeline (buyer + seller, banner/status/stepper/next-steps/CTA), My Trades (tiles, offer/bundle/History cards, empty+loading states), Branded alert (scrim 0.55 + elevation), Disclaimer modal, CancellationReasonModal, Landing. Off-brand-hex sweep (R62b): **0 hits** for `#4A7C59`/`#4D4D4D`/`#808080` across `p2p-kids-marketplace/src`. One deliberate, documented exception re-observed: pending-Timeline "Platform Fee:" label (FIX-Task-17 `DEFERRED-DECISION`).
**Perceived Load-Time Verdict:** FLAGGED — Dev-Launcher → Home cold ≈ **20–30 s** and warm ≈ **8–12 s** (bundle time only 2 013 ms / 261 ms ⇒ dev-harness native init + blank first frame, **not** bundling and **not** product behaviour); checkout → TradeSuccess ≈ 10 s and Review Offer → "Bundle Accepted!" ≈ 3 s (both real Stripe money round-trips, expected). All app-internal navigations were < 1 s.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — **CartCheckout (Checkout)**: "Combined Offer" banner, Safety & Platform Fee $1.49, "Sales Tax (4.67%)", per-item SP blocks, one primary CTA ("Send Offer · $79.99").
- CONFIRMED — **Branded alert ("Checkout Failed")**: opaque card, single string, buyer vocabulary, no seller-side "payout" wording.
- CONFIRMED — **Bundle confirm dialog / cancellation-reason sheet / Disclaimer modal**: canonical testIDs, one primary per dialog, 44 px+ targets.
- CONFIRMED — **Review Offer (seller)**: "Safety & Platform Fee" payout row; "Accept All 3 Items" primary + "Accept Trade" secondary + "Decline" — one primary at a time in the visible stack.
- DEVIATION (documented exception) — **Pending-offer Trade Timeline**: "Payment Details → **Platform Fee:**" still uses the pre-rename label (FIX-Task-17 DEFERRED-DECISION).
**Verdict Summary:** **19 PASS / 2 PARTIAL / 0 FAIL / 0 BLOCKED / 0 SKIPPED** (Phase 1: 12 PASS · 1 PARTIAL of 13 checks; Phase 2: 7 PASS · 1 PARTIAL of 8 case verdicts) *plus* the R62b sweep PASS, 4 by-product legs (K04/K05 steps 7–10, M12, T06-family counter) and 2 LOW observations (N1 bundle confirm-all state dependence, N4 bundle_id stamping).
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — **TRD-TC-R01 promoted out of "Remaining (NEVER RUN)" → ✅ PASS** (`2026-09-11`, this run, DB-verified cancellation with the SP leg N/A-by-state); never-run header **17 → 16**, §1 roll-up TRD **PASS 238 → 239 / Remaining 17 → 16**, TRD section header updated in the same pass (R56 arithmetic re-checked: 239+25+1+5+2+16 = 288). Notes refreshed (Date/Source + re-verify detail) on **L01, L02, L03, L05, L06, L07, L09** (no status flips). New per-guide totals — AUTH 128/1/2/0 · MSG 64/4/2/0 · **TRD 239 PASS / 25 PARTIAL / 1 OPEN / 5 DRIFT / 2 SKIP / 16 Remaining** · ACC 68/0/2/0 · ADM 144/12/0/3 · SUB 77/2/3/1.
**Critical Findings:** (1) **LOW — bundle "Confirm all N" shortcut disappears once the bundle is partially completed** (3 siblings → prompt; 2 siblings after one completed → straight to the single Complete dialog) — L02's Confirm-All leg unverified *and* a user-visible inconsistency. (2) **PARTIAL — FIX-Task-17 item 12:** the `charge_one_fee_per_bundle` migration is **not recorded** in `supabase_migrations` although the column is correctly `boolean` (applied out-of-band, BP-81) — do **not** re-apply blindly. (3) **CRITICAL (pre-existing, out of scope)** — the checkout disclaimer is still Amazon's boilerplate (standalone legal-copy task). (4) LOW — TRD tracker baseline note still says 236 PASS/27 PARTIAL vs §1's 238/25. (5) LOW — pending-Timeline "Platform Fee:" label (documented deferred decision).
**App State Left Behind:** App **logged out** (Landing). Metro `:8081` running (single instance). New trades under bundle `73d5eb11-…`: `f2899f12…` + `4d50a44e…` **completed** (real Stripe captures; tax applied), `0788cc0e…` **in_progress** (buyer payment authorized, auto-completes ~72 h). The `QA Bundle Fixture 1/2/3 of 3 (2026-09-11)` listings are consumed (sold) — that fixture is spent. Stage-3 bundle `330427dc…` untouched. test-buyer restored to a valid MASTERCARD •••• 4444 (`pm_1UEdUX4I…`); its old card stays detached (permanent). test-buyer's stale pending offer `91a76811…` **cancelled** (cleanup). No `admin_config` writes; no dev toggles armed; emulator `stylus_handwriting_enabled=0` left set.
**Why It Matters:** Phase 1 proves the whole FIX-Task-17 batch actually landed and behaves correctly on device — including the two fixes a user feels most (no false "No Trades Yet" on cold start; one buyer-appropriate checkout-failure message with a legible, non-bleeding alert) — and it isolates the **only** leg that is not fully closed (the missing `schema_migrations` row). Phase 2a converts the previously-blocked buyer-side bundle legs into real Android verdicts on a QA-owned fixture, and — crucially — closes **TRD-TC-R01** with a genuine DB-verified cancellation instead of the "equivalent PASS elsewhere" placeholder it had carried. The shortfall is equally important: **2b/2c did not run at all**, so the ~120-row K–T Android backlog and the never-dispatched Round-3 groups remain exactly where they were.
**How to Verify/Reproduce:** All evidence in `e2e-test-results/qa-fix17-verify-trd-stage4-2026-09-11/screenshots/` (index in §6). Phase-1 reproduction: `qa:invalidate-payment-method --persona test-buyer` → submit any offer → the "Checkout Failed / Payment method is declined…" alert (then `--restore`); cold-start check = terminate → launch → Dev-Launcher `10.0.2.2:8081` → Trades tab. Phase-2 reproduction: `mcp_supabase_execute_sql` on `trades WHERE bundle_id='73d5eb11-f0a3-44d5-9e7f-ff4988212c01'` (statuses 2 completed / 1 in_progress) and `WHERE id='91a76811-9ded-4aef-8686-a0ab4f3c8083'` (cancelled / "Changed mind"). Metro wall-clock: single-Metro check via `npm run metro:kill` then `npm run start:single`.
**Known Gaps / Not Tested:** (a) the **entire Phase 2b scope** (O, O-1, O-2, O-3, P, Q, R02–R05, remaining M/N/S/T, K02 first-trade tier, K07–K09) and the **entire Phase 2c Round-3 scope** (U, V, W, X, Y, N2) — zero cases driven; (b) **T08–T11** points-redemption bundle legs (need an SP>0 bundle checkout); (c) **M08/M09/M10** cart remove/clear/saved-carts (cart consumed by the checkout); (d) **L02 "Confirm All N completes both"** (no ≥2-sibling state remained after the Just-This-One leg); (e) the Stage-3 bundle `330427dc` buyer legs (buyer `d84bcc68…` is not a QA persona); (f) iOS was **not driven** this round — every verdict above is **Android-only** (per R80: no iOS closure is claimed or implied).
**What Needs To Be Fixed Next:** (1) **Investigate the bundle Confirm-All prompt's state dependence** — reproduce with 3 in-progress siblings (prompt shows) then complete one and re-enter (prompt absent); decide whether the shortcut should be offered for the remainder, and if yes add `confirm-all-trades-button` to the partially-completed branch (L02's second leg is otherwise untestable). (2) **Record the `charge_one_fee_per_bundle` migration** in `schema_migrations` (or delete the unrecorded file) so the migration ledger matches reality — the data state is already correct, so do **not** re-run the UPDATE blindly. (3) Optional/copy-decision: finish the "Platform Fee" → "Safety & Platform Fee" rename on Trade Timeline / TradeDetail / SellerEarnings (currently the documented `DEFERRED-DECISION`) — one string × 3 screens + 8 guide lines. (4) Refresh the stale TRD tracker baseline note (236/27 → 238/25). (5) Add the verified `trades`/`items` column sets to the QA schema cheat-sheet (the 3 schema surprises this round).
**UX Enhancement Ideas (optional, not defects):** On the **bundle Trade Timeline**, the pinned "I Got It — Complete Trade" CTA renders directly over the "What to do next" card's own "Got it" step-3 button (both green, ~130 px apart) — consider hiding the in-card step-3 CTA while the pinned footer CTA is active, to remove the double-primary-stacked look. On the **pending-offer Trade Timeline**, the "Payment Details" block shows `Payment authorized: $40.00` while the order is only *pending* — consider wording it "Payment authorized (held until the seller accepts)" to avoid reading as money already taken.
**Suggested Next Session:** Run **Phase 2b Tier-1 money/tax math** as a dedicated batch with its own fixture session — start with **Group O (offer creation) + Group P (tax/fee math)** using a fresh SP-carrying bundle (this also closes **T08–T11**), then the R-group remainder (R02–R05) on the now-completed bundle `73d5eb11-…` (2 completed trades are ideal for refund/cancellation-transition cases), leaving Phase 2c Round-3 groups (U/V/W/X/Y/N2) for a sampled Tier-2 pass.
**Suggested to Improve Agent Rules:** Add a **post-money-action read-back ordering rule**: after any money/state mutation, read the app's own EF/analytics line (Metro log) **or** allow one poll interval **before** the DB read-back — this round a correct cancellation read as `pending` because the SQL ran in the same parallel batch as the post-tap tree read (2 extra calls to disprove a false negative). Pairs with §5.3 (wait for meaningful values) and R24 (DB read-back must be the verdict) — it is the *timing* of the read-back, not its necessity, that needs stating.
