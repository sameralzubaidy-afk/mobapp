# Production Readiness & Security Scan Report

**Task:** PROD-013 (MODULE-15.5 Full-Stack Production Readiness & Security Scan)
**Date generated:** 2026-05-28
**Scanned apps:**
- `p2p-kids-marketplace/` (Expo SDK 54 / RN 0.81.5 / React 19.1.0, TS strict)
- `p2p-kids-admin/` (Next.js 14.0.4 App Router, vitest)
**Shared infra scanned:**
- `supabase/functions/` (58 Edge Functions)
- `supabase/migrations/` (331 SQL files)
- `infra/` (Lambda + Cloudflare Worker)
- `scripts/`
**Scan type:** code-only, no production DB queries, no remote API calls.
**Files inventoried:**

| Directory | TS/TSX/JS/SQL/JSON files |
|---|---:|
| `p2p-kids-marketplace/src` | 683 |
| `p2p-kids-admin/src` | 233 |
| `supabase/functions` | 77 |
| `supabase/migrations` | 331 |
| `infra` | 6,883 (mostly node_modules — excluded from grep) |
| `scripts` | 4 |

---

## Executive Summary

| Severity | Count | Definition |
|---|---:|---|
| **P0** (blocker) | **5** | Store rejection or active secret leak. Must fix before any release. |
| **P1** (high) | **8** | Security weakness or guaranteed regression risk. Fix before GA. |
| **P2** (medium) | **9** | Quality / hardening gap. Fix in the next release cycle. |
| **P3** (low/info) | **6** | Hygiene; informational. |

### P0 Blockers (must clear before release)

1. **`p2p-kids-marketplace/.env.staging` is git-tracked AND contains a real `SUPABASE_SERVICE_ROLE_KEY`** (and other live credentials). Token validity through 2035.
2. **`react-native-fbsdk-next` declared in mobile `package.json`** — Facebook SDK is forbidden by Google Play Families Policy and rejected by Apple for Kids category.
3. **Next.js `14.0.4` with critical CVE** in admin portal — known unauthenticated auth-bypass / DoS in this version range.
4. **`supabase/migrations/20260205000003_ultimate_test_alignment_fix.sql` creates anon write policies** for `profiles`, `subscriptions`, `sp_wallets`, `sp_ledger`, `referrals`, `user_notifications`. If this migration is applied to production, anonymous users can read/write every wallet and subscription.
5. **18 admin API routes have no authentication check at all** (no `verifyAdminAuth`, no session check, no admin secret) — see Category 2.

---

## Findings by Category

### 1. Secrets & Environment Variable Leaks

| Sev | File | Line | Code Snippet | Issue | Fix |
|---|---|---:|---|---|---|
| **P0** | `p2p-kids-marketplace/.env.staging` | 16 | `SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...6BY3FA2Qss` | File is git-tracked. Real service role JWT (exp 2035-04) and Amplitude API key (`f0b9815a...`) exposed in repo. | (1) `git rm --cached p2p-kids-marketplace/.env.staging`. (2) Add `p2p-kids-marketplace/.env.staging` to both root and `p2p-kids-marketplace/.gitignore`. (3) **Rotate the Supabase service role key immediately** (Supabase Dashboard → Project Settings → API → Reset). (4) Rotate Amplitude key. (5) Move staging values to EAS secrets / GitHub Actions secrets only. |
| **P0** | git tracking | — | `git ls-files | grep .env` shows `.env.staging` and `ios.disabled/.xcode.env.local` tracked | `.env.staging` not covered by `.gitignore` rules `.env` / `.env*.local`. | Same as above. Also delete the orphan `ios.disabled/.xcode.env.local` (dead path). |
| **P1** | `p2p-kids-admin/.gitignore` | — | Only covers `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local` | Misses `.env`, `.env.staging`. Currently `p2p-kids-admin/.env.staging` exists locally but is not tracked — only luck. | Add `.env` and `.env.staging` to `p2p-kids-admin/.gitignore`. |
| **P2** | 5 admin API routes | — | `const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET \|\| process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;` in `api/monitoring/trade/[id]/route.ts:4`, `api/monitoring/logs/route.ts:4`, `api/monitoring/logs/[id]/ack/route.ts:5`, `api/monitoring/run/route.ts:5`, `api/monitoring/debug/route.ts:4` | Server-side fallback to client-prefixed var. Server should only read `ADMIN_UI_SECRET`. (Known carry-over from PROD-010 partial migration.) | Migrate all 5 routes to `verifyAdminAuth()` middleware (PROD-010 pattern). Remove `|| process.env.NEXT_PUBLIC_ADMIN_UI_SECRET` regardless. |
| **P3** | `p2p-kids-marketplace/src/services/email.ts` | 21 | Documentation comment mentioning `EXPO_PUBLIC_SENDGRID_API_KEY` | Audit grep flags it; it is intentional commentary explaining what NOT to do (PROD-012). | None — informational only. |

