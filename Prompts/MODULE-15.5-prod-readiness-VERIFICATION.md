# MODULE 15.5 VERIFICATION CHECKLIST: PRODUCTION READINESS

**Module:** Production Readiness — App Store Approval & Security Hardening  
**Version:** 1.0  
**Total Tasks:** 18 (PROD-P001–P005 prerequisites + PROD-001–PROD-012 + PROD-013 full scan)  
**Spec Source:** `Prompts/MODULE-15.5-prod-readiness.md`  
**Target Score:** 9+/10 production readiness  
**Dependencies:** MODULE-01 (Infrastructure), MODULE-02/03 (Auth), MODULE-09 (SP Wallet), MODULE-13 (Safety)  
**Status:** Ready for Verification

---

## PURPOSE

This checklist verifies that MODULE 15.5 (Production Readiness) has been fully implemented, achieving:
1. Zero App Store rejection blockers (all prerequisite tasks complete)
2. All critical security vulnerabilities patched
3. COPPA compliance enforced server-side
4. Crash reporting and error boundaries live
5. TypeScript and ESLint clean
6. App Store metadata, privacy policy, and data safety forms complete
7. Production environment properly secured
8. Full-stack security scan passed

---

## PRODUCTION READINESS SCORE TRACKER

| Category | Weight | Before | After | Target |
|---|---|---|---|---|
| Security — No service role key exposure | Critical | ❌ | ⬜ | ✅ |
| Security — RLS on financial tables | Critical | ❌ | ⬜ | ✅ |
| Security — No anon access to sp_wallets | Critical | ❌ | ⬜ | ✅ |
| App Store — iOS privacy descriptions | P0 | ❌ | ⬜ | ✅ |
| App Store — PrivacyInfo.xcprivacy | P0 | ❌ | ⬜ | ✅ |
| App Store — COPPA compliance | P0 | ❌ | ⬜ | ✅ |
| App Stability — Global Error Boundary | P0 | ❌ | ⬜ | ✅ |
| App Stability — Sentry integration | P0 | ❌ | ⬜ | ✅ |
| Code Quality — TypeScript strict | P2 | ❌ | ⬜ | ✅ |
| Code Quality — ESLint clean | P2 | ❌ | ⬜ | ✅ |
| **Overall Score** | | **6.5/10** | ⬜ | **9+/10** |

---

## PREREQUISITE TASKS — APP STORE REJECTION BLOCKERS

> **MUST be completed FIRST.** App will be rejected without these. Do not proceed to PROD-001+ until all P tasks are ✅.

---

### PROD-P001: iOS Privacy Descriptions + PrivacyInfo.xcprivacy

**File:** `p2p-kids-marketplace/app.json`  
**Priority:** P0 — App Store REJECTION without this

#### app.json iOS Section
- [ ] `infoPlist.NSCameraUsageDescription` present (kid-friendly language)
- [ ] `infoPlist.NSPhotoLibraryUsageDescription` present
- [ ] `infoPlist.NSLocationWhenInUseUsageDescription` present
- [ ] `infoPlist.NSPhotoLibraryAddUsageDescription` present
- [ ] `infoPlist.ITSAppUsesNonExemptEncryption` set to `false`

#### PrivacyInfo.xcprivacy (Required since Spring 2024)
- [ ] `privacyManifests.NSPrivacyAccessedAPITypes` declares all 4 required API types:
  - [ ] `NSPrivacyAccessedAPICategoryUserDefaults` (reason: `CA92.1`)
  - [ ] `NSPrivacyAccessedAPICategoryFileTimestamp` (reason: `C617.1`)
  - [ ] `NSPrivacyAccessedAPICategoryDiskSpace` (reason: `E174.1`)
  - [ ] `NSPrivacyAccessedAPICategorySystemBootTime` (reason: `35F9.1`)
- [ ] `privacyManifests.NSPrivacyCollectedDataTypes` declares collected data: email, phone, coarse location, photos, purchase history
- [ ] `privacyManifests.NSPrivacyTracking` set to `false`

