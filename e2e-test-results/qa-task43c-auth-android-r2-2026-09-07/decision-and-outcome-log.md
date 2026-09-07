# QA Task 43c — AUTH on Android, Round 2 — Decision & Outcome Log

**Run folder:** `e2e-test-results/qa-task43c-auth-android-r2-2026-09-07/`
**Date:** 2026-09-07 · **Device:** `Medium_Phone_API_36.1` (Android 16, emulator-5554, 1080×2400 px, physical-pixel AX 1:1)
**App:** `com.sameralzubaidi.p2pmarketplace` (expo-dev-client dev build, Metro :8081)
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**LLM:** DeepSeek V4 Flash
**Companion outputs:** `report.md` (verdicts + findings), `ledger.md` (per-case roll-up).

## Purpose of this file
This log is the machine-readable account of **how** QA Task 43c was executed — every meaningful action, the reasoning behind it, the tool calls that mattered, and the outcome — so an AI agent (or the human team) can derive:
- **(a) what slows execution** (the call-heavy / high-friction episodes),
- **(b) what patterns an agent should adopt proactively** (avoid rediscovering the same friction),
- **(c) what instrumentation / fixture / code work removes the friction** so future smaller runs do not spend the same time and calls.

## 0. Call ledger (authoritative, mined 2026-09-07)

Mined via `npm run qa:mine-call-ledger` from this session's transcript (R71 — exact counts, not estimates):

```
Messages: 400 · Tool executions (tool.execution_start): 412
Per-tool totals (top):
  121  mcp_mobile-mcp_mobile_click_on_screen_at_coordinates
  107  mcp_mobile-mcp_mobile_list_elements_on_screen
   73  run_in_terminal
   26  read_file
   15  grep_search
   15  mcp_supabase_execute_sql
   14  mcp_mobile-mcp_mobile_swipe_on_screen
   11  memory
    8  mcp_mobile-mcp_mobile_take_screenshot
    7  mcp_mobile-mcp_mobile_type_keys
    3  mcp_mobile-mcp_mobile_save_screenshot
    2  file_search · 2 create_directory · 2 create_file · 1 list_dir · 1 replace_string_in_file
    1  terminate_app · 1 launch_app · 1 list_available_devices · 1 manage_todo_list
```

**Reading the cost picture:** 412 executions to produce **~43 verdicts** ≈ **~9.6 calls/verdict**. The dominant cost is UI-driving (clicks 121 + re-lists 107 = 55% of all calls). This is the "constant tax" the playbook measures — but several episodes below show avoidable *amplifiers* on top of that constant. Per-episode call counts in the phases below are **reconstructions** (the mined total 412 is the only exact figure); they are included to rank relative cost, and are labeled approximate.

---

## 1. Phase-by-phase decision & outcome log

Conventions: **Action** = what was done · **Why** = reasoning at the time · **Calls** = approximate executions this phase (reconstructed) · **Outcome** = result + what it taught.

### Phase 0 — Recon & environment (≈35 calls, low friction)

| # | Action | Why | Key tool calls | Outcome |
|---|---|---|---|---|
| 0.1 | Loaded playbook §5.68 R77 Android facts + 43b report + tracker + guide case bodies | 43b established the Android operating facts; brief said "don't rediscover them" | read_file ×several, memory view, grep_search | Clean start from known facts — the single best time-saver of the run |
| 0.2 | R29 busy check on emulator + process scan | Detect any in-flight agent (dev fix-task-1 had left `charliefreetest3` logged in) | run_in_terminal (ps/adb/ls) | **Dev task WAS recently active** (screenshots <10 min old); did all non-device prep (source pre-reads, DB feasibility) while waiting; re-checked and proceeded only after 3+ min of no writes. Correct R29 discipline; avoided interleaving. |
| 0.3 | Read-only DB feasibility (personas, toggles, categories) | R-NEW-6: prove fixtures before driving (qa.a01 reusable; `qa_avatar_upload_failure`/`qa_provider_unavailable`=`none`, `qa_reset_error_simulation` absent) | mcp_supabase_execute_sql ×3 | Predicted H03/C05/S03/S04 as fixture-gated **before** device time; avoided wasted on-device attempts |
| 0.4 | Source pre-reads: oauthService, oauthProviderConfig, SocialLoginButtons, Forgot/ResetPassword screens | Phase-18/§5.2 rule: understand the flow before driving it (dialog types, redirect URIs, button-disabled logic) | read_file, grep_search | Knew OAuth uses Chrome Custom Tab + `p2pkidsmarketplace://oauth-callback`; knew alerts are GlobalAlertProvider |

