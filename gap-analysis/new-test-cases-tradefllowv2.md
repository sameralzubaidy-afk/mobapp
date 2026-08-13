# STAGING — New Test Cases (TradeFlowV2)

> **STATUS: DRAFT — DO NOT MERGE into the canonical file without explicit per-batch approval.**
> **Target canonical file:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
> **Drafted:** 2026-08-13 · grounded against current source (`p2p-kids-marketplace/src/screens/trade/TradeDisputeScreen.tsx` re-read this session; `TradeOfferScreen.tsx`, `TradeListScreen.tsx`, `TradeTimelineScreen.tsx` read this session via exploration).
> **Entry format:** matches this file's convention — `### TC-XXX · Description` heading, then `**Ref:**`, `**Actors:**`, `**Objective:**`, numbered `**Steps:**`, bulleted `**Expected Result:**`. Plain `### TC-XXX` (no "Passed"/"new" status prefix) since these are new, unexecuted cases.
> **Merge instructions:** append `E07–E10` to Group E and `B10–B13` to Group B; insert new Group Y after Group W (before the non-indexed `## Regression checks` section); add the matching rows to the `Test Case Index` table.

---

## Index addendum (rows to add to the `Test Case Index` table)

| Group | TC# | Description |
|---|---|---|
| **B — Offer Lifecycle** | TC-B10 | Replace Card path (saved card → new card) |
| | TC-B11 | Subscribe-upsell → JoinKidsClub |
| | TC-B12 | SP info tooltip (not wired — flag) |
| | TC-B13 | Duplicate-offer modal navigation (dead code — flag) |
| **E — Dispute Flow** | TC-E07 | Trade Dispute — no reason (disabled submit) |
| | TC-E08 | Trade Dispute — reason selected (non-Other) |
| | TC-E09 | Trade Dispute — "Other" + min-20 description |
| | TC-E10 | Trade Dispute — submitting + confirm + success/error |
| **Y — Trade List & Timeline** | TC-Y01 | Trade List summary filter chips |
| | TC-Y02 | Trade List Load More history pagination |
| | TC-Y03 | Trade List Message button on rows |
| | TC-Y04 | Trade List "See all →" link |
| | TC-Y05 | R15 — Request More Time (requester) |
| | TC-Y06 | R15 — counterparty Accept |
| | TC-Y07 | R15 — counterparty Decline |
| | TC-Y08 | R15 — granted state |
| | TC-Y09 | "What to do next" card + "Got it" toggle |

---

## Group B — Offer Lifecycle (additions)

### TC-B10 · Replace Card path (saved card → new card)

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

### TC-B11 · Subscribe-upsell → JoinKidsClub

**Ref:** TradeOfferScreen (route `TradeInitiation`)
**Actors:** test-free

**Objective:** Verify the SP upsell card routes a free user to the Kids Club join screen.

**Steps:**
1. As a free user, open the offer screen and locate the upsell card.
2. Tap **Try Kids Club+ Free**.

**Expected Result:**
- Card reads `Save up to {maxSpPercentage}% with Swap Points` with body `Kids Club+ members can use Swap Points to save on every trade. Try it free for 30 days.`
- Tapping the button navigates to **JoinKidsClub**.

### TC-B12 · SP info tooltip (not wired — flag)

**Ref:** TradeOfferScreen · `SPInfoTooltip`
**Actors:** test-buyer

**Objective:** Document the SP info tooltip component state.

**Steps:**
1. On the offer screen, attempt to open the SP info tooltip.

**Expected Result:**
- `SPInfoTooltip` is imported and rendered, but no on-screen trigger sets its visibility — it is present-but-not-wired.
- **Flag:** no test can be authored for opening the tooltip until a trigger is wired; this documents the current dead wiring.

### TC-B13 · Duplicate-offer modal navigation (dead code — flag)

**Ref:** TradeOfferScreen · duplicate-offer `isDuplicate` modal
**Actors:** test-buyer

**Objective:** Document the duplicate-offer modal branch.

**Steps:**
1. Attempt to submit a duplicate offer on an item with an existing active offer.

**Expected Result:**
- The modal's duplicate branch would show **Go to Trade History** → `TradeList` (with **Dismiss**), but no code path currently sets `isDuplicate: true` — the single error path hardcodes `isDuplicate: false`.
- **Flag:** this branch is currently dead code; authoring a runnable case is not possible until a code path sets `isDuplicate` (or the branch is removed).

---

## Group E — Dispute Flow (additions)

### TC-E07 · Trade Dispute — no reason (disabled submit)

**Ref:** FLOW-08-05 · TradeDisputeScreen
**Actors:** test-buyer

**Objective:** Verify Submit is disabled until a reason is selected.

**Steps:**
1. Open the Trade Dispute screen (heading **File a Dispute**) for a trade.
2. Observe the **Submit Dispute** button with no reason selected.

**Expected Result:**
- The warning banner reads `Filing a dispute is a serious action. Please provide accurate information.`
- The five reason chips render: **Item not as described** · **Item not received** · **Safety concern** · **Payment issue** · **Other** (each with its description line).
- **Submit Dispute** is disabled while no reason is selected.
- **Flag:** the header comment mentions "Evidence upload with Camera icon", but the rendered screen has no evidence-upload section (stale comment).

### TC-E08 · Trade Dispute — reason selected (non-Other)

**Ref:** FLOW-08-05 · TradeDisputeScreen
**Actors:** test-buyer

