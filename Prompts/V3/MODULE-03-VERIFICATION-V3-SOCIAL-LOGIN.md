# VERIFICATION — MODULE 03 AUTH V3 (Social Login, Account Linking, Deferred Phone Verification)

**Pairs with:** `MODULE-03-AUTH-V3-SOCIAL-LOGIN.md` v1.0
**Version:** 1.0
**Last Updated:** April 21, 2026
**Traceability Source:** `POC1/ai-code-generator/modules/docx/SOCIAL-LOGIN-REQUIREMENTS.md` v1.0

This document is the acceptance gate for MODULE-03 V3. Every section below MUST pass before the module is considered shipped. Each check is either (a) a SQL query with an expected result, (b) a shell command with expected exit 0, or (c) a manual observation with a clear pass/fail condition.

---

## 0. Prerequisites

| # | Check | Expected | Command / Query |
|---|---|---|---|
| 0.1 | Supabase Auth providers enabled | `google`, `facebook`, `apple` all `enabled: true` | Supabase Dashboard → Authentication → Providers |
| 0.2 | Twilio credentials present in Edge Function env | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` set on `send-phone-otp` | `supabase functions list-secrets send-phone-otp` |
| 0.3 | `avatars` storage bucket exists | one row, `public = true` | `SELECT id, public FROM storage.buckets WHERE id='avatars';` |
| 0.4 | `audit_log` table exists | exists | `SELECT to_regclass('public.audit_log') IS NOT NULL;` |

---

## 1. Schema (AUTH-V3-001)

### 1.1 Migration files present at the exact reserved paths

```bash
ls -1 supabase/migrations/20260420000011_create_user_linked_providers_view.sql \
       supabase/migrations/20260420000012_add_phone_verification_tracking.sql \
       supabase/migrations/20260420000013_link_social_account_rpc.sql \
       supabase/migrations/20260420000014_create_phone_verification_codes.sql
```

**Expected:** all 4 paths print; exit 0.

### 1.2 View `user_linked_providers`

```sql
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'user_linked_providers' AND grantee = 'authenticated';
```

**Expected:** exactly one row, `privilege_type = 'SELECT'`.

### 1.3 `user_profiles` has phone columns

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('phone_verified_at', 'phone_verification_method')
ORDER BY column_name;
```

**Expected:** 2 rows; types `timestamp with time zone` and `text`.

### 1.4 Partial index for unverified-phone lookups

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'user_profiles' AND indexname = 'idx_user_profiles_phone_verified';
```

**Expected:** 1 row; `indexdef` contains `WHERE (phone_verified_at IS NULL)`.

### 1.5 `link_social_account` RPC

```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'link_social_account';
```

**Expected:** 1 row; `prosecdef = true`.

### 1.6 `phone_verification_codes` table + RLS + indexes

```sql
-- Table columns
SELECT column_name FROM information_schema.columns
WHERE table_name='phone_verification_codes' ORDER BY ordinal_position;
-- Expected: id, user_id, phone, code_hash, attempts, created_at, expires_at

-- RLS enabled
SELECT relrowsecurity FROM pg_class WHERE relname='phone_verification_codes';
-- Expected: t

