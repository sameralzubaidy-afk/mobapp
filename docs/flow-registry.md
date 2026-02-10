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

### FLOW-18: ID Badge Verification (Admin Queue & Review)
- Purpose: Admin reviews and approves/rejects manual ID verification requests from users.
- Smoke: (manual)
  - Admin navigates to `/id-badges` queue page
  - Stats section displays pending, approved, rejected counts and avg review time
  - Filter by Pending/Approved/Rejected updates table correctly
  - Search by user name or email filters results
  - Click "Review" on pending request -> navigates to review page
  - Screenshot displays in review page (if available)
  - Admin approves request with optional notes
  - Screenshot auto-deleted from storage after decision
  - Request status updates to 'approved' in database
  - `reviewed_at` timestamp set correctly
  - Admin rejects request with reason + notes
  - Rejection reason and notes saved to database
  - Queue stats update after each decision
  - Navigation links "ID Badges" and "ID Messages" visible in admin layout
  - Admin navigates to `/id-badges/messages` configuration page
  - All 12 message templates load correctly with template variable reference
  - Admin edits a message, saves, and change persists
  - Template variables (`{first_name}`, `{rejection_reason}`, `{admin_notes}`, `{approval_timeframe_hours}`) preserved in saved messages
  - Validation prevents saving empty messages
  - Changes to messages reflected in actual notifications sent to users
- Required checks:
  - RLS policies: admin can view all requests
  - Storage bucket: `id-badge-verification-screenshots` exists with proper RLS
  - Screenshot deletion is idempotent (no error if already deleted)
  - Signed URLs expire after 1 hour
  - Messages table: admin can UPDATE, all users can SELECT
  - API endpoints: GET `/api/admin/id-badges/messages` and PUT `/api/admin/id-badges/messages/:messageId` working
- Dependencies: BADGE-008 (schema), BADGE-009 (mobile upload flow), BADGE-012 (messages configuration)
- Testing: Manual test guides at `/BADGE-010-MANUAL-TESTING-GUIDE.md` and `/BADGE-012-MANUAL-TESTING-GUIDE.md`
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

### FLOW-21: ID Verification — Manual ID Badge Verification (BADGE-009)

- Purpose: Allow users to voluntarily submit a government ID image for manual admin review. On admin approval the user receives a Verified badge on their profile; on rejection they receive a reason and may resubmit. The flow is privacy-first: screenshots are stored only temporarily and deleted immediately after decision.

- Smoke: `BADGE-009-MANUAL-TESTING-GUIDE.md` (20 test cases)
  - Mobile upload screen (`IDVerificationUploadScreen`) functional with camera + gallery picker
  - Disclaimer text loaded from `id_badge_verification_messages` table (configurable)
  - User uploads ID and receives in-app confirmation + email
  - Submission creates a row in `id_badge_verification_requests` with `status='pending'` and a `screenshot_path` stored in the `id-badge-verification-screenshots` bucket
  - Duplicate submission prevention: users with pending requests cannot submit again (UI blocks with "Verification Pending" message)
  - Admin sees the request in `/admin/ID-badges/` queue, can open the review page, view/download the screenshot, then Approve or Reject with a predefined reason and optional notes
  - On Approval:
    - Screenshot is deleted from storage immediately
    - Request `status` updates to `approved`, `reviewed_at` and `reviewed_by` are set
    - User profile updated (e.g., `profiles.is_verified=true` or `profiles.badge_level='verified'`)
    - Notifications sent (in-app, web push, email) using `id_badge_verification_messages` templates with variable substitution (`{first_name}`, `{rejection_reason}`, `{admin_notes}`)
  - On Rejection:
    - Screenshot is deleted from storage immediately
    - Request `status` updates to `rejected` with `rejection_reason` (6 predefined options) and `rejection_notes` populated
    - User receives rejection notifications with reason and admin notes and may resubmit immediately
    - Profile screen shows "Resubmit Verification" button
  - Upload UI prevents duplicate submissions while a `pending` request exists for the same user (shows "Verification Pending" message instead)
  - Navigation route: `IDVerificationUpload` added to AppNavigator (authenticated stack)

- Automated (offline):
  - Unit tests: `src/services/__tests__/idBadge.test.ts` (getMessage, checkPendingRequest, getVerificationStatus)
  - E2E tests: `src/__tests__/e2e/idBadgeUpload.e2e.test.ts` (requires SUPABASE_E2E_ENABLED=true)
    - Configurable messages fetch
    - Pending request check logic
    - Verification status retrieval
    - Duplicate submission prevention
    - RLS policy enforcement
    - Message template seeding validation (12 required templates)
  - Migration: `20260208000000_id_badge_verification_system.sql` creates tables, enums, RLS policies, and seeds messages

