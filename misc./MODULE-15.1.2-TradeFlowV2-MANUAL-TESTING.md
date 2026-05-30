# MODULE-15.1.2 TradeFlowV2 — Manual Testing Guide

**Source of truth:** `docx/TRADING-FLOW-V2.md` (v2.1, May 26 2026) · `Prompts/MODULE-15.2-cart-system.md` · `Prompts/MODULE-15.3-PART3-TAX-TASKS-RESTRUCTURED.md` · `Prompts/Done/MODULE-08-REVIEWS-RATINGS.md` · `docs/flow-registry.md` (FLOW-27)
**Tasks covered:** Core Trade Flows · Payment Authorization · SP Behavior · Dispute Flow · Payout · Countdown Timers · Notifications · Completion CTAs · Safety UX · Seller Consequences · Bundle Flows · Cart System · Sales Tax Engine · Reviews & Ratings · Refund & Cancellation State Machine
**Last updated:** 2026-05-30
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
| **K — Value Stack & Fees** | TC-K01 | Subscriber sees $0.99 fee in value stack |
| | TC-K02 | Non-subscriber sees $2.99 fee in value stack |
| | TC-K03 | SP discount row conditional on SP used |
| **L — Bundle Flows** | TC-L01 | Bundle banner on trade detail |
| | TC-L02 | Confirm All shortcut for bundle (buyer) |
| | TC-L03 | Bundle offer rows in Offers tab (seller) |
| | TC-L04 | Non-bundle offers render as single rows |
| | TC-L05 | In-progress bundles section in Buying tab |
| | TC-L06 | Bundle banner in Review Offer screen |
| | TC-L07 | Accept All N Items in Review Offer screen |
| | TC-L08 | Individual accept/decline alongside bundle siblings |
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
| **O — Tax (End User)** | TC-O01 | Sales tax shown in checkout breakdown (0 SP) |
| | TC-O02 | Tax recalculates on SP slider change |
| | TC-O03 | Tax $0 when globally disabled |
| | TC-O04 | Tax $0 when node tax disabled |
| | TC-O05 | Tax-exempt user sees Tax Free badge |
| | TC-O06 | Transaction history shows tax details |
| | TC-O07 | Refund shows proportional tax refunded |
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
| | TC-R07 | SP reversal on refund (reserved/transferred returned) |
| | TC-R08 | Seller payout withheld / cancelled on refund |
| | TC-R09 | Admin dispute resolve → Refund (full settlement) |
| | TC-R10 | Admin dispute resolve → Complete (no refund) |
| | TC-R11 | Refund / cancellation notifications to both parties |
| | TC-R12 | Refund idempotency — no double refund |
| | TC-R13 | Cancelled / refunded trade status + timeline |

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

### TC-A02 · Accept SP: Use SP slider → seller accepts → buyer confirms

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
- The item shows an "Accept SP" badge with two buttons: **[Request to Buy]** and **[Use SP]**.
- The slider ranges from 0 to $15 (50% of $30); at $8 it shows "$22 cash + 8 SP = $30 total", platform fee $0.99 (subscriber), and total cash $22.99.
- The slider clamps at $15 and refuses any higher value.
- After submitting: the buyer's wallet shows 8 SP moved from available to reserved.
- The seller's offer row shows "$22 cash + 8 SP — Total: $30"; the Review screen shows the combined SP releasing at completion.
- While In Progress, the buyer's SP stays reserved (not yet transferred to the seller).
- After the buyer confirms: the trade completes; the buyer sees "Got it! You saved $8 using SP."; the seller's completion screen shows the SP (buyer 8 SP + platform reward) added to their pending wallet with a [View Wallet] button; the buyer's reserved SP returns to 0.

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

### TC-B02 · Offer expires (seller never responds) + seller ignore prompt

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

**Ref:** TRADING-FLOW-V2 §11.7
**Actors:** test-buyer

**Objective:** Verify a buyer can cancel a pending trade without triggering any seller-style consequence warning.

**Steps:**
1. Log in as **Buyer** and open a **pending** trade from **Trades → Buying**.
2. Tap **[Cancel Trade]**.
3. Select a reason and confirm.

**Expected Result:**
- A cancellation reason modal with standard buyer reasons appears.
- After confirming, a generic "Trade Cancelled" message appears with **no** Level 1/2/3 consequence text.
- Any SP reserved by the buyer is restored.

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

