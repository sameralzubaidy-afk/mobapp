# MODULE 15.1.2 VERIFICATION CHECKLIST: TRADE FLOW V2 — FULL IMPLEMENTATION

**Module:** Trade Flow V2 — Full Implementation  
**Version:** 2.1 (includes D-30 Payment Authorization Hold)  
**Total Tasks:** 24 (TFV2-001 → TFV2-022 + TFV2-012A + Phase 2)  
**Requirements Source:** `/docx/TRADING-FLOW-V2.md` v2.1 (May 26, 2026)  
**Spec Source:** `Prompts/MODULE-15.1.2-TradeFlowV2.md`  
**Status:** Ready for Implementation

---

## PURPOSE

This checklist verifies that MODULE 15.1.2 (Trade Flow V2) has been fully implemented per spec, with:
1. All Phase 2 foundational DB migrations applied to the live database
2. All Phase 3 DB schema V2 extensions, triggers, and cron jobs operational
3. All React Native components and mobile screens built to spec
4. All Edge Functions deployed with correct guards and Stripe integration
5. All push notifications working with correct throttling and deep links
6. All dispute, payout, and event instrumentation wired end-to-end
7. All UX helpers and cart bundle checkout implemented
8. All 16 critical decisions (D-03 through D-30) fully enforced
9. Full cross-module integration with MODULE-09 (SP Wallet), MODULE-11 (Subscriptions), MODULE-14 (Notifications)

---

## CRITICAL DECISIONS — MUST VERIFY BEFORE SIGN-OFF

> These are non-negotiable. Any ❌ here = BLOCK. Do not sign off until all pass.

| Decision | Rule | Where to Check |
|---|---|---|
| **D-03** | Buyer-only completion — NO seller "Mark Complete" anywhere | TradeTimelineScreen, TradeDetailScreen, complete-trade EF |
| **D-07** | Button label = "Request to Buy" — NOT "Pay Cash" / "Buy Now" | ItemDetailScreen, TradeOfferScreen |
| **D-08** | "Use SP 🔒" VISIBLE but locked for free users — NOT hidden | ItemDetailScreen |
| **D-09** | Received offers sorted by total value DESC | TradeListScreen |
| **D-10** | SP soft-reserved at offer submission (BEFORE seller accepts) | fn_reserve_sp_on_offer trigger |
| **D-11** | Combined SP total shown to seller — NO source breakdown | ReviewOfferScreen |
| **D-17** | Single SP release event at completion — buyer SP + platform SP → seller pending_sp in ONE operation | fn_release_all_sp_on_complete |
| **D-25** | "Request to Buy" on BOTH ItemDetailScreen AND TradeInitiationScreen | Both screens |
| **D-26** | Disputes = overlay columns on trades — NOT new state machine states | trades table, resolve-dispute EF |
| **D-27** | bundle_id = UX grouping ONLY — zero business logic | carts, trades, checkoutCart() |
| **D-28** | Cart = single-seller per active cart | cartService.addToCart() |
| **D-29** | Explicit eviction warning modal for 4th cart — NOT silent LRU | CartScreen, addToCart() |
| **D-30 🔴** | Stripe pre-auth + SP hold ATOMIC at offer submission — both succeed or both rollback | transactions-create EF |
| **TODO-07 🔴** | Fee structure BLOCKED — do NOT change fee calculation logic | ALL files touching fees |
| **FR-SP-001** | Platform SP only when seller is subscriber AND listing is accept_sp | fn_release_all_sp_on_complete |
| **FR-LM-002** | payment_preference lock trigger on listings with active trades | fn_lock_payment_preference trigger |

---

## PHASE 2: FOUNDATIONAL DB MIGRATIONS

> These 3 migrations must be applied to the live Supabase project (`drntwgporzabmxdqykrp`) before any Phase 3 work begins.

### 2.1 Migration: `20260510000001_trade_authorization_updates.sql`

- [ ] Migration applied and visible in `supabase_migrations` table (version `20260510000001`)
- [ ] `trades.authorization_id VARCHAR(255)` column exists
- [ ] `trades.authorization_amount NUMERIC` column exists
- [ ] `trades.authorization_expires_at TIMESTAMPTZ` column exists
- [ ] `admin_config.offer_timeout_hours INTEGER DEFAULT 48` column exists
- [ ] CHECK constraint `check_offer_timeout_hours` enforces range 1–168