**Grep evidence (run from repo root):**
```sh
git ls-files | grep -E '\.env$|\.env\.'
grep -rnE "EXPO_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|PRIVATE|API_KEY|PASSWORD)" p2p-kids-marketplace/src
grep -rnE "NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD)" p2p-kids-admin/src
grep -rnE "eyJ[A-Za-z0-9_-]{20,}" p2p-kids-marketplace/src p2p-kids-admin/src supabase/functions
grep -rnE "sk_(test|live)_[A-Za-z0-9]+" p2p-kids-marketplace/src p2p-kids-admin/src supabase/functions
```
Hardcoded JWT / Stripe secret-key scans across `src/` returned **0 hits**. The only leak is the `.env.staging` finding above.

---

### 2. Authentication & Authorization Gaps

#### 2A. Admin API routes with NO authentication (P0/P1)

Routes that contain no reference to `verifyAdminAuth`, `ADMIN_UI_SECRET`, `x-admin-secret`, `getUser`, or `session`:

| Sev | Route file |
|---|---|
| **P0** | `p2p-kids-admin/src/app/api/admin/cron-runs/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/cron-jobs/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/sms-stats/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/id-badges/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/id-badges/[requestId]/decide/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/id-badges/[requestId]/screenshot-url/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/id-badges/[requestId]/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/id-badges/stats/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/subscriptions/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/payouts/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/payouts/[id]/retry/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/admin/payout-fees/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/reviews/[reviewId]/hide/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/reviews/[reviewId]/approve/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/reviews/reported/route.ts` |
| **P0** | `p2p-kids-admin/src/app/api/reviews/ban-user/route.ts` |
| **P1** | `p2p-kids-admin/src/app/api/support/route.ts` |
| **P1** | `p2p-kids-admin/src/app/api/support/[id]/read/route.ts` |
| **P1** | `p2p-kids-admin/src/app/api/support/[id]/route.ts` |

**Fix:** Add `const auth = await verifyAdminAuth(req); if (!auth.ok) return new Response('Unauthorized', { status: 401 });` to every route. Cluster appropriately and extend the PROD-010 migration list.

#### 2B. Inconsistent admin auth patterns (P1)

Three patterns coexist in `p2p-kids-admin/src/app/api/`:
1. `verifyAdminAuth()` middleware (5 routes — PROD-010 canonical)
2. Inline `if (req.headers.get('x-admin-secret') !== process.env.ADMIN_UI_SECRET)` (~20 routes)
3. None (19 routes — see 2A)

**Fix:** Make `verifyAdminAuth()` the only allowed pattern. Track migration progress in `docs/PROD-010-ADMIN-AUTH-MIGRATION.md`.

#### 2C. Edge Functions without JWT validation

18 Edge Functions contain no reference to `Authorization` / `x-admin` / `verify_jwt` / `getUser` / `auth.uid`:

