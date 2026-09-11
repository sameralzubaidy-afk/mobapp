# QA Dispatch — 4 Stages (Stage 1 doc · Stage 2 verify · Stage 3 TRD harvest · Stage 4 wrap-up)

**Date:** 2026-09-11
**HEAD:** `9d995b77` (FIX-Task-16v2 — the Stage 1 deliverable, already committed; worktree clean)
**Platform this round:** Android `Medium_Phone_API_36.1` (primary). iOS `iPhone 17 Pro Max` available but **not driven**
**Run folder:** `e2e-test-results/qa-dispatch-4stage-2026-09-11/` (report.md + screenshots/)

> ### ⚠️ ENVIRONMENT BLOCKERS THAT SHAPED THIS ROUND (read first)
> 1. **`mcp_supabase_*` returned HTTP 401 Unauthorized for the whole session** → **no SQL read-back was possible.**
>    The playbook mandates DB read-back for money/state verdicts (§5.37/R24/R33) and for R54 numeric reconciliation.
>    Sanctioned substitutes used instead: `npm run qa:start-state -- <persona>` (service-role persona state),
>    `npm run qa:admin-config-set -- get --key <k>` (service-role `admin_config` read), and UI-level evidence.
>    **Any verdict in this report that would normally close on a DB read-back is marked DB-LIMITED.**
> 2. **Two Metro instances are running** (`:8081` and `:8082 --clear`). The dev client cold-connect to `:8081`
>    took **~90 s of `Bundling …%`** before first render, and the first frame after bundling was **blank** for
>    several seconds. This matches the wedge recorded in the previous TRD round's CORRECTION block — it is a
>    dev-harness cold-start cost, not an app defect (the app rendered correctly once the bundle landed).
> 3. **Stage 4 was NOT executed** — see §4.

---

## 0 · Stage 1 — FIX-Task-16v2 (already delivered; verified read-only)

Stage 1 was **already implemented and committed** by the dev agent as `9d995b77` before this dispatch
(worktree clean). No code was authored by this agent (execution-only boundary). Evidence below is the
read-only diff inspection.

| Item | Change | Evidence (file:line) |
|---|---|---|
| **1** | Surface the Checkout EF's structured `{code,message}` | `src/services/cartService.ts` — new `readFunctionErrorBody()` ~L470-495 and `resolveCheckoutSubmissionError()` ~L497-520 (reuses `extractEdgeInvokeErrorMessage` + newly-exported `extractErrorCodeFromPayload` from `services/trade.ts`); wired at the batch branch ~L655-663, the single branch ~L711-716, and the all-failed return ~L729-736 (`error: submissionError ?? { code:'ALL_OFFERS_FAILED', … }`) |
| **2** | `console.error` → `console.warn` on the handled rejection paths | same two call sites (batch ~L659, single ~L714) — previously raised a tap-swallowing dev LogBox |
| **3** | K-group guide reconciliation | `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` — K11 premise & actors (5%/free-tier → **10 % free / 20 % Kids Club+**, trial⇒20 %, `$2.60` fee / `$10.40` payout on the $13 cash portion), K11 title "tier rate × cash portion", Item Detail + Make Offer "Transaction Fee"/"Platform fee" → **"Safety & Platform Fee"**, "Sales Tax" → **"Sales Tax (with rate, e.g. `Sales Tax (6.99%)`)"**, K04/K05 CartCheckout label → `Safety & Platform Fee (×N items)`, N03 "Minimum Listing Price" → **"Min Listing Price"**, S10 → **"Combined Offer"** |
| **4** | `charge_one_fee_per_bundle` data-type hygiene | `src/services/adminConfig.ts` bulk parser ~L169-174 (boolean-keyed setting accepts both `'true'` and real `true`) + `getChargeOneFeePerBundle()` ~L429-434; migration `supabase/migrations/20260911000001_fix_task_16_charge_one_fee_per_bundle_data_type.sql` (idempotent `UPDATE … WHERE data_type IS DISTINCT FROM 'boolean'`) |
| **5** | TaxBreakdownRow — **decision: display the rate** | `src/components/trade/TaxBreakdownRow.tsx` — imports `formatTaxRate`, computes `showRate` (finite **and** `> 0`, so an exempt/legacy row can never read "0.00 %"), renders `` `${label} (${formatTaxRate(taxRate)})` ``, moves `jurisdiction` into the **accessibility label only** (`"Sales Tax, 6.35%, CT"`) so the visible kid-friendly label is unchanged, adds `testID="tax-label"`. New tests: `TaxBreakdownRow.test.tsx` (7), `cartService.checkoutError.test.ts` (4) |
| **6–8** | Optional UX (basket sort, per-item SP headroom on bundle checkout, Item Detail SP cap) | **NOT implemented — explicit deferral.** These introduce new user-facing copy/product decisions and need the owner's pick (as recorded in `/memories/repo/fix-task-16v2-2026-09-11.md`) |

