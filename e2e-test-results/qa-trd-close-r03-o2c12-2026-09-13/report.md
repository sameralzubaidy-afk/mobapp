# QA Round — TRD Closing: R03 Approve-and-Drive + O2-C12 Void-vs-Refund Determination

**Run folder:** `e2e-test-results/qa-trd-close-r03-o2c12-2026-09-13/`
**Date:** 2026-09-13 · **Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
**Platform driven:** Android emulator `Medium_Phone_API_36.1` (`emulator-5554`, 1080×2400)
**iOS:** iPhone 17 Pro Max (iOS 26.1) **booted but NOT driven this round — R80 disclosure.** Every mobile verdict below is Android-only; no iOS verdict is claimed or implied.
**Admin portal:** reached but **not usable** (see §7 Friction) — no admin-dependent case was in scope this round.
**Scope:** `TRD-TC-R03` (both limbs) + `TRD-TC-O2-C12` (code-side determination).
**Status flips:** **none** (both rows remain 🟡 PARTIAL, each now carrying a *precise, driven* reason instead of an undriven/undecided one).

---

## 1 · What was asked, and the short answer

| Ask | Outcome |
|---|---|
| **R03** — use the owner-approved write, drive it end-to-end, confirm the fixture is reversible | **Driven end-to-end. Core = PASS; R03 stays 🟡 PARTIAL.** The competing-offers limb works exactly as specified (exact reason literal + SP restored), **but two side-effect defects were found on that path** (F1/F2). Fixture fully reset and verified. |
| **O2-C12** — decide which side of the fence the implementation is on, then either verify or file a dev fix | **It is NOT already-voiding ⇒ DEV FIX REQUIRED.** `supabase/functions/trade-refund/index.ts` voids the uncaptured **Stripe** hold correctly (so it is *not* capture-then-refund), **but its ledger leg books the uncaptured amount as a REFUND instead of a VOID** and mis-stamps the tax row. Not driven as a QA pass, per the owner's instruction. Exact file/function named in §4. |
| **Agent rule upgrades** applied this session | **Applied.** Measured effect in §5 — most notably **zero coordinate misses** and **zero dev-client crashes** (vs 28 and 52 calls lost to those two classes in the immediately preceding round). |
| Declare TRD fully final | **NOT final.** No status flipped; TRD remains **295 PASS / 3 PARTIAL / 0 OPEN / 13 DOC-DRIFT / 6 SKIPPED / 16 Remaining = 333 ✓**. R03 and O2-C12 now each have a named, actionable residual; the third (`O3-C06` layer 3) is unchanged. |

---

## 2 · TRD-TC-R03 · Offer expiry → auto-cancel + competing offers cancelled

**Guide assertion (verbatim, two bullets):**
1. *"The expired offer auto-cancels (reason `'Offer expired'`); the buyer's hold and SP are restored."*
2. *"When one competing offer is accepted, the remaining competing offers are cancelled (reason `offer_expired_competing`) and those buyers' holds/SP are restored."*

### 2.1 Fixing the TC-ID collision first (Step-0 reconciliation — caught real drift)

The guide contains **two different bodies both numbered `TRD-TC-R03`**:

| Location | Title |
|---|---|
| Index (guide L235) + body (guide L5100) | *Offer expiry → auto-cancel + competing offers cancelled* ← **the tracked row, and the one this task means** |
| Guide L7005 (a second, later `R` block) | *Single (non-bundle) completion has no Confirm All* |

Reconciled before executing (Step-0 rule): a future agent reading the guide's body at L7005 would drive the **wrong case**. Reported as a documentation finding (§3 F4), not queried further.

### 2.2 Fixture built for the competing-offers limb

Chosen from a **read-only DB precondition pass** (Phase 23) — this is what made the round cheap: the listing was selected as the only `test-seller-2` listing with **zero active offers**, avoiding two `DUPLICATE_OFFER` iterations.

| Element | Value |
|---|---|
| Listing | **Science Kit** `0fe228ee-6430-40fa-bcb4-ae07fc252f27`, **$20.00**, `accepts_swap_points=true`, seller **test-seller-2** |
| **Loser** (rival) offer | `67ba29fc-cf01-4713-8e8b-21e3fc460701` — buyer **test-buyer**, **sp_amount 5**, cash 1500 |
| **Winner** (accepted) offer | `11cd34e0-d890-42f9-ac2f-4d70c28f1a57` — buyer **test-buyer-2**, cash-only 2000 |