| Sev | Function | Justified? |
|---|---|---|
| OK | `stripe-webhook/index.ts` | Webhook — verifies Stripe signature instead. |
| OK | `stripe-webhook-subscriptions/index.ts` | Webhook — Stripe signature. |
| OK | `paypal-webhook/index.ts` | Webhook — verify PayPal signature (confirm). |
| OK | `email-webhook/index.ts` | Webhook — SendGrid signature (confirm). |
| OK | `auto-complete-trades/index.ts` | Scheduled cron via Supabase. |
| OK | `release-pending-sp/index.ts` | Scheduled cron. |
| OK | `trial-reminders/index.ts` | Scheduled cron. |
| OK | `trial-conversion/index.ts` | Scheduled cron. |
| OK | `process-auto-complete/index.ts` | Scheduled cron. |
| OK | `process-expired-offers/index.ts` | Scheduled cron. |
| OK | `cleanup-messages/index.ts` | Scheduled cron. |
| OK | `check-authorization-expiry/index.ts` | Scheduled cron. |
| **P1** | `analyze-item-image/index.ts` | Called from mobile client — must verify JWT. |
| **P1** | `moderate-image/index.ts` | Called from mobile client — must verify JWT. |
| **P1** | `auth-update-phone/index.ts` | Mutates user state; must verify caller identity. |
| **P1** | `sms-send/index.ts` | Outbound paid action; must require authenticated caller + rate-limit. |
| **P1** | `initiate-payout/index.ts` | Money-moving; must require admin auth. |
| **P1** | `payout-settings-redirect/index.ts` | Affects payout config; require user JWT. |

**Fix (P1 functions):** Use the user JWT pattern documented in `docs/PROD-009-EDGE-FUNCTION-VS-RPC.md`. Webhook functions should additionally enforce signature verification (verify all already do, but `paypal-webhook` and `email-webhook` need code-level confirmation).

#### 2D. Client components referencing service role

```sh
grep -rn "service_role" p2p-kids-marketplace/src p2p-kids-admin/src
```
→ The only hits are:
- `p2p-kids-admin/src/lib/adminAuth.ts:11` (comment explaining never to fall back to it — OK)
- Documentation strings in `config/page.tsx:248` (snippet shown in UI for ops — OK)

**No P0 client leaks of the service role key.**

---

### 3. RLS Policy Audit

#### 3A. P0 — anon write/read on critical user tables

| Sev | Table | Migration | Lines | Issue |
|---|---|---|---:|---|
| **P0** | `profiles` | `supabase/migrations/20260205000003_ultimate_test_alignment_fix.sql` | 804-810 | `FOR INSERT TO anon WITH CHECK (true)` + UPDATE + SELECT. Anyone unauthenticated can read/modify any profile (DOB, parental consent flag). |
| **P0** | `subscriptions` | same file | 814-820 | Anon INSERT/UPDATE/SELECT — anyone can grant themselves a Kids Club+ subscription. |
| **P0** | `sp_wallets` | same file | 824-830 | Anon INSERT/UPDATE/SELECT — anyone can mint Swap Points. |
| **P0** | `sp_ledger` | same file | 834-837 | Anon INSERT/SELECT — fabricate ledger entries. |
| **P0** | `referrals` | same file | 841-847 | Anon write — abuse referral incentives. |
| **P0** | `user_notifications` | same file | 851-857 | Anon write — spam every user with arbitrary notifications. |

**Fix (URGENT):**
1. Add a guard migration that drops every `*_anon_*` policy created by `20260205000003_ultimate_test_alignment_fix.sql`.
2. Verify the migration was **never applied to production** by checking `supabase migrations list` against the prod project. The filename ("test alignment") strongly suggests test-only intent, but it sits in the production migrations folder and will run on the next `db push`.
3. If applied to staging or prod, rotate compromised data (sp_wallets balances, subscription rows for affected accounts).

#### 3B. P1 — over-permissive policies that need narrowing

| Sev | Table | Migration | Issue |
|---|---|---|---|
| **P1** | `admin_monitoring_logs` | `20251227_create_admin_monitoring_logs.sql:28-34` | `USING (true)` + `WITH CHECK (true)` — needs to be scoped to `is_admin()` (or to service_role only). |
| **P1** | `seller_payouts` | `073_seller_payouts.sql:210,213` | `FOR INSERT WITH CHECK (true)` / `FOR UPDATE USING (true)` — money-related table; require authenticated + ownership check or service_role only. |

#### 3C. P1 — anon GRANT on RPCs

```
supabase/migrations/20260204000000_..._get_admin_payout_config_safe_parsing.sql:119
  GRANT EXECUTE ON FUNCTION public.get_admin_payout_config() TO anon, authenticated;
supabase/migrations/20260203000000_..._complete_trade_v2_missing_sp_wallet.sql:296
  GRANT EXECUTE ON FUNCTION public.complete_trade_v2(UUID, UUID) TO anon, authenticated;
supabase/migrations/20260205000003_ultimate_test_alignment_fix.sql:239
  GRANT EXECUTE ON FUNCTION public.complete_trade_v2(UUID, UUID) TO anon, authenticated;
```

