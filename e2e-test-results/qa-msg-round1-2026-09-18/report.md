# QA Run Report — MSG Module, Round 1

- **Run folder:** `e2e-test-results/qa-msg-round1-2026-09-18/`
- **Date:** 2026-09-18
- **Platform:** iOS Simulator — iPhone 17 Pro Max, UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1 (dev client, bundle ID `com.sameralzubaidi.p2pmarketplace`)
- **Persona:** `test-free` (standing registry persona; free tier) — see Known Gaps for the deliberate deviation from the guide's `new-user` actor
- **Guide:** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md`
- **Round type:** **RE-VERIFICATION + blocker recheck** — NOT new coverage (MSG has **0 never-run rows**). See §0.
- **Money/SP:** the cases driven this round touch **no** money or SP. See the handoff's `Money Verification Layers`.

---

## 0 · Step-0 reconciliation (tracker vs. notes vs. live reality)

### 0.1 Are the brief's numbers right?

Yes. Read directly from `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`:

| Source | Cases | PASS | PARTIAL | OPEN | DRIFT | SKIP | NOT-SUPPORTED | Remaining |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| §1 roll-up MSG row (line 55) | 72 | 64 | 4 | 2 | 0 | 0 | 2 | 0 |
| MSG section header (line ~240) | 72 | 64 | 4 | 2 | 0 | 0 | 2 | 0 |

64 + 4 + 2 + 2 = **72 ✓**. The dispatch's "64 PASS / 4 PARTIAL / 2 OPEN" is **accurate** — no stale headline on the *counts*.

### 0.2 The premise that WAS stale (two of them)

The dispatch's Step-1 assumption — *"The 2 OPEN cases — likely genuinely never driven"* — is **false for both**, and in exactly the AUTH J02/J12 class:

1. **MSG-TC-I02 is not "never driven" and its blocker is already FIXED.**
   - It holds a real 2026-09-04 verdict (`qa-task28-mobile-closure-sub-msg-2026-09-04/report.md:58` — "🔴 STILL OPEN / BLOCKED on-device (named defect)"). The named defect: the *Enable Notifications* CTA was occluded by the floating `PersistentTabBar` pill because `NotificationSetup` was not in `TAB_BAR_HIDDEN_ROUTES`.
   - **That defect was fixed in source on 2026-09-06** (commit `0a104881`, `p2p-kids-marketplace/src/components/organisms/PersistentTabBar/index.tsx:70-75`). Live value on this build: `ItemCreate, NotificationSetup, ManageKidsClub, SubscriptionExpired`.
   - ⇒ the tracker's OPEN row rests on a 12-day-stale blocker. Driven this round (§2).
2. **MSG-TC-B05 is not "never driven" either — it is product-DEFERRED.** The canonical guide says verbatim: *"Out of scope for future QA rounds until Leaderboard is prioritized. Do not treat its reachability as a defect or re-flag it."* It is mis-bucketed in the `🔴 OPEN` column, which makes it look like owed work.

### 0.3 Live-environment reads (read from staging, never inferred from code/docs)

| Claim checked | Method | Live result |
|---|---|---|
| B05 reachability (needs a `leaderboard_rank_up` notification) | `user_notifications` read | **0 rows** of type `leaderboard_rank_up` |
| G05 recall/safety notification producer | `user_notifications` read + `grep supabase/**` | **0 rows**; **0 producer references** anywhere in Edge Functions |
| D10 / J05 "no `id_verification` category" | `enum_range(public.notification_category)` | `badges, sp_events, subscription, system, trades` — **no id_verification, and no `safety`** |
| D02 persona precondition | `id_badge_verification_requests` join `profiles` | **test-free: 0 ID requests** (correct for D02) — **test-seller: 1 PENDING** (`28846a18`) ⇒ test-seller would have rendered the Pending state, which has no *Use Camera*. The §4 pre-read prevented a wasted drive. |
| I02 side effect (no token should persist) | `push_tokens` read | **test-free: 0 rows** (table total 114) — the failed registration short-circuits before `savePushToken` |

### 0.4 PASS-row notes-vs-headline check (the AUTH J02/J12 bug class)

- Reviewed the `Notes` cell of **all 72 MSG rows** for contradictions with the headline `Status`.
- Swept every MSG source run's `report.md` for a negative verdict (`FAIL|PARTIAL|BLOCKED`) on an MSG-TC row. **9 matches, 0 contradictions:** each is either (a) superseded by a *later* run that the tracker's `Source` column names (task25's E04 PARTIAL → task26 PASS; task25's G01–G04/G06/G07 BLOCKED → task26 PASS; task27's toolset-disabled BLOCKED → task28 same-day verdicts), or (b) still accurately reflected in the current Status (B05 OPEN, I01/I02/D02/G05/G08 PARTIAL/OPEN).
- **Genuine notes-vs-headline nuances found (no verdict change, but tracker-integrity issues):**
  1. **G09** headline ✅ PASS while its own Notes name an undriven residual limb ("full New-Item create-with-recall-title comparison leg not driven"). A PASS with a named missing limb.
  2. **F04 / F07** verdicts derive from an **Android** config-propagation run (`qa-task43a-exec-config-prop-2026-09-08`), yet the tracker's `Android` column reads `—` for both. The column parser expects a `PASS (Android)` shape; the notes write `(Android) PASS`. Cosmetic, no verdict change — but it under-reports Android coverage.
  3. **D07** ✅ PASS with a caveat in Notes (own-profile self-view showed Not-Verified 1–2 min post-approval; DEV-TASK-102 tracks it).
  4. **H02 / H03** ✅ PASS but **consumed their fixtures** (documented in-row) — any future re-run needs fresh fixtures.
  5. **I01 / I02** Notes carried the now-fixed occlusion blocker as if current (corrected this round).

### 0.5 Round-type statement (required by the post-AUTH standing rule)

**This round is RE-VERIFICATION + blocker recheck, not new coverage.** Reason: MSG's never-run pool is already **0** (closed in QA Task 30, 2026-09-04), so there is no first-verdict work to do. What genuinely needed doing — and what the Step-0 read surfaced — was (a) re-testing the two blocked-class rows whose blocker had since been fixed, (b) pinning the four PARTIALs' missing limbs to *live* evidence rather than to 2-week-old notes, and (c) a design/copy pass on the newly-reachable screens.

---

## 1 · Execution trace (every tool call, in order)

Device: `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E` unless stated.

| # | Call | Purpose / result |
|---|---|---|
| 1 | `xcrun simctl list devices booted` | R29 busy check: one booted sim (iPhone 17 Pro Max, iOS 26.1) |
| 2 | `pgrep -l -f "expo start"` | Metro present on **:8082** (`--clear`); do NOT kill another session's server |
| 3 | `pgrep -l -f "maestro\|run-suite\|playwright\|mobilecli"` | only a leftover `p2p-kids-admin` Playwright `test-server` |
| 4 | `session_store_sql` (sessions) | local store has no recent rows — inconclusive, fell through to #5 |
| 5 | `find e2e-test-results -newermt "-90 minutes"` | only the just-closed AUTH round's report + the tracker ⇒ no active QA run |
| 6 | `mcp_mobile_get_foreground_app` | App already foreground ⇒ installed + running |
| 7 | `mobile_save_screenshot 00-start-state-pre-relaunch.png` | Starting state (Home, test-free, "session restored" toast) |
| 8 | `mobile_terminate_app` + `mobile_launch_app` | **R79-1c cold reload** |
| 9–11 | poll ×3 (`mobile_list_elements_on_screen`) | Splash → "Downloading 12%…" → "Downloading 100%…" → `dashboard-screen` ⇒ **fresh bundle proven loaded** |
| 12 | `xcrun simctl openurl "p2pkidsmarketplace://notification-setup"` | Deep link (registered: `AppNavigator` linking `NotificationSetup: 'notification-setup'`) |
| 13 | `mobile_list_elements_on_screen` | **`Enable Notifications` exposed at (16,868) 408x37; NO tab-bar elements in the tree** ⇒ the occlusion fix is live in this bundle (R79-1 discriminator) |
| 14 | `mobile_save_screenshot I02-01-…-pill-absent.png` | Pre-action evidence |
| 15 | `mobile_click_on_screen_at_coordinates (220,886)` | Tap **Enable Notifications** (tree-derived center) |
| 16 | `mobile_list_elements_on_screen` | Error state rendered: `⚠️ Could not obtain push notification token. Make sure you granted permissions.` + `Please try again or contact support` |
| 17 | `mobile_save_screenshot I02-02-error-state-push-token-null.png` | Error-state evidence (scaled) |
| 18 | `read_file notifications.ts:45-120` | Source: 4 distinct null-causes collapse into 1 user-visible iOS message |
| 19 | `push_tokens` read (staging) | **0 rows for test-free** — side-effect verification ✓ |
| 20 | `mobile_save_screenshot I02-03-error-state-FULLRES.png` | Full-res (1320x2868) for pixel work |
| 21 | `qa:inspect-screen --img …` | Confirms 1320x2868 px = 440x956 pt @3x |
| 22 | `qa:badge-scan --region 60,1221,1200,249 …` | Error banner fill = **`#FFEBEE` 92.25%**; canonical `#FFF0F2` **0.01%** |
| 23 | `id_badge_verification_requests` read | D02 precondition (see §0.3) |
| 24 | `xcrun simctl openurl "p2pkidsmarketplace://id-verification-upload"` | D02 screen |
| 25 | `mobile_list_elements_on_screen` + `mobile_save_screenshot D02-01-…` | D01 initial state renders as specified |
| 26 | `mobile_click_on_screen_at_coordinates (220,561)` | Tap **Use Camera** |
| 27 | `mobile_list_elements_on_screen` + `mobile_save_screenshot D02-02-…` | Graceful inline `id-verification-error` → "Failed to take photo"; no crash |
| 28 | `xcrun simctl privacy booted revoke camera …` | Induce permission-denied TCC state to reach the guide's 2nd D02 limb |
| 29 | `mobile_list_elements_on_screen` | **App had left the foreground** |
| 30 | `mobile_list_crashes` | **No crash** for our bundle (newest entries are Safari noise) ⇒ terminated by the TCC change, benign |
| 31–33 | `mobile_launch_app` + poll ×2 | Cold restart (cached bundle) → Home as test-free |
| 34 | `xcrun simctl openurl "…://id-verification-upload"` + list | Fresh upload state |
| 35 | `mobile_click_on_screen_at_coordinates (220,561)` | Re-tap **Use Camera** |
| 36 | `mobile_list_elements_on_screen` | **`Permission Required` / `Please allow camera access.` + `global-alert-button-0`** ⇒ guide copy matched verbatim |
| 37 | `mobile_save_screenshot D02-03-permission-required-alert.png` | Evidence |
| 38 | `mobile_click_on_screen_at_coordinates ref=@e5` + list | Dismiss OK; back to upload state |
| 39 | `xcrun simctl privacy booted reset camera …` | Restore clean simulator TCC state |
| 40 | design-token greps (NotificationSetup, IDVerificationUpload, app-wide R62b legacy hexes) | See §5 |
| 41 | `grep SellerEarnings` + `grep docs/DECISIONS.md` | Dead-screen + no-declared-MSG-redesign checks |

Screenshots (7) are in `e2e-test-results/qa-msg-round1-2026-09-18/screenshots/`.

---

## 2 · Per-case results

### 2.1 MSG-TC-I02 · Push error states — 🟡→ **✅ PASS (scoped)**

**Guide defect at entry:** BLOCKED — "Enable Notifications CTA occluded by the floating tab bar → cannot reach the 'Could not obtain push token' error."

**Driven end-to-end on the current build:**
1. Prompt renders: `🔔 Stay Connected` + "Enable push notifications to stay updated" + the 5 benefit bullets + the Privacy & Permissions box — **exactly** the guide's expectation.
2. `Enable Notifications` is exposed in the AX tree at `(16,868) 408x37` and the **floating tab bar is entirely absent** from the tree on this route (the source fix).
3. Tap → error state renders within ≤1 poll:
   - `⚠️ Could not obtain push notification token. Make sure you granted permissions.`
   - `Please try again or contact support`
4. **No crash**, no redbox, screen remains interactive; the CTA stays available for a retry.
5. **Side-effect verification (§5.37/R24):** `push_tokens` has **0 rows for test-free** ⇒ the null-token path correctly short-circuits before `savePushToken`.

**Scope note (stated, not glossed):** the guide's literal environments are "Expo Go (or web)". Neither is available in this iOS-only scope (the app is a dev client; web is out of scope per the agent's §2). The path driven is **the same real failure class** — push cannot initialize ⇒ null token ⇒ error branch. The Expo-Go branch (`getNotificationsModule()` null) is source-proven to return null into the **identical** `Platform.OS`-based copy, so the user-visible outcome is provably the same.

**New finding (copy accuracy, see §5.2):** one iOS string is used for **four** distinct causes.

### 2.2 MSG-TC-I01 · Enable push notifications — 🟡 **PARTIAL (gap narrowed and re-based on live evidence)**

- **What was recorded:** "prompt leg PASS … Enable Notifications CTA occluded by the floating tab bar → **interaction not drivable**; success leg needs a physical device."
- **What is true now:** the **interaction is drivable and was driven** (same tap as §2.1). The recorded blocker is **closed**; that half of the PARTIAL reason is stale.
- **What remains genuinely missing:** the **success leg only** — `registerForPushNotifications()` returns `null` when `!Device.isDevice` (simulator), so `status==='success'`, `✅ Notifications enabled!` and the confirming local notification are unreachable without a physical device. The session-local `push_simulation` toggle does **not** help: it mocks `sendPushNotification`, not token acquisition.
- **Not observed:** the "Setting up notifications..." transient — on this path the registration fails fast enough (<1 poll) that the `requesting` frame was not captured. Source-verified as rendered when `status==='requesting'` (`NotificationSetup.tsx:121-127`).

### 2.3 MSG-TC-D02 · Capture ID with camera — 🟡 **PARTIAL (permission-denied limb now DRIVEN)**

- **Sim leg re-verified on the current build:** `Use Camera` → graceful inline `id-verification-error` → **"Failed to take photo"**; no crash. (Same behavior as 2026-09-04, now re-evidenced on this build.)
- **NEW — the permission-denied limb was reached for the first time.** With the simulator's camera TCC state set to denied, `takePhoto()` takes the guide's expected branch:
  - Alert title **`Permission Required`**, body **`Please allow camera access.`** — **verbatim match** to the guide.
  - Dialog type: in-app `GlobalAlertProvider` (AX-instrumentable `global-alert-button-0`), *not* a native `Alert.alert`. The guide labels this "a … alert"; the code calls `Alert.alert` but DT51 routes every `Alert.alert` through the branded provider ⇒ **doc-drift note** (§5.3), and §5.4's empirical-verification requirement is satisfied by the tree.
- **Remaining gap:** only the **capture-success** limb (a real camera capture) — genuinely hardware-gated.
- **Environment side effect disclosed:** the `simctl privacy revoke` terminated the app process. `mobile_list_crashes` shows **no crash for our bundle** ⇒ it was a TCC-change side effect, not an app fault. Camera TCC was **reset to default** afterwards.

### 2.4 MSG-TC-B05 · Leaderboard ranking — 🔴 OPEN → **🚫 NOT-SUPPORTED (disposition change, owner-reversible)**

- The guide marks this **DEFERRED post-MVP by product decision + Dev Task 95**, and instructs: *"Out of scope for future QA rounds until Leaderboard is prioritized. Do not treat its reachability as a defect or re-flag it."*
- `AppNavigator.tsx:177` carries the matching in-source note ("Leaderboard intentionally NOT added — deferred post-MVP per product decision (matches its lack of an in-app nav entry; see MSG-TC-B05)").
- Live: **0 `leaderboard_rank_up`** notifications ⇒ no entry point exists.
- **Action taken:** reclassified out of the OPEN bucket into NOT-SUPPORTED (precedent: 2026-09-07 AUTH/ACC `K01–K04 OPEN→NOT-SUPPORTED`). Rationale: leaving a product-deferred case in OPEN is precisely the "stale headline" disease this round exists to fix. **Flagged for owner sign-off** in the handoff — revert if a distinct DEFERRED bucket is preferred.

### 2.5 MSG-TC-G05 · Recall safety alert notification — 🟡 **PARTIAL (cause pinned to live evidence)**

Banner leg **(PASS, 2026-09-04)**. Notification leg remains unproducible, now with a precise chain:

1. **0 `recall_alert` notification rows** on staging.
2. **0 producers** — `grep "recall_alert" supabase/**` returns nothing (the string appears only in client **tests**).
3. The client **does** have a red treatment: `NotificationCenterScreen.tsx` `CATEGORY_ICONS.safety → { Warning, COLORS.red }` — but it is a **category fallback**, and the `notification_category` enum (live-read) has **no `safety` value** ⇒ that branch is unreachable today. (`user_notifications.category` is free `text`, so the column itself is not the blocker — the missing producer is.)
4. **The guide's own 2026-08-12 flag is now ANSWERED:** the shipped user-facing name is **"Safety Alerts"** (`NotificationSettingsScreen.tsx:73`, with the always-on note "Critical safety alerts (product recalls) are always delivered regardless of your preferences."), **not** "Recall Alert" ⇒ **DOC-DRIFT**, guide should be reworded.
5. Seller-side banner copy confirmed: `ListingSafetyReviewScreen.tsx:242` — "This listing is currently under safety review."

### 2.6 MSG-TC-G08 · AI moderation toggle — 🟡 **PARTIAL (gate re-confirmed as infra + fixture)**

Config round-trip was already **PASS** (2026-09-04). The behavioural leg's gate was re-confirmed from source, not assumed:

- `supabase/functions/moderate-image/index.ts` hard-depends on `GOOGLE_VISION_API_KEY` and **throws** `GOOGLE_VISION_API_KEY not configured` when absent; `analyze-item-image` uses the same key. There is **no config-level or client-level bypass** — the toggle (`moderation_ai_enabled`) only gates whether the automated path is invoked.
- The case's required precondition ("an image fixture that consistently triggers automated image moderation") **does not exist** (R41 runbook verdict, unchanged).
- ⇒ remains **PARTIAL**: needs the provider credential/network reachability **and** a triggering fixture — both outside a read-only execution agent's remit. No code gap; do not re-file as a defect.

---

## 3 · Batch summary (§8.2)

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| MSG-TC-I02 | MSG | ✅ **PASS** (was 🔴 OPEN) | Blocker fixed 2026-09-06; error state driven end-to-end; no `push_tokens` row written |
| MSG-TC-I01 | MSG | 🟡 **PARTIAL** (unchanged verdict) | Interaction blocker **closed**; only the physical-device success leg remains |
| MSG-TC-D02 | MSG | 🟡 **PARTIAL** (unchanged verdict) | **Permission-denied limb now driven**, copy-exact; only capture-success is hardware-gated |
| MSG-TC-B05 | MSG | 🚫 **NOT-SUPPORTED** (disposition) | Product-deferred post-MVP; 0 notification rows; removed from the misleading OPEN bucket |
| MSG-TC-G05 | MSG | 🟡 **PARTIAL** | 0 producers + no `safety` enum value ⇒ unreachable; guide wording = DOC-DRIFT ("Safety Alerts") |
| MSG-TC-G08 | MSG | 🟡 **PARTIAL** | Gate re-confirmed as provider-credential + missing fixture, not code |

**Roll-up: 1 PASS · 0 FAIL · 0 BLOCKED · 0 SKIPPED** (2 verdicts re-based on new evidence; 1 disposition change; 2 gates re-confirmed).

### 3.1 Perceived load-time table (§5.7)

All measurements: **perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.**

| Screen → transition | Elapsed | Flag |
|---|---|---|
| **Cold app launch #1** (dev client, bundle 12%→100% download) → `dashboard-screen` | ~8–12 s | ⚠️ **≥3s — ENVIRONMENT ARTIFACT** (dev-build bundle download + native init), *not* app behaviour |
| Cold app launch #2 (bundle cached) → Home | ~2–4 s | — (still prints "Downloading 100%…") |
| Home data fill (skeleton spinner → content) | ~1–3 s | — |
| `notification-setup` deep link → prompt rendered | ≤1 poll (~1–2 s) | — |
| Tap **Enable Notifications** → error state | ≤1 poll (~1–2 s) | — |
| `id-verification-upload` deep link → upload state | ≤1 poll (~1–2 s) | — |
| Tap **Use Camera** → inline "Failed to take photo" | ≤1 poll (~1–2 s) | — |
| Tap **Use Camera** (denied) → `Permission Required` alert | ≤1 poll (~1–2 s) | — |

**No app-behaviour transition reached 3 s.** The single ≥3 s entry is the dev-client cold start and is an environment artifact.

---

## 4 · Cross-cutting UX findings

### 4.1 Structural / affordance
- **NotificationSetup (MED, design-system):** the screen's only action is a bare React Native `<Button>` — borderless green text, **37 pt tall**, i.e. **below the design system's 44 pt minimum touch target** and not the primary filled pill. `NotificationSetup.tsx:196-205`.
- **NotificationSetup (LOW):** ~300 pt of dead vertical space between the Privacy box and the pinned CTA (content does not fill the ScrollView).
- **NotificationSetup (LOW, instrumentation):** the CTA carries **no `testID`** (AX `label="Enable Notifications"` only) — a locator gap; recommendation below.
- **ID Verification upload (observation, NOT a defect):** *Use Camera* is offered even on a device with no camera. Simulator-only condition (all supported iPhones have cameras) ⇒ observation, not a bug report.

### 4.2 Wording / copy clarity
- **MSG-TC-I02 — copy misattributes the failure cause (MED).** `NotificationSetup.tsx:71-77` renders ONE iOS string — *"Could not obtain push notification token. Make sure you granted permissions."* — for **four distinct causes**: (1) Expo Go / notifications module unavailable, (2) **not a physical device**, (3) permission genuinely denied, (4) token-fetch error. The string is returned by `notifications.ts:55-115` as a bare `null`, so the component cannot tell them apart. On a simulator/Expo-Go run the real cause is (1)/(2), and pointing the user at *permissions* is misleading — and the guide's own I02 example explicitly asks for **device-specific** guidance ("use a development build…").
  **Proposed rewrite:** have `registerForPushNotifications()` return a discriminated reason (e.g. `{ ok:false, reason:'expo_go'|'not_device'|'permission_denied'|'token_error' }`) and render cause-specific copy:
  - not_device → *"Push notifications need a physical device. This is a simulator/emulator."*
  - expo_go → *"Push notifications aren't available in Expo Go. Use a development build."*
  - permission_denied → *"Notifications are turned off for Pass It Up. Enable them in Settings › Notifications."*
  - token_error → current text.
- **ID Verification privacy disclaimer (LOW, doc-drift):** guide quotes *"We will not store your ID image. It will be deleted after verification."*; shipped copy is stronger — *"We will not store or keep your ID image. Your image will be permanently deleted after we approve or reject your verification request."* Shipped copy is **better** (clearer timing); update the guide, not the app.

### 4.3 Locator gaps
| Element | Issue | Fallback used | Recommended fix |
|---|---|---|---|
| `NotificationSetup` "Enable Notifications" | No `testID`/deterministic id (AX label only) | Tapped the tree-derived center (220,886) | Add `testID="notification-enable-button"` + `accessible`/`accessibilityRole` (BP-53 class) |
| `NotificationSetup` "Maybe Later" | Same gap (not rendered in this entry path, `isOptional=false`) | not tapped | Same fix |

---

## 5 · Design-system compliance (§6.4)

### 5.1 NotificationSetup — **FAIL (significant deviation)**
The screen renders on an entirely non-canonical (Material/Tailwind) palette rather than the Pass It Up tokens (`src/theme/colors.ts` / `docx/design-system-passitup.md`):

| Element | Rendered | Canonical | Severity |
|---|---|---|---|
| Screen title / benefits title / info title | `#333` | `#1A1A1A` (`neutral.900`) | MED |
| Subtitle / loading text / benefit text / info text | `#666`, `#555` | `#6B6B6B` (`neutral.700`) | MED |
| Error banner fill | **`#FFEBEE`** — *pixel-verified: 92.25% of the banner region; canonical `#FFF0F2` measured 0.01%* | `error[100] #FFF0F2` | MED |
| Error text / subtext | `#C62828` / `#D32F2F` | `error[500] #E85D75` | LOW–MED (see AA nuance) |
| Success text / subtext | `#2E7D32` / `#558B2F` | `success[500] #5DBB8E` | MED |
| Info box fill | `#F5F5F5` | `neutral[50] #F7F7F7` / `info[100] #E1F5FE` (note: `#F5F5F5` is the *inputDisabled* token) | LOW |
| Bottom border | `#EEE` | `neutral[200] #E0E0E0` | LOW |
| **Primary CTA** | RN `<Button>` — borderless green text, **37 pt** | Primary pill: `#5DBB8E` fill, white 16px semibold, **52/48/40 px** height, pill radius | **MED–HIGH** (structure + touch target) |
| Android channel `lightColor` | `#4CAF50` | `#5DBB8E` | LOW (Android-only, source) |
| Success box fill | `#E8F5E9` | `success[100] #E8F5E9` | ✅ **ALIGNED** |

*AA nuance (recorded deliberately, not glossed):* `design-system-passitup.md:589` sanctions `#c62828` for the Item Detail error **title** because `#E85D75` fails AA as text. That carve-out is screen-specific; here Material reds are used casually across a whole screen's error styling. The durable fix is the doc's own "enhancement #1" (a dedicated accessible error-text token), not a per-screen red.

### 5.2 IDVerificationUploadScreen — **PARTIAL (minor)**
Largely token-aligned (`#5DBB8E`, `#6B6B6B`, `#1A1A1A`, `#FEF3C7`, `#E8F5F0`, `#E0E0E0`, `#999999`, `#FEF2F2`). Three off-token hexes: `#EF4444` (error text), `#B45309` (amber note text — the exact class FIX-Task-49 item 2 replaced elsewhere), `#F3F4F6` (divider).

### 5.3 Standing R62b app-wide legacy-hex sweep
`grep "#4A7C59|#4D4D4D|#808080" src` → matches **only** in `screens/seller/SellerEarningsScreen.tsx` (9×). **Reachability checked before reporting:** that screen is **dead** — its route was removed in FIX-Task-48 item 2 (`AppNavigator.tsx:760`: *"the dead 'SellerEarnings' route and its … were removed; SellerEarnings' only caller was …"*). ⇒ **latent source hygiene, NOT a user-facing design defect.** No false-positive defect filed.

---

## 6 · Environment / friction notes

- **Metro is on `:8082`** (another instance, started with `--clear`). Standing rule applied: **not killed, not restarted.** A leftover `p2p-kids-admin` Playwright `test-server` process also present (not an active driver).
- **Dev-client cold start** remained the run's dominant environment cost (bundle download on launch #1).
- **`xcrun simctl privacy revoke` terminates the target app.** Confirmed **not** a crash (§2.3). Any future permission-state drive must expect a relaunch.
- **`session_store_sql`** had no rows for the current period → it was not usable as the R29 busy signal; the `find -newermt` run-folder heuristic was decisive instead.
- No LogBox / fatal overlay occurred at any point. No stale-tree incident occurred (trees were fresh after every transition).
- Deep links used: `p2pkidsmarketplace://notification-setup`, `p2pkidsmarketplace://id-verification-upload` — both registered and delivered warm, 1 call each.

---

## 7 · Recommended follow-ups (separate tasks — NOT applied in-run)

1. **Dev:** `NotificationSetup` — replace the RN `<Button>` with the design-system primary pill; remap the screen's palette to `theme/colors.ts` tokens; add `testID`s to the CTAs. (Design MED–HIGH + locator gap.)
2. **Dev:** `NotificationSetup` — return a **discriminated failure reason** from `registerForPushNotifications()` and render cause-specific copy (fixes the misleading "granted permissions" hint for the not-a-device / Expo-Go cases).
3. **Product/Dev:** decide the recall-notification path for G05 — either add a `safety` value to `notification_category` + a producer for recall alerts, or formally reword the guide (the client's red-icon branch already exists and would work).
4. **Docs:** guide doc-drift fixes — MSG-TC-G05 "Recall Alert" → **"Safety Alerts"**; MSG-TC-D02 dialog label "native `Alert.alert`" → in-app `GlobalAlertProvider`; D01 disclaimer copy.
5. **Tracker hygiene:** F04/F07 `Android` column parsing shape (`(Android) PASS` vs `PASS (Android)`); G09 PASS-with-named-residual needs an explicit disposition.
6. **QA tooling (optional):** a first-class "physical-device required" marker so device-gated limbs (I01 success, D02 capture) stop being re-litigated each round.

---

## 8 · Evidence index

| File | Description |
|---|---|
| `screenshots/00-start-state-pre-relaunch.png` | Home as test-free, pre-cold-reload (baseline state) |
| `screenshots/I02-01-notification-setup-prompt-pill-absent.png` | NotificationSetup prompt with CTA fully visible and **no floating tab bar** |
| `screenshots/I02-02-error-state-push-token-null.png` | Error state: `⚠️ Could not obtain push notification token…` |
| `screenshots/I02-03-error-state-FULLRES.png` | Full-res (1320×2868) source for the `qa:badge-scan` fill measurement |
| `screenshots/D02-01-id-verify-initial-state-testfree.png` | ID Verification upload state (D01 state verified, test-free) |
| `screenshots/D02-02-failed-to-take-photo-inline-error.png` | Inline "Failed to take photo" graceful error (no camera hardware) |
| `screenshots/D02-03-permission-required-alert.png` | **"Permission Required / Please allow camera access."** — guide copy exact |

---

## 📋 QA Session Handoff

**Test Scope:** MSG Round 1 — `MSG-TC-I02`, `MSG-TC-I01`, `MSG-TC-D02` (device-driven) + `MSG-TC-B05`, `MSG-TC-G05`, `MSG-TC-G08` (evidence/desk reconciliation). Guide: `MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md`.
**Design-System Compliance:** **PARTIAL** — `NotificationSetup` **FAIL** (whole-screen non-canonical palette: `#333`/`#666`/`#555` text, error fill `#FFEBEE` pixel-verified at 92.25% vs canonical `#FFF0F2` at 0.01%, `#C62828`/`#D32F2F` error, `#2E7D32`/`#558B2F` success, `#F5F5F5` info fill = the *disabled-input* token, `#EEE` divider); CTA is a bare RN `<Button>` at **37 pt** (below the 44 pt minimum) instead of the 52 px primary pill; Android channel `lightColor: '#4CAF50'`. `IDVerificationUploadScreen` **PARTIAL**: 3 off-token hexes (`#EF4444`, `#B45309`, `#F3F4F6`) but otherwise token-aligned. App-wide R62b legacy-hex sweep: `#808080`/`#4D4D4D` remain only in the **dead** `SellerEarningsScreen` (route removed, FIX-Task-48 item 2) ⇒ latent, not user-facing.
**Perceived Load-Time Verdict:** FLAGGED — cold app launch #1 (dev client, bundle download 12%→100%) → `dashboard-screen`: ~8–12 s. **This is an environment artifact — dev-build bundle download + native init, not app behaviour** (§2/§3.1). Every app-behaviour transition measured **<3 s** (deep-link landings, Enable-Notifications→error, Use Camera→inline error / permission alert each ≤1 poll, ~1–2 s); cold launch #2 with a cached bundle was ~2–4 s.
**Design & Copy Compliance Confirmation:**
- DEVIATION — `NotificationSetup` screen: off-canonical palette throughout (see Design-System Compliance) and, most visibly, the primary CTA renders as borderless green text at 37 pt rather than a filled `#5DBB8E` pill with white text.
- CONFIRMED — `NotificationSetup` *content/copy*: title "🔔 Stay Connected", subheading, the 5 benefit bullets and the Privacy & Permissions box match the guide exactly.
- DEVIATION — `NotificationSetup` error **copy**: "Make sure you granted permissions" misattributes 4 distinct causes (Expo Go / not-a-physical-device / permission denied / token error); concrete rewrite supplied in §4.2.
- CONFIRMED — `Permission Required` alert (`id-verification` camera deny): wording **verbatim** per the guide ("Permission Required" / "Please allow camera access."); layout/centering fine. Rendered via in-app `GlobalAlertProvider` (`global-alert-button-0`), so the guide's "native `Alert.alert`" label is doc-drift.
- CONFIRMED — ID Verification upload screen: heading, privacy disclaimer, upload area, `Use Camera`, Submit and Tips all render per spec; inline `id-verification-error` styling uses the canonical `#FEF2F2` error tint (only its `#EF4444` text hex is off-token).
- CONFIRMED — Home (`dashboard-screen`) and the ID-Verification `Verified`/`Pending` state components carry proper `testID` + `accessibilityRole` instrumentation; no visually broken layout observed on either visited screen.
**Verdict Summary:** 1 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED (plus 2 PARTIAL verdicts re-based on new evidence, 1 disposition change to NOT-SUPPORTED, 2 gates re-confirmed as infra/product).
**Money Verification Layers:** **N/A — no case in this round touches money or SP.** `MSG-TC-I01`/`I02` are push-permission/error states (verified side effect: `push_tokens` **0 rows** for test-free — nothing persisted); `MSG-TC-D02` is ID-image capture (no payment object); `MSG-TC-B05`/`G05`/`G08` are moderation/notification surfaces. No Stripe/provider object applies — `Stripe N/A — no payment object in any case driven`. MSG's money-adjacent rows (referral reward SP values F04/F07, review surfaces C-group) are already-PASS config/display cases and were **not** re-driven this round.
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — **MSG-TC-I02 🟡 PARTIAL/🔴 OPEN → ✅ PASS** (iOS PASS; Latest PASS; Source → `qa-msg-round1-2026-09-18`); **MSG-TC-B05 🔴 STILL OPEN → 🚫 NOT-SUPPORTED** (product-deferred post-MVP per the guide + Dev Task 95; Latest → NOT SUPPORTED; owner-reversible); **Notes/Latest/Date/Source refreshed, verdicts unchanged, on MSG-TC-I01, MSG-TC-D02, MSG-TC-G05, MSG-TC-G08**; dated round note added above the MSG table. **New per-guide totals (MSG):** Cases 72 · **PASS 65** · **PARTIAL 3** · **OPEN 1** · DOC-DRIFT 0 · SKIPPED 0 · **NOT-SUPPORTED 3** · Never-run **0** → 65+3+1+0+0+3+0 = **72 ✓** (was 64/4/2/0/0/2/0). §1 roll-up row reconciled to the same figures. No other guide's rows were touched.
**Critical Findings:**
1. **[HIGH — tracker trust, now fixed] The dispatch's Step-1 premise was stale for both OPEN cases.** Neither was "genuinely never driven": I02 held a real BLOCKED verdict whose named blocker (floating-tab-bar occlusion) **had already been fixed in source on 2026-09-06** (`0a104881`), and B05 is product-deferred out-of-scope per the guide. Had this round been scoped on the premise, it would have "discovered" a fix that landed 12 days ago and re-driven a case the guide forbids running.
2. **[MED — design system] `NotificationSetup` is off-brand wholesale**, including a **37 pt** primary target (below the 44 pt minimum) rendered as borderless text instead of the primary pill. Same class as the earlier Discover/ManageKidsClub findings; this screen had not been audited since the pill-occlusion report.
3. **[MED — copy accuracy] One iOS push-error string serves four unrelated causes**, so a simulator/Expo-Go user is told to check *permissions* — the guide's own I02 example demands device-specific guidance. (Driven live; rewrite supplied.)
4. **[MED — LOCATOR GAP] `NotificationSetup`'s CTAs have no `testID`**; the tap had to be tree-coordinate-derived. Class: BP-53.
5. **[MED — data/UX integrity] G05's recall notification is structurally unproducible**: 0 producers, 0 rows, and the client's `safety`-category red-icon fallback cannot fire because `notification_category` has **no `safety` value**. The guide's expected red "Safety Alert" therefore cannot be observed; the shipped name is "Safety Alerts" (doc-drift resolved).
6. **[LOW–MED — gate precision] G08 remains infra/fixture-gated** (`GOOGLE_VISION_API_KEY` + a triggering image fixture), not code-gated — re-confirmed from source so it stops being re-investigated.
7. **[LOW — evidence quality] D02's permission-denied limb is now genuinely driven and copy-exact**, upgrading a previously "device-only" claim to on-device evidence; only the physical-camera capture remains.
**App State Left Behind:** Simulator/app left **running as `test-free`, logged in**, parked on the ID Verification screen. **Camera TCC reset to default** (`simctl privacy reset camera`) after the induced denial. **No fixture consumed** — no ID request was submitted (Submit never tapped; test-free still has 0 `id_badge_verification_requests` rows), **no `push_tokens` row written** (verified 0), **no `admin_config`/`sp_config` writes**, **no QA toggles armed**, no cart/trade/offer mutations. Pre-existing state deliberately untouched: `test-seller` still holds pending ID request `28846a18`. Metro `:8082` (not mine) left running; the leftover Playwright `test-server` left as found. Evidence (7 screenshots) is committed to the run folder only.
**Why It Matters:** MSG was the last board still claiming "open" work that did not exist. This round converts two stale headline verdicts into accurate ones — one into a real PASS with on-device evidence, one into an honest NOT-SUPPORTED — and re-bases all four PARTIALs on **current-build** evidence with each remaining limb named individually. The practical result: MSG's remaining work is now exactly **three precisely-scoped, clearly-attributed gaps** (I01 success = physical device; D02 capture = physical device; G05 = product decision; G08 = provider credential + fixture) instead of a mixture of stale blockers, and the tracker no longer hides a product-deferred case behind "OPEN". It also surfaces that a screen reachable by every new user (*Enable Notifications*) is off the brand palette with a sub-minimum touch target — a user-facing compliance gap that had been masked by the older, narrower "CTA is occluded" report.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-msg-round1-2026-09-18/` (`report.md`, `ledger.md`, `screenshots/`).
- *I02 (PASS):* cold-reload the app → `xcrun simctl openurl booted "p2pkidsmarketplace://notification-setup"` → confirm the floating tab bar is **absent** from `mobile_list_elements_on_screen` and `Enable Notifications` sits at y=868 → tap its tree center → expect `⚠️ Could not obtain push notification token…` + no crash; then `SELECT count(*) FROM push_tokens pt JOIN profiles p ON p.user_id=pt.user_id WHERE p.email='test-free@kidsmarketplace.test'` → **0**.
- *D02 permission leg:* `xcrun simctl privacy booted revoke camera com.sameralzubaidi.p2pmarketplace` → relaunch → `xcrun simctl openurl booted "p2pkidsmarketplace://id-verification-upload"` → tap `Use Camera` → expect the `Permission Required` alert → **`xcrun simctl privacy booted reset camera …` afterwards**.
- *NotificationSetup palette:* re-measure with `npm run qa:badge-scan -- --img screenshots/I02-03-error-state-FULLRES.png --region 60,1221,1200,249 --token OFFBRAND_ERRBG,rmax=255,rmin=253,gmin=233,gmax=237,bmin=236,bmax=240 --token CANON_ERRBG_FFF0F2,rmin=253,rmax=255,gmin=239,gmax=241,bmin=241,bmax=243` → expect ~92% vs ~0%.
- *B05:* `SELECT count(*) FROM user_notifications WHERE type='leaderboard_rank_up'` → **0**; `grep -n "Leaderboard intentionally NOT added" src/navigation/AppNavigator.tsx`.
**Known Gaps / Not Tested:** (1) **I01 success leg** — needs a physical device (`registerForPushNotifications` returns null when `!Device.isDevice`); "Setting up notifications…" transient not capturable on this path (<1 poll). (2) **D02 capture-success leg** — needs real camera hardware. (3) **G08 behavioural AI-moderation leg** — needs `GOOGLE_VISION_API_KEY` provider reachability + a fixture that reliably triggers moderation (does not exist). (4) **G05 notification leg** — no producer exists; product decision required. (5) **B05** — deliberately not run (product-deferred). (6) **Deliberate persona deviation:** the guide's `new-user` actor was not used — `test-free` (standing persona) was used for both push and ID legs. Justification: neither leg is onboarding-dependent, the push screen is a root-stack route reachable by any authenticated user, and I01/I02's own 2026-09-04 execution also used a standing persona; creating a throwaway would have added a full signup cycle for zero discriminating value. (7) The `Expo-Go`-literalenvironment and `web` were not exercised (not available in iOS-only scope / out of scope) — the identical rendering path is source-proven instead. (8) PASS-row reconciliation was done against the tracker's Notes cells **plus** every MSG source run's `report.md` negative-verdict sweep — it did **not** re-open all 20+ source run reports line-by-line.
**What Needs To Be Fixed Next:**
1. **Fix:** `NotificationSetup`'s palette — remap every hardcoded hex to `theme/colors.ts` tokens (`#333`→`#1A1A1A`, `#666`/`#555`→`#6B6B6B`, error fill `#FFEBEE`→`error[100] #FFF0F2`, success text `#2E7D32`/`#558B2F`→`success[500] #5DBB8E`, info box `#F5F5F5`→`neutral[50] #F7F7F7`, divider `#EEE`→`#E0E0E0`).
2. **Fix:** `NotificationSetup`'s CTA — replace the RN `<Button>` with the design-system primary pill (`#5DBB8E` fill, white 16px semibold, ≥48 px tall, pill radius); this also clears the **37 pt < 44 pt** touch-target violation.
3. **Fix:** `registerForPushNotifications()` — return a discriminated reason and render cause-specific copy, so the not-a-physical-device / Expo-Go cases stop telling users to check permissions (rewrite in §4.2).
4. **Fix:** add `testID` + `accessible`/`accessibilityRole` to `NotificationSetup`'s "Enable Notifications" and "Maybe Later" buttons (BP-53 locator class).
5. **Fix (low):** `IDVerificationUploadScreen`'s three off-token hexes — `#EF4444`→`error[500]`, `#B45309`→`warning[800] #92400E`, `#F3F4F6`→`neutral[200]`.
6. **Fix (Android-only, low):** `notifications.ts` Android channel `lightColor: '#4CAF50'`→`#5DBB8E`.
7. **Product decision:** G05 — either add `safety` to `notification_category` + a recall-alert producer, or formally reword MSG-TC-G05 (client red-icon support already exists).
8. **Fix (docs/tracker):** MSG guide doc-drift ("Recall Alert"→"Safety Alerts"; D02 dialog label; D01 disclaimer copy) and the F04/F07 `Android`-column parse shape.
**UX Enhancement Ideas (optional, not defects):**
- On `NotificationSetup`, the push-permission screen offers no way to see *why* it failed beyond a generic line — consider surfacing an "Open Settings" affordance when the cause is a denied OS permission, to save a manual Settings hunt.
- On `NotificationSetup`, ~300 pt of empty space separates the Privacy box from the CTA — consider anchoring the benefit list/Privacy box proportionally so the action feels connected to the content.
- On ID Verification, `Use Camera` is shown even where no camera exists (simulator) — consider a small "or choose from your library" affordance on the same row to reduce dead ends when the camera path fails.
- On the ID Verification error state, "Failed to take photo" is terse — consider appending "Please try again, or upload a photo from your library" so the user has an immediate next step.
**Suggested Next Session:** One focused **physical-device batch** to close MSG's last two hardware-gated limbs together — `MSG-TC-I01` success leg (push token registration → `✅ Notifications enabled!` → local notification) and `MSG-TC-D02` capture-success leg (real camera capture → preview + `Change Image`) — since both need the same device and the same session, and both are currently the only thing standing between MSG and full closure. (Requires the pending product decision on G05/G08 to be worth folding in.)
**Suggested to Improve Agent Rules:** Add a **"blocker-freshness pre-check"** step to Step 0: for every `BLOCKED`/`STILL OPEN` row, grep the *named blocker's* source artefact (the file/setting the blocker cites) for the fix **before** planning the round — this round's entire scope hinged on discovering that `NotificationSetup` had been in `TAB_BAR_HIDDEN_ROUTES` since 2026-09-06, which was invisible from the tracker's Notes cell alone. A one-line, cheap check ("does the named blocker still exist in source?") would have made the round's true scope obvious in the first 5 minutes instead of after ~15 calls.

**Refinement (2), proposed:** record a `Physical-device-gated` marker convention for limbs that can never be closed on a simulator, so they stop being re-litigated and are batchable into a single device session (this round had exactly two such limbs, in two different cases, discovered separately).
