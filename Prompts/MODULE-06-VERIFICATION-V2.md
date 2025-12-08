# MODULE-06 VERIFICATION CHECKLIST (V2)

**Module:** Trade & Transaction Flow  
**Version:** 2.0 (Kids Club+ Subscription-Gated Swap Points Model)  
**Last Updated:** [Auto-generated timestamp]

---

## PURPOSE

This checklist ensures that MODULE-06 (Trade & Transaction Flow V2) has been fully implemented with:
1. All database migrations and schema changes.
2. All TypeScript types and service functions.
3. All Supabase edge functions.
4. All UI components and user flows.
5. All admin tools and analytics.
6. Full test coverage.
7. Cross-module integration with MODULE-09 (SP) and MODULE-11 (Subscriptions).

---

## VERIFICATION CHECKLIST

### 1. DATABASE & SCHEMA (TRADE-V2-001)

- [ ] **Migration `060_trades_v2.sql` applied** to production database
  - [ ] Column `buyer_subscription_status` added (TEXT)
  - [ ] Column `buyer_transaction_fee_cents` added (INTEGER)
  - [ ] Column `sp_debit_ledger_entry_id` added (UUID, FK to sp_ledger)
  - [ ] Column `sp_credit_ledger_entry_id` added (UUID, nullable for refunds)
  - [ ] Column `last_status_change_at` added (TIMESTAMPTZ)
  - [ ] Index on `status` for performance
  - [ ] Index on `buyer_id` and `seller_id`

- [ ] **TypeScript types updated** (`src/types/trade.ts`)
  - [ ] `TradeStatus` enum includes: `pending`, `payment_processing`, `payment_failed`, `in_progress`, `completed`, `cancelled`
  - [ ] `Trade` interface matches V2 schema with all new fields

- [ ] **Database constraints verified**
  - [ ] `buyer_transaction_fee_cents` must be >= 0
  - [ ] `total_amount_cents` = `cash_amount_cents` + `buyer_transaction_fee_cents`
  - [ ] `item_price_cents` = `cash_amount_cents` + (`points_amount` * 100)

---

### 2. TRADE INITIATION (TRADE-V2-002)

- [ ] **Service function `initiateTradeV2` implemented** (`src/services/trade.ts`)
  - [ ] Fetches item details and checks availability
  - [ ] Prevents self-purchase (buyer ≠ seller)
  - [ ] Calls `getSubscriptionSummary(buyerId)` from MODULE-11
  - [ ] Calls `get_user_sp_wallet_summary(buyerId)` RPC from MODULE-09
  - [ ] Validates `can_spend_sp` flag
  - [ ] Clamps requested SP discount: `appliedPoints = canSpendSp ? min(requested, available) : 0`
  - [ ] Computes fee: `transactionFeeCents = isSubscriber ? 99 : 299`
  - [ ] Creates trade row with status `pending` and all monetary fields populated
  - [ ] Returns trade object to caller

- [ ] **Integration with MODULE-11 verified**
  - [ ] `getSubscriptionSummary` returns correct `can_spend_sp` for trial/active users
  - [ ] Non-subscribers (`free`, `grace_period`, `expired`) cannot use SP
  - [ ] Fee tier correct: $0.99 for subscribers, $2.99 for non-subscribers

- [ ] **Integration with MODULE-09 verified**
  - [ ] `get_user_sp_wallet_summary` returns accurate `availablePoints`
  - [ ] Frozen wallets (`grace_period`) show 0 available points

- [ ] **Unit tests passing**
  - [ ] Test: Subscriber with 50 SP requesting 20 SP → appliedPoints = 20, fee = 99¢
  - [ ] Test: Non-subscriber requesting SP → appliedPoints = 0, fee = 299¢
  - [ ] Test: Subscriber requesting 100 SP but only 30 available → appliedPoints = 30
  - [ ] Test: Self-purchase rejected

---

### 3. PAYMENT ORCHESTRATION (TRADE-V2-003)

- [ ] **Edge function `trade-payment` deployed** (`supabase/functions/trade-payment/index.ts`)
  - [ ] Validates trade is in `pending` status
  - [ ] Creates or reuses Stripe customer for buyer
  - [ ] Attaches payment method to Stripe customer
  - [ ] Marks trade as `payment_processing`
  - [ ] Creates Stripe PaymentIntent for `cashAmountCents + transactionFeeCents`
  - [ ] Confirms PaymentIntent immediately
  - [ ] On Stripe failure: sets trade to `payment_failed` and returns error
  - [ ] On Stripe success: calls `debit_sp_for_trade` RPC (MODULE-09)
  - [ ] Stores `sp_debit_ledger_entry_id` and `stripe_payment_intent_id`
  - [ ] Marks trade as `in_progress`
  - [ ] Returns success response with trade details