Both offers were created with the sanctioned `qa:ef-repro` harness (used for *fixture construction* only, never for the case's own action — the accept was driven on-device).

**Pre-state baseline (SP wallet + both trades + tax/payment ledgers), captured before driving:**

| Object | Pre-state |
|---|---|
| `test-buyer` wallet | `available_balance 453`, `reserved_sp 5`, ledger tail = `spend_purchase −5` |
| Loser trade | `pending`, `sp_amount 5`, `sp_reserved_at` set, `tax_status quoted`, `payments.derived_state requires_capture` |
| Winner trade | `pending`, `sp_amount 0`, `tax_status quoted`, `payments.derived_state requires_capture` |

### 2.3 On-device execution (Android, adb + OCR coordinates)

| Step | Action | Result |
|---|---|---|
| 1 | `qa-login-as?persona=test-seller-2` deep link | Delivered; screen was a **retained** Checkout from the prior session (R96/R59) |
| 2 | Trades tab → **Needs Action** | Header reads **"2 offers to review"** — both competing offers present |
| 3 | Queue OCR | Card 1: Science Kit **$20.00**; Card 2: Science Kit **$15.00** + **"Includes points redemption"** — the two offers are distinguishable on-device exactly as the fixture intends |
| 4 | `Review Offer` on the **$20.00** card | Review Offer screen: buyer offers $20.00, seller payout $18.00 |
| 5 | **Accept Trade** → confirm modal ("Are you sure you want to accept this offer? …") → **Accept** | Modal was **in-app and AX-visible**; driven as two discrete steps (R106) — modal-opening tap and modal target never batched |
| 6 | Post-accept | **"Offer Accepted! / Payment authorized. Trade is now in progress."** (`R03-07`) — note the platform's own vocabulary: *authorized*, not *paid* |

**Perceived load times:** accept → success modal **< 1 s**; persona-switch deep link → usable screen **< 2 s**. No transition ≥ 3 s → no §5.7 performance finding.

### 2.4 Side-effect verification — the authoritative verdict

| Assertion (guide bullet 2) | Observed | Verdict |
|---|---|---|
| Rival is cancelled | `status = 'cancelled'` | ✅ |
| …with the **exact** reason | `cancellation_reason = 'offer_expired_competing'` | ✅ |
| Rival buyer's **SP** restored | `available_balance 453 → 458`, `reserved_sp 5 → 0`, **exactly one** `sp_ledger` row `earn_refund +5`, description **"SP refunded because a competing offer was accepted"** | ✅ |
| Notifications | loser buyer `trade_cancelled` + `sp_refunded` ("✨ 5 SP Returned"); winner buyer `offer_accepted` | ✅ |
| Winner advances | `status = 'in_progress'`, `auto_complete_at` set (+72 h) | ✅ |
| Rival buyer's **hold** restored | **NOT released by this path** — see F2 | ❌ |

**Verdict: 🟡 PARTIAL retained.** Bullet 2's cancel + SP clauses are now genuinely driven and PASS; the **"holds restored"** clause is definitively **unmet** (F2), so this row cannot be flipped to PASS.

### 2.5 Expiry limb (bullet 1) — re-driven end-to-end with the owner-approved write

Per the guide's 2026-09-12 corrected recipe, the expiry path was driven via the **`process-expired-offers` Edge Function**, not the bare RPC.

| Element | Value |
|---|---|
| Offer | `67b14e93-346f-4eca-a54a-a5b8064c8bc3` — test-buyer, **sp 5**, cash 700, on "Soccer Ball & Goal Set" (test-seller) |
| Approved write | `offer_expires_at → now() + 3 s` (fast-clock) |
| Processor | `POST /functions/v1/process-expired-offers` → `expired_offers_processed: 1`, notifications sent 2 / failed 0 |

**Result — full PASS:**

| Assertion | Observed |
|---|---|
| Cancelled | `status = 'cancelled'` ✅ |
| Reason literal | **`'Offer expired'`** (friendly string, per the 2026-09-12 reconciliation) ✅ |
| Timestamp | **`cancelled_at` stamped** ✅ |
| SP restored | `sp_released_at` set; wallet 458 / `reserved_sp 0`; ledger `earn_refund +5` "SP refunded for expired offer" ✅ |
| **Tax voided, not refunded** | `tax_status = 'voided'`, `voided_at` set, **`refunded_tax_cents = 0`** ✅ |
| Payment mirror | `payments.derived_state = 'cancelled'` ✅ |
| Notifications | `offer_expired` (buyer, `item_still_available: true`) + `offer_expired_seller` (seller) ✅ |
| Hold released | the EF cancels the PI in its uncaptured branch (code path); **not independently provider-verifiable from the QA seat** (R13) |

> **Paired-contrast value:** the **same** business event class (an offer auto-cancelled) is handled by two different writers with **different completeness** — the expiry writer stamps `cancelled_at` *and* voids the tax; the competing-offer writer does neither. That contrast is the strongest evidence for F1/F2.

### 2.6 Fixture reversibility — CONFIRMED

| Reset action | Verification |
|---|---|
| Both fixture offers | both trades **terminal** (`fixture_trades_not_terminal = 0`) |
| Accepted trade freed via the app's own `cancel-trade` EF (seller actor) | `11cd34e0` → `cancelled`, `cancelled_at` stamped, **`tax_status='voided'`** |
| Listing restored | "Science Kit" `status = 'available'` ✅ |
| SP fully restored | `test-buyer` `458` / `reserved 0` ✅ |
| Cart/offer baseline | `npm run qa:reset-offer-fixtures` run at session start (2 stale offers cancelled, tax voided, listings reset) |

**Environment left as found**, with one deliberate exception: the **stuck `quoted` tax row on `67ba29fc`** (F2) was **left in place as the finding's live evidence** rather than repaired — repairing it would destroy the proof and mask the leak.

---

## 3 · Findings

### F1 · MED · Competing-offer cancellation never stamps `cancelled_at`

- **Writer (named per R100):** `supabase/functions/transactions-update/index.ts` — the accept branch's `TFV2-004: Auto-decline competing offers` update (~L240–252), and the identical block at `supabase/functions/transactions-accept-bundle/index.ts:149`. Both write `status`, `cancellation_reason`, `updated_at` — **never `cancelled_at`**.
- **The DB trigger that would have stamped it is DEAD:** `trigger_auto_decline_competing_offers` → `fn_auto_decline_competing_offers()` only fires when `NEW.status = 'payment_processing'` — a status the D-30 flow retired (trades now go `pending → in_progress`). Its body *does* set `cancelled_at = now()` and uses the reason `'Another offer accepted'`; the observed reason is the EF's `offer_expired_competing`, which proves the trigger never ran.
- **Reproduced:** `67ba29fc` → `cancelled_at IS NULL`.
- **Blast radius:** `cancelled_at IS NULL` on **60** cancelled trades — by reason: `seller_declined` 50 (legacy), `NULL` 7, **`offer_expired_competing` 2**, `dispute_resolved_refund` 1. So the class is broader than this one path, but this path reproduces it on every occurrence.
- **Impact:** anything keyed on `cancelled_at` (cancel-date display, and the tax-cancellation backfill queries in the O2-C12 guide body, which filter on `cancelled_at < '2026-07-23'`) silently misses these rows.
- **Fix:** add `cancelled_at: now.toISOString()` to both competing-offer updates (and sweep the 60 legacy rows).

### F2 · MED (arguably HIGH for the buyer) · The rival's uncaptured authorization hold is never released and its tax row is stranded at `quoted`

- **What is missing on the competing-offer path:** no `stripe.paymentIntents.cancel()` and no `rpc_void_tax_for_trade()` — unlike **every** other cancellation writer in the codebase:

| Path | File | Cancels the uncaptured PI | Voids the tax |
|---|---|---|---|
| Expiry | `process-expired-offers` | ✅ | ✅ (incl. `rpc_process_expired_offers`' own void) |
| Seller decline | `transactions-update` (decline) | ✅ | ✅ |
| Buyer/seller cancel | `cancel-trade` | ✅ | ✅ (verified again this round) |
| Admin force-cancel | `admin-trade-action` | ✅ (`cancelled_` discriminator) | ✅ |
| Dispute refund | `resolve-dispute` | ✅ (`cancelled_` discriminator) | ✅ |
| **Competing offer auto-decline** | **`transactions-update` (accept)** | **❌** | **❌** |

- **Consequences (both DB-verified):**
  1. `tax_records.tax_status` stays **`quoted`** on a `cancelled` trade. Live count: `cancelled_with_quoted_tax = 1` (this fixture). It does **not** self-heal: `check-authorization-expiry` filters `status = 'pending'` only, so a `cancelled` row is never revisited.
  2. The losing buyer's card keeps an **uncaptured authorization hold** for a trade the app told them was cancelled (the notification says only *"Trade Cancelled"*).
- **This leak is not hypothetical:** FIX-Task-24's backfill had to clear **52** cancelled trades with live `quoted` tax rows, and one of that set's reasons was exactly **`offer_expired_competing`** — i.e. the same path. That fix repaired the **data**; the **writer** was never changed, so it re-leaks on every occurrence (this round's row is the proof).
- **Not verifiable from the QA seat:** the actual Stripe PI status (`R13` — report as *not provider-checkable*). The claim rests on the code path plus the DB-observable tax/timestamp evidence.
- **Fix:** mirror the `cancelled_` prefix discriminator already used by `admin-trade-action`/`resolve-dispute` — in the competing-offer block, void the rival's tax (`rpc_void_tax_for_trade`) and cancel its PI.

### F3 · LOW · `tax_voided_count` under-reports on the expiry EF response

`process-expired-offers` returned **`tax_voided_count: 0`** while the tax record *was* voided (`voided_at` 00:57:44.772, i.e. **~44 ms before** `cancelled_at` 00:57:44.816). The EF voids the tax itself **before** calling the RPC, so the RPC's own count is correctly 0 — but that 0 is surfaced to the caller as if nothing had been voided. **Outcome is correct; the telemetry is misleading.** Cosmetic/reporting only.

### F4 · LOW (documentation) · Duplicate `TRD-TC-R03` ID inside one guide

Two distinct case bodies share the ID (guide L5100 *offer expiry / competing offers* vs L7005 *single completion has no Confirm All*). A future agent trusting the L7005 body would drive the wrong case entirely. Recommend renumbering one of them.

### F5 · LOW (UX/copy, §5.61 R58-class) · The losing buyer's cancellation copy hides the reason

The losing buyer receives `trade_cancelled` — *"The trade for "Science Kit" has been cancelled."* — with **no** indication that a competing offer won, while the `sp_ledger` row for the very same event *is* reason-aware ("SP refunded because a competing offer was accepted"). The reason-aware wording exists (DT-41) and simply isn't used on the user-facing surface. Concrete rewrite: *"Your offer for "Science Kit" wasn't accepted — another buyer's offer was accepted. Your 5 SP have been returned."*

---

## 4 · TRD-TC-O2-C12 · Determination: **needs a dev fix (not already-void)**

**Owner's decision:** partial refunds should **void the uncaptured portion**, not capture-then-refund it.

**Determination: the partial-refund path does NOT already void uncaptured amounts — and it does not capture-then-refund either. It does the Stripe half right and the ledger half wrong.**

**Exact files/functions handling partial refunds:**

| Layer | File / function | Behaviour | Verdict |
|---|---|---|---|
| Stripe | `supabase/functions/trade-refund/index.ts` (L~194–202) | `pi.status ∈ {requires_capture, processing}` → `stripe.paymentIntents.cancel()` (`stripeAction = 'cancelled_uncaptured'`) | ✅ **already voids** at the provider — **no capture-then-refund** |
| Ledger (payment) | same file → `public.rpc_record_payment_refund` | called **unconditionally** with the selected `refund_price/fee/tax` and `p_refund_status='succeeded'` ⇒ increments `payments.refunded_*` and sets `derived_state='partially_refunded'` **for money that was never charged** | ❌ **books a refund for an uncaptured amount** |
| Ledger (tax) | `rpc_record_payment_refund` → `public.rpc_record_stripe_refund` | record is `quoted`, so it **refuses** the refund but **stamps** `stripe_refund_id = 'cancelled_<pi>'`, `refund_status='succeeded'`, `refunded_at=now()`, `reconciliation_status='needs_review'` with reason *"Stripe refund … issued but tax status is quoted"* | ❌ **leaves the tax `quoted` (never `voided`) and raises a spurious needs-review row** |

**Why this is a fix and not a QA pass:** the owner's fence is *void the uncaptured portion*. On this path the uncaptured portion is **recorded as a refund** and never transitions to `voided`. The correct pattern already exists in this repo — `admin-trade-action` and `resolve-dispute` both branch on the `cancelled_` prefix: `cancelled_*` → `rpc_void_tax_for_trade`, otherwise → `rpc_record_stripe_refund`. **`trade-refund` is the one writer missing that discriminator.**

**Latent, not active:** read-only checks show **0** `trade_refunds` rows with a `cancelled_` prefix, **0** tax rows with a `reconciliation_status`, and 5 `payments` rows at `partially_refunded` (all from captured-trade refunds). So the defect has **never fired on staging** — which is precisely why it should be fixed *before* it does, and why it cannot be "verified as PASS" today.

**Per the owner's instruction, O2-C12 was deliberately NOT driven as a QA case** — forcing a PASS on the wrong behaviour was explicitly ruled out.

### 4.1 The separate 9-row backfill residual (disposition now decided, action NOT applied)

Re-verified read-only, exact match to the tracker: **9** trades with `status='completed'` + `tax_status='quoted'`, `SUM(tax_amount_cents) = 8063` (**$80.63**), **every one** with `captured_at IS NULL`, `stripe_refund_id IS NULL`, `reconciliation_status IS NULL`. These are the cash trades where the platform never captured tax — so marking them `collected` would overstate collected tax by $80.63 (exactly the trap the tracker flagged).

Under the owner's decision the correct terminal state is **`voided`**, not `collected`. This is a **data action** that was **not** covered by the R03 approval, so it was **not applied** — flagged for explicit approval.

---

## 5 · Agent rule upgrades — applied, with measured effect

All upgrades from the task brief were in force for this session. Honest impact, including where a rule was simply *not exercised*:

| Upgrade | Applied? | Measured effect |
|---|---|---|
| **Evidence capture — hard, non-skippable** | ✅ | **7 on-disk screenshots** for a 2-case round (login-as, queue, review-offer, confirm modal, post-accept, success modal, after-accept queue). Every transition, the dialog, and the final state have a frame. **Zero AX-text-only verdicts.** |
| **Coordinate accuracy (R104 extension) — never eyeball** | ✅ | **Every** tap coordinate came from `qa:ocr --coords` (7 taps). **Zero coordinate misses.** The preceding round measured 4 misses costing ~28 calls from eyeballed coordinates — that class did **not** occur once here. |
| **AX-dump crash fallback — adb-first driving** | ✅ | Driven entirely by `adb shell input tap` + OCR. I issued **0** `mobile_list_elements_on_screen` calls and **0** `ref`-based clicks ⇒ **0 dev-client crashes**. The preceding round lost **52 calls (21 %)** to the two `SIGMOBILE`/`AgentSpec::Attach` crashes and their cold-restart recovery. **This is the single largest measured saving of the round.** |
| **Transient-UI capture (R108 extension)** | ⚠️ | **Not exercised.** No < 3 s state was the evidence target this round: the accept confirmation ("Offer Accepted!") is a **persistent modal**, caught with a normal tap→screenshot. No claim is made that the batching technique was validated here. |
| **Native-sheet text entry** | ⚠️ | **Not exercised** — no third-party native sheet (Stripe) was driven this round. |
| **Batch API validation (`mobile_swipe_on_screen` needs `direction`)** | ✅ (trivially) | I issued **0** `mobile_batch_commands` calls, so the abort-the-rest-of-the-batch class could not fire. The rule held by avoidance, not by validation — reported as such. |
| **Scroll behaviour over non-interactive areas** | ⚠️ | **Not exercised** — no scrolling was required (every target was on-screen; OCR confirmed positions 1:1 in device pixels). |
| **Tracker hygiene — no mojibake anchor** | ✅ | Tracker edits anchored on the TC-ID / stable column text, **never** on the `�` status glyph. Both row edits matched first time. |
| **Step-0 reconciliation stays mandatory** | ✅ **caught real drift** | Two genuine catches *before* planning scope: (a) the guide's **duplicate `TRD-TC-R03`** (index = offer-expiry; body L7005 = a different case) — F4; (b) the brief's framing of O2-C12 ("partial refunds void the uncaptured portion") vs the tracked residual ("9 completed+quoted rows pending a void-vs-collect decision") are **two facets of one decision**, not the same ticket — reconciling them is what produced the correct dual determination in §4. |

**Additional efficiency observations (no new rule claimed):** read-only DB precondition passes (Phase 23) selected the fixture listing first-try and pre-empted two `DUPLICATE_OFFER` iterations; running `qa:reset-offer-fixtures` at session start cleared 2 stale offers before they could collide with the fixture.

**Round cost:** ≈ **62 tool calls** for 2 cases + a full fixture build, drive, side-effect verification and reset — ≈ **31 calls/verdict**, against the decision log's preceding-round baseline of ≈ 14 calls/verdict for 10 verdicts. Higher per-verdict because this round's value is *depth* (pre-state baselines, three-writer contrast, provider-path reading, leak quantification, full reset) rather than breadth. The two systematic wastes named in that log (ref-click crash, coordinate re-derivation) contributed **zero** calls here.

---

## 6 · Evidence index

| File | Shows |
|---|---|
| `screenshots/R03-01-seller2-login-as.png` | Post-persona-switch state; retained/superseded Checkout screen (R96/R59) |
| `screenshots/R03-02-trades-tab.png` | Trades tab; confirms the active session is `test-seller-2` (empty buyer-side list) |
| `screenshots/R03-03-needs-action.png` | **"2 offers to review"** — both competing offers, $20.00 vs $15.00 + "Includes points redemption" |
| `screenshots/R03-04-review-offer-cash.png` | Review Offer for the $20.00 cash offer (payout $18.00) |
| `screenshots/R03-05-accept-confirm-modal.png` | In-app accept confirmation modal (Cancel / Accept) |
| `screenshots/R03-06-post-accept.png` | Post-accept seller view — Accept affordance gone |
| `screenshots/R03-07-trades-after-accept.png` | **"Offer Accepted! / Payment authorized. Trade is now in progress."** success modal |

DB read-backs (all read-only, staging `drntwgporzabmxdqykrp`) are quoted inline in §2–§4; the approvals-relevant writes this round were exactly: the owner-approved fast-clock `UPDATE trades.offer_expires_at` on `67b14e93`, the sanctioned fixture tools (`qa:reset-offer-fixtures`, `qa:ensure-cards`, `qa:ef-repro` ×4), and the fixture-reset `cancel-trade` call on `11cd34e0`. **No other write was issued.**

## 7 · Friction & follow-ups

- **Admin portal unusable this round (not an app defect):** `http://localhost:3001/trades/<id>` returned **Next.js "Server Error — Cannot find module './vendor-chunks/@supabase.js'"** from a corrupt `.next` build artifact (§5.21 R97 class). No admin-dependent case was in scope, so this cost nothing — but the fixture reset was routed through the app's own `cancel-trade` EF instead of admin force-cancel because of it. **Follow-up (dev/env):** restart the admin dev server / clear `.next`.
- **F1/F2/F3 fixes** — owner/`Kids P2P App Builder` follow-up; F2 is the substantive one (buyer's card hold + tax ledger).
- **F4** — guide renumbering (duplicate `TRD-TC-R03`).
- **F5** — losing-buyer cancellation copy.
- **O2-C12 dev fix** — add the `cancelled_` uncaptured discriminator to `trade-refund`.
- **Data actions awaiting approval:** void the 9 completed+`quoted` rows ($80.63); repair the stranded `quoted` row on `67ba29fc` and the 60 `cancelled_at IS NULL` rows.
- **Coverage note (R80):** Android-only verdicts; iOS booted but not driven. `O3-C06` layer 3 (Stripe duplicate-refund not inducible) is unchanged from the prior round and was out of this round's scope.

## 8 · Closing tally

**No status flips this round.** TRD remains:

> **295 PASS / 3 PARTIAL / 0 OPEN / 13 DOC-DRIFT / 6 SKIPPED / 16 Remaining = 333 ✓**

**TRD is NOT fully final.** The 3 remaining non-PASS rows, with their now-precise reasons:

| Row | Status | Precise residual |
|---|---|---|
| `TRD-TC-R03` | 🟡 PARTIAL | Both limbs driven on-device. Cancel + SP-restore PASS; the **"holds restored" clause is unmet** on the competing-offer path (F1 `cancelled_at` NULL, F2 hold not released + tax stranded `quoted`). Closes when F1/F2 are fixed. |
| `TRD-TC-O2-C12` | 🟡 PARTIAL | Core assertion (*never falsely marked collected*) **holds** on current data. Owner's void-the-uncaptured decision is **not implemented** on the partial-refund path ⇒ dev fix (§4) + the 9-row data action (§4.1). |
| `TRD-TC-O3-C06` | 🟡 PARTIAL | Layer 3 (Stripe duplicate-refund not inducible on staging) — unchanged; no harness exists. |

---

## 9 · Design-system colour sweep (R62d/R62e)

Run because the per-screen pass applies to **every screen rendered**, including ones driven only for a functional case, and every full-width filled button/dialog is its own scan target.

| Frame | Target | brand green | **iOS system blue** | legacy `#4D4D4D` band |
|---|---|---|---|---|
| `R03-04-review-offer-cash.png` | Review Offer **"Accept Trade"** full-width primary CTA (region `380,1450,340,90`) | **88.64 %** | **0.00 %** | — |
| `R03-05-accept-confirm-modal.png` | Full frame (confirm modal + Review Offer beneath) | 1.64 % | **0.00 %** | 0.05 % (AA noise) |
| `R03-07-trades-after-accept.png` | Full frame (success modal) | 4.14 % | **0.00 %** | 0.08 % (AA noise) |

**No off-brand colour found.** The legacy gray sits at the ~0.06 % AA-text-noise baseline (R62c); the iOS-system-blue family — the live violation class this sweep exists to catch — is **0.00 % on every swept frame**. Frames swept: Review Offer, the accept confirm modal, the success modal. Not swept: the Needs Action list frame (`R03-03`) and the retained Checkout frame (`R03-01`, a prior-session screen outside this case).

---

## 📋 QA Session Handoff

**Test Scope:** `TRD-TC-R03` (both limbs — offer-expiry + competing-offers) and `TRD-TC-O2-C12` (code-side determination). Guide: `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`. Platform: **Android** `Medium_Phone_API_36.1`; iOS booted but not driven (R80).
**Design-System Compliance:** **PARTIAL** — no visual deviation found on any swept screen (brand green throughout; **0.00 % iOS-system-blue** on all three scanned frames; legacy gray at AA-noise level). The single deviation is **copy-level**: the losing buyer's cancellation notification omits the reason while the same event's `sp_ledger` description is reason-aware (F5).
**Perceived Load-Time Verdict:** **GOOD** — all observed transitions rendered within the ideal UX threshold (<3s). Measured: persona-switch deep link → usable screen <2 s; **Accept Trade → success modal <1 s**; competitor queue → Review Offer <1 s. No transition ≥3 s, so no §5.7 finding is raised.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Trades → **Needs Action** queue: header "2 offers to review", both competing offers listed with amount + "Includes points redemption"; layout and tokens correct.
- CONFIRMED — **Review Offer** (seller): "BUYER OFFERS" / "YOUR PAYOUT" breakdown, green primary CTA, safety guidance line; primary is `#5DBB8E` (88.64 % band) with 0.00 % system-blue.
- CONFIRMED — **Accept confirmation modal** (in-app): "Are you sure you want to accept this offer? …", Cancel + Accept, brand-green primary; no off-brand colour on the full frame.
- CONFIRMED — **"Offer Accepted!" success modal**: "Payment authorized. Trade is now in progress. The buyer can confirm receipt." — wording is accurate to the uncaptured-authorization model (uses *authorized*, never *paid*).
- DEVIATION — **losing buyer's `trade_cancelled` notification**: *"The trade for "Science Kit" has been cancelled."* gives no reason, although the platform already ships reason-aware wording for the very same event ("SP refunded because a competing offer was accepted"). Suggested: *"Your offer for "Science Kit" wasn't accepted — another buyer's offer was accepted. Your 5 SP have been returned."*
**Verdict Summary:** **2 cases executed — 0 FAIL / 0 BLOCKED / 0 SKIPPED.** `TRD-TC-R03` = 🟡 **PARTIAL retained** (expiry limb ✅ PASS; competing-offers limb driven — cancel + exact reason + SP restore + notifications PASS, **"holds restored" clause unmet**); `TRD-TC-O2-C12` = 🟡 **PARTIAL retained**, **deliberately not driven** per owner instruction (determination = **dev fix required**). **0 status flips.**
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` updated in place (R52/§5.54). Rows changed: **`TRD-TC-R03`** — Latest/Date/Source/Notes updated (`2026-09-13`, new run folder); status **stays 🟡 PARTIAL**, reason changed from *"competing-offers limb owed"* to *"both limbs driven; F1/F2 defects filed; 'holds restored' clause unmet"*. **`TRD-TC-O2-C12`** — Date/Source/Notes updated; status **stays 🟡 PARTIAL**, now carrying the void-vs-refund determination + the named dev fix + the decided (unapplied) 9-row disposition. Header `Last maintained` marker updated. **No Remaining → Completed flips.** New TRD totals (unchanged, reconciled): **295 PASS / 3 PARTIAL / 0 OPEN / 13 DOC-DRIFT / 6 SKIPPED / 16 Remaining = 333 ✓** (295+3+0+13+6+16 = 333; row ⇄ §1 roll-up verified — `| **TRD** | … | 333 | 295 | 3 | 0 | 13 | 6 | … | **16** |`).
**Critical Findings:**
1. **F2 · MED — a competing offer that loses keeps the buyer's uncaptured Stripe authorization hold, and its tax row is stranded at `quoted` forever.** `transactions-update` (accept branch) is the only cancellation writer in the codebase missing the `cancelled_` void discriminator; `check-authorization-expiry` scans `status='pending'` only, so nothing ever repairs it. FIX-Task-24 already had to backfill 52 such rows (one reason = `offer_expired_competing`) without changing the writer — so this re-leaks on every occurrence.
2. **F1 · MED — competing-offer cancellations never stamp `cancelled_at`** (the DB trigger that would have is dead — it fires only on the retired `payment_processing` status). 60 cancelled rows already carry NULL `cancelled_at` across 4 reasons.
3. **O2-C12 · MED — the partial-refund path books an uncaptured amount as a REFUND instead of a VOID.** `supabase/functions/trade-refund/index.ts` voids correctly at Stripe but then calls `rpc_record_payment_refund` unconditionally, inflating `payments.refunded_*` and forcing `rpc_record_stripe_refund` to stamp `reconciliation_status='needs_review'` on a `quoted` record. Latent on staging (0 instances).
4. **F4 · LOW (doc) — two different case bodies share the ID `TRD-TC-R03`** in one guide (L5100 vs L7005). A future agent using the L7005 body drives a completely different case.
5. **F5 · LOW (copy) — losing buyer's cancellation message hides the reason** (see the deviation above).
6. **F3 · LOW — `tax_voided_count: 0`** in the `process-expired-offers` response although the EF did void (telemetry only; outcome correct).
**App State Left Behind:**
- `test-seller-2` **session left active** on `Medium_Phone_API_36.1`.
- Fixture **fully reverted**: both R03 offers terminal; the accepted trade cancelled via the app's own `cancel-trade` EF (reason `other`, tax `voided`); listing **"Science Kit" `0fe228ee…` back to `available`**; `test-buyer` SP **458 / reserved 0**.
- **Deliberately left as evidence (needs cleanup):** the rival trade `67ba29fc…` retains `cancelled_at NULL` + `tax_status='quoted'` (F2's live proof).
- `test-buyer-2`'s saved card was refreshed by `qa:ensure-cards` (its previous PM was invalid/expired).
- **No order/trade left `in_progress`; no cart rows left; config untouched.**
**Why It Matters:** R03 was the last *undriven* row in the TRD guide — driving it proved the competing-offer mechanic works (exact reason literal, SP returned) **and** surfaced that the same path silently leaves a losing buyer's card authorization open and misclassifies a tax record, a leak that has already required a 52-row manual backfill once. O2-C12's owner decision is now testable against reality: the platform **voids** the uncaptured hold at Stripe but **books it as a refund** in the ledger — so the decision is not yet implemented, and closing it as PASS today would have certified the wrong behaviour.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-trd-close-r03-o2c12-2026-09-13/` (`report.md`, `ledger.md`, 7 screenshots). **F2/F1:** build two pending offers on one listing from two buyers (`qa:ef-repro --ef create-trade-offer`), accept one as the seller in the app, then read `trades` for the rival — expect `offer_expired_competing` with `cancelled_at NULL` and `tax_status='quoted'`; count `SELECT count(*) FROM trades t JOIN tax_records tr ON tr.trade_id=t.id WHERE t.status='cancelled' AND tr.tax_status='quoted'`. **O2-C12:** read `supabase/functions/trade-refund/index.ts` L~194–270 against `admin-trade-action/index.ts` L~200–220 for the missing `cancelled_` discriminator. **Visual:** re-run `npm run qa:badge-scan -- --img <png> --region <r>` on the listed frames.
**Known Gaps / Not Tested:**
- **iOS not driven** (booted, R80) — every verdict is Android-only.
- **O2-C12 not driven as a QA case** — deliberate, per the owner's instruction (a PASS on the wrong behaviour was explicitly ruled out). No uncaptured partial refund was executed end-to-end; the finding is **source-confirmed + latent-on-staging**, not device-reproduced.
- **The actual Stripe PI state for the rival's hold is not provider-verifiable from the QA seat** (R13) — F2 rests on the code path plus the DB-observable tax/timestamp evidence.
- **`O3-C06` layer 3** (Stripe duplicate-refund) — out of scope, unchanged; no inducible harness.
- The **9-row ($80.63) disposition was not applied** (a DB write outside the owner's R03 approval).
- **Frames not colour-swept:** the Needs Action list frame and the retained Checkout frame.
- No `mobile_batch_commands` were issued, so the transient-UI capture and batch-validation technique upgrades were **not exercised** this round.
**What Needs To Be Fixed Next:**
1. **Fix F2 (highest value):** in `supabase/functions/transactions-update/index.ts` (accept branch, ~L240–252) **and** `transactions-accept-bundle/index.ts:149`, mirror the `admin-trade-action` pattern — `await stripe.paymentIntents.cancel(pi)` for the rival when its PI is uncapturable, and `rpc_void_tax_for_trade(rivalTradeId, 'offer_expired_competing')`; add a test asserting the rival's tax row ends `voided` and its PI ends `canceled`.
2. **Fix F1:** add `cancelled_at: now.toISOString()` to both competing-offer updates; sweep the 60 legacy rows with NULL `cancelled_at`.
3. **Fix O2-C12:** in `supabase/functions/trade-refund/index.ts`, branch on `stripeAction === 'cancelled_uncaptured'` — for the uncaptured case record **no** `payments.refunded_*` and no `rpc_record_stripe_refund`; instead void the tax (`rpc_void_tax_for_trade`) and mark the payment row `cancelled` (not `partially_refunded`). Consider refactoring `rpc_record_payment_refund` to refuse a refund when the PI was never captured.
4. **Apply the decided data actions** (needs explicit approval): void the **9 completed + `quoted`** rows ($80.63, all `captured_at NULL`); repair the stranded `quoted` row on `67ba29fc` and the 60 NULL `cancelled_at` rows.
5. **Fix F4:** renumber the duplicate `TRD-TC-R03` in the guide (L7005).
6. **Fix F5:** use the DT-41 reason-aware wording for the losing buyer's cancellation notification.
7. **Fix F3:** report the EF's own pre-void in `process-expired-offers`' `tax_voided_count` (or drop the field from the response).
8. **Env:** restart the admin dev server / clear `.next` (portal served "Cannot find module './vendor-chunks/@supabase.js'").
**UX Enhancement Ideas (optional, not defects):**
- On the seller's **Needs Action** queue, the two competing Science Kit cards are distinguishable only by reading the amount ($20.00 vs $15.00 + "Includes points redemption") — consider an explicit "2 other buyers are competing on this item" line on the card so a seller can see the competition at a glance rather than by arithmetic.
- On **Review Offer**, the screen shows the payout but not *that accepting will auto-decline N rival offers* — consider a one-line "Accepting will decline the other 1 offer on this item (SP returned)" note before the confirm, which would also make the F2 behaviour visible to the seller.
**Suggested Next Session:** `TRD-TC-O3-C06` layer 3 is the only TRD row with no path forward without a harness — so the next session should either (a) build/verify the signed-Stripe-webhook re-delivery harness for it, or (b) re-verify R03 + O2-C12 **after** the F1/F2 and `trade-refund` fixes ship, which would be the first round able to flip all three remaining TRD rows.
**Suggested to Improve Agent Rules:** **Add a rule: when a case's Expected Result enumerates multiple clauses (e.g. "cancelled … **and** holds/SP restored"), verify each clause against a named writer and report the verdict per-clause — a limb can be "driven and mostly passing" while one clause is definitively unmet, and the row must stay PARTIAL rather than flipping on the strength of the clauses that did pass.** This round R03's SP clause passed loudly (wallet + ledger) while the hold clause failed silently (null column + missing Stripe call), and the inclination was to call the limb green — the paired-writer table is what caught it. Second, smaller: **record the exact `--region`/`--token` values used for `qa:badge-scan`** in the report, since the tool requires a region and re-verification otherwise means guessing one.
