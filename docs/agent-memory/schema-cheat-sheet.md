# DB Schema Cheat-Sheet (verified against migrations; established 2026-08-30, QA Task 11)

Use this instead of guessing column names in DB read-backs. Every fact below was verified
against `supabase/migrations/**` — when a read-back query fails 42703, come back here FIRST
before falling back to `SELECT *` (the old pattern burned 1–3 calls per table per run).

## `items` (listings)
- `price` is **DECIMAL numeric DOLLARS, NOT price_cents** (e.g. `20` = $20.00; convert with `(price * 100)::int`).
- Seller FK is **`seller_id`** (NOT `user_id`). `category_id`, `status` ('active'|'deleted'|...), `deleted_at` (soft delete).
- Source: `20260528100001_cart_system_schema.sql` ("items.seller_id (not user_id), items.price DECIMAL (not price_cents)"); `(i.price * 100)::integer AS price_cents` casts throughout.
- ⚠️ **There is NO `items.price_cents`** — 42703 confirmed 2026-09-11 (FIX-Task-17 verify round, ~3 wasted calls).
- ⚠️ **CORRECTED 2026-09-11 (TRD Phase-2b/2c round — 2 more 42703s): `items` has NO `deleted_at` and NO `item_payment_preference`.** Live column set (`information_schema`, verified): `id, seller_id, title, description, price, category_id, condition, status, accepts_swap_points, created_at, updated_at, sold_at, seller_subscription_status_at_creation, search_vector, approved_at, approved_by, eligible_for_starter_pack, starter_pack_claimed, starter_pack_claimed_at, flagged_at, rejected_at, rejection_reason, appeal_count, appeal_reason, appealed_at, edited_since_rejection, edited_since_rejection_at, age_group, gender, brand, color, bulk_upload_id, requested_category_name, node_id, tax_category_id`. SP eligibility = **`accepts_swap_points` BOOLEAN** (not a `item_payment_preference` string); tax mapping = **`items.tax_category_id` → `tax_categories.key`**.
- `cart_items` carries the string `item_payment_preference` ('cash_only'|'accept_sp'|'donate') + `cart_id`, `cart_status`, `item_title`, `item_price_cents`, `node_id` (verified 2026-09-11).

