# MODULE-15.1.2 TradeFlowV2 — Manual Testing Guide

**Source of truth:** `docx/TRADING-FLOW-V2.md` (v2.1, May 26 2026) · `Prompts/MODULE-15.2-cart-system.md` · `Prompts/MODULE-15.3-PART3-TAX-TASKS-RESTRUCTURED.md` · `Prompts/Done/MODULE-08-REVIEWS-RATINGS.md` · `docs/flow-registry.md` (FLOW-27)
**Tasks covered:** Core Trade Flows · Payment Authorization · SP Behavior · Dispute Flow · Payout · Countdown Timers · Notifications · Completion CTAs · Safety UX · Seller Consequences · Bundle Flows · Cart System · Sales Tax Engine · Reviews & Ratings · Refund & Cancellation State Machine · Top Nav Header Patterns
**Last updated:** 2026-07-30
**Scope:** End-user manual testing via app screens + admin portal screens (no SQL / no DB access required)
**Devices:** iOS Simulator + Android Emulator · Admin portal in browser

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Core Happy Paths** | TC-A01 | Cash Only: full happy path (buyer confirms) |
| | TC-A02 | Accept SP: Use SP slider → seller accepts → buyer confirms |
| | TC-A03 | Accept SP: Pay Cash (0 SP) — subscriber seller still earns SP |
| | TC-A04 | Donate listing: [Claim] button, no charge |
| **B — Offer Lifecycle** | TC-B01 | Seller declines offer |
| | TC-B02 | Offer expires (seller never responds) + seller ignore prompt |
| | TC-B03 | Multiple competing offers — sort order + auto-decline |
| | TC-B04 | Buyer cancels pending trade — no consequence level |
| | TC-B05 | Max 3 pending offers enforced |
| | TC-B06 | Card declined at offer submission |
| **C — SP Behavior** | TC-C01 | SP reserved on offer submission |
| | TC-C02 | SP restored to buyer on seller decline |
| | TC-C03 | SP restored to buyer on offer expiry |
| | TC-C04 | SP stays reserved when seller accepts |
| | TC-C05 | SP released to seller at trade completion |
| | TC-C06 | SP restored to buyer on seller cancel (in_progress) |
| | TC-C07 | Free user sees locked Use SP button + upgrade modal |
| | TC-C08 | SP slider capped at 50% of item price |
| **D — Auto-Complete & Timers** | TC-D01 | Auto-complete when buyer never taps I Got It |
| | TC-D02 | Auto-complete skipped + banner hidden when dispute is open |
| | TC-D03 | Offer countdown pill color states |
| | TC-D04 | Auto-complete banner visible to buyer only |
| | TC-D05 | Post-meetup nudge after auto-complete |
| **E — Dispute Flow** | TC-E01 | Buyer opens Report a Problem modal (open-dispute EF + admin queue) |
| | TC-E02 | Disputed trade does not auto-complete or release SP |
| | TC-E03 | Buyer UI during active dispute — buttons hidden, second report blocked |
| | TC-E04 | Seller UI during active dispute |
| | TC-E05 | Admin resolves dispute → Complete |
| | TC-E06 | Admin resolves dispute → Refund |
| **F — Payout** | TC-F01 | Payout shown on completion (no dispute) |
| | TC-F02 | Payout held when dispute is open |
| | TC-F03 | Payout needs action when seller has no payout method |
| **G — Notifications** | TC-G01 | Offer expiry reminders to seller |
| | TC-G02 | Auto-complete reminders to buyer |
| | TC-G03 | Notification throttle per trade |
| | TC-G04 | Push notifications deep-link to correct screen |
| **H — Completion CTAs** | TC-H01 | Free buyer sees subscription CTA |
| | TC-H02 | Subscriber buyer used SP — "You saved $X" |
| | TC-H03 | Subscriber seller on Accept SP listing — SP pending notice |
| | TC-H04 | Subscriber seller on Cash Only listing — upsell |
| **I — Safety UX** | TC-I01 | Safe meetup card on in_progress trade |
| | TC-I02 | Safe meetup card dismissible per trade |
| | TC-I03 | In-chat safety banner persistent |
| | TC-I04 | Pre-first-message safety modal once per listing |
| | TC-I05 | Chat quick-reply chips on in_progress trade |
| **J — Seller Cancel Consequences** | TC-J01 | Seller cancels in_progress trade → Level 1 |
| | TC-J02 | 2nd post-acceptance cancel → Level 2 |
| | TC-J03 | 3rd post-acceptance cancel → Level 3 |
| | TC-J04 | Seller cancel button only on in_progress |
| | TC-J05 | Seller cancel modal shows seller reasons only |
| **K — Value Stack & Fees** | TC-K01 | Subscriber sees $0.99 fee in value stack |
| | TC-K02 | Non-subscriber sees $2.99 fee in value stack |
| | TC-K03 | SP discount row conditional on SP used |
| | **TC-K04** | **Bundle checkout — fee charged per item (admin toggle OFF)** |
| | **TC-K05** | **Bundle checkout — one fee per bundle (admin toggle ON)** |
| | **TC-K06** | **Bundle timeline — fee display matches charge mode** |
| | **TC-K07** | **Admin partial refund — refund price only, keep fee** |
| | **TC-K08** | **Admin partial refund — tax ledger partially refunded** |
| | **TC-K09** | **Payments reconciliation page — charged vs refunded per trade** |
| | **TC-K10** | **Server-side enforcement — one-fee-per-bundle with stale client** |
| **L — Bundle Flows** | TC-L01 | Bundle banner on trade detail |
| | TC-L02 | Confirm All shortcut for bundle (buyer) |
| | TC-L03 | Bundle offer rows in Offers tab (seller) |
| | TC-L04 | Non-bundle offers render as single rows |
| | TC-L05 | In-progress bundles section in Buying tab |
| | TC-L06 | Bundle banner in Review Offer screen |
| | TC-L07 | Accept All N Items in Review Offer screen |
| | TC-L08 | Individual accept/decline alongside bundle siblings |
| | **TC-L09** | **Bundle card in Your Offers (buyer)** |
| **M — Cart (End User)** | TC-M01 | Add first item → active cart created |
| | TC-M02 | Add second item from same seller |
| | TC-M03 | Add item from different seller → choice modal |
| | TC-M04 | Replace Cart option |
| | TC-M05 | Cannot add own item to cart |
| | TC-M06 | Cannot add unavailable / out-of-node item |
| | TC-M07 | Duplicate item prevented in same cart |
| | TC-M08 | Remove item from cart |
| | TC-M09 | Clear cart |
| | TC-M10 | Saved carts: max 3, LRU eviction, switch cart |
| | TC-M11 | Minimum cart value warning + checkout blocked |
| | TC-M12 | Max SP available shown per cart item (subscriber) |
| | TC-M13 | Realtime: item becomes unavailable while in cart |
| | TC-M14 | Favorites add / remove |
| | TC-M15 | Favorites screen: availability + empty state |
| | **TC-M16** | **Success toast appears and auto-dismisses on add-to-cart** |
| | **TC-M17** | **Cart badge increments in sync with toast** |
| | **TC-M18** | **Toast copy uses "Trade Basket" terminology** |
| | **TC-M19** | **Home dashboard Favorites quick-action tile navigates to Favorites** |
| | **TC-M20** | **Discover header heart icon navigates to Favorites** |
| **N — Cart (Admin)** | TC-N01 | Admin sets minimum cart value → reflects in app |
| | TC-N02 | Admin minimum cart value validation |
| **O — Tax (End User)** | TC-O01 | Sales tax shown in checkout/cart breakdown (0 SP) |
| | TC-O02 | Tax recalculates on SP slider change (tax base unchanged — BP-37) |
| | TC-O03 | Tax $0 when globally disabled |
| | TC-O04 | Tax $0 when node tax disabled |
| | TC-O05 | Tax-exempt user sees Tax Free badge (deferred) |
| | TC-O06 | Transaction history shows tax details |
| | TC-O07 | Refund shows proportional tax refunded (deferred) |
| | **TC-O08** | **Tax shown on trade timeline for buyer only (hidden from seller)** |
| **O-1 — Tax Categories (Admin Config)** | TC-O1-C01 | Admin creates a new tax rule for general_tangible_goods |
| | TC-O1-C02 | Second rule for same category — overlap blocked |
| | TC-O1-C03 | Admin edits existing rule — new version created |
| | TC-O1-C04 | Admin deactivates a rule |
| | TC-O1-C05 | Existing listings backfill to general_tangible_goods |
| | TC-O1-C06 | New single-listing creation receives default tax category |
| | TC-O1-C07 | New bulk-listing creation receives default tax category |
| | TC-O1-C08 | Admin changes an individual listing's tax category |
| | TC-O1-C09 | Tax-exempt category configuration (is_taxable = false) |
| | TC-O1-C10 | Price-threshold category configuration (clothing_footwear) |
| | TC-O1-C11 | Fee-in-tax-base toggle on and off |
| | TC-O1-C12 | Unauthorized user cannot view/edit tax config (deferred) |
| | TC-O1-C13 | Audit trail shows actor, timestamp, before/after values |
| | TC-O1-C14 | Admin views/edits category → tax-category mapping |
| | TC-O1-C15 | Category mapping change affects new listings immediately |
| | TC-O1-C16 | Admin cannot map to non-existent/inactive tax category |
| | TC-O1-C17 | Admin filters tax rules by active/inactive status |
| **O-2 — Tax Status Lifecycle** | TC-O2-C01 | Single taxable item, no SP — offer quoted/authorized, not collected |
| | TC-O2-C02 | Bundle with taxable, exempt, threshold items — line-level tax correct |
| | TC-O2-C03 | Platform-fee tax toggle off/on — tax base changes by fee amount |
| | TC-O2-C04 | SP used — taxable base unchanged, card auth reflects SP tender |
| | TC-O2-C05 | Seller accepts — tax remains quoted/authorized, not collected |
| | TC-O2-C06 | Buyer cancels (Awaiting Seller) — PI canceled, tax voided, SP released once |
| | TC-O2-C07 | Seller declines / offer expiry — PI canceled, tax voided |
| | TC-O2-C08 | Buyer completes successfully — capture succeeds, tax collected |
| | TC-O2-C09 | Auto-complete after 48h — capture succeeds, tax collected |
| | TC-O2-C10 | Capture failure — no payout, no collected tax, recovery state visible |
| | TC-O2-C11 | Duplicate webhook/retry — no duplicate tax collection/payout/SP event |
| | TC-O2-C12 | Historical/backfill records — never falsely marked as collected |
| **O-3 — Tax Refund & Reconciliation** | TC-O3-C01 | Buyer wording "Payment authorized" before capture (Awaiting Seller) |
| | TC-O3-C02 | Buyer wording "Payment authorized" after seller accept (In Progress) |
| | TC-O3-C03 | Buyer wording "Paid" after successful capture (Completed) |
| | TC-O3-C04 | Capture failure shows "payment could not be completed" |
| | TC-O3-C05 | Admin dispute → full refund with Stripe + tax reversal (captured trade) |
| | TC-O3-C06 | Duplicate refund/retry is idempotent |
| | TC-O3-C07 | Admin dispute → uncaptured PI is cancelled (not refunded) |
| | TC-O3-C08 | Admin dispute → Stripe refund failure stays unresolved |
| | TC-O3-C09 | Stripe refund pending → tax pending_refund |
| | TC-O3-C10 | Report: newly submitted offer → Pending/Authorized Tax |
| | TC-O3-C11 | Report: captured trade → Tax Collected using capture timestamp |
| | TC-O3-C12 | Report: cancelled/declined/expired → Voided/Expired Tax, not collected |
| | TC-O3-C13 | Report: refunded trade → Tax Refunded, Net adjusts |
| | TC-O3-C14 | Report: CSV totals match on-screen totals |
| **P — Tax (Admin)** | TC-P01 | Node tax rate config (view/edit, validation) |
| | TC-P02 | Bulk tax update across nodes |
| | TC-P03 | Tax rate change history / audit |
| | TC-P04 | Global tax settings toggle + warning banner |
| | TC-P05 | Tax reporting dashboard: summary + date presets |
| | TC-P06 | Jurisdiction breakdown + 7 report types |
| | TC-P07 | CSV export for filing |
| | TC-P08 | Admin changes rate → new transactions use new rate |
| **Q — Reviews & Ratings** | TC-Q01 | Review prompt ([Rate Seller] / [Rate Buyer]) on completion |
| | TC-Q02 | Star rating required — submit blocked without rating |
| | TC-Q03 | Comment optional, max 500 characters |
| | TC-Q04 | Anonymous review hides reviewer identity |
| | TC-Q05 | Skip review — no blocking, no re-prompt for same trade |
| | TC-Q06 | Mutual review status shown on completed trade detail |
| | TC-Q07 | Completed reviews visible on counterparty's profile |
| | TC-Q08 | Average rating and total review count on user profile |
| | TC-Q09 | Rating breakdown (5 → 1 stars) on profile |
| | TC-Q10 | Edit review succeeds within 24h window |
| | TC-Q11 | Edit blocked after 24h window |
| | TC-Q12 | One review per trade — duplicate submission blocked |
| | TC-Q13 | 30-day same-counterparty cooldown enforced |
| | TC-Q14 | 24h post-completion cooldown — review locked |
| | TC-Q15 | Flag a review (select reason) |
| | TC-Q16 | Auto-hide review after 3+ reports |
| | TC-Q17 | Cannot flag own review |
| | TC-Q18 | Admin moderation queue — reported reviews with counts |
| | TC-Q19 | Admin approves (unhides) a reported review |
| | TC-Q20 | Admin deletes a reported review |
| **R — Refund & Cancellation State Machine** | TC-R01 | Buyer cancels pending trade → cancelled, auth voided, SP restored |
| | TC-R02 | Seller declines pending offer → cancelled, SP restored |
| | TC-R03 | Offer expiry → auto-cancel + competing offers cancelled |
| | TC-R04 | Card declined at offer submission → no trade created |
| | TC-R05 | Seller cancels in_progress → refund + consequence (cancel_trade_v2 RPC fixed) |
| | TC-R06 | Refund settlement breakdown (cash + proportional tax + fee) |
| | TC-R07 | SP reversal on refund (reserved/transferred returned) |
| | TC-R08 | Seller payout withheld / cancelled on refund |
| | TC-R09 | Admin dispute resolve → Refund (full settlement) |
| | TC-R10 | Admin dispute resolve → Complete (no refund) |
| | TC-R11 | Refund / cancellation notifications to both parties |
| | TC-R12 | Refund idempotency — no double refund |
| | TC-R13 | Cancelled / refunded trade status + timeline |
| **S — Navigation Consistency** | TC-S01 | Bottom nav renders identically on Home |
| | TC-S02 | Bottom nav renders identically on Discover |
| | TC-S03 | Bottom nav renders identically on Inbox |
| | TC-S04 | Bottom nav renders identically on Cart |
| | TC-S05 | Bottom nav renders on Item Detail (stacked) |
| | TC-S06 | Bottom nav renders on Cart Checkout (stacked) |
| | TC-S07 | Bottom nav renders on Trade screens |
| | TC-S08 | Bottom nav renders on Profile/Settings/Wallet |
| | TC-S09 | Cart badge shows item count from multiple entry points |
| | TC-S10 | Cart badge count accuracy — add multiple items |
| | TC-S11 | Cart badge count accuracy — remove items |
| | TC-S12 | Cart badge clears when cart is emptied |
| | TC-S13 | "Me" tab removed — Profile via Home avatar works |
| | TC-S14 | "Me" tab removal — no orphaned routes |
| | TC-S15 | Sell FAB opens action sheet on every screen |
| **S — More From This Seller** | TC-S16 | Item Detail CTA in standalone position below seller card |
| | TC-S17 | Item Detail CTA hidden at 0 additional listings |
| | TC-S18 | Item Detail CTA does not disrupt "Matches Your Cart" badge |
| | TC-S19 | Trade Basket banner shows correct remaining-item count |
| | TC-S20 | Trade Basket banner recalculates after adding item from filtered page |
| | TC-S21 | Trade Basket banner disappears when all seller's listings are in basket |
| | TC-S22 | Trade Basket banner dismissible via X button |
| | TC-S23 | Banner and filtered page never reveal seller identity |
| | TC-S24 | Regression: Seller Info card elements unchanged |
| | TC-S25 | Regression: Trade Basket subtotal/total/bundle CTA layout unaffected |
| | TC-S26 | Return-to-Cart navigation after adding item from filtered page |
| **T — Flow Registry (Nav)** | TC-T01 | flow-registry.md entries updated
| **U — Top Nav Header Consistency** | TC-U01 | Root/tab screens use pattern 1 (no back button, greeting/avatar or title, notification bell) |
| | TC-U02 | Secondary/detail screens use pattern 2 (back button + title + notification bell) |
| | TC-U03 | Notification bell behavior + badge accuracy across all screens |
| | TC-U04 | Screens without ScreenLayout (EditListing, SubmitReview) now have working headers |
| | TC-U05 | Checkout/payment screens intentionally hide the bell (DEFERRED-DECISION documented) | |
| **V — Copy Rename Verification** | TC-V01 | "Trade Basket" appears in bottom tab bar |
| | TC-V02 | "Trade Basket" appears as screen title on Cart screen |
| | TC-V03 | Empty state shows "trade basket" in copy |
| | TC-V04 | "View Trade Basket" button on Item Detail screen |
| | TC-V05 | "Add to Trade Basket" button on More from This Seller screen |
| | TC-V06 | "In Trade Basket" status on More from This Seller items already in basket |
| | TC-V07 | "Added to Trade Basket" toast on item add (replaces old blocking alert) |
| | TC-V08 | "Matches Your Trade Basket" badge on matching items |
| | TC-V09 | Different-seller modal references "trade basket" |
| | TC-V10 | Bundle CTA says "Make one offer" (no "Bundle" visible) |
| | TC-V11 | "Combined Offer" banner on checkout (no "Bundle" visible) |
| | TC-V12 | Bundle Builder screen title shows "Build Offer" (no "Bundle" visible) |
| | TC-V13 | Favorites "Added to Trade Basket" alert copy |
| | TC-V14 | Functional behavior unchanged (adding items, submitting offers still works) |
| **W — Admin Bundle Trade Views** | TC-W01 | Trades page has "Single Trades" and "Bundle Trades" tabs |
| | TC-W02 | Single Trades tab shows only non-bundle trades |
| | TC-W03 | Bundle Trades tab groups trades by bundle_id |
| | TC-W04 | Bundle row shows item count, total amounts, buyer/seller, statuses |
| | TC-W05 | Clicking a bundle row navigates to bundle detail page |
| | TC-W06 | Bundle detail page lists all trades in the bundle |
| | TC-W07 | Bundle detail page shows monetary breakdown (cash + SP + fees totals) |
| | TC-W08 | Each trade row in bundle detail links to individual trade detail |
| | TC-W09 | Bundle detail page has "Force Cancel Entire Bundle" action |
| | TC-W10 | Force Cancel succeeds for all non-terminal trades in the bundle |
| | TC-W11 | Status filter works in Bundle Trades view |
| | TC-W12 | Tab toggle resets filters when switching views | |

---

## Pre-conditions (set up before testing)

- App is running on iOS Simulator and/or Android Emulator.
- The following test accounts exist and are confirmed (see Accounts table).
- test-seller has at least one **Cash Only** listing, one **Accept SP** listing, and one **Donate** listing, all available.
- test-buyer (subscriber) has a Swap Points balance of at least 15 SP.
- test-buyer and test-free have a valid saved payment card.
- For cart tests: test-seller has at least 3 available items; a second seller (test-seller-2) has at least 1 available item in the same node as test-buyer.
- For tax tests: the buyer's node has a tax rate configured (e.g., 6.35%) and sales tax is enabled globally, unless a case states otherwise. Admin portal access is available for admin-side cases.

## Accounts for testing

| Role | Email | Subscription | Notes |
|---|---|---|---|
| Seller | test-seller@kidsmarketplace.test | Kids Club+ Active | Must be subscriber to offer Accept SP / Donate listings |
| Buyer (subscriber) | test-buyer@kidsmarketplace.test | Kids Club+ Active | Must have SP ≥ 15 |
| Buyer (free) | test-free@kidsmarketplace.test | None | Cannot use SP |
| Admin | test-admin@kidsmarketplace.test | — | Required for dispute resolution test cases |

> Timer-based cases (offer expiry, auto-complete, scheduled reminders) require QA to fast-forward the relevant clock in the test environment. The steps below describe what the end user sees once that time is reached.

---

## Group A — Core Happy Paths

### TC-A01 · Cash Only: full happy path (buyer confirms receipt)

**Ref:** TRADING-FLOW-V2 §7 Scenario S1, D-30, TFV2-012A, TFV2-014
**Actors:** test-buyer (subscriber) + test-seller (subscriber)

**Objective:** Verify a cash-only trade flows from offer submission through seller acceptance to buyer confirmation and completion — including D-30 Stripe pre-auth hold and capture.

**Steps:**
1. Log in as **Buyer** and open a Cash Only item from **Seller**.
2. Tap **[Request to Buy]**, review the offer preview, then tap **[Submit Offer]**.
3. Verify the Stripe pre-auth hold was placed (check Stripe dashboard for a `requires_capture` PaymentIntent for this trade).
4. Log in as **Seller**, open the **Offers** tab, and tap the new offer row.
5. On the Review Offer screen, tap **[Accept]**.
6. Verify the Stripe PaymentIntent was captured (`succeeded` status in Stripe dashboard).
7. Log in as **Buyer**, open the trade from **Trades → Buying**.
8. Tap **[I Got It]**, then tap **[Confirm]** on the confirmation prompt.

**Expected Result:**
- On the item: a "Cash Only" badge and a single **[Request to Buy]** button (no "Use SP" button).
- After submitting: a confirmation toast and the trade appears as **Pending**; the seller receives a push notification.
- A Stripe PaymentIntent with `capture_method: 'manual'` exists for the trade in `requires_capture` status (D-30 pre-auth hold). The buyer's card is NOT charged yet.
- The seller's offer row shows the item, cash amount, and a green countdown pill.
- After the seller accepts: the Stripe PaymentIntent transitions from `requires_capture` → `succeeded` (captured). The trade moves to **In Progress** with `auto_complete_at` set from admin config. Buyer sees an auto-complete banner ("Auto-completing in ~47h") and **[I Got It]** + **[Report a Problem]** buttons. The seller does **not** see an [I Got It] button or the auto-complete banner; instead sees safe-meetup card.
- After the buyer confirms: the trade shows as **Completed**, the buyer sees a "Trade Complete!" screen with a subscriber-appropriate CTA (e.g., "Trade complete! Consider using SP on your next purchase to save more." with **[Browse Items]**) and a **[Rate Seller]** text link. The seller sees their completion screen with appropriate CTA (e.g., "Sold for cash! Try 'Accept SP' on your next listing to also earn SP." with **[Create New Listing]**) and a **[Rate Buyer]** text link.

---

### TC-A02 · Accept SP: Use SP slider → seller accepts → buyer confirms

**Ref:** TRADING-FLOW-V2 §7 Scenario S5, §4.4, §10, D-30
**Actors:** test-buyer (subscriber, SP ≥ 15) + test-seller (subscriber)

**Objective:** Verify a subscriber buyer can apply Swap Points to an Accept SP listing and complete the full SP happy path with D-30 Stripe pre-auth.

