# Config write/revert ledger — QA Task TRD-R1 (Android, 2026-09-08)

All writes via the sanctioned `qa:admin-config-set` shared-RPC helper (R37) or the admin-portal `/categories` UI (R-16-3). Every write DB read-back verified; every revert verified. `updated_by` = `1a546991-5361-4b4e-b44b-eee9bf730757`.

| # | Key | Category | Before | Fresh value | Reverted | Case | Verify evidence |
|---|---|---|---|---|---|---|---|
| 1 | `pickup_window_hours` | trade | 72 | **48** | 72 | D06 | accept-time `auto_complete_at` = +48.0h (baseline +72h); buyer banner "48h"; revert read-back 72 |
| 2 | `max_pending_offers_per_seller` | feature_flags | 3 | **5** | 3 | B05f–j | 6th offer HTTP 409 MAX_PENDING_OFFERS "5 pending"; UI "Too Many Open Offers / 5 pending"; revert read-back 3 |
| 3 | `offer_timeout_hours` | feature_flags | 48 | **24** | 48 | B02/B05d | new offer `40e0bd31` offer_expires_at +24.0h; expiry processed; revert read-back 48 |
| 4 | `categories.sp_spending_cap_percent` (Toys) | categories | 50 | **60** | 50 | C08 | admin `/categories` → Toys → SP Config (portal); slider "Max: 15 SP (60%)"; server SP_CAP_EXCEEDED at 16; revert read-back 50 |

**Fixture offers created and cleaned:**
- Reset at session start (R-16-1): cleared 3 stale pending offers (Kids Bicycle/LEGO/Nintendo, 2026-09-06 leftovers past expiry) + 1 stale cart item for test-buyer.
- 5 pending offers (B05f-j cap test) via `qa:ef-repro` (Remote Control Car, Skateboard, Puzzle Set, Soccer Ball, Roald Dahl) → reset (cancelled + listings restored).
- B02/B05d SP offer `40e0bd31` (Remote Control Car, 8 SP) → fast-clock expired (cancelled, SP restored).
- E-series trade `c2d0d8f7` (Puzzle Set $18) → in_progress → disputed (`reported`/`no_show`) → **auto-completed by the E02 P1** (leftover state, see below).

**Left-behind state needing cleanup:**
- Trade `c2d0d8f7` (Puzzle Set — 4 Pack): `status='completed'` (auto_completed_at 21:55:56) while `dispute_status='reported'`, `dispute_reason='no_show'`, `disputed_at` NULL; item `sold`; seller payout `requires_action` $14.40 queued. **This is the P1 artifact** — a dev/admin should resolve or clear the dispute overlay on this trade (it can't be resolved through the normal in-progress dispute queue since the trade already completed).
- test-buyer wallet: available 482 SP, `reserved_sp` 10 — a **pre-existing phantom 10-SP reservation** (present at session start; the reset cancels offers but doesn't run the SP-restore processor, so the phantom remains). Not caused by this round's trades. Cleanup suggestion for the dev team: run the SP-restore processor or zero the phantom reserved row.

**Verification channel notes:** test-buyer's persisted Stripe PM is now **VISA •••• 4242** (`pm_1UAyDh4I6kCJlvXojSnxd6QM`, exp 7/2028) — the Dev-Task-44 MASTERCARD 4444 is no longer on the customer, so the `payment_card=mastercard_4444` session toggle is a no-op on current staging (only relevant if card determinism is ever needed again).