## Reviews, review reports & notifications (verified 2026-09-12, TRD final wrap-up)
- ⚠️ **There is NO `public.notifications` table** — `42P01` confirmed 2026-09-12. In-app notifications live in **`user_notifications`** (`user_id`, `type`, `title`, `body`, `data`, `is_read`, `created_at`). Siblings in the same family: `notification_preferences`, `notification_deduplication`, `notification_retry_queue`, `notification_events`, `notification_metrics_by_type`/`_by_channel`/`_by_category`, `trade_notification_log`, `admin_notifications`. Query **`user_notifications`** for any "did the user actually get notified?" assertion.
- `reviews`: `id, trade_id, reviewer_id, reviewee_id, rating, comment, is_anonymous, is_hidden, review_status, report_count, has_been_reported, created_at, updated_at`. Public **visibility is governed by `is_hidden`**, NOT `review_status` — a reported review sits at `review_status='pending_review'` while still visible.
- `review_reports`: `id, review_id, reporter_id, reason` (`'spam'|'offensive'|'false_info'|'other'`), `created_at`. **The admin moderation queue is built from THIS table** — so a **Hide** (which deliberately leaves the report rows in place) keeps the review listed, badged "Hidden", and the queue total does not drop; only **Keep** removes a row (it deletes the reports). Reporter notification types are **`review_report_kept`** / **`review_report_hidden`**.
- Admin API routes: `p2p-kids-admin/src/app/api/reviews/[reviewId]/{hide,keep}/route.ts` — both POST, both gated by the `x-admin-secret` header via `verifyAdminAuth`. ⚠️ **2026-09-12: `keep` returned `200 {"success":true}` without persisting** (see the QA round's finding N1 + QA playbook §5.21 R97 for the served-handler-vs-source diagnostic).

## `tax_rules`
- Columns: `id, tax_category_id, version, display_name, description, is_taxable, tax_rate, jurisdiction, is_active, min_item_price_cents, max_item_price_cents, effective_from, effective_to, created_at, updated_at, created_by, updated_by`. ⚠️ The thresholds are **`min_item_price_cents`/`max_item_price_cents`**, NOT `min_price_cents`/`max_price_cents` (42703 confirmed 2026-09-11).
- `tax_rate` is a FRACTION (0.0635 = 6.35%). Live staging: `general_tangible_goods` v3 active at **0.0699**; Books → `tax_exempt_goods` (category_tax_mapping).

## `trades`
- FK to items is **`listing_id`** (NEVER `item_id` — BP-73). Buyer/seller: `buyer_id` / `seller_id`.
- Cash column is **`cash_amount_cents`** (was `price_cents`, renamed in `062_fix_trades_v2_columns.sql`; there is NO `cash_amount`).
- Money/state columns seen in SP/ledger/refund flows: `final_sp_amount`, `seller_sp_earned`, `sp_released_at`, `tax_amount_cents`, `status`, `cancellation_reason`.
- **`sp_category_multiplier`** NUMERIC — category SP multiplier snapshot on the trade row (verified 1.10/1.20/1.30 for Sports/etc. trades, DEV-TASK-76). Bundle-list SP preview + `fn_release_all_sp_on_complete` use THIS (not a live category lookup).
- **`sp_transferred_at`** TIMESTAMPTZ — set at **COMPLETION** (single SP release event D-17), NOT acceptance (accept-time transfer deprecated DT-17). NULL until completion.
- **`bundle_id`** is UUID type — prefix-match with `bundle_id::text LIKE 'xxxx%'` (a bare short string like `'5b69480b'` throws 22P02).
- ⚠️ `offer_accepted_at` and `stripe_payment_intent_status` **do NOT exist** anywhere in `supabase/` — they were mis-guessed in QA Task 11 (B7). Don't look for them; use `SELECT *` to see the real column set if unsure.
- ⚠️ **Also DO NOT EXIST on `trades`** (all 42703-confirmed 2026-09-11, FIX-Task-17 verify round — ~3 wasted calls): **`price_cents`** (use `cash_amount_cents`), **`accepted_at`** (use `created_at`/`updated_at`), **`cancelled_by`** (the cancelling actor is NOT stored on the trade row — `cancelled_at` + `cancellation_reason` ARE), **`escrow_status`** (no escrow column; payment/authorization state lives on the Stripe PI / `payments` row).
- **Confirmed present** (successful read-backs across 2026-08-30 → 2026-09-11 + app query/type usage): `id, listing_id, buyer_id, seller_id, bundle_id, status, sp_amount, cash_amount_cents, buyer_transaction_fee_cents, seller_transaction_fee_cents, tax_amount_cents, cancellation_reason, cancelled_at, completed_at, created_at, updated_at, notes` (fixture tag — migration written, NOT applied), `disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at`.
- Want the **full** column list? Run the one-liner in "General read-back tips" (one accepted read-only call) instead of guessing — this round's cost came from guessing three column names in a row.

## `categories`
- `sp_spending_cap_percent` INT (50–80, admin-editable; overrides global 50% default) — used by `calculateCategorySP` client math.
- `sp_redemption_cap` INT nullable — ABSOLUTE per-category SP ceiling; when set, `fn_item_effective_sp_cap` = `LEAST(FLOOR(price × cap%/100), sp_redemption_cap)`; else falls back to `admin_config.sp_redemption_cap_global` (nullable).
- **`fn_item_effective_sp_cap(p_listing_id UUID)` RPC (R11)** — server-authoritative max SP redeemable; GRANTed to `authenticated` so the MOBILE CLIENT can call it directly (`supabase.rpc('fn_item_effective_sp_cap', { p_listing_id })`, returns a plain INTEGER — NOT an array). Client helper: `getItemEffectiveSpCap` in `src/services/categoryService.ts` (DEV-TASK-76).

## `profiles`
- PK-ish identity column is **`user_id`** (NOT `id`) — `profiles.id ≠ user_id`. Delete cleanup rows by `user_id` (BP-70). `role` ('admin'), `node_id`.

## `tax_records` (public.tax_records)
- Core: `id`, `trade_id`, `buyer_id`, `node_id`, `taxable_amount_cents`, `tax_amount_cents`, `tax_jurisdiction`, `refunded_tax_cents`, `refund_reason`, `created_at`, `updated_at`.
- **`tax_rate` DECIMAL(5,4) = FRACTION** (e.g. `0.0699` = 6.99%) — multiply by 100 for the percent the UI shows.
- Lifecycle (added later): `tax_status` enum = `quoted | collected | voided | pending_refund | reconciliation_required | refunded | partially_refunded | capture_failed` (default `quoted`); `tax_snapshot` JSONB; `captured_at`; `stripe_refund_id`; `refunded_at`; `refund_status`.
- Source: `20260510000001_tax_001_sales_tax_schema.sql`, `20260723000002_tax_status_lifecycle.sql`.

## `seller_payouts`
- Columns: `id`, `user_id` (→ auth.users), `trade_id`, `payout_method_id`, `currency` ('usd'), `gross_amount_cents`, `platform_fee_cents`, `payout_fee_cents`, `net_amount_cents`, `status` ('requires_action'|'pending'|'processing'|'completed'|'failed'), `provider` ('stripe'|'paypal'|'ach'), `provider_reference_id`, `idempotency_key`, `initiated_at`, `completed_at`, `failure_reason`, `created_at`, `updated_at`.
- Invariant: `net_amount_cents = gross_amount_cents − platform_fee_cents − payout_fee_cents` (CHECK constraint).
- ⚠️ There is NO `amount_cents` column (mis-guessed in QA Task 11 B7) — use the four split columns above.
- Source: `073_seller_payouts.sql`.

## `trade_refunds` (public.trade_refunds)
- Columns: `id`, `trade_id`, `payment_id`, `stripe_refund_id`, `refund_amount_cents`, `refund_price_cents`, `refund_fee_cents`, `refund_tax_cents`, `reason`, `initiating_actor` (default 'system'), `status` ('succeeded'|'pending'|'failed'|'canceled'), `created_at`.
- Invariant: `refund_amount_cents = refund_price_cents + refund_fee_cents + refund_tax_cents` (CHECK constraint).
- ⚠️ There is NO `amount_cents` column (mis-guessed in QA Task 11 B7).
- Source: `317_payments_reconciliation_and_partial_refunds.sql`.

## `sp_wallets`
- Balance column is **`available_balance`** (NOT `available_sp` — 42703 confirmed QA Task 16). SP state read-backs in trade/offer flows also use `trades.final_sp_amount` / `seller_sp_earned` / `sp_released_at` (see `trades` above). Full verified column set: `user_id, state, available_balance, pending_balance, lifetime_earned, lifetime_spent, reserved_sp, last_activity_at, frozen_at, grace_period_ends_at, starter_pack_issued, node_id` (2026-08-31).
- ⚠️ **ADD 2026-09-16 (SUB Android R3, `row_to_json` live read): two columns were MISSING from the list above — `lifetime_expired` INT and `starter_pack_issued_at` TIMESTAMPTZ.** Live set also includes `id`, `created_at`, `updated_at`. Do not read `available_balance` as `lifetime_earned − lifetime_spent − pending_balance`; they are independently maintained counters and legitimately differ (test-seller: avail 2263 + pending 503 = 2766 vs lifetime_earned 2741 — the 25 delta is `lifetime_expired` 25 / the starter pack, NOT a defect). Per R100, name the writer before filing any counter-consistency "finding". `state` enum: `active | grace_period | frozen`.

## `trades` disclaimer acknowledgment (QA Task 16 verified 2026-08-31)
- The Liability Disclaimer modal acknowledgment is recorded on the TRADE row: `disclaimer_acknowledged BOOL`, `disclaimer_policy_id UUID`, `disclaimer_acknowledged_at TIMESTAMPTZ` (verified on Soccer Ball trade `a45caeb5`: true + `4f41639e-…` + timestamp at accept). NOT on a separate table. (There is NO `disclaimer_accepted_at` column — 42703 confirmed.)

## Seller fee config + formula (QA Task 16 verified 2026-08-31)
- `create-trade-offer.calculateSellerFeeCents`: `effectivePct = sellerIsSubscriber ? platform_fee_seller_discount_percentage_kids_club_plus : platform_fee_seller_percentage`; `sellerFee = round(cashPortion × effectivePct / 100)` — computed at OFFER time, stored in `trades.seller_transaction_fee_cents`.
- Staging values: `platform_fee_seller_percentage = 10` (free), `platform_fee_seller_discount_percentage_kids_club_plus = 20`. Trial = subscriber → test-seller pays 20% × cash (verified: $3/$15 Kids Bicycle, $5/$25 Vintage Comic, $2.40/$12 Soccer Ball). Guide K11's 5% precondition is STALE.
- ⚠️ Config-intent observation: the "discount" key is used as the flat subscriber RATE (20% > free 10%) — flag for dev confirmation.

## `categories` sp_redemption_cap (QA Task 16 verified 2026-08-31)
- `sp_redemption_cap INT NULL` is editable via the ADMIN PORTAL `/categories` → Edit → **SP Config tab** (`#sp_redemption_cap` input, 0–1000; empty = NULL). `qa:admin-config-set` does NOT cover categories (it's admin_config only) — use the portal for category caps. `fn_item_effective_sp_cap` = LEAST(FLOOR(price×cap%/100), sp_redemption_cap) is the server-authoritative cap; the EF rejects above it with `SP_CAP_EXCEEDED` (400).

## `subscriptions`
- Trial-used flag is **`has_used_trial`** (NOT `is_trial` — mis-guessed in QA Task 15).

## `cart_items`
- FK to listings is **`listing_id`** (NOT `item_id` — mis-guessed in QA Task 15; same BP-73 convention as `trades.listing_id`).
- Time column is **`added_at`** (NOT `created_at` — no such column; 42703 confirmed 2026-08-31).

## `admin_trades_view`
- The trade-id column is **`id`** (NOT `trade_id` — 42703 confirmed 2026-08-31). Columns include `id, listing_id, buyer_id, seller_id, status, cash_amount_cents, bundle_id, bundle_size, buyer_name, seller_email`, etc.

## `trades.notes` (fixture tag — Dev Task 77 item 6)
- `notes TEXT` (nullable) added by migration `20260901000000_dev_task_77_fixture_notes.sql` — ⚠️ NOT YET APPLIED to staging (needs owner approval). Canned TRD-TC-B08 trade is stamped `notes='fixture:TRD-TC-B08'`. Not rendered in the app UI; QA/dev-facing only.

## General read-back tips
- Verify a column exists before trusting a `SELECT`: `SELECT column_name FROM information_schema.columns WHERE table_name='<t>' AND column_name IN (...)`.
- `trades`/`seller_payouts`/`trade_refunds`/`tax_records` are financial tables — read via the Supabase MCP `execute_sql` (SELECTs are pre-approved, BP-72).
- Full standing rules: RULE-PRICE-1 in `locator-conventions.md`; `trades.listing_id` + payout-method state also documented as BP-73.

## Audit tables — THREE distinct tables, differing columns (QA Task 32 Part 2, 2026-09-05 — R61)
Do NOT guess which table a writer targets or which columns it has. Verify the live table's columns (one `information_schema.columns`) before asserting an audit row exists or executing an admin route/EF that writes one — an insert referencing wrong columns fails with a silently-swallowed 42703 → state commits but NO audit/actor row (R61).
- `admin_activity_log` — `id, admin_id, action_type, entity_type, entity_id, details, notes, created_at`
- `admin_audit_log` (singular) — `id, admin_id, action, entity_type, entity_id, changes, created_at`
- `admin_audit_logs` (plural) — `id, actor_id, action_type, entity_type, entity_id, payload, reason, created_at`
- Broken-writer class resolved 2026-09-05: `publish_section`/`unpublish_section` fixed by DT116; the admin subscription actions route (`p2p-kids-admin/src/app/api/admin/subscriptions/actions/route.ts`) inserted `admin_user_id`/`action`/`target_user_id`/`changes` into `admin_audit_logs` with actor hardcoded `'system'` — FIXED by DT117 item 1 (rewrote to `actor_id` via `getActingAdminId` + `action_type` `subscription_manually_cancelled`/`trial_extended`/`subscription_reactivated`, `entity_type='subscription'`, `entity_id`=user_id, `payload`/`reason`; client `subscriptions/manage` now sends `Authorization: Bearer`). A post-DT117 sweep found NO other broken audit writers in admin `src`, `supabase/functions`, or mobile. `badge_audit_logs` is a 4th (badge-domain) audit table with NOT-NULL `user_id`+`admin_id` and action_type CHECK IN manual_award/manual_revoke/config_change/bulk_award. Standing rule: schema-verify any new audit insert against the live table before shipping (see `/memories/repo/agent-rule-updates-2026-09-05.md`).
- Related: `auth_audit_logs` (auth provider logins — §5.11 session check) is separate and lives in the `auth` schema.
