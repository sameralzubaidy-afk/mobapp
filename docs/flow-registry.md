# Flow Registry

This file is the canonical registry of end-to-end flows and their required regression checks.

## Flows

### FLOW-00: Infrastructure & Environment Health
- Purpose: App boots; Metro reachable; Supabase env present.
- Smoke: (manual)
  - App boots to login screen without redbox.
  - Supabase URL/anon key configured; auth requests succeed.

### FLOW-01: Auth – Signup/Login/Logout/Session Restore
- Smoke: (manual)
  - Signup -> logged in -> kill app -> relaunch -> session restores.
  - Logout returns to unauthenticated stack.

### FLOW-02: Profiles & Onboarding
- Smoke: (manual)
  - New user gets profile row (or profile fetch does not crash).

### FLOW-03: Node/ZIP Gating + Waitlist
- Smoke: (manual)
  - User is assigned to a node; sees node-scoped content.

### FLOW-04: Listings – Create/Edit/Delete/Expire/Soft Delete
- Smoke: (manual)
  - Create listing -> appears in listings feed for same node.

### FLOW-05: Media Upload (Storage) – Listing Photos
- Smoke: (manual)
  - Upload photo -> visible via signed/public URL as intended.

### FLOW-06: Discovery – Feed/Search/Filters/Favorites
- Smoke: (manual)
  - Feed loads; search filters update results.

### FLOW-07: Cart & Bundling (if implemented)
- Smoke: (manual)

### FLOW-08: Trade Flow – Checkout + Transaction State Machine
- Smoke: scripts/smoke/transactions.mjs
- Manual checks:
  - Initiate trade -> payment succeeds -> trade status becomes `in_progress`.
  - When `STRIPE_SECRET_KEY` is missing/blank: payment fails with a clear server config error (not a Stripe runtime error).
  - Seller Stripe Connect onboarding completes -> `seller_payout_methods.stripe_onboarding_complete=true` and (once Stripe enables payouts) `stripe_payouts_enabled=true`.
  - PayPal/Venmo payout: Seller creates PayPal/Venmo payout method, withdraws, and payout moves `pending` -> `processing` after submission; later `completed/failed` via PayPal webhook.
  - Stripe payouts: a `seller_payouts` row with `provider='stripe'` and `provider_reference_id=<stripe payout id>` moves `processing` -> `completed/failed` via Stripe payout webhooks.

### FLOW-09: Fees & Pricing Engine
- Smoke: (manual)
  - Subscriber fee vs non-subscriber fee matches configuration.

### FLOW-10: Swap Points Wallet – Read + Ledger Integrity
- Smoke: (manual)
  - Wallet shows available/pending; ledger entries append-only.

### FLOW-11: Swap Points – Earn/Spend/Cap + Pending→Release
- Smoke: (manual)
  - 50% cap enforced; buyer fee always cash.

### FLOW-12: Subscriptions – Purchase/Cancel/Grace Period
- Smoke: (manual)

### FLOW-13: Referrals (if implemented)
- Smoke: (manual)

### FLOW-14: Messaging (Realtime)
- Smoke: (manual)

### FLOW-15: Safety & Moderation
- Smoke: (manual)

### FLOW-16: CPSC Recall Check (if implemented)
- Smoke: (manual)

### FLOW-17: Notifications
- Smoke: (manual)

### FLOW-18: Admin Controls
- Smoke: (manual)

### FLOW-19: Analytics Events
- Smoke: (manual)

### FLOW-20: Audit/Logging
- Smoke: (manual)
