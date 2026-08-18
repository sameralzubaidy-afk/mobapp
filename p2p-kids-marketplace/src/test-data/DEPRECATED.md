# DEPRECATED — `src/test-data/` (test-users.json fixture)

**Deprecated: 2026-08-18** · Reason: duplicate/stale test-credential fixture causing a source-of-truth trap.

## What happened

QA hit a failed login (Phase 23, F06 evidence re-capture) because two competing sources of
test-user credentials existed with **different passwords**:

| Source | Password | Used by |
|---|---|---|
| `src/utils/testUsers.ts` (✅ **CANONICAL**) | `TestPass123` | Signup screen dev-autofill (`SignupScreen.tsx`) |
| `src/test-data/test-users.json` (⚠️ deprecated) | `Password123!` | Nothing — only its own test |

The QA agent assumed `Password123!` (from the similarly-named `test-users.json` fixture),
but the dev-autofill account was created with `TestPass123` (`utils/testUsers.ts`).

## What to do

- **Never consume `@/test-data` in new code.** The module and its JSON are dead code kept
  only so external tooling that imports `@/test-data` doesn't break.
- **Authoritative dev-autofill credentials live in `@/utils/testUsers`** (`TEST_USERS`,
  password `TestPass123`).
- If a future cleanup is scheduled, safe deletion set: `src/test-data/index.ts`,
  `src/test-data/test-users.json`, `src/test-data/test-users.test.ts` — after confirming
  nothing else imports `@/test-data` (currently only the module's own test does).