#### Android
- [ ] `android.permissions` includes `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`

#### Build Verification
- [ ] `cd p2p-kids-marketplace && node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('Valid JSON')"` passes
- [ ] `npx expo prebuild --platform ios --clean` succeeds
- [ ] `ios/*/Info.plist` contains all NSUsageDescription keys after prebuild
- [ ] `ios/*/PrivacyInfo.xcprivacy` file exists after prebuild
- [ ] `npx expo prebuild --platform android --clean` succeeds
- [ ] `android/app/src/main/AndroidManifest.xml` contains all required permissions

---

### PROD-P002: Remove Service Role Key from Admin Portal Browser ✅ DONE

**Status:** Marked DONE in spec — verify the fix is actually in place.

#### Security Validation
- [ ] `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` does **NOT** exist in `p2p-kids-admin/.env.local`
- [ ] `grep -r "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" p2p-kids-admin/src/` returns **zero results**
- [ ] `p2p-kids-admin/src/lib/supabaseAdmin.ts` exists and uses `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix)
- [ ] `p2p-kids-admin/src/app/api/admin/trades/force-cancel/route.ts` exists (API route, server-side)
- [ ] `p2p-kids-admin/src/app/trades/[id]/TradeActions.tsx` calls API route — NOT supabase directly
- [ ] `p2p-kids-admin/src/lib/adminReferralAnalytics.ts` uses `SUPABASE_SERVICE_ROLE_KEY` only (no NEXT_PUBLIC_ fallback)
- [ ] Admin site builds successfully: `cd p2p-kids-admin && yarn build`
- [ ] Browser DevTools Network tab on admin portal shows NO service role key in any request body or header

---

### PROD-P003: Global Error Boundary

**Files:** `p2p-kids-marketplace/src/components/ErrorBoundary.tsx`, `p2p-kids-marketplace/App.tsx` (or root layout)  
**Priority:** P0 — App Store review failure without this

- [ ] `ErrorBoundary` React class component exists
- [ ] `ErrorBoundary` wraps the entire app in `App.tsx` (or equivalent root component)
- [ ] Error boundary shows a **kid-friendly error screen** (NOT raw error text or blank screen)
- [ ] Error screen has "Try Again" button that calls `this.setState({ hasError: false })`
- [ ] Error screen has "Go Home" button to navigate to root screen
- [ ] Error screen does NOT expose technical stack trace to user
- [ ] `componentDidCatch(error, errorInfo)` logs to Sentry (or console in dev)
- [ ] TypeScript: ErrorBoundary component has correct `state: { hasError: boolean }`
- [ ] **Crash test:** Force throwing an error in a child component → error boundary renders correctly (not blank screen)

---

### PROD-P004: Sentry Crash Reporting Integration

**Files:** `p2p-kids-marketplace/app.json` (Sentry plugin), `p2p-kids-marketplace/src/services/monitoring.ts` or equivalent  
**Priority:** P0 — Blind to production crashes without this

#### Installation & Configuration
- [ ] `@sentry/react-native` installed in `package.json`
- [ ] Sentry Expo plugin added to `app.json` plugins array
- [ ] `SENTRY_DSN` environment variable configured (NOT hardcoded in code)
- [ ] `SENTRY_AUTH_TOKEN` configured in EAS secrets (NOT in `.env.local`)

#### Initialization
- [ ] `Sentry.init()` called at app startup (in `App.tsx` or `_layout.tsx`)
- [ ] `tracesSampleRate` set (e.g., `0.2` for 20% performance traces)
- [ ] `environment` set to `'production'` when `process.env.NODE_ENV === 'production'`
- [ ] `debug: false` in production build

#### Error Boundary Integration
- [ ] `ErrorBoundary.componentDidCatch` calls `Sentry.captureException(error)`
- [ ] Sentry captures unhandled promise rejections

#### User Context (COPPA-aware)
- [ ] Sentry user context set with `user.id` only (no PII — no email/name in Sentry scope)
- [ ] No child user data sent to Sentry

#### Verification
- [ ] Test crash in staging: error appears in Sentry dashboard within 60 seconds
- [ ] Source maps uploaded: Sentry shows readable stack trace (not minified)
- [ ] EAS build produces source maps: `eas build --platform ios --profile staging`

---

### PROD-P005: COPPA Compliance Server-Side Enforcement

**Files:** Edge Function or RPC enforcing COPPA gate  
**Priority:** P0 — Legal risk + App Store rejection for kids app without full COPPA gate

#### Age Verification Gate
- [ ] `profiles.date_of_birth` or `profiles.birth_year` column exists
- [ ] **Server-side age check** rejects signup if user is < 13 (enforced in Edge Function or RPC, NOT just client-side)
- [ ] Parent/guardian consent flow implemented for users 13–17
- [ ] `profiles.coppa_consent_given BOOLEAN` column exists (for 13–17 users)
- [ ] `profiles.coppa_consent_at TIMESTAMPTZ` column exists (audit trail)
- [ ] `profiles.guardian_email TEXT` column exists (for contacting parent)

#### Data Minimization
- [ ] Under-13 users cannot create accounts (hard block at server)
- [ ] Under-13 checks happen in Edge Function / DB trigger — NOT just React Native screen
- [ ] No personal data stored for rejected under-13 signups

#### Admin Controls
- [ ] Admin can view users with `coppa_consent_given = false`
- [ ] Admin can manually revoke COPPA consent (compliance requirement)

#### Parental Rights
- [ ] Privacy Policy contains COPPA section explaining parental rights
- [ ] Contact email provided for parents to request data deletion
- [ ] Data deletion request flow documented (even if manual for MVP)

#### Verification
- [ ] Attempt signup with DOB < 13 years ago → signup rejected at server
- [ ] Attempt signup with DOB 13–17 → parent consent flow triggered
- [ ] RLS policy prevents under-13 users from accessing marketplace features

---

## PRODUCTION HARDENING TASKS

---

### PROD-001: Remove Anon RLS Policies from sp_wallets / sp_ledger

**Priority:** P1 — Unauthenticated users can read/write financial data

#### sp_wallets Table
- [ ] `anon` role has **NO SELECT** policy on `sp_wallets`
- [ ] `anon` role has **NO INSERT** policy on `sp_wallets`
- [ ] `anon` role has **NO UPDATE** policy on `sp_wallets`
- [ ] `authenticated` SELECT policy: `sp_wallets WHERE user_id = auth.uid()` only (own wallet)
- [ ] `service_role` has full access (for SP triggers)

#### sp_ledger / sp_transactions Table
- [ ] `anon` role has **NO SELECT** policy on `sp_ledger` (or equivalent table name)
- [ ] `authenticated` SELECT policy: own transactions only (`user_id = auth.uid()`)
- [ ] No `anon` write access to financial tables

**Verification SQL:**
```sql
SELECT grantee, privilege_type, table_name
FROM information_schema.role_table_grants
WHERE table_name IN ('sp_wallets', 'sp_ledger', 'sp_transactions')
  AND grantee = 'anon';
