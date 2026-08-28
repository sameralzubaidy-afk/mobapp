# Module 15: TradeFlow V2 — Parking Lot

## Fix `secure_upsert_admin_config` RPC to set `is_active` and `data_type`

**Issue:** The `secure_upsert_admin_config` RPC only writes `key`, `value`, `category` to the `admin_config` table. It does NOT set `is_active = true` or `data_type = 'number'`, which causes all downstream readers via `getAdminConfig()` to filter out the row (they query with `.eq('is_active', true)`) or fail to parse numeric values.

**Impact:**
- Admin saves `Sp Pending Days = 5` → mobile app still shows `3` (default)
- Admin saves `Sp Expiration Days = 700` → mobile app still shows `365` (default)
- Affects ALL config keys saved via the Config page (`/config`)

**Action Required:**
- [ ] Update `secure_upsert_admin_config` RPC to set `is_active = true` on insert/update
- [ ] Update RPC to set `data_type = 'number'` when value is numeric
- [ ] Run migration to fix existing rows: `UPDATE admin_config SET is_active = true WHERE is_active IS NULL OR is_active = false`
- [ ] Verify via: `SELECT value, is_active, data_type FROM admin_config WHERE key = 'sp_pending_days'`

**Code Location:**
```sql
-- File: supabase/migrations/20260207000002_secure_admin_config_upsert.sql
-- Line: ~32 (INSERT) and ~37 (ON CONFLICT DO UPDATE)
INSERT INTO public.admin_config (key, value, category, updated_at, updated_by)
VALUES (...)
-- Missing: is_active, data_type
```

**Priority:** HIGH — Blocks all admin config from reflecting in mobile app
**Module:** MODULE-15.1.2 TradeFlowV2
**Created:** 2026-07-04

---

## Create sync trigger from `admin_config` → `sp_config`

**Issue:** The `secure_upsert_admin_config` RPC has a comment saying *"The trigger 'trigger_sync_sp_config_on_admin_update' will fire automatically syncing this change to the sp_config table"*, but this trigger does not exist in any migration. The `sp_config` table (which should be the single source of truth per user requirement) is never synced when the admin saves via the Config page.

**Impact:**
- `sp_config` table has stale values
- Mobile app readers that fall through to `sp_config` get wrong values
- Violates the requirement: "sp_config table must always be the single source of truth"

**Action Required:**
- [ ] Create trigger `trigger_sync_sp_config_on_admin_update` on `admin_config` (AFTER INSERT OR UPDATE)
- [ ] Trigger should upsert matching key to `sp_config` with appropriate key mapping
- [ ] Seed initial sync: migrate all existing `admin_config` rows relevant to SP to `sp_config`
- [ ] Verify: save via admin UI → both tables updated

**Priority:** MEDIUM
**Module:** MODULE-15.1.2 TradeFlowV2
**Created:** 2026-07-04

---

## Fix `getSPExpirationDays()` same direct-query pattern as `getSPReleaseDays()`

**Issue:** `getSPExpirationDays()` goes through `getConfigValue('sp_expiration_days')` → `getAdminConfig()` which queries `admin_config` with `.eq('is_active', true)`. Since the RPC doesn't set `is_active = true`, the admin-saved value is filtered out and the default `365` is returned.

**Impact:** Admin sets `Sp Expiration Days = 700` but the wallet banner shows "Points expire after 365 days."

**Action Required:**
- [ ] Apply the same fix pattern as `getSPReleaseDays()`: direct query to `admin_config` bypassing `is_active` filter
- [ ] Add fallback chain: RPC → direct admin_config query → sp_config → default
- [ ] Test: set to 700 → app shows 700

**Code Location:**
```typescript
// File: p2p-kids-marketplace/src/services/adminConfig.ts
// Function: getSPExpirationDays() (line ~280)
```

**Priority:** HIGH — Currently broken for all admin SP config changes
**Module:** MODULE-15.1.2 TradeFlowV2
**Created:** 2026-07-04

---

## Add `forceRefresh` to wallet screen config fetches

**Issue:** The `SpWalletScreen` calls `getSPReleaseDays()` and `getSPExpirationDays()` without `forceRefresh = true`. Both functions eventually read from `getAdminConfig()` which has a 5-minute in-memory cache (`CACHE_TTL_MS = 5 * 60 * 1000`). Pull-to-refresh on the wallet screen does not bypass this cache, so admin changes can take up to 5 minutes to appear.

**Impact:** Admin changes to SP config (pending days, expiration days) don't reflect on the wallet screen until the cache naturally expires or the app is force-killed.

**Action Required:**
- [ ] Pass `forceRefresh = true` to `getSPReleaseDays(true)` and `getSPExpirationDays(true)` in `loadWalletData()` refreshes
- [ ] Alternatively: expose a `clearConfigCache()` function and call it on pull-to-refresh

