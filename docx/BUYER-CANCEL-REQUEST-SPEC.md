# Buyer Cancel Request & Admin Escalation — Implementation Spec

**Status:** Implemented (2026-09-01) · **Applies to:** Mobile (iOS/Android), Admin portal, Supabase backend
**Design basis:** FIX-CANCEL investigation (2026-09-01) → Option A (approved by owner)
**Canonical sources:** this spec + `docx/SYSTEM_REQUIREMENTS_V2.md` §7.12 + `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` Group Z
**Mobile design compliance:** `docx/design-system-passitup.md`

---

## 1. Summary

A buyer on an **in-progress** trade (single-item or bundle) can now submit a **Request to Cancel**. The seller either **approves** (trade is cancelled and the buyer refunded through the existing cancel engine) or **declines** (the request **escalates to admin** for review). If the seller does not respond within a **configurable** window, the request **auto-escalates to admin**.

- The **seller's own instant cancel** is unchanged (auto-refund + TFV2-023 consequence + cancel-anomaly monitoring guard abuse).
- **All escalation behavior is admin-config-driven, not hard-coded.**
- Admin resolves escalated/requested cancels from the **Action Center → Cancel Requests** and the **trade detail page** (Approve Cancel & Refund / Keep Trade).
- The dispute flow ("Report a Problem") is **unchanged** and remains semantically separate (a problem report is not a cancellation).

---

## 2. Decisions (approved 2026-09-01)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Asymmetric mechanics** — seller keeps instant cancel; buyer gets a consent-based request | Money exposure is asymmetric; buyer funds are auto-refunded on cancel, so forcing buyer consent on seller cancels adds friction without protection |
| D2 | **Escalate on decline AND on timeout** (configurable) | Contested or ignored requests are exactly what admin review is for |
| D3 | **Dedicated `cancel_request_*` state** on `trades` (not reusing `dispute_status`) | "I want to cancel" ≠ "there is a problem"; keeps dispute semantics clean |
| D4 | **Whole-bundle by default + per-item option** for the buyer's request | Mirrors the existing seller bundle-cancel choice; a bundle is one offer |
| D5 | **Admin approval as backstop, not pre-approval gate** | Matches industry (eBay/Poshmark/Mercari/Vinted) and keeps seller UX instant |
| D6 | **Config keys live in `admin_config`** (seed migration) | `cancel_request_escalation_enabled`, `cancel_request_response_timeout_hours` |

---

## 3. State machine

Column `trades.cancel_request_status` (nullable overlay):

```
                     ┌──────────────────────────────┐
                     │  requested (awaiting seller) │◄──────────── buyer requests
                     └──────────────┬───────────────┘
                                    │
        ┌───────────────┬───────────┴───────────────┬─────────────────┐
        │ seller approves│ seller declines           │ timeout (cron)  │ buyer withdraws
        ▼                ▼ (escalation enabled)      ▼ (escalation on) ▼
    approved          escalated                    escalated      withdrawn
        │                │                             │
        │                └─────────────┬───────────────┘
        │                              ▼
        │  (cancellation executes via  │
        │   cancel-trade EF / admin    │  admin: approve_cancel → approved (cancelled + refund)
        │   force-cancel)              │  admin: keep_trade      → resolved (keep_trade)
        └──────────────────────────────┘
```

**Enums:**
- `cancel_request_status`: `requested | approved | escalated | resolved | withdrawn`
- `cancel_request_resolution` (set when `resolved`): `approved_cancel | keep_trade`
- `cancel_requested_role`: `buyer | seller` (currently always `buyer` — sellers use the instant cancel)