**Steps:**
1. Log in as **Buyer** and open an **Accept SP** item priced at $30.
2. Tap **[Use SP]** to open the offer screen with the SP slider.
3. Move the slider to **$8 SP** and review the breakdown.
4. Try to push the slider beyond 50% of the price ($15).
5. Tap **[Submit Offer]**.
6. Verify a Stripe PaymentIntent with `capture_method: 'manual'` exists in `requires_capture` status (D-30 pre-auth hold).
7. Log in as **Seller**, open the **Offers** tab, tap the offer, and tap **[Accept]**.
8. Verify the Stripe PaymentIntent was captured (`succeeded` status).
9. Log in as **Buyer**, open the trade, tap **[I Got It]**, then **[Confirm]**.

**Expected Result:**
- The item shows an "Accept SP" badge with two buttons: **[Request to Buy]** and **[Use SP]**.
- The slider ranges from 0 to $15 (50% of $30); at $8 it shows "$22 cash + 8 SP = $30 total", platform fee $0.99 (subscriber), and total cash $22.99.
- The slider clamps at $15 and refuses any higher value.
- After submitting: the buyer's wallet shows 8 SP moved from available to reserved. A Stripe PaymentIntent exists in `requires_capture` status — card is NOT charged yet (D-30).
- The seller's offer row shows "$22 cash + 8 SP — Total: $30"; the Review screen shows the combined SP releasing at completion.
- After the seller accepts: the Stripe PaymentIntent transitions from `requires_capture` → `succeeded` (captured). The trade moves to **In Progress** with `auto_complete_at` set. The buyer's SP stays reserved (not yet transferred to the seller).
- After the buyer confirms: the trade completes; the buyer sees "Got it! You saved $8 using SP." with remaining SP balance and **[Keep Shopping]** button; the seller's completion screen shows the SP (buyer 8 SP + platform reward) added to their pending wallet with a [View Wallet] button; the buyer's reserved SP returns to 0.

---

### TC-A03 · Accept SP listing: buyer pays cash (0 SP) — subscriber seller still earns SP

**Ref:** TRADING-FLOW-V2 §7 Scenario S4
**Actors:** test-buyer (subscriber) + test-seller (subscriber)

**Objective:** Verify that an Accept SP listing paid fully in cash still grants the seller platform SP, with no buyer SP used.

**Steps:**
1. Log in as **Buyer** and open an **Accept SP** listing.
2. Tap **[Request to Buy]** (do not use the SP slider) and submit the offer.
3. Log in as **Seller** and accept the offer.
4. Log in as **Buyer**, open the trade, and tap **[I Got It]** → **[Confirm]**.

**Expected Result:**
- The offer preview shows "$[price] cash, 0 SP" and no SP is reserved from the buyer.
- The seller is charged the full cash amount.
- After completion, the seller's completion screen shows the platform SP reward added to their pending wallet ("[platform_sp] SP releasing in [N] days (platform reward)") with a [View Wallet] button; no buyer SP is involved.

---

### TC-A04 · Donate listing: [Claim] button, no charge

**Ref:** TRADING-FLOW-V2 §4.2
**Actors:** Any buyer + test-seller

**Objective:** Verify a donate listing can be claimed with no payment and no SP.

**Steps:**
1. Log in as **Buyer** and open a **Donate** listing.
2. Tap **[Claim]**.
3. Open the trade and complete it through the normal timeline flow.

**Expected Result:**
- Only a **[Claim]** button is shown (no "Request to Buy", no "Use SP").
- No payment is taken and no card is charged.
- The trade follows the same timeline; no SP is earned because there is no cash transaction.

---

## Group B — Offer Lifecycle

### TC-B01 · Seller declines offer

**Ref:** TRADING-FLOW-V2 §7 Scenario S2, D-30
**Actors:** test-buyer + test-seller

**Objective:** Verify a seller can decline an offer and the item stays listed, restoring any reserved SP to the buyer and releasing the Stripe pre-auth hold.

**Steps:**
1. Log in as **Buyer** and submit an offer (any type) on a listing.
2. Note the Stripe PaymentIntent ID (from Stripe dashboard — should be in `requires_capture` status).
3. Log in as **Seller**, open the offer in the Review screen, and tap **[Decline]**.
4. Verify the Stripe PaymentIntent was cancelled (status `canceled` in Stripe dashboard).
5. Log in as **Buyer** and open the **Offers** tab.

**Expected Result:**
- The seller sees a confirmation "Offer declined. Item stays listed." and the offer row is removed/marked declined; the listing stays available.
- The Stripe PaymentIntent transitions from `requires_capture` → `canceled` — the pre-auth hold is released and the buyer's card is NOT charged (D-30).
- The buyer's Offers tab shows "Declined — [Item] still available" with a [View Item Again] button.
- If the buyer used SP, that SP is restored from reserved back to available.

---

### TC-B02 · Offer expires (seller never responds) + seller ignore prompt

**Ref:** TRADING-FLOW-V2 §7 Scenario S3, §9.2, §11.8, D-30
**Actors:** test-buyer + test-seller
**Precondition:** QA fast-forwards the 24h offer clock past expiry for this trade.

**Objective:** Verify an unanswered offer auto-cancels at expiry, releases Stripe auth, restores buyer SP, and prompts a repeatedly-ignoring seller to pause the listing.

**Steps:**
1. Log in as **Buyer** and submit an offer; note the 24h countdown starts.
2. Note the Stripe PaymentIntent ID (in `requires_capture` status).
3. Allow the offer to reach its expiry without the seller responding.
4. Verify the Stripe PaymentIntent was cancelled (`canceled` status).
5. Log in as **Buyer** and open the **Offers** tab.
6. Repeat with a second consecutive unanswered offer on the same listing.
7. Log in as **Seller** and check push notifications.

**Expected Result:**
- At expiry the trade auto-cancels; the Stripe PaymentIntent transitions from `requires_capture` → `canceled` (auth hold released, card NOT charged).
- The buyer's reserved SP (if any) is restored.
- The buyer's Offers tab shows "Expired — [Item] still available" with a [View Item Again] button.
- Before expiry, the seller receives reminder pushes at roughly 6 hours and 1 hour before the offer expires.
- After a second consecutive unanswered offer, the seller receives: "You're receiving offers but not responding on [Item]. Want to pause this listing?" with [Pause Listing] and [Dismiss].

---

### TC-B03 · Multiple competing offers — sort order + auto-decline on acceptance

**Ref:** TRADING-FLOW-V2 §7 Scenario S6
**Actors:** 3 buyers + test-seller
**Precondition:** Three buyers have pending offers on the same listing — A: $22 cash + 8 SP, B: $28 cash + 2 SP, C: $30 cash + 0 SP (all total $30).

**Objective:** Verify competing offers are sorted correctly and that accepting one auto-declines the others, restoring their SP.

**Steps:**
1. Log in as **Seller** and open the **Offers** tab for that listing.
2. Review the order of the three offer rows.
3. Tap Buyer B's offer and tap **[Accept]**.
4. Log in as **Buyer A** and **Buyer C** and check the **Offers** tab.

**Expected Result:**
- The three offers are sorted by total value descending, then by highest cash, then earliest submission — so B is shown first, then C, then A.
- Accepting B charges Buyer B and moves their trade forward; Buyers A and C are auto-declined.
- Buyers A and C each see "Declined — item no longer available" with a [Browse Similar] button, and any SP they reserved is restored.

---

### TC-B04 · Buyer cancels pending trade — no consequence level

**Ref:** TRADING-FLOW-V2 §11.7, D-30
**Actors:** test-buyer

**Objective:** Verify a buyer can cancel a pending trade, releasing the Stripe auth hold, without triggering any seller-style consequence warning.

**Steps:**
1. Log in as **Buyer** and open a **pending** trade from **Trades → Buying**.
2. Note the Stripe PaymentIntent ID for the trade (in `requires_capture` status).
3. Tap **[Cancel Trade]**.
4. Select a reason and confirm.
5. Verify the Stripe PaymentIntent was cancelled (`canceled` status).

**Expected Result:**
- A cancellation reason modal with standard buyer reasons appears.
- After confirming, a generic "Trade Cancelled" message appears with **no** Level 1/2/3 consequence text.
- Any SP reserved by the buyer is restored.
- The Stripe PaymentIntent transitions from `requires_capture` → `canceled` — the pre-auth hold is released, card NOT charged (D-30).

---

### TC-B05 · Max 3 pending offers enforced

**Ref:** TRADING-FLOW-V2 §4.3
**Actors:** test-buyer
**Precondition:** test-buyer already has 3 pending offers on different listings.

**Objective:** Verify a buyer cannot have more than 3 pending offers at once.

**Steps:**
1. Log in as **Buyer** and try to submit a 4th offer on a new listing.
2. Cancel one existing pending offer.
3. Submit the offer again.

**Expected Result:**
- The 4th submission is rejected with: "You have 3 pending offers. Cancel one to make a new offer." and no new offer is created.
- After cancelling one offer, the new offer submits successfully.

---

### TC-B06 · Card declined at offer submission

**Ref:** TRADING-FLOW-V2 §4.3, D-30
**Actors:** test-buyer
**Precondition:** Buyer's saved card is a declining test card.

**Objective:** Verify offer submission fails cleanly when the Stripe pre-authorization is declined — no trade, no SP hold, no charge.

**Steps:**
1. Log in as **Buyer** with a declining card and attempt to submit an offer.
2. Verify no Stripe PaymentIntent was created (check Stripe dashboard).
3. Update to a valid card and retry.
4. Verify a Stripe PaymentIntent with `capture_method: 'manual'` is created in `requires_capture` status.

**Expected Result:**
- Submission fails immediately with: "Payment method declined. Please update your card."; no pending offer is created, no SP is reserved, and no Stripe PaymentIntent exists (D-30 atomicity: if Stripe auth fails, nothing is created).
- After switching to a valid card, the offer submits successfully. A Stripe PaymentIntent with `capture_method: 'manual'` is created in `requires_capture` status — card is NOT charged yet (D-30 pre-auth hold).

---

## Group C — SP Behavior

### TC-C01 · SP reserved on offer submission

**Ref:** TRADING-FLOW-V2 §4.4, §10.1
**Actors:** test-buyer (subscriber)

**Objective:** Verify Swap Points used in an offer are moved from available to reserved at submission time.

**Steps:**
1. Log in as **Buyer** and note the available SP balance in the wallet.
2. Submit an offer using 8 SP.
3. Open the SP wallet again.

**Expected Result:**
- The available SP balance decreases by 8 and the reserved/pending-hold amount increases by 8 immediately after submission.

---

### TC-C02 · SP restored to buyer on seller decline

**Ref:** TRADING-FLOW-V2 §10.1
**Actors:** test-buyer (subscriber) + test-seller

**Objective:** Verify reserved SP returns to the buyer when the seller declines.

**Steps:**
1. Log in as **Buyer** and submit an offer using 8 SP.
2. Log in as **Seller** and decline the offer.
3. Log in as **Buyer** and open the SP wallet.

**Expected Result:**
- The buyer's available SP returns to its original value and the reserved amount drops back accordingly.

---

### TC-C03 · SP restored to buyer on offer expiry

**Ref:** TRADING-FLOW-V2 §10.1
**Actors:** test-buyer (subscriber)
**Precondition:** QA fast-forwards the offer clock past expiry.

**Objective:** Verify reserved SP returns to the buyer when an offer expires unanswered.

**Steps:**
1. Log in as **Buyer** and submit an offer using 8 SP.
2. Allow the offer to expire.
3. Open the SP wallet.

**Expected Result:**
- After expiry, the buyer's SP is fully restored to available and the reserved amount returns to zero.

---

### TC-C04 · SP stays reserved (not transferred) when seller accepts

**Ref:** TRADING-FLOW-V2 §10.1
**Actors:** test-buyer (subscriber) + test-seller

**Objective:** Verify accepting an offer does not yet move SP to the seller.

**Steps:**
1. Log in as **Buyer** and submit an offer using 8 SP.
2. Log in as **Seller** and accept it.
3. Check the buyer's wallet and the seller's wallet immediately after acceptance.

**Expected Result:**
- The buyer's 8 SP remain in reserved (not returned, not transferred).
- The seller's pending SP is unchanged — no SP has moved to the seller yet.

---

### TC-C05 · SP released to seller at trade completion

**Ref:** TRADING-FLOW-V2 §10.2
**Actors:** test-buyer (subscriber) + test-seller (subscriber)

**Objective:** Verify the buyer's SP plus the platform reward are credited to the seller in one step at completion.

**Steps:**
1. Complete a trade that used 8 buyer SP on a $30 item (buyer taps [I Got It] → [Confirm]).
2. Check the seller's SP wallet.
3. Check the buyer's SP wallet.

**Expected Result:**
- The seller's pending SP increases by the buyer's 8 SP plus the platform reward in a single update (not two separate credits).
- The buyer's reserved SP returns to zero.

---

### TC-C06 · SP restored to buyer when seller cancels in_progress trade

**Ref:** TRADING-FLOW-V2 §10.1
**Actors:** test-buyer (subscriber) + test-seller

**Objective:** Verify a seller cancellation after acceptance refunds the buyer's reserved SP.

**Steps:**
1. Reach an **In Progress** trade where the buyer used SP.
2. Log in as **Seller** and cancel the trade.
3. Check the buyer's wallet and the seller's wallet.

**Expected Result:**
- The buyer's reserved SP is restored to available.
- The seller's wallet shows no SP change (the seller was never credited).

---

### TC-C07 · Free user sees locked Use SP button + upgrade modal

**Ref:** TRADING-FLOW-V2 §7 Scenario S9, §4.1
**Actors:** test-free

**Objective:** Verify free users cannot use SP and are shown an upgrade prompt.

**Steps:**
1. Log in as **test-free** and open an **Accept SP** listing.
2. Tap the locked **[Use SP]** button.
3. Tap **[Try Kids Club+ Free]** in the modal, then go back and tap **[Not Now]**.

**Expected Result:**
- The [Use SP] button shows a lock icon; [Request to Buy] is available without a lock.
- Tapping [Use SP] opens an upgrade modal: "Unlock SP discounts with Kids Club+. Save up to 50% on items. 30 days free."
- [Try Kids Club+ Free] navigates to the subscription signup screen; [Not Now] closes the modal and returns to the item with [Request to Buy] still available.

---

### TC-C08 · SP slider capped at 50% of item price

**Ref:** TRADING-FLOW-V2 §4.4 FR-SP-003
**Actors:** test-buyer (subscriber)

**Objective:** Verify the SP slider cannot exceed 50% of the item price.

**Steps:**
1. Log in as **Buyer** and open the SP slider on a $30 item.
2. Drag the slider all the way to the right.
3. Try to type "16" into the SP field.
4. Set SP to exactly $15.

**Expected Result:**
- The slider range is 0 to $15 and stops at $15.
- The field rejects or clamps "16" to 15, showing "Maximum SP is 50% of item price."
- At $15 the breakdown reads "$15 cash + 15 SP = $30 total" with the platform fee still charged in cash.

---

## Group D — Auto-Complete & Timers

### TC-D01 · Auto-complete fires when buyer never taps I Got It

**Ref:** TRADING-FLOW-V2 §7 Scenario S7, §9.2
**Actors:** test-buyer + test-seller
**Precondition:** QA fast-forwards the 48h auto-complete clock past expiry on an In Progress trade.

**Objective:** Verify an undisputed In Progress trade auto-completes after its window.

**Steps:**
1. Reach an **In Progress** trade and do not tap [I Got It].
2. Allow the auto-complete time to pass.
3. Open the trade as either party.

**Expected Result:**
- Both parties receive a push: "Your trade for [Item] was automatically marked complete." with a [Rate & Review] deep link.
- The trade shows as **Completed** and SP is released to the seller; no retroactive [I Got It] is required.

---

### TC-D02 · Auto-complete skipped when dispute is open

**Ref:** TRADING-FLOW-V2 §6.2.4
**Actors:** test-buyer + test-seller
**Precondition:** An In Progress trade has an open dispute; QA fast-forwards past the auto-complete time.

**Objective:** Verify a disputed trade does not auto-complete and the countdown banner is hidden.

**Steps:**
1. Open an **In Progress** trade that has a reported dispute.
2. Verify the auto-complete countdown banner is **not** visible (it is hidden during active disputes).
3. Allow the auto-complete time to pass.
4. Reopen the trade.

**Expected Result:**
- The auto-complete banner is replaced by a yellow dispute banner: "Dispute reported — our team has been notified and will review shortly."
- The trade stays **In Progress** and is not completed; the dispute remains open.
- The [I Got It] and [Report a Problem] buttons are hidden from the buyer.
- Background: the `rpc_process_auto_complete` RPC and `auto-complete-trades` Edge Function both skip trades where `dispute_status` is `reported` or `under_review`, regardless of auto_complete_at timing.

---

### TC-D03 · Offer countdown pill color states

**Ref:** TRADING-FLOW-V2 §8.1
**Actors:** test-seller
**Precondition:** QA can set offers with different remaining times.

**Objective:** Verify the offer countdown pill changes color as the offer nears expiry.

**Steps:**
1. Log in as **Seller** and view offers with varying time remaining on the **Offers** tab and Review screen.
2. Compare the pill color at >12h, 6–12h, 2–6h, <2h, and after expiry.

**Expected Result:**
- Green for more than ~12h remaining, amber for ~6–12h, orange for ~2–6h, red for under ~2h, and gray reading "Expired" once past the deadline.
- The pill color matches on both the Offers tab row and the Review Offer header.

---

### TC-D04 · Auto-complete banner visible to buyer only

**Ref:** TRADING-FLOW-V2 §8.2
**Actors:** test-buyer + test-seller

**Objective:** Verify the auto-complete banner is shown to the buyer and not the seller.

**Steps:**
1. Log in as **Buyer** and open an **In Progress** trade.
2. Log in as **Seller** and open the same trade.
3. Log in as **Buyer** and open the trade after it completes.

**Expected Result:**
- The buyer sees an auto-complete banner ("Auto-completing in [time]" + "Received it? Tap 'I Got It'").
- The seller does not see the banner; instead sees "Buyer paid. Awaiting pickup confirmation."
- Once completed, the banner is gone.

---

### TC-D05 · Post-meetup nudge after auto-complete

**Ref:** TRADING-FLOW-V2 §9.5
**Actors:** test-buyer
**Precondition:** A trade auto-completed without the buyer confirming.

**Objective:** Verify the buyer gets a single follow-up nudge after an auto-completed trade.

**Steps:**
1. Have a trade auto-complete (buyer never confirmed).
2. Wait for the follow-up nudge window (~6h later).

**Expected Result:**
- The buyer receives one push: "Did you pick up [Item]? Tap to confirm and release your SP." which deep-links to the trade detail screen; no duplicate nudge is sent.

---

## Group E — Dispute Flow

### TC-E01 · Buyer opens Report a Problem modal

**Ref:** TRADING-FLOW-V2 §7 Scenario S10, §6.2.3
**Actors:** test-buyer + test-seller

**Objective:** Verify a buyer can report a problem on an In Progress trade.

**Steps:**
1. Log in as **Buyer** and open an **In Progress** trade.
2. Tap **[Report a Problem]**.
3. Select "Seller didn't show up", add an optional note, and tap **[Submit Report]**.

**Expected Result:**
- The trade initially shows [I Got It], [Report a Problem], and [Message Seller].
- The report modal lists reasons ([Seller didn't show up], [Item not as described], [Couldn't agree on meetup], [Other]) with an optional free-text field.
- After submitting, a yellow banner appears: "Dispute reported — our team has been notified and will review shortly."
- The `open-dispute` Edge Function saves the dispute with `dispute_status='reported'`, `dispute_reason`, `dispute_notes`, and `dispute_opened_at` in the trades table.
- The [I Got It] and [Report a Problem] buttons disappear; the auto-complete banner is replaced by the dispute banner.
- The seller is notified and the admin dispute queue at `/trades/disputes` shows the new dispute.
- If the buyer taps [Report a Problem] again, the button is no longer visible (protected by `!hasUnresolvedDispute` check).

**Expected Result:**
- The trade stays **In Progress**, SP is not released, and no payout is initiated while the dispute is open.

---

### TC-E03 · Buyer UI during active dispute (second report guard)

**Ref:** TRADING-FLOW-V2 §11.4
**Actors:** test-buyer

**Objective:** Verify the buyer's screen reflects an active dispute, hides buttons, and prevents a second report.

**Steps:**
1. Log in as **Buyer** and open a trade with an active dispute.
2. Verify the auto-complete banner is **not** visible (hidden via `!hasUnresolvedDispute` condition).
3. Verify neither [I Got It] nor [Report a Problem] buttons are shown.
4. Attempt to file a second dispute (e.g., by checking if [Report a Problem] is reachable).

**Expected Result:**
- The auto-complete countdown banner is replaced by a yellow dispute banner: "Dispute reported — our team has been notified and will review shortly."
- The [I Got It] and [Report a Problem] buttons are hidden; [Message Seller] and seller cancel button remain (if applicable).
- A second dispute cannot be filed — the [Report a Problem] button is gated behind `!hasUnresolvedDispute`; even if invoked programmatically, the `open-dispute` Edge Function returns `409 DISPUTE_EXISTS`.
- If the error message is ever shown (e.g., via an edge case), it displays the actual reason ("A dispute already exists for this trade") rather than the generic "Edge Function returned a non-2xx status code".

---

### TC-E04 · Seller UI during active dispute

**Ref:** TRADING-FLOW-V2 §11.4
**Actors:** test-seller

**Objective:** Verify the seller's screen reflects an active dispute and hides the cancel action.

**Steps:**
1. Log in as **Seller** and open the disputed trade.

**Expected Result:**
- An amber notice appears: "A buyer has reported an issue with this trade. Our team is reviewing."
- The [Cancel] button is hidden during the active dispute; [Message Buyer] remains.

---

### TC-E05 · Admin resolves dispute → Complete (seller fulfilled correctly)

**Ref:** TRADING-FLOW-V2 §6.2.2, §6.2.5
**Actors:** test-admin + both parties

**Objective:** Verify an admin can resolve a dispute in the seller's favor and finalize the trade.

**Steps:**
1. Log in as **Admin** and open the dispute queue.
2. Open the disputed trade and tap **[Resolve → Complete]**, then confirm.

**Expected Result:**
- The trade moves to **Completed**; SP release and payout proceed as normal.
- The buyer receives: "Our team reviewed your trade for [Item] and confirmed it as complete."
- The seller receives: "Your trade for [Item] has been confirmed complete. Your payout is on its way."

---

### TC-E06 · Admin resolves dispute → Refund (buyer's favor)

**Ref:** TRADING-FLOW-V2 §6.2.2, §6.2.5
**Actors:** test-admin + both parties

**Objective:** Verify an admin can resolve a dispute in the buyer's favor with a refund and relist.

**Steps:**
1. Log in as **Admin** and open the disputed trade.
2. Tap **[Resolve → Refund]**, then confirm.

**Expected Result:**
- The trade moves to **Cancelled**; the buyer is refunded and any reserved SP returns to available; the item is relisted.
- The buyer receives: "Your refund for [Item] has been issued. It may take 5–10 business days to appear."
- The seller receives: "Our team resolved the dispute on [Item] in the buyer's favor. The sale has been cancelled."

---

## Group F — Payout

### TC-F01 · Payout shown on trade completion (no dispute)

**Ref:** TRADING-FLOW-V2 §6.3.1
**Actors:** test-seller

**Objective:** Verify a completed, undisputed trade shows the seller's payout as processing.

