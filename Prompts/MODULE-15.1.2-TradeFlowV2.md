# MODULE 15.1.2: TRADE FLOW V2 — FULL IMPLEMENTATION

**Total Tasks:** 24  
**Estimated Time:** ~95 hours  
**Supersedes:** `MODULE-15.1.2-UpdatedTradeFlow.md` (Payment Authorization Hold — now integrated)  
**Requirements Source:** `/docx/TRADING-FLOW-V2.md` v2.1 (May 26, 2026) — **Updated May 26, 2026 with D-30 (Payment Authorization Hold)**  
**Dependencies:**
- MODULE-09 (SP Wallet) — SP reserve/release hooks
- MODULE-11 (Subscriptions) — subscription status checks
- MODULE-14 (Notifications) — push delivery service
- Stripe manual-capture PaymentIntents already configured
- Stripe Customer objects with saved payment methods
- `pg_cron` enabled in Supabase
- `net.http_post()` available for RPC → Edge Function calls

---

## Changelog

| Date | Change |
|---|---|
| 2026-05-26 | **UPDATED**: Added D-30 (Payment Authorization Hold) to TRADING-FLOW-V2.md. Added TFV2-012A (Stripe Pre-Authorization Helpers) to implementation tasks. Total tasks now 23. |
| 2026-05-26 | Full V2 rewrite. Supersedes Authorization Hold module. All 22 modules from TRADING-FLOW-V2.md now tracked. |
| 2026-05-10 | Phase 2 DB migrations complete (3 migrations: authorization updates, SP hold enum, offer timeout RPC). |

---

## Implementation Progress

### Phase 1: Documentation ✅ COMPLETE
### Phase 2: Foundational DB Migrations ⏳ PENDING
- `20260510000001_trade_authorization_updates.sql` — added `authorization_id`, `authorization_amount`, `authorization_expires_at` to `trades`
- `20260510000002_sp_hold_enum.sql` — SP enum values `hold`/`hold_release`/`hold_consumed`; `get_sp_wallet_balance(uuid)` RPC
- `20260510000003_offer_timeout_rpc.sql` — `offer_timeout_hours` to `admin_config`; hourly cron `check-offer-timeouts`

### Phase 3: DB Schema V2 Extensions ⏳ PENDING → Tasks TFV2-001 to TFV2-006
### Phase 4: React Native Components ⏳ PENDING → Tasks TFV2-007 to TFV2-008
### Phase 5: Mobile Screens ⏳ PENDING → Tasks TFV2-009 to TFV2-014
### Phase 6: Behavioral + Notifications ⏳ PENDING → Tasks TFV2-015 to TFV2-016
### Phase 7: Dispute + Payout + Instrumentation ⏳ PENDING → Tasks TFV2-017 to TFV2-019
### Phase 8: UX Helpers + Cart ⏳ PENDING → Tasks TFV2-020 to TFV2-022

---

## Module Overview Table

| Task ID | Module # | Name | Phase | Priority | Status |
|---|---|---|---|---|---|
| TFV2-001 | Module 1 | Admin Config — Trade Timing Fields | 3 | Critical | ⏳ |
| TFV2-002 | Module 2 | DB Schema — `offer_expires_at`, `auto_complete_at`, dispute, payout, bundle columns | 3 | Critical | ⏳ |
| TFV2-003 | Module 3 | SP Reserve/Release Triggers | 3 | Critical | ⏳ |
| TFV2-004 | Module 4 | Offer Expiry Cron + Auto-decline Trigger | 3 | Critical | ⏳ |
| TFV2-005 | Module 5 | Auto-Complete Cron | 3 | Critical | ⏳ |
| TFV2-006 | Module 6 | Platform SP Calculation on Completion | 3 | Critical | ⏳ |
| TFV2-007 | Module 7 | `<OfferCountdownPill />` Component | 4 | High | ⏳ |
| TFV2-008 | Module 8 | `<AutoCompleteBanner />` Component | 4 | High | ⏳ |
| TFV2-009 | Module 9 | TradeListScreen — Offers Tab Updates | 5 | High | ⏳ |
| TFV2-010 | Module 10 | ReviewOfferScreen — SP Total + Wallet Projection | 5 | High | ⏳ |
| TFV2-011 | Module 11 | TradeTimelineScreen — Remove Seller Mark, Add I Got It + Report | 5 | Critical | ⏳ |
| TFV2-012 | Module 12 | Item Detail — Request to Buy / Use SP Button Logic | 5 | Critical | ⏳ |
| TFV2-012A | Module 12A | **Stripe Pre-Authorization Helpers & Offer Flow Integration (D-30)** | 5 | **Critical** | ⏳ |
| TFV2-013 | Module 13 | Unified Offer Flow — Remove Buy Now Stripe Pre-charge | 5 | Critical | ⏳ |
| TFV2-014 | Module 14 | Completion Screen — Targeted CTAs by User Type | 5 | High | ⏳ |
| TFV2-015 | Module 15 | Seller Ignoring Offers Prompt | 6 | Medium | ⏳ |
| TFV2-016 | Module 16 | Push Notification Schedule + Throttling | 6 | High | ⏳ |
| TFV2-017 | Module 17 | Dispute State Machine + Admin Dashboard Queue | 7 | High | ⏳ |
| TFV2-018 | Module 18 | Seller Payout Integration | 7 | High | ⏳ |
| TFV2-019 | Module 19 | Event Instrumentation — `trade_events` Table | 7 | High | ⏳ |
| TFV2-020 | Module 20 | Safe Meetup V1-Lite Card | 8 | Medium | ⏳ |
| TFV2-021 | Module 21 | Structured Pickup Helpers — Chat Quick-Replies | 8 | Medium | ⏳ |
| TFV2-022 | Module 22 | Cart Bundle Checkout | 8 | Medium | ⏳ |

---

## Agent-Optimized Prompt Template

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read this entire module file before generating any code.
2. Read /docx/TRADING-FLOW-V2.md in full — it is the authoritative requirements source.
3. For each TASK, produce a 3–6 step plan and list any missing dependencies.
4. Generate files exactly at the `// filepath:` locations specified in each task's prompt block.
5. Reuse helpers from MODULE-09 (SP wallet) and MODULE-11 (subscriptions).
6. Write TypeScript throughout. No `any` types unless absolutely required and marked with TODO.
7. Follow the Whisk design system for all React Native UI:
   - Primary: #5DBB8E (trade flow pill: #5DBB8E), Accent: #FF8C42, SP Gold: #F59E0B
   - Inter font, 8px base grid (sm=8, md=16, lg=24, xl=32)
   - Primary pill buttons: 52px height, borderRadius=26, #5DBB8E background
   - Secondary buttons: 52px height, borderRadius=26, border #5DBB8E, transparent bg
   - Filled inputs: backgroundColor '#F0F0F0', borderRadius 12, no borderWidth, height 52px
   - Text: #1A1A1A primary, #6B6B6B secondary, #999999 tertiary
   - Icons: Phosphor Icons ONLY (phosphor-react-native@3.0.6)
   - Card borderRadius: 12px; touch targets min 44×44px
   - Bottom sheets: 20px top radius, handle pill, slide-up animation
   - Status badges: pill-shaped, 24px height, semantic colors

VERIFICATION STEPS (agent must print results after each task):
- TypeScript: `cd p2p-kids-marketplace && npx tsc --noEmit`
- Lint: `cd p2p-kids-marketplace && npm run lint`
- Admin TypeScript: `cd p2p-kids-admin && npx tsc --noEmit`

ERROR HANDLING RULES:
- For missing SP/subscription helpers, stub the function and mark TODO.
- For Stripe calls, use environment variables only — NEVER hardcode secrets.
- For schema mismatches, add a new numbered migration under supabase/migrations/.
- If a trigger/function already exists from Phase 2 migrations, check before recreating.

V2 CRITICAL REQUIREMENTS (verify before shipping each task):
- D-03: Buyer-only completion ("I Got It") — NO seller mark step anywhere in UI or logic.
- D-07: Button label is "Request to Buy" (NOT "Pay Cash") for cash offers.
- D-08: "Use SP" is VISIBLE but LOCKED (🔒) for free users → upgrade modal on tap.
- D-10/D-17: SP soft-reserve at offer; single release event at completion (buyer reserved SP + platform SP → all to seller pending_sp in ONE operation).
- D-26: Disputes = overlay columns on trades table, NOT new top-level state machine states.
- D-27: Cart = one trade per item; bundle_id is UX-only grouping with NO business logic attached.
- D-29: Saved cart eviction requires an explicit warning modal (NOT silent LRU).
- **D-30 🔴 CRITICAL**: Payment authorization hold (Stripe pre-auth + SP hold) REQUIRED at offer submission. Both must succeed atomically or entire offer fails. Max 3 pending offers per buyer. Buyer must have valid payment method on file.
- TODO-07 🔴 Fee structure is BLOCKED — do NOT change fee calculation logic in any task.
- Notification global cap: max 3 push notifications per user per trade (non-payout-related).
```

---

## LOCKED DECISIONS REFERENCE

| Decision | Rule | Applies To |
|---|---|---|
| D-03 | Buyer-only completion — no seller mark step | TFV2-011, TFV2-005 |
| D-07 | Button = "Request to Buy", NOT "Pay Cash" | TFV2-012, TFV2-013 |
| D-08 | "Use SP 🔒" visible-but-locked for free users | TFV2-012 |
| D-09 | Seller offer inbox sorted by total value DESC | TFV2-009 |
| D-10 | SP soft-reserve at offer submission | TFV2-003 |
| D-11 | Show combined SP total to seller, no source breakdown | TFV2-010 |
| D-17 | Single SP release event at completion | TFV2-006, TFV2-003 |
| D-25 | "Request to Buy" on Item Detail AND TradeInitiationScreen | TFV2-012, TFV2-013 |
| D-26 | Disputes = overlay columns, not state machine states | TFV2-017, TFV2-005 |
| D-27 | bundle_id = UX grouping only — zero business logic | TFV2-022 |
| D-28 | Cart is single-seller per active cart | TFV2-022 |
| D-29 | Explicit eviction warning modal for 4th cart | TFV2-022 |
| **D-30** | **Payment authorization hold required at offer submission** — Stripe pre-auth + SP hold atomic | **TFV2-012A, TFV2-013** |
| TODO-07 | Fee structure BLOCKED — do not change fee logic | ALL |

---

## PHASE 3: DATABASE + BACKEND

---

## TASK TFV2-001: Admin Config — Trade Timing Fields

**Duration:** 1.5 hours  
**Priority:** Critical  
**Dependencies:** Existing `admin_config` table, Phase 2 migration added `offer_timeout_hours`

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260528000001_admin_config_trade_timing.sql` | CREATE | Add 6 new timing + notification config fields |
| `p2p-kids-admin/src/app/settings/page.tsx` | MODIFY | Add "Trade Timing Settings" section with all 7 config fields |
| `p2p-kids-admin/src/lib/admin-config.ts` | MODIFY | Add TypeScript types for new config keys |

### Description

Add the 7 trade timing config fields to `admin_config` (Section 9.2 of TRADING-FLOW-V2.md). Note: `offer_timeout_hours` (Phase 2) maps to `offer_expiry_hours`. Add the remaining 6 fields. Update admin UI with the exact spec from Section 9.3. Server-side validation from Section 9.4 must be enforced at the DB level via CHECK constraints.

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000001_admin_config_trade_timing.sql

-- Add trade timing configuration fields to admin_config
-- offer_timeout_hours was added in Phase 2 migration; we add the remaining 6 fields.
-- Server-side minimums enforced via CHECK constraints per Section 9.4.

ALTER TABLE admin_config
  ADD COLUMN IF NOT EXISTS auto_complete_hours INTEGER NOT NULL DEFAULT 48
    CHECK (auto_complete_hours >= 1),
  ADD COLUMN IF NOT EXISTS sp_pending_release_days INTEGER NOT NULL DEFAULT 3
    CHECK (sp_pending_release_days >= 1),
  ADD COLUMN IF NOT EXISTS offer_notif_1_hours_before INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS offer_notif_2_hours_before INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS auto_complete_notif_1_hours_before INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS auto_complete_notif_2_hours_before INTEGER NOT NULL DEFAULT 2;

-- Cross-field validation via a trigger (CHECK constraints can't reference other columns)
CREATE OR REPLACE FUNCTION validate_trade_timing_config()
RETURNS TRIGGER AS $$
BEGIN
  -- offer_notif_1 must be <= offer_expiry (offer_timeout_hours from Phase 2)
  IF NEW.offer_notif_1_hours_before > NEW.offer_timeout_hours THEN
    RAISE EXCEPTION 'offer_notif_1_hours_before must be <= offer_timeout_hours';
  END IF;
  -- offer_notif_2 must be < offer_notif_1
  IF NEW.offer_notif_2_hours_before >= NEW.offer_notif_1_hours_before THEN
    RAISE EXCEPTION 'offer_notif_2_hours_before must be < offer_notif_1_hours_before';
  END IF;
  -- auto_complete_notif_1 must be <= auto_complete_hours
  IF NEW.auto_complete_notif_1_hours_before > NEW.auto_complete_hours THEN
    RAISE EXCEPTION 'auto_complete_notif_1_hours_before must be <= auto_complete_hours';
  END IF;
  -- auto_complete_notif_2 must be < auto_complete_notif_1
  IF NEW.auto_complete_notif_2_hours_before >= NEW.auto_complete_notif_1_hours_before THEN
    RAISE EXCEPTION 'auto_complete_notif_2_hours_before must be < auto_complete_notif_1_hours_before';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_trade_timing_config ON admin_config;
CREATE TRIGGER trg_validate_trade_timing_config
  BEFORE INSERT OR UPDATE ON admin_config
  FOR EACH ROW EXECUTE FUNCTION validate_trade_timing_config();

COMMENT ON COLUMN admin_config.auto_complete_hours IS 'Hours after payment before trade auto-completes if buyer does not confirm. Min 1.';
COMMENT ON COLUMN admin_config.sp_pending_release_days IS 'Days after trade completion before seller pending SP becomes available. Min 1.';
COMMENT ON COLUMN admin_config.offer_notif_1_hours_before IS 'Hours before offer expiry to send first reminder to seller.';
COMMENT ON COLUMN admin_config.offer_notif_2_hours_before IS 'Hours before offer expiry to send final reminder to seller.';
COMMENT ON COLUMN admin_config.auto_complete_notif_1_hours_before IS 'Hours before auto-complete to send first reminder to buyer.';
COMMENT ON COLUMN admin_config.auto_complete_notif_2_hours_before IS 'Hours before auto-complete to send final reminder to buyer.';
```

```typescript
// filepath: p2p-kids-admin/src/lib/admin-config.ts
// ADD to the existing AdminConfig interface:

export interface TradeTimingConfig {
  offer_timeout_hours: number;         // Phase 2 field (alias: offer_expiry_hours)
  auto_complete_hours: number;
  sp_pending_release_days: number;
  offer_notif_1_hours_before: number;
  offer_notif_2_hours_before: number;
  auto_complete_notif_1_hours_before: number;
  auto_complete_notif_2_hours_before: number;
}

// Merge into the main AdminConfig type (extend existing interface — do not replace)
// export interface AdminConfig extends ... TradeTimingConfig { ... }
```

```typescript
// filepath: p2p-kids-admin/src/app/settings/page.tsx
// ADD this section below the existing config fields in the settings form.
// Follow the existing input field pattern in this file.

// Trade Timing Settings section:
// ─────────────────────────────────
// Section heading: "Trade Timing Settings"
// Fields (each uses the existing <ConfigInput /> or equivalent component):
//
//   label="Offer Expiry Duration"
//   name="offer_timeout_hours"
//   type="number"
//   description="How long a buyer's offer stays open for seller review. Default: 24 hours."
//   unit="hours"
//
//   label="Auto-Complete Duration"
//   name="auto_complete_hours"
//   type="number"
//   description="If buyer doesn't confirm receipt, trade auto-completes after this duration. Default: 48 hours."
//   unit="hours"
//
//   label="SP Pending Release Period"
//   name="sp_pending_release_days"
//   type="number"
//   description="Days after trade completion before seller's Swap Points become spendable. Default: 3 days."
//   unit="days"
//
// Sub-section heading: "Notification Schedule"
//
//   label="Offer Expiry — First Reminder"
//   name="offer_notif_1_hours_before"
//   type="number"
//   description="Send to seller N hours before offer expires."
//   unit="hours before expiry"
//
//   label="Offer Expiry — Final Reminder"
//   name="offer_notif_2_hours_before"
//   type="number"
//   description="Send to seller N hours before offer expires (must be < first reminder)."
//   unit="hours before expiry"
//
//   label="Auto-Complete — First Reminder"
//   name="auto_complete_notif_1_hours_before"
//   type="number"
//   description="Send to buyer N hours before auto-complete fires."
//   unit="hours before auto-complete"
//
//   label="Auto-Complete — Final Reminder"
//   name="auto_complete_notif_2_hours_before"
//   type="number"
//   description="Send to buyer N hours before auto-complete fires (must be < first reminder)."
//   unit="hours before auto-complete"
//
// IMPORTANT: Do NOT add HTML min/max attributes. Validation is server-side only per Section 9.4.
// Surface DB validation errors inline when save fails.
//
// Show server validation errors inline if the cross-field checks fail.
// Surface the DB error message (e.g. "offer_notif_1_hours_before must be <= offer_timeout_hours").
```

### ACCEPTANCE CRITERIA

- [ ] `auto_complete_hours`, `sp_pending_release_days`, and 4 notification timing fields added to `admin_config`
- [ ] DB trigger rejects invalid cross-field combos with a descriptive error
- [ ] Admin settings page shows "Trade Timing Settings" section with all 7 fields
- [ ] All inputs have correct labels, descriptions, and units per Section 9.3
- [ ] **No `min` or `max` attributes on any input** — validation is server-side only (Section 9.4)
- [ ] Saving with invalid cross-field values shows inline error surfaced from DB exception message
- [ ] TypeScript type `TradeTimingConfig` covers all 7 fields

**NEXT TASK: TFV2-002**

---

## TASK TFV2-002: DB Schema — V2 Columns on `trades` Table

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** TFV2-001 (for config values used in trigger), Phase 2 migrations

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260528000002_trades_v2_columns.sql` | CREATE | Add offer_expires_at, auto_complete_at, bundle_id, dispute overlay columns, payout columns to trades |
| `src/types/trade.ts` | MODIFY | Add all new fields to Trade TypeScript type |

### Description

Add all V2 columns to `trades` per Section 13 of TRADING-FLOW-V2.md. Three groups:
1. Timing columns: `offer_expires_at`, `auto_complete_at`
2. Dispute overlay (Decision D-26): `dispute_status`, `dispute_resolution`, `dispute_reported_at`, `dispute_reason`, `dispute_resolved_at`, `dispute_resolved_by`
3. Payout tracking (Section 6.3): `payout_status`, `payout_idempotency_key`, `payout_initiated_at`, `payout_paid_at`
4. Bundle grouping (Decision D-27): `bundle_id UUID` with partial index

Also add `reserved_sp` to the SP wallet table (`sp_wallets` — verify table name before running).
Also add `consecutive_unanswered_offers_count` per `(seller_id, listing_id)` — add to a separate `listing_offer_stats` table.

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000002_trades_v2_columns.sql

-- ============================================================
-- SECTION 1: Timing columns on trades
-- ============================================================
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_complete_at TIMESTAMPTZ;

-- Backfill existing pending trades
UPDATE trades
SET offer_expires_at = created_at + INTERVAL '24 hours'
WHERE offer_expires_at IS NULL AND status = 'pending';

-- Backfill existing in_progress trades
UPDATE trades
SET auto_complete_at = updated_at + INTERVAL '48 hours'
WHERE auto_complete_at IS NULL AND status = 'in_progress';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_trades_offer_expires_at
  ON trades(offer_expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_trades_auto_complete_at
  ON trades(auto_complete_at)
  WHERE status = 'in_progress';

-- ============================================================
-- SECTION 1.5: SP snapshot + release tracking columns
-- sp_earned_at_completion: snapshotted at trade completion by fn_release_all_sp_on_complete
--   to prevent config drift — if admin_config.sp_category_multiplier changes after the
--   trade completes, rpc_release_pending_sp still releases the originally-earned amount.
-- sp_released_at: set by rpc_release_pending_sp to prevent double-release.
-- ============================================================
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS sp_earned_at_completion INTEGER,
  ADD COLUMN IF NOT EXISTS sp_released_at TIMESTAMPTZ;

COMMENT ON COLUMN trades.sp_earned_at_completion IS
  'Total SP granted to seller at trade completion (buyer SP + platform SP). Snapshotted at completion by fn_release_all_sp_on_complete to prevent recalculation drift if admin_config changes after completion.';

-- ============================================================
-- SECTION 2: Dispute overlay columns (Decision D-26)
-- NOT new top-level states — overlay on existing state machine
-- ============================================================
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS dispute_status TEXT NOT NULL DEFAULT 'none'
    CHECK (dispute_status IN ('none', 'reported', 'under_review', 'resolved')),
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT
    CHECK (dispute_resolution IN ('completed', 'refunded') OR dispute_resolution IS NULL),
  ADD COLUMN IF NOT EXISTS dispute_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_resolved_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_trades_dispute_status
  ON trades(dispute_status)
  WHERE dispute_status IN ('reported', 'under_review');

-- ============================================================
-- SECTION 3: Payout tracking columns (Section 6.3)
-- ============================================================
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'requires_action', 'processing', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS payout_idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS payout_initiated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_paid_at TIMESTAMPTZ;

-- Set idempotency key for existing completed trades
UPDATE trades
SET payout_idempotency_key = 'payout_' || id::text
WHERE status = 'completed' AND payout_idempotency_key IS NULL;

-- ============================================================
-- SECTION 4: Bundle grouping column (Decision D-27)
-- UX ONLY — zero business logic references bundle_id
-- ============================================================
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS bundle_id UUID;

-- Partial index — only trades that are part of a bundle
CREATE INDEX IF NOT EXISTS idx_trades_bundle_id
  ON trades(bundle_id)
  WHERE bundle_id IS NOT NULL;

-- ============================================================
-- SECTION 5: SP reserved_sp column on sp_wallets
-- Verify the actual table name: may be sp_wallets, user_sp_wallets, or profiles
-- Run: SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%wallet%' OR table_name LIKE '%sp%';
-- Then replace 'sp_wallets' below with the actual table name.
-- ============================================================

-- NOTE: Replace 'sp_wallets' with the correct table name found above.
ALTER TABLE sp_wallets
  ADD COLUMN IF NOT EXISTS reserved_sp INTEGER NOT NULL DEFAULT 0
    CHECK (reserved_sp >= 0);

-- ============================================================
-- SECTION 6: Seller offer stats for ignoring-offers logic (Module 15)
-- Track consecutive unanswered offers per (seller_id, listing_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS listing_offer_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  consecutive_unanswered_offers_count INTEGER NOT NULL DEFAULT 0,
  prompt_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seller_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_offer_stats_seller_listing
  ON listing_offer_stats(seller_id, listing_id);

-- Row Level Security
ALTER TABLE listing_offer_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON listing_offer_stats
  USING (auth.role() = 'service_role');

-- ============================================================
-- SECTION 7: User-level cancellation counter (Module 15 / Section 11.7)
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS post_acceptance_cancellation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_review_flagged_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.post_acceptance_cancellation_count IS
  'Counts post-Stripe-charge cancellations only. Pre-acceptance declines do NOT increment.';

-- ============================================================
-- SECTION 8: Payment preference lock trigger (FR-LM-002)
-- Prevents seller from changing payment_preference on a listing once a buyer
-- has submitted an offer. Enforced server-side per spec Section 4.2.
-- The UI should also disable the field, but this trigger is the authoritative guard.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_lock_payment_preference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_preference IS DISTINCT FROM OLD.payment_preference THEN
    IF EXISTS (
      SELECT 1 FROM trades
      WHERE listing_id = NEW.id
        AND status IN ('pending', 'payment_processing', 'in_progress')
    ) THEN
      RAISE EXCEPTION 'Cannot change payment_preference: listing has active trades (FR-LM-002). Cancel or complete existing trades first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_payment_preference ON listings;
CREATE TRIGGER trg_lock_payment_preference
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION fn_lock_payment_preference();

COMMENT ON FUNCTION fn_lock_payment_preference IS
  'FR-LM-002: Prevents changing payment_preference after any buyer has an active offer on the listing. Guards both direct DB writes and admin panel edits.';
```

```typescript
// filepath: src/types/trade.ts
// EXTEND the existing Trade interface — add all V2 fields.
// Do NOT replace existing fields.

export type DisputeStatus = 'none' | 'reported' | 'under_review' | 'resolved';
export type DisputeResolution = 'completed' | 'refunded' | null;
export type PayoutStatus = 'pending' | 'requires_action' | 'processing' | 'paid' | 'failed';

// ADD these fields to the existing Trade interface:
// offer_expires_at: string | null;
// auto_complete_at: string | null;
// dispute_status: DisputeStatus;
// dispute_resolution: DisputeResolution;
// dispute_reported_at: string | null;
// dispute_reason: string | null;
// dispute_resolved_at: string | null;
// dispute_resolved_by: string | null;
// payout_status: PayoutStatus;
// payout_idempotency_key: string | null;
// payout_initiated_at: string | null;
// payout_paid_at: string | null;
// bundle_id: string | null;
// sp_earned_at_completion: number | null;  // snapshotted SP at completion; null = 0 SP trade
```

### ACCEPTANCE CRITERIA

- [ ] `offer_expires_at` and `auto_complete_at` columns added with indexes
- [ ] Existing `pending` trades backfilled with `offer_expires_at`
- [ ] Existing `in_progress` trades backfilled with `auto_complete_at`
- [ ] All 6 dispute overlay columns added with correct CHECK constraints
- [ ] `dispute_status` index covers `reported` and `under_review` values
- [ ] `payout_status`, `payout_idempotency_key`, `payout_initiated_at`, `payout_paid_at` added
- [ ] `payout_idempotency_key` has UNIQUE constraint
- [ ] `bundle_id` added with partial index
- [ ] **`sp_earned_at_completion INTEGER` added to `trades` with COMMENT** (Section 1.5)
- [ ] **`sp_released_at TIMESTAMPTZ` added to `trades`** (used by rpc_release_pending_sp in TFV2-005)
- [ ] `reserved_sp` column added to SP wallet table with `CHECK >= 0`
- [ ] `listing_offer_stats` table created with RLS (service role only)
- [ ] `post_acceptance_cancellation_count` and `admin_review_flagged_at` added to `profiles`
- [ ] **`fn_lock_payment_preference` trigger created on `listings`** (FR-LM-002)
- [ ] **Payment preference lock trigger rejects change when `status IN ('pending', 'payment_processing', 'in_progress')`**
- [ ] TypeScript types `DisputeStatus`, `DisputeResolution`, `PayoutStatus` exported
- [ ] Trade TypeScript interface includes all new fields including `sp_earned_at_completion`

**NEXT TASK: TFV2-003**

---

## TASK TFV2-003: SP Reserve/Release DB Triggers

**Duration:** 2.5 hours  
**Priority:** Critical  
**Dependencies:** TFV2-002 (`reserved_sp` column), TFV2-001 (`sp_pending_release_days` config)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260528000003_sp_reserve_release_triggers.sql` | CREATE | 5 SP state-transition triggers per Section 13.4 |

### Description

Implement the 5 SP-related triggers from Section 13.4 of TRADING-FLOW-V2.md:
1. `fn_reserve_sp_on_offer` — AFTER INSERT, moves `sp_amount` from `available_sp` to `reserved_sp` in buyer wallet
2. `fn_transfer_sp_on_accept` — AFTER UPDATE status→payment_processing — **no-op for SP** per D-17 (buyer SP stays in reserved_sp until completion)
3. `fn_release_sp_on_cancel` — AFTER UPDATE status→cancelled — restore `reserved_sp` → `available_sp`
4. `fn_release_all_sp_on_complete` — AFTER UPDATE status→completed — D-17 single SP release event: buyer `reserved_sp` + platform SP (25% × price × category_multiplier) → all added to seller `pending_sp` in ONE atomic operation
5. Also: `fn_set_offer_expires_at` — BEFORE INSERT — reads `offer_timeout_hours` from `admin_config` and sets `offer_expires_at`

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000003_sp_reserve_release_triggers.sql

-- ============================================================
-- TRIGGER 1: Set offer_expires_at on new trade INSERT
-- Reads offer_timeout_hours from admin_config
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_offer_expires_at()
RETURNS TRIGGER AS $$
DECLARE
  v_expiry_hours INTEGER;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT COALESCE(offer_timeout_hours, 24)
    INTO v_expiry_hours
    FROM admin_config
    LIMIT 1;
    NEW.offer_expires_at := NOW() + (v_expiry_hours * INTERVAL '1 hour');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_offer_expires_at ON trades;
CREATE TRIGGER trg_set_offer_expires_at
  BEFORE INSERT ON trades
  FOR EACH ROW EXECUTE FUNCTION fn_set_offer_expires_at();

-- ============================================================
-- TRIGGER 2: Reserve SP when offer is submitted (D-10)
-- AFTER INSERT on trades where sp_amount > 0
-- Moves sp_amount from available_sp to reserved_sp in buyer wallet
-- ============================================================
CREATE OR REPLACE FUNCTION fn_reserve_sp_on_offer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.points_amount > 0 THEN
    -- Verify buyer has sufficient available SP
    IF (SELECT available_sp FROM sp_wallets WHERE user_id = NEW.buyer_id) < NEW.points_amount THEN
      RAISE EXCEPTION 'Insufficient available SP for offer. Requested: %, Available: %',
        NEW.points_amount,
        (SELECT available_sp FROM sp_wallets WHERE user_id = NEW.buyer_id);
    END IF;

    -- Atomic deduct from available, add to reserved
    UPDATE sp_wallets
    SET
      available_sp = available_sp - NEW.points_amount,
      reserved_sp  = reserved_sp  + NEW.points_amount,
      updated_at   = NOW()
    WHERE user_id = NEW.buyer_id;

    -- Log event for Module 19 instrumentation (insert into trade_events if table exists)
    -- This will be wired up fully in TFV2-019
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reserve_sp_on_offer ON trades;
CREATE TRIGGER trg_reserve_sp_on_offer
  AFTER INSERT ON trades
  FOR EACH ROW EXECUTE FUNCTION fn_reserve_sp_on_offer();

-- ============================================================
-- TRIGGER 3: fn_transfer_sp_on_accept — NO-OP for SP (D-17)
-- Seller accepts → payment_processing; buyer SP stays in reserved_sp
-- Trigger retained as hook for future use (e.g. logging)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_transfer_sp_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  -- Per Decision D-17: buyer SP remains in reserved_sp until trade completes.
  -- No SP movement at acceptance stage. This trigger is intentionally a no-op for SP.
  -- Reserved for future instrumentation or hooks.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_transfer_sp_on_accept ON trades;
CREATE TRIGGER trg_transfer_sp_on_accept
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'payment_processing')
  EXECUTE FUNCTION fn_transfer_sp_on_accept();

-- ============================================================
-- TRIGGER 4: Restore SP on cancellation (any stage before complete)
-- AFTER UPDATE status → cancelled
-- ============================================================
CREATE OR REPLACE FUNCTION fn_release_sp_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.points_amount > 0 THEN
    UPDATE sp_wallets
    SET
      reserved_sp  = GREATEST(0, reserved_sp - NEW.points_amount),
      available_sp = available_sp + NEW.points_amount,
      updated_at   = NOW()
    WHERE user_id = NEW.buyer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_release_sp_on_cancel ON trades;
CREATE TRIGGER trg_release_sp_on_cancel
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled')
  EXECUTE FUNCTION fn_release_sp_on_cancel();

-- ============================================================
-- TRIGGER 5: Single SP release event on completion (Decision D-17)
-- AFTER UPDATE status → completed
-- Step 1: Guard — platform SP only earned when seller is subscriber AND listing is accept_sp (FR-SP-001)
-- Step 2: Snapshot earned SP onto trades.sp_earned_at_completion (prevents config drift)
-- Step 3: Deduct buyer reserved_sp
-- Step 4: Add combined total to seller pending_sp in ONE atomic operation
-- ============================================================
CREATE OR REPLACE FUNCTION fn_release_all_sp_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_platform_sp          INTEGER;
  v_total_sp             INTEGER;
  v_item_price           NUMERIC;
  v_category_mult        NUMERIC;
  v_seller_is_subscriber BOOLEAN;
  v_listing_pref         TEXT;
BEGIN
  -- Fetch item price, listing payment preference, category multiplier, seller subscription
  SELECT
    l.price,
    l.payment_preference,
    COALESCE(ac.sp_category_multiplier, 1.0),
    p.subscription_status IN ('trial', 'active')
  INTO v_item_price, v_listing_pref, v_category_mult, v_seller_is_subscriber
  FROM listings l
  LEFT JOIN admin_config ac ON TRUE
  JOIN profiles p ON p.id = NEW.seller_id
  WHERE l.id = NEW.listing_id
  LIMIT 1;

  -- Guard (FR-SP-001): Platform SP only earned when seller is subscriber AND listing is 'accept_sp'.
  -- Free sellers and 'cash_only' listings earn zero platform SP.
  IF v_seller_is_subscriber AND v_listing_pref = 'accept_sp' THEN
    v_platform_sp := ROUND(v_item_price * 0.25 * v_category_mult);
  ELSE
    v_platform_sp := 0;
  END IF;

  -- Total SP to seller = buyer SP used in offer + platform SP earned
  v_total_sp := COALESCE(NEW.points_amount, 0) + v_platform_sp;

  -- Snapshot earned SP on trade record to prevent recalculation drift
  -- rpc_release_pending_sp reads sp_earned_at_completion instead of recalculating
  UPDATE trades
  SET sp_earned_at_completion = v_total_sp
  WHERE id = NEW.id;

  -- Step 1: Deduct from buyer reserved_sp (if buyer used SP)
  IF NEW.points_amount > 0 THEN
    UPDATE sp_wallets
    SET
      reserved_sp = GREATEST(0, reserved_sp - NEW.points_amount),
      updated_at  = NOW()
    WHERE user_id = NEW.buyer_id;
  END IF;

  -- Step 2: Add combined total to seller pending_sp (single event per D-17)
  IF v_total_sp > 0 THEN
    UPDATE sp_wallets
    SET
      pending_sp = pending_sp + v_total_sp,
      updated_at = NOW()
    WHERE user_id = NEW.seller_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_release_all_sp_on_complete ON trades;
CREATE TRIGGER trg_release_all_sp_on_complete
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION fn_release_all_sp_on_complete();
```

### ACCEPTANCE CRITERIA

- [ ] `fn_set_offer_expires_at` sets `offer_expires_at` on every new trade INSERT with status=pending
- [ ] `fn_reserve_sp_on_offer` atomically moves buyer `available_sp` → `reserved_sp` on offer submission
- [ ] `fn_reserve_sp_on_offer` raises an exception if buyer has insufficient SP (does not allow negative)
- [ ] `fn_transfer_sp_on_accept` fires on `payment_processing` transition but is a no-op (SP stays reserved)
- [ ] `fn_release_sp_on_cancel` restores buyer SP from `reserved_sp` → `available_sp` on any cancellation
- [ ] `fn_release_all_sp_on_complete` fires on completion and executes the single SP release event (D-17)
- [ ] **Platform SP is only granted when `seller.subscription_status IN ('trial', 'active')` AND `listing.payment_preference = 'accept_sp'` (FR-SP-001)**
- [ ] **Free seller or `cash_only` listing → `v_platform_sp = 0`; buyer SP portion still transferred normally**
- [ ] Platform SP calculated as `ROUND(price × 0.25 × category_multiplier)` when eligible
- [ ] **`sp_earned_at_completion` snapshotted on trade record before SP wallet updates**
- [ ] Combined total (buyer SP + platform SP) is added to seller `pending_sp` in ONE UPDATE statement
- [ ] No SP is transferred to seller at acceptance stage — only at completion
- [ ] All functions use `SECURITY DEFINER` for service-role execution

**NEXT TASK: TFV2-004**

---

## TASK TFV2-004: Offer Expiry Cron + Auto-decline Trigger

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** TFV2-002 (`offer_expires_at`), TFV2-003 (SP restore trigger)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260528000004_offer_expiry_cron.sql` | CREATE | `process_expired_offers` cron + `fn_auto_decline_competing` trigger |
| `supabase/functions/process-expired-offers/index.ts` | CREATE | Edge Function invoked by cron |

### Description

Implement two pieces:
1. `fn_auto_decline_competing` DB trigger: when a trade moves to `payment_processing` (seller accepts), all other `pending` trades on the same listing are auto-cancelled with reason `'offer_expired_competing'`. Their SP is restored by the existing `fn_release_sp_on_cancel` trigger.
2. `process_expired_offers` cron (every 5 min): cancels `pending` trades where `offer_expires_at < NOW()` with reason `'offer_expired'`. Increments `consecutive_unanswered_offers_count` in `listing_offer_stats`.

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000004_offer_expiry_cron.sql

-- ============================================================
-- TRIGGER: Auto-decline competing offers when seller accepts one
-- AFTER UPDATE status → payment_processing
-- Sets all other pending trades on same listing_id to cancelled
-- fn_release_sp_on_cancel handles SP restore automatically
-- ============================================================
CREATE OR REPLACE FUNCTION fn_auto_decline_competing()
RETURNS TRIGGER AS $$
BEGIN
  -- Cancel all other pending trades for this listing
  UPDATE trades
  SET
    status             = 'cancelled',
    cancellation_reason = 'offer_expired_competing',
    updated_at         = NOW()
  WHERE
    listing_id = NEW.listing_id
    AND id <> NEW.id
    AND status = 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_decline_competing ON trades;
CREATE TRIGGER trg_auto_decline_competing
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'payment_processing')
  EXECUTE FUNCTION fn_auto_decline_competing();

-- ============================================================
-- TRIGGER: Set auto_complete_at when trade enters in_progress
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_auto_complete_at()
RETURNS TRIGGER AS $$
DECLARE
  v_hours INTEGER;
BEGIN
  SELECT COALESCE(auto_complete_hours, 48)
  INTO v_hours
  FROM admin_config LIMIT 1;

  NEW.auto_complete_at := NOW() + (v_hours * INTERVAL '1 hour');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_auto_complete_at ON trades;
CREATE TRIGGER trg_set_auto_complete_at
  BEFORE UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'in_progress')
  EXECUTE FUNCTION fn_set_auto_complete_at();