**Objective:** Verify a disputed trade does not auto-complete.

**Steps:**
1. Open an **In Progress** trade that has a reported dispute.
2. Allow the auto-complete time to pass.
3. Reopen the trade.

**Expected Result:**
- The trade stays **In Progress** and is not completed; the dispute remains open.

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
- After submitting, a toast appears: "Issue reported. Our team will review within 24 hours."; the trade enters a disputed state and the seller plus admin are notified.

---

### TC-E02 · Disputed trade does not auto-complete or release SP

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

### TC-E03 · Buyer UI during active dispute

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

## Group L — Bundle Flows

**Ref:** TRADING-FLOW-V2 §11.3.1

### TC-L01 · Bundle banner on trade detail

**Actors:** test-buyer
**Precondition:** An In Progress trade belongs to a bundle.

**Objective:** Verify the bundle banner shows on a bundled trade and is absent otherwise.

**Steps:**
1. Log in as **test-buyer** and open a bundled trade from **Trades → Buying**.
2. Open a non-bundle trade.

**Expected Result:**
- The bundled trade shows a green banner: "Part of a bundle · N items".
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

## Group M — Cart (End User)

### TC-M01 · Add first item creates an active cart

**Actors:** test-buyer

**Objective:** Verify adding the first item from a seller creates an active cart.

**Steps:**
1. Log in as **test-buyer** and open an available item from **test-seller**.
2. Tap **Add to Cart**.
3. Open the **Cart** screen from the bottom nav.

**Expected Result:**
- A confirmation appears (e.g., a toast or the cart badge increments to 1).
- The Cart screen shows the seller name and the single item with its title, photo, and price.

### TC-M02 · Add second item from the same seller

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

## Group O — Tax (End User)

### TC-O01 · Sales tax shown in checkout breakdown (0 SP)

**Actors:** test-buyer

**Precondition:** The buyer's node has a tax rate configured (e.g., 6.35%) and sales tax is enabled globally.

**Objective:** Verify the checkout breakdown shows a sales tax line with no SP applied.

**Steps:**
1. Log in as **test-buyer** and start checkout on an item without applying any SP.
2. Review the price breakdown.

**Expected Result:**
- The breakdown shows, in order: Item Price → Subtotal → **Sales Tax** → Platform Fee → Total.
- The Sales Tax amount equals the node rate applied to the subtotal (item price), and the Total includes it.
- The label reads "Sales Tax" (kid-friendly), not a technical jurisdiction name.

### TC-O02 · Tax recalculates on SP slider change

**Actors:** test-buyer (subscriber)

**Objective:** Verify sales tax is calculated on the SP-discounted amount and updates as SP changes.

**Steps:**
1. Start checkout on an SP-eligible item as **test-buyer**.
2. Move the SP slider up (e.g., apply the maximum 50%).
3. Watch the breakdown update.

**Expected Result:**
- The Subtotal drops by the SP discount and the **Sales Tax** recalculates on the lower (discounted) amount within ~300ms.
- The Total updates accordingly. The platform fee is still charged in cash.

### TC-O03 · Tax is $0 when sales tax is disabled globally

**Actors:** Admin, test-buyer

**Objective:** Verify no tax is charged when sales tax is turned off globally.

**Steps:**
1. In the **admin portal**, disable sales tax globally.
2. As **test-buyer**, start checkout on any item.

**Expected Result:**
- The breakdown shows $0.00 sales tax (or the Sales Tax line is hidden).
- The Total contains no tax.

### TC-O04 · Tax is $0 when the node tax is disabled

**Actors:** Admin, test-buyer

**Objective:** Verify no tax is charged when the buyer's node has tax disabled while global tax is on.

**Steps:**
1. In the **admin portal**, keep global tax enabled but disable tax for the buyer's node.
2. As **test-buyer** in that node, start checkout.

**Expected Result:**
- The Sales Tax line shows $0.00 for items in that node.
- The Total contains no tax.

### TC-O05 · Tax-exempt user sees a Tax Free badge

**Actors:** test-buyer (tax-exempt)

**Objective:** Verify a tax-exempt buyer sees a Tax Free indicator at checkout.

**Steps:**
1. Log in as a tax-exempt **test-buyer** and start checkout.

**Expected Result:**
- A "Tax Free" badge is shown and the Sales Tax line is $0.00.

### TC-O06 · Transaction history shows tax details

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
