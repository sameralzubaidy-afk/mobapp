# TradeFlowV2 Automated Run — 2026-06-02T12:25:04.166Z

**Module:** MODULE-15.1.2 TradeFlowV2
**Source:** misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md

## Summary

| Metric | Count |
|---|---|
| Cases selected | 102 |
| ✅ Passed | 102 |
| ❌ Failed | 0 |
| ⏭️ Skipped (pending/manual) | 15 |
| Execution units run | 11 |

## ✅ No failures in executed units.

## ✅ Passed Test Cases (Title + Maestro File Location)

Total passed cases listed below: 102

| Case | Title | Maestro file location |
|---|---|---|
| REG-R01 | Value stack totals correct ($25 item + 5 SP) | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| REG-R02 | Buyer cancel shows no consequence | p2p-kids-marketplace/.maestro/trade-flow.yaml |
| REG-R03 | Single (non-bundle) completion has no Confirm All | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| REG-R04 | Seller cancel button hidden on completed trade | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| REG-R05 | Disputed trade not auto-completed | p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml |
| REG-R06 | Disputed trade does not release SP | p2p-kids-marketplace/.maestro/swap-points-wallet.yaml |
| REG-R07 | SP reserved before seller sees offer | p2p-kids-marketplace/.maestro/swap-points-wallet.yaml |
| REG-R08 | Free buyer SP gating | p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml |
| TC-A01 | Cash Only happy path (buyer confirms receipt) | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-A02 | Accept SP: slider → seller accepts → buyer confirms | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-A03 | Accept SP listing: buyer pays cash (0 SP) | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-A04 | Donate listing: [Claim] button, no charge | p2p-kids-marketplace/.maestro/trade-flow.yaml |
| TC-B01 | Seller declines offer | p2p-kids-marketplace/.maestro/trade-flow.yaml |
| TC-B03 | Multiple competing offers — sort + auto-decline | p2p-kids-marketplace/.maestro/trade-flow.yaml |
| TC-B04 | Buyer cancels pending trade — no consequence | p2p-kids-marketplace/.maestro/trade-flow.yaml |
| TC-B05 | Max 3 pending offers enforced | p2p-kids-marketplace/.maestro/trade-flow.yaml |
| TC-C01 | SP reserved on offer submission | p2p-kids-marketplace/.maestro/swap-points-wallet.yaml |
| TC-C02 | SP restored to buyer on seller decline | p2p-kids-marketplace/.maestro/swap-points-wallet.yaml |
| TC-C04 | SP stays reserved when seller accepts | p2p-kids-marketplace/.maestro/swap-points-wallet.yaml |
| TC-C05 | SP released to seller at completion | p2p-kids-marketplace/.maestro/swap-points-wallet.yaml |
| TC-C06 | SP restored on seller cancel (in_progress) | p2p-kids-marketplace/.maestro/swap-points-wallet.yaml |
| TC-C07 | Free user sees locked Use SP + upgrade modal | p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml |
| TC-C08 | SP slider capped at 50% of item price | p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml |
| TC-D01 | Auto-complete fires when buyer never taps I Got It | p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml |
| TC-D02 | Auto-complete skipped when dispute is open | p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml |
| TC-D03 | Offer countdown pill color states | p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml |
| TC-D04 | Auto-complete banner visible to buyer only | p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml |
| TC-D05 | Post-meetup nudge after auto-complete | p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml |
| TC-E01 | Buyer opens Report a Problem modal | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-E02 | Disputed trade does not auto-complete / release SP | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-E03 | Buyer UI during active dispute | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-E04 | Seller UI during active dispute | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-F01 | Payout shown on completion (no dispute) | p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml |
| TC-F02 | Payout held when dispute open at completion | p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml |
| TC-F03 | Payout needs action when seller has no payout method | p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml |
| TC-G04 | Push notifications deep-link to correct screen | p2p-kids-marketplace/.maestro/trade-notifications.yaml |
| TC-H01 | Free buyer sees subscription CTA on completion | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-H02 | Subscriber buyer used SP — 'You saved' message | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-H03 | Subscriber seller on Accept SP — SP pending notice | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-H04 | Subscriber seller on Cash Only — upsell to Accept SP | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-I01 | Safe meetup card on in_progress trade | p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml |
| TC-I02 | Safe meetup card dismissible per trade | p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml |
| TC-I03 | In-chat safety banner persistent | p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml |
| TC-I04 | Pre-first-message safety modal once per listing | p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml |
| TC-I05 | Chat quick-reply chips on in_progress trade | p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml |
| TC-J01 | Seller cancels in_progress → Level 1 alert | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-J02 | 2nd post-acceptance cancel → Level 2 alert | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-J03 | 3rd post-acceptance cancel → Level 3 + admin flag | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-J04 | Seller cancel button visible only on in_progress | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-J05 | Seller cancel modal shows seller reasons only | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-K01 | Subscriber sees $0.99 fee in value stack | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-K02 | Non-subscriber sees $2.99 fee in value stack | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-K03 | SP discount row conditional on SP used | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-L01 | Bundle banner on trade detail | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-L02 | Confirm All shortcut for bundle (buyer) | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-L03 | Bundle offer rows in Offers tab (seller) | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-L04 | Non-bundle offers render as single rows | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-L05 | In-progress bundles section in Buying tab | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-L06 | Bundle banner in Review Offer screen | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-L07 | Accept All N Items in Review Offer screen | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-L08 | Individual accept/decline alongside bundle siblings | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-M01 | Add first item creates an active cart | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M02 | Add second item from the same seller | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M03 | Add item from a different seller shows the choice modal | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M04 | Replace Cart option | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M05 | Cannot add your own item to cart | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M06 | Cannot add an unavailable / out-of-node item | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M07 | Duplicate item prevented in the same cart | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M08 | Remove an item from the cart | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M09 | Clear the cart | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M10 | Saved carts: max 3, LRU eviction, switch cart | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M11 | Minimum cart value warning and blocked checkout | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M12 | Max SP available shown per cart item (subscriber) | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M14 | Favorites add / remove | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-M15 | Favorites screen shows availability and empty state | p2p-kids-marketplace/.maestro/cart-flow.yaml |
| TC-O01 | Sales tax shown in checkout breakdown (0 SP) | p2p-kids-marketplace/.maestro/tax-checkout.yaml |
| TC-O02 | Tax recalculates on SP slider change | p2p-kids-marketplace/.maestro/tax-checkout.yaml |
| TC-O03 | Tax is $0 when sales tax is disabled globally | p2p-kids-marketplace/.maestro/tax-checkout.yaml |
| TC-O04 | Tax is $0 when the node tax is disabled | p2p-kids-marketplace/.maestro/tax-checkout.yaml |
| TC-O05 | Tax-exempt user sees a Tax Free badge | p2p-kids-marketplace/.maestro/tax-checkout.yaml |
| TC-O06 | Transaction history shows tax details | p2p-kids-marketplace/.maestro/tax-checkout.yaml |
| TC-O07 | Refund shows proportional tax refunded | p2p-kids-marketplace/.maestro/tax-checkout.yaml |
| TC-Q01 | Review prompt appears for both parties after completion | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q02 | Star rating required — submit blocked without rating | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q03 | Comment optional, capped at 500 characters | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q04 | Anonymous review hides reviewer identity | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q05 | Skip review — no blocking, no re-prompt | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q06 | Mutual review status shown on completed trade | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q07 | Completed reviews visible on counterparty's profile | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q08 | Average rating and total count on profile | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q09 | Rating breakdown (5 → 1 stars) on profile | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q10 | Edit review succeeds within 24h window | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q12 | One review per trade — duplicate blocked | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q15 | Flag a review (select reason) | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-Q17 | Cannot flag own review | p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml |
| TC-R01 | Buyer cancels pending → cancelled, auth voided, SP restored | p2p-kids-marketplace/.maestro/trade-flow.yaml |
| TC-R02 | Seller declines pending → cancelled, SP restored | p2p-kids-marketplace/.maestro/trade-flow.yaml |
| TC-R05 | Seller cancels in_progress → refund + consequence | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-R06 | Refund settlement breakdown (cash + tax + fee) | p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml |
| TC-R07 | SP reversal on refund (reserved/transferred returned) | p2p-kids-marketplace/.maestro/swap-points-wallet.yaml |
| TC-R08 | Seller payout withheld / cancelled on refund | p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml |
| TC-R13 | Cancelled / refunded trade status + timeline | p2p-kids-marketplace/.maestro/trade-flow.yaml |