- Admin API endpoints:
  - `GET /api/admin/id-badges?status=&search=` — queue list with filters and pagination (implemented)
  - `GET /api/admin/id-badges/stats` — pending/approved/rejected counts and avg review time (implemented)
  - `GET /api/admin/id-badges/{requestId}` — request details (implemented)
  - `GET /api/admin/id-badges/{requestId}/screenshot-url` — signed URL for admin review (implemented)
  - `POST /api/admin/id-badges/{requestId}/decide` — approve/reject decision endpoint (implemented)
  - `GET /api/admin/id-badges/messages` — fetch all configurable message templates (implemented)
  - `PUT /api/admin/id-badges/messages/{messageId}` — update message template (implemented)

- Verification pointers:
  - RLS policies verified in `20260208000000_id_badge_verification_system.sql`:
    - Users can SELECT own requests, INSERT own requests
    - Admins can SELECT all requests, UPDATE all requests
    - Everyone can SELECT messages (read-only)
    - Admins can UPDATE messages
  - Storage bucket `id-badge-verification-screenshots` must be private:
    - Users can upload to `auth.uid()/*` only
    - Admins can read/delete all files
    - Screenshot deleted immediately after admin decision (idempotent)
  - Messages: 12 configurable templates in `id_badge_verification_messages`:
    - `upload_disclaimer`, `submit_button_label`, `pending_status_text`, `in_app_submission_notification`
    - `approved_email_subject`, `approved_email_body`, `rejected_email_subject`, `rejected_email_body`
    - `in_app_approved_notification`, `in_app_rejected_notification`, `web_push_approved`, `web_push_rejected`
    - Template variables: `{first_name}`, `{rejection_reason}`, `{admin_notes}`, `{approval_timeframe_hours}`
  - SLA: admin_config key `id_badge_verification_approval_sla_hours` (default 24) seeded and used in UI copy
  - Rejection reasons enum: `unclear_photo`, `id_expired`, `name_mismatch`, `multiple_ids`, `not_government_id`, `other`

- Quick manual test (happy path — detailed in BADGE-009-MANUAL-TESTING-GUIDE.md TC5, TC11):
  1. As normal user: Profile → Upgrade to Verified → pick/take photo → Submit
  2. Verify: pending row created in `id_badge_verification_requests`, screenshot exists in storage `{user_id}/{timestamp}.jpg`
  3. As admin: `/admin/ID-badges/` → locate request → Review → Approve with optional notes
  4. Verify: screenshot deleted, request status=`approved`, `reviewed_at`/`reviewed_by` set, profile shows Verified badge, user received notifications

- Quick manual test (reject path — detailed in BADGE-009-MANUAL-TESTING-GUIDE.md TC13, TC14, TC15):
  1. Submit request as user
  2. As admin: Review → Reject with reason=`unclear_photo` and notes="Please retake with better lighting"
  3. Verify: screenshot deleted, request status=`rejected`, `rejection_reason`/`rejection_notes` populated, user notified with reason+notes, "Resubmit Verification" button appears on profile
  4. User resubmits: new request created with status=`pending`, old rejected request preserved as history

- Tier 0 (always):
  - TypeScript compile: `npm run typecheck` or `npx tsc -p tsconfig.json --noEmit` (must pass with no errors)
  - ESLint: `npm run lint` (must pass with no warnings)
  - Unit tests: `npm test -- idBadge.test.ts` (must pass all test cases)

- Tier 1 (targeted regression when upload/admin review flow changes):
  - Manual smoke: Run test cases TC1-TC8 (mobile upload), TC9-TC15 (admin review + notifications) from BADGE-009-MANUAL-TESTING-GUIDE.md
  - E2E: `SUPABASE_E2E_ENABLED=true npm test -- idBadgeUpload.e2e.test.ts` (if Supabase prod credentials available)

- Tier 2 (full regression when DB schema/RLS/migration changes):
  - Rebuild database: `supabase db reset` (staging or test instance)
  - Verify migration: confirm all tables/enums/indexes/policies created correctly
  - Run all 20 test cases from BADGE-009-MANUAL-TESTING-GUIDE.md
  - Verify RLS: users cannot see other users' requests (TC19)
  - Verify stats calculation: admin stats match database query results (TC20)

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

### FLOW-29: ID Badge Submission & Decision Notifications (BADGE-011)

- Purpose: Multi-channel notification system for ID badge verification events. Send web push + in-app + email notifications to users on submission confirmation and approval/rejection decisions. Send admin alerts on new submissions. All messages loaded from configurable `id_badge_verification_messages` table with template variable substitution. Respects user notification preferences.

