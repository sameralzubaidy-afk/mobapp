# PROD-003 + PROD-005 — Manual Test Cases (Phase 4)

**Status:** Ready for execution
**Scope:** Edge Function rate limiting utility (PROD-003) + Stripe Connect ownership verification (PROD-005)
**Related flows:** FLOW-26 (Rate Limiting), FLOW-27 (Stripe Connect Ownership)

> **Phase 4 scope decision (CRITICAL):**
> Per the "do not break working functions" rule, the rate-limiter utility is
> shipped + unit-tested but is **NOT** wired into any live edge function in
> this phase. Wiring per-endpoint is a follow-up that must be smoke-tested
> per endpoint. The Stripe ownership helper IS wired into the two existing
> Stripe Connect functions as a redundant defense-in-depth check (the
> existing `.eq('user_id', user.id)` joins are preserved).

---

## Automated coverage (already PASS)

| Test file | Tests | Result |
|---|---|---|
| `supabase/functions/_shared/rate-limiter.test.ts` | 8 | PASS |
| `supabase/functions/_shared/verify-stripe-ownership.test.ts` | 6 | PASS |

Run command:
```
cd supabase && deno test --allow-net \
  functions/_shared/rate-limiter.test.ts \
  functions/_shared/verify-stripe-ownership.test.ts
```

---

## PROD-003 — Rate Limiter (manual integration TCs)

These TCs are to be executed **only when the limiter is wired into a specific
edge function in a future phase**. They are documented here so the validation
recipe is ready.

### TC-RL-01: AUTH profile blocks the 6th request from one IP within 60s
**Pre:** Limiter applied to (e.g.) `auth-signup` with key `auth:<ip>` + `RATE_LIMITS.AUTH`.
**Steps:**
1. From a single client, fire 6 sequential `POST /auth-signup` requests in < 60s.
2. Inspect responses 1–5 and 6.

**Expected:**
- Requests 1–5 → 200/400 (normal app responses) with `X-RateLimit-Remaining` decreasing 4→0.
- Request 6 → HTTP 429 with body `{success:false,error:{code:"RATE_LIMIT_EXCEEDED",retryAfter:<number>}}` and headers `X-RateLimit-Remaining: 0`, `Retry-After: <seconds>`.
- After waiting > `Retry-After` seconds, the next request is allowed again.

### TC-RL-02: Different IPs are isolated
**Steps:** Exhaust the bucket from IP A (6 requests → 429). Immediately call from IP B.
**Expected:** IP B's first request is allowed (200) with `X-RateLimit-Remaining: 4`.

### TC-RL-03: WRITE profile allows 10/60s per authenticated user
**Pre:** Limiter applied to (e.g.) `items-create` with key `write:<user_id>` + `RATE_LIMITS.WRITE`.
**Expected:** Same as TC-RL-01 but threshold is 10 → 11th request is 429.

### TC-RL-04: 429 response shape matches the spec
**Verifier query** (after producing a 429):
```bash
curl -s -i <endpoint> | grep -E '^(HTTP|X-RateLimit|Retry-After|Content-Type)'
```
**Expected:**
```
HTTP/1.1 429 ...
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <unix-seconds>
Retry-After: <seconds>
Content-Type: application/json
```

### TC-RL-05: Cold-start reset is documented behavior
**Note (informational, not failure):** Because the limiter is in-memory, a cold start of the edge function resets counters. This is acceptable for MVP; production hardening = move to Upstash Redis or a Postgres bucket table.

---

## PROD-005 — Stripe Connect Ownership (live integration TCs)

The helper is wired into `create-stripe-account-link` and `sync-stripe-connect-status`.

### TC-SO-01: Legitimate owner can create an account link
**Steps:**
1. Sign in as User A. Ensure they have a `seller_payout_methods` row of type `stripe_connect` with a valid `stripe_account_id`.
2. Mobile: open Payout Setup → tap "Continue Stripe onboarding".