-- Expected: zero rows
```

---

### PROD-002: Restrict admin_config RLS

**Priority:** P1 — Anyone can read internal config (fee rates, feature flags)

- [ ] `anon` role has **NO SELECT** on `admin_config`
- [ ] `authenticated` role has **NO SELECT** on `admin_config` (regular users should not read internal config)
- [ ] `service_role` has full access (for Edge Functions reading config)
- [ ] If mobile app needs config values, they must be fetched via a **server-side RPC** that returns only safe public values (NOT raw admin_config rows)

**Verification SQL:**
```sql
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name = 'admin_config' AND grantee IN ('anon', 'authenticated');
-- Expected: zero rows (or only service_role)
```

---

### PROD-003: Edge Function Rate Limiting

**Priority:** P1 — DDoS/abuse vulnerability

#### Rate Limiting Implementation
- [ ] Rate limiting middleware applied to ALL Edge Functions (not just some)
- [ ] Implementation approach chosen: Upstash Redis / Supabase rate limiter / IP-based
- [ ] Rate limits documented per function (e.g., `transactions-create`: 10/min per user)
- [ ] Rate limit exceeded returns HTTP 429 with `Retry-After` header
- [ ] Rate limiter does NOT block legitimate high-volume operations (e.g., page loads)

#### Highest-Risk Functions (must be rate-limited first)
- [ ] `transactions-create` — Stripe charge initiation (critical)
- [ ] `complete-trade` — financial state change
- [ ] `payout-initiate` — Stripe payout trigger
- [ ] `auth-*` functions — prevent brute force
- [ ] `send-notification` — prevent notification spam

#### Verification
- [ ] Send 15+ rapid requests to `transactions-create` → 429 returned after limit
- [ ] Legitimate usage (1 request/5min) — not rate limited
- [ ] Rate limit headers present in responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

---

### PROD-004: Node Isolation at RLS Level

**Priority:** P1 — Cross-node data leakage possible

- [ ] `items` table RLS SELECT policy includes node check: `items.node_id = profile.active_node_id`
- [ ] `trades` table RLS SELECT policy enforces node isolation for buyer and seller
- [ ] Users in Node A cannot see items from Node B in any API response
- [ ] Node check uses a **stable function** (e.g., `get_active_node_id()`) to avoid re-computing per row

**Verification Test:**
- [ ] Create user in Node A, create user in Node B
- [ ] Node B user queries items → returns 0 results from Node A
- [ ] Node A user queries items → returns 0 results from Node B
- [ ] Performance: Node isolation RLS does not add > 50ms to typical queries

---

### PROD-005: Edge Function Stripe Connect Ownership Verification

**Priority:** P1 — Attacker could initiate payout to arbitrary Stripe account

- [ ] `payout-initiate` Edge Function verifies `stripe_account_id` belongs to the requesting user (NOT taken from request body)
- [ ] `stripe_account_id` fetched from DB using `auth.uid()` — NOT from client-supplied parameter
- [ ] `transactions-create` verifies `listing.user_id != buyer.id` (cannot buy own item)
- [ ] All Stripe API calls validate ownership before processing
- [ ] No Stripe API call uses a `account_id` or `customer_id` from an unverified client input

---

### PROD-006: TypeScript Strictness — Enable noImplicitAny

**Priority:** P2 — Type safety holes across codebase

- [ ] `p2p-kids-marketplace/tsconfig.json`: `"noImplicitAny": true` set
- [ ] `p2p-kids-admin/tsconfig.json`: `"noImplicitAny": true` set
- [ ] `npx tsc --noEmit` on mobile app: **zero errors**
- [ ] `npx tsc --noEmit` on admin portal: **zero errors**
- [ ] No `as any` casts added as shortcuts (each must be reviewed and justified)
- [ ] No `// @ts-ignore` comments added without documented reason

