# Group P (Global Header, Floating Nav & Home Composer) — Full 19-Case Single-Session Run — Decision & Outcome Log

**Date:** 2026-08-23 · **Agent:** QA Test Agent · **Run dir:** `e2e-test-results/group-p-full-run-19-cases-2026-08-23/`
**Purpose of this file:** a full decision-and-outcome trace to be fed to an AI agent so it can identify the **bottlenecks, challenges, and reasoning patterns** the executing agent went through — every key action, the reasoning behind it, the tool calls that mattered, and the outcome. The final section derives (a) what slows execution, (b) patterns an agent should adopt proactively, and (c) what instrumentation/fixture work removes the friction.
**Reference report:** `report.md` (per-case verdicts, screenshots, UX review). This log is the *process* record; the report is the *result* record.
**Stress-test context:** this run deliberately executed all 19 cases in ONE session to calibrate whether per-case rigor holds at scale (ahead of a planned 100+ case run). Strain-monitoring notes are called out inline where they occurred.

---

## 0. Session environment

- **Device:** iPhone 17 Pro Max sim (iOS 26.1, Debug build + Metro `http://localhost:8081`), bundle `com.sameralzubaidi.p2pmarketplace`.
- **Toolset:** mobile-mcp (AX tree, tap, type, swipe, screenshot) + `xcrun simctl` (deep links) + `npm run qa:ocr` / `npm run qa:badge-scan` / `npm run qa:inspect-screen` (the §5.23 approved scripts) + Hermes CDP console capture + read-only `mcp_supabase_execute_sql` (user-approved for P18 only).
- **Key pre-existing session constraint discovered immediately:** `view_image` returned resource URIs, not pixels ("Cannot view … with view_image") → **visual tooling was broken this session** → deterministic OCR + `qa:badge-scan` pixel/color analysis (playbook §5.9) became the ONLY visual channel for the whole run. (Same constraint as the Phase 25 Group K run — a recurring environment fact worth remembering.)
- **Personas:** test-buyer (Kids Club+, primary), test-seller (used for one P03 message-fixture attempt). Standing fixtures confirmed in `scripts/seed-staging-data.ts` (`TestBuyer123!` / `TestSeller123!`).
- **App state at start:** Landing (logged out), clean.

---

## 1. Pre-execution (source + playbook audit) — the highest-leverage, lowest-cost phase

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 1.1 | Read operating playbook + persona registry + convention memories | `read_file` QA-Test-Agent.instructions.md (full); `memory view` qa-test-accounts, qa-test-agent, simulator-keyboard-suppression | Mandatory pre-run: canonical sources, standing personas, keyboard facts, dialog techniques. | Confirmed test-buyer/test-seller creds + node; keyboard is per-boot in-memory; §5.23 mandates the `qa:*` scripts for all pixel work (no ad-hoc ImageMagick this run). |
| 1.2 | Locate Group P cases in the canonical guide | `grep_search` "AUTH-TC-P0[1-9]\|AUTH-TC-P1[0-9]" + `read_file` Group P section (L1706–1960) | TC-ID disambiguation rule; read the named guide's P section. | P01–P19 scope + per-case `Actors`/`Steps`/`Expected Result`; **P18 actor = test-admin** (backend/analytics), P19 = AX identifiers. |
| 1.3 | Check flow-registry for the chrome flow | `grep_search` "FLOW-30" in `docs/flow-registry.md` | Guide says "See `docs/flow-registry.md` FLOW-30". | **Doc drift:** registry FLOW-30 = "SP Wallet Admin Operations", NOT the chrome. No dedicated flow entry for the header/pill/composer redesign. Flagged for later (registry/guide gap). |
| 1.4 | **Source-audit the new chrome before touching the device** | `read_file` AppHeader.tsx (main variant), PersistentTabBar/index.tsx (pill + TabItem + SellActionSheet + styles), ComposerBar.tsx, useTradesBadge.ts, DiscoverHeader.tsx | Chrome is a recent redesign; flow-registry pre-read + source-first discipline. | Confirmed: node chip = plain `View` (display-only, not tappable); header right cluster = bell→chat→avatar (no logout); pill = 5 tabs (Home/Discover/FAB/Trades/Basket), badges via `useTradesBadge` (active-only) + `useCartContext`; composer `+`/camera route to `ItemCreate` with `prefilledTitle` (+`initialPhotoSource='camera'`); **`composer_bar_tapped` wired ONLY to the bar's `onPress` (focusInput)**. |
| 1.5 | Note the AppHeader vs DiscoverHeader AX discrepancy pre-emptively | `read_file` DiscoverHeader.tsx (chat button ~L93) | P19 asserts header-chat AX; wanted to know why one header differs. | DiscoverHeader chat button has `accessible`+`accessibilityRole="button"`; **AppHeader's `renderBell`/`renderChat` have `accessibilityLabel`+`testID` but NO `accessible`+role** → predicted the Home chat button would not surface (BP-53). This prediction was confirmed on-device later. |
| 1.6 | Verify test-buyer's trade fixtures exist (read-only, no SQL needed) | (on-device, later) | P06–P08 need active/history trades; the prompt says check existing fixtures before creating data. | Home "Latest Trade" showed a PENDING "Kids Bicycle - 20 inch" → fixtures likely exist; verified on-device during P06. **No new trade fixtures created all run.** |

