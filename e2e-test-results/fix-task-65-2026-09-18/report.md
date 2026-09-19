# FIX-Task-65 — NotificationSetup compliance + ID Verification polish + UX (owner-approved combined)

**Date:** 2026-09-18 · **Source:** MSG Round 1 (`e2e-test-results/qa-msg-round1-2026-09-18/report.md`)
**Verdict: all 11 dispatched items + all 7 owner-approved extras are IMPLEMENTED and verified.** Tier 0 green; the full Jest suite is **0 failures** (better than the baseline, which had 1 environment-dependent failure); the four push-permission error copies were driven **on-device (4/4, not just the 2 required)** via a new dev-only QA toggle; and the pixel-level palette check that found the violation now reads the exact inverse.

Two deliberate, documented departures from the dispatch's literal wording are recorded in §6.

---

## 1 · Item-by-item deliverable status

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | NotificationSetup off-brand palette → tokens | ✅ DONE | §3.1 — canonical fill **92.39%** vs off-brand **0.26%** (was 0.01% vs 92.25%); **0 raw hexes** left in the file |
| 2 | Primary CTA below min touch target | ✅ DONE | §3.2 — design-system pill, **408×52 pt**, paint **93.17% `#5DBB8E`**, **0.00%** Material green |
| 3 | Misleading push-permission copy | ✅ DONE | §3.3 — discriminated reason + 4 cause-specific strings, **4/4 driven on-device** |
| 4 | Missing locators | ✅ DONE | §3.4 — **6 new `testID`s**; every tap in §3 was **by locator**, never by tree coordinates |
| 5 | ID Verification 3 off-token hexes | ✅ DONE | §3.5 — `#EF4444`→`error[700]`, `#B45309`→`warning[800]`, `#F3F4F6`→`neutral[200]` |
| 6 | Android channel colour | ✅ DONE | §4.2 — unit-asserted `lightColor === colors.primary[500]` (`#5DBB8E`) |
| 7 | MSG guide doc-drift | ✅ DONE | §5 — guide + tracker corrected (see §6 for the file-location correction) |
| 8 | "Open Settings" on permission denial | ✅ DONE | §3.6 — rendered **only** for `permission_denied`; tapping it put the **iOS Settings app in the foreground** |
| 9 | Tighten NotificationSetup spacing | ✅ DONE | §3.7 — Privacy box moved from the bottom of a mostly-empty screen to directly above the CTA |
| 10 | Library fallback beside "Use Camera" | ✅ DONE | §3.8 — both controls on one row, **137×48** and **190×44** |
| 11 | More actionable ID error copy | ✅ DONE | §3.8 — driven on-device |
| (G05) | `safety` category + producer | ⏸️ NOT IN SCOPE | Correctly left as a product decision; recorded in the guide + tracker, not silently fixed (§5) |

## 2 · What changed