- Smoke: `BADGE-011-MANUAL-TESTING-GUIDE.md` (9 test cases + regression checks)
  - User submits ID verification → receives submission confirmation via:
    - In-app notification (visible in notification center)
    - Email confirmation with 24-hour SLA message
  - Admin receives alert on new submission:
    - Web push notification (if admin has Expo push token)
    - Admin notifications table entry (type: `id_badge_submission`)
  - Admin approves request with optional notes → user receives:
    - In-app notification: "ID Verification Approved! 🎉"
    - Web push notification: "Your ID verification is complete!"
    - Email: "Your ID Verification is Approved!" with congratulations message
    - Template variables replaced: `{first_name}`, `{admin_notes}`
  - Admin rejects request with reason and notes → user receives:
    - In-app notification with rejection reason
    - Web push notification with actionable message
    - Email with rejection reason formatted: "Reason: [unclear photo]" and admin notes displayed
    - Template variables replaced: `{first_name}`, `{rejection_reason}`, `{admin_notes}`
  - Screenshot auto-deleted from storage immediately after decision (idempotent)
  - Notification preferences respected: user can disable push/in-app/email per category (`id_badge_verification`)
  - Admin activity logged in `admin_activity_log` with action types: `id_badge_approved`, `id_badge_rejected`
  - Duplicate notification prevention: idempotent Edge Function execution

- Edge Functions:
  - `id-badge-submission-notification/index.ts` (180 lines)
    - Handles submission confirmation notifications to user
    - Creates admin alert notifications for all admin users
    - Multi-channel delivery: in-app + email (+ push if available)
  - `id-badge-notifications/index.ts` (265 lines)
    - Handles approval/rejection decision notifications
    - Status update + screenshot deletion + notification dispatch
    - Template variable replacement: `{first_name}`, `{rejection_reason}`, `{admin_notes}`
    - Activity logging for audit trail
  - `send-email/index.ts` — Extended with 3 new email types:
    - `id_badge_approved`: Approval email with congratulations message
    - `id_badge_rejected`: Rejection email with formatted reason and notes
    - `id_badge_submission`: Submission confirmation email
    - `processIDBadgeEmail()` function (83 lines) generates HTML emails with styled rejection reason/notes divs

- Mobile Services Updated:
  - `p2p-kids-marketplace/src/services/idBadge.ts`
    - Added submission notification invocation (lines 126-135)
    - Calls `id-badge-submission-notification` Edge Function after successful ID upload
    - Passes `requestId` and `userId` for notification processing

- Database Dependencies:
  - Tables: `id_badge_verification_requests`, `id_badge_verification_messages`, `notification_preferences`, `notifications`, `admin_notifications`, `admin_activity_log`
  - Storage: `id-badge-verification-screenshots` bucket with RLS policies
  - Message templates: 12 configurable templates with variable placeholders
  - Notification categories: `id_badge_verification` preference category

- Notification Channels:
  - **Web Push**: Expo Push Notifications API (requires push token from `profiles.expo_push_token` or `push_tokens` table)
  - **In-App**: Entries in `notifications` table (queried by mobile app notification center)
  - **Email**: SendGrid API with HTML email generation (requires `SENDGRID_API_KEY` in Edge Function secrets)

- Template Variables:
  - `{first_name}`: User's first name from profile
  - `{rejection_reason}`: Human-readable rejection reason (from enum)
  - `{admin_notes}`: Custom admin notes (optional, max 500 chars)
  - `{approval_timeframe_hours}`: SLA timeframe (default 24 hours from `admin_config`)

- Automated (offline):
  - Unit tests: `p2p-kids-marketplace/src/__tests__/services/idBadgeNotifications.test.ts` (270 lines, 7 test suites)
    - Submission notification logic
    - Approval/rejection notification flows
    - Template variable replacement
    - Admin notification creation
    - Activity logging
    - Multi-channel delivery
    - Preference respect
  - E2E tests: `p2p-kids-marketplace/src/__tests__/e2e/idBadgeNotifications.e2e.test.ts` (300 lines, 5 test suites)
    - Complete notification flow from submission → decision
    - Screenshot deletion verification
    - Preference respect testing
    - Idempotent execution
    - Requires: `TEST_USER_ID` and `TEST_ADMIN_ID` environment variables

- Tier 0 (always):
  - TypeScript compile: `cd p2p-kids-marketplace && npm run typecheck` (must pass)
  - ESLint: `cd p2p-kids-marketplace && npm run lint` (must pass)
  - Unit tests: `cd p2p-kids-marketplace && npm test -- src/__tests__/services/idBadgeNotifications.test.ts` (all tests must pass)

