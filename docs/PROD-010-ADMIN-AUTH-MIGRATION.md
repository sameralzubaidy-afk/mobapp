# PROD-010 — Admin Auth Consolidation Migration Roadmap

**Status:** Phase 1 complete (canonical middleware shipped + pilot routes migrated).
**Owner:** Engineering.

## Canonical Helper

[`p2p-kids-admin/src/lib/adminAuth.ts`](../p2p-kids-admin/src/lib/adminAuth.ts) — exports `verifyAdminAuth(req)` returning `{ authorized: true, adminId } | { authorized: false, error }`.

Two supported methods:
1. `x-admin-secret` header equals server-only `ADMIN_UI_SECRET` (constant-time compare).
2. `Authorization: Bearer <jwt>` + Supabase `is_admin()` RPC returns true.

Security rules enforced:
- No `NEXT_PUBLIC_*` fallback (would leak the secret into client bundles).
- No silent fallthrough: a presented-but-wrong `x-admin-secret` returns 401 (does not try method 2).

## Phase 1 — Routes Migrated (this commit)

| Route | Methods | Notes |
|---|---|---|
| `src/app/api/admin/sp-config/route.ts` | PATCH | GET intentionally remains public-read (per existing design). |
| `src/app/api/admin/policies/route.ts` | GET, POST | Uniform pattern; `ADMIN_SECRET` const removed. |
| `src/app/api/admin/policies/[id]/route.ts` | GET, PATCH, POST | Replaced `validateSecret()` helper with `requireAdmin()` wrapper. |
| `src/app/api/admin/trades/force-cancel/route.ts` | POST | Removed local `expectedSecret`. |
| `src/app/api/admin/items/[id]/details/route.ts` | GET | Removed `NEXT_PUBLIC_ADMIN_UI_SECRET` fallback. |

## Phase 2 — Routes Pending Migration (37 routes)

These routes use heterogeneous auth patterns (Supabase session via `createRouteHandlerClient`, user_metadata flag, service-role JWT inspection). They will be migrated in subsequent commits, one cluster at a time, to keep blast radius small.

Clusters:
- **Waitlist + Users** (`/admin/waitlist`, `/admin/users/*`) — session-cookie based; will be refactored to bearer token.
- **ID badges** (`/admin/id-badges/*` — 6 routes) — same pattern; cluster together.
- **SP wallet + economy** (`/admin/sp-wallet/*`, `/admin/sp-economy/*`) — uses service-role JWT inspection; needs pattern review.
- **Subscriptions** (`/admin/subscriptions/*`).
- **Disputes + Trades** (`/admin/disputes/*`, `/admin/trades/*`).
- **Categories + Category suggestions** (10 routes).
- **Misc** (`/admin/cron-runs`, `/admin/cron-jobs`, `/admin/sms-stats`, `/admin/payouts/*`, `/admin/payout-fees`, `/admin/analytics/*`, `/admin/config`).

## Phase 3 — Hardening
- Remove ALL `NEXT_PUBLIC_ADMIN_UI_SECRET` references repo-wide (currently still referenced from client pages — tracked in PROD-P002 / PROD-012).
- Add CI lint rule that flags any new `process.env.NEXT_PUBLIC_.*SECRET` usage.
- Audit log: extend `verifyAdminAuth` to write an audit row on every authorized admin API call.

## Acceptance Criteria Mapping (per spec)

| Criterion | Status |
|---|---|
| Single `verifyAdminAuth` function in `src/lib/adminAuth.ts` | ✅ |
| Two auth methods: secret header OR Supabase JWT + `is_admin()` | ✅ |
| No fallback to `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | ✅ (middleware uses anon key only) |
| Unauthorized requests get 401 with clear error | ✅ |
| Admin portal still functions (build + tests pass) | ✅ — 560/560 tests, build green |
| ALL admin API routes use middleware | ⏳ Phase 1 of 3 (5/42 routes migrated) — see Phase 2 above |
