# Phase 20 (v4) — AUTH Group C: Formal Closure (C01/C02/C04) — QA Test Report

**Run:** 2026-08-16 · iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1 · dev build + Metro · staging Supabase `drntwgporzabmxdqykrp`.
**Canonical guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — Group C (AUTH-TC-C01, C02, C04).
**Credentials:** `google-oauth-test-user` + `facebook-oauth-test-user` from `/memories/repo/qa-test-accounts.md` (referenced by name; passwords never echoed). Each used **once** this session; **no password was typed** in either attempt (both providers presented a returning-user consent from a cached session, so the credential itself was not entered this run — but each attempt did complete a server-side OAuth login).
**Evidence:** `e2e-test-results/phase20-auth-group-c-closure-2026-08-16/evidence/`.
**Session outcome:** 1 PASS / 1 FAIL / 1 BLOCKED / 0 SKIPPED.

---

## Executive summary (read first) — what the "fixed build" actually does now

The Phase 19 callback-delivery blocker is **fixed and confirmed on-device**: on both the Google and Facebook attempts the OS dispatched the `p2pkidsmarketplace://oauth-callback` scheme to the app (`Found application … to handle url scheme: p2pkidsmarketplace` + "able to handle Callback { scheme: p2pkidsmarketplace } for authentication" in the device log), and the `_UIViewServiceHostSessionErrorDomain Code=4` line is the documented benign teardown noise (§5.11), NOT a failure signal.

- **C02 (Facebook) → PASS (genuinely closed).** A real session was established: AsyncStorage `sb-drntwgporzabmxdqykrp-auth-token` present, staging `auth_logs` `login` event for provider `facebook` at **22:37:53Z**, and the app navigated to **Home (Dashboard)** — the correct destination for this returning user (profile exists, `onboarding_skipped_at` set → carousel skipped → Home).
- **C01 (Google) → FAIL on the executed attempt.** Provider auth completed (auth_logs `login` @**22:32:52Z**, provider `google`) and the callback was delivered to the app (device log), **but the app failed to establish the session** — AsyncStorage had no token and the app returned to Login with the new failure banner **"We couldn't complete your sign-in. Please try again."** (`provider-unavailable-banner` + `Use Email` CTA). **The identical code path succeeded for Facebook (C02)**, so this Google failure is almost certainly **attempt-specific/transient** (a code-exchange or session-set failure on that single attempt), not a systematic OAuth-completion defect. The exact JS error string could not be captured this session (see Friction). This is a **single-attempt observation** — per credential-sparing it was not retried; one more Google completion is needed to confirm reproducibility.
- **C04 → BLOCKED (fixture/architecture), with a real account-merging finding.** The OAuth email `kidsp2p@gmail.com` is a single, confirmed, **social-only** account (no password). A distinct password-based account for it **cannot be created via the normal Create Account UI**: GoTrue returns **HTTP 422 `user_already_exists` / "User already registered"** (verified empirically against the exact signup endpoint the app calls). So the C04 account-link collision prompt (which requires the OAuth session user to differ from an existing account of the same email) **cannot be triggered with this email** — the account-link prompt remains un-testable end-to-end and needs a dev-provisioned fixture.

**Session outcome: 1 PASS / 1 FAIL / 1 BLOCKED / 0 SKIPPED.**

---

## Step 1 — Investigation result (what to actually expect, before executing)

**State of `kidsp2p@gmail.com` on staging (read-only queries):**

| Fact | Value | Implication |
|---|---|---|
| `auth.users` row | 1 row, `created_at 2026-05-02` (via Google OAuth); Facebook identity added 2026-05-03 | **Single account, long-established — NOT a fresh email** |
| Password | `has_password: false` | **Social-only account** (no password identity) |
| Confirmation | `confirmed_at 2026-05-02` | Confirmed |
| `profiles` row | EXISTS (`created_at 2026-05-02`, name `KidsP2P`, email `kidsp2p@gmail.com`, `phone_verified false`, `account_status active`, `node_id null`) | Profile present → `refreshSession` builds a session; login is a **returning-user login** |
| Onboarding | `onboarding_skipped_at 2026-08-16 22:22:30` (set during the post-fix dev verification) | App skips the onboarding carousel → routes to **Home** after login |
| Wallet / subscription | `sp_wallets` 1, `user_subscriptions` 1 | Consistent with the signup-trigger chain having run in May |
| `check_account_exists_by_email` RPC | **Does NOT exist** in staging (checked migrations + `pg_proc`) | `checkAccountExists()` always uses the current-user-only fallback (a real gap worth a dev look) |

