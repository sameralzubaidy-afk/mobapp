# Phase 20 — AUTH Group C Formal Closure (C01/C02/C04) — Execution Retrospect & Bottleneck Analysis

**Purpose:** This document is the full decision-and-outcome log of the QA Test Agent's Phase 20 execution (AUTH Group C close-out: C01 Google, C02 Facebook, C04 account-link, against the "fixed build"). It exists to be fed to an AI agent so it can identify the **bottlenecks, challenges, and reasoning patterns** the executing agent went through — with every key action, the reasoning behind it, the tool calls that mattered, and the outcome. Use it to derive: (a) what slows execution, (b) what patterns an agent should adopt proactively, and (c) what instrumentation/fixture work removes the friction.

**Source run:** 2026-08-16 · iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1 · dev build + Metro · staging Supabase `drntwgporzabmxdqykrp`.
**Canonical guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — Group C (AUTH-TC-C01, C02, C04).
**Primary evidence:** `e2e-test-results/phase20-auth-group-c-closure-2026-08-16/report.md` + `/evidence/`
**Session outcome:** 1 PASS (C02) / 1 FAIL (C01, single-attempt) / 1 BLOCKED (C04) / 0 SKIPPED.
**Credentials:** `google-oauth-test-user` + `facebook-oauth-test-user` (referenced by name, never echoed); **1 attempt each this session, 0 passwords typed** (both providers served cached returning-user consent). Cumulative: Google ×3, Facebook ×4.

---

## 1. Session at a glance

