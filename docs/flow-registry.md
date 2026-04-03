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
  - Signup automatically records current `terms_of_service` and `privacy_policy` acceptance rows (if published) in `policy_acceptances`.
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
  - **SAFETY-P001 (2026-03-28):** Item Images Storage Bucket
    - Migration: `20260328000100_create_item_images_bucket.sql`
    - Storage bucket: `item-images` (public, 5MB limit, allowed: JPEG/PNG/WebP/GIF)
    - RLS policies:
      - Sellers can upload/update/delete images for their own listings
      - Public read access to all listing images
      - Service role full access for moderation/admin
    - Unit tests: `src/__tests__/storage-item-images.unit.test.ts`
    - E2E tests: `src/__tests__/e2e/storage-item-images.e2e.test.ts`
    - Manual test guide: `SAFETY-P001-MANUAL-TESTING.md` (12 test cases)
    - Maestro flow: `.maestro/listing-create.yaml` (updated with image upload)
    - Verification: TC-001 to TC-012 in manual test guide
  - **SAFETY-P002 (2026-03-28):** Image Picker and Upload in CreateListingScreen
    - Component: `src/components/molecules/ImagePickerGrid.tsx` (NEW)
    - Service: `uploadListingImages()` added to `src/services/listing.ts`
    - Features:
      - Multi-image picker (up to 5 photos from gallery or camera)
      - Image preview with reorder (← →) and delete (×) buttons
      - First image = cover image (marked with "Cover" badge)
      - File size validation (5 MB max per image)
      - Upload progress indicator
      - Graceful error handling (listing created even if image upload fails)
    - Upload flow:
      1. Create listing in DB
      2. Upload images to `item-images/{seller_id}/{item_id}/{index}.jpg`
      3. Insert rows into `item_images` table with public URLs and `display_order`
    - Unit tests: `src/__tests__/components/ImagePickerGrid.test.tsx` (state matrix: empty, with images, at limit, uploading, permissions denied)
    - E2E tests: `src/__tests__/e2e/listing-image-upload.e2e.test.ts` (upload 1, upload multiple, verify DB, verify public URLs, storage path convention)
    - Manual test guide: `SAFETY-P002-MANUAL-TESTING-GUIDE.md` (18 test cases)
    - Maestro flow: `.maestro/listing-create.yaml` (updated to test image picker, reorder, delete, multi-image upload)
    - Verification: TC-001 to TC-018 in manual test guide
  - **SAFETY-P003 (2026-03-29):** Item Flagged/Rejected Status + Seller Notification
    - Migration: `supabase/migrations/301_items_flagged_rejected_statuses.sql`
    - Features:
      - Extend `items.status` CHECK constraint to include 'flagged' and 'rejected' statuses
      - Add audit columns: `flagged_at`, `rejected_at`, `rejection_reason`, `appeal_count`
      - DB trigger: `on_item_status_change_notify_seller` inserts into `user_notifications` when item flagged/rejected
      - RLS update: flagged/rejected items visible only to seller + admins
      - Seller receives push/in-app notification with rejection reason
      - Appeal count tracks seller resubmissions
    - TypeScript: `ListingStatus` type updated to include 'flagged' | 'rejected' in `src/types/listing.ts`
    - Admin UI: `p2p-kids-admin/src/app/items/flagged/page.tsx` - review/approve/reject flagged items
    - Unit Tests: `p2p-kids-marketplace/src/__tests__/services/safety-p003.unit.test.ts`
    - E2E Tests: `e2e/safety-p003-item-flagging.integration.test.ts`
    - Manual Test Guide: `SAFETY-P003-MANUAL-TEST-GUIDE.md` (10 test cases)
    - Maestro Flow: `.maestro/safety-p003-item-flagging.yaml`
    - Verification: TC-001 to TC-010 in manual test guide
    - Tier: Tier 1 (targeted smoke); Tier 2 if DB trigger/RLS changes
    - **SAFETY-P003 Mobile Hotfix (2026-03-29):** My Listings tap opens Item Details for flagged/rejected
      - App file: `p2p-kids-marketplace/src/screens/listing/MyListingsScreen.tsx`
      - Change: tapping listing card now opens review/detail route with `listing_id`
      - Scope: seller can open details for non-active statuses (`flagged`, `rejected`) while keeping Edit/Delete for active listings
      - Unit test: `p2p-kids-marketplace/src/__tests__/screens/MyListingsScreen.test.tsx`
    - **SAFETY-P003 UX Enhancement (2026-03-29):** Dedicated Seller Safety Review + Appeal screen
      - App file: `p2p-kids-marketplace/src/screens/listing/ListingSafetyReviewScreen.tsx`
      - Navigation: `ListingSafetyReview` route in `src/navigation/types.ts` and `src/navigation/AppNavigator.tsx`
      - My Listings behavior: rejected/flagged cards open safety review screen; other statuses open listing detail
      - Appeal action: `submitListingAppeal()` in `src/services/listing.ts` transitions `rejected` -> `flagged`
      - **Appeal Context Enhancement (2026-03-29):** Seller must provide appeal reason text
        - Migration: `supabase/migrations/302_safety_p003_add_appeal_reason.sql`
        - DB fields: `items.appeal_reason`, `items.appealed_at`
        - Mobile UX: appeal text area on safety review screen before submit
        - Admin UX: flagged review page shows latest seller appeal note and appealed timestamp
      - Unit tests:
        - `p2p-kids-marketplace/src/services/__tests__/listing-appeal.test.ts`
        - `p2p-kids-marketplace/src/__tests__/screens/MyListingsScreen.test.tsx`
  - **SAFETY-008 (2026-03-30):** Admin review workflow includes Request Edits action
    - Existing admin route retained: `/items/flagged`
    - API route extended: `p2p-kids-admin/src/app/api/admin/items/[id]/status/route.ts`
    - Admin UI extended in-place: `p2p-kids-admin/src/app/items/flagged/page.tsx`
    - New status supported: `needs_edits`
    - Seller notification trigger extended via migration: `supabase/migrations/20260330000001_safety_008_request_edits_status.sql`
    - Unit tests: `p2p-kids-admin/src/lib/__tests__/itemModerationStatus.test.ts`
    - E2E tests: `p2p-kids-admin/__tests__/e2e/items-flagged-status.e2e.test.ts`
    - Maestro flow: `.maestro/safety-008-admin-review-request-edits.yaml`
  - **SAFETY-009 (2026-03-31):** Seller Appeal Workflow (Resubmit with Changes)
    - Purpose: Allow sellers to appeal rejected listings, edit and resubmit for admin review with tracking of appeal history
    - Scope:
      - Seller can view rejection reason on safety review screen for rejected listings
      - Seller provides appeal reason text (min 10 chars) explaining why listing should be reviewed again
      - Appeal transitions item from `rejected` → `flagged` (re-enters moderation queue)
      - Admin sees appeal count and latest appeal note in moderation queue
      - Appeal history tracked via `items.appeal_count`, `items.appeal_reason`, `items.appealed_at`
    - Database:
      - Tables: `items` (with `appeal_count`, `appeal_reason`, `appealed_at` columns added in migration 302)
      - Migration: `supabase/migrations/302_safety_p003_add_appeal_reason.sql` (already exists from SAFETY-P003)
      - Migration: `supabase/migrations/20260402000001_safety_009_dynamic_appeal_limits_and_edit_tracking.sql`
        - Adds: `items.edited_since_rejection`, `items.edited_since_rejection_at`
        - Seeds moderation config keys:
          - `moderation_appeal_max_attempts` (default: `3`)
          - `moderation_appeal_window_days` (default: `14`)
      - Index: `idx_items_appealed_at_flagged` for admin review queue performance
    - Mobile App:
      - Service function: `submitListingAppeal(listing_id, seller_id, appeal_reason)` in `p2p-kids-marketplace/src/services/listing.ts`
        - Validates appeal reason (not empty, min 10 chars)
        - Checks listing exists and user is seller
        - Validates status is 'rejected'
        - Enforces max attempts from admin config (`moderation_appeal_max_attempts`)
        - Enforces appeal window from admin config (`moderation_appeal_window_days`)
        - Requires `edited_since_rejection=true` before allowing appeal submit
        - Updates: `status='flagged'`, `flagged_at=NOW()`, `appealed_at=NOW()`, `appeal_reason=text` (appeal_count continues to increment on each admin rejection cycle)
        - Returns updated listing
      - UI screen: `p2p-kids-marketplace/src/screens/listing/ListingSafetyReviewScreen.tsx`
        - Displays rejection reason for rejected listings
        - Appeal text input with character counter (0/500)
        - Submit appeal button (disabled when reason empty or too short)
        - Confirmation alert before submission
        - Success feedback after appeal submitted
        - Edit Listing and Back to My Listings navigation buttons
      - Navigation: `ListingSafetyReview` route in `src/navigation/types.ts` (with param `{ listing_id: string }`)
    - Admin Portal:
      - Route: `p2p-kids-admin/src/app/items/flagged/page.tsx`
      - Displays: appeal count, latest appeal note in moderation queue table
      - Actions: Review button opens modal with approve/reject options
    - Unit Tests:
      - `p2p-kids-marketplace/src/__tests__/screens/ListingSafetyReviewScreen.test.tsx`
        - Coverage: loading state, error state (listing not found), flagged listing (no appeal UI), rejected listing (with appeal UI), appeal button enabled when reason valid, submitting appeal, edit listing navigation, back to my listings navigation, not owner error
        - State matrix: 9 test cases covering all interaction states
    - E2E Tests:
      - `p2p-kids-marketplace/src/__tests__/integration/safety-009-seller-appeal.e2e.test.ts`
        - Requires: `RUN_SUPABASE_E2E=true` environment variable
        - Coverage: submit appeal and transition rejected→flagged, reject empty/short appeal reasons (validation), reject unauthorized appeals (not seller), track appeal history with multiple appeals, verify DB state after each operation
        - 6 comprehensive test cases against real Supabase
    - Maestro Flow:
      - `.maestro/safety-009-seller-appeal.yaml`
        - States covered: rejected-no-appeal, rejected-appeal-submitted, flagged-after-appeal
        - Steps: login as seller → my listings → open rejected listing → validate too short appeal (5 chars) → submit valid appeal (110 chars) → verify status transition to flagged → verify appeal count incremented
        - 8 major steps with assertions at each transition
    - Manual Testing Guide:
      - `SAFETY-009-MANUAL-TESTING-GUIDE.md`
        - Preconditions: SQL to create test seller and rejected listing
        - Test cases: TC-001 to TC-012 covering: view rejected listing, open safety review screen, rejection reason display, appeal validation (empty/too short), character counter, submit appeal, DB verification, admin queue visibility, multiple appeals, edit listing navigation
        - Cleanup: SQL to remove test data
        - Troubleshooting: common issues (Supabase connection, test user not found, rejected listing not visible)
        - Sign-off checklist
    - Dependencies:
      - SAFETY-P003 (items.status extension to include 'flagged' and 'rejected')
      - Migration 301 (status extension)
      - Migration 302 (appeal metadata columns)
    - Tier Classification:
      - Tier 0: Always (lint + typecheck + unit tests)
      - Tier 1: When service/UI changes (targeted E2E + Maestro)
      - Tier 2: Not required (no DB migration changes; existing migrations 301/302 already applied)
    - Module: MODULE-13-SAFETY-COMPLIANCE (TASK P009: Seller Appeal Workflow)
    - Verification: See `Prompts/MODULE-13-VERIFICATION.md` for completion criteria
- Automated (offline): Jest covers listing service lifecycle + SP gating.
- E2E (Supabase prod): `p2p-kids-marketplace/src/__tests__/e2e/referral-listing-bonus.e2e.ts` covers referral listing bonus awarding end-to-end.

### FLOW-05: Media Upload (Storage) – Listing Photos
- Smoke: (manual)
  - Upload photo -> visible via signed/public URL as intended.
  - **SAFETY-004 Hotfix (2026-03-29):** Expo filesystem + moderation log schema drift
    - Mobile storage service switched to `expo-file-system/legacy` to remove SDK 54 deprecation warnings in runtime uploads.
    - Added migration: `supabase/migrations/20260329000002_fix_ai_moderation_logs_schema_drift.sql` to guarantee `ai_moderation_logs.image_url` exists and trigger PostgREST schema cache reload.
    - Edge Function hardening: `supabase/functions/moderate-image/index.ts` now retries moderation log insert for legacy schemas (`image_url`/`url`/`image_uri`, `flagged` compatibility).
  - **SAFETY-P001 (2026-03-28):** Item Images Bucket Creation
    - Bucket: `item-images` with 5MB file size limit
    - Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp, image/gif
    - RLS policies enforce seller ownership for upload/delete
    - Public read access for all users (listings are public)
    - Service role bypass for admin/moderation operations
    - CDN cache purge on delete (when configured)
  - Upload verification:
    - Multiple images can be uploaded to a single listing
    - Images stored at path: `{item_id}/{filename}`
    - Public URLs accessible without authentication
    - File size >5MB rejected with clear error
    - Unauthorized uploads/deletes rejected by RLS
  - Integration: Storage service (`src/services/supabase/storage.ts`) uses bucket type safety

