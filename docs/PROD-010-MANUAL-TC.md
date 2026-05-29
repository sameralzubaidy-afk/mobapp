# PROD-010 — Admin Auth Consolidation — Manual TC

## Tier 0 Gate
- Admin lint: `npx next lint` → **0 errors** (warnings unchanged, pre-existing).
- Admin build: `npm run build` → **PASS**.
- Admin tests: `npm test` → **560 passed / 0 failed / 13 skipped** (was 553; +7 new `adminAuth.test.ts`).

## Files Changed (Admin Submodule)
- **NEW** `src/lib/adminAuth.ts` — canonical `verifyAdminAuth()` middleware.
- **NEW** `src/lib/__tests__/adminAuth.test.ts` — 7 unit tests.
- `src/app/api/admin/sp-config/route.ts` — PATCH migrated.
- `src/app/api/admin/policies/route.ts` — GET + POST migrated.
- `src/app/api/admin/policies/[id]/route.ts` — GET + PATCH + POST migrated.
- `src/app/api/admin/trades/force-cancel/route.ts` — POST migrated.
- `src/app/api/admin/items/[id]/details/route.ts` — GET migrated.

## Manual TC

### A. Middleware unit behavior (covered by automated tests, but for the record)
- No headers → 401 "No valid authentication provided".
- Correct `x-admin-secret` → authorized as `admin-secret`.
- Wrong `x-admin-secret` → 401 "Invalid admin secret" (no silent fallthrough).
- `Bearer` JWT + `is_admin()=true` → authorized as user id.
- `Bearer` JWT + `is_admin()=false` → 401 "User is not an admin".
- `Bearer` JWT + getUser error → 401 "Invalid or expired session".
- `NEXT_PUBLIC_ADMIN_UI_SECRET` is NOT honored as a fallback.

### B. Migrated routes (regression smoke)
For each of the 5 routes:
- Hit the route WITHOUT `x-admin-secret` → expect 401.
- Hit the route WITH the correct `ADMIN_UI_SECRET` value → expect 200 (or original success status).

Endpoints:
- `PATCH /api/admin/sp-config`  body `{ key, value }`
- `GET /api/admin/policies`
- `POST /api/admin/policies` body `{ policy_type, title, version, content, effective_date }`
- `GET /api/admin/policies/<id>`
- `PATCH /api/admin/policies/<id>` body `{ title?, content?, effective_date? }`
- `POST /api/admin/policies/<id>` body `{ action: 'publish', admin_id }`
- `POST /api/admin/trades/force-cancel` body `{ tradeId, reason, adminId }`
- `GET /api/admin/items/<id>/details`

Expected behavior unchanged from pre-PROD-010 — only the auth check implementation moved into a shared helper.

## Phase Plan
See [PROD-010-ADMIN-AUTH-MIGRATION.md](PROD-010-ADMIN-AUTH-MIGRATION.md). Phase 1 (this commit) covers 5/42 routes. Remaining 37 routes are scheduled for follow-up clusters.

## Rollback
- Admin submodule: `git revert <commit>` removes the new middleware and reverts the 5 routes.
- Parent: re-stage submodule pointer to previous SHA.