**Phase-1 lesson:** source-reading the new chrome (header, pill, composer) before any tap made P01–P05, P08, P15, P18, and P19 mostly *confirmations* rather than discoveries. The one pre-run prediction (Home chat not AX-exposed) was verified exactly as expected. **Conclude from code first, then confirm on-device** — same pattern that dominated the Phase 25 run.

---

## 2. Login as test-buyer (first of several)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 2.1 | Screenshot + list elements | `mobile_take_screenshot`; `mobile_list_elements_on_screen`; `npm run qa:ocr` | Establish clean starting state; OCR because view_image broken. | Landing (logged out) confirmed by OCR ("Pass It Up / Get Started / Log In"). |
| 2.2 | Tap Log In → fill email | `mobile_click_on_screen_at_coordinates` (220,721); `mobile_click` email (220,459); `mobile_type_keys` email | §5.1 re-list before tap; standard fill. | Login screen loaded fast (<1s). Email typed. |
| 2.3 | Re-list → tap password → type | re-list (fresh coords); `mobile_click` (202,474); `mobile_type_keys` password | **§5.2 re-list after keyboard shift** — the tree coords moved up ~90pt once the keyboard appeared. | Email confirmed + password confirmed (13 masked chars). Submit at (220,566). |
| 2.4 | Submit → poll Home | `mobile_click` (220,566); re-list | §5.3 poll. | **Home loaded ~1–2s.** Node chip "Norwalk Central", composer, pill nav present. Login OK. |

**Phase-2 lesson:** this first login went clean because I re-listed between fields. The SECOND login (P17) skipped a re-list and corrupted a field (see §9) — the exact trap §5.2 warns about.

---