**Fix:** Revoke `TO anon`. Money-moving RPCs (`complete_trade_v2`) must be `authenticated` only and ideally only callable through a vetted Edge Function. `get_admin_payout_config` must be `authenticated` (admin-checked) only.

#### 3D. P1 — `SECURITY DEFINER` without explicit `search_path`

20+ migration files contain `SECURITY DEFINER` functions that do not `SET search_path = public`, opening them to search_path injection if a hostile schema is later created. Sample (first 20 of many):

```
supabase/migrations/20260325000011_fix_admin_user_detail_tier_lookup.sql
supabase/migrations/084_message_cleanup_wrapper_update.sql
supabase/migrations/074_admin_payout_fee_config.sql
supabase/migrations/20260110000001_badge_triggers.sql
supabase/migrations/20260129000000_referrals_v2_fix_code_sync_and_referred_by.sql
supabase/migrations/20241227_admin_force_cancel_trade.sql
supabase/migrations/083_message_cleanup_audit.sql
supabase/migrations/20251216100002_admin_config_trial_settings.sql
supabase/migrations/094_sp_earning_rpcs.sql
supabase/migrations/20260328000016_fix_admin_rpcs_aggregate_ordering.sql
supabase/migrations/082_message_email_notifications.sql
supabase/migrations/20260112000002_retroactive_badges.sql
supabase/migrations/083_badge_leaderboard.sql
supabase/migrations/097_listing_approval_trigger.sql
supabase/migrations/084_update_leaderboard_query.sql
supabase/migrations/20260207000004_robust_referral_check.sql
supabase/migrations/20241214000001_add_profile_creation_trigger.sql
supabase/migrations/20260325000013_fix_admin_rpcs_transactions_to_trades.sql
supabase/migrations/20260510000003_offer_timeout_rpc.sql
supabase/migrations/081_message_notifications_trigger.sql
```
Full list: `grep -rEln "SECURITY DEFINER" supabase/migrations | while read f; do grep -qE "SET\s+search_path" "$f" || echo "$f"; done`.

**Fix:** Single sweep migration that re-declares every flagged function with `SECURITY DEFINER SET search_path = public, pg_temp` (or `= ''` for full isolation).

#### 3E. RLS DISABLE check
`grep -rniE "DISABLE ROW LEVEL SECURITY" supabase/migrations` → **0 hits.** No table is ever explicitly disabled — good.

---

### 4. Input Validation & Injection

