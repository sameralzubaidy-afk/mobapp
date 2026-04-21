# MODULE 03: AUTHENTICATION (V3 — Social Login, Account Linking, Deferred Phone Verification)

**Version:** 3.0 (Google + Facebook + Apple Social Auth + Smart Account Linking + Password Fallback + Deferred Phone Verification)
**Status:** Ready for Implementation
**Last Updated:** April 21, 2026
**Dependencies:** MODULE-03 V2 (Auth baseline: signup/login, trial activation, SP wallet init), MODULE-11 V2 (Subscription lifecycle), MODULE-06 V2 (Trade flow — gated by phone verification), MODULE-04 V3 (Listing creation — gated by phone verification)
**Target Release:** Week 7-8 (MVP Track 3 — parallel with Track 1 & Track 2)
**Traceability Source:** `POC1/ai-code-generator/modules/docx/SOCIAL-LOGIN-REQUIREMENTS.md` v1.0 (Apr 20, 2026)
**Secondary Sources:** `tmp/SYSTEM_REQUIREMENTS_V2.md`, `tmp/BUSINESS_REQUIREMENTS_DOCUMENT_V2.md`, `tmp/POC desgin.md`

---

## TASKS BREAKDOWN

| # | Task ID | Title | Duration | Priority |
|---|---------|-------|----------|----------|
| 1 | AUTH-V3-001 | Schema Migrations — Linked Providers View, Phone Verification Columns, Link RPC | 2h | Critical |
| 2 | AUTH-V3-002 | Shared Types & Error Classes (OAuth, Account, Phone, Password) | 1h | High |
| 3 | AUTH-V3-003 | Backend Service — OAuthService (initiate, callback, extract) + Provider Config | 4h | Critical |
| 4 | AUTH-V3-004 | Backend Service — AccountService (check / link / unlink / list providers) | 3h | Critical |
| 5 | AUTH-V3-005 | Backend Service — ProfileService (auto-fill + avatar download to Storage) | 2h | High |
| 6 | AUTH-V3-006 | Backend Service — PhoneService + PasswordService (OTP, deferred verification, password fallback) | 3h | High |
| 7 | AUTH-V3-007 | Mobile UI — SocialLoginButtons on Login + Signup Screens | 3h | High |
| 8 | AUTH-V3-008 | Mobile UI — LinkedAccountsScreen, AccountLinkingPrompt, PhoneVerificationModal + Transaction Gating | 5h | High |
| 9 | AUTH-V3-009 | Tests (Jest unit + PgTAP + Maestro + Manual OAuth E2E) | 4h | High |

**Total estimated effort:** ~27h. Tasks are listed in strict execution order; downstream tasks depend on earlier ones.

---

## KEY DESIGN NOTES (for reviewer)

- **Migration numbers 000011–000014** reserve the next block after MODULE-04/05/12 V3 (which consumed 000001–000010). Optional follow-ups if RLS blocks direct reads: `20260420000015_check_account_exists_rpc.sql`, `20260420000016_create_avatars_storage_bucket.sql`, `20260420000017_can_set_password_rpc.sql` — decided during AUTH-V3-004 / V3-005 / V3-006 implementation.
- **Apple button rendered on Android too** (parity). Apple Sign In is an App Store hard requirement when third-party sign-ins are offered; including it on Android keeps the UX symmetric with no downside.
- **Phone-verification modal is strictly non-dismissible** when triggered from `ItemCreate` (MODULE-04 V3) or `Checkout` (MODULE-06 V2) — dismissing cancels the originating action. When user-initiated from Settings it IS dismissible (no pending action to cancel).
- **Password re-auth required for linking** whenever the existing account has a password. For social-only accounts, linking requires first signing in via an already-linked provider (proof of account control). This closes the "attacker controls a matching provider email" takeover vector.
- **Twilio credentials live only in the Supabase Edge Function** (`send-phone-otp`) env vars — never in the mobile bundle. OTPs are 6-digit, bcrypt-hashed (pgcrypto), rate-limited server-side (3/phone/hour, 5/user/day), and expire in 5 minutes.
- **OAuth CSRF protection** via a 32-byte random `state` stored in `expo-secure-store` and verified on callback. Mismatches throw `OAuthStateMismatchError` and abort the flow.
- **Avatar pipeline NEVER blocks signup** — any failure (timeout > 5s, invalid type/size, upload error) returns `null` and logs a warning; profile falls back to a default avatar.
- **Email verification skipped** for OAuth identities (provider is trusted). Email verification is still required if the user later changes email on an account that has a password set.
- **Trial activation + SP wallet init + JWT enrichment** (MODULE-11 V2 + MODULE-03 V2 contracts) fire unchanged on the OAuth callback — V3 is additive.

---

## V3 OVERVIEW

This module **extends MODULE-03 V2** with production-grade social authentication, smart account linking, and a deferred phone-verification gate designed to maximize signup conversion while preserving trading safety. V3 introduces:

- **Google + Facebook + Apple Sign In** via Supabase Auth OAuth (Apple is an App Store hard requirement).
- **Auto-filled profiles** (name + avatar) sourced from the provider and uploaded to Supabase Storage.
- **Skipped email verification** for social signups (provider verification is trusted).
- **Smart account linking**: when a social sign-in email matches an existing account, prompt the user to link, with password verification to prevent account takeover.
- **Multi-method accounts**: a single account can have email+password plus any subset of {Google, Facebook, Apple} linked.
- **Settings → Linked Accounts**: link / unlink providers, with a guarantee that at least one login method always remains.
- **Password fallback**: social-only users can set a password later as a backup login method.
- **Deferred phone verification**: phone is **optional at signup** and **required only before the first listing or purchase** (gated via `isPhoneRequired`).

V3 is a **Track 3 feature** parallel to MODULE-04 V3 (Track 2) and MODULE-05 V3 (Track 1). It does **not** change the V2 trial-activation, SP-wallet-init, or subscription-aware JWT contracts — those continue to fire on the first sign-in regardless of provider.

---

## CHANGELOG FROM V2 → V3

### V2 Limitations (carried over from MODULE-03 V2)

- Social auth was scoped to "Apple/Google sign-in" at a conceptual level — no Facebook, no smart linking, no auto-fill avatar pipeline, no settings-side link/unlink UI.
- Email verification was required on every signup path — added friction to social signups.
- Phone was collected at signup and blocked the full onboarding wizard for users who weren't ready to share it.
- There was no way to consolidate duplicate accounts when a user arrived via a different provider with the same email.
- Social-only users had no password-recovery path if they lost provider access.

### V3 Enhancements

1. **New OAuth providers wired into Supabase Auth:** Google, Facebook, Apple (all three enabled in Supabase dashboard + native SDKs + URL schemes).
2. **New view:** `public.user_linked_providers` (friendly SELECT over `auth.identities`; `authenticated` grant only).
3. **New columns (non-breaking):**
   - `user_profiles.phone_verified_at TIMESTAMPTZ` (nullable).
   - `user_profiles.phone_verification_method TEXT CHECK (... IN ('sms','social_auto','manual'))`.
