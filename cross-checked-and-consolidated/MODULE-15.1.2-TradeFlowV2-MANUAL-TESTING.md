# MODULE-15.1.2 TradeFlowV2 — Manual Testing Guide

**Source of truth:** `docx/TRADING-FLOW-V2.md` (v2.1, May 26 2026) · `Prompts/MODULE-15.2-cart-system.md` · `Prompts/MODULE-15.3-PART3-TAX-TASKS-RESTRUCTURED.md` · `Prompts/Done/MODULE-08-REVIEWS-RATINGS.md` · `docs/flow-registry.md` (FLOW-27)
**Tasks covered:** Core Trade Flows · Payment Authorization · SP Behavior · Dispute Flow · Payout · Countdown Timers · Notifications · Completion CTAs · Safety UX · Seller Consequences · Bundle Flows · Cart System · Sales Tax Engine · Reviews & Ratings · Refund & Cancellation State Machine · Points Redemption · Bundle Fee Modes (per-item / one-fee) · Admin Partial Refunds · Payments Reconciliation · Navigation Consistency · Top Nav Header Patterns · Copy Rename (Trade Basket) · Admin Bundle Trade Views · Bundle Checkout Skips In-Progress Items (Buyer Notified) · R2 Auth-and-Capture + Pickup Window (7-day guardrail, pickup reminders)
**Last updated:** 2026-08-01
**Merged:** 2026-08-01 — This is now the **single canonical copy**. The root-level `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` was merged into this file and marked DEPRECATED. All unique cases from both copies are preserved (A03–A04, K04–K10, M16–M20, O1-C17, Navigation Consistency S01–S15 → X01–X15, Flow Registry T01 → X16, U01–U05, V01–V14, W01–W12).
**TRD-TC-L11 added:** 2026-08-01 — bundle checkout now notifies the buyer (branded OK modal) when one or more items are skipped because they already have an active/in-progress trade; the flow continues for eligible items (PARTIAL-SUCCESS).
**Scope:** End-user manual testing via app screens + admin portal screens (no SQL / no DB access required)
**Devices:** iOS Simulator + Android Emulator · Admin portal in browser

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Core Happy Paths** | TRD-TC-A01 | Cash Only: full happy path (buyer confirms) |
| | TRD-TC-A02 | Accept SP: SP entry at offer → seller accepts → buyer confirms |
| | TRD-TC-A03 | Accept SP: Pay Cash (0 SP) — subscriber seller still earns SP |
| | TRD-TC-A04 | Donate listing: [Claim] button, no charge |
| **B — Offer Lifecycle** | TRD-TC-B01 | Seller declines offer |
| | TRD-TC-B02 | Offer expires (seller never responds) + seller ignore prompt |
| | TRD-TC-B03 | Multiple competing offers — sort order + auto-decline |
| | TRD-TC-B04 | Buyer cancels pending trade — no consequence level |
| | TRD-TC-B05 | Per-seller cap: max 3 pending offers per seller (2026-07-18) |
| | TRD-TC-B05a | Per-seller cap: Buyer at 3 with Seller A can still submit to Seller B |
| | TRD-TC-B05b | Per-seller cap: Blocked at 4th offer to same seller |
| | TRD-TC-B05c | Per-seller cap: Bundle offer counts as 1 slot, not N |
| | TRD-TC-B05d | Per-seller cap: Expired offer frees slot immediately |
| | TRD-TC-B05e | Regression: No leftover global cap blocks buyer over old global limit |
| | TRD-TC-B05f | Admin config: Change offer cap from 3 to 5 on Trade Timing page |
| | TRD-TC-B05g | Admin config: Revert cap from 5 back to 3 (forward-looking only) |
| | TRD-TC-B05h | Admin config: Validation — reject invalid values (0, 11) |
| | TRD-TC-B05i | Mobile client: Config fetch failure — graceful degradation |
| | TRD-TC-B05j | Regression: Per-seller scope + bundle=1 still hold after config change |
| | TRD-TC-B06 | Card declined at offer submission |
| | TRD-TC-B07 | Expired offer timeline — no message button |
| | TRD-TC-B08 | Chat frozen after trade is cancelled or completed |
| | TRD-TC-B09 | Chat remains active for in_progress trades |
| | TRD-TC-B10 | Replace Card path (saved card → new card) |
| | TRD-TC-B11 | Subscribe-upsell → JoinKidsClub |
| | TRD-TC-B12 | SP info tooltip (not wired — flag) |
| | TRD-TC-B13 | Duplicate-offer modal navigation (dead code — flag) |
| **C — SP Behavior** | TRD-TC-C01 | SP reserved on offer submission |
| | TRD-TC-C02 | SP restored to buyer on seller decline |
| | TRD-TC-C03 | SP restored to buyer on offer expiry |
| | TRD-TC-C04 | SP stays reserved when seller accepts |
| | TRD-TC-C05 | SP released to seller at trade completion |
| | TRD-TC-C06 | SP restored to buyer on seller cancel (in_progress) |
| | TRD-TC-C07 | Free user sees locked Use SP button + upgrade modal |
| | TRD-TC-C08 | SP entry capped by the item's category cap (50–80%, admin-configurable) |
| **D — Auto-Complete & Timers** | TRD-TC-D01 | Auto-complete when buyer never taps I Got It |
| | TRD-TC-D02 | Auto-complete skipped when dispute is open |
| | TRD-TC-D03 | Offer countdown pill color states |
| | TRD-TC-D04 | Auto-complete banner visible to buyer only |
| | TRD-TC-D05 | Post-meetup nudge after auto-complete |
| **E — Dispute Flow** | TRD-TC-E01 | Buyer opens Report a Problem modal |
| | TRD-TC-E02 | Disputed trade does not auto-complete |
| | TRD-TC-E03 | Buyer UI during active dispute |
| | TRD-TC-E04 | Seller UI during active dispute |
| | TRD-TC-E05 | Admin resolves dispute → Complete |
| | TRD-TC-E06 | Admin resolves dispute → Refund |
| | TRD-TC-E07 | Report an Issue modal — no reason (disabled submit) |
| | TRD-TC-E08 | Report an Issue modal — reason selected (non-Other) |
| | TRD-TC-E09 | Report an Issue modal — "Other" + min-20 description |
| | TRD-TC-E10 | Report an Issue modal — submitting + success/error |
| **F — Payout** | TRD-TC-F01 | Payout shown on completion (no dispute) |
| | TRD-TC-F02 | Payout held when dispute is open |
| | TRD-TC-F03 | Payout needs action when seller has no payout method |
| **G — Notifications** | TRD-TC-G01 | Offer expiry reminders to seller |
| | TRD-TC-G02 | Auto-complete reminders to buyer |
| | TRD-TC-G03 | Notification throttle per trade |
| | TRD-TC-G04 | Push notifications deep-link to correct screen |
| **H — Completion CTAs** | TRD-TC-H01 | Free buyer sees subscription CTA |
| | TRD-TC-H02 | Subscriber buyer used SP — "You saved $X" |
| | TRD-TC-H03 | Subscriber seller on Accept SP listing — SP pending notice |
| | TRD-TC-H04 | Subscriber seller on Cash Only listing — upsell |
| | TRD-TC-H05 | Subscription lifecycle — trial / paid / cancel regression |
| **I — Safety UX** | TRD-TC-I01 | Safe meetup card on in_progress trade |
| | TRD-TC-I02 | Safe meetup card dismissible per trade |
| | TRD-TC-I03 | In-chat safety banner persistent |
| | TRD-TC-I04 | Pre-first-message safety modal once per listing |
| | TRD-TC-I05 | Chat quick-reply chips on in_progress trade |
| | TRD-TC-I06 | Liability disclaimer modal gates purchase (checkbox + Accept & Continue) |
| | TRD-TC-I07 | Disclaimer modal Cancel path — no trade created |
| | TRD-TC-I08 | Disclaimer modal ✕ close behaves like Cancel |
| | TRD-TC-I09 | Disclaimer checkbox resets to unchecked on reopen |
| | TRD-TC-I10 | Disclaimer modal loading state |
| | TRD-TC-I11 | Disclaimer modal not shown for non-trade actions |
| **J — Seller Cancel Consequences** | TRD-TC-J01 | Seller cancels in_progress trade → Level 1 |
| | TRD-TC-J02 | 2nd post-acceptance cancel → Level 2 |
| | TRD-TC-J03 | 3rd post-acceptance cancel → Level 3 |
| | TRD-TC-J04 | Seller cancel button only on in_progress |
| | TRD-TC-J05 | Seller cancel modal shows seller reasons only |
| **K — Value Stack & Fees** | TRD-TC-K01 | Subscriber sees $1.49 fee + Sales Tax line in value stack |
| | TRD-TC-K02 | Non-subscriber sees tiered fee (first-trade $1.49) + Sales Tax line in value stack |
| | TRD-TC-K03 | SP discount row conditional on SP used |
| | TRD-TC-K04 | Bundle checkout — fee charged per item (admin toggle OFF) |
| | TRD-TC-K05 | Bundle checkout — one fee per bundle (admin toggle ON) |
| | TRD-TC-K06 | Bundle timeline — fee display matches charge mode |
| | TRD-TC-K07 | Admin partial refund — refund price only, keep fee |
| | TRD-TC-K08 | Admin partial refund — tax ledger partially refunded |
| | TRD-TC-K09 | Payments reconciliation page — charged vs refunded per trade |
| | TRD-TC-K10 | Server-side enforcement — one-fee-per-bundle with stale client |
| | TRD-TC-K11 | Seller fee = 5% × cash portion (SP trade) |
| **L — Bundle Flows** | TRD-TC-L01 | Bundle banner on trade detail |
| | TRD-TC-L02 | Confirm All shortcut for bundle (buyer) |
| | TRD-TC-L03 | Bundle offer rows in Offers tab (seller) |
| | TRD-TC-L04 | Non-bundle offers render as single rows |
| | TRD-TC-L05 | In-progress bundles section in Buying tab |
| | TRD-TC-L06 | Bundle banner in Review Offer screen |
| | TRD-TC-L07 | Accept All N Items in Review Offer screen |
| | TRD-TC-L08 | Individual accept/decline alongside bundle siblings |
| | **TRD-TC-L09** | **Bundle card in Your Offers (buyer)** |
| | TRD-TC-L10 | Bundle cancel prompt (buyer + seller) |
| | TRD-TC-L11 | Bundle checkout skips items already in an active trade — buyer notified, flow continues |
| **M — Cart (End User)** | TRD-TC-M01 | Add first item → active cart created |
| | TRD-TC-M02 | Add second item from same seller |
| | TRD-TC-M03 | Add item from different seller → choice modal |
| | TRD-TC-M04 | Replace Cart option |
| | TRD-TC-M05 | Cannot add own item to cart |
| | TRD-TC-M06 | Cannot add unavailable / out-of-node item |
| | TRD-TC-M07 | Duplicate item prevented in same cart |
| | TRD-TC-M08 | Remove item from cart |
| | TRD-TC-M09 | Clear cart |
| | TRD-TC-M10 | Saved carts: max 3, server rejects 4th save, switch cart |
| | TRD-TC-M11 | Minimum cart value warning + checkout blocked |
| | TRD-TC-M12 | Max SP available shown per cart item (subscriber) |
| | TRD-TC-M13 | Realtime: item becomes unavailable while in cart |
| | TRD-TC-M14 | Favorites add / remove |
| | TRD-TC-M15 | Favorites screen: availability + empty state |
| | TRD-TC-M16 | Success toast appears and auto-dismisses on add-to-cart |
| | TRD-TC-M17 | Cart badge increments in sync with toast |
| | TRD-TC-M18 | Toast copy uses "Trade Basket" terminology |
| | TRD-TC-M19 | Home dashboard Favorites quick-action tile navigates to Favorites |
| | TRD-TC-M20 | Discover header heart icon navigates to Favorites |
| **N — Cart (Admin)** | TRD-TC-N01 | Admin sets minimum cart value → reflects in app |
| | TRD-TC-N02 | Admin minimum cart value validation |
| | TRD-TC-N03 | Admin updates Minimum Listing Price on Config → Fees tab |
| | TRD-TC-N04 | Seller cannot publish single-item listing below threshold |
| | TRD-TC-N05 | Bulk: below-threshold items flagged, valid items publish |
| | TRD-TC-N06 | Existing listing auto-paused when threshold raised above price |
| | TRD-TC-N07 | Seller raises price to meet threshold → listing repurchasable |
| | TRD-TC-N08 | Regression: single-item + bundle checkout at/above threshold |
| | TRD-TC-N09 | Price adjustment modal displays correct copy and button text (single-item) |
| | TRD-TC-N10 | "Update Price" dismisses modal and auto-scrolls + auto-focuses price field (single-item) |
| | TRD-TC-N11 | Price adjustment modal in edit listing flow (single-item edit) |
| | TRD-TC-N12 | Bulk listing: per-item chip shows dynamic threshold in missing-required warning |
| | TRD-TC-N13 | Bulk listing: publish failure shows clear error message for below-threshold items |
| | TRD-TC-N14 | Regression: minimum-price validation still blocks publish in single-item and bulk flows |
| **O — Tax (End User)** | TRD-TC-O01 | Sales tax shown in checkout/cart breakdown (0 SP) |
| | TRD-TC-O02 | Tax base stays on full item price as SP entry changes (offer + checkout) |
| | TRD-TC-O03 | Tax $0 when globally disabled |
| | TRD-TC-O04 | Tax $0 when node tax disabled |
| | TRD-TC-O05 | Tax-exempt user sees Tax Free badge |
| | TRD-TC-O06 | Transaction history shows tax details |
| | TRD-TC-O07 | Refund shows proportional tax refunded |
| | TRD-TC-O08 | Tax shown on trade timeline/detail for buyer only |
| **O-1 — Tax Categories (Admin Config)** | TRD-TC-O1-C01 | Admin creates a new tax rule for general_tangible_goods |
| | TRD-TC-O1-C02 | Admin creates second rule for same category — overlap blocked |
| | TRD-TC-O1-C03 | Admin edits existing rule — new version created |
| | TRD-TC-O1-C04 | Admin deactivates a rule |
| | TRD-TC-O1-C05 | Existing listings backfill to general_tangible_goods |
| | TRD-TC-O1-C06 | New single-listing creation receives default tax category |
| | TRD-TC-O1-C07 | New bulk-listing creation receives default tax category |
| | TRD-TC-O1-C08 | Admin changes individual listing's tax category |
| | TRD-TC-O1-C09 | Tax-exempt category configuration |
| | TRD-TC-O1-C10 | Price-threshold category configuration (clothing_footwear) |
| | TRD-TC-O1-C11 | Fee-in-tax-base toggle on and off |
| | TRD-TC-O1-C12 | Unauthorized user cannot view or edit tax configuration |
| | TRD-TC-O1-C13 | Audit trail shows actor, timestamp, before/after values |
| | TRD-TC-O1-C14 | Admin views and edits category→tax-category mapping |
| | TRD-TC-O1-C15 | Category mapping change affects new listings immediately |
| | TRD-TC-O1-C16 | Admin cannot map to non-existent or inactive tax category |
| | TRD-TC-O1-C17 | Admin filters tax rules by active / inactive status |
| **O-2 — Tax Status Lifecycle** | TRD-TC-O2-C01 | Single taxable item, no SP — offer is quoted/authorized, not collected |
| | TRD-TC-O2-C02 | Bundle with taxable, exempt, and threshold items — line-level tax correct |
| | TRD-TC-O2-C03 | Platform-fee tax toggle off and on — tax base changes by fee amount |
| | TRD-TC-O2-C04 | SP used — taxable base unchanged, card auth reflects SP tender |
| | TRD-TC-O2-C05 | Seller accepts — tax remains quoted/authorized, not collected |
| | TRD-TC-O2-C06 | Buyer cancels while Awaiting Seller — PI canceled, tax voided, SP released once |
| | TRD-TC-O2-C07 | Seller declines and offer expiry — PI canceled, tax voided |
| | TRD-TC-O2-C08 | Buyer completes successfully — capture succeeds, tax collected |
| | TRD-TC-O2-C09 | Auto-complete after 72 hours — capture succeeds, tax collected |
| | TRD-TC-O2-C10 | Capture failure — no payout, no collected tax, recovery state visible |
| | TRD-TC-O2-C11 | Duplicate webhook/retry — no duplicate tax collection, payout, or SP event |
| | TRD-TC-O2-C12 | Historical/backfill records — clearly classified, never falsely marked as collected |
| **O-3 — Tax Refund & Reconciliation** | TRD-TC-O3-C01 | Buyer wording: "Payment authorized" before capture (Awaiting Seller) |
| | TRD-TC-O3-C02 | Buyer wording: "Payment authorized" after seller accept (In Progress) |
| | TRD-TC-O3-C03 | Buyer wording: "Paid" after successful capture (Completed) |
| | TRD-TC-O3-C04 | Capture failure shows "payment could not be completed" (no completed state) |
| | TRD-TC-O3-C05 | Admin dispute route: full refund with Stripe + tax reversal (captured trade) |
| | TRD-TC-O3-C06 | Duplicate refund/retry is idempotent |
| | TRD-TC-O3-C07 | Admin dispute route: uncaptured PI is cancelled (not refunded) |
| | TRD-TC-O3-C08 | Admin dispute route: Stripe refund failure stays unresolved |
| | TRD-TC-O3-C09 | Stripe refund pending → tax pending_refund |
| | TRD-TC-O3-C10 | Report: newly submitted offer → Pending/Authorized Tax |
| | TRD-TC-O3-C11 | Report: captured trade → Tax Collected using capture timestamp |
| | TRD-TC-O3-C12 | Report: cancelled/declined/expired → Voided/Expired Tax, not collected |
| | TRD-TC-O3-C13 | Report: refunded trade → Tax Refunded, Net adjusts |
| | TRD-TC-O3-C14 | Report: CSV totals match on-screen totals |
| **P — Tax (Admin)** | TRD-TC-P01 | Node tax rate config (view/edit, validation) |
| | TRD-TC-P02 | Bulk tax update across nodes |
| | TRD-TC-P03 | Tax rate change history / audit |
| | TRD-TC-P04 | Global tax settings toggle + warning banner |
| | TRD-TC-P05 | Tax reporting dashboard: summary + date presets |
| | TRD-TC-P06 | Jurisdiction breakdown + 7 report types |
| | TRD-TC-P07 | CSV export for filing |
| | TRD-TC-P08 | Admin changes rate → new transactions use new rate |
| **Q — Reviews & Ratings** | TRD-TC-Q01 | Review prompt ([Rate Seller] / [Rate Buyer]) on completion |
| | TRD-TC-Q02 | Star rating required — submit blocked without rating |
| | TRD-TC-Q03 | Comment optional, max 500 characters |
| | TRD-TC-Q04 | Anonymous review hides reviewer identity |
| | TRD-TC-Q05 | Skip review — no blocking, no re-prompt for same trade |
| | TRD-TC-Q06 | Mutual review status shown on completed trade detail |
| | TRD-TC-Q07 | Completed reviews visible on counterparty's profile |
| | TRD-TC-Q08 | Average rating and total review count on user profile |
| | TRD-TC-Q09 | Rating breakdown (5 → 1 stars) on profile |
| | TRD-TC-Q10 | Edit review succeeds within 24h window |
| | TRD-TC-Q11 | Edit blocked after 24h window |
| | TRD-TC-Q12 | One review per trade — duplicate submission blocked |
| | TRD-TC-Q13 | 30-day same-counterparty cooldown enforced |
| | TRD-TC-Q14 | 24h post-completion cooldown — review locked |
| | TRD-TC-Q15 | Flag a review (select reason) |
| | TRD-TC-Q16 | Auto-hide review after 3+ reports |
| | TRD-TC-Q17 | Cannot flag own review |
| | TRD-TC-Q18 | Admin moderation queue — reported reviews with counts |
| | TRD-TC-Q19 | Admin approves (unhides) a reported review |
| | TRD-TC-Q20 | Admin deletes a reported review |
| **R — Refund & Cancellation State Machine** | TRD-TC-R01 | Buyer cancels pending trade → cancelled, auth voided, SP restored |
| | TRD-TC-R02 | Seller declines pending offer → cancelled, SP restored |
| | TRD-TC-R03 | Offer expiry → auto-cancel + competing offers cancelled |
| | TRD-TC-R04 | Card declined at offer submission → no trade created |
| | TRD-TC-R05 | Seller cancels in_progress → refund + consequence level |
| | TRD-TC-R06 | Refund settlement breakdown (cash + proportional tax + fee) |
| **T — Points Redemption (Bundle Checkout)** | TRD-TC-T01 | SP input appears only on eligible items; ineligible show "Not eligible" label |
| | TRD-TC-T02 | Entered SP applies correct amount (wallet + category cap both sufficient) |
| | TRD-TC-T03 | Entered SP applies partial amount with "Limited by your SP balance" subtext when wallet insufficient |
| | TRD-TC-T04 | Category cap limits applied points even when wallet covers more |
| | TRD-TC-T05 | Clearing SP restores balance for sequential allocation |
| | TRD-TC-T06 | Running "Points remaining" counter updates accurately across entries/clears |
| | TRD-TC-T07 | Order Summary "Points Applied" line and cash total correct after multiple SP entries |
| | TRD-TC-T08 | Seller Review Offer shows per-item points breakdown |
| | TRD-TC-T09 | Seller Review Offer shows "Total Payout" and "Buyer's Total Paid" correctly |
| | TRD-TC-T10 | "Includes points redemption" tag on seller's offer list/inbox card |
| | TRD-TC-T11 | Wallet ledger: buyer debited at offer, seller credited + bonus at completion |
| | TRD-TC-T12 | No ledger transaction on offer decline |
| | TRD-TC-T13 | Regression: single-item (non-bundle) offer flow with SP still works |
| | TRD-TC-T14 | Regression: bundle CTA, different-seller modal, "more from this seller" still functional |
| | TRD-TC-R07 | SP reversal on refund (reserved/transferred returned) |
| | TRD-TC-R08 | Seller payout withheld / cancelled on refund |
| | TRD-TC-R09 | Admin dispute resolve → Refund (full settlement) |
| | TRD-TC-R10 | Admin dispute resolve → Complete (no refund) |
| | TRD-TC-R11 | Refund / cancellation notifications to both parties |
| | TRD-TC-R12 | Refund idempotency — no double refund |
| | TRD-TC-R13 | Cancelled / refunded trade status + timeline |
| **S — Seller Group & Bundle Discovery** | TRD-TC-S01 | Different-seller modal uses generic copy (no seller name leak) |
| | TRD-TC-S02 | "More from this seller" icon appears only when 2+ approved listings |
| | TRD-TC-S03 | "More from this seller" icon hidden when seller has exactly 1 listing |
| | TRD-TC-S04 | Tapping icon opens "More from this seller" page — no seller identity |
| | TRD-TC-S05 | Add to Cart from filtered seller page populates cart correctly |
| | TRD-TC-S06 | "Matches Your Cart" indicator on filtered seller page |
| | TRD-TC-S07 | Bundle CTA appears on CartScreen with 2+ same-seller items |
| | TRD-TC-S08 | Bundle CTA hidden with single item or empty cart |
| | TRD-TC-S09 | Bundle CTA navigates to checkout in bundle mode |
| | TRD-TC-S10 | Bundle checkout shows "Bundle Offer" banner |
| | TRD-TC-S11 | Regression: Discover/search grid unchanged (no badges) |
| | TRD-TC-S12 | Regression: single-item offer flow unchanged |
| | TRD-TC-S13 | Regression: seller identity unlocks only post-acceptance |
| | TRD-TC-S14 | More from seller — Item Detail CTA in standalone position (below seller card) |
| | TRD-TC-S15 | More from seller — Item Detail CTA hidden at 0 additional listings |
| | TRD-TC-S16 | More from seller — Item Detail CTA does not disrupt "Matches Your Cart" badge |
| | TRD-TC-S17 | More from seller — Trade Basket banner shows correct remaining-item count |
| | TRD-TC-S18 | More from seller — Trade Basket banner recalculates after adding item from filtered page |
| | TRD-TC-S19 | More from seller — Trade Basket banner disappears when all seller's listings are in basket |
| | TRD-TC-S20 | More from seller — Trade Basket banner dismissible via X button |
| | TRD-TC-S21 | More from seller — Banner and filtered page never reveal seller identity |
| | TRD-TC-S22 | Regression: Seller Info card elements unchanged |
| | TRD-TC-S23 | Regression: Trade Basket subtotal/total/bundle CTA layout unaffected |
| | TRD-TC-S24 | More from seller — Return-to-Cart navigation after adding item from filtered page |
| **X — Navigation Consistency & Bottom Nav** | TRD-TC-X01 | Bottom nav renders identically on Home (Dashboard) |
| | TRD-TC-X02 | Bottom nav renders identically on Discover |
| | TRD-TC-X03 | Bottom nav renders identically on Trades |
| | TRD-TC-X04 | Bottom nav renders identically on Trade Basket |
| | TRD-TC-X05 | Bottom nav renders on Item Detail / Cart Checkout / Trade screens |
| | TRD-TC-X06 | Bottom nav renders on Profile, Settings, Wallet, Subscriptions |
| | TRD-TC-X07 | Cart badge shows item count from multiple entry points |
| | TRD-TC-X08 | Cart badge count accuracy — add / remove / clear |
| | TRD-TC-X09 | "Me" tab removed — Profile still accessible via Home avatar |
| | TRD-TC-X10 | Sell FAB opens action sheet on every screen |
| | TRD-TC-X16 | Flow Registry (nav) — flow-registry.md entries updated |
| **U — Top Nav Header Pattern Consistency** | TRD-TC-U01 | Root/tab screens use pattern 1 (no back button, greeting/avatar/title, bell) |
| | TRD-TC-U02 | Secondary/detail screens use pattern 2 (back button + title + bell) |
| | TRD-TC-U03 | Notification bell behavior + badge accuracy |
| | TRD-TC-U04 | Screens without ScreenLayout still have working headers |
| | TRD-TC-U05 | Checkout/payment screens intentionally hide the bell |
| **V — Copy Rename Verification** | TRD-TC-V01 | "Basket" (short form) appears in bottom tab bar |
| | TRD-TC-V02 | "Trade Basket" appears as screen title on Cart screen |
| | TRD-TC-V03 | Empty state shows "trade basket" in copy |
| | TRD-TC-V04 | "View Trade Basket" button on Item Detail screen |
| | TRD-TC-V05 | "Add to Trade Basket" button on More from This Seller screen |
| | TRD-TC-V06 | "In Trade Basket" status on More from This Seller items already in basket |
| | TRD-TC-V07 | "Added to Trade Basket" alert on item add |
| | TRD-TC-V08 | "Matches Your Trade Basket" badge on matching items |
| | TRD-TC-V09 | Different-seller modal references "trade basket" |
| | TRD-TC-V10 | Bundle CTA says "Make one offer" (no "Bundle" visible) |
| | TRD-TC-V11 | "Combined Offer" banner on checkout (no "Bundle" visible) |
| | TRD-TC-V12 | Bundle Builder screen title shows "Build Offer" (no "Bundle" visible) |
| | TRD-TC-V13 | Favorites "Added to Trade Basket" alert copy |
| | TRD-TC-V14 | Functional behavior unchanged (adding items, submitting offers) |
| **W — Admin Bundle Trade Views** | TRD-TC-W01 | Trades page has "Single Trades" and "Bundle Trades" tabs |
| | TRD-TC-W02 | Single Trades tab shows only non-bundle trades |
| | TRD-TC-W03 | Bundle Trades tab groups trades by bundle_id |
| | TRD-TC-W04 | Bundle row shows item count, totals, buyer/seller, statuses |
| | TRD-TC-W05 | Clicking a bundle row navigates to bundle detail page |
| | TRD-TC-W06 | Bundle detail page lists all trades in the bundle |
| | TRD-TC-W07 | Bundle detail page shows monetary breakdown |
| | TRD-TC-W08 | Each trade row links to individual trade detail |
| | TRD-TC-W09 | Bundle detail page has "Force Cancel Entire Bundle" action |
| | TRD-TC-W10 | Force Cancel succeeds for all trades in the bundle |
| | TRD-TC-W11 | Status filter works in Bundle Trades view |
| | TRD-TC-W12 | Tab toggle resets filters when switching views |
| **R2 — New Implementation** | TRD-TC-D06 | Pickup window drives the auto-complete deadline (R2 — configurable) |
| | TRD-TC-G05 | Pickup-window reminders to buyer (R2) |
| **N2 — Idempotency & Audit (Cross-Cutting)** | TRD-TC-N2-C01 | Retried offer submission → exactly 1 PaymentIntent / 1 trade / 1 SP reservation / 1 audit row |
| | TRD-TC-N2-C02 | Retried payout trigger → exactly 1 seller_payouts row / 1 Stripe transfer |
| | TRD-TC-N2-C03 | Retried refund / duplicate refund webhook → exactly 1 refund, no double refund |
| | TRD-TC-N2-C04 | Re-run SP release processor → no double-credit |
| | TRD-TC-N2-C05 | Retried SP debit/credit on cancel → no double mutation |
| | TRD-TC-N2-C06 | Admin SP adjustment double-click → single credit |
| | TRD-TC-N2-C07 | Audit completeness — every payment/SP/fee/tax transition logged |
| | TRD-TC-N2-C08 | Audit log insert-only + RLS (service-role/admin read) |
| | TRD-TC-N2-C09 | Duplicate idempotency key → prior result, no partial write |
| | TRD-TC-N2-C10 | Reconciliation — payments vs trade_refunds vs financial_audit_log |
| **Y — Trade List & Timeline** | TRD-TC-Y01 | Trade List summary filter chips |
| | TRD-TC-Y02 | Trade List Load More history pagination |
| | TRD-TC-Y03 | Trade List Message button on rows |
| | TRD-TC-Y04 | Trade List "See all →" link |
| | TRD-TC-Y05 | R15 — Request More Time (requester) |
| | TRD-TC-Y06 | R15 — counterparty Accept |
| | TRD-TC-Y07 | R15 — counterparty Decline |
| | TRD-TC-Y08 | R15 — granted state |
| | TRD-TC-Y09 | "What to do next" card + "Got it" toggle |

---

## Pre-conditions (set up before testing)

- App is running on iOS Simulator and/or Android Emulator.
- The following test accounts exist and are confirmed (see Accounts table).
- test-seller has at least one **Cash Only** listing and one **Accept SP** listing, all available.
- test-buyer (subscriber) has a Swap Points balance of at least 15 SP.
- test-buyer and test-free have a valid saved payment card.
- For cart tests: test-seller has at least 3 available items; a second seller (test-seller-2) has at least 1 available item in the same node as test-buyer.
- For tax tests: the item's tax category has an ACTIVE tax rule (live staging rate for `general_tangible_goods` = **6.99%**) and sales tax is enabled globally, unless a case states otherwise. **Category tax rules override node rates** (see the Group O precedence note) — the node's tax rate is only a fallback when no category rule matches. Admin portal access is available for admin-side cases.

> **Note:** Donate listings (TRD-TC-A04) and the platform-SP reward for cash-only Accept SP trades (TRD-TC-A03) are deferred to post-MVP. See `MODULE-15.1.2-TradeFlowV2-DEFERRED-MANUAL-TESTING.md`.

## Accounts for testing

| Role | Email | Subscription | Notes |
|---|---|---|---|
| Seller | test-seller@kidsmarketplace.test | Kids Club+ Active | Must be subscriber to offer Accept SP listings |
| Buyer (subscriber) | test-buyer@kidsmarketplace.test | Kids Club+ Active | Must have SP ≥ 15 |
| Buyer (free) | test-free@kidsmarketplace.test | None | Cannot use SP |
| Admin | test-admin@kidsmarketplace.test | — | Required for dispute resolution test cases |

> Timer-based cases (offer expiry, auto-complete, scheduled reminders) require QA to fast-forward the relevant clock in the test environment. The steps below describe what the end user sees once that time is reached.

---

## Group A — Core Happy Paths

### Passed TRD-TC-A01 · Cash Only: full happy path (buyer confirms receipt) . 

**Ref:** TRADING-FLOW-V2 §7 Scenario S1
**Actors:** test-buyer (subscriber) + test-seller

**Objective:** Verify a cash-only trade flows from offer submission through seller acceptance to buyer confirmation and completion.

**Steps:**
1. Log in as **Buyer** and open a Cash Only item from **Seller**.
2. Tap **[Request to Buy]**, review the offer preview, then tap **[Submit Offer]**.
3. Log in as **Seller**, open the **Offers** tab, and tap the new offer row.
4. On the Review Offer screen, tap **[Accept]**.
5. Log in as **Buyer**, open the trade from **Trades → Buying**.
6. Tap **[I Got It]**, then tap **[Confirm]** on the confirmation prompt.

**Expected Result:**
- On the item: a single **[Request to Buy]** button plus a secondary **Add**/"View Trade Basket" cart button. Cash-only listings show **no** payment-mode badge (only Accept-SP listings show an "SP Accepted"/"Use SP" affordance), so there is no "Cash Only" badge to expect.
- After submitting: a confirmation toast and the trade appears as **Pending**; the seller receives a push notification.
- The seller's offer row shows the item, cash amount, and a green countdown pill.
- After the seller accepts: both parties see the trade move to **In Progress**; buyer sees "Payment confirmed. Coordinate pickup." with an auto-complete banner ("Auto-completing in ~72h" — the default `pickup_window_hours`); the seller does **not** see an [I Got It] button or the auto-complete banner.
- After the buyer confirms: the trade shows as **Completed**, a "Trade Complete!" screen appears with a [Rate Seller] button; the seller sees a "Sold!" completion screen with [Rate Buyer].

