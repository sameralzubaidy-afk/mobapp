# Flow Registry

This file is the canonical registry of end-to-end flows and their required regression checks.

## Flows

### FLOW-00: Infrastructure & Environment Health
- Purpose: App boots; Metro reachable; Supabase env present.
- Smoke: (manual)
  - App boots to login screen without redbox.
  - If network/auth calls stall, app still leaves the full-screen spinner within ~12s and renders the unauthenticated stack.
  - Supabase URL/anon key configured; auth requests succeed.
  - Test hygiene: `yarn test` must not require real Supabase/network by default; Supabase/network E2E tests only run when `SUPABASE_E2E_ENABLED=true` and real `SUPABASE_URL`/keys are provided; Detox E2E tests only run when `RUN_DETOX_E2E=true`.

### FLOW-01: Auth – Signup/Login/Logout/Session Restore
- Smoke: (manual)
  - Signup -> logged in -> kill app -> relaunch -> session restores.
  - Logout returns to unauthenticated stack.
  - Cold launch does not hang indefinitely on a full-screen spinner even if profile/subscription fetches time out.
  - App launch does not get stuck in an auth refresh loop (no repeated profile realtime subscribe spam).

### FLOW-02: Profiles & Onboarding
- Smoke: (manual)
  - New user gets profile row (or profile fetch does not crash).
  - Upload profile avatar -> profile screen re-renders with the new image (avatar URL resolves from `profiles.avatar_url` storage path).
  - Profile realtime listener does not resubscribe continuously while onboarding/profile updates.

### FLOW-03: Node/ZIP Gating + Waitlist
- Smoke: (manual)
  - User is assigned to a node; sees node-scoped content.

### FLOW-04: Listings – Create/Edit/Delete/Expire/Soft Delete
- Smoke: (manual)
  - Create listing -> appears in listings feed for same node.
  - If seller enabled "Accept Swap Points" and is Starter Pack eligible: listing is created with `status='pending'` (not visible in public feed until approved).
  - Pending listing creates `admin_notifications` rows for all admins (notification type `listing_pending_approval`).
  - Admin approves listing -> `items.status` transitions `pending` -> `available` and listing becomes visible.
  - Seller edits an approved listing (e.g., title/price/photos) -> `items.status` transitions `available` -> `pending` and requires admin re-approval.
- Automated (offline): Jest covers listing service lifecycle + SP gating.

### FLOW-05: Media Upload (Storage) – Listing Photos
- Smoke: (manual)
  - Upload photo -> visible via signed/public URL as intended.

### FLOW-06: Discovery – Feed/Search/Filters/Favorites
- Smoke: (manual)
  - Feed loads; search filters update results.
- Automated (offline): Jest covers `getItems` node filtering and NODE-007 radius fetch.

### FLOW-07: Cart & Bundling (if implemented)
- Smoke: (manual)

### FLOW-08: Trade Flow – Checkout + Transaction State Machine
- Smoke: scripts/smoke/transactions.mjs
- Manual checks:
  - Initiate trade -> payment succeeds -> trade status becomes `in_progress`.
  - Two-step completion is enforced regardless of `enable_automatic_seller_payout`.
  - Seller marks trade complete -> trade remains `in_progress`, `seller_marked_completed_at` is set, and NO funds/payouts are released yet (await buyer confirmation).
  - Buyer marks trade complete (or system auto-complete) -> trade becomes `completed`, item becomes `sold`, and seller balance/payout routing runs.
  - Completing a trade does not hard-fail if the seller is missing an `sp_wallets` row; the DB layer must auto-create the wallet and proceed.
  - Completing a trade does not hard-fail if payout-related `admin_config` values are malformed (e.g., JSON-quoted strings). The system must fall back to safe defaults and return a warning in `payout_result`.
  - If buyer uses SP to cover 100% of item price, buyer still pays platform fee by card; Stripe charge amount = `trades.cash_amount_cents + trades.buyer_transaction_fee_cents`.
  - With `enable_automatic_seller_payout=false`: completing a trade increases seller "Available to Withdraw" by `trades.cash_amount_cents` and increases "Lifetime Earnings"; "Pending (In Progress)" reflects any withdrawals in `pending/processing`.
  - When `STRIPE_SECRET_KEY` is missing/blank: payment fails with a clear server config error (not a Stripe runtime error).
  - Seller Stripe Connect onboarding completes -> `seller_payout_methods.stripe_onboarding_complete=true` and (once Stripe enables payouts) `stripe_payouts_enabled=true`.
  - PayPal/Venmo payout: Seller creates PayPal/Venmo payout method, withdraws, and payout moves `pending` -> `processing` after submission; later `completed/failed` via PayPal webhook.
  - Stripe payouts: a `seller_payouts` row with `provider='stripe'` and `provider_reference_id=<stripe payout id>` moves `processing` -> `completed/failed` via Stripe payout webhooks.