## 3. P01–P05 · Header + floating nav (confirmations)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 3.1 | P01 — tap node chip | re-list; `mobile_click` (100,93); re-list | Chip is a `View` (source); verify no-op. | No modal/nav; tree unchanged. OCR full screen: "• Norwalk Central" (MapPin), **no caret/chevron**. **P01 PASS.** |
| 3.2 | P02 — verify right cluster order + no logout | re-list (tree); `npm run qa:badge-scan` on header band (red #E85D75) + x-strips (bell zone 840–1040px vs chat+avatar zone 1040–1260px) | Bell/chat not in AX tree (locator gap) → badge positions as proxy + source for order. | **2670 red px ALL in the bell zone (x 840–1040px), 0 in chat+avatar zone** → bell has the "99+" badge, chat has none (0 unread). Cluster order bell→chat→avatar confirmed via source + on-device positions. No logout icon (source + OCR). **P02 PASS** + locator gap flagged (AppHeader bell/chat not AX-exposed). |
| 3.3 | P03 — tap header chat | derived coordinate (360,94) — between bell badge x~293 and avatar x~400 | Chat not AX-exposed → **derive + flag** (locator-gap handling), don't silently guess. | Messages screen opened ("Messages" title, search field, empty state "No messages yet"). **Nav half verified; no unread badge (0 conversations).** Badge half deferred to a fixture attempt (see §8). |
| 3.4 | P04 — pill layout | re-list on Home/Messages/Trades/Discover/Basket; source styles read | Verify margins/order/raise from AX coords + source. | Pill spans x=16→424 (16pt margins), tab order Home/Discover/Sell/Trades/Basket, FAB raised (y 846 vs tabs 866). Source: `borderRadius.pill`, `shadows.level2`, `insets.bottom + spacing.sm`. **P04 PASS.** |
| 3.5 | P05 — no Inbox tab | re-list (tab set); OCR of pill band | Guide: Inbox removed; Messages via header only. | Exactly 5 tabs, no Inbox; header chat → Messages works. **P05 PASS.** |

**Phase-3 lessons:** (1) The AppHeader bell/chat AX gap forced *coordinate-derivation* for the chat icon — a BP-53 fix would remove this every run. (2) Badge-pixel-scanning (red #E85D75) turned an invisible AX state ("is there a badge on the chat?") into a provable number. (3) The **node chip correctly renders as a non-button StaticText** — the one place the design intentionally avoids a button role.

---

## 4. P06–P10 · Trades / Basket / FAB

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 4.1 | P06 — Trades tab → Active | `mobile_click` tab-trades (295,884); re-list; OCR | Verify Active list (item/counterpart/status). | "My Trades" → "YOUR OFFERS": 3 pending offers (Kids Bicycle / LEGO Star Wars Set / Nintendo Switch Bundle), each PENDING + "Buying Aug 18 · $45.00" + expiry + View Details. In Progress chip → "No trades in progress" empty state. **P06 PASS** (minor: list shows role "Buying", not counterpart NAME — noted). |
| 4.2 | P07 — History reverse-chronological | tap "History" (segmented control, NOT AX-exposed → OCR band-located at 330,233); OCR of `P07-trade-history.png` | History view; verify newest-first. | 10 `trade-history-row-*`: Kids Bicycle (Jul 3), LEGO (Jul 3), Nintendo Switch ×(Jul 3/Jul 2/Jul 1) — **all cancelled, reverse-chronological**. **P07 PASS.** |
| 4.3 | P08 — badge counts active only | `qa:badge-scan` on pill zones (Trades 756–1014px, Basket 1014–1272px); source `useTradesBadge.ts` | Guide wants complete/cancel then re-check; I chose the **stronger simultaneous proof**: 10 cancelled in history + 3 pending offers observable at once. | Trades zone 1993 red px (badge "3"), Basket zone 2001 px (badge "2"). **3 pending → badge 3; 10 cancelled NOT counted.** Source: active = any status NOT completed/cancelled. **P08 PASS.** (Judgment: did NOT cancel a fixture trade to avoid mutating shared state — the simultaneous evidence already demonstrates the rule.) |
| 4.4 | P09 — Basket badge + Home active | Basket tab; re-list (2 items, $25.00); back to Home; `qa:badge-scan` green #5DBB8E on Home tab zone | Verify badge count + active highlight. | Basket = 2 items → badge 2 ✓. Home tab zone = **2301 green px (#5DBB8E)** → active highlight ✓. **P09 PASS.** |
| 4.5 | P10 — FAB globally visible + Sell sheet | FAB present in AX tree on Home/Messages/Trades/Discover/Basket; tap FAB (220,874); re-list; OCR sheet | FAB is root-rendered (source) — verify on 5 screens + sheet content. | Sheet: "Sell" title + "List One Item" + "Bulk Upload" (OCR). **P10 PASS.** |
| 4.6 | Dismiss the Sell sheet | first Cancel tap (220,910) → MISSED (sheet stayed open); OCR bands narrowed Cancel to y≈867–887pt; instead tapped the **dim overlay (220,400)** which has `onClose` | One-miss-then-re-derive (§5.1); the overlay tap is a deterministic dismiss (source: `overlay` TouchableOpacity onPress=onClose). | Sheet dismissed; back on Home. **(Friction note:** Sell-sheet options + Cancel aren't AX-exposed; the overlay is a faster dismiss than chasing the Cancel band.) |

**Phase-4 lessons:** (1) The Active/History **segmented control is not AX-exposed** → OCR band-finding (another locator gap). (2) **Badge verification via red/green pixel zones is fast and deterministic** — no need to read the badge text. (3) Fixture preservation (P08) paid off: the same 3 pending + 10 cancelled fixtures served P06/P07/P08 with zero mutation.

---

## 5. P11–P16 · Home composer

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 5.1 | P11 — tap composer → focus + type | `mobile_click` (220,159); `mobile_type_keys` "Lego Star Wars Set"; OCR of bar | Guide: focus, type freely, no navigation. | Text landed in the bar (OCR "Lego Star Wars Set" + "+"), still on Home. **Software keyboard was NOT visually persistent during composer interaction** (login showed one earlier — per-boot keyboard state). Typing works regardless. **P11 PASS.** |
| 5.2 | P12 — "+" → New Item pre-filled Title | `mobile_click` composer-add (400,159); re-list; `mobile_click` `dev-add-test-photo` (220,438); grep tree for `title-input` value | Photo-first flow renders the form only after a photo; dev fixture bypasses the native picker. | New Item opened directly on Photos step (0/10, **no Sell sheet**) ✓. After photo: `title-input` value = **"Lego Star Wars Set"** ✓. **P12 PASS.** |
| 5.3 | P13 — empty submit → empty Title | back (40,94); OCR composer (cleared → placeholder back); `mobile_click` "+" (400,159); add photo; grep `title-input` | Verify no-regression empty path. | New Item (0/10); `title-input` has **no value** (empty). **P13 PASS.** |
| 5.4 | P14 — camera icon → straight to camera | back; type "Nintendo Switch"; `mobile_click` composer-camera (40,159); re-list | Camera icon passes `initialPhotoSource='camera'` (source). | New Item opened with camera intent → **auto-launch attempted, simulator has no camera** → friendly in-app "Error / Failed to add photos" dialog (GlobalAlertProvider, OK). Dismissed OK; added photo → `title-input` = **"Nintendo Switch"** (pre-filled preserved). **P14 PASS** with environment note (camera launch is a hardware limitation; graceful error path is the app behavior). |
| 5.5 | P15 — AI never overwrites pre-filled Title | `grep` + `read_file` ItemCreateScreen.tsx `handleApplyAllAI` (~685) + `handleApplyFieldAI('title')` (~730) | Dev photo fixture skips AI analysis → **source is the authoritative evidence** (§6.1 two-source: source guard + on-device persisted title). | `handleApplyAllAI`: title applied only if `!title && aiResult.title && !titlePrefilledFromComposerRef.current`; per-field Use: `if (titlePrefilledFromComposerRef.current) break;`. **Deterministic guard — never overwrites a composer-pre-filled title.** On-device title persisted. **P15 PASS** (AI-analysis path documented as not exercisable on simulator). |
| 5.6 | P16 — FAB sheet unchanged (parallel entry) | (reuse P10 evidence) + ComposerBar source | Composer routes only to single-item `ItemCreate`; Bulk Upload only via FAB sheet. | Confirmed. **P16 PASS.** |

**Phase-5 lessons:** (1) The **photo-first form gating** means Title pre-fill verification requires the `dev-add-test-photo` fixture every time — a one-tap cost, and without it the field doesn't even render. (2) The camera icon **always fires a submit** (not just a focus) — tapping it landed on the camera hitSlop and submitted. (3) P15 is the cleanest example of **source-verifying a deterministic guard** when the on-device path is blocked by environment (no camera/AI).

---

## 6. P17 · Logout from Profile + Settings (the first real strain point)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 6.1 | Profile → locate Logout row | `mobile_click` avatar (400,94); re-list; OCR; swipe up (twice) | Profile utility rows below "My Badges"; not AX-exposed (known Phase-22 gap) → OCR band-finding. | Profile shows Test Buyer, stats (116 LISTINGS / 5 TRADES / 46 SP), badges; utility rows (App Settings/Admin Dashboard/Help & Support/**Logout**) reached after scroll; **Logout row band y≈300–353pt**. |
| 6.2 | **STRAIN FLAG (retrospective):** locating the rows took repeated scroll + OCR bands; I noticed I was starting to reuse earlier row y-estimates instead of re-deriving per screenshot to keep pace. Did NOT pause to flag it live — a self-monitoring miss (report's stress-test section records it honestly). It did not change the verdict but compressed trace granularity for these steps. | | | |
| 6.3 | Tap Logout → confirm | `mobile_click` (220,325); re-list; screenshot; `qa:badge-scan` on confirm dialog buttons | Verify the Profile logout path + capture the confirm dialog (design-system check). | Dialog: "Logout / Are you sure you want to logout?" Cancel + Logout. Tapped Logout (302,523) → **Landing**. Profile path works. |
| 6.4 | Re-login test-buyer — **focus-misdirection corruption** | `mobile_click` email (220,459); type email; then `mobile_click` (202,567) for password **WITHOUT re-listing first** | I reused the pre-keyboard submit-row coordinate instead of re-listing after the email keyboard appeared. | **Email field ended up with `test-buyer@…testTestBuyer123!`** (password appended) and "Password is required". Per §5.2 (corrupted field) → **terminate + relaunch, never repair**. App relaunched to Landing (bundle load ~5–8s). |
| 6.5 | Re-login correctly (re-list discipline) | Login → email → **re-list** → password at fresh (202,474) → re-list → submit (220,566) | §5.2 re-list after every keyboard change. | Login clean (both fields confirmed). |
| 6.6 | Settings → Sign Out | avatar (400,94); scroll; tap App Settings (220,175); re-list; tap Sign Out (220,713); confirm (302,523) | Verify the Settings path (DANGER ZONE). | Settings screen (NOTIFICATIONS/ACCOUNT/LEGAL/DANGER ZONE) → Sign Out `settings-sign-out-button` (AX-exposed ✓) → confirm → **Landing**. **P17 PASS (both paths).** |

**Phase-6 lessons:** (1) The **corruption at 6.4 is the classic §5.2 trap** — skipping the between-field re-list on a keyboard-avoiding screen. Cost: terminate + relaunch + redo (~40s). This is the single most preventable time sink in login-heavy runs. (2) Profile utility rows remain a locator gap (BP-53) — they cost the P17 row-finding effort. (3) **Design observation:** the Logout/SignOut confirm primary button is **error-red #E85D75** (84% of button region by pixel scan), not brand green — a deliberate destructive-action styling, but undocumented in `design-system-passitup.md` (doc gap).

---

## 7. P18 · Composer analytics (the run's biggest tooling wall + the headline FAIL)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 7.1 | Attach Hermes CDP console capture | `curl -s http://localhost:8081/json` (find WS target); reused `cdp-capture.js` from the Phase 26 run dir (async, 60s window → `cdp-console-p18.log`) | §5.12 technique: capture `DEBUG [Analytics] Event tracked: …` lines live. | Target found (`…device=2051df57…&page=1`); capture started. |
| 7.2 | Fire the composer events while capturing | re-login test-buyer; tap composer (focus); type "QA P18 event test"; "+" (submit with text); back; "+" empty (submit empty) | Guide: `composer_bar_tapped` on focus, `composer_bar_submit` with has_text true/false. | Composer interactions routed correctly (New Item opened both times). |
| 7.3 | Read the capture | `cat` + `grep -iE "composer\|analytics\|Event tracked"` | Verify events appeared. | **Capture delivered only a REPLAY BURST of pre-capture nav events** (Landing→Login→Home→Profile→Settings→InboxTab→TradeList→ReviewOffer→ListingDetail→QaLogout→Login→Home, all at 14:49:59Z) then went quiet. **No composer lines.** → Fusebox console capture unreliable this session (tooling friction; NOT evidence the events didn't fire). |
| 7.4 | **Pivot to the authoritative channel — DB read** | asked the user for approval (per MCP protocol) for ONE read-only `analytics_events` SELECT; then `mcp_supabase_execute_sql` | The guide's assertion is "recorded" (persistence); the DB is the definitive source. CDP failed → don't burn cycles retrying it. | **Result:** `composer_bar_submit` rows present with correct `has_text`: {false} 14:50:36, {true} 14:50:19, {true} 14:38:16 (P12), {false} 14:37:32 (P13), {true} 14:36:40 (P14). **`composer_bar_tapped` → ZERO rows ever.** |
| 7.5 | Root-cause the missing tap event | `read_file` ComposerBar.tsx (again, focused on focusInput/onPress) + an **edge-tap experiment** | Hypothesis: `composer_bar_tapped` fires only from the bar's `onPress`, which is shadowed by children. | Tap at bar left edge (19,159) → **fired `composer_bar_submit` {has_text:false} (14:55:51)**, NOT `composer_bar_tapped` — the tap landed on the **camera button's hitSlop (x 16–64)**. Combined with the TextInput (native focus, no parent onPress) and "+" hitSlop, **the entire bar surface is consumed by children → the bar's onPress (and thus `composer_bar_tapped`) is unreachable by normal taps.** Re-query confirmed 0 tapped rows. **P18 FAIL.** |
| 7.6 | Dismiss the camera error dialog that 7.5 triggered | re-list; tap OK (220,523); back | The edge tap submitted with camera intent → simulator camera error again. | Dismissed; back on Home. |

**Phase-7 lessons (the biggest of the run):** (1) **CDP console capture is not a reliable verification channel** — the Fusebox attach delivered a replay burst of pre-capture nav events and then went silent, missing the actual composer lines. For analytics cases, the DB is the authoritative, deterministic channel (and the §8.3 "Suggested to Improve Agent Rules" note recommends making the DB the default). (2) The root cause was found by **combining source + a deliberate edge-tap experiment** — a 5-second tap proved the hitSlop shadowing that pure code-reading suggested. (3) The DB evidence was *stronger* than any console capture: 5 persisted submit events with exact has_text values spanning multiple earlier cases (P12–P14) proved the submit path end-to-end.

---

## 8. P03 · Unread-message fixture attempt (the run's highest-effort dead-end)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 8.1 | Check test-buyer's conversations | (P03 half, earlier) Messages = "No messages yet" | No conversations → no unread badge possible. | Confirmed empty. |
| 8.2 | Attempt fixture via test-seller | qa-logout; login test-seller; header chat (360,94) → Messages empty; Trades → Review Offer "Kids Bicycle" (**Expired**); ItemDetail "Test new tax 1" (**Seller Info Hidden — start a trade to see seller details**) | Guide: "send one from another account". | Every path to messaging is gated: Message button **hidden for pending/cancelled** (`TradeTimelineScreen.tsx` L1260: `trade.status !== 'cancelled' && trade.status !== 'pending'`); seller info hidden pre-trade. |
| 8.3 | Source-check for a dev message fixture | `grep` for `dev.*message\|conversation.*fixture\|dev-send-message` | Prompt: check for existing dev fixtures before creating data. | **No dev message fixture exists.** |
| 8.4 | Decision: create the fixture vs. report gap | reasoned trade-off: creating an unread message requires a full offer→accept flow (test-seller lists → test-buyer offers → accept → in_progress → message ≈ 6 account switches) AND mutates shared fixtures | Execution-only + fixture-preservation discipline; the prompt explicitly prefers existing fixtures. | **BLOCKED (fixture gap).** Navigation half PASS; unread-badge half not satisfiable without new fixture data. Recommended a dev fixture (in-progress trade + unread message between test-seller/test-buyer). |

**Phase-8 lesson:** this was the highest-effort dead-end (≈4 screens across 2 accounts). The **source read of the Message-button condition** (pending/cancelled → hidden) is what let me stop confidently instead of continuing to hunt. A standing conversation fixture would have made P03 a 30-second case.

---

## 9. P19 · Accessibility identifiers (mostly confirmations + one FAIL)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 9.1 | Verify `tab-trades` role/label | (all screen trees throughout the run) | Guide: button role + "Trades". | `tab-trades` = Button, label "Trades" (accessible+role+accessibilityState) on every screen ✓. |
| 9.2 | Verify node chip NOT a button | tree + source | Guide: "node chip is not announced as a button". | `header-node-chip` = StaticText "Norwalk Central", no role ✓. |
| 9.3 | Verify header chat "Messages" | Discover tree (header-chat-btn surfaced) vs Home tree (not surfaced) | Guide: label "Messages" (testID header-chat-btn). | **Discover: `header-chat-btn` = Button "Messages" ✓ (DiscoverHeader has accessible+role). Home/AppHeader: `header-chat-btn` NOT in AX tree ✗ (missing accessible+role).** — exactly the pre-run prediction (1.5). **P19 FAIL** (Home header chat AX gap, BP-53). |

**Phase-9 lesson:** the FAIL was predicted in pre-execution from a 30-line source read — **AX-exposure discrepancies are discoverable from source before any on-device time**, and on-device confirmation is quick. This is the pattern to repeat for every accessibility case.

---

## 10. Teardown & state

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 10.1 | Clear the LogBox overlay (camera-error dev log) | `mobile_terminate_app` + `mobile_launch_app` | §5.19 Rule 6: bounded attempts then terminate+relaunch; session persists. | Relaunch → Home restored (session persisted), LogBox gone. |
| 10.2 | Leave a clean state | `xcrun simctl openurl booted "p2pkidsmarketplace://qa-logout"` | §5.16: prefer the qa-logout deep link for teardown. | Landing (logged out). All sessions cleared. No accounts/listings/trades created or mutated; only P18 `composer_bar_submit` analytics rows added (harmless telemetry). |
| 10.3 | Write evidence + report + this log | `create_file` report.md + decision-outcome-log.md; `mobile_save_screenshot` ×18; `cdp-console-p18.log` | §5.20 evidence completeness; §8 reporting contract. | Full evidence set in `e2e-test-results/group-p-full-run-19-cases-2026-08-23/`. |

---

## 11. Cross-cutting process metrics (what actually consumed time)

| Stage | Est. share of run | Dominant cost |
|---|---|---|
| Pre-execution source audit (§1) | ~8% | grep/read — cheap, no device, high leverage |
| P01–P05 (header/nav) | ~15% | login + badge scans + chat coordinate derivation |
| P06–P10 (Trades/Basket/FAB) | ~20% | Trades/History OCR, badge zones, Sell-sheet dismiss friction |
| P11–P16 (composer) | ~20% | photo-fixture form rendering ×3, camera-error handling |
| **P17 (logout + re-login)** | ~12% | **one §5.2 corruption → terminate+relaunch+redo (~40s)**; Profile row OCR; two logout paths |
| **P18 (analytics)** | ~18% | CDP capture setup + failure → pivot to DB → root-cause edge tap |
| **P03 fixture attempt (§8)** | ~7% | multi-account, 4-screen dead-end |
| Teardown + report | ~5% | terminate/relaunch + qa-logout |

Total ≈ **50 minutes** of continuous on-device execution. Login/logout cycles (6 account sessions) + the two friction episodes (P17 corruption, P18 CDP) dominate the wall-clock; the per-case assertions themselves were mostly cheap.

---

## 12. Derivation A — what slows execution

1. **Repeated login/logout cycles (6 sessions).** Every case transition requiring a different persona or a fresh field state cost a login (~30–40s) or a terminate+relaunch (~8s + redo). The single §5.2 corruption cost an extra ~40s. A standing logged-in harness (or per-case session restore) would cut a large share of wall-clock in a 100+ run.
2. **CDP console capture unreliability for analytics (P18).** The Fusebox attach delivered a replay burst of *pre-capture* nav events and then went silent, missing the actual composer lines. Wasted one full capture cycle before pivoting to the DB. **For analytics cases the DB is the reliable channel** — CDP should be the fallback, not the default.
3. **AppHeader bell/chat AX gap (BP-53) — affects P02/P03/P19.** Home header chat/bell don't surface → derived-coordinate tap for chat + pixel-scan for badges every time. Discover's identical button DOES surface, so the fix is a 2-line prop addition.
4. **`view_image` unavailable (environment).** Every visual check went through OCR + `qa:badge-scan`. Deterministic and reliable, but slower than direct vision; and it biases toward pixel-color questions rather than holistic visual QA.
5. **Non-AX-exposed rows/controls** (Profile utility rows, Sell-sheet options, Active/History segmented control): each required OCR band-finding. Three separate BP-53-class gaps.
6. **Photo-first form gating (P12/P13/P14).** Title pre-fill can't be verified until a photo is added; the `dev-add-test-photo` fixture makes this one tap, but each composer case needs the form re-rendered.
7. **P03 dead-end.** No conversation fixture + Message button gated on in-progress trade → 4 screens across 2 accounts before concluding. A seeded conversation would make messaging cases trivial.
8. **LogBox accumulation from the camera-error path.** Each camera-icon tap on the simulator leaves a dev LogBox that eventually needs a terminate+relaunch to clear.

## 13. Derivation B — patterns an agent should adopt proactively

1. **Source-audit the redesigned UI before touching the device** (§1). Nearly every PASS was a confirmation of a pre-read source fact (chip not tappable, cluster order, badge semantics, AI guard, AX gaps). The single most valuable habit.
2. **Predict AX gaps from source, confirm on-device.** The Home-chat-not-exposed FAIL (P19) was predicted before login; on-device was a 2-second confirmation. §6.1 two-source corroboration at its best.
3. **Use pixel-zone scans (`qa:badge-scan`) for AX-invisible state** — red badge presence/position (P02, P08, P09), active-tab green (P09), destructive-button color (P17). Turns "can't see it in the tree" into a provable pixel count.
4. **Re-list after EVERY keyboard state change** (§5.2). The one time I skipped it (P17 re-login) I corrupted a field and paid a relaunch. This is the #1 preventable time sink.
5. **Prefer the DB for analytics assertions** and ask for the single read upfront rather than spending a CDP cycle first.
6. **Fail fast on fixture dead-ends** (P03): once the source showed the Message button is pending/cancelled-gated, stop exploring and report the gap + fixture recommendation. Don't "keep hunting for a path that can't exist".
7. **Reuse existing fixtures and preserve them** (P06–P08): the 3-pending/10-cancelled fixture set served three cases with zero mutation. The simultaneous observation (cancelled not counted while pending counted) was stronger than the guide's prescribed complete/cancel flow.
8. **Terminate+relaunch is the cheap, correct recovery** for corrupted fields and LogBox (not field repair, not fighting the LogBox).
9. **Reuse on-device state across cases:** the P18 composer interactions re-ran P12–P14's flow, and the earlier persisted events (14:36–14:38) became evidence for has_text correctness without re-driving them.

## 14. Derivation C — instrumentation/fixture work that removes the friction

1. **[P1 – dev, P19/P02/P03] Add `accessible`+`accessibilityRole="button"` to `AppHeader.renderBell`/`renderChat`** (mirror DiscoverHeader). Removes: derived-coordinate chat taps, badge pixel-scans for cluster order, and the P19 FAIL. Highest-leverage AX fix in this surface.
2. **[P1 – dev, P18] Fire `composer_bar_tapped` from the TextInput's `onFocus` (or `onTouchStart`)**, not only the bar's `onPress` — the bar surface is fully consumed by camera (hitSlop)/input/"+" so the tap event can never fire today. Removes the P18 FAIL and gives real focus-analytics.
3. **[P1 – dev fixture] Seed an in-progress trade + one unread message between test-seller/test-buyer** in `seed:staging`. Unblocks P03's badge half and every future messaging case (currently a multi-account dead-end).
4. **[P2 – dev, BP-53] AX-expose the remaining non-surfacing controls** in this surface: Profile utility rows (`profile-logout`, `profile-settings`, …), Sell-sheet options (`sell-option-list-one-item`, `sell-option-bulk-upload`, Cancel), and the Trades Active/History segmented control. Removes ~all remaining OCR band-finding.
5. **[P3 – dev] A standing conversation fixture** (or a `qa-unread-message` deep link) for unread-badge tests — removes the "message a user you have no trade with" impossibility.
6. **[P3 – dev] Suppress the camera-error LogBox noise** (or gate the camera icon on `isCameraAvailable` in dev) so repeated camera-icon taps stop accumulating dev LogBox overlays that force terminate/relaunch.
7. **[P3 – QA tooling] A "band-locate text row" helper** in the `qa:*` scripts (crop → OCR → return y-band) — the P17/P10/P06 pattern of finding a non-AX row's y-band was repeated 3+ times and would benefit from one scripted primitive.
8. **[P3 – QA tooling/playbook] Codify "analytics → DB first, CDP fallback"** (§12.2) so future runs don't rediscover the CDP replay-burst limitation.

---

## Appendix — the reasoning anti-patterns observed (what NOT to repeat)

- **Skipping the between-field re-list on a keyboard-avoiding screen (P17 re-login).** The one deviation from §5.2 caused a corrupted field + a full relaunch + redo. Rule: after ANY keyboard state change, re-list before the next tap — even (especially) when the form looks unchanged.
- **Estimating a control's y without re-deriving per screenshot (P17/P10).** First Cancel tap at (220,910) missed; OCR bands later pinned it ~867–887pt. Rule: one miss → full re-derive from a fresh screenshot (§5.1), and prefer a deterministic dismiss (the dim overlay) over chasing a small target.
- **Trusting the CDP capture to deliver post-attach console events (P18).** The replay burst looked like session history but was pre-capture nav events only. Rule: verify the capture actually contains the target event type before treating absence as evidence; prefer the DB for persistence assertions.
- **Not flagging strain live.** Strain crept in silently at P17 (row-finding) and P18 (CDP wall) without an explicit pause to flag it — the exact behavior the stress-test prompt asked the agent to surface *live*. Rule for 100+ runs: a forced self-check after every ~10 cases.
- **Hunting a fixture path that source already ruled out (P03).** The "keep exploring" instinct was present; the source read (Message button pending/cancelled-gated) is what stopped it. Rule: when a path is source-impossible, stop and report the gap instead of expanding the search.

---

*End of decision-and-outcome log. Pair with `report.md` (per-case results + UX) and the run's evidence folder for the full Group P record.*