| File | Change |
|---|---|
| `p2p-kids-marketplace/src/theme/colors.ts` | NEW `error[700] = #C91D39` (AA-safe error **text**); `borderColors.divider` → `neutral[200]` (`#E0E0E0`, canonical doc §1) |
| `p2p-kids-marketplace/src/components/NotificationSetup.tsx` | Palette → 0 raw hexes; RN `<Button>` → design-system `Button` (primary/secondary, `large` 52pt); 6 new locators; `PUSH_FAILURE_COPY` + `getPushFailureCopy()`; `handleOpenSettings()`; `route.params.isOptional` + `goBack` completion fallback; Privacy box anchored to the CTA |
| `p2p-kids-marketplace/src/services/notifications.ts` | `registerForPushNotifications()` now returns `{ ok:true, token } \| { ok:false, reason }` (`expo_go \| not_device \| permission_denied \| token_error`); QA-override short-circuit; Android `lightColor` → `colors.primary[500]` |
| `p2p-kids-marketplace/src/services/devTestingService.ts` | NEW session-local QA toggle `qa_local_push_registration_reason` (+ getter, deep-link registry, allowed values, clear-on-logout, default export) |
| `p2p-kids-marketplace/src/screens/profile/IDVerificationUploadScreen.tsx` | 3 hexes → tokens; "Use Camera" + library fallback share one row; actionable error copy on both pick paths |
| `p2p-kids-marketplace/src/components/__tests__/NotificationSetup.test.tsx` | **NEW** — 15 tests (CTA structure/locators, 4 cause copies, Open Settings gating, optional variant, success path) |
| `p2p-kids-marketplace/src/services/__tests__/notifications.test.ts` | **NEW** — 17 tests (4 reasons + success shape, override short-circuit, Android vs iOS channel) |
| `p2p-kids-marketplace/src/services/__tests__/devTestingService.test.ts` | +6 tests for the new toggle (incl. TTL + clear-on-logout) and the strict short-name registry assertion |
| `p2p-kids-marketplace/src/components/__tests__/QaDevToggleDeepLinkHandler.test.tsx` | +2 tests — arm the new toggle through the real deep-link path, and reject a bad value |
| `p2p-kids-marketplace/src/screens/profile/__tests__/IDVerificationUploadScreen.test.tsx` | +4 tests (library fallback, both error strings, `error[700]` wiring) |
| `docx/design-system-passitup.md` | §1 "Error — Text on Light Surfaces" (`error[700]`); §6 enhancement #1 marked IMPLEMENTED, Item Detail carve-out marked LEGACY, enhancement #2 restated as still open; v1.3 changelog row |
| `cross-checked-and-consolidated/MESSAGING-…-MANUAL-TESTING.md` | "Recall Alert" → "Safety Alerts" (+ the unproducible-notification note); D01 disclaimer copy; D02 inline-error expectation + `GlobalAlertProvider` Dependencies note; lowercase terminology aligned |
| `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` | F04/F07 Android verdict normalised to the parser-recognised shape + derived cell filled; D02 label attribution closed; D01/D02/I01/I02 rows record the FIX-Task-65 changes |
| `docs/agent-memory/qa-test-accounts.md` | New toggle documented with arming commands, locators and the R24 side-effect check |
| `docs/flow-registry.md` | FLOW-17 + FLOW-21 sections updated **in place** (failure-cause behaviour, `?isOptional=1`, new QA toggle, library fallback) |

**Scope note:** 15 tracked files (5 source, 5 test-related, 5 docs) + 3 new paths. That exceeds the 3-file guideline because the dispatch itself is an 11-item combined task; the file list was enumerated and approved in the plan before any edit. `git status` also shows **pre-existing** modifications from earlier sessions (`.github/instructions/QA-Test-Agent.instructions.md`, `docs/LOCAL-DEV-ENVIRONMENT.md`, `docs/agent-memory/rule-changelog.md`, `p2p-kids-marketplace/metro.config.js`, the `p2p-kids-marketplace/scripts/*.sh` dev scripts, `test-automation/trade-flow-v2/scripts/preflight-setup.sh`, and the untracked `patches/@expo+cli+54.0.23.patch`) — **not touched by this task**; no commit was made.

## 3 · On-device verification (simulator `iPhone 17 Pro Max` `3F3293A3…`, persona `test-free`, dev build)

### 3.1 The palette check that found the violation, re-run
Region `60,1221,1200,252` on the full-res error-state frame (1320×2868 = 440×956 @3x), same `qa:badge-scan` method as the round:

| | `#FFEBEE` (off-brand) | `#FFF0F2` (canonical `error[100]`) |
|---|---|---|
| **Before** (MSG Round 1) | **92.25%** | 0.01% |
| **After** (this task) | 0.26% | **92.39%** |

The 0.26% residual sits inside the error banner and is anti-aliasing noise where the `#C91D39` text blends into the `#FFF0F2` fill (the blend passes through the `#FFEBEE` range) — not a fill.

