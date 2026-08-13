# MODULE-15.1.2 FLOW-08 Manual Testing

## Scope
- TradeFlowV2 Phase 3 + 4 validation for TFV2-001 to TFV2-008.
- Focus areas: offer expiry countdown UX, auto-complete reminder UX, buyer-only completion action, dispute safety block, and automation endpoints.

## Preconditions
- Mobile app running in Expo with a signed-in test buyer and test seller.
- Supabase migrations `20260528000001` through `20260528000005` applied in staging/dev.
- Edge functions deployed:
  - `process-expired-offers`
  - `process-auto-complete`
  - `release-pending-sp`
  - updated `complete-trade`
  - updated `trade-payment`

## Test Cases

### TC-01 Offer countdown in Trade List (seller pending cards)
1. Create pending offers with `offer_expires_at` at:
   - now + 1h 30m
   - now + 8h
2. Open Trade List as seller.
3. Verify `OfferCountdownPill` appears on pending cards.
4. Expected:
   - 1h 30m card shows critical styling and countdown text.
   - 8h card shows normal/warning styling and countdown text.

### TC-02 Offer countdown in Review Offer screen
1. Open Review Offer for a pending trade with `offer_expires_at` populated.
2. Verify countdown pill appears above the trade card.
3. Expected:
   - Pill text shows "Offer expires in ..."
   - Pill disappears automatically once offer becomes expired/cancelled.

### TC-03 Auto-complete banner in Trade Timeline
1. Open Trade Timeline for an `in_progress` trade with `auto_complete_at` set.
2. Expected:
   - `AutoCompleteBanner` is visible at top of content.
   - Banner text shows countdown to auto-complete.
3. Change trade status from `in_progress` to `completed`.
4. Expected:
   - Banner no longer renders.

### TC-04 Buyer-only completion action
1. Open same `in_progress` trade as buyer.
2. Verify `confirm-trade-button` is visible and enabled (if no open dispute).
3. Open same trade as seller.
4. Expected:
   - `confirm-trade-button` is not visible for seller.

### TC-05 Dispute block prevents completion
1. Set trade to `in_progress` with `disputed_at` set and `dispute_resolution` null.
2. Open Trade Timeline as buyer.
3. Expected:
   - `confirm-trade-button` is disabled.
   - Pressing action path does not allow completion and displays dispute warning.

### TC-06 Complete-trade endpoint hardening
1. Call `complete-trade` as non-buyer for an `in_progress` trade.
2. Expected: `403` with structured error.
3. Call `complete-trade` as buyer on unresolved dispute trade.
4. Expected: `409`/blocked response (structured error).
5. Call `complete-trade` on already completed trade.
6. Expected: idempotent success response.

### TC-07 Reserved-SP payment path safety
1. Create trade where SP was reserved at offer time (`sp_reserved_at` present).
2. Execute `trade-payment`.
3. Expected:
   - No double `debit_sp_for_trade` call.
   - No duplicate refund when card capture fails in reserved-SP path.

### TC-08 Cron endpoint smoke
1. Invoke each endpoint with POST:
   - `process-expired-offers`
   - `process-auto-complete`
   - `release-pending-sp`
2. Expected:
   - `200` success with structured payload and request_id.
   - Batch metrics returned for processed rows.

## Regression Notes
- Re-run Trade timeline tests after any update to `TradeTimelineScreen` or `complete-trade` function.
- Re-run countdown component tests after any date/time utility changes.
- Ensure no behavior regression for existing dispute/report/message actions in timeline.
