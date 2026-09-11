# QA Task — Android Item-1 Re-Verify + I02 Dismissal Persistence + 5c Visual Confirmation

**Date:** 2026-09-10 · **Platforms:** Android emulator `Medium_Phone_API_36.1` (Android 16, 1080×2400 px) + iOS simulator `iPhone 17 Pro Max` (3F3293A3…, iOS 26.1)
**Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` · **Cases:** TRD-TC-I02, TRD-TC-I05 (+ FIX-Task-13 item-1 Android leg, item-5c visual)
**HEAD:** working tree at session time (FIX-Task-13 landed). Metro `expo start --port 8081` (started this session — the concurrent suite run had stopped it).
**Fixture:** `npm run qa:r41-in-progress-trade -- create --with-auto-complete` → trade `b2413c54-a640-410b-a7be-b006ba88e6e6`, item `04affa3a-ce87-417c-b8de-92ad849ccbb1` (buyer test-buyer / seller test-seller). **DELETED at session end** (`-- reset`, 1/1 removed).

## Verdict roll-up

| Item | Verdict | Evidence |
|---|---|---|
| **Part 0** — Android trade-fetch stall precondition | **PASS (stall NOT reproduced)** | Cold dev-client reload → deep link → timeline rendered the fixture trade immediately (`android-P0-timeline-rendered.png`) |
| **Part 1 — Android Item-1 scroll-to-tool leg** | **FAIL (on Android)** | 3 fires, view stayed at top; handler logged coords outside the viewport |
| **Part 1 — Android Item-1 manual-swipe leg** | **PASS** | 3 finger swipes → `message-button` y1156–1282, `safe-meetup-toggle` y1324–1474, `report-problem-button` y1505–1631, `request-cancel-button` y1663–1789, all above the pinned footer y1921–2106 |
| **Part 1 item 3** — Message Seller reachable + opens Chat | **PASS** | `message-button` tap → Chat screen (safety modal → composer) |
| **Part 1 item 4** — "Trade Smart, Trade Safe · Tips" reachable + expands | **PASS** | toggle tap → `safe-meetup-card` + `safe-meetup-tips` (4 tips) + `safe-meetup-cta` |
| **Part 1 item 5** — manual swipe reaches them | **PASS** | see manual-swipe leg |
| **Part 1 item 6** — footer / Payment Details / tab bar spacing | **PASS (no overlap)** | content ends y1789 → footer y1921 (132 px clear) → tab bar y2190 (84 px clear); Payment Details + tax preview y477–1051 fully visible |
| **Part 1 item 7** — fixture cleanup | **PASS** | reset deleted the trade; DB read-back: item 0 / trade 0 / messages 0 rows |
| **TRD-TC-I05** (positive leg, Android) | **PASS** | chat composer ENABLED + `quick-replies-toggle` ENABLED + chips `-today`/`-tomorrow`/`-suggest` |
| **Part 2 — I02 dismissal persistence (iOS)** | **PASS** | expand → cta collapse → away + return ⇒ still collapsed |
| **Part 3 — 5c notification emoji chip (visual)** | **PASS** | 🧸 LEGO row · 🎮 Nintendo Switch row · 🚲 Kids Bicycle row · fallback glyph · no chip on non-item rows |

**Platform totals: 2 PASS guidance flips (I02, I05) · 1 tooling FAIL (Android `qa-scroll-to`) · 5 new findings (1 MEDIUM, 4 LOW).**

### ⚠️ ADDENDUM (same day, later build — DESK-OBSERVED, not a device drive by this round)

While this report was being finalised, a **FIX-Task-15** change-set landed in the working tree (`git status` shows `M` on `QaScrollToDeepLinkHandler.tsx`, `qaScrollRegistry.ts`, `TradeTimelineScreen.tsx`, `ChatScreen.tsx`, `NotificationCenterScreen.tsx`, `services/chat.ts`, `SafeMeetupCard.tsx`, `scripts/qa/r41-in-progress-trade.mjs` + their tests, the guide and the tracker), and a **FIX-Task-15 verification run is in flight** (`e2e-test-results/qa-fix-task15-verify-2026-09-10/` contains only `screenshots/` at the time of writing, and the Metro log shows live Android driving of other trades). **No device interaction was performed for this addendum** (R29 — that round owns the emulator); the observations below are read from the Metro log + source, and the *authoritative* verdicts for the new build belong to that round, not to this one.

1. **Findings 1–7 of this report all have fixes in the working tree.** Source-verified labels: `QaScrollToDeepLinkHandler.tsx` — *"FIX-Task-15 item 2 (2026-09-10): OUT_OF_VIEW was added after the Android no-op"*; `trade/TradeTimelineScreen.tsx` — `computeTimelineBottomPadding({ …, safeMeetupExpanded, safeMeetupHeight })` (*"FIX-Task-15 item 7"*), whose new metrics fields (`safeMeetupExpanded` / `safeMeetupHeight` / `timelineBottomPadding`) are visible in the live log; `ChatScreen.tsx`, `NotificationCenterScreen.tsx`, `services/chat.ts`, `SafeMeetupCard.tsx` and `scripts/qa/r41-in-progress-trade.mjs` are all modified (findings 2, 4/5, 6, DOC-DRIFT, 3 respectively).
2. **The `qa-scroll-to` Android no-scroll STILL reproduces on the new build — what changed is that it now fails HONESTLY.** Live log lines from that build:
   ```
   WARN  measure cannot find view with tag #2338   (×5)
   LOG   [QaScrollToDeepLink] RESULT message-button OUT_OF_VIEW NaN NaN
   WARN  measure cannot find view with tag #2792   (×5)
   LOG   [QaScrollToDeepLink] RESULT safe-meetup-toggle OUT_OF_VIEW NaN NaN
   WARN  measure cannot find view with tag #3198   (×5)
   LOG   [QaScrollToDeepLink] RESULT safe-meetup-toggle OUT_OF_VIEW NaN NaN
   ```
   Per the new source, `out_of_view` = *"the scroll was issued but the element is still outside the viewport"* and is documented as *"never a bare success"*. So: the scroll itself is still a no-op on Android, but the tool no longer emits plausible-but-wrong coordinates (this round's failure mode) — it now reports `OUT_OF_VIEW` with `NaN` coords plus `measure cannot find view with tag #N` warnings. **This round's FAIL verdict stands for the build it tested; the re-verification of the fix is FIX-Task-15's job.**
