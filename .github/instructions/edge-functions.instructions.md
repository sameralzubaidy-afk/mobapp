---
description: "Use when writing or reviewing Supabase Edge Functions (Deno/TypeScript) for the Kids P2P Marketplace: auth/RLS approach, service role usage, structured errors, and deploy hygiene."
applyTo: "supabase/functions/**"
---

# Edge Function Hardening Protocol

Full bug-prevention rule text below: BP-7, BP-17, BP-18, BP-19, BP-25, BP-26, BP-27, BP-28, BP-40, BP-41, plus the Backward Compatibility section. (BP-5 SECURITY DEFINER and BP-21 cron-job-with-migration live in `supabase-sql.instructions.md`; BP-20 check-existing-triggers and BP-39 `FunctionsHttpError.context` live in the main agent file / `mobile-client.instructions.md` respectively.) See the Bug Prevention Rule Index in `Kids P2P App Builder.agent.md` for the one-line summary of all 43 rules.

### Rule Index (scan this first; open the full rule below only when it's relevant to your current task)

- HP-3 Auth/RLS — use user JWT + anon key by default; service role only for webhooks/admin/scheduled tasks with explicit checks.
- Atomic mutations — multi-table writes go through a Postgres RPC, never scattered updates from function code.
- Pre-deployment gate — `deno check --no-lock`, not `get_errors` (false positives on Deno globals).
- BP-7 Edge Function errors — structured `{success, error}` JSON, always logged.
- BP-17 send-trade-notifications — check `result.sent > 0`, never trust `resp.ok` alone.
- BP-18 Reminder EFs — must insert `user_notifications` explicitly, not rely on status-change triggers.
- BP-19 Cron-invoked EFs — `verify_jwt = false` in config.toml + `--no-verify-jwt` on deploy.
- BP-25 Edge Function compile gate — use `deno check --no-lock`, not `get_errors`.
- BP-26 EF performance — check `execution_time_ms` + staircase pattern before guessing at the bottleneck.
- BP-27 Duplicate enforcement — search for DB triggers/RPCs that duplicate an Edge Function's business rule check.
- BP-28 Admin-configurable values — Edge Functions must fail loud (`CONFIG_UNAVAILABLE`), never silently fall back.
- BP-40 Stripe trial params — `trial_end`/`trial_period_days` are mutually exclusive; use if/else if.
- BP-41 Edge Function deploys — REQUIRED path is the official CLI (`supabase functions deploy <name> --project-ref <ref>`), which resolves `../_shared/*` from the filesystem (structural fix, no manual file enumeration). **ALWAYS pass `--use-api`** (server-side bundling; a plain deploy with Docker not running can print "Deployed" while silently doing nothing — BP-66) or verify the deployed body (version bump + real invocation) after a plain deploy. Reconcile `verify_jwt` against `config.toml` BEFORE deploying (add an unlisted function that is deployed with `verify_jwt = false` to `config.toml` first — see `paypal-webhook`/`release-payment`, 2026-08-27). MCP bundler is last-resort fallback only; legacy `functions/_shared/` prefix / inline-and-keep-in-sync workaround retired for new work.
- BP-51 Pre-deploy verification — run `git diff` / grep the function for the new symbol before deploying an Edge Function; edits can be lost if the working tree is reverted between turns.
- BP-62 TABLE-returning RPCs — supabase-js returns `RETURNS TABLE(...)` RPC results as an ARRAY even for a single row; read `.success`/fields from `data[0]` (or an unwrap helper), never off the raw array (`verify_email_change_code` always-“Verification failed” bug, 2026-08-26).
- BP-63 Cross-schema PostgREST uniqueness — `admin.schema('auth').from('users').maybeSingle()` returns HTTP 406 (code treated it as “no row”) → use a SECURITY DEFINER RPC (e.g. `check_account_exists_by_email`) for email-uniqueness checks and fail CLOSED on RPC error (account-email-takeover hazard, 2026-08-26).
- BP-64 Never log OTP codes in plaintext — not even on staging (logs are more broadly accessible than the DB); log only the destination (`send-phone-otp`, 2026-08-26).
- Backward compatibility — API response shapes are additive-only; new request params need defaults for old clients; deploy order is migration-first; version the contract if a break is unavoidable.