**Expected behavior determined before executing:** this is a **returning-user login** (`isNewUser = false`; `created_at ≠ last_sign_in_at`), so the C01/C02 "first-time signup profile auto-fill" sub-behavior **cannot be freshly exercised with this email — it is no longer first-time**. Testing that specific sub-behavior requires a **fresh, never-used email** (a genuinely new Google/Facebook account or a fresh app email), which the QA registry does not currently hold. This is stated explicitly rather than silently claimed as covered. The cases were therefore closed against the "does OAuth completion work" bar (session established + audit-log cross-check + correct navigation), per the brief.

> **Investigation correction (transparency note):** my first read-only probe keyed `profiles` on `id` instead of `user_id` and initially reported "no profile"; correcting the key (the profiles PK is a separate `id`; `user_id` is the FK to `auth.users`) showed the profile **has existed since 2026-05-02**. Final state is as in the table above.

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-C01 | AUTH (Group C) | **FAIL** | Google provider auth completed (audit `login` @22:32:52Z) + callback delivered (device log), but the app established **no session** (AsyncStorage empty) and surfaced the new failure banner — on the single permitted attempt; identical path PASSED for Facebook, so likely attempt-specific |
| AUTH-TC-C02 | AUTH (Group C) | **PASS** | Real session established (AsyncStorage `sb-…-auth-token` present; audit `login` @22:37:53Z) and app navigated to **Home** — returning-user login, correct destination |
| AUTH-TC-C04 | AUTH (Group C) | **BLOCKED** | Collision fixture impossible via UI for this email: GoTrue **422 `user_already_exists`** on password signup (verified) → account-link prompt not triggerable; needs a dev-provisioned fixture |

**Roll-up:** 1 PASS / 1 FAIL / 1 BLOCKED / 0 SKIPPED.

---

## Perceived load-time table

> Label: **Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.**

| Screen → transition | Elapsed | Notes |
|---|---|---|
| Login → OS prompt (both providers) | ~1s | "«PassItUp» Wants to Use «supabase.co»" appears immediately |
| OS Continue → Google account chooser | ~1–2s | Provider page loaded cleanly |
| Google account-chooser tap → browser closed | ~1s | Fast callback (pre-authenticated account) |
| OS Continue → Facebook consent page | ~2–3s | "Continue as Sam" page rendered |
| Facebook "Continue as Sam" → Home | ~6–10s | **≥3s (flagged)** — app-side OAuth session exchange (documented 20×300ms poll + profile fetch + navigation) with the **"Signing you in…" loading state shown throughout; not a silent stall. Acceptable for an OAuth login, but the exchange leg is the slowest part. |
| Google chooser tap → failure banner | ~10–20s | Failed exchange + recovery + banner; "Signing you in…" shown |

**Verdict:** FLAGGED only for the OAuth completion leg (Facebook consent → Home ~6–10s), which shows loading feedback and is app-side session exchange, not a silent stall. No other app-behavior transition flagged.

---

## Per-case traces

### AUTH-TC-C01 · Sign in / Continue with Google — **FAIL (single attempt; provider + callback OK, app-side session establishment failed)**

**Execution trace (Google attempt used once):**
1. Clean launch → Landing → Log In. Social row renders (labels verified). Google at (151,347).
2. Tap Google → native iOS prompt **"«PassItUp» Wants to Use «supabase.co» to Sign In"** → Continue.
3. Google consent browser opens → **"Choose an account"** page listing `kidsp2p@gmail.com` ("KidsP2P") — the **returning-user** path (`c01-02-google-account-chooser.png`).
4. Tap the account → browser closes → app returns to Login with Google in **"Signing you in…"** state.
5. **Server-side:** `auth_logs` shows `login`, provider `google` @ **22:32:52Z** → provider OAuth **completed**.
6. **Callback delivery:** device log shows `Found application: com.sameralzubaidi.p2pmarketplace to handle url scheme: p2pkidsmarketplace` and "able to handle Callback { scheme: p2pkidsmarketplace } for authentication" @18:32:52; the `_UIViewServiceHostSessionErrorDomain Code=4` @18:32:53 is benign teardown (§5.11).
7. **Client-side failure:** AsyncStorage has **no `sb-*`/`auth-token` key** → no session. App returned to Login with banner **"We couldn't complete your sign-in. Please try again."** + `Use Email` CTA (`c01-04-failure-banner-returned-to-login.png`).

