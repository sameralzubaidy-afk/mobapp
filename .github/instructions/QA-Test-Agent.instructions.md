---
description: "Use when executing manual test cases for the Kids P2P Marketplace iOS app as the QA Test Agent: the full operating playbook — canonical sources, locator resolution, keyboard/coordinate stability, polling + perceived load-time tracking, dialog handling (incl. empirical dialog-type verification), environment-blocker (LogBox/deep-link) detection, evidence capture, three-layer UX judgment incl. popup/modal design-system compliance, test-persona registry, reporting format, and the QA Session Handoff template."
applyTo: "cross-checked-and-consolidated/**"
---

# QA Test Agent — Operating Playbook

This is the detailed operating playbook for the QA Test Agent (execution-only test runner defined in `.github/agents/QA-Test-Agent.agent.md`). The agent file carries the persona/role, scope, and tool set; this file carries everything needed to actually run a case well. **Read it before the first run of a session and follow it in full during every execution run.**

Section numbers continue from the agent file, so cross-references resolve cleanly: agent file = §1 role/boundary, §2 scope, §3 tools, §4 playbook pointer, §5 invocation; this file = §4 canonical sources, §5 operating rules, §6 judgment, §7 test personas, §8 report format, §9 friction & follow-ups.

## 4. Canonical sources (read before executing)

The 6 canonical guides (newer, consolidated — **do not** read root/`misc.` copies; they are older):

1. `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
2. `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md`
3. `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
4. `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md`
5. `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md`
6. `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`

**TC-ID disambiguation (CRITICAL):** TC-IDs are **reused across guides with different meanings** (e.g. `TC-A01` = signup in the AUTH guide, Cash-Only happy path in TradeFlowV2, admin login in the Admin guide). Always execute the case from the **named guide** the user gives you (or the one you infer from the TC-ID prefix + context), and always state `(guide, TC-ID)` in your trace. Regression sections reuse group-letter IDs with different meanings too — grep `^## ` and `^### ` in the guide before trusting an ID.

**Enriched case format** (Phase 9 instrumented cases carry these fields — read all of them before starting):
- `**Setup:**` — preconditions and the exact navigation path to get into the case state.
- `**Locator hints:**` — concrete `testID`/accessibility identifiers per interactive element, plus the screen source file.
- `**Assert:**` — the hard assertion conditions to evaluate.
- `**Dependencies:**` — runtime needs: seeded state, network, or — for the three exempt dialog categories — the concrete handling technique (see §5.4).
- Legacy cases may have only `**Steps:**` / `**Expected Result:**` — if so, treat `Expected Result:` as the assertion source and note the case is not instrumented.

**Verify a referenced case actually exists before executing it (Phase 23):** If a case's `Assert`/`Dependencies` section references another case (e.g., "see AUTH-TC-X07"), verify that referenced case is actually registered in the guide's index/TOC before attempting to execute it — a cross-reference is not proof of registration. If the referenced case doesn't exist, do not fabricate execution of it; instead, execute the underlying intent as part of the current case's discriminating checks, and report the documentation gap (dangling reference) as a finding.

**Flow-registry / source pre-read requirement (Phase 18, generalized to ALL flows in Phase 22):** Before attempting to execute or navigate any flow the agent has not already mapped out in a prior session (per repo memory), consult `docs/flow-registry.md` for the documented flow structure, and read the relevant screen/component source files, before interacting with the UI. This applies to ALL unfamiliar flows, not just OAuth — e.g., a multi-step flow with a sub-choice (such as a 'Sell' entry point offering multiple listing-creation paths) should be understood from the flow registry and navigation source BEFORE attempting blind UI navigation. If a case appears BLOCKED because the agent doesn't understand how to reach a required screen, check the flow registry and source FIRST — do not report BLOCKED until this investigation step has been done and still fails to clarify the path forward. The original OAuth-specific form of this rule (Phase 18) still holds as the concrete example: before executing any social-login test case, read `src/services/oauthService.ts` and `oauthProviderConfig.ts` (or equivalent OAuth service/config files) in full. OAuth initiation behavior is version-sensitive (e.g., how `state` is extracted from `supabase-js`'s `signInWithOAuth` response depends on the exact library version and `skipBrowserRedirect` behavior) — understanding this before testing is what allowed Phase 18 to root-cause a P0 outage with certainty rather than just reporting 'it throws an error.'

**Literal accessibility-prop text grep during source pre-reads (Phase 13.40):** when doing the standard source pre-read of a screen before device testing, include a quick check for the literal `accessible accessibilityRole="..."` text-as-content pattern — accessibility props (`accessible`/`accessibilityRole`/`accessibilityLabel`) pasted as literal `<Text>` children instead of real JSX attributes on an opening tag. This bug class has recurred 3 times across unrelated screens (`WelcomeScreen`, `ResumeDraftBanner`, `CartScreen`) and is cheap to catch from source (`rg -n "accessible accessibilityRole=" p2p-kids-marketplace/src`) before spending device time confirming it visually — if a `<Text>`'s rendered children contain prop-like keywords (`accessible`, `accessibilityRole`, `accessibilityLabel`), flag it as a suspected paste-corruption and note it as a source-side finding for the dev agent.

**Read-only DB precondition verification before on-device work (Phase 23 — highest-leverage addition):** Before beginning on-device execution, when a test case's setup depends on data state (e.g., a persona's node assignment, listing counts, account status), run read-only DB queries to verify that state actually matches what the case assumes — do not assume a documented persona or precondition is accurate. In one documented run, this single step correctly predicted 3 of 4 execution surprises (an undocumented setup gap, a missing fixture, and an unregistered case) before any device time was spent. This is the single highest-leverage step available and should be treated as close to mandatory whenever DB read access is available and a case has data-dependent setup.

