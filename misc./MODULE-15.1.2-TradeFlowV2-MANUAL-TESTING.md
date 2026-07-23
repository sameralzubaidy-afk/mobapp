# MODULE-15.1.2 TradeFlowV2 — Manual Testing Guide

**Source of truth:** `docx/TRADING-FLOW-V2.md` (v2.1, May 26 2026) · `Prompts/MODULE-15.2-cart-system.md` · `Prompts/MODULE-15.3-PART3-TAX-TASKS-RESTRUCTURED.md` · `Prompts/Done/MODULE-08-REVIEWS-RATINGS.md` · `docs/flow-registry.md` (FLOW-27)
**Tasks covered:** Core Trade Flows · Payment Authorization · SP Behavior · Dispute Flow · Payout · Countdown Timers · Notifications · Completion CTAs · Safety UX · Seller Consequences · Bundle Flows · Cart System · Sales Tax Engine · Reviews & Ratings · Refund & Cancellation State Machine · Points Redemption
**Last updated:** 2026-07-18
**Scope:** End-user manual testing via app screens + admin portal screens (no SQL / no DB access required)
**Devices:** iOS Simulator + Android Emulator · Admin portal in browser

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Core Happy Paths** | TC-A01 | Cash Only: full happy path (buyer confirms) |
| | TC-A02 | Accept SP: Use SP slider → seller accepts → buyer confirms |
| **B — Offer Lifecycle** | TC-B01 | Seller declines offer |
| | TC-B02 | Offer expires (seller never responds) + seller ignore prompt |
| | TC-B03 | Multiple competing offers — sort order + auto-decline |
| | TC-B04 | Buyer cancels pending trade — no consequence level |
| | TC-B05 | Per-seller cap: max 3 pending offers per seller (2026-07-18) |
| | TC-B05a | Per-seller cap: Buyer at 3 with Seller A can still submit to Seller B |
| | TC-B05b | Per-seller cap: Blocked at 4th offer to same seller |
| | TC-B05c | Per-seller cap: Bundle offer counts as 1 slot, not N |
| | TC-B05d | Per-seller cap: Expired offer frees slot immediately |
| | TC-B05e | Regression: No leftover global cap blocks buyer over old global limit |
| | TC-B05f | Admin config: Change offer cap from 3 to 5 on Trade Timing page |
| | TC-B05g | Admin config: Revert cap from 5 back to 3 (forward-looking only) |
| | TC-B05h | Admin config: Validation — reject invalid values (0, 11) |
| | TC-B05i | Mobile client: Config fetch failure — graceful degradation |
| | TC-B05j | Regression: Per-seller scope + bundle=1 still hold after config change |
| | TC-B06 | Card declined at offer submission |
| | TC-B07 | Expired offer timeline — no message button |
| | TC-B08 | Chat frozen after trade is cancelled or completed |
| | TC-B09 | Chat remains active for in_progress trades |
| **C — SP Behavior** | TC-C01 | SP reserved on offer submission |
| | TC-C02 | SP restored to buyer on seller decline |
| | TC-C03 | SP restored to buyer on offer expiry |
| | TC-C04 | SP stays reserved when seller accepts |
| | TC-C05 | SP released to seller at trade completion |
| | TC-C06 | SP restored to buyer on seller cancel (in_progress) |
| | TC-C07 | Free user sees locked Use SP button + upgrade modal |
| | TC-C08 | SP slider capped at 50% of item price |
| **D — Auto-Complete & Timers** | TC-D01 | Auto-complete when buyer never taps I Got It |
| | TC-D02 | Auto-complete skipped when dispute is open |
| | TC-D03 | Offer countdown pill color states |
| | TC-D04 | Auto-complete banner visible to buyer only |
| | TC-D05 | Post-meetup nudge after auto-complete |
| **E — Dispute Flow** | TC-E01 | Buyer opens Report a Problem modal |
| | TC-E02 | Disputed trade does not auto-complete |
| | TC-E03 | Buyer UI during active dispute |
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
| **K — Value Stack & Fees** | TC-K01 | Subscriber sees $0.99 fee + Sales Tax line in value stack |
| | TC-K02 | Non-subscriber sees $2.99 fee + Sales Tax line in value stack |
| | TC-K03 | SP discount row conditional on SP used |
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
| **N — Cart (Admin)** | TC-N01 | Admin sets minimum cart value → reflects in app |
| | TC-N02 | Admin minimum cart value validation |
| | TC-N03 | Admin updates Minimum Listing Price on Config → Fees tab |
| | TC-N04 | Seller cannot publish single-item listing below threshold |
| | TC-N05 | Bulk: below-threshold items flagged, valid items publish |
| | TC-N06 | Existing listing auto-paused when threshold raised above price |
| | TC-N07 | Seller raises price to meet threshold → listing repurchasable |
| | TC-N08 | Regression: single-item + bundle checkout at/above threshold |
| **O — Tax (End User)** | TC-O01 | Sales tax shown in checkout/cart breakdown (0 SP) |
| | TC-O02 | Tax recalculates on SP slider change (offer + checkout) |
| | TC-O03 | Tax $0 when globally disabled |
| | TC-O04 | Tax $0 when node tax disabled |
| | TC-O05 | Tax-exempt user sees Tax Free badge |
| | TC-O06 | Transaction history shows tax details |
| | TC-O07 | Refund shows proportional tax refunded |
| | TC-O08 | Tax shown on trade timeline/detail for buyer only |
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
| | TC-R05 | Seller cancels in_progress → refund + consequence level |
| | TC-R06 | Refund settlement breakdown (cash + proportional tax + fee) |
| **T — Points Redemption (Bundle Checkout)** | TC-T01 | Points toggle appears only on eligible items; ineligible show "Not eligible" label |
| | TC-T02 | Toggle ON applies correct amount (wallet + category cap both sufficient) |
| | TC-T03 | Toggle ON applies partial amount with "balance limit" label when wallet insufficient |
| | TC-T04 | Category cap limits applied points even when wallet covers more |
| | TC-T05 | Toggle OFF restores balance for sequential allocation |
| | TC-T06 | Running "Points remaining" counter updates accurately across multiple toggles |
| | TC-T07 | Order Summary "Points Applied" line and cash total correct after multiple toggles |
| | TC-T08 | Seller Review Offer shows per-item points breakdown |
| | TC-T09 | Seller Review Offer shows "Total Payout" and "Buyer's Total Paid" correctly |
| | TC-T10 | "Includes points redemption" tag on seller's offer list/inbox card |
| | TC-T11 | Wallet ledger: buyer debited, seller credited + bonus on acceptance |
| | TC-T12 | No ledger transaction on offer decline |
| | TC-T13 | Regression: single-item (non-bundle) offer flow with SP still works |
| | TC-T14 | Regression: bundle CTA, different-seller modal, "more from this seller" still functional |
| | TC-R07 | SP reversal on refund (reserved/transferred returned) |
| | TC-R08 | Seller payout withheld / cancelled on refund |
| | TC-R09 | Admin dispute resolve → Refund (full settlement) |
| | TC-R10 | Admin dispute resolve → Complete (no refund) |
| | TC-R11 | Refund / cancellation notifications to both parties |
| | TC-R12 | Refund idempotency — no double refund |
| | TC-R13 | Cancelled / refunded trade status + timeline |
| **S — Seller Group & Bundle Discovery** | TC-S01 | Different-seller modal uses generic copy (no seller name leak) |
| | TC-S02 | "More from this seller" icon appears only when 2+ approved listings |
| | TC-S03 | "More from this seller" icon hidden when seller has exactly 1 listing |
| | TC-S04 | Tapping icon opens "More from this seller" page — no seller identity |
| | TC-S05 | Add to Cart from filtered seller page populates cart correctly |
| | TC-S06 | "Matches Your Cart" indicator on filtered seller page |
| | TC-S07 | Bundle CTA appears on CartScreen with 2+ same-seller items |
| | TC-S08 | Bundle CTA hidden with single item or empty cart |
| | TC-S09 | Bundle CTA navigates to checkout in bundle mode |
| | TC-S10 | Bundle checkout shows "Bundle Offer" banner |
| | TC-S11 | Regression: Discover/search grid unchanged (no badges) |
| | TC-S12 | Regression: single-item offer flow unchanged |
| | TC-S13 | Regression: seller identity unlocks only post-acceptance |

---

## Pre-conditions (set up before testing)

- App is running on iOS Simulator and/or Android Emulator.
- The following test accounts exist and are confirmed (see Accounts table).
- test-seller has at least one **Cash Only** listing and one **Accept SP** listing, all available.
- test-buyer (subscriber) has a Swap Points balance of at least 15 SP.
- test-buyer and test-free have a valid saved payment card.
- For cart tests: test-seller has at least 3 available items; a second seller (test-seller-2) has at least 1 available item in the same node as test-buyer.
- For tax tests: the buyer's node has a tax rate configured (e.g., 6.35%) and sales tax is enabled globally, unless a case states otherwise. Admin portal access is available for admin-side cases.

> **Note:** Donate listings (TC-A04) are deferred to post-MVP. See `MODULE-15.1.2-TradeFlowV2-DEFERRED-MANUAL-TESTING.md`.

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

### Passed TC-A01 · Cash Only: full happy path (buyer confirms receipt) . 

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
- On the item: a "Cash Only" badge and a single **[Request to Buy]** button (no "Use SP" button).
- After submitting: a confirmation toast and the trade appears as **Pending**; the seller receives a push notification.
- The seller's offer row shows the item, cash amount, and a green countdown pill.
- After the seller accepts: both parties see the trade move to **In Progress**; buyer sees "Payment confirmed. Coordinate pickup." with an auto-complete banner ("Auto-completing in ~47h"); the seller does **not** see an [I Got It] button or the auto-complete banner.
- After the buyer confirms: the trade shows as **Completed**, a "Trade Complete!" screen appears with a [Rate Seller] button; the seller sees a "Sold!" completion screen with [Rate Buyer].

---

### Passed TC-A02 · Accept SP: Use SP slider → seller accepts → buyer confirms

**Ref:** TRADING-FLOW-V2 §7 Scenario S5, §4.4, §10
**Actors:** test-buyer (subscriber, SP ≥ 15) + test-seller (subscriber)

**Objective:** Verify a subscriber buyer can apply Swap Points to an Accept SP listing and complete the full SP happy path.

**Steps:**
1. Log in as **Buyer** and open an **Accept SP** item priced at $30.
2. Tap **[Use SP]** to open the offer screen with the SP slider.
3. Move the slider to **$8 SP** and review the breakdown.
4. Try to push the slider beyond 50% of the price ($15).
5. Tap **[Submit Offer]**.
6. Log in as **Seller**, open the **Offers** tab, tap the offer, and tap **[Accept]**.
7. Log in as **Buyer**, open the trade, tap **[I Got It]**, then **[Confirm]**.

**Expected Result:**
- The item shows an "Accept SP" badge with two buttons: **[Send offer]** and **[Use SP]**.
- The slider ranges from 0 to $15 (50% of $30); at $8 it shows "$22 cash + 8 SP = $30 total", platform fee $0.99 (subscriber), and total cash $22.99.
- The slider clamps at $15 and refuses any higher value.
- After submitting: the buyer's wallet shows 8 SP moved from available to reserved.
- The seller's offer row shows "$22 cash + 8 SP — Total: $30"; the Review screen shows the combined SP releasing at completion.
- While In Progress, the buyer's SP stays reserved (not yet transferred to the seller).
- After the buyer confirms: the trade completes; the buyer sees "Got it! You saved $8 using SP."; the seller's completion screen shows the SP (buyer 8 SP + platform reward) added to their pending wallet with a [View Wallet] button; the buyer's reserved SP returns to 0.

---

## Group B — Offer Lifecycle

### passed TC-B01 · Seller declines offer

**Ref:** TRADING-FLOW-V2 §7 Scenario S2
**Actors:** test-buyer + test-seller

**Objective:** Verify a seller can decline an offer and the item stays listed, restoring any reserved SP to the buyer.

**Steps:**
1. Log in as **Buyer** and submit an offer (any type) on a listing.
2. Log in as **Seller**, open the offer in the Review screen, and tap **[Decline]**.
3. Log in as **Buyer** and open the **Offers** tab.

**Expected Result:**
- The seller sees a confirmation "Offer declined. Item stays listed." and the offer row is removed/marked declined; the listing stays available.
- The buyer's Offers tab shows "Declined — [Item] still available" with a [View Item Again] button.
- If the buyer used SP, that SP is restored from reserved back to available.

---

### Passed TC-B02 · Offer expires (seller never responds) + seller ignore prompt

detialed test cases are here 
TC-B02-TESTING-GUIDE.md 

**Ref:** TRADING-FLOW-V2 §7 Scenario S3, §9.2, §11.8
**Actors:** test-buyer + test-seller
**Precondition:** QA fast-forwards the 24h offer clock past expiry for this trade.

**Objective:** Verify an unanswered offer auto-cancels at expiry, restores buyer SP, and prompts a repeatedly-ignoring seller to pause the listing.