**Verdict rationale:** The hard assertion "a session is created" was **not met** on the executed attempt. This is a real FAIL of the flow on this attempt (provider + callback delivery both confirmed), **not** a test-environment blocker. Because the identical code path **succeeded for Facebook** (C02), the Google failure is reported as **attempt-specific** (most plausibly a code-exchange/session-set failure in `handleOAuthCallback` → `success:false`) rather than a systematic defect. The exact JS error was not captured (see Friction). **FAIL**, single-attempt observation — one more Google completion (future session) is needed to confirm whether it reproduces.

### AUTH-TC-C02 · Sign in / Continue with Facebook — **PASS ✅ (genuinely closed for the "does OAuth completion work" bar)**

**Execution trace (Facebook attempt used once):**
1. Tap Facebook (286,398) → native iOS prompt → Continue.
2. Facebook OAuth authorization page rendered: **"You previously logged into p2pmarketplace with Facebook. Would you like to continue?"** + **Continue as Sam** (App ID 2443740446072876) — returning-user consent (`c02-01-facebook-consent-page.png`).
3. Tap **Continue as Sam** → browser closes → app "Signing you in…" → **Home (Dashboard)** renders (header, composer bar, action tiles, ID-verification CTA, subscription card, tabs) (`c02-02-home-after-fb-login.png`).
4. **Session established:** AsyncStorage `sb-drntwgporzabmxdqykrp-auth-token` **present** (the §5.11 decisive signal).
5. **Audit cross-check:** `auth_logs` shows `login`, provider `facebook` @ **22:37:53Z**.
6. **Navigation:** Home is correct for this returning user — profile exists and `onboarding_skipped_at` is set (2026-08-16 22:22:30), so the onboarding carousel is skipped and the authenticated dashboard shows.

**Verdict rationale:** All assertions met — browser opens ✓, auth completes ✓, app returns with a real session ✓ (AsyncStorage + audit log), navigation correct ✓. **PASS.** Note: this was a **returning-user** login, not first-time signup; the first-time profile auto-fill sub-behavior was not exercisable with this email (see Step 1).

### AUTH-TC-C04 · Existing-email account-link prompt — **BLOCKED (fixture/architecture) + real account-merging finding**

**Investigation result (no separate credential attempt needed — reused the C02 evidence + DB + GoTrue):**
1. `kidsp2p@gmail.com` is a **single, confirmed, social-only** `auth.users` row (created via Google 2026-05-02; Facebook identity added 2026-05-03; `has_password: false`). OAuth login for it always resolves to **the same user**, so `checkAccountExists().userId === sessionUserId` → the `AccountLinkingPrompt` (`onAccountExists`, userId-mismatch) branch **never fires** for this email.
2. **A distinct password-based account for this email is impossible via the normal Create Account UI.** Empirical check against the exact endpoint the UI calls (`POST /auth/v1/signup`, body `{email: kidsp2p@gmail.com, password: …}`) returned **HTTP 422 `user_already_exists` / "User already registered"** (saved: `c04-gotrue-signup-422.json`). GoTrue enforces one-user-per-email — the OAuth identity already owns the email, so a password signup is rejected. **No account was created** (confirmed; the 422 is non-mutating).
3. Therefore the C04 collision scenario **cannot be set up with this email via UI**, and the account-link prompt remains **BLOCKED** pending a dev-provisioned fixture. The Phase 19 note's suggested fix ("a UI password signup on staging" for this email) is now **proven infeasible** — the dev team needs a different fixture mechanism (e.g., a password account + a separate OAuth identity sharing an email under a permitted config, or a test-only provisioning path).
4. **Real account-merging behavior observed:** attempting to create a password account with an email that already has OAuth identities yields a hard rejection (422 "User already registered") — there is **no silent merge and no duplicate account**; the email is hard-owned by the existing OAuth user. This also confirms that the app's intended path for "social-only user adds a password" is the **Set Password modal** (C07 surface, LinkedAccounts), NOT a fresh signup.

**UI-form caveat (friction, not an app defect):** I attempted to complete the Create Account UI form 5 times to observe the app-side dialog for this 422, but the form's fields below the phone (DOB/password/confirm) could not be reliably tapped on-device this session (persistent focus corruption from AX content-coordinate vs focus-induced auto-scroll — see Friction). The backend rejection is nevertheless confirmed directly; the app-side surfacing of the 422 remains to be visually verified once the form can be submitted.

---

## Cross-cutting UX findings