**Transitions:**
| From | To | Trigger | Side effects |
|---|---|---|---|
| — | `requested` | `fn_request_cancel_trade` (buyer, in_progress, no dispute, no existing request) | sets `expires_at = now + timeout_hours` (config); notifies seller (`cancel_request_sent`) |
| `requested` | `approved` | `fn_respond_cancel_request('approve')` (seller) via `cancel-trade` EF | notifies buyer (`cancel_request_approved`); then EF cancels trade (SP release + Stripe refund + tax void) |
| `requested` | `escalated` | `fn_respond_cancel_request('decline')` (seller) — if escalation enabled | notifies buyer (`cancel_request_escalated`) |
| `requested` | `escalated` | `fn_escalate_expired_cancel_requests()` cron — if escalation enabled | audit row in `cancel_request_escalation_runs` |
| `requested` | `resolved` (keep_trade) | `fn_respond_cancel_request('decline')` — if escalation disabled | notifies buyer (`cancel_request_resolved`) |
| `requested` | `withdrawn` | `fn_withdraw_cancel_request` (buyer) | notifies seller (`cancel_request_withdrawn`) |
| `requested`/`escalated` | `approved` | `fn_resolve_cancel_request('approve_cancel')` (admin) | notifies buyer (`cancel_request_approved`); admin route then runs force-cancel money path |
| `requested`/`escalated` | `resolved` (keep_trade) | `fn_resolve_cancel_request('keep_trade')` (admin) | notifies buyer + seller (`cancel_request_resolved`) |

**Bundle behavior:** when the trade has a `bundle_id`, request/respond/withdraw/resolve **cascade to all sibling trades** sharing the bundle that are in the same transitional state. Admin/ops never have to resolve each bundle line separately.

**Invalidation:** if a trade leaves `in_progress` (completed/cancelled) while a request is pending, the request becomes stale — the RPCs reject new actions on it (`NOT_ACTIONABLE`/`NOT_PENDING`) and the UI hides request controls.

---

## 4. Config keys (`admin_config` — NOT hard-coded)

| Key | Type | Default | Description |
|---|---|---|---|
| `cancel_request_escalation_enabled` | boolean | `true` | When true: seller decline **and** response timeout escalate to admin. When false: a decline ends the request with the trade continuing (no admin review), and the timeout cron does nothing. |
| `cancel_request_response_timeout_hours` | number | `48` | Hours a seller has to respond before auto-escalation. Validated 1–336 by `fn_cancel_request_timeout_hours()` (BP-13 default links to the seed). |

- Read server-side by the SECURITY DEFINER helpers `fn_cancel_request_timeout_hours()` / `fn_cancel_request_escalation_enabled()`.
- Read client-side through `getAdminConfig()` (fields `cancel_request_escalation_enabled`, `cancel_request_response_timeout_hours`) for the UI copy/countdown.
- Admin can edit both in the Trade Timing settings (Group N) — these keys are added to the admin config surface.

---

## 5. Notifications (channels: in-app + push, respecting `notification_preferences` category `trades`)

Rows are created by the RPCs via `create_trade_notification(...)`; push is delivered by the existing `send-trade-notifications` processor (channel `push`).

| Type | Recipient | Title | Body |
|---|---|---|---|
| `cancel_request_sent` | Seller | `Cancellation requested` | `{BuyerName} wants to cancel "{ItemTitle}". Reply in {N}h or our team will review it.` (N = config timeout) |
| `cancel_request_withdrawn` | Seller | `Cancellation withdrawn` | `{BuyerName} withdrew their request to cancel "{ItemTitle}". The trade continues.` |
| `cancel_request_approved` | Buyer | `Cancellation approved` | `Your cancellation for "{ItemTitle}" was approved — your refund is on its way.` |
| `cancel_request_escalated` | Buyer | `Sent to our team` | `The seller did not respond to your cancellation for "{ItemTitle}". Our team is reviewing it now.` |
| `cancel_request_resolved` | Buyer + Seller | `Trade continues` | Buyer: `We reviewed your cancellation request for "{ItemTitle}" — the trade will continue as planned.` · Seller: `The buyer's cancellation request for "{ItemTitle}" was not approved. The trade continues.` |

Deep link for all: `/trades/{tradeId}` (opens the trade timeline with the relevant card). Notification Center icons added for all five types.

---

## 6. Mobile UI (design-system-passitup.md compliant)

