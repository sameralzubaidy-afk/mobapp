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
- BP-41 Edge Function deploys — every relative import must be in the `files` array, including transitive ones.
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

## BP-41: Verify All Relative Imports Are Included in the Edge Function Deploy `files` Array
Problem: `mcp_supabase_deploy_edge_function`'s `files` array must include ALL files the entrypoint imports via relative paths, including transitive ones. Missing a dependency causes "Module not found" deploy failures.

Rules:
1. Before deploying, scan the entrypoint for ALL relative imports (including transitive ones).
2. Use the correct relative file name: `"_shared/<file>.ts"` (relative to the Supabase functions root, not the entrypoint).
3. Deploy the entrypoint and dependencies in a single call — do not deploy them separately.
4. After a "Module not found" failure, re-invoke the deploy with ALL dependency files included.
5. Verify the deployment succeeded by checking the returned `version` incremented.