---

### PROD-007: Fix ESLint Failures

**Priority:** P2 — Code quality and potential runtime bugs

- [ ] `cd p2p-kids-marketplace && npx eslint . --max-warnings 0` exits with code **0**
- [ ] `cd p2p-kids-admin && npx eslint . --max-warnings 0` exits with code **0**
- [ ] No `eslint-disable` comments added without documented justification
- [ ] No unused variables or imports remain
- [ ] No `useEffect` missing dependency warnings

---

### PROD-008: Fix Test Failures

**Priority:** P2 — CI pipeline must be green before production

- [ ] `cd p2p-kids-marketplace && npm test -- --watchAll=false` exits with code **0**
- [ ] Zero failing tests
- [ ] Zero skipped tests (unless explicitly documented with reason)
- [ ] Test coverage: critical paths (auth, cart, checkout, SP wallet) have > 70% coverage
- [ ] No tests relying on hardcoded UUIDs or test data that may not exist in CI

---

### PROD-009: App Store Metadata & Privacy Policy

**Priority:** P1 — Required for App Store submission

#### App Store Connect Metadata
- [ ] App name: "Kids P2P Marketplace" (or approved brand name)
- [ ] Subtitle: clear, < 30 characters
- [ ] Description: kid-friendly language, highlights safety features
- [ ] Keywords: relevant, no keyword stuffing
- [ ] Screenshots: all required sizes for iPhone and iPad
- [ ] App preview video: optional but recommended
- [ ] Age rating: correctly set (likely 4+ or 9+ depending on content decisions)
- [ ] Content Rights declaration completed