---

### Passed TRD-TC-A02 · Accept SP: SP entry at offer → seller accepts → buyer confirms

**Ref:** TRADING-FLOW-V2 §7 Scenario S5, §4.4, §10
**Actors:** test-buyer (subscriber, SP ≥ 15) + test-seller (subscriber)

**Objective:** Verify a subscriber buyer can apply Swap Points to an Accept SP listing and complete the full SP happy path.

**Steps:**
1. Log in as **Buyer** and open an **Accept SP** item priced at $30.
2. Tap **[Request to Buy]** to open the offer screen; subscribers see the SP entry field there.
3. Enter **$8 SP** in the SP field and review the breakdown.
4. Try to enter more than 50% of the price ($15) — the field clamps to the max.
5. Tap **[Submit Offer]**.
6. Log in as **Seller**, open the **Offers** tab, tap the offer, and tap **[Accept]**.
7. Log in as **Buyer**, open the trade, tap **[I Got It]**, then **[Confirm]**.

**Expected Result:**
- The item shows the standard **[Add to Cart]** + **[Request to Buy]** actions (a subscriber sees no payment-mode badge; a non-subscriber sees an "SP Accepted (Kids Club+ only)" badge / "Use SP 🔒" chip). There is **no** [Send offer]/[Use SP] two-button layout — SP is applied on the offer screen's SP field.
- The SP field accepts 0 to $15 (50% of $30); at $8 it shows "$22 cash + 8 SP = $30 total", platform fee $1.49 (subscriber, tiered buyer-fee engine), and total cash $23.49.
- The field clamps at $15 and refuses any higher value.
- After submitting: the buyer's wallet shows 8 SP moved from available to reserved.
- The seller's offer row shows "$22 cash + 8 SP — Total: $30"; the Review screen shows the combined SP releasing at completion.
- While In Progress, the buyer's SP stays reserved (not yet transferred to the seller).
- After the buyer confirms: the trade completes; the buyer sees "Got it! You saved $8 using SP."; the seller's completion screen shows the SP (buyer 8 SP + platform reward) added to their pending wallet with a [View Wallet] button; the buyer's reserved SP returns to 0.

---


### TRD-TC-A03 · Accept SP listing: buyer pays cash (0 SP) — subscriber seller still earns SP

**Ref:** TRADING-FLOW-V2 §7 Scenario S4
**Actors:** test-buyer (subscriber) + test-seller (subscriber)

**Objective:** Verify that an Accept SP listing paid fully in cash still grants the seller platform SP, with no buyer SP used.

**Steps:**
1. Log in as **Buyer** and open an **Accept SP** listing.
2. Tap **[Request to Buy]** (leave SP at 0) and submit the offer.
3. Log in as **Seller** and accept the offer.
4. Log in as **Buyer**, open the trade, and tap **[I Got It]** → **[Confirm]**.

**Expected Result:**
- The offer preview shows "$[price] cash, 0 SP" and no SP is reserved from the buyer.
- The seller is charged the full cash amount.
- After completion, the seller's completion screen shows the platform SP reward added to their pending wallet ("[platform_sp] SP releasing in [N] days — added to your pending wallet.") with a [View Wallet] button; no buyer SP is involved.

---

### TRD-TC-A04 · Donate listing: [Claim] button, no charge

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

### passed TRD-TC-B01 · Seller declines offer

**Ref:** TRADING-FLOW-V2 §7 Scenario S2
**Actors:** test-buyer + test-seller

**Objective:** Verify a seller can decline an offer and the item stays listed, restoring any reserved SP to the buyer.

**Steps:**
1. Log in as **Buyer** and submit an offer (any type) on a listing.
2. Log in as **Seller**, open the offer in the Review screen, and tap **[Decline]**.
3. Log in as **Buyer** and open the **History** tab.

**Expected Result:**
- The seller sees a confirmation "Offer declined. Item stays listed." and the offer row is removed/marked declined; the listing stays available.
- The buyer's **History** tab shows the cancelled (declined) trade with a **View Item** button when the item is still available. (Expired/declined offers no longer appear in the Active tab's "Your Offers" — owner decision 2026-08-28.)
- If the buyer used SP, that SP is restored from reserved back to available.

---

### Passed TRD-TC-B02 · Offer expires (seller never responds) + seller ignore prompt

detialed test cases are here 
TC-B02-TESTING-GUIDE.md 

**Ref:** TRADING-FLOW-V2 §7 Scenario S3, §9.2, §11.8
**Actors:** test-buyer + test-seller
**Precondition:** QA fast-forwards the offer clock (default 48h — `offer_timeout_hours`) past expiry for this trade.

**Objective:** Verify an unanswered offer auto-cancels at expiry, restores buyer SP, and prompts a seller who lets **two consecutive offers expire unanswered** (a true consecutive-expiry streak, not a simultaneous-pending count) to pause the listing.

> **DEV-TASK-34 (2026-08-29):** the seller-ignore counter is now a **consecutive-expiry streak** (`listing_offer_stats.unanswered_offer_count`). It increments only on unanswered expiry, resets to 0 on seller accept/decline, and never counts declines. The nudge copy is: *"A few offers on [Item] have gone unanswered. Respond to your pending offers — or pause the listing if you're not able to sell right now."*

**Steps:**
1. Log in as **Buyer** and submit an offer; note the 48h countdown starts.
2. Allow the offer to reach its expiry without the seller responding.
3. Log in as **Buyer** and open the **History** tab.
4. Repeat with a **second consecutive** unanswered offer on the same listing (offer #2 submitted only after offer #1 has expired — sequential, no overlap).
5. Log in as **Seller** and check push notifications.

**Expected Result:**
- At expiry the trade auto-cancels; the buyer's reserved SP (if any) is restored.
- The buyer's **History** tab shows the cancelled (expired) trade with a **View Item** button when the item is still available. (Expired/declined offers no longer appear in the Active tab's "Your Offers" — owner decision 2026-08-28.)
- Before expiry, the seller receives reminder pushes at roughly 6 hours and 1 hour before the offer expires.
- The streak increments by 1 per unanswered expiry (offer submission does NOT touch it): 1st expiry → `unanswered_offer_count = 1` (no nudge), 2nd sequential expiry → `unanswered_offer_count = 2` → the seller receives the nudge: *"A few offers on [Item] have gone unanswered. Respond to your pending offers — or pause the listing if you're not able to sell right now."* with [Pause Listing] and [Dismiss]. `listing_offer_stats.last_prompt_sent_at` is set (7-day cooldown).

**Decline leg (streak resets, never counts):** if instead the seller **declines** two offers in a row (before expiry), `unanswered_offer_count` must stay **0** and the nudge must **never** fire — a decline chain is engagement, not ignoring. Verify: submit + decline offer A → count 0; submit + decline offer B → count 0; `last_prompt_sent_at` stays NULL.

#### methods to fast-clock 

-- 1. Find the trade
SELECT id, offer_expires_at, status FROM trades 
WHERE status IN ('pending', 'in_progress') 
ORDER BY created_at DESC LIMIT 5;

-- 2. Set its expiry to 5 Seconds from now
UPDATE trades 
SET offer_expires_at = NOW() + INTERVAL '5 Seconds'
WHERE id = '<trade-uuid>';


-- 3. Process it instantly
SELECT public.rpc_process_expired_offers(100);
---

### passed TRD-TC-B03 · Multiple competing offers — sort order + auto-decline on acceptance

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

### passed TRD-TC-B04 · Buyer cancels pending Offer 

**Ref:** TRADING-FLOW-V2 §11.7
**Actors:** test-buyer

**Objective:** Verify a buyer can cancel a pending offer without triggering any seller-style consequence warning.

**Steps:**
1. Log in as **Buyer** and open a **pending** trade from **Trades → Buying**.
2. Tap **[Cancel Trade]**.
3. Select a reason and confirm.

**Expected Result:**
- A cancellation reason modal with standard buyer reasons appears.
- After confirming, a generic "Trade Cancelled" message appears with **no** Level 1/2/3 consequence text.
- Any SP reserved by the buyer is restored.

---

### passed TRD-TC-B05 · Per-seller cap: max 3 pending offers per seller (2026-07-18)

**Ref:** TRADING-FLOW-V2 §4.3 (updated 2026-07-18)
**Actors:** test-buyer (subscriber) + test-seller + test-seller-2
**Precondition:** test-buyer already has 3 pending offers on listings from **test-seller**. test-seller-2 has an available listing in the same node.

**Objective:** Verify the offer cap is per-seller — buyer can have 3 open offers with Seller A and separately 3 open with Seller B.

**Steps:**
1. Log in as **Buyer** — confirm 3 pending offers exist with test-seller.
2. Open an available item from **test-seller-2** (a different seller).
3. Submit an offer on test-seller-2's item.
4. Go back and try to submit a 4th offer on another **test-seller** item.

**Expected Result:**
- The offer to **test-seller-2** submits successfully (different seller, independent cap).
- The 4th offer attempt on **test-seller** is rejected with: "You have 3 pending offers with this seller. Cancel one to make a new offer."
- After cancelling one pending offer with test-seller, a new offer to test-seller submits successfully.

---

### passed TRD-TC-B05a · Per-seller cap: Buyer at 3 with Seller A can still submit to Seller B

**Ref:** TRADING-FLOW-V2 §4.3 (updated 2026-07-18)
**Actors:** test-buyer (subscriber) + test-seller + test-seller-2
**Precondition:** test-buyer has 3 pending offers with test-seller. test-seller-2 has at least 1 available listing in the same node.

**Objective:** Verify the per-seller cap does NOT block offers to a different seller.

**Steps:**
1. Log in as **Buyer** with 3 pending offers to test-seller.
2. Open an available item from **test-seller-2**.
3. Tap **[Request to Buy]** and submit the offer.
4. Check the **Offers** tab — verify 4 total pending offers (3 with Seller A, 1 with Seller B).

**Expected Result:**
- The offer to test-seller-2 submits successfully.
- The Offers tab shows 4 pending offers: 3 grouped under test-seller's items and 1 under test-seller-2's item.
- No "Too Many Open Offers" alert appears.

---

### passed TRD-TC-B05b · Per-seller cap: Blocked at 4th offer to same seller

**Ref:** TRADING-FLOW-V2 §4.3 (updated 2026-07-18)
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** test-buyer has 3 pending offers with test-seller on 3 different listings. test-seller has a 4th available listing.

**Objective:** Verify the 4th offer to the SAME seller is blocked with a clear per-seller error.

**Steps:**
1. Log in as **Buyer** with 3 pending offers to test-seller.
2. Open a 4th available item from **test-seller**.
3. Tap **[Request to Buy]** and submit the offer.
4. Observe the alert message.
5. Cancel one existing pending offer with test-seller, then retry.

**Expected Result:**
- The 4th submission is rejected with an alert: "Too Many Open Offers — You have 3 pending offers with this seller. Cancel one to make a new offer."
- Two buttons: **[View My Offers]** (navigates to TradeList) and **[OK]**.
- After cancelling one offer, the 4th offer submits successfully.

---

### passed TRD-TC-B05c · Per-seller cap: Bundle offer counts as 1 slot, not N

**Ref:** TRADING-FLOW-V2 §4.3 (updated 2026-07-18)
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** test-buyer has 2 pending offers with test-seller. test-seller has 3+ available items. Cart feature flag is enabled.

**Objective:** Verify a bundle (multi-item cart checkout) counts as exactly 1 offer slot against the seller's cap, regardless of how many items are in the bundle.

**Steps:**
1. Log in as **Buyer** with 2 pending offers to test-seller.
2. Add 3 items from test-seller to the cart.
3. Open the **Cart** screen and tap **[Checkout]** (or **[Bundle these N items]**).
4. Confirm the purchase.
5. Check the **Offers** tab — verify you now have 3 pending offers with test-seller (2 existing + 1 bundle).
6. Try to submit a single-item offer on another test-seller item (should be blocked at 3).

**Expected Result:**
- The bundle checkout creates N individual trades (one per item) all sharing the same `bundle_id`, but only consumes **1 slot** against the per-seller cap.
- The Offers tab shows 3 groups: 2 single-item offers + 1 bundle group.
- Attempting a 4th offer (single or bundle) to test-seller is blocked with the per-seller cap error.
- The 3 bundle trades are all visible as individual rows under the same bundle grouping.

---

### passed TRD-TC-B05d · Per-seller cap: Expired offer frees slot immediately

**Ref:** TRADING-FLOW-V2 §4.3 (updated 2026-07-18)
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** test-buyer has 3 pending offers with test-seller. QA ready to fast-forward one offer to expiry.

**Objective:** Verify that when an offer expires, the slot is freed immediately for that buyer-seller pair, allowing a new offer to the same seller.

**Steps:**
1. Log in as **Buyer** with 3 pending offers to test-seller.
2. Fast-forward one offer's `offer_expires_at` to 5 seconds from now (via SQL).
3. Run `SELECT public.rpc_process_expired_offers(100);` to process the expiry.
4. Log in as **Buyer** and verify the expired offer now shows as **Cancelled**.
5. Open a new available item from **test-seller** and submit an offer.

**Expected Result:**
- The expired offer moves to `cancelled` status.
- The buyer now has 2 pending offers + 1 cancelled with test-seller.
- The new offer submits successfully (3rd slot freed by the expiry).
- No "Too Many Open Offers" alert.

---

### passed TRD-TC-B05e · Regression: No leftover global cap blocks buyer over old global limit

**Ref:** TRADING-FLOW-V2 §4.3 (updated 2026-07-18)
**Actors:** test-buyer (subscriber) + test-seller + test-seller-2 + test-seller-3
**Precondition:** Three different sellers (test-seller, test-seller-2, test-seller-3) each have at least 2 available listings in the same node.

**Objective:** Verify the old global cap of 3 is completely removed — a buyer can have more than 3 total pending offers across multiple sellers.

**Steps:**
1. Log in as **Buyer**.
2. Submit 2 pending offers to **test-seller**.
3. Submit 2 pending offers to **test-seller-2**.
4. Submit 2 pending offers to **test-seller-3**.
5. Check the **Offers** tab — verify 6 total pending offers across 3 sellers.

**Expected Result:**
- All 6 offers submit successfully (2 per seller, each under the per-seller cap of 3).
- No "Too Many Open Offers" alert appears at any point.
- The Offers tab shows all 6 pending offers grouped by seller.
- This confirms the old global cap of 3 is completely removed.

---

### passed TRD-TC-B05f · Admin config: Change offer cap from 3 to 5 on Trade Timing page

**Ref:** TRADING-FLOW-V2 §4.3 (admin-configurable, 2026-07-18)
**Actors:** test-admin + test-buyer (subscriber) + test-seller
**Precondition:** Admin has access to http://localhost:3001/settings/trade-timing. test-seller has at least 6 available listings.

**Objective:** Verify the admin can change the per-seller offer cap and it takes effect immediately without app restart.

**Steps:**
1. Log in to the **admin portal** and navigate to **Settings → Trade Timing**.
2. Scroll to the **Offer Limits** section.
3. Change **Max Offers Per Seller** from `3` to `5`.
4. Click **Save** — confirm the success banner appears.
5. Log in to the mobile app as **test-buyer**.
6. Submit 4 pending offers to **test-seller** (all should succeed — under the new cap of 5).
7. Submit a 5th offer to test-seller (should succeed).
8. Try to submit a 6th offer to test-seller.

**Expected Result:**
- The admin page shows a new **Offer Limits** section between Offer Expiry and Auto-Complete.
- The **Max Offers Per Seller** field defaults to `3`, accepts values 1–10.
- Saving shows a green success banner: "Trade timing settings saved successfully!"
- In the app: offers 1–5 to test-seller all submit successfully (new cap = 5).
- The 6th offer is blocked with: "You have 5 pending offers with this seller. Cancel one to make a new offer."
- No app restart or redeploy was needed — the change was immediate.

---

### passed TRD-TC-B05g · Admin config: Revert cap from 5 back to 3

**Ref:** TRADING-FLOW-V2 §4.3 (admin-configurable, 2026-07-18)
**Actors:** test-admin + test-buyer (subscriber) + test-seller
**Precondition:** The cap was previously changed to 5 (TRD-TC-B05f). test-buyer has 4 pending offers with test-seller.

**Objective:** Verify reverting the cap tightens enforcement for NEW offers but does NOT retroactively cancel existing offers above the new cap.

**Steps:**
1. In the **admin portal** Trade Timing page, change **Max Offers Per Seller** from `5` back to `3`.
2. Click **Save**.
3. Log in as **test-buyer** (who currently has 4 pending offers with test-seller).
4. Verify the 4 existing offers are still visible and active (not cancelled).
5. Try to submit a 5th offer to test-seller on a new listing.

**Expected Result:**
- The existing 4 pending offers are **NOT** retroactively cancelled — they remain active.
- The 5th offer attempt is blocked with: "You have 3 pending offers with this seller. Cancel one to make a new offer."
- This confirms the cap change is forward-looking only (new offers only).

---

### passed TRD-TC-B05h · Admin config: Validation — reject invalid values

**Ref:** TRADING-FLOW-V2 §4.3 (admin-configurable, 2026-07-18)
**Actors:** test-admin

**Objective:** Verify the admin page validates the offer cap input range (1–10).

**Steps:**
1. In the **admin portal** Trade Timing page, try to set **Max Offers Per Seller** to `0`.
2. Click **Save** and observe the error.
3. Try to set it to `11`.
4. Click **Save** and observe the error.
5. Set it back to `3` and save successfully.

**Expected Result:**
- `0` is rejected with inline error: "Must be at least 1"
- `11` is rejected with inline error: "Maximum is 10 offers per seller"
- `3` saves successfully with the green success banner.

---

### TRD-TC-B05i · Mobile client: config fetch failure — graceful degradation

**Ref:** TRADING-FLOW-V2 §4.3 (admin-configurable, 2026-07-18)
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** Simulate a config fetch failure (e.g., by temporarily breaking the admin_config query or network). test-seller has 4+ available listings.

**Objective:** Verify the mobile app does NOT silently fall back to a hardcoded `3` when the offer cap config is unavailable. Instead, the server (Edge Function) rejects with a clear error.

**Steps:**
1. Set up test-buyer with 3 pending offers to test-seller.
2. Cause the Edge Function's `admin_config` read to fail (e.g., temporarily remove the `max_pending_offers_per_seller` row or make it inactive).
3. Attempt to submit a 4th offer to test-seller.
4. Observe the error message.

**Expected Result:**
- The offer submission is rejected with a clear error: "Offer limit configuration is unavailable. Please try again."
- The app does NOT silently allow the offer through with a hardcoded fallback of 3.
- The app does NOT crash — it handles the error gracefully.
- After restoring the config row, the offer submits normally (cap = 3 enforced).

---

### TRD-TC-B05j · Regression: Per-seller scope + bundle=1 still hold after config change

**Ref:** TRADING-FLOW-V2 §4.3 (admin-configurable, 2026-07-18)
**Actors:** test-admin + test-buyer (subscriber) + test-seller + test-seller-2
**Precondition:** Admin changes cap to 5 (TRD-TC-B05f). test-seller has 6+ listings. test-seller-2 has 3+ listings.

**Objective:** Verify the core per-seller scoping and bundle-counts-as-1 behavior from the previous change still work correctly with a non-default cap value.

**Steps:**
1. With cap at 5, submit 3 pending offers to test-seller.
2. Submit 2 pending offers to test-seller-2 (both should succeed — different seller).
3. Add 3 items from test-seller to cart and checkout as a bundle.
4. Verify you now have 4 "slots" consumed with test-seller (3 single + 1 bundle = 4).
5. Try a single-item offer to test-seller (should succeed — 5th slot).
6. Try another single-item offer (should be blocked at 5).

**Expected Result:**
- Per-seller scoping works: test-seller-2 offers are counted independently.
- Bundle counts as 1: the 3-item bundle only consumed 1 slot.
- The cap of 5 (not 3) is the effective limit.
- The blocked 6th offer message says "5 pending offers" (reflects the current config).

---

### TRD-TC-B06 · Card declined at offer submission ( i could not test, since the card always is checked by stripe add new card panel)

**Ref:** TRADING-FLOW-V2 §4.3
**Actors:** test-buyer
**Precondition:** Buyer's saved card is a declining test card.

**Objective:** Verify offer submission fails cleanly when the payment authorization is declined.

**Steps:**
1. Log in as **Buyer** with a declining card and attempt to submit an offer.
2. Update to a valid card and retry.

**Expected Result:**
- Submission fails immediately with: "Payment method declined. Please update your card."; no pending offer is created and no SP is reserved.
- After switching to a valid card, the offer submits successfully.

---

### passed TRD-TC-B07 · Expired offer timeline — no message button

**Ref:** TRADING-FLOW-V2 §7 Scenario S3
**Actors:** test-buyer + test-seller
**Precondition:** QA fast-forwards the offer clock past expiry so the trade status is `cancelled`.

**Objective:** Verify that on an expired/cancelled offer's timeline screen, neither the buyer nor the seller sees a "Message" button to start a new conversation, since no active trade exists.

**Steps:**
1. Ensure an offer has expired and the trade status is `cancelled` (see TRD-TC-B02 fast-clock method).
2. Log in as **Buyer** and open the expired trade from **Trades → History**.
3. Observe the Trade Timeline screen.
4. Log in as **Seller** and open the same expired trade from **Trades → History**.
5. Observe the Trade Timeline screen.

**Expected Result:**
- The Trade Timeline screen shows the trade status as **Cancelled** with reason "Offer expired".
- Neither the buyer nor the seller sees a **"Message Buyer"** or **"Message Seller"** button anywhere on the screen.
- All other trade details (Payment Details card, timeline steps with XCircle cancelled icon) remain visible.
- The **[Report Problem]** and **[Cancel Trade]** action buttons are also not shown (trade is already terminal).

---

### passed TRD-TC-B08 · Chat frozen after trade is cancelled or completed

**Ref:** TRADING-FLOW-V2 §7 Scenario S3
**Actors:** test-buyer + test-seller
**Precondition:** A trade exists in `cancelled` or `completed` status, and a chat conversation was previously started between the two parties while the trade was active.

**Objective:** Verify that when a user opens the chat for a cancelled/expired or completed trade, the chat is frozen — messages remain visible but no new messages can be sent.

**Steps:**
1. Ensure a trade is in `cancelled` status (e.g., via TRD-TC-B02 offer expiry flow) AND that at least one message was exchanged between buyer and seller while the trade was active.
2. Log in as **Buyer** and navigate to the chat from **Trades → History** (tap the trade, then — note: since the message button is hidden per TRD-TC-B07, access chat via a deep-link or the Conversations list).
3. Observe the Chat screen.
4. Attempt to type a message and tap send.
5. Log in as **Seller** and open the same chat.
6. Observe the Chat screen.

**Expected Result:**
- The chat header, partner avatar/name, and trade context banner are displayed as normal.
- A **frozen banner** appears below the trade context banner and above the message list:
  - Amber/yellow background with a Warning icon.
  - Text: **"This chat is no longer active. The trade has ended."**
- All previously exchanged messages remain **visible and readable** in the chat.
- The message **input field is disabled** (grayed out) with placeholder text: **"Chat is no longer active"**.
- The **PaperClip (image), Smiley (emoji), MapPin (quick replies), and Send buttons** are all disabled (gray appearance).
- Quick-reply chips do **not** appear.
- Tapping the input or any button produces **no action**.

---

### passed TRD-TC-B09 · Chat remains active for in_progress trades

**Ref:** TRADING-FLOW-V2 §7 Scenario S1
**Actors:** test-buyer + test-seller

**Objective:** Verify that the chat freeze only applies to cancelled/completed trades and does NOT affect active (in_progress) trades.

**Steps:**
1. Ensure a trade is in `in_progress` status (seller has accepted the offer).
2. Log in as **Buyer** and open the chat for that trade.
3. Observe the Chat screen.
4. Type a message and send it.
5. Log in as **Seller** and open the same chat.

**Expected Result:**
- No frozen banner is shown.
- The message input is fully active and editable.
- All buttons (PaperClip, Smiley, MapPin, Send) are functional.
- Messages can be sent and received in real time.

### TRD-TC-B10 · Replace Card path (saved card → new card)

**Ref:** TradeOfferScreen (route `TradeInitiation`)
**Actors:** test-buyer (subscriber with a saved card)

**Objective:** Verify the Replace Card path swaps the saved card via the Stripe sheet and re-attaches.

**Steps:**
1. On the offer screen with a saved card, select **Add New Card** mode (or the equivalent payment-mode selector).
2. Tap **Replace Card**.
3. Complete the Stripe Payment Sheet with a new test card.

**Expected Result:**
- The button shows `Replacing Card...` while busy.
- The Stripe Payment Sheet opens a SetupIntent flow (no immediate charge).
- On success the new card is attached via `attach-payment-method` and becomes the saved card for the offer.

### TRD-TC-B11 · Subscribe-upsell → JoinKidsClub

**Ref:** TradeOfferScreen (route `TradeInitiation`)
**Actors:** test-free

**Objective:** Verify the SP upsell card routes a free user to the Kids Club join screen.

**Steps:**
1. As a free user, open the offer screen and locate the upsell card.
2. Tap **Try Kids Club+ Free**.

**Expected Result:**
- Card reads `Save up to {maxSpPercentage}% with Swap Points` with body `Kids Club+ members can use Swap Points to save on every trade. Try it free for 30 days.`
- Tapping the button navigates to **JoinKidsClub**.

### TRD-TC-B12 · SP info tooltip (not wired — flag)

**Ref:** TradeOfferScreen · `SPInfoTooltip`
**Actors:** test-buyer

**Objective:** Document the SP info tooltip component state.

**Steps:**
1. On the offer screen, attempt to open the SP info tooltip.

**Expected Result:**
- `SPInfoTooltip` is imported and rendered, but no on-screen trigger sets its visibility — it is present-but-not-wired.
- **Flag:** no test can be authored for opening the tooltip until a trigger is wired; this documents the current dead wiring.

### TRD-TC-B13 · Duplicate-offer modal navigation (dead code — flag)

**Ref:** TradeOfferScreen · duplicate-offer `isDuplicate` modal
**Actors:** test-buyer

**Objective:** Document the duplicate-offer modal branch.

**Steps:**
1. Attempt to submit a duplicate offer on an item with an existing active offer.

**Expected Result:**
- The modal's duplicate branch would show **Go to Trade History** → `TradeList` (with **Dismiss**), but no code path currently sets `isDuplicate: true` — the single error path hardcodes `isDuplicate: false`.
- **Flag:** this branch is currently dead code; authoring a runnable case is not possible until a code path sets `isDuplicate` (or the branch is removed).

---

## Group C — SP Behavior

### passed TRD-TC-C01 · SP reserved on offer submission

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

### passed TRD-TC-C02 · SP restored to buyer on seller decline

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

### passed TRD-TC-C03 · SP restored to buyer on offer expiry

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

### passed TRD-TC-C04 · SP stays reserved (not transferred) when seller accepts

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

### passed TRD-TC-C05 · SP released to seller at trade completion

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
## SQL to fast SP release

-- 1. Find trades with pending SP releases
SELECT id, sp_earned_at_completion, pending_sp_release_at, status
FROM trades
WHERE status = 'completed'
  AND pending_sp_release_at IS NOT NULL
  AND sp_released_at IS NULL
ORDER BY pending_sp_release_at ASC;

-- 2. Fast-forward the release clock to 5 seconds from now
UPDATE trades
SET pending_sp_release_at = NOW() + INTERVAL '5 seconds'
WHERE status = 'completed'
  AND pending_sp_release_at IS NOT NULL
  AND sp_released_at IS NULL;

-- 3. Process them instantly
SELECT public.rpc_release_pending_sp(200);

---

### passed TRD-TC-C06 · SP restored to buyer when seller cancels in_progress trade

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

### passed TRD-TC-C07  · Free user sees locked Use SP chip + upgrade modal

**Ref:** TRADING-FLOW-V2 §7 Scenario S9, §4.1
**Actors:** test-free

**Objective:** Verify free users cannot use SP and are shown an upgrade prompt.

**Steps:**
1. Log in as **test-free** and open an **Accept SP** listing.
2. Tap the locked **[Use SP 🔒]** chip on the item.
3. Tap **[Try Kids Club+ Free]** in the modal, then go back and tap **[Not Now]**.

**Expected Result:**
- The [Use SP 🔒] chip shows a lock icon; [Request to Buy] is available without a lock.
- Tapping [Use SP 🔒] opens an upgrade modal: "Unlock SP discounts with Kids Club+. Save up to 50% on items. 30 days free."
- [Try Kids Club+ Free] navigates to the subscription signup screen; [Not Now] closes the modal and returns to the item with [Request to Buy] still available.

---

### passed TRD-TC-C08 · SP entry capped by the item's category cap (not a flat 50%)

**Ref:** TRADING-FLOW-V2 §4.4 FR-SP-003 · reconciled 2026-08-29 to the category-driven model (DEV-TASK-42)
**Actors:** test-buyer (subscriber)

**Objective:** Verify the SP entry field is capped by the item's **category** spending cap
(`categories.sp_spending_cap_percent`), not a flat 50% of the item price.

**Background (actual model):**
- The cap is per-category and **admin-configurable** in the admin portal (Category Management → SP spending cap %). Valid range **50–80%**; new categories default to 50%; a configured category value **overrides** the global 50% default (owner decision 2026-08-09).
- Max SP on an item = `FLOOR(item price × cap% / 100)`. The client shows it as the max hint; the server enforces it via `fn_item_effective_sp_cap` + `fn_reserve_sp_on_offer` (an over-cap offer is rejected at the DB — HP-4 invariant).
- Observed staging category caps: 50% (Toys), 70% (Games), 75% (Sports).

**Steps:**
1. In the admin portal, read the target item's category **SP spending cap %** (e.g. 70%).
2. Log in as **Buyer** and open the SP entry field on an item in that category (e.g. $30 in a 70%-cap category → max = `FLOOR(30 × 0.70)` = 21 SP).
3. Type a value above the category max (e.g. "25").
4. Confirm the field clamps to the category max and shows the max hint.
5. Set SP to exactly the category max.

**Expected Result:**
- The field range is 0 to the category max (e.g. **21** for a $30 item at 70%) and clamps there — it never accepts a higher value. The max is **not** a flat 50% (that would be 15).
- The field rejects/clamps "25" to 21 and shows the max hint, e.g. "Max: 21 SP (70% of price)" — the percentage matches the item's category cap, never a hardcoded 50%.
- At the max the breakdown reads "$9 cash + 21 SP = $30 total" with the platform fee still charged in cash.
- **Server enforcement:** submitting an SP amount over the category cap via a direct API call is rejected (cap error) — the DB invariant holds even if the UI hint is bypassed.

---

## Group D — Auto-Complete & Timers

### passed TRD-TC-D01 · Auto-complete fires when buyer never taps I Got It

**Ref:** TRADING-FLOW-V2 §7 Scenario S7, §9.2 · R2 (2026-08-10)
**Actors:** test-buyer + test-seller
**Precondition:** QA fast-forwards the auto-complete/pickup clock past expiry on an In Progress trade. The post-acceptance deadline is now sourced from the admin-configurable **pickup window** (`pickup_window_hours`, default 72h); auto-complete behavior is retained (owner decision 2026-08-09).

**Objective:** Verify an undisputed In Progress trade auto-completes after its window.

**Steps:**
1. Reach an **In Progress** trade and do not tap [I Got It].
2. Allow the auto-complete time to pass.
3. Open the trade as either party.

**Expected Result:**
- Both parties receive a push: "Your trade for [Item] was automatically marked complete." with a [Rate & Review] deep link.
- The trade shows as **Completed** and SP is released to the seller; no retroactive [I Got It] is required.
## fast track in progress trade for auto complete 
-- STEP 1: Find your in_progress trade
SELECT id, status, auto_complete_at, completed_at, disputed_at
FROM trades 
WHERE status = 'in_progress' 
ORDER BY created_at DESC LIMIT 5;

-- STEP 2: Fast-forward its auto-complete clock to 5 seconds from now
UPDATE trades 
SET auto_complete_at = NOW() + INTERVAL '5 seconds'
WHERE id = '<trade-uuid>'
  AND status = 'in_progress';

-- STEP 3: Run the auto-complete processor
SELECT public.rpc_process_auto_complete(100);
---

### passed TRD-TC-D02 · Auto-complete skipped when dispute is open

**Ref:** TRADING-FLOW-V2 §6.2.4
**Actors:** test-buyer + test-seller
**Precondition:** An In Progress trade has an open dispute; QA fast-forwards past the auto-complete time.

**Objective:** Verify a disputed trade does not auto-complete.

**Steps:**
1. Open an **In Progress** trade that has a reported dispute.
2. Allow the auto-complete time to pass.
3. Reopen the trade.

**Expected Result:**
- The trade stays **In Progress** and is not completed; the dispute remains open.

---

### passed TRD-TC-D03 · Offer countdown pill color states

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
## sql to fast track offers 
-- STEP 1: Find pending offers
SELECT id, status, offer_expires_at, created_at
FROM trades 
WHERE status = 'pending' 
ORDER BY created_at DESC LIMIT 5;

-- STEP 2: Fast-forward the offer expiry clock to 5 seconds from now
UPDATE trades 
SET offer_expires_at = NOW() + INTERVAL '5 seconds'
WHERE id = '<trade-uuid>'
  AND status = 'pending';