**Verification SQL:**
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'trades' AND column_name IN ('authorization_id','authorization_amount','authorization_expires_at');
SELECT column_name FROM information_schema.columns
WHERE table_name = 'admin_config' AND column_name = 'offer_timeout_hours';
```

### 2.2 Migration: `20260510000002_sp_hold_enum.sql`

- [ ] Migration applied (version `20260510000002`)
- [ ] `sp_transaction_type` enum has values: `hold`, `hold_release`, `hold_consumed`
- [ ] `get_sp_wallet_balance(p_user_id UUID)` RPC exists and returns `available_sp` + `on_hold_sp`
- [ ] RPC correctly computes `available_sp = earned - spent - hold + hold_release`
- [ ] RPC correctly computes `on_hold_sp = hold - hold_release - hold_consumed`

**Verification SQL:**
```sql
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'sp_transaction_type' AND enumlabel IN ('hold','hold_release','hold_consumed');
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'get_sp_wallet_balance';
```

### 2.3 Migration: `20260510000003_offer_timeout_rpc.sql`

- [ ] Migration applied (version `20260510000003`)
- [ ] `invoke_check_offer_timeouts()` RPC function exists
- [ ] pg_cron job `check-offer-timeouts` scheduled at `0 * * * *` (every hour)
- [ ] `custom.edge_function_base_url` and `custom.service_role_key` settings configured
- [ ] `pg_net` and `pg_cron` extensions both enabled

**Verification SQL:**
```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'check-offer-timeouts';
SELECT name, setting FROM pg_settings WHERE name LIKE 'custom.%';
```

---

## PHASE 3: DATABASE + BACKEND

---

### TFV2-001: Admin Config — Trade Timing Fields

**Migration:** `supabase/migrations/20260528000001_admin_config_trade_timing.sql`  
**Admin Files:** `p2p-kids-admin/src/app/settings/page.tsx`, `p2p-kids-admin/src/lib/admin-config.ts`

#### Database

- [ ] `admin_config.auto_complete_hours INTEGER NOT NULL DEFAULT 48` added with `CHECK (>= 1)`
- [ ] `admin_config.sp_pending_release_days INTEGER NOT NULL DEFAULT 3` added with `CHECK (>= 1)`
- [ ] `admin_config.offer_notif_1_hours_before INTEGER NOT NULL DEFAULT 6` added
- [ ] `admin_config.offer_notif_2_hours_before INTEGER NOT NULL DEFAULT 1` added
- [ ] `admin_config.auto_complete_notif_1_hours_before INTEGER NOT NULL DEFAULT 24` added
- [ ] `admin_config.auto_complete_notif_2_hours_before INTEGER NOT NULL DEFAULT 2` added
- [ ] `validate_trade_timing_config()` trigger function exists on `admin_config` BEFORE INSERT OR UPDATE
- [ ] Trigger rejects: `offer_notif_1_hours_before > offer_timeout_hours`
- [ ] Trigger rejects: `offer_notif_2_hours_before >= offer_notif_1_hours_before`
- [ ] Trigger rejects: `auto_complete_notif_1_hours_before > auto_complete_hours`
- [ ] Trigger rejects: `auto_complete_notif_2_hours_before >= auto_complete_notif_1_hours_before`
- [ ] All 6 columns have descriptive SQL COMMENTs

#### Admin UI

- [ ] "Trade Timing Settings" section visible in admin settings page
- [ ] All 7 fields render with correct label, description, and unit text
- [ ] **NO `min` or `max` HTML attributes on any input** — validation is server-side only (Section 9.4)
- [ ] Saving invalid cross-field values surfaces the DB exception message inline (e.g., "offer_notif_1_hours_before must be <= offer_timeout_hours")
- [ ] `TradeTimingConfig` TypeScript interface covers all 7 fields in `admin-config.ts`

---

### TFV2-002: DB Schema — V2 Columns on `trades` Table

**Migration:** `supabase/migrations/20260528000002_trades_v2_columns.sql`  
**Mobile File:** `src/types/trade.ts`

#### Timing Columns

- [ ] `trades.offer_expires_at TIMESTAMPTZ` added with partial index on `status = 'pending'`
- [ ] `trades.auto_complete_at TIMESTAMPTZ` added with partial index on `status = 'in_progress'`
- [ ] Existing `pending` trades backfilled: `offer_expires_at = created_at + 24h`
- [ ] Existing `in_progress` trades backfilled: `auto_complete_at = updated_at + 48h`

#### SP Snapshot Columns

- [ ] `trades.sp_earned_at_completion INTEGER` added
- [ ] `trades.sp_released_at TIMESTAMPTZ` added
- [ ] `sp_earned_at_completion` has SQL COMMENT explaining drift-prevention purpose

#### Dispute Overlay Columns (D-26)

- [ ] `dispute_status TEXT NOT NULL DEFAULT 'none'` with CHECK `IN ('none','reported','under_review','resolved')`
- [ ] `dispute_resolution TEXT` with CHECK `IN ('completed','refunded') OR NULL`
- [ ] `dispute_reported_at TIMESTAMPTZ` added
- [ ] `dispute_reason TEXT` added
- [ ] `dispute_resolved_at TIMESTAMPTZ` added
- [ ] `dispute_resolved_by UUID REFERENCES auth.users(id)` added
- [ ] Partial index on `dispute_status` covering `reported` and `under_review` values

#### Payout Columns

- [ ] `payout_status TEXT NOT NULL DEFAULT 'pending'` with CHECK `IN ('pending','requires_action','processing','paid','failed')`
- [ ] `payout_idempotency_key TEXT UNIQUE` added
- [ ] `payout_initiated_at TIMESTAMPTZ` added
- [ ] `payout_paid_at TIMESTAMPTZ` added
- [ ] Existing completed trades backfilled: `payout_idempotency_key = 'payout_' || id`

#### Bundle Column (D-27)

- [ ] `bundle_id UUID` added with partial index on `WHERE bundle_id IS NOT NULL`

#### SP Wallet Table

- [ ] `sp_wallets.reserved_sp INTEGER NOT NULL DEFAULT 0 CHECK (>= 0)` added (verify table name first)

#### Supporting Tables + Profile Columns

- [ ] `listing_offer_stats` table created: `(seller_id, listing_id, consecutive_unanswered_offers_count, prompt_sent_at, updated_at)` with UNIQUE `(seller_id, listing_id)`
- [ ] `listing_offer_stats` has RLS enabled: service role only
- [ ] `profiles.post_acceptance_cancellation_count INTEGER NOT NULL DEFAULT 0` added
- [ ] `profiles.admin_review_flagged_at TIMESTAMPTZ` added
- [ ] `post_acceptance_cancellation_count` has SQL COMMENT clarifying pre-acceptance declines do NOT increment

#### Payment Preference Lock Trigger (FR-LM-002)

- [ ] `fn_lock_payment_preference()` function exists on `listings` BEFORE UPDATE
- [ ] Trigger raises exception when `payment_preference` changes while ANY trade exists with `status IN ('pending', 'payment_processing', 'in_progress')`
- [ ] Trigger has SQL COMMENT citing FR-LM-002

#### TypeScript Types

- [ ] `DisputeStatus`, `DisputeResolution`, `PayoutStatus` types exported from `src/types/trade.ts`
- [ ] `Trade` interface includes all new fields: `offer_expires_at`, `auto_complete_at`, `dispute_status`, `dispute_resolution`, `dispute_reported_at`, `dispute_reason`, `dispute_resolved_at`, `dispute_resolved_by`, `payout_status`, `payout_idempotency_key`, `payout_initiated_at`, `payout_paid_at`, `bundle_id`, `sp_earned_at_completion`

---

### TFV2-003: SP Reserve/Release DB Triggers

**Migration:** `supabase/migrations/20260528000003_sp_reserve_release_triggers.sql`

#### Trigger 1: fn_set_offer_expires_at

- [ ] BEFORE INSERT on trades; sets `offer_expires_at = NOW() + offer_timeout_hours * 1h` when `status = 'pending'`
- [ ] Reads `offer_timeout_hours` from `admin_config`; defaults to 24 if null

#### Trigger 2: fn_reserve_sp_on_offer (D-10)

- [ ] AFTER INSERT on trades when `points_amount > 0`
- [ ] Atomically decrements `available_sp` and increments `reserved_sp` on buyer's SP wallet
- [ ] Raises exception if buyer has insufficient `available_sp` (no negative balances)
- [ ] Uses `SECURITY DEFINER`

#### Trigger 3: fn_transfer_sp_on_accept

- [ ] Fires on `status → payment_processing` transition
- [ ] Intentional NO-OP — buyer SP stays in `reserved_sp` until completion (D-17)
- [ ] Function body has comment citing D-17

#### Trigger 4: fn_release_sp_on_cancel

- [ ] AFTER UPDATE when `status → cancelled`
- [ ] Restores buyer `reserved_sp → available_sp` using `GREATEST(0, reserved_sp - points_amount)`
- [ ] Fires for ALL cancellation reasons (expired, competing, seller declined, admin dispute refund)
- [ ] Uses `SECURITY DEFINER`

#### Trigger 5: fn_release_all_sp_on_complete (D-17 + FR-SP-001)

- [ ] AFTER UPDATE when `status → completed`
- [ ] Fetches `listing.payment_preference`, `seller.subscription_status`, `admin_config.sp_category_multiplier`
- [ ] **FR-SP-001 GUARD**: Platform SP = 0 if `subscription_status NOT IN ('trial','active')` OR `payment_preference != 'accept_sp'`
- [ ] When eligible: `v_platform_sp = ROUND(price × 0.25 × category_multiplier)`
- [ ] Snapshots `sp_earned_at_completion = buyer_sp + platform_sp` on the trade record BEFORE wallet updates
- [ ] Deducts buyer `reserved_sp` (single UPDATE)
- [ ] Adds combined total to seller `pending_sp` in ONE UPDATE statement (D-17 single event)
- [ ] Uses `SECURITY DEFINER`

---

### TFV2-004: Offer Expiry Cron + Auto-decline Trigger

**Migration:** `supabase/migrations/20260528000004_offer_expiry_cron.sql`  
**Edge Function:** `supabase/functions/process-expired-offers/index.ts`

#### fn_auto_decline_competing Trigger

- [ ] Fires AFTER UPDATE when `status → payment_processing`
- [ ] Cancels ALL other `pending` trades on same `listing_id` with `cancellation_reason = 'offer_expired_competing'`
- [ ] Does NOT cancel the accepted trade itself
- [ ] `fn_release_sp_on_cancel` fires automatically for each auto-declined trade (cascade)

#### fn_set_auto_complete_at Trigger

- [ ] Fires BEFORE UPDATE when `status → in_progress`
- [ ] Sets `auto_complete_at = NOW() + auto_complete_hours * 1h` from admin config (default 48h)

#### rpc_process_expired_offers RPC

- [ ] Cancels all `pending` trades where `offer_expires_at < NOW()`
- [ ] Sets `cancellation_reason = 'offer_expired'`
- [ ] Increments `listing_offer_stats.consecutive_unanswered_offers_count` per `(seller_id, listing_id)` using `ON CONFLICT DO UPDATE`
- [ ] Returns `{ expired_count, trade_ids }` JSON
- [ ] Idempotent — already-cancelled trades not re-cancelled

#### Edge Function + Cron

- [ ] `process-expired-offers` Edge Function deployed; calls `rpc_process_expired_offers()`
- [ ] pg_cron job `process-expired-offers` scheduled at `*/5 * * * *` (every 5 minutes)
- [ ] Edge Function returns 200 on success, 500 on RPC error

#### Counter Reset

- [ ] `fn_reset_unanswered_counter` trigger fires AFTER UPDATE when `status → payment_processing` or `status → cancelled` with non-expiry reason
- [ ] Resets `consecutive_unanswered_offers_count = 0` for `(seller_id, listing_id)`
- [ ] Does NOT reset on `cancellation_reason IN ('offer_expired', 'offer_expired_competing')`

---

### TFV2-005: Auto-Complete Cron + SP Release Cron

**Migration:** `supabase/migrations/20260528000005_auto_complete_cron.sql`  
**Edge Function:** `supabase/functions/process-auto-complete/index.ts`

#### rpc_process_auto_complete RPC

- [ ] Completes `in_progress` trades where `auto_complete_at < NOW()`
- [ ] **D-26 GUARD**: skips trades with `dispute_status IN ('reported', 'under_review')`
- [ ] Sets `status = 'completed'`, `completed_at = NOW()`
- [ ] Setting status to `completed` fires `fn_release_all_sp_on_complete` automatically
- [ ] Returns `{ completed_count, trade_ids }` JSON

#### rpc_release_pending_sp RPC

- [ ] Moves seller `pending_sp → available_sp` after `sp_pending_release_days` (from admin config)
- [ ] **Uses `sp_earned_at_completion` — does NOT recalculate** (prevents config drift after spec update)
- [ ] Skips trades with `dispute_status IN ('reported', 'under_review')`
- [ ] Sets `sp_released_at = NOW()` to prevent double-release on retry
- [ ] Filters `COALESCE(sp_earned_at_completion, 0) > 0` — skips zero-SP trades

#### Cron Jobs

- [ ] `process-auto-complete` pg_cron scheduled at `*/5 * * * *`
- [ ] `release-pending-sp` pg_cron scheduled at `0 * * * *` (hourly)
- [ ] Both Edge Functions deployed and return 200 on success

---

### TFV2-006: `completeTradeV2()` Service Function + `complete-trade` Edge Function

**Mobile:** `src/services/tradeServiceV2.ts`  
**Edge Function:** `supabase/functions/complete-trade/index.ts`

#### completeTradeV2() Service Function

- [ ] Fetches trade and validates `buyer_id === buyerId` (only buyer can complete)
- [ ] Rejects if `status !== 'in_progress'`
- [ ] Rejects if `dispute_status IN ('reported', 'under_review')` (D-26)
- [ ] Sets `status = 'completed'` — all SP logic handled automatically by DB triggers
- [ ] Returns `{ trade, sp_released_to_seller }`

#### cancelTradeV2() Service Function

- [ ] Fetches trade `authorization_id` before updating status
- [ ] Calls `release-payment` Edge Function with `{ trade_id, authorization_id, trade_status }`
- [ ] Stripe release failure is non-fatal (logged but trade still cancelled)
- [ ] Sets `status = 'cancelled'` with `cancellation_reason`
- [ ] `fn_release_sp_on_cancel` trigger fires automatically

#### complete-trade Edge Function

- [ ] Requires valid JWT in `Authorization` header — returns 401 if missing
- [ ] Verifies `user.id === trade.buyer_id` — returns 403 if not buyer (D-03)
- [ ] Validates `status === 'in_progress'` — returns 422 if not
- [ ] Validates `dispute_status NOT IN ('reported', 'under_review')` — returns 422 if disputed
- [ ] Uses service role client for the actual DB update
- [ ] Returns `{ trade: completedTrade }` on success

---

## PHASE 4: REACT NATIVE COMPONENTS

---

### TFV2-007: `<OfferCountdownPill />` Component

**File:** `src/components/trade/OfferCountdownPill.tsx`

- [ ] Component renders with 5 urgency color states:
  - `> 50%` remaining → `#5DBB8E` green
  - `25–50%` remaining → `#F59E0B` amber
  - `10–25%` remaining → `#FF8C00` orange
  - `< 10%` remaining → `#EF4444` red
  - Expired → `#9CA3AF` gray