- Automated (offline): Jest covers `SellerEarningsScreen` payout summary rendering.

### FLOW-09: Fees & Pricing Engine
- Smoke: (manual)
  - Subscriber fee vs non-subscriber fee matches configuration.

### FLOW-10: Swap Points Wallet – Read + Ledger Integrity
- Smoke: (manual)
  - Wallet shows available/pending; ledger entries append-only.

### FLOW-11: Swap Points – Earn/Spend/Cap + Pending→Release
- Smoke: (manual)
  - 50% cap enforced; buyer fee always cash.
  - First eligible listing approval awards Starter Pack SP once (wallet + ledger updated).

### FLOW-13: Referrals – Code Generation + Apply On Signup
 - Smoke: scripts/smoke/referrals.mjs
  - User A: signup -> Profile shows referral code; DB: `profiles.referral_code` matches `referral_codes.code`.
  - User B: signup with User A code -> `referrals` row created with `status='pending'`.
  - User B: DB: `profiles.referred_by` is set to User A user_id.
  - User A: Referral Dashboard stats show `total=1`, `pending=1`.
  - Persistence: After onboarding/profile upsert completes, `profiles.referral_code` remains non-null (no NULL regression).
- Must validate: user-entered signup referral code is persisted (e.g., `profiles.referred_by_code`) and the relationship is applied (`profiles.referred_by` + `referrals` row)
  - Fail-safe: If auth.users signup trigger was missing, a profiles AFTER INSERT trigger applies referral from auth metadata.
  - Back-compat: apply can resolve codes from `referral_codes.code` OR legacy `profiles.referral_code`.

### FLOW-12: Subscriptions – Purchase/Cancel/Grace Period
- Smoke: (manual)

<!-- Removed duplicate FLOW-13 placeholder; FLOW-13 above is canonical. -->

### FLOW-14: Messaging (Realtime)
  - Open Messages list -> unread badges reflect unread messages only.
  - Tap a conversation -> Chat opens and that conversation’s unread badge clears on returning to the list.
  - New incoming message (other user) increments unread badge until the conversation is opened again.
  - After a trade is completed, messages in that trade get an `expires_at` timestamp (trade completion + configured retention days) and are later soft-deleted by the MSG-004 expiration job.

- Automated (offline): Jest covers MSG-008/MSG-009 chat service helpers (delivery status + typing indicators).

- Smoke: (manual)

### FLOW-16: CPSC Recall Check (if implemented)
- Smoke: (manual)

### FLOW-17: Notifications
- Smoke: (manual)

### FLOW-18: Admin Controls
- Smoke: (manual)
  - Approving a pending listing succeeds and creates an audit row in `admin_activity_log`.
  - Config persistence: update `referral_bonus` in Admin Config UI -> refresh -> value stays updated.
  - DB reflects change: `admin_config.key='referral_bonus'` and `sp_config.config_key='referral_bonus'` match.

### FLOW-19: Analytics Events
- Smoke: (manual)

### FLOW-20: Audit/Logging
- Smoke: (manual)

### FLOW-21: ID Verification — Manual ID Badge Verification

- Purpose: Allow users to voluntarily submit a government ID image for manual admin review. On admin approval the user receives a Verified badge on their profile; on rejection they receive a reason and may resubmit. The flow is privacy-first: screenshots are stored only temporarily and deleted immediately after decision.

- Smoke: (manual)
  - User uploads ID from profile (`IDVerificationUploadScreen`) and receives an in-app confirmation + email.
  - Submission creates a row in `id_badge_verification_requests` with `status='pending'` and a `screenshot_path` stored in the `id-badge-verification-screenshots` bucket.
  - Admin sees the request in `/admin/ID-badges/` queue, can open the review page, view/download the screenshot, then Approve or Reject with a predefined reason and optional notes.
  - On Approval:
    - The screenshot is deleted from storage.
    - The request `status` updates to `approved`, `reviewed_at` and `reviewed_by` are set.
    - User profile updated (e.g., `profiles.is_verified=true` or `profiles.badge_level='verified'`).
    - Notifications sent (in-app, web push, email) using `id_badge_verification_messages` templates.
  - On Rejection:
    - Screenshot is deleted from storage.
    - Request `status` updates to `rejected` with `rejection_reason` and `rejection_notes` populated.
    - User receives rejection notifications with reason and admin notes and may resubmit immediately.
  - Upload UI must prevent duplicate submissions while a `pending` request exists for the same user.

- Automated (offline):
  - Unit tests for `idBadgeService` (submit, status checks), template replacement logic, and permission checks.
  - Edge Function tests for decision/notification handler (`id-badge-decision-notification`).
  - Migration tests for `id_badge_verification_requests` and `id_badge_verification_messages`.