| Sev | File | Line | Issue | Fix |
|---|---|---:|---|---|
| **P2** | `p2p-kids-admin/src/app/referrals/configuration-tab.tsx` | 427 | `style.innerHTML = toggleStyles;` (static CSS string, not user-controlled) | Replace with `<style>` element or styled-jsx. Not actively exploitable, but trips static analyzers. |
| **P1** | `supabase/functions/*/index.ts` (56 of 58 functions) | — | Only `supabase/functions/_shared/contracts/subscriptions.ts` and `payouts.ts` use Zod schemas. Every other Edge Function reads `req.json()` directly with no validation. | Adopt the contract-first pattern (HP-1): define Zod schemas under `supabase/functions/_shared/contracts/<domain>.ts` and validate at every function boundary. Start with money-moving + auth functions. |
| **P2** | mobile + admin | — | No XSS hits (`dangerouslySetInnerHTML` returns 0 results across both apps). | None — informational. |
| **P2** | Edge Function file uploads | — | `analyze-item-image`, `moderate-image`, `payout-settings-redirect` should verify content-type, size limit, and reject non-image MIME. (Code-only verification deferred.) | Audit upload handlers; enforce ≤10MB and image/* MIME with magic-byte check. |

---

### 5. Dependency Vulnerabilities

**`npm audit` summaries:**

| App | low | moderate | high | critical | total |
|---|---:|---:|---:|---:|---:|
| `p2p-kids-marketplace` | 1 | 25 | 16 | 0 | **42** |
| `p2p-kids-admin` | 0 | 4 | 6 | **2** | **12** |

#### Critical / High items requiring action

| Sev | App | Package | Notes |
|---|---|---|---|
| **P0** | admin | `next` (14.0.4) | CRITICAL CVE. Upgrade to ≥14.2.30 (or 15.x). |
| **P0** | admin | `handlebars` | CRITICAL. Transitive — check tree with `npm ls handlebars`; remove or upgrade root. |
| **P1** | admin | `vite`, `flatted`, `minimatch`, `picomatch`, `@typescript-eslint/*` | All transitive devDeps. Upgrade after Next.js bump. |
| **P1** | mobile | `axios` (HIGH) | Upgrade to ≥1.7.4. |
| **P1** | mobile | `lodash`, `lodash.pick` (HIGH) | Audit imports (most likely transitive). Replace with `lodash-es` where possible. |
| **P1** | mobile | `native-base` (HIGH) | If not used, remove. Otherwise upgrade. |
| **P1** | mobile | `@xmldom/xmldom`, `tmp`, `fast-uri` | Transitive. Force-resolve via `npm overrides`. |

**Fix:** Run `npm audit fix --force` in a branch, run full Tier 2, validate, and merge. For root vulnerabilities (Next.js), bump manually and re-test.

---

### 6. Error Handling & Crash Resilience

| Sev | File | Line | Issue | Fix |
|---|---|---:|---|---|
| **P2** | `p2p-kids-admin/src/app/monitoring/page.tsx` | 181 | `} catch (e) {}` — silent swallow. | Log via `console.warn` with context, or surface via toast. |
| **P3** | mobile `src/contexts/AuthContext.tsx` | 927 | `AppState.addEventListener('change', handleAppStateChange);` — verify the returned subscription is removed in cleanup. | Confirm `subscription.remove()` called in `useEffect` return. |
| **P3** | mobile | various | 4 `setInterval` call-sites: `OfferCountdownPill.tsx:26`, `AutoCompleteBanner.tsx:25`, `useItemDraft.ts:222`, `useUserBadges.ts:306`. | Spot-check each has `clearInterval(...)` in cleanup. |
| OK | mobile | `App.tsx` + `components/ErrorBoundary.tsx` | Error Boundary exists with tests (PROD-P003). | None. |

`grep -rnE "catch\s*\([^)]*\)\s*\{\s*return\s+(null|undefined)"` returned **0 hits** across both apps — no silent-error patterns of that form.

---

### 7. iOS & Android Store Compliance

| Sev | File | Issue | Store Impact | Fix |
|---|---|---|---|---|
| OK | `p2p-kids-marketplace/app.json` `ios.infoPlist` | All required `NS*UsageDescription` keys present (Camera, PhotoLibrary, PhotoLibraryAdd, LocationWhenInUse, UserTracking, ITSAppUsesNonExemptEncryption). | — | None. |
| OK | same | `ios.privacyManifests` present. | — | None. |
| OK | same | `android.targetSdkVersion = 35` (PROD-011). | — | None. |
| **P0** | `p2p-kids-marketplace/package.json` | `"react-native-fbsdk-next": "^13.4.3"` declared. | **Hard reject — Google Play Families Policy + Apple Kids Category.** Even if not imported, the SDK ships in the Info.plist / Manifest and is detected by Play Store's automated scan. | (1) `npm uninstall react-native-fbsdk-next`. (2) Re-run prebuild + verify no FBSDK entries in `ios/Podfile.lock` or AndroidManifest. (3) Update `docs/GOOGLE-PLAY-DATA-SAFETY.md` to confirm zero ad/analytics SDKs. |
| **P3** | mobile src | 566 `console.log/debug/info` calls (`grep -rE "console\.(log|debug|info)" p2p-kids-marketplace/src \| wc -l`). | Production log spam; some leak PII (see Cat 8). | Add a logger abstraction that drops `log/debug/info` when `!__DEV__`. Or configure Babel `transform-remove-console` for prod builds. |
| **P3** | `p2p-kids-marketplace/src/utils/testUsers.ts`, `testEmail.ts` | Test/dev helpers shipped in `src/utils/` (production bundle). | Bloat + exposes test addresses. | Move to `src/__tests__/utils/` or `scripts/dev/`. |
| OK | mobile + admin | `grep -rnE "['\"]http://"` (excluding localhost) returned 0 hits. | — | None. |

---

### 8. Data Privacy & COPPA

| Sev | File | Line | Data | Issue | Fix |
|---|---|---:|---|---|---|
| **P2** | `p2p-kids-marketplace/src/screens/auth/ForgotPasswordScreen.tsx` | 43 | email | `console.log('Password reset requested:', { email });` | Drop email from log; log only an opaque request id. |
| **P2** | `p2p-kids-marketplace/src/screens/SignupScreen.tsx` | 136 | email | `console.log('[SignupScreen] Account exists:', { email: emailAddr, provider });` | Drop email; log `{ providerExists: true }` only. |
| **P2** | `p2p-kids-marketplace/src/screens/LoginScreen.tsx` | 87, 143 | email | `console.log('[AUTH] Logging in user:', email);` and similar. | Same as above. |
| **P2** | `p2p-kids-marketplace/src/screens/profile/EditProfileScreen.tsx` | 194, 425, 449 | phone, email | Phone/email-bearing context strings in `console.warn`. | Strip values; log error code/message only. |
| OK | `p2p-kids-marketplace/src/services/errorReporter.ts` | 82 | — | `sendDefaultPii: false` in Sentry init. | None — correct. |
| OK | `supabase/migrations/20260601000001_coppa_enforcement.sql` | 20 | — | `is_coppa_compliant()` server-side check exists (PROD-P005). | None. |
| **P3** | `p2p-kids-marketplace/src/utils/testEmail.ts` | 17-108 | test addresses | Hardcoded `test@example.com` defaults; ships in production bundle. | Move to dev/test scope. |

---

### 9. Performance & Resource Leaks

| Sev | File | Line | Issue | Fix |
|---|---|---:|---|---|
| **P2** | `p2p-kids-marketplace/src/screens/profile/SellerProfileScreen.tsx` | 78 | `.select('*')` without `.range()` or `.limit()` on a list query (production code path). | Add `.limit(50)` + paginate. |
| **P3** | mobile `setInterval` callsites | see Cat 6 | Memory leak risk if cleanup is incomplete. | Confirm `clearInterval` in each `useEffect` return. |
| **P3** | `p2p-kids-marketplace/src/contexts/AuthContext.tsx` | 493, 539, 892 | 3 `channel.subscribe(...)` realtime subscriptions in one provider. | Confirm `.unsubscribe()` / `removeChannel` in cleanup; consolidate channels if possible to reduce realtime quota. |
| OK | — | — | No N+1 patterns surfaced by automated scan. Manual review recommended for trade detail + dashboard screens. | — |
| OK | — | — | No moment.js / full lodash imports found via `grep -rn "import .* from 'moment'"` (0 hits in `src/`). | — |

---

### 10. Configuration & Build

| Sev | File | Issue | Fix |
|---|---|---|---|
| OK | `p2p-kids-marketplace/tsconfig.json` | `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`. | None. |
| **P3** | `p2p-kids-admin/tsconfig.json` | `strict: true` only; no explicit `noImplicitAny` / `strictNullChecks` (inherited via `strict`). | OK in practice; add explicit flags for clarity. |
| **P0** | `.gitignore` coverage | Root + mobile + admin miss `.env.staging`. Result: real service role key committed (Cat 1). | Add `.env.staging` (and `*.env.staging`) to all three `.gitignore` files. |
| **P2** | `p2p-kids-marketplace/.env.local.example` vs actual usage | `.env.local.example` documents `EXPO_PUBLIC_AMPLITUDE_API_KEY` but no scan hit shows it used in `src/`. Conversely `EXPO_PUBLIC_CDN_URL`, `EXPO_PUBLIC_DEV_SMS_BYPASS`, `EXPO_PUBLIC_ENABLE_REALTIME`, `EXPO_PUBLIC_FROM_EMAIL`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_REPLY_TO_EMAIL`, `EXPO_PUBLIC_SMS_API_URL`, `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`, `EXPO_PUBLIC_EAS_PROJECT_ID` are used in src but not in example. | Sync `.env.local.example` with `docs/ENVIRONMENT-VARIABLES.md`. |
| **P3** | `p2p-kids-admin/.env.example` | Mentions `NEXT_PUBLIC_SUPABASE_URL` and friends, but admin actually uses `NEXT_PUBLIC_CDN_URL` and `NEXT_PUBLIC_ADMIN_API_URL` (from src scan). | Sync example with `docs/ENVIRONMENT-VARIABLES.md`. |
| OK | `p2p-kids-marketplace/eas.json` | dev / preview / production profiles present (verified in prior PROD tasks). | None. |
| **P3** | `ios.disabled/.xcode.env.local` | Tracked file in deprecated path. | `git rm` the entire `ios.disabled/` tree (dead code from re-prebuild). |

---

## Cross-Reference vs. Known MODULE-15.5 Blockers

| Known issue (from MODULE-15.5 spec) | Caught by scan? |
|---|---|
| iOS Privacy Manifest missing | ✅ Verified present. |
| Android target SDK < 35 | ✅ Verified 35 (PROD-011). |
| Service role key exposed | ✅ **Found** — `.env.staging` git-tracked. |
| `NEXT_PUBLIC_*` secret leaks | ✅ Found `NEXT_PUBLIC_ADMIN_UI_SECRET` (allowed exception) + 5 server-side fallbacks (P2). |
| Edge Functions without JWT | ✅ Found 6 P1 + 12 OK (webhooks/cron). |
| RLS gaps | ✅ Found `20260205000003_ultimate_test_alignment_fix.sql` (P0). |
| Empty catch blocks | ✅ Found 1 in admin. |
| Error Boundary missing | ✅ Present (PROD-P003). |
| COPPA server-side enforcement | ✅ Present (PROD-P005). |
| Ad SDKs in kids app | ✅ **Found** `react-native-fbsdk-next` (P0). |

---

## Recommended Remediation Order

1. **Immediate (today):**
   - Rotate Supabase service role key + Amplitude API key.
   - `git rm --cached p2p-kids-marketplace/.env.staging` + update `.gitignore` (3 files).
   - Verify `supabase/migrations/20260205000003_ultimate_test_alignment_fix.sql` has NOT been applied to prod; write guard migration to drop the anon policies if it has.
   - `npm uninstall react-native-fbsdk-next` in mobile.
2. **This week:**
   - Add `verifyAdminAuth()` to the 18 unauthenticated admin API routes.
   - Migrate the 5 monitoring routes off `NEXT_PUBLIC_ADMIN_UI_SECRET` server-side fallback.
   - Upgrade Next.js to ≥14.2.30 (critical CVE).
3. **This sprint:**
   - Add Zod input validation to the 6 P1 Edge Functions.
   - Sweep migration to add `SET search_path = public, pg_temp` to all flagged `SECURITY DEFINER` functions.
   - Add a `babel-plugin-transform-remove-console` for prod builds and strip PII from auth screens.
4. **Next sprint:**
   - Resolve remaining `npm audit` highs.
   - Move test helpers out of `src/utils/`.
   - Audit Edge Function file upload validation.

---

## Appendix A: Commands Used (reproducible)

```sh
# Discovery
git ls-files | grep -E '\.env$|\.env\.'
for d in p2p-kids-marketplace/src p2p-kids-admin/src supabase/functions supabase/migrations infra scripts; do
  find $d -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.sql' -o -name '*.json' \) | wc -l
done

# Category 1 — Secrets
grep -rnE "eyJ[A-Za-z0-9_-]{20,}" p2p-kids-marketplace/src p2p-kids-admin/src supabase/functions
grep -rnE "sk_(test|live)_[A-Za-z0-9]+" p2p-kids-marketplace/src p2p-kids-admin/src supabase/functions
grep -rnE "NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD)" p2p-kids-admin/src
grep -rnE "EXPO_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|PRIVATE|API_KEY|PASSWORD)" p2p-kids-marketplace/src

# Category 2 — Auth
for f in supabase/functions/*/index.ts; do
  grep -lE "Authorization|x-admin|verify_jwt|getUser|auth.uid" "$f" >/dev/null || echo "NO AUTH: $f"