-- STEP 3: Process expired offers
SELECT public.rpc_process_expired_offers(100);
---

### passed TRD-TC-D04 · Auto-complete banner visible to buyer only

**Ref:** TRADING-FLOW-V2 §8.2
**Actors:** test-buyer + test-seller

**Objective:** Verify the auto-complete banner is shown to the buyer and not the seller.

**Steps:**
1. Log in as **Buyer** and open an **In Progress** trade.
2. Log in as **Seller** and open the same trade.
3. Log in as **Buyer** and open the trade after it completes.

**Expected Result:**
- The buyer sees an auto-complete banner ("Auto-completes in [time]" + "Received it? Tap 'I Got It'").
- The seller does not see the banner; instead sees "Buyer paid. Awaiting pickup confirmation."
- Once completed, the banner is gone.

---

### did not test , post MVP TRD-TC-D05 · Post-meetup nudge after auto-complete

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

### passed TRD-TC-E01 · Buyer opens Report a Problem modal

**Ref:** TRADING-FLOW-V2 §7 Scenario S10, §6.2.3
**Actors:** test-buyer + test-seller

**Objective:** Verify a buyer can report a problem on an In Progress trade.

**Steps:**
1. Log in as **Buyer** and open an **In Progress** trade.
2. Tap **[Report a Problem]**.
3. Select **Seller was a no-show**, tap **[Submit Report]** (a description is only required for **Other issue**).