**Dev LogBox console errors as legitimate failure evidence (Phase 18):** When a user-initiated action produces no visible dialog, toast, or banner, but a `console.error` appears in the dev LogBox, treat this as legitimate first-pass failure evidence — do not dismiss it as noise or wait for a user-facing signal that may never come. A silent failure (no UI feedback at all) is itself a valid and often more severe finding than a poorly-worded error message, and should be reported as such (see Phase 18's silent-OAuth-failure UX finding as the reference case).

## 5. Operating rules (the battle-tested playbook)

### 5.1 Locator resolution (mandatory before EVERY interaction)

- Call `mobile_list_elements_on_screen` **before every tap** — never reuse a previously-fetched tree or coordinates. Trees/coordinates go stale the moment the UI changes.
- Resolve the target by its `testID` / accessibility identifier per the guide's `Locator hints:` and `locator-conventions.md`, extract the **current** coordinates from that fresh tree, then tap via `mobile_click_on_screen_at_coordinates`. There is no tap-by-id primitive — this resolution step is mandatory, not optional.
- **Locator-gap handling (the nested-text-link bug class, fixed in Phase 12.5):** if the target is not exposed as a distinct element (e.g. text nested inside a touchable that doesn't surface its own identifier):
  - Do **not** silently derive coordinates and move on.
  - Flag it explicitly as a **locator-gap finding** in the report.
  - Note the coordinate-derivation fallback you used to continue the test (e.g. tapped the parent container's coordinates).
  - Recommend it as a follow-up instrumentation fix.
- **One miss, full re-derive — never guess nearby coordinates (Phase 25):** after a tap at a derived coordinate misses its target, do not retry at a nearby offset (e.g., ±10–30px guesses). Take a fresh screenshot and fully re-derive the target's position via OCR or pixel-probe before the next attempt. Repeated nearby-guess retries compound wasted cycles without new information.
- **AX-tree inline truncation — extract full tree coordinates from the resource file (Phase 13.41):** the mobile-mcp element-listing tool's inline output truncates at roughly 2,000 characters, but the underlying resource file it is generated from can hold the full tree (confirmed 17KB+ in one case). When a target element lacks a `testID` and its coordinates are not visible in the truncated inline output, extract them from the full resource file directly with a targeted grep (e.g. `grep -o '"name":"…"[^]]*'` for the specific element name) rather than assuming the element isn't present or falling back immediately to pixel-scanning. This is cheaper than pixel-scan and should be tried first for any non-`testID` coordinate need. **Phase 25/Dev Task 25 — use the anchored helper instead of the three-hop dance:** `npm run qa:ax-tree -- <resource-file> --name <anchor> [--max N] [--list]` (`scripts/qa/ax-tree.mjs`) flattens the tree, filters by name/label/testID substring, and prints coordinates with pagination — no truncation, no grep-on-huge-file. `--list` prints just the labels (compact grep); remember AX coordinates are POINTS (screenshots are 3x — multiply by 3 for pixel regions, Phase 13.42).

### 5.2 Keyboard / coordinate stability (the primary documented failure source)

- **Re-list the element tree after every keyboard state change** (focus/blur/show/hide) — coordinates captured before a keyboard event are invalid afterward. A visible keyboard shifts layouts and can make taps land on keys.
- **Keyboard-done affordance (Dev Task 25) — prefer the in-app Done button over the hardware-keyboard keystroke:** the trade offer screens (`TradeOfferScreen`, `TradeInitiationScreen`) now render an iOS keyboard accessory with a **Done** button (`testID: keyboard-done-button`, label "Done") above the keyboard on their SP amount inputs. Tapping it dismisses the keyboard in one step — no `Cmd+K` needed on those screens. Resolve it from the fresh AX tree (or OCR the "Done" label and pixel-scan) like any control.
- If a field's value looks corrupted after typing (wrong characters, partial text, wrong field), **do not attempt to repair it** — terminate and relaunch the app, then restart the case from its `Setup:` state.
- **Generalized fill-order + per-field verification rule (broadened from the Phase 17 DOB-first lesson, Groups A/B; extended in Phase 22 to auto-formatted/OTP inputs):** on any multi-field form where fields can shift layout or steal focus from one another (e.g., a keyboard-avoiding view repositioning content, an autofill suggestion bar appearing on a secure field, or a multi-segment picker), **do not assume a tap-then-type sequence lands in the intended field**. Re-list the accessibility tree (or screenshot, per the §5.9 AX-tree-staleness rule) after each field entry and confirm the value landed correctly before proceeding to the next field or submitting. Choose a fill order that minimizes focus-stealing hazards where the form structure allows it (e.g., filling a field prone to triggering a suggestion bar last, or filling grouped/segmented fields before free-text fields). **This rule applies to auto-formatted or PIN/OTP-style inputs just as much as plain text fields** — these often have async formatting or debounce behavior that can make a field appear filled before the underlying state has actually registered the value. Before tapping Verify/Submit/Continue on any such field, explicitly re-list and confirm the field's actual current value matches what was intended, not just that typing occurred without an apparent error.
- **OTP digit-box recovery when replacement fails (Phase 13.25):** if an OTP/verification-code digit-box field already has populated digits and a new input attempt doesn't correctly replace them (character-drop or stale-value issues), do not repeatedly retry the same replacement approach. Use the field's 'Change Phone Number' or equivalent reset control to clear state, then enter the code digit-by-digit rather than as a bulk paste.
- **Below-fold coordinates are logical, not rendered, when the keyboard is up (Phase 22):** when the software keyboard is visible, the accessibility tree's reported y-coordinates for below-fold elements (e.g., a submit button) reflect the logical/content layout position, not the actual rendered on-screen position after the keyboard compresses the view — these can differ by 100+ points. Never trust tree y-coordinates for below-fold interactive elements while a keyboard is up; pixel-scan for the element's known visual signature instead (e.g., the primary green `#5DBB8E` pill for a submit button) and tap the rendered position.
- **Screenshots are 3× scale — OCR/badge-scan region args are PIXELS, AX-tree coordinates are POINTS (Phase 13.42, 2026-08-27 TRD part-2):** a full-screen mobile screenshot is 1320×2868 px = 440×956 pt (3×). `qa:ocr --region` and `qa:badge-scan --region` (and ImageMagick `-crop`) take PIXEL coordinates, while the AX tree reports POINTS. To crop/OCR a region identified from the tree, multiply by 3 (`x*3, y*3, w*3, h*3`); passing tree points as pixels crops a tiny sliver near the top and returns empty/misleading OCR. Confirm the actual scale with `sips -g pixelWidth -g pixelHeight <shot>` before any region crop.
- **Text-field tap calibration (Phase 22; refined Phase 13.34):** when tapping a reported field coordinate, treat the reported y as the field's center by default — do not blindly apply a fixed offset (e.g., +10pt) as a standing calibration. Only apply an offset after a tap at the reported coordinate has been confirmed to miss, and even then, re-derive the correct offset empirically for that specific field/build rather than reusing a previously-learned offset from a different screen or build (on the current build the reported y is already accurate as the box center, so a standing +10pt offset lands taps at the box's bottom edge and misses).
- Note: the simulator software-keyboard toggle is a per-boot, in-memory state (`Cmd+K` / I/O → Keyboard → Toggle Software Keyboard) — see `simulator-keyboard-suppression.md` for the verified facts. Do not rely on it being persistently off; re-verify by re-listing the tree after any keyboard interaction. **Empirically (Phase 13.38, 2026-08-23 Groups F+G run): on the current build the keyboard re-shows on EVERY new field focus even after a Cmd+K suppression, so the standing practice is to re-apply Cmd+K immediately before each submit/tap that needs an unoccluded button, then confirm via a fresh tree list (or OCR) that the keyboard is actually gone before tapping below-fold controls.**
- **Default keyboard suppression for Discover-focused groups (Phase 13.31):** for any test group primarily exercising the Discover screen or other search/filter-heavy surfaces, apply the standing simulator keyboard-suppression technique (per `simulator-keyboard-suppression.md`) at session start by default, rather than reactively after hitting keyboard-occlusion or missed-tap friction. Chip rows, empty-state actions, and similar below-the-fold controls on these surfaces are known to be keyboard-sensitive.

### 5.3 Waiting / polling

There is no dedicated wait primitive. After any action expected to cause a transition:
- Re-call `mobile_list_elements_on_screen` on a short retry loop — poll roughly every 1–2s, timeout roughly 15–20s — rather than assuming instant state change.
- **Timed transitions only:** when you are measuring a perceived load time (§5.7), tighten the poll interval to **~500ms–1s** for that transition. Keep the general 1–2s rule for untimed "did the state change" checks.
- Between polls, capture the tree or a screenshot so the trace shows the progression (or lack of it).
- **Wait for meaningful values, not mere non-emptiness (Phase 13.39):** when polling/waiting for an async field to populate, assert the actual expected value or a meaningful state change, not mere non-emptiness. Some fields have a non-empty sentinel/default value before their real async update lands (e.g., a coordinate field defaulting to "0" before a ZIP-lookup populates the real value, a count defaulting to "0" before a real tally loads, a status field defaulting to a placeholder string). A wait/poll that only checks "is this field non-empty" will pass immediately against the sentinel and silently race the real update, producing a false-positive verification. Before writing any wait/poll condition, check what the field's value is *before* the expected async operation completes — if it's already non-empty in that state, the wait condition must check for the specific expected value, a value different from the known sentinel, or an explicit loading-state flag instead of just presence/non-emptiness.

### 5.4 Dialogs (approved Option B convention + empirical verification)

For any case whose `**Dependencies:**` field names one of the three **exempt native/SDK dialog categories**, follow the documented handling technique exactly as recorded in that field — do not try to attach app locators to them (they are outside the app's render tree and permanently out of scope for `testID`/`data-testid`):

1. **Stripe `PaymentSheet`** (mobile card entry) — native sheet. Enter a test card (e.g. `4242 4242 4242 4242`, any future expiry, any CVC) directly into the sheet's fields.
2. **React Native `Alert.alert`** (confirm/remove/error dialogs) — native OS alert; match buttons by their **text** (the buttons are OS-rendered). Options are usually explicit in the case (e.g. `Delete`, `Cancel`, `Continue anyway`).
3. **Browser `confirm()`/`alert()`** — admin-only; not executed by this agent (see §2).

When a case is a mix of instrumentable elements AND a dialog, keep using the real locator hints for the instrumentable part and handle only the dialog by the recorded technique.

**Empirical dialog-type verification (do not trust the label blindly, and do not assume a single pattern):** a case's `Dependencies:` label (e.g. "native Alert.alert") can be stale (doc drift — a real Phase 14 finding: Group S's "native Alert.alert" alerts actually render in-app via `GlobalAlertProvider`), and this codebase has **at least two distinct in-app dialog implementations** that present differently to the AX tree (real Phase 17 finding, Groups A/B). **Verify empirically each run** by checking the actual element tree the moment the dialog appears — **check for BOTH types below, never assume a single pattern**:

- **`GlobalAlertProvider` (AX-tree instrumentable):** renders within the app's React tree and typically surfaces real, locator-instrumentable buttons (e.g. `global-alert-button-0/1` identifiers). When buttons surface in the tree, treat the dialog as normally locator-instrumentable — resolve + tap by identifier per §5.1, and **do NOT apply Option B's coordinate/text-matching fallback unnecessarily**.
- **`ui/Modal` (native RN Modal — pixel-scan required):** renders as a genuine native modal in a **separate window** whose buttons **never appear in the mobile-mcp AX tree, regardless of empirical checking** (real Phase 17 finding — the age-gate, invalid-referral, signup/login-failed, and logout-confirm dialogs in Groups A/B; the Phase 13.8-era assumption that `ui/Modal` buttons like `login-failed-dialog-ok-button` are tree-instrumentable is wrong for these). Interact via the **native-modal pixel-scan technique** below.
- Only if the tree shows OS-rendered content with no app identifiers (true native `Alert.alert`, Stripe `PaymentSheet`) do you fall back to the Option B technique.
- Record any mismatch between the label and reality as **doc drift** in the report (e.g. "guide says native Alert.alert, but the dialog is in-app GlobalAlertProvider — Option B not needed").

**Native-modal pixel-scan technique (first-class §5.4 operating technique, not an ad-hoc fallback):** for dialogs that render as native modals in a separate window (e.g. `ui/Modal` — buttons never surface in the AX tree), dismiss or interact via a **screenshot pixel-color scan** for the button band:

1. Take a screenshot of the dialog.
2. Scan it for the known band color — the **primary-green `#5DBB8E`** band (primary pill CTA), the **secondary/disabled-gray `#E8E8E8`** band (cancel / disabled-style button), the **destructive/danger red `#ff6b6b`** band (confirm-danger actions such as the cancellation-reason modal's confirm), or the **disabled pink `#ffb3b3`** band (a danger button in its disabled state) — see §5.38 R1 for the full native-modal palette.
3. Convert the scanned pixel band to a tap point accounting for the device's **point-to-pixel ratio** (e.g. **3x** for the simulators used so far — divide the pixel coordinate by the scale to get the point coordinate used by `mobile_click_on_screen_at_coordinates`); tap the band's center.
4. Verify the dialog dismissed via the next screenshot/tree poll.
5. Note the observed band color as part of design-system compliance (§6.4) when relevant — e.g. a primary button rendering in the disabled-gray band is a deviation (as observed on the Phase 17 "Signup Failed" dialog).

**Go straight to pixel-scan — do not re-list first (Phase 13.43 / TRD Group A/B, 2026-08-28):** when a case expects a native modal (`ui/Modal` bottom sheet, accept/OK alert), the element tree returns empty or near-empty (B04's cancellation-reason sheet; A01/A02's seller-accept OK). Do not spend a re-list cycle searching the tree for modal buttons — go directly to screenshot + pixel-scan. **Read the component source when a button's color/state is ambiguous:** the B04 confirm was assumed green but is actually red (`#ff6b6b`, disabled `#ffb3b3`) per `CancellationReasonModal.tsx` — reading the source on ambiguity is cheaper than multiple wrong-color scans (see §5.38 R1).

**Dev Task 25 — trade-flow confirmations now carry stable testIDs (Phase 25):** `TradeConfirmationModal` buttons accept `confirmTestID`/`cancelTestID` and default to `trade-confirm-button`/`trade-cancel-button`; the trade screens pass distinct ids (`accept-trade-confirm-button`, `decline-trade-confirm-button`, `complete-trade-confirm-button`, `confirm-all-trades-button`, `cancel-all-trades-button`, `extension-accept-button`/`extension-decline-button`, `notif-ok-button`, `offer-limit-view-offers-button`). `CancellationReasonModal` reason rows are `cancellation-reason-<id>` (e.g. `cancellation-reason-other`) and footer buttons are `cancel-trade-keep-button` / `cancel-trade-confirm-button`. When a tree tool DOES expose modal content (e.g. Maestro `id:` locators), resolve these by id first; keep the pixel-scan technique as the fallback when the mobile-mcp tree returns empty for a native modal window.

**Pixel-scan disambiguation caution for closely-spaced similar rows (Phase 22):** when multiple similar, closely-spaced, unlabeled UI rows exist near each other (e.g., a 'Resend code' link near a 'Change phone number' link), a pixel/color-band scan can misattribute which row is which, leading to an incorrect tap. Before acting on a pixel-scan result in this situation, cross-reference against a wider screenshot crop showing surrounding context, and verify immediately after tapping (via screenshot or tree) that the expected outcome occurred before proceeding to the next step — don't assume the tap landed correctly just because a tap was registered.

**Measure exact bounding boxes for non-AX-exposed controls, don't estimate centers (Phase 23):** When pixel-scanning for a non-AX-exposed control's tap position, measure the full bounding box via connected-component analysis on the element's known color, and tap the measured center — do not estimate a center from a partial scan or assumed dimensions. An estimated tap position missing the actual bounding box by even a small margin wastes a full tap-and-recheck cycle; a properly measured tap is reliable on the first attempt.

### 5.5 WebView screens

Element trees on WebView-rendered content explode to 200KB+ and are **unusable as an evidence channel**. For any WebView content (e.g. Terms/Privacy pages), use **screenshots as the primary evidence**, and assert by visible content rather than by element identity.

### 5.6 Evidence capture

- Screenshot at **every screen transition**, any **unexpected state**, and the test's **final state**.
- Log the **full execution trace** — every tool call, in order — not just the final verdict. The trace is what makes a FAIL reproducible.
- Save screenshots to the run's evidence location (timestamped) and reference them by path/description in the report.
- **Verify where side-effectful terminal commands actually land (Phase 22):** terminal tooling may silently alter a command (e.g., dropping a leading `cd`), causing file/directory operations to land in an unexpected location relative to the intended working directory. After any command that creates files or directories, verify the actual location (e.g., via `ls`) rather than assuming it matched the intended path.

### 5.7 Perceived load-time tracking (for timed transitions)

For EVERY action expected to cause a screen transition (navigation push, login, checkout submit, filter apply, tab switch, modal open/close, refresh, deep-link landing, etc.), capture a perceived load time:

1. **Start timestamp** — record the wall-clock time when the action is issued (tap submitted).
2. **End timestamp** — record when the target screen's **key element first appears** in the polling loop (§5.3).
3. **Elapsed time** — `end − start`; report it inline in the per-case execution trace (§8.1) and aggregate into the batch-summary table (§8.2).

Rules:

- Use the **~500ms–1s poll interval** for the timed transition (deliberate tightening of §5.3's general 1–2s rule; the general rule still applies to untimed checks).
- Label every reported measurement explicitly: **"Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile."**
- **Flag any transition ≥ 3 seconds as a UX/performance finding** (screen, transition, elapsed time, and whether loading feedback was shown — see §6.2).
- This is a qualitative UX signal, not a profiler — never present it as a formal benchmark.

### 5.8 Environment-blocker detection (LogBox / deep-link fatal overlays)

On dev builds, opening a deep link that lands on a screen during startup can raise a **non-dismissible LogBox fatal overlay** (Phase 14 real finding: `p2pkidsmarketplace://reset-password` → "Uncaught `new NativeEventEmitter()` requires a non-null argument." + caught "Error parsing initial URL ..."; the footer Dismiss/Minimize is NOT in the AX tree and the header only cycles logs; a plain launch with no deep link is clean). Before treating ANY deep-link-dependent case as runnable:

1. **Verify clean state first:** `mobile_terminate_app` → plain `mobile_launch_app` → poll for the Landing screen (no overlay).
2. Only then exercise the deep link exactly as the case's `Setup:` specifies.
3. If a redbox/fatal overlay appears and is **not dismissible within 3 attempts** (tap where Dismiss/Minimize should be, re-list the tree to confirm no progress):
   - Record it as an **environment blocker**: verdict **BLOCKED** with a clear description (exact overlay text, the trigger, and that it is deep-link-specific if a plain launch is clean).
   - **Do not keep retrying** the case.
   - File it as an environment blocker + recommended dev-agent follow-up in the report — it is NOT an app-behavior failure of the case under test.

### 5.9 AX-tree staleness (stale/cached element snapshots — screenshot is the source of truth)

The mobile-mcp accessibility-tree snapshot (`mobile_list_elements_on_screen`) can return **stale/cached content after certain screen transitions** (real Phase 17 finding: during PhoneVerification and Profile navigation the tree returned the previous screen's elements — Signup form / Home / Item Detail — while the actual rendered screen had moved on). The tree may show the previous screen's elements while the real screen differs.

When staleness is suspected — e.g. an assertion doesn't match what the flow should produce, or repeated re-lists return identical content across a known transition — treat the **screenshot as the source of truth, not the tree**. Do not act on stale tree data as if it were current: re-verify via screenshot before proceeding, and note the staleness as **tooling friction in the report** (§9) rather than an app defect.

**Known-stale-screen list — HARD RULE: record proven-stale screens and skip straight to screenshot/OCR (Phase 25; elevated to a hard rule Phase 13.37):** If the accessibility tree returns stale/pre-interaction content twice in a row on the same screen, treat that screen as stale for the remainder of the session — switch fully to screenshot+OCR for every subsequent interaction on that screen rather than re-polling the tree each time and falling back only after another miss. Re-polling a screen already proven stale wastes a full round-trip per interaction. **Additionally, record that screen in session/repo memory as a known-stale screen** (e.g., Profile after certain actions; any WebView-rendered screen), and on future runs, for those specific screens, skip attempting AX-tree-based element location first and go directly to screenshot + OCR / pixel-scan — avoiding a wasted full poll-and-fail cycle on a tree read already known to be unreliable for that screen. This is a hard, non-optional rule, not style guidance: AX-tree staleness on Profile and WebView screens has now forced mid-run re-verification more than once (e.g., B09 and D01 in the Group A+B+D run).

**Scroll-blocker detection refinement (Phase 22):** confirm a suspected scroll blocker via screenshot pixel-diff before and after the swipe attempt (not just visual inspection or tree comparison) — this gives a definitive, quantifiable answer (e.g., '0 changed pixels' vs. '190K changed pixels') rather than a subjective judgment call. A swipe producing 0 changed pixels across variants is a scroll blocker to report as tooling friction — don't keep retrying it as if it were a tap-placement problem. **Caveat (Phase 22 — avoid false-positive defect reports):** a swipe producing 0 changed pixels is not automatically a scroll defect — before concluding a screen is blocked or broken, check whether the screen's content is actually scrollable at its current state. Conditional rendering (e.g., a form that only appears after a prerequisite action, like adding a photo) can mean there is genuinely nothing to scroll yet, which is correct behavior, not a bug. Investigate the screen's conditional-rendering logic (via source, if available) before reporting a scroll blocker as a defect or an unresolvable BLOCKED condition — the real issue may be an earlier prerequisite step that wasn't completed, not the scroll mechanism itself.

**Scroll-anchor technique for diagnosing true scroll state (Phase 23):** When it's ambiguous whether a swipe actually scrolled content (vs. the list already being at its maximum scroll position), track a known, stable element's position (e.g., a pinned header) before and after the swipe, rather than assuming from a single screenshot. This distinguishes "nothing to scroll further" from "the swipe didn't register" without guessing.

**Small-swipe + tree-position-verify for sticky-footer long forms (Phase 13.25):** On long forms with a sticky/fixed footer element (e.g., a pinned Publish/Submit button), a large swipe gesture can cause the ScrollView content to 'teleport' past the intended target. Prefer small swipes (≤80px) and re-verify the target element's tree position after each swipe, rather than assuming one large swipe reaches the target reliably.

**Deterministic pixel/OCR fallback when visual tools fail (Phase 23):** If `view_image` or equivalent visual tooling fails to deliver parseable image content in a session (returns only a resource URI, not usable pixels), do not treat this as a dead end — fall back to deterministic pixel/color analysis (e.g., ImageMagick connected-components on a known theme color) and/or an OCR pass on the screenshot file directly. Treat "visual tooling may be broken this session" as a real possibility to check early, and have this fallback ready rather than discovering it's needed mid-investigation.

**Slice-OCR for button rows when full-OCR reading order is unreliable (Phase 25):** When a horizontal row of buttons/controls isn't individually exposed in the accessibility tree and full-frame OCR returns an unreliable reading order (letters/words out of visual sequence), crop the row into narrow vertical column slices and OCR each slice independently to resolve exact button positions and boundaries. Apply this as soon as a button row's OCR reading order looks suspicious, rather than after multiple full-OCR attempts fail.

**Color-signature-then-bounding-box for non-exposed visual elements (Phase 25):** To locate a non-AX-exposed visual element (an image tile, badge, or indicator dot), first identify a stable color signature (e.g., the average color of a known bundled asset, or a documented brand/semantic color), locate candidate regions via that signature, then confirm the exact position via a pixel probe or connected-components bounding box — never estimate from the color match alone. When comparing state before/after an action (e.g., confirming a badge moved), compare exact pixel counts or bounding boxes, not just approximate positions.

**Discover grid sub-element coordinates can be stale/logical vs. rendered:** On the Discover results grid, item sub-element coordinates reported by the accessibility tree can be stale or reflect logical (pre-layout) positions rather than actual rendered positions — one documented case showed a badge reported at a tree coordinate that didn't match its actual rendered pixel position by a significant margin. When verifying grid-card sub-elements (badges, price, etc.), treat a pixel-scan of the screenshot as authoritative over the tree-reported coordinate when they disagree.

### 5.10 Field clearing before relaunch (first-class technique — attempt this before a resetting relaunch)

Before relaunching the app to reset a field's content between test cases (e.g., testing multiple input variants on the same form), **first attempt field clearing**: long-press the field → tap **Select All** → type the replacement text. This technique was proven effective for password/text fields in Phase 14/15 (Group S — ForgotPassword/ResetPassword) but was **not** applied in Phase 17 (Group A/B — Signup/Login), causing an avoidable ~15+ relaunch cost driven by the assumption that fields can't be cleared. **Hardware select-all keystroke (`Cmd+A`) is the reliable default (Phase 13.43 / TRD Group A/B, 2026-08-28):** long-press → Select All is **not** reliable across field types on the current build — it failed on the SP numeric field (two long-press attempts produced no edit menu; the working technique was the hardware select-all keystroke `Cmd+A` via the terminal, then retype). Prefer `Cmd+A` → retype as the primary clearing technique for any unfamiliar field type; reserve long-press → Select All for field types explicitly proven to support it on this build (see §5.38 R3). **Only fall back to a full relaunch** (then restart the case from its `Setup:` state) if:

- **(a)** the long-press → Select All approach doesn't work for that specific field type (e.g., some multi-segment pickers like the DOB day/month/year fields may not support it the same way — **verify per field type, don't assume**), or
- **(b)** a field has already become corrupted from a focus-misdirection error — the existing §5.2 corrupted-field discipline **still applies as-is** (terminate + relaunch; never attempt to repair).

**Distinction from the §5.2 corrupted-field rule (not a contradiction):** §5.10 covers the **deliberate** case of clearing a valid-but-wrong-for-this-case value to enter a different one; §5.2 covers values corrupted by focus misdirection (wrong characters / partial text / wrong field). The two situations are different — never use §5.10 to "repair" a corrupted field.

**Record which field types support this technique** (text inputs, secure/password fields, etc. vs. segmented pickers) in the session/repo memory, so future runs don't have to rediscover it.

### 5.11 Session-verification diagnostics (session/auth-state confirmation — UI observation is not sufficient evidence)

When a flow's success depends on a session or authentication state being established (e.g., OAuth completion, any login flow), and the app's post-action behavior is ambiguous or silent, do not rely solely on UI observation to determine success or failure. Verify session state directly: check the app's local storage (e.g., AsyncStorage manifest for a `sb-*`/`auth-token` key, or equivalent for this app's session-storage mechanism) to confirm whether a session was actually established. Where relevant, cross-check the backend's audit/auth logs for the corresponding event (e.g., a provider login event in `auth_audit_logs`). This combination distinguishes 'the upstream action failed' from 'the upstream action succeeded but the app failed to receive/process it' — a distinction that determines whether the finding is a provider/config issue or a client-side app defect. This technique should be used without needing to repeat/retry the original action, which matters especially when using real external credentials (see credential-sparing-use guidance) or backend-fixture-dependent test flows.

**Phase 19 reference case (OAuth completion):** both Google and Facebook authenticated fully server-side (Google login event confirmed in staging `auth_audit_logs`), yet the app returned to Login with **no session** — the app's AsyncStorage manifest had no `sb-*`/`auth-token` key. The direct session check is what separated "provider auth failed" from "provider auth succeeded but the app's callback-return delivery dropped the session" (a client-side/infra defect) without retrying the real credentials.

**Device-log caution (Phase 19 close-out — post-fix verification):** a `_UIViewServiceHostSessionErrorDomain Code=4 "Invalidation requested"` line in the simulator device log at the moment the OAuth consent browser closes is **benign ASWebAuthenticationSession teardown noise, NOT a callback-failure signal** — it also appears on *successful* callback delivery (empirically confirmed on-device when the fixed build delivered the session). Never cite it as evidence of a broken return leg. The decisive evidence is the combination in this section: (1) the app's AsyncStorage manifest (`sb-<ref>-auth-token` present = session delivered; absent = callback not delivered) and (2) the backend `auth_audit_logs` provider-login event — not the device log.

### 5.12 Hermes CDP console capture (JS-level error/console evidence — default technique, not a last resort)

When an app-side JS error needs to be captured and the standard device log doesn't surface RN `console.*` output (a known limitation — RN dev console output routes to Metro's terminal/Hermes inspector, not the unified OS log), use the Hermes CDP inspector directly: fetch `http://localhost:8081/json` (or the relevant Metro port) to find the inspector WebSocket target (`ws://…/inspector/debug?device=…&page=1`), connect a WebSocket client, and stream `Runtime.consoleAPICalled`/`Log.entryAdded`/`exceptionThrown` events to a capture file. Reconnect and re-resolve the target if the connection drops (e.g., across an app relaunch). This gives direct, live access to the exact JS console output — including error strings — that the unified device log and screenshot channels cannot provide, and should be the default technique whenever a JS-level error needs to be captured, not just a fallback for when other channels fail.

**Phase 21 reference case (AUTH-TC-C01 Google closure — verified recipe):** this technique captured the exact OAuth lines live (`🔔 Auth session result: success`, `🔐 Setting session from implicit flow tokens...`, `[NAV] route: Home`) that the unified device log had never surfaced (the Phase 20 C01 root-cause blind spot) — proving the app-side session-set succeeded with zero error lines and closing the Phase 20 P2 "JS console inaccessible" blocker with certainty. Concrete verified steps:
- The Metro inspector exposes debug targets at `http://localhost:8081/json`; the RN app target is the `"type": "node"` entry whose `webSocketDebuggerUrl` is `ws://localhost:8081/inspector/debug?device=<id>&page=<n>`.
- Connect any WebSocket client (Metro ships `ws` at `node_modules/ws`); send `Runtime.enable`, `Log.enable`, and `Console.enable` (the target only emits events while a client is attached — `/json` shows the target only while the app is connected to Metro).
- Read the stream: `Runtime.consoleAPICalled` events carry `params.type` (`log|warn|error|debug|info`) and `params.args` (RemoteObjects — extract `.value` or `.description`); `Log.entryAdded` carries `entry.level`/`entry.text`; `Runtime.exceptionThrown` carries `exceptionDetails.text` + `exception.exception.description` (the full stack trace). Passive streaming only — no stepping/breakpoints needed, so the app runs normally.
- Re-resolve the target from `/json` and reconnect if the socket closes (the device/page id changes across an app relaunch — a re-resolve loop keeps the capture continuous across the whole run).
- When the app-side error path logs the failure (e.g. the OAuth logging fix logs `[SocialLoginButtons] OAuth flow failed: <errorCode> <errorMessage>`), this capture is what retrieves the exact string, distinguishing exchange-vs-session-set failures without retrying real credentials.

**DB-over-CDP for persistence assertions; verify capture contents before treating absence as evidence (Phase 13.36):** Before treating an empty or missing result from a console/capture tool as evidence that an event did not fire, first verify the capture actually contains the expected type of content at all (e.g., check it captured *any* events from the relevant time window, not just that it ran). A confirmed prior session's capture delivered only a burst of pre-capture replay events and then went silent — an empty-looking result that could easily be misread as "no events fired" when it actually meant "the capture missed the window entirely." For analytics/telemetry persistence assertions (e.g., "an event was recorded"), prefer the database as the authoritative channel — a read-only DB query (per §5.14 / the MCP approval discipline) is deterministic and definitive; treat CDP console capture as a fallback for such persistence assertions, not the default. Use the DB verdict to arbitrate before concluding an event did not fire.

### 5.13 DEV-autofill default for repeated signups (first-class technique — Phase 22)

When a test case requires a fresh signup account and a DEV-only autofill helper exists (e.g., `dev-fill-test-user-1/2/3`), use it as the default approach: trigger the autofill, then override only the fields that must be unique for the test (typically email and phone) via the hardware select-all keystroke (`Cmd+A`) → retype — per §5.10 / §5.38 R3, long-press → Select All is not reliable on all field types. This is significantly faster than filling every field from scratch and should be the standard pattern for any group requiring repeated fresh accounts, not an occasional shortcut.

### 5.14 Terminal approval discipline (read-only command discipline)

The QA Test Agent is a read-only test-execution agent. Minimize terminal approval prompts without expanding your authority or making changes to the application, repository, infrastructure, or staging data. This section governs **ad-hoc commands issued during a run**; it does not restrict the sanctioned single-entry test suite (`bash test-automation/trade-flow-v2/scripts/run-suite.sh` from the workspace root — its archive + GitHub-issue filing + `git commit` within `e2e-test-results/` are the suite's documented contract per `.github/copilot-instructions.md` and are pre-approved, never to be reproduced ad-hoc). Evidence/report files written into the run's own archive folder `e2e-test-results/<run>/` (via `create_file`, `mobile_save_screenshot`, or `cp`) are the agent's deliverable surface and need no approval — **no write outside `e2e-test-results/` is covered by this exception**.

**Command construction**
- Prefer one simple, read-only terminal command at a time.
- For inspection and evidence collection, prefer: `rg`, `grep`, `cat`, `sed`, `jq`, `find`, `ls`, `pwd`, `stat`, `file`, `wc`, `head`, `tail`, `sort`, `diff`, `git status`, `git diff`, `git log`, `git show`, `node`, and `python3`.
- `xcrun simctl` device-state commands (`list`, `boot`, `launch`, `openurl` for deep-link delivery such as `p2pkidsmarketplace://qa-logout`) remain permitted — they change simulator state, never the repo or infrastructure.
- Prefer direct commands such as `rg "tab-.*" path/to/file` over a compound command that first assigns a variable and then pipes output.
- Use `python3` or `node` only for read-only parsing, analysis, test execution, screenshot inspection, accessibility-tree inspection, or evidence extraction.

**Avoid approval-triggering shell patterns**
- Do not use `;`, `&&`, `||`, pipes (`|`), command substitution (`$(...)`), shell functions, `eval`, heredocs, process substitution, or temporary shell scripts unless there is no practical single-command alternative.
- Do not chain multiple investigations into one terminal call. Run separate read-only commands instead.
- Do not create temporary scripts or files merely to simplify a command. Use direct read-only commands where possible.
- When a compound command is genuinely necessary for test execution or evidence collection, keep it read-only and explain why it cannot be split before requesting approval.

**Strictly prohibited without explicit user approval**
Never run commands that can modify code, files, Git history, dependencies, databases, Supabase, cloud infrastructure, credentials, deployment state, or remote systems (except the sanctioned suite and the `e2e-test-results/` evidence archive above). This includes:
- Git writes: `git add`, `git commit`, `git push`, `git reset`, `git clean`, `git checkout`, `git restore`, `git rebase`, `git merge`, `git stash`, tag creation, branch creation, or worktree changes.
- File writes or destructive operations: `rm`, `rmdir`, `mv`, `cp`, `chmod`, `chown`, `touch`, redirection that writes files (`>` or `>>`), `tee`, `sed -i`, or file-generating scripts.
- Dependency changes: `npm install`, `npm uninstall`, `npm update`, `yarn add`, `yarn remove`, `pnpm add`, `brew install`, or equivalent commands.
- Database or Supabase writes: SQL `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `DROP`, `TRUNCATE`; Supabase migrations, deploys, seeds, resets, or mutations. Read-only SQL stays permitted (e.g. `mcp_supabase_execute_sql` baselines and §5.11 session checks).
- Infrastructure and deployment activity: `aws`, `sam deploy`, Terraform, CloudFormation, CI/CD triggers, app-store actions, or any release/deployment command.
- Credential or remote-network activity: `curl`, `wget`, credential changes, token generation, secret writes, or remote downloads. Localhost-only reads for the §5.12 Hermes CDP capture (e.g. fetching `http://localhost:8081/json`) remain permitted.

**Escalation**
- If a task requires a command that could write or mutate anything, stop before executing it.
- State the exact command, the target, the expected change, why it is necessary, and the safest read-only alternative if one exists.
- Request explicit user approval before proceeding.
- Having read-only Supabase credentials does not authorize any mutation attempt.

### 5.15 Stale-observation check for backend-object findings (verify before escalating)

When a QA finding reports a backend object (RPC, migration, table, column) as absent or misbehaving, before treating it as confirmed and escalating for a code fix, check whether the object now exists and when it was deployed (e.g., `pg_proc`/`information_schema` presence plus `supabase_migrations.schema_migrations` timestamp) and compare that timestamp against the QA capture's timestamp. If the deploy postdates the capture, the finding is stale, not live — note this explicitly in the report rather than re-escalating a resolved gap.

### 5.16 Logout technique (prefer the `qa-logout` deep link over the Profile UI logout when stuck)

The `p2pkidsmarketplace://qa-logout` deep link is the preferred, fast, reliable way to log out during a test session. If attempting to log out via the Profile screen's UI logout row and it isn't readily locatable (e.g., due to AX-exposure gaps requiring pixel-scanning) within a small bounded number of attempts, do not over-investigate — fall back to the qa-logout deep link immediately. Only use the Profile UI logout path when a test case specifically requires verifying that exact UI flow (e.g., a logout-confirmation-dialog case); for all other session-teardown purposes, the deep link is faster and should be the default.

### 5.17 DB-gate triggers: best-effort audit-log inserts roll back with the aborted statement (expected, not a bug)

When reviewing or writing a DB-gate trigger (e.g., a `BEFORE INSERT` guard that raises an exception to block a disallowed write), note that any audit-log insert attempted from within that same trigger will roll back along with the aborted statement — Postgres triggers do not get autonomous transactions. This is expected behavior, not a bug, and matches existing precedent in this repo (the COPPA guard trigger). If persisted observability of blocked attempts is desired, it must be logged from the calling application after catching the error, not from inside the trigger.

### 5.18 iOS RN 0.81: `accessibilityRole="tab"` / `"tablist"` / `"adjustable"` do not register in the AX tree (Phase 13.27, extended Phase 13.35)

Do not use `accessibilityRole="tab"`, `"tablist"`, or `"adjustable"` on iOS with RN 0.81 — none of these roles reliably register in the Fabric accessibility tree, and elements using them will silently fail to surface despite correct `accessible`/`accessibilityLabel`/`accessibilityState` props. Use `accessibilityRole="button"` with appropriate `accessibilityState` to convey the semantic meaning instead (current-step/selected for tabs, or just treat slider increment/decrement/track controls as buttons). When encountering a new custom or less-common `accessibilityRole` value on this RN version, treat it as unverified until confirmed via on-device AX-tree inspection — several roles beyond just `tab` have now proven unreliable.

Confirmed cases:
- **`tab`/`tablist`** (Phase 13.27, 2026-08-20): `bulk-step-*` on `BulkListingCreateScreen` never surfaced on-device until the role was changed to `"button"`; the container `tablist` had no effect.
- **`adjustable`** (Phase 13.35, 2026-08-23): the `RadiusSlider` track (`radius-slider-track`, Discover filter modal) was invisible in the AX tree with `accessibilityRole="adjustable"` + `accessibilityValue`; switching it to `"button"` made it surface as a Button ("Search radius slider"). When an AX-instrumentation fix is reported as complete for an element using any of these roles, verify on-device before accepting the fix — prop review alone has twice reported working fixes that didn't actually work on-device.

### 5.19 Multi-surface technique rules (Phase 13.28 — Group L trace)

Six technique rules consolidated from the Group L (AUTH-TC-L01–L04, admin listing approval) decision-and-outcome trace, where mobile form-fill/OTP and Playwright-timing bugs dominated wall-clock. **Phase 13.28 v2 supersedes the original LogBox-only Phase 13.28** by folding that rule into Rule 6 below (no separate LogBox-only version remains).

**Rule 1 — HARD GATE: never tap AX-tree coordinates while the keyboard is visible.** This rule is a hard, non-optional gate — not style guidance — because the underlying hazard has now caused two separate field-corruption-and-relaunch incidents (Group P P17; Group A A02, same root cause: tapping a below-fold element using AX-tree logical coordinates while the keyboard was still visually up, which shifted the actual rendered position). If the most recent screenshot shows a visible keyboard, do not tap any element using AX-tree-reported coordinates alone — with no exceptions for "the coordinate looked stable" or "this worked last time." First take a fresh screenshot (after dismissing the keyboard, or via pixel-scan if the target is a colored button, e.g. the primary-green `#5DBB8E` pill) to confirm the actual rendered position — every single time. The keyboard-up layout can also shift the focused field, so a guessed coordinate can land back inside it (e.g., appending a stray digit to a price field): this gate therefore also covers assumed-neutral post-typing dismiss taps — always re-measure via OCR/pixel-probe of known static text before any dismiss tap, even when the tap's intent has nothing to do with the field itself. If a field is found corrupted after a dismiss tap, terminate and relaunch and redo the form rather than attempting a repair. Treat any violation as a correctness bug in execution, not a style preference.

**Rule 2 — Switch to digit-by-digit OTP entry on the first failure, not after retrying.** When entering an OTP/verification code into auto-advance digit boxes, if a bulk-paste or fast-type attempt drops or mangles characters, switch immediately to digit-by-digit entry with a manual Verify-button tap as backup (in case auto-verify races the last digit's state update). Do not retry the same bulk approach a second time before switching.

**Rule 3 — Playwright `--grep` must target a unique test-title fragment.** When running Playwright with `--grep`, never use a bare test-case ID (e.g., "L04") if it could also appear as a substring inside a `describe` block's title — `--grep` matches the full title string, and a substring match against the describe title will silently re-run the entire suite under it. Grep a fragment unique to the specific test's own title.

**Rule 4 — Wait for the redirect decision on client-side-auth web apps.** When automating a web app that guards routes via a client-side auth check (e.g., a `useEffect`/`getUser()` call that redirects to login asynchronously after the route resolves), never treat `page.url()` immediately after `page.goto()` as authoritative — the redirect may not have fired yet. Use `page.waitForURL()` to wait for the actual redirect decision (either to the login page or staying on the target route) before deciding whether a login flow is needed.

**Rule 5 — Use DB read-back to arbitrate between a backend bug and a test bug.** When a UI-level assertion fails after an action that has a server-side effect (e.g., an approval, a status change), check the database state directly before concluding the backend is broken. If the DB shows the correct end state, the failure is in the test's UI assertion (e.g., a stale filter, a race with an auto-refresh) — fix the test, not the app. This DB-arbitration step has twice, in separate sessions, correctly redirected a suspected app bug into a same-session test fix instead of an unnecessary dev escalation.

**Rule 6 — LogBox: bounded dismiss attempts, then terminate and relaunch.** If a dev-build LogBox (non-fatal console-error overlay) blocks on-device interaction and its dismiss/header controls aren't reliably locatable via the accessibility tree or pixel-probing within 2-3 attempts, stop trying to locate the dismiss control and terminate + relaunch the app instead — session/persona state persists across relaunch, and this is faster than continuing to hunt an unreliable control. (This is the Phase 13.28 v2 replacement for the original LogBox-only rule; it complements the fatal-overlay handling in §5.8.) **Stale-replay LogBox — terminate + relaunch immediately, skip the bounded attempts (Phase 13.43 / TRD Group A/B, 2026-08-28):** when the overlay is a *replay of a previously-seen error* (the same console error re-scrimming the screen after a fresh action — this run saw a replayed idempotency error block the Accept tap on a fresh listing, and a replayed cap error block a freed-slot offer), do not spend even the bounded attempts on dismissal — terminate + relaunch immediately; session/persona state persists and the relaunch is faster and more reliable (see §5.38 R4).

**Full-screen scrim intercepts taps EVERYWHERE, not just on the card (Phase 13.42, 2026-08-27 TRD part-2):** a non-fatal LogBox overlay renders a full-screen transparent scrim that eats taps even BELOW/OUTSIDE the visible error card. A modal button rendered visually below the card (e.g., a liability-disclaimer 'Accept' that sits under the LogBox card) is still untappable — the tap does nothing and no new error is logged — until the LogBox is dismissed. Treat the overlay as blocking the WHOLE screen, never assume taps below the card pass through. Dismiss the LogBox (or terminate + relaunch) before tapping anything behind it, and re-verify via a fresh tree list (or OCR) that the LogBox is actually gone.

### 5.20 Multi-surface screenshot evidence rule — admin/web screenshots are MANDATORY (Phase 13.29; hardened 2026-08-21)

When a test run spans multiple surfaces (e.g., mobile via simulator + admin/web via Playwright), **every surface must leave screenshot evidence in the run's shared evidence folder** — this is mandatory, not aspirational. A run's final evidence set must let someone reconstruct what happened on every surface, not just the one that failed.

**Admin/web (Playwright) surfaces — ALWAYS capture screenshots where applicable:**

1. **Never rely on Playwright's default failure-only screenshot behavior.** A fully passing run saves ZERO screenshots, so an all-green suite produces no admin visual evidence at all. This was a real gap observed 2026-08-21: the Group L spec had no `page.screenshot()` calls and the passing run left the admin surface with console output + DB read-backs only.
2. **Preferred — the spec itself takes explicit `page.screenshot()`** at each key assertion point: login success, each key state before/after an action (e.g., pending queue → details modal → confirm dialog → approval alert → post-action state), and final confirmation. Save into the run's shared `screenshots/` dir with a surface+step-obvious name (`ADMIN-L02-approve-confirmed.png` alongside `MOBILE-L01-pending-item.png`).
3. **If the spec lacks screenshot calls and cannot be edited during an execution-only run — capture them with a small evidence-capture Playwright script** that reproduces the flow and screenshots each step (reference: `capture-admin-evidence.cjs` from the 2026-08-21 Group L closeout). Verified recipe:
   - Run it from the web-app directory with `NODE_PATH=$PWD/node_modules node <script>` — importing `@playwright/test` from a script located outside the app's `node_modules` fails in ESM (`ERR_MODULE_NOT_FOUND`), so use a CommonJS `.cjs` script + `NODE_PATH`.
   - Read admin credentials from the app's `.env.local` inside the script (`dotenv.config` with the correct relative path — the run's archive dir sits 2 levels under the workspace root, NOT 3) — never route credentials through the model.
   - Name outputs `ADMIN-<step>.png` into the same `screenshots/` folder as mobile evidence.
   - Reproducing an action changes state (e.g., re-approving a listing → `available`): record the resulting state in the report's App-State section.
4. **Verify evidence completeness before finishing a run:** after a passing Playwright run, check that admin screenshots actually exist in the evidence folder (a passing run never auto-produces them); if missing, run the capture step above rather than shipping a console+DB-only admin surface.
5. **Embedded-browser hit-testing can fail at narrow panel widths — use DOM-level clicks / event dispatch, and treat it as tooling friction, not an app defect (Phase 13.38, 2026-08-23 Groups F+G run):** when the admin UI is driven through an embedded/responsive browser panel that renders at a narrow width, Playwright/native coordinate clicks may silently miss their targets (a fixed sidebar overlays table row actions; modal submit buttons land off-viewport). This was confirmed twice in one run via an injected click counter (`clicks: 0` despite a successful `click()` call), and it is NOT an app defect. Diagnose before escalating: probe `document.elementFromPoint(x, y)` at the target's reported center, and if the click is not landing, drive the control directly — DOM-level `el.click()` for buttons/actions, or dispatch a bubbling `submit` event (`form.dispatchEvent(new Event('submit', { bubbles: true }))`) to exercise a React form's real `onSubmit`/validation logic (verified to render the app's genuine validation errors). Set a desktop viewport (`page.setViewportSize`) where the panel allows it. Note the workaround in the case trace as tooling friction.

### 5.21 Stale dev-server diagnostic — an admin/web server 404ing on all routes is NOT an app-side blocker (Phase 13.30)

If an admin/web dev server serves HTTP 404 on every route despite the correct app and routes existing in source, do not immediately treat this as an app-side blocker — check whether the dev server process is stale (e.g., left running across a git checkout, branch switch, or code change since it last started) before escalating. Restart the dev server (its documented `npm run dev` recovery) and re-verify a known route (e.g., `/auth/login`) returns 200 before declaring an admin-side blocker. Also check the listening process's working directory to rule out it serving the wrong app entirely. (Confirmed case, Phase 13.30: a stale Next.js admin dev server left running across a git operation/code change served 404 on every route despite the correct app and routes existing in source.)

### 5.22 Visual presence ≠ AX-tree presence (Phase 13.32)

A control being visually present on screen is not evidence it is exposed in the accessibility tree — the two are independent and a control can silently fail to register despite looking correct. Any claim that a control 'is now AX-exposed' or 'should surface correctly' must be confirmed via actual on-device or simulator accessibility-tree inspection, never accepted from source/prop review alone. This applies especially to bare `Pressable`/`TouchableOpacity`-based custom buttons, which do not get implicit accessibility semantics the way native platform buttons do.

### 5.23 Shell & evidence-tool policy (MANDATORY)

> This policy supersedes any more permissive wording elsewhere in §5 (including §5.14's command-construction list) where the two conflict — it is the authoritative shell discipline for this agent.

You MUST NOT author inline shell scripts, heredocs, `awk`/`sed` pipelines, shell variable-assignment chains, output redirects (`>`), inline Swift, or semicolon-chained compound commands.

For any screenshot analysis, OCR, pixel/badge color scan, image crop/diff, or screen inspection, you MUST call the approved npm QA scripts:

- `npm run qa:ocr -- --img <path> [--region x,y,w,h] [--json]`
- `npm run qa:badge-scan -- --img <path> --region x,y,w,h --token name=SP100,...`
- `npm run qa:image-diff -- --a <p1> --b <p2> [--region ...] [--threshold 0.05]`
- `npm run qa:inspect-screen -- --img <path>`

If a needed analysis isn't covered by these scripts, STOP and flag it as a follow-up (propose a new `qa:*` script) — do NOT improvise shell. All `/tmp` writes and Swift/awk logic live inside these scripts, never in agent-generated commands.

The only other shell commands you may run are direct read-only inspections: `ls`, `cat`, `grep`/`rg`, `head`, `tail`, `find`, `git status|diff|log|show`. No pipes, no redirects, no chaining.

### 5.24 Long-run session discipline — mandatory checkpoints, count-based AND trigger-based (Phase 13.36)

In any multi-case session (~10+ cases), impose a **mandatory count-based checkpoint every ~10–12 executed cases**: pause, summarize verdicts so far, flag any strain or deviation from the operating rules, and confirm the re-list/keyboard, evidence-capture, and dialog-handling disciplines are still being followed.

**Additionally, a mandatory checkpoint is triggered immediately by EITHER of the following events, regardless of case count:**

- **(a) Any re-authentication / login cycle** — a fresh login, an app relaunch that restores a session, or a persona switch. At this triggered checkpoint, explicitly confirm that the §5.2 re-list-after-keyboard-change discipline will be followed with **zero exceptions** on the upcoming login steps. A confirmed session found the single deviation from this existing rule — skipping the re-list on a second, later-session login — caused a corrupted field and a full terminate + relaunch + redo.
- **(b) Any tooling failure or unexpected result from a verification method** — e.g., a capture tool (CDP console capture, OCR, badge-scan, screenshot) returning empty, truncated, or unexpected data. At this triggered checkpoint, explicitly confirm that the verification method's actual output was inspected for the **target content** (not just "it ran without erroring") before concluding a negative result, and that a **fallback method** is used rather than retrying the same failed approach (see the §5.12 DB-over-CDP rule).

### 5.25 Fail fast when source already proves a path impossible (Phase 13.36)

If source code inspection already demonstrates that a path is gated or impossible under current conditions (e.g., a button is conditionally hidden for the exact state your test data is in), stop exploring that path immediately and report it as a **fixture/precondition gap** rather than continuing to search for a workaround through the UI. Continuing to explore a source-proven-impossible path wastes the most effort for the least value of any pattern observed across multiple sessions. (Confirmed case: a messaging path gated on an in-progress trade was chased across multiple screens and accounts before a source read proved the Message button is hidden for pending/cancelled trades.)

### 5.26 Batch test cases by persona to minimize re-authentication cycles (Phase 13.36)

When planning execution order for a multi-case session, group cases requiring the same logged-in persona together before switching to a different persona, rather than following the guide's numeric case order if that order causes unnecessary persona switches. Each login/logout or relaunch cycle is one of the most expensive and highest-risk operations in a session (both in wall-clock cost and in being the point where field-corruption errors occur) — minimizing the number of these cycles is a direct, high-leverage lever for reducing both time and risk in a long run. Note the persona-batching order (and any deliberate deviation from guide order) in the run's execution trace.

### 5.27 Prefer simultaneous evidence over sequential action-then-recheck (Phase 13.36)

When a guide's prescribed verification method is sequential (e.g., "complete or cancel a trade, then recheck a count"), consider whether the current data state already provides equally strong or stronger **simultaneous** evidence (e.g., existing completed/cancelled items alongside existing active ones, observed at once) without requiring a new mutating action. Prefer the non-mutating simultaneous-evidence approach when it demonstrates the same rule at least as conclusively — this also avoids unnecessary fixture-state mutation. Record the substitution (and why the simultaneous evidence is conclusive) in the case's trace.

### 5.28 Batch test cases by required form baseline, not just guide order (Phase 13.37)

When multiple cases in a group operate on the same form (e.g., repeated signup or login attempts with slightly different field values), sequence them to minimize the number of full field-clear operations. Group cases that share a common base state (e.g., "valid signup minus one field") together, and only mutate the one delta field between them — reusing the prior case's other field values via long-press → Select All → retype on just that field (§5.10) rather than re-filling the entire form from scratch or relaunching for a "clean form" by default. Reserve a full relaunch/clean-form restart for when a case genuinely needs an empty form (not just a different value) or when a field has been corrupted (§5.2). This complements §5.26's persona-batching: §5.26 minimizes login/logout cycles, this rule minimizes the per-form field-entry cost within a single persona. Note the batching order and any deliberate deviation from guide order in the run's execution trace.

### 5.29 Prefer lightweight in-app reset over full relaunch for local form state (Phase 13.37)

A full app terminate+relaunch re-downloads the dev bundle (5–10+ seconds) and should be reserved for corrupted fields (§5.2), stuck overlays/dialogs that resist dismissal (§5.8 / §5.19 Rule 6), or genuine app-state resets (e.g., session/logout state). When only a screen's local form inputs need to be cleared, prefer navigating away and back to the same screen (triggering a component remount) instead of a full app relaunch — this is materially cheaper and accomplishes the same "clean form" goal for cases that don't require a fresh app process. Only escalate to a full relaunch when the navigate-away-and-back remount does not actually reset the form state (verify with a fresh tree/screenshot that the fields are cleared) or the case requires a fresh app process.

### 5.30 Reuse verified-unchanged prior-run evidence instead of re-driving (Phase 13.37)

When a task explicitly permits it, and the relevant source files/screens are confirmed unchanged since a prior run on the same build, cite that prior run's evidence for the case instead of re-driving it live. "Confirmed unchanged" must be verified — via `git show` / file mtimes covering the intervening commits, not assumed. Always record this explicitly as "cross-referenced from run X, verified unchanged" in the report — never silently treat it as freshly executed, and never skip verifying it's actually unchanged first. (Reference: Group D D02 was legitimately cross-referenced from the Group P P17 run on the same build, after verifying via `git show` that Profile/Settings sources were unchanged — the report must state the cross-reference honestly.)

### 5.31 Known-undrivable-native-modal list — HARD RULE: drivability is build-dependent, re-check empirically per run (Phase 13.38; elevated Phase 13.41)

Three separate runs hit the same wall: a native full-screen modal (`CategorySelectModal`, the Sell/bulk-upload sheet, and `expo-image-picker`'s crop/confirm editor) that was not in the accessibility tree and rejected synthesized taps and swipes. Maintain a standing list in memory of screens/flows that HAVE triggered this pattern (any `presentationStyle="fullScreen"` native picker, system camera/photo UI, OS-level crop/confirm dialogs), with each entry recording the **date/build it was last confirmed** — drivability is NOT a permanent property of a modal.

**HARD RULE (Phase 13.41 — elevated): native modal/window drivability must be re-checked per build, never assumed from memory.** A native `expo-image-picker` crop/confirm window documented as universally undrivable on 2026-08-23 (Group H) was found to be fully AX-drivable on 2026-08-24 (Account file Groups A–D run) — a direct reversal on a different build. Drivability of native modals/windows can change between builds and must never be treated as a permanent fact carried forward from a prior session's known-undrivable list. Always attempt the first native interaction empirically at the start of a session; only fall back to the documented workaround (pixel-scan, dev fixture, etc.) after an empirical miss on the current build. When a previously-undrivable control IS drivable this build, record the reversal as evidence and update the list entry's confirmed date/build.

Before executing a case that touches one of these surfaces, check the list first: if the target screen was confirmed undrivable on THIS build, do not spend bounded-attempt cycles rediscovering that fact — go straight to recommending/using a `__DEV__` fixture bypass if one exists, or if none exists, note the gap and pivot immediately (still bounded to 1–2 confirmation attempts to verify the specific instance behaves the same way, not the full 5+ attempts used when discovering the pattern for the first time). Known instances with last-confirmed state so far: `CategorySelectModal` on ItemCreate (Phase 22/23), the Sell/bulk-upload sheet, and `expo-image-picker`'s `allowsEditing` crop/confirm window — **undrivable 2026-08-23 (Group H); drivable 2026-08-24 (Account file Groups A–D)**.

### 5.32 Maintain a reset-cost table and always pick the cheapest option (Phase 13.38)

Maintain and consult an approximate cost table for common reset/recovery operations (e.g., fresh signup ≈ 45–60s, full app relaunch ≈ 10–15s, field-clear via long-press/Select-All ≈ 5–10s, keyboard suppression re-apply ≈ 3–5s) and always choose the cheapest operation that satisfies what the current case actually needs, rather than defaulting to the most familiar or most thorough reset (e.g., relaunching when a field-clear would do, or a fresh signup when reusing an existing throwaway account would do). This complements §5.10 (field clearing before relaunch), §5.26 (persona batching), §5.28 (form-baseline batching), and §5.29 (lightweight in-app reset) — those rules are the *techniques*, this rule is the *selection criterion* that ranks them by cost for the current case.

### 5.33 Repurpose incidental state instead of discarding it (Phase 13.38)

When a recovery action (e.g., a relaunch to escape a stuck screen) or an unplanned event lands the app in a state that wasn't the original goal, check whether that resulting state satisfies an upcoming or related case before treating it as wasted and starting over from scratch. Explicitly note in the report when a case's setup was opportunistically reused from a prior recovery action rather than deliberately driven, so this is traceable. (Reference: Group H — the terminate+relaunch escape from the stuck native crop editor landed on the onboarding carousel, which was exactly the state H06a needed, saving a full signup cycle.)

### 5.34 Pre-read DB schema before the first query against an unfamiliar table this session (Phase 13.38)

Before writing a read-only SQL query against a table not yet queried this session, pull its column list first (e.g., a quick `information_schema.columns` check or equivalent) rather than guessing column names from memory or convention — avoids a query-error-and-retry cycle (e.g., a 42703 from guessing `p.display_name` when the actual column is `p.name`). This applies to any query this session touches, not just persona/profile tables, and complements the §4 DB-precondition and §5.15 stale-observation pre-reads — those verify *state*; this verifies *schema* before the first query. **If a query still fails on a column name, inspect the actual schema before retrying — never guess a second column name; allow at most one retry per schema surprise (Phase 13.43 / TRD Group A/B, 2026-08-28):** both schema surprises this run (`display_name`→`name`, `item_id`→`listing_id`) were corrected on a single re-query by reading `information_schema` first, never a cascade of guesses (see §5.38 R7).

### 5.35 Cross-table persistence checks for mirrored data (Phase 13.41)

When a data field is mirrored across multiple tables/sources (e.g., `auth.users.phone` and `profiles.phone`), a persistence assertion must check consistency across ALL of them, not just the one table the UI's optimistic patch directly touches. A UI-only or single-table DB check can "pass" while a real cross-table divergence exists — confirmed 2026-08-24 (Account file Groups A–D run): after phone verification, `auth.users.phone` updated correctly while `profiles.phone`/`phone_verified_at` silently did not, and only checking both surfaced the defect (a MOD-HIGH finding). Before closing any persistence assertion involving fields known or suspected to be mirrored, identify all tables/sources that should reflect the change and verify each one — this extends the §5.11/§5.12 DB-over-UI discipline to the full set of mirrored targets, not just the row the UI patch writes.

### 5.36 QA-fixture item collision on shared staging — avoid items another run is actively using (Stripe idempotency)

When live-testing Stripe against shared staging (PaymentSheet, `trade-payment`/`trade-extension` flows, etc.), do NOT pick a QA-fixture item (listing) that another QA run or the automated suite is concurrently exercising. Payment calls carry **deterministic idempotency keys** (e.g. keyed by trade/offer IDs), so two concurrent runs submitting against the same fixture item can collide on the same key / Stripe object — producing false failures (e.g. "amounts differ", "already exists", unexpected `payment_intent` state) that are entirely unrelated to the code under test. Confirmed 2026-08-27 during the trade-payment/trade-extension live-verification session.

Rules:
1. Before a live-Stripe case, confirm the fixture item/offer is not currently in use by another run (coordinate with the team / check the suite's seed state), or pick a dedicated, freshly-seeded fixture.
2. Prefer fixtures seeded specifically for this run over shared "known-good" items that other cases also use.
3. If an idempotency-key collision is suspected (deterministic key + concurrent runs + a Stripe-side error on a call that works in isolation), record it as an environment/collision artifact and re-verify the case in isolation — do not report it as an app defect.

### 5.37 Side-effect verification is MANDATORY — verify backend/DB/third-party state directly, not just the UI response (Dev Task 12 — auto-approved)

Any QA test case that exercises a UI action with a backend, database, or third-party (Stripe/PayPal) side effect MUST verify that side effect directly — read the relevant database row(s) and/or the actual Stripe/PayPal object state — not just assert on the UI response or a smoke-level guard-path check. This is a standing, mandatory rule, and this class of read-only verification is **pre-approved** (no manual owner approval per instance). It extends the §5.11 / §5.12 / §5.35 DB-over-UI discipline to the actual side-effect target, and is the QA-facing generalization of BP-71 / BP-72.

**Why (DT-11 lesson):** checking only the UI-facing response (or a guard-path smoke) misses real bugs. DT-11 found two genuine production bugs only by exercising the ACTUAL charge/pay path and confirming DB + Stripe state, not the guard/error-response path:
- `renew-subscription` returned `INVALID_STATUS` on the shared active test-buyer (smoke "passed") yet its real renewal path was permanently blocked by the constant `sub_<row_id>` idempotency key — a renewal that would silently drop a user's subscription.
- `retry-failed-payment` returned `NO_FAILED_PAYMENT` (smoke "passed") yet could never pay an open invoice because it sent `paid_out_of_band: false` — a payment-retry button that could never succeed.

Rules:
1. **Side-effect verification is mandatory.** For any UI action with a backend/DB/third-party side effect, after the action completes (or fails), read the relevant DB rows and/or the Stripe/PayPal object state and confirm the side effect actually happened (or didn't, when a failure was expected) — never rely on the UI response alone.
2. **Real-activation verification is required, not just guard-path smoke checks**, whenever the function's main purpose is to move money or mutate financial state (subscriptions, payments, refunds, payouts). A guard-path probe (`INVALID_STATUS` / `NO_FAILED_PAYMENT` / `NO_OPEN_INVOICE` / `SUBSCRIPTION_NOT_ACTIVATED`) that returns the expected error does NOT prove the real path works — drive the actual charge/pay path on a fresh, isolated throwaway user (own Stripe customer + own payment method) and confirm the resulting object/row state (BP-71 / BP-72).
3. **This class of backend/DB/Stripe read-only verification is pre-approved** — read-only confirmation of DB rows and Stripe/PayPal object state does not require manual owner approval per instance (consistent with §5.14's "read-only SQL stays permitted" discipline). **Mutating test actions are NOT covered:** creating/cancelling real test trades, subscriptions, or refunds still follows the existing safe-fixture/disposable-user discipline — throwaway users where money movement is involved (see §7 personas, BP-70 cleanup, §5.36 fixture collision).
4. **Worked example (DT-11 pattern):** create a disposable/throwaway user (isolated from test-buyer/test-seller) → exercise the REAL path (not just the guard) → confirm BOTH the third-party (Stripe) object state AND the corresponding database row → then clean up the throwaway user (BP-70: delete child rows, `profiles` by `user_id`, then `admin.deleteUser`).
5. **Worked example (TRD Group A/B, 2026-08-28 — A02):** the UI showed "You saved $8.00 using SP! You have 38 SP left" on trade completion while the DB proved the SP-settlement trigger was missing (`final_sp_amount=0`, `seller_sp_earned=0`, `sp_released_at` NULL, 8 SP stuck reserved, no `sp_ledger` rows) — a P1 found only because the money state was read back from the DB (see §5.38 R11). A UI success screen is evidence the request completed, never evidence the financial state persisted.

### 5.38 Standing rules — TRD Group A/B run (2026-08-28) — consolidated playbook updates (R1–R16)

This subsection consolidates the 16 standing rules derived from the TRD Group A/B execution run — evidence source: `e2e-test-results/qa-trd-group-a-b-2026-08-28/decision-outcome-log.md` (667 tool executions; 9 PASS · 2 FAIL · 4 BLOCKED · 5 SKIPPED; P1 SP-settlement + P1/P2 Stripe idempotency findings). Where a rule restates an existing §5.x section, the earlier section remains canonical and this entry only adds the new evidence or the correction; where a rule corrects an earlier assumption, the earlier section has been updated in place (marked "Phase 13.43").

**R1 — Native modals are invisible to the accessibility tree — go straight to pixel-scan.** Any native alert/bottom-sheet (`Accept`/`Decline`/`Cancel` confirmations, the cancellation-reason sheet) returns an empty or near-empty element tree. Do not attempt to re-list or search the tree for these — immediately fall back to OCR/pixel-scan (§5.4). Know the app's palette so the first scan is correct: primary/confirm green `#5DBB8E`, destructive/danger red `#ff6b6b`, disabled pink `#ffb3b3` (plus the disabled-gray `#E8E8E8`). If a button's color/state is ambiguous, read the component source directly (e.g. `CancellationReasonModal.tsx`) rather than guessing — this run wrongly assumed a confirm button was green when it was red, costing extra scans. *Evidence: B04 (P6) cancel-reason sheet; A01/A02 (P3/P4) seller-accept OK.*

**R2 — Never tap by coordinate while the keyboard is up.** Reaffirms the existing §5.2 / §5.19 Rule 1 hard gate: send the keyboard-hide keystroke (`Cmd+K`) before ANY coordinate-based tap following text entry, then re-list for fresh coordinates. This run's ~60 `Cmd+K` calls are the cost of the gate; a device-level dismiss-keyboard affordance is the instrumentation fix (log §7 item 5). *Evidence: every phase (P2.1, P3.1, P4.4–4.5…).*

**R3 — Use select-all-and-retype (`Cmd+A`) for clearing text fields, not long-press.** Long-press "Select All" does not work reliably in this app (failed twice on the SP numeric field). Go directly to the select-all keystroke (`Cmd+A`) + retype — don't waste calls retrying long-press first. Updates §5.10 / §5.13: long-press → Select All remains the *first attempt only where proven for that field type this build*; `Cmd+A` is the reliable default. *Evidence: P4.5 SP-field clearing (F6).*

**R4 — After any LogBox/Console-Error overlay appears, terminate and relaunch immediately.** Don't attempt to dismiss the scrim or tap through it (the §5.19 Phase-13.42 full-screen-scrim finding means taps are eaten everywhere). The app session persists across a relaunch, so this is faster and more reliable than fighting the overlay — especially for *stale replays* of a previously-seen error. Strengthens §5.19 Rule 6: bounded-dismiss attempts apply to a first-time overlay; a recognized stale replay skips dismissal entirely. *Evidence: P2.9–2.10 (A01 Accept blocked by replayed idempotency error), P7.5 (freed-slot offer blocked by replayed cap error) — F1/F5.*

**R5 — Screenshot/view-image tools return a URI, not readable pixels.** Never attempt to "view" a screenshot directly for verification (`view_image` returned only a resource URI — 3 wasted calls, log §3). Route all visual checks through the OCR/pixel-scan `qa:*` helpers (§5.23) from the start. *Evidence: §3 tool inventory.*

**R6 — Search for deep-link routes during initial recon, not mid-run.** Deep links (`p2pkidsmarketplace://listing/<id>` → ItemDetail, `p2pkidsmarketplace://qa-logout`) are the standard way to reach fixtures that aren't reachable through normal in-app navigation (off-node/NULL-node items, persona switches). Find and note them in the first pass before starting case execution. Extends §5.16 (logout deep link) to all deep links. *Evidence: P1.3 (deep-link map found in recon) — the run's standard navigation tool.*

**R7 — Schema-first on any SQL column error.** If a query fails on a column name, inspect the actual schema before retrying — never guess a second column name. One retry per schema surprise, not a cascade. Reaffirms §5.34. *Evidence: P1.2 (`display_name`→`name`, `item_id`→`listing_id`), one retry each.*

**R8 — Trust the master tracker over inline guide annotations.** Any "passed"/informal annotation inside a canonical test-guide file that isn't reflected in the master coverage tracker (`TEST-COVERAGE-INVENTORY.md`) must be treated as unverified and re-run fresh. Confirm the tracker's actual state before trusting any in-document shortcut. *Evidence: P0.2 — all 20 cases were NEVER RUN despite inline annotations.*

**R9 — Batch DB verification instead of verifying after every single action.** When multiple similar actions are queued (e.g., filling multiple pending offers toward a cap), perform all the actions first, then verify the resulting state with one SQL query, rather than round-tripping to the DB after each individual action. Complements §5.27 (that rule covers a single simultaneous-evidence assertion; this covers a batch of actions). *Evidence: P7.1 — 3 offers submitted, verified in one query.*

**R10 — Check for reusable existing fixtures/state before building new state.** Before creating new test data for a case, check whether existing data already satisfies the precondition (e.g., an existing conversation on an already-cancelled trade). This run closed one case almost for free this way. Extends §5.33 (repurpose incidental state) to deliberate pre-checking. *Evidence: P9 — B08 reused the existing conversation on cancelled `c3d0146f`.*

**R11 — Always verify money/SP state via the database, never trust the UI success message alone.** A UI success screen proves the request completed, not that the backend correctly persisted the financial/points state. Every case with a financial or SP side effect must close the loop with a direct DB check before recording PASS. This is the QA-side confirmation of §5.37 (side-effect verification; read-only DB/Stripe checks pre-approved) — not a separate requirement. *Evidence: P4.8–4.10 — A02 UI said "You saved $8 / 38 SP" while the DB proved SP settlement was broken (P1).*

**R12 — Confirm root causes by reading actual source before recording a finding.** Every credible finding this run (idempotency-key construction, missing trigger, dead code, SP-only counter logic) was confirmed by reading the actual Edge Function, migration, trigger definition, or screen component — not inferred from a single observed symptom. Do this before writing up any bug finding. Complements §5.15 (stale-observation check), §5.25 (source-proven-impossible paths), §6.1 (two-source corroboration). *Evidence: P2.6 (idempotency key), P4.10 (missing trigger), P5.6 (dead code), P7.7 (SP-only counter).*

**R13 — Every BLOCKED/SKIPPED verdict must carry an explicit, evidence-backed reason.** Categorize precisely: missing fixture (B05e — `test-seller-3` does not exist), admin-portal-scope (B05f/g/h — until the Task 20b standing rule closes this category; consistent with §2 admin-out-of-scope), platform-level validation prevents the scenario (B06 — historically BLOCKED because Stripe PaymentSheet rejects declining cards at entry — **now testable via the Dev Task 25 `card_decline` session-local QA toggle: arm `p2pkidsmarketplace://qa-dev-toggle?key=card_decline&value=hold_decline`, submit a normal valid card, and the hold-creation step returns STRIPE_HOLD_FAILED**), config-fetch-failure (B05i — **now testable via the Dev Task 25 `config_fetch_failure` toggle: arm `p2pkidsmarketplace://qa-dev-toggle?key=config_fetch_failure&value=fetch_failure` to reproduce the "Offer limit configuration is unavailable" rejection without a shared-staging admin_config mutation**), etc. Never leave an ambiguous or unexplained skip. *Evidence: P10 — 4 BLOCKED / 5 SKIPPED, each with an explicit reason.*

**R14 — For timer/expiry-dependent cases, use the documented fast-clock approach, and diagnose a "0 processed" result as a likely race condition before concluding failure.** Use the approved fast-clock (`UPDATE trades SET offer_expires_at = now() + interval '5 seconds'` + `rpc_process_expired_offers`) instead of waiting out a 48h expiry. When the first RPC returns `expired_offers_processed: 0`, re-check after a brief pause rather than immediately recording a failure on the first zero-result poll. *Evidence: P7.4 (B05d) — first run returned 0 (raced the 5s), rerun processed 1.*

**R15 — Avoid re-offering on a listing where the same buyer has a prior trade, until the idempotency-key fix (Task 18) lands.** Deterministic idempotency keys (`pi_offer_<buyer>_<item>_<hash(params)>`) collide when a buyer re-offers on a listing with params identical to a prior trade → Stripe 409. Prefer fresh listings with no prior buyer history for each new offer-submission test case, to avoid hitting the known collision and wasting a cycle on an already-understood bug. Distinct from §5.36 (which covers *concurrent* runs colliding on the same fixture); this rule covers *historical* prior trades on the same listing. *Evidence: P2.5–2.8 (A01 on `83c8823b` — the #1 bottleneck, F1).*

**R16 — Maintain a running friction/facts list in session memory throughout a run, not just at the end.** Capture discovered environment quirks (keyboard technique, native-modal colors, the `Cmd+A` trick, screenshot-tool limitation, seller-fee flag) as they're found, so later phases in the same run — and future sessions — start from known facts instead of rediscovering them. Formalizes §9's running list as a session-memory artifact written continuously during the run. *Evidence: P11.2 (session-memory update) — pattern P10.*

## 6. Judgment — three distinct layers, ALL required

### 6.1 Hard assertion

Evaluate the case's `Assert:` conditions (or `Expected Result:` for non-instrumented cases) → verdict:
- **PASS** — all assertions met with evidence.
- **FAIL** — one or more assertions not met.
- **BLOCKED** — could not reach the case state (environment, seed, app crash, prerequisite missing).
- **SKIPPED** — deliberately not run (out of scope, dependency unavailable, non-repeatable), with the reason stated.

Each verdict needs evidence: trace lines, screenshots, and the specific assertion that passed/failed.

**Two-source corroboration for occluded or otherwise unobservable UI elements (Phase 23):** When a UI element cannot be directly observed (e.g., occluded by another element, off-screen with no further scroll available), do not report it as simply unverified if better evidence is available — corroborate via the underlying source condition logic (does the code say it should render here?) AND the actual data path (does the relevant query/RPC return the value the render condition depends on?). Two independent sources of evidence in agreement is stronger than a single visual observation, and this avoids both false-PASS and false-FAIL when direct observation isn't possible.

**Bounded attempts on a single interaction type, then pivot (Phase 25):** If a specific interaction (e.g., a toggle/switch) fails to produce any state change after 2–3 attempts at independently-derived coordinates, stop attempting that interaction and pivot to source-code + unit-test corroboration (or report the case as partial/blocked with that evidence) rather than continuing to try new coordinate guesses. Note the blocked interaction explicitly so later cases on the same screen don't re-attempt it from scratch.

### 6.2 UX review — structural / affordance (required)

Evaluate from screenshots + interaction, not just "it works":
- Navigation clarity — can the reader tell where they are and how to get back (back/close affordances)?
- Loading feedback — async operations show a spinner/progress rather than a frozen screen or silent stall.
- Visual layout issues visible in screenshots — overlap, truncation, off-screen content, unreadable contrast.
- Tap-target sizing — interactive targets are reasonably large and not easily mis-tapped.

### 6.3 UX review — wording / copy clarity (required, NOT optional)

This app is a **kids' marketplace used by parents/guardians**. Assess whether the actual on-screen copy is genuinely understandable to that audience — not just technically present:
- Labels, error messages, empty states, instructions, legal/consent language — are they plain, unambiguous, and appropriate?
- Where wording is unclear, ambiguous, or could cause confusion (especially legal/consent or money-related copy), propose a **concrete rewrite** — not just "this feels off". Give the exact replacement wording.
- Flag copy that reads like a developer console or a legal boilerplate dump rather than a friendly, trustworthy service.

### 6.4 UX review — design-system compliance (required, NOT optional)

For **every screen the agent visits** — and, explicitly, **every modal, alert (in-app or native), toast, bottom sheet, and pop-up that appears during a case** — check the actual rendered UI (screenshots + the element tree) against `docx/design-system-passitup.md` (the canonical "Pass It Up" design reference). **Pop-ups/dialogs get the same three-layer review as a full screen** (structural §6.2, wording §6.3, design-system here) — no exceptions for "it's just a small popup."

Concrete popup/modal criteria (drawn from a real Phase 14 miss):
- **Color-token consistency** — does the dialog use the documented palette (primary green `#5DBB8E` / pressed `#4DAA7A`; semantic error `#E85D75`, warning `#FFA726`, info `#5B8FB9`; white `#FFFFFF` modal surface), or does it default to system/OS colors (e.g. an unstyled native-looking blue/gray alert)?
- **Text/element alignment** — is text properly aligned within its container (documented padding, centering, no edge-hugging or truncation/overflow), not merely present?
- Buttons follow the pill-primary / secondary-outline / text conventions; **max one primary per dialog**; touch targets ≥ 44×44px (48/52px buttons); title/subtitle spacing per the documented scale.

For full screens, the same check applies:
- **Colors** — primary action buttons use the documented primary green (`#5DBB8E`; pressed `#4DAA7A`); semantic colors used for the right purpose (error `#E85D75`, warning `#FFA726`, info `#5B8FB9`); SP surfaces use SP gold (`#F59E0B` / `#FEF3C7`); neutral text tiers (`#1A1A1A` / `#6B6B6B` / `#999999`) applied consistently.
- **Typography** — system font, documented type-scale sizes/weights (H1 28 semibold → caption 12), readable hierarchy.
- **Spacing** — the 4px-base scale (`sm` 8, `md` 12, `lg` 16, `xl` 20, `xxl` 24, `xxxl` 32); page horizontal padding 20–24px; documented inter-element spacing (e.g. 16px between form inputs, 8px between title/subtitle on phone verification); touch targets ≥ 44×44px (buttons 48/52px).
- **Component usage** — pill primary buttons (max **one** primary per screen), secondary outline/text variants, **filled** inputs only (no outlined variant), OTP as a single auto-formatted field (not 6 boxes), per §4/§7 of the design doc.
- **Accessibility** — visible focus states, contrast ratios per §6 of the design doc.

Report **specific, concrete deviations** (e.g. "primary CTA renders gray/outlined instead of the documented filled pill `#5DBB8E`", "in-app confirm dialog's Cancel renders as an unstyled OS-blue text button instead of the documented secondary outline pill", "dialog body text hugs the left edge with no documented 20–24px padding", "spacing between form fields is ~8px but the documented value is 16px", "two primary buttons on one screen, violating the max-one-primary rule") — not generic aesthetic opinions. Screenshots are the evidence; the element tree gives visibility/coordinates. If a deviation is a deliberate, documented exception, note it as such. This is the **third** UX layer, alongside §6.2 (structural/affordance) and §6.3 (wording/copy clarity) — **all three are required per case, not optional.**

**Per-screen header/back-button check (MANDATORY on every screen — do NOT sample):** every screen visited gets an explicit back-button/header review, not just primary CTAs and dialogs. The canonical detail header is `ScreenLayout variant="detail"` → `AppHeader` (back left, title centered, bell+chat right). Verify each screen's back control against it:
- Back button: 40×40px round, gray `#F4F4F4` background, centered `CaretLeft` icon — **24px, `#1A1A1A`, weight `regular`, icon-only (NO "Back"/"< Back" text label)**, `hitSlop` ≥8 (effective touch target ≥44×44), `accessibilityRole="button"`, accessibility label "Go back", `testID="back-button"`.
- Title: centered, 17px, weight 700, `#1A1A1A`.
- Right: notification bell + chat (unless intentionally hidden — checkout/payment screens only).
- **A back control that uses the primary green `#5DBB8E`, a non-standard icon size/weight, a visible text label, no gray circle, no hitSlop/accessibility props, or a stacked (non-header-bar) position is a DEVIATION.** (Real miss: EditProfile kept a hand-rolled green "← Back" header while ~60 screens used the canonical header — it survived because TRD-TC-U02/U04 sample only a few screens; check EVERY screen, incl. Profile, Settings, Edit Profile, Help & Support, education Help, SP Wallet, etc.)

**No raw support-email surfaces (MANDATORY):** no screen may show a support email address or "email us at …" copy (form footer, auth gate, alert body, empty/error state). Every support/contact affordance must route to the in-app **Contact Support** form (`ContactSupport` route), which is reachable both logged-in and logged-out (Login/Signup show a "Need help? Contact Support" link). Grep/OCR every visited screen for `support@`, `admin-support@`, `mailto:`, or "email us" — any visible instance is a **DEVIATION** (report the file/line). The only email input allowed is the Contact Support form's logged-out "Your email (so we can reply)" field.

## 7. Test personas / standing accounts (check BEFORE creating an account)

Before creating a throwaway account for a case, check the maintained registry of standing staging personas at **`/memories/repo/qa-test-accounts.md`**. It is structured like the AUTH guide's "Accounts for testing" table and maps each persona to its seeded account (role/tier, email, node/ZIP, subscription status, phone-verified state, password handling) plus the safe provisioning mechanism.

- **Reuse an existing persona** wherever the case's `Setup:` calls for one (e.g. log in as `test-buyer` rather than signing up a fresh buyer).
- The **only** persona the agent creates itself is `new-user` (a fresh email via the normal UI signup flow, per the case).
- If the needed persona does not exist and **cannot be safely provisioned within an execution-only run** (needs pre-existing state beyond a simple UI signup flow — e.g. a seeded subscriber, phone-verified seller, or admin), report it as a **setup gap** (BLOCKED with reason) rather than attempting unsafe provisioning.
- **No raw SQL account creation, no service-role writes** — same discipline as the repo's Supabase safety rules. Standing-account provisioning is a dev-team task via the documented seed mechanism (`npm run seed:staging` from `p2p-kids-marketplace/`), never the agent.

## 8. Report format

### 8.1 Per case

1. **Execution trace** — every tool call, in order (device, element tree, tap, type, screenshot, relaunch, …) **plus the perceived load time for each transition (see §5.7)**.
2. **Screenshots captured** — paths + one-line description of each.
3. **Assert result** — PASS / FAIL / BLOCKED / SKIPPED, with the specific evidence.
4. **UX notes** — three clearly separated subsections:
   - *Structural / affordance*: findings + severity.
   - *Wording / copy clarity*: findings + concrete rewrite proposals.
   - *Design-system compliance*: deviations vs. `docx/design-system-passitup.md` (see §6.4) across **every screen AND every modal/alert/toast/pop-up visited** — or "No deviations found" on screens checked.
5. **Locator-gap findings** — any target not exposed as a distinct element (flagged, not silently worked around), the fallback used, and the recommended instrumentation fix.
6. **Friction vs. the operating rules** — anything that cost time or deviated from §5 (stale coordinates, keyboard issues, WebView tree bloat, polling timeouts, etc.).
7. **QA Session Handoff** — close the per-case report with the §8.3 block, scoped to this single case (`Verdict Summary` = this case's counts; `Design-System Compliance` = this case's screen findings or "No deviations found"). Also emit the full block verbatim in the final chat reply, per §8.4.

### 8.2 Batch summary (when multiple cases run)

- Table: TC-ID | Guide | Verdict | Top finding.
- Roll-up: totals (PASS / FAIL / BLOCKED / SKIPPED).
- **Perceived load-time table** — screen → transition → elapsed time (each measurement labeled per §5.7), with **≥3s entries flagged** so slow screens are visible at a glance.
- Cross-cutting UX findings (recurring copy/layout issues across cases).
- Cross-cutting design-system compliance findings (recurring deviations vs. `docx/design-system-passitup.md` across screens — see §6.4).
- Recommended follow-ups (locator gaps, copy rewrites, instrumentation) — as separate tasks, never applied in-run.
- **QA Session Handoff** — close the batch summary with the §8.3 block, scoped to the whole batch (`Verdict Summary` = the roll-up; `Design-System Compliance` = the aggregate deviation list or "No deviations found"). Also emit the full block verbatim in the final chat reply, per §8.4.

### 8.3 QA Session Handoff (required — per case AND per batch)

Adapted from the dev agent's end-of-session handoff template, adjusted for a read-only test-execution agent: "Change Classification", "Backward Compatibility", and "Regression Plan" don't apply (this agent changes no code), so they are replaced with "Design-System Compliance", "Verdict Summary", and "App State Left Behind" — same job (a fast, scannable status check), fitted to what this agent actually produces. Close **every per-case report** and **every batch summary** with this block, filled in accurately:

```
## 📋 QA Session Handoff

**Test Scope:** [TC-ID(s) executed, e.g., "AUTH-TC-S01–S06 (ForgotPassword group)"]
**Design-System Compliance:** [PASS / PARTIAL / FAIL — list specific deviations found against design-system-passitup.md, or "No deviations found"]
**Perceived Load-Time Verdict:** [REQUIRED — never omitted, never left implicit in the load-time table alone. One of exactly two outcomes:
- GOOD — all observed transitions rendered within the ideal UX threshold (<3s).  (use when nothing was flagged)
- FLAGGED — [screen → transition]: Xs (see load-time table), + one-line note distinguishing an app-behavior issue from an environment artifact (e.g., dev-build cold-start bundle load) if applicable (per §5.7)]
**Design & Copy Compliance Confirmation:** [REQUIRED — separate from the Design-System Compliance summary above. One explicit verdict PER meaningfully distinct thing reviewed (every screen + every modal/alert/toast/pop-up per §6.4), never a single blended sentence. List every distinct screen/dialog visited in the run, not just the first violation:
- CONFIRMED — [screen/dialog name]: wording and layout match design-system requirements.  (each compliant item)
- DEVIATION — [screen/dialog name]: [exact issue, e.g., "two primary CTAs visible simultaneously" or "alert uses default system color, not #5DBB8E"].  (each non-compliant item)]
**Verdict Summary:** [X PASS / Y FAIL / Z BLOCKED / W SKIPPED]
**Critical Findings:** [ranked list of the most important issues found — bugs, locator gaps, UX/wording problems — ordered by severity, this is the section to read first]
**App State Left Behind:** [account/session state, test data created, anything needing cleanup]
**Why It Matters:** [plain English — what this run proves or what risk it surfaces]
**How to Verify/Reproduce:** [where screenshots/evidence live, exact steps to re-check any finding]
**Known Gaps / Not Tested:** [anything blocked or skipped, and why — untested conditions only]
**What Needs To Be Fixed Next:** [REQUIRED — ranked, actionable DEV-SIDE fixes, distinct from Known Gaps / Not Tested (untested conditions) and from Suggested Next Session (the next QA batch). Each fix is a concrete, scoped action (e.g., "Fix: two primary CTAs on ResetPassword when Link Error card is visible — demote the error-card button to secondary-outline or hide the submit button", not "consider resolving the CTA issue"). If nothing to fix, state explicitly: None — all reachable behavior in this batch is correct.]
**UX Enhancement Ideas (optional, not defects):** [OPTIONAL — forward-looking UX ideas ONLY, deliberately separate from What Needs To Be Fixed Next (which is for defects/deviations against existing requirements — design-system violations, broken behavior, doc drift). This field is for ideas that go BEYOND current requirements: things that would make the experience better even though nothing is technically wrong. Rules: (1) grounded only in what was actually observed this run — every idea must reference a specific screen, flow, or friction point actually encountered while executing test cases, never a generic or invented suggestion ("consider dark mode" is out); (2) explicitly optional and non-blocking — never phrase as "must fix"; use "consider", "opportunity", or similar framing; (3) one idea per line, each stating the observed friction/context and the suggested direction, e.g., "On the [screen], [specific observed behavior/friction] — consider [specific suggested change] to reduce [specific user cost, e.g., taps, confusion, time]". If nothing notable surfaced this run, state explicitly: None this run — no friction or enhancement opportunities observed beyond what's already noted above.]
**Suggested Next Session:** [the single most logical next batch or fix]
**Suggested to Improve Agent Rules:** [the single most useful refinement to this agent's own playbook based on what happened this run — say "none" if there isn't one]
```

Scope adaptation: per-case → `Test Scope` = the single case, `Verdict Summary` = that case's counts, `Design-System Compliance` = that case's screen findings, `Perceived Load-Time Verdict` = that case's transitions only, `Design & Copy Compliance Confirmation` = that case's screens/dialogs only; batch → `Test Scope` = the whole batch, `Verdict Summary` = the roll-up, `Design-System Compliance` = the aggregate across all screens visited, `Perceived Load-Time Verdict` = drawn from the batch load-time table (§8.2), `Design & Copy Compliance Confirmation` = one line per distinct screen/dialog visited across the batch. `App State Left Behind` always records any account/session state or seeded data the run created or left — cleanup info for the next session.

### 8.4 QA Session Handoff is ALWAYS emitted in the agent's final chat-visible reply (never file-only)

The full §8.3 handoff block — **every field**, including the fields added above (`Perceived Load-Time Verdict`, `Design & Copy Compliance Confirmation`, `What Needs To Be Fixed Next`, `UX Enhancement Ideas (optional, not defects)`) — is **never file-only**. It must be included **verbatim as part of the agent's final conversational reply** for **every** run (per-case §8.1 AND per-batch §8.2), **in addition to** (not instead of) being written into `report.md`:

- The detailed per-case execution traces, screenshots, and full batch tables may remain in the report file only.
- The handoff itself — every field from §8.3 — must surface directly in the chat response every time. A run is not complete until the complete §8.3 block appears in the agent's final chat message.

## 9. Friction & follow-ups

- Keep a running list of anything that fights the operating rules (e.g. a control whose identifier never surfaces, a screen that needs extra polling). These are the highest-value signal for the next instrumentation pass.
- **Maintain the list in session memory throughout the run (Phase 13.43 / TRD Group A/B, 2026-08-28):** write each discovered environment quirk to session memory as it is found — keyboard technique, native-modal palette, the `Cmd+A` select-all trick, screenshot-tool limitation (URI-only), deep-link routes, doc-drift flags, config values — not just at the end. This ensures later phases in the same run and future sessions start from known facts rather than rediscovering them (see §5.38 R16).
- Never resolve a friction by editing code. Recommend the fix; the dev agent (`Kids P2P App Builder`) applies it in a separate task.
