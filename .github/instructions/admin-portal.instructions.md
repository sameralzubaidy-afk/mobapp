---
description: "Use when writing or reviewing admin-portal code in the Kids P2P Marketplace (Next.js app in p2p-kids-admin/): client→API authentication, admin config writes, and admin surface conventions."
applyTo: "p2p-kids-admin/src/**"
---

# Admin Portal Hardening Protocol

Full bug-prevention rule text below: BP-49, BP-89. See the Bug Prevention Rule Index in `Kids P2P App Builder.agent.md` for the one-line summary of all rules.

> **Scope note:** the admin portal lives in the `p2p-kids-admin` **git submodule** (`sameralzubaidy-afk/mobappadmin`). Rules that live in that submodule's own repo do not move here — this file covers admin-portal code as seen from this workspace. Admin-adjacent rules that are really Postgres rules stay in `supabase-sql.instructions.md` (e.g. BP-45 searchable admin surfaces need text-cast views; BP-48 admin config writes go through the shared RPC).

### Rule Index (scan this first; open the full rule below only when it's relevant to your current task)

- BP-49 Admin client→API auth — every browser fetch to `/api/admin/*` MUST send the `x-admin-secret: NEXT_PUBLIC_ADMIN_UI_SECRET` header (or an explicit Bearer JWT); a header-less client call 401s with "No valid authentication provided" (there is no middleware to inject it).
- BP-89 Verifying a data-mutating admin action — never trigger the real write against shared QA/staging data just to prove UI wiring; stub the endpoint with Playwright `page.route('**/api/...', fulfill)` and assert the surrounding behaviour (the follow-up refetch fires, the label/summary updates, the dialog copy is right), then disclose in the handoff that the write was INTERCEPTED, not applied (FIX-Task-21 item 4, 2026-09-12).

## BP-49: Admin Portal Client→API Auth — Always Send `x-admin-secret` on Browser Fetches to `/api/admin/*`

**Problem:** The admin web app's browser→API routes authenticate two different ways: (1) the shared `x-admin-secret` header — client components send `NEXT_PUBLIC_ADMIN_UI_SECRET` — or (2) a Supabase JWT via an explicit `Authorization: Bearer` header. `verifyAdminAuth()` returns `{ authorized: false, error: 'No valid authentication provided' }` (HTTP 401) when a request carries NEITHER. The app has NO middleware, so the Supabase session cookie never reaches the API route. New client-side fetches that omit the header silently 401 — the page shows a generic "Fetch failed" / 401 instead of data.

**Rules:**

- For EVERY browser-side fetch to `/api/admin/*` (client component, hook, or page), send the header: `headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '' }` — this is the established, working pattern (DisputeActions, CancellationInsightsClient, config page, id-badge pages, etc.).
- `NEXT_PUBLIC_ADMIN_UI_SECRET` is the client-visible secret; the server compares it against the server-only `ADMIN_UI_SECRET`. Keep the two values equal in `.env.local` / `.env.staging` / CI.
- Do NOT rely on a session cookie or on `Authorization: Bearer` being auto-added — `verifyAdminAuth` reads only the `x-admin-secret` header or an explicit Bearer header on the request.
- When a fetch to an admin API returns 401 / "No valid authentication provided", inspect the outgoing headers BEFORE touching the endpoint code.
- Do NOT copy legacy omission: some older admin pages (e.g. payout-retry calls) POST to `/api/admin/*` with no auth header and 401 in practice — new code must include the header.
- Cross-ref BP-35 (always check the `{success}`/response result): a 401 is a non-ok response that must be surfaced, not swallowed.

**Detection checklist:** any admin-page fetch failing with 401 / "No valid authentication provided" / "Fetch failed" → confirm the request carries `x-admin-secret` (or an explicit Bearer JWT). If it carries neither, the fix is in the CLIENT (add the header), not the endpoint.

## BP-89: Verifying a Data-Mutating Admin Action Without Mutating Data — Intercept the Write at the Network Layer

**Problem (FIX-Task-21 item 4, 2026-09-12):** the `/reviews` fix (refetch the queue after a moderation action so its headline total cannot go stale) can only be *observed* by triggering a real Keep/Hide. But those writes are destructive to shared state: Keep **deletes** the `review_reports` rows, Hide sets `is_hidden = true` — so clicking either one during verification would have silently changed the staging fixture and invalidated the next QA round. The only alternatives were "mutate the fixture and hope nobody notices" or "skip verification and claim the fix works" — both bad. The answer is to stub the write and assert everything *around* it.

**Rules:**

- For a fix whose proof needs a write you must not perform (moderation Keep/Hide, an admin config save, a payout trigger, a dispute resolution), intercept the endpoint with Playwright and fulfil it locally, then assert the behaviour your fix actually changed:
```ts
// Register the dialog handler FIRST — moderation actions are gated behind a native confirm().
page.on('dialog', (d) => d.accept());
// Stub the write: the endpoint never reaches the server, so no staging data changes.
await page.route('**/api/reviews/*/keep', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
);
// Count the behaviour under test rather than assuming it happened.
let refetches = 0;
page.on('request', (r) => { if (r.method() === 'GET' && r.url().includes('/api/reviews/reported')) refetches++; });
// ...click the action, then assert refetches === 1.
```
- Count the follow-up request (a `request` listener filtered by method + URL) — never infer "the refetch happened" from the fact that the page still looks right.
- Capture the dialog copy while you are there: an intercepted run still exercises the real `confirm()` text, which is the cheapest way to verify copy changes (FIX-Task-21 also closed Q19's stale guide copy this way).
- If the MUTATION's own effect must be proven (not just the UI wiring), do it against a **disposable fixture** and say which one (BP-80); never against shared QA/reviewer data.
- Say so in the Session Handoff: "verification used an intercepted write — the action was NOT applied to staging", so nobody reads "verified" as "executed against the DB".

**Detection checklist:** a fix that only becomes observable after a destructive action → stub the write before driving it; if you find yourself about to click Keep/Hide, a Save that changes platform-wide config, or a payout/dispute action purely to look at the UI, stop and intercept instead. Related: BP-80 (a mutating step is approval-gated, and "written, NOT applied" must be stated explicitly).

## Secrets hygiene for this app (local env files)

- `.env.local` holds real secrets (Supabase service-role key, Stripe secret, `ADMIN_UI_SECRET`, `SENTRY_AUTH_TOKEN`, `ADMIN_E2E_PASSWORD`, `ADMIN_STAGING_EMAIL`/`ADMIN_STAGING_PASSWORD`). It is listed in the submodule's `.gitignore` **and must never be tracked** — if it shows up in `git status` as tracked, stop and untrack it (`git rm --cached .env.local`) before continuing. `.gitignore` does NOT apply to an already-tracked file, so "it's in .gitignore" is not proof it isn't committed.
- `.env.local.example` is the committed placeholder template. Add any new local-only key there first, with a placeholder value.
- Never hardcode or log a credential, and never put one in a doc, an instruction file, or a handoff.