**Objective:** Verify selecting a non-"Other" reason enables submit without requiring a description.

**Steps:**
1. Tap **Item not as described**.
2. Observe the description section and the submit button.

**Expected Result:**
- The chip shows the selected (red) state.
- No **DESCRIPTION** textarea appears for a non-"Other" reason.
- **Submit Dispute** becomes enabled.
- Tapping the selected chip again deselects it (and re-disables submit).

### TC-E09 · Trade Dispute — "Other" + min-20 description

**Ref:** FLOW-08-05 · TradeDisputeScreen
**Actors:** test-buyer

**Objective:** Verify the "Other" description requirement (min 20 chars, max 1000).

**Steps:**
1. Tap **Other**.
2. Enter a short description (e.g., 10 characters).
3. Then enter a description of 20 or more characters.

**Expected Result:**
- A **DESCRIPTION** textarea appears with placeholder `Describe what happened in detail...` and a `{n}/1000` character counter.
- With fewer than 20 characters, **Submit Dispute** stays disabled (guard: `Please provide a detailed description (minimum 20 characters)`).
- At 20+ characters the button enables; input is capped at 1000 characters.
- Selecting a different reason clears the description.

### TC-E10 · Trade Dispute — submitting + confirm + success/error

**Ref:** FLOW-08-05 · TradeDisputeScreen · `open-dispute`
**Actors:** test-buyer

**Objective:** Verify the confirm flow, submitting state, and the success navigation.

**Steps:**
1. Select a reason (and, for **Other**, a valid description) and tap **Submit Dispute**.
2. In the confirm alert, tap **Cancel** (first pass), then repeat and tap **Submit**.

**Expected Result:**
- Confirm alert **Submit Dispute** reads `Are you sure you want to file a dispute? Our support team will review your case.` with **Cancel** / **Submit**.
- **Cancel** returns without filing.
- On **Submit**, the button shows a spinner while `open-dispute` runs (body: `trade_id`, `reason`, `description`).
- On success, **Dispute Reported** reads `Your dispute has been reported. The seller will be notified and you can continue discussing via messages.` and **OK** navigates to `TradeTimeline` (same trade).
- On failure, an **Error** alert shows the message and the user stays on the screen.

---

## Group Y — Trade List & Timeline

### TC-Y01 · Trade List summary filter chips

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

### TC-Y02 · Trade List Load More history pagination

**Ref:** TradeListScreen
**Actors:** test-buyer (with >10 completed trades)

**Objective:** Verify history pagination.

**Steps:**
1. Open **My Trades → History** with more than 10 history rows.
2. Tap **Load More** at the bottom.

**Expected Result:**
- The history list grows by 10 per tap (page size 10).
- When all rows are loaded, **Load More** disappears and `You're all caught up` shows.

### TC-Y03 · Trade List Message button on rows

**Ref:** TradeListScreen
**Actors:** test-buyer

**Objective:** Verify the row-level Message button opens chat for the trade.

**Steps:**
1. On a trade row, tap **Message**.

**Expected Result:**
- Opens the **Chat** screen for that trade (route `Chat` with `tradeId`).

### TC-Y04 · Trade List "See all →" link

**Ref:** TradeListScreen
**Actors:** test-buyer

**Objective:** Verify the "See all →" link in the Recently Completed section.

**Steps:**
1. In the **RECENTLY COMPLETED** section, tap **See all →**.

**Expected Result:**
- Switches to the **History** tab showing the full completed/cancelled list.

### TC-Y05 · R15 — Request More Time (requester)

**Ref:** TradeTimelineScreen · `requestTradeExtension`
**Actors:** test-buyer

**Objective:** Verify the trade-extension request card and sent state.

**Steps:**
1. On an in-progress trade's timeline with no extension used, observe the card and tap **Request More Time**.

**Expected Result:**
- Card **Need more time?** reads `You can request one extension to extend the pickup window. The other party must accept within 4 hours, or the trade is cancelled.`
- After requesting, the card becomes **Extension request sent** with `Waiting for the other party to respond. If they don't answer within {countdown}, the request expires and the trade is cancelled.`

### TC-Y06 · R15 — counterparty Accept

**Ref:** TradeTimelineScreen · `respondToExtension('accept')`
**Actors:** test-seller

**Objective:** Verify the counterparty accept path.

**Steps:**
1. As the counterparty of an extension request, open the timeline.
2. Tap **Accept**.

**Expected Result:**
- The card reads **Extension request** with `The other party asked for more time to complete this trade. Respond within {countdown}, or the trade is cancelled.`
- After accepting, the card shows the granted state (see TC-Y08).

### TC-Y07 · R15 — counterparty Decline

**Ref:** TradeTimelineScreen · `respondToExtension('decline')`
**Actors:** test-seller

**Objective:** Verify the counterparty decline path.

**Steps:**
1. As the counterparty of an extension request, tap **Decline**.

**Expected Result:**
- The extension is declined; the request card clears and the trade continues under its original deadline (per the extension rules).

### TC-Y08 · R15 — granted state

**Ref:** TradeTimelineScreen
**Actors:** test-buyer, test-seller

**Objective:** Verify the granted extension state.

**Steps:**
1. After the counterparty accepts, open the timeline.

**Expected Result:**
- Card **Pickup window extended** reads `You now have until {date} to complete the trade.`

### TC-Y09 · "What to do next" card + "Got it" toggle

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