**Expected Result:**
- The trade initially shows [I Got It], [Report a Problem], and [Message Seller].
- The report modal (bottom sheet, title **Report an Issue**) lists five reasons: [Seller was a no-show], [Item not as described], [Seller not responding], [Couldn't agree on meetup], [Other issue] — with a free-text field that appears only for **Other issue** (min 20 characters).
- After submitting, the modal closes and the timeline refreshes to show the **Dispute in progress** banner (no toast); the trade enters a disputed state and the seller plus admin are notified.

---

### passed TRD-TC-E02 · Disputed trade does not auto-complete or release SP

**Ref:** TRADING-FLOW-V2 §6.2.4
**Actors:** test-buyer + test-seller
**Precondition:** Trade has an open dispute; QA fast-forwards the auto-complete and SP-release windows.

**Objective:** Verify a disputed trade is excluded from auto-complete, SP release, and payout.

**Steps:**
1. Open a disputed **In Progress** trade.
2. Allow the auto-complete and SP-release times to pass.
3. Reopen the trade.

**Expected Result:**
- The trade stays **In Progress**, SP is not released, and no payout is initiated while the dispute is open.

---

### passed TRD-TC-E03 · Buyer UI during active dispute

**Ref:** TRADING-FLOW-V2 §11.4
**Actors:** test-buyer

**Objective:** Verify the buyer's screen reflects an active dispute and prevents a second report.

**Steps:**
1. Log in as **Buyer** and open a trade with an active dispute.
2. Look for the auto-complete banner and the action buttons.

**Expected Result:**
- The auto-complete banner is replaced by an amber dispute banner: "Your issue has been reported. Our team will review within 24 hours. Auto-complete is paused."
- The [I Got It] and [Report a Problem] buttons are hidden; [Message Seller] remains; a second dispute cannot be filed.

---

### passed TRD-TC-E04 · Seller UI during active dispute

**Ref:** TRADING-FLOW-V2 §11.4
**Actors:** test-seller

**Objective:** Verify the seller's screen reflects an active dispute and hides the cancel action.

**Steps:**
1. Log in as **Seller** and open the disputed trade.

**Expected Result:**
- An amber notice appears: "A buyer has reported an issue with this trade. Our team is reviewing."
- The [Cancel] button is hidden during the active dispute; [Message Buyer] remains.

---

### passed TRD-TC-E05 · Admin resolves dispute → Complete (seller fulfilled correctly)

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

### passed TRD-TC-E06 · Admin resolves dispute → Refund (buyer's favor)

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

### TRD-TC-E07 · Report an Issue — no reason (disabled submit)

**Ref:** FLOW-08-05 · IssueReportModal (TradeTimeline `report-problem-button`) · reconciled 2026-08-29 (DEV-TASK-42)
**Actors:** test-buyer

**Objective:** Verify Submit Report is disabled until a reason is selected.

**Steps:**
1. Log in as **Buyer** and open an **In Progress** trade.
2. Tap **[Report Problem]** to open the **Report an Issue** bottom sheet.
3. Observe the **[Submit Report]** button with no reason selected.

**Expected Result:**
- The bottom sheet opens with the title **Report an Issue** and subtitle "What went wrong with this trade?".
- The five reason options render: **Seller was a no-show** · **Item not as described** · **Seller not responding** · **Couldn't agree on meetup** · **Other issue**.
- **[Submit Report]** is disabled while no reason is selected.

### TRD-TC-E08 · Report an Issue — reason selected (non-Other)

**Ref:** FLOW-08-05 · IssueReportModal
**Actors:** test-buyer

**Objective:** Verify selecting a non-"Other" reason enables submit without a description.

**Steps:**
1. Open the **Report an Issue** modal on an In Progress trade.
2. Tap **Seller was a no-show** (or any non-Other reason).
3. Observe the description section and the submit button.

**Expected Result:**
- The selected option shows the selected (green) radio state.
- No description textarea appears for a non-Other reason.
- **[Submit Report]** becomes enabled.
- Tapping the selected option again deselects it (and re-disables submit).

### TRD-TC-E09 · Report an Issue — "Other" + min-20 description

**Ref:** FLOW-08-05 · IssueReportModal
**Actors:** test-buyer

**Objective:** Verify the "Other" description requirement (min 20 chars, max 500).

**Steps:**
1. Open the **Report an Issue** modal and tap **Other issue**.
2. Enter a short description (e.g., 10 characters).
3. Then enter a description of 20 or more characters.

**Expected Result:**
- A textarea appears with label "Please describe the issue (min. 20 characters)" and placeholder "Tell us what happened…".
- With fewer than 20 characters, **[Submit Report]** stays disabled.
- At 20+ characters the button enables; input is capped at 500 characters.
- Selecting a different reason hides/clears the description.

### TRD-TC-E10 · Report an Issue — submitting + success/error

**Ref:** FLOW-08-05 · IssueReportModal · `open-dispute`
**Actors:** test-buyer

**Objective:** Verify the submitting state and the success/error outcomes.

**Steps:**
1. Select a reason (and, for **Other issue**, a valid description) and tap **[Submit Report]**.

**Expected Result:**
- The button shows a **Submitting…** spinner while the `open-dispute` Edge Function runs (body: `trade_id`, `reason`, `description`).
- On success, the modal closes and the trade timeline refreshes to show the **Dispute in progress** banner (no toast); the trade enters a disputed state and the seller plus admin are notified.
- On failure, an inline error message appears inside the modal; the user stays on the modal and can retry or Cancel.

---

## Group F — Payout

### passed TRD-TC-F01 · Payout shown on trade completion (no dispute)

**Ref:** TRADING-FLOW-V2 §6.3.1
**Actors:** test-seller

**Objective:** Verify a completed, undisputed trade shows the seller's payout as processing.

**Steps:**
1. Complete a trade normally (buyer taps [I Got It] → [Confirm]).
2. Log in as **Seller** and open the completed trade and/or payout area.

**Expected Result:**
- The seller sees the payout as pending/processing for that sale; no duplicate payout is shown for the same trade.

---

### passed TRD-TC-F02 · Payout held when dispute is open at completion time

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

### passed TRD-TC-F03 · Payout needs action when seller has no payout method

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

### passed TRD-TC-G01 · Offer expiry reminders sent to seller

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

### passed TRD-TC-G02 · Auto-complete reminders sent to buyer

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

### did not test TRD-TC-G03 · Notification throttle per trade

**Ref:** TRADING-FLOW-V2 §9.5
**Actors:** test-buyer / test-seller

**Objective:** Verify no more than 3 non-payout pushes are sent per user per trade.

**Steps:**
1. Drive a single trade through many reminder-triggering events.
2. Count the non-payout pushes received for that trade.

**Expected Result:**
- A maximum of 3 push notifications are received per user for that trade; any beyond that are not delivered.

---

### passed TRD-TC-G04 · Push notifications deep-link to the correct screen

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

###  passed TRD-TC-H01 · Free buyer sees subscription CTA on completion

**Actors:** test-free

**Objective:** Verify a free buyer is shown a Kids Club+ upsell on the completion screen.

**Steps:**
1. Log in as **test-free** and complete any trade.

**Expected Result:**
- The completion screen reads: "Trade complete! Kids Club+ would've saved you $2 on this trade — try it free for 30 days." with a [Try Kids Club+ Free — 30 Days] button.

---

###  passed TRD-TC-H02 · Subscriber buyer used SP — "You saved" message

**Actors:** test-buyer (subscriber)

**Objective:** Verify a subscriber buyer who used SP sees their savings on completion.

**Steps:**
1. Log in as **test-buyer** and complete a trade that used 8 SP.

**Expected Result:**
- The completion screen reads: "Got it! You saved $8 using SP!" and shows the remaining SP balance ("You have [remaining_sp] SP available.").

---

###  passed TRD-TC-H03 · Subscriber seller on Accept SP listing — SP pending notice

**Actors:** test-seller (subscriber)

**Objective:** Verify a subscriber seller sees their pending SP on completing an Accept SP sale.

**Steps:**
1. Log in as **test-seller** and complete an **Accept SP** sale.

**Expected Result:**
- The completion screen reads: "[total_sp] SP releasing in [N] days — added to your pending wallet." with a [View Wallet] button that opens the SP wallet.

---

### passed  TRD-TC-H04 · Subscriber seller on Cash Only listing — upsell to Accept SP

**Actors:** test-seller (subscriber)

**Objective:** Verify a subscriber seller is nudged to enable Accept SP on future listings.

**Steps:**
1. Log in as **test-seller** and complete a **Cash Only** sale.

**Expected Result:**
- The completion screen reads: "Sold for cash! Try 'Accept SP' on your next listing to also earn SP." with a [Create New Listing] button.

---

### TRD-TC-H05 · Subscription lifecycle — trial / paid / cancel regression

**Ref:** SYSTEM_REQUIREMENTS_V2 § Subscriptions (FR-UM-004) · MODULE-11 SUB-002 / SUB-008 / SUB-009 · misc./SUB-002 / SUB-008 / SUB-009
**Actors:** new user (onboarding), test user with payment method

**Objective:** Verify the three subscription lifecycle transitions (trial start → paid conversion → cancel) still work end-to-end, and that the subscription state machine (status, `getSubscriptionSummary` feature gates, grace period) remains intact. This is a regression guard for R6/R7 — it must PASS today with the current in-app flows.

**Steps:**
1. **Trial start:** Sign up a fresh account (or use `SubscriptionChoiceScreen` onboarding) and enroll in the trial.
2. Confirm status via `getSubscriptionSummary` → status = `trial`, `can_earn_sp` / `can_spend_sp` = true, `transaction_fee_cents` = 99.
3. **Paid conversion:** Use the trial-conversion test screen (or Stripe webhook) to convert to a paid subscription.
4. Confirm status = `active`, `stripe_subscription_id` set, `auto_renew_enabled` = true.
5. **Cancel:** Open `ManageKidsClub` → Cancel, pick a reason, confirm.
6. Confirm the post-cancel status matches the V2 rules (active user → `cancelled` with benefits until period end; trial user with SP activity → `grace_period`; trial user without SP → `free`).

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Trial start | `subscriptions.status` = `trial`; `getSubscriptionSummary` returns `can_earn_sp=true`, `can_spend_sp=true`; buyer charged the active-member platform fee ($1.49, tiered engine `buyer_fee_active_member_cents`) |
| Paid conversion | Status transitions `trial` → `active`; `stripe_subscription_id` populated; `auto_renew_enabled=true`; $1.49 active-member fee retained |
| Cancel (active) | Status = `cancelled`; `cancelled_at` recorded; benefits (incl. SP spend) remain until period end; auto-renew off |
| Cancel (trial, no SP) | Status = `free` — no grace period |
| Cancel (trial, SP activity) | Status = `grace_period`; `grace_ends_at` = now + `admin_config.grace_period_days` (default 90); SP wallet frozen (`can_spend_sp=false`) |
| Feature gates after cancel | `getSubscriptionSummary.can_earn_sp` / `can_spend_sp` = false in `grace_period` / `free` |

---

##  passed Group I — Safety UX

###  passed TRD-TC-I01 · Safe meetup guidance card visible on in_progress trade

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

### passed TRD-TC-I02 · Safe meetup card dismissible per trade (not globally)

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

### passed TRD-TC-I03 · In-chat safety banner persistent and non-dismissible

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

### passed TRD-TC-I04 · Pre-first-message safety modal shown once per listing

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

### passed TRD-TC-I05 · Chat quick-reply chips visible on in_progress trade

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

### TRD-TC-I06 · Liability disclaimer modal gates purchase (checkbox + Accept & Continue)

**Ref:** TRADING-FLOW-V2 · Safety UX (Liability Disclaimer at trade time)
**Actors:** test-buyer

**Objective:** Verify a liability disclaimer modal appears at trade confirmation and that "Accept & Continue" is disabled until the checkbox is checked.

**Steps:**
1. Open an available listing and tap **[Request to Buy]**.
2. On the trade screen, tap **[Confirm & Pay]**.
3. Check the checkbox, then tap **[Accept & Continue]**.

**Expected Result:**
- Modal opens with title "Liability Disclaimer" and scrollable content.
- "Accept & Continue" is disabled until the checkbox is checked.
- After accepting, the modal closes and the trade proceeds; the trade's disclaimer acknowledgment (policy id + timestamp) is recorded.

---

### TRD-TC-I07 · Disclaimer modal Cancel path — no trade created

**Ref:** TRADING-FLOW-V2 · Safety UX
**Actors:** test-buyer

**Objective:** Verify cancelling the disclaimer modal aborts the purchase attempt without creating a trade.

**Steps:**
1. Trigger the disclaimer modal via **[Confirm & Pay]**.
2. Tap **[Cancel]** without checking the checkbox.

**Expected Result:**
- The modal closes; no trade is created; the user can retry the purchase flow.

---

### TRD-TC-I08 · Disclaimer modal ✕ close behaves like Cancel

**Ref:** TRADING-FLOW-V2 · Safety UX
**Actors:** test-buyer

**Objective:** Verify the ✕ close button behaves the same as Cancel.

**Steps:**
1. Trigger the disclaimer modal.
2. Tap the ✕ close button.

**Expected Result:**
- The modal closes without creating a trade or recording acknowledgment; the user can reopen it by retrying.

---

### TRD-TC-I09 · Disclaimer checkbox resets to unchecked on reopen

**Ref:** TRADING-FLOW-V2 · Safety UX
**Actors:** test-buyer

**Objective:** Verify the acknowledgment checkbox does not persist across modal opens.

**Steps:**
1. Open the disclaimer modal, check the checkbox, then close via ✕ or Cancel.
2. Reopen the modal.

**Expected Result:**
- The checkbox is reset to unchecked; "Accept & Continue" is disabled until re-checked.

---

### TRD-TC-I10 · Disclaimer modal loading state

**Ref:** TRADING-FLOW-V2 · Safety UX
**Actors:** test-buyer

**Objective:** Verify the modal shows a loading state while the disclaimer policy loads.

**Steps:**
1. Trigger the disclaimer modal under slow network.

**Expected Result:**
- A "Loading disclaimer…" indicator shows until content arrives; no blank modal; errors show a retry path.

---

### TRD-TC-I11 · Disclaimer modal not shown for non-trade actions

**Ref:** TRADING-FLOW-V2 · Safety UX
**Actors:** test-buyer

**Objective:** Verify the trade-time disclaimer does not appear for unrelated actions.

**Steps:**
1. Create/edit a listing, edit the profile, and open the SP wallet.

**Expected Result:**
- No liability disclaimer modal appears for listing creation, profile editing, or wallet actions; it is trade-specific only.

---

## Group J — Seller Cancel Consequences

**Ref:** TRADING-FLOW-V2 §11.7

### passed TRD-TC-J01 · Seller cancels in_progress trade → Level 1 alert

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

### passed TRD-TC-J02 · 2nd post-acceptance cancel → Level 2 alert

**Actors:** test-seller
**Precondition:** test-seller has exactly 1 prior post-acceptance cancellation.

**Objective:** Verify the second post-acceptance cancellation shows a Level 2 warning.

**Steps:**
1. Log in as **Seller** and cancel a new **In Progress** trade with a reason.

**Expected Result:**
- The alert warns that repeated cancellations "may affect selling privileges" (Level 2).

---

### passed TRD-TC-J03 · 3rd post-acceptance cancel → Level 3 + admin flag

**Actors:** test-seller
**Precondition:** test-seller has exactly 2 prior post-acceptance cancellations.

**Objective:** Verify the third post-acceptance cancellation shows a Level 3 warning and flags the account.

**Steps:**
1. Log in as **Seller** and cancel a new **In Progress** trade with a reason.

**Expected Result:**
- The alert states the "account under review" (Level 3); the seller's account is flagged for admin review.

---

### passed TRD-TC-J04 · Seller cancel button visible only on in_progress

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

### passed  TRD-TC-J05 · Seller cancel modal shows seller-specific reasons only

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

### passed TRD-TC-K01 · Subscriber sees $1.49 fee + Sales Tax line in value stack

**Actors:** test-buyer (subscriber)

**Objective:** Verify the subscriber value stack shows the $1.49 active-member platform fee (tiered buyer-fee engine R1 — `buyer_fee_active_member_cents`), a Sales Tax line, and an SP discount row when SP is used. Also verifies the Item Detail screen Price Breakdown includes Sales Tax.

**Steps:**
1. Log in as **test-buyer** and open a listing → review the **Price Breakdown** card.
2. Tap **[Request to Buy]** to open the Make Offer screen.
3. Scroll to the value stack.
4. Enter 5 SP.

**Expected Result:**
- **Item Detail screen:** Price Breakdown shows Item Price, Transaction Fee, **Sales Tax** (with rate), then Total.
- **Make Offer screen:** Value stack shows Offer amount, "Platform fee" $1.49, **"Sales Tax"** (based on node rate), and "Total cash" = offer amount + sales tax + $1.49.
- After entering 5 SP, an "SP discount" row appears showing `-5 SP` — it reduces the cash portion only; the Sales Tax stays calculated on the full item price (BP-37) and does not change.
- The Stripe PaymentIntent created at offer submission includes the tax amount (Option B — tax is charged at offer time, not deferred to completion).

---

### passed TRD-TC-K02 · Non-subscriber sees tiered fee + Sales Tax line in value stack

**Actors:** test-free

**Objective:** Verify the non-subscriber value stack shows the tiered platform fee, a Sales Tax line, and no SP input. Also verifies the Item Detail screen Price Breakdown includes Sales Tax.

**Steps:**
1. Log in as **test-free** and open a listing → review the **Price Breakdown** card.
2. Tap **[Request to Buy]** to open the Make Offer screen.
3. Review the value stack.

**Expected Result:**
- **Item Detail screen:** Price Breakdown shows Item Price, Transaction Fee, **Sales Tax**, then Total.
- **Make Offer screen:** "Platform fee" is tiered — **flat $1.49 on the first trade** (`buyer_fee_first_trade_cents`); after 1+ completed trades it is **5% of the cash portion + $1.99, capped at $4.99** (`buyer_fee_subsequent_*`). **"Sales Tax"** row (based on node rate); "Total cash" = offer amount + sales tax + the applicable tiered fee.
- No SP input section is visible.

---

### passed TRD-TC-K03 · SP discount row conditional on SP used

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


### passed TRD-TC-K04 · Bundle checkout — fee charged per item (admin toggle OFF)

**Actors:** test-buyer (subscriber), test-buyer (free)
**Precondition:** Admin toggle `charge_one_fee_per_bundle` is OFF (default). Bundle has 3+ items from the same seller.

**Objective:** Verify that when the admin toggle is OFF, the platform fee is charged per item in the bundle.

**Steps:**
1. Log in as **test-buyer (subscriber)** on the mobile app.
2. Add 3 items from the same seller to cart.
3. Navigate to **CartCheckout** screen.
4. Review the **Order Summary** section.
5. Verify the **Platform Fee** row shows: `Platform Fee (×3 items): $4.47` (3 × $1.49 subscriber fee).
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
| Toggle OFF + free user | Same behavior with the applicable tiered fee (first-trade $1.49; subsequent 5% + $1.99 capped $4.99) per item |
| Single-item trade (non-bundle) | Fee charged once, no "(×1 items)" suffix |

---

### passed TRD-TC-K05 · Bundle checkout — one fee per bundle (admin toggle ON)

**Actors:** test-buyer (subscriber), test-buyer (free)
**Precondition:** Admin toggle `charge_one_fee_per_bundle` is ON (enabled). Bundle has 3+ items from the same seller.

**Objective:** Verify that when the admin toggle is ON, the platform fee is charged only once for the entire bundle.

**Steps:**
1. Log in as **test-buyer (subscriber)** on the mobile app.
2. Add 3 items from the same seller to cart.
3. Navigate to **CartCheckout** screen.
4. Review the **Order Summary** section.
5. Verify the **Platform Fee** row shows: `Platform Fee: $1.49` (single fee, no ×N suffix) for a subscriber.
6. Verify the **Cash Total** includes exactly 1× the platform fee.
7. Tap **Send Offer** and complete checkout.
8. Navigate to the bundle trade's **Timeline** screen.
9. Expand the bundle item list ("View all items").
10. Scroll to the **bundle totals** section.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Admin toggle ON | Config page at `localhost:3001/config` → Fees tab shows `Charge One Fee Per Bundle: Enabled` |
| CartCheckout: Platform Fee label | Shows "Platform Fee: $1.49" (subscriber) — no "(×N items)" suffix |
| CartCheckout: Cash Total | Includes exactly 1× platform fee + subtotal - SP + tax |
| Trade Timeline: Bundle totals | "Platform Fee" row shows exactly 1× fee (single `buyer_transaction_fee_cents` across all bundle trades) |
| Toggle ON + free user | One fee for the entire bundle (first-trade $1.49; subsequent tiered) |
| Single-item trade (non-bundle) | Fee charged once — unaffected by toggle |

---

### passed TRD-TC-K06 · Bundle timeline — fee display matches charge mode

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
| Toggle OFF bundle | "Platform Fee" = sum of all individual fees (e.g., $4.47 for 3 subscriber items at $1.49) |
| Toggle ON bundle | "Platform Fee" = single fee (e.g., $1.49) |
| Both bundles | "Items Total" and "Sales Tax" display correctly regardless of fee mode |

---

### passed TRD-TC-K07 · Admin partial refund — refund price only, keep fee

**Actors:** admin (admin portal)
**Precondition:** A `completed` trade exists with captured payment: price $100, fee $1.49, tax $7.00 (total charged $108.49).

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

### passed TRD-TC-K08 · Admin partial refund — tax ledger partially refunded

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

### passed TRD-TC-K09 · Payments reconciliation page — charged vs refunded per trade

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

### deffered TRD-TC-K10 · Server-side enforcement — one-fee-per-bundle with stale client

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

### TRD-TC-K11 · Seller fee = 5% × cash portion (SP trade)

**Ref:** SYSTEM_REQUIREMENTS_V2 §8.1 (8.1.2 Seller fee / Example 2, 8.1.4 default 5%) · Migration `20260727000001_add_seller_transaction_fee_cents.sql`
**Actors:** test-seller (free tier — deterministic 5%), test-buyer (subscriber)
**Precondition:** `platform_fee_seller_percentage` = 5 (default seed). Seller is on the FREE tier so `effectivePct = basePct = 5` (subscriber-tier seller fee depends on `platform_fee_seller_discount_percentage_kids_club_plus` — see note). Item is $25, Accept SP enabled.

**Objective:** Verify the seller fee is 5% of the **cash portion** (price − SP), NOT 5% of the full item price — this is the exact input contract R5 (SP redemption) must consume. Fee must be computed at offer time and deducted from the payout at completion.

**Steps:**
1. test-seller (free) lists a $25 item with **Accept SP** enabled.
2. test-buyer (subscriber) submits an offer using **12 SP** on the $25 item → cash portion = $13.00, buyer fee = $1.49.
3. Verify `trades.seller_transaction_fee_cents` on the created offer.
4. test-seller accepts; test-buyer confirms completion.
5. Verify `trades.payout_amount_cents` on the completed trade and the seller payout record.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Offer-time fee | `seller_transaction_fee_cents` = round(5% × $13.00) = **$0.65 (65¢)** — NOT $1.25 (5% × $25 full price) |
| Fee base | Based on cash portion (price − SP), excluding buyer fee — matches §8.1.2 Example 2 |
| Completion payout | `payout_amount_cents` = cash portion − seller fee = $13.00 − $0.65 = **$12.35** (before provider payout fees) |
| SP not fee'd | Seller still credited 12 SP (pending → released per SP rules); no fee deducted from SP |
| Verification SQL | `SELECT sp_amount, cash_amount_cents, buyer_transaction_fee_cents, seller_transaction_fee_cents FROM trades WHERE listing_id = '<id>';` then after completion `SELECT payout_amount_cents FROM trades WHERE id = '<trade_id>';` |

> Note: The subscriber-seller variant uses `platform_fee_seller_discount_percentage_kids_club_plus` (seed = 0). This is now editable in the admin portal at **Config → Trade Timing → Transaction Fees → Seller Fee % — Kids Club+**. Set it to 5 if the intended policy is a uniform 5% seller fee across tiers. The spec (§8.1.2 / §8.1.5) has been aligned to the code: seller fee = rate × cash portion (item price − SP), with per-tier admin config documented in §8.1.3.

---

## Group L — Bundle Flows

**Ref:** TRADING-FLOW-V2 §11.3.1

### passed TRD-TC-L01 · Bundle banner on trade detail

**Ref:** TRADING-FLOW-V2 §11.3.1, Addendum C
**Actors:** test-buyer (subscriber) + test-seller (subscriber)

**Objective:** Verify the bundle banner ("Part of a bundle · N items") appears on the Trade Timeline screen for trades that share a `bundle_id` with one or more sibling trades, and is absent on non-bundle trades.

---

#### What qualifies an item to be part of a bundle?

A **bundle** is a group of 2+ trades that share the same `bundle_id` UUID. Bundles are created in two ways:

1. **Via Cart Checkout (natural user flow):**
   - Buyer adds **2+ items from the SAME seller** to the cart.
   - When the buyer completes checkout via the **CartCheckoutScreen**, each cart item creates a separate trade via the `create-trade-offer` Edge Function.
   - All trades created in that single checkout share the same `bundle_id` (the cart's `cart_id` UUID).
   - The seller must be the same for all items (single-seller enforcement — `CartScreen` / `CartCheckoutScreen` blocks cross-seller checkouts).
   - Items can be Cash Only, Accept SP, or mixed — the bundle is purely a grouping mechanism.

2. **Via seed data (`seed-staging-data.ts --extended`):**
   - The seed script creates 2+ trades directly in the DB, all assigned the fixed `bundle_id` `00000000-0000-0000-0000-00000000bundle`.
   - Seeded trades are `status: 'in_progress'` with `auto_complete_at: null` (no auto-complete clock started).
   - Because they lack `auto_complete_at`, seeded bundle trades appear under **YOUR OFFERS** on the buyer's Active tab (not under **IN PROGRESS**), but the bundle banner still renders on the Trade Timeline screen when `bundleSize > 1`.

**Bundle banner rendering logic (`TradeTimelineScreen.tsx`):**
The screen queries `SELECT count(*) FROM trades WHERE bundle_id = <current_trade.bundle_id>`. If the count is `> 1`, it renders a green banner at the top: `"Bundle offer · N items"` with a **"View all items"** toggle. When expanded, the banner shows all items in the bundle as a list. Each item row displays:
- Item title (tap-able, navigates to `ListingDetail`)
- SP amount (if any, in green)
- Cash price

The banner counts ALL trades sharing the `bundle_id` regardless of status (pending, in_progress, completed, cancelled).

---

#### Preconditions

**Option A — Natural cart flow (recommended for accurate In Progress placement):**
- `feature_flag_cart_enabled` is `true` in `admin_config`.
- test-seller has **2+ available listings** (any payment type).
- test-buyer has a saved payment method and, if using Accept SP items, is a subscriber with ≥ 15 SP.
- No other active cart exists for test-buyer.

**Option B — Seed data shortcut (`--extended` flag):**
- Staging DB is seeded with `npm run seed:staging -- --extended` from the `p2p-kids-marketplace` directory.
- This creates 2 bundle trades (listings at indices 1 and 2) sharing `bundle_id = '00000000-0000-0000-0000-00000000bundle'`.

**Both options:** test-buyer has at least one non-bundle In Progress trade (any type) for the negative check.

---

#### Detailed Steps

**Step 1 — Verify bundle banner appears on a bundled trade (Option A: via cart checkout flow):**

1. Log in as **test-buyer** on the mobile app.
2. Open the **Item Detail** screen for an available listing from **test-seller**.
3. Tap **[Add to Cart]** (below the listing photo, secondary outlined button with a shopping cart icon).
4. Confirm the toast "Item added to your cart."
5. Tap the **Cart** icon in the bottom nav bar to open the **Cart screen**.
6. Navigate back to the home screen and open a **second available listing** from the **same seller (test-seller)**.
7. Tap **[Add to Cart]** again — the item is added directly (no modal since both are from the same seller). Verify the cart badge shows `2`.
8. Open the **Cart screen** (bottom nav Cart icon).
   - Confirm both items are listed under test-seller's name.
   - Confirm the subtotal reflects the sum of both item prices.
9. Tap **[Checkout]**.
10. On the **CartCheckoutScreen**, review the order summary and tap **[Confirm Purchase]**.
11. After the success screen, navigate to **Trades → Active** (bottom nav Trades icon, then Active tab).
12. Locate the **IN PROGRESS** section and tap on one of the bundle trade rows to open the **Trade Timeline screen**.

**Step 1 — Verify bundle banner appears on a bundled trade (Option B: via seed data):**

1. Ensure `npm run seed:staging -- --extended` has been run from `p2p-kids-marketplace/`.
2. Log in as **test-buyer** on the mobile app.
3. Open **Trades → Active** (bottom nav Trades icon, then Active tab).
4. Scroll to the **YOUR OFFERS** section.
5. Locate a trade row that is part of a bundle (it may be labelled as PENDING or you can identify it as one of the two listings that share the bundle; both should be visible as separate rows).
6. Tap the trade row to open the **Trade Timeline screen**.

**Step 2 — Observe the bundle banner with expandable item list:**

- Look at the top of the Trade Timeline screen, just above the **Status Banner** (the green/amber/red card showing trade status).
- Verify a green rounded banner is present with the title **"Bundle offer · N items"** (where N ≥ 2).
- The banner has a light green background (`#EEF9F4`), green text (`#5DBB8E`), and rounded corners (`borderRadius: 8`).
- Below the title, verify a **"View all items"** link is visible (tap-able text).
- Tap **"View all items"** to expand the item list.
- Verify the expanded list shows all N items in the bundle. Each row displays:
  - Item title (truncated, blue text, tap-able)
  - SP amount in green (if the item uses SP)
  - Cash price in `$N.NN` format
- Tap an item name — verify it navigates to the **Listing Detail** screen for that item.
- Tap **"Hide items"** to collapse the list.
- Verify the list is hidden again.

**Step 3 — Verify no bundle banner on a non-bundle trade:**

1. Navigate back to **Trades → Active**.
2. Open a trade that is NOT part of a bundle (a Cash Only or Accept SP trade that was created individually, not through the cart).
3. Verify that the **green bundle banner is absent** from the top of the Trade Timeline screen.

**Step 4 — Verify the banner reflects the correct sibling count:**

1. Navigate back to the bundle trade from Step 1.
2. Open the second sibling trade from the same bundle (the other listing that was checked out together).
3. Verify this trade also shows **"Bundle offer · 2 items"** with the same expandable list — confirming both trades see each other as siblings.

---

#### Expected Result

| Scenario | Expected Outcome |
|---|---|
| Bundled trade (buyer view) | A green banner at the top: **"Bundle offer · N items"** with **"View all items"** toggle. Background `#EEF9F4`, text `#5DBB8E`, rounded corners. |
| Expandable item list | Tap "View all items" shows all N items with title, SP (if any), and price. Each item name is tap-able and navigates to `ListingDetail`. Tap "Hide items" collapses the list. |
| Non-bundle trade (buyer view) | No green bundle banner. The screen starts with the Status Banner. |
| Both bundle siblings | Each sibling trade shows the same banner and expandable list (e.g., both show "Bundle offer · 2 items"). |
| Seller view | The seller sees the same bundle banner and expandable item list on the Trade Timeline screen. |
| Cross-status visibility | The banner appears regardless of trade status: pending, in_progress, completed, or cancelled. |
| Non-bundle (seller view) | No bundle banner, consistent with buyer view. |

---

### passed TRD-TC-L02 · Confirm All shortcut for bundle (buyer)

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

### passed TRD-TC-L03 · Bundle offer rows in Offers tab (seller)

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

**Locator hints:**
- Received bundle card → `trade-bundle-<id>-card` · Review Each → `trade-bundle-<id>-review-each` · Accept All → `trade-bundle-<id>-accept-all` · Decline All → `trade-bundle-<id>-decline-all` · single received offer → `trade-offer-row-<id>` / `trade-offer-row-<id>-review`.

---

### passed TRD-TC-L04 · Non-bundle offers render as single rows

**Actors:** test-seller

**Objective:** Verify single offers are not grouped as bundles.

**Steps:**
1. In the **Offers** tab, find a single (non-bundle) offer.

**Expected Result:**
- It renders as a normal offer row with only the standard Review action — no bundle group buttons.

**Locator hints:**
- Single received offer row → `trade-offer-row-<id>` · Review Offer → `trade-offer-row-<id>-review`.

---

### passed TRD-TC-L05 · In-progress bundles section in Buying tab

**Actors:** test-buyer
**Precondition:** Buyer has 2 In Progress trades sharing the same bundle.

**Objective:** Verify In Progress bundles are grouped at the top of the Buying tab.

**Steps:**
1. Log in as **test-buyer** and open **Trades → Buying**.
2. Find the in-progress bundles section and tap **[View →]**.

**Expected Result:**
- An in-progress bundles section appears at the top showing the correct item count.
- [View →] opens the trade detail for the first trade in the bundle.

**Locator hints:**
- In-progress bundle card → `trade-bundle-<id>-view` · individual in-progress row → `trade-row-<id>` (+ `trade-row-<id>-view`).

---

### passed TRD-TC-L06 · Bundle banner in Review Offer screen

**Actors:** test-seller
**Precondition:** A trade in the Review Offer screen belongs to a bundle.

**Objective:** Verify the Review Offer screen shows bundle context with an expandable item list.

**Steps:**
1. Log in as **test-seller** and open the **Review Offer** screen for a bundled offer.
2. Tap the "Show all N items" toggle.

**Expected Result:**
- A bundle context banner is shown ("Bundle offer · N items").
- The toggle expands/collapses a list where each item shows its title and price.

**Locator hints:**
- Screen: `src/screens/trade/ReviewOfferScreen.tsx` (instrumented 2026-08-15).
- Bundle banner → `bundle-context-banner` · expand/collapse toggle → `review-bundle-toggle` · bundle item row → `review-bundle-item-<id>`.

---

### passed TRD-TC-L07 · Accept All N Items in Review Offer screen

**Actors:** test-seller
**Precondition:** The offer has 2+ bundle siblings.

**Objective:** Verify the seller can accept all bundle items from the Review Offer screen.

**Steps:**
1. Open the **Review Offer** screen for the first offer in a bundle.
2. Tap **[Accept All N Items]** and confirm.

**Expected Result:**
- An "Accept All N Items" button is visible.
- Confirming moves all bundle offers forward to payment processing, and the buyer's trade detail reflects the update.

**Locator hints:**
- Accept All N Items → `accept-bundle-button` · confirmation modal buttons → `btn-accept-all-confirm` / `btn-bundle-modal-cancel`.

---

### passed TRD-TC-L08 · Individual accept/decline works alongside bundle siblings

**Actors:** test-seller

**Objective:** Verify single accept/decline still works when bundle siblings exist.

**Steps:**
1. Open the **Review Offer** screen for a bundle offer.
2. Tap **[Accept Trade]** (single accept).

**Expected Result:**
- The single [Accept Trade] and [Decline] buttons are available alongside the bundle button.
- Accepting just this offer updates only this trade; the bundle siblings stay pending.

**Locator hints:**
- Accept Trade → `accept-trade-button` · Decline → `decline-trade-button` · Accept All N Items → `accept-bundle-button` · Back to Offers (expired state) → `back-to-offers-button`.

---

### passed TRD-TC-L09 · Bundle card in Your Offers (buyer)

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

**Locator hints:**
- Submitted bundle card → `trade-bundle-<id>-view` · View Details → `trade-bundle-<id>-view-details` · single submitted offer → `trade-offer-<id>-view` / `trade-offer-<id>-details`.

---

### passed TRD-TC-L10 · Bundle cancel prompt (buyer + seller)

**Ref:** TRADING-FLOW-V2 §11.3.1 (mirrors Addendum C "Confirm All" — FLOW-08-BUNDLE-CANCEL, 2026-08-01)
**Actors:** test-buyer + test-seller
**Precondition:** A bundle of 2+ trades sharing the same `bundle_id` exists (via cart checkout — see TRD-TC-L01 Option A).

**Objective:** Verify that cancelling one trade in a bundle prompts the user to cancel the whole bundle or just this one — mirroring the "Confirm All" shortcut for completion.

**Steps (Buyer cancels a pending bundle offer):**
1. Log in as **test-buyer** and submit a 2+ item bundle offer to test-seller via cart checkout (both trades `pending`).
2. Open one of the pending bundle trades from **Trades → Active → YOUR OFFERS**.
3. Tap **[Cancel Trade]**, pick a reason, and confirm.
4. Observe the bundle-scope prompt.

**Steps (Seller cancels an in_progress bundle trade):**
5. Log in as **test-seller**, accept the bundle so both trades are `in_progress`.
6. Open one of the bundle trades and tap **[Cancel Trade]** (in_progress), pick a reason, and confirm.
7. Observe the bundle-scope prompt.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Bundle member cancel (buyer, pending) | A modal appears: **"Cancel all 2 items?"** with **[Cancel All 2]** (red confirm) and **[Just This One]**. |
| Bundle member cancel (seller, in_progress) | Same modal appears: **"Cancel all 2 items?"** with **[Cancel All 2]** / **[Just This One]**. |
| **[Cancel All N]** | All bundle trades (current + cancellable siblings) cancel; buyer's reserved SP (if any) restored; success toast "Your trades have been cancelled." |
| **[Just This One]** | Only the current trade cancels; siblings stay `pending`/`in_progress`. |
| Non-bundle cancel | **No** bundle-scope prompt — normal single-trade cancel modal only. |
| Sibling in terminal state (completed/cancelled) | Excluded from the count (N reflects only cancellable trades). |
| Report a Problem on a bundle member | **No** bundle prompt — dispute stays per-trade (spec Key invariant §11.3.1). |

---

### passed TRD-TC-L11 · Bundle checkout skips items already in an active trade — buyer notified, flow continues

**Ref:** TRADING-FLOW-V2 §4.3 (duplicate active-offer check / D-30), §11.3.1 (bundle UX) — PARTIAL-SUCCESS (2026-08-01)
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** test-buyer already has an **active trade** (e.g. `in_progress`) on one of test-seller's listings. test-seller has at least 2 additional available listings. Cart feature flag is enabled.

**Objective:** Verify that when a buyer submits a bundle (cart) checkout that includes an item already in an active trade, the app submits offers for the eligible items only, shows the buyer a branded, non-blocking notice (with an OK button), and lets them continue to the success screen — it does NOT stop the flow and does NOT create a duplicate offer.

**Steps:**
1. Log in as **test-buyer** and ensure one of test-seller's items is already in an **active trade** (buyer already has an offer on it — `pending` or `in_progress`).
2. Add that in-progress item AND a second eligible item from test-seller to the cart.
3. Open the **Cart** screen and tap **[Checkout]** (bundle mode).
4. Review the order summary and tap **[Send Offer]** (accept any disclaimer as needed).
5. Observe the screen after submission.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Eligible item | Offer is submitted successfully (trade created, Stripe pre-auth hold placed). |
| In-progress item | **No duplicate offer** is created — the create-trade-offer Edge Function returns `DUPLICATE_OFFER` for that item and it is skipped server-side. |
| Buyer notice | A branded modal appears — title **"Already In an Active Trade"** (or **"Some Items Weren't Included"** for mixed reasons), message lists the skipped item(s) by name, ends with **"Your other offers were submitted successfully."** |
| OK button | The modal has a single green **OK** button (`#5DBB8E`) per the design system — no native `Alert.alert`. |
| Flow continues | Tapping **OK** navigates to the **TradeSuccess** screen for the successfully submitted offer(s). The buyer is NOT blocked. |
| Data | `trades` returned by `create-trade-offer` contain only the eligible item's trade id; `errors` contain the skipped item's id + `DUPLICATE_OFFER`. |
| Wallet/SP | SP reserved only for the eligible offer; no SP held for the skipped in-progress item. |
| Cart | Cart is cleared after checkout (existing behavior). |

**Negative / regression checks:**
- A bundle where ALL items are eligible shows **no** notice modal — straight to TradeSuccess.
- A single-item checkout that fails (e.g. duplicate) still shows the existing blocking error — no change.
- Repeating the same in-progress item in a fresh bundle still shows the notice each time.

---

## Group M — Cart (End User)

### passed TRD-TC-M01 · Add first item creates an active cart

**Actors:** test-buyer

**Objective:** Verify adding the first item from a seller creates an active cart.

**Steps:**
1. Log in as **test-buyer** and open an available item from **test-seller**.
2. Tap **Add to Cart**.
3. Open the **Cart** screen from the bottom nav.

**Expected Result:**
- A confirmation appears (e.g., a toast or the cart badge increments to 1).
- The Cart screen shows the seller name and the single item with its title, photo, and price.

### passed TRD-TC-M02 · Add second item from the same seller

**Actors:** test-buyer

**Precondition:** The cart already contains 1 item from test-seller (TRD-TC-M01).

**Objective:** Verify a second item from the same seller is added to the existing cart.

**Steps:**
1. Open a second available item from **test-seller**.
2. Tap **Add to Cart**.
3. Open the **Cart** screen.

**Expected Result:**
- No modal appears; the item is added directly.
- The Cart screen now lists 2 items under the same seller and the cart badge shows 2.

### passed TRD-TC-M03 · Add item from a different seller shows the choice modal

**Actors:** test-buyer

**Precondition:** The cart contains items from test-seller.

**Objective:** Verify adding an item from a different seller prompts a save/replace/cancel choice.

**Steps:**
1. Open an available item from **test-seller-2** (a different seller).
2. Tap **Add to Cart**.

**Expected Result:**
- A modal appears: "You have N items from [test-seller's name] in your cart. What would you like to do?"
- Three options are shown: **Save & Start New Cart**, **Replace Cart**, **Cancel**.
- Tapping **Save & Start New Cart** moves the current cart to saved carts and starts a new active cart containing the test-seller-2 item.
- Tapping **Cancel** closes the modal and leaves the original cart unchanged.

### passed TRD-TC-M04 · Replace Cart option

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

### passed TRD-TC-M05 · Cannot add your own item to cart

**Actors:** test-seller

**Objective:** Verify a user cannot add their own listing to the cart.

**Steps:**
1. Log in as **test-seller** and open one of your own active listings.
2. Look for the **Add to Cart** button.

**Expected Result:**
- The Add to Cart action is unavailable (hidden or disabled), or tapping it shows a message that you cannot add your own item.

### passed TRD-TC-M06 · Cannot add an unavailable or out-of-node item

**Actors:** test-buyer

**Objective:** Verify items that are sold/removed or outside the buyer's node cannot be added.

**Steps:**
1. Log in as **test-buyer** and open an item that has just been marked sold or is outside your node.
2. Tap **Add to Cart**.

**Expected Result:**
- A clear message explains the item is no longer available (sold/deleted) or not available in your area.
- The item is not added to the cart.

### passed TRD-TC-M07 · Duplicate item is prevented in the same cart

**Actors:** test-buyer

**Precondition:** The cart contains a specific item from test-seller.

**Objective:** Verify the same item cannot be added twice.

**Steps:**
1. Open the item that is already in the cart.
2. Tap **Add to Cart** again.

**Expected Result:**
- The item is not duplicated; the cart count is unchanged.
- The UI indicates the item is already in the cart (e.g., button reads "In Cart").

### passed TRD-TC-M08 · Remove an item from the cart

**Actors:** test-buyer

**Objective:** Verify removing an item updates the cart immediately.

**Steps:**
1. Open the **Cart** screen with 2 items.
2. Remove one item (swipe or tap remove).

**Expected Result:**
- The removed item disappears from the list and the cart badge decrements.
- The cart total updates to reflect the remaining item.

###  passed TRD-TC-M09 · Clear the cart

**Actors:** test-buyer

**Objective:** Verify clearing the cart empties it.

**Steps:**
1. Open the **Cart** screen with items.
2. Tap **Clear Cart** and confirm.

**Expected Result:**
- All items are removed and the screen shows an empty-cart state.
- The cart badge shows 0 or disappears.

### passed TRD-TC-M10 · Saved carts: max 3, server rejects 4th save, switch cart

**Actors:** test-buyer

**Objective:** Verify the saved-cart limit of 3, the server-side rejection of a 4th save, and switching between carts.

**Steps:**
1. Build and save carts from 4 different sellers in turn, using **Save & Start New Cart** each time.
2. Open the **Saved Carts** / **Switch Cart** view.
3. Tap **Switch Cart** on one of the saved carts.

**Expected Result:**
- At most 3 saved carts are kept; the 4th save is **rejected by the server** with a clear message
  ("You already have 3 saved carts. Delete one to save a new one."). There is **no silent LRU eviction** —
  this is deliberate, because silently dropping the oldest saved cart would lose a cart the user may still want.
- Tapping Switch Cart makes the chosen saved cart the active cart and moves the previously active cart into saved.

### deffered TRD-TC-M11 · Minimum cart value warning and blocked checkout

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

### passed TRD-TC-M12 · Max SP available shown per cart item (subscriber)

**Actors:** test-buyer (subscriber)

**Objective:** Verify the cart shows the maximum SP available per item for subscribers on SP-eligible items.

**Steps:**
1. Log in as **test-buyer** (Kids Club+).
2. Add an item whose seller accepts SP (payment preference is not Cash Only).
3. Open the **Cart** screen.

**Expected Result:**
- Each SP-eligible item shows an "Accepts Points · Up to N SP" indicator **for subscribers only**, where N is
  that item's category Swap Point spending cap for the item's price — the same cap the checkout screen uses,
  **not a fixed 50%** (the cap is admin-configurable per category, defaulting to 70%).
- Items from Cash Only sellers show no SP indicator.
- Unavailable items keep the plain "Accepts Points" badge (no numeric).
- The actual SP amount is chosen later on the checkout screen, not in the cart.

### passed TRD-TC-M13 · Realtime: item becomes unavailable while in cart

**Actors:** test-buyer, test-seller

**Objective:** Verify the cart reflects an item becoming unavailable in real time.

**Steps:**
1. As **test-buyer**, add an item to the cart and keep the **Cart** screen open.
2. As **test-seller** (on another device), mark that same item as sold or delete it.

**Expected Result:**
- Within ~1 second the cart shows an inline warning on that item: "This item is no longer available."
- The unavailable item is excluded from the cart total and from checkout.
- If left untouched, the unavailable item is auto-removed after 24 hours (QA may fast-forward to confirm).

### passed TRD-TC-M14 · Favorites add / remove

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

### passed TRD-TC-M15 · Favorites screen shows availability and empty state

**Actors:** test-buyer

**Objective:** Verify the Favorites screen shows availability status and a friendly empty state.

**Steps:**
1. Favorite an item, then have it marked sold (or favorite an already-sold item if available).
2. Open the **Favorites** screen.
3. Remove all favorites and view the screen again.

**Expected Result:**
- Unavailable favorited items show a "No Longer Available" overlay but remain visible.
- With no favorites, the screen shows an empty state: "No favorites yet" with guidance to tap the heart icon.

---


### passed TRD-TC-M16 · Success toast appears and auto-dismisses on add-to-cart

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

### passed TRD-TC-M17 · Cart badge increments in sync with toast

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

### passed TRD-TC-M18 · Toast copy uses "Trade Basket" terminology

**Actors:** test-buyer

**Objective:** Verify all success-toast copy uses "Trade Basket" language (matching TRD-TC-V07).

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

### passed TRD-TC-M19 · Home dashboard Favorites quick-action tile navigates to Favorites

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

### passed TRD-TC-M20 · Discover header heart icon navigates to Favorites

**Actors:** test-buyer (any logged-in user)

**Objective:** Verify the Discover screen header has a heart icon button that navigates to the Favorites screen.

**Steps:**
1. Log in as **test-buyer** and navigate to the **Discover** tab.
2. Locate the heart icon button in the controls row (between the filter/funnel button and the Sort dropdown).
3. Tap the heart icon.

**Expected Result:**
- A neutral-gray heart icon button is visible in the Discover header controls row (consistent with the header icon system) with accessibility label "View Favorites".
- Tapping it navigates to the Favorites screen showing the user's saved items.
- The heart icon does not toggle or change state — it is a navigation trigger only.

---

## Group N — Cart (Admin)

### deffered TRD-TC-N01 · Admin sets minimum cart value and it reflects in the app

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

### passed TRD-TC-N02 · Admin minimum cart value validation

**Actors:** Admin

**Objective:** Verify the admin portal validates the minimum cart value input.

**Steps:**
1. In the **admin portal** cart settings, enter a negative value (e.g., −5).
2. Attempt to save.

**Expected Result:**
- An inline validation error prevents saving negative values ("Minimum cart value cannot be negative").
- A valid value (≥ $0; **0 = no minimum**) saves successfully. There is **no hard $5 floor** — the admin may
  configure any non-negative minimum, and setting 0 disables the minimum entirely.

> Current limitation: `cart_max_saved_carts` and `cart_saved_expiry_days` can be edited in admin, but the runtime cart flow still hardcodes the 3-cart cap and has no verified configurable expiry consumption. Do not mark those two config-to-mobile paths covered until the implementation is wired end to end.

### passed TRD-TC-N03 · Admin updates Minimum Listing Price on Config → Fees tab (no deploy)

**Actors:** Admin

**Objective:** Verify the admin can change the "Minimum Listing Price" field on the Config page's Fees tab, with no deploy required, and the new value takes effect immediately for new listings.

**Steps:**
1. Log in to the **admin portal** and navigate to **Config**.
2. Select the **Fees** tab from the sidebar.
3. Locate the **Minimum Listing Price** setting.
4. Change the value from `0` to `5` and click **Save**.
5. Refresh the page and confirm the value persists as `5`.
6. Change it back to `0` and save to reset.

**Expected Result:**
- The **Minimum Listing Price** field is visible on the Fees tab with label "Minimum Listing Price" and a text input.
- Description reads: "Minimum price (in dollars) required for a listing to go live. Set to 0 to disable the floor."
- Saving shows a green success banner; the value persists after refresh.
- No code deploy, server restart, or app redeploy is needed — the change is immediate via the existing `secure_upsert_admin_config` RPC.

### passed TRD-TC-N04 · Seller cannot publish single-item listing priced below threshold

**Actors:** test-seller
**Precondition:** Admin has set `min_listing_price` to $5.00 (TRD-TC-N03 or direct SQL).

**Objective:** Verify a seller is blocked from creating a new single-item listing priced below the current threshold, with a clear trust-building modal and auto-scroll behavior.

**Steps:**
1. Log in as **test-seller** on the mobile app.
2. Navigate to **Create Listing** (single-item "New Item" screen).
3. Fill in all required fields (title, description, category, condition, photo).
4. Set the price to **$3.00** (below the $5.00 threshold).
5. Tap **Submit for Review**.

**Expected Result:**
- A styled modal appears with title: **"Let's Adjust Your Price"**
- Body reads: "To keep Pass It Up full of quality items buyers can trust, listings must be priced at $5.00 or more. Update your price to publish this listing."
- A single green button reads: **"Update Price"**
- The listing is NOT created — the form remains open.
- After tapping **"Update Price"**, the modal dismisses and the screen automatically scrolls to bring the price input into view, and the keyboard raises with the price field focused.
- After changing the price to $5.00 or above, the listing publishes successfully.

### passed TRD-TC-N09 · Price adjustment modal displays correct copy and button text (single-item)

**Actors:** test-seller

**Objective:** Verify the price adjustment modal in the single-item creation screen shows the updated title, body copy with the correct dynamic $ threshold, and the "Update Price" button.

**Steps:**
1. Log in as **test-seller** on the mobile app.
2. Navigate to **New Item** (single-item creation) or **Edit Listing** (edit screen).
3. Fill in all required fields.
4. Set the price below the admin-configured minimum (e.g., $3.00 if threshold is $5.00).
5. Tap **Submit for Review** (or **Save Changes** on edit screen).

**Expected Result:**
- A modal appears with title **"Let's Adjust Your Price"**.
- Body text reads: "To keep Pass It Up full of quality items buyers can trust, listings must be priced at $X.XX or more. Update your price to publish this listing." where `$X.XX` matches the admin-configured `min_listing_price`.
- The single button reads **"Update Price"** with the app's green brand color (#5DBB8E).
- No native `Alert.alert()` dialog appears — the styled modal replaces it.

### passed TRD-TC-N10 · "Update Price" dismisses modal and auto-scrolls + auto-focuses price field (single-item)

**Actors:** test-seller

**Objective:** Verify tapping "Update Price" dismisses the modal, scrolls the price field into view, and auto-focuses it with the keyboard raised.

**Precondition:** The price adjustment modal is visible (TRD-TC-N09 or directly triggered).

**Steps:**
1. With the "Let's Adjust Your Price" modal visible, tap **"Update Price"**.
2. Observe the screen after dismissal.

**Expected Result:**
- The modal dismisses smoothly.
- The `ScrollView` auto-scrolls to reveal the price input field (if scrolled away).
- The price input field receives focus and the keyboard is raised.
- The seller can immediately edit the price without manually scrolling or tapping the field.

### passed TRD-TC-N11 · Price adjustment modal in edit listing flow (single-item edit)

**Actors:** test-seller

**Objective:** Verify the edit listing screen shows the same updated modal and auto-scroll/focus behavior when saving a price below the threshold.

**Steps:**
1. Log in as **test-seller** and open an existing listing for editing.
2. Change the price to below the admin-configured minimum.
3. Tap **Save Changes**.

**Expected Result:**
- The same "Let's Adjust Your Price" modal appears with the same copy and "Update Price" button.
- Tapping "Update Price" auto-scrolls and auto-focuses the price field.
- The listing is NOT saved — the form remains open with edits intact.

### deffered TRD-TC-N12 · Bulk listing: per-item chip shows dynamic threshold in missing-required warning

**Actors:** test-seller

**Objective:** Verify the bulk listing creation flow shows the updated threshold-aware copy in the per-item status chip when an item's price is below the minimum.

**Steps:**
1. Log in as **test-seller** and start a **Bulk Listing** session.
2. Upload photos and group them into 2+ items.
3. Set Item A price to $3.00 (below the threshold) and complete other fields.
4. Set Item B price to $10.00 (above the threshold) and complete other fields.
5. Observe the status chip on each item card in the review step.

**Expected Result:**
- Item A's status chip reads: **"Missing: Price must be $X.XX+"** (where `$X.XX` matches the admin threshold).
- Item B's status chip reads: **"Ready"** (or other status if other fields are missing).
- No regressions to other missing-required chips (title, condition, etc.).

### passed TRD-TC-N13 · Bulk listing: publish failure shows clear error message for below-threshold items

**Actors:** test-seller

**Objective:** Verify the bulk publish result screen shows the improved error message for items that failed due to price below minimum.

**Steps:**
1. Create a bulk listing session with 3 items: one below threshold, two above.
2. Ensure the below-threshold item is included in publish.
3. Proceed to **Submit for Review** and confirm.

**Expected Result:**
- The publish results show the below-threshold item failed with the error: **"Price must be at least $X.XX to be listed"** (matching the admin threshold).
- The two above-threshold items published successfully (or show as pending).
- The bulk session is not entirely rejected — valid items still publish.

### defeered TRD-TC-N14 · Regression: minimum-price validation still blocks publish in single-item and bulk flows

**Actors:** test-seller

**Objective:** Verify the underlying validation logic is unchanged — items priced below the threshold cannot be published in any flow.

**Steps:**
1. In the **single-item flow**: try to publish a listing at $3.00 (below threshold). Verify the modal appears and the listing is NOT created.
2. In the **edit flow**: try to save an existing listing with the price changed to $3.00. Verify the modal appears and the listing is NOT saved.
3. In the **bulk flow**: ensure a below-threshold item shows the `price_below_minimum` chip and cannot be submitted (publish button is blocked or the item is excluded).

**Expected Result:**
- All three flows block publication of below-threshold prices.
- After raising the price above the threshold, all three flows allow publication.
- The threshold value is read from the admin config (dynamic, not hardcoded).

### defeered TRD-TC-N05 · Bulk listing: below-threshold items flagged, valid items still publish

**Actors:** test-seller
**Precondition:** Admin has set `min_listing_price` to $5.00. test-seller has photos ready for a bulk upload.

**Objective:** Verify that in a bulk batch with some items below the threshold:
- Below-threshold items are individually flagged and blocked
- Valid items in the same batch still publish successfully
- The entire batch is not rejected

**Steps:**
1. Log in as **test-seller** and start a **Bulk Listing** session.
2. Upload 3+ photos, group them into items.
3. Configure items:
   - Item A: price = $10.00 (above threshold)
   - Item B: price = $3.00 (below threshold)
   - Item C: price = $7.00 (above threshold)
4. Complete all other required fields for all items.
5. Proceed to the **Review** step and observe the item cards.
6. Tap **Submit for Review**.
7. Observe the publish confirmation sheet.

**Expected Result:**
- In the Review step, Item B's card shows: **"Missing: Price below minimum"** as a warning chip.
- The publish confirmation sheet lists Item B with **"Missing: Price below minimum"** status.
- Item B is **not** excluded from the confirmation sheet — it is listed with the warning.
- After confirming, Item A and Item C publish successfully (appear in My Listings as pending).
- Item B fails with error: `"Price must be at least $5.00 to be listed"` — it is NOT published.
- The publish result shows 2 published, 1 failed — the batch was not entirely rejected.

### deffered TRD-TC-N06 · Existing listing becomes non-purchasable if threshold is raised above its price

**Actors:** Admin, test-seller, test-buyer
**Precondition:** A listing exists at $4.00 (originally created when the threshold was $0). Admin will raise the threshold to $5.00.

**Objective:** Verify that when the admin raises the minimum listing price above an existing listing's price, that listing is automatically moved to a non-purchasable state.

**Steps:**
1. As **test-seller**, ensure you have an available listing priced at $4.00.
2. As **test-buyer**, verify the $4.00 listing is visible in Discover and has purchase actions (Add to Cart / Request to Buy).
3. As **Admin**, go to **Config → Fees**, change **Minimum Listing Price** from `0` to `5`, and save.
4. As **test-buyer**, refresh Discover and search for the $4.00 listing.
5. As **test-seller**, open **My Listings** and find the $4.00 listing.

**Expected Result:**
- After the admin saves the new $5.00 threshold, the RPC auto-pauses the $4.00 listing.
- The buyer can no longer find the $4.00 listing in Discover (it is hidden).
- The seller sees the listing in My Listings with status **"Paused"** (or equivalent non-available indicator).
- The listing is NOT deleted — it still exists in the seller's inventory.
- Other listings priced at $5.00+ remain available and purchasable.

### deffered TRD-TC-N07 · Existing listing regains purchasability after seller raises price to meet threshold

**Actors:** test-seller, test-buyer
**Precondition:** A listing was auto-paused at $4.00 because the threshold was raised to $5.00 (TRD-TC-N06).

**Objective:** Verify the seller can edit the paused listing, raise its price to meet the threshold, and restore purchasability.

**Steps:**
1. As **test-seller**, open the paused $4.00 listing from **My Listings**.
2. Tap **Edit Listing**.
3. Change the price from $4.00 to $6.00.
4. Save the changes.
5. As **test-buyer**, verify the listing now appears in Discover with purchase actions.

**Expected Result:**
- The seller can edit the paused listing without any blocker.
- Saving at $6.00 succeeds (no "Price Below Minimum" error since $6.00 ≥ $5.00).
- The listing status changes back to **Available** (or **Pending** if it goes through moderation again).
- The buyer can now see and purchase the listing.

### deffered TRD-TC-N08 · Regression: Single-item and bundle checkout work correctly at/above threshold

**Actors:** test-buyer (subscriber), test-seller
**Precondition:** Admin has set `min_listing_price` to $5.00. test-seller has listings priced at $10.00 and $15.00.

**Objective:** Verify no regression to single-item or bundle checkout flows for listings priced at or above the threshold.

**Steps:**
1. As **test-buyer**, open a $10.00 listing and tap **Request to Buy** → complete a single-item purchase.
2. Add two $10.00 items from test-seller to cart, then checkout as a bundle.
3. Verify both flows complete normally.

**Expected Result:**
- Single-item checkout: offer submits, seller accepts, buyer confirms → trade completes normally.
- Bundle checkout: cart shows both items, checkout creates bundle trades, all proceed normally.
- No "Price Below Minimum" errors appear since all prices ≥ $5.00.
- All purchase actions (Add to Cart, Request to Buy, Use SP) are available.

---

## Group O — Tax (End User Mobile App)

**Focus:** Buyer-facing tax display, calculation correctness, SP interaction, refund visibility

> **⚠️ Precedence (2026-08-30, QA Task 11 doc fix):** Category tax **RULES override node rates**. `calculate_tax` resolves the applicable rate via `get_applicable_tax_rule(<category>, NOW(), <price>)`; when an active taxable rule matches, the RULE's rate wins (`COALESCE(rule.tax_rate, node_rate)`), and the node rate is used **only** when no category rule matches (or no `tax_category_id` is supplied). Live staging rate for `general_tangible_goods` is **6.99%** (active rule v3) — so a $30 item shows **$2.10** tax (`FLOOR(3000 * 0.0699 + 0.5) = 210`), **NOT** the legacy 6.35%/$1.91 figures below. Consequence: **node-rate edits (TRD-TC-P01/P08) do NOT propagate to new offers when a category rule exists** — to change the effective rate, edit the category tax RULE, not the node rate.

### passed TRD-TC-O01 · Sales tax shown in checkout/cart breakdown (0 SP)

**Precondition:** Item's tax category (`general_tangible_goods`) has an ACTIVE tax rule at **6.99%** (live staging rate; overrides the node rate per the precedence note above), global tax enabled, item is $30.

**Steps:**
1. As **test-buyer**, open an item → tap **Request to Buy** (single-item flow).
2. Observe the price breakdown on TradeInitiationScreen.
3. Repeat via **Cart Checkout** flow (add item to cart → tap Checkout).

**Expected:**
- **TradeInitiationScreen:** Shows Item Price → Subtotal → **Sales Tax** (calculated amount) → Platform Fee → Total.
- **CartCheckoutScreen:** Shows Subtotal → SP Discount (if any) → Platform Fee → **Sales Tax** → Total.
- Tax amount = `FLOOR((3000 * 0.0699) + 0.5) = 210 cents = $2.10` (live category-rule rate 6.99%).
- Label reads **"Sales Tax"** (kid-friendly, not jurisdiction name).
- Total includes the tax.

---

### passed TRD-TC-O02 · Tax base unchanged (full item price) as SP entry changes (offer + checkout)

**Precondition:** test-buyer (subscriber) with ≥ 15 SP, item is $30 Accept SP, `include_fee_in_tax_base = false`.

**Steps:**
1. Open the $30 item → tap **[Request to Buy]** → enter **15 SP** in the offer screen's SP field (max 50%).
2. Watch the breakdown update in real time.
3. Repeat on TradeOfferScreen.

**Expected:**
- Tax recalculates within ~300ms as the SP entry changes.
- **Tax base = full $30 item price** (NOT reduced by SP — BP-37).
- Tax amount stays at **$2.10** (calculated on $30 at the 6.99% category-rule rate, not on $15 cash).
- Platform fee ($1.49) is still charged in cash.
- Recalculation applies on both TradeInitiationScreen and TradeOfferScreen.

**⚠️ Known Issue:** Tax should NOT recalculate when SP changes (BP-37). If test shows tax recalculating, this is a bug.

---

### passed ✅ TRD-TC-O03 · Tax is $0 when sales tax is disabled globally

**Steps:**
1. As **test-admin**, navigate to Tax → Settings and uncheck **"Enable sales tax collection"**.
2. As **test-buyer**, start checkout on any item.

**Expected:**
- Sales Tax line shows $0.00 (or is hidden).
- Total = item price + platform fee only.
- Stripe authorization = cash + fee (no tax).

---

### passed ✅ TRD-TC-O04 · Tax is $0 when the node tax rate is disabled

**Steps:**
1. As **test-admin**, navigate to Tax → Nodes and set test-buyer's node rate to 0%.
2. As **test-buyer**, start checkout.

**Expected:**
- Sales Tax = $0.00 for items in that node.
- Items in other nodes with non-zero rates still collect tax normally.

---

### passed TRD-TC-O05 · Tax-exempt item shows Tax Free badge

**Ref:** MODULE-15.3-PART3 TAX-011 (`Prompts/MODULE-15.3-sales-tax-engine.md`), `docx/design-system-passitup.md`
**Actors:** test-seller (creates a tax-exempt listing) + test-buyer
**Status:** Implemented 2026-08-01 — badge renders on the Item Detail Price Breakdown and all checkout surfaces (offer initiation, offer, cart checkout, trade detail/timeline).

**Precondition:**
- Global sales tax is **ENABLED** (`sales_tax_enabled = true`) and the item's tax category has a **non-zero** active rule (6.99% in staging) — so this test proves the badge comes from item exemption, NOT from tax being disabled or a zero rate.
- The **Books** product category maps to the **Tax Exempt Goods** tax category (default from `20260727000001_category_tax_mapping.sql`). Verify:
  ```sql
  SELECT c.name AS category, tc.key AS tax_category_key
  FROM public.category_tax_mapping ctm
  JOIN public.categories c      ON c.id = ctm.category_id
  JOIN public.tax_categories tc ON tc.id = ctm.tax_category_id
  WHERE c.name = 'Books';
  -- Expected: category = 'Books', tax_category_key = 'tax_exempt_goods'
  ```
- test-seller has no existing active **Books** listing (a new one will auto-assign `tax_exempt_goods` via the `trg_set_default_tax_category` trigger).

**Objective:** Verify a buyer sees a green **"Tax Free"** badge with **$0.00** when purchasing a tax-exempt item, and does **NOT** see it for taxable items or when tax is merely $0 from global/node config (TRD-TC-O03/TRD-TC-O04).

**Steps:**
1. As **test-seller**, create a new single-item listing under the **Books** category priced ≥ the admin minimum (e.g., $10.00), complete all required fields, and **Submit for Review**. Confirm it publishes.
2. As **test-buyer**, open the item's **Item Detail** screen and scroll to the **💰 Price Breakdown** card.
3. Observe the Sales Tax area (between Transaction Fee and Total).
4. Tap **Request to Buy** → on the offer initiation screen, observe the tax area.
5. If the item accepts SP and the buyer is a subscriber, advance to the offer screen (SP entry field) and observe the value stack's tax row.
6. Add a **second, non-exempt** listing (e.g., a Toys or Electronics item → General Tangible Goods) at a similar price and repeat steps 2–5.
7. (Negative check) Have **test-admin** disable global tax (per TRD-TC-O03) or zero the buyer's node rate (per TRD-TC-O04), then open checkout on a taxable item.

**Expected Result:**
| Scenario | Expected Outcome |
|---|---|
| Exempt item (Books) — Item Detail | A green pill badge reads **"Tax Free"** (text `#5DBB8E` on `#E8F5F0`, pill shape) with **$0.00** where the Sales Tax row would be. |
| Exempt item (Books) — offer initiation / offer screen | Same **"Tax Free"** badge + **$0.00**; Total = item price + platform fee only (no tax). |
| Exempt item (Books) — SP used (subscriber) | Badge stays; SP reduces cash, but the taxable base is still not taxed (**$0.00**). |
| Exempt item (Books) — completed trade | Trade Timeline "Payment Details" shows the **"Tax Free"** badge instead of a tax row. |
| Non-exempt item | **No** badge — a normal **"Sales Tax"** row shows the calculated amount (e.g., $2.10 on $30 @ 6.99% live category-rule rate). |
| Tax $0 because global tax disabled (TRD-TC-O03) | **No** "Tax Free" badge — the tax row is hidden (badge is reserved for item exemption). |
| Tax $0 because node rate is 0 (TRD-TC-O04) | **No** "Tax Free" badge — same as above. |

**Verification queries (optional):**
```sql
-- Confirm the new Books listing's tax category is exempt
SELECT i.title, tc.key AS tax_category_key
FROM public.items i
LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
WHERE i.seller_id = '<seller-uuid>'
ORDER BY i.created_at DESC LIMIT 1;
-- Expected: tax_category_key = 'tax_exempt_goods'

-- Confirm the exempt trade carried zero tax
SELECT t.status, tr.tax_status, tr.tax_amount_cents, tr.taxable_amount_cents
FROM public.trades t
LEFT JOIN public.tax_records tr ON tr.trade_id = t.id
WHERE t.buyer_id = '<buyer-uuid>'
ORDER BY t.created_at DESC LIMIT 1;
-- Expected: tax_amount_cents = 0, tax_status = 'quoted' (or 'voided' if cancelled)
```

---

### passed ✅ TRD-TC-O06 · Transaction history shows tax details

**Steps:**
1. Complete a taxable purchase as **test-buyer**.
2. Navigate to **Trades → History** → select the completed trade.
3. Scroll to **Payment Details** card.

**Expected:**
- Payment Details shows: Cash Paid, SP Used (if any), Platform Fee, **Sales Tax**, Total.
- Tax amount matches the value stored at offer time (from `tax_records.tax_amount_cents`).
- Tax rate and jurisdiction are NOT shown (simplified for buyers).

---

### ✅ TRD-TC-O07 · Refund shows proportional tax refunded — end-user refund-detail view built (Dev Task 75)

**Status (2026-08-31):** the end-user **refund-detail view is now BUILT on the Trade Timeline screen** (buyer/seller of the trade). The backend proportional-tax-refund logic was already correct and DB-verified (QA Task 14 — `trade_refunds.refund_tax_cents` tracks the tax component separately from price/fee); the UI was the missing piece.

**Ref:** Trade Timeline screen (Payment Details area); `rpc_get_trade_refunds` (SECURITY DEFINER, party-scoped read path for the service-role-only `trade_refunds` table); `trade_refunds` (per-refund price/fee/tax split, migration 317).

**Trigger condition:** the trade has at least one `trade_refunds` row with `status IN ('succeeded','pending')` (dispute-resolve-refund, seller-cancel refund, admin force-cancel, partial refund). Rendered role-appropriately:
- **Buyer** — a full refund card: status ("Your refund has been issued." / "Your refund is being processed."), **Refund Amount** (sum of succeeded/pending refunds), **Refunded Sales Tax** (tax portion), **Refunded to** (payment method — trade's `stripe_payment_method_brand`/`last4`, fallback "Your original payment method"), **Refunded on** (most recent refund date).
- **Seller** — a status note only (no money breakdown — it's the buyer's money): "This trade was cancelled and the buyer was refunded. No payout was issued for this sale."

**Verify:**
- Partial refund (50%) → refunded sales tax = 50% of original tax; the buyer's refund card shows the accumulated partial amount and tax portion.
- Full refund → refund card shows the full refund amount with 100% of original tax as the tax portion.
- Multiple partial refunds accumulate correctly (the card totals all succeeded/pending rows), never exceeding original tax (DB-enforced via `rpc_record_payment_refund`'s per-component remaining checks).
- Buyer sees the card on the Trade Timeline; seller sees only the status note (no breakdown).
- The card uses the same money-breakdown formatting convention as Review Offer's "Net Cash Payout" (label/value rows + total), consistent across the app.

> **Deploy note:** the UI degrades gracefully if `rpc_get_trade_refunds` is not yet deployed (the section simply doesn't render) — apply migration `20260831235900_dev_task_75_trade_refunds_read.sql` to staging to activate.

---

### passed ✅ TRD-TC-O08 · Tax shown on trade timeline/detail for buyer only

**Precondition:** Completed trade with captured tax.

**Steps:**
1. As **test-buyer**, open a completed trade → scroll to **Payment Details**.
2. As **test-seller**, open the same trade → scroll to **Payment Details**.

**Expected:**
- **Buyer view:** Shows Cash Paid, SP Used, Platform Fee, **Sales Tax** (with amount), Total.
- **Seller view:** Shows Cash Received, Platform Fee, SP Earned → **NO Sales Tax line**.
- Seller does NOT see tax (it's a buyer-side cost, not part of seller's payout calculation).

---

## Group O-1 — Tax by Catalog Category (Admin Configuration)

**Focus:** Admin tax rules management, category mappings, price thresholds, versioning

### passed ✅ TRD-TC-O1-C01 · Admin creates a new tax rule for general_tangible_goods

**Steps:**
1. Admin portal → **Tax → Tax Rules** → tap **+ New Tax Rule**.
2. Select **General Tangible Goods** as Tax Category.
3. Enter Display Name: **"Standard CT Tangible Goods Rate"**.
4. Description: *"Default taxable rate for physical goods in Connecticut."*
5. Leave **Items in this category are taxable** checked.
6. Tax Rate: **6.35%**, Jurisdiction: **CT**.
7. Leave Min/Max price blank, Effective From = today, Effective To = blank (ongoing).
8. Tap **Create Rule**.

**Expected:**
- Success message: "Rule created successfully."
- Rule appears in table with version **v1**, Active status, 6.35% rate, CT jurisdiction.
- `admin_audit_logs` has a `tax_rule_created` entry.

---

### ✅ TRD-TC-O1-C02 · Admin creates second rule for same category — overlap blocked

**Precondition:** Active ongoing rule exists for general_tangible_goods, CT (TRD-TC-O1-C01).

**Steps:**
1. Tap **+ New Tax Rule** → select General Tangible Goods, CT.
2. Effective From = today, Effective To = blank.
3. Tap **Create Rule**.

**Expected:**
- Save fails with error: **"Overlapping active tax rule exists for category..."**
- No duplicate rule created.
- Original rule unchanged.

---

### ✅ TRD-TC-O1-C03 · Admin edits existing rule — new version created

**Precondition:** Active rule exists (TRD-TC-O1-C01).

**Steps:**
1. Locate the rule → tap **Edit**.
2. Change Display Name to **"Updated CT Tangible Goods Rate (v2)"**.
3. Change Tax Rate to **6.99%**, Effective From = tomorrow.
4. Tap **Create New Version**.

**Expected:**
- Success: "Rule updated — new version 2 created."
- Original (v1) shows **Inactive**, Effective To = end of today.
- New (v2) shows **Active**, rate 6.99%, effective from tomorrow.
- Version History shows both v1 (Inactive) and v2 (Active).
- `admin_audit_logs` has a `tax_rule_updated` entry with before/after values.

---

### ✅ TRD-TC-O1-C04 · Admin deactivates a rule

**Steps:**
1. Locate an active rule → tap **Deactivate**.
2. Confirm in modal.

**Expected:**
- Confirmation modal warns: "This will set the rule as inactive and close its effective period. Historical trades that used this rule retain their recorded tax calculation."
- Rule shows **Inactive** status, Effective To set to deactivation time.
- Rule no longer appears in active-rule lookups.

---

### ✅ TRD-TC-O1-C05 · Existing listings backfill to general_tangible_goods

**Verification Query:**
```sql
-- Should return 0
SELECT COUNT(*) AS items_without_tax_category 
FROM public.items 
WHERE tax_category_id IS NULL;

-- Sample check — all should show general_tangible_goods
SELECT i.id, i.title, tc.key AS tax_category_key
FROM public.items i
LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
LIMIT 10;
```

**Expected:**
- Zero items have NULL `tax_category_id`.
- All items default to `general_tangible_goods`.
- No regressions in discovery or purchase flows.

---

### ✅ TRD-TC-O1-C06 · New single-listing creation receives default tax category

**Steps:**
1. As **test-seller**, create a new single listing.
2. Verify via SQL:
   ```sql
   SELECT i.title, tc.key, tc.name
   FROM public.items i
   LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
   WHERE i.id = '<new-listing-uuid>';
   ```

**Expected:**
- Query returns `tax_category_key = 'general_tangible_goods'`.
- Listing is discoverable and purchasable.

---

### ✅ TRD-TC-O1-C07 · New bulk-listing creation receives default tax category

**Steps:**
1. Create a bulk listing with 2+ items.
2. Verify via SQL:
   ```sql
   SELECT i.title, tc.key, tc.name
   FROM public.items i
   LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
   WHERE i.seller_id = '<seller-uuid>'
   ORDER BY i.created_at DESC
   LIMIT 5;
   ```

**Expected:**
- All bulk items have `tax_category_key = 'general_tangible_goods'`.
- All items appear in My Listings and are purchasable.

---

### ✅ TRD-TC-O1-C08 · Admin changes individual listing's tax category

**Steps:**
1. Admin portal → navigate to an item's detail page.
2. Scroll to **Tax Category** field → tap **Change tax category**.
3. Select **Clothing and Footwear (clothing_footwear)** → tap **Save**.
4. Verify via SQL:
   ```sql
   SELECT i.title, tc.key AS tax_category_key
   FROM public.items i
   LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
   WHERE i.id = '<item-uuid>';
   ```

**Expected:**
- Success message: "Tax category updated."
- Tax Category field shows new category name.
- Query confirms `tax_category_key = 'clothing_footwear'`.
- `admin_audit_logs` has `item_tax_category_changed` entry.

---

### ✅ TRD-TC-O1-C09 · Tax-exempt category configuration

**Steps:**
1. Navigate to **Tax → Tax Rules** → verify **Tax Exempt Goods** in category list.
2. Create a rule for Tax Exempt Goods with **Items in this category are taxable** unchecked.
3. Verify via SQL:
   ```sql
   SELECT is_taxable FROM public.get_applicable_tax_rule(
     (SELECT id FROM public.tax_categories WHERE key = 'tax_exempt_goods' LIMIT 1),
     NOW()
   );
   ```

**Expected:**
- `tax_exempt_goods` category is pre-seeded.
- Rule can be created with `is_taxable = false`.
- `get_applicable_tax_rule` returns `is_taxable = false`.

---

### ✅ TRD-TC-O1-C10 · Price-threshold category configuration (clothing_footwear)

**Steps:**
1. Tax Rules page → create rule for **Clothing and Footwear**.
2. Display Name: **"CT Clothing — Under $50 threshold"**.
3. Tax Rate: 6.35%, Min Price: $0.00, Max Price: $50.00.
4. Save and verify in table.

**Expected:**
- Rule saves successfully.
- Table shows price range: `$0.00 – $50.00`.
- Version History shows rule with price thresholds.
- Overlap trigger does NOT block (different category from general_tangible_goods).

---

### ✅ TRD-TC-O1-C11 · Fee-in-tax-base toggle on and off

**Steps:**
1. Navigate to **Tax → Tax Settings**.
2. Check **Include marketplace transaction fee in sales-tax base** → tap **Save**.
3. Refresh and verify checkbox is still checked.
4. Verify via SQL:
   ```sql
   SELECT key, value FROM public.admin_config WHERE key = 'include_fee_in_tax_base';
   SELECT public.get_include_fee_in_tax_base();
   ```
5. Uncheck, save, and verify it persists as `false`.

**Expected:**
- Toggle visible with label and help text.
- Saving with box checked: `admin_config.value = 'true'`, RPC returns `true`.
- After unchecking: `value = 'false'`, RPC returns `false`.
- No immediate change to checkout totals (future prompt).

---

### ⏭️ TRD-TC-O1-C12 · Unauthorized user cannot view or edit tax configuration

**Status:** Deferred to post-MVP (admin role enforcement via RLS).

---

### ✅ TRD-TC-O1-C13 · Audit trail shows actor, timestamp, before/after values

**Verification Query:**
```sql
SELECT actor_id, action_type, entity_type, entity_id, payload, created_at
FROM public.admin_audit_logs
WHERE entity_type = 'tax_rule'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:**
- Each operation (create, edit, deactivate) has its own audit row.
- `action_type`: `tax_rule_created`, `tax_rule_updated`, `tax_rule_deactivated`.
- `actor_id` matches authenticated admin user.
- `payload` contains before/after values for edits.

---

### ⚠️ TRD-TC-O1-C14 · Admin views and edits category→tax-category mapping

**Steps:**
1. Admin portal → **Tax → Category Mapping**.
2. Verify table shows all 8 product categories with current mappings.
3. For **Books** row, tap **Change** → select **General Tangible Goods** → **Save**.
4. Change Books back to **Tax Exempt Goods** → **Save**.

**Expected:**
- Page loads with all 8 categories:
  - Books → Tax Exempt Goods (default)
  - Clothing → Clothing and Footwear
  - All others → General Tangible Goods
- Changing Books to General Tangible Goods saves successfully.
- Changing back also saves successfully.
- `admin_audit_logs` has `category_tax_mapping_changed` entries.

---

### ⚠️ TRD-TC-O1-C15 · Category mapping change affects new listings immediately

**Steps:**
1. As **test-admin**, verify Books is mapped to **Tax Exempt Goods**.
2. As **test-seller**, create a new listing under **Books** category.
3. Verify via SQL that it has `tax_category_key = 'tax_exempt_goods'`.
4. As **test-admin**, change Books mapping to **General Tangible Goods**.
5. As **test-seller**, create a *second* new listing under **Books**.
6. Verify second listing has `tax_category_key = 'general_tangible_goods'`.
7. Verify first listing's category is unchanged (not retroactively updated).

**Expected:**
- First listing: `tax_exempt_goods`.
- After admin change, second listing: `general_tangible_goods`.
- First listing unchanged.
- No deploy needed — change is immediate.

---

### ⚠️ TRD-TC-O1-C16 · Admin cannot map to non-existent or inactive tax category

**Steps:**
1. Open **Tax → Category Mapping** → tap **Change** on any row.
2. Attempt to save with empty dropdown.
3. Attempt to supply fabricated UUID via console:
   ```javascript
   const { data } = await supabase.rpc('upsert_category_tax_mapping', {
     p_category_id: '<any-valid-category-uuid>',
     p_tax_category_id: '00000000-0000-0000-0000-000000000000'
   });
   ```

**Expected:**
- Empty dropdown: Save button disabled or shows validation error.
- Direct RPC call with non-existent UUID returns: `{"success": false, "error": {"code": "NOT_FOUND", "message": "Tax category not found or inactive"}}`.
- Mapping unchanged.

---


### ✅ TRD-TC-O1-C17 · Admin filters tax rules by active / inactive status

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

**Tax Status Values:**
- `quoted`: Offer submitted, Stripe auth hold exists, no money moved
- `collected`: Stripe capture succeeded, tax is payable
- `voided`: Auth canceled/declined/expired before capture
- `capture_failed`: Capture attempt failed
- `refunded`: Full captured tax refunded
- `partially_refunded`: Partial refund processed

**Tax Status Lifecycle Diagram:**
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
        (Stripe refund)
```

---

### ✅ TRD-TC-O2-C01 · Single taxable item, no SP — offer is quoted/authorized, not collected

**Precondition:** Item's tax category (`general_tangible_goods`) has an ACTIVE rule (6.99% in staging — overrides node rate), buyer has saved payment method.

**Steps:**
1. As **test-buyer**, submit an offer on a $30 item with SP = 0.
2. Verify via SQL:
   ```sql
   SELECT tr.id, tr.tax_status, tr.tax_amount_cents, tr.taxable_amount_cents,
          tr.captured_at IS NOT NULL AS is_captured
   FROM public.tax_records tr
   JOIN public.trades t ON t.id = tr.trade_id
   WHERE t.buyer_id = '<buyer-uuid>' AND t.status = 'pending'
   ORDER BY tr.created_at DESC LIMIT 1;
   ```
3. Check Stripe Dashboard for PI status.

**Expected:**
- `tax_status` = `'quoted'`
- `captured_at` IS NULL
- `tax_snapshot` contains item-level category, rule, price, rate
- Stripe Dashboard: PI in `requires_capture` status (authorization hold only).

---

### ⚠️ TRD-TC-O2-C02 · Bundle with taxable, exempt, and threshold items — line-level tax correct

**Precondition:** Seller has 3 items:
- Item A = `general_tangible_goods` (taxable)
- Item B = `tax_exempt_goods` (not taxable)
- Item C = `clothing_footwear` with price-threshold rule (under $50 min)

**Steps:**
1. Add all 3 items to cart and checkout as a bundle.
2. Verify via SQL:
   ```sql
   SELECT tr.trade_id, tr.tax_status, tr.tax_amount_cents, tr.taxable_amount_cents,
          tr.tax_snapshot
   FROM public.tax_records tr
   ORDER BY tr.created_at DESC LIMIT 3;
   ```

**Expected:**
- All trades have `tax_status = 'quoted'`.
- Item B: `tax_amount_cents = 0`, `is_taxable = false`.
- Item C: threshold rule applied correctly.
- Item A: standard rate applied.
- Stripe authorization = sum of cash + fees + tax (for taxable items only).

---

### ⚠️ TRD-TC-O2-C03 · Platform-fee tax toggle off and on — tax base changes by fee amount

**Steps:**
1. As **test-admin**, verify `include_fee_in_tax_base` is `false`.
2. As **test-buyer**, submit offer on $30 item with no SP.
3. Note `taxable_amount_cents` and `tax_amount_cents`.
4. As **test-admin**, set `include_fee_in_tax_base` to `true`.
5. As **test-buyer**, submit second offer on different $30 item with no SP.
6. Compare the two tax records.

**Expected:**
- First offer (fee NOT in base): `taxable_amount_cents = 3000`, `tax_amount_cents = 191`.
- Second offer (fee IN base): `taxable_amount_cents = 3149`, `tax_amount_cents = 200`.
- Difference = 9 cents (attributable to $1.49 fee).
- First offer's snapshot unchanged (not retroactive).

---

### ✅ TRD-TC-O2-C04 · SP used — taxable base unchanged, card auth reflects SP tender

**Precondition:** Item is $30 Accept SP, buyer has ≥ 15 SP.

**Steps:**
1. Open $30 item → apply 15 SP (max 50%).
2. Submit offer.
3. Verify via SQL:
   ```sql
   SELECT tr.tax_status, tr.taxable_amount_cents, tr.tax_amount_cents,
          tr.tax_snapshot->'items'->0->>'item_price_cents' AS item_price,
          t.cash_amount_cents, t.sp_amount
   FROM public.tax_records tr
   JOIN public.trades t ON t.id = tr.trade_id
   ORDER BY tr.created_at DESC LIMIT 1;
   ```

**Expected:**
- `taxable_amount_cents` = 3000 (FULL item price, NOT 1500) — **BP-37**.
- `tax_amount_cents` = calculated on 3000.
- `cash_amount_cents` = 1500 + fee (SP reduced cash, not taxable base).
- Stripe PI authorization = `1500 + fee + tax`.

---

### ✅ TRD-TC-O2-C05 · Seller accepts — tax remains quoted/authorized, not collected

**Precondition:** A `quoted` offer exists.

**Steps:**
1. As **test-seller**, accept the pending offer.
2. Verify via SQL:
   ```sql
   SELECT t.status, tr.tax_status, tr.captured_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<trade-uuid>';
   ```
3. Check Stripe Dashboard.

**Expected:**
- `trades.status` = `'in_progress'`.
- `tax_status` = `'quoted'` (unchanged).
- `captured_at` IS NULL.
- Stripe PI still in `requires_capture`.

---

### ✅ TRD-TC-O2-C06 · Buyer cancels while Awaiting Seller — PI canceled, tax voided, SP released once

**Precondition:** A `pending` quoted offer exists (used SP).

**Steps:**
1. As **test-buyer**, tap **Cancel Trade** → select reason → confirm.
2. Verify via SQL:
   ```sql
   SELECT t.status, tr.tax_status, tr.voided_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<trade-uuid>';
   
   -- Check SP wallet
   SELECT available_balance, reserved_sp 
   FROM public.sp_wallets
   WHERE user_id = '<buyer-uuid>';
   
   -- Check for duplicate SP refund
   SELECT transaction_type, amount 
   FROM public.sp_ledger
   WHERE user_id = '<buyer-uuid>' 
     AND related_transaction_id = '<trade-uuid>'
     AND transaction_type = 'earn_refund';
   ```

**Expected:**
- `trades.status` = `'cancelled'`.
- `tax_status` = `'voided'`, `voided_at` IS NOT NULL.
- Stripe PI canceled.
- SP restored to available exactly once (no duplicate `earn_refund` entry).

---

### ✅ TRD-TC-O2-C07 · Seller declines and offer expiry — PI canceled, tax voided

**Steps:**
1. **Decline path:** As **test-seller**, decline a pending offer. Verify tax voided.
2. **Expiry path:** Fast-forward a different offer past `offer_expires_at`, run expiry cron:
   ```sql
   UPDATE trades SET offer_expires_at = NOW() + INTERVAL '5 seconds'
   WHERE id = '<expiring-trade-uuid>' AND status = 'pending';
   SELECT public.rpc_process_expired_offers(100);
   ```
3. Verify both trades have `tax_status = 'voided'`.

**Expected (both paths):**
- `trades.status` = `'cancelled'`.
- `tax_status` = `'voided'`, `voided_at` IS NOT NULL.
- Stripe PI canceled.
- SP released exactly once.

---

### ✅ TRD-TC-O2-C08 · Buyer completes successfully — capture succeeds, tax collected

**Precondition:** In Progress trade with `tax_status = 'quoted'`, uncaptured PI.

**Steps:**
1. As **test-buyer**, tap **[I Got It]** → **[Confirm]**.
2. Verify via SQL:
   ```sql
   SELECT t.status, tr.tax_status, tr.captured_at, tr.stripe_capture_id
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<trade-uuid>';
   ```
3. Check Stripe Dashboard.

**Expected:**
- `trades.status` = `'completed'`.
- `tax_status` = `'collected'`.
- `captured_at` IS NOT NULL, `stripe_capture_id` matches Stripe Charge ID.
- Stripe Dashboard: PI status `succeeded`, charge captured.
- Seller SP wallet: `pending_balance` increased.
- Seller payout: processing/pending.

---

### ✅ TRD-TC-O2-C09 · Auto-complete after 72 hours — capture succeeds, tax collected

**Precondition:** In Progress trade with `auto_complete_at` set.

**Steps:**
1. Fast-forward `auto_complete_at`:
   ```sql
   UPDATE trades SET auto_complete_at = NOW() + INTERVAL '5 seconds'
   WHERE id = '<trade-uuid>' AND status = 'in_progress';
   ```
2. Run auto-complete processor:
   ```sql
   SELECT public.rpc_process_auto_complete(100);
   ```
3. Verify as in TRD-TC-O2-C08.

**Expected:**
- Same as TRD-TC-O2-C08 (capture succeeds, tax collected, seller paid).
- Buyer receives auto-complete notification.

---

### ⚠️ TRD-TC-O2-C10 · Capture failure — no payout, no collected tax, recovery state visible

**Precondition:** In Progress trade, uncaptured PI.

**Steps:**
1. Before buyer taps [I Got It], void/cancel the PI on Stripe Dashboard.
2. As **test-buyer**, tap **[I Got It]** → **[Confirm]**.
3. Observe error.
4. Verify via SQL.

**Expected:**
- Error: "Payment capture failed. Please try again or contact support."
- `tax_status` = `'capture_failed'` (or `'voided'` if PI canceled).
- `trades.status` remains `'in_progress'` (NOT completed).
- Seller SP unchanged, no payout created.
- Trade is recoverable (buyer can retry or admin can intervene).

---

### ⚠️ TRD-TC-O2-C11 · Duplicate webhook/retry — no duplicate tax collection, payout, or SP event

**Steps:**
1. Manually call `rpc_mark_tax_collected` twice:
   ```sql
   SELECT public.rpc_mark_tax_collected('<trade-uuid>', 'dup_charge_123');
   SELECT public.rpc_mark_tax_collected('<trade-uuid>', 'dup_charge_123');
   ```
2. Manually call `rpc_refund_tax_with_status` twice:
   ```sql
   SELECT public.rpc_refund_tax_with_status('<trade-uuid>', 100, 'test_dup');
   SELECT public.rpc_refund_tax_with_status('<trade-uuid>', 100, 'test_dup');
   ```
3. Check for duplicate SP ledger entries.

**Expected:**
- `rpc_mark_tax_collected` on already-collected record returns `success: true, action: 'idempotent'`.
- `rpc_refund_tax_with_status` on already-refunded record returns correct remaining refundable amount — no second addition.
- SP ledger has exactly 1 entry per operation.
- `seller_payouts` has exactly 1 payout record.

---

### ✅ TRD-TC-O2-C12 · Historical/backfill records — clearly classified, never falsely marked as collected

**Verification Queries:**
```sql
-- Status distribution
SELECT tr.tax_status, COUNT(*) AS count
FROM public.tax_records tr
GROUP BY tr.tax_status;

-- Completed pre-migration trades
SELECT t.id, t.status, tr.tax_status, tr.captured_at
FROM public.trades t
JOIN public.tax_records tr ON tr.trade_id = t.id
WHERE t.status = 'completed' AND t.completed_at < '2026-07-23'
LIMIT 5;

-- Cancelled pre-migration trades
SELECT t.id, t.status, tr.tax_status, tr.voided_at
FROM public.trades t
JOIN public.tax_records tr ON tr.trade_id = t.id
WHERE t.status = 'cancelled' AND t.cancelled_at < '2026-07-23'
LIMIT 5;
```

**Expected:**
- Completed pre-migration: `tax_status = 'collected'`, `captured_at = completed_at` (backfill approximation).
- Cancelled pre-migration: `tax_status = 'voided'`, `voided_at = cancelled_at`.
- Pending/in_progress pre-migration: `tax_status = 'quoted'` (not falsely collected).

---

## Group O-3 — Tax Refund & Reconciliation Integrity

**Focus:** Stripe-refund-first flow, buyer wording changes, pending refunds, reconciliation

**Refund Flow:**
1. Edge Function issues Stripe refund → gets refund ID and status
2. EF calls `rpc_record_stripe_refund` with result
3. If Stripe refund succeeds → tax_status becomes `refunded`/`partially_refunded`
4. If Stripe refund pending → tax_status becomes `pending_refund`
5. If Stripe refund fails → tax_status unchanged, reconciliation_status set

---

### ✅ TRD-TC-O3-C01 · Buyer wording: "Payment authorized" before capture (Awaiting Seller)

**Steps:**
1. As **test-buyer**, submit offer → trade is **Pending**.
2. Open Trade Timeline → scroll to **Payment Details** card.

**Expected:**
- Label reads **"Payment authorized:"** (not "Cash Paid" or "Paid").
- Tax label reads **"Estimated Sales Tax"** (not "Sales Tax").
- All breakdown rows visible: Swap Points, Platform Fee, Estimated Sales Tax, Total.

---

### ✅ TRD-TC-O3-C02 · Buyer wording: "Payment authorized" after seller accept (In Progress)

**Steps:**
1. From TRD-TC-O3-C01, have seller accept → trade moves to **In Progress**.
2. As **test-buyer**, open Trade Timeline → scroll to Payment Details.

**Expected:**
- Label still reads **"Payment authorized:"** (capture not yet happened).
- Tax label still reads **"Estimated Sales Tax"**.
- Stripe Dashboard: PI in `requires_capture`.

---

### ✅ TRD-TC-O3-C03 · Buyer wording: "Paid" after successful capture (Completed)

**Steps:**
1. From TRD-TC-O3-C02, tap **[I Got It]** → **[Confirm]**.
2. Verify capture succeeded.
3. Open completed trade's Timeline → scroll to Payment Details.

**Expected:**
- Label now reads **"Paid:"** (not "Payment authorized").
- Tax label reads **"Sales Tax"** (not "Estimated Sales Tax").
- Final tax amount uses stored snapshot (not live preview).

---

### ✅ TRD-TC-O3-C04 · Capture failure shows "payment could not be completed" (no completed state)

**Steps:**
1. From In Progress trade, simulate capture failure (void PI on Stripe Dashboard).
2. As **test-buyer**, tap **[I Got It]** → **[Confirm]**.
3. Observe error, reopen trade.

**Expected:**
- Error: **"Payment capture failed. Please try again or contact support."**
- Trade remains **In Progress** (not completed).
- No SP released, no payout triggered.
- `tax_status` = `'capture_failed'`.

---

### ✅ TRD-TC-O3-C05 · Admin dispute route: full refund with Stripe + tax reversal (captured trade)

**Steps:**
1. Complete a trade with captured payment.
2. As **test-buyer**, open dispute.
3. As **test-admin**, navigate to dispute → tap **Resolve → Refund** → confirm.

**Expected:**
- Stripe Dashboard shows refund for full amount (cash + fee + tax).
- Trade status → **Cancelled**.
- `tax_records`: `tax_status = 'refunded'`, `stripe_refund_id` set, `refunded_at` set.
- `refunded_tax_cents` = original `tax_amount_cents`.
- SP released to buyer (idempotent — exactly once).
- Buyer receives notification: "Your refund for [Item] has been issued."
- Net Tax Payable on reports reflects refund.

---

### ✅ TRD-TC-O3-C06 · Duplicate refund/retry is idempotent

**Steps:**
1. From TRD-TC-O3-C05, resolve same dispute again as **Refund**.
2. Check Stripe Dashboard, `tax_records`, SP ledger.

**Expected:**
- Stripe Dashboard: exactly 1 refund (not 2).
- `refunded_tax_cents` not incremented again.
- SP ledger: exactly 1 `earn_refund` entry.
- RPC response includes `action: 'idempotent'`.

---

### ✅ TRD-TC-O3-C07 · Admin dispute route: uncaptured PI is cancelled (not refunded)

**Steps:**
1. From In Progress trade (not yet completed), open dispute.
2. As **test-admin**, resolve as **Refund**.
3. Check Stripe Dashboard.

**Expected:**
- Stripe PI status: **canceled** (not refunded).
- Tax marked as **voided** (not refunded, since no money captured).
- SP returned to buyer, trade cancelled.

---

### ⚠️ TRD-TC-O3-C08 · Admin dispute route: Stripe refund failure stays unresolved

**Steps:**
1. Complete trade (captured), open dispute.
2. Before resolving, revoke Stripe API key or simulate refund failure.
3. As **test-admin**, attempt to resolve as **Refund**.
4. Observe error.

**Expected:**
- Admin sees: "Stripe refund failed: [error message]".
- Dispute status remains **under_review** (not resolved).
- Trade status NOT changed to cancelled.
- Tax NOT marked refunded, no SP released.
- Buyer receives: "A refund for [Item] could not be processed. Our team is working on it."

---

### ⚠️ TRD-TC-O3-C09 · Stripe refund pending → tax pending_refund

**Steps:**
1. Complete trade, open dispute.
2. As **test-admin**, resolve as **Refund**.
3. Check `tax_records` before Stripe confirms refund.

**Expected:**
- `tax_records.tax_status` = `'pending_refund'`.
- `stripe_refund_id` set, `refund_status` = `'pending'` or `'processing'`.
- Admin reports show record in "Pending Refund" (not Tax Refunded).
- Once Stripe confirms, `charge.refunded` webhook transitions to `refunded`.

---

### ✅ TRD-TC-O3-C10 · Report: newly submitted offer → Pending/Authorized Tax

**Steps:**
1. As **test-buyer**, submit offer on taxable item.
2. Run report summary:
   ```sql
   SELECT jsonb_pretty(get_tax_summary_for_period(
     (SELECT created_at::date - 1 FROM tax_records ORDER BY created_at DESC LIMIT 1),
     (SELECT created_at::date + 1 FROM tax_records ORDER BY created_at DESC LIMIT 1),
     NULL, 'summary'
   ));
   ```

**Expected:**
- `tax_collected_cents` = 0 (no capture).
- `pending_tax_cents` > 0 (this offer is quoted).
- `pending_tax_count` = 1.
- `tax_net_cents` = 0 (pending not included in net).

---

### ✅ TRD-TC-O3-C11 · Report: captured trade → Tax Collected using capture timestamp

**Steps:**
1. Complete a trade (buyer confirms → capture succeeds).
2. Run report summary for appropriate date range.

**Expected:**
- `tax_collected_cents` > 0 (capture counted).
- `tax_status` = `'collected'`, `captured_at` set.
- If capture date differs from offer date, tax appears in capture period (not offer period).

---

### ✅ TRD-TC-O3-C12 · Report: cancelled/declined/expired → Voided/Expired Tax, not collected

**Steps:**
1. Have pending offer cancelled (buyer cancels before seller accepts).
2. Run report summary.

**Expected:**
- `tax_collected_cents` = 0 for this record.
- `voided_tax_cents` > 0.
- `voided_tax_count` includes this trade.
- `tax_net_cents` excludes voided tax.

---

### ✅ TRD-TC-O3-C13 · Report: refunded trade → Tax Refunded, Net adjusts

**Steps:**
1. Complete trade (capture succeeds), note `tax_collected_cents`.
2. Issue full refund via admin dispute.
3. Run report summary covering both events.

**Expected:**
- `tax_collected_cents` includes original captured tax.
- `tax_refunded_cents` equals refunded tax.
- `tax_net_cents` = collected - refunded (correctly reduced).
- If refund in later period, capture still appears in original period.

---

### ✅ TRD-TC-O3-C14 · Report: CSV totals match on-screen totals

**Steps:**
1. Run report summary for a date range, note totals.
2. Export CSV for same date range.
3. Sum CSV columns and compare.

**Expected:**
- Sum of CSV `tax_amount_cents` = `tax_collected_cents` from summary.
- Sum of CSV `tax_refunded_cents` = `tax_refunded_cents` from summary.
- Sum of CSV `net_tax_cents` = `tax_net_cents` from summary.

---

## Group P — Tax (Admin Portal)

**Focus:** Admin tax configuration, reporting, bulk operations, audit trail

### passed ✅ TRD-TC-P01 · Node tax rate config (view/edit, validation)

**Steps:**
1. Admin portal → **Tax → Nodes**.
2. Locate test-buyer's node → tap **Edit**.
3. Change tax rate from 6.35% to 7.00% → **Save**.
4. Verify success message, rate persists after refresh.
5. Try invalid values (e.g., -1%, 101%) → verify validation errors.

**Expected:**
- Rate changes save successfully and persist.
- Invalid rates (< 0% or > 100%) are rejected with inline error.
- ⚠️ **Precedence caveat:** node-rate edits take effect on new offers ONLY when no category tax rule matches the item. For `general_tangible_goods` (which has an ACTIVE rule at 6.99% in staging), a node-rate edit does **NOT** change the rate on new offers — the category rule wins. To change the effective rate, edit the category tax RULE instead.

---

### deffered TRD-TC-P02 · Bulk tax update across nodes

**Status:** Needs manual testing if bulk update UI exists.

**When implemented, verify:**
- Admin can select multiple nodes and apply same rate.
- Audit log captures bulk update with all affected node IDs.
- New offers immediately use new rates.

---

### deffered TRD-TC-P03 · Tax rate change history / audit

**Steps:**
1. Navigate to **Tax → Nodes** → tap **View Change History** on a node.
2. Verify list shows: timestamp, old rate, new rate, admin actor.

**Expected:**
- Audit trail shows all rate changes for that node.
- Actor ID matches authenticated admin user.
- Timestamps are accurate.

---

### passed ✅ TRD-TC-P04 · Global tax settings toggle + warning banner

**Steps:**
1. Navigate to **Tax → Settings**.
2. Uncheck **"Enable sales tax collection"** → **Save**.
3. Observe warning banner.
4. Verify all new offers have $0 tax.
5. Re-enable → verify new offers collect tax again.

**Expected:**
- Disabling shows warning: "Sales tax is currently disabled globally. No tax will be collected on new orders."
- All new offers after disabling: `tax_amount_cents = 0`.
- Re-enabling restores tax collection on new offers.
- Historical/in-flight offers unchanged.

---

### TRD-TC-P05 · Tax reporting dashboard: summary + date presets

**Steps:**
1. Navigate to **Tax → Reports**.
2. Select date preset **"Last 30 Days"** → observe summary.
3. Select custom date range → observe summary updates.

**Expected:**
- Summary shows: Total Tax Collected, Total Refunded, Net Tax Payable, Pending Tax, Voided Tax.
- Date presets: Today, Last 7 Days, Last 30 Days, This Month, Last Month, Custom.
- All summaries update in real time when date range changes.

---

### ⚠️ TRD-TC-P06 · Jurisdiction breakdown + 7 report types

**Steps:**
1. On **Tax → Reports**, scroll to **Jurisdiction Breakdown**.
2. Verify list shows each node/jurisdiction with collected/refunded/net amounts.
3. Verify 7 report categories: Tax Collected, Tax Refunded, Net Tax Payable, Pending/Authorized, Voided/Expired, Capture Failed, Pending Refund, Reconciliation Required.

**Expected:**
- Jurisdiction breakdown shows per-node totals.
- All 7 report types are accessible and show correct filtered data.
- Report types align with tax status lifecycle (O-2).

---

### ✅ TRD-TC-P07 · CSV export for filing

**Steps:**
1. On **Tax → Reports**, select date range → tap **Export CSV**.
2. Open downloaded file.
3. Verify columns: Trade ID, Date, Node, Jurisdiction, Item Title, Taxable Amount, Tax Rate, Tax Amount, Refunded Tax, Net Tax, Status.
4. Sum columns manually and compare to on-screen summary (TRD-TC-O3-C14).

**Expected:**
- CSV downloads successfully with all columns.
- Manual sum of CSV matches on-screen totals.
- File naming: `tax-export-{start-date}-{end-date}.csv`.

---

### PASSED ✅ TRD-TC-P08 · Admin changes rate → new transactions use new rate

**Steps:**
1. As **test-admin**, change test-buyer's node rate from 6.35% to 8.00%.
2. As **test-buyer**, submit a new offer on a $30 item.
3. ⚠️ **Corrected expectation (QA Task 11):** because `general_tangible_goods` has an ACTIVE category tax rule at 6.99%, the new offer still uses the rule rate → tax = `FLOOR((3000 * 0.0699) + 0.5) = 210 cents = $2.10`, NOT $2.40. The node-rate edit has no effect on this item's tax.
4. Verify older offers still show their stored tax snapshot (not retroactively changed).

**Expected:**
- New offer: tax calculated at the category-rule rate (6.99% → $2.10), proving **node-rate edits do not propagate when a category rule exists**.
- To observe the node rate being used at all, first deactivate the `general_tangible_goods` rule (TRD-TC-O1-C04), then a node-rate edit applies.
- Old offers: tax unchanged (stored snapshot, not recalculated).

---

## Summary of Test Status

| Group | Total Cases | ✅ Passed | ⚠️ Needs Testing | ⏭️ Deferred | 🔄 Partially Tested |
|---|---|---|---|---|---|
| **O — Tax (End User)** | 8 | 6 | 0 | 2 | 0 |
| **O-1 — Tax Categories (Admin Config)** | 17 | 11 | 5 | 1 | 0 |
| **O-2 — Tax Status Lifecycle** | 12 | 8 | 4 | 0 | 0 |
| **O-3 — Tax Refund & Reconciliation** | 14 | 10 | 4 | 0 | 0 |
| **P — Tax (Admin Portal)** | 8 | 6 | 2 | 0 | 0 |
| **TOTAL** | **59** | **41** | **15** | **3** | **0** |

**Pass Rate:** 69% (41/59) — Majority of core tax functionality verified.  
**QA Priority:** Focus on the 15 "Needs Testing" cases — these are implemented but not yet verified.  
**Deferred Items:** 3 cases deferred to post-MVP (tax exemption, tax-exempt user badge, unauthorized access control).

---

## Critical Paths for QA (Test First)

### P0 — Core Tax Calculation (Must Pass Before Launch)
1. TRD-TC-O01 — Tax shown in checkout
2. TRD-TC-O02 — Tax recalculates with SP (**confirm BP-37: tax should NOT recalculate**)
3. TRD-TC-O2-C04 — SP does not reduce taxable base
4. TRD-TC-O2-C08 — Capture succeeds, tax collected
5. TRD-TC-P01 — Admin can change node rate
6. TRD-TC-P08 — New rate applies to new offers immediately

### P1 — Refund & Reconciliation (Stripe Integration)
1. TRD-TC-O3-C05 — Admin dispute refund with tax reversal
2. TRD-TC-O3-C06 — Refund idempotency
3. TRD-TC-O3-C08 — Stripe refund failure handling
4. TRD-TC-O3-C09 — Pending refund status

### P2 — Category Rules & Admin Config
1. TRD-TC-O1-C01 → TRD-TC-O1-C04 — Tax rule CRUD
2. TRD-TC-O1-C14 → TRD-TC-O1-C15 — Category mapping changes
3. TRD-TC-O1-C11 — Fee-in-tax-base toggle

### P3 — Reporting & Audit
1. TRD-TC-P05 — Tax reporting dashboard
2. TRD-TC-P07 — CSV export
3. TRD-TC-O3-C14 — CSV totals match on-screen

---

## Known Issues & Workarounds


---

## Appendix B: Quick Reference SQL Queries

### Check Tax Status for a Trade
```sql
SELECT 
  t.id AS trade_id,
  t.status AS trade_status,
  tr.tax_status,
  tr.tax_amount_cents,
  tr.taxable_amount_cents,
  tr.captured_at,
  tr.voided_at,
  tr.stripe_capture_id,
  tr.stripe_refund_id,
  tr.refunded_tax_cents,
  tr.tax_snapshot->'items'->0->>'item_price_cents' AS item_price_cents,
  tr.tax_snapshot->'rate' AS tax_rate,
  tr.tax_snapshot->'include_fee_in_tax_base' AS fee_in_base
FROM trades t
JOIN tax_records tr ON tr.trade_id = t.id
WHERE t.id = '<trade-uuid>';
```

### Get Tax Summary for a Node (Last 30 Days)
```sql
SELECT jsonb_pretty(get_tax_summary_for_period(
  NOW() - INTERVAL '30 days',
  NOW(),
  '<node-uuid>',
  'summary'
));
```

### List All Tax Rules for a Category
```sql
SELECT 
  tr.id,
  tr.version,
  tr.display_name,
  tr.is_taxable,
  tr.tax_rate,
  tr.jurisdiction,
  tr.is_active,
  tr.effective_from,
  tr.effective_to,
  tr.min_item_price_cents,
  tr.max_item_price_cents
FROM tax_rules tr
JOIN tax_categories tc ON tc.id = tr.tax_category_id
WHERE tc.key = 'general_tangible_goods'
ORDER BY tr.version DESC;
```

### Verify All Items Have a Tax Category
```sql
SELECT 
  COUNT(*) AS total_items,
  COUNT(tax_category_id) AS items_with_category,
  COUNT(*) - COUNT(tax_category_id) AS items_without_category
FROM items;
```

---

**End of Tax Testing Consolidated Guide**

---

## Group Q — Reviews & Ratings

**Ref:** MODULE-08 · REVIEW-001 through REVIEW-007 · Anti-Brigading Addendum

### passed TRD-TC-Q01 · Review prompt appears for both parties after trade completion

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

### passed TRD-TC-Q02 · Star rating required — submit blocked without rating

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

### passed TRD-TC-Q03 · Comment is optional and capped at 500 characters

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

### passed TRD-TC-Q04 · Anonymous review hides reviewer identity

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

### passed TRD-TC-Q05 · Skip review — no blocking, no re-prompt for same trade

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

### passed TRD-TC-Q06 · Mutual review status shown on completed trade detail

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

### passed TRD-TC-Q07 · Completed reviews visible on counterparty's public profile

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

### passed TRD-TC-Q08 · Average rating and total count displayed on user profile

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

### paassed TRD-TC-Q09 · Rating breakdown (5 → 1 stars) shown on profile

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
- The sum of all per-star counts equals the total review count shown in TRD-TC-Q08.

---

### deffered TRD-TC-Q10 · Edit review succeeds within 24h window

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

### deffered TRD-TC-Q11 · Edit blocked after 24h window

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

### passed TRD-TC-Q12 · One review per trade — duplicate submission blocked

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

### deffered TRD-TC-Q13 · 30-day same-counterparty cooldown enforced

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

### deffered TRD-TC-Q14 · 24h post-completion cooldown — review locked until 24h after trade completion

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

### ✅ passed TRD-TC-Q15 · Flag a review (select reason) — reviewee-only model

**Ref:** MODULE-08 REVIEW-006
**Actors:** test-seller (the reviewee) reporting a review written about them, from their **own** profile

**Status note (Dev Task 75, 2026-08-31):** the guide now matches the **implemented model**. The report menu is shown **only to the reviewee on their own profile** (`ProfileScreen` renders `ReviewCard` with `currentUserId`; `ReviewCard.canReport = currentUserId === reviewee_id`; `SellerProfileScreen` hardcodes `showReportMenu={false}`). Public seller profiles hide the report menu entirely, and non-reviewees never see it. This supersedes the older "any user flags from a public profile" wording (which was never implemented). Report reasons (4: **Spam / Offensive / False information / Other**) and the confirmation copy ("Review reported. Thank you!") are now aligned between guide and app.

**Precondition:** test-seller has at least one review written about them (by any user) visible on their own profile.

**Objective:** Verify the reviewee can flag a review written about them and select a reason.

**Steps:**
1. Log in as **test-seller** (the reviewee) and open **your own profile** → Reviews section.
2. On a review card written about you (by another user), tap the overflow menu (⋯, `review-menu-button`).
3. Select **Report** (e.g. **Report as Offensive**) and confirm.

**Expected Result:**
- The overflow menu (⋯) is visible **only on the reviewee's own profile**, only on review cards written about them.
- The report reason options shown are: **Spam**, **Offensive**, **False information**, **Other** (4 reasons).
- After submitting, a confirmation appears: **"Review reported. Thank you!"**
- The review remains visible immediately (it is not hidden until the 3-report threshold is reached — see Q16).
- **Negative checks:** on a public seller profile (viewing another user's profile), NO overflow/report menu appears on any card; a non-reviewee user never sees a report option on any review.

**Backend enforcement:** `reportReview` rejects reporters who are not the reviewee ("You can only report reviews that were written about you"), and `ReviewCard.canReport` gates the UI to `currentUserId === reviewee_id`.

---

### deffered TRD-TC-Q16 · Auto-hide review after 3+ reports

**Status note (Dev Task 75, 2026-08-31):** under the reviewee-only reporting model (Q15), a given review can only ever be reported by **one** reporter — the reviewee — so the "3 distinct reporter accounts" precondition is **not reachable** through the app. This is a product question to confirm: either the auto-hide-at-3 trigger is dead code / unreachable by design (acceptable, since self-flagging doesn't indicate brigading), or public-profile reporting should be re-opened for real (a product decision — see Q15's status note). Until resolved, this case remains deferred with the reachability caveat documented here.

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

### ✅ passed TRD-TC-Q17 · Cannot flag own review

**Status note (Dev Task 75, 2026-08-31):** the reviewee-only model satisfies this outcome by construction — a reviewer can never flag their own review because only the reviewee can report a review, and the reporter is by definition a different user than the reviewer. QA-verified PASS 2026-08-31 (no flag/report affordance appears on a reviewer's own cards, nor on any card when viewing a public profile).

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

### passed TRD-TC-Q18 · Admin moderation queue shows reported reviews with counts and reasons

**Ref:** MODULE-08 REVIEW-007
**Actors:** test-admin
**Precondition:** At least one review has been auto-hidden (3+ reports, from TRD-TC-Q16).

**Objective:** Verify the admin moderation queue lists flagged reviews with full report details.

**Steps:**
1. Log in to the **admin portal** as **test-admin** and navigate to **Reviews → Moderation Queue**.
2. Locate the auto-hidden review from TRD-TC-Q16.
3. Expand or inspect its report details.

**Expected Result:**
- The queue lists each review's content, reviewer name, reviewee name, and total report count (e.g., "3 reports").
- Each individual report shows its reason (e.g., "offensive") and timestamp.
- Reviews are sorted by report count descending.
- Reviews with zero reports (visible, non-hidden) do **not** appear in the queue.

---

###  passed TRD-TC-Q19 · Admin approves (unhides) a reported review

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

### deffered hide is enough TRD-TC-Q20 · Admin deletes a reported review

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

### passed TRD-TC-R01 · Buyer cancels pending trade → cancelled, auth voided, SP restored

**Ref:** FLOW-27 · TRD-TC-B04/TRD-TC-C02
**Actors:** test-buyer (subscriber) + test-seller

**Objective:** Verify cancelling before seller acceptance voids the payment authorization and restores reserved SP with no consequence.

**Steps:**
1. As **test-buyer**, submit an offer (using some SP) on an Accept SP listing so the trade is **Pending**.
2. Before the seller responds, open the trade and cancel it.

**Expected Result:**
- The trade moves Pending → **Cancelled** (reason buyer_cancelled).
- The payment authorization is voided (no capture/charge to the buyer).
- The buyer's reserved SP returns to available (reserved → 0).
- No seller consequence level is applied; the listing returns to available.

### passed TRD-TC-R02 · Seller declines pending offer → cancelled, SP restored

**Ref:** FLOW-27 · TRD-TC-B01/TRD-TC-C02
**Actors:** test-buyer + test-seller

**Objective:** Verify a seller decline cancels the trade and releases the buyer's hold.

**Steps:**
1. With a Pending SP offer, log in as **test-seller** and decline it.

**Expected Result:**
- The trade becomes **Cancelled** (seller decline); the buyer's payment authorization is released and reserved SP is restored to available.
- The buyer is notified the offer was declined.

### passedTC-R03 · Offer expiry → auto-cancel + competing offers cancelled

**Ref:** FLOW-27 · TRD-TC-B02/TRD-TC-B03/TRD-TC-C03
**Actors:** test-buyer + test-seller

**Objective:** Verify offer expiry auto-cancels and competing offers are released when one is accepted.

**Steps:**
1. Submit an offer and let it reach the offer timeout without seller response.
2. Separately, on an item with multiple competing offers, have the seller accept one.

**Expected Result:**
- The expired offer auto-cancels (reason cancelled_expired); the buyer's hold and SP are restored.
- When one competing offer is accepted, the remaining competing offers are cancelled (cancelled_expired_competing) and those buyers' holds/SP are restored.

### passed TRD-TC-R04 · Card declined at offer submission → no trade created

**Ref:** FLOW-27 · TRD-TC-B06
**Actors:** test-buyer (declining test card)

**Objective:** Verify a declined authorization does not create a trade or hold.

**Steps:**
1. With a card that declines, attempt to submit an offer.

**Expected Result:**
- An error is shown; no Pending trade is created; no SP is reserved and no charge/hold remains.

### passed TRD-TC-R05 · Seller cancels in_progress → refund + consequence level

**Ref:** FLOW-27 · TRD-TC-J01/TRD-TC-C06
**Actors:** test-buyer + test-seller

**Objective:** Verify a post-acceptance seller cancellation refunds the buyer and records a consequence level.

**Steps:**
1. Take a trade to **In Progress** (seller accepted).
2. As **test-seller**, cancel the in_progress trade and pick a seller cancellation reason.

**Expected Result:**
- The trade moves In Progress → **Cancelled** (seller_cancelled).
- The buyer is fully refunded (see TRD-TC-R06) and any SP is restored (see TRD-TC-R07).
- A seller consequence level (1/2/3) is applied per prior post-acceptance cancellations; at level 3 the seller is flagged for admin review.

### TRD-TC-R06 · Refund settlement breakdown (cash + proportional tax + fee)

**Ref:** FLOW-27 · TRD-TC-O07
**Actors:** test-buyer + test-seller

**Objective:** Verify the refunded amounts: cash, proportional sales tax, and platform fee treatment.

**Steps:**
1. From a cancelled/refunded in_progress trade (TRD-TC-R05) or an admin refund (TRD-TC-R09), open the trade detail / transaction history.

**Expected Result:**
- The cash amount is refunded to the buyer's original payment method.
- The sales tax is refunded proportionally to the refunded amount.
- The platform fee is handled per policy (refunded or retained) and the breakdown is shown clearly in the transaction history / refund summary.

### TRD-TC-R07 · SP reversal on refund (reserved/transferred returned)

**Ref:** FLOW-27 · TRD-TC-C06
**Actors:** test-buyer + test-seller

**Objective:** Verify SP is reversed correctly on a refund regardless of trade stage.

**Steps:**
1. For an SP-using trade that is cancelled/refunded while in_progress, check the buyer and seller SP wallets.

**Expected Result:**
- The buyer's SP (reserved, or already released to the seller's pending at completion) is reversed back to the buyer's available balance.
- The seller does not retain buyer SP or the platform SP reward for a refunded trade.

### TRD-TC-R08 · Seller payout withheld / cancelled on refund

**Ref:** FLOW-27 · TRD-TC-F02
**Actors:** test-seller

**Objective:** Verify a refunded trade does not pay out to the seller.

**Steps:**
1. For a refunded/cancelled in_progress trade, review the seller's payout/earnings.

**Expected Result:**
- No payout is created (or a pending payout is cancelled/withheld) for the refunded trade; the seller's available balance does not include the refunded trade's proceeds.

### TRD-TC-R09 · Admin dispute resolve → Refund (full settlement)

**Ref:** FLOW-27 · TRD-TC-E06/TRD-TC-O07
**Actors:** test-admin + test-buyer + test-seller

**Objective:** Verify an admin dispute resolution to Refund triggers the full settlement.

**Steps:**
1. Open a dispute on an in_progress trade; as **test-admin**, resolve it as **Refund**.

**Expected Result:**
- The trade is cancelled/refunded; cash + proportional tax are refunded to the buyer (TRD-TC-R06), SP is reversed (TRD-TC-R07), the seller payout is withheld (TRD-TC-R08), and both parties are notified (TRD-TC-R11).

### TRD-TC-R10 · Admin dispute resolve → Complete (no refund)

**Ref:** FLOW-27 · TRD-TC-E05
**Actors:** test-admin + test-buyer + test-seller

**Objective:** Verify resolving a dispute as Complete settles in the seller's favor (no refund).

**Steps:**
1. On a disputed in_progress trade, as **test-admin** resolve as **Complete**.

**Expected Result:**
- The trade moves to **Completed**; SP releases to the seller and the seller payout proceeds; no refund is issued to the buyer.

### TRD-TC-R11 · Refund / cancellation notifications to both parties

**Ref:** FLOW-27 · TRD-TC-G01/TRD-TC-G02
**Actors:** test-buyer + test-seller

**Objective:** Verify both parties are notified of a cancellation/refund.

**Steps:**
1. Trigger each cancellation/refund path (buyer cancel, seller decline, expiry, seller in_progress cancel, admin refund) and check both parties' notification centers.

**Expected Result:**
- Each party receives an appropriate notification (e.g., "Offer declined", "Trade cancelled", "You've been refunded"), deep-linking to the relevant trade.

### TRD-TC-R12 · Refund idempotency — no double refund

**Ref:** FLOW-27
**Actors:** test-admin

**Objective:** Verify a refund cannot be applied twice.

**Steps:**
1. On an already refunded/cancelled trade, attempt to resolve/refund again (admin) or retry the action.

**Expected Result:**
- The action is rejected or is a no-op; the buyer is not refunded twice and SP is not restored twice; the trade remains in its terminal cancelled/refunded state.

### TRD-TC-R13 · Cancelled / refunded trade status + timeline

**Ref:** FLOW-27
**Actors:** test-buyer + test-seller

**Objective:** Verify the terminal status and event timeline reflect the cancellation/refund.

**Steps:**
1. Open a cancelled/refunded trade's detail/timeline as both buyer and seller.

**Expected Result:**
- The trade shows a terminal **Cancelled** (or refunded) status with the correct reason; the timeline lists the cancellation/refund event with timestamp; the trade no longer auto-completes and exposes no further action CTAs.

---

## Group S — Seller Group & Bundle Discovery

> **Added:** 2026-07-13 — Seller masking leak fix + "More from this seller" page + "Matches Your Cart" on filtered page + bundle CTA.
> **Updated:** 2026-07-13 — Replaced Discover-grid badge approach with "More from this seller" entry point on ItemDetailScreen.

### TRD-TC-S01 · Different-seller modal uses generic copy (no seller name leak)

**Ref:** SELLER-GROUP-003 · TASK-ITEM-DETAILS-001
**Actors:** test-buyer (subscriber) + test-seller + test-seller-2

**Objective:** Verify the different-seller cart-conflict modal on ItemDetailScreen shows only generic, seller-agnostic copy — no seller name, ID, or other PII is ever interpolated into the message.

**Precondition:** test-buyer has an active cart with an item from test-seller. test-seller-2 has an available listing in the same node.

**Steps:**
1. Log in as **test-buyer** and add an item from **test-seller** to cart.
2. Open an available item from **test-seller-2** (a different seller).
3. Tap **[Add to Cart]** on the ItemDetailScreen.
4. Observe the different-seller modal that appears.

**Expected Result:**
- The modal title is "Different Seller".
- The modal message reads EXACTLY: **"Your cart already has items from a different seller. Adding this item will clear your current cart."**
- The message does NOT contain any seller name, ID, node, ZIP, or location.
- Three buttons are shown: **Cancel**, **Save & Start New Cart**, **Replace Cart**.

---

### TRD-TC-S02 · "More from this seller" icon appears when seller has 2+ approved listings

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer
**Precondition:** test-seller has at least 2 approved (status='available') listings. test-seller-single has exactly 1.

**Objective:** Verify the "More from this seller" icon/CTA appears on ItemDetailScreen only when the seller has 2+ approved listings (including the current one).

**Steps:**
1. Log in as **test-buyer** and open an item from **test-seller** (who has 2+ available listings).
2. Scroll to the Seller Info section.
3. Observe the green CTA below the star rating and badges.

**Expected Result:**
- A green CTA appears: 🟩 icon + "This seller has N more item(s)" — where N = count of other approved listings excluding the current one.
- Tapping the CTA navigates to the "More from this seller" page.
- The CTA is inline with the seller info card (below the Seller Group badge and Matches Cart indicator, above the action buttons).

---

### TRD-TC-S03 · "More from this seller" icon hidden when seller has exactly 1 listing

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer
**Precondition:** test-seller-single has exactly 1 approved listing.

**Objective:** Verify the CTA is completely hidden when the seller has only 1 approved listing.

**Steps:**
1. Log in as **test-buyer** and open the ONLY item from **test-seller-single**.
2. Scroll to the Seller Info section.

**Expected Result:**
- The "More from this seller" CTA is **absent** — not rendered.
- The seller info section shows only the masked name, star rating, Seller Group badge, and action buttons.
- No empty space or placeholder appears for the CTA.

---

### TRD-TC-S04 · Tapping icon opens "More from this seller" page — no seller identity

**Ref:** SELLER-GROUP-007 · TASK-ITEM-DETAILS-001
**Actors:** test-buyer
**Precondition:** test-seller has 3+ available listings.

**Objective:** Verify the "More from this seller" page shows only that seller's listings, with ZERO seller name, avatar, or identity visible anywhere on the page.

**Steps:**
1. From ItemDetailScreen, tap the **"This seller has N more items"** CTA.
2. Observe the new page title: **"More from this seller"**.
3. Inspect every text element and image on the page.
4. Check the rendered text via accessibility inspector or view debugger.

**Expected Result:**
- The page title is generically: **"More from this seller"** — no seller name in the header.
- Each item card shows: photo, title, price, Seller Group badge, and an "Add to Cart" button.
- **Nowhere on the page** does the seller's name, avatar, city, state, ZIP, phone, email, or bio appear.
- The Seller Group badge (colored dot + label like "Seller ● Blue") is the only seller-identifying element.
- An Add to Cart button is visible on each item card.
- If the buyer has an active cart matching this seller, a green "Items from this seller match your active cart" banner appears at the top.

---

### TRD-TC-S05 · Add to Cart from filtered seller page populates cart correctly

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer
**Precondition:** test-seller has 2+ available listings.

**Objective:** Verify adding items from the "More from this seller" page correctly populates Cart and triggers existing same-seller logic without duplicate/conflicting entries.

**Steps:**
1. Open "More from this seller" for test-seller.
2. Tap **Add to Cart** on Item A.
3. Tap **Add to Cart** on Item B.
4. Open the **Cart** screen.
5. Verify both items appear.
6. Verify the bundle CTA appears (since 2+ same-seller items).

**Expected Result:**
- Both items appear in Cart under the same seller group.
- No duplicate entries for the same item.
- The bundle CTA ("Bundle these 2 items") appears on CartScreen.
- Returning to the "More from this seller" page, Item A and Item B show "In Cart" instead of "Add to Cart".

---

### TRD-TC-S06 · "Matches Your Cart" indicator on filtered seller page

**Ref:** SELLER-GROUP-004, SELLER-GROUP-007
**Actors:** test-buyer
**Precondition:** test-buyer has an active cart with an item from test-seller.

**Objective:** Verify the "Matches Your Cart" banner appears on the filtered page when buyer's active cart matches the seller.

**Steps:**
1. Add an item from test-seller to cart.
2. Open a different item from test-seller → tap "More from this seller" CTA.
3. Observe the top of the filtered page.
4. Clear the cart, return to the filtered page.

**Expected Result:**
- When cart matches: a green banner at the top: 🛒 "Items from this seller match your active cart."
- When cart is empty or has a different seller: no green banner.
- The match is based on seller group hash comparison — same seller, same banner.

---

### TRD-TC-S07 · Bundle CTA appears on CartScreen with 2+ same-seller items

**Ref:** SELLER-GROUP-005
**Actors:** test-buyer
**Precondition:** test-seller has at least 2 available listings.

**Objective:** Verify the CartScreen shows a "Bundle these N items" CTA when 2+ items in the cart are from the same seller.

**Steps:**
1. Add two items from test-seller to cart (via "More from this seller" page or discover).
2. Open the **Cart** screen.
3. Scroll past the items list and summary card.

**Expected Result:**
- A green outlined card: 📦 "Bundle these N items — Make one offer for all items from this seller."
- The regular Checkout button is still visible.
- With 1 item: no bundle CTA.

---

### TRD-TC-S08 · Bundle CTA hidden with single item or empty cart

**Ref:** SELLER-GROUP-005
**Actors:** test-buyer

**Steps:**
1. Clear cart → verify no bundle CTA.
2. Add a single item → verify no bundle CTA.

**Expected Result:**
- Bundle CTA absent for 0 or 1 items.

---

### TRD-TC-S09 · Bundle CTA navigates to checkout in bundle mode

**Ref:** SELLER-GROUP-005
**Actors:** test-buyer (subscriber)
**Precondition:** Cart has 2+ test-seller items.

**Steps:**
1. Tap "Bundle these N items" CTA.
2. Observe CartCheckoutScreen.

**Expected Result:**
- 📦 "Bundle Offer" banner at top.
- All items listed. SP stepper available. Tapping Confirm Purchase submits the offer.

---

### TRD-TC-S10 · Bundle checkout banner absent on regular checkout

**Ref:** SELLER-GROUP-005

**Steps:**
1. With 2+ items, tap regular Checkout → no bundle banner.
2. Go back, tap Bundle CTA → bundle banner visible.

**Expected Result:**
- Regular Checkout: no bundle banner. Bundle CTA: banner present.

---

### TRD-TC-S11 · Regression: Discover/search grid unchanged (no badges)

**Ref:** SELLER-GROUP-REVERT
**Actors:** test-buyer

**Objective:** Verify the Discover/search grid has NO seller group badges or "Matches Your Cart" indicators — the grid is clean, as before any seller-group changes.

**Steps:**
1. Open Discover tab.
2. Search for items.
3. Inspect item cards — verify no Seller Group colored badges or "Matches Your Cart" badges.

**Expected Result:**
- Each card shows: image, title, price, SP badge (if applicable), heart icon. No colored seller tags. No green cart-match indicators.

---

### TRD-TC-S12 · Regression: single-item offer flow unchanged

**Ref:** FLOW-08 · TRADING-FLOW-V2 §7
**Actors:** test-buyer + test-seller

**Steps:**
1. Execute TRD-TC-A01 (Cash Only happy path).
2. Execute TRD-TC-A02 (Accept SP happy path).

**Expected Result:**
- Both flows pass identically. No regressions from seller-group/masking changes.

---

### TRD-TC-S13 · Regression: seller identity unlocks only post-acceptance

**Ref:** TASK-ITEM-DETAILS-001
**Actors:** test-buyer + test-seller

**Steps:**
1. Browse items pre-trade → name is "Seller Info Hidden".
2. Submit offer (pending) → name still masked.
3. Seller accepts (in_progress) → name NOW visible.
4. Seller Group badge and "More from this seller" CTA remain visible throughout.

**Expected Result:**
- Masking enforced at ALL stages before in_progress. No regression.

---

### TRD-TC-S14 · More from seller — Item Detail CTA in standalone position (below seller card)

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

### TRD-TC-S15 · More from seller — Item Detail CTA hidden at 0 additional listings

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer + test-seller with only 1 approved listing

**Steps:**
1. Navigate to ItemDetailScreen for the seller's only listing.
2. Scroll down.

**Expected Result:**
- No "more from this seller" banner appears anywhere on the screen.
- Everything else in the Seller Info card renders normally.

### TRD-TC-S16 · More from seller — Item Detail CTA does not disrupt "Matches Your Cart" badge

**Ref:** SELLER-GROUP-004, SELLER-GROUP-007
**Actors:** test-buyer (active cart matches seller) + test-seller

**Steps:**
1. Ensure buyer has an active cart containing items from test-seller.
2. Navigate to ItemDetailScreen for a different listing from the same seller.
3. Observe the Seller Info card.

**Expected Result:**
- "Matches Your Cart" badge is still visible inside the seller card (not moved).
- The standalone CTA is below the card. Both elements visible and legible.

### TRD-TC-S17 · More from seller — Trade Basket banner shows correct remaining-item count

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

### TRD-TC-S18 · More from seller — Trade Basket banner recalculates after adding item from filtered page

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer with 1 item in cart, test-seller with 4 total listings

**Steps:**
1. From Trade Basket, tap the "View" link on the banner → opens MoreFromThisSeller page.
2. Tap "Add to Trade Basket" on one of the items there → item is added.
3. Navigate back to Trade Basket.

**Expected Result:**
- Banner now reads "This seller has 2 more items" (was 3, now 2).
- The count correctly decreased by 1.

### TRD-TC-S19 · More from seller — Trade Basket banner disappears when all seller's listings are in basket

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer, test-seller with 3 total listings

**Steps:**
1. Add all 3 of the seller's listings to the cart.
2. Open Trade Basket.

**Expected Result:**
- No "more from this seller" banner appears.
- All 3 items are listed in the cart.

### TRD-TC-S20 · More from seller — Trade Basket banner dismissible via X button

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer with 1 item in cart, seller with 3+ listings

**Steps:**
1. Open Trade Basket → banner is visible.
2. Tap the X dismiss button on the banner.

**Expected Result:**
- Banner disappears and does not reappear during this cart session.
- All other cart content (items, summary, buttons) is unaffected.

### TRD-TC-S21 · More from seller — Banner and filtered page never reveal seller identity

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

### TRD-TC-S22 · Regression: Seller Info card elements unchanged

**Ref:** TASK-ITEM-DETAILS-001
**Actors:** test-buyer, test-seller

**Steps:**
1. Navigate to ItemDetailScreen for any listing.
2. Observe all elements in the Seller Info card.

**Expected Result:**
- Avatar, masked name (with lock icon), rating stars, "Matches Your Cart" badge (if applicable), Contact Seller button, View Profile button — all present at their original positions.
- Only the old inline "X more items" text is gone from inside the card.

### TRD-TC-S23 · Regression: Trade Basket subtotal/total/bundle CTA layout unaffected

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

### TRD-TC-S24 · More from seller — Return-to-Cart navigation after adding item from filtered page

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

## Group T — Points Redemption (Bundle Checkout)

> **Added:** 2026-07-15 — Per-item numeric SP inputs, wallet balance validation, category caps, seller payout breakdown. **SP transfer to seller happens at COMPLETION, not acceptance** (D-17; `fn_release_all_sp_on_complete` — DEV-TASK-76 doc sync 2026-08-31).

### TRD-TC-T01 · SP input appears only on eligible items

**Ref:** FLOW-08 · FLOW-11
**Actors:** test-buyer (Kids Club+ subscriber) + test-seller (with both Accept SP and Cash Only listings)

**Steps:**
1. Add 2 items to cart from same seller: one with Accept SP, one Cash Only.
2. Navigate to CartCheckout (bundle mode).
3. Observe each item row.

**Expected Result:**
- The Accept SP item shows a numeric SP input field next to its price.
- The Cash Only item shows a "Not eligible for points" label with NO SP input.

### TRD-TC-T02 · Entered SP applies correct amount (balance + cap sufficient)

**Ref:** FLOW-11
**Actors:** test-buyer with 500+ SP wallet balance

**Steps:**
1. Add an Accept SP item ($40 price) to cart.
2. Navigate to checkout. Enter 20 in the item's SP input field.
3. Verify the applied amount and label.

**Expected Result:**
- 20 pts applied (50% of $40).
- SP-limit hint shows "You can use up to 20 SP" with subtext "Limited by this item's category" (DEV-TASK-72 unified wording; replaced the old "20 pts applied" label).
- Points remaining counter decreases by 20.

### TRD-TC-T03 · Entered SP applies partial amount when wallet insufficient

**Ref:** FLOW-11
**Actors:** test-buyer with 8 SP wallet balance

**Steps:**
1. Add an Accept SP item ($40 price) to cart.
2. Navigate to checkout. Enter 20 in the item's SP input field (clamps to 8 — wallet-limited).
3. Verify the applied amount and label.

**Expected Result:**
- 8 pts applied (limited by wallet, not by 50% cap which would be 20).
- SP-limit hint shows "You can use up to 8 SP" with subtext "Limited by your SP balance" (DEV-TASK-72 unified wording; was "8 of 20 pts applied — balance limit").
- Points remaining counter shows 0.

### TRD-TC-T04 · Category cap limits applied points

**Ref:** FLOW-11
**Actors:** test-buyer with 200 SP, admin sets category cap to 10 for selected category

**Steps:**
1. Admin: set `sp_redemption_cap = 10` on the item's category.
2. Add that Accept SP item ($100 price) to cart as test-buyer.
3. Navigate to checkout, enter 50 in the item's SP input field (clamps to the 10 cap).

**Expected Result:**
- 10 pts applied (category cap of 10, even though 50% cap = 50 and wallet has 200).
- SP-limit hint shows "You can use up to 10 SP" with subtext "Limited by this item's category" (DEV-TASK-72 unified wording; was "10 pts applied (category cap: 10)").

### TRD-TC-T05 · Clearing SP restores balance for sequential allocation

**Ref:** FLOW-11
**Actors:** test-buyer with 30 SP wallet balance

**Steps:**
1. Add 2 Accept SP items to cart: Item A ($40) and Item B ($30).
2. Enter 20 SP for Item A → 20 pts applied (50% of $40). Remaining: 10.
3. Enter 10 SP for Item B → 10 pts applied (wallet-limited). Remaining: 0.
4. Clear Item A's SP field → its 20 pts restored. Remaining: 20.
5. Re-enter 20 SP for Item A → 20 pts applied (from restored balance).

**Expected Result:**
- Step 3: Item B shows "You can use up to 10 SP" with subtext "Limited by your SP balance" (DEV-TASK-72 unified wording; was "10 of 15 pts applied — balance limit").
- Step 4: Remaining counter jumps to 20.
- Step 5: Item A gets full 20 pts back.

### TRD-TC-T06 · Points remaining counter updates in real time

**Ref:** FLOW-11
**Actors:** test-buyer with 50 SP

**Steps:**
1. Add 3 Accept SP items. Rapidly enter then clear SP values on each item.
2. Observe the "Points remaining: X" counter after each action.

**Expected Result:**
- Counter updates immediately after each entry/clear with no flicker or stale value.
- After all SP fields cleared, counter shows original wallet balance.

### TRD-TC-T07 · Order Summary points math correct

**Ref:** FLOW-08 · FLOW-11
**Actors:** test-buyer with 100 SP

**Steps:**
1. Add 2 Accept SP items: Item A ($40, enter 20 pts), Item B ($30, enter 15 pts).
2. Verify Order Summary.

**Expected Result:**
- Subtotal: $70.00
- Points Applied: -$35.00
- Platform Fee: $1.49 (subscriber)
- Cash Total: $35.00 + $1.49 + tax = correct value
- "Send Offer" button shows correct cash total.

### TRD-TC-T08 · Seller Review Offer shows per-item points breakdown

**Ref:** FLOW-08
**Actors:** test-buyer + test-seller

**Steps:**
1. Buyer submits bundle offer with points applied (Item A: 20 pts, Item B: 15 pts).
2. Seller opens Review Offer screen and taps "View all items".

**Expected Result:**
- Bundle items list shows each item with:
  - Item title
  - Points deduction (e.g. "-20 pts")
  - Net amount seller receives

### TRD-TC-T09 · Seller sees Total Payout vs Buyer's Total Paid

**Ref:** FLOW-08
**Actors:** test-buyer + test-seller

**Steps:**
1. Seller reviews offer with points applied.
2. Verify the payout breakdown card and bundle totals.

**Expected Result:**
- "Your Payout" card shows: Item Price, Points Applied (deduction), Net Cash Payout.
- Bundle totals show: "Buyer's Total Paid" (cash from buyer) AND "Total Payout" (price - points, does NOT include platform bonus).
- "Total Payout" < "Buyer's Total Paid" when points are applied (because platform fee is separate from payout).

### TRD-TC-T10 · "Includes points redemption" tag on seller's offer list

**Ref:** FLOW-08
**Actors:** test-buyer + test-seller

**Steps:**
1. Buyer submits bundle offer with SP applied.
2. Seller opens Offers tab / Trade List.

**Expected Result:**
- The offer card shows a green "Includes points redemption" tag.
- An offer WITHOUT points does NOT show this tag.

### TRD-TC-T11 · Wallet ledger on completion (buyer debited at offer, seller credited + bonus at completion)

**Ref:** FLOW-11
**Actors:** test-buyer + test-seller

**Steps:**
1. Buyer submits offer with 10 SP applied.
2. Seller accepts the offer (trade → in_progress).
3. Complete the trade (buyer confirms receipt → status = completed).
4. Check both parties' SP wallets and sp_ledger.

**Expected Result:**
- At OFFER time (reservation): buyer available_balance decreased by 10, reserved_sp increased by 10; `sp_ledger` gets the buyer `spend_purchase` entry (-10).
- At ACCEPTANCE: no SP movement — buyer SP stays in reserved_sp; seller wallet unchanged.
- At COMPLETION (`fn_release_all_sp_on_complete`, D-17): buyer reserved_sp decreased by 10; seller pending_balance increased by 10 + platform bonus; `sp_ledger` gets the seller `earn_reward` entry (10 + bonus).
- `trades.sp_transferred_at` is set at completion (the single SP release event).
- DEV-TASK-76 doc sync 2026-08-31: SP transfers at COMPLETION, not acceptance — matches `docx/TRADING-FLOW-V2.md` D-17 and the app.

### TRD-TC-T12 · No ledger transaction on offer decline

**Ref:** FLOW-11
**Actors:** test-buyer + test-seller

**Steps:**
1. Buyer submits offer with 10 SP applied.
2. Seller declines the offer.

**Expected Result:**
- No new sp_ledger entries for seller (no earn).
- Buyer's reserved SP is released (via existing cancel flow).
- `trades.sp_transferred_at` remains NULL.

### TRD-TC-T13 · Regression: single-item (non-bundle) SP flow still works

**Ref:** FLOW-08
**Actors:** test-buyer + test-seller

**Steps:**
1. Use TradeOfferScreen (single item, not cart) to submit an offer with SP.
2. Complete the full flow: submit → seller accepts → buyer confirms.

**Expected Result:**
- All existing SP behavior unchanged: SP reserved on offer, transferred at completion (or acceptance), no errors.

### TRD-TC-T14 · Regression: bundle CTA, different-seller modal, "more from this seller" still functional

**Ref:** FLOW-08 · SELLER-GROUP
**Actors:** test-buyer

**Steps:**
1. Add 2+ items from same seller → bundle CTA appears.
2. Add item from different seller → different-seller modal.
3. Visit ItemDetailScreen for seller with 2+ listings → "More from this seller" CTA.

**Expected Result:**
- All flows function exactly as before. No regression from points-redemption changes.

---


## Group X — Navigation Consistency & Bottom Nav

> **Merged from root copy (2026-07-30).** Originally numbered TRD-TC-S01–S15 in the root file; re-lettered to TRD-TC-X01–X15 to avoid collision with Group S (Seller Group & Bundle Discovery). Root TRD-TC-S16–S26 ("More from seller") are NOT ported — they duplicate misc TRD-TC-S14–S24.

### TRD-TC-X01 · Bottom nav renders identically on Home (Dashboard)

**Steps:**
1. Log in and land on the Home / Dashboard screen.
2. Observe the bottom nav bar.

**Expected Result:**
- 5 items visible: Home (highlighted), Discover, orange Sell FAB, Trades, Basket.
- Home icon is `House` (fill variant, green `#5DBB8E`).
- Labels read "Home", "Discover", "Trades", "Basket" — the basket tab uses the short form **"Basket"** (intentional product behavior per Dev Task 75; the full "Trade Basket" name is used on the Cart screen title and in-app copy, never the tab bar).
- TestIDs: `tab-home`, `tab-discover`, `tab-sell`, `tab-trades`, `tab-trade-basket`.

---

### TRD-TC-X02 · Bottom nav renders identically on Discover

**Steps:**
1. From Home, tap the **Discover** tab.
2. Observe the bottom nav bar.

**Expected Result:**
- Same 5 items, same styling.
- Discover icon is active (green).
- No "Cart shortcut" icon in the search header area (removed — replaced by the persistent Trade Basket tab).

---

### TRD-TC-X03 · Bottom nav renders identically on Trades

**Steps:**
1. Tap the **Trades** tab.
2. Observe the bottom nav bar.

**Expected Result:**
- Same 5 items, same styling.
- Trades icon is active (green).

---

### TRD-TC-X04 · Bottom nav renders identically on Trade Basket

**Steps:**
1. Tap the **Trade Basket** tab.
2. Observe the bottom nav bar.

**Expected Result:**
- Same 5 items, same styling.
- Trade Basket icon is active (green).

---

### TRD-TC-X05 · Bottom nav renders identically on Item Detail (stacked screen)

**Steps:**
1. From Discover, tap any listing to open Item Detail (stacked screen).
2. Observe the bottom nav bar.

**Expected Result:**
- Bottom nav is still visible with the same 5 items.
- The tab that the detail screen was pushed from (Discover) remains highlighted.
- No duplicate or missing items.

---

### TRD-TC-X06 · Bottom nav renders on Cart Checkout (stacked screen)

**Steps:**
1. Add items to cart and navigate to Cart Checkout.
2. Observe the bottom nav bar.

**Expected Result:**
- Bottom nav is still visible.
- Cart icon remains highlighted.
- Bar matches exactly the Home/Discover/Inbox styling.

---

### TRD-TC-X07 · Bottom nav renders on Trade screens (Timeline, Offer, Success)

**Steps:**
1. Navigate to any trade screen (Timeline, Offer, Review, Success, Dispute).
2. Observe the bottom nav bar at each screen.

**Expected Result:**
- Bottom nav is visible on every trade screen.
- The tab bar matches exactly (same icons, colors, FAB).

---

### TRD-TC-X08 · Bottom nav renders on Profile, Settings, Wallet, Subscriptions

**Steps:**
1. From Home header avatar, tap to open **Profile**.
2. Navigate to **Settings**, **SP Wallet**, **Subscription**, **My Listings**.
3. At each screen, observe the bottom nav.

**Expected Result:**
- Bottom nav is visible on every screen.
- Bar never changes or disappears regardless of how deep the user navigates.

---

### TRD-TC-X09 · Cart badge shows item count from multiple entry points

**Steps:**
1. Start with an empty cart. Verify Cart tab has **no badge**.
2. From Item Detail, tap **Add to Cart** (or use `rpc_cart_add_item` via another listing).
3. Immediately observe the Cart tab badge on the bottom nav.

**Expected Result:**
- Cart badge appears with the correct live item count.
- Badge is red (`#E85D75`), pill-shaped, font weight 700, white text.
- Badge updates in real time (no pull-to-refresh needed).

---

### TRD-TC-X10 · Cart badge count accuracy — add multiple items

**Steps:**
1. Add 3 different items from the same seller to the cart.
2. Observe the Cart tab badge.

**Expected Result:**
- Badge shows `3`.

---

### TRD-TC-X11 · Cart badge count accuracy — remove items

**Steps:**
1. From Cart screen, remove 1 item.
2. Go back to Discover/Home and observe the Cart tab badge.

**Expected Result:**
- Badge count decreases from 3 to 2 without manual refresh.

---

### TRD-TC-X12 · Cart badge clears when cart is emptied

**Steps:**
1. Clear the cart (remove all items or use Clear Cart).
2. Navigate to any screen and observe the Cart tab badge.

**Expected Result:**
- No badge (count = 0). Cart icon shows regular (unfilled) weight.

---

### TRD-TC-X13 · "Me" tab removal — Profile still accessible via Home avatar

**Steps:**
1. Verify there is NO "Me" tab in the bottom nav bar.
2. Tabs are: Home, Discover, Sell FAB, Inbox, Cart.
3. Tap the Home header avatar (left side of greeting) or the User icon (right side).
4. Confirm navigation opens **ProfileScreen**.

**Expected Result:**
- "Me" tab is absent from bottom nav.
- Profile screen still opens from Home header avatar/icon — no route is orphaned.

---

### TRD-TC-X14 · "Me" tab removal — no orphaned routes

**Steps:**
1. Search the codebase for references to `MeTab` or `tab-me` route strings.
2. Verify no code tries to navigate to `MeTab`.

**Expected Result:**
- `MeTab` and `tab-me` are fully removed from the app.
- No red screen, no console error, no broken deep link surfaces.

---

### TRD-TC-X15 · Sell FAB opens action sheet on every screen

**Steps:**
1. From Home, tap the orange Sell FAB → action sheet opens with "List One Item" and "Bulk Upload".
2. Dismiss, navigate to Discover, tap Sell FAB again → same sheet.
3. Navigate to Item Detail, Cart, Inbox — repeat.

**Expected Result:**
- Sell FAB works identically on every screen. Action sheet always shows both options.
- "List One Item" navigates to `ItemCreate`. "Bulk Upload" navigates to `BulkListingCreate`.

---

### TRD-TC-X16 · flow-registry.md entries updated

**Steps:**
1. Open `docs/flow-registry.md`.
2. Verify FLOW-00 and FLOW-07 entries reference the persistent bottom nav.

**Expected Result:**
- FLOW-00 (Infrastructure) smoke includes "bottom nav renders identically on 100% of screens".
- FLOW-07 (Cart) smoke references the persistent Cart tab badge.

---


## Group U — Top Nav Header Pattern Consistency

**Ref:** AppHeader.tsx (variant: 'main' | 'tab' | 'detail'), ScreenLayout.tsx, Prompt #1B — Top Nav Consolidation

### TRD-TC-U01 · Root/tab screens use pattern 1 (no back button, greeting/avatar or title, notification bell)

**Screens under test:** Home (Dashboard), Discover, Trades, Trade Basket

**Steps:**
1. Log in as a subscriber at test-buyer@kidsmarketplace.test.
2. Navigate to each root tab screen: Home, Discover, Trades, Trade Basket.
3. For each screen, inspect the top header area.

**Expected Result for Home:**
- Left: Avatar + greeting ("Good morning/afternoon/evening, [Name]").
- Right: Notification bell (with unread badge count) + Profile icon.
- No back button is visible.
- Tapping the bell navigates to the Notifications screen.
- Tapping the avatar or Profile icon navigates to Profile.

**Expected Result for Discover, Trades, Trade Basket:**
- Left: Empty spacer (same 40px circle as back button position on detail screens) — no back button.
- Center: Screen title ("Discover", "Trades", "Trade Basket").
- Right: Notification bell (with unread badge count).
- Tapping the bell navigates to the Notifications screen on every screen.
- Bell icon, size, and badge style are identical across all three screens.

---

### TRD-TC-U02 · Secondary/detail screens use pattern 2 (back button + title + notification bell)

**Screens under test (sample — test 5 that cover different areas):**

| Screen | How to reach |
|---|---|
| Item Detail | Tap any listing from Discover or Home |
| Profile | Tap avatar on Home header |
| Swap Points | Profile → Swap Points |
| My Trades | Trades from Home or Profile |
| Create Listing | Sell FAB → List One Item |
| Edit Profile | Profile → Edit |

**Steps:**
1. Navigate to each screen in the table above.
2. For each screen, inspect the top header area AND the back control (per-screen back-button check — do NOT sample).

**Expected Result (all screens):**
- Left: ← Back button (40px round, gray `#F4F4F4` background, centered CaretLeft icon).
- Center: Screen title (bold, 17px, centered).
- Right: Notification bell (same icon, size, badge logic as root screens).
- Tapping the back button navigates to the previous screen.
- Tapping the bell navigates to Notifications.

**Per-screen back-button criteria (check EVERY secondary/detail screen):**
- Back icon: `CaretLeft`, **24px, `#1A1A1A`, weight `regular`**, **icon-only (NO "Back"/"< Back" text label)**.
- Touch target: **40×40 round `#F4F4F4`** with `hitSlop` ≥8 (effective ≥44×44); `accessibilityRole="button"`, label "Go back", `testID="back-button"`.
- **A back control using the primary green `#5DBB8E`, a non-standard size/weight, a visible text label, no gray circle, no hitSlop/accessibility props, or a stacked (non-header-bar) position is a DEVIATION.** (Real miss: Edit Profile kept a hand-rolled green "← Back" header; fixed 2026-08-26 to the canonical header.)

---

### TRD-TC-U03 · Notification bell behavior + badge accuracy

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

### TRD-TC-U04 · Screens without ScreenLayout still have working headers

**Screens under test:** EditListing, SubmitReview, Edit Profile

**Steps:**
1. Log in as test-seller.
2. Navigate to My Listings → tap an existing listing → tap Edit.
3. Verify EditListingScreen shows a consistent detail header (back button + "Edit Listing" title + bell).
4. Complete a trade as test-buyer → navigate to the review prompt.
5. Verify SubmitReviewScreen shows a consistent detail header (back button + "Review [name]" title + bell).
6. Log in as test-buyer → Profile → Edit → verify Edit Profile shows the canonical detail header (back button + "Edit Profile" title + bell).

**Expected Result:**
- All three screens use ScreenLayout (not bare View or native navigation header).
- Header matches variant="detail" pattern exactly: back button (left) + title (center) + bell (right).
- Back button satisfies the per-screen criteria in TRD-TC-U02 (40×40 round `#F4F4F4`, `CaretLeft` 24px `#1A1A1A` regular, icon-only, hitSlop, "Go back", `back-button` testID) — a green/undersized/labeled/stacked back control is a deviation.
- Back button navigates to the previous screen.
- Bell navigates to Notifications.

---

### TRD-TC-U05 · Checkout/payment screens intentionally hide the bell (DEFERRED-DECISION)

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

> **Merged from root copy (2026-07-30).**

## Group V — Copy Rename Verification

> This group covers the "Cart → Trade Basket" and "Bundle → (removed)" copy rename. These tests verify that every instance of "Cart" in user-facing UI copy has been replaced with "Trade Basket", every instance of "Bundle" in user-facing copy has been removed or rephrased, and functional behavior is unaffected.
>
> **Note:** These are visual/text-only tests (no DB migration, no API change). If a test passes for one device (e.g., iOS Simulator), it is safe to assume the same result on the other, unless the text is in a native component that might render differently.

### TRD-TC-V01 · "Basket" (short form) appears in bottom tab bar

**Actors:** Any logged-in user (test-buyer)

**Objective:** Verify the bottom tab bar shows the accepted short label **"Basket"** — this is intentional product behavior (Dev Task 75): the tab bar uses the short form, while the full name **"Trade Basket"** is reserved for the screen header title and all in-app copy (alerts, buttons, empty state). This is NOT a "Cart" leak and NOT a defect.

**Steps:**
1. Log in and observe the bottom navigation bar (`PersistentTabBar`).
2. Look at the tab that previously said "Cart" — the basket tab.

**Expected Result:**
- The tab label reads **Basket** (short form, intentional — NOT "Trade Basket").
- The ShoppingCart icon is unchanged.
- Tapping the tab navigates to the Cart/Trade Basket screen whose **header title reads "Trade Basket"** (functionally unchanged).
- All other in-app surfaces (screen title, alerts, buttons, empty state) continue to use the full **"Trade Basket"** wording per TRD-TC-V02–V09.

### TRD-TC-V02 · "Trade Basket" appears as screen title on Cart screen

**Actors:** test-buyer

**Precondition:** Cart screen is accessible.

**Objective:** Verify the Cart screen title shows "Trade Basket".

**Steps:**
1. Navigate to the Cart/Trade Basket screen.
2. Observe the screen header/title.

**Expected Result:**
- The screen title reads **Trade Basket** (not "My Cart").
- The layout and items display identically to before the rename.

### TRD-TC-V03 · Empty state shows "trade basket" in copy

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

### TRD-TC-V04 · "View Trade Basket" button on Item Detail screen

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

### TRD-TC-V05 · "Add to Trade Basket" button on More from This Seller screen

**Actors:** test-buyer

**Precondition:** A seller has 2+ items; buyer has items from that seller in the Trade Basket.

**Objective:** Verify the "More from This Seller" screen uses "Trade Basket" copy.

**Steps:**
1. Navigate to a seller's "More from this seller" screen.
2. Observe the action button on items not yet in the Trade Basket.

**Expected Result:**
- The button reads **Add to Trade Basket** (not "Add to Cart").
- Tapping it adds the item and shows the "Added to Trade Basket" alert.

### TRD-TC-V06 · "In Trade Basket" status on More from This Seller items already in basket

**Actors:** test-buyer

**Objective:** Verify items already in the basket show the correct status label.

**Steps:**
1. Add an item to the Trade Basket.
2. Navigate to "More from This Seller" for that item's seller.
3. Find that item in the list.

**Expected Result:**
- The action button for items already in the basket reads **In Trade Basket** (not "In Cart").
- The button is disabled (not tappable) and visually dimmed.

### TRD-TC-V07 · "Added to Trade Basket" alert on item add

**Actors:** test-buyer

**Objective:** Verify the add-to-basket success alert uses "Trade Basket" copy.

**Steps:**
1. Add any available item to the Trade Basket from Item Detail, Favorites, or More from This Seller.

**Expected Result:**
- The alert title reads **"Added to Trade Basket"**.
- The alert body reads **"Item added to your Trade Basket."** (or similar, always using "Trade Basket").
- Tapping OK dismisses the alert and the item appears in the basket.

### TRD-TC-V08 · "Matches Your Trade Basket" badge on matching items

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

### TRD-TC-V09 · Different-seller modal references "trade basket"

**Actors:** test-buyer

**Precondition:** Buyer has items from one seller in the Trade Basket.

**Objective:** Verify the different-seller conflict modal uses "trade basket" language.

**Steps:**
1. Attempt to add an item from a different seller.
2. Observe the modal that appears.

**Expected Result:**
- The modal body reads: **"Your trade basket already has items from a different seller. Adding this item will clear your current trade basket."**
- The three action buttons (Cancel, Save & Start New Cart, Replace Cart) are functionally unchanged and use the same labels.

### TRD-TC-V10 · Bundle CTA says "Make one offer" (no "Bundle" visible)

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

### TRD-TC-V11 · "Combined Offer" banner on checkout (no "Bundle" visible)

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

### TRD-TC-V12 · Bundle Builder screen title shows "Build Offer" (no "Bundle" visible)

**Actors:** test-buyer

**Objective:** Verify the Bundle Builder screen title uses "Build Offer".

**Steps:**
1. Navigate to the Bundle Builder screen (from Cart/Trade Basket).
2. Observe the screen header/title.

**Expected Result:**
- The screen title reads **"Build Offer"** (not "Bundle").
- The word "Bundle" does not appear anywhere on the screen's visible copy.
- All functionality (item selection, price display, Add to Basket) works identically.

### TRD-TC-V13 · Favorites "Added to Trade Basket" alert copy

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

### TRD-TC-V14 · Functional behavior unchanged (adding items, submitting offers still works)

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

> **Merged from root copy (2026-07-30).**

## Group W — Admin Bundle Trade Views

### TRD-TC-W01 · Trades page has "Single Trades" and "Bundle Trades" tabs

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

### TRD-TC-W02 · Single Trades tab shows only non-bundle trades

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

### TRD-TC-W03 · Bundle Trades tab groups trades by bundle_id

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

### TRD-TC-W04 · Bundle row shows item count, total amounts, buyer/seller, statuses

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

### TRD-TC-W05 · Clicking a bundle row navigates to bundle detail page

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the "View Bundle" link navigates to the bundle detail page.

**Steps:**
1. In **Bundle Trades** view, tap the **"View Bundle"** link on any bundle row.

**Expected Result:**
- Navigates to `/trades/bundles/{bundleId}`.
- The page title shows "Bundle Details" with the full Bundle ID.

---

### TRD-TC-W06 · Bundle detail page lists all trades in the bundle

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify all trades in the bundle are listed as individual cards.

**Steps:**
1. Navigate to a bundle detail page (from TRD-TC-W05).
2. Scroll down to the **"Trades in this Bundle"** section.

**Expected Result:**
- Each trade in the bundle shows as a separate card.
- Each card shows: trade ID (truncated), status badge, item title, price, condition.
- Each card has a "View Details →" link to the individual trade detail page.

---

### TRD-TC-W07 · Bundle detail page shows monetary breakdown

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

### TRD-TC-W08 · Each trade row links to individual trade detail

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the admin can drill into individual trades from the bundle detail.

**Steps:**
1. On the bundle detail page, tap **"View Details →"** on any trade card.

**Expected Result:**
- Navigates to `/trades/{tradeId}`.
- Shows the full single-trade detail page with monetary breakdown, item details, audit trail, and actions.

---

### TRD-TC-W09 · Bundle detail page has "Force Cancel Entire Bundle" action

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

### TRD-TC-W10 · Force Cancel succeeds for all trades in the bundle

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

### TRD-TC-W11 · Status filter works in Bundle Trades view

**Ref:** ADMIN-V2-010
**Actors:** Admin user

**Objective:** Verify the status filter still works in the Bundle Trades view.

**Steps:**
1. In the **Bundle Trades** view, select a status from the dropdown (e.g., "completed").

**Expected Result:**
- The page filters to show only bundles containing trades with that status.
- Note: Since bundles can have mixed statuses, a bundle is included if any of its trades match the filter.

---

### TRD-TC-W12 · Tab toggle resets filters when switching views

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

> **Merged from root copy (2026-07-30).**

---

## Group Y — Trade List & Timeline

### TRD-TC-Y01 · Trade List summary filter chips

**Ref:** TradeListScreen
**Actors:** test-buyer

**Objective:** Verify the summary chips tap-to-filter and toggle behavior.

**Steps:**
1. Open **My Trades** (Trade List) and observe the summary chips.
2. Tap **Your Offers**, then **In Progress**, then **Needs Action**, then **Completed**.
3. Tap the active chip again.

**Expected Result:**
- Chips: **Your Offers** · **In Progress** · **Needs Action** · **Completed**.
- Tapping a chip filters the list to that subset; tapping the active chip resets the filter to **All**.
- Empty filtered results show the matching empty-state copy (e.g., `You haven't sent any offers yet. Browse items and make an offer to get started.`).

**Locator hints:**
- Screen: `src/screens/trade/TradeListScreen.tsx` (instrumented 2026-08-15).
- Summary chips → `trade-summary-your-offers` · `trade-summary-in-progress` · `trade-summary-needs-action` · `trade-summary-completed`.

### TRD-TC-Y02 · Trade List Load More history pagination

**Ref:** TradeListScreen
**Actors:** test-buyer (with >10 completed trades)

**Objective:** Verify history pagination.

**Steps:**
1. Open **My Trades → History** with more than 10 history rows.
2. Tap **Load More** at the bottom.

**Expected Result:**
- The history list grows by 10 per tap (page size 10).
- When all rows are loaded, **Load More** disappears and `You're all caught up` shows.

**Locator hints:**
- History tab → `tab-history` · Load More → `history-load-more` · history row → `trade-history-row-<id>`.

### TRD-TC-Y03 · Trade List Message button on rows

**Ref:** TradeListScreen
**Actors:** test-buyer

**Objective:** Verify the row-level Message button opens chat for the trade.

**Steps:**
1. On a trade row, tap **Message**.

**Expected Result:**
- Opens the **Chat** screen for that trade (route `Chat` with `tradeId`).

**Locator hints:**
- Trade row → `trade-row-<id>` · Message → `trade-row-<id>-message` · View Trade → `trade-row-<id>-view`.

### TRD-TC-Y04 · Trade List "See all →" link

**Ref:** TradeListScreen
**Actors:** test-buyer

**Objective:** Verify the "See all →" link in the Recently Completed section.

**Steps:**
1. In the **RECENTLY COMPLETED** section, tap **See all →**.

**Expected Result:**
- Switches to the **History** tab showing the full completed/cancelled list.

**Locator hints:**
- See all → `trade-see-all` (Recently Completed header) · History tab → `tab-history`.

### TRD-TC-Y05 · R15 — Request More Time (requester)

**Ref:** TradeTimelineScreen · `requestTradeExtension`
**Actors:** test-buyer

**Objective:** Verify the trade-extension request card and sent state.

**Steps:**
1. On an in-progress trade's timeline with no extension used, observe the card and tap **Request More Time**.

**Expected Result:**
- Card **Need more time?** reads `You can request one extension to extend the pickup window. The other party must accept within 4 hours, or the trade is cancelled.`
- After requesting, the card becomes **Extension request sent** with `Waiting for the other party to respond. If they don't answer within {countdown}, the request expires and the trade is cancelled.`

### TRD-TC-Y06 · R15 — counterparty Accept

**Ref:** TradeTimelineScreen · `respondToExtension('accept')`
**Actors:** test-seller

**Objective:** Verify the counterparty accept path.

**Steps:**
1. As the counterparty of an extension request, open the timeline.
2. Tap **Accept**.

**Expected Result:**
- The card reads **Extension request** with `The other party asked for more time to complete this trade. Respond within {countdown}, or the trade is cancelled.`
- After accepting, the card shows the granted state (see TRD-TC-Y08).

### TRD-TC-Y07 · R15 — counterparty Decline

**Ref:** TradeTimelineScreen · `respondToExtension('decline')`
**Actors:** test-seller

**Objective:** Verify the counterparty decline path.

**Steps:**
1. As the counterparty of an extension request, tap **Decline**.

**Expected Result:**
- The extension is declined; the request card clears and the trade continues under its original deadline (per the extension rules).

### TRD-TC-Y08 · R15 — granted state

**Ref:** TradeTimelineScreen
**Actors:** test-buyer, test-seller

**Objective:** Verify the granted extension state.

**Steps:**
1. After the counterparty accepts, open the timeline.

**Expected Result:**
- Card **Pickup window extended** reads `You now have until {date} to complete the trade.`

### TRD-TC-Y09 · "What to do next" card + "Got it" toggle

**Ref:** TradeTimelineScreen
**Actors:** test-buyer, test-seller

**Objective:** Verify the next-steps card, its "Got it" dismiss, and the collapsed toggle.

**Steps:**
1. On an in-progress trade with an auto-complete deadline, observe the **What to do next** card.
2. Tap **Got it**.
3. Tap the collapsed **What to do next** toggle.

**Expected Result:**
- Buyer sees steps 1 `Message the seller` / 2 `Meet up and inspect the item` / 3 `Come back and tap "I Got It"`; seller sees 1 `Message the buyer` / 2 `Hand off the item` / 3 `Wait for buyer confirmation`.
- **Got it** collapses the card to the **What to do next** toggle; tapping the toggle re-expands it.

---

## Regression checks (run after any change to trade screens)

### TRD-TC-R01 · Value stack totals correct

**Objective:** Verify the value stack math is correct for a $25 item + 5 SP.
**Steps:**
1. Open the offer screen for a $25 item and enter 5 SP (subscriber) or view as free user.
**Expected Result:**
- Subscriber total cash is $19.01; free-user total cash is $22.01.

### TRD-TC-R02 · Buyer cancel shows no consequence

**Objective:** Verify cancelling a pending trade as buyer never shows a consequence level.
**Steps:**
1. Cancel a pending trade as the buyer.
**Expected Result:**
- A generic cancellation message appears with no Level 1/2/3 text.

### TRD-TC-R03 · Single (non-bundle) completion has no Confirm All

**Objective:** Verify completing a non-bundle trade does not show the bundle dialog.
**Steps:**
1. Complete a non-bundle trade as the buyer.
**Expected Result:**
- The trade completes directly with no "Confirm All" prompt.

### TRD-TC-R04 · Seller cancel button hidden on completed trade

**Objective:** Verify the seller cancel button is conditional on status.
**Steps:**
1. Open a completed trade as the seller.
**Expected Result:**
- No seller cancel button is shown.

### TRD-TC-R05 · Disputed trade not auto-completed

**Objective:** Verify a disputed trade is skipped by auto-complete.
**Steps:**
1. With a reported dispute open, allow the auto-complete window to pass.
**Expected Result:**
- The trade remains In Progress and is not completed.

### TRD-TC-R06 · Disputed trade does not release SP

**Objective:** Verify SP is not released while a dispute is open.
**Steps:**
1. With a reported dispute open, allow the SP-release window to pass.
**Expected Result:**
- No SP is released to the seller while the dispute is open.

### TRD-TC-R07 · SP reserved before seller sees offer

**Objective:** Verify SP is reserved immediately on offer submission.
**Steps:**
1. Submit an SP offer and check the buyer wallet before the seller opens the offer.
**Expected Result:**
- The reserved SP is already reflected in the buyer's wallet.

### TRD-TC-R08 · Free buyer SP gating

**Objective:** Verify free buyers see the SP lock but can still request to buy.
**Steps:**
1. Open an Accept SP item as a free buyer.
**Expected Result:**
- [Use SP 🔒] chip shows a lock icon; [Request to Buy] has no lock.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Core happy path — cash only full flow (S1) | TRD-TC-A01 |
| Core happy path — SP full flow (S5) | TRD-TC-A02 |
| Seller declines offer (S2) | TRD-TC-B01 |
| Offer expiry + seller ignore prompt (S3) | TRD-TC-B02 |
| Multiple competing offers — sort + auto-decline (S6) | TRD-TC-B03 |
| Buyer cancel pending — no consequence | TRD-TC-B04 |
| Per-seller cap: max 3 pending offers per seller | TRD-TC-B05 |
| Per-seller cap: cross-seller offers unaffected | TRD-TC-B05a |
| Per-seller cap: blocked at 4th to same seller | TRD-TC-B05b |
| Per-seller cap: bundle = 1 slot | TRD-TC-B05c |
| Per-seller cap: expiry frees slot | TRD-TC-B05d |
| Regression: no leftover global cap | TRD-TC-B05e |
| Admin config: change cap 3→5 | TRD-TC-B05f |
| Admin config: revert cap 5→3 | TRD-TC-B05g |
| Admin config: validation 1-10 | TRD-TC-B05h |
| Config fetch failure: graceful | TRD-TC-B05i |
| Regression: per-seller + bundle with non-default cap | TRD-TC-B05j |
| Card declined at submission | TRD-TC-B06 |
| SP reserved on offer submit | TRD-TC-C01 |
| SP restored on seller decline | TRD-TC-C02 |
| SP restored on offer expiry | TRD-TC-C03 |
| SP stays reserved when seller accepts | TRD-TC-C04 |
| SP released to seller at completion | TRD-TC-C05 |
| SP restored on seller cancel in_progress | TRD-TC-C06 |
| Free user — locked Use SP + upgrade modal (S9) | TRD-TC-C07 |
| SP entry capped by category cap (FR-SP-003) | TRD-TC-C08 |
| Auto-complete fires when buyer inactive (S7) | TRD-TC-D01 |
| Auto-complete skipped when dispute open (§6.2.4) | TRD-TC-D02 |
| Offer countdown pill color states (§8.1) | TRD-TC-D03 |
| Auto-complete banner buyer-only (§8.2) | TRD-TC-D04 |
| Post-meetup nudge after auto-complete | TRD-TC-D05 |
| Buyer opens dispute modal (S10, §6.2.3) | TRD-TC-E01 |
| Dispute blocks auto-complete + SP + payout (§6.2.4) | TRD-TC-E02 |
| Buyer UI during dispute (§11.4) | TRD-TC-E03 |
| Seller UI during dispute (§11.4) | TRD-TC-E04 |
| Admin resolves → Complete (§6.2.2) | TRD-TC-E05 |
| Admin resolves → Refund (§6.2.2) | TRD-TC-E06 |
| Payout shown on clean completion (§6.3.1) | TRD-TC-F01 |
| Payout held during dispute (§6.3.1) | TRD-TC-F02 |
| Payout needs action — no payout method (§6.3.3) | TRD-TC-F03 |
| Offer expiry reminders to seller (§9.2) | TRD-TC-G01 |
| Auto-complete reminders to buyer (§9.2) | TRD-TC-G02 |
| Notification throttle per trade (§9.5) | TRD-TC-G03 |
| Push notifications deep-link correctly (§9.5) | TRD-TC-G04 |
| Free buyer CTA on completion (§12) | TRD-TC-H01 |
| Subscriber buyer used SP — saved message (§12) | TRD-TC-H02 |
| Subscriber seller Accept SP — SP pending notice (§12) | TRD-TC-H03 |
| Subscriber seller Cash Only — upsell CTA (§12) | TRD-TC-H04 |
| Subscription lifecycle — trial / paid / cancel (FR-UM-004, SUB-002/008/009) | TRD-TC-H05 |
| Safe meetup card on in_progress (§11.5) | TRD-TC-I01 |
| Safe meetup card dismissible per trade (§11.5) | TRD-TC-I02 |
| In-chat safety banner persistent (V1-3) | TRD-TC-I03 |
| Pre-first-message safety modal once per listing (V1-5) | TRD-TC-I04 |
| Chat quick-reply chips on in_progress (§11.6) | TRD-TC-I05 |
| Seller cancel Level 1 alert (§11.7) | TRD-TC-J01 |
| Seller cancel Level 2 alert (§11.7) | TRD-TC-J02 |
| Seller cancel Level 3 + admin flag (§11.7) | TRD-TC-J03 |
| Seller cancel button visibility | TRD-TC-J04 |
| Seller cancel modal seller-specific reasons | TRD-TC-J05 |
| Value stack $1.49 subscriber fee | TRD-TC-K01 |
| Value stack tiered non-subscriber fee | TRD-TC-K02 |
| SP discount row conditional | TRD-TC-K03 |
| Seller fee 5% × cash portion (SP trade) | TRD-TC-K11 |
| Bundle banner on trade detail | TRD-TC-L01 |
| Confirm All shortcut for bundle | TRD-TC-L02 |
| Bundle offer rows in Offers tab | TRD-TC-L03 |
| Non-bundle offers single rows | TRD-TC-L04 |
| In-progress bundles in Buying tab | TRD-TC-L05 |
| Bundle banner in Review Offer screen | TRD-TC-L06 |
| Accept All N Items button | TRD-TC-L07 |
| Individual accept/decline alongside bundle | TRD-TC-L08 |
| Bundle card in Your Offers (buyer) | TRD-TC-L09 |
| Cart — add first item creates active cart | TRD-TC-M01 |
| Cart — add second item from same seller | TRD-TC-M02 |
| Cart — different-seller choice modal | TRD-TC-M03 |
| Cart — Replace Cart | TRD-TC-M04 |
| Cart — cannot add own item | TRD-TC-M05 |
| Cart — cannot add unavailable / out-of-node item | TRD-TC-M06 |
| Cart — duplicate item prevented | TRD-TC-M07 |
| Cart — remove item | TRD-TC-M08 |
| Cart — clear cart | TRD-TC-M09 |
| Cart — saved carts max 3 + LRU + switch | TRD-TC-M10 |
| Cart — minimum cart value warning + blocked checkout | TRD-TC-M11 |
| Cart — max SP available per item (subscriber) | TRD-TC-M12 |
| Cart — realtime item unavailable + 24h auto-remove | TRD-TC-M13 |
| Favorites — add / remove, no duplicate | TRD-TC-M14 |
| Favorites — availability status + empty state | TRD-TC-M15 |
| Admin — minimum cart value config reflects in app | TRD-TC-N01 |
| Admin — minimum cart value validation | TRD-TC-N02 |
| Admin — Minimum Listing Price config on Fees tab | TRD-TC-N03 |
| Seller — single-item listing blocked below min price | TRD-TC-N04 |
| Bulk — below-threshold items flagged, valid items publish | TRD-TC-N05 |
| Listing — auto-paused when threshold raised above price | TRD-TC-N06 |
| Listing — repurchasable after seller raises to meet threshold | TRD-TC-N07 |
| Regression — single-item + bundle checkout at/above threshold | TRD-TC-N08 |
| Tax — checkout breakdown shows sales tax (0 SP) | TRD-TC-O01 |
| Tax — base = full item price (SP does not reduce tax) | TRD-TC-O02, TRD-TC-K01 |
| Tax — $0 when disabled globally | TRD-TC-O03 |
| Tax — $0 when node tax disabled | TRD-TC-O04 |
| Tax — tax-exempt Tax Free badge | TRD-TC-O05 |
| Tax — transaction history tax details | TRD-TC-O06 |
| Tax — proportional refund | TRD-TC-O07 |
| Admin tax — node rate config + validation | TRD-TC-P01 |
| Admin tax — bulk update | TRD-TC-P02 |
| Admin tax — rate change history / audit | TRD-TC-P03 |
| Admin tax — global settings + warning banner | TRD-TC-P04 |
| Admin tax — reporting summary + date presets | TRD-TC-P05 |
| Admin tax — jurisdiction breakdown + 7 report types | TRD-TC-P06 |
| Admin tax — CSV export | TRD-TC-P07 |
| Admin tax — rate change applies to new transactions | TRD-TC-P08 |
| Value stack includes sales tax line | TRD-TC-K01, TRD-TC-K02 |
| Item Detail screen shows sales tax in Price Breakdown | TRD-TC-K01, TRD-TC-K02 |
| Cart Checkout order summary shows sales tax | TRD-TC-O01 |
| Trade timeline shows sales tax for buyer (in-progress preview, completed stored) | TRD-TC-O06, TRD-TC-O08 |
| Trade detail shows sales tax for buyer only | TRD-TC-O08 |
| Sales tax hidden from seller on all trade screens | TRD-TC-K01 (seller variant), TRD-TC-O08 |
| Reviews — prompt for both parties at completion (REVIEW-001/002) | TRD-TC-Q01 |
| Reviews — star rating required, submit blocked without rating (REVIEW-001) | TRD-TC-Q02 |
| Reviews — comment optional, max 500 chars (REVIEW-001) | TRD-TC-Q03 |
| Reviews — anonymous review hides reviewer identity (REVIEW-003) | TRD-TC-Q04 |
| Reviews — skip review, no blocking, no re-prompt (REVIEW-004) | TRD-TC-Q05 |
| Reviews — mutual review status on completed trade detail (REVIEW-002) | TRD-TC-Q06 |
| Reviews — reviews visible on counterparty profile (REVIEW-002) | TRD-TC-Q07 |
| Reviews — average rating and total count on profile (REVIEW-005) | TRD-TC-Q08 |
| Reviews — rating breakdown 5→1 stars on profile (REVIEW-005) | TRD-TC-Q09 |
| Reviews — edit within 24h succeeds (REVIEW-001) | TRD-TC-Q10 |
| Reviews — edit blocked after 24h (REVIEW-001) | TRD-TC-Q11 |
| Reviews — one review per trade, duplicate blocked (Anti-Brigading) | TRD-TC-Q12 |
| Reviews — 30-day same-counterparty cooldown (Anti-Brigading) | TRD-TC-Q13 |
| Reviews — 24h post-completion submission cooldown (Anti-Brigading) | TRD-TC-Q14 |
| Reviews — flag a review with reason (REVIEW-006) | TRD-TC-Q15 |
| Reviews — auto-hide after 3+ reports (REVIEW-006) | TRD-TC-Q16 |
| Reviews — cannot flag own review (REVIEW-006) | TRD-TC-Q17 |
| Reviews — admin moderation queue with counts and reasons (REVIEW-007) | TRD-TC-Q18 |
| Reviews — admin approves (unhides) reported review (REVIEW-007) | TRD-TC-Q19 |
| Reviews — admin permanently deletes reported review (REVIEW-007) | TRD-TC-Q20 |
| Refund/cancel — buyer cancels pending (FLOW-27) | TRD-TC-R01 |
| Refund/cancel — seller declines pending | TRD-TC-R02 |
| Refund/cancel — offer expiry + competing offers | TRD-TC-R03 |
| Refund/cancel — card declined no trade | TRD-TC-R04 |
| Refund/cancel — seller in_progress cancel + consequence | TRD-TC-R05 |
| Refund settlement — cash + proportional tax + fee | TRD-TC-R06 |
| Refund — SP reversal | TRD-TC-R07 |
| Refund — seller payout withheld | TRD-TC-R08 |
| Refund — admin dispute resolve Refund | TRD-TC-R09 |
| Refund — admin dispute resolve Complete (no refund) | TRD-TC-R10 |
| Refund/cancel notifications to both parties | TRD-TC-R11 |
| Refund idempotency (no double refund) | TRD-TC-R12 |
| Cancelled/refunded status + timeline | TRD-TC-R13 |
| Seller masking — modal uses generic copy (no leak) | TRD-TC-S01 |
| Seller masking — "More from this seller" icon visible (2+ listings) | TRD-TC-S02 |
| Seller masking — "More from this seller" icon hidden (1 listing) | TRD-TC-S03 |
| Seller masking — filtered page shows zero seller identity | TRD-TC-S04 |
| Seller masking — Add to Cart from filtered page | TRD-TC-S05 |
| Seller masking — "Matches Your Cart" on filtered page | TRD-TC-S06 |
| Bundle CTA — appears with 2+ same-seller items | TRD-TC-S07 |
| Bundle CTA — hidden with 0-1 items | TRD-TC-S08 |
| Bundle CTA — navigates to bundle checkout | TRD-TC-S09 |
| Bundle checkout — banner shown only on bundle path | TRD-TC-S10 |
| Regression — Discover grid clean (no badges) | TRD-TC-S11 |
| Regression — single-item flow unchanged | TRD-TC-S12 |
| Regression — seller identity unlocks only post-acceptance | TRD-TC-S13 |
| More from seller — Item Detail CTA in standalone position (below seller card) | TRD-TC-S14 |
| More from seller — Item Detail CTA hidden at 0 additional listings | TRD-TC-S15 |
| More from seller — Item Detail CTA does not disrupt "Matches Your Cart" badge | TRD-TC-S16 |
| More from seller — Trade Basket banner shows correct remaining-item count | TRD-TC-S17 |
| More from seller — Trade Basket banner recalculates after adding item from filtered page | TRD-TC-S18 |
| More from seller — Trade Basket banner disappears when all seller's listings are in basket | TRD-TC-S19 |
| More from seller — Trade Basket banner dismissible via X button | TRD-TC-S20 |
| More from seller — Banner and filtered page never reveal seller identity | TRD-TC-S21 |
| More from seller — Regression: Seller Info card unchanged (rating, Contact, View Profile) | TRD-TC-S22 |
| More from seller — Regression: Trade Basket subtotal/total/bundle CTA layout unaffected | TRD-TC-S23 |
| More from seller — Return-to-Cart navigation after adding item from filtered page | TRD-TC-S24 |

---

## Group R2 — New Implementation (Needs Testing)

> **Status:** Newly implemented 2026-08-10 (R2 — Auth-and-Capture + Countdown State Machine).
> These cases are **NOT yet executed**. They cover the new pickup-window deadline sourcing,
> 7-day admin guardrail, and pickup reminders. They are kept in their own section (not mixed
> with the tested groups) so what is already tested vs. newly implemented stays clear.

### new TRD-TC-D06 · Pickup window drives the auto-complete deadline (R2 — configurable)

**Ref:** R2 (2026-08-10) · SYSTEM_REQUIREMENTS_V2 §1.6 · /settings/trade-timing
**Actors:** test-admin + test-buyer + test-seller
**Precondition:** Migration `20260810000001_r2_auth_capture_countdown.sql` applied.

**Objective:** Verify the post-acceptance deadline is sourced from the configurable pickup window (`pickup_window_hours`), not the legacy auto-complete key.

**Steps:**
1. In the admin portal open **/settings/trade-timing**; set **Pickup Window = 48** (offer timeout stays 48 → combined 96h ≤ 167h) and Save.
2. As buyer, submit an offer; as seller, accept it.
3. Read the trade row and confirm `auto_complete_at` ≈ accept time + 48h — i.e., it tracks the configured pickup window, not the 72h default.
4. In admin, set **Pickup Window = 72**; submit + accept a new offer; confirm `auto_complete_at` ≈ accept time + 72h.
5. (Optional) Confirm the buyer sees the pickup countdown banner and pickup reminders use the configured thresholds.

**Expected Result:**
- Changing `pickup_window_hours` changes the auto-complete deadline on NEW accepted trades with no code deploy.
- SQL check: `SELECT id, status, auto_complete_at, created_at FROM trades WHERE status='in_progress' ORDER BY created_at DESC LIMIT 3;`

---

### new TRD-TC-G05 · Pickup-window reminders sent to buyer (R2)

**Ref:** R2 (2026-08-10) · SYSTEM_REQUIREMENTS_V2 §1.6
**Actors:** test-buyer
**Precondition:** An In Progress trade exists; migration `20260810000001_r2_auth_capture_countdown.sql` applied; QA can advance time to the configured thresholds (defaults 24h / 2h before the pickup/auto-complete deadline).

**Objective:** Verify the buyer receives two configurable pickup-window reminders (in-app + push) with no duplicates.

**Steps:**
1. Have an **In Progress** trade.
2. Advance to the first threshold (24h before `auto_complete_at`); check in-app + push.
3. Advance to the second threshold (2h before); check again.
4. Re-run the processor (`SELECT public.rpc_send_pickup_reminders(100);`) — confirm no duplicate rows (the `pickup_reminder_1/2_sent_at` guard).
5. (Optional) In admin, change `pickup_notif_1_hours_before` / `pickup_notif_2_hours_before` and confirm new trades remind at the new thresholds.

**Expected Result:**
- In-app + push at ~24h: "Confirm Pickup Soon — Confirm pickup for [Item] within 24 hours or the trade auto-completes."
- In-app + push at ~2h: "Pickup Deadline Soon — [Item] auto-completes in 2 hours. Complete the trade to confirm pickup."
- Reminders go to the **buyer only**; no third reminder; re-running the processor sends nothing new.

---

## Group N2 — Idempotency & Audit (Cross-Cutting)

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B (N2) · Migration `20260810000006_n2_idempotency_audit.sql`
**Scope:** Every payment / Swap Points / fee / tax transition must be retry-safe (idempotent) and audited. A retried mutation must never double-charge, double-issue SP, or double-log. All cases below are **server-side** (SQL / EF retry) — no client changes were shipped; the app is unchanged and keeps working with the new guards.
**Last added:** 2026-08-09

### new TRD-TC-N2-C01 · Retried offer submission creates exactly ONE PaymentIntent, ONE trade, ONE SP reservation, ONE audit row

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-002 / SR-N2-003 · Migration `20260810000002`
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** `create-trade-offer` deployed with the N2 Stripe idempotency key; `idx_trades_stripe_payment_intent_id` unique index present.

**Objective:** Verify a double-tap / network-retried offer submission cannot create a second PaymentIntent, a second trade, a second SP reservation, or a duplicate audit row.

**Steps:**
1. Log in as **Buyer** and submit an offer on a Cash Only item (any SP amount).
2. Immediately re-submit the **identical** offer (simulate double-tap / client retry). Note: the duplicate-active-offer guard returns "You already have an active offer" for a sequential retry; for a truly concurrent double-tap, the unique index on `stripe_payment_intent_id` dedupes.
3. Verify Stripe dashboard: exactly **one** PaymentIntent (auth hold) for this offer.
4. Run SQL to count duplicates for this buyer+listing:
```sql
-- One trade, one PI, one SP reservation ledger entry, one audit row:
SELECT count(*) AS trades FROM trades WHERE buyer_id='<buyer>' AND listing_id='<listing>' AND status IN ('pending','in_progress');
SELECT count(*) AS pi FROM trades WHERE stripe_payment_intent_id='<pi_id>';
SELECT count(*) AS sp_reserve FROM sp_ledger WHERE related_transaction_id='<trade_id>' AND transaction_type='spend_purchase';
SELECT count(*) AS audit FROM financial_audit_log WHERE entity_id='<trade_id>' AND mutation_type='offer_created';
```

**Expected Result:**
- Exactly **1** trade row, **1** PaymentIntent id attached, **1** `spend_purchase` reservation ledger entry, and **1** `offer_created` audit row per transition.
- No orphaned duplicate PaymentIntent appears in the Stripe dashboard (deduped by the deterministic Stripe idempotency key).
- The buyer is never double-charged.

---

### new TRD-TC-N2-C02 · Retried payout trigger produces exactly ONE seller_payouts row and ONE Stripe transfer

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-005
**Actors:** test-admin (or cron) + test-seller
**Precondition:** A completed, undisputed trade exists with a payout pending (`payout_status='processing'` or unset).

**Objective:** Verify calling `initiate-payout` (or the payout trigger) twice cannot create a second payout row or a second Stripe transfer.

**Steps:**
1. Complete a trade; confirm a `seller_payouts` row exists and `trades.payout_idempotency_key` is set.
2. Invoke `initiate-payout` twice for the same `trade_id` (e.g., trigger + manual retry).
3. Check counts:
```sql
SELECT count(*) FROM seller_payouts WHERE trade_id='<trade_id>';
SELECT count(*) FROM trades WHERE id='<trade_id>' AND stripe_transfer_id IS NOT NULL;
```

**Expected Result:**
- Exactly **1** `seller_payouts` row and **1** Stripe transfer (`stripe_transfer_id` set once).
- A `payout_initiated` / `payout_paid` audit row exists; re-running does not create a duplicate (keyed by `payout_<trade_id>`).

---

### new TRD-TC-N2-C03 · Retried refund / duplicate refund webhook → exactly ONE refund

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-006 · TRD-TC-R12 (refund idempotency regression)
**Actors:** test-admin + test-buyer
**Precondition:** A `completed` trade with a captured payment exists.

**Objective:** Verify a duplicate refund attempt (double-click, or a re-delivered `charge.refunded` webhook) cannot double-refund, and the audit log stays at one `refund_issued` row.

**Steps:**
1. Issue a full refund via the admin (or `cancel_trade_v2` with refund). Confirm `trades.stripe_refund_id` is set.
2. Re-deliver the same `charge.refunded` webhook (or retry the refund RPC) for the same PI.
3. Check counts:
```sql
SELECT count(*) FROM trade_refunds WHERE stripe_refund_id='<refund_id>';
SELECT count(*) FROM payments WHERE trade_id='<trade_id>' AND refunded_cents > 0;
SELECT count(*) FROM financial_audit_log WHERE idempotency_key='refund_<refund_id>';
```

**Expected Result:**
- Exactly **1** `trade_refunds` row per Stripe refund id (unique partial index blocks a duplicate).
- No double refund on the payments ledger (`refunded_cents` never exceeds charged).
- A single `refund_issued` audit row for that refund id.

---

### new TRD-TC-N2-C04 · Re-running the SP release processor cannot double-credit the seller

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-004 · TRD-TC-C05 (SP release)
**Actors:** test-seller (subscriber)
**Precondition:** A `completed` trade has `sp_earned_at_completion` set and `sp_released_at IS NULL`.

**Objective:** Verify calling `rpc_release_pending_sp` twice does not double-credit the seller's pending balance or double-log.

**Steps:**
1. Complete a trade that earned SP for the seller; note `pending_balance` and `pending_sp_release_at`.
2. Fast-forward `pending_sp_release_at` to now, then run `SELECT public.rpc_release_pending_sp(100);` **twice**.
3. Check the seller wallet and ledger:
```sql
SELECT pending_balance FROM sp_wallets WHERE user_id='<seller>';
SELECT count(*) FROM sp_ledger WHERE related_transaction_id='<trade_id>' AND transaction_type='earn_reward';
SELECT count(*) FROM financial_audit_log WHERE idempotency_key='sp_release_<trade_id>';
```

**Expected Result:**
- The seller's `pending_balance` increases by **exactly** the earned SP once (no double-credit).
- Exactly **1** `earn_reward` ledger entry and **1** `sp_released` audit row.

---

### new TRD-TC-N2-C05 · Retried SP debit / credit on cancel → no double mutation

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-004
**Actors:** test-buyer (subscriber)
**Precondition:** A trade used SP; the buyer's wallet has a balance to debit/refund.

**Objective:** Verify `debit_sp_for_trade` and `credit_sp_for_cancelled_trade` are idempotent — a retry returns the prior entry without a second wallet mutation.

**Steps:**
1. Simulate a retried debit: call `SELECT public.debit_sp_for_trade('<buyer>','<trade>',<n>);` twice. The second call must return `idempotent: true`.
2. Simulate a retried refund on cancel: call `SELECT public.credit_sp_for_cancelled_trade('<buyer>','<trade>',<n>);` twice.
3. Verify wallet balance + ledger:
```sql
SELECT available_balance, reserved_sp FROM sp_wallets WHERE user_id='<buyer>';
SELECT count(*) FROM sp_ledger WHERE idempotency_key IN ('sp_debit_<trade>','sp_refund_<trade>');
```

**Expected Result:**
- The second RPC call returns `{ success: true, idempotent: true }` and the balance changes only once.
- Exactly **1** ledger entry per key (`sp_debit_<trade>` / `sp_refund_<trade>`).

---

### new TRD-TC-N2-C06 · Admin SP adjustment double-click → single credit

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-007
**Actors:** test-admin
**Precondition:** An SP wallet exists; admin passes a stable `p_idempotency_key` (or the derived per-minute key dedupes a same-second click).

**Objective:** Verify two identical admin SP adjustments (double-click) credit the wallet once.

**Steps:**
1. As admin, adjust a wallet by **+10 SP** with an explicit `p_idempotency_key` (e.g., `admin_adj_dod_test`), then repeat the **same** call.
2. Repeat without a key twice within the same minute (tests the deterministic fallback).
3. Check:
```sql
SELECT available_balance FROM sp_wallets WHERE user_id='<user>';
SELECT count(*) FROM sp_ledger WHERE idempotency_key IN ('admin_adj_dod_test');
```

**Expected Result:**
- The wallet is credited **once** (balance +10, not +20); the second call returns `idempotent: true`.
- Exactly **1** ledger entry + **1** `sp_issued` audit row for the same key.

---

### new TRD-TC-N2-C07 · Audit completeness — every payment/SP/fee/tax transition is logged

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-001
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** N2 Edge Functions deployed (create-trade-offer, trade-payment, complete-trade, cancel-trade, transactions-update, resolve-dispute, trade-refund, stripe-webhook, process-auto-complete, initiate-payout).

**Objective:** Walk one trade end-to-end and confirm each payment/SP/fee/tax transition has a `financial_audit_log` row.

**Steps:**
1. Submit an offer with SP + tax on an Accept SP item → expect `offer_created`, `payment_intent_created`, `buyer_fee_charged`, `tax_quoted` (and `sp_reserved` via the debit path when applicable).
2. Seller accepts → confirm no new duplicate, trade moves forward.
3. Buyer completes ("I Got It") → expect `payment_captured`, `tax_collected`, `sp_released`, `seller_fee_deducted`, `trade_completed`, `payout_initiated`.
4. Audit trail check:
```sql
SELECT mutation_type, amount_cents, created_at FROM financial_audit_log
WHERE entity_id='<trade_id>' ORDER BY created_at ASC;
```

**Expected Result:**
- Each transition above appears exactly once, in chronological order, with correct `amount_cents` and actor.
- No transition is missing; no duplicate rows (idempotency keys).

---

### new TRD-TC-N2-C08 · Audit log is insert-only and admin/service-role readable only

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-001
**Actors:** test-buyer, test-admin
**Objective:** Verify `financial_audit_log` RLS — users see only their own rows (actor), admins/service role see all, and no user can UPDATE/DELETE.

**Steps:**
1. As a normal user, query `financial_audit_log` — only rows where `actor_id = your id` are visible.
2. As admin (service role), query all rows.
3. Attempt an UPDATE/DELETE on an audit row as a normal user.

**Expected Result:**
- Normal users see only their own audit rows; no INSERT/UPDATE/DELETE policies exist for `authenticated` (append-only).
- Admin/service role sees all rows (used by the admin portal + reconciliation).

---

### new TRD-TC-N2-C09 · Duplicate idempotency key → prior result, never a partial write

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-008
**Actors:** test-buyer (subscriber)
**Objective:** Verify a replayed mutation with the same idempotency key returns the prior result and leaves no partial/duplicate state.

**Steps:**
1. Call `SELECT public.fn_log_financial_audit('sp_reserved','trade','<uuid>',NULL,'{}','{}',-1,'<dup_key>',NULL);` twice.
2. Verify the second call returns `false` (insert skipped) and only one row exists for `<dup_key>`:
```sql
SELECT count(*) FROM financial_audit_log WHERE idempotency_key='<dup_key>';
```

**Expected Result:**
- First call `true`, second call `false`, exactly **1** row — no double-log, no partial write.
- The same guarantee applies to the SP RPCs (returns `idempotent: true` with the prior `ledger_entry_id`).

---

### new TRD-TC-N2-C10 · Reconciliation — payments vs trade_refunds vs financial_audit_log consistency

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B SR-N2-001/006 · TRD-TC-K09 (payments reconciliation)
**Actors:** test-admin
**Objective:** Verify the cash ledger (`payments` + `trade_refunds`), the tax ledger, and the new audit journal agree for a sampled trade.

**Steps:**
1. Pick a completed + partially-refunded trade.
2. Compare the audit journal against the payments ledger for that trade:
```sql
SELECT
  (SELECT COALESCE(SUM(amount_cents),0) FROM financial_audit_log
    WHERE entity_id='<trade>' AND mutation_type IN ('payment_captured')) AS captured_audit,
  (SELECT COALESCE(SUM(amount_cents),0) FROM financial_audit_log
    WHERE entity_id='<trade>' AND mutation_type='refund_issued') AS refunded_audit,
  (SELECT charged_cents FROM payments WHERE trade_id='<trade>') AS charged_payments,
  (SELECT refunded_cents FROM payments WHERE trade_id='<trade>') AS refunded_payments;
```

**Expected Result:**
- The audit journal's captured/refunded sums match the `payments` ledger's `charged_cents`/`refunded_cents`.
- Any mismatch is a red flag for the N2 invariant ("every transition audited, no double-charge/double-log").