4. **New partial index:** `idx_user_profiles_phone_verified` on `phone_verified_at WHERE phone_verified_at IS NULL` (fast lookup of unverified users at transaction gate).
5. **New RPC:** `link_social_account(provider_name, provider_user_id, provider_email, provider_data)` — SECURITY DEFINER, verifies email match, writes `audit_log`.
6. **New services:**
   - `OAuthService` — `initiateSocialLogin`, `handleOAuthCallback`, `extractProviderProfile`.
   - `AccountService` — `checkAccountExists`, `linkSocialAccount`, `unlinkSocialAccount`, `getLinkedProviders`.
   - `ProfileService` — `autoFillProfile`, `downloadProviderAvatar`.
   - `PhoneService` — `isPhoneRequired`, `sendPhoneVerificationCode`, `verifyPhoneCode`.
   - `PasswordService` — `canSetPassword`, `setPasswordForSocialUser`, `validatePasswordStrength`.
7. **New mobile components:** `SocialLoginButtons` (Google/Facebook/Apple), `LinkedAccountsScreen`, `AccountLinkingPrompt` modal, `PhoneVerificationModal`, `SetPasswordModal`, `ProviderCard`.
8. **MODULE-04 V3 + MODULE-06 V2 hand-off:** Listing creation and checkout call `isPhoneRequired(userId)` and, if `true`, open `PhoneVerificationModal` inline (blocks the flow until verified).
9. **MODULE-03 V2 compatibility:** existing email+password signup and trial activation are unchanged; V3 flows reuse the same `activateTrialSubscription(userId)` hook.
10. **Email verification skipped** for OAuth identities (Supabase Auth already marks provider-authenticated users as verified).

---

## CRITICAL V3 RULES FOR AUTH MODULE

### Rule 1: OAuth State + CSRF Protection
- Every OAuth initiation MUST generate a cryptographically random `state` token, store it in secure session storage (`expo-secure-store` on mobile), and verify it on callback. A mismatched or missing `state` aborts the flow and returns `OAuthStateMismatchError`.
- Do NOT roll your own OAuth — use `supabase.auth.signInWithOAuth({ provider })`; Supabase handles token exchange and session creation.

### Rule 2: Account Linking Requires Password Verification
- When `checkAccountExists(email).exists === true` and the existing account has a password, the linking flow MUST require password re-authentication (`supabase.auth.signInWithPassword`) BEFORE calling `link_social_account`. This prevents account takeover if an attacker controls a provider email that matches a victim's account.
- If the existing account is social-only (no password), fall back to requiring the user to first sign in via an already-linked provider before linking the new one.

### Rule 3: At Least One Login Method Always Remains
- `unlinkSocialAccount(userId, provider)` MUST count remaining login methods first. If unlinking would leave `0` methods, throw `LastLoginMethodError` and do NOT mutate `auth.identities`.
- Login methods counted: any row in `auth.identities` for the user **plus** `auth.users.encrypted_password IS NOT NULL` (password counts as one method).

### Rule 4: Provider Email Match Is Required for Linking
- `link_social_account` RPC verifies `auth.users.email = provider_email` for `auth.uid()`. Mismatches throw `EmailMismatchError`. This is enforced in the RPC (SECURITY DEFINER) — clients cannot bypass it.

### Rule 5: Auto-Fill Profile Pipeline
- On first successful social signup, extract `{ name, email, avatar }` via `extractProviderProfile(provider, data)`.
- Avatar: `downloadProviderAvatar(url, userId)` fetches the image, validates it (jpeg/png, ≤ 2 MB, ≥ 100×100), uploads to `avatars/{user_id}/social_avatar.jpg` in Supabase Storage, and returns the public URL. On any failure (network, invalid image, timeout > 5s), fall back to a default avatar — NEVER block signup.
- Apple-specific: Apple does not provide a photo and returns `firstName/lastName` ONLY on the first authorization; persist those fields into `user_profiles` immediately — subsequent sign-ins will not return them.

### Rule 6: Skip Email Verification for OAuth Identities
- Social signups skip the V2 email-verification step entirely (the provider is trusted). Supabase Auth flags these users as email-verified automatically.
- Email-verification is STILL required when a user changes their email on an account that has a password set.

### Rule 7: Deferred Phone Verification Gate
- `isPhoneRequired(userId)` MUST be called immediately before:
  - `createItem` / bulk-create (MODULE-04 V3).
  - `initiateCheckout` / `acceptTrade` (MODULE-06 V2).
- If it returns `true`, the caller MUST open `PhoneVerificationModal` and block the flow until `verifyPhoneCode` succeeds. The calling screen MUST NOT allow a fallback "skip" for these actions.
- Once verified, set `user_profiles.phone_verified_at = now()` and `phone_verification_method = 'sms'`. Never ask again.

### Rule 8: Phone OTP Rate Limiting
- `sendPhoneVerificationCode(phone)` is rate-limited to **3 attempts per phone number per hour** and **5 attempts per user per day**. Enforce server-side in the RPC using a `phone_verification_codes` table with `attempts` + `created_at`.
- OTP codes expire after **5 minutes**. `verifyPhoneCode` returns `OTPExpiredError` if past expiry.
- Store OTP codes **hashed** (bcrypt or pgcrypto `crypt`), not plaintext.

### Rule 9: Password Strength (Social Fallback)
- `setPasswordForSocialUser` validates via `validatePasswordStrength`: minimum 8 chars, at least 1 letter + 1 digit. Reject common-password list (use HIBP-style k-anonymity API or an embedded blocklist of the top 100 passwords).
- Password creation uses `supabase.auth.updateUser({ password })` — NEVER write directly to `auth.users.encrypted_password`.

### Rule 10: Audit Logging
- Every `link` / `unlink` / `set-password` / `phone-verify` action writes one row to `public.audit_log` with `{ user_id, action, details jsonb, created_at }`.
- Never log secrets (OTP codes, passwords, OAuth tokens). The `details` payload may contain provider name and provider email only.

### Rule 11: Graceful Error Handling (Conversion Safety)
- Provider outages (503, timeout > 10s) MUST fall back to a user-visible "`<Provider>` is temporarily unavailable. Sign up with email instead?" message with an inline email-signup CTA — never a dead-end error screen.
- User-initiated OAuth cancellation (provider returns `access_denied`) MUST silently return to the previous screen — no error toast.