- [ ] **Atomicity verified**
  - [ ] If Stripe payment fails, SP is NOT debited
  - [ ] If SP debit fails (insufficient points), Stripe payment is NOT captured (or refunded immediately)
  - [ ] No orphaned transactions (cash paid but SP not debited, or vice versa)

- [ ] **Integration tests passing**
  - [ ] Test: Valid payment method + sufficient SP → trade moves to `in_progress` with both Stripe and SP ledger IDs
  - [ ] Test: Invalid payment method → trade moves to `payment_failed`, SP not debited
  - [ ] Test: SP debit fails mid-transaction → Stripe refunded, trade marked failed

---

### 4. STATE TRANSITIONS & COMPLETION (TRADE-V2-004)

- [ ] **Edge function `complete-trade` deployed** (`supabase/functions/complete-trade/index.ts`)
  - [ ] Buyer or seller can mark trade as `completed`
  - [ ] Validates trade is in `in_progress` status
  - [ ] Updates trade status to `completed` with `completed_at` timestamp
  - [ ] Triggers SP earning for seller (calls MODULE-09 `earn_sp` RPC)
  - [ ] Returns success response

- [ ] **Edge function `auto-complete-trades` deployed** (cron)
  - [ ] Runs daily (configured in Supabase cron settings)
  - [ ] Fetches trades with status `in_progress` and `last_status_change_at` > 7 days ago
  - [ ] Marks each trade as `completed`
  - [ ] Triggers SP earning for each seller
  - [ ] Logs number of auto-completed trades

- [ ] **Webhook handling for external refunds** (optional)
  - [ ] Stripe webhook endpoint receives `charge.refunded` events
  - [ ] Updates trade status accordingly

- [ ] **Tests passing**
  - [ ] Test: Buyer marks trade complete → status = `completed`, seller earns SP
  - [ ] Test: Seller marks trade complete → status = `completed`, seller earns SP
  - [ ] Test: Auto-complete cron marks 8-day-old trade as completed

---

### 5. CANCELLATIONS & REFUNDS (TRADE-V2-005)

- [ ] **Edge function `cancel-trade` deployed** (`supabase/functions/cancel-trade/index.ts`)
  - [ ] Buyer or seller can cancel trade
  - [ ] Handles pre-payment cancellations (status = `pending`):
    - [ ] Marks trade as `cancelled` with no refunds
  - [ ] Handles post-payment cancellations (status = `in_progress`):
    - [ ] Issues Stripe refund for `cash_amount_cents + transaction_fee_cents`
    - [ ] Re-credits SP to buyer via `credit_sp_for_cancelled_trade` RPC (MODULE-09)
    - [ ] Stores `sp_credit_ledger_entry_id`
    - [ ] Marks trade as `cancelled` with reason and timestamp
  - [ ] Returns refund confirmation

- [ ] **Integration with MODULE-09 verified**
  - [ ] `credit_sp_for_cancelled_trade` creates positive ledger entry with `source_type='refund'`
  - [ ] Re-credited SP is immediately available for buyer (if subscription still valid)

- [ ] **Tests passing**
  - [ ] Test: Pre-payment cancellation (pending) → no Stripe/SP refunds, trade marked cancelled
  - [ ] Test: Post-payment cancellation (in_progress) → Stripe refund + SP re-credit, trade marked cancelled
  - [ ] Test: Cancelled trade does NOT trigger seller SP earning

---

### 6. COMPLETION & SP EARNING (TRADE-V2-006)

- [ ] **SP earning logic integrated** into `complete-trade` and `auto-complete-trades`
  - [ ] Seller subscription status checked via `get_subscription_summary` (MODULE-11)
  - [ ] If seller `can_earn_sp` = true:
    - [ ] SP earned = `item_price_cents / 100` (1 SP per dollar)
    - [ ] `earn_sp` RPC called with `source_type='trade_sale'`, `source_id=trade.id`
    - [ ] Ledger entry linked to trade
  - [ ] If seller cannot earn SP (expired/grace_period), no SP credited

- [ ] **Integration with MODULE-09 verified**
  - [ ] `earn_sp` RPC creates positive ledger entry
  - [ ] Seller SP balance updated immediately
  - [ ] Batch assignment logic (MODULE-09) applies to earned SP

- [ ] **Tests passing**
  - [ ] Test: Active seller completes $10 trade → earns 10 SP
  - [ ] Test: Seller in grace_period completes trade → earns 0 SP (wallet frozen)

---

### 7. MID-TRADE SUBSCRIPTION CHANGES (TRADE-V2-007)