### 6.1 Buyer, in-progress trade (`TradeTimelineScreen.tsx`)
- **"Request to Cancel"** — secondary **outline** button (48px pill, 2px border), semantic **Error** `#E85D75` border/text, placed below "Report Problem". `testID: request-cancel-button`. Hidden when an unresolved dispute exists or a request is already pending.
- Tap → (bundle only) **scope prompt**: "Cancel the whole bundle?" → **Whole Bundle** (`all`) / **Just This Item** (`single`). Then `CancellationReasonModal` with `BUYER_INPROGRESS_REASONS` (Changed my mind / No longer need the item / Can't make the meetup / Other).
- **Pending card** (buyer): Info accent `#5B8FB9`, title "Cancel request sent", body "Waiting for the seller to respond — {countdown} left. If they decline or don't reply, our team will review it." + text-only **"Withdraw request"** link (`withdraw-cancel-request-button`).
- **Escalated card** (buyer): Warning tint `#FFF7ED`, title "Sent to our team", body "…our team is reviewing it now."
- **Resolved keep-trade / withdrawn** (buyer): Success tint card "Trade continues" / "Request withdrawn".

### 6.2 Seller, in-progress trade
- **Action card** when a request is pending: title "Cancellation requested", shows the buyer's reason + response countdown, with **Decline** (secondary) and **Approve Cancellation** (error-outline `#E85D75`) buttons (`decline-cancel-request-button` / `approve-cancel-request-button`).
- **Approve** → confirm modal ("Cancel this trade? … This cannot be undone.") → calls the `cancel-trade` EF with `cancel_request_id` → request approved + trade cancelled + refund. **The seller-cancellation consequence (TFV2-023) is SKIPPED** because the seller is approving the buyer's request, not cancelling on their own.
- **Decline** → confirm modal ("Send to our team?") → RPC marks `escalated` → admin queue.

### 6.3 Mobile services (`src/services/tradeServiceV2.ts`)
- `requestCancelTrade(tradeId, userId, reason?, scope)` → RPC `fn_request_cancel_trade`
- `respondToCancelRequest(tradeId, userId, 'approve'|'decline')` → approve: EF `cancel-trade` (`cancel_request_id` marker); decline: RPC `fn_respond_cancel_request`
- `withdrawCancelRequest(tradeId, userId)` → RPC `fn_withdraw_cancel_request`

---

## 7. Backend contract

### 7.1 Columns (`trades`, all nullable)
`cancel_requested_by uuid` · `cancel_requested_role text` · `cancel_request_reason text` · `cancel_request_status text` · `cancel_request_created_at timestamptz` · `cancel_request_expires_at timestamptz` · `cancel_request_resolved_at timestamptz` · `cancel_request_resolved_by uuid` · `cancel_request_resolution text`

- CHECK constraints on status/resolution/role.
- Column-level `REVOKE UPDATE` from `anon`/`authenticated` — only SECURITY DEFINER RPCs (or service role) can write.

### 7.2 RPCs (all SECURITY DEFINER, `search_path = public`)
| RPC | Caller | Behavior |
|---|---|---|
| `fn_request_cancel_trade(p_trade_id, p_user_id, p_reason, p_scope)` | authenticated buyer | validates buyer/in_progress/no-dispute/no-existing; sets request + expiry from config; cascades to bundle; notifies seller |
| `fn_withdraw_cancel_request(p_trade_id, p_user_id)` | authenticated requester | `requested → withdrawn`; cascades to bundle; notifies seller |
| `fn_respond_cancel_request(p_trade_id, p_user_id, p_action)` | authenticated seller | `approve` → approved (+notify buyer); `decline` → escalated if config enabled else resolved/keep_trade; cascades to bundle |
| `fn_escalate_expired_cancel_requests()` | cron / service_role / ops | `requested` + expired → `escalated` (only if escalation enabled); audit row in `cancel_request_escalation_runs` |
| `fn_resolve_cancel_request(p_trade_id, p_admin_id, p_action)` | service_role / authenticated admin | `approve_cancel` → approved (+notify buyer); `keep_trade` → resolved keep_trade (+notify both); records `resolved_by` |
| `fn_admin_list_cancel_requests()` | service_role | feed of `requested`/`escalated` in-progress requests for the Action Center |
| `fn_cancel_request_timeout_hours()` / `fn_cancel_request_escalation_enabled()` | authenticated/service_role | config readers (fail-safe to seed defaults) |

Grants: user RPCs → `authenticated, service_role`; admin/cron RPCs → `service_role` (+`authenticated` for admin-resolve/ops). No `anon`/`PUBLIC` (dt61 guard + explicit REVOKE).

### 7.3 Edge Function `cancel-trade` (extended, backward-compatible)
- New optional body field `cancel_request_id`. When present (seller approving a buyer's request):
  - calls `fn_respond_cancel_request(..., 'approve')` **after** a successful cancel (idempotent, non-fatal);
  - **skips** `fn_handle_seller_cancellation` (no TFV2-023 penalty);
  - logs `trade_events` type `cancel_request_approved` (new `TradeEventType` in `_shared/trade-events.ts`).

### 7.4 Action Center (admin)
- `admin_action_center_summary()` + `admin_action_center_detail('cancel_requests')` extended with the new source (`fn_admin_list_cancel_requests`).
- `GET /api/admin/action-center?source=cancel_requests` returns the feed.

---

## 8. Admin portal

| Surface | Change |
|---|---|
| Action Center | New **Cancel Requests** card (count of `requested` + `escalated`), drill into `/trades` |
| Trade detail (`/trades/[id]`) | **Buyer Cancellation Request** panel: **Approve Cancel & Refund** / **Keep Trade** → confirm → `POST /api/admin/trades/cancel-request-action` |
| New route | `POST /api/admin/trades/cancel-request-action` — `{ tradeId, action, adminId }`; calls `fn_resolve_cancel_request` then (for `approve_cancel`) the existing `admin-trade-action` EF `force-cancel` for SP/Stripe money |
| Auth | `verifyAdminAuth` (x-admin-secret / Bearer JWT) per BP-49; admin JWT recorded for audit |

---

## 9. Security & integrity

- **Money never reimplemented**: approve paths mark state; the existing `cancel-trade` EF / `admin-trade-action` force-cancel do SP release, Stripe refund/cancel, and tax void (idempotent, BP-65/BP-66 discipline).
- **No client-side writes** to `cancel_request_*` (column-level REVOKE; RPC-only).
- **Idempotency**: `fn_respond_cancel_request`/`fn_resolve_cancel_request` reject non-`requested` states; the EF's approve marker is non-fatal on repeat.
- **Party checks**: request RPCs verify the caller is the buyer/seller; the admin RPC verifies `admin_has_role` (or service-role bypass).
- **RLS**: `cancel_request_escalation_runs` is service-role-only.
- **Config fail-safe**: missing/invalid config falls back to the documented seed default (48h / enabled) — never silently diverges.

---

## 10. Testing

### 10.1 Unit (mobile)
- `tradeServiceV2` request/respond/withdraw: correct RPC/EF calls, error parsing, result-checking.
- `CancellationReasonModal`: `BUYER_INPROGRESS_REASONS` list.
- `TradeTimelineScreen`: request button visibility (buyer in_progress, hidden on pending/dispute), pending/escalated/seller cards, approve/decline flows.
- `adminConfig`: new keys parsed.

### 10.2 Integration (staging, read-only/cleanup discipline)
- `fn_request_cancel_trade` guard paths (non-buyer, wrong status, dispute, duplicate) + happy path (verified on staging 2026-09-01: request → expiry 48h → withdraw → clean).
- `fn_escalate_expired_cancel_requests` idempotency + audit row (verified).
- `admin_action_center_summary`/`detail('cancel_requests')` (verified).

### 10.3 Manual (see Group Z in the trade-flow guide)
Z01 request→seller approve→cancel+refund · Z02 request→seller decline→escalated→admin approve-cancel · Z03 timeout auto-escalation · Z04 buyer withdraw · Z05 bundle whole-vs-single · Z06 escalation disabled (decline ends it) · Z07 gating/duplicates (no request while pending/dispute/completed) · Z08 notifications + deep link. Plus Group G notification cases G05–G07.

---

## 11. Rollout

1. Migration applied to staging (2026-09-01, verified). Config defaults seeded.
2. `cancel-trade` EF deployed (v-new, verified live).
3. Mobile build + on-device QA (Group Z). Admin build (done, Tier 0 green).
4. **Rollback**: migration is additive/idempotent — reverting means dropping the columns (safe, no data loss beyond request state) and reverting the EF body; the request features are gated by new fields the old client ignores (backward compatible).

## 12. Version history

| Date | Change |
|---|---|
| 2026-09-01 | Initial spec (Option A approved) + backend/mobile/admin implementation |
