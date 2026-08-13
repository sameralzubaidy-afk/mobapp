# MODULE-15.1.2 — Trade Flow V2 — Complete Manual Testing Guide

**Module:** MODULE-15.1.2-TradeFlowV2  
**Total Tasks:** 24 (TFV2-001 → TFV2-022, TFV2-023, Addenda A–E)  
**Platforms:** iOS Simulator / Android Emulator (no physical devices)  
**Author:** Auto-generated from module spec + verified testIDs  
**Last Updated:** 2026-05-28

---

## Quick Start

```bash
# Start the app on iOS Simulator
cd p2p-kids-marketplace && npx expo start --simulator

# Start the app on Android Emulator
cd p2p-kids-marketplace && npx expo start --android

# Run unit tests
cd p2p-kids-marketplace && npm run test:unit

# Run unit tests (trade module only)
cd p2p-kids-marketplace && npm run test:unit:trade

# Run E2E integration tests (requires Supabase staging access)
cd p2p-kids-marketplace && RUN_SUPABASE_E2E=true npm run test:e2e

# Run Maestro UI tests (iOS)
cd p2p-kids-marketplace && npm run test:maestro:ios

# Run Maestro UI tests (Android)
cd p2p-kids-marketplace && npm run test:maestro:android
```

---

## Test User Accounts (Staging)

| Role | Email | Password | Notes |
|---|---|---|---|
| Buyer (subscriber) | buyer-test@kidsmarketplace.test | Refer to staging env | Kids Club+ active |
| Buyer (free) | free-buyer-test@kidsmarketplace.test | Refer to staging env | Free tier |
| Seller (subscriber) | seller-test@kidsmarketplace.test | Refer to staging env | Kids Club+, has active listings |
| Admin | admin@kidsmarketplace.test | Refer to staging env | Full admin access |

---

## DB Verification Queries

Use Supabase Studio (SQL Editor) to run these after each Phase 3 task:

```sql
-- Verify TFV2-001: Admin config trade timing fields
SELECT auto_complete_hours, pending_sp_release_days,
       offer_notif_1_hours_before, offer_notif_2_hours_before,
       auto_complete_notif_hours_before
FROM admin_config LIMIT 1;

-- Verify TFV2-002: trades V2 columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trades'
   AND column_name IN ('offer_expires_at', 'auto_complete_at', 'bundle_size',
                      'dispute_status', 'payout_status', 'payout_idempotency_key',
                      'sp_earned_at_completion', 'sp_released_at');

-- Verify TFV2-002: sp_wallets has reserved_sp
SELECT column_name FROM information_schema.columns
WHERE table_name = 'sp_wallets' AND column_name = 'reserved_sp';

-- Verify TFV2-003: SP trigger functions exist
SELECT proname FROM pg_proc
WHERE proname IN ('fn_reserve_sp_on_offer', 'fn_release_sp_on_cancel',
                  'fn_release_all_sp_on_complete', 'fn_set_offer_expires_at');

-- Verify TFV2-004: Offer expiry cron exists
SELECT jobname, schedule FROM cron.job WHERE jobname = 'process-expired-offers';

-- Verify TFV2-005: Auto-complete cron exists
SELECT jobname, schedule FROM cron.job
WHERE jobname IN ('process-auto-complete', 'release-pending-sp');

-- Verify TFV2-023: Profile consequence columns
SELECT post_acceptance_cancellation_count, admin_review_flagged_at
FROM profiles LIMIT 5;
```

---

## PHASE 2 — Foundational DB Migrations (Pre-Module)

### TC-P2-001: Stripe authorization fields on trades

**Preconditions:** Supabase Studio SQL Editor open  
**Steps:**  
1. Run:
   ```sql
   SELECT stripe_payment_intent_id, authorization_expires_at
   FROM public.trades
   LIMIT 1;
   ```
**Expected:** No error — columns exist  

### TC-P2-002: SP hold enum values

**Preconditions:** Supabase Studio  
**Steps:**  
1. Run:
   ```sql
   SELECT EXISTS (
     SELECT 1
     FROM pg_type t
     WHERE t.typname = 'sp_transaction_type'
   ) AS has_legacy_sp_hold_enum;
   ```
2. Run (current wallet-hold model check):
   ```sql
   SELECT column_name
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'sp_wallets'
     AND column_name = 'reserved_sp';
   ```
3. Optional data check (if hold ledger events already exist):
   ```sql
   SELECT DISTINCT sl.transaction_type
   FROM public.sp_ledger sl
   WHERE sl.transaction_type IN ('hold', 'hold_release', 'hold_consumed')
   ORDER BY sl.transaction_type;
   ```
**Expected:** `reserved_sp` query returns one row; legacy enum may be absent in newer schema  

### TC-P2-003: offer_timeout_hours in admin_config