- [ ] Updates every 60 seconds (NOT every second — battery drain prevention)
- [ ] "Expired" state: gray bg, no timer icon, text "Expired"
- [ ] Pill height 24px, `borderRadius: 12` (pill-shaped)
- [ ] Icon is Phosphor `Timer` — NOT Ionicons or any other package
- [ ] `accessibilityLabel` describes remaining time or expiry
- [ ] Exported from `src/components/trade/index.ts`
- [ ] Unit test: renders correct color for each urgency threshold
- [ ] Unit test: shows "Expired" when `expiresAt` is in the past

---

### TFV2-008: `<AutoCompleteBanner />` Component

**File:** `src/components/trade/AutoCompleteBanner.tsx`

- [ ] Full-width banner with no horizontal margins
- [ ] Shows Phosphor `Timer` icon + "Auto-completing in Xh Ym" headline
- [ ] Shows sub-text: `"Received it already? Tap 'I Got It' to confirm."`
- [ ] Same urgency color thresholds as `OfferCountdownPill`
- [ ] Updates every 60 seconds
- [ ] `accessibilityLabel` describes countdown and action
- [ ] **Buyer-view-only responsibility lies with the calling component** (TradeTimelineScreen)
- [ ] Hidden when trade is `completed` or `cancelled` — caller handles this gate
- [ ] Exported from `src/components/trade/index.ts`

---

## PHASE 5: MOBILE SCREENS

---

### TFV2-009: TradeListScreen — Offers Tab Updates

**File:** `src/screens/trade/TradeListScreen.tsx`

- [ ] `offer_expires_at` and `bundle_id` included in Supabase query select
- [ ] Received offers (seller view) sorted by `total_value DESC` where `total_value = cash_amount_cents + (points_amount * 100)`
- [ ] Tie-break 1: highest cash first; Tie-break 2: earliest `created_at` first
- [ ] `<OfferCountdownPill />` shown right-aligned on every `pending` offer row
- [ ] Offers with `offer_expires_at < NOW() - 24h` AND `status = 'cancelled'` hidden from both views
- [ ] Bundle chip shown (Phosphor `Package` icon, 12px) when `bundle_id` is non-null
- [ ] Submitted offers (buyer view) sorted by `created_at DESC`
- [ ] No existing offer tab functionality broken