**Steps:**
1. Complete a trade normally (buyer taps [I Got It] → [Confirm]).
2. Log in as **Seller** and open the completed trade and/or payout area.

**Expected Result:**
- The seller sees the payout as pending/processing for that sale; no duplicate payout is shown for the same trade.

---

### TC-F02 · Payout held when dispute is open at completion time

**Ref:** TRADING-FLOW-V2 §6.3.1
**Actors:** test-admin + test-seller

**Objective:** Verify payout is held while a dispute is open and released once resolved as Complete.

**Steps:**
1. Open a disputed trade and note the payout status as held.
2. Log in as **Admin** and resolve the dispute as **Complete**.
3. Log in as **Seller** and recheck the payout.

**Expected Result:**
- While disputed, the seller's payout is held (not processing).
- After the admin resolves to Complete, the payout changes to processing.

---

### TC-F03 · Payout needs action when seller has no payout method

**Ref:** TRADING-FLOW-V2 §6.3.1, §6.3.3
**Actors:** test-seller (no payout method)

**Objective:** Verify a completed sale prompts the seller to add a payout method without blocking SP release.

**Steps:**
1. Complete a trade where the seller has no payout account configured.
2. Log in as **Seller** and check notifications and the payout status.
3. Add a payout method.

**Expected Result:**
- The trade still shows **Completed** and SP is released; the payout shows as needing action.
- The seller receives: "Your [Item] sold! Add a payout method to receive your $[amount]." with a deep link to payout setup, and reminder notifications recur (up to 3 total).
- After adding a payout method, the payout proceeds with no double payment.

---

## Group G — Notifications

### TC-G01 · Offer expiry reminders sent to seller

**Ref:** TRADING-FLOW-V2 §9.2, §9.5
**Actors:** test-seller
**Precondition:** A pending offer exists; QA can advance time to ~6h and ~1h before expiry.

**Objective:** Verify the seller receives two offer-expiry reminders.

**Steps:**
1. Have a pending offer on the seller's listing.
2. Reach the 6-hours-before-expiry point and check notifications.
3. Reach the 1-hour-before-expiry point and check notifications.

**Expected Result:**
- At ~6h: "⏱ Offer expiring in 6h on [Item]" (deep links to Review Offer).
- At ~1h: "Last chance — offer on [Item] expires in 1h" (deep links to Review Offer).
- No third expiry reminder is sent.

---

### TC-G02 · Auto-complete reminders sent to buyer

**Ref:** TRADING-FLOW-V2 §9.2
**Actors:** test-buyer
**Precondition:** An In Progress trade exists; QA can advance time to ~24h and ~2h before auto-complete.

**Objective:** Verify the buyer receives two auto-complete reminders.

**Steps:**
1. Have an **In Progress** trade.
2. Reach the 24-hours-before-auto-complete point and check notifications.
3. Reach the 2-hours-before-auto-complete point and check notifications.

**Expected Result:**
- At ~24h: "Your [Item] trade auto-completes in 24h. Got it? Tap 'I Got It'."
- At ~2h: "[Item] trade auto-completes in 2 hours."
- No third auto-complete reminder is sent.

---

### TC-G03 · Notification throttle per trade

**Ref:** TRADING-FLOW-V2 §9.5
**Actors:** test-buyer / test-seller

**Objective:** Verify no more than 3 non-payout pushes are sent per user per trade.

**Steps:**
1. Drive a single trade through many reminder-triggering events.
2. Count the non-payout pushes received for that trade.

**Expected Result:**
- A maximum of 3 push notifications are received per user for that trade; any beyond that are not delivered.

---

### TC-G04 · Push notifications deep-link to the correct screen

**Ref:** TRADING-FLOW-V2 §9.5
**Actors:** test-buyer / test-seller

**Objective:** Verify each trade notification opens the correct screen for that trade.

**Steps:**
1. Receive a trade push notification (offer expiry, auto-complete, dispute, payout, etc.).
2. Tap the notification.

**Expected Result:**
- The app opens directly to the correct screen for that exact trade — offer expiry → Review Offer; auto-complete / post-meetup / dispute → trade detail; payout-needs-action → payout setup. It never lands on the home screen or generic trade list.

---

## Group H — Completion Screen CTAs by User Type

**Ref:** TRADING-FLOW-V2 §12

### TC-H01 · Free buyer sees subscription CTA on completion

**Actors:** test-free

**Objective:** Verify a free buyer is shown a Kids Club+ upsell on the completion screen.

**Steps:**
1. Log in as **test-free** and complete any trade.

**Expected Result:**
- The completion screen reads: "Trade complete! Kids Club+ would've saved you $2 on this trade — try it free for 30 days." with a [Try Kids Club+ Free — 30 Days] button.

---

### TC-H02 · Subscriber buyer used SP — "You saved" message

**Actors:** test-buyer (subscriber)

**Objective:** Verify a subscriber buyer who used SP sees their savings on completion.

**Steps:**
1. Log in as **test-buyer** and complete a trade that used 8 SP.

**Expected Result:**
- The completion screen reads: "Got it! You saved $8 using SP!" and shows the remaining SP balance ("You have [remaining_sp] SP left.").

---

### TC-H03 · Subscriber seller on Accept SP listing — SP pending notice

**Actors:** test-seller (subscriber)

**Objective:** Verify a subscriber seller sees their pending SP on completing an Accept SP sale.

**Steps:**
1. Log in as **test-seller** and complete an **Accept SP** sale.

**Expected Result:**
- The completion screen reads: "[total_sp] SP releasing in [N] days — added to your pending wallet." with a [View Wallet] button that opens the SP wallet.

---

### TC-H04 · Subscriber seller on Cash Only listing — upsell to Accept SP

**Actors:** test-seller (subscriber)

**Objective:** Verify a subscriber seller is nudged to enable Accept SP on future listings.

**Steps:**
1. Log in as **test-seller** and complete a **Cash Only** sale.

**Expected Result:**
- The completion screen reads: "Sold for cash! Try 'Accept SP' on your next listing to also earn SP." with a [Create New Listing] button.

---

## Group I — Safety UX

### TC-I01 · Safe meetup guidance card visible on in_progress trade

**Ref:** TRADING-FLOW-V2 §11.5
**Actors:** test-buyer + test-seller

**Objective:** Verify the safe-meetup card appears only while a trade is In Progress.

**Steps:**
1. Log in as **Buyer** and open an **In Progress** trade.
2. Log in as **Seller** and open the same trade.
3. Open a pending or completed trade.

**Expected Result:**
- Both parties see a safe-meetup card on the In Progress trade: "🛡️ Stay Safe — Choose a Public Meetup Spot" with tips (library, coffee shop, police station).
- The card is not shown on pending or completed trades.

---

### TC-I02 · Safe meetup card dismissible per trade (not globally)

**Ref:** TRADING-FLOW-V2 §11.5
**Actors:** test-buyer

**Objective:** Verify dismissing the safe-meetup card persists for that trade only.

**Steps:**
1. On an In Progress trade, tap **[Got it ✓]** on the card.
2. Navigate away and return to the same trade.
3. Open a different In Progress trade.
4. On the collapsed card, tap **[Tips]**.

**Expected Result:**
- The card collapses to a compact link ("🛡️ Meeting safely? [Tips]") and stays collapsed when returning to the same trade.
- A different In Progress trade shows the card expanded (dismissal is per trade, not global).
- Tapping [Tips] re-expands the card.

---

### TC-I03 · In-chat safety banner persistent and non-dismissible

**Ref:** TRADING-FLOW-V2 §15 V1-3
**Actors:** test-buyer / test-seller

**Objective:** Verify the chat safety banner is always shown and cannot be dismissed.

**Steps:**
1. Open the chat for any trade.
2. Scroll the conversation.
3. Look for any close/dismiss control.

**Expected Result:**
- A banner is pinned at the top: "SP and buyer protection only apply to in-app trades. Outside deals aren't covered."
- It stays pinned while scrolling and has no dismiss control.

---

### TC-I04 · Pre-first-message safety modal shown once per listing

**Ref:** TRADING-FLOW-V2 §15 V1-5
**Actors:** test-buyer

**Objective:** Verify a one-time safety modal appears before the first message on a listing.

**Steps:**
1. Open the chat for a listing you have never messaged and try to send a message.
2. Tap **[Got it]** and send a message.
3. Reopen that same listing's chat.
4. Open a different listing's chat for the first time.

**Expected Result:**
- Before the first message a modal appears: "Keep your trade safe — SP and buyer protection only work for in-app transactions." with a [Got it] button.
- After dismissing, you can send the message; the modal does not reappear for that listing.
- A different listing's first chat shows the modal again (it is per listing).

---

### TC-I05 · Chat quick-reply chips visible on in_progress trade

**Ref:** TRADING-FLOW-V2 §11.6
**Actors:** test-buyer / test-seller

**Objective:** Verify scheduling quick-reply chips appear in chat only while In Progress.

**Steps:**
1. Open the chat while the trade is **In Progress**.
2. Tap **📅 Today**.
3. Tap **📍 Suggest times**.
4. Open the chat while the trade is pending or completed.
5. With 5 chips available, view the chip row.

**Expected Result:**
- Chips appear above the input: 📅 Today, 📅 Tomorrow, 📍 Suggest times, 🏪 Public place, 🕐 Running late.
- 📅 Today sends "I can do a pickup today. What time works for you?".
- 📍 Suggest times pre-fills the composer with "Here are some times that work for me: [add your times]".
- Chips are hidden when the trade is pending or completed.
- Only 3 chips show initially; a "+More" reveals the rest.

---

## Group J — Seller Cancel Consequences

**Ref:** TRADING-FLOW-V2 §11.7

### TC-J01 · Seller cancels in_progress trade → Level 1 alert

**Actors:** test-seller
**Precondition:** test-seller has no prior post-acceptance cancellations.

**Objective:** Verify the first post-acceptance seller cancellation shows a Level 1 warning.

**Steps:**
1. Log in as **Seller** and open an **In Progress** trade.
2. Tap **[Cancel Trade]**.
3. Select "Can't do pickup/meetup" and confirm.

**Expected Result:**
- A seller-reason modal appears.
- After confirming, a Level 1 alert appears noting it's "disappointing for buyers."

---

### TC-J02 · 2nd post-acceptance cancel → Level 2 alert

**Actors:** test-seller
**Precondition:** test-seller has exactly 1 prior post-acceptance cancellation.

**Objective:** Verify the second post-acceptance cancellation shows a Level 2 warning.

**Steps:**
1. Log in as **Seller** and cancel a new **In Progress** trade with a reason.

**Expected Result:**
- The alert warns that repeated cancellations "may affect selling privileges" (Level 2).

---

### TC-J03 · 3rd post-acceptance cancel → Level 3 + admin flag

**Actors:** test-seller
**Precondition:** test-seller has exactly 2 prior post-acceptance cancellations.

**Objective:** Verify the third post-acceptance cancellation shows a Level 3 warning and flags the account.

**Steps:**
1. Log in as **Seller** and cancel a new **In Progress** trade with a reason.

**Expected Result:**
- The alert states the "account under review" (Level 3); the seller's account is flagged for admin review.

---

### TC-J04 · Seller cancel button visible only on in_progress

**Actors:** test-seller + test-buyer

**Objective:** Verify the seller cancel button shows only on In Progress trades and only for the seller.

**Steps:**
1. Log in as **Seller** and open an **In Progress** trade.
2. Open a **pending** trade as seller.
3. Open a **completed** trade as seller.
4. Log in as **Buyer** and open an **In Progress** trade.

**Expected Result:**
- The seller cancel button appears only on the In Progress trade for the seller; it is absent on pending, completed, and for the buyer.

---

### TC-J05 · Seller cancel modal shows seller-specific reasons only

**Actors:** test-seller

**Objective:** Verify the seller cancel modal lists only seller reasons.

**Steps:**
1. Log in as **Seller** and tap cancel on an **In Progress** trade.
2. Review the reason list.

**Expected Result:**
- Reasons shown: "Can't do pickup/meetup", "Item no longer available", "Other".
- Buyer reasons ("Changed my mind", "Item not as described") are not present.

---

## Group K — Value Stack & Fees

**Ref:** TRADING-FLOW-V2 §11.3

### TC-K01 · Subscriber sees $0.99 fee in value stack

**Actors:** test-buyer (subscriber)

**Objective:** Verify the subscriber value stack shows the $0.99 platform fee, a Sales Tax line, and an SP discount row when SP is used.

**Steps:**
1. Log in as **test-buyer** and open a listing → tap **Make Offer**.
2. Scroll to the value stack.
3. Enter 5 SP.