### Rule 12: Backward Compatibility
- V2 email+password signup, trial activation, and SP wallet init flows are **unchanged**. V3 OAuth signups call the SAME `activateTrialSubscription(userId)` hook after `supabase.auth.signInWithOAuth` succeeds.
- JWT enrichment (subscription status, can_spend_sp, available_points) continues to be applied on session refresh regardless of auth method.
- COPPA parental-consent flow from V2 still applies for users under 13 — the age-check gate runs AFTER profile auto-fill and BEFORE first transaction.

---

## AGENT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT IMPLEMENTING MODULE-03 AUTH V3 (SOCIAL LOGIN + DEFERRED PHONE).

CONTEXT:
- Kids P2P Marketplace. React Native (Expo) mobile app + Supabase backend.
- MODULE-03 V2 exists: email+password signup, trial activation, SP wallet init,
  COPPA age check, JWT enrichment. DO NOT change V2 flows — extend them.
- MODULE-11 V2 owns subscription lifecycle.
- MODULE-04 V3 and MODULE-06 V2 WILL call isPhoneRequired(userId) before first
  listing/checkout. Your job: implement that gate and the modal.
- Supabase Auth handles OAuth token exchange, session creation, and the
  auth.identities table. Do NOT re-implement those.
- Source of truth: POC1/ai-code-generator/modules/docx/SOCIAL-LOGIN-REQUIREMENTS.md v1.0.

YOUR INSTRUCTIONS:
1. Read the entire module before generating any code.
2. Produce a short plan (4-8 steps) and list any missing dependencies.
3. Implement tasks in the order AUTH-V3-001 … AUTH-V3-009.
4. For each task: generate files at the exact filepath given; run type-check
   and unit tests; do NOT commit.
5. Migration file numbering (reserve this block for MODULE-03 V3):
     20260420000011_create_user_linked_providers_view.sql
     20260420000012_add_phone_verification_tracking.sql
     20260420000013_link_social_account_rpc.sql
     20260420000014_create_phone_verification_codes.sql
   (Apply strictly in that order. Numbers 000001–000010 are reserved for
   MODULE-04 V3 / MODULE-05 V3 / MODULE-12 V3.)
6. NEVER write to auth.users.encrypted_password directly — always use
   supabase.auth.updateUser.
7. NEVER log OAuth tokens, OTP codes, or passwords.
8. Stop and report to the user before:
     - Running `supabase db push` on staging/prod.
     - Toggling OAuth providers in the Supabase dashboard.
     - Creating the avatars storage bucket if it doesn't already exist.

VERIFICATION STEPS (print results after each task):
- TypeScript type-check: `npm run type-check`.
- Lint: `npm run lint`.
- Unit tests: `npm test -- --testPathPattern=oauth|account|phone|password|profile`.
- Maestro flows: see AUTH-V3-009.

ERROR HANDLING:
- OAuth state mismatch: throw OAuthStateMismatchError.
- Account linking email mismatch: throw EmailMismatchError.
- Unlink last method: throw LastLoginMethodError.
- OTP expired: throw OTPExpiredError.
- OTP rate limited: throw OTPRateLimitError with retry_after_seconds.
- Weak password: throw WeakPasswordError with reason code.
- Avatar download failure: log + fall back to default (do NOT block signup).

==================================================
NEXT TASK: AUTH-V3-001 (Schema — Linked Providers View, Phone Verification Columns, Link RPC, OTP Table)
==================================================
*/
```

---

## TASK AUTH-V3-001: Schema Migrations — Linked Providers View, Phone Verification Columns, Link RPC, OTP Table

**Duration:** 2 hours
**Priority:** Critical (foundational — blocks all other V3 tasks)
**Dependencies:** MODULE-01 (`user_profiles`, `audit_log`), MODULE-03 V2 (Supabase Auth enabled)

### Description

Create the `user_linked_providers` view over `auth.identities`, add `phone_verified_at` + `phone_verification_method` columns to `user_profiles`, create the `link_social_account` SECURITY DEFINER RPC, and create the `phone_verification_codes` table with hashed OTP storage + rate-limit bookkeeping.

### Scope

**In scope:**
- 4 Supabase migrations (`20260420000011` – `20260420000014`) in strict order.
- View, columns, indexes, RLS, CHECK constraints, grants, comments.
- Commented verification queries at the bottom of each file.

**Out of scope:**
- Enabling OAuth providers in the Supabase dashboard (ops task — tracked in AUTH-V3-003 prereqs).
- Creating the `avatars` storage bucket (tracked in AUTH-V3-005 — assumed to already exist from MODULE-01; migration added only if missing).
- Any changes to `auth.users` or `auth.identities` schemas (Supabase-managed).

### Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/20260420000011_create_user_linked_providers_view.sql` | `public.user_linked_providers` view + GRANT SELECT to authenticated |
| `supabase/migrations/20260420000012_add_phone_verification_tracking.sql` | ALTER `user_profiles` + partial index + COMMENTs |
| `supabase/migrations/20260420000013_link_social_account_rpc.sql` | `link_social_account(text, text, text, jsonb)` SECURITY DEFINER RPC |
| `supabase/migrations/20260420000014_create_phone_verification_codes.sql` | `phone_verification_codes` table (hashed code, attempts, expires_at) + RLS + indexes |

### Acceptance Criteria

- [ ] Four migration files exist at the exact paths above.
- [ ] `public.user_linked_providers` view exposes `user_id, provider, provider_email, provider_name, provider_avatar, last_sign_in_at, created_at`, ordered by `(user_id, provider)`. `GRANT SELECT` to `authenticated` only.
- [ ] `user_profiles` has `phone_verified_at TIMESTAMPTZ` and `phone_verification_method TEXT CHECK (phone_verification_method IN ('sms','social_auto','manual'))`.
- [ ] Partial index `idx_user_profiles_phone_verified` on `phone_verified_at WHERE phone_verified_at IS NULL`.
- [ ] `link_social_account(provider_name TEXT, provider_user_id TEXT, provider_email TEXT, provider_data JSONB)` is `SECURITY DEFINER`, throws `EmailMismatchError` when `auth.users.email != provider_email` for `auth.uid()`, and writes an `audit_log` row on success.
- [ ] `phone_verification_codes` has `id UUID PK, user_id UUID FK, phone TEXT, code_hash TEXT, attempts INT DEFAULT 0, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ`, with RLS policy "user can read/write own rows".
- [ ] Indexes `idx_phone_verification_codes_user_expires (user_id, expires_at)` and `idx_phone_verification_codes_phone_created (phone, created_at)` exist (the latter supports the per-phone rate-limit check).
- [ ] All migrations idempotent (`CREATE OR REPLACE`, `IF NOT EXISTS`).
- [ ] Commented verification queries at the bottom of each file.

### AI Prompt for Cursor

````text
TASK: Generate 4 Supabase migrations for MODULE-03 V3.

CONTEXT:
- `user_profiles` and `audit_log` exist (MODULE-01).
- `auth.identities` is Supabase-managed; do NOT alter it.
- Migration numbers 000001..000010 are reserved for prior V3 modules.
  Use 000011..000014 exclusively.