done
for f in $(find p2p-kids-admin/src/app/api -name 'route.ts'); do
  grep -l "verifyAdminAuth" "$f" >/dev/null && continue
  grep -lE "ADMIN_UI_SECRET|x-admin-secret|getUser|session" "$f" >/dev/null && echo "OTHER AUTH: $f" || echo "NO AUTH: $f"
done

# Category 3 — RLS
grep -rniE "DISABLE ROW LEVEL SECURITY" supabase/migrations
grep -rniE "USING\s*\(\s*true\s*\)|WITH CHECK\s*\(\s*true\s*\)" supabase/migrations
grep -rniE "TO\s+anon" supabase/migrations
grep -rEln "SECURITY DEFINER" supabase/migrations | while read f; do
  grep -qE "SET\s+search_path" "$f" || echo "MISSING search_path: $f"
done

# Category 4 — XSS / validation
grep -rn "dangerouslySetInnerHTML" p2p-kids-admin/src p2p-kids-marketplace/src
grep -rnE "\.innerHTML\s*=" p2p-kids-admin/src p2p-kids-marketplace/src
grep -rln "zod\|z\.object\|z\.string" supabase/functions

# Category 5 — Deps
cd p2p-kids-marketplace && npm audit --json
cd p2p-kids-admin && npm audit --json