**Phase 0 lesson:** the 43b → 43c handoff (R77 + reusable persona) collapsed recon to ~35 calls. Investing in durable Android facts is the highest-leverage prep.

### Phase 1 — Group C (Social Login): ~55 calls for 1 PASS + 6 BLOCKED (high friction, low yield)

| # | Action | Why | Key tool calls | Outcome |
|---|---|---|---|---|
| 1.1 | Screenshot the Login social row (C03 button presence) | cheap first-leg evidence | save_screenshot | Confirmed Apple button present on Android (C03 leg-1) |
| 1.2 | **C01 attempt:** tap Google → Chrome opened → dismissed Chrome First-Run ("Use without an account") → reached accounts.google.com | Real returning-user OAuth is the documented C01 path; needed to establish Android custom-tab drivability empirically | click, list_elements, type_keys, run_in_terminal, take_screenshot | **KEY FRICTION EPISODE (≈15 calls).** Chrome Custom Tab web content is **NOT AX-exposed** (only Chrome chrome in the tree); `adb input text` into the webview **dropped leading chars twice** ("ki" lost) + a stray char; OCR-only driving of a web form is unreliable AND a fresh-device Chrome profile would trigger "Confirm it's you". Verdict: C01/C02/C04 BLOCKED (toolset/AX + external anti-automation), not app bugs. |
| 1.3 | Closed the custom tab → observed the app | C06 is "user cancels OAuth → silent return" | click (close), list_elements | C06 PASS — silent return, no error toast (cheap, reused an already-open tab) |
| 1.4 | **C03:** tapped Apple → custom tab returned `400 validation_failed "provider is not enabled"` | confirm iOS ticket #14 class on Android | click, list_elements | **BLOCKED (provider not enabled)** + a UX note: Android leaves the user on a raw JSON page in the custom tab |
| 1.5 | Read `checkZipCodeHasActiveNode` + GlobalAlertProvider cancel styling only later (Phase 3/consolidation) | source-read on ambiguity | read_file | (used for Finding #1/#2) |

**Phase 1 lessons:** (1) Android custom-tab OAuth is a **dead end for real external accounts** until a drivability solution exists — the attempt cost ~15 calls to prove what one screenshot of the empty AX tree could have shown sooner. (2) The whole C group is **fixture/provider-gated** (Apple disabled, toggles off, real-OAuth undrivable) — in future runs, treat it as a dedicated "Android OAuth round" needing dev enablement, not part of a general batch.

### Phase 2 — Group S (Password Recovery): ~120 calls for 8 verdicts (HIGHEST per-case cost; layout instability dominated)

| # | Action | Why | Key tool calls | Outcome |
|---|---|---|---|---|
| 2.1 | S02 invalid email → alert | cheap negative | type, click, list | PASS |
| 2.2 | S01/S06 valid email → Check Your Inbox + Send Another Email + Back-to-Login (both paths) | success-state UI reachable even though delivery is env-blocked | type, click, list | S01 PARTIAL / S06 PASS |
| 2.3 | S11-Case1 deep link `reset-password` | registered route (verified via AppNavigator linking config, R42) | run_in_terminal (adb), list | ResetPassword form + requirements card reached in 1 call |
| 2.4 | **S07 validation legs** | verify each inline error leg | type, click, list (many) | **KEY FRICTION EPISODE (≈45–55 calls).** The ResetPassword ScrollView **oscillated between two scroll positions** (~±327px) — the submit button's y-center moved frame-to-frame, so pre-computed tap coordinates repeatedly MISSED (tap landed on the requirements text or empty space). Then discovered the submit button is **disabled while either field is empty** (not validation-gated) — several silent no-op taps on a disabled button before this was understood from source. Field replacement needed select-all+retype (adb) + a re-list after every error line appeared/cleared (each error line shifted layout ~52px). |
| 2.5 | S10 no-session submit → alert | natural after S07 (valid fields, no tokens) | type, click, list | PASS ("No active reset session") |
| 2.6 | S09 deep-link error fragment ×2 | expired-link card | run_in_terminal (adb), list | **Minor friction:** adb multi-param fragments are lossy (`error_description` dropped → raw `error` code shown, not the friendly "expired" text). Link Error card + Request-New-Reset navigation verified; friendly branch source-confirmed. |

**Phase 2 lessons:** (1) **Layout oscillation** on ResetPassword is the #1 cost driver — a fixed-anchor technique (re-list immediately before EVERY submit tap; never reuse a submit coordinate across a frame change) is mandatory; better: fix the screen so the form doesn't oscillate (dev), or scroll-to-button + fresh list before submit. (2) **Button-disabled semantics must be read from source before testing** — I burned ~6–8 calls no-op-tapping a disabled submit because I assumed per-field validation would fire. (3) S03/S04/S05 were correctly pre-flagged fixture-gated (no `qa_reset_error_simulation`, no 400 sim value) → 0 device calls wasted there.

### Phase 3 — test-buyer Discover batch (F06 + M/N/O): ~140 calls for ~17 verdicts (medium-high; the "very long scroll" + modal sync costs)

| # | Action | Why | Key tool calls | Outcome |
|---|---|---|---|---|
| 3.1 | F06 node-scope toggle (OFF→81/ON→1154) + Other-Node badge | core node-scoping assertion | click, list, grep-resource, swipe | PASS — badge confirmed on a Greenwich card via a **targeted DB query** (find an off-node seller's item) instead of blind scrolling |
| 3.2 | M01/M03/M06/M08/M09 search+sort+trending+clear-all | quick Discover interactions | type, click, list | PASS (search debounce, sort reorder, no-results, active chips) |
| 3.3 | **Gboard keyboard + mic-permission dialogs** | text focus on Discover search unexpectedly raised the soft keyboard (Gboard IME) + 2× "Allow Gboard to record audio?" | list (empty/keyboard trees), click, run_in_terminal (keyevent 4) | **FRICTION (≈6–8 calls).** Contradicted 43b's "no keyboard" fact (per-IME variance — Gboard now present). Handle: Deny mic + back-key to dismiss. One recent-chip tap was consumed by the permission dialog. |
| 3.4 | M04/M05 Filters sheet structure + SP toggle sync | verify redesigned sheet | click, list | PASS — but **first filter apply surfaced the 06850 waitlist bug (Finding #1)** |
| 3.5 | **06850 duplicate-node investigation** | filter-apply on the ACTIVE home ZIP wrongly showed "Not Available in Your Area" | click, list, save_screenshot, mcp_supabase_execute_sql ×2, read_file | **KEY FRICTION + KEY FINDING (≈15–18 calls, HIGH VALUE).** Root cause: TWO active nodes share 06850 (Norwalk + a diagnostic "Diag Test Node") → `checkZipCodeHasActiveNode` `.maybeSingle()` errors → returns false. Cost was real, but this is a MODERATE product bug that explains a whole confusing class of behavior (O02 blocked; M05-apply path). Fix is dev-side. |
| 3.6 | **O03 99999 waitlist consent flow** | explicit Yes/No, no auto-enroll | type, click, list, mcp_supabase_execute_sql (row counts) | PASS with DB proof (No→0 rows, Yes→exactly 1 row for 99999) — BUT **FRICTION: a mis-derived tap** ("Yes, Add Me to the Waitlist" at y1374 instead of its center y1274) hit the No button's top edge → wrong outcome → re-drove the whole 99999 apply (≈5–6 wasted calls). Lesson: read button centers from the tree bounding box; never tap a row edge/gap. |
| 3.7 | M10/N02/N03/N04 favorites + pagination + SP badges | remaining Discover assertions | click, list | PASS (favorite add→Favorites→remove-with-confirm; pagination loads new cards; SP badges verified) |

**Phase 3 lessons:** (1) A **DB-targeted approach beats blind scrolling** for "find an item with property X" (3.1 used a seller-node query → the badge check was one search, not 10 scrolls). (2) **Modal/button centers come from the tree**, never from a remembered offset — the O03 mis-tap cost a full re-drive. (3) **The 06850 bug should be fixed before the next Discover/O02 round** — it poisons every home-ZIP filter apply. (4) Gboard IME variance must be re-checked per emulator (now codified).

### Phase 4 — D02 Settings sign-out: ~20 calls (moderate — navigation detour + non-scrolling Settings)

| # | Action | Why | Key tool calls | Outcome |
|---|---|---|---|---|
| 4.1 | Home → Profile → scroll → App Settings → Sign Out → confirm → Landing | D02 = Settings sign-out (distinct from 43b's D01 Profile logout) | click, list, swipe ×2, run_in_terminal? | PASS. **FRICTION:** (a) a header tap meant for Profile on Discover hit **Messages** (Discover has no profile button — header layout differs per screen) → detour back to Home; (b) Settings' scroll **ignored swipe attempts that started over list rows** — needed a longer swipe from a higher start. ~6–8 calls of navigation friction. |

**Phase 4 lesson:** header button sets differ by screen (Home has Profile, Discover has Favorites/No-profile) — resolve the target from the CURRENT screen's tree, not memory (now the §5.1 norm, re-confirmed).

### Phase 5 — Combined fresh-signup block (A06 + E02/E03 + H02 + F01/F05): ~90 calls for 6 verdicts (HIGH friction, but dev-fill was the win)

| # | Action | Why | Key tool calls | Outcome |
|---|---|---|---|---|
| 5.1 | **First signup: manual top-down fill (name/email/phone) then DOB/password via TAB** | assumed TAB would advance fields like a form | click, run_in_terminal (keyevent 61/input text), list | **KEY FRICTION EPISODE (≈25–30 calls).** (a) Signup form content is taller than the viewport and **swipes starting over text fields did NOT scroll** (only a swipe from the y≈600 social area worked); (b) **TAB (keyevent 61) leaked input** — DOB year "1990" landed in the Password field → corrupted password; (c) repair attempts (select-all retype) kept racing layout → **terminate + relaunch** (§5.2) and restarted. |
| 5.2 | **Second signup: `dev-fill-test-user-1` (Alice) one-tap autofill** | memory (`signup-keyboard-scroll.md`) documented the dev autofill → unique email/phone in one tap | click, list | **THE time-saver of the run** — replaced ~25 calls of field entry with 1 tap. DOB 15/01/2000 + passwords pre-filled correctly. |
| 5.3 | A06 invalid referral (ZZZZZZZZ) → dialog → Continue anyway | verify invalid-code handling | type, click, list | PASS — dialog exact copy + Fix it/Continue anyway; Continue anyway proceeded code-less |
| 5.4 | E02 wrong code 999999 → error; E03 resend countdown | OTP error + cooldown | type, click, list, save screenshot? | PASS (E02 "Verification Failed / Invalid verification code" — doc-drift copy; E03 "Resend in 17s") |
| 5.5 | H02 Profile Setup validation (1-char name + 3-digit ZIP) | required-field errors | type, click, list | PASS — but **FRICTION: the first Complete-Setup tap silently no-op'd** (stale layout), needed a second tap; after fixing fields the OLD inline errors stayed visible until the next submit (confusing, but correct on submit). |
| 5.6 | F01/F05: ZIP 06850 → city-state lookup → Complete Setup → onboarding → Get Started → Home | active ZIP → node, no waitlist | type, click, list, mcp_supabase_execute_sql (DB verify) | PASS — persona `qa.alice.17888028470414455@…` created (FREE, node Norwalk, phone-verified), DB-verified, reusable |

**Phase 5 lessons:** (1) **`dev-fill-test-user-*` is mandatory for any fresh signup** — never hand-type the whole form again. (2) **Never TAB between RN fields on Android** (now codified R77#11); fill by tap+type+verify. (3) **Scroll the signup from a non-input area** (now codified R77#10). (4) The single corrupted field cost a full relaunch — the §5.2 "relaunch rather than repair" rule was correct and cheap in hindsight.

### Phase 6 — Evidence re-drive + consolidation (owner feedback): ~15 calls + file writes

| # | Action | Why | Key tool calls | Outcome |
|---|---|---|---|---|
| 6.1 | Owner: (1) A06 dialog misaligned / off-spec; (2) only 2 screenshots on disk | address both notes | read_file (GlobalAlertProvider/design doc), click/type/list + save_screenshot (re-drive dialog), view_image | Finding #2 (design deviation, gray-outline cancel) + 3rd evidence screenshot captured |
| 6.2 | Consolidated report/ledger/tracker + §8.3 handoff | R52/R53 deliverables | create_file, replace_string_in_file, memory | Handoff re-emitted; tracker Android-R2 note updated |
| 6.3 | Applied the 3 handoff rule suggestions into the QA playbook (§5.6 mandate, §5.68 R77#10/#11) | apply-handoff-rule-suggestion workflow | multi_replace_string_in_file | Rules persisted for future runs |

---

## 2. Friction heat-map (episodes ranked by cost — the "where did the calls go")

| Rank | Episode | Phase | Approx calls | Root cause | Fix class |
|---|---|---|---|---|---|
| 1 | ResetPassword layout oscillation (S07) | 2 | ~45–55 | ScrollView oscillates ±327px frame-to-frame → stale submit coordinates; submit disabled-until-both-fields not obvious | **Dev:** stop the form oscillation (scroll-to-active / KeyboardAvoiding fix). **QA:** re-list immediately before every submit; source-read button-disabled semantics first. |
| 2 | First signup corrupted by TAB-leak + no-scroll | 5 | ~25–30 | TAB (keyevent 61) leaks input across RN fields; swipe over inputs doesn't scroll | **QA:** dev-fill + tap+type+verify (now R77#10/11). **Dev/RN:** disable TAB traversal on Signup DOB/password, or accept it as QA-only (dev-fill exists). |
| 3 | Android custom-tab OAuth dead end (C01/C02/C04) | 1 | ~15 | Custom-tab web content not AX-exposed; webview text entry drops chars; external anti-automation | **Dev/instrumentation:** a drivable OAuth path (in-app webview with JS bridge, or accept BLOCKED and don't retry in general batches). |
| 4 | 06850 duplicate-node finding (O02/M05-apply) | 3 | ~15–18 | Two active nodes share ZIP 06850 → `.maybeSingle()` errors | **Dev fix + ops cleanup** (deactivate Diag node / tolerant lookup) — HIGH-VALUE fix that unblocks a whole confusing class. |
| 5 | Gboard keyboard + mic-permission dialogs | 3 | ~6–8 | Per-IME variance (Gboard shows, 43b's AOSP didn't); mic permission on text focus | **QA:** re-verify per emulator (now noted); Deny mic + back-key. |
| 6 | O03 Yes-tap miscoordinate | 3 | ~5–6 | Tapped row edge/gap (y1374) not button center (y1274) | **QA:** derive centers from the tree bounding box (§5.1), never a remembered offset. |
| 7 | Settings/Profile navigation detour + non-scrolling rows | 4 | ~6–8 | Header button set differs per screen; swipe-over-row doesn't scroll | **QA:** resolve from current screen tree; swipe from non-input area (R77#10). |
| 8 | S07 no-op taps on disabled submit | 2 | ~6–8 | Assumed validation errors on submit; button actually disabled while empty | **QA:** source-read disable semantics before testing a form's submit gating. |
| 9 | S09 adb error-fragment lossy | 2 | ~2–3 | `&`-separated fragment params dropped by adb deep link | **QA:** craft single-param fragments; friendly-text branch source-verified. |
| 10 | Complete-Setup silent no-op (H02/F01) | 5 | ~3–4 | Stale layout / first-tap missed; stale inline errors persist until submit | **QA:** trust-but-verify second tap; re-list after error/fix state changes. |

**Constant tax not counted above (present in every phase):** clicks 121 + re-lists 107 ≈ 228 calls (55%). This is the irreducible cost of AX-driving with per-tap list-before-tap; the amplifiers above are what the fixes should target.

---

## 3. Analysis

### (a) What slows execution (in order of impact)

1. **Layout instability → stale coordinates → missed taps → re-lists + re-drives.** The single biggest amplifier. ResetPassword's frame-to-frame oscillation, the signup/error-line shifts (~42–52px per error line), and button-y movement between frames all turn one intended tap into 3–5 calls (tap-miss → re-list → re-derive → tap → verify). Mitigation exists (re-list-before-every-tap) but it is itself the constant tax; the durable fix is making the forms stop oscillating.
2. **Unknown control semantics discovered by no-op tapping.** Testing a submit button whose disabled rule (either field empty) wasn't visible cost ~6–8 calls of no-ops. Reading the screen's disable/validation logic from source BEFORE driving a form is cheaper than discovering it empirically.
3. **Field entry that isn't robust (TAB-leak, webview char-drop, swipe-over-input no-scroll).** Every text-entry mechanism that isn't "tap field → type → verify that field" leaked or missed; the leaks cascaded into full form corruptions and a relaunch.
4. **Interacting with undrivable surfaces (real-OAuth custom tabs).** ~15 calls to prove what a single screenshot of the empty AX tree implied: web content isn't drivable. Not having an upfront "is this surface AX-drivable" gate costs a full attempt per OAuth case.
5. **Environment variance (Gboard IME + mic permissions; scroll behavior) rediscovered mid-run.** Small per-emulator differences turned into dialog-handling detours.
6. **Screenshot under-capture** — not a runtime cost, but it made the run's evidence non-re-verifiable and drew owner feedback; the correction (mandatory §5.6 capture) is now a hard rule.

### (b) Patterns an agent should adopt PROACTIVELY (derived from what worked)

1. **Read the 43X handoff facts first** (R77 Android facts, reusable personas) — recon collapsed to ~35 calls. Always check `/memories/session/*` + the previous run's report before driving.
2. **DB-target instead of scroll-hunting**: to find "an item with property X" or prove a state invariant, run one read-only query (seller-node lookup, zip_waitlist count) — it turned a scroll-heavy badge check into one search.
3. **Source-read before testing a form/modal**: button-disabled semantics, error rendering, dialog types (GlobalAlertProvider vs native), and the exact styles/colors (design-compliance findings) come from source in 1–2 calls, not from no-op taps.
4. **Verify fixtures/toggles BEFORE device time** (read-only `admin_config` + persona queries): H03/C05/S03/S04 were pre-flagged → zero wasted device calls.
5. **Use the one-tap dev fixtures** (`dev-fill-test-user-*`, `dev-verify-otp-123456`, `qa-login-as`) wherever they exist — they replaced ~25+ calls of hand entry.
6. **Derive tap points from the current tree's bounding-box center** — never a remembered offset or a row edge/gap (§5.1, re-confirmed by the O03 mis-tap).
7. **Bounded first-attempt per surface**: for any unproven interaction surface (custom tab, native picker, new IME), take ONE screenshot + tree read to establish AX-drivability before investing in text entry.
8. **Terminate+relaunch early on corrupted fields** (§5.2) — cheaper than a repair spiral (proven twice this run).
9. **Persist evidence screenshots as you go** (never defer to end-of-run, never substitute AX text) — now a hard §5.6 rule.
10. **Batch verdicts by persona + surface** (one Discover session = ~17 verdicts; one fresh signup = 6 verdicts) to amortize the login/navigation tax.

### (c) Instrumentation / fixture / code work that removes the friction (dev-side asks, ranked)

1. **Stop the ResetPassword ScrollView oscillation** (dev, mobile): the form bounces between two scroll positions on Android; pin the scroll position or remove the auto-recenter so submit coordinates are stable.
2. **Fix Finding #1 (06850 duplicate node)** — tolerant `checkZipCodeHasActiveNode` (`.limit(1)`/unique-on-active-zip) + deactivate/delete the "Diag Test Node" (`6bf728cf-…`). Unblocks O02/M05 apply and removes a whole confusing class.
3. **Fix Finding #2 (A06 dialog design)** — GlobalAlertProvider cancel buttons should use the design-doc Secondary variant (green outline/text), and confirm a single primary per dialog. (Owner-reported.)
4. **Android OAuth drivability** — a dev/QA mechanism to complete real external OAuth on Android (or accept C01/C02/C04 as permanently toolset-BLOCKED and stop retrying them in general batches; give them a dedicated round only when a mechanism exists).
5. **Fixture toggles** — arm `qa_provider_unavailable`, `qa_avatar_upload_failure`, create `qa_reset_error_simulation` (+ a 400 value) so C05/H03/S03/S04/S05 become drivable; attach a real OAuth identity to `qa-social-only` (C07).
6. **Instrumentation asks:** (a) AX-expose submit-button disabled state so no-op taps are avoidable; (b) disable Android TAB traversal between RN TextInputs on long forms (or ship a dev-fill for every long form); (c) a `qa:ax-tree --coords` first-class output (already requested); (d) a stable "scroll to element" primitive so swipe-over-input no-scroll stops costing calls.
7. **Evidence hygiene:** per-transition screenshot automation (a session-local "auto-screenshot on transition" toggle) would make §5.6 free.

---

## 4. Appendix — evidence locations

- Verdicts & findings: `report.md` (this folder) — Finding #1 (06850), Finding #2 (A06 dialog), doc-drift list.
- Per-case roll-up: `ledger.md` (this folder).
- Screenshots: `screenshots/` (3: `C03-login-social-row-android.png`, `O03-active-zip-06850-waitlist-dialog.png`, `A06-invalid-referral-dialog-layout.png`).
- Rules codified from this run: `.github/instructions/QA-Test-Agent.instructions.md` §5.6 (mandatory evidence capture) + §5.68 R77 items 10–11 (Android scroll-start; Android TAB-leak).
- Call ledger miner: `npm run qa:mine-call-ledger` (mined total 412 — see §0).