-- Indexes
SELECT indexname FROM pg_indexes WHERE tablename='phone_verification_codes' ORDER BY indexname;
-- Expected includes: idx_phone_verification_codes_phone_created,
--                    idx_phone_verification_codes_user_expires
```

### 1.7 RPC email-match guard (smoke via PgTAP — see § 9)

Covered in `supabase/tests/auth_v3.sql`.

---

## 2. Shared Types (AUTH-V3-002)

| # | Check | Expected |
|---|---|---|
| 2.1 | `p2p-kids-marketplace/src/types/auth-v3.ts` exists | file present |
| 2.2 | `p2p-kids-marketplace/src/types/auth-v3-errors.ts` exists | file present |
| 2.3 | `tsc --noEmit` passes | exit 0 |
| 2.4 | `grep -n "any" src/types/auth-v3*.ts` | no matches |
| 2.5 | Every error class has a stable `code` field | inspect file — each `extends Error` has `code: string = '…'` |

```bash
npm run type-check
```

---

## 3. OAuthService (AUTH-V3-003)

### 3.1 Unit tests pass

```bash
npm test -- --testPathPattern=oauthService
```

**Expected:** all suites green; coverage ≥ 85% for `oauthService.ts`.

### 3.2 State-token CSRF protection

Manual: set a breakpoint in `handleOAuthCallback`, call it with a `state` that does not match the stored value, observe `OAuthStateMismatchError` thrown and no session created.

### 3.3 Provider payload parsing matrix

| Input | Expected extraction |
|---|---|
| Google `{ given_name: 'John', family_name: 'Doe', picture: 'https://…', email: 'john@x.com' }` | `{ name: 'John Doe', avatar: 'https://…', email: 'john@x.com', provider: 'google' }` |
| Facebook `{ name: 'Jane Doe', picture: { data: { url: 'https://…' } }, email: 'jane@x.com' }` | `{ name: 'Jane Doe', avatar: 'https://…', email: 'jane@x.com', provider: 'facebook' }` |
| Apple first sign-in `{ firstName: 'Sam', lastName: 'Lee', email: 'sam@x.com' }` | `{ name: 'Sam Lee', avatar: undefined, email: 'sam@x.com', provider: 'apple' }` |
| Apple 2nd sign-in (no names) | `name` falls back to stored `user_profiles.display_name` |

Covered by `oauthService.test.ts`.

### 3.4 Expo URL scheme registered

```bash
jq -r '.expo.scheme' p2p-kids-marketplace/app.json
```

**Expected:** `kidsmarketplace`.

---

## 4. AccountService (AUTH-V3-004)

### 4.1 Unit tests pass

```bash
npm test -- --testPathPattern=accountService
```

**Expected:** green; coverage ≥ 85%.

### 4.2 Last-login-method guard (behavioral)

| Setup | Action | Expected |
|---|---|---|
| User has `password + google` | `unlinkSocialAccount('google')` | success; password remains |
| User has `google` only | `unlinkSocialAccount('google')` | throws `LastLoginMethodError`; identity unchanged |
| User has `google + apple`, no password | `unlinkSocialAccount('google')` | success; apple remains |
| User has `apple` only, no password | `unlinkSocialAccount('apple')` | throws `LastLoginMethodError` |

### 4.3 Link requires password re-auth (for password-bearing accounts)

Attempt `linkSocialAccount` without first calling `supabase.auth.signInWithPassword` → operation rejected client-side before any RPC call.

### 4.4 `audit_log` written on every link + unlink

```sql
SELECT action, COUNT(*) FROM audit_log
WHERE action IN ('link_social_account', 'unlink_social_account')
  AND created_at > now() - interval '1 hour'