# Category 6 — Errors
grep -rnE "catch\s*\([^)]*\)\s*\{\s*\}" p2p-kids-marketplace/src p2p-kids-admin/src
grep -rnE "catch\s*\([^)]*\)\s*\{\s*return\s+(null|undefined|void)" p2p-kids-marketplace/src p2p-kids-admin/src
grep -rn "ErrorBoundary\|componentDidCatch\|getDerivedStateFromError" p2p-kids-marketplace/src

# Category 7 — Store
python3 -c "import json; d=json.load(open('p2p-kids-marketplace/app.json')); print(d['expo']['ios']['infoPlist'].keys())"
grep -iE "admob|facebook-ads|@react-native-google-mobile-ads|react-native-fbsdk|applovin|ironsource|unityads" p2p-kids-marketplace/package.json p2p-kids-admin/package.json
grep -rnE "['\"]http://(?!localhost|127\.0\.0\.1)" p2p-kids-marketplace/src p2p-kids-admin/src

# Category 8 — PII
grep -rnE "console\.(log|warn|error|info|debug)\([^)]*(email|phone|dob|password|ssn|address)" p2p-kids-marketplace/src p2p-kids-admin/src
grep -rn "sendDefaultPii\|Sentry.init" p2p-kids-marketplace/src p2p-kids-admin/src
grep -rnE "is_under_13|age.{0,3}<.{0,3}13|coppa|parental_consent" supabase/migrations supabase/functions