- API endpoints to smoke-test:
  - `GET /api/admin/id-badges?status=&search=` — queue list with filters and pagination
  - `GET /api/admin/id-badges/stats` — pending/approved/rejected counts and avg review time
  - `GET /api/admin/id-badges/{requestId}` — request details
  - `GET /api/admin/id-badges/{requestId}/screenshot-url` — signed URL for admin review
  - `POST /api/admin/id-badges/{requestId}/decide` — approve/reject decision endpoint

- Verification pointers:
  - RLS: ensure `id_badge_verification_requests` has RLS enabling users to SELECT/INSERT their own rows and admins to SELECT/UPDATE all rows.
  - Storage: bucket `id-badge-verification-screenshots` must be private; policy permits users to upload to `auth.uid()/*` and admins to read/delete.
  - Messages: configurable templates live in `id_badge_verification_messages` and support `{first_name}`, `{rejection_reason}`, `{admin_notes}`, `{approval_timeframe_hours}`.
  - SLA: admin_config key `id_badge_verification_approval_sla_hours` (default 24) should be seeded and respected in UI copy.

- Quick manual test (happy path):
  1. As normal user: navigate to profile → Upgrade to Verified → pick/take photo → Submit.
  2. Verify a `pending` row is created and screenshot exists in storage under `{user_id}/`.
  3. As admin: open `/admin/ID-badges/`, locate request, open review, approve.
  4. Verify screenshot is deleted, request marked `approved`, profile shows Verified badge, and user received notifications.

- Quick manual test (reject path):
  1. Submit new request as user.
  2. As admin: reject with reason `unclear_photo` and notes.
  3. Verify screenshot deleted, request marked `rejected`, user notified, and resubmission is allowed.

### FLOW-22: Seller Payouts & Withdrawals — Seller balance withdrawal lifecycle
- Purpose: End-to-end seller payout lifecycle: request withdrawal, verify payout method, queue for processing, provider settlement, retry/failure handling, and audit trail. Includes admin overrides and idempotency for transfers.
- Smoke: `scripts/smoke/payouts-withdrawals.mjs`
- Tier: 2 (payments + DB changes)
- Quick checks: verify `seller_payout_methods` (is_verified), withdrawal status transitions (`requires_action` → `processing` → `completed`/`failed`), and audit entries in `seller_payouts`.

### FLOW-23: Payout Method Verification — Bank / PayPal / Plaid verification flow
- Purpose: Verify a seller's payout method before it can be used for withdrawals; handle micro-deposits, provider callbacks, marking `payout_method.is_verified`, and rollback on failure.
- Smoke: `scripts/smoke/payout-method-verification.mjs`
- Tier: 2
- Quick checks: simulate micro-deposit verification, PayPal verification callback, and ensure `is_verified` prevents/permits withdrawals as expected.

### FLOW-24: MFA / Multi-Factor Enrollment & Assurance Level
- Purpose: MFA enrollment (TOTP/SMS/WebAuthn), factor verification and management, and mapping to Authenticator Assurance Level (AAL). Includes recovery and factor removal flows.
- Smoke: `scripts/smoke/mfa-enrollment.mjs`
- Tier: 1 (escalate to Tier 2 for auth schema changes)
- Quick checks: enroll a factor, verify factor becomes `verified`, and `getAuthenticatorAssuranceLevel()` returns expected values.

### FLOW-25: Manual Payout / Admin Payout Processing — Admin-triggered payouts & overrides
- Purpose: Admin queue for manual payouts, retry and override controls, manual settlement steps and finance audit logging.
- Smoke: `scripts/smoke/admin-manual-payouts.mjs`
- Tier: 2
- Quick checks: create a manual payout, mark processed by admin, verify audit log and payout status change.

### FLOW-26: Webhook Processing & Verification — External provider webhooks
- Purpose: Reliable webhook ingestion (Stripe, PayPal, Plaid), verify signatures, idempotent processing, reconcile external events with internal state, and audit webhook receipts.
- Smoke: `scripts/smoke/webhooks.mjs`
- Tier: 2
- Quick checks: send a signed test webhook, verify signature validation, idempotent handling, and resulting DB state change.

### FLOW-27: Refunds & Cancellations — Refund settlement and state machine
- Purpose: Buyer/seller cancellations and refund processing, linking refund events to transactions, reversing SP/state where applicable, and notifying parties.
- Smoke: `scripts/smoke/refunds-cancellations.mjs`
- Tier: 1 (Tier 2 if changing transaction/RPC logic)
- Quick checks: trigger a cancellation, verify refund/hold logic, ensure platform fee treatment and SP reversal rules.

### FLOW-28: Cron & Background Jobs — Scheduled tasks and maintenance
- Purpose: Scheduled background jobs: release pending Swap Points, expire/inactivate stale data, cleanup temporary screenshots, run payout retries, and run maintenance smoke scripts.
- Smoke: `scripts/smoke/cron-jobs.mjs`
- Tier: 1 (Tier 2 if adding DB migrations or changing cron-critical logic)
- Quick checks: run scheduled job locally or via runner, confirm SP pending→released transition and deletion of temporary screenshots.