**Steps:**
1. Log in as **Buyer** and submit an offer; note the 24h countdown starts.
2. Allow the offer to reach its expiry without the seller responding.
3. Log in as **Buyer** and open the **Offers** tab.
4. Repeat with a second consecutive unanswered offer on the same listing.
5. Log in as **Seller** and check push notifications.

**Expected Result:**
- At expiry the trade auto-cancels; the buyer's reserved SP (if any) is restored.
- The buyer's Offers tab shows "Expired — [Item] still available" with a [View Item Again] button.
- Before expiry, the seller receives reminder pushes at roughly 6 hours and 1 hour before the offer expires.
- After a second consecutive unanswered offer, the seller receives: "You're receiving offers but not responding on [Item]. Want to pause this listing?" with [Pause Listing] and [Dismiss].

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

### passed TC-B03 · Multiple competing offers — sort order + auto-decline on acceptance

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

### passed TC-B04 · Buyer cancels pending Offer 

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

### passed TC-B05 · Per-seller cap: max 3 pending offers per seller (2026-07-18)

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

### passed TC-B05a · Per-seller cap: Buyer at 3 with Seller A can still submit to Seller B

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

### passed TC-B05b · Per-seller cap: Blocked at 4th offer to same seller

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

### passed TC-B05c · Per-seller cap: Bundle offer counts as 1 slot, not N

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

### passed TC-B05d · Per-seller cap: Expired offer frees slot immediately

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

### passed TC-B05e · Regression: No leftover global cap blocks buyer over old global limit

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

### passed TC-B05f · Admin config: Change offer cap from 3 to 5 on Trade Timing page

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

### passed TC-B05g · Admin config: Revert cap from 5 back to 3

**Ref:** TRADING-FLOW-V2 §4.3 (admin-configurable, 2026-07-18)
**Actors:** test-admin + test-buyer (subscriber) + test-seller
**Precondition:** The cap was previously changed to 5 (TC-B05f). test-buyer has 4 pending offers with test-seller.

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

### passed TC-B05h · Admin config: Validation — reject invalid values

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

### TC-B05i · Mobile client: config fetch failure — graceful degradation

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

### TC-B05j · Regression: Per-seller scope + bundle=1 still hold after config change

**Ref:** TRADING-FLOW-V2 §4.3 (admin-configurable, 2026-07-18)
**Actors:** test-admin + test-buyer (subscriber) + test-seller + test-seller-2
**Precondition:** Admin changes cap to 5 (TC-B05f). test-seller has 6+ listings. test-seller-2 has 3+ listings.

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

### TC-B06 · Card declined at offer submission ( i could not test, since the card always is checked by stripe add new card panel)

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

### passed TC-B07 · Expired offer timeline — no message button

**Ref:** TRADING-FLOW-V2 §7 Scenario S3
**Actors:** test-buyer + test-seller
**Precondition:** QA fast-forwards the offer clock past expiry so the trade status is `cancelled`.

**Objective:** Verify that on an expired/cancelled offer's timeline screen, neither the buyer nor the seller sees a "Message" button to start a new conversation, since no active trade exists.

**Steps:**
1. Ensure an offer has expired and the trade status is `cancelled` (see TC-B02 fast-clock method).
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

### passed TC-B08 · Chat frozen after trade is cancelled or completed

**Ref:** TRADING-FLOW-V2 §7 Scenario S3
**Actors:** test-buyer + test-seller
**Precondition:** A trade exists in `cancelled` or `completed` status, and a chat conversation was previously started between the two parties while the trade was active.

**Objective:** Verify that when a user opens the chat for a cancelled/expired or completed trade, the chat is frozen — messages remain visible but no new messages can be sent.

**Steps:**
1. Ensure a trade is in `cancelled` status (e.g., via TC-B02 offer expiry flow) AND that at least one message was exchanged between buyer and seller while the trade was active.
2. Log in as **Buyer** and navigate to the chat from **Trades → History** (tap the trade, then — note: since the message button is hidden per TC-B07, access chat via a deep-link or the Conversations list).
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

### passed TC-B09 · Chat remains active for in_progress trades

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

---

## Group C — SP Behavior

### passed TC-C01 · SP reserved on offer submission

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

### passed TC-C02 · SP restored to buyer on seller decline

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

### passed TC-C03 · SP restored to buyer on offer expiry

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

### passed TC-C04 · SP stays reserved (not transferred) when seller accepts

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

### passed TC-C05 · SP released to seller at trade completion

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

### passed TC-C06 · SP restored to buyer when seller cancels in_progress trade

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

### passed TC-C07  · Free user sees locked Use SP button + upgrade modal

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

### passed TC-C08 · SP slider capped at 50% of item price

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

### passed TC-D01 · Auto-complete fires when buyer never taps I Got It

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

### passed TC-D02 · Auto-complete skipped when dispute is open

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

### passed TC-D03 · Offer countdown pill color states

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

### passed TC-D04 · Auto-complete banner visible to buyer only

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

### did not test , post MVP TC-D05 · Post-meetup nudge after auto-complete

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

### passed TC-E01 · Buyer opens Report a Problem modal

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
- After submitting, a toast appears: "Issue reported. Our team will review within 24 hours."; the trade enters a disputed state and the seller plus admin are notified.

---

### passed TC-E02 · Disputed trade does not auto-complete or release SP

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

### passed TC-E03 · Buyer UI during active dispute

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

### passed TC-E04 · Seller UI during active dispute

**Ref:** TRADING-FLOW-V2 §11.4
**Actors:** test-seller

**Objective:** Verify the seller's screen reflects an active dispute and hides the cancel action.

**Steps:**
1. Log in as **Seller** and open the disputed trade.

**Expected Result:**
- An amber notice appears: "A buyer has reported an issue with this trade. Our team is reviewing."
- The [Cancel] button is hidden during the active dispute; [Message Buyer] remains.

---

### passed TC-E05 · Admin resolves dispute → Complete (seller fulfilled correctly)

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

### passed TC-E06 · Admin resolves dispute → Refund (buyer's favor)

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

### passed TC-F01 · Payout shown on trade completion (no dispute)

**Ref:** TRADING-FLOW-V2 §6.3.1
**Actors:** test-seller

**Objective:** Verify a completed, undisputed trade shows the seller's payout as processing.

**Steps:**
1. Complete a trade normally (buyer taps [I Got It] → [Confirm]).
2. Log in as **Seller** and open the completed trade and/or payout area.

**Expected Result:**
- The seller sees the payout as pending/processing for that sale; no duplicate payout is shown for the same trade.

---

### passed TC-F02 · Payout held when dispute is open at completion time

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

### passed TC-F03 · Payout needs action when seller has no payout method

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

### passed TC-G01 · Offer expiry reminders sent to seller

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

### passed TC-G02 · Auto-complete reminders sent to buyer

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

### did not test TC-G03 · Notification throttle per trade

**Ref:** TRADING-FLOW-V2 §9.5
**Actors:** test-buyer / test-seller

**Objective:** Verify no more than 3 non-payout pushes are sent per user per trade.

**Steps:**
1. Drive a single trade through many reminder-triggering events.
2. Count the non-payout pushes received for that trade.

**Expected Result:**
- A maximum of 3 push notifications are received per user for that trade; any beyond that are not delivered.

---

### passed TC-G04 · Push notifications deep-link to the correct screen

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

###  passed TC-H01 · Free buyer sees subscription CTA on completion

**Actors:** test-free

**Objective:** Verify a free buyer is shown a Kids Club+ upsell on the completion screen.

**Steps:**
1. Log in as **test-free** and complete any trade.

**Expected Result:**
- The completion screen reads: "Trade complete! Kids Club+ would've saved you $2 on this trade — try it free for 30 days." with a [Try Kids Club+ Free — 30 Days] button.

---

###  passed TC-H02 · Subscriber buyer used SP — "You saved" message

**Actors:** test-buyer (subscriber)

**Objective:** Verify a subscriber buyer who used SP sees their savings on completion.

**Steps:**
1. Log in as **test-buyer** and complete a trade that used 8 SP.

**Expected Result:**
- The completion screen reads: "Got it! You saved $8 using SP!" and shows the remaining SP balance ("You have [remaining_sp] SP left.").

---

###  passed TC-H03 · Subscriber seller on Accept SP listing — SP pending notice

**Actors:** test-seller (subscriber)

**Objective:** Verify a subscriber seller sees their pending SP on completing an Accept SP sale.

**Steps:**
1. Log in as **test-seller** and complete an **Accept SP** sale.

**Expected Result:**
- The completion screen reads: "[total_sp] SP releasing in [N] days — added to your pending wallet." with a [View Wallet] button that opens the SP wallet.

---

### passed  TC-H04 · Subscriber seller on Cash Only listing — upsell to Accept SP

**Actors:** test-seller (subscriber)

**Objective:** Verify a subscriber seller is nudged to enable Accept SP on future listings.

**Steps:**
1. Log in as **test-seller** and complete a **Cash Only** sale.

**Expected Result:**
- The completion screen reads: "Sold for cash! Try 'Accept SP' on your next listing to also earn SP." with a [Create New Listing] button.

---

##  passed Group I — Safety UX

###  passed TC-I01 · Safe meetup guidance card visible on in_progress trade

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

### passed TC-I02 · Safe meetup card dismissible per trade (not globally)

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

### passed TC-I03 · In-chat safety banner persistent and non-dismissible

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

### passed TC-I04 · Pre-first-message safety modal shown once per listing

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

### passed TC-I05 · Chat quick-reply chips visible on in_progress trade

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

### passed TC-J01 · Seller cancels in_progress trade → Level 1 alert

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

### passed TC-J02 · 2nd post-acceptance cancel → Level 2 alert

**Actors:** test-seller
**Precondition:** test-seller has exactly 1 prior post-acceptance cancellation.

**Objective:** Verify the second post-acceptance cancellation shows a Level 2 warning.

**Steps:**
1. Log in as **Seller** and cancel a new **In Progress** trade with a reason.

**Expected Result:**
- The alert warns that repeated cancellations "may affect selling privileges" (Level 2).

---

### passed TC-J03 · 3rd post-acceptance cancel → Level 3 + admin flag

**Actors:** test-seller
**Precondition:** test-seller has exactly 2 prior post-acceptance cancellations.

**Objective:** Verify the third post-acceptance cancellation shows a Level 3 warning and flags the account.

**Steps:**
1. Log in as **Seller** and cancel a new **In Progress** trade with a reason.

**Expected Result:**
- The alert states the "account under review" (Level 3); the seller's account is flagged for admin review.

---

### passed TC-J04 · Seller cancel button visible only on in_progress

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

### passed  TC-J05 · Seller cancel modal shows seller-specific reasons only

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

### passed TC-K01 · Subscriber sees $0.99 fee + Sales Tax line in value stack

**Actors:** test-buyer (subscriber)

**Objective:** Verify the subscriber value stack shows the $0.99 platform fee, a Sales Tax line, and an SP discount row when SP is used. Also verifies the Item Detail screen Price Breakdown includes Sales Tax.

**Steps:**
1. Log in as **test-buyer** and open a listing → review the **Price Breakdown** card.
2. Tap **Make Offer**.
3. Scroll to the value stack.
4. Enter 5 SP.

**Expected Result:**
- **Item Detail screen:** Price Breakdown shows Item Price, Transaction Fee, **Sales Tax** (with rate), then Total.
- **Make Offer screen:** Value stack shows Offer amount, "Platform fee" $0.99, **"Sales Tax"** (based on node rate), and "Total cash" = offer amount + sales tax + $0.99.
- After entering 5 SP, an "SP discount" row appears showing `-5 SP`, and the Sales Tax recalculates on the SP-discounted amount.
- The Stripe PaymentIntent created at offer submission includes the tax amount (Option B — tax is charged at offer time, not deferred to completion).

---

### passed TC-K02 · Non-subscriber sees $2.99 fee + Sales Tax line in value stack

**Actors:** test-free

**Objective:** Verify the non-subscriber value stack shows the $2.99 platform fee, a Sales Tax line, and no SP input. Also verifies the Item Detail screen Price Breakdown includes Sales Tax.

**Steps:**
1. Log in as **test-free** and open a listing → review the **Price Breakdown** card.
2. Tap **Make Offer**.
3. Review the value stack.

**Expected Result:**
- **Item Detail screen:** Price Breakdown shows Item Price, Transaction Fee ($2.99), **Sales Tax**, then Total.
- **Make Offer screen:** "Platform fee" $2.99, **"Sales Tax"** row (based on node rate), "Total cash" = offer amount + sales tax + $2.99.
- No SP input section is visible.

---

### passed TC-K03 · SP discount row conditional on SP used

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

## Group L — Bundle Flows

**Ref:** TRADING-FLOW-V2 §11.3.1

### passed TC-L01 · Bundle banner on trade detail

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

### passed TC-L02 · Confirm All shortcut for bundle (buyer)

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

### passed TC-L03 · Bundle offer rows in Offers tab (seller)

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

### passed TC-L04 · Non-bundle offers render as single rows

**Actors:** test-seller

**Objective:** Verify single offers are not grouped as bundles.

**Steps:**
1. In the **Offers** tab, find a single (non-bundle) offer.

