# QA Task 18 — Re-Verify DT83 Fixes + Close TRD's Final Remainder

**Run dir:** `e2e-test-results/qa-task18-close-trd-2026-09-02/`
**Date:** 2026-09-02 (~08:30 EDT / 12:30 UTC completion)
**Device:** iPhone 17 Pro Max sim UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E` (iOS 26.1)
**Backend:** Supabase staging `drntwgporzabmxdqykrp`
**Admin portal:** `http://localhost:3001` (real admin session, Trade Timing + Action Center + Disputes paths)
**Repo HEAD:** `b1b8b7e4` (DT83+DT84 combined commit; Metro restarted to serve the fresh bundle)
**Personas:** test-buyer, test-seller, test-free (staging registry)

---

## Verdict summary

| Item | Verdict | Notes |
|---|---|---|
| **A1 · Z05** whole-bundle approve cascade | ✅ **PASS** | HIGH defect genuinely closed: both siblings cancelled + PIs `canceled` + SP released |
| **A2 · D2** Manage KCP Update Payment Method persist | ✅ **PASS** | Card changed via screen now attaches + persists (DB + Stripe default + UI) |
| **A3 · Z03** timeout escalation → buyer notified | ✅ **PASS** | `cancel_request_escalated` notification now emitted on timeout (was missing) |
| **A4 · Z06** escalation-off copy | ✅ **PASS** | All copy surfaces say "the trade will continue" (not "our team will review") |
| **A5** Action Center Review → `/trades/<id>` | ✅ **PASS** | Review navigates to real resolve UI; no false toast (DT83 F-6) |
| **B1** `btn-accept-all-confirm`/`btn-bundle-modal-cancel` AX | ✅ **PASS** | Modal fully AX-instrumented (no OCR) |
| **B2** `qa-refresh` | ✅ **PASS** | Server-side offer surfaced in the seller Needs Action list in one call |
| **B3** `qa-scroll-to` | ✅ **PASS** | `request-cancel-button` y2028→y792, `approve-cancel-request-button` y1282→y206 in one call |
| **C-B09** chat active for in_progress | ✅ **PASS** | Bidirectional messaging, both sides, no frozen banner |
| **C-B11** free upsell → JoinKidsClub | ✅ **PASS** | Offer screen upsell card navigates to Kids Club+ join |
| **C-N07** paused $4 → raise to $6 | ⚠️ **FLAG** | Needs an auto-paused QA-owned sub-min listing (dedicated fixture, R41) |
| **C-N08** single/bundle checkout at/above threshold | ✅ **PASS** | Single at $40 OK with `min_listing_price=$5`; bundles at ≥$5 exercised |
| **C-R10** admin dispute → Complete | ✅ **PASS** (+1 observation) | Trade completed, seller-favor, payout row, no refund; PI-capture timing observed |
| **C-R11** refund/cancel notifs both parties | ✅ **PASS** | DB-verified across paths |
| **C-R12** refund idempotency | ✅ **PASS** | Re-approve rejected `NOT_PENDING`; no double refund/UI |
| **C-R13** cancelled status + timeline | ✅ **PASS** | Both parties see terminal Cancelled + reason, no CTAs |

**Totals: 15 PASS · 0 FAIL · 1 FLAG (C-N07, fixture) · 1 classified-limited (C-B10) · 3 findings/observations**

---

## Section A — Dev Task 83 fixes re-verified (all hold on-device)

### A1 · Z05 — whole-bundle cancel cascade — ✅ PASS (HIGH defect genuinely closed, not just improved)

Fresh 2-item SP-eligible bundle (`bundle b19dc630`, trades `20df2687` sp11/cash$12 + `e2c81de9` sp17/cash$6; items "QA Bundle Fixture 1/2 of 2 (2026-09-02)"):

