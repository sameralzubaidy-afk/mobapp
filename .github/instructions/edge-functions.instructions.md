---
description: "Use when writing or reviewing Supabase Edge Functions (Deno/TypeScript) for the Kids P2P Marketplace: auth/RLS approach, service role usage, structured errors, and deploy hygiene."
applyTo: "supabase/functions/**"
---

# Edge Function Hardening Protocol

Full bug-prevention rule text below: BP-7, BP-17, BP-18, BP-19, BP-25, BP-26, BP-27, BP-28, BP-40, BP-41, plus the Backward Compatibility section. (BP-5 SECURITY DEFINER and BP-21 cron-job-with-migration live in `supabase-sql.instructions.md`; BP-20 check-existing-triggers and BP-39 `FunctionsHttpError.context` live in the main agent file / `mobile-client.instructions.md` respectively.) See the Bug Prevention Rule Index in `Kids P2P App Builder.agent.md` for the one-line summary of all BP rules (BP-1 – BP-77).

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
- BP-41 Edge Function deploys — REQUIRED path is the official CLI (`supabase functions deploy <name> --project-ref <ref>`), which resolves `../_shared/*` from the filesystem (structural fix, no manual file enumeration) — **for ALL Edge Function deploys, regardless of file size or shared-import status (DEV-TASK-36 retired the MCP-deploy mandate; MCP is a documented last-resort fallback only)**. **ALWAYS pass `--use-api`** (server-side bundling; a plain deploy with Docker not running can print "Deployed" while silently doing nothing — BP-66) or verify the deployed body (version bump + real invocation) after a plain deploy. **MANDATORY post-deploy behavior check** — verify with a real invocation (the function's own structured response / a version bump), never just a clean deploy exit code (BP-41 rule 5). Reconcile `verify_jwt` against `config.toml` and **re-verify it IMMEDIATELY BEFORE the deploy command** — a concurrent commit/edit can silently revert the reconciliation between check and deploy, recreating the exact drift the check exists to prevent (confirmed 2026-08-27 on `create-stripe-account-link`; BP-41 rule 2). MCP bundler is last-resort fallback only; legacy `functions/_shared/` prefix / inline-and-keep-in-sync workaround retired for new work.
- BP-51 Pre-deploy verification — run `git diff` / grep the function for the new symbol before deploying an Edge Function; edits can be lost if the working tree is reverted between turns.
- BP-62 TABLE-returning RPCs — supabase-js returns `RETURNS TABLE(...)` RPC results as an ARRAY even for a single row; read `.success`/fields from `data[0]` (or an unwrap helper), never off the raw array (`verify_email_change_code` always-“Verification failed” bug, 2026-08-26).
- BP-63 Cross-schema PostgREST uniqueness — `admin.schema('auth').from('users').maybeSingle()` returns HTTP 406 (code treated it as “no row”) → use a SECURITY DEFINER RPC (e.g. `check_account_exists_by_email`) for email-uniqueness checks and fail CLOSED on RPC error (account-email-takeover hazard, 2026-08-26).
- BP-64 Never log OTP codes in plaintext — not even on staging (logs are more broadly accessible than the DB); log only the destination (`send-phone-otp`, 2026-08-26).
- BP-65 Stripe `idempotencyKey` placement — must be the OPTIONS (2nd) argument (`stripe.paymentIntents.create(params, { idempotencyKey })`), NEVER inside the params object (SDK v14 silently DROPS all params — broke `create-trade-offer`/`trade-extension`/`trade-payment`, 2026-08-27).
- BP-66 Plain `supabase functions deploy` can silently no-op (Docker not running) while printing "Deployed" — ALWAYS `--use-api` or verify the deployed body (version bump + real invocation / `functions download` diff into a TEMP dir, never into `supabase/functions/`); a "Deployed" message is never sufficient evidence (2026-08-27).
- BP-67 No bare `std/*` imports — no import map exists in this repo, so `import { serve } from 'std/server'` fails the local `deno check --no-lock` Tier-0 gate; use the full URL (`https://deno.land/std@<version>/http/server.ts`). Known pre-existing violation (out of scope to fix now, tracked): `sms-send`.
- BP-68 Edge Function log messages — for `function_logs`, the human-readable message/stack is the TOP-LEVEL `event_message` column, never `log_attributes['event_message']` (which is always empty); `log_attributes` carries only execution/request metadata (`execution_id`, `request_id`, `event_type`, ...).
- BP-69 Stripe test-mode PaymentMethod fixtures — `paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } })`; raw card numbers and `pm_card_visa` both fail in this account ("raw card data" disabled; `pm_card_visa` is a PM, not a Token).
- BP-70 Disposable-user cleanup — `profiles.id ≠ user_id` in this app; delete `profiles` by `user_id` (never `id`) and `await` builders before `admin.deleteUser`.
- BP-71 Stripe money-function verification — Tier-1 live verification MUST exercise the ACTUAL charge/pay path on a fresh, isolated throwaway user (real charge + retry-dedupe + DB/Stripe confirm); a guard-path-only smoke (`INVALID_STATUS` / `NO_FAILED_PAYMENT`) is NOT sufficient evidence (DT-11, 2026-08-27).
- BP-72 QA side-effect verification — a QA case exercising a UI action with a backend/DB/third-party (Stripe/PayPal) side effect MUST verify the side effect directly (read the DB row(s) + actual Stripe/PayPal object state), never just the UI response or a guard-path smoke; real-activation verification is REQUIRED for money/financial-state functions; this class of READ-ONLY DB/Stripe verification is PRE-APPROVED (no per-instance owner sign-off) — mutating test actions still use the safe-fixture/disposable-user discipline (DT-12, 2026-08-27).
- BP-77 Large single-file EF deploys — CLI `supabase functions deploy --use-api` is the standing required path even for large self-contained single-file functions (no `_shared` deps, e.g. the 82KB/1,840-line `create-trade-offer`) — no per-deploy approval needed (DEV-TASK-36 retired the MCP-deploy mandate); MCP is a documented last-resort fallback only; post-deploy verification (version bump + real invocation, BP-66/BP-71) is mandatory on any path (DEV-TASK-33, 2026-08-28; DEV-TASK-36, 2026-08-28).
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
1. **CLI is the REQUIRED deploy path for ALL Edge Function deploys** — whether the function imports `../_shared/*`, any other local relative module, or is a large self-contained single-file function with no `_shared` deps (e.g. the 82KB / 1,840-line `create-trade-offer` — DEV-TASK-33; DEV-TASK-36 retired the 2026-08-28 MCP-deploy mandate, so there is no per-deploy CLI exception and no MCP default). Run from the repo root — **and ALWAYS pass `--use-api`** so the platform bundles server-side with zero local-Docker dependency:
   ```bash
   supabase functions deploy <name> --project-ref <ref> --use-api --yes
   ```
   The CLI uploads `index.ts` plus every resolved `_shared/` dependency as assets (see "Uploading asset" lines) and the platform bundles them — the `../_shared/*` parent-dir resolution failure is structurally removed. **`--use-api` is REQUIRED because a plain deploy with Docker not running can print "Deployed" while silently doing nothing** (a no-op deploy looks identical to a real one in the console) — only `--use-api` (server-side bundling) or a local asset upload that actually reaches the platform really deploys (see BP-66). **If a deploy is ever done WITHOUT `--use-api`, it MUST be followed by explicit deployed-body verification**: `supabase functions list --project-ref <ref>` version bump AND a real invocation (or `functions download` diff into a temp workdir — never into `supabase/functions/`, which clobbers working-tree changes) — never trust the "Deployed" console message alone.
2. **verify_jwt reconciliation BEFORE any CLI deploy** (critical): the CLI sets `verify_jwt` from `supabase/config.toml`, defaulting to `true` when a function is NOT listed there. **TIMING (mandatory): re-verify this reconciliation IMMEDIATELY BEFORE the deploy command runs — not once earlier in the session.** A concurrent commit or edit can silently revert the `config.toml` entry (or flip a file) between when the reconciliation was checked and when the deploy actually executes, recreating the exact drift this check exists to prevent — confirmed live 2026-08-27 during the `create-stripe-account-link` drift-remediation session. Treat reconcile-then-deploy as one atomic unit executed back-to-back. If a function is currently deployed with `verify_jwt = false` but is unlisted in `config.toml`, a CLI redeploy will silently flip it to `true` and break webhook/cron callers (PayPal webhooks, server-to-server releases). Before deploying, empirically probe the deployed state with an unauthenticated request: gateway `401 UNAUTHORIZED_NO_AUTH_HEADER` = JWT-check on; any function-body response = JWT-check off. If the deployed state is `false` and `config.toml` lacks the entry, ADD the `[functions.<name>] verify_jwt = false` entry to `config.toml` first (done 2026-08-27 for `paypal-webhook` and `release-payment`). Use the explicit `--no-verify-jwt` flag as a belt-and-suspenders for cron functions (BP-19).
3. Keep the MCP bundler (`mcp_supabase_deploy_edge_function`) only as a documented last-resort fallback when the CLI is unavailable (no access token / CI restriction) — per DEV-TASK-36, BP-41 (CLI) is the standing required path with no MCP default and no exception carve-out. If you MUST use the MCP bundler, apply the legacy workaround below AND follow it with the same mandatory post-deploy verification as the CLI path (rule 5 — version bump + real invocation). Otherwise prefer the CLI.
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

## BP-67: No Bare `std/*` Imports in Edge Functions — Use the Full URL Form

Problem: bare `std/*` imports (e.g. `import { serve } from 'std/server';`) fail the local `deno check --no-lock` Tier-0 gate (BP-25) because this repo has NO import map mapping `std/` to `https://deno.land/std/`. Only the full URL form resolves. Flagged 2026-08-27 during the purge-cache deploy session.

Rules:
1. Edge Functions MUST import `serve` (and any other `std/*` symbol) from the full URL form, matching the `std` version already used in-repo (dominant version: `0.168.0`; grep `grep -rn "deno.land/std@" supabase/functions` to find the version used by sibling functions):
   ```typescript
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
   ```
2. Never introduce a bare `std/...` specifier — it fails `deno check --no-lock` locally even though the deployed bundle (platform import map) might tolerate it, which defeats the Tier-0 gate's purpose of catching errors before deploy.
3. Known pre-existing violation (out of scope to fix in this task): `supabase/functions/sms-send/index.ts` line 4 (`import { serve } from 'std/server';`). Track it; fix it in a dedicated change so it can be deployed and behavior-verified on its own.
4. Detection checklist: `grep -rnE "from 'std/|from \"std/" supabase/functions/` when authoring or reviewing Edge Functions.

## BP-68: Edge Function Log Messages — the Human-Readable Message Is the TOP-LEVEL `event_message` Column, Not a `log_attributes` Key

Problem: When querying Supabase unified logs (`source = 'function_logs'`) to debug an Edge Function, reading `log_attributes['event_message']` returns an EMPTY string — the MCP `mcp_supabase_query_logs` tool flattens the log's `metadata` into `log_attributes` but does NOT include the message there. The actual message/stack lives in the TOP-LEVEL `event_message` column. During DT-10 (2026-08-27) an `UncaughtException` in `create-subscription-payment` was misread as "no message" until the query was changed to `select event_message` — which revealed `event loop error: Error: Deno.core.runMicrotasks() is not supported in this environment` from the `std@.../node/` compat polyfill at `beforeunload` (an isolate-teardown artifact, not a request failure).

Rules:
1. For function/debug messages, select the top-level column: `select timestamp, event_message from logs where source='function_logs' and log_attributes['execution_id']='<exec>'` — never `log_attributes['event_message']` (always empty).
2. Use `log_attributes` for routing metadata only (`deployment_id`, `execution_id`, `request_id`, `function_id`, `event_type`, `level`); join it to `event_message` via `execution_id`/`request_id`.
3. Interpretation: an `event_type='UncaughtException'` row whose `event_message` reads `Deno.core.runMicrotasks() is not supported in this environment` (from `deno.land/std@*/node/_next_tick.ts` at `dispatchBeforeUnloadEvent`) is a Deno Edge Runtime isolate-teardown artifact — the response may already have been sent correctly. Confirm the function's own structured response before concluding a real crash. (Related teardown-noise note: the pattern appears when the Stripe/supabase-js esm.sh build pulls Node-compat `process.nextTick`; sibling functions pinned to lighter builds stayed clean in the DT-10 tests.)

## BP-69: Stripe Test-Mode PaymentMethod Fixtures — Create via `card: { token: 'tok_visa' }`

Problem: Tier-1 live verification (BP-41 rule 5) that needs a disposable Stripe PaymentMethod on a throwaway customer fails in this account for BOTH raw card data (`paymentMethods.create({ card: { number: '4242…' } })` → "Sending credit card numbers directly to the Stripe API is generally unsafe" / raw-card-data APIs disabled) AND `card: { token: 'pm_card_visa' }` (→ `param: 'token'` error — `pm_card_visa` is a test PaymentMethod id, not a Token id). Confirmed 2026-08-27 (DT-10 create-subscription-payment fixture).

Rules:
1. Create a disposable test PM from a magic test Token: `stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } })` (`tok_visa` / `tok_mastercard` / `tok_amex` are pre-existing test-mode Tokens that need no raw-card-data permission).
2. Attach before use: `stripe.paymentMethods.attach(pm.id, { customer })`.
3. Do NOT send raw card numbers — `stripe.tokens.create({ card: { number } })` is also blocked while raw-card-data APIs are disabled on the account.

## BP-70: Disposable-User Cleanup — Delete `profiles` by `user_id`, Not `id`, Before `admin.deleteUser`

Problem: Live Tier-1 verification that creates throwaway users (to test money functions without touching the shared test-buyer's standing subscription) can leave orphaned `profiles` rows. In this app `profiles.id ≠ auth.users.id` — `profiles.user_id` is the FK to `auth.users.id`, while `profiles.id` is the profile row's own id and is NOT a reliable match for the auth user. Deleting `profiles.where id = userId` matches nothing, and `admin.deleteUser` does not reliably cascade to `profiles`. Confirmed 2026-08-27 (DT-10: three orphaned `dt10-*` profiles survived the first cleanup pass).

Rules:
1. Clean up in order: delete child rows (`subscriptions`, etc.), then `profiles.delete().eq('user_id', userId)` (match on `user_id`, never `id`), then `srv.auth.admin.deleteUser(userId)`.
2. supabase-js query builders are THENABLES, not native promises — never `.catch()` on the builder; `await` it inside try/catch.
3. Detection: after a verification run, query `profiles` for the disposable email prefix (e.g. `dt10-%@...`) and confirm zero leftovers.

## BP-71: Stripe Money-Function Verification — Exercise the Actual Charge/Pay Path, Not Just the Guard/Smoke Path

Problem: A Tier-1 "live verification" of a Stripe money Edge Function that only hits the guard/smoke path (e.g. `INVALID_STATUS`, `NO_FAILED_PAYMENT`, `NO_OPEN_INVOICE`, `SUBSCRIPTION_NOT_ACTIVATED`) can PASS while the real charge/pay path is broken. Confirmed 2026-08-27 (DT-11): `renew-subscription` "passed" its DT-6 smoke (returned `INVALID_STATUS` on the shared active test-buyer) yet its actual renewal path was permanently blocked by the constant `sub_<row_id>` idempotency key (Stripe rejects a re-used key whose params differ — every activation mints a fresh price); and `retry-failed-payment` "passed" the `NO_FAILED_PAYMENT` smoke yet could never pay an open invoice because it sent `paid_out_of_band: false`, which Stripe now rejects ("invalid_paid_out_of_band_parameter ... must be 'true'"). Both surfaced only when the ACTUAL charge/pay path ran against a fresh, isolated user.

Rules:
1. For any Stripe function that moves money (create/capture/refund/pay/renew), Tier-1 real-activation verification MUST drive the real charge/pay path end-to-end on a fresh, isolated throwaway user (own Stripe customer + own payment method). A guard-path-only probe is NOT sufficient evidence.
2. Exercise the duplicate path too: retry the exact same request (and/or fire it concurrently) and confirm NO second Stripe object/charge was created (EF response + DB rows + Stripe-side subscription/charge/invoice lists).
3. Use a disposable throwaway user isolated from test-buyer/test-seller (BP-70) and clean it up afterward.
4. Confirm on all three sides: the EF's structured response, the DB rows (`subscriptions`/`billing_history`), and Stripe-side counts.

## BP-72: QA Side-Effect Verification — Confirm the Actual Backend/DB/Stripe State, Not Just the UI Response (Read-Only Checks Pre-Approved)

Problem: QA verification that checks only the UI-facing response — or a smoke-test guard path — misses real bugs in the side-effectful path. DT-11 (2026-08-27) found two genuine production bugs only by exercising the ACTUAL charge/pay path and confirming DB + Stripe state, not the guard/error-response path: `renew-subscription` "passed" its `INVALID_STATUS` smoke yet its real renewal path was permanently blocked by the constant `sub_<row_id>` idempotency key (a renewal that would silently drop a user's subscription); `retry-failed-payment` "passed" the `NO_FAILED_PAYMENT` smoke yet could never pay an open invoice (`paid_out_of_band: false` — a payment-retry button that could never succeed). See BP-71 for the developer-side Tier-1 rule; BP-72 is the standing QA-facing generalization.

Rules:
1. **Side-effect verification is mandatory.** Any QA test case that exercises a UI action with a backend, database, or third-party (Stripe/PayPal) side effect MUST verify that side effect directly — read the relevant database row(s) and/or the actual Stripe/PayPal object state — never assert on the UI response or a smoke-level guard-path check alone.
2. **Real-activation verification is required, not just guard-path smoke checks**, whenever a function's main purpose is to move money or mutate financial state (subscriptions, payments, refunds, payouts) — per the DT-11 lesson that guard-only checks miss bugs in the actual charge/pay/create path.
3. **This class of backend/DB/Stripe read-only verification is pre-approved** and does NOT require manual owner approval per instance — it is a read-only confirmation step, not a mutating action. Mutating test actions (creating/cancelling real test trades, subscriptions, refunds) still follow the existing safe-fixture/disposable-user discipline, using throwaway users where money movement is involved (BP-70 cleanup, BP-69 fixtures, §5.36 fixture collision in the QA playbook).
4. **Worked example (DT-11 pattern):** create a disposable/throwaway user isolated from shared test accounts → exercise the REAL path (not just the guard) → confirm BOTH the third-party (Stripe) object state AND the corresponding database row → then clean up the throwaway user.

## BP-77: Large Single-File Edge Function Deploys — Covered by the Standing CLI Rule (BP-41); MCP Is Last-Resort Only

Problem: The owner rule (2026-08-28, MCP Usage Protocol) mandated deploying Edge Functions through `mcp_supabase_deploy_edge_function`, which accepts only inline `files` content, while BP-41 historically required the CLI — a direct contradiction in the ruleset. For a large single-file function (an inlined, self-contained `index.ts` over ~80KB / ~1,800+ lines with no `_shared/*` deps), the MCP path forces the agent to hand-transcribe the entire file into the `files` payload. On a money-adjacent path a single transcription slip can deploy subtly-broken logic that a one-off test invocation may not catch — worse than the bug being fixed. Confirmed 2026-08-28 (DEV-TASK-33): `create-trade-offer` (1,840 lines / 82KB, all helpers inlined) could not be deployed reliably via the MCP inline-files path, and the owner granted a per-deploy CLI exception. **RESOLVED 2026-08-28 (DEV-TASK-36):** the owner retired the MCP-deploy mandate outright — BP-41 (CLI `--use-api`) is the standing rule for ALL Edge Function deploys, so the large-file case needs no exception and no per-deploy approval. The MCP deploy tool is a documented last-resort fallback only.

Rules:
1. **Default: the CLI, exactly as BP-41 requires.** `supabase functions deploy <name> --project-ref <ref> --use-api` from the repo root is the standing required path for large single-file functions too — no Samer's per-deploy approval is needed (the DEV-TASK-36 resolution retired the MCP-only mandate, so the former "per-deploy CLI exception" framing no longer applies).
2. **MCP `mcp_supabase_deploy_edge_function` is a documented last-resort fallback only** (use when the CLI is genuinely unavailable — no access token / CI restriction, per BP-41 rule 3). If you MUST use it for a large single-file function, be aware of the inline-transcription risk that motivated DEV-TASK-33 (a >~80KB file hand-transcribed into the `files` payload can deploy subtly-broken logic) — and verify the transcribed body carefully before deploying.
3. **Post-deploy validation is non-negotiable on any path (BP-66 / BP-41 rule 5 / BP-71):** confirm the version incremented (`supabase functions list --project-ref <ref>`), then run a real invocation that returns the function's own structured response (not just a clean exit code). For money functions, use a disposable-user real-activation check (BP-71).
4. **Reconcile `verify_jwt` immediately before the deploy command (BP-41 rule 2)** — the CLI sets `verify_jwt` from `supabase/config.toml` (default true when a function is unlisted there).
5. **Log the deploy:** record the function name, size, and deploy path (CLI, or MCP as last-resort) in the Session Handoff so every deploy is auditable.