**Expected Result:**
- It renders as a normal offer row with only the standard Review action — no bundle group buttons.

---

### passed TC-L05 · In-progress bundles section in Buying tab

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

### passed TC-L06 · Bundle banner in Review Offer screen

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

### passed TC-L07 · Accept All N Items in Review Offer screen

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

### passed TC-L08 · Individual accept/decline works alongside bundle siblings

**Actors:** test-seller

**Objective:** Verify single accept/decline still works when bundle siblings exist.

**Steps:**
1. Open the **Review Offer** screen for a bundle offer.
2. Tap **[Accept Trade]** (single accept).

**Expected Result:**
- The single [Accept Trade] and [Decline] buttons are available alongside the bundle button.
- Accepting just this offer updates only this trade; the bundle siblings stay pending.

---

### passed TC-L09 · Bundle card in Your Offers (buyer)

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
- The Cart screen shows the seller name and the single item with its title, photo, and price.

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

### TC-M03 · Add item from a different seller shows the choice modal

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

### TC-M04 · Replace Cart option

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

### TC-M05 · Cannot add your own item to cart

**Actors:** test-seller

**Objective:** Verify a user cannot add their own listing to the cart.

**Steps:**
1. Log in as **test-seller** and open one of your own active listings.
2. Look for the **Add to Cart** button.

**Expected Result:**
- The Add to Cart action is unavailable (hidden or disabled), or tapping it shows a message that you cannot add your own item.

### TC-M06 · Cannot add an unavailable or out-of-node item

**Actors:** test-buyer

**Objective:** Verify items that are sold/removed or outside the buyer's node cannot be added.

**Steps:**
1. Log in as **test-buyer** and open an item that has just been marked sold or is outside your node.
2. Tap **Add to Cart**.

**Expected Result:**
- A clear message explains the item is no longer available (sold/deleted) or not available in your area.
- The item is not added to the cart.

### TC-M07 · Duplicate item is prevented in the same cart

**Actors:** test-buyer

**Precondition:** The cart contains a specific item from test-seller.

**Objective:** Verify the same item cannot be added twice.

**Steps:**
1. Open the item that is already in the cart.
2. Tap **Add to Cart** again.

**Expected Result:**
- The item is not duplicated; the cart count is unchanged.
- The UI indicates the item is already in the cart (e.g., button reads "In Cart").

### TC-M08 · Remove an item from the cart

**Actors:** test-buyer

**Objective:** Verify removing an item updates the cart immediately.

**Steps:**
1. Open the **Cart** screen with 2 items.
2. Remove one item (swipe or tap remove).

**Expected Result:**
- The removed item disappears from the list and the cart badge decrements.
- The cart total updates to reflect the remaining item.

### TC-M09 · Clear the cart

**Actors:** test-buyer

**Objective:** Verify clearing the cart empties it.

**Steps:**
1. Open the **Cart** screen with items.
2. Tap **Clear Cart** and confirm.

**Expected Result:**
- All items are removed and the screen shows an empty-cart state.
- The cart badge shows 0 or disappears.

### TC-M10 · Saved carts: max 3, LRU eviction, switch cart

**Actors:** test-buyer

**Objective:** Verify the saved-cart limit of 3, oldest-cart eviction, and switching between carts.

**Steps:**
1. Build and save carts from 4 different sellers in turn, using **Save & Start New Cart** each time.
2. Open the **Saved Carts** / **Switch Cart** view.
3. Tap **Switch Cart** on one of the saved carts.

**Expected Result:**
- At most 3 saved carts are kept; the oldest saved cart is dropped when the 4th is saved.
- Tapping Switch Cart makes the chosen saved cart the active cart and moves the previously active cart into saved.

### TC-M11 · Minimum cart value warning and blocked checkout

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

### TC-M12 · Max SP available shown per cart item (subscriber)

**Actors:** test-buyer (subscriber)

**Objective:** Verify the cart shows the maximum SP available per item for subscribers on SP-eligible items.

**Steps:**
1. Log in as **test-buyer** (Kids Club+).
2. Add an item whose seller accepts SP (payment preference is not Cash Only).
3. Open the **Cart** screen.

**Expected Result:**
- Each SP-eligible item shows a "Up to N SP" indicator equal to 50% of that item's price.
- Items from Cash Only sellers show no SP indicator.
- The actual SP amount is chosen later on the checkout screen, not in the cart.

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

### passed TC-M14 · Favorites add / remove

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

### passed TC-M15 · Favorites screen shows availability and empty state

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

### passed TC-N02 · Admin minimum cart value validation

**Actors:** Admin

**Objective:** Verify the admin portal validates the minimum cart value input.

**Steps:**
1. In the **admin portal** cart settings, enter a value below the allowed floor (e.g., $4.00, below the $5.00 minimum).
2. Attempt to save.

**Expected Result:**
- An inline validation error prevents saving values below $5.00.
- A valid value (≥ $5.00) saves successfully.

> Current limitation: `cart_max_saved_carts` and `cart_saved_expiry_days` can be edited in admin, but the runtime cart flow still hardcodes the 3-cart cap and has no verified configurable expiry consumption. Do not mark those two config-to-mobile paths covered until the implementation is wired end to end.

### passed TC-N03 · Admin updates Minimum Listing Price on Config → Fees tab (no deploy)

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

### passed TC-N04 · Seller cannot publish single-item listing priced below threshold

**Actors:** test-seller
**Precondition:** Admin has set `min_listing_price` to $5.00 (TC-N03 or direct SQL).

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

### passed TC-N09 · Price adjustment modal displays correct copy and button text (single-item)

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

### passed TC-N10 · "Update Price" dismisses modal and auto-scrolls + auto-focuses price field (single-item)

**Actors:** test-seller

**Objective:** Verify tapping "Update Price" dismisses the modal, scrolls the price field into view, and auto-focuses it with the keyboard raised.

**Precondition:** The price adjustment modal is visible (TC-N09 or directly triggered).

**Steps:**
1. With the "Let's Adjust Your Price" modal visible, tap **"Update Price"**.
2. Observe the screen after dismissal.

**Expected Result:**
- The modal dismisses smoothly.
- The `ScrollView` auto-scrolls to reveal the price input field (if scrolled away).
- The price input field receives focus and the keyboard is raised.
- The seller can immediately edit the price without manually scrolling or tapping the field.

### passed TC-N11 · Price adjustment modal in edit listing flow (single-item edit)

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

### deffered TC-N12 · Bulk listing: per-item chip shows dynamic threshold in missing-required warning

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

### passed TC-N13 · Bulk listing: publish failure shows clear error message for below-threshold items

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

### TC-N14 · Regression: minimum-price validation still blocks publish in single-item and bulk flows

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

### TC-N05 · Bulk listing: below-threshold items flagged, valid items still publish

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

### deffered TC-N06 · Existing listing becomes non-purchasable if threshold is raised above its price

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

### deffered TC-N07 · Existing listing regains purchasability after seller raises price to meet threshold

**Actors:** test-seller, test-buyer
**Precondition:** A listing was auto-paused at $4.00 because the threshold was raised to $5.00 (TC-N06).

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

### deffered TC-N08 · Regression: Single-item and bundle checkout work correctly at/above threshold

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

## Group O — Tax (End User)

### passed TC-O01 · Sales tax shown in checkout/cart breakdown (0 SP)

**Actors:** test-buyer

**Precondition:** The buyer's node has a tax rate configured (e.g., 6.35%) and sales tax is enabled globally.

**Objective:** Verify the checkout/initiation breakdown shows a sales tax line with no SP applied. Covers both TradeInitiationScreen (buy-now) and CartCheckoutScreen (cart flow).

**Steps:**
1. Log in as **test-buyer** and start checkout on an item without applying any SP (via TradeInitiationScreen).
2. Review the price breakdown.
3. Repeat on the **Cart Checkout** screen (add items to cart → tap Checkout).

**Expected Result:**
- **TradeInitiationScreen:** Shows Item Price → Subtotal → **Sales Tax** → Platform Fee → Total.
- **CartCheckoutScreen:** Shows Subtotal → SP Discount (if any) → Platform Fee → **Sales Tax** → Total.
- The Sales Tax amount equals the node rate applied to the taxable amount, and the Total includes it.
- The label reads "Sales Tax" (kid-friendly), not a technical jurisdiction name.

### passed TC-O02 · Tax does not recalculates on SP slider change (offer + checkout)

**Actors:** test-buyer (subscriber)

**Objective:** Verify sales tax is not changed on the SP-discounted amount in both offer and checkout screens.

**Steps:**
1. Start checkout on an SP-eligible item as **test-buyer** (via TradeInitiationScreen).
2. Move the SP slider up (e.g., apply the maximum 50%).
3. Watch the breakdown update.
4. Repeat on the **Make Offer** screen (TradeOfferScreen) with the same item.

**Expected Result:**
- The taxable amount does not drops by the SP discount and the **Sales Tax** recalculates on the lower (discounted) amount within ~300ms.
- The Total updates accordingly. The platform fee is still charged in cash.
- The recalculation applies on both `TradeInitiationScreen` and `TradeOfferScreen`.

### passed TC-O03 · Tax is $0 when sales tax is disabled globally

**Actors:** Admin, test-buyer

**Objective:** Verify no tax is charged when sales tax is turned off globally.

**Steps:**
1. In the **admin portal**, disable sales tax globally.
2. As **test-buyer**, start checkout on any item.

**Expected Result:**
- The breakdown shows $0.00 sales tax (or the Sales Tax line is hidden).
- The Total contains no tax.

### passed TC-O04 · Tax is $0 when the node tax is disabled

**Actors:** Admin, test-buyer

**Objective:** Verify no tax is charged when the buyer's node has tax disabled while global tax is on.

**Steps:**
1. In the **admin portal**, keep global tax enabled but disable tax for the buyer's node.
2. As **test-buyer** in that node, start checkout.

**Expected Result:**
- The Sales Tax line shows $0.00 for items in that node.
- The Total contains no tax.

### deferred to post-MVP. TC-O05 · Tax-exempt user sees a Tax Free badge

**Actors:** test-buyer (tax-exempt)

**Objective:** Verify a tax-exempt buyer sees a Tax Free indicator at checkout.

**Steps:**
1. Log in as a tax-exempt **test-buyer** and start checkout.

**Expected Result:**
- A "Tax Free" badge is shown and the Sales Tax line is $0.00.

### passed TC-O06 · Transaction history shows tax details

**Actors:** test-buyer

**Objective:** Verify a completed purchase shows its tax breakdown in history.

**Steps:**
1. Complete a taxable purchase as **test-buyer**.
2. Open **Transaction History** and select that transaction.
3. Tap **View Tax Details**.

**Expected Result:**
- The transaction list shows the tax amount on the row.
- The tax detail view shows the taxable amount, tax rate as a percentage (e.g., "6.35%"), jurisdiction, and any refunded tax, all formatted in USD.

### TC-O07 · Refund shows proportional tax refunded

**Actors:** test-buyer, Admin

**Objective:** Verify a partial/full refund reflects a proportional tax refund to the user.

**Steps:**
1. For a completed taxable transaction, have a 50% refund processed (via dispute/admin resolution).
2. As **test-buyer**, open the transaction's tax details.

**Expected Result:**
- The tax detail view shows 50% of the original tax as "Refunded tax" and a reduced net tax.
- A full refund shows the full tax refunded; multiple partial refunds accumulate correctly and never exceed the tax originally collected.

### TC-O08 · Tax shown on trade timeline/detail for buyer only

**Ref:** TRADING-FLOW-V2 §11.3

**Actors:** test-buyer, test-seller

**Precondition:** Sales tax is enabled globally and on the seller's node with a configured rate (e.g., 6.35%).

**Objective:** Verify the buyer sees a Sales Tax line on in-progress and completed trade screens, while the seller does not.

**Steps:**
1. Submit an offer on a taxable item (with or without SP).
2. Have the seller accept → trade moves to **In Progress**.
3. Log in as **test-buyer** and open the trade → **Trade Timeline** screen.
4. Scroll to the **Payment Details** section.
5. Log in as **test-seller** and open the same trade.
6. Complete the trade (buyer taps [I Got It] → [Confirm]).
7. Log in as **test-buyer** and reopen the completed trade.
8. Log in as **test-seller** and reopen the completed trade.

**Expected Result:**
- **In Progress (buyer view):** Payment Details shows Cash Paid, SP Used, Platform Fee, **Sales Tax** (live preview with rate and jurisdiction via `useTaxCalculation`), and Total including tax.
- **In Progress (seller view):** Payment Details shows Platform Fee and Total — **no Sales Tax line**.
- **Completed (buyer view):** Sales Tax row shows the stored tax amount applied at offer time (via `create-trade-offer` EF Option B). Total includes tax.
- **Completed (seller view):** No Sales Tax line shown. Total = cash + platform fee only.

---

## Group O-1 — Tax by Catalog Category (Admin Configuration)

