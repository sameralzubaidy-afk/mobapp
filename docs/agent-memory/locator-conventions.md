# Locator / testID conventions (established 2026-08-13, pilot closeout)

## Mobile (React Native) — `testID` + accessibility
- Any control carrying a `testID` MUST also set `accessible` + `accessibilityRole="button"` + `accessibilityLabel` (visible text) so it surfaces on the iOS accessibility tree — mirror `src/components/ui/Button.tsx` (BP-53).
- Mobile IDs use kebab-case, purpose-first, no screen prefix (e.g. `cancel-trade-button`, `confirm-payout-btn`, `edit-profile-email-input`).
- Dashboard quick-action tiles: `action-tile-favorites|myTrades|myListings|payouts` (now with accessible/role/label).
- **AX role warning (2026-08-20, RN 0.81 iOS/Fabric):** `accessibilityRole="tab"` does NOT surface in the iOS accessibility tree — `bulk-step-*` on `BulkListingCreateScreen` never appeared on-device until changed to `accessibilityRole="button"` (only `tab` usage in the app; disabled-flattening and container `tablist` were ruled out by controlled on-device experiments). Rule: use `accessibilityRole="button"` for tappable elements; `tab`/`tablist` are dead on iOS here. Carry current-state via `accessibilityState` + the label (e.g. "Step 2: Group, current").
- **AX role warning #2 (2026-08-23, RN 0.81 iOS/Fabric):** `accessibilityRole="adjustable"` also does NOT surface in the iOS AX tree — the RadiusSlider track (`radius-slider-track`) was invisible with `adjustable` + `accessibilityValue` until changed to `accessibilityRole="button"` (confirmed on-device via mobile-mcp list_elements_on_screen: element absent with `adjustable`, present as Button "Search radius slider" with `button`). Same class as the `tab` note: stick to `"button"` (+ `accessibilityState`/label) for anything that must surface on iOS. The −/+ stepper buttons and track of `RadiusSlider.tsx` now use testIDs `radius-slider-decrease`/`radius-slider-increase`/`radius-slider-track` with accessible+role+label.

## Admin (Next.js) — `data-testid`, `<screen-or-page-prefix>-<element-purpose>-<optional-id>`
- Action buttons use `btn-<purpose>` (e.g. `btn-suspend-user`, `btn-extend-trial-<uid>`, `btn-cancel-<uid>`, `btn-reactivate-<uid>`).
- Per-row controls suffix with `<id>`: `btn-edit-badge-<badge.id>`, `badge-toggle-<badge.id>`, `btn-cron-run-now-<jobid>`, `btn-cron-schedule-<jobid>`.
- Config forms: `ref-config-<section>-<field>` inputs + `btn-save-<section>-<field>` (section-qualified to disambiguate duplicated labels like Referrer/Referee SP Bonus), toggles `toggle-<purpose>-enabled`.
- Badge editor: `badge-editor-<field>`; manual award: `manual-award-<control>`.
- Cron monitoring: `cron-<control>` (`cron-timezone-select`, `cron-lookback-24h`, `cron-tab-info`, `cron-status-filter`, `btn-cron-refresh`).
- Run Now / Schedule on /monitoring/cron are SIDE-EFFECTING (real mutations) — flagged in source comments.

## Known quirk
- `avatar-upload-button` is load-bearing/misnamed: on `ProfileScreen.tsx` it's the "Edit basic info" link, on `ProfileSetupScreen.tsx` the avatar upload. DO NOT rename (detox `42-edit-profile.e2e.ts` + `ProfileSetupScreen.test.tsx` depend on it). The correctly-named EditProfile identifier is `edit-profile-avatar-button`.

## ⭐ RULE-PRICE-1 — Price field standard procedure (established 2026-08-30, QA Task 11 post-mortem)
Do NOT rediscover this per test case — it cost ~20–25 calls the first time.
1. **Field testIDs:** ItemCreate = `dev-price-input` (default `"3"`); Offer = `price-input`; Edit listing = `edit-listing-price-input`. Use dev fixtures whenever possible.
2. **Dev-button footer overlap (ItemCreateScreen):** `dev-fill-item` and `dev-set-price` sit at tree-logical y≈803/866 — **BEHIND the sticky "Submit for Review" footer (band y≈842–894 on iPhone 17 Pro Max) at top-scroll. NEVER tap them by tree coords at top-scroll — the tap hits Submit.** Always **swipe content up ~77–100pt first** (verified targets after scroll: `dev-fill-item` y≈726/747, `dev-set-price` y≈789/810), then tap.
3. **Setting a value:** prefer `dev-fill-item` (sets price=20 + title + condition). `dev-set-price` sets `"3"` (threshold cases). Manual type only for custom prices: tap field, **Cmd+A (osascript select-all) + retype** (default/existing value must be replaced), then **re-verify value in the AX tree (R2) before proceeding**.
4. **DB read-back:** `items.price` is **numeric dollars, NOT price_cents**. Close any price flow with a DB read-back, never UI alone (R37).
5. **Edit flow:** reach via deep link `p2pkidsmarketplace://edit-listing?listing_id=<id>` (My Listings pencil icon has NO AX/testID — locator gap).
6. **One-hop pre-priced create (Dev Task 70, 2026-08-30):** deep link `p2pkidsmarketplace://create-item?price=NN` pre-fills the real price field (`manual-price-input`) on mount — no Cmd+A/retype needed. Still add a photo via `dev-add-test-photo` first (the price field only renders once `photos.length > 0`). Draft resume wins over the link param when a `draftId` is present.
Full trace + bottleneck analysis in `e2e-test-results/qa-task11-nopqr-2026-08-30/DECISION-AND-OUTCOME-LOG.md`.