**Exact pixel samples** (`magick … -format "%[pixel:p{x,y}]"`), all byte-exact:

| Element | Sample | Token |
|---|---|---|
| Error banner fill | `srgba(255,240,242,1)` = `#FFF0F2` | `colors.error[100]` |
| Privacy box fill | `srgba(247,247,247,1)` = `#F7F7F7` | `colors.neutral[50]` |
| Primary CTA fill | `srgba(93,187,142,1)` = `#5DBB8E` | `colors.primary[500]` |

Privacy-box fill confirmed independently by `qa:inspect-screen` histogram: **368,570 px** of `#F7F7F7` (89.0% of the region), with no bucket at the old `#F5F5F5`.

### 3.2 CTA (item 2)
AX tree: `notification-enable-button` at **(16,854) size 408×52** — a filled pill, radius = height/2, **≥44 pt**. Region scan of the pill: **`#5DBB8E` 93.17%**, Material `#4CAF50` **0.00%**. White 16px semibold label comes from `theme.typography.button` via the design-system component.

### 3.3 The four causes, driven on-device (item 3)
Armed one at a time with the new QA toggle (each arm showed `[QA] Toggle Applied … (verified read-back: <value>)`), then tapping the CTA by locator:

| Cause | Copy observed on-device |
|---|---|
| `not_device` | `⚠️ Push notifications need a physical device. This is a simulator/emulator.` |
| `expo_go` | `⚠️ Push notifications aren't available in Expo Go. Use a development build.` |
| `permission_denied` | `⚠️ Notifications are turned off for Pass It Up. Enable them in Settings › Notifications.` |
| `token_error` | `⚠️ Could not obtain push notification token. Make sure you granted permissions.` |

Before this change a simulator run showed the `permission_denied` wording for all four. **Disarm proven fail-closed:** after disarming, the same tap on the same build renders the *real* cause (`not_device`) — screenshot `12-…` is byte-identical copy to the post-run frame.

### 3.4 Locators (item 4)
All six new `testID`s surface in the iOS accessibility tree with `Button` role and a label: `notification-enable-button`, `notification-maybe-later-button`, `notification-continue-button`, `notification-error-message`, `notification-error-section`, `notification-open-settings-button`, plus `id-verification-choose-library-btn`. **Every interaction in this section was performed against an element reference resolved from the AX tree — no coordinate was derived from the tree by hand.**

### 3.5 ID Verification hexes (item 5)
`#EF4444` → `colors.error[700]` (3.44:1 → **5.16:1** on the `#FEF2F2` tint), `#B45309` → `colors.warning[800]`, `#F3F4F6` → `colors.neutral[200]`. **The `#F3F4F6` one is in a DEAD style block** (`headerRow`/`headerBackButton`/`headerTitle`/`safeArea` are defined but referenced by nothing — the header renders from `ScreenLayout`); it was tokenized for hygiene and a comment now records that it is dead. Style-level assertion is in the screen's unit test; no pixel claim is made for it.

*Scope disclosure:* other pre-existing literals remain in this file and were **not** in item 5's scope — icon `color` props (`#5DBB8E`, `#F59E0B`, `#6B6B6B`), `backgroundColor: '#FFFFFF'`, and the amber/rejected/status-pill literals. They are byte-identical to canonical tokens but outside the three named hexes; converting them is part of the app-wide sweep recommended in §8.

### 3.6 Open Settings (item 8)
Rendered **only** for `permission_denied` (absent for the other three — asserted in the unit test and observed on-device), and tapping it changed the foreground app to `com.apple.Preferences`. Because it leaves the app, the app was relaunched afterwards.

### 3.7 Layout (item 9)
`contentContainerStyle.flexGrow = 1` + `marginTop: 'auto'` on the Privacy box. Measured on-device: the box now sits at **y698–777** with the CTA at **y854** (~77 pt gap) instead of being separated from the CTA by the leftover viewport (~300 pt). Auto margins collapse when content is taller than the viewport, so short screens still scroll — verified by the optional variant (§3.9), where the content is taller and the box moves up to y634.

