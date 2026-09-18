# Bug Prevention rule index

Moved verbatim from `.github/agents/Kids P2P App Builder.agent.md` (2026-09-18, Phase D) so the always-loaded agent file stays small. Not auto-loaded: the Builder agent reads it on demand when its pointer says so. Edit in place here; do not copy back into the agent file.

## 🛡️ Appendix: Bug Prevention Rule Library (BP-1 – BP-93)

These rules are derived from 200+ bug fixes in this project. You MUST follow them to prevent recurring issues.

### Rule Index (scan this first; open the full numbered rule below only when it's relevant to your current task)

- BP-1 RLS — every new table needs RLS policies in the same migration.
- BP-2 FK type matching — verify target column type before INSERT (user_id vs profile.id).
- BP-3 Ambiguous columns — qualify every column with a table alias.
- BP-4 Trigger silent failures — never bare-catch; log to debug_logs.
- BP-5 SECURITY DEFINER — document why; set search_path.
- BP-6 Pre-deploy SQL checklist — run the 5 verification queries before staging SQL.
- BP-7 Edge Function errors — structured `{success, error}` JSON, always logged.
- BP-8 TS service errors — return typed `ServiceResult<T>`, never swallow to null.
- BP-9 Migration order — tables → constraints → RLS → policies → functions → triggers → indexes → seed.
- BP-10 Verification queries — include column/RLS/function/trigger checks in every DB response.
- BP-11 Admin config two tables — check both admin_config and sp_config; don't trust is_active alone.
- BP-12 RPC RETURNS TABLE changes — DROP FUNCTION before changing the signature.
- BP-13 Default values — every hardcoded fallback needs a comment linking to its canonical source.
- BP-14 SP notification copy — “reserved” ≠ “spent”; match sp_ledger transaction_type semantics.
- BP-15 Pull-to-refresh — must pass forceRefresh=true to bypass client caches.
- BP-16 Stale trigger comments — if a referenced trigger doesn't exist in any migration, it's a defect.
- BP-17 send-trade-notifications — check `result.sent > 0`, never trust `resp.ok` alone.
- BP-18 Reminder EFs — must insert `user_notifications` explicitly, not rely on status-change triggers.
- BP-19 Cron-invoked EFs — `verify_jwt = false` in config.toml + `--no-verify-jwt` on deploy.
- BP-20 Before building notifications — search for existing DB triggers that already cover the event.
- BP-21 RPC → data-only refactor — the corresponding cron.schedule must exist in the same migration.
- BP-22 Secret keys (service role) — resolve ONLY from config at runtime; never a hardcoded fallback and never baked into a cron `net.http_post` header (hardcoded fallback allowed only for non-secret base URLs).
- BP-23 Realtime callbacks — must mirror the same side effects the mount-time effect performs.
- BP-24 Partial reverts — leave a `// DEFERRED-DECISION` comment on code that survives a partial revert.
- BP-25 Edge Function compile gate — use `deno check --no-lock`, not `get_errors` (false positives on Deno globals); run from the repo root with `--no-config` (or a `/tmp` copy) — a stray RN tsconfig can false-fail the gate (DT-118, 2026-09-05).
- BP-26 EF performance — check `execution_time_ms` + staircase pattern before guessing at the bottleneck.
- BP-27 Duplicate enforcement — search for DB triggers/RPCs that duplicate an Edge Function's business rule check.
- BP-28 Admin-configurable values — Edge Functions must fail loud (`CONFIG_UNAVAILABLE`), never silently fall back.
- BP-29 Data-source renames — audit every downstream reference (empty states, filters, counters) after a restructure.
- BP-30 Formula changes — verify against 2+ independent doc examples before implementing.
- BP-31 SP fixes — verify both the trigger layer AND the RPC/read layer together.
- BP-32 State-change notifications — identify the delivery path and verify it with a test case before calling it done.
- BP-33 Persistent UI (tab bars/headers) — render once at the root stack, never per-screen.
- BP-34 Alert→Toast migrations — classify every call site individually (success/toast, error/blocking, choice/blocking).
- BP-35 Mutating service calls — always check the `{success}` result before a dependent step.
- BP-36 Realtime subscriptions — confirm the table is in the `supabase_realtime` publication; watch for RLS-filtered events.
- BP-37 Tax calculation — always on full item price; SP is a payment method, not a discount.
- BP-38 Fee config — absolute percentage per tier, never base+discount; confirm the calculation base with the user.
- BP-39 FunctionsHttpError — `.message` is hardcoded; always parse `.context.clone().json()`.
- BP-40 Stripe trial params — `trial_end`/`trial_period_days` are mutually exclusive; use if/else if.
- BP-41 Edge Function deploys — REQUIRED path is the official CLI (`supabase functions deploy <name> --project-ref <ref>`), which resolves `../_shared/*` from the local filesystem (manual `files`-array enumeration — the MCP-bundler approach — is retired for new work). Applies to ALL Edge Function deploys regardless of file size or shared-import status (DEV-TASK-36 retired the MCP-deploy mandate; the MCP deploy tool is a documented last-resort fallback only). ALWAYS pass `--use-api` (a plain deploy with Docker not running can print "Deployed" while silently doing nothing — BP-66) and follow EVERY deploy with a MANDATORY post-deploy behavior check (real invocation returning the function's own response, not just a clean exit code). Reconcile `verify_jwt` against `config.toml` and re-verify it IMMEDIATELY BEFORE the deploy command (BP-41 rule 2) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-42 Trade detail tax preview — derive from the joined listing's `price`, never from `cash_amount_cents`.
- BP-43 Navigation & params — verify callers pass route params, verify navigator imports, check buyer AND seller paths.
- BP-44 Tax/SP/fee RPC recompute — must be category-aware and match the offer-time calculation; grep for stale `get_node_tax_rate`-only writers on tax-exemption bugs.
- BP-45 Searchable admin surfaces — never `ilike` a UUID column or `::cast` inside `or=()`; create a text-cast view (`admin_trades_view`/`admin_payments_view`).
- BP-46 Function DECLARE hygiene — every `v_*` used in the body must be declared; diff the DECLARE block before authoring/applying (`42601 <var> is not a known variable`).
- BP-47 Latest migration definition is authoritative — verify the target DB's trigger/handler is attached AND current before treating a missing-row failure as an app bug (deployment lag ≠ code bug); a fragile pattern in a historical migration FILE isn't live if a newer `CREATE OR REPLACE` removed it (superseded body = dead code — don't patch it).
- BP-48 Admin config writes — settings MUST go through the shared `upsert_admin_config_setting(p_admin_id)` RPC; never direct `admin_config` table writes (records editor + audit trail); and a value-only write must not move the row's sibling columns (`category`/`data_type`/`is_active`) — pass them explicitly on both the set and the revert.
- BP-49 Admin client→API auth — browser fetches to `/api/admin/*` MUST send `x-admin-secret: NEXT_PUBLIC_ADMIN_UI_SECRET` (or an explicit Bearer JWT); a header-less client call 401s with "No valid authentication provided" (no middleware to inject it) — full text: `.github/instructions/admin-portal.instructions.md`.
- BP-50 — **UNASSIGNED** (no rule text exists under this number; do not allocate it without checking first).
- BP-51 Pre-deploy verification — run `git diff` / grep the function for the new symbol before deploying an Edge Function; edits can be lost if the working tree is reverted between turns — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-52 — **UNASSIGNED** (no rule text exists under this number; do not allocate it without checking first).
- BP-53 QA-testID controls — must set `accessible` + `accessibilityRole` (mirror `ui/Button`) so identifiers surface on the iOS tree; confirm on-device — unit tests alone are insufficient. Never use `accessibilityRole="tab"/"tablist"` on iOS (RN 0.81 — doesn't register in the AX tree); use `"button"` + `accessibilityState`.
- BP-54 Dynamic `import('react-native')` / export enumeration — never use it; Metro's `importAll` iterates RN's lazy getters (e.g. `PushNotificationIOS`) and can crash with `new NativeEventEmitter() requires a non-null argument` when the linked native module is absent — use static imports only — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-55 Root-level gate state set only by a mount effect — won't react to child-screen navigation; wire an explicit `initialParams` callback and funnel all exit paths through one shared helper.
- BP-56 Design tokens — Discover/design code must import `ds` from `@/theme/discoveryTokens`, which must stay reconciled to `docx/design-system-passitup.md` (#5DBB8E); never source from legacy `design-system.md` (#4A7C59) or hardcode hex in Discover components.
- BP-57 Behavior-fix test drift — a fix that makes an auto-verify/auto-submit path actually work will break tests written around the old broken behavior (they relied on a manual fallback); audit & update those tests — the failure is evidence the fix worked, not a regression.
- BP-58 Bottom-anchored UI on pill-nav screens — scroll content needs `paddingBottom: 100`, fixed bottom bars `bottom: 120`, and in-flow bars above a fixed bar `marginBottom: 200`, so CTAs/buttons are never hidden behind the floating pill (PersistentTabBar). Padding only helps when the content actually OVERFLOWS the viewport — a screen whose content fits never scrolls, so verify overflow before treating padding as the fix.
- BP-59 Scripted JSX mass-edits — verify with more than typecheck alone: typecheck + grep for bare prop-lines followed by a JSX child + Prettier (a formatter rewriting the region signals structural problems).
- BP-60 Test isolation — a `renderScreen()`-style helper that accepts or defaults to a shared/mutable route/params object leaks state between tests (e.g. an earlier test's `draftId` silently carries into a later test and disables draft-auto-save); always pass explicit, freshly-constructed params per test, and check for this pattern before blaming a flaky-looking failure on the feature code.
- BP-61 Accessibility-prop text as literal `<Text>` children — accessibility props must be JSX attributes on the opening tag, never rendered children (recurred 3×: `WelcomeScreen`, `ResumeDraftBanner`, `CartScreen`); cheap to grep for (`accessible accessibilityRole` inside JSX children) whenever writing or reviewing `<Text>` components.
- BP-62 TABLE-returning RPCs — supabase-js returns `RETURNS TABLE(...)` results as an ARRAY even for a single row; always unwrap `data[0]` (the `verify_email_change_code` always-“Verification failed” bug, 2026-08-26) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-63 Cross-schema PostgREST uniqueness — `admin.schema('auth').from('users').maybeSingle()` returns HTTP 406 (read as “no row”); use a SECURITY DEFINER RPC (`check_account_exists_by_email`) and FAIL CLOSED on RPC error (account-email-takeover hazard, 2026-08-26) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-64 Never log OTP / verification codes in plaintext — not even on staging (logs are more broadly accessible than the DB); log only the destination (`send-phone-otp`, 2026-08-26) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-65 Stripe `idempotencyKey` placement — must be the OPTIONS (2nd) argument (`stripe.paymentIntents.create(params, { idempotencyKey })`), NEVER a property inside the params object (Stripe SDK v14 silently DROPS all params — broke `create-trade-offer`/`trade-extension`/`trade-payment`, 2026-08-27) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-66 Plain `supabase functions deploy` can silently no-op when Docker isn't running while printing “Deployed” — ALWAYS `--use-api` or verify the deployed body (version bump + real invocation / `functions download` diff into a TEMP dir, never into `supabase/functions/`); a “Deployed” console message is never sufficient evidence (2026-08-27) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-67 No bare `std/*` imports in Edge Functions — no import map exists in this repo, so `import { serve } from 'std/server'` fails the local `deno check --no-lock` Tier-0 gate; import `serve` from the full URL (`https://deno.land/std@<version>/http/server.ts`). Known pre-existing violation (out of scope to fix now, tracked): `sms-send` — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-68 Edge Function log messages — for `function_logs`, the human-readable message/stack is the TOP-LEVEL `event_message` column, never `log_attributes['event_message']` (always empty); `log_attributes` carries only execution/request metadata (DT-10, 2026-08-27) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-69 Stripe test-mode PaymentMethod fixtures — `paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } })`; raw card numbers and `pm_card_visa` both fail in this account (DT-10, 2026-08-27) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-70 Disposable-user cleanup — `profiles.id ≠ user_id` in this app; delete `profiles` by `user_id` (never `id`) and `await` builders before `admin.deleteUser` (DT-10, 2026-08-27) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-71 Stripe money-function verification — Tier-1 live verification MUST drive the ACTUAL charge/pay path on a fresh, isolated throwaway user (real charge + retry-dedupe + DB/Stripe confirm); guard-path-only smokes hide broken pay paths (`renew-subscription` key blocker, `retry-failed-payment` `paid_out_of_band:false` — DT-11, 2026-08-27) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-72 QA side-effect verification — any QA case exercising a UI action with a backend/DB/third-party (Stripe/PayPal) side effect MUST verify the side effect directly (read the DB row(s) + actual Stripe/PayPal object state), not just the UI response or a guard-path smoke; real-activation verification is REQUIRED for money/financial-state functions; this class of READ-ONLY DB/Stripe verification is PRE-APPROVED (no per-instance owner sign-off) — mutating test actions still use the safe-fixture/disposable-user discipline (DT-12, 2026-08-27) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-73 Trades FK + payout-method schema — the `trades`→`items` FK is `listing_id` (never `item_id`); Stripe Connect / payout-method state lives in `seller_payout_methods`, not `profiles` (TRD part-2, 2026-08-27) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-75 RLS-disabled audit — the authoritative list of tables with RLS off comes from the LIVE `pg_class.relrowsecurity` query, never migration greps (migrations are incomplete/misleading — `nodes` looks off in the repo but is on, and legacy tables exist only in the DB); trace every table's readers/writers (client vs service-role vs SECURITY DEFINER) before enabling RLS (DEV-TASK-26, 2026-08-28) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-74 Tier-1 harness notification assertion — assert on the linkage key (`user_notifications.data.ledger_id` ↔ `sp_ledger.id`) when verifying a DB-triggered notification; a shared/fuzzy filter helper can silently drop the row and cause a false fail (DT-19, 2026-08-28) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-76 Enum-like status/reason values — DB writers must emit the canonical snake literal (`'offer_expired'`) that triggers AND the client match exactly; never store a display string (`'Offer expired'`) in a machine-compared column, or expired-offer surfacing / the seller-ignore streak silently break (TRD re-verify, 2026-08-28). When a CHECK constraint legally admits TWO spellings of one state (live: `subscriptions.status` allows `'grace'` AND `'grace_period'`), widen every server gate + client allow-list to both AND normalize the data — and count the distribution (`SELECT status, count(*) … GROUP BY status`) before trusting any status-driven rule, because one legacy-spelled outlier row is a FIXTURE defect that fakes a product-level failure (FIX-Task-51, 2026-09-17) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-77: **RETIRED (merged into BP-41, 2026-09-12)** — was "Large single-file EF deploys — CLI `supabase functions deploy --use-api` is the standing required path even for large self-contained single-file functions"; every clause was already stated by BP-41, which DEV-TASK-36 made apply to ALL functions, so "large single-file" is no longer a distinct rule. Historical BP-77 citations refer to BP-41 (deploy-logging requirement is BP-41 rule 8) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-78 Money-mutating RPC grants + identity — explicit minimal grants (REVOKE anon/authenticated/PUBLIC + GRANT minimal set), `auth.uid()`-derived identity + `admin_has_role(auth.uid())`/party checks, role checks via `current_setting('role')` (NEVER `request.jwt.claim.role` — unset on this PostgREST), verify referenced helpers exist on the target DB, audit grants via LIVE `aclexplode(pg_proc.proacl)` not migration greps, and PostgREST maps `42501` to HTTP 401 — treat a 401 from a revoked caller as the expected rejection (`GRANT` without `REVOKE FROM PUBLIC` leaves PUBLIC executable — DT-59, 2026-08-30) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-79 Default-privilege hardening for functions is ineffective here — use the `dt61_guard_revoke_fn_public` event trigger + explicit-grant discipline. The guard also fires on `CREATE OR REPLACE FUNCTION` (same `command_tag`), so replacing an existing function STRIPS its PUBLIC/anon/authenticated grants while untouched siblings keep theirs: re-assert `GRANT EXECUTE` in the same migration and verify with `has_function_privilege(<role>,'public.<fn>(<args>)','EXECUTE')` + a before/after `aclexplode(pg_proc.proacl)` diff (FIX-Task-51, 2026-09-17) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-80 Two-phase provisioning deliverables — fixture/migration work is delivered as (1) code/scripts/migration file written + Tier 0 green and (2) executed against staging (REQUIRES Samer's explicit approval per the MCP Usage Protocol); in the Session Handoff state "written, NOT applied/run" and mark the regression tier DEFERRED, never implying provisioning happened (DEV-TASK-77, 2026-08-31); a fixture script's read-back must print the fixture's own primary key(s) — never only a row count (FIX-Task-17, 2026-09-11).
- BP-81 MCP-applied migrations aren't in `list_migrations` — `mcp_supabase_apply_migration` executes DDL but doesn't write a `schema_migrations` row; verify the migration landed by invoking the changed object live, never by the migration list (DEV-TASK-83, 2026-09-02) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-82 Account/subscription screens (incl. ContinueKidsClub) — Pass It Up semantic tokens only; no Material/Tailwind/iOS-system-blue leakage (Manage Kids Club+ family `#4CAF50`/`#E53935`/`#0066CC`/`#D97706` etc., confirmed 2026-09-02) AND no legacy-design-system tokens (`#4A7C59`/`#4D4D4D`/`#808080` — ContinueKidsClub upsell branch, confirmed 2026-09-05); EVERY rendered branch of a screen must be on-brand (BP-82 rule 6) — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-83 Stripe test-clock renewal verification — a test clock cannot be retro-attached to an existing Checkout subscription (`parameter_unknown`); verify a real renewal on a fresh clock-bound subscription metadata-bound to the same `user_id` (2026-09-02) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-84 Money-ledger repair path — a money ledger with a recompute RPC (`seller_balance` ← `recompute_seller_balance`) must be repaired/reset ONLY through that RPC (locked `service_role`-only); never a raw ledger write, and never leave a ledger-recompute PUBLIC-executable (DT-118, 2026-09-05) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-85 Money display units — cents-stored money MUST use a cents formatter (`formatPrice` → "$1.49"), never the dollars formatter (`formatDollarAmount` → "$149") (DT-118, 2026-09-05) — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-86 Membership/value-prop copy — subscription surfaces must render the CANONICAL in-app benefit set (ManageKidsClub "Kids Club+ Benefits" / JoinKidsClub `STATIC_BENEFITS`), never an invented list; grep the whole class before shipping (DT-118, 2026-09-05) — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-87 DB-trigger/cron-invoked EF auth — do NOT enforce strict `bearer === env SUPABASE_SERVICE_ROLE_KEY` inside a DB-trigger/cron-invoked EF: the DB posts the `admin_config`-stored key, which can drift from the platform-injected env → every trigger/cron call 401s and money rows strand (DT-124, 2026-09-06) — mirror `initiate-payout` (eligibility + ownership + idempotency) or refresh the stored key — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-88 Error/defensive branches need a real runtime trigger — a mocked-error unit test can green-light dead code (`signInWithOAuth({skipBrowserRedirect:true})` never throws for a disabled provider → ProviderDisabled classification unreachable, raw JSON shown in the browser sheet/custom tab; FIX-Task-2 Item 4, 2026-09-07). Same class, second face: a user-visible value built from an ASYNC READ silently renders its FALLBACK when the fetch returns null — a review title showed the role ("the buyer") instead of the counterparty's name, and every static check was green (FIX-Task-21 Item 2, 2026-09-12). Third face: an INVENTED MOCK SHAPE keeps an unreachable branch green — copy the fixture from the SDK's documented constructor/`error_code` (real wrong-password is `400` + `invalid_credentials`, not `401` + no code), or the classifier's `default:` arm ships the wrong copy while the test stays green (FIX-Task-26 verification, 2026-09-13) — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-89 Verify a data-mutating admin action WITHOUT mutating data — never trigger the real write against shared QA/staging data just to prove UI wiring; stub the endpoint with Playwright `page.route(...)` and assert the surrounding behaviour (the follow-up refetch fires, the label/summary updates, the dialog copy is right), then disclose that the write was INTERCEPTED not applied. **HARD GATE: `page.unroute()` (or close the page) BEFORE reporting the verification complete** — a left-registered stub fakes every later real click and is NOT cleared by a dev-server restart (FIX-Task-21 item 4 + FIX-Task-22 item 0, 2026-09-12) — full text: `.github/instructions/admin-portal.instructions.md`.
- BP-90 Patching a live function body by string replacement — anchor the token to its full expression (`p.status = 'failed'`, never the bare `p.status`, which also matches the suffix of `sp.status`), re-assert every predicate you did NOT intend to change in a `RAISE EXCEPTION` guard, fail loud when nothing matched, and INVOKE the patched object immediately (plpgsql resolves names at run time, so a successful `CREATE OR REPLACE` proves nothing) (FIX-Task-24 item 1, 2026-09-12) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-91 Mobile UI changes need an in-session on-device attempt — a screen-behaviour change must get a device pass in the SAME session, or the Session Handoff must enumerate every owed device leg concretely (screen → action → expected observation) and say "code-level verified; device legs owed"; never treat typecheck/lint/unit-green as on-device verification, budget the device pass BEFORE the code work, and re-read the AX tree rather than trusting a screenshot taken immediately after a tap (FIX-Task-25, 2026-09-13) — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-92 Paint only authoritative values — every displayed number derives from the SAME array/state its visible list renders (no parallel state written by a second fetcher), all counters of one quantity share one helper, and a money/state value is never painted from a placeholder fallback a fetch will correct — withhold it (`—`/skeleton) and disable any control that submits it until it is authoritative (F8 banner-vs-button count, F9 tiles-vs-list frame lag, F4 checkout first-paint total — FIX-Task-26, 2026-09-13) — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-93 Jest mocks must return identity-stable objects — an inline `useNavigation: () => ({…})` mock re-creates every dependent `useCallback` per render, so a `useFocusEffect` loops and the screen never leaves its loading state; use a module-level `mock`-prefixed constant and debug by asserting mock call counts (jest output is suppressed) (FIX-Task-26, 2026-09-13) — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-94 A `jest.mock()` factory must mirror the module's FULL export surface — adding a new import to the module under test requires adding that export to every factory that stubs it in the SAME pass; an unlisted export is `undefined` at call time, its `TypeError` is swallowed by the consumer's own `try/catch` (soft-fail), and the test then asserts on the fallback/error branch while staying green — give each factory export an explicit impl + `beforeEach` default (`clearAllMocks` does NOT reset implementations). **Auto-mock face:** a BARE `jest.mock('<mod>')` (no factory) mocks the ENTIRE module, so every export is `jest.fn()` → `undefined` and pure predicates/formatters placed behind an I/O module vanish for every caller — keep dependency-free logic in its own leaf module the service re-exports (FIX-Task-28, 2026-09-13; auto-mock face FIX-Task-53, 2026-09-17) — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-95 Client-side in-memory caches of USER-SCOPED data must be keyed by user and cleared on auth transitions (`SIGNED_OUT`/`SIGNED_IN`/`USER_UPDATED`) — never one process-global module slot read without a session check (a `_pmCache` in `subscription.ts` served one account the previous user's saved card after a warm `qa-login-as` persona switch; DB column + Stripe customer both empty, and a fresh-process control rendered the correct empty state — QA SUB Android Round 1, 2026-09-16). Companion of BP-15: BP-15 = correct on refresh, BP-95 = correct on identity change — full text: `.github/instructions/mobile-client.instructions.md`.
- BP-96 Re-measure the WHOLE migration chain after any fix that flips a previously-failing file to passing — a newly-succeeding early file creates state a later file assumed absent (fixing `084`'s block comment let its `CREATE SCHEMA IF NOT EXISTS cron` placeholder break the FIX-38 repair's `CREATE EXTENSION pg_cron`, deleting `public.trades` and cascading to ~77 files: 448/523 → 347/527); watch the pass-1 applied count as the canary, read a deferred-replay probe's per-file error as its LAST error not the root cause, enumerate the gap by diffing the live schema against the replayed schema rather than reading the failure list (that diff found 30 tables / 82 functions / 124 policies where the failure list suggested 3 tables), and prefer creating an object correctly at its creator over repairing it later (FIX-Task-40, 2026-09-16), and **re-run the probe after EVERY migration file you add or edit, not only after a repair** — a file added one day after the chain was last green re-broke it (`531/531` → `530/531`) by re-declaring a function's ROW TYPE with a narrower shape (FIX-Task-57, 2026-09-18) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-97 A deployed Edge Function that has never processed ONE real delivery is UNVERIFIED — "source parity with a working sibling" proves the code shipped, not that the path can run (the `stripe-webhook` endpoint rejected EVERY Stripe event for weeks via the synchronous `constructEvent`'s `SubtleCryptoProvider cannot be used in a synchronous context`; found within minutes of building the signed-replay helper). Ask "has this handler ever completed one real delivery?", build the signed-delivery mechanism early, read the rejection message not just the status, and use `await constructEventAsync` on Deno (FIX-Task-52, 2026-09-17) — full text: `.github/instructions/edge-functions.instructions.md`.
- BP-98 A fixture/provisioning script must only assert a state the PRODUCTION WRITERS can create — enumerate every writer of the columns it fakes before trusting it; a fixture that hand-sets an impossible combination does not merely green-light a branch, it can SKIP the very gate it was built to test (a fixture setting `is_primary=true, is_verified=false` made the app's `!primaryMethodId` gate evaluate false, so the withdraw guard's unverified branch had never fired on a device while the case sat "BLOCKED (fixture gap)" for weeks — FIX-Task-55/56, 2026-09-18) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-99 A migration filename is an ORDER KEY, and the CLI only applies files matching `<digits>_<name>.sql` — anything else is silently skipped (never logged as `Applying migration …`, so it looks like the SQL never ran), a legacy-numbered name sorts BEFORE every 14-digit name (a stale `077_…` duplicate replayed first and killed `db reset` with `relation "public.admin_config" does not exist`, hiding the chain's real state), and a legacy file that re-declares an object's ROW TYPE makes the newer definition fail or silently lose; never renumber by hand, never infer age from the prefix, and assert the non-conforming-name count is 0 before trusting a run (FIX-Task-57, 2026-09-18) — full text: `.github/instructions/supabase-sql.instructions.md`.
- BP-100 A schema-diff residual is EVIDENCE, not a to-do list — classify every difference by DIRECTION before backfilling (staging-ahead / chain-ahead / staging-looser-unsafe / dead-cruft), grep the object's own history for a deliberate `DROP` before re-adding it, never drive the count to zero (the only regression signal is a NEW finding), name the gate's blind spots (no `prosrc` body, no `proacl` grants), and **ATTRIBUTE a NEW finding before reporting it** — temporarily remove your own artifact, re-measure, and treat key-set-identical output as proof the delta is not yours (another session's uncommitted migration moved the gate 135 → 136 in FIX-Task-61, 2026-09-18) (FIX-Task-60, 2026-09-18) — full text: `.github/instructions/supabase-sql.instructions.md`.

BP-1: RLS Policy Prevention — full text moved to `.github/instructions/supabase-sql.instructions.md` (auto-attaches when editing `supabase/migrations/**/*.sql`).

BP-2: Foreign Key Type Matching — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-3: Ambiguous Column Reference Prevention — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-4: Trigger Silent Failure Prevention — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-5: SECURITY DEFINER Function Rules — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-6: Pre-Deploy SQL Validation Checklist — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-7: Edge Function Error Handling — full text moved to `.github/instructions/edge-functions.instructions.md` (auto-attaches when editing `supabase/functions/**`).

BP-8: TypeScript Service Error Handling — full text moved to `.github/instructions/mobile-client.instructions.md` (auto-attaches when editing `p2p-kids-marketplace/src/**`).

BP-9: Migration Dependency Order — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-10: Required Verification Queries — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-11: Admin Config Two-Table Architecture — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-12: RPC Return Type Changes Require DROP First — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-13: Default Values Must Reference the Canonical Source — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-14: Notification Copy Must Be Reviewed for SP Transactions — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-15: Pull-to-Refresh Must Bypass Client-Side Caches — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-16: Config Comments Referencing Non-Existent Triggers Are Defects — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-17: `send-trade-notifications` Response Body Check — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-18: In-App Notification Must Be Explicit for Reminder EFs — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-19: Cron-Invoked EFs Must Set `verify_jwt = false` — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-20: Check Existing DB Triggers Before Building Notification Logic — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-21: Cron Job Must Be Created When Refactoring RPC from HTTP-Calling to Data-Only — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-22: Secret Keys Must Resolve from Config at Runtime — Never Hardcoded or Baked into a Cron Header — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-23: Realtime Callback Must Mirror Mount-Time Side Effects — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-24: Partial Reverts Must Leave DEFERRED-DECISION Comments — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-25: Tier 0 Build Gate — `deno check` for Edge Functions, Not `get_errors` — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-26: Edge Function Performance Diagnosis — `execution_time_ms` + Staircase Pattern — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-27: Edge Function Enforcement — Check for Duplicate DB-Side Checks — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-28: Admin-Configurable Values Must Have Zero Hardcoded Fallback in Edge Functions — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-29: Downstream Reference Audit When Renaming or Restructuring Data Sources — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-30: Formula Documentation Cross-Reference — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-31: SP Fix Verification — Verify Both Trigger and RPC Layers — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-32: Notification Verification Gate for State Changes — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-33: Globally Persistent UI Elements Must Be Rendered at Root Level — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-34: Alert → Toast Replacement Must Audit ALL Success Paths — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-35: Return Value Gate — Every Mutating Service Call Must Check Its Result — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-36: Realtime Subscription Table Membership Verification — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-37: Tax Must Always Be Calculated on Full Item Price, Not Reduced by SP — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-38: Fee Config Semantics — Absolute Percentages Per Tier, Not Base+Discount — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-39: `FunctionsHttpError.message` Is Hardcoded — Always Parse `.context` for the Real Error — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-40: Stripe `SubscriptionCreateParams.trial_end` and `.trial_period_days` Are Mutually Exclusive — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-41: Required Deploy Path — Use the Official `supabase functions deploy` CLI (always `--use-api`), Not the MCP Bundler — full text moved to `.github/instructions/edge-functions.instructions.md`.

BP-42: Tax Preview on Trade Detail Screens Must Use Joined Listing Price, Not `cash_amount_cents` — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-43: Learned Navigation & Params Rules — full text moved to `.github/instructions/navigation.instructions.md` (BP-43-1 route-params verification; BP-43-2 navigator-import validation; BP-43-3 buyer AND seller paths).

BP-44: Tax/SP/Fee RPC Recompute Must Be Category-Aware and Match the Offer-Time Value — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-45: Searchable Admin Surfaces Need Text-Cast Views (never `ilike` a UUID or cast inside `or=()`) — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-46: Postgres Function DECLARE Block Must Declare Every `v_*` Variable Used in the Body — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-47: E2E Tests Asserting Trigger-Created Defaults Must Verify the Trigger Exists in the Target DB (deployment lag ≠ code bug) — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-48: Admin Config Settings Writes Must Go Through the Shared RPC (never direct `admin_config` table writes; record the editor; a value-only write must not clobber `category`/`data_type`) — full text moved to `.github/instructions/supabase-sql.instructions.md`.

BP-49: Admin Portal Client→API Auth — Always Send `x-admin-secret` on Browser Fetches to `/api/admin/*` — full text moved to `.github/instructions/admin-portal.instructions.md`.

BP-53: QA-Automation `testID`s Must Be Exposed as Real iOS Accessibility Elements (incl. Modal/Pressable-container grouping — set `accessible={false}` on overlay/sheet so buttons surface) — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-55: Root-Level UI Gated on Mount-Effect-Only State Must Be Flipped by an Explicit Child→Parent Callback — full text moved to `.github/instructions/navigation.instructions.md`.

BP-56: Discover/Design Code Must Use the Canonical Pass-It-Up Tokens (never legacy `design-system.md` or raw hex) — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-57: Behavior-Fix Test Drift — a fix that makes an auto-verify/auto-submit path actually work breaks tests written around the old broken behavior (manual-fallback reliance); audit & update those tests — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-58: Bottom-Anchored UI Must Clear the Floating Pill Nav (PersistentTabBar) — includes the "padding only works when the content overflows the viewport" precondition; full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-60: Shared Test-Render Helpers Must Receive Explicit Clean Params (test isolation) — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-61: Accessibility Props Must Be Attributes on the Opening Tag, Never Literal `<Text>` Children — full text moved to `.github/instructions/mobile-client.instructions.md`.

BP-80: Two-Phase Provisioning Deliverables (code/Tier-0 vs. approval-gated execution) — full text moved to `.github/instructions/supabase-sql.instructions.md`.



**Detection checklist:** a subsequent session/QA pass can't find a column/trade/row the previous session's handoff implied existed, or a handoff's Regression Plan shows a Tier as PASS when the migration it depends on was never applied — check for the two-phase wording ("written, NOT applied/run") in the prior handoff before assuming the data is there. Also: a fixture's only reported evidence is an aggregate count ("cart has 3 item(s)", "N rows created") with no key to re-find it — the script's read-back must surface its own primary key(s). (Real case: FIX-Task-17 item 11, 2026-09-11 — `qa:create-bundle-fixture` SELECTed `bundle_id` in its read-back but logged only a count, so the bundle could not be identified after the fact; the script was patched to print `bundle_id`/`cart_id`, which is how the fixture became verifiable by id under BP-72.)