---

### TFV2-010: ReviewOfferScreen — SP Total + Wallet Projection

**Files:** `src/screens/trade/ReviewOfferScreen.tsx`, `src/services/spCalculatorService.ts`

- [ ] `calculatePlatformSP(listingId)` uses `ROUND(price × 0.25 × category_multiplier)` formula
- [ ] Combined SP total shown as `"[X] SP releasing in [N] days"` — no source breakdown (D-11)
- [ ] N = live `sp_pending_release_days` from admin_config
- [ ] Cash-only path: shows platform SP only (buyer used 0 SP)
- [ ] Projected wallet state: `"After this trade your SP balance: [current + X SP in N days]"`
- [ ] `<OfferCountdownPill />` shown in header area below item title
- [ ] Existing [Accept] and [Decline] buttons unchanged
- [ ] No counter-offer button (Decision D-06)

---

### TFV2-011: TradeTimelineScreen + TradeDetailScreen + IssueReportModal + open-dispute

**Files:** `TradeTimelineScreen.tsx`, `TradeDetailScreen.tsx`, `IssueReportModal.tsx`, `supabase/functions/open-dispute/index.ts`

#### TradeTimelineScreen — Removed Items (D-03)

- [ ] Seller "Mark Complete" button removed from seller view
- [ ] `seller_marked_completed_at` removed as a required timeline step in UI

#### TradeTimelineScreen — Buyer View (in_progress, no dispute)

- [ ] `<AutoCompleteBanner />` shown at top of scroll content
- [ ] **[I Got It]** primary green pill button (52px, `#5DBB8E` bg) visible
- [ ] **[Report a Problem]** secondary outlined button (52px, border `#EF4444`) visible
- [ ] [I Got It] calls `completeTradeV2()` then navigates to `TradeSuccess`
- [ ] [Report a Problem] opens `<IssueReportModal />`
- [ ] [Message Seller] text link always visible during `in_progress`

#### TradeTimelineScreen — Buyer View (active dispute)

- [ ] Amber banner (`#F59E0B`) replaces AutoCompleteBanner
- [ ] Banner text: "Your issue has been reported. Our team will review within 24 hours. Auto-complete is paused."
- [ ] [I Got It] and [Report a Problem] buttons hidden
- [ ] [Message Seller] still visible

#### TradeTimelineScreen — Seller View (active dispute)

- [ ] Amber notice banner shown: "A buyer has reported an issue with this trade. Our team is reviewing."
- [ ] [Cancel] button hidden when `dispute_status IN ('reported', 'under_review')`
- [ ] [Message Buyer] still visible

#### TradeDetailScreen

- [ ] Receives same D-03 changes: no seller mark step
- [ ] [I Got It] and [Report a Problem] buttons added
- [ ] Same dispute banners as TradeTimelineScreen
- [ ] Same seller cancel block on active dispute

#### IssueReportModal

- [ ] Bottom-sheet modal (20px top radius, handle pill, slide-up animation)
- [ ] 4 reason options: "Seller didn't show up", "Item not as described", "Couldn't agree on meetup", "Other"
- [ ] Optional free-text details input (filled style, `#F0F0F0`, max 500 chars)
- [ ] [Submit Report] button disabled until reason selected
- [ ] Submit button: red pill (`#EF4444`, 52px), disabled state: `#E0E0E0`
- [ ] All icons are Phosphor (`WarningCircle`, `X`) — NOT Ionicons
- [ ] `onSubmit` calls `supabase.functions.invoke('open-dispute', ...)` — NOT direct client UPDATE

#### open-dispute Edge Function

- [ ] Deployed at `supabase/functions/open-dispute/index.ts`
- [ ] Requires valid JWT — returns 401 if missing
- [ ] **Guard 1**: Rejects if `trade.status !== 'in_progress'` → 422
- [ ] **Guard 2**: Rejects if `caller !== trade.buyer_id` → 403
- [ ] **Guard 3**: Rejects if `dispute_status !== 'none'` → 409
- [ ] On success: sets `dispute_status = 'reported'`, `dispute_reason`, `dispute_reported_at`
- [ ] Returns `{ success: true }` on 200

---

### TFV2-012: Item Detail — Request to Buy / Use SP Button Logic

**File:** `src/screens/home/ItemDetailScreen.tsx`

- [ ] **D-07**: Button label is "Request to Buy" — NOT "Pay Cash" / "Buy Now"
- [ ] Cash Only listings: only [Request to Buy] button shown
- [ ] Accept SP listings: both [Request to Buy] and [Use SP] shown
- [ ] Donate listings: only [Claim] button shown
- [ ] **D-08**: [Use SP] for free users shows Phosphor `Lock` icon (16px) — VISIBLE, NOT hidden
- [ ] Tapping locked [Use SP] opens upgrade modal — NOT the SP slider
- [ ] Upgrade modal copy: "Unlock SP discounts with Kids Club+. Save up to 50% on items. 30 days free."
- [ ] Upgrade modal CTA: "Try Kids Club+ Free — 30 Days" → navigates to `SubscriptionChoice`
- [ ] [Request to Buy] → navigates to offer flow with `payment_type='cash'`
- [ ] [Use SP] (subscriber) → navigates to offer flow with `payment_type='sp'`
- [ ] **D-25**: "Request to Buy" label also present on `TradeInitiationScreen`
- [ ] Both buttons: 52px height, `borderRadius: 26`, Whisk design system

---

### TFV2-012A: Stripe Pre-Authorization Helpers & Offer Flow Integration (D-30)

**Files:** `supabase/functions/_shared/stripe/authorization.ts`, `supabase/functions/transactions-create/index.ts`, `supabase/functions/transactions-update/index.ts`, `supabase/functions/check-authorization-expiry/index.ts`, `src/services/paymentMethodService.ts`

#### Stripe Authorization Helpers

- [ ] `preAuthorizePayment()` creates PaymentIntent with `capture_method: 'manual'`
- [ ] Returns `{ success: true, authorizationId, authorizationAmount, expiresAt }` on success
- [ ] Returns `{ success: false, error: { code, message } }` on failure with codes: `NO_PAYMENT_METHOD`, `CARD_DECLINED`, `INSUFFICIENT_FUNDS`, `NO_STRIPE_CUSTOMER`, `STRIPE_API_ERROR`
- [ ] `captureAuthorization()` calls `stripe.paymentIntents.capture()`; returns failure details on non-`succeeded` status
- [ ] `releaseAuthorization()` calls `stripe.paymentIntents.cancel()`; non-fatal (logs error, returns `{ success: false }`)
- [ ] `STRIPE_SECRET_KEY` read from environment — NEVER hardcoded

#### transactions-create Edge Function (D-30)

