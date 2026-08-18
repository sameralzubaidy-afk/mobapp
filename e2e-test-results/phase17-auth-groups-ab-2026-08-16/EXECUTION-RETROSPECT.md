# Phase 17 — AUTH Groups A+B — Execution Retrospect & Bottleneck Analysis

**Purpose:** This document is the full decision-and-outcome log of the QA Test Agent's Phase 17 execution (AUTH Groups A + B, 17 cases). It exists to be fed to an AI agent so it can identify the **bottlenecks, challenges, and reasoning patterns** the executing agent went through — with every key action, the reasoning behind it, the tool calls that mattered, and the outcome. Use it to derive: (a) what slows execution, (b) what patterns an agent should adopt proactively, and (c) what instrumentation/fixture work removes the friction.

**Source run:** 2026-08-16 · iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1 · dev build + Metro · staging Supabase `drntwgporzabmxdqykrp`.
**Canonical guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Primary evidence:** `e2e-test-results/phase17-auth-groups-ab-2026-08-16/report.md` + `/evidence/`
**Session outcome:** 15 PASS / 0 FAIL / 2 BLOCKED / 0 SKIPPED.

---

## 1. Session at a glance

| Item | Detail |
|---|---|
| Task | Execute Group A (Signup, A01–A08) + Group B (Login & Session Restore, B01–B09) = 17 cases |
| Method | Full three-layer rigor per case: hard assert + structural UX + wording UX + design-system compliance; perceived load-time tracking per transition |
| Environment | iOS Simulator (dev build over Metro), staging Supabase; no OAuth/deep-link complexity expected |
| Final state | App left logged-out at Landing; 3 throwaway incomplete accounts created; `test-buyer` unchanged |
| Execution style | Fully autonomous tool-driven: `mobile-mcp` (list/tap/type/swipe/screenshot), terminal (simctl, Python/PIL pixel analysis), memory files |
| Biggest surprise | The brief said "simple form-based screens, low complexity" — actual per-case cost was ~2–3× the expectation because of tooling + UI friction |

---

## 2. Execution chronology (every phase, in order, with reasoning)

### 2.0 — Context acquisition (reasoning: playbook-before-action)
- **Actions:** Read the QA Test Agent operating playbook (§4–§9), then read memory files: `qa-test-accounts.md`, `locator-conventions.md`, `simulator-keyboard-suppression.md`, `manual-testing-guide-canons.md`, `qa-test-agent.md`. Read the AUTH guide's Group A+B sections verbatim. Read auth routing source (`AppNavigator.tsx` RootNavigator) and the `shouldShowOnboarding` service to understand B01's routing.
- **Reasoning:** Per the playbook's §4 canonical-sources rule and §5.1 locator-resolution rule, I must know the exact expected copy, the locator IDs, and the app's routing logic before touching the device. Reading the source (`SignupScreen`/`LoginScreen` testIDs, `DateOfBirthPicker` format, `validatePassword` single-error behavior, `GlobalAlertProvider` native-modal layout) let me predict behavior and design the test inputs correctly.
- **Outcome:** Established full locator map (signup-*/login-*/landing-*), known valid referral codes (`buyerref`/`sellrref` from the seed script), known persona credentials (referenced by name, never echoed), and the routing model (session + `onboarding_completed_at` null → onboarding stack).
- **Key insight recorded:** The registry has NO "incomplete onboarding" persona, no "deleted" persona, no "profile-not-found" persona → B08/B09 were pre-identified as likely BLOCKED; B01-half2 would need a UI-created user.

