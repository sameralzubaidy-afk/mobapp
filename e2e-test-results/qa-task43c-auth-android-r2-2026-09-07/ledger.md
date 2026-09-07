# QA Task 43c — AUTH Android Round 2 — Ledger

Run: `e2e-test-results/qa-task43c-auth-android-r2-2026-09-07` · 2026-09-07 · Device `Medium_Phone_API_36.1`

## Verdict ledger (43c-executed rows)

| TC-ID | Guide | Android verdict | Top note |
|---|---|---|---|
| AUTH-TC-C01 | AUTH | 🚫 BLOCKED | Real Google OAuth — Chrome Custom Tab web content not AX-drivable; char-drop in webview; external anti-automation class (iOS-same) |
| AUTH-TC-C02 | AUTH | 🚫 BLOCKED | Facebook — same class as C01 |
| AUTH-TC-C03 | AUTH | 🚫 BLOCKED | Apple button present on Android (leg 1 PASS); provider not enabled → 400 validation_failed (ticket #14 confirms); raw JSON in custom tab (UX note) |
| AUTH-TC-C04 | AUTH | 🚫 BLOCKED | Facebook link — same class as C01/C02 |
| AUTH-TC-C05 | AUTH | 🚫 BLOCKED | qa_provider_unavailable=none (fixture toggle not armed) |
| AUTH-TC-C06 | AUTH | ✅ PASS | Custom-tab cancel → silent return, no error toast |
| AUTH-TC-C07 | AUTH | 🚫 BLOCKED | qa-social-only no session reachable (iOS #19 class) |
| AUTH-TC-S01 | AUTH | 🟡 PARTIAL | Check Your Inbox + Send Another Email PASS; delivery env-blocked (#15) |
| AUTH-TC-S02 | AUTH | ✅ PASS | Invalid Email alert; empty-field guarded |
| AUTH-TC-S03 | AUTH | 🚫 BLOCKED | qa_reset_error_simulation absent |
| AUTH-TC-S04 | AUTH | 🚫 BLOCKED | toggle absent (same) |
| AUTH-TC-S05 | AUTH | 🚫 BLOCKED | 400 not inducible; no 400 sim value |
| AUTH-TC-S06 | AUTH | ✅ PASS | Back to Login (form + success) |
| AUTH-TC-S07 | AUTH | ✅ PASS | Validation legs + requirements card + disabled |
| AUTH-TC-S08 | AUTH | ⏭️ NOT RUN | needs minted reset tokens + shared-persona pw mutation |
| AUTH-TC-S09 | AUTH | ✅ PASS | Link Error card + nav; adb fragment lossy caveat |
| AUTH-TC-S10 | AUTH | ✅ PASS | No active reset session alert |
| AUTH-TC-S11 | AUTH | 🟡 PARTIAL | Case1+3 PASS; Case2 deferred (minted tokens) |
| AUTH-TC-F06 | AUTH | ✅ PASS | Node scope toggle + Other Node badge on Android |
| AUTH-TC-M01 | AUTH | ✅ PASS | Search debounce + clear |
| AUTH-TC-M02 | AUTH | ✅ PASS | Recent chips + autocomplete + reuse |
| AUTH-TC-M03 | AUTH | ✅ PASS | Sort options + reorder |
| AUTH-TC-M04 | AUTH | ✅ PASS | Filters sheet layout + live count |
| AUTH-TC-M05 | AUTH | ✅ PASS | Header↔sheet SP sync |
| AUTH-TC-M06 | AUTH | ✅ PASS | No-results state |
| AUTH-TC-M07 | AUTH | ✅ PASS | Recent chips + Clear |
| AUTH-TC-M08 | AUTH | ✅ PASS | Trending chip → category filter |
| AUTH-TC-M09 | AUTH | ✅ PASS | Active chips + count + Clear all |
| AUTH-TC-M10 | AUTH | ✅ PASS | Bookmark → Favorites |
| AUTH-TC-N02 | AUTH | ✅ PASS | Favorite add/remove + Favorites persist |
| AUTH-TC-N03 | AUTH | ✅ PASS | Infinite scroll loads more |
| AUTH-TC-N04 | AUTH | ✅ PASS | SP badge on cards |
| AUTH-TC-O01 | AUTH | ✅ PASS | Node-scoped default |
| AUTH-TC-O02 | AUTH | 🟡 PARTIAL | radius/pref OK; home-ZIP apply blocked by Finding #1 |
| AUTH-TC-O03 | AUTH | ✅ PASS | 99999 consent, no-auto-enroll, Yes→1 row (DB) |
| AUTH-TC-O04 | AUTH | 🟡 PARTIAL | subscriber leg PASS; free leg not run |
| AUTH-TC-D02 | AUTH | ✅ PASS | Settings Sign Out → confirm → Landing |
| AUTH-TC-A06 | AUTH | ✅ PASS | Invalid referral dialog + Continue anyway |
| AUTH-TC-E02 | AUTH | ✅ PASS | Wrong-code error (doc-drift copy) |
| AUTH-TC-E03 | AUTH | ✅ PASS | Resend cooldown countdown |
| AUTH-TC-H02 | AUTH | ✅ PASS | Profile Setup validation errors |
| AUTH-TC-F01 | AUTH | ✅ PASS | 06850 → node, no waitlist (DB verified) |
| AUTH-TC-F05 | AUTH | ✅ PASS | ZIP city/state auto-lookup |

Roll-up: 27 PASS · 4 PARTIAL · 10 BLOCKED · 1 NOT-RUN-this-round(S08) · ~54 further deferred (per-case list in report §7) · 9 excluded (dead/43a).

## Findings
1. **MODERATE — duplicate active node on ZIP 06850** (Diag Test Node `6bf728cf…` + Norwalk Central) breaks `checkZipCodeHasActiveNode` `.maybeSingle()` → Discover filter shows the waitlist ask on the active home ZIP. Fix: tolerant lookup + deactivate Diag node. Scoped to Discover filter apply (Profile Setup unaffected — F01 clean).
2. **DESIGN-SYSTEM DEVIATION (owner-reported) — AUTH-TC-A06 "Invalid Referral Code" dialog** does not follow the design-system button/modal spec: "Continue anyway" (style cancel) renders as a white + 1px gray outline and "Fix it" as a solid primary pill in two equal side-by-side buttons — the design doc's Secondary variant (2px `#5DBB8E` outline / text-only, §4.2/§7) is not used; reads as co-primary. Source-confirmed; generalizes to all GlobalAlertProvider cancel buttons. Evidence: `screenshots/A06-invalid-referral-dialog-layout.png`. Dev fix (App Builder) item 1 in report §8.3.

## Call/evidence notes
- Screenshots: `screenshots/C03-login-social-row-android.png`, `screenshots/O03-active-zip-06850-waitlist-dialog.png`, `screenshots/A06-invalid-referral-dialog-layout.png`.
- Full trace per case lives in the agent conversation (43c session); report.md carries the per-case evidence summaries.
- **Evidence-capture note (owner feedback):** per-transition screenshot capture was under-enforced this round (3 on-disk screenshots); accepted as a process deviation — §5.6 capture is a HARD rule going forward, never budget-skipped.
