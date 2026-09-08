# QA Task 43h — Ledger (FIX-Task-5 on-device verification) — 2026-09-08

## Verdicts

| TC / Leg | Platform | Verdict | Top finding |
|---|---|---|---|
| FIX-Task-5 Leg 1 (AUTH-TC-J10 flow) | iOS (iPhone 17 Pro Max) | ✅ **PASS** | Prefill `+15551234004`, Send Code enabled+fires, OTP dev-autofill reachable, publish resumes; DB side-effects confirmed; phone state restored |
| FIX-Task-5 Leg 2 (AUTH-TC-J10 flow) | Android (Medium_Phone_API_36.1) | ✅ **PASS** | Same chain verified on Android; fresh bundle from 10.0.2.2:8081 |
| FIX-Task-5 Leg 3 (Group E spot-check, signup→phone verify) | iOS | ✅ **PASS** | Standalone `PhoneVerificationScreen` unaffected — code sent, verified, DB persisted |

**Roll-up: 3 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED**

## DB objects touched (read-only unless noted)

| Object | Leg | Effect |
|---|---|---|
| `profiles` test-free `phone_verified_at` | 1, 2 | SET by dev-bypass verify → **restored to NULL** after each leg (brief-directed scoped UPDATE, documented) |
| `phone_verification_codes` `ea535907` | 1 | Row created by `send-phone-otp` EF for `+15551234004` (attempts 0) — Send Code genuinely fired |
| `items` | 1 | `d53c99a9`, `eb818d86` (pending, $20) — residue (F1 duplicate) |
| `items` | 2 | `672de115`, `6ccd02ce` (pending, $20) — residue (F1 duplicate) |
| `profiles` new signup `ca25a137` | 3 | `phone_verified_at` SET via standalone screen; mid-onboarding disposable |
| `admin_audit_logs` | 1, 2 | **0 rows** — dev-bypass insert schema-stale, silently no-ops (Finding F2) |

## Tracker update (R52)

`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — AUTH-TC-J10 row Date/Source/Notes refreshed to this run (already ✅ PASS; no status flip → AUTH roll-up totals unchanged). Note records the FIX-Task-5 dual-platform re-verify closing 43g's Android completion-gap + the Group E spot-confirm.

## State at session end

- test-free: phone `5551234004`, `phone_verified=true`, `phone_verified_at=NULL`, method NULL (pre-run baseline; final read-back verified).
- Devices: iOS + Android both on Landing (logged out).
- No config writes/toggles; no admin-portal changes; no code changes.