FILE 1: 20260420000011_create_user_linked_providers_view.sql
- CREATE OR REPLACE VIEW public.user_linked_providers AS
    SELECT user_id, provider, identity_data->>'email' AS provider_email,
           identity_data->>'name' AS provider_name,
           identity_data->>'picture' AS provider_avatar,
           last_sign_in_at, created_at
    FROM auth.identities
    ORDER BY user_id, provider;
- GRANT SELECT ON public.user_linked_providers TO authenticated;
- COMMENT ON VIEW ...

FILE 2: 20260420000012_add_phone_verification_tracking.sql
- ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS phone_verification_method TEXT
      CHECK (phone_verification_method IN ('sms','social_auto','manual'));
- CREATE INDEX IF NOT EXISTS idx_user_profiles_phone_verified
    ON public.user_profiles(phone_verified_at)
    WHERE phone_verified_at IS NULL;
- COMMENT ON COLUMN ... for both columns.

FILE 3: 20260420000013_link_social_account_rpc.sql
- CREATE OR REPLACE FUNCTION public.link_social_account(
    provider_name TEXT, provider_user_id TEXT,
    provider_email TEXT, provider_data JSONB)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE v_user_email TEXT;
    BEGIN
      SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
      IF v_user_email IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
      IF LOWER(v_user_email) <> LOWER(provider_email) THEN
        RAISE EXCEPTION 'EmailMismatchError: % vs %', v_user_email, provider_email;
      END IF;
      INSERT INTO public.audit_log (user_id, action, details)
      VALUES (auth.uid(), 'link_social_account',
              jsonb_build_object('provider', provider_name, 'provider_email', provider_email));
    END; $$;
- REVOKE ALL ON FUNCTION ... FROM public;
- GRANT EXECUTE ON FUNCTION ... TO authenticated;
- COMMENT ON FUNCTION ...

FILE 4: 20260420000014_create_phone_verification_codes.sql
- CREATE TABLE IF NOT EXISTS public.phone_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL);
- ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
- CREATE POLICY "user owns codes" ON public.phone_verification_codes
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
- CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_user_expires
    ON public.phone_verification_codes(user_id, expires_at);
- CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_phone_created
    ON public.phone_verification_codes(phone, created_at);

OUTPUT 4 FILES, each starting with `--- FILE: <path> ---`.

VERIFICATION QUERIES at bottom of each file (commented):
- File 1: SELECT * FROM public.user_linked_providers LIMIT 1;
- File 2: SELECT column_name FROM information_schema.columns
          WHERE table_name='user_profiles' AND column_name LIKE 'phone_%';
- File 3: SELECT proname, prosecdef FROM pg_proc WHERE proname='link_social_account';
- File 4: SELECT COUNT(*) FROM pg_indexes WHERE tablename='phone_verification_codes';
````

---

## TASK AUTH-V3-002: Shared Types & Error Classes

**Duration:** 1 hour
**Priority:** High
**Dependencies:** AUTH-V3-001

### Description

Define the shared TypeScript types (`OAuthProvider`, `ProviderProfile`, `LinkedProvider`, `OAuthSession`, `AuthResult`, `PhoneVerificationCode`, `PasswordStrengthResult`) and typed error classes used across OAuth, Account, Profile, Phone, and Password services.

### Scope

**In scope:**
- 1 type file + 1 errors file under `p2p-kids-marketplace/src/types/`.
- Stable `code` strings on every error class.
- Strict TS — no `any`.

**Out of scope:**
- Service or component implementations.
- Runtime validation libraries (zod, yup) — use structural types only.

### Files

| Path | Purpose |
|---|---|
| `p2p-kids-marketplace/src/types/auth-v3.ts` | `OAuthProvider = 'google' \| 'facebook' \| 'apple'`, `ProviderProfile`, `LinkedProvider`, `OAuthSession`, `AuthResult`, `PhoneVerificationCode`, `PasswordStrengthResult` |
| `p2p-kids-marketplace/src/types/auth-v3-errors.ts` | `OAuthStateMismatchError`, `EmailMismatchError`, `LastLoginMethodError`, `OTPExpiredError`, `OTPRateLimitError`, `WeakPasswordError`, `AvatarDownloadError`, `ProviderUnavailableError` |

### Acceptance Criteria

- [ ] `OAuthProvider` is the union `'google' | 'facebook' | 'apple'` (no string escape hatch).
- [ ] `ProviderProfile` has `{ name: string; email: string; avatar?: string; provider: OAuthProvider; providerUserId: string }`.
- [ ] `LinkedProvider` has `{ provider: OAuthProvider; providerEmail: string; linkedAt: string }`.
- [ ] `PasswordStrengthResult` has `{ valid: boolean; reasons: string[] }` (never throws — value return).
- [ ] Every error class extends `Error`, carries a stable `code: string` field (e.g. `'OAUTH_STATE_MISMATCH'`), and, where applicable, typed metadata (`OTPRateLimitError.retryAfterSeconds: number`, `WeakPasswordError.reasons: string[]`).
- [ ] Strict TypeScript — no `any`, no `as unknown as`.

---

## TASK AUTH-V3-003: OAuthService + Provider Config

**Duration:** 4 hours
**Priority:** Critical
**Dependencies:** AUTH-V3-001, AUTH-V3-002

### Description

Implement `OAuthService` for Google, Facebook, and Apple: state-token generation, `supabase.auth.signInWithOAuth` initiation, callback handling, and provider-specific profile extraction. Wire Expo URL schemes, Apple's one-shot `firstName/lastName`, and Facebook's nested `picture.data.url`.

### Scope

**In scope:**
- 1 new service file + provider config constants.
- CSRF state via `expo-secure-store`.
- Provider-specific profile parsing (Google / Facebook / Apple).
- Graceful fallback on user cancel and provider outage.
- Expo deep-link wiring in `app.json` (documented — applied manually in ops).

**Out of scope:**
- UI buttons (AUTH-V3-007).
- Account linking logic (AUTH-V3-004).
- Avatar download (AUTH-V3-005).
- Native iOS/Android SDK installs beyond Expo config (tracked in the checklist).

### Files to Create / Modify

| Path | Action | Key Exports |
|---|---|---|
| `p2p-kids-marketplace/src/services/oauthService.ts` | NEW | `initiateSocialLogin`, `handleOAuthCallback`, `extractProviderProfile` |
| `p2p-kids-marketplace/src/services/oauthProviderConfig.ts` | NEW | Per-provider OAuth scopes + redirect URI constants |
| `p2p-kids-marketplace/app.json` | MODIFY | Add URL schemes + Apple/Facebook/Google SDK config (Expo) |

### Acceptance Criteria