-- ============================================================
-- RPC: Invoked by the process-expired-offers Edge Function
-- Cancels expired pending trades, increments unanswered counter
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_process_expired_offers()
RETURNS JSONB AS $$
DECLARE
  v_expired_ids UUID[];
  v_count INTEGER;
BEGIN
  -- Collect expired pending offer IDs
  SELECT ARRAY_AGG(id)
  INTO v_expired_ids
  FROM trades
  WHERE status = 'pending'
    AND offer_expires_at IS NOT NULL
    AND offer_expires_at < NOW();

  IF v_expired_ids IS NULL THEN
    RETURN jsonb_build_object('expired_count', 0);
  END IF;

  -- Cancel expired trades (fn_release_sp_on_cancel fires automatically)
  UPDATE trades
  SET
    status              = 'cancelled',
    cancellation_reason = 'offer_expired',
    updated_at          = NOW()
  WHERE id = ANY(v_expired_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Increment consecutive_unanswered_offers_count per (seller_id, listing_id)
  INSERT INTO listing_offer_stats (seller_id, listing_id, consecutive_unanswered_offers_count)
  SELECT DISTINCT t.seller_id, t.listing_id, 1
  FROM trades t
  WHERE t.id = ANY(v_expired_ids)
  ON CONFLICT (seller_id, listing_id) DO UPDATE
    SET
      consecutive_unanswered_offers_count =
        listing_offer_stats.consecutive_unanswered_offers_count + 1,
      updated_at = NOW();

  RETURN jsonb_build_object('expired_count', v_count, 'trade_ids', v_expired_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CRON: process_expired_offers — every 5 minutes
-- Calls the Edge Function (follows existing pg_cron + net.http_post pattern)
-- ============================================================
SELECT cron.schedule(
  'process-expired-offers',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_function_base_url') || '/process-expired-offers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

```typescript
// filepath: supabase/functions/process-expired-offers/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('rpc_process_expired_offers');

  if (error) {
    console.error('[process-expired-offers] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('[process-expired-offers] Result:', data);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### ACCEPTANCE CRITERIA

- [ ] `fn_auto_decline_competing` cancels all other pending trades on same listing when one is accepted
- [ ] Auto-declined trades have `cancellation_reason = 'offer_expired_competing'`
- [ ] `fn_release_sp_on_cancel` fires automatically for auto-declined trades (SP restored for affected buyers)
- [ ] `fn_set_auto_complete_at` sets `auto_complete_at` when trade transitions to `in_progress`
- [ ] `rpc_process_expired_offers` cancels all trades where `offer_expires_at < NOW()` and status=pending
- [ ] `listing_offer_stats.consecutive_unanswered_offers_count` increments on each expired offer
- [ ] Counter resets to 0 when seller explicitly accepts or declines (add reset logic to those trigger paths)
- [ ] `process-expired-offers` cron runs every 5 minutes
- [ ] Edge Function returns `{ expired_count, trade_ids }` in response
- [ ] No double-expiry: idempotent — running cron twice doesn't cancel already-cancelled trades

**NEXT TASK: TFV2-005**

---

## TASK TFV2-005: Auto-Complete Cron

**Duration:** 1.5 hours  
**Priority:** Critical  
**Dependencies:** TFV2-002 (`auto_complete_at`, `dispute_status`), TFV2-004 (pattern for cron setup)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260528000005_auto_complete_cron.sql` | CREATE | `process_auto_complete` cron + RPC |
| `supabase/functions/process-auto-complete/index.ts` | CREATE | Edge Function invoked by cron |

### Description

`process_auto_complete` cron runs every 5 minutes. It completes `in_progress` trades where:
- `auto_complete_at < NOW()` AND
- `dispute_status NOT IN ('reported', 'under_review')` — **dispute guard per D-26**

Setting status to `completed` fires `fn_release_all_sp_on_complete` (TFV2-003) automatically. Also triggers payout logic (TFV2-018 will add that). Separately, `release_pending_sp` cron runs hourly to move `pending_sp` → `available_sp` after `sp_pending_release_days`.

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000005_auto_complete_cron.sql

-- ============================================================
-- RPC: Complete in_progress trades past auto_complete_at
-- SKIPS trades with dispute_status IN ('reported', 'under_review') per D-26
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_process_auto_complete()
RETURNS JSONB AS $$
DECLARE
  v_completed_ids UUID[];
  v_count INTEGER;
BEGIN
  SELECT ARRAY_AGG(id)
  INTO v_completed_ids
  FROM trades
  WHERE status = 'in_progress'
    AND auto_complete_at IS NOT NULL
    AND auto_complete_at < NOW()
    AND dispute_status NOT IN ('reported', 'under_review');  -- D-26 guard

  IF v_completed_ids IS NULL THEN
    RETURN jsonb_build_object('completed_count', 0);
  END IF;

  -- Set completed — fn_release_all_sp_on_complete fires automatically (TFV2-003)
  UPDATE trades
  SET
    status       = 'completed',
    completed_at = NOW(),
    updated_at   = NOW()
  WHERE id = ANY(v_completed_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('completed_count', v_count, 'trade_ids', v_completed_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Release pending SP after sp_pending_release_days
-- SKIPS trades with active dispute
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_release_pending_sp()
RETURNS JSONB AS $$
DECLARE
  v_days INTEGER;
  v_released INTEGER := 0;
BEGIN
  SELECT COALESCE(sp_pending_release_days, 3)
  INTO v_days
  FROM admin_config LIMIT 1;

  -- Use sp_earned_at_completion (snapshotted at completion by fn_release_all_sp_on_complete).
  -- This prevents config drift: if admin_config.sp_category_multiplier changes after the trade
  -- completes, the seller still receives the SP they were owed at completion time.
  UPDATE sp_wallets sw
  SET
    pending_sp   = GREATEST(0, sw.pending_sp - t.sp_earned),
    available_sp = sw.available_sp + t.sp_earned,
    updated_at   = NOW()
  FROM (
    SELECT
      t.seller_id,
      COALESCE(t.sp_earned_at_completion, 0) AS sp_earned
    FROM trades t
    WHERE t.status = 'completed'
      AND t.completed_at + (v_days * INTERVAL '1 day') < NOW()
      AND t.dispute_status NOT IN ('reported', 'under_review')
      AND t.sp_released_at IS NULL
      AND COALESCE(t.sp_earned_at_completion, 0) > 0  -- skip zero-SP trades
  ) t
  WHERE sw.user_id = t.seller_id;

  -- Mark trades as SP-released (add column to prevent double-release)
  UPDATE trades
  SET
    sp_released_at = NOW(),
    updated_at     = NOW()
  WHERE
    status = 'completed'
    AND completed_at + (v_days * INTERVAL '1 day') < NOW()
    AND dispute_status NOT IN ('reported', 'under_review')
    AND sp_released_at IS NULL;

  GET DIAGNOSTICS v_released = ROW_COUNT;

  RETURN jsonb_build_object('released_count', v_released);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add sp_released_at to trades to prevent double-release
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS sp_released_at TIMESTAMPTZ;

-- ============================================================
-- CRON: process_auto_complete — every 5 minutes
-- ============================================================
SELECT cron.schedule(
  'process-auto-complete',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_function_base_url') || '/process-auto-complete',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- CRON: release_pending_sp — every hour
-- ============================================================
SELECT cron.schedule(
  'release-pending-sp',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_function_base_url') || '/release-pending-sp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

```typescript
// filepath: supabase/functions/process-auto-complete/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('rpc_process_auto_complete');

  if (error) {
    console.error('[process-auto-complete] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('[process-auto-complete] Result:', data);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### ACCEPTANCE CRITERIA

- [ ] `rpc_process_auto_complete` only completes trades where `dispute_status NOT IN ('reported', 'under_review')`
- [ ] Auto-complete sets `status = 'completed'` and `completed_at = NOW()`
- [ ] Setting status to `completed` fires `fn_release_all_sp_on_complete` automatically (TFV2-003)
- [ ] `rpc_release_pending_sp` moves seller `pending_sp` → `available_sp` after N days
- [ ] `sp_released_at` prevents double-release on retry
- [ ] Both crons scheduled (every 5 min for auto-complete, every hour for SP release)
- [ ] Disputed trades (`reported`, `under_review`) are never auto-completed
- [ ] Edge Function returns `{ completed_count, trade_ids }`

**NEXT TASK: TFV2-006**

---

## TASK TFV2-006: Platform SP Calculation — `completeTradeV2()` Service Function

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** TFV2-003, TFV2-005

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/services/tradeServiceV2.ts` | CREATE | `completeTradeV2()` — called by buyer "I Got It" tap; sets status=completed; DB triggers handle SP |
| `supabase/functions/complete-trade/index.ts` | CREATE | Edge Function for client-triggered completion |

### Description

Create `completeTradeV2()` — the single function called when the buyer taps "I Got It" OR when the auto-complete cron fires. The function sets `trade.status = 'completed'`; the DB trigger `fn_release_all_sp_on_complete` (TFV2-003) handles all SP movement automatically. This function also queues the payout (TFV2-018 will wire that), sends completion push notifications, and records the `buyer_confirmed` event (TFV2-019).

### AI Prompt for Cursor

```typescript
// filepath: src/services/tradeServiceV2.ts

import { createClient } from '@/lib/supabase';
import { Trade } from '@/types/trade';

export interface CompletionResult {
  trade: Trade;
  sp_released_to_seller: number;
}

/**
 * Called when buyer taps "I Got It" on TradeTimelineScreen.
 * Sets trade.status = 'completed'.
 * DB triggers automatically:
 *   - fn_release_all_sp_on_complete (TFV2-003): SP movement
 *   - payout trigger (TFV2-018, added separately)
 *
 * @param tradeId  UUID of the trade to complete
 * @param buyerId  Must match trade.buyer_id (authorisation check)
 */
export async function completeTradeV2(
  tradeId: string,
  buyerId: string
): Promise<CompletionResult> {
  const supabase = createClient();

  // Load trade and verify caller is the buyer
  const { data: trade, error: fetchError } = await supabase
    .from('trades')
    .select('*')
    .eq('id', tradeId)
    .single();

  if (fetchError || !trade) {
    throw new Error('Trade not found');
  }

  if (trade.buyer_id !== buyerId) {
    throw new Error('Only the buyer can complete this trade');
  }

  if (trade.status !== 'in_progress') {
    throw new Error(`Cannot complete trade in status: ${trade.status}`);
  }

  if (trade.dispute_status === 'reported' || trade.dispute_status === 'under_review') {
    throw new Error('Cannot complete a trade with an active dispute');
  }

  // Set status = completed. DB triggers handle all SP movement.
  const { data: completedTrade, error: updateError } = await supabase
    .from('trades')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', tradeId)
    .select()
    .single();

  if (updateError || !completedTrade) {
    throw updateError ?? new Error('Failed to complete trade');
  }

  // Calculate total SP released for response (informational only — triggers already applied it)
  // TODO: fetch actual sp released from trade_events once TFV2-019 is wired
  const totalSpReleased = completedTrade.points_amount ?? 0;

  return {
    trade: completedTrade as Trade,
    sp_released_to_seller: totalSpReleased,
  };
}

/**
 * Cancel a trade and release the Stripe authorization hold or issue a refund.
 * - If trade.status = 'pending' → release pre-auth hold (buyer never charged; D-30).
 * - If trade.status = 'in_progress' → issue Stripe refund (charge was captured at acceptance).
 * Called by seller cancel modal and admin dispute refund.
 * fn_release_sp_on_cancel trigger fires automatically on status → 'cancelled'.
 */
export async function cancelTradeV2(
  tradeId: string,
  reason: string,
  cancelledByUserId: string
): Promise<Trade> {
  const supabase = createClient();

  // Fetch trade to determine which Stripe operation is needed before modifying state.
  const { data: trade } = await supabase
    .from('trades')
    .select('id, status, authorization_id')
    .eq('id', tradeId)
    .single();

  if (!trade) throw new Error('Trade not found');

  // Release Stripe funds server-side (keeps secret key out of client bundle).
  // Edge Function decides: cancel pre-auth (pending) vs refund (in_progress).
  if (trade.authorization_id) {
    const { error: releaseErr } = await supabase.functions.invoke('release-payment', {
      body: {
        trade_id:         tradeId,
        authorization_id: trade.authorization_id,
        trade_status:     trade.status,
      },
    });
    // Non-fatal — log but continue so the trade can still be marked cancelled.
    if (releaseErr) console.error('[cancelTradeV2] Stripe release failed:', releaseErr.message);
  }

  // Update trade status (fn_release_sp_on_cancel trigger fires automatically)
  const { data, error } = await supabase
    .from('trades')
    .update({
      status:              'cancelled',
      cancellation_reason: reason,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', tradeId)
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Failed to cancel trade');
  return data as Trade;
}
```

```typescript
// filepath: supabase/functions/complete-trade/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RequestBody {
  trade_id: string;
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  // Verify caller identity
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body: RequestBody = await req.json();
  const { trade_id } = body;

  if (!trade_id) {
    return new Response(JSON.stringify({ error: 'trade_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Use service client for the actual update (triggers need service role)
  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Verify buyer
  const { data: trade } = await adminSupabase
    .from('trades')
    .select('buyer_id, status, dispute_status')
    .eq('id', trade_id)
    .single();

  if (!trade || trade.buyer_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  if (trade.status !== 'in_progress') {
    return new Response(JSON.stringify({ error: `Invalid status: ${trade.status}` }), { status: 422 });
  }
  if (trade.dispute_status === 'reported' || trade.dispute_status === 'under_review') {
    return new Response(JSON.stringify({ error: 'Active dispute — cannot complete' }), { status: 422 });
  }

  const { data: completed, error } = await adminSupabase
    .from('trades')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', trade_id)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ trade: completed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### ACCEPTANCE CRITERIA

- [ ] `completeTradeV2()` validates caller is the buyer
- [ ] `completeTradeV2()` rejects trades not in `in_progress` status
- [ ] `completeTradeV2()` rejects trades with `dispute_status = 'reported'` or `'under_review'`
- [ ] Setting `status = 'completed'` fires DB triggers (TFV2-003) — no manual SP logic in this function
- [ ] `complete-trade` Edge Function requires valid JWT in Authorization header
- [ ] Edge Function verifies `user.id === trade.buyer_id` before completing
- [ ] `cancelTradeV2()` helper exists for use by seller cancel and admin refund paths

**NEXT TASK: TFV2-007**

---

## PHASE 4: REACT NATIVE COMPONENTS

---

## TASK TFV2-007: `<OfferCountdownPill />` Component

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** TFV2-002 (`offer_expires_at` field available in trade rows)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/components/trade/OfferCountdownPill.tsx` | CREATE | Countdown pill with urgency color states |
| `src/components/trade/index.ts` | MODIFY | Export new component |

### Description

Create the `<OfferCountdownPill />` component per Section 8.1 of TRADING-FLOW-V2.md. Displays remaining time before offer expires. Updates every 60 seconds (not every second — battery drain prevention). Five urgency states mapped to colors. Uses Phosphor `Timer` icon.

**Urgency color thresholds** (based on percentage of total offer window):
- > 50% remaining → `#5DBB8E` green
- 25–50% remaining → `#F59E0B` amber
- 10–25% remaining → `#FF8C00` orange
- < 10% remaining → `#EF4444` red
- Expired → `#9CA3AF` gray, text "Expired"

### AI Prompt for Cursor

```typescript
// filepath: src/components/trade/OfferCountdownPill.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Timer } from 'phosphor-react-native';

interface Props {
  expiresAt: string;        // ISO timestamp — offer_expires_at
  createdAt:  string;        // ISO timestamp — trade created_at (to calc total window)
  style?: object;
}

interface CountdownState {
  label: string;
  backgroundColor: string;
  isExpired: boolean;
}

function computeCountdown(expiresAt: string, createdAt: string): CountdownState {
  const now = Date.now();
  const expiryMs = new Date(expiresAt).getTime();
  const createdMs = new Date(createdAt).getTime();
  const remainingMs = expiryMs - now;
  const totalWindowMs = expiryMs - createdMs;

  if (remainingMs <= 0) {
    return { label: 'Expired', backgroundColor: '#9CA3AF', isExpired: true };
  }

  const pct = remainingMs / totalWindowMs;
  let backgroundColor: string;

  if (pct > 0.5) {
    backgroundColor = '#5DBB8E';
  } else if (pct > 0.25) {
    backgroundColor = '#F59E0B';
  } else if (pct > 0.10) {
    backgroundColor = '#FF8C00';
  } else {
    backgroundColor = '#EF4444';
  }

  const totalSecs = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);

  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return { label, backgroundColor, isExpired: false };
}

export function OfferCountdownPill({ expiresAt, createdAt, style }: Props) {
  const [state, setState] = useState<CountdownState>(() =>
    computeCountdown(expiresAt, createdAt)
  );

  useEffect(() => {
    const tick = () => setState(computeCountdown(expiresAt, createdAt));
    // Update every 60 seconds — not every second (battery drain prevention)
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [expiresAt, createdAt]);

  return (
    <View
      style={[styles.pill, { backgroundColor: state.backgroundColor }, style]}
      accessibilityRole="text"
      accessibilityLabel={state.isExpired ? 'Offer expired' : `Offer expires in ${state.label}`}
    >
      {!state.isExpired && (
        <Timer size={12} color="#FFFFFF" weight="regular" style={styles.icon} />
      )}
      <Text style={styles.label}>{state.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    height: 24,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});
```

### ACCEPTANCE CRITERIA

- [ ] Component renders correct color for each urgency threshold (>50%, 25–50%, 10–25%, <10%, expired)
- [ ] Updates every 60 seconds (not every second)
- [ ] "Expired" state: gray background, no timer icon, text "Expired"
- [ ] Pill height is 24px with border-radius 12 (pill-shaped)
- [ ] `accessibilityLabel` describes remaining time or expiry for screen readers
- [ ] Icon is Phosphor `Timer` (NOT Ionicons or other)
- [ ] Component exported from `src/components/trade/index.ts`

**NEXT TASK: TFV2-008**

---

## TASK TFV2-008: `<AutoCompleteBanner />` Component

**Duration:** 1.5 hours  
**Priority:** High  
**Dependencies:** TFV2-002 (`auto_complete_at`), TFV2-007 (urgency color logic — can extract shared `computeCountdown`)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/components/trade/AutoCompleteBanner.tsx` | CREATE | Full-width banner for buyer on TradeTimelineScreen |
| `src/components/trade/index.ts` | MODIFY | Export new component |

### Description

Create `<AutoCompleteBanner />` per Section 8.2 of TRADING-FLOW-V2.md. Full-width banner shown to **buyer only** on `TradeTimelineScreen` when `trade.status = 'in_progress'`. Hidden once trade is `completed` or `cancelled`. Same urgency colors as `OfferCountdownPill`. Updates every 60 seconds.

### AI Prompt for Cursor

```typescript
// filepath: src/components/trade/AutoCompleteBanner.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Timer } from 'phosphor-react-native';

interface Props {
  autoCompleteAt: string;    // ISO timestamp — auto_complete_at
  inProgressAt:   string;    // ISO timestamp — when trade entered in_progress (for % calc)
}

interface BannerState {
  timeLabel: string;
  backgroundColor: string;
  isExpired: boolean;
}

function computeBannerState(autoCompleteAt: string, inProgressAt: string): BannerState {
  const now = Date.now();
  const completeMs = new Date(autoCompleteAt).getTime();
  const startMs = new Date(inProgressAt).getTime();
  const remainingMs = completeMs - now;
  const totalWindowMs = completeMs - startMs;

  if (remainingMs <= 0) {
    return { timeLabel: '0m', backgroundColor: '#EF4444', isExpired: true };
  }

  const pct = remainingMs / totalWindowMs;
  let backgroundColor: string;

  if (pct > 0.5)       backgroundColor = '#5DBB8E';
  else if (pct > 0.25) backgroundColor = '#F59E0B';
  else if (pct > 0.10) backgroundColor = '#FF8C00';
  else                 backgroundColor = '#EF4444';

  const totalSecs = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const timeLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return { timeLabel, backgroundColor, isExpired: false };
}

export function AutoCompleteBanner({ autoCompleteAt, inProgressAt }: Props) {
  const [state, setState] = useState<BannerState>(() =>
    computeBannerState(autoCompleteAt, inProgressAt)
  );

  useEffect(() => {
    const tick = () => setState(computeBannerState(autoCompleteAt, inProgressAt));
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [autoCompleteAt, inProgressAt]);

  return (
    <View
      style={[styles.banner, { backgroundColor: state.backgroundColor }]}
      accessibilityRole="text"
      accessibilityLabel={`Trade auto-completing in ${state.timeLabel}. Received it already? Tap I Got It to confirm.`}
    >
      <View style={styles.row}>
        <Timer size={16} color="#FFFFFF" weight="regular" style={styles.icon} />
        <Text style={styles.headline}>
          Auto-completing in {state.timeLabel}
        </Text>
      </View>
      <Text style={styles.subtext}>
        Received it already? Tap "I Got It" to confirm.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  icon: {
    marginRight: 6,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  subtext: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    marginLeft: 22,   // align under headline text (icon width + margin)
  },
});
```

### ACCEPTANCE CRITERIA

- [ ] Banner is full-width with no horizontal margins
- [ ] Shows `<Timer />` Phosphor icon + "Auto-completing in Xh Ym" headline
- [ ] Shows sub-text: `Received it already? Tap "I Got It" to confirm.`
- [ ] Same urgency colors as `OfferCountdownPill`: green → amber → orange → red
- [ ] Updates every 60 seconds
- [ ] `accessibilityLabel` describes the countdown and action
- [ ] **Buyer view only** — calling component (TradeTimelineScreen, TFV2-011) is responsible for showing/hiding based on user role
- [ ] Hidden once trade is `completed` or `cancelled` — TFV2-011 handles that gate
- [ ] Exported from `src/components/trade/index.ts`

**NEXT TASK: TFV2-009**

---

## PHASE 5: MOBILE SCREENS

---

## TASK TFV2-009: TradeListScreen — Offers Tab Updates

**Duration:** 2.5 hours  
**Priority:** High  
**Dependencies:** TFV2-007 (`<OfferCountdownPill />`), TFV2-002 (`offer_expires_at` on trade rows)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/screens/trade/TradeListScreen.tsx` | MODIFY | Add expiry field to query, embed countdown pill, sort received offers by total value DESC |
| `src/hooks/useTrades.ts` | MODIFY | Include `offer_expires_at`, `bundle_id` in the Supabase select query |

### Description

The Offers tab on `TradeListScreen` already exists. Three changes required:
1. **Sort**: For `received` offers (seller view), sort by `total_value DESC` where `total_value = cash_amount_cents + (sp_amount * 100)`. Tie-break: highest cash first, then earliest `created_at`.
2. **Countdown pill**: Add `<OfferCountdownPill expiresAt={trade.offer_expires_at} createdAt={trade.created_at} />` right-aligned on each pending offer row.
3. **Hide expired**: Offers with `offer_expires_at < NOW() - 24h` are hidden from both sender and receiver views.
4. **Bundle badge**: When offers share a `bundle_id`, show a `Bundle — N items` chip on the row.

### AI Prompt for Cursor

```typescript
// filepath: src/screens/trade/TradeListScreen.tsx
// MODIFY the existing component. Do not rewrite from scratch.
// Locate the Supabase query for the Offers tab and make these changes:

// 1. ADD to the select() fields:
//    offer_expires_at, bundle_id
//    (alongside existing trade fields)

// 2. For RECEIVED offers (seller view), add client-side sort:
const sortedReceivedOffers = receivedOffers
  .filter(offer => {
    // Hide offers expired more than 24h ago
    if (!offer.offer_expires_at) return true;
    const expiredAt = new Date(offer.offer_expires_at).getTime();
    const cutoff = expiredAt + 24 * 60 * 60 * 1000;
    return Date.now() < cutoff || offer.status !== 'cancelled';
  })
  .sort((a, b) => {
    // Sort by total value DESC: cash_amount_cents + sp_amount * 100
    const totalA = (a.cash_amount_cents ?? (a.cash_amount * 100)) + (a.points_amount ?? 0) * 100;
    const totalB = (b.cash_amount_cents ?? (b.cash_amount * 100)) + (b.points_amount ?? 0) * 100;
    if (totalB !== totalA) return totalB - totalA;
    // Tie-break 1: highest cash first
    const cashA = a.cash_amount_cents ?? (a.cash_amount * 100);
    const cashB = b.cash_amount_cents ?? (b.cash_amount * 100);
    if (cashB !== cashA) return cashB - cashA;
    // Tie-break 2: earliest offer first
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

// 3. In the render of each PENDING offer row, add:
//    - <OfferCountdownPill expiresAt={offer.offer_expires_at} createdAt={offer.created_at} />
//      right-aligned (use justifyContent: 'space-between' on the row container)
//    - If offer.bundle_id is set, show a "Bundle" chip with Package icon (Phosphor, 12px)

// 4. For SUBMITTED offers (buyer view), sort by created_at DESC (keep existing behavior)

// NOTE: Import OfferCountdownPill from 'src/components/trade'
// NOTE: Import Package from 'phosphor-react-native' for bundle chip
```

### ACCEPTANCE CRITERIA

- [ ] Received offers (seller) sorted by total value DESC (cash + SP×$1)
- [ ] Equal total values tie-broken by highest cash first, then earliest offer
- [ ] `<OfferCountdownPill />` shown right-aligned on every pending offer row
- [ ] Offers with `offer_expires_at < NOW() - 24h` hidden from both views (after 24h grace)
- [ ] `offer_expires_at` included in the Supabase query select
- [ ] Bundle chip shown when `bundle_id` is non-null on an offer row
- [ ] Submitted offers (buyer) sorted by `created_at DESC`
- [ ] No existing offer tab functionality broken

**NEXT TASK: TFV2-010**

---

## TASK TFV2-010: ReviewOfferScreen — SP Total Display + Wallet Projection

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** TFV2-003 (SP reserve triggers), TFV2-007 (countdown pill), TFV2-001 (`sp_pending_release_days` config)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/screens/trade/ReviewOfferScreen.tsx` | MODIFY | Update SP display to show combined total with timing note; add countdown pill; add projected wallet state |
| `src/services/spCalculatorService.ts` | MODIFY | Add `calculatePlatformSP()` helper for preview |

### Description

Update `ReviewOfferScreen` (seller's view of a specific offer) with three changes per Section 10.3:
1. **SP total display**: Show `total_sp_to_show = buyer_sp_amount + platform_calculated_sp`. Do NOT break down by source (Decision D-11). Show timing note: `"[X] SP releasing in [N] days"` where N = `sp_pending_release_days`.
2. **Projected wallet state**: After the SP display, show seller's current wallet + total SP: `"After this trade your SP balance: [current + X SP in [N] days]"`.
3. **Countdown pill**: Add `<OfferCountdownPill />` in the header area below the item title.

### AI Prompt for Cursor

```typescript
// filepath: src/services/spCalculatorService.ts
// ADD this function to the existing file (do not replace existing functions)

import { createClient } from '@/lib/supabase';

/**
 * Calculates platform SP for a given listing (FR-SP-001).
 * formula: ROUND(item_price_dollars × 0.25 × category_multiplier)
 * category_multiplier fetched from admin_config; defaults to 1.0.
 */
export async function calculatePlatformSP(listingId: string): Promise<number> {
  const supabase = createClient();

  const [{ data: listing }, { data: config }] = await Promise.all([
    supabase.from('listings').select('price, category_id').eq('id', listingId).single(),
    supabase.from('admin_config').select('sp_category_multiplier').single(),
  ]);

  if (!listing) return 0;

  const multiplier = (config as { sp_category_multiplier?: number } | null)?.sp_category_multiplier ?? 1.0;
  return Math.round((listing.price ?? 0) * 0.25 * multiplier);
}

/**
 * Returns the total SP the seller will receive if this offer completes.
 * buyer_sp + platform_sp
 */
export async function previewTotalSPToSeller(
  listingId: string,
  buyerSpAmount: number
): Promise<{ buyerSp: number; platformSp: number; totalSp: number }> {
  const platformSp = await calculatePlatformSP(listingId);
  return {
    buyerSp: buyerSpAmount,
    platformSp,
    totalSp: buyerSpAmount + platformSp,
  };
}
```

```typescript
// filepath: src/screens/trade/ReviewOfferScreen.tsx
// MODIFY the existing component. Key changes only:

// 1. Fetch admin config for sp_pending_release_days:
//    const { data: adminConfig } = await supabase
//      .from('admin_config')
//      .select('sp_pending_release_days')
//      .single();
//    const releaseDays = adminConfig?.sp_pending_release_days ?? 3;

// 2. Fetch platform SP preview:
//    const { totalSp } = await previewTotalSPToSeller(trade.listing_id, trade.points_amount ?? 0);

// 3. Replace the existing SP display section with:
//    <View style={styles.spSection}>
//      <Text style={styles.spTotal}>
//        {totalSp > 0 ? `${totalSp} SP releasing in ${releaseDays} days` : null}
//      </Text>
//      {/* Do NOT show buyer_sp + platform_sp breakdown — Decision D-11 */}
//    </View>

// 4. Add projected wallet state below SP section:
//    <Text style={styles.walletProjection}>
//      After this trade your SP balance: {currentSellerSP} +{' '}
//      <Text style={styles.walletProjectionHighlight}>
//        {totalSp} SP in {releaseDays} days
//      </Text>
//    </Text>

// 5. Add countdown pill in the header:
//    {trade.offer_expires_at && (
//      <OfferCountdownPill
//        expiresAt={trade.offer_expires_at}
//        createdAt={trade.created_at}
//        style={{ marginTop: 8 }}
//      />
//    )}

// 6. Retain existing [Accept] and [Decline] button logic unchanged.
//    No counter-offer button for V1 (Decision D-06).
```

### ACCEPTANCE CRITERIA

- [ ] SP total shows combined `buyer_sp + platform_sp` (NOT separate line items — Decision D-11)
- [ ] Timing note reads `"[X] SP releasing in [N] days"` using live `sp_pending_release_days` config
- [ ] Projected wallet state shows seller's current SP + incoming SP
- [ ] `<OfferCountdownPill />` appears in header area below item title
- [ ] `calculatePlatformSP()` uses `ROUND(price × 0.25 × category_multiplier)` formula
- [ ] If buyer used 0 SP (cash-only path on Accept SP listing): shows platform SP only
- [ ] Existing Accept/Decline buttons unchanged
- [ ] No SP source breakdown shown (no "8 from buyer + 5 from platform" text)

**NEXT TASK: TFV2-011**

---

## TASK TFV2-011: TradeTimelineScreen — Remove Seller Mark Step, Add I Got It + Report a Problem

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** TFV2-006 (`completeTradeV2()`), TFV2-008 (`<AutoCompleteBanner />`)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/screens/trade/TradeTimelineScreen.tsx` | MODIFY | Remove seller mark step; add buyer I Got It + Report a Problem; add AutoCompleteBanner; add dispute status banner; add Safe Meetup card (Module 20 hook) |
| `src/screens/trade/TradeDetailScreen.tsx` | MODIFY | Apply same D-03 changes: remove seller mark step; add buyer [I Got It] + [Report a Problem]; same dispute status banners; same seller cancel block on active dispute (Section 11 applies to both screens) |
| `src/screens/trade/IssueReportModal.tsx` | CREATE | Bottom-sheet modal for dispute entry |
| `supabase/functions/open-dispute/index.ts` | CREATE | Server-side guard: enforce in_progress status, buyer-only, no existing dispute before writing to DB |

### Description

Major changes to `TradeTimelineScreen` per Section 11.4 and Decision D-03:

**Remove:**
- Seller "Mark Complete" button
- `seller_marked_completed_at` as a required flow step in the timeline UI

**Add (buyer view when `in_progress`, no dispute):**
- `<AutoCompleteBanner />` at top of screen (buyer only)
- **[I Got It]** primary green pill button → calls `completeTradeV2()`
- **[Report a Problem]** secondary outlined red pill button → opens `<IssueReportModal />`
- [Message Seller] text link (existing)

**Add (buyer view when dispute is `reported` or `under_review`):**
- Replace `<AutoCompleteBanner />` with amber dispute status banner
- Hide [I Got It] and [Report a Problem]
- [Message Seller] remains

**Add (seller view when dispute active):**
- Show amber dispute notice banner
- Hide [Cancel] button
- [Message Buyer] remains

### AI Prompt for Cursor

```typescript
// filepath: src/screens/trade/IssueReportModal.tsx
// NEW FILE — bottom sheet modal for dispute entry

import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TextInput as RNTextInput, ScrollView, SafeAreaView,
} from 'react-native';
import { X, WarningCircle } from 'phosphor-react-native';

const DISPUTE_REASONS = [
  { id: 'no_show',     label: "Seller didn't show up" },
  { id: 'not_as_described', label: 'Item not as described' },
  { id: 'no_meetup',  label: "Couldn't agree on meetup" },
  { id: 'other',      label: 'Other' },
] as const;

type DisputeReasonId = typeof DISPUTE_REASONS[number]['id'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: DisputeReasonId, details: string) => Promise<void>;
}

export function IssueReportModal({ visible, onClose, onSubmit }: Props) {
  const [selectedReason, setSelectedReason] = useState<DisputeReasonId | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await onSubmit(selectedReason, details);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />
          {/* Header */}
          <View style={styles.header}>
            <WarningCircle size={24} color="#EF4444" weight="fill" />
            <Text style={styles.title}>Report a Problem</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#6B6B6B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.prompt}>What happened?</Text>

            {DISPUTE_REASONS.map(reason => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonRow,
                  selectedReason === reason.id && styles.reasonRowSelected,
                ]}
                onPress={() => setSelectedReason(reason.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedReason === reason.id }}
              >
                <View style={[
                  styles.radioOuter,
                  selectedReason === reason.id && styles.radioOuterSelected,
                ]}>
                  {selectedReason === reason.id && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.reasonLabel}>{reason.label}</Text>
              </TouchableOpacity>
            ))}

            <RNTextInput
              style={styles.detailsInput}
              placeholder="Add details (optional)"
              placeholderTextColor="#999999"
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={500}
              accessibilityLabel="Additional details"
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                !selectedReason && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || submitting}
              accessibilityRole="button"
            >
              <Text style={styles.submitLabel}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:         { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:           { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle:          { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: 8 },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 8 },
  title:           { flex: 1, fontSize: 17, fontWeight: '600', color: '#1A1A1A', fontFamily: 'Inter-SemiBold' },
  content:         { paddingHorizontal: 20, paddingBottom: 16 },
  prompt:          { fontSize: 15, color: '#6B6B6B', marginBottom: 12, fontFamily: 'Inter-Regular' },
  reasonRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F0F0', gap: 12 },
  reasonRowSelected: { borderColor: '#5DBB8E' },
  radioOuter:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: '#5DBB8E' },
  radioInner:      { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5DBB8E' },
  reasonLabel:     { fontSize: 15, color: '#1A1A1A', fontFamily: 'Inter-Regular' },
  detailsInput:    { backgroundColor: '#F0F0F0', borderRadius: 12, padding: 16, marginTop: 16, minHeight: 80, fontSize: 15, color: '#1A1A1A', textAlignVertical: 'top', fontFamily: 'Inter-Regular' },
  footer:          { padding: 20 },
  submitButton:    { height: 52, borderRadius: 26, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  submitButtonDisabled: { backgroundColor: '#E0E0E0' },
  submitLabel:     { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: 'Inter-SemiBold' },
});
```

```typescript
// filepath: src/screens/trade/TradeTimelineScreen.tsx
// MODIFY the existing component. Key changes:

// 1. REMOVE seller "Mark Complete" button from seller view
// 2. REMOVE seller_marked_completed_at step from the timeline display
//    (The field may still exist in DB for historical data — just remove it from UI)

// 3. ADD to buyer view (when status === 'in_progress' && dispute_status === 'none'):
//    - <AutoCompleteBanner autoCompleteAt={trade.auto_complete_at} inProgressAt={trade.updated_at} />
//      at top of scroll content (above timeline steps)
//    - [I Got It] primary button at bottom
//    - [Report a Problem] secondary outlined button at bottom, color #EF4444

// 4. [I Got It] press handler:
const handleIGotIt = async () => {
  setConfirming(true);
  try {
    await completeTradeV2(trade.id, currentUserId);
    // Navigate to CompletionScreen — pass trade data for CTA logic (TFV2-014)
    navigation.replace('TradeSuccess', { tradeId: trade.id });
  } catch (err) {
    showToast({ message: 'Could not complete trade. Please try again.', type: 'error' });
  } finally {
    setConfirming(false);
  }
};

// 5. [Report a Problem] press handler:
//    setIssueReportVisible(true);
//    → opens <IssueReportModal />

// 6. IssueReportModal onSubmit handler:
// MUST call the open-dispute Edge Function — NOT a direct client UPDATE.
// Server enforces: trade must be in_progress, caller must be buyer, no existing dispute.
const handleReportSubmit = async (reason: string, details: string) => {
  const { data, error } = await supabase.functions.invoke('open-dispute', {
    body: {
      trade_id: trade.id,
      reason,
      details,
    },
  });
  if (error || !data?.success) {
    throw new Error(data?.error ?? error?.message ?? 'Failed to report issue');
  }
  // Refetch trade to update UI
  await refetchTrade();
};

// 7. ADD dispute status banner (buyer, when dispute active):
//    Replaces AutoCompleteBanner. Amber background (#F59E0B).
//    Text: "Your issue has been reported. Our team will review within 24 hours. Auto-complete is paused."
//    Hide [I Got It] and [Report a Problem] buttons.

// 8. ADD dispute notice (seller, when dispute active):
//    Amber banner: "A buyer has reported an issue with this trade. Our team is reviewing."
//    Hide [Cancel] button.

// 9. BOTH views: [Message Seller]/[Message Buyer] text link remains always visible
//    during in_progress (with or without dispute).

// 10. Safe Meetup card placeholder (TFV2-020 will implement):
//     {trade.status === 'in_progress' && <SafeMeetupCard tradeId={trade.id} />}
//     Import from '@/components/trade/SafeMeetupCard' — will be created in TFV2-020.
//     For now, add the import comment as a TODO.
```

### ACCEPTANCE CRITERIA

- [ ] Seller "Mark Complete" button removed from UI (Decision D-03)
- [ ] `seller_marked_completed_at` removed from timeline flow steps
- [ ] Buyer sees `<AutoCompleteBanner />` when `in_progress` with no active dispute
- [ ] Buyer sees **[I Got It]** primary green pill button (52px, #5DBB8E)
- [ ] Buyer sees **[Report a Problem]** secondary outlined button (52px, border #EF4444)
- [ ] [I Got It] calls `completeTradeV2()` then navigates to TradeSuccess
- [ ] [Report a Problem] opens `<IssueReportModal />` bottom sheet
- [ ] `IssueReportModal` has 4 reason options + optional free-text
- [ ] **`IssueReportModal.onSubmit` calls `open-dispute` Edge Function — NOT a direct client update**
- [ ] **`open-dispute` Edge Function rejects if trade is not `in_progress`**
- [ ] **`open-dispute` Edge Function rejects if caller is not the trade buyer**
- [ ] **`open-dispute` Edge Function rejects if `dispute_status` is already `reported` or `under_review`**
- [ ] Buyer with active dispute sees amber status banner (NOT AutoCompleteBanner)
- [ ] Buyer with active dispute cannot tap [I Got It] or [Report a Problem]
- [ ] Seller with active dispute sees amber notice banner
- [ ] Seller cannot tap [Cancel] when dispute is active
- [ ] **`TradeDetailScreen` receives same D-03 changes as `TradeTimelineScreen`**
- [ ] [Message Seller]/[Message Buyer] always visible during `in_progress`
- [ ] All buttons use Whisk design system (52px, pill-shaped)

### open-dispute Edge Function Spec

```typescript
// filepath: supabase/functions/open-dispute/index.ts
// Server-side guard for dispute submission.
// Enforces: trade must be in_progress, caller must be the buyer, no existing dispute.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RequestBody {
  trade_id: string;
  reason:   string;
  details:  string;
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  // Use anon client to get the authenticated user
  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { trade_id, reason, details }: RequestBody = await req.json();

  // Fetch trade to enforce guards
  const { data: trade } = await adminSupabase
    .from('trades')
    .select('id, status, buyer_id, dispute_status')
    .eq('id', trade_id)
    .single();

  if (!trade) {
    return new Response(JSON.stringify({ error: 'Trade not found' }), { status: 404 });
  }

  // Guard 1: Trade must be in_progress
  if (trade.status !== 'in_progress') {
    return new Response(
      JSON.stringify({ error: 'Dispute can only be filed on in-progress trades' }),
      { status: 422 }
    );
  }

  // Guard 2: Caller must be the buyer
  if (trade.buyer_id !== user.id) {
    return new Response(
      JSON.stringify({ error: 'Only the buyer can file a dispute' }),
      { status: 403 }
    );
  }

  // Guard 3: No existing open dispute
  if (trade.dispute_status !== 'none') {
    return new Response(
      JSON.stringify({ error: 'A dispute is already open for this trade' }),
      { status: 409 }
    );
  }

  // Write dispute fields
  const { error: updateErr } = await adminSupabase
    .from('trades')
    .update({
      dispute_status:      'reported',
      dispute_reason:      `${reason}: ${details}`.trim(),
      dispute_reported_at: new Date().toISOString(),
    })
    .eq('id', trade_id);

  if (updateErr) {
    return new Response(JSON.stringify({ error: 'Failed to open dispute' }), { status: 500 });
  }

  // Notify admin team (via admin notification channel — implement in TFV2-016)
  // await adminSupabase.functions.invoke('send-trade-notifications', { body: { ... } });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

**NEXT TASK: TFV2-012**

---

## TASK TFV2-012: Item Detail — Request to Buy / Use SP Button Logic

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** None — pure UI changes with subscription status check

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/screens/home/ItemDetailScreen.tsx` | MODIFY | Button labels, free user lock on Use SP, upgrade modal |

### Description

Update `ItemDetailScreen` button logic per Section 11.1 and Decisions D-07, D-08, D-25:

| Listing Type | Buyer Type | Buttons Shown |
|---|---|---|
| Cash Only | Any | **[Request to Buy]** only |
| Accept SP | Free buyer | **[Request to Buy]** + **[Use SP 🔒]** (visible but locked) |
| Accept SP | Subscriber | **[Request to Buy]** + **[Use SP]** |
| Donate | Any | **[Claim]** only |

- "Use SP" for free users shows a Phosphor `Lock` icon (16px) inside the button
- Tapping the locked "Use SP" button opens an upgrade modal (NOT the SP slider)
- Upgrade modal copy: `"Unlock SP discounts with Kids Club+. Save up to 50% on items. 30 days free."`
- Do NOT hide "Use SP" for free users — it must be VISIBLE but LOCKED (Decision D-08)

### AI Prompt for Cursor

```typescript
// filepath: src/screens/home/ItemDetailScreen.tsx
// MODIFY existing component. Replace the existing Buy Now / Pay Cash button section.

// 1. Determine listing type from listing.payment_preference:
//    'cash_only' | 'accept_sp' | 'donate'

// 2. Determine buyer subscription status:
//    const { data: profile } = await supabase
//      .from('profiles')
//      .select('subscription_status')
//      .eq('id', currentUserId)
//      .single();
//    const isSubscriber = ['trial', 'active', 'cancelled'].includes(profile?.subscription_status ?? '');

// 3. Render bottom button area:
{listing.payment_preference === 'donate' ? (
  <TouchableOpacity style={styles.primaryButton} onPress={handleClaim}
    accessibilityRole="button" accessibilityLabel="Claim this item">
    <Text style={styles.primaryButtonLabel}>Claim</Text>
  </TouchableOpacity>
) : (
  <View style={styles.buttonRow}>
    {/* Request to Buy — always visible for non-donate listings (D-07) */}
    <TouchableOpacity
      style={[
        styles.primaryButton,
        listing.payment_preference === 'accept_sp' && styles.primaryButtonHalf,
      ]}
      onPress={handleRequestToBuy}
      accessibilityRole="button"
      accessibilityLabel="Request to buy this item"
    >
      <Text style={styles.primaryButtonLabel}>Request to Buy</Text>
    </TouchableOpacity>

    {/* Use SP — only for accept_sp listings; visible-but-locked for free users (D-08) */}
    {listing.payment_preference === 'accept_sp' && (
      <TouchableOpacity
        style={[
          styles.secondaryButton,
          styles.primaryButtonHalf,
          !isSubscriber && styles.lockedButton,
        ]}
        onPress={isSubscriber ? handleUseSP : handleUpgradePrompt}
        accessibilityRole="button"
        accessibilityLabel={isSubscriber ? 'Use Swap Points' : 'Use Swap Points (requires Kids Club+)'}
      >
        {!isSubscriber && (
          <Lock size={16} color="#5DBB8E" weight="regular" style={{ marginRight: 6 }} />
        )}
        <Text style={[
          styles.secondaryButtonLabel,
          !isSubscriber && styles.lockedButtonLabel,
        ]}>
          Use SP
        </Text>
      </TouchableOpacity>
    )}
  </View>
)}

// 4. handleRequestToBuy: navigate to TradeOfferScreen with payment_type='cash'
// 5. handleUseSP: navigate to TradeOfferScreen with payment_type='sp' (opens SP slider)
// 6. handleUpgradePrompt: show upgrade modal:
//    <Modal ...>
//      <Text>Unlock SP discounts with Kids Club+.</Text>
//      <Text>Save up to 50% on items. 30 days free.</Text>
//      <TouchableOpacity onPress={() => navigation.navigate('SubscriptionChoice')}>
//        <Text>Try Kids Club+ Free — 30 Days</Text>
//      </TouchableOpacity>
//      <TouchableOpacity onPress={() => setUpgradeModalVisible(false)}>
//        <Text>Not Now</Text>
//      </TouchableOpacity>
//    </Modal>

// STYLE NOTE (Whisk design system):
// primaryButton:  height 52, borderRadius 26, backgroundColor '#5DBB8E'
// secondaryButton: height 52, borderRadius 26, borderWidth 1.5, borderColor '#5DBB8E', backgroundColor 'transparent'
// lockedButton:   opacity 0.85 (visible but visually slightly muted)
// primaryButtonHalf: flex 1 (when two buttons side-by-side, 8px gap between)
// primaryButtonLabel: color '#FFFFFF', fontSize 16, fontWeight '600'
// secondaryButtonLabel: color '#5DBB8E', fontSize 16, fontWeight '600'
```

### ACCEPTANCE CRITERIA

- [ ] Button label is **"Request to Buy"** (NOT "Pay Cash" or "Buy Now") — Decision D-07
- [ ] Cash Only listings show only [Request to Buy]
- [ ] Accept SP listings show both [Request to Buy] and [Use SP]
- [ ] Donate listings show only [Claim]
- [ ] [Use SP] for free users shows Phosphor `Lock` icon (16px) inside the button (Decision D-08)
- [ ] [Use SP] for free users is visible — NOT hidden
- [ ] Tapping locked [Use SP] opens upgrade modal (NOT SP slider)
- [ ] Upgrade modal has correct copy and "Try Kids Club+ Free — 30 Days" CTA
- [ ] Tapping [Request to Buy] navigates to offer flow with `payment_type='cash'`
- [ ] Tapping [Use SP] (subscriber) navigates to offer flow with `payment_type='sp'`
- [ ] Both buttons are 52px height, pill-shaped per Whisk design system

**NEXT TASK: TFV2-012A**

---

## TASK TFV2-012A: Stripe Pre-Authorization Helpers & Offer Flow Integration (D-30)

**Duration:** 5 hours  
**Priority:** Critical  
**Dependencies:** TFV2-002 (`authorization_id`, `authorization_amount`, `authorization_expires_at` columns on `trades`), TFV2-003 (SP reserve triggers)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/functions/_shared/stripe/authorization.ts` | CREATE | Stripe pre-auth helpers: `preAuthorizePayment()`, `captureAuthorization()`, `releaseAuthorization()` |
| `supabase/functions/transactions-create/index.ts` | MODIFY | Add Stripe pre-auth + 3-offer limit check at offer creation |
| `supabase/functions/transactions-update/index.ts` | MODIFY | Capture auth on seller accept / release auth on decline |
| `supabase/functions/check-authorization-expiry/index.ts` | CREATE | Hourly cron to auto-cancel offers with expired Stripe authorizations |
| `src/services/paymentMethodService.ts` | CREATE | Client-side payment method validation helper |

### Description

**Decision D-30** requires Stripe payment authorization hold (cash + platform fee) placed when buyer makes an offer. Authorization is NOT captured until seller accepts. This ensures buyer commitment and reduces spam offers while maintaining the seller-approval-first model (D-02).

**Key Requirements:**
1. **Buyer must have a valid payment method on file** — if not, offer submission fails with clear error
2. **Stripe pre-authorization placed** when trade is created in `pending` state
3. **Max 3 active pending offers** per buyer to prevent excessive fund lockup
4. **Atomic rollback** — if Stripe auth succeeds but SP hold fails (or vice versa), both must be rolled back
5. **Authorization lifecycle**: placed → captured (on seller accept) OR released (on decline/expiry)
6. **Stripe authorization expires after ~7 days** — offers that exceed this window auto-cancel

**Edge Cases:**
- Card declined at offer time → immediate error, no trade created
- Card expires during pending window → offer auto-cancels
- Insufficient funds when seller accepts → auth capture fails, trade → cancelled

### AI Prompt for Cursor

```typescript
// filepath: supabase/functions/_shared/stripe/authorization.ts
// NEW FILE — Stripe payment authorization helpers

import Stripe from 'https://esm.sh/stripe@14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

export interface PreAuthResult {
  success: true;
  authorizationId: string;    // PaymentIntent ID
  authorizationAmount: number; // Amount in cents
  expiresAt: string;           // ISO timestamp (~7 days from now)
}

export interface PreAuthError {
  success: false;
  error: {
    code: string;              // INSUFFICIENT_FUNDS | CARD_DECLINED | NO_PAYMENT_METHOD | etc
    message: string;
  };
}

/**
 * Creates a Stripe PaymentIntent with manual capture (authorization hold).
 * Does NOT charge the card — funds are reserved only.
 * 
 * @param userId - Buyer's Supabase user ID
 * @param amountCents - Total amount to authorize (cash + platform fee)
 * @param metadata - Trade metadata for Stripe dashboard (tradeId, listingId, etc.)
 */
export async function preAuthorizePayment(
  userId: string,
  amountCents: number,
  metadata: Record<string, string>
): Promise<PreAuthResult | PreAuthError> {
  try {
    // Look up Stripe Customer ID from profiles table
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_customer_id, default_payment_method_id')
      .eq('id', userId)
      .single();

    if (profileErr || !profile?.stripe_customer_id) {
      return {
        success: false,
        error: {
          code: 'NO_STRIPE_CUSTOMER',
          message: 'No payment method on file. Please add a card first.',
        },
      };
    }

    if (!profile.default_payment_method_id) {
      return {
        success: false,
        error: {
          code: 'NO_PAYMENT_METHOD',
          message: 'No payment method on file. Please add a card first.',
        },
      };
    }

    // Create PaymentIntent with manual capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount:               amountCents,
      currency:             'usd',
      customer:             profile.stripe_customer_id,
      payment_method:       profile.default_payment_method_id,
      confirm:              true,
      capture_method:       'manual',  // THIS IS THE AUTHORIZATION HOLD
      off_session:          true,
      metadata,
    });

    if (paymentIntent.status !== 'requires_capture') {
      // Auth failed (card declined, insufficient funds, etc.)
      const errorCode = paymentIntent.last_payment_error?.code ?? 'UNKNOWN_ERROR';
      const errorMessage = paymentIntent.last_payment_error?.message ?? 'Payment authorization failed';
      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }

    // Authorization succeeded — funds are held on card but not captured
    // Stripe auth expires after ~7 days (exact value depends on payment method type)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return {
      success: true,
      authorizationId: paymentIntent.id,
      authorizationAmount: amountCents,
      expiresAt,
    };
  } catch (err) {
    console.error('Stripe pre-auth error:', err);
    return {
      success: false,
      error: {
        code: 'STRIPE_API_ERROR',
        message: err instanceof Error ? err.message : 'Payment authorization failed',
      },
    };
  }
}

/**
 * Captures a previously authorized PaymentIntent (converts hold → actual charge).
 * Called when seller accepts the offer.
 */
export async function captureAuthorization(
  authorizationId: string
): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(authorizationId);
    if (paymentIntent.status === 'succeeded') {
      return { success: true };
    } else {
      return {
        success: false,
        error: {
          code: 'CAPTURE_FAILED',
          message: `PaymentIntent status: ${paymentIntent.status}`,
        },
      };
    }
  } catch (err) {
    console.error('Stripe capture error:', err);
    return {
      success: false,
      error: {
        code: 'STRIPE_CAPTURE_ERROR',
        message: err instanceof Error ? err.message : 'Failed to capture payment',
      },
    };
  }
}

/**
 * Releases (cancels) a PaymentIntent authorization without capturing.
 * Called when seller declines, offer expires, or trade is cancelled.
 */
export async function releaseAuthorization(
  authorizationId: string
): Promise<{ success: boolean }> {
  try {
    await stripe.paymentIntents.cancel(authorizationId);
    return { success: true };
  } catch (err) {
    console.error('Stripe release error:', err);
    // Non-fatal — log but don't block trade cancellation
    return { success: false };
  }
}
```

```typescript
// filepath: supabase/functions/transactions-create/index.ts
// MODIFY existing Edge Function to add Stripe pre-auth + 3-offer limit

import { preAuthorizePayment } from '../_shared/stripe/authorization.ts';

// EXISTING CODE: Deno.serve(async (req) => { ... })
// INSERT this logic at the top of the request handler, before trade INSERT:

// 1. Check buyer pending offer limit (max 3)
const { count: pendingCount } = await supabase
  .from('trades')
  .select('id', { count: 'exact', head: true })
  .eq('buyer_id', buyerId)
  .eq('status', 'pending');

if ((pendingCount ?? 0) >= 3) {
  return new Response(
    JSON.stringify({ error: 'You have reached the maximum of 3 pending offers. Cancel one to make room.' }),
    { status: 400 }
  );
}

// 2. Compute total authorization amount.
//    cashAmountCents = item_price_cents ONLY (does NOT include platform fee).
//    totalAuthorizationCents = item price + platform fee.
//    This prevents double fee: submitOfferV2 sends item price only; server adds fee here.
const totalAuthorizationCents = cashAmountCents + platformFeeCents;
const authResult = await preAuthorizePayment(
  buyerId,
  totalAuthorizationCents,
  {
    tradeId:    'pending',  // will update after INSERT
    listingId,
    buyerId,
    sellerId,
  }
);

if (!authResult.success) {
  return new Response(
    JSON.stringify({ error: authResult.error.message }),
    { status: 400 }
  );
}

// 3. Insert trade with authorization details
const { data: trade, error: tradeErr } = await supabase
  .from('trades')
  .insert({
    listing_id:              listingId,
    buyer_id:                buyerId,
    seller_id:               sellerId,
    status:                  'pending',
    cash_amount_cents:       cashAmountCents,
    points_amount:           spAmount,
    authorization_id:        authResult.authorizationId,
    authorization_amount:    authResult.authorizationAmount,
    authorization_expires_at: authResult.expiresAt,
  })
  .select()
  .single();

if (tradeErr) {
  // Rollback Stripe authorization
  await releaseAuthorization(authResult.authorizationId);
  return new Response(
    JSON.stringify({ error: 'Failed to create trade. Authorization released.' }),
    { status: 500 }
  );
}

// 4. If SP hold trigger fails (checked via fn_reserve_sp_on_offer), rollback Stripe auth
//    This check happens automatically via the DB trigger — if it fails, the INSERT rollsback.
//    BUT we need to catch that error and release the Stripe auth manually.
//    Add error handling to detect SP reserve failure and call releaseAuthorization().

// SUCCESS: return trade with authorization details
return new Response(
  JSON.stringify({ trade, authorizationExpiresAt: authResult.expiresAt }),
  { status: 200 }
);
```

```typescript
// filepath: supabase/functions/transactions-update/index.ts
// MODIFY existing Edge Function to capture/release auth on seller action

import { captureAuthorization, releaseAuthorization } from '../_shared/stripe/authorization.ts';

// EXISTING CODE: Deno.serve(async (req) => { ... })
// When seller accepts (action = 'accept'):

if (action === 'accept') {
  // Capture the Stripe authorization (convert hold → charge)
  const captureResult = await captureAuthorization(trade.authorization_id);
  if (!captureResult.success) {
    // Capture failed (card expired, insufficient funds, etc.)
    // Set trade status → cancelled, restore SP
    await supabase
      .from('trades')
      .update({ status: 'cancelled', cancellation_reason: 'payment_failed' })
      .eq('id', tradeId);
    // fn_release_sp_on_cancel trigger will restore buyer SP automatically
    return new Response(
      JSON.stringify({ error: 'Payment failed. Trade cancelled.' }),
      { status: 400 }
    );
  }
  
  // Capture succeeded — move trade → payment_processing then → in_progress
  await supabase
    .from('trades')
    .update({ status: 'payment_processing' })
    .eq('id', tradeId);

  // Auto-decline competing offers (fn_auto_decline_competing trigger from TFV2-004)
  // ... existing logic ...

  await supabase
    .from('trades')
    .update({ status: 'in_progress', auto_complete_at: autoCompleteAt })
    .eq('id', tradeId);
}

// When seller declines (action = 'decline'):
if (action === 'decline') {
  // Release the Stripe authorization (cancel hold, free up card funds)
  await releaseAuthorization(trade.authorization_id);

  // Set trade → cancelled
  await supabase
    .from('trades')
    .update({ status: 'cancelled', cancellation_reason: 'seller_declined' })
    .eq('id', tradeId);

  // fn_release_sp_on_cancel trigger will restore buyer SP automatically
}
```

```typescript
// filepath: supabase/functions/check-authorization-expiry/index.ts
// NEW FILE — Cron job to auto-cancel offers where Stripe auth expires before seller responds

import { releaseAuthorization } from '../_shared/stripe/authorization.ts';

Deno.serve(async (req) => {
  const supabase = createClient();

  // Find all pending trades where authorization_expires_at < NOW()
  const { data: expiredTrades } = await supabase
    .from('trades')
    .select('id, authorization_id, buyer_id, seller_id')
    .eq('status', 'pending')
    .lt('authorization_expires_at', new Date().toISOString());

  for (const trade of expiredTrades ?? []) {
    // Release Stripe authorization
    await releaseAuthorization(trade.authorization_id);

    // Cancel trade
    await supabase
      .from('trades')
      .update({ status: 'cancelled', cancellation_reason: 'authorization_expired' })
      .eq('id', trade.id);

    // fn_release_sp_on_cancel trigger restores buyer SP automatically

    // Notify buyer
    await supabase.from('notifications').insert({
      user_id: trade.buyer_id,
      type:    'trade_authorization_expired',
      title:   'Offer Expired',
      message: 'Your payment method authorization expired. Please update your card and try again.',
      data:    { trade_id: trade.id },
    });
  }

  return new Response(
    JSON.stringify({ processed: expiredTrades?.length ?? 0 }),
    { status: 200 }
  );
});

// Add to pg_cron (run hourly, same as check-offer-timeouts):
// SELECT cron.schedule(
//   'check-authorization-expiry',
//   '0 * * * *',  -- every hour
//   $$SELECT net.http_post(
//     url := 'https://your-project.supabase.co/functions/v1/check-authorization-expiry',
//     headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
//   ) AS request_id;$$
// );
```

```typescript
// filepath: src/services/paymentMethodService.ts
// NEW FILE — Client-side helper to check if user has valid payment method before navigating to offer flow

import { createClient } from '@/lib/supabase';

export async function hasValidPaymentMethod(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, default_payment_method_id')
    .eq('id', userId)
    .single();

  return !!(profile?.stripe_customer_id && profile?.default_payment_method_id);
}

/**
 * Show a modal prompting the user to add a payment method.
 * Called when buyer tries to make an offer without a card on file.
 */
export function showAddPaymentMethodPrompt(navigation: any) {
  // TODO: Implement bottom-sheet modal with "Add Payment Method" CTA
  // navigation.navigate('AddPaymentMethod', { returnTo: 'TradeOfferScreen' });
}
```

### ACCEPTANCE CRITERIA

- [ ] `preAuthorizePayment()` creates Stripe PaymentIntent with `capture_method: 'manual'`
- [ ] Returns `authorizationId`, `authorizationAmount`, `expiresAt` on success
- [ ] Returns detailed error codes (`NO_PAYMENT_METHOD`, `CARD_DECLINED`, `INSUFFICIENT_FUNDS`) on failure
- [ ] `transactions-create` checks buyer pending offer count ≤ 3 before pre-auth
- [ ] `transactions-create` stores `authorization_id`, `authorization_amount`, `authorization_expires_at` on trade record
- [ ] If trade INSERT fails after Stripe pre-auth succeeds → `releaseAuthorization()` called (rollback)
- [ ] If SP hold fails after Stripe pre-auth succeeds → `releaseAuthorization()` called (rollback)
- [ ] `transactions-update` (seller accept) calls `captureAuthorization()` before moving to `payment_processing`
- [ ] If capture fails → trade → `cancelled`, buyer SP restored
- [ ] `transactions-update` (seller decline) calls `releaseAuthorization()` immediately
- [ ] `check-authorization-expiry` cron runs hourly, cancels pending trades with expired auth
- [ ] `hasValidPaymentMethod()` returns `false` if buyer has no card → show prompt modal
- [ ] All Stripe calls use `STRIPE_SECRET_KEY` from environment (no hardcoded keys)
- [ ] Buyer sees clear error if card is declined at offer time
- [ ] Authorization hold shows on buyer's card statement as "PENDING - Kids Marketplace"

**NEXT TASK: TFV2-013**

---

## TASK TFV2-013: Unified Offer Flow — Mobile Screens & submitOfferV2()

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** TFV2-012 (button routing), TFV2-012A (Stripe pre-auth — handled in Edge Function), TFV2-003 (SP reserve triggers)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/screens/trade/TradeOfferScreen.tsx` | MODIFY | Add SP slider for "use_sp" path; call submitOfferV2() (pre-auth now in Edge Function per TFV2-012A) |
| `src/screens/trade/TradeInitiationScreen.tsx` | MODIFY | Remove inline Stripe CardField; redirect all flows to TradeOfferScreen |
| `src/services/tradeServiceV2.ts` | MODIFY | Add `submitOfferV2()` — calls Edge Function which handles both Stripe pre-auth + SP hold atomically |

### Description

Decision D-01 and D-02: Unify all checkout paths into one flow where Stripe pre-authorization hold (D-30) is placed when offer is submitted, but charge is ONLY captured AFTER the seller accepts. There are two paths:
1. **Request to Buy (cash)** → `TradeOfferScreen` shows offer preview → [Submit Offer] → calls `submitOfferV2()` → Edge Function places Stripe pre-auth hold (TFV2-012A) + creates trade in `pending` state
2. **Use SP (subscriber)** → `TradeOfferScreen` shows SP slider (0–50% of item price) + updated total → [Submit Offer] → calls `submitOfferV2()` → Edge Function places Stripe pre-auth hold + SP soft-reserved (TFV2-003 trigger fires)

**Key change from original design:** Stripe pre-authorization is NOW handled server-side in the Edge Function (TFV2-012A), not client-side. This task focuses on the mobile UI and client-side service call only.

### AI Prompt for Cursor

```typescript
// filepath: src/services/tradeServiceV2.ts
// ADD to existing file

export interface SubmitOfferInput {
  listingId:       string;
  buyerId:         string;
  sellerId:        string;
  cashAmountCents: number;    // item price in cents MINUS any SP discount. Platform fee is added
                              // server-side by the Edge Function. Do NOT include fee here.
  spAmount:        number;    // SP units to use (0 for cash-only)
  bundleId?:       string;    // optional — pass from cart checkout to stamp all trades in the bundle
                              // with the same bundle_id for D-27 UX grouping (pass-through only)
}

export interface SubmitOfferResult {
  trade:           Trade;
  spReserved:      number;     // SP moved to buyer reserved_sp
  offerExpiresAt:  string;     // Set by fn_set_offer_expires_at trigger
  authorizationExpiresAt: string; // Stripe auth expiry (~7 days, from TFV2-012A Edge Function)
}

/**
 * Creates a trade offer in 'pending' status.
 * Edge Function (transactions-create) handles:
 *   - 3-offer limit validation
 *   - Stripe pre-authorization hold (TFV2-012A)
 *   - SP hold via DB trigger (TFV2-003)
 * Both Stripe auth + SP hold must succeed OR entire operation rolls back.
 */
export async function submitOfferV2(input: SubmitOfferInput): Promise<SubmitOfferResult> {
  const supabase = createClient();
  const { listingId, buyerId, sellerId, cashAmountCents, spAmount } = input;

  // Validate: buyer is not the seller
  if (buyerId === sellerId) throw new Error('Cannot buy your own item');

  // Validate: listing is still active
  const { data: listing, error: listErr } = await supabase
    .from('listings')
    .select('id, status, price')
    .eq('id', listingId)
    .single();
  if (listErr || !listing) throw new Error('Listing not found');
  if (listing.status !== 'active') throw new Error('Listing is no longer available');

  // Call Edge Function (transactions-create) — handles Stripe pre-auth + trade creation atomically
  const { data, error } = await supabase.functions.invoke('transactions-create', {
    body: {
      listingId,
      buyerId,
      sellerId,
      cashAmountCents,
      spAmount,
    },
  });

  if (error || !data?.trade) {
    // Error could be: INSUFFICIENT_FUNDS, CARD_DECLINED, NO_PAYMENT_METHOD, MAX_OFFERS_REACHED, etc.
    const message = data?.error ?? error?.message ?? 'Failed to submit offer';
    throw new Error(message);
  }

  return {
    trade:                  data.trade as Trade,
    spReserved:             spAmount,
    offerExpiresAt:         data.trade.offer_expires_at ?? '',
    authorizationExpiresAt: data.authorizationExpiresAt,
  };
}
```

```typescript
// filepath: src/screens/trade/TradeOfferScreen.tsx
// MODIFY existing component to support both cash and SP paths.
// Key changes:

// 1. Accept route param: payment_type: 'cash' | 'sp'
//    Passed from ItemDetailScreen.handleRequestToBuy / handleUseSP

// 2. If payment_type === 'sp': show SP slider
//    - Slider range: 0 to Math.floor(listing.price * 0.5)  (max 50% of price, FR-SP-003)
//    - As slider changes, update cashAmount = listing.price - spValue + platformFee
//    - Show: "$[cashAmount] cash + [spValue] SP = $[listing.price] total"
//    - Show: "Platform fee: $[fee] (always paid in cash)"

// 3. If payment_type === 'cash': show offer summary only (no slider)
//    - Show: "$[listing.price] + $[platformFee] fee"
//    - spAmount = 0

// 4. [Submit Offer] button calls submitOfferV2():
//    Edge Function handles all validation (3-offer limit, payment method check, Stripe pre-auth).
//    Client-side just displays errors clearly.
const handleSubmitOffer = async () => {
  setSubmitting(true);
  try {
    const result = await submitOfferV2({
      listingId:       listing.id,
      buyerId:         currentUserId,
      sellerId:        listing.seller_id,
      cashAmountCents: cashAmount * 100,
      spAmount:        spValue,
    });
    // Navigate to offers list to see pending offer
    navigation.navigate('TradeList', { initialTab: 'submitted' });
    showToast({ message: `Offer submitted! Seller has ${offerExpiryHours}h to respond.`, type: 'success' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not submit offer. Try again.';
    // Display friendly errors for common cases:
    // - "You have reached the maximum of 3 pending offers. Cancel one to make room."
    // - "No payment method on file. Please add a card first."
    // - "Your card was declined. Please update your payment method."
    // - "Insufficient funds. Please check your card balance."
    showToast({ message, type: 'error' });
  } finally {
    setSubmitting(false);
  }
};

// 5. TradeInitiationScreen.tsx — this screen previously collected Stripe details inline.
//    REMOVE the Stripe CardField component from this screen.
//    Payment method validation now happens server-side in the Edge Function.
//    If buyer has no payment method, Edge Function returns error → show modal prompting "Add Payment Method".
//    If TradeInitiationScreen is now redundant, consolidate into TradeOfferScreen
//    and update all navigation references.
```

### ACCEPTANCE CRITERIA

- [ ] **D-30 COMPLIANCE**: Stripe pre-authorization hold placed at offer submission (handled in Edge Function TFV2-012A)
- [ ] **D-30 COMPLIANCE**: If buyer has no payment method → Edge Function returns error → show modal prompting "Add Payment Method"
- [ ] **D-30 COMPLIANCE**: If card is declined → friendly error message displayed
- [ ] **D-30 COMPLIANCE**: If buyer has 3 pending offers → error: "You have reached the maximum of 3 pending offers. Cancel one to make room."
- [ ] Cash path: offer submitted with `spAmount = 0`
- [ ] SP path: SP slider shown (0–50% of item price), cash amount updates dynamically
- [ ] SP slider respects 50% maximum (FR-SP-003)
- [ ] DB trigger `fn_reserve_sp_on_offer` fires automatically on INSERT, reserving buyer SP (TFV2-003)
- [ ] DB trigger `fn_set_offer_expires_at` fires automatically on INSERT, setting expiry (TFV2-004)
- [ ] After submission: navigate to `TradeList` submitted offers tab
- [ ] Toast shows "Offer submitted! Seller has Nh to respond" (using config hours)
- [ ] `TradeInitiationScreen` no longer shows Stripe CardField for pre-charge
- [ ] Edge Function rollback: if Stripe auth succeeds but SP hold fails → Stripe auth released, trade not created
- [ ] Edge Function rollback: if SP hold succeeds but trade INSERT fails → Stripe auth released, SP restored

**NEXT TASK: TFV2-014**

---

## TASK TFV2-014: Completion Screen — Targeted CTAs by User Type

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** TFV2-006 (`completeTradeV2()` result), TFV2-001 (`sp_pending_release_days` config)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/screens/trade/TradeSuccessScreen.tsx` | MODIFY | Implement 7-permutation CTA logic from Section 12 |

### Description

Update `TradeSuccessScreen` to show targeted CTAs based on user type and trade context per Section 12. There are 7 permutations:

| User | Condition | Primary Message | CTA |
|---|---|---|---|
| Free buyer | Any completed trade | "Kids Club+ would've saved you $2 on this trade — try it free for 30 days." | [Try Kids Club+ Free — 30 Days] |
| Subscriber buyer | Used SP | "You saved $[sp_amount] using SP! You have [remaining_sp] SP available." | [Keep Shopping] |
| Subscriber buyer | No SP used | "Trade complete! Consider using SP on your next purchase to save more." | [Browse Items] |
| Free seller | Any completed trade | "Subscribe to earn Swap Points on your next sale." | [Try Kids Club+ Free — 30 Days] |
| Subscriber seller | Cash Only listing | "Try 'Accept SP' on your next listing to also earn SP." | [Create New Listing] |
| Subscriber seller | Accept SP, SP used | "[total_sp] SP releasing in [N] days — added to your pending wallet." | [View Wallet] |
| Subscriber seller | Accept SP, no SP by buyer | "[platform_sp] SP releasing in [N] days (platform reward)." | [View Wallet] |

### AI Prompt for Cursor

```typescript
// filepath: src/screens/trade/TradeSuccessScreen.tsx
// MODIFY the existing component. The large green CheckCircle (80px) celebration
// state must remain — only the CTA section below changes.

import { CheckCircle } from 'phosphor-react-native';

// Route params expected: { tradeId: string }
// Load trade data + buyer/seller profiles + admin config in a single useEffect.

interface CompletionCTA {
  message:   string;
  ctaLabel:  string;
  onPress:   () => void;
}

function buildCompletionCTA(
  isBuyer:           boolean,
  isSeller:          boolean,
  isSubscriber:      boolean,
  spUsedByBuyer:     number,       // trade.points_amount
  listingType:       'cash_only' | 'accept_sp' | 'donate',
  totalSpToSeller:   number,       // buyer_sp + platform_sp
  releaseDays:       number,
  remainingSP:       number,
  spAmountDollars:   number,
  navigation:        any
): CompletionCTA {
  if (isBuyer) {
    if (!isSubscriber) {
      return {
        message:  `Kids Club+ would've saved you $2 on this trade — try it free for 30 days.`,
        ctaLabel: 'Try Kids Club+ Free — 30 Days',
        onPress:  () => navigation.navigate('SubscriptionChoice'),
      };
    } else if (spUsedByBuyer > 0) {
      return {
        message:  `You saved ${spAmountDollars} using SP! You have ${remainingSP} SP available.`,
        ctaLabel: 'Keep Shopping',
        onPress:  () => navigation.navigate('Discover'),
      };
    } else {
      return {
        message:  'Trade complete! Consider using SP on your next purchase to save more.',
        ctaLabel: 'Browse Items',
        onPress:  () => navigation.navigate('Discover'),
      };
    }
  }

  if (isSeller) {
    if (!isSubscriber) {
      return {
        message:  'Subscribe to earn Swap Points on your next sale — set "Accept SP" when listing.',
        ctaLabel: 'Try Kids Club+ Free — 30 Days',
        onPress:  () => navigation.navigate('SubscriptionChoice'),
      };
    } else if (listingType === 'cash_only') {
      return {
        message:  'Sold for cash! Try "Accept SP" on your next listing to also earn SP.',
        ctaLabel: 'Create New Listing',
        onPress:  () => navigation.navigate('ItemCreate'),
      };
    } else if (spUsedByBuyer > 0) {
      return {
        message:  `${totalSpToSeller} SP releasing in ${releaseDays} days — added to your pending wallet.`,
        ctaLabel: 'View Wallet',
        onPress:  () => navigation.navigate('SpWallet'),
      };
    } else {
      const platformSp = totalSpToSeller; // no buyer SP used — all platform
      return {
        message:  `${platformSp} SP releasing in ${releaseDays} days (platform reward).`,
        ctaLabel: 'View Wallet',
        onPress:  () => navigation.navigate('SpWallet'),
      };
    }
  }

  // Fallback
  return { message: 'Trade complete!', ctaLabel: 'Done', onPress: () => navigation.goBack() };
}

// In render:
// 1. Large CheckCircle (80px, #5DBB8E) — KEEP existing
// 2. "Trade Complete! 🎉" heading
// 3. Completion CTA section (from buildCompletionCTA)
// 4. [Rate & Review] non-blocking text link below CTA button
// 5. [Done] secondary text link
```

### ACCEPTANCE CRITERIA

- [ ] All 7 CTA permutations implemented (free buyer, subscriber buyer × 2, free seller, subscriber seller × 3)
- [ ] Each permutation shows the correct message, CTA label, and navigation target
- [ ] `sp_pending_release_days` from admin config used for release countdown
- [ ] Large green `CheckCircle` (80px, #5DBB8E) celebration icon remains
- [ ] [Rate & Review] non-blocking link shown below primary CTA
- [ ] [Done] text link available on all permutations
- [ ] Buyer and seller see different CTAs (both are on this screen after receiving push)

**NEXT TASK: TFV2-015**

---

## PHASE 6: BEHAVIORAL + NOTIFICATIONS

---

## TASK TFV2-015: Seller Ignoring Offers Prompt

**Duration:** 1.5 hours  
**Priority:** Medium  
**Dependencies:** TFV2-004 (`listing_offer_stats` table, counter increments on offer expiry)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/screens/trade/TradeListScreen.tsx` | MODIFY | Show ignoring-offers modal when consecutive_unanswered_offers_count >= 2 |
| `src/screens/listing/MyListingsScreen.tsx` | MODIFY | Check and show the same prompt when seller opens their listings |
| `supabase/migrations/20260528000006_reset_unanswered_counter.sql` | CREATE | Trigger to reset counter on explicit seller accept/decline |

### Description

When a seller has 2+ consecutive unanswered offers (`consecutive_unanswered_offers_count >= 2`) on a listing, trigger the prompt per Section 11.8:

> *"You're receiving offers but not responding on [Item Title]. Unanswered offers frustrate buyers and reduce your chances of selling. Want to pause this listing until you're ready?"*
>
> [Pause Listing] [I'll Respond] [Dismiss]

The counter is reset to 0 when the seller explicitly accepts or declines an offer. The prompt is sent once per threshold crossing (tracked by `prompt_sent_at` in `listing_offer_stats`).

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000006_reset_unanswered_counter.sql

-- Reset consecutive_unanswered_offers_count when seller explicitly responds
-- (accepts → payment_processing, or declines → cancelled with non-expired reason)
CREATE OR REPLACE FUNCTION fn_reset_unanswered_counter()
RETURNS TRIGGER AS $
BEGIN
  IF NEW.status IN ('payment_processing', 'cancelled')
    AND (NEW.cancellation_reason IS DISTINCT FROM 'offer_expired')
    AND (NEW.cancellation_reason IS DISTINCT FROM 'offer_expired_competing')
  THEN
    UPDATE listing_offer_stats
    SET
      consecutive_unanswered_offers_count = 0,
      updated_at = NOW()
    WHERE seller_id = NEW.seller_id
      AND listing_id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reset_unanswered_counter ON trades;
CREATE TRIGGER trg_reset_unanswered_counter
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_reset_unanswered_counter();
```

```typescript
// filepath: src/screens/trade/TradeListScreen.tsx
// ADD to existing component — check and show prompt after trade list loads.

// 1. When seller opens the Offers tab, check listing_offer_stats for their listings:
const checkIgnoringOffersPrompt = async (sellerId: string) => {
  const { data: stats } = await supabase
    .from('listing_offer_stats')
    .select('listing_id, consecutive_unanswered_offers_count, prompt_sent_at')
    .eq('seller_id', sellerId)
    .gte('consecutive_unanswered_offers_count', 2)
    .is('prompt_sent_at', null)  // Only show once per threshold
    .limit(1)
    .single();

  if (stats) {
    // Fetch listing title for modal copy
    const { data: listing } = await supabase
      .from('listings')
      .select('title')
      .eq('id', stats.listing_id)
      .single();

    setIgnoringPrompt({ listingId: stats.listing_id, listingTitle: listing?.title ?? 'your item' });

    // Mark prompt as sent to prevent re-showing
    await supabase
      .from('listing_offer_stats')
      .update({ prompt_sent_at: new Date().toISOString() })
      .eq('seller_id', sellerId)
      .eq('listing_id', stats.listing_id);
  }
};

// 2. IgnoringOffersModal component (inline or separate file):
//    <Modal animationType="slide" transparent ...>
//      <View style={styles.bottomSheet}>
//        <Text style={styles.modalTitle}>Offers going unanswered on "{listingTitle}"</Text>
//        <Text style={styles.modalBody}>
//          Unanswered offers frustrate buyers and reduce your chances of selling.
//          Want to pause this listing until you're ready?
//        </Text>
//        <TouchableOpacity onPress={handlePauseListing} style={styles.primaryButton}>
//          <Text>Pause Listing</Text>
//        </TouchableOpacity>
//        <TouchableOpacity onPress={handleDismiss} style={styles.secondaryButton}>
//          <Text>I'll Respond</Text>
//        </TouchableOpacity>
//        <TouchableOpacity onPress={handleDismiss} style={styles.textLink}>
//          <Text>Dismiss</Text>
//        </TouchableOpacity>
//      </View>
//    </Modal>
//
//    handlePauseListing: UPDATE listings SET status='paused' WHERE id=listingId
//    handleDismiss: close modal only
```

### ACCEPTANCE CRITERIA

- [ ] `consecutive_unanswered_offers_count` increments in `listing_offer_stats` when offer expires (TFV2-004 handles this)
- [ ] Counter resets to 0 when seller accepts or explicitly declines an offer
- [ ] Modal shown once when count reaches 2 (tracked by `prompt_sent_at`)
- [ ] Modal copy matches spec: item title, pause/respond/dismiss options
- [ ] [Pause Listing] sets listing `status = 'paused'`
- [ ] [I'll Respond] and [Dismiss] close modal without action
- [ ] Modal NOT shown again for same listing after `prompt_sent_at` is set
- [ ] Modal uses Whisk bottom sheet style (20px top radius, handle pill)

**NEXT TASK: TFV2-016**

---

## TASK TFV2-016: Push Notification Schedule + Throttling

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** TFV2-001 (config timing fields), TFV2-004 (expiry cron), TFV2-005 (auto-complete cron)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/functions/send-trade-notifications/index.ts` | CREATE | Edge Function for all trade-related push notifications |
| `supabase/migrations/20260528000007_notification_log.sql` | CREATE | `trade_notification_log` table for throttling |
| `supabase/migrations/20260528000008_notification_cron.sql` | CREATE | Cron jobs for expiry + auto-complete reminder notifications |

### Description

Implement the full push notification schedule from Section 9.2 and Section 9.5, including the global throttling rule: **max 3 non-payout push notifications per user per trade**. All notifications must deep-link to the exact screen specified.

**Notification types and schedule:**

| When | Recipient | Message | Deep Link |
|---|---|---|---|
| `offer_notif_1_hours_before` before offer expiry | Seller | "⏱ Offer expiring in Xh on [Item]" | ReviewOfferScreen |
| `offer_notif_2_hours_before` before offer expiry | Seller | "Last chance — offer on [Item] expires in Xh" | ReviewOfferScreen |
| `auto_complete_notif_1_hours_before` before auto-complete | Buyer | "Your [Item] trade auto-completes in Xh. Got it? Tap 'I Got It'." | TradeTimelineScreen |
| `auto_complete_notif_2_hours_before` before auto-complete | Buyer | "[Item] trade auto-completes in Xh." | TradeTimelineScreen |
| T+6h after auto-complete fires (buyer never confirmed) | Buyer | "Did you pick up [Item]? Tap to confirm." | TradeTimelineScreen |
| Dispute filed | Seller | "A buyer has reported an issue with your trade for [Item]." | TradeTimelineScreen |
| Dispute resolved | Both | Resolution message (varies) | TradeTimelineScreen |

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000007_notification_log.sql

-- Track sent notifications for throttling (max 3 non-payout per user per trade)
CREATE TABLE IF NOT EXISTS trade_notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id        UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  notification_type TEXT NOT NULL,  -- 'offer_expiry_1', 'offer_expiry_2', 'auto_complete_1', etc.
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_id, user_id, notification_type)  -- prevent duplicate sends
);

CREATE INDEX idx_trade_notif_log_trade_user
  ON trade_notification_log(trade_id, user_id);

ALTER TABLE trade_notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON trade_notification_log
  USING (auth.role() = 'service_role');

-- Helper function: check if a notification can be sent (throttle check)
CREATE OR REPLACE FUNCTION can_send_trade_notification(
  p_trade_id UUID,
  p_user_id  UUID,
  p_type     TEXT,
  p_is_payout_related BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN AS $
DECLARE
  v_count INTEGER;
BEGIN
  -- Check if this exact notification type was already sent
  IF EXISTS (
    SELECT 1 FROM trade_notification_log
    WHERE trade_id = p_trade_id
      AND user_id  = p_user_id
      AND notification_type = p_type
  ) THEN
    RETURN FALSE;
  END IF;

  -- Skip global cap check for payout notifications
  IF p_is_payout_related THEN
    RETURN TRUE;
  END IF;

  -- Global cap: max 3 non-payout notifications per user per trade
  SELECT COUNT(*) INTO v_count
  FROM trade_notification_log
  WHERE trade_id = p_trade_id
    AND user_id  = p_user_id
    AND notification_type NOT LIKE 'payout%';

  RETURN v_count < 3;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;
```

```typescript
// filepath: supabase/functions/send-trade-notifications/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface NotificationPayload {
  trade_id:          string;
  user_id:           string;
  notification_type: string;
  title:             string;
  body:              string;
  deep_link_screen:  string;
  deep_link_params:  Record<string, string>;
  is_payout_related?: boolean;
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const payload: NotificationPayload = await req.json();
  const {
    trade_id, user_id, notification_type, title, body,
    deep_link_screen, deep_link_params, is_payout_related = false,
  } = payload;

  // Check throttle
  const { data: canSend } = await supabase
    .rpc('can_send_trade_notification', {
      p_trade_id:          trade_id,
      p_user_id:           user_id,
      p_type:              notification_type,
      p_is_payout_related: is_payout_related,
    });

  if (!canSend) {
    console.log(`[send-trade-notifications] Throttled: ${notification_type} for user ${user_id}`);
    return new Response(JSON.stringify({ sent: false, reason: 'throttled' }), { status: 200 });
  }

  // Fetch device push token
  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', user_id)
    .single();

  if (!profile?.push_token) {
    return new Response(JSON.stringify({ sent: false, reason: 'no_push_token' }), { status: 200 });
  }

  // Send push notification via Expo Push API
  // (adjust if using FCM/APNs directly)
  const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to:    profile.push_token,
      title,
      body,
      data:  { screen: deep_link_screen, params: deep_link_params, trade_id },
    }),
  });

  if (!pushResponse.ok) {
    console.error('[send-trade-notifications] Push API error:', await pushResponse.text());
    return new Response(JSON.stringify({ sent: false, reason: 'push_api_error' }), { status: 500 });
  }

  // Log sent notification (idempotency key = trade_id + user_id + type)
  await supabase.from('trade_notification_log').insert({
    trade_id,
    user_id,
    notification_type,
  });

  return new Response(JSON.stringify({ sent: true }), { status: 200 });
});
```

```sql
-- filepath: supabase/migrations/20260528000008_notification_cron.sql