GROUP BY action;
```

**Expected:** matches the number of link/unlink actions performed during test run.

---

## 5. ProfileService (AUTH-V3-005)

### 5.1 Unit tests pass

```bash
npm test -- --testPathPattern=profileService
```

**Expected:** green; coverage ≥ 85%.

### 5.2 Avatar pipeline matrix

| Scenario | Expected outcome |
|---|---|
| 50 KB 300×300 JPEG | Uploaded; public URL returned |
| 3 MB JPEG (> 2 MB) | `null` returned; `console.warn` logged; signup NOT blocked |
| 50×50 PNG (too small) | `null` returned; signup NOT blocked |
| Fetch times out (> 5 s) | `null` returned; signup NOT blocked |
| Apple payload (no URL) | `null` returned; no fetch attempted |

### 5.3 Upload destination

```sql
SELECT name FROM storage.objects
WHERE bucket_id = 'avatars' AND name LIKE '%/social_avatar.%'
LIMIT 5;
```

**Expected:** paths shaped `{user_id}/social_avatar.{jpg|png}`.

### 5.4 `user_profiles.display_name` NOT overwritten on re-signin

Manual: sign in via Google, edit display name to "Custom"; sign out; sign in again with Google. Display name remains "Custom".

---

## 6. PhoneService + PasswordService (AUTH-V3-006)

### 6.1 Unit tests pass

```bash
npm test -- --testPathPattern=phoneService
npm test -- --testPathPattern=passwordService
```

**Expected:** green; coverage ≥ 85% on both.

### 6.2 OTP rate limits (server-side)

| Scenario | Expected |
|---|---|
| 3rd `sendPhoneVerificationCode` for same phone within 60 min | success |
| 4th within 60 min | throws `OTPRateLimitError` with `retryAfterSeconds > 0` |
| 6th `send` for same `user_id` within 24 h | throws `OTPRateLimitError` |

### 6.3 OTP hashing

```sql
SELECT code_hash FROM phone_verification_codes ORDER BY created_at DESC LIMIT 5;
```

**Expected:** hashes look like `$2a$…` / `$2b$…` (bcrypt). NO 6-digit plaintext.

### 6.4 `isPhoneRequired` semantics

| Setup | `isPhoneRequired(uid)` returns |
|---|---|
| `phone_verified_at IS NULL` | `true` |
| `phone_verified_at` set | `false` |

### 6.5 Password strength

| Password | Expected `validatePasswordStrength` |
|---|---|
| `abc12` | `{ valid:false, reasons: ['TOO_SHORT'] }` |
| `abcdefgh` | `{ valid:false, reasons: ['MISSING_DIGIT'] }` |
| `12345678` | `{ valid:false, reasons: ['MISSING_LETTER', 'COMMON_PASSWORD'] }` |
| `password1` | `{ valid:false, reasons: ['COMMON_PASSWORD'] }` |
| `Str0ngP@ss` | `{ valid:true, reasons: [] }` |

### 6.6 Password write path

`setPasswordForSocialUser` calls `supabase.auth.updateUser({ password })`. It MUST NOT issue any SQL that touches `auth.users.encrypted_password` directly. Verify with:

```bash
grep -RIn "encrypted_password" p2p-kids-marketplace/src/services/
```

**Expected:** no matches.

---

## 7. Mobile UI — Login + Signup (AUTH-V3-007)

### 7.1 Component tests pass

```bash
npm test -- --testPathPattern=SocialLoginButtons
```

**Expected:** green.

### 7.2 OS rendering matrix

| Platform | Buttons rendered |
|---|---|
| iOS | Google ✓, Facebook ✓, Apple ✓ |
| Android | Google ✓, Facebook ✓, Apple ✓ (parity) |
| Web (if built) | Google ✓, Facebook ✓, Apple ✓ |

### 7.3 User-cancel silent

Tap Google → dismiss provider modal → return to login screen. No error toast, no error banner, button idle.

### 7.4 Provider outage banner

Mock provider 503 in test harness → inline banner reads "`Google` is temporarily unavailable. Sign up with email instead?" with CTA that focuses the email input.

### 7.5 Accessibility

VoiceOver / TalkBack reads each button as `"Sign in with <Provider>, button"`. Loading state announces `"Signing you in…"`.

---

## 8. Mobile UI — Settings, Prompts, Modals, Transaction Gates (AUTH-V3-008)

### 8.1 Component tests pass

```bash
npm test -- --testPathPattern=PhoneVerificationModal
npm test -- --testPathPattern=LinkedAccountsScreen
```

**Expected:** green.

### 8.2 LinkedAccountsScreen states

| Setup | Rendered UI |
|---|---|
| Email+password only | 3 ProviderCards all "Not linked, Link"; "Password ✓ set" |
| Email+password + Google linked | Google card "Linked, john@gmail.com, Unlink"; others "Link" |
| Google only (no password) | Google card "Linked, Unlink (disabled when it would leave 0 methods)"; "No password set — Set Password" button visible |

### 8.3 AccountLinkingPrompt

- Triggered ONLY when `checkAccountExists(email).exists === true` after an OAuth sign-in attempt.
- Cancel path returns to the login screen with no state change.
- "Link Account" path requires password re-auth (or already-linked provider for social-only accounts) before calling `linkSocialAccount`.

### 8.4 PhoneVerificationModal — non-dismissible in transaction contexts

| Caller | Dismiss behavior |
|---|---|
| `ItemCreateScreen.onSubmit` | Dismissing the modal cancels the listing action (no publish happens). |
| `CheckoutScreen.onInitiateCheckout` | Dismissing cancels the checkout. |
| Settings (user-initiated) | Dismiss simply closes the modal — no pending action. |

### 8.5 Transaction gating wiring

```bash
grep -n "isPhoneRequired" p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx \
                          p2p-kids-marketplace/src/screens/checkout/CheckoutScreen.tsx