### 2.1 — Environment bring-up
- **Actions:** `mobile_list_available_devices` → empty. Booted the Phase 16 device (iPhone 17 Pro Max) via `xcrun simctl boot`; verified app installed (`simctl listapps`); confirmed Metro running (HTTP 200 on :8081).
- **Reasoning:** The mobile-mcp device list is the gating channel — no devices listed = no interaction possible. Reuse the prior phase's device so the app build/session state is consistent.
- **Outcome:** Device online; app installed; Metro up. Clean launch → Landing (no LogBox overlay — §5.8 clean-state pass).
- **Friction:** First `launch_app` left the app on the iOS springboard (home screen), not the app UI → had to tap the `Pass It Up!` icon manually to foreground it. (Root cause: the launch tooling didn't foreground the app on first launch.)

### 2.2 — Group A

#### A08 — Landing footer legal links → **PASS**
- Actions: tap `landing-terms-link` → screenshot (Terms WebView rendered) → iOS edge-swipe back → tap `landing-privacy-policy-link` → screenshot → edge-swipe back.
- Reasoning: WebView content is asserted by **visible content** (screenshot), never by element identity — the AX tree on WebViews is unusable (200KB+).
- Outcome: Both links open without crash; edge-swipe back works. Load <2s each.

#### A07 — Signup Terms/Privacy links → **PASS**
- Actions: Get Started → Create Account → typed partial email (to test state preservation) → scrolled to legal line → tapped `signup-terms-of-service-link` → WebView → edge-swipe back → `signup-privacy-policy-link` → WebView → edge-swipe back → verified email still present.
- **Bottleneck hit (1st): software keyboard appeared on email focus**, covered the legal links. Reasoning: use the documented Cmd+K toggle (`osascript` System Events keystroke) to suppress the software keyboard — per `simulator-keyboard-suppression.md` it stays hidden across field focus/app relaunch in the same boot. Outcome: keyboard dropped to off-screen (keys at y≥1075), links tappable.
- Outcome: Both links open; form state preserved. First pass of the signup form showed the DOB picker is 3 separate fields (`signup-dob-picker-day/month/year`) with auto-focus chaining — important for later cases.

#### A02 — Field validation → **PASS**
- **Reasoning decision (recurring): relaunch-per-case for clean form state.** The agent cannot reliably clear a text field (no select-all/delete primitive in `type_keys`; field-corruption risk is high per §5.2). So each case that needs different field content starts from a fresh app relaunch → Create Account. This is the single biggest recurring cost driver (≈15+ relaunches over the session, each ~5–10s dev-bundle load + navigation).
- Actions: fresh form → name `A`, email `abc`, phone `12345`, password `abc`, confirm `abc` → submit → captured inline errors (tree + screenshot): "Name must be at least 2 characters", "Please enter a valid email address", "Please enter a valid phone number (10+ digits)", "Please enter your date of birth", "Password must be at least 8 characters".
- **Copy nuance found:** `validatePassword` returns only the FIRST failing rule — the guide's "8 chars + uppercase + lowercase + number" set is never shown together. (Guide copy update needed.)

#### A03 — Password mismatch + weak → **PASS**
- Reasoning: fill only password/confirm on a fresh form (mismatch isolates cleanly); for the weak-password portion, **cross-reference A02's evidence** (identical inputs `abc`/`abc`, identical error + blocked) instead of burning another relaunch. This is a legitimate evidence-economy decision, documented in the trace.
- Outcome: `Passw0rd1` vs `Different1` → "Passwords do not match" under Confirm; blocked.

#### A04 — Under-18 DOB → **PASS (took 3 attempts — the session's costliest case)**
- Attempt 1: filled name/email/phone then scrolled to DOB and typed `01`/`01`/`2015` → **the digits landed in the PHONE field** (`555123400001012015`). Reasoning: focus had remained on the last-typed field (phone); the tap on the DOB day field didn't switch focus (layout shifted between tap and type). Per §5.2 (corrupted field → terminate + relaunch + restart), abandoned.
- Attempt 2: DOB-first strategy → DOB OK, but the **confirm field ended empty** (typing misdirected again when the ScrollView auto-scrolled between tap and type) → "Passwords do not match" on submit → per §5.2 abandoned again.
- Attempt 3: **DOB-first + per-field re-list verification** (re-list the AX tree after each field, confirm the value/bullets landed, only then proceed) → full valid form with DOB 01/01/2015 → submit → age-gate dialog "Sorry, you must be 18 years old to register."
- **Bottleneck hit (2nd): native-modal dialog not in AX tree.** The age-gate alert renders in a GlobalAlertProvider React Native `<Modal>` = a SEPARATE native window; `list_elements_on_screen` returns only the underlying form. Blind taps at the computed card center FAILED (4 attempts). **Technique invented on the fly:** save the screenshot → Python/PIL scan for primary-green `#5DBB8E` pixels → button center px ÷ 3 = point coords → tap. This found the OK at pt (219,735) — proving the modal is NOT vertically centered (naive centering math predicted ~523). Recorded in memory.
- Outcome: age-gate message correct, signup blocked. **Lesson codified: DOB-first fill order + per-field verify + pixel-scan dialog dismissal.**

#### A05 — Duplicate email → **PASS**
- Reasoning: use a KNOWN-existing email for the collision — the registry persona `test-buyer@kidsmarketplace.test`. (No account created, so no throwaway needed.)
- Outcome: "Signup Failed" dialog → "This email is already registered. Please log in instead." No new account.
- **Bottleneck hit (3rd): ui/Modal gray button.** This dialog also renders in a native modal (button not in AX tree), but the green-scan found NOTHING — the OK button was LIGHT GRAY #E8E8E8 (≈ neutral.300 = the Button **disabled** style) at pt (219,470), located via a gray uniform-band scan. **Design deviation discovered:** the Signup Failed primary OK renders gray while the Login Failed OK (later, B02) renders green — inconsistent. This is a real product-level finding, not just a test inconvenience.
- Friction: earlier blind taps on the expected button position failed because the dialog card is NOT centered where naive math assumed — reinforced the "always pixel-scan, never assume centering" rule.

#### A06 — Optional referral code → **PASS**
- Valid sub-case: referral `buyerref` (8 chars, seeded for test-buyer — sourced from `seed-staging-data.ts`) → submit → no invalid dialog, proceeds to Verify Your Phone.
- Invalid sub-case: referral `ZZZZZZZZ` → submit → "Invalid Referral Code" dialog with **Fix it** / **Continue anyway** → tapped Continue anyway (green primary at pt 220,736 via green-scan) → proceeds to Verify Your Phone without a code.
- **Bottleneck hit (4th): stale AX tree discovered.** After navigating to Phone Verification, `list_elements_on_screen` returned the OLD Signup form tree (with fields intact) while the screenshot clearly showed Verify Your Phone. **Reasoning decision: from this point, the screenshot is the source of truth after any navigation; the AX tree is advisory.**
- Outcome: valid code accepted; invalid handled gracefully; both sub-cases PASS. Two throwaway accounts created (qa06a/qa06b).

#### A01 — Signup success → **PASS (required a clean redo)**
- Attempt 1: full valid fill → submit → **ambiguous evidence conflict.** Screenshot appeared to show Verify Your Phone, but the AX tree showed the form with "Passwords do not match" (confirm empty). Worse, the same phone number (5551234000) had appeared on the prior A06 Verify-Your-Phone screen, so a stale screenshot frame from A06 was plausible. Reasoning: **do not guess — a conflicting-evidence state is untrustworthy.** Per §5.2 discipline, restart cleanly rather than accept either channel.
- Attempt 2 (redo): fresh email `qa17a01c@kidsmarketplace.test`; **strict verification — re-list after EACH field and confirm BOTH password and confirm show 12 bullets before submitting** → submit → Verify Your Phone showing `555 123 4000` (screenshot-confirmed, unambiguous).
- Outcome: PASS; the A01 account becomes the B01-half2 "incomplete" user.

### 2.3 — Group B

#### B07 — Login empty-field + invalid-email validation → **PASS (part 2 required a redo)**
- Part 1: empty fields → "Email is required" + "Password is required" → PASS.
- Part 2 attempt 1: typed `not-an-email` in email, tapped password, typed `password123` → **`password123` went into the EMAIL field** (`not-an-emailpassword123`) because the iOS **password-autofill bar** ("Passwords" suggestion strip) appeared and shifted the layout between tap and type. Per §5.2 → relaunch + restart.
- Part 2 redo: reasoning — the assertion only needs `Email is invalid`, so submit with just the invalid email + empty password (avoiding the password-focus hazard entirely) → "Email is invalid" (+ "Password is required") → PASS.

#### B03 — Forgot Password link → **PASS**
- Login → tap `login-forgot-password-link` → Forgot Password screen renders. Per guide, entry-only (no real reset sent).

#### B02 — Invalid credentials → **PASS**
- `test-free@` + wrong password → "Login Failed" dialog "Invalid email or password." → stays on Login.
- **Design inconsistency confirmed:** the Login Failed OK button rendered GREEN (pt 219,520 via green-scan) — vs A05's gray Signup Failed OK. Same `ui/Modal`+`Button variant="primary"` path, different visual result → flagged as a real defect to investigate.

#### B01-half1 — test-buyer → Home tabs → **PASS**
- Login transition measured ~1–2s (Home in first poll after submit). Home tabs (Local Market dashboard) verified via tree + screenshot.

#### B04 — Session restore after kill/relaunch → **PASS**
- Terminate → relaunch → Home restored directly, no re-login. Cold-start ~5–10s (dev-build bundle load dominates — environment artifact).

#### B05 — Silent app resume → **PASS**
- Press HOME (background) → relaunch (foreground) → returned to same Home screen, no full-screen spinner.

#### B06 — Cold launch does not hang → **PASS (partial condition)**
- Cold launch logged-in → Home within ~5–10s, no indefinite spinner (RootNavigator has a 12s force-render guard). **Gap:** the "slow/briefly interrupted network" sub-condition is NOT inducible without a Network Link Conditioner — verified under normal network only; documented, not faked.

#### B01-half2 — incomplete user → onboarding flow → **PASS (with documented nuance)**
- Logout path: Home → **avatar at top-right has NO accessibility label/testID** (locator gap; coordinate-derived tap at ~400,58) → Profile → scrolled → Logout button (red text #EF4444, located by red-pixel scan; `profile-logout` testID exists but AX tree was stale) → confirm dialog (Cancel outline / red Logout) → tapped red Logout at pt (220,590) → Landing.
- Login as `qa17a01c` (A01-created, not phone-verified) → routed to **Verify Your Phone** (onboarding flow), NOT Home, NOT the literal Welcome/carousel.
- **Reasoning on verdict:** The guide's literal "Welcome / carousel" expectation is a spec oversimplification — a not-phone-verified user is correctly sent to the phone-verification step of onboarding. The essential routing-by-status distinction (incomplete ≠ Home) is verified → PASS with the nuance documented (not a failure).

#### B08 — ACCOUNT_DELETED login branch → **BLOCKED**
- Reasoning: staging `account_status = deleted` needs the admin portal `/users → Delete User (Soft)` (admin web is OUT OF SCOPE for this agent — Playwright path) or SQL/service-role writes (prohibited). No such persona in the registry. Code branch verified present in `LoginScreen.tsx` (`case 'ACCOUNT_DELETED'`), so it's a fixture gap, not an unknown.

#### B09 — PROFILE_NOT_FOUND login branch → **BLOCKED**
- Reasoning: requires an auth user with NO profile record — construction requires deleting a profile or creating a user without one (SQL writes, prohibited). No persona. Same posture as Group S S03/S04.

### 2.4 — Wrap-up
- Wrote `report.md` (full §8 format + complete QA Session Handoff), saved 25+ evidence screenshots, updated session + repo memory with verified facts (stale-tree rule, pixel-scan technique, gray-button finding, copy nuances).

---

## 3. Bottlenecks & challenges (the core deliverable)

Each entry: **symptom → root cause → cost → handling → follow-up needed.**

### B1. AX-tree staleness (HIGH severity, tooling)
- **Symptom:** `list_elements_on_screen` repeatedly returned a STALE cached tree of a previous screen (Signup form with old field values, Home dashboard, even an "Item Detail" screen never visited this session) while the actual screen (PhoneVerification, Profile) was different. Re-listing did not fix it.
- **Root cause:** mobile-mcp element-tree capture does not refresh for certain screens/navigation events (likely the AX snapshot is cached at the native level for screens rendered in certain ways).
- **Cost:** Every navigation required a screenshot to establish ground truth → ~doubled tool calls; several decisions were made against stale trees before the pattern was recognized.
- **Handling adopted:** After ANY navigation, screenshot = source of truth; AX tree = advisory only; never submit/assert purely from a tree after a transition.
- **Follow-up:** Confirm whether this is a mobile-mcp tooling limitation (likely) vs. an app render-tree issue. If tooling, add an "AX-tree refresh" capability or document screenshot-first navigation in the playbook.

### B2. Native-modal dialogs invisible to the AX tree (HIGH severity, tooling/technique)
- **Symptom:** GlobalAlertProvider alerts AND `ui/Modal` dialogs render in React Native `<Modal>` = separate native window; their buttons do NOT appear in `list_elements_on_screen`. Blind coordinate taps at the naive card-center failed.
- **Root cause:** Native modal windows are outside the main AX snapshot the tool captures; the dialog card is NOT vertically centered where layout math predicted.
- **Cost:** Age-gate dismissal alone cost 4 blind taps + analysis before the technique was derived; repeated per dialog (5 dialog types this session).
- **Handling adopted (reusable technique):** Save screenshot → Python/PIL pixel-scan → primary-green `#5DBB8E` (or gray band `#E8E8E8`, or red `#E85D75`) → button center px ÷ 3 (iPhone 17 Pro Max = 1320×2868 px, scale exactly 3) = point coords → tap. Verified across 5 dialogs.
- **Follow-up:** Promote this to a first-class §5.4 operating technique in the playbook (currently ad-hoc).

### B3. Keyboard / focus misdirection (HIGH severity, app+tooling interaction)
- **Symptom:** text typed into the WRONG field (A04: DOB digits → phone; B07: password → email). Tap-then-type often didn't switch focus because the layout shifted between the tap and the keystrokes (KeyboardAvoidingView on focus, iOS **password-autofill bar** appearing on secure fields).
- **Root cause:** (a) iOS autofill bar insertion shifts the layout; (b) the agent's tap coordinates go stale the instant the UI shifts; (c) no reliable focus verification primitive.
- **Cost:** 3 full-case restarts (A04×2, B07×1) = 3 extra relaunches + refills.
- **Handling adopted:** (1) DOB-first fill order (fill the DOB fields before any other field gains focus — avoids the misdirection entirely for the multi-field DOB); (2) re-list the tree after EVERY field and confirm the value/bullets landed before proceeding; (3) per §5.2, never repair a corrupted field — terminate + relaunch.
- **Follow-up:** Consider disabling the iOS password-autofill bar on dev builds (or document it as a known hazard); consider a "type-into-field" primitive that locks focus.

### B4. No reliable field-clearing primitive (MED severity, tooling)
- **Symptom:** once a field has content, there is no select-all/delete capability in `type_keys`, so fields can't be reused between cases.
- **Root cause:** the mobile-mcp type primitive only appends text; no erase/clear command.
- **Cost:** forced the relaunch-per-case pattern → ~15+ cold relaunches over the session, each 5–10s bundle load + navigation. This is the dominant time sink in Group A.
- **Follow-up:** Add a clear-field primitive (or select-all+delete) to the tooling; alternatively seed a dev "reset form" affordance.

### B5. Ambiguous / conflicting evidence (MED severity)
- **Symptom:** A01 attempt 1 — screenshot suggested Verify Your Phone, tree showed a form error; the same phone number as a prior screen made a stale-frame replay plausible.
- **Root cause:** combining a stale AX tree with a possibly-stale screenshot channel creates an undecidable state.
- **Handling adopted (correct decision):** do NOT guess between conflicting channels — treat the state as unverified, restart cleanly with strict verification, and make the evidence unambiguous.
- **Follow-up:** none in-app; the staleness fixes in B1 reduce this class.

### B6. Per-case form-fill cost (HIGH aggregate)
- **Symptom:** the Create Account form is long (name/email/phone + 3-field DOB + password/confirm + optional referral ≈ 9 inputs), and each fill requires 15–25 tool calls with per-field verification.
- **Root cause:** long form + no clearing + focus hazards + stale tree.
- **Cost:** Group A alone consumed the majority of the session's context/time.
- **Follow-up:** a dev "autofill" already exists for 3 test users (`dev-fill-test-user-1/2/3`) but doesn't cover arbitrary DOB/referral/dup-email variants — extend the dev autofill to accept the specific case payload, or expose a seedable test form.

### B7. Batch size vs. friction (HIGH aggregate)
- **Symptom:** the brief bundled 17 cases as "low complexity"; actual cost was ~2–3× the estimate.
- **Handling:** the batch-size self-check was applied honestly — all cases were completed with full rigor (no silent compression), and the recommendation was recorded: **future batches of this size should be split (e.g., Group A alone, then Group B)** or budgeted for the documented friction.
- **Follow-up:** adjust batching guidance for form-heavy groups.

### B8. Unverifiable / not-inducible conditions (MED)
- B06 slow-network sub-condition: no Network Link Conditioner → verified under normal network only, documented as a gap (not faked).
- B08/B09 backend-state fixtures: cannot be constructed in an execution-only run (admin out of scope; no SQL writes) → BLOCKED with the exact required fixture described.

### B9. Product-level findings surfaced (not bottlenecks, but deliverables)
- **Design defect:** Signup Failed dialog primary OK renders gray (#E8E8E8, disabled-style) vs Login Failed's green — inconsistent; verify why `ui/Modal`'s primary picked up the disabled style on SignupScreen.
- **Copy/spec drift:** Create Account subheading "Join the Kids P2P Marketplace" vs guide "…community"; password rules shown one-at-a-time.
- **Routing nuance:** not-phone-verified users login → Phone Verification (onboarding), not the literal Welcome/carousel.
- **Locator gaps:** Home header avatar has no testID/accessibility label; native-modal dialog buttons unreachable via AX tree.

---

## 4. Techniques that worked (adopt proactively in future runs)

1. **Read the source before touching the device.** Extracting testIDs, validation logic, DOB format, referral codes, routing rules, and modal layout from `SignupScreen.tsx`/`LoginScreen.tsx`/`AppNavigator.tsx`/`seed-staging-data.ts` made every case predictable.
2. **Screenshot-first navigation.** Treat the AX tree as advisory after any transition; screenshots are ground truth (esp. PhoneVerification/Profile/native-modals).
3. **DOB-first fill + per-field verification.** Filling DOB before any other field avoids focus misdirection; verifying each field (value/bullets) before submit eliminates whole-class corruption.
4. **Pixel-scan dialog dismissal.** Green/gray/red band scan of the screenshot → point coords (÷3). Works for every native-modal dialog; never assume vertical centering.
5. **Evidence economy via cross-referencing.** A03's weak-password portion reused A02's identical-path evidence instead of a redundant relaunch — legitimate when the code path and inputs are identical (documented, not hidden).
6. **Honest BLOCKED vs. faked PASS.** B08/B09 and B06's slow-network sub-condition were documented as gaps with the exact fixture/condition needed, never forced.
7. **Registry + source-grounded test data.** Persona emails for collisions, seeded referral codes, throwaway emails for signups — all sourced from memory/seed files, never guessed.
8. **Keyboard suppression (Cmd+K)** for form-heavy cases (verified effective within a boot session).

---

## 5. What an AI agent should learn from this run

1. **Budget for friction on "simple" form cases.** A 17-case auth batch cost ~2–3× the "low complexity" estimate; the dominant costs were relaunch-per-case, stale-tree ambiguity, and native-modal dismissal.
2. **Never trust a single evidence channel after a navigation.** If screenshot and AX tree conflict, neither is trustworthy — restart the case cleanly rather than accept either.
3. **Always verify field content before submit.** Per-field re-list verification is cheap insurance against focus misdirection.
4. **Pixel-scan before tapping native-modal buttons.** Green `#5DBB8E`, gray `#E8E8E8`, red `#E85D75`; point = px ÷ 3 on this device.
5. **Distinguish environment/tooling friction from app defects.** Stale AX tree, keyboard/autofill shifts, and dev-build cold-start time are NOT app failures — report them as friction, not FAILs.
6. **A gray button is a real finding, not just a test obstacle.** The A05 gray OK button surfaced an actual design inconsistency (Signup Failed vs Login Failed dialogs) that dev should fix.
7. **When a required state can't be constructed safely (B08/B09), BLOCK with the exact fixture needed** — this converts an untestable case into an actionable dev task.

---

## 6. Session side effects / data created

- Throwaway incomplete accounts (reached Phone Verification, none completed): `qa06a@kidsmarketplace.test`, `qa06b@kidsmarketplace.test`, `qa17a01c@kidsmarketplace.test` (password `TestPass123!` each, referenced not echoed).
- `test-buyer` used for B01/B04–B06; **no credentials changed**; left in documented fixture state.
- App left logged-out at Landing.
- 25+ evidence screenshots in `e2e-test-results/phase17-auth-groups-ab-2026-08-16/evidence/`.
- Memory files updated: `/memories/session/phase17-auth-ab-plan.md`, `/memories/repo/phase17-auth-ab-facts.md`.

---

## 7. Suggested follow-ups (from this retrospect)

| # | Action | Owner |
|---|---|---|
| 1 | Add a clear-field primitive (or dev "reset form") to remove relaunch-per-case cost | Tooling/dev |
| 2 | Investigate mobile-mcp AX-tree staleness; if tooling, codify screenshot-first navigation | Tooling |
| 3 | Promote pixel-scan native-modal dismissal to a first-class §5.4 technique | Playbook |
| 4 | Fix the gray "Signup Failed" OK button (inconsistent with Login Failed) | Dev |
| 5 | Stage B08 (soft-deleted account) + B09 (auth user without profile) fixtures | Dev |
| 6 | Update AUTH guide copy (subheading, single-error password rules) + B01-half2 routing wording | Dev/Docs |
| 7 | Instrument Home header avatar with a testID/accessibility label | Dev |
| 8 | Split future form-heavy batches (Group A, then Group B) or budget for friction | QA planning |

---

*End of retrospect. Every section above is grounded in the Phase 17 run's actual trace (see `report.md` and `/evidence/`); no steps were invented or omitted.*
