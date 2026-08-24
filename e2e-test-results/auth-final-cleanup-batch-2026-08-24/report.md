# QA Report — Auth File Final Cleanup Batch (8 Scattered Open Items)

**Date:** 2026-08-24 · **Device:** iPhone 17 Pro Max sim (iOS 26.1) · **Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Type:** status-refresh pass (re-confirm blockers, don't rediscover) + 2 real executions + 1 doc fix

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| J10 | AUTH | **PASS** | Phone-gate before publish verified end-to-end (real first run) |
| C05 | AUTH | **BLOCKED** | No provider-outage toggle exists; banner only inducible by real 5xx |
| C07 | AUTH | **BLOCKED** | No social-only (password-less) user on staging (DB = []) |
| E04 | AUTH | **PASS** | OTP rate-limit message now inducible + verified on-device (was "not inducible") |
| H03 | AUTH | **BLOCKED** | `qa_avatar_upload_failure` still `none` (unarmed since 2026-08-18) — ops action |
| P03 | AUTH | **BLOCKED** | test-buyer has ZERO messages — standing fixture gap |
| S01 | AUTH | **BLOCKED** | Staging SMTP NOT configured — recovery send fails server-side (NEW regression) |
| Q04 | AUTH | **DOC-FIXED** | Guide still said `fee = 2.5 (10%)`; percentage model deprecated → updated to flat-fee |

**Roll-up:** 2 PASS / 0 FAIL / 5 BLOCKED / 0 SKIPPED + 1 DOC-FIXED.
**Closed now: 3 of 8** (J10, E04, Q04). **Still genuinely blocked: 5 of 8** (C05, C07, H03, P03, S01).

---

## AUTH-TC-J10 · Phone-verification gate before publish — **PASS** (real first run)

**Execution trace**
1. `qa-logout` deep link → Landing. Login → Forgot Password (S01 attempt, wrong case — aborted) → Back → Sign Up.
2. Signup: `dev-fill-test-user-1` autofill → unique email `qa.alice.17876051981934476@kidsmarketplace.test`, phone `+12025558193508`, DOB 15/01/2000, password auto-filled → **Create Account**.
3. Landed on **PhoneVerification** ("Verify Your Phone", code to +12025558193508, dev bypass 123456). **Deliberately did NOT verify** → `terminate_app` + relaunch → dev bundle reload → onboarding carousel → **Skip** → Home ("Local Market", unverified node-less user, tab bar present).
4. Deep link `p2pkidsmarketplace://create-item` → ItemCreate ("New Item").
5. `dev-add-test-photo` (photo 1/10, Cover) → `dev-set-category` (→ **Books** — button label confirmed "Dev: Set Category (Books)") → `dev-fill-item` (title "QA Dev Fixture Item", price 20, condition **New** checked).
6. **Submit for Review** → **phone-verification gate modal appeared** immediately: "Verify Your Phone" / "Phone verification is required before you can publish listings or make purchases." → publishing BLOCKED. ✓
7. [E04 interleave — see below] → `listing-phone-verification-dev-autofill` (123456) → verify → **publish resumed** → "Thanks for submitting!" review screen (Go to my items / Go to dashboard). ✓

**DB proof (read-only SQL)**
- User `ae798427-fac2-46b4-b95b-b4d132e683e4`: `phone_verified_at` = `2026-08-24 21:09:07` (set by dev-bypass verify).
- Item `8a8e1dcb-a364-44b7-9b4f-b8f1daa6d8e2` "QA Dev Fixture Item", price 20, **status `pending`**, created `21:09:08` (1s after verify — publish resumed, gate satisfied).

**Assert result:** PASS — all J10 assertions met (gate blocks before verify; publish resumes after; item goes to pending review). This case was never actually run before despite earlier assumptions; it is now executed for real.

**Perceived load times:** signup→PhoneVerification ~1s; relaunch→carousel ~5s (dev cold-start bundle — env artifact); create-item→ItemCreate ~1s; Publish→gate modal ~1s; verify→submit-success ~1s. All well under 3s except dev-bundle cold start.

**UX notes**
- *Structural:* gate modal is a clear required-gate overlay (no dismiss); publish resumes seamlessly after verify. Good.
- *Wording:* "Phone verification is required before you can publish listings or make purchases." — plain, unambiguous for parents. No rewrite needed.
- *Design-system:* gate-modal primary CTA ("Send verification code") renders the documented primary-green `#5DBB8E` (pixel-verified). **DEVIATION — OTP as 6 separate digit boxes** (`listing-phone-verification-code-digit-0..5`) vs `design-system-passitup.md` §4.4 ("Single auto-Formatted Field … NOT 6 separate boxes"). The standalone `PhoneVerificationScreen` uses a single `otp-input` field (design-compliant) — the gate modal is inconsistent with both the design doc and the sibling screen.

**Friction:** ItemCreate scroll needed swipe-over-photo-grid workaround (known); dev-button coordinates derived from the fixed 63px pitch because the AX-tree display truncates long single-line trees; first Send tap missed (rendered button ~11pt higher than tree) → re-derived via green-band pixel scan (§5.1 one-miss-re-derive).

## AUTH-TC-E04 · OTP rate limiting message — **PASS** (unblocked this run)

**Execution trace** (within J10's gate modal, phone `+12025558193508`):
1. Pre-existing row 1 (signup auto-send at 21:00:09 UTC).
2. Modal send (#2) → row 2. Code-entry step ("Enter Verification Code", "DEV mode: use code 123456").
3. Resend after 60s (#3) → row 3 (allowed; DB count 2→3).
4. Resend after 60s (#4) → **edge function returned 429 `RATE_LIMIT_EXCEEDED`** → client rethrew `OTPRateLimitError` → modal showed **"Too many attempts. Please try again in 3600 seconds."** + "Resend code in 3598s" (send blocked ~1h). ✓

**DB proof:** `phone_verification_codes` rows for the phone: 1 → 2 → 3; stayed **3** after the blocked 4th send (no insert — server-side 3/hr phone limit).

**Assert result:** PASS — exact guide copy ("Too many attempts. Try again in {N} seconds.") shown; further sends blocked until the window passes. **Status change:** previously BLOCKED (Phase 22: "RATE_LIMIT_EXCEEDED never surfaced — dev bypass always won"). Now inducible because the deployed `send-phone-otp` v2 rate-limit check runs before the Twilio/dev-bypass path, and the client rethrows `OTPRateLimitError` (never dev-bypasses it).

**UX:** message is friendly + actionable ("try again in N seconds"), parent-appropriate. No rewrite needed.

**Note:** consumed the phone's 3/hr OTP budget for ~1h (until ~22:09 UTC) — do not reuse this phone for OTP cases within that window.

## AUTH-TC-C05 · Provider unavailable → email fallback banner — **BLOCKED** (unchanged)

Feature fully implemented + unit-tested: `SocialLoginButtons.tsx` renders `provider-unavailable-banner` with copy "{Provider} is temporarily unavailable. Sign up with email instead?"; `oauthService.initiateSocialLogin` throws `ProviderUnavailableError` on 503/timeout>10s. **But no `qa_provider_unavailable` (or any) simulation toggle exists** in `admin_config` (only `qa_avatar_upload_failure` exists). Not inducible on healthy staging without a real provider 5xx. **Blocker:** needs a dev-gated provider-outage simulation toggle (mirror the `qa_reset_error_simulation` pattern).

## AUTH-TC-C07 · Social-only user sets a password — **BLOCKED** (fixture gap, unchanged)

Feature exists: `SetPasswordModal.tsx`, `passwordService.ts` (`canSetPassword`/`setPasswordForSocialUser`), `LinkedAccountsScreen.tsx` (Settings → Linked Accounts), `ProviderCard.tsx`. **Blocker:** no social-only (password-less) user on staging — DB query for `auth.users` with empty `encrypted_password` returned **[]**. The C04 fixture made `kidsp2p@gmail.com` password-capable and fixture user B also has a password. Needs a dev-provisioned social-only fixture (OAuth identity, no password), distinct from the C04 fixture.

## AUTH-TC-H03 · Avatar upload failure does not block — **BLOCKED** (ops action pending, unchanged)

`admin_config.qa_avatar_upload_failure` = **`none`** (last updated 2026-08-18 17:06 — the disarm after the last verify). Toggle + `getSimulatedAvatarUploadError` are implemented and were VERIFIED working (2026-08-18), so this is purely a dev-team ops action: arm `upload_failure` → retestable. QA cannot self-arm (execution-only; write touches shared staging config).

## AUTH-TC-P03 · Header chat unread-badge — **BLOCKED** (fixture gap, unchanged)

test-buyer has **zero** rows in `public.messages` (checked all messages where test-buyer is a party or in test-buyer's trades). `seed-staging-data.ts` creates no messages; `reset-staging.ts` deletes test-user messages. The header chat icon IS present + AX-exposed (`header-chat-btn`). **Blocker:** no conversation/message fixture exists to drive an unread badge. Needs a seed fixture creating ≥1 trade-scoped message to test-buyer (unread), or a send-message path not gated on an in-progress trade (§5.25).

## AUTH-TC-S01 · Forgot Password — success + Send Another Email — **BLOCKED** (environment — NEW finding)

On-device (test-free@kidsmarketplace.test → Forgot Password → Send Reset Link): **"Reset Email Failed"** dialog — "Error sending recovery email / Possible causes: • SMTP/email provider not configured in Supabase Auth • Redirect URL not allowed in Auth settings / Check Supabase Auth > Email Settings and Email Logs." (Open Supabase Docs + OK). `qa_reset_error_simulation` toggle is **absent** → this is the **real** GoTrue error, not a simulation. So staging SMTP is currently **not configured** for Supabase Auth. **Regression:** Phase 14 (2026-08-16) confirmed SMTP worked and S01 PASSED. "Check Your Inbox" success state is unreachable → BLOCKED. Needs dev/ops: configure staging SMTP in Supabase Auth Email settings + confirm `p2pkidsmarketplace://reset-password` redirect URL is allowed.

## AUTH-TC-Q04 · SP calculator — buy mode — **DOC-FIXED**

Confirmed the guide's Q04 Expected Result still read `fee = 2.5 (10%)` — the **old percentage model**. Source proof: `spCalculatorService.calculateSP` buy-mode comment "Percentage-based fee removed per BACKEND-AUDIT-REPORT Part 1 — BRD requires flat fees only: $2.99/$0.99"; staging `admin_config`: `transaction_fee_non_subscriber_cents = 2000` ($20.00), `transaction_fee_subscriber_cents = 100` ($1.00). The flat-fee fix was recommended previously but **never applied to the guide** — applied now (Expected Result + model note). No other stale `2.5 / 10% / 17.5` references remain in the guide.

---

## Perceived load-time table

| Transition | Elapsed | Flag |
|---|---|---|
| Signup submit → PhoneVerification | ~1s | — |
| Terminate+relaunch → carousel | ~5s | Env artifact (dev bundle cold load) |
| Skip → Home | ~1s | — |
| create-item deep link → ItemCreate | ~1s | — |
| Publish → phone-gate modal | ~1s | — |
| Send code → code-entry step | ~1s | — |
| Resend #4 → rate-limit message | ~1s | — |
| Verify → "Thanks for submitting!" | ~1s | — |
| Forgot Password send → Reset Email Failed dialog | ~1s | — |

All observed transitions within ideal UX threshold (<3s) except the dev-build cold-start bundle reload (~5s, environment artifact).

## Design-system compliance (per screen/dialog visited)

- **Forgot Password screen** — CONFIRMED (filled inputs, primary green CTA).
- **"Reset Email Failed" dialog** — CONFIRMED (in-app GlobalAlertProvider; light/neutral buttons w/ dark text, no OS-blue; appropriate for a non-destructive error dialog).
- **Signup screen** — CONFIRMED.
- **Onboarding carousel** — CONFIRMED.
- **Home (fresh unverified user)** — CONFIRMED.
- **ItemCreate** — CONFIRMED (primary "Submit for Review" green pill sticky footer).
- **Phone-verification gate modal — phone step** — CONFIRMED (primary green Send pill).
- **Phone-verification gate modal — code step** — **DEVIATION**: OTP as 6 separate digit boxes vs design doc §4.4 single auto-formatted field (and vs the sibling standalone `PhoneVerificationScreen` which uses a single `otp-input` field).
- **Submit-success ("Thanks for submitting!")** — CONFIRMED.

## App State Left Behind

- Throwaway user `qa.alice.17876051981934476@kidsmarketplace.test` (id `ae798427-fac2-46b4-b95b-b4d132e683e4`) — now **phone-verified** (21:09:07 UTC), 1 **pending** item `8a8e1dcb-a364-44b7-9b4f-b8f1daa6d8e2` "QA Dev Fixture Item" $20 (could be re-approved for a future L01 anchor). Cleanup candidate.
- 3 `phone_verification_codes` rows for `+12025558193508` (rate-limit rows; expire ~22:00–22:09 UTC). The phone's 3/hr OTP budget is exhausted until ~22:09 UTC.
- Left logged out (Landing).

## Follow-ups (dev-side, not applied in-run)

1. **S01 (P1):** configure staging SMTP in Supabase Auth + verify `p2pkidsmarketplace://reset-password` redirect URL allowed. Investigate the regression vs 2026-08-16.
2. **H03 (P2 ops):** arm `qa_avatar_upload_failure = upload_failure` on staging (dev team), then disarm post-run.
3. **C07 (P2):** provision a social-only (password-less) fixture user on staging.
4. **P03 (P2):** seed a trade-scoped unread message to test-buyer.
5. **C05 (P3):** add a dev-gated provider-outage simulation toggle.
6. **Design (P3):** align gate-modal OTP to §4.4 single auto-formatted field (or document the exception).
7. **Dev LogBox (P3):** sweep the "Text strings must be rendered within a <Text> component" warning observed during the phone-gate flow.
