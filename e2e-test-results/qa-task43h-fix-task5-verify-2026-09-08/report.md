# QA Task 43h — FIX-Task-5 On-Device Verification (Dual Platform) — 2026-09-08

**Run folder:** `e2e-test-results/qa-task43h-fix-task5-verify-2026-09-08/`
**Verdict roll-up:** 3 PASS (Leg 1 iOS / Leg 2 Android / Leg 3 Group E spot-check) · 0 FAIL · 0 BLOCKED
**HEAD:** `aa6fc601` (QA Task 43g commit) + **UNCOMMITTED FIX-Task-5 changes** (4 files `M` in `git status`):
- `p2p-kids-marketplace/src/components/auth/PhoneVerificationModal.tsx`
- `p2p-kids-marketplace/src/components/auth/__tests__/PhoneVerificationModal.test.tsx`
- `p2p-kids-marketplace/src/services/phoneService.ts`
- `p2p-kids-marketplace/src/services/__tests__/phoneService.test.ts`
**Metro:** running on `:8081` (served the uncommitted JS on cold reload — JS-only change, no native rebuild). **NO code was modified by QA.**

---

## Executive summary

FIX-Task-5 (the QA Task 43g follow-up: listing phone-gate modal prefills the current user's real `profiles.phone` and drops the fake-looking `+1 (555) 123-4567` placeholder) is **VERIFIED FIXED on both platforms**. The exact 43g root-cause chain is closed end-to-end on iOS **and** Android:

> empty field + disabled Send Code → (now) **prefilled real number `+15551234004`** → Send Code **enabled and fires** (`phone_verification_codes` row created) → OTP step reached → **DEV autofill reachable** → verify → publish resumes → pending item created.

The Group E signup phone-verify leg (separate `PhoneVerificationScreen`) is **spot-confirmed UNAFFECTED** (source-isolated change confirmed).

---

## Persona + DB state used

| Item | Value |
|---|---|
| Persona | **test-free** (`test-free@kidsmarketplace.test`, user `a1234567-0000-0000-0000-000000000001`) |
| `profiles.phone` (pre-run, DB-verified) | `5551234004` |
| `phone_verified` / `phone_verified_at` (pre-run) | `true` / `NULL` (half-verified; gate keys off `phone_verified_at IS NULL` → gate fires) |
| Prefill expectation | `+15551234004` (normalizeE164: digits-only `5551234004` → `+1` prefix) |
| Platforms | iOS iPhone 17 Pro Max (iOS 26.1) · Android Medium_Phone_API_36.1 (emulator-5554) |
| Shared-persona restore | test-free returned to **exact pre-run baseline** after EACH leg (brief-directed scoped restore): `phone_verified=true`, `phone_verified_at=NULL`, `phone_verification_method=NULL` (DB read-back verified 13:31Z final) |

---

## Leg 1 — iOS (iPhone 17 Pro Max) — **PASS**

Flow: cold relaunch (fresh bundle) → `qa-login-as?persona=test-free` → `p2pkidsmarketplace://create-item` → `dev-add-test-photo` (1 photo) → `dev-set-category` (Books) → `dev-fill-item` ($20/condition/… → Submit enabled) → tap **Submit for Review**.

| # | Assertion (brief) | Result | Evidence |
|---|---|---|---|
| 1 | Gate modal fires on Submit (phone unverified) | ✅ "Verify Your Phone" + required-mode copy | L1-ios-01 |
| 2 | **Phone input PREFILLED with the persona's real number, E.164 `+15551234004`** — NOT empty, NOT `+1 (555) 123-4567` | ✅ AX tree `listing-phone-verification-phone-input` value = `+15551234004`; screenshot shows field filled | L1-ios-01 |
| 3 | Placeholder replaced (`Enter your phone number`, no fake-looking number) | ✅ Source-verified in the diff; placeholder never rendered because the field is prefilled (a filled field never shows a placeholder — correct) | diff read |
| 4 | **Send Code ENABLED** with prefill | ✅ solid-green enabled button (`disabled` only when `phone.length < 10`; prefilled value length 12) | L1-ios-01 |
| 5 | Tap Send Code → transition to OTP step | ✅ "Enter Verification Code" + "We sent a 6-digit code to +15551234004" + "DEV mode: use code 123456" | L1-ios-02 |
| 6 | **DEV autofill button reachable** on the OTP step | ✅ `listing-phone-verification-dev-autofill` ("Dev: Autofill & Verify (123456)") exposed in AX tree | L1-ios-02 |
| 7 | Tap dev-autofill → modal closes + publish resumes | ✅ "Thanks for submitting!" → 2 pending items in My Listings | L1-ios-03, L1-ios-04 |
| 8 | DB side-effect evidence | ✅ `phone_verification_codes` row `ea535907` (`+15551234004`, created 13:23:25Z, attempts 0); `profiles.phone_verified_at` SET **13:23:42Z**; items created | DB read-backs |

**DB side-effects (Leg 1):**
- `profiles.phone_verified_at` = `2026-09-08 13:23:42.389Z`, method `sms` → restored to NULL after.
- `phone_verification_codes` row `ea535907-5d78-4e38-bc76-0e7fd4f3bb61` (`+15551234004`) — the EF inserted a code row before the Twilio attempt (the "Send Code never fired" 43g gap is gone).
- 2 items created (`d53c99a9`, `eb818d86`, both "QA Dev Fixture Item" $20 `pending`) — see Finding F1 (double-create artifact).

---

## Leg 2 — Android (Medium_Phone_API_36.1) — **PASS**

Cold relaunch → Expo Dev Launcher → loaded **10.0.2.2:8081** (fresh bundle) → `qa-login-as?persona=test-free` (reused — test-free restored to unverified after Leg 1) → same create-item drive.

| # | Assertion (brief) | Result | Evidence |
|---|---|---|---|
| 1 | Gate modal fires on Submit | ✅ "Verify Your Phone" | L2-android-01 |
| 2 | **Phone input PREFILLED `+15551234004`** | ✅ AX tree `listing-phone-verification-phone-input` text = `+15551234004` (Android reports physical px 1:1); screenshot shows field filled behind the Gboard tutorial | L2-android-01 |
| 3 | Send Code ENABLED | ✅ solid-green | L2-android-01 |
| 4 | Send Code → OTP step | ✅ "We sent a 6-digit code to +15551234004" + DEV-mode helper | L2-android-02 (pre) |
| 5 | DEV autofill reachable → tap → publish resumes | ✅ `listing-phone-verification-dev-autofill` tapped → "Submitting Item For Review…" → "Thanks for submitting!" | L2-android-02 |
| 6 | DB side-effect evidence | ✅ `profiles.phone_verified_at` SET **13:29:26Z**; 2 items `672de115`, `6ccd02ce` | DB read-backs |

**Android quirk handled (known):** the recurring Gboard "Try out your stylus" handwriting tutorial fired on the modal phone-input focus (43g-known) — BACK-dismissed, then the prefill remained visible/verified. Not a defect.

---

## Leg 3 — Group E spot-check (regression guard) — iOS — **PASS**

The fix touched the **shared `PhoneVerificationModal`** (used only by ItemCreate/BulkListing). The main signup phone-verification flow uses a **separate `PhoneVerificationScreen`**. Single confirmation executed on iOS:

Fresh UI signup (dev autofill Alice, unique email+phone) → **Create Account** → the **standalone "Verify Your Phone" screen** rendered (NOT the modal — its own distinct dev helpers `dev-fill-otp-123456` / `dev-verify-otp-123456`), code sent (DEV-bypass dialog "Code Sent (DEV Bypass)"), `Use & Verify` → **"Success! Your phone number has been verified. Let's complete your profile!"** → proceeded to **Complete Your Profile (Profile Setup)** — exactly AUTH-TC-E01's expected result.

**DB side-effect (Leg 3):** throwaway signup `qa.alice.17888744052829391@kidsmarketplace.test` (user `ca25a137-b8dd-4263-b245-a4e056533e61`, phone `+12025555282298`) — `phone_verified_at` SET **13:34:20Z** via `PhoneVerificationScreen`. Left mid-onboarding (`profile_completed=false`) — disposable B01-class leftover.

**→ Group E signup phone-verify flow confirmed UNAFFECTED** by the shared-modal change (source-isolated as the brief predicted).

---

## Findings

**F1 — LOW (QA-tooling artifact, NOT user-facing, NOT introduced by FIX-Task-5):** the `__DEV__`-only "Dev: Autofill & Verify (123456)" button double-invokes the verify path → `onSuccess` fires twice → `handlePublish` runs twice → **two identical pending items** per platform (iOS: `d53c99a9` + `eb818d86`; Android: `672de115` + `6ccd02ce`; created ~1 ms apart). Mechanism: the button's `onPress` calls `handleVerifyCode(DEV_SMS_BYPASS_CODE)` directly AND the OTP auto-verify effect (`step==='code' && code.length===6`) fires for the same code → 2× `onSuccess`. Real users cannot reach this (they type the code, the auto-verify effect fires once). Pre-existing behavior on the QA-only button path; surfaced now because the 43g fix made the OTP step reachable. Recommend a small dev fix (guard the dev-autofill against double-verify, e.g. `isVerifying` check or dedupe) so QA runs stop producing duplicate items.

**F2 — LOW (pre-existing schema drift):** the dev-bypass branch of `verifyPhoneCode` (`phoneService.ts`) writes `admin_audit_logs` with `{ user_id, action, details }` — none of those columns exist on the table (schema: `actor_id, action_type, entity_type, entity_id, payload, reason, created_at`). The insert returns an error that is swallowed unhandled → **0 audit rows persisted** (DB-verified). Pre-existing; unrelated to FIX-Task-5. Recommend aligning the client insert (or routing to the correct audit table/columns).

**F3 — tooling note (not a defect):** `qa-logout` on iOS surfaced a "[AUTH] Logout error: AuthError: Logout failed." toast, but the session WAS cleared server-side (relaunch → TOS gate → "User not authenticated" on accept → relaunch → Landing). Transient deep-link logout teardown; reached the clean Landing state via relaunch. Android `qa-logout` completed normally.

**Android Gboard tutorial** recurred on modal field focus (43g-known quirk) — no defect.

---

## Perceived load-time table

Every measurement is a perceived load time (simulator/emulator, wall-clock, ±polling-interval precision) — not a formal performance profile. **No transition ≥ 3 s** (the only >3 s waits were dev-client cold-bundle downloads after relaunch — environment artifacts, not app transitions).

| Screen → transition | Platform | Elapsed | Flagged? |
|---|---|---|---|
| ItemCreate → Submit → phone-gate modal | iOS | < 1 s | no |
| Send Code → OTP step | iOS | ~1–2 s | no |
| Dev-autofill verify → publish resumes (Thanks modal) | iOS | ~1–2 s | no |
| ItemCreate → Submit → phone-gate modal | Android | < 1 s | no |
| Send Code → OTP step | Android | ~1–2 s | no |
| Dev-autofill verify → "Submitting…" → Thanks | Android | ~2 s | no |
| Signup submit → PhoneVerificationScreen | iOS | ~1 s | no |
| Use & Verify → Success modal | iOS | ~1 s | no |

---

## Evidence (screenshots in `screenshots/`)

| File | Description |
|---|---|
| `L1-ios-01-phone-gate-prefilled.png` | iOS gate modal, phone input prefilled `+15551234004`, Send Code enabled |
| `L1-ios-02-otp-step-dev-autofill-reachable.png` | iOS OTP step, "We sent a code to +15551234004", Dev autofill visible |
| `L1-ios-03-publish-resumed-thanks.png` | iOS "Thanks for submitting!" (publish resumed) |
| `L1-ios-04-my-listings-2-pending.png` | iOS My Listings — 2 pending items (double-create artifact, F1) |
| `L2-android-01-phone-gate-prefilled.png` | Android gate modal, phone input prefilled `+15551234004` (behind Gboard tutorial) |
| `L2-android-02-publish-resumed-thanks.png` | Android "Thanks for submitting!" |
| `L3-ios-groupE-signup-phone-verify-success.png` | iOS standalone PhoneVerificationScreen — "Success! Your phone number has been verified." |

---

## Residue left (for dev cleanup)

1. **4 pending "QA Dev Fixture Item" ($20) items under test-free** (natural product of the E2E flow, now duplicates due to F1): `d53c99a9-04a8-45b3-a0ad-5f35efde4868`, `eb818d86-682a-43ea-9f0b-2e279c6a265d`, `672de115-5af0-4f64-9e3a-ebb5ee949b3e`, `6ccd02ce-30d7-4e91-ba56-c914745c2c6d`. Recommend admin force-delete or fixture cleanup (F1's fix would prevent future duplicates).
2. **Throwaway signup** `qa.alice.17888744052829391@kidsmarketplace.test` (user `ca25a137-…`, mid-onboarding, `profile_completed=false`) — disposable per §7 (B01-class); a future `reset:staging`/cleanup can remove it.
3. **test-free phone state: RESTORED** to pre-run baseline (`phone_verified=true`, `phone_verified_at=NULL`, method NULL) — final DB read-back 13:31Z. No further action.
4. **Session states:** both devices logged out (Landing). test-free's phone_verification_codes row `ea535907` (created 13:23:25Z, attempts 0, 10-min expiry) expired harmlessly.