3. **Practically, for the next Android round:** read `OUT_OF_VIEW` / `NaN` / `measure cannot find view with tag` as *"tool could not scroll — use the manual swipe"* (never as an app-side element-occlusion finding), and keep §5.75 R94 point 4/5 in force.
4. Tracker rows/baseline for this round are **unchanged** by this addendum (I02/I05 PASS both platforms stands; the Android reachability evidence is the manual-swipe leg, which the tool change does not affect).
5. **Cross-round confirmation (read-only, from that round's published report at the time of writing):** `qa-fix-task15-verify-2026-09-10/report.md` independently returns **V2 `qa-scroll-to` = FAIL (tooling)** on Android — *"Android still does not scroll; iOS scrolls and reports usable coords"* — reproduces the same `RESULT <id> OUT_OF_VIEW NaN NaN` lines, records that the false-positive is removed but the call now always resolves `out_of_view`, and explicitly files it as *"a tooling defect (R94), not a product defect"*. So this round's tool-leg verdict is **confirmed on the fixed build by an independent round, and the newly codified R94 rule is already in use.** No interaction with this round's I02/I05 verdicts (Android reachability rests on the manual-swipe leg).

---

## 1. Part 0 — Android trade-fetch precondition (R29 check first)

**R29 busy check:** an in-flight `run-suite.sh --group D --platform both` (pid 18156, started 16:30 local) was driving `iPhone 16 Pro E2E` via Maestro with `--platform both` pending → would have taken `emulator-5554`. Its screenshots folder was still empty after ~14 min (the known Group-D-on-dev-client hang). Owner directed that the run be stopped; verified via `pgrep` that `run-suite.sh`/`maestro.cli` were gone before touching any device. Metro (8081) had also stopped with it and was restarted (`npx expo start --port 8081`).

**Standing Android session step applied:** `adb shell settings put secure stylus_handwriting_enabled 0` (R77 #2 permanent fix).

**Cold reload:** `mobile_launch_app` → Expo Dev Launcher home → tapped the `http://10.0.2.2:8081` row → bundle loaded (observed "Bundling 79.0%…" → Home).

**Stall probe:** `qa-login-as?persona=test-buyer` → `trade/timeline/b2413c54-…` → the timeline rendered **immediately** with real data (status banner "In Progress", item card "QA InProgress Trade Fixture (2026-09-10)" · Buying · $25.00, the 3-step timeline, "What to do next" 1/2/3, pinned "I Got It — Complete Trade", "Confirm pickup — auto-completes in 72h").
**Perceived load time (simulator/emulator, wall-clock, ±polling-interval precision) — not a formal performance profile:** < 1 s (screenshot returned by the first poll).

→ **The FIX-Task-13 Android blocker does NOT reproduce.** The earlier "trade fetch never resolved" is therefore a one-off harness/environment artifact, not an Android data-fetch defect — consistent with the builder's recorded diagnosis.

## 2. Part 1 — Android Item-1 re-verify

### 2a. Initial state (top of scroll) — the elements are ABSENT from the tree
The first AX dump (top of scroll) lists the header, status banner, item card, stepper, `next-steps-card` (with `next-step-message-button` y1388), `next-steps-cta`, `auto-complete-banner` (y2095–2306, partly under the tab bar), `extension-toggle` (y2348, clipped) and `confirm-trade-button` (y1921–2106) — but **no `message-button`, `safe-meetup-toggle`, `report-problem-button`, `request-cancel-button`, and no `timeline-payment-tax-preview`**. Android's uiautomator dump omits nodes whose bounds fall outside the display, so this is "not rendered into the visible band", not "not mounted" (proven below).

### 2b. Live scroll metrics (the FIX-Task-13 diagnostic)
`[TradeTimeline][FIX-Task-13] scroll metrics` from logcat:
```
viewportHeight: 825.14   contentHeight: 1747.81   maxScrollOffset: 922.67
pinnedFooterHeight: 84.95   pinnedFooterReservedSpace: 216.95     (dp)
```
→ the timeline scroll range on Android is **~923 dp**, i.e. ~2.4 screen-heights. The earlier round's recorded figure (~105 pt / "tiny range") does not hold for a fixture with the full "What to do next" card; that difference alone explains why an earlier attempt that moved the content only slightly appeared to show "nothing".

### 2c. `qa-scroll-to` tool leg — **FAIL on Android**
`adb … -d "p2pkidsmarketplace://qa-scroll-to?testID=message-button"` (and `=safe-meetup-toggle`), fired from a verified top-of-scroll state:

| Fire | Handler log line | Observed result |
|---|---|---|
| 1 | `[QaScrollToDeepLink] RESULT message-button 16 1214` | view unchanged (top) — screenshot |
| 2 | `RESULT safe-meetup-toggle 16 1116` | (confounded by a pull-to-refresh) |
| 3 | `RESULT message-button 16 1214` | view unchanged (top) — screenshot `android-P1-scrollto-message-button-result.png` |
| 4 | `RESULT safe-meetup-toggle 16 1278` | view unchanged (top) — screenshot `android-P1-scrollto-safe-meetup-result.png` |

Interpretation: the deep link is delivered, `QaScrollToDeepLinkHandler` runs, the screen's registry resolves the testID to a **mounted** ref (a `NOT_FOUND`/`NO_HANDLER` result is explicitly NOT what was logged), and it logs window coords — **but the ScrollView never moves**, and the reported y (1116–1278 dp) is **outside the 825 dp viewport**, so the coords cannot be used for a tap either. Practical consequence: on Android the tool neither scrolls nor yields a usable tap target.

**Cross-platform control (`ios`):** the same link fired once on the iPhone 17 Pro Max **did** scroll the view from the top to the tail band in one call — so the tool works on iOS and the Android behaviour is platform-specific (mechanism not fully isolated; the one-frame `requestAnimationFrame` measurement after an `animated: true` scroll is the prime suspect — see What Needs To Be Fixed Next).

### 2d. Manual finger-swipe leg — **PASS**
Three `mobile_swipe_on_screen` up-swipes (800 px, starting at y1700 over non-interactive card text per R77 #10) from the top. After the swipes the AX tree lists:

| Element | Android (px) | Clear of pinned footer (y1921–2106)? |
|---|---|---|
| `extension-toggle` ("Need more time?") | y254–404 | ✓ |
| Payment Details + `timeline-payment-tax-preview` ("Estimated Sales Tax $1.75", "Total: $26.75") | y477–1051 | ✓ |
| **`message-button`** ("Message Seller") | **y1156–1282** | ✓ |
| **`safe-meetup-toggle`** ("Trade Smart, Trade Safe · Tips ›") | **y1324–1474** | ✓ |
| `report-problem-button` | y1505–1631 | ✓ |
| `request-cancel-button` | y1663–1789 | ✓ |

→ **The "permanent occlusion" hypothesis is disproven on Android**: the siblings are reachable by ordinary scrolling, and the FIX-Task-13 reserved bottom space keeps the tail clear of the pinned footer.

### 2e. Item 3 — Message Seller opens Chat (**PASS**)
`message-button` tap (540, 1219) → **Chat** screen for the correct trade (`chat-header` "Test Seller" / "QA InProgress Trade Fixture (2026-09-10)"; `trade-banner` "… • $25.00"; `view-trade-link`). First-ever message on this thread → the pre-first-message safety modal (`safety-modal` → `safety-modal-confirm`) → dismissed.

### 2f. Item 4 — safety card reachable + expands (**PASS**)
`safe-meetup-toggle` tap (540, 1399) → `safe-meetup-card` (996×1004) with header "Trade Smart, Trade Safe" + "Smart traders meet where people are around", `safe-meetup-tips` with all 4 tips, and `safe-meetup-cta` "Got it — Let's Trade Safely" (`android-P1-safemeetup-expanded.png`). Tapping the CTA collapses it back to the toggle.

### 2g. Item 6 — footer / Payment Details / tab bar spacing (**PASS**)
Measured at max scroll: last content row `request-cancel-button` ends **y1789**; pinned `confirm-trade-button` **y1921–2106**; floating tab bar **y2190–2295**. Clearances: **content→footer 132 px**, **footer→tab bar 84 px**. Payment Details and the tax preview render above the footer with no overlap (`android-P1-maxscroll-tail-spacing.png`). No overlap regression of the class the earlier round feared.

*(Observation, not a defect: mid-scroll, the auto-complete banner and the expanded card's CTA pass beneath the floating tab bar — normal overlay scrolling; every element clears it at max scroll.)*

### 2h. I05 positive leg on Android (**PASS** — closes the last missing leg)
After dismissing `safety-modal-confirm`: `message-input` (enabled, placeholder "Type a message..."), `image-picker-button`, `emoji-button`, `quick-replies-toggle` (enabled) and the chips **`quick-reply-chip-today` ("📅 Available today"), `quick-reply-chip-tomorrow` ("📆 Available tomorrow"), `quick-reply-chip-suggest` ("🗓 Suggest times")** all render — 3 chips initially, matching the guide (`android-P1-i05-chat-active-chips.png`). "No messages yet / Start the conversation!" confirms a live (non-frozen) in-progress chat.

### 2i. New finding during 2e/2h — frozen-chat false state on first mount (**LOW–MEDIUM**)
The **first** chat open (the one that also raises the pre-first-message safety modal) rendered, behind the modal, the frozen state: banner **"This chat is no longer active. The trade has ended."** and the composer placeholder **"Chat is no longer active"** — for an **in_progress** trade. Root cause (source-verified, not guessed):
- `ChatScreen.tsx` **L756**: `const isTradeActive = trade?.status === 'pending' || trade?.status === 'in_progress';` → `false` while `trade` is still `null` on the first render;
- the frozen banner (L839-844) and the placeholder (L975) are **not** gated on `loadingTrade`, although the header *does* render a spinner while loading.
Re-entry (trade already cached) did not reproduce it. Impact: a buyer can see an alarming, factually wrong "the trade has ended" message for a moment on first open.

### 2j. Item 7 — cleanup (**PASS**)
`npm run qa:r41-in-progress-trade -- reset` → `1/1 tagged trade(s) removed`. DB read-back: fixture item **0**, trade **0**, messages **0** rows. (Fixture-producer notifications are NOT cleaned by the script: 1 `trade_request` row to test-seller was created by this round and remains unread — see App State Left Behind.)

## 3. Part 2 — I02 dismissal persistence (iOS) (**PASS**, with a DOC-DRIFT caveat)

Same fixture trade, iPhone 17 Pro Max, persona test-buyer, `trade/timeline/b2413c54-…`.

1. Timeline opened; two swipes; iOS AX tree shows **exactly the FIX-Task-13 recorded viewport coords**: `message-button` y477–525, `safe-meetup-toggle` y541–595, `report-problem-button` y607–655, `request-cancel-button` y667–715, pinned `confirm-trade-button` y766–834, tab row y868+ (reproduces the earlier iOS measurement).
2. `safe-meetup-toggle` tap → `safe-meetup-card` (408×378) + `safe-meetup-tips` (4 tips) + `safe-meetup-cta` at y528 — **expanded** (`ios-P2-safemeetup-expanded.png`).
3. `safe-meetup-cta` tap → collapsed back to `safe-meetup-toggle` (y541–595).
4. **Navigate away** (`back-button` → timeline popped) → **re-open the same trade** (deep link) → the tree contains `safe-meetup-toggle` and **no `safe-meetup-card`** → **the collapsed state persisted** (not reset). ✔ the asked behaviour.

**DOC-DRIFT caveat (recorded, not a failure of the asked behaviour):** the shipped component starts collapsed for every trade and only ever persists `true` (`SafeMeetupCard.tsx` L66 `useState(true)`, L70-80 `AsyncStorage.getItem` → only ever `setCollapsed(true)`, `dismiss()` writes `'true'`). Therefore (a) the dismissal "persistence" is behaviourally indistinguishable from the default state, and (b) the guide's assertion that a *different* in-progress trade shows the card **expanded** is structurally unachievable in this build. Expansion is never persisted — source-verified (no code path writes `false`).

## 4. Part 3 — 5c notification emoji chip, visual confirmation (iOS) (**PASS**)

Existing real rows (no synthetic data needed; read-only DB pre-check selected the persona): test-buyer's Notification Center contains `trade_cancelled` / `pickup_reminder_2` / `trade_completed` / `ac_reminder_*` rows carrying `data.item_title` / `data.listing_title`.

1. First load hit a staging error state — **"Something went wrong / Gateway Timeout"** + `retry-button`; retry loaded the list.
2. Structural pre-check: `notification-item-glyph-<id>` (28×28) nodes are present on every item-bearing row and **absent** on `new_message` / `offer_accepted` / `sp_spent` / `sp_refunded` rows (the documented omit-when-not-an-item behaviour).
3. **Visual confirmation** (`ios-P3-notification-emoji-chips.png`), matching `notificationItemGlyph.ts`'s keyword map:
   - "Trade Cancelled — The trade for **"LEGO Star Wars Set"** has been cancelled." → **🧸** (matches `/\b(lego|blocks?|plush|teddy|doll|action figure)\b/i`)
   - "…**"Nintendo Switch Games Bundle"**…" → **🎮**
   - "…**"Kids Bicycle - 20 inch"**…" → **🚲**
   - "…**"QA Bundle Fixture 1 of 1 (2026-09-02)"**…" → a deterministic **fallback** glyph (no keyword match)
   - "New message from Test Seller" → **no chip**
   → **5c is now visually confirmed on a real notification row (unit-test-only status closed).**

## 5. UX review

### 5a. Structural / affordance
- Timeline: the pinned "I Got It — Complete Trade" footer never overlaps content at max scroll; the floating tab bar keeps a 84 px gap from it. **No deviation.**
- Chat: composer + chips are enabled (correct for in-progress); the header shows a spinner while the trade loads. **However** the frozen-chat copy is not gated on that loading state (finding 2i).
- Notification Center error state: clear "Something went wrong" + a **Retry** button (good recovery affordance), but it exposes a raw HTTP status (below).
- Expanded safety card: its CTA can sit under the floating tab bar mid-scroll on both platforms (finding 4) — still reachable by scrolling further.

### 5b. Wording / copy clarity
- **DEVIATION (raw developer string):** Notification Center error state renders **"Gateway Timeout"** under "Something went wrong" — a raw HTTP status term shown to parents/kids (§6.3 class (c)). Concrete rewrite: subtitle **"We couldn't load your notifications just now. Please check your connection and try again."**, keeping the existing `Retry` button.
- **DEVIATION (misleading state copy):** the transient chat state says **"This chat is no longer active. The trade has ended."** on an *in-progress* trade (finding 2i). Recommended fix is structural (gate on `loadingTrade`); if a fallback string is kept for the unknown state it must not assert the trade ended — e.g. **"Loading this chat…"**.
- `ChatScreen` copy otherwise correct on both platforms.

### 5c. Design-system compliance (`docx/design-system-passitup.md`)
- **CONFIRMED — Trade Timeline (Android + iOS):** pinned CTA uses the documented primary green pill with white bold label; status banner/timer banner use the documented tokens; spacing consistent; back button canonical (`back-button`, 40×40, gray circle, icon-only).
- **CONFIRMED — Safe-meetup card (collapsed + expanded, both platforms):** white card surface, `#5DBB8E` accents/icons, pill CTA, 28–54 px targets ≥44 px.
- **CONFIRMED — Chat (Android):** pinned safety banner, chip row, composer icon row all use the documented tokens; chips are pill-shaped with adequate hit areas.
- **CONFIRMED — Notification Center (iOS):** rows use the documented unread/read fills; the new emoji chip is a 28×28 rounded chip that reads as a secondary affordance.
- **DEVIATION — Notification Center error state:** raw HTTP-status copy (above); otherwise the empty/error layout (icon + title + retry pill) matches the documented pattern.
- No off-brand hexes observed in any screenshot of this round; `qa:badge-scan`/OCR not required (no color-band assertion was in scope).

### 5d. Header/back-button check (every screen visited)
Trade Timeline (`back-button` ✓ canonical, title centered) · Chat (`back-button` ✓) · Notification Center (`back-button` ✓, "Mark all read" text action right-aligned). No deviation.

## 6. Locator-gap findings
- **`qa-scroll-to` on Android is a tooling gap** (section 2c) — flagged, with the manual-swipe fallback used.
- The emoji chip's inner **glyph Text is not AX-exposed** (only the `notification-item-glyph-<id>` container surfaces, with no text/emoji value) → the specific emoji cannot be asserted from the AX tree; screenshots are required. Recommend exposing the glyph as the chip's `accessibilityLabel` (e.g. `accessibilityLabel={itemGlyph}`).
- LogBox banner is not AX-exposed (expected for a dev overlay).

## 7. Friction vs the operating rules
- **R29 conflict resolved up front** (~7 calls of recon): a concurrent `run-suite.sh --group D --platform both` was holding both the iOS device and (pending) the emulator + the QA personas/staging state; waited, confirmed with the owner, verified release before driving.
- **Metro had been stopped with the suite** → the first dev-client connect failed with "Failed to connect to /10.0.2.2:8081"; restarted Metro and re-tapped the row (~3 calls).
- **Pull-to-refresh false positive:** two swipe-DOWN gestures on the timeline triggered the ScrollView's refresh ("Loading trade…" → reset to top), briefly confounding the scroll-to A/B. Realized and re-ran the A/B with no preceding swipe (~4 calls).
- **`qa:ax-tree` helper could not parse the session-resource file** — the resource is the tool's *rendered* text output, not raw JSON, so the helper errored. `grep -n -E` on the resource file was the working path (this is the §5.1 "grep the resource file" fallback). Also used for 3 large (10–26 KB) dumps.
- Otherwise within the rules: re-list before every tap, bbox centers only, evidence screenshot at every transition/dialog/final state, no TAB traversal, no inline shell (all analysis via `grep`/`npm run qa:*`-class calls).

## 8. Decision & outcome log (per-episode call tally)
| Episode | Calls | Outcome |
|---|---|---|
| Recon: memories/playbook/tracker/guide sources | ~18 | Full fact base; no device cost |
| R29 conflict + process ageing + user decision | 7 | Devices released before driving |
| Metro restart + Android cold load | 4 | Bundle up |
| Fixture create (desktop work in parallel with bundle build) | 1 | trade `b2413c54` |
| Part 0 stall probe (login + deep link + shot) | 4 | **Stall not reproduced** |
| Scroll-to tool A/B on Android (4 fires + shots + logs) | 9 | **FAIL on Android** |
| Manual swipes + tree reads (tail band map) | 5 | Siblings reachable |
| Expand / collapse / Chat / chips (Android) | 8 | Items 3,4 + I05 Android |
| iOS: launch, login, timeline, swipes, trees, expand/collapse, away+return | 16 | I02 persistence PASS |
| iOS: scroll-to control | 2 | Tool works on iOS |
| Part 3: notif center, error+retry, trees, screenshot | 6 | 5c visual PASS |
| Finding root-causes (source reads + logcat + SQL) | 7 | 2i/5c/2c explained, not guessed |
| Cleanup + residue SQL + logouts | 4 | 0 DB residue (1 notif row) |
| Tracker + report + ledger | ~10 | This document |
**Mined call ledger:** see `ledger.md` (exact tool-call count from the session transcript via `qa:mine-call-ledger`).

## 9. Design & Copy Compliance Confirmation (per screen/dialog)
- CONFIRMED — Trade Timeline (Android): layout, pinned CTA, spacing tokens match.
- CONFIRMED — Trade Timeline (iOS): same, coords reproduce the earlier round.
- CONFIRMED — Chat (Android): banner, chips, composer icons match; **DEVIATION** for the transient frozen-state copy (2i).
- CONFIRMED — Pre-first-message safety modal (`safety-modal`, Android): documented green pill CTA, 4 tips, correct copy.
- CONFIRMED — Safe-meetup card expanded/collapsed (both platforms).
- CONFIRMED — Notification Center (iOS): row tokens + emoji chip correct.
- DEVIATION — Notification Center error state (iOS): raw "Gateway Timeout" copy.
- CONFIRMED — Expo Dev Launcher (dev-only tooling screen, out of product scope).

## 10. What Needs To Be Fixed Next (ranked, dev-side)
1. **`qa-scroll-to` does not scroll on Android** (MEDIUM). Handler + ref resolution work (`RESULT … 16 1214`), the ScrollView never moves, and the returned coords exceed the viewport. Suggested: use `animated: false` (or await scroll-settle via `onMomentumScrollEnd`/`setTimeout`) before `measureInWindow`, and clamp/verify the result against the viewport before logging; or drive the scroll with `scrollToEnd`/`scrollTo({y})` on the measured content offset. Until fixed, Android rounds must use manual swipes (now documented).
2. **ChatScreen frozen-state flash on first mount** (LOW–MEDIUM, `ChatScreen.tsx` L756/L839-844/L975): gate the frozen banner/placeholder on `!loadingTrade` (or `trade != null`) so an in-progress trade never momentarily reads "The trade has ended."
3. **Fixture-producer notifications are not cleaned by `qa:r41-in-progress-trade -- reset`** (LOW): the fixture leaves one unread `trade_request` notification for the seller pointing at a deleted trade. Add a notification cleanup step to the reset path.
4. **Emoji chip glyph is not AX-exposed** (LOW): set the chip's `accessibilityLabel` to the glyph so the emoji is assertable without OCR.
5. **Notification Center error copy** (LOW): map raw HTTP-status phrases ("Gateway Timeout") to friendly copy.
6. **Dev LogBox noise** (LOW, dev-only): `console.error('[chat.getTotalUnreadMessageCount] Error:', …)` (`chat.ts:560`) fires on a normal background path — same class as the still-open FIX-2 item; downgrade to `console.warn`/guard in `__DEV__` paths.
7. **Safe-meetup expanded CTA clearance** (LOW): the expanded card does not account for the floating tab bar (both platforms); extend the measured footer/tab-bar reserved space to the expanded state.

## 11. Known Gaps / Not Tested
- The Android scroll-to failure's internal mechanism was not isolated to a single line (handler dispatch vs Fabric ScrollView semantics) — the *behaviour* is proven on 4 fires + an iOS control, the root cause is a hypothesis (item 1 above).
- I02's guide step 3 ("a different In Progress trade shows the card expanded") was **not driven** because it is structurally unachievable in the shipped design (source-verified; see the DOC-DRIFT note). A second in-progress fixture was therefore not built.
- The "expanded survives a round trip" discriminator was not device-driven (source proves no code path persists `false`); the *collapse* persistence asked for by the brief WAS device-verified.
- No admin-portal surface was needed for this task (no admin-dependent steps in Parts 0–3).
- No color-band/OCR assertions were in scope this round (no budget spent on `qa:badge-scan`).

## 12. App State Left Behind
- Fixture trade `b2413c54` + item `04affa3a`: **deleted** (DB-verified 0 rows); 0 messages created.
- **1 residual notification row:** `trade_request` (id `5a24e30e-d24b-4cf8-9aff-23c927eacecd`, unread) to **test-seller**, pointing at the now-deleted fixture item — harmless but not auto-cleaned.
- Device-local `AsyncStorage` key `safe_meetup_collapsed_<b2413c54>` = `true` on both devices (key is per-trade; the trade no longer exists).
- Both sessions **logged out** (`qa-logout` on Android + iOS). Metro 8081 left running. No config/toggle writes; no code, test, seed or guide files modified by the QA agent.

## 13. §8.3 QA Session Handoff
*(emitted verbatim in the agent's final chat reply — see the session close)*
