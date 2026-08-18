# Phase 18 — AUTH Group C (Social Login) — QA Test Report

**Run:** 2026-08-16 · iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1 · dev build + Metro · staging Supabase `drntwgporzabmxdqykrp`.
**Canonical guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — Group C (AUTH-TC-C01…C07).
**Evidence:** `e2e-test-results/phase18-auth-group-c-social-login-2026-08-16/evidence/`.
**Session outcome:** 0 PASS / 3 FAIL / 4 BLOCKED / 0 SKIPPED.

---

## Executive summary (read first)

**Social login is completely broken in the current app build.** Tapping any of the three social buttons (Google / Facebook / Apple) on **both** the Login and Signup screens throws `OAUTH_INIT_FAILED` before the provider consent browser ever opens, and gives the user **zero on-screen feedback** (the failure is only visible in the dev LogBox console).

**Root cause (HIGH, app bug):** `src/services/oauthService.ts` extracts the CSRF `state` token from the URL returned by `supabase.auth.signInWithOAuth`. With supabase-js **2.89.0** and `skipBrowserRedirect: true`, that URL is the Supabase `/auth/v1/authorize?provider=…` endpoint URL, which **does not carry a `state` param** (the state only appears in the server's 302 `Location` → external provider URL, which the client never sees). `extractStateFromOAuthUrl()` therefore returns `null` → `initiateSocialLogin` returns `{url, state: ''}` → `SocialLoginButtons`' guard `if (!initResult?.state || !initResult?.url) throw new Error('OAUTH_INIT_FAILED')` fires **before the browser opens**. This is a supabase-js v1→v2 migration regression and is **not environment-specific** (it would break release builds too).

A second, independent blocker: the **Apple provider is not enabled** on the staging project — a direct call to the staging `/auth/v1/authorize?provider=apple` returns `400 validation_failed: "Unsupported provider: provider is not enabled"`. Google and Facebook ARE server-enabled (both return 302 → valid consent URLs).

Consequently the three end-to-end OAuth completion cases (C01–C03) FAIL, and the four dependency cases (C04 account-link prompt, C05 provider-outage banner, C06 OAuth-cancel silent return, C07 social-only set-password) are BLOCKED because the flow can never reach the state they need.

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-C01 | AUTH (Group C) | **FAIL** | Google tap → `OAUTH_INIT_FAILED`; consent browser never opens; silent to user |
| AUTH-TC-C02 | AUTH (Group C) | **FAIL** | Same app bug for Facebook (server-side 302 works) |
| AUTH-TC-C03 | AUTH (Group C) | **FAIL** | Same app bug + Apple provider NOT enabled on staging (400) |
| AUTH-TC-C04 | AUTH (Group C) | **BLOCKED** | Needs completed OAuth w/ existing email — unreachable (also guide modal not wired) |
| AUTH-TC-C05 | AUTH (Group C) | **BLOCKED** | Provider-outage banner not inducible (no toggle; flow dies earlier) |
| AUTH-TC-C06 | AUTH (Group C) | **BLOCKED** | Provider screen never opens → cancel path unreachable |
| AUTH-TC-C07 | AUTH (Group C) | **BLOCKED** | Needs social-only fixture user — registry gap + depends on C01–C03 fix |

**Roll-up:** 0 PASS / 3 FAIL / 4 BLOCKED / 0 SKIPPED.

---

## Perceived load-time table

> Label: **Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.**

| Screen → transition | Elapsed | Notes |
|---|---|---|
| Landing → Login | ~1–2s | In-app push; fine |
| Login → Signup | ~1s | In-app push; fine |
| Login → Google consent | **N/A** | Browser never opened (OAUTH_INIT_FAILED) |
| Login → Facebook consent | **N/A** | Browser never opened (OAUTH_INIT_FAILED) |
| Login → Apple consent | **N/A** | Browser never opened (OAUTH_INIT_FAILED) |
| Signup → Google consent | **N/A** | Browser never opened (OAUTH_INIT_FAILED) |
| Cold launch (relaunch) → Landing | ~5–10s | Dev-build bundle load; environment artifact (not app behavior) |

No timed transition reached the ≥3s flag threshold for app behavior; the only slow path is the dev-build cold-start bundle load (environment artifact, not a product regression).

---

## Per-case traces

### AUTH-TC-C01 · Sign in / Continue with Google — **FAIL**

**Guide expected result:** A browser opens the Google sign-in/consent page; after success a session is created; first-time signup auto-fills the profile and skips email verification.

**Execution trace:**
1. Clean launch → Landing (clean state, no LogBox).
2. Tap `landing-login-button` (220,721) → Login screen. Social row renders (G / Apple / f icon buttons) but the buttons are **absent from the AX tree** (plain `Pressable` w/ `testID`, no `accessible`/`role`/`label` — BP-53 gap). Screenshot `01-login-screen.png`; pixel-scan → Google button at pt (150,358).
3. Tap Google (150,358). Poll → AX tree shows LogBox `[SocialLoginButtons] Unexpected error: Error: OAUTH_INIT_FAILED` (count 2). Screenshot `03-login-social-oauth-init-failed.png`. **No browser opens; no user-visible error.**
4. Repeat on Signup: tap `login-signup-link` → Create Account; pixel-scan → Google at pt (154,327); tap → same `OAUTH_INIT_FAILED` (count 8). Screenshot `05-signup-social-oauth-init-failed.png`.
5. Server check: `curl …/auth/v1/authorize?provider=google&redirect_to=p2pkidsmarketplace://oauth-callback` → **HTTP 302** `Location: https://accounts.google.com/…&state=<uuid>` → Google IS enabled and the redirect URL IS allowed; the server returns a valid consent URL with state.
6. App-side repro: app's supabase-js 2.89.0 `signInWithOAuth` returns `data.url = https://…/auth/v1/authorize?provider=google&redirect_to=…&scopes=…&prompt=select_account` — **no `state` param** → `extractStateFromOAuthUrl` → null → guard throws `OAUTH_INIT_FAILED`.

**Assert result:** FAIL — the expected "browser opens the Google consent page" does not happen. Evidence: screenshots `03`, `05`; device log `[SocialLoginButtons] Unexpected error: Error: OAUTH_INIT_FAILED`; node repro of supabase-js URL shape.

### AUTH-TC-C02 · Sign in / Continue with Facebook — **FAIL**

**Guide expected result:** A session is created (and on first signup the profile is auto-filled from Facebook).

**Execution trace:**
1. On Login, tap Facebook (285,358) → AX tree shows `OAUTH_INIT_FAILED` (count 4). No browser opens.
2. Server check: `…/auth/v1/authorize?provider=facebook&redirect_to=p2pkidsmarketplace://oauth-callback&scope=public_profile,email` → **HTTP 302** `Location: https://www.facebook.com/dialog/oauth?…` → Facebook IS server-enabled.

**Assert result:** FAIL — same app-side bug (shared code path with C01); Facebook never reaches the consent screen.

### AUTH-TC-C03 · Sign in / Continue with Apple — **FAIL**

**Guide expected result:** Apple button present on both platforms; authentication succeeds and a session is created.

**Execution trace:**
1. **Button presence (iOS):** Apple icon button present on Login (pt 225,358) and Signup (pt 220,324) — visually confirmed via screenshots `01`, `04`. (Android out of scope for this agent.)
2. Tap Apple (225,358) on Login → `OAUTH_INIT_FAILED` (count 6). No browser opens.
3. Server check: `…/auth/v1/authorize?provider=apple&redirect_to=p2pkidsmarketplace://oauth-callback&scope=name email` → **HTTP 400** `validation_failed`, body `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}` → **Apple provider is NOT enabled on the staging project.** Independent second blocker: even after the C01 bug is fixed, Apple will fail until the provider is configured in the Supabase dashboard.

**Assert result:** FAIL — Apple flow never initiates; plus staging has no Apple provider enabled.

### AUTH-TC-C04 · Existing-email account-link prompt — **BLOCKED**

**Why blocked:** The "Account Exists" prompt only fires after a completed OAuth flow whose provider email matches an existing email/password account (guide actor: `test-free`). Because C01–C03 never complete OAuth (OAUTH_INIT_FAILED), this state is unreachable on-device.

**Code-verified (not executable):** `LoginScreen.handleAccountExists` → `Alert.alert('Account Exists', 'An account with {email} already exists. Link {provider} in Linked Accounts after login.', ['Continue with Email'])`; `SignupScreen` equivalent says "…Continue to Login and link {provider}." **Doc drift:** the guide's C04 expected result describes the `AccountLinkingPrompt` modal ("…with an option to continue and link the provider… password re-authentication"), but `src/components/auth/AccountLinkingPrompt.tsx` is **not wired** into either auth screen — the implemented prompt is a plain `Alert.alert` with only a "Continue with Email" button and no actual linking/re-auth action. Needs dev clarification.

### AUTH-TC-C05 · Provider unavailable → email fallback banner — **BLOCKED (not inducible)**

**Why blocked:** The fallback banner (`provider-unavailable-banner` + "Use Email" CTA, `provider-error-cta`) only renders on `ProviderUnavailableError` (server 5xx or initiation timeout) inside `SocialLoginButtons.handleSocialLogin`. There is no staging toggle for it (unlike the S03/S04 auth toggle), and the current flow dies earlier at `OAUTH_INIT_FAILED`, which does **not** set the banner. Not inducible on healthy staging without either a real provider outage or a simulation toggle (dev-team fixture). Also note the design intent mismatch: an init failure (the actual failure mode here) gives no banner at all — see cross-cutting finding UX-1.

### AUTH-TC-C06 · User cancels OAuth — silent return — **BLOCKED**

**Why blocked:** The cancel path requires the provider consent screen to be open so the user can cancel/deny. The browser never opens (OAUTH_INIT_FAILED), so the cancel scenario is unreachable. Code-verified (not executable): `SocialLoginButtons` handles a dismissed auth session by polling `supabase.auth.getSession()` up to 60×500 ms for a recovered session and then returning silently — the intended silent-return behavior exists but cannot be exercised until the C01 bug is fixed. (Secondary observation: the current init-failure path does return to the screen with no toast, but that is the failure path, not the user-cancel path.)

### AUTH-TC-C07 · Social-only user sets a password — **BLOCKED (setup gap)**

**Why blocked:** Requires a **social-only user** (auth identity with no password, created via a completed social login). (a) Social login is broken (C01–C03), and (b) no social-only persona exists in the standing registry (`/memories/repo/qa-test-accounts.md` — registry gap; flagging rather than guessing credentials). Surface code-verified: `LinkedAccountsScreen` renders `set-password-button` for social-only users; `SetPasswordModal` implements live strength validation (`validatePasswordStrength`), strength meter, mismatch rejection ("Passwords do not match"), and submit disabled until strong. A social-only fixture (dev-team seed) + the C01 fix are both required before this case can run.

---

## Cross-cutting UX findings

**UX-1 — Silent failure on a broken action (HIGH, wording/structure).** Tapping any social button that fails does nothing visible: no toast, no banner, no disabled state persistence, no "try email instead" hint. A parent/guardian tapping "Continue with Google" and seeing nothing happen has no idea whether the tap registered, is loading, or failed. The existing `provider-unavailable-banner` covers only server-side provider outage (5xx/timeout), not init failures. **Recommended:** map `OAUTH_INIT_FAILED` (and other init failures) to the existing banner/error surface with a concrete message, e.g. **"Social sign-in couldn't be started right now. Sign up with email instead?"** + the `Use Email` CTA, or at minimum a transient "Something went wrong starting Google sign-in. Please try again." toast.

**UX-2 — Icon-only social buttons with no labels (MED, structural/affordance).** The guide's copy ("Sign in with Google" / "Continue with Google") does not match the app's rendered icon-only buttons (G / Apple logo / f) with **no text labels and no accessibility labels** (`accessible`/`accessibilityRole`/`accessibilityLabel` absent — invisible to the iOS AX tree, BP-53 gap). For the parent/guardian audience, an unlabeled "G" / "f" can be ambiguous. `ProviderButton.tsx` (labeled variant) already exists but is not wired in. **Recommended:** wire `ProviderButton` (or add labels under the icons) and add `accessible`/`role="button"`/`label` to `SocialLoginButtons` icon buttons; label = "Continue with Google" (signup) / "Sign in with Google" (login), etc.

## Cross-cutting design-system compliance (vs. `docx/design-system-passitup.md`)

- **Login screen** — compliant: `Log In` primary button sampled **#5DBB8E** (RGB 93,187,142 = documented primary green); social icon buttons match §4.5 (50×50 circular, white bg, `#E0E0E0` border, subtle shadow, G/f 20px semibold `#1A1A1A`, Apple logo glyph); filled inputs; "or" divider matches §4.6 (line–or–line, 13px regular `#6B6B6B`, lowercase).
- **Signup screen** — compliant: header "Create Account", subtitle "Join the Kids P2P Marketplace"; same social row + divider; filled inputs; green primary.
- **Minor doc-internal inconsistency (not a deviation vs. either spec, but note it):** §4.5 describes a "Or continue with" label above the social row, while the app renders the §4.6 "or" divider. The app matches §4.6 exactly; the §4.5 label variant is unimplemented.
- **No dialogs/toasts/pop-ups were reachable** this run (the OAuth failure produces no dialog — dev-only LogBox), so no modal compliance findings.

---

## Locator-gap findings

| Element | Gap | Fallback used | Recommended fix |
|---|---|---|---|
| `google-login-button` / `apple-login-button` / `facebook-login-button` | Plain `Pressable` + `testID`, no `accessible`/`accessibilityRole`/`accessibilityLabel` → invisible to iOS AX tree (BP-53) | Pixel-scan of the icon glyphs (Login pt 150/225/285, y358; Signup pt 154/220/285, y~326) | Add `accessible`, `accessibilityRole="button"`, and an `accessibilityLabel` ("Sign in with Google", etc.) to each icon button |

---

## Friction vs. operating rules

- **AX-tree staleness:** `mobile_list_elements_on_screen` returned large trees after the Signup navigation (written to temp file) but content was current; screenshots remained the ground truth for button location. No stale-tree conflicts this run.
- **LogBox as an evidence channel:** the dev LogBox notification text (`[SocialLoginButtons] Unexpected error: Error: OAUTH_INIT_FAILED`) surfaced in the AX tree and doubled as a useful error trace — but it also meant each failed tap incremented a LogBox counter. This is dev-only noise, not app UI.
- **In-app browser not reachable:** because the OAuth flow fails at initiation, the in-app `SFSafariViewController` (which would host the provider consent) was never exercised; driving an external consent screen remains infeasible without real provider credentials (per the brief's feasibility constraint).

---

## Recommended follow-ups (dev-side, ranked)

1. **Fix the `OAUTH_INIT_FAILED` regression (P0, blocks C01/C02/C03 + C04/C06/C07):** in `src/services/oauthService.ts`, `extractStateFromOAuthUrl` reads `state` from the returned authorize URL, which supabase-js 2.89.0 does not include (state lives in the server's 302 Location). Decide the correct CSRF posture for supabase-js v2 — either (a) rely on supabase-js's own internal state handling and drop the app-side pre-check (validate on the callback instead), or (b) derive/validate the state from the callback URL, not the init URL. Do not block the browser open on a state that can never be present.
2. **Enable/configure the Apple provider on staging (`drntwgporzabmxdqykrp`)** — authorize returns `400 "provider is not enabled"`. Without this, C03 cannot pass even after fix #1. (Also confirm the exact redirect URL `p2pkidsmarketplace://oauth-callback` is registered in Auth → URL Configuration; the direct calls suggest it is accepted for Google/Facebook.)
3. **Surface init failures to the user (UX-1):** map `OAUTH_INIT_FAILED` to the existing banner/error surface with concrete copy ("Social sign-in couldn't be started right now. Sign up with email instead?") instead of a silent no-op.
4. **Instrument + label the social buttons (UX-2 / locator gap):** add `accessible`/`accessibilityRole`/`accessibilityLabel` and visible labels (or wire `ProviderButton`); addresses both the AX-tree gap and parent/guardian clarity.
5. **Reconcile C04 doc drift:** decide whether the `AccountLinkingPrompt` modal should be wired into Login/Signup `handleAccountExists` (guide expects an account-link prompt with continue+link options) or whether the plain `Alert.alert` is the intended product behavior — update the guide accordingly.
6. **Add a provider-outage simulation toggle** for C05 (mirror the S03/S04 `qa_reset_error_simulation` pattern) so the `provider-unavailable-banner` can be verified without a real outage.
7. **Add a social-only fixture persona** to `seed:staging` (registry gap) so C07 is executable after fix #1.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-C01–C07 (Group C — Social Login: Google, Facebook, Apple, account-link prompt, provider-unavailable fallback, OAuth-cancel silent return, social-only set password)
**Design-System Compliance:** PASS on reachable screens — Login and Signup screens match `design-system-passitup.md` (primary green `#5DBB8E` button verified by pixel sample; social buttons match §4.5; "or" divider matches §4.6; filled inputs). No dialogs/toasts reachable this run (OAuth failure is silent — dev LogBox only). Minor note: §4.5's "Or continue with" label variant is unimplemented (app uses §4.6 "or" divider); not a deviation from either spec.
**Perceived Load-Time Verdict:** GOOD for reachable app transitions (Landing→Login ~1–2s, Login→Signup ~1s); the consent-browser transitions were N/A (browser never opens due to the app bug). Cold-launch ~5–10s is a dev-build bundle-load environment artifact, not app behavior. No app-behavior transition reached 3s.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Login screen: wording/layout match design-system requirements (title/subtitle, icon social row, divider, filled inputs, green primary CTA).
- CONFIRMED — Signup (Create Account) screen: wording/layout match design-system requirements.
- DEVIATION — Social login icon buttons (both screens): icon-only with no text labels and no accessibility labels; invisible to the iOS AX tree (BP-53) — the guide's "Sign in with Google / Continue with Google" labeled-button copy does not match the rendered UI.
- DEVIATION — Social login failure UX (both screens): a failed social-login tap (the actual failure mode) is completely silent to the user — no toast/banner/feedback; the provider-unavailable banner never shows for init failures.
**Verdict Summary:** 0 PASS / 3 FAIL / 4 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. **P0 app bug — social login is fully broken:** all three provider buttons throw `OAUTH_INIT_FAILED` before the consent browser opens (supabase-js 2.89.0 returns the state-less authorize URL; `extractStateFromOAuthUrl` → null → guard throws). C01/C02/C03 FAIL; blocks C04/C06/C07.
2. **P1 — Apple provider not enabled on staging:** authorize returns `400 "Unsupported provider: provider is not enabled"` — C03 stays broken even after the P0 fix.
3. **P1 UX — silent failure:** a broken social-login tap gives the user zero feedback.
4. **P2 locator/accessibility gap:** icon-only social buttons have no `accessible`/role/label → invisible to the AX tree; unlabeled icons are ambiguous for the parent/guardian audience.
5. **P2 doc drift (C04):** guide expects an `AccountLinkingPrompt` modal, but Login/Signup implement a plain `Alert.alert` with only "Continue with Email"; the modal component is not wired.
**App State Left Behind:** App left logged-out at Landing (clean relaunch; no LogBox). **No accounts created, no credentials changed, no data written** — the run was read-only + UI interaction only. Staging config untouched (Apple provider remains disabled; no toggles armed).
**Why It Matters:** This run proves that the app's social-login entry points are currently **non-functional** (all three providers fail at initiation with a silent no-op), so any user attempting Google/Facebook/Apple sign-in today gets no result and no explanation. It also surfaces an independent staging gap (Apple provider not enabled) and a UX gap (no failure feedback). Until the P0 fix lands, the "social login" capability is effectively dead in the product.
**How to Verify/Reproduce:**
1. Launch the dev build → Log In (or Get Started → Create Account).
2. Tap the Google (or Facebook/Apple) circular icon. Expected: consent browser opens. Actual: nothing visible; dev LogBox shows `[SocialLoginButtons] Unexpected error: Error: OAUTH_INIT_FAILED` (screenshots `03-login-social-oauth-init-failed.png`, `05-signup-social-oauth-init-failed.png`).
3. Server side: `curl "https://drntwgporzabmxdqykrp.supabase.co/auth/v1/authorize?provider=apple&redirect_to=p2pkidsmarketplace%3A%2F%2Foauth-callback"` → 400 "provider is not enabled"; same with `provider=google` → 302 (enabled).
4. Repro of root cause: app's supabase-js 2.89.0 `signInWithOAuth({provider:'google', options:{skipBrowserRedirect:true}})` returns `data.url` = authorize URL with no `state` param.
**Known Gaps / Not Tested:**
- Full OAuth completion (consent → session → profile auto-fill) for any provider — blocked by the P0 bug; additionally needs real provider test credentials (none documented in the registry — registry gap).
- C04 account-link prompt, C05 provider-outage banner, C06 OAuth-cancel, C07 social-only set-password — blocked (unreachable states) as detailed above; C05 also needs a simulation toggle; C07 needs a social-only fixture.
- Android button presence for C03 — out of scope for this agent (Milestone 2 cloud fleet decision).
**What Needs To Be Fixed Next:**
1. Fix: `oauthService.ts` state extraction — do not gate the browser open on a `state` param that supabase-js 2.89.0 never returns from `signInWithOAuth` (rely on supabase-js internal state + validate on callback, or derive state from the callback URL).
2. Fix: enable + configure the Apple provider on staging Supabase Auth (currently returns `400 "provider is not enabled"`).
3. Fix: surface OAuth init failures to the user (map `OAUTH_INIT_FAILED` to the existing banner/toast with concrete copy) — no silent no-ops.
4. Fix: add `accessible`/`accessibilityRole="button"`/`accessibilityLabel` (and ideally visible labels or the wired `ProviderButton`) to the three social icon buttons.
5. Fix: reconcile the C04 account-exists UX (wire `AccountLinkingPrompt` modal or confirm the plain Alert is intended; update guide copy).
6. Add: a provider-outage simulation toggle (S03/S04 pattern) for C05.
7. Add: a social-only fixture persona to `seed:staging` for C07.
**UX Enhancement Ideas (optional, not defects):**
- On the Login/Signup social row, taps currently give no visible feedback while the OAuth initiation runs (buttons only disable) — consider a brief per-provider loading state (spinner ring on the tapped icon) so the parent/guardian knows the tap registered, reducing perceived dead-taps.
- On the Login/Signup social row, the icons are unlabeled — consider adding a small text label under each icon ("Google", "Apple", "Facebook") to aid the parent/guardian audience beyond accessibility labels.
- Consider an inline hint under the social row on first visit (e.g., "Prefer to sign in with Google, Apple, or Facebook?") to make the alternative sign-in path discoverable.
**Suggested Next Session:** After the P0/P1 fixes land (state-extraction fix + Apple provider enabled), re-run Group C — first a smoke pass to confirm the consent browser opens for Google/Facebook/Apple, then C06 (cancel → silent return) which becomes executable, then C01–C03 completion pending real provider test accounts.
**Suggested to Improve Agent Rules:** The social-login group required reading the app's OAuth service + supabase-js behavior to diagnose `OAUTH_INIT_FAILED`; recommend adding to the playbook §4 a note to read `src/services/oauthService.ts` + `oauthProviderConfig.ts` before any social-login run (the state-extraction/skipBrowserRedirect behavior is version-sensitive), and to treat a dev LogBox `console.error` as a legitimate first-pass failure trace when no user-facing dialog appears.