#### Privacy Policy
- [ ] Privacy policy URL live and accessible (not 404)
- [ ] Privacy policy covers: data collected, COPPA section, parental rights, contact info
- [ ] Privacy policy URL entered in App Store Connect

#### Google Play Metadata
- [ ] Store listing complete with description, screenshots, feature graphic
- [ ] Content rating questionnaire completed (Families policy)
- [ ] Data Safety form completed (see PROD-011)

---

### PROD-010: Consolidate Admin Authentication

**Priority:** P2 — Fragmented auth creates security gaps

- [ ] Admin portal uses a **single, consistent auth mechanism** (not multiple patterns)
- [ ] Verify: `NEXT_PUBLIC_ADMIN_UI_SECRET` is NOT used as sole authentication in any API route
- [ ] All admin API routes verify a proper session token (not just a static secret)
- [ ] Middleware (`p2p-kids-admin/src/middleware.ts`) protects all admin routes
- [ ] Unauthenticated requests to `/api/admin/*` return 401 (not 200 or 500)
- [ ] Admin session timeout configured (e.g., 8-hour sessions)

---

### PROD-011: Android Data Safety & Google Play Families Policy

**Priority:** P2 — Required for Google Play submission

#### Data Safety Form (Google Play Console)
- [ ] Data Safety section completed in Google Play Console
- [ ] Data collected declared: email, phone number, location (coarse), photos/videos, purchase history
- [ ] Data shared with third parties declared (Stripe, Sentry)
- [ ] Data deletion policy stated (users can request via in-app or email)

#### Families Policy (Kids App)
- [ ] App registered under Families Program in Google Play
- [ ] Target audience confirmed: "Children and adults" (mixed audience) OR "Adults only"
- [ ] No interest-based advertising in the app (required for Families Program)
- [ ] Parental gate implemented if any paid content
- [ ] Data collection limited to what's needed for app functionality

---

### PROD-012: Production Environment Configuration & Secret Audit

**Priority:** P1 — Production misconfiguration can expose data or break payments