**Expected:** 200 with `{success:true,url:"https://connect.stripe.com/..."}`. No `OWNERSHIP MISMATCH` log line.

### TC-SO-02: Forged methodId returns 403 (cross-account block)
**Steps:**
1. Sign in as User A (JWT).
2. Manually call:
   ```bash
   curl -X POST <project>/functions/v1/create-stripe-account-link \
     -H "Authorization: Bearer <user_A_jwt>" \
     -H "Content-Type: application/json" \
     -d '{"userId":"<user_A_uuid>","methodId":"<user_B_method_uuid>","returnUrl":"x","refreshUrl":"y"}'
   ```

**Expected:** HTTP 404 `Payout method not found` (the existing `.eq('user_id', userId)` join already blocks this — defense-in-depth never engages because the row isn't returned).

### TC-SO-03: Cross-user `userId` mismatch returns 403 (pre-existing guard)
**Steps:** Sign in as User A; in the JSON body pass `userId` = User B's uuid.
**Expected:** HTTP 403 `User ID mismatch` (pre-existing check, untouched).

### TC-SO-04: Sync flows for legitimate user succeeds
**Steps:** Sign in as User A → call `sync-stripe-connect-status` with empty body.
**Expected:** 200 with `syncedMethods: [...]` for User A's methods only. No `OWNERSHIP MISMATCH` log.

### TC-SO-05: Audit log fires on simulated mismatch
**Setup (DB-only sim, not a real attack):**
1. As service role in SQL editor:
   ```sql
   UPDATE seller_payout_methods SET user_id = '<user_B_uuid>'
   WHERE stripe_account_id = '<acct_owned_by_A>';
   ```
2. Sign in as User A and trigger `sync-stripe-connect-status`.

**Expected:**
- HTTP 403 with body `{success:false,error:{code:"STRIPE_ACCOUNT_OWNERSHIP_DENIED",...}}`.
- Edge function logs contain `[verify-stripe-ownership] OWNERSHIP MISMATCH` line including `requestedBy`, `stripeAccountId`, `actualOwner`.

**Teardown:** restore `user_id` to A.

### TC-SO-06: Helper unit tests cover all paths
**Already automated** — see `verify-stripe-ownership.test.ts`. 6/6 PASS:
- match → owned=true
- different user_id → owned=false (logged)
- no row → owned=false (logged)
- DB error → owned=false (logged)
- missing inputs → owned=false (no DB call)
- 403 response shape

---

## Tier 0 Evidence

| Gate | Command | Result |
|---|---|---|
| Mobile typecheck | `cd p2p-kids-marketplace && npx tsc --noEmit` | PASS (exit 0, no output) |
| Mobile unit tests | `cd p2p-kids-marketplace && npm run test:unit` | PASS (2826/2826) |
| Deno unit tests (new) | `cd supabase && deno test --allow-net functions/_shared/{rate-limiter,verify-stripe-ownership}.test.ts` | PASS (14/14) |
| Deno lint (new files) | `cd supabase && deno lint functions/_shared/rate-limiter.ts functions/_shared/verify-stripe-ownership.ts` | Clean (only pre-existing project-wide `no-import-prefix` warnings) |

---

## Files Changed (Phase 4)

**New:**
- `supabase/functions/_shared/rate-limiter.ts`
- `supabase/functions/_shared/rate-limiter.test.ts`
- `supabase/functions/_shared/verify-stripe-ownership.ts`
- `supabase/functions/_shared/verify-stripe-ownership.test.ts`
- `docs/PROD-003-005-MANUAL-TC.md` (this file)

**Modified (defense-in-depth, behavior preserved):**
- `supabase/functions/create-stripe-account-link/index.ts` — added ownership guard after method lookup
- `supabase/functions/sync-stripe-connect-status/index.ts` — added per-method ownership guard before Stripe API call

**Not modified (intentional):**
- No DB migrations (Phase 4 is code-only).
- No mobile files.
- No rate-limiter wiring into live edge functions (deferred — apply one endpoint at a time with its own smoke test).