- [ ] **Policy documented**
  - [ ] No retroactive fee adjustments (fee locked at initiation)
  - [ ] SP wallet freeze/deletion handled by MODULE-09 subscription webhooks
  - [ ] Trade continues unaffected if buyer subscription expires mid-trade

- [ ] **Monitoring/alerting implemented** (optional)
  - [ ] Edge function `monitor-mid-trade-subscription-changes` deployed (if used)
  - [ ] Admin dashboard shows subscription status snapshot vs current

- [ ] **Admin audit visibility**
  - [ ] Trade detail view shows `buyer_subscription_status` (snapshot at creation)
  - [ ] Trade detail view shows current subscription status for comparison

- [ ] **Tests passing**
  - [ ] Test: Buyer subscription expires mid-trade → trade completes normally, no retroactive fee increase

---

### 8. UI FLOWS (TRADE-V2-008)

- [ ] **Initiate Trade Screen** (`src/screens/InitiateTradeScreen.tsx`)
  - [ ] Displays item details (name, price, image)
  - [ ] Shows SP discount slider (if subscriber)
  - [ ] Slider disabled for non-subscribers with upgrade CTA
  - [ ] Real-time breakdown: item price, SP discount, cash amount, fee, total
  - [ ] Clear disclosure of transaction fee ($0.99 vs $2.99)
  - [ ] "Initiate Trade" button calls `initiateTradeV2` and navigates to payment

- [ ] **Trade Timeline Screen** (`src/screens/TradeTimelineScreen.tsx`)
  - [ ] Displays current trade status with visual progress indicator
  - [ ] Shows monetary breakdown (cash, SP, fee)
  - [ ] Action buttons based on status:
    - [ ] `pending`: Cancel button
    - [ ] `in_progress`: Mark Complete button, Cancel Trade button
    - [ ] `completed` / `cancelled`: Read-only summary
  - [ ] Real-time updates via Supabase subscription

- [ ] **Trade Details Screen** (`src/screens/TradeDetailsScreen.tsx`)
  - [ ] Full monetary breakdown
  - [ ] Stripe receipt link (if available)
  - [ ] Cancellation/refund history
  - [ ] SP ledger entry links (for audit)

- [ ] **UI tests passing**
  - [ ] Test: Non-subscriber sees upgrade prompt instead of SP slider
  - [ ] Test: Subscriber with 10 SP can only apply up to 10 SP discount
  - [ ] Test: Trade status updates in real-time when completed by seller

---

### 9. ADMIN TOOLS (TRADE-V2-009)

- [ ] **Admin Trade Search UI** (`src/admin/components/TradeSearch.tsx`)
  - [ ] Search by trade ID, buyer ID, seller ID
  - [ ] Filter by status (all, pending, in_progress, completed, cancelled)
  - [ ] Date range filter
  - [ ] Results display: trade ID, buyer/seller, status, amount

- [ ] **Admin Trade Detail View** (`src/admin/components/TradeDetail.tsx`)
  - [ ] Full monetary breakdown
  - [ ] Subscription status snapshot vs current
  - [ ] SP ledger entry IDs (clickable links to ledger viewer)
  - [ ] Stripe PaymentIntent ID (clickable link to Stripe dashboard)
  - [ ] Action buttons: Force Cancel Trade (with reason input)

- [ ] **Admin RPC `admin_force_cancel_trade` deployed**
  - [ ] Updates trade status to `cancelled`
  - [ ] Logs admin action in `admin_action_logs` table
  - [ ] Optionally triggers refunds (Stripe + SP)

- [ ] **Analytics Dashboard** (optional)
  - [ ] Trade volume by status (chart)
  - [ ] Average SP usage per trade
  - [ ] Fee revenue breakdown (subscriber vs non-subscriber)
  - [ ] Cancellation rate by reason

- [ ] **Admin tests passing**
  - [ ] Test: Admin can search and filter trades
  - [ ] Test: Admin force-cancel logs action with reason

---

### 10. TESTS & MODULE SUMMARY (TRADE-V2-010)

- [ ] **Unit tests implemented** (`src/services/trade.test.ts`)
  - [ ] `initiateTradeV2` fee calculation tests (4+ test cases)
  - [ ] SP clamping tests (3+ test cases)
  - [ ] Self-purchase prevention test

- [ ] **Integration tests implemented** (`supabase/functions/trade-payment/trade-payment.test.ts`)
  - [ ] Stripe + SP atomic transaction success test
  - [ ] Stripe failure rollback test
  - [ ] SP debit failure rollback test