#### Environment Variables Audit
- [ ] `p2p-kids-marketplace/.env` — no secrets (only public keys like Supabase anon key)
- [ ] `p2p-kids-admin/.env.local` — no `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (already fixed in P002)
- [ ] All secrets in EAS secrets (not in `.env` files committed to git)
- [ ] `.gitignore` includes `*.env.local`, `.env`, `*.pem`, `*.key`

#### Stripe Configuration
- [ ] Stripe **live mode** keys configured for production build (not test keys)
- [ ] Stripe webhook endpoint registered for production Supabase URL
- [ ] Stripe webhook secret stored in Supabase Edge Function secrets (not `.env`)

#### Supabase Production Configuration
- [ ] Production project (`drntwgporzabmxdqykrp`) — not a staging project
- [ ] Supabase Auth redirect URLs include production app URL (not localhost only)
- [ ] Supabase service role key rotated if it was ever exposed (`NEXT_PUBLIC_`)
- [ ] Database password is strong (not default)

#### EAS Build Configuration
- [ ] `eas.json` has separate `production` profile with correct credentials
- [ ] iOS distribution certificate configured
- [ ] Android signing keystore configured and backed up securely

---

### PROD-013: Full-Stack Production Readiness & Security Scan

**Priority:** P1 — Final gate before App Store submission

#### Automated Security Scan
- [ ] `npm audit` on mobile app: zero high or critical vulnerabilities
- [ ] `npm audit` on admin portal: zero high or critical vulnerabilities
- [ ] `npx snyk test` (if configured): zero critical vulnerabilities

#### Manual Security Review
- [ ] Review all Edge Functions: every function has JWT verification (unless explicitly documented as public)
- [ ] Review RLS policies: no table has `anon` write access (except public read tables like `nodes`)
- [ ] Review all API routes: no route returns service role key or internal config in response body
- [ ] Review Stripe integration: no raw Stripe keys in any client-side bundle

#### Performance Baseline
- [ ] App cold start time: < 3 seconds on mid-range device
- [ ] Key screens render within 1 second after data load
- [ ] No memory leaks in `useEffect` subscriptions (verified with Flipper or React DevTools)

#### App Stability Test
- [ ] Error boundary tested: force throw in root component → kid-friendly error screen shown
- [ ] Sentry alert received within 60 seconds of test crash
- [ ] App recovers from offline state (no crash when network unavailable)
- [ ] Push notifications working on physical device (not just simulator)

#### Final Checklist Before Submission
- [ ] `eas build --platform ios --profile production` succeeds without errors
- [ ] `eas build --platform android --profile production` succeeds without errors
- [ ] Internal TestFlight/Internal Test Track distributed to test devices
- [ ] All PROD-P001–P005 prerequisites verified on production build
- [ ] Production readiness score assessed: target **9+/10**

---

## OVERALL SIGN-OFF TABLE

| Task | Priority | Status | Verifier | Date |
|------|----------|--------|----------|------|
| PROD-P001: iOS Privacy Descriptions | P0 | ⬜ | | |
| PROD-P002: Service Role Key Removed | P0 | ⬜ DONE | | |
| PROD-P003: Global Error Boundary | P0 | ⬜ | | |
| PROD-P004: Sentry Integration | P0 | ⬜ | | |
| PROD-P005: COPPA Server-Side | P0 | ⬜ | | |
| PROD-001: Anon RLS on sp_wallets | P1 | ⬜ | | |
| PROD-002: admin_config RLS | P1 | ⬜ | | |
| PROD-003: Edge Function Rate Limiting | P1 | ⬜ | | |
| PROD-004: Node Isolation at RLS Level | P1 | ⬜ | | |
| PROD-005: Stripe Ownership Verification | P1 | ⬜ | | |
| PROD-006: TypeScript noImplicitAny | P2 | ⬜ | | |
| PROD-007: ESLint Failures Fixed | P2 | ⬜ | | |
| PROD-008: Test Failures Fixed | P2 | ⬜ | | |
| PROD-009: App Store Metadata | P1 | ⬜ | | |
| PROD-010: Admin Auth Consolidated | P2 | ⬜ | | |
| PROD-011: Android Data Safety | P2 | ⬜ | | |
| PROD-012: Production Env Config | P1 | ⬜ | | |
| PROD-013: Full-Stack Security Scan | P1 | ⬜ | | |

---

## RELEASE GATE

The app **MUST NOT be submitted to the App Store or Google Play** until ALL of the following are ✅:

- [ ] All 5 PROD-P0xx tasks are complete (zero App Store rejection blockers)
- [ ] All P0 blocking issues from the spec (items 1–6 in the spec's blocking issues table) are resolved
- [ ] Production readiness score: **9+/10**
- [ ] `eas build --platform ios --profile production` succeeds
- [ ] `eas build --platform android --profile production` succeeds
- [ ] Sentry receiving events from production build
- [ ] No critical `npm audit` vulnerabilities

**Final Release Approval:** _________________ **Date:** _________________