**Preconditions:** Supabase Studio  
**Steps:**  
1. Run:
   ```sql
   SELECT value::int AS offer_timeout_hours
   FROM admin_config
   WHERE key = 'offer_timeout_hours'
   LIMIT 1;
   ```
**Expected:** Returns a number (default 48 in current seed)  

---

## PHASE 3 — DB Schema + Backend (TFV2-001 to TFV2-006)

---

### TC-TFV2-001-A: Admin config trade timing fields added

**Task:** TFV2-001  
**Preconditions:** TFV2-001 migration applied  
**Steps:**  
1. In Supabase Studio, run:
   ```sql
   SELECT auto_complete_hours, pending_sp_release_days,
          offer_notif_1_hours_before, offer_notif_2_hours_before,
          auto_complete_notif_hours_before
   FROM admin_config LIMIT 1;
   ```
**Expected:** All columns present, all values >= 1  

---

### TC-TFV2-001-B: Admin config cross-field validation trigger rejects invalid input

**Task:** TFV2-001  
**Preconditions:** TFV2-001 migration applied  
**Steps:**  
1. In Supabase Studio, run:
   ```sql
    BEGIN;

    UPDATE admin_config
    SET value = '30'
    WHERE key = 'offer_notif_1_hours_before'
       AND EXISTS (
          SELECT 1
          FROM admin_config ac
          WHERE ac.key = 'offer_timeout_hours'
             AND public.fn_admin_config_safe_int(ac.value, 48) < 30
       );

    ROLLBACK;
   ```
**Expected:** Postgres exception: `offer_notif_1_hours_before must be <= offer_timeout_hours`  

---

### TC-TFV2-001-C: Admin portal shows Trade Timing Settings section

**Task:** TFV2-001  
**Preconditions:** Admin portal running locally (`cd p2p-kids-admin && npm run dev`)  
**Steps:**  
1. Log in to admin portal  
2. Navigate to Settings  
3. Look for "Trade Timing Settings" section  
**Expected:**  
- Section heading "Trade Timing Settings" is visible  
- 7 input fields shown: Offer Expiry Duration, Auto-Complete Duration, SP Pending Release Period, plus 4 notification timing fields  
- Each field has label, description, and unit  

---

### TC-TFV2-002-A: trades V2 columns exist

**Task:** TFV2-002  
**Preconditions:** TFV2-002 migration applied  
**Steps:**  
1. In Supabase Studio, run:
   ```sql
   SELECT offer_expires_at, auto_complete_at, bundle_size, dispute_status,
          dispute_resolution, payout_status, payout_idempotency_key,
          sp_earned_at_completion, sp_released_at
   FROM trades LIMIT 1;
   ```
**Expected:** All columns present, no error  

---

### TC-TFV2-002-B: dispute_status CHECK constraint enforced

**Task:** TFV2-002  
**Preconditions:** TFV2-002 migration applied  
**Steps:**  
1. In Supabase Studio, run:
   ```sql
   UPDATE trades SET dispute_status = 'invalid_value' WHERE id = (SELECT id FROM trades LIMIT 1);
   ```
**Expected:** CHECK constraint violation error  

---

### TC-TFV2-002-C: payout_idempotency_key UNIQUE constraint

**Task:** TFV2-002  
**Preconditions:** TFV2-002 migration applied  
**Steps:**  
1. In Supabase Studio, get a trade ID: `SELECT id FROM trades LIMIT 1;`  
2. Run: `UPDATE trades SET payout_idempotency_key = 'test-key-001' WHERE id = '<trade1>';`  
3. Run: `UPDATE trades SET payout_idempotency_key = 'test-key-001' WHERE id = '<trade2>';`  
**Expected:** Step 3 fails with UNIQUE constraint violation  

---

### TC-TFV2-002-D: fn_lock_payment_preference trigger (FR-LM-002)

**Task:** TFV2-002  
**Preconditions:** An active trade exists on a listing  
**Steps:**  
1. In Supabase Studio, find a listing with an active pending/in_progress trade:
   ```sql
   SELECT i.id, i.accepts_swap_points FROM items i
   JOIN trades t ON t.listing_id = i.id
   WHERE t.status IN ('pending', 'in_progress') LIMIT 1;
   ```
2. Try to change the listing's accepts_swap_points:
   ```sql
   UPDATE items SET accepts_swap_points = false WHERE id = '<listing_id>';
   ```
**Expected:** Error: `Cannot change payment preference while listing has active trades`  

---

### TC-TFV2-003-A: SP reserve trigger fires on new trade INSERT

**Task:** TFV2-003  
**Preconditions:** Test buyer has SP in their wallet; use Supabase Studio  
**Steps:**  
1. Note buyer's current `available_balance` and `reserved_sp`:
   ```sql
   SELECT available_balance, reserved_sp FROM sp_wallets WHERE user_id = '<buyer_id>';
   ```