| Item | Detail |
|---|---|
| Task | Formally close AUTH-TC-C01 (Google) + C02 (Facebook) against the OAuth-callback-delivery-fixed build; investigate C04 (account-link); minimize real-credential use (max 1 attempt per provider) |
| Method | Three-layer rigor per case + §5.11 session verification (AsyncStorage manifest + staging auth logs); Step-1 investigate-before-acting on the user's current DB state; credential-sparing design |
| Environment | iOS Simulator (dev build over Metro), staging Supabase; OAuth via real Google/Facebook returning-user consent (cached sessions) |
| Final state | App terminated, left logged-out at Landing (AsyncStorage empty); **no accounts created** (GoTrue signup probe rejected 422); staging unchanged except the two expected server-side login side effects |
| Execution style | Fully autonomous: `mobile-mcp` (list/tap/type/swipe/screenshot), terminal (simctl, osascript, python), read-only staging DB (execute_sql), GoTrue API probe, memory files |
| Biggest surprise | Two NEW tooling blockers that the Phase 17 retrospect assumed were solved: **(1) screenshots were NOT viewable this session** (image URIs returned non-parseable content — §5.9's screenshot-ground-truth was unavailable), and **(2) the app's JS console logs were not capturable** (absent from the unified log; Metro message socket connected but silent; `/logs` returns web HTML) — so the exact C01 OAuth exchange error could not be extracted. Plus the **Create Account form coordinate-tap instability** returned (the §5.2 class), costing 5 relaunches before pivoting to a GoTrue-level backend check. |

---

## 2. Execution chronology (every phase, in order, with reasoning)

### 2.0 — Context acquisition (reasoning: playbook + code before device)

- **Actions:** Read the QA Test Agent operating playbook (§4–§9); read memory files `qa-test-accounts.md`, `qa-test-agent.md`, `phase18-auth-group-c-facts.md`, `locator-conventions.md`; read the AUTH guide Group C verbatim; then — per the Phase 18 OAuth pre-read requirement — read `oauthService.ts`, `oauthProviderConfig.ts`, `SocialLoginButtons.tsx`, `AccountLinkingPrompt.tsx` in full; read `AuthContext.refreshSession`, `AppNavigator.tsx` RootNavigator, `educationAnalyticsService.shouldShowOnboarding`, and `accountService.checkAccountExists`.
- **Reasoning:** The fixed build's OAuth return behavior is version-sensitive and had already flipped twice (Phase 18 P0 state-gating bug; Phase 19 callback-delivery failure). I had to know exactly what the fixed `getRedirectUri()` returns (native `p2pkidsmarketplace://oauth-callback` on dev builds), how `handleOAuthCallback` establishes a session (code exchange + 20×300ms poll), how `checkAccountExists` decides the collision branch, and how the RootNavigator routes a returning user (onboarding gate) — before tapping anything.
- **Outcome:** Established a precise behavioral model: returning-user OAuth login → same auth row → no collision prompt → `refreshSession` → profile exists → onboarding gate (skipped) → Home. Key predictions: C01/C02 should navigate to Home (not first-time auto-fill); C04's collision prompt (userId mismatch) is structurally impossible with a single-user email.
- **Key insight recorded:** `check_account_exists_by_email` RPC is **absent** from migrations + staging → `checkAccountExists` silently falls back to a current-user-only check. This matters for C04's collision detection.

### 2.1 — Environment bring-up (reasoning: session-verification primitives first)

- **Actions:** Confirmed the Phase 19 simulator (iPhone 17 Pro Max) online, app installed, Metro HTTP 200. Located the AsyncStorage manifest path (`…/RCTAsyncLocalStorage_V1/manifest.json`) and confirmed the **clean pre-run state (no `sb-*` auth-token)** — the §5.11 decisive instrument.
- **Reasoning:** Unlike Phase 17's UI-observation-heavy flow, OAuth completion success/failure is decided at the session layer, not the UI layer. The AsyncStorage manifest + staging auth logs are the ground truth that distinguishes "provider auth failed" from "provider succeeded but the app dropped the session."
- **Outcome:** Device ready; clean Landing (no LogBox). Evidence dir created at the workspace root (first attempt landed in `p2p-kids-marketplace/` due to a stale cwd — fixed immediately).

### 2.2 — Step 1: Investigate before acting (reasoning: don't assume returning vs first-time)

- **Actions:** Read-only staging DB queries: `auth.users` for `kidsp2p@gmail.com`, its identities, `encrypted_password` presence, `profiles` rows, wallet/subscription/preferences, and the live `on_auth_user_created` trigger.
- **Reasoning (the brief's explicit Step-1 demand):** the email already has Google+Facebook identities from Phase 19 — I must determine whether a full OAuth login is a *returning-user* login or a *first-time* signup before claiming anything about profile auto-fill.
- **Outcome (the facts):** single `auth.users` row created **2026-05-02 via Google** (Facebook identity 2026-05-03), **social-only** (`has_password: false`), confirmed, `last_sign_in_at` 2026-08-16 22:37:53. A `profiles` row **exists** (created 2026-05-02, name "KidsP2P", `onboarding_skipped_at` set 2026-08-16 22:22:30). **Conclusion: this is a RETURNING-USER login; the first-time profile auto-fill sub-behavior cannot be freshly exercised with this email** — reported explicitly (needs a fresh never-used email), not silently claimed covered.
- **⚠️ Investigation bug (corrected, honest note):** my first probe keyed `profiles` on `id` instead of `user_id` and reported "no profile" (which would have predicted the app drops the session). Correcting to `user_id` (the FK; the profiles PK is a separate `id`) showed the profile exists. This directly reversed a would-be wrong conclusion and is a durable query-key lesson.

### 2.3 — C01 Google (one permitted attempt)

- **Actions:** Login → tap `google-login-button` (151,347) → native iOS prompt **"«PassItUp» Wants to Use «supabase.co» to Sign In"** → Continue → Google **"Choose an account"** chooser listing `kidsp2p@gmail.com` → tap account → browser closes → app returns to Login with Google in "Signing you in…" → failure banner **"We couldn't complete your sign-in. Please try again."** + `Use Email` CTA.
- **Verification (the three instruments):** (a) staging `auth_logs` → `login`, provider `google` @ **22:32:52Z** (provider auth COMPLETED); (b) device log → `Found application: com.sameralzubaidi.p2pmarketplace to handle url scheme: p2pkidsmarketplace` + "able to handle Callback" (callback DELIVERED — the Phase 19 fix holds); (c) AsyncStorage → **no `sb-*` token** (no session). The `_UIViewServiceHostSessionErrorDomain Code=4` line was correctly read as benign teardown (§5.11), not failure.
- **Reasoning on verdict:** the hard assertion "a session is created" was not met → FAIL on this attempt. Because the identical code path succeeded for Facebook (C02), the Google failure is **attempt-specific** (app-side exchange/session-set), not systematic. **Not retried** (credential-sparing) — documented as a single-attempt observation needing one more Google completion to confirm reproduce-vs-transient.
- **Bottleneck (NEW, HIGH): the exact JS error could not be captured** — RN `console.*` was absent from the unified device log; a Metro message-socket capture (`ws://localhost:8081/message`) connected but received nothing; the `/logs` HTTP endpoint returned the Expo web HTML. So C01's root cause could not be narrowed to exchange-vs-session-poll, and the classification leans on the pattern-match (C02 success) rather than the error string.

### 2.4 — C02 Facebook (one permitted attempt)

- **Actions:** Login → tap `facebook-login-button` (286,398) → native iOS prompt → Continue → Facebook consent **"You previously logged into p2pmarketplace with Facebook. Would you like to continue?"** + **Continue as Sam** (App ID 2443740446072876) → tap → browser closes → "Signing you in…" → **Home (Dashboard)**.
- **Verification (all three pass):** (a) `auth_logs` → `login`, provider `facebook` @ **22:37:53Z**; (b) AsyncStorage → `sb-drntwgporzabmxdqykrp-auth-token` **present**; (c) app navigated to Home (correct — profile exists, onboarding skipped). Perceived load time consent→Home **~6–10s** (app-side exchange + navigation, "Signing you in…" shown throughout).
- **Reasoning on verdict:** all assertions met (browser opens, auth completes, real session, correct navigation) → **PASS, genuinely closed**. Note: returning-user login, not first-time (consistent with Step 1).

### 2.5 — C04 account-link investigation (reasoning: no separate credential attempt — reuse + backend)

- **Actions:** QA logout deep link (`p2pkidsmarketplace://qa-logout`) → clean Landing. Attempted the Create Account UI form to observe the duplicate-email rejection on-device — **5 attempts, all corrupted by the form-focus/scroll issue** (below). Pivoted to the **GoTrue endpoint the UI calls** (`POST /auth/v1/signup`, body `{email: kidsp2p@gmail.com, password: …}`) → **HTTP 422 `user_already_exists` / "User already registered"** (saved to evidence). Confirmed **no account created** (non-mutating rejection).
- **Reasoning:** the brief asked whether a distinct password account is creatable for the OAuth email; the DB already proved one-user-per-email (single confirmed row), and the GoTrue probe empirically confirmed the UI would be rejected. This is the "real account-merging behavior" deliverable (no silent merge, no duplicate — hard 422).
- **Outcome:** **C04 BLOCKED (fixture/architecture)** — the collision prompt requires the OAuth session user to differ from a same-email password account, which is impossible with this email via UI. The Phase 19 note's "UI password signup for kidsp2p@gmail.com" is **proven infeasible**. Needs a dev-provisioned non-UI collision fixture.

### 2.6 — Wrap-up

- **Actions:** terminated the app; verified clean logout state (AsyncStorage empty); wrote `report.md` (full §8 + complete §8.3 handoff, emitted verbatim in chat); updated repo memory (`phase20-auth-group-c-facts.md` created; `qa-test-accounts.md` registry updated with the 422 finding + cumulative credential usage); cleaned the stray Metro-capture script from the repo.
- **Reasoning:** leave the shared simulator/repo/DB in the documented pre-run state; record verified facts so the next session doesn't re-discover them.

---

## 3. Bottlenecks & challenges (the core deliverable)

Each entry: **symptom → root cause → cost → handling → follow-up needed.**

### P1. Screenshots unusable as ground truth (NEW, HIGH — tooling)
- **Symptom:** `mobile_save_screenshot`/`view_image` returned image URIs (`vscode-chat-response-resource://…`) whose pixel content I could not parse this session. The Phase 17-proven "screenshot-first navigation" (§5.9 source-of-truth) was unavailable.
- **Root cause:** tooling/environment change — the same tools that Phase 17 used successfully returned non-parseable content; unverified whether transient or persistent.
- **Cost:** every "is this really the screen?" question had to be answered via the AX tree + device/DB logs; the Google account-chooser, Facebook consent page, and the failure banner were all evidenced but never visually confirmed by me; dialog pixel-scanning (Phase 17's B2 technique) was impossible.
- **Handling adopted:** switched to **three independent non-visual channels**: AX tree (when not stale), simulator device log (`log show`), and staging DB/logs + AsyncStorage manifest. The §5.11 session check became the primary verdict instrument and was sufficient for the PASS/FAIL decision.
- **Follow-up:** verify at session start whether screenshot images are viewable; if not, codify the non-visual evidence chain (AX + device log + AsyncStorage + DB) as the fallback in the playbook.

### P2. App JS console logs inaccessible (NEW, HIGH — tooling)
- **Symptom:** RN `console.*` did not appear in `xcrun simctl log show` for the app process (only system-level lines); attempts to tap Metro's log stream failed — `/logs` returned the Expo web HTML (not an SSE stream), and a `ws://localhost:8081/message` capture connected (`METRO-WS-CONNECTED`) but received zero app messages.
- **Root cause:** RN dev `console.*` is routed to Metro's stdout (the `expo start` terminal on `ttys003`, not reachable from my session) and/or the Hermes inspector, not the unified OS log; the message-socket protocol doesn't relay raw client logs to arbitrary new clients the way I assumed.
- **Cost:** the **exact C01 OAuth exchange error was never captured** — `handleOAuthCallback` returned `success:false`, but I could not see whether it was "Failed to exchange OAuth code", "Failed to set session", or "Failed to get session after OAuth". C01's classification rests on the provider+callback evidence and the C02 (success) contrast rather than the error string.
- **Handling adopted:** documented the app-side failure precisely (banner + empty AsyncStorage + audit-log login) and flagged the error-string capture as a dev-side logging task (add logging to `handleOAuthCallback`'s catch so it surfaces in Metro).
- **Follow-up:** either run Metro in an accessible terminal (so its stdout is readable) or add a dev-gated network/log sink for the OAuth exchange; a one-line `console.error` in the catch path would have resolved C01's root cause instantly.

### P3. Create Account form coordinate-tap instability (dominant friction, HIGH — tooling/app interaction)
- **Symptom:** taps on the DOB row / password / confirm fields did not move focus; typed text landed in the still-focused phone (or name) field, corrupting it — 5 full relaunches. Root cause hunt: (a) first failures were consistent with the software keyboard covering the lower half; (b) after a Cmd+K keyboard toggle, one DOB probe landed correctly, then identical taps failed again.
- **Root cause (established):** the AX tree reports **content-space** coordinates (submit button at y1176 is below the 956pt viewport), while **focusing a field triggers an auto-scroll** that shifts the on-screen position of every field below the focused one — so a tap at a content-coordinate for DOB/password/confirm lands at the wrong on-screen spot and focus never leaves the currently focused field. The Cmd+K keyboard suppression and swipe-to-top reset were each unreliable (worked once, not repeatably), and the tree did not reliably refresh to the scrolled state.
- **Cost:** 5 relaunches (each ~5–10s bundle load + navigation) + ~30 tool calls, all to fill one form; ultimately abandoned for the GoTrue-level backend check.
- **Handling adopted:** per §5.2, never repair a corrupted field — terminate + relaunch each time; used the "DOB-first + per-field re-list verify" pattern where it helped; when the UI path became non-productive, **pivoted to the backend endpoint the UI calls** (GoTrue `POST /auth/v1/signup`) to get the definitive answer — a legitimate evidence-economy decision, documented.
- **Follow-up (instrumentation):** (a) a field-clearing primitive (Phase 17's B4 ask — still open); (b) an AX-tree "scroll-aware" coordinate read or a tap-by-identifier primitive; (c) consider reducing auto-scroll on this form (a UX/automation win); (d) the C04 dialog for the 422 still needs on-device observation once the form is submittable.

### P4. `query_logs` MCP flakiness (MED — tooling)
- **Symptom:** intermittent "Backend error! Retry your query" (the known Phase 19 friction) — hit 3 times this session.
- **Handling:** retried; and where persistent, used `execute_sql` against `auth.audit_log_entries` (which turned out to be an **empty DB table** — the "auth_audit_logs" referenced in Phase 19 is the unified-log source, not the DB table). The decisive `login` events were eventually captured from the `query_logs` source.
- **Follow-up:** none app-side; record that `auth.audit_log_entries` is not a usable audit source on this project.

### P5. Credential-sparing constraint shaping the design (strategic — the brief's core requirement)
- **Symptom:** max **one** provider attempt each this cycle; cumulative usage already elevated (Google ×2, Facebook ×3 before this session).
- **Handling adopted (the design):** one attempt each, designed to extract maximum value — full completion + three-instrument verification (AsyncStorage + audit log + navigation); C04 reused the C02 evidence + read-only DB + a non-credential GoTrue probe rather than a second OAuth attempt; no password was ever typed (both providers presented cached returning-user consent). The **GoTrue 422 probe was non-mutating** and required no credential.
- **Outcome:** the whole batch used **1 Google + 1 Facebook attempt (0 passwords typed)**; cumulative now Google ×3, Facebook ×4 — recorded in the registry for risk tracking.

### P6. Conflicting-evidence discipline (MED — reasoning pattern)
- **Symptom:** at multiple points the AX tree and the intended reality disagreed (stale tree showing Login while the browser/OS prompt was on top; tree showing "Signing you in…" during/after callback).
- **Handling adopted:** per §5.9, treated the screenshot as truth when available, and where screenshots were unusable (P1), resolved ambiguity via the device log + AsyncStorage + DB (the decisive channels for OAuth). Never submitted or asserted purely on a possibly-stale tree.

---

## 4. Techniques that worked (adopt proactively in future runs)

1. **Investigate the DB state before acting (Step 1).** Read-only queries of `auth.users` / `profiles` / identities / password-presence / onboarding flags determined returning-vs-first-time, the expected navigation (Home), and C04 feasibility — before a single tap. This is the highest-leverage move of the session.
2. **The §5.11 three-instrument session check.** AsyncStorage manifest (token present/absent) + staging `auth_logs` provider-login event + device-log callback-delivery line = an unambiguous PASS/FAIL decision independent of the UI. This is what separated "provider auth completed but app dropped the session" (C01) from "app completed the login" (C02) without retrying credentials.
3. **Device-log callback-delivery evidence.** `xcrun simctl log show` proved the `p2pkidsmarketplace://oauth-callback` scheme was dispatched to the app ("Found application … to handle url scheme", "able to handle Callback") — confirming the Phase 19 fix on-device, and correctly treating the Code=4 line as benign.
4. **Backend-endpoint pivot when the UI form is non-productive.** The GoTrue `POST /auth/v1/signup` probe gave the definitive duplicate-email answer (HTTP 422 `user_already_exists`) that the form was meant to surface — legitimate, non-mutating, and credential-free.
5. **Read the fixed build's code before executing.** `oauthProviderConfig.getRedirectUri()` (native scheme on dev builds), `handleOAuthCallback` (code exchange + poll), and `RootNavigator` routing made the on-device results interpretable rather than surprising.
6. **Clean-state discipline + honest single-attempt verdicts.** Terminate+relaunch on any corrupted field; FAIL (not BLOCKED) for a real assertion miss with the provider+callback confirmed; single-attempt observations flagged as needing one more run to confirm reproducibility.
7. **Evidence economy under a hard budget.** One provider attempt each; C04 reused existing evidence + a non-credential probe; cross-referenced instead of re-running.

---

## 5. What an AI agent should learn from this run

1. **Verify screenshot viewability at session start.** §5.9's "screenshot is the source of truth" is void when the tool returns non-parseable images — have a non-visual evidence chain (AX tree + device log + AsyncStorage + DB logs) ready.
2. **On long scrolling RN forms, the AX tree reports content-space coordinates; focusing a field auto-scrolls, invalidating taps for fields below it.** This is the direct descendant of Phase 17's focus-misdirection lesson and needs a codified playbook rule (scroll-reset + re-list before tapping any field below the focused one; per-field verify after every type).
3. **OAuth completion verdicts live in the session layer, not the UI.** AsyncStorage token + audit-log login + device-log callback delivery decide PASS/FAIL; the banner/UI is advisory. Never conclude from the UI alone.
4. **A JS-error-less app-side failure is still a real FAIL, but classify it honestly.** C01 failed at `handleOAuthCallback` with the exact error unknown; the report says so and asks for a logging fix, rather than inventing a root cause.
5. **Credential-sparing changes the test design, not just the count.** The whole batch was shaped around one attempt per provider (max-value completion, evidence reuse, backend probes instead of retries).
6. **Distinguish friction from app defects.** P1/P2/P3/P4 are tooling/fixture friction — reported as such, never as FAILs; the only app-facing defects are the C01 attempt-specific failure and the C04 fixture gap.

---

## 6. Session side effects / data created

- **No accounts created.** The GoTrue signup probe was rejected 422 (non-mutating); the Create Account form was never submitted.
- **Staging side effects (expected, from the two completed OAuth logins):** `kidsp2p@gmail.com` `last_sign_in_at` → 2026-08-16 22:37:53Z (Facebook); its profile `updated_at` → 22:37:53Z. Identities and rows otherwise unchanged.
- **App/simulator:** app terminated, left logged out (AsyncStorage has no `sb-*` token — verified). No `.env`/config/seed changes. A stray Metro-capture script I created was removed from the repo (repo restored to pre-run state).
- **Evidence:** `e2e-test-results/phase20-auth-group-c-closure-2026-08-16/evidence/` (login screen, Google account chooser, failure banner, Facebook consent, Home after login, GoTrue 422 JSON, form-friction screenshot).
- **Memory files updated:** `/memories/repo/phase20-auth-group-c-facts.md` (created), `/memories/repo/qa-test-accounts.md` (OAuth usage counts + C04-422 finding).

---

## 7. Suggested follow-ups (from this retrospect)

| # | Action | Owner |
|---|---|---|
| 1 | Capture + classify the C01 Google `handleOAuthCallback` failure (add `console.error` logging to its catch; run one more Google completion to confirm reproduce-vs-transient) | Dev |
| 2 | C04 collision fixture via a NON-UI mechanism (a password account + a separate OAuth identity sharing an email under a permitted config) — the "UI password signup for kidsp2p@gmail.com" suggestion is proven infeasible (422) | Dev |
| 3 | Add/confirm the `check_account_exists_by_email` RPC so email-collision detection (and C04's prompt) works as designed | Dev |
| 4 | Tooling: make screenshot images viewable (or codify the non-visual evidence chain); expose app JS console logs (run Metro in an accessible terminal or add a dev log sink); add a field-clearing primitive; add a scroll-aware/tap-by-identifier primitive for long forms | Tooling |
| 5 | Verify on-device how `SignupScreen` surfaces GoTrue's `user_already_exists` once a form can be submitted | QA/dev |
| 6 | First-time-signup profile auto-fill coverage needs a **fresh never-used OAuth email** (new registry persona) | QA/dev |
| 7 | Consider reducing focus-induced auto-scroll on the Create Account form (UX/automation win) | Dev |

---

*End of retrospect. Every section is grounded in the Phase 20 run's actual trace (see `report.md` and `/evidence/`); no steps were invented or omitted.*