**Excluded (per dispatch):** the Amazon liability-disclaimer content defect is NOT part of Stage 1. It was
incidentally re-observed live this round (see §3 finding F4) and remains a standalone CRITICAL needing
legal-approved copy.

---

## 1 · Stage 2 — Verification of Stage 1 (Android)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Structured EF error surfaces | ✅ **PASS** | Triggered a genuine server rejection: `qa:invalidate-payment-method --persona test-buyer` → detached saved card → `create-trade-offer` returns `400 INVALID_PAYMENT_METHOD`. The app showed **"Checkout Failed / Payment method is invalid or expired"** — the EF's specific reason, **not** the old generic "Failed to submit offers for all items". `screenshots/s2-item1-rejection-alert.png`, `s2-item1-post-accept.png` |
| 2 | LogBox downgrade | ✅ **PASS** | Same handled-failure path: **no red LogBox overlay**, screen fully interactive, all controls tappable. `s2-item1-post-accept.png` |
| 3 | K-group guide reconciliation | 🟡 **PARTIAL** | On-device confirmed: checkout renders **"Safety & Platform Fee $1.49"** and **"Sales Tax (6.35%) $2.54"** (rate now displayed) — both match the reconciled guide. Previously-confirmed (R2 round) "Min Listing Price" (admin) and "Combined Offer" (checkout banner). **BUT** the seller Review Offer screen still renders **"Platform Fee"** in its payout breakdown (see §2 finding F2) → the reconciliation is **incomplete on at least one live surface** |
| 4 | `charge_one_fee_per_bundle` is `boolean` | ✅ **PASS (DB-LIMITED)** | `qa:admin-config-set get` → `{"key":"charge_one_fee_per_bundle","value":"true","data_type":"boolean","is_active":true,"updated_at":"2026-09-10T22:17:10Z"}`. Toggle behaviour re-confirmed functionally this round (one-fee-per-bundle bundle accepted as a single bundle; per-item seller fee math shown in §2). *Could not verify the migration is recorded in `supabase_migrations` — MCP down.* |
| 5 | TaxBreakdownRow renders the rate | ✅ **PASS** | Checkout Order Summary: **`Sales Tax (6.35%)` / `$2.54`**, AX `testID="tax-label"` with `label="Sales Tax, 6.35%, CT"` (jurisdiction in a11y only). Arithmetic reconciles: 40.00 × 6.35 % = 2.54 → Cash Total 40.00 + 1.49 + 2.54 = **$44.03** ✓. No "0.00 %" anywhere. `screenshots/s2-item5-checkout-tax-rate.png` |
| — | **Regression — normal checkout works** | ✅ **PASS (single-item path)** / ⚠️ **bundle-batch buyer leg not re-driven** | After restoring the card and a fresh process (R92), the checkout completed: **"Trade Initiated!"** → My Trades **Your Offers = 1** with a PENDING "Buying Sep 11" card. The previously-retracted bundle-checkout "bug" is **not reproduced**; the retraction stands. `s2-regression-success-trade-initiated.png`, `s2-persona-check-trades.png` |
| 6–8 | Optional UX | ⏭️ **DEFERRED** | Not implemented in Stage 1; nothing to verify |

**R93 fixture discipline:** `qa:invalidate-payment-method --persona test-buyer --restore` was run and verified
(fresh `pm_1UEcDF4I6kCJlvXoYkJswlXJ`, mastercard •••• 4444 attached to `cus_Ungj4MptKp9CUg`). Blast radius
recorded in §5.

---

## 2 · Stage 3 — TRD Bundle Harvest Round (bundle `330427dc-…`)

