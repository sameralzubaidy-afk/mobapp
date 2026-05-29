# PROD-012 — Production Environment Configuration & Secret Audit (Manual TC)

## Summary
Audited all client-bundled env vars (`EXPO_PUBLIC_*`, `NEXT_PUBLIC_*`) across mobile + admin + supabase functions. Identified one P0 leak and fixed it. Documented the canonical env var inventory.

## Findings

### P0 — `EXPO_PUBLIC_SENDGRID_API_KEY` (FIXED)
- **File:** `p2p-kids-marketplace/src/services/email.ts`
- **Issue:** The mobile email service read `EXPO_PUBLIC_SENDGRID_API_KEY`, which is bundled into the device app — leaking the SendGrid API key to every installation.
- **Fix:** Removed the EXPO_PUBLIC variant. The service now only reads `SENDGRID_API_KEY` (server-only). On the device the senders return `{ success: false, error: 'SendGrid API key not configured' }` gracefully, forcing email flows through the existing `supabase/functions/send-email/` Edge Function (which already reads the server-only secret).
- **Rotation:** If any historical build shipped with a real key bundled, **rotate the SendGrid key in the SendGrid console immediately.**

### Allowed exception — `NEXT_PUBLIC_ADMIN_UI_SECRET`
- **Status:** Per PROD-012 spec this is the single allowed `NEXT_PUBLIC_*` value of its kind because it is a rotating UI auth token, not a credential. The canonical server-side check is `verifyAdminAuth()` (PROD-010), which reads the server-only `ADMIN_UI_SECRET`. Documented in `docs/ENVIRONMENT-VARIABLES.md`.

### Not a leak — `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`
- Sole reference is a comment in `p2p-kids-admin/src/lib/adminAuth.ts:11` warning **never** to fall back to it. No runtime read.

## Verification Commands (run from repo root)

```sh
# 1. P0 client-bundle leaks — must return zero rows
grep -rnE "EXPO_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|API_KEY)" \
  p2p-kids-marketplace/src
grep -rnE "NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|PRIVATE|PASSWORD)" \
  p2p-kids-admin/src

# 2. Tier 0 — mobile
cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit
cd p2p-kids-marketplace && npx eslint src/services/email.ts src/services/__tests__/email.test.ts
cd p2p-kids-marketplace && npx jest src/services/__tests__/email.test.ts
```

## Expected Results
- Both greps: 0 rows (only `EXPO_PUBLIC_SENDGRID_API_KEY` appears inside an explanatory comment in `email.ts`, which is acceptable and intentional).
- `tsc --noEmit`: exit 0.
- `eslint`: exit 0.
- `jest email.test.ts`: 12 passed.

## Preflight Gate Status
- Mobile typecheck: **PASS** (`npx tsc -p tsconfig.json --noEmit` — 0 errors).
- Mobile lint (changed files): **PASS**.
- Mobile email tests: **PASS** (12/12).

## Files Changed
- `p2p-kids-marketplace/src/services/email.ts` — removed `EXPO_PUBLIC_SENDGRID_API_KEY` references; added security comment.
- `p2p-kids-marketplace/src/services/__tests__/email.test.ts` — updated test setup to use `SENDGRID_API_KEY`.
- `p2p-kids-marketplace/.env.local.example` — replaced `EXPO_PUBLIC_SENDGRID_API_KEY` with server-only `SENDGRID_API_KEY` + warning.
- `p2p-kids-admin/.env.example` — expanded with documented forbidden vars list.
- `docs/ENVIRONMENT-VARIABLES.md` (new) — canonical env var inventory + classification rules + verification commands.
- `docs/flow-registry.md` — added FLOW-36.

## Follow-ups
- Mobile direct SendGrid path in `email.ts` is now a graceful no-op on devices. A future cleanup task should delete it entirely and route every caller through `supabase.functions.invoke('send-email', ...)`. Tracked as a non-blocking refactor.
- 5 admin monitoring routes still read `process.env.ADMIN_UI_SECRET || process.env.NEXT_PUBLIC_ADMIN_UI_SECRET` server-side fallback (functional risk, not P0 leak). Will be addressed in PROD-013 scan or a PROD-010 follow-up migration.
