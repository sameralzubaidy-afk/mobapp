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
- Smoke: (manual)
  - User A: signup -> Profile shows referral code; DB: `profiles.referral_code` matches `referral_codes.code`.
  - User B: signup with User A code -> `referrals` row created with `status='pending'`.
  - User B: DB: `profiles.referred_by` is set to User A user_id.
  - User A: Referral Dashboard stats show `total=1`, `pending=1`.

### FLOW-12: Subscriptions – Purchase/Cancel/Grace Period
- Smoke: (manual)

### FLOW-13: Referrals (if implemented)
- Smoke: (manual)

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

### FLOW-19: Analytics Events
- Smoke: (manual)

### FLOW-20: Audit/Logging
- Smoke: (manual)