-- RPC: Check and send offer expiry reminder notifications
CREATE OR REPLACE FUNCTION rpc_send_offer_expiry_notifications()
RETURNS JSONB AS $
DECLARE
  v_config RECORD;
  v_sent INTEGER := 0;
BEGIN
  SELECT offer_timeout_hours, offer_notif_1_hours_before, offer_notif_2_hours_before
  INTO v_config
  FROM admin_config LIMIT 1;

  -- First reminder (offer_notif_1_hours_before before expiry)
  INSERT INTO trade_notification_log (trade_id, user_id, notification_type)
  SELECT t.id, t.seller_id, 'offer_expiry_1'
  FROM trades t
  WHERE t.status = 'pending'
    AND t.offer_expires_at IS NOT NULL
    AND t.offer_expires_at BETWEEN NOW() + ((v_config.offer_notif_1_hours_before - 0.1) * INTERVAL '1 hour')
                               AND NOW() + (v_config.offer_notif_1_hours_before * INTERVAL '1 hour')
    AND can_send_trade_notification(t.id, t.seller_id, 'offer_expiry_1')
  ON CONFLICT (trade_id, user_id, notification_type) DO NOTHING;

  -- Second reminder (offer_notif_2_hours_before before expiry)
  INSERT INTO trade_notification_log (trade_id, user_id, notification_type)
  SELECT t.id, t.seller_id, 'offer_expiry_2'
  FROM trades t
  WHERE t.status = 'pending'
    AND t.offer_expires_at IS NOT NULL
    AND t.offer_expires_at BETWEEN NOW() + ((v_config.offer_notif_2_hours_before - 0.1) * INTERVAL '1 hour')
                               AND NOW() + (v_config.offer_notif_2_hours_before * INTERVAL '1 hour')
    AND can_send_trade_notification(t.id, t.seller_id, 'offer_expiry_2')
  ON CONFLICT (trade_id, user_id, notification_type) DO NOTHING;

  RETURN jsonb_build_object('sent', v_sent);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron: Check for notification-eligible trades every 5 minutes