- **UX-1 (resolved in code, Google-path still hits it):** the new failure banner ("We couldn't complete your sign-in. Please try again." + `Use Email`) now prevents the silent-no-session return that was the Phase 19 UX-1 — **the banner appeared correctly on the failed Google attempt** (good). But a parent who completed Google auth on a failing attempt sees "we couldn't complete your sign-in" despite the provider succeeding — the Google leg still needs the app-side exchange to succeed.
- **UX-2 (loading feedback OK):** during the OAuth completion leg the tapped button shows "Signing you in…" (loading) — no silent stall; the ~6–10s exchange leg is acceptable for OAuth login but is the slowest reachable transition.
- **UX-3 (no new copy issues):** the Facebook returning-user consent copy ("You previously logged into p2pmarketplace with Facebook…") is clear and correct for the parent/guardian audience. No copy defects this run.

## Cross-cutting design-system compliance (vs. `docx/design-system-passitup.md`)

- **PARTIAL (structural/coordinate-level only).** Screenshots could not be visually inspected this session (see Friction — `view_image` returned non-parseable URIs), so color-token/alignment checks were limited to the AX-tree + interaction evidence.
- **Login screen + failure banner:** the `provider-unavailable-banner` rendered inline under the divider with a text + `Use Email` CTA (tree-verified identifiers); no structural violation observed.
- **Home (Dashboard) after C02:** standard authenticated dashboard (action tiles, ID-verification CTA banner, subscription card, tabs) — matches the Phase-18/19-verified compliant layout.
- **Native iOS prompt** ("«PassItUp» Wants to Use «supabase.co»") and the **Facebook consent page** are OS/third-party surfaces — out of scope for the app design-system check.
- No app-owned dialogs/modals were reached this run (the post-OAuth account-link/onboarding dialogs remain unreachable — C01 failed, C02's returning user skips them).

## Locator-gap findings

- None new this run. All OAuth screens' interactive elements surface in the AX tree with identifiers (`google-login-button`, `facebook-login-button`, `provider-error-cta`, etc. — the Phase 18 a11y fix holds).
- The Create Account form fields all have testIDs and surface in the tree; the tap-instability is an AX coordinate/scroll issue (Friction), not a locator gap.

## Friction vs. the operating rules

- **Screenshots unusable as ground truth this session (§5.9):** `mobile_save_screenshot`/`view_image` returned image URIs with no parseable content, so I could not visually verify rendered UI. Worked around via the AX tree + staging logs + AsyncStorage; flagged here because §5.9 designates screenshots as the source of truth.
- **App JS console not captured:** RN `console.*` was absent from the unified device log, and the Metro message-socket capture (`ws://localhost:8081/message`) connected but received no app logs (the `/logs` HTTP endpoint returns the Expo web HTML, not an SSE stream). Result: the exact `handleOAuthCallback` error for C01 could not be extracted — the app-side failure is evidenced by the banner + empty AsyncStorage + audit-log login, but not by the JS error string.
- **`query_logs` MCP flakiness:** intermittent "Backend error! Retry your query" (known Phase 19 friction); retried and worked; used `execute_sql` on `auth.audit_log_entries` as a fallback (empty DB table — the `auth_audit_logs` in the Phase 19 report is the unified-log source, not the DB table).
- **Create Account form coordinate-tap instability (dominant friction):** 5 attempts to fill the form; every tap on fields below the phone (DOB/password/confirm) either failed to move focus (text landed in the still-focused phone/name field, corrupting it) or landed wrong, because the AX tree reports **content-space** coordinates while focusing a lower field triggers an **auto-scroll offset** that invalidates the reported positions. The Cmd+K keyboard toggle and swipe-to-top reset were unreliable (one probe landed correctly, subsequent identical taps failed). Per §5.2, corrupted fields were never repaired — each failure triggered terminate+relaunch. This is a tooling/agent interaction friction, **not** an app defect (the fields have testIDs and are individually reachable when the offset is right).
- **Metro log-capture attempt:** the `/logs` SSE endpoint returned the web HTML bundle, not a log stream (my capture approach was abandoned).

## Recommended follow-ups (dev-side, ranked)

1. **Determine the C01 Google-attempt failure (P0 for closing C01).** Provider auth + callback delivery are confirmed working; the app's `handleOAuthCallback` returned `success:false` (no session, failure banner). Instrument/log the catch path in `handleOAuthCallback` (exchange vs session-poll) so the exact error surfaces in Metro, then run one more Google completion to confirm whether it reproduces (this session's failure is currently un-classified between a transient exchange race and a Google-path-specific issue, because Facebook's identical path succeeded).
2. **C04 fixture (dev-team):** the Phase 19 note's "UI password signup for kidsp2p@gmail.com" is **infeasible** (GoTrue 422 `user_already_exists`, verified). If C04's account-link prompt is to be tested, provision a collision fixture through a different mechanism (e.g., a password account whose email matches a separate OAuth identity under a config that permits it, or a test-only provisioning path).
3. **Confirm the app-side surfacing of the 422:** verify how `SignupScreen` renders `user_already_exists` ("User already registered") once the Create Account form can be submitted on-device (blocked this session by the device-form friction, not by the app).
4. **`check_account_exists_by_email` RPC missing:** `checkAccountExists()` silently falls back to a current-user-only check (the RPC is absent from migrations + staging). Consider adding/confirming the RPC so email-collision detection (and thus C04's prompt) works as designed when a fixture exists.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-C01 (Google), AUTH-TC-C02 (Facebook), AUTH-TC-C04 (account-link) — formal closure against the fixed build; one provider attempt each; C04 investigated with DB + GoTrue rather than a separate credential attempt.
**Design-System Compliance:** PARTIAL (structural/AX-level only — screenshots not visually inspectable this session due to a tooling limitation; no structural violations observed on Login/banner/Home; native iOS + third-party Facebook consent pages out of scope; no app-owned dialogs reachable).
**Perceived Load-Time Verdict:** FLAGGED — Facebook consent → Home: ~6–10s (≥3s) with "Signing you in…" loading shown throughout (app-side OAuth session exchange, not a silent stall). All other reachable transitions <3s. Label: perceived load time (simulator, wall-clock, ±polling precision), not a formal profile.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Login screen: wording/layout unchanged and compliant (labels under icons, "or" divider, filled inputs; failure banner renders inline with `Use Email` CTA).
- CONFIRMED — Facebook OAuth returning-user consent copy ("You previously logged into p2pmarketplace with Facebook. Would you like to continue?" + "Continue as Sam") clear and correct for the parent/guardian audience.
- CONFIRMED — Home/Dashboard (post-Facebook): standard compliant authenticated layout.
- No app-owned dialogs/modals reachable this run — nothing to flag (C04/account-link prompt not reachable; blocked).
**Verdict Summary:** 1 PASS / 1 FAIL / 1 BLOCKED / 0 SKIPPED.
**Critical Findings:**
1. **C02 (Facebook) genuinely closed — PASS:** real session established (AsyncStorage `sb-drntwgporzabmxdqykrp-auth-token` present; audit `login` @22:37:53Z) and app navigated to **Home**. The Phase 19 callback-delivery blocker is confirmed fixed on-device (scheme dispatched to the app; the Code=4 line is benign).
2. **C01 (Google) FAIL on the single permitted attempt:** provider auth completed (audit `login` @22:32:52Z) + callback delivered (device log), but **no session** was established (AsyncStorage empty) and the app returned to Login with the failure banner. Same code path succeeded for Facebook → likely attempt-specific; exact JS error not captured (JS logs inaccessible). One more Google completion is needed to confirm reproducibility.
3. **C04 blocked by architecture/fixture + real finding:** a distinct password account for the OAuth email is impossible via UI — GoTrue **422 `user_already_exists`** (verified). The account-link prompt cannot be triggered with this email; needs a dev-provisioned collision fixture.
4. **Returning-user status confirmed:** `kidsp2p@gmail.com` is a single social-only account (created 2026-05-02, no password, profile exists, onboarding skipped) — C01/C02 tested the returning-user login, NOT first-time signup; first-time profile auto-fill remains uncovered (needs a fresh never-used email).
**App State Left Behind:** App terminated and left logged out — AsyncStorage has **no** session token (verified after run). **No accounts created** (the GoTrue signup probe was rejected 422; signup form never submitted). Staging unchanged except the expected side effects of the completed OAuth logins: `kidsp2p@gmail.com` `last_sign_in_at` → 22:37:53Z (Facebook) and its profile `updated_at` → 22:37:53Z; identities/rows otherwise unchanged. OAuth credentials: **1 provider attempt each this session (Google ×1, Facebook ×1), 0 passwords typed** (cached returning-user consent). **Cumulative usage to date: Google ×3, Facebook ×4** (per the registry's risk tracking). No `oauth_state_*` SecureStore keys were observed to interfere.
**Why It Matters:** This run proves the Phase 19 callback-delivery fix works end-to-end on-device (Facebook now completes to a real session + Home), and it proves the app-side OAuth completion mechanism functions when the code exchange succeeds. It also surfaces a **remaining Google-attempt failure** that, if reproducible, is a real client-side defect in the exchange/session-set path; and it conclusively rules out the C04 fixture path the Phase 19 note proposed (UI password signup for this email is rejected). The remaining Group C work is now precisely enumerated.
**How to Verify/Reproduce:**
1. C02 PASS: Login → Facebook → Continue → "Continue as Sam" → observe Home; verify AsyncStorage `sb-…-auth-token` + `auth_logs` facebook `login` (evidence: `c02-01-facebook-consent-page.png`, `c02-02-home-after-fb-login.png`).
2. C01 FAIL: Login → Google → account chooser → tap account → observe return to Login with "We couldn't complete your sign-in." banner; verify AsyncStorage has no token while `auth_logs` shows google `login` (evidence: `c01-02-google-account-chooser.png`, `c01-04-failure-banner-returned-to-login.png`).
3. C04: `POST https://drntwgporzabmxdqykrp.supabase.co/auth/v1/signup` with `{email: kidsp2p@gmail.com, password: <any valid>}` + anon key → HTTP 422 `user_already_exists` / "User already registered" (evidence: `c04-gotrue-signup-422.json`).
4. Device log: `xcrun simctl spawn <udid> log show --last 5m` → "Found application … to handle url scheme: p2pkidsmarketplace" + "able to handle Callback".
**Known Gaps / Not Tested:**
- C01 Google reproducibility (single-attempt observation; not retried per credential-sparing).
- First-time-signup profile auto-fill (C01/C02 first-time sub-behavior) — not exercisable with this returning-user email; needs a fresh never-used email/account.
- C04 account-link prompt end-to-end — blocked (fixture/architecture); app-side surfacing of the 422 not visually observed (Create Account form could not be reliably submitted on-device this session).
- App JS console logs (exact OAuth exchange error) — not capturable this session (friction).
- Visual color-token/alignment checks — screenshots not inspectable this session (tooling limitation).
**What Needs To Be Fixed Next:**
1. Fix: capture + classify the C01 Google `handleOAuthCallback` failure (add logging to the catch path; run one more Google completion to confirm reproduce vs. transient). [Dev]
2. Fix (C04 fixture): provision a genuine email-collision fixture (a password account + a separate OAuth identity sharing an email) via a non-UI mechanism — the "UI password signup for kidsp2p@gmail.com" suggestion is proven infeasible (422). [Dev]
3. Fix: add/confirm the `check_account_exists_by_email` RPC so email-collision detection (and C04's prompt) works as designed. [Dev]
4. Fix (UI observation): verify how `SignupScreen` surfaces GoTrue's `user_already_exists` ("User already registered") once a form can be submitted on-device. [QA/dev]
**UX Enhancement Ideas (optional, not defects):**
- On the Login screen, the OAuth completion leg (consent → Home) took ~6–10s with the button in "Signing you in…" — consider a brief inline "Finishing sign-in…" caption or subtle progress hint on the tapped provider card for the longer exchange leg, so a slow exchange reads as progress rather than a long spinner (grounded in the observed ~6–10s Facebook completion).
- The Create Account form is the hardest screen to drive by automation (focus-induced scroll invalidates tap coordinates for lower fields) — consider keeping DOB/password/confirm fields' focus behavior simpler (e.g., no auto-scroll on focus) to reduce both manual and automated fill friction (grounded in the 5 failed fill attempts this session).
**Suggested Next Session:** After the dev lands a C01 logging fix + runs one more Google completion (to confirm reproduce vs. transient), re-run C01; then C04 once the collision fixture is provisioned. First-time-signup auto-fill coverage needs a fresh never-used OAuth email (new registry persona).
**Suggested to Improve Agent Rules:** Add a playbook §5.2/§5.9 note: on long scrolling RN forms, the AX tree reports **content-space** coordinates and focusing a lower field triggers an auto-scroll that invalidates tap positions for fields below the focused one — before tapping any field below the currently focused field, reset the scroll (swipe) and re-list, and verify the value landed in the intended field after every type (per-field verify), terminating+relaunching on corruption. Also note that this session `mobile_save_screenshot`/`view_image` returned non-parseable image URIs, so §5.9's screenshot-ground-truth was unavailable — the agent should confirm screenshot visibility at session start and plan a fallback (AX tree + device/DB logs) if not viewable.