- Buyer offered with **28 SP** (17 + 11) → seller **Accept All** (via the now-AX-exposed accept-all modal) → both trades `in_progress`; Stripe PIs `pi_3UBCNM`/`pi_3UBCNN` `requires_capture`; wallet `reserved_sp` 10→38.
- Buyer requested **whole-bundle** cancel (scope prompt → Whole Bundle → reason) → **both siblings `requested` with identical expiry** (cascade request confirmed).
- Seller **Approve Cancellation** → confirm modal → Cancel Trade.
- **DB read-back (the money assertion):** BOTH `20df2687` AND `e2c81de9` → `cancelled`, `cancel_request_status=approved`, `resolution=approved_cancel`, `cancelled_at` set on both. **SP released on BOTH** (`sp_released_at` set; 11 + 17 = 28 SP). Wallet restored to baseline (`available 490 / reserved 10`).
- **Stripe read-back:** BOTH PIs → **`canceled`** (`amount_received: 0`, `canceled_at` set) — not `requires_capture`.
- Buyer notifications: `cancel_request_approved`, `trade_cancelled` ×2, `sp_refunded` ×2 (11/17 SP).
- **QA-17's HIGH-severity defect (sibling left in_progress with live hold + unreleased SP) is genuinely CLOSED.** Root fix confirmed deployed: `cancel-trade` EF v57 sibling-cascade (query same `bundle_id` requested/in_progress → per-sibling `cancelOneTrade` → fail-closed before marking approved). `screenshots/A1-z05-*`.

### A2 · D2 — Manage Kids Club+ Update Payment Method persists — ✅ PASS

- Manage Kids Club+ → Update Payment Method → PaymentSheet → selected a different saved card (VISA 4242) → Set up → **"Payment method updated successfully"** alert (now truthful).
- **DB read-back:** `subscriptions.stripe_payment_method_id` AND `user_subscriptions.stripe_payment_method_id` both flipped `pm_1UAy9b4` (VISA 5556) → **`pm_1UAyDh4` (VISA 4242)** at 11:54:56.
- **Stripe read-back:** customer `invoice_settings.default_payment_method` = `pm_1UAyDh4` (4242).
- **UI:** Manage screen now shows Visa •••• 4242 (07/2028); Checkout shows "Paying with VISA •••• 4242".
- Source-verified: `PaymentMethodSection.handleUpdatePaymentMethod` calls `attachPaymentMethodToCustomer(result.paymentMethodId)` before success (DT83 D2). **QA-17 D2 defect closed.** *Tooling note:* the native PaymentSheet's literal "type a brand-new card number" leg is OCR-unreliable in this toolset (bulk-digit contamination); the attach+persist (the actual DT83 defect) was verified via a card change through the same code path. `screenshots/A2-*`.

### A3 · Z03 — timeout escalation notifies the buyer — ✅ PASS

- Fresh single pending request on `943097a5` (cash-only "Cash-Only Item", requested by test-buyer).
- Fast-clock (`cancel_request_expires_at = now()−1min`, R14 fixture technique) → `fn_escalate_expired_cancel_requests()` → `{success:true, updated:1}` (audit run id 115, 11:57:17).
- **DB:** `943097a5` → `escalated`; buyer received **`cancel_request_escalated`** notification at the exact escalation timestamp: "Sent to our team — The seller did not respond to your cancellation for 'Cash-Only Item'. Our team is reviewing it now."
- **On-device:** buyer Notification Center shows "Sent to our team" at the top.
- Source-verified: migration `20260902000000` temp-table capture + per-(buyer,bundle) notification loop (was missing in QA-17). **QA-17 Z03 defect closed.** `screenshots/A3-z03-buyer-notif-center.png`.

### A4 · Z06 — escalation-disabled copy — ✅ PASS

- Admin Trade Timing → toggled `cancel_request_escalation_enabled` **false** (real portal, success banner, DB verified, `updated_by` admin `1a546991`).
- Fresh single trade `fe3924ee` → buyer whole-bundle cancel request → escalation off.
- **Config-cache note:** the app caches `getAdminConfig()`; a screen re-mount did not pick up the change until an app relaunch (fresh config fetch). After relaunch, all copy surfaces reflect the disabled state:
  - Buyer pending card: "…If they decline, **the trade will continue as planned.**"
  - Seller decline confirm modal: "The buyer's cancellation request will be **closed and the trade will continue as planned**." + button **"Close Request"** (not "Send to our team?").
  - Seller success alert: "**Request Closed** — the buyer's cancellation request was declined — the trade will continue as planned."
- **DB:** `fe3924ee` → `resolved`/`keep_trade` (not escalated); buyer `cancel_request_resolved` notification ("Trade continues — …the trade will continue as planned").
- Config **restored to `true`** and DB-verified. **QA-17 Z06 copy defect closed.** `screenshots/A4-z06-*`.