## HP-3: Supabase auth/RLS rule (be explicit)

Default rule:
- Edge Functions MUST use user JWT + anon key so RLS applies. Service role key is ONLY allowed for:
  - Stripe webhooks
  - admin-only operations
  - scheduled/batch moderation tasks
- In service-role cases you MUST implement explicit authorization checks and log an audit event.

## Atomic multi-table mutations

Any multi-table mutation that must be atomic MUST be implemented as a Postgres RPC (see the Supabase SQL Hardening Protocol / HP-5) and called from the Edge Function — never scattered updates across tables directly from function code.

## Pre-deployment gate

Before deploying any Edge Function, run `deno check --no-lock` on the entrypoint (and any changed files) as the Tier 0 gate for this app — NOT `get_errors`, which produces false positives on Deno globals (`Deno.env`, `EdgeRuntime`, remote `https://` imports). See BP-25.

## Backward Compatibility for Edge Function / API Contracts

The shipped mobile app and admin portal can run older code than the deployed functions. Never break them.

Rules:
- **Response shapes are additive-only.** Never remove or rename an existing field — old clients ignore unknown fields but break (or crash on `undefined`) when a field they read disappears. Add new fields as optional/nullable.
- **Never change the meaning of an existing error code.** Old clients branch on codes; changing semantics silently changes behavior. Add a new code instead.
- **New required request params need server-side defaults** for old clients that don't send them. Validate the defaulted path with a test.
- **Deploy order is migration-first.** If a function depends on a new column/table, apply the migration BEFORE deploying the function (see the Pre-Verification Gate in `Kids P2P App Builder.agent.md`).
- **If a breaking contract change is unavoidable:** version the contract (e.g., a `-v2` function name, or an `Accept`/`x-api-version` header) and keep the old version serving during a transition window. Get owner approval and state the window in the Session Handoff's "Backward Compatibility" field.

---

## BP-7: Edge Function Error Handling
Problem: Edge Functions return 500 or swallow errors without actionable messages.

Rules:
- ALWAYS return structured errors:
```typescript
return new Response(
  JSON.stringify({ 
    success: false, 
    error: { 
      code: 'INVALID_REFERRAL_CODE',
      message: 'The referral code does not exist',
      details: { code: inputCode }
    }
  }),
  { status: 400, headers: { 'Content-Type': 'application/json' } }
);
```
- Log errors with context before returning: `console.error('[apply-referral]', { userId, code, error: err.message });`
- NEVER use bare `catch (e) { }` — always log or rethrow.

## BP-17: `send-trade-notifications` Response Body Check
Problem: `send-trade-notifications` returns HTTP 200 even when no push is sent (e.g., user has no push tokens). Callers that only check `resp.ok` silently count the notification as "sent" when it wasn't.

Rules:
- Never rely on `resp.ok` alone. Always parse the response body and check `result.sent > 0`.
- Log a warning when `sent === 0` with the reason field (e.g., `'no_push_tokens'`).
- Treat `sent === 0` as a diagnostic signal — investigate push token registration for the recipient user.

## BP-18: In-App Notification Must Be Explicit for Reminder EFs
Problem: Reminder-type Edge Functions (`send-offer-reminders`, `send-auto-complete-reminders`) update tracking columns (e.g., `reminder_1h_sent_at`) but the DB trigger `send_trade_status_notification` only fires on status changes — it does NOT fire when tracking columns are updated. Push-only is insufficient.

Rules:
- Every reminder EF must explicitly insert into `user_notifications` for each notification it generates. Do not rely on DB triggers for reminder-style notifications.
- The pattern is: RPC (data only) → EF creates `user_notifications` rows → EF sends push via `send-trade-notifications`.
- Log `inAppCreated` and `inAppFailed` separately from push sent/failed metrics.