- [ ] **E2E tests implemented** (optional, using Detox or similar)
  - [ ] Full trade flow: initiate → pay → complete → verify seller SP earning
  - [ ] Cancellation flow: initiate → pay → cancel → verify refunds

- [ ] **Module summary document complete** (included in MODULE-06-TRADE-FLOW-V2.md)
  - [ ] State machine diagram
  - [ ] Cross-module contracts listed
  - [ ] API surface documented
  - [ ] Key rules summarized

- [ ] **All tests passing in CI/CD**
  - [ ] Unit tests pass
  - [ ] Integration tests pass
  - [ ] E2E tests pass (if applicable)
  - [ ] Test coverage >= 80% for trade services and edge functions

---

## CROSS-MODULE INTEGRATION VERIFICATION

### Integration with MODULE-09 (SP Gamification)

- [ ] **RPCs called correctly:**
  - [ ] `get_user_sp_wallet_summary(p_user_id)` returns accurate balance
  - [ ] `debit_sp_for_trade(p_user_id, p_trade_id, p_points)` debits SP and returns ledger entry ID
  - [ ] `credit_sp_for_cancelled_trade(p_user_id, p_trade_id, p_points)` re-credits SP with refund source type
  - [ ] `earn_sp(p_user_id, p_points, p_source_type, p_source_id, p_description)` credits SP for seller on completion

- [ ] **SP wallet freeze/deletion honored:**
  - [ ] Users in `grace_period` have `can_spend_sp = false` and `availablePoints = 0`
  - [ ] Users in `expired` status have deleted wallets and cannot earn/spend SP

### Integration with MODULE-11 (Subscriptions)

- [ ] **`getSubscriptionSummary(userId)` called correctly:**
  - [ ] Returns `status`, `can_spend_sp`, `is_subscriber`, `available_points`
  - [ ] Used to compute transaction fee tier
  - [ ] Used to gate SP discount UI

- [ ] **Fee rules verified:**
  - [ ] Subscriber statuses (`trial`, `active`, `cancelled`) get $0.99 fee
  - [ ] Non-subscriber statuses (`free`, `grace_period`, `expired`) get $2.99 fee

- [ ] **SP gating verified:**
  - [ ] Only `trial` and `active` subscribers can use SP in trades
  - [ ] `cancelled` subscribers cannot use SP (wallet frozen)

---

## DEPLOYMENT CHECKLIST

- [ ] **Database migrations applied to production**
  - [ ] `060_trades_v2.sql` migration run successfully
  - [ ] `065_admin_force_cancel_trade.sql` migration run successfully

- [ ] **Edge functions deployed to production**
  - [ ] `trade-payment` function live
  - [ ] `complete-trade` function live
  - [ ] `cancel-trade` function live
  - [ ] `auto-complete-trades` cron job scheduled (daily)

- [ ] **Environment variables configured**
  - [ ] `STRIPE_SECRET_KEY` set in Supabase edge function secrets
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` available for admin RPCs

- [ ] **Stripe webhook configured**
  - [ ] Webhook endpoint receiving `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` events
  - [ ] Webhook secret verified

- [ ] **Mobile app deployed**
  - [ ] Initiate Trade screen live
  - [ ] Trade Timeline screen live
  - [ ] Trade Details screen live
  - [ ] Real-time subscription working

- [ ] **Admin dashboard deployed**
  - [ ] Trade search and detail views accessible to admin users
  - [ ] Force-cancel action restricted to admin roles

---

## ACCEPTANCE SIGN-OFF

- [ ] **Product Owner Approval**
  - [ ] Trade flow matches V2 requirements (dual tender, subscription fees, SP gating)
  - [ ] User experience tested and approved

- [ ] **Engineering Lead Approval**
  - [ ] All code reviewed and merged
  - [ ] Test coverage meets standards
  - [ ] Performance benchmarks met

- [ ] **QA Sign-Off**
  - [ ] All test cases passed
  - [ ] Edge cases validated (mid-trade subscription changes, refunds, etc.)
  - [ ] No critical bugs outstanding

---

## NOTES

- **Partial SP Discounts:** Users can apply any amount of SP up to their available balance, enabling flexible pricing.
- **Fee Disclosure:** Transaction fee is prominently displayed at checkout to comply with App Store guidelines.
- **Refund SLA:** Stripe refunds typically process within 5-10 business days; SP re-credit is instant.
- **Auto-Completion Window:** 7-day window balances user convenience with fraud prevention; adjustable based on dispute rates.

---

## CHANGELOG

| Date       | Author | Change Description                          |
|------------|--------|---------------------------------------------|
| [Date]     | AI     | Initial V2 verification checklist created   |

---

**End of MODULE-06-VERIFICATION-V2.md**