### 3.8 ID Verification row + copy (items 10, 11)
AX tree: `id-verification-take-photo-btn` **(50,537) 137×48** and `id-verification-choose-library-btn` **(199,539) 190×44** — same row, both ≥44 pt, library control labelled "Or choose from your library". Tapping **Use Camera** on the simulator (after granting the camera TCC dialog) produced the inline `id-verification-error` with the new string **"Failed to take photo. Please try again, or upload a photo from your library."** and no crash.

### 3.9 Optional variant (approved extra)
`p2pkidsmarketplace://notification-setup?isOptional=1` makes **Maybe Later** render (408×52 pill) — that branch was unreachable dead UI before, because the route passes no props. Tapping it navigated back (the `goBack` fallback works on-device).

## 4 · Test / gate evidence

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc -p tsconfig.json --noEmit` | **PASS** (exit 0, no output) |
| Lint | `npx eslint . --ext .ts,.tsx` | repo-wide: 80 errors / 577 warnings — **all pre-existing**; scoped to the 13 touched files: **0 errors, 10 warnings** (all `no-console`, 9 pre-existing; 1 is the new `console.warn` on the forced-reason branch, matching this file's existing per-branch logging). The 1 style warning introduced during the work was fixed. |
| Full unit suite (before) | `npm test` | 1 failed / 339 passed suites · 1 failed / 3989 passed tests (the failure is `src/__tests__/e2e/referral-analytics-admin.e2e.ts`, an env-dependent e2e suite) |
| Full unit suite (after) | `npm test` | **0 failed / 342 passed suites · 0 failed / 4033 passed tests** — +2 new suites, +44 tests, **no new failures**; the previously-failing env suite passed this run (documented env variance, not a code change) |
| testID drift | `npm run testid-drift-check` | exit 0; none of the new `testID`s appear as missing (the reported MISSING list is pre-existing Maestro drift) |
| Guide drift | `npm run verify:guides` | 3 hard findings — all pre-existing and in other rows (`TRD-TC-S15`, `TRD-TC-T03`, `SUB-TC-F08`); **no FIX-Task-65 row is flagged** |
| New/changed suites (focused) | `npx jest <5 suites>` | **128 passed / 128** |

**Impacted flows:** `FLOW-17` (Notifications) and `FLOW-21` (ID Verification, Badges & Reputation). Both registry sections were edited **in place** in `docs/flow-registry.md` — FLOW-17 gains the push-registration failure-cause behaviour, the optional `?isOptional=1` variant and the new QA toggle; FLOW-21 gains the library-fallback affordance and the actionable capture-error copy. No dated/change-log entries were added to the registry.

**Regression tiers:**
- **Tier 0 — PASS** (see the table above).
- **Tier 1 — NOT SATISFIED, with a named reason (owner decision needed).** There is **no smoke script for FLOW-17** (its Tier 1 equivalent is the manual MSG guide — which is what §3.3/§3.6 drove on-device). The FLOW-21 script (`scripts/smoke/id-badge-verification.mjs`) **requires `SUPABASE_SERVICE_ROLE_KEY`**, which the standing rules forbid me to request, read or supply — so it was **not executed** rather than half-run. Nothing in this task changed a server contract (`services/idBadge.ts` and every Edge Function/RPC are untouched), and the ID-Verification screen was verified on-device in §3.8; nevertheless Tier 1 is **owed** if the keyholder wants the layer-2 assertion.
- **Tier 2 — NOT REQUIRED.** Classification is mobile UI + design tokens + a client-side service contract; **no** DB/migration/RLS/trigger/RPC, Stripe/subscription, SP/fee/money, moderation or admin-config change was made.

`qa:badge-scan`, `qa:inspect-screen` and `magick` were used for the pixel evidence; `xcrun simctl` + the mobile AX tree for the drives.

## 5 · Docs (item 7)

- **Guide** (`cross-checked-and-consolidated/MESSAGING-…MANUAL-TESTING.md`): the 2026-08-12 "Recall Alert" caveat is **resolved** to the shipped name **"Safety Alerts"** *and* now records that the notification limb is **structurally unproducible** (no `safety` enum value, no producer, 0 rows) pending an owner decision — the banner leg is unaffected. D01's disclaimer quote now matches the shipped, config-driven copy. D02 gained the inline-error expectation and a `**Dependencies:**` note mirroring the C02 precedent, stating the dialog renders through the in-app `GlobalAlertProvider` and is **not** a native `Alert.alert`.
- **Tracker**: F04/F07 Android verdicts normalised to the parser-recognised `PASS (Android)` shape and their derived cells filled (no verdict changed — the notes already recorded Android PASSes); the D02 "guide says native Alert.alert" attribution is closed with a pointer to the new guide note; D01/D02/I01/I02 rows record what changed and what the next round must expect. **I02's PASS is left in place but explicitly flagged as needing re-assertion**, because the exact string it was recorded against no longer ships.
- **Design system**: `error[700]` is now the documented error-TEXT token (5.11:1 on `#FFF0F2`, 5.16:1 on `#FEF2F2`, 5.65:1 on white), which closes the doc's own "Open Enhancement #1" (issue `mobapp#21` → satisfiable). The `ItemDetailScreen` `#c62828` carve-out is marked **LEGACY**. Enhancement #2 remains **open** — see §8.
- **QA memory**: the new toggle is documented next to the existing push-simulation entry, including the R24 side-effect check (`push_tokens` must stay 0).