> This group covers the catalog-level tax category system: admin management of versioned
> tax rules by category, listing backfill, listing-level category overrides, fee-in-tax-base
> toggle, and audit trail verification. Cross-references to Groups O (end-user tax UI),
> P (admin tax), and Q (reviews) are noted where applicable.
>
> **Key concept:** Tax rules are versioned and effective-dated. Editing a rule creates a new
> prospective version — historical trades keep their recorded tax snapshot. Overlapping active
> rules for the same category + jurisdiction + date range are blocked by a DB trigger.
> The `include_fee_in_tax_base` admin_config toggle controls whether the mandatory buyer
> platform fee ($0.99/$2.99) is included in the taxable base.

### TC-O1-C01 · Admin creates a new tax rule for general_tangible_goods

**Ref:** tax-category-rules §1, §4
**Actors:** test-admin

**Objective:** Verify an admin can create a new effective-dated tax rule for an unused tax category.

**Steps:**
1. Log in to the **admin portal** and navigate to **Tax → Tax Rules**.
2. Tap **+ New Tax Rule**.
3. In the form, select **General Tangible Goods** as the Tax Category.
4. Enter **"Standard CT Tangible Goods Rate"** as the Display Name.
5. Enter a description: *"Default taxable rate for physical goods in Connecticut."*
6. Leave **Items in this category are taxable** checked.
7. Enter **6.35** as the Tax Rate (%).
8. Leave jurisdiction as **CT**.
9. Leave Min/Max price blank (no thresholds).
10. Set Effective From to **today's date**.
11. Leave Effective To blank (ongoing).
12. Tap **Create Rule**.

**Expected Result:**
- A success message appears: "Rule created successfully."
- The rule appears in the table with version **v1**, Active status, Taxable, rate **6.35%**, CT jurisdiction.
- A new row appears under Version History for the category.
- The `admin_audit_logs` table contains a `tax_rule_created` entry for this action.

### TC-O1-C02 · Admin creates a second rule for same category — overlap blocked

**Ref:** tax-category-rules overlap validation trigger
**Actors:** test-admin
**Precondition:** An active ongoing rule exists for general_tangible_goods, CT, with effective_from today (TC-O1-C01).

**Objective:** Verify the DB trigger blocks creating a second overlapping active rule for the same category+jurisdiction+date range.

**Steps:**
1. Still on the Tax Rules page, tap **+ New Tax Rule**.
2. Select **General Tangible Goods**, jurisdiction **CT**.
3. Enter display name **"Duplicate Rule Test"**.
4. Set Effective From to **today** and Effective To blank.
5. Tap **Create Rule**.

**Expected Result:**
- The save fails with an error message: "Overlapping active tax rule exists for category..." (the exact server error from the overlap trigger).
- No duplicate rule appears in the table.
- The original rule (TC-O1-C01) remains unchanged and active.

### TC-O1-C03 · Admin edits an existing rule — new version created

**Ref:** tax-category-rules versioning
**Actors:** test-admin
**Precondition:** An active rule exists for general_tangible_goods, CT (TC-O1-C01).

**Objective:** Verify editing creates a new prospective version (v2) and closes the original.

**Steps:**
1. On the Tax Rules page, locate the rule from TC-O1-C01 and tap **Edit**.
2. Change the Display Name to **"Updated CT Tangible Goods Rate (v2)"**.
3. Change the Tax Rate to **6.99**.
4. Set Effective From to **tomorrow's date**.
5. Tap **Create New Version**.
6. Observe the table and the Version History.

**Expected Result:**
- A success message: "Rule updated — new version 2 created."
- The original rule (v1) now shows **Inactive** status and its Effective To is set to the end of today.
- The new rule (v2) shows **Active** status, rate **6.99%**, effective from tomorrow.
- Version History shows both v1 (Inactive) and v2 (Active) in chronological order.
- The `admin_audit_logs` table has a `tax_rule_updated` entry tracking the before/after values.

### TC-O1-C04 · Admin deactivates a rule

**Ref:** tax-category-rules deactivation
**Actors:** test-admin
**Precondition:** A rule exists (can be the v2 from TC-O1-C03).

**Objective:** Verify an admin can deactivate a rule, closing its effective period.

**Steps:**
1. On the Tax Rules page, locate the active rule and tap **Deactivate**.
2. Read the confirmation modal text.
3. Tap **Deactivate** in the modal.
4. Observe the table.

**Expected Result:**
- The confirmation modal warns: "This will set the rule as inactive and close its effective period. Historical trades that used this rule retain their recorded tax calculation."
- After confirming, the rule shows **Inactive** status.
- Its Effective To is set to the deactivation time.
- The rule no longer appears in active-rule lookups.

### TC-O1-C05 · Existing listings backfill to general_tangible_goods

**Ref:** tax-category-rules backfill migration
**Actors:** test-admin (verification only)

**Objective:** Verify all existing listings (created before the migration) have `tax_category_id` set to `general_tangible_goods`.

**Steps:**
1. Run the backfill verification query in the Supabase SQL Editor:
   ```sql
   SELECT COUNT(*) AS items_without_tax_category FROM public.items WHERE tax_category_id IS NULL;
   ```
2. Run a sample check:
   ```sql
   SELECT i.id, i.title, tc.key AS tax_category_key
   FROM public.items i
   LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
   LIMIT 10;
   ```

**Expected Result:**
- `items_without_tax_category` returns **0**.
- The sample check shows every item has `tax_category_key = 'general_tangible_goods'`.
- No existing listing reads, discovery, or purchase flows were broken by the backfill.

### TC-O1-C06 · New single-listing creation receives default tax category

**Ref:** tax-category-rules default assignment
**Actors:** test-seller

**Objective:** Verify a newly created single listing automatically gets `general_tangible_goods` as its tax category.

**Steps:**
1. Log in as **test-seller** and create a new single listing (complete all required fields).
2. Note the listing ID from the success screen or My Listings.
3. Run the verification query:
   ```sql
   SELECT i.title, tc.key, tc.name
   FROM public.items i
   LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
   WHERE i.id = '<new-listing-uuid>';
   ```

**Expected Result:**
- The query returns the listing with `tax_category_key = 'general_tangible_goods'`.
- The listing appears in Discovery and can be purchased normally (no regression).

### TC-O1-C07 · New bulk-listing creation receives default tax category

**Ref:** tax-category-rules default assignment
**Actors:** test-seller

**Objective:** Verify all items created through a bulk listing session get `general_tangible_goods`.

**Steps:**
1. Log in as **test-seller** and create a bulk listing with 2+ items.
2. Complete all required fields and publish.
3. Run the verification query:
   ```sql
   SELECT i.title, tc.key, tc.name
   FROM public.items i
   LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
   WHERE i.seller_id = '<seller-uuid>'
   ORDER BY i.created_at DESC
   LIMIT 5;
   ```

**Expected Result:**
- The bulk-listed items have `tax_category_key = 'general_tangible_goods'`.
- All items appear in My Listings and are purchasable (no regression).

### TC-O1-C08 · Admin changes an individual listing's tax category

**Ref:** tax-category-rules `update_item_tax_category_admin` RPC
**Actors:** test-admin

**Objective:** Verify an admin can change a listing's tax category from the admin items detail page.

**Steps:**
1. Log in to the **admin portal** and navigate to an item's detail page (e.g., via Items or Listings).
2. Scroll to the **Tax Category** field.
3. Tap **Change tax category**.
4. Select a different category from the dropdown (e.g., **Clothing and Footwear (clothing_footwear)**).
5. Tap **Save**.
6. Observe the success message.
7. Run the verification query:
   ```sql
   SELECT i.title, tc.key AS tax_category_key
   FROM public.items i
   LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
   WHERE i.id = '<item-uuid>';
   ```

**Expected Result:**
- A green success message: "Tax category updated."
- The Tax Category field now shows the new category name and key.
- The verification query confirms `tax_category_key = 'clothing_footwear'`.
- The `admin_audit_logs` table has an `item_tax_category_changed` entry with old/new values.

### TC-O1-C09 · Tax-exempt category configuration

**Ref:** tax-category-rules `tax_exempt_goods` seed category
**Actors:** test-admin

**Objective:** Verify the `tax_exempt_goods` category exists with default non-taxable behavior.

**Steps:**
1. Navigate to **Tax → Tax Rules** and verify **Tax Exempt Goods** appears in the category list.
2. Create a new rule for **Tax Exempt Goods** with **Items in this category are taxable** unchecked.
3. Save and verify the rule is active.
4. Verify the applicable rule query returns `is_taxable = false`:
   ```sql
   SELECT is_taxable FROM public.get_applicable_tax_rule(
     (SELECT id FROM public.tax_categories WHERE key = 'tax_exempt_goods' LIMIT 1),
     NOW()
   );
   ```

**Expected Result:**
- The `tax_exempt_goods` category is pre-seeded and listed in the dropdown.
- A rule can be created with `is_taxable = false`.
- The `get_applicable_tax_rule` RPC returns `is_taxable = false`.

### TC-O1-C10 · Price-threshold category configuration (clothing_footwear)

**Ref:** tax-category-rules price threshold rules
**Actors:** test-admin

**Objective:** Verify price thresholds can be configured on a tax rule.

**Steps:**
1. On the Tax Rules page, create a new rule for **Clothing and Footwear (clothing_footwear)**.
2. Set Display Name: **"CT Clothing — Under $50 threshold"**.
3. Set **Items in this category are taxable** checked.
4. Set Tax Rate to **6.35%**.
5. Set Min Item Price to **$0.00** and Max Item Price to **$50.00**.
6. Save and verify.
7. View the rule in the table.

**Expected Result:**
- The rule saves successfully.
- The table shows the price range: `$0.00 – $50.00`.
- The Version History shows the rule with its price thresholds.
- The overlap trigger does NOT block this rule (different category from TC-O1-C01).

### TC-O1-C11 · Fee-in-tax-base toggle on and off

**Ref:** tax-category-rules `include_fee_in_tax_base` admin_config
**Actors:** test-admin

**Objective:** Verify the fee-in-tax-base setting can be toggled and persists.

**Steps:**
1. Navigate to **Tax → Tax Settings**.
2. Scroll to the **Marketplace Fee Tax Base** section.
3. Verify the checkbox **Include marketplace transaction fee in sales-tax base** is present with a descriptive help text.
4. Check the box and tap **Save Settings**.
5. Verify success: "Tax settings saved."
6. Refresh the page and confirm the checkbox is still checked.
7. Run the verification query:
   ```sql
   SELECT key, value FROM public.admin_config WHERE key = 'include_fee_in_tax_base';
   ```
8. Verify the RPC returns the correct value:
   ```sql
   SELECT public.get_include_fee_in_tax_base();
   ```
9. Uncheck the box, save, and verify it persists as `false`.

**Expected Result:**
- The toggle is visible in the Tax Settings page with the label and help text.
- Saving with the box checked: `admin_config` shows `value = 'true'`.
- `get_include_fee_in_tax_base()` returns `true`.
- After unchecking and saving: `value = 'false'` and the RPC returns `false`.
- No change to checkout totals, Stripe behavior, or tax reporting (future prompt).

### TC-O1-C12 · Unauthorized user cannot view or edit tax configuration

**Ref:** tax-category-rules RLS + admin role check
**Actors:** test-seller (non-admin)

**Objective:** Verify a non-admin user cannot access or modify tax rules or categories.

**Steps:**
1. Log in to the **admin portal** as a **test-seller** (non-admin user).
2. Navigate to **Tax → Tax Rules** directly via URL: `/tax/rules`.
3. Attempt to call the `upsert_tax_rule` RPC from the browser console or API.

**Expected Result:**
- The Tax Rules page either redirects to login, shows an access-denied message, or loads the page but all mutation buttons (Create, Edit, Deactivate) are absent or disabled.
- Direct RPC calls return: `{"success": false, "error": {"code": "FORBIDDEN", "message": "Admin role required"}}`.
- Direct SQL `SELECT * FROM public.tax_rules` returns only the rows the non-admin user's RLS allows (should be all rows since the SELECT policy allows everyone to read, but the INSERT/UPDATE/DELETE is admin-only).

### TC-O1-C13 · Audit trail accurately shows actor, timestamp, and before/after values

**Ref:** tax-category-rules audit trigger
**Actors:** test-admin

**Objective:** Verify the audit trigger on `tax_rules` writes complete before/after information to `admin_audit_logs`.