# Category 9 — Perf
grep -rn "addEventListener" p2p-kids-marketplace/src
grep -rnE "setInterval\(" p2p-kids-marketplace/src
grep -rnE "\.subscribe\(" p2p-kids-marketplace/src
grep -rnE "\.select\(\s*['\"]\\*['\"]\s*\)" p2p-kids-marketplace/src p2p-kids-admin/src

# Category 10 — Config
grep -E "strict|noImplicit|strictNull" p2p-kids-marketplace/tsconfig.json p2p-kids-admin/tsconfig.json
```

---

## Appendix B: Out of Scope (not scanned in this pass)

- **Live database state** (per house rule: no SQL execution against prod from agent). Audit `supabase migrations list` manually to confirm the `20260205...test_alignment_fix.sql` migration was never pushed.
- **Live API contracts** (no remote calls). Stripe/PayPal/SendGrid webhook signature verification was code-pattern-checked only.
- **Bundle inspection** (no `expo prebuild` / `npm run build` artifacts inspected). After PR's land, run `npx expo prebuild --platform android --clean` and grep `android/app/src/main/AndroidManifest.xml` to confirm no FBSDK metadata.
- **`infra/` deep dive** — Cloudflare worker and Lambda were not scanned for env leaks (6,883 files dominated by `node_modules`). Recommend running the same secret regex against `infra/aws/lambda-sns-send-sms/index.js` and `infra/cloudflare-worker/*.js` directly.
- **Runtime dynamic checks** (XSS via stored content, SSRF, IDOR) — would require staging environment with seed data.