## 6 · Deliberate departures from the dispatch's literal wording

1. **Item 5's `#EF4444` → `error[500]` became → `error[700]`.** The dispatch maps the ID-Verification error *text* to `error[500]` (`#E85D75`). Measured, that is **3.07:1** on the `#FEF2F2` tint — worse than the `3.44:1` it replaces and still an AA fail. The approved resolution (owner decision at plan time) was to add the AA-safe text token and use it: **5.16:1**, an accessibility *improvement* over both the old literal and the literal spec reading.
2. **Item 1's "canonical error token" for the NotificationSetup error text is `error[700]`, not `error[500]`** — same reasoning (`error[500]` would have taken the error text from 5.09:1 to **3.04:1**). `error[500]` stays the fill/border/icon token.
3. **Item 7's file locations.** The phrase `native Alert.alert` **does not exist in the canonical guide** — it appears only in the QA round report and the tracker row, and F04/F07 have no Android column in the guide. The fix therefore landed as: a new `Dependencies` note + copy corrections in the guide, and the parse-shape/attribution corrections in the tracker. Root and `archive/misc./` copies were deliberately left alone (canon-per-guide rule).
4. **No `AppNavigator.tsx` edit.** The `notification-setup` alias was already registered and the route already receives `route`/`navigation`, so `isOptional` is read inside the screen.

## 7 · Findings & traps discovered while implementing

