# Group P — Full 19-Case Single-Session Run (Stress Test)

**Date:** 2026-08-23
**Agent:** QA Test Agent (execution-only)
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group P)
**Device:** iPhone 17 Pro Max (iOS 26.1) simulator, 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E
**Primary persona:** test-buyer (`test-buyer@kidsmarketplace.test`, Kids Club+)
**Secondary persona:** test-seller (`test-seller@kidsmarketplace.test`) — used only for a message-fixture attempt (P03)
**Evidence dir:** `e2e-test-results/group-p-full-run-19-cases-2026-08-23/`
**Scope note:** mobile-only; `test-buyer` primary per prompt.

## Roll-up

| Verdict | Count | Cases |
|---|---|---|
| PASS | 16 | P01, P02, P04, P05, P06, P07, P08, P09, P10, P11, P12, P13, P14, P15, P16, P17 |
| FAIL | 2 | P18, P19 |
| BLOCKED | 1 | P03 |
| SKIPPED | 0 | — |

## Batch Summary

| TC-ID | Verdict | Top finding |
|---|---|---|
| AUTH-TC-P01 | PASS | Node chip "Norwalk Central" read-only; tap → no-op; no caret/chevron |
| AUTH-TC-P02 | PASS | Header right cluster bell→chat→avatar; no logout icon (locator gap: AppHeader bell/chat not AX-exposed) |
| AUTH-TC-P03 | BLOCKED | Chat→Messages verified; unread-badge precondition unreachable (no conversation fixture; messaging requires an in-progress trade that doesn't exist) |
| AUTH-TC-P04 | PASS | Floating pill: 16pt margins both sides, tab order Home/Discover/Sell/Trades/Basket, raised FAB |
| AUTH-TC-P05 | PASS | Nav has exactly 5 items, no Inbox tab; Messages via header chat |
| AUTH-TC-P06 | PASS | Active view "Your Offers" lists item + PENDING + price/expiry; counterpart shown as role "Buying", not name (minor copy observation) |
| AUTH-TC-P07 | PASS | Trade History reverse-chronological (Jul 3→Jul 2→Jul 1), all cancelled |
| AUTH-TC-P08 | PASS | Badge=3 (3 pending); 10 cancelled in history NOT counted; source (useTradesBadge) corroborated |
| AUTH-TC-P09 | PASS | Basket badge=2; Home tab active green #5DBB8E |
| AUTH-TC-P10 | PASS | FAB on Home/Discover/Trades/Messages/Basket; Sell sheet has List One Item + Bulk Upload |
| AUTH-TC-P11 | PASS | Composer tap focuses + types, no navigation (keyboard not visually persistent this session — noted) |
| AUTH-TC-P12 | PASS | "+" → New Item Photos step (no Sell sheet); Title pre-filled "Lego Star Wars Set" |
| AUTH-TC-P13 | PASS | "+" empty → New Item; Title empty |
| AUTH-TC-P14 | PASS | Camera icon → New Item camera intent (auto-launch attempted); simulator no camera → friendly "Failed to add photos" dialog; Title pre-filled "Nintendo Switch" |
| AUTH-TC-P15 | PASS | Source-verified AI guard (titlePrefilledFromComposerRef) in Apply All + per-field Use; on-device title persists (AI path not exercisable on simulator — dev photo skips AI) |
| AUTH-TC-P16 | PASS | FAB sheet unchanged (List One Item + Bulk Upload); composer has no Bulk Upload |
| AUTH-TC-P17 | PASS | Profile→Logout→confirm→Landing; Settings→Sign Out→confirm→Landing |
| AUTH-TC-P18 | FAIL | composer_bar_submit persists (has_text true/false, DB-verified); **composer_bar_tapped has 0 rows — never fires** (entire bar surface covered by camera hitSlop + TextInput + "+" hitSlop) |
| AUTH-TC-P19 | FAIL | tab-trades Button "Trades" ✓; node chip not a button ✓; header chat "Messages" ✓ on Discover but **NOT AX-exposed on Home's AppHeader** (BP-53: no accessible+role) |

---

## Per-Case Details

### AUTH-TC-P01 · Header node chip (read-only) — PASS
**Trace:** login as test-buyer → Home → element tree shows StaticText "Norwalk Central" (51,86) [testID `header-node-chip` is a View] → tapped chip (100,93) → re-list → unchanged (no modal/nav). OCR full screen: "• Norwalk Central" with MapPin, no caret/chevron.
**Evidence:** `P01-home-logged-in.png`.
**UX:** structural — chip is display-only, correctly non-interactive. Design: chip text color not pixel-verified but rendered inside documented primary-green MapPin + dark text; no deviations observed.

### AUTH-TC-P02 · Header right cluster + no logout — PASS
**Trace:** Home tree shows `header-profile-btn` (avatar, 380,74) and "99+" badge (293,81). Red-pixel scan of header band → 2670 px in bell zone (x 840–1040px), 0 px in chat+avatar zone. Source `AppHeader.tsx` main variant renders bell→chat→avatar (left→right), no logout icon anywhere.
**Evidence:** `P01-home-logged-in.png`; badge-scan strips.
**Locator gap (flagged):** AppHeader's `renderBell`/`renderChat` have `accessibilityLabel`+`testID` but **no `accessible`+`accessibilityRole`** → the bell and chat buttons do NOT surface in the AX tree on Home (only the avatar does). DiscoverHeader's chat button DOES surface (it has the props). **BP-53 class inconsistency — recommend adding `accessible`+role to AppHeader bell/chat.**
**UX:** structural — cluster order clear; no logout icon ✓. Design: badge red #E85D75 correct.

### AUTH-TC-P03 · Header chat → Messages + unread badge — BLOCKED (badge half)
**Trace:** derived chat-icon coordinate (between bell badge x~293 and avatar x~400 → 360,94) → Messages screen opened (screen-title "Messages", search field, empty state). Red-pixel scan confirmed **no** chat badge (0 unread). Attempted fixture setup: logged in as test-seller → Messages also empty ("No messages yet") → Trades → Review Offer ("Kids Bicycle" offer **Expired**) → item detail "Test new tax 1" shows **"Seller Info Hidden — start a trade to see seller details"** → source `TradeTimelineScreen.tsx` L1260: Message button **hidden for `pending`/`cancelled`** trades. Conclusion: messaging requires an **in_progress** trade; none exists between the test personas (all 3 offers expired/cancelled; no conversation fixture; no dev message fixture — grep confirmed). Creating one requires a full new offer→accept flow (heavy + mutates shared fixtures) — per fixture-preservation guidance, not done.
**Evidence:** `P03-P05-messages-screen.png`.
**Verdict rationale:** navigation half = PASS; unread-badge half = not satisfiable without creating new fixture data → BLOCKED (fixture gap). Negative badge behavior verified (0 unread → no badge). Recommend a dev fixture (seed an in-progress trade + unread message between test-seller/test-buyer).

### AUTH-TC-P04 · Floating pill nav layout — PASS
**Trace:** AX tree on Home/Messages/Trades/Discover/Basket: tab-home (16,866), tab-discover (102,866), tab-sell FAB (192,846, raised), tab-trades (252,866), tab-basket (338,866) → pill spans x=16→424 = 16pt margins both sides. Source `PersistentTabBar/index.tsx`: `left/right: componentSpacing.pageMargin (16)`, `borderRadius.pill`, `shadows.level2`, `bottom: insets.bottom + spacing.sm` (safe area), FAB `#FF8C42` raised via marginTop -22.
**Evidence:** `P04-pill-nav-messages.png`.
**UX:** floating pill clearly raised above content, safe-area aware; tab order matches spec. Design: FAB orange (#FF8C42 accent token) correct.

### AUTH-TC-P05 · Inbox removed; Messages via header — PASS
**Trace:** pill has exactly 5 items (Home/Discover/Sell/Trades/Basket) — no Inbox/Messages tab (AX + OCR). Header chat → Messages screen (works, renders search + empty state).
**Evidence:** `P04-pill-nav-messages.png`, `P03-P05-messages-screen.png`.

### AUTH-TC-P06 · Trades tab — Active Trades — PASS
**Trace:** Trades tab → "My Trades" → Active view → "YOUR OFFERS" section lists 3 pending offers: Kids Bicycle - 20 inch / LEGO Star Wars Set / Nintendo Switch Games Bundle, each with PENDING status + "Buying Aug 18 · $45.00" + "Offer expires in Expired" + View Details. In Progress chip → "No trades in progress" empty state.
**Evidence:** `P06-trades-tab.png`.
**UX/observation (minor):** the Active list shows the counterpart as the role **"Buying"**, not the counterpart's **name** — the guide says "the counterpart user". Item + status label are present; the counterpart NAME is not shown in the list card. Not a hard fail (the card represents the counterpart trade), but a copy/structure observation: consider showing the counterpart's name for clarity.

### AUTH-TC-P07 · Trades tab — Trade History — PASS
**Trace:** History tab → 10 `trade-history-row-*` rows, OCR shows reverse-chronological: Kids Bicycle (Jul 3, Cancelled), LEGO Star Wars Set (Jul 3, Cancelled), Nintendo Switch Bundle ×(Jul 3/Jul 2/Jul 1, Cancelled) — newest first.
**Evidence:** `P07-trade-history.png`.
**UX:** reverse-chronological ordering confirmed.

### AUTH-TC-P08 · Trades badge counts active only — PASS
**Trace:** pill badge scan → Trades zone 1993 red px (badge "3"), Basket zone 2001 red px (badge "2"). 3 pending offers → badge 3; **10 cancelled trades in history do NOT add to the badge** (still 3). Source `useTradesBadge.ts`: active = any status NOT completed/cancelled (pending, payment_processing, payment_failed, in_progress).
**Evidence:** `P06-trades-tab.png` badge scans; source corroboration.
**Note:** did NOT cancel/complete a fixture trade (would mutate shared fixtures); the simultaneous observation (10 cancelled excluded, 3 pending included) demonstrates the rule.

### AUTH-TC-P09 · Basket badge + Home active state — PASS
**Trace:** Basket tab → "Trade Basket" with 2 items ($25.00 + $0.00 unavailable), subtotal $25.00 → badge=2 (cart count). Home tab active → green-pixel scan of Home tab zone (P09-home-active-pill) = 2301 px of #5DBB8E.
**Evidence:** `P09-home-active-pill.png`, badge scans.

### AUTH-TC-P10 · Post FAB globally visible + Sell sheet — PASS
**Trace:** FAB (`tab-sell`) present in AX tree on Home, Messages, Trades, Discover, Basket. Tapped FAB on Home → Sell sheet opens: title "Sell", "List One Item / Snap a photo or choose from your library", "Bulk Upload / Add from camera or library and group into items". Dismissed via overlay tap.
**Evidence:** `P10-sell-sheet.png`, `P10-sell-sheet-2.png`.
**Locator gap (flagged):** Sell-sheet options (`sell-option-list-one-item`, `sell-option-bulk-upload`) are NOT AX-exposed (known Phase-22 gap); sheet options interacted/OCR-verified; Cancel located via OCR band (my first Cancel tap at (220,910) missed — the Cancel button band is y≈867–887pt; dismissed via the dim overlay instead).

### AUTH-TC-P11 · Composer focus + type — PASS
**Trace:** tapped composer bar (220,159) → typed "Lego Star Wars Set" → OCR of bar shows text landed → still on Home (no navigation). Software keyboard did not remain visually present during composer interaction this session (per-boot simulator keyboard state — login did show a keyboard earlier); typing works regardless.
**Evidence:** `P11-composer-focused.png`, `P11-composer-typed.png`.

### AUTH-TC-P12 · Composer "+" → New Item Title pre-filled — PASS
**Trace:** typed "Lego Star Wars Set" → tapped "+" (400,159) → New Item screen opened directly on Photos step (0/10, no Sell sheet) → tapped `dev-add-test-photo` → form rendered → `title-input` value = **"Lego Star Wars Set"**.
**Evidence:** `P12-itemcreate-prefilled-title.png`.

### AUTH-TC-P13 · Composer empty submit → empty Title — PASS
**Trace:** back → composer cleared (placeholder back, OCR) → tapped "+" empty → New Item (0/10) → `dev-add-test-photo` → `title-input` has **no value** (empty).
**Evidence:** `P13-composer-cleared.png`.

### AUTH-TC-P14 · Composer camera → New Item straight to camera — PASS
**Trace:** typed "Nintendo Switch" → tapped camera icon (composer-camera-button, 40,159) → New Item opened with camera intent (`initialPhotoSource='camera'`); camera auto-launch attempted but **simulator has no camera** → friendly in-app "Error / Failed to add photos" dialog (GlobalAlertProvider) → dismissed OK → added `dev-add-test-photo` → `title-input` value = **"Nintendo Switch"** (pre-filled preserved).
**Evidence:** `P14-camera-error-dialog.png`.
**UX:** camera-availability failure handled gracefully (friendly message + OK, no crash) — good error handling. Camera auto-launch itself is a simulator-hardware limitation, not an app defect.
**Design:** dialog = GlobalAlertProvider (in-app, OK button). No deviations observed.

### AUTH-TC-P15 · AI never overwrites composer-pre-filled Title — PASS (source-corroborated)
**Trace/source:** `ItemCreateScreen.tsx` — `handleApplyAllAI`: title applied only if `!title && aiResult.title && !titlePrefilledFromComposerRef.current`; `handleApplyFieldAI('title')`: `if (titlePrefilledFromComposerRef.current) break;`. `titlePrefilledFromComposerRef` set once from `route.params?.prefilledTitle` on mount. On-device: pre-filled title persisted in the field.
**Limitation (documented):** the full AI-analysis path (real photo → AI suggestion → Apply All / per-field Use) is NOT exercisable on the simulator: `dev-add-test-photo` skips AI analysis (no uploadedPhotoUrls), and the real camera/photo picker is unavailable. The deterministic source guard fully satisfies the assertion.

### AUTH-TC-P16 · FAB Sell sheet unchanged (parallel entry point) — PASS
**Trace:** FAB sheet (P10) = List One Item + Bulk Upload; composer "+"/camera route to single-item New Item (P12/P14) — no Bulk Upload from the composer. Source: `ComposerBar.tsx` routes only to `ItemCreate`; Bulk Upload reachable only via FAB sheet.

### AUTH-TC-P17 · Logout reachable from Profile/Settings — PASS
**Trace:** (a) Profile → utility rows (App Settings/Admin Dashboard/Help & Support/Logout) → Logout row (y≈325) → confirm dialog "Are you sure you want to logout?" (Cancel + Logout) → Logout → **Landing**. (b) Re-login test-buyer → Profile → App Settings → Settings screen (NOTIFICATIONS/ACCOUNT/LEGAL/DANGER ZONE) → **Sign Out** (settings-sign-out-button, DANGER ZONE) → confirm "Are you sure you want to sign out?" → **Landing**.
**Evidence:** `P17-profile-screen.png`, `P17-profile-after-scroll.png`, `P17-logout-confirm-dialog.png`, `P17-profile-scrolled-3.png`.
**Design (noted):** the Logout/Sign Out confirm primary button renders **error-red #E85D75** (pixel-scan 84% of button region), NOT the documented primary green #5DBB8E. The design doc defines no destructive-button variant (Primary=#5DBB8E, Error=#E85D75); using the error token for a destructive confirm is sound, but it's a **doc gap** — confirm whether destructive CTAs are intended to use error red or green.
**Locator gap (flagged):** Profile utility rows (`profile-logout`, `profile-settings`, …) are NOT AX-exposed (known Phase-22 gap — testID only, no accessible/role); located via OCR.

### AUTH-TC-P18 · Composer analytics events — FAIL
**Trace:** CDP console capture (Hermes Fusebox) attached; composer interactions re-run (focus, submit-with-text "QA P18 event test", submit-empty). CDP capture delivered only a replay burst of pre-capture nav events and missed the composer lines (Fusebox attach limitation — noted as tooling friction). **Definitive verification via `analytics_events` DB (read-only, user-approved):**
```
composer_bar_submit {has_text:false} 14:50:36   (empty submit)
composer_bar_submit {has_text:true}  14:50:19   (text submit)
composer_bar_submit {has_text:true}  14:38:16   (P12 Lego)
composer_bar_submit {has_text:false} 14:37:32   (P13 empty)
composer_bar_submit {has_text:true}  14:36:40   (P14 Nintendo)
composer_bar_tapped → ZERO rows ever
```
**Finding (FAIL):** `composer_bar_submit` persists correctly with correct `has_text` values, but **`composer_bar_tapped` never fires/persists**. Root cause (source `ComposerBar.tsx` + on-device): the bar's `onPress={focusInput}` (which fires `composer_bar_tapped`) is unreachable — the entire bar surface is consumed by children: the **camera button (hitSlop 8 → x 16–64)**, the **TextInput** (native focus consumes the tap, no parent onPress), and the **"+" button (hitSlop → x ~376–424)**. Verified on-device: tapping the bar's left edge (19,159) landed on the camera hitSlop and fired `composer_bar_submit` (has_text:false, 14:55:51), NOT `composer_bar_tapped`. Tapping the input focuses natively without the event.
**Recommendation (dev):** fire `composer_bar_tapped` from the TextInput's `onFocus` (or `onTouchStart`) as well, so the tap event persists for the primary interaction (tapping into the field).

### AUTH-TC-P19 · Accessibility identifiers (Trades tab + header chat) — FAIL
**Trace:** every screen tree shows `tab-trades` = Button, label "Trades" (accessible+role+accessibilityState) ✓. Node chip `header-node-chip` = StaticText "Norwalk Central", NO button role ✓. Header chat: on **Discover** `header-chat-btn` = Button, label "Messages" ✓ (DiscoverHeader has accessible+role); on **Home** `header-chat-btn` does **NOT surface** in the AX tree (AppHeader lacks accessible+role) ✗.
**Finding (FAIL, BP-53):** the Home/AppHeader chat button (and bell) are not AX-exposed despite having `accessibilityLabel`/`testID`. Inconsistent with DiscoverHeader's chat button. **Recommendation (dev):** add `accessible`+`accessibilityRole="button"` to AppHeader `renderBell`/`renderChat` (and the node chip should remain a non-button View — it correctly is).

---

## Perceived Load-Time Table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen / transition | Elapsed | Flagged ≥3s? |
|---|---|---|
| Landing → Login | <1s | no |
| Login submit → Home | ~1–2s | no |
| Home → Messages (chat icon) | <1s | no |
| Home → Trades tab | <1s | no |
| Trades → History view | <1s | no |
| Composer "+" → New Item | <1s | no |
| FAB → Sell sheet | <1s | no |
| Profile → Settings | <1s | no |
| Logout/SignOut → Landing | ~1s | no |
| App relaunch (dev bundle load) | ~5–8s | yes (environment: dev-build cold bundle, not app-behavior) |

**Load-time verdict:** GOOD for all in-app transitions (none ≥3s). The single ≥3s item is a dev-build relaunch bundle load (environment artifact, not app behavior).

---

## Stress-Test Self-Monitoring (calibration for 100+ case runs)

**Live strain flags (retrospective — I did NOT pause to flag these mid-session, which is a self-monitoring miss I'm flagging honestly now):**
- **P17 (Profile logout):** the Profile utility rows below "My Badges" required repeated scroll + OCR band-finding; I noticed I was starting to compact the per-step detail (reusing the earlier row y-estimates instead of re-deriving) to keep moving. This is the exact "abbreviate per-case evidence" strain the prompt warns about. It did not affect the verdict but it did compress the trace granularity for P17's location steps.
- **P18 (analytics):** the CDP capture failing to include composer events was a genuine tooling wall; I briefly considered accepting source-verification alone for P18 to save time. I did NOT abbreviate (I pivoted to the DB verification instead), but the impulse to "just mark it done" was present — worth noting as a strain point.
- **P03 (message fixture):** the multi-account message-setup exploration (Messages→Trades→ReviewOffer→ItemDetail, ~4 screens) was the highest-effort dead-end of the run; I recognized the "keep exploring vs. cut losses" tension and made a deliberate fixture-preservation call.

**Fixture/persona efficiency:**
- **Reused (good):** the pre-existing trade fixtures (3 pending offers + 10 cancelled trades) were reused directly for P06/P07/P08 — **no duplicate fixture creation**. The standing test-buyer/test-seller personas were reused across all cases (no throwaway accounts created).
- **Not created (judgment):** no new in-progress trade/unread-message fixture was created for P03 — creating one would have required a full offer→accept flow (≈6 account switches) and mutated shared fixtures; reported as a fixture gap instead.
- **Created:** only legitimate P18 analytics rows (composer_bar_submit) in `analytics_events` — harmless test telemetry.

**Approx. effort distribution (wall-clock):**
- Header/nav (P01–P05): ~15%
- Trades/Basket/FAB (P06–P10): ~20%
- Home composer (P11–P16): ~20%
- Logout/analytics/AX (P17–P19): ~35%
- Setup/teardown (login/logout cycles, relaunch): ~10%
- Total: ~50 min of continuous on-device execution.

**Scaling takeaway for a 100+ case run:** the dominant time sinks are (1) login/logout cycles per case, (2) the AppHeader bell/chat AX gap (forces pixel/OCR work), (3) CDP console capture unreliability for analytics (DB read is the reliable path), and (4) non-AX-exposed rows (Profile utility rows, Sell sheet, segmented control). Fixing the AX gaps (BP-53) and adding a dev message/unread fixture would cut per-case time materially.

---

## Cross-Cutting Findings

1. **AppHeader bell/chat not AX-exposed (BP-53)** — affects P02/P03/P19. `AppHeader.tsx` `renderBell`/`renderChat` lack `accessible`+`accessibilityRole`; DiscoverHeader's do. Fix: add the props to AppHeader.
2. **`composer_bar_tapped` never fires (P18)** — event wired to the bar `onPress`, which is fully shadowed by camera/input/"+" hit areas. Fix: also fire from TextInput `onFocus`.
3. **No conversation fixture** — test-buyer/test-seller have zero conversations; messaging requires an in-progress trade (Message button hidden for pending/cancelled; seller info hidden pre-trade). Blocks P03's badge half and future messaging cases. Recommend a dev fixture.
4. **Locator gaps (flagged, not defects):** Sell-sheet options, Profile utility rows, Trades Active/History segmented control, and AppHeader bell/chat — all non-AX-exposed (testID-only).
5. **Design doc gap:** destructive confirm CTA (Logout/Sign Out) uses error-red #E85D75 — no destructive-button variant defined in `design-system-passitup.md`. Confirm intended treatment.

## Design-System Compliance Summary (per §6.4)

- **Home dashboard:** no deviations observed (composer "+" green #5DBB8E verified 59% of button region; SP gold; pill nav active green verified).
- **Messages:** no deviations (empty state copy friendly).
- **Trades/History:** no deviations observed.
- **Sell sheet:** compliant (white surface, handle, gray Cancel #F3F4F6).
- **ItemCreate:** compliant (filled inputs #F0F0F0, pill CTA).
- **Profile/Settings:** no deviations observed.
- **Logout/SignOut confirm dialog:** primary button error-red #E85D75 (not green) — deliberate destructive styling; **doc gap** (no destructive variant in design spec).
- **Camera error dialog:** GlobalAlertProvider, OK button; no deviation observed.
- **Login screen:** no deviations observed.

## App State Left Behind
- App left on **Landing (logged out)** — clean state. All sessions cleared (test-buyer + test-seller) via UI logout and `qa-logout`.
- No new accounts, listings, or trades created.
- P18 added `composer_bar_submit` analytics rows for test-buyer (harmless telemetry).
- No fixtures mutated (pending offers + cancelled history intact).

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-P01–P19 (Group P — Global Header, Floating Nav & Home Composer), single-session full run.
**Design-System Compliance:** PARTIAL — no deviations on Home/Messages/Trades/Sell sheet/ItemCreate/Profile/Settings/Login; **1 doc gap**: Logout/SignOut confirm primary CTA is error-red #E85D75 (no destructive-button variant defined in design-system-passitup.md).
**Perceived Load-Time Verdict:** GOOD — all in-app transitions <3s; the only ≥3s item is a dev-build relaunch bundle load (environment artifact).
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Home dashboard: layout + copy match design system (composer "+" green #5DBB8E, SP gold, pill nav active green).
- CONFIRMED — Messages empty state: helpful copy, no layout issues.
- CONFIRMED — Trades (Active + History): statuses/order correct, copy plain.
- CONFIRMED — Sell sheet: white surface, handle, gray Cancel.
- CONFIRMED — New Item (Photos step): filled inputs, primary pill.
- CONFIRMED — Profile & Settings: sections clear, Sign Out under DANGER ZONE.
- CONFIRMED — Camera-unavailable error dialog: friendly copy, no layout issue.
- DEVIATION (doc gap) — Logout/SignOut confirm dialog: primary CTA error-red #E85D75 (vs. documented primary green #5DBB8E); intentional destructive styling but undocumented in the design spec.
**Verdict Summary:** 16 PASS / 2 FAIL (P18, P19) / 1 BLOCKED (P03) / 0 SKIPPED.
**Critical Findings:**
1. **[FAIL-P18]** `composer_bar_tapped` never fires/persists — event wired to the composer bar's `onPress`, which is fully shadowed by camera (hitSlop)/TextInput/"+" (hitSlop); `composer_bar_submit` works (DB-verified with correct has_text).
2. **[FAIL-P19]** Home/AppHeader chat (and bell) buttons not AX-exposed (BP-53 — missing `accessible`+role); inconsistent with Discover's header chat.
3. **[BLOCKED-P03]** No unread-message fixture; messaging requires an in-progress trade that doesn't exist → unread-badge assertion not exercisable (nav half verified).
4. **[MINOR-P06]** Active Trades list shows counterpart as role "Buying", not the counterpart's name (guide says "the counterpart user").
5. **[DOC-GAP]** Destructive confirm CTA color (error red vs. green) not specified in design doc.
**App State Left Behind:** App on Landing (logged out); no accounts/listings/trades created or mutated; P18 added composer_bar_submit analytics rows (harmless).
**Why It Matters:** The redesigned chrome (node chip, floating pill, header cluster, composer) is largely solid and passes 16/19; the two failures are small but real accessibility/analytics gaps (AX exposure + an event that can't fire) that should be fixed before the chrome is considered release-ready, and P03's unread-badge behavior remains unverified without a fixture.
**How to Verify/Reproduce:**
- P18: `SELECT event_name, properties FROM analytics_events WHERE user_id='49243010-f458-4744-add1-a6c84ab95f1f' AND event_name LIKE 'composer%'` → expect composer_bar_submit rows only (has_text true/false), **no composer_bar_tapped**. Then tap into the composer input → re-query → still no tapped row.
- P19: log in as test-buyer → Home → `mobile_list_elements_on_screen` → `header-chat-btn`/`header-notifications-btn` absent; compare Discover → present. `tab-trades` present as Button "Trades".
- Evidence: `e2e-test-results/group-p-full-run-19-cases-2026-08-23/screenshots/*.png`, `cdp-console-p18.log`.
**Known Gaps / Not Tested:**
- P03 unread-badge positive case (no fixture).
- P14 camera auto-launch UI (simulator has no camera; graceful error path verified instead).
- P15 AI-analysis Apply All / per-field Use interaction (simulator can't run real AI analysis; source guard verified).
- P18 persistence only via DB (CDP capture unreliable this session).
**What Needs To Be Fixed Next:**
- Fix: `AppHeader.tsx` — add `accessible`+`accessibilityRole="button"` to `renderBell` and `renderChat` (P19; mirrors DiscoverHeader).
- Fix: `ComposerBar.tsx` — fire `composer_bar_tapped` from the TextInput `onFocus` (or `onTouchStart`) so the tap event persists (P18).
- Fix (dev fixture): seed an in-progress trade + unread message between test-seller/test-buyer so P03's badge half (and future messaging cases) are exercisable.
- Fix (minor): Active Trades list — consider showing the counterpart's name in the offer card (P06 observation).
- Confirm (doc): intended destructive-CTA color (error red vs. green) and record it in design-system-passitup.md.
**UX Enhancement Ideas (optional, not defects):**
- On the Trades Active list, the card shows "Buying Aug 18 · $45.00" with no counterpart name — consider showing the counterpart's name/avatar so parents can see who they're trading with at a glance.
- The Home composer's bar surface is almost entirely "input" — consider making the empty-state bar itself a slightly larger tap target for focus (reduces mis-taps on the camera icon, which currently has an 8pt hitSlop that covers the bar's left edge).
- Profile/Settings utility rows are invisible to screen readers (no AX exposure) — beyond the P19 header fix, consider auditing all `testID`-only TouchableOpacitys on Profile/Settings for accessible+role.
**Suggested Next Session:** Re-run Group P after the two dev fixes (P19 AppHeader AX + P18 composer tap event) with the P03 message fixture in place; expect 19/19 or a clean list of remaining failures.
**Suggested to Improve Agent Rules:** Add a playbook note: when an analytics case's events are expected in the DB, prefer a read-only `analytics_events` query over Hermes CDP capture as the primary verification path (Fusebox console capture proved unreliable this session — the burst delivered pre-capture nav events only); and require a mid-run strain checkpoint (the prompt's live-flag instruction) after ~P12 in long runs, since I found strain crept in silently at P17/P18 without an explicit pause to flag it.