- [ ] `initiateSocialLogin(provider)` generates a 32-byte random `state`, stores it in `expo-secure-store`, calls `supabase.auth.signInWithOAuth({ provider, options: { redirectTo, scopes, queryParams: { state } } })`, and returns `{ url, state }`.
- [ ] `handleOAuthCallback(code, state)` reads the stored `state`, throws `OAuthStateMismatchError` on mismatch, delegates token exchange to Supabase (`exchangeCodeForSession`), and returns `{ user, session, profile }`.
- [ ] `extractProviderProfile('google', data)` maps `given_name + family_name → name`, `picture → avatar`, `email → email`.
- [ ] `extractProviderProfile('facebook', data)` maps `name → name`, `picture.data.url → avatar`, `email → email`.
- [ ] `extractProviderProfile('apple', data)` maps `firstName + lastName → name` (persisted on FIRST sign-in only), `email → email`, `avatar → undefined`.
- [ ] User cancel (`access_denied`) returns `null` gracefully — no thrown error.
- [ ] Provider outage (timeout > 10s or 5xx) throws `ProviderUnavailableError` with `provider` field.
- [ ] Scopes: Google `openid email profile`; Facebook `email,public_profile`; Apple `name email`.
- [ ] `app.json` includes `scheme: 'kidsmarketplace'` and documents `expo-apple-authentication`, `@react-native-google-signin/google-signin`, and `react-native-fbsdk-next` native modules.

### AI Prompt for Cursor

````text
TASK: Implement OAuthService for MODULE-03 V3.

CONTEXT:
- Supabase Auth is enabled with Google, Facebook, Apple providers turned ON
  in the dashboard (ops task — assume done).
- Use `@supabase/supabase-js` v2's signInWithOAuth + exchangeCodeForSession.
- expo-secure-store is already a dependency (verify; if not, add it).
- redirectTo is `kidsmarketplace://auth/callback` on native and
  `https://<staging-domain>/auth/callback` on web.

HARD RULES:
- Never roll your own OAuth — always go through Supabase Auth.
- Always generate + verify a cryptographically random state token
  (use crypto.getRandomValues in a 32-byte Uint8Array → base64url).
- Apple's firstName/lastName only arrives on FIRST authorization; if
  extractProviderProfile receives an Apple payload without names on a
  second sign-in, return the names stored on the user row (look them up).
- Never log the `code` or session tokens.

Unit test file: p2p-kids-marketplace/src/__tests__/services/oauthService.test.ts
Cover all three provider payload shapes + state mismatch + user cancel.
````

---

## TASK AUTH-V3-004: AccountService (Check / Link / Unlink / List Providers)

**Duration:** 3 hours
**Priority:** Critical
**Dependencies:** AUTH-V3-001, AUTH-V3-002, AUTH-V3-003

### Description

Implement `AccountService`: `checkAccountExists(email)` for smart-linking decisions, `linkSocialAccount` with password re-authentication, `unlinkSocialAccount` with the last-method guard, and `getLinkedProviders` over `user_linked_providers`.

### Scope

**In scope:**
- 1 new service file.
- Password re-authentication before linking (`supabase.auth.signInWithPassword`).
- Last-method guard (count `auth.identities` + password presence).
- Calls to the `link_social_account` RPC for audit + email-match validation.
- Client-side call to `supabase.auth.unlinkIdentity` for unlink.

**Out of scope:**
- The linking/unlinking UI flow (AUTH-V3-008).
- Changing password (AUTH-V3-006).
- Admin-side account management.

### Files to Create

| Path | Key Exports |
|---|---|
| `p2p-kids-marketplace/src/services/accountService.ts` | `checkAccountExists`, `linkSocialAccount`, `unlinkSocialAccount`, `getLinkedProviders`, `countLoginMethods` |

### Acceptance Criteria

- [ ] `checkAccountExists(email)` returns `{ exists: boolean; userId?: string; providers?: OAuthProvider[]; hasPassword?: boolean }`. Uses an RPC or a Supabase query against `auth.users` + `user_linked_providers` (via a dedicated SECURITY DEFINER RPC if RLS blocks direct reads — if added, include it in AUTH-V3-001 as `20260420000015_check_account_exists_rpc.sql` and note the deferred migration).
- [ ] `linkSocialAccount(provider, providerProfile, passwordForReauth)` (a) re-authenticates via `signInWithPassword` (if the account has a password), (b) invokes `supabase.auth.linkIdentity({ provider })` through the signInWithOAuth flow, (c) calls `link_social_account` RPC, (d) returns the updated `LinkedProvider[]`.
- [ ] `unlinkSocialAccount(provider)` calls `countLoginMethods(userId)`; if `count <= 1` throws `LastLoginMethodError`. Otherwise calls `supabase.auth.unlinkIdentity(identity)` and writes an `audit_log` row via a shared helper.
- [ ] `getLinkedProviders()` SELECTs from `public.user_linked_providers WHERE user_id = auth.uid()` and returns `LinkedProvider[]` ordered by `linkedAt ASC`.
- [ ] `countLoginMethods(userId)` returns `identitiesCount + (hasPassword ? 1 : 0)`.
- [ ] All public methods propagate typed errors from AUTH-V3-002; none throw raw `Error`.
- [ ] Unit tests cover: existing-email prompt, password re-auth success/failure, last-method guard, audit-log write.

### AI Prompt for Cursor

````text
TASK: Implement AccountService.

HARD RULES:
- Never trust client-supplied userId — always derive from auth.uid().
- Password re-auth MUST succeed before linkIdentity; if the account has no
  password (social-only), fall back to requiring the user to first sign in
  via an already-linked provider (do NOT allow linking without proof of
  account control).
- Every link/unlink writes one audit_log row via a shared `writeAudit` helper.
- Never expose auth.users rows to the client — check-account-exists returns
  a boolean + minimal metadata only (provider list is OK; user_id is OK;
  do not return email, name, phone, etc.).
````

---

## TASK AUTH-V3-005: ProfileService — Auto-Fill + Avatar Download

**Duration:** 2 hours
**Priority:** High
**Dependencies:** AUTH-V3-003, AUTH-V3-004, MODULE-01 (`avatars` storage bucket)

### Description

Implement `autoFillProfile(providerProfile)` which writes `{ name }` into `user_profiles`, and `downloadProviderAvatar(url, userId)` which fetches the provider avatar, validates it, uploads to `avatars/{user_id}/social_avatar.jpg`, and returns the public URL.

### Scope

**In scope:**
- 1 new service file.
- Image validation (jpeg/png, ≤ 2 MB, ≥ 100×100, 5s timeout).
- Graceful fallback to default avatar on any failure.
- Supabase Storage upload + public URL generation.

**Out of scope:**
- Periodic avatar sync from provider (Phase 2).
- User-uploaded avatar editing UI.
- Creating the `avatars` bucket (assumed to exist from MODULE-01; if missing, create migration `20260420000016_create_avatars_storage_bucket.sql` and note it).