- [ ] **3-offer limit check**: rejects if buyer has `>= 3` pending trades → 400 with clear message
- [ ] `cashAmountCents` = item price only (NOT including platform fee)
- [ ] `totalAuthorizationCents = cashAmountCents + platformFeeCents` — fee added server-side
- [ ] Calls `preAuthorizePayment()` with `totalAuthorizationCents` before trade INSERT
- [ ] Stores `authorization_id`, `authorization_amount`, `authorization_expires_at` on trade record
- [ ] **Rollback if trade INSERT fails after Stripe auth succeeds**: `releaseAuthorization()` called
- [ ] **Rollback if SP hold fails (fn_reserve_sp_on_offer exception) after Stripe auth succeeds**: `releaseAuthorization()` called
- [ ] Returns `{ trade, authorizationExpiresAt }` on success

#### transactions-update Edge Function

- [ ] Seller **Accept** path: calls `captureAuthorization()` before moving to `payment_processing`
- [ ] If capture fails: trade → `cancelled` (`cancellation_reason = 'payment_failed'`), buyer SP restored
- [ ] Seller **Decline** path: calls `releaseAuthorization()` immediately before status update

#### check-authorization-expiry Edge Function + Cron

- [ ] Finds all `pending` trades with `authorization_expires_at < NOW()`
- [ ] Calls `releaseAuthorization()` for each expired trade
- [ ] Sets trade `status = 'cancelled'`, `cancellation_reason = 'authorization_expired'`
- [ ] Sends buyer push notification: "Your payment method authorization expired"
- [ ] pg_cron scheduled at `0 * * * *` (hourly)

#### Client-Side Helper

- [ ] `hasValidPaymentMethod(userId)` returns `false` if no `stripe_customer_id` or `default_payment_method_id`
- [ ] Calling component shows "Add Payment Method" prompt when this returns false

---

### TFV2-013: Unified Offer Flow

**Files:** `src/screens/trade/TradeOfferScreen.tsx`, `src/screens/trade/TradeInitiationScreen.tsx`, `src/services/tradeServiceV2.ts`

- [ ] `submitOfferV2()` added to `tradeServiceV2.ts`
- [ ] `SubmitOfferInput` interface includes `bundleId?: string` (pass-through for D-27)
- [ ] `cashAmountCents` comment: "item price in cents MINUS any SP discount. Platform fee added server-side."
- [ ] `submitOfferV2()` calls `transactions-create` Edge Function (not direct DB insert)
- [ ] Edge Function error messages surfaced as user-facing toast (INSUFFICIENT_FUNDS, CARD_DECLINED, NO_PAYMENT_METHOD, MAX_OFFERS_REACHED)
- [ ] **Cash path**: `spAmount = 0`, no SP slider shown
- [ ] **SP path**: SP slider shown (0–50% of item price per FR-SP-003), cash amount updates dynamically
- [ ] SP slider maximum: `Math.floor(listing.price × 0.5)` (50% cap)
- [ ] After submission: navigate to `TradeList` submitted offers tab
- [ ] Toast: "Offer submitted! Seller has Nh to respond" using config hours
- [ ] `TradeInitiationScreen` no longer shows Stripe `CardField` for pre-charge
- [ ] DB triggers `fn_set_offer_expires_at` + `fn_reserve_sp_on_offer` fire automatically on INSERT

---

### TFV2-014: Completion Screen — Targeted CTAs

**File:** `src/screens/trade/TradeSuccessScreen.tsx`

- [ ] Large green `CheckCircle` (80px, `#5DBB8E`) celebration icon retained
- [ ] All **7 CTA permutations** implemented:
  - [ ] Free buyer → "Kids Club+ would've saved you $2 on this trade" + [Try Kids Club+ Free — 30 Days]
  - [ ] Subscriber buyer (used SP) → "You saved $X using SP! You have Y SP available." + [Keep Shopping]
  - [ ] Subscriber buyer (no SP) → "Consider using SP on your next purchase" + [Browse Items]
  - [ ] Free seller → "Subscribe to earn Swap Points on your next sale" + [Try Kids Club+ Free — 30 Days]
  - [ ] Subscriber seller (cash_only listing) → "Try 'Accept SP' on your next listing" + [Create New Listing]
  - [ ] Subscriber seller (accept_sp, buyer used SP) → "[X] SP releasing in N days" + [View Wallet]
  - [ ] Subscriber seller (accept_sp, buyer used no SP) → "[X] SP releasing in N days (platform reward)" + [View Wallet]
- [ ] `sp_pending_release_days` from admin config used for release countdown
- [ ] [Rate & Review] non-blocking text link below primary CTA
- [ ] [Done] text link available on all permutations

---

## PHASE 6: BEHAVIORAL + NOTIFICATIONS

---

### TFV2-015: Seller Ignoring Offers Prompt

**Files:** `TradeListScreen.tsx`, `MyListingsScreen.tsx`, migration `20260528000006_reset_unanswered_counter.sql`

