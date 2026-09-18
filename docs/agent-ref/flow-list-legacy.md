# Legacy flow list (may be out of date; docs/flow-registry.md is authoritative)

Moved verbatim from `.github/agents/Kids P2P App Builder.agent.md` (2026-09-18, Phase D) so the always-loaded agent file stays small. Not auto-loaded: the Builder agent reads it on demand when its pointer says so. Edit in place here; do not copy back into the agent file.

D) COMPLETE Flow List (Agent MUST use this list for mapping + checks)
Use these Flow IDs in docs/flow-registry.md and in every response.

> **Registry authority (2026-09-06):** `docs/flow-registry.md` is the single source of truth for flow IDs and their canonical meanings (FLOW-00…FLOW-33 + FLOW-12A, plus the Part B engineering/compliance appendix). The list below documents the core FLOW-00…FLOW-20 mappings; for numbers 15/16/19 and for FLOW-21…33 the registry's "Canonical flow list & legacy-label resolution" table is authoritative — the legacy meanings below for FLOW-15 (Safety & Moderation), FLOW-16 (CPSC recall) and FLOW-19 (Analytics) were consolidated: FLOW-15 = Safety/Moderation/Content Review (incl. CPSC recall), FLOW-16 = Home Dashboard, FLOW-19 = Trading Education/Help/Support/SP Calculator. Do not use conflicting historical labels; update the registry section IN PLACE when a flow's spec changes and NEVER append dated entries.

FLOW-00: Infrastructure & Environment Health
Covers: app boots, env vars, Supabase URL/keys, function routing, local stack
Smoke: scripts/smoke/infra.mjs
Tier: 0 always; Tier 1 when env/config changes; Tier 2 when Supabase stack changes
FLOW-01: Auth – Signup/Login/Logout/Session Restore
Covers: email/password auth, optional phone verification flow, session persistence
Smoke: scripts/smoke/auth.mjs
Must validate: no “Database error saving new user”, no SMS-provider failures if phone auth is used
FLOW-02: Profiles & Onboarding
Covers: profile row creation, required fields strategy (nullable until onboarding), user_metadata usage
Smoke: scripts/smoke/profiles.mjs
Hard rule: never add NOT NULL profile fields without default or trigger population
FLOW-03: Node/ZIP Gating + Waitlist
Covers: node assignment, access gating, waitlist behavior, node isolation
Smoke: scripts/smoke/nodes.mjs
FLOW-04: Listings – Create/Edit/Delete/Expire/Soft Delete
Covers: listing lifecycle, statuses, seller payment preference rules (Cash/Accept SP/Donate)
Smoke: scripts/smoke/listings.mjs
FLOW-05: Media Upload (Storage) – Listing Photos
Covers: upload, permissions, signed URLs, deletion, size/type validation
Smoke: scripts/smoke/media.mjs
FLOW-06: Discovery – Feed/Search/Filters/Favorites
Covers: browse, search, filters, favorites, node scoping
Smoke: scripts/smoke/discovery.mjs
FLOW-07: Cart & Bundling (if implemented)
Covers: bundling rules, pricing aggregation, fee aggregation, SP cap applied correctly
Smoke: scripts/smoke/cart.mjs
FLOW-08: Trade Flow – Checkout (No Payment) + Transaction State Machine
Covers: transaction creation, state transitions, seller preference enforcement, node checks
Smoke: scripts/smoke/transactions.mjs
Hard rule: state changes must go through a single state-machine function (no ad-hoc updates)
FLOW-09: Fees & Pricing Engine
Covers: buyer fee (fixed + %), seller fee, tier discounts, node-based config, rounding rules
Smoke: scripts/smoke/fees.mjs
Must include unit tests for fee math
FLOW-10: Swap Points Wallet – Read + Ledger Integrity
Covers: wallet balance available/pending/frozen, ledger append-only rules
Smoke: scripts/smoke/sp-wallet.mjs
FLOW-11: Swap Points – Earn/Spend/Cap + Pending→Release + Expiration
Covers:
subscriber-only gating for earn/spend
50% SP cap per purchase
buyer ALWAYS pays cash platform fee
3-day pending for earned SP
expiration/inactivity rules (as specified)
Smoke: scripts/smoke/sp-rules.mjs
Must include unit tests for SP calculations + edge cases
FLOW-12: Subscriptions – Purchase/Cancel/Grace Period + Feature Gates
Covers: Stripe subscription lifecycle, webhook processing, tier propagation to DB, 90-day grace + SP freeze behavior
Smoke: scripts/smoke/subscriptions.mjs
Tier 2 ALWAYS when webhooks or subscription logic changes
FLOW-13: Referrals (if implemented)
Covers: referral code creation, redemption, incentives, abuse checks
Smoke: scripts/smoke/referrals.mjs
FLOW-14: Messaging (Realtime) – Start Chat / Send / Receive
Covers: realtime subscriptions, delivery, message storage, node/user isolation
Smoke: scripts/smoke/messaging.mjs
FLOW-15: Safety & Moderation – Prohibited Items + Reports
Covers: reporting flow, moderation queue hooks, content rules
Smoke: scripts/smoke/moderation.mjs
FLOW-16: CPSC Recall Check (if implemented)
Covers: recall lookup integration, handling failures, caching, blocking rules if required
Smoke: scripts/smoke/cpsc.mjs
FLOW-17: Notifications – Push/In-app (FCM)
Covers: registration, delivery for key events (messages, transaction updates, SP changes, subscription events)
Smoke: scripts/smoke/notifications.mjs
FLOW-18: Admin Controls – Config + Overrides
Covers: fee config, SP formulas, node controls, moderation actions, user adjustments
Smoke: scripts/smoke/admin.mjs
FLOW-19: Analytics Events (Firebase)
Covers: event emission for key user actions, dedupe, privacy-safe payloads
Smoke: scripts/smoke/analytics.mjs (or manual checklist if automation is not feasible)
FLOW-20: Audit/Logging (Security + Critical Actions)
Covers: audit trail for admin actions, subscription changes, SP adjustments, moderation actions
Smoke: scripts/smoke/audit.mjs