## BP-19: `verify_jwt = false` for All Cron-Invoked Functions
Problem: Edge Functions invoked by `pg_net` cron receive requests without a valid user JWT. The default `verify_jwt = true` causes the Supabase gateway to return `401 UNAUTHORIZED_NO_AUTH_HEADER` before the request reaches the function code.

Rules:
- Any Edge Function called exclusively by `pg_net` cron MUST have `verify_jwt = false` in `supabase/config.toml`.
- Use the explicit `--no-verify-jwt` flag when deploying: `supabase functions deploy <name> --no-verify-jwt`. Relying on `config.toml` alone may not apply on re-deploy.
- Functions that read `SUPABASE_SERVICE_ROLE_KEY` from environment variables internally do not need gateway-level JWT verification.

## BP-25: Tier 0 Build Gate — `deno check` for Edge Functions, Not `get_errors`
Problem: The `get_errors` tool (VS Code's generic TypeScript server) does not understand Deno-specific globals like `Deno.env`, `EdgeRuntime`, or remote `https://` imports. It reports false-positive errors on every Deno Edge Function file.

Rules:
- For ALL files under `supabase/functions/`, the authoritative Tier 0 compile gate is `deno check --no-lock <file>` run via terminal — NOT `get_errors`.
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app && deno check --no-lock supabase/functions/<name>/index.ts 2>&1
```
- When checking multiple functions, pass all file paths to a single `deno check` invocation.
- If `deno check` reports errors, investigate them — they are real. If `get_errors` reports errors but `deno check` passes, the errors are false-positives.

## BP-26: Edge Function Performance Diagnosis — `execution_time_ms` + Staircase Pattern
Problem: Guessing at a "slow Edge Function" bottleneck without hard data wastes time. The `execution_time_ms` field definitively separates client-side from server-side bottlenecks.

Rules:
- Before touching ANY code: ALWAYS ask for the Edge Function invocation log's `execution_time_ms` field. Low value + slow UX = client-side bottleneck. High value = server-side.
- When diagnosing server-side slowness with concurrent external API calls, look for a staircase pattern in per-item durations (500ms, 1300ms, 2000ms, 2900ms...) — the signature of provider-side serialization on a shared resource (same Stripe Customer, same Twilio number). No amount of `Promise.all` parallelism fixes this; the fix requires batching/consolidation or deferring calls via `EdgeRuntime.waitUntil`.
- Add timing instrumentation if it doesn't already exist:
```typescript
const tStart = Date.now();
console.log(`[perf][${itemId}] stepName done t=${Date.now() - tStart}ms`);
```
- When deferring calls: `EdgeRuntime.waitUntil(backgroundPromise)` immediately before `return new Response(...)`, with a local-dev fallback:
```typescript
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
  EdgeRuntime.waitUntil(bgWork);
} else {
  console.warn('EdgeRuntime.waitUntil unavailable — running background work without keep-alive (local dev only)');
  bgWork.catch(() => {});
}
```

## BP-27: Edge Function Enforcement — Check for Duplicate DB-Side Checks
When modifying an Edge Function's enforcement logic (e.g., offer caps, balance checks, state machine guards), always search for any DB triggers, RPCs, or constraints that silently duplicate the same check server-side. Split-brain enforcement causes invisible bugs.

Detection checklist:
1. Search all migration SQL files for triggers, RPCs, or CHECK constraints that reference the same condition being changed in the Edge Function.
2. If a duplicate exists, decide whether to consolidate or keep both with documented precedence.
3. Add a comment in both layers referencing the other enforcement point.

## BP-28: Admin-Configurable Values Must Have Zero Hardcoded Fallback in Edge Functions
When converting a hardcoded value (e.g., `MAX_PENDING_OFFERS_PER_SELLER = 3`) to an admin-configurable setting read from `admin_config`:
1. **Edge Function rule**: MUST read the value live from `admin_config` on every request. NO hardcoded fallback — if the config fetch fails, return a structured error (e.g., `500 CONFIG_UNAVAILABLE`).
2. **Client error message rule**: MUST NOT hardcode the numeric value in any error message string — display the server's dynamic message.
3. **Cache rule**: Ensure the pull-to-refresh handler passes `forceRefresh = true` (see BP-15 in `mobile-client.instructions.md`).
4. **Admin UI validation rule**: The admin page must validate the configurable value on save with inline error messages, and the DB trigger/constraint must enforce the same range as a defense-in-depth layer.

## BP-40: Stripe `trial_end` and `trial_period_days` Are Mutually Exclusive
Problem: Stripe's `subscriptions.create()` API rejects any request that includes both `trial_end` (exact timestamp) and `trial_period_days` (relative duration). Two independent `if` blocks that both conditionally set one of these can both fire.

Rules:
1. Any code path that conditionally sets `trial_end` OR `trial_period_days` MUST use `if / else if` (never two independent `if` blocks).
2. Preserve existing behavior for all previously-working cases — only the *else* branch (new trial initialization) should be conditional.
3. Document the mutual exclusivity rule in a comment, including the exact Stripe error message.
4. Audit sibling functions that construct `SubscriptionCreateParams` for the same pattern.

## BP-41: Required Deploy Path — Use the Official `supabase functions deploy` CLI, Not the MCP Bundler
Problem: `mcp_supabase_deploy_edge_function`'s `files` array must include ALL files the entrypoint imports via relative paths, including transitive ones. Missing a dependency causes "Module not found" deploy failures. MCP-specific gotcha: file names must use the `functions/` prefix relative to the Supabase functions root — the MCP bundler DROPS bare `_shared/<file>.ts` entries, and even with the `functions/_shared/` prefix it has NOT reliably resolved `../_shared/*` parent-dir imports (confirmed 2026-08-10 on `initiate-payout`, and the root cause of the `create-trade-offer` 402 regression). The structural fix is the official CLI, which resolves `../_shared/*` from the local filesystem and uploads the entrypoint + every `_shared` dep as assets for server-side bundling — no manual inlining or keep-in-sync discipline required. Migrated to the CLI path on 2026-08-27 for all payment-critical functions (complete-trade, trade-payment, stripe-webhook, paypal-webhook, initiate-payout, trade-refund, sync-stripe-connect-status, release-due-payouts, process-paypal-payout, release-payment, stripe-webhook-subscriptions, create-stripe-connect-account, payout-settings-redirect) plus transactions-accept-bundle, transactions-decline-bundle, transactions-update, trade-extension, create-subscription-from-payment-method, renew-subscription.

Rules:
1. **CLI is the REQUIRED deploy path for any function that imports `../_shared/*`** (or any local relative module). Run from the repo root — **and ALWAYS pass `--use-api`** so the platform bundles server-side with zero local-Docker dependency:
   ```bash
   supabase functions deploy <name> --project-ref <ref> --use-api --yes
   ```
   The CLI uploads `index.ts` plus every resolved `_shared/` dependency as assets (see "Uploading asset" lines) and the platform bundles them — the `../_shared/*` parent-dir resolution failure is structurally removed. **`--use-api` is REQUIRED because a plain deploy with Docker not running can print "Deployed" while silently doing nothing** (a no-op deploy looks identical to a real one in the console) — only `--use-api` (server-side bundling) or a local asset upload that actually reaches the platform really deploys (see BP-66). **If a deploy is ever done WITHOUT `--use-api`, it MUST be followed by explicit deployed-body verification**: `supabase functions list --project-ref <ref>` version bump AND a real invocation (or `functions download` diff into a temp workdir — never into `supabase/functions/`, which clobbers working-tree changes) — never trust the "Deployed" console message alone.
2. **verify_jwt reconciliation BEFORE any CLI deploy** (critical): the CLI sets `verify_jwt` from `supabase/config.toml`, defaulting to `true` when a function is NOT listed there. If a function is currently deployed with `verify_jwt = false` but is unlisted in `config.toml`, a CLI redeploy will silently flip it to `true` and break webhook/cron callers (PayPal webhooks, server-to-server releases). Before deploying, empirically probe the deployed state with an unauthenticated request: gateway `401 UNAUTHORIZED_NO_AUTH_HEADER` = JWT-check on; any function-body response = JWT-check off. If the deployed state is `false` and `config.toml` lacks the entry, ADD the `[functions.<name>] verify_jwt = false` entry to `config.toml` first (done 2026-08-27 for `paypal-webhook` and `release-payment`). Use the explicit `--no-verify-jwt` flag as a belt-and-suspenders for cron functions (BP-19).
3. Keep the MCP bundler only as a last-resort fallback when the CLI is unavailable (no access token / CI restriction). If you MUST use it, apply the legacy workaround below. Otherwise prefer the CLI.
4. If the CLI deploy fails, scan the entrypoint for ALL relative imports (including transitive ones) and confirm every target file exists on disk (`_shared/*` files are tracked in `supabase/functions/_shared/`).
5. After a successful deploy, ALWAYS verify with a real invocation, not just the deploy exit code: send a non-destructive request that exercises the handler (e.g. `{}` body for an input-validating function, or a signature-less POST for a webhook) and confirm you get the function's own structured error — NOT a 5xx "Module not found". Also confirm the `verify_jwt` probe result is unchanged from step 2. Confirm the returned `version` incremented.
6. Legacy MCP workaround (retired for new work, kept for reference only): if the MCP bundler must be used, name every file relative to the Supabase functions root WITH the `functions/` prefix (`functions/<name>/index.ts`, `functions/_shared/<file>.ts`) and deploy entrypoint + deps in a single call; if it STILL fails with `Module not found ".../_shared/<file>.ts"`, INLINE the shared helper (e.g. `logFinancialAudit`, `verifyStripeAccountOwnership`) into the function file and deploy a single self-contained `index.ts` (see `archive/misc./PAY-004-005-DEPLOYMENT-FIX-APPLIED.md`), adding a comment above the inlined code naming the canonical `_shared/` source and the words "keep in sync". Whenever you edit a function with inlined `_shared/` helpers, re-check the inlined copy against the canonical `_shared/` source and update both together.
7. **create-stripe-account-link is intentionally NOT yet migrated** (2026-08-27): deployed `verify_jwt` is `true` but `config.toml` says `false`, and the committed source carries a never-deployed `verifyStripeAccountOwnership` hardening. Migrating it would change both `verify_jwt` and behavior — needs an explicit decision before deploying.

## BP-51: Verify the Intended Change Is Actually in the File Before Deploying an Edge Function
Problem: Edits made to an Edge Function can be lost if the working tree is reverted between sessions/turns (a `git checkout`/`git stash` or an external reset), while the deploy step then proceeds with a file that no longer contains the change. Result: a deploy goes out without the intended behavior (a silent no-op), or the agent "re-adds" a change it believes is already present. Confirmed 2026-08-09 on `create-trade-offer` (the R11/R6 server-side SP cap + entitlement enforcement was re-applied twice after being lost between turns).

Rules:
1. Before deploying (or claiming a change is live), run `git diff --stat` / `git diff -- <function>/index.ts` and confirm the intended lines are actually present in the working-tree file — never trust memory of an edit made earlier in the session.
2. Grep the function for the specific new symbol/call (e.g. `grep -n "resolveSpRedemption" supabase/functions/create-trade-offer/index.ts`) as a cheap presence check before a large deploy.
3. If the change is missing, re-apply it and re-run the pre-deployment gate (`deno check --no-lock`, BP-25) before deploying.
4. After deploying, verify the returned `version` incremented (mirrors BP-41 rule 7) so a lost-edit is caught at the deploy boundary, not after.

## BP-62: TABLE-Returning RPC Results Arrive as an ARRAY in supabase-js
Problem: A Postgres function declared `RETURNS TABLE(...)` is returned by
supabase-js as an **array of rows** even when it returns exactly one row. Code
that reads `result.success` / `result.new_email` directly off the raw value gets
`undefined`, so the branch is treated as a failure even when the RPC genuinely
succeeded. Confirmed 2026-08-26 on `auth-email-change`: `verify_email_change_code`
(which returns `RETURNS TABLE(success BOOLEAN, message TEXT, new_email TEXT)`) set
`verified_at` server-side, but the EF read `verifyResult.success` off the array →
"Verification failed" every time → `admin.auth.admin.updateUserById` never ran →
the email was never applied.

Rules:
1. Know the RPC's return type before reading its result. JSONB / primitive RPCs
   come back as a single object/value; `RETURNS TABLE(...)` comes back as an array.
2. For TABLE-returning RPCs, ALWAYS unwrap the first row before reading fields:
   `const row = Array.isArray(result) ? result[0] : result;` (or a shared
   `unwrapRpcResult()` helper — see `auth-email-change/index.ts`).
3. Treat an empty array as "no row" (never a false success) and a non-array
   object as pass-through, so JSONB RPCs keep working unchanged.
4. Prefer JSONB return types for single-row RPCs when the caller is a client/EF
   that reads object fields — the existing `check_account_exists_by_email`
   migration documents this exact rationale.
5. When a RPC "always fails" but the DB shows the side effect ran (e.g.
   `verified_at` set, `attempts` incremented), suspect the array-unwrap bug before
   touching the RPC logic.

## BP-63: Cross-Schema PostgREST Queries Return 406 — Never Use Them for Uniqueness Checks
Problem: `admin.schema('auth').from('users').select('id').eq('email', x).maybeSingle()`
returns **HTTP 406 Not Acceptable** for the cross-schema read, which supabase-js
surfaces as `data: null` (the code treats it as "no existing user"). A uniqueness
guard built on it never fires → a user can change their email to an address already
registered to a DIFFERENT account (account-email-takeover hazard). Confirmed
2026-08-26 on `auth-email-change`: edge_logs showed
`GET | 406 | .../rest/v1/users?select=id&email=eq...` and a change to
`samer.alzubaidi82@gmail.com` (a real registered user) was accepted with a real
`change_email` sent.

Rules:
1. Never rely on `admin.schema('auth').from('users')` PostgREST queries for
   uniqueness/existence checks — they return 406 and read as "no row".
2. Use a SECURITY DEFINER RPC that queries `auth.users` directly instead. The
   repo already has `check_account_exists_by_email(p_email)` (returns jsonb
   `{exists, user_id, providers, has_password}`; migration
   `20260420000015_check_account_exists_rpc.sql`) — reuse it, don't create a
   duplicate. GoTrue admin `listUsers` with a filter is the alternative.
3. FAIL CLOSED: if the uniqueness RPC itself errors, reject the operation
   (`INTERNAL`, 500) — never allow a change when uniqueness cannot be verified.
4. When a "uniqueness guard exists but duplicates slip through," check the edge
   logs for a 406 on the guard query before assuming the guard logic is wrong.
5. Add an explicit test that attempts the rejected operation (e.g. change email
   to one already in use → 409 `EMAIL_IN_USE`) — see
   `supabase/functions/auth-email-change/__tests__/index.test.ts`.

## BP-64: Never Log OTP / Verification Codes in Plaintext
Problem: `send-phone-otp` logged the generated OTP value
(`console.log('[send-phone-otp] Generated OTP:', code, ...)`), and the staging
`change_email` email's `template_data` carried the plain code. Logs are more
broadly accessible than the DB (platform log streams, support triage) — a
plaintext OTP in a log is a credential leak. Confirmed 2026-08-26 during the
B02/B03 investigation.

Rules:
1. Never log an OTP / verification code value — not even on staging or in dev.
2. Log only non-secret correlation data (e.g. the destination phone/email).
3. If an OTP must be inspectable for QA (e.g. the fixed `123456` dev gate), make
   it a server env toggle that surfaces the value to the USER in the UI (client
   `__DEV__` hint), never to the logs.
4. Grep for `code` / `OTP` in `console.log`/`console.error` when reviewing any
   verification/send-code function.

## BP-65: Stripe `idempotencyKey` Must Be the OPTIONS Argument, Never Inside the Params Object
Problem: Stripe Node SDK v14 (the `esm.sh/stripe@14.x` build used in this repo) treats an `idempotencyKey` property found INSIDE the params object as an options-object signal and **silently DROPS all params** — `paymentIntents.create({ amount, currency, ..., idempotencyKey })` then fails with `Missing required param: amount` (or sends incomplete params). Confirmed 2026-08-27: `create-trade-offer` was believed "known-good" but was silently breaking every offer submission until the fix; a full audit of ALL functions found the same bug live in `trade-extension` (extension re-auth hold) and `trade-payment` (legacy PI create). A function with this bug can appear to work in tests/local yet fail in production.

Rules:
1. `idempotencyKey` must ALWAYS be the SECOND argument (options): `stripe.paymentIntents.create(params, { idempotencyKey: key })` / `stripe.transfers.create(params, { idempotencyKey: key })` — never a property of the params object.
2. Before authoring or touching ANY Stripe call, grep for the bug signature: `grep -nE "confirm: true,$" -A1 supabase/functions/*/index.ts | grep -B1 idempotencyKey` (an `idempotencyKey:` line directly under `confirm: true,` inside the params object is the bug).
3. Audit every Stripe call site (`.paymentIntents.create/confirm/update`, `.transfers.create`, `.refunds.create`, `.subscriptions.create`, `.checkout.sessions.create`, `.setupIntents.create`) for this pattern. `.paymentIntents.capture()`/`.cancel()` take no idempotencyKey; PayPal uses the `PayPal-Request-Id` header (not this bug class).
4. `idempotency_key` (snake_case) inside `metadata` is informational only — it is NOT the SDK option and does not trigger the bug.
5. When fixing a confirmed instance, mirror the canonical `create-trade-offer` fix: move the key to the options argument and add a `STRIPE-IDEMPOTENCY-FIX` comment, then run `deno check --no-lock` (BP-25) and verify live with a real submission.

## BP-66: Plain `supabase functions deploy` Can Silently No-Op When Docker Is Not Running — Use `--use-api` or Verify the Deployed Body
Problem: `supabase functions deploy <name>` prints "Deployed" and exits 0 even when it silently did nothing (e.g. Docker is not running locally and the local bundling step no-ops). Only `--use-api` (server-side bundling on the platform) or a local asset upload that actually reaches the platform really deploys. A silent no-op looks identical to a real deploy in the console — the only reliable proof is the platform's version bump and/or the deployed body. Flagged 2026-08-27 by the create-trade-offer redeploy handoff; confirmed that all in-progress deploy commands in shell history omit `--use-api` (the pre-fix BP-41 rule 1 even advised against it).

Rules:
1. ALWAYS deploy with `--use-api`: `supabase functions deploy <name> --project-ref <ref> --use-api --yes`. This removes the local-Docker dependency entirely (server-side bundling).
2. If a deploy is done WITHOUT `--use-api`, it MUST be followed by explicit verification that the new body is live: (a) `supabase functions list --project-ref <ref>` shows the version incremented AND timestamp = now, AND (b) a real invocation returns the new behavior (or `functions download` into a temp workdir + diff — never into `supabase/functions/`, which would clobber working-tree changes).
3. Reconcile `verify_jwt` against `config.toml` BEFORE deploying (BP-41 rule 2) regardless of `--use-api` — the flag does not change `verify_jwt` resolution.
4. A "Deployed" console message is NEVER sufficient evidence on its own.