- [ ] `consecutive_unanswered_offers_count` increments via TFV2-004 `rpc_process_expired_offers`
- [ ] `fn_reset_unanswered_counter` trigger resets count on seller accept or explicit decline
- [ ] Counter does NOT reset on `cancellation_reason IN ('offer_expired', 'offer_expired_competing')`
- [ ] Modal triggered when `count >= 2` AND `prompt_sent_at IS NULL`
- [ ] `prompt_sent_at` set immediately to prevent re-showing same modal
- [ ] Modal copy matches spec: item title, 3 options
- [ ] [Pause Listing] sets `listings.status = 'paused'`
- [ ] [I'll Respond] and [Dismiss] close modal without action
- [ ] Bottom sheet style: 20px top radius, handle pill
- [ ] Same check runs on `MyListingsScreen` when seller opens their listings

---

### TFV2-016: Push Notification Schedule + Throttling

**Files:** `supabase/functions/send-trade-notifications/index.ts`, `supabase/functions/check-trade-notifications/index.ts`, migrations `20260528000007_notification_log.sql`, `20260528000008_notification_cron.sql`

#### trade_notification_log Table

- [ ] Table created with UNIQUE constraint on `(trade_id, user_id, notification_type)`
- [ ] RLS enabled: service role only
- [ ] `can_send_trade_notification(trade_id, user_id, type, is_payout_related)` RPC exists
- [ ] RPC enforces max **3 non-payout notifications per user per trade**
- [ ] RPC allows payout notifications to bypass the 3-cap
- [ ] RPC returns FALSE if the exact notification type already sent for this trade+user

#### send-trade-notifications Edge Function

- [ ] Deployed and callable
- [ ] Calls `can_send_trade_notification()` before sending — returns `{ sent: false, reason: 'throttled' }` if capped
- [ ] Fetches `push_token` from `profiles` — returns `{ sent: false, reason: 'no_push_token' }` if missing
- [ ] Sends via Expo Push API (or FCM/APNs as configured)
- [ ] Logs sent notification to `trade_notification_log` on success
- [ ] Notification payload includes `trade_id` and target screen + params for deep linking
- [ ] Payout notifications (`is_payout_related: true`) bypass 3-cap

#### check-trade-notifications Edge Function (Fan-out cron checker)

- [ ] Deployed at `supabase/functions/check-trade-notifications/index.ts`
- [ ] **Offer expiry reminders** (→ seller):
  - [ ] `offer_expiry_1` sent at `offer_notif_1_hours_before` before expiry (± 0.1h tolerance)
  - [ ] `offer_expiry_2` sent at `offer_notif_2_hours_before` before expiry (± 0.1h tolerance)
  - [ ] Deep links to `ReviewOfferScreen`
- [ ] **Auto-complete reminders** (→ buyer):
  - [ ] `auto_complete_1` sent at `auto_complete_notif_1_hours_before` before auto-complete
  - [ ] `auto_complete_2` sent at `auto_complete_notif_2_hours_before` before auto-complete
  - [ ] Skips trades with active dispute (`dispute_status != 'none'`)
  - [ ] Deep links to `TradeTimelineScreen`
- [ ] **Payout requires_action repeats** (→ seller):
  - [ ] Notifications 2 and 3 sent at 48h and 96h after `completed_at` (notification 1 sent by `initiate-payout`)
  - [ ] Only sends when `intervalIndex >= 2 && intervalIndex <= 3`
  - [ ] `is_payout_related: true` bypasses 3-cap
  - [ ] Deep links to `PayoutSetup`
- [ ] pg_cron `trade-notifications` scheduled at `*/5 * * * *`

---

## PHASE 7: DISPUTE + PAYOUT + INSTRUMENTATION

---

### TFV2-017: Dispute State Machine + Admin Dashboard Queue

**Files:** `supabase/functions/resolve-dispute/index.ts`, `p2p-kids-admin/src/app/disputes/page.tsx`, `p2p-kids-admin/src/app/disputes/[tradeId]/page.tsx`

#### resolve-dispute Edge Function

- [ ] Requires valid JWT — returns 401 if missing
- [ ] Caller identity verified (admin role check against `admin_users` table or JWT claim)
- [ ] Handles `mark_under_review`: sets `dispute_status = 'under_review'`
- [ ] Handles `resolve_complete`: sets `dispute_status = 'resolved'`, `dispute_resolution = 'completed'`, `status = 'completed'`
  - [ ] Setting `status = 'completed'` fires `fn_release_all_sp_on_complete` automatically (TFV2-003)
- [ ] Handles `resolve_refund`: sets `dispute_status = 'resolved'`, `dispute_resolution = 'refunded'`, `status = 'cancelled'`
  - [ ] Setting `status = 'cancelled'` fires `fn_release_sp_on_cancel` automatically (buyer SP restored)
  - [ ] Calls `stripe.refunds.create({ payment_intent: trade.authorization_id })` for cash refund
  - [ ] Relists item: `listings.status = 'active'` for `trade.listing_id`
  - [ ] Sends `dispute_resolved_refund` notification to buyer
  - [ ] Sends `dispute_resolved_relisted` notification to seller

#### Admin Dispute Queue

- [ ] `/disputes` page shows all trades with `dispute_status IN ('reported', 'under_review')`
- [ ] Columns: Trade ID, Buyer, Seller, Item, Dispute Reason, Reported At (age in hours), Status, Actions
- [ ] Sorted by `dispute_reported_at ASC` (oldest = highest priority)
- [ ] SLA age > 24 hours highlighted in red
- [ ] Filter tabs: All Disputed / Reported / Under Review
- [ ] Row actions: [View], [Mark Under Review]

#### Admin Per-Dispute Page

- [ ] Shows trade summary, dispute details, message history (read-only)
- [ ] [Mark Under Review] button (if `dispute_status = 'reported'`)
- [ ] [Resolve → Complete] button (green)
- [ ] [Resolve → Refund] button (red) — requires confirmation modal before executing
- [ ] Confirmation copy: "This will refund the buyer $[amount] and cancel the trade. This cannot be undone."

---

### TFV2-018: Seller Payout Integration

**Files:** `supabase/functions/initiate-payout/index.ts`, migration `20260528000009_payout_trigger.sql`, `p2p-kids-admin/src/app/payouts/page.tsx`

#### fn_queue_payout_on_complete Trigger

- [ ] Fires AFTER UPDATE when `status → completed`
- [ ] **D-26 GUARD**: Does NOT invoke payout if `dispute_status IN ('reported', 'under_review')`
- [ ] Sets `payout_idempotency_key = 'payout_' || trade_id` (only if NULL)
- [ ] Invokes `initiate-payout` Edge Function via `net.http_post()`

#### initiate-payout Edge Function

- [ ] Verifies `trade.status = 'completed'` — returns 422 if not
- [ ] Blocks if `dispute_status IN ('reported', 'under_review')` — returns 422
- [ ] If seller has no verified payout method:
  - [ ] Sets `payout_status = 'requires_action'`
  - [ ] **Sends `payout_requires_action_1` notification immediately** via `send-trade-notifications`
  - [ ] `is_payout_related: true` on notification
  - [ ] Repeat notifications (2 + 3) handled by `check-trade-notifications` at 48h/96h
- [ ] If seller has verified payout method:
  - [ ] Uses `payout_idempotency_key` for Stripe Transfer (prevents double-payout)
  - [ ] Sets `payout_status = 'processing'`, `payout_initiated_at = NOW()`
- [ ] `payout_status` transitions: `pending → processing → paid` OR `pending → requires_action`

#### Admin Payouts Page

- [ ] `requires_action` filter/column added to existing payouts admin view

---

### TFV2-019: Event Instrumentation — `trade_events` Table

**Migration:** `supabase/migrations/20260528000010_trade_events.sql`

#### Table + Helper

- [ ] `trade_events` table created: `(id, trade_id, event_name, user_id, metadata, created_at)`
- [ ] Indexes: `trade_id`, `event_name`, `created_at DESC`
- [ ] Partial UNIQUE index for idempotency on cron events: `(trade_id, event_name) WHERE event_name IN ('offer_expired', 'auto_completed', 'sp_released_to_seller', 'sp_restored_to_buyer')`
- [ ] RLS enabled: service role full access; admin role SELECT only
- [ ] `log_trade_event(trade_id, event_name, user_id, metadata)` helper function exists
- [ ] Helper uses `ON CONFLICT DO NOTHING` for idempotency
- [ ] Helper wraps body in exception handler — **never breaks the primary operation**

#### Event Wiring — All 16 Events

- [ ] **`offer_submitted`** — logged in `transactions-create` Edge Function after trade INSERT (metadata: `cash_amount_cents`, `sp_amount`, `total_authorization_cents`)
- [ ] **`sp_reserved`** — logged in `fn_reserve_sp_on_offer` trigger (metadata: `sp_amount`)
- [ ] **`offer_accepted`** — logged in `transactions-update` on seller Accept (metadata: `authorization_id`)
- [ ] **`payment_succeeded`** — logged in `transactions-update` on seller Accept alongside `offer_accepted` (metadata: `authorization_id`)
- [ ] **`offer_declined`** — logged in `transactions-update` on seller Decline (metadata: `reason`)
- [ ] **`offer_expired`** — logged in `rpc_process_expired_offers` inside loop per expired trade (metadata: `expired_at`, `offer_timeout_hours`)
- [ ] **`seller_cancelled`** — logged in `cancelTradeV2` / cancel-trade Edge Function (metadata: `reason`)
- [ ] **`buyer_confirmed`** — logged in `complete-trade` Edge Function (metadata: `confirmed_at`)
- [ ] **`auto_completed`** — logged in `rpc_process_auto_complete` inside loop (metadata: `auto_completed_at`)
- [ ] **`sp_released_to_seller`** — logged in `fn_release_all_sp_on_complete` trigger (metadata: `buyer_sp_released`, `platform_sp_granted`, `total_sp_to_seller`, `seller_was_subscriber`, `listing_pref`)
- [ ] **`sp_restored_to_buyer`** — logged in `fn_release_sp_on_cancel` trigger (metadata: `sp_amount`)
- [ ] **`issue_reported`** — logged in `open-dispute` Edge Function (metadata: `reason` only — no `details` to avoid PII)
- [ ] **`dispute_resolved`** — logged in `resolve-dispute` Edge Function (metadata: `resolution`)
- [ ] **`payout_requires_action`** — logged in `initiate-payout` when `requires_action` set (metadata: `{}`)
- [ ] **`payout_initiated`** — logged in `initiate-payout` when Stripe transfer initiated (metadata: `payout_amount_cents`)
- [ ] **`payment_failed`** — logged in `stripe-webhook` Edge Function on `payment_intent.payment_failed` (metadata: `stripe_error_code`)

#### PII Compliance

- [ ] No PII in any `metadata` field: no names, emails, card numbers, or free-text user input

---

## PHASE 8: UX HELPERS + CART

---

### TFV2-020: Safe Meetup V1-Lite Card

**File:** `src/components/trade/SafeMeetupCard.tsx`

- [ ] Card shown on `TradeTimelineScreen` when `trade.status = 'in_progress'` for both buyer and seller
- [ ] Card is dismissible with [Got it ✓] button
- [ ] Dismissed state stored in `AsyncStorage` keyed by `safe_meetup_dismissed_[tradeId]` (per-trade, not global)
- [ ] After dismissal: shows compact `ShieldCheck` icon + "Meeting safely? Tips" link
- [ ] Tapping compact link re-expands the full card
- [ ] Full card shows 4 bullet points with V1 locked copy
- [ ] Card style: `#F0FDF4` background, `#BBF7D0` border, 12px radius
- [ ] Phosphor `ShieldCheck` and `CheckCircle` icons used — NOT Ionicons
- [ ] No external API calls, no map, no location service — static text only
- [ ] Exported from `src/components/trade/index.ts`

---

### TFV2-021: Structured Pickup Helpers — Chat Quick-Replies

**Files:** `src/components/messaging/QuickReplyChips.tsx`, `src/screens/messaging/ChatScreen.tsx`

#### QuickReplyChips Component

- [ ] Exactly 5 chips: "📅 Today", "📅 Tomorrow", "📅 Suggest times", "🎪 Public place", "🕐 Running late"
- [ ] Initially shows 3 chips; [+ More] expands to show all 5
- [ ] Tapping any chip (except Suggest times) sends message directly
- [ ] "Suggest times" chip pre-fills message composer — does NOT auto-send
- [ ] Chips are horizontally scrollable
- [ ] Chips have **NO effect on trade state or `auto_complete_at`**

#### ChatScreen

- [ ] Quick-reply strip shown ONLY when associated trade `status = 'in_progress'`
- [ ] Strip hidden when trade is `completed` or `cancelled`
- [ ] Safety banner (D-19) added: non-dismissible, `#FFF9EC` bg, `#FDE68A` border, text `#92400E`
- [ ] Safety banner text: "SP and buyer protection only apply to in-app trades. Outside deals aren't covered."
- [ ] Pre-first-message safety modal (D-21): shown once per listing, dismissed state in `AsyncStorage` keyed by `pre_message_modal_[listingId]`

---

### TFV2-022: Cart Bundle Checkout

**Files:** migration `20260528000011_cart_tables.sql`, `src/screens/cart/CartScreen.tsx`, `src/screens/cart/CartCheckoutScreen.tsx`, `src/services/cartService.ts`

#### Database

- [ ] `carts` table created: `(id, buyer_id, seller_id, status, created_at, updated_at)` with UNIQUE `(buyer_id, seller_id, status)` where status='active'
- [ ] `cart_items` table created: `(id, cart_id, listing_id, sp_amount, added_at)` with UNIQUE `(cart_id, listing_id)`
- [ ] RLS: buyers can only see their own carts and items

#### Cart Service

- [ ] `addToCart()` adds to existing active cart for same seller if it exists (D-28: single-seller per cart)
- [ ] Counts active carts; if `>= 3`, returns `evictionWarning` object — does NOT silently evict (D-29)
- [ ] `checkoutCart()` creates ONE trade per item via `submitOfferV2()` (D-27: one trade per item)
- [ ] All trades from same checkout stamped with a shared `bundle_id = crypto.randomUUID()`
- [ ] Cart marked `status = 'checked_out'` after successful checkout
- [ ] `evictCart()` sets `status = 'abandoned'` — only callable after user confirms eviction warning modal

#### Mobile Screens

- [ ] `CartScreen` empty state: Phosphor `Package` icon (64px, `#E0E0E0`) + "Start browsing" CTA
- [ ] `CartScreen` shows eviction warning modal naming the oldest cart before proceeding to create a 4th cart (D-29)
- [ ] `CartCheckoutScreen` SP allocation slider functional per Section 11.3.1
- [ ] "Confirm & Pay" is sticky bottom button, green pill, 52px height, `#5DBB8E`
- [ ] `bundle_id` has zero business logic attached (D-27)

---

## CROSS-MODULE INTEGRATION

---

### Integration with MODULE-09 (SP Wallet)

- [ ] `sp_wallets.reserved_sp` column added and correctly used by TFV2-003 triggers
- [ ] `available_sp` decrements on offer submit; restores on cancel; does NOT change on accept
- [ ] `reserved_sp` increments on offer submit; decrements on completion or cancel
- [ ] `pending_sp` increments on trade completion; decrements when SP released to `available_sp`
- [ ] `rpc_release_pending_sp` reads `sp_earned_at_completion` — NOT recalculated from admin config
- [ ] `get_sp_wallet_balance(uuid)` RPC returns correct `available_sp` + `on_hold_sp`
- [ ] SP wallet balances never go negative (GREATEST(0, ...) guards in place)

### Integration with MODULE-11 (Subscriptions)

- [ ] Subscription status checked server-side in `fn_release_all_sp_on_complete` (FR-SP-001)
- [ ] Free users (`subscription_status NOT IN ('trial','active')`) receive 0 platform SP
- [ ] SP slider gated by subscription status on client side (D-08 lock shown for free users)
- [ ] Upgrade modal copy matches spec exactly
- [ ] `TradeTimingConfig.sp_pending_release_days` used for pending SP release period

### Integration with MODULE-14 (Notifications)

- [ ] `trade_notification_log` prevents duplicate sends and enforces 3-notification cap
- [ ] All 7 notification types send correct deep links to correct screens
- [ ] `send-trade-notifications` Edge Function uses `profiles.push_token`
- [ ] Payout notifications bypass global 3-cap (`is_payout_related: true`)
- [ ] Dispute filed and resolved notifications sent immediately from their respective Edge Functions

### Integration with Stripe

- [ ] `STRIPE_SECRET_KEY` set in Supabase Edge Function secrets — never hardcoded
- [ ] PaymentIntents use `capture_method: 'manual'`
- [ ] Authorization holds show as "PENDING" on buyer's card statement
- [ ] `payout_idempotency_key` prevents double-payouts on Stripe Transfers
- [ ] Stripe webhook handler deployed for `payment_intent.payment_failed` event (logs `payment_failed` trade event)

---

## DEPLOYMENT CHECKLIST

### Database Migrations

- [ ] `20260510000001_trade_authorization_updates` applied ✓
- [ ] `20260510000002_sp_hold_enum` applied ✓
- [ ] `20260510000003_offer_timeout_rpc` applied ✓
- [ ] `20260528000001_admin_config_trade_timing` applied
- [ ] `20260528000002_trades_v2_columns` applied
- [ ] `20260528000003_sp_reserve_release_triggers` applied
- [ ] `20260528000004_offer_expiry_cron` applied
- [ ] `20260528000005_auto_complete_cron` applied
- [ ] `20260528000006_reset_unanswered_counter` applied
- [ ] `20260528000007_notification_log` applied
- [ ] `20260528000008_notification_cron` applied
- [ ] `20260528000009_payout_trigger` applied
- [ ] `20260528000010_trade_events` applied
- [ ] `20260528000011_cart_tables` applied

### Edge Functions Deployed

- [ ] `process-expired-offers`
- [ ] `process-auto-complete`
- [ ] `complete-trade`
- [ ] `release-payment` (handles pre-auth release and refunds for cancelTradeV2)
- [ ] `transactions-create` (modified — Stripe pre-auth + 3-offer limit)
- [ ] `transactions-update` (modified — capture/release auth on accept/decline)
- [ ] `check-authorization-expiry`
- [ ] `open-dispute`
- [ ] `send-trade-notifications`
- [ ] `check-trade-notifications`
- [ ] `resolve-dispute`
- [ ] `initiate-payout`
- [ ] `stripe-webhook` (new — handles `payment_intent.payment_failed`)

### pg_cron Jobs Scheduled

- [ ] `check-offer-timeouts` — `0 * * * *` (hourly, Phase 2)
- [ ] `process-expired-offers` — `*/5 * * * *`
- [ ] `process-auto-complete` — `*/5 * * * *`
- [ ] `release-pending-sp` — `0 * * * *`
- [ ] `trade-notifications` (check-trade-notifications) — `*/5 * * * *`
- [ ] `check-authorization-expiry` — `0 * * * *`

### Environment Variables

- [ ] `STRIPE_SECRET_KEY` set in Supabase Edge Function secrets
- [ ] `SUPABASE_SERVICE_ROLE_KEY` available in all Edge Functions
- [ ] `SUPABASE_ANON_KEY` available in user-facing Edge Functions
- [ ] `custom.edge_function_base_url` set in Postgres settings
- [ ] `custom.service_role_key` set in Postgres settings (for pg_cron net.http_post calls)

### Stripe Configuration

- [ ] Stripe webhook endpoint configured for `payment_intent.payment_failed`, `payment_intent.succeeded`
- [ ] Webhook secret configured and validated in `stripe-webhook` Edge Function
- [ ] Stripe Customers created for all buyers with saved payment methods
- [ ] Stripe Connect enabled for seller payouts (if using Connect)

### TypeScript Checks

- [ ] `cd p2p-kids-marketplace && npx tsc --noEmit` → 0 errors
- [ ] `cd p2p-kids-marketplace && npm run lint` → 0 errors
- [ ] `cd p2p-kids-admin && npx tsc --noEmit` → 0 errors
- [ ] No `any` types in trade-related files unless marked with TODO comment

### Icon Audit

- [ ] `grep -r "Ionicons\|MaterialIcons\|react-native-vector-icons" src/screens/trade/` → 0 results
- [ ] `grep -r "Ionicons\|MaterialIcons\|react-native-vector-icons" src/components/trade/` → 0 results
- [ ] All trade-related icons use `phosphor-react-native@3.0.6`

---

## ACCEPTANCE SIGN-OFF

### Engineering Sign-Off

- [ ] All 14 migrations applied to production database
- [ ] All 13 Edge Functions deployed and returning 200 on health checks
- [ ] All 6 pg_cron jobs scheduled and executing without errors
- [ ] TypeScript checks pass (0 errors across both projects)
- [ ] No `any` types without explicit TODO comments in trade service files

### QA Sign-Off

**Happy Path:**
- [ ] E2E: Buyer submits offer → Stripe pre-auth hold appears on card → Seller accepts → Charge captured → Buyer confirms → SP released to seller → Payout initiated
- [ ] E2E: SP path — subscriber buyer applies SP → reserved correctly → trade completes → combined SP (buyer + platform) appears in seller pending wallet after N days
- [ ] E2E: Offer expires → SP restored to buyer → counter increments → seller prompt shown at count 2

**Guard Paths:**
- [ ] Free user taps "Use SP" → Lock icon shown → Upgrade modal opens (NOT SP slider)
- [ ] Buyer has 3 pending offers → 4th offer rejected with correct error message
- [ ] Seller tries to change `payment_preference` with active trade → DB trigger blocks it with descriptive error
- [ ] Buyer tries to file dispute on non-in_progress trade → `open-dispute` returns 422
- [ ] Non-buyer tries to complete trade → `complete-trade` returns 403
- [ ] Notification cron runs twice for same event → second run returns `{ sent: false, reason: 'throttled' }`
- [ ] rpc_release_pending_sp runs twice for same trade → second run is a no-op (sp_released_at guard)

**Dispute Flow:**
- [ ] Buyer files dispute → auto-complete paused → seller [Cancel] hidden → admin queue shows trade
- [ ] Admin resolves Complete → fn_release_all_sp_on_complete fires → seller gets SP → payout triggered
- [ ] Admin resolves Refund → buyer SP restored → Stripe refund issued → listing relisted → both notified

**Cart Flow:**
- [ ] Adding items from same seller creates one cart
- [ ] Adding item from 4th seller → eviction warning modal appears with correct seller name (NOT silent)
- [ ] Cart checkout creates one trade per item, all sharing same `bundle_id`
- [ ] Bundle chip appears on seller's received offers tab

### Product Owner Sign-Off

- [ ] All 16 decisions (D-03 through D-30 + FR-SP-001 + FR-LM-002) verified in production
- [ ] Admin timing config fields load and save correctly with server-side validation
- [ ] Completion screen shows correct CTA for all 7 user/trade permutations
- [ ] Safe Meetup card dismissible per-trade; re-expandable
- [ ] TODO-07: Fee calculation logic unchanged from pre-V2 state

---

## NOTES

- **Phase 2 migrations status**: Files exist on disk but were NOT applied to the database as of May 26, 2026. Must be applied before Phase 3 migrations can proceed.
- **stripe-webhook Edge Function**: Identified in TFV2-019 as a new file required for `payment_failed` event logging. Must be created during implementation.
- **release-payment Edge Function**: Required by `cancelTradeV2()` (TFV2-006). Must determine: cancel pre-auth (pending status) vs issue refund (in_progress status).
- **sp_wallets table name**: Verify actual table name in DB before applying TFV2-002 migration (`sp_wallets` vs `user_sp_wallets` vs `profiles`). Run `SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%wallet%' OR table_name LIKE '%sp%';`
- **Admin auth guard in resolve-dispute**: The TODO comment for admin role verification in `resolve-dispute` Edge Function must be implemented — do NOT ship without proper admin guard.
- **Post-release (deferred)**: Gap #12 (Donate flow), Gap #13 (Off-platform contact detection), Gap #14 (Progressive cancel penalty V1.1) are intentionally deferred per spec decision.
