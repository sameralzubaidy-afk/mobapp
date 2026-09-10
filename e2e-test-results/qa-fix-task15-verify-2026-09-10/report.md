# FIX-Task-15 — targeted on-device verification round

**Date:** 2026-09-10 · **Mode:** QA Test Agent (execution-only; no code/test/seed/guide edits)
**Run folder:** `e2e-test-results/qa-fix-task15-verify-2026-09-10/`
**Scope:** V1–V7 verification of the FIX-Task-15 working-tree fixes (7 change points).

---

## 1. Environment & devices

| Item | Value |
|---|---|
| Android | `Medium_Phone_API_36.1` (device id used by the mobile toolset; adb serial `emulator-5554`), Android 16, expo-dev-client |
| iOS | **iPhone 17 Pro Max `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`** (see §6 substitution note) |
| Metro | `expo start --port 8081` (PID 68417) — verified alive in the R29 check |
| R29 busy check | clean — no `maestro`, no `run-suite`, no orchestrator |
| New bundle confirmed | Android `[ENTRY] registerRootComponent — App starting` + `[NAV] route: Landing`; iOS bootstrapped cold from the same Metro bundle |
| Android prep | `adb shell settings put secure stylus_handwriting_enabled 0` (R77 #2 standing step) |

**iOS device substitution (disclosed):** the brief named `iPhone 16 Pro E2E`
(`74209153-AB20-4414-A8A3-A5BF71FE7716`). That simulator **has the app installed but does not have the
mobile toolset's agent**, so every `mobile_*` call fails with
`Agent is not installed on the device`. The other booted simulator, iPhone 17 Pro Max, is the
toolset-drivable device and runs the **same Metro dev bundle**, so the iOS leg was executed there.
This is a harness limitation, not an app finding.

## 2. Fixtures (DB-verified before the run)

| Fixture | Value |
|---|---|
| in-progress, never-messaged trade | `120810ae-5cc0-40b9-8f47-5e7a25044902` (item `fb2bd393-3f3f-436d-80d9-9839d41f3ec3`, buyer test-buyer, seller test-seller, `auto_complete_at` 2026-09-13, **live_msg_count 0**, **1 `user_notifications` row**) |
| terminal trade (V1 regression leg) | `68c8d7c7-8ef1-4ea7-adad-933d9726529c` (cancelled) |
| tagged r41 fixtures at start | exactly 1 (`120810ae`) |

Deep links used: `p2pkidsmarketplace://chat/<tradeId>`, `://trade/timeline/<tradeId>`,
`://qa-scroll-to?testID=<id>`, `://qa-login-as?persona=test-buyer`, `://qa-logout`.

## 3. Verdicts

| Item | Android | iOS | Notes |
|---|---|---|---|
| **V1** ChatScreen false "trade ended" flash | **PASS** | **PASS** | 4 opens on the in-progress trade incl. the in-flight window + a cancelled-trade regression leg |
| **V2** `qa-scroll-to` fix | **FAIL (tooling)** | **PASS** | Android still does not scroll; iOS scrolls and reports usable coords |
| **V3** Notification glyph a11y label | **PASS** | **PASS** | emoji surfaces as the chip's label on both |
| **V4** Notification Center friendly error copy | **NOT REPRODUCED** | **NOT REPRODUCED** | staging 504 absent; every forcing route blocked (see §5) |
| **V5** Expanded safe-meetup clearance | **FAIL** | **FAIL** | reserved-space flag is inverted — extra padding applied when COLLAPSED, none when EXPANDED |
| **V6** No dev LogBox on normal badge refresh | **PASS** | **PASS** | no LogBox banner; zero Error-level JS console lines |
| **V7** Fixture reset cleans producer notifications | **PASS** | n/a | `cleared 1 user_notifications row(s)`, `1/1 removed` |

Roll-up: **4 PASS · 2 FAIL (V2 Android-only is 1 of them; V5 both) · 7 platform-legs PASS · 2 NOT REPRODUCED.**

---

## 4. Per-item evidence

### V1 — ChatScreen frozen-state gating (PASS, both platforms)

Source discriminator confirmed in tree: `ChatScreen.tsx:762` `chatFrozen = !tradeStatusUnknown && !isTradeActive`;
banner gated at `:847`; placeholder at `:986` = `Loading this chat…`.

**Android** — 4 opens of the never-messaged in-progress trade:
1. Deep link → pre-first-message safety modal (`safety-modal`, `safety-modal-confirm`) → dismissed. Post-state AX tree: **no `chat-frozen-banner`**; `message-input` present **not disabled**; `quick-reply-chip-today/-tomorrow/-suggest` rendered (chips only render when `trade.status === 'in_progress'` ⇒ status is KNOWN and active). OCR of the composer band: **`Type a message...`**.
2. Navigate away → re-fire: 3 consecutive rapid AX samples, all with **no banner** and the composer enabled.
3. Cold process (`terminate` → Dev-Launcher row → deep link cold start, `[ChatScreen] Mounting with tradeId: 120810ae-…`): **no banner**.
4. **In-flight window captured** (emulator network delayed with `adb emu network delay gprs` to widen the fetch): 3 consecutive samples showed `chat-header` at the **loading size 118** (vs 172 loaded), `message-input` **[disabled]**, **no `chat-frozen-banner`** — i.e. the pre-fix flash state is gone and the composer only asserts itself once the trade is known.
   *`adb emu network delay` was reset to `none` immediately after.*

**Android regression leg (cancelled trade):** `chat-frozen-banner` present with
`This chat is no longer active. The trade has ended.`; `message-input` **[disabled]**; OCR of the composer band = **`Chat is no longer active`**; image-picker / emoji / quick-replies all disabled.
Evidence: `screenshots/android-V1-chat-open1-loaded.png`, `android-V1-regression-cancelled-frozen.png`.

**iOS** — 3 opens of the same trade:
1. Deep link → safety modal → dismissed. AX: **no `chat-frozen-banner`**, `message-input` label = **`Type a message...`**, chips present, `chat-header` at the loaded height.
2. Cold process (terminate → launch → deep link): identical clean state.
3. Navigate away (timeline) → back to chat: identical clean state.
**iOS regression leg:** `chat-frozen-banner` + `message-input` label = **`Chat is no longer active`**.
Evidence: `screenshots/ios-V1-chat-open3-first-paint.png`.

### V2 — `qa-scroll-to` (Android FAIL/tooling · iOS PASS)

Fired from a verified top-of-scroll Trade Timeline on both platforms.

**Android — FAIL (TOOLING, not a product finding).**
```
W ReactNativeJS: measure cannot find view with tag #2338      (×5)
I ReactNativeJS: [QaScrollToDeepLink] RESULT message-button OUT_OF_VIEW NaN NaN
W ReactNativeJS: measure cannot find view with tag #3198      (×5)
I ReactNativeJS: [QaScrollToDeepLink] RESULT safe-meetup-toggle OUT_OF_VIEW NaN NaN
I ReactNativeJS: [QaScrollToDeepLink] RESULT no-such-button NOT_FOUND
```
Scroll-metrics line for the same screen:
```
[TradeTimeline][FIX-Task-13] scroll metrics { viewportHeight: 825.142822265625,
  contentHeight: 1691.8095703125, maxScrollOffset: 866.666748046875,
  pinnedFooterHeight: 84.952392578125, pinnedFooterReservedSpace: 216.952392578125,
  safeMeetupExpanded: true, safeMeetupHeight: 69.3333740234375,
  timelineBottomPadding: 286.2857666015625 }
```
- (a) **The view does NOT move.** Clean A/B: re-open timeline → screenshot → one fire → screenshot →
  `qa:image-diff` = **diff 11825 / 2592000 = 0.46% → MATCH**. (A second A/B after three fires: 0.47% → MATCH.) Both pre/post images are of the unchanged top of the timeline.
- (b) The RESULT line is **not** a bare success any more (the FIX-Task-15 false-positive is removed) but it is also **not** `RESULT <testID> <x> <y>` — it is `OUT_OF_VIEW NaN NaN`.
- (c) There is no usable `y`: the coordinates are literally `NaN` (iOS reports real numbers for the identical call).
- Negative control **passes**: `no-such-button` → `NOT_FOUND`.
- Diagnosis pointer for the dev fix: the `measureInWindow` calls on this Android/Fabric build fail
  (`measure cannot find view with tag <n>`; the callback then fires with `NaN`), so every attempt
  exhausts the bounded settle loop and resolves `out_of_view`. The first `measureLayout` (content
  offset) does settle, so the failure is specifically the viewport/child `measureInWindow`.
- Per the brief and playbook R94 this is reported as a **tooling failure, never a product defect**.

**iOS — PASS.**
```
I ReactNativeJS: [QaScrollToDeepLink] RESULT message-button 16 412
I ReactNativeJS: [QaScrollToDeepLink] RESULT safe-meetup-toggle 16 476
```
- (a) The view **moves**: before the fires the AX tree reported `message-button` at y1252 and
  `safe-meetup-toggle` at y1316 (below the fold, content coords); after, the same elements render at
  **y411** and **y475** — matching the reported coordinates exactly.
- (b) `RESULT <testID> <x> <y>` ✓, (c) the reported y is inside the ScrollView viewport
  (viewport height 829, y 412/476).
- Negative token (`NO_HANDLER`, fired post-logout with no screen registered):
  `[QaScrollToDeepLink] RESULT no-such-button NO_HANDLER`.
- iOS console was captured with the playbook §5.12 Hermes-CDP technique
  (`ios-console-capture.mjs` in this run folder — the unified iOS device log does NOT carry `console.*`,
  confirmed this round: a `process=PassItUp` device-log filter returns only CFNetwork/network noise).

### V3 — Notification glyph chip accessibility label (PASS, both platforms)

iOS (`label` = `name`): `StaticText label="🪀" name="notification-item-glyph-58445f51-…"`, and the same
for 🎨 🧸 🎮 🚲 ⚽ 🧩 📱.
Android: `TextView label="🪀" id="notification-item-glyph-58445f51-…"` etc.
**Row shape unchanged on both**: `trade_cancelled, unread: Trade Cancelled`,
`new_message, unread: New message from Test Seller`, `sp_refunded, unread: ✨ 6 SP Returned`,
`trade_completed, unread: Trade Complete! 🎉`.
Evidence: `screenshots/android-V3-notification-center-glyphs.png`, `ios-V3-notification-center.png`.

### V4 — Notification Center friendly error copy (NOT REPRODUCED)

The error branch (`NotificationCenterScreen.tsx:648-670`) renders `Something went wrong` +
`We couldn't load your notifications just now. Please check your connection and try again.` (typographic
apostrophe) + `retry-button`; the backend `error` string is never rendered.

Live reproduction was **not achieved**. Methods attempted, all blocked:
1. Normal fresh load (both platforms) — **loads successfully** (staging healthy); the 2026-09-09 Gateway
   Timeout did not recur.
2. Android airplane mode (`cmd connectivity airplane-mode enable`) — a **global `offline-screen`
   gate** ("No Internet Connection" / `offline-heading` / its own `retry-button`) takes over the entire
   app, so the Notification Center error state can never render. Observed twice (once with the NC
   already mounted).
3. Android dead HTTP proxy (`settings put global http_proxy 127.0.0.1:9`) — **inert** for this app
   (OkHttp caches its proxy selector; the NC still loaded normally). Reverted (`:0`).
4. A notification-specific failure toggle does not exist (grepped `devTestingService.ts` /
   `QaDevToggleDeepLinkHandler.tsx`); there is no `qa-dev-toggle` key for it.

Verdict is therefore reported as **NOT REPRODUCED** (a gap, not a PASS and not a FAIL). The copy itself is
source-verified and covered by two unit tests
(`src/__tests__/screens/NotificationCenterScreen.test.tsx:220`,
`src/screens/notifications/__tests__/NotificationCenterScreen.test.tsx:349`).

### V5 — Expanded safe-meetup card clearance (FAIL, both platforms)

The reserved-space flag is **inverted**, so the extra bottom padding is applied while the card is
**collapsed** and dropped while it is **expanded** — exactly when it is needed.

**Android** (collapsed = the default state; the toggle pill renders as `safe-meetup-toggle` /
"View safety tips"):
| State | safeMeetupExpanded | safeMeetupHeight | pinnedFooterReservedSpace | timelineBottomPadding |
|---|---|---|---|---|
| collapsed | **true** ← wrong | 69.33 | 216.95 | **286.29** = 216.95 + 69.33 |
| expanded | **false** ← wrong | 394.67 | 216.95 | **216.95** (base only, no extra) |

Raw collapsed line:
```
[TradeTimeline][FIX-Task-13] scroll metrics { … pinnedFooterReservedSpace: 216.952392578125,
  safeMeetupExpanded: true, safeMeetupHeight: 69.3333740234375,
  timelineBottomPadding: 286.2857666015625 }
```
Raw expanded line:
```
[TradeTimeline][FIX-Task-13] scroll metrics { … pinnedFooterReservedSpace: 216.952392578125,
  safeMeetupExpanded: false, safeMeetupHeight: 394.666748046875,
  timelineBottomPadding: 216.952392578125 }
```

**iOS** — same inversion, extracted via Hermes CDP (`VALUES` lines):
```
collapsed (default): viewportHeight=829 contentHeight=1701.666626 maxScrollOffset=872.666626
  pinnedFooterHeight=82.333313 pinnedFooterReservedSpace=224.333313
  safeMeetupExpanded=true safeMeetupHeight=66 timelineBottomPadding=290.333313
expanded (after tapping safe-meetup-toggle):
  viewportHeight=829 contentHeight=1994 maxScrollOffset=1165
  pinnedFooterReservedSpace=224.333313 safeMeetupExpanded=false safeMeetupHeight=390
  timelineBottomPadding=224.333313
```

**Root cause (source-confirmed, R12):** `SafeMeetupCard.tsx` publishes **collapsed** —
`onCollapsedChange?: (collapsed: boolean) => void` (line 64) called as `onCollapsedChange?.(collapsed)`
(line 87) with `const [collapsed, setCollapsed] = React.useState(true)` (line 73, tips collapsed by
default). `TradeTimelineScreen.tsx` wires it as `onCollapsedChange={setSafeMeetupExpanded}`
(~line 2245) and then treats that flag as "expanded":
`computeTimelineBottomPadding(...) => base + (params.safeMeetupExpanded ? params.safeMeetupHeight : 0)`
(line ~128). So the boolean means the opposite of its name in the padding formula.

**By eye (both platforms):** the expanded card's `safe-meetup-cta` initially renders **under the pinned
footer** (Android: cta y1963-2090 vs `confirm-trade-button` y1921-2106; iOS equivalent). It *can* be
brought clear with manual scrolling (Android cta reached y1291; iOS the same), so it is not permanently
occluded — but the one-piece-of-reserved-space the fix was meant to provide is absent while the card is
open. Screenshots: `android-V5-safe-meetup-EXPANDED.png`, `android-V5-expanded-CTA-clear.png`,
`ios-V5-expanded.png`.

### V6 — No dev LogBox on a normal background badge refresh (PASS, both platforms)

Android: navigation sweep Home → Discover → Trades → Home → Notification Center.
`adb logcat -d -s ReactNativeJS:E` = **empty** (no `console.error` at all). Full-frame OCR of the
post-sweep screen shows **no LogBox overlay**. The specific sites are `console.warn` in source
(`chat.ts:501` `[chat.getUnreadCount] Error:`, `:565` `[chat.getTotalUnreadMessageCount] Error:`,
`referralNotifications.ts:112/137` fallback-count paths).
iOS: same sweep with a Hermes-CDP capture filtered to
`LogBox|Fallback unread|getUnreadCount|getTotalUnreadMessageCount|ReferralNotifications` → **no matching
lines at all**; OCR of the final frame shows **no LogBox overlay**.
Evidence: `screenshots/android-V6-nav-sweep-no-logbox.png`, `ios-V6-nav-sweep.png`.
Caveat stated: the failure branches themselves were not force-triggered (healthy backend), so this
verifies the *normal-navigation* assertion the case asks for — which is exactly the reported LogBox case.

### V7 — Fixture reset cleans producer notifications (PASS)

```
[r41-in-progress-trade] buyer=test-buyer (49243010-…) seller=test-seller (14be337c-…) sub=reset
[r41-in-progress-trade]   ✔ cleared 1 user_notifications row(s) for 120810ae-5cc0-40b9-8f47-5e7a25044902
[r41-in-progress-trade]   ✔ deleted trade 120810ae-5cc0-40b9-8f47-5e7a25044902
[r41-in-progress-trade] ✅ reset complete: 1/1 tagged trade(s) removed
```
**N = 1 (≥ 1) ✓**, `1/1 removed` ✓, and **no `user_notifications cleanup warn`** ✓ (nor any other cleanup warn).
This matches the pre-run DB prediction exactly (the trade had 1 `user_notifications` row, written by the
`trade_request_notification` trigger). Post-reset read-only DB check:
`tagged_trades=0, leftover_notifs=0, fixture_item_rows=0, fixture_trade_rows=0`.

---

## 5. UX review (three layers)

**Structural / affordance**
- V2 (Android, tooling): the tail controls are all reachable by manual scroll once the timeline is scrolled
  down — `message-button` y974, `safe-meetup-toggle` y1142, `report-problem-button` y1323,
  `request-cancel-button` y1481, all clear of the pinned footer (y1921) and the tab bar (y2169+).
  This further disproves any "permanently occluded" reading of the tail band.
- V5 (both): the expanded card pushes its own CTA under the pinned footer; because the reserved space does
  not grow while expanded, the user must scroll further to reach `Got it — Let's Trade Safely`. Moderate.
- V1: with the fix, a first-time visitor to an active trade no longer sees a contradicting
  "The trade has ended." banner and a dead composer — this was a trust-damaging flash on a live trade.

**Wording / copy clarity**
- V1 frozen/loading copy reads well and is unambiguous: `Loading this chat…` (in-flight) →
  `Type a message...` (active) → `Chat is no longer active` (terminal), with the banner
  `This chat is no longer active. The trade has ended.` No raw/developer strings on any surface visited.
- V4 (source-verified only): `We couldn't load your notifications just now. Please check your connection
  and try again.` is correctly human, and the backend message is no longer rendered — no raw HTTP status
  or PostgREST code can leak through that branch.
- Minor copy note (pre-existing, not from this batch): the accessibility **labels** on the new tail
  controls read like identifiers — `safe-meetup-cta` → "Safe meetup cta", `report-problem-button` →
  "Report problem button". Screen readers would announce the literal "cta"/"button" words. Suggested
  rewrite: "Got it — close safety tips" and "Report a problem". (Found in the AX tree, not new.)

**Design-system compliance** — no deviations found on the screens visited for this round
(ChatScreen in both active and frozen states, TradeTimelineScreen collapsed + expanded, Notification
Center, Messages list, Home/Discover/Trades tabs). New elements are on-palette (primary `#5DBB8E`,
the frozen banner uses the amber `#92400E` warning icon on its tinted surface, filter/muted text tiers
unchanged). Scope note: this was a targeted fix-verification round against 7 change points, **not** a
full §6.4 line-by-line audit; the standing R62b off-brand-hex grep was not re-run this round.

---

## 6. Known gaps / not tested

- **V4 not live-verified** (see §4). The friendly copy + the absence of a raw backend string rest on
  source + unit tests; the on-device error state was unreachable because the app's global offline gate
  intercepts every network-failure route available to this toolset.
- **V2's `NOT_FOUND` negative token was verified live on Android only.** On iOS the equivalent negative
  (`NO_HANDLER`, no screen registered) was verified; re-firing `NOT_FOUND` on iOS was not possible after
  the V7 reset deleted the fixture trade. The registry/handler code path is platform-independent JS.
- **V6's failure branches were not force-triggered** (healthy backend); the assertion verified is the
  normal-navigation no-LogBox behaviour.
- **iOS leg ran on iPhone 17 Pro Max**, not the named iPhone 16 Pro E2E (toolset agent absent there).
- **Android `qa-scroll-to` still does not scroll** — left open as a tooling defect (R94), not a product defect.
- Perceived load times (§5.7) were not systematically stopwatch-captured this round; the one solid
  measurement was the Android TradeTimeline content layout ≈2.8s after `[NAV] route: TradeTimeline`
  (17:31:58.171 → 17:32:00.952, wall-clock, ±polling precision). All transitions observed rendered
  within the <3s ideal threshold.

## 7. What needs to be fixed next (dev-side, ranked)

1. **V5 — invert the safe-meetup expansion flag (both platforms).** `SafeMeetupCard` publishes
   *collapsed*; `TradeTimelineScreen` consumes it as *expanded*. Either rename the callback
   (`onExpandedChange` publishing `!collapsed`) or negate at the call site
   (`onCollapsedChange={(collapsed) => setSafeMeetupExpanded(!collapsed)}`), and keep the unit test in
   `TradeTimelineScreen.test.tsx:734-767` aligned with the corrected semantics. Currently the expanded
   card gets **zero** extra reserved space and the collapsed pill gets 66–69pt it doesn't need.
2. **V2 — Android `qa-scroll-to` still does not scroll.** The `animated:false` + viewport-clamp change
   removed the false-success (good) but the call now always resolves `OUT_OF_VIEW NaN NaN`, because
   `UIManager.measureInWindow(childNode|scrollNode, …)` fails on this build
   (`measure cannot find view with tag <n>` → `NaN` coords). Fix direction: measure via the component
   refs (`scrollViewRef.current.measureInWindow`, `childRef.current.measureInWindow`) instead of
   `UIManager.measureInWindow(nodeHandle)`, and guard against non-finite coordinates so a `NaN` can
   never be formatted into a RESULT line.
3. **V4 — make the Notification Center error state reachable for QA.** A session-local
   `qa-dev-toggle` key (e.g. `notifications_load_failure`) that makes `getUserNotifications()` fail the
   way a 504 does would make this copy assertable on demand instead of only when staging happens to break.

## 8. Suggested next session

Re-verify **V5** (inverted flag) and **V2-Android** once the dev follow-ups above land, using the same
fixture recipe (`npm run qa:r41-in-progress-trade -- create --with-auto-complete`), plus a first live
V4 attempt if the notification failure toggle is added.