## On-device AX-tree verification (2026-08-13, Phase 6)
- Confirmed via mobile-mcp `mobile_list_elements_on_screen` on iOS sim (iPhone 17 Pro Max, Debug build + Metro): dashboard 4 action tiles, all 6 cancel-reason-* options, cancel-kids-club-button, cancel-confirm/keep-button, cancel-reason-other-input, and all 5 edit-profile-* IDs ALL surface. 19/20 pass.
- FAIL: `cancel-reason-modal` (ManageKidsClub) is a plain `<View testID>` with NO `accessible` → invisible to the iOS AX tree (BP-53 exposure bug). Proposed fix: `accessible accessibilityRole="summary" accessibilityLabel="Cancel Kids Club+ dialog"`; re-verify children still surface after (accessible on a container may group/hide children on iOS).
- The login session used for manual verification was a Kids Club+ active user ("Samer Test Update 10" / rewardsfirsttradebob.demo@example.com), NOT the seed test-buyer.
- Deep links to sub-screens were unreliable (landed on Home/Chat); reached screens via UI taps instead.

## RN Modal AX exposure — Pressable containers GROUP their children (2026-09-01, DT84 / QA Task 17 F-4)
- A branded RN `<Modal>` whose backdrop/sheet are `Pressable`s **defaults to `accessible={true}` and GROUPS its children in the iOS AX tree** — the modal's buttons vanish even if they carry `testID` + `accessible` + `accessibilityLabel`. `accessibilityViewIsModal` on the Modal is NOT enough.
- Fix (proven on-device 2026-09-01, `TradeListScreen` bundle accept modal): add **`accessible={false}` on the Pressable containers** (overlay + sheet) so the buttons surface individually. GlobalAlertProvider works because its backdrop is a plain `<View>` (non-grouping). Before: tree blank (only status-bar clock); after: `btn-accept-all-confirm` / `btn-bundle-modal-cancel` surface.
- Same class as the earlier `tab`/`adjustable` AX-role notes (BP-53): on iOS here, accessibility exposure is finicky — verify on-device, never trust unit tests alone.

## QA deep links that ARE reliable (2026-09-01, DT84)
- `p2pkidsmarketplace://qa-refresh` — force-refetches the currently-open screen (TradeListScreen registers its refetch via `qaRefreshRegistry`). Fires reliably via `simctl openurl` even in foreground.
- `p2pkidsmarketplace://qa-scroll-to?testID=<id>` — scrolls the target into view on the open screen (TradeTimelineScreen registers via `qaScrollRegistry`; logs `[QaScrollToDeepLink] RESULT <id> <x> <y>`). Proven: scrolled `seller-cancel-inprogress-button` y1852 → y720 in one call.
- `qa:ef-repro --notify` — verifies the seller's `trade_request` notification after offer creation (DB trigger already creates it; script confirms + backfills). NOTE: `--notify` needs `--items` (skips when `--body` is used).
- These dedicated qa-* handlers are reliable even though generic notification-path deep links (`/trades`) historically landed on Home/Chat — use them for QA navigation.

## mobile-mcp tap technique — tap element CENTERS, never corners (2026-09-01)
- Dashboard action tiles (80×123) and pill tabs: a tap at the reported top-left corner silently misses (no navigation). Tap the element CENTER (e.g. `action-tile-myTrades` x130-210/y322-445 → tap 170,383). Get the center from the element's `width`/`height` in the AX tree.

## Test-seller listing status is `available`, NOT `active` (2026-09-01)
- `items.status = 'available'` for test-seller fixtures — querying `.eq('status','active')` returns 0. Use `available` (or no status filter) when looking for fixture listings.

## Dialog-handling exemption — approved Option B (2026-08-15, Phase 9 closeout)
Three dialog categories are PERMANENTLY OUT OF SCOPE for the `testID`/`data-testid` locator convention. Approved decision: they will NOT be refactored into custom testable modals. Rationale: they are third-party SDK or native OS UI, NOT part of the app's own render tree, so app locators cannot attach to them.

1. **Stripe `PaymentSheet`** (mobile card entry) — Stripe's native sheet.
2. **React Native `Alert.alert`** (confirm / remove / error dialogs) — native OS alert; buttons are OS-rendered.
3. **Browser `confirm()` / `alert()`** (admin portal: /listings approve/request-edits/reject, /trades/[id] force-cancel, /reviews keep/hide, /payouts actions, etc.) — native browser dialogs, no DOM.

Expected handling (framework-level techniques for the execution agent):
- **Detox/Appium**: match native alert buttons by TEXT, e.g. Detox `element(by.text('Delete'))`, Appium `driver.findElement(By.xpath("//*[@text='Delete']"))`.
- **Playwright**: register `page.on('dialog')` BEFORE the triggering action; `dialog.accept()` / `dialog.dismiss()`; assert text via `dialog.message()`.
- **Stripe PaymentSheet**: enter a test card (e.g. 4242 4242 4242 4242) directly into the native sheet's text fields; sheet is native, no app testID.

Authoring consequence: any test case touching one of these categories sets `Locator hints:` = "N/A — see Dependencies" and `Dependencies:` = the concrete handling technique (per test-authoring-conventions.md).