### Files to Create

| Path | Key Exports |
|---|---|
| `p2p-kids-marketplace/src/services/profileService.ts` | `autoFillProfile`, `downloadProviderAvatar` |

### Acceptance Criteria

- [ ] `autoFillProfile(profile)` UPSERTs `user_profiles` with `{ user_id: auth.uid(), display_name: profile.name, auto_filled_from_provider: true }` — never overwrites an already-set `display_name` unless the row is newly created.
- [ ] `downloadProviderAvatar(url, userId)` fetches with `AbortController` timeout = 5000ms, validates content-type (`image/jpeg` | `image/png`), size (≤ 2 MB) and dimensions (≥ 100×100 via a lightweight image-decoder like `expo-image-manipulator.getSize`).
- [ ] Upload path: `avatars/{userId}/social_avatar.{ext}`; `upsert: true`; returns `supabase.storage.from('avatars').getPublicUrl(...)`.
- [ ] Any failure (timeout, invalid type/size, upload error) returns `null` and logs via `console.warn` — NEVER throws (Rule 5: must not block signup).
- [ ] Apple payloads (no avatar URL) return `null` without attempting a fetch.
- [ ] Unit tests cover: happy path, timeout, invalid type, too-large, too-small, Apple (no URL).

---

## TASK AUTH-V3-006: PhoneService + PasswordService

**Duration:** 3 hours
**Priority:** High
**Dependencies:** AUTH-V3-001, AUTH-V3-002

### Description

Implement `PhoneService` (`isPhoneRequired`, `sendPhoneVerificationCode`, `verifyPhoneCode`) using Twilio SMS + the `phone_verification_codes` table with hashed OTPs and rate limiting, and `PasswordService` (`canSetPassword`, `setPasswordForSocialUser`, `validatePasswordStrength`) for the social-user password fallback.

### Scope

**In scope:**
- 2 new service files.
- Twilio SMS send via a Supabase Edge Function (`send-phone-otp`) to keep the Twilio secret off the client.
- OTP hashing via `pgcrypto` `crypt(code, gen_salt('bf'))`.
- Rate-limit checks (3 per phone per hour, 5 per user per day).
- Password-strength validation against a 100-entry common-passwords blocklist.

**Out of scope:**
- The phone-verification modal UI (AUTH-V3-008).
- Integration with MODULE-04 V3 / MODULE-06 V2 transaction gates (those modules call `isPhoneRequired`; this task only implements the function).
- 2FA or SMS-based login (post-MVP).

### Files to Create

| Path | Key Exports |
|---|---|
| `p2p-kids-marketplace/src/services/phoneService.ts` | `isPhoneRequired`, `sendPhoneVerificationCode`, `verifyPhoneCode` |
| `p2p-kids-marketplace/src/services/passwordService.ts` | `canSetPassword`, `setPasswordForSocialUser`, `validatePasswordStrength` |
| `supabase/functions/send-phone-otp/index.ts` | Edge Function: accepts `{ phone }`, rate-limits, generates 6-digit code, hashes, inserts into `phone_verification_codes`, sends SMS via Twilio |
| `p2p-kids-marketplace/src/data/common-passwords.ts` | Top-100 blocklist (static export) |

### Acceptance Criteria

- [ ] `isPhoneRequired(userId)` returns `true` iff `user_profiles.phone_verified_at IS NULL`.
- [ ] `sendPhoneVerificationCode(phone)` calls the `send-phone-otp` Edge Function; Edge Function enforces rate limits (3/phone/hour, 5/user/day) and throws `OTPRateLimitError` with `retryAfterSeconds`.
- [ ] `verifyPhoneCode(phone, code)` SELECTs the latest unexpired row for `(phone, auth.uid())`, compares via `crypt(code, code_hash) = code_hash`, increments `attempts`, throws `OTPExpiredError` or `Invalid` accordingly; on success UPDATEs `user_profiles.phone_verified_at = now(), phone_verification_method = 'sms'` and writes `audit_log`.
- [ ] OTP codes are 6 digits, generated with `crypto.getRandomValues`, hashed with bcrypt (`pgcrypto`).
- [ ] `canSetPassword(userId)` returns `true` iff `auth.users.encrypted_password IS NULL` for `userId` (checked via a SECURITY DEFINER RPC `can_set_password()`; include in AUTH-V3-001 migrations OR add `20260420000017_can_set_password_rpc.sql`).
- [ ] `setPasswordForSocialUser(newPassword)` validates strength, then calls `supabase.auth.updateUser({ password })` — NEVER writes directly to `auth.users`.
- [ ] `validatePasswordStrength(pw)` returns `{ valid, reasons[] }`: require `length >= 8`, at least one letter + digit, not in the common-passwords blocklist. Returns — never throws.
- [ ] Unit tests cover: rate-limit exceeded, expired OTP, invalid OTP, happy path, weak passwords (each reason), blocklist hit.

### AI Prompt for Cursor

````text
TASK: Implement PhoneService + PasswordService + send-phone-otp Edge Function.

HARD RULES:
- Twilio ACCOUNT SID and AUTH TOKEN live in Supabase Edge Function environment
  variables ONLY. Never ship them in the mobile bundle.
- OTP hashing uses pgcrypto's crypt()+gen_salt('bf'). Never store plaintext.
- Rate limit enforcement is SERVER-SIDE (in the Edge Function and in
  verifyPhoneCode SQL). The client may precheck but is not trusted.
- validatePasswordStrength uses the common-passwords.ts blocklist; if the
  password (lowercased) matches any entry, reject with reason 'COMMON_PASSWORD'.
````

---

## TASK AUTH-V3-007: Mobile UI — SocialLoginButtons on Login + Signup Screens

**Duration:** 3 hours
**Priority:** High
**Dependencies:** AUTH-V3-003, AUTH-V3-005

### Description

Build the `SocialLoginButtons` component (Google/Facebook/Apple per OS) and integrate it above the email/password form on both `LoginScreen` and `SignupScreen`. Handle the full OAuth flow: initiate → callback → auto-fill profile → navigate to home OR to `AccountLinkingPrompt`.

### Scope

**In scope:**
- 1 new component + updates to 2 existing screens.
- OS-conditional rendering (Apple button ONLY on iOS per Apple HIG, but ALSO required per guidelines when other third-party sign-ins are offered — include on both iOS and Android for App Store compliance).
- Loading state during OAuth flow.
- Error banner with email-fallback CTA.

**Out of scope:**
- Linked-accounts settings screen (AUTH-V3-008).
- Password fallback UI (AUTH-V3-008).
- Visual-regression tests.

### Files to Create / Modify