### FLOW-06: Discovery – Feed/Search/Filters/Favorites
- Smoke: (manual)
  - Feed loads; search filters update results.
  - **DISCOVERY-IMG-PARITY (2026-03-29):** Listing image rendering parity across discovery surfaces
    - Fixed screens/components:
      - `src/screens/home/BrowseItemsScreen.tsx`
      - `src/screens/home/SearchScreen.tsx`
      - `src/screens/home/CategoryBrowseScreen.tsx`
      - `src/components/organisms/RecommendationsCarousel/index.tsx`
      - `src/screens/listing/MyListingsScreen.tsx`
      - `src/screens/trade/TradeListScreen.tsx`
    - Service enrichment:
      - `src/services/discovery.ts` now attaches sorted `item_images` rows to search/category/recommendation responses.
      - `src/types/discovery.ts` includes optional `images` for `SearchResult`, `CategoryResult`, and `Recommendation`.
    - Required manual checks:
      - Search in Browse tab shows listing thumbnails (not placeholder-only) when images exist.
      - Search screen rows show listing thumbnails.
      - Category browse cards show listing thumbnails.
      - Dashboard recommendations cards show listing thumbnails.
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

### FLOW-12: Subscriptions – Purchase/Cancel/Grace Period + Tier Configuration
- Smoke: scripts/smoke/subscriptions.mjs (TODO: implement)
- **SUB-020 Regression Fix (2026-03-12):**
  - Renewal path from `ContinueKidsClub` now routes grace/expired users through `create-subscription-from-payment-method` (paid renewal path) instead of legacy `create-subscription-payment`.
  - Billing writes now persist admin-configured amount and upsert billing history on successful payment in `supabase/functions/create-subscription-from-payment-method/index.ts`.
  - Hardcoded grace window removed from admin manual-cancel API and trial conversion downgrade RPC (`20260312000001_fix_dynamic_grace_period_trial_conversion.sql`).

### FLOW-16: CPSC Recall Imports – Daily Batch Import + Recall Database
- Purpose: Automated daily imports of CPSC safety recalls for product safety checking
- Covers:
  - CPSC API daily batch import via Edge Function
  - Recall data storage in cpsc_recalls table
  - Import logging and error tracking
  - pg_cron scheduled job execution at 2:00 AM UTC
  - Recall deduplication by recall_number
  - Full-text search capability for recall matching
  - Public read access for safety transparency
- Database:
  - Tables: `cpsc_recalls` (recall data), `cpsc_import_log` (import history)
  - Indexes: recall_number, recall_date, product_name (trgm), keywords (tsvector)
  - RLS: Public read, service role write, admin manage
- Edge Function: `supabase/functions/import-cpsc-recalls/index.ts`
- Migration: `supabase/migrations/303_cpsc_recalls_schema.sql`
- Scheduled Job: `supabase/migrations/304_schedule_cpsc_import.sql`
- Manual Test Guide: `SAFETY-001-MANUAL-TESTING-GUIDE.md` (12 test cases)
- Unit Tests: `supabase/functions/import-cpsc-recalls/__tests__/index.unit.test.ts`
- E2E Tests: `p2p-kids-marketplace/src/__tests__/e2e/cpsc-import.e2e.test.ts`
- Maestro Flow: `p2p-kids-marketplace/.maestro/cpsc-import-flow.yaml`
- Smoke: (automated daily via pg_cron)
  - Import runs at 2:00 AM UTC without manual intervention
  - Successful imports log to cpsc_import_log with status='success'
  - Failed imports log with status='failed' and error details
  - Duplicates are skipped (upsert by recall_number)
  - Recalls searchable via product name, date, keywords
- Manual Verification:
  - Admin can view import logs via Supabase SQL Editor
  - Recalls are publicly readable (no auth required)
  - Import can be manually triggered via Edge Function for testing
  - Cron job execution logs visible in cron.job_run_details
- Tier: Tier 1 for Edge Function changes; Tier 2 if database schema or RLS policies change
- Dependencies: INFRA-001 (Supabase setup), pg_cron extension enabled

### FLOW-17: Google Vision Image Moderation – AI Safety Check (SAFETY-004)
- Purpose: Automated image moderation for listing photos using Google Vision Safe Search API
- Covers:
  - Google Vision API integration via Edge Function
  - Safe Search detection (adult, violence, racy, medical, spoof)
  - Moderation log storage (ai_moderation_logs table)
  - Automatic item flagging for unsafe content (LIKELY/VERY_LIKELY)
  - Safety flags creation (item_safety_flags table)
  - Item status update to 'flagged' for review
  - Fire-and-forget async moderation (non-blocking)
- Database:
  - Tables: `ai_moderation_logs` (moderation results), `item_safety_flags` (safety flags)
  - Migration: `supabase/migrations/306_ai_moderation_logs_table.sql`
  - RLS: Admin read logs, service role write logs
- Edge Function: `supabase/functions/moderate-image/index.ts`
- Mobile Integration:
  - Service: `p2p-kids-marketplace/src/services/imageModeration.ts`
  - Called from `uploadListingImages()` in `listing.ts`
  - Moderation runs after image upload completes
  - Errors do not block listing creation (fail-open)
- Manual Test Guide: `SAFETY-004-MANUAL-TESTING-GUIDE.md` (10 test cases)
- Unit Tests: `p2p-kids-marketplace/src/__tests__/services/imageModeration.test.ts`
- E2E Tests: `p2p-kids-marketplace/src/__tests__/e2e/safety-004-image-moderation.e2e.test.ts`
- Maestro Flow: `p2p-kids-marketplace/.maestro/safety-004-image-moderation.yaml`
- Smoke: (automated on image upload)
  - Safe images pass moderation (decision='approved', confidence <0.5)
  - Flagged images create safety flag and update item status to 'flagged'
  - All moderation results logged with confidence scores and details
  - Multiple images moderated sequentially
  - Moderation failures do not crash app or block listing
- Manual Verification:
  - Admin can view moderation logs in admin portal (future)
  - Flagged items visible in My Listings with safety review UI
  - Seller receives notification when item is flagged
- Tier: Tier 1 for Edge Function or service changes; Tier 2 if database schema or RLS policies change
- Dependencies: SAFETY-P001 (item-images bucket), SAFETY-P002 (image upload), GOOGLE_VISION_API_KEY configured
- Prerequisites: Google Cloud Vision API enabled and API key configured in Supabase Edge Function secrets

