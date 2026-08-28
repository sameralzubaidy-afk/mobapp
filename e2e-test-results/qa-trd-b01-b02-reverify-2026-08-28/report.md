# QA Task 3 — TRD-TC-B01/B02 Re-Verify (History-Placement Spec) — 2026-08-28

**Run ID:** `qa-trd-b01-b02-reverify-2026-08-28`
**Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (Group B)
**Surfaces:** iOS mobile (Expo RN, `com.sameralzubaidi.p2pmarketplace`), iPhone 17 Pro Max simulator (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`)
**Backend:** staging Supabase `drntwgporzabmxdqykrp`
**Verdict:** B01 ✅ PASS · B02 ✅ PASS (with 2 documented findings on the seller-ignore prompt semantics)

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| TRD-TC-B01 | MODULE-15.1.2 Group B | ✅ **PASS** | Declined offer correctly excluded from Active "Your Offers"; appears in History with "Cancelled" + working "View Item" → ListingDetail (Basketball), no crash. DB: `seller_declined`, item still available. |
| TRD-TC-B02 | MODULE-15.1.2 Group B | ✅ **PASS** | Expired offers excluded from Active, surface in History with "Cancelled" + working "View Item"; seller-ignore prompt **fires** (DB-proven) when the counter reaches 2. Finding: counter tracks *simultaneous pending offers*, not a *sequential same-buyer streak* — guide narrative vs implementation. |

Roll-up: **2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED**

---

## TRD-TC-B01 · Seller declines offer — ✅ PASS

### Execution trace (condensed)
1. Buyer (test-buyer) deep-linked to **Basketball** (`c3bebc5e`, $15, Accept-SP) → Request to Buy → offer screen (SP 0, saved MC •••• 4444) → Send Offer → **Liability Disclaimer** modal (checkbox + green "Accept & Continue"; Accept disabled until checkbox) → offer created.
   - Trade `30eabfdf-290d-48b1-a533-99e9b3172b66`, status `pending`, cash $15, SP 0, PI hold `pi_3U9TOV4I6kCJlvXo1K4pT4Fc`. UI: "Trade Initiated!" success.
2. Logged out → logged in as **test-seller** (`TestSeller123!`) → Trades → Needs Action → Review Offer (Basketball $15) → **Decline** → confirm modal (`decline-trade-confirm-button`) → **"Offer Declined / The buyer has been notified."** (native alert, OK = green pill ~(220,523)pt).
3. **DB:** trade `30eabfdf` → status `cancelled`, `cancellation_reason='seller_declined'`, `cancelled_at` 17:19:05, **item still `available`**. `listing_offer_stats` Basketball → `unanswered_offer_count=0` (decline resets), `last_prompt_sent_at=null`.
4. Logged out → logged in as **test-buyer** → Trades → **Active tab**: declined offer **NOT present** ("Your Offers" = 0; only Recently Completed shown). → **History tab**: **Basketball $15.00 — [Cancelled] [View Item]** present.
5. Tapped **View Item** on the Basketball history row (`trade-history-row-30eabfdf-…-view-item` at ~(380,370)pt) → navigated to **ListingDetail "Basketball"** — no navigation crash.

### Assertions
- ✅ Seller decline confirmation shown ("Offer declined" copy; item stays listed — see UX note).
- ✅ Buyer History shows the declined (cancelled) trade with "Cancelled" badge + **View Item** button (listing still available).
- ✅ View Item opens the listing without a navigation crash.
- ✅ Declined offer does **not** appear in Active "Your Offers" (pending-only).
- ✅ DB: `cancellation_reason='seller_declined'`; item `available`; SP restore N/A (0 SP used — conditional per guide).
- ✅ Counter reset to 0 on explicit decline (correct).

### Screenshots
- `02-b01-offer-screen-basketball.png` — offer screen (SP 0, saved card, breakdown).
- `03/04/09-b01-liability-disclaimer-modal*` — disclaimer modal; checkbox → green Accept.
- `05-b01-offer-submitted.png` — "Trade Initiated!" success.
- `06/07-b01-after-decline*.png` — "Offer Declined / The buyer has been notified."
- `10-b01-buyer-history-tab.png` — History: Basketball [Cancelled] [View Item].
- `11-b01-view-item-listing-detail.png` — ListingDetail "Basketball" after View Item.

### UX notes (B01)
- **Structural / affordance:** PASS. Header/back/flow consistent; decline confirmation dialog centered with clear single primary (OK) action.
- **Wording / copy:**
  - DEV/COPY — Guide expected **"Offer declined. Item stays listed."** but the actual alert is **"Offer Declined / The buyer has been notified."** (no "Item stays listed"). The listing does stay available (DB-proven), so the copy just omits the reassurance. Recommend aligning either the guide or the copy: *"Offer declined. The item stays listed."*
  - Minor — the post-submit success screen is titled **"Trade Complete"** while its body says **"Trade Initiated!"** (the trade is only pending). Recommend title "Offer Sent"/"Trade Initiated".
- **Design-system compliance:** PASS — decline-confirm modal uses in-app `TradeConfirmationModal` (AX-exposed `decline-trade-cancel/confirm-button`, primary pill); "Offer Declined" alert OK renders as primary green pill (`#5DBB8E`), not OS-blue. No deviations found on visited screens (Review Offer, offer screen, History, ListingDetail).

### Locator-gap findings (B01)
- Native "Offer Declined" alert OK button not AX-exposed on first check (native modal window); resolved via pixel-scan of the green pill. On the first B01 pass the disclaimer modal tree only surfaced `disclaimer-modal-close-button` (native-window separation), yet on later submissions the full modal was AX-exposed — **drivability varies between presentations**; recommend instrumenting the disclaimer modal's checkbox/accept with `accessible`+`accessibilityRole` so it surfaces consistently (BP-53 class).
- Disclaimer modal body is **placeholder copy from Amazon** ("Commercial Liability Insurance Requirements… Amazon Services Business Solutions Agreement") — this is a generic legal boilerplate, not this app's disclaimer (see §cross-cutting).

---

## TRD-TC-B02 · Offer expiry + seller-ignore prompt — ✅ PASS

### Execution trace (condensed)
1. **Offer 1 (test-buyer)** on **Remote Control Car** (`35e3a900`, $25): deep link → Request to Buy → Send Offer (0 SP, saved card) → disclaimer accept → trade `0febd389` pending (PI `pi_3U9TXe4I6kCJlvXo16anzgWu`).
   - **Fast-clock** (documented method): `UPDATE trades SET offer_expires_at = now() - 1s` → `SELECT rpc_process_expired_offers(100)` → **processed 1**, trade cancelled `'Offer expired'`, item available, counter 0→1→0, **no prompt** (expected at count 1).
   - Buyer History: **Remote Control Car $25 — [Cancelled] [View Item]**; View Item → ListingDetail "Remote Control Car" (no crash). Active tab: **expired offer absent**.
2. **Offer 2 (test-buyer, sequential)** on Remote Control Car → trade `edc627c8` pending → fast-clock → expired (`'Offer expired'`). Counter **0→1→0 again** → **no prompt** on the sequential second offer (observed; see finding F2-1). Buyer History now shows **both** Remote Control Car rows at the top, each `[Cancelled] [View Item]`.
3. **Prompt staging (2 SIMULTANEOUS pending offers — the only way the counter reaches 2 given the duplicate-offer guard):**
   - test-buyer-2 (free user) → first offer attempt failed **"No Stripe customer found. Please add a payment method first."** (EF `create-trade-offer` reads `subscriptions.stripe_customer_id`; free user had none).
   - Added a card via the offer screen **Add New Card** → Stripe PaymentSheet (4242 4242 4242 4242 / 12/28 / 123 / 06850 → Set up) → "Card Added" → `subscriptions` row now `stripe_customer_id=cus_V9nI4Dwd3xbwWU`, `stripe_payment_method_id=pm_1U9Tjb4I6kCJlvXoDPsq9mHy`.
   - A **stale-replay LogBox** (the earlier NO_STRIPE_CUSTOMER console error) scrimmed the first resubmit taps → **terminate + relaunch** (per §5.38 R4) → resubmit → trade `a1bf0854` pending. **Counter = 2**, `last_prompt_sent_at=null`.
   - Fast-clock **both** pending offers (`edc627c8` + `a1bf0854`) → `rpc_process_expired_offers(100)` → **processed 2** and returned notifications including:
     ```
     { trade_id: edc627c8-…, event_type: "seller_ignore_prompt",
       recipient_user_id: 14be337c-… (test-seller),
       extra_data: { listing_id: 35e3a900-…, listing_title: "Remote Control Car", unanswered_count: 2 } }
     ```
   - **DB after:** `listing_offer_stats` Remote Control Car → `unanswered_offer_count=0`, **`last_prompt_sent_at = 17:42:18`** (set = prompt branch executed). Both trades cancelled `'Offer expired'`, item available.
4. Buyer History re-verified: both Remote Control Car expired offers surface with `[Cancelled] [View Item]`.

### Assertions
- ✅ Expired offer **not** in Active "Your Offers" (pending-only).
- ✅ Expired offers **in History** with "Cancelled" + **View Item** → opens listing, no crash.
- ✅ Trade auto-cancels at expiry (`cancellation_reason='Offer expired'`), SP restore N/A (0 SP used), item stays available.
- ✅ **Seller-ignore prompt fires when the counter reaches 2** (DB/EF evidence: RPC payload `seller_ignore_prompt` with `unanswered_count: 2` + `last_prompt_sent_at` set) — the F2 (DEV-TASK-31) fix is live and correct (live `fn_reset_unanswered_counter` guard = `'Offer expired'`, no snake guard; verified earlier).
- ✅ Reminder notifications (6h/1h) — not re-driven this run (out of the task's scope; previously covered); noted as not re-verified here.

### Screenshots
- `12/13-b02-*` — post-expiry states.
- `14-b02-view-item-listing-detail.png` — View Item → ListingDetail (expired offer).
- `15-b02-active-tab.png` — Active tab: only Recently Completed, no expired cards.
- `16-buyer2-tos-gate.png` — test-buyer-2 TOS gate (Google Cloud placeholder copy — finding).
- `18-buyer2-offer-failure.png` — "No Stripe customer found" alert (fixture gap, resolved by adding a card).
- `19/20-buyer2-*` — card-add flow.
- `23-b02-history-two-expired-offers.png` — History: two Remote Control Car rows [Cancelled] [View Item].

### UX notes (B02)
- **Structural / affordance:** PASS — History rows render clearly with Cancelled badge + one-tap View Item; tab switching is obvious.
- **Wording / copy:**
  - DEV/COPY — **TOS gate** (test-buyer-2 login) shows **"Google Cloud Marketplace Terms of Service"** and **Privacy Policy** shows **"Walmart Global Marketplace Seller Privacy Notice"** — generic third-party legal boilerplate, not this app's legal terms. For a kids/parent marketplace this is confusing/inauthentic. Recommend replacing with the app's real Terms/Privacy content (or a clearly-flagged draft), and rewording to the app's own company/entity.
  - Same class as the disclaimer modal's Amazon "Commercial Liability Insurance" copy — **three separate legal surfaces show another company's boilerplate** (see §cross-cutting).
- **Design-system compliance:** PASS — disclaimer modal, alerts, and Trades screens use the pass-it-up palette (primary green `#5DBB8E`, neutral text). Stripe PaymentSheet is native (out of design-system scope). No palette deviations found.

### Locator-gap findings (B02)
- Offer-screen **"Add New Card"** control is a bare `Pressable` with no `testID`/`accessibilityRole` → not in the AX tree; located via OCR slicing. Recommend `testID="add-new-card-button"` (BP-53).
- Disclaimer modal AX exposure is inconsistent between presentations (see B01 finding).

---

## Findings (ranked)

1. **F2-1 — MOD (guide-vs-implementation): "2 consecutive expired offers" does not accumulate as a sequential streak.** The seller-ignore counter (`listing_offer_stats.unanswered_offer_count`) = **currently-pending offers on the listing**, not a streak of consecutive expiries. The F2 fix correctly stops expiry from *resetting* the counter to 0, but `rpc_process_expired_offers` still *decrements by 1 on each expiry* — so a single buyer's sequential offers net back to 0 (observed: 0→1→0 twice) and **never fire the prompt**. The prompt fires only when **2 offers are pending simultaneously** (count = 2 at processing), which — given the `DUPLICATE_OFFER` guard (one active offer per buyer+listing) — requires **2 different buyers** on the same listing. The guide's Step 4 ("repeat with a second consecutive unanswered offer on the same listing", same buyer) does **not** reproduce the prompt under the current implementation. **Recommend:** either (a) change the counter to a true consecutive-streak (don't decrement on expiry; add a separate "current pending" count), or (b) update the guide to describe the 2-offer/2-buyer scenario. The prompt mechanism itself is verified working (fires at count 2).
2. **F2-2 — MOD (copy): legal documents are placeholder third-party boilerplate.** Liability Disclaimer = Amazon "Commercial Liability Insurance Requirements"; Terms of Service = Google Cloud Marketplace TOS; Privacy Policy = Walmart Marketplace Seller Privacy Notice. A kids-marketplace parent reading these will see another company's terms. **Recommend** replacing with the app's actual legal content (or clearly-marked draft), at minimum before store submission.
3. **Minor — Free-tier buyers without a `subscriptions.stripe_customer_id` cannot submit cash offers** (`NO_STRIPE_CUSTOMER`). The card-add flow (SetupIntent) does create a customer+PM and backfills `subscriptions` (verified), so it is recoverable, but the first attempt fails with a confusing "No Stripe customer found. Please add a payment method first." — recommend surfacing the "Add a card" path proactively for free users, or creating a customer lazily at offer time.
4. **Minor — Copy:** "Offer Declined / The buyer has been notified." omits the guide's "Item stays listed" reassurance (listing is in fact kept available). Trade-success screen titled "Trade Complete" while body says "Trade Initiated!".
5. **Minor — Locator gaps:** offer-screen "Add New Card" not AX-exposed; disclaimer modal AX exposure inconsistent between presentations.

---

## Cross-cutting design-system / copy compliance

- Screens visited: Item Detail, Trade Offer, Disclaimer modal, Review Offer, Decline-confirm modal, Trade-success screen, Trades (Active/History), My Listings, ListingDetail, Login, Landing, Home, TOS gate, Privacy Policy. All used the pass-it-up palette (primary green `#5DBB8E`, neutral text, pill CTAs) with no palette deviations.
- Legal-copy problem spans 3 surfaces (see F2-2).

---

## App state left behind

- 4 disposable cancelled trades created this run (all cancelled, no pending state): `30eabfdf` (Basketball, `seller_declined`), `0febd389` + `edc627c8` (Remote Control Car, test-buyer, `Offer expired`), `a1bf0854` (Remote Control Car, test-buyer-2, `Offer expired`). Items Basketball + Remote Control Car remain `available`.
- test-buyer-2 gained a Stripe customer (`cus_V9nI4Dwd3xbwWU`) + PM (`pm_1U9Tjb4I6kCJlvXoDPsq9mHy`) + `subscriptions` backfill (free tier, status `free`) — left intact (harmless, test-mode).
- `listing_offer_stats` Remote Control Car: `unanswered_offer_count=0`, `last_prompt_sent_at=17:42:18` (prompt recorded — expected post-firing state). Basketball: count 0, no prompt.
- App left logged in as **test-buyer** on the Trades History tab. No simulator/keyboard state changes that persist.

## Suggested next session
- Reconcile the B02 guide narrative with the implementation (finding F2-1), then optionally re-run B02 against a fixed counter or guide.
- Consider a dedicated pass for the free-tier "no Stripe customer" offer path (finding 3).

---

## 📋 QA Session Handoff

**Test Scope:** TRD-TC-B01 + TRD-TC-B02 (MODULE-15.1.2 Group B) — history-placement re-verify against the updated guide.
**Design-System Compliance:** PASS — no palette/component deviations found on any visited screen or dialog (Item Detail, Trade Offer, Disclaimer modal, Review Offer, decline-confirm, Trade-success, Trades Active/History, ListingDetail, Login, Landing, Home, TOS gate, Privacy Policy).
**Perceived Load-Time Verdict:** GOOD — all observed transitions (offer submit, login, History tab switch, View Item navigation) rendered within the ideal UX threshold (<3s); no ≥3s screens flagged. (Dev-build cold relaunch ~5-10s bundle load excluded as an environment artifact.)
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Item Detail / Trade Offer / Review Offer / Decline-confirm modal / Trades Active+History / ListingDetail / Home / Login / Landing: wording and layout match design-system requirements.
- DEVIATION — Liability Disclaimer modal: body is Amazon "Commercial Liability Insurance" boilerplate, not this app's terms (copy).
- DEVIATION — Terms of Service gate: Google Cloud Marketplace TOS placeholder (copy).
- DEVIATION — Privacy Policy: Walmart Marketplace Seller Privacy Notice placeholder (copy).
- DEVIATION — Trade-success screen: title "Trade Complete" vs body "Trade Initiated!" (copy inconsistency).
- DEVIATION — Decline confirmation copy omits guide's "Item stays listed" reassurance (minor).
**Verdict Summary:** 2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED
**Critical Findings:**
- [MOD] B02 seller-ignore prompt semantics: counter = simultaneous pending offers, not a sequential streak; the guide's same-buyer "second consecutive offer" does not fire the prompt (F2 fix verified live, prompt fires at count 2 via 2 buyers). Guide/impl reconciliation recommended.
- [MOD] Legal documents (Disclaimer/TOS/Privacy) show other companies' placeholder boilerplate (Amazon/Google/Walmart).
- [MINOR] Free-tier buyers without `subscriptions.stripe_customer_id` hit `NO_STRIPE_CUSTOMER` on first cash offer (recoverable by adding a card).
- [MINOR] Copy: "Trade Complete" vs "Trade Initiated!"; decline copy omits "Item stays listed".
**App State Left Behind:** 4 cancelled disposable trades (no pending); items Basketball + Remote Control Car still `available`; test-buyer-2 now has a test-mode Stripe customer + PM (free tier); Remote Control Car `last_prompt_sent_at` set (expected); app logged in as test-buyer on Trades History.
**Why It Matters:** Proves the corrected history-placement behavior end-to-end on-device: declined/expired offers are correctly excluded from Active "Your Offers" and surface in History with a working View Item (B01 + B02), and the F2 seller-ignore prompt mechanism fires correctly (DB-proven at counter 2). B01's original PASS (under the old Active-tab expectation) is superseded by this fresh run against the corrected guide.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-trd-b01-b02-reverify-2026-08-28/screenshots/` (23 shots). Repro: submit offer as test-buyer → decline as test-seller (B01) or fast-clock expiry (B02) → check Trades → History for the cancelled row + View Item → tap through. Prompt: 2 pending offers on one listing → fast-clock both → `rpc_process_expired_offers` → observe `seller_ignore_prompt` + `last_prompt_sent_at`.
**Known Gaps / Not Tested:** 6h/1h reminder push content not re-driven this run (out of scope; previously covered). Real push delivery of the prompt banner not observable on the simulator (no real push token); prompt verified at the RPC/DB layer.
**What Needs To Be Fixed Next:**
- Fix: reconcile B02 guide wording with the implementation — decide whether the counter should be a true consecutive streak or the guide should describe the 2-simultaneous-offer scenario (F2-1); if a streak is intended, change `rpc_process_expired_offers`/counter so sequential expiries accumulate.
- Fix: replace the three placeholder legal documents (Disclaimer=Amazon, TOS=Google Cloud, Privacy=Walmart) with this app's real legal copy.
- Fix: surface a proactive "add a card" path (or lazy customer creation) for free-tier buyers so the first cash offer doesn't fail with `NO_STRIPE_CUSTOMER`.
- Fix: "Trade Complete" → "Trade Initiated" title on the offer-success screen; add "Item stays listed" to the decline confirmation.
- Fix (instrumentation): add `testID`/`accessible` to offer-screen "Add New Card" (`add-new-card-button`) and make the Disclaimer modal controls consistently AX-exposed.
**UX Enhancement Ideas (optional, not defects):** None this run — no friction or enhancement opportunities observed beyond what's already noted above.
**Suggested Next Session:** B02 guide/implementation reconciliation (F2-1), then a focused re-run of the seller-ignore prompt on the reconciled semantics; optionally verify the free-tier "add a card" offer path (finding 3).
**Suggested to Improve Agent Rules:** Consider recording the disclaimer-modal AX-exposure inconsistency (native-window separation sometimes surfaces only the close button, sometimes the full modal) as a per-build known-drivability entry in the §5.31 list, and pre-checking whether a 2nd buyer persona has `subscriptions.stripe_customer_id` before staging multi-buyer offers.