| Path | Action | Purpose |
|---|---|---|
| `p2p-kids-marketplace/src/components/auth/SocialLoginButtons.tsx` | NEW | 3 branded buttons + loading/error state |
| `p2p-kids-marketplace/src/components/auth/ProviderButton.tsx` | NEW | Single branded button (icon + label) |
| `p2p-kids-marketplace/src/screens/LoginScreen.tsx` | MODIFY | Mount `SocialLoginButtons` above form; handle success → home OR link prompt |
| `p2p-kids-marketplace/src/screens/SignupScreen.tsx` | MODIFY | Mount `SocialLoginButtons` above form; auto-fill profile on success |

### Acceptance Criteria

- [ ] `SocialLoginButtons` accepts `mode: 'signup' \| 'login'` and renders button text accordingly (`"Sign in with Google"` vs `"Continue with Google"`).
- [ ] All 3 providers render on both iOS and Android (Apple included on Android for parity).
- [ ] Tapping a button: sets `isLoading`, calls `oauthService.initiateSocialLogin(provider)`, awaits `handleOAuthCallback`, calls `profileService.autoFillProfile` on first signup, calls `accountService.checkAccountExists` to decide between home-navigation vs `AccountLinkingPrompt`.
- [ ] On `ProviderUnavailableError`: shows inline banner "`<Provider>` is temporarily unavailable. Sign up with email instead?" with a focus-safe CTA that scrolls to the email form.
- [ ] On user cancel: no error UI; button returns to idle.
- [ ] Each button has `accessibilityLabel="Sign in with <Provider>, button"`; loading state announces "Signing you in…".
- [ ] Branding: uses official Google / Facebook / Apple button assets and colors per each provider's brand guide (stored in `src/assets/brands/`).

---

## TASK AUTH-V3-008: Mobile UI — LinkedAccountsScreen, AccountLinkingPrompt, PhoneVerificationModal, Transaction Gating

**Duration:** 5 hours
**Priority:** High
**Dependencies:** AUTH-V3-004, AUTH-V3-006, AUTH-V3-007

### Description

Build the post-onboarding settings and gating UI: `LinkedAccountsScreen` (Settings → Account → Linked Accounts) with link/unlink + set-password, the `AccountLinkingPrompt` modal triggered from social login when email already exists, and the `PhoneVerificationModal` wired into MODULE-04 V3 listing and MODULE-06 V2 checkout as the first-transaction gate.

### Scope

**In scope:**
- 1 new screen + 3 new modals + 1 new shared component.
- Hooks for React Query data fetching + mutations.
- Transaction-gate wiring: `MODULE-04 V3 ItemCreateScreen` and `MODULE-06 V2 CheckoutScreen` each call `isPhoneRequired` and open the modal inline.

**Out of scope:**
- Admin-side user management.
- 2FA UI.
- Profile editing (beyond the auto-fill from AUTH-V3-005).

### Files to Create / Modify

| Path | Action | Purpose |
|---|---|---|
| `p2p-kids-marketplace/src/screens/settings/LinkedAccountsScreen.tsx` | NEW | Settings route showing email, password status, per-provider cards |
| `p2p-kids-marketplace/src/components/auth/ProviderCard.tsx` | NEW | Per-provider card (linked/unlinked state + action) |
| `p2p-kids-marketplace/src/components/auth/AccountLinkingPrompt.tsx` | NEW | Modal triggered during social login when email matches existing account |
| `p2p-kids-marketplace/src/components/auth/PhoneVerificationModal.tsx` | NEW | 2-step modal: enter phone → send code → enter code → verify |
| `p2p-kids-marketplace/src/components/auth/SetPasswordModal.tsx` | NEW | Password creation for social-only users |
| `p2p-kids-marketplace/src/hooks/useLinkedProviders.ts` | NEW | React Query list + link/unlink mutations |
| `p2p-kids-marketplace/src/hooks/usePhoneVerification.ts` | NEW | send/verify + rate-limit countdown state |
| `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` | MODIFY | Before publish: `await isPhoneRequired(userId); if (true) open modal + await result` |
| `p2p-kids-marketplace/src/screens/checkout/CheckoutScreen.tsx` | MODIFY | Before initiating checkout: same gate as above |

### Acceptance Criteria

- [ ] `LinkedAccountsScreen` renders email, password status ("Password set" / "No password set — Set Password"), and 3 `ProviderCard`s.
- [ ] Linking from Settings: tapping "Link" opens the OAuth flow; on success calls `linkSocialAccount`; card flips to linked state with provider email + `linkedAt`.
- [ ] Unlinking: tap "Unlink" → confirmation modal listing remaining methods → on confirm calls `unlinkSocialAccount`; `LastLoginMethodError` renders "You must keep at least one login method" toast and leaves the card unchanged.
- [ ] `AccountLinkingPrompt` re-authenticates with password (or, for social-only accounts, requires an already-linked provider sign-in) before calling `linkSocialAccount`. "Maybe Later" dismisses and returns the user to the login screen.
- [ ] `PhoneVerificationModal`: step 1 phone input with country-code picker + client-side E.164 formatting; step 2 six-digit auto-advancing code input; resend timer (60s); on success closes modal and resolves the pending action (listing create / checkout initiate).
- [ ] Transaction gating: `ItemCreateScreen.onSubmit` and `CheckoutScreen.onInitiateCheckout` BOTH `await isPhoneRequired(userId)` first and block via modal when `true`. There is NO "skip" affordance on the modal for these actions.
- [ ] `SetPasswordModal`: strength meter updates live via `validatePasswordStrength`; submit disabled until `valid === true`; on success shows toast "Password set" and closes.
- [ ] Full a11y: every modal traps focus, Esc closes (web) / swipe-down closes (mobile), focus returns to trigger; every input has a label; OTP field announces digit count.
- [ ] Coverage from AUTH-V3-009 tests exists for the happy path of every modal.

### AI Prompt for Cursor

````text
TASK: Build LinkedAccountsScreen + 4 modals + 2 hooks + wire transaction gates.

HARD RULES:
- Never call unlinkSocialAccount without a confirmation modal.
- Never let the user bypass PhoneVerificationModal via navigation when
  triggered from ItemCreate or Checkout — the modal must be `dismissible:false`
  in those contexts (dismissing = cancel the action).
- OTP input auto-advances digits and exposes one combined accessibility
  field summarizing "Code, 4 of 6 entered".

Test files will be generated in AUTH-V3-009.
````

---

## TASK AUTH-V3-009: Tests (Jest + PgTAP + Maestro + Manual OAuth E2E)

**Duration:** 4 hours
**Priority:** High
**Dependencies:** AUTH-V3-003 … AUTH-V3-008

### Description

Ship the full test package for MODULE-03 V3: Jest unit tests for all services, component tests for the modals, PgTAP DB tests for the RPC + OTP rate limit, Maestro flows for the 5 critical UX paths, and a manual E2E checklist for real Google / Facebook / Apple accounts on staging.

### Scope