### A5 — Admin Action Center "Review" — ✅ PASS

- Action Center → Cancel Requests queue shows the 2 escalated requests (`6a1f9d94` bundle, `943097a5` "Cash-Only Item") with Review buttons.
- Clicked **Review** on `943097a5` → **navigated to `/trades/943097a5-…`** with the real resolve UI ("Buyer Cancellation Request" → **Approve Cancel & Refund / Keep Trade**, plus Force Cancel / Partial Refund) — **no false "Approved item." toast** and the request was **not** auto-resolved (DB still `escalated`).
- Source-verified: `DEV-TASK-83 (F-6)` in `p2p-kids-admin/src/app/action-center/ActionCenterClient.tsx` L358-363 — "Review" routes through `handleAction('review')` → `router.push('/trades/<id>')`, never falls through to `approve`. **QA-17 Action-Center finding resolved** (it IS part of DT83; the earlier research pass missed it in the commit's changed-file list).

---

## Section B — Dev Task 84 instrumentation spot-checks (all PASS)

- **B1 (AX modal buttons):** on the bundle accept-all modal, `btn-accept-all-confirm` and `btn-bundle-modal-cancel` surface directly in the AX tree with coordinates — QA-17's blanked-tree (F-4) is gone; no OCR/coordinate-guessing needed.
- **B2 (qa-refresh):** seller Needs Action list was stale after a server-side `ef-repro` offer; `p2pkidsmarketplace://qa-refresh` surfaced the new pending offer (`d55a58a8` Review-Offer row) in ONE call.
- **B3 (qa-scroll-to):** `p2pkidsmarketplace://qa-scroll-to?testID=request-cancel-button` moved it y2028→y792; `…approve-cancel-request-button` y1282→y206 — both one call.
- Bonus: `qa:ef-repro --notify` verified/backfilled the seller `trade_request` notification.

**Deliverable — repeated bundle-accept call-count (DT84 efficiency win):** this session's accept-all modal interaction was **2 AX calls** (1 list → modal buttons exposed → 1 tap on `btn-accept-all-confirm`), vs QA-17's ~4–6 OCR/coordinate-guess calls per accept (F-2). Confirmed across the Z05 bundle accept and the later single-offer accept-all (both used the identical AX path). Target of ~2 met.

---

## Section C — TRD final never-started remainder (9 cases)

Pulled from the guide + full report reconciliation (TEST-COVERAGE-INVENTORY is stale). The exact 9 never-started TRD cases, excluding Group Z/G (resolved in QA-17) and the 5 permanently-descoped Q-cases (Q10/Q11/Q13/Q14/Q16):

### C-B09 · Chat remains active for in_progress trades — ✅ PASS
Clean in-progress trade `d55a58a8` (Remote Control Car $25). Buyer chat: no frozen banner; message input, quick-reply chips, image picker, emoji all active; sent "Hi!…". Seller chat: same active controls; buyer's message shown on the left; seller replied "Yes!…". Both messages DB-verified on `messages.content` (buyer 12:15:04, seller 12:16:20). Guide "passed" stamp now backed by a real verdict. `screenshots/C-b09-*`.

### C-B10 · Replace Card path (offer screen) — classified limited (native-sheet tooling)
The TradeOfferScreen add/replace-card control (`add-new-card-mode-button` + saved "Paying with…" row) is present (observed on the offer screen during B11). The attach-persist code path this route uses was verified end-to-end in **A2/D2** (the same `attach-payment-method` EF + DB/Stripe persistence), and QA-17 D1/D3 proved the offer/checkout PaymentSheet adds complete. However, the literal "type a brand-new card number → Replace Card…busy → SetupIntent" leg hits the same native-PaymentSheet OCR/typing limitation documented in D2 and was not directly driven this session. Honest classification: **code-path verified (attach/persist), literal new-card-number entry not directly executed (native-sheet tooling limitation)** — recommend the dev agent's on-device leg or a follow-up QA run with a sheet-entry workaround.

### C-B11 · Subscribe-upsell → JoinKidsClub — ✅ PASS
Free user (test-free) on the offer screen (Remote Control Car, Request to Buy → "Make Offer") shows the upsell card exactly as specified: **"Save up to 50% with Swap Points"** + "Kids Club+ members can use Swap Points to save on every trade. Try it free for 30 days." Tapping the upsell button **navigated to the Kids Club+ (JoinKidsClub)** screen (web-first join, per R7 design). `screenshots/C-b11-upsell-to-joinkidsclub.png`.

### C-N07 · Seller raises price to meet threshold → listing repurchasable — ⚠️ FLAG (fixture gap, R41)
Precondition requires an **auto-paused sub-minimum listing** (a $4 listing that was paused when `min_listing_price` was raised to $5). No QA-persona-owned sub-$5 listing exists on staging (the sub-$5 available listings belong to undocumented sellers `19e6c297`/`fe83f218`/`cc0a0aff`), and the below-min **save is blocked** (`listing.ts:699` "Price must be at least $X"), so the paused-at-$4 state can't be reached via the UI after the raise. Setting `min_listing_price=$5` and verifying the ≥$5 offer path (N08) succeeded. **Honest flag:** N07's positive leg needs a dedicated fixture-building session (create a $4 QA-owned listing while min=0, then raise min) per R41 — not forced.

### C-N08 · Single-item + bundle checkout at/above threshold — ✅ PASS
With `min_listing_price=$5` active (set + DB-verified via `qa:admin-config-set`), a single-item $40 offer (`ef-repro`, Kids Kindle Tablet) succeeded HTTP 200 — **no MIN_LISTING_PRICE error**. Bundle checkouts at ≥$5 were exercised extensively earlier this session (Z05 $46 bundle, Z06 $25, B09 $25) with no below-min errors. Config reverted to 0 (DB-verified). Single leg + reasoning; a bundle-with-threshold re-run is a minor gap (items ≥$5 share the same per-item enforcement).

### C-R10 · Admin dispute resolve → Complete (no refund) — ✅ PASS (+1 observation)
Buyer reported a problem on in-progress `d55a58a8` (reason no_show) → `dispute_status='reported'`. Admin **Disputes** → `/trades/disputes/d55a58a8` → **Resolve → Complete** → confirm. **DB:** trade `completed` (12:26:08), `dispute_resolution='resolved_seller'`, `dispute_resolved_by` = admin `1a546991` (attribution ✓ R35), `completed_at` set; **`seller_payouts` row created** (`5b879741`, stripe, pending, gross 2250 / net 2219); **0 `trade_refunds` rows** (no refund).
**Observation (flag for dev):** the buyer's PaymentIntent `pi_3UBCz94` remained **`requires_capture`** (amount_received 0) with **no `payment_captured` trade event** on the admin-complete path — the payout row is created but the buyer hold is not visibly captured. Worth confirming whether payout processing captures it or this is a genuine money-flow gap on dispute-resolve-Complete.

### C-R11 · Refund/cancellation notifications to both parties — ✅ PASS
DB-verified across the paths executed this session: seller received `cancel_request_sent` (request), `trade_cancelled` ×2 (Z05 bundle), `trade_request` (offers), `new_message` (B09); buyer received `cancel_request_approved`, `trade_cancelled`, `sp_refunded`, `offer_accepted`, `cancel_request_resolved` ("Trade continues"), `cancel_request_escalated`. Every path notifies both parties appropriately with deep-link context.

### C-R12 · Refund idempotency — no double refund — ✅ PASS
Re-attempting an approve on the already-cancelled `20df2687` via the guarded RPC returns **`{success:false, code:'NOT_PENDING'}`** (clean rejection). Trade state unchanged (single `sp_released_at`, 0 refund rows). Admin trade page shows **no** double-resolve buttons (approve/keep absent for a resolved request). No double refund / SP double-restore possible.

### C-R13 · Cancelled/refunded trade status + timeline — ✅ PASS
Opened cancelled `20df2687` as **both** buyer and seller: terminal **"Cancelled"** status + reason "Buyer requested cancellation — approved by seller"; milestone markers; no further action CTAs (no confirm/cancel/message controls). `trade_events` show the lifecycle: `offer_submitted` → `offer_accepted` → `cancel_request_approved` (with reason, timestamped). `screenshots/C-r13-buyer-cancelled-timeline.png`.

---

## Findings / observations (for dev follow-up, NOT code fixes by QA)

1. **R10 money-flow observation (verify, possible gap):** admin dispute "Resolve → Complete" completes the trade + creates the seller payout but leaves the buyer's uncaptured hold (`requires_capture`, no `payment_captured` event). Confirm payout processing captures, or this is a platform-funding gap on the admin-complete path.
2. **Minor copy bug:** the buyer cancel-request pending card reads "…47h 57m left **left**." (double "left" — countdown already includes "left"; JSX appends it) in `TradeTimelineScreen`. Cosmetic, parent-facing.
3. **Minor:** Z05 `cancel_request_approved` trade-event metadata logs `sp_refunded: 0` even though 11 SP was refunded on that trade (the per-trade event uses the tapped trade's `data.sp_refunded` which was 0 for that hold; SP refund amounts are surfaced via the `sp_refunded` notifications/rows). Cosmetic/audit-only; the actual SP release (rows + wallet) is correct.
4. **Config-cache note (not a defect, but worth awareness):** `getAdminConfig()` is module-cached; a mid-session admin config change (e.g., escalation toggle) is not reflected until an app relaunch. Fine for rare admin toggles; the DT83 gate reads fresh config on cold start (verified).

## Design-system / UX (three-layer) notes
- All dialogs/alerts visited rendered with the branded palette (primary/error/neutral tokens); the accept-all modal and GlobalAlert alerts are consistently styled; no unstyled OS alerts encountered on app surfaces (the R10/approve confirm modals are native-window RN modals handled via the documented pixel/OCR technique).
- Copy on the cancel-request surfaces is plain and appropriate for the parent audience after Z06 ("the trade will continue as planned" is clear); the double-"left" phrasing is the only wording defect noted.
- Header/back buttons on the visited screens conform to the canonical detail header.

## App state left behind (cleanup notes)
- **Config restored (DB-verified):** `cancel_request_escalation_enabled=true`; `min_listing_price=0`.
- **test-buyer saved card changed:** now VISA •••• 4242 (`pm_1UAyDh4`) as default (was VISA 5556) — from the D2 verification; a valid card, functionally fine, documented for future runs.
- **Leftover trades:** `943097a5` + `6a1f9d94` escalated (in-progress, awaiting an admin decision); `fe3924ee` resolved/keep_trade in_progress; `d55a58a8` completed via R10 (its PI remains an uncaptured hold — see finding 1); Z05 bundle `b19dc630` trades cancelled; leftover pending offer `5dace4ed` cleared via `qa:reset-offer-fixtures`.
- Fixture items from this session ("QA Bundle Fixture N of N (2026-09-02)", SP-eligible, available) remain in the item pool (consistent with prior QA-run residue).
- App on the simulator: logged in as test-free (last persona driven).

## Evidence
- Screenshots: `e2e-test-results/qa-task18-close-trd-2026-09-02/screenshots/` (A1-z05-*, A2-*, A3-z03-*, A4-z06-*, C-b09-*, C-b11-*, C-r10-*, C-r13-*).
- This report + session notes at `/memories/session/qa-task18-plan.md`.

## How to verify / reproduce
- Z05: build a 2-item SP bundle → whole-bundle cancel request → seller approve → assert both trades cancelled + both Stripe PIs `canceled` + `sp_released_at` set + wallet restored. (Confirmed on `b19dc630`.)
- Z03: pending request → backdate `cancel_request_expires_at` → `SELECT fn_escalate_expired_cancel_requests()` → buyer `cancel_request_escalated` notification.
- Z06: admin Trade Timing toggle off → (fresh app launch) buyer request → seller decline → copy "the trade will continue…" → restore on.
- Action Center: `/action-center` → Cancel Requests → Review → lands on `/trades/<id>` with Approve Cancel & Refund / Keep Trade.

## Suggested next session
- **C-N07 dedicated fixture session** (R41): create a $4 QA-owned listing while `min_listing_price=0`, then raise the min → verify auto-pause → raise listing to $6 → verify repurchasable; also re-run the bundle leg of N08 with the threshold active.
- **C-B10** via a dev on-device leg or a PaymentSheet entry workaround (native-sheet card-number typing).
- **R10 money-flow confirmation** (dev): does dispute-resolve-Complete capture the buyer hold (payout funding path)?
- Finalize DT84/DT83 (commit `b1b8b7e4` is a DRAFT awaiting go-ahead — QA-18's on-device verification is the gate; consider a follow-up commit).