- Tier 1 (targeted regression when notification logic changes):
  - Manual smoke: Run test cases TC1-TC9 from `BADGE-011-MANUAL-TESTING-GUIDE.md`
    - TC1: Submission confirmation notifications
    - TC2: Email notification on submission
    - TC3: Approval notifications (multi-channel)
    - TC4: Rejection notifications with reason
    - TC5: Notification preferences respected
    - TC6: Duplicate notification prevention
    - TC7: Screenshot deletion verification
    - TC8: Message template customization
    - TC9: Admin activity logging
  - E2E: `TEST_USER_ID=[uuid] TEST_ADMIN_ID=[uuid] npm test -- src/__tests__/e2e/idBadgeNotifications.e2e.test.ts` (if Supabase prod credentials available)

- Tier 2 (full regression when Edge Functions/DB schema changes):
  - Deploy Edge Functions: 
    - `supabase functions deploy id-badge-notifications`
    - `supabase functions deploy id-badge-submission-notification`
  - Verify message templates exist: `SELECT COUNT(*) FROM id_badge_verification_messages;` (expect 12 rows)
  - Verify notification preferences: `SELECT * FROM notification_preferences WHERE category = 'id_badge_verification';`
  - Run all 9 test cases from `BADGE-011-MANUAL-TESTING-GUIDE.md`
  - Verify push notification delivery (check Expo Push dashboard)
  - Verify email delivery (check SendGrid dashboard logs)
  - Verify screenshot deletion (query storage bucket after decision)

- Quick manual test (submission flow):
  1. User: Profile → Upgrade to Verified → Upload ID → Submit
  2. Verify: In-app notification created, email sent to user, admin notification created
  3. Query: `SELECT * FROM notifications WHERE user_id = '[user_id]' ORDER BY created_at DESC LIMIT 1;`
  4. Expected: Title "ID Verification Submitted", body matches template

- Quick manual test (approval flow):
  1. Admin: `/id-badges` → Review pending request → Approve with notes
  2. Verify: User receives 3 notifications (in-app + push + email), screenshot deleted
  3. Query: `SELECT screenshot_path FROM id_badge_verification_requests WHERE id = '[request_id]';`
  4. Expected: Screenshot path exists but file deleted from storage
  5. Query: `SELECT * FROM admin_activity_log WHERE action_type = 'id_badge_approved' ORDER BY created_at DESC LIMIT 1;`
  6. Expected: Activity log entry with approval notes in `details` JSON

- Quick manual test (rejection flow):
  1. Admin: Review pending request → Reject with reason "unclear_photo" and notes "Please retake with better lighting"
  2. Verify: User receives rejection email with formatted reason and notes
  3. Check email content: Should display "Reason: unclear photo" and notes in styled div
  4. Query: `SELECT rejection_reason, rejection_notes FROM id_badge_verification_requests WHERE id = '[request_id]';`
  5. Expected: Reason and notes populated, screenshot deleted

- Dependencies:
  - BADGE-008: Database schema for ID badge verification system
  - BADGE-009: Mobile upload flow (`IDVerificationUploadScreen`)
  - BADGE-010: Admin queue and review interface
  - Existing notification infrastructure (profiles.expo_push_token, push_tokens table)
  - SendGrid email service integration

- Verification Checklist Mapping (MODULE-10-ID-BADGE-VERIFICATION-VERIFICATION.md):
  - ✅ **NOTIF-1**: Submission confirmation sent to user (in-app + email)
  - ✅ **NOTIF-2**: Admin alert sent on new submission (push + admin_notifications table)
  - ✅ **NOTIF-3**: Approval notifications sent (in-app + push + email)
  - ✅ **NOTIF-4**: Rejection notifications sent with reason (in-app + push + email)
  - ✅ **NOTIF-5**: Template variables replaced correctly (`{first_name}`, `{rejection_reason}`, `{admin_notes}`)
  - ✅ **NOTIF-6**: User notification preferences respected (push/in-app/email toggles)
  - ✅ **NOTIF-7**: Screenshot deleted immediately after decision
  - ✅ **NOTIF-8**: Activity logged in `admin_activity_log`
  - ✅ **NOTIF-9**: Configurable messages loaded from `id_badge_verification_messages` table
  - ✅ **NOTIF-10**: Idempotent Edge Function execution (no duplicate notifications)

- Known Limitations:
  - Push notifications require valid Expo push token (gracefully skips if unavailable)
  - Email delivery depends on SendGrid API key configuration
  - Screenshot deletion is idempotent but logs warning if file not found (expected after first deletion)
  - Admin push notifications require admin users to have push tokens registered

- Testing Prerequisites:
  - Supabase project with `id_badge_verification_messages` table seeded (12 templates)
  - SendGrid API key configured in Edge Function secrets
  - Test users with valid email addresses and push tokens
  - Admin user with role='admin' in database
  - Storage bucket `id-badge-verification-screenshots` with proper RLS policies
