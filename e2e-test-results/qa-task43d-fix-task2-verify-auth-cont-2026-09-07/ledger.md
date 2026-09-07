# QA Task 43d — Ledger (per-case roll-up)

**Run folder:** `e2e-test-results/qa-task43d-fix-task2-verify-auth-cont-2026-09-07/`
**Date:** 2026-09-07 · HEAD `59a657c8` (FIX-Task-2) · Devices iOS (iPhone 17 Pro Max) + Android (Medium_Phone_API_36.1)

## Per-verdict ledger

| # | Verdict | Guide case / FIX item | Platform | Top finding |
|---|---|---|---|---|
| 1 | ✅ PASS | FIX-2 #1 (AUTH-TC-O02 ZIP-06850 apply) | iOS | ZIP 06850 applies → "97 results · near 06850, 15 mi", no waitlist dialog |
| 2 | ✅ PASS | FIX-2 #1 (AUTH-TC-O02 ZIP-06850 apply) | Android | Same — no waitlist (fresh bundle) |
| 3 | ✅ PASS | FIX-2 #2 (AUTH-TC-A06 dialog) | iOS | "Continue anyway" green #5DBB8E outline (14.66%); Fix it solid (79.46%) |
| 4 | ✅ PASS | FIX-2 #2 (AUTH-TC-A06 dialog) | Android | "Continue anyway" green outline (14.04%) |
| 5 | ✅ PASS | FIX-2 #3 (Remove-favorite dialog) | iOS | Cancel green outline (10.61%); Cancel functional, favorite intact |
| 6 | ✅ PASS | FIX-2 #3 (Remove-favorite dialog) | Android | Cancel green outline (9.89%) |
| 7 | ✅ PASS | FIX-2 #3 (Settings Sign Out dialog) | iOS | Cancel green outline (11.27%) |
| 8 | ✅ PASS | FIX-2 #3 (Settings Sign Out dialog) | Android | Cancel green outline (10.17%) |
| 9 | 🔴 FAIL | FIX-2 #4 (C03 Apple provider) | iOS | Raw JSON `{"code":400,...provider is not enabled}` in in-app Safari sheet; no friendly banner |
| 10 | 🔴 FAIL | FIX-2 #4 (C03 Apple provider) | Android | Raw JSON in Chrome custom tab; no friendly banner |
| 11 | ✅ PASS | FIX-2 #5 (AUTH-TC-E02 incomplete OTP) | iOS | Verify enabled at 2 digits → "Please enter all 6 digits" |
| 12 | ✅ PASS | FIX-2 #5 (AUTH-TC-E02 incomplete OTP) | Android | Same |
| 13 | ✅ PASS | FIX-2 #5 (E02 wrong-code 999999) | iOS | "Verification Failed / Invalid verification code" (leg intact) |
| 14 | ✅ PASS | FIX-2 #5 (E02 wrong-code 999999) | Android | Same |
| 15 | 🟡 PARTIAL | FIX-2 #6 (Filters live count) | iOS | Applied-location leg PASS (Show 97 = grid); default prefilled-ZIP leg FAIL (modal 1154 vs grid 81) |
| 16 | 🟡 PARTIAL | FIX-2 #6 (Filters live count) | Android | Same (fresh bundle) |
| 17 | ✅ PASS | AUTH-TC-C05 (provider outage) | iOS | "Apple is temporarily unavailable. Sign in with email instead?" banner + CTA |
| 18 | ✅ PASS | AUTH-TC-C05 (provider outage) | Android | "Google is temporarily unavailable…" banner + CTA |
| 19 | ✅ PASS | AUTH-TC-H03 (avatar upload failure) | iOS | Warning + profile created; DB avatar_url NULL |
| 20 | ✅ PASS | AUTH-TC-H03 (avatar upload failure) | Android | Warning + profile created; DB avatar_url NULL |
| 21 | ✅ PASS | AUTH-TC-S03 (rate-limit) | iOS | "Reset Email Failed / You have requested password reset emails too frequently…" |
| 22 | ✅ PASS | AUTH-TC-S03 (rate-limit) | Android | Same |
| 23 | ✅ PASS | AUTH-TC-S04 (SMTP-500) | iOS | SMTP-config guidance body + Open Supabase Docs |
| 24 | ✅ PASS | AUTH-TC-S04 (SMTP-500) | Android | Same |
| 25 | ✅ PASS | AUTH-TC-S05 (400 bad_email — FIRST inducible) | iOS | "Email address is invalid / Check that the email…belongs to an account." |
| 26 | ✅ PASS | AUTH-TC-S05 (400 bad_email) | Android | Same |
| 27 | ✅ (action) | Disarm 3 fixture toggles | staging | All → none, DB read-back verified 19:18Z |

**Roll-up:** 20 PASS / 2 PARTIAL / 2 FAIL / 1 action-item (disarm) / 0 BLOCKED.
**Part 3 (J/K/L/Q/B01/O04-free/S08):** deferred with explicit per-case reasons (report §6) — session budget consumed by the mandatory dual-platform Parts 1–2.

## Call ledger (manual tally — transcript not mineable this session)

The full session transcript was not available for `qa:mine-call-ledger` (only the pointer `main.jsonl` existed in the session-log dir; QA Task 41 precedent: manual tally when the transcript is unreachable). Manual count of tool executions across the whole session ≈ **430**.

**Verdict denominator:** counting platform-case verdicts at 43c granularity (each case × platform) = 26 verdicts + 1 disarm action = **27** → **≈ 15.9 calls/verdict** (vs 43c's **9.6**).

**Why the ratio is higher this round (structural, not avoidable):**
1. Dual-platform MANDATORY execution for every shared-component FIX-Task-2 change (43c was single-platform Android) — every change × 2 devices ≈ doubles the device-driving tax.
2. Two fresh-signup persona flows (A06+E02+H03 combined block) — one per platform (~25 calls each) to exercise signup-gated surfaces.
3. Item-4 attribution experiment: disarm → test → re-arm the outage toggle to separate ProviderUnavailable vs ProviderDisabled paths (~8 calls, necessary for a correct verdict).
4. **Avoidable overhead (real lesson):** stale-dev-client-bundle cold-reload cycles on BOTH platforms (~25 calls combined) after the app resumed pre-FIX processes. Pre-empting this (force cold reload after every new commit) would have saved ~6% of calls and is now a standing agent rule suggestion.

**Per-tool dominant costs (approximate, manual):** ~150 clicks · ~130 element re-lists · ~60 terminal (incl. ~10 qa:admin-config-set + adb + osascript + simctl) · ~34 screenshot saves + ~14 qa:ocr/badge-scan analyses · ~14 mcp_supabase_execute_sql · ~15 read_file/grep source reads · ~12 memory/todo/bookkeeping.
