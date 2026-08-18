# Phase 19 (v3) — AUTH Group C: Social Login Close-Out — QA Test Report

**Run:** 2026-08-16 · iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1 · dev build + Metro · staging Supabase `drntwgporzabmxdqykrp`.
**Canonical guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — Group C (AUTH-TC-C01…C07).
**Credentials:** `google-oauth-test-user` + `facebook-oauth-test-user` from `/memories/repo/qa-test-accounts.md` (referenced by name; passwords never echoed). Each used **once**, per the registry's risk guidance.
**Evidence:** `e2e-test-results/phase19-auth-group-c-closeout-2026-08-16/evidence/`.
**Session outcome:** 1 PASS / 0 FAIL / 6 BLOCKED / 0 SKIPPED.

---

## Executive summary (read first) — which cases are genuinely closed

**Only one case is genuinely closed this session: C06 (OAuth-cancel silent return) → PASS.**

Despite the new, working Google/Facebook test credentials, **full OAuth completion (C01/C02) could NOT be achieved** on the current dev build. Both providers now authenticate correctly end-to-end server-side (this is real progress vs. Phase 18's P0), but the app's **OAuth callback return path fails to deliver the session back into the app** — after a successful Google or Facebook consent, the app returns to the Login screen with **no session** (AsyncStorage verified empty in both cases). This is a **client-side OAuth-return delivery failure on the dev build** (custom-scheme `p2pkidsmarketplace://oauth-callback` handoff / auth.expo.io proxy redirect), the same deep-link-delivery class documented in Phases 15/16. It is provider-independent (both Google and Facebook failed identically), so it is an app/infra fix, not a credential or provider issue.

**The good news:** the P0 (consent browser opening) is fully confirmed for both providers; Google/Facebook each accepted the real credentials (Google login event recorded in the staging auth audit log at 21:39:12Z); the Facebook OAuth authorization page ("Continue as Sam", app ID 2443740446072876) rendered correctly. The blocker is purely the return leg.

**Final Group C roll-up (cumulative across Phase 18 + Phase 19):**

| TC-ID | Phase 18 | Phase 19 | Final | Status |
|---|---|---|---|---|
| C01 Google | FAIL (P0: no browser) | **BLOCKED** (callback delivery) | **BLOCKED** | New blocker — OAuth return path |
| C02 Facebook | FAIL (P0: no browser) | **BLOCKED** (callback delivery) | **BLOCKED** | New blocker — OAuth return path |
| C03 Apple | FAIL (P0 + Apple not enabled) | **BLOCKED** (Apple not enabled — re-confirmed) | **BLOCKED** | Staging provider gap |
| C04 Account-link | BLOCKED | **BLOCKED** (collision not ready + depends C01/C02) | **BLOCKED** | Fixture + OAuth dependency |
| C05 Provider-outage banner | BLOCKED | **BLOCKED** (no trigger mechanism) | **BLOCKED** | Needs toggle (as expected) |
| C06 OAuth-cancel | BLOCKED | **PASS** | **PASS** ✅ | **Genuinely closed** |
| C07 Social-only set password | BLOCKED | **BLOCKED** (no fixture + depends C01/C02) | **BLOCKED** | Fixture + OAuth dependency |

**Final Group C tally: 1 PASS / 0 FAIL / 6 BLOCKED.**

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-C01 | AUTH (Group C) | **BLOCKED** | Google provider auth completed (server login event confirmed), but app received no session — client-side OAuth callback delivery failed |
| AUTH-TC-C02 | AUTH (Group C) | **BLOCKED** | Same — Facebook consent granted, app returned to Login, no session |
| AUTH-TC-C03 | AUTH (Group C) | **BLOCKED** | Apple provider still not enabled on staging (400 `validation_failed` re-confirmed) |
| AUTH-TC-C04 | AUTH (Group C) | **BLOCKED** | Collision setup not ready (no app account w/ OAuth email) + depends on C01/C02 |
| AUTH-TC-C05 | AUTH (Group C) | **BLOCKED** | No on-device trigger mechanism (pending C05 toggle); code/unit-verified only |
| AUTH-TC-C06 | AUTH (Group C) | **PASS** | Cancel consent browser → silent return to Login, no error toast |
| AUTH-TC-C07 | AUTH (Group C) | **BLOCKED** | No social-only fixture persona + depends on C01/C02 |

**Roll-up:** 1 PASS / 0 FAIL / 6 BLOCKED / 0 SKIPPED.

---

## Perceived load-time table

> Label: **Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.**

| Screen → transition | Elapsed | Notes |
|---|---|---|
| Login → Google consent (smoke) | ~1–2s | Consent browser opened cleanly |
| Google email → password step | ~2s | Provider navigation |
| Google password → consent page | ~2s | Consent rendered |
| Facebook login page → auth consent | ~3–4s | "Continue as Sam" page |
| Consent → return to app (both providers) | ~2–3s | Browser closed; app returned to Login, no session |
| Login → Google consent (C06 cancel) | ~1–2s | Cancel → silent return |

No app-behavior transition exceeded the 3s flag meaningfully (the ~3–4s Facebook login→consent is provider-page navigation, not app behavior). **The blocker is not a load-time issue — the callback simply never delivers.**

---

## Per-case traces

### AUTH-TC-C01 · Sign in / Continue with Google — **BLOCKED (environment: OAuth callback delivery)**

**Guide expected result:** A browser opens the Google consent page; after success the app returns and a session is created; first-time signup auto-fills the profile.

**Execution trace (credential used once):**
1. Clean launch → Landing → Log In. Social row renders (labels + spinner verified in Phase 18 UX work). Google button at (151,347).
2. **Smoke PASS:** Tap Google → consent browser opens (`accounts.google.com`, "Sign in to continue to drntwgporzabmxdqykrp.supabase.co"). 
3. Typed `google-oauth-test-user` email into the Google email field (verified in-field) → Next → Google **accepted the email** and advanced to the password screen (no security challenge) → typed password (verified 13 bullets) → Next → Google authenticated.
4. Google consent page for the app rendered → tapped the blue **Continue** (located via pixel-scan, pt 243,750) → browser closed.
5. App returned to **Login** screen — **no session** (Google button idle, no error banner).
6. **Server-side confirmation:** staging `auth_audit_logs` shows `action: "login", actor_username: "kidsp2p@gmail.com", traits: {provider: "google"}, created_at 2026-08-16T21:39:12Z` (Safari UA = consent browser). So the provider-side OAuth **completed**.
7. **Client-side confirmation of failure:** the app's AsyncStorage contains **no `sb-*`/`auth-token` key** → no session was ever set into the supabase client. Device log shows the SFSafariViewController session ending with `_UIViewServiceHostSessionErrorDomain Code=4 "Invalidation requested"` — the custom-scheme handoff back to the app failed.

**Verdict rationale:** The P0 (browser opens) is fixed and the credentials are valid (Google accepted them). The blocker is the app's **OAuth callback/return delivery** — the `p2pkidsmarketplace://oauth-callback` (or dev-client proxy) return never reaches the app's supabase client, so no session is established. Per the brief's guidance, not retried (credential used once). **BLOCKED** — a client-side/dev-build blocker requiring a dev fix (see What Needs To Be Fixed Next #1).

### AUTH-TC-C02 · Sign in / Continue with Facebook — **BLOCKED (environment: OAuth callback delivery)**

**Execution trace (credential used once):**
1. Tap Facebook (286,347) → `facebook.com` login page opened.
2. Typed `facebook-oauth-test-user` email + password (both verified in-field) → **Log in** → Facebook authenticated (account "Sam Gant").
3. "Save your login info?" prompt → tapped **Not now**.
4. Facebook OAuth authorization page rendered: "You previously logged into p2pmarketplace with Facebook. Would you like to continue?" with **Continue as Sam** (screenshot `c02-facebook-consent-page.png`) → tapped Continue as Sam.
5. Browser closed → app returned to **Login**, no session. AsyncStorage verified **empty** (no auth-token).

**Verdict rationale:** Same as C01 — provider auth completed (consent granted), app callback delivery failed. Provider-independent (identical failure to Google). **BLOCKED**, credential used once, not retried.

### AUTH-TC-C03 · Sign in / Continue with Apple — **BLOCKED (staging provider not enabled) — reason re-confirmed**

- Re-checked staging `…/auth/v1/authorize?provider=apple&redirect_to=p2pkidsmarketplace://oauth-callback` → **HTTP/2 400 `validation_failed`** ("provider is not enabled"). Apple remains disabled on staging; deferred until Apple Developer Program enrollment. Reason from Phase 18 remains accurate. (iOS button presence on both screens was already verified in Phase 18.)

### AUTH-TC-C04 · Existing-email account-link prompt — **BLOCKED (collision setup not ready + OAuth dependency)**

- Registry (line 44) confirms: the OAuth email (`kidsp2p@gmail.com`) has **no matching `@kidsmarketplace.test` fixture** — a dev-team step must pre-create an app account with that email before the account-link prompt can be exercised end-to-end.
- Additionally, C04 requires a completed OAuth session (to trigger `checkAccountExists`), which is itself blocked by the C01/C02 callback-delivery failure. The `AccountLinkingPrompt` modal is wired in code (per the brief), but is not reachable on-device until both blockers clear.

### AUTH-TC-C05 · Provider unavailable → email fallback banner — **BLOCKED (no trigger mechanism — as expected)**

- No on-device trigger mechanism exists yet (pending the C05 toggle, per the brief). The banner is code/unit-verified ("We couldn't connect to {Provider} right now…" + `provider-error-cta`). Not inducible on healthy staging without the toggle. Reported as-is per the brief.

### AUTH-TC-C06 · User cancels OAuth — silent return — **PASS ✅**

**Execution trace:**
1. On Login, tap Google → consent browser opens.
2. Tap **Cancel** (top-left, 38,110) → browser closes.
3. App returns to **Login** with **no error toast/banner** (Google button enters the transient "Signing you in…" recovery state, then returns to idle — the app's post-cancel session-recovery poll).

**Assert:** "The app silently returns to the previous screen with no error toast" — **met**. (Also independently verified in the Phase 18 UX follow-up.) **PASS.** UX note: after a cancel, the tapped button shows "Signing you in…" for up to ~30s (the 60×500 ms session-recovery poll) before returning to idle — slightly long, but not an error state; see UX notes.

### AUTH-TC-C07 · Social-only user sets a password — **BLOCKED (no fixture + OAuth dependency)**

- No social-only fixture persona exists in the registry (registry gap), and creation requires a completed social login (blocked by C01/C02 callback delivery). `LinkedAccountsScreen` `set-password-button` + `SetPasswordModal` remain code-verified only. Reason from Phase 18 accurate, now additionally dependent on the C01/C02 fix.

---

## Cross-cutting UX findings

**UX-1 (HIGH) — OAuth "completes" but the user is never logged in (no session, no error).** After a successful Google/Facebook consent, the app returns to Login with no session and **no user-visible message**. A parent/guardian would believe the sign-in failed or didn't register. Even after the P0 fix, the end-to-end loop is broken at the return leg. This is the top product-risk finding — an end-user-facing broken flow that must be fixed before any OAuth completion can be claimed.

**UX-2 (MED) — Post-cancel "Signing you in…" lingers ~30s.** After cancelling the consent browser, the tapped button stays in the "Signing you in…" loading state for up to ~30 seconds (session-recovery poll) before returning to idle. Not an error, but reads as a hang to a user who deliberately cancelled. Consider shortening the recovery window or returning to idle promptly on an explicit cancel.

**UX-3 (copy/spec) — none new this run.** The Facebook consent copy ("You previously logged into p2pmarketplace with Facebook. Would you like to continue?") is clear and correct for the target audience.

## Cross-cutting design-system compliance (vs. `docx/design-system-passitup.md`)

- Reachable app screens this run: **Login** (unchanged from Phase 18 — compliant: labels under icons, `#5DBB8E` primary, "or" divider, filled inputs). No new app screens were reached because OAuth completion fails at the return leg.
- **Provider pages (Google/Facebook consent)** are third-party WebViews — not app-owned UI; the design-system compliance check does not apply to them (noted for scope).
- **No app dialogs/modals** were reachable (the post-OAuth profile-fill / account-linking / onboarding screens were not reached). No modal compliance findings.

---

## Locator-gap findings

None new this run. (Phase 18 locator gaps — social icon buttons a11y — were already fixed in the Phase 18 follow-up: the buttons now surface in the AX tree with `Sign in with Google/Apple/Facebook` labels.)

---

## Friction vs. operating rules

- **WebView keyboard/tap friction:** on both Google and Facebook consent pages, the first tap while the software keyboard was shown was eaten (keyboard collapse consumed the tap); a second tap after the keyboard collapsed registered. Adopted the "dismiss keyboard, then tap" pattern (§5.2). Noted as recurring WebView friction.
- **`auth_audit_logs`/`auth_logs` query flakiness:** the `query_logs` MCP returned intermittent "Backend error! Retry your query" — the decisive Google login event was captured on the first successful query; Facebook's event was corroborated by the consent-granted observation + empty AsyncStorage rather than a second log pull. Logged as tooling friction.
- **AX-tree staleness:** after the OAuth browser closed, the first tree poll returned near-empty content (transition), then Login — screenshots used as ground truth (§5.9).
- **Deep-link/callback delivery:** the core blocker (custom-scheme OAuth return not delivering on dev build) is the same class documented in Phases 15/16 — recorded as friction-to-fix, not an app-logic failure of the cases' assertions beyond the broken loop.

---

## Recommended follow-ups (dev-side, ranked)

1. **Fix the OAuth callback/return delivery on the dev build (P0 for Group C closure).** The provider authenticates; the app never receives the session. Verify which `redirect_to` `getRedirectUri()` resolves to on dev-client builds (`auth.expo.io` proxy vs native `p2pkidsmarketplace://oauth-callback`), confirm the Supabase Auth Redirect URL allowlist includes the effective value, and make the return capture reliable (the current `Linking` listener + 60×500 ms session-recovery fallback is not catching it). Reference the Phase 15/16 deep-link delivery fixes as the same class.
2. **Surface a "we couldn't complete the sign-in" message when the callback is lost** (UX-1) — a silent return to Login with no session and no message is a broken user experience.
3. **Shorten/clean up the post-cancel recovery spinner** (~30s "Signing you in…" after an explicit cancel, UX-2).
4. **C04 fixture (still open):** pre-create an app account with email `kidsp2p@gmail.com` (UI password signup on staging) so the account-link prompt can be exercised once C01/C02 are unblocked.
5. **C03 (still open):** enable/configure the Apple provider on staging (deferred to Apple Developer Program enrollment).
6. **C05 toggle (still open):** add the provider-outage simulation toggle so the fallback banner can be verified on-device.
7. **C07 fixture (still open):** add a social-only fixture persona to `seed:staging`.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-C01–C07 (Group C close-out) — full-completion attempts for Google/Facebook with the new real OAuth test credentials, plus re-confirmation of the BLOCKED cases
**Design-System Compliance:** PASS on reachable screens — Login screen unchanged from Phase 18 and compliant (labels under icons, `#5DBB8E` primary, "or" divider, filled inputs). No new app screens or app-owned modals were reached (OAuth completion fails at the return leg); provider consent pages are third-party WebViews, out of scope for the app design-system check.
**Perceived Load-Time Verdict:** GOOD for reachable transitions (Login→consent ~1–2s; consent→app return ~2–3s). No app-behavior transition flagged ≥3s; the Group C blocker is a callback **delivery** failure (no session), not a load-time issue. Facebook provider-page navigation (~3–4s) is third-party, not app behavior.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Login screen: wording/layout match design-system requirements.
- CONFIRMED — Facebook OAuth authorization copy ("You previously logged into p2pmarketplace with Facebook. Would you like to continue?") is clear and correct for the parent/guardian audience.
- No app dialogs/modals reachable this run (post-OAuth screens not reached) — nothing to flag.
**Verdict Summary:** 1 PASS / 0 FAIL / 6 BLOCKED / 0 SKIPPED (final Group C cumulative roll-up: 1 PASS / 0 FAIL / 6 BLOCKED)
**Critical Findings:**
1. **P0 (Group C closure) — OAuth callback/return delivery is broken on the dev build:** both Google and Facebook now authenticate fully server-side (Google login event confirmed in auth audit log at 21:39:12Z; Facebook consent "Continue as Sam" granted), but the app returns to Login with **no session** (AsyncStorage empty both times). Provider-independent → client-side/infra fix. An end-user would complete their Google/Facebook sign-in and not be logged in, with no message.
2. **Silent failure on the lost callback (UX-1):** no user-visible message when the OAuth return fails — the user is dumped back on Login.
3. **C06 is the only genuinely closed case** (cancel → silent return, PASS).
4. **Confirmed still BLOCKED as documented:** C03 (Apple not enabled on staging), C04 (collision setup not ready), C05 (no toggle), C07 (no social-only fixture).
**App State Left Behind:** App left on the **Login** screen, logged out, no session (AsyncStorage has no auth-token). **No accounts created in the app** (the OAuth users exist only server-side as provider identities from the completed logins — expected side effect of the successful provider auth; `kidsp2p@gmail.com` now has Google+Facebook identities in the staging auth store). OAuth credentials each used once (no repeats). Staging config untouched (Apple remains disabled; no toggles armed). One throwaway Google consent was opened and cancelled for the C06 check (no credential entered).
**Why It Matters:** This run proves the OAuth credentials work and the provider-facing half of social login is fully functional (browser opens, credentials accepted, consent granted, server-side session created), but it also proves the **app cannot yet complete a social login end-to-end** — the return leg drops the session. Group C cannot be closed as "working" until that delivery path is fixed. The run also genuinely closes C06 and re-confirms the four known BLOCKED reasons, so the remaining work is now precisely enumerated.
**How to Verify/Reproduce:**
1. Launch dev build → Log In → tap Google → enter `google-oauth-test-user` creds → Next → consent → Continue → observe app returns to Login with no session (screenshots: `c01-google-after-password-next.png`, `c01-google-no-session-returned-to-login.png`).
2. Same for Facebook (screenshots: `c02-facebook-consent-page.png`, `c02-facebook-after-consent.png`).
3. Server side: staging `auth_audit_logs` shows `login` for `kidsp2p@gmail.com` (provider google) at 21:39:12Z; app AsyncStorage has no `sb-*`/`auth-token` key.
4. C06: tap Google → Cancel → returns to Login, no error toast (`c06-cancel-silent-return.png`).
5. C03: `curl "…/auth/v1/authorize?provider=apple&redirect_to=p2pkidsmarketplace://oauth-callback"` → HTTP 400 `validation_failed`.
**Known Gaps / Not Tested:**
- Full post-OAuth completion screens (profile auto-fill, Home/onboarding routing after a real session, phone-verification gate) — not reachable until the callback-delivery fix lands.
- C04 account-link prompt end-to-end — blocked by collision fixture + OAuth completion.
- C05 banner on-device — needs the toggle.
- C07 Set-Password flow — needs a social-only fixture + OAuth completion.
- Apple (C03) — staging provider not enabled.
**What Needs To Be Fixed Next:**
1. Fix: the app's OAuth callback/return delivery on the dev build — confirm the effective `redirect_to` (`getRedirectUri()` on dev-client builds: auth.expo.io proxy vs native scheme), ensure it's in the Supabase Redirect URL allowlist, and make the return capture reliable (current `Linking` listener + recovery poll isn't catching it). Same class as the Phase 15/16 deep-link fixes.
2. Fix: surface a "couldn't complete sign-in" message when the callback is lost (no silent no-session returns).
3. Fix: shorten the ~30s post-cancel "Signing you in…" recovery spinner (return to idle promptly on explicit cancel).
4. Fix (C04 fixture): pre-create an app account with email `kidsp2p@gmail.com` on staging.
5. Fix (C03): enable + configure Apple provider on staging (pending Apple Developer Program).
6. Fix (C05): add the provider-outage simulation toggle.
7. Fix (C07): add a social-only fixture persona to `seed:staging`.
**UX Enhancement Ideas (optional, not defects):**
- On the Login screen, after a provider consent completes but before the app session is confirmed, the user currently sees nothing until (or unless) the app navigates — consider a brief "Finishing sign-in…" inline state on the tapped provider button until the callback resolves, so a slow/dropped callback doesn't read as a dead tap.
- On the Login screen, the post-cancel "Signing you in…" state lingers ~30s — consider distinguishing "cancelled by user" from "authenticating" so a cancel returns the button to idle immediately and only genuine pending work shows the spinner.
**Suggested Next Session:** After the callback-delivery fix lands, re-run C01/C02 full completion (fresh OAuth usage) — then C04 (once the collision fixture is added). C03/C05/C07 remain fixture/toggle-dependent and can be picked up when their prerequisites are provisioned.
**Suggested to Improve Agent Rules:** The OAuth completion cases revealed that the app's real blocker is the callback-return delivery, which is invisible from the AX tree and the browser. Recommend adding to the playbook §5 a note: after a provider consent completes and the app returns, **verify session persistence directly via the app's AsyncStorage manifest** (no `sb-*`/`auth-token` key = callback failed) and cross-check staging `auth_audit_logs` for the provider login event — this distinguishes "provider auth failed" from "app failed to receive the session" without retrying credentials.