**In scope:**
- 7 Jest suites.
- 1 PgTAP SQL file.
- 5 Maestro flows under `p2p-kids-marketplace/.maestro/`.
- Manual E2E checklist embedded in this module (ops runs against staging).
- Coverage target ≥ 85% for all V3 services.

**Out of scope:**
- Visual-regression snapshots.
- Load testing of Twilio SMS path.
- CI pipeline wiring (tracked separately).

### Test Files

| Path | Covers |
|---|---|
| `p2p-kids-marketplace/src/__tests__/services/oauthService.test.ts` | Google/Facebook/Apple payload parsing, state mismatch, user cancel, provider outage |
| `p2p-kids-marketplace/src/__tests__/services/accountService.test.ts` | checkAccountExists, link (re-auth success/fail), unlink (last-method guard), getLinkedProviders |
| `p2p-kids-marketplace/src/__tests__/services/profileService.test.ts` | autoFillProfile, downloadProviderAvatar (happy, timeout, invalid type/size, Apple) |
| `p2p-kids-marketplace/src/__tests__/services/phoneService.test.ts` | isPhoneRequired, send rate-limit, verify happy/expired/invalid |
| `p2p-kids-marketplace/src/__tests__/services/passwordService.test.ts` | canSetPassword, setPasswordForSocialUser, validatePasswordStrength (all reasons) |
| `p2p-kids-marketplace/src/__tests__/components/SocialLoginButtons.test.tsx` | Renders 3 buttons, loading state, cancel, error banner with fallback CTA |
| `p2p-kids-marketplace/src/__tests__/components/PhoneVerificationModal.test.tsx` | Step transitions, OTP auto-advance, resend countdown, success closes modal |
| `supabase/tests/auth_v3.sql` | PgTAP: link_social_account email mismatch → exception; OTP rate limit (3/phone/hour) enforced; unlink last method blocked |
| `p2p-kids-marketplace/.maestro/social-signup-google.yaml` | Maestro: Google signup happy path, profile auto-filled |
| `p2p-kids-marketplace/.maestro/account-linking.yaml` | Maestro: link prompt shown when email exists, password re-auth, link success |
| `p2p-kids-marketplace/.maestro/phone-verification-at-listing.yaml` | Maestro: new user blocked at first listing → verify → listing succeeds |
| `p2p-kids-marketplace/.maestro/link-unlink-settings.yaml` | Maestro: navigate to settings, link Facebook, unlink, see last-method guard |
| `p2p-kids-marketplace/.maestro/set-password-social-only.yaml` | Maestro: social-only user sets password, can now email-login |

### Acceptance Criteria

- [ ] All Jest tests pass; coverage ≥ 85% on `oauthService.ts`, `accountService.ts`, `profileService.ts`, `phoneService.ts`, `passwordService.ts`.
- [ ] PgTAP tests pass (`supabase test db`):
  - Call `link_social_account` with mismatched email → exception.
  - 4th OTP send for same phone within 60min → rate-limit exception.
  - Unlink last identity with no password → exception.
- [ ] All 5 Maestro flows pass on a staging build (iOS + Android).
- [ ] Manual OAuth E2E (staging, real Google / Facebook / Apple test accounts) documented in the PR with screenshots per provider.
- [ ] No OTP code, provider token, or password ever appears in test logs or test snapshots.

---

## CROSS-TRACK INTEGRATION NOTES

- **MODULE-04 V3 (Item Listing — Track 2):** `ItemCreateScreen.onSubmit` MUST `await isPhoneRequired(userId)` FIRST and open `PhoneVerificationModal` (dismiss = cancel listing). This is the single point where seller phone verification is enforced. No other V3 module should re-check phone for listing.
- **MODULE-06 V2 (Trade Flow):** `CheckoutScreen.onInitiateCheckout` and `acceptTrade` MUST call the same gate. Checkout must not proceed until phone is verified.
- **MODULE-11 V2 (Subscriptions):** Trial activation runs unchanged on social signup — hook `activateTrialSubscription(userId)` is invoked by the OAuth callback handler after successful session creation.
- **MODULE-12 V2 (Admin):** Admin accounts are created via the existing V2 `user_roles` flow and are NOT eligible for social-only signup (admin role must be granted server-side; social signup creates a standard user). No V3 changes required in the admin portal.
- **MODULE-14 (Notifications):** Phone verification completion triggers a MODULE-14 welcome notification via the existing `enqueueNotification(userId, 'phone_verified')` — no new notification type defined here.
- **COPPA (MODULE-03 V2):** Under-13 age check still applies; it runs AFTER social profile auto-fill and BEFORE the first transaction, at which point parental consent must also be recorded.

---

## OUT OF SCOPE (Post-MVP)

- SMS/Phone passwordless login (different auth flow — Phase 2).
- Biometric login (Touch ID / Face ID — requires device permission wiring).
- 2FA for high-value accounts.
- Social profile sync (auto-update avatar when changed on provider).
- LinkedIn / Twitter / TikTok providers.
- Cross-device session management + login history.
- OAuth token refresh handling (Supabase Auth already manages this).
- Admin-side bulk identity management.

---

## IMPLEMENTATION CHECKLIST (high-level)

- [ ] AUTH-V3-001 — schema migrations (view, phone columns, RPC, OTP table)
- [ ] AUTH-V3-002 — shared types + error classes
- [ ] AUTH-V3-003 — OAuthService + provider config + Expo deep-link wiring
- [ ] AUTH-V3-004 — AccountService (check / link / unlink / list)
- [ ] AUTH-V3-005 — ProfileService (auto-fill + avatar download)
- [ ] AUTH-V3-006 — PhoneService + PasswordService + send-phone-otp Edge Function
- [ ] AUTH-V3-007 — SocialLoginButtons on Login + Signup
- [ ] AUTH-V3-008 — LinkedAccountsScreen + 4 modals + transaction gating
- [ ] AUTH-V3-009 — tests (Jest + PgTAP + Maestro + manual OAuth E2E)
- [ ] Enable Google / Facebook / Apple providers in Supabase dashboard (staging + prod)
- [ ] Register OAuth apps with Google Cloud / Meta / Apple Developer + set redirect URIs
- [ ] Store Twilio ACCOUNT_SID + AUTH_TOKEN in Edge Function env vars (staging + prod)
- [ ] Verify `avatars` storage bucket exists with public read + auth-write RLS
- [ ] Manual QA with keyboard + screen reader on LoginScreen, SignupScreen, LinkedAccountsScreen, PhoneVerificationModal
- [ ] Update `PROMPTS_USAGE_GUIDE.md` with a pointer to this module

---

*Document version: 1.0 | Generated from SOCIAL-LOGIN-REQUIREMENTS.md v1.0 | Cross-refs: SYSTEM_REQUIREMENTS_V2.md, BUSINESS_REQUIREMENTS_DOCUMENT_V2.md, POC desgin.md | Next review: after Track 3 implementation*