1. **`qa:badge-scan` silently returns 0 on all-gray regions.** Proved with a control token that matches *any* colour: **0 pixels (0.00%)** on the (gray) privacy-box region vs **302,400 (100%)** on the (coloured) error region. ImageMagick dumps those crops as grayscale, so there are no `srgb(r,g,b)` triples to parse. This is exactly the "suspicious zero" class the QA playbook warns about — **use `qa:inspect-screen`'s histogram (or an exact-pixel sample) for gray-only regions.** The privacy-box verification above uses the histogram for this reason.
2. **`!Device.isDevice` short-circuits *before* the permission check**, so on a simulator `permission_denied`/`token_error` are structurally unreachable and `expo_go` needs Expo Go — which is why the copy fix could not have been verified on-device without a toggle. Re-ordering the checks was considered and rejected: "not a physical device" is the truer cause.
3. **`isOptional` was never passed** by the route, so "Maybe Later" and the `!isOptional` error subtext were dead UI. Now driven by the deep-link param.
4. **The tracker's strict `QA_TOGGLE_SHORT_NAMES` assertion and the QA dev-toggle deep-link test both enumerate the toggle registry** — adding a toggle without updating them fails the suite; both were extended.
5. **`xcrun simctl privacy … reset camera` terminates the app** (matches the round's note). The QA-toggle disarm was therefore re-verified functionally *after* relaunch.

## 8 · Known gaps / not done

- **`push_tokens` DB read-back not performed.** The R24 side-effect check would need a Supabase MCP call, which requires Samer's explicit approval per call; none was requested, so **no DB read was made**. Compensating evidence: the forced-reason path returns before `savePushToken`, and the unit tests assert `savePushToken` is never called on failure. **Owed if wanted:** `SELECT count(*) FROM push_tokens pt JOIN profiles p ON p.user_id = pt.user_id WHERE p.email = 'test-free@kidsmarketplace.test'` → expect **0**.
- **The push SUCCESS leg is still physical-device-gated** (unchanged by this task) — `not_device` is a real cause on a simulator, and the new toggle deliberately cannot fake a success.
- **White on `#5DBB8E` is 2.34:1** — design-system §6 "Open Enhancement #2", a brand-level decision that predates this task. The new primary CTA is the canonical instance of that tension: it ships exactly as the design system specifies (dispatch item 2 asks for the `#5DBB8E` pill with white text) and therefore **inherits** the open item. This is recorded in the doc, not silently accepted.
- **Broader token debt is untouched (intentional).** `#EF4444` / `#B45309` / `#F3F4F6` / `#4CAF50` remain in ~44 other files (CartScreen, IssueReportModal, ReviewModerationScreen, BillingHistoryScreen, BulkPhotoUploader, AutoCompleteBanner, TradeTimelineScreen, AIAnalysisCard, ColorPicker, PhotoUploadManager, …) — item 5 scoped only the ID-Verification occurrences. **Suggested follow-up task** (one per file, verified as it goes) rather than a blanket sweep.
- **`discoveryTokens.ts` drift is untouched:** its header still claims it matches `colors.ts` exactly, while `ds.neutral[50]` = `#FAFAFA` (vs `#F7F7F7`) and `ds.neutral[300]` = `#E0E0E0` (vs `#CCCCCC`), and it has no `neutral[200]`. Out of scope; worth its own task.
- **`verify:guides`' 3 hard findings and the repo's 80 lint errors are pre-existing** and untouched by this task.
- **No commit made; nothing pushed.**

## 9 · Evidence index

`e2e-test-results/fix-task-65-2026-09-18/screenshots/`

| File | Description |
|---|---|
| `09-BEFORE-notification-setup-prompt.png` | Copy of the round-1 "before" frame (bare RN `<Button>`, off-brand palette, ~300 pt void) |
| `10-notification-setup-after.png` | First frame after the relaunch (bundle still loading — kept for honesty) |
| `11-notification-setup-prompt-after.png` | Post-fix prompt state, full-res (source for the pill/box pixel work) |
| `12-notification-error-not_device.png` | Cause #1 copy — and the fail-closed reference: byte-identical copy after the toggle was disarmed |
| `13-notification-error-permission_denied.png` | Cause #3 copy **+ the Open Settings button** |
| `14-open-settings-affordance.png` | iOS Settings in the foreground after tapping Open Settings |
| `15-notification-error-expo_go.png` | Cause #2 copy |
| `16-notification-error-token_error-FULLRES.png` | Cause #4 copy, full-res (source for all three pixel scans + the exact-pixel samples) |
| `17-id-verification-row-and-actionable-error.png` | The "Use Camera" + library row and the new actionable inline error |
| `18-notification-setup-optional-variant.png` | The `?isOptional=1` variant with both 52 pt pills |

## 📋 QA Session Handoff

**Test Scope:** FIX-Task-65 — 11 dispatched items + 7 owner-approved extras against MSG Round 1 findings (`MSG-TC-I01`, `MSG-TC-I02`, `MSG-TC-D01`, `MSG-TC-D02`, plus the §5.1/§5.2 design-system compliance table). Guide: `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md`.
**Design-System Compliance:** **PASS** — `NotificationSetup` went from a whole-screen non-canonical palette to **0 raw hexes** (canonical fill 92.39% / off-brand 0.26%; CTA pill 93.17% `#5DBB8E` / 0.00% Material green; privacy-box fill byte-exact `#F7F7F7`), and the CTA is now the design-system primary pill at **408×52 pt** with a locator. `IDVerificationUploadScreen`'s three off-token hexes are tokenized (one is in a **dead** style block — disclosed). **One documented caveat:** white on `#5DBB8E` measures 2.34:1 (design-system §6 enhancement #2, still open) — the new CTA is its canonical instance and ships as the design system specifies.
**Perceived Load-Time Verdict:** N/A for the functional legs (each state transition landed within ≤1 poll); the dev-client cold start after the TCC reset printed `Downloading 100%…` for ~10 s — the known bundle-download environment artifact, not app behaviour.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — all four push-failure copies render cause-specifically on-device; the pre-fix misleading string now appears **only** for `token_error`.
- CONFIRMED — `Open Settings` renders only for a denied OS permission and really opens the app's settings page.
- CONFIRMED — ID Verification inline error: *"Failed to take photo. Please try again, or upload a photo from your library."* with the library fallback on the same row.
- CONFIRMED — the guide's corrected D01 disclaimer matches the app verbatim (read from the AX tree during the ID-Verification drive).
- DEVIATION (documented, §6) — error **text** uses the new `error[700]` (`#C91D39`) rather than the dispatch's literal `error[500]`, to avoid an AA regression.
**Verdict Summary:** not a QA round — a fix task. All 11 items + 7 extras implemented; Tier 0 green; **0** unit-suite failures (baseline had 1 env failure).
**Money Verification Layers:** **N/A — nothing in this task touches money, SP, Stripe or the DB.** No Supabase MCP call was made (read or write); no RPC/migration/EF change; no fixture consumed; no `admin_config`/`sp_config` write. The only persistent state touched was the session-local QA toggle, which was **armed and then disarmed** (verified functionally).
**Critical Findings:**
1. **[MED — tooling] `qa:badge-scan` reports 0% for any colour on an all-gray region** (proved with an any-colour control token). Any future "0% canonical" result on a gray/neutral surface must be re-checked with `qa:inspect-screen` before it is reported as a defect.
2. **[MED — structure] NotificationSetup's `isOptional` branch was dead UI** (the route passes no props) — fixed by reading the deep-link param; the tracker/memory now document how to drive it.
3. **[LOW — honesty] The I02 PASS's exact string no longer ships.** The error *state* still renders exactly as recorded, but the next MSG round must re-assert the copy; the tracker row says so explicitly instead of leaving a stale expected result.
**App State Left Behind:** Simulator `iPhone 17 Pro Max` with the app **running, logged in as `test-free`, parked on the NotificationSetup screen showing the real `not_device` error** (reachable, interactive). **QA toggle DISARMED and functionally verified** (the post-disarm run renders the true cause). **Camera TCC reset to default.** No DB writes, no fixtures consumed, no admin config touched. Metro on `:8081` left running as found; the Android Metro on `:8082` untouched.
**Why It Matters:** the "Enable Notifications" screen is shown to every new user, and it was rendering an off-brand Material/Tailwind palette with a 37 pt borderless-text CTA — below the minimum touch target — while telling simulator users to check *permissions* for four unrelated reasons. It is now on-brand, tappable, cause-specific, and instrumented; and the ID-verification upload path no longer dead-ends when no camera exists. The tracker/guide no longer carry the wrong disclaimer copy or the unresolved "Recall Alert" caveat, and the design system gained the accessible error-text token it had only proposed.
**How to Verify/Reproduce:** evidence in `e2e-test-results/fix-task-65-2026-09-18/` (`report.md`, `screenshots/`).
- *Palette:* `cd p2p-kids-marketplace && npm run qa:badge-scan -- --img ../e2e-test-results/fix-task-65-2026-09-18/screenshots/16-notification-error-token_error-FULLRES.png --region 60,1221,1200,252 --token OFFBRAND_ERRBG_FFEBEE,rmin=250,rmax=255,gmin=230,gmax=238,bmin=233,bmax=241 --token CANON_ERRBG_FFF0F2,rmin=250,rmax=255,gmin=236,gmax=244,bmin=238,bmax=246` → expect ~0.3% vs ~92%.
- *Exact colours:* `magick <16-…png> -format "%[pixel:p{660,1240}]" info:` → `srgba(255,240,242,1)`; `p{660,2100}` → `srgba(247,247,247,1)`; `p{660,2640}` → `srgba(93,187,142,1)`.
- *Any cause on a simulator:* `xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=push_registration_reason&value=<not_device|expo_go|permission_denied|token_error>"` → `…notification-setup` → tap `notification-enable-button`; disarm with `value=none`. Expect a `[QA] Toggle Applied … (verified read-back: …)` dialog on arming.
- *Gates:* `cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit && npm test` → 0 failures; `cd .. && npm run verify:guides` → 3 pre-existing hard findings, none in MSG rows touched here.
**Known Gaps / Not Tested:** (1) the push **success** leg (physical device only, unchanged); (2) the `push_tokens` DB read-back (needs an approved Supabase MCP call); (3) `expo_go`/`token_error` copy was driven through the QA override rather than the real environment (the override short-circuits *before* the OS calls — the real branch mapping is unit-tested); (4) `#F3F4F6`'s dead style block is verified only at source level (nothing renders it); (5) the other ~44 files' off-brand hexes are out of scope.
**What Needs To Be Fixed Next:**
1. **Owner decision — G05:** add a `safety` value to `notification_category` + a producer for recall/safety notifications, or formally reword the guide's G05 notification limb (the client's red-icon branch already exists).
2. **QA:** re-run `MSG-TC-I01`/`I02` on the current build to re-assert the new error copy and the locators (the tracker rows say exactly what to expect).
3. **Optional:** the `push_tokens` read-back above, if the R24 SQL evidence is wanted for the record.
4. **Follow-up task:** sweep the remaining `#EF4444` / `#B45309` / `#F3F4F6` / `#4CAF50` occurrences (~44 files), and reconcile `discoveryTokens.ts` with `colors.ts`.
**UX Enhancement Ideas (optional, not defects):** on `NotificationSetup`, consider showing the *last* attempt's cause as persistent context rather than replacing it on each retry; consider an equivalent "Open Settings" affordance on the ID-verification camera-permission alert (it currently only explains, not navigates).
**Suggested Next Session:** the G05 product decision (it is the only remaining MSG item that cannot be closed by testing), then a single physical-device session to close the two hardware-gated limbs (I01 success + D02 capture-success).
**Suggested to Improve Agent Rules:** add to the QA playbook, under the existing "suspicious zero" rule in §5.63/R62c, the concrete root cause found here — **`qa:badge-scan` cannot read all-gray regions** (grayscale dump ⇒ no `srgb()` triples), so a 0% result on a neutral/gray surface must be re-checked with `qa:inspect-screen`'s histogram or an exact-pixel sample before it is reported. One line with the any-colour control token as the diagnostic would have saved this session's two extra calls and, more importantly, prevents a future false "canonical 0.00%" finding on a card or panel background.