**Expected Result:**
- The value stack shows the offer amount, a "Platform fee" row of $0.99, a "Sales Tax" row (based on the buyer's node rate), and a "Total cash" row equal to offer amount + sales tax + $0.99.
- After entering 5 SP, an "SP discount" row appears showing `-5 SP`, and the Sales Tax recalculates on the SP-discounted amount.

---

### TC-K02 · Non-subscriber sees $2.99 fee in value stack

**Actors:** test-free

**Objective:** Verify the non-subscriber value stack shows the $2.99 platform fee, a Sales Tax line, and no SP input.

**Steps:**
1. Log in as **test-free** and open a listing → tap **Make Offer**.
2. Review the value stack.

**Expected Result:**
- The "Platform fee" row shows $2.99, a "Sales Tax" row appears (based on the buyer's node rate), and the "Total cash" row is the offer amount + sales tax + $2.99.
- No SP input section is visible.

---

### TC-K03 · SP discount row conditional on SP used

**Actors:** test-buyer (subscriber)

**Objective:** Verify the SP discount row appears only when SP is greater than zero.

**Steps:**
1. Log in as **test-buyer** and open the offer screen for an SP-accepting item.
2. Set SP to 0.
3. Set SP to 5.
4. Set SP back to 0.

**Expected Result:**
- With SP at 0 the "SP discount" row is hidden.
- With SP at 5 the row appears showing `-5 SP`.
- Returning to 0 hides the row again.

---

### TC-K04 · Bundle checkout — fee charged per item (admin toggle OFF)

**Actors:** test-buyer (subscriber), test-buyer (free)
**Precondition:** Admin toggle `charge_one_fee_per_bundle` is OFF (default). Bundle has 3+ items from the same seller.

**Objective:** Verify that when the admin toggle is OFF, the platform fee is charged per item in the bundle.

**Steps:**
1. Log in as **test-buyer (subscriber)** on the mobile app.
2. Add 3 items from the same seller to cart.
3. Navigate to **CartCheckout** screen.
4. Review the **Order Summary** section.
5. Verify the **Platform Fee** row shows: `Platform Fee (×3 items): $2.97` (3 × $0.99).
6. Verify the **Cash Total** includes 3× the platform fee.
7. Tap **Send Offer** and complete checkout.
8. Navigate to the bundle trade's **Timeline** screen.
9. Expand the bundle item list ("View all items").
10. Scroll to the **bundle totals** section.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| CartCheckout: Platform Fee label | Shows "Platform Fee (×3 items)" with dollar amount = 3 × subscriber fee |
| CartCheckout: Cash Total | Includes 3× platform fee + subtotal - SP + tax |
| Trade Timeline: Bundle totals | "Platform Fee" row sums all `buyer_transaction_fee_cents` = 3 × fee |
| Toggle OFF + free user | Same behavior with non-subscriber fee ($2.99 per item) |
| Single-item trade (non-bundle) | Fee charged once, no "(×1 items)" suffix |

---

### TC-K05 · Bundle checkout — one fee per bundle (admin toggle ON)

**Actors:** test-buyer (subscriber), test-buyer (free)
**Precondition:** Admin toggle `charge_one_fee_per_bundle` is ON (enabled). Bundle has 3+ items from the same seller.

**Objective:** Verify that when the admin toggle is ON, the platform fee is charged only once for the entire bundle.

**Steps:**
1. Log in as **test-buyer (subscriber)** on the mobile app.
2. Add 3 items from the same seller to cart.
3. Navigate to **CartCheckout** screen.
4. Review the **Order Summary** section.
5. Verify the **Platform Fee** row shows: `Platform Fee: $0.99` (single fee, no ×N suffix).
6. Verify the **Cash Total** includes exactly 1× the platform fee.
7. Tap **Send Offer** and complete checkout.
8. Navigate to the bundle trade's **Timeline** screen.
9. Expand the bundle item list ("View all items").
10. Scroll to the **bundle totals** section.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Admin toggle ON | Config page at `localhost:3001/config` → Fees tab shows `Charge One Fee Per Bundle: Enabled` |
| CartCheckout: Platform Fee label | Shows "Platform Fee: $0.99" — no "(×N items)" suffix |
| CartCheckout: Cash Total | Includes exactly 1× platform fee + subtotal - SP + tax |
| Trade Timeline: Bundle totals | "Platform Fee" row shows exactly 1× fee (single `buyer_transaction_fee_cents` across all bundle trades) |
| Toggle ON + free user | One fee of $2.99 for the entire bundle |
| Single-item trade (non-bundle) | Fee charged once — unaffected by toggle |

---

### TC-K06 · Bundle timeline — fee display matches charge mode

**Actors:** test-buyer (subscriber)
**Precondition:** Two bundle trades exist — one created with toggle OFF (per-item fees), one created with toggle ON (one fee).

**Objective:** Verify the TradeTimelineScreen bundle total section correctly reflects the fee mode that was active when the offers were created.

**Steps:**
1. Log in as **test-buyer**.
2. Open a bundle trade that was created with `charge_one_fee_per_bundle = OFF`.
3. Expand "View all items" and scroll to bundle totals.
4. Open a different bundle trade that was created with `charge_one_fee_per_bundle = ON`.
5. Expand "View all items" and scroll to bundle totals.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Toggle OFF bundle | "Platform Fee" = sum of all individual fees (e.g., $2.97 for 3 items at $0.99) |
| Toggle ON bundle | "Platform Fee" = single fee (e.g., $0.99) |
| Both bundles | "Items Total" and "Sales Tax" display correctly regardless of fee mode |

---

### TC-K07 · Admin partial refund — refund price only, keep fee

**Actors:** admin (admin portal)
**Precondition:** A `completed` trade exists with captured payment: price $100, fee $0.99, tax $7.00 (total charged $107.99).

**Objective:** Verify the admin can issue a partial refund that returns the item price but KEEPS the platform fee, and the trade is NOT cancelled.

**Steps:**
1. Log in to admin portal → **Trades** → open the completed trade.
2. In **Admin Interventions** → **Partial / Line-Item Refund**, tap **Issue Partial Refund**.
3. In the modal set **Item Price = $100.00**, **Platform Fee = $0.00**, **Sales Tax = $7.00**.
4. Enter a reason, tap **Refund $107.00**.
5. Verify success alert.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Stripe refund | Stripe refund of exactly $107.00 issued against the trade's PI (amount, not full $107.99) |
| Trade status | Trade remains `completed` — NOT cancelled |
| Payments ledger | `payments.refunded_cents` = $107.00; `status` = `partially_refunded`; `refunded_fee_cents` = $0 (fee kept) |
| Refund history | A `trade_refunds` row exists with price $100 / fee $0 / tax $7 split |
| Tax ledger | `tax_records.tax_status` = `refunded` (full tax reversed) |
| Stripe dashboard | Refund shows amount $107.00 with metadata `admin_action=partial_refund` |

---

### TC-K08 · Admin partial refund — tax ledger partially refunded

**Actors:** admin (admin portal)
**Precondition:** A `completed` trade with tax $7.00 has already had a partial refund of the item price only (tax untouched).

**Objective:** Verify a SECOND partial refund of the sales-tax component marks the tax ledger `refunded` (or `partially_refunded` on a split), and over-refund attempts are rejected.

**Steps:**
1. In admin → open the trade → **Issue Partial Refund**.
2. Set **Sales Tax = $7.00** only (price and fee = 0). Refund.
3. Try to refund **Sales Tax = $7.00** again on the same trade.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| First tax refund | `tax_records.tax_status` = `refunded`; `refunded_tax_cents` = $7.00 |
| Duplicate / over-refund | Rejected with `REFUND_EXCEEDS_TAX` (or `REFUND_EXCEEDS_TOTAL`) — no double refund |
| Payments ledger | `refunded_cents` never exceeds `total_charged_cents` |
| Multiple refunds | Each refund creates its own `trade_refunds` row (history preserved) |

---

### TC-K09 · Payments reconciliation page — charged vs refunded per trade

**Actors:** admin (admin portal)

**Objective:** Verify the admin **Payments** page (sidebar → Payments) shows the charged snapshot vs. refunded totals for every trade and reconciles against Stripe.

**Steps:**
1. Log in to admin portal → sidebar **Payments**.
2. Verify the summary strip: Payments count, **Total Charged**, **Total Refunded**, **Net Collected**.
3. Verify each row shows: date, trade id (links to trade detail), buyer, item price, fee, tax, SP, **Charged** (price+fee+tax), **Refunded**, status pill, Stripe PI.
4. Use the **status filter** (e.g., `partially_refunded`) and the **search** box (trade id / PI id / bundle id).
5. Cross-check a `succeeded` row's **Charged** against the Stripe dashboard payment amount.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Charged column | = item price + fee + tax (matches Stripe PI amount) |
| Refunded column | Sums all refunds; shows `—` when 0 |
| Net Collected | = Total Charged − Total Refunded |
| Status pill | `succeeded` / `partially_refunded` / `refunded` / `cancelled` etc. |
| Search by PI/bundle/trade | Filters correctly via PostgREST |
| Trade link | Navigates to the trade detail page |

---

### TC-K10 · Server-side enforcement — one-fee-per-bundle with stale client

**Actors:** test-buyer (subscriber)
**Precondition:** Admin toggle `charge_one_fee_per_bundle` is ON. A bundle has 3 items from the same seller.

**Objective:** Verify the Edge Function enforces one fee per bundle EVEN IF the client still sends a per-item fee (stale app version).

**Steps:**
1. In a dev tool / the mobile app, submit a 3-item bundle checkout where the request body charges `transaction_fee_cents` on ALL 3 items (simulates an old client).
2. Inspect the created trades.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Fee on trades | Only item 0 has `buyer_transaction_fee_cents` > 0; items 1–2 have 0 |
| Cash on trades | Items 1–2 `cash_amount_cents` = price − SP (fee removed server-side) |
| Stripe holds | Stripe PI amounts for items 1–2 exclude the fee |
| Single-item mode | Fee charged once — unaffected by enforcement |

---

## Group L — Bundle Flows

**Ref:** TRADING-FLOW-V2 §11.3.1

### TC-L01 · Bundle banner on trade detail (with expandable item list)

**Actors:** test-buyer
**Precondition:** An In Progress trade belongs to a bundle (2+ items sharing the same `bundle_id`).

**Objective:** Verify the bundle banner shows on a bundled trade with an expandable item list of tap-able names, and is absent on non-bundle trades.

**Steps:**
1. Log in as **test-buyer** and open a bundled trade from **Trades → Active**.
2. Locate the green bundle banner at top: "Bundle offer · N items" with "View all items" link.
3. Tap "View all items" to expand the item list.
4. Verify each item row shows title, SP (if any), and cash price.
5. Tap an item name — verify navigation to `ListingDetail` for that item.
6. Tap "Hide items" to collapse the list.
7. Open a non-bundle trade.

**Expected Result:**
- The bundled trade shows a green banner: "Bundle offer · N items" with expandable item list.
- "View all items" expands to show all sibling items with tap-able names (navigate to ListingDetail), SP amounts (green), and cash prices.
- "Hide items" collapses the list.
- The non-bundle trade shows no bundle banner.

---

### TC-L02 · Confirm All shortcut for bundle (buyer)

**Actors:** test-buyer
**Precondition:** Two In Progress trades share the same bundle.

**Objective:** Verify the buyer can confirm bundle items individually or all at once.

**Steps:**
1. Open one bundle trade and tap **[I Got It]**.
2. Tap **[Just This One]**.
3. Open the second bundle trade, tap **[I Got It]**, then tap **[Confirm All N]**.

**Expected Result:**
- Tapping [I Got It] on a bundle item prompts "Confirm all 2 items?" with [Confirm All 2] and [Just This One].
- [Just This One] completes only that trade; the other stays In Progress.
- [Confirm All N] completes both trades.

---

### TC-L03 · Bundle offer rows in Offers tab (seller)

**Actors:** test-seller
**Precondition:** A buyer sent 2+ offers sharing the same bundle.

**Objective:** Verify the seller's Offers tab groups bundle offers with batch actions.

**Steps:**
1. Log in as **test-seller** and open **Trades → Offers**.
2. Find the bundle row and review its buttons.
3. Tap **[Accept All]** (or test **[Decline All]** / **[Review Each]** as needed).

**Expected Result:**
- A bundle row appears: "Bundle offer · N items" with [Accept All], [Review Each], and [Decline All].
- [Accept All] moves all bundle offers forward to payment processing; [Decline All] cancels them; [Review Each] opens the first offer's Review screen.

---

### TC-L04 · Non-bundle offers render as single rows

**Actors:** test-seller

**Objective:** Verify single offers are not grouped as bundles.

**Steps:**
1. In the **Offers** tab, find a single (non-bundle) offer.

**Expected Result:**
- It renders as a normal offer row with only the standard Review action — no bundle group buttons.

---

### TC-L05 · In-progress bundles section in Buying tab

**Actors:** test-buyer
**Precondition:** Buyer has 2 In Progress trades sharing the same bundle.

**Objective:** Verify In Progress bundles are grouped at the top of the Buying tab.

**Steps:**
1. Log in as **test-buyer** and open **Trades → Buying**.
2. Find the in-progress bundles section and tap **[View →]**.

**Expected Result:**
- An in-progress bundles section appears at the top showing the correct item count.
- [View →] opens the trade detail for the first trade in the bundle.

---

### TC-L06 · Bundle banner in Review Offer screen

**Actors:** test-seller
**Precondition:** A trade in the Review Offer screen belongs to a bundle.

**Objective:** Verify the Review Offer screen shows bundle context with an expandable item list.

**Steps:**
1. Log in as **test-seller** and open the **Review Offer** screen for a bundled offer.
2. Tap the "Show all N items" toggle.

**Expected Result:**
- A bundle context banner is shown ("Bundle offer · N items").
- The toggle expands/collapses a list where each item shows its title and price.

---

### TC-L07 · Accept All N Items in Review Offer screen

**Actors:** test-seller
**Precondition:** The offer has 2+ bundle siblings.

**Objective:** Verify the seller can accept all bundle items from the Review Offer screen.

**Steps:**
1. Open the **Review Offer** screen for the first offer in a bundle.
2. Tap **[Accept All N Items]** and confirm.

**Expected Result:**
- An "Accept All N Items" button is visible.
- Confirming moves all bundle offers forward to payment processing, and the buyer's trade detail reflects the update.

---

### TC-L08 · Individual accept/decline works alongside bundle siblings

**Actors:** test-seller

**Objective:** Verify single accept/decline still works when bundle siblings exist.

**Steps:**
1. Open the **Review Offer** screen for a bundle offer.
2. Tap **[Accept Trade]** (single accept).

**Expected Result:**
- The single [Accept Trade] and [Decline] buttons are available alongside the bundle button.
- Accepting just this offer updates only this trade; the bundle siblings stay pending.

---

### TC-L09 · Bundle card in Your Offers (buyer)

**Actors:** test-buyer
**Precondition:** Buyer has 2+ pending offers sharing the same `bundle_id` (submitted via cart checkout to the same seller).

**Objective:** Verify the buyer's "Your Offers" section groups bundle items into a single card (no Accept All / Decline All buttons).

**Steps:**
1. Log in as **test-buyer** on the mobile app.
2. From a seller with 2+ available listings, add both items to cart and complete checkout (or use `--extended` seed data).
3. Navigate to **Trades → Active** (bottom nav Trades icon, then Active tab).
4. Locate the **YOUR OFFERS** section at the top.
5. Find the bundle row — it should display:
   - A green header: **"📦 Bundle Offer · N items"**
   - A PENDING badge
   - A "Buying" type badge
   - Item rows showing the first 3 item titles and prices (e.g., "$20.00" or "$15.00 + 10 SP")
   - If more than 3 items, a "+N more items" line
   - An orange offer expiration line (earliest expiry date among bundle items)
   - A **"View Details"** button — NO Accept All / Decline All buttons
6. Tap the **"View Details"** button to open the first bundle trade's detail screen.
7. Navigate back and verify non-bundle offers still render as individual cards with thumbnails and "View Details".

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| 2+ submitted offers share `bundle_id` | They are grouped into a single **"📦 Bundle Offer · N items"** card in YOUR OFFERS |
| Bundle card header | Green text (`#5DBB8E`), title "📦 Bundle Offer · N items" |
| Bundle card items | Shows first 3 item titles + prices on separate rows; "+N more" if > 3 |
| Bundle card expiry | Shows earliest offer expiry with orange dot + countdown |
| Bundle card action | Single **"View Details"** button — no Accept All / Decline All |
| Non-bundle submitted offers | Render as individual cards with thumbnail, unchanged from current behavior |
| Tap "View Details" | Opens `TradeDetail` screen for the first trade in the bundle |

---

## Group M — Cart (End User)

### passed TC-M01 · Add first item creates an active cart

**Actors:** test-buyer

**Objective:** Verify adding the first item from a seller creates an active cart.

**Steps:**
1. Log in as **test-buyer** and open an available item from **test-seller**.
2. Tap **Add to Cart**.
3. Open the **Cart** screen from the bottom nav.

**Expected Result:**
- A confirmation appears (e.g., a toast or the cart badge increments to 1).
- The Cart screen shows the single item with its title, photo, and price.

### passed TC-M02 · Add second item from the same seller

**Actors:** test-buyer

**Precondition:** The cart already contains 1 item from test-seller (TC-M01).

**Objective:** Verify a second item from the same seller is added to the existing cart.

**Steps:**
1. Open a second available item from **test-seller**.
2. Tap **Add to Cart**.
3. Open the **Cart** screen.

**Expected Result:**
- No modal appears; the item is added directly.
- The Cart screen now lists 2 items under the same seller and the cart badge shows 2.

### passed TC-M03 · Add item from a different seller shows the choice modal

**Actors:** test-buyer

**Precondition:** The cart contains items from test-seller.

**Objective:** Verify adding an item from a different seller prompts a save/replace/cancel choice.

**Steps:**
1. Open an available item from **test-seller-2** (a different seller).
2. Tap **Add to Cart**.

**Expected Result:**
- A modal appears: "our trade basket already has items from a different seller. Adding this item will clear your current trade basket. What would you like to do?"
- Three options are shown: Save & Start New Trade Basket, Replace Trade Basket, Cancel
- Tapping **Save & Start New Trade Baske** moves the current cart to saved carts and starts a new active cart containing the test-seller-2 item.
- Tapping **Cancel** closes the modal and leaves the original cart unchanged.

### passed TC-M04 · Replace Cart option

**Actors:** test-buyer

**Precondition:** The cart contains items from test-seller.

**Objective:** Verify Replace Cart clears the current cart and starts a new one with the new seller's item.

**Steps:**
1. Open an item from **test-seller-2** and tap **Add to Cart**.
2. In the modal, tap **Replace Cart**.
3. Open the **Cart** screen.

**Expected Result:**
- The previous test-seller items are removed (not saved).
- The Cart screen shows only the test-seller-2 item under that seller.

### passed TC-M05 · Cannot add your own item to cart

**Actors:** test-seller

**Objective:** Verify a user cannot add their own listing to the cart.

**Steps:**
1. Log in as **test-seller** and open one of your own active listings.
2. Look for the **Add to Cart** button.

**Expected Result:**
- The Add to Cart action is unavailable (hidden or disabled), or tapping it shows a message that you cannot add your own item.


### passed TC-M07 · Duplicate item is prevented in the same cart

**Actors:** test-buyer

**Precondition:** The cart contains a specific item from test-seller.

**Objective:** Verify the same item cannot be added twice.

**Steps:**
1. Open the item that is already in the cart.
2. Tap **Add to Cart** again.

**Expected Result:**
- The item is not duplicated; the cart count is unchanged.
- The UI indicates the item is already in the cart (e.g., button reads "In Cart").

### passed TC-M08 · Remove an item from the cart

**Actors:** test-buyer

**Objective:** Verify removing an item updates the cart immediately.

**Steps:**
1. Open the **Cart** screen with 2 items.
2. Remove one item (swipe or tap remove).

**Expected Result:**
- The removed item disappears from the list and the cart badge decrements.
- The cart total updates to reflect the remaining item.

### passed TC-M09 · Clear the cart

**Actors:** test-buyer

**Objective:** Verify clearing the cart empties it.

**Steps:**
1. Open the **Cart** screen with items.
2. Tap **Clear Cart** and confirm.

**Expected Result:**
- All items are removed and the screen shows an empty-cart state.
- The cart badge shows 0 or disappears.

### passed TC-M10 · Saved carts: max 3, LRU eviction, switch cart

**Actors:** test-buyer

**Objective:** Verify the saved-cart limit of 3, oldest-cart eviction, and switching between carts.

**Steps:**
1. Build and save carts from 4 different sellers in turn, using **Save & Start New Cart** each time.
2. Open the **Saved Carts** / **Switch Cart** view.
3. Tap **Switch Cart** on one of the saved carts.

**Expected Result:**
- At most 3 saved carts are kept; the oldest saved cart is dropped when the 4th is saved.
- Tapping Switch Cart makes the chosen saved cart the active cart and moves the previously active cart into saved.

### passed TC-M11 · Minimum cart value warning and blocked checkout

**Actors:** test-buyer

**Objective:** Verify the minimum cart value is enforced at checkout (not at add-to-cart).

**Steps:**
1. Add a single low-priced item so the cart total is below the configured minimum (default $20.00).
2. Open the **Cart** screen.
3. Attempt to proceed to checkout.

**Expected Result:**
- A soft warning appears in the cart, e.g., "Add $X.XX more to reach the $20.00 minimum."
- The checkout button is disabled/blocked while below the minimum.
- Adding more items to exceed the minimum clears the warning and enables checkout.


### TC-M13 · Realtime: item becomes unavailable while in cart

**Actors:** test-buyer, test-seller

**Objective:** Verify the cart reflects an item becoming unavailable in real time.

**Steps:**
1. As **test-buyer**, add an item to the cart and keep the **Cart** screen open.
2. As **test-seller** (on another device), mark that same item as sold or delete it.

**Expected Result:**
- Within ~1 second the cart shows an inline warning on that item: "This item is no longer available."
- The unavailable item is excluded from the cart total and from checkout.
- If left untouched, the unavailable item is auto-removed after 24 hours (QA may fast-forward to confirm).

### TC-M14 · Favorites add / remove

**Actors:** test-buyer

**Objective:** Verify favoriting and unfavoriting items works and is separate from the cart.

**Steps:**
1. Open an item and tap the **heart** (favorite) icon.
2. Open the **Favorites** screen.
3. Tap the filled heart to remove the item from favorites.

**Expected Result:**
- The item appears in Favorites after tapping the heart and is not added to the cart.
- Favoriting the same item twice does not create a duplicate.
- Removing un-favorites the item and it disappears from the Favorites list.

### TC-M15 · Favorites screen shows availability and empty state

**Actors:** test-buyer

**Objective:** Verify the Favorites screen shows availability status and a friendly empty state.

**Steps:**
1. Favorite an item, then have it marked sold (or favorite an already-sold item if available).
2. Open the **Favorites** screen.
3. Remove all favorites and view the screen again.

**Expected Result:**
- Unavailable favorited items show a "No Longer Available" overlay but remain visible.
- With no favorites, the screen shows an empty state: "No favorites yet" with guidance to tap the heart icon.

### TC-M16 · Success toast appears and auto-dismisses on add-to-cart

**Actors:** test-buyer

**Objective:** Verify that tapping "Add to Cart" shows a non-blocking success toast that auto-dismisses without requiring a tap.

**Steps:**
1. Log in as **test-buyer** and open an available item from **test-seller**.
2. Tap **Add to Cart**.

**Expected Result:**
- A green success toast slides in from the top of the screen immediately after the item is added.
- The toast contains a shopping cart icon and the message "Added to Trade Basket".
- The user can continue interacting with the screen (scroll, tap other buttons) while the toast is visible — it is **not** blocking like `Alert.alert`.
- After approximately 2.5 seconds, the toast slides out and disappears automatically.
- No "OK" button or user interaction is required to dismiss it.

### TC-M17 · Cart badge increments in sync with toast

**Actors:** test-buyer

**Precondition:** cart badge currently shows N items (e.g., 0).

**Objective:** Verify that the bottom-nav cart badge count increments to N+1 at the same time as the success toast appears.

**Steps:**
1. Log in as **test-buyer** and note the current cart badge count on the bottom nav.
2. Open an available item from **test-seller** and tap **Add to Cart**.
3. Observe the bottom-nav cart badge.

**Expected Result:**
- The cart badge increments to N+1 simultaneously with the toast appearing (no perceptible delay).
- The increment happens before the toast auto-dismisses — the user sees both the toast and the updated badge at the same time.
- Repeating the test with M02 (add second item from same seller) and M04 (Replace Cart) also shows correct badge increments.

### TC-M18 · Toast copy uses "Trade Basket" terminology

**Actors:** test-buyer

**Objective:** Verify all success-toast copy uses "Trade Basket" language (matching TC-V07).

**Steps:**
1. Log in as **test-buyer** and add an item from **test-seller** to the cart.
2. Observe the success toast text.
3. Repeat via the **Replace Cart** path (add item from test-seller-2 and choose Replace Cart).
4. Repeat via the **Save & Start New Cart** path (add from test-seller-3).

**Expected Result:**
- The toast message always reads **"Added to Trade Basket"** (never "Added to Cart", never "Added to Basket").
- The toast subtitle (when shown, e.g., cross-node warning) also uses "Trade Basket" language and matches the cross-node copy from the spec.
- All three add paths (direct add, Replace Cart callback, Save & Start New Cart callback) show the same "Added to Trade Basket" message.

---

### TC-M19 · Home dashboard Favorites quick-action tile navigates to Favorites

**Actors:** test-buyer (any logged-in user)

**Objective:** Verify the Home dashboard quick-action grid has a Favorites tile that navigates to the Favorites screen.

**Steps:**
1. Log in as **test-buyer** and land on the **Home** dashboard.
2. Scroll the quick-action grid row to find the **Favorites** tile (heart icon, labeled "Favorites").
3. Tap the **Favorites** tile.

**Expected Result:**
- The Favorites tile is visible with a heart icon and the label "Favorites".
- Tapping it navigates to the Favorites screen showing the user's saved items.
- The [View Favorites →] link on the Trade Basket screen (Cart → Favorites) continues to work identically.

---

### TC-M20 · Discover header heart icon navigates to Favorites

**Actors:** test-buyer (any logged-in user)

**Objective:** Verify the Discover screen header has a heart icon button that navigates to the Favorites screen.

**Steps:**
1. Log in as **test-buyer** and navigate to the **Discover** tab.
2. Locate the heart icon button in the controls row (between the filter/funnel button and the Sort dropdown).
3. Tap the heart icon.

**Expected Result:**
- A pink/red heart icon button is visible in the Discover header controls row with accessibility label "View Favorites".
- Tapping it navigates to the Favorites screen showing the user's saved items.
- The heart icon does not toggle or change state — it is a navigation trigger only.

---

## Group N — Cart (Admin)

### TC-N01 · Admin sets minimum cart value and it reflects in the app

**Actors:** Admin, test-buyer

**Objective:** Verify the admin-configured minimum cart value drives the app's checkout enforcement.

**Steps:**
1. Log in to the **admin portal** and open the cart settings page.
2. Change the minimum cart value (e.g., from $20.00 to $30.00) and save.
3. In the mobile app as **test-buyer**, build a cart with a total between the old and new minimum (e.g., $25.00).
4. Open the **Cart** screen and attempt checkout.

**Expected Result:**
- The admin save shows a success message and the new value persists after refresh.
- In the app the cart now shows the $30.00 minimum, displays the soft warning, and blocks checkout until the total reaches $30.00.

### TC-N02 · Admin minimum cart value validation

**Actors:** Admin

**Objective:** Verify the admin portal validates the minimum cart value input.

**Steps:**
1. In the **admin portal** cart settings, enter a value below the allowed floor (e.g., $4.00, below the $5.00 minimum).
2. Attempt to save.

**Expected Result:**
- An inline validation error prevents saving values below $5.00.
- A valid value (≥ $5.00) saves successfully.

---

## Group O — Tax (End User Mobile App)

**Focus:** Buyer-facing tax display, calculation correctness, SP interaction, refund visibility

### ✅ TC-O01 · Sales tax shown in checkout/cart breakdown (0 SP)

**Precondition:** Node has 6.35% tax rate, global tax enabled, item is $30 `general_tangible_goods`.

**Steps:**
1. As **test-buyer**, open an item → tap **Request to Buy** (single-item flow).
2. Observe the price breakdown on TradeInitiationScreen.
3. Repeat via **Cart Checkout** flow (add item to cart → tap Checkout).

**Expected Result:**
- **TradeInitiationScreen:** Shows Item Price → Subtotal → **Sales Tax** (calculated amount) → Platform Fee → Total.
- **CartCheckoutScreen:** Shows Subtotal → SP Discount (if any) → Platform Fee → **Sales Tax** → Total.
- Tax amount = `FLOOR((3000 * 0.0635) + 0.5) = 191 cents = $1.91`.
- Label reads **"Sales Tax"** (kid-friendly, not jurisdiction name).
- Total includes the tax.

---

### ✅ TC-O02 · Tax recalculates on SP slider change (offer + checkout)

**Precondition:** test-buyer (subscriber) with ≥ 15 SP, item is $30 Accept SP, `include_fee_in_tax_base = false`.

**Steps:**
1. Open the $30 item → tap **Use SP** → move slider to apply 15 SP (max 50%).
2. Watch the breakdown update in real time.
3. Repeat on TradeOfferScreen.

**Expected Result:**
- Tax recalculates within ~300ms as the slider moves.
- **Tax base = full $30 item price** (NOT reduced by SP — BP-37).
- Tax amount stays at $1.91 (calculated on $30, not on $15 cash).
- Platform fee ($0.99) is still charged in cash.
- Recalculation applies on both TradeInitiationScreen and TradeOfferScreen.

**⚠️ Regression check:** Tax must NOT recalculate to a lower amount when SP changes. If the test shows tax dropping as SP increases, that is a BP-37 regression — file it immediately.

---

### ✅ TC-O03 · Tax is $0 when sales tax is disabled globally

**Steps:**
1. As **test-admin**, navigate to Tax → Settings and uncheck **"Enable sales tax collection"**.
2. As **test-buyer**, start checkout on any item.

**Expected Result:**
- Sales Tax line shows $0.00 (or is hidden).
- Total = item price + platform fee only.
- Stripe authorization = cash + fee (no tax).

---

### ✅ TC-O04 · Tax is $0 when the node tax rate is disabled

**Steps:**
1. As **test-admin**, navigate to Tax → Nodes and set test-buyer's node rate to 0%.
2. As **test-buyer**, start checkout.

**Expected Result:**
- Sales Tax = $0.00 for items in that node.
- Items in other nodes with non-zero rates still collect tax normally.

---

### ⏭️ TC-O05 · Tax-exempt user sees Tax Free badge

**Status:** Deferred to post-MVP — no tax exemption feature is implemented yet. Do not fail this case; confirm it is still absent from the build and move on.

---

### ✅ TC-O06 · Transaction history shows tax details

**Steps:**
1. Complete a taxable purchase as **test-buyer**.
2. Navigate to **Trades → History** → select the completed trade.
3. Scroll to **Payment Details** card.

**Expected Result:**
- Payment Details shows: Cash Paid, SP Used (if any), Platform Fee, **Sales Tax**, Total.
- Tax amount matches the value stored at offer time (from the trade's recorded tax amount).
- Tax rate and jurisdiction are NOT shown (simplified for buyers).

---

### ⏭️ TC-O07 · Refund shows proportional tax refunded

**Status:** Admin dispute refund flow exists, but an end-user "refund detail view" showing proportional tax is deferred.

**When implemented, verify:**
- Partial refund (50%) → tax refunded = 50% of original tax.
- Full refund → tax refunded = 100% of original tax.
- Multiple partial refunds accumulate correctly, never exceeding the original tax.

---

### ✅ TC-O08 · Tax shown on trade timeline/detail for buyer only

**Precondition:** Completed trade with captured tax.

**Steps:**
1. As **test-buyer**, open a completed trade → scroll to **Payment Details**.
2. As **test-seller**, open the same trade → scroll to **Payment Details**.

**Expected Result:**
- **Buyer view:** Shows Cash Paid, SP Used, Platform Fee, **Sales Tax** (with amount), Total.
- **Seller view:** Shows Cash Received, Platform Fee, SP Earned → **NO Sales Tax line**.
- Seller does NOT see tax (it's a buyer-side cost, not part of the seller's payout calculation).

---

## Group O-1 — Tax by Catalog Category (Admin Configuration)

**Focus:** Admin tax rules management, category mappings, price thresholds, versioning

### ✅ TC-O1-C01 · Admin creates a new tax rule for general_tangible_goods

**Steps:**
1. Admin portal → **Tax → Tax Rules** → tap **+ New Tax Rule**.
2. Select **General Tangible Goods** as Tax Category.
3. Enter Display Name: **"Standard CT Tangible Goods Rate"**.
4. Description: *"Default taxable rate for physical goods in Connecticut."*
5. Leave **Items in this category are taxable** checked.
6. Tax Rate: **6.35%**, Jurisdiction: **CT**.
7. Leave Min/Max price blank, Effective From = today, Effective To = blank (ongoing).
8. Tap **Create Rule**.

**Expected Result:**
- Success message: "Rule created successfully."
- Rule appears in the table with version **v1**, Active status, 6.35% rate, CT jurisdiction.
- Admin audit log has a "tax rule created" entry.

---

### ✅ TC-O1-C02 · Admin creates second rule for same category — overlap blocked

**Precondition:** Active ongoing rule exists for general_tangible_goods, CT (TC-O1-C01).

**Steps:**
1. Tap **+ New Tax Rule** → select General Tangible Goods, CT.
2. Effective From = today, Effective To = blank.
3. Tap **Create Rule**.

**Expected Result:**
- Save fails with error: **"Overlapping active tax rule exists for category..."**
- No duplicate rule is created.
- Original rule is unchanged.

---

### ✅ TC-O1-C03 · Admin edits existing rule — new version created

**Precondition:** Active rule exists (TC-O1-C01).

**Steps:**
1. Locate the rule → tap **Edit**.
2. Change Display Name to **"Updated CT Tangible Goods Rate (v2)"**.
3. Change Tax Rate to **6.99%**, Effective From = tomorrow.
4. Tap **Create New Version**.

**Expected Result:**
- Success: "Rule updated — new version 2 created."
- Original (v1) shows **Inactive**, Effective To = end of today.
- New (v2) shows **Active**, rate 6.99%, effective from tomorrow.
- Version History shows both v1 (Inactive) and v2 (Active).
- Admin audit log has a "tax rule updated" entry with before/after values.

---

### ✅ TC-O1-C04 · Admin deactivates a rule

**Steps:**
1. Locate an active rule → tap **Deactivate**.
2. Confirm in the modal.

**Expected Result:**
- Confirmation modal warns: "This will set the rule as inactive and close its effective period. Historical trades that used this rule retain their recorded tax calculation."
- Rule shows **Inactive** status, Effective To set to deactivation time.
- Rule no longer appears in active-rule lookups.

---

### ✅ TC-O1-C05 · Existing listings backfill to general_tangible_goods

**Steps:**
1. Ask engineering to confirm (or check via admin item list) that no active listing is missing a tax category.
2. Spot-check 10 existing listings across categories on the admin item list.

**Expected Result:**
- Zero listings are missing a tax category.
- All spot-checked listings default to **General Tangible Goods** (unless deliberately reassigned).
- No regressions in discovery or purchase flows for these listings.

---

### ✅ TC-O1-C06 · New single-listing creation receives default tax category

**Steps:**
1. As **test-seller**, create a new single listing.
2. As **test-admin**, open the listing's detail page in the admin portal.

**Expected Result:**
- The listing's Tax Category field shows **General Tangible Goods**.
- The listing is discoverable and purchasable.

---

### ✅ TC-O1-C07 · New bulk-listing creation receives default tax category

**Steps:**
1. As **test-seller**, create a bulk listing with 2+ items.
2. As **test-admin**, open each new item's detail page in the admin portal.

**Expected Result:**
- All bulk items show Tax Category = **General Tangible Goods**.
- All items appear in My Listings and are purchasable.

---

### ✅ TC-O1-C08 · Admin changes individual listing's tax category

**Steps:**
1. Admin portal → navigate to an item's detail page.
2. Scroll to **Tax Category** field → tap **Change tax category**.
3. Select **Clothing and Footwear (clothing_footwear)** → tap **Save**.

**Expected Result:**
- Success message: "Tax category updated."
- Tax Category field shows the new category name after refresh.
- Admin audit log has an "item tax category changed" entry.

---

### ✅ TC-O1-C09 · Tax-exempt category configuration

**Steps:**
1. Navigate to **Tax → Tax Rules** → verify **Tax Exempt Goods** is in the category list.
2. Create a rule for Tax Exempt Goods with **Items in this category are taxable** unchecked.
3. As **test-buyer**, start checkout on an item mapped to Tax Exempt Goods.

**Expected Result:**
- `tax_exempt_goods` category is pre-seeded and selectable.
- Rule can be created with taxable = false.
- Checkout for that item shows **$0.00** Sales Tax.

---

### ✅ TC-O1-C10 · Price-threshold category configuration (clothing_footwear)

**Steps:**
1. Tax Rules page → create rule for **Clothing and Footwear**.
2. Display Name: **"CT Clothing — Under $50 threshold"**.
3. Tax Rate: 6.35%, Min Price: $0.00, Max Price: $50.00.
4. Save and verify in the table.

**Expected Result:**
- Rule saves successfully.
- Table shows price range: `$0.00 – $50.00`.
- Version History shows the rule with price thresholds.
- The overlap check does NOT block (different category from general_tangible_goods).

---

### ✅ TC-O1-C11 · Fee-in-tax-base toggle on and off

**Steps:**
1. Navigate to **Tax → Tax Settings**.
2. Check **Include marketplace transaction fee in sales-tax base** → tap **Save**.
3. Refresh and verify the checkbox is still checked.
4. As **test-buyer**, checkout a $30 item — note the tax amount.
5. Uncheck, save, and repeat checkout on a different $30 item — compare the tax amount.

**Expected Result:**
- Toggle is visible with a label and help text, and persists after refresh.
- With the box checked: tax base includes the $0.99 platform fee (tax slightly higher).
- After unchecking: tax base excludes the fee (tax back to the base item-price calculation).
- Change only affects new offers going forward, not past ones.

---

### ⏭️ TC-O1-C12 · Unauthorized user cannot view or edit tax configuration

**Status:** Deferred to post-MVP (admin role enforcement).

---

### ✅ TC-O1-C13 · Audit trail shows actor, timestamp, before/after values

**Steps:**
1. Perform a create, an edit, and a deactivate on a tax rule (TC-O1-C01/C03/C04).
2. Open the admin audit log / activity feed and filter for tax rule events.

**Expected Result:**
- Each operation (create, edit, deactivate) has its own audit row.
- Each row shows the acting admin, a timestamp, and (for edits) before/after values.

---

###  ✅  TC-O1-C14 · Admin views and edits category→tax-category mapping

**Steps:**
1. Admin portal → **Tax → Category Mapping**.
2. Verify the table shows all product categories with their current tax-category mappings.
3. For **Books**, tap **Change** → select **General Tangible Goods** → **Save**.
4. Change Books back to **Tax Exempt Goods** → **Save**.

**Expected Result:**
- Page loads with all product categories mapped (e.g., Books → Tax Exempt Goods by default; Clothing → Clothing and Footwear; all others → General Tangible Goods).
- Changing Books to General Tangible Goods saves successfully.
- Changing back also saves successfully.
- Both changes appear in the admin audit log.

---

### ✅  TC-O1-C15 · Category mapping change affects new listings immediately

**Steps:**
1. As **test-admin**, verify Books is mapped to **Tax Exempt Goods**.
2. As **test-seller**, create a new listing under **Books**.
3. Confirm (via admin item detail) it has Tax Category = Tax Exempt Goods.
4. As **test-admin**, change the Books mapping to **General Tangible Goods**.
5. As **test-seller**, create a *second* new listing under **Books**.
6. Confirm the second listing has Tax Category = General Tangible Goods, and the first listing is unchanged.

**Expected Result:**
- First listing keeps Tax Exempt Goods.
- Second listing (created after the mapping change) gets General Tangible Goods.
- No deploy/app restart is needed — the change applies immediately.

---

### ✅  TC-O1-C16 · Admin cannot map to a non-existent or inactive tax category

**Steps:**
1. Open **Tax → Category Mapping** → tap **Change** on any row.
2. Attempt to save with an empty dropdown selection.

**Expected Result:**
- Save button is disabled, or a validation error is shown, when no category is selected.
- The mapping remains unchanged until a valid category is chosen and saved.

---

### ✅ TC-O1-C17 · Admin filters tax rules by active / inactive status

**Steps:**
1. Admin portal → **Tax → Tax Rules**.
2. Locate the **status filter dropdown** next to the category filter (data-testid: `tax-rule-filter-status`).
3. Verify it shows **"All statuses"** by default and all rules are visible.
4. Select **"Active only"** from the dropdown.

**Expected Result:**
- Table updates to show only rules with an **Active** (green) badge.
- Inactive rules are hidden.
- No page reload / loading spinner — filter applies instantly.

**Steps (continued):**
5. Select **"Inactive only"** from the dropdown.

**Expected Result:**
- Table updates to show only rules with an **Inactive** (gray) badge.
- Active rules are hidden.

**Steps (continued):**
6. Select **"All statuses"** again.
7. Apply a category filter alongside the status filter (e.g., category = "Clothing and Footwear" + status = "Active only").

**Expected Result:**
- Both filters apply simultaneously.
- Only active rules for the selected category are shown.
- Switching back to "All statuses" shows all rules for that category.
- Clearing the category filter shows all active rules across all categories.

---

## Group O-2 — Tax Status Lifecycle (Capture Deferred to Completion)

**Focus:** Tax state machine (quoted → collected → refunded/voided), capture timing, SP interaction

**Tax status values (for QA reference — visible only via admin reports, not the buyer app):**
- `quoted` — Offer submitted, payment authorization hold exists, no money moved yet.
- `collected` — Payment capture succeeded at trade completion; tax is payable.
- `voided` — Authorization canceled/declined/expired before capture (cancel, decline, or expiry).
- `capture_failed` — Capture attempt failed; trade stays in progress for retry/support.
- `refunded` / `partially_refunded` — Captured tax refunded in full or in part.

```
                      ┌─────────────────┐
                      │    quoted       │ ← Created at offer submission
                      └────────┬────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
         collected         voided        capture_failed
       (capture OK)    (cancel/decline/   (capture failed)
                          expiry)
              │                │                │
              ▼                ▼                ▼
        refunded/         (terminal)      can retry →
        partially_                           quoted (retry)
        refunded                              or voided
        (money refunded)
```

---

### ✅ TC-O2-C01 · Single taxable item, no SP — offer is authorized, not collected

**Precondition:** Seller's node has 6.35% tax, item is General Tangible Goods, buyer has a saved payment method.

**Steps:**
1. As **test-buyer**, submit an offer on a $30 item with SP = 0.
2. Open the trade's Payment Details while it is still **Pending**.

**Expected Result:**
- Payment Details shows **"Payment authorized"** wording (see TC-O3-C01), not "Paid".
- Sales Tax preview shows **$1.91** (calculated on $30 at 6.35%).
- No charge has been made to the buyer's card yet (authorization hold only).

---

### ✅ TC-O2-C02 · Bundle with taxable, exempt, and threshold items — line-level tax correct

**Precondition:** Seller has 3 items: Item A = General Tangible Goods (taxable), Item B = Tax Exempt Goods, Item C = Clothing/Footwear with a price-threshold rule (under $50).

**Steps:**
1. Add all 3 items to cart and checkout as a bundle.
2. Review the checkout breakdown and, after submission, each trade's Payment Details.

**Expected Result:**
- Item B contributes **$0.00** tax (not taxable).
- Item C's tax reflects the threshold rule correctly.
- Item A's tax uses the standard rate.
- The combined offer's authorization = sum of cash + fees + tax (for taxable items only).

---

### ⚠️ TC-O2-C03 · Platform-fee tax toggle off and on — tax base changes by fee amount

**Steps:**
1. Confirm with **test-admin** that "include fee in tax base" is OFF.
2. As **test-buyer**, submit an offer on a $30 item with no SP — note the tax amount ($1.91).
3. Ask **test-admin** to turn the toggle ON.
4. As **test-buyer**, submit a second offer on a different $30 item with no SP.
5. Compare the two tax amounts.

**Expected Result:**
- First offer (fee NOT in base): tax = **$1.91** (on $30.00).
- Second offer (fee IN base): tax = **$1.97** (on $30.99, including the $0.99 fee).
- The first offer's stored tax amount is unchanged — the toggle is not retroactive.

---

### ✅ TC-O2-C04 · SP used — taxable base unchanged, cash reflects SP tender

**Precondition:** Item is $30 Accept SP, buyer has ≥ 15 SP.

**Steps:**
1. Open the $30 item → apply 15 SP (max 50%).
2. Submit the offer and open Payment Details.

**Expected Result:**
- Sales Tax = **$1.91**, calculated on the **full $30 item price** — NOT $15 (BP-37).
- Cash Paid/authorized reflects $15 + platform fee + tax (SP reduced cash, not the taxable base).

---

### ✅ TC-O2-C05 · Seller accepts — tax remains authorized, not collected

**Precondition:** A quoted (Pending) offer exists.

**Steps:**
1. As **test-seller**, accept the pending offer.
2. As **test-buyer**, reopen the trade's Payment Details (now In Progress).

**Expected Result:**
- Trade moves to **In Progress**.
- Payment Details still reads **"Payment authorized"** and **"Estimated Sales Tax"** (unchanged from Pending — capture has not happened).

---

### ✅ TC-O2-C06 · Buyer cancels while Awaiting Seller — auth voided, SP released once

**Precondition:** A pending offer exists that used SP.

**Steps:**
1. As **test-buyer**, tap **Cancel Trade** → select a reason → confirm.
2. Check the buyer's SP wallet balance before and after.

**Expected Result:**
- Trade moves to **Cancelled**.
- No charge occurs; the authorization is released.
- SP is restored to available exactly once (no duplicate restoration).

---

### ✅ TC-O2-C07 · Seller declines and offer expiry — auth voided in both paths

**Steps:**
1. **Decline path:** As **test-seller**, decline a pending offer.
2. **Expiry path:** Let a different pending offer reach its expiry window without a seller response.
3. Check both trades' final status and the buyer's SP wallet.

**Expected Result (both paths):**
- Trade moves to **Cancelled**.
- No charge occurs; SP is released back to the buyer exactly once.

---

### ✅ TC-O2-C08 · Buyer completes successfully — capture succeeds, tax collected

**Precondition:** In Progress trade, payment still only authorized.

**Steps:**
1. As **test-buyer**, tap **[I Got It]** → **[Confirm]**.
2. Reopen the trade's Payment Details.

**Expected Result:**
- Trade moves to **Completed**.
- Payment Details now reads **"Paid"** and **"Sales Tax"** (no longer "authorized"/"Estimated").
- Seller's pending SP balance increases (if Accept SP); seller payout begins processing.

---

### ✅ TC-O2-C09 · Auto-complete after 48 hours — capture succeeds, tax collected

**Precondition:** In Progress trade past the auto-complete window (QA fast-forwards the clock).

**Steps:**
1. Allow the trade to reach its auto-complete time without the buyer tapping [I Got It].
2. Reopen the trade after auto-complete fires.

**Expected Result:**
- Same outcome as TC-O2-C08 (capture succeeds, tax collected, seller paid).
- Buyer receives an auto-complete notification.

---

### ⚠️ TC-O2-C10 · Capture failure — no payout, no collected tax, recovery state visible

**Precondition:** In Progress trade with an authorization that has since become invalid (e.g., card expired/removed).

**Steps:**
1. Before tapping [I Got It], invalidate the buyer's saved payment method if possible in the test environment.
2. As **test-buyer**, tap **[I Got It]** → **[Confirm]**.
3. Observe the error and reopen the trade.

**Expected Result:**
- Error message: "Payment capture failed. Please try again or contact support."
- Trade remains **In Progress** (NOT completed).
- No SP released to the seller, no payout created.
- The buyer can retry, or support/admin can intervene.

---

### ⚠️ TC-O2-C11 · Duplicate retry — no duplicate tax collection, payout, or SP event

**Steps:**
1. On a trade that has just completed (tax collected), attempt to trigger completion again if the UI allows a retry tap.
2. Check the seller's SP ledger and payout list for duplicates.

**Expected Result:**
- No second SP credit and no second payout record are created for the same trade.
- The system treats the repeat action as a no-op ("already completed").

---

### ✅ TC-O2-C12 · Historical/backfill records — never falsely marked as collected

**Steps:**
1. Ask **test-admin** to open the Tax Reports page and review the status breakdown (Collected / Pending / Voided) for trades that existed before the tax status feature shipped.

**Expected Result:**
- Completed trades from before the feature shipped show as **Collected**.
- Cancelled trades from before the feature shipped show as **Voided**.
- No pending/in-progress trade is ever falsely shown as Collected.

---

## Group O-3 — Tax Refund & Reconciliation Integrity

**Focus:** Buyer-facing wording changes across the payment lifecycle, admin refund flow, reporting integrity

**Refund flow (for QA reference):** Admin resolves a dispute as Refund → the system attempts the refund with the payment processor → on success, tax status becomes refunded/partially refunded; if the refund is still processing, tax status becomes pending_refund; if the refund fails, nothing changes and the dispute stays open for admin follow-up.

---

### ✅ TC-O3-C01 · Buyer wording: "Payment authorized" before capture (Awaiting Seller)

**Steps:**
1. As **test-buyer**, submit an offer → trade is **Pending**.
2. Open Trade Timeline → scroll to **Payment Details** card.

**Expected Result:**
- Label reads **"Payment authorized:"** (not "Cash Paid" or "Paid").
- Tax label reads **"Estimated Sales Tax"** (not "Sales Tax").
- All breakdown rows are visible: Swap Points, Platform Fee, Estimated Sales Tax, Total.

---

### ✅ TC-O3-C02 · Buyer wording: "Payment authorized" after seller accept (In Progress)

**Steps:**
1. From TC-O3-C01, have the seller accept → trade moves to **In Progress**.
2. As **test-buyer**, open Trade Timeline → scroll to Payment Details.

**Expected Result:**
- Label still reads **"Payment authorized:"** (capture has not happened yet).
- Tax label still reads **"Estimated Sales Tax"**.

---

### ✅ TC-O3-C03 · Buyer wording: "Paid" after successful capture (Completed)

**Steps:**
1. From TC-O3-C02, tap **[I Got It]** → **[Confirm]**.
2. Confirm the trade completes successfully.
3. Open the completed trade's Timeline → scroll to Payment Details.

**Expected Result:**
- Label now reads **"Paid:"** (not "Payment authorized").
- Tax label reads **"Sales Tax"** (not "Estimated Sales Tax").
- Final tax amount matches the amount shown throughout the trade (no surprise change at completion).

---

### ✅ TC-O3-C04 · Capture failure shows "payment could not be completed" (no completed state)

**Steps:**
1. From an In Progress trade, simulate a capture failure per TC-O2-C10.
2. As **test-buyer**, tap **[I Got It]** → **[Confirm]**.
3. Observe the error, then reopen the trade.

**Expected Result:**
- Error: **"Payment capture failed. Please try again or contact support."**
- Trade remains **In Progress** (not completed).
- No SP released, no payout triggered.

---

### ✅ TC-O3-C05 · Admin dispute route: full refund with reversal (captured trade)

**Steps:**
1. Complete a trade with a successful capture.
2. As **test-buyer**, open a dispute.
3. As **test-admin**, navigate to the dispute → tap **Resolve → Refund** → confirm.

**Expected Result:**
- Trade status → **Cancelled**.
- Buyer receives a notification: "Your refund for [Item] has been issued."
- SP is released back to the buyer (exactly once).
- Tax Reports later show this trade's tax as refunded (see TC-O3-C13).

---

### ✅ TC-O3-C06 · Duplicate refund/retry is idempotent

**Steps:**
1. From TC-O3-C05, attempt to resolve the same dispute as **Refund** a second time (if the UI allows it).

**Expected Result:**
- No second refund is issued.
- The buyer does not receive a second refund notification.
- SP is not restored a second time.

---

### ✅ TC-O3-C07 · Admin dispute route: uncaptured trade is cancelled (not refunded)

**Steps:**
1. From an In Progress trade that has NOT yet been completed (no capture), open a dispute.
2. As **test-admin**, resolve as **Refund**.

**Expected Result:**
- No refund notification is shown (nothing was ever charged) — instead the buyer sees a cancellation notice.
- SP is returned to the buyer, trade is cancelled.

---

### ⚠️ TC-O3-C08 · Admin dispute route: refund failure stays unresolved

**Steps:**
1. Complete a trade (captured), open a dispute.
2. If the test environment can simulate a refund failure (ask engineering), attempt to resolve as **Refund**.
3. Observe the error.

**Expected Result:**
- Admin sees an error such as: "Refund failed: [reason]."
- Dispute status remains **under_review** (not resolved).
- Trade status is NOT changed to cancelled.
- No SP is released, buyer is not notified of a refund.

---

### ⚠️ TC-O3-C09 · Refund pending → shows as pending, not yet refunded

**Steps:**
1. Complete a trade, open a dispute.
2. As **test-admin**, resolve as **Refund**.
3. Immediately check the Tax Reports page (before the refund provider confirms).

**Expected Result:**
- Admin reports show the record under "Pending Refund" (not "Tax Refunded") until confirmation arrives.
- Once confirmed, the record moves to "Tax Refunded" without any manual admin action.

---

### ✅ TC-O3-C10 · Report: newly submitted offer → Pending/Authorized Tax

**Steps:**
1. As **test-buyer**, submit an offer on a taxable item.
2. As **test-admin**, open **Tax → Reports** for a date range covering today.

**Expected Result:**
- The new offer's tax appears under **Pending/Authorized Tax**, not Tax Collected.
- Net Tax Payable does not include this pending amount yet.

---

### ✅ TC-O3-C11 · Report: captured trade → Tax Collected using capture timestamp

**Steps:**
1. Complete a trade (buyer confirms → capture succeeds).
2. As **test-admin**, run the report summary for the appropriate date range.

**Expected Result:**
- Tax Collected total increases by this trade's tax amount.
- If the capture date differs from the offer date, the tax appears in the capture period's report, not the offer period's.

---

### ✅ TC-O3-C12 · Report: cancelled/declined/expired → Voided/Expired Tax, not collected

**Steps:**
1. Have a pending offer cancelled (buyer cancels before seller accepts).
2. As **test-admin**, run the report summary.

**Expected Result:**
- This trade contributes **$0** to Tax Collected.
- It appears under Voided/Expired Tax instead.
- Net Tax Payable excludes it.

---

### ✅ TC-O3-C13 · Report: refunded trade → Tax Refunded, Net adjusts

**Steps:**
1. Complete a trade (capture succeeds), note the Tax Collected total.
2. Issue a full refund via admin dispute resolution (TC-O3-C05).
3. As **test-admin**, run the report summary covering both events.

**Expected Result:**
- Tax Collected still includes the original captured tax.
- Tax Refunded equals the refunded tax amount.
- Net Tax Payable = Collected − Refunded (correctly reduced).

---

### ✅ TC-O3-C14 · Report: CSV totals match on-screen totals

**Steps:**
1. Run the report summary for a date range, note the on-screen totals.
2. Export CSV for the same date range.
3. Sum the relevant CSV columns and compare.

**Expected Result:**
- Sum of CSV tax-amount column = on-screen Tax Collected total.
- Sum of CSV refunded-tax column = on-screen Tax Refunded total.
- Sum of CSV net-tax column = on-screen Net Tax Payable total.

---

## Group P — Tax (Admin)

### TC-P01 · Node tax rate configuration (view/edit with validation)

**Actors:** Admin

**Objective:** Verify admins can view and edit per-node tax rate, jurisdiction, and enabled flag with validation.

**Steps:**
1. In the **admin portal**, open the **Tax → Nodes** page.
2. Edit a node's tax rate to a valid value (e.g., 6.35%) and set its jurisdiction; save via the confirmation modal.
3. Try to save an invalid rate (e.g., -1% or 150%).

**Expected Result:**
- Each node shows its tax rate, jurisdiction, and enabled/disabled status.
- A confirmation modal appears before saving a change; valid saves show a success notification and persist after refresh.
- Invalid rates (outside 0–100%) or a missing jurisdiction are blocked with a validation message.

### TC-P02 · Bulk tax update across nodes

**Actors:** Admin

**Objective:** Verify a single rate can be applied to multiple nodes at once.

**Steps:**
1. On the **Tax → Nodes** page, open the bulk update form.
2. Apply one rate (e.g., 6.35%) to all enabled nodes and confirm.

**Expected Result:**
- The chosen rate is applied to all enabled nodes only.
- A success notification appears and the updated rates persist after refresh.

### TC-P03 · Tax rate change history / audit

**Actors:** Admin

**Objective:** Verify tax rate changes are logged for compliance.

**Steps:**
1. Change a node's tax rate and save.
2. Open the tax rate change history for that node.

**Expected Result:**
- The history shows who changed the rate, when, and the old and new values.

### TC-P04 · Global tax settings toggle and warning banner

**Actors:** Admin

**Objective:** Verify global tax settings can be edited and a warning shows when tax is disabled.

**Steps:**
1. Open the **Tax → Settings** page.
2. Toggle global sales tax off and save.
3. Edit the default tax rate, the "subscription fee taxable" toggle, and the remittance jurisdiction; save.

**Expected Result:**
- The global on/off toggle, default rate (validated 0–100%), subscription-fee-taxable toggle, and remittance jurisdiction all save and persist.
- A warning banner appears while sales tax is disabled globally.

### TC-P05 · Tax reporting dashboard: summary cards and date presets

**Actors:** Admin

**Objective:** Verify the reporting dashboard shows tax totals and supports date presets.

**Steps:**
1. Open the **Tax → Reports** page.
2. Switch the date range using presets (This Month, Last Month, Q1–Q4, YTD, All Time).

**Expected Result:**
- Summary cards show tax collected, refunded, and net owed, plus transaction count / average tax.
- Changing the date preset updates the figures; the page loads within ~2 seconds for a 1-year range.

### TC-P06 · Jurisdiction breakdown and report types

**Actors:** Admin

**Objective:** Verify jurisdiction breakdown and all report types are accessible.

**Steps:**
1. On the **Tax → Reports** page, view the jurisdiction breakdown table.
2. Switch between the report types (summary, transactions, refunds, jurisdictions, by-period, tax-exempt, audit trail).

**Expected Result:**
- The jurisdiction table shows tax amounts per node/jurisdiction.
- Each of the 7 report types loads its corresponding data; empty ranges show a graceful empty state.

### TC-P07 · CSV export for filing

**Actors:** Admin

**Objective:** Verify tax data can be exported as CSV.

**Steps:**
1. On the **Tax → Reports** page, set a date range and tap **Export CSV**.

**Expected Result:**
- A CSV file downloads containing transaction date, buyer email, node name, taxable amount, tax rate, tax amount, refunded tax, and net tax, with USD/percent formatting.

### TC-P08 · Admin rate change applies to new transactions only

**Actors:** Admin, test-buyer

**Objective:** Verify changing a node rate affects new transactions, not past ones.

**Steps:**
1. Note the tax on an existing completed transaction.
2. In the **admin portal**, change that node's tax rate.
3. As **test-buyer** in that node, start a new checkout.

**Expected Result:**
- The new checkout's Sales Tax uses the updated rate.
- The previously completed transaction still shows the rate that was applied at its time of purchase.

---

## Group Q — Reviews & Ratings

**Ref:** MODULE-08 · REVIEW-001 through REVIEW-007 · Anti-Brigading Addendum

### TC-Q01 · Review prompt appears for both parties after trade completion

**Ref:** MODULE-08 REVIEW-001, REVIEW-002
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** A trade has just been completed (buyer tapped [I Got It] → [Confirm]).

**Objective:** Verify both buyer and seller are prompted to rate their counterparty immediately after a trade completes.

**Steps:**
1. Complete a trade as **test-buyer** using any listing type.
2. Observe the completion screen.
3. Log in as **test-seller** and open the same now-completed trade.
4. Observe the completion screen on the seller side.

**Expected Result:**
- The buyer's completion screen shows a **[Rate Seller]** button.
- The seller's completion screen shows a **[Rate Buyer]** button.
- Both buttons navigate to their respective `SubmitReview` screen showing the counterparty's name.

---

### TC-Q02 · Star rating required — submit blocked without rating

**Ref:** MODULE-08 REVIEW-001
**Actors:** test-buyer
**Precondition:** A trade has completed; the buyer is on the `SubmitReview` screen.

**Objective:** Verify the star rating is mandatory and the submit button is disabled until a rating is selected.

**Steps:**
1. Open the review screen (no star selected).
2. Tap **[Submit Review]** without selecting any stars.
3. Select 4 stars and observe the button state.

**Expected Result:**
- With no star selected, the submit button is visually disabled (greyed out) and tapping it shows an alert ("Please select a star rating.") or has no effect.
- After selecting at least 1 star the button becomes active and tapping it proceeds with submission.

---

### TC-Q03 · Comment is optional and capped at 500 characters

**Ref:** MODULE-08 REVIEW-001
**Actors:** test-buyer
**Precondition:** Buyer is on the `SubmitReview` screen.

**Objective:** Verify the comment field is optional and its character count is enforced.

**Steps:**
1. Select a star rating and tap **[Submit Review]** without entering any comment.
2. Open a new review screen; type a comment of exactly 501 characters.
3. Read the character counter.

**Expected Result:**
- A review with no comment submits successfully.
- The comment field enforces a 500-character limit — the 501st character cannot be entered.
- A live counter (e.g., "482/500") is shown below the field.

---

### TC-Q04 · Anonymous review hides reviewer identity

**Ref:** MODULE-08 REVIEW-003
**Actors:** test-buyer, test-seller

**Objective:** Verify an anonymous review shows "Anonymous User" on the reviewee's profile and hides their photo.

**Steps:**
1. On the review screen as **test-buyer**, check the **Post anonymously** checkbox, select 5 stars, and tap **[Submit Review]**.
2. Log in as **test-seller** and open your own profile → **Reviews** section.
3. Locate the review just submitted.

**Expected Result:**
- The review card shows "Anonymous User" instead of the buyer's name.
- The reviewer's avatar/photo is replaced with a generic placeholder.
- No other personally identifiable information from the buyer is shown.

---

### TC-Q05 · Skip review — no blocking, no re-prompt for same trade

**Ref:** MODULE-08 REVIEW-004
**Actors:** test-buyer
**Precondition:** A trade has completed; the buyer sees the [Rate Seller] button.

**Objective:** Verify skipping a review does not block any app flow and the prompt does not reappear for that trade.

**Steps:**
1. On the review screen, tap **[Skip]**.
2. Verify you are returned to the home or trade list without any blocker.
3. Reopen the completed trade and check whether a review prompt is shown again.

**Expected Result:**
- Tapping [Skip] dismisses the review screen immediately with no error or required action.
- The user lands on a subsequent screen (e.g., home or trade list) with no modal or blocker.
- Reopening the same completed trade does **not** re-surface a review prompt for that trade.

---

### TC-Q06 · Mutual review status shown on completed trade detail

**Ref:** MODULE-08 REVIEW-002
**Actors:** test-buyer + test-seller
**Precondition:** A trade has completed; only the buyer has submitted a review so far.

**Objective:** Verify each party can see review status ("Reviewed" or "Pending review") for both sides of the trade.

**Steps:**
1. After the buyer submits a review, open the completed trade detail as **test-buyer**.
2. Log in as **test-seller** and open the same completed trade before submitting a review.
3. Submit the seller's review, then reopen the trade detail.

**Expected Result:**
- Before the seller reviews: the trade detail shows "You reviewed ✓" for the buyer and "Awaiting their review" for the seller.
- After both reviews are submitted: both sides show a "Reviewed ✓" status.
- The [Rate Buyer] / [Rate Seller] button is replaced by a status label once submitted.

---

### TC-Q07 · Completed reviews visible on counterparty's public profile

**Ref:** MODULE-08 REVIEW-002, REVIEW-005
**Actors:** test-buyer
**Precondition:** test-seller has at least one received review.

**Objective:** Verify submitted reviews appear on the reviewee's public profile page.

**Steps:**
1. Submit a 4-star review with comment "Great seller, smooth pickup!" as **test-buyer** for **test-seller**.
2. Navigate to **test-seller**'s public profile (e.g., tap their name on an item listing).
3. Scroll to the **Reviews** section.

**Expected Result:**
- The review card shows: reviewer's name (or "Anonymous User" if anonymous), star rating, comment, and date.
- The review appears at or near the top of the reviews list (most recent first).
- The total review count on the profile increments by 1.

---

### TC-Q08 · Average rating and total count displayed on user profile

**Ref:** MODULE-08 REVIEW-005
**Actors:** test-buyer (viewing test-seller's profile)
**Precondition:** test-seller has at least 3 received reviews with known ratings (e.g., 5, 4, 3).

**Objective:** Verify the profile header shows the correct average and total count.

**Steps:**
1. Open **test-seller**'s public profile.
2. Locate the rating summary at the top of the Reviews section.

**Expected Result:**
- The large numeric average (e.g., "4.0") is shown alongside the corresponding star display.
- The total review count (e.g., "3 reviews") is shown below the stars.
- If a seller has no reviews, the rating is absent or a "No reviews yet" placeholder appears.

---

### TC-Q09 · Rating breakdown (5 → 1 stars) shown on profile

**Ref:** MODULE-08 REVIEW-005
**Actors:** test-buyer
**Precondition:** test-seller has reviews across multiple star levels.

**Objective:** Verify the rating breakdown chart shows the correct per-star counts.

**Steps:**
1. Open **test-seller**'s public profile and scroll to the rating breakdown.
2. Compare the bar widths and counts against the known review data.

**Expected Result:**
- A breakdown row for each of 5 → 1 stars shows a proportional bar and a numeric count.
- A star level with zero reviews shows a zero-width bar and "0".
- The sum of all per-star counts equals the total review count shown in TC-Q08.

---

### TC-Q10 · Edit review succeeds within 24h window

**Ref:** MODULE-08 REVIEW-001
**Actors:** test-buyer
**Precondition:** test-buyer submitted a review less than 24 hours ago.

**Objective:** Verify a review can be edited within the 24-hour edit window.

**Steps:**
1. Navigate to the review just submitted (e.g., via completed trade detail → View Review).
2. Tap **[Edit Review]**.
3. Change the star rating from 4 to 5 and update the comment to "Excellent seller!"
4. Tap **[Save Changes]**.
5. Reopen the review on **test-seller**'s profile.

**Expected Result:**
- The Edit Review screen is accessible and pre-populated with the existing rating and comment.
- After saving, the review card on the seller's profile reflects the updated rating (5 stars) and updated comment.
- An "edited" label or updated timestamp is visible on the card.

---

### TC-Q11 · Edit blocked after 24h window

**Ref:** MODULE-08 REVIEW-001
**Actors:** test-buyer
**Precondition:** test-buyer submitted a review more than 24 hours ago (QA fast-forwards or uses a pre-aged review).

**Objective:** Verify the edit option is unavailable once the 24-hour window has passed.

**Steps:**
1. Attempt to edit a review that is older than 24 hours.

**Expected Result:**
- The **[Edit Review]** option is absent or disabled.
- If the user attempts to edit via a deep link, an error message is shown: "Reviews can only be edited within 24 hours of submission."

---

### TC-Q12 · One review per trade — duplicate submission blocked

**Ref:** MODULE-08 REVIEW-001 (Anti-Brigading Addendum)
**Actors:** test-buyer
**Precondition:** test-buyer has already submitted a review for a specific completed trade.

**Objective:** Verify a second review attempt for the same trade is rejected.

**Steps:**
1. After submitting a review for a completed trade, navigate back to the review submission entry point for the same trade (e.g., via a direct deep link).
2. Attempt to submit a second review.

**Expected Result:**
- The review screen either does not load (showing "You've already reviewed this trade") or the submit returns an error.
- No duplicate review is created.
- The review count on the seller's profile does not increase.

---

### TC-Q13 · 30-day same-counterparty cooldown enforced

**Ref:** MODULE-08 Anti-Brigading Addendum
**Actors:** test-buyer
**Precondition:** test-buyer completed a second trade with test-seller within 30 days of leaving a review for the first trade.

**Objective:** Verify a user cannot leave more than one review for the same counterparty within a rolling 30-day window.

**Steps:**
1. As **test-buyer**, submit a review for **test-seller** on Trade A.
2. Within 30 days, complete Trade B with the same **test-seller**.
3. Attempt to submit a review for Trade B.
4. Fast-forward past 30 days from step 1 and attempt the review again.

**Expected Result:**
- The review screen for Trade B blocks submission and informs the user they reviewed this seller recently (within 30 days), with an approximate date when the cooldown expires.
- After the 30-day window elapses, the review for Trade B submits normally.

---

### TC-Q14 · 24h post-completion cooldown — review locked until 24h after trade completion

**Ref:** MODULE-08 Anti-Brigading Addendum
**Actors:** test-buyer
**Precondition:** A trade was completed less than 24 hours ago.

**Objective:** Verify the review submission is locked during the 24h cooling-off period after trade completion.

**Steps:**
1. Immediately after completing a trade (within the first 24h), tap **[Rate Seller]**.
2. Attempt to tap **[Submit Review]** before the cooldown expires.
3. Fast-forward past the 24h mark and attempt submission again.

**Expected Result:**
- During the cooldown the submit button is disabled or a message explains the review will unlock in "X hours" (e.g., "You can submit your review in 18h").
- After 24h have passed, the submit button becomes active and the review submits successfully.

---

### TC-Q15 · Flag a review (select reason)

**Ref:** MODULE-08 REVIEW-006
**Actors:** test-buyer (flagging a review on test-seller's profile)
**Precondition:** test-seller has a publicly visible review authored by a different user.

**Objective:** Verify any user can flag a review for inappropriate content and select a reason.

**Steps:**
1. Open **test-seller**'s public profile → Reviews section.
2. On a review card authored by another user, tap the overflow menu (⋯) and select **Report**.
3. On the report screen, choose reason **"Offensive"** and tap **[Submit Report]**.

**Expected Result:**
- An overflow or flag icon is visible on review cards not authored by the current user.
- The report reason options shown are: **Spam**, **Offensive**, **False information**, **Other**.
- After submitting, a confirmation appears: "Review reported. Thank you!"
- The review remains visible to the reporter immediately (it is not hidden until the 3-report threshold is reached).

---

### TC-Q16 · Auto-hide review after 3+ reports

**Ref:** MODULE-08 REVIEW-006
**Actors:** 3 distinct reporter accounts + test-buyer
**Precondition:** A review exists on test-seller's profile; 3 different users report it.

**Objective:** Verify a review is automatically hidden from public view once it accumulates 3 or more distinct reports.

**Steps:**
1. Using 3 separate test accounts, each report the same review with any valid reason.
2. As **test-buyer** (or any non-admin, non-reporter user), open **test-seller**'s public profile.

**Expected Result:**
- After the 3rd report is submitted, the review no longer appears in the public reviews list.
- The total review count on the seller's profile decrements by 1.
- The average rating recalculates excluding the hidden review.

---

### TC-Q17 · Cannot flag own review

**Ref:** MODULE-08 REVIEW-006
**Actors:** test-buyer
**Precondition:** test-buyer has previously submitted a review visible on test-seller's profile.

**Objective:** Verify users cannot flag reviews they themselves authored.

**Steps:**
1. Open **test-seller**'s profile as **test-buyer**.
2. Locate the review card that test-buyer submitted.
3. Look for a flag / report option on that card.

**Expected Result:**
- The overflow menu (⋯) or report option is absent on the reviewer's own review card.
- No report action is triggerable for self-authored reviews.

---

### TC-Q18 · Admin moderation queue shows reported reviews with counts and reasons

**Ref:** MODULE-08 REVIEW-007
**Actors:** test-admin
**Precondition:** At least one review has been auto-hidden (3+ reports, from TC-Q16).

**Objective:** Verify the admin moderation queue lists flagged reviews with full report details.

**Steps:**
1. Log in to the **admin portal** as **test-admin** and navigate to **Reviews → Moderation Queue**.
2. Locate the auto-hidden review from TC-Q16.
3. Expand or inspect its report details.

**Expected Result:**
- The queue lists each review's content, reviewer name, reviewee name, and total report count (e.g., "3 reports").
- Each individual report shows its reason (e.g., "offensive") and timestamp.
- Reviews are sorted by report count descending.
- Reviews with zero reports (visible, non-hidden) do **not** appear in the queue.

---

### TC-Q19 · Admin approves (unhides) a reported review

**Ref:** MODULE-08 REVIEW-007
**Actors:** test-admin
**Precondition:** An auto-hidden review is visible in the admin moderation queue.

**Objective:** Verify an admin can approve a flagged review, restoring public visibility and clearing all reports.

**Steps:**
1. In the moderation queue, locate the flagged review.
2. Tap **[Approve]** and confirm the confirmation prompt.
3. Open **test-seller**'s public profile as **test-buyer**.

**Expected Result:**
- The confirmation prompt reads "This will unhide the review and delete all reports." with [Cancel] and [Approve] actions.
- After confirming, the review disappears from the moderation queue.
- The review is publicly visible again on the seller's profile.
- The report count for that review resets to 0.
- The seller's total review count and average rating reflect the restored review.

---

### TC-Q20 · Admin deletes a reported review

**Ref:** MODULE-08 REVIEW-007
**Actors:** test-admin
**Precondition:** A review is visible in the admin moderation queue.

**Objective:** Verify an admin can permanently delete a flagged review.

**Steps:**
1. In the moderation queue, locate a flagged review.
2. Tap **[Delete]** and confirm the destructive confirmation prompt.
3. Open the reviewee's public profile as **test-buyer**.

**Expected Result:**
- The confirmation prompt warns "This action cannot be undone." with a destructive [Delete] action.
- After confirming, the review is removed from the moderation queue.
- The review is **not** visible on the reviewee's public profile.
- The total review count and average rating on the profile reflect the deletion.
- The deletion cannot be reversed from the admin UI.

---

## Group R — Refund & Cancellation State Machine

> This group covers the **trade-flow refund & cancellation state machine** (FLOW-27) end to end: every cancellation trigger, the resulting trade-state transition, and the refund settlement (cash, proportional sales tax, platform fee treatment, SP reversal, seller payout withholding, and notifications). Cross-references to trigger cases in Groups B, C, E, J, and O are noted where they exist.
>
> **State model (reference):** core trade states are `pending` → `in_progress` → `completed` / `cancelled`. Dispute is an overlay (`dispute_status`: reported → under_review → resolved) on `in_progress`, not a separate core state. Cancellation/refund outcomes set `cancelled` with a reason (`buyer_cancelled`, `seller_cancelled`, `cancelled_expired`, `cancelled_expired_competing`) and, where money moved, a refund settlement.

### TC-R01 · Buyer cancels pending trade → cancelled, auth voided, SP restored

**Ref:** FLOW-27 · TC-B04/TC-C02, D-30
**Actors:** test-buyer (subscriber) + test-seller

**Objective:** Verify cancelling before seller acceptance voids the Stripe payment authorization and restores reserved SP with no consequence.

**Steps:**
1. As **test-buyer**, submit an offer (using some SP) on an Accept SP listing so the trade is **Pending**.
2. Note the Stripe PaymentIntent ID (in `requires_capture` status).
3. Before the seller responds, open the trade and cancel it.
4. Verify the Stripe PaymentIntent was cancelled (`canceled` status).

**Expected Result:**
- The trade moves Pending → **Cancelled** (reason buyer_cancelled).
- The Stripe PaymentIntent transitions from `requires_capture` → `canceled` — the pre-auth hold is released, no charge to the buyer (D-30).
- The buyer's reserved SP returns to available (reserved → 0).
- No seller consequence level is applied; the listing returns to available.

### TC-R02 · Seller declines pending offer → cancelled, SP restored, auth released

**Ref:** FLOW-27 · TC-B01/TC-C02, D-30
**Actors:** test-buyer + test-seller

**Objective:** Verify a seller decline cancels the trade, releases the Stripe auth hold, and restores buyer's SP.

**Steps:**
1. With a Pending SP offer, note the Stripe PaymentIntent ID.
2. Log in as **test-seller** and decline it.
3. Verify the Stripe PaymentIntent was cancelled (`canceled` status).

**Expected Result:**
- The trade becomes **Cancelled** (seller decline); the Stripe PaymentIntent transitions from `requires_capture` → `canceled` (auth released, card NOT charged).
- The buyer's reserved SP is restored to available.
- The buyer is notified the offer was declined.

### TC-R03 · Offer expiry → auto-cancel + competing offers cancelled

**Ref:** FLOW-27 · TC-B02/TC-B03/TC-C03
**Actors:** test-buyer + test-seller

**Objective:** Verify offer expiry auto-cancels and competing offers are released when one is accepted.

**Steps:**
1. Submit an offer and let it reach the offer timeout without seller response.
2. Separately, on an item with multiple competing offers, have the seller accept one.

**Expected Result:**
- The expired offer auto-cancels (reason cancelled_expired); the buyer's hold and SP are restored.
- When one competing offer is accepted, the remaining competing offers are cancelled (cancelled_expired_competing) and those buyers' holds/SP are restored.

### TC-R04 · Card declined at offer submission → no trade created

**Ref:** FLOW-27 · TC-B06
**Actors:** test-buyer (declining test card)

**Objective:** Verify a declined authorization does not create a trade or hold.

**Steps:**
1. With a card that declines, attempt to submit an offer.

**Expected Result:**
- An error is shown; no Pending trade is created; no SP is reserved and no charge/hold remains.

### TC-R05 · Seller cancels in_progress → refund + consequence level

**Ref:** FLOW-27 · TC-J01/TC-C06
**Actors:** test-buyer + test-seller

**Objective:** Verify a post-acceptance seller cancellation refunds the buyer and records a consequence level.

**Steps:**
1. Take a trade to **In Progress** (seller accepted).
2. As **test-seller**, cancel the in_progress trade and pick a seller cancellation reason.

**Expected Result:**
- The trade moves In Progress → **Cancelled** (seller_cancelled).
- The buyer is fully refunded (see TC-R06) and any SP is restored (see TC-R07). The `cancel_trade_v2` RPC correctly queries `sp_ledger.amount` (not the non-existent `sp_ledger.balance`) to calculate the SP refund.
- A seller consequence level (1/2/3) is applied per prior post-acceptance cancellations; at level 3 the seller is flagged for admin review.
- The seller cancel button is only visible when `trade.status === 'in_progress'` and there is no unresolved dispute. The cancellation reason modal shows seller-specific reasons ("Can't do pickup", "Item no longer available", "Other").

### TC-R06 · Refund settlement breakdown (cash + proportional tax + fee)

**Ref:** FLOW-27 · TC-O07
**Actors:** test-buyer + test-seller

**Objective:** Verify the refunded amounts: cash, proportional sales tax, and platform fee treatment.

**Steps:**
1. From a cancelled/refunded in_progress trade (TC-R05) or an admin refund (TC-R09), open the trade detail / transaction history.

**Expected Result:**
- The cash amount is refunded to the buyer's original payment method.
- The sales tax is refunded proportionally to the refunded amount.
- The platform fee is handled per policy (refunded or retained) and the breakdown is shown clearly in the transaction history / refund summary.

### TC-R07 · SP reversal on refund (reserved/transferred returned)

**Ref:** FLOW-27 · TC-C06
**Actors:** test-buyer + test-seller

**Objective:** Verify SP is reversed correctly on a refund regardless of trade stage.

**Steps:**
1. For an SP-using trade that is cancelled/refunded while in_progress, check the buyer and seller SP wallets.

**Expected Result:**
- The buyer's SP (reserved, or already released to the seller's pending at completion) is reversed back to the buyer's available balance.
- The seller does not retain buyer SP or the platform SP reward for a refunded trade.

### TC-R08 · Seller payout withheld / cancelled on refund

**Ref:** FLOW-27 · TC-F02
**Actors:** test-seller

**Objective:** Verify a refunded trade does not pay out to the seller.

**Steps:**
1. For a refunded/cancelled in_progress trade, review the seller's payout/earnings.

**Expected Result:**
- No payout is created (or a pending payout is cancelled/withheld) for the refunded trade; the seller's available balance does not include the refunded trade's proceeds.

### TC-R09 · Admin dispute resolve → Refund (full settlement)

**Ref:** FLOW-27 · TC-E06/TC-O07
**Actors:** test-admin + test-buyer + test-seller

**Objective:** Verify an admin dispute resolution to Refund triggers the full settlement.

**Steps:**
1. Open a dispute on an in_progress trade; as **test-admin**, resolve it as **Refund**.

**Expected Result:**
- The trade is cancelled/refunded; cash + proportional tax are refunded to the buyer (TC-R06), SP is reversed (TC-R07), the seller payout is withheld (TC-R08), and both parties are notified (TC-R11).

### TC-R10 · Admin dispute resolve → Complete (no refund)

**Ref:** FLOW-27 · TC-E05
**Actors:** test-admin + test-buyer + test-seller

**Objective:** Verify resolving a dispute as Complete settles in the seller's favor (no refund).

**Steps:**
1. On a disputed in_progress trade, as **test-admin** resolve as **Complete**.

**Expected Result:**
- The trade moves to **Completed**; SP releases to the seller and the seller payout proceeds; no refund is issued to the buyer.

### TC-R11 · Refund / cancellation notifications to both parties

**Ref:** FLOW-27 · TC-G01/TC-G02
**Actors:** test-buyer + test-seller

**Objective:** Verify both parties are notified of a cancellation/refund.

**Steps:**
1. Trigger each cancellation/refund path (buyer cancel, seller decline, expiry, seller in_progress cancel, admin refund) and check both parties' notification centers.

**Expected Result:**
- Each party receives an appropriate notification (e.g., "Offer declined", "Trade cancelled", "You've been refunded"), deep-linking to the relevant trade.

### TC-R12 · Refund idempotency — no double refund

**Ref:** FLOW-27
**Actors:** test-admin

**Objective:** Verify a refund cannot be applied twice.

**Steps:**
1. On an already refunded/cancelled trade, attempt to resolve/refund again (admin) or retry the action.

**Expected Result:**
- The action is rejected or is a no-op; the buyer is not refunded twice and SP is not restored twice; the trade remains in its terminal cancelled/refunded state.

### TC-R13 · Cancelled / refunded trade status + timeline

**Ref:** FLOW-27
**Actors:** test-buyer + test-seller

**Objective:** Verify the terminal status and event timeline reflect the cancellation/refund.

**Steps:**
1. Open a cancelled/refunded trade's detail/timeline as both buyer and seller.

**Expected Result:**
- The trade shows a terminal **Cancelled** (or refunded) status with the correct reason; the timeline lists the cancellation/refund event with timestamp; the trade no longer auto-completes and exposes no further action CTAs.

---

## Regression checks (run after any change to trade screens)

### TC-R01 · Value stack totals correct

**Objective:** Verify the value stack math is correct for a $25 item + 5 SP.
**Steps:**
1. Open the offer screen for a $25 item and enter 5 SP (subscriber) or view as free user.
**Expected Result:**
- Subscriber total cash is $19.01; free-user total cash is $22.01.

### TC-R02 · Buyer cancel shows no consequence

**Objective:** Verify cancelling a pending trade as buyer never shows a consequence level.
**Steps:**
1. Cancel a pending trade as the buyer.
**Expected Result:**
- A generic cancellation message appears with no Level 1/2/3 text.

### TC-R03 · Single (non-bundle) completion has no Confirm All

**Objective:** Verify completing a non-bundle trade does not show the bundle dialog.
**Steps:**
1. Complete a non-bundle trade as the buyer.
**Expected Result:**
- The trade completes directly with no "Confirm All" prompt.

### TC-R04 · Seller cancel button hidden on completed trade

**Objective:** Verify the seller cancel button is conditional on status.
**Steps:**
1. Open a completed trade as the seller.
**Expected Result:**
- No seller cancel button is shown.

### TC-R05 · Disputed trade not auto-completed

**Objective:** Verify a disputed trade is skipped by auto-complete.
**Steps:**
1. With a reported dispute open, allow the auto-complete window to pass.
**Expected Result:**
- The trade remains In Progress and is not completed.

### TC-R06 · Disputed trade does not release SP

**Objective:** Verify SP is not released while a dispute is open.
**Steps:**
1. With a reported dispute open, allow the SP-release window to pass.
**Expected Result:**
- No SP is released to the seller while the dispute is open.

### TC-R07 · SP reserved before seller sees offer

**Objective:** Verify SP is reserved immediately on offer submission.
**Steps:**
1. Submit an SP offer and check the buyer wallet before the seller opens the offer.
**Expected Result:**
- The reserved SP is already reflected in the buyer's wallet.

### TC-R08 · Free buyer SP gating

**Objective:** Verify free buyers see the SP lock but can still request to buy.
**Steps:**
1. Open an Accept SP item as a free buyer.
**Expected Result:**
- [Use SP] shows a lock icon; [Request to Buy] has no lock.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Core happy path — cash only full flow (S1) | TC-A01 |
| Core happy path — SP full flow (S5) | TC-A02 |
| Accept SP / pay cash — platform SP earned (S4) | TC-A03 |
| Donate listing — [Claim] no charge (§4.2) | TC-A04 |
| Seller declines offer (S2) | TC-B01 |
| Offer expiry + seller ignore prompt (S3) | TC-B02 |
| Multiple competing offers — sort + auto-decline (S6) | TC-B03 |
| Buyer cancel pending — no consequence | TC-B04 |
| Max 3 pending offers | TC-B05 |
| Card declined at submission (no trade, no SP, no Stripe PI — D-30 atomicity) | TC-B06 |
| Stripe pre-auth hold placed at offer submission (D-30) | TC-A01, TC-A02, TC-B06 |
| Stripe pre-auth captured on seller accept (D-30) | TC-A01, TC-A02 |
| Stripe pre-auth released on seller decline (D-30) | TC-B01, TC-R02 |
| Stripe pre-auth released on buyer cancel pending (D-30) | TC-B04, TC-R01 |
| Stripe pre-auth released on offer expiry (D-30) | TC-B02, TC-R03 |
| SP reserved on offer submit | TC-C01 |
| SP restored on seller decline | TC-C02 |
| SP restored on offer expiry | TC-C03 |
| SP stays reserved when seller accepts | TC-C04 |
| SP released to seller at completion | TC-C05 |
| SP restored on seller cancel in_progress | TC-C06 |
| Free user — locked Use SP + upgrade modal (S9) | TC-C07 |
| SP slider 50% cap (FR-SP-003) | TC-C08 |
| Auto-complete fires when buyer inactive (S7) | TC-D01 |
| Auto-complete skipped when dispute open (§6.2.4) | TC-D02 |
| Offer countdown pill color states (§8.1) | TC-D03 |
| Auto-complete banner buyer-only (§8.2) | TC-D04 |
| Post-meetup nudge after auto-complete | TC-D05 |
| Buyer opens dispute modal (S10, §6.2.3) | TC-E01 |
| Dispute blocks auto-complete + SP + payout (§6.2.4) | TC-E02 |
| Buyer UI during dispute (§11.4) | TC-E03 |
| Seller UI during dispute (§11.4) | TC-E04 |
| Admin resolves → Complete (§6.2.2) | TC-E05 |
| Admin resolves → Refund (§6.2.2) | TC-E06 |
| Payout shown on clean completion (§6.3.1) | TC-F01 |
| Payout held during dispute (§6.3.1) | TC-F02 |
| Payout needs action — no payout method (§6.3.3) | TC-F03 |
| Offer expiry reminders to seller (§9.2) | TC-G01 |
| Auto-complete reminders to buyer (§9.2) | TC-G02 |
| Notification throttle per trade (§9.5) | TC-G03 |
| Push notifications deep-link correctly (§9.5) | TC-G04 |
| Free buyer CTA on completion (§12) | TC-H01 |
| Subscriber buyer used SP — saved message (§12) | TC-H02 |
| Subscriber seller Accept SP — SP pending notice (§12) | TC-H03 |
| Subscriber seller Cash Only — upsell CTA (§12) | TC-H04 |
| Safe meetup card on in_progress (§11.5) | TC-I01 |
| Safe meetup card dismissible per trade (§11.5) | TC-I02 |
| In-chat safety banner persistent (V1-3) | TC-I03 |
| Pre-first-message safety modal once per listing (V1-5) | TC-I04 |
| Chat quick-reply chips on in_progress (§11.6) | TC-I05 |
| Seller cancel Level 1 alert (§11.7) | TC-J01 |
| Seller cancel Level 2 alert (§11.7) | TC-J02 |
| Seller cancel Level 3 + admin flag (§11.7) | TC-J03 |
| Seller cancel button visibility | TC-J04 |
| Seller cancel modal seller-specific reasons | TC-J05 |
| Value stack $0.99 subscriber fee | TC-K01 |
| Value stack $2.99 non-subscriber fee | TC-K02 |
| SP discount row conditional | TC-K03 |
| Bundle checkout — fee per item (admin toggle OFF) | TC-K04 |
| Bundle checkout — one fee per bundle (admin toggle ON) | TC-K05 |
| Bundle timeline — fee display matches charge mode | TC-K06 |
| Admin partial refund — refund price only, keep fee | TC-K07 |
| Admin partial refund — tax ledger partially refunded | TC-K08 |
| Payments reconciliation page — charged vs refunded | TC-K09 |
| Server-side enforcement — one fee per bundle w/ stale client | TC-K10 |
| Bundle banner on trade detail | TC-L01 |
| Confirm All shortcut for bundle | TC-L02 |
| Bundle offer rows in Offers tab | TC-L03 |
| Non-bundle offers single rows | TC-L04 |
| In-progress bundles in Buying tab | TC-L05 |
| Bundle banner in Review Offer screen | TC-L06 |
| Accept All N Items button | TC-L07 |
| Individual accept/decline alongside bundle | TC-L08 |
| Cart — add first item creates active cart | TC-M01 |
| Cart — add second item from same seller | TC-M02 |
| Cart — different-seller choice modal | TC-M03 |
| Cart — Replace Cart | TC-M04 |
| Cart — cannot add own item | TC-M05 |
| Cart — cannot add unavailable / out-of-node item | TC-M06 |
| Cart — duplicate item prevented | TC-M07 |
| Cart — remove item | TC-M08 |
| Cart — clear cart | TC-M09 |
| Cart — saved carts max 3 + LRU + switch | TC-M10 |
| Cart — minimum cart value warning + blocked checkout | TC-M11 |
| Cart — max SP available per item (subscriber) | TC-M12 |
| Cart — realtime item unavailable + 24h auto-remove | TC-M13 |
| Favorites — add / remove, no duplicate | TC-M14 |
| Favorites — availability status + empty state | TC-M15 |
| Cart toast — appears and auto-dismisses | TC-M16 |
| Cart toast — badge increments in sync | TC-M17 |
| Cart toast — "Trade Basket" copy | TC-M18 |
| Home dashboard Favorites quick-action tile | TC-M19 |
| Discover header heart icon navigates to Favorites | TC-M20 |
| Admin — minimum cart value config reflects in app | TC-N01 |
| Admin — minimum cart value validation | TC-N02 |
| Tax — checkout breakdown shows sales tax (0 SP) | TC-O01 |
| Tax — recalculates on SP-discounted amount | TC-O02, TC-K01 |
| Tax — $0 when disabled globally | TC-O03 |
| Tax — $0 when node tax disabled | TC-O04 |
| Tax — tax-exempt Tax Free badge | TC-O05 |
| Tax — transaction history tax details | TC-O06 |
| Tax — proportional refund | TC-O07 |
| Tax — hidden from seller view on completed trade | TC-O08 |
| Tax rules — create / overlap-block / version / deactivate | TC-O1-C01, TC-O1-C02, TC-O1-C03, TC-O1-C04 |
| Tax categories — listing backfill + new single/bulk listing defaults | TC-O1-C05, TC-O1-C06, TC-O1-C07 |
| Tax categories — admin changes item category | TC-O1-C08 |
| Tax categories — tax-exempt + price-threshold rule configuration | TC-O1-C09, TC-O1-C10 |
| Tax — fee-in-tax-base toggle | TC-O1-C11 |
| Tax rules — audit trail (actor/timestamp/before-after) | TC-O1-C13 |
| Tax — category → tax-category mapping (view/edit + immediate effect + validation) | TC-O1-C14, TC-O1-C15, TC-O1-C16 |
| Tax lifecycle — offer authorized, not collected (cash + bundle + fee toggle + SP) | TC-O2-C01, TC-O2-C02, TC-O2-C03, TC-O2-C04 |
| Tax lifecycle — seller accept keeps tax authorized | TC-O2-C05 |
| Tax lifecycle — cancel / decline / expiry voids tax, releases SP once | TC-O2-C06, TC-O2-C07 |
| Tax lifecycle — completion / auto-complete captures tax | TC-O2-C08, TC-O2-C09 |
| Tax lifecycle — capture failure recovery + duplicate-retry safety | TC-O2-C10, TC-O2-C11 |
| Tax lifecycle — historical records never falsely marked collected | TC-O2-C12 |
| Tax wording — "Payment authorized" → "Paid" across trade stages | TC-O3-C01, TC-O3-C02, TC-O3-C03, TC-O3-C04 |
| Tax refund — admin dispute full refund + idempotency + uncaptured-trade path | TC-O3-C05, TC-O3-C06, TC-O3-C07 |
| Tax refund — failure stays unresolved + pending-refund status | TC-O3-C08, TC-O3-C09 |
| Tax reports — pending/collected/voided/refunded classification | TC-O3-C10, TC-O3-C11, TC-O3-C12, TC-O3-C13 |
| Tax reports — CSV totals match on-screen totals | TC-O3-C14 |
| Admin tax — node rate config + validation | TC-P01 |
| Admin tax — bulk update | TC-P02 |
| Admin tax — rate change history / audit | TC-P03 |
| Admin tax — global settings + warning banner | TC-P04 |
| Admin tax — reporting summary + date presets | TC-P05 |
| Admin tax — jurisdiction breakdown + 7 report types | TC-P06 |
| Admin tax — CSV export | TC-P07 |
| Admin tax — rate change applies to new transactions | TC-P08 |
| Value stack includes sales tax line | TC-K01, TC-K02 |
| Reviews — prompt for both parties at completion (REVIEW-001/002) | TC-Q01 |
| Reviews — star rating required, submit blocked without rating (REVIEW-001) | TC-Q02 |
| Reviews — comment optional, max 500 chars (REVIEW-001) | TC-Q03 |
| Reviews — anonymous review hides reviewer identity (REVIEW-003) | TC-Q04 |
| Reviews — skip review, no blocking, no re-prompt (REVIEW-004) | TC-Q05 |
| Reviews — mutual review status on completed trade detail (REVIEW-002) | TC-Q06 |
| Reviews — reviews visible on counterparty profile (REVIEW-002) | TC-Q07 |
| Reviews — average rating and total count on profile (REVIEW-005) | TC-Q08 |
| Reviews — rating breakdown 5→1 stars on profile (REVIEW-005) | TC-Q09 |
| Reviews — edit within 24h succeeds (REVIEW-001) | TC-Q10 |
| Reviews — edit blocked after 24h (REVIEW-001) | TC-Q11 |
| Reviews — one review per trade, duplicate blocked (Anti-Brigading) | TC-Q12 |
| Reviews — 30-day same-counterparty cooldown (Anti-Brigading) | TC-Q13 |
| Reviews — 24h post-completion submission cooldown (Anti-Brigading) | TC-Q14 |
| Reviews — flag a review with reason (REVIEW-006) | TC-Q15 |
| Reviews — auto-hide after 3+ reports (REVIEW-006) | TC-Q16 |
| Reviews — cannot flag own review (REVIEW-006) | TC-Q17 |
| Reviews — admin moderation queue with counts and reasons (REVIEW-007) | TC-Q18 |
| Reviews — admin approves (unhides) reported review (REVIEW-007) | TC-Q19 |
| Reviews — admin permanently deletes reported review (REVIEW-007) | TC-Q20 |
| Refund/cancel — buyer cancels pending (FLOW-27) | TC-R01 |
| Refund/cancel — seller declines pending | TC-R02 |
| Refund/cancel — offer expiry + competing offers | TC-R03 |
| Refund/cancel — card declined no trade | TC-R04 |
| Refund/cancel — seller in_progress cancel + consequence | TC-R05 |
| Refund settlement — cash + proportional tax + fee | TC-R06 |
| Refund — SP reversal | TC-R07 |
| Refund — seller payout withheld | TC-R08 |
| Refund — admin dispute resolve Refund | TC-R09 |
| Refund — admin dispute resolve Complete (no refund) | TC-R10 |
| Refund/cancel notifications to both parties | TC-R11 |
| Refund idempotency (no double refund) | TC-R12 |
| Cancelled/refunded status + timeline | TC-R13 |

---

## Group S — Navigation Consistency & Bottom Nav

**Ref:** Navigation consolidation per `docs/flow-registry.md` (FLOW-00, FLOW-07)
**Actors:** test-buyer (any logged-in user)
**Objective:** Verify the bottom nav is persistent, consistent, and correct across every screen.

### TC-S01 · Bottom nav renders identically on Home (Dashboard)

**Steps:**
1. Log in and land on the Home / Dashboard screen.
2. Observe the bottom nav bar.

**Expected Result:**
- 5 items visible: Home (highlighted), Discover, orange Sell FAB, Inbox, Cart.
- Home icon is `House` (fill variant, green `#5DBB8E`).
- Labels read "Home", "Discover", "Inbox", "Cart".
- TestIDs: `tab-home`, `tab-discover`, `tab-sell`, `tab-inbox`, `tab-cart`.

---

### TC-S02 · Bottom nav renders identically on Discover

**Steps:**
1. From Home, tap the **Discover** tab.
2. Observe the bottom nav bar.

**Expected Result:**
- Same 5 items, same styling.
- Discover icon is active (green).
- No "Cart shortcut" icon in the search header area (removed — replaced by the persistent Cart tab).

---

### TC-S03 · Bottom nav renders identically on Inbox

**Steps:**
1. Tap the **Inbox** tab.
2. Observe the bottom nav bar.

**Expected Result:**
- Same 5 items, same styling.
- Inbox icon is active (green).

---

### TC-S04 · Bottom nav renders identically on Cart

**Steps:**
1. Tap the **Cart** tab.
2. Observe the bottom nav bar.

**Expected Result:**
- Same 5 items, same styling.
- Cart icon is active (green).

---

### TC-S05 · Bottom nav renders identically on Item Detail (stacked screen)

**Steps:**
1. From Discover, tap any listing to open Item Detail (stacked screen).
2. Observe the bottom nav bar.

**Expected Result:**
- Bottom nav is still visible with the same 5 items.
- The tab that the detail screen was pushed from (Discover) remains highlighted.
- No duplicate or missing items.

---

### TC-S06 · Bottom nav renders on Cart Checkout (stacked screen)

**Steps:**
1. Add items to cart and navigate to Cart Checkout.
2. Observe the bottom nav bar.

**Expected Result:**
- Bottom nav is still visible.
- Cart icon remains highlighted.
- Bar matches exactly the Home/Discover/Inbox styling.

---

### TC-S07 · Bottom nav renders on Trade screens (Timeline, Offer, Success)

**Steps:**
1. Navigate to any trade screen (Timeline, Offer, Review, Success, Dispute).
2. Observe the bottom nav bar at each screen.

**Expected Result:**
- Bottom nav is visible on every trade screen.
- The tab bar matches exactly (same icons, colors, FAB).

---

### TC-S08 · Bottom nav renders on Profile, Settings, Wallet, Subscriptions

**Steps:**
1. From Home header avatar, tap to open **Profile**.
2. Navigate to **Settings**, **SP Wallet**, **Subscription**, **My Listings**.
3. At each screen, observe the bottom nav.

**Expected Result:**
- Bottom nav is visible on every screen.
- Bar never changes or disappears regardless of how deep the user navigates.

---

### TC-S09 · Cart badge shows item count from multiple entry points

**Steps:**
1. Start with an empty cart. Verify Cart tab has **no badge**.
2. From Item Detail, tap **Add to Cart** (or use `rpc_cart_add_item` via another listing).
3. Immediately observe the Cart tab badge on the bottom nav.

**Expected Result:**
- Cart badge appears with the correct live item count.
- Badge is red (`#E85D75`), pill-shaped, font weight 700, white text.
- Badge updates in real time (no pull-to-refresh needed).

---

### TC-S10 · Cart badge count accuracy — add multiple items

**Steps:**
1. Add 3 different items from the same seller to the cart.
2. Observe the Cart tab badge.

**Expected Result:**
- Badge shows `3`.

---

### TC-S11 · Cart badge count accuracy — remove items

**Steps:**
1. From Cart screen, remove 1 item.
2. Go back to Discover/Home and observe the Cart tab badge.

**Expected Result:**
- Badge count decreases from 3 to 2 without manual refresh.

---

### TC-S12 · Cart badge clears when cart is emptied

**Steps:**
1. Clear the cart (remove all items or use Clear Cart).
2. Navigate to any screen and observe the Cart tab badge.

**Expected Result:**
- No badge (count = 0). Cart icon shows regular (unfilled) weight.

---

### TC-S13 · "Me" tab removal — Profile still accessible via Home avatar

**Steps:**
1. Verify there is NO "Me" tab in the bottom nav bar.
2. Tabs are: Home, Discover, Sell FAB, Inbox, Cart.
3. Tap the Home header avatar (left side of greeting) or the User icon (right side).
4. Confirm navigation opens **ProfileScreen**.

**Expected Result:**
- "Me" tab is absent from bottom nav.
- Profile screen still opens from Home header avatar/icon — no route is orphaned.

---

### TC-S14 · "Me" tab removal — no orphaned routes

**Steps:**
1. Search the codebase for references to `MeTab` or `tab-me` route strings.
2. Verify no code tries to navigate to `MeTab`.

**Expected Result:**
- `MeTab` and `tab-me` are fully removed from the app.
- No red screen, no console error, no broken deep link surfaces.

---

### TC-S15 · Sell FAB opens action sheet on every screen

**Steps:**
1. From Home, tap the orange Sell FAB → action sheet opens with "List One Item" and "Bulk Upload".
2. Dismiss, navigate to Discover, tap Sell FAB again → same sheet.
3. Navigate to Item Detail, Cart, Inbox — repeat.

**Expected Result:**
- Sell FAB works identically on every screen. Action sheet always shows both options.
- "List One Item" navigates to `ItemCreate`. "Bulk Upload" navigates to `BulkListingCreate`.

---

### TC-S16 · More from seller — Item Detail CTA in standalone position (below seller card)

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer + test-seller with 3+ approved listings

**Steps:**
1. Navigate to ItemDetailScreen for any listing from test-seller.
2. Scroll down to the Seller Info section.

**Expected Result:**
- A full-width green banner reading "This seller has X more items" appears BELOW the seller card (not inside it).
- The banner has a subtitle "Browse all items from this seller" and a "→" arrow.
- The banner is tappable and opens MoreFromThisSeller page.
- "Matches Your Cart" badge (if visible) is still inside the seller card, undisturbed.
- Contact Seller and View Profile buttons are where they were.

### TC-S17 · More from seller — Item Detail CTA hidden at 0 additional listings

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer + test-seller with only 1 approved listing

**Steps:**
1. Navigate to ItemDetailScreen for the seller's only listing.
2. Scroll down.

**Expected Result:**
- No "more from this seller" banner appears anywhere on the screen.
- Everything else in the Seller Info card renders normally.

### TC-S18 · More from seller — Item Detail CTA does not disrupt "Matches Your Cart" badge

**Ref:** SELLER-GROUP-004, SELLER-GROUP-007
**Actors:** test-buyer (active cart matches seller) + test-seller

**Steps:**
1. Ensure buyer has an active cart containing items from test-seller.
2. Navigate to ItemDetailScreen for a different listing from the same seller.
3. Observe the Seller Info card.

**Expected Result:**
- "Matches Your Cart" badge is still visible inside the seller card (not moved).
- The standalone CTA is below the card. Both elements visible and legible.

### TC-S19 · More from seller — Trade Basket banner shows correct remaining-item count

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer with cart from test-seller (1 item in cart, seller has 4 total listings)

**Steps:**
1. Open Trade Basket screen.
2. Scroll down past the items list and summary card.

**Expected Result:**
- A green banner appears between the summary card and the "Make one offer" CTA.
- Banner reads: "This seller has 3 more items" (4 total − 1 in cart = 3).
- Tapping "View" opens MoreFromThisSeller page.
- Banner has an X dismiss button.

### TC-S20 · More from seller — Trade Basket banner recalculates after adding item from filtered page

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer with 1 item in cart, test-seller with 4 total listings

**Steps:**
1. From Trade Basket, tap the "View" link on the banner → opens MoreFromThisSeller page.
2. Tap "Add to Trade Basket" on one of the items there → item is added.
3. Navigate back to Trade Basket.

**Expected Result:**
- Banner now reads "This seller has 2 more items" (was 3, now 2).
- The count correctly decreased by 1.

### TC-S21 · More from seller — Trade Basket banner disappears when all seller's listings are in basket

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer, test-seller with 3 total listings

**Steps:**
1. Add all 3 of the seller's listings to the cart.
2. Open Trade Basket.

**Expected Result:**
- No "more from this seller" banner appears.
- All 3 items are listed in the cart.

### TC-S22 · More from seller — Trade Basket banner dismissible via X button

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer with 1 item in cart, seller with 3+ listings

**Steps:**
1. Open Trade Basket → banner is visible.
2. Tap the X dismiss button on the banner.

**Expected Result:**
- Banner disappears and does not reappear during this cart session.
- All other cart content (items, summary, buttons) is unaffected.

### TC-S23 · More from seller — Banner and filtered page never reveal seller identity

**Ref:** TASK-ITEM-DETAILS-001, SELLER-GROUP-007
**Actors:** test-buyer, test-seller

**Steps:**
1. Open Item Detail for a seller's listing → observe the standalone CTA text.
2. Tap the CTA → observe the MoreFromThisSeller page title and content.
3. Repeat from Trade Basket banner.

**Expected Result:**
- CTA/banner text says "This seller" — never seller's name, avatar, or location.
- MoreFromThisSeller page title is "More items from this seller" — no seller identity.
- Individual item cards show no seller name or avatar.
- No PII leakage on either entry point.

### TC-S24 · Regression: Seller Info card elements unchanged

**Ref:** TASK-ITEM-DETAILS-001
**Actors:** test-buyer, test-seller

**Steps:**
1. Navigate to ItemDetailScreen for any listing.
2. Observe all elements in the Seller Info card.

**Expected Result:**
- Avatar, masked name (with lock icon), rating stars, "Matches Your Cart" badge (if applicable), Contact Seller button, View Profile button — all present at their original positions.
- Only the old inline "X more items" text is gone from inside the card.

### TC-S25 · Regression: Trade Basket subtotal/total/bundle CTA layout unaffected

**Ref:** CART-009, CART-014
**Actors:** test-buyer with cart items from one seller

**Steps:**
1. Add 2+ items from same seller to cart.
2. Open Trade Basket.

**Expected Result:**
- Summary card shows Subtotal and Total correctly.
- Bundle CTA ("Make one offer for these N items") appears below the "more from this seller" banner (if visible) or in its normal position.
- Sticky Checkout button is at the bottom.
- Nothing is shifted or overlapped by the new banner.

### TC-S26 · More from seller — Return-to-Cart navigation after adding item from filtered page

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer with cart, test-seller

**Steps:**
1. From Trade Basket, tap the banner's "View" link → opens MoreFromThisSeller page.
2. Tap "Add to Trade Basket" on an item.

**Expected Result:**
- After the "Added to Trade Basket" alert, the app navigates back to the Trade Basket screen (Cart).
- The cart now includes the newly added item.
- The banner count has recalculated.

---

## Group T — Flow Registry Update (Navigation Only)

### TC-T01 · flow-registry.md entries updated

**Steps:**
1. Open `docs/flow-registry.md`.
2. Verify FLOW-00 and FLOW-07 entries reference the persistent bottom nav.

**Expected Result:**
- FLOW-00 (Infrastructure) smoke includes "bottom nav renders identically on 100% of screens".
- FLOW-07 (Cart) smoke references the persistent Cart tab badge.

---

## Group U — Top Nav Header Pattern Consistency

**Ref:** AppHeader.tsx (variant: 'main' | 'tab' | 'detail'), ScreenLayout.tsx, Prompt #1B — Top Nav Consolidation

### TC-U01 · Root/tab screens use pattern 1 (no back button, greeting/avatar or title, notification bell)

**Screens under test:** Home (Dashboard), Discover, Inbox (Messages), Cart

**Steps:**
1. Log in as a subscriber at test-buyer@kidsmarketplace.test.
2. Navigate to each root tab screen: Home, Discover, Inbox, Cart.
3. For each screen, inspect the top header area.

**Expected Result for Home:**
- Left: Avatar + greeting ("Good morning/afternoon/evening, [Name]").
- Right: Notification bell (with unread badge count) + Profile icon.
- No back button is visible.
- Tapping the bell navigates to the Notifications screen.
- Tapping the avatar or Profile icon navigates to Profile.

**Expected Result for Discover, Inbox, Cart:**
- Left: Empty spacer (same 40px circle as back button position on detail screens) — no back button.
- Center: Screen title ("Discover", "Messages", "My Cart").
- Right: Notification bell (with unread badge count).
- Tapping the bell navigates to the Notifications screen on every screen.
- Bell icon, size, and badge style are identical across all three screens.

---

### TC-U02 · Secondary/detail screens use pattern 2 (back button + title + notification bell)

**Screens under test (sample — test 5 that cover different areas):**

| Screen | How to reach |
|---|---|
| Item Detail | Tap any listing from Discover or Home |
| Profile | Tap avatar on Home header |
| Swap Points | Profile → Swap Points |
| My Trades | Trades from Home or Profile |
| Create Listing | Sell FAB → List One Item |

**Steps:**
1. Navigate to each screen in the table above.
2. For each screen, inspect the top header area.

**Expected Result (all screens):**
- Left: ← Back button (40px round, gray `#F4F4F4` background, centered CaretLeft icon).
- Center: Screen title (bold, 17px, centered).
- Right: Notification bell (same icon, size, badge logic as root screens).
- Tapping the back button navigates to the previous screen.
- Tapping the bell navigates to Notifications.

---

### TC-U03 · Notification bell behavior + badge accuracy

**Steps:**
1. Log in as test-buyer.
2. From a secondary screen (e.g., Profile), verify the bell icon and badge.
3. Tap the bell → should navigate to Notifications screen.
4. From a root screen (e.g., Discover), verify the same bell icon and badge.
5. Tap the bell → should navigate to same Notifications screen.
6. Mark some notifications as read (backend or by opening them).
7. Navigate back to a root screen → verify badge count decreased.
8. Navigate to a secondary screen → verify badge count matches.

**Expected Result:**
- Bell icon: Always the same Phosphor `Bell` icon (22px, bold, `#1A1A1A`).
- Badge: Red dot with count (capped at 99+), positioned top-right of the bell icon.
- Tap destination: Always `Notifications` screen — never a different route.
- Badge count reflects the same `unreadCount` value on every screen it appears.
- Pull-to-refresh on any screen updates the badge (no stale count).

---

### TC-U04 · Screens without ScreenLayout still have working headers

**Screens under test:** EditListing, SubmitReview

**Steps:**
1. Log in as test-seller.
2. Navigate to My Listings → tap an existing listing → tap Edit.
3. Verify EditListingScreen shows a consistent detail header (back button + "Edit Listing" title + bell).
4. Complete a trade as test-buyer → navigate to the review prompt.
5. Verify SubmitReviewScreen shows a consistent detail header (back button + "Review [name]" title + bell).

**Expected Result:**
- Both screens now use ScreenLayout (not bare View or native navigation header).
- Header matches variant="detail" pattern exactly: back button (left) + title (center) + bell (right).
- Back button navigates to the previous screen.
- Bell navigates to Notifications.

---

### TC-U05 · Checkout/payment screens intentionally hide the bell (DEFERRED-DECISION)

**Screens under test:** CartCheckout, SubscriptionPayment, RequestPayout

**Steps:**
1. Log in as test-buyer with items in cart → tap Checkout.
2. Verify header shows back button + "Checkout" title — no bell icon on the right (empty spacer).
3. Navigate to Subscription → tap a plan → reach Subscription Payment screen.
4. Verify header shows back button + "Payment" title — no bell.
5. Log in as test-seller with earnings → navigate to Payouts → Request Payout.
6. Verify header shows back button + "Request Payout" title — no bell.

**Expected Result:**
- These three screens are the only authenticated screens where the bell is intentionally hidden.
- Each has a `// DEFERRED-DECISION` comment documenting the decision.
- The right spacer is an empty `headerActionBtn` (40px) to keep the title centred.
- Bell behavior on all other screens remains intact.

---

## Group V — Copy Rename Verification

> This group covers the "Cart → Trade Basket" and "Bundle → (removed)" copy rename. These tests verify that every instance of "Cart" in user-facing UI copy has been replaced with "Trade Basket", every instance of "Bundle" in user-facing copy has been removed or rephrased, and functional behavior is unaffected.
>
> **Note:** These are visual/text-only tests (no DB migration, no API change). If a test passes for one device (e.g., iOS Simulator), it is safe to assume the same result on the other, unless the text is in a native component that might render differently.

### TC-V01 · "Trade Basket" appears in bottom tab bar

**Actors:** Any logged-in user (test-buyer)

**Objective:** Verify the bottom tab bar label shows "Trade Basket" instead of "Cart".

**Steps:**
1. Log in and observe the bottom navigation bar.
2. Look at the tab that previously said "Cart".

**Expected Result:**
- The tab label reads **Trade Basket**.
- The ShoppingCart icon is unchanged.
- Tapping the tab navigates to the Cart screen (functionally unchanged).

### TC-V02 · "Trade Basket" appears as screen title on Cart screen

**Actors:** test-buyer

**Precondition:** Cart screen is accessible.

**Objective:** Verify the Cart screen title shows "Trade Basket".

**Steps:**
1. Navigate to the Cart/Trade Basket screen.
2. Observe the screen header/title.

**Expected Result:**
- The screen title reads **Trade Basket** (not "My Cart").
- The layout and items display identically to before the rename.

### TC-V03 · Empty state shows "trade basket" in copy

**Actors:** test-buyer

**Precondition:** Cart is empty.

**Objective:** Verify the empty state uses "trade basket" language.

**Steps:**
1. Clear all items from the cart.
2. Open the Cart/Trade Basket screen.

**Expected Result:**
- The empty state title reads **"Your trade basket is empty"**.
- The subtext reads **"Start adding items you love to your trade basket"**.
- The Browse Items button is unchanged and still functional.

### TC-V04 · "View Trade Basket" button on Item Detail screen

**Actors:** test-buyer

**Precondition:** An item from the current cart's seller is open on Item Detail.

**Objective:** Verify the in-cart button on Item Detail says "View Trade Basket".

**Steps:**
1. Add an item to the Trade Basket.
2. Open that same item's detail page.
3. Look at the bottom action button.

**Expected Result:**
- The button reads **View Trade Basket** (not "View Cart").
- Tapping it navigates to the Trade Basket screen.
- The ShoppingCart icon is unchanged.

### TC-V05 · "Add to Trade Basket" button on More from This Seller screen

**Actors:** test-buyer

**Precondition:** A seller has 2+ items; buyer has items from that seller in the Trade Basket.

**Objective:** Verify the "More from This Seller" screen uses "Trade Basket" copy.

**Steps:**
1. Navigate to a seller's "More from this seller" screen.
2. Observe the action button on items not yet in the Trade Basket.

**Expected Result:**
- The button reads **Add to Trade Basket** (not "Add to Cart").
- Tapping it adds the item and shows the "Added to Trade Basket" alert.

### TC-V06 · "In Trade Basket" status on More from This Seller items already in basket

**Actors:** test-buyer

**Objective:** Verify items already in the basket show the correct status label.

**Steps:**
1. Add an item to the Trade Basket.
2. Navigate to "More from This Seller" for that item's seller.
3. Find that item in the list.

**Expected Result:**
- The action button for items already in the basket reads **In Trade Basket** (not "In Cart").
- The button is disabled (not tappable) and visually dimmed.

### TC-V07 · "Added to Trade Basket" alert on item add

**Actors:** test-buyer

**Objective:** Verify the add-to-basket success alert uses "Trade Basket" copy.

**Steps:**
1. Add any available item to the Trade Basket from Item Detail, Favorites, or More from This Seller.

**Expected Result:**
- The alert title reads **"Added to Trade Basket"**.
- The alert body reads **"Item added to your Trade Basket."** (or similar, always using "Trade Basket").
- Tapping OK dismisses the alert and the item appears in the basket.

### TC-V08 · "Matches Your Trade Basket" badge on matching items

**Actors:** test-buyer

**Precondition:** Buyer has a Trade Basket with items from one seller.

**Objective:** Verify the badge on matching items uses "Trade Basket" copy.

**Steps:**
1. Open an Item Detail for an item from the same seller as the current basket.
2. Look for the badge near the seller info or action row.

**Expected Result:**
- The badge reads **Matches Your Trade Basket** (not "Matches Your Cart").
- The ShoppingCart icon and green styling are unchanged.
- The badge disappears when the basket is cleared.

### TC-V09 · Different-seller modal references "trade basket"

**Actors:** test-buyer

**Precondition:** Buyer has items from one seller in the Trade Basket.

**Objective:** Verify the different-seller conflict modal uses "trade basket" language.

**Steps:**
1. Attempt to add an item from a different seller.
2. Observe the modal that appears.

**Expected Result:**
- The modal body reads: **"Your trade basket already has items from a different seller. Adding this item will clear your current trade basket."**
- The three action buttons (Cancel, Save & Start New Cart, Replace Cart) are functionally unchanged and use the same labels.

### TC-V10 · Bundle CTA says "Make one offer" (no "Bundle" visible)

**Actors:** test-buyer

**Precondition:** Trade Basket has 2+ items from the same seller.

**Objective:** Verify the bundle CTA text no longer says "Bundle".

**Steps:**
1. Add 2+ items from the same seller to the Trade Basket.
2. Open the Trade Basket screen.
3. Look for the green bundle CTA card above the checkout area.

**Expected Result:**
- The CTA title reads **"Make one offer for these N items"** (not "Bundle these N items").
- The CTA subtext reads **"All items from this seller"** (not "Make one offer for all items from this seller" — no change in meaning).
- The Package icon and green styling are unchanged.
- Tapping the CTA still navigates to checkout in combined-offer mode.
- The word "Bundle" does not appear anywhere on the CTA.

### TC-V11 · "Combined Offer" banner on checkout (no "Bundle" visible)

**Actors:** test-buyer

**Precondition:** Buyer taps the combined-offer CTA from Trade Basket.

**Objective:** Verify the checkout banner no longer says "Bundle Offer".

**Steps:**
1. Tap the "Make one offer for these N items" CTA to enter checkout.
2. Observe the banner at the top of the checkout screen.

**Expected Result:**
- The banner title reads **"📦 Combined Offer"** (not "📦 Bundle Offer").
- The banner text reads: "You're making a single offer for all N items from this seller." — unchanged.
- The word "Bundle" does not appear anywhere on the banner.

### TC-V12 · Bundle Builder screen title shows "Build Offer" (no "Bundle" visible)

**Actors:** test-buyer

**Objective:** Verify the Bundle Builder screen title uses "Build Offer".

**Steps:**
1. Navigate to the Bundle Builder screen (from Cart/Trade Basket).
2. Observe the screen header/title.

**Expected Result:**
- The screen title reads **"Build Offer"** (not "Bundle").
- The word "Bundle" does not appear anywhere on the screen's visible copy.
- All functionality (item selection, price display, Add to Basket) works identically.

### TC-V13 · Favorites "Added to Trade Basket" alert copy

**Actors:** test-buyer

**Precondition:** Buyer has favorited items.

**Objective:** Verify the favorites → basket flow uses "Trade Basket" copy.

**Steps:**
1. Navigate to the Favorites screen.
2. Tap the **Add to Trade Basket** action (shopping cart icon/button) on a favorited item.

**Expected Result:**
- The alert title reads **"Added to Trade Basket"**.
- The alert body references the item by name and says **"was added to your Trade Basket."**.
- The item appears in the Trade Basket after dismissal.

### TC-V14 · Functional behavior unchanged (adding items, submitting offers still works)

**Actors:** test-buyer

**Objective:** Verify that nothing broke due to the copy rename.

**Steps:**
1. Add 3 items from the same seller to the Trade Basket.
2. Verify the cart count badge updates correctly.
3. Tap the combined-offer CTA and proceed to checkout.
4. Submit the offer.
5. Add an item from a different seller and verify the different-seller modal appears.
6. Clear the Trade Basket and verify the empty state appears.

**Expected Result:**
- All functional behavior (add, remove, clear, different-seller modal, combined-offer submission, badge counts) works identically to before the rename.
- No console errors or crashes related to the copy change.

---

## Group W — Admin Bundle Trade Views

### TC-W01 · Trades page has "Single Trades" and "Bundle Trades" tabs

**Ref:** ADMIN-V2-010 (new)
**Actors:** Admin user

**Objective:** Verify the trades list page has two tab buttons to switch between single and bundle views.

**Steps:**
1. Log into the admin portal (http://localhost:3001).
2. Navigate to **Trades** in the left sidebar.

**Expected Result:**
- Two tab buttons are visible at the top of the page: **"Single Trades"** (left) and **"Bundle Trades"** (right).
- "Single Trades" is selected by default (blue highlight).
- The active tab is visually distinct (blue background vs white).

---

### TC-W02 · Single Trades tab shows only non-bundle trades

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the Single Trades view filters out bundle trades.

**Steps:**
1. On the **Trades** page, ensure **"Single Trades"** tab is selected.
2. Review the listed trades.

**Expected Result:**
- All listed trades are non-bundle (no "Bundle ID" column shown, each row = one item).
- No trade shown is part of a bundle (trades that belong to a bundle are hidden from this view).
- The table columns match the original layout: Trade ID, Status, Buyer/Seller, Amount, Created, Actions.

---

### TC-W03 · Bundle Trades tab groups trades by bundle_id

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify that clicking "Bundle Trades" shows trades grouped by bundle_id.

**Steps:**
1. Tap the **"Bundle Trades"** tab.
2. Review the displayed data.

**Expected Result:**
- Each row represents a bundle (multiple trades sharing the same bundle_id), not a single trade.
- The table columns show: Bundle ID, Items/Statuses, Buyer/Seller, Total Amount, Created, Actions.
- If no bundle trades exist, an empty state reads "No bundle trades found."

---

### TC-W04 · Bundle row shows item count, total amounts, buyer/seller, statuses

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify bundle summary information is correct.

**Steps:**
1. In the **Bundle Trades** view, locate a bundle row.
2. Examine the displayed columns.

**Expected Result:**
- **Bundle ID**: First 8 characters of the bundle UUID, followed by "..."
- **Items/Statuses**: Shows "N items" and pill badges for each distinct status in the bundle (e.g., "completed", "in_progress").
- **Buyer/Seller**: Shows buyer name, email, phone | seller name, email, phone (same format as single view).
- **Total Amount**: Shows total cash amount, total SP (if any), and total fees.
- **Created**: Date of the earliest trade in the bundle.

---

### TC-W05 · Clicking a bundle row navigates to bundle detail page

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the "View Bundle" link navigates to the bundle detail page.

**Steps:**
1. In **Bundle Trades** view, tap the **"View Bundle"** link on any bundle row.

**Expected Result:**
- Navigates to `/trades/bundles/{bundleId}`.
- The page title shows "Bundle Details" with the full Bundle ID.

---

### TC-W06 · Bundle detail page lists all trades in the bundle

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify all trades in the bundle are listed as individual cards.

**Steps:**
1. Navigate to a bundle detail page (from TC-W05).
2. Scroll down to the **"Trades in this Bundle"** section.

**Expected Result:**
- Each trade in the bundle shows as a separate card.
- Each card shows: trade ID (truncated), status badge, item title, price, condition.
- Each card has a "View Details →" link to the individual trade detail page.

---

### TC-W07 · Bundle detail page shows monetary breakdown

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the bundle summary card shows aggregated financial data.

**Steps:**
1. On the bundle detail page, review the **Bundle Summary** card at the top.
2. Scroll to the **Bundle Monetary Breakdown** section.

**Expected Result:**
- Total Cash (All Items): Sum of all cash_amount_cents in the bundle.
- Total Swap Points Applied: Sum of all sp_amount (if any SP was used).
- Total Platform Fees: Sum of all buyer_transaction_fee_cents.
- Total Charged (Cash): Total cash + total fees.

---

### TC-W08 · Each trade row links to individual trade detail

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the admin can drill into individual trades from the bundle detail.

**Steps:**
1. On the bundle detail page, tap **"View Details →"** on any trade card.

**Expected Result:**
- Navigates to `/trades/{tradeId}`.
- Shows the full single-trade detail page with monetary breakdown, item details, audit trail, and actions.

---

### TC-W09 · Bundle detail page has "Force Cancel Entire Bundle" action

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the bundle-level force cancel action is present and functional.

**Steps:**
1. On a bundle detail page where at least one trade is not completed/cancelled, scroll to the bottom.

**Expected Result:**
- A red **"Admin Interventions"** section is visible.
- The button reads **"Force Cancel Entire Bundle"**.
- The warning text states "Force-cancelling this bundle will attempt to cancel all N trades..."

---

### TC-W10 · Force Cancel succeeds for all trades in the bundle

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the force cancel action processes all trades in the bundle.

**Steps:**
1. On a bundle detail page with active (non-terminal) trades, tap **"Force Cancel Entire Bundle"**.
2. Enter a cancellation reason.
3. Tap **"Confirm Force Cancel"**.

**Expected Result:**
- Each trade in the bundle is force-cancelled via the `/api/admin/trades/force-cancel` API.
- A result summary appears showing succeeded/failed counts.
- If all succeed, the page auto-reloads after 1.5 seconds.
- After reload, all trades show "cancelled" status.

---

### TC-W11 · Status filter works in Bundle Trades view

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the status filter still works in the Bundle Trades view.

**Steps:**
1. In the **Bundle Trades** view, select a status from the dropdown (e.g., "completed").

**Expected Result:**
- The page filters to show only bundles containing trades with that status.
- Note: Since bundles can have mixed statuses, a bundle is included if any of its trades match the filter.

---

### TC-W12 · Tab toggle resets filters when switching views

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify that switching between Single Trades and Bundle Trades clears filters and search.

**Steps:**
1. Set a status filter and search query in Single Trades view.
2. Tap the **"Bundle Trades"** tab.

**Expected Result:**
- Status filter resets to "All Statuses".
- Search query is cleared.
- The bundle list shows all bundle trades unfiltered.
- Switching back to "Single Trades" also shows all single trades unfiltered.