**Code Location:**
```typescript
// File: p2p-kids-marketplace/src/screens/sp/SpWalletScreen.tsx
// Line: ~73
const releaseDaysVal = await getSPReleaseDays();
// Needs: getSPReleaseDays(true) with forceRefresh
```

**Priority:** MEDIUM
**Module:** MODULE-15.1.2 TradeFlowV2
**Created:** 2026-07-04

---

## Deploy open-dispute Edge Function fix

**Issue:** The `open-dispute` Edge Function has a locally-fixed change (table name `notification_log` → `trade_notification_log`), but the fix has NOT been deployed to Supabase. The current deployed version (v5, 2026-07-03) still writes to `notification_log`, which may not exist, causing silent failures.

**Impact:** Sellers may not receive notifications when a dispute is opened against their trade.

**Action Required:**
- [ ] Deploy: `cd /Users/sameralzubaidi/Desktop/kids_marketplace_app && npx supabase functions deploy open-dispute`
- [ ] Verify by opening a dispute and checking `trade_notification_log` table for the insert

**Code Location:**
```typescript
// File: supabase/functions/open-dispute/index.ts
// Line: ~112
svcClient.from('trade_notification_log').insert({...})
```

**Priority:** MEDIUM
**Module:** MODULE-15.1.2 TradeFlowV2
**Created:** 2026-07-04

---

## Make `MAX_PENDING_OFFERS` admin-configurable

**Issue:** The maximum number of pending offers a buyer can have is hardcoded to `3` in the `create-trade-offer` Edge Function. Admins cannot change this limit without redeploying the Edge Function.

**Code Location:**
```typescript
// File: supabase/functions/create-trade-offer/index.ts
// Line: 25-28
const MAX_PENDING_OFFERS = 3; // TODO(ADMIN-CONFIG): Make this cap configurable
```

**Action Required:**
- [ ] Add `max_pending_offers` column to `admin_config` table (default 3)
- [ ] Add admin UI field on the Trade Timing or Swap Points settings page
- [ ] Update `create-trade-offer` EF to read from `admin_config` at request time
- [ ] Deploy updated EF

**Priority:** MEDIUM
**Module:** MODULE-15.1.2 TradeFlowV2
**Created:** 2026-07-04

---

## Clean up `cancel_trade_v2` double-refund gap

**Issue:** The `cancel-trade` Edge Function has a comment noting that `credit_sp_for_cancelled_trade` RPC should NOT be called because the DB trigger `fn_release_sp_on_cancel` handles SP restoration. However, if other code paths call `cancel_trade_v2` directly (not through the EF), they may skip the trigger's protection or duplicate the refund.

**Code Location:**
```typescript
// File: supabase/functions/cancel-trade/index.ts
// Line: ~100
// Do NOT call credit_sp_for_cancelled_trade here — it would double-credit.
```

**Action Required:**
- [ ] Audit all callers of `cancel_trade_v2` RPC to ensure none also call `credit_sp_for_cancelled_trade`
- [ ] Consider removing the `credit_sp_for_cancelled_trade` RPC entirely if the trigger is the single source of truth
- [ ] Add idempotency check in the trigger to prevent double-release

**Priority:** LOW
**Module:** MODULE-15.1.2 TradeFlowV2
**Created:** 2026-07-04

---

## Seller ignore prompt not firing

> **RESOLVED (2026-08-29, DEV-TASK-34):** the counter is now a true consecutive-expiry streak (`listing_offer_stats.unanswered_offer_count`: +1 per unanswered expiry, reset on seller accept/decline, declines never count) and the nudge copy is *"A few offers on [Item] have gone unanswered. Respond to your pending offers — or pause the listing if you're not able to sell right now."* with [Pause Listing] / [Dismiss]. Live-verified on staging. See `supabase/migrations/20260829000001_dev_task_34_seller_ignore_streak.sql` and `docs/flow-registry.md` DEV-TASK-34.

**Issue (historical):** When a seller receives 2+ consecutive unanswered offers on the same listing, they should receive a push notification: *"You're receiving offers but not responding on [Item]. Want to pause this listing?"* with [Pause Listing] and [Dismiss] actions. This notification is not arriving.

**Action Required:**
- [ ] Investigate the `send-offer-reminders` or `send-trade-notifications` EF for the ignore prompt logic
- [ ] Check `listing_offer_stats` trigger updates on trade creation
- [ ] Verify push delivery pipeline for this notification type

**Priority:** LOW (Deferred from earlier sprint)
**Module:** MODULE-15.1.2 TradeFlowV2
**Created:** 2026-07-04