**Steps:**
1. Perform a series of tax rule operations (create, edit, deactivate).
2. Query the audit logs:
   ```sql
   SELECT actor_id, action_type, entity_type, entity_id, payload, created_at
   FROM public.admin_audit_logs
   WHERE entity_type = 'tax_rule'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

**Expected Result:**
- Each operation has its own audit row.
- `action_type` is one of: `tax_rule_created`, `tax_rule_updated`, `tax_rule_deactivated`.
- `actor_id` matches the authenticated admin user.
- `payload` contains the before/after values for updates.
- `created_at` is properly timestamped.
- The audit log entry for an edit shows the old display_name, tax_rate, effective_to, etc. in the `before` object, and the new values in the `after` object.

---

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

## Group O-2 — Tax Status Lifecycle (Capture Deferred to Completion)

> This group covers the state-based sales-tax lifecycle introduced in migration
> `20260723000002_tax_status_lifecycle.sql`. Key behavioral change: Stripe PaymentIntent
> capture is deferred from seller-accept to buyer-complete / auto-complete. Tax records
> are `quoted` at offer submission, become `collected` only after Stripe capture confirms,
> and become `voided` on cancellation/decline/expiry.
>
> **Tax status values:**
> - `quoted`: Offer has tax calculated; Stripe auth hold exists but no money moved
> - `collected`: Stripe capture succeeded; tax is payable
> - `voided`: Auth was canceled/declined/expired before capture
> - `capture_failed`: Capture attempt failed; no money moved
> - `refunded`: Full captured tax was refunded
> - `partially_refunded`: Partial refund was processed
>
> **Key concepts:**
> - SP does NOT reduce the taxable amount (SP is payment tender, not a price discount)
> - `include_fee_in_tax_base` toggle controls whether the platform fee is part of taxable base
> - Category-level tax rules (from `tax_rules` table) are used per item
> - Historical/backfill records are classified but not falsely marked as collected

### TC-O2-C01 · Single taxable item, no SP — submitted offer is quoted/authorized, not collected

**Ref:** tax-status-lifecycle §1
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** Seller's node has sales tax enabled (e.g., 6.35%). Item is `general_tangible_goods`. Buyer has a saved payment method.

**Objective:** Verify that when a buyer submits an offer on a taxable item with no SP, the tax is marked `quoted` (not collected) and the Stripe PI is an uncaptured authorization hold.

**Steps:**
1. Log in as **test-buyer** and open a taxable item from **test-seller**.
2. Set SP to 0 and submit the offer.
3. Run the verification query:
   ```sql
   SELECT tr.id, tr.trade_id, tr.tax_status, tr.tax_amount_cents, tr.taxable_amount_cents,
          tr.tax_snapshot, tr.captured_at IS NOT NULL AS is_captured
   FROM public.tax_records tr
   JOIN public.trades t ON t.id = tr.trade_id
   WHERE t.buyer_id = '<buyer-uuid>' AND t.status = 'pending'
   ORDER BY tr.created_at DESC LIMIT 1;
   ```
4. On Stripe Dashboard, find the PaymentIntent and verify its status.

**Expected Result:**
- `tax_status` = `'quoted'`
- `captured_at` IS NULL (not captured)
- `tax_snapshot` contains item-level category, rule, price, rate, fee-in-base flag
- `tax_snapshot` has `items[0].is_taxable = true`, correct `tax_rate` (e.g., `0.0635`)
- Stripe Dashboard shows the PI in `requires_capture` status (authorization hold only)
- The Stripe authorization amount = `cash_cents + platform_fee + tax` (SP did not reduce taxable base)

### TC-O2-C02 · Bundle with taxable, exempt, and threshold-based items — line-level tax correct

**Ref:** tax-status-lifecycle §1 (category-level calculation)
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** Seller has 3 items: Item A = `general_tangible_goods` (taxable), Item B = `tax_exempt_goods` (not taxable), Item C = `clothing_footwear` with a price-threshold rule active (under $50 min). Buyer has sufficient SP and saved payment method.

**Objective:** Verify that a bundle checkout calculates tax at the line-item level using each item's tax category, so exempt items don't get taxed and threshold-based items are correctly handled.

**Steps:**
1. Log in as **test-buyer**.
2. Add all 3 items to the cart and checkout as a bundle.
3. After submission, run:
   ```sql
   SELECT tr.trade_id, tr.tax_status, tr.tax_amount_cents, tr.taxable_amount_cents,
          tr.tax_snapshot
   FROM public.tax_records tr
   ORDER BY tr.created_at DESC LIMIT 1;
   ```

**Expected Result:**
- All trades have `tax_status = 'quoted'`
- The `tax_snapshot` has ONE record per trade (single-item), but each reflects the correct category-level calculation
- For Item B (tax_exempt): `tax_amount_cents = 0`, `is_taxable = false`
- For Item C (clothing_footwear): tax rate and threshold applied per the active rule
- Item A (general_tangible_goods): standard rate applied
- The Stripe authorization total = sum of all items' cash + fees + tax (for taxable items only)

### TC-O2-C03 · Platform-fee tax toggle off and on — tax base changes by fee amount

**Ref:** tax-status-lifecycle §1 (`include_fee_in_tax_base`)
**Actors:** test-admin + test-buyer + test-seller

**Objective:** Verify that toggling `include_fee_in_tax_base` changes the taxable base by exactly the platform fee amount for new offers (historical offers are unaffected).

**Steps:**
1. As **test-admin**, verify `include_fee_in_tax_base` is `false` in the admin portal **Tax → Settings**.
2. As **test-buyer**, submit an offer on a $30 taxable item with no SP.
3. Note the `taxable_amount_cents` and `tax_amount_cents` in `tax_records`.
4. As **test-admin**, set `include_fee_in_tax_base` to `true` and save.
5. As **test-buyer**, submit a second offer on a different $30 taxable item with no SP.
6. Compare the two tax records.

**Expected Result:**
- First offer (fee-not-in-base): `taxable_amount_cents = 3000` (just item price), `tax_amount_cents = floor(3000 * 0.0635 + 0.5) = 191`
- Second offer (fee-in-base): `taxable_amount_cents = 3000 + 99 = 3099`, `tax_amount_cents = floor(3099 * 0.0635 + 0.5) = 197`
- Difference in tax = 6 cents (attributable to the $0.99 fee being included)
- The `tax_snapshot.include_fee_in_tax_base` field is `false` for trade 1 and `true` for trade 2
- The first offer's tax snapshot was NOT retroactively changed

### TC-O2-C04 · SP used — taxable item base unchanged, card auth reflects SP tender

**Ref:** tax-status-lifecycle §1 (BP-37), TRADING-FLOW-V2 §4.4
**Actors:** test-buyer (subscriber) + test-seller
**Precondition:** Item is $30, accepts SP. Buyer has ≥ 15 SP.

**Objective:** Verify the taxable base uses the full item price (not the SP-reduced cash amount), while the Stripe authorization total correctly reflects SP as payment tender.

**Steps:**
1. Log in as **test-buyer** and open a $30 **Accept SP** item.
2. Apply 15 SP (max 50% = $15.00).
3. Submit the offer.
4. Run:
   ```sql
   SELECT tr.tax_status, tr.taxable_amount_cents, tr.tax_amount_cents,
          tr.tax_snapshot->'items'->0->>'item_price_cents' AS item_price,
          t.cash_amount_cents, t.sp_amount,
          t.stripe_payment_intent_id
   FROM public.tax_records tr
   JOIN public.trades t ON t.id = tr.trade_id
   ORDER BY tr.created_at DESC LIMIT 1;
   ```

**Expected Result:**
- `taxable_amount_cents` = 3000 (full item price — NOT 1500)
- `tax_amount_cents` = calculated on 3000 (full price)
- `cash_amount_cents` (on trade) = `3000 - 1500(sp) + fee = 1500 + fee` (SP reduced the cash due)
- Stripe PI authorization amount = `1500(cash) + fee + tax` (correctly reflects SP as tender)
- `tax_status` = `'quoted'`
- `tax_snapshot.items[0].item_price_cents` = 3000

### TC-O2-C05 · Seller accepts — tax remains quoted/authorized, not collected

**Ref:** tax-status-lifecycle §2, TRADING-FLOW-V2 §4.3
**Actors:** test-buyer + test-seller
**Precondition:** A `quoted` offer exists (TC-O2-C01 or C04).

**Objective:** Verify that seller acceptance does NOT capture the PI or change tax to collected.

**Steps:**
1. Log in as **test-seller** and accept the pending offer.
2. Run:
   ```sql
   SELECT t.status, t.auto_complete_at IS NOT NULL AS has_auto_complete,
          tr.tax_status, tr.captured_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<trade-uuid>';
   ```
3. On Stripe Dashboard, check the PI status.

**Expected Result:**
- `trades.status` = `'in_progress'`
- `auto_complete_at` is set (48h from now)
- `tax_status` = `'quoted'` (unchanged — still not collected)
- `captured_at` IS NULL
- Stripe Dashboard shows the PI still in `requires_capture` (uncaptured authorization)
- The authorization hold is still on the buyer's card

### TC-O2-C06 · Buyer cancels while Awaiting Seller — PI canceled, tax voided, SP released once

**Ref:** tax-status-lifecycle §3, TRADING-FLOW-V2 §7 S3
**Actors:** test-buyer + test-seller
**Precondition:** A `pending` quoted offer exists (buyer submitted, seller hasn't acted yet).

**Objective:** Verify that when a buyer actively cancels an offer while the seller hasn't yet accepted, the PI is immediately canceled, tax goes to voided, and SP is released exactly once (no double-release).

**Steps:**
1. Log in as **test-buyer** with a pending offer that used SP.
2. Tap **Cancel Trade**, select a reason, and confirm.
3. Run:
   ```sql
   SELECT t.status, t.cancellation_reason,
          tr.tax_status, tr.voided_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<trade-uuid>';
   ```
4. Check the buyer's SP wallet:
   ```sql
   SELECT available_balance, reserved_sp FROM public.sp_wallets
   WHERE user_id = '<buyer-uuid>';
   ```
5. Check SP ledger for duplicate entries:
   ```sql
   SELECT transaction_type, amount, description
   FROM public.sp_ledger
   WHERE user_id = '<buyer-uuid>'
     AND related_transaction_id = '<trade-uuid>'
     AND transaction_type = 'earn_refund';
   ```

**Expected Result:**
- `trades.status` = `'cancelled'`
- `tax_status` = `'voided'`
- `voided_at` IS NOT NULL
- Stripe Dashboard: the PI is canceled (not just expired)
- SP wallet: reserved SP is restored to available_balance exactly once
- SP ledger: exactly 1 `earn_refund` entry for this trade (no duplicate)
- Buyer receives confirmation that the offer was cancelled (in-app + push)

### TC-O2-C07 · Seller declines and offer expiry — PI canceled, tax voided

**Ref:** tax-status-lifecycle §3, TRADING-FLOW-V2 §7 S2, S3
**Actors:** test-buyer + test-seller

**Objective:** Verify that seller decline and offer expiry both cancel the PI and void the tax.

**Steps:**
1. **Decline path**: Log in as **test-seller** and decline a pending offer.
   ```sql
   SELECT t.status, t.cancellation_reason,
          tr.tax_status, tr.voided_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<declined-trade-uuid>';
   ```
2. **Expiry path**: Fast-forward a different pending offer past its `offer_expires_at` and run the expiry cron.
   ```sql
   UPDATE trades SET offer_expires_at = NOW() + INTERVAL '5 seconds'
   WHERE id = '<expiring-trade-uuid>' AND status = 'pending';
   SELECT public.rpc_process_expired_offers(100);
   -- Then verify:
   SELECT t.status, t.cancellation_reason,
          tr.tax_status, tr.voided_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<expiring-trade-uuid>';
   ```

**Expected Result (both paths):**
- `trades.status` = `'cancelled'`
- `tax_status` = `'voided'`
- `voided_at` IS NOT NULL
- Stripe PI is canceled (not left as orphaned authorization)
- SP is released exactly once (no double-release)
- No Stripe charge appears (only a canceled authorization)

### TC-O2-C08 · Buyer completes successfully — capture succeeds, tax collected, seller funds released

**Ref:** tax-status-lifecycle §4, TRADING-FLOW-V2 §7 S1, S7
**Actors:** test-buyer + test-seller
**Precondition:** An `in_progress` trade exists with `tax_status = 'quoted'` and an uncaptured PI.

**Objective:** Verify the full happy path: buyer taps [I Got It], PI is captured, tax becomes collected, SP is released, payout is triggered.

**Steps:**
1. Log in as **test-buyer** on an In Progress trade.
2. Tap **[I Got It]** → **[Confirm]**.
3. Run:
   ```sql
   SELECT t.status, t.completed_at,
          tr.tax_status, tr.captured_at, tr.stripe_capture_id
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<trade-uuid>';
   ```
4. On Stripe Dashboard, find the captured charge.
5. Check seller SP wallet and payout status.

**Expected Result:**
- `trades.status` = `'completed'`
- `tax_status` = `'collected'`
- `captured_at` IS NOT NULL
- `stripe_capture_id` matches the Stripe Charge ID
- Stripe Dashboard shows the PI as `succeeded` with a captured charge
- Seller SP wallet: `pending_balance` increased (SP earned)
- Seller payout: `processing` or `pending` status
- Tax snapshot was NOT modified — only `tax_status` and `captured_at` changed
- Buyer's card was charged the full authorization amount (cash + fee + tax)

### TC-O2-C09 · Auto-complete after configured 48 hours — capture succeeds, tax collected, seller funds released

**Ref:** tax-status-lifecycle §4, TRADING-FLOW-V2 §7 S7
**Actors:** test-buyer + test-seller
**Precondition:** An `in_progress` trade with `auto_complete_at` set. QA fast-forwards past auto-complete time.

**Objective:** Verify the auto-complete path captures the PI and marks tax collected.

**Steps:**
1. Fast-forward the trade's `auto_complete_at`:
   ```sql
   UPDATE trades SET auto_complete_at = NOW() + INTERVAL '5 seconds'
   WHERE id = '<trade-uuid>' AND status = 'in_progress';
   ```
2. Run the auto-complete processor:
   ```sql
   SELECT public.rpc_process_auto_complete(100);
   ```
3. Or trigger via the Edge Function (service role):
   ```bash
   curl -X POST <supabase_url>/functions/v1/process-auto-complete \
     -H "Authorization: Bearer $SERVICE_ROLE_KEY"
   ```
4. Run verification:
   ```sql
   SELECT t.status, t.completed_at,
          tr.tax_status, tr.captured_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<trade-uuid>';
   ```

**Expected Result:**
- `trades.status` = `'completed'`
- `tax_status` = `'collected'`
- `captured_at` IS NOT NULL
- Stripe Dashboard: PI captured successfully
- Seller SP and payout triggered normally
- Buyer received auto-complete notification

### TC-O2-C10 · Capture failure — no payout, no collected tax, recovery state visible

**Ref:** tax-status-lifecycle §4 (capture_failed)
**Actors:** test-buyer + test-seller
**Precondition:** An `in_progress` trade with an uncaptured PI. Simulate capture failure (e.g., by voiding the PI on Stripe Dashboard before completing, or using a test scenario where capture would fail).

**Objective:** Verify that when Stripe capture fails, the trade does NOT complete, tax is `capture_failed`, no payout is triggered, and no SP is released.

**Steps:**
1. Before the buyer taps [I Got It], void/cancel the PI on Stripe Dashboard.
2. As **test-buyer**, tap **[I Got It]** → **[Confirm]**.
3. Observe the error.
4. Run:
   ```sql
   SELECT t.status, t.cancellation_reason,
          tr.tax_status, tr.voided_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.id = '<trade-uuid>';
   ```
5. Check seller payout status and SP wallet.

**Expected Result:**
- The buyer sees a clear error: "Payment capture failed. Please try again or contact support."
- `tax_status` = `'capture_failed'` (or `'voided'` if the Stripe error resulted in PI cancel)
- `trades.status` remains `'in_progress'` (NOT completed)
- Seller SP wallet is unchanged (no SP released)
- No seller payout record is created
- Admin can see the `capture_failed` tax record in the reporting dashboard
- The trade is recoverable (buyer can retry or admin can intervene)

### TC-O2-C11 · Duplicate webhook/retry — no duplicate tax collection, payout, refund, or SP event

**Ref:** tax-status-lifecycle §4 (idempotency)
**Actors:** test-buyer + test-seller
**Precondition:** A completed trade with `tax_status = 'collected'`. Simulate a duplicate webhook delivery.

**Objective:** Verify that idempotency guards prevent double-processing when webhooks retry or EFs are called redundantly.

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
4. Check `tax_records` for the refund.

**Expected Result:**
- `rpc_mark_tax_collected` on an already-collected record returns `success: true` with `action: 'idempotent'` — no second status change
- `rpc_refund_tax_with_status` on an already-refunded record returns the remaining refundable amount correctly — no second `refunded_tax_cents` addition
- SP ledger has exactly 1 earn_refund or spend_purchase entry per operation
- `seller_payouts` has exactly 1 payout record for the trade
- Duplicate Stripe webhook events (`charge.captured`, `charge.refunded`) do not create duplicate effects

### TC-O2-C12 · Historical/backfill records — clearly classified, never falsely marked as collected

**Ref:** tax-status-lifecycle §5 (backfill), migration BLOCK 9
**Actors:** test-admin

**Objective:** Verify the backfill migration correctly classified historical tax records without falsely marking uncaptured trades as collected.

**Steps:**
1. Run the backfill classification query:
   ```sql
   SELECT tr.tax_status, COUNT(*) AS count
   FROM public.tax_records tr
   GROUP BY tr.tax_status
   ORDER BY tr.tax_status;
   ```
2. Spot-check a completed pre-migration trade:
   ```sql
   SELECT t.id, t.status, t.completed_at,
          tr.tax_status, tr.captured_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.status = 'completed'
     AND t.completed_at < '2026-07-23'
   LIMIT 5;
   ```
3. Spot-check a cancelled pre-migration trade:
   ```sql
   SELECT t.id, t.status, t.cancelled_at,
          tr.tax_status, tr.voided_at
   FROM public.trades t
   JOIN public.tax_records tr ON tr.trade_id = t.id
   WHERE t.status = 'cancelled'
     AND t.cancelled_at < '2026-07-23'
   LIMIT 5;
   ```

**Expected Result:**
- Completed pre-migration trades: `tax_status = 'collected'`, `captured_at = completed_at` (best-effort backfill)
- Cancelled pre-migration trades: `tax_status = 'voided'`, `voided_at = cancelled_at`
- Pending or in_progress pre-migration trades: `tax_status = 'quoted'` (left as-is — not falsely collected)
- Refunded trades (stripe_refund_id exists): `tax_status = 'refunded'`
- Zero trades have `tax_status = 'collected'` without a real capture (historical completed trades are an acceptable approximation since the old flow captured at seller-accept)

---

## Group O-3 — Tax Refund & Reconciliation Integrity

> This group covers the Stripe-refund-first-then-tax-reversal flow introduced in migration
> `20260724000001_tax_refund_and_reconciliation.sql`. Key behavioral change: tax is only
> marked as refunded after a verified Stripe refund succeeds. `pending_refund` and
> `reconciliation_required` are new tax_status values.
>
> **Refund flow:**
> 1. Edge Function issues Stripe refund → gets refund ID and status back
> 2. Edge Function calls `rpc_record_stripe_refund` with the refund result
> 3. If Stripe refund succeeds → tax_status becomes `refunded`/`partially_refunded`
> 4. If Stripe refund is pending → tax_status becomes `pending_refund`
> 5. If Stripe refund fails → tax_status stays as-is, reconciliation_status is set
>
> **Report inclusion rules (migration 20260724000001):**
> - Tax Collected = only records with `tax_status = 'collected'` AND a captured_at timestamp
> - Tax Refunded = only records with `tax_status IN ('refunded', 'partially_refunded')` AND verified refunded_at
> - Net Tax Payable = collected minus refunded (never includes pending/voided/capture-failed/reconciliation)
> - Pending/Authorized Tax = `tax_status = 'quoted'` — operational only
> - Voided/Expired Tax = `tax_status = 'voided'` — operational only
> - Capture Failed Tax = `tax_status = 'capture_failed'` — operational only
> - Pending Refund = `tax_status = 'pending_refund'` — operational only
> - Reconciliation Required = `tax_status = 'reconciliation_required'` OR reconciliation_status IS NOT NULL

### TC-O3-C01 · Buyer wording: "Payment authorized" before capture (Awaiting Seller)

**Ref:** TAX-REFUND-INTEGRITY §4 (buyer-facing wording)
**Actors:** test-buyer (subscriber) + test-seller

**Objective:** Verify that when a buyer views a pending (Awaiting Seller) trade, the payment details show "Payment authorized:" instead of "Cash Paid:" or "Paid:".

**Steps:**
1. Log in as **test-buyer** and submit an offer on a taxable item.
2. Open the **Trade Timeline** screen for the pending trade.
3. Scroll to the **Payment Details** card.

**Expected Result:**
- The label reads **"Payment authorized:"** (not "Cash Paid" or "Paid").
- The amount shows the authorized card amount.
- The tax label reads **"Estimated Sales Tax"** (not just "Sales Tax").
- All breakdown rows (Swap Points, Platform Fee, Estimated Sales Tax, Total) are visible.

### TC-O3-C02 · Buyer wording: "Payment authorized" after seller accept (In Progress)

**Ref:** TAX-REFUND-INTEGRITY §4
**Actors:** test-buyer + test-seller

**Objective:** Verify the buyer still sees "Payment authorized" (not "Paid") while the trade is In Progress but not yet captured.

**Steps:**
1. From TC-O3-C01, have the seller accept the offer → trade moves to **In Progress**.
2. Log in as **test-buyer** and open the Trade Timeline.
3. Scroll to Payment Details.

**Expected Result:**
- The label still reads **"Payment authorized:"** (capture has not happened yet).
- Tax label still reads **"Estimated Sales Tax"**.
- Stripe Dashboard shows the PI in `requires_capture` status (uncaptured).

### TC-O3-C03 · Buyer wording: "Paid" after successful capture (Completed)

**Ref:** TAX-REFUND-INTEGRITY §4
**Actors:** test-buyer

**Objective:** Verify the buyer sees "Paid" and the final tax amount after successful capture.

**Steps:**
1. From TC-O3-C02, tap **[I Got It]** → **[Confirm]** to complete the trade.
2. Verify capture succeeded (no error).
3. Open the completed trade's Timeline.
4. Scroll to Payment Details.

**Expected Result:**
- The label now reads **"Paid:"** (not "Payment authorized").
- The tax label reads **"Sales Tax"** (not "Estimated Sales Tax").
- The final tax amount uses the stored snapshot (not a live preview).
- The total includes the captured amount.

### TC-O3-C04 · Capture failure shows "payment could not be completed" (no completed state)

**Ref:** TAX-REFUND-INTEGRITY §4
**Actors:** test-buyer + test-seller

**Objective:** Verify that when Stripe capture fails, the buyer does NOT see a completed/paid state.

**Steps:**
1. From an In Progress trade, simulate a capture failure (e.g., void the PI on Stripe Dashboard before completing).
2. As **test-buyer**, tap **[I Got It]** → **[Confirm]**.
3. Observe the error message.
4. Reopen the trade.

**Expected Result:**
- The error reads: **"Payment capture failed. Please try again or contact support."**
- The trade remains **In Progress** (not completed).
- No SP was released to the seller.
- No seller payout was triggered.
- The `tax_status` in `tax_records` is `'capture_failed'`.

### TC-O3-C05 · Admin dispute route: full refund with Stripe + tax reversal (captured trade)

**Ref:** TAX-REFUND-INTEGRITY §1
**Actors:** test-admin + test-buyer + test-seller

**Objective:** Verify that the admin dispute route issues a real Stripe refund and reverses tax.

**Steps:**
1. Complete a trade with a captured payment (buyer confirmed).
2. As **test-buyer**, open a dispute on the completed trade.
3. As **test-admin**, navigate to the dispute and tap **Resolve → Refund**.
4. Confirm.

**Expected Result:**
- Stripe Dashboard shows a refund for the full payment amount (cash + fee + tax).
- The trade status changes to **Cancelled**.
- `tax_records` shows `tax_status = 'refunded'`, `stripe_refund_id` is set, `refunded_at` is set.
- `refunded_tax_cents` equals the original `tax_amount_cents`.
- SP is released back to the buyer (idempotent — exactly once).
- The buyer receives a notification: "Your refund for [Item] has been issued."
- The Net Tax Payable on the reports page correctly reflects the refund.

### TC-O3-C06 · Duplicate refund/retry is idempotent

**Ref:** TAX-REFUND-INTEGRITY §1 (idempotency)
**Actors:** test-admin + test-buyer

**Objective:** Verify that retrying the refund action does not create a duplicate Stripe refund, duplicate tax reversal, or duplicate SP credit.

**Steps:**
1. From TC-O3-C05, resolve the same dispute again as **Refund**.
2. Check Stripe Dashboard for duplicate refunds.
3. Check `tax_records` for duplicate `refunded_tax_cents` addition.
4. Check SP ledger for duplicate `earn_refund` entries.

**Expected Result:**
- Stripe Dashboard shows exactly 1 refund (not 2).
- `tax_records.refunded_tax_cents` was not incremented again (idempotent).
- SP ledger has exactly 1 `earn_refund` entry.
- The response from `rpc_record_stripe_refund` includes `action: 'idempotent'`.

### TC-O3-C07 · Admin dispute route: uncaptured PI is cancelled (not refunded)

**Ref:** TAX-REFUND-INTEGRITY §1
**Actors:** test-admin + test-buyer + test-seller

**Objective:** Verify that for an uncaptured PI (In Progress, not yet completed), the dispute refund cancels the authorization hold instead of issuing a refund.

**Steps:**
1. From an In Progress trade (not yet completed), open a dispute.
2. As **test-admin**, resolve as **Refund**.
3. Check Stripe Dashboard for the PI.

**Expected Result:**
- Stripe Dashboard shows the PI as **canceled** (not refunded).
- Tax is marked as **voided** (not refunded), since no money was captured.
- SP is returned to the buyer.
- The trade is marked as cancelled.

### TC-O3-C08 · Admin dispute route: Stripe refund failure stays unresolved

**Ref:** TAX-REFUND-INTEGRITY §1, §2
**Actors:** test-admin + test-buyer + test-seller

**Objective:** Verify that when Stripe refund fails, the trade remains in an unresolved state and tax is not marked refunded.

**Steps:**
1. Complete a trade (captured), then open a dispute.
2. Before resolving, revoke the Stripe API key or simulate a refund failure.
3. As **test-admin**, attempt to resolve as **Refund**.
4. Observe the error.

**Expected Result:**
- The admin sees: "Stripe refund failed: [error message]".
- The dispute status remains **under_review** (not resolved).
- The trade status is NOT changed to cancelled.
- Tax is NOT marked as refunded.
- No SP is released.
- The buyer receives: "A refund for [Item] could not be processed. Our team is working on it."

### TC-O3-C09 · Stripe refund pending → tax pending_refund

**Ref:** TAX-REFUND-INTEGRITY §1
**Actors:** test-admin + test-buyer

**Objective:** Verify that when Stripe returns a pending refund status, tax is marked as pending_refund.

**Steps:**
1. Complete a trade, then open a dispute.
2. As **test-admin**, resolve as **Refund**.
3. Check `tax_records` before the refund completes (if Stripe returns `pending` or `processing`).

**Expected Result:**
- `tax_records.tax_status` = `'pending_refund'`
- `tax_records.stripe_refund_id` is set
- `tax_records.refund_status` = `'pending'` or `'processing'`
- The admin reports page shows this record in "Pending Refund" (not Tax Refunded).
- Once Stripe confirms, the `charge.refunded` webhook transitions it to `refunded`.

### TC-O3-C10 · Report: newly submitted offer with authorization only → Pending/Authorized Tax

**Ref:** TAX-REFUND-INTEGRITY §3 (reports)
**Actors:** test-buyer

**Objective:** Verify that newly submitted (quoted) offers appear in Pending/Authorized Tax, not Tax Collected or Net Tax Payable.

**Steps:**
1. Log in as **test-buyer** and submit an offer on a taxable item.
2. Run the report summary:
   ```sql
   SELECT jsonb_pretty(get_tax_summary_for_period(
     (SELECT created_at::date - 1 FROM tax_records ORDER BY created_at DESC LIMIT 1),
     (SELECT created_at::date + 1 FROM tax_records ORDER BY created_at DESC LIMIT 1),
     NULL, 'summary'
   ));
   ```

**Expected Result:**
- `tax_collected_cents` = 0 (no capture yet)
- `pending_tax_cents` > 0 (this offer is quoted)
- `pending_tax_count` = 1
- `tax_net_cents` = 0 (pending not included in net)

### TC-O3-C11 · Report: captured trade → Tax Collected using capture timestamp

**Ref:** TAX-REFUND-INTEGRITY §3
**Actors:** test-buyer + test-seller

**Objective:** Verify that a captured trade appears in Tax Collected using its capture timestamp, not its offer-creation timestamp.

**Steps:**
1. Complete a trade (buyer confirms → capture succeeds).
2. Run the report summary for the appropriate date range.

**Expected Result:**
- `tax_collected_cents` > 0 (this capture is counted)
- `tax_status` = `'collected'`
- `captured_at` is set and equals the Stripe capture time
- If the capture date differs from the offer-created date, the tax appears in the capture period, not the offer period.

### TC-O3-C12 · Report: cancelled/declined/expired → Voided/Expired Tax, not collected

**Ref:** TAX-REFUND-INTEGRITY §3
**Actors:** test-buyer + test-seller

**Objective:** Verify that cancelled, declined, and expired pre-capture offers appear as Voided/Expired Tax and are excluded from Tax Collected and Net Tax Payable.

**Steps:**
1. Have a pending offer that is cancelled (buyer cancels before seller accepts).
2. Run the report summary.

**Expected Result:**
- `tax_collected_cents` = 0 for this record
- `voided_tax_cents` > 0
- `voided_tax_count` includes this trade
- `tax_net_cents` excludes this voided tax

### TC-O3-C13 · Report: refunded trade → Tax Refunded, Net adjusts

**Ref:** TAX-REFUND-INTEGRITY §3
**Actors:** test-admin + test-buyer

**Objective:** Verify that a refunded trade correctly affects Tax Refunded and Net Tax Payable.

**Steps:**
1. Complete a trade (capture succeeds). Note the tax_collected_cents.
2. Issue a full refund via admin dispute.
3. Run the report summary covering both events.

**Expected Result:**
- `tax_collected_cents` includes the original captured tax.
- `tax_refunded_cents` equals the refunded tax.
- `tax_net_cents` = collected - refunded (correctly reduced).
- If the refund is in a later reporting period, the capture still appears in its original capture period.

### TC-O3-C14 · Report: CSV totals match on-screen totals

**Ref:** TAX-REFUND-INTEGRITY §3 (CSV export)
**Actors:** test-admin

**Objective:** Verify that CSV export totals match the on-screen report totals for the same filters and date range.

**Steps:**
1. Run the report summary for a date range and note the totals.
2. Export CSV for the same date range.
3. Sum the CSV columns and compare.

**Expected Result:**
- Sum of CSV `tax_amount_cents` column matches `tax_collected_cents` from the summary.
- Sum of CSV `tax_refunded_cents` matches `tax_refunded_cents` from the summary.
- Sum of CSV `net_tax_cents` matches `tax_net_cents` from the summary.
- Count of CSV rows with `tax_status = 'collected'` matches the summary `transaction_count` for captured.

### TC-O3-C15 · Report: unauthorized user cannot access reports, exports, or refunds

**Ref:** TAX-REFUND-INTEGRITY §3 (admin permissions)
**Actors:** test-seller (non-admin)

**Objective:** Verify that non-admin users cannot access tax reports, CSV export, or refund actions.

**Steps:**
1. Log in to the admin portal as **test-seller** (non-admin).
2. Navigate to `/tax/reports` directly.
3. Attempt to run a report.
4. Attempt to export CSV.

**Expected Result:**
- The RPC returns `FORBIDDEN: Admin role required`.
- Export button fails with an authorization error.
- Refund/dispute resolution buttons are absent or disabled.

### TC-O3-C16 · Legacy/unverifiable records show reconciliation-required instead of collected

**Ref:** TAX-REFUND-INTEGRITY §7 (backfill)
**Actors:** test-admin

**Objective:** Verify that legacy records marked as 'collected' without a captured_at timestamp are flagged as reconciliation_required by the backfill migration.

**Steps:**
1. Run the backfill verification query:
   ```sql
   SELECT tax_status, reconciliation_status, reconciliation_reason
   FROM public.tax_records
   WHERE captured_at IS NULL AND stripe_capture_id IS NULL
     AND tax_status IN ('collected', 'reconciliation_required');
   ```
2. Check the admin report for `reconciliation_count`.

**Expected Result:**
- Legacy records without captured_at or stripe_capture_id are now `reconciliation_required`.
- The admin Reports page shows them in "Reconciliation Required" (not in Tax Collected).
- The backfill reason explains: "Backfill: Marked collected by status-only heuristic..."

### TC-O3-C17 · Seller does not see "Paid" or "Payment authorized" (seller sees payout info)

**Ref:** TAX-REFUND-INTEGRITY §4
**Actors:** test-seller

**Objective:** Verify the seller's Trade Timeline shows payout information, not the buyer's payment authorization label.

**Steps:**
1. From a completed trade, log in as **test-seller**.
2. Open the Trade Timeline.
3. Scroll to the payment section.

**Expected Result:**
- The seller does NOT see "Cash Paid", "Payment authorized", or "Paid" labels.
- The seller sees "Cash Amount:" (for their payout reference).
- The Tax line is NOT shown to the seller.
- SP earned is shown if applicable.

### TC-O3-C18 · Platform-fee-in-tax-base toggle is reflected in CSV and transaction detail without changing historical snapshots

**Ref:** TAX-REFUND-INTEGRITY §3 (snapshot integrity)
**Actors:** test-admin + test-buyer

**Objective:** Verify that toggling `include_fee_in_tax_base` changes the CSV/transaction output for new records without altering historical snapshots.

**Steps:**
1. Export CSV for a date range that includes records created before and after the toggle change.
2. Check the `fee_in_tax_base` and `taxable_item_subtotal` columns.

**Expected Result:**
- Records created before the toggle: `fee_in_tax_base = 'false'`, taxable base excludes the fee.
- Records created after the toggle: `fee_in_tax_base = 'true'`, taxable base includes the fee.
- Historical records' snapshots are unchanged.
- CSV rows reflect each record's immutable snapshot.

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

**Ref:** FLOW-27 · TC-B04/TC-C02
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

### TC-R02 · Seller declines pending offer → cancelled, SP restored

**Ref:** FLOW-27 · TC-B01/TC-C02
**Actors:** test-buyer + test-seller

**Objective:** Verify a seller decline cancels the trade and releases the buyer's hold.

**Steps:**
1. With a Pending SP offer, log in as **test-seller** and decline it.

**Expected Result:**
- The trade becomes **Cancelled** (seller decline); the buyer's payment authorization is released and reserved SP is restored to available.
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
- The buyer is fully refunded (see TC-R06) and any SP is restored (see TC-R07).
- A seller consequence level (1/2/3) is applied per prior post-acceptance cancellations; at level 3 the seller is flagged for admin review.

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

## Group S — Seller Group & Bundle Discovery

> **Added:** 2026-07-13 — Seller masking leak fix + "More from this seller" page + "Matches Your Cart" on filtered page + bundle CTA.
> **Updated:** 2026-07-13 — Replaced Discover-grid badge approach with "More from this seller" entry point on ItemDetailScreen.

### TC-S01 · Different-seller modal uses generic copy (no seller name leak)

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

### TC-S02 · "More from this seller" icon appears when seller has 2+ approved listings

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

### TC-S03 · "More from this seller" icon hidden when seller has exactly 1 listing

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

### TC-S04 · Tapping icon opens "More from this seller" page — no seller identity

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

### TC-S05 · Add to Cart from filtered seller page populates cart correctly

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

### TC-S06 · "Matches Your Cart" indicator on filtered seller page

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

### TC-S07 · Bundle CTA appears on CartScreen with 2+ same-seller items

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

### TC-S08 · Bundle CTA hidden with single item or empty cart

**Ref:** SELLER-GROUP-005
**Actors:** test-buyer

**Steps:**
1. Clear cart → verify no bundle CTA.
2. Add a single item → verify no bundle CTA.

**Expected Result:**
- Bundle CTA absent for 0 or 1 items.

---

### TC-S09 · Bundle CTA navigates to checkout in bundle mode

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

### TC-S10 · Bundle checkout banner absent on regular checkout

**Ref:** SELLER-GROUP-005

**Steps:**
1. With 2+ items, tap regular Checkout → no bundle banner.
2. Go back, tap Bundle CTA → bundle banner visible.

**Expected Result:**
- Regular Checkout: no bundle banner. Bundle CTA: banner present.

---

### TC-S11 · Regression: Discover/search grid unchanged (no badges)

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

### TC-S12 · Regression: single-item offer flow unchanged

**Ref:** FLOW-08 · TRADING-FLOW-V2 §7
**Actors:** test-buyer + test-seller

**Steps:**
1. Execute TC-A01 (Cash Only happy path).
2. Execute TC-A02 (Accept SP happy path).

**Expected Result:**
- Both flows pass identically. No regressions from seller-group/masking changes.

---

### TC-S13 · Regression: seller identity unlocks only post-acceptance

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

### TC-S14 · More from seller — Item Detail CTA in standalone position (below seller card)

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

### TC-S15 · More from seller — Item Detail CTA hidden at 0 additional listings

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer + test-seller with only 1 approved listing

**Steps:**
1. Navigate to ItemDetailScreen for the seller's only listing.
2. Scroll down.

**Expected Result:**
- No "more from this seller" banner appears anywhere on the screen.
- Everything else in the Seller Info card renders normally.

### TC-S16 · More from seller — Item Detail CTA does not disrupt "Matches Your Cart" badge

**Ref:** SELLER-GROUP-004, SELLER-GROUP-007
**Actors:** test-buyer (active cart matches seller) + test-seller

**Steps:**
1. Ensure buyer has an active cart containing items from test-seller.
2. Navigate to ItemDetailScreen for a different listing from the same seller.
3. Observe the Seller Info card.

**Expected Result:**
- "Matches Your Cart" badge is still visible inside the seller card (not moved).
- The standalone CTA is below the card. Both elements visible and legible.

### TC-S17 · More from seller — Trade Basket banner shows correct remaining-item count

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

### TC-S18 · More from seller — Trade Basket banner recalculates after adding item from filtered page

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer with 1 item in cart, test-seller with 4 total listings

**Steps:**
1. From Trade Basket, tap the "View" link on the banner → opens MoreFromThisSeller page.
2. Tap "Add to Trade Basket" on one of the items there → item is added.
3. Navigate back to Trade Basket.

**Expected Result:**
- Banner now reads "This seller has 2 more items" (was 3, now 2).
- The count correctly decreased by 1.

### TC-S19 · More from seller — Trade Basket banner disappears when all seller's listings are in basket

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer, test-seller with 3 total listings

**Steps:**
1. Add all 3 of the seller's listings to the cart.
2. Open Trade Basket.

**Expected Result:**
- No "more from this seller" banner appears.
- All 3 items are listed in the cart.

### TC-S20 · More from seller — Trade Basket banner dismissible via X button

**Ref:** SELLER-GROUP-007
**Actors:** test-buyer with 1 item in cart, seller with 3+ listings

**Steps:**
1. Open Trade Basket → banner is visible.
2. Tap the X dismiss button on the banner.

**Expected Result:**
- Banner disappears and does not reappear during this cart session.
- All other cart content (items, summary, buttons) is unaffected.

### TC-S21 · More from seller — Banner and filtered page never reveal seller identity

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

### TC-S22 · Regression: Seller Info card elements unchanged

**Ref:** TASK-ITEM-DETAILS-001
**Actors:** test-buyer, test-seller

**Steps:**
1. Navigate to ItemDetailScreen for any listing.
2. Observe all elements in the Seller Info card.

**Expected Result:**
- Avatar, masked name (with lock icon), rating stars, "Matches Your Cart" badge (if applicable), Contact Seller button, View Profile button — all present at their original positions.
- Only the old inline "X more items" text is gone from inside the card.

### TC-S23 · Regression: Trade Basket subtotal/total/bundle CTA layout unaffected

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

### TC-S24 · More from seller — Return-to-Cart navigation after adding item from filtered page

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

> **Added:** 2026-07-15 — Per-item points toggles, wallet balance validation, category caps, seller payout breakdown, SP transfer on acceptance.

### TC-T01 · Points toggle appears only on eligible items

**Ref:** FLOW-08 · FLOW-11
**Actors:** test-buyer (Kids Club+ subscriber) + test-seller (with both Accept SP and Cash Only listings)

**Steps:**
1. Add 2 items to cart from same seller: one with Accept SP, one Cash Only.
2. Navigate to CartCheckout (bundle mode).
3. Observe each item row.

**Expected Result:**
- The Accept SP item shows a toggle switch next to its price.
- The Cash Only item shows a "Not eligible for points" label with NO toggle.

### TC-T02 · Toggle ON applies correct amount (balance + cap sufficient)

**Ref:** FLOW-11
**Actors:** test-buyer with 500+ SP wallet balance

**Steps:**
1. Add an Accept SP item ($40 price) to cart.
2. Navigate to checkout. Toggle points ON for the item.
3. Verify the applied amount and label.

**Expected Result:**
- 20 pts applied (50% of $40). Label shows "20 pts applied" (no "balance limit" suffix).
- Points remaining counter decreases by 20.

### TC-T03 · Toggle ON shows "balance limit" when wallet insufficient

**Ref:** FLOW-11
**Actors:** test-buyer with 8 SP wallet balance

**Steps:**
1. Add an Accept SP item ($40 price) to cart.
2. Navigate to checkout. Toggle points ON for the item.
3. Verify the applied amount and label.

**Expected Result:**
- 8 pts applied (limited by wallet, not by 50% cap which would be 20).
- Label shows "8 of 20 pts applied — balance limit".
- Points remaining counter shows 0.

### TC-T04 · Category cap limits applied points

**Ref:** FLOW-11
**Actors:** test-buyer with 200 SP, admin sets category cap to 10 for selected category

**Steps:**
1. Admin: set `sp_redemption_cap = 10` on the item's category.
2. Add that Accept SP item ($100 price) to cart as test-buyer.
3. Navigate to checkout, toggle points ON.

**Expected Result:**
- 10 pts applied (category cap of 10, even though 50% cap = 50 and wallet has 200).
- Label shows "10 pts applied (category cap: 10)".

### TC-T05 · Toggle OFF restores balance for sequential allocation

**Ref:** FLOW-11
**Actors:** test-buyer with 30 SP wallet balance

**Steps:**
1. Add 2 Accept SP items to cart: Item A ($40) and Item B ($30).
2. Toggle ON Item A → 20 pts applied (50% of $40). Remaining: 10.
3. Toggle ON Item B → 10 pts applied (wallet-limited). Remaining: 0.
4. Toggle OFF Item A → its 20 pts restored. Remaining: 20.
5. Toggle ON Item A again → 20 pts applied (from restored balance).

**Expected Result:**
- Step 3: Item B shows "10 of 15 pts applied — balance limit".
- Step 4: Remaining counter jumps to 20.
- Step 5: Item A gets full 20 pts back.

### TC-T06 · Points remaining counter updates in real time

**Ref:** FLOW-11
**Actors:** test-buyer with 50 SP

**Steps:**
1. Add 3 Accept SP items. Rapidly toggle each ON then OFF.
2. Observe the "Points remaining: X" counter after each action.

**Expected Result:**
- Counter updates immediately after each toggle with no flicker or stale value.
- After all toggled OFF, counter shows original wallet balance.

### TC-T07 · Order Summary points math correct

**Ref:** FLOW-08 · FLOW-11
**Actors:** test-buyer with 100 SP

**Steps:**
1. Add 2 Accept SP items: Item A ($40, toggle 20 pts), Item B ($30, toggle 15 pts).
2. Verify Order Summary.

**Expected Result:**
- Subtotal: $70.00
- Points Applied: -$35.00
- Platform Fee: $0.99 (subscriber)
- Cash Total: $35.00 + $0.99 + tax = correct value
- "Send Offer" button shows correct cash total.

### TC-T08 · Seller Review Offer shows per-item points breakdown

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

### TC-T09 · Seller sees Total Payout vs Buyer's Total Paid

**Ref:** FLOW-08
**Actors:** test-buyer + test-seller

**Steps:**
1. Seller reviews offer with points applied.
2. Verify the payout breakdown card and bundle totals.

**Expected Result:**
- "Your Payout" card shows: Item Price, Points Applied (deduction), Net Cash Payout.
- Bundle totals show: "Buyer's Total Paid" (cash from buyer) AND "Total Payout" (price - points, does NOT include platform bonus).
- "Total Payout" < "Buyer's Total Paid" when points are applied (because platform fee is separate from payout).

### TC-T10 · "Includes points redemption" tag on seller's offer list

**Ref:** FLOW-08
**Actors:** test-buyer + test-seller

**Steps:**
1. Buyer submits bundle offer with SP applied.
2. Seller opens Offers tab / Trade List.

**Expected Result:**
- The offer card shows a green "Includes points redemption" tag.
- An offer WITHOUT points does NOT show this tag.

### TC-T11 · Wallet ledger on acceptance (buyer debited, seller credited + bonus)

**Ref:** FLOW-11
**Actors:** test-buyer + test-seller

**Steps:**
1. Buyer submits offer with 10 SP applied.
2. Seller accepts the offer.
3. Check both parties' SP wallets and sp_ledger.

**Expected Result:**
- Buyer wallet: available_balance unchanged (was reserved at offer time), reserved_sp decreased by 10.
- Seller wallet: pending_balance increased by 10 + platform bonus.
- sp_ledger: buyer has `spend_purchase` entry for -10; seller has `earn_reward` entry for 10 + bonus.
- `trades.sp_transferred_at` is set.

### TC-T12 · No ledger transaction on offer decline

**Ref:** FLOW-11
**Actors:** test-buyer + test-seller

**Steps:**
1. Buyer submits offer with 10 SP applied.
2. Seller declines the offer.

**Expected Result:**
- No new sp_ledger entries for seller (no earn).
- Buyer's reserved SP is released (via existing cancel flow).
- `trades.sp_transferred_at` remains NULL.

### TC-T13 · Regression: single-item (non-bundle) SP flow still works

**Ref:** FLOW-08
**Actors:** test-buyer + test-seller

**Steps:**
1. Use TradeOfferScreen (single item, not cart) to submit an offer with SP.
2. Complete the full flow: submit → seller accepts → buyer confirms.

**Expected Result:**
- All existing SP behavior unchanged: SP reserved on offer, transferred at completion (or acceptance), no errors.

### TC-T14 · Regression: bundle CTA, different-seller modal, "more from this seller" still functional

**Ref:** FLOW-08 · SELLER-GROUP
**Actors:** test-buyer

**Steps:**
1. Add 2+ items from same seller → bundle CTA appears.
2. Add item from different seller → different-seller modal.
3. Visit ItemDetailScreen for seller with 2+ listings → "More from this seller" CTA.

**Expected Result:**
- All flows function exactly as before. No regression from points-redemption changes.

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
| Seller declines offer (S2) | TC-B01 |
| Offer expiry + seller ignore prompt (S3) | TC-B02 |
| Multiple competing offers — sort + auto-decline (S6) | TC-B03 |
| Buyer cancel pending — no consequence | TC-B04 |
| Per-seller cap: max 3 pending offers per seller | TC-B05 |
| Per-seller cap: cross-seller offers unaffected | TC-B05a |
| Per-seller cap: blocked at 4th to same seller | TC-B05b |
| Per-seller cap: bundle = 1 slot | TC-B05c |
| Per-seller cap: expiry frees slot | TC-B05d |
| Regression: no leftover global cap | TC-B05e |
| Admin config: change cap 3→5 | TC-B05f |
| Admin config: revert cap 5→3 | TC-B05g |
| Admin config: validation 1-10 | TC-B05h |
| Config fetch failure: graceful | TC-B05i |
| Regression: per-seller + bundle with non-default cap | TC-B05j |
| Card declined at submission | TC-B06 |
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
| Bundle banner on trade detail | TC-L01 |
| Confirm All shortcut for bundle | TC-L02 |
| Bundle offer rows in Offers tab | TC-L03 |
| Non-bundle offers single rows | TC-L04 |
| In-progress bundles in Buying tab | TC-L05 |
| Bundle banner in Review Offer screen | TC-L06 |
| Accept All N Items button | TC-L07 |
| Individual accept/decline alongside bundle | TC-L08 |
| Bundle card in Your Offers (buyer) | TC-L09 |
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
| Admin — minimum cart value config reflects in app | TC-N01 |
| Admin — minimum cart value validation | TC-N02 |
| Admin — Minimum Listing Price config on Fees tab | TC-N03 |
| Seller — single-item listing blocked below min price | TC-N04 |
| Bulk — below-threshold items flagged, valid items publish | TC-N05 |
| Listing — auto-paused when threshold raised above price | TC-N06 |
| Listing — repurchasable after seller raises to meet threshold | TC-N07 |
| Regression — single-item + bundle checkout at/above threshold | TC-N08 |
| Tax — checkout breakdown shows sales tax (0 SP) | TC-O01 |
| Tax — recalculates on SP-discounted amount | TC-O02, TC-K01 |
| Tax — $0 when disabled globally | TC-O03 |
| Tax — $0 when node tax disabled | TC-O04 |
| Tax — tax-exempt Tax Free badge | TC-O05 |
| Tax — transaction history tax details | TC-O06 |
| Tax — proportional refund | TC-O07 |
| Admin tax — node rate config + validation | TC-P01 |
| Admin tax — bulk update | TC-P02 |
| Admin tax — rate change history / audit | TC-P03 |
| Admin tax — global settings + warning banner | TC-P04 |
| Admin tax — reporting summary + date presets | TC-P05 |
| Admin tax — jurisdiction breakdown + 7 report types | TC-P06 |
| Admin tax — CSV export | TC-P07 |
| Admin tax — rate change applies to new transactions | TC-P08 |
| Value stack includes sales tax line | TC-K01, TC-K02 |
| Item Detail screen shows sales tax in Price Breakdown | TC-K01, TC-K02 |
| Cart Checkout order summary shows sales tax | TC-O01 |
| Trade timeline shows sales tax for buyer (in-progress preview, completed stored) | TC-O06, TC-O08 |
| Trade detail shows sales tax for buyer only | TC-O08 |
| Sales tax hidden from seller on all trade screens | TC-K01 (seller variant), TC-O08 |
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
| Seller masking — modal uses generic copy (no leak) | TC-S01 |
| Seller masking — "More from this seller" icon visible (2+ listings) | TC-S02 |
| Seller masking — "More from this seller" icon hidden (1 listing) | TC-S03 |
| Seller masking — filtered page shows zero seller identity | TC-S04 |
| Seller masking — Add to Cart from filtered page | TC-S05 |
| Seller masking — "Matches Your Cart" on filtered page | TC-S06 |
| Bundle CTA — appears with 2+ same-seller items | TC-S07 |
| Bundle CTA — hidden with 0-1 items | TC-S08 |
| Bundle CTA — navigates to bundle checkout | TC-S09 |
| Bundle checkout — banner shown only on bundle path | TC-S10 |
| Regression — Discover grid clean (no badges) | TC-S11 |
| Regression — single-item flow unchanged | TC-S12 |
| Regression — seller identity unlocks only post-acceptance | TC-S13 |
| More from seller — Item Detail CTA in standalone position (below seller card) | TC-S14 |
| More from seller — Item Detail CTA hidden at 0 additional listings | TC-S15 |
| More from seller — Item Detail CTA does not disrupt "Matches Your Cart" badge | TC-S16 |
| More from seller — Trade Basket banner shows correct remaining-item count | TC-S17 |
| More from seller — Trade Basket banner recalculates after adding item from filtered page | TC-S18 |
| More from seller — Trade Basket banner disappears when all seller's listings are in basket | TC-S19 |
| More from seller — Trade Basket banner dismissible via X button | TC-S20 |
| More from seller — Banner and filtered page never reveal seller identity | TC-S21 |
| More from seller — Regression: Seller Info card unchanged (rating, Contact, View Profile) | TC-S22 |
| More from seller — Regression: Trade Basket subtotal/total/bundle CTA layout unaffected | TC-S23 |
| More from seller — Return-to-Cart navigation after adding item from filtered page | TC-S24 |