## ⏭️ Coverage gaps (not executed)

| Case | Status | Reason |
|---|---|---|
| TC-B02 | manual | Requires clock fast-forward to expiry window not controllable from the app UI. |
| TC-B06 | manual | Requires Stripe test decline card path; not deterministic from UI without a seeded decline fixture. |
| TC-C03 | manual | Needs clock fast-forward to expiry. |
| TC-G01 | manual | Scheduled push delivery not observable in simulator; deep-link target verified separately. |
| TC-G02 | manual | Scheduled push delivery not observable in simulator. |
| TC-G03 | manual | Throttle window is server-side; not deterministic from UI. |
| TC-M13 | manual | Requires a second actor to mutate availability while the cart screen is open (realtime). Not deterministic single-device. |
| TC-Q11 | manual | Requires a review aged >24h (clock control). |
| TC-Q13 | manual | Requires a recent review within 30 days across two trades (time + data). |
| TC-Q14 | manual | Requires clock control around completion time. |
| TC-Q16 | manual | Requires 3 distinct reporters; backend threshold effect. |
| TC-R03 | manual | Requires clock fast-forward to expiry. |
| TC-R04 | manual | Requires Stripe decline-card fixture. |
| TC-R11 | manual | Push delivery not observable in simulator. |
| TC-R12 | manual | Idempotency is a backend invariant; verify via integration tests, not UI. |