### FLOW-18: Admin Controls – Config + Overrides + Revenue Analytics + User Management
- Purpose: Admin can configure platform settings, view revenue metrics, analytics, and manage users
- Smoke: (manual)
  - Admin can navigate to `/analytics` dashboard
  - Revenue metrics display: MRR, ARR, transaction fees, ARPU
  - Engagement metrics display: DAU, MAU, DAU/MAU ratio
  - Time series data loads for day/week/month intervals
  - Date range filters work (7D, 30D, 90D, 1Y)
  - All metrics calculate correctly based on subscriptions and trades
  - **ADMIN-V2-005 (2026-03-25):** Revenue & Analytics Dashboard
    - RPCs: `get_revenue_metrics`, `get_engagement_metrics`, `get_revenue_time_series`
    - API: `/api/admin/analytics/revenue`
    - UI: `/analytics` page with comprehensive metrics and charts
  - **ADMIN-V2-006 (2026-03-26):** User Management Dashboard
    - Purpose: Admin can view, search, filter, suspend, unsuspend, delete users, reset passwords
    - Migration: `supabase/migrations/126_admin_user_management.sql`
    - RPCs: `admin_list_users`, `admin_get_user_analytics`, `admin_get_user_detail`, `admin_suspend_user`, `admin_unsuspend_user`, `admin_delete_user`
    - Edge Function: `supabase/functions/admin-trigger-password-reset/index.ts`
    - Admin API Routes:
      - `/api/admin/users` (GET - paginated list with search/filters)
      - `/api/admin/users/analytics` (GET - user analytics)
      - `/api/admin/users/[id]` (GET detail / DELETE soft delete)
      - `/api/admin/users/[id]/suspend` (POST)
      - `/api/admin/users/[id]/unsuspend` (POST)
      - `/api/admin/users/[id]/reset-password` (POST)
    - Admin UI: `p2p-kids-admin/src/app/users/page.tsx` (comprehensive user management dashboard)
    - Features:
      - User analytics: total users, active, suspended, new this month, DAU, MAU, deleted, subscribers
      - Paginated user list with search (name/email/phone)
      - Filters: account status (active/suspended/deleted), subscription status
      - User detail panel: identity, subscription, SP wallet, trade activity, badges, admin activity log
      - Admin actions: suspend, unsuspend, soft delete, trigger password reset
      - Audit logging: all actions logged to `admin_activity_log`
      - Security: admin role verification, self-deletion prevention
      - Soft delete: SP wallet freezing, user cannot login
    - Manual Test Guide: `ADMIN-V2-006-MANUAL-TESTING-GUIDE.md` (23 test cases)
    - Unit Tests: `p2p-kids-admin/src/__tests__/admin-user-management.unit.test.ts`
    - E2E Tests: `p2p-kids-admin/src/__tests__/integration/admin-user-management.e2e.test.ts`
    - Tier: Tier 1 for user management changes; Tier 2 if auth/RLS/audit system changes
    - **ADMIN-V2-006 Hotfix Chain (2026-03-28):** RPC schema alignment + delete action stability
      - Migrations: `20260328000016` through `20260328000023`
      - Fixes covered:
        - aggregate ordering in list/detail RPC JSON aggregation
        - profile DOB source (`profiles.dob`)
        - SP wallet state source (`sp_wallets.state`)
        - badge icon source (`badges.icon_url`)
        - recent activity entity comparison cast safety (`entity_id::TEXT`)
        - delete flow wallet freeze column (`state`, not `status`)
        - admin activity log writes UUID `entity_id` values for suspend/unsuspend/delete
      - Smoke verification:
        - `admin_list_users` RPC returns paginated users without schema errors
        - `admin_get_user_detail` RPC returns identity/subscription/wallet/activity payload
        - `admin_delete_user`, `admin_suspend_user`, `admin_unsuspend_user` RPCs return success payloads
    - **ADMIN-V2-006 Hotfix (2026-03-28):** Deleted account-status filter support
      - Migration: `20260328000025_fix_admin_list_users_deleted_filter.sql`
      - Fixes covered:
        - account-status filter now supports `deleted` and returns soft-deleted users (`profiles.deleted_at IS NOT NULL`)
        - list rows returned for deleted users are labeled with `account_status = 'deleted'` for UI badge rendering
      - Smoke verification:
        - `admin_list_users(p_account_status => 'deleted')` returns deleted users
        - Users page Account Status dropdown `Deleted` option returns deleted rows
    - **ADMIN-V2-006 Hotfix (2026-03-28):** Null account-status regression guard
      - Migration: `20260328000026_fix_admin_list_users_null_status_filter.sql`
      - Fixes covered:
        - `admin_list_users` now treats null `p_account_status` as non-deleted list mode (prevents empty "All users" result)
      - Smoke verification:
        - `admin_list_users(p_account_status => NULL)` returns active user list
        - `admin_list_users(p_account_status => 'deleted')` still returns soft-deleted users
    - **ADMIN-V2-006 Hotfix (2026-03-28):** Mandatory identity fallback + profile backfill for TC-009
      - Migration: `20260328000027_fix_admin_identity_phone_dob_backfill.sql`
      - Fixes covered:
        - `admin_get_user_detail` identity now falls back to `auth.users.raw_user_meta_data` when `profiles.phone/dob` are missing
        - profile backfill updates missing/blank `profiles.phone` and missing `profiles.dob` from `auth.users` metadata
      - Smoke verification:
        - `admin_get_user_detail` returns non-null `identity.phone` and `identity.date_of_birth` for users with metadata values
        - post-backfill query shows reduced null/blank phone and null DOB counts in `profiles`
    - **ADMIN-V2-006 Mobile Gate (2026-03-28):** Suspended account blocked screen
      - App files:
        - `p2p-kids-marketplace/src/navigation/AppNavigator.tsx`
        - `p2p-kids-marketplace/src/contexts/AuthContext.tsx`
        - `p2p-kids-marketplace/src/screens/auth/SuspendedAccountScreen.tsx`
      - Behavior:
        - suspended users can authenticate but are routed to `SuspendedAccount`
        - blocked screen shows contact-admin message with placeholder support email
      - Smoke verification:
        - after admin suspend, user login lands on suspended screen (no normal app access)
        - after unsuspend, user login returns to normal auth/onboarding/dashboard route logic
    - **ADMIN-V2-006 Mobile Gate (2026-03-28):** Soft-deleted users blocked from login
      - App files:
        - `p2p-kids-marketplace/src/services/auth.ts`
        - `p2p-kids-marketplace/src/contexts/AuthContext.tsx`
        - `p2p-kids-marketplace/src/screens/auth/LoginScreen.tsx`
      - Behavior:
        - login is rejected when `profiles.deleted_at IS NOT NULL`
        - existing sessions for deleted users are signed out during startup/refresh
      - Smoke verification:
        - after admin soft delete, target user cannot log in and receives deleted-account message
        - `sp_wallets.state` is `frozen` for deleted user when wallet exists
  - **ADMIN-V2-007 (2026-03-25):** Admin Panel UI Theme & Layout Redesign (PRESENTATION ONLY)
    - Purpose: Redesign admin panel visual layer with consistent design system
    - Scope: **UI-ONLY** (no backend, no DB, no RLS changes)
    - Design Tokens:
      - Tailwind config extended with admin theme colors (deep purple sidebar, lavender content bg)
      - CSS custom properties for consistent theming
      - TypeScript theme.ts for inline style access
    - Components Created:
      - `Sidebar.tsx` - Fixed left sidebar (collapsible 256px → 64px, deep purple #3D1073)
      - `TopNavbar.tsx` - Fixed top navbar (white, 64px height, search/brand/notifications/profile)
      - `AdminShell.tsx` - Layout wrapper managing sidebar/topbar/main content positioning
      - `MetricCard.tsx` - Reusable metric display cards with icon colors + trends
      - `ChartCard.tsx` - Chart wrapper cards with period filters
    - Files Updated:
      - `tailwind.config.js` - Design token colors + shadows
      - `globals.css` - CSS variables + custom scrollbar styling
      - `layout.tsx` - Uses AdminShell instead of ProtectedLayout
    - Visual Features:
      - Deep purple sidebar (#3D1073) with gradient brand logo
      - White topbar with centered branding + search + notifications
      - Light lavender content background (#F2F0FB)
      - White metric/chart cards with subtle purple shadows
      - Smooth collapse/expand transitions (300ms)
      - Custom scrollbar (4px, purple)
      - Hover effects on nav items and interactive elements
    - Navigation Items: Dashboard, Users, Subscriptions, SP Wallet, Badges, Listings, Trades, Reviews, Analytics, Payouts, Referrals, ID Badges, Nodes, Config
    - Manual Test Guide: `ADMIN-V2-007-MANUAL-TESTING-GUIDE.md` (23 test cases)
    - Unit Tests:
      - `__tests__/components/layout/Sidebar.test.tsx`
      - `__tests__/components/layout/TopNavbar.test.tsx`
      - `__tests__/components/ui/MetricCard.test.tsx`
      - `__tests__/components/ui/ChartCard.test.tsx`
      - `__tests__/theme/design-tokens.test.ts`
    - Integration Test: `__tests__/integration/admin-ui-theme.integration.test.tsx`
    - Tier: Tier 0 (lint + typecheck + build) required; Tier 1 for UI smoke test
    - Dependencies: `lucide-react` (icons must be installed)
    - Backward Compat: Existing admin pages work with new theme; old ProtectedLayout replaced cleanly
- Automated:
  - Unit tests: `p2p-kids-admin/src/lib/__tests__/revenueAnalytics.test.ts`
  - E2E tests: `p2p-kids-admin/src/__tests__/e2e/revenue-analytics.e2e.ts`
  - User Management Unit tests: `p2p-kids-admin/src/__tests__/admin-user-management.unit.test.ts`
  - User Management E2E tests: `p2p-kids-admin/src/__tests__/integration/admin-user-management.e2e.test.ts`
  - **ADMIN-V2-007** Unit tests: 5 unit test files + 1 integration test (see above)

- **SUB-020 Trial Limit Control (NEW):**
  - DB migration: `supabase/migrations/20260312000000_sub_020_trial_limit_control.sql`
  - New RPCs: `get_trial_limit_status`, `increment_trial_uses`, `admin_reset_trial_uses`
  - Updated RPCs: `is_user_trial_eligible`, `create_trial_subscription`, `upgrade_free_subscription_to_trial`
  - Mobile UI: `p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx`
  - Service: `p2p-kids-marketplace/src/services/subscription.ts`
  - Manual tests: `docs/manual-verification/SUB-020-TRIAL-LIMIT-MANUAL-TEST-CASES.md`
  - Maestro: `p2p-kids-marketplace/.maestro/sub-020-trial-limit.yaml`
  - E2E (Supabase): `p2p-kids-marketplace/src/__tests__/e2e/sub-020-trial-limit.e2e.ts`
  - Unit: `p2p-kids-marketplace/src/services/__tests__/subscription.test.ts` (trial-limit section)
- Unit/UI: `p2p-kids-marketplace/src/components/subscription/__tests__/SubscriptionBanner.test.tsx` covers banner CTA routing.
- Hooks: `p2p-kids-marketplace/src/hooks/__tests__/useSubscription.test.ts` and `p2p-kids-marketplace/src/hooks/__tests__/useGracePeriodStatus.test.ts` cover subscription/grace-period derived UI state.
- **SUB-003 Manual Test Guide:** SUB-003-MANUAL-TESTING-GUIDE.md
- **SUB-003 Unit Tests:** p2p-kids-marketplace/src/__tests__/services/subscription-sub-003.unit.test.ts

### FLOW-12A: Subscription Payment Collection (Stripe Payment Sheet) — SUB-015
- Purpose: Collect payment method securely via Stripe Payment Sheet for new subscriptions and renewals
- Covers:
  - SetupIntent creation for payment method collection
  - Stripe Payment Sheet modal (native iOS/Android)
  - Payment method storage for future charges
  - Subscription creation with saved payment method
  - Error handling (card declined, network issues)
  - Re-subscribe from grace period with saved payment method
  - Billing history entry creation
- Automated Tests:
  - Unit: `p2p-kids-marketplace/src/hooks/__tests__/usePaymentSheet.test.ts`
  - Unit: `p2p-kids-marketplace/src/components/subscription/__tests__/SubscribeButton.test.tsx`
  - Integration: `p2p-kids-marketplace/e2e/subscription-payment-flow.integration.test.ts`
  - Maestro: `p2p-kids-marketplace/.maestro/subscription-payment-flow.yaml`
- Manual Verification: `docs/manual-verification/SUB-015-verification.md`
- Edge Functions:
  - `create-payment-setup-intent` (SetupIntent creation)
  - `create-subscription-from-payment-method` (Subscription creation post-payment)
- Note: Stripe Payment Sheet requires manual testing with real test cards (cannot be fully automated)
- SUB-016/SUB-017 coverage additions:
  - Re-subscribe from `grace_period` and `expired` is handled in `ManageKidsClubScreen` via `resubscribe()` and `renew-subscription`.
  - Missing saved payment method path now routes to `SubscriptionPaymentScreen` (manual test: `SUB-016-017-MANUAL-TEST-CASES.md`, TC-016-03).
  - Billing history screen uses `getBillingHistory` service and is reachable from manage/subscription flows.
- **SUB-011 Admin Management:**
  - **Admin UI:** p2p-kids-admin/src/app/subscriptions/manage/page.tsx - subscription monitoring dashboard with metrics (MRR, active subs, churn rate), grace period configuration, and admin actions (cancel, extend trial, reactivate)
  - **Admin API:** p2p-kids-admin/src/app/api/admin/subscriptions/route.ts (GET) and p2p-kids-admin/src/app/api/admin/subscriptions/actions/route.ts (POST)
  - **Unit Tests:** p2p-kids-admin/src/__tests__/api/admin/subscriptions.test.ts - metrics calculation, admin action validation
  - **E2E Tests:** p2p-kids-admin/src/__tests__/e2e/subscription-admin-management.e2e.ts - full admin workflow testing
  - **Manual Test Guide:** SUB-011-MANUAL-TESTING-GUIDE.md - comprehensive test cases for admin portal
  - **Key Features:**
    - View subscription list filtered by status (trial, active, grace_period, cancelled, expired)
    - Display key metrics: MRR, active subscribers, trial users, grace period users, churn rate
    - Configure grace period duration (default: 90 days) and reminder thresholds (e.g., [60, 30, 7, 1])
    - Admin actions: manually cancel subscriptions, extend trial periods, reactivate cancelled/expired subscriptions
    - Audit logging for all admin actions
    - Real-time validation and feedback for configuration changes
- **SUB-003 E2E Tests:** p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-003.e2e.ts
- **SUB-005 Trial Conversion & Downgrade:**
  - **Manual Test Guide:** SUB-005-MANUAL-TESTING-GUIDE.md
- **SUB-006 Trial-to-Paid Conversion (Stripe Payment):**
  - **Manual Test Guide:** SUB-006-MANUAL-TESTING-GUIDE.md
  - **Unit Tests:** p2p-kids-marketplace/src/__tests__/services/subscription-sub-006.unit.test.ts
  - **E2E Tests:** p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-006.e2e.ts
- **SUB-007 Stripe Webhook Handling (Status & Billing Updates):**
  - **Edge Function:** supabase/functions/stripe-webhook-subscriptions/index.ts
  - **Events:** customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
  - **State transitions:** active → cancelled (cancel_at_period_end), active → grace_period (deleted/3 retries), payment_retry_count 0→3 → grace_period
  - **Manual Test Guide:** SUB-007-MANUAL-TESTING-GUIDE.md
  - **Unit Tests (Deno):** supabase/functions/stripe-webhook-subscriptions/__tests__/webhook.unit.test.ts
  - **E2E Tests (Jest):** p2p-kids-marketplace/src/__tests__/e2e/sub-007-webhook.e2e.ts
  - **UI Verification Screen:** SubscriptionStatus (navigate from UserDashboard subscription card, AdminDashboard, or Settings)
- **SUB-008 User-Initiated Cancellation Flow:**
  - **Edge Function:** supabase/functions/cancel-subscription/index.ts
  - **State transitions:** active → cancelled (benefits until period end), trial+SP → grace_period (dynamic admin-config grace days), trial-SP → free
  - **Grace-period source of truth:** `admin_config.grace_period_days` (with backward-compatible fallback paths in service/function)
  - **Mobile Screen:** p2p-kids-marketplace/src/screens/subscription/ManageKidsClubScreen.tsx
  - **Service:** p2p-kids-marketplace/src/services/subscription.ts (cancelSubscription function)
  - **Manual Test Guide:** SUB-008-MANUAL-TEST-CASES.md
  - **Unit Tests:** p2p-kids-marketplace/src/__tests__/services/subscription-sub-008.unit.test.ts
  - **E2E Tests:** p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-008.e2e.ts
  - **Deep Link:** p2pkidsmarketplace://manage-kids-club
  - **Features:** Cancel reason analytics, SP wallet freeze for grace_period, re-subscribe CTA
  - **Tier:** 1 for cancellation logic; Tier 2 if SP wallet freeze or grace period logic changed
  - **Tier:** 1 for webhook logic changes; Tier 2 if DB migrations or RPC changes touched
  - **Env Required:** STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET (separate from trade webhook secret)
  - **Edge Functions:** 
    - `supabase/functions/setup-subscription-payment/index.ts` (SetupIntent for payment collection)
    - `supabase/functions/create-subscription-payment/index.ts` (Create Stripe subscription with payment)
  - **Mobile Screen:** `p2p-kids-marketplace/src/screens/subscription/ContinueKidsClubScreen.tsx`
  - **Service:** `p2p-kids-marketplace/src/services/subscriptions/trialToPaidConversion.ts`
  - **Flow:** User taps "Start/Continue Kids Club+" from Profile → Stripe Payment Sheet → Payment method collected → Subscription created with trial window → First charge occurs after free period ends (unless canceled)
  - **Unit Tests:** p2p-kids-marketplace/src/services/subscriptions/__tests__/trialConversion.test.ts
  - **E2E Tests:** p2p-kids-marketplace/e2e/trial-conversion.e2e.test.ts
  - **Migration:** supabase/migrations/20260215000001_trial_conversion_rpcs.sql
  - **Edge Function:** supabase/functions/trial-conversion/index.ts
  - **Test Screen:** p2p-kids-marketplace/src/screens/admin/TrialConversionTestScreen.tsx
- **SUB-009 Grace Period Countdown, Reminders & Expiry:**
  - **Edge Function:** supabase/functions/grace-period-cron/index.ts
  - **UI Component:** p2p-kids-marketplace/src/components/GracePeriodBanner.tsx
  - **Dashboard Integration:** UserDashboardScreen renders GracePeriodBanner for grace_period users
  - **Features:** 
    - Daily cron checks grace_period subscriptions
    - Reminders at 60, 30, 7, 1 days remaining
    - Countdown banner with urgency levels (warning >7d, urgent 1-7d, critical ≤1d)
    - Expiry triggers SP wallet deletion and status → expired
  - **Manual Test Guide:** SUB-009-MANUAL-TEST-CASES-UPDATED.md
  - **Unit Tests (Deno):** supabase/functions/grace-period-cron/__tests__/index.test.ts
  - **E2E Tests (Jest):** p2p-kids-marketplace/src/__tests__/e2e/sub-009-grace-period.e2e.ts
  - **Tier:** 1 for reminder thresholds; Tier 2 if cron logic or SP expiry logic changes

- **SUB-010 Subscription UI Components (Member-Facing):**
  - **Mobile Screens:**
    - `p2p-kids-marketplace/src/screens/subscription/KidsClubOverviewScreen.tsx` (marketing + benefits + status + CTA)
  - **Reusable Components:**
    - `p2p-kids-marketplace/src/components/subscription/SubscriptionStatusCard.tsx` (status card with tier, price, dates)
    - `p2p-kids-marketplace/src/components/subscription/SubscriptionBanner.tsx` (thin banner for home/wallet/listing flows)
  - **Hooks:**
    - `p2p-kids-marketplace/src/hooks/useSubscription.ts` (fetches subscription data)
    - `p2p-kids-marketplace/src/hooks/useGracePeriodStatus.ts` (calculates grace period countdown + messaging)
  - **Utils:**
    - `p2p-kids-marketplace/src/utils/formatPrice.ts` (formats cents to dollar strings)
  - **Deep Link:** p2pkidsmarketplace://kids-club-overview
  - **Features:** State-aware CTAs (free→trial, trial→payment, active→manage, grace→resubscribe), benefit list, "How It Works" section, grace period warnings
  - **Manual Test Guide:** SUB-010-MANUAL-TESTING-GUIDE.md
  - **Unit Tests:**
    - p2p-kids-marketplace/src/utils/__tests__/formatPrice.test.ts
    - p2p-kids-marketplace/src/hooks/__tests__/useSubscription.test.ts
    - p2p-kids-marketplace/src/hooks/__tests__/useGracePeriodStatus.test.ts
    - p2p-kids-marketplace/src/components/subscription/__tests__/SubscriptionStatusCard.test.tsx
    - p2p-kids-marketplace/src/components/subscription/__tests__/SubscriptionBanner.test.tsx
  - **E2E Tests:** p2p-kids-marketplace/src/__tests__/e2e/sub-010-subscription-ui.e2e.ts
  - **Navigation:** Routes added to AppNavigator.tsx + linking config
  - **Tier:** 1 for UI/component changes; no DB/RPC changes required

- Manual checks:
  - **SUB-001 Foundation:**
    - `subscription_tiers` table exists with Kids Club+ tier seeded correctly ($4.99, 30d trial, grace period is dynamic from admin config).
    - All 7 features seeded: `can_earn_sp`, `can_spend_sp`, `can_donate`, `reduced_fee`, `priority_matching`, `early_access`, `priority_support`.
    - RLS policies allow public SELECT for active tiers and features.
    - Service layer: `getActiveSubscriptionTiers()`, `getKidsClubPlusTier()`, `checkTierFeature()` work correctly.
    - TypeScript types compile without errors.
  - **SUB-002 Subscription Table & Status Management (COMPLETED):**
    - `subscriptions` table enhanced with grace period tracking (`grace_started_at`, `grace_ends_at`).
    - Cancellation fields added: `cancelled_at`, `cancel_reason`, `cancel_at_period_end`.
    - Billing cycle fields: `monthly_price_cents`, `last_payment_date`, `last_payment_amount`, `next_billing_date`.
    - Payment retry tracking: `payment_failed_at`, `payment_retry_count` (0-3).
    - Pause feature: `paused_until` (retention - keeps access during pause).
    - Auto-renewal control: `auto_renew_enabled` (user can toggle).
    - Trial abuse prevention: `has_used_trial` flag.
    - Saved payment method: `stripe_payment_method_id` (for seamless re-subscribe).
    - Status constraint updated with V2.1 states: 'free', 'trial', 'active', 'paused', 'cancelled', 'grace_period', 'expired'.
    - RPC functions: `get_subscription_status`, `can_user_earn_sp`, `can_user_spend_sp`, `get_user_transaction_fee`, `is_user_trial_eligible`, `update_subscription_status`, `record_payment_attempt`.
    - TypeScript service: Enhanced `getSubscriptionSummary()` with all V2.1 fields, `isTrialEligible()`, `getTransactionFee()`, `getSubscriptionDetails()`.
    - Unit tests: `/src/services/__tests__/subscription.test.ts` (covers all statuses and feature gates).
    - E2E tests: `/src/__tests__/e2e/subscription-sub-002.e2e.ts` (verifies RPC functions and status transitions).
    - Manual test cases: `SUB-002-MANUAL-TEST-CASES.md` (20 test cases for simulators).

  - **SUB-004 Trial Reminder Notifications (COMPLETED):**
    - Edge Function: `supabase/functions/trial-reminders/index.ts` - Daily cron job to send reminders at Day 23, 28, 29.
    - Database flags: `trial_reminder_day_23_sent`, `trial_reminder_day_28_sent`, `trial_reminder_day_29_sent` prevent duplicates.
    - Reminder schedule: Day 23 (7 days remaining), Day 28 (2 days remaining), Day 29 (1 day remaining).
    - Notification content: Unique title and message for each reminder day with increasing urgency.
    - Integration: Calls existing `send-push-notification` Edge Function for delivery.
  
  - **SUB-014 Billing History Tracking (COMPLETED - 2026-03-03):**
    - Database: `billing_history` table created to log all subscription charges, failures, and refunds.
    - Migration: `supabase/migrations/20260303000000_create_billing_history_sub_014.sql`
    - Schema: Tracks `charge_id` (Stripe), `stripe_invoice_id`, `amount`, `currency`, `status` (succeeded/failed/refunded/pending), `charged_at`, `description`, `error_message`.

  - **SUB-018 Payment Failure Handling & Automatic Retry (COMPLETED - 2026-03-07):**
    - **Edge Function:** `supabase/functions/retry-failed-payment/index.ts` - Allows user to manually retry failed payment
    - **Webhook Handler:** `supabase/functions/stripe-webhook-subscriptions/index.ts` - Updated to handle `invoice.payment_failed` event
    - **Mobile Components:**
      - `p2p-kids-marketplace/src/components/subscription/PaymentFailureBanner.tsx` - In-app banner showing payment failure status
      - `p2p-kids-marketplace/src/hooks/usePaymentFailure.ts` - Hook to detect and manage payment failure states
    - **Service:** `p2p-kids-marketplace/src/services/paymentRetry.ts` - Service layer for retry logic and notifications
    - **Features:**
      - Automatic retry tracking: payment_retry_count (0-3) increments on each `invoice.payment_failed` webhook
      - Retry schedule: Day 3, Day 7, Day 14 (Stripe handles auto-retry)
      - Escalating notifications: Push notifications sent after each failure (retry 1, 2, 3)
      - User banners: Different urgency levels (medium for retry 1, high for retry 2+)
      - Grace period entry: After 3 failures, user transitions to `grace_period` and SP wallet is frozen
      - Manual retry: User can update payment method and manually retry via ManageKidsClub screen
      - Banner dismissal: Users can temporarily dismiss banner (reappears on app restart if issue persists)
    - **Manual Test Guide:** SUB-018-MANUAL-TEST-CASES.md (11 test cases)
    - **Unit Tests:**
      - p2p-kids-marketplace/src/hooks/__tests__/usePaymentFailure.test.ts
      - p2p-kids-marketplace/src/components/subscription/__tests__/PaymentFailureBanner.test.tsx
      - p2p-kids-marketplace/src/services/__tests__/paymentRetry.test.ts
    - **E2E Tests:** p2p-kids-marketplace/e2e/sub-018-payment-failure.integration.test.ts
    - **Maestro Flow:** p2p-kids-marketplace/.maestro/payment-failure-handling.yaml
    - **Tier:** 1 for UI/banner changes; Tier 2 if webhook handler or RPC logic changes
    - RLS: Users can view their own billing history; service role has full access for webhooks.
    - Indexes: 5 performance indexes on user_id, subscription_id, charge_id, status, charged_at.
    - TypeScript Types: `src/types/billingHistory.types.ts` - BillingHistory, BillingStatus, CreateBillingHistoryParams, BillingHistorySummary.
    - Service Layer: `src/services/billingHistory.ts` - getBillingHistory(), createBillingRecord(), updateBillingRecordStatus(), getBillingHistorySummary().
    - Unit Tests: `src/services/__tests__/billingHistory.test.ts` (13 tests - all CRUD operations, summary calculations).
    - E2E Tests: `src/__tests__/e2e/billing-history-sub-014.e2e.ts` (18 tests - real Supabase, verify table, RLS, CRUD).
    - Manual Test Guide: `SUB-014-MANUAL-TEST-CASES.md` (20 test cases for iOS/Android simulators).
    - Purpose: Immutable audit trail for all billing events, supports receipt/invoice functionality, reconciliation with Stripe.
    - Integration Points: Ready for webhook integration (SUB-015), billing history UI (SUB-016), admin dashboard (SUB-017).
    - Tier: 0 for new billing logic; Tier 1 for webhook integration; Tier 2 if billing_history schema changes.
    - TypeScript service: `trialReminders.ts` with `getTrialReminderStatus()`, `calculateDaysRemaining()`, `getTrialReminderMessage()`.
    - UI Component: `TrialReminderBanner.tsx` displays reminders on Dashboard with color-coded urgency (blue/orange/red).
    - Idempotency: Flags ensure reminders are sent exactly once per milestone.
    - Unit tests: `p2p-kids-marketplace/src/services/subscriptions/__tests__/trialReminders.test.ts`.
    - E2E tests: `p2p-kids-marketplace/e2e/trial-reminders.e2e.ts`.
    - Manual testing guide: `SUB-004-MANUAL-TESTING-GUIDE.md`.

  - **Subscription Lifecycle (TODO: SUB-003+):**
    - User starts trial -> `user_subscriptions.status = 'trial'`.
    - Trial expires without payment -> transitions to `grace_period`.
    - User cancels active subscription -> keeps access until period end, then moves to `grace_period`.
    - Grace period expires (`admin_config.grace_period_days`) -> SP wallet permanently deleted, status becomes `expired`.
- Automated (offline): 
  - Unit tests: `subscriptionTiers.test.ts` validates service layer functions.
  - E2E tests: `sub-001-subscription-tiers.e2e.ts` validates database schema and RLS policies.

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

### FLOW-16: CPSC Recall Matching – Item Safety Check Against Recall Database (SAFETY-002)
- Purpose: Automatically check new listing titles/descriptions against CPSC recalls database using fuzzy matching; flag items that match recalled products for admin review before listing goes live
- Covers:
  - Fuzzy text matching using PostgreSQL pg_trgm (trigram similarity)
  - Full-text search using tsvector for comprehensive recall detection
  - Automatic item flagging when match confidence >= threshold (default 0.5)
  - Safety flag creation with confidence score and recall reference
  - Seller notification of potential safety match
  - Admin queue for reviewing flagged items
  - Feature flag control via admin_config (cpsc_check_enabled)
  - Configurable match threshold via admin_config (cpsc_match_threshold)
- Database:
  - Tables: `item_safety_flags` (NEW - stores flagged items with match metadata)
  - Function: `check_cpsc_recalls(p_title, p_description)` (NEW - returns matching recalls with similarity scores)
  - RLS: Admins view all flags, item owners view own flags, service role can insert
  - Indexes: item_id, status, flag_type for performance
- Edge Function: `supabase/functions/check-item-safety/index.ts` (NEW)
- Mobile Service: `src/services/safety.ts` (NEW - checkItemSafety, getItemSafetyFlags, isCpscCheckEnabled, getCpscMatchThreshold)
- Integration: `src/services/listing.ts` createListing() fires async CPSC check after listing creation (fire-and-forget pattern)
- Migration: `supabase/migrations/305_item_safety_flags_and_cpsc_matching.sql`
- Manual Test Guide: `SAFETY-002-MANUAL-TESTING-GUIDE.md` (7 test cases)
- Unit Tests:
  - `p2p-kids-marketplace/src/services/__tests__/safety.test.ts` (safety service functions)
  - `supabase/functions/check-item-safety/__tests__/index.unit.test.ts` (Edge Function logic)
- E2E Tests: `p2p-kids-marketplace/src/__tests__/e2e/cpsc-recall-matching.e2e.test.ts`
- Maestro Flow: `p2p-kids-marketplace/.maestro/safety-002-cpsc-recall-matching.yaml`
- Smoke: (manual via SAFETY-002 guide + automated via Maestro)
  - User creates listing with safe product name -> listing created successfully, no safety flags
  - User creates listing with recalled product name (e.g., "Fisher-Price Rock 'n Play") -> item automatically flagged, safety flag row created with confidence score >= 0.5
  - Flagged item status transitions to 'flagged' in items table
  - Seller receives notification about potential safety match
  - Admin views flagged items queue and sees match details
  - CPSC check can be disabled via admin_config.cpsc_check_enabled = false
  - Match threshold can be adjusted via admin_config.cpsc_match_threshold
  - Fire-and-forget: CPSC check failures don't block listing creation
  - check_cpsc_recalls() function returns matches with similarity_score, recall_id, recall_number, product_name, hazards
- Manual Verification:
  - Create test listing with known recalled product name from cpsc_recalls table
  - Verify item_safety_flags row created with correct recall_id reference
  - Verify items.status changed to 'flagged' and flagged_at timestamp set
  - Verify confidence score calculated correctly (trigram similarity)
  - Admin can view flagged items and recall details
  - Seller can view safety flag reason on their listing
- Tier: Tier 1 for Edge Function/service changes; Tier 2 if database function or RLS policies change
- Dependencies: 
  - SAFETY-001 (CPSC Recall Imports - requires cpsc_recalls table populated)
  - SAFETY-P003 (Item Flagged/Rejected Status - requires items.status extension)
  - INFRA-001 (Supabase setup), pg_trgm extension enabled

### FLOW-17: Notifications
- Smoke: (manual)
- **NOTIF-V2-001 (MODULE-14): Notification Schema & Preferences**
  - Purpose: Allow users to manage notification preferences per category (subscription, sp_events, badges, trades, system) and channel (push, in-app, email)
  - Database:
    - Migration: `supabase/migrations/201_notifications_schema_v2.sql`
    - Tables: `notification_preferences` (user_id, category, push_enabled, in_app_enabled, email_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
    - Enums: `notification_category` (5 types), `notification_status` (3 states)
    - RLS policies: Users can read/update only their own preferences
    - Trigger: `initialize_notification_preferences()` auto-creates 5 default preference rows for new users
    - Default quiet hours: 22:00-08:00
  - Mobile App:
    - Service: `p2p-kids-marketplace/src/services/notificationPreferences.ts`
      - Functions: `getNotificationPreferences()`, `updateNotificationPreference()`
      - Self-healing: Auto-initializes if user has no preferences
    - Screen: `p2p-kids-marketplace/src/screens/profile/NotificationPreferencesScreen.tsx`
      - 5 category sections with icon + label
      - 3 toggle switches per category (push/in-app/email)
      - Quiet hours section with enable toggle + time pickers (start/end)
      - Optimistic updates for immediate feedback
      - Error handling with Alert dialogs
    - Navigation: Route `NotificationPreferences` in AppNavigator (authenticated stack)
  - Testing:
    - Unit tests: `p2p-kids-marketplace/src/__tests__/services/notificationPreferences.test.ts` (12 test cases)
    - E2E tests: `p2p-kids-marketplace/e2e/notificationPreferences.e2e.test.ts` (20+ integration tests with RLS verification)
    - Maestro flow: `.maestro/notification-preferences.yaml` (16-step UI flow testing all toggles, quiet hours, persistence)
    - Manual test guide: `p2p-kids-marketplace/docs/manual-tests/NOTIF-V2-001-Notification-Preferences-Manual-Tests.md` (12 test cases including security RLS tests)
  - Verification: MODULE-14-VERIFICATION-V2.md checklist items 1.1-1.8 (Database, Functional, UI, Security sections)

### FLOW-18: Admin Controls
- Smoke: (manual)
  - Approving a pending listing succeeds and creates an audit row in `admin_activity_log`.
  - Config persistence: update `referral_bonus` in Admin Config UI -> refresh -> value stays updated.
  - DB reflects change: `admin_config.key='referral_bonus'` and `sp_config.config_key='referral_bonus'` match.

### FLOW-19: Analytics Events
- Smoke: (manual)

### FLOW-20: Audit/Logging
- Smoke: (manual)
- Cron Observability Addendum:
  - Use `public.get_cron_jobs_with_last_run(false, '<TZ>')` to guarantee one status row per job.
  - Use `public.get_cron_recent_runs(48, 500, '<TZ>')` for run history with UTC+local timestamps.
  - Admin API endpoints:
    - `GET /api/admin/cron-jobs?includeInactive=false&timezone=America/Los_Angeles`
    - `GET /api/admin/cron-runs?lookbackHours=48&limit=500&timezone=America/Los_Angeles`

### FLOW-21: ID Verification — Manual ID Badge Verification (BADGE-009, BADGE-013)

- Purpose: Allow users to voluntarily submit a government ID image for manual admin review. On admin approval the user receives a Verified badge on their profile; on rejection they receive a reason and may resubmit. Profile screen displays verification status dynamically. The flow is privacy-first: screenshots are stored only temporarily and deleted immediately after decision.

- Smoke: 
  - `BADGE-009-MANUAL-TESTING-GUIDE.md` (20 test cases - Upload Flow)
  - `BADGE-013-MANUAL-TESTING-GUIDE.md` (20 test cases - Profile Display)
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
  - **BADGE-013: Profile Display Integration**
    - `ProfileScreen.tsx` displays Identity Verification section with dynamic status badges
    - Four status states: None (Upgrade CTA), Pending, Approved, Rejected
    - Pending b
    - `src/__tests__/e2e/idBadgeUpload.e2e.test.ts` (upload flow, requires SUPABASE_E2E_ENABLED=true)
    - `src/__tests__/e2e/idBadgeProfileDisplay.e2e.test.ts` (profile status display, ynamic text from `pending_status_text` configurable message
    - Approved badge: Green checkmark (✅), green background, "Identity Verified" permanent display
    - Rejected badge: Red X (❌), red background, displays rejection reason (formatted with spaces), tappable to resubmit
    - Default (None): Shield emoji (🛡️), blue background, "Upgrade to Verified" CTA, tappable to navigate to upload screen
    - Status loads dynamically on profile mount and refresh (uses `idBadgeService.getVerificationStatus()`)
    - Most recent verification request displayed (if multiple requests exist from same user)
    - Status persists across app restarts (fetched from database)

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
  - Unit tests: `npm test -- idBadge.test.ts` (must pa/profile display flow changes):
  - Manual smoke: 
    - BADGE-009: Run TC1-TC8 (mobile upload), TC9-TC15 (admin review + notifications) from `BADGE-009-MANUAL-TESTING-GUIDE.md`
    - BADGE-013: Run TC1-TC10 (profile status display, navigation, status transitions) from `BADGE-013-MANUAL-TESTING-GUIDE.md`
  - E2E: 
    - `SUPABASE_E2E_ENABLED=true npm test -- idBadgeUpload.e2e.test.ts` (upload flow)
    - `TEST_USER_ID=[uuid] SUPABASE_E2E_ENABLED=true npm test -- idBadgeProfileDisplay.e2e.test.ts` (profile display
  - Manual smoke: Run test case`BADGE-009-MANUAL-TESTING-GUIDE.md` (upload + admin review)
  - Run all 20 test cases from `BADGE-013-MANUAL-TESTING-GUIDE.md` (profile display + status transitions)
  - Verify RLS: users cannot see other users' requests (BADGE-009 TC19, BADGE-013 RLS policy tests)
  - Verify stats calculation: admin stats match database query results (BADGE-009 TC20)
  - Verify profile status updates after admin approval/rejection (BADGE-013 TC5, TC7
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

### FLOW-30: SP Wallet Admin Operations — ADMIN-V2-003

- Purpose: Admin tools for manual Swap Points management — view SP economy metrics, inspect individual user wallets, adjust SP balances (add/deduct) with mandatory audit reason, toggle wallet status (active/frozen/suspended), and view full ledger history. Dashboard card on admin home page shows SP economy summary.

- Covers:
  - SP economy metrics dashboard (total earned/spent, circulation, active wallets, avg balance, admin adjustments)
  - Wallet lookup by user_id
  - Add SP (`earn_admin_grant` ledger entries)
  - Deduct SP (`admin_deduct` ledger entries)
  - Prevent deduction below zero balance
  - Mandatory reason enforcement on every adjustment
  - Wallet status toggle (active / frozen / suspended) with audit log
  - Full ledger history display (last 100, colour-coded by type)
  - Audit logging in `admin_audit_logs` for all admin actions
  - SP Economy summary card on admin home page

- Automated Tests:
  - Unit (Vitest): `p2p-kids-admin/src/__tests__/api/admin/sp-wallet.test.ts`
    - `npm test -- --testPathPattern=sp-wallet`
  - E2E (Jest, Supabase prod): `p2p-kids-admin/src/__tests__/e2e/sp-wallet-admin.e2e.ts`
    - `RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=sp-wallet-admin`

- Manual Test Guide: `docs/manual-verification/ADMIN-V2-003-SP-WALLET-MANUAL-TEST-CASES.md` (20 test cases)

- Admin Portal Pages:
  - `/sp-wallet` — `p2p-kids-admin/src/app/sp-wallet/page.tsx`
  - Home card — `p2p-kids-admin/src/app/components/SPEconomySummary.tsx`
  - Home page updated — `p2p-kids-admin/src/app/page.tsx`

- Admin API Routes:
  - `GET /api/admin/sp-wallet` — economy metrics (no params) or wallet detail (`?user_id=<uuid>`)
  - `POST /api/admin/sp-wallet/actions` — `{ action: 'adjust', user_id, amount, reason, notes }` or `{ action: 'toggle_status', user_id, new_status, notes }`

- SQL Migration: `supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql`

- **Wallet State Enforcement (2026-03-23):**
  - Backend enforcement: `debit_sp_for_trade()`, `earn_sp_for_trade()`, `can_user_spend_sp()` now check wallet state before allowing transactions (frozen/suspended/grace_period = blocked)
  - Mobile enforcement: `AuthContext.can_spend_sp` now queries wallet state from `get_user_sp_wallet_summary()` RPC and blocks SP spending if wallet is not active
  - UX: `WalletWarningBanner` component displays state-specific warnings (frozen = blue, suspended = red, grace_period = yellow)
  - SQL Migration: `supabase/migrations/20260323000001_enforce_wallet_state_on_spend_earn.sql`
  - Verification: Freeze wallet via admin → attempt SP purchase in mobile app → expect backend error "Cannot spend SP: wallet is frozen"
  - Regression: TC-011 (freeze wallet) and TC-013 (suspend wallet) must prevent SP transactions end-to-end
  - RPCs: `admin_adjust_sp_wallet`, `admin_toggle_sp_wallet_status`, `admin_get_sp_wallet_detail`, `get_sp_economy_metrics`

- TypeScript Types: `p2p-kids-admin/src/types/sp-wallet.ts`

- Dependencies:
  - `sp_wallets` (20251215100000_auth_v2_schema.sql)
  - `sp_ledger` (061_sp_ledger_and_trade_rpcs.sql)
  - `admin_audit_logs` (20251227_admin_trade_tools.sql)
  - `profiles` (profile query for user info in wallet detail)

- Tier 0 (always):
  - `cd p2p-kids-admin && npm run typecheck` (must pass with no errors)
  - `cd p2p-kids-admin && npm run lint` (must pass)
  - `cd p2p-kids-admin && npm test -- --testPathPattern=sp-wallet` (all unit tests pass)

- Tier 1 (when admin API / UI changes):
  - Manual: Run TC-001 to TC-018 from `ADMIN-V2-003-SP-WALLET-MANUAL-TEST-CASES.md`

- Tier 2 (when SQL migration or RPC changes):
  - `supabase db reset` on staging → re-apply migration
  - Run TC-001 to TC-020 from manual test guide
  - Verify SQL objects: `SELECT proname FROM pg_proc WHERE proname LIKE 'admin_%_sp%' OR proname = 'get_sp_economy_metrics';`

- Quick Manual Smoke (happy path):
  1. Admin home page → "SP Economy" card visible → click → lands on `/sp-wallet`
  2. Economy metrics grid shows 7 cards with non-negative integers
  3. Paste a valid user UUID → "Load Wallet" → wallet detail panel appears
  4. Amount=`10`, Reason=`Smoke test +10` → "Apply Adjustment" → success + balance +10
  5. Amount=`-10`, Reason=`Smoke test -10` → success + balance restored
  6. Click "Frozen" → wallet status changes → click "Active" → restored
  7. Supabase: `admin_audit_logs` has 3 new rows for the above actions

- Change Classification: A (DB/RPC), B (API), C (UI), H (Admin config/controls)
- Required Tiers: 0 (always) + 1 (API/UI) + 2 (SQL migration applied)
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

### FLOW-31: Terms of Service (TOS) System — SAFETY-010

- Purpose: Admin-managed Terms of Service system enabling version-controlled TOS publishing, user acceptance tracking, and legal compliance. Admins create, edit, and publish TOS versions; users accept during signup and can view in Settings. System tracks acceptance history with IP/user-agent for audit trail.

- Covers:
  - Admin TOS policy management (create, edit, publish, archive)
  - Version-controlled policy storage (supports TOS, Privacy Policy, Liability Disclaimer types)
  - User acceptance during signup flow (required before account creation)
  - User TOS viewing from Settings (read-only mode)
  - Acceptance tracking with IP address and user-agent metadata
  - Status transitions: draft → published → archived
  - RPC functions for policy retrieval and acceptance recording

- Database Schema (Migration `304_platform_policies_tos.sql`):
  - `platform_policies` table: `id`, `type` (enum: terms_of_service | privacy_policy | liability_disclaimer), `version`, `title`, `content` (Markdown), `status` (enum: draft | published | archived), `effective_date`, `created_at`, `updated_at`, `created_by`, UNIQUE constraint on (type, version)
  - `policy_acceptances` table: `id`, `user_id` (FK to profiles), `policy_id` (FK to platform_policies), `policy_type`, `policy_version`, `accepted_at`, `ip_address`, `user_agent`, `device_info`
  - RPC functions:
    - `get_current_policy(p_policy_type)` → returns published policy for given type
    - `has_accepted_current_policy(p_user_id, p_policy_type)` → boolean check
    - `record_policy_acceptance(p_user_id, p_policy_id, p_ip_address, p_user_agent, p_device_info)` → insert acceptance with metadata
    - `publish_policy(p_policy_id, p_published_by)` → status transition + archive old published versions
  - RLS Policies:
    - Published policies visible to all authenticated users
    - Draft/archived policies visible to admins only
    - Users can SELECT own acceptances
    - Admins can SELECT all acceptances
    - INSERT/UPDATE policies restricted to admins only

- Admin Portal Pages:
  - `/settings/policies` — `p2p-kids-admin/src/app/settings/policies/page.tsx` 
    - Tabs for TOS, Privacy Policy, Liability Disclaimer
    - List view with status badges, version numbers, effective dates
    - Create, View, Edit, Publish actions per policy
  - `/settings/policies/new` — `p2p-kids-admin/src/app/settings/policies/new/page.tsx`
    - Form: policy type dropdown, version input (X.Y or X.Y.Z format), title, effective date, content (Markdown textarea)
    - Validation: version format, required fields
  - `/settings/policies/[id]` — `p2p-kids-admin/src/app/settings/policies/[id]/page.tsx`
    - View policy details (metadata + content)
    - Publish button for draft policies (calls `publish_policy` RPC)

- Mobile App Integration:
  - `TermsOfServiceScreen.tsx` — dual-mode screen:
    - Read-only mode (from Settings): displays current TOS, no action buttons
    - Acceptance mode (from Signup): displays TOS with Accept/Decline buttons
    - Params: `{ requireAcceptance?: boolean; onAccept?: () => void }`
    - ScrollView for full content display
    - Accept button calls `TOSService.acceptTOS()` and invokes `onAccept()` callback
    - Decline button navigates back (signup flow aborted)
  - `TOSService` (`src/services/tos.ts`):
    - `getCurrentTOS()` → fetch current published TOS
    - `hasAcceptedCurrentTOS(userId)` → check acceptance status
    - `acceptTOS(userId, policyId, metadata)` → record acceptance with IP/user-agent
    - `getUserAcceptanceHistory(userId)` → fetch user's acceptance history
    - `getAllPublishedPolicies()` → fetch all published policies (for settings)
  - Navigation updates:
    - `types.ts` — added `TermsOfService: { requireAcceptance?: boolean; onAccept?: () => void } | undefined`
    - `AppNavigator.tsx` — registered `TermsOfService` screen in authenticated stack
    - `SettingsScreen.tsx` — added "Terms of Service" menu item with testID `settings-tos-button`
    - `SignupScreen.tsx` — made TOS link tappable (navigates to TermsOfService screen with requireAcceptance=true)

- Automated Tests:
  - Unit (Jest): `p2p-kids-marketplace/src/__tests__/services/tos.test.ts`
    - 5 test suites covering all TOSService methods (15+ test cases)
    - Mocked Supabase client for offline execution
    - Run: `npm run test:unit -- tos.test.ts`
  - E2E (Jest, Supabase prod): `e2e/tos-system.integration.test.ts`
    - 5 test cases: admin CRUD, policy publish, user acceptance, RLS enforcement
    - Requires `RUN_SUPABASE_E2E=true` and real Supabase credentials
    - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- tos-system.integration.test.ts`
  - Maestro UI Flow: `.maestro/tos-system.yaml`
    - 4 flows: Settings view, Signup acceptance (happy path), Decline flow, Error state handling
    - Uses testID locators: `settings-tos-button`, `tos-screen-title`, `tos-accept-button`, `tos-decline-button`
    - Run: `npm run test:maestro:ios -- .maestro/tos-system.yaml` or `npm run test:maestro:android -- .maestro/tos-system.yaml`

- Manual Test Guide: `SAFETY-010-MANUAL-TESTING-GUIDE.md`
  - 20+ test cases across 6 sections:
    - Pre-test Setup (SQL queries to seed initial TOS policy)
    - Admin Portal TCs (7 cases): Create, Edit, Publish, Archive, Version validation, Multiple types, Search/filter
    - Mobile App TCs (7 cases): Settings view, Signup acceptance, Decline flow, Acceptance tracking, Metadata capture, History view, Error handling
    - Edge Cases (4 cases): Multiple versions, Concurrent publishes, Missing policy, Duplicate acceptance
    - RPC Functions (4 cases): Direct RPC calls for get_current_policy, has_accepted_current_policy, record_policy_acceptance, publish_policy
    - RLS Policies (3 cases): User visibility, Admin visibility, Write permissions
  - Sign-off checklist with SQL verification queries
  - Expected results documented for each test case

- Tier 0 (always):
  - Mobile: `cd p2p-kids-marketplace && npm run typecheck && npm run lint` (must pass)
  - Admin: `cd p2p-kids-admin && npm run typecheck && npm run lint` (must pass)
  - Unit tests: `cd p2p-kids-marketplace && npm run test:unit -- tos.test.ts` (all pass)

- Tier 1 (when mobile UI or admin API changes):
  - Run TC-01 to TC-14 from `SAFETY-010-MANUAL-TESTING-GUIDE.md`
  - Verify navigation flows (Settings → TOS, Signup → TOS acceptance)
  - Verify testID props render correctly for Maestro

- Tier 2 (when SQL migration or RPC changes):
  - Apply migration: `supabase/migrations/304_platform_policies_tos.sql`
  - Verify tables: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('platform_policies', 'policy_acceptances');`
  - Verify RPC functions: `SELECT proname FROM pg_proc WHERE proname IN ('get_current_policy', 'has_accepted_current_policy', 'record_policy_acceptance', 'publish_policy');`
  - Run all 20+ test cases from manual test guide
  - Run E2E: `RUN_SUPABASE_E2E=true npm run test:e2e -- tos-system.integration.test.ts`

- Quick Manual Smoke (happy path):
  1. Admin: Log in to admin portal → `/settings/policies` → "Create New Policy"
  2. Fill form: type=terms_of_service, version=1.0, title="Terms of Service", effective_date=today, content="Test TOS content"
  3. Submit → verify policy created with status=draft
  4. View policy → click "Publish" → verify status transitions to published
  5. Query: `SELECT * FROM platform_policies WHERE type='terms_of_service' AND status='published' ORDER BY created_at DESC LIMIT 1;`
  6. Mobile: Settings → "Terms of Service" → verify content displays
  7. Mobile: Signup flow (new user) → tap TOS link → verify acceptance UI shows (Accept/Decline buttons)
  8. Tap "Accept" → verify acceptance recorded
  9. Query: `SELECT * FROM policy_acceptances WHERE user_id='[test_user_id]' ORDER BY accepted_at DESC LIMIT 1;`
  10. Verify: `policy_id` matches published policy, `ip_address` and `user_agent` populated

- Quick Manual Smoke (decline path):
  1. Mobile: Signup → tap TOS link → tap "Decline" → verify navigates back to signup
  2. Verify: No acceptance record created (signup aborted)

- Change Classification: A (DB/RPC), B (Admin API), C (Mobile UI), G (Safety/compliance)
- Required Tiers: 0 (always) + 1 (UI/API) + 2 (SQL migration applied)
- Impacted Modules: MODULE-13-SAFETY-COMPLIANCE (SAFETY-010)

- Dependencies:
  - `auth.users` table (Supabase Auth)
  - `profiles` table (user metadata)
  - Admin authentication with role-based access
  - Mobile navigation (React Navigation stack)

- Verification Checklist Mapping (MODULE-13-VERIFICATION.md SAFETY-010):
  - ✅ **TOS-1**: Database schema created (platform_policies, policy_acceptances tables)
  - ✅ **TOS-2**: RPC functions implemented (4 functions with correct signatures)
  - ✅ **TOS-3**: RLS policies enforced (admins full access, users see published only)
  - ✅ **TOS-4**: Admin UI complete (create, edit, publish, archive workflows)
  - ✅ **TOS-5**: Mobile TOS screen functional (dual-mode: read-only + acceptance)
  - ✅ **TOS-6**: Signup integration (TOS link tappable, acceptance required)
  - ✅ **TOS-7**: Settings integration (TOS menu item, read-only display)
  - ✅ **TOS-8**: Acceptance tracking (IP, user-agent, device_info captured)
  - ✅ **TOS-9**: Version control (UNIQUE constraint, publish workflow archives old versions)
  - ✅ **TOS-10**: Unit tests (TOSService fully tested with mocked Supabase)
  - ✅ **TOS-11**: E2E tests (5 scenarios covering admin CRUD and user acceptance)
  - ✅ **TOS-12**: Maestro UI flows (4 flows covering all user paths)
  - ✅ **TOS-13**: Manual test guide (20+ test cases with SQL verification)

- Known Limitations:
  - IP address capture depends on client providing it (defaults to null if unavailable)
  - User-agent parsing done client-side (not validated server-side)
  - No automatic TOS re-acceptance flow when new version published (user can continue using app)
  - Markdown rendering in mobile app uses basic Text component (no rich Markdown parser)
  - Admin portal uses textarea for content (no WYSIWYG editor)

- Future Enhancements:
  - Force re-acceptance flow when new TOS version published
  - Rich Markdown editor in admin portal (with preview)
  - Markdown renderer in mobile app (formatted display)
  - Acceptance expiration/re-acceptance requirements
  - User notification when new TOS published
  - Admin analytics (acceptance rates, time-to-accept)

---

### FLOW-32: Privacy Policy System — SAFETY-011

- Purpose: Admin-managed Privacy Policy system enabling version-controlled policy publishing, user acceptance tracking, and GDPR/CCPA compliance. Admins create, edit, and publish Privacy Policy versions; users view in Settings and can accept during signup (optional). System tracks acceptance history with IP/user-agent for audit trail. Reuses complete platform_policies infrastructure from SAFETY-010.

- Covers:
  - Admin Privacy Policy management (create, edit, publish, archive)
  - Version-controlled policy storage (reuses `platform_policies` table with type='privacy_policy')
  - User Privacy Policy viewing from Settings (read-only mode)
  - Optional user acceptance during signup flow (configurable per flow)
  - Acceptance tracking with IP address and user-agent metadata
  - Status transitions: draft → published → archived
  - RPC functions for policy retrieval and acceptance recording (shared with SAFETY-010)

- Database Schema (Reuses Migration `304_platform_policies_tos.sql` from SAFETY-010):
  - `platform_policies` table: Already supports `type='privacy_policy'` (enum includes: terms_of_service | privacy_policy | liability_disclaimer)
  - `policy_acceptances` table: Tracks acceptances for all policy types including Privacy Policy
  - RPC functions (shared with SAFETY-010):
    - `get_current_policy(p_policy_type)` → returns published policy for given type (call with 'privacy_policy')
    - `has_accepted_current_policy(p_user_id, p_policy_type)` → boolean check for Privacy Policy acceptance
    - `record_policy_acceptance(p_user_id, p_policy_id, p_ip_address, p_user_agent, p_device_info)` → insert acceptance with metadata
    - `publish_policy(p_policy_id, p_published_by)` → status transition + archive old published versions
  - RLS Policies: Same as SAFETY-010 (published policies visible to all, draft/archived admin-only)

- Admin Portal Pages (Reuses SAFETY-010 UI):
  - `/settings/policies` — `p2p-kids-admin/src/app/settings/policies/page.tsx` 
    - Already supports Privacy Policy tab (implemented in SAFETY-010)
    - List view with status badges, version numbers, effective dates
    - Create, View, Edit, Publish actions per policy
  - `/settings/policies/new` — `p2p-kids-admin/src/app/settings/policies/new/page.tsx`
    - Form: policy type dropdown includes 'privacy_policy' option
    - Validation: version format, required fields
  - `/settings/policies/[id]` — `p2p-kids-admin/src/app/settings/policies/[id]/page.tsx`
    - View policy details (metadata + content)
    - Publish button for draft policies (calls `publish_policy` RPC)

- Mobile App Integration (NEW for SAFETY-011):
  - `PrivacyPolicyScreen.tsx` — dual-mode screen (mirrors TOS pattern):
    - Read-only mode (from Settings): displays current Privacy Policy, no action buttons
    - Acceptance mode (optional): displays Privacy Policy with Accept button
    - Params: `{ requireAcceptance?: boolean; onAccept?: () => void }`
    - ScrollView for full content display
    - Accept button calls `PrivacyPolicyService.acceptPrivacyPolicy()` and invokes `onAccept()` callback
    - Uses `react-native-markdown-display` for Markdown rendering
  - `PrivacyPolicyService` (`src/services/privacyPolicy.ts`):
    - `getCurrentPrivacyPolicy()` → fetch current published Privacy Policy (calls `get_current_policy('privacy_policy')`)
    - `hasAcceptedCurrentPrivacyPolicy(userId)` → check acceptance status (calls `has_accepted_current_policy(userId, 'privacy_policy')`)
    - `acceptPrivacyPolicy(userId, policyId, metadata)` → record acceptance with IP/user-agent (calls `record_policy_acceptance`)
    - `getUserAcceptanceHistory(userId)` → fetch user's Privacy Policy acceptance history
  - Navigation updates:
    - `types.ts` — added `PrivacyPolicy: { requireAcceptance?: boolean; onAccept?: () => void } | undefined`
    - `AppNavigator.tsx` — registered `PrivacyPolicy` screen in authenticated stack (after TermsOfService)
    - `SettingsScreen.tsx` — added "Privacy Policy" menu item with testID `settings-privacy-policy-button` (placed after TOS, before Privacy & Security)
    - `SignupScreen.tsx` — fixed Privacy Policy link (was incorrectly pointing to TermsOfService screen) → now navigates to `PrivacyPolicy` screen with testID `privacy-policy-link`

- Automated Tests:
  - Unit (Jest): `p2p-kids-marketplace/src/__tests__/services/privacyPolicy.test.ts`
    - 8 test cases covering all PrivacyPolicyService methods (getCurrentPrivacyPolicy, hasAcceptedCurrentPrivacyPolicy, acceptPrivacyPolicy, getUserAcceptanceHistory)
    - Mocked Supabase client for offline execution
    - Run: `npm run test:unit -- privacyPolicy.test.ts`
  - Unit (Jest): `p2p-kids-marketplace/src/screens/profile/__tests__/PrivacyPolicyScreen.test.tsx`
    - 4 test groups covering loading state, policy display, error states, acceptance flow
    - Mocked navigation, PrivacyPolicyService, Markdown renderer
    - Run: `npm run test:unit -- PrivacyPolicyScreen.test.tsx`
  - E2E (Jest, Supabase prod): `e2e/safety-011-privacy-policy.integration.test.ts`
    - 5 test groups: Privacy Policy Retrieval, Privacy Policy Acceptance, RPC Functions, Database Schema Validation
    - Creates test user with dynamic email, cleans up after tests
    - Requires `RUN_SUPABASE_E2E=true` and real Supabase credentials
    - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- safety-011-privacy-policy.integration.test.ts`
  - Maestro UI Flow: `.maestro/privacy-policy-system.yaml`
    - 3 flows: Settings view, Signup link navigation, Error state handling (no policy available)
    - Uses testID locators: `settings-privacy-policy-button`, `privacy-policy-link`, `privacy-policy-screen`, `privacy-policy-version`, `privacy-policy-content`, `privacy-policy-accept-button`
    - Run: `npm run test:maestro:ios -- .maestro/privacy-policy-system.yaml` or `npm run test:maestro:android -- .maestro/privacy-policy-system.yaml`

- Manual Test Guide: `SAFETY-011-PRIVACY-POLICY-MANUAL-TESTING-GUIDE.md`
  - 10 test cases across 3 sections:
    - Admin Portal (1 case): Create and publish Privacy Policy using admin UI
    - Mobile App Navigation & Display (5 cases): Settings view, Signup link, Acceptance flow, Version management, Error handling
    - Markdown Rendering & Cross-Platform (4 cases): Markdown formatting, navigation integrity, iOS/Android consistency, performance
  - Pre-test Setup: SQL query to verify Privacy Policy exists (`SELECT * FROM platform_policies WHERE type='privacy_policy' AND status='published'`)
  - Sign-off checklist with SQL verification queries
  - Expected results documented for each test case with testIDs

- Tier 0 (always):
  - Mobile: `cd p2p-kids-marketplace && npm run typecheck && npm run lint` (must pass)
  - Unit tests: `cd p2p-kids-marketplace && npm run test:unit -- privacyPolicy.test.ts` (all pass)
  - Component tests: `cd p2p-kids-marketplace && npm run test:unit -- PrivacyPolicyScreen.test.tsx` (all pass)

- Tier 1 (when mobile UI or service changes):
  - Run TC-01 to TC-10 from `SAFETY-011-PRIVACY-POLICY-MANUAL-TESTING-GUIDE.md`
  - Verify navigation flows (Settings → Privacy Policy, Signup → Privacy Policy link)
  - Verify testID props render correctly for Maestro
  - Run Maestro flows: `npm run test:maestro:ios -- .maestro/privacy-policy-system.yaml`

- Tier 2 (when SQL migration or RPC changes — not applicable for SAFETY-011):
  - No new migrations (reuses SAFETY-010 schema)
  - If SAFETY-010 schema changes in future, run full regression for both TOS and Privacy Policy

- Quick Manual Smoke (happy path):
  1. Admin: Log in to admin portal → `/settings/policies` → "Create New Policy"
  2. Fill form: type=privacy_policy, version=1.0, title="Privacy Policy", effective_date=today, content="Test Privacy Policy content"
  3. Submit → verify policy created with status=draft
  4. View policy → click "Publish" → verify status transitions to published
  5. Query: `SELECT * FROM platform_policies WHERE type='privacy_policy' AND status='published' ORDER BY created_at DESC LIMIT 1;`
  6. Mobile: Settings → "Privacy Policy" → verify content displays
  7. Mobile: Signup flow → tap Privacy Policy link → verify Privacy Policy displays
  8. Query: `SELECT * FROM policy_acceptances WHERE policy_type='privacy_policy' ORDER BY accepted_at DESC;`

- Quick Manual Smoke (Settings navigation):
  1. Mobile: Login → Settings → "Privacy Policy" → verify Privacy Policy screen renders
  2. Verify: testID `privacy-policy-screen` exists, content visible, back button works
  3. Verify: No acceptance button in read-only mode (requireAcceptance=false)

- Change Classification: C (Mobile UI only — reuses existing DB/Admin infrastructure)
- Required Tiers: 0 (always) + 1 (UI changes only)
- Impacted Modules: MODULE-13-SAFETY-COMPLIANCE (SAFETY-011)

- Dependencies:
  - SAFETY-010 (TOS System) — reuses `platform_policies`, `policy_acceptances` tables and all RPC functions
  - `auth.users` table (Supabase Auth)
  - `profiles` table (user metadata)
  - Admin authentication with role-based access (already implemented in SAFETY-010)
  - Mobile navigation (React Navigation stack)
  - `react-native-markdown-display` library for Markdown rendering

- Verification Checklist Mapping (MODULE-13-VERIFICATION.md SAFETY-011):
  - ✅ **PP-1**: Confirmed existing platform_policies table supports privacy_policy type (no schema changes)
  - ✅ **PP-2**: Confirmed RPC functions accept policy_type parameter (get_current_policy, has_accepted_current_policy, record_policy_acceptance)
  - ✅ **PP-3**: Confirmed admin UI supports Privacy Policy management (p2p-kids-admin/src/app/settings/policies/page.tsx)
  - ✅ **PP-4**: Mobile Privacy Policy screen created (PrivacyPolicyScreen.tsx with dual-mode: read-only + acceptance)
  - ✅ **PP-5**: Mobile service layer implemented (PrivacyPolicyService with 4 methods)
  - ✅ **PP-6**: Settings integration (Privacy Policy menu item after TOS with testID `settings-privacy-policy-button`)
  - ✅ **PP-7**: Signup link fixed (now navigates to PrivacyPolicy screen with testID `privacy-policy-link`)
  - ✅ **PP-8**: Navigation configured (types.ts + AppNavigator.tsx with PrivacyPolicy route)
  - ✅ **PP-9**: Unit tests for service (8 test cases in privacyPolicy.test.ts)
  - ✅ **PP-10**: Unit tests for component (4 test groups in PrivacyPolicyScreen.test.tsx)
  - ✅ **PP-11**: E2E integration tests (5 test groups in safety-011-privacy-policy.integration.test.ts)
  - ✅ **PP-12**: Maestro UI flows (3 flows in privacy-policy-system.yaml)
  - ✅ **PP-13**: Manual test guide (10 test cases with SQL verification)

- Known Limitations:
  - Acceptance is optional by default (not required for signup — differs from TOS)
  - IP address capture depends on client providing it (defaults to null if unavailable)
  - User-agent parsing done client-side (not validated server-side)
  - No automatic re-acceptance flow when new version published
  - Markdown rendering uses `react-native-markdown-display` (basic formatting only)

- Future Enhancements:
  - Required Privacy Policy acceptance hooks (if regulatory requirements change)
  - User notification when new Privacy Policy published
  - Diff view showing changes between versions
  - Privacy Policy changelog/version history in mobile app
  - Admin analytics (view rates, acceptance rates)

---

### FLOW-33: Liability Disclaimer System — SAFETY-012

- Purpose: Admin-managed Liability Disclaimer system displayed during trade initiation requiring mandatory buyer acknowledgment before finalizing purchase. Admins create, edit, and publish Liability Disclaimer versions; users **must** acknowledge on each trade (modal with checkbox validation). System tracks per-transaction acknowledgment in trades table plus historical audit trail in policy_acceptances. Reuses complete platform_policies infrastructure from SAFETY-010.

- Covers:
  - Admin Liability Disclaimer management (create, edit, publish, archive)
  - Version-controlled policy storage (reuses `platform_policies` table with type='liability_disclaimer')
  - **Mandatory** user acknowledgment during trade initiation (blocking modal with checkbox)
  - Per-transaction tracking in `trades` table (disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at)
  - Full audit trail in `policy_acceptances` table (with IP address and user-agent metadata)
  - User Liability Disclaimer viewing from Settings (read-only reference mode)
  - Status transitions: draft → published → archived
  - RPC functions for policy retrieval and transaction-specific acknowledgment recording

- Database Schema:
  - Migration `307_liability_disclaimer_tracking.sql` (NEW for SAFETY-012):
    - ALTER TABLE `trades` adds:
      - `disclaimer_acknowledged` BOOLEAN NOT NULL DEFAULT FALSE
      - `disclaimer_policy_id` UUID REFERENCES platform_policies(id) ON DELETE SET NULL
      - `disclaimer_acknowledged_at` TIMESTAMPTZ
    - Indexes: `idx_trades_disclaimer_policy_id`, `idx_trades_disclaimer_acknowledged`
    - RPC function: `acknowledge_trade_disclaimer(p_trade_id UUID, p_disclaimer_policy_id UUID)`
      - Validates: user owns trade (buyer_id = auth.uid()), policy exists and is published, trade is in 'pending' or 'confirmed' status
      - Updates: trades table disclaimer columns
      - Inserts: policy_acceptances row with IP/user-agent metadata
      - Returns: success boolean with error messages
      - Uses transaction for atomicity (BEGIN...COMMIT)
  - Reuses from SAFETY-010 Migration `304_platform_policies_tos.sql`:
    - `platform_policies` table: Already supports `type='liability_disclaimer'` (enum includes: terms_of_service | privacy_policy | liability_disclaimer)
    - `policy_acceptances` table: Tracks acceptances for all policy types including Liability Disclaimer
    - RPC functions:
      - `get_current_policy(p_policy_type)` → returns published policy for given type (call with 'liability_disclaimer')
      - `has_accepted_current_policy(p_user_id, p_policy_type)` → boolean check (optional for lifetime check)
      - `record_policy_acceptance(p_user_id, p_policy_id, p_ip_address, p_user_agent, p_device_info)` → insert acceptance with metadata (called by acknowledge_trade_disclaimer)
      - `publish_policy(p_policy_id, p_published_by)` → status transition + archive old published versions
    - RLS Policies: Same as SAFETY-010 (published policies visible to all, draft/archived admin-only)

- Admin Portal Pages (Reuses SAFETY-010 UI):
  - `/settings/policies` — `p2p-kids-admin/src/app/settings/policies/page.tsx` 
    - Already supports Liability Disclaimer tab (implemented in SAFETY-010)
    - List view with status badges, version numbers, effective dates
    - Create, View, Edit, Publish actions per policy
  - `/settings/policies/new` — `p2p-kids-admin/src/app/settings/policies/new/page.tsx`
    - Form: policy type dropdown includes 'liability_disclaimer' option
    - Validation: version format, required fields
  - `/settings/policies/[id]` — `p2p-kids-admin/src/app/settings/policies/[id]/page.tsx`
    - View policy details (metadata + content)
    - Publish button for draft policies (calls `publish_policy` RPC)

- Mobile App Integration (NEW for SAFETY-012):
  - `DisclaimerModal.tsx` — **blocking modal** displayed during trade initiation:
    - Triggered: when user taps "Confirm Purchase" button on trade confirmation screen
    - Displays: full disclaimer content with version badge and effective date
    - Checkbox: "I have read and acknowledge this disclaimer" (unchecked by default)
    - Buttons: "Cancel" (closes modal, returns to trade screen), "Accept" (disabled until checkbox checked)
    - On Accept: calls `onAccept(disclaimerPolicyId)` callback → parent screen calls `acknowledge_trade_disclaimer` RPC → closes modal → proceeds with trade
    - Checkbox Reset: resets to unchecked every time modal reopens (prevents accidental acceptance)
    - Error Handling: loading spinner, error display with retry button, empty state if no policy exists
    - Uses `react-native-markdown-display` for Markdown rendering
    - TestID props: `disclaimer-modal`, `disclaimer-checkbox`, `disclaimer-accept-button`, `disclaimer-cancel-button`, `disclaimer-close-button`
  - `LiabilityDisclaimerScreen.tsx` — read-only screen in Settings:
    - Navigation: Settings → "Liability Disclaimer" menu item
    - Displays: current published Liability Disclaimer, version badge, effective date
    - Mode: read-only (no action buttons, no checkbox — differs from modal)
    - Info notice: "This disclaimer is shown when you make a purchase"
    - Error Handling: loading spinner, error with retry button
    - TestID props: `liability-disclaimer-screen`, `liability-disclaimer-version`, `liability-disclaimer-content`
  - `TradeInitiationScreen.tsx` — trade confirmation screen (MODIFIED):
    - Added states: `showDisclaimer` (boolean), `disclaimerPolicyId` (UUID)
    - Modified flow: "Confirm Purchase" button now calls `handleConfirmPurchase()` → shows DisclaimerModal
    - On modal accept: `handleDisclaimerAccept(disclaimerPolicyId)` → closes modal → calls `handleInitiateTrade(disclaimerPolicyId)` → initiates trade → calls `acknowledge_trade_disclaimer` RPC with trade_id and policy_id
    - On modal cancel/close: modal closes, no trade initiated, user returns to trade confirmation screen
    - RPC call: `await supabase.rpc('acknowledge_trade_disclaimer', { p_trade_id, p_disclaimer_policy_id })`
    - Error Handling: if disclaimer acknowledgment fails, show error alert, do NOT proceed with payment
  - Navigation updates:
    - `types.ts` — added `LiabilityDisclaimer: undefined` route
    - `AppNavigator.tsx` — registered `LiabilityDisclaimerScreen` in authenticated stack (after PrivacyPolicy)
    - `SettingsScreen.tsx` — added "Liability Disclaimer" menu item with shield-outline icon, testID `settings-liability-disclaimer-button` (placed after Privacy Policy)

- Automated Tests:
  - Unit (Jest): `p2p-kids-marketplace/src/__tests__/components/DisclaimerModal.test.tsx`
    - 15 test cases covering:
      - Loading state renders spinner
      - Success state renders disclaimer content with checkbox and buttons
      - Checkbox controls accept button disabled state
      - Accept button calls onAccept with policy ID when checkbox is checked
      - Cancel/Close buttons call onCancel callback
      - Checkbox resets to unchecked when modal reopens
      - Error state renders with retry button
      - Retry button refetches disclaimer
      - Accessibility labels present
    - Mocked Supabase client for offline execution
    - Run: `npm run test:unit -- DisclaimerModal.test.tsx`
  - Unit (Jest): `p2p-kids-marketplace/src/__tests__/screens/LiabilityDisclaimerScreen.test.tsx`
    - 10 test cases covering:
      - Loading state with ActivityIndicator
      - Success state with disclaimer content, version, effective date
      - Back button navigation
      - Error state with retry button
      - Retry functionality refetches disclaimer
    - Mocked navigation, SafeAreaView, Ionicons, Markdown renderer
    - Run: `npm run test:unit -- LiabilityDisclaimerScreen.test.tsx`
  - E2E (Jest, Supabase prod): `p2p-kids-marketplace/src/__tests__/integration/liability-disclaimer.integration.test.ts`
    - 4 test groups:
      - Disclaimer Retrieval (get_current_policy RPC)
      - Disclaimer Acknowledgment (acknowledge_trade_disclaimer RPC)
      - Policy Acceptances Audit Trail (policy_acceptances table)
      - Trades Table Disclaimer Tracking (disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at columns)
    - Creates test user with dynamic email, creates test trade, cleans up after tests
    - Requires `RUN_SUPABASE_E2E=true` and real Supabase credentials
    - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- liability-disclaimer.integration.test.ts`
  - Maestro UI Flow: `.maestro/liability-disclaimer-flow.yaml`
    - 4 flows:
      - Flow 1: View from Settings → navigate to Settings → tap "Liability Disclaimer" → verify content displays → tap back button
      - Flow 2: Accept during trade (happy path) → navigate to trade confirmation → tap "Confirm Purchase" → modal appears → check checkbox → tap "Accept" → verify modal closes
      - Flow 3: Cancel during trade → navigate to trade confirmation → tap "Confirm Purchase" → modal appears → tap "Cancel" → verify returns to trade screen
      - Flow 4: Close button (X) → navigate to trade confirmation → tap "Confirm Purchase" → modal appears → tap close button → verify returns to trade screen
    - TestID locators: `settings-liability-disclaimer-button`, `liability-disclaimer-screen`, `confirm-purchase-button`, `disclaimer-modal`, `disclaimer-checkbox`, `disclaimer-accept-button`, `disclaimer-cancel-button`, `disclaimer-close-button`
    - Pre-test Setup: SQL queries to verify liability_disclaimer policy exists and trades table has disclaimer columns
    - Run: `npm run test:maestro:ios -- .maestro/liability-disclaimer-flow.yaml` or `npm run test:maestro:android -- .maestro/liability-disclaimer-flow.yaml`

- Manual Test Guide: `SAFETY-012-LIABILITY-DISCLAIMER-MANUAL-TESTING-GUIDE.md`
  - 12 test cases across 5 sections:
    - Settings Navigation (TC-001): View from Settings, verify content, back navigation
    - Trade Flow Integration (TC-002 to TC-005): Accept flow, Cancel flow, Close button, Checkbox reset on reopen
    - State Management & Error Handling (TC-006 to TC-008): Loading state, Error state with retry, Empty state (no policy)
    - Admin Operations (TC-009): Create and publish liability_disclaimer using admin UI
    - Cross-Platform & Accessibility (TC-010 to TC-012): Audit trail verification in database, Multiple acknowledgments per user, Scope validation (only trades show disclaimer)
  - Pre-testing Setup: SQL queries to verify liability_disclaimer policy exists (`SELECT * FROM platform_policies WHERE type='liability_disclaimer' AND status='published'`)
  - Expected results with SQL verification queries for each test case
  - Sign-off checklist with database validation queries
  - Issue reporting template with simulator logs and SQL queries

- Tier 0 (always — BEFORE simulator testing):
  - Mobile: `cd p2p-kids-marketplace && npm run typecheck && npm run lint` (must pass, catches duplicate exports and JSX syntax errors)
  - Unit tests: `cd p2p-kids-marketplace && npm run test:unit -- DisclaimerModal.test.tsx` (15 tests must pass)
  - Unit tests: `cd p2p-kids-marketplace && npm run test:unit -- LiabilityDisclaimerScreen.test.tsx` (10 tests must pass)
  - **SQL Prerequisites**: Run migration `307_liability_disclaimer_tracking.sql` in Supabase SQL Editor BEFORE any mobile testing

- Tier 1 (when mobile UI, service, or RPC changes):
  - Run TC-001 to TC-012 from `SAFETY-012-LIABILITY-DISCLAIMER-MANUAL-TESTING-GUIDE.md`
  - Verify navigation flows (Settings → Liability Disclaimer, Trade Confirmation → Disclaimer Modal)
  - Verify testID props render correctly for Maestro
  - Run Maestro flows: `npm run test:maestro:ios -- .maestro/liability-disclaimer-flow.yaml`
  - Verify trade flow: Confirm Purchase button → modal displays → checkbox required → acceptance tracked in trades table

- Tier 2 (when SQL migration or RPC changes — APPLICABLE for SAFETY-012):
  - Run migration `307_liability_disclaimer_tracking.sql` in fresh Supabase instance (or use `supabase db reset` locally)
  - Verify trades table schema: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='trades' AND column_name LIKE 'disclaimer%';`
  - Verify RPC function exists: `SELECT proname FROM pg_proc WHERE proname='acknowledge_trade_disclaimer';`
  - Test RPC function directly: `SELECT acknowledge_trade_disclaimer('<test_trade_id>', '<test_policy_id>');`
  - Run full E2E integration tests: `RUN_SUPABASE_E2E=true npm run test:e2e -- liability-disclaimer.integration.test.ts`
  - Verify policy_acceptances audit trail: `SELECT * FROM policy_acceptances WHERE policy_type='liability_disclaimer' ORDER BY accepted_at DESC LIMIT 10;`

- Quick Manual Smoke (happy path):
  1. **Admin**: Log in to admin portal → `/settings/policies` → verify "Liability Disclaimer" tab exists
  2. **Admin**: Create New Policy → type=liability_disclaimer, version=1.0, title="Liability Disclaimer", effective_date=today, content="Test liability content"
  3. **Admin**: Submit → verify policy created with status=draft → View policy → click "Publish" → verify status=published
  4. Query: `SELECT * FROM platform_policies WHERE type='liability_disclaimer' AND status='published' ORDER BY created_at DESC LIMIT 1;`
  5. **Mobile**: Settings → "Liability Disclaimer" → verify content displays in read-only mode
  6. **Mobile**: Navigate to trade confirmation screen (browse listing → select item → initiate trade)
  7. **Mobile**: Tap "Confirm Purchase" → verify DisclaimerModal displays with checkbox unchecked
  8. **Mobile**: Try tapping "Accept" without checking checkbox → verify button is disabled
  9. **Mobile**: Check checkbox → tap "Accept" → verify modal closes and trade proceeds
  10. Query: `SELECT disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at FROM trades WHERE id='<trade_id>';` → verify disclaimer_acknowledged=TRUE
  11. Query: `SELECT * FROM policy_acceptances WHERE policy_type='liability_disclaimer' AND user_id='<user_id>' ORDER BY accepted_at DESC;` → verify acceptance record exists

- Quick Manual Smoke (cancel/close paths):
  1. **Mobile**: Navigate to trade confirmation → tap "Confirm Purchase" → modal displays
  2. **Mobile**: Tap "Cancel" button → verify modal closes, returns to trade screen, no trade initiated
  3. **Mobile**: Tap "Confirm Purchase" again → modal displays → tap close button (X) → verify modal closes
  4. **Mobile**: Tap "Confirm Purchase" again → check checkbox → tap "Accept" → verify checkbox resets to unchecked next time modal opens

- Change Classification: B (Edge Functions/RPC) + C (Mobile UI) + A (DB Migration — trades table altered)
- Required Tiers: 0 (always) + 1 (UI/service changes) + 2 (DB migration + RPC function)
- Impacted Modules: MODULE-13-SAFETY-COMPLIANCE (SAFETY-012), MODULE-06-TRADE-FLOW (modified TradeInitiationScreen)

- Dependencies:
  - SAFETY-010 (TOS System) — reuses `platform_policies`, `policy_acceptances` tables and RPC functions (get_current_policy, record_policy_acceptance, publish_policy)
  - Migration 060 (Trade Flow) — trades table must exist before applying migration 307
  - Migration 304 (Platform Policies) — platform_policies table must exist and support liability_disclaimer type enum value
  - `auth.users` table (Supabase Auth)
  - `profiles` table (user metadata)
  - Admin authentication with role-based access (already implemented in SAFETY-010)
  - Mobile navigation (React Navigation stack)
  - Trade flow (TradeInitiationScreen integration)
  - `react-native-markdown-display` library for Markdown rendering

- Verification Checklist Mapping (MODULE-13-VERIFICATION.md SAFETY-012):
  - ✅ **LD-1**: Database schema for disclaimer tracking (migration 307 adds disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at to trades table)
  - ✅ **LD-2**: RPC function for acknowledgment (acknowledge_trade_disclaimer with transaction safety, user authorization, policy validation)
  - ✅ **LD-3**: Mobile disclaimer component (DisclaimerModal.tsx with checkbox validation, loading/error/success states, testID props)
  - ✅ **LD-4**: Settings screen link (SettingsScreen.tsx menu item "Liability Disclaimer" with shield-outline icon, testID `settings-liability-disclaimer-button`)
  - ✅ **LD-5**: Trade flow integration (TradeInitiationScreen.tsx modified to show DisclaimerModal before trade completion, blocks trade until accepted)
  - ✅ **LD-6**: Admin UI (reuses p2p-kids-admin/src/app/settings/policies UI with liability_disclaimer tab from SAFETY-010)
  - ✅ **LD-7**: Audit trail (policy_acceptances table records with IP/user-agent, called by acknowledge_trade_disclaimer RPC)
  - ✅ **LD-8**: Per-transaction tracking (trades table disclaimer columns updated atomically with audit record)
  - ✅ **LD-9**: Unit tests for modal (15 test cases in DisclaimerModal.test.tsx covering checkbox, buttons, reset, error handling)
  - ✅ **LD-10**: Unit tests for screen (10 test cases in LiabilityDisclaimerScreen.test.tsx covering display, navigation, retry)
  - ✅ **LD-11**: E2E integration tests (liability-disclaimer.integration.test.ts with 4 test groups against real Supabase)
  - ✅ **LD-12**: Maestro UI flows (liability-disclaimer-flow.yaml with 4 flows: Settings view, Accept, Cancel, Close)
  - ✅ **LD-13**: Manual test guide (SAFETY-012-LIABILITY-DISCLAIMER-MANUAL-TESTING-GUIDE.md with 12 test cases, SQL verification)

- Known Limitations:
  - Disclaimer acknowledgment is trade-specific (not signup-wide like TOS — each trade requires separate acknowledgment)
  - IP address capture depends on client providing it (defaults to null if unavailable)
  - User-agent parsing done client-side (not validated server-side)
  - If admin un-publishes or deletes disclaimer policy while user has modal open, acceptance will fail (error shown to user)
  - Markdown rendering uses `react-native-markdown-display` (basic formatting only, no interactive elements)
  - Modal checkbox must be manually checked each time (no "remember my choice" option to enforce explicit acknowledgment)

- Future Enhancements:
  - Disclaimer version tracking per trade (currently stores policy_id but no historical version snapshot)
  - User notification when disclaimer changes (e.g., "Disclaimer updated since your last purchase")
  - Diff view showing changes between disclaimer versions
  - Admin analytics (acknowledgment rates, time-to-accept per trade type)
  - Localized disclaimer content (multi-language support)