SELECT cron.schedule(
  'trade-notifications',
  '*/5 * * * *',
  $
  SELECT net.http_post(
    url := current_setting('app.edge_function_base_url') || '/check-trade-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $
);
```

```typescript
// filepath: supabase/functions/check-trade-notifications/index.ts
// Batch notification checker — called by cron every 5 minutes.
// Queries all trades that are due for a notification and calls
// send-trade-notifications for each one. Handles all types:
//   offer expiry reminders, auto-complete reminders,
//   payout requires_action repeats.
// Dispute filed and dispute resolved notifications are sent immediately
// from the open-dispute and resolve-dispute Edge Functions respectively.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Fetch admin config once
  const { data: config } = await supabase
    .from('admin_config')
    .select(
      'offer_notif_1_hours_before, offer_notif_2_hours_before,' +
      'auto_complete_notif_1_hours_before, auto_complete_notif_2_hours_before'
    )
    .single();

  if (!config) {
    return new Response(JSON.stringify({ error: 'Config not found' }), { status: 500 });
  }

  const send = async (payload: object) =>
    supabase.functions.invoke('send-trade-notifications', { body: payload });

  // ── 1. Offer expiry reminders (→ seller) ───────────────────────────────────
  const { data: pendingTrades } = await supabase
    .from('trades')
    .select('id, seller_id, listing:listings(title), offer_expires_at')
    .eq('status', 'pending')
    .not('offer_expires_at', 'is', null);

  const now = Date.now();
  for (const t of pendingTrades ?? []) {
    const expiresAt    = new Date(t.offer_expires_at!).getTime();
    const hoursLeft    = (expiresAt - now) / 3_600_000;

    if (hoursLeft > 0 && Math.abs(hoursLeft - config.offer_notif_1_hours_before) < 0.1) {
      await send({
        trade_id: t.id, user_id: t.seller_id,
        notification_type: 'offer_expiry_1',
        title: '⏱ Offer expiring soon',
        body:  `Offer on "${t.listing?.title}" expires in ${config.offer_notif_1_hours_before}h. Review now.`,
        deep_link_screen: 'ReviewOfferScreen',
        deep_link_params: { tradeId: t.id },
      });
    }
    if (hoursLeft > 0 && Math.abs(hoursLeft - config.offer_notif_2_hours_before) < 0.1) {
      await send({
        trade_id: t.id, user_id: t.seller_id,
        notification_type: 'offer_expiry_2',
        title: 'Last chance to review offer',
        body:  `Offer on "${t.listing?.title}" expires in ${config.offer_notif_2_hours_before}h`,
        deep_link_screen: 'ReviewOfferScreen',
        deep_link_params: { tradeId: t.id },
      });
    }
  }

  // ── 2. Auto-complete reminders (→ buyer) ───────────────────────────────────
  const { data: inProgressTrades } = await supabase
    .from('trades')
    .select('id, buyer_id, listing:listings(title), auto_complete_at')
    .eq('status', 'in_progress')
    .eq('dispute_status', 'none')
    .not('auto_complete_at', 'is', null);

  for (const t of inProgressTrades ?? []) {
    const autoAt    = new Date(t.auto_complete_at!).getTime();
    const hoursLeft = (autoAt - now) / 3_600_000;

    if (hoursLeft > 0 && Math.abs(hoursLeft - config.auto_complete_notif_1_hours_before) < 0.1) {
      await send({
        trade_id: t.id, user_id: t.buyer_id,
        notification_type: 'auto_complete_1',
        title: 'Confirm your pickup',
        body:  `"${t.listing?.title}" auto-completes in ${config.auto_complete_notif_1_hours_before}h. Got it? Tap 'I Got It'.`,
        deep_link_screen: 'TradeTimelineScreen',
        deep_link_params: { tradeId: t.id },
      });
    }
    if (hoursLeft > 0 && Math.abs(hoursLeft - config.auto_complete_notif_2_hours_before) < 0.1) {
      await send({
        trade_id: t.id, user_id: t.buyer_id,
        notification_type: 'auto_complete_2',
        title: `"${t.listing?.title}" auto-completes soon`,
        body:  `Trade auto-completes in ${config.auto_complete_notif_2_hours_before}h`,
        deep_link_screen: 'TradeTimelineScreen',
        deep_link_params: { tradeId: t.id },
      });
    }
  }

  // ── 3. Payout requires_action repeats (→ seller, every 48h, max 3 total) ──
  // Notification 1 is sent immediately by initiate-payout when requires_action is set.
  // This cron sends notifications 2 and 3 at 48h and 96h after completion.
  const { data: requiresActionTrades } = await supabase
    .from('trades')
    .select('id, seller_id, listing:listings(title), cash_amount, platform_fee_cash, completed_at')
    .eq('payout_status', 'requires_action');

  for (const t of requiresActionTrades ?? []) {
    const completedAt          = new Date(t.completed_at!).getTime();
    const hoursSinceCompletion = (now - completedAt) / 3_600_000;
    const intervalIndex        = Math.floor(hoursSinceCompletion / 48);

    // Only send notifications 2 and 3 (notification 1 is sent by initiate-payout)
    if (intervalIndex >= 2 && intervalIndex <= 3) {
      const notifType    = `payout_requires_action_${intervalIndex}` as const;
      const sellerAmount = ((t.cash_amount ?? 0) - (t.platform_fee_cash ?? 0)).toFixed(2);
      await send({
        trade_id: t.id, user_id: t.seller_id,
        notification_type: notifType,
        title: 'Add a payout method',
        body:  `Your "${t.listing?.title}" sold! Add a payout method to receive $${sellerAmount}.`,
        deep_link_screen: 'PayoutSetup',
        deep_link_params: { tradeId: t.id },
        is_payout_related: true,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

### ACCEPTANCE CRITERIA

- [ ] `trade_notification_log` table created with UNIQUE constraint on `(trade_id, user_id, notification_type)`
- [ ] `can_send_trade_notification()` enforces max 3 non-payout notifications per user per trade
- [ ] Each notification type can only be sent once per trade (UNIQUE constraint + early-exit check)
- [ ] `send-trade-notifications` Edge Function checks throttle before sending
- [ ] Notification payload includes `trade_id` and target screen for deep linking
- [ ] Payout-related notifications bypass the 3-notification global cap
- [ ] Offer expiry reminders sent at config-specified times before expiry
- [ ] Auto-complete reminders sent at config-specified times before auto-complete
- [ ] All notifications deep-link to exact screen (ReviewOfferScreen or TradeTimelineScreen)
- [ ] No duplicate sends: idempotent on retry
- [ ] **`check-trade-notifications` Edge Function implemented and registered in cron** — fan-out checker for offer expiry, auto-complete, and payout repeat reminders
- [ ] **Payout notifications 2 and 3 sent by `check-trade-notifications` at 48h and 96h after completion**

**NEXT TASK: TFV2-017**

---

## PHASE 7: DISPUTE + PAYOUT + INSTRUMENTATION

---

## TASK TFV2-017: Dispute State Machine + Admin Dashboard Queue

**Duration:** 4 hours  
**Priority:** High  
**Dependencies:** TFV2-002 (dispute columns), TFV2-005 (cron guards), TFV2-011 (Report a Problem modal)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/functions/resolve-dispute/index.ts` | CREATE | Edge Function for admin dispute resolution actions |
| `p2p-kids-admin/src/app/disputes/page.tsx` | CREATE | Admin dispute queue UI |
| `p2p-kids-admin/src/app/disputes/[tradeId]/page.tsx` | CREATE | Per-dispute admin resolution page |

### Description

Implement the dispute system per Section 6.2 of TRADING-FLOW-V2.md. Decision D-26 is critical: disputes are an **overlay** on the existing state machine, NOT new top-level states. The two columns `dispute_status` and `dispute_resolution` on the `trades` table are the full mechanism.

**Admin actions:**
- **[Mark Under Review]**: `dispute_status = 'under_review'`
- **[Resolve → Complete]**: `dispute_status = 'resolved'`, `dispute_resolution = 'completed'`, then `completeTradeV2()` fires normally
- **[Resolve → Refund]**: `dispute_status = 'resolved'`, `dispute_resolution = 'refunded'`, Stripe refund issued, buyer reserved_sp restored, item relisted, trade cancelled

**Cron guards** (already added in TFV2-005): `process_auto_complete` and `release_pending_sp` skip trades with `dispute_status IN ('reported', 'under_review')`.

### AI Prompt for Cursor

```typescript
// filepath: supabase/functions/resolve-dispute/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type ResolutionAction = 'mark_under_review' | 'resolve_complete' | 'resolve_refund';

interface RequestBody {
  trade_id: string;
  action:   ResolutionAction;
}

Deno.serve(async (req: Request) => {
  // This function requires admin auth — validate via service role or admin JWT claim
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Verify caller is an admin (check admin_users table or JWT role claim)
  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  // TODO: Verify user has admin role in your admin_users table
  // const { data: adminRecord } = await adminSupabase.from('admin_users').select('id').eq('user_id', user.id).single();
  // if (!adminRecord) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const body: RequestBody = await req.json();
  const { trade_id, action } = body;

  // Fetch the trade
  const { data: trade } = await adminSupabase
    .from('trades')
    .select('id, status, buyer_id, seller_id, listing_id, points_amount, dispute_status')
    .eq('id', trade_id)
    .single();

  if (!trade) return new Response(JSON.stringify({ error: 'Trade not found' }), { status: 404 });

  if (action === 'mark_under_review') {
    await adminSupabase.from('trades').update({
      dispute_status:  'under_review',
      dispute_resolved_by: user.id,
    }).eq('id', trade_id);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  if (action === 'resolve_complete') {
    // Complete the trade — fn_release_all_sp_on_complete fires automatically
    await adminSupabase.from('trades').update({
      dispute_status:     'resolved',
      dispute_resolution: 'completed',
      dispute_resolved_at: new Date().toISOString(),
      dispute_resolved_by: user.id,
      status:             'completed',
      completed_at:       new Date().toISOString(),
    }).eq('id', trade_id);
    return new Response(JSON.stringify({ success: true, resolution: 'completed' }), { status: 200 });
  }

  if (action === 'resolve_refund') {
    // Cancel the trade — fn_release_sp_on_cancel fires automatically
    await adminSupabase.from('trades').update({
      dispute_status:     'resolved',
      dispute_resolution: 'refunded',
      dispute_resolved_at: new Date().toISOString(),
      dispute_resolved_by: user.id,
      status:              'cancelled',
      cancellation_reason: 'dispute_refunded',
    }).eq('id', trade_id);

    // Issue Stripe refund (authorization was captured when seller accepted)
    if (trade.authorization_id) {
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
        apiVersion: '2023-10-16' as const,
      });
      await stripe.refunds.create({
        payment_intent: trade.authorization_id,
      });
    }

    // Relist the item so it can be sold again
    await adminSupabase
      .from('listings')
      .update({ status: 'active' })
      .eq('id', trade.listing_id);

    // Notify buyer and seller of resolution
    await adminSupabase.functions.invoke('send-trade-notifications', {
      body: {
        trade_id, user_id: trade.buyer_id,
        notification_type: 'dispute_resolved_refund',
        title: 'Issue resolved — refund issued',
        body: 'Your dispute has been reviewed. A refund has been issued to your payment method.',
        deep_link_screen: 'TradeTimelineScreen',
        deep_link_params: { tradeId: trade_id },
      },
    });
    await adminSupabase.functions.invoke('send-trade-notifications', {
      body: {
        trade_id, user_id: trade.seller_id,
        notification_type: 'dispute_resolved_relisted',
        title: 'Issue resolved — item relisted',
        body: 'Your trade dispute has been reviewed. The item has been relisted for sale.',
        deep_link_screen: 'TradeTimelineScreen',
        deep_link_params: { tradeId: trade_id },
      },
    });

    return new Response(JSON.stringify({ success: true, resolution: 'refunded' }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
});
```

```typescript
// filepath: p2p-kids-admin/src/app/disputes/page.tsx
// Dispute queue page — follows existing admin page patterns
// Show all trades with dispute_status IN ('reported', 'under_review')
//
// Columns: Trade ID (link) | Buyer | Seller | Item | Dispute Reason |
//          Reported At (age in hours) | Status | Actions
//
// Filters: [All Disputed] [Reported] [Under Review]
// SLA indicator: show age in hours; highlight red if >24h
//
// Row actions:
//   - [View] -> /disputes/[tradeId]
//   - [Mark Under Review] (if status = 'reported')
//
// Fetch query:
// SELECT t.*, l.title as listing_title, buyer.full_name as buyer_name, seller.full_name as seller_name
// FROM trades t
// JOIN listings l ON l.id = t.listing_id
// JOIN profiles buyer ON buyer.id = t.buyer_id
// JOIN profiles seller ON seller.id = t.seller_id
// WHERE t.dispute_status IN ('reported', 'under_review')
// ORDER BY t.dispute_reported_at ASC  (oldest first = highest priority)
```

```typescript
// filepath: p2p-kids-admin/src/app/disputes/[tradeId]/page.tsx
// Per-dispute detail page
//
// Sections:
// 1. Trade summary (item, buyer, seller, amounts, status)
// 2. Dispute details (reason, reported_at, status)
// 3. Message history between buyer and seller (read-only)
// 4. Admin actions:
//    - [Mark Under Review] button (if dispute_status = 'reported')
//    - [Resolve → Complete] button (green) — calls resolve-dispute Edge Function
//    - [Resolve → Refund] button (red, requires confirmation modal)
//       Confirmation copy: "This will refund the buyer $[amount] and cancel the trade.
//       This cannot be undone. Are you sure?"
```

### ACCEPTANCE CRITERIA

- [ ] `resolve-dispute` Edge Function handles all 3 actions: `mark_under_review`, `resolve_complete`, `resolve_refund`
- [ ] `resolve_complete` sets `dispute_status = 'resolved'`, `dispute_resolution = 'completed'`, `status = 'completed'`
- [ ] Setting `status = 'completed'` fires `fn_release_all_sp_on_complete` automatically
- [ ] `resolve_refund` sets `dispute_status = 'resolved'`, `dispute_resolution = 'refunded'`, `status = 'cancelled'`
- [ ] Setting `status = 'cancelled'` fires `fn_release_sp_on_cancel` automatically (buyer SP restored)
- [ ] Admin dispute queue shows all `reported` and `under_review` trades
- [ ] Queue sorted by `dispute_reported_at ASC` (oldest = highest priority)
- [ ] SLA age shown in hours; > 24h highlighted
- [ ] Per-dispute page has [Mark Under Review], [Resolve → Complete], [Resolve → Refund] actions
- [ ] [Resolve → Refund] requires a confirmation modal before executing
- [ ] Cron guards from TFV2-005 already prevent auto-complete/SP-release on disputed trades

**NEXT TASK: TFV2-018**

---

## TASK TFV2-018: Seller Payout Integration

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** TFV2-002 (payout columns), TFV2-006 (`completeTradeV2`), TFV2-017 (dispute guard)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/functions/initiate-payout/index.ts` | CREATE | Edge Function for triggering seller payout after trade completion |
| `supabase/migrations/20260528000009_payout_trigger.sql` | CREATE | DB trigger to queue payout on trade completion |
| `p2p-kids-admin/src/app/payouts/page.tsx` | MODIFY | Add `requires_action` filter column to existing payouts page |

### Description

Implement payout triggering per Section 6.3 of TRADING-FLOW-V2.md:

- Payout is triggered when `trade.status → completed` AND `dispute_status = 'none'`
- If `dispute_status` is `reported` or `under_review`: payout is held until admin resolves
- If seller has no verified payout method: `payout_status = 'requires_action'` — trade completes normally, SP releases, but cash held
- Every payout uses `payout_idempotency_key = 'payout_' || trade_id` to prevent double-payout
- `requires_action` payouts send a repeat notification every 48h (max 3 times) until resolved

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000009_payout_trigger.sql

-- Trigger: Queue payout on trade completion (when no active dispute)
CREATE OR REPLACE FUNCTION fn_queue_payout_on_complete()
RETURNS TRIGGER AS $
BEGIN
  -- Only queue if no active dispute (D-26 guard)
  IF NEW.dispute_status NOT IN ('reported', 'under_review') THEN
    -- Set idempotency key
    UPDATE trades
    SET payout_idempotency_key = 'payout_' || NEW.id::text
    WHERE id = NEW.id AND payout_idempotency_key IS NULL;

    -- Invoke payout Edge Function asynchronously
    PERFORM net.http_post(
      url     := current_setting('app.edge_function_base_url') || '/initiate-payout',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := jsonb_build_object('trade_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_queue_payout_on_complete ON trades;
CREATE TRIGGER trg_queue_payout_on_complete
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION fn_queue_payout_on_complete();
```

```typescript
// filepath: supabase/functions/initiate-payout/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
// import Stripe from 'npm:stripe@^14';

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { trade_id } = await req.json();

  // Fetch trade with seller details
  const { data: trade } = await supabase
    .from('trades')
    .select(`
      id, status, dispute_status, payout_status, payout_idempotency_key,
      cash_amount, platform_fee_cash, seller_id
    `)
    .eq('id', trade_id)
    .single();

  if (!trade || trade.status !== 'completed') {
    return new Response(JSON.stringify({ error: 'Trade not ready for payout' }), { status: 422 });
  }

  // Block if active dispute (safety check)
  if (trade.dispute_status === 'reported' || trade.dispute_status === 'under_review') {
    return new Response(JSON.stringify({ error: 'Payout blocked by active dispute' }), { status: 422 });
  }

  // Check if seller has a verified Stripe Connect account
  const { data: sellerPayoutMethod } = await supabase
    .from('seller_payout_methods')
    .select('stripe_account_id, verified')
    .eq('user_id', trade.seller_id)
    .eq('verified', true)
    .single();

  if (!sellerPayoutMethod) {
    // No verified payout method — set requires_action
    await supabase
      .from('trades')
      .update({ payout_status: 'requires_action' })
      .eq('id', trade_id);

    // Send first requires_action notification to seller immediately
    await supabase.functions.invoke('send-trade-notifications', {
      body: {
        trade_id,
        user_id: trade.seller_id,
        notification_type: 'payout_requires_action_1',
        title: 'Add a payout method',
        body: 'Your item sold! Add a payout method to receive your earnings.',
        deep_link_screen: 'PayoutSetup',
        deep_link_params: { tradeId: trade_id },
        is_payout_related: true,
      },
    });
    // Repeat notifications at 48h intervals (max 3 total) handled by check-trade-notifications cron (TFV2-016).

    console.log(`[initiate-payout] Trade ${trade_id}: requires_action (no payout method)`);
    return new Response(JSON.stringify({ status: 'requires_action' }), { status: 200 });
  }

  // Calculate seller payout amount (item price - platform fee)
  const payoutAmountCents = Math.round(
    (trade.cash_amount - (trade.platform_fee_cash ?? 0)) * 100
  );

  if (payoutAmountCents <= 0) {
    console.warn(`[initiate-payout] Payout amount is zero for trade ${trade_id} — skipping`);
    return new Response(JSON.stringify({ status: 'skipped', reason: 'zero_amount' }), { status: 200 });
  }

  try {
    // TODO: Implement Stripe Transfer using payout_idempotency_key
    // const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '');
    // await stripe.transfers.create({
    //   amount:               payoutAmountCents,
    //   currency:             'usd',
    //   destination:          sellerPayoutMethod.stripe_account_id,
    //   transfer_group:       trade_id,
    // }, { idempotencyKey: trade.payout_idempotency_key ?? ('payout_' + trade_id) });

    // Update payout status
    await supabase
      .from('trades')
      .update({
        payout_status:       'processing',
        payout_initiated_at: new Date().toISOString(),
      })
      .eq('id', trade_id);

    console.log(`[initiate-payout] Trade ${trade_id}: payout initiated`);
    return new Response(JSON.stringify({ status: 'processing' }), { status: 200 });

  } catch (err) {
    console.error('[initiate-payout] Stripe error:', err);
    await supabase.from('trades').update({ payout_status: 'failed' }).eq('id', trade_id);
    return new Response(JSON.stringify({ error: 'Stripe transfer failed' }), { status: 500 });
  }
});
```

### ACCEPTANCE CRITERIA

- [ ] `fn_queue_payout_on_complete` trigger fires when `status → completed` with no active dispute
- [ ] Trigger does NOT fire when `dispute_status IN ('reported', 'under_review')` (held for admin resolution)
- [ ] After admin resolves dispute as Complete: trigger fires on the `status → completed` update
- [ ] `payout_idempotency_key = 'payout_' || trade_id` set before Stripe call (prevents double-payout)
- [ ] Seller with no payout method gets `payout_status = 'requires_action'` with seller notification
- [ ] **First `payout_requires_action_1` notification sent immediately via `send-trade-notifications`**
- [ ] **Repeat notifications at 48h intervals (max 3 total) handled by `check-trade-notifications` cron (TFV2-016)**
- [ ] After seller adds payout method: system retries using existing `payout_idempotency_key`
- [ ] Payout Edge Function verifies trade status before proceeding
- [ ] `payout_status` transitions: `pending` → `processing` → `paid` / `failed`
- [ ] Admin payouts page shows `requires_action` column/filter

**NEXT TASK: TFV2-019**

---

## TASK TFV2-019: Event Instrumentation — `trade_events` Table

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** All previous tasks (events fire from triggers, crons, Edge Functions)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260528000010_trade_events.sql` | CREATE | `trade_events` append-only table + insert helper function |
| `supabase/functions/send-trade-notifications/index.ts` | MODIFY | Log event on notification send |

### Description

Create the `trade_events` table per Section 16 of TRADING-FLOW-V2.md. All 16 events must be logged server-side. Requirements:
1. Insert-only (append log) — never update or delete
2. No PII in `metadata` (no names, emails, payment card details)
3. Idempotency: `(trade_id, event_name)` unique for cron-triggered events (use ON CONFLICT DO NOTHING)
4. RLS: read access limited to service role and admin role only

All 16 events from Section 16.1 must be wired into the relevant triggers and Edge Functions created in TFV2-003 through TFV2-018.

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000010_trade_events.sql

-- ============================================================
-- TRADE EVENTS TABLE (Section 16)
-- Insert-only append log. No PII in metadata.
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id   UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  user_id    UUID REFERENCES auth.users(id),  -- actor (null for system events)
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trade_events_trade_id    ON trade_events(trade_id);
CREATE INDEX idx_trade_events_event_name  ON trade_events(event_name);
CREATE INDEX idx_trade_events_created_at  ON trade_events(created_at DESC);

-- Partial unique index for idempotency on cron-triggered events
-- (prevents double-logging when cron retries)
CREATE UNIQUE INDEX idx_trade_events_cron_idempotency
  ON trade_events(trade_id, event_name)
  WHERE event_name IN ('offer_expired', 'auto_completed', 'sp_released_to_seller', 'sp_restored_to_buyer');

ALTER TABLE trade_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON trade_events
  USING (auth.role() = 'service_role');

-- Admin role read access (adjust role name to match your admin setup)
CREATE POLICY "Admin role read" ON trade_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- HELPER: log_trade_event()
-- Call this from all triggers and Edge Functions.
-- ============================================================
CREATE OR REPLACE FUNCTION log_trade_event(
  p_trade_id   UUID,
  p_event_name TEXT,
  p_user_id    UUID DEFAULT NULL,
  p_metadata   JSONB DEFAULT '{}'
)
RETURNS VOID AS $
BEGIN
  INSERT INTO trade_events (trade_id, event_name, user_id, metadata)
  VALUES (p_trade_id, p_event_name, p_user_id, p_metadata)
  ON CONFLICT DO NOTHING;  -- idempotency for cron events
EXCEPTION WHEN OTHERS THEN
  -- Never let event logging break the primary operation
  RAISE WARNING 'log_trade_event failed for trade % event %: %', p_trade_id, p_event_name, SQLERRM;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- EVENT WIRING: Add log_trade_event() calls to existing triggers and Edge Functions.
-- Each section below shows the EXACT call to add and WHERE to add it.
-- All calls are PERFORM (not SELECT) inside PL/pgSQL, or await in TypeScript.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TRIGGER: fn_reserve_sp_on_offer (TFV2-003 migration)
-- WHERE:   Add BEFORE the final RETURN NEW; inside the IF NEW.points_amount > 0 block.
-- ────────────────────────────────────────────────────────────
-- PERFORM log_trade_event(
--   NEW.id,
--   'sp_reserved',
--   NEW.buyer_id,
--   jsonb_build_object('sp_amount', NEW.points_amount)
-- );

-- Inline version (copy into fn_reserve_sp_on_offer before RETURN NEW):
/*
  IF NEW.points_amount > 0 THEN
    -- existing UPDATE sp_wallets ... --
    PERFORM log_trade_event(
      NEW.id, 'sp_reserved', NEW.buyer_id,
      jsonb_build_object('sp_amount', NEW.points_amount)
    );
  END IF;
*/

-- ────────────────────────────────────────────────────────────
-- TRIGGER: fn_release_sp_on_cancel (TFV2-003 migration)
-- WHERE:   Add AFTER the UPDATE sp_wallets inside the IF NEW.points_amount > 0 block.
-- ────────────────────────────────────────────────────────────
/*
  IF COALESCE(NEW.points_amount, 0) > 0 THEN
    -- existing UPDATE sp_wallets ... --
    PERFORM log_trade_event(
      NEW.id, 'sp_restored_to_buyer', NEW.buyer_id,
      jsonb_build_object('sp_amount', NEW.points_amount)
    );
  END IF;
*/

-- Also log seller_cancelled when a seller cancels (set actor = cancelledByUserId):
-- This event is logged from cancelTradeV2 service function or cancel-trade Edge Function.
-- TypeScript (add to cancelTradeV2 after status update):
/*
  await supabase.rpc('log_trade_event', {
    p_trade_id:   tradeId,
    p_event_name: 'seller_cancelled',
    p_user_id:    cancelledByUserId,
    p_metadata:   { reason },
  });
*/

-- ────────────────────────────────────────────────────────────
-- TRIGGER: fn_release_all_sp_on_complete (TFV2-003 migration, updated above)
-- WHERE:   Add AFTER the sp_earned_at_completion UPDATE and BEFORE the sp_wallets UPDATEs.
-- ────────────────────────────────────────────────────────────
/*
  UPDATE trades SET sp_earned_at_completion = v_total_sp WHERE id = NEW.id;

  -- Log SP release event (add this line here):
  PERFORM log_trade_event(
    NEW.id, 'sp_released_to_seller', NEW.seller_id,
    jsonb_build_object(
      'buyer_sp_released',  COALESCE(NEW.points_amount, 0),
      'platform_sp_granted', v_platform_sp,
      'total_sp_to_seller',  v_total_sp,
      'seller_was_subscriber', v_seller_is_subscriber,
      'listing_pref',          v_listing_pref
    )
  );
*/

-- ────────────────────────────────────────────────────────────
-- RPC: rpc_process_expired_offers (TFV2-004 migration)
-- WHERE:   Inside the loop, after setting status = 'cancelled'.
-- ────────────────────────────────────────────────────────────
/*
  FOR expired_id IN SELECT id FROM v_expired_ids LOOP
    -- existing cancellation UPDATE ... --
    PERFORM log_trade_event(
      expired_id, 'offer_expired', NULL,
      jsonb_build_object(
        'expired_at', NOW(),
        'offer_timeout_hours', v_timeout_hours
      )
    );
  END LOOP;
*/

-- ────────────────────────────────────────────────────────────
-- RPC: rpc_process_auto_complete (TFV2-005 migration)
-- WHERE:   Inside the loop, after setting status = 'completed'.
-- ────────────────────────────────────────────────────────────
/*
  FOR auto_id IN SELECT id FROM v_auto_ids LOOP
    -- existing completion UPDATE ... --
    PERFORM log_trade_event(
      auto_id, 'auto_completed', NULL,
      jsonb_build_object('auto_completed_at', NOW())
    );
  END LOOP;
*/

-- ────────────────────────────────────────────────────────────
-- EDGE FUNCTION: transactions-create (TFV2-012A)
-- WHERE:   After successful trade INSERT, before returning 200.
-- ────────────────────────────────────────────────────────────
-- TypeScript (add to transactions-create/index.ts after trade INSERT):
/*
  await adminSupabase.rpc('log_trade_event', {
    p_trade_id:   trade.id,
    p_event_name: 'offer_submitted',
    p_user_id:    buyerId,
    p_metadata:   {
      cash_amount_cents:       cashAmountCents,
      sp_amount:               spAmount,
      total_authorization_cents: totalAuthorizationCents,
    },
  });
*/

-- ────────────────────────────────────────────────────────────
-- EDGE FUNCTION: transactions-update / seller Accept action (TFV2-007)
-- WHERE:   After status → payment_processing UPDATE.
-- ────────────────────────────────────────────────────────────
-- TypeScript (add to transactions-update/index.ts for 'accept' action):
/*
  // offer_accepted: Stripe charge is captured at this point
  await adminSupabase.rpc('log_trade_event', {
    p_trade_id:   trade_id,
    p_event_name: 'offer_accepted',
    p_user_id:    sellerId,
    p_metadata:   { authorization_id: trade.authorization_id },
  });
  // payment_succeeded: log alongside offer_accepted (charge captured synchronously)
  await adminSupabase.rpc('log_trade_event', {
    p_trade_id:   trade_id,
    p_event_name: 'payment_succeeded',
    p_user_id:    null,   // system event
    p_metadata:   { authorization_id: trade.authorization_id },
  });
*/

-- ────────────────────────────────────────────────────────────
-- EDGE FUNCTION: transactions-update / seller Decline action (TFV2-007)
-- WHERE:   After status → cancelled UPDATE.
-- ────────────────────────────────────────────────────────────
-- TypeScript (add to transactions-update/index.ts for 'decline' action):
/*
  await adminSupabase.rpc('log_trade_event', {
    p_trade_id:   trade_id,
    p_event_name: 'offer_declined',
    p_user_id:    sellerId,
    p_metadata:   { reason: 'seller_declined' },
  });
*/

-- ────────────────────────────────────────────────────────────
-- EDGE FUNCTION: complete-trade (TFV2-006)
-- WHERE:   After successful trade status → completed UPDATE.
-- ────────────────────────────────────────────────────────────
-- TypeScript (add to complete-trade/index.ts):
/*
  await supabase.rpc('log_trade_event', {
    p_trade_id:   trade_id,
    p_event_name: 'buyer_confirmed',
    p_user_id:    userId,   // authenticated buyer
    p_metadata:   { confirmed_at: new Date().toISOString() },
  });
*/

-- ────────────────────────────────────────────────────────────
-- EDGE FUNCTION: open-dispute (TFV2-011)
-- WHERE:   After successful dispute_status → reported UPDATE.
-- ────────────────────────────────────────────────────────────
-- TypeScript (add to open-dispute/index.ts):
/*
  await adminSupabase.rpc('log_trade_event', {
    p_trade_id:   trade_id,
    p_event_name: 'issue_reported',
    p_user_id:    user.id,
    p_metadata:   { reason },   // no 'details' — may contain PII
  });
*/

-- ────────────────────────────────────────────────────────────
-- EDGE FUNCTION: resolve-dispute (TFV2-017)
-- WHERE:   After successful resolution UPDATE, inside the action branch.
-- ────────────────────────────────────────────────────────────
-- TypeScript (add to resolve-dispute/index.ts for both actions):
/*
  await adminSupabase.rpc('log_trade_event', {
    p_trade_id:   trade_id,
    p_event_name: 'dispute_resolved',
    p_user_id:    user.id,   // admin who resolved
    p_metadata:   { resolution: action === 'resolve_refund' ? 'refunded' : 'completed' },
  });
*/

-- ────────────────────────────────────────────────────────────
-- EDGE FUNCTION: initiate-payout (TFV2-018)
-- WHERE:   After each payout_status update.
-- ────────────────────────────────────────────────────────────
-- TypeScript (add to initiate-payout/index.ts):
/*
  // When payout_status → requires_action:
  await supabase.rpc('log_trade_event', {
    p_trade_id:   trade_id,
    p_event_name: 'payout_requires_action',
    p_user_id:    null,
    p_metadata:   {},
  });

  // When Stripe transfer succeeds (payout_status → processing):
  await supabase.rpc('log_trade_event', {
    p_trade_id:   trade_id,
    p_event_name: 'payout_initiated',
    p_user_id:    null,
    p_metadata:   { payout_amount_cents: payoutAmountCents },
  });
*/

-- ────────────────────────────────────────────────────────────
-- STRIPE WEBHOOK HANDLER (separate Edge Function: stripe-webhook)
-- payment_failed is logged here if Stripe capture fails.
-- ────────────────────────────────────────────────────────────
-- TypeScript (add to stripe-webhook/index.ts for payment_intent.payment_failed):
/*
  await adminSupabase.rpc('log_trade_event', {
    p_trade_id:   trade_id,
    p_event_name: 'payment_failed',
    p_user_id:    null,
    p_metadata:   { stripe_error_code: event.data.object.last_payment_error?.code },
  });
*/
-- Add stripe-webhook to the files table:
-- | `supabase/functions/stripe-webhook/index.ts` | CREATE | Handle payment_intent events; log payment_succeeded, payment_failed |
```

### ACCEPTANCE CRITERIA

- [ ] `trade_events` table created with append-only intent and no UPDATE/DELETE in any code path
- [ ] Partial unique index prevents double-logging for the 4 cron-triggered events
- [ ] `log_trade_event()` helper swallows errors silently (never breaks primary operation)
- [ ] RLS: only service role and admin role can read events
- [ ] No PII in `metadata` (no names, emails, card numbers, free-text user input)
- [ ] **`offer_submitted` logged in `transactions-create` Edge Function after trade INSERT**
- [ ] **`sp_reserved` logged in `fn_reserve_sp_on_offer` trigger after SP wallet update**
- [ ] **`offer_accepted` + `payment_succeeded` logged in seller Accept flow (transactions-update)**
- [ ] **`offer_declined` logged in seller Decline flow (transactions-update)**
- [ ] **`offer_expired` logged in `rpc_process_expired_offers` inside loop**
- [ ] **`seller_cancelled` logged in `cancelTradeV2` / cancel-trade Edge Function**
- [ ] **`buyer_confirmed` logged in `complete-trade` Edge Function**
- [ ] **`auto_completed` logged in `rpc_process_auto_complete` inside loop**
- [ ] **`sp_released_to_seller` logged in `fn_release_all_sp_on_complete` trigger (after snapshot)**
- [ ] **`sp_restored_to_buyer` logged in `fn_release_sp_on_cancel` trigger**
- [ ] **`issue_reported` logged in `open-dispute` Edge Function**
- [ ] **`dispute_resolved` logged in `resolve-dispute` Edge Function**
- [ ] **`payout_requires_action` logged in `initiate-payout` when requires_action set**
- [ ] **`payout_initiated` logged in `initiate-payout` when Stripe transfer initiated**
- [ ] **`payment_failed` logged in `stripe-webhook` Edge Function on `payment_intent.payment_failed`**
- [ ] All 16 events from Section 16.1 of TRADING-FLOW-V2.md have concrete wiring (no comment-only stubs)
- [ ] `trade_id` + `event_name` combo is queryable for analytics

**NEXT TASK: TFV2-020**

---

## PHASE 8: UX HELPERS + CART

---

## TASK TFV2-020: Safe Meetup V1-Lite Card

**Duration:** 1.5 hours  
**Priority:** Medium  
**Dependencies:** TFV2-011 (TradeTimelineScreen placeholder hook)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/components/trade/SafeMeetupCard.tsx` | CREATE | Dismissible safety guidance card per Section 11.5 |
| `src/components/trade/index.ts` | MODIFY | Export new component |

### Description

Create the Safe Meetup V1-Lite card per Section 11.5 of TRADING-FLOW-V2.md. Static, dismissible, shown on `TradeTimelineScreen` when `trade.status = 'in_progress'`. Visible to BOTH buyer and seller. Dismissed state stored in `AsyncStorage` keyed by `trade_id` (NOT globally per user — each trade has its own dismissal).

**Dismissed state**: Shows compact `"🛡️ Meeting safely? [Tips]"` link that re-expands the card.

**V1 copy (locked per TODO-06):**
> *"For your safety, choose a busy public spot — library entrance, coffee shop, or police station lobby. Never meet at a private address."*

**Full card bullet points:**
- Library entrance or lobby
- Coffee shop or food court
- Police station lobby (safest option)
- Bank lobby or ATM vestibule

### AI Prompt for Cursor

```typescript
// filepath: src/components/trade/SafeMeetupCard.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShieldCheck, CheckCircle } from 'phosphor-react-native';

const MEETUP_TIPS = [
  'Library entrance or lobby',
  'Coffee shop or food court',
  'Police station lobby (safest option)',
  'Bank lobby or ATM vestibule',
];

interface Props {
  tradeId: string;
}

type CardState = 'loading' | 'expanded' | 'collapsed';

function getStorageKey(tradeId: string) {
  return `safe_meetup_dismissed_${tradeId}`;
}

export function SafeMeetupCard({ tradeId }: Props) {
  const [cardState, setCardState] = useState<CardState>('loading');

  useEffect(() => {
    AsyncStorage.getItem(getStorageKey(tradeId)).then(value => {
      setCardState(value === 'dismissed' ? 'collapsed' : 'expanded');
    });
  }, [tradeId]);

  const handleDismiss = async () => {
    await AsyncStorage.setItem(getStorageKey(tradeId), 'dismissed');
    setCardState('collapsed');
  };

  const handleExpand = () => setCardState('expanded');

  if (cardState === 'loading') return null;

  if (cardState === 'collapsed') {
    return (
      <TouchableOpacity
        style={styles.collapsedRow}
        onPress={handleExpand}
        accessibilityRole="button"
        accessibilityLabel="Show safe meetup tips"
      >
        <ShieldCheck size={14} color="#5DBB8E" weight="fill" />
        <Text style={styles.collapsedText}> Meeting safely? </Text>
        <Text style={styles.collapsedLink}>Tips</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ShieldCheck size={18} color="#5DBB8E" weight="fill" />
        <Text style={styles.cardTitle}> Stay Safe — Choose a Public Meetup Spot</Text>
      </View>

      <Text style={styles.cardSubtitle}>Meet somewhere busy and well-lit:</Text>

      {MEETUP_TIPS.map(tip => (
        <View key={tip} style={styles.tipRow}>
          <CheckCircle size={14} color="#5DBB8E" weight="fill" style={styles.tipIcon} />
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ))}

      <Text style={styles.warningText}>
        Avoid private addresses for first-time meetups.
      </Text>

      <TouchableOpacity
        style={styles.gotItButton}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Got it, dismiss safety tips"
      >
        <Text style={styles.gotItLabel}>Got it ✓</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'Inter-SemiBold',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B6B6B',
    marginBottom: 6,
    fontFamily: 'Inter-Regular',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tipIcon: {
    marginRight: 6,
  },
  tipText: {
    fontSize: 13,
    color: '#1A1A1A',
    fontFamily: 'Inter-Regular',
  },
  warningText: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 8,
    fontStyle: 'italic',
    fontFamily: 'Inter-Regular',
  },
  gotItButton: {
    alignSelf: 'flex-end',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  gotItLabel: {
    fontSize: 13,
    color: '#5DBB8E',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  collapsedText: {
    fontSize: 12,
    color: '#6B6B6B',
    fontFamily: 'Inter-Regular',
  },
  collapsedLink: {
    fontSize: 12,
    color: '#5DBB8E',
    fontWeight: '600',
    textDecorationLine: 'underline',
    fontFamily: 'Inter-SemiBold',
  },
});
```

### ACCEPTANCE CRITERIA

- [ ] Card shows on `TradeTimelineScreen` when `trade.status = 'in_progress'` for both buyer and seller
- [ ] Card is dismissible with [Got it ✓] button
- [ ] Dismissed state stored in `AsyncStorage` keyed by `trade_id` (per-trade, not per-user globally)
- [ ] After dismissal: shows compact `"🛡️ Meeting safely? Tips"` link
- [ ] Tapping compact link re-expands the full card
- [ ] Full card shows 4 bullet points with the V1 locked copy
- [ ] Card uses `#F0FDF4` background, `#BBF7D0` border (green-tint, non-alarming)
- [ ] No external API call, no map, no location service — static text only
- [ ] Phosphor `ShieldCheck` and `CheckCircle` icons used (NOT Ionicons)

**NEXT TASK: TFV2-021**

---

## TASK TFV2-021: Structured Pickup Helpers — Chat Quick-Replies

**Duration:** 1.5 hours  
**Priority:** Medium  
**Dependencies:** TFV2-013 (trade status on ChatScreen context)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/screens/messaging/ChatScreen.tsx` | MODIFY | Add quick-reply chip strip above message input when trade.status = 'in_progress' |
| `src/components/messaging/QuickReplyCHips.tsx` | CREATE | Horizontally scrollable chip strip |

### Description

Add structured pickup quick-reply chips per Section 11.6 of TRADING-FLOW-V2.md. Only shown on `ChatScreen` when the associated trade has `status = 'in_progress'`. Chips are visual convenience shortcuts — they have NO effect on trade state or `auto_complete_at`. Tapping a chip sends the predefined message as a normal chat message from the user.

**Chips (5 total, show 3 at a time with "+ More" expand):**

| Chip Label | Message Sent |
|---|---|
| 📅 Today | *"I can do a pickup today. What time works for you?"* |
| 📅 Tomorrow | *"I can do a pickup tomorrow. What time works for you?"* |
| 📅 Suggest times | *"Here are some times that work for me: [add your times]"* (opens prefilled composer) |
| 🎪 Public place | *"Happy to meet at a public spot — library, coffee shop, or similar. What's near you?"* |
| 🕐 Running late | *"Running a bit behind — I'll message you when I'm on my way."* |

### AI Prompt for Cursor

```typescript
// filepath: src/components/messaging/QuickReplyChips.tsx

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

const ALL_CHIPS = [
  { id: 'today',        label: '📅 Today',        message: "I can do a pickup today. What time works for you?" },
  { id: 'tomorrow',     label: '📅 Tomorrow',     message: "I can do a pickup tomorrow. What time works for you?" },
  { id: 'suggest',      label: '📅 Suggest times', message: "Here are some times that work for me: " },  // prefill
  { id: 'public_place', label: '🎪 Public place',  message: "Happy to meet at a public spot — library, coffee shop, or similar. What's near you?" },
  { id: 'running_late', label: '🕐 Running late',  message: "Running a bit behind — I'll message you when I'm on my way." },
] as const;

const INITIAL_VISIBLE = 3;

interface Props {
  onChipPress: (message: string, isPrefill?: boolean) => void;
}

export function QuickReplyChips({ onChipPress }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visibleChips = expanded ? ALL_CHIPS : ALL_CHIPS.slice(0, INITIAL_VISIBLE);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {visibleChips.map(chip => (
          <TouchableOpacity
            key={chip.id}
            style={styles.chip}
            onPress={() => onChipPress(
              chip.message,
              chip.id === 'suggest'  // 'Suggest times' opens prefilled composer
            )}
            accessibilityRole="button"
            accessibilityLabel={`Send quick reply: ${chip.label}`}
          >
            <Text style={styles.chipLabel}>{chip.label}</Text>
          </TouchableOpacity>
        ))}

        {!expanded && ALL_CHIPS.length > INITIAL_VISIBLE && (
          <TouchableOpacity
            style={[styles.chip, styles.moreChip]}
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            accessibilityLabel="Show more quick replies"
          >
            <Text style={styles.moreLabel}>+ More</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingVertical: 8,
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 34,
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 13,
    color: '#1A1A1A',
    fontFamily: 'Inter-Regular',
  },
  moreChip: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  moreLabel: {
    fontSize: 13,
    color: '#5DBB8E',
    fontFamily: 'Inter-SemiBold',
  },
});
```

```typescript
// filepath: src/screens/messaging/ChatScreen.tsx
// ADD to existing component. Show chips above message input ONLY when
// the associated trade has status === 'in_progress'.

// 1. Fetch trade status for this conversation:
//    const { data: trade } = await supabase
//      .from('trades')
//      .select('id, status')
//      .eq('listing_id', listingId)
//      .in('status', ['in_progress', 'completed', 'cancelled'])
//      .order('created_at', { ascending: false })
//      .limit(1)
//      .single();

// 2. In render, above the message input:
//    {activeTrade?.status === 'in_progress' && (
//      <QuickReplyChips
//        onChipPress={(message, isPrefill) => {
//          if (isPrefill) {
//            setInputText(message);  // pre-fill the composer
//          } else {
//            sendMessage(message);   // send directly
//          }
//        }}
//      />
//    )}

// 3. Also add the persistent in-chat safety banner:
//    A non-dismissible banner pinned to the top of the chat screen:
//    <View style={styles.safetyBanner}>
//      <Text style={styles.safetyBannerText}>
//        SP and buyer protection only apply to in-app trades. Outside deals aren't covered.
//      </Text>
//    </View>
//    backgroundColor: '#FFF9EC', borderBottom: 1px #FDE68A, text: 13px #92400E
//    This is the D-19 safety banner — non-dismissible, always visible.

// 4. Pre-first-message safety modal (D-21):
//    One-time modal shown before user's first message on a GIVEN listing.
//    Dismissed state stored in AsyncStorage keyed by 'pre_message_modal_[listingId]'.
//    Copy: "Keep your trade safe — SP and buyer protection only work for in-app transactions.
//           Deals made outside the app aren't covered."
//    Button: [Got it]
```

### ACCEPTANCE CRITERIA

- [ ] Quick-reply chip strip shown ONLY when associated trade `status = 'in_progress'`
- [ ] 5 chip messages exactly as specified in Section 11.6
- [ ] Initially shows 3 chips; [+ More] expands to show all 5
- [ ] Tapping a chip sends the message as a normal chat message
- [ ] "Suggest times" chip pre-fills the message composer (does not auto-send)
- [ ] Chips are horizontally scrollable
- [ ] Chips have NO effect on trade state or `auto_complete_at`
- [ ] Safety banner (D-19) added to ChatScreen — non-dismissible
- [ ] Pre-first-message safety modal (D-21) shown once per listing, dismissed state in AsyncStorage
- [ ] Chips hidden when trade is `completed` or `cancelled`

**NEXT TASK: TFV2-022**

---

## TASK TFV2-022: Cart Bundle Checkout

**Duration:** 4 hours  
**Priority:** Medium  
**Dependencies:** TFV2-001 to TFV2-003 (trade creation + SP reserve), TFV2-013 (`submitOfferV2`)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260528000011_cart_tables.sql` | CREATE | `carts` and `cart_items` tables |
| `src/screens/cart/CartScreen.tsx` | CREATE | Cart management screen |
| `src/screens/cart/CartCheckoutScreen.tsx` | CREATE | Bundle checkout with SP slider |
| `src/services/cartService.ts` | CREATE | Cart CRUD + checkout logic |

### Description

Implement cart bundle checkout per Decisions D-27, D-28, D-29 and Section 11.3.1:

- **Decision D-27**: Cart checkout creates ONE trade per item. `bundle_id` is a shared UUID stamped on all trades from the same cart checkout. `bundle_id` has ZERO business logic — UX grouping only.
- **Decision D-28**: Cart is single-seller per active cart. Up to 3 saved carts total.
- **Decision D-29**: Explicit eviction warning when trying to create a 4th cart (NOT silent LRU).

Bundle UX on seller's ReviewOfferScreen is handled by TFV2-010 — bundle rows group offers sharing a `bundle_id`.

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000011_cart_tables.sql

-- Cart: single-seller per active cart (Decision D-28)
CREATE TABLE IF NOT EXISTS carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    UUID NOT NULL REFERENCES auth.users(id),
  seller_id   UUID NOT NULL REFERENCES auth.users(id),
  status      TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'checked_out', 'abandoned')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(buyer_id, seller_id, status)  -- one active cart per buyer-seller pair
);

CREATE TABLE IF NOT EXISTS cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES listings(id),
  sp_amount   INTEGER NOT NULL DEFAULT 0,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, listing_id)
);

CREATE INDEX idx_carts_buyer_id    ON carts(buyer_id) WHERE status = 'active';
CREATE INDEX idx_cart_items_cart   ON cart_items(cart_id);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Buyers can only see their own carts
CREATE POLICY "Buyer cart access" ON carts
  USING (buyer_id = auth.uid());
CREATE POLICY "Buyer cart items access" ON cart_items
  USING (
    cart_id IN (SELECT id FROM carts WHERE buyer_id = auth.uid())
  );
```

```typescript
// filepath: src/services/cartService.ts

import { createClient } from '@/lib/supabase';
import { submitOfferV2 } from './tradeServiceV2';

const MAX_SAVED_CARTS = 3;

export interface CartItem {
  listing_id: string;
  sp_amount:  number;
  listing?:   { title: string; price: number; image_url: string; seller_id: string };
}

/**
 * Add item to cart. Creates a new cart if none exists for this seller.
 * Enforces Decision D-28 (single-seller per cart) and D-29 (explicit eviction warning).
 * Returns { cart, evictionWarning } where evictionWarning is non-null if the user
 * already has 3 carts and would need to evict one to proceed.
 */
export async function addToCart(
  buyerId:   string,
  sellerId:  string,
  listingId: string,
  spAmount:  number = 0
): Promise<{ cart: { id: string } | null; evictionWarning: { oldestCartId: string; oldestCartTitle: string } | null }> {
  const supabase = createClient();

  // Check if active cart already exists for this seller
  const { data: existingCart } = await supabase
    .from('carts')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .single();

  if (existingCart) {
    // Add to existing cart
    await supabase.from('cart_items').upsert({
      cart_id:    existingCart.id,
      listing_id: listingId,
      sp_amount:  spAmount,
    });
    return { cart: existingCart, evictionWarning: null };
  }

  // Count active carts for this buyer
  const { count } = await supabase
    .from('carts')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', buyerId)
    .eq('status', 'active');

  if ((count ?? 0) >= MAX_SAVED_CARTS) {
    // Decision D-29: return eviction warning — do NOT silently evict
    const { data: oldestCart } = await supabase
      .from('carts')
      .select('id, seller_id, profiles!seller_id(full_name)')
      .eq('buyer_id', buyerId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const sellerName = (oldestCart as any)?.profiles?.full_name ?? 'Unknown seller';
    return {
      cart: null,
      evictionWarning: {
        oldestCartId:    oldestCart?.id ?? '',
        oldestCartTitle: `Cart with ${sellerName}`,
      },
    };
  }

  // Create new cart
  const { data: newCart } = await supabase
    .from('carts')
    .insert({ buyer_id: buyerId, seller_id: sellerId })
    .select()
    .single();

  if (!newCart) throw new Error('Failed to create cart');

  await supabase.from('cart_items').insert({
    cart_id: newCart.id, listing_id: listingId, sp_amount: spAmount
  });

  return { cart: newCart, evictionWarning: null };
}

/**
 * Checkout a cart: creates one trade per item, all stamped with a shared bundle_id.
 * Decision D-27: bundle_id is UX grouping only — zero business logic attached.
 */
export async function checkoutCart(
  cartId:  string,
  buyerId: string
): Promise<{ trades: Array<{ id: string }>; bundleId: string }> {
  const supabase = createClient();

  // Fetch cart + items + listings
  const { data: cart } = await supabase
    .from('carts')
    .select('id, seller_id, cart_items(listing_id, sp_amount, listings(id, price))')
    .eq('id', cartId)
    .eq('buyer_id', buyerId)
    .eq('status', 'active')
    .single();

  if (!cart) throw new Error('Cart not found or not active');

  const items = (cart as any).cart_items as Array<{
    listing_id: string;
    sp_amount:  number;
    listings:   { id: string; price: number };
  }>;

  if (!items.length) throw new Error('Cart is empty');

  // Generate one shared bundle_id for all trades in this checkout (Decision D-27)
  const bundleId = crypto.randomUUID();

  const trades: Array<{ id: string }> = [];

  for (const item of items) {
    const listing = item.listings;
    // Platform fee TODO-07: use admin config values, do NOT change fee logic here
    const platformFeeCents = 99; // $0.99 subscriber fee — TODO: fetch from admin config
    const cashAmountCents = Math.round((listing.price - item.sp_amount) * 100) + platformFeeCents;

    const result = await submitOfferV2({
      listingId:       listing.id,
      buyerId,
      sellerId:        cart.seller_id,
      cashAmountCents,
      spAmount:        item.sp_amount,
    });

    // Stamp bundle_id on the created trade
    await supabase
      .from('trades')
      .update({ bundle_id: bundleId })
      .eq('id', result.trade.id);

    trades.push({ id: result.trade.id });
  }

  // Mark cart as checked out
  await supabase.from('carts').update({ status: 'checked_out' }).eq('id', cartId);

  return { trades, bundleId };
}

/**
 * Explicitly evict (delete) a saved cart — ONLY called after user confirms.
 * Decision D-29: caller must have shown the eviction warning modal first.
 */
export async function evictCart(cartId: string, buyerId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from('carts')
    .update({ status: 'abandoned' })
    .eq('id', cartId)
    .eq('buyer_id', buyerId);
}
```

### ACCEPTANCE CRITERIA

- [ ] `carts` and `cart_items` tables created with RLS (buyer sees own carts only)
- [ ] Cart is single-seller per buyer — adding an item from a different seller creates a new cart
- [ ] Maximum 3 active carts per buyer enforced
- [ ] Adding to a 4th cart returns `evictionWarning` (Decision D-29 — NOT silent eviction)
- [ ] `CartScreen` must show the eviction warning modal naming the cart to be deleted before proceeding
- [ ] `checkoutCart()` creates ONE trade per item (Decision D-27)
- [ ] All trades from same checkout share a `bundle_id` UUID
- [ ] `bundle_id` is set on trades but no business logic references it
- [ ] `submitOfferV2()` is called per item (SP reserve trigger fires per trade)
- [ ] Cart marked `checked_out` after successful checkout
- [ ] `evictCart()` only callable after user confirms in eviction warning modal
- [ ] `CartScreen` empty state: Phosphor `Package` icon (64px, `#E0E0E0`) + "Start browsing" CTA
- [ ] `CartCheckoutScreen` SP allocation slider functional per Section 11.3.1
- [ ] "Confirm & Pay" is sticky bottom button, green pill, 52px height

---

## CROSS-REFERENCE VERIFICATION TABLE

| Module # | Task | Decision(s) Covered | Section Refs | Status |
|---|---|---|---|---|
| 1 | TFV2-001 | — | 9.1–9.4 | ⏳ |
| 2 | TFV2-002 | D-26, D-27 | 13.1–13.4 | ⏳ |
| 3 | TFV2-003 | D-10, D-17 | 10.1–10.2, 13.4 | ⏳ |
| 4 | TFV2-004 | D-09 | 13.4, S3, S6 | ⏳ |
| 5 | TFV2-005 | D-03, D-26 | 13.4, S7 | ⏳ |
| 6 | TFV2-006 | D-03 | 5, S1 | ⏳ |
| 7 | TFV2-007 | — | 8.1 | ⏳ |
| 8 | TFV2-008 | D-03 | 8.2 | ⏳ |
| 9 | TFV2-009 | D-09 | 11.2 | ⏳ |
| 10 | TFV2-010 | D-11, D-17 | 10.3, 11.3 | ⏳ |
| 11 | TFV2-011 | D-03, D-26 | 11.4, S10 | ⏳ |
| 12 | TFV2-012 | D-07, D-08, D-25 | 11.1, 4.2, S9 | ⏳ |
| 13 | TFV2-013 | D-01, D-02, D-07 | 5, S1, S4, S5 | ⏳ |
| 14 | TFV2-014 | D-12 | 12 | ⏳ |
| 15 | TFV2-015 | D-13 | 11.8 | ⏳ |
| 16 | TFV2-016 | D-15, D-16 | 9.2, 9.5 | ⏳ |
| 17 | TFV2-017 | D-26 | 6.2, 6.2.6 | ⏳ |
| 18 | TFV2-018 | — | 6.3 | ⏳ |
| 19 | TFV2-019 | — | 16 | ⏳ |
| 20 | TFV2-020 | D-19 | 11.5, TODO-06 | ⏳ |
| 21 | TFV2-021 | D-19, D-21 | 11.6 | ⏳ |
| 22 | TFV2-022 | D-27, D-28, D-29 | 11.3.1 | ⏳ |

## EVENT INSTRUMENTATION COVERAGE (Section 16)

| Event | Fired From | Task |
|---|---|---|
| `offer_submitted` | `submitOfferV2()` (TFV2-013) | TFV2-019 |
| `offer_accepted` | ReviewOfferScreen / seller accept | TFV2-019 |
| `offer_declined` | ReviewOfferScreen / seller decline | TFV2-019 |
| `offer_expired` | `rpc_process_expired_offers` cron | TFV2-004, TFV2-019 |
| `payment_succeeded` | Stripe webhook handler | TFV2-019 |
| `payment_failed` | Stripe webhook handler | TFV2-019 |
| `buyer_confirmed` | `complete-trade` Edge Function | TFV2-006, TFV2-019 |
| `auto_completed` | `rpc_process_auto_complete` cron | TFV2-005, TFV2-019 |
| `issue_reported` | `IssueReportModal` submit handler | TFV2-011, TFV2-019 |
| `dispute_resolved` | `resolve-dispute` Edge Function | TFV2-017, TFV2-019 |
| `seller_cancelled` | `cancelTradeV2()` (seller path) | TFV2-006, TFV2-019 |
| `sp_reserved` | `fn_reserve_sp_on_offer` trigger | TFV2-003, TFV2-019 |
| `sp_released_to_seller` | `fn_release_all_sp_on_complete` trigger | TFV2-003, TFV2-019 |
| `sp_restored_to_buyer` | `fn_release_sp_on_cancel` trigger | TFV2-003, TFV2-019 |
| `payout_requires_action` | `initiate-payout` Edge Function | TFV2-018, TFV2-019 |
| `payout_initiated` | `initiate-payout` Edge Function | TFV2-018, TFV2-019 |

---

## TESTING STRATEGY

### Per-Task Tier 0 (before marking task done)
```bash
# Mobile app type check
cd p2p-kids-marketplace && npx tsc --noEmit

# Admin type check
cd p2p-kids-admin && npx tsc --noEmit

# Lint both
cd p2p-kids-marketplace && npm run lint
cd p2p-kids-admin && npm run lint
```

### DB Migration Validation
```bash
# Verify each migration applies cleanly
supabase db reset && supabase db push

# Check triggers are registered
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

# Check cron jobs
SELECT jobname, schedule, command FROM cron.job;

# Verify SP columns on sp_wallets
\d sp_wallets

# Verify dispute + payout columns on trades
\d trades
```

### Scenario Test Checklist (Manual QA)

| # | Scenario | Expected Result | Task(s) |
|---|---|---|---|
| T-01 | Buyer with 0 pending offers submits offer | Trade created in pending, SP reserved if sp_amount > 0 | TFV2-003, TFV2-013 |
| T-02 | Buyer with 3 pending offers tries 4th | Error: max 3 pending offers | TFV2-013 |
| T-03 | Offer expires (24h with no seller response) | Trade cancelled, buyer SP restored, seller unanswered count incremented | TFV2-004 |
| T-04 | Seller accepts offer | Competing offers auto-declined, buyer SP stays in reserved_sp, Stripe charges | TFV2-004 |
| T-05 | Buyer taps I Got It | Trade completed, single SP release event fires (buyer SP + platform SP → seller pending_sp) | TFV2-006, TFV2-003 |
| T-06 | 48h passes with buyer not confirming | Auto-complete cron fires, same SP release as T-05 | TFV2-005, TFV2-003 |
| T-07 | Buyer taps I Got It on disputed trade | Error: active dispute — cannot complete | TFV2-006 |
| T-08 | Auto-complete cron fires on disputed trade | Trade skipped, stays in_progress | TFV2-005 |
| T-09 | Admin resolves dispute as Complete | trade.status → completed, SP releases, payout triggers | TFV2-017, TFV2-003 |
| T-10 | Admin resolves dispute as Refund | trade.status → cancelled, buyer SP restored, Stripe refund | TFV2-017, TFV2-003 |
| T-11 | Free user taps locked Use SP button | Upgrade modal shown — NOT SP slider | TFV2-012 |
| T-12 | Seller has 2 consecutive unanswered offers | Ignoring-offers modal shown on next Offers tab open | TFV2-015 |
| T-13 | 4th push notification attempt (same trade) | Notification dropped and logged, not sent | TFV2-016 |
| T-14 | Cart checkout with 3 items from same seller | 3 trades created, all share same bundle_id | TFV2-022 |
| T-15 | Buyer tries to add 4th saved cart | Eviction warning modal shown (not silent eviction) | TFV2-022 |

---

## REQUIREMENTS COVERAGE AUDIT

> Full re-scan of TRADING-FLOW-V2.md v2.1 performed (all 1500+ lines). Gaps patched in the addenda below.

### ✅ CONFIRMED COVERED

| Section / Decision | Requirement | Covered By |
|---|---|---|
| Section 9.4 | Admin config cross-field validation (7 rules) | TFV2-001 (`validate_trade_timing_config()` trigger) |
| Section 13.1 backfill | Existing pending/in_progress trade backfill | TFV2-002 (migration description) |
| TODO-02 DB fields | `post_acceptance_cancellation_count`, `admin_review_flagged_at` columns | TFV2-002 |
| D-22 | Post-meetup buyer nudge push (T+6h after auto-complete) | TFV2-016 notification schedule |
| D-19 | In-chat safety banner (non-dismissible) | TFV2-021 |
| D-21 | Pre-first-message safety modal | TFV2-021 |
| D-23, D-24 | Message content scanning, auto-complete ratio | ✅ Correctly deferred to V1.1 |
| TODO-08 | Pickup scheduling with `auto_complete_at` reset | ✅ Correctly deferred to V1.1 |
| Section 16.1 | All 16 trade events | TFV2-019 |
| Section 6.2 | Full dispute state machine + admin dashboard | TFV2-017 |
| Section 6.3 | Seller payout + `requires_action` flow | TFV2-018 |
| Section 9.5 | Push notification throttling (3 max per trade) | TFV2-016 |
| Section 12 | All 7 completion CTA permutations | TFV2-014 |
| Section 11.5 | Safe Meetup V1-Lite card | TFV2-020 |
| Section 11.6 | Chat quick-reply chips | TFV2-021 |
| Section 11.8 | Seller ignoring offers prompt | TFV2-015 |
| Scenarios S1–S7, S9–S10 | All non-S8 scenarios | TFV2-006, TFV2-011, TFV2-012, TFV2-013 |

### ❌ GAPS PATCHED IN ADDENDA BELOW

| # | Gap | Source | Resolution |
|---|---|---|---|
| G1 | Seller cancel reason modal (S8 Step 2) | S8 Step 2, Section 11.7 | **ADDENDUM A — TFV2-011** |
| G2 | Progressive seller cancellation logic (3-level escalation) | Section 11.7, S8 Step 5 | **NEW TASK TFV2-023** |
| G3 | D-20 value stack line item on offer preview | TODO-01 V1-4, Decision D-20 | **ADDENDUM B — TFV2-013** |
| G4 | Bundle context banner on TradeTimelineScreen | Section 11.3.1 | **ADDENDUM C — TFV2-011** |
| G5 | "Confirm all" bundle shortcut on TradeTimelineScreen | Section 11.3.1 | **ADDENDUM C — TFV2-011** |
| G6 | Buyer in_progress bundle row on TradeListScreen | Section 11.3.1 | **ADDENDUM D — TFV2-009** |
| G7 | Full seller bundle row [Accept Bundle]/[Review Each]/[Decline All] | Section 11.3.1 | **ADDENDUM D — TFV2-009** |
| G8 | ReviewOfferScreen bundle grouping (seller sees bundled offers) | Section 11.3 | **ADDENDUM E — TFV2-010** |

---

## ADDENDUM A — TFV2-011: Seller Cancel Reason Modal (S8 Step 2)

**Source:** Scenario S8 Step 2. When seller taps [Cancel] on an `in_progress` trade, show a reason modal before executing cancellation.

### New File

```typescript
// filepath: src/screens/trade/SellerCancelReasonModal.tsx
// NEW FILE — bottom-sheet reason picker before seller cancels an in_progress trade.

import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { X, WarningCircle } from 'phosphor-react-native';

const CANCEL_REASONS = [
  { id: 'no_pickup',        label: "Can't do pickup" },
  { id: 'item_unavailable', label: 'Item no longer available' },
  { id: 'other',            label: 'Other' },
] as const;

type CancelReasonId = typeof CANCEL_REASONS[number]['id'];

interface Props {
  visible:   boolean;
  onClose:   () => void;
  onConfirm: (reason: CancelReasonId) => Promise<void>;
}

export function SellerCancelReasonModal({ visible, onClose, onConfirm }: Props) {
  const [selected, setSelected]     = useState<CancelReasonId | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onConfirm(selected);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <WarningCircle size={24} color="#E85D75" weight="fill" />
            <Text style={styles.title}>Why are you cancelling?</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#6B6B6B" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {CANCEL_REASONS.map(reason => (
              <TouchableOpacity
                key={reason.id}
                style={[styles.reasonRow, selected === reason.id && styles.reasonRowSelected]}
                onPress={() => setSelected(reason.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected === reason.id }}
              >
                <View style={[styles.radio, selected === reason.id && styles.radioSelected]}>
                  {selected === reason.id && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.reasonLabel}>{reason.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmButton, !selected && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={!selected || submitting}
              accessibilityRole="button"
            >
              <Text style={styles.confirmLabel}>
                {submitting ? 'Cancelling...' : 'Cancel Trade'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <Text style={styles.backLabel}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:              { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:                { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle:               { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: 8 },
  header:               { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 8 },
  title:                { flex: 1, fontSize: 17, fontWeight: '600', color: '#1A1A1A', fontFamily: 'Inter-SemiBold' },
  content:              { paddingHorizontal: 20, paddingBottom: 8 },
  reasonRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F0F0F0', gap: 12 },
  reasonRowSelected:    { borderColor: '#5DBB8E' },
  radio:                { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  radioSelected:        { borderColor: '#5DBB8E' },
  radioInner:           { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5DBB8E' },
  reasonLabel:          { fontSize: 15, color: '#1A1A1A', fontFamily: 'Inter-Regular' },
  footer:               { padding: 20, gap: 12 },
  confirmButton:        { height: 52, borderRadius: 26, backgroundColor: '#E85D75', alignItems: 'center', justifyContent: 'center' },
  confirmButtonDisabled:{ backgroundColor: '#E0E0E0' },
  confirmLabel:         { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: 'Inter-SemiBold' },
  backButton:           { height: 44, alignItems: 'center', justifyContent: 'center' },
  backLabel:            { fontSize: 15, color: '#6B6B6B', fontFamily: 'Inter-Regular' },
});
```

### Integration into TradeTimelineScreen.tsx (seller cancel flow)

```typescript
// filepath: src/screens/trade/TradeTimelineScreen.tsx
// MODIFY: Replace the existing seller [Cancel] button direct-action with the modal gate.

// 1. Add state:
const [cancelModalVisible, setCancelModalVisible] = useState(false);

// 2. Replace direct cancel handler with modal trigger:
{isSeller && trade.status === 'in_progress' && !isDisputeActive && (
  <TouchableOpacity
    style={styles.cancelTradeButton}
    onPress={() => setCancelModalVisible(true)}
    accessibilityRole="button"
  >
    <Text style={styles.cancelTradeLabel}>Cancel Trade</Text>
  </TouchableOpacity>
)}

// 3. Add modal at bottom of JSX:
<SellerCancelReasonModal
  visible={cancelModalVisible}
  onClose={() => setCancelModalVisible(false)}
  onConfirm={async (reason) => {
    await cancelTradeV2(trade.id, reason, currentUserId);
    navigation.goBack();
    showToast({ message: 'Trade cancelled. Full refund issued to buyer.', type: 'info' });
  }}
/>
```

### Additional Acceptance Criteria for TFV2-011

- [ ] Seller tapping [Cancel] on `in_progress` trade opens `SellerCancelReasonModal` (NOT direct cancel)
- [ ] Modal shows 3 reasons: "Can't do pickup" | "Item no longer available" | "Other"
- [ ] [Cancel Trade] button is disabled until a reason is selected
- [ ] On confirm: calls `cancelTradeV2(tradeId, reason, userId)`, navigates back, shows toast
- [ ] [Go Back] aborts the cancellation and closes modal
- [ ] [Cancel] is never shown when `dispute_status` is `reported` or `under_review` (existing criterion)

---

## ADDENDUM C — TFV2-011: Bundle Context Banner + "Confirm All" Shortcut (Section 11.3.1)

> **Note**: Addendum C is labelled after B (TFV2-013 addendum) to match the gap table ordering. Both are additions to TFV2-011 and must be implemented together.

### Bundle Context Banner

When `trade.bundle_id IS NOT NULL`, show a contextual banner at the top of `TradeTimelineScreen` content:

```typescript
// filepath: src/screens/trade/TradeTimelineScreen.tsx

// 1. Fetch bundle size when bundle_id is present:
const [bundleSize, setBundleSize] = useState<number>(0);

useEffect(() => {
  if (!trade.bundle_id) return;
  supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('bundle_id', trade.bundle_id)
    .neq('status', 'cancelled')
    .then(({ count }) => setBundleSize(count ?? 0));
}, [trade.bundle_id]);

// 2. Add bundle banner above timeline content:
{trade.bundle_id && bundleSize > 1 && (
  <TouchableOpacity
    style={styles.bundleBanner}
    onPress={() => navigation.navigate('BundleTradesScreen', { bundleId: trade.bundle_id })}
    accessibilityRole="link"
    accessibilityLabel={`This item is part of a ${bundleSize}-item bundle. Tap to view all.`}
  >
    <Text style={styles.bundleBannerText}>
      {'This item is part of a '}
      <Text style={styles.bundleBannerCount}>{bundleSize}-item bundle.</Text>
      {'  '}
      <Text style={styles.bundleBannerLink}>View all bundle items →</Text>
    </Text>
  </TouchableOpacity>
)}

// Styles:
bundleBanner:      { backgroundColor: '#FFF9EC', borderRadius: 8, padding: 12,
                     marginHorizontal: 20, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
bundleBannerText:  { fontSize: 13, color: '#92400E', fontFamily: 'Inter-Regular' },
bundleBannerCount: { fontFamily: 'Inter-SemiBold', color: '#92400E' },
bundleBannerLink:  { color: '#5DBB8E', fontFamily: 'Inter-SemiBold', textDecorationLine: 'underline' },
```

### "Confirm All" Shortcut

When buyer taps [I Got It] and all other bundle trades are also `in_progress`, intercept to offer batch confirmation:

```typescript
// filepath: src/screens/trade/TradeTimelineScreen.tsx
// MODIFY the handleIGotIt function:

const handleIGotIt = async () => {
  // Bundle "Confirm All" check
  if (trade.bundle_id) {
    const { data: bundleTrades } = await supabase
      .from('trades')
      .select('id, status')
      .eq('bundle_id', trade.bundle_id)
      .neq('id', trade.id);

    const siblingsInProgress = bundleTrades?.filter(t => t.status === 'in_progress') ?? [];
    const allInProgress = siblingsInProgress.length === (bundleTrades?.length ?? 0)
                          && siblingsInProgress.length > 0;

    if (allInProgress) {
      Alert.alert(
        `Confirm all ${bundleTrades!.length + 1} items received?`,
        'All items from this seller are ready to confirm.',
        [
          {
            text: 'Confirm All',
            onPress: async () => {
              setConfirming(true);
              try {
                const allIds = [trade.id, ...bundleTrades!.map(t => t.id)];
                for (const tid of allIds) {
                  await completeTradeV2(tid, currentUserId);
                }
                navigation.replace('TradeSuccess', { tradeId: trade.id });
              } catch (err) {
                showToast({ message: 'Could not confirm all items. Try again.', type: 'error' });
              } finally {
                setConfirming(false);
              }
            },
          },
          {
            text: 'Just This One',
            style: 'cancel',
            onPress: async () => {
              setConfirming(true);
              try {
                await completeTradeV2(trade.id, currentUserId);
                navigation.replace('TradeSuccess', { tradeId: trade.id });
              } catch (err) {
                showToast({ message: 'Could not complete trade. Try again.', type: 'error' });
              } finally {
                setConfirming(false);
              }
            },
          },
        ],
      );
      return;
    }
  }

  // Non-bundle or partial bundle path
  setConfirming(true);
  try {
    await completeTradeV2(trade.id, currentUserId);
    navigation.replace('TradeSuccess', { tradeId: trade.id });
  } catch (err) {
    showToast({ message: 'Could not complete trade. Please try again.', type: 'error' });
  } finally {
    setConfirming(false);
  }
};
```

### Additional Acceptance Criteria for TFV2-011 (Bundle)

- [ ] Bundle context banner shown when `trade.bundle_id IS NOT NULL` and bundle has ≥2 non-cancelled trades
- [ ] Bundle banner shows correct item count and links to `BundleTradesScreen`
- [ ] Buyer tapping [I Got It] on a bundle trade where ALL siblings are also `in_progress` → "Confirm all N items?" Alert
- [ ] [Confirm All] calls `completeTradeV2()` for every trade in the bundle (including current)
- [ ] [Just This One] completes only the current trade (existing single-trade behavior)
- [ ] If NOT all sibling bundle trades are `in_progress`, no bundle prompt — standard single-trade flow

---

## ADDENDUM B — TFV2-013: D-20 Value Stack on Offer Preview

**Source**: Decision D-20, TODO-01 V1-4 — LOCKED V1. On `TradeOfferScreen`, add a fee + SP value line item below the cash total.

**Intent**: Reframe the platform fee as smaller than the value the SP system returns. "Fee: $0.99 | but you're getting $8 in SP value."

```typescript
// filepath: src/screens/trade/TradeOfferScreen.tsx
// ADD below the offer total / SP slider section.

// TODO-07: Fetch actual fee from admin config when fee structure is resolved.
// Until then, use hardcoded current values from Section 4.1:
const platformFeeDisplay = isSubscriber ? '$0.99' : '$2.99';

// spAmount is already tracked in component state (0 for cash-only path)
const spValueCents = spAmount; // 1 SP = $1 redemption value (FR-SP-003 spec)
const spValueDisplay = spAmount > 0 ? `${spAmount} SP ($${spAmount} value)` : null;

// Render the value stack row BELOW the offer total:
<View style={styles.valueStackRow}>
  <Text style={styles.valueStackFeeLabel}>Platform fee: </Text>
  <Text style={styles.valueStackFeeAmount}>{platformFeeDisplay}</Text>
  {spValueDisplay && (
    <>
      <Text style={styles.valueStackSep}> · </Text>
      <Text style={styles.valueStackSpLabel}>SP you'll earn: </Text>
      <Text style={styles.valueStackSpAmount}>{spValueDisplay}</Text>
    </>
  )}
</View>

// Styles:
valueStackRow:       { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
                        paddingHorizontal: 20, paddingVertical: 8,
                        backgroundColor: '#F0FDF4', borderRadius: 8, marginTop: 8 },
valueStackFeeLabel:  { fontSize: 12, color: '#6B6B6B', fontFamily: 'Inter-Regular' },
valueStackFeeAmount: { fontSize: 12, color: '#6B6B6B', fontFamily: 'Inter-SemiBold' },
valueStackSep:       { fontSize: 12, color: '#9CA3AF' },
valueStackSpLabel:   { fontSize: 12, color: '#5DBB8E', fontFamily: 'Inter-Regular' },
valueStackSpAmount:  { fontSize: 12, color: '#5DBB8E', fontFamily: 'Inter-SemiBold' },
```

**Notes**:
- Always show the fee line (even for cash-only path)
- Only show the "SP you'll earn" segment when `spAmount > 0` (SP path)
- `isSubscriber` prop/context must be available on `TradeOfferScreen` (already needed for slider visibility)
- When TODO-07 resolves, replace hardcoded fee values with `adminConfig.transaction_fee_*` from TFV2-001 fields

### Additional Acceptance Criteria for TFV2-013

- [ ] Value stack row shown on `TradeOfferScreen` (D-20 — LOCKED V1)
- [ ] Fee line always visible: "Platform fee: $0.99" (subscriber) or "Platform fee: $2.99" (free)
- [ ] SP segment shown only when `spAmount > 0`: "SP you'll earn: N SP ($N value)"
- [ ] Value stack row uses `#F0FDF4` light green background (non-alarming, positive framing)
- [ ] TODO-07 note left in code — fee values must be migrated to admin config when resolved

---

## ADDENDUM D — TFV2-009: Full Seller Bundle Row + Buyer in_progress Bundle Row (Section 11.3.1)

### D1: Full Seller Bundle Row on Offers Tab

The existing TFV2-009 task adds a "Bundle" badge chip. Section 11.3.1 specifies a **full bundle row** with action buttons that replaces the individual offer rows when offers share a `bundle_id`.

```typescript
// filepath: src/screens/trade/TradeListScreen.tsx
// MODIFY the seller's received offers list rendering.

// Group received pending offers by bundle_id:
const groupedOffers = useMemo(() => {
  const bundles = new Map<string, typeof receivedOffers>();
  const singles: typeof receivedOffers = [];

  for (const offer of sortedReceivedOffers) {
    if (offer.bundle_id) {
      const group = bundles.get(offer.bundle_id) ?? [];
      group.push(offer);
      bundles.set(offer.bundle_id, group);
    } else {
      singles.push(offer);
    }
  }

  const result: Array<{ type: 'single'; offer: typeof receivedOffers[0] }
                       | { type: 'bundle'; bundleId: string; offers: typeof receivedOffers }> = [];

  // Bundle rows (one row per bundle_id group)
  for (const [bundleId, bundleOffers] of bundles.entries()) {
    result.push({ type: 'bundle', bundleId, offers: bundleOffers });
  }
  // Single offer rows
  for (const offer of singles) {
    result.push({ type: 'single', offer });
  }

  // Re-sort: bundles first by highest total value
  return result.sort((a, b) => {
    const totalA = a.type === 'bundle'
      ? a.offers.reduce((sum, o) => sum + (o.cash_amount_cents ?? 0) + (o.points_amount ?? 0) * 100, 0)
      : (a.offer.cash_amount_cents ?? 0) + (a.offer.points_amount ?? 0) * 100;
    const totalB = b.type === 'bundle'
      ? b.offers.reduce((sum, o) => sum + (o.cash_amount_cents ?? 0) + (o.points_amount ?? 0) * 100, 0)
      : (b.offer.cash_amount_cents ?? 0) + (b.offer.points_amount ?? 0) * 100;
    return totalB - totalA;
  });
}, [sortedReceivedOffers]);

// Render bundle rows with bundle-specific UI:
// (Inside FlatList/ScrollView renderItem)
if (item.type === 'bundle') {
  const { offers } = item;
  const bundleTotal = offers.reduce((sum, o) =>
    sum + (o.cash_amount_cents ?? 0) / 100, 0);
  const bundleSP = offers.reduce((sum, o) => sum + (o.points_amount ?? 0), 0);
  const buyerName = offers[0]?.buyer?.full_name ?? 'Buyer';
  const earliestExpiry = offers.reduce((earliest, o) =>
    !o.offer_expires_at ? earliest
    : (!earliest || new Date(o.offer_expires_at) < new Date(earliest)) ? o.offer_expires_at : earliest,
    null as string | null
  );
  return (
    <View style={styles.bundleRow}>
      <View style={styles.bundleRowHeader}>
        <Text style={styles.bundleRowTitle}>
          {buyerName} · Bundle — {offers.length} items
        </Text>
        <Text style={styles.bundleRowTotal}>
          ${bundleTotal.toFixed(0)} cash{bundleSP > 0 ? ` + ${bundleSP} SP` : ''}
        </Text>
        {earliestExpiry && (
          <OfferCountdownPill
            expiresAt={earliestExpiry}
            createdAt={offers[0].created_at}
            compact
          />
        )}
      </View>
      <Text style={styles.bundleRowItems}>
        {offers.map(o => o.listing?.title ?? 'Item').join('  |  ')}
      </Text>
      <View style={styles.bundleRowActions}>
        <TouchableOpacity
          style={[styles.bundleActionButton, styles.bundleAcceptButton]}
          onPress={() => handleAcceptBundle(item.bundleId, offers.map(o => o.id))}
          accessibilityRole="button"
        >
          <Text style={styles.bundleAcceptLabel}>Accept Bundle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bundleActionButton, styles.bundleReviewButton]}
          onPress={() => navigation.navigate('ReviewOfferScreen', { tradeId: offers[0].id, bundleId: item.bundleId })}
          accessibilityRole="button"
        >
          <Text style={styles.bundleReviewLabel}>Review Each</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bundleActionButton, styles.bundleDeclineButton]}
          onPress={() => handleDeclineBundle(item.bundleId, offers.map(o => o.id))}
          accessibilityRole="button"
        >
          <Text style={styles.bundleDeclineLabel}>Decline All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// handleAcceptBundle: calls rpc_initiate_trade_v2 (or accept endpoint) for each offer ID in sequence.
// handleDeclineBundle: calls decline/cancel for each offer ID in sequence.
// Both functions should show a loading state on the bundle row while processing.
```

### D2: Buyer in_progress Bundle Row on TradeListScreen

Add a grouped bundle row to the buyer's **in_progress** tab (Section 11.3.1):

```typescript
// filepath: src/screens/trade/TradeListScreen.tsx
// ADD to the in_progress tab (buyer view). Group in_progress trades by bundle_id.

// Group in_progress trades by bundle_id:
const inProgressBundleGroups = useMemo(() => {
  const bundles = new Map<string, typeof inProgressTrades>();
  const singles: typeof inProgressTrades = [];

  for (const trade of inProgressTrades) {
    if (trade.bundle_id) {
      const group = bundles.get(trade.bundle_id) ?? [];
      group.push(trade);
      bundles.set(trade.bundle_id, group);
    } else {
      singles.push(trade);
    }
  }

  return { bundles, singles };
}, [inProgressTrades]);

// Render bundle group row in the in_progress tab:
for (const [bundleId, bundleTrades] of inProgressBundleGroups.bundles.entries()) {
  const sellerName = bundleTrades[0]?.seller?.full_name ?? 'Seller';
  const earliestAutoComplete = bundleTrades.reduce((earliest, t) =>
    !t.auto_complete_at ? earliest
    : (!earliest || new Date(t.auto_complete_at) < new Date(earliest)) ? t.auto_complete_at : earliest,
    null as string | null
  );
  // Render:
  // ┌─────────────────────────────────────────────────────────┐
  // │  📦 Bundle with {sellerName}  ·  {N} items  ·  In progress   │
  // │  Pickup arranged: all {N} items from same seller         │
  // │  [View All Items]  ·  ⏱ Auto-complete in Xh             │
  // └─────────────────────────────────────────────────────────┘
  return (
    <View style={styles.inProgressBundleRow}>
      <View style={styles.inProgressBundleHeader}>
        <Text style={styles.inProgressBundleIcon}>📦</Text>
        <Text style={styles.inProgressBundleTitle}>
          Bundle with {sellerName} · {bundleTrades.length} items · In progress
        </Text>
      </View>
      <Text style={styles.inProgressBundleSubtitle}>
        Pickup arranged: all {bundleTrades.length} items from same seller
      </Text>
      <View style={styles.inProgressBundleFooter}>
        <TouchableOpacity
          onPress={() => navigation.navigate('BundleTradesScreen', { bundleId })}
          accessibilityRole="button"
        >
          <Text style={styles.viewAllItemsLink}>View All Items</Text>
        </TouchableOpacity>
        {earliestAutoComplete && (
          <AutoCompleteBanner
            autoCompleteAt={earliestAutoComplete}
            inProgressAt={bundleTrades[0].updated_at}
            compact
          />
        )}
      </View>
    </View>
  );
}
```

### Additional Acceptance Criteria for TFV2-009

- [ ] Seller's received pending offers: offers sharing a `bundle_id` are grouped into a single bundle row
- [ ] Bundle row shows buyer name, item count, total cash + SP, and earliest expiry countdown pill
- [ ] Bundle row shows individual item titles in a preview line
- [ ] [Accept Bundle] accepts all offers in the bundle simultaneously
- [ ] [Review Each] navigates to `ReviewOfferScreen` with `bundleId` context
- [ ] [Decline All] declines all offers in the bundle simultaneously
- [ ] Buyer's in_progress tab: trades sharing a `bundle_id` render as a bundle group row
- [ ] Bundle group row shows seller name, item count, "Pickup arranged" subtitle, [View All Items] link
- [ ] Bundle group row shows earliest `auto_complete_at` as an inline countdown

---

## ADDENDUM E — TFV2-010: ReviewOfferScreen Bundle Grouping (Section 11.3)

When a seller opens `ReviewOfferScreen` for an offer that has a `bundle_id`, the screen must show bundle context and allow the seller to navigate between offers in the bundle.

```typescript
// filepath: src/screens/trade/ReviewOfferScreen.tsx
// ADD bundle context when trade.bundle_id IS NOT NULL.

// 1. Fetch all offers in the bundle (when bundle_id is present):
const { data: bundleOffers } = await supabase
  .from('trades')
  .select('id, listing_id, cash_amount_cents, points_amount, listings(title)')
  .eq('bundle_id', trade.bundle_id)
  .eq('status', 'pending')   // only show pending offers in bundle review
  .neq('id', trade.id);       // exclude the current one (it's already displayed)

const totalBundleItems = (bundleOffers?.length ?? 0) + 1;

// 2. Add a bundle context banner at the top of the screen:
{trade.bundle_id && totalBundleItems > 1 && (
  <View style={styles.bundleContextBanner}>
    <Text style={styles.bundleContextText}>
      Bundle offer · {totalBundleItems} items from same buyer
    </Text>
    <TouchableOpacity
      onPress={() => setShowBundleList(!showBundleList)}
      accessibilityRole="button"
    >
      <Text style={styles.bundleContextToggle}>
        {showBundleList ? 'Hide items ▲' : 'See all items ▼'}
      </Text>
    </TouchableOpacity>
  </View>
)}

// 3. Expandable bundle item list (collapsed by default):
{trade.bundle_id && showBundleList && (
  <View style={styles.bundleItemList}>
    {/* Current item */}
    <View style={[styles.bundleItem, styles.bundleItemCurrent]}>
      <Text style={styles.bundleItemTitle}>• {trade.listing?.title} (current)</Text>
    </View>
    {/* Other bundle items */}
    {bundleOffers?.map(bo => (
      <TouchableOpacity
        key={bo.id}
        style={styles.bundleItem}
        onPress={() => navigation.replace('ReviewOfferScreen', { tradeId: bo.id })}
        accessibilityRole="button"
      >
        <Text style={styles.bundleItemTitle}>• {(bo as any).listings?.title}</Text>
        <Text style={styles.bundleItemMeta}>
          ${(bo.cash_amount_cents / 100).toFixed(0)}{bo.points_amount > 0 ? ` + ${bo.points_amount} SP` : ''}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
)}

// 4. Bundle-level [Accept All] shortcut (shown when bundle has pending siblings):
{trade.bundle_id && totalBundleItems > 1 && (
  <TouchableOpacity
    style={styles.acceptAllButton}
    onPress={() => handleAcceptBundle(trade.bundle_id!)}
    accessibilityRole="button"
  >
    <Text style={styles.acceptAllLabel}>Accept All {totalBundleItems} Items</Text>
  </TouchableOpacity>
)}
// handleAcceptBundle: calls the accept endpoint for each trade in the bundle in sequence.
// The standard [Accept] and [Decline] buttons still work for individual item review.
```

### Additional Acceptance Criteria for TFV2-010

- [ ] When `trade.bundle_id IS NOT NULL`, show bundle context banner ("Bundle offer · N items from same buyer")
- [ ] Banner has expand/collapse toggle for the bundle item list
- [ ] Bundle item list shows all offers in the bundle (each tappable to navigate to that offer's review)
- [ ] Current offer is marked "(current)" in the list
- [ ] [Accept All N Items] shortcut button shown for bundle offers
- [ ] Existing [Accept] / [Decline] single-offer buttons still work for individual decisions
- [ ] Bundle grouping is display-layer only — each trade is accepted/declined independently in the DB

---

## TASK TFV2-023: Progressive Seller Cancellation Consequences

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** TFV2-002 (`post_acceptance_cancellation_count`, `admin_review_flagged_at` columns on `profiles`), TFV2-006 (`cancelTradeV2()`)

### Files to Modify

| File | Action | Purpose |
|---|---|---|
| `src/services/tradeServiceV2.ts` | MODIFY | Add progressive cancellation logic to `cancelTradeV2()` |
| `supabase/migrations/20260528000012_seller_cancel_consequences.sql` | CREATE | DB function `fn_handle_seller_cancellation()` |

### Description

Implement the 3-level progressive seller cancellation consequences per Section 11.7. The DB schema columns (`post_acceptance_cancellation_count`, `admin_review_flagged_at`) are already added in TFV2-002. This task adds the **logic** that fires after a seller cancels an `in_progress` trade.

**The 3 escalation levels:**

| `post_acceptance_cancellation_count` after increment | System Action |
|---|---|
| 1 | In-app toast: *"Cancelling after payment is disappointing for buyers. This has been noted on your account."* |
| 2 | Schedule push notification to seller 24h later: *"You've cancelled 2 trades after payment. A third cancellation may affect your selling privileges."* |
| 3+ | Set `admin_review_flagged_at = NOW()` on seller profile; send push: *"Your account is under review due to repeated post-payment cancellations."* |

**Rule**: Only post-Stripe-charge cancellations increment the counter. Seller declines before acceptance do NOT increment (those are pre-payment).

### AI Prompt for Cursor

```sql
-- filepath: supabase/migrations/20260528000012_seller_cancel_consequences.sql

-- DB function to handle seller post-acceptance cancellation consequences.
-- Called by cancelTradeV2() in the Edge Function or client service after
-- a successful status → 'cancelled' update on an in_progress trade.

CREATE OR REPLACE FUNCTION fn_handle_seller_cancellation(
  p_seller_id UUID,
  p_trade_id  UUID
) RETURNS JSONB AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- Increment the cancellation counter on the seller's profile
  UPDATE profiles
  SET post_acceptance_cancellation_count =
        COALESCE(post_acceptance_cancellation_count, 0) + 1
  WHERE id = p_seller_id
  RETURNING post_acceptance_cancellation_count INTO v_new_count;

  -- Level 3+: set admin review flag
  IF v_new_count >= 3 AND (
    SELECT admin_review_flagged_at FROM profiles WHERE id = p_seller_id
  ) IS NULL THEN
    UPDATE profiles
    SET admin_review_flagged_at = NOW()
    WHERE id = p_seller_id;
  END IF;

  RETURN jsonb_build_object(
    'new_count',         v_new_count,
    'level',             CASE WHEN v_new_count = 1 THEN 1
                              WHEN v_new_count = 2 THEN 2
                              ELSE 3 END,
    'admin_flag_set',    v_new_count >= 3
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
REVOKE ALL ON FUNCTION fn_handle_seller_cancellation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_handle_seller_cancellation TO service_role;
```

```typescript
// filepath: src/services/tradeServiceV2.ts
// MODIFY cancelTradeV2() to call fn_handle_seller_cancellation after cancellation
// when the cancelling user is the seller AND the trade was in_progress (post-payment).

export async function cancelTradeV2(
  tradeId:           string,
  reason:            string,
  cancelledByUserId: string
): Promise<{ trade: Trade; consequenceLevel: number | null }> {
  const supabase = createClient();

  // Fetch trade to check pre-cancel state
  const { data: preCancelTrade } = await supabase
    .from('trades')
    .select('id, status, seller_id, buyer_id')
    .eq('id', tradeId)
    .single();

  if (!preCancelTrade) throw new Error('Trade not found');

  const { data, error } = await supabase
    .from('trades')
    .update({
      status:              'cancelled',
      cancellation_reason: reason,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', tradeId)
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Failed to cancel trade');

  // Progressive seller cancellation consequences (Section 11.7):
  // Only fires if the cancelling user is the SELLER and the trade was in_progress
  // (i.e., Stripe has already charged — post-payment cancellation).
  let consequenceLevel: number | null = null;

  if (
    cancelledByUserId === preCancelTrade.seller_id &&
    preCancelTrade.status === 'in_progress'
  ) {
    const { data: consequence } = await supabase.rpc('fn_handle_seller_cancellation', {
      p_seller_id: preCancelTrade.seller_id,
      p_trade_id:  tradeId,
    });

    consequenceLevel = (consequence as any)?.level ?? null;
  }

  return { trade: data as Trade, consequenceLevel };
}
```

**Callers of `cancelTradeV2()` must handle `consequenceLevel`:**

```typescript
// filepath: src/screens/trade/TradeTimelineScreen.tsx
// MODIFY the SellerCancelReasonModal onConfirm handler:

onConfirm={async (reason) => {
  const { trade: cancelled, consequenceLevel } = await cancelTradeV2(
    trade.id, reason, currentUserId
  );

  navigation.goBack();

  // Show progressive toast based on consequence level
  if (consequenceLevel === 1) {
    showToast({
      message: 'Cancelling after payment is disappointing for buyers. This has been noted on your account.',
      type: 'warning',
      duration: 5000,
    });
  } else if (consequenceLevel === 2) {
    // Level 2: immediate toast + push is scheduled server-side (24h delay via cron/queue)
    showToast({
      message: "You've cancelled 2 trades after payment. A third cancellation may affect your selling privileges.",
      type: 'warning',
      duration: 6000,
    });
    // TODO: trigger a 24h delayed push notification via notification service
    // This requires a scheduled notification mechanism (pg_cron or notification queue).
    // For V1: log a trade_event 'seller_cancelled' with level=2 metadata.
    // Admin monitoring catches level-2 sellers; manual push can be sent from admin dashboard.
    // V1.1: implement scheduled push via pg_cron job that queries trade_events for level=2.
  } else if (consequenceLevel !== null && consequenceLevel >= 3) {
    showToast({
      message: 'Your account is under review due to repeated post-payment cancellations. Our team will be in touch.',
      type: 'error',
      duration: 8000,
    });
    // Level 3: push notification sent server-side when admin_review_flagged_at is set.
    // fn_handle_seller_cancellation already sets admin_review_flagged_at.
    // Push notification to seller should be triggered from the Edge Function / notification service.
  } else {
    showToast({ message: 'Trade cancelled. Full refund issued to buyer.', type: 'info' });
  }
}}
```

**Level 2 delayed push — V1 approach** (until scheduled notification queue is built):  
Log a `trade_event` with `event_name = 'seller_cancelled'` and `metadata.level = 2`. The admin dashboard (TFV2-017) surfaces sellers with `post_acceptance_cancellation_count = 2` for manual review. A V1.1 cron job queries for level-2 events and sends the delayed push.

### ACCEPTANCE CRITERIA

- [ ] `fn_handle_seller_cancellation(seller_id, trade_id)` DB function exists
- [ ] Function increments `post_acceptance_cancellation_count` on seller profile
- [ ] Function sets `admin_review_flagged_at = NOW()` when count reaches 3 (idempotent — only sets once)
- [ ] `cancelTradeV2()` calls `fn_handle_seller_cancellation` ONLY when: canceller = seller AND trade was `in_progress`
- [ ] Pre-acceptance seller declines do NOT increment the counter
- [ ] Level 1 (count = 1): in-app toast with note message
- [ ] Level 2 (count = 2): in-app warning toast; V1.1 scheduled push logged as TODO
- [ ] Level 3+ (count ≥ 3): error toast + `admin_review_flagged_at` already set by DB function
- [ ] Admin dashboard (TFV2-017) surfaces sellers with `admin_review_flagged_at IS NOT NULL`
- [ ] `trade_events` table receives `seller_cancelled` event with `metadata.seller_cancellation_count = N`
- [ ] `fn_handle_seller_cancellation` is SECURITY DEFINER, accessible only to service_role

---

## Updated Module Overview (Post-Audit)

| Task ID | Module # | Name | Phase | Priority | Status |
|---|---|---|---|---|---|
| TFV2-001 | 1 | Admin Config — Trade Timing Fields | 3 | Critical | ⏳ |
| TFV2-002 | 2 | DB Schema — trades, profiles, listing_offer_stats | 3 | Critical | ⏳ |
| TFV2-003 | 3 | SP Reserve/Release DB Triggers | 3 | Critical | ⏳ |
| TFV2-004 | 4 | Offer Expiry Cron + Auto-decline Trigger | 3 | Critical | ⏳ |
| TFV2-005 | 5 | Auto-Complete Cron | 3 | Critical | ⏳ |
| TFV2-006 | 6 | Platform SP Calculation on Completion | 3 | Critical | ⏳ |
| TFV2-007 | 7 | `<OfferCountdownPill />` Component | 4 | High | ⏳ |
| TFV2-008 | 8 | `<AutoCompleteBanner />` Component | 4 | High | ⏳ |
| TFV2-009 | 9 | TradeListScreen — Offers Tab + Bundle Rows | 5 | High | ⏳ |
| TFV2-010 | 10 | ReviewOfferScreen — SP Total + Bundle Grouping | 5 | High | ⏳ |
| TFV2-011 | 11 | TradeTimelineScreen — I Got It + Bundle UX + Cancel Modal | 5 | Critical | ⏳ |
| TFV2-012 | 12 | Item Detail — Request to Buy / Use SP Button Logic | 5 | Critical | ⏳ |
| TFV2-013 | 13 | Unified Offer Flow — Remove Buy Now + D-20 Value Stack | 5 | Critical | ⏳ |
| TFV2-014 | 14 | Completion Screen — Targeted CTAs by User Type | 5 | High | ⏳ |
| TFV2-015 | 15 | Seller Ignoring Offers Prompt | 6 | Medium | ⏳ |
| TFV2-016 | 16 | Push Notification Schedule + Throttling | 6 | High | ⏳ |
| TFV2-017 | 17 | Dispute State Machine + Admin Dashboard Queue | 7 | High | ⏳ |
| TFV2-018 | 18 | Seller Payout Integration | 7 | High | ⏳ |
| TFV2-019 | 19 | Event Instrumentation — `trade_events` Table | 7 | High | ⏳ |
| TFV2-020 | 20 | Safe Meetup V1-Lite Card | 8 | Medium | ⏳ |
| TFV2-021 | 21 | Structured Pickup Helpers — Chat Quick-Replies | 8 | Medium | ⏳ |
| TFV2-022 | 22 | Cart Bundle Checkout | 8 | Medium | ⏳ |
| **TFV2-023** | **23** | **Progressive Seller Cancellation Consequences** | **8** | **High** | **⏳** |

### Additional Scenario Tests (Post-Audit)

| # | Scenario | Expected Result | Task(s) |
|---|---|---|---|
| T-16 | Seller taps [Cancel] on in_progress trade | Cancel reason modal opens (NOT direct cancel) | TFV2-011 addendum A |
| T-17 | Seller selects "Can't do pickup" and confirms cancel | `cancelTradeV2()` called with reason; level-1 toast shown | TFV2-023 |
| T-18 | Seller cancels 2nd in_progress trade | Level-2 warning toast; `post_acceptance_cancellation_count = 2` | TFV2-023 |
| T-19 | Seller cancels 3rd+ in_progress trade | Level-3 error toast; `admin_review_flagged_at` set; visible in admin | TFV2-023 |
| T-20 | Buyer submits offer (subscriber, 8 SP) | Value stack shows "Platform fee: $0.99 · SP you'll earn: 8 SP ($8 value)" | TFV2-013 addendum B |
| T-21 | Buyer submits cash-only offer (free user) | Value stack shows "Platform fee: $2.99" (no SP segment) | TFV2-013 addendum B |
| T-22 | Seller views in_progress bundle trade | Bundle context banner shows "part of N-item bundle. View all bundle items →" | TFV2-011 addendum C |
| T-23 | Buyer taps [I Got It] on bundle where all siblings are in_progress | "Confirm all N items received?" prompt shown | TFV2-011 addendum C |
| T-24 | Buyer sees TradeListScreen in_progress tab with bundle | "📦 Bundle with [Seller] · N items · In progress" bundle row shown | TFV2-009 addendum D2 |
| T-25 | Seller sees received offers with bundle | Bundle row with [Accept Bundle] / [Review Each] / [Decline All] | TFV2-009 addendum D1 |
| T-26 | Seller opens ReviewOfferScreen for a bundle offer | Bundle context banner + expandable item list + [Accept All N Items] shortcut | TFV2-010 addendum E |

---

*End of MODULE-15.1.2-TradeFlowV2.md*  
*Reference: TRADING-FLOW-V2.md v2.1 (May 26, 2026) — all requirements covered. Post-audit: 23 tasks, 8 gaps patched, 11 additional scenario tests added.*
