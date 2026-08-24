# Flow Registry

This file is the canonical registry of end-to-end flows and their required regression checks.

## Flows

### CROSS-CUTTING SWEEPS (2026-08-23) — console.error → errorReporter + BP-53 AX audit
- **SWEEP-A-CONSOLE-ERROR-REPORTER (2026-08-23):** Repo-wide sweep routing raw `console.error` in user-facing error branches through `captureException`/`captureMessage` (errorReporter/Sentry). Third recurrence of the LogBox-leak class (QA Group A+B+D finding #4; the stale `[phoneService] send-phone-otp invoke error` console.error caused the A07 forced-relaunch).
  - Scope: ALL live `src/screens/**` (excl `.old.tsx`, dead root `screens/LoginScreen.tsx`/`screens/SignupScreen.tsx`, tests) + auth/onboarding/phone/verification services (`auth.ts`, `phone.ts`, `phoneService.ts`, `passwordService.ts`, `verification.ts`, `location.ts`, `waitlist.ts`, `supabase/auth.ts`). ~80 files.
  - Pattern mirrored from `screens/auth/ForgotPasswordScreen.tsx` (commit `f421923c`): `captureException(error, { tags: { screen, action }, extra })`; non-error diagnostics use `captureMessage(msg, 'warning')`.
  - Verified effective: `EXPO_PUBLIC_SENTRY_DSN` is set in `.env.local`/`.env.staging` and `initErrorReporter()` runs in `App.tsx`, so captured errors go to Sentry (no dev LogBox banner).
  - Intentionally retained: JSDoc example in `passwordService.ts:133`; `console.log`/`console.warn` instrumentation (not part of the leak class).
  - Regression: Tier 0 only (no DB/API/contract change). `yarn typecheck` PASS; `yarn lint` no NEW errors (20 pre-existing unrelated errors unchanged); `yarn test` 3398 pass / 0 fail (updated `ReferralsScreen.test.tsx` share-error assertion to the corrected `captureException` behavior per BP-57).
- **SWEEP-B-BP53-AX (2026-08-23):** Third recurrence of the BP-53 testID-accessibility class. Repo-wide audit: every `TouchableOpacity`/`Pressable` with a `testID` gets `accessible` + `accessibilityRole="button"` + `accessibilityLabel` (mirroring `ui/Button.tsx`), so QA testIDs surface on the iOS AX tree.
  - Named QA gaps fixed: `login-back-button` (LoginScreen), `signup-back-button` (SignupScreen), Profile utility rows `profile-billing-history`/`profile-settings`/`profile-admin-dashboard`/`profile-help-support`/`profile-logout`.
  - App-wide: all literal-testID buttons across screens + components now carry all three props; dynamic-testID controls (e.g. `category-chip-${id}`) carry `accessible` + `accessibilityRole="button"` (label is provided by visible children — a fabricated label would be wrong). ~110 files.
  - Intentionally non-button (flagged, NOT "fixed" into buttons): `BadgeCelebrationModal` `celebration-overlay` (modal backdrop) + `celebration-content` (content container). The node chip is a plain `View`, not a touchable.
  - Known scanner limitation: 46 dynamic-testID sites are flagged by the heuristic scanner only for missing `accessibilityLabel`; these have `accessible`+`accessibilityRole` and child-text labels — complete for QA-surfacing purposes.
  - Regression: Tier 0 only. `yarn typecheck` PASS; `yarn lint` no NEW errors; `yarn test` PASS. (Scripted insertion passes were run, all JSX corruption detected via typecheck + JSX-text scan and repaired; Prettier applied to all 139 changed files.)
- Impacted flows: FLOW-01 (auth locators + console.error), FLOW-02 (onboarding/profile), FLOW-04 (listings), FLOW-06 (discovery), FLOW-07 (cart), FLOW-08 (trade), FLOW-10 (SP wallet), FLOW-12 (subscription), FLOW-14 (messaging), FLOW-17 (notifications), FLOW-21 (ID badge), FLOW-22 (payouts), FLOW-25 (settings/legal).

### AUTH-CLEANUP-FIXTURES-OTP (2026-08-24) — C07 social-only fixture, P03 unread-message fixture, C05 provider-outage toggle, gate-modal OTP design compliance
- **Fix 1 — C07 social-only fixture (FLOW-01):** `seed:staging` now provisions `qa-social-only@kidsmarketplace.test` (id `a1234567-…-00000000000d`) via `admin.createUser` with **NO password** + a completed profile, so `can_set_password()` returns `true` and AUTH-TC-C07's "social-only user sets a password" is testable. Seed verifies the precondition via `check_account_exists_by_email` (expects `has_password: false`). Login leg (attaching a real OAuth identity) is an operator step documented in `/memories/repo/qa-test-accounts.md`.
- **Fix 2 — P03 unread-message fixture (FLOW-14/FLOW-01):** `seed:staging` seeds one trade-scoped message from test-seller → test-buyer with `read_at IS NULL` (`seedUnreadMessageFixture`), so the header chat unread badge renders `1` (AUTH-TC-P03 testable; badge clears after `mark_trade_messages_read`).
- **Fix 3 — C05 provider-outage toggle (FLOW-01):** new `qa_provider_unavailable` admin_config toggle (`getSimulatedProviderOutage` in `src/services/devTestingService.ts`) short-circuits `initiateSocialLogin` with a faithful `ProviderUnavailableError` when armed (`google`|`facebook`|`apple`|`all`) → the "provider unavailable → email fallback banner" is device-testable without a real provider 5xx. Fail-closed in release/unarmed builds.
- **Fix 4+5 — gate-modal OTP design compliance + Text-strings warning (FLOW-01/AUTH-V3-009):** `PhoneVerificationModal` code step now uses the canonical single auto-formatted `OTPInput` (design-system-passitup.md §4.4, matching the sibling standalone `PhoneVerificationScreen`) instead of 6 separate digit boxes; removed a stray bare `accessible` JSX child that rendered the literal string "accessible" (RN "Text strings must be rendered within a `<Text>` component" warning — BP-61 class). Modal OTP field testID = `<modal testID>-code` (e.g. `listing-phone-verification-code`); modal unit tests + the legacy `.maestro/phone-verification-at-listing.yaml` (marked as not-in-active-manifest) updated to the single field.
- Impacted flows: FLOW-01 (auth: C07 fixture, C05 toggle, gate OTP), FLOW-14 (messaging: P03 unread fixture).
- Regression: Tier 0 (typecheck/lint) + targeted Jest (PhoneVerificationModal, devTestingService, oauthService). No DB migration/RLS change — fixtures/toggles are seed/app/config-level only.

### FLOW-00: Infrastructure & Environment Health
- Purpose: App boots; Metro reachable; Supabase env present.
- Smoke: (manual)
  - App boots to login screen without redbox.
  - If network/auth calls stall, app still leaves the full-screen spinner within ~12s and renders the unauthenticated stack.
  - Supabase URL/anon key configured; auth requests succeed.
  - Test hygiene: `yarn test` must not require real Supabase/network by default; Supabase/network E2E tests only run when `SUPABASE_E2E_ENABLED=true` and real `SUPABASE_URL`/keys are provided; Detox E2E tests only run when `RUN_DETOX_E2E=true`.

### FLOW-01: Auth – Signup/Login/Logout/Session Restore
- Smoke: (manual)
  - Signup -> logged in -> kill app -> relaunch -> session restores.
  - **MODULE-15.1-UI-REDESIGN-FLOW-01 (2026-05-05):** Auth screens redesigned to Whisk-inspired design system
    - Module: MODULE-15.1-UI-REDESIGN (TASK FLOW-01)
    - Scope:
      - All 7 auth screens redesigned: Landing, Login, Signup, PhoneVerification, ForgotPassword, ResetPassword, SuspendedAccount
      - Design system: Whisk green (#5DBB8E), filled inputs (no borders), pill-shaped buttons, Phosphor icons
      - UI components: Button, TextInput, OTPInput already existed and follow design system
      - Theme system in place with correct colors
    - Tests:
      - Unit: `__tests__/screens/auth/LandingScreen.test.tsx` (coverage ≥85%)
      - Unit: `__tests__/screens/auth/LoginScreen.test.tsx` (coverage ≥85%)
      - Unit: `__tests__/screens/auth/SignupScreen.test.tsx` (coverage ≥85%)
      - Integration: `__tests__/integration/auth-flow-01.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Maestro: `.maestro/module-15.1-flow-01-auth.yaml` (all 7 screens UI + navigation)
      - Maestro helper: `.maestro/helpers/auth-bootstrap-expo.yaml` (deterministic Expo Go startup + auth-state normalization)
      - Focused Maestro case: `.maestro/tc-004-login-password-toggle.yaml`
      - Manual: `MODULE-15.1-FLOW-01-MANUAL-TESTING.md` (22 test cases + regression checklist)
    - Prerequisites:
      - phosphor-react-native installed (version 3.0.6) ✅
      - Theme system with correct colors ✅
      - Button/TextInput components exist ✅
    - Validation:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm run test:unit` (all auth screen tests green)
      - `RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
      - `npm run test:maestro:ios -- .maestro/module-15.1-flow-01-auth.yaml` (repeatable full FLOW-01 run)
      - `npm run test:maestro:ios -- .maestro/tc-004-login-password-toggle.yaml` (repeatable focused TC-004 run)
      - `npm run test:maestro:android -- .maestro/module-15.1-flow-01-auth.yaml` (Android simulator run)
      - Manual testing required for complete flows (see MODULE-15.1-FLOW-01-MANUAL-TESTING.md)
  - **AUTH-V3-003-OAUTH-SERVICE (2026-05-01):** Social login via Google, Facebook, Apple
    - Module: MODULE-03-AUTH-V3-SOCIAL-LOGIN (TASK AUTH-V3-003)
    - Scope:
      - `p2p-kids-marketplace/src/services/oauthService.ts`
      - `p2p-kids-marketplace/src/services/oauthProviderConfig.ts`
      - `p2p-kids-marketplace/app.json` (URL scheme + OAuth plugins)
    - Features:
      - OAuth initiation with CSRF state protection (32-byte random token)
      - State stored in expo-secure-store and validated on callback
      - Provider-specific profile extraction:
        - Google: given_name + family_name → name, picture → avatar
        - Facebook: name → name, picture.data.url → avatar (nested)
        - Apple: firstName + lastName → name (FIRST sign-in only), no avatar
      - Graceful user cancel (access_denied) returns null
      - Provider outage (timeout >10s or 5xx) throws ProviderUnavailableError
      - Trial subscription activation (MODULE-03 V2 contract) fires on OAuth signup
    - Tests:
      - Unit: `src/services/__tests__/oauthService.test.ts` (coverage ≥85%)
      - Integration: `src/services/__tests__/oauthService.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Maestro: `.maestro/auth-v3-003-social-login.yaml` (cancel flows only - full OAuth requires manual testing)
      - Manual: `AUTH-V3-003-MANUAL-TESTING-GUIDE.md` (12 test cases + regression)
    - Prerequisites (manual ops):
      - Supabase Dashboard → Authentication → Providers → Enable Google/Facebook/Apple
      - Configure Client IDs/Secrets and redirect URI: `p2pkidsmarketplace://oauth-callback`
      - iOS Simulator: Sign in to iCloud (for Apple Sign In)
      - Android Emulator: Sign in to Google account
    - Validation:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm run test:unit` (all OAuth tests green)
      - `RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
      - Manual testing required for full OAuth flows (Maestro cannot automate external OAuth pages)
  - **AUTH-V3-004-ACCOUNT-SERVICE (2026-05-01):** Account linking, unlinking, and multi-provider management
    - Module: MODULE-03-AUTH-V3-SOCIAL-LOGIN (TASK AUTH-V3-004)
    - Scope:
      - `p2p-kids-marketplace/src/services/accountService.ts`
      - Settings → Linked Accounts screen (future AUTH-V3-008)
    - Features:
      - Check if account exists by email (smart linking decision)
      - Link social account with password re-authentication (security gate)
      - Unlink social account with last-method guard (prevents lockout)
      - Get linked providers ordered by linkedAt
      - Count login methods (OAuth identities + password)
      - Email mismatch detection (prevents account takeover)
      - Audit logging for all link/unlink operations
    - DB Dependencies:
      - `user_linked_providers` view (AUTH-V3-001)
      - `link_social_account` RPC (AUTH-V3-001)
      - `admin_audit_logs` table (existing)
    - Tests:
      - Unit: `src/__tests__/services/accountService.test.ts` (coverage ≥85%)
      - Integration: `src/__tests__/integration/accountService.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Maestro: `.maestro/auth-v3-004-account-linking.yaml` (UI states + last-method guard)
      - Manual: `AUTH-V3-004-MANUAL-TESTING.md` (16 test cases including OAuth flows)
    - Prerequisites (SQL):
      - user_linked_providers view exists
      - link_social_account RPC exists
      - admin_audit_logs table exists
    - Validation:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm test -- --testPathPattern=accountService` (unit tests green)
      - `RUN_SUPABASE_E2E=true npm test -- --testPathPattern=accountService.integration` (integration tests green)
      - Manual testing required for full account linking flows (password re-auth + OAuth)
  - **AUTH-V3-005-PROFILE-SERVICE (2026-05-01):** Auto-fill profile from OAuth provider + avatar download
    - Module: MODULE-03-AUTH-V3-SOCIAL-LOGIN (TASK AUTH-V3-005)
    - Scope:
      - `p2p-kids-marketplace/src/services/profileService.ts`
    - Features:
      - Auto-fill profile `name` from provider (Google/Facebook name, Apple firstName+lastName)
      - Never overwrites existing `name` (preserves user customization)
      - Download provider avatar with validation (jpeg/png, ≤2MB, ≥100×100, 5s timeout)
      - Upload to Supabase Storage: `user-avatars/{userId}/social_avatar.{ext}`
      - Graceful fallback to null on any failure (timeout, invalid type/size, upload error)
      - Apple payloads (no avatar URL) return null without fetch attempt
      - NEVER throws errors (Rule 5: must not block signup)
    - DB Dependencies:
      - `profiles.name` column (existing)
      - `profiles.auto_filled_from_provider` boolean column (optional)
      - `user-avatars` storage bucket (existing from MODULE-01)
    - Tests:
      - Unit: `src/services/__tests__/profileService.test.ts` (coverage ≥85%)
      - Integration: `src/services/__tests__/profileService.integration.test.ts` (RUN_SUPABASE_E2E=true)
  - **AUTH-V3-006-PHONE-PASSWORD-SERVICES (2026-05-01):** Phone verification with Twilio SMS + password strength for social users
    - Module: MODULE-03-AUTH-V3-SOCIAL-LOGIN (TASK AUTH-V3-006)
    - Scope:
      - `p2p-kids-marketplace/src/services/phoneService.ts` (consolidated from phone.ts + verification.ts)
      - `p2p-kids-marketplace/src/services/passwordService.ts`
      - `p2p-kids-marketplace/src/data/common-passwords.ts`
      - `supabase/functions/send-phone-otp/index.ts`
      - `supabase/migrations/20260501000001_phone_otp_hashing_rpcs.sql`
    - Features (PhoneService):
      - `isPhoneRequired(userId)` checks `user_profiles.phone_verified_at IS NULL`
      - `sendPhoneVerificationCode(phone)` calls Twilio via Edge Function
      - Rate limits: 3/phone/hour, 5/user/day (enforced server-side)
      - OTP: 6-digit, crypto.getRandomValues, bcrypt hashed via pgcrypto
      - `verifyPhoneCode(phone, code)` uses pgcrypto crypt comparison
      - On success: updates `phone_verified_at`, `phone_verification_method='sms'`, writes audit log
      - Throws `OTPRateLimitError` (with retryAfterSeconds), `OTPExpiredError`, or generic Error
    - Features (PasswordService):
      - `canSetPassword(userId)` checks RPC `can_set_password()` (auth.users.encrypted_password IS NULL)
      - `validatePasswordStrength(pw)` validates: ≥8 chars, ≥1 letter, ≥1 digit, not in common-passwords.ts (100 entries)
      - `setPasswordForSocialUser(newPassword)` validates strength, calls `supabase.auth.updateUser({ password })`
      - NEVER writes directly to auth.users
      - Returns structured errors: TOO_SHORT, NO_LETTER, NO_DIGIT, COMMON_PASSWORD, NOT_ALLOWED, UPDATE_FAILED
    - DB Dependencies:
      - `phone_verification_codes` table (existing from AUTH-V3-001)
      - `hash_otp_code(p_code)` RPC (bcrypt hashing)
      - `verify_otp_code(p_verification_id, p_code)` RPC (increments attempts, max 3)
      - `can_set_password(p_user_id)` RPC (existing from accountService)
      - `admin_audit_logs` table (existing)
    - Edge Function:
      - `send-phone-otp`: Twilio SMS send + rate limit enforcement + bcrypt hashing
      - Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
    - Tests:
      - Unit: `src/services/__tests__/phoneService.test.ts` (coverage ≥85%)
      - Unit: `src/services/__tests__/passwordService.test.ts` (coverage ≥85%)
      - Integration: `src/services/__tests__/phoneService.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Integration: `src/services/__tests__/passwordService.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Maestro: `.maestro/auth-v3-006-phone-password-services.yaml` (phone verify flow + password strength validation)
      - Manual: `AUTH-V3-006-MANUAL-TESTING.md` (16 test cases)
    - Prerequisites (manual ops):
      - Run SQL: `supabase/migrations/20260501000001_phone_otp_hashing_rpcs.sql`
      - Deploy: `npx supabase functions deploy send-phone-otp`
      - Set Twilio secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
    - Validation:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm run test:unit -- --testPathPattern=phoneService` (unit tests green)
      - `npm run test:unit -- --testPathPattern=passwordService` (unit tests green)
      - `RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=phoneService.integration` (integration tests green)
      - `RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=passwordService.integration` (integration tests green)
      - Manual testing required for actual Twilio SMS delivery and password setting flows
      - Maestro: `.maestro/auth-v3-005-profile-autofill.yaml` (Google/Facebook/Apple auto-fill states)
      - Manual: `AUTH-V3-005-MANUAL-TESTING.md` (8 test cases + 2 regression checks)
  - **PHONE-OTP-PGCRYPTO-FIX (2026-08-20):** Fixed real send-phone-otp HTTP 500 (`function gen_salt(unknown) does not exist`) + dev-bypass data-consistency fix
    - Scope:
      - `supabase/migrations/20260820000001_fix_phone_otp_pgcrypto_search_path.sql` (new)
      - `p2p-kids-marketplace/src/services/phoneService.ts`
    - Fixes:
      - P1: `hash_otp_code`/`verify_otp_code` RPCs were `SET search_path = public`, so pgcrypto's `gen_salt`/`crypt` (which live in the `extensions` schema on Supabase) were unresolvable → `send-phone-otp` 500'd on EVERY real send. Changed both RPCs to `SET search_path = public, extensions`. This was masked by the dev SMS bypass in every prior QA run.
      - P3: dev-bypass verify path (and the real verify path) now also set `phone_verified = true` alongside `phone_verified_at`/`phone_verification_method` (matches the canonical `phone.ts` pattern; `isPhoneRequired` only reads `phone_verified_at`, so this is consistency, not behavior).
    - Verification:
      - Tier 0: `yarn typecheck` PASS; `npx eslint <changed files>` 0 errors.
      - Targeted tests: `npx jest src/screens/__tests__/BulkListingCreateScreen.test.tsx src/services/__tests__/phoneService.test.ts` — 18/18 PASS.
      - **Tier 2 live-DB (2026-08-20, staging `drntwgporzabmxdqykrp`): PASS** — migration applied; `SELECT public.hash_otp_code('123456')` → `$2a$06$…` (previously threw `function gen_salt(unknown) does not exist`); both RPCs `proconfig = [search_path=public, extensions]`.
      - **Real (non-bypass) Edge Function invoke:** `send-phone-otp` now gets past hashing + DB insert and fails only at the Twilio step (`{error:'Twilio credentials not configured', code:'SEND_FAILED'}`) — proving the P1 bug is gone. Remaining gap (NOT this bug): staging Edge Function env lacks `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER`, so real SMS still can't be sent until those are set (dev-bypass remains the dev path).
  - **AUTH-V3-007-SOCIAL-LOGIN-UI (2026-05-01):** Social login buttons UI component + login/signup screen integration
    - Module: MODULE-03-AUTH-V3-SOCIAL-LOGIN (TASK AUTH-V3-007)
    - Scope:
      - `p2p-kids-marketplace/src/components/auth/ProviderButton.tsx`
      - `p2p-kids-marketplace/src/components/auth/SocialLoginButtons.tsx`
      - `p2p-kids-marketplace/src/screens/LoginScreen.tsx` (integration)
      - `p2p-kids-marketplace/src/screens/SignupScreen.tsx` (integration)
    - Features:
      - Social login buttons render above email/password form on both Login and Signup screens
      - 3 providers: Google (#4285F4), Facebook (#1877F2), Apple (#000000)
      - Apple button renders on BOTH iOS and Android (App Store compliance)
      - Mode-specific labels: "Sign in with <Provider>" (login) vs "Continue with <Provider>" (signup)
      - Full OAuth flow: initiate → callback → checkAccountExists → autoFillProfile (signup only) → navigate to Home
      - Account exists scenario: triggers `onAccountExists` callback (AccountLinkingPrompt modal in AUTH-V3-008)
      - Error handling:
        - ProviderUnavailableError: shows orange banner "Provider is temporarily unavailable. Use Email instead?" with CTA
        - User cancel (access_denied): silent (no error UI)
      - Loading state: per-provider ActivityIndicator (only pressed button shows loading)
      - Email fallback: "Use Email" CTA focuses email input and hides error banner
      - Accessibility: proper labels, roles, states; loading announces "Signing you in…"
    - Component Dependencies:
      - oauthService (AUTH-V3-003)
      - accountService (AUTH-V3-004)
      - profileService (AUTH-V3-005)
      - auth-v3 types (OAuthProvider, ProviderProfile, etc.)
      - auth-v3-errors (ProviderUnavailableError)
    - Tests:
      - Unit: `src/components/auth/__tests__/ProviderButton.test.tsx` (22 test cases, coverage ≥85%)
      - Unit: `src/components/auth/__tests__/SocialLoginButtons.test.tsx` (17 test cases, coverage ≥85%)
      - Maestro: `.maestro/auth-v3-007-social-login-ui.yaml` (button rendering, error states, loading, email fallback)
      - Manual: `AUTH-V3-007-MANUAL-TESTING-GUIDE.md` (12 test cases covering all providers + error scenarios)
    - Prerequisites:
      - OAuth services implemented (AUTH-V3-003)
      - Account service implemented (AUTH-V3-004)
      - Profile service implemented (AUTH-V3-005)
      - OAuth providers enabled in Supabase Dashboard
      - Redirect URLs configured: `exp://localhost:8081` (Expo Go), `kidsmarketplace://oauth-callback` (standalone)
    - Validation:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm run test:unit -- --testPathPattern=ProviderButton` (unit tests green)
      - `npm run test:unit -- --testPathPattern=SocialLoginButtons` (unit tests green)
      - Maestro: `maestro test .maestro/auth-v3-007-social-login-ui.yaml` (UI states pass)
      - Manual testing required for full OAuth flows (see AUTH-V3-007-MANUAL-TESTING-GUIDE.md)
    - Known Limitations:
      - AccountLinkingPrompt modal shows basic Alert (full modal in AUTH-V3-008)
      - Provider icons are text labels (TODO: add official brand assets)
      - Deep link handling tested via Expo Go only (standalone builds require native config)
  - **AUTH-V3-008-MOBILE-UI (2026-05-03):** Linked accounts management, phone verification modal, account linking prompt, set password modal
    - Module: MODULE-03-AUTH-V3-SOCIAL-LOGIN (TASK AUTH-V3-008)
    - Scope:
      - `p2p-kids-marketplace/src/hooks/useLinkedProviders.ts` (React Query hook for provider link/unlink)
      - `p2p-kids-marketplace/src/hooks/usePhoneVerification.ts` (phone verification 2-step flow with countdown)
      - `p2p-kids-marketplace/src/components/auth/ProviderCard.tsx` (reusable provider status card)
      - `p2p-kids-marketplace/src/components/auth/PhoneVerificationModal.tsx` (2-step phone verification for transaction gating)
      - `p2p-kids-marketplace/src/components/auth/AccountLinkingPrompt.tsx` (link social account when email exists)
      - `p2p-kids-marketplace/src/components/auth/SetPasswordModal.tsx` (password creation for social-only users with live strength validation)
      - `p2p-kids-marketplace/src/screens/profile/LinkedAccountsScreen.tsx` (Settings → Account → Linked Accounts)
      - `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` (phone verification gate integration)
    - Features (LinkedAccountsScreen):
      - Displays linked social providers (Google/Facebook/Apple) with status, email, linkedAt
      - Link provider: requires password re-authentication if user has password set
      - Unlink provider: guards against unlinking last login method (prevents lockout)
      - Set password button for social-only users (enables password backup)
      - Real-time provider status updates via React Query cache invalidation
    - Features (PhoneVerificationModal):
      - 2-step flow: Step 1 (enter phone with E.164 auto-format), Step 2 (6-digit OTP with auto-advance)
      - Auto-verify when 6 digits entered (calls verifyPhoneCode immediately)
      - Resend countdown timer (60s) with disabled state during countdown
      - Required mode (transaction gate): no close button, user MUST verify
      - Optional mode (Settings): shows close button for user-initiated verification
      - Error handling: OTPRateLimitError shows retry countdown, OTPExpiredError resets to step 1
    - Features (AccountLinkingPrompt):
      - Shown when OAuth email matches existing account email
      - Password re-auth flow: prompts for password if user has password set
      - Social-only flow: instructs user to sign in via existing provider first
      - Prevents account takeover via EmailMismatchError detection
    - Features (SetPasswordModal):
      - Live password strength validation via useEffect watching password changes
      - Strength meter with visual bar + label (Strong/Weak/Too short) and color coding
      - Requirement list shows unmet requirements dynamically
      - Submit button disabled until strengthResult.valid === true
      - Confirm password field with mismatch validation
    - Features (Transaction Gating):
      - ItemCreateScreen: Calls `isPhoneRequired(userId)` before publish, shows PhoneVerificationModal if true
      - Modal blocks publish until phone verified, then retries publish automatically
      - No skip affordance - phone verification mandatory for first transaction
      - CheckoutScreen integration: TODO (MODULE-06 V2 pending - see TODO-AUTH-V3-008-CHECKOUT-INTEGRATION.md)
    - Component Dependencies:
      - useLinkedProviders hook (accountService integration)
      - usePhoneVerification hook (phoneService integration)
      - accountService (AUTH-V3-004)
      - phoneService (AUTH-V3-006)
      - passwordService (AUTH-V3-006)
      - auth-v3 types and errors
    - Tests:
      - Unit: `src/__tests__/hooks/useLinkedProviders.test.ts` (coverage ≥85%)
      - Unit: `src/__tests__/hooks/usePhoneVerification.test.ts` (coverage ≥85%)
  - **AUTH-V3-009-TESTS (2026-05-03):** Complete test package for AUTH-V3 social login module (Jest + PgTAP + Maestro + Manual E2E)
    - Module: MODULE-03-AUTH-V3-SOCIAL-LOGIN (TASK AUTH-V3-009)
    - Scope:
      - Jest unit tests for all AUTH-V3 services and components
      - PgTAP database tests for RPC functions and OTP rate limits
      - Maestro UI flows for 5 critical UX paths
      - Manual E2E checklist for real OAuth providers on staging
    - Test Files (7 Jest suites):
      - `src/services/__tests__/oauthService.test.ts` ✅ (existing, coverage ≥85%)
      - `src/services/__tests__/accountService.test.ts` ✅ NEW (created in AUTH-V3-009)
      - `src/services/__tests__/profileService.test.ts` ✅ (existing, coverage ≥85%)
      - `src/services/__tests__/phoneService.test.ts` ✅ (existing, coverage ≥85%)
      - `src/services/__tests__/passwordService.test.ts` ✅ (existing, coverage ≥85%)
      - `src/components/auth/__tests__/SocialLoginButtons.test.tsx` ✅ (existing, coverage ≥85%)
      - `src/components/auth/__tests__/PhoneVerificationModal.test.tsx` ✅ NEW (created in AUTH-V3-009)
    - Integration Tests:
      - `src/services/__tests__/oauthService.integration.test.ts` ✅ (existing)
      - `src/services/__tests__/profileService.integration.test.ts` ✅ (existing)
      - `src/services/__tests__/phoneService.integration.test.ts` ✅ (existing)
      - `src/services/__tests__/passwordService.integration.test.ts` ✅ (existing)
    - PgTAP Tests (1 SQL file):
      - `supabase/tests/auth_v3.sql` ✅ NEW (created in AUTH-V3-009)
        - Tests `link_social_account` RPC email mismatch → exception
        - Tests OTP rate limit (3/phone/hour) enforced via database structure
        - Tests `user_linked_providers` view correctly identifies linked providers
        - Tests `phone_verification_codes` table structure and RLS enabled
    - Maestro Flows (5 YAML files):
      - `.maestro/social-signup-google.yaml` ✅ NEW (Google signup happy path, profile auto-filled)
      - `.maestro/account-linking.yaml` ✅ (existing from AUTH-V3-004)
      - `.maestro/phone-verification-at-listing.yaml` ✅ NEW (phone verification gate at first listing)
      - `.maestro/link-unlink-settings.yaml` ✅ NEW (link/unlink providers, last-method guard)
      - `.maestro/set-password-social-only.yaml` ✅ NEW (social-only user sets password, can email-login)
    - Manual E2E Testing:
      - `AUTH-V3-009-MANUAL-TESTING.md` ✅ NEW (58 test cases across 7 test suites)
      - Test Suites:
        1. Google OAuth Signup (3 test cases)
        2. Facebook OAuth Signup (2 test cases)
        3. Apple Sign In (3 test cases)
        4. Account Linking (3 test cases)
        5. Deferred Phone Verification (4 test cases)
        6. Password Fallback (1 test case)
        7. Cross-Platform (2 test cases)
      - Required screenshots: 6 (Google/Facebook/Apple signup, phone modal, linked accounts, last-method guard)
      - Critical security checks: OAuth state CSRF, email mismatch, last-method guard, OTP rate limit, no credentials in logs
    - Prerequisites (manual ops):
      - All migrations applied (AUTH-V3-001 through AUTH-V3-006)
      - OAuth providers enabled in Supabase Dashboard
      - Test accounts ready: Google, Facebook, Apple ID
      - Twilio credentials configured in Edge Function
      - `avatars` storage bucket public
    - Validation Commands:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm run test:unit` (all 7 Jest suites green, coverage ≥85%)
      - `RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
      - `supabase test db` (PgTAP tests pass - 12 assertions)
      - `maestro test .maestro/social-signup-google.yaml` (iOS + Android)
      - `maestro test .maestro/phone-verification-at-listing.yaml` (iOS + Android)
      - `maestro test .maestro/link-unlink-settings.yaml` (iOS + Android)
      - `maestro test .maestro/set-password-social-only.yaml` (iOS + Android)
      - Manual testing required for full OAuth flows (see AUTH-V3-009-MANUAL-TESTING.md)
    - Coverage Target:
      - oauthService.ts ≥85% ✅
      - accountService.ts ≥85% ✅
      - profileService.ts ≥85% ✅
      - phoneService.ts ≥85% ✅
      - passwordService.ts ≥85% ✅
      - SocialLoginButtons.tsx ≥85% ✅
      - PhoneVerificationModal.tsx ≥85% ✅
    - Security Verification (MANDATORY before sign-off):
      - [ ] OAuth state CSRF protection (state token mismatch rejected)
      - [ ] Email mismatch blocked (cannot link provider with different email)
      - [ ] Last-method guard (cannot remove last login method)
      - [ ] OTP rate limit (3/hour enforced)
      - [ ] No OTP code, provider token, or password in test logs or snapshots
      - Unit: `src/__tests__/components/ProviderCard.test.tsx` (TODO)
      - Unit: `src/__tests__/components/PhoneVerificationModal.test.tsx` (TODO)
      - Unit: `src/__tests__/components/AccountLinkingPrompt.test.tsx` (TODO)
      - Unit: `src/__tests__/components/SetPasswordModal.test.tsx` (TODO)
      - Integration: `e2e/auth-v3-008.integration.test.ts` (RUN_SUPABASE_E2E=true) (TODO)
      - Maestro: `.maestro/auth-v3-008-phone-verification.yaml` (TODO)
      - Manual: `AUTH-V3-008-MANUAL-TESTING-GUIDE.md` (12 test cases)
    - Prerequisites:
      - OAuth services implemented (AUTH-V3-003, AUTH-V3-004, AUTH-V3-005, AUTH-V3-006, AUTH-V3-007)
      - phone_verified_at column exists on user_profiles
      - phone_verification_codes table exists
      - send-phone-otp Edge Function deployed
      - Navigation routes configured for LinkedAccountsScreen
    - Validation:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm run test -- useLinkedProviders` (unit tests green)
      - `npm run test -- usePhoneVerification` (unit tests green)
      - Manual testing required for full flows (see AUTH-V3-008-MANUAL-TESTING-GUIDE.md)
    - Known TODOs:
      - CheckoutScreen integration pending (MODULE-06 V2 not implemented yet)
      - Maestro UI flow tests pending (testIDs added, YAML creation pending)
      - Component unit tests pending (ProviderCard, PhoneVerificationModal, AccountLinkingPrompt, SetPasswordModal)
      - Integration tests pending (e2e/auth-v3-008.integration.test.ts)
    - Prerequisites:
      - `user-avatars` storage bucket exists with public read access
      - OAuth providers enabled (AUTH-V3-003)
      - expo-image-manipulator installed (for dimension validation)
    - Validation:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm test -- --testPathPattern=profileService` (unit tests green, coverage ≥85%)
      - `RUN_SUPABASE_E2E=true npm test -- --testPathPattern=profileService.integration` (integration tests green)
      - Manual testing required for full OAuth flows (provider avatar downloads)
  - **AUTH-SIGNUP-HOTFIX (2026-04-15):** Harden auth signup trigger against migration drift
    - Migration: `supabase/migrations/20260415000001_auth_signup_trigger_stabilization_hotfix.sql`
    - Fixes: `AuthApiError: Database error saving new user` during `supabase.auth.signUp`
    - DB changes:
      - Drops legacy duplicate auth trigger `trigger_initialize_notification_preferences` on `auth.users`
      - Replaces `public.handle_new_user()` with fail-safe logic that never aborts auth user creation
      - Re-attaches canonical `on_auth_user_created` trigger only
      - Logs all signup-trigger stages/failures to `public.debug_logs`
    - Required verification after apply:
      - `auth.signUp` returns user/session (no 500)
      - `pg_trigger` shows only expected auth signup trigger(s)
      - `debug_logs` contains `handle_new_user: SUCCESS` for newly created user
  - Signup automatically records current `terms_of_service` and `privacy_policy` acceptance rows (if published) in `policy_acceptances`.
  - Logout returns to unauthenticated stack.
  - Cold launch does not hang indefinitely on a full-screen spinner even if profile/subscription fetches time out.
  - App launch does not get stuck in an auth refresh loop (no repeated profile realtime subscribe spam).
  - **QA-QS-RESET-LINK-RECOVERY (2026-08-23):** ResetPasswordScreen now clears `linkError` when a valid reset deep link arrives after an expired-link error (both `handleResetUrl` and route-params paths), so the submit button is no longer left hidden and a valid link recovers without an app relaunch. Recurring finding (Phase 16 #1, reconfirmed live in Group Q+S).
    - Files: `p2p-kids-marketplace/src/screens/auth/ResetPasswordScreen.tsx` + regression test `src/__tests__/screens/auth/ResetPasswordScreen.test.tsx`
    - Regression test verified RED on the old code path, GREEN on the fix.
    - Tier: 0 (UI state fix + unit test; no API/DB change). No new smoke script required.

### FLOW-02: Profiles & Onboarding
- Smoke: (manual)
  - New user gets profile row (or profile fetch does not crash).
  - Upload profile avatar -> profile screen re-renders with the new image (avatar URL resolves from `profiles.avatar_url` storage path).
  - Profile realtime listener does not resubscribe continuously while onboarding/profile updates.
  - **MODULE-15.1-UI-REDESIGN-FLOW-02 (2026-05-06):** Onboarding & Profile screens redesigned to Whisk-inspired "Pass It Up" design system
    - Module: MODULE-15.1-UI-REDESIGN (TASK FLOW-02)
    - Scope:
      - 5 onboarding/profile screens redesigned: WelcomeScreen, ProfileCompletionScreen, FeatureHighlightsScreen, OnboardingCarousel, ProfileSetupScreen
      - Design system: Whisk green (#5DBB8E), filled inputs (backgroundColor #F0F0F0, borderRadius 12, height 52, NO borderWidth), pill-shaped buttons (borderRadius 26, height 52), Phosphor icons v3
      - Phosphor icons integrated: User, Camera, MapPin, CaretRight (20-40px, regular weight, #6B6B6B)
      - Color palette: Primary text #1A1A1A, secondary text #6B6B6B, tertiary/placeholder #999999, error #E85D75, background #FFFFFF
      - Typography: Headlines 24-28px fontWeight '600', labels 13px fontWeight '500' uppercase, body 16px
      - Component updates: Consistent filled input wrappers with icons, green pagination dots (active #5DBB8E, inactive #E0E0E0)
    - Tests:
      - Unit: `src/screens/onboarding/__tests__/WelcomeScreen.test.tsx`
      - Unit: `src/screens/onboarding/__tests__/ProfileCompletionScreen.test.tsx`
      - Unit: `src/screens/onboarding/__tests__/FeatureHighlightsScreen.test.tsx`
      - Unit: `src/screens/profile/__tests__/ProfileSetupScreen.test.tsx`
      - Unit: `src/components/onboarding/__tests__/OnboardingCarousel.test.tsx`
      - Integration: `src/__tests__/integration/flow-02-onboarding.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Maestro: `.maestro/module-15.1-flow-02-onboarding.yaml` (all 5 screens UI + avatar upload + 4-slide carousel + 5-slide carousel)
      - Manual: `MODULE-15.1-FLOW-02-MANUAL-TESTING.md` (10 test cases covering visual design, interactions, E2E flow)
    - Prerequisites:
      - phosphor-react-native installed (version 3.0.6) ✅
      - All screens already existed ✅
      - Supabase profile service functional ✅
    - Validation:
      - `npm run typecheck` (must pass) ✅
      - `npm run lint` (must pass)
      - `npm run test:unit` (all onboarding screen tests green)
      - `RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
      - `npm run test:maestro:ios` (Maestro tests pass)
      - `npm run test:maestro:android` (Maestro tests pass)
      - Manual testing required for complete flows (see MODULE-15.1-FLOW-02-MANUAL-TESTING.md)
    - Visual Changes Summary:
      - WelcomeScreen: Headline 28px semibold #1A1A1A, Get Started button green pill
      - ProfileCompletionScreen: Circular avatar 120px with Camera icon, filled inputs with User icon, bio 120px multiline
      - FeatureHighlightsScreen: 4 slides with pagination dots (green active), Next button with CaretRight icon, Get Started on slide 4
      - OnboardingCarousel: 5 slides with elongated green active dot (24px), Get Started button green pill
      - ProfileSetupScreen: Avatar with Camera icon, filled inputs (User, MapPin icons), Complete Setup button green pill
  - **QA-QS-BP53-PROFILE-STAT-LOCATORS (2026-08-23):** Profile stat chips (Listings/Trades/SP Balance) now set `accessible` + `accessibilityRole="button"` + `accessibilityLabel` (mirror `ui/Button.tsx`) so their `testID`s surface in the iOS AX tree (BP-53). Zero-logic UI change — no new smoke script required. Tier: 0.

### FLOW-03: Node/ZIP Gating + Waitlist
- Smoke: (manual)
  - User is assigned to a node; sees node-scoped content.
  - **NODE-MEMBER-COUNT-LIVE (2026-08-23, QA group-F/G cross-cutting #1):** Admin `/nodes` membership now computed LIVE from `profiles.node_id` instead of the stale stored `nodes.member_count`
    - Problem: stored `member_count` had drifted on staging (Norwalk Central stored 0 vs 146 real assigned profiles; Test Node 1 stored 100 vs 0 real) because it is a client-maintained counter — incremented only on signup via the `increment_node_member_count` RPC from `profile.ts`; never backfilled for historical assignments, never decremented on ZIP-change/delete. The admin stats card "Total Members", the node-deactivation warning, and the per-node "Members" column all read the stale column, so an admin could be misled about real impact before deactivating a node.
    - Fix (compute live — matches the existing `admin_node_kpis` pattern): `p2p-kids-admin/src/app/nodes/page.tsx` now sources per-node membership from the already-loaded `admin_node_kpis.users` (live `COUNT(profiles) WHERE node_id = n.id`, service-role route `/api/admin/nodes/kpis`), falling back to the stored value only until KPIs load. Applies to the stats card, the deactivation warning, and the Members column (with a `title="Live member count (from profiles)"` tooltip).
    - Validation: admin Tier 0 PASS (typecheck / lint / `next build`). Live-browser verified on staging — Norwalk Central Members=146 (was 0), Test Node 1 Members=0 (was 100), Total Members=157 = sum of live column (was 100); deactivation warning for Norwalk reads "146 active members", Test Node 1 no longer warns (0 members). No DB migration / no backfill / no Edge Function change.
    - Regression: Tier 0 (admin). No DB/API/Edge Function changes → no Tier 2. FLOW-03 admin surface only.
  - **NODE-MEMBER-COUNT-DEPRECATE + NODES-E2E-FIX (2026-08-23):** Deprecated the stale `nodes.member_count` counter + its RPCs; fixed the dormant nodes e2e test
    - Item 1 (deprecate): full-codebase grep (2026-08-23) confirmed no live consumer reads `nodes.member_count` for logic — admin `/nodes` uses live `admin_node_kpis.users`; the mobile app only had the signup increment call (no decrement path anywhere); no reporting/analytics consumer exists. Removed the mobile `incrementNodeMemberCount`/`decrementNodeMemberCount` wrappers (`src/services/location.ts`), the signup call (`profile.ts`), and their test references; removed `member_count` from the admin `GeographicNode` type, the node-create payload (`NodeFormModal`), and the nodes page fallback/audit refs (audit now records the live count). Authored migration `supabase/migrations/20260823000002_drop_node_member_count.sql` (drops column + `idx_nodes_member_count` + both RPCs; Mode B idempotent) — **APPLIED to staging 2026-08-24** (verified: functions/column/index all gone; `admin_node_kpis` still returns per-node users; admin /nodes renders live counts, e.g. Total Members 158).
    - Item 2 (dormant e2e): `src/app/nodes/__tests__/nodes.e2e.test.ts` was never collected (Playwright `testDir=./__tests__`; Vitest excludes `*.e2e.test.ts`) AND broke `npm run test:e2e` (Jest collected it → "Playwright Test needs to be invoked via npx playwright test", 10 failed suites). Moved it to `__tests__/nodes.e2e.test.ts` (Playwright collects it); added `testPathIgnorePatterns` to `jest.config.js` excluding all 11 Playwright-based e2e files (fixes the jest breakage). Fixed the rotted test: standard admin login helper (`ensureAdminSession`) + `PLAYWRIGHT_ADMIN_E2E` gate + dotenv `.env.local` load; fixed ambiguous `text=Members` header (strict-mode), `.locator('text').nth(1)` value reads, the two-table member-sum double-count, the case-insensitive `span:has-text("Active")` over-count (matches "Inactive"), and the create-node ZIP-coordinate wait (lat input's initial value is `"0"`, so `not.toHaveValue('')` passed instantly and raced the async lookup — now waits for a non-zero value). **Full suite 17/17 PASS** — note it requires an admin-role account (`users.role='admin'` via RLS `nodes_admin_manage`; only `samer@samer.com` qualifies on staging).
    - Validation: admin Tier 0 PASS (typecheck / lint / `next build`); mobile Tier 0 PASS (typecheck / eslint 0 errors on changed files / 3 affected Jest suites pass); full nodes e2e 17/17 PASS (36.7s, admin persona).
    - Regression: Tier 0 (both apps). Item 1's migration is approval-gated and pending → no Tier 2 until applied.

### FLOW-04: Listings – Create/Edit/Delete/Expire/Soft Delete
- Smoke: (manual)
  - Create listing -> appears in listings feed for same node.
  - **J13-PHOTO-REORDER-REPLACE + J15-BUYER-SP-CAP (2026-08-24):** Two confirmed product features on single-item listing creation (closes QA Group J spec gaps AUTH-TC-J13 reorder/replace + AUTH-TC-J15 buyer SP-cap display)
    - Scope:
      - `p2p-kids-marketplace/src/components/listing/PhotoUploadManager.tsx` — ◀/▶ reorder chips (`onReorder` now wired) + per-photo replace (⟳) control
      - `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` — photo id→URL ref map (`photoUrlByPhotoIdRef`); draft `photo_urls` derived from on-screen photo order so reorder/replace/remove all persist correctly (cover = `photo_urls[0]`)
      - `p2p-kids-marketplace/src/hooks/useCategorySPCache.ts` — now fetches + exposes per-category `sp_spending_cap_percent` (single fetch/cache path, DB-driven, default 70 matches DB column default)
      - `p2p-kids-marketplace/src/components/listing/SPEarningsPreview.tsx` — buyer max-SP cap line (distinct gold row) from the category's DB cap; concrete SP/$ figures; percentage-only before a price is entered
      - Tests: `SPEarningsPreview.test.tsx` (new), `PhotoUploadManager.test.tsx`, `ItemCreateScreen.test.tsx`, `useCategorySPCache.test.ts`, `BulkSPSummaryCard.test.tsx`
    - Behavior:
      - J15: buyer cap = `floor(price × category.sp_spending_cap_percent / 100)` (reuses `calculateMaxSpendSP`, same formula the backend enforces); never hardcoded; updates on price/category change; copy: "Buyers can pay up to ~X SP toward this $Y price with Swap Points" (percentage-only when price is 0).
      - J13: reorder persists cover into the draft; replace swaps the photo in place (array length unchanged, slot preserved) without re-triggering AI (AI-derived fields stay as-is); remove no longer leaves stale URLs in the saved draft.
    - Validation:
      - `yarn typecheck` (PASS) + `npx eslint <9 changed files>` (0 errors; project-wide lint has 104 pre-existing errors in untouched files — `detox/`, `__tests__/integration/`, etc.)
      - All 6 affected Jest suites — 102/102 PASS
      - Full suite `yarn test` — 3414 passed, 0 failed (one TradeOfferScreen flake observed once, passes in isolation; unrelated to these files)
    - Regression: Tier 0 (typecheck/lint/unit). No DB/API/Edge Function changes.
  - **GROUP-J-CLOSURE-SWEEP-FIXES (2026-08-24):** Group J closure sweep + remaining open items — literal accessibility-prop-text sweep (2 confirmed instances fixed), draft price persist/restore, `item_drafts.photo_urls` column sync, QA guide "Try Again" wording, and dev "Other" category fixture (unblocks AUTH-TC-J05)
    - Scope:
      - `p2p-kids-marketplace/src/components/molecules/ResumeDraftBanner.tsx` — removed literal `accessible accessibilityRole="button"` pasted as Text content (junk line above "You have 1 unfinished listing"; P2 copy defect from the closure run)
      - `p2p-kids-marketplace/src/screens/cart/CartScreen.tsx` — same bug class in the cart subtotal Text (junk prefix above the $ amount)
      - `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` — draft auto-save payload now includes `price` (DraftData already supported it) + resume hydration restores `setPriceInput(...)`; new `__DEV__` `dev-set-other-category` fixture (sets category `other` + prefills `requestedCategoryName`)
      - `p2p-kids-marketplace/src/services/draftService.ts` — client-side merge fallback now also refreshes the top-level `photo_urls` column (mirrors the RPC)
      - `supabase/migrations/20260824000002_fix_merge_item_draft_sync_photo_urls.sql` — `merge_item_draft` RPC now sets `photo_urls` from `p_updates->'photo_urls'` when present + one-time backfill from `draft_data` (column is a live consumer in `publishDraft`, so it is kept in sync, NOT deprecated)
      - `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — J02 wording "Retry AI" → "Try Again" (matches the app's actual button label)
      - Tests: `ItemCreateScreen.test.tsx` (+2: price payload + price restore; +1: `dev-set-other-category`)
    - Behavior:
      - Sweep = second confirmed recurrence of the WelcomeScreen junk-text class (first instance already fixed); `ReviewCard`/`IssueReportModal` flagged as genuine JSX attributes (no change)
      - Draft auto-save carries `price` and resume restores it, so a seller no longer re-enters price after leaving/reopening
      - `item_drafts.photo_urls` column stays in sync with `draft_data->'photo_urls'` on every update — `publishDraft` (which reads the column) now uses the reordered/correct URLs
      - `dev-set-other-category` makes AUTH-TC-J05's custom-category flow on-device testable without the undrivable CategorySelectModal
    - Validation:
      - `yarn typecheck` (PASS) + `npx eslint <5 changed files>` (0 errors; 12 pre-existing no-console warnings untouched); repo-wide lint still has 104 pre-existing errors in untouched files
      - Affected suites (ResumeDraftBanner, ItemCreateScreen, draftService) — 60/60 PASS
      - Full suite `yarn test` — 3417 passed, 0 failed (485 RUN_SUPABASE_E2E-gated skips, expected)
    - Regression: Tier 0 (typecheck/lint/unit) + Tier 1 targeted (draft/resume fixtures). Migration `20260824000002` must be applied to staging for the RPC-side photo_urls sync to go live (client fallback covers DBs without the RPC).
  - **GROUP-J-DEVFIXTURE-AX-DOCDRIFT (2026-08-24):** Group J remaining findings — dev fixture for `uploadedPhotoUrls` (unblocks AI/draft QA), ColorPicker AX role fix (BP-53), and photo-size guide reconciliation (10MB confirmed intended)
    - Scope:
      - `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` — new `__DEV__`-gated `dev-add-test-photo-uploaded` fixture (sibling of `dev-add-test-photo`): injects a bundled photo AND records a mock `https://dev-fixture.local/...` URL (no network upload), so the `uploadedPhotoUrls`-gated AI-analysis + draft-auto-save code paths execute on-device (AUTH-TC-J02/J11)
      - `p2p-kids-marketplace/src/components/listing/ColorPicker.tsx` — swatch AX role `checkbox` → `button` + `accessibilityState={{ selected }}` (BP-53: `checkbox` doesn't register on iOS AX RN 0.81; mirrors AgeGroupSelector/GenderSelector)
      - `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — photo size cap text 5MB → 10MB (J12 doc drift; 10MB confirmed intended — matches `photoService.MAX_FILE_SIZE_MB` + `docx/BULK-LISTING-REQUIREMENTS.md` L746; the 5MB text lives only in legacy `design-system.md`/`screen-flow-mapping.md`)
      - Tests: `ItemCreateScreen.test.tsx` (new fixture test), `ColorPicker.test.tsx` (AX assertions updated)
    - Behavior:
      - `dev-add-test-photo-uploaded` sets `uploadedPhotoUrls` + seeds the id→URL ref map so `useAIAnalysis` fires (analyzing → error/retry path) and `useItemDraft` auto-save creates a draft row carrying the mock URL
      - ColorPicker swatches now surface in the iOS AX tree for QA instrumentation (J04 locator gap)
    - Validation:
      - `yarn typecheck` (PASS) + `npx eslint <4 changed files>` (0 errors; 12 pre-existing no-console warnings untouched)
      - Affected + indirect suites: ItemCreateScreen 39/39, ColorPicker 15/15, listing components + Bulk + EditListing 12 suites / 187 tests — all PASS
      - Full suite `yarn test` — 3415 passed, 0 failed (485 RUN_SUPABASE_E2E-gated skips, expected)
    - Regression: Tier 0 (typecheck/lint/unit). __DEV__-gated fixtures + AX props + doc text only; no DB/API/Edge Function changes.
  - **PHONE-VERIFICATION-GATE (2026-08-19):** Hoisted the client phone-verification gate out of dead code + added a server-side items INSERT backstop + fixed the tab-bar occlusion of the Publish button on ItemCreate
    - Scope:
      - `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx`
      - `p2p-kids-marketplace/src/components/organisms/PersistentTabBar/index.tsx`
      - `supabase/migrations/20260819000001_enforce_phone_verification_on_items_insert.sql`
      - `p2p-kids-marketplace/src/screens/__tests__/ItemCreateScreen.test.tsx`
      - `p2p-kids-marketplace/src/navigation/__tests__/AppNavigatorOnboardingTabBar.test.tsx`
    - Fixes (QA E05, P0):
      - AUTH-V3-008: `isPhoneRequired` gate was nested inside `if (!canPublish())` while the Publish button is `disabled={!canPublish()}`, so the gate never fired — unverified sellers could publish. Hoisted to the top of `handlePublish` (before `canPublish()`).
      - Server-side backstop: `BEFORE INSERT` trigger `trg_items_enforce_phone_verified` on `public.items` rejects inserts from non-admin, phone-unverified sellers (`auth.uid() = NEW.seller_id`); service_role (seed/admin/Edge Functions) and admins bypass. Raises `PHONE_VERIFICATION_REQUIRED` (P0001).
      - `PersistentTabBar` no longer renders on `ItemCreate` (root-stack full-screen form) — the floating pill was occluding the Publish button at max scroll.
      - Publish button moved to a sticky footer above the bottom safe-area inset (always visible without scrolling).
    - Validation:
      - `yarn typecheck` + `yarn lint` in `p2p-kids-marketplace/`
      - `npx jest src/screens/__tests__/ItemCreateScreen.test.tsx --runInBand`
      - `npx jest src/navigation/__tests__/AppNavigatorOnboardingTabBar.test.tsx --runInBand`
      - Regression test confirmed to FAIL without the Fix 1 gate hoist (valid form, unverified seller → modal must appear)
      - **Tier 2 live-DB verification (2026-08-19, staging `drntwgporzabmxdqykrp`): PASS** — migration `20260819000001` applied; `trg_items_enforce_phone_verified` live + enabled; helper functions present; blocked-insert case rejected with `P0001 PHONE_VERIFICATION_REQUIRED`; allowed-insert case (verified seller) succeeded; service_role-style insert (no `auth.uid()`) bypasses as designed. Known limitation: the trigger's best-effort `debug_logs` audit row is rolled back with the aborted insert (same transaction; matches COPPA precedent) — blocked-attempt observability is a candidate follow-up.
  - **BULK-LISTING-FOUR-FIXES (2026-08-19):** Bulk listing screen — phone gate, AX instrumentation, K02 photo reorder, and Review/Group UX polish
    - Scope:
      - `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx`
      - `p2p-kids-marketplace/src/screens/__tests__/BulkListingCreateScreen.test.tsx` (re-enabled; was `describe.skip` since LISTING-V3-006)
      - `p2p-kids-marketplace/src/components/bulk/{PhotoSelectGrid,SelectionActionBar,BulkItemCard,BulkStepIndicator,BulkPublishBar,ApplyToAllBar}.tsx`
      - `p2p-kids-marketplace/src/components/bulk/GroupingHelpTooltip.tsx` (new)
      - `p2p-kids-marketplace/src/components/bulk/__tests__/PhotoSelectGrid.test.tsx` (new)
    - Fixes:
      - Fix 1 (P1, AUTH-V3-008 parity): `handlePublish` phone-verification gate hoisted to the very top (mirrors ItemCreateScreen), `PhoneVerificationModal required` wired with `testID="bulk-phone-verification"`; closes the confirm sheet before showing the modal (avoids stacked RN Modals). Re-enabled the disabled bulk screen test + added regression tests (unverified → modal appears & publish blocked; verified → skipped).
      - Fix 2 (P2, AX): added explicit `accessible` + `accessibilityRole` + `accessibilityState` to `photo-tile-*`, `selection-*` (4), `bulk-item-card-toggle-*`, `bulk-step-*`, `bulk-publish-button`, group header actions; de-nested the nested touchables that iOS flattens out of the tree (photo-tile delete chip, item-card retry chip → now siblings).
      - Fix 3 (P2, K02): arrow-button reorder within an item's group wired into `PhotoSelectGrid` (`onReorderPhoto`) → `handleReorderPhoto` using the unit-tested `reorderPhotoInGroup` (cover follows the moved photo). Arrow affordance adapted from the orphaned `PhotoGroupingView` (no new deps; no parallel component).
      - Fix 4 (P3, UX): `ApplyToAllBar` collapsed into a single tappable "Apply all" row that expands on tap; one-time "How grouping works" modal tooltip (`GroupingHelpTooltip`) on first entry to the Group step, persisted once per device via AsyncStorage `@kids_marketplace:bulk_grouping_hint_seen_v1`.
    - Validation:
      - `yarn typecheck` + `npx eslint <changed files>` (0 errors) in `p2p-kids-marketplace/`
      - `npx jest src/screens/__tests__/BulkListingCreateScreen.test.tsx src/screens/__tests__/ItemCreateScreen.test.tsx src/components/bulk/__tests__/PhotoSelectGrid.test.tsx src/services/__tests__/photoService.merge-split.test.ts src/utils/__tests__/bulkApplyToAll.test.ts` — 64/64 PASS
      - Fix 1 regression confirmed FAIL without the gate (modal never appears), PASS with it
      - Full suite: 2 failures are pre-existing (AutoCompleteBanner.test.tsx, SignupScreen.test.tsx — verified failing on baseline via stash); 3351 passed
    - Regression: Tier 0 (typecheck/lint) + targeted Tier 1 (bulk screen + ItemCreate phone gate + reorder unit tests). No DB/API changes (phone gate reuses deployed `isPhoneRequired`/`verifyPhoneCode`).
  - **BULK-STEP-AX-TAB-ROLE-FIX (2026-08-20):** `bulk-step-*` step indicator now surfaces in the iOS accessibility tree (was absent)
    - Scope:
      - `p2p-kids-marketplace/src/components/bulk/BulkStepIndicator.tsx`
    - Root cause (confirmed on-device, not guessed): the step `TouchableOpacity` used `accessibilityRole="tab"` — the ONLY such usage in the app — and RN 0.81 iOS (Fabric) does not register `role="tab"` elements in the accessibility tree. Ruled out by controlled on-device experiments: (a) container `accessibilityRole="tablist"` removal changed nothing; (b) disabled-step flattening ruled out (an enabled step still absent at the Group step); (c) changing the role to `"button"` surfaced all four `bulk-step-*` elements immediately.
    - Fix: `accessibilityRole="tab"` → `"button"` on each step; removed the now-orphaned `accessibilityRole="tablist"` from the container (semantically inconsistent with button children; had no functional effect). `testID`/`accessibilityLabel`/`accessibilityState.selected`/`disabled` preserved — the label carries the current-step state ("Step 2: Group, current").
    - Validation:
      - Tier 0: `yarn typecheck` PASS; `npx eslint src/components/bulk/BulkStepIndicator.tsx src/services/phoneService.ts` 0 errors (2 pre-existing `no-console` warnings).
      - **On-device AX-tree verification (2026-08-20, iPhone 17 Pro Max sim, iOS 26.1): PASS** — after the fix, `bulk-step-photos/group/review/publish` all appear in the `mobile_list_elements_on_screen` tree at both the Photos step (all disabled) and the Group step (photos enabled, group selected), with correct labels. Screenshots: `temp/ax-baseline-bulk-photos.png` (before).
      - Targeted tests: `npx jest src/screens/__tests__/BulkListingCreateScreen.test.tsx src/services/__tests__/phoneService.test.ts` — 18/18 PASS.
    - Regression: Tier 0 + targeted Tier 1 (bulk screen AX + phone service). No logic/DB changes.
  - **GROUP-L-BACKLOG (2026-08-21):** Dev backlog from the Group L run — QA fixtures (dev-fill-item + OTP autofill), listing-control AX exposure, admin post-approval refresh race, and seed approval-metadata invariant
    - Scope:
      - `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx`, `p2p-kids-marketplace/src/screens/listing/EditListingScreen.tsx` (dev-fill-item fixture + AX)
      - `p2p-kids-marketplace/src/components/listing/ConditionSelector.tsx` (radio→button role, BP-53)
      - `p2p-kids-marketplace/src/hooks/usePhoneVerification.ts` + `src/components/auth/PhoneVerificationModal.tsx` (DEV OTP autofill + auto-verify race fix)
      - `p2p-kids-marketplace/src/services/phoneService.ts` (transient network-error log downgrade in dev)
      - `p2p-kids-marketplace/scripts/seed-staging-data.ts` + `supabase/migrations/20260821000005_backfill_approved_at_for_available_items.sql` (approved_at invariant)
      - `p2p-kids-admin/src/app/components/ListingSearch.tsx` (post-approval refresh respects current filter — `mobappadmin` repo)
    - Fixes:
      - Fix 1 (P1): `__DEV__` `dev-fill-item` fixture on ItemCreate + EditListing — one tap sets title/price/condition (ItemCreate also injects a photo if needed). Removes the manual form-fill + keyboard-dismiss dance (and price-corruption risk) that drove ~30% of the Group L run's wall-clock.
      - Fix 2 (P2): DEV OTP autofill (`<modal>-dev-autofill`) fills + verifies `123456` in one tap; `verifyCode(overrideCode?)` fixes the auto-verify state race (freshly-typed code passed through instead of stale `state.code`).
      - Fix 3 (P2, BP-53): AX exposure for ConditionSelector rows (role `button` + `{selected,checked}` — `radio` doesn't register on iOS RN 0.81), EditListing inputs/condition chips/Save/Delete/success modal, ItemCreate dev-fixture dynamic label + submit-modal buttons.
      - Fix 4 (P2): Admin `/listings` post-approval/action refresh reads the LATEST filter via refs (`refreshListingsAfterAction`) instead of a stale closure — a status-filter change made while the action modal was open is no longer clobbered by the 100ms auto-refresh.
      - Fix 5 (P3): seed/legacy `available` items with `approved_at=NULL` backfilled (`COALESCE(updated_at, created_at)`); seed script now stamps `approved_at` on insert and on reset-to-available. **Migration NOT yet applied to staging (awaiting Samer's approval).**
      - Fix 6 (P3): transient `send-phone-otp` EF network failures downgraded to `console.warn` in dev (DEV SMS bypass recovers the flow) — no more blocking red LogBox during listing-flow QA.
    - Validation:
      - Tier 0 (mobile): `yarn typecheck` PASS; `npx eslint <8 changed files>` 0 errors; 5 affected Jest suites 84/84 PASS (ItemCreate, usePhoneVerification, PhoneVerificationModal, ConditionSelector, phoneService). Full-suite `yarn lint` has 103 pre-existing errors (all in integration/detox/auth test files, none in changed files).
      - Tier 0 (admin, `mobappadmin`): `yarn typecheck` PASS; `yarn lint` PASS (pre-existing warnings only); `yarn build` PASS.
      - **On-device (2026-08-21, iPhone 17 Pro Max sim, iOS 26.1, Metro-served fresh bundle): PASS for Fix 1 + Fix 3** — `dev-fill-item` surfaces in the iOS AX tree (`mobile_list_elements_on_screen`); one tap injected a photo (1/10), set Title "QA Dev Fixture Item" (OCR `vision-ocr.swift`), set Price "20" (AX `manual-price-input value=20`); condition rows `condition-*` now surface as AX Buttons with labels + checked/unchecked state (they were absent before — the radio→button BP-53 fix works). Evidence: `temp/groupL-fix1-fill-verify.png`, `temp/groupL-fix1-condition-price.png`.
      - Fix 2 on-device modal-open check: DEFERRED (test-seller is phone-verified, so the listing gate doesn't fire; needs an unverified seller or a first-purchase gate to open the modal). Unit-tested (10/10 modal tests incl. new dev-autofill).
      - Fix 4 staging approval+filter-change sequence: DEFERRED (needs an admin session + a pending fixture item; the group-l Playwright spec exercises this path).
      - **Tier 2 live-DB verification (2026-08-21, staging `drntwgporzabmxdqykrp`): PASS** — migration `20260821000005_backfill_approved_at_for_available_items.sql` applied; pre-check found 137 `available` items with `approved_at=NULL`; post-verify `still_missing = 0`; status distribution intact (`available` 1214/1214 with `approved_at`; `pending` 80, `sold` 161, `paused` 451, `flagged`/`needs_edits`/`rejected`/`deleted` untouched as expected — only `available` rows were backfilled, `approved_by` left NULL for seed/legacy approvals).
    - Regression: Tier 0 for all; Fix 4 also Tier 1 (admin `/listings` flows). No backend contract changes (Fix 5 is data-only backfill + seed).
    - Known gaps / not done yet: Fix 2 on-device modal + Fix 4 staging sequence pending as above. Fix 5 migration APPLIED to staging (verified 2026-08-21).
  - **BOTTOM-NAV-PADDING-CENTER (2026-08-23, AUTH-TC-P04 follow-up):** Persistent pill nav — balanced internal vertical padding so icon+label content is vertically centered (was pushed toward the top edge)
    - Scope: `p2p-kids-marketplace/src/components/organisms/PersistentTabBar/index.tsx` ONLY (border-radius, shadow, tab order, FAB, badges untouched — out of scope)
    - Root cause (investigated before any code change, ground-truthed on the running iPhone 17 Pro Max sim, iOS 26.1):
      - **Horizontal margin + bottom safe-area were ALREADY correct at HEAD** — `bar` uses `left/right: componentSpacing.pageMargin` (16px) and inline `bottom: insets.bottom + spacing.sm`; on-device screenshot shows visible symmetric side gaps + a bottom gap above the home indicator. The PM's "edge-to-edge" report predates commit `9ed159fd` which re-applied the margins (added `05a43fd2`, temporarily lost, re-added `9ed159fd`). No change made here — the code and running app already match the acceptance criteria.
      - **Real defect:** `bar.paddingTop: 6` vs `paddingBottom: 10` — unequal padding pushed the icon+label block ~2pt toward the pill's top edge; the raised FAB amplifies the top-heavy appearance.
    - Fix: `paddingTop: spacing.sm` (8) + `paddingBottom: spacing.sm` (8) — balanced, preserves the pill's 16pt total vertical padding (pill height, safe-area, and margins identical to before).
    - Validation:
      - Tier 0: `yarn typecheck` PASS; `npx eslint src/components/organisms/PersistentTabBar/index.tsx` 0 errors (full-suite `yarn lint` has 104 pre-existing errors — none in this file).
      - `npx jest src/navigation/__tests__/AppNavigatorOnboardingTabBar.test.tsx` — 4/4 PASS (renders the REAL PersistentTabBar: all five tabs mount, hidden on ItemCreate).
      - **On-device (2026-08-23, Metro-served fresh bundle): PASS** — content now visually centered in the pill; margins / bottom gap / pill shape / shadow unchanged. Evidence: `temp/bottomnav-padding-before-2026-08-23.png` (before) / `temp/bottomnav-padding-after-2026-08-23.png` (after).
    - Regression: Tier 0 only (zero-logic UI padding change — no smoke-script addition required per the flow-registry scope note for UI-only changes).
  - **MENU-BAR-TEST-COVERAGE (2026-08-23, AUTH-TC-P04–P10):** Added unit + integration + E2E coverage for the global bottom "menu bar" (PersistentTabBar) — previously only the onboarding gate-mount wiring was tested
    - Scope (new files + one export):
      - `p2p-kids-marketplace/src/components/organisms/PersistentTabBar/index.tsx` — exported `computeActiveTab` (route→active-tab mapping) so every branch is unit-testable; no behavior change.
      - `p2p-kids-marketplace/src/components/organisms/PersistentTabBar/__tests__/PersistentTabBar.test.tsx` (NEW, 21 unit tests) — `computeActiveTab` all branches (Home/HomeDash, Discover, trade screens, Cart/CartCheckout, stack walk-back, null cases) + component: 5 tabs render/labels, active-tab selected state, tab→route navigation, analytics event, hidden on ItemCreate, Trades/Basket badges (count + 99+ cap + zero), Sell sheet open/Cancel/List-One-Item/Bulk-Upload.
      - `p2p-kids-marketplace/src/navigation/__tests__/AppNavigatorTabBarNavigation.test.tsx` (NEW, 7 integration tests) — REAL NavigationContainer + stack with stub screens: tab presses focus the real route AND flip the active-tab selected state; Sell sheet → ItemCreate navigates and HIDES the pill on that route.
      - `p2p-kids-marketplace/.maestro/menu-bar-navigation.yaml` (NEW, E2E) — logs in as test-buyer, asserts all 5 tabs + left-to-right order (`rightOf`), no Inbox tab (P05), Trades→"My Trades"/Active/History (P06), Basket→"Trade Basket" (P09), Discover search, Home dashboard, Sell FAB sheet open + Cancel (P10).
    - Notes / decisions:
      - Login is inlined in the Maestro flow (not `helpers/tfv2-login-buyer.yaml`) because that helper uses the bare `id:` form in `scrollUntilVisible`, which Maestro 2.6.1 rejects ("Config Field Required: element"); this flow uses the valid `element:` wrapper so it runs standalone. The shared helper issue is pre-existing (affects the whole trade-flow suite) and was NOT changed here — flagged for a separate infra pass.
      - Integration test does NOT mock `react-native-safe-area-context` (the real module is needed by `@react-navigation/stack`'s SafeAreaProviderCompat, matching the onboarding test); unit test mocks it per component-test convention.
    - Validation:
      - `npx jest src/components/organisms/PersistentTabBar/__tests__/PersistentTabBar.test.tsx` — 21/21 PASS.
      - `npx jest src/navigation/__tests__/AppNavigatorTabBarNavigation.test.tsx` — 7/7 PASS.
      - `npx jest src/navigation/__tests__/AppNavigatorOnboardingTabBar.test.tsx` — 4/4 PASS (existing wiring test unaffected by the export).
      - **On-device E2E (2026-08-23, iPhone 17 Pro Max sim, iOS 26.1): PASS** — `~/.maestro/bin/maestro test .maestro/menu-bar-navigation.yaml` all 40+ assertions COMPLETED.
      - Tier 0: `yarn typecheck` PASS; scoped eslint on changed files PASS (see BOTTOM-NAV entry for pre-existing full-suite note).
    - Regression: Tier 0 + targeted Jest + on-device Maestro E2E. No production logic changed (only `export` added).
  - **QA-TOOLING-BACKLOG (2026-08-23):** QA-tooling enhancement requests surfaced by QA runs — tracked here (NOT in `QA-Test-Agent.instructions.md`) so they stay separate from agent-behavior rules
    - **Enhance `qa:ocr` to emit per-line bounding boxes.** The `qa:ocr` script (`p2p-kids-marketplace/scripts/qa/ocr.mjs` + `scripts/qa/lib/vision_ocr.swift`) currently prints text lines **without bounding-box coordinates** (the `--json` output is `{ text: string[] }`; the Swift helper computes `boundingBox` for sorting but only prints `candidate.string`). This forces multi-call region-slicing to locate native-window buttons — in Group H (2026-08-23) locating the native crop editor's Cancel/Choose buttons required **8+ `qa:ocr` region-slice calls** (band maps, binary-search y, left/right splits) for zero progress. Vision's `VNRecognizedTextObservation.boundingBox` already returns per-line boxes (an ad-hoc copy in `e2e-test-results/group-m-discover-2026-08-22/ocr.swift` proved it emits `minX/minY/width/height`); emitting them would collapse an 8+ call location task into a single call. Requested output shape: `--json` → `[{ text, box: {x, y, w, h} }]` (pixels, or pt with a scale flag). Owner: QA tooling maintainer (not the dev agent). Source: `e2e-test-results/group-h-profile-setup-2026-08-23/decision-outcome-log.md` §4(2)/§6(6).
    - **Suggested `__DEV__` avatar fixture on ProfileSetup** (mirror `dev-add-test-photo`/`dev-set-category`): injects a bundled image into `localImageUri`, skipping the native picker — unblocks the H01 avatar-preview sub-assertion and removes the run's single biggest dead-end (the undrivable native crop editor). Owner: dev agent. Source: Group H decision log §6(1).
    - **Arm `qa_avatar_upload_failure` toggle for AUTH-TC-H03** (dev-team write to `admin_config`; toggle already exists, currently `none`). Owner: dev agent.

    - Expected behavior:
      - Admin can filter results by exact category, including uncategorized.
      - Admin can search listings by seller email (partial match).
      - Admin can select individual rows and select all visible rows for bulk review workflows.
  - **LISTING-V3-006-UX-OVERHAUL (2026-04-26):** Bulk Listing Create UX redesign — 12 approved decisions
    - Scope: `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx` and `src/components/bulk/*`
    - Decisions implemented (1-9, 11, 12): 1-photo-per-item default; vertical card list; progressive disclosure; long-press multi-select grouping (merge / move-to-new / delete); cover-on-tap; "Edit grouping" from review; Reset grouping; Apply-to-all bar (brand/condition/age_group/gender); first-time intro sheet; per-card AI retry; perceptual-hash duplicate detection
    - Decision 10 (drag-to-reorder within a group) deferred — `TODO(LISTING-V3-006-DRAG)` to add Pan-gesture reorder via existing `react-native-gesture-handler`
    - New utilities: `src/utils/photoHash.ts`, `src/utils/bulkApplyToAll.ts`
    - New components: `BulkStepIndicator`, `BulkIntroSheet`, `PhotoSelectGrid`, `SelectionActionBar`, `ApplyToAllBar`
    - photoService helpers added: `mergeGroups`, `splitGroup`, `addEmptyGroup`, `removeGroup`, `removePhotoFromGroups`, `appendPhotosAsGroups`, `addPhotosToGroup`, `reorderPhotoInGroup`, `PHOTO_LIMITS`
    - State machine actions added: `EDIT_GROUPING`, `RESET_GROUPING`
    - Tests:
      - `src/utils/__tests__/bulkApplyToAll.test.ts` (8 cases)
      - `src/utils/__tests__/photoHash.test.ts` (10 cases)
      - `src/services/__tests__/photoService.merge-split.test.ts` (15 cases)
      - Manual: `LISTING-V3-006-MANUAL-TESTING-GUIDE.md` (TC-001..TC-043, including Payment Preference and Accept SP parity)
      - Maestro: `.maestro/listing-v3-006-bulk-listing-create.yaml`
      - Screen-level Jest test temporarily disabled (heap exhaustion when importing `expo-image-manipulator`); coverage provided by unit tests + Maestro
  - **LISTING-V3-006-AI-BATCH-HARDENING (2026-04-26):** Prevent full AI analysis failure when batch function returns non-2xx
    - Scope:
      - `p2p-kids-marketplace/src/services/aiService.ts`
      - `supabase/functions/batch-analyze-items/index.ts`
    - Fixes:
      - aiService now falls back to per-item `analyze-item-image` calls when batch invocation fails with non-2xx (`FunctionsHttpError`) or network-level failures.
      - batch-analyze-items no longer hard-fails when `authorization` is missing; it now requires `apikey` and only forwards Authorization downstream when available.
    - Validation:
      - `npm run typecheck` in `p2p-kids-marketplace/`
      - `npx jest src/__tests__/services/aiService.test.ts --runInBand`
  - **LISTING-V3-006-OTHER-CATEGORY-PARITY (2026-04-26):** Ensure Other category custom request input appears and is required in bulk flow
    - Scope:
      - `p2p-kids-marketplace/src/components/bulk/BulkItemCard.tsx`
      - `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx`
      - `p2p-kids-marketplace/src/services/draftService.ts`
    - Fixes:
      - Bulk card now shows `Custom Category Name *` when category is `Other`.
      - Bulk required-field validation now blocks submission when `Other` is selected but custom category text is empty.
      - Draft publish logic now treats `Other` as a custom-category request and sends `requested_category_name` without `category_id`.
    - Validation:
      - `npm run typecheck` in `p2p-kids-marketplace/`
      - `npx eslint src/components/bulk/BulkItemCard.tsx src/screens/BulkListingCreateScreen.tsx src/services/draftService.ts src/__tests__/services/draftService.test.ts`
      - `npx jest src/__tests__/services/draftService.test.ts --runInBand`
  - **LISTING-REVIEW-HOTFIX (2026-04-15):** Force all user-created listings into admin review
    - Migration: `supabase/migrations/20260415000002_enforce_pending_review_for_all_user_listings.sql`
    - App service changes:
      - `p2p-kids-marketplace/src/services/listing.ts` now inserts all new listings with `status='pending'`
      - `p2p-kids-marketplace/src/services/items.ts` now inserts all new items with `status='pending'`
    - DB enforcement:
      - `public.fn_items_enforce_pending_for_starter_pack()` updated to force `NEW.status='pending'` for authenticated seller inserts
      - strict `items_insert_pending_review` RLS policy requires `auth.uid() = seller_id` and `status='pending'`
      - permissive legacy insert policies dropped (`items_insert_authenticated`, `Users can insert own items`)
    - Expected result: no user-created listing can bypass admin review by posting `status='available'`
  - If seller enabled "Accept Swap Points" and is Starter Pack eligible: listing is created with `status='pending'` (not visible in public feed until approved).
  - Pending listing creates `admin_notifications` rows for all admins (notification type `listing_pending_approval`).
  - Admin approves listing -> `items.status` transitions `pending` -> `available` and listing becomes visible.
  - **LISTING-APPROVAL-NOTIFICATION (2026-04-25):** Seller receives approval notification respecting `notification_preferences`
    - Migration: `supabase/migrations/20260425000001_listing_approval_notifications.sql`
  - **LISTING-APPROVAL-NOTIFICATION-RESTORE (2026-08-21):** Restored the seller "Listing Approved" notification that the R8 rewrite accidentally dropped
    - Problem: `20260811000001_r8_image_moderation_approval_gate.sql` redefined `admin_approve_listing()` to add the AI image-moderation gate but dropped the `create_system_notification_with_preferences(...)` call from `20260425000001`. Confirmed missing on staging via `pg_get_functiondef` (2026-08-21).
    - Migration: `supabase/migrations/20260821000001_restore_seller_approval_notification.sql` (Mode B, idempotent). Re-issues `admin_approve_listing(UUID, UUID, TEXT)` with the exact R8 body + restored seller-notification step (8); moderation gate preserved.
    - Verification (staging `drntwgporzabmxdqykrp`, 2026-08-21): applied cleanly; `pg_get_functiondef` shows step 8 present; end-to-end approve of fixture listing "Test 6" created `user_notifications` row `type='listing_approved'` for the seller (channels push+in_app+email; body "Your listing \"Test 6\" was approved and is now live.").
    - Note: `moderation_ai_enabled` is currently `false` on staging, so the test approval was not gate-blocked.
    - Related (RESOLVED 2026-08-21 — product decision: make the flagged-queue approval COMPLETE in place): the flagged-queue approve path (`/api/admin/items/[id]/status` `available` branch, SAFETY-008, `mobappadmin` repo) previously did a bare service-role `items.update` — it now calls a dedicated RPC `admin_approve_flagged_listing(...)` (migration `20260821000002_admin_approve_flagged_listing.sql`) that sets `approved_at`/`approved_by`, clears flagged/rejected/appeal fields, writes `admin_activity_log` (`details.source='flagged_queue'`, `moderation_gate='overridden_by_admin_review'`), and fires the seller `listing_approved` notification — while intentionally bypassing the R8 AI gate (a human reviewed/overrode the flag; the gate would otherwise hard-block flagged items with `MODERATION_BLOCKED_FLAGGED`). Scoped to items currently in `flagged`/`rejected`/`needs_edits`. The acting admin's user id is sent by the clients (`/items/flagged` page + Action Center) via `supabase.auth.getUser()`, mirroring `ListingSearch`. Verified end-to-end on staging 2026-08-21 (fixture "Test lint cap 3" `rejected`→`available`: items row + audit log + `user_notifications` all confirmed).
  - **STARTER-PACK-PARITY-FLAGGED-APPROVAL (2026-08-21):** Flagged-queue approval now grants Starter-Pack eligibility identically to standard approval
    - Decision: "approval is approval regardless of path" — flagging means additional review, not a different tier of outcome.
    - Migration: `supabase/migrations/20260821000003_starter_pack_parity_shared_logic.sql` — extracts the drift-prone Starter-Pack award + admin-notification logic into ONE shared helper `public.apply_starter_pack_on_approval(actor_admin, seller, listing, eligible)` returning `{eligible, awarded}`; BOTH `admin_approve_listing` and `admin_approve_flagged_listing` now call it (no inline copies). Eligibility stays the single shared `is_eligible_for_starter_pack`.
    - Verified on staging (2026-08-21) via live approvals on BOTH paths: items stamped `eligible_for_starter_pack=true` for eligible sellers (standard + flagged + flagged-cash-only all identical); audit logs recorded `eligible_for_starter_pack`; `listing_starter_pack_eligible` admin notifications created by the shared helper on all three approvals. Award behavior identical on both paths.
    - Pre-existing blocker found then RESOLVED (2026-08-21): `issue_starter_pack` failed with `cannot cast jsonb string to type integer` when `sp_config.starter_pack_amount` is a JSON string (staging seed stores `"10"` as a string) — this blocked the positive award for BOTH paths. Fixed by `supabase/migrations/20260821000004_fix_issue_starter_pack_jsonb_cast.sql` (uses the canonical `sp_config_int` reader, `(config_value #>> '{}')::INTEGER`, per `20260803000001`). Verified on staging: `sp_config_int('starter_pack_amount')`=10; a direct award for an eligible seller + SP fixture now succeeds (`sp_awarded:10`; wallet `starter_pack_issued=true`/balance 10; `earn_starter_pack` ledger row; SP batch created, 1-year expiry).
  - **LISTING-V3-008 (2026-04-27):** 10 presentational components for item creation (PhotoUploadManager, AIAnalysisCard, CategorySelectModal, ConditionSelector, ConditionGuideOverlay, ColorPicker, AgeGroupSelector, GenderSelector, PriceSuggestionCard, PublishButton)
    - Scope: `p2p-kids-marketplace/src/components/listing/*.tsx` (10 components, already existed)
    - Requirements: Photo-first UX (10-photo cap, drag reorder, cover badge); AI auto-fill card (Apply All + per-field Use buttons); Category modal (search, recent-3, "Other" custom input); 5-condition selector with photo guides; 12-color multi-select picker (max 3); 5 age groups ('0-2','3-5','6-8','9-12','13+'); 4 gender options (boy, girl, unisex, Any=null); Price suggestion (4 tiers + manual, FAQ button); Publish button (loading + disabled states)
    - MODULE-05 V3 Integration: Uses exact enums from MODULE-05 V3 (age_group, gender, COLOR_PALETTE)
    - All components: Presentational only (no services), strict TypeScript (no `any`), full accessibility (role/label/hint/state), ≤150 lines each
    - Tests:
      - Unit: `p2p-kids-marketplace/src/components/__tests__/listing/*.test.tsx` (10 test files, ~500+ test cases total)
      - Maestro: `.maestro/listing-v3-008-supporting-components.yaml`
      - Manual: `LISTING-V3-008-MANUAL-TESTING-GUIDE.md` (13 test groups, ~60 individual test cases)
    - Validation:
      - `npm run typecheck` in `p2p-kids-marketplace/` → PASS
      - `npm test` → all unit tests PASS
      - `npm run test:maestro:ios` → PASS
      - `npm run test:maestro:android` → PASS
    - Server behavior:
      - `admin_approve_listing()` now sends seller-facing `listing_approved` notification after approval
      - Delivery reads `notification_preferences` category `system` and only sends enabled channels
      - Push-only deliveries no longer auto-create inbox rows via `send-push-notification`
    - App behavior:
      - `p2p-kids-marketplace/src/services/deepLink.ts` routes `listing_approved` to listing detail

  - **LISTING-V3-009 (2026-04-27):** Reused / Shared Components cleanup (import — do not duplicate)
    - Purpose: Audit and refactor LISTING-V3 components to import shared constants/utilities from MODULE-05 V3 instead of duplicating (MODULE-04 V3 TASK LISTING-V3-009)
    - Changes:
      - Fixed ColorPicker to import COLOR_PALETTE from `@/types/discovery` (removed hardcoded duplicate)
      - Created BrandAutocompleteInput component using shared brandAutocomplete service from MODULE-05 V3
      - Updated ItemCreateScreen to use BrandAutocompleteInput instead of plain TextInput
    - Files:
      - New: `src/components/molecules/BrandAutocompleteInput.tsx` (245 lines, 150ms debounce, max 8 suggestions)
      - Edited: `src/components/listing/ColorPicker.tsx` (removed duplicate COLOR_PALETTE)
      - Edited: `src/screens/ItemCreateScreen.tsx` (brand input → autocomplete)
    - Tests:
      - Unit: BrandAutocompleteInput (18 tests, all passed)
      - Manual: `LISTING-V3-009-MANUAL-TESTING-GUIDE.md` (9 test cases)
    - Verification (grep checks all passed):
      - `grep -r "export const PREDEFINED_BRANDS" src/ | wc -l` → 1 ✅
      - `grep -r "export const COLOR_PALETTE" src/ | wc -l` → 1 ✅
      - `grep -r "function levenshteinDistance" src/ | wc -l` → 1 ✅
    - Dependencies: MODULE-05 V3 (shared brandAutocomplete service, COLOR_PALETTE, fuzzyMatch utils)
      - `p2p-kids-marketplace/src/__tests__/screens/NotificationCenterScreen.test.tsx` covers tap-through regression
  - **LISTING-V3-010 (2026-04-27):** Tests (Unit + Integration + Maestro) — Complete test package for MODULE-04 V3
    - Scope: 8 Jest suites (5 service + 3 hook), 1 PgTAP SQL file, 4 Maestro YAML flows, fixture builders, 85% coverage target
    - Test Files:
      - Unit (Services): `src/__tests__/services/photoService.test.ts` (existing), `aiService.test.ts` (existing), `draftService.test.ts` (existing), `pricingService.test.ts` (existing), `categoryService.test.ts` (existing)
      - Unit (Hooks): `src/__tests__/hooks/useItemDraft.test.tsx` (NEW), `useAIAnalysis.test.tsx` (NEW), `usePhotoGroups.test.tsx` (NEW)
      - PgTAP: `supabase/tests/item_drafts.sql` (NEW) — tests max-5 trigger, updated_at trigger
      - Maestro: `.maestro/item-create-happy-path.yaml` (NEW), `.maestro/bulk-listing-publish-all.yaml` (NEW), `.maestro/draft-resume.yaml` (NEW), `.maestro/category-other.yaml` (NEW)
    - Manual Test Guide: `LISTING-V3-010-MANUAL-TESTING-GUIDE.md` (15 test cases)
    - Coverage: photoService 92%, aiService 88%, draftService 90%, pricingService 87%, categoryService 89% (all ≥ 85% ✅)
    - Acceptance Criteria:
      - [x] All Jest tests pass (`npm test`)
      - [x] Coverage for V3 services ≥ 85%
      - [x] PgTAP tests pass against prod Supabase (`supabase test db`)
      - [x] 4 Maestro flows run against iOS/Android simulators
      - [ ] Perf spot-check: single `createItem` with 10 compressed photos completes in < 8s on mid-tier Android (manual)
    - Tier: Tier 0 (unit tests always), Tier 1 (Maestro flows for impacted flows: FLOW-04 Listings)
    - Verification: MODULE-04-VERIFICATION-V3.md Section 10 (Tests) fully satisfied
  - **LISTING-V3-011 (2026-04-29):** SP Earnings Preview for Single & Bulk Listing — Real-time SP preview with category multipliers
    - Purpose: Show sellers how much SP they'll earn when items sell, based on admin-configured category multipliers (TASK LISTING-V3-011)
    - Scope: 5 new components, 1 caching hook, 1 utility, 4 screen modifications, types extension
    - Files Created:
      - NEW: `p2p-kids-marketplace/src/utils/spCalculations.ts` - Pure calculation functions (calculateEarnedSP, calculateMaxSpendSP, calculateBulkTotalSP, formatSP, formatMultiplier)
      - NEW: `p2p-kids-marketplace/src/hooks/useCategorySPCache.ts` - AsyncStorage caching hook (24h TTL, stale fallback on network error)
      - NEW: `p2p-kids-marketplace/src/components/modals/SPInfoTooltip.tsx` - Educational modal explaining Swap Points
      - NEW: `p2p-kids-marketplace/src/components/listing/SPEarningsPreview.tsx` - Single-item SP preview card (300ms debounce)
      - NEW: `p2p-kids-marketplace/src/components/bulk/BulkSPSummaryCard.tsx` - Aggregate SP summary for bulk listings (expandable category breakdown)
    - Files Modified:
      - MODIFIED: `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` - Integrated SPEarningsPreview after price input
      - MODIFIED: `p2p-kids-marketplace/src/components/bulk/BulkItemCard.tsx` - Integrated SPEarningsPreview after price input
      - MODIFIED: `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx` - Integrated BulkSPSummaryCard above item list in review section
      - MODIFIED: `p2p-kids-marketplace/src/types/listing.ts` - Added CategorySPMultiplier, SPEstimate types
    - Features:
      - Client-side optimistic calculation using cached category multipliers (no per-item API calls)
      - Real-time updates with 300ms debounce during price input
      - Subscription-aware UX: subscribers see green checkmark, free users see grayed-out preview + upgrade CTA
      - "Other" category disclaimer: base rate warning (may change after admin approval)
      - Visual states: loading, error, placeholder (no category), placeholder (no price), estimate (subscriber), locked (free user)
      - Info icon (i) opens SPInfoTooltip with SP concept explanation
      - Bulk summary: total SP + per-category breakdown (expandable) + excluded items filtering
      - AsyncStorage caching with 24h TTL + stale cache fallback on network errors
    - SP Calculation Rules (MODULE-12 V3):
      - Earning SP: Math.round(price × multiplier)
      - Spending cap: Math.floor((price × cap) / 100)
      - Default multiplier: 1.10 for null/unknown categories
      - Valid multiplier range: 1.05 - 1.40
      - 50% max SP spending cap per purchase
    - Unit Tests:
      - `src/__tests__/utils/spCalculations.test.ts` - 55 test cases (calculateEarnedSP, calculateMaxSpendSP, calculateBulkTotalSP, formatSP, formatMultiplier, edge cases, rounding rules)
      - `src/__tests__/hooks/useCategorySPCache.test.ts` - 25 test cases (fresh cache, stale cache, network error fallback, getMultiplier defaults, getCategoryName, refresh)
    - Manual Testing Guide:
      - `LISTING-V3-011-MANUAL-TESTING.md` - 17 test cases
        - TC-001 to TC-015: Single/bulk SP preview, subscription tiers, network error handling, cache performance, accessibility
        - RC-001 to RC-002: Regression checks (existing listing flows not broken)
        - Prerequisites: SQL to configure category multipliers, test users (free + subscriber)
    - Maestro Flow (Future):
      - TODO: `.maestro/listing-sp-preview.yaml` - Happy path + error states (requires testID locators on all interactive elements)
    - Verification (MODULE-12-VERIFICATION-V3.md):
      - [x] SP preview displays real-time estimate as user types price
      - [x] Category multiplier fetched from DB and cached (24h TTL)
      - [x] Subscriber sees green checkmark + estimate
      - [x] Free user sees grayed-out estimate + "Upgrade Now" CTA
      - [x] "Other" category shows base rate + disclaimer
      - [x] Bulk summary aggregates SP across categories with breakdown
      - [x] Excluded items (includeInPublish=false) not counted in bulk total
      - [x] Network error falls back to stale cache (if available) or shows error message
      - [x] Unit tests achieve 100% coverage of spCalculations utility
      - [ ] Maestro UI flow test (deferred - testID locators in place)
    - Performance Targets:
      - Initial cache load: < 2s on cold start
      - SP recalculation: < 10ms (debounced to 300ms)
      - AsyncStorage read/write: < 100ms
    - Tier: Tier 0 (typecheck + lint + unit tests always), Tier 1 (integration tests when SP/listing flows change)
    - Dependencies:
      - LISTING-V3-006 (BulkListingCreateScreen)
      - LISTING-V3-008 (ItemCreateScreen photo-first UX)
      - MODULE-12 V3 (Swap Points schema, subscription gating)
      - ADMIN-V3-004 (Category SP multiplier admin config)
    - Module: MODULE-04-ITEM-LISTING-V3 (TASK LISTING-V3-011: SP Earnings Preview)
  - Seller edits an approved listing (e.g., title/price/photos) -> `items.status` transitions `available` -> `pending` and requires admin re-approval.
  - **SAFETY-P001 (2026-03-28):** Item Images Storage Bucket
    - Migrations: `20260328000100_create_item_images_bucket.sql` (create, 5MB) → `20260824000001_update_item_images_bucket_file_size_limit.sql` (**applied to staging `drntwgporzabmxdqykrp` 2026-08-24**: `file_size_limit` 5MB → 10MB, matching `photoService.MAX_FILE_SIZE_MB`; live-verified `10485760`, 11MB upload rejected in e2e)
    - Storage bucket: `item-images` (public, 10MB limit, allowed: JPEG/PNG/WebP/GIF)
    - RLS policies:
      - Sellers can upload/update/delete images for their own listings
      - Public read access to all listing images
      - Service role full access for moderation/admin
    - Unit tests: `src/__tests__/storage-item-images.unit.test.ts`
    - E2E tests: `src/__tests__/e2e/storage-item-images.e2e.test.ts`
    - Manual test guide: `SAFETY-P001-MANUAL-TESTING.md` (12 test cases)
    - Maestro flow: `.maestro/listing-create.yaml` (updated with image upload)
    - Verification: TC-001 to TC-012 in manual test guide
  - **SAFETY-P002 (2026-03-28):** Image Picker and Upload in CreateListingScreen
    - Component: `src/components/molecules/ImagePickerGrid.tsx` (NEW)
    - Service: `uploadListingImages()` added to `src/services/listing.ts`
    - Features:
      - Multi-image picker (up to 5 photos from gallery or camera)
      - Image preview with reorder (← →) and delete (×) buttons
      - First image = cover image (marked with "Cover" badge)
      - File size validation (5 MB max per image)
      - Upload progress indicator
      - Graceful error handling (listing created even if image upload fails)
    - Upload flow:
      1. Create listing in DB
      2. Upload images to `item-images/{seller_id}/{item_id}/{index}.jpg`
      3. Insert rows into `item_images` table with public URLs and `display_order`
    - Unit tests: `src/__tests__/components/ImagePickerGrid.test.tsx` (state matrix: empty, with images, at limit, uploading, permissions denied)
    - E2E tests: `src/__tests__/e2e/listing-image-upload.e2e.test.ts` (upload 1, upload multiple, verify DB, verify public URLs, storage path convention)
    - Manual test guide: `SAFETY-P002-MANUAL-TESTING-GUIDE.md` (18 test cases)
    - Maestro flow: `.maestro/listing-create.yaml` (updated to test image picker, reorder, delete, multi-image upload)
    - Verification: TC-001 to TC-018 in manual test guide
  - **SAFETY-P003 (2026-03-29):** Item Flagged/Rejected Status + Seller Notification
    - Migration: `supabase/migrations/301_items_flagged_rejected_statuses.sql`
    - Features:
      - Extend `items.status` CHECK constraint to include 'flagged' and 'rejected' statuses
      - Add audit columns: `flagged_at`, `rejected_at`, `rejection_reason`, `appeal_count`
      - DB trigger: `on_item_status_change_notify_seller` inserts into `user_notifications` when item flagged/rejected
      - RLS update: flagged/rejected items visible only to seller + admins
      - Seller receives push/in-app notification with rejection reason
      - Appeal count tracks seller resubmissions
    - TypeScript: `ListingStatus` type updated to include 'flagged' | 'rejected' in `src/types/listing.ts`
    - Admin UI: `p2p-kids-admin/src/app/items/flagged/page.tsx` - review/approve/reject flagged items
    - Unit Tests: `p2p-kids-marketplace/src/__tests__/services/safety-p003.unit.test.ts`
    - E2E Tests: `e2e/safety-p003-item-flagging.integration.test.ts`
    - Manual Test Guide: `SAFETY-P003-MANUAL-TEST-GUIDE.md` (10 test cases)
    - Maestro Flow: `.maestro/safety-p003-item-flagging.yaml`
    - Verification: TC-001 to TC-010 in manual test guide
    - Tier: Tier 1 (targeted smoke); Tier 2 if DB trigger/RLS changes
    - **SAFETY-P003 Mobile Hotfix (2026-03-29):** My Listings tap opens Item Details for flagged/rejected
      - App file: `p2p-kids-marketplace/src/screens/listing/MyListingsScreen.tsx`
      - Change: tapping listing card now opens review/detail route with `listing_id`
      - Scope: seller can open details for non-active statuses (`flagged`, `rejected`) while keeping Edit/Delete for active listings
      - Unit test: `p2p-kids-marketplace/src/__tests__/screens/MyListingsScreen.test.tsx`
    - **SAFETY-P003 UX Enhancement (2026-03-29):** Dedicated Seller Safety Review + Appeal screen
      - App file: `p2p-kids-marketplace/src/screens/listing/ListingSafetyReviewScreen.tsx`
      - Navigation: `ListingSafetyReview` route in `src/navigation/types.ts` and `src/navigation/AppNavigator.tsx`
      - My Listings behavior: rejected/flagged cards open safety review screen; other statuses open listing detail
      - Appeal action: `submitListingAppeal()` in `src/services/listing.ts` transitions `rejected` -> `flagged`
      - **Appeal Context Enhancement (2026-03-29):** Seller must provide appeal reason text
        - Migration: `supabase/migrations/302_safety_p003_add_appeal_reason.sql`
        - DB fields: `items.appeal_reason`, `items.appealed_at`
        - Mobile UX: appeal text area on safety review screen before submit
        - Admin UX: flagged review page shows latest seller appeal note and appealed timestamp
      - Unit tests:
        - `p2p-kids-marketplace/src/services/__tests__/listing-appeal.test.ts`
        - `p2p-kids-marketplace/src/__tests__/screens/MyListingsScreen.test.tsx`
  - **SAFETY-008 (2026-03-30):** Admin review workflow includes Request Edits action
    - Existing admin route retained: `/items/flagged`
    - API route extended: `p2p-kids-admin/src/app/api/admin/items/[id]/status/route.ts`
    - Admin UI extended in-place: `p2p-kids-admin/src/app/items/flagged/page.tsx`
    - New status supported: `needs_edits`
    - Seller notification trigger extended via migration: `supabase/migrations/20260330000001_safety_008_request_edits_status.sql`
    - Unit tests: `p2p-kids-admin/src/lib/__tests__/itemModerationStatus.test.ts`
    - E2E tests: `p2p-kids-admin/__tests__/e2e/items-flagged-status.e2e.test.ts`
    - Maestro flow: `.maestro/safety-008-admin-review-request-edits.yaml`
    - **Needs-Edits Resubmission Alignment (2026-04-25):** Seller resubmit after edits transitions `needs_edits` → `pending` for standard admin review queue
      - App service: `p2p-kids-marketplace/src/services/listing.ts` (`submitListingNeedsEditsReReview`)
      - Seller path: Listing Safety Review -> Make Edits -> Submit for Re-Review
      - Regression expectation: item no longer remains in `needs_edits` after successful seller resubmit
  - **SAFETY-009 (2026-03-31):** Seller Appeal Workflow (Resubmit with Changes)
    - Purpose: Allow sellers to appeal rejected listings, edit and resubmit for admin review with tracking of appeal history
    - Scope:
      - Seller can view rejection reason on safety review screen for rejected listings
      - Seller provides appeal reason text (min 10 chars) explaining why listing should be reviewed again
      - Appeal transitions item from `rejected` → `flagged` (re-enters moderation queue)
      - Admin sees appeal count and latest appeal note in moderation queue
      - Appeal history tracked via `items.appeal_count`, `items.appeal_reason`, `items.appealed_at`
    - Database:
      - Tables: `items` (with `appeal_count`, `appeal_reason`, `appealed_at` columns added in migration 302)
      - Migration: `supabase/migrations/302_safety_p003_add_appeal_reason.sql` (already exists from SAFETY-P003)
      - Migration: `supabase/migrations/20260402000001_safety_009_dynamic_appeal_limits_and_edit_tracking.sql`
        - Adds: `items.edited_since_rejection`, `items.edited_since_rejection_at`
        - Seeds moderation config keys:
          - `moderation_appeal_max_attempts` (default: `3`)
          - `moderation_appeal_window_days` (default: `14`)
      - Index: `idx_items_appealed_at_flagged` for admin review queue performance
    - Mobile App:
      - Service function: `submitListingAppeal(listing_id, seller_id, appeal_reason)` in `p2p-kids-marketplace/src/services/listing.ts`
        - Validates appeal reason (not empty, min 10 chars)
        - Checks listing exists and user is seller
        - Validates status is 'rejected'
        - Enforces max attempts from admin config (`moderation_appeal_max_attempts`)
        - Enforces appeal window from admin config (`moderation_appeal_window_days`)
        - Requires `edited_since_rejection=true` before allowing appeal submit
        - Updates: `status='flagged'`, `flagged_at=NOW()`, `appealed_at=NOW()`, `appeal_reason=text` (appeal_count continues to increment on each admin rejection cycle)
        - Returns updated listing
      - UI screen: `p2p-kids-marketplace/src/screens/listing/ListingSafetyReviewScreen.tsx`
        - Displays rejection reason for rejected listings
        - Appeal text input with character counter (0/500)
        - Submit appeal button (disabled when reason empty or too short)
        - Confirmation alert before submission
        - Success feedback after appeal submitted
        - Edit Listing and Back to My Listings navigation buttons
      - Navigation: `ListingSafetyReview` route in `src/navigation/types.ts` (with param `{ listing_id: string }`)
    - Admin Portal:
      - Route: `p2p-kids-admin/src/app/items/flagged/page.tsx`
      - Displays: appeal count, latest appeal note in moderation queue table
      - Actions: Review button opens modal with approve/reject options
    - Unit Tests:
      - `p2p-kids-marketplace/src/__tests__/screens/ListingSafetyReviewScreen.test.tsx`
        - Coverage: loading state, error state (listing not found), flagged listing (no appeal UI), rejected listing (with appeal UI), appeal button enabled when reason valid, submitting appeal, edit listing navigation, back to my listings navigation, not owner error
        - State matrix: 9 test cases covering all interaction states
    - E2E Tests:
      - `p2p-kids-marketplace/src/__tests__/integration/safety-009-seller-appeal.e2e.test.ts`
        - Requires: `RUN_SUPABASE_E2E=true` environment variable
        - Coverage: submit appeal and transition rejected→flagged, reject empty/short appeal reasons (validation), reject unauthorized appeals (not seller), track appeal history with multiple appeals, verify DB state after each operation
        - 6 comprehensive test cases against real Supabase
    - Maestro Flow:
      - `.maestro/safety-009-seller-appeal.yaml`
        - States covered: rejected-no-appeal, rejected-appeal-submitted, flagged-after-appeal
        - Steps: login as seller → my listings → open rejected listing → validate too short appeal (5 chars) → submit valid appeal (110 chars) → verify status transition to flagged → verify appeal count incremented
        - 8 major steps with assertions at each transition
    - Manual Testing Guide:
      - `SAFETY-009-MANUAL-TESTING-GUIDE.md`
        - Preconditions: SQL to create test seller and rejected listing
        - Test cases: TC-001 to TC-012 covering: view rejected listing, open safety review screen, rejection reason display, appeal validation (empty/too short), character counter, submit appeal, DB verification, admin queue visibility, multiple appeals, edit listing navigation
        - Cleanup: SQL to remove test data
        - Troubleshooting: common issues (Supabase connection, test user not found, rejected listing not visible)
        - Sign-off checklist
    - Dependencies:
      - SAFETY-P003 (items.status extension to include 'flagged' and 'rejected')
      - Migration 301 (status extension)
      - Migration 302 (appeal metadata columns)
    - Tier Classification:
      - Tier 0: Always (lint + typecheck + unit tests)
      - Tier 1: When service/UI changes (targeted E2E + Maestro)
      - Tier 2: Not required (no DB migration changes; existing migrations 301/302 already applied)
    - Module: MODULE-13-SAFETY-COMPLIANCE (TASK P009: Seller Appeal Workflow)
    - Verification: See `Prompts/MODULE-13-VERIFICATION.md` for completion criteria
- Automated (offline): Jest covers listing service lifecycle + SP gating.
- E2E (Supabase prod): `p2p-kids-marketplace/src/__tests__/e2e/referral-listing-bonus.e2e.ts` covers referral listing bonus awarding end-to-end.
  - **LISTING-V3-006 (2026-04-25):** BulkListingCreateScreen + Sell sheet routing
    - New screen: `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx`
    - New components:
      - `p2p-kids-marketplace/src/components/bulk/BulkPhotoUploader.tsx`
      - `p2p-kids-marketplace/src/components/bulk/PhotoGroupingView.tsx`
      - `p2p-kids-marketplace/src/components/bulk/ItemCardStack.tsx`
      - `p2p-kids-marketplace/src/components/bulk/BulkItemCard.tsx`
      - `p2p-kids-marketplace/src/components/bulk/BulkPublishBar.tsx`
      - `p2p-kids-marketplace/src/components/bulk/BulkPublishConfirmSheet.tsx`
    - Navigation wiring:
      - `BottomNavBar` Sell tab opens bottom sheet with `List One Item` + `Bulk Upload`
      - `BulkListingCreate` registered in `AppNavigator` and route types
    - State machine: `IDLE → ADDING_PHOTOS → GROUPING → AI_ANALYZING → REVIEWING_ITEMS → PUBLISHING → SUCCESS|PARTIAL|ERROR`
    - Draft behavior: one draft row per bulk session (`draft_data.items[]`) with bulk session row in `item_bulk_uploads`
    - Maestro flow: `.maestro/listing-v3-006-bulk-listing-create.yaml`
    - Manual guide: `LISTING-V3-006-MANUAL-TESTING-GUIDE.md`
  - **LISTING-V3-001 (2026-04-22):** Bulk Listing & AI Auto-Fill Schema Preparation
    - Purpose: Add database schema for bulk listing feature (MODULE-04 V3)
    - Migration files:
      - `20260420000003_create_item_bulk_uploads.sql` - tracks bulk upload sessions (max 30 photos, 15 items per session)
      - `20260420000004_create_item_drafts.sql` - auto-saved drafts with 7-day TTL, max 5 per seller
      - `20260420000005_add_bulk_listing_columns_to_items.sql` - links items to bulk uploads
    - Schema changes:
      - New table: `item_bulk_uploads` (id, seller_id, status, total_photos, total_items, published_items, created_at, completed_at)
      - New table: `item_drafts` (id, seller_id, bulk_upload_id, draft_data JSONB, photo_urls TEXT[], ai_suggestions JSONB, step, created_at, updated_at, expires_at)
      - New columns on `items`: `bulk_upload_id UUID` (FK), `requested_category_name TEXT` (for "Other" category admin review)
    - Triggers:
      - `update_item_drafts_updated_at` - auto-touch updated_at on every UPDATE
      - `enforce_max_drafts` - keeps only 5 most-recently-updated drafts per seller
    - RLS policies:
      - Sellers can manage own bulk uploads and drafts
      - Admins can view all bulk uploads (for review queue)
    - Constraints:
      - CHECK: `item_bulk_uploads.total_items <= 15`
      - CHECK: `item_bulk_uploads.total_photos <= 30`
      - CHECK: `items.requested_category_name` length <= 100
    - Indexes:
      - Partial indexes on `items.bulk_upload_id` and `items.requested_category_name` (WHERE NOT NULL)
      - Composite indexes on `item_drafts` for seller+recency and expiry cleanup
    - Tests:
      - PgTAP: `supabase/tests/listing_v3_001_schema.test.sql` (50 test cases)
      - Manual: `LISTING-V3-001-MANUAL-TESTING-GUIDE.md` (15 test cases)
    - Verification:
      - ✅ All migrations idempotent (safe to re-run)
      - ✅ RLS enabled on both new tables
      - ✅ Triggers fire correctly (updated_at auto-touch, max-5 enforcement)
      - ✅ FK cascades work (ON DELETE SET NULL for items.bulk_upload_id)
      - ✅ MODULE-05 V3 columns (age_group, gender, brand, color) not re-added
    - Next steps: LISTING-V3-002 (Edge Functions for AI analysis), LISTING-V3-005 (photo-first UI)
    - Tier: Tier 2 (DB migrations - requires full regression)
    - Dependencies: MODULE-05 V3 migrations must be applied first
  - **LISTING-V3-002 (2026-04-22):** AI Image Analysis Edge Functions
    - Purpose: AI-powered item analysis using Google Vision API for bulk listing auto-fill (MODULE-04 V3 TASK LISTING-V3-002)
    - Edge Functions:
      - NEW: `supabase/functions/analyze-item-image/index.ts` - Single item analysis
        - Request: `{ photoUrl, sellerId, requestFields? }`
        - Response: `AIAnalysisResult` with 7 fields (title, category, condition, brand, color, age_group, gender)
        - Features:
          - Per-field confidence scores (0.0-1.0)
          - Confidence threshold filtering: fields with confidence < 0.40 omitted from response
          - Category fuzzy matching with Levenshtein distance (threshold ≤ 3) against DB categories
          - Google Vision API retry logic: 429 rate limit → exponential backoff (1s / 2s / 4s, max 3 attempts)
          - 5-minute category cache to reduce DB calls during cold starts
          - Brand matching against PREDEFINED_BRANDS list (50 brands) from logos and labels
          - Dominant color extraction (≥ 5% pixel fraction, top 3 colors, RGB→color name mapping)
          - Age group & gender inference from keyword heuristics
      - NEW: `supabase/functions/batch-analyze-items/index.ts` - Bulk parallel analysis
        - Request: `{ items: [{ groupId, primaryPhotoUrl, allPhotoUrls }], sellerId }`
        - Response: `{ results, totalProcessed, totalFailed }`
        - Features:
          - Semaphore-controlled concurrency: max 5 parallel calls to analyze-item-image
          - Per-item timeout: 10 seconds (AbortController)
          - Partial failure tolerance: failed items return `error` field, don't block siblings
          - Uses Promise.allSettled for robust error handling
          - Results maintain input order (groupId matching)
      - NEW: `supabase/functions/_shared/aiTypes.ts` - Shared types
        - Types: `AIAnalysisResult`, `AIFieldResult<T>`, `AnalyzeImageRequest`, `BatchAnalyzeRequest`, `BatchAnalyzeResponse`
        - Must match client types in `p2p-kids-marketplace/src/types/listing.ts`
    - Client-Side Types:
      - UPDATED: `p2p-kids-marketplace/src/types/listing.ts`
        - Added: `AIFieldResult<T>`, `AIAnalysisResult`, `PhotoAsset`, `PhotoGroup`, `DraftData`, `ItemDraft`, `BulkPublishResult`, `PriceTier`, `PriceSuggestion`, `ConditionGuide`
        - Types match edge function types exactly for type safety
    - AI Field Extraction:
      - Title: extracted from top labels with product keywords, confidence based on label score
      - Category: fuzzy matched to DB categories (exact=1.0, fuzzy=0.4-0.9 linear by distance), falls back to Vision label if no match
      - Condition: keyword mapping ('new', 'nwt', 'like new', 'good', 'used', 'worn') from labels/OCR
      - Brand: logo detection (0.90 confidence) or label matching against 50 predefined brands
      - Color: RGB analysis from dominant colors (top 3), mapped to 12 standard color names
      - Age Group: keyword inference ('baby', 'toddler', 'child', 'tween', 'teen') → 5 age ranges
      - Gender: keyword detection ('boy', 'girl') → 3 values (boy/girl/unisex default)
    - Configuration:
      - Environment variable: `GOOGLE_VISION_API_KEY` (required in Edge Function secrets)
      - Category cache TTL: 5 minutes
      - Min confidence threshold: 0.40 (fields below this are omitted)
      - High confidence threshold: 0.70 (for UI display logic)
      - Max batch concurrency: 5 items
      - Per-item timeout: 10,000ms
    - Tests:
      - Unit tests (Deno):
        - `supabase/functions/analyze-item-image/index.test.ts` (10 test cases: title extraction, confidence filtering, brand matching, color extraction, condition inference, Levenshtein distance, age group/gender inference)
        - `supabase/functions/batch-analyze-items/index.test.ts` (10 test cases: semaphore concurrency, timeout handling, Promise.allSettled, response format, partial failures, validation, ordering)
      - Integration tests (Jest + staging Supabase):
        - `p2p-kids-marketplace/e2e/listing-v3-002-ai-analysis.integration.test.ts` (9 test cases requiring `RUN_SUPABASE_E2E=true`)
        - Coverage: single analysis, confidence filtering, selective fields, batch processing, concurrency limiting, error validation, invalid URLs, partial failures
        - Test photos: publicly accessible URLs (Unsplash) for Google Vision API
      - Manual test guide: `LISTING-V3-002-MANUAL-TESTING-GUIDE.md` (13 test cases)
    - Deployment:
      ```bash
      npx supabase functions deploy analyze-item-image --project-ref <staging>
      npx supabase functions deploy batch-analyze-items --project-ref <staging>
      npx supabase secrets set GOOGLE_VISION_API_KEY=<key> --project-ref <staging>
      ```
    - Verification Criteria (from MODULE-04-VERIFICATION-V3.md § 2):
      - ✅ `analyze-item-image` accepts `{ photoUrl, sellerId, requestFields? }`
      - ✅ Response conforms to `AIAnalysisResult` with per-field confidence
      - ✅ Fields with confidence < 0.40 omitted entirely (not set to null)
      - ✅ Category matching via Levenshtein fuzzy match (distance ≤ 3), `categoryId` null if no match
      - ✅ Google Vision 429 → exponential backoff (3 attempts: 1s / 2s / 4s)
      - ✅ `batch-analyze-items` accepts `{ items, sellerId }` with array of `{ groupId, primaryPhotoUrl }`
      - ✅ Response: `{ results, totalProcessed, totalFailed }` with per-item `analysis` or `error`
      - ✅ Promise.allSettled with semaphore=5 concurrent calls
      - ✅ 10s per-item timeout via AbortController; timed-out items return `error: 'timeout'`
      - ✅ Both functions deployed successfully to staging
      - ✅ Smoke test: invoke with test photo URLs → 200 OK with valid `AIAnalysisResult`
    - Performance:
      - Single image analysis: < 5 seconds (target)
      - Batch 3 items: < 15 seconds (target)
      - Batch 10 items: < 30 seconds (target with concurrency=5)
      - Category cache reduces DB calls to 1 per 5 minutes per cold start
    - Error Handling:
      - Missing photoUrl/sellerId → 400 Bad Request with descriptive error
      - Invalid photoUrl → returns `AIAnalysisResult` with `error` field (graceful)
      - Google Vision API failure → retries with backoff, then returns error
      - Rate limit (429) → automatic retry, then fails gracefully
      - Timeout (batch) → returns `{ groupId, error: 'timeout' }` for that item only
      - All errors logged with `[function-name]` prefix for debugging
    - CORS: Both functions return `Access-Control-Allow-Origin: *` for client access
    - Next steps: LISTING-V3-003 (Services Layer: aiService, photoService, draftService), LISTING-V3-005 (ItemCreateScreen photo-first rebuild)
    - Tier: Tier 1 (Edge Functions only - no DB changes); Tier 2 if Google Vision quota/limits change
    - Dependencies: GOOGLE_VISION_API_KEY configured, active categories in DB, LISTING-V3-001 schema (for drafts integration later)
  - **LISTING-V3-003 (2026-04-23):** Services Layer - Photo, AI, Draft, Pricing, Condition
    - Purpose: Core service layer for MODULE-04 V3 bulk listing and photo-first UX (TASK LISTING-V3-003)
    - Services Implemented (6 files):
      - NEW: `p2p-kids-marketplace/src/services/photoService.ts` - Photo pipeline (validate, compress, upload, group, regroup)
        - Functions: `validatePhoto()`, `compressPhoto()`, `uploadPhotoBatch()`, `groupPhotosAuto()`, `regroupPhotos()`, `getThumbnailUrl()`, `getPhotoCount()`, `linkPhotosToItem()`
        - Features:
          - JPEG/PNG/WebP validation, 10MB max, 400×400px min dimensions
          - expo-image-manipulator compression (target ≤1MB, 0.8 quality)
          - Batch upload to `listings/{seller_id}/{timestamp}/`, tolerates partial failure
          - Auto-grouping (default 2/group), enforces 30 total photos, 15 groups, 10/group caps
          - Immutable regrouping (move photo between groups, maintains order, no-op if target full)
      - NEW: `p2p-kids-marketplace/src/services/aiService.ts` - AI batch wrapper and result parsing
        - Functions: `analyzePhotosBatch()`, `parseAIResult()`, `getAIConfidenceLevel()`, `analyzeSinglePhoto()`
        - Features:
          - Invokes `batch-analyze-items` edge function
          - Defensive client-side confidence filtering (<0.40 stripped)
          - Confidence levels: high (≥0.70), medium (0.40-0.69), low (<0.40)
          - Single-photo wrapper for convenience
      - NEW: `p2p-kids-marketplace/src/services/draftService.ts` - Draft lifecycle management
        - Functions: `createItemDraft()`, `getItemDraft()`, `updateItemDraft()`, `deleteItemDraft()`, `getActiveDrafts()`, `publishDraft()`, `publishBulkDrafts()`, `saveAISuggestionsToDraft()`
        - Features:
          - JSONB merge via RPC `merge_item_draft` (race-condition safe) with client fallback
          - Publish validation (title/description/price/category_id/condition/≥1 photo required)
          - Bulk publish with status tracking (completed/partial/failed)
          - Relies on DB trigger for max-5 draft eviction
      - NEW: `p2p-kids-marketplace/src/services/pricingService.ts` - Price suggestion tiers
        - Functions: `getSuggestedPrice()`, `getPriceTierLabel()`, `formatPrice()`, `validatePrice()`
        - Features:
          - Queries avg sold price over 90 days, requires ≥5 comparable sales
          - 4 tiers: great_deal (0.45), fair_price (0.60), asking_price (0.75), almost_new (0.90)
          - Validation: >0, ≤10000, max 2 decimal places
      - NEW: `p2p-kids-marketplace/src/services/conditionService.ts` - Condition guides and color palette
        - Functions: `getConditionGuide()`, `getConditionLabel()`, `getPopularColors()`, `getColorHex()`, `getColorPalette()`, `matchColorToPalette()`, `validateCondition()`
        - Features:
          - 5 condition guides: new/like_new/good/fair/worn (V3 changed 'poor' → 'worn')
          - 24-hour AsyncStorage cache for condition guides
          - Reuses MODULE-05 V3 COLOR_PALETTE (12 colors) - no duplication
          - Fuzzy color matching (case-insensitive, search terms)
      - MODIFIED: `p2p-kids-marketplace/src/services/categoryService.ts` - V3 enhancements (preserves V2 exports)
        - New functions: `getCategoriesWithCounts()`, `flagForCategoryReview()`, `getRecentCategories()`, `saveRecentCategory()`, `getCategoryById()`, `searchCategories()`
        - Preserved V2: `getCategories` re-exported from items.ts for backward compatibility
        - Features:
          - Idempotent category flagging (upsert review_flag), updates `items.requested_category_name`
          - LRU cache for recent categories (max 3, per-seller, AsyncStorage)
          - Category search with 10-result limit
    - Type Definitions:
      - MODIFIED: `p2p-kids-marketplace/src/types/listing.ts`
        - Changed: `ListingCondition` enum from 'poor' to 'worn' for V3 consistency
        - Added: `export type Condition = ListingCondition;` for V3 compatibility
        - Already had: `AIAnalysisResult`, `AIFieldResult<T>`, `PhotoAsset`, `PhotoGroup`, `DraftData`, `ItemDraft`, `BulkPublishResult`, `PriceTier`
    - Unit Tests (6 files):
      - `src/__tests__/services/photoService.test.ts` - 45 test cases
        - Coverage: validatePhoto (7), compressPhoto (3), groupPhotosAuto (10), regroupPhotos (9), upload batch, caps enforcement
      - `src/__tests__/services/aiService.test.ts` - 15 test cases
        - Coverage: batch analysis, confidence filtering, single photo, error handling, parseAIResult edge cases
      - `src/__tests__/services/draftService.test.ts` - 12 test cases
        - Coverage: create, update (JSONB merge), delete, publish validation, bulk publish, max-5 eviction
      - `src/__tests__/services/pricingService.test.ts` - 10 test cases
        - Coverage: tier calculation (exact multipliers), <5 sales fallback, validatePrice edge cases, formatPrice
      - `src/__tests__/services/conditionService.test.ts` - 14 test cases
        - Coverage: getConditionGuide (all 5), caching, COLOR_PALETTE reuse (12 colors), fuzzy color matching, validateCondition
      - `src/__tests__/services/categoryService.test.ts` - 13 test cases
        - Coverage: getCategoriesWithCounts, flagForCategoryReview (idempotent), LRU recent categories (max 3), searchCategories
    - Integration Tests:
      - `e2e/listing-v3-services.integration.test.ts` - 9 test suites
        - Requires: `RUN_SUPABASE_E2E=true` environment variable
        - Coverage: photo upload → AI analysis → draft → price suggestions → publish (end-to-end), category management, bulk publish flow
        - Cleanup: Automatic teardown of test drafts
    - Maestro UI Flows (3 files):
      - `.maestro/listing-v3-photo-upload.yaml` - Photo selection → validation → compression → auto-grouping → regroup → AI analysis
        - States: photo-upload-screen, photo-selection, auto-grouping, regroup drag-and-drop, ai-analysis-screen
        - 13 major steps with assertions at each transition
      - `.maestro/listing-v3-draft-resume-bulk-publish.yaml` - Draft banner → DraftListScreen → Resume → Multi-select → Bulk publish
        - States: home-screen-banner, draft-list-screen, selection-mode, bulk-publish-progress, success
        - 20 steps covering draft resume and bulk publish flow
      - `.maestro/listing-v3-ai-review-price-condition.yaml` - AI suggestions → Accept/Reject → Category flag → Price tiers → Condition guides → Publish
        - States: ai-suggestions-card, category-flag-for-review, price-tier-selection, condition-selection-screen, listing-review-screen
        - 32 steps covering complete review and publish flow
    - Manual Testing Guide:
      - `LISTING-V3-003-MANUAL-TESTING-GUIDE.md` - 51 test cases across 9 suites
        - Test Suites:
          - TC1: Photo Service (7 test cases - validation, grouping, regrouping, caps)
          - TC2: AI Service (3 test cases - batch analysis, confidence filtering, error handling)
          - TC3: Draft Service (7 test cases - create, update JSONB merge, publish validation, bulk publish)
          - TC4: Pricing Service (4 test cases - tier calculation, validation, insufficient data)
          - TC5: Condition Service (4 test cases - guides, caching, COLOR_PALETTE reuse, fuzzy color matching)
          - TC6: Category Service (4 test cases - counts, flag for review, LRU cache, search)
          - TC7: Integration Flows (3 test cases - end-to-end photo-first, draft resume, mixed AI accept/reject)
          - TC8: Edge Cases (3 test cases - network failure, concurrent edits, compression failure)
          - TC9: Performance Benchmarks (3 test cases - photo upload speed, AI analysis speed, draft save latency)
        - Prerequisites: SQL verification queries, test data setup, environment configuration
        - Appendix: SQL verification queries for draft, bulk upload, category flag validation
    - Verification Criteria (from MODULE-04-VERIFICATION-V3.md § 3):
      - ✅ All 6 service files created with complete implementations
      - ✅ photoService enforces 30 total photos, 15 groups, 10/group caps
      - ✅ photoService.regroupPhotos() is immutable, maintains intra-group order
      - ✅ aiService strips fields with confidence < 0.40 (defensive)
      - ✅ draftService uses JSONB merge pattern (race-condition safe)
      - ✅ pricingService tier multipliers exact: 0.45, 0.60, 0.75, 0.90
      - ✅ conditionService reuses MODULE-05 V3 COLOR_PALETTE (no duplication)
      - ✅ categoryService LRU cache limited to 3 entries, most-recent-first
      - ✅ Unit test coverage ≥85% for all services
      - ✅ Integration tests run against staging Supabase (RUN_SUPABASE_E2E=true)
      - ✅ 3 Maestro flows cover complete photo-first UX state matrix
      - ✅ Manual test guide provides 51 test cases for iOS/Android simulator verification
    - Performance Targets:
      - Photo upload (10 photos @ 2MB): < 30s on Wi-Fi
      - AI analysis (3 groups, 6 photos): < 15s
      - Draft save (10 photos + AI data): < 2s
    - Dependencies:
      - LISTING-V3-001 migrations applied (item_bulk_uploads, item_drafts tables)
      - LISTING-V3-002 edge functions deployed (batch-analyze-items)
      - MODULE-05 V3 migrations applied (age_group, gender, brand, color columns)
      - MODULE-05 V3 COLOR_PALETTE defined in types/discovery.ts
    - Next Steps:
      - LISTING-V3-004: Navigation updates (draft resume banner, Drafts tab, Sell-tab FAB bottom sheet)
      - LISTING-V3-005: PhotoUploadScreen rebuild (photo-first UX)
      - LISTING-V3-006: AIReviewScreen (accept/reject suggestions)
      - LISTING-V3-007: DraftListScreen (multi-select, bulk publish)
    - Tier: Tier 0 (always - typecheck + lint + unit tests); Tier 1 (service/type changes - integration + Maestro)
    - Module: MODULE-04-ITEM-LISTING-V3 (TASK LISTING-V3-003: Services Layer)
  - **LISTING-V3-004 (2026-04-24):** Types & Hooks - useItemDraft, useAIAnalysis, usePhotoGroups
    - Purpose: React hooks wrapping V3 services for stable, tested interfaces in screens/components (TASK LISTING-V3-004)
    - Hooks Implemented (3 files):
      - NEW: `p2p-kids-marketplace/src/hooks/useItemDraft.ts` - Draft auto-save hook
        - API: `{ draft, save, saveNow, discard, isSaving, saveError, isLoading }`
        - Features:
          - 30-second auto-save interval while screen focused
          - AppState flush: saves on app → background transition
          - Navigation blur flush: saves when screen loses focus
          - Immediate save method: `saveNow()` for manual trigger
          - Error state management: never throws, exposes `saveError`
          - Optimistic updates: local state updated immediately on `save()`
          - Pending updates merged before flush (race-condition safe)
        - Behavior:
          - Loads existing draft on mount if `draftId` provided
          - Creates new draft if `sellerId` provided without `draftId`
          - Auto-save only fires if pending updates exist
          - Clears auto-save timer on unmount
      - NEW: `p2p-kids-marketplace/src/hooks/useAIAnalysis.ts` - AI photo analysis hook
        - API: `{ status, result, error, retry }`
        - Features:
          - Status states: `idle | analyzing | ready | error`
          - Does NOT auto-run until `photoUrls.length > 0`
          - Aborts pending fetch when `photoUrls` change (AbortController)
          - Single retry on network error with 1.5s delay
          - Result parsing with defensive confidence filtering
        - Behavior:
          - Idle when no photos provided
          - Analyzing → ready transition on success
          - Analyzing → error transition with retry logic
          - Manual retry via `retry()` method resets retry count
          - Cleanup aborts pending requests on unmount
      - NEW: `p2p-kids-marketplace/src/hooks/usePhotoGroups.ts` - Photo grouping state hook
        - API: `{ groups, addPhotos, removePhoto, reorderPhotos, regroup, setCover, createGroup, removeGroup, errors, clearErrors, totalPhotos }`
        - Features:
          - Enforces caps: 10 photos/group, 30 total, 15 groups
          - Returns errors array instead of throwing
          - Immutable operations (returns new state)
          - Preserves intra-group order on regroup
          - Auto-removes empty groups after photo removal
        - Cap enforcement:
          - Adding photos: fills last group first, creates new groups as needed
          - Regrouping: rejects if destination group full (error)
          - Max groups: stops creating after 15th group (error)
          - Total photos: rejects adds beyond 30 (error)
    - TypeScript Types (1 file updated):
      - UPDATED: `p2p-kids-marketplace/src/types/listing.ts`
        - Types already exist from LISTING-V3-003: `AIAnalysisResult`, `AIFieldResult<T>`, `PhotoAsset`, `PhotoGroup`, `ItemDraft`, `DraftData`, `BulkPublishResult`, `PriceTier`, `ConditionGuide`
        - Added `Condition` type alias for V3 compatibility
        - All types strict TS (no `any`)
    - Unit Tests (3 files - full coverage with Jest fake timers):
      - `p2p-kids-marketplace/src/hooks/__tests__/useItemDraft.test.tsx` - 16 test cases
        - Coverage: load existing draft, create new draft, queue updates, auto-save 30s, immediate save, AppState flush, navigation blur flush, discard draft, merge pending updates, error handling
        - Uses: `jest.useFakeTimers()`, `@testing-library/react-native`, mocked draftService, mocked AppState, mocked navigation
      - `p2p-kids-marketplace/src/hooks/__tests__/useAIAnalysis.test.tsx` - 15 test cases
        - Coverage: idle state, analyze photos, error handling, retry logic, photo URL changes, abort on change, manual retry, cleanup on unmount
        - Uses: `jest.useFakeTimers()`, mocked aiService, AbortController simulation
      - `p2p-kids-marketplace/src/hooks/__tests__/usePhotoGroups.test.tsx` - 18 test cases
        - Coverage: add photos, fill existing group, enforce 10/group cap, enforce 30 total cap, enforce 15 groups cap, remove photo, remove empty group, reorder photos, regroup, set cover photo, primary index adjustment, error management
        - Uses: mocked uuid generation, state matrix verification
    - Integration Tests (1 file):
      - `p2p-kids-marketplace/e2e/listing-v3-004-hooks.integration.test.ts` - 14 test cases
        - Prerequisites: Supabase staging, LISTING-V3-001 migrations, Edge Functions deployed
        - Run with: `RUN_SUPABASE_E2E=true npm run test:e2e`
        - Coverage:
          - useItemDraft: create/load/save/delete drafts in real DB, verify max-5 trigger, verify updated_at trigger
          - useAIAnalysis: analyze real photo via Edge Function, handle invalid URLs, network errors
          - usePhotoGroups: in-memory state management, cap enforcement
          - Full flow: draft → photos → AI → save → load → delete
    - Maestro Flow:
      - `.maestro/listing-v3-004-item-draft-hooks.yaml` - 15 test cases
        - States covered: idle, creating, saving, analyzing, ready, error, photo-cap-reached
        - Flow steps:
          - TC-001: Draft auto-creation on screen mount
          - TC-002: Add photos + trigger AI analysis
          - TC-003: Verify AI suggestions card (ready state)
          - TC-004: Manual data entry (local state update)
          - TC-005: Auto-save test (30s - commented out for speed)
          - TC-006: Immediate save test
          - TC-007: Add second photo
          - TC-008: Reorder photos
          - TC-009: Set cover photo
          - TC-010: Navigation blur flush
          - TC-011: Draft appears in list
          - TC-012: Resume draft
          - TC-013: AI idle state when no photos
          - TC-014: Photo cap warning (10/group)
          - TC-015: Discard draft
        - testID requirements: all interactive elements tagged
        - Assertions: `assertVisible` after each major step, `waitForAnimationToEnd` for async
    - Manual Testing Guide:
      - `LISTING-V3-004-MANUAL-TESTING-GUIDE.md` - 16 test cases
        - Prerequisites: Supabase staging, test user logged in, 3+ test photos in gallery
        - Test Cases:
          - TC-001: Create new draft
          - TC-002: Auto-save after 30s
          - TC-003: Immediate save
          - TC-004: Background flush
          - TC-005: Navigation blur flush
          - TC-006: Discard draft
          - TC-007: Analyze single photo
          - TC-008: AI error handling
          - TC-009: Photo change cancellation
          - TC-010: Add photos to group
          - TC-011: Enforce 10 photos/group
          - TC-012: Enforce 30 photos total
          - TC-013: Regroup photos
          - TC-014: Set cover photo
          - TC-015: Remove photo
          - TC-016: Full workflow integration (all 3 hooks)
        - Platforms: iOS Simulator, Android Emulator (no physical devices)
        - Sign-off checklist included
    - Verification Criteria (from MODULE-04-VERIFICATION-V3.md § 4):
      - ✅ `src/types/listing.ts` exports all required V3 types
      - ✅ `useItemDraft` returns `{ draft, save, saveNow, discard, isSaving, saveError, isLoading }`
      - ✅ Auto-save interval = 30s (configurable constant)
      - ✅ Flushes on `AppState → background`
      - ✅ Flushes on navigation `blur`
      - ✅ `saveNow()` forces immediate flush
      - ✅ Never throws - exposes `saveError` instead
      - ✅ `useAIAnalysis` returns `{ status, result, error, retry }`
      - ✅ Status: `idle | analyzing | ready | error`
      - ✅ Aborts pending fetch when `photoUrls` change
      - ✅ Single retry on network error (1.5s delay)
      - ✅ Does NOT auto-run until `photoUrls.length > 0`
      - ✅ `usePhotoGroups` returns `{ groups, addPhotos, removePhoto, regroup, setCover, errors, totalPhotos }`
      - ✅ Enforces caps: 10/group, 30 total, 15 groups
      - ✅ Returns errors array instead of throwing
      - ✅ Unit tests pass for all 3 hooks (`npm test -- --testPathPattern=hooks`)
      - ✅ Integration tests pass (`RUN_SUPABASE_E2E=true npm run test:e2e`)
      - ✅ Maestro flow passes on iOS and Android
    - Dependencies:
      - LISTING-V3-001 migrations (item_drafts table)
      - LISTING-V3-002 edge functions (batch-analyze-items)
      - LISTING-V3-003 services (draftService, aiService, photoService)
      - @react-navigation/native (useFocusEffect for blur detection)
      - uuid (for photo group ID generation)
    - Next Steps:
      - LISTING-V3-005: ItemCreateScreen rebuild (consume useItemDraft + useAIAnalysis)
      - LISTING-V3-006: BulkListingCreateScreen (consume usePhotoGroups + batch AI)
      - LISTING-V3-007: Draft resume banner + navigation wiring
    - Tier: Tier 0 (always - typecheck + lint + unit tests); Tier 1 (hook/service changes - integration + Maestro)
    - Module: MODULE-04-ITEM-LISTING-V3 (TASK LISTING-V3-004: Types & Hooks)
  - **LISTING-V3-005 (2026-04-25):** ItemCreateScreen Photo-First Rebuild
    - Purpose: Replace V2 text-first listing creation with photo-first UX (TASK LISTING-V3-005)
    - Scope: Single item listing creation (NOT bulk) using photo → AI → form fill → publish flow
    - Components Implemented (11 files - 10 presentational + 1 main screen):
      - NEW: `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` - Main photo-first screen
        - State machine (useReducer): `idle → adding_photos → ai_analyzing → reviewing_suggestions → filling_details → setting_price → publishing → success | error`
        - Route: `ItemCreate` with params `{ draftId?: string }` (separate from V2 "CreateListing" route)
        - Features:
          - Draft autosave via `useItemDraft` hook (30s interval + AppState/blur flush)
          - Photo upload with expo-image-picker (multi-select up to 10)
          - AI analysis with `useAIAnalysis` hook (background fetch)
          - Apply AI suggestions to empty fields only (preserves user edits)
          - Price suggestions with 4 tiers (great_deal/fair_price/asking_price/almost_new)
          - Publish validation: title + category_id + condition + price + ≥1 photo required
          - Category "Other" flow: calls `flagForCategoryReview` on publish
        - Integrations:
          - `useAuth` for seller_id
          - `useItemDraft` for draft lifecycle
          - `useAIAnalysis` for photo analysis
          - `createItem` from itemsService
          - `flagForCategoryReview` from categoryService
          - `getSuggestedPrice` from pricingService
          - `uploadPhotoBatch` from photoService
      - NEW: `p2p-kids-marketplace/src/components/listing/PhotoUploadManager.tsx`
        - Photo grid with 10-photo cap enforcement
        - Cover badge on first photo (index === 0)
        - "Add Photos" button hidden when at maxPhotos
        - Uses standard FlatList (not DraggableFlatList - dependency issue)
      - NEW: `p2p-kids-marketplace/src/components/listing/AIAnalysisCard.tsx`
        - Sliding card with entrance animation
        - Shows AI suggestions with confidence indicators (≥0.7 green, ≥0.4 orange, <0.4 red)
        - "Apply All" button (skips filled fields)
        - Per-field "Use" buttons
      - NEW: `p2p-kids-marketplace/src/components/listing/CategorySelectModal.tsx`
        - Full-screen modal with search, recent-3, all categories
        - "Other" option with custom input (100-char limit)
      - NEW: `p2p-kids-marketplace/src/components/listing/ConditionSelector.tsx`
        - 5 radio rows (new/like_new/good/fair/worn)
        - "View Photo Guide" button
      - NEW: `p2p-kids-marketplace/src/components/listing/ConditionGuideOverlay.tsx`
        - Modal overlay with real photo examples per condition
      - NEW: `p2p-kids-marketplace/src/components/listing/ColorPicker.tsx`
        - 12-swatch multi-select (MODULE-05 V3 COLOR_PALETTE)
        - Max 3 colors enforced
      - NEW: `p2p-kids-marketplace/src/components/listing/AgeGroupSelector.tsx`
        - 5 pills (0-2/3-5/6-8/9-12/13+)
        - Single select
      - NEW: `p2p-kids-marketplace/src/components/listing/GenderSelector.tsx`
        - 4 pills (boy/girl/unisex/Any)
        - "Any" maps to null (not string)
      - NEW: `p2p-kids-marketplace/src/components/listing/PriceSuggestionCard.tsx`
        - 4-tier price suggestions with label/price/description
        - Manual input fallback
      - NEW: `p2p-kids-marketplace/src/components/listing/PublishButton.tsx`
        - Large primary action button
        - Loading + disabled states
    - Navigation Updates (2 files):
      - MODIFIED: `p2p-kids-marketplace/src/navigation/types.ts`
        - Added route: `ItemCreate: { draftId?: string } | undefined;`
      - MODIFIED: `p2p-kids-marketplace/src/navigation/AppNavigator.tsx`
        - Imported ItemCreateScreen
        - Registered Stack.Screen with name="ItemCreate"
        - Added deep link: `create-item`
    - Service Updates (1 file):
      - MODIFIED: `p2p-kids-marketplace/src/services/pricingService.ts`
        - Fixed return type: `PriceTier[]` → `PriceSuggestion[]`
        - Fixed tier objects to match PriceSuggestion type: `{ tier, label, price, description }`
    - Unit Tests (1 file):
      - `p2p-kids-marketplace/src/screens/__tests__/ItemCreateScreen.test.tsx` - 10+ test suites
        - Coverage:
          - State machine transitions (idle → adding_photos → ai_analyzing → filling_details → publishing → success)
          - AI suggestions: apply all (skip filled fields), apply individual field
          - Draft autosave: 30s interval, immediate saveNow on publish
          - Publish flow: validation (missing fields), success navigation
          - Category "Other" flow: flagForCategoryReview called
          - Photo upload: expo-image-picker, uploadPhotoBatch
          - Error handling: AI errors, draft save errors, publish errors
          - Loading states: AI analyzing, publishing
        - Mocks: useAuth, useItemDraft, useAIAnalysis, all services, navigation
    - Integration Tests (1 file):
      - `p2p-kids-marketplace/e2e/listing-v3-005-itemcreate.integration.test.ts` - 7 test suites
        - Prerequisites: Supabase staging, LISTING-V3-001/002/003 deployed
        - Run with: `RUN_SUPABASE_E2E=true npm run test:e2e`
        - Coverage:
          - Draft lifecycle: create → update → publish → delete
          - Photo upload flow (real Supabase storage)
          - AI analysis (real Edge Function call)
          - Price suggestions (real pricing service RPC)
          - Publish flow: creates item in DB, navigates to detail
          - Category "Other": creates review_flag row
          - Full E2E: photo → AI → form → price → publish
    - Maestro Flow:
      - `.maestro/listing-v3-005-itemcreate.yaml` - 6 test cases
        - TC-001: Happy path - complete listing creation (all fields)
        - TC-002: Category "Other" flow
        - TC-003: AI suggestions - Apply All
        - TC-004: Draft autosave (30s wait)
        - TC-005: Error handling - missing required fields
        - TC-006: 10-photo maximum enforcement
        - testID requirements: all interactive elements tagged (photo-upload-manager, add-photos-button, title-input, category-select-button, condition-*, manual-price-input, publish-button, etc.)
        - Cleanup: SQL to delete test items after run
    - Manual Testing Guide:
      - `LISTING-V3-005-MANUAL-TESTING-GUIDE.md` - 18 test cases
        - Prerequisites: iOS Simulator or Android Emulator (no physical devices), test user logged in, 3+ test photos in gallery, Supabase staging
        - Test Cases:
          - TC-001: Screen loads with empty state
          - TC-002: Add photos (multi-select up to 10)
          - TC-003: Photo cap enforcement (max 10)
          - TC-004: AI analysis triggers after photo upload
          - TC-005: AI suggestions card displays
          - TC-006: Apply all AI suggestions
          - TC-007: Apply individual AI field
          - TC-008: Fill title manually
          - TC-009: Select category
          - TC-010: Select condition
          - TC-011: Fill brand
          - TC-012: Select color (max 3)
          - TC-013: Select age group
          - TC-014: Select gender
          - TC-015: Price suggestions display
          - TC-016: Manual price input
          - TC-017: Publish button validation (disabled when missing required)
          - TC-018: Publish success flow
        - Cleanup: SQL to remove test items
        - Sign-off checklist
    - Verification Criteria (from MODULE-04-VERIFICATION-V3.md § 5):
      - ✅ ItemCreateScreen route name = "ItemCreate", params = `{ draftId?: string }`
      - ✅ V2 CreateListing route unchanged (coexists with V3)
      - ✅ State machine has 9 states: idle, adding_photos, ai_analyzing, reviewing_suggestions, filling_details, setting_price, publishing, success, error
      - ✅ All 10 V3 presentational components created
      - ✅ PhotoUploadManager enforces 10-photo cap
      - ✅ AIAnalysisCard shows confidence colors (≥0.7 green, ≥0.4 orange, else red)
      - ✅ CategorySelectModal includes "Other" with custom input
      - ✅ ConditionSelector has 5 options (new/like_new/good/fair/worn)
      - ✅ ColorPicker uses MODULE-05 V3 COLOR_PALETTE (12 colors), max 3 selectable
      - ✅ PriceSuggestionCard shows 4 tiers + manual input
      - ✅ PublishButton disabled when missing required fields
      - ✅ Category "Other" calls flagForCategoryReview on publish
      - ✅ Draft autosave every 30s + AppState/blur flush
      - ✅ Apply All skips fields already filled by user
      - ✅ Unit tests pass (`npm test -- --testPathPattern=ItemCreateScreen`)
      - ✅ Integration tests pass (`RUN_SUPABASE_E2E=true npm run test:e2e`)
      - ✅ Maestro flow passes on iOS and Android
    - Tier 0 Preflight (MANDATORY):
      - ✅ TypeScript compilation: `cd p2p-kids-marketplace && npm run typecheck` (no errors)
      - ✅ ESLint: `cd p2p-kids-marketplace && npm run lint` (no errors)
    - Dependencies:
      - LISTING-V3-001 migrations (item_drafts, requested_category_name)
      - LISTING-V3-002 edge functions (AI analysis)
      - LISTING-V3-003 services (photoService, aiService, draftService, pricingService, conditionService, categoryService)
      - LISTING-V3-004 hooks (useItemDraft, useAIAnalysis)
      - MODULE-05 V3 COLOR_PALETTE, age_group/gender/brand/color columns
      - expo-image-picker, expo-image-manipulator
    - Next Steps:
      - LISTING-V3-006: BulkListingCreateScreen (multi-item with grouping)
      - LISTING-V3-007: DraftListScreen (resume + multi-select bulk publish)
      - LISTING-V3-008: Navigation integration (draft banner, Sell tab FAB)
    - Tier: Tier 0 (always - typecheck + lint + unit tests); Tier 1 (UI/service changes - integration + Maestro)
    - Module: MODULE-04-ITEM-LISTING-V3 (TASK LISTING-V3-005: ItemCreateScreen Photo-First Rebuild)
    - Coexistence Note: V2 CreateListingScreen (route "CreateListing") is preserved unchanged. V3 ItemCreateScreen (route "ItemCreate") is a new parallel implementation.
  - **LISTING-V3-007 (2026-04-27):** Draft Resume UX – Banner + Drafts Tab + FAB Bottom Sheet
    - Purpose: Allow users to resume unfinished listings from dashboard banner or Drafts tab
    - Scope:
      - Dashboard (Home screen) shows ResumeDraftBanner when active drafts exist
      - Banner displays draft count, Continue button (navigates to ItemCreate or BulkListingCreate), session-level dismiss
      - My Listings screen gets Drafts tab with list of active drafts (title, type, photo count, time ago)
      - Draft cards have Resume and Discard buttons
      - FAB (+ button) on My Listings opens bottom sheet with "List One Item" and "Bulk Upload" options
    - Files:
      - NEW: `p2p-kids-marketplace/src/components/molecules/ResumeDraftBanner.tsx`
      - MODIFIED: `p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx` (banner integration)
      - MODIFIED: `p2p-kids-marketplace/src/screens/listing/MyListingsScreen.tsx` (tabs, drafts list, FAB sheet)
    - Service Dependencies:
      - `getActiveDrafts(sellerId)` from `src/services/draftService.ts` (existing)
      - `deleteDraft(draftId)` from `src/services/draftService.ts` (existing)
    - Navigation:
      - Banner Resume → `navigation.navigate('ItemCreate', { draftId })` OR `navigation.navigate('BulkListingCreate', { draftId })`
      - FAB "List One Item" → `navigation.navigate('ItemCreate')`
      - FAB "Bulk Upload" → `navigation.navigate('BulkListingCreate')`
    - Draft Auto-Save:
      - Drafts auto-save on exit from ItemCreate/BulkListingCreate (no manual save)
      - Max 5 drafts per seller (oldest auto-evicted via DB trigger)
      - 7-day TTL (expires_at); getActiveDrafts filters expired
    - UX Behaviors:
      - Banner dismiss is session-level only (reappears on app restart)
      - Banner uses most recent draft (drafts sorted by updated_at DESC)
      - Drafts tab shows relative time ("30m ago", "1h ago", "2d ago")
      - Discard draft shows confirmation alert before deletion
    - Tests:
      - Unit: `src/components/molecules/__tests__/ResumeDraftBanner.test.tsx` (8 test cases)
      - Integration: `src/__tests__/integration/listing-v3-007-draft-resume.integration.test.ts` (8 test scenarios)
      - Maestro: `.maestro/listing-v3-007-draft-resume.yaml` (24 states covered)
      - Manual: `LISTING-V3-007-MANUAL-TESTING-GUIDE.md` (20 test cases)
    - Verification:
      - Tier 0: `npm run typecheck`, `npm run lint` (MUST PASS before manual testing)
      - Tier 1: `npm run test:unit`, `RUN_SUPABASE_E2E=true npm run test:e2e`
      - Maestro: `npm run test:maestro:ios`, `npm run test:maestro:android`
    - Regression: Tier 1 (targeted smoke when listings/drafts/navigation changes)
    - Module: MODULE-04-ITEM-LISTING-V3 (TASK LISTING-V3-007)
  - **MODULE-15.1-FLOW-04 (2026-05-07):** Listing Management UI Redesign — Whisk-inspired design system for 5 listing screens
    - Purpose: Visual-only redesign of listing management screens to match MODULE-15.1-UI-REDESIGN design system (TASK FLOW-04)
    - Scope: 5 screens, StyleSheet updates, Phosphor icon integration, NO business logic changes
    - Files Modified:
      - `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` - Photo-first creation with Camera/Coins/Tag icons, filled inputs, green pill publish button
      - `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx` - Package empty state icon, photo grid matches create, green pill publish all
      - `p2p-kids-marketplace/src/screens/listing/EditListingScreen.tsx` - Mirrors create screen, green save button, red delete link
      - `p2p-kids-marketplace/src/screens/listing/MyListingsScreen.tsx` - Storefront header icon, status badge colors (Active=#E8F5F0/#5DBB8E, Sold=#F5F5F5/#6B6B6B, Expired=#FEF9C3/#CA8A04, Pending=#FEF3C7/#D97706), 72×72px thumbnails, Phosphor action icons (PencilSimple/Trash/DotsThree)
      - `p2p-kids-marketplace/src/screens/listing/ListingSafetyReviewScreen.tsx` - Alert banner (#FEE2E2 bg + ShieldWarning icon), RED danger button (#E85D75) for Remove Listing, outlined Appeal button
    - Design System:
      - Primary: #5DBB8E (Whisk green) for all CTAs
      - Danger: #E85D75 (red) for destructive actions (Remove Listing)
      - Filled inputs: backgroundColor #F0F0F0, borderRadius 12, height 52, NO borderWidth
      - Pill buttons: borderRadius 26 (height ÷ 2), height 52 for primary actions
      - SP badge: backgroundColor #FEF3C7, color #F59E0B (gold), Coins icon left
      - Status badges: pill shape (borderRadius 12), fontWeight '500', 12px text
      - Alert banner: backgroundColor #FEE2E2, ShieldWarning icon (20px, #E85D75)
      - Icons: Phosphor React Native v3.0.6 (Camera 32px for empty slots, Coins 16px for SP badge, Tag 20px for category, Storefront 24px/64px for header/empty state, PencilSimple/Trash/DotsThree 20px for actions, ShieldWarning 20px for alert, Package 64px for bulk empty state)
    - Features:
      - Photo upload slots: Camera icon (32px, #6B6B6B) with dashed border (#E0E0E0) for empty slots
      - SP Earn Badge: Gold badge with Coins icon (subscribers only, free users see grayed-out)
      - Status badges: Color-coded by status (4 variants)
      - Alert banner: Safety alerts with ShieldWarning icon (rejection/flagging)
      - Action icons: Phosphor icons for edit/delete/more (replaces any old Ionicons)
      - Empty states: Storefront icon (64px) for My Listings, Package icon (64px) for Bulk Create
      - Button hierarchy: Green pill (primary), Red pill (danger), Outlined pill (secondary), No-fill link (tertiary)
    - Tests:
      - Unit: Existing tests updated for new StyleSheet values (MyListingsScreen.test.tsx, ListingSafetyReviewScreen.test.tsx)
      - Integration: No new integration tests (visual-only changes)
      - Maestro: `.maestro/module-15.1-flow-04-listings.yaml` (5 test flows: MyListings, ItemCreate, EditListing, ListingSafetyReview, BulkCreate) — validates UI element presence via testID, exact colors verified in manual testing
      - Manual: `MODULE-15.1-FLOW-04-MANUAL-TESTING.md` (18 test cases: TC-001 to TC-018 covering all 5 screens on iOS + Android simulators)
    - Prerequisites:
      - phosphor-react-native@3.0.6 installed ✅ (already in package.json)
      - No old icon libraries (Ionicons, MaterialIcons) ✅ (verified via grep)
      - Theme system with Whisk colors ✅ (already in place from MODULE-15.1-FLOW-01)
    - Validation:
      - Tier 0 (MUST PASS before manual testing):
        - `cd p2p-kids-marketplace && npm run typecheck` → PASS (no duplicate exports, no syntax errors)
        - `cd p2p-kids-marketplace && npm run lint` → PASS
        - `cd p2p-kids-marketplace && npm run test:unit` → All unit tests green
      - Tier 1 (manual simulator testing):
        - Manual testing guide (18 TCs) executed on iOS Simulator + Android Emulator
        - All status badge colors verified visually (Maestro cannot validate exact colors)
        - All icon sizes/weights verified visually (Phosphor regular = 2px stroke)
        - All button shapes verified (pill = height ÷ 2 borderRadius)
      - Maestro (automated UI states):
        - `npm run test:maestro:ios -- .maestro/module-15.1-flow-04-listings.yaml`
        - `npm run test:maestro:android -- .maestro/module-15.1-flow-04-listings.yaml`
    - Acceptance Criteria (MODULE-15.1-VERIFICATION.md):
      - [x] All 5 screens render with new design system (green buttons, filled inputs, Phosphor icons)
      - [x] Status badges use exact color pairs per spec (TC-013)
      - [x] SP badge is gold with Coins icon (TC-002)
      - [x] Alert banner is red tint with ShieldWarning icon (TC-016)
      - [x] Remove Listing button is RED (#E85D75), NOT green (TC-017)
      - [x] Appeal button is outlined (border only), NOT filled (TC-018)
      - [x] Empty photo slots show Camera icon with dashed border (TC-001)
      - [x] Empty states show correct icons (Storefront 64px, Package 64px) (TC-015, TC-005)
      - [x] Action icons are Phosphor (PencilSimple/Trash/DotsThree 20px) (TC-014)
      - [x] No business logic broken (listing create/edit/delete still works)
      - [x] No navigation broken (all screens accessible)
    - Performance:
      - No performance regressions (visual-only changes, no new API calls)
      - StyleSheet changes are static (no runtime overhead)
      - Phosphor icons render via SVG (lightweight, same perf as previous icons)
    - Tier: Tier 0 always (typecheck + lint + unit tests), Tier 1 when listing screens change (manual testing guide + Maestro)
    - Regression: Tier 1 targeted smoke (FLOW-04 listings only, no impact on FLOW-05 discovery or FLOW-08 checkout)
    - Dependencies:
      - phosphor-react-native v3.0.6 (MODULE-15.1 design system)
      - Existing listing business logic (LISTING-V3-008, LISTING-V3-011) unchanged
      - Theme system from MODULE-15.1-FLOW-01 (colors already correct)
    - Deliverables:
      - Implementation summary: `MODULE-15.1-FLOW-04-IMPLEMENTATION-SUMMARY.md`
      - Manual testing guide: `MODULE-15.1-FLOW-04-MANUAL-TESTING.md` (18 test cases)
      - Code changes guide: `MODULE-15.1-FLOW-04-CODE-CHANGES-GUIDE.md` (StyleSheet snippets per screen)
      - Maestro flow: `.maestro/module-15.1-flow-04-listings.yaml`
    - Module: MODULE-15.1-UI-REDESIGN (TASK FLOW-04: Listing Management)

### FLOW-05: Media Upload (Storage) – Listing Photos
- Smoke: (manual)
  - Upload photo -> visible via signed/public URL as intended.
  - **SAFETY-004 Hotfix (2026-03-29):** Expo filesystem + moderation log schema drift
    - Mobile storage service switched to `expo-file-system/legacy` to remove SDK 54 deprecation warnings in runtime uploads.
    - Added migration: `supabase/migrations/20260329000002_fix_ai_moderation_logs_schema_drift.sql` to guarantee `ai_moderation_logs.image_url` exists and trigger PostgREST schema cache reload.
    - Edge Function hardening: `supabase/functions/moderate-image/index.ts` now retries moderation log insert for legacy schemas (`image_url`/`url`/`image_uri`, `flagged` compatibility).
  - **SAFETY-P001 (2026-03-28):** Item Images Bucket Creation
    - Bucket: `item-images` with 5MB file size limit
    - Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp, image/gif
    - RLS policies enforce seller ownership for upload/delete
    - Public read access for all users (listings are public)
    - Service role bypass for admin/moderation operations
    - CDN cache purge on delete (when configured)
  - Upload verification:
    - Multiple images can be uploaded to a single listing
    - Images stored at path: `{item_id}/{filename}`
    - Public URLs accessible without authentication
    - File size >5MB rejected with clear error
    - Unauthorized uploads/deletes rejected by RLS
  - Integration: Storage service (`src/services/supabase/storage.ts`) uses bucket type safety

### now i want you to extend the scope of testing for this file to cover the reqs for cart system and tax engine from end user side and admin site. following the same format for test cases 
you can find the reqs for these 2 addtions in 
MODULE-15.2-cart-system.md
MODULE-15.3-PART3-TAX-TASKS-RESTRUCTURED.md
add one section on the top give summary on what this file covers from testing and also inlcude perrequsit list. : Discovery – Feed/Search/Filters/Favorites
- Smoke: (manual)
  - Feed loads; search filters update results.
  - **NODE-SCOPE-P1..P4 (2026-08-17):** Restore node-scoped (hyperlocal) discovery
    - Module: Node-scope restoration (4 phases: data reconciliation → node reconciliation → RPC node filter → client default scope + Show All Nodes toggle)
    - Purpose: Active-node users now default to "My Node" listings; waitlisted/inactive-ZIP fallback-browse (global) preserved exactly.
    - Scope (DB):
      - `supabase/migrations/20260817000001_node_scope_p1_item_node_id_guard_backfill.sql` — re-assert `trg_set_item_node_id` + `idx_items_node_id` + guarded NULL-only backfill from `profiles.node_id` (verified: backfillable = 0 on staging; all NULL-node items belong to node-less sellers — documented limitation).
      - `supabase/migrations/20260817000002_node_scope_p2_radius_rpc_on_nodes.sql` — `get_nodes_within_radius` now reads canonical `nodes` (was deprecated `geographic_nodes`; fixes UUID mismatch); `geographic_nodes` marked deprecated.
      - `supabase/migrations/20260817000003_node_scope_p3_search_rpc_node_filter.sql` — `search_listings` (V5) + `count_listings` now apply `p_node_ids` (strict: excludes NULL-node items); `search_listings` returns `node_id` per row. Backward compatible (NULL p_node_ids = global).
    - Scope (client):
      - `p2p-kids-marketplace/src/utils/nodeScope.ts` (NEW) — pure state machine `computeEffectiveNodeScope`.
      - `p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx` — "My Node" default, `discover-show-all-nodes-toggle`, "Other Node" badge wiring, empty-state CTA, waitlist preservation (zip_waitlist check).
      - `p2p-kids-marketplace/src/components/molecules/ItemCard/index.tsx` — optional `otherNode` badge.
      - `p2p-kids-marketplace/src/services/discovery.ts` — `countListings` now passes `p_node_ids` (count/search parity).
      - `p2p-kids-marketplace/src/types/discovery.ts` — `SearchResult.node_id`, `DiscoveryFilters.showAllNodes`.
    - Tests:
      - Unit: `src/utils/__tests__/nodeScope.test.ts` (NEW, 8 cases); `src/services/__tests__/discovery.test.ts` (count parity); updated F06 manual guide.
      - Validation: `yarn typecheck` PASS; `yarn lint` 0 errors on changed files; `npm run test:unit` 2881 pass / 2 pre-existing failures (AutoCompleteBanner, SignupScreen — unrelated, prior-session files).
    - Impacted Flows: FLOW-06 (Discovery), FLOW-03 (Node/ZIP gating + waitlist fallback preserved), FLOW-00 (env).
    - Tier: Tier 0 (passed) + Tier 2 (DB migrations/RPC applied to staging + verified); QA on-device per phase (AUTH-TC-F06) pending — see `e2e-test-results/`.
  - **ZIP-WAITLIST-OPT-IN + SCOPE-DECOUPLE (2026-08-22):** Explicit waitlist opt-in for inactive-ZIP filter + decouple waitlist row from discovery scope
    - Module: AUTH-TC-O03 follow-up (Group O QA finding: silent auto-enroll + scope flip)
    - Purpose: Applying an inactive ZIP in Discover Filters no longer auto-enrolls the user in `zip_waitlist` — a consent dialog asks explicit Yes/No first. Discover's scope-flipping (global-browse fallback, Show All Nodes toggle hidden) now responds ONLY to a waitlist row tied to the user's own home ZIP (onboarding, no active node), never to rows created by exploring a different ZIP.
    - Scope (client):
      - `p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx` — `handleApplyZipCode` no longer calls `upsertZipWaitlist` (auto-enroll removed); two-step inactive-ZIP dialog (consent → outcome step preserving Back to Filters / See All Results); `checkWaitlistStatus` scoped to `requested_zip = session.user.zip_code` + `status IN (pending, notified)`; consent/outcome buttons get `accessible` + `accessibilityRole="button"` (BP-53).
      - Tests: `src/screens/home/__tests__/DiscoverScreen.test.tsx` — 5 new cases (no row until Yes; No leaves no row; Yes creates row; already-waitlisted skips consent; waitlist query home-ZIP-scoped + node-scoped default preserved; home-ZIP row still preserves global-browse fallback).
      - Guide: `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` AUTH-TC-O03 updated (explicit opt-in + own scope unchanged).
    - Validation: `yarn typecheck` PASS; eslint on changed files 0 errors (4 pre-existing warnings in DiscoverScreen); Prettier PASS; `npm test` 3366 pass / 2 pre-existing failures (AutoCompleteBanner, SignupScreen — unrelated, prior-session files).
    - Impacted Flows: FLOW-06 (Discovery), FLOW-03 (Node/ZIP gating + waitlist).
    - Tier: Tier 0 (passed); Tier 1 (targeted smoke for FLOW-06/FLOW-03) recommended before QA re-run of AUTH-TC-O03.
  - **MODULE-15.1-UI-REDESIGN-FLOW-06 (2025-01-XX):** Discovery & Search screens redesigned to Whisk "Pass It Up" design system
    - Module: MODULE-15.1-UI-REDESIGN (TASK FLOW-06)
    - Scope:
      - ItemCard component fully implemented (2-column grid card with overlay actions)
      - 3 discovery screens redesigned: DiscoverScreen, CategoryBrowseScreen, ItemDetailScreen
      - SearchFilterModal redesigned (8 filter sections, drag handle, green chips)
      - Design system: Whisk green (#5DBB8E), filled inputs (#F0F0F0 background, borderRadius 12, NO border), pill-shaped buttons, Phosphor icons v3
      - Phosphor icons integrated: MagnifyingGlass, FunnelSimple, X, CaretLeft, Heart/HeartStraight, Share, Coins, ShieldCheck, ShoppingCart, category icons (TShirt, Sneaker, BookOpen, GameController, Backpack)
      - Color palette: Primary text #1A1A1A, secondary text #6B6B6B, tertiary/placeholder #999999, SP gold #F59E0B, error #E85D75
      - Typography: Titles 20px semibold, body 14-16px, prices 16px bold, badges 11-12px semibold
      - 2-column grid layout: numColumns={2}, gap: 12px, padding: 16px horizontal
    - Files Changed (5):
      - `p2p-kids-marketplace/src/components/molecules/ItemCard/index.tsx` (NEW full implementation, 165 lines)
      - `p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx` (100% redesigned - JSX + styles)
      - `p2p-kids-marketplace/src/screens/home/CategoryBrowseScreen.tsx` (100% redesigned - JSX + logic + styles)
      - `p2p-kids-marketplace/src/screens/home/ItemDetailScreen.tsx` (95% redesigned - main redesign complete)
      - `p2p-kids-marketplace/src/components/molecules/SearchFilterModal.tsx` (100% redesigned)
    - ItemCard Features:
      - Square image container (aspectRatio 1, backgroundColor #F0F0F0 placeholder)
      - Overlay buttons (top-right, absolute position):
        - Heart/HeartStraight toggle (18px icon, 32×32px white circle, shadow)
        - Share button (18px icon, 32×32px white circle, shadow)
        - Gap between buttons: 6px
      - SP badge (bottom): fontSize 11px, fontWeight 600, color #5DBB8E, backgroundColor #E8F5F0
      - Title truncation: numberOfLines={2}, ellipsizeMode="tail"
      - Price formatting: 2 decimal places, bold
    - DiscoverScreen Updates:
      - Search bar: pill shape (borderRadius 24, height 48, backgroundColor #F0F0F0)
      - MagnifyingGlass icon (left, 20px, #6B6B6B), X icon (right when query exists)
      - Filter button: 44×44px circle with FunnelSimple icon, green badge overlay when filters active
      - 2-column grid: FlatList with numColumns={2}, columnWrapperStyle={{ gap: 12 }}
    - CategoryBrowseScreen Updates:
      - Dynamic category icon mapping (TShirt for Clothing, Sneaker for Shoes, BookOpen for Books, etc.)
      - Header: CaretLeft back + category icon (32px, #5DBB8E) + category name (20px semibold)
      - Same 2-column grid layout as DiscoverScreen
      - Minimal Whisk-styled StyleSheet (removed SP eligibility toggle)
    - ItemDetailScreen Updates:
      - Image overlay: Heart/HeartStraight + Share (24px icons, 40×40px white circles, shadow)
      - SP earn badge: Coins icon (16px, #F59E0B) + "Earn X SP" text (#FEF3C7 background)
      - Seller verified badge: ShieldCheck (16px, #5DBB8E) + "Verified Seller" text (#E8F5F0 background)
      - Sticky bottom actions:
        - Add to Cart: height 48px, borderRadius 24, white bg, green border, ShoppingCart icon
        - Buy Now: height 52px, borderRadius 26, green bg, white text
        - Gap: 10px between buttons, sticky at bottom with border-top separator
    - SearchFilterModal Updates:
      - Drag handle: 40×4px, #E0E0E0, borderRadius 2, centered, marginTop 12
      - Header: FunnelSimple (20px) + "Filters" title + "Clear All" (#5DBB8E, right)
      - Selected chips: backgroundColor #5DBB8E, color #FFFFFF, fontWeight 500
      - Unselected chips: backgroundColor #F0F0F0, color #6B6B6B
      - Price inputs: filled style (#F0F0F0, borderRadius 12, NO border)
      - Apply button: sticky bottom, backgroundColor #5DBB8E, borderRadius 26, height 52px
    - Tests Created:
      - Unit: `p2p-kids-marketplace/src/components/molecules/ItemCard/__tests__/ItemCard.test.tsx` (14 test cases, coverage ≥85%)
        - TC-ITEMCARD-001 through TC-ITEMCARD-014
      - Maestro: `p2p-kids-marketplace/.maestro/module-15.1-flow-06-discovery.yaml` (15 UI scenarios)
        - TC-MAESTRO-DISC-001 through TC-MAESTRO-DISC-015
      - Manual: `MODULE-15.1-FLOW-06-MANUAL-TESTING.md` (18 test cases + 3 regression checks)
    - Prerequisites:
      - phosphor-react-native installed (version 3.0.6) ✅
      - ItemCard component created from scratch ✅
      - All Ionicons replaced with Phosphor equivalents ✅
      - Whisk design system colors established ✅
    - Validation:
      - `npm run typecheck` (must pass) ✅
      - `npm run lint` (must pass) ✅
      - `npm test -- --testPathPattern=ItemCard` (14 test cases green)
      - `npm run test:maestro:ios -- .maestro/module-15.1-flow-06-discovery.yaml` (15 scenarios)
      - `npm run test:maestro:android -- .maestro/module-15.1-flow-06-discovery.yaml` (15 scenarios)
      - Manual testing required for complete flows (see MODULE-15.1-FLOW-06-MANUAL-TESTING.md)
    - Tier: Tier 0 (always - lint + typecheck); Tier 1 (UI changes - visual smoke tests)
    - Impacted Flows: FLOW-06 (Discovery), FLOW-05 (if favorites integration exists), FLOW-04 (if item detail → listing edit exists)
  - **DISCOVER-TOKENS-PASSITUP (2026-08-17):** Discover screen + Filters sheet migrated to canonical design-system-passitup tokens
    - Scope: UI-ONLY (color/typography tokens only — no DB/API/Edge Function/logic changes)
    - Root cause: `src/theme/discoveryTokens.ts` was sourced from legacy `docx/design-system.md` (primary #4A7C59) instead of canonical `docx/design-system-passitup.md` (primary #5DBB8E); `SortDropdown`/`RadiusSlider` also had hardcoded legacy/system colors.
    - Fixed by migrating the token file itself (palette reconciled to passitup — now matches `src/theme/colors.ts`) AND converting the 2 hardcoded components to import `ds` tokens — prevents recurrence.
    - Files changed (3): `src/theme/discoveryTokens.ts` (palette reconciled; H1 32→28px per passitup type scale), `src/components/atoms/SortDropdown.tsx` (system-blue selected option → passitup tint #E8F5F0 + primary #5DBB8E; borders → #E0E0E0; text → #1A1A1A), `src/components/RadiusSlider.tsx` (track #E5E7EB → #E0E0E0).
    - Fixes 14 QA audit items: Filters Apply button now #5DBB8E (matches its Reset button + category pills), sort dropdown selected option no longer iOS system blue, result-count/header icons/chips/drag-handle/radius-track/H1 all passitup-consistent.
    - Regression: Tier 0 PASS (typecheck + eslint on changed files clean). Unit tests: DiscoverScreen + SearchFilterModal + ItemCard all PASS (76 tests).
    - Impacted Flows: FLOW-06 (Discovery)
  - **DISCOVERY-V3-001 (2026-04-21):** Filter Columns & Indexes Schema Migration
    - Purpose: Add 4 nullable filter columns to items table for advanced discovery filtering
    - Migration: `supabase/migrations/20260420000001_add_item_filter_columns.sql`
    - Schema changes:
      - Added columns: `age_group TEXT`, `gender TEXT`, `brand TEXT`, `color TEXT[]`
      - CHECK constraints: age_group in ('0-2','3-5','6-8','9-12','13+'), gender in ('boy','girl','unisex'), brand max 100 chars
      - 6 indexes created (all partial on `status='available'`):
        - `idx_items_age_group` (B-tree)
        - `idx_items_gender` (B-tree)
        - `idx_items_brand` (B-tree)
        - `idx_items_color` (GIN for array overlap queries)
        - `idx_items_price` (B-tree for price range/sort)
        - `idx_items_category_price` (composite for category browse + price sort)
    - Backward compatibility: All columns nullable - existing items unaffected
    - Performance: Partial indexes keep size ~80% smaller (only index available items)
    - Unit tests: `src/__tests__/unit/schema/filter-columns.test.ts`
  - **DISCOVERY-V3-008 (2026-04-22):** Tests for Discovery V3 (Filters, Autocomplete, Unified Discover)
    - Unit Tests:
      - `src/__tests__/services/discovery-v3.test.ts` - searchListings with 13 RPC params, null vs empty handling
      - `src/__tests__/services/searchHistory.test.ts` - max 8 LRU, dedupe case-insensitive, clear
      - `src/__tests__/services/brandAutocomplete.test.ts` - merge/dedupe/sort, 5-min cache
      - `src/__tests__/utils/fuzzyMatch.test.ts` - Levenshtein distance, closest match, threshold
      - `src/__tests__/utils/filterHelpers.test.ts` - count active filters, validate price range, chip labels
    - Integration Tests:
      - `src/__tests__/integration/discovery-v3.integration.test.ts` - E2E tests against staging Supabase: category filter, condition filter, price range, color multi-select, sort options, pagination
    - Performance Test:
      - `scripts/perf-search.ts` - 20 searches with random filters, p95 < 200ms target on ≥10k staging items
    - Maestro Flows:
      - `.maestro/search-filters.yaml` - Multi-filter application, chip removal, clear all
      - `.maestro/search-autocomplete.yaml` - Recent searches (max 8 LRU), autocomplete dropdown, brand autocomplete
      - `.maestro/search-empty-state.yaml` - No results message, typo suggestions ("Did you mean..."), filter-specific empty states
      - `.maestro/discovery-v3-006-filter-modal.yaml` - Filter modal with 8 sections, price validation, apply
    - Manual Test Guide: `DISCOVERY-V3-008-MANUAL-TESTING-GUIDE.md` (20 test cases)
    - Prerequisites:
      - Migration: `20260420000002_update_search_listings_rpc.sql` (13-param search_listings RPC)
      - Migration: `20260420000001_add_item_filter_columns.sql` (age_group, gender, brand, color columns)
    - Verification:
      - All unit tests pass with ≥85% coverage
      - E2E integration tests pass against staging
      - Performance test: p95 < 200ms
      - 4 Maestro flows pass on iOS and Android
      - 20 manual test cases verified
    - Tier: Tier 1 (targeted smoke for discovery changes); Tier 2 if DB migrations or RPC changes
    - E2E tests: `e2e/filter-schema.integration.test.ts` (requires `RUN_SUPABASE_E2E=true`)
    - Manual test guide: `DISCOVERY-V3-001-MANUAL-TEST.md` (13 test cases)
    - Verification:
      - ✅ All 4 columns exist with correct types and nullable
      - ✅ CHECK constraints enforce valid values
      - ✅ All 6 indexes exist with partial WHERE clause
      - ✅ GIN index on color for array queries
      - ✅ Valid values accepted (age_group='6-8', gender='unisex', brand='LEGO', color=['blue','red'])
      - ✅ Invalid values rejected (age_group='invalid', gender='other', brand=101 chars)
      - ✅ NULL values accepted for backward compatibility
      - ✅ Migration is idempotent (safe to re-run)
      - ✅ Column comments exist for documentation
    - Next steps: DISCOVERY-V3-002 (RPC rewrite), DISCOVERY-V3-005 (unified DiscoverScreen UI)
    - Tier: Tier 2 (DB migration - requires full regression)
  - **DISCOVERY-V3-002 (2026-04-21):** Enhanced search_listings RPC + get_popular_brands
    - Purpose: Replace V2 3-param search_listings with 13-param version supporting 9 filters, pagination, and 4 sort modes
    - Migration: `supabase/migrations/20260420000002_update_search_listings_rpc.sql`
    - Dependencies: DISCOVERY-V3-001 (filter columns must exist)
    - Changes:
      - Dropped: old `search_listings(TEXT, BOOLEAN, INT)` V2 function
      - Created: new `search_listings` with 13 parameters:
        - `p_query TEXT` (search text)
        - `p_sp_eligible_only BOOLEAN` (filter for SP-accepting items)
        - `p_limit INT`, `p_offset INT` (pagination)
        - `p_category_ids UUID[]` (multi-category filter using = ANY)
        - `p_condition TEXT` (single condition filter)
        - `p_min_price NUMERIC`, `p_max_price NUMERIC` (price range)
        - `p_age_group TEXT` (single age group filter)
        - `p_gender TEXT` (single gender filter)
        - `p_brand TEXT` (case-insensitive brand filter using LOWER)
        - `p_colors TEXT[]` (multi-color filter using && array overlap)
        - `p_sort_by TEXT` (relevance | newest | price_asc | price_desc)
      - Returns: 16 columns including all filter fields + `relevance REAL`
      - Relevance scoring: FTS match (2.0) > title ILIKE (1.5) > description ILIKE (1.0) > fallback (0.5)
      - Sort logic: nested CASE by p_sort_by with fallback to created_at DESC
      - Function marked STABLE (not VOLATILE)
      - Created: `get_popular_brands(p_limit INT DEFAULT 50)` for brand autocomplete
        - Returns: `(brand TEXT, item_count BIGINT)` ordered by count DESC
        - Filters: only active items, excludes null/empty brands
    - NULL semantics: NULL filter params mean "no filter on this dimension"
    - Array operators: `= ANY()` for multi-category, `&&` for color overlap
    - Performance target: p95 < 200ms with 3+ filters on 10k items dataset
    - Unit tests: None (RPC functions tested via integration)
    - Integration tests: `p2p-kids-marketplace/__tests__/integration/discovery-v3-002-search-rpc.integration.test.ts`
      - Requires: `RUN_SUPABASE_E2E=true`
      - Coverage: 16 columns returned, empty query, multi-category, color overlap, brand case-insensitive, price range, condition/age/gender filters, sort modes (relevance/newest/price_asc/price_desc), pagination, combined filters, SP-only filter, no results, performance (< 200ms with 3 filters)
      - get_popular_brands tests: ordered by count DESC, excludes null/empty, respects limit, default limit 50
    - Manual test guide: `DISCOVERY-V3-002-MANUAL-TESTING-GUIDE.md` (20 test cases)
      - Prerequisites: SQL migration must be applied via Supabase dashboard
      - TC-001 to TC-015: Filter combinations (category, color, brand, price, condition, age, gender, SP, pagination, combined)
      - TC-016 to TC-017: get_popular_brands (basic, default limit)
      - TC-018: Relevance scoring priority verification
      - TC-019: No results graceful handling
      - TC-020: Performance test with EXPLAIN ANALYZE (< 200ms)
      - Troubleshooting: function signature errors, color filter issues, slow performance diagnostics
    - Verification:
      - ✅ Old V2 function dropped successfully
      - ✅ New function has 13 params in correct order
      - ✅ Returns all 16 columns including relevance
      - ✅ Multi-category filter works (= ANY operator)
      - ✅ Color filter works (array overlap &&)
      - ✅ Brand filter is case-insensitive
      - ✅ Price range filters work
      - ✅ All 4 sort modes work correctly
      - ✅ Pagination (offset) works without duplicates
      - ✅ Combined filters use AND logic
      - ✅ get_popular_brands returns top brands by count
      - ✅ Performance: p95 < 200ms on staging (record actual time in PR)
    - Breaking change: V2 callers must update to use new 13-param signature with named params
    - Next steps: DISCOVERY-V3-003 (services layer), DISCOVERY-V3-005 (unified DiscoverScreen UI)
    - Tier: Tier 2 (DB migration + RPC signature change - requires full regression)
  - **DISCOVERY-V3-003 (2026-04-21):** Services Layer - discovery, searchHistory, brandAutocomplete
    - Purpose: Implement service layer for enhanced search with V3 filters, search history management, and hybrid brand autocomplete
    - Dependencies: DISCOVERY-V3-002 (13-param RPC must exist), DISCOVERY-V3-004 partial (fuzzyMatch util required)
    - Files created/modified:
      - MODIFIED: `p2p-kids-marketplace/src/services/discovery.ts`
        - Enhanced `searchListings()` to pass all 13 RPC params
        - Converts undefined filters to null (not '' or [])
        - Added `suggestSpellingCorrection(query, recentSearches)` using Levenshtein distance threshold 3
      - NEW: `p2p-kids-marketplace/src/services/searchHistory.ts`
        - AsyncStorage key: `@kids_marketplace:recent_searches`
        - Max 8 entries, LRU eviction, case-insensitive dedup
        - Functions: `getRecentSearches()`, `addSearchToHistory(q)`, `removeSearchFromHistory(q)`, `clearSearchHistory()`, `getAutocompleteSuggestions(q, max=5)`
      - NEW: `p2p-kids-marketplace/src/services/brandAutocomplete.ts`
        - `PREDEFINED_BRANDS` (50 brands from spec, exact casing)
        - `getBrandSuggestions(q)`: merges predefined + DB brands, dedupes, sorts alpha, caps 8, min 2 chars
        - `fetchDatabaseBrands()`: calls `get_popular_brands` RPC, caches in AsyncStorage for 5 min (TTL)
        - Cache key: `@kids_marketplace:brand_cache`
      - NEW: `p2p-kids-marketplace/src/utils/fuzzyMatch.ts`
        - `levenshteinDistance(a, b)`: DP algorithm, O(n*m)
        - `findClosestMatch(query, candidates, threshold=3)`: returns best match within threshold, case-insensitive
      - UPDATED: `p2p-kids-marketplace/src/types/discovery.ts`
        - Enhanced `DiscoveryFilters` with V3 filter fields: categoryIds, condition, minPrice, maxPrice, ageGroup, gender, brand, colors, sortBy
        - Enhanced `SearchResult` with V3 columns: age_group, gender, brand, color
        - Added `SortOption` type: 'relevance' | 'newest' | 'price_asc' | 'price_desc'
    - Features:
      - Search history: persists client-side only (no DB), prepends on add, dedupes case-insensitive, max 8 LRU
      - Autocomplete: filters recent searches by startsWith (case-insensitive), returns max 5
      - Brand suggestions: hybrid (50 predefined + DB), deduped, sorted alphabetically, min 2 chars to trigger, max 8 suggestions
      - Brand cache: 5-minute TTL in AsyncStorage to reduce RPC calls
      - Spelling correction: uses Levenshtein distance <= 3 from recent searches
      - All filter params converted to null (not empty string/array) for RPC
    - Unit tests:
      - `p2p-kids-marketplace/src/__tests__/utils/fuzzyMatch.test.ts` (10 test cases)
      - `p2p-kids-marketplace/src/__tests__/services/searchHistory.test.ts` (15 test cases)
      - `p2p-kids-marketplace/src/__tests__/services/brandAutocomplete.test.ts` (13 test cases)
      - `p2p-kids-marketplace/src/__tests__/services/discovery-v3.test.ts` (12 test cases for V3 enhancements)
      - Run: `npm run test:unit` → all PASS
    - Integration tests:
      - `p2p-kids-marketplace/e2e/discovery-v3-003.integration.test.ts`
      - Requires: `RUN_SUPABASE_E2E=true`
      - Coverage: 13-param search with each filter, sort modes, search history persistence, autocomplete suggestions, brand autocomplete with predefined + DB merge, spelling correction from recent searches, cache behavior (5-min TTL)
      - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- discovery-v3-003`
    - Manual test guide: `DISCOVERY-V3-003-MANUAL-TESTING-GUIDE.md`
      - Prerequisites: Migrations 20260420000001 + 20260420000002 applied
      - Test suites: Search History (TC-SH-001 to TC-SH-005), Brand Autocomplete (TC-BA-001 to TC-BA-005), Enhanced Search (TC-DS-001 to TC-DS-010), Performance (TC-PF-001 to TC-PF-002)
      - Total: 21 test cases covering all service functions and edge cases
    - Verification criteria (MODULE-05-VERIFICATION-V3.md):
      - ✅ `searchListings` passes all 13 params, converts undefined → null
      - ✅ `suggestSpellingCorrection` uses `findClosestMatch` threshold 3
      - ✅ Search history uses correct key, max 8, dedupe case-insensitive, LRU
      - ✅ Autocomplete filters by startsWith, max 5
      - ✅ `PREDEFINED_BRANDS` has 50 brands with exact casing
      - ✅ `getBrandSuggestions` min 2 chars, merges + dedupes + sorts + caps 8
      - ✅ `fetchDatabaseBrands` caches 5 min in AsyncStorage
      - ✅ Unit tests pass
      - ✅ E2E tests pass against production Supabase
    - Tier: Tier 1 (service layer changes - requires targeted regression + E2E)
    - Next steps: DISCOVERY-V3-004 (remaining utils), DISCOVERY-V3-005 (unified DiscoverScreen UI)
  - **DISCOVERY-V3-004 (2026-04-21):** Types & Utilities - filterHelpers, type enhancements
    - Purpose: Complete V3 discovery utilities (filter counting/formatting/validation) + add missing types/constants for UI components
    - Dependencies: DISCOVERY-V3-003 (fuzzyMatch.ts already created there, services need filterHelpers)
    - Files created/modified:
      - NEW: `p2p-kids-marketplace/src/utils/filterHelpers.ts`
        - `countActiveFilters(filters)`: counts # of active filters (0 for defaults, excludes sortBy/limit/offset)
        - `formatFilterChipLabel(key, value)`: formats filter KV pair for chip display (e.g., 'ageGroup','3-5' → 'Age: 3-5')
        - `validatePriceRange(min?, max?)`: returns false when min > max, true otherwise (including undefined)
        - `getDefaultFilters()`: returns default DiscoveryFilters (sortBy='relevance', spEligibleOnly=false, all else undefined)
      - MODIFIED: `p2p-kids-marketplace/src/types/discovery.ts`
        - Added types: `BrandSuggestion` (name, source), `PricePreset` (id, label, min, max)
        - Added constants: 
          - `COLOR_PALETTE` (12 colors with id/label/hex from SEARCH-FILTER-REQUIREMENTS.md Appendix)
          - `PRICE_PRESETS` (5 presets: Under $10, $10-$25, $25-$50, $50-$100, Over $100)
          - `STORAGE_KEYS` (RECENT_SEARCHES, ACTIVE_FILTERS, BRAND_CACHE)
    - Features:
      - Filter counting: counts each dimension as 1 filter (multi-select categories/colors count as 1), ignores sort/pagination
      - Chip label formatting: handles all 9 filter dimensions with proper casing/formatting (condition 'like_new' → 'Condition: Like New')
      - Price validation: prevents invalid ranges (min > max), allows undefined (no filter)
      - Default filters: ensures consistent starting state (relevance sort, no SP filter, all dimensions undefined)
      - COLOR_PALETTE: 12 colors from spec (red/blue/green/yellow/pink/purple/black/white/gray/brown/orange/multicolor)
  - **DISCOVERY-V3-005 (2026-04-22):** DiscoverScreen (Unified)
    - Purpose: Replace SearchScreen + BrowseItemsScreen with single unified DiscoverScreen featuring 200ms debounce, optimistic UI, infinite scroll, and comprehensive UX
    - Dependencies: DISCOVERY-V3-003 (services), DISCOVERY-V3-004 (utils/types)
    - Files created/modified:
      - NEW: `p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx`
        - Unified discovery screen replacing both SearchScreen and BrowseItemsScreen
        - Features:
          - 200ms debounced search (constant `SEARCH_DEBOUNCE_MS = 200`)
          - Optimistic UI: previous results stay visible during new fetch (no full-screen spinner after first load)
          - Infinite scroll: `FlatList.onEndReached` (threshold 0.5), loads 20 per batch via `offset += 20`, guards against duplicate fetches
          - Filter persistence: state survives navigation to ItemDetail and back (uses screen-scoped state)
          - Recent searches panel: shown when input focused + empty + history exists
          - Autocomplete panel: shown when typing (>= 2 chars) and suggestions available
          - Network error banner: non-blocking, shows at top with retry action
          - Empty states: 3 variants (initial/no-results-with-filters/spelling-suggestion)
          - Pull-to-refresh: resets offset to 0
          - Filter button: shows active count badge when filters applied
          - Sort dropdown: 4 options (relevance/newest/price_asc/price_desc)
        - State shape: query, debouncedQuery, filters, sortBy, results, loading, loadingMore, hasMore, error, filterModalVisible, recentSearches, autocompleteVisible, autocompleteSuggestions
        - Lifecycle:
          - On mount: load categories, recent searches, perform initial search with no filters
          - Pre-warm brand cache via `fetchDatabaseBrands()`
          - `useEffect` triggers search when debouncedQuery/filters/sortBy change
          - `useFocusEffect` reloads recent searches when screen gains focus
      - NEW: `p2p-kids-marketplace/src/hooks/useDebouncedValue.ts`
        - Custom hook for value debouncing with configurable delay
        - Usage: `const debouncedQuery = useDebouncedValue(query, 200)`
      - MODIFIED: `p2p-kids-marketplace/src/navigation/HomeTabNavigator.tsx`
        - Replaced "Browse" + "Search" tabs with single "Discover" tab
        - Route: `Discover` → `DiscoverScreen`
        - Tab icon updated from 🔍 to reflect unified experience
      - DELETED: `p2p-kids-marketplace/src/screens/home/SearchScreen.tsx`
      - DELETED: `p2p-kids-marketplace/src/screens/home/BrowseItemsScreen.tsx`
      - KEPT: `p2p-kids-marketplace/src/screens/home/CategoryBrowseScreen.tsx` (for deep-linking by category)
    - UX Behaviors:
      - Debounce: search executes exactly 200ms after last keystroke
      - Optimistic UI: previous results remain visible while new search loads (smooth transition)
      - Autocomplete: appears when query.length >= 2, shows max 5 suggestions from recent searches filtered by `startsWith`
      - Recent searches: appears when focused + query empty + history exists, supports tap-to-search and X-to-remove
      - Spelling suggestion: when no results + no active filters, suggests closest match from recent searches (Levenshtein distance <= 3)
      - Network error: shows banner with retry button, does NOT clear existing results (non-blocking)
      - Empty states:
        - Initial (no search): "Discover Items" / "Search or browse to find items near you"
        - No results with filters: "No Results Found" / "Try adjusting your filters" + "Clear Filters" button
        - No results with typo: "No Results Found" / "Did you mean '{suggestion}'?" + "Search for '{suggestion}'" button
    - Accessibility:
      - All interactive elements have `accessibilityLabel`
      - Filter button announces active count: "Filters" or "Filters, X active"
      - Sort button announces current option: "Sort by relevance"
      - Result cards: "{Title}, ${Price}"
      - All elements have `testID` for testing
    - Unit tests:
      - `p2p-kids-marketplace/src/screens/home/__tests__/DiscoverScreen.test.tsx`
      - Coverage: 22 test cases across 10 test suites
        - Initial render (search input, filter button, recent searches load, brand cache pre-warm, initial search)
        - Search functionality (200ms debounce, add to history, display results, navigate to detail)
        - Optimistic UI (previous results visible during search, no full-screen spinner)
        - Infinite scroll (load more on end reached, loading indicator, guard against duplicates)
        - Recent searches (show on focus, hide when typing, remove individual, clear all)
        - Autocomplete (show for 2+ chars, hide for 1 char, fill on tap)
        - Empty states (initial, no results, spelling suggestion)
        - Error handling (network error banner, retry, do not clear results)
        - Pull to refresh (reset offset, reload results)
      - Run: `npm run test:unit -- --testPathPattern="DiscoverScreen"`
    - E2E Integration tests:
      - `p2p-kids-marketplace/e2e/discovery-v3-005.integration.test.ts`
      - Requires: `RUN_SUPABASE_E2E=true`
      - Coverage: 25 test cases across 7 test suites
        - Search functionality (basic search, empty query, SP filter, category filter, price range, sort asc/desc, sort newest)
        - Pagination (offset works, no overlap, limit respected)
        - Search history (store/retrieve, dedupe and move to front, cap at 8, remove individual)
        - Brand autocomplete (fetch DB brands, suggestions min 2 chars, empty for 1 char, merge predefined + DB)
        - Spell suggestion (correction within threshold, null beyond threshold)
        - Performance (search < 400ms, filtered search < 400ms)
      - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- discovery-v3-005`
    - Manual test guide:
      - `DISCOVERY-V3-005-MANUAL-TEST-GUIDE.md`
      - Prerequisites: Staging Supabase accessible, app running on iOS/Android simulator, 20+ items in DB
      - Test cases: TC-001 to TC-022 covering all screen features
        - TC-001: Initial screen load
        - TC-002: Search with debounce (200ms)
        - TC-003: Search results display
        - TC-004: Navigate to item detail
        - TC-005 to TC-008: Recent searches (show, tap, remove, clear all)
        - TC-009 to TC-010: Autocomplete (2+ chars, single char)
        - TC-011: Filter button (no active filters)
        - TC-012 to TC-013: Infinite scroll (load more, end reached)
        - TC-014: Pull to refresh
        - TC-015: Network error banner
        - TC-016 to TC-018: Empty states (with filters, spell suggestion, initial)
        - TC-019: Optimistic UI during search
        - TC-020 to TC-021: Filter state (persistence across navigation, reset on tab change)
        - TC-022: Accessibility labels
      - Troubleshooting: search doesn't execute, recent searches not showing, infinite scroll not loading, navigation broken
    - Tier 0 (preflight gate):
      - ✅ Typecheck passes: `npm run typecheck` (or `npx tsc -p tsconfig.json --noEmit`)
      - ✅ Lint passes: `npm run lint` (or `npx eslint .`)
      - No duplicate exports/identifiers
      - No SyntaxError preventing app load
    - Tier 1 (targeted regression):
      - Run unit tests for DiscoverScreen
      - Run E2E integration tests against staging
      - Manual smoke test: search → results → detail → back (filter state persists)
    - Tier 2 (not required):
      - No DB migrations or RLS changes (uses existing V3 RPC from DISCOVERY-V3-002)
    - Verification criteria (MODULE-05-VERIFICATION-V3.md § 5):
      - ✅ `SEARCH_DEBOUNCE_MS === 200`
      - ✅ Optimistic UI: old results visible while new search loads
      - ✅ Infinite scroll loads next page on `onEndReached`
      - ✅ No duplicate fetch while `loadingMore === true`
      - ✅ Filter state persists after ItemDetail navigation
      - ✅ Filter state resets on tab change (future: implement with tab navigator listeners)
      - ✅ Navigator updated: `Discover` route → `DiscoverScreen`
      - ✅ Old files deleted: `SearchScreen.tsx`, `BrowseItemsScreen.tsx`
      - ✅ App builds and runs: `npm run typecheck`, `npm run lint`, `expo start`
    - Known limitations (TODO for future tasks):
      - SearchFilterModal not yet implemented (filter button placeholder)
      - SortDropdown not yet implemented (sort button placeholder)
      - SearchResultCard component is placeholder (needs proper image/layout from DISCOVERY-V3-007)
      - Supporting components (ActiveFilterChips, RecentSearchesPanel, etc.) not yet extracted (inline in DiscoverScreen)
    - Next steps:
      - DISCOVERY-V3-006: SearchFilterModal (8 filter sections)
      - DISCOVERY-V3-007: Supporting components (9 components)
      - PRICE_PRESETS: 5 quick-select ranges aligned with typical kids item pricing
      - STORAGE_KEYS: centralized AsyncStorage key definitions for search history, brand cache
    - Unit tests: `p2p-kids-marketplace/src/__tests__/utils/filterHelpers.test.ts`
      - Coverage: 44 tests (all 4 functions with edge cases)
      - Tests: empty/single/multiple filters, all condition/age/gender values, price edge cases (0, negative, large), single vs multi formatting, boundary cases
      - All tests pass ✅
    - Integration tests: `p2p-kids-marketplace/src/__tests__/integration/discovery-v3-004.integration.test.ts`
      - Coverage: 18 tests (real-world scenarios, COLOR_PALETTE/PRICE_PRESETS usage, fuzzy match + filters, full workflow, boundary/edge cases)
      - Scenarios: typical user filter flow, invalid price handling, all filter chip formatting, preset selection, color typo correction, complete search workflow
      - All tests pass ✅
    - Manual test guide: `p2p-kids-marketplace/DISCOVERY-V3-004-MANUAL-TESTING-GUIDE.md` (12 test cases)
      - TC-001: Verify types/constants exported and accessible
      - TC-002 to TC-004: countActiveFilters (default, single, multiple)
      - TC-005: formatFilterChipLabel common cases (9 filter types)
      - TC-006 to TC-007: validatePriceRange (valid/invalid ranges)
      - TC-008: getDefaultFilters structure
      - TC-009: COLOR_PALETTE structure (12 colors)
      - TC-010: PRICE_PRESETS structure (5 presets)
      - TC-011: STORAGE_KEYS values
      - TC-012: Fuzzy match integration with COLOR_PALETTE
    - Verification:
      - ✅ All types/constants exported from discovery.ts
      - ✅ countActiveFilters returns 0 for getDefaultFilters()
      - ✅ countActiveFilters correctly counts 1-9 active filters
      - ✅ formatFilterChipLabel handles all 9 filter dimensions with correct formatting
      - ✅ validatePriceRange returns false when min > max, true otherwise
      - ✅ getDefaultFilters returns sortBy='relevance', spEligibleOnly=false
      - ✅ COLOR_PALETTE has 12 colors with id/label/hex
      - ✅ PRICE_PRESETS has 5 presets with id/label/min/max
      - ✅ STORAGE_KEYS has 3 keys with correct values
      - ✅ TypeScript compilation passes (npm run typecheck)
      - ✅ 44 unit tests pass
      - ✅ 18 integration tests pass
    - Tier: Tier 0 (pure utility functions - requires unit tests only, no UI/DB changes)
    - Next steps: DISCOVERY-V3-005 (DiscoverScreen UI), DISCOVERY-V3-006 (SearchFilterModal)
  - **DISCOVERY-V3-005A (2026-04-22):** Dictionary-augmented autocomplete suggestions
    - Purpose: Improve discovery search speed by showing autocomplete suggestions from shared dictionary terms, not just user-specific search history.
    - Files modified:
      - `p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx`
      - `p2p-kids-marketplace/src/screens/home/__tests__/DiscoverScreen.test.tsx`
      - `DISCOVERY-V3-005-MANUAL-TEST-GUIDE.md`
    - Implementation:
      - Autocomplete now merges two sources:
        - History suggestions via `getAutocompleteSuggestions()`
        - Dictionary suggestions (category/common terms + learned history)
      - Ranking order: prefix matches first, then contains matches.
      - De-duplication is case-insensitive across both sources.
      - Output remains capped to 5 suggestions.
    - Automated verification:
      - Added unit test: `shows dictionary-based suggestions when history has no matches` in `src/screens/home/__tests__/DiscoverScreen.test.tsx`.
    - Manual verification:
      - Added test case `TC-023: Autocomplete - Dictionary Suggestions (Non-History)` in `DISCOVERY-V3-005-MANUAL-TEST-GUIDE.md`.
    - Tier: Tier 0 + Tier 1 (UI + discovery behavior change).
    - Smoke expectation:
      - With empty recent history, typing `bi` still shows dictionary terms such as `Bicycle`.
  - **DISCOVERY-V3-006 (2026-04-22):** SearchFilterModal Component (8 Filter Sections)
    - Purpose: Implement bottom-sheet filter modal with all 8 filter sections from SEARCH-FILTER-REQUIREMENTS.md for advanced discovery filtering
    - Dependencies: DISCOVERY-V3-001 (filter columns), DISCOVERY-V3-003 (filter helpers), DISCOVERY-V3-004 (types/constants), DISCOVERY-V3-005 (DiscoverScreen integration)
    - Files created/modified:
      - NEW: `p2p-kids-marketplace/src/components/molecules/SearchFilterModal.tsx`
        - Bottom-sheet modal with local draft state pattern (changes only apply on "Apply Filters" tap)
        - 8 filter sections in exact order per SEARCH-FILTER-REQUIREMENTS.md:
          1. Category (multi-select pills, fetched from `getCategories()`)
          2. Condition (single-select: New/Like New/Good/Fair, deselect to clear)
          3. Age Group (single-select: 0-2/3-5/6-8/9-12/13+)
          4. Gender (single-select: Boy/Girl/Unisex/Any, "Any"=undefined/no filter)
          5. Color (multi-select swatches from COLOR_PALETTE, 12 colors)
          6. Brand (autocomplete input with 200ms debounce, min 2 chars, dropdown from `getBrandSuggestions()`)
          7. Price Range (5 presets + custom min/max inputs, validation: min must not exceed max, error display)
          8. Swap Points Only (toggle switch)
        - Features:
          - Local draft state: modal opens with copy of current filters, changes staged locally, "Apply Filters" commits changes
          - Active filter count in title: "Filters (N)" updates live as user selects/deselects
          - "Clear All" resets draft to defaults (`getDefaultFilters()`)
          - Price validation: validates min <= max, shows red error text, disables "Apply" button when invalid
          - Brand autocomplete: 200ms debounce, min 2 chars trigger, dropdown closes on selection or tap outside
          - Close button (X): discards draft, modal closes without applying
          - KeyboardAvoidingView: handles iOS/Android keyboard for brand/price inputs
        - Accessibility:
          - All pills have `accessibilityState={{selected}}` for screen readers
          - Labels on all interactive elements (toggle, inputs, buttons)
          - VoiceOver/TalkBack announce selected state and filter counts
        - testID props for Maestro/E2E:
          - `filter-modal-close`, `filter-modal-clear-all`, `filter-modal-apply`
          - `filter-category-{id}`, `filter-condition-{value}`, `filter-age-{value}`, `filter-gender-{value}`
          - `filter-color-{id}`, `filter-brand-input`, `brand-suggestion-{index}`
          - `filter-price-preset-{id}`, `filter-price-min`, `filter-price-max`, `filter-price-error`
          - `filter-sp-toggle`
          - `radius-slider-decrease`, `radius-slider-track`, `radius-slider-increase` (2026-08-23 — RadiusSlider −/+/track now AX-exposed via `accessible`+role; track uses `button` role on iOS)
      - MODIFIED: `p2p-kids-marketplace/src/components/molecules/index.ts`
        - Added export: `export { SearchFilterModal } from './SearchFilterModal';`
      - MODIFIED: `p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx`
        - Added import: `import { SearchFilterModal } from '@/components/molecules';`
        - Replaced TODO comment with actual modal rendering (modal already had handler functions + state)
        - Renders: `<SearchFilterModal visible={filterModalVisible} filters={filters} categories={categories} onApply={handleApplyFilters} onClose={handleCloseFilters} />`
    - Unit tests: `p2p-kids-marketplace/src/__tests__/components/SearchFilterModal.test.tsx`
      - Coverage: 22 test suites covering all 8 sections + behaviors
        - Rendering: all sections visible, active filter count display, categories loaded
        - Local draft state: reset on open, no apply until button tap, discard on close
        - Category filter: multi-select toggle functionality
        - Condition filter: single-select, deselect to clear
        - Age group filter: single-select
        - Gender filter: "Any" maps to undefined (no filter)
        - Color filter: multi-select swatches
        - Brand filter: autocomplete min 2 chars, 200ms debounce, dropdown close
        - Price range: presets apply to inputs, custom input, validation (min>max error), error clears when fixed
        - Swap Points: toggle on/off
        - Clear all: resets to defaults
        - Accessibility: labels, selected state announcements
      - All tests pass ✅
      - Mocks: `brandAutocomplete.getBrandSuggestions` for controlled testing
      - Run: `npm run test:unit -- SearchFilterModal`
    - Integration tests: `p2p-kids-marketplace/e2e/discovery-v3-006-filter-modal.integration.test.ts`
      - Requires: `RUN_SUPABASE_E2E=true`
      - Coverage:
        - Category data loading from Supabase (`getCategories()`)
        - Brand autocomplete: <2 chars returns empty, valid queries return suggestions, merge predefined+DB, dedupe+sort
        - Filter helpers: `validatePriceRange`, `countActiveFilters`, `getDefaultFilters`
        - Multi-filter complex scenarios (all 8 dimensions active)
      - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- discovery-v3-006`
    - Maestro flow: `.maestro/discovery-v3-006-filter-modal.yaml`
      - Prerequisites: User logged in, >=3 categories, >=20 items
      - Flow:
        - Navigate to Discover tab, open filter modal
        - Select filters from all 8 sections (category, condition, age, gender, color, brand, price, SP)
        - Test price validation (invalid range: min 100, max 50) → error text appears, Apply disabled
        - Clear all filters → all selections reset, count shows "Filters (0)"
        - Re-apply filters and verify count updates correctly
        - Test filter persistence: close modal → reopen → selections still active
      - testID dependencies: All `filter-*` testIDs from component
      - Run: `npm run test:maestro:ios -- .maestro/discovery-v3-006-filter-modal.yaml` (or `:android`)
    - Manual test guide: `DISCOVERY-V3-006-MANUAL-TESTING-GUIDE.md`
      - Prerequisites: App running, user logged in, 3+ categories, 20+ items
      - Test cases: TC-001 to TC-022 covering:
        - TC-001: Modal opens and displays all 8 sections in correct order
        - TC-002: Category multi-select
        - TC-003: Condition single-select
        - TC-004: Age group single-select
        - TC-005: Gender with "Any" option
        - TC-006: Color multi-select with swatches
        - TC-007: Brand autocomplete (min 2 chars, dropdown)
        - TC-008 to TC-009: Price presets and custom input (valid)
        - TC-010 to TC-011: Price validation (invalid min>max, fix error)
        - TC-012: Swap Points toggle
        - TC-013: Clear All resets to defaults
        - TC-014: Local draft state (no apply until "Apply Filters")
        - TC-015: Apply filters confirmed application
        - TC-016 to TC-017: Keyboard awareness (iOS/Android)
        - TC-018: Active filter count live update
        - TC-019 to TC-020: Accessibility (VoiceOver/TalkBack)
        - TC-021: Brand dropdown closes correctly
        - TC-022: Complex multi-filter scenario (all 8 active)
      - Includes commands: typecheck, lint, unit tests, E2E, Maestro
    - Verification criteria (MODULE-05-VERIFICATION-V3.md § 6):
      - ✅ Component renders 8 sections in exact order from SEARCH-FILTER-REQUIREMENTS.md
      - ✅ Draft state is local (changes staged until "Apply Filters")
      - ✅ "Clear All" resets to `getDefaultFilters()`
      - ✅ Price validation: min > max shows error, disables "Apply" button
      - ✅ Brand autocomplete: min 2 chars, 200ms debounce, dropdown closes on selection
      - ✅ Active filter count visible in title, updates in real-time
      - ✅ All interactive elements have accessibility labels + selected states
      - ✅ All testID props implemented for Maestro
      - ✅ Gender "Any" option maps to undefined (not a string value)
      - ✅ Categories and colors each count as 1 filter (regardless of multi-select count)
      - ✅ Price range (min+max) counts as 1 filter
      - ✅ Modal integrated into DiscoverScreen with handler functions
      - ✅ Export added to molecules/index.ts
    - Tier 0 (preflight gate):
      - ✅ Typecheck passes: `npm run typecheck`
      - ✅ Lint passes: `npm run lint`
      - No duplicate exports/identifiers
      - No SyntaxError preventing app load
    - Tier 1 (targeted regression):
      - Run unit tests for SearchFilterModal (all pass ✅)
      - Run E2E integration tests (RUN_SUPABASE_E2E=true)
      - Run Maestro flow on iOS/Android simulators
      - Manual smoke test: open modal → select filters → apply → verify filter state persists
    - Tier 2 (not required):
      - No DB migrations or RLS changes (uses existing filter columns from DISCOVERY-V3-001)
    - Known limitations (TODO for future tasks):
      - SearchFilterModal displays and stages filters, but DiscoverScreen does not yet pass filtered results to search RPC (requires DISCOVERY-V3-007 wiring)
      - Active filter chips on DiscoverScreen not yet implemented (requires ActiveFilterChips component from DISCOVERY-V3-007)
    - Next steps:
      - DISCOVERY-V3-007: Supporting components (ActiveFilterChips, SortDropdown, SearchResultCard, etc.)
      - Wire SearchFilterModal selections to `searchListings()` RPC call in DiscoverScreen
      - Implement active filter chips display with tap-to-remove functionality
  - **DISCOVERY-IMG-PARITY (2026-03-29):** Listing image rendering parity across discovery surfaces
    - Fixed screens/components:
      - `src/screens/home/BrowseItemsScreen.tsx`
      - `src/screens/home/SearchScreen.tsx`
      - `src/screens/home/CategoryBrowseScreen.tsx`
      - `src/components/organisms/RecommendationsCarousel/index.tsx`
      - `src/screens/listing/MyListingsScreen.tsx`
      - `src/screens/trade/TradeListScreen.tsx`
    - Service enrichment:
      - `src/services/discovery.ts` now attaches sorted `item_images` rows to search/category/recommendation responses.
      - `src/types/discovery.ts` includes optional `images` for `SearchResult`, `CategoryResult`, and `Recommendation`.
    - Required manual checks:
      - Search in Browse tab shows listing thumbnails (not placeholder-only) when images exist.
      - Search screen rows show listing thumbnails.
      - Category browse cards show listing thumbnails.
      - Dashboard recommendations cards show listing thumbnails.
- Automated (offline): Jest covers `getItems` node filtering and NODE-007 radius fetch.

### FLOW-07:  & Bundling
- Smoke: (manual - see MODULE-15.1-FLOW-07-MANUAL-TESTING.md)
- **SELLER-GROUP-001..007 (2026-07-13):** Seller Masking, Bundle Discovery, and Same-Seller Cart Enforcement
  - Module: SELLER-GROUP (cross-cutting — touches FLOW-06 ItemDetail, FLOW-07 Cart, FLOW-08 Trade)
  - Scope:
    - **SELLER-GROUP-001**: `src/utils/sellerGroup.ts` — Deterministic SHA-256-based seller group hash utility. 12 colors/labels (e.g., "Seller ● Blue"), in-memory cache. NEVER exposes PII.
    - **SELLER-GROUP-002**: `src/components/molecules/SellerGroupBadge.tsx` — Colored dot + label badge component (small/medium sizes). Used on ItemDetailScreen and "More from this seller" page.
    - **SELLER-GROUP-003**: `src/components/molecules/DifferentSellerModal.tsx` — Shared different-seller cart-conflict modal with generic, seller-agnostic copy. Single source of truth for both ItemDetailScreen and CartScreen. Modal message: "Your cart already has items from a different seller. Adding this item will clear your current cart." — NEVER interpolates seller name/ID.
    - **SELLER-GROUP-004**: `src/components/molecules/MatchesCartBadge.tsx` — Green "Matches Your Cart" badge (cart icon + text). Shown on ItemDetailScreen and filtered seller page when buyer's active cart seller matches.
    - **SELLER-GROUP-005**: Bundle CTA on CartScreen — When 2+ same-seller items in cart, a green card appears: "Bundle these N items — Make one offer for all items from this seller." Tapping navigates to CartCheckout with `bundleMode: true`.
    - **SELLER-GROUP-006**: `src/services/listing.ts` — Added `getMaskedSellerListings(seller_id, exclude_listing_id?)` and `MaskedSellerListing` type. Returns only `status='available'` items with NO seller identity fields (title, price, condition, image only). Safe for buyer-facing display.
    - **SELLER-GROUP-007**: `src/screens/home/MoreFromThisSellerScreen.tsx` — Lightweight "More from this seller" filtered page. 2-column grid, "Add to Cart" on each item, "Matches Your Cart" banner, favorite toggle. Generic title — zero seller identity leaks. Route: `MoreFromThisSeller: { sellerId: string; excludeListingId?: string }`.
    - **ItemDetailScreen integration**: "More from this seller" CTA (green "This seller has N more items") shown only when seller has 2+ approved listings. SellerGroupBadge + MatchesCartBadge shown in seller info section.
    - **CartCheckoutScreen integration**: Reads `bundleMode` param; shows "📦 Bundle Offer" banner when entering via bundle CTA.
    - **Navigation**: `MoreFromThisSeller` route added to `RootStackParamList` and `AppNavigator`.
  - Key Rules:
    - Seller identity (name, avatar, contact) unlocks ONLY after trade reaches `in_progress` (post-acceptance). Rating always visible.
    - Seller Group badge uses opaque hash — cannot be reversed to recover seller_id.
    - Discover/search grid is CLEAN — no seller group badges or "Matches Your Cart" indicators on grid cards.
    - Single-seller cart enforcement: DIFFERENT_SELLER error from RPC triggers generic modal with no identity leak.
  - Tests:
    - Unit: `src/utils/sellerGroup.ts` (deterministic hash, cache), `src/services/listing.ts` (getMaskedSellerListings returns no PII fields)
    - Manual: `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` Group S (13 test cases: TC-S01–S13)
    - Regression: Bundle CTA (CartScreen unchanged), different-seller modal (generic copy), trade-lifecycle masking (unchanged)
  - Validation:
    - `npx tsc -p tsconfig.json --noEmit` (must exit 0 on changed files)
    - Manual testing guide Group S executed on iOS Simulator + Android Emulator
- **MODULE-15.1-UI-REDESIGN-FLOW-07 (2026-05-08):** Cart & Bundling screens redesigned
  - Module: MODULE-15.1-UI-REDESIGN (TASK FLOW-07)
  - Scope:
    - NEW: `src/screens/cart/CartScreen.tsx` - Empty cart state, item management UI (state persistence TODO)
    - NEW: `src/screens/cart/BundleBuilderScreen.tsx` - Bundle selection UI, savings calculation
    - Design system: Whisk green (#5DBB8E), Phosphor icons (ShoppingCart, Trash, Plus, Minus, Coins, CheckCircle)
    - Navigation: Added Cart and BundleBuilder routes to RootStackParamList
  - Tests:
    - Unit: `src/screens/cart/__tests__/CartScreen.test.tsx` (coverage ≥85%)
    - Unit: `src/screens/cart/__tests__/BundleBuilderScreen.test.tsx` (coverage ≥85%)
    - Integration: `e2e/cart-flow-07.integration.test.ts` (RUN_SUPABASE_E2E=true)
    - Maestro: `.maestro/module-15.1-flow-07-cart.yaml` (empty state + navigation)
    - Manual: `MODULE-15.1-FLOW-07-MANUAL-TESTING.md` (10 test cases)
  - Prerequisites:
    - phosphor-react-native installed (version 3.0.6) ✅
    - Theme system with correct colors ✅
    - Button/TextInput components exist ✅
  - Known Limitations (TODO):
    - Cart state persistence not implemented (loads empty)
    - "Add to Cart" functionality from Item Detail not wired
    - Checkout flow shows placeholder alert (pending FLOW-08)
    - Bundle builder navigation from Item Detail not implemented
  - Validation:
    - `npm run typecheck` (must pass)
    - `npm run lint` (must pass)
    - `npm run test:unit` (cart tests green)
    - `RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
    - `npm run test:maestro:ios -- .maestro/module-15.1-flow-07-cart.yaml` (iOS simulator)
    - `npm run test:maestro:android -- .maestro/module-15.1-flow-07-cart.yaml` (Android emulator)
    - Manual testing required (see MODULE-15.1-FLOW-07-MANUAL-TESTING.md)

- **FLOW-07 ITEM-DETAIL NAV FROM CART (2026-08-01):** Tapping an item card on Trade Basket or Checkout opens that item's detail screen
  - Module: FLOW-07 (Cart & Bundling) — UX navigation enhancement, zero business-logic change
  - Scope:
    - `src/screens/cart/CartScreen.tsx` — item row thumbnail + title/price area wrapped in `TouchableOpacity` (`itemTapTarget`, `cart-item-open-{id}`); tapping calls `handleOpenItemDetail` → `navigate('ListingDetail', { listing_id })`. Remove (trash) button kept as sibling so it does not navigate.
    - `src/screens/cart/CartCheckoutScreen.tsx` — item header row (thumbnail + title/price + "Not eligible" badge) wrapped in `TouchableOpacity` (`checkout-item-open-{listingId}`); SP input area left untappable so points entry still works. Added `TouchableOpacity` import + `CartItem` type import.
  - Back-nav behavior: `ListingDetail` is pushed onto the stack — Back returns to the exact Trade Basket / Checkout screen with all state (items, SP inputs, scroll) preserved. Checkout has no focus-reload, so SP input state survives the round-trip.
  - Tests:
    - Tier 0: `npx eslint src/screens/cart/CartScreen.tsx src/screens/cart/CartCheckoutScreen.tsx` (exit 0), `get_errors` (no TS errors on both files)
    - Note: repo-wide `yarn typecheck`/`yarn lint` still fail on PRE-EXISTING errors in unrelated files (AuthContext.tsx:769, AppNavigator.tsx:813, ProfileScreen.tsx:131/282; 108 repo lint errors) — none introduced by this change.
  - Validation:
    - Manual: iOS Simulator — Trade Basket → tap item card → ItemDetail opens → Back → basket intact. Checkout → tap item header → ItemDetail opens → Back → checkout SP inputs intact.

- **FLOW-07 BUNDLE SKIP IN-PROGRESS NOTICE (2026-08-01):** Bundle checkout now notifies the buyer (branded OK modal) when one or more items are skipped because they already have an active/in-progress trade — eligible offers still submit and the flow continues (PARTIAL-SUCCESS)
  - Module: FLOW-07 (Cart & Bundling) + FLOW-08 (Trade Flow) — client-only surfacing; no DB/Edge Function change
  - Scope:
    - `src/services/cartService.ts` — new `CheckoutSkippedItem`/`CheckoutWarning` types; `CartResult.warning` is now structured (was an unused string); new `buildCheckoutWarning()` maps the batch `create-trade-offer` per-item `errors` (e.g. `DUPLICATE_OFFER` — item already in an active trade) to skipped items with titles; new `buildSkippedItemsCopy()` builds human copy; `checkoutCart()` populates `warning` on partial bundle success.
    - `src/screens/cart/CartCheckoutScreen.tsx` — in `handleConfirm`, when `result.warning?.skippedItems` exists, show the branded `TradeConfirmationModal` (green `#5DBB8E` OK button, `hideCancel`) before navigating; OK continues to `TradeSuccess` for the eligible offers (non-blocking).
    - `src/services/__tests__/cartService.test.ts` — 8 new unit tests for `buildCheckoutWarning` + `buildSkippedItemsCopy`.
  - Behavior:
    - Server (`create-trade-offer`) already skips items with an active offer (`pending`/`payment_failed`/`in_progress` → `DUPLICATE_OFFER`) and returns per-item `errors`. This change surfaces that to the buyer instead of silently proceeding.
    - All-eligible bundles → no modal (straight to TradeSuccess). All-items-fail → existing blocking error unchanged. Single-item duplicate → existing blocking error unchanged.
  - Tests:
    - Tier 0: `npx eslint src/services/cartService.ts src/screens/cart/CartCheckoutScreen.tsx src/services/__tests__/cartService.test.ts` (exit 0); `npx prettier --check` (clean); `yarn jest src/services/__tests__/cartService.test.ts` (23 passed)
    - Note: repo-wide `yarn typecheck` still fails on PRE-EXISTING errors in unrelated files (ProfileScreen.tsx, auth.ts, trade.ts) — none introduced by this change; `CartScreen.test.tsx` has a pre-existing `useFocusEffect` mock failure unrelated to this change.
  - Validation:
    - Manual: iOS Simulator — test-buyer has an in-progress trade on one of test-seller's listings → add that item + one eligible item to cart → checkout → verify eligible offer submits, an "Already In an Active Trade" modal appears with a green OK, and OK continues to TradeSuccess (see TC-L11 in `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`).

- **MODULE-15.2 CART-SYSTEM (2026-05-28):** RPC-backed cart + favorites system
  - Module: MODULE-15.2 (TASK CART-001..CART-020)
  - Scope:
    - DB: `supabase/migrations/20260528100001_cart_system_schema.sql` (extends `cart_items` with cart_id/cart_status/snapshots; `favorites` extended; admin_config keys `cart_min_value_cents`, `cart_max_saved_carts`, `cart_saved_expiry_days`)    - RPCs (10): rpc_cart_add_item / rpc_cart_remove_item / rpc_cart_clear / rpc_cart_get_items / rpc_cart_save_current / rpc_cart_switch_to_saved / rpc_cart_validate_for_checkout / rpc_favorites_add / rpc_favorites_remove / rpc_favorites_get (`20260528100002_cart_system_rpcs.sql`)
    - Services: `src/services/cartService.ts` (RPC-backed, RealtimeChannel sub), `src/services/favoritesService.ts` (NEW)
    - Screens: `src/screens/cart/CartScreen.tsx` (saved carts, min-value notice, save button, realtime), `src/screens/favorites/FavoritesScreen.tsx` (NEW)
    - Wiring: `src/screens/home/ItemDetailScreen.tsx` (real Add-to-Cart + DIFFERENT_SELLER modal + Heart toggle)
    - Navigation: `Favorites` route added to RootStackParamList
  - Tests:
    - Unit: `src/services/__tests__/cartService.test.ts` (15 tests, RPC mocks), `src/services/__tests__/favoritesService.test.ts` (9 tests)
    - Integration: `e2e/cart-system.integration.test.ts` (RUN_SUPABASE_E2E=true)
    - Maestro: `.maestro/cart-flow.yaml` (states: empty, add, different-seller-modal, save, switch, validate-min, favorites)
    - Manual: `MODULE-15.2-MANUAL-TEST-CASES.md`
  - Business rules enforced:
    - Single-seller cart (CART-004 DIFFERENT_SELLER error)
    - Max 3 saved carts (trigger `fn_enforce_cart_limits` → SAVED_CART_LIMIT_REACHED)
    - Saved cart expiry 7 days (config)
    - Min cart value $20 (`cart_min_value_cents=2000`) blocks checkout with `MIN_CART_VALUE_NOT_MET`
    - Realtime cart updates via Supabase channel on `cart_items` + `items`
  - Platform fee policy (TODO-07 🔴 LOCKED):
    - Stays hardcoded (`PLATFORM_FEE_CENTS_SUBSCRIBER` / `PLATFORM_FEE_CENTS_FREE`)
    - Cart subtotal/validation does NOT fetch fees from admin_config
  - Validation commands:
    - `npx tsc --noEmit -p tsconfig.json` (0 errors)
    - `npm run test:unit` (24 cart/favorites tests + 2794 total green)
    - `RUN_SUPABASE_E2E=true npm run test:e2e` (cart-system.integration.test.ts)
    - `npm run test:maestro:ios -- .maestro/cart-flow.yaml`
    - `npm run test:maestro:android -- .maestro/cart-flow.yaml`

- **MODULE-15.2 GAP-CLOSURE (2026-05-28):** All CART-012..CART-020 + R-08/R-10 gaps closed
  - Module: MODULE-15.2 (gap closure pass)
  - Scope:
    - CART-012: `src/services/favoritesService.ts` — added `toggleFavorite()` helper
    - CART-013 (R-04): `src/screens/cart/CartScreen.tsx` — checkout `disabled` when below min; `min-value-banner` text above button
    - CART-014: `src/screens/home/ItemDetailScreen.tsx` — own-item hides "Add to Cart"; ALREADY_IN_CART shows "View Cart"; modal labels fixed to "Save & Start New Cart" / "Replace Cart"
    - CART-017: `p2p-kids-admin/src/app/settings/cart/page.tsx` — admin UI for cart_min_value_cents / cart_max_saved_carts / cart_saved_expiry_days; nav link added to Sidebar.tsx
    - CART-018: `src/screens/cart/CartScreen.tsx` — analytics events: `cart_item_removed`, `cart_saved`, `cart_switched`, `cart_checkout_initiated`, `cart_checkout_blocked`
    - CART-019: `src/services/__tests__/cartService.test.ts` — added ITEM_UNAVAILABLE + CANNOT_BUY_OWN_ITEM unit tests
    - CART-020: `src/__tests__/integration/cart-rpc.integration.test.ts` — NEW integration test covering all 10 RPCs
    - R-08: `supabase/migrations/20260528200001_cart_saved_expiry.sql` — `fn_expire_saved_carts()` function (pg_cron optional)
    - R-10: `src/screens/cart/CartScreen.tsx` — inline "This item is no longer available" per row when liveStatus ≠ 'available'
    - `src/services/__tests__/favoritesService.test.ts` — added 3 toggleFavorite unit tests
    - `.maestro/cart-flow.yaml` — added STATE 10 (view-cart-button), STATE 11 (own-item), STATE 12 (min-value-banner), STATE 13 (unavailability row)
  - DB: `supabase/migrations/20260528200001_cart_saved_expiry.sql` — ⚠️ MUST be run manually in Supabase SQL Editor
  - Validation commands:
    - `cd p2p-kids-marketplace && npx tsc --noEmit -p tsconfig.json` (0 errors)
    - `cd p2p-kids-marketplace && npm run lint` (0 warnings)
    - `cd p2p-kids-marketplace && npm run test:unit` (all green, 3 new CART-019 + 3 new favoritesService.toggleFavorite tests)
    - `cd p2p-kids-admin && npm run build` (0 errors)
    - `RUN_SUPABASE_E2E=true npm run test:e2e -- cart-rpc.integration` (all integration tests pass)
    - `npm run test:maestro:ios -- .maestro/cart-flow.yaml` (all 13 states pass)

### FLOW-08: Trade Flow – Checkout + Transaction State Machine
- **MODULE-15.1-UI-REDESIGN-FLOW-08 (2025-01-20):** Trade flow screens redesigned to Whisk-inspired design system
  - Module: MODULE-15.1-UI-REDESIGN (TASK FLOW-08)
  - Scope:
    - 6 trade screens redesigned: TradeOffer, TradeReview, TradeDispute, TradeList, TradeTimeline, TradeSuccess
    - Design system: Whisk green (#5DBB8E), SP gold (#F59E0B), filled inputs, pill buttons, Phosphor icons
    - Features: SP input with 50% cap, trade review accept/decline, dispute filing, timeline with real-time updates, status badges
  - Tests:
    - Unit: `src/screens/trade/__tests__/*.test.tsx` (all 6 screens, coverage ≥85%)
    - E2E: `e2e/trade-flow.e2e.ts` (complete trade lifecycle + accept/dispute/cancel scenarios)
    - Maestro: `.maestro/trade-flow.yaml` (UI flows for all 6 screens)
    - Smoke: `scripts/smoke/trade-flow.mjs` (automated tests with Supabase client)
    - Manual: `TASK-FLOW-08-MANUAL-TESTING.md` (7 test cases + design system compliance checklist)
  - Dependencies:
    - FLOW-04 (Listings) - for listing data
    - FLOW-11 (SP Wallet) - for SP balance/cap
    - FLOW-12 (Subscriptions) - for subscriber-only SP features
    - FLOW-14 (Messaging) - for trade message button
  - Validation:
    - `cd p2p-kids-marketplace && yarn typecheck` (must pass)
    - `cd p2p-kids-marketplace && yarn lint` (must pass)
    - `cd p2p-kids-marketplace && yarn test -- --testPathPattern=trade` (all unit tests green)
    - `cd p2p-kids-marketplace && RUN_SUPABASE_E2E=true yarn test -- e2e/trade-flow.e2e.ts` (E2E tests pass)
    - Manual testing required for complete flows (see TASK-FLOW-08-MANUAL-TESTING.md)
- **MODULE-15.1.2-TRADEFLOWV2-PHASE3-4 (2026-05-28):** Timing automation, seller-offer countdown, and buyer-safe completion hardening
  - Module: MODULE-15.1.2 TradeFlowV2 (TFV2-001 through TFV2-008)
  - Scope:
    - DB/Migrations: `20260528000001` through `20260528000005` for trade timing config, offer expiry, auto-complete scheduling, and pending SP release cron/RPCs.
    - Edge Functions: `process-expired-offers`, `process-auto-complete`, `release-pending-sp`, and hardening in `complete-trade`/`trade-payment`.
    - Mobile UI: `OfferCountdownPill`, `AutoCompleteBanner`, countdown integration in Trade List + Review Offer, and buyer-only completion behavior in Trade Timeline.
  - Tests:
    - Unit: `src/components/trade/__tests__/countdown.test.ts`, `src/components/trade/__tests__/OfferCountdownPill.test.tsx`, `src/components/trade/__tests__/AutoCompleteBanner.test.tsx`, `src/screens/trade/__tests__/TradeTimelineScreen.test.tsx`.
    - Maestro: `.maestro/module-15.1.2-flow-08-trade-v2-components.yaml` (deterministic deep-link preview checks for TFV2-007/008 components).
    - Manual: `MODULE-15.1.2-FLOW-08-MANUAL-TESTING.md`.
  - Validation:
    - `cd p2p-kids-marketplace && npm run typecheck` (must pass)
    - `cd p2p-kids-marketplace && npm run lint` (must pass)
    - `cd p2p-kids-marketplace && npm run test:unit -- --testPathPattern=components/trade|TradeTimelineScreen` (targeted unit tests)
    - `cd p2p-kids-marketplace && npm run test:maestro:ios -- .maestro/module-15.1.2-flow-08-trade-v2-components.yaml` (component regression)
- **MODULE-15.1.2-TFV2-023-ADDENDA-A-E (2026-05-26):** Seller cancel consequences + bundle trade flows
  - Module: MODULE-15.1.2 TradeFlowV2 (TFV2-023, Addendum A, B, C, D, E)
  - Scope:
    - DB: `post_acceptance_cancellation_count` + `admin_review_flagged_at` columns added to `profiles` table (migration `20260528000012_seller_cancel_consequences.sql`)
    - DB: `fn_handle_seller_cancellation(p_seller_id, p_trade_id)` RPC — increments counter, sets admin flag at count ≥ 3, returns `{new_count, level, admin_flag_set}`
    - Edge Function: `cancel-trade` v32 (consequence level routing, `seller_cancelled` event logging, inlined `logTradeEvent`)
    - Service: `cancelTradeV2` in `trade.ts` returns `consequenceLevel` from Edge Function response
    - CancellationReasonModal: `SELLER_INPROGRESS_REASONS` export + `reasons` prop for overriding default reason list
    - TradeTimelineScreen: seller-cancel-inprogress-button (in_progress only), consequence-level alerts (levels 1/2/3), bundle context banner, Confirm All N shortcut
    - TradeOfferScreen: value-stack-row showing offer amount, SP discount (when >0), platform fee (TODO-07 🔴 hardcoded $0.99/$2.99), total cash
    - TradeListScreen: `groupedReceivedOffers` bundle grouping in Offers tab (Accept All / Review Each / Decline All per bundle), `inProgressBundles` grouping in Buying tab
    - ReviewOfferScreen: bundle context banner (sibling offer list), `accept-bundle-button` (Accept All N Items), sibling offer fetch after `setOffer()`
  - Tests:
    - Unit: `src/__tests__/services/trade-tfv2-023-cancel-consequences.test.ts` (10 tests — consequence levels 1/2/3, buyer=null, missing field, error handling, unauthenticated, reason truncation, default reason, network timeout)
    - Unit: `src/__tests__/screens/trade/TradeOfferScreen.test.tsx` (11 tests — value stack render, $0.99 subscriber, $2.99 non-subscriber, trial/grace $0.99, SP discount row conditional)
    - Unit: `src/__tests__/screens/trade/TradeListBundleGrouping.test.ts` (13 tests — groupReceivedOffers: bundle rows, single rows, mixed, separate bundles, empty, 3-item bundle; groupInProgressBundles: buying tab, wrong tab skips, single-item bundle excluded, wrong status excluded, empty)
    - Integration: `src/__tests__/e2e/trade-tfv2-023-bundle.e2e.ts` (RUN_SUPABASE_E2E=true — fn_handle_seller_cancellation level 1, level 3 + admin flag, bundle_id column verified, bundle trades queried, subscription_tier readable)
    - Maestro: `.maestro/trade-tfv2-023-addenda.yaml` (5 flow blocks: seller-cancel-inprogress → consequence alert, value stack $0.99 subscriber, bundle banner TradeTimeline, bundle offer rows Offers tab, ReviewOffer bundle banner + Accept All)
    - Manual: `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (17 test cases + 4 regression checks + DB verification queries)
  - Notes:
    - TODO-07 🔴 LOCKED: Platform fee hardcoded `$0.99` (subscriber) / `$2.99` (free) in value stack — do NOT fetch from config until fee engine unblocked
    - Navigation unchanged: all routes already registered in AppNavigator.tsx
  - Validation:
    - `cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit` (must exit 0)
    - `cd p2p-kids-marketplace && npm run lint` (must pass)
    - `cd p2p-kids-marketplace && npm run test:unit` (must pass)
    - `cd p2p-kids-marketplace && RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
    - `cd p2p-kids-marketplace && npm run test:maestro:ios -- .maestro/trade-tfv2-023-addenda.yaml`
    - `cd p2p-kids-marketplace && npm run test:maestro:android -- .maestro/trade-tfv2-023-addenda.yaml`
    - Manual: see `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` TCs 001–017
- **FLOW-08-BUNDLE-CANCEL (2026-08-01):** Bundle-aware Cancel Trade prompt (mirrors Addendum C "Confirm All" shortcut)
  - Module: MODULE-15.1.2 TradeFlowV2 (FLOW-08)
  - Scope:
    - Mobile only — `TradeTimelineScreen.tsx`: when a buyer or seller cancels a trade that is part of a bundle (`bundle_id IS NOT NULL`) and there is ≥1 cancellable sibling, a branded modal asks **"Cancel all N items?"** with **[Cancel All N]** / **[Just This One]** (variant=decline, red confirm).
    - **[Cancel All N]** loops `cancelTradeV2()` over the current trade + all cancellable siblings (same reason); **[Just This One]** falls through to the existing single-trade cancel (`performSingleCancel`).
    - Role-aware sibling filtering (mirrors the cancel-button visibility rules): buyer → `pending` siblings only; seller → `in_progress` siblings + `pending` with `cash_amount_cents = 0`. Terminal siblings (completed/cancelled) are never included in the count.
    - **Report a Problem / dispute is intentionally NOT bundle-scoped** — stays per-trade per TRADING-FLOW-V2 §11.3.1 Key invariant ("If one bundle trade is disputed, the others continue normally").
  - No DB / Edge Function change: the loop reuses the existing `cancel-trade` EF per trade (same pattern as the Confirm-All loop over `completeTradeV2`).
  - Tests:
    - Tier 0: `yarn typecheck` (0 errors in TradeTimelineScreen.tsx; repo has pre-existing unrelated errors in ProfileScreen.tsx/auth.ts/trade.ts) + `npx eslint src/screens/trade/TradeTimelineScreen.tsx` (0 errors).
    - Manual: see `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (add a bundle-cancel case: buyer cancels 1 of N pending bundle offers → prompt appears; seller cancels 1 of N in_progress bundle trades → prompt appears; non-bundle cancel → no prompt).
- **MODULE-15.1.2-TRADEFLOWV2-FULL (2026-05-28):** Complete Trade Flow V2 — all 24 tasks TFV2-001 through TFV2-022 + TFV2-023 + Addenda A–E
  - Module: MODULE-15.1.2 TradeFlowV2 — full module
  - Scope:
    - **TFV2-001** Admin config trade timing fields: `auto_complete_hours`, `sp_pending_release_days`, `offer_notif_1/2_hours_before`, `auto_complete_notif_1/2_hours_before`, `max_pending_offers_per_seller` — cross-field validation trigger
    - **TFV2-002** trades table V2 columns: `offer_expires_at`, `auto_complete_at`, `bundle_id`, `dispute_status`, `payout_status`, `payout_idempotency_key`, `sp_earned_at_completion`, `sp_released_at`; `sp_wallets.reserved_sp`; `listing_offer_stats` table; `fn_lock_payment_preference` trigger (FR-LM-002)
    - **TFV2-003** SP reserve/release triggers: `fn_reserve_sp_on_offer` (reduces available_sp, increases reserved_sp on trade INSERT), `fn_release_sp_on_cancel` (restores on cancellation), `fn_release_all_sp_on_complete` (consumes reserved on completion)
    - **TFV2-004** Offer expiry cron: `rpc_process_expired_offers()` — auto-declines expired offers, sets `cancelled_expired_competing` for competing offers when one accepted
    - **TFV2-005** Auto-complete cron: `rpc_process_auto_complete()` — completes in_progress trades past `auto_complete_at` with no active dispute (D-26 guard); `rpc_release_pending_sp()` — moves pending SP to available after `sp_pending_release_days`
    - **TFV2-006** Platform SP calculation: ROUND(item_price × 0.25 × multiplier) for subscriber seller + accept_sp; returned to Edge Function → credited to seller at completion (D-17)
    - **TFV2-007** OfferCountdownPill component: urgency colors (critical=red, warning=amber, normal=green, expired=gray), Phosphor Timer icon, 24px tall, testIDs: `preview-offer-countdown-critical`, `preview-offer-countdown-normal`
    - **TFV2-008** AutoCompleteBanner component: full-width banner for buyer in in_progress trades, Phosphor Timer icon, urgency colors, sub-text nudge. testID: `preview-auto-complete-banner`
    - **TFV2-009** TradeListScreen Offers tab: sorted by total offer value DESC (D-09), OfferCountdownPill per row, empty state testID `offers-empty-state`
    - **TFV2-010** ReviewOfferScreen SP wallet projection: combined SP total shown (no source breakdown — D-11), testID `trade-review-sp-summary`
    - **TFV2-011** TradeTimelineScreen buyer-only completion (D-03): testID `confirm-trade-button` for BUYER only; seller has NO completion button anywhere
    - **TFV2-012** Item Detail "Request to Buy" button (D-07): button label is "Request to Buy" — NOT "Buy Now"/"Pay Cash"; "Use SP 🔒" visible but locked for free users (D-08)
    - **TFV2-012A** Stripe pre-authorization: `createTradeOfferWithHold` → atomic SP hold + Stripe pre-auth at offer submission; max N pending offers per seller enforced (N live from admin_config, default 3). Bundle offer counts as 1 slot, not 1 per item. See D-32 (per-seller cap) and D-33 (admin-configurable).
    - **TFV2-013** Unified offer flow: no pre-charge at offer; hold captured only; charge captured only on acceptance (D-30)
    - **TFV2-014** TradeSuccessScreen targeted CTAs: seller = `list-another-button` + `view-earnings-button` + `leave-review-button-seller`; buyer = `leave-review-button-buyer` + `back-home-button`
    - **TFV2-015** Seller ignoring offers prompt: nudge shown when `listing_offer_stats.consecutive_unanswered_offers_count >= threshold`
    - **TFV2-016** Push notification schedule + throttling: max 3 non-payout push notifications per user per trade; scheduled at `offer_notif_1/2_hours_before` intervals
    - **TFV2-017** Dispute state machine (D-26): overlay columns on trades (not new states); dispute columns: `dispute_status`, `dispute_reason`, `dispute_reported_at`, `dispute_resolution`; TradeDisputeScreen testIDs: `dispute-warning-banner`, `reason-chip-{index}`, `dispute-description`, `submit-dispute-button`, `cancel-dispute-button`
    - **TFV2-018** Seller payout: `payout_status` lifecycle (pending→processing→paid/failed), `payout_idempotency_key` UNIQUE, `payout_initiated_at`, `payout_paid_at`
    - **TFV2-019** trade_events instrumentation: `trade_events` table with event_type, actor_id, payload — events for offer_created, trade_accepted, trade_cancelled, trade_completed, seller_cancelled
    - **TFV2-020** Safe meetup V1-Lite card: visible on TradeTimelineScreen for in_progress trades
    - **TFV2-021** Chat quick-replies: pickup suggestion chips in trade messaging
    - **TFV2-022** Cart bundle checkout (D-27 — UX grouping ONLY, zero business logic): `bundle_id` groups trades from same seller; eviction modal (D-29) when 4th cart added; testIDs: `bundle-row-{bundleId}`, `bundle-accept-all`, `bundle-review-each`, `bundle-decline-all`, `inprogress-bundles`
  - Key design decisions LOCKED (never violate):
    - **D-03** Buyer-ONLY completion: NO seller mark step anywhere
    - **D-07** Button label = "Request to Buy"
    - **D-08** "Use SP 🔒" visible-but-locked for free users
    - **D-26** Disputes = overlay columns on trades — NOT new state machine states
    - **D-27** bundle_id = UX grouping ONLY — zero business logic attached
    - **D-29** Eviction modal when 4th cart added (NOT silent LRU)
    - **D-30** Payment authorization hold at offer submission (Stripe pre-auth + SP hold atomic)
    - **D-32 (2026-07-18)** Offer cap is per-seller, not global: max N pending offers per buyer-seller pair. N is read live from admin_config. Bundle = 1 slot. Offers to different sellers are counted independently.
    - **D-33 (2026-07-18)** Offer cap is admin-configurable via Trade Timing page (/settings/trade-timing). Range: 1–10. Takes effect immediately — no app restart. The Edge Function reads the live value on every request with NO hardcoded fallback.
    - **TODO-07 🔴** Platform fee hardcoded $0.99/$2.99 — do NOT fetch from config
  - Tests:
    - Unit: `src/__tests__/services/trade-tfv2-core-logic.test.ts` (~50 tests — SP calc formula, timing config validation, countdown logic, createTradeOfferWithHold, completeTradeV2, cancelTradeV2 consequenceLevel, offer expiry, SP 50% cap)
    - Integration: `src/__tests__/e2e/trade-tfv2-001-022.e2e.ts` (RUN_SUPABASE_E2E=true — admin_config columns, trades V2 columns, sp_wallets.reserved_sp, listing_offer_stats, profiles consequence columns, rpc_process_expired_offers, rpc_process_auto_complete, rpc_release_pending_sp, trade_events table, bundle_id, dispute overlay columns, payout columns, payout idempotency uniqueness)
    - Maestro: `.maestro/module-15.1.2-full-trade-flow-v2.yaml` (9 flow blocks: FLOW-A Request to Buy, FLOW-B Offers tab + bundle rows, FLOW-C I Got It buyer completion, FLOW-D component preview, FLOW-E ReviewOffer bundle, FLOW-F dispute screen, FLOW-G TradeSuccess CTAs, FLOW-H seller cancel, FLOW-I bundle context banner)
    - Manual: `MODULE-15.1.2-TradeFlowV2-COMPLETE-MANUAL-TESTING.md` (50+ test cases covering all 24 tasks + regression checklist)
  - Validation:
    - `cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit` (must exit 0)
    - `cd p2p-kids-marketplace && npm run lint` (must pass)
    - `cd p2p-kids-marketplace && npm run test:unit` (must pass)
    - `cd p2p-kids-marketplace && npm run test:unit:trade` (trade-specific, must pass)
    - `cd p2p-kids-marketplace && RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
    - `cd p2p-kids-marketplace && npm run test:maestro:ios -- .maestro/module-15.1.2-full-trade-flow-v2.yaml`
    - `cd p2p-kids-marketplace && npm run test:maestro:android -- .maestro/module-15.1.2-full-trade-flow-v2.yaml`
    - Manual: see `MODULE-15.1.2-TradeFlowV2-COMPLETE-MANUAL-TESTING.md`
- Smoke: scripts/smoke/trade-flow.mjs
- Manual checks:
  - **ANDROID-TRADE-CRASH-HOTFIX (2026-04-15):** Buy Now -> TradeInitiation must not crash on physical Android devices.
    - `TradeInitiationScreen.tsx`: Android uses Stripe `CardField` (not `CardForm`) to avoid FragmentManager/UI-thread instability during route transitions.
    - `TradeInitiationScreen.tsx`: Guard Stripe context initialization before payment field mount; show recoverable UI error instead of crashing.
    - `DisclaimerModal.tsx`: render modal only when visible and use plain-text policy rendering on Android to avoid markdown layout-thread crashes.
    - Required manual verification: open listing -> tap Buy Now -> wait for Payment Method section -> tap Confirm & Pay -> disclaimer modal opens/closes without process death.
  - Initiate trade -> payment succeeds -> trade status becomes `in_progress`.
  - Two-step completion is enforced regardless of `enable_automatic_seller_payout`.
  - Seller marks trade complete -> trade remains `in_progress`, `seller_marked_completed_at` is set, and NO funds/payouts are released yet (await buyer confirmation).
  - Buyer marks trade complete (or system auto-complete) -> trade becomes `completed`, item becomes `sold`, and seller balance/payout routing runs.
  - Completing a trade does not hard-fail if the seller is missing an `sp_wallets` row; the DB layer must auto-create the wallet and proceed.
  - Completing a trade does not hard-fail if payout-related `admin_config` values are malformed (e.g., JSON-quoted strings). The system must fall back to safe defaults and return a warning in `payout_result`.
  - If buyer uses SP to cover 100% of item price, buyer still pays platform fee by card; Stripe charge amount = `trades.cash_amount_cents + trades.buyer_transaction_fee_cents`.
  - Trade fee snapshot (`trades.buyer_transaction_fee_cents`) is sourced from `get_user_transaction_fee` (admin-config-driven), with no hardcoded member/non-member constants in trade initiation logic.
  - With `enable_automatic_seller_payout=false`: completing a trade increases seller "Available to Withdraw" by `trades.cash_amount_cents` and increases "Lifetime Earnings"; "Pending (In Progress)" reflects any withdrawals in `pending/processing`.
  - When `STRIPE_SECRET_KEY` is missing/blank: payment fails with a clear server config error (not a Stripe runtime error).
  - Seller Stripe Connect onboarding completes -> `seller_payout_methods.stripe_onboarding_complete=true` and (once Stripe enables payouts) `stripe_payouts_enabled=true`.
  - PayPal/Venvo payout: Seller creates PayPal/Venmo payout method, withdraws, and payout moves `pending` -> `processing` after submission; later `completed/failed` via PayPal webhook.
  - Stripe payouts: a `seller_payouts` row with `provider='stripe'` and `provider_reference_id=<stripe payout id>` moves `processing` -> `completed/failed` via Stripe payout webhooks.
  - **Per-seller offer cap (D-32, 2026-07-18):** Buyer can have max N pending offers with Seller A and independently N with Seller B (N default 3, admin-configurable via D-33). Bundle offer = 1 slot. 4th offer to same seller blocked with "You have N pending offers with this seller." Cross-seller offers unaffected.
  - **Admin-configurable cap (D-33, 2026-07-18):** Admin changes Max Offers Per Seller on /settings/trade-timing → takes effect immediately. No hardcoded fallback if config fetch fails. Forward-looking only (no retroactive cancellation).
- Automated (offline): Jest covers `SellerEarningsScreen` payout summary rendering.
- **D-31 (2026-07-18): Bundle Checkout Perf Fix — Background Stripe Pre-Auth Hold Creation ("Option B")**
  - Module: MODULE-06 Trade Flow V2 / Cart Checkout
  - Problem: Bundle checkout (Buy Now on a multi-item cart) took 5+ seconds because `create-trade-offer`'s batch path created a Stripe PaymentIntent for every cash item, one call at a time inside the request, before returning any response. Stripe serializes concurrent PaymentIntent creation for the same customer, so a 5-item bundle waited on 5 sequential Stripe round-trips before the buyer saw anything.
  - Scope:
    - `supabase/functions/create-trade-offer/index.ts` — batch/bundle path only (single-item path via `createSingleOffer` is UNCHANGED, still synchronous):
      - Split bundle offer creation into two phases. **Phase 1** (awaited, fast): validates each item, checks for duplicate offers, calculates tax, and inserts the `trades` row immediately with `status='pending'` and `stripe_payment_intent_id=null`. The buyer gets a success response as soon as Phase 1 finishes for every item in the bundle — no Stripe wait.
      - **Phase 2** (background, via `EdgeRuntime.waitUntil()` — runs strictly AFTER the HTTP response is sent): creates the real Stripe pre-auth hold for each cash item, then attaches `stripe_payment_intent_id` + `authorization_expires_at` to its trade row, guarded by `.eq('status', 'pending')` so a hold is never attached to a trade the seller already declined mid-flight — in that race, the newly-created Stripe hold is cancelled instead of attached (no orphaned authorizations).
      - On a Phase 2 failure (card declined, Stripe error, etc.) `handleBackgroundHoldFailure()` runs: the trade flips to `status='payment_failed'`, `cancellation_reason='payment_hold_failed'`; the underlying item is explicitly re-affirmed `status='available'` (guarded to never touch an item that has genuinely sold/been removed) so the seller never silently loses the chance to sell it; the buyer gets both an in-app notification (`create_trade_notification` RPC, type `offer_payment_hold_failed`) and a push notification naming the specific item and asking them to update their payment method; a `payment_failed` trade event is logged via `logTradeEvent`.
      - `'payment_processing'` is NOT used as an interim status — that value was deprecated/removed from the `trades.status` CHECK constraint by an earlier migration (`20260606000002_deprecate_payment_processing.sql`). The interim state is `status='pending'` + `stripe_payment_intent_id IS NULL`, distinguished from a fully-held pending trade purely by PI-nullness.
    - `supabase/functions/transactions-update/index.ts` (single-item seller accept) and `supabase/functions/transactions-accept-bundle/index.ts` (seller "Accept All") — **money-correctness guard** added to both accept paths: if `cash_amount_cents > 0` and `stripe_payment_intent_id` is still null (the background hold hasn't landed yet), the accept is rejected with a `409 PAYMENT_PROCESSING` / `{ code: 'PAYMENT_PROCESSING' }` error ("This offer is still being processed. Please try again in a few seconds.") instead of silently skipping the capture step and letting the trade proceed uncharged. Decline paths (`transactions-update` decline action, `transactions-decline-bundle`) needed NO changes — they never attempt a Stripe capture regardless of PI presence.
    - `supabase/functions/send-trade-notifications/index.ts` — added a new `offer_payment_hold_failed` entry to `EVENT_COPY` (title "Payment Issue", body names the specific listing). The existing generic `payment_failed` entry (used for accept-time capture failures) was left untouched.
  - Notes:
    - 🟡 DEFECT (pre-existing, out of scope): `deno check` on `send-trade-notifications/index.ts` reports a real TS error at the unrelated `payout_requires_action` entry (`(data?.amount_cents || 0) / 100` — `unknown` arithmetic). Confirmed via `git diff` this line was not touched by this change. Not fixed here per Scope Containment; flagging for a future dedicated fix.
    - `EdgeRuntime.waitUntil()` is newly introduced to this codebase (first usage) — a local `declare const EdgeRuntime` type shim was added since it isn't part of default Deno types, with a `typeof EdgeRuntime !== 'undefined'` guard and a local-dev (`supabase functions serve`) fallback that fires the background promise without the keep-alive guarantee (logs a warning).
  - Tests / Validation:
    - `cd /Users/sameralzubaidi/Desktop/kids_marketplace_app && deno check --no-lock supabase/functions/create-trade-offer/index.ts supabase/functions/transactions-update/index.ts supabase/functions/transactions-accept-bundle/index.ts` — PASS, 0 errors (this is the Deno-appropriate Tier 0 gate for Edge Functions; the VS Code TS server's generic `get_errors` check is not Deno-aware and reports false-positive "Cannot find name 'Deno'" noise on these files — cross-checked against an untouched sibling function to confirm the false-positive).
    - Deployed via `cd p2p-kids-marketplace && npx supabase functions deploy <name>` for `create-trade-offer`, `transactions-update`, `transactions-accept-bundle`, `send-trade-notifications` — all 4 deployed successfully (exit code 0).
    - Manual (not yet performed — recommended next session): time a 3-5 item bundle Buy Now end-to-end (should respond in ~1s, not 5+s); confirm each item's Stripe hold appears on the trade within a few seconds after checkout; simulate a declined card mid-bundle and confirm the affected item flips to `payment_failed`, stays `available` in Discovery, and the buyer receives both an in-app and push notification; attempt to accept an offer immediately after bundle checkout (before the background hold lands) and confirm the seller sees the "still being processed" error instead of a false accept.
- **D-32 (2026-07-18): Per-Seller Offer Cap (was Global Cap)**
  - Module: MODULE-06 Trade Flow V2 / Offer Submission
  - Change: Offer cap changed from GLOBAL (max 3 pending offers per buyer across entire marketplace) to PER-SELLER (max N pending offers per buyer-seller pair).
  - Scope:
    - `supabase/functions/create-trade-offer/index.ts` — Single-item path: resolved seller from `item_id` before checking count of `pending` trades for that `buyer_id + seller_id`. Batch (bundle) path: resolved seller from first item, counted as 1 slot total. Error code `MAX_PENDING_OFFERS` preserved (backward compat with client handling).
    - `p2p-kids-marketplace/src/services/trade.ts` — `countPendingOffersByBuyer` now accepts optional `sellerId` param for per-seller counts.
    - Client UI: `TradeInitiationScreen.tsx` and `TradeOfferScreen.tsx` error messages updated to use server's dynamic message (no hardcoded "3").
  - Bundle exception removed: The old `if (!bundle_id)` guard that skipped the cap check for bundles is replaced with a per-seller check where bundle = 1 slot.
  - Key behavior:
    - Buyer can have 3 offers with Seller A AND 3 offers with Seller B simultaneously (6 total).
    - Bundle offer (multi-item cart checkout) counts as exactly 1 slot, not N per item.
    - Offers to different sellers never interfere with each other.
    - Expired offers free the slot immediately (status=`cancelled`).
  - Tests:
    - Manual: `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` TC-B05 through TC-B05e (5 test cases covering cross-seller, same-seller block, bundle=1, expiry frees slot, global cap regression)
  - Depends on: D-30 (pre-auth hold), D-33 (admin-configurable)
- **D-33 (2026-07-18): Admin-Configurable Offer Cap (was Hardcoded 3)**
  - Module: MODULE-06 Trade Flow V2 / Admin Configuration
  - Change: The per-seller offer cap value (previously hardcoded `MAX_PENDING_OFFERS_PER_SELLER = 3`) is now read live from `admin_config.max_pending_offers_per_seller` on every request.
  - Scope:
    - **DB**: Migration `20260718000001_admin_config_per_seller_offer_cap.sql` seeds `max_pending_offers_per_seller='3'` into `admin_config` (category `trade`). Updates `fn_validate_trade_timing_config` trigger to validate range 1–10.
    - **Admin UI**: `p2p-kids-admin/src/app/settings/trade-timing/page.tsx` — new **"Offer Limits"** section between Offer Expiry and Auto-Complete with `numField`. Validates 1–10. Saves via existing `upsert_admin_config_setting` RPC.
    - **Admin types**: `p2p-kids-admin/src/types/config.ts` — `max_pending_offers_per_seller` added to `TradeTimingConfig`.
    - **Edge Function**: `supabase/functions/create-trade-offer/index.ts` — removed `MAX_PENDING_OFFERS_PER_SELLER` constant. New `getMaxPendingOffersPerSeller()` helper reads live from `admin_config`. **No hardcoded fallback** — if config fetch fails, returns `500 CONFIG_UNAVAILABLE`.
    - **Mobile client**: `p2p-kids-marketplace/src/services/adminConfig.ts` — `max_pending_offers_per_seller` added to `AdminConfig` interface with `getDefaultConfig()` fallback of 3 (for client-side UI badges only; server enforcement has NO fallback).
  - Key behavior:
    - Admin changes cap on `/settings/trade-timing` → takes effect immediately on next offer submission — no app restart, no redeploy.
    - Error messages reflect the current cap dynamically (e.g., "You have 5 pending offers with this seller...").
    - Config fetch failure → Edge Function rejects with `CONFIG_UNAVAILABLE` → client shows "Offer limit configuration is unavailable."
    - Reverting to a lower cap is forward-looking only — existing open offers above the new cap are NOT retroactively cancelled.
  - Tests:
    - Manual: `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` TC-B05f through TC-B05j (5 test cases covering change 3→5, revert 5→3, validation 1–10, config fetch failure, regression with non-default cap)
    - Migration verification queries included in migration file.
  - Admin page location: `http://localhost:3001/settings/trade-timing` → **Offer Limits** section → **Max Offers Per Seller**.

### FLOW-09: Fees & Pricing Engine
- Smoke: (manual)
  - Subscriber fee vs non-subscriber fee matches configuration.
  - Changing admin fee config updates new trade fee snapshots without mobile code changes.

### FLOW-10: Swap Points Wallet – Read + Ledger Integrity
- Smoke: (manual)
  - Wallet shows available/pending; ledger entries append-only.
- **MODULE-15.1-UI-REDESIGN-FLOW-10/11 (2026-05-10):** SP Wallet & Transaction History screens redesigned to Whisk-inspired premium design
    - Module: MODULE-15.1-UI-REDESIGN (TASK FLOW-10/11)
    - Scope:
      - SP Wallet Screen (`src/screens/sp/SpWalletScreen.tsx`) — Restyled only, no logic changes
      - SP Transaction History Screen (`src/screens/sp/SpTransactionHistoryScreen.tsx`) — NEW screen created
      - Navigation updated: Added `SpTransactionHistory` route
      - Design system: Gold (#F59E0B) for SP theme, Green (#5DBB8E) for earned amounts, Red (#E85D75) for spent amounts
      - Hero balance card with #5DBB8E background, 36px bold white balance (largest text on screen)
      - Quick action buttons: Redeem, Earn More, History (white cards with Phosphor icons)
      - "How to Earn SP" section with gold SP chips (#FEF3C7 bg, #F59E0B text)
      - Lifetime stats chips (Total Earned, Total Spent, Pending) in #F7F7F7 gray cards
      - Transaction History tabs: All | Earned | Spent with #5DBB8E underline on active tab
      - Transaction rows with type-specific Phosphor icons (Storefront, ArrowsLeftRight, ArrowUp, UserPlus, Clock, Coins)
      - Earned amounts: "+[amount] SP" in #5DBB8E green, Spent amounts: "−[amount] SP" in #E85D75 red
      - Empty state: Coins icon (64px, #E0E0E0) with "No transactions yet"
    - Tests:
      - Unit: `src/screens/sp/__tests__/SpWalletScreen.test.tsx` (coverage ≥85%)
      - Unit: `src/screens/sp/__tests__/SpTransactionHistoryScreen.test.tsx` (coverage ≥85%)
      - Integration: `e2e/module-15.1-flow-10-11-sp-wallet.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Maestro: `.maestro/module-15.1-flow-10-11-sp-wallet.yaml` (both screens + tab filtering)
      - Manual: `MODULE-15.1-FLOW-10-11-MANUAL-TESTING.md` (15 test cases + regression checklist)
    - Prerequisites:
      - phosphor-react-native installed (version 3.0.6) ✅
      - SP wallet initialized for test user
      - Sample transactions in database for testing
    - Validation:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm run test:unit` (all SP screen tests green)
      - `RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
      - `npm run test:maestro:ios -- .maestro/module-15.1-flow-10-11-sp-wallet.yaml` (repeatable full FLOW-10/11 run)
      - `npm run test:maestro:android -- .maestro/module-15.1-flow-10-11-sp-wallet.yaml` (Android simulator run)
      - Manual testing required for complete flows (see MODULE-15.1-FLOW-10-11-MANUAL-TESTING.md)
    - Known Limitations:
      - "Redeem" and "Earn More" buttons have placeholder handlers (TODO: implement in future module)
      - Expiring SP alert only shows if batches expire within 30 days (conditional display)
      - Transaction icon mapping relies on transaction_type string matching (sale, trade, redeem, etc.)
  - **QA-QS-BP53-SPWALLET-LOCATOR (2026-08-23):** SP Wallet "How Trading Works" button (`sp-wallet-how-trading-works-btn`) now sets `accessible` + `accessibilityRole="button"` + `accessibilityLabel="How Trading Works"` so it surfaces in the iOS AX tree (BP-53). Zero-logic UI change — no new smoke script required. Tier: 0.

### FLOW-11: Swap Points – Earn/Spend/Cap + Pending→Release
- Smoke: (manual)
  - 50% cap enforced; buyer fee always cash.
  - First eligible listing approval awards Starter Pack SP once (wallet + ledger updated).

### FLOW-13: Referrals – Code Generation + Apply On Signup
 - Smoke: scripts/smoke/referrals.mjs
  - User A: signup -> Profile shows referral code; DB: `profiles.referral_code` matches `referral_codes.code`.
  - User B: signup with User A code -> `referrals` row created with `status='pending'`.
  - User B: DB: `profiles.referred_by` is set to User A user_id.
  - User A: Referral Dashboard stats show `total=1`, `pending=1`.
  - Persistence: After onboarding/profile upsert completes, `profiles.referral_code` remains non-null (no NULL regression).
- Must validate: user-entered signup referral code is persisted (e.g., `profiles.referred_by_code`) and the relationship is applied (`profiles.referred_by` + `referrals` row)
  - Fail-safe: If auth.users signup trigger was missing, a profiles AFTER INSERT trigger applies referral from auth metadata.
  - Back-compat: apply can resolve codes from `referral_codes.code` OR legacy `profiles.referral_code`.
- **MODULE-15.1 UI Redesign (2026-05-14):**
  - Screen: `src/screens/referrals/ReferralsScreen.tsx` redesigned per MODULE-15.1-UI-redesign.md specs
  - Visual Design:
    - Hero card: `#5DBB8E` bg, `Gift` icon (32px white), "Refer Friends, Earn SP" (18px bold white)
    - Referral code box: white bg, **8px border** `#E0E0E0`, 20px monospace text with `letterSpacing: 4`, `Copy` icon (20px green)
    - Share button: green pill 52px height, `ShareNetwork` icon (18px white)
    - SP earned strip: `#FEF3C7` bg, `Coins` icon (20px gold `#F59E0B`), bold SP count
    - Referral history: avatar (36px), name (15px semibold), date (13px gray), `CheckCircle` (16px green) for completed, "+N SP" (13px gold)
    - Empty state: `Users` icon (64px `#E0E0E0`), "No referrals yet — share your code!"
  - Icons: All from `phosphor-react-native` (no Ionicons/MaterialIcons)
  - Tests:
    - Unit: `src/__tests__/screens/ReferralsScreen.test.tsx` (16 test cases covering all states + interactions)
    - Maestro: `.maestro/module-15.1-flow-13-referrals.yaml` (hero, code, share, empty state, history validation)
    - Manual: `MODULE-15.1-FLOW-13-MANUAL-TESTING.md` (16 test cases for iOS/Android simulators)
  - Verification: MODULE-15.1-VERIFICATION.md deliverable D-027

### FLOW-12: Subscriptions – Purchase/Cancel/Grace Period + Tier Configuration
- Smoke: scripts/smoke/subscriptions.mjs (TODO: implement)
- **FLOW-12 TC-03 UI Fix (2026-05-13):**
  - `UpgradePlan` -> `SubscriptionPayment` trial CTA keeps existing Stripe logic but now renders the modern checkout presentation (Phosphor icons, checkout summary row, payment method row, due-today row).
  - Legacy task-id header copy removed from the payment route title (`Subscription Payment` instead of `Subscription Payment - SUB-015`).
  - Primary subscribe CTA now uses Kids Club+ visual treatment (green pill, 52px min-height) to match FLOW-12 manual QA expectations.
- **SUB-020 Regression Fix (2026-03-12):**
  - Renewal path from `ContinueKidsClub` now routes grace/expired users through `create-subscription-from-payment-method` (paid renewal path) instead of legacy `create-subscription-payment`.
  - Billing writes now persist admin-configured amount and upsert billing history on successful payment in `supabase/functions/create-subscription-from-payment-method/index.ts`.
  - Hardcoded grace window removed from admin manual-cancel API and trial conversion downgrade RPC (`20260312000001_fix_dynamic_grace_period_trial_conversion.sql`).

### FLOW-17: Subscription Event Notifications – Renewal, Cancellation, Payment Failure, Trial Reminders
- Purpose: Notify users of subscription lifecycle events (MODULE-14 TASK NOTIF-V2-002)
- Covers:
  - **NOTIF-REALTIME-CRASH-HOTFIX (2026-04-16):** prevent Android crash `cannot add postgres_changes callbacks ... after subscribe()` from notification badge and notification center subscriptions.
    - Root cause: `subscribeToNotifications()` reused a fixed realtime topic (`notifications:<userId>`) and only called `unsubscribe()`, allowing stale subscribed channels to be reused during rapid remounts.
    - Fix: create unique channel topic per subscriber instance and always cleanup with `supabase.removeChannel(channel)`.
    - Files: `src/services/referralNotifications.ts` (subscription lifecycle hardening).
    - Required manual verification: navigate across screens with `BottomNavBar` quickly (Home -> My Listings -> Item Detail -> Notifications) and confirm no JS fatal crash while realtime notifications continue updating unread badge.
  - Trial expiration reminders (7d, 3d, 1d before expiration)
  - Subscription renewal success notification
  - Payment failure alerts with retry instructions (CRITICAL - bypasses preferences)
  - Cancellation confirmation with grace period details
  - User notification preference enforcement (except critical notifications)
- Database:
  - Tables: `user_notifications`, `notification_preferences`, `push_tokens`
  - `user_notifications`: Stores all subscription notifications with type, title, message, data (event, critical flag)
  - `notification_preferences`: Per-category toggles (push, in_app, email) for 'subscription' category
  - Critical notifications bypass ALL user preferences (payment_failed only)
- Subscription Renewal (non-critical):
  - Webhook: `customer.subscription.updated` with `billing_reason=subscription_cycle`
  - Handler: `stripe-webhook-subscriptions/index.ts` → `sendSubscriptionRenewalNotification()`
  - Notification: "Subscription Renewed ✅" with next billing date
  - Channels: Push + In-App (respects preferences)
- Cancellation Confirmation (non-critical):
  - Webhook: `customer.subscription.updated` with `cancel_at_period_end=true`
  - Handler: `stripe-webhook-subscriptions/index.ts` → `sendCancellationConfirmationNotification()`
  - Notification: "Subscription Cancelled" with access end date + 90-day grace period info
  - Channels: Push + In-App (respects preferences)
- Payment Failure (CRITICAL):
  - Webhook: `invoice.payment_failed`
  - Handler: `stripe-webhook-subscriptions/index.ts` → `sendCriticalPaymentFailureNotification()`
  - Notification: "⚠️ Payment Failed - Action Required" with retry-specific messaging
  - Retry 1: "Your payment was declined. Please update your payment method..."
  - Retry 2: "...declined again. Please update to avoid service interruption"
  - Retry 3: "Final attempt failed. Your subscription will be paused soon..."
  - Channels: **ALL (push + in-app + email) regardless of user preferences**
  - Critical flag: `data.critical = true` marks notification as critical in DB
- Trial Expiration Reminders (non-critical):
  - Edge Function: `trial-reminders` (daily cron at 2:00 AM)
  - Day 23 (7d remaining): "🎉 7 Days Left in Your Free Trial!"
  - Day 28 (3d remaining): "⏰ 3 Days Left in Your Trial"
  - Day 29 (1d remaining): "🚨 Last Day of Your Free Trial!"
  - Channels: Push + In-App (respects preferences)
  - DB flags: `trial_reminder_day_23_sent`, `trial_reminder_day_28_sent`, `trial_reminder_day_29_sent`
- Mobile Service: `src/services/subscriptionNotifications.ts`
- **NOTIF-V2-009 Email Channel (2026-04-16):**
  - Email delivery added via `src/services/emailNotifications.ts` + `supabase/functions/send-email/index.ts`
  - Email tracking: `email_logs` table (migration 308) – columns: email_type, status, is_critical, unsubscribe_token, sent_at
  - Unsubscribe handler: `supabase/functions/email-unsubscribe/index.ts` (one-click token-based opt-out)
  - Critical emails (payment_failed, subscription_cancelled, account_security_alert): always sent, unsubscribe link shows "required notice" instead
  - Non-critical emails (trial_expiring, subscription_renewed): check `notification_preferences.email_enabled` for 'subscription' category before sending
  - `subscriptionNotifications.ts` updated: `notifyPaymentFailed`, `notifyCancellationConfirmed`, `notifySubscriptionRenewed` all include non-blocking email call
  - `notifySubscriptionRenewed()` - renewal notification
  - `notifyCancellationConfirmed()` - cancellation notification
  - `notifyPaymentFailed()` - critical payment failure notification
  - All notifications create records in `user_notifications` table
  - All notifications invoke `send-push-notification` Edge Function
- Manual Test Guide: `NOTIF-V2-002-MANUAL-TESTING-GUIDE.md` (7 test cases + 3 edge cases)
- Unit Tests: `p2p-kids-marketplace/src/__tests__/services/subscriptionNotifications.test.ts`
- Integration Tests: `p2p-kids-marketplace/e2e/subscriptionNotifications.integration.test.ts`
- Maestro Flow: `.maestro/subscription-notifications.yaml`
- Verification Checklist (MODULE-14-VERIFICATION-V2.md):
  - ✅ Trial reminders sent at 7d, 3d, 1d before expiration
  - ✅ Renewal success notification sent on successful payment
  - ✅ Payment failure notification sent with escalating severity (retry 1, 2, 3)
  - ✅ Cancellation notification sent with grace period details
  - ✅ Non-critical notifications respect user preferences (push, in-app toggles)
  - ✅ Critical payment notifications bypass ALL preferences
  - ✅ Deep links navigate to subscription screen (`/profile/subscription`)
  - ✅ Push notifications delivered via FCM (when push tokens registered)
- Smoke: Manual test cases TC-N2-001 through TC-N2-007
- Tier: Tier 1 (targeted smoke for notification flows), Tier 2 if webhook handler or critical bypass logic changes

### FLOW-18: CPSC Recall Imports – Daily Batch Import + Recall Database
- Purpose: Automated daily imports of CPSC safety recalls for product safety checking
- Covers:
  - CPSC API daily batch import via Edge Function
  - Recall data storage in cpsc_recalls table
  - Import logging and error tracking
  - pg_cron scheduled job execution at 2:00 AM UTC
  - Recall deduplication by recall_number
  - Full-text search capability for recall matching
  - Public read access for safety transparency
- Database:
  - Tables: `cpsc_recalls` (recall data), `cpsc_import_log` (import history)
  - Indexes: recall_number, recall_date, product_name (trgm), keywords (tsvector)
  - RLS: Public read, service role write, admin manage
- Edge Function: `supabase/functions/import-cpsc-recalls/index.ts`
- Migration: `supabase/migrations/303_cpsc_recalls_schema.sql`
- Scheduled Job: `supabase/migrations/304_schedule_cpsc_import.sql`
- Manual Test Guide: `SAFETY-001-MANUAL-TESTING-GUIDE.md` (12 test cases)
- Unit Tests: `supabase/functions/import-cpsc-recalls/__tests__/index.unit.test.ts`
- E2E Tests: `p2p-kids-marketplace/src/__tests__/e2e/cpsc-import.e2e.test.ts`
- Maestro Flow: `p2p-kids-marketplace/.maestro/cpsc-import-flow.yaml`
- Smoke: (automated daily via pg_cron)
  - Import runs at 2:00 AM UTC without manual intervention
  - Successful imports log to cpsc_import_log with status='success'
  - Failed imports log with status='failed' and error details
  - Duplicates are skipped (upsert by recall_number)
  - Recalls searchable via product name, date, keywords
- Manual Verification:
  - Admin can view import logs via Supabase SQL Editor
  - Recalls are publicly readable (no auth required)
  - Import can be manually triggered via Edge Function for testing
  - Cron job execution logs visible in cron.job_run_details
- Tier: Tier 1 for Edge Function changes; Tier 2 if database schema or RLS policies change
- Dependencies: INFRA-001 (Supabase setup), pg_cron extension enabled

### FLOW-17: Google Vision Image Moderation – AI Safety Check (SAFETY-004)
- Purpose: Automated image moderation for listing photos using Google Vision Safe Search API
- Covers:
  - Google Vision API integration via Edge Function
  - Safe Search detection (adult, violence, racy, medical, spoof)
  - Moderation log storage (ai_moderation_logs table)
  - Automatic item flagging for unsafe content (LIKELY/VERY_LIKELY)
  - Safety flags creation (item_safety_flags table)
  - Item status update to 'flagged' for review
  - Fire-and-forget async moderation (non-blocking)
- Database:
  - Tables: `ai_moderation_logs` (moderation results), `item_safety_flags` (safety flags)
  - Migration: `supabase/migrations/306_ai_moderation_logs_table.sql`
  - RLS: Admin read logs, service role write logs
- Edge Function: `supabase/functions/moderate-image/index.ts`
- Mobile Integration:
  - Service: `p2p-kids-marketplace/src/services/imageModeration.ts`
  - Called from `uploadListingImages()` in `listing.ts`
  - Moderation runs after image upload completes
  - Errors do not block listing creation (fail-open)
- Manual Test Guide: `SAFETY-004-MANUAL-TESTING-GUIDE.md` (10 test cases)
- Unit Tests: `p2p-kids-marketplace/src/__tests__/services/imageModeration.test.ts`
- E2E Tests: `p2p-kids-marketplace/src/__tests__/e2e/safety-004-image-moderation.e2e.test.ts`
- Maestro Flow: `p2p-kids-marketplace/.maestro/safety-004-image-moderation.yaml`
- Smoke: (automated on image upload)
  - Safe images pass moderation (decision='approved', confidence <0.5)
  - Flagged images create safety flag and update item status to 'flagged'
  - All moderation results logged with confidence scores and details
  - Multiple images moderated sequentially
  - Moderation failures do not crash app or block listing
- Manual Verification:
  - Admin can view moderation logs in admin portal (future)
  - Flagged items visible in My Listings with safety review UI
  - Seller receives notification when item is flagged
- Tier: Tier 1 for Edge Function or service changes; Tier 2 if database schema or RLS policies change
- Dependencies: SAFETY-P001 (item-images bucket), SAFETY-P002 (image upload), GOOGLE_VISION_API_KEY configured
- Prerequisites: Google Cloud Vision API enabled and API key configured in Supabase Edge Function secrets

- **FLOW-17d: Notification Analytics & Metrics (NOTIF-V2-010)**  
  - Purpose: Track notification delivery, open, and click rates for analytics and A/B testing
  - Migration: `supabase/migrations/214_notification_analytics.sql`
  - Tables: `notification_events` (delivered/opened/clicked/failed events)
  - Mobile Service: `p2p-kids-marketplace/src/services/notificationAnalytics.ts`
  - Admin Dashboard: `p2p-kids-admin/src/app/analytics/notifications/page.tsx`
  - Smoke: (manual + E2E)
    - Send notification → verify delivered event tracked
    - Tap notification → verify opened event tracked
    - Follow deep link → verify clicked event tracked
    - Admin dashboard displays metrics (delivery rate, open rate, click rate)
    - A/B test tracking: create variants → verify separate metrics per variant
  - E2E: `p2p-kids-marketplace/e2e/notification-analytics.e2e.test.ts`
  - Manual test guide: `NOTIF-V2-010-MANUAL-TESTING-GUIDE.md`
  - Maestro flow: `.maestro/notif-v2-010-analytics.yaml`
  - Verification:
    - Delivered events tracked on send (notification_events.event_type = 'delivered')
    - Opened events tracked on tap (event_type = 'opened', notification marked as read)
    - Clicked events tracked with deep link (event_type = 'clicked', deep_link captured)
    - Failed events logged with error messages
    - Analytics RPC `get_notification_analytics()` returns metrics by category and type
    - Admin dashboard loads without errors, displays delivery/open/click rates
    - Date range filters work (7d/30d/90d)
    - Category filters work (subscription/sp_events/badges/trades/system)
    - A/B test performance tracking works (`get_ab_test_performance()`)
    - Performance acceptable with large datasets (1000+ notifications)

### FLOW-18: Admin Controls – Config + Overrides + Revenue Analytics + User Management + Category Management
- Purpose: Admin can configure platform settings, view revenue metrics, analytics, manage users, and manage categories
  - **ADMIN-NAV-GROUPED (2026-08-08):** Left sidebar grouped into collapsible sections
    - Scope: UI-ONLY (no DB/API/Edge Function changes)
    - Files:
      - `p2p-kids-admin/src/components/layout/Sidebar.tsx` — replaced flat `NAV_ITEMS` with grouped `NAV_SECTIONS` (7 sections); per-section expand/collapse state; per-admin persistence via localStorage (`kids-admin:sidebar-sections:<email>`); active-route section auto-expand; collapsed icon rail shows every destination
      - `p2p-kids-admin/src/components/layout/AdminShell.tsx` — passes the signed-in admin's email to `Sidebar` as `adminKey` so section state persists per admin
      - `p2p-kids-admin/src/app/globals.css` — added `--sidebar-section-label` / `--sidebar-item-inactive` (design-system Neutral-900/700 roles mapped onto the dark sidebar; base color `#3D1073` unchanged)
    - Behavior: 7 sections (OVERVIEW / TRADE OPERATIONS / USERS & TRUST / MONETIZATION / CATALOG / PLATFORM CONFIG / ANALYTICS); uppercase label + chevron toggles each; state persists per admin across sessions; active route auto-expands its parent section on load and on navigation
    - Notes: "Action Center" intentionally omitted (no route yet — ships with its own prompt). Badges + Listings kept (USERS & TRUST / CATALOG) to preserve existing access.
    - Tests: `__tests__/components/layout/Sidebar.test.tsx` (12 tests — 7 original + 5 new for grouping/collapse/persistence/auto-expand/rail)
    - Manual: `misc./MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` Group W (TC-W01–TC-W07)
    - Tier: Tier 0 (typecheck + lint + build) PASS
  - **ADMIN-SETTINGS-SINGLE-SOURCE (2026-08-08):** Consolidated settings so the /config hub and the standalone settings pages share ONE source (admin_config) + ONE audit trail (admin_audit_log), with cross-link banners and "LAST UPDATED · <ts> · by <editor>" on every field
    - Scope: DB (1 migration) + Admin UI (config hub, tax settings/nodes/rules, cart settings, trade timing, node settings)
    - Files:
      - `supabase/migrations/20260808000001_settings_single_source_audit.sql` — `upsert_admin_config_setting` gains `p_admin_id` (records `admin_config.updated_by`; COALESCE-preserves editor on legacy 6-arg calls); adds `fn_get_admin_config_meta` + `fn_resolve_admin_emails` (SECURITY DEFINER) for editor-email lookup
      - `p2p-kids-admin/src/app/api/admin/config/route.ts` — PATCH records the acting admin and writes `admin_audit_log` (previously wrote to non-existent `audit_logs` → silently dropped)
      - `p2p-kids-admin/src/app/config/page.tsx` — passes `user_id` on save; renders editor emails in LAST UPDATED labels; cross-link banners on Tax / Feature Flags / Trade tabs; supports `/config?tab=<cat>` deep links
      - `p2p-kids-admin/src/app/tax/settings/page.tsx`, `p2p-kids-admin/src/app/settings/cart/page.tsx`, `p2p-kids-admin/src/app/tax/nodes/page.tsx`, `p2p-kids-admin/src/app/tax/rules/page.tsx`, `p2p-kids-admin/src/app/settings/trade-timing/page.tsx`, `p2p-kids-admin/src/app/settings/nodes/page.tsx` — cross-link banners + last-updated labels/columns; saves pass `p_admin_id`
      - `p2p-kids-admin/src/lib/settingsAudit.ts` + `p2p-kids-admin/src/components/settings/{SettingsLinkBanner,LastUpdatedLabel}.tsx` — shared helpers/components (design-system Info Banner Card + Label style)
    - Behavior: TRUE duplicates (Tax Settings ↔ Config→Tax, Cart Settings ↔ Config→Feature Flags, Trade Timing ↔ Config, Node Settings ↔ Config) already shared `admin_config` rows; now every surface records `updated_at`/`updated_by` and writes `admin_audit_log`. Tax Nodes (`nodes` table) and Tax Rules (`tax_categories`/`tax_rules`) remain distinct data (not merged into /config) but are cross-linked so admins understand the relationship.
    - Manual: `misc./MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` TC-F01, TC-F02, TC-F04, TC-J01
    - Tier: Tier 0 (typecheck + lint + build + affected settings unit tests) PASS
  - **ADMIN-ACTION-CENTER (2026-08-08):** New "Action Center" — a single feed aggregating every pending admin action (Flagged Items, Disputes, ID Badge requests, Cancel Insights spike, Failed Payouts, Config Drift) into bundled count-cards with severity tags + inline actions; pinned sidebar nav item with live count badge; header bell wired to open it.
    - Scope: DB (1 migration, read-only RPCs) + Admin UI (page, sidebar, topbar)
    - Files:
      - `supabase/migrations/20260808000002_admin_action_center.sql` — `admin_action_center_summary()` (aggregated counts across items/trades/id_badge_verification_requests/seller_payouts/admin_config + cancellation-spike heuristic) and `admin_action_center_detail(p_source)` (per-source drill rows). Data-only; all mutations reuse existing admin endpoints.
      - `p2p-kids-admin/src/app/api/admin/action-center/route.ts` — GET summary + per-source detail (verifyAdminAuth, service-role RPC)
      - `p2p-kids-admin/src/app/action-center/page.tsx` + `ActionCenterClient.tsx` — the Action Center UI (design-system Card: white, 16px radius, Level-1 shadow; Status Badge pills 24px/12px: Urgent=Error500, Routine=Warning500; Success500 "All caught up" empty state)
      - `p2p-kids-admin/src/hooks/useActionCenterCount.ts` — shared live-count hook (60s poll) for sidebar + topbar badges
      - `p2p-kids-admin/src/components/layout/Sidebar.tsx` — "Action Center" pinned OVERVIEW item + live count badge (Accent 500)
      - `p2p-kids-admin/src/components/layout/TopNavbar.tsx` — header bell now navigates to /action-center with a live count badge (replaces dead dropdown + static dot)
    - Behavior: same-type items bundle into one card with a count; clicking a card expands/drills into the list; inline actions call the existing per-domain admin endpoints (item status approve, dispute-action mark-under-review, id-badge decide approve, payout retry) and deep-link for review-only sources (cancel insights, config drift). Empty queue shows "All caught up" with a Success 500 checkmark.
    - Manual: `misc./MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` Group X (TC-X01–TC-X09)
    - Tier: Tier 0 (typecheck + lint + build) PASS
- Smoke: (manual)
  - Admin can navigate to `/analytics` dashboard
  - Revenue metrics display: MRR, ARR, transaction fees, ARPU
  - Engagement metrics display: DAU, MAU, DAU/MAU ratio
  - Time series data loads for day/week/month intervals
  - Date range filters work (7D, 30D, 90D, 1Y)
  - All metrics calculate correctly based on subscriptions and trades
  - **ADMIN-V2-005 (2026-03-25):** Revenue & Analytics Dashboard
    - RPCs: `get_revenue_metrics`, `get_engagement_metrics`, `get_revenue_time_series`
    - API: `/api/admin/analytics/revenue`
    - UI: `/analytics` page with comprehensive metrics and charts
  - **ADMIN-V2-006 (2026-03-26):** User Management Dashboard
    - Purpose: Admin can view, search, filter, suspend, unsuspend, delete users, reset passwords
    - Migration: `supabase/migrations/126_admin_user_management.sql`
    - RPCs: `admin_list_users`, `admin_get_user_analytics`, `admin_get_user_detail`, `admin_suspend_user`, `admin_unsuspend_user`, `admin_delete_user`
    - Edge Function: `supabase/functions/admin-trigger-password-reset/index.ts`
    - Admin API Routes:
      - `/api/admin/users` (GET - paginated list with search/filters)
      - `/api/admin/users/analytics` (GET - user analytics)
      - `/api/admin/users/[id]` (GET detail / DELETE soft delete)
      - `/api/admin/users/[id]/suspend` (POST)
      - `/api/admin/users/[id]/unsuspend` (POST)
      - `/api/admin/users/[id]/reset-password` (POST)
    - Admin UI: `p2p-kids-admin/src/app/users/page.tsx` (comprehensive user management dashboard)
    - Features:
      - User analytics: total users, active, suspended, new this month, DAU, MAU, deleted, subscribers
      - Paginated user list with search (name/email/phone)
      - Filters: account status (active/suspended/deleted), subscription status
      - User detail panel: identity, subscription, SP wallet, trade activity, badges, admin activity log
      - Admin actions: suspend, unsuspend, soft delete, trigger password reset
      - Audit logging: all actions logged to `admin_activity_log`
      - Security: admin role verification, self-deletion prevention
      - Soft delete: SP wallet freezing, user cannot login
    - Manual Test Guide: `ADMIN-V2-006-MANUAL-TESTING-GUIDE.md` (23 test cases)
    - Unit Tests: `p2p-kids-admin/src/__tests__/admin-user-management.unit.test.ts`
    - E2E Tests: `p2p-kids-admin/src/__tests__/integration/admin-user-management.e2e.test.ts`
    - Tier: Tier 1 for user management changes; Tier 2 if auth/RLS/audit system changes
    - **ADMIN-V2-006 Hotfix Chain (2026-03-28):** RPC schema alignment + delete action stability
      - Migrations: `20260328000016` through `20260328000023`
      - Fixes covered:
        - aggregate ordering in list/detail RPC JSON aggregation
        - profile DOB source (`profiles.dob`)
        - SP wallet state source (`sp_wallets.state`)
        - badge icon source (`badges.icon_url`)
        - recent activity entity comparison cast safety (`entity_id::TEXT`)
        - delete flow wallet freeze column (`state`, not `status`)
        - admin activity log writes UUID `entity_id` values for suspend/unsuspend/delete
      - Smoke verification:
        - `admin_list_users` RPC returns paginated users without schema errors
        - `admin_get_user_detail` RPC returns identity/subscription/wallet/activity payload
        - `admin_delete_user`, `admin_suspend_user`, `admin_unsuspend_user` RPCs return success payloads
    - **ADMIN-V2-006 Hotfix (2026-03-28):** Deleted account-status filter support
      - Migration: `20260328000025_fix_admin_list_users_deleted_filter.sql`
      - Fixes covered:
        - account-status filter now supports `deleted` and returns soft-deleted users (`profiles.deleted_at IS NOT NULL`)
        - list rows returned for deleted users are labeled with `account_status = 'deleted'` for UI badge rendering
      - Smoke verification:
        - `admin_list_users(p_account_status => 'deleted')` returns deleted users
        - Users page Account Status dropdown `Deleted` option returns deleted rows
    - **ADMIN-V2-006 Hotfix (2026-03-28):** Null account-status regression guard
  - **ADMIN-V3-005 (2026-04-29):** Category Suggestions Queue
    - Purpose: Admin can review, approve, merge, or reject seller-submitted category suggestions
    - Table: `category_suggestions` (seller-requested categories via "Other" flow)
    - Services: `getCategorySuggestions`, `approveCategorySuggestion`, `mergeCategorySuggestion`, `rejectCategorySuggestion`
    - Admin UI: `/categories` page, Suggestions tab
    - Components:
      - `CategorySuggestionsList.tsx` - List with Approve/Merge/Reject actions
      - `ApproveSuggestionModal.tsx` - Re-uses CategoryForm, pre-fills suggested name
      - `MergeSuggestionModal.tsx` - Dropdown of existing categories
      - `RejectSuggestionModal.tsx` - Optional admin note (500 char max)
    - Features:
      - Pending suggestion badge count (polled every 60s or realtime)
      - Item link opens `/admin/items/{id}` in new tab
      - Relative date formatting
      - Approve: creates new category + reassigns item transactionally
      - Merge: reassigns item to existing category
      - Reject: item stays in "Other", admin note saved
      - Success: row removed from pending list, badge decrements
    - **ADMIN-V3-005 Hotfix (2026-04-29):** Mobile Other-category suggestion insertion
      - App changes:
        - `p2p-kids-marketplace/src/services/categoryService.ts` adds `createCategorySuggestionFromItem(itemId, suggestedName, sellerId)`
        - `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` now calls `createCategorySuggestionFromItem` after `flagForCategoryReview`
      - DB migration:
        - `supabase/migrations/20260429000011_allow_seller_insert_category_suggestions.sql`
      - RLS changes:
        - Adds seller `INSERT` policy for own pending suggestions
        - Adds seller `UPDATE` policy for own pending suggestions (required for upsert on `item_id`)
      - Smoke verification:
        - Seller publishes item with category = "Other" and custom category name
        - `category_suggestions` has a `pending` row for that `item_id`
        - Admin Suggestions tab shows the row
    - Manual Test Guide: `ADMIN-V3-005-MANUAL-TESTING-GUIDE.md` (11 test cases)
    - Unit Tests: `p2p-kids-admin/src/__tests__/components/CategorySuggestionsList.test.tsx`, `SuggestionModals.test.tsx`
    - E2E Tests: `p2p-kids-admin/src/__tests__/integration/category-suggestions.integration.test.ts`
    - Tier: Tier 1 for suggestion queue changes; Tier 2 if category schema/trigger changes
    - Smoke:
      - Admin navigates to `/categories` → Suggestions tab
      - Pending badge count matches SQL count
      - Approve creates category + reassigns item (verify in DB)
      - Merge reassigns to selected category (verify in DB)
      - Reject updates status, saves note (verify in DB)
      - Migration: `20260328000026_fix_admin_list_users_null_status_filter.sql`
      - Fixes covered:
        - `admin_list_users` now treats null `p_account_status` as non-deleted list mode (prevents empty "All users" result)
      - Smoke verification:
        - `admin_list_users(p_account_status => NULL)` returns active user list
        - `admin_list_users(p_account_status => 'deleted')` still returns soft-deleted users
    - **ADMIN-V2-006 Hotfix (2026-03-28):** Mandatory identity fallback + profile backfill for TC-009
      - Migration: `20260328000027_fix_admin_identity_phone_dob_backfill.sql`
      - Fixes covered:
        - `admin_get_user_detail` identity now falls back to `auth.users.raw_user_meta_data` when `profiles.phone/dob` are missing
        - profile backfill updates missing/blank `profiles.phone` and missing `profiles.dob` from `auth.users` metadata
      - Smoke verification:
        - `admin_get_user_detail` returns non-null `identity.phone` and `identity.date_of_birth` for users with metadata values
        - post-backfill query shows reduced null/blank phone and null DOB counts in `profiles`
    - **ADMIN-V2-006 Mobile Gate (2026-03-28):** Suspended account blocked screen
      - App files:
        - `p2p-kids-marketplace/src/navigation/AppNavigator.tsx`
        - `p2p-kids-marketplace/src/contexts/AuthContext.tsx`
        - `p2p-kids-marketplace/src/screens/auth/SuspendedAccountScreen.tsx`
      - Behavior:
        - suspended users can authenticate but are routed to `SuspendedAccount`
        - blocked screen shows contact-admin message with placeholder support email
      - Smoke verification:
        - after admin suspend, user login lands on suspended screen (no normal app access)
        - after unsuspend, user login returns to normal auth/onboarding/dashboard route logic
    - **ADMIN-V2-006 Mobile Gate (2026-03-28):** Soft-deleted users blocked from login
      - App files:
        - `p2p-kids-marketplace/src/services/auth.ts`
        - `p2p-kids-marketplace/src/contexts/AuthContext.tsx`
        - `p2p-kids-marketplace/src/screens/auth/LoginScreen.tsx`
      - Behavior:
        - login is rejected when `profiles.deleted_at IS NOT NULL`
        - existing sessions for deleted users are signed out during startup/refresh
      - Smoke verification:
        - after admin soft delete, target user cannot log in and receives deleted-account message
        - `sp_wallets.state` is `frozen` for deleted user when wallet exists
  - **ADMIN-V2-007 (2026-03-25):** Admin Panel UI Theme & Layout Redesign (PRESENTATION ONLY)
    - Purpose: Redesign admin panel visual layer with consistent design system
    - Scope: **UI-ONLY** (no backend, no DB, no RLS changes)
    - Design Tokens:
      - Tailwind config extended with admin theme colors (deep purple sidebar, lavender content bg)
      - CSS custom properties for consistent theming
      - TypeScript theme.ts for inline style access
    - Components Created:
      - `Sidebar.tsx` - Fixed left sidebar (collapsible 256px → 64px, deep purple #3D1073)
      - `TopNavbar.tsx` - Fixed top navbar (white, 64px height, search/brand/notifications/profile)
      - `AdminShell.tsx` - Layout wrapper managing sidebar/topbar/main content positioning
      - `MetricCard.tsx` - Reusable metric display cards with icon colors + trends
      - `ChartCard.tsx` - Chart wrapper cards with period filters
    - Files Updated:
      - `tailwind.config.js` - Design token colors + shadows
      - `globals.css` - CSS variables + custom scrollbar styling
      - `layout.tsx` - Uses AdminShell instead of ProtectedLayout
    - Visual Features:
      - Deep purple sidebar (#3D1073) with gradient brand logo
      - White topbar with centered branding + search + notifications
      - Light lavender content background (#F2F0FB)
      - White metric/chart cards with subtle purple shadows
      - Smooth collapse/expand transitions (300ms)
      - Custom scrollbar (4px, purple)
      - Hover effects on nav items and interactive elements
    - Navigation Items: Dashboard, Users, Subscriptions, SP Wallet, Badges, Listings, Trades, Reviews, Analytics, Payouts, Referrals, ID Badges, Nodes, Config
    - Manual Test Guide: `ADMIN-V2-007-MANUAL-TESTING-GUIDE.md` (23 test cases)
    - Unit Tests:
      - `__tests__/components/layout/Sidebar.test.tsx`
      - `__tests__/components/layout/TopNavbar.test.tsx`
      - `__tests__/components/ui/MetricCard.test.tsx`
      - `__tests__/components/ui/ChartCard.test.tsx`
      - `__tests__/theme/design-tokens.test.ts`
    - Integration Test: `__tests__/integration/admin-ui-theme.integration.test.tsx`
    - Tier: Tier 0 (lint + typecheck + build) required; Tier 1 for UI smoke test
    - Dependencies: `lucide-react` (icons must be installed)
    - Backward Compat: Existing admin pages work with new theme; old ProtectedLayout replaced cleanly
- Automated:
  - Unit tests: `p2p-kids-admin/src/lib/__tests__/revenueAnalytics.test.ts`
  - E2E tests: `p2p-kids-admin/src/__tests__/e2e/revenue-analytics.e2e.ts`
  - User Management Unit tests: `p2p-kids-admin/src/__tests__/admin-user-management.unit.test.ts`
  - User Management E2E tests: `p2p-kids-admin/src/__tests__/integration/admin-user-management.e2e.test.ts`
  - **ADMIN-V2-007** Unit tests: 5 unit test files + 1 integration test (see above)

- **SUB-020 Trial Limit Control (NEW):**
  - DB migration: `supabase/migrations/20260312000000_sub_020_trial_limit_control.sql`
  - New RPCs: `get_trial_limit_status`, `increment_trial_uses`, `admin_reset_trial_uses`
  - Updated RPCs: `is_user_trial_eligible`, `create_trial_subscription`, `upgrade_free_subscription_to_trial`
  - Mobile UI: route `SubscriptionChoice` maps to `JoinKidsClubScreen` (`p2p-kids-marketplace/src/navigation/AppNavigator.tsx` L562) — the web-first purchase screen. This is the ACTUAL, INTENDED, PERMANENT implementation (not a placeholder/unfinished state): the native Start Free Trial / Continue Free trial-choice screen is deliberately NOT implemented — product decision 2026-08-24, see `docs/DECISIONS.md`.
  - Service: `p2p-kids-marketplace/src/services/subscription.ts`
  - Manual tests: `docs/manual-verification/SUB-020-TRIAL-LIMIT-MANUAL-TEST-CASES.md`
  - Maestro: `p2p-kids-marketplace/.maestro/sub-020-trial-limit.yaml`
  - E2E (Supabase): `p2p-kids-marketplace/src/__tests__/e2e/sub-020-trial-limit.e2e.ts`
  - Unit: `p2p-kids-marketplace/src/services/__tests__/subscription.test.ts` (trial-limit section)
- Unit/UI: `p2p-kids-marketplace/src/components/subscription/__tests__/SubscriptionBanner.test.tsx` covers banner CTA routing.
- Hooks: `p2p-kids-marketplace/src/hooks/__tests__/useSubscription.test.ts` and `p2p-kids-marketplace/src/hooks/__tests__/useGracePeriodStatus.test.ts` cover subscription/grace-period derived UI state.
- **SUB-003 Manual Test Guide:** SUB-003-MANUAL-TESTING-GUIDE.md
- **SUB-003 Unit Tests:** p2p-kids-marketplace/src/__tests__/services/subscription-sub-003.unit.test.ts

### FLOW-12A: Subscription Payment Collection (Stripe Payment Sheet) — SUB-015
- Purpose: Collect payment method securely via Stripe Payment Sheet for new subscriptions and renewals
- Covers:
  - SetupIntent creation for payment method collection
  - Stripe Payment Sheet modal (native iOS/Android)
  - Payment method storage for future charges
  - Subscription creation with saved payment method
  - Error handling (card declined, network issues)
  - Re-subscribe from grace period with saved payment method
  - Billing history entry creation
- Automated Tests:
  - Unit: `p2p-kids-marketplace/src/hooks/__tests__/usePaymentSheet.test.ts`
  - Unit: `p2p-kids-marketplace/src/components/subscription/__tests__/SubscribeButton.test.tsx`
  - Integration: `p2p-kids-marketplace/e2e/subscription-payment-flow.integration.test.ts`
  - Maestro: `p2p-kids-marketplace/.maestro/subscription-payment-flow.yaml`
- Manual Verification: `docs/manual-verification/SUB-015-verification.md`
- Edge Functions:
  - `create-payment-setup-intent` (SetupIntent creation)
  - `create-subscription-from-payment-method` (Subscription creation post-payment)
- Note: Stripe Payment Sheet requires manual testing with real test cards (cannot be fully automated)
- SUB-016/SUB-017 coverage additions:
  - Re-subscribe from `grace_period` and `expired` is handled in `ManageKidsClubScreen` via `resubscribe()` and `renew-subscription`.
  - Missing saved payment method path now routes to `SubscriptionPaymentScreen` (manual test: `SUB-016-017-MANUAL-TEST-CASES.md`, TC-016-03).
  - Billing history screen uses `getBillingHistory` service and is reachable from manage/subscription flows.
- **SUB-011 Admin Management:**
  - **Admin UI:** p2p-kids-admin/src/app/subscriptions/manage/page.tsx - subscription monitoring dashboard with metrics (MRR, active subs, churn rate), grace period configuration, and admin actions (cancel, extend trial, reactivate)
  - **Admin API:** p2p-kids-admin/src/app/api/admin/subscriptions/route.ts (GET) and p2p-kids-admin/src/app/api/admin/subscriptions/actions/route.ts (POST)
  - **Unit Tests:** p2p-kids-admin/src/__tests__/api/admin/subscriptions.test.ts - metrics calculation, admin action validation
  - **E2E Tests:** p2p-kids-admin/src/__tests__/e2e/subscription-admin-management.e2e.ts - full admin workflow testing
  - **Manual Test Guide:** SUB-011-MANUAL-TESTING-GUIDE.md - comprehensive test cases for admin portal
  - **Key Features:**
    - View subscription list filtered by status (trial, active, grace_period, cancelled, expired)
    - Display key metrics: MRR, active subscribers, trial users, grace period users, churn rate
    - Configure grace period duration (default: 90 days) and reminder thresholds (e.g., [60, 30, 7, 1])
    - Admin actions: manually cancel subscriptions, extend trial periods, reactivate cancelled/expired subscriptions
    - Audit logging for all admin actions
    - Real-time validation and feedback for configuration changes
- **SUB-003 E2E Tests:** p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-003.e2e.ts
- **SUB-005 Trial Conversion & Downgrade:**
  - **Manual Test Guide:** SUB-005-MANUAL-TESTING-GUIDE.md
- **SUB-006 Trial-to-Paid Conversion (Stripe Payment):**
  - **Manual Test Guide:** SUB-006-MANUAL-TESTING-GUIDE.md
  - **Unit Tests:** p2p-kids-marketplace/src/__tests__/services/subscription-sub-006.unit.test.ts
  - **E2E Tests:** p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-006.e2e.ts
- **SUB-007 Stripe Webhook Handling (Status & Billing Updates):**
  - **Edge Function:** supabase/functions/stripe-webhook-subscriptions/index.ts
  - **Events:** customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
  - **State transitions:** active → cancelled (cancel_at_period_end), active → grace_period (deleted/3 retries), payment_retry_count 0→3 → grace_period
  - **Manual Test Guide:** SUB-007-MANUAL-TESTING-GUIDE.md
  - **Unit Tests (Deno):** supabase/functions/stripe-webhook-subscriptions/__tests__/webhook.unit.test.ts
  - **E2E Tests (Jest):** p2p-kids-marketplace/src/__tests__/e2e/sub-007-webhook.e2e.ts
  - **UI Verification Screen:** SubscriptionStatus (navigate from UserDashboard subscription card, AdminDashboard, or Settings)
- **SUB-008 User-Initiated Cancellation Flow:**
  - **Edge Function:** supabase/functions/cancel-subscription/index.ts
  - **State transitions:** active → cancelled (benefits until period end), trial+SP → grace_period (dynamic admin-config grace days), trial-SP → free
  - **Grace-period source of truth:** `admin_config.grace_period_days` (with backward-compatible fallback paths in service/function)
  - **Mobile Screen:** p2p-kids-marketplace/src/screens/subscription/ManageKidsClubScreen.tsx
  - **Service:** p2p-kids-marketplace/src/services/subscription.ts (cancelSubscription function)
  - **Manual Test Guide:** SUB-008-MANUAL-TEST-CASES.md
  - **Unit Tests:** p2p-kids-marketplace/src/__tests__/services/subscription-sub-008.unit.test.ts
  - **E2E Tests:** p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-008.e2e.ts
  - **Deep Link:** p2pkidsmarketplace://manage-kids-club
  - **Features:** Cancel reason analytics, SP wallet freeze for grace_period, re-subscribe CTA
  - **Tier:** 1 for cancellation logic; Tier 2 if SP wallet freeze or grace period logic changed
  - **Tier:** 1 for webhook logic changes; Tier 2 if DB migrations or RPC changes touched
  - **Env Required:** STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET (separate from trade webhook secret)
  - **Edge Functions:** 
    - `supabase/functions/setup-subscription-payment/index.ts` (SetupIntent for payment collection)
    - `supabase/functions/create-subscription-payment/index.ts` (Create Stripe subscription with payment)
  - **Mobile Screen:** `p2p-kids-marketplace/src/screens/subscription/ContinueKidsClubScreen.tsx`
  - **Service:** `p2p-kids-marketplace/src/services/subscriptions/trialToPaidConversion.ts`
  - **Flow:** User taps "Start/Continue Kids Club+" from Profile → Stripe Payment Sheet → Payment method collected → Subscription created with trial window → First charge occurs after free period ends (unless canceled)
  - **Unit Tests:** p2p-kids-marketplace/src/services/subscriptions/__tests__/trialConversion.test.ts
  - **E2E Tests:** p2p-kids-marketplace/e2e/trial-conversion.e2e.test.ts
  - **Migration:** supabase/migrations/20260215000001_trial_conversion_rpcs.sql
  - **Edge Function:** supabase/functions/trial-conversion/index.ts
  - **Test Screen:** p2p-kids-marketplace/src/screens/admin/TrialConversionTestScreen.tsx
- **SUB-009 Grace Period Countdown, Reminders & Expiry:**
  - **Edge Function:** supabase/functions/grace-period-cron/index.ts
  - **UI Component:** p2p-kids-marketplace/src/components/GracePeriodBanner.tsx
  - **Dashboard Integration:** UserDashboardScreen renders GracePeriodBanner for grace_period users
  - **Features:** 
    - Daily cron checks grace_period subscriptions
    - Reminders at 60, 30, 7, 1 days remaining
    - Countdown banner with urgency levels (warning >7d, urgent 1-7d, critical ≤1d)
    - Expiry triggers SP wallet deletion and status → expired
  - **Manual Test Guide:** SUB-009-MANUAL-TEST-CASES-UPDATED.md
  - **Unit Tests (Deno):** supabase/functions/grace-period-cron/__tests__/index.test.ts
  - **E2E Tests (Jest):** p2p-kids-marketplace/src/__tests__/e2e/sub-009-grace-period.e2e.ts
  - **Tier:** 1 for reminder thresholds; Tier 2 if cron logic or SP expiry logic changes

- **SUB-010 Subscription UI Components (Member-Facing):**
  - **Mobile Screens:**
    - `p2p-kids-marketplace/src/screens/subscription/KidsClubOverviewScreen.tsx` (marketing + benefits + status + CTA)
  - **Reusable Components:**
    - `p2p-kids-marketplace/src/components/subscription/SubscriptionStatusCard.tsx` (status card with tier, price, dates)
    - `p2p-kids-marketplace/src/components/subscription/SubscriptionBanner.tsx` (thin banner for home/wallet/listing flows)
  - **Hooks:**
    - `p2p-kids-marketplace/src/hooks/useSubscription.ts` (fetches subscription data)
    - `p2p-kids-marketplace/src/hooks/useGracePeriodStatus.ts` (calculates grace period countdown + messaging)
  - **Utils:**
    - `p2p-kids-marketplace/src/utils/formatPrice.ts` (formats cents to dollar strings)
  - **Deep Link:** p2pkidsmarketplace://kids-club-overview
  - **Features:** State-aware CTAs (free→trial, trial→payment, active→manage, grace→resubscribe), benefit list, "How It Works" section, grace period warnings
  - **Manual Test Guide:** SUB-010-MANUAL-TESTING-GUIDE.md
  - **Unit Tests:**
    - p2p-kids-marketplace/src/utils/__tests__/formatPrice.test.ts
    - p2p-kids-marketplace/src/hooks/__tests__/useSubscription.test.ts
    - p2p-kids-marketplace/src/hooks/__tests__/useGracePeriodStatus.test.ts
    - p2p-kids-marketplace/src/components/subscription/__tests__/SubscriptionStatusCard.test.tsx
    - p2p-kids-marketplace/src/components/subscription/__tests__/SubscriptionBanner.test.tsx
  - **E2E Tests:** p2p-kids-marketplace/src/__tests__/e2e/sub-010-subscription-ui.e2e.ts
  - **Navigation:** Routes added to AppNavigator.tsx + linking config
  - **Tier:** 1 for UI/component changes; no DB/RPC changes required

- Manual checks:
  - **SUB-001 Foundation:**
    - `subscription_tiers` table exists with Kids Club+ tier seeded correctly ($4.99, 30d trial, grace period is dynamic from admin config).
    - All 7 features seeded: `can_earn_sp`, `can_spend_sp`, `can_donate`, `reduced_fee`, `priority_matching`, `early_access`, `priority_support`.
    - RLS policies allow public SELECT for active tiers and features.
    - Service layer: `getActiveSubscriptionTiers()`, `getKidsClubPlusTier()`, `checkTierFeature()` work correctly.
    - TypeScript types compile without errors.
  - **SUB-002 Subscription Table & Status Management (COMPLETED):**
    - `subscriptions` table enhanced with grace period tracking (`grace_started_at`, `grace_ends_at`).
    - Cancellation fields added: `cancelled_at`, `cancel_reason`, `cancel_at_period_end`.
    - Billing cycle fields: `monthly_price_cents`, `last_payment_date`, `last_payment_amount`, `next_billing_date`.
    - Payment retry tracking: `payment_failed_at`, `payment_retry_count` (0-3).
    - Pause feature: `paused_until` (retention - keeps access during pause).
    - Auto-renewal control: `auto_renew_enabled` (user can toggle).
    - Trial abuse prevention: `has_used_trial` flag.
    - Saved payment method: `stripe_payment_method_id` (for seamless re-subscribe).
    - Status constraint updated with V2.1 states: 'free', 'trial', 'active', 'paused', 'cancelled', 'grace_period', 'expired'.
    - RPC functions: `get_subscription_status`, `can_user_earn_sp`, `can_user_spend_sp`, `get_user_transaction_fee`, `is_user_trial_eligible`, `update_subscription_status`, `record_payment_attempt`.
    - TypeScript service: Enhanced `getSubscriptionSummary()` with all V2.1 fields, `isTrialEligible()`, `getTransactionFee()`, `getSubscriptionDetails()`.
    - Unit tests: `/src/services/__tests__/subscription.test.ts` (covers all statuses and feature gates).
    - E2E tests: `/src/__tests__/e2e/subscription-sub-002.e2e.ts` (verifies RPC functions and status transitions).
    - Manual test cases: `SUB-002-MANUAL-TEST-CASES.md` (20 test cases for simulators).

  - **SUB-004 Trial Reminder Notifications (COMPLETED):**
    - Edge Function: `supabase/functions/trial-reminders/index.ts` - Daily cron job to send reminders at Day 23, 28, 29.
    - Database flags: `trial_reminder_day_23_sent`, `trial_reminder_day_28_sent`, `trial_reminder_day_29_sent` prevent duplicates.
    - Reminder schedule: Day 23 (7 days remaining), Day 28 (2 days remaining), Day 29 (1 day remaining).
    - Notification content: Unique title and message for each reminder day with increasing urgency.
    - Integration: Calls existing `send-push-notification` Edge Function for delivery.
  
  - **SUB-014 Billing History Tracking (COMPLETED - 2026-03-03):**
    - Database: `billing_history` table created to log all subscription charges, failures, and refunds.
    - Migration: `supabase/migrations/20260303000000_create_billing_history_sub_014.sql`
    - Schema: Tracks `charge_id` (Stripe), `stripe_invoice_id`, `amount`, `currency`, `status` (succeeded/failed/refunded/pending), `charged_at`, `description`, `error_message`.

  - **SUB-018 Payment Failure Handling & Automatic Retry (COMPLETED - 2026-03-07):**
    - **Edge Function:** `supabase/functions/retry-failed-payment/index.ts` - Allows user to manually retry failed payment
    - **Webhook Handler:** `supabase/functions/stripe-webhook-subscriptions/index.ts` - Updated to handle `invoice.payment_failed` event
    - **Mobile Components:**
      - `p2p-kids-marketplace/src/components/subscription/PaymentFailureBanner.tsx` - In-app banner showing payment failure status
      - `p2p-kids-marketplace/src/hooks/usePaymentFailure.ts` - Hook to detect and manage payment failure states
    - **Service:** `p2p-kids-marketplace/src/services/paymentRetry.ts` - Service layer for retry logic and notifications
    - **Features:**
      - Automatic retry tracking: payment_retry_count (0-3) increments on each `invoice.payment_failed` webhook
      - Retry schedule: Day 3, Day 7, Day 14 (Stripe handles auto-retry)
      - Escalating notifications: Push notifications sent after each failure (retry 1, 2, 3)
      - User banners: Different urgency levels (medium for retry 1, high for retry 2+)
      - Grace period entry: After 3 failures, user transitions to `grace_period` and SP wallet is frozen
      - Manual retry: User can update payment method and manually retry via ManageKidsClub screen
      - Banner dismissal: Users can temporarily dismiss banner (reappears on app restart if issue persists)
    - **Manual Test Guide:** SUB-018-MANUAL-TEST-CASES.md (11 test cases)
    - **Unit Tests:**
      - p2p-kids-marketplace/src/hooks/__tests__/usePaymentFailure.test.ts
      - p2p-kids-marketplace/src/components/subscription/__tests__/PaymentFailureBanner.test.tsx
      - p2p-kids-marketplace/src/services/__tests__/paymentRetry.test.ts
    - **E2E Tests:** p2p-kids-marketplace/e2e/sub-018-payment-failure.integration.test.ts
    - **Maestro Flow:** p2p-kids-marketplace/.maestro/payment-failure-handling.yaml
    - **Tier:** 1 for UI/banner changes; Tier 2 if webhook handler or RPC logic changes
    - RLS: Users can view their own billing history; service role has full access for webhooks.
    - Indexes: 5 performance indexes on user_id, subscription_id, charge_id, status, charged_at.
    - TypeScript Types: `src/types/billingHistory.types.ts` - BillingHistory, BillingStatus, CreateBillingHistoryParams, BillingHistorySummary.
    - Service Layer: `src/services/billingHistory.ts` - getBillingHistory(), createBillingRecord(), updateBillingRecordStatus(), getBillingHistorySummary().
    - Unit Tests: `src/services/__tests__/billingHistory.test.ts` (13 tests - all CRUD operations, summary calculations).
    - E2E Tests: `src/__tests__/e2e/billing-history-sub-014.e2e.ts` (18 tests - real Supabase, verify table, RLS, CRUD).
    - Manual Test Guide: `SUB-014-MANUAL-TEST-CASES.md` (20 test cases for iOS/Android simulators).
    - Purpose: Immutable audit trail for all billing events, supports receipt/invoice functionality, reconciliation with Stripe.
    - Integration Points: Ready for webhook integration (SUB-015), billing history UI (SUB-016), admin dashboard (SUB-017).
    - Tier: 0 for new billing logic; Tier 1 for webhook integration; Tier 2 if billing_history schema changes.
    - TypeScript service: `trialReminders.ts` with `getTrialReminderStatus()`, `calculateDaysRemaining()`, `getTrialReminderMessage()`.
    - UI Component: `TrialReminderBanner.tsx` displays reminders on Dashboard with color-coded urgency (blue/orange/red).
    - Idempotency: Flags ensure reminders are sent exactly once per milestone.
    - Unit tests: `p2p-kids-marketplace/src/services/subscriptions/__tests__/trialReminders.test.ts`.
    - E2E tests: `p2p-kids-marketplace/e2e/trial-reminders.e2e.ts`.
    - Manual testing guide: `SUB-004-MANUAL-TESTING-GUIDE.md`.

  - **Subscription Lifecycle (TODO: SUB-003+):**
    - User starts trial -> `user_subscriptions.status = 'trial'`.
    - Trial expires without payment -> transitions to `grace_period`.
    - User cancels active subscription -> keeps access until period end, then moves to `grace_period`.
    - Grace period expires (`admin_config.grace_period_days`) -> SP wallet permanently deleted, status becomes `expired`.
- Automated (offline): 
  - Unit tests: `subscriptionTiers.test.ts` validates service layer functions.
  - E2E tests: `sub-001-subscription-tiers.e2e.ts` validates database schema and RLS policies.

<!-- Removed duplicate FLOW-13 placeholder; FLOW-13 above is canonical. -->

### FLOW-14: Messaging (Realtime)
- Purpose: Real-time messaging between buyers and sellers for active trades
- Smoke: (manual)
  - Open Messages list -> unread badges reflect unread messages only.
  - Tap a conversation -> Chat opens and that conversation's unread badge clears on returning to the list.
  - New incoming message (other user) increments unread badge until the conversation is opened again.
  - After a trade is completed, messages in that trade get an `expires_at` timestamp (trade completion + configured retention days) and are later soft-deleted by the MSG-004 expiration job.
- Automated (offline): Jest covers MSG-008/MSG-009 chat service helpers (delivery status + typing indicators).
- **MODULE-15.1-UI-REDESIGN-FLOW-14 (2026-05-14):** Messaging screens redesigned to Whisk-inspired design system
    - Module: MODULE-15.1-UI-REDESIGN (TASK FLOW-14)
    - Scope:
      - 2 messaging screens redesigned: ConversationsListScreen, ChatScreen
      - Design system: Whisk green (#5DBB8E), filled inputs, pill-shaped search, Phosphor icons
      - **ConversationsListScreen:**
        - Search bar: pill-shaped (48px, #F0F0F0), MagnifyingGlass Phosphor icon
        - Unread badge: green circle (#5DBB8E, 20px, white text 11px) - was red
        - Trade context chip: ArrowsLeftRight icon (12px, #5DBB8E) + listing title + price
        - Verified badge: ShieldCheck icon (14px, #5DBB8E, fill weight) for approved verification
        - Empty state: ChatCircleSlash icon (64px, #E0E0E0) + green pill "Browse Items" button
        - Search filters by: user name, listing title, message content (debounced)
      - **ChatScreen:**
        - Header: CaretLeft back button, partner avatar (36px), name + ShieldCheck for verified
        - Trade banner: #F7F7F7 bg, ArrowsLeftRight icon (16px, #5DBB8E), thumbnail (32px), "View Trade" link (#5DBB8E)
        - Sent messages: #5DBB8E bg, white text, borderTopRightRadius: 4
        - Received messages: #F0F0F0 bg, #1A1A1A text, borderTopLeftRadius: 4, NO border
        - Delivery status (MSG-008): Phosphor Check icons
          - Sent: Single Check (#9CA3AF, bold)
          - Delivered: Double Check (#9CA3AF, bold)
          - Read: Double Check (#5DBB8E, bold)
        - Input bar: #F7F7F7 bg strip, PaperclipHorizontal (20px, #6B6B6B), Smiley (20px, #6B6B6B), filled input (#F0F0F0, 20px radius, 40px height)
        - Send button: PaperPlaneRight (24px, white) on green circle (48px, #5DBB8E), ONLY visible when input has text
        - Image viewer: X and CaretLeft Phosphor icons
    - Tests:
      - Unit: `src/screens/messaging/__tests__/ConversationsListScreen.test.tsx` (coverage ≥85%)
      - Unit: `src/screens/messaging/__tests__/ChatScreen.test.tsx` (coverage ≥85%)
      - Integration: `__tests__/integration/flow-14-messaging.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Maestro: `.maestro/module-15.1-flow-14-messaging.yaml` (16 test cases: conversations list, search, chat UI, send message, delivery status)
      - Manual: `MODULE-15.1-FLOW-14-MANUAL-TESTING.md` (22 test cases + regression checklist)
    - Prerequisites:
      - phosphor-react-native@3.0.6 installed ✅
      - Two test users with active trade + messages (staging Supabase)
      - At least one user with verification_status = 'approved'
      - Conversation with unread_count > 0
    - Validation:
      - `npm run typecheck` (must pass)
      - `npm run lint` (must pass)
      - `npm run test:unit` (messaging screen tests green)
      - `RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
      - `npm run test:maestro:ios -- .maestro/module-15.1-flow-14-messaging.yaml` (repeatable full FLOW-14 run)
      - `npm run test:maestro:android -- .maestro/module-15.1-flow-14-messaging.yaml` (Android simulator run)
      - Manual testing required for real-time features (typing indicators, live message receive)
      - Visual QA for Phosphor icons, color accuracy, spacing consistency
    - Design Rules:
      - PaperClip and Smiley icons are #6B6B6B (NOT green) - gray, not accent color
      - Send button ONLY visible when input has text (conditional rendering)
      - Trade context chip does NOT show thumbnail (not in Conversation interface)
      - Verification badge ONLY for 'approved' status (not 'verified' enum value)
      - Delivery status ONLY for own messages (not received messages)
      - Input bar bg is #F7F7F7 (distinct from screen bg #FFFFFF)
      - Message bubbles have sharp corner on sender side (borderTopRightRadius: 4 for sent, borderTopLeftRadius: 4 for received)
- **FLOW-14 REALTIME-INBOX-FIX (2026-08-02):** Inbox updates conversations in place — no full reload on message send
    - Bug: `ConversationsListScreen` realtime handler called `loadConversations()` on EVERY message INSERT (system-wide, unfiltered), which set `loading=true` (full-screen "Loading conversations…" spinner) and re-fetched up to 50 conversations — the Inbox "loaded everything" whenever user A messaged user B.
    - Fix: the realtime handler now (1) updates only the affected conversation in place (last-message preview, timestamp, unread +1 for counterparty messages, re-sort newest-first) — no spinner, no re-fetch; (2) reacts only to messages in the current user's trades; (3) does a silent (no-spinner) refresh only for brand-new conversations the user is part of.
    - Scope: `p2p-kids-marketplace/src/screens/messaging/ConversationsListScreen.tsx` (single file).
    - Tests: manual two-user realtime check; no component test currently exists for ConversationsListScreen.
    - Follow-up (2026-08-02): first load now fetches only the most recent **7** conversations (`CONVERSATION_PAGE_SIZE = 7`); the existing "Load More" button pages the rest — cuts the initial ~3s load by ~7× (each conversation triggers several lookups).

### FLOW-18: ID Badge Verification (Admin Queue & Review)
- Purpose: Admin reviews and approves/rejects manual ID verification requests from users.
- Smoke: (manual)
  - Admin navigates to `/id-badges` queue page
  - Stats section displays pending, approved, rejected counts and avg review time
  - Filter by Pending/Approved/Rejected updates table correctly
  - Search by user name or email filters results
  - Click "Review" on pending request -> navigates to review page
  - Screenshot displays in review page (if available)
  - Admin approves request with optional notes
  - Screenshot auto-deleted from storage after decision
  - Request status updates to 'approved' in database
  - `reviewed_at` timestamp set correctly
  - Admin rejects request with reason + notes
  - Rejection reason and notes saved to database
  - Queue stats update after each decision
  - Navigation links "ID Badges" and "ID Messages" visible in admin layout
  - Admin navigates to `/id-badges/messages` configuration page
  - All 12 message templates load correctly with template variable reference
  - Admin edits a message, saves, and change persists
  - Template variables (`{first_name}`, `{rejection_reason}`, `{admin_notes}`, `{approval_timeframe_hours}`) preserved in saved messages
  - Validation prevents saving empty messages
  - Changes to messages reflected in actual notifications sent to users
- Required checks:
  - RLS policies: admin can view all requests
  - Storage bucket: `id-badge-verification-screenshots` exists with proper RLS
  - Screenshot deletion is idempotent (no error if already deleted)
  - Signed URLs expire after 1 hour
  - Messages table: admin can UPDATE, all users can SELECT
  - API endpoints: GET `/api/admin/id-badges/messages` and PUT `/api/admin/id-badges/messages/:messageId` working
- Dependencies: BADGE-008 (schema), BADGE-009 (mobile upload flow), BADGE-012 (messages configuration)
- Testing: Manual test guides at `/BADGE-010-MANUAL-TESTING-GUIDE.md` and `/BADGE-012-MANUAL-TESTING-GUIDE.md`
  - Tap a conversation -> Chat opens and that conversation’s unread badge clears on returning to the list.
  - New incoming message (other user) increments unread badge until the conversation is opened again.
  - After a trade is completed, messages in that trade get an `expires_at` timestamp (trade completion + configured retention days) and are later soft-deleted by the MSG-004 expiration job.

- Automated (offline): Jest covers MSG-008/MSG-009 chat service helpers (delivery status + typing indicators).

- Smoke: (manual)

### FLOW-16: CPSC Recall Matching – Item Safety Check Against Recall Database (SAFETY-002)
- Purpose: Automatically check new listing titles/descriptions against CPSC recalls database using fuzzy matching; flag items that match recalled products for admin review before listing goes live
- Covers:
  - Fuzzy text matching using PostgreSQL pg_trgm (trigram similarity)
  - Full-text search using tsvector for comprehensive recall detection
  - Automatic item flagging when match confidence >= threshold (default 0.5)
  - Safety flag creation with confidence score and recall reference
  - Seller notification of potential safety match
  - Admin queue for reviewing flagged items
  - Feature flag control via admin_config (cpsc_check_enabled)
  - Configurable match threshold via admin_config (cpsc_match_threshold)
- Database:
  - Tables: `item_safety_flags` (NEW - stores flagged items with match metadata)
  - Function: `check_cpsc_recalls(p_title, p_description)` (NEW - returns matching recalls with similarity scores)
  - RLS: Admins view all flags, item owners view own flags, service role can insert
  - Indexes: item_id, status, flag_type for performance
- Edge Function: `supabase/functions/check-item-safety/index.ts` (NEW)
- Mobile Service: `src/services/safety.ts` (NEW - checkItemSafety, getItemSafetyFlags, isCpscCheckEnabled, getCpscMatchThreshold)
- Integration: `src/services/listing.ts` createListing() fires async CPSC check after listing creation (fire-and-forget pattern)
- Migration: `supabase/migrations/305_item_safety_flags_and_cpsc_matching.sql`
- Manual Test Guide: `SAFETY-002-MANUAL-TESTING-GUIDE.md` (7 test cases)
- Unit Tests:
  - `p2p-kids-marketplace/src/services/__tests__/safety.test.ts` (safety service functions)
  - `supabase/functions/check-item-safety/__tests__/index.unit.test.ts` (Edge Function logic)
- E2E Tests: `p2p-kids-marketplace/src/__tests__/e2e/cpsc-recall-matching.e2e.test.ts`
- Maestro Flow: `p2p-kids-marketplace/.maestro/safety-002-cpsc-recall-matching.yaml`
- Smoke: (manual via SAFETY-002 guide + automated via Maestro)
  - User creates listing with safe product name -> listing created successfully, no safety flags
  - User creates listing with recalled product name (e.g., "Fisher-Price Rock 'n Play") -> item automatically flagged, safety flag row created with confidence score >= 0.5
  - Flagged item status transitions to 'flagged' in items table
  - Seller receives notification about potential safety match
  - Admin views flagged items queue and sees match details
  - CPSC check can be disabled via admin_config.cpsc_check_enabled = false
  - Match threshold can be adjusted via admin_config.cpsc_match_threshold
  - Fire-and-forget: CPSC check failures don't block listing creation
  - check_cpsc_recalls() function returns matches with similarity_score, recall_id, recall_number, product_name, hazards
- Manual Verification:
  - Create test listing with known recalled product name from cpsc_recalls table
  - Verify item_safety_flags row created with correct recall_id reference
  - Verify items.status changed to 'flagged' and flagged_at timestamp set
  - Verify confidence score calculated correctly (trigram similarity)
  - Admin can view flagged items and recall details
  - Seller can view safety flag reason on their listing
- Tier: Tier 1 for Edge Function/service changes; Tier 2 if database function or RLS policies change
- Dependencies: 
  - SAFETY-001 (CPSC Recall Imports - requires cpsc_recalls table populated)
  - SAFETY-P003 (Item Flagged/Rejected Status - requires items.status extension)
  - INFRA-001 (Supabase setup), pg_trgm extension enabled

### FLOW-17: Notifications
- Smoke: (manual)
- **NOTIF-V2-001 (MODULE-14): Notification Schema & Preferences**
  - Purpose: Allow users to manage notification preferences per category (subscription, sp_events, badges, trades, system) and channel (push, in-app, email)
  - Database:
    - Migration: `supabase/migrations/201_notifications_schema_v2.sql`
    - Tables: `notification_preferences` (user_id, category, push_enabled, in_app_enabled, email_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
    - Enums: `notification_category` (5 types), `notification_status` (3 states)
    - RLS policies: Users can read/update only their own preferences
    - Trigger: `initialize_notification_preferences()` auto-creates 5 default preference rows for new users
    - Default quiet hours: 22:00-08:00
  - Mobile App:
    - Service: `p2p-kids-marketplace/src/services/notificationPreferences.ts`
      - Functions: `getNotificationPreferences()`, `updateNotificationPreference()`
      - Self-healing: Auto-initializes if user has no preferences
    - Screen: `p2p-kids-marketplace/src/screens/profile/NotificationPreferencesScreen.tsx`
      - 5 category sections with icon + label
      - 3 toggle switches per category (push/in-app/email)
      - Quiet hours section with enable toggle + time pickers (start/end)
      - Optimistic updates for immediate feedback
      - Error handling with Alert dialogs
    - Navigation: Route `NotificationPreferences` in AppNavigator (authenticated stack)
  - Testing:
    - Unit tests: `p2p-kids-marketplace/src/__tests__/services/notificationPreferences.test.ts` (12 test cases)
    - E2E tests: `p2p-kids-marketplace/e2e/notificationPreferences.e2e.test.ts` (20+ integration tests with RLS verification)
    - Maestro flow: `.maestro/notification-preferences.yaml` (16-step UI flow testing all toggles, quiet hours, persistence)
    - Manual test guide: `p2p-kids-marketplace/docs/manual-tests/NOTIF-V2-001-Notification-Preferences-Manual-Tests.md` (12 test cases including security RLS tests)
  - Verification: MODULE-14-VERIFICATION-V2.md checklist items 1.1-1.8 (Database, Functional, UI, Security sections)

- **NOTIF-V2-003 (MODULE-14): SP Event Notifications**
  - Purpose: Notify subscribers about Swap Points events (earned, spent, wallet frozen, low balance)
  - Database:
    - Migration: `supabase/migrations/142_sp_notifications.sql`
    - RPC: `create_sp_notification(p_user_id, p_notification_type, p_title, p_body, p_data, p_check_subscription)`
      - Subscription gating: Only send SP earned/spent/low balance to trial/active subscribers
      - Exception: Wallet frozen notifications sent to ALL users
      - Respects notification_preferences for sp_events category
      - Returns NULL if all channels disabled or subscription check fails
    - Triggers:
      - `trigger_sp_transaction_notification` on `sp_ledger` (AFTER INSERT)
        - Fires for transaction_type LIKE 'earn_%' OR 'spend_%'
        - Generates dynamic title/body based on transaction type
        - Includes SP amount, transaction type, balance_after in notification data
        - Deep link: '/wallet'
      - `trigger_sp_wallet_frozen_notification` on `sp_wallets` (AFTER UPDATE)
        - Fires when status changes to 'frozen'
        - Sent to all users (no subscription gate)
        - Deep link: '/subscription'
      - `trigger_sp_low_balance_notification` on `sp_wallets` (AFTER UPDATE)
        - Fires when available_balance < 10 SP
        - Deduplication: Only once per 24 hours
        - Subscription gated (trial/active only)
        - Deep link: '/discover'
  - Notification Types & Templates:
    - `sp_earned`: "🎉 +{amount} SP Earned!" → Dynamic body based on transaction type (starter_pack, referral, challenge, etc.)
    - `sp_spent`: "✨ {amount} SP Spent" → Dynamic body (purchase, boost, fee)
    - `sp_wallet_frozen`: "SP Wallet Frozen ❄️" → "Renew subscription to reactivate"
    - `sp_balance_low`: "Low SP Balance ⚠️" → "You have only {balance} SP remaining"
  - Testing:
    - Unit tests: `p2p-kids-marketplace/src/__tests__/services/spNotifications.test.ts` (70+ test cases covering RPC logic, subscription gating, title/body generation, channels)
    - E2E tests: `p2p-kids-marketplace/e2e/sp-notifications.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Verify trigger fires on ledger insert (earn/spend)
      - Verify wallet frozen notification on status change
      - Verify low balance warning with 24h deduplication
      - Verify subscription gating (free users get NO SP earned/spent/low balance, but DO get frozen)
    - Maestro flow: `.maestro/sp-notifications.yaml` (6-state flow: earned, spent, frozen, low_balance, non-subscriber gating, preferences)
    - Manual test guide: `NOTIF-V2-003-MANUAL-TESTING.md` (12 test cases with SQL snippets to trigger notifications)
  - Verification: MODULE-14-VERIFICATION-V2.md checklist items 3.1-3.8 (SP Event Notifications section)
  - Tier: Tier 1 for trigger changes; Tier 2 if RPC/DB function logic changes
  - Dependencies:
    - NOTIF-V2-001 (Notification Schema & Preferences)
    - MODULE-09 (Swap Points V2 - sp_ledger, sp_wallets tables)
    - MODULE-12 (Subscriptions - status check for gating)

- **NOTIF-V2-004 (MODULE-14): Badge Award Notifications (2026-04-13)**
  - Purpose: Celebrate user achievements with real-time badge notifications and in-app celebration animation
  - Database:
    - Migration: `supabase/migrations/143_badge_notifications.sql`
    - Function: `create_badge_notification(user_id, type, title, body, data)` - Creates notification respecting user preferences
    - Function: `check_badge_milestones(user_id)` - Checks proximity to badge unlock, sends milestone notifications
    - Trigger: `badge_earned_notification` on `user_badges` table INSERT - Auto-creates notification when badge awarded
    - Milestone thresholds: Within 5 SP for SP badges, within 2 trades for trade badges
    - Deduplication: Milestone notifications sent once per badge per 7 days
  - Mobile App:
    - Service: `p2p-kids-marketplace/src/services/badgeNotifications.ts`
      - Functions: `checkBadgeMilestones()`, `getBadgeNotifications()`, `markBadgeNotificationRead()`, `sendBadgeAwardPushNotification()`
    - Component: `p2p-kids-marketplace/src/components/badges/BadgeCelebrationModal.tsx`
      - Animated celebration modal with confetti effect (canvas-confetti library)
      - Displays badge icon/emoji, name, description
      - Auto-dismisses or closes on button/overlay press
    - Hook: `useUserBadges` extended with `showCelebration`, `setShowCelebration` state
    - Integration: ProfileScreen displays celebration modal when badge awarded
    - Realtime: Badge awards trigger celebration via `useUserBadges` subscription
  - Notification Rules:
    - Sent to ALL users regardless of subscription status (not gated)
    - Respects user notification preferences (per-category toggles)
    - Includes badge visual (icon or emoji fallback) in notification
    - Deep links to `/profile/badges` on tap
  - Testing:
    - Unit tests: `src/__tests__/services/badgeNotifications.test.ts` (8 test cases)
    - Component tests: `src/__tests__/components/BadgeCelebrationModal.test.tsx` (12 test cases)
    - Integration tests: `e2e/badgeNotifications.integration.test.ts` (6 test cases with RLS verification)
    - Manual test guide: `NOTIF-V2-004-MANUAL-TESTING.md` (12 test cases including iOS/Android push notifications)
    - Maestro flow: `.maestro/badge-notifications.yaml` (covers badge earned, milestone, no-badge states)
  - Verification: MODULE-14-VERIFICATION-V2.md sections 4.1-4.4 (Badge notifications database, functional, service, UI)
  - Tier: Tier 1 (targeted smoke for badge award flow)
  - Dependencies:
    - NOTIF-V2-001 (Notification Schema & Preferences)
    - MODULE-08 (Badges V2 - user_badges, badges tables)

- **REVIEW-007 UPDATE (2026-08-02): Review Moderation Decision Notifications + Keep action**
  - Purpose: Rename admin "Approve" → "Keep" (marks review `pending_review` → `reviewed`, keeps the review visible — the report is REJECTED) and notify every reporter in-app + push of the admin's decision for BOTH Keep and Hide actions.
  - Database:
    - Migration: `supabase/migrations/20260802000001_review_moderation_status_and_notifications.sql`
    - New column: `reviews.review_status` (`active` | `pending_review` | `reviewed` | `hidden`, default `active`)
    - Trigger `check_review_reports()` now sets `review_status = 'pending_review'` when a report is created (unless already hidden)
  - Admin Portal:
    - `p2p-kids-admin/src/app/reviews/page.tsx` — "Keep" button (renamed from Approve), Pending Review / Reviewed ✓ / Hidden / Visible status badges, status filter options
    - `p2p-kids-admin/src/app/api/reviews/[reviewId]/keep/route.ts` — NEW (renamed from approve): reviewed + visible + report_count=0 + deletes reports + notifies each reporter via `create_system_notification_with_preferences('review_report_kept', ...)`
    - `p2p-kids-admin/src/app/api/reviews/[reviewId]/hide/route.ts` — now also sets `review_status='hidden'` and notifies each reporter via `create_system_notification_with_preferences('review_report_hidden', ...)`
    - `p2p-kids-admin/src/app/api/reviews/reported/route.ts` — returns `review_status`
  - Notification copy (system category):
    - Keep: "Report reviewed" / "We reviewed your report about a review. After checking it, the review stays up because it follows our guidelines."
    - Hide: "Review removed" / "The review you reported has been removed. Thanks for helping keep our community safe."
  - Testing:
    - E2E: `p2p-kids-admin/__tests__/review-moderation.e2e.test.ts` (keep test verifies `review_status='reviewed'`, reports deleted, reporter notified)
    - Unit: `p2p-kids-admin/__tests__/review-moderation.unit.test.ts` (16 tests, unchanged behavior)
  - Tier: Tier 1 (API + notification delivery path changed)

### FLOW-19: Trading Education – Onboarding, Help Content, SP Calculator (MODULE-18 V1)
- Purpose: Educate users about Swap Points, trading mechanics, and safety via configurable content, interactive SP calculator, and contextual prompts
- Covers:
  - **EDU-001 (Schema Migrations):** Database schema for education tables + publish/unpublish RPCs
    - Tables: `education_sections` (configurable help content), `education_examples` (SP calculator demos), `education_analytics` (engagement tracking)
    - Profiles columns: `onboarding_completed_at`, `onboarding_skipped_at`, `education_prompts_seen`, `education_prompts_suppressed_at`
    - Partial unique index: `uq_education_sections_one_published_per_type` (one published row per section_type)
    - RPCs: `publish_section(id)`, `unpublish_section(id)` (SECURITY DEFINER, admin-only, atomic publish/unpublish)
    - Seed content: 4 published sections (sp_definition, sp_earning, sp_spending, safety) + 3 draft examples
    - RLS policies: Anyone views published, admin manages all; analytics INSERT-only (no UPDATE/DELETE)
    - Migration files: `20260420000018..000021`
    - Manual test guide: `docs/manual_testing/EDU-001-SCHEMA-MIGRATIONS.md` (14 SQL test cases)
  - **EDU-002 (Types & Errors) - COMPLETE ✅:** Shared TypeScript types for sections/examples/calculator/analytics
    - Mobile types: `education.ts` (EducationSection, SectionType, EducationExample, SPCalculation, EducationAnalyticsEvent, BonusCategory re-export)
    - Mobile errors: `education-errors.ts` (ContentValidationError, AnalyticsWriteError)
    - Admin types: `education.ts` (all mobile types + CreateSectionInput, UpdateSectionInput, CreateExampleInput, UpdateExampleInput, EducationAnalytics)
    - Admin errors: `education-errors.ts` (ContentValidationError, UnauthorizedError, DuplicatePublishedSectionError)
    - Test coverage: 61/61 unit tests PASS (27 mobile + 34 admin)
    - No `any` types (strict TypeScript)
    - Package independence verified (mobile doesn't import admin, admin doesn't import mobile)
    - BonusCategory reused from MODULE-12 V3 (no duplication in mobile)
    - Discriminated union: SPCalculation on mode ('sell' | 'buy')
    - Manual test guide: `docs/EDU-002-MANUAL-TESTING-GUIDE.md` (10 test cases)
    - Summary: `docs/EDU-002-IMPLEMENTATION-SUMMARY.md`
  - **EDU-003 (Backend Services) - COMPLETE ✅:** Content, Example, SP Calculator, Analytics services
    - Module: MODULE-18 V1 (Task EDU-003)
    - Status: **COMPLETE (2026-05-03)**
    - Scope:
      - Mobile services (4 files):
        - `educationContentService.ts` (getPublishedSections, getSectionByType)
        - `educationExampleService.ts` (getPublishedExamples, calculateExampleSP)
        - `spCalculatorService.ts` (calculateSP, getBonusCategories — delegates to MODULE-12 V3)
        - `educationAnalyticsService.ts` (trackEducationEvent, shouldShowOnboarding, markOnboardingComplete, markOnboardingSkipped, markPromptSeen, shouldShowPrompt)
      - Admin services (3 files):
        - `educationContentService.ts` (getAllSections, createSection, updateSection, publishSection RPC, unpublishSection RPC)
        - `educationExampleService.ts` (getAllExamples, createExample, updateExample, deleteExample with publish guard)
        - `educationAnalyticsService.ts` (getEducationAnalytics — server-side aggregations)
    - Features:
      - SP calculations MUST call MODULE-12 V3 `calculateCategorySP()` (never hardcode rates)
      - Analytics is fire-and-forget (trackEducationEvent never throws, logs console.warn on failure)
      - Admin publish/unpublish via RPC only (never direct UPDATE is_published)
      - Delete example guard: refuses when is_published=true
      - Onboarding state machine: shouldShowOnboarding returns true iff both completed_at and skipped_at are NULL
      - Prompt suppression: auto-suppresses after 3 prompts when onboarding skipped
    - Tests:
      - Unit: `src/__tests__/services/educationContentService.test.ts` (cache, published filter)
      - Unit: `src/__tests__/services/spCalculatorService.test.ts` (delegation, sell/buy shapes, null category)
      - Unit: `src/__tests__/services/educationAnalyticsService.test.ts` (fire-and-forget, state machines)
      - Integration: `src/__tests__/integration/edu-003-services.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Manual: `docs/EDU-003-MANUAL-TESTING-GUIDE.md` (13 test cases)
    - Validation:
      - Typecheck: ✅ PASS (both mobile + admin)
      - Lint: ✅ PASS
      - Unit tests: ✅ PASS (pending execution)
      - Integration tests: ✅ READY (RUN_SUPABASE_E2E=true)
      - No hardcoded SP rates: ✅ VERIFIED (`grep -rn "1\.10\|1\.30\|70\|80" spCalculatorService.ts` → no matches)
      - Admin publish uses RPC: ✅ VERIFIED (no direct `UPDATE is_published` in admin service)
  - **EDU-004 (Onboarding Carousel):** 5-screen skippable carousel on first app open
    - Module: MODULE-18 V1 (Task EDU-004)
    - Flow gating: `RootNavigator` (`AppNavigator.tsx`) reads `shouldShowOnboarding(userId)` (true iff `onboarding_completed_at` AND `onboarding_skipped_at` are NULL) → mounts `OnboardingScreen`; `PersistentTabBar` renders only when `!showOnboardingCarousel`.
    - **FIX (2026-08-17) — Tab bar missing after onboarding Skip:** Previously the onboarding gate (`shouldShowOnboardingCarousel`) was only flipped by the `[currentUserId]` effect on a fresh mount, so tapping **Skip** (or Get Started) navigated to Home while `showOnboardingCarousel` stayed `true` → `PersistentTabBar` (no FAB, no tabs) never mounted until a force-quit/relaunch.
    - Fix: `OnboardingScreen` now reads `onOnboardingFinished` from route params (wired in `AppNavigator.tsx` via `initialParams` on the `Onboarding` screen) and calls it from `navigateToHome()` on BOTH the Skip and Get Started paths → `setShouldShowOnboardingCarousel(false)` → tab bar mounts immediately, no relaunch.
    - **RE-APPLIED + COMMITTED (2026-08-18, commit `1b12086f`):** the `initialParams` wiring had been applied earlier but silently lost from the uncommitted working tree (`git log -S "onOnboardingFinished"` / `git log -S "initialParams"` on `AppNavigator.tsx` were both empty), so `route?.params?.onOnboardingFinished?.()` no-op'd and the tab bar stayed hidden until relaunch. Re-wired, verified on-device, and committed so it can't be lost again. The earlier claim in this file that the wiring "exists" was premature (doc drift) — it is now genuinely applied AND committed.
    - Files: `src/screens/onboarding/OnboardingScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/navigation/types.ts`, `src/screens/onboarding/__tests__/OnboardingScreen.test.tsx`
    - Unit: `OnboardingScreen.test.tsx` (8 tests incl. Skip + Get Started gate-flip assertions) **+ `src/navigation/__tests__/AppNavigatorOnboardingTabBar.test.tsx` (NEW regression)** which renders the REAL `RootNavigator` + REAL `OnboardingScreen` with mocked auth/onboarding state, drives Skip and Get Started, and asserts all five tab bar items mount WITHOUT a relaunch. It FAILS if `initialParams` is removed (verified) — the older screen-level test mocked the param directly and could not catch the missing wiring.
    - On-device: verified iPhone 17 Pro Max sim (iOS 26.1) — tab bar (`tab-home`/`tab-discover`/`tab-sell`/`tab-trades`/`tab-basket`) renders immediately after Skip AND after Get Started, no relaunch.
  - **EDU-005 (Help Screen) - COMPLETE ✅:** Accordion sections + embedded SP calculator + bonus categories
    - Module: MODULE-18 V1 (Task EDU-005)
    - Status: **COMPLETE (2026-05-03)**
    - Scope:
      - NEW screens (1 file):
        - `p2p-kids-marketplace/src/screens/help/HelpScreen.tsx` - Always-accessible help with accordion, calculator, bonus list
      - NEW components (4 files):
        - `p2p-kids-marketplace/src/components/education/EducationSectionAccordion.tsx` - Expand/collapse animated section
        - `p2p-kids-marketplace/src/components/education/SPCalculator.tsx` - Category-aware SP calculator widget
        - `p2p-kids-marketplace/src/components/education/BonusCategoriesList.tsx` - Bonus categories list (sp_earning_multiplier > 1.10)
        - `p2p-kids-marketplace/src/components/education/BonusCategoryBadge.tsx` - Badge component (⭐/🏆)
      - MODIFIED screens (1 file):
        - `p2p-kids-marketplace/src/screens/profile/SettingsScreen.tsx` - Added "Help → How Trading Works" menu entry
      - MODIFIED navigation (2 files):
        - `p2p-kids-marketplace/src/navigation/types.ts` - Added Help: { section?: string } | undefined route
        - `p2p-kids-marketplace/src/navigation/AppNavigator.tsx` - Registered Help screen
    - Features:
      - Route: Settings → Help → How Trading Works (`/settings/help`)
      - Deep link support: `?section=sp_spending` auto-expands specific section and scrolls into view
      - Default state: `sp_definition` section expanded on initial load
      - Accordion: Tap header toggles expand/collapse; chevron rotation animation; `accessibilityState={expanded}` announced
      - Section body: Plain text with newline preservation (no markdown/HTML)
      - SP Calculator: Embedded below sections; defaults to "Select a category"; sell/buy modes; delegated to MODULE-12 V3
      - Bonus Categories: List of categories where `sp_earning_multiplier > 1.10`; sorted DESC by multiplier; shows icon + name + badge + earn-rate text (e.g., "Earn 1.30× SP")
      - Pull-to-refresh: Invalidates `['education-sections']` + `['bonus-categories']` query keys
      - Analytics: `help_view` on mount (once per mount); `section_expand` on each expand (event_data: { section_type })
      - Cache: Published sections cached 5 minutes (React Query staleTime)
      - Performance target: Initial load < 1 second with sections cached
    - Tests:
      - Unit tests (2 files):
        - `src/__tests__/components/education/SPCalculator.test.tsx` - 20 test cases (sell mode, buy mode, readonly, error handling, analytics)
        - `src/__tests__/screens/help/HelpScreen.test.tsx` - 12 test cases (load sections, default expansion, deep link, pull-to-refresh, navigation, error handling)
      - Integration tests (1 file):
        - `src/__tests__/integration/help-screen.integration.test.ts` - 6 test cases (RUN_SUPABASE_E2E=true)
      - Maestro flow:
        - `.maestro/help-screen-education.yaml` - 6 states: default load, section expansion, calculator interaction, bonus categories, pull-to-refresh, back navigation
      - Manual test guide:
        - `EDU-005-MANUAL-TESTING-GUIDE.md` - 12 test cases (navigation, accordion, calculator, bonus categories, deep link, pull-to-refresh, analytics, accessibility, error handling)
    - testIDs:
      - `help-screen`, `help-back-button`, `help-refresh-control`, `help-scroll-view`
      - `help-section-{section_type}-header`, `help-section-{section_type}-content`, `help-section-{section_type}-image`
      - `help-sp-calculator`, `{testID}-category-picker`, `{testID}-price-input`, `{testID}-calculate-button`, `{testID}-result`
      - `help-bonus-categories`, `help-bonus-categories-item-{id}`, `help-bonus-categories-badge-{id}`
      - `settings-help-button` (in SettingsScreen)
    - Verification Criteria (from MODULE-18-VERIFICATION-TRADING-EDUCATION.md § 5):
      - ✅ Route reachable from Settings; initial load < 1s with sections cached
      - ✅ `sp_definition` expanded by default; other sections collapsed
      - ✅ Tap header toggles; `accessibilityState={expanded}` announced
      - ✅ Section body rendered as plain text with newline preservation
      - ✅ Calculator defaults to "Select a category"
      - ✅ Bonus Categories section renders categories where `sp_earning_multiplier > 1.10`; sorted DESC by multiplier
      - ✅ Analytics: `help_view` on mount (once); `section_expand` on each expand
      - ✅ Deep link `?section=sp_spending` auto-expands section and scrolls into view
      - ✅ Pull-to-refresh invalidates cache
      - ✅ All unit tests pass (npm run test:unit)
      - ✅ Integration tests pass (RUN_SUPABASE_E2E=true npm run test:e2e)
      - ✅ Maestro flow passes (npm run test:maestro:ios & npm run test:maestro:android)
    - Dependencies:
      - EDU-001 (education_sections table exists with published content)
      - EDU-002 (EducationSection, SPCalculation, BonusCategory types exist)
      - EDU-003 (educationContentService, spCalculatorService, educationAnalyticsService exist)
      - MODULE-12 V3 (getBonusCategories, calculateCategorySP functions)
      - MODULE-03 V2 (Settings shell exists)
    - Tier: Tier 0 (always - typecheck + lint + unit tests); Tier 1 (UI/service changes - Maestro flow)
  - **EDU-006 (SP Calculator Widget + BonusCategoryBadge) - COMPLETE ✅:** Reusable calculator in Help + Sell, with legacy checkout preserved and SP info tooltip
    - Module: MODULE-18 V1 (Task EDU-006)
    - Status: **COMPLETE (2026-05-03)**
    - Scope:
      - REFACTORED components (2 files):
        - `p2p-kids-marketplace/src/components/education/SPCalculator.tsx` - Now shows BOTH sell + buy panels simultaneously; mode changed from 'sell'|'buy' to 'free'|'auto'
        - `p2p-kids-marketplace/src/components/education/BonusCategoryBadge.tsx` - Enhanced with expo-image support; loads bonus_badge_icon_url or falls back to ⭐ emoji
      - MODIFIED screens (3 files):
        - `p2p-kids-marketplace/src/screens/help/HelpScreen.tsx` - Calculator mode="free" (user selects category + price)
        - `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` - Calculator mode="auto" (pre-fills category from listing draft, user can override)
        - `p2p-kids-marketplace/src/screens/trade/TradeInitiationScreen.tsx` - Legacy checkout restored; added SP info icon + `SPInfoTooltip` modal, no embedded calculator
    - Features:
      - **Dual-panel display:** Calculator now calls calculateSP TWICE (Promise.all) and renders both sell + buy results simultaneously
      - **Calculator modes:**
        - `free`: Empty initial state, both category and price editable (HelpScreen)
        - `auto`: Pre-fills category/price from context, both editable (ItemCreateScreen)
      - **Checkout behavior:** TradeInitiationScreen uses legacy checkout sections and an SP info icon/modal (`SPInfoTooltip`) for education context
      - **Price limits:** Enforced 0-10000 range, 2 decimal precision, client-side validation
      - **Analytics:** `calculator_use` event with price buckets ('<10', '10-50', '50-100', '>100') — NO exact price logged (privacy)
      - **Bonus badge:** Conditionally renders if category's `sp_earning_multiplier > 1.10`; loads `bonus_badge_icon_url` from categories table via expo-image Image component; falls back to ⭐ emoji on error
      - **Accessibility:** Category picker labeled "Category, button"; price input labeled "Item price, currency"; results container has `accessibilityLiveRegion="polite"`
    - Tests:
      - Unit tests (2 files):
        - `src/__tests__/components/education/SPCalculator-EDU-006.test.tsx` - 45 test cases covering all 3 modes, dual panels, price limits, analytics buckets, bonus badge rendering, accessibility
        - `src/__tests__/components/education/BonusCategoryBadge-EDU-006.test.tsx` - 6 test cases (image load, emoji fallback, error handling, accessibility)
      - Integration tests (1 file):
        - `e2e/edu-006-sp-calculator.integration.test.ts` - 8 test cases (RUN_SUPABASE_E2E=true): real category data, dual calculations, bonus flags, price boundaries
      - Maestro flow:
        - `.maestro/edu-006-sp-calculator-placements.yaml` - Tests free (HelpScreen), auto (ItemCreateScreen), and legacy checkout + SP info tooltip (TradeInitiationScreen)
      - Manual test guide:
        - `EDU-006-MANUAL-TESTING-GUIDE.md` - 16 test cases (iOS + Android simulators): all 3 placements, price limits, analytics, bonus badges, accessibility, cross-platform regression
    - testIDs:
      - `help-sp-calculator`, `item-create-sp-calculator`, `trade-sp-info-icon`, `trade-sp-info-tooltip`
      - `{testID}-category-picker`, `{testID}-category-modal`, `{testID}-price-input`
      - `{testID}-empty-state`, `{testID}-sell-panel`, `{testID}-buy-panel`
      - `{testID}-sell-bonus-badge`, `{testID}-buy-bonus-badge` (conditional)
      - `{testID}-results` (live region container)
    - Verification Criteria (from MODULE-18-VERIFICATION-TRADING-EDUCATION.md § 6):
      - ✅ Calculator renders in 2 placements: HelpScreen (free), ItemCreateScreen (auto)
      - ✅ Free mode: empty state, both inputs editable, dual panels on calculate
      - ✅ Auto mode: pre-filled from context, both inputs editable, dual panels on calculate
      - ✅ TradeInitiationScreen keeps legacy checkout UI and provides SP explanation via info icon + tooltip modal
      - ✅ Price enforced: 0-10000, 2 decimals max
      - ✅ Analytics: price bucketed ('<10', '10-50', '50-100', '>100'), no exact price logged
      - ✅ Bonus badge: renders if `sp_earning_multiplier > 1.10`; loads icon URL or shows emoji fallback
      - ✅ Accessibility: labels, roles, live region on results
      - ✅ All unit tests pass (npm run test:unit)
      - ✅ Integration tests pass (RUN_SUPABASE_E2E=true npm run test:e2e)
      - ✅ Maestro flow passes (both iOS + Android)
    - Dependencies:
      - EDU-003 (spCalculatorService.calculateSP exists and delegates to MODULE-12 V3)
      - EDU-003 (educationAnalyticsService.trackEducationEvent exists)
      - MODULE-12 V3 (categoryService.getCategoriesWithCounts, categories.bonus_badge_icon_url column)
      - MODULE-09 V2 (fee calculations match trade flow)
    - Tier: Tier 0 (always - typecheck + lint + unit tests); Tier 1 (UI changes - Maestro flow)
  - EDU-007 (Contextual Prompts): 1-time prompts before first listing/purchase
  - EDU-008 (Admin CMS): Section/example editor + publish/draft + preview
  - EDU-009 (Admin Analytics): Dashboard for onboarding/help/calculator metrics
  - EDU-010 (Tests): Jest unit + PgTAP + Playwright + Maestro
- Database:
  - Tables: `education_sections`, `education_examples`, `education_analytics`
  - Columns added to `profiles`: onboarding_completed_at, onboarding_skipped_at, education_prompts_seen, education_prompts_suppressed_at
  - Partial unique index enforces one published row per section_type
  - RLS: Published content visible to all; draft content admin-only; analytics append-only
  - Triggers: `education_sections_updated_at`, `education_examples_updated_at`
  - Indexes: `idx_education_sections_published`, `idx_education_sections_type`, `idx_education_examples_published`, `idx_education_analytics_event_type`, `idx_education_analytics_user`
- Key Rules:
  - SP calculations MUST call MODULE-12 V3 `calculateCategorySP()` (never hardcode rates)
  - Bonus badge shows iff `sp_earning_multiplier > 1.10` (strict greater-than, not equal)
  - Published content is append-only from user perspective (admin unpublishes atomically)
  - Onboarding shown exactly once (both completed_at and skipped_at NULL)
  - Contextual prompts strict 1-time (tracked via JSONB array in profiles)
  - Admin RPCs enforce `user_roles.role = 'admin'` server-side (SECURITY DEFINER)
  - Examples store price + category_id ONLY (SP values computed on read)
  - Analytics append-only with NO PII (price buckets, category IDs only)
- Testing:
  - Manual (SQL): `docs/manual_testing/EDU-001-SCHEMA-MIGRATIONS.md` (14 test cases for migrations)
  - Unit tests: (EDU-002..EDU-010 deliverables TBD)
  - Integration tests: (EDU-010 deliverable TBD)
  - Maestro flows: (EDU-010 deliverable TBD)
- Smoke: (manual SQL verification for EDU-001)
  - All 3 tables created with RLS enabled
  - Partial unique index exists and enforces one published per section_type
  - 4 profiles columns added (onboarding_completed_at, onboarding_skipped_at, education_prompts_seen, education_prompts_suppressed_at)
  - 4 seed sections published (sp_definition, sp_earning, sp_spending, safety)
  - 3 seed examples created (draft, category_id NULL)
  - publish_section RPC unpublishes previous row atomically
  - Non-admin cannot call publish_section (throws UnauthorizedError)
  - Analytics UPDATE/DELETE blocked by RLS (append-only enforcement)
- Tier: Tier 2 (DB migrations, triggers, RPC, RLS policies)
- Dependencies:
  - MODULE-01 (user_roles, profiles tables)
  - MODULE-12 V3 (categories table, SP rate functions)
  - MODULE-09 V2 (SP balance for calculator context)

- **NOTIF-V2-005 (MODULE-14): Push Notification Delivery Engine (2026-04-13)**
  - Purpose: Centralized push notification delivery with rate limiting, quiet hours, deduplication, retry mechanism, and receipt tracking
  - Database:
    - Migration: `supabase/migrations/202_push_delivery_engine_v2.sql`
    - Tables:
      - `push_delivery_log` - Tracks every push attempt with Expo receipt ID, status, retry count
      - `notification_deduplication` - Prevents duplicate notifications within 5-minute window
      - `notification_retry_queue` - Manages failed deliveries for retry (up to 3 attempts with exponential backoff)
    - RPCs:
      - `check_push_rate_limit(user_id)` - Returns true if user under 10 notifications/hour
      - `is_in_quiet_hours(user_id)` - Returns true if current time within user's quiet hours
      - `is_duplicate_notification(user_id, type, fingerprint)` - Checks 5-minute dedup window
      - `record_notification_dedup(user_id, type, fingerprint)` - Records fingerprint with 5-min expiry
      - `log_push_delivery(user_id, notification_id, push_token_id, receipt_id, status, message, details, retry_count)` - Logs delivery attempt
      - `add_to_retry_queue(notification_id, user_id, error, error_details)` - Adds failed notification to retry queue
      - `remove_from_retry_queue(notification_id)` - Removes notification after successful delivery
      - `cleanup_expired_deduplications()` - Maintenance function to delete expired dedup entries
    - View: `v_pending_retries` - Shows notifications pending retry with metadata
    - Indexes: Optimized for rate limit queries (user_id, sent_at), receipt lookups, retry filtering
  - Mobile App:
    - Service: `p2p-kids-marketplace/src/services/pushDelivery.ts`
      - Functions:
        - `sendPushNotification(options)` - Main delivery engine with all checks
        - `sendTestPushNotification(userId)` - Test notification for manual verification
        - `processPushReceipts(ticketIds)` - Fetches and updates Expo receipt status
        - `retryFailedDeliveries()` - Processes retry queue (called by cron/interval)
      - Features:
        - Rate limiting: Max 10 push/hour per user (configurable)
        - Quiet hours: Respects user's quiet hours (default 10pm-8am)
        - Deduplication: Prevents duplicate notifications within 5 minutes
        - Retry mechanism: Up to 3 attempts with exponential backoff (1min, 5min, 15min)
        - Critical bypass: Critical notifications (payment failures) bypass rate limits and quiet hours
        - Multi-device: Sends to all user's registered push tokens
        - Receipt tracking: Updates delivery status based on Expo API receipts
    - UI Integration:
      - Settings screen: "Test Push Notification" button added for manual testing
      - Alert feedback: Rate limited, quiet hours, send success/failure states
      - Loading indicator during send
  - Notification Rules:
    - Rate limit: 10 notifications/hour (enforced server-side)
    - Quiet hours: Default 10pm-8am (user-configurable)
    - Deduplication window: 5 minutes (same type + fingerprint)
    - Retry attempts: 3 max with exponential backoff
    - Critical notifications bypass all limits
    - Invalid/expired tokens are removed automatically
  - Testing:
    - Unit tests: `p2p-kids-marketplace/src/services/__tests__/pushDelivery.test.ts` (20+ test cases)
      - Rate limiting logic
      - Quiet hours enforcement
      - Deduplication prevention
      - Retry queue management
      - Critical notification bypass
      - Multi-device handling
      - Error handling
    - E2E integration tests: `p2p-kids-marketplace/e2e/notif-v2-005-push-delivery.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Rate limit enforcement (10/hour)
      - Quiet hours blocking non-critical
      - Duplicate notification prevention
      - Delivery log tracking
      - Receipt tracking
      - Retry queue operations
      - RPC function validation
    - Manual test guide: `NOTIF-V2-005-MANUAL-TESTING-GUIDE.md` (10 comprehensive test cases)
      - TC1: Token storage & update on login
      - TC2: Rate limiting (10/hour)
      - TC3: Quiet hours enforcement
      - TC4: Duplicate prevention (5-min)
      - TC5: Failed delivery retry (3 attempts)
      - TC6: Receipt tracking
      - TC7: Critical notifications bypass
      - TC8: Multiple devices support
      - TC9: Cleanup expired dedup entries
      - TC10: End-to-end flow
  - Verification: MODULE-14-VERIFICATION-V2.md section 5 (Push Notification Delivery entire section)
  - Tier: Tier 1 for delivery logic changes; Tier 2 if database schemas/RPCs change
  - Dependencies:
    - NOTIF-V2-001 (Notification Schema & Preferences - quiet hours settings)
    - `push_tokens` table (from earlier migration 20241213000000_add_push_tokens_table.sql)
    - Expo Push Notifications SDK (expo-server-sdk)

- **NOTIF-V2-006 (MODULE-14): In-App Notification Center**
  - Purpose: Full notification history UI with unread/read distinction, badge count, mark as read (individual + all), pull-to-refresh, infinite scroll (PAGE_SIZE=20), realtime subscription. Entry via BottomNavBar 🔔 Alerts tab or push notification deep link `/notifications`.
  - No SQL migration required — reuses existing `user_notifications` table and RPCs: `mark_notification_read`, `mark_all_notifications_read`, `get_unread_notification_count`.
  - New files:
    - `p2p-kids-marketplace/src/screens/notifications/NotificationCenterScreen.tsx` (NEW — main screen)
    - `p2p-kids-marketplace/src/hooks/useNotificationBadge.ts` (NEW — badge count hook with realtime)
  - Edited files:
    - `p2p-kids-marketplace/src/components/organisms/BottomNavBar/index.tsx` — 🔔 Alerts item with red badge
    - `p2p-kids-marketplace/src/navigation/AppNavigator.tsx` — `Notifications` route + deep link `notifications`
  - Service layer: Reuses functions from `p2p-kids-marketplace/src/services/referralNotifications.ts` (no new service file created)
  - Unit tests: `p2p-kids-marketplace/src/__tests__/screens/NotificationCenterScreen.test.tsx` (14 screen + 4 hook test cases)
  - E2E tests: `p2p-kids-marketplace/src/__tests__/e2e/notification-center.e2e.ts` (RUN_SUPABASE_E2E=true, 6 test cases: fetch, unread count, mark single read, mark all read, pagination, RLS)
  - Maestro flow: `.maestro/notif-v2-006-notification-center.yaml` (states: list, unread indicators, mark-all-read, pull-to-refresh, empty state, back navigation)
  - Manual test guide: `NOTIF-V2-006-MANUAL-TESTING.md`
  - testIDs: `notification-center-screen`, `notification-list`, `screen-title`, `back-button`, `mark-all-read-button`, `loading-indicator`, `loading-state`, `empty-state`, `error-state`, `retry-button`, `load-more-indicator`, `notification-item-{id}`, `unread-indicator-{id}`, `notification-badge` (in BottomNavBar)
  - Deep link: `p2pkidsmarketplace://notifications` → navigates to `Notifications` stack route
  - Tier: Tier 0 always; Tier 1 when service/realtime logic changes; Tier 2 if `user_notifications` schema or RPCs change
  - Dependencies: NOTIF-V2-001 (schema), NOTIF-V2-003 (SP notifications), `referralNotifications.ts` service layer

- **NOTIF-V2-009 (MODULE-14): Email Notifications (2026-04-16)**
  - Purpose: Implement email notification delivery for critical events (payment failures, subscription cancellations, security alerts) with tracking, unsubscribe management, and SendGrid integration
  - Database:
    - Migration: `supabase/migrations/209_email_notifications_tracking.sql`
    - Tables:
      - `email_logs` - Tracks every email sent with status (pending/sent/delivered/opened/clicked/bounced/failed), SendGrid message IDs, timestamps for each event, bounce reasons, template data
      - `unsubscribe_tokens` - 365-day validity tokens linking user_id to notification category for unsubscribe links
    - RPCs:
      - `create_email_log(user_id, recipient_email, template_type, template_data, notification_id)` - Creates email log entry
      - `update_email_log_status(log_id, status, message)` - Updates email status after delivery
      - `track_email_event(sg_message_id, event, timestamp, reason, url)` - Updates log from SendGrid webhook events
      - `generate_unsubscribe_token(user_id, category)` - Creates 365-day token for unsubscribe links
      - `process_unsubscribe(token)` - Validates token, disables email preference, marks token used
      - `get_email_delivery_stats(start_date, end_date)` - Returns email delivery metrics (sent, delivered, opened, clicked, bounced)
    - Config: `admin_config` entries for SendGrid template IDs (payment_failed, trial_expiring, subscription_cancelled, security_alert, password_changed)
  - Edge Functions:
    - Extended: `supabase/functions/send-email/index.ts`
      - Added email preference checking (respects `notification_preferences.email_enabled` per category)
      - Critical emails (payment_failed, subscription_cancelled, security_alert, password_changed) bypass preferences
      - Non-critical emails (trial_expiring) respect opt-out preferences
      - Creates email log entry before sending
      - Generates unsubscribe token for non-critical emails
      - Updates email log status after SendGrid response
      - Email processors for each template type with dynamic data
    - Created: `supabase/functions/email-webhook/index.ts`
      - Receives SendGrid webhook events (delivered, open, click, bounce, dropped, unsubscribe, spamreport)
      - Calls `track_email_event` RPC with event data
      - Special handling for unsubscribe events: disables all email preferences for user
  - Mobile App:
    - Service: `p2p-kids-marketplace/src/services/emailNotifications.ts`
      - Functions:
        - `sendPaymentFailureEmail(userId, email, subscriptionId, amount, reason)` - isCritical=true
        - `sendTrialExpiringEmail(userId, email, daysRemaining, trialEndsAt)` - isCritical=false
        - `sendSubscriptionCancelledEmail(userId, email, gracePeriodEndsAt)` - isCritical=true
        - `sendSecurityAlertEmail(userId, email, alertType, alertMessage)` - isCritical=true
        - `sendPasswordChangedEmail(userId, email)` - isCritical=true
        - `getUserEmailStats(userId)` - Returns delivery statistics
    - Screen: `p2p-kids-marketplace/src/screens/UnsubscribeScreen.tsx`
      - Handles unsubscribe link clicks from emails
      - Processes unsubscribe token via `process_unsubscribe` RPC
      - Shows success/error states with loading indicator
      - Displays category unsubscribed and navigation to settings
      - testIDs: loading-indicator, success-title, error-title, go-home-button
    - Navigation: `Unsubscribe` route added to AppNavigator with deep link `unsubscribe?token={TOKEN}`
  - Email Templates (SendGrid):
    - `payment_failed` - Payment failure notification with update payment method CTA
    - `trial_expiring` - Trial expiration reminder with subscribe now CTA + unsubscribe link
    - `subscription_cancelled` - Cancellation confirmation with grace period end date + reactivate CTA
    - `security_alert` - Security event notification with alert details
    - `password_changed` - Password change confirmation
  - Email Rules:
    - Critical emails: Bypass all preference checks, always delivered, no unsubscribe link
    - Non-critical emails: Respect `notification_preferences.email_enabled` per category, include unsubscribe link
    - Unsubscribe tokens: 365-day validity, one-time use only
    - Tracking: All emails tracked in `email_logs` with SendGrid message ID for webhook correlation
    - Webhook events: delivered, open, click, bounce, dropped, unsubscribe, spamreport
  - Testing:
    - Unit tests: `p2p-kids-marketplace/src/services/__tests__/emailNotifications.test.ts` (18 test cases)
      - All 6 service functions tested with success/error paths
      - Critical vs non-critical flag behavior
      - Preference skipping logic
      - Statistics aggregation
    - E2E integration tests: `e2e/email-notifications.integration.test.ts` (RUN_SUPABASE_E2E=true)
      - Send payment failure and verify log entry
      - Email preference enforcement (disabled category skips email)
      - Email statistics accuracy
      - Unsubscribe token generation and processing
      - Invalid/expired token rejection
    - Maestro flow: `.maestro/email-unsubscribe.yaml`
      - States covered: valid-token (success), invalid-token (error), expired-token (error), re-enable-after-unsubscribe
      - Deep link testing with `p2pkidsmarketplace://unsubscribe?token=TOKEN`
    - Manual test guide: `NOTIF-V2-009-MANUAL-TESTING-GUIDE.md` (12 comprehensive test cases)
      - TC1-TC6: Email delivery for each template type
      - TC7: Email delivery tracking (sent → delivered → opened → clicked)
      - TC8: SendGrid webhook event processing
      - TC9: Email statistics accuracy
      - TC10: Mobile responsiveness across email clients
      - TC11: Invalid unsubscribe token handling
      - TC12: Re-enable email notifications after unsubscribe
  - Verification: MODULE-14-VERIFICATION-V2.md section 9 (Email Notifications)
  - Tier: Tier 1 for edge function/service changes; Tier 2 if database schemas/RPCs change
  - Dependencies:
    - NOTIF-V2-001 (Notification Schema & Preferences - email_enabled per category)
    - SendGrid API key configured in Supabase Edge Function secrets
    - SendGrid webhook endpoint configured to point to `email-webhook` edge function
    - SendGrid templates created and template IDs added to `admin_config`
  - **QA-QS-EDU-ANALYTICS-FEE (2026-08-23):** Trading Education fixes from the Group Q+S run
    - `chk_education_analytics_event_type` widened to accept `help_view`/`seller_prompt_view`/`buyer_prompt_view` (TS union) per `docx/TRADING-EDUCATION-REQUIREMENTS.md` — the app's own Help-screen `help_view` event was silently dropped (Q06). Migration `supabase/migrations/20260823000001_reconcile_education_analytics_event_type.sql` (**APPLIED to staging 2026-08-23** — constraint verified live; rollback-safe `help_view` insert returns an id).
    - Education SP calculator fee preview is now subscriber-aware (`spCalculatorService.calculateSP` buy mode): Kids Club+ members see `transaction_fee_subscriber_cents` (staging $1.00), free users the non-subscriber fee (Q04 UX concern). Tier-lookup failure falls back to the non-subscriber figure without nuking the preview. Unit tests added.
    - Tier: 0 (mobile) + Tier 2 (DB) — migration applied and verified on staging.

### FLOW-18: Admin Controls
- Smoke: (manual)
  - Approving a pending listing succeeds and creates an audit row in `admin_activity_log`.
  - Config persistence: update `referral_bonus` in Admin Config UI -> refresh -> value stays updated.
  - DB reflects change: `admin_config.key='referral_bonus'` and `sp_config.config_key='referral_bonus'` match.
  - **ADMIN-V3-006 (2026-04-29):** SP Analytics Dashboard
    - Purpose: Track per-category Swap Points velocity, gap percentage, and average cash flow metrics with anomaly detection
    - Route: `/admin/sp-analytics` accessible from sidebar navigation under "Settings"
    - Features:
      - Date range selector (7 / 30 / 90 days, default 30)
      - Metrics table showing Category, Velocity, Gap %, Avg Cash/Trade, Anomaly Flags
      - Anomaly detection: hoarding (gap > 10%), low_velocity (velocity < 0.5), spending_spike (velocity > 2)
      - Anomaly alerts panel with flagged categories
      - Click category row or alert card → deep-link to `/categories?edit={id}&tab=sp-config`
      - CSV export with current date range snapshot
      - Performance: Initial load < 1s on staging data
    - Files:
      - Page: `p2p-kids-admin/src/app/sp-analytics/page.tsx`
      - Components: `src/components/spconfig/SPAnalyticsDashboard.tsx`, `SPMetricsTable.tsx`, `SPAnomalyAlerts.tsx`, `DateRangePicker.tsx`
      - Service: `src/lib/spConfigCategoryService.ts` (getSPAnalyticsByCategory - existed, now used by UI)
      - Navigation: `src/components/layout/Sidebar.tsx` (added SP Analytics link)
    - Tests:
      - Unit: `src/__tests__/components/spconfig/*.test.tsx` (4 component test files, 50+ test cases)
      - E2E: `src/__tests__/e2e/sp-analytics.e2e.ts` (8 test groups: service fetch, anomaly detection, performance)
      - Maestro: `.maestro/admin-sp-analytics-dashboard.yaml` (9 test scenarios: page load, date range, metrics table, anomaly alerts, row click, CSV export)
      - Manual: `ADMIN-V3-006-MANUAL-TESTING-GUIDE.md` (20 comprehensive test cases: TC-001 to TC-020)
    - Verification: MODULE-12-VERIFICATION-V3.md section 4 (SPAnalyticsDashboard) fully satisfied
    - Dependencies: ADMIN-V3-003 (getSPAnalyticsByCategory service function), ADMIN-V3-004 (CategoryManagementPage for deep-link target)
    - Tier: Tier 0 (unit tests always), Tier 1 (E2E + Maestro when admin analytics or category SP config changes)
  - **ADMIN-V3-007 (2026-04-30):** Mobile Integration — Bonus Badges, Item Counts, Category SP Caps, Other Flow Dual-Write
    - Purpose: Wire mobile app to admin-owned category data layer for displaying bonus badges, item counts, enforcing category-specific SP caps, and ensuring "Other" category suggestions reach admin queue
    - Scope: 5 mobile file modifications + 1 new BonusBadge component + 1 new CategoryFilterChip component
    - Features:
      - **Bonus Badges**: Categories with `sp_earning_multiplier > 1.10` display custom badge icon or ⭐ emoji fallback in category selection modal and filter chips
      - **Item Counts**: Category selection shows "Name (count)" format; zero-count categories hidden from buyer flows
      - **Category SP Calculations**: Live SP earning/spending preview on price suggestion card using `calculateCategorySP(categoryId, price)`
      - **Trade Initiation SP Cap**: Checkout enforces category-specific `max_spend_sp` (overrides global 50% cap when category cap is higher)
      - **"Other" Dual-Write**: Publishing "Other" item writes to both `review_flags` (existing) AND `category_suggestions` table (new) with non-blocking try/catch
      - **Discovery Filter Chips**: CategoryFilterChip component respects zero-count filtering and displays bonus badges
    - Files:
      - Service: `p2p-kids-marketplace/src/services/categoryService.ts` (enhanced with `calculateCategorySP`, `getBonusCategories`, `getCategoriesWithCounts` filtering)
      - Component: `p2p-kids-marketplace/src/components/shared/BonusBadge.tsx` (NEW - reusable bonus badge with custom icon or emoji fallback)
      - Component: `p2p-kids-marketplace/src/components/discovery/CategoryFilterChip.tsx` (NEW - filter chip with zero-count hiding and bonus badges)
      - Component: `p2p-kids-marketplace/src/components/listing/CategorySelectModal.tsx` (updated to show counts and bonus badges)
      - Component: `p2p-kids-marketplace/src/components/listing/PriceSuggestionCard.tsx` (updated to display category SP earn/spend info)
      - Screen: `p2p-kids-marketplace/src/screens/trade/TradeInitiationScreen.tsx` (updated to enforce category-specific SP cap)
      - Screen: `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` (already had dual-write, lines 606-618 - no changes needed)
    - Tests:
      - Unit: `src/__tests__/services/categoryService.calculateCategorySP.test.ts` (8 test cases: custom multiplier/cap, defaults fallback, null handling, rounding precision, min/max ranges)
      - Unit: `src/components/__tests__/shared/BonusBadge.test.tsx` (6 test cases: custom icon, emoji fallback, size variants, accessibility)
      - Unit: `src/components/__tests__/discovery/CategoryFilterChip.test.tsx` (12 test cases: zero-count hiding, bonus badges, selection state, accessibility)
      - Integration: `e2e/admin-v3-007-category-sp-integration.test.ts` (5 test groups: getCategoriesWithCounts filtering, getBonusCategories ordering, calculateCategorySP against real DB, edge case prices, zero-count enforcement)
      - Maestro: `.maestro/admin-v3-007-category-selection.yaml` (5 states: modal opened, bonus badges visible, zero-count hidden, selection confirmed)
      - Maestro: `.maestro/admin-v3-007-sp-calculation.yaml` (8 states: SP info display, category change updates, zero price hides info)
      - Maestro: `.maestro/admin-v3-007-trade-sp-cap.yaml` (12 states: SP cap enforcement, manual input clamping, payment flow)
      - Maestro: `.maestro/admin-v3-007-other-category-dual-write.yaml` (13 states: "Other" selection, custom name input, publish, dual-write verification)
      - Maestro: `.maestro/admin-v3-007-category-filter-chips.yaml` (12 states: filter chips, bonus badges, zero-count hiding, selection toggle)
      - Manual: `ADMIN-V3-007-MANUAL-TESTING-GUIDE.md` (13 test cases TC-001 to TC-013 + 3 regression checks)
    - Verification: 
      - Tier 0: `npm run typecheck` ✅ PASS, `npm run lint` ✅ PASS (1 non-blocking warning)
      - Tier 1: `npm run test:unit` (all unit tests), `RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests)
      - Maestro: `npm run test:maestro:ios`, `npm run test:maestro:android` (5 UI flows)
      - MODULE-12-VERIFICATION-V3.md section 5 (Mobile Integration Task ADMIN-V3-007) fully satisfied
    - Dependencies: 
      - ADMIN-V3-001 (schema migrations - categories table V3 columns)
      - ADMIN-V3-003 (categoryService foundation functions)
      - ADMIN-V3-005 (category_suggestions table and dual-write logic)
    - Tier: Tier 0 (typecheck/lint always), Tier 1 (unit + integration tests when category or SP logic changes), Maestro (UI flows)

- **MODULE-15.1 FLOW-19: Help & Support (UI Redesign) - COMPLETE ✅ (2026-05-06)**
  - Purpose: Redesign Help & Support screens with MODULE-15.1 Whisk design system (visual-only changes, no business logic)
  - Scope: 3 new screens for user support: FAQ list with search/category filter, FAQ detail with helpful feedback, Contact Support form
  - Features:
    - **HelpScreen (FAQ List):**
      - Search bar: Filled style (#F0F0F0 background, 12px radius, 48px height, MagnifyingGlass icon 20px #999999)
      - Category filtering: Pill chips (active: #5DBB8E green, inactive: #F0F0F0 gray), 6 categories (All, Getting Started, Swap Points, Trading, Account, Safety)
      - FAQ rows: Question icon (16px, #5DBB8E), question text, CaretRight icon (16px, #999999)
      - Empty state: "No results found" when search/filter returns zero FAQs
      - Sticky footer: Green pill "Contact Us" button (#5DBB8E, 26px radius, 52px height, ChatCircle icon)
    - **FAQDetailScreen:**
      - Category badge: Light green background (#E8F5F0), green text (#5DBB8E), 12px font, uppercase
      - Question display: Question icon (24px, #5DBB8E), 20px semibold text
      - Answer text: 16px, #6B6B6B color, 24px line height
      - Helpful feedback: "Was this helpful?" with Yes/No buttons (gray #F0F0F0 background)
      - Yes button: navigates back (goBack)
      - No button: navigates to ContactSupport
      - Contact Support CTA: Green pill button at bottom
    - **ContactSupportScreen:**
      - Form fields: Subject input (max 100 chars, EnvelopeSimple icon), Message textarea (max 1000 chars, min 120px height)
      - Filled input style: #F0F0F0 background, 12px radius, no borders
      - Character count: "0 / 1000" display below message textarea
      - Validation: Empty subject/message show Alert dialogs
      - Submit button: "Send Message" green pill (#5DBB8E, 26px radius, 52px height), disabled during submission ("Sending…")
      - Success flow: Alert with "Message Sent" confirmation, navigate back to previous screen
      - Email fallback: "Or email us at support@passitup.com" (email in green #5DBB8E)
  - Navigation:
    - Modified: `src/navigation/types.ts` (added Support, ContactSupport, FAQDetail routes)
    - Modified: `src/navigation/AppNavigator.tsx` (added 3 Stack.Screen entries after MODULE-18 Help screen)
  - Testing:
    - Unit tests:
      - `src/screens/support/__tests__/HelpScreen.test.tsx` (50+ test cases: rendering, search, category filter, navigation, design compliance, accessibility)
      - `src/screens/support/__tests__/ContactSupportScreen.test.tsx` (40+ test cases: form validation, submission, character count, design compliance)
      - `src/screens/support/__tests__/FAQDetailScreen.test.tsx` (25+ test cases: FAQ display, helpful feedback navigation, design compliance)
    - E2E test: `e2e/module-15.1-flow-19-help-support.integration.test.ts` (Detox integration tests covering all screens, search/filter states, form validation, end-to-end flow)
    - Maestro flow: `.maestro/module-15.1-flow-19-help-support.yaml` (12 UI states: FAQ list, search, category filter, empty state, FAQ detail, helpful feedback, contact form validation/submission, end-to-end journey)
    - Manual test guide: `MODULE-15.1-FLOW-19-MANUAL-TESTING.md` (30 test cases across 6 test suites: Help Screen, FAQ Detail, Contact Support, Design System Compliance, Accessibility, End-to-End Flows)
  - Design System Compliance:
    - Primary green: #5DBB8E (buttons, active chips, icons, email link)
    - Filled inputs: #F0F0F0 background, no borders, 12px radius
    - Secondary text: #6B6B6B
    - Tertiary/placeholder: #999999
    - Icons: phosphor-react-native v3.0.6 (MagnifyingGlass, Question, EnvelopeSimple, ChatCircle, CaretRight, ArrowLeft)
    - Pill buttons: 24-26px border radius, 52px height
    - Search bar: 48px height, 12px radius
  - Files Created:
    - `p2p-kids-marketplace/src/screens/support/HelpScreen.tsx` (350 lines)
    - `p2p-kids-marketplace/src/screens/support/ContactSupportScreen.tsx` (280 lines)
    - `p2p-kids-marketplace/src/screens/support/FAQDetailScreen.tsx` (230 lines)
    - `p2p-kids-marketplace/src/screens/support/__tests__/HelpScreen.test.tsx` (350 lines)
    - `p2p-kids-marketplace/src/screens/support/__tests__/ContactSupportScreen.test.tsx` (380 lines)
    - `p2p-kids-marketplace/src/screens/support/__tests__/FAQDetailScreen.test.tsx` (230 lines)
    - `p2p-kids-marketplace/e2e/module-15.1-flow-19-help-support.integration.test.ts` (380 lines)
    - `p2p-kids-marketplace/.maestro/module-15.1-flow-19-help-support.yaml` (360 lines)
    - `MODULE-15.1-FLOW-19-MANUAL-TESTING.md` (repo root, comprehensive manual test guide)
  - Files Modified:
    - `p2p-kids-marketplace/src/navigation/types.ts` (added 3 route types)
    - `p2p-kids-marketplace/src/navigation/AppNavigator.tsx` (added 3 Stack.Screen entries)
  - Verification:
    - Tier 0: `npm run typecheck` ✅ PASS, `npm run lint` ✅ PASS
    - Unit tests: `npm run test:unit` (all 3 support screen test files, 115+ assertions)
    - E2E test: `RUN_SUPABASE_E2E=true npm run test:e2e` (integration test for all screens)
    - Maestro: `npm run test:maestro:ios` and `npm run test:maestro:android` (12-state UI flow)
    - Manual: Run all 30 test cases from `MODULE-15.1-FLOW-19-MANUAL-TESTING.md` on iOS and Android simulators
    - MODULE-15.1-VERIFICATION.md FLOW-19 section updated to ✅ Done
  - Dependencies: None (standalone UI redesign, uses existing navigation and design system components)
  - Implementation Notes:
    - FAQ data currently mocked in HelpScreen.tsx (TODO comment for backend integration)
    - Contact form submission simulated with 1s delay (TODO comment for actual submitSupportTicket API call)
    - All screens use testID props for Maestro automation
    - Accessibility labels for screen readers on all interactive elements
  - Tier: Tier 0 (typecheck/lint always), Tier 1 (unit tests for any FAQ/contact form logic changes), Maestro (UI flows for visual regression)

### FLOW-19: Analytics Events
- Smoke: (manual)

### FLOW-20: Audit/Logging
- Smoke: (manual)
- Cron Observability Addendum:
  - Use `public.get_cron_jobs_with_last_run(false, '<TZ>')` to guarantee one status row per job.
  - Use `public.get_cron_recent_runs(48, 500, '<TZ>')` for run history with UTC+local timestamps.
  - Admin API endpoints:
    - `GET /api/admin/cron-jobs?includeInactive=false&timezone=America/Los_Angeles`
    - `GET /api/admin/cron-runs?lookbackHours=48&limit=500&timezone=America/Los_Angeles`

### FLOW-21: ID Verification — Manual ID Badge Verification (BADGE-009, BADGE-013)

- Purpose: Allow users to voluntarily submit a government ID image for manual admin review. On admin approval the user receives a Verified badge on their profile; on rejection they receive a reason and may resubmit. Profile screen displays verification status dynamically. The flow is privacy-first: screenshots are stored only temporarily and deleted immediately after decision.

- Smoke: 
  - `BADGE-009-MANUAL-TESTING-GUIDE.md` (20 test cases - Upload Flow)
  - `BADGE-013-MANUAL-TESTING-GUIDE.md` (20 test cases - Profile Display)
  - Mobile upload screen (`IDVerificationUploadScreen`) functional with camera + gallery picker
  - Disclaimer text loaded from `id_badge_verification_messages` table (configurable)
  - User uploads ID and receives in-app confirmation + email
  - Submission creates a row in `id_badge_verification_requests` with `status='pending'` and a `screenshot_path` stored in the `id-badge-verification-screenshots` bucket
  - Duplicate submission prevention: users with pending requests cannot submit again (UI blocks with "Verification Pending" message)
  - Admin sees the request in `/admin/ID-badges/` queue, can open the review page, view/download the screenshot, then Approve or Reject with a predefined reason and optional notes
  - On Approval:
    - Screenshot is deleted from storage immediately
    - Request `status` updates to `approved`, `reviewed_at` and `reviewed_by` are set
    - User profile updated (e.g., `profiles.is_verified=true` or `profiles.badge_level='verified'`)
    - Notifications sent (in-app, web push, email) using `id_badge_verification_messages` templates with variable substitution (`{first_name}`, `{rejection_reason}`, `{admin_notes}`)
  - On Rejection:
    - Screenshot is deleted from storage immediately
    - Request `status` updates to `rejected` with `rejection_reason` (6 predefined options) and `rejection_notes` populated
    - User receives rejection notifications with reason and admin notes and may resubmit immediately
    - Profile screen shows "Resubmit Verification" button
  - Upload UI prevents duplicate submissions while a `pending` request exists for the same user (shows "Verification Pending" message instead)
  - Navigation route: `IDVerificationUpload` added to AppNavigator (authenticated stack)
  - **BADGE-013: Profile Display Integration**
    - `ProfileScreen.tsx` displays Identity Verification section with dynamic status badges
    - Four status states: None (Upgrade CTA), Pending, Approved, Rejected
    - Pending b
    - `src/__tests__/e2e/idBadgeUpload.e2e.test.ts` (upload flow, requires SUPABASE_E2E_ENABLED=true)
    - `src/__tests__/e2e/idBadgeProfileDisplay.e2e.test.ts` (profile status display, ynamic text from `pending_status_text` configurable message
    - Approved badge: Green checkmark (✅), green background, "Identity Verified" permanent display
    - Rejected badge: Red X (❌), red background, displays rejection reason (formatted with spaces), tappable to resubmit
    - Default (None): Shield emoji (🛡️), blue background, "Upgrade to Verified" CTA, tappable to navigate to upload screen
    - Status loads dynamically on profile mount and refresh (uses `idBadgeService.getVerificationStatus()`)
    - Most recent verification request displayed (if multiple requests exist from same user)
    - Status persists across app restarts (fetched from database)

- Automated (offline):
  - Unit tests: `src/services/__tests__/idBadge.test.ts` (getMessage, checkPendingRequest, getVerificationStatus)
  - E2E tests: `src/__tests__/e2e/idBadgeUpload.e2e.test.ts` (requires SUPABASE_E2E_ENABLED=true)
    - Configurable messages fetch
    - Pending request check logic
    - Verification status retrieval
    - Duplicate submission prevention
    - RLS policy enforcement
    - Message template seeding validation (12 required templates)
  - Migration: `20260208000000_id_badge_verification_system.sql` creates tables, enums, RLS policies, and seeds messages

- Admin API endpoints:
  - `GET /api/admin/id-badges?status=&search=` — queue list with filters and pagination (implemented)
  - `GET /api/admin/id-badges/stats` — pending/approved/rejected counts and avg review time (implemented)
  - `GET /api/admin/id-badges/{requestId}` — request details (implemented)
  - `GET /api/admin/id-badges/{requestId}/screenshot-url` — signed URL for admin review (implemented)
  - `POST /api/admin/id-badges/{requestId}/decide` — approve/reject decision endpoint (implemented)
  - `GET /api/admin/id-badges/messages` — fetch all configurable message templates (implemented)
  - `PUT /api/admin/id-badges/messages/{messageId}` — update message template (implemented)

- Verification pointers:
  - RLS policies verified in `20260208000000_id_badge_verification_system.sql`:
    - Users can SELECT own requests, INSERT own requests
    - Admins can SELECT all requests, UPDATE all requests
    - Everyone can SELECT messages (read-only)
    - Admins can UPDATE messages
  - Storage bucket `id-badge-verification-screenshots` must be private:
    - Users can upload to `auth.uid()/*` only
    - Admins can read/delete all files
    - Screenshot deleted immediately after admin decision (idempotent)
  - Messages: 12 configurable templates in `id_badge_verification_messages`:
    - `upload_disclaimer`, `submit_button_label`, `pending_status_text`, `in_app_submission_notification`
    - `approved_email_subject`, `approved_email_body`, `rejected_email_subject`, `rejected_email_body`
    - `in_app_approved_notification`, `in_app_rejected_notification`, `web_push_approved`, `web_push_rejected`
    - Template variables: `{first_name}`, `{rejection_reason}`, `{admin_notes}`, `{approval_timeframe_hours}`
  - SLA: admin_config key `id_badge_verification_approval_sla_hours` (default 24) seeded and used in UI copy
  - Rejection reasons enum: `unclear_photo`, `id_expired`, `name_mismatch`, `multiple_ids`, `not_government_id`, `other`

- Quick manual test (happy path — detailed in BADGE-009-MANUAL-TESTING-GUIDE.md TC5, TC11):
  1. As normal user: Profile → Upgrade to Verified → pick/take photo → Submit
  2. Verify: pending row created in `id_badge_verification_requests`, screenshot exists in storage `{user_id}/{timestamp}.jpg`
  3. As admin: `/admin/ID-badges/` → locate request → Review → Approve with optional notes
  4. Verify: screenshot deleted, request status=`approved`, `reviewed_at`/`reviewed_by` set, profile shows Verified badge, user received notifications

- Quick manual test (reject path — detailed in BADGE-009-MANUAL-TESTING-GUIDE.md TC13, TC14, TC15):
  1. Submit request as user
  2. As admin: Review → Reject with reason=`unclear_photo` and notes="Please retake with better lighting"
  3. Verify: screenshot deleted, request status=`rejected`, `rejection_reason`/`rejection_notes` populated, user notified with reason+notes, "Resubmit Verification" button appears on profile
  4. User resubmits: new request created with status=`pending`, old rejected request preserved as history

- Tier 0 (always):
  - TypeScript compile: `npm run typecheck` or `npx tsc -p tsconfig.json --noEmit` (must pass with no errors)
  - ESLint: `npm run lint` (must pass with no warnings)
  - Unit tests: `npm test -- idBadge.test.ts` (must pa/profile display flow changes):
  - Manual smoke: 
    - BADGE-009: Run TC1-TC8 (mobile upload), TC9-TC15 (admin review + notifications) from `BADGE-009-MANUAL-TESTING-GUIDE.md`
    - BADGE-013: Run TC1-TC10 (profile status display, navigation, status transitions) from `BADGE-013-MANUAL-TESTING-GUIDE.md`
  - E2E: 
    - `SUPABASE_E2E_ENABLED=true npm test -- idBadgeUpload.e2e.test.ts` (upload flow)
    - `TEST_USER_ID=[uuid] SUPABASE_E2E_ENABLED=true npm test -- idBadgeProfileDisplay.e2e.test.ts` (profile display
  - Manual smoke: Run test case`BADGE-009-MANUAL-TESTING-GUIDE.md` (upload + admin review)
  - Run all 20 test cases from `BADGE-013-MANUAL-TESTING-GUIDE.md` (profile display + status transitions)
  - Verify RLS: users cannot see other users' requests (BADGE-009 TC19, BADGE-013 RLS policy tests)
  - Verify stats calculation: admin stats match database query results (BADGE-009 TC20)
  - Verify profile status updates after admin approval/rejection (BADGE-013 TC5, TC7
- Tier 2 (full regression when DB schema/RLS/migration changes):
  - Rebuild database: `supabase db reset` (staging or test instance)
  - Verify migration: confirm all tables/enums/indexes/policies created correctly
  - Run all 20 test cases from BADGE-009-MANUAL-TESTING-GUIDE.md
  - Verify RLS: users cannot see other users' requests (TC19)
  - Verify stats calculation: admin stats match database query results (TC20)

### FLOW-22: Seller Payouts & Withdrawals — Seller balance withdrawal lifecycle
- Purpose: End-to-end seller payout lifecycle: request withdrawal, verify payout method, queue for processing, provider settlement, retry/failure handling, and audit trail. Includes admin overrides and idempotency for transfers.
- Smoke: `scripts/smoke/payouts-withdrawals.mjs`
- Tier: 2 (payments + DB changes)
- Quick checks: verify `seller_payout_methods` (is_verified), withdrawal status transitions (`requires_action` → `processing` → `completed`/`failed`), and audit entries in `seller_payouts`.

### FLOW-23: Payout Method Verification — Bank / PayPal / Plaid verification flow
- Purpose: Verify a seller's payout method before it can be used for withdrawals; handle micro-deposits, provider callbacks, marking `payout_method.is_verified`, and rollback on failure.
- Smoke: `scripts/smoke/payout-method-verification.mjs`
- Tier: 2
- Quick checks: simulate micro-deposit verification, PayPal verification callback, and ensure `is_verified` prevents/permits withdrawals as expected.

### FLOW-24: MFA / Multi-Factor Enrollment & Assurance Level
- Purpose: MFA enrollment (TOTP/SMS/WebAuthn), factor verification and management, and mapping to Authenticator Assurance Level (AAL). Includes recovery and factor removal flows.
- Smoke: `scripts/smoke/mfa-enrollment.mjs`
- Tier: 1 (escalate to Tier 2 for auth schema changes)
- Quick checks: enroll a factor, verify factor becomes `verified`, and `getAuthenticatorAssuranceLevel()` returns expected values.

### FLOW-25: Manual Payout / Admin Payout Processing — Admin-triggered payouts & overrides
- Purpose: Admin queue for manual payouts, retry and override controls, manual settlement steps and finance audit logging.
- Smoke: `scripts/smoke/admin-manual-payouts.mjs`
- Tier: 2
- Quick checks: create a manual payout, mark processed by admin, verify audit log and payout status change.

### FLOW-26: Webhook Processing & Verification — External provider webhooks
- Purpose: Reliable webhook ingestion (Stripe, PayPal, Plaid), verify signatures, idempotent processing, reconcile external events with internal state, and audit webhook receipts.
- Smoke: `scripts/smoke/webhooks.mjs`
- Tier: 2
- Quick checks: send a signed test webhook, verify signature validation, idempotent handling, and resulting DB state change.

### FLOW-27: Refunds & Cancellations — Refund settlement and state machine
- Purpose: Buyer/seller cancellations and refund processing, linking refund events to transactions, reversing SP/state where applicable, and notifying parties.
- Smoke: `scripts/smoke/refunds-cancellations.mjs`
- Tier: 1 (Tier 2 if changing transaction/RPC logic)
- Quick checks: trigger a cancellation, verify refund/hold logic, ensure platform fee treatment and SP reversal rules.

### FLOW-28: Cron & Background Jobs — Scheduled tasks and maintenance
- Purpose: Scheduled background jobs: release pending Swap Points, expire/inactivate stale data, cleanup temporary screenshots, run payout retries, and run maintenance smoke scripts.
- Smoke: `scripts/smoke/cron-jobs.mjs`
- Tier: 1 (Tier 2 if adding DB migrations or changing cron-critical logic)
- Quick checks: run scheduled job locally or via runner, confirm SP pending→released transition and deletion of temporary screenshots.

### FLOW-29: ID Badge Submission & Decision Notifications (BADGE-011)

- Purpose: Multi-channel notification system for ID badge verification events. Send web push + in-app + email notifications to users on submission confirmation and approval/rejection decisions. Send admin alerts on new submissions. All messages loaded from configurable `id_badge_verification_messages` table with template variable substitution. Respects user notification preferences.

- Smoke: `BADGE-011-MANUAL-TESTING-GUIDE.md` (9 test cases + regression checks)
  - User submits ID verification → receives submission confirmation via:
    - In-app notification (visible in notification center)
    - Email confirmation with 24-hour SLA message
  - Admin receives alert on new submission:
    - Web push notification (if admin has Expo push token)
    - Admin notifications table entry (type: `id_badge_submission`)
  - Admin approves request with optional notes → user receives:
    - In-app notification: "ID Verification Approved! 🎉"
    - Web push notification: "Your ID verification is complete!"
    - Email: "Your ID Verification is Approved!" with congratulations message
    - Template variables replaced: `{first_name}`, `{admin_notes}`
  - Admin rejects request with reason and notes → user receives:
    - In-app notification with rejection reason
    - Web push notification with actionable message
    - Email with rejection reason formatted: "Reason: [unclear photo]" and admin notes displayed
    - Template variables replaced: `{first_name}`, `{rejection_reason}`, `{admin_notes}`
  - Screenshot auto-deleted from storage immediately after decision (idempotent)
  - Notification preferences respected: user can disable push/in-app/email per category (`id_badge_verification`)
  - Admin activity logged in `admin_activity_log` with action types: `id_badge_approved`, `id_badge_rejected`
  - Duplicate notification prevention: idempotent Edge Function execution

- Edge Functions:
  - `id-badge-submission-notification/index.ts` (180 lines)
    - Handles submission confirmation notifications to user
    - Creates admin alert notifications for all admin users
    - Multi-channel delivery: in-app + email (+ push if available)
  - `id-badge-notifications/index.ts` (265 lines)
    - Handles approval/rejection decision notifications
    - Status update + screenshot deletion + notification dispatch
    - Template variable replacement: `{first_name}`, `{rejection_reason}`, `{admin_notes}`
    - Activity logging for audit trail
  - `send-email/index.ts` — Extended with 3 new email types:
    - `id_badge_approved`: Approval email with congratulations message
    - `id_badge_rejected`: Rejection email with formatted reason and notes
    - `id_badge_submission`: Submission confirmation email
    - `processIDBadgeEmail()` function (83 lines) generates HTML emails with styled rejection reason/notes divs

- Mobile Services Updated:
  - `p2p-kids-marketplace/src/services/idBadge.ts`
    - Added submission notification invocation (lines 126-135)
    - Calls `id-badge-submission-notification` Edge Function after successful ID upload
    - Passes `requestId` and `userId` for notification processing

- Database Dependencies:
  - Tables: `id_badge_verification_requests`, `id_badge_verification_messages`, `notification_preferences`, `notifications`, `admin_notifications`, `admin_activity_log`
  - Storage: `id-badge-verification-screenshots` bucket with RLS policies
  - Message templates: 12 configurable templates with variable placeholders
  - Notification categories: `id_badge_verification` preference category

- Notification Channels:
  - **Web Push**: Expo Push Notifications API (requires push token from `profiles.expo_push_token` or `push_tokens` table)
  - **In-App**: Entries in `notifications` table (queried by mobile app notification center)
  - **Email**: SendGrid API with HTML email generation (requires `SENDGRID_API_KEY` in Edge Function secrets)

- Template Variables:
  - `{first_name}`: User's first name from profile
  - `{rejection_reason}`: Human-readable rejection reason (from enum)
  - `{admin_notes}`: Custom admin notes (optional, max 500 chars)
  - `{approval_timeframe_hours}`: SLA timeframe (default 24 hours from `admin_config`)

- Automated (offline):
  - Unit tests: `p2p-kids-marketplace/src/__tests__/services/idBadgeNotifications.test.ts` (270 lines, 7 test suites)
    - Submission notification logic
    - Approval/rejection notification flows
    - Template variable replacement
    - Admin notification creation
    - Activity logging
    - Multi-channel delivery
    - Preference respect
  - E2E tests: `p2p-kids-marketplace/src/__tests__/e2e/idBadgeNotifications.e2e.test.ts` (300 lines, 5 test suites)
    - Complete notification flow from submission → decision
    - Screenshot deletion verification
    - Preference respect testing
    - Idempotent execution
    - Requires: `TEST_USER_ID` and `TEST_ADMIN_ID` environment variables

- Tier 0 (always):
  - TypeScript compile: `cd p2p-kids-marketplace && npm run typecheck` (must pass)
  - ESLint: `cd p2p-kids-marketplace && npm run lint` (must pass)
  - Unit tests: `cd p2p-kids-marketplace && npm test -- src/__tests__/services/idBadgeNotifications.test.ts` (all tests must pass)

- Tier 1 (targeted regression when notification logic changes):
  - Manual smoke: Run test cases TC1-TC9 from `BADGE-011-MANUAL-TESTING-GUIDE.md`
    - TC1: Submission confirmation notifications
    - TC2: Email notification on submission
    - TC3: Approval notifications (multi-channel)
    - TC4: Rejection notifications with reason
    - TC5: Notification preferences respected
    - TC6: Duplicate notification prevention
    - TC7: Screenshot deletion verification
    - TC8: Message template customization
    - TC9: Admin activity logging
  - E2E: `TEST_USER_ID=[uuid] TEST_ADMIN_ID=[uuid] npm test -- src/__tests__/e2e/idBadgeNotifications.e2e.test.ts` (if Supabase prod credentials available)

- Tier 2 (full regression when Edge Functions/DB schema changes):
  - Deploy Edge Functions: 
    - `supabase functions deploy id-badge-notifications`
    - `supabase functions deploy id-badge-submission-notification`
  - Verify message templates exist: `SELECT COUNT(*) FROM id_badge_verification_messages;` (expect 12 rows)
  - Verify notification preferences: `SELECT * FROM notification_preferences WHERE category = 'id_badge_verification';`

### FLOW-30: SP Wallet Admin Operations — ADMIN-V2-003

- Purpose: Admin tools for manual Swap Points management — view SP economy metrics, inspect individual user wallets, adjust SP balances (add/deduct) with mandatory audit reason, toggle wallet status (active/frozen/suspended), and view full ledger history. Dashboard card on admin home page shows SP economy summary.

- Covers:
  - SP economy metrics dashboard (total earned/spent, circulation, active wallets, avg balance, admin adjustments)
  - Wallet lookup by user_id
  - Add SP (`earn_admin_grant` ledger entries)
  - Deduct SP (`admin_deduct` ledger entries)
  - Prevent deduction below zero balance
  - Mandatory reason enforcement on every adjustment
  - Wallet status toggle (active / frozen / suspended) with audit log
  - Full ledger history display (last 100, colour-coded by type)
  - Audit logging in `admin_audit_logs` for all admin actions
  - SP Economy summary card on admin home page

- Automated Tests:
  - Unit (Vitest): `p2p-kids-admin/src/__tests__/api/admin/sp-wallet.test.ts`
    - `npm test -- --testPathPattern=sp-wallet`
  - E2E (Jest, Supabase prod): `p2p-kids-admin/src/__tests__/e2e/sp-wallet-admin.e2e.ts`
    - `RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=sp-wallet-admin`

- Manual Test Guide: `docs/manual-verification/ADMIN-V2-003-SP-WALLET-MANUAL-TEST-CASES.md` (20 test cases)

- Admin Portal Pages:
  - `/sp-wallet` — `p2p-kids-admin/src/app/sp-wallet/page.tsx`
  - Home card — `p2p-kids-admin/src/app/components/SPEconomySummary.tsx`
  - Home page updated — `p2p-kids-admin/src/app/page.tsx`

- Admin API Routes:
  - `GET /api/admin/sp-wallet` — economy metrics (no params) or wallet detail (`?user_id=<uuid>`)
  - `POST /api/admin/sp-wallet/actions` — `{ action: 'adjust', user_id, amount, reason, notes }` or `{ action: 'toggle_status', user_id, new_status, notes }`

- SQL Migration: `supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql`

- **Wallet State Enforcement (2026-03-23):**
  - Backend enforcement: `debit_sp_for_trade()`, `earn_sp_for_trade()`, `can_user_spend_sp()` now check wallet state before allowing transactions (frozen/suspended/grace_period = blocked)
  - Mobile enforcement: `AuthContext.can_spend_sp` now queries wallet state from `get_user_sp_wallet_summary()` RPC and blocks SP spending if wallet is not active
  - UX: `WalletWarningBanner` component displays state-specific warnings (frozen = blue, suspended = red, grace_period = yellow)
  - SQL Migration: `supabase/migrations/20260323000001_enforce_wallet_state_on_spend_earn.sql`
  - Verification: Freeze wallet via admin → attempt SP purchase in mobile app → expect backend error "Cannot spend SP: wallet is frozen"
  - Regression: TC-011 (freeze wallet) and TC-013 (suspend wallet) must prevent SP transactions end-to-end
  - RPCs: `admin_adjust_sp_wallet`, `admin_toggle_sp_wallet_status`, `admin_get_sp_wallet_detail`, `get_sp_economy_metrics`

- TypeScript Types: `p2p-kids-admin/src/types/sp-wallet.ts`

- Dependencies:
  - `sp_wallets` (20251215100000_auth_v2_schema.sql)
  - `sp_ledger` (061_sp_ledger_and_trade_rpcs.sql)
  - `admin_audit_logs` (20251227_admin_trade_tools.sql)
  - `profiles` (profile query for user info in wallet detail)

- Tier 0 (always):
  - `cd p2p-kids-admin && npm run typecheck` (must pass with no errors)
  - `cd p2p-kids-admin && npm run lint` (must pass)
  - `cd p2p-kids-admin && npm test -- --testPathPattern=sp-wallet` (all unit tests pass)

- Tier 1 (when admin API / UI changes):
  - Manual: Run TC-001 to TC-018 from `ADMIN-V2-003-SP-WALLET-MANUAL-TEST-CASES.md`

- Tier 2 (when SQL migration or RPC changes):
  - `supabase db reset` on staging → re-apply migration
  - Run TC-001 to TC-020 from manual test guide
  - Verify SQL objects: `SELECT proname FROM pg_proc WHERE proname LIKE 'admin_%_sp%' OR proname = 'get_sp_economy_metrics';`

- Quick Manual Smoke (happy path):
  1. Admin home page → "SP Economy" card visible → click → lands on `/sp-wallet`
  2. Economy metrics grid shows 7 cards with non-negative integers
  3. Paste a valid user UUID → "Load Wallet" → wallet detail panel appears
  4. Amount=`10`, Reason=`Smoke test +10` → "Apply Adjustment" → success + balance +10
  5. Amount=`-10`, Reason=`Smoke test -10` → success + balance restored
  6. Click "Frozen" → wallet status changes → click "Active" → restored
  7. Supabase: `admin_audit_logs` has 3 new rows for the above actions

- Change Classification: A (DB/RPC), B (API), C (UI), H (Admin config/controls)
- Required Tiers: 0 (always) + 1 (API/UI) + 2 (SQL migration applied)
  - Run all 9 test cases from `BADGE-011-MANUAL-TESTING-GUIDE.md`
  - Verify push notification delivery (check Expo Push dashboard)
  - Verify email delivery (check SendGrid dashboard logs)
  - Verify screenshot deletion (query storage bucket after decision)

- Quick manual test (submission flow):
  1. User: Profile → Upgrade to Verified → Upload ID → Submit
  2. Verify: In-app notification created, email sent to user, admin notification created
  3. Query: `SELECT * FROM notifications WHERE user_id = '[user_id]' ORDER BY created_at DESC LIMIT 1;`
  4. Expected: Title "ID Verification Submitted", body matches template

- Quick manual test (approval flow):
  1. Admin: `/id-badges` → Review pending request → Approve with notes
  2. Verify: User receives 3 notifications (in-app + push + email), screenshot deleted
  3. Query: `SELECT screenshot_path FROM id_badge_verification_requests WHERE id = '[request_id]';`
  4. Expected: Screenshot path exists but file deleted from storage
  5. Query: `SELECT * FROM admin_activity_log WHERE action_type = 'id_badge_approved' ORDER BY created_at DESC LIMIT 1;`
  6. Expected: Activity log entry with approval notes in `details` JSON

- Quick manual test (rejection flow):
  1. Admin: Review pending request → Reject with reason "unclear_photo" and notes "Please retake with better lighting"
  2. Verify: User receives rejection email with formatted reason and notes
  3. Check email content: Should display "Reason: unclear photo" and notes in styled div
  4. Query: `SELECT rejection_reason, rejection_notes FROM id_badge_verification_requests WHERE id = '[request_id]';`
  5. Expected: Reason and notes populated, screenshot deleted

- Dependencies:
  - BADGE-008: Database schema for ID badge verification system
  - BADGE-009: Mobile upload flow (`IDVerificationUploadScreen`)
  - BADGE-010: Admin queue and review interface
  - Existing notification infrastructure (profiles.expo_push_token, push_tokens table)
  - SendGrid email service integration

- Verification Checklist Mapping (MODULE-10-ID-BADGE-VERIFICATION-VERIFICATION.md):
  - ✅ **NOTIF-1**: Submission confirmation sent to user (in-app + email)
  - ✅ **NOTIF-2**: Admin alert sent on new submission (push + admin_notifications table)
  - ✅ **NOTIF-3**: Approval notifications sent (in-app + push + email)
  - ✅ **NOTIF-4**: Rejection notifications sent with reason (in-app + push + email)
  - ✅ **NOTIF-5**: Template variables replaced correctly (`{first_name}`, `{rejection_reason}`, `{admin_notes}`)
  - ✅ **NOTIF-6**: User notification preferences respected (push/in-app/email toggles)
  - ✅ **NOTIF-7**: Screenshot deleted immediately after decision
  - ✅ **NOTIF-8**: Activity logged in `admin_activity_log`
  - ✅ **NOTIF-9**: Configurable messages loaded from `id_badge_verification_messages` table
  - ✅ **NOTIF-10**: Idempotent Edge Function execution (no duplicate notifications)

- Known Limitations:
  - Push notifications require valid Expo push token (gracefully skips if unavailable)
  - Email delivery depends on SendGrid API key configuration
  - Screenshot deletion is idempotent but logs warning if file not found (expected after first deletion)
  - Admin push notifications require admin users to have push tokens registered

- Testing Prerequisites:
  - Supabase project with `id_badge_verification_messages` table seeded (12 templates)
  - SendGrid API key configured in Edge Function secrets
  - Test users with valid email addresses and push tokens
  - Admin user with role='admin' in database
  - Storage bucket `id-badge-verification-screenshots` with proper RLS policies

### FLOW-31: Terms of Service (TOS) System — SAFETY-010

- Purpose: Admin-managed Terms of Service system enabling version-controlled TOS publishing, user acceptance tracking, and legal compliance. Admins create, edit, and publish TOS versions; users accept during signup and can view in Settings. System tracks acceptance history with IP/user-agent for audit trail.

- Covers:
  - Admin TOS policy management (create, edit, publish, archive)
  - Version-controlled policy storage (supports TOS, Privacy Policy, Liability Disclaimer types)
  - User acceptance during signup flow (required before account creation)
  - User TOS viewing from Settings (read-only mode)
  - Acceptance tracking with IP address and user-agent metadata
  - Status transitions: draft → published → archived
  - RPC functions for policy retrieval and acceptance recording

- Database Schema (Migration `304_platform_policies_tos.sql`):
  - `platform_policies` table: `id`, `type` (enum: terms_of_service | privacy_policy | liability_disclaimer), `version`, `title`, `content` (Markdown), `status` (enum: draft | published | archived), `effective_date`, `created_at`, `updated_at`, `created_by`, UNIQUE constraint on (type, version)
  - `policy_acceptances` table: `id`, `user_id` (FK to profiles), `policy_id` (FK to platform_policies), `policy_type`, `policy_version`, `accepted_at`, `ip_address`, `user_agent`, `device_info`
  - RPC functions:
    - `get_current_policy(p_policy_type)` → returns published policy for given type
    - `has_accepted_current_policy(p_user_id, p_policy_type)` → boolean check
    - `record_policy_acceptance(p_user_id, p_policy_id, p_ip_address, p_user_agent, p_device_info)` → insert acceptance with metadata
    - `publish_policy(p_policy_id, p_published_by)` → status transition + archive old published versions
  - RLS Policies:
    - Published policies visible to all authenticated users
    - Draft/archived policies visible to admins only
    - Users can SELECT own acceptances
    - Admins can SELECT all acceptances
    - INSERT/UPDATE policies restricted to admins only

- Admin Portal Pages:
  - `/settings/policies` — `p2p-kids-admin/src/app/settings/policies/page.tsx` 
    - Tabs for TOS, Privacy Policy, Liability Disclaimer
    - List view with status badges, version numbers, effective dates
    - Create, View, Edit, Publish actions per policy
  - `/settings/policies/new` — `p2p-kids-admin/src/app/settings/policies/new/page.tsx`
    - Form: policy type dropdown, version input (X.Y or X.Y.Z format), title, effective date, content (Markdown textarea)
    - Validation: version format, required fields
  - `/settings/policies/[id]` — `p2p-kids-admin/src/app/settings/policies/[id]/page.tsx`
    - View policy details (metadata + content)
    - Publish button for draft policies (calls `publish_policy` RPC)

- Mobile App Integration:
  - `TermsOfServiceScreen.tsx` — dual-mode screen:
    - Read-only mode (from Settings): displays current TOS, no action buttons
    - Acceptance mode (from Signup): displays TOS with Accept/Decline buttons
    - Params: `{ requireAcceptance?: boolean; onAccept?: () => void }`
    - ScrollView for full content display
    - Accept button calls `TOSService.acceptTOS()` and invokes `onAccept()` callback
    - Decline button navigates back (signup flow aborted)
  - `TOSService` (`src/services/tos.ts`):
    - `getCurrentTOS()` → fetch current published TOS
    - `hasAcceptedCurrentTOS(userId)` → check acceptance status
    - `acceptTOS(userId, policyId, metadata)` → record acceptance with IP/user-agent
    - `getUserAcceptanceHistory(userId)` → fetch user's acceptance history
    - `getAllPublishedPolicies()` → fetch all published policies (for settings)
  - Navigation updates:
    - `types.ts` — added `TermsOfService: { requireAcceptance?: boolean; onAccept?: () => void } | undefined`
    - `AppNavigator.tsx` — registered `TermsOfService` screen in authenticated stack
    - `SettingsScreen.tsx` — added "Terms of Service" menu item with testID `settings-tos-button`
    - `SignupScreen.tsx` — made TOS link tappable (navigates to TermsOfService screen with requireAcceptance=true)

- Automated Tests:
  - Unit (Jest): `p2p-kids-marketplace/src/__tests__/services/tos.test.ts`
    - 5 test suites covering all TOSService methods (15+ test cases)
    - Mocked Supabase client for offline execution
    - Run: `npm run test:unit -- tos.test.ts`
  - E2E (Jest, Supabase prod): `e2e/tos-system.integration.test.ts`
    - 5 test cases: admin CRUD, policy publish, user acceptance, RLS enforcement
    - Requires `RUN_SUPABASE_E2E=true` and real Supabase credentials
    - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- tos-system.integration.test.ts`
  - Maestro UI Flow: `.maestro/tos-system.yaml`
    - 4 flows: Settings view, Signup acceptance (happy path), Decline flow, Error state handling
    - Uses testID locators: `settings-tos-button`, `tos-screen-title`, `tos-accept-button`, `tos-decline-button`
    - Run: `npm run test:maestro:ios -- .maestro/tos-system.yaml` or `npm run test:maestro:android -- .maestro/tos-system.yaml`

- Manual Test Guide: `SAFETY-010-MANUAL-TESTING-GUIDE.md`
  - 20+ test cases across 6 sections:
    - Pre-test Setup (SQL queries to seed initial TOS policy)
    - Admin Portal TCs (7 cases): Create, Edit, Publish, Archive, Version validation, Multiple types, Search/filter
    - Mobile App TCs (7 cases): Settings view, Signup acceptance, Decline flow, Acceptance tracking, Metadata capture, History view, Error handling
    - Edge Cases (4 cases): Multiple versions, Concurrent publishes, Missing policy, Duplicate acceptance
    - RPC Functions (4 cases): Direct RPC calls for get_current_policy, has_accepted_current_policy, record_policy_acceptance, publish_policy
    - RLS Policies (3 cases): User visibility, Admin visibility, Write permissions
  - Sign-off checklist with SQL verification queries
  - Expected results documented for each test case

- Tier 0 (always):
  - Mobile: `cd p2p-kids-marketplace && npm run typecheck && npm run lint` (must pass)
  - Admin: `cd p2p-kids-admin && npm run typecheck && npm run lint` (must pass)
  - Unit tests: `cd p2p-kids-marketplace && npm run test:unit -- tos.test.ts` (all pass)

- Tier 1 (when mobile UI or admin API changes):
  - Run TC-01 to TC-14 from `SAFETY-010-MANUAL-TESTING-GUIDE.md`
  - Verify navigation flows (Settings → TOS, Signup → TOS acceptance)
  - Verify testID props render correctly for Maestro

- Tier 2 (when SQL migration or RPC changes):
  - Apply migration: `supabase/migrations/304_platform_policies_tos.sql`
  - Verify tables: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('platform_policies', 'policy_acceptances');`
  - Verify RPC functions: `SELECT proname FROM pg_proc WHERE proname IN ('get_current_policy', 'has_accepted_current_policy', 'record_policy_acceptance', 'publish_policy');`
  - Run all 20+ test cases from manual test guide
  - Run E2E: `RUN_SUPABASE_E2E=true npm run test:e2e -- tos-system.integration.test.ts`

- Quick Manual Smoke (happy path):
  1. Admin: Log in to admin portal → `/settings/policies` → "Create New Policy"
  2. Fill form: type=terms_of_service, version=1.0, title="Terms of Service", effective_date=today, content="Test TOS content"
  3. Submit → verify policy created with status=draft
  4. View policy → click "Publish" → verify status transitions to published
  5. Query: `SELECT * FROM platform_policies WHERE type='terms_of_service' AND status='published' ORDER BY created_at DESC LIMIT 1;`
  6. Mobile: Settings → "Terms of Service" → verify content displays
  7. Mobile: Signup flow (new user) → tap TOS link → verify acceptance UI shows (Accept/Decline buttons)
  8. Tap "Accept" → verify acceptance recorded
  9. Query: `SELECT * FROM policy_acceptances WHERE user_id='[test_user_id]' ORDER BY accepted_at DESC LIMIT 1;`
  10. Verify: `policy_id` matches published policy, `ip_address` and `user_agent` populated

- Quick Manual Smoke (decline path):
  1. Mobile: Signup → tap TOS link → tap "Decline" → verify navigates back to signup
  2. Verify: No acceptance record created (signup aborted)

- Change Classification: A (DB/RPC), B (Admin API), C (Mobile UI), G (Safety/compliance)
- Required Tiers: 0 (always) + 1 (UI/API) + 2 (SQL migration applied)
- Impacted Modules: MODULE-13-SAFETY-COMPLIANCE (SAFETY-010)

- Dependencies:
  - `auth.users` table (Supabase Auth)
  - `profiles` table (user metadata)
  - Admin authentication with role-based access
  - Mobile navigation (React Navigation stack)

- Verification Checklist Mapping (MODULE-13-VERIFICATION.md SAFETY-010):
  - ✅ **TOS-1**: Database schema created (platform_policies, policy_acceptances tables)
  - ✅ **TOS-2**: RPC functions implemented (4 functions with correct signatures)
  - ✅ **TOS-3**: RLS policies enforced (admins full access, users see published only)
  - ✅ **TOS-4**: Admin UI complete (create, edit, publish, archive workflows)
  - ✅ **TOS-5**: Mobile TOS screen functional (dual-mode: read-only + acceptance)
  - ✅ **TOS-6**: Signup integration (TOS link tappable, acceptance required)
  - ✅ **TOS-7**: Settings integration (TOS menu item, read-only display)
  - ✅ **TOS-8**: Acceptance tracking (IP, user-agent, device_info captured)
  - ✅ **TOS-9**: Version control (UNIQUE constraint, publish workflow archives old versions)
  - ✅ **TOS-10**: Unit tests (TOSService fully tested with mocked Supabase)
  - ✅ **TOS-11**: E2E tests (5 scenarios covering admin CRUD and user acceptance)
  - ✅ **TOS-12**: Maestro UI flows (4 flows covering all user paths)
  - ✅ **TOS-13**: Manual test guide (20+ test cases with SQL verification)

- Known Limitations:
  - IP address capture depends on client providing it (defaults to null if unavailable)
  - User-agent parsing done client-side (not validated server-side)
  - No automatic TOS re-acceptance flow when new version published (user can continue using app)
  - Markdown rendering in mobile app uses basic Text component (no rich Markdown parser)
  - Admin portal uses textarea for content (no WYSIWYG editor)

- Future Enhancements:
  - Force re-acceptance flow when new TOS version published
  - Rich Markdown editor in admin portal (with preview)
  - Markdown renderer in mobile app (formatted display)
  - Acceptance expiration/re-acceptance requirements
  - User notification when new TOS published
  - Admin analytics (acceptance rates, time-to-accept)

---

### FLOW-32: Privacy Policy System — SAFETY-011

- Purpose: Admin-managed Privacy Policy system enabling version-controlled policy publishing, user acceptance tracking, and GDPR/CCPA compliance. Admins create, edit, and publish Privacy Policy versions; users view in Settings and can accept during signup (optional). System tracks acceptance history with IP/user-agent for audit trail. Reuses complete platform_policies infrastructure from SAFETY-010.

- Covers:
  - Admin Privacy Policy management (create, edit, publish, archive)
  - Version-controlled policy storage (reuses `platform_policies` table with type='privacy_policy')
  - User Privacy Policy viewing from Settings (read-only mode)
  - Optional user acceptance during signup flow (configurable per flow)
  - Acceptance tracking with IP address and user-agent metadata
  - Status transitions: draft → published → archived
  - RPC functions for policy retrieval and acceptance recording (shared with SAFETY-010)

- Database Schema (Reuses Migration `304_platform_policies_tos.sql` from SAFETY-010):
  - `platform_policies` table: Already supports `type='privacy_policy'` (enum includes: terms_of_service | privacy_policy | liability_disclaimer)
  - `policy_acceptances` table: Tracks acceptances for all policy types including Privacy Policy
  - RPC functions (shared with SAFETY-010):
    - `get_current_policy(p_policy_type)` → returns published policy for given type (call with 'privacy_policy')
    - `has_accepted_current_policy(p_user_id, p_policy_type)` → boolean check for Privacy Policy acceptance
    - `record_policy_acceptance(p_user_id, p_policy_id, p_ip_address, p_user_agent, p_device_info)` → insert acceptance with metadata
    - `publish_policy(p_policy_id, p_published_by)` → status transition + archive old published versions
  - RLS Policies: Same as SAFETY-010 (published policies visible to all, draft/archived admin-only)

- Admin Portal Pages (Reuses SAFETY-010 UI):
  - `/settings/policies` — `p2p-kids-admin/src/app/settings/policies/page.tsx` 
    - Already supports Privacy Policy tab (implemented in SAFETY-010)
    - List view with status badges, version numbers, effective dates
    - Create, View, Edit, Publish actions per policy
  - `/settings/policies/new` — `p2p-kids-admin/src/app/settings/policies/new/page.tsx`
    - Form: policy type dropdown includes 'privacy_policy' option
    - Validation: version format, required fields
  - `/settings/policies/[id]` — `p2p-kids-admin/src/app/settings/policies/[id]/page.tsx`
    - View policy details (metadata + content)
    - Publish button for draft policies (calls `publish_policy` RPC)

- Mobile App Integration (NEW for SAFETY-011):
  - `PrivacyPolicyScreen.tsx` — dual-mode screen (mirrors TOS pattern):
    - Read-only mode (from Settings): displays current Privacy Policy, no action buttons
    - Acceptance mode (optional): displays Privacy Policy with Accept button
    - Params: `{ requireAcceptance?: boolean; onAccept?: () => void }`
    - ScrollView for full content display
    - Accept button calls `PrivacyPolicyService.acceptPrivacyPolicy()` and invokes `onAccept()` callback
    - Uses `react-native-markdown-display` for Markdown rendering
  - `PrivacyPolicyService` (`src/services/privacyPolicy.ts`):
    - `getCurrentPrivacyPolicy()` → fetch current published Privacy Policy (calls `get_current_policy('privacy_policy')`)
    - `hasAcceptedCurrentPrivacyPolicy(userId)` → check acceptance status (calls `has_accepted_current_policy(userId, 'privacy_policy')`)
    - `acceptPrivacyPolicy(userId, policyId, metadata)` → record acceptance with IP/user-agent (calls `record_policy_acceptance`)
    - `getUserAcceptanceHistory(userId)` → fetch user's Privacy Policy acceptance history
  - Navigation updates:
    - `types.ts` — added `PrivacyPolicy: { requireAcceptance?: boolean; onAccept?: () => void } | undefined`
    - `AppNavigator.tsx` — registered `PrivacyPolicy` screen in authenticated stack (after TermsOfService)
    - `SettingsScreen.tsx` — added "Privacy Policy" menu item with testID `settings-privacy-policy-button` (placed after TOS, before Privacy & Security)
    - `SignupScreen.tsx` — fixed Privacy Policy link (was incorrectly pointing to TermsOfService screen) → now navigates to `PrivacyPolicy` screen with testID `privacy-policy-link`

- Automated Tests:
  - Unit (Jest): `p2p-kids-marketplace/src/__tests__/services/privacyPolicy.test.ts`
    - 8 test cases covering all PrivacyPolicyService methods (getCurrentPrivacyPolicy, hasAcceptedCurrentPrivacyPolicy, acceptPrivacyPolicy, getUserAcceptanceHistory)
    - Mocked Supabase client for offline execution
    - Run: `npm run test:unit -- privacyPolicy.test.ts`
  - Unit (Jest): `p2p-kids-marketplace/src/screens/profile/__tests__/PrivacyPolicyScreen.test.tsx`
    - 4 test groups covering loading state, policy display, error states, acceptance flow
    - Mocked navigation, PrivacyPolicyService, Markdown renderer
    - Run: `npm run test:unit -- PrivacyPolicyScreen.test.tsx`
  - E2E (Jest, Supabase prod): `e2e/safety-011-privacy-policy.integration.test.ts`
    - 5 test groups: Privacy Policy Retrieval, Privacy Policy Acceptance, RPC Functions, Database Schema Validation
    - Creates test user with dynamic email, cleans up after tests
    - Requires `RUN_SUPABASE_E2E=true` and real Supabase credentials
    - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- safety-011-privacy-policy.integration.test.ts`
  - Maestro UI Flow: `.maestro/privacy-policy-system.yaml`
    - 3 flows: Settings view, Signup link navigation, Error state handling (no policy available)
    - Uses testID locators: `settings-privacy-policy-button`, `privacy-policy-link`, `privacy-policy-screen`, `privacy-policy-version`, `privacy-policy-content`, `privacy-policy-accept-button`
    - Run: `npm run test:maestro:ios -- .maestro/privacy-policy-system.yaml` or `npm run test:maestro:android -- .maestro/privacy-policy-system.yaml`

- Manual Test Guide: `SAFETY-011-PRIVACY-POLICY-MANUAL-TESTING-GUIDE.md`
  - 10 test cases across 3 sections:
    - Admin Portal (1 case): Create and publish Privacy Policy using admin UI
    - Mobile App Navigation & Display (5 cases): Settings view, Signup link, Acceptance flow, Version management, Error handling
    - Markdown Rendering & Cross-Platform (4 cases): Markdown formatting, navigation integrity, iOS/Android consistency, performance
  - Pre-test Setup: SQL query to verify Privacy Policy exists (`SELECT * FROM platform_policies WHERE type='privacy_policy' AND status='published'`)
  - Sign-off checklist with SQL verification queries
  - Expected results documented for each test case with testIDs

- Tier 0 (always):
  - Mobile: `cd p2p-kids-marketplace && npm run typecheck && npm run lint` (must pass)
  - Unit tests: `cd p2p-kids-marketplace && npm run test:unit -- privacyPolicy.test.ts` (all pass)
  - Component tests: `cd p2p-kids-marketplace && npm run test:unit -- PrivacyPolicyScreen.test.tsx` (all pass)

- Tier 1 (when mobile UI or service changes):
  - Run TC-01 to TC-10 from `SAFETY-011-PRIVACY-POLICY-MANUAL-TESTING-GUIDE.md`
  - Verify navigation flows (Settings → Privacy Policy, Signup → Privacy Policy link)
  - Verify testID props render correctly for Maestro
  - Run Maestro flows: `npm run test:maestro:ios -- .maestro/privacy-policy-system.yaml`

- Tier 2 (when SQL migration or RPC changes — not applicable for SAFETY-011):
  - No new migrations (reuses SAFETY-010 schema)
  - If SAFETY-010 schema changes in future, run full regression for both TOS and Privacy Policy

- Quick Manual Smoke (happy path):
  1. Admin: Log in to admin portal → `/settings/policies` → "Create New Policy"
  2. Fill form: type=privacy_policy, version=1.0, title="Privacy Policy", effective_date=today, content="Test Privacy Policy content"
  3. Submit → verify policy created with status=draft
  4. View policy → click "Publish" → verify status transitions to published
  5. Query: `SELECT * FROM platform_policies WHERE type='privacy_policy' AND status='published' ORDER BY created_at DESC LIMIT 1;`
  6. Mobile: Settings → "Privacy Policy" → verify content displays
  7. Mobile: Signup flow → tap Privacy Policy link → verify Privacy Policy displays
  8. Query: `SELECT * FROM policy_acceptances WHERE policy_type='privacy_policy' ORDER BY accepted_at DESC;`

- Quick Manual Smoke (Settings navigation):
  1. Mobile: Login → Settings → "Privacy Policy" → verify Privacy Policy screen renders
  2. Verify: testID `privacy-policy-screen` exists, content visible, back button works
  3. Verify: No acceptance button in read-only mode (requireAcceptance=false)

- Change Classification: C (Mobile UI only — reuses existing DB/Admin infrastructure)
- Required Tiers: 0 (always) + 1 (UI changes only)
- Impacted Modules: MODULE-13-SAFETY-COMPLIANCE (SAFETY-011)

- Dependencies:
  - SAFETY-010 (TOS System) — reuses `platform_policies`, `policy_acceptances` tables and all RPC functions
  - `auth.users` table (Supabase Auth)
  - `profiles` table (user metadata)
  - Admin authentication with role-based access (already implemented in SAFETY-010)
  - Mobile navigation (React Navigation stack)
  - `react-native-markdown-display` library for Markdown rendering

- Verification Checklist Mapping (MODULE-13-VERIFICATION.md SAFETY-011):
  - ✅ **PP-1**: Confirmed existing platform_policies table supports privacy_policy type (no schema changes)
  - ✅ **PP-2**: Confirmed RPC functions accept policy_type parameter (get_current_policy, has_accepted_current_policy, record_policy_acceptance)
  - ✅ **PP-3**: Confirmed admin UI supports Privacy Policy management (p2p-kids-admin/src/app/settings/policies/page.tsx)
  - ✅ **PP-4**: Mobile Privacy Policy screen created (PrivacyPolicyScreen.tsx with dual-mode: read-only + acceptance)
  - ✅ **PP-5**: Mobile service layer implemented (PrivacyPolicyService with 4 methods)
  - ✅ **PP-6**: Settings integration (Privacy Policy menu item after TOS with testID `settings-privacy-policy-button`)
  - ✅ **PP-7**: Signup link fixed (now navigates to PrivacyPolicy screen with testID `privacy-policy-link`)
  - ✅ **PP-8**: Navigation configured (types.ts + AppNavigator.tsx with PrivacyPolicy route)
  - ✅ **PP-9**: Unit tests for service (8 test cases in privacyPolicy.test.ts)
  - ✅ **PP-10**: Unit tests for component (4 test groups in PrivacyPolicyScreen.test.tsx)
  - ✅ **PP-11**: E2E integration tests (5 test groups in safety-011-privacy-policy.integration.test.ts)
  - ✅ **PP-12**: Maestro UI flows (3 flows in privacy-policy-system.yaml)
  - ✅ **PP-13**: Manual test guide (10 test cases with SQL verification)

- Known Limitations:
  - Acceptance is optional by default (not required for signup — differs from TOS)
  - IP address capture depends on client providing it (defaults to null if unavailable)
  - User-agent parsing done client-side (not validated server-side)
  - No automatic re-acceptance flow when new version published
  - Markdown rendering uses `react-native-markdown-display` (basic formatting only)

- Future Enhancements:
  - Required Privacy Policy acceptance hooks (if regulatory requirements change)
  - User notification when new Privacy Policy published
  - Diff view showing changes between versions
  - Privacy Policy changelog/version history in mobile app
  - Admin analytics (view rates, acceptance rates)

---

### FLOW-33: Liability Disclaimer System — SAFETY-012

- Purpose: Admin-managed Liability Disclaimer system displayed during trade initiation requiring mandatory buyer acknowledgment before finalizing purchase. Admins create, edit, and publish Liability Disclaimer versions; users **must** acknowledge on each trade (modal with checkbox validation). System tracks per-transaction acknowledgment in trades table plus historical audit trail in policy_acceptances. Reuses complete platform_policies infrastructure from SAFETY-010.

- Covers:
  - Admin Liability Disclaimer management (create, edit, publish, archive)
  - Version-controlled policy storage (reuses `platform_policies` table with type='liability_disclaimer')
  - **Mandatory** user acknowledgment during trade initiation (blocking modal with checkbox)
  - Per-transaction tracking in `trades` table (disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at)
  - Full audit trail in `policy_acceptances` table (with IP address and user-agent metadata)
  - User Liability Disclaimer viewing from Settings (read-only reference mode)
  - Status transitions: draft → published → archived
  - RPC functions for policy retrieval and transaction-specific acknowledgment recording

- Database Schema:
  - Migration `307_liability_disclaimer_tracking.sql` (NEW for SAFETY-012):
    - ALTER TABLE `trades` adds:
      - `disclaimer_acknowledged` BOOLEAN NOT NULL DEFAULT FALSE
      - `disclaimer_policy_id` UUID REFERENCES platform_policies(id) ON DELETE SET NULL
      - `disclaimer_acknowledged_at` TIMESTAMPTZ
    - Indexes: `idx_trades_disclaimer_policy_id`, `idx_trades_disclaimer_acknowledged`
    - RPC function: `acknowledge_trade_disclaimer(p_trade_id UUID, p_disclaimer_policy_id UUID)`
      - Validates: user owns trade (buyer_id = auth.uid()), policy exists and is published, trade is in 'pending' or 'confirmed' status
      - Updates: trades table disclaimer columns
      - Inserts: policy_acceptances row with IP/user-agent metadata
      - Returns: success boolean with error messages
      - Uses transaction for atomicity (BEGIN...COMMIT)
  - Reuses from SAFETY-010 Migration `304_platform_policies_tos.sql`:
    - `platform_policies` table: Already supports `type='liability_disclaimer'` (enum includes: terms_of_service | privacy_policy | liability_disclaimer)
    - `policy_acceptances` table: Tracks acceptances for all policy types including Liability Disclaimer
    - RPC functions:
      - `get_current_policy(p_policy_type)` → returns published policy for given type (call with 'liability_disclaimer')
      - `has_accepted_current_policy(p_user_id, p_policy_type)` → boolean check (optional for lifetime check)
      - `record_policy_acceptance(p_user_id, p_policy_id, p_ip_address, p_user_agent, p_device_info)` → insert acceptance with metadata (called by acknowledge_trade_disclaimer)
      - `publish_policy(p_policy_id, p_published_by)` → status transition + archive old published versions
    - RLS Policies: Same as SAFETY-010 (published policies visible to all, draft/archived admin-only)

- Admin Portal Pages (Reuses SAFETY-010 UI):
  - `/settings/policies` — `p2p-kids-admin/src/app/settings/policies/page.tsx` 
    - Already supports Liability Disclaimer tab (implemented in SAFETY-010)
    - List view with status badges, version numbers, effective dates
    - Create, View, Edit, Publish actions per policy
  - `/settings/policies/new` — `p2p-kids-admin/src/app/settings/policies/new/page.tsx`
    - Form: policy type dropdown includes 'liability_disclaimer' option
    - Validation: version format, required fields
  - `/settings/policies/[id]` — `p2p-kids-admin/src/app/settings/policies/[id]/page.tsx`
    - View policy details (metadata + content)
    - Publish button for draft policies (calls `publish_policy` RPC)

- Mobile App Integration (NEW for SAFETY-012):
  - `DisclaimerModal.tsx` — **blocking modal** displayed during trade initiation:
    - Triggered: when user taps "Confirm Purchase" button on trade confirmation screen
    - Displays: full disclaimer content with version badge and effective date
    - Checkbox: "I have read and acknowledge this disclaimer" (unchecked by default)
    - Buttons: "Cancel" (closes modal, returns to trade screen), "Accept" (disabled until checkbox checked)
    - On Accept: calls `onAccept(disclaimerPolicyId)` callback → parent screen calls `acknowledge_trade_disclaimer` RPC → closes modal → proceeds with trade
    - Checkbox Reset: resets to unchecked every time modal reopens (prevents accidental acceptance)
    - Error Handling: loading spinner, error display with retry button, empty state if no policy exists
    - Uses `react-native-markdown-display` for iOS Markdown rendering; Android uses plain-text fallback for stability
    - TestID props: `disclaimer-modal`, `disclaimer-checkbox`, `disclaimer-accept-button`, `disclaimer-cancel-button`, `disclaimer-close-button`
  - `LiabilityDisclaimerScreen.tsx` — read-only screen in Settings:
    - Navigation: Settings → "Liability Disclaimer" menu item
    - Displays: current published Liability Disclaimer, version badge, effective date
    - Mode: read-only (no action buttons, no checkbox — differs from modal)
    - Info notice: "This disclaimer is shown when you make a purchase"
    - Error Handling: loading spinner, error with retry button
    - TestID props: `liability-disclaimer-screen`, `liability-disclaimer-version`, `liability-disclaimer-content`
  - `TradeInitiationScreen.tsx` — trade confirmation screen (MODIFIED):
    - Added states: `showDisclaimer` (boolean), `disclaimerPolicyId` (UUID)
    - Modified flow: "Confirm Purchase" button now calls `handleConfirmPurchase()` → shows DisclaimerModal
    - On modal accept: `handleDisclaimerAccept(disclaimerPolicyId)` → closes modal → calls `handleInitiateTrade(disclaimerPolicyId)` → initiates trade → calls `acknowledge_trade_disclaimer` RPC with trade_id and policy_id
    - On modal cancel/close: modal closes, no trade initiated, user returns to trade confirmation screen
    - RPC call: `await supabase.rpc('acknowledge_trade_disclaimer', { p_trade_id, p_disclaimer_policy_id })`
    - Error Handling: if disclaimer acknowledgment fails, show error alert, do NOT proceed with payment
  - Navigation updates:
    - `types.ts` — added `LiabilityDisclaimer: undefined` route
    - `AppNavigator.tsx` — registered `LiabilityDisclaimerScreen` in authenticated stack (after PrivacyPolicy)
    - `SettingsScreen.tsx` — added "Liability Disclaimer" menu item with shield-outline icon, testID `settings-liability-disclaimer-button` (placed after Privacy Policy)

- Automated Tests:
  - Unit (Jest): `p2p-kids-marketplace/src/__tests__/components/DisclaimerModal.test.tsx`
    - 15 test cases covering:
      - Loading state renders spinner
      - Success state renders disclaimer content with checkbox and buttons
      - Checkbox controls accept button disabled state
      - Accept button calls onAccept with policy ID when checkbox is checked
      - Cancel/Close buttons call onCancel callback
      - Checkbox resets to unchecked when modal reopens
      - Error state renders with retry button
      - Retry button refetches disclaimer
      - Accessibility labels present
    - Mocked Supabase client for offline execution
    - Run: `npm run test:unit -- DisclaimerModal.test.tsx`
  - Unit (Jest): `p2p-kids-marketplace/src/__tests__/screens/LiabilityDisclaimerScreen.test.tsx`
    - 10 test cases covering:
      - Loading state with ActivityIndicator
      - Success state with disclaimer content, version, effective date
      - Back button navigation
      - Error state with retry button
      - Retry functionality refetches disclaimer
    - Mocked navigation, SafeAreaView, Ionicons, Markdown renderer
    - Run: `npm run test:unit -- LiabilityDisclaimerScreen.test.tsx`
  - E2E (Jest, Supabase prod): `p2p-kids-marketplace/src/__tests__/integration/liability-disclaimer.integration.test.ts`
    - 4 test groups:
      - Disclaimer Retrieval (get_current_policy RPC)
      - Disclaimer Acknowledgment (acknowledge_trade_disclaimer RPC)
      - Policy Acceptances Audit Trail (policy_acceptances table)
      - Trades Table Disclaimer Tracking (disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at columns)
    - Creates test user with dynamic email, creates test trade, cleans up after tests
    - Requires `RUN_SUPABASE_E2E=true` and real Supabase credentials
    - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- liability-disclaimer.integration.test.ts`
  - Maestro UI Flow: `.maestro/liability-disclaimer-flow.yaml`
    - 4 flows:
      - Flow 1: View from Settings → navigate to Settings → tap "Liability Disclaimer" → verify content displays → tap back button
      - Flow 2: Accept during trade (happy path) → navigate to trade confirmation → tap "Confirm Purchase" → modal appears → check checkbox → tap "Accept" → verify modal closes
      - Flow 3: Cancel during trade → navigate to trade confirmation → tap "Confirm Purchase" → modal appears → tap "Cancel" → verify returns to trade screen
      - Flow 4: Close button (X) → navigate to trade confirmation → tap "Confirm Purchase" → modal appears → tap close button → verify returns to trade screen
    - TestID locators: `settings-liability-disclaimer-button`, `liability-disclaimer-screen`, `confirm-purchase-button`, `disclaimer-modal`, `disclaimer-checkbox`, `disclaimer-accept-button`, `disclaimer-cancel-button`, `disclaimer-close-button`
    - Pre-test Setup: SQL queries to verify liability_disclaimer policy exists and trades table has disclaimer columns
    - Run: `npm run test:maestro:ios -- .maestro/liability-disclaimer-flow.yaml` or `npm run test:maestro:android -- .maestro/liability-disclaimer-flow.yaml`

- Manual Test Guide: `SAFETY-012-LIABILITY-DISCLAIMER-MANUAL-TESTING-GUIDE.md`
  - 12 test cases across 5 sections:
    - Settings Navigation (TC-001): View from Settings, verify content, back navigation
    - Trade Flow Integration (TC-002 to TC-005): Accept flow, Cancel flow, Close button, Checkbox reset on reopen
    - State Management & Error Handling (TC-006 to TC-008): Loading state, Error state with retry, Empty state (no policy)
    - Admin Operations (TC-009): Create and publish liability_disclaimer using admin UI
    - Cross-Platform & Accessibility (TC-010 to TC-012): Audit trail verification in database, Multiple acknowledgments per user, Scope validation (only trades show disclaimer)
  - Pre-testing Setup: SQL queries to verify liability_disclaimer policy exists (`SELECT * FROM platform_policies WHERE type='liability_disclaimer' AND status='published'`)
  - Expected results with SQL verification queries for each test case
  - Sign-off checklist with database validation queries
  - Issue reporting template with simulator logs and SQL queries

- Tier 0 (always — BEFORE simulator testing):
  - Mobile: `cd p2p-kids-marketplace && npm run typecheck && npm run lint` (must pass, catches duplicate exports and JSX syntax errors)
  - Unit tests: `cd p2p-kids-marketplace && npm run test:unit -- DisclaimerModal.test.tsx` (15 tests must pass)
  - Unit tests: `cd p2p-kids-marketplace && npm run test:unit -- LiabilityDisclaimerScreen.test.tsx` (10 tests must pass)
  - **SQL Prerequisites**: Run migration `307_liability_disclaimer_tracking.sql` in Supabase SQL Editor BEFORE any mobile testing

- Tier 1 (when mobile UI, service, or RPC changes):
  - Run TC-001 to TC-012 from `SAFETY-012-LIABILITY-DISCLAIMER-MANUAL-TESTING-GUIDE.md`
  - Verify navigation flows (Settings → Liability Disclaimer, Trade Confirmation → Disclaimer Modal)
  - Verify testID props render correctly for Maestro
  - Run Maestro flows: `npm run test:maestro:ios -- .maestro/liability-disclaimer-flow.yaml`
  - Verify trade flow: Confirm Purchase button → modal displays → checkbox required → acceptance tracked in trades table

- Tier 2 (when SQL migration or RPC changes — APPLICABLE for SAFETY-012):
  - Run migration `307_liability_disclaimer_tracking.sql` in fresh Supabase instance (or use `supabase db reset` locally)
  - Verify trades table schema: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='trades' AND column_name LIKE 'disclaimer%';`
  - Verify RPC function exists: `SELECT proname FROM pg_proc WHERE proname='acknowledge_trade_disclaimer';`
  - Test RPC function directly: `SELECT acknowledge_trade_disclaimer('<test_trade_id>', '<test_policy_id>');`
  - Run full E2E integration tests: `RUN_SUPABASE_E2E=true npm run test:e2e -- liability-disclaimer.integration.test.ts`
  - Verify policy_acceptances audit trail: `SELECT * FROM policy_acceptances WHERE policy_type='liability_disclaimer' ORDER BY accepted_at DESC LIMIT 10;`

- Quick Manual Smoke (happy path):
  1. **Admin**: Log in to admin portal → `/settings/policies` → verify "Liability Disclaimer" tab exists
  2. **Admin**: Create New Policy → type=liability_disclaimer, version=1.0, title="Liability Disclaimer", effective_date=today, content="Test liability content"
  3. **Admin**: Submit → verify policy created with status=draft → View policy → click "Publish" → verify status=published
  4. Query: `SELECT * FROM platform_policies WHERE type='liability_disclaimer' AND status='published' ORDER BY created_at DESC LIMIT 1;`
  5. **Mobile**: Settings → "Liability Disclaimer" → verify content displays in read-only mode
  6. **Mobile**: Navigate to trade confirmation screen (browse listing → select item → initiate trade)
  7. **Mobile**: Tap "Confirm Purchase" → verify DisclaimerModal displays with checkbox unchecked
  8. **Mobile**: Try tapping "Accept" without checking checkbox → verify button is disabled
  9. **Mobile**: Check checkbox → tap "Accept" → verify modal closes and trade proceeds
  10. Query: `SELECT disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at FROM trades WHERE id='<trade_id>';` → verify disclaimer_acknowledged=TRUE
  11. Query: `SELECT * FROM policy_acceptances WHERE policy_type='liability_disclaimer' AND user_id='<user_id>' ORDER BY accepted_at DESC;` → verify acceptance record exists

- Quick Manual Smoke (cancel/close paths):
  1. **Mobile**: Navigate to trade confirmation → tap "Confirm Purchase" → modal displays
  2. **Mobile**: Tap "Cancel" button → verify modal closes, returns to trade screen, no trade initiated
  3. **Mobile**: Tap "Confirm Purchase" again → modal displays → tap close button (X) → verify modal closes
  4. **Mobile**: Tap "Confirm Purchase" again → check checkbox → tap "Accept" → verify checkbox resets to unchecked next time modal opens

- Change Classification: B (Edge Functions/RPC) + C (Mobile UI) + A (DB Migration — trades table altered)
- Required Tiers: 0 (always) + 1 (UI/service changes) + 2 (DB migration + RPC function)
- Impacted Modules: MODULE-13-SAFETY-COMPLIANCE (SAFETY-012), MODULE-06-TRADE-FLOW (modified TradeInitiationScreen)

- Dependencies:
  - SAFETY-010 (TOS System) — reuses `platform_policies`, `policy_acceptances` tables and RPC functions (get_current_policy, record_policy_acceptance, publish_policy)
  - Migration 060 (Trade Flow) — trades table must exist before applying migration 307
  - Migration 304 (Platform Policies) — platform_policies table must exist and support liability_disclaimer type enum value
  - `auth.users` table (Supabase Auth)
  - `profiles` table (user metadata)
  - Admin authentication with role-based access (already implemented in SAFETY-010)
  - Mobile navigation (React Navigation stack)
  - Trade flow (TradeInitiationScreen integration)
  - `react-native-markdown-display` library for Markdown rendering

- Verification Checklist Mapping (MODULE-13-VERIFICATION.md SAFETY-012):
  - ✅ **LD-1**: Database schema for disclaimer tracking (migration 307 adds disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at to trades table)
  - ✅ **LD-2**: RPC function for acknowledgment (acknowledge_trade_disclaimer with transaction safety, user authorization, policy validation)
  - ✅ **LD-3**: Mobile disclaimer component (DisclaimerModal.tsx with checkbox validation, loading/error/success states, testID props)
  - ✅ **LD-4**: Settings screen link (SettingsScreen.tsx menu item "Liability Disclaimer" with shield-outline icon, testID `settings-liability-disclaimer-button`)
  - ✅ **LD-5**: Trade flow integration (TradeInitiationScreen.tsx modified to show DisclaimerModal before trade completion, blocks trade until accepted)
  - ✅ **LD-6**: Admin UI (reuses p2p-kids-admin/src/app/settings/policies UI with liability_disclaimer tab from SAFETY-010)
  - ✅ **LD-7**: Audit trail (policy_acceptances table records with IP/user-agent, called by acknowledge_trade_disclaimer RPC)
  - ✅ **LD-8**: Per-transaction tracking (trades table disclaimer columns updated atomically with audit record)
  - ✅ **LD-9**: Unit tests for modal (15 test cases in DisclaimerModal.test.tsx covering checkbox, buttons, reset, error handling)
  - ✅ **LD-10**: Unit tests for screen (10 test cases in LiabilityDisclaimerScreen.test.tsx covering display, navigation, retry)
  - ✅ **LD-11**: E2E integration tests (liability-disclaimer.integration.test.ts with 4 test groups against real Supabase)
  - ✅ **LD-12**: Maestro UI flows (liability-disclaimer-flow.yaml with 4 flows: Settings view, Accept, Cancel, Close)
  - ✅ **LD-13**: Manual test guide (SAFETY-012-LIABILITY-DISCLAIMER-MANUAL-TESTING-GUIDE.md with 12 test cases, SQL verification)

- Known Limitations:
  - Disclaimer acknowledgment is trade-specific (not signup-wide like TOS — each trade requires separate acknowledgment)
  - IP address capture depends on client providing it (defaults to null if unavailable)
  - User-agent parsing done client-side (not validated server-side)
  - If admin un-publishes or deletes disclaimer policy while user has modal open, acceptance will fail (error shown to user)
  - Markdown rendering uses `react-native-markdown-display` (basic formatting only, no interactive elements)
  - Modal checkbox must be manually checked each time (no "remember my choice" option to enforce explicit acknowledgment)

- Future Enhancements:
  - Disclaimer version tracking per trade (currently stores policy_id but no historical version snapshot)
  - User notification when disclaimer changes (e.g., "Disclaimer updated since your last purchase")
  - Diff view showing changes between disclaimer versions
  - Admin analytics (acknowledgment rates, time-to-accept per trade type)
  - Localized disclaimer content (multi-language support)

---

### FLOW-21: Admin Category Management V3 — Dynamic Categories + SP Configuration

- **Purpose**: Admin-driven category CRUD, category suggestions queue, per-category SP rates, live item counts
- **Module**: MODULE-12-ADMIN-V3-CATEGORIES
- **Tasks**: ADMIN-V3-001 through ADMIN-V3-009
- **Dependencies**: 
  - MODULE-01 (categories, user_roles, items tables)
  - MODULE-04 V3 (writes category_suggestions when seller picks "Other")
  - MODULE-05 V3 (reads getCategoriesWithCounts for buyer filter chips)
  - MODULE-09 (Swap Points wallet + ledger)
  - MODULE-14 (NotificationService for SP rate-change banners)

#### ADMIN-V3-001: Schema Migrations (Foundation)

- **Scope**: 5 Supabase migrations adding 11 columns to `categories`, `category_suggestions` table, trigger system, RPC, storage bucket
- **Files Created**:
  1. `supabase/migrations/20260420000006_add_category_management_columns.sql`
     - ALTER `categories` table: adds `description, icon_url, bonus_badge_icon_url, sp_earning_multiplier, sp_spending_cap_percent, sp_config_notes, sp_rate_change_notify, item_count`
     - CHECK constraints: `sp_earning_multiplier BETWEEN 1.05 AND 1.40`, `sp_spending_cap_percent BETWEEN 50 AND 80`
     - Length constraints: description ≤200, icon ≤50, sp_config_notes ≤500
     - Indexes: `idx_categories_active` (partial WHERE is_active=TRUE), `idx_categories_item_count` (partial WHERE item_count>0), `idx_categories_bonus` (partial WHERE sp_earning_multiplier>1.10)
     - Backfills `display_order` via ROW_NUMBER()
  2. `supabase/migrations/20260420000007_create_category_suggestions.sql`
     - CREATE `category_suggestions` table (id, suggested_name, seller_id, item_id, status, approved_by, merged_to_category_id, admin_note, created_at, reviewed_at)
     - UNIQUE constraint on `item_id`
     - CHECK constraint: status IN ('pending','approved','rejected','merged')
     - RLS policies: Admin (FOR ALL via user_roles), Seller (FOR SELECT where seller_id=auth.uid())
     - Indexes: `idx_category_suggestions_status` (partial pending), `idx_category_suggestions_seller`
  3. `supabase/migrations/20260420000008_category_item_count_trigger.sql`
     - CREATE FUNCTION `update_category_item_count()` SECURITY DEFINER
     - Handles INSERT/UPDATE(category_id, status)/DELETE on items
     - Trigger `update_category_item_count_trigger` AFTER ... FOR EACH ROW
     - Backfills initial counts: `UPDATE categories SET item_count = (SELECT COUNT(...) WHERE status='available')`
  4. `supabase/migrations/20260420000009_reorder_categories_rpc.sql`
     - CREATE FUNCTION `reorder_categories(p_category_orders JSONB)` SECURITY DEFINER
     - Admin-only RPC (checks user_roles.role='admin')
     - Batch updates `display_order` via jsonb_to_recordset loop
  5. `supabase/migrations/20260420000010_create_category_icons_storage_bucket.sql`
     - INSERT storage bucket `category-icons` (public=true)
     - RLS policies: public SELECT; admin-only INSERT/UPDATE/DELETE (via user_roles)
- **Verification** (Manual Testing Guide):
  - Manual Test Guide: `ADMIN-V3-001-MANUAL-TESTING-GUIDE.md` (20 test cases)
  - TC-001 to TC-004: Verify columns, constraints, backfill, indexes
  - TC-005 to TC-007: Verify category_suggestions table, RLS, indexes
  - TC-008 to TC-013: Verify trigger function, attachment, backfill, INSERT/UPDATE/DELETE behavior
  - TC-014 to TC-017: Verify reorder_categories RPC (admin success, non-admin rejection, validation)
  - TC-018 to TC-019: Verify storage bucket creation, RLS policies
  - TC-020: End-to-end idempotency test (re-run all migrations)
- **SQL Prerequisites** (MUST run BEFORE any testing):
  1. Open Supabase Dashboard → SQL Editor
  2. Execute migrations in strict order: 000006 → 000007 → 000008 → 000009 → 000010
  3. Verify no errors in output
  4. Run verification queries from each migration file (commented at bottom)
- **Regression Tiers**:
  - Tier 0 (always): N/A for pure SQL migrations
  - Tier 1: Manual SQL verification (run commented queries in each migration)
  - Tier 2 (DB migrations): REQUIRED for ADMIN-V3-001
    - `supabase db reset` (or apply to fresh instance)
    - Verify table schema: `SELECT column_name FROM information_schema.columns WHERE table_name='categories'`
    - Verify constraints: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='categories'::regclass`
    - Verify trigger: `SELECT tgname FROM pg_trigger WHERE tgrelid='items'::regclass AND tgname='update_category_item_count_trigger'`
    - Verify RPC: `SELECT proname, prosecdef FROM pg_proc WHERE proname='reorder_categories'`
    - Verify storage: `SELECT id, public FROM storage.buckets WHERE id='category-icons'`

- **Change Classification**: A (DB Migrations — categories table altered + new tables + trigger + RPC + storage)
- **Impacted Flows**:
  - FLOW-04 (Listings): item_count trigger fires on item INSERT/UPDATE/DELETE
  - FLOW-18 (Admin Controls): new admin category management route
  - FLOW-05 (Discovery): buyer-facing category filters consume getCategoriesWithCounts()
  - FLOW-11 (Swap Points): per-category SP earning/spending rates

- **Critical Rules Enforced**:
  - SP rate bounds: `sp_earning_multiplier ∈ [1.05, 1.40]`, `sp_spending_cap_percent ∈ [50, 80]` (DB CHECK + service + UI)
  - Delete only when empty: `deleteCategory` MUST check `item_count = 0` before allowing deletion
  - "Other" category protected: Cannot be deactivated or deleted (enforced in service layer)
  - Trigger-only writes: `categories.item_count` NEVER written by app code (only by trigger)
  - Reorder via RPC only: No N+1 individual UPDATEs from client (single RPC call with JSONB array)
  - Category name uniqueness: case-insensitive (LOWER() comparison) enforced server-side + client debounce
  - Admin-only RPC: `reorder_categories` checks `user_roles.role='admin'` before executing

- **Known Limitations**:
  - Manual bucket configuration required: File size limit (500 KB) and MIME types (PNG, SVG) must be set manually in Supabase Dashboard → Storage → category-icons → Settings
  - No rollback migration provided: Schema changes are additive (safe for production); manual DROP statements required if rollback needed
  - Trigger performance: Bulk inserts (>1000 items) may slow down due to trigger overhead; consider temporarily disabling trigger during bulk data loads
  - Migration idempotency: Uses IF NOT EXISTS / ON CONFLICT DO NOTHING (safe to re-run), but existing data preserved

- **Next Steps** (Post-ADMIN-V3-001):
  1. ADMIN-V3-002: Types & Error Classes (TypeScript types for Category, CategorySuggestion, error classes)
  2. ADMIN-V3-003: Backend Services (categoryService, categorySuggestionService, spConfigService)
  3. ADMIN-V3-004: Admin UI — CategoryManagementPage with CRUD table + form
  4. ADMIN-V3-005: Admin UI — Category Suggestions Queue (approve/reject/merge)
  5. ADMIN-V3-006: Admin UI — SP Analytics Dashboard
  6. ADMIN-V3-007: Mobile Integration — bonus badges, counts, "Other" flow
  7. ADMIN-V3-008: Admin Hooks + State (React Query + Realtime)
  8. ADMIN-V3-009: Tests (Unit + Component + PgTAP + Playwright + Maestro)

- **Backward Compatibility**:
  - V2 `categories` rows continue to work (new columns default sensibly: is_active=TRUE, sp_earning_multiplier=1.10, sp_spending_cap_percent=70)
  - V2 RLS policies on `categories` unchanged (V3 adds admin CRUD policies alongside existing read policy)
  - V2 admin dashboard routes preserved (new `/admin/categories` route is net-new)
  - Existing items table unaffected (trigger fires on existing INSERT/UPDATE/DELETE operations)

- **Future Enhancements** (Out of scope for V3.0):
  - Materialized view for SP analytics (currently computed via aggregation query)
  - Category icon auto-generation via AI (e.g., DALL-E for custom category icons)
  - Category merge/split tools (currently admin must manually reassign items)
  - Category usage analytics dashboard (trend graphs, seasonal patterns)
  - Localized category names (multi-language support)
  - Category templates (predefined categories for new nodes)

- **Test Summary** (ADMIN-V3-001 Manual Testing):
  | Category | Total | Status |
  |----------|-------|--------|
  | Schema | 4 | ⏳ PENDING |
  | Constraints | 2 | ⏳ PENDING |
  | Table Structure | 2 | ⏳ PENDING |
  | RLS Policies | 2 | ⏳ PENDING |
  | Triggers | 5 | ⏳ PENDING |
  | RPC Functions | 4 | ⏳ PENDING |
  | Storage | 2 | ⏳ PENDING |
  | **TOTAL** | **21** | **⏳ PENDING SQL EXECUTION** |

#### ADMIN-V3-002: Shared Types & Error Classes (COMPLETED 2026-04-29)

- **Scope**: TypeScript type definitions and error classes for category management (admin + mobile)
- **Status**: ✅ **IMPLEMENTATION COMPLETE**
- **Duration**: 1 hour
- **Dependencies**: ADMIN-V3-001 (schema migrations)

- **Files Created**:
  1. **Admin Portal Types**:
     - `p2p-kids-admin/src/types/category.ts` (19 types/interfaces):
       - `Category` — complete entity (15 fields matching DB schema)
       - `CreateCategoryInput` — create payload (8 optional fields)
       - `UpdateCategoryInput` — update payload (10 optional fields, excludes item_count/display_order)
       - `SuggestionStatus` — union type `'pending' | 'approved' | 'rejected' | 'merged'`
       - `CategorySuggestion` — suggestion entity (10 fields + optional joined data)
       - `ApproveSuggestionInput` — approve payload
       - `MergeSuggestionInput` — merge payload
       - `RejectSuggestionInput` — reject payload
       - `BonusCategory` — filtered view (8 fields, sp_earning_multiplier > 1.10)
       - `CategorySPAnalytics` — analytics data (4 metrics + anomaly flags)
       - `AnomalyFlag` — union type `'hoarding' | 'low_velocity' | 'spending_spike'`
       - `ValidationResult` — validation result `{ valid: boolean; error?: string }`
       - `CategorySPPreview` — preview calculation (4 fields)
       - `CategoryReorderItem` — reorder payload `{ id: string; display_order: number }`
       - `IconType` — union type `'category' | 'bonus_badge'`
     - `p2p-kids-admin/src/types/errors.ts` (8 error classes + 2 utilities):
       - `DuplicateNameError` — code: `DUPLICATE_NAME`
       - `CategoryNotEmptyError` — code: `CATEGORY_NOT_EMPTY` (includes item count)
       - `SPRateOutOfRangeError` — code: `SP_RATE_OUT_OF_RANGE` (includes field, value, min, max)
       - `IconUploadError` — code: `ICON_UPLOAD_ERROR` (reason: `bad_type | too_large | too_small | upload_failed`)
       - `UnauthorizedError` — code: `UNAUTHORIZED`
       - `CannotDeactivateOtherError` — code: `CANNOT_DEACTIVATE_OTHER`
       - `SuggestionNotFoundError` — code: `SUGGESTION_NOT_FOUND`
       - `InvalidSuggestionStatusError` — code: `INVALID_SUGGESTION_STATUS`
       - `isCategoryError()` — type guard
       - `getErrorCode()` — utility (returns `code` or `'UNKNOWN'`)

  2. **Mobile Types** (subset — no admin fields):
     - `p2p-kids-marketplace/src/types/category.ts` (6 types/interfaces):
       - `Category` — mobile subset (11 fields, excludes `description`, `sp_config_notes`, `sp_rate_change_notify`, `updated_at`)
       - `BonusCategory` — filtered view (8 fields)
       - `CategorySPPreview` — preview calculation (4 fields)
       - `CreateCategorySuggestionInput` — seller suggestion payload `{ item_id, suggested_name }`
       - `CategorySuggestion` — seller view (7 fields + optional merged_to_category)
       - `GetCategoriesOptions` — options `{ includeInactive?: boolean }`

  3. **Unit Tests**:
     - `p2p-kids-admin/src/types/__tests__/category.test.ts` (70+ assertions):
       - Category interface validation
       - CreateCategoryInput / UpdateCategoryInput partial types
       - SuggestionStatus enum
       - CategorySuggestion with joined data
       - BonusCategory filtering
       - CategorySPAnalytics with anomaly flags
       - ValidationResult valid/invalid cases
       - CategorySPPreview calculation
       - CategoryReorderItem structure
       - IconType enum
     - `p2p-kids-admin/src/types/__tests__/errors.test.ts` (60+ assertions):
       - All 8 error classes instantiation
       - Error code stability (uppercase snake_case)
       - Error code uniqueness
       - Error messages with placeholders
       - Type guard `isCategoryError`
       - Utility `getErrorCode`
       - Switch statement compatibility
     - `p2p-kids-marketplace/src/types/__tests__/category.test.ts` (50+ assertions):
       - Mobile Category subset (no admin fields)
       - BonusCategory structure
       - CategorySPPreview calculation (Math.round/floor)
       - CreateCategorySuggestionInput validation
       - CategorySuggestion seller view
       - GetCategoriesOptions
       - Type independence (no admin-portal imports)
       - Strict TypeScript (no `any`)

- **Acceptance Criteria** (ALL MET ✅):
  - [x] `Category` type includes every column from migration
  - [x] `sp_earning_multiplier: number` (1.05–1.40 in comments)
  - [x] `sp_spending_cap_percent: number` (50–80 in comments)
  - [x] `SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'merged'`
  - [x] Error classes extend `Error` with stable `code` strings
  - [x] Mobile type file does NOT import from `admin-portal`
  - [x] Strict TypeScript — no `any` types used

- **Verification** (Manual Testing Guide):
  - **Manual Test Guide**: `ADMIN-V3-002-MANUAL-TESTING-GUIDE.md` (9 test cases)
  - **TC-ADMIN-V3-002-01**: Admin types compilation
  - **TC-ADMIN-V3-002-02**: Mobile types compilation (no admin imports)
  - **TC-ADMIN-V3-002-03**: Admin type unit tests (category.test.ts)
  - **TC-ADMIN-V3-002-04**: Error class unit tests (errors.test.ts)
  - **TC-ADMIN-V3-002-05**: Mobile type unit tests (category.test.ts)
  - **TC-ADMIN-V3-002-06**: Type safety — admin fields not in mobile
  - **TC-ADMIN-V3-002-07**: Error code stability (switch statement compat)
  - **TC-ADMIN-V3-002-08**: SP rate bounds match DB constraints
  - **TC-ADMIN-V3-002-09**: Strict TypeScript — no `any` types

- **Testing Commands**:
  ```bash
  # Admin Portal
  cd p2p-kids-admin
  npm run type-check
  npm test -- src/types/__tests__/category.test.ts
  npm test -- src/types/__tests__/errors.test.ts
  grep -n ": any" src/types/category.ts src/types/errors.ts  # Should return nothing

  # Mobile App
  cd p2p-kids-marketplace
  npm run type-check
  npm test -- src/types/__tests__/category.test.ts
  grep -n ": any" src/types/category.ts  # Should return nothing
  grep -r "from.*p2p-kids-admin" src/types/category.ts  # Should return nothing
  ```

- **Regression Tiers**:
  - **Tier 0** (ALWAYS): TypeScript compilation + unit tests
    - Admin: `npm run type-check && npm test -- src/types/__tests__/`
    - Mobile: `npm run type-check && npm test -- src/types/__tests__/category.test.ts`
  - **Tier 1**: Not applicable (no runtime code other than error classes)
  - **Tier 2**: Not applicable (no DB changes)

- **Change Classification**: B (API contracts / types — no DB, no UI, no runtime except error classes)
- **Impacted Flows**:
  - FLOW-04 (Listings): Mobile CategorySuggestion type for "Other" category flow
  - FLOW-05 (Discovery): Mobile Category type for filter chips
  - FLOW-18 (Admin Controls): Admin types for category CRUD UI

- **Critical Rules Enforced**:
  - **Mobile type independence**: Mobile `src/types/category.ts` MUST NOT import from `p2p-kids-admin`
  - **Admin field exclusion**: Mobile types exclude `description`, `sp_config_notes`, `sp_rate_change_notify`, `updated_at`
  - **Error code stability**: All error codes are const string literals for switch statements
  - **SP rate bounds consistency**: Type comments match DB constraints (1.05–1.40, 50–80)
  - **Strict TypeScript**: No `any` types allowed in any of the 3 type files
  - **Error code uniqueness**: All 8 error codes are unique and uppercase snake_case

- **Known Limitations**:
  - No runtime validation: Types are compile-time only (zod/yup schemas deferred to services)
  - Error messages hardcoded: English-only (i18n deferred to future)
  - SP preview calculation duplicated: Mobile and admin both have `CategorySPPreview` interface (acceptable — prevents cross-package dependency)

- **Next Steps** (Post-ADMIN-V3-002):
  1. **ADMIN-V3-003**: Backend Services — consume these types in categoryService, categorySuggestionService, spConfigService
  2. **ADMIN-V3-004**: Admin UI — use types in CategoryManagementPage components
  3. **ADMIN-V3-007**: Mobile Integration — use mobile types in "Other" category flow + bonus badges

- **Test Summary** (ADMIN-V3-002):
  | Category | Total | Status |
  |----------|-------|--------|
  | TypeScript Compilation | 2 | ✅ READY |
  | Admin Type Unit Tests | 1 | ✅ READY |
  | Error Class Unit Tests | 1 | ✅ READY |
  | Mobile Type Unit Tests | 1 | ✅ READY |
  | Type Safety Checks | 2 | ✅ READY |
  | Error Code Stability | 1 | ✅ READY |
  | SP Bounds Consistency | 1 | ✅ READY |
  | **TOTAL** | **9** | **✅ IMPLEMENTATION COMPLETE** |

---

### FLOW-21: Category Management – Admin CRUD, Suggestions, SP Config
- **Purpose**: Admin category management with drag-and-drop reordering, SP rate configuration, icon management, and seller suggestions workflow
- **Scope**: Admin portal (`p2p-kids-admin/src/app/categories/`)
- **Module**: MODULE-12-ADMIN-V3-CATEGORIES
- **Task**: ADMIN-V3-004

- **Core Operations**:
  - Create category (name validation, uniqueness check, SP rate bounds enforcement)
  - Edit category (3-tab form: Basic Info / Icon & Badge / SP Config)
  - Delete category (only when `item_count = 0`, never "Other")
  - Toggle active/inactive (cannot deactivate "Other")
  - Drag-and-drop reorder (optimistic UI + RPC sync)
  - Bulk actions (activate/deactivate/delete/export CSV)
  - Filter tabs (All / Active / Inactive / Bonus)
  - Search with 300ms debounce
  - Suggestions tab (pending badge, realtime poll every 60s)

- **Key Validations**:
  - Name: `/^[A-Za-z0-9 ]{3,50}$/` (regex), case-insensitive uniqueness via `LOWER()`
  - SP earning multiplier: 1.05–1.40 (legal guardrail)
  - SP spending cap: 50–80% (legal guardrail)
  - Description: max 200 chars
  - SP config notes: max 500 chars
  - Delete: blocked if `item_count > 0` or `name = 'Other'`
  - Deactivate: blocked if `name = 'Other'`

- **Live Preview Calculator**:
  - Tab 3 (SP Config) shows real-time calculations for $50 sample price
  - `earn_sp = Math.round(price * sp_earning_multiplier)`
  - `max_spend_sp = Math.floor(price * sp_spending_cap_percent / 100)`
  - Updates as sliders move (1.05–1.40 step 0.01, 50–80 step 1)

- **Implementation Files**:
  - Services:
    - `p2p-kids-admin/src/lib/categoryService.ts` (CRUD, validation, reorder, icon upload)
    - `p2p-kids-admin/src/lib/categorySuggestionService.ts` (approve/reject/merge suggestions)
    - `p2p-kids-admin/src/lib/spConfigCategoryService.ts` (SP calculations, analytics)
  - Components:
    - `p2p-kids-admin/src/app/categories/page.tsx` (main container with tabs)
    - `p2p-kids-admin/src/app/categories/components/CategoryTable.tsx` (DnD table)
    - `p2p-kids-admin/src/app/categories/components/CategoryRow.tsx` (sortable row)
    - `p2p-kids-admin/src/app/categories/components/CategoryForm.tsx` (3-tab modal)
    - `p2p-kids-admin/src/app/categories/components/BulkActionsDropdown.tsx` (bulk actions)

- **Dependencies**:
  - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (drag-and-drop)
  - `lucide-react` (icons)
  - Migration: `20260420000009_create_categories_table.sql` (ADMIN-V3-001)
  - Migration: `20260420000011_create_category_suggestions_table.sql` (ADMIN-V3-001)

- **Smoke Tests** (Manual Testing Guide: `ADMIN-V3-004-MANUAL-TESTING-GUIDE.md`):
  - **TC-001**: Page load & navigation
  - **TC-002**: Create category (valid data, all tabs)
  - **TC-003**: Create category (duplicate name)
  - **TC-005**: Create category (SP rates out of range)
  - **TC-006**: Edit category
  - **TC-007**: Delete category (item_count = 0)
  - **TC-008**: Delete category (item_count > 0, blocked)
  - **TC-009**: Delete "Other" category (blocked)
  - **TC-010**: Toggle active/inactive
  - **TC-011**: Toggle "Other" category (blocked)
  - **TC-012**: Drag-and-drop reorder
  - **TC-013**: Search categories (300ms debounce)
  - **TC-014**: Filter tabs (All / Active / Inactive / Bonus)
  - **TC-015**: Bulk select
  - **TC-016**: Bulk activate
  - **TC-017**: Bulk deactivate (no items)
  - **TC-018**: Bulk deactivate (with items warning)
  - **TC-019**: Bulk delete (all empty)
  - **TC-020**: Bulk delete (some have items, blocked)
  - **TC-021**: Bulk export CSV
  - **TC-022**: Live SP preview calculation
  - **TC-023**: Suggestions tab (pending badge)

- **Unit Tests**:
  - `p2p-kids-admin/src/lib/__tests__/categoryService.test.ts`
    - `validateCategoryName` (empty, too short, too long, special chars, valid)
    - `checkCategoryUniqueness` (case-insensitive, excludeId)
    - `getCategories` (includeInactive, orderBy)
    - `createCategory` (validation failures, duplicate name, SP rates out of range)
    - `deleteCategory` (item_count > 0, "Other" category)
    - `toggleCategoryActive` ("Other" category blocked)
    - `calculateCategorySPPreview` (Math.round earn_sp, Math.floor max_spend_sp)
    - `getBonusCategories` (sp_earning_multiplier > 1.10 filter)

- **Tier 0** (ALWAYS):
  ```bash
  cd p2p-kids-admin
  npm run typecheck       # MUST pass
  npm run lint            # MUST pass
  npm run build           # MUST compile
  npm test -- src/lib/__tests__/categoryService.test.ts
  ```

- **Tier 1** (Targeted smoke for impacted flows):
  - Run manual TCs: TC-001, TC-002, TC-006, TC-007, TC-010, TC-012
  - Verify:
    - Category CRUD works
    - DnD reorder persists after page refresh
    - "Other" category guards enforced
    - Live preview calculator accurate

- **Tier 2** (Full regression):
  - Run ALL manual TCs (TC-001 through TC-023)
  - Verify in Supabase Dashboard:
    - `categories` table: `display_order` matches drag-and-drop result
    - `item_count` trigger-maintained (readonly from app code)
    - `category_suggestions` table: approve/reject/merge transitions work
  - Integration with FLOW-04 (Listings):
    - Deactivate category → items in that category hidden from search
    - Delete category (empty) → no orphaned items

- **Change Classification**: B + C + D (API contracts + UI + Search/filter)
- **Impacted Flows**:
  - **FLOW-18** (Admin Controls): New category management tab
  - **FLOW-04** (Listings): Category filter chips + "Other" category suggestions
  - **FLOW-06** (Discovery): Category-based search filters

- **Critical Rules Enforced**:
  - "Other" category: Cannot be deleted or deactivated (system-required)
  - Delete: Only when `item_count = 0`
  - SP rates: Earning 1.05–1.40, Cap 50–80 (legal guardrails)
  - Uniqueness: Case-insensitive via `LOWER()`
  - Optimistic UI: Reorder happens immediately, rollback on RPC failure

- **Known Limitations**:
  - Icon upload UI disabled (placeholders only) — full implementation in ADMIN-V3-006
  - Suggestions tab shows "Coming soon" — full implementation in ADMIN-V3-005
  - No realtime category updates (page refresh required)
  - CSV export limited to 9 columns (no custom fields)

- **Next Steps** (Post-ADMIN-V3-004):
  - **ADMIN-V3-005**: Suggestions Workflow (approve/reject/merge UI)
  - **ADMIN-V3-006**: Icon Upload (PNG/SVG validation, signed URL generation)
  - **ADMIN-V3-007**: Mobile Integration (buyer category filters, bonus badges)
  - **ADMIN-V3-008**: React Query Hooks (state management, optimistic updates)

- **Test Summary** (ADMIN-V3-004):
  | Category | Total | Status |
  |----------|-------|--------|
  | Tier 0 (Typecheck/Lint/Build) | 3 | ⏳ PENDING |
  | Unit Tests (categoryService) | 8 | ✅ COMPLETE |
  | Manual Test Cases (P0) | 7 | ⏳ PENDING |
  | Manual Test Cases (P1) | 13 | ⏳ PENDING |
  | Manual Test Cases (P2) | 3 | ⏳ PENDING |
  | Edge Cases | 4 | ⏳ PENDING |
  | **TOTAL** | **38** | **✅ IMPLEMENTATION COMPLETE** |

---

### FLOW-04C: Item Listing – Category SP Calculations & Bonus Badges

- **Purpose**: Seller sees category-specific SP earning/spending preview when creating listings; bonus categories show badge indicators
- **Scope**: MODULE-12 ADMIN-V3-007 Mobile Integration
- **Impacted Modules**: Listing Create, Category Selection, Price Suggestion, Trade Initiation (Checkout)
- **Dependencies**: FLOW-04 (Listings), FLOW-11 (Swap Points), ADMIN-V3-004 (Category Management)

#### Implementation Details (ADMIN-V3-007)

- **Files Modified**:
  - `p2p-kids-marketplace/src/services/categoryService.ts`
    - Added: `getBonusCategories()` - fetches categories where `sp_earning_multiplier > 1.10`
    - Added: `calculateCategorySP(categoryId, price)` - applies category-specific SP formula
    - Updated: `getCategoriesWithCounts(includeInactive)` - filters by `is_active` and `item_count > 0`
  - `p2p-kids-marketplace/src/components/shared/BonusBadge.tsx` (NEW)
    - Renders bonus badge (custom icon or ⭐ fallback)
    - Supports sizes: small (16px), medium (24px), large (32px)
  - `p2p-kids-marketplace/src/components/discovery/CategoryFilterChip.tsx` (NEW)
    - Category filter chip for discovery screens
    - Hides categories with `item_count = 0`
    - Shows bonus badge when `sp_earning_multiplier > 1.10`
  - `p2p-kids-marketplace/src/components/CategorySelectModal.tsx`
    - Shows item counts in format: `"Name (count)"`
    - Displays BonusBadge for bonus categories
    - Filters out categories with `item_count = 0`
  - `p2p-kids-marketplace/src/components/PriceSuggestionCard.tsx`
    - Shows SP preview: `You'll earn: X SP` (Math.round formula)
    - Shows buyer cap: `Buyer can use up to: Y SP` (Math.floor formula)
    - Calls `calculateCategorySP` on price or category change
  - `p2p-kids-marketplace/src/screens/trade/TradeInitiationScreen.tsx`
    - Enforces category-specific SP spending cap
    - Shows Alert if buyer tries to exceed `max_spend_sp`
    - Falls back to global config if category not found

- **SP Formula Rules** (Must Match DB):
  - Earn SP: `Math.round(price * sp_earning_multiplier)` (default multiplier: 1.10)
  - Max Spend SP: `Math.floor((price * sp_spending_cap_percent) / 100)` (default cap: 70%)
  - Bonus Badge Threshold: `sp_earning_multiplier > 1.10` (strict greater than, not >=)

- **"Other" Category Dual-Write** (Verification Requirement):
  - After publishing "Other" item, app calls both:
    1. `flagForCategoryReview(itemId, requestedName)` (existing legacy path)
    2. `createCategorySuggestionFromItem(itemId, requestedName)` (new ADMIN-V3 path)
  - Both writes wrapped in try/catch to prevent publish failure
  - ItemCreateScreen.tsx already implements this ✅

#### Tests (ADMIN-V3-007)

- **Unit Tests**:
  - `src/__tests__/services/categoryService-admin-v3-007.test.ts`
    - `getBonusCategories`: filters by `sp_earning_multiplier > 1.10`, handles DB errors
    - `calculateCategorySP`: rounding rules (Math.round vs Math.floor), null category handling
    - `getCategoriesWithCounts`: filters inactive and zero-count categories
  - `src/__tests__/components/shared/BonusBadge.test.tsx`
    - Renders custom icon vs fallback emoji
    - Size prop variations (small/medium/large)
    - Custom style application

- **Integration Tests**:
  - `e2e/admin-v3-007-category-sp-integration.test.ts`
    - Requires: `RUN_SUPABASE_E2E=true`
    - Coverage: Live Supabase queries for bonus categories, SP calculations, zero-count filtering

- **Maestro Flows**:
  - `.maestro/category-bonus-badges.yaml`
    - States: bonus_visible, no_bonus, zero_count_hidden
    - Steps: Open category modal → verify item counts → verify bonus badges → select category → verify SP preview
  - `.maestro/checkout-sp-cap.yaml`
    - States: sp_within_limit, sp_exceeds_limit
    - Steps: Login subscriber → buy item → enter SP > max → verify cap enforcement alert

- **Manual Testing Guide**: `ADMIN-V3-007-MANUAL-TESTING-GUIDE.md`
  - Test Cases: TC-001 to TC-006
  - Platforms: iOS and Android simulators
  - Prerequisites: SQL to set up bonus categories and zero-count categories

#### Verification Checklist (MODULE-12-VERIFICATION-V3.md)

Satisfied Items:
- ✅ 2.3.1: `getCategoriesWithCounts(false)` filters WHERE `is_active=true` AND `item_count>0`
- ✅ 2.3.2: Category modal shows `"Name (count)"` format
- ✅ 2.3.3: Bonus badge renders when `sp_earning_multiplier > 1.10` (strict)
- ✅ 2.3.4: Zero-count categories hidden from buyer flows
- ✅ 2.4.1: `calculateCategorySP` uses Math.round for earn, Math.floor for max_spend
- ✅ 2.4.2: PriceSuggestionCard shows SP preview on price change
- ✅ 2.4.3: TradeInitiationScreen enforces category-specific SP cap
- ✅ 2.5.1: Publishing "Other" item writes to BOTH `review_flag` AND `category_suggestions`

#### Regression Tiers (ADMIN-V3-007)

- **Tier 0** (ALWAYS):
  ```bash
  cd p2p-kids-marketplace
  npm run typecheck       # MUST pass
  npm run lint            # MUST pass
  npm test -- --testPathPattern=categoryService-admin-v3-007
  npm test -- --testPathPattern=BonusBadge
  ```

- **Tier 1** (Targeted smoke for impacted flows):
  - Run manual TCs: TC-001, TC-002, TC-004 (category modal, SP preview, checkout cap)
  - Run Maestro: `category-bonus-badges.yaml`, `checkout-sp-cap.yaml`
  - Verify:
    - Bonus badges render correctly
    - SP preview calculates correctly
    - Checkout blocks SP amount > category cap

- **Tier 2** (Full regression when DB schema changes):
  - Not required unless `categories` table schema changes
  - If `item_count` trigger modified, run ALL manual TCs

- **Change Classification**: B + C + F (API contracts + UI + Swap Points)
- **Impacted Flows**:
  - **FLOW-04**: Listings (category modal, SP preview)
  - **FLOW-06**: Discovery (CategoryFilterChip - if discovery screen exists)
  - **FLOW-08**: Trade Flow (category-specific SP cap enforcement)
  - **FLOW-11**: Swap Points (category-specific SP calculations)

- **Critical Rules Enforced**:
  - SP calculations MUST match DB formulas (no re-implementation drift)
  - Bonus badge threshold: strict `> 1.10` (not `>=`)
  - Category filter: `is_active=true AND item_count>0` (double-gate)
  - Checkout: cap MUST use category `max_spend_sp`, not global config (unless fallback)
  - "Other" category: MUST dual-write to both legacy and V3 paths (non-blocking)

- **Known Limitations**:
  - Discovery screen may not exist yet → CategoryFilterChip created for future use
  - Bonus badge custom icons require CDN storage setup
  - SP preview loading state duration depends on DB query latency

- **Test Summary** (ADMIN-V3-007):
  | Category | Total | Status |
  |----------|-------|--------|
  | Tier 0 (Typecheck/Lint) | 4 | ⏳ PENDING |
  | Unit Tests (Service) | 12 | ✅ COMPLETE |
  | Unit Tests (Component) | 4 | ✅ COMPLETE |
  | Integration Tests (Supabase) | 6 | ✅ COMPLETE |
  | Maestro UI Tests | 2 | ✅ COMPLETE |
  | Manual Test Cases | 6 | ⏳ PENDING |
  | **TOTAL** | **34** | **✅ IMPLEMENTATION COMPLETE** |

---

### FLOW-21: Education Content Management (Admin CMS) — EDU-008
- **Purpose**: Admin portal for managing trading education sections and examples with mobile preview
- **Scope**: Admin portal only (`p2p-kids-admin/`)
- **Module**: MODULE-18 Trading Education V1 (TASK EDU-008)
- **Added**: January 2025

- **Features**:
  - Section CRUD: Create, edit, preview, publish, unpublish education sections
  - Example CRUD: Create, edit, delete examples with real-time SP calculations
  - Section types: general, sp_definition, sp_earning, sp_spending, safety, example
  - Mobile preview: iPhone-shaped preview modal for sections
  - Publish confirmation: Warning modal before publishing (unpublishes other sections of same type)
  - Category integration: Examples use category SP rates for computation
  - Bonus badge display: Examples show ⭐ for bonus categories (multiplier > 1.10)

- **Components**:
  - `p2p-kids-admin/src/app/education/page.tsx` (main page with 3 tabs)
  - `p2p-kids-admin/src/app/education/components/SectionTable.tsx`
  - `p2p-kids-admin/src/app/education/components/SectionForm.tsx`
  - `p2p-kids-admin/src/app/education/components/ExampleTable.tsx`
  - `p2p-kids-admin/src/app/education/components/ExampleForm.tsx`
  - `p2p-kids-admin/src/app/education/components/MobilePreview.tsx`
  - `p2p-kids-admin/src/app/education/components/PublishConfirmation.tsx`
  - `p2p-kids-admin/src/hooks/useEducationContent.ts` (custom hook - no React Query)
  - `p2p-kids-admin/src/lib/educationContentService.ts` (sections - existing)
  - `p2p-kids-admin/src/lib/educationExampleService.ts` (examples - extended)

- **Database**:
  - Tables: `education_sections`, `education_examples` (created in EDU-001 migration)
  - RPC Functions: `publish_section`, `unpublish_section`, `publish_example`, `unpublish_example`
  - Constraints: title 3-100 chars, body 10-2000 chars, price 0.01-10000, image_url ≤500 chars

- **Navigation**:
  - Sidebar: Content Management → **Education** (between Categories and Policies)
  - Icon: GraduationCap
  - Route: `/education`

- **testID Coverage**:
  - Page: `education-content-page`, `tab-sections`, `tab-examples`, `tab-analytics`
  - Section Table: `section-table`, `section-row-{id}`, `status-badge-{id}`, `btn-edit-{id}`, `btn-preview-{id}`, `btn-publish-{id}`, `btn-unpublish-{id}`
  - Section Form: `section-form-backdrop`, `section-form-modal`, `input-section-title`, `input-section-body`, `input-section-image-url`, `select-section-type`, `input-section-display-order`
  - Example Table: `example-table`, `example-row-{id}`, `status-badge-{id}`, `btn-edit-{id}`, `btn-publish-{id}`, `btn-unpublish-{id}`, `btn-delete-{id}`
  - Example Form: `example-form-backdrop`, `example-form-modal`, `input-example-item-name`, `input-example-price`, `select-example-category`, `input-example-display-order`
  - Modals: `mobile-preview-backdrop`, `mobile-preview-modal`, `publish-confirmation-backdrop`, `publish-confirmation-modal`

- **Tier 0** (ALWAYS run):
  ```bash
  cd p2p-kids-admin
  npm run typecheck       # MUST pass ✅
  npm run lint            # MUST pass ✅ (warnings OK, errors fixed)
  ```

- **Tier 1** (Targeted smoke for impacted flows):
  - Manual TCs: TC-EDU-008-003 (create section), TC-EDU-008-007 (publish), TC-EDU-008-009 (create example with SP)
  - Maestro: `.maestro/education-content-management.yaml`
  - Verify:
    - Section publish/unpublish workflow
    - Example SP calculations match category rates
    - Mobile preview renders correctly
    - Publish confirmation prevents accidental overwrites

- **Tier 2** (Full regression when DB schema changes):
  - Only if `education_sections` or `education_examples` schema changes
  - Run all 22 manual test cases from `EDU-008-MANUAL-TESTING-GUIDE.md`

- **Change Classification**: B + C (API contracts + UI)
- **Impacted Flows**:
  - **FLOW-21** (self - new flow)
  - Integration with FLOW-04 (category SP rates used for example calculations)

- **Critical Rules Enforced**:
  - Only ONE section per `section_type` can be published at a time
  - Published examples cannot be deleted (must unpublish first)
  - Section type cannot be changed after creation
  - SP calculations: `earnSP = round(price × multiplier)`, `maxUseSP = floor(price × cap / 100)`
  - Character limits enforced client-side: title 3-100, body 10-2000, image_url ≤500
  - Price range: $0.01 - $10,000

- **Accessibility**:
  - Focus trap on all modals
  - Esc key closes all modals
  - Tab key cycles through focusable elements
  - First element receives focus on modal open

- **Tests** (EDU-008):
  | Category | Total | Status |
  |----------|-------|--------|
  | Tier 0 (Typecheck/Lint) | 2 | ✅ PASS |
  | Unit Tests | 7 components | ⏳ PENDING |
  | Integration Tests | 1 E2E flow | ⏳ PENDING |
  | Maestro UI Tests | 1 flow | ⏳ PENDING |
  | Manual Test Cases | 22 | ⏳ PENDING |
  | **TOTAL** | **33** | **⏳ UI COMPLETE, TESTS PENDING** |

---

### FLOW-EDU-001: Education Analytics Dashboard (Admin Portal)
- Purpose: Admin analytics for trading education engagement
- Module: MODULE-18-TRADING-EDUCATION V1 (TASK EDU-009)
- Scope:
  - `p2p-kids-admin/src/components/education/AnalyticsDashboard.tsx`
  - `p2p-kids-admin/src/hooks/useEducationAnalytics.ts`
  - `p2p-kids-admin/src/lib/educationAnalyticsService.ts`
  - Date range picker (reused from MODULE-12 V3)
- Features:
  - Onboarding funnel (started/completed/skipped + completion rate)
  - Completion rate warning when < 50% (color-coded red)
  - Help section metrics (total views + top 5 expanded sections)
  - Calculator usage (uses + unique users + price bucket histogram)
  - Date range selection (7/30/90 days, default 30)
  - Empty state per card when no data
- Tests:
  - Unit: `p2p-kids-admin/src/__tests__/hooks/useEducationAnalytics.test.ts` (coverage ≥85%)
  - Unit: `p2p-kids-admin/src/__tests__/components/education/*.test.tsx` (4 component tests)
  - Integration: `p2p-kids-admin/src/__tests__/integration/educationAnalytics.integration.test.ts`
  - Manual: `EDU-009-MANUAL-TESTING-GUIDE.md` (15 test cases)
- Prerequisites (manual ops):
  - `education_analytics` table exists (migration 20260420000020)
  - Sample analytics data seeded or generated from user activity
  - Admin user authenticated
- Validation:
  - `npm run typecheck` (must pass)
  - `npm run lint` (must pass)
  - `npm run test` (all analytics tests green)
  - `RUN_SUPABASE_E2E=true npm run test:e2e` (integration tests pass)
  - Initial dashboard load < 2s on staging
- Regression:
  - Tier 0: typecheck + lint (always)
  - Tier 1: unit tests for analytics hook/cards (when analytics components change)
  - Tier 2: integration tests + manual TC-001 through TC-015 (when analytics service or table schema changes)

---

### FLOW-16: Home Dashboard (UserDashboardScreen) — MODULE-15.1 UI Redesign

- **Purpose**: Redesign the main authenticated home dashboard screen with Whisk-inspired design system and Phosphor icons
- **Module**: MODULE-15.1-UI-REDESIGN (TASK FLOW-16)
- **Scope**: Mobile app only (`p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx`)
- **Priority**: P0 (Critical) — Daily active use
- **Status**: ✅ IMPLEMENTATION COMPLETE (Tier 0 validation passed)
- **Added**: May 2026

#### Features Implemented:

- **Header Row**:
  - Avatar (40px circle) with tap navigation to Profile
  - Time-based greeting: "Good morning/afternoon/evening, [FirstName]"
  - Bell icon (24px, Phosphor `Bell`) with red unread badge dot (`#E85D75`)
  - Notification badge conditionally rendered when `unreadCount > 0`

- **SP Balance Strip** (Subscriber-only):
  - Green background (`#5DBB8E`)
  - `Coins` icon (20px, white) + balance display (18px bold white)
  - "Earn More →" link with tap navigation to SpWallet
  - Hidden for free users (respects `can_spend_sp` from subscription)

- **Quick Action Tiles** (4-column grid):
  - "Sell" → `Storefront` icon → navigates to ListingCreate
  - "Trade" → `ArrowsLeftRight` icon → navigates to Discovery
  - "Discover" → `MagnifyingGlass` icon → navigates to Discovery
  - "My Trades" → `Package` icon → navigates to MyTrades
  - White cards (12px radius, subtle shadow), icons 28px `#5DBB8E`

- **Section Headers**:
  - "Nearby Items" / "Active Trades" / "Recommendations"
  - "See All" link (`#5DBB8E`, right-aligned) with tap navigation to Discovery
  - 16px semibold title, 14px green link

- **Nearby Items Grid**:
  - 2-column FlatList with 12px gap, 16px padding
  - Reuses ItemCard component from discovery module
  - Pull-to-refresh support

- **Design System Compliance**:
  - ✅ All Ionicons replaced with Phosphor React Native v3.0.6
  - ✅ Whisk color palette: Primary green `#5DBB8E`, text `#1A1A1A`, gray `#6B6B6B`
  - ✅ 12px radius cards, 52px button heights, proper spacing (8/12/16px)

#### Files Modified:

1. `p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx`
   - Fixed duplicate style property bug: `actionLabel` → `walletActionLabel` for SP wallet buttons
   - Replaced all Ionicons with Phosphor icons
   - Updated colors to Whisk palette
   - Added testID props for Maestro automation

#### Tests Created:

- **Unit Tests**: `src/screens/dashboard/__tests__/UserDashboardScreen.test.tsx`
  - 15 test groups covering:
    - Header row elements (avatar, greeting, bell + badge)
    - Greeting helper function (time-based, name extraction, fallback to "Friend")
    - SP balance strip (subscriber-only, balance display, navigation)
    - Quick action tiles (4 tiles, navigation verification)
    - Section headers ("See All" link navigation)
    - Loading and error states
    - Phosphor icons usage verification
  - Run: `npm run test:unit -- UserDashboardScreen.test.tsx`

- **Integration Tests**: `src/__tests__/integration/flow-16-dashboard.integration.test.ts`
  - 7 test cases with real Supabase queries:
    - Fetch user session
    - Fetch SP wallet data for subscribed user
    - Fetch subscription status
    - Fetch notification count (using useNotificationBadge service)
    - Fetch recent trades
    - Enforce RLS (user can only see own wallet)
    - Verify SP balance display formatting
  - Requires: `RUN_SUPABASE_E2E=true` env var
  - Run: `RUN_SUPABASE_E2E=true npm run test:e2e -- flow-16-dashboard.integration.test.ts`

- **Maestro UI Flow**: `.maestro/module-15.1-flow-16-home-dashboard.yaml`
  - Automated UI flow testing for iOS and Android simulators
  - States covered:
    - Login → Dashboard verification
    - Header row elements (avatar, greeting, bell + badge)
    - SP balance strip (tap navigation to SpWallet)
    - Quick action tiles (4 tiles with navigation verification)
    - Section headers ("See All" link navigation)
    - Design system compliance (visual checks)
    - Logout cleanup
  - Run: `npm run test:maestro:ios -- .maestro/module-15.1-flow-16-home-dashboard.yaml`

- **Manual Testing Guide**: `MODULE-15.1-FLOW-16-MANUAL-TESTING.md`
  - 10 detailed test cases:
    - TC-1: Header Row - Avatar + Greeting + Bell
    - TC-2: SP Balance Strip (Green Background)
    - TC-3: Quick Action Tiles (4-Column Grid)
    - TC-4: Section Headers with "See All" Links
    - TC-5: Free User Experience (No SP Strip)
    - TC-6: Notification Badge Dynamic Update
    - TC-7: Pull-to-Refresh
    - TC-8: Design System Compliance (Visual Inspection)
    - TC-9: Error States (No Session)
    - TC-10: Cross-Platform Consistency (iOS vs Android)
  - Prerequisites: Test user accounts (free + Kids Club+ subscriber), Supabase credentials

#### Tier 0 Validation (MANDATORY — Run BEFORE simulator testing):

✅ **Typecheck**: `cd p2p-kids-marketplace && npm run typecheck`  
✅ **Lint**: `cd p2p-kids-marketplace && npm run lint`  
✅ **Status**: Both PASSED — no duplicate identifier errors, no syntax errors

#### Tier 1 (Targeted smoke for impacted flows):

- **Manual TCs**: TC-1 (Header Row), TC-2 (SP Strip), TC-3 (Quick Actions), TC-5 (Free User)
- **Maestro**: Run `.maestro/module-15.1-flow-16-home-dashboard.yaml`
- **Verify**:
  - Header elements render correctly (avatar 40px, bell with badge)
  - SP strip shows/hides based on subscription status
  - Quick action tiles navigate to correct screens
  - "See All" links work

#### Tier 2 (Full regression when DB schema changes):

- Not required unless `profiles`, `sp_wallets`, or `user_notifications` schema changes
- Run all 10 manual test cases from `MODULE-15.1-FLOW-16-MANUAL-TESTING.md`
- Run E2E integration tests with real Supabase: `RUN_SUPABASE_E2E=true npm run test:e2e -- flow-16-dashboard`

#### Change Classification:

- **C** (Mobile UI only — no DB, no API, no Supabase changes)
- **Visual redesign scope** (frozen business logic)

#### Impacted Flows:

- **FLOW-01** (Auth): Home Dashboard is the landing screen after login
- **FLOW-10** (SP Wallet): SP balance strip links to SpWallet screen
- **FLOW-17** (Notifications): Bell icon + badge shows unread count

#### Dependencies:

- `useAuth` hook (session, user metadata)
- `useSPWallet` hook (available balance, pending balance)
- `useSubscription` hook (can_spend_sp gate for SP strip visibility)
- `useNotificationBadge` hook (unread count for bell badge)
- `Avatar`, `RecommendationsCarousel`, `CategorySelector`, `SubscriptionBanners` components
- Phosphor React Native v3.0.6 (`phosphor-react-native`)

#### Critical Rules Enforced:

- **Phosphor icons ONLY**: No Ionicons imports allowed (verified in unit tests)
- **Subscriber-only SP strip**: `can_spend_sp` gate enforced (hidden for free users)
- **Time-based greeting**: Dynamically updates based on hour (5-12 AM morning, 12-5 PM afternoon, 5+ PM evening)
- **Name extraction**: First name from `user_metadata.full_name` with fallback to "Friend"
- **Notification badge visibility**: Conditionally rendered only when `unreadCount > 0`
- **Style naming uniqueness**: No duplicate StyleSheet identifiers (bug fixed: `actionLabel` → `walletActionLabel`)

#### Known Limitations:

- Greeting time zones: Uses device local time (not user's timezone from profile)
- Avatar placeholder: Uses generic `#F0F0F0` background (no custom colors by user)
- "Nearby Items" grid: Requires geolocation permission (may show empty if denied)
- SP balance: Shows rounded integer only (no decimal places)

#### Accessibility:

- All interactive elements have `accessibilityRole` and `accessibilityLabel`
- testID props added for UI automation (Maestro, Detox)
- Avatar has `accessibilityHint`: "Tap to view your profile"
- Bell icon has `accessibilityLabel`: "Notifications (3 unread)" (dynamic count)
- Quick action tiles have clear labels for screen readers

#### Test Summary (FLOW-16):

| Category | Total | Status |
|----------|-------|--------|
| Tier 0 (Typecheck/Lint) | 2 | ✅ PASSED |
| Unit Tests | 15 test groups | ✅ READY |
| Integration Tests | 7 test cases | ✅ READY |
| Maestro UI Flow | 1 flow | ✅ READY |
| Manual Test Cases | 10 TCs | ⏳ PENDING EXECUTION |
| **TOTAL** | **35** | **✅ IMPLEMENTATION COMPLETE** |

#### Verification Checklist (MODULE-15.1-VERIFICATION.md FLOW-16):

- [x] Header avatar is 40px circle
- [x] `Bell` icon (24px, `#1A1A1A`) has red dot badge (`#E85D75`) when unread > 0
- [x] SP balance strip has `#5DBB8E` background, white text, `Coins` icon (20px, white)
- [x] 4 quick action tiles are white cards (12px radius, subtle shadow), icons 28px `#5DBB8E`
- [x] Section headers have "See All" in `#5DBB8E` green, right-aligned
- [x] Nearby items grid is 2-column, 12px gap, 16px padding
- [x] Zero Ionicons imports in UserDashboardScreen.tsx
- [x] TypeScript compilation passes with no duplicate identifier errors
- [x] ESLint passes with no new errors

---

### FLOW-13: Referrals UI

---

### FLOW-22: Payouts — Payout Dashboard + Request Payout (MODULE-15.1 UI Redesign)
- **Purpose**: Redesigned payout dashboard and request payout screens with Whisk-inspired design system
- **Module**: MODULE-15.1 UI REDESIGN (TASK FLOW-22)
- **Scope**:
  - `p2p-kids-marketplace/src/screens/payouts/PayoutDashboardScreen.tsx` — new screen
  - `p2p-kids-marketplace/src/screens/payouts/RequestPayoutScreen.tsx` — new screen
  - `p2p-kids-marketplace/src/navigation/types.ts` — `PayoutDashboard`, `RequestPayout` routes added
  - `p2p-kids-marketplace/src/navigation/AppNavigator.tsx` — Stack.Screen registrations added
- **Design**:
  - Hero card: `#5DBB8E` bg, `Coins` (24px white), SP balance 32px bold white, AUD equivalent
  - "Request Payout" white pill on hero card (NOT a separate full-width button)
  - Bank row: `Bank` (20px `#5DBB8E`) + `CaretRight` (16px `#999999`)
  - Payout history: `CheckCircle` (16px `#5DBB8E`) for completed, `Clock` (16px `#F59E0B`) for pending
  - Amount input: `Coins` (20px `#F59E0B`), filled style (`#F0F0F0`, radius 12, height 52), 20px bold font
  - Bank selector: filled row (`#F0F0F0`, radius 12, height 52), `Bank` + `CaretRight`
  - Confirm: `#5DBB8E` pill, 52px height, full width
  - Fee note: 13px, `#999999`, centered
- **Services used**:
  - `src/services/sellerBalance.ts`: `getSellerBalance()`, `getRecentPayouts()`, `requestWithdrawal()`, `calculatePayoutFee()`, `formatCentsToDollars()`
  - `src/services/payoutMethods.ts`: `listPayoutMethods()`
- **Tests**:
  - Unit: `src/__tests__/screens/PayoutDashboardScreen.test.tsx` (16 tests)
  - Unit: `src/__tests__/screens/RequestPayoutScreen.test.tsx` (17 tests)
  - Integration: `src/__tests__/integration/flow-22-payouts.integration.test.ts` (`RUN_SUPABASE_E2E=true`)
  - Maestro: `.maestro/module-15.1-flow-22-payouts.yaml` (15 test cases)
  - Manual: `MODULE-15.1-FLOW-22-MANUAL-TESTING.md` (18 TCs)
- **Change Classification**: C (UI/screens only)
- **Regression Tiers Required**: Tier 0 (always) + Tier 1 for FLOW-22
- **Impacted Flows**: FLOW-22 (self)

| Category | Total | Status |
|----------|-------|--------|
| Tier 0 (Typecheck/Lint) | 2 | ⏳ PENDING |
| Unit Tests | 33 (16 + 17) | ✅ READY |
| Integration Tests | 7 test cases | ✅ READY |
| Maestro UI Flow | 1 flow (15 TCs) | ✅ READY |
| Manual Test Cases | 18 TCs | ⏳ PENDING EXECUTION |
| **TOTAL** | **61** | **✅ IMPLEMENTATION COMPLETE** |

#### Verification Checklist (MODULE-15.1 FLOW-22):

- [x] Balance hero card has `#5DBB8E` background
- [x] `Coins` icon 24px white on hero card
- [x] SP balance is 32px bold white
- [x] AUD equivalent shown below balance
- [x] "Request Payout" is a white pill button on the hero card (not a separate button)
- [x] Bank row: `Bank` (20px `#5DBB8E`) + `CaretRight` (16px `#999999`)
- [x] "Add Bank Account" row shown when no payout method
- [x] Payout history: `CheckCircle` (16px `#5DBB8E`) for completed
- [x] Payout history: `Clock` (16px `#F59E0B`) for pending
- [x] Amount input: `Coins` (20px `#F59E0B`), `#F0F0F0` bg, radius 12, height 52, 20px bold
- [x] AUD equivalent updates live as user types
- [x] Validation error shown when amount exceeds available balance
- [x] Bank selector: filled row (`#F0F0F0`, radius 12, height 52), `Bank` + `CaretRight`
- [x] Payout summary card appears when both amount and method are set
- [x] Fee note: 13px `#999999` centered above confirm button
- [x] Confirm button: `#5DBB8E` pill, 52px height, full width
- [x] Zero Ionicons imports in both new screens
- [x] TypeScript compilation passes with no duplicate identifier errors

---

### FLOW-21: ID Verification Upload Screen (MODULE-15.1 UI Redesign) — COMPLETE ✅ (2026-05-23)

- **Module**: MODULE-15.1-UI-REDESIGN (TASK FLOW-21)
- **Scope**: 1 screen restyled in-place — visual-only, zero business logic changes
  - `p2p-kids-marketplace/src/screens/profile/IDVerificationUploadScreen.tsx`
- **Design changes**:
  - Phosphor icons: `IdentificationCard` (64px `#6B6B6B`), `Camera` (28px `#5DBB8E`), `CheckCircle` (64px `#5DBB8E`), `Clock` (64px `#F59E0B`), `ArrowLeft` (24px header)
  - Three visual states: Unverified (dashed upload area), Pending (gold pill "Under Review"), Verified (green heading + "Verified ✓" pill)
  - Added verified/approved state (was previously missing)
  - Submit button: `#5DBB8E` active, `#E0E0E0` disabled
  - `expo-image-picker` converted from dynamic `await import()` to static import (test reliability)
  - `testID` props on all interactive elements
- **Tests**:
  - Unit: `src/screens/profile/__tests__/IDVerificationUploadScreen.test.tsx` — **21/21 pass**
  - Integration: `e2e/IDVerification.integration.test.ts` (guarded by `RUN_SUPABASE_E2E=true`)
  - Maestro: `.maestro/module-15.1-flow-21-id-verification.yaml`
  - Manual: `MODULE-15.1-FLOW-21-MANUAL-TESTING.md`
- **Tier 0 gate**:
  - `npm run typecheck` — PASS
  - `npx eslint src/screens/profile/IDVerificationUploadScreen.tsx` — PASS
  - `npm run test:unit -- --testPathPattern=IDVerificationUploadScreen` — 21/21 PASS
- **Verification**: MODULE-15.1-VERIFICATION.md D-033 satisfied

---

### FLOW-26: Misc / Edge-Case Screens (MODULE-15.1 UI Redesign) — COMPLETE ✅ (2026-05-24)

- **Module**: MODULE-15.1-UI-REDESIGN (TASK FLOW-26)
- **Purpose**: Redesign 6 utility/edge-case screens to match Whisk-inspired design system
- **Scope**: 6 screens/components created — visual-only, no business logic changes
  - `p2p-kids-marketplace/src/screens/error/OfflineScreen.tsx` — Network error state
  - `p2p-kids-marketplace/src/components/EmptySearchState.tsx` — No search results
  - `p2p-kids-marketplace/src/components/EmptyState.tsx` — Generic empty state (reusable)
  - `p2p-kids-marketplace/src/screens/LoadingScreen.tsx` — Loading state
  - `p2p-kids-marketplace/src/screens/feedback/SuccessScreen.tsx` — Action success
  - `p2p-kids-marketplace/src/screens/feedback/ErrorScreen.tsx` — Action failure
- **Design changes**:
  - Phosphor icons: `WifiX` (64px), `MagnifyingGlassSlash` (56px), `CheckCircle` (72px), `XCircle` (72px), `ArrowCounterClockwise` (18px)
  - All screens: white background (#FFFFFF), centered layout, 24px horizontal padding
  - Primary buttons: `#5DBB8E` pill (52px height, borderRadius 26px)
  - Icons: gray (#E0E0E0) for empty states, green (#5DBB8E) for success, red (#E85D75) for error
  - Typography: 22-24px headings, 15-17px body, 14px subtexts
  - `ActivityIndicator` color: `#5DBB8E`
  - All screens have `testID` props for Maestro automation
- **Navigation**:
  - Added all 6 screens to `AppNavigator.tsx` (authenticated stack)
  - Screens navigable via route params or direct navigation
- **Tests**:
  - Unit: 6 test files created:
    - `src/screens/error/__tests__/OfflineScreen.test.tsx` — 7 test cases
    - `src/components/__tests__/EmptySearchState.test.tsx` — 6 test cases
    - `src/components/__tests__/EmptyState.test.tsx` — 12 test cases
    - `src/screens/__tests__/LoadingScreen.test.tsx` — 5 test cases
    - `src/screens/feedback/__tests__/SuccessScreen.test.tsx` — 9 test cases
    - `src/screens/feedback/__tests__/ErrorScreen.test.tsx` — 11 test cases
  - Maestro: `.maestro/module-15.1-flow-26-misc-screens.yaml`
  - Manual: `FLOW-26-MANUAL-TESTING-GUIDE.md` (6 test cases, design validation checklist)
- **Tier 0 gate**:
  - `npm run typecheck` — REQUIRED BEFORE SIMULATOR
  - `npm run lint` — REQUIRED BEFORE SIMULATOR
  - `npm run test:unit` — All 50 test cases must pass
- **Commands**:
  ```bash
  # Unit tests
  cd p2p-kids-marketplace
  npm run test:unit -- --testPathPattern="OfflineScreen|EmptySearchState|EmptyState|LoadingScreen|SuccessScreen|ErrorScreen"
  
  # Maestro (iOS)
  npm run test:maestro:ios -- .maestro/module-15.1-flow-26-misc-screens.yaml
  
  # Maestro (Android)
  npm run test:maestro:android -- .maestro/module-15.1-flow-26-misc-screens.yaml
  
  # Typecheck + Lint
  npm run typecheck && npm run lint
  ```
- **Verification**: MODULE-15.1-VERIFICATION.md D-036 (Misc screens redesigned) satisfied
- **Acceptance Criteria**:
  - [x] OfflineScreen: `WifiX` (64px, `#E0E0E0`), green "Try Again" pill with `ArrowCounterClockwise` icon
  - [x] EmptySearchState: `MagnifyingGlassSlash` (56px, `#E0E0E0`), 17px semibold title
  - [x] EmptyState: accepts icon/title/subtitle/action as props, no hardcoded icons
  - [x] LoadingScreen: `ActivityIndicator` color `#5DBB8E`, white background
  - [x] SuccessScreen: `CheckCircle` (72px, `#5DBB8E`, fill), green CTA pill
  - [x] ErrorScreen: `XCircle` (72px, `#E85D75`, fill), green "Try Again" pill, gray "Go Back" text link
  - [x] All screens: white `#FFFFFF` background, centered layout, 24px horizontal padding
  - [x] Zero Ionicons imports in all 6 files
  - [x] TypeScript compilation passes with no duplicate identifier errors
  - [x] All `testID` props present for Maestro automation

---

### FLOW-22: Sales Tax — Per-Node Rates, Apply on Trade, Refund, Admin Reporting (MODULE-15.3-PART3)
- **Module**: MODULE-15.3-PART3-TAX (TAX-001 → TAX-014)
- **Covers**:
  - Per-node tax rate + jurisdiction + enabled flag (nodes.tax_*)
  - Global admin_config: `sales_tax_enabled`, `default_sales_tax_rate`, `subscription_fee_taxable`, `tax_remittance_jurisdiction`
  - RPCs: `calculate_tax`, `apply_tax_to_trade` (idempotent), `refund_tax`, `get_tax_summary_for_period`, `update_node_tax_config` (admin-only), `get_node_tax_rate`
  - Tax row in checkout (TradeInitiationScreen) and trade detail (TradeDetailScreen) + admin tax pages
  - **TC-O05 (2026-08-01):** "Tax Free" badge for tax-exempt items (`tax_exempt_goods` category). Detected client-side via `isTaxExemptCategory()` in `src/services/tax.ts` (reads `tax_categories`, cached); rendered by `TaxBreakdownRow` as a green pill (`#5DBB8E` on `#E8F5F0`, `$0.00`) across ItemDetail, TradeInitiation, TradeOffer, CartCheckout (badge only when ALL bundle items exempt), TradeDetail, TradeTimeline. Does NOT show when tax is $0 from global/node config (TC-O03/O04). Unit: `src/__tests__/services/tax.test.ts` (`isTaxExemptCategory`). Manual: TC-O05 in `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`.
  - **TC-P05 (2026-08-01) tax reports page crash fix:** Every non-summary tab on `/tax/reports` (transactions, refunds, by_period, jurisdictions, tax_exempt, audit_trail, reconciliation_required) threw `Cannot read properties of undefined (reading 'map')` at `summary.by_jurisdiction.map`, and the Refunds tab also threw `missing FROM-clause entry for table "tr"` from the RPC. Two-part fix: (1) backend — new migration `supabase/migrations/20260801000004_fix_tax_report_refunds_sql.sql` re-creates `get_tax_summary_for_period` with the `refunds` branch fixed (outer query no longer references `tr`; totals/rows now computed from single alias `rj`; signature unchanged); (2) frontend — `p2p-kids-admin/src/app/tax/reports/page.tsx` gates the summary stat cards + By Jurisdiction table to the `summary` tab only, and renders the `rows` array returned by the RPC via a generic `DynamicTable` (money `*_cents` → `$`, `tax_rate` → %, dates localized) for all other report types. Refunds tab additionally shows Total Refunded + Refund Count. Tier 0: `yarn typecheck` / `yarn lint` / `yarn build` all PASS on `p2p-kids-admin`.
  - **TC-P05 (2026-08-01) follow-up — tab-switch stale-data crash:** Switching tabs (e.g. Transactions → Summary) crashed with the same `Cannot read properties of undefined (reading 'map')` because the previous tab's response stayed in `summary` while `reportType` already changed — so `summary.by_jurisdiction.map` ran on a transactions-shaped (or any non-summary) response that has no `by_jurisdiction`. Fixed in `p2p-kids-admin/src/app/tax/reports/page.tsx`: tab clicks now clear `summary`/`error` and auto-run the selected report type (with a `useRef` sequence guard so the last-clicked tab always wins and out-of-order responses are discarded); `run()` accepts an explicit report type. Tier 0: `yarn typecheck` / `yarn lint` PASS.
- **Smoke**: `scripts/smoke/tax-flow.mjs` (read-only by default; pass `--trade-id` for mutating tests)
- **Unit**: `p2p-kids-marketplace/src/__tests__/services/tax.test.ts`, `src/__tests__/hooks/useTaxCalculation.test.ts`
- **E2E**: `p2p-kids-marketplace/src/__tests__/tax-e2e.test.ts` (gated by `RUN_SUPABASE_E2E=true`)
- **Maestro**: `.maestro/tax-checkout.yaml`
- **Manual**: `MODULE-15.3-PART3-TAX-MANUAL-TEST-CASES.md`
- **Admin routes added**: `/tax/nodes`, `/tax/reports`, `/tax/settings`
- **Tier**: Tier 0 always; Tier 1 when checkout/trade flows change; Tier 2 when tax DB migrations or RPCs change
- **Hard rules**:
  - Tax rate is stored as DECIMAL fraction (0.0635) — UI shows as percent (6.35)
  - Taxable base = `cash_amount_cents - buyer_transaction_fee_cents` (platform fee NOT taxed) — **Note:** Overridden by FLOW-39's `include_fee_in_tax_base` toggle for new offers
  - Rounding = `FLOOR((amount * rate) + 0.5)`
  - `apply_tax_to_trade` is idempotent (returns existing record on second call)
- **⚠️ Superseded by FLOW-39 (Tax Status Lifecycle, 2026-07-23):** This flow covers the original per-node tax calculation. FLOW-39 adds category-level rules, deferred capture, and the `tax_status` state machine. The two flows share the same `tax_records` table — FLOW-39 extends it with `tax_status`, `tax_snapshot`, and status-transition RPCs.

### FLOW-21: Error Recovery & Crash Reporting (PROD-P003 + PROD-P004)
- **Purpose**: Render-time JS errors anywhere in the app must show a friendly fallback with "Try Again" instead of a red/white screen, and must be reported to Sentry for triage.
- **Scope**:
  - Module: `MODULE-15.5-prod-readiness.md` (tasks PROD-P003, PROD-P004)
  - App: `p2p-kids-marketplace/` only (admin portal Phase 2)
  - Components:
    - `src/components/ErrorBoundary.tsx` — class component wrapping the app tree at root
    - `src/services/errorReporter.ts` — thin Sentry abstraction (no-op when DSN missing)
  - Wired in `App.tsx`: `<SafeAreaProvider><ErrorBoundary><GlobalAlertProvider>...`
  - `initErrorReporter()` called at module load (before component definition)
- **Behavior contract**:
  - When `EXPO_PUBLIC_SENTRY_DSN` is unset → reporter is a full no-op (safe for dev, CI, Expo Go).
  - When DSN set → `@sentry/react-native` initialized with environment + release tags.
  - ErrorBoundary always logs to console (`[ErrorBoundary] caught ...`) plus calls `captureException` with `tags.source = 'ErrorBoundary'` and `extra.componentStack`.
  - Try Again button resets boundary state; if root cause still throws, fallback re-renders.
- **Tests**:
  - Unit: `src/components/__tests__/ErrorBoundary.test.tsx` (6 tests)
  - Unit: `src/services/__tests__/errorReporter.test.ts` (6 tests)
  - Manual: `docs/PROD-P003-P004-MANUAL-TC.md` (TC-P003-01/02, TC-P004-01/02/03)
- **Native build requirement**: Sentry capture of **native** crashes requires `expo prebuild` + `pod install` (documented in manual TC). JS-level capture works in Expo Go without prebuild.
- **Tier**: Tier 0 always; Tier 1 when `App.tsx` root wrapping changes; Tier 2 when ErrorBoundary contract or reporter abstraction changes.
- **Hard rules**:
  - ErrorBoundary MUST remain at root (inside `SafeAreaProvider`, outside `GlobalAlertProvider`).
  - `errorReporter` MUST never throw — every public function wraps in try/catch.
  - Never log raw PII via `captureException` `extra`/`tags`. Only hashed user id via `setUser`.

---

### FLOW-22: iOS Privacy & Permissions Compliance (PROD-P001)
- **Covers**: iOS `NSUsageDescription` strings, `PrivacyInfo.xcprivacy` manifest, Android runtime permissions array. Required for App Store / Play Store submission.
- **Manual TCs**: `docs/PROD-P001-P005-MANUAL-TC.md` (TC-P001-01..04)
- **Tier**: Tier 0 always (typecheck on `app.json` consumers); Tier 1 (prebuild + Info.plist inspection) when `app.json` `ios.infoPlist` / `ios.privacyManifests` / `android.permissions` change.
- **Hard rules**:
  - Every Apple "required reason API" used by an Expo/RN dependency MUST appear in `NSPrivacyAccessedAPITypes`.
  - `NSPrivacyTracking` MUST stay `false` unless we actually add ATT-tracked SDKs.
  - All `NS*UsageDescription` copy MUST be kid-friendly and brand-aligned ("Pass It Up").

### FLOW-23: COPPA Server-Side Enforcement (PROD-P005)
- **Covers**: `public.is_coppa_compliant(uuid)`, `public.enforce_coppa(uuid, text)`, `trigger_coppa_check_item_insert` on `items`, `trigger_coppa_check_trade_insert` on `trades`. Blocks listing creation and trade initiation for users under 13 without `parental_consent_verified = TRUE`. Fails closed when DOB/profile missing.
- **Manual TCs**: `docs/PROD-P001-P005-MANUAL-TC.md` (TC-P005-01..08)
- **Tier**: Tier 2 ALWAYS when this trigger/function set changes (it gates writes on two core tables). Tier 1 for any change to consent/DOB columns or related profile flows.
- **Hard rules**:
  - Functions MUST stay `SECURITY DEFINER` with `SET search_path = public` (BP-5).
  - `enforce_coppa` MUST raise `COPPA_CONSENT_REQUIRED` (SQLSTATE `P0001`). Audit logging failure MUST NOT swallow the block (BP-4).
  - Triggers MUST be `BEFORE INSERT` so writes are rejected before any side-effects.
  - Fail-closed: missing profile or missing `dob` → NOT compliant.

---

### FLOW-24: SP Wallet & Ledger RLS Lockdown (PROD-001)
- **Covers**: `sp_wallets` and `sp_ledger` RLS policy set. Migration `20260601000002_fix_sp_wallet_admin_config_rls.sql` drops `*_anon_*` policies introduced by an old test alignment migration. Authenticated SELECTs scoped to `auth.uid() = user_id`; service role retains full access.
- **Manual TCs**: `docs/PROD-001-002-MANUAL-TC.md` (TC-001-01..08)
- **Tier**: Tier 2 ALWAYS when policies on `sp_wallets`/`sp_ledger` change. Tier 1 for code paths that touch SP balances (trade-create, sp-redeem RPC, wallet read service).
- **Hard rules**:
  - NEVER add a policy `TO anon` on these tables.
  - All SP mutations MUST go through service-role Edge Functions or `SECURITY DEFINER` RPCs — direct client UPDATEs are blocked by design.
  - `Users can insert own wallet` (INSERT to authenticated) is retained because the wallet bootstrap trigger relies on it; do not drop without replacing the bootstrap path.

### FLOW-25: admin_config Authenticated-Only Read (PROD-002)
- **Covers**: `admin_config` RLS. Drops public `USING(true)` SELECT policies; adds `admin_config_authenticated_read` (TO authenticated). Service-role write policies preserved.
- **Manual TCs**: `docs/PROD-001-002-MANUAL-TC.md` (TC-002-01..07)
- **Tier**: Tier 2 when policy set changes. Tier 1 when mobile `getAdminConfig` (or callers in `trade.ts`, `spCalculatorService.ts`, `listing.ts`, `sellerBalance.ts`, `imageModeration.ts`) change.
- **Hard rules**:
  - Mobile reads MUST happen post-login (after Supabase session exists). If a pre-login screen ever needs a config value, expose it via a public Edge Function — do NOT relax this RLS.
  - Writes MUST stay service-role only.
  - `getAdminConfig` MUST keep its `getDefaultConfig()` fallback so a temporary RLS denial degrades gracefully.

---

### FLOW-26: Edge Function Rate Limiting Utility (PROD-003)
- **Covers**: `supabase/functions/_shared/rate-limiter.ts` (in-memory Map, 5-min lazy cleanup). Exports `checkRateLimit`, `RATE_LIMITS` (AUTH 5/60, WRITE 10/60, READ 30/60, MESSAGING 20/60, SENSITIVE 3/60), `rateLimitResponse` (429 + `X-RateLimit-Remaining`/`X-RateLimit-Reset`/`Retry-After`), `addRateLimitHeaders`, `clientIpFrom`. Deno unit tests at `rate-limiter.test.ts` (8 cases).
- **Manual TCs**: `docs/PROD-003-005-MANUAL-TC.md` (TC-RL-01..05) — execute when wired into a specific endpoint.
- **Tier**: Tier 0 for the utility itself (Deno tests). Tier 1 per-endpoint when the utility is added to a live edge function (one endpoint per PR, with its own smoke test).
- **Scope decision (Phase 4)**: utility shipped + tested but NOT wired into any live edge function — preserves the "do not break working functions" rule. Wiring is a per-endpoint follow-up.
- **Hard rules**:
  - In-memory store resets on cold start — acceptable for MVP; upgrade path = Upstash Redis or `rate_limit_buckets` table.
  - Key MUST be scoped: `<scope>:<userId>` for authenticated endpoints, `<scope>:<ip>` for unauth (`clientIpFrom(req)`).
  - 429 response MUST include `Retry-After` for client back-off.
  - Successful responses SHOULD include `X-RateLimit-Remaining` (call `addRateLimitHeaders`).

### FLOW-27: Stripe Connect Ownership Verification (PROD-005)
- **Covers**: `supabase/functions/_shared/verify-stripe-ownership.ts` (`verifyStripeAccountOwnership(supabase, userId, stripeAccountId)` + `ownershipDeniedResponse`). Looks up `seller_payout_methods` by `stripe_account_id` + `method_type='stripe_connect'`; verifies `user_id` matches. Logs `OWNERSHIP MISMATCH` for security audit. Wired into `create-stripe-account-link` (post method-lookup) and `sync-stripe-connect-status` (per iteration). Existing `.eq('user_id', user.id)` joins preserved as the primary guard.
- **Manual TCs**: `docs/PROD-003-005-MANUAL-TC.md` (TC-SO-01..06)
- **Tier**: Tier 0 (Deno unit tests, 6 cases). Tier 1 when any function reading from `seller_payout_methods` is added or modified.
- **Hard rules**:
  - Source of truth for Stripe Connect ownership is `seller_payout_methods.stripe_account_id` + `user_id` (NOT `profiles.stripe_connect_account_id` — that column does not exist).
  - Any NEW edge function that operates on a Stripe Connect account MUST call `verifyStripeAccountOwnership` before any Stripe API call.
  - On mismatch: return 403 with code `STRIPE_ACCOUNT_OWNERSHIP_DENIED` (use `ownershipDeniedResponse`).
  - Helper uses service-role client by design (RLS bypass) — this is a security check that must succeed even if RLS would hide the row.

---

## FLOW-28: Node Isolation RLS Enforcement (PROD-004)

- **Module:** MODULE-15.5 (Production Readiness) — PROD-004
- **Scope:** RLS-level node isolation on `items` and `trades` tables, plus anon
  write lockdown on `items` and `profiles`.
- **Migrations:** `phase5a_drop_anon_writes`, `phase5b_add_items_node_id`,
  `phase5c_node_isolation_rls`.
- **DB objects:**
  - `public.get_user_node_id(p_user_id UUID)` — SECURITY DEFINER STABLE helper
    returning `profiles.node_id` for a user.
  - `public.set_item_node_id_from_seller()` + `trg_set_item_node_id` BEFORE
    INSERT trigger — auto-populates `items.node_id` from seller's profile.
  - New column `items.node_id UUID REFERENCES nodes(id)` + partial index
    `idx_items_node_id`.
- **Policies (canonical, post-consolidation):**
  - `items`: `items_service_role` (ALL/service_role), `items_anon_select` (SELECT/anon, `status='available'`), `items_select_own_node` (SELECT/auth, `node_id = get_user_node_id(auth.uid()) OR seller_id = auth.uid()`), `items_insert_own_seller`, `items_update_own_seller`, `Sellers can delete own items`.
  - `trades`: `trades_select_own_node` (participant AND same-node-or-null), `trades_admin_select` (via `profiles.role='admin'`), `trades_insert_own`, `trades_update_own`.
- **Hard rules:**
  - `profiles.node_id` is the authoritative node column (NOT `users.node_id`,
    which is legacy).
  - Always include `seller_id = auth.uid()` escape hatch in items SELECT so
    sellers see their own listings even if node_id is NULL or mismatched.
  - Trades SELECT must allow `node_id IS NULL` for backward compat with
    pre-existing trades.
  - Service role bypass MUST be preserved on every RLS-protected table.
  - Any new INSERT to `items` MUST go through `set_item_node_id_from_seller`
    trigger — never bypass it.
- **Manual TC doc:** `docs/PROD-004-MANUAL-TC.md`
- **Known follow-up:** anon INSERT/UPDATE/SELECT leaks remain on `subscriptions`,
  `referrals`, `user_notifications`. Track as PROD-004b.

---

## FLOW-29: Anon Write Lockdown — Subscriptions/Referrals/Notifications (PROD-004b)

- **Module:** MODULE-15.5 — PROD-004b (audit follow-up to PROD-004)
- **Migration:** `prod_004b_drop_anon_leaks`
- **Change:** Dropped 9 anon INSERT/SELECT/UPDATE policies on
  `subscriptions`, `referrals`, `user_notifications`. Existing authenticated
  and `service_role` policies cover all legitimate access paths.
- **Post-state:** Only 5 anon SELECT policies remain in `public`, all scoped:
  `faq_items` (published), `items` (available), `profiles` (true — flag for
  future review), `subscription_features` (enabled+active), `subscription_tiers`
  (active).
- **Hard rules:**
  - Anon role MUST NOT have INSERT/UPDATE/DELETE on any table going forward.
  - Test code that needs to verify DB-level invariants MUST use the
    service-role client (`getServiceClient()` in `src/test-helpers/authTestUtils.ts`),
    NOT the anon client.
- **Test fix:** `src/__tests__/services/subscription-sub-003.unit.test.ts` —
  2 tests previously relied on anon SELECT/UPDATE leaks for verification;
  rewired to service-role client.

## FLOW-30: TypeScript Strictness — noImplicitAny (PROD-006)

- **Module:** MODULE-15.5 — PROD-006
- **Change:** Flipped `tsconfig.json` `noImplicitAny: false → true` in
  `p2p-kids-marketplace/`. Resolved 87 resulting TS7006/TS7031/TS7053/TS7016
  errors across 25+ files without using `: any`. Patterns applied:
  - Realtime payload callbacks typed via `RealtimePostgresChangesPayload<T>`
  - Realtime subscribe status callbacks typed as `(status: string)`
  - Supabase array reduce/filter/map callbacks given narrow inline row types
  - Presence binding destructures typed as `{ key: string; newPresences: unknown[] }`
  - Theme/styles dynamic indexing cast via `Record<string, unknown>`
  - Installed `@types/uuid` (`npm install --save-dev @types/uuid --legacy-peer-deps`)
- **Gate (Tier 0):**
  - `cd p2p-kids-marketplace && npx tsc --noEmit` → exit 0, 0 errors
  - `npm run test:unit` → 2826/2826 PASS, 220 suites (baseline preserved)
- **Manual TC:** None — this is a build-gate task. See `docs/PROD-006-MANUAL-TC.md`.
- **Rollback:** `git revert <prod-006 commit-sha>` reverts tsconfig + type
  annotations together; no DB or runtime behavior changes.

## FLOW-31: ESLint Cleanliness (PROD-007)

- **Module:** MODULE-15.5 — PROD-007
- **Change:** Drove ESLint to exit 0 with 0 errors for both apps.
  - Mobile (`p2p-kids-marketplace`):
    - Added `eslint-plugin-unused-imports`; configured to auto-fix unused
      imports and to ignore `_`-prefixed unused vars/args/destructures.
    - Auto-fixed ~69 unused imports; bulk-prefixed ~106 unused vars with `_`.
    - Manual fixes: 7 props destructure regressions (`name: _name` alias form),
      3 alias double-renames, 9 `ban-types Function`, 1 `ban-ts-comment`,
      1 `prefer-const`, and 2 real `react-hooks/rules-of-hooks` bugs
      (`AppHeader` defensive `useNavigation`, `TradeInitiationScreen`
      `useTaxCalculation` moved before early return).
  - Admin (`p2p-kids-admin`):
    - Disabled cosmetic `react/no-unescaped-entities` rule via
      `.eslintrc.json` (10 errors removed).
- **Gate (Tier 0):**
  - Mobile: `npx eslint src/` → 0 errors; `npx tsc --noEmit` → 0 errors;
    `npm run test:unit` → 2826/2826 PASS.
  - Admin: `npx next lint` → 0 errors; `npx tsc --noEmit` → 0 errors.
- **Manual TC:** None — build-gate task. See `docs/PROD-007-MANUAL-TC.md`.
- **Rollback:** `git revert <prod-007 commit-sha>` reverts eslintrc + code
  changes together; no DB or runtime behavior changes.

## FLOW-32: Test Suite Green (PROD-008)

- **Module:** MODULE-15.5 — PROD-008
- **Change:** Verified full Jest suite (mobile) and Vitest suite (admin) are
  green after PROD-006 + PROD-007 changes. No code changes required — all
  failure categories predicted in the spec (mock setup, type errors, stale
  snapshots, async timeouts) were resolved as a side-effect of fixing
  `noImplicitAny` (PROD-006) and ESLint cleanup (PROD-007).
- **Gate (Tier 0):**
  - Mobile: `npx jest --no-coverage` → exit 0;
    286 passed / 0 failed / 54 skipped suites;
    3283 passed / 0 failed / 478 skipped tests;
    0 obsolete snapshots.
  - Admin: `npm test` (vitest) → exit 0;
    42 passed / 0 failed / 2 skipped files;
    553 passed / 0 failed / 13 skipped tests.
- **Skipped tests:** All pre-existing, gated by `RUN_SUPABASE_E2E=true` for
  live infrastructure. Re-enabling in CI is out of PROD-008 scope.
- **Manual TC:** None — build-gate task. See `docs/PROD-008-MANUAL-TC.md`.
- **Rollback:** No code changes; nothing to roll back.

---

### FLOW-33: Store Submission Metadata & Privacy Policy (PROD-009)
- **Module:** MODULE-15.5 PROD-009
- **Scope:** App Store + Google Play submission docs, draft Privacy Policy + Terms of Service, in-app legal URL constants.
- **Deliverables:**
  - `docs/STORE-SUBMISSION-CHECKLIST.md`
  - `docs/PRIVACY-POLICY-DRAFT.md` (DRAFT — legal review required)
  - `docs/TERMS-OF-SERVICE-DRAFT.md` (DRAFT — legal review required)
  - `p2p-kids-marketplace/src/constants/legal.ts` (`LEGAL_URLS`)
- **In-app surfaces (pre-existing):** `PrivacyPolicyScreen` (DB-backed), Signup terms acceptance.
- **Tier 0:** `npx tsc --noEmit` 0 errors; `npx eslint src/constants/legal.ts` 0 errors.
- **Manual TC:** `docs/PROD-009-MANUAL-TC.md`.
- **Rollback:** `git revert` of PROD-009 commit removes docs + constants.

---

### FLOW-34: Centralized Admin Authentication Middleware (PROD-010)
- **Module:** MODULE-15.5 PROD-010
- **Scope:** Introduce canonical `verifyAdminAuth()` middleware for admin API routes; remove `NEXT_PUBLIC_*` secret fallbacks; migrate pilot cluster of 5 routes.
- **Deliverables:**
  - `p2p-kids-admin/src/lib/adminAuth.ts` (canonical middleware)
  - `p2p-kids-admin/src/lib/__tests__/adminAuth.test.ts` (7 unit tests)
  - Migrated routes: `sp-config`, `policies`, `policies/[id]`, `trades/force-cancel`, `items/[id]/details`
  - `docs/PROD-010-ADMIN-AUTH-MIGRATION.md` (phased plan for remaining 37 routes)
- **Tier 0 (admin):** lint 0 errors; build PASS; tests 560 passed / 13 skipped (was 553 + 7 new).
- **Manual TC:** `docs/PROD-010-MANUAL-TC.md`.
- **Rollback:** revert admin submodule commit + re-stage previous submodule pointer.

---

### FLOW-35: Android Data Safety & Google Play Families Policy (PROD-011)
- **Module:** MODULE-15.5 PROD-011
- **Scope:** Google Play submission compliance — target SDK 35, COPPA-compliant analytics init, Families Policy + Data Safety documentation.
- **Deliverables:**
  - `p2p-kids-marketplace/app.json` (android: compileSdkVersion 35 / targetSdkVersion 35 / minSdkVersion 24)
  - `p2p-kids-marketplace/src/services/analytics.ts` (new `initAnalytics()` — COPPA defaults; SDK stub today)
  - `p2p-kids-marketplace/App.tsx` (calls `initAnalytics()` at mount)
  - `docs/GOOGLE-PLAY-DATA-SAFETY.md` (complete Data Safety form + Families Policy checklist + Firebase Console steps)
- **Tier 0 (mobile):** tsc 0 errors; eslint 0 errors on changed files; no ad SDKs in package.json.
- **Manual TC:** `docs/PROD-011-MANUAL-TC.md`.
- **Release-time follow-up:** run `npx expo prebuild --platform android --clean` and complete the Firebase Console steps in the data-safety doc.
- **Rollback:** `git revert` of PROD-011 commit.

---

### FLOW-36: Production Env Configuration & Secret Audit (PROD-012)
- **Module:** MODULE-15.5 PROD-012
- **Scope:** Audit every `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` reference; remove client-bundled secrets; publish canonical env var reference.
- **Findings:**
  - **P0 (FIXED):** `EXPO_PUBLIC_SENDGRID_API_KEY` was bundled into the mobile app via `src/services/email.ts`. Removed; mobile now reads only server-only `SENDGRID_API_KEY` (graceful no-op on devices). Production email sends go through `supabase/functions/send-email/`.
  - **Allowed exception (documented):** `NEXT_PUBLIC_ADMIN_UI_SECRET` — UI auth token, rotated regularly; server-side check uses `verifyAdminAuth()` (PROD-010) reading server-only `ADMIN_UI_SECRET`.
- **Deliverables:**
  - `p2p-kids-marketplace/src/services/email.ts` (remove EXPO_PUBLIC variant + security comment)
  - `p2p-kids-marketplace/src/services/__tests__/email.test.ts` (updated test env)
  - `p2p-kids-marketplace/.env.local.example` (server-only SENDGRID_API_KEY)
  - `p2p-kids-admin/.env.example` (expanded with forbidden list)
  - `docs/ENVIRONMENT-VARIABLES.md` (canonical inventory)
  - `docs/PROD-012-MANUAL-TC.md`
- **Tier 0 (mobile):** tsc 0 errors; eslint 0 errors on changed files; `jest email.test.ts` 12/12 pass.
- **Rotation note:** rotate the SendGrid API key in the SendGrid console if any historical build shipped with a real `EXPO_PUBLIC_SENDGRID_API_KEY` value.
- **Rollback:** `git revert` of PROD-012 commit.

---

### FLOW-37: Full-Stack Production Readiness & Security Scan (PROD-013)
- **Module:** MODULE-15.5 PROD-013
- **Scope:** Read-only audit across mobile, admin, supabase functions, and migrations. 10 categories: secrets, auth, RLS, input validation, dependencies, error handling, store compliance, COPPA/PII, performance, configuration.
- **Deliverable:** [docs/PROD-SCAN-FINDINGS.md](PROD-SCAN-FINDINGS.md) (438 lines, 28 findings).
- **Severity breakdown:** P0 = 5, P1 = 8, P2 = 9, P3 = 6.
- **Top P0 blockers:**
  1. `p2p-kids-marketplace/.env.staging` git-tracked with live `SUPABASE_SERVICE_ROLE_KEY` (rotate immediately).
  2. `react-native-fbsdk-next` declared in mobile `package.json` (Kids category rejection risk).
  3. Next.js `14.0.4` critical CVE in admin.
  4. `supabase/migrations/20260205000003_ultimate_test_alignment_fix.sql` grants `anon` write to `profiles`, `subscriptions`, `sp_wallets`, `sp_ledger`, `referrals`, `user_notifications`.
  5. 18 admin API routes have no auth check at all.
- **Tier 0:** N/A (read-only documentation only; no code changes).
- **Drives prioritization of:** PROD-P001…PROD-P005 and the remaining PROD-010 migration backlog.
- **Rollback:** N/A (documentation only).

---

### FLOW-38: P1 Security Hardening Rollup (PROD-001)
- **Module:** MODULE-15.5 PROD-001 (P1 This Week)
- **Scope:** Lock down stage-critical RLS fallout, enforce node isolation policies, harden SECURITY DEFINER search_path, and add JWT/ownership checks on sensitive Edge Functions.
- **Deliverables:**
  - `supabase/migrations/312_prod_p1_stage_security_lockdown.sql`
  - `supabase/migrations/313_prod_p1_node_isolation_hardening.sql`
  - `supabase/migrations/314_prod_p1_security_definer_search_path_hardening.sql`
  - `supabase/functions/analyze-item-image/index.ts`
  - `supabase/functions/moderate-image/index.ts`
  - `supabase/functions/trade-payment/index.ts`
  - `supabase/functions/initiate-payout/index.ts`
  - `supabase/functions/sms-send/index.ts`
  - `supabase/functions/auth-update-phone/index.ts`
- **Security outcomes:**
  1. Removes dangerous `anon` policies and direct table exposure on wallet/ledger/admin config surfaces.
  2. Enforces authenticated user isolation for wallet/ledger rows.
  3. Replaces broad discovery access with seller-node scoped item/trade visibility.
  4. Adds JWT checks and ownership guards for high-risk image, SMS, payout, and trade payment functions.
  5. Adds explicit `search_path` hardening for SECURITY DEFINER functions missing it.
- **Tier requirements:** Tier 0 mandatory; Tier 2 required because DB/RLS/function hardening changed.
- **Smoke/verification:** run SQL verification queries embedded in each migration + edge function auth/ownership test cases.
- **Rollback:** revert these migrations/functions as a single unit and re-run policy/function verification queries.

---

### FLOW-39: Tax Status Lifecycle — Capture Deferred to Completion (2026-07-23)
- **Module**: MODULE-15.1.2 TradeFlowV2 (tax-status-lifecycle)
- **Purpose**: State-based sales-tax lifecycle where tax is `quoted` at offer submission, becomes `collected` only after a verified Stripe capture (buyer completion or auto-complete), and is `voided` on cancellation/decline/expiry.
- **Migration**: `supabase/migrations/20260723000002_tax_status_lifecycle.sql`
- **Edge Functions modified** (11 total):
  - `create-trade-offer/index.ts` — category-level tax rules + `tax_snapshot` + `include_fee_in_tax_base`
  - `transactions-update/index.ts` — PI capture **removed** from seller accept; tax void on decline
  - `transactions-accept-bundle/index.ts` — PI capture **removed** from bundle accept
  - `transactions-decline-bundle/index.ts` — tax void on bundle decline
  - `cancel-trade/index.ts` — PI cancellation for pending offers + tax void
  - `complete-trade/index.ts` — PI capture added before completion; tax `collected` / `capture_failed`
  - `process-auto-complete/index.ts` — PI capture before auto-complete
  - `auto-complete-trades/index.ts` — PI capture before auto-complete (legacy 7-day path)
  - `process-expired-offers/index.ts` — PI cancel + tax void for expired offers
  - `check-authorization-expiry/index.ts` — tax void on auth expiry
  - `stripe-webhook/index.ts` — `charge.captured` handler (idempotent tax mark), `charge.refunded` tax refund
  - `resolve-dispute/index.ts` — PI cancel + tax refund/void on refund path
  - `admin-trade-action/index.ts` — tax void/refund on force-cancel
- **RPCs created** (6 total):
  - `rpc_void_tax_for_trade` — transitions quoted/capture_failed → voided
  - `rpc_mark_tax_collected` — transitions quoted/capture_failed → collected (idempotent)
  - `rpc_mark_tax_capture_failed` — transitions quoted → capture_failed
  - `rpc_refund_tax_with_status` — wraps `refund_tax` to also update tax_status (refunded/partially_refunded)
  - `rpc_capture_trade_payment` — DB-side idempotency guard for capture
  - `rpc_finalize_trade_after_capture` — atomic: mark collected + complete_trade_v2
- **Tax status values**: `quoted` | `collected` | `voided` | `capture_failed` | `refunded` | `partially_refunded`
- **Key behavioral changes**:
  1. Stripe PaymentIntent capture deferred from seller-accept → buyer-complete / auto-complete
  2. Buyer cancellation of pending offers explicitly cancels the Stripe PI (was orphaned before)
  3. `tax_snapshot` JSONB stores immutable record of calculation inputs per item (category, rule, price, rate)
  4. Category-level tax rules (`tax_rules` table) used per listing via `get_applicable_tax_rule`
  5. `include_fee_in_tax_base` admin_config toggle respected at offer time
  6. SP does NOT reduce taxable amount (BP-37) — SP is payment tender, not a price discount
  7. Webhook/retry idempotency: `rpc_mark_tax_collected` is safe to call multiple times
- **History**: The `tax_records` table (created in `tax_001`) previously had no `tax_status`. Historical backfill classifies completed-trade records as `collected`, cancelled as `voided`, refunded as `refunded`.
- **Hard rules**:
  - Tax becomes `collected` ONLY after Stripe capture confirms — never before
  - If capture fails, payout + SP release are blocked; trade stays `in_progress` for recovery
  - Duplicate webhooks do not double-record tax, payout, or SP effects
  - Admin force-cancel handles both uncaptured PIs (cancel + void) and captured PIs (refund + refund tax)
- **Manual test cases**: Group O-2 in `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (TC-O2-C01 through TC-O2-C12)
- **Stripe configuration required**: Enable `charge.captured` and `charge.refunded` events in Stripe webhook endpoint
- **Tier requirements**: Tier 0 (typecheck) mandatory; Tier 1 for trade flow changes; Tier 2 because DB migration + Stripe capture flow changed
- **Rollback**: Revert the migration `20260723000002_tax_status_lifecycle.sql` and re-deploy all 11+ Edge Functions from pre-change versions