2. As buyer, submit a new offer with `sp_amount = 10` via the app  
3. Re-run the wallet query from step 1  
**Expected:**  
- `available_balance` decreased by 10  
- `reserved_sp` increased by 10  

---

### TC-TFV2-003-B: SP restores on trade cancellation

**Task:** TFV2-003  
**Preconditions:** Trade from TC-TFV2-003-A exists in pending state  
**Steps:**  
1. Note current wallet balance  
2. Cancel the trade (as buyer or seller)  
3. Re-check wallet balance  
**Expected:**  
- `available_balance` restored to original value  
- `reserved_sp` back to 0 (or original value)  

---

### TC-TFV2-003-C: SP insufficient — offer creation blocked

**Task:** TFV2-003  
**Preconditions:** Buyer has 0 available_balance  
**Steps:**  
1. Set buyer available_balance to 0 in Supabase Studio (or ensure buyer has no SP)  
2. Try to submit an offer with sp_amount > 0 via the app  
**Expected:** Offer rejected with error message about insufficient SP  

---

### TC-TFV2-003-D: Platform SP calculation at completion (D-17)

**Task:** TFV2-003 / TFV2-006  
**Preconditions:** Subscriber seller with an accept_sp listing; trade in in_progress  
**Steps:**  
1. Note seller's `pending_balance` before completion  
2. Buyer taps "I Got It" on the trade  
3. Check seller's wallet and trade record:
   ```sql
   SELECT sp_earned_at_completion, sp_released_at FROM trades WHERE id = '<trade_id>';
   SELECT pending_balance FROM sp_wallets WHERE user_id = '<seller_id>';
   ```
**Expected:**  
- `sp_earned_at_completion` is set to (buyer SP used + platform SP)  
- Platform SP = ROUND(item_price × 0.25 × multiplier) for subscriber + accept_sp  
- Seller `pending_balance` increased by the total amount  

---

### TC-TFV2-004-A: Offer expiry is set automatically at trade creation

**Task:** TFV2-004  
**Preconditions:** TFV2-004 migration applied  
**Steps:**  
1. Submit a new offer as buyer  
2. Check the trade record:
   ```sql
   SELECT created_at, offer_expires_at FROM trades WHERE id = '<trade_id>';
   ```
**Expected:** `offer_expires_at = created_at + offer_timeout_hours * '1 hour'::interval`  

---

### TC-TFV2-004-B: Competing offers auto-declined when one accepted

**Task:** TFV2-004  
**Preconditions:** 2 buyers have submitted offers on the same listing  
**Steps:**  
1. As seller, accept one of the two offers  
2. Check the other trade record:
   ```sql
   SELECT status, cancellation_reason FROM trades
   WHERE listing_id = '<listing_id>' AND id != '<accepted_trade_id>';
   ```
**Expected:** `status = 'cancelled'`, `cancellation_reason = 'offer_expired_competing'`  

---

### TC-TFV2-005-A: Disputed trade NOT auto-completed (D-26 guard)

**Task:** TFV2-005  
**Preconditions:** A trade in `in_progress` with `auto_complete_at` in the past  
**Steps:**  
1. Set a trade's `dispute_status = 'reported'` and `auto_complete_at` to the past:
   ```sql
   UPDATE trades SET dispute_status = 'reported',
                     auto_complete_at = NOW() - INTERVAL '1 hour'
   WHERE id = '<trade_id>';
   ```
2. Call `SELECT rpc_process_auto_complete();`  
**Expected:** The disputed trade is NOT completed — remains `in_progress`  

---

### TC-TFV2-005-B: Auto-complete fires for non-disputed in_progress trades

**Task:** TFV2-005  
**Preconditions:** A non-disputed trade with `auto_complete_at` in the past  
**Steps:**  
1. Set trade's `auto_complete_at` to the past:
   ```sql
   UPDATE trades SET auto_complete_at = NOW() - INTERVAL '1 hour'
   WHERE id = '<trade_id>' AND status = 'in_progress' AND dispute_status = 'none';
   ```
2. Call `SELECT rpc_process_auto_complete();`  
3. Check trade: `SELECT status FROM trades WHERE id = '<trade_id>';`  
**Expected:** `status = 'completed'`  

---

### TC-TFV2-005-C: SP pending → available release after pending_sp_release_days

**Task:** TFV2-005  
**Preconditions:** A completed trade with `sp_earned_at_completion > 0`; `completed_at` is old enough  
**Steps:**  
1. Set a trade's `completed_at` to far enough in the past to trigger release:
   ```sql
   UPDATE trades SET completed_at = NOW() - INTERVAL '10 days'
   WHERE id = '<completed_trade_id>';
   ```