```

**Expected:** both files show a call to `isPhoneRequired` **before** their primary action.

### 8.6 Last-method-guard UI

Attempt to unlink the only remaining method → toast `"You must keep at least one login method"`, card state unchanged.

### 8.7 SetPasswordModal strength meter

Typing `pas` → meter red, submit disabled; `password1` → meter red `COMMON_PASSWORD`; `Str0ngP@ss` → meter green, submit enabled.

### 8.8 Accessibility

- Every modal traps focus; Esc/swipe-down closes (where allowed).
- OTP input announces `"Code, N of 6 entered"` on each digit.
- ProviderCard action button has `accessibilityLabel` reflecting current state (`"Unlink Google, linked to john@gmail.com"`).

---

## 9. DB-Level Tests (AUTH-V3-009 — PgTAP)

```bash
supabase test db --file supabase/tests/auth_v3.sql
```

**Expected all assertions pass:**

1. `link_social_account` with `auth.uid()` email ≠ `provider_email` → SQLSTATE error.
2. 4th `INSERT` into `phone_verification_codes` for same `phone` within 1 hour → rate-limit exception (enforced either in the Edge Function or a SQL guard referenced by the test).
3. `unlinkSocialAccount` semantics: simulate last remaining identity and assert `LastLoginMethodError` is surfaced (exercised via service test since `auth.identities` is Supabase-managed).
4. `idx_user_profiles_phone_verified` is used by EXPLAIN when SELECTing unverified users.

---

## 10. E2E (Maestro — AUTH-V3-009)

Run on a staging build (both iOS and Android):

```bash
maestro test p2p-kids-marketplace/.maestro/social-signup-google.yaml
maestro test p2p-kids-marketplace/.maestro/account-linking.yaml
maestro test p2p-kids-marketplace/.maestro/phone-verification-at-listing.yaml
maestro test p2p-kids-marketplace/.maestro/link-unlink-settings.yaml
maestro test p2p-kids-marketplace/.maestro/set-password-social-only.yaml
```

**Expected:** all 5 flows pass on both platforms.

---

## 11. Manual OAuth E2E (staging)

Document in the PR a screenshot per provider for each scenario:

| # | Provider | Scenario | Pass condition |
|---|---|---|---|
| 11.1 | Google | New signup, auto-fill profile | Account created in < 30 s; name + avatar populated; trial active |
| 11.2 | Facebook | New signup | Account created; Facebook identity present in `auth.identities` |
| 11.3 | Apple | New signup (first-time — names returned once) | Names persisted to `user_profiles.display_name` |
| 11.4 | Google | Sign in with email of existing email+password account | `AccountLinkingPrompt` shown; password re-auth succeeds; identity linked |
| 11.5 | Any | New user → tap "Create Listing" without phone | `PhoneVerificationModal` blocks; after SMS verify, listing proceeds |
| 11.6 | Any | Settings → link Facebook → link Apple → unlink Facebook | Final state: email+password + Google + Apple; Facebook absent |

---

## 12. Cross-Module Integration

| # | Check | Expected |
|---|---|---|
| 12.1 | `MODULE-04 V3 ItemCreateScreen` imports `isPhoneRequired` | `grep -n "isPhoneRequired" p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` returns ≥ 1 line |
| 12.2 | `MODULE-06 V2 CheckoutScreen` imports `isPhoneRequired` | same grep on checkout screen |
| 12.3 | Trial still activates on social signup (MODULE-11 V2 contract) | After Google signup, `SELECT status, trial_end_date FROM subscriptions WHERE user_id = $1` returns `status='trial'` |
| 12.4 | SP wallet initialized on social signup | `SELECT status, balance FROM sp_wallets WHERE user_id = $1` → `status='active'`, `balance=0` |
| 12.5 | JWT includes subscription status | Decode session → `subscription_status='trial'`, `can_spend_sp=true` |
| 12.6 | Email verification bypassed for OAuth users | `SELECT email_confirmed_at FROM auth.users WHERE id = $1` is NOT NULL right after OAuth signup |

---

## 13. Security Checklist

- [ ] OAuth `state` token is cryptographically random (≥ 32 bytes), stored in `expo-secure-store`, verified on callback.
- [ ] Linking requires password re-auth for password-bearing accounts; social-only accounts require an already-linked provider sign-in.
- [ ] `link_social_account` RPC enforces email match server-side (SECURITY DEFINER).
- [ ] OTPs hashed with bcrypt; never stored or logged plaintext.
- [ ] OTP rate limits enforced server-side (3/phone/hour, 5/user/day).
- [ ] Twilio credentials live in Edge Function env only; not in mobile bundle.
- [ ] Passwords set via `supabase.auth.updateUser`; no direct `auth.users` writes.
- [ ] Password blocklist active (top 100 common passwords).
- [ ] `audit_log` written for every link / unlink / set-password / phone-verify action.
- [ ] Test logs / snapshots contain no OTP codes, OAuth tokens, or passwords.

---

## 14. Performance Budgets

| Operation | Target | How to measure |
|---|---|---|
| OAuth flow start (button tap → provider UI) | < 500 ms | Manual stopwatch on staging build |
| OAuth callback processing (code → session) | < 1 s | `performance.now()` bracket in `handleOAuthCallback` test |
| Avatar download + upload | < 2 s p95 | Instrument `downloadProviderAvatar` in staging |
| Account linking RPC round-trip | < 1 s | Network tab on staging |
| Phone OTP SMS delivery (Twilio) | < 3 s p95 | Edge Function logs |
| `verifyPhoneCode` | < 500 ms | SQL EXPLAIN ANALYZE on indexed query |
| Provider list load (Linked Accounts screen) | < 300 ms | React Query cache hit |

---

## 15. Sign-off

- [ ] All sections §1–§14 pass.
- [ ] PR includes screenshots for §11.1–§11.6.
- [ ] No critical or high-severity Snyk / npm audit findings introduced.
- [ ] Module owner (@sameralzubaidy-afk or delegate) has signed off in the PR.

---

*Verification doc version: 1.0 | Pairs with MODULE-03-AUTH-V3-SOCIAL-LOGIN.md v1.0 | Generated from SOCIAL-LOGIN-REQUIREMENTS.md v1.0*