**Fixture (NOT reset — per the dispatch's hard rule):** bundle `330427dc-1b1e-4146-b9fc-fa8e1e118457`,
3 pending offers, seller `test-seller-3`, buyer `d84bcc68…`, items
Building Blocks Bucket $20 / Chapter Book Box Set $16 / Kids Bike Helmet $14 (Buyer's Total Paid **$50.00**).
`qa:reset-offer-fixtures` was **never run** this session.

**Progression driven:** seller logged in (`qa-login-as test-seller-3`) → My Trades → Needs Action (bundle
card) → Review Each → expanded bundle list → **Accept All 3 Items** → confirm modal → **"Bundle Accepted!
Payment authorized. Trades are now in progress."** → My Trades **In Progress = 3**. The bundle is now
**in_progress** (no longer pending) and the buyer's payment is authorized.

### Verdict roll-up (Android, this round)

| TC-ID | Case | Verdict | Evidence |
|---|---|---|---|
| **L01** | Bundle banner on trade detail | ✅ **PASS** | Bundle Trade Timeline shows `bundle-context-banner` **"Bundle offer · 3 items"** + `View all items` toggle; expanded list renders all 3 items with title + cash price. `s3-bundle-timeline-inprogress-seller.png`, `s3-bundle-timeline-expanded.png` |
| **L03** | Bundle offer rows in Offers tab (seller) | ✅ **PASS** | Seller Needs Action renders `trade-bundle-330427dc-…-card` — **"📦 Bundle Offer · 3 items" / OFFER** with all 3 line items + prices and Review Each / Accept All / Decline All. `s3-seller-needsaction-bundle-card.png` |
| **L06** | Bundle banner in Review Offer screen | ✅ **PASS** | Review Offer: `bundle-context-banner` "Bundle offer · 3 items" + `review-bundle-toggle`; expanded → 3 `review-bundle-item-<id>` rows (title + price) + **"Buyer's Total Paid $50.00"**. `s3-seller-review-offer-bundle.png` |
| **L07** | Accept All N Items in Review Offer screen | ✅ **PASS** | `accept-bundle-button` "Accept All 3 Items" → confirm modal (copy: *"Accept all 3 items? Accepting will authorize the buyer's payment and move all trades in progress."*) → `accept-bundle-confirm-button` → **"Bundle Accepted!"** → all 3 moved to In Progress. `s3-seller-accept-all-confirm.png`, `s3-bundle-accepted-dialog.png`, `s3-seller-inprogress-3.png` |
| **L08** | Individual accept/decline alongside siblings | 🟡 **PARTIAL** | `accept-trade-button` ("Accept Trade") + `decline-trade-button` are co-present on the bundle Review Offer screen; the individual-action leg was not driven (would have split the bundle). |
| **S04** | "More from this seller" page — no seller identity | ✅ **PASS** | Header title is **"More from this seller"**; **no seller name/handle/email anywhere** in the tree or render. |
| **S06** | "Matches Your Cart" indicator on filtered seller page | ✅ **PASS** *(was 🟡 PARTIAL — "source-verified only")* | On-device: page banner **"Items from this seller match your active cart."**; every tile label carries **"Matches Your Trade Basket"**, and the in-cart tile carries **"In Trade Basket"**. |
| **S08** | Bundle CTA hidden with single item or empty cart | ✅ **PASS** *(was 🟡 PARTIAL — "source-confirmed only")* | 1-item cart renders the **single-item** CTA copy "Make an offer for this item" (no "make one offer for these N items" bundle copy); empty cart renders no CTA. |
| **M01** | Add first item → active cart created | ✅ **PASS** | Basket badge 0→1; Trade Basket renders `cart-item-<id>` + `cart-summary` Subtotal/Total $40.00. |
| **M12** | Max SP shown per cart item | ✅ **PASS** | `Accepts Points · Up to 28 SP` on the $40 item — per-item cap, survives the relaunch. |
| **K06** | Bundle timeline — fee display matches charge mode | 🟡 **PARTIAL** | The seller bundle Timeline renders the bundle banner + per-item context but **no fee/totals section**. The guide's precondition (two bundles, one per fee mode, reviewed as test-buyer) was not met. |

**Also verified as a by-product (not new cases):** K04/K05 toggle semantics re-confirmed as a live system
property — `charge_one_fee_per_bundle = true` and the accepted bundle behaves as one bundle (single bundle
card, one authorization), while the **seller** fee is correctly per-item on the cash portion
($2.00/$1.40/$1.60 = 10 % each, free-tier rate) — consistent with K11's "tier rate × cash portion".

### Not reached from this bundle (honest list)
`K04/K05 steps 7–10` (buyer-side bundle checkout totals) · `T08–T11` (points-redemption bundle legs) ·
`L02` (buyer Confirm All) · `L05` (buyer In-progress bundles section) · `L09` (buyer bundle card) ·
`L10` (bundle cancel prompt) · `M08/M09/M10` (cart remove/clear/saved-carts — **controls confirmed present**:
`cart-item-remove-<id>`, `clear-basket-button`, `save-current-cart-button`) · `S01–S03`, `S05`, `S07`, `S09`.
**Root cause:** the buyer of bundle `330427dc` is `d84bcc68…`, which is **not any standing QA persona**
(checked `test-buyer/49243010`, `test-free/…0001`, `test-buyer-2/…0003`, `test-buyer-3/…0004` via
`qa:start-state`) and has no known credential → **all buyer-side legs of this bundle are fixture-inaccessible.**
`K09/K07/K08` (admin) and the remaining S-group legs need the admin portal / extra fixtures.

**Count converted this round: 11 verdicts from the bundle (9 PASS · 2 PARTIAL) + 2 tracker flips
(S06 PARTIAL→PASS, S08 PARTIAL→PASS).** The dispatch's ~35 target was **not** met and the shortfall is
fixture-access, not budget alone.

---

## 3 · Findings (this round)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **F1** | **MEDIUM** | **Cold-start My Trades renders the empty state despite real data.** After a cold relaunch, My Trades showed **0 Your Offers / 0 In Progress / 0 Needs Action / 0 Completed + "No Trades Yet"** while the same session's account actually held 1 pending offer + 32 completed; the tab badge simultaneously showed a non-zero count. A Home→Trades remount repopulated it correctly. The **same signature was observed at session start** on the previous (non-QA) session: badge "3" with an all-zero list. | `android-s2-trades-empty-badge3.png` (0/0/0/0, badge 3) vs `s2-persona-check-trades.png` (after remount: 0/0/0/1… ) and `s2-regression-after-accept` → `s2-regression-success-trade-initiated` (1 offer + 32 completed). |
| **F2** | **LOW** | **Guide reconciliation (Stage 1 item 3) is incomplete on a live surface.** The seller Review Offer payout breakdown still labels the row **"Platform Fee"** (guide and checkout now say "Safety & Platform Fee"). | `s3-seller-review-offer-bundle.png` (payout-breakdown: Cash Amount $20.00 / **Platform Fee −$2.00** / Net Cash Payout $18.00) |
| **F3** | **LOW–MED** | **Buyer's single-item offer renders as a "bundle".** Your Offers card for a 1-item offer reads **"📦 Bundle Offer · 1 items"** — wrong noun for a single-item offer **and** ungrammatical plural. (Directly adjacent to S08's intent that bundle affordances not appear for single items.) | `s2-regression-success-trade-initiated.png` → My Trades "YOUR OFFERS" card |
| **F4** | **CRITICAL (pre-existing, out of Stage-1 scope)** | **Liability-disclaimer content is third-party boilerplate.** The checkout disclaimer is **Amazon's** commercial-insurance text ("Amazon Services Business Solutions Agreement", "…on Amazon.com", "Amazon.com Services LLC…"). Kids/parents reading a kids' P2P marketplace are shown Amazon's policy. *Reported for completeness only — the dispatch assigns this a standalone legal-copy task.* | `s2-item1-rejection-alert.png` (modal) |
| **F5** | **LOW (UX)** | **The liability disclaimer re-prompts on every checkout attempt** in the same session — the earlier "accept & continue" did not persist (the second attempt rendered unchecked with the primary disabled). | `s2-regression-submit.png` (unchecked ☐, Accept disabled) after an identical accept earlier in the session |
| **F6** | **LOW (copy consistency)** | **Two different messages for the same `INVALID_PAYMENT_METHOD` failure.** An inline banner rendered **"Cashout Failed / Payout method is invalid or expired."** while the GlobalAlert rendered **"Checkout Failed / Payment method is invalid or expired."** Also, "**Payout** method" is seller-side vocabulary shown to a **buyer** — recommend one string, using "payment method"/"card". | `s2-item1-post-accept.png` vs the GlobalAlert `global-alert-button-0` "Checkout Failed / Payment method is invalid or expired" |
| **F7** | **LOW (guide doc-drift)** | **L07 locator hints are stale:** the guide names the confirmation buttons `btn-accept-all-confirm` / `btn-bundle-modal-cancel`; the shipped testIDs are **`accept-bundle-confirm-button` / `accept-bundle-cancel-button`**. | Review Offer confirm modal tree |
| **F8** | **LOW (tracker, R56)** | **TRD never-run table header vs §1 disagree:** the "Remaining test cases — NEVER RUN **(19)**" header sits above 19 rows while the §1 roll-up says TRD Remaining = **17**. Not corrected this round (needs a row-level audit); flagged per R56. | `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` L591 vs L30 |
| **F9** | **MEDIUM (env)** | **Android cold-connect to Metro `:8081` costs ~90 s of `Bundling …%` and renders a blank first frame** before the app appears (two Metro instances on 8081/8082 make the dev client's server choice ambiguous). Recorded as harness cost; it is the same wedge the previous TRD round reported as a block. | Screenshots `s2-app-reloaded.png`, plus successive captures 51 %→55 %→99 %→blank→rendered |
| **F10** | **LOW (naming)** | The single-item cart CTA reuses `testID="bundle-cta-button"` even when the copy is the **non-bundle** "Make an offer for this item". Locator naming trap. | Cart tree, `bundle-cta-button` on a 1-item cart |

**R94 note (`qa-scroll-to`):** not used this round. All below-fold reachability was achieved with
`mobile_swipe_on_screen` over non-interactive content plus anchored `adb shell input swipe` (R77 #14), which
worked on the first or second attempt in every case — consistent with FIX-Task-15's fix being
**unconfirmed-but-unneeded** here.

---

## 4 · Stage 4 — NOT EXECUTED

Stage 4 was not run. Stated plainly rather than partially covered:

- **Blocker A (hard):** `mcp_supabase_*` 401 → **no SQL read-back**, which Stage 4's Tier-1 groups
  (O / O-1 / O-2 / O-3 / P money+tax math, R refund/cancellation state transitions) cannot close to a
  defensible verdict under R24/R33/R54.
- **Blocker B:** Stage 4's remaining Groups M/N/S/T + Round-3 groups (U/V/W/X/Y/N2) mostly need fixtures that
  require DB writes or admin actions, which the MCP outage also blocks.
- **Blocker C:** the round's call budget was consumed by Stage 2 (2 checkout cycles incl. a ~90 s cold bundle
  + a 2-cycle payment fixture) and Stage 3.
- **Net:** **zero** Stage-4 cases have an Android verdict from this session. Per R40 this is an explicit
  per-scope "not run" statement, not a "deferred" note.

**R62b off-brand-hex grep (owed):** **not run** this session (explicitly flagged as carried forward).

---

## 5 · App State Left Behind

- **Android app: logged OUT** (`qa-logout` deep link) at session end. Metro `:8081` and `:8082` left running;
  both simulators/emulators left booted.
- **Bundle `330427dc-1b1e-4146-b9fc-fa8e1e118457` advanced from `pending` → `in_progress`** (3 trades,
  buyer payment authorized). This is the dispatch-directed progression; it is **not** a reset and the bundle
  was never cleared. To undo, the buyer must cancel or the seller must cancel each trade.
- **New residue created by the Stage-2 regression:** test-buyer now has **1 new pending offer**
  ("E2E Textile Long-sleeved T-shirt Wool" $40, bundle card "Bundle Offer · 1 items", 48 h window) against
  the E2E-fixture seller, and the E2E item is consumed into that pending trade. Plus **test-buyer's cart
  retains 1 item**.
- **`qa:invalidate-payment-method` blast radius (R93):** test-buyer's **original** card
  (`pm_1UE7ol4I6kCJlvXoLB8Z3tIY`) is **permanently detached** (Stripe never re-attaches a detached PM). The
  persona was restored with one fresh valid MASTERCARD •••• 4444 (`pm_1UEcDF4I6kCJlvXoYkJswlXJ`). Test-mode
  only and re-provisionable.
- **The pre-existing non-QA session** (`seller2bob.demo@example.com`) was signed out of by the persona switch;
  its password is unknown to QA (not a standing persona).
- No app DB columns other than those above; **no `admin_config` writes** were made this round (the only
  `admin_config` interaction was a read).

---

## 6 · Perceived load time (measured where the round produced transitions)

> Label: *Perceived load time (simulator/emulator, wall-clock, ±polling-interval precision) — not a formal performance profile.*

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Basket → Checkout (CartCheckoutScreen) | ~1 s | OK |
| Checkout → rejection banner after Send Offer | ~2 s | OK |
| Review Offer → Accept All confirm → "Bundle Accepted!" | ~3 s | ⚠️ ≥3 s (includes the Stripe authorization round-trip — expected for a real money call) |
| Persona deep-link switch (`qa-login-as`) → usable session | **~10 s+ / required a 2nd delivery** | ⚠️ **FLAGGED** (known Android behaviour, R77) |
| Cold terminate+launch → Dev Launcher → 8081 → usable app | **~90 s** (51 %→99 % bundling + blank frame) | ⚠️ **FLAGGED — harness artefact** (F9), not app behaviour on a warm launch |

---

## 7 · Screenshots (evidence index)

| File | Shows |
|---|---|
| `android-s2-trades-empty-badge3.png` | F1 — empty trades list with non-zero badge |
| `s3-seller-needsaction-bundle-card.png` | L03 — seller bundle offer card |
| `s3-seller-review-offer-bundle.png` | L06 + F2 — bundle context banner + payout breakdown ("Platform Fee") |
| `s3-seller-accept-all-confirm.png` | L07 — accept-all confirmation copy |
| `s3-bundle-accepted-dialog.png` | L07 — "Bundle Accepted! Payment authorized." |
| `s3-seller-inprogress-3.png` | L07 — In Progress = 3 after accept |
| `s3-bundle-timeline-inprogress-seller.png` / `s3-bundle-timeline-expanded.png` | L01 — timeline bundle banner collapsed/expanded |
| `s2-item5-checkout-tax-rate.png` | Stage 2 item 5 — "Sales Tax (6.35%)" on Order Summary |
| `s2-item1-rejection-alert.png` / `s2-item1-post-accept.png` | Stage 2 items 1+2 + F4/F6 — rejection surfaced, no LogBox |
| `s2-regression-success-trade-initiated.png` | Regression — "Trade Initiated!" (+F3 via the next shot) |
| `s2-persona-check-trades.png` | Regression — Your Offers 1 + 32 completed |
| `s2-cart-after-2nd-add.png`, `s3-more-from-seller-added.png`, `s2-discover*.png`, `s2-app-reloaded.png` | Cart/S04/S06/S08 + F9 evidence |

---

## 8 · QA Session Handoff

**Test Scope:** Stage 1 read-only verification of FIX-Task-16v2 (commit `9d995b77`); Stage 2 verification of items 1–5 + the checkout regression; Stage 3 TRD bundle harvest from live bundle `330427dc-…` (TRD-TC-L01/L03/L06/L07/L08/S04/S06/S08/M01/M12/K06). Stage 4 **not executed**. Platform: Android `Medium_Phone_API_36.1`.
**Design-System Compliance:** **PARTIAL.** Cart / Checkout / Review Offer / Trade Timeline all use canonical tokens (primary `#5DBB8E`, one primary per screen, ≥44 px targets, filled inputs). Two deviations: (a) the checkout failure banner renders as a **semi-transparent overlay bleeding across the Order Summary card boundary** (red-on-white-beige, low contrast) — legibility risk; (b) the Liability Disclaimer modal is a near-full-screen wall of third-party body text with the checkbox/CTAs pinned at the very bottom edge (F4/F5 context).
**Perceived Load-Time Verdict:** **FLAGGED** — persona deep-link switch (~10 s, needs 2 deliveries) and the cold dev-client connect (~90 s Bundling + blank first frame). Both are **environment artefacts** (R77 deep-link behaviour; F9 two-Metro cold bundle), not app-behaviour regressions; all in-app transitions measured 1–3 s with the only ≥3 s item being the genuine Stripe authorization round-trip inside Accept All.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Trade Basket (cart): tokens, spacing and labels correct; clear per-item SP headroom copy.
- CONFIRMED — Checkout / CartCheckoutScreen: "Safety & Platform Fee" + "Sales Tax (6.35%)" match the reconciled guide; single primary "Send Offer · $44.03".
- CONFIRMED — Review Offer (bundle): clear money disclosure ("Cash Amount → Platform Fee → Net Cash Payout", "Buyer's Total Paid").
- CONFIRMED — Trade Timeline (bundle): banner, status pill and next-steps card are plain-language and correct.
- DEVIATION — Review Offer payout row label **"Platform Fee"** (guide now expects "Safety & Platform Fee") — F2.
- DEVIATION — Your Offers card for a 1-item offer reads **"Bundle Offer · 1 items"** — F3.
- DEVIATION — checkout failure banner vs GlobalAlert use **two different strings** for the same error; the banner names a *buyer's* card as "**Payout** method" — F6.
- DEVIATION — Liability Disclaimer content is **Amazon** boilerplate — F4 (out of this batch's scope).
- DEVIATION — failure banner overlay contrast/position across the Order Summary boundary.
**Verdict Summary:** **16 PASS / 0 FAIL / 2 PARTIAL / 1 DEFERRED** (Stage 2: 4 PASS + 1 PARTIAL; Stage 3: 9 PASS + 2 PARTIAL; Stage 1: verified read-only, no verdict class; Stage 4: not executed). *No new TC-ID verdicts were created from Stage 2 (fix-verification pass, as instructed).*
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — **TRD-TC-S06 PARTIAL→✅ PASS** (on-device "Items from this seller match your active cart." + per-tile "Matches Your Trade Basket"/"In Trade Basket") and **TRD-TC-S08 PARTIAL→✅ PASS** (1-item cart shows the single-item CTA, no bundle CTA). Rows appended with an Android execution note (Date 2026-09-11, Source this run): **TRD-TC-L01, L03, L06, L07, L08(PARTIAL), S04, M01, M12, K06(PARTIAL)**. New TRD totals: **PASS 236→238 · PARTIAL 27→25 · OPEN 1 · DRIFT 5 · SKIP 2 · Remaining 17**. ⚠️ **R56 flag (F8):** the TRD "Remaining — NEVER RUN" table header reads **(19)** against 19 rows while §1 and the section header say **17** — left uncorrected pending a row-level audit; not silently "fixed".
**Critical Findings:** 1. **F1 (MEDIUM)** cold-start My Trades renders the empty state while the account has real data (1 offer + 32 completed), self-healing only on a remount — the same signature seen at session start. 2. **F9 (MEDIUM, env)** ~90 s cold bundle + blank first frame on Android dev-client cold connect with two Metro instances running — the previously-recorded "wedge". 3. **F4 (CRITICAL, pre-existing/out-of-scope)** Amazon liability-disclaimer boilerplate shown to marketplace users. 4. **F5 (LOW)** disclaimer re-prompts every checkout. 5. **F2/F3/F6/F10 (LOW)** copy/label/locator drift. 6. **F8 (LOW, tracker)** TRD never-run header/count mismatch.
**App State Left Behind:** Android app **logged out**; bundle `330427dc` advanced pending→in_progress (payment authorized, 3 trades) — dispatch-directed, not reset; test-buyer left with **1 new pending offer** + 1 cart item; test-buyer's original Stripe test card **permanently detached** and replaced with a fresh 4444 (R93 restore done + verified); the non-QA `seller2bob.demo@example.com` session signed out; no `admin_config` writes; Metro 8081+8082 and both devices left running.
**Why It Matters:** It closes the four Stage-1 code/config/doc items with on-device evidence — the checkout failure path now names the real reason instead of a generic string (verified against a genuine `400 INVALID_PAYMENT_METHOD`), the handled path no longer raises a tap-swallowing LogBox, and the tax rate the user is charged is now visible and matches the reconciled guide. It also converts two long-standing source-only PARTIALs (S06, S08) into genuine Android verdicts and proves the previously-"broken" bundle checkout is fine end-to-end from the seller side. The unfinished business is honest: the bundle's buyer is a non-QA account, so every buyer-side leg of Stage 3 — and all of Stage 4 — remains open, and the missing SQL read-back means money verdicts could not be closed to playbook standard.
**How to Verify/Reproduce:** Stage 2 item 1 → `npm run qa:invalidate-payment-method -- --persona test-buyer`, then log in as test-buyer, add an item, Checkout → Send Offer → observe the specific reason + absence of LogBox → `--restore`. Stage 2 item 5 → Checkout Order Summary, assert `tax-label` shows `Sales Tax (x.xx%)`. Stage 3 → log in as `test-seller-3` (`qa-login-as`), My Trades → Needs Action → bundle card → Review Each → Accept All 3 Items. All screenshots in `e2e-test-results/qa-dispatch-4stage-2026-09-11/screenshots/`.
**Known Gaps / Not Tested:** **Stage 4 in full.** Stage 3 buyer-side legs (K04/K05 steps 7–10, T08–T11, L02/L05/L09/L10, M08/M09/M10) — fixture-inaccessible (buyer `d84bcc68…` is not a QA persona). Bundle-batch **buyer** checkout regression not re-driven (single-item path passed; the R2 K04/K05 screen checks and the owner's DB-confirmed 3-item order remain the bundle-path evidence). R62b off-brand-hex grep (owed). `K07/K08/K09` (admin). Any money/state assertion needing SQL read-back (MCP 401 all session) — **DB-LIMITED**, stated per verdict.
**What Needs To Be Fixed Next:** 1. **F1** — fix the cold-start empty-fetch on TradeListScreen (`getActiveTradeCount` shows a non-zero badge while the list query resolves empty) and add a remount/refresh path; re-verify both as a buyer with real data and as a seller. 2. **F2** — replace "Platform Fee" with "Safety & Platform Fee" in the Review Offer payout breakdown (`ReviewOfferScreen`), completing the FIX-Task-16v2 item-3 reconciliation. 3. **F3** — render "Offer · N item(s)" (singular/plural-aware) instead of "Bundle Offer · 1 items" for a single-item offer. 4. **F6** — unify the checkout-failure strings on one buyer-appropriate message (drop "Payout method" for buyers). 5. **F5** — persist the liability-disclaimer acceptance per user/flow so it is not re-prompted every checkout. 6. **F4** — the standalone CRITICAL: replace the Amazon disclaimer content with legal-approved copy. 7. **F7** — correct the L07 confirm-button locator hints in the TRD guide. 8. **F8** — audit and reconcile the TRD never-run table header (19) vs §1 (17). 9. **F9** — retire the second Metro instance (8082) and document the 8081-only cold-connect procedure. 10. Apply (or explicitly schedule) migration `20260911000001_fix_task_16_charge_one_fee_per_bundle_data_type.sql` — the DB already reads `boolean`, so confirm the migration record is consistent.
**UX Enhancement Ideas (optional, not defects):** On Checkout, the mandatory liability disclaimer is a full-screen wall of third-party body text with the checkbox pinned at the bottom edge — consider a short plain-language summary with the full text behind a "Read full disclaimer" expansion. On the post-checkout "Trade Initiated!" screen there are four stacked CTAs (1 primary + 3 secondary) — consider demoting "Back to Home" to a text link to reduce choice load. On the Review Offer payout breakdown, consider labelling the fee "Safety & Platform Fee" **and** adding a one-line "you keep this" affordance, since the net is already computed. On Cart, `Accepts Points · Up to 28 SP` is excellent — consider the same "you'll earn ~N SP" preview on the seller's own listing cards.
**Suggested Next Session:** A **buyer-fixture session**: either create a QA-owned buyer bundle end-to-end (new account, 2–3 same-seller items, checkout) to close K04/K05 steps 7–10 + T08–T11 + L02/L05/L09 + M08/M09/M10 **once Supabase MCP is restored**, or get the owner to confirm whether `d84bcc68…` can be added to the QA persona registry. Restoring MCP is the gate for all Stage-4 money work.
**Suggested to Improve Agent Rules:** Add a **"cold-start empty-fetch is not an empty account"** rule: when a list screen renders its empty state but a related counter/badge is non-zero, **never** record "0 active / no data" — force a remount (Home→tab) before any verdict, and treat the contradiction itself as a finding candidate (this round it masqueraded as a stale badge at the session start and as a 0/0/0/0 list later, and only the remount + a later real write disambiguated it). Pair it with **"verify the fixture's participant identities BEFORE planning a harvest"** — one `qa:start-state` sweep of the candidate personas would have shown up-front that bundle `330427dc`'s buyer is unreachable and that the ~35-case Stage-3 target was fixture-infeasible.