2. Note seller's `pending_balance` and `available_balance`  
3. Call `SELECT rpc_release_pending_sp();`  
4. Re-check seller's wallet  
**Expected:**  
- `pending_balance` decreased by `sp_earned_at_completion` amount  
- `available_balance` increased by the same amount  
- Trade has `sp_released_at` set  

---

## PHASE 4 — React Native Components (TFV2-007 to TFV2-008)

---

### TC-TFV2-007-A: OfferCountdownPill renders with correct colors

**Task:** TFV2-007  
**Preconditions:** Navigate to TradeV2ComponentsPreviewScreen (dev only)  
**Steps:**  
1. Open Expo dev menu → navigate to `/trade-v2-preview`  
2. Look for OfferCountdownPill in "Critical" urgency state  
3. Look for OfferCountdownPill in "Normal" state  
**Expected:**  
- testID `preview-offer-countdown-critical` visible, red background (#EF4444)  
- testID `preview-offer-countdown-normal` visible, green background (#5DBB8E)  
- Both pills are 24px tall, pill-shaped  
- Timer icon (Phosphor) visible in non-expired state  

---

### TC-TFV2-007-B: OfferCountdownPill shows "Expired" for past offers

**Task:** TFV2-007  
**Preconditions:** Preview screen  
**Steps:**  
1. In preview screen, find a pill configured with expired timestamp  
**Expected:** Gray background (#9CA3AF), text "Expired", no Timer icon  

---

### TC-TFV2-008-A: AutoCompleteBanner renders on TradeTimelineScreen for buyer

**Task:** TFV2-008  
**Preconditions:** Buyer has an in_progress trade with auto_complete_at in the future  
**Steps:**  
1. Log in as buyer  
2. Navigate to an in_progress trade in TradeTimeline  
**Expected:**  
- Full-width banner visible at top of trade actions section  
- Shows "Auto-completing in Xh Ym" with Timer icon  
- Sub-text: "Received it already? Tap 'I Got It' to confirm."  
- Banner NOT visible to seller  

---

### TC-TFV2-008-B: AutoCompleteBanner uses correct urgency colors

**Task:** TFV2-008  
**Steps:**  
1. View preview screen  
2. Observe `preview-auto-complete-banner`  
**Expected:** testID `preview-auto-complete-banner` visible, correct urgency color  

---

## PHASE 5 — Mobile Screens (TFV2-009 to TFV2-014)

---

### TC-TFV2-009-A: Offers tab displays received pending offers

**Task:** TFV2-009  
**Preconditions:** Seller has received at least one pending offer  
**Steps:**  
1. Log in as seller  
2. Tap "Trades" bottom tab  
3. Tap "Offers" tab  
**Expected:**  
- Pending offers sorted by total value (highest first) — D-09  
- Each offer row shows item name, buyer info, offer amount  
- If OfferCountdownPill is visible on offer row — it shows remaining time  

---

### TC-TFV2-009-B: Offers tab shows empty state when no pending offers

**Task:** TFV2-009  
**Preconditions:** Seller has no pending offers  
**Steps:**  
1. Log in as seller  
2. Tap "Trades" → "Offers" tab  
**Expected:** testID `offers-empty-state` visible with friendly empty state message  

---

### TC-TFV2-010-A: ReviewOfferScreen shows combined SP total to seller (D-11)

**Task:** TFV2-010  
**Preconditions:** Seller has a pending offer that includes SP  
**Steps:**  
1. Log in as seller  
2. Tap "Trades" → "Offers" tab  
3. Tap on an offer that includes SP  
4. View ReviewOfferScreen  
**Expected:**  
- Combined SP total visible (no source breakdown per D-11)  
- SP is shown as total amount, NOT split into "buyer SP" vs "platform SP"  
- Trade card testID `trade-review-card` visible  
- SP summary section testID `trade-review-sp-summary` visible  

---

### TC-TFV2-011-A: Buyer sees "I Got It" / "Confirm" — no seller mark step (D-03)

**Task:** TFV2-011  
**Preconditions:** Buyer has an in_progress trade  
**Steps:**  
1. Log in as buyer  
2. Navigate to in_progress trade on TradeTimelineScreen  
**Expected:**  
- testID `confirm-trade-button` visible (labeled "I Got It" or "Confirm Receipt")  
- NO "Mark as Delivered" button visible for seller  
- Seller view does NOT have a "Confirm" button  

---

### TC-TFV2-011-B: Seller cannot tap "I Got It" (buyer-only completion)

**Task:** TFV2-011 / TFV2-006  
**Preconditions:** Seller views the same in_progress trade  
**Steps:**  
1. Log in as seller  
2. Navigate to the same in_progress trade  
**Expected:**  
- No `confirm-trade-button` on seller view  
- Seller sees `seller-awaiting-payment-notice` or `seller-completed-notice`  
- Seller has `seller-cancel-inprogress-button` (Addendum A) but no completion button  

---

### TC-TFV2-012-A: Item Detail shows "Request to Buy" button (D-07)

**Task:** TFV2-012  
**Preconditions:** Browse to any active listing  
**Steps:**  
1. Log in as buyer  
2. Tap "Browse" tab  
3. Tap on any listing card  
4. View listing detail screen  
**Expected:**  
- Button labeled "Request to Buy" — NOT "Pay Cash", "Buy Now", or "Purchase"  
- Tapping opens TradeOfferScreen or TradeInitiationScreen  

---

### TC-TFV2-012-B: "Use SP" button is visible but locked (🔒) for free users (D-08)

**Task:** TFV2-012  
**Preconditions:** Log in as FREE user (no subscription)  
**Steps:**  
1. Log in as free buyer  
2. Browse to a listing with `payment_preference = 'accept_sp'`  
3. View the listing detail / trade offer screen  
**Expected:**  
- SP input or "Use SP 🔒" element IS visible (not hidden)  
- Tapping it shows an upgrade/subscription modal  
- Free user CANNOT enter an SP amount  

---

### TC-TFV2-013-A: Unified offer flow — no double-charge (D-30)

**Task:** TFV2-013  
**Preconditions:** Buyer has a valid saved payment method  
**Steps:**  
1. Log in as buyer  
2. Navigate to listing detail  
3. Tap "Request to Buy"  
4. Observe the offer flow — there should be ONE combined step (not 2 separate Stripe steps)  
**Expected:**  
- Stripe pre-authorization hold happens at offer submission  
- Buyer is NOT charged immediately at offer — just a hold  
- UI shows offer sent confirmation  

---

### TC-TFV2-014-A: TradeSuccessScreen shows seller-specific CTAs

**Task:** TFV2-014  
**Preconditions:** A trade has been completed (status = completed)  
**Steps:**  
1. Log in as seller  
2. Navigate to completed trade (via TradeList → Selling tab)  
3. View the trade success/completion screen  
**Expected:**  
- testID `success-icon` visible  
- testID `list-another-button` visible for seller  
- testID `view-earnings-button` visible for seller  
- testID `leave-review-button-seller` visible  
- testID `sp-earned-badge` visible if SP was earned  

---

### TC-TFV2-014-B: TradeSuccessScreen shows buyer-specific CTAs

**Task:** TFV2-014  
**Preconditions:** Trade has been completed  
**Steps:**  
1. Log in as buyer  
2. Navigate to completed trade  
**Expected:**  
- testID `leave-review-button-buyer` visible  
- testID `view-trade-button` or `view-sp-earned-button` visible  
- testID `back-home-button` visible  
- No "List Another Item" button for buyer  

---

## PHASE 6 — Behavioral + Notifications (TFV2-015 to TFV2-016)

---

### TC-TFV2-015-A: Seller ignoring offers prompt (>= threshold consecutive)

**Task:** TFV2-015  
**Preconditions:** `listing_offer_stats.unanswered_offer_count >= 3` on the listing being tested  
**Steps:**  
1. In Supabase Studio, manually set:
   ```sql
   UPDATE listing_offer_stats
   SET unanswered_offer_count = 3
   WHERE listing_id = '<listing_id>';
   ```
2. Log in as seller  
3. Navigate to "Offers" tab  
**Expected:**  
- A prompt or banner nudging seller to respond to offers  
- Prompt is dismissible  
- NOT shown when count < threshold  

---

### TC-TFV2-016-A: Offer expiry push notification sent N hours before

**Task:** TFV2-016  
**Preconditions:** Valid FCM push token registered; trade has offer_expires_at set  
**Steps:**  
1. Check Supabase Edge Function logs after an offer nears expiry (within `offer_notif_1_hours_before`)  
2. Check push notification received on simulator  
**Expected:**  
- Push notification received: "Your offer on [item] expires soon"  
- Max 3 non-payout push notifications per user per trade  
- No duplicate notifications  

---

## PHASE 7 — Dispute + Payout + Instrumentation (TFV2-017 to TFV2-019)

---

### TC-TFV2-017-A: Report a problem opens TradeDisputeScreen

**Task:** TFV2-017  
**Preconditions:** Buyer has an in_progress trade  
**Steps:**  
1. Log in as buyer  
2. Navigate to in_progress trade on TradeTimelineScreen  
3. Tap testID `report-problem-button`  
**Expected:**  
- TradeDisputeScreen opens  
- testID `dispute-warning-banner` visible  
- Reason chips visible (testID `reason-chip-0`, `reason-chip-1`, etc.)  
- testID `dispute-description` text input visible  
- testID `submit-dispute-button` visible  
- testID `cancel-dispute-button` visible  

---

### TC-TFV2-017-B: Submitting dispute sets dispute_status = 'reported' on trade

**Task:** TFV2-017  
**Preconditions:** In_progress trade, buyer on dispute screen  
**Steps:**  
1. Tap a reason chip  
2. Enter description in `dispute-description` input  
3. Tap `submit-dispute-button`  
4. Verify in Supabase Studio:
   ```sql
   SELECT dispute_status, dispute_reason, disputed_at FROM trades WHERE id = '<trade_id>';
   ```
**Expected:**  
- `dispute_status = 'reported'`  
- `disputed_at` is set  
- `dispute_reason` contains selected reason  

---

### TC-TFV2-017-C: Trade with active dispute NOT auto-completed (D-26 guard)

**Task:** TFV2-017  
**Steps:**  
1. Set `auto_complete_at` to the past on a disputed trade (see TC-TFV2-005-A)  
2. Call `rpc_process_auto_complete()`  
**Expected:** Disputed trade remains `in_progress` — not auto-completed  

---

### TC-TFV2-018-A: Completed trade has payout_status = 'pending'

**Task:** TFV2-018  
**Preconditions:** A trade has been completed  
**Steps:**  
1. In Supabase Studio:
   ```sql
   SELECT id, payout_status, payout_idempotency_key FROM trades
   WHERE status = 'completed' LIMIT 5;
   ```
**Expected:** `payout_status` is one of: `pending`, `requires_action`, `processing`, `paid`, `failed`  

---

### TC-TFV2-018-B: Payout idempotency key is unique per trade

**Task:** TFV2-018  
**Steps:**  
1. In Supabase Studio:
   ```sql
   SELECT COUNT(*), payout_idempotency_key
   FROM trades
   WHERE payout_idempotency_key IS NOT NULL
   GROUP BY payout_idempotency_key HAVING COUNT(*) > 1;
   ```
**Expected:** Zero rows (no duplicate idempotency keys)  

---

### TC-TFV2-019-A: trade_events table stores events

**Task:** TFV2-019  
**Preconditions:** Any trade action (offer, accept, cancel, complete) has been performed  
**Steps:**  
1. In Supabase Studio:
   ```sql
   SELECT event_type, actor_id, created_at FROM trade_events LIMIT 10;
   ```
**Expected:** Event rows visible with event_type values (offer_created, trade_accepted, trade_cancelled, trade_completed, seller_cancelled, etc.)  

---

## PHASE 8 — UX Helpers + Cart (TFV2-020 to TFV2-022)

---

### TC-TFV2-020-A: Safe Meetup V1-Lite card visible on in-progress trade

**Task:** TFV2-020  
**Preconditions:** Trade in `in_progress` state  
**Steps:**  
1. Navigate to TradeTimelineScreen for an in_progress trade  
2. Scroll to meetup section  
**Expected:**  
- Safe meetup card visible with meetup location guidance  
- Card shows address or general area (NOT exact address)  

---

### TC-TFV2-021-A: Chat quick-replies visible in messaging for active trades

**Task:** TFV2-021  
**Preconditions:** Trade in `in_progress`, buyer or seller in chat  
**Steps:**  
1. Tap `message-button` on TradeTimelineScreen  
2. View chat screen  
**Expected:**  
- Quick-reply chips visible (e.g., "Available this weekend", "Can meet at [location]")  
- Tapping a chip inserts predefined text  

---

### TC-TFV2-022-A: Bundle rows visible in TradeList Offers tab (D-27)

**Task:** TFV2-022 / Addendum D  
**Preconditions:** Seller has received bundled offers (multiple items with same bundle_id)  
**Steps:**  
1. Log in as seller  
2. Tap "Trades" → "Offers" tab  
**Expected:**  
- Bundle row visible (testID `bundle-row-<bundleId>`)  
- "Accept All N Items" button (testID `bundle-accept-all`)  
- "Review Each" button (testID `bundle-review-each`)  
- "Decline All" button (testID `bundle-decline-all`)  

---

### TC-TFV2-022-B: Accepting a bundle accepts all items in bundle

**Task:** TFV2-022  
**Preconditions:** Bundle row visible from TC-TFV2-022-A  
**Steps:**  
1. Tap `bundle-accept-all`  
2. Confirm in dialog (if shown)  
3. Check TradeList "Selling" tab  
**Expected:**  
- All trades with same bundle_id move to `in_progress`  
- Each appears as separate trade row in "Selling" tab  
- bundle_id has NO business logic attached — it's UX grouping only (D-27)  

---

### TC-TFV2-022-C: Bundle eviction modal shown when 4th cart added (D-29)

**Task:** TFV2-022  
**Preconditions:** Buyer has 3 active carts; adds a 4th listing to cart  
**Steps:**  
1. Log in as subscriber buyer  
2. Add 3 listings from 3 different sellers to carts  
3. Attempt to add a 4th listing from a 4th seller  
**Expected:**  
- Eviction warning modal shown: warns that one existing cart will be removed  
- NOT silent LRU eviction (D-29)  
- Buyer must explicitly confirm  

---

## TFV2-023 + ADDENDA A–E

---

### TC-TFV2-023-A: Seller cancel in-progress trade shows consequence alert

**Task:** TFV2-023 / Addendum A  
**Preconditions:** Seller has an in_progress trade (Stripe charge already captured)  
**Steps:**  
1. Log in as seller  
2. Navigate to in_progress trade on TradeTimelineScreen  
3. Look for testID `seller-cancel-inprogress-button`  
4. Tap the button  
5. CancellationReasonModal opens — select a reason  
6. Confirm cancellation  
**Expected:**  
- Alert shown: consequence level 1 ("Warning: you have [N] cancellation(s)")  
- After 2nd cancellation: stronger warning (level 2)  
- After 3rd+ cancellation: admin review flag set (level 3+)  
- `post_acceptance_cancellation_count` incremented in DB  

---

### TC-TFV2-023-B: Free user seller cancellation — NO consequence (pre-Stripe stage)

**Task:** TFV2-023  
**Preconditions:** Trade in `pending` state (not yet in_progress)  
**Steps:**  
1. Seller declines (cancels) a pending trade  
**Expected:**  
- No consequence alert shown (this is a pre-acceptance cancellation)  
- `post_acceptance_cancellation_count` NOT incremented  

---

### TC-ADDENDUM-A: SELLER_INPROGRESS_REASONS shown in cancel modal

**Task:** Addendum A  
**Preconditions:** Seller views in_progress trade  
**Steps:**  
1. Tap `seller-cancel-inprogress-button`  
2. CancellationReasonModal opens  
**Expected:**  
- Reasons shown: "Can't do pickup/meetup", "Item no longer available", "Other"  
- Standard buyer reasons NOT shown  

---

### TC-ADDENDUM-B: Value stack shows correct calculations

**Task:** Addendum B  
**Preconditions:** Subscriber buyer on TradeOfferScreen; item price $20  
**Steps:**  
1. Log in as subscriber buyer  
2. Navigate to TradeOfferScreen for a $20 item  
3. Enter SP amount: `10`  
4. Look at testID `value-stack-row`  
**Expected:**  
- Offer amount: $20  
- SP discount: -$10  
- Platform fee: $0.99 (subscriber, hardcoded — TODO-07 🔴)  
- Total cash: $10.99  

---

### TC-ADDENDUM-B-2: Value stack with no SP shows no discount row

**Task:** Addendum B  
**Steps:**  
1. On TradeOfferScreen, set SP amount to `0`  
**Expected:**  
- No "SP discount" row visible  
- Total cash = item price + $0.99 fee  

---

### TC-ADDENDUM-C: Bundle context banner on TradeTimelineScreen

**Task:** Addendum C  
**Preconditions:** Trade is part of a bundle (has bundle_id)  
**Steps:**  
1. Navigate to a bundled trade's TradeTimelineScreen  
**Expected:**  
- testID `bundle-context-banner` visible: "Part of a bundle · N items"  
- N matches the actual number of items in the bundle  

---

### TC-ADDENDUM-C-2: Confirm All N shortcut on bundled trade

**Task:** Addendum C  
**Preconditions:** Buyer on bundled in_progress trade, TradeTimelineScreen  
**Steps:**  
1. View `confirm-trade-button` label  
**Expected:**  
- Button shows "Confirm All N Items" or similar  
- Tapping shows alert: "Confirm all N items?"  
- Confirming completes all bundled trades  

---

### TC-ADDENDUM-D: Bundled offers grouped in Offers tab

**Task:** Addendum D  
**Preconditions:** Seller has received bundled offers  
**Steps:**  
1. Log in as seller → Trades → Offers tab  
**Expected:**  
- testID `bundle-row-<bundleId>` visible  
- Seller sees Accept All / Review Each / Decline All actions  
- Individual non-bundled offers shown as separate rows  

---

### TC-ADDENDUM-D-2: In-progress bundles in Buying tab

**Task:** Addendum D  
**Preconditions:** Buyer has multiple in_progress trades with same bundle_id  
**Steps:**  
1. Log in as buyer → Trades → Buying tab  
**Expected:**  
- testID `inprogress-bundles` section visible  
- Bundle group shows all items in the bundle  

---

### TC-ADDENDUM-E: Bundle banner on ReviewOfferScreen

**Task:** Addendum E  
**Preconditions:** Seller reviewing an offer that is part of a bundle  
**Steps:**  
1. Log in as seller → Trades → Offers tab  
2. Tap on an individual offer that has a bundle_id  
**Expected:**  
- testID `bundle-context-banner` visible: "This item is part of a bundle"  
- testID `accept-bundle-button` visible: "Accept All N Items"  
- Seller can still accept just this item OR accept all  

---

## Regression Checklist (Run after any trade-related change)

### REG-01: SP cap never exceeded (FR-SP-001)

**Steps:**  
1. On TradeOfferScreen, enter SP amount > 50% of item price  
**Expected:** SP input clamped or error shown. Total cash always includes platform fee.

---

### REG-02: Free user cannot earn or spend SP

**Steps:**  
1. Log in as free user, make an offer  
**Expected:** SP input is locked with 🔒 (D-08). Submitting offer has sp_amount = 0.

---

### REG-03: Buyer-only completion enforced everywhere (D-03)

**Steps:**  
1. Log in as SELLER on in_progress trade  
2. Look for "I Got It" or "Confirm Receipt" button  
**Expected:** NO such button visible for seller anywhere.

---

### REG-04: Navigation — all trade routes work without crash

**Steps:**  
1. TradeList → Offers tab → tap offer → ReviewOfferScreen → back  
2. TradeList → Buying tab → tap trade → TradeTimelineScreen → back  
3. Listing detail → Request to Buy → TradeOfferScreen → back  
**Expected:** No crash, correct screens, back navigation works.

---

## Navigation Verification (AppNavigator.tsx)

Current registered trade routes (confirmed — no changes needed):

| Route Name | Screen | Notes |
|---|---|---|
| `TradeInitiation` | TradeOfferScreen | Buyer submits offer |
| `ReviewOffer` | ReviewOfferScreen | Seller reviews offer |
| `TradeList` | TradeListScreen | All/Offers/Buying/Selling tabs |
| `TradeDetail` | TradeTimelineScreen | Legacy alias |
| `TradeTimeline` | TradeTimelineScreen | Primary trade timeline |

All routes confirmed present in `AppNavigator.tsx`. No navigation file changes required.

---

## Automated Test Coverage Summary

| Task | Unit Tests | E2E Integration | Maestro UI |
|---|---|---|---|
| TFV2-001 | trade-tfv2-core-logic.test.ts (§2) | trade-tfv2-001-022.e2e.ts | — |
| TFV2-002 | trade-tfv2-core-logic.test.ts (§6,8) | trade-tfv2-001-022.e2e.ts | — |
| TFV2-003 | trade-tfv2-core-logic.test.ts (§1) | trade-tfv2-001-022.e2e.ts | — |
| TFV2-004 | trade-tfv2-core-logic.test.ts (§7) | trade-tfv2-001-022.e2e.ts | — |
| TFV2-005 | — | trade-tfv2-001-022.e2e.ts | — |
| TFV2-006 | trade-tfv2-core-logic.test.ts (§5) | trade-tfv2-001-022.e2e.ts | — |
| TFV2-007 | trade-tfv2-core-logic.test.ts (§3) | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-D) |
| TFV2-008 | — | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-D) |
| TFV2-009 | — | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-B) |
| TFV2-010 | — | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-E) |
| TFV2-011 | — | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-C) |
| TFV2-012 | — | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-A) |
| TFV2-012A | trade-tfv2-core-logic.test.ts (§4) | — | — |
| TFV2-013 | — | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-A) |
| TFV2-014 | — | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-G) |
| TFV2-015 | — | — | — |
| TFV2-016 | — | — | — |
| TFV2-017 | — | trade-tfv2-001-022.e2e.ts | module-15.1.2-full-trade-flow-v2.yaml (FLOW-F) |
| TFV2-018 | — | trade-tfv2-001-022.e2e.ts | — |
| TFV2-019 | — | trade-tfv2-001-022.e2e.ts | — |
| TFV2-020 | — | — | — |
| TFV2-021 | — | — | — |
| TFV2-022 | TradeListBundleGrouping.test.ts | trade-tfv2-001-022.e2e.ts | module-15.1.2-full-trade-flow-v2.yaml (FLOW-B) |
| TFV2-023 | trade-tfv2-023-cancel-consequences.test.ts | trade-tfv2-023-bundle.e2e.ts | module-15.1.2-full-trade-flow-v2.yaml (FLOW-H) |
| Addendum A | trade-tfv2-023-cancel-consequences.test.ts | trade-tfv2-023-bundle.e2e.ts | module-15.1.2-full-trade-flow-v2.yaml (FLOW-H) |
| Addendum B | TradeOfferScreen.test.tsx | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-A) |
| Addendum C | — | trade-tfv2-023-bundle.e2e.ts | module-15.1.2-full-trade-flow-v2.yaml (FLOW-I) |
| Addendum D | TradeListBundleGrouping.test.ts | — | module-15.1.2-full-trade-flow-v2.yaml (FLOW-B) |
| Addendum E | — | trade-tfv2-023-bundle.e2e.ts | module-15.1.2-full-trade-flow-v2.yaml (FLOW-E) |
