# QA Task — Verify FIX-Task-28 on-device, then Low-SP Persona + Group N + More-From-Seller/Favorites

**Date:** 2026-09-13
**Run folder:** `e2e-test-results/qa-fix28-verify-lowsp-n-s-2026-09-13/`
**Platform driven:** Android emulator `Medium_Phone_API_36.1` (app `com.sameralzubaidi.p2pmarketplace`, Metro on `:8082`)
**iOS Simulator (`iPhone 17 Pro Max`, iOS 26.1):** booted but **NOT driven — no iOS verdict claimed (R80).**
**Admin portal:** up on `:3001` — **not reached** this round (no admin-UI case in scope; the one config write used the sanctioned `qa:admin-config-set` helper, R37).
**Evidence:** 37 on-disk screenshots in `screenshots/`.
**Compliance:** no source/test/seed/config files modified; the only writes were (a) the sanctioned `qa:set-sp-balance` fixture (set→restore, DB-verified) and (b) the sanctioned `qa:admin-config-set` `min_listing_price` write (set→revert, DB-verified).

---

## 1. HEADLINE — Phase 0 / FIX-Task-28 items 1a/1b/1c: ✅ **ALL PASS — the priority subscription-status fix WORKS**

The priority fix is verified on-device end-to-end. The subscription-status lie (an active subscriber being shown the free-tier "Unlock Swap Points / Upgrade →" upsell on a transient read failure) **no longer reproduces**.

| Leg | Scenario | Observed | Verdict |
|---|---|---|---|
| **1a** | `subscription_read_failure=read_failure` armed + cold relaunch (no last-known) | Home SP strip renders **`sp-strip-unverified` — "⚠ We couldn't check your plan" + "Try again"** (slate strip). The free-tier upsell is **absent**. Scrolled Home: Subscription card badge reads **"Plan unavailable"** (never "Free Plan") and the "Upgrade to Kids Club+" CTA is suppressed. | ✅ **PASS** |
| **1b** | Disarm → member strip present → re-arm → navigate to Profile → back to Home (focus refetch, read failing) | Member strip **persists**: "458 SP / Earn More →". No upsell, no downgrade. | ✅ **PASS** |
| **1c** | Disarmed → `qa-login-as?persona=test-free` | The genuine free-tier upsell **still renders**: "📈 Unlock Swap Points / Upgrade →". No over-correction. | ✅ **PASS** |

**Evidence:** `P0-09-ITEM1a-home-unverified-strip-PASS.png`, `P0-10-ITEM1a-plan-unavailable-badge.png`, `P0-12-ITEM1b-home-lastknown-preserved.png`, `P0-15-ITEM1c-testfree-upsell.png`.
**Source corroboration:** `UserDashboardScreen.tsx` — three-way SP-strip branch (`canSpendSP` → member strip; `planUnverified` → `sp-strip-unverified` + `sp-strip-retry`; else free upsell) and `subBadgeLabel` returning `'Plan unavailable'` when `planUnverified`.

**Design observation (LOW, not a deviation):** the unverified strip and the free-tier upsell share the same slate surface (`styles.spStripFree`). They differ only by icon + copy ("⚠ We couldn't check your plan" + Try again vs "📈 Unlock Swap Points" + Upgrade →). A paying subscriber who sees the unverified state is looking at a strip styled identically to the upgrade nudge — worth a product confirm that the two states should be visually distinguishable, but the copy is unambiguous, so this is **not** filed as a deviation.

---

## 2. Phase 0 — remaining FIX-Task-28 items

| Item | Assertion | Result | Evidence |
|---|---|---|---|
| **3** | Disclaimer full label row toggles the checkbox (not just the 63 px square) | ✅ **PASS** — checkbox row `{42,2044,996×126}`; tapping the **far-right end of the label row at x=900** (≈860 px from the 35 px square at x=56) flipped `disclaimer-modal-checkbox` to **`checked`** (the "✓" glyph appeared) and **enabled** `disclaimer-modal-accept-button` (was `disabled`). | `B3-10-ITEM3-disclaimer-label-toggle-PASS.png` |
| **4** | Trade List tiles show a placeholder, not false `0/0/0/0` | ✅ **PASS (source + unit-test); on-device transient NOT observed** — a fresh Trade List mount and a pull-to-refresh both resolved within the screenshot round-trip, so the `—` placeholder window was never captured. The tiles did render true values (6/1/0/42), i.e. **no false zeros**. Source confirms the gate: `summaryTotalsReady ? summary.X : summaryTilePlaceholder` (`summaryTilePlaceholder = '—'`, `TradeListScreen.tsx:801/804/1171-1248`) and the hint is blanked while not ready. The unit test asserts the placeholder. **Named as an unmet observation, not a PASS-by-frame.** | `P0-16-item4-tradelist-firstframe.png`, `P0-17-item4-pulltorefresh-placeholder.png` |
| **5** | Empty-URI image rows no longer raise the `source.uri should not be an empty string` LogBox warning | ✅ **PASS** — five surfaces rendered with image-less rows (Discover grid ×4 "No Image" cards, Item Detail "No listing photos available", Basket ×3 rows, Checkout ×3 rows, MoreFromThisSeller ×6 cards): **no LogBox overlay at any point**, and two `mobile_get_device_logs` windows filtered on `message=source.uri` (one spanning a Basket re-render) returned **zero** matching entries. Source: the three previously-unguarded `<Image source={{uri: …}}>` sites now omit the source when the URI is empty. *Residual limitation: the JS console channel is not exhaustively captured without CDP (§5.12); the log-window + overlay evidence is what was obtained.* | `B3-05-…`, `B3-06-…`, `B3-09-…`, `B3-11-…` |
| **7** | Double-refund investigation (`f9d53797`, `e54f608a`, `f2899f12`) | ✅ **CLOSED — NOT A DEFECT** (first-class "ruled out" result). All three trades carry two `trade_refunds` rows each, and each pair is a **deliberate split-component admin partial refund** whose own `reason` names it: e.g. *"QA K07 partial refund test: refund item price only, keep platform fee"* (`refund_price_cents` 2200) + *"QA K08 partial refund test: refund sales tax component only"* (`refund_tax_cents` 154) → sum **2354 = `payments.refunded_cents` 2354** (charged 2503, fee 149 kept). Same shape for `f2899f12` (2500 + 175 = 2675 = charged) and `f9d53797` (699 tax + 1000 price = 1699 = `refunded_cents`). Distinct Stripe refund ids, distinct components, actor `admin`, all `succeeded`. This is the intended two-call shape of `trade-refund` (its header documents per-component refunds), and these rows were produced **by QA's own K07/K08 tests**. No duplicate refund. | read-only SQL |
| **8** | Review Offer 8 s hint before the 20 s timeout, with a working "Back to Offers" escape | ✅ **PASS** — `offer_load_stall` armed; entering Review Offer showed the bare spinner + "Loading offer…", then at ~8 s **"Taking longer than usual…" + "Back to Offers"**, then the 20 s state **"We couldn't load this offer. Please try again." + "Try again" + "Back to Offers"**. Tapping **Back to Offers** returned cleanly to My Trades (Needs Action 6). Toggle disarmed and **verified** (`none`). Screenshot-only polling throughout (**R107** — no AX dump inside the stall window). | `B2-03…`, `B2-04-item8-reviewoffer-poll2.png`, `B2-05-item8-reviewoffer-poll3-timeout.png` |
| **9** | "more items" banner reads as plain text, not a second competing CTA | ✅ **PASS** — `cart-more-from-seller-banner` now renders flush on the page background (green 4-square icon + "This seller has 42 more items" + "View" link + X dismiss) with **no card fill/border/radius**. The only control reading as primary is the green "Make an offer for these 3 items" CTA card. | `B3-06-ITEM9-basket-more-items-banner.png` |
| **10** | SP strip tappable + real accessibility label | ✅ **PASS** — AX: `Button label="458 Swap Points. Open your SP Wallet" id="sp-strip"` (was the literal "Sp strip"), bounds `975×139 px`; tapping it opened the **Swap Points** wallet screen (458 SP, Shop/Sell/History, How to Earn SP). | `P0-18-ITEM10-sp-wallet-opened.png` |
| **11** | Checkout shows "Points remaining" **once** in the header | ✅ **PASS** — the Checkout AX tree contains exactly **one** `points-remaining-banner` ("Points remaining: 458"), hoisted and pinned above the scroll, and **zero** `sp-remaining-*` per-item repeats across all three item rows. | `B3-09…`, `B3-10…` |
| **2** | SP audit row on every release path | ⏸ **DEFERRED** — migration `20260913000001_fix_task_28_sp_release_audit.sql` is **written but NOT applied** (approval-gated). Tier 1/2 remain owed. |

---

## 3. Per-block results (TRD)

### Block 1 — Group N bulk-listing + remainder (Tier 1) — **PARTIAL: 1 of 5 reached**
`min_listing_price` set **0 → 5** via `qa:admin-config-set` (DB-verified) and **reverted 5 → 0** afterwards (DB-verified, R28/R37). **No residual config change.**

| Case | Result | Notes |
|---|---|---|
| **N11** (single-item edit below threshold) | ✅ **PASS (behaviour) + 📄 DOC-DRIFT** | Drove Edit Listing on a real listing, replaced the price 28 → **3** (`CTRL+A` + retype, R77 #4), Save Changes → **"Error / Price must be at least $5.00 to be listed"** with OK only; **the listing was NOT saved** (form remained open with edits intact) and the threshold correctly read the **live admin config** ($5.00). **DOC-DRIFT:** the guide's N11 expected result describes a *"Let's Adjust Your Price"* modal with an *"Update Price"* button that auto-scrolls and auto-focuses the price field — **that surface does not exist in this build**; the shipped affordance is a plain error alert whose copy is identical to N13's expected bulk-publish error. |
| **N05, N12, N13** (bulk listing) | ⏭ **NOT REACHED** | Bulk-listing requires 3+ uploaded photos grouped into items. Standing Android fact (R98 addendum): the emulator picker yields **single-select only** and reports "No photos yet" for multi-photo selection, so a 2+ photo bulk session is not assemblable on this device. Already ✅ PASS on record; no conversion was available. |
| **N08** (single-item + bundle checkout at/above threshold) | ⏭ **NOT REACHED** | Requires a full purchase (offer → seller accept → buyer confirm) for both a single item and a bundle; out of this session's budget. Already ✅ PASS on record. |

### Block 2 — T03 / T12–T14 with the new Low-SP persona

**The low-SP fixture was built and it works** — `npm run qa:set-sp-balance -- --persona test-buyer --amount 8` (sanctioned DT-75 fixture script; DB-verified `available=8, reserved=0, state=active`, ledger `earn_admin_grant` 458→8), then **restored to 458** and DB-verified at the end.

| Case | Result | Notes |
|---|---|---|
| **T03** — partial amount when wallet insufficient | ✅ **PASS — 🟡 PARTIAL→✅ CONVERSION** | The guide's exact 8-SP scenario is now reproducible. Checkout read **"Points remaining: 8"**; entering **20** into an item whose category cap is 19 **clamped to 8**; the hint read **"You can use up to 8 SP"** with subtext **"Limited by your SP balance"**; the counter went to **"Points remaining: 0"**. All three of T03's expected bullets met, verbatim. |
| **T12** (no ledger transaction on offer decline) | ⏭ NOT REACHED | Needs a submitted offer + seller decline + ledger/wallet read-backs — a multi-persona round of its own. Already ✅ PASS on record. |
| **T13** (single-item SP flow still works, end-to-end) | ⏭ NOT REACHED | Needs a full submit → accept → confirm cycle. Already ✅ PASS on record. |
| **T14** (bundle CTA / different-seller modal / more-from-seller regression) | 🟡 **PARTIAL evidence added** | Two of the three limbs were driven on-device this round: the bundle CTA read **"Make one offer for these 3 items" / "All items from this seller"** (no "Bundle") ✓ and Item Detail's **"This seller has 42 more items"** CTA + MoreFromThisSeller page ✓. The **different-seller modal** was not triggered (no cross-seller add this round). Already ✅ PASS on record. |

### Block 3 — Remaining S (More-From-Seller / Favorites journey)

| Case | Result | Notes |
|---|---|---|
| **S15** (CTA hidden at 0 additional listings) | 🟡 **STAYS PARTIAL — BLOCKED (fixture)** | The precondition is *a seller with exactly 1 approved listing*. DB check: `test-seller` has **43** available+approved listings and `test-seller-2` has **3**; **no standing persona has exactly 1**. Not reachable without a new fixture (a fresh throwaway seller with a single listing). Named, not silently skipped. |
| **S16** (CTA does not disrupt "Matches Your Trade Basket" badge) | ✅ **PASS — 🟡 PARTIAL→✅ CONVERSION** | On Item Detail (buyer cart already contains 3 of that seller's items): the **"Matches Your Trade Basket"** badge renders **inside** the Seller Info card, and the standalone **"This seller has 42 more items / From $12.00 · add more to bundle into one trade →"** CTA renders **below** the card — both simultaneously visible and legible; Contact Seller + View Profile unmoved. Reached the true bottom across 2 swipes (R103). |
| **S18** (Trade Basket banner recalculates after adding from the filtered page) | ✅ **PASS — 🟡 PARTIAL→✅ CONVERSION** | Basket banner read **"This seller has 42 more items"** with 1 item in the basket; after adding **2 more** from MoreFromThisSeller it read **"This seller has 40 more items"** (−1 per add). Cross-checked against the DB: `test-seller` has exactly **43** available+approved listings ⇒ 43 − 3 in basket = **40** ✓ exact arithmetic. |
| **S19** (banner disappears when all of a seller's listings are in the basket) | ⏭ NOT REACHED | Reachable only via `test-seller-2` (exactly 3 listings) and requires replacing the current cart (different-seller modal) + 3 adds; out of budget. Already 🟡 PARTIAL (source-confirmed). |
| **S24** (return-to-cart navigation after adding from the filtered page) | 📄 **DOC-DRIFT — 🟡 PARTIAL→📄** | Driven end-to-end: adding from MoreFromThisSeller flips the card to **"In Trade Basket"** (+ a persistent "Items from this seller match your active cart." bar, and the Basket badge increments) — but **no alert is shown and the app does NOT navigate back to the Trade Basket**. Source (FIX-Task-25 item 12 comment) documents this as **deliberate**: the button now taps through to the basket when already in it, and the page intentionally stays put so the buyer can keep adding; the confirmation is a non-blocking `SuccessToast` ("Added to Trade Basket"), not an `Alert.alert` (consistent with the app's M16/M18 toast convention, V07/V13 copy family). Both of the guide's stated mechanisms are therefore superseded by design; the underlying behaviour (item added, cart contains it, banner recalculated) was verified. *The toast itself was not frame-captured (2.5 s auto-dismiss outran the screenshot round-trip) — its copy is source-confirmed, and that gap is named here rather than implied.* |

### Block 4 — Remaining M (Cart / Favorites)

| Case | Result | Notes |
|---|---|---|
| **M14** (Favorites add / remove) | ✅ **PASS (Android)** | Discover card heart → filled green; DB read-back confirmed the write (`favorites.id 266e88df`, `item_id 18a41ad8`, `deleted_at null`); Favorites row appeared on a fresh mount; the remove control (red trash) raised an in-app **`GlobalAlertProvider`** confirm ("Remove favorite? / This item will be removed from your favorites." — `global-alert-button-0/1`, empirically verified per §5.4, **not** native) → item removed, empty state restored. |
| **M15** (availability + friendly empty state) | ✅ **PASS (empty-state leg, Android)** | Empty state renders `favorites-empty`: heart glyph + **"No favorites yet"** + **"Tap the heart on any listing to save it for later."** + a "Browse Items" CTA. The *unavailable-item overlay* leg was not driven (needs a favourited item that is later sold). |
| **M19** (Home Favorites tile navigates to Favorites) | ✅ **PASS (Android)** | `action-tile-favorites` → Favorites screen. |
| **M20** (Discover header heart navigates to Favorites) | ✅ **PASS (Android)** | `discover-header-favorites`, AX label **"View Favorites"**, neutral-gray outline heart; tapping opened Favorites. Icon is a navigation trigger only (does not toggle). |

### Block 5 — Remaining V / X

| Case | Result | Notes |
|---|---|---|
| **V08** ("Matches Your Trade Basket" badge copy) | ✅ **PASS (Android)** | The exact copy renders on-device on both surfaces: the Item Detail Seller-Info card badge and the MoreFromThisSeller card labels ("…, Matches Your Trade Basket") — never "Matches Your Cart". |
| **V12** (Bundle Builder title "Build Offer") | ⏭ NOT REACHED | The Bundle Builder screen was not reached from Trade Basket this round (the basket's CTA routes to Checkout in combined-offer mode). Already ✅ PASS on record. |
| **V13** (Favorites "Added to Trade Basket" alert) | 📄 **DOC-DRIFT — 🟡 PARTIAL→📄 (root cause found)** | The prior round's "favorites-screen trigger not driven" was **not a QA gap**: `FavoritesScreen.tsx` renders each row with **only** `favorite-request-buy-<id>` (primary "Request to Buy") and `favorite-remove-<id>` (trash) — there is **no "Add to Trade Basket" action on the Favorites screen** (verified in source *and* in the live AX tree: `favorite-row-18a41ad8-…` exposes exactly those two controls). The case's step 2 is therefore unreachable by construction. The alert copy itself ("Added to Trade Basket") is verified on the reachable add path (M16/M18/V07 family) and the toast/alert used by MoreFromThisSeller is source-confirmed. **Recommend:** either add the basket affordance to Favorites or amend the guide. |
| **X08** (bottom nav on Profile, Settings, Wallet, Subscriptions, My Listings) | ✅ **PASS (5 of 6 surfaces re-driven on Android)** | Bottom nav present and unchanged on **My Profile**, **Settings**, **SP Wallet**, **My Trades** and **My Listings** (AX-confirmed `tab-home`/`tab-discover`/`tab-sell`/`tab-trades`/`tab-basket` on each). **The Subscription surface was not separately re-driven** — the bar is a navigator-level element identical on every screen, so this is a named, low-risk gap rather than an implied verification. |

---

## 4. New findings (ranked)

| # | Sev | Finding | Evidence | Class |
|---|---|---|---|---|
| **F1** | **LOW–MED** | **Stale Favorites after favouriting (R59 class).** Immediately after tapping a Discover card's heart (the write landed — DB-confirmed), opening **Favorites** showed **"No favorites yet"**. A fresh mount (Home → Favorites) then listed the item correctly. A user who favourites from Discover and opens Favorites can be told they have no favorites. | `B3-02-STALE-favorites-empty-despite-DB-write.png` (stale) vs `B3-03-FRESH-favorites-shows-item-M14-PASS.png` (correct) + `favorites` row `266e88df` | App (staleness) |
| **F2** | **LOW** | **N11 guide drift:** the single-item below-threshold save shows a plain **"Error / Price must be at least $5.00 to be listed"** alert (OK only) — **no "Let's Adjust Your Price" modal, no "Update Price" button, no auto-scroll/auto-focus** as the guide's N11 expects. The behaviour (save blocked) and the dynamic threshold are correct. | `B1-02-N11-price-adjust-modal.png` | Doc drift |
| **F3** | **LOW** | **V13 unreachable trigger:** the Favorites row has no "Add to Trade Basket" action (source + live AX). | `favorite-row-*` AX; `FavoritesScreen.tsx:117-147` | Doc drift / product gap |
| **F4** | **LOW** | **S24 mechanism drift:** no alert and no return-to-cart navigation after adding from MoreFromThisSeller; the build uses a `SuccessToast` + in-place "In Trade Basket" state (deliberate, FIX-Task-25 item 12). | `B3-07-S18-S24-after-add-from-filtered-page.png`; `MoreFromThisSellerScreen.tsx:281-301` | Doc drift |
| **F5** | **LOW** | **Banner sub-line copy is a bare verb:** the Trade Basket's more-items banner's second line is just **"View"**, where the Item Detail twin says "From $12.00 · add more to bundle into one trade —". Concrete rewrite: **"Browse all items from this seller"** (or "View all items from this seller"). | `B3-06-ITEM9-basket-more-items-banner.png` | Copy (§6.3) |
| **F6** | **LOW** | **MoreFromThisSeller page title drift:** the guide's S21 expects **"More items from this seller"**; the build renders **"More from this seller"** (`screen-title`). | `B3-11-V08-S16-itemdetail-true-bottom.png` | Doc drift |
| **F7** | **INFO (env)** | **Cold dev-client bundle load is very slow** — a terminate+launch cycle landed on the Expo dev launcher and the "Loading from 10.0.2.2:8082…" phase ran for many minutes (twice this round). Metro `/status` answered `packager-status:running` throughout, so this is a **bundle transform/load-time** cost, not a dead server. Budget for it: relaunch-heavy rounds are disproportionately expensive. | `P0-05…`, `P0-07…`, `P0-08-bundle-loading.png` | Environment / friction |
| **F8** | **INFO (env)** | **`qa-scroll-to?testID=send-offer-button` reported success but did not scroll** on Android (the Checkout stayed at the top; 3 manual swipes were needed). This re-confirms **R94**: a QA tool's own success signal is not proof the UI moved, and the `qa-scroll-to` automation is iOS-only in practice. | `B3-09-checkout-after-scrollto.png` | Tooling |
| **F9** | **INFO (env)** | A warm `qa-login-as?persona=test-buyer` switch **wedged** the app (Home spinner, no content, re-firing the link did not help); a force-stop + cold relaunch recovered immediately — the **R101** signature. | inline | Tooling / R101 |
| **F10** | **INFO (env)** | `qa:set-sp-balance`'s restore run logged **`Gateway Timeout` on the ledger insert** while the wallet write itself succeeded and verified (`available=458`). One transient, not an outage (R102 would need a second limb); noted so a future run doesn't misread it. | terminal output | Environment |
| **F11** | **MED** | **`#007AFF` (iOS system blue) is used as a PRIMARY BUTTON on live screens — a BP-82 forbidden-token leak that QA's standing sweep structurally cannot see.** **On-device proven:** the Edit Listing screen's full-width **"+ Add Photo"** button (`edit-listing-image-picker-add-photo`, `{53,1034,975×127}`) is **97.48% `#007AFF`-family pixels and 0.00% green**, while the **"Save Changes"** button on the *same screen and same frame* is **0.00% blue and 94.10% green** (`#5DBB8E`) — i.e. **two competing primaries in two different palettes on one form**, violating BP-82 and the max-one-primary rule. Source: `ImagePickerGrid.tsx:408` `addPhotoButton: { backgroundColor: '#007AFF' }` (plus `:355` photo-source-modal options and `:257` the upload spinner). **Source-identified, NOT yet on-device verified** (each needs its own drive; some may be dead branches): `screens/listing/PriceSuggestionCard.tsx` (6 uses), `screens/trade/TradeInitiationScreen.tsx:980`, `screens/admin/AdminDashboardScreen.tsx:75,200`, `screens/home/ItemDetailScreen.tsx:1872`, `components/discovery/CategoryFilterChip.tsx:107,125`, `components/atoms/Button/index.tsx:14` (`#0066FF` — a third blue), `hooks/usePaymentSheet.ts:122` (Stripe sheet appearance — likely intentional). **Confirmed NOT leaks (dead/orphaned):** `src/screens/LoginScreen.tsx` + `src/screens/SignupScreen.tsx` are orphans — the navigator imports `@/screens/auth/LoginScreen` / `@/screens/auth/SignupScreen` (`AppNavigator.tsx:19-20`), so their `#007AFF` styles are unreachable; `src/screens/auth/*.old.tsx` are explicitly dead. **⚠ Process gap:** the QA playbook's standing sweep (§5.63 **R62b**) hard-codes only the bare 3-hex list `#4A7C59\|#4D4D4D\|#808080`, while the dev-side **BP-82 rule 7** already prescribes the full forbidden list (`#4CAF50\|#E53935\|#29B6F6\|#0066CC\|#007AFF\|#93C5FD\|#D97706\|#111827\|#6B7280\|#D1D5DB\|#4A7C59\|#4D4D4D\|#808080`) and notes the class "recurs beyond subscription/ — profile + trade screens too". A recent round already fixed ONE instance of this exact class (`MyListingsScreen.tsx:975` — "FIX-Task-26 item 7 (QA F10, same BP-82 class…): was #007AFF") but nobody swept the family — the R58/BP-82-rule-6 systemic-sweep discipline missed again. | `FINDING-editlisting-blue-add-photo.png` + `qa:badge-scan` (2 runs) + source | App (design system, MED) + **playbook rule gap** |
| **F12** | **INFO (process)** | **This finding was MISSED in the first pass of this very round.** I drove Edit Listing for N11 and read `edit-listing-image-picker-add-photo` in the AX tree — but the AX tree reports bounds and labels, never colour, and I never ran a colour scan nor added an "Edit Listing" row to the §6.4 design table. The colour deviation was only surfaced when the owner pointed at the screenshot. **Lesson:** a screen driven for a *functional* case still owes the §6.4 visual pass, and any full-width filled button is a colour-scan target of its own. | this report's revision | Process |

---

## 5. Perceived load times

*Label: simulator/emulator wall-clock, ±polling-interval precision — not a formal performance profile (§5.7).*

| Screen → transition | Elapsed | Flag |
|---|---|---|
| App cold start → dev launcher | seconds | — |
| Dev launcher → Home (bundle load from Metro :8082) | **many minutes** (2 occurrences) | ⚠ **≥3 s — F7** |
| `qa-login-as` persona switch → Home rendered | test-free ≈ 1 poll; test-seller ≈ 1 poll; **test-buyer = never (wedge, F9)** | ⚠ |
| Home → My Trades (fresh mount, tiles resolved) | < 1 s (placeholder window never observable) | — |
| Basket → Checkout | immediate | — |
| Checkout → Send Offer → disclaimer modal | immediate | — |
| Review Offer → stalled load → 8 s hint | **~8 s (by design) → 20 s error** | intended |
| Discover heart → Favorites (stale) / fresh mount (correct) | immediate both ways | — |

**Verdict:** **FLAGGED** — the single flagged item is the dev-build **cold bundle load** (an environment artifact of the Metro dev server, not app behaviour). Every app-level transition inside a running session rendered within the <3 s ideal.

---

## 6. Design-system & copy review (per-screen)

Every screen and dialog visited was checked against `docx/design-system-passitup.md` (§6.4).

| Screen / dialog | Structural (§6.2) | Wording (§6.3) | Design system (§6.4) |
|---|---|---|---|
| Home (subscriber, member strip) | OK | OK | CONFIRMED — green member strip, one primary, 12pt-scale type, 4-tile grid aligned |
| Home (unverified strip) | OK — clear error state + single retry | OK — "We couldn't check your plan" is plain and honest | CONFIRMED (with the LOW note in §1 about shared slate styling) |
| Home (free upsell) | OK | OK | CONFIRMED |
| Subscription card badge ("Plan unavailable") | OK | OK — no false "Free Plan" | CONFIRMED — neutral gray badge for unknown |
| Swap Points (SP Wallet) | OK | OK | CONFIRMED — gold/green SP surfaces, section rhythm |
| My Trades (summary tiles) | OK | OK | CONFIRMED — 4-tile stat row, pill status chips ("PENDING"/"OFFER"), progress bar |
| Trade Basket (banner + CTA) | OK after item 9 | **DEVIATION (LOW)** — banner sub-line is the bare verb "View" → rewrite "Browse all items from this seller" (F5) | CONFIRMED — one primary (green CTA card); banner is now plain text |
| Item Detail (Seller Info + more-from-seller CTA) | OK | OK — "This seller has 42 more items / From $12.00 · add more to bundle into one trade →" | CONFIRMED — badge inside the card, CTA below; Contact Seller (primary) + View Profile (secondary outline) |
| MoreFromThisSeller | OK | **DEVIATION (LOW)** — title "More from this seller" vs the guide's "More items from this seller" (F6) | CONFIRMED — card grid, "In Trade Basket" disabled style, "Add to Trade Basket" outline |
| Discover (grid + header) | OK | OK | CONFIRMED — "View Favorites" header heart, filter/sort/SP toggle row, "No Image" placeholder is a clean neutral tile |
| Checkout (combined offer) | OK — pinned "Points remaining" reads well | OK | CONFIRMED — one primary (Send Offer), secondary "Go Back"; per-item SP rows in SP gold |
| **Liability Disclaimer modal** | OK — scrollable body, checkbox row + Cancel/Accept | Content **out of scope** (Amazon boilerplate — owner-excluded, standalone CRITICAL) | CONFIRMED — accept disabled (pastel) until checked, then enabled; destructive/secondary hierarchy correct |
| **"Let's Adjust Your Price"→ "Error / Price must be at least $5.00…" dialog** | OK — single modal, form remains intact | **DEVIATION (LOW)** — guide expects a 2-action "Let's Adjust Your Price / Update Price" flow; build shows a 1-action error (F2) | CONFIRMED — branded in-app dialog, primary pill |
| **"Remove favorite?" confirm** | OK | OK — unambiguous consequence line | CONFIRMED — secondary outline Cancel + destructive red Remove (max one primary respected) |
| **Review Offer (loading / 8 s hint / 20 s error)** | OK — bare spinner then an honest hint then a recoverable error with two exits | OK — "Taking longer than usual…" is plain and non-alarming | CONFIRMED — green text link for the escape, primary pill for "Try again" |
| **Edit Listing** (driven for N11) | OK — long form, sticky Save, sectioned | OK | **DEVIATION (MED) — off-brand PRIMARY colour.** "+ Add Photo" renders as a full-width filled **`#007AFF` (iOS system blue)** button (97.48% blue / 0.00% green by pixel scan) sitting on the same form as a **`#5DBB8E` green** "Save Changes" (94.10% green / 0.00% blue) ⇒ **two competing primaries in two palettes**. BP-82 forbids `#007AFF` (`ImagePickerGrid.tsx:408`). *This row was MISSING from the first pass — see F12.* |
| Settings | OK | OK | CONFIRMED — canonical header/back, sectioned rows, Danger Zone in red |
| My Listings | OK | OK | CONFIRMED — stat row, filter chips with "All" selected, per-card edit/delete actions |
| My Profile | OK | OK | CONFIRMED — avatar, stat trio, member/share/verification rows, badge showcase |

**Off-brand-hex sweep — CORRECTED (the first pass was incomplete; see F11/F12).** The original wording here claimed "no screen-wide off-brand hex was observed"; that was **not a verified negative** — the mandated app-wide grep was **not run** that pass, and the playbook's standing form of it (R62b) is the **bare 3-hex list**, which does not contain `#007AFF`. Running the **BP-82 rule-7 full list** afterwards found a live, on-device-proven `#007AFF` primary button (F11). The per-screen review above is visual + AX-bounds based; **it does not substitute for the hex sweep**, and the sweep must use the full BP-82 list.

---

## 7. Friction vs the operating rules

1. **Cold bundle load (F7)** dominated the round's wall-clock; two terminate+launch cycles consumed a large share of the session.
2. **`qa-scroll-to` is inert on Android (F8)** — cost 1 call plus 3 manual swipes; already documented as R94, re-confirmed here.
3. **Persona-switch wedge (F9)** — cost ~5 calls before the R101 force-stop.
4. **R107 was applied successfully** across the `offer_load_stall` window (screenshot-only polling + `qa:ocr --coords` for the OK/escape coordinates) — zero dev-client crashes this round. The `--coords` mode is a genuine improvement: it resolved every dialog coordinate in one call.
5. **`mobile_get_device_logs` + `mobile_batch_commands` pairing worked well for item 5** (tap-to-re-render then capture logs in one call) — a cheap pattern worth keeping.
6. **AX-tree viewport limitation bit twice** (R103): `profile-settings` and the Item Detail Seller-Info block were both absent from the first tree read and appeared only after scrolling. The "scroll to the true bottom before claiming absence" discipline held.

---

## 8. App state left behind

| Item | State |
|---|---|
| `admin_config.min_listing_price` | **0** — set 0→5 for N11 and reverted 5→0; both writes DB-verified (R28). Same as the pre-run baseline. |
| `test-buyer` SP wallet | **458 available / 0 pending / 0 reserved, active** — set 458→8 for T03 and restored 8→458; both DB-verified. (The restore's ledger insert hit a transient `Gateway Timeout`; the wallet value verified.) |
| QA dev toggles | `subscription_read_failure = none`, `offer_load_stall = none` — both **verified** by the toggle dialog's read-back, not just round-tripped. |
| `test-buyer` favorites | **empty** — the favourited item was removed during M14 (the row remains soft-deleted by design). |
| `test-buyer` cart | **3 items** — the three "QA Bundle Fixture N of 3 (2026-09-13)" listings from `test-seller` (created this round to drive items 9/11/3 and S16/S18). Cleanup: remove them from the Basket, or `npm run qa:reset-offer-fixtures -- --persona test-buyer`. |
| Session | logged in as **test-seller**, sitting in Edit Listing (the N11 form, unsaved). |
| Migrations | `20260913000001_fix_task_28_sp_release_audit.sql` remains **unapplied** (item 2 still deferred). |

---

## 9. Verdict roll-up

| Block | Driven | Conversions |
|---|---|---|
| **Phase 0 (FIX-Task-28)** | 9 of 11 items (1a/1b/1c, 3, 4, 5, 7, 8, 9, 10, 11) | **Headline: 1a/1b/1c all PASS — the priority fix is confirmed working.** Item 7 closed as NOT A DEFECT; item 2 deferred (migration unapplied). |
| **Block 1 (N)** | 1 of 5 (N11) | 0 (N11 already PASS; added a DOC-DRIFT finding) |
| **Block 2 (T)** | 1 of 4 (T03) | **1 (T03 PARTIAL→PASS)** |
| **Block 3 (S)** | 3 of 5 (S16, S18, S24) | **2 PASS conversions (S16, S18) + 1 DOC-DRIFT (S24)** |
| **Block 4 (M)** | 4 of 4 (M14, M15, M19, M20) | 0 (all already PASS; Android evidence added) |
| **Block 5 (V/X)** | 2 of 4 (V08, X08) + V13 root-caused | **1 DOC-DRIFT (V13)** |

**Total conversions this round: 3 PASS (T03, S16, S18) + 2 DOC-DRIFT (S24, V13) = 5 tracker flips.**

**Not reached, named explicitly (R40):** N05, N12, N13, N08 (bulk-listing not assemblable on this emulator — R98; N08 needs a full purchase), T12, T13 (multi-persona offer cycles), S15 (no seller fixture with exactly 1 listing), S19 (needs the test-seller-2 3-listing cart rebuild), V12 (Bundle Builder not reachable from Trade Basket), and X08's Subscription surface.

---

## 10. Recommended follow-ups (dev-side, separate tasks — not applied in-run)

1. **F1 — fix the Favorites staleness** (MED priority for UX): refresh or invalidate Favorites when a favorite is toggled elsewhere (focus-fetch on the Favorites route, or a shared favorites store). Evidence pair `B3-02` → `B3-03`.
2. **Guide/tracker corrections** (doc-only): N11's "Let's Adjust Your Price" modal (F2), V13's Favorites basket action (F3), S24's alert + auto-navigation (F4), S21's MoreFromThisSeller title (F6).
3. **Copy polish:** Trade Basket's more-items banner sub-line "View" → "Browse all items from this seller" (F5).
4. **Tooling:** give `qa:scroll-to` an Android implementation or make it fail loudly instead of reporting success (F8).
5. **Fixture ask:** a throwaway seller with **exactly one** approved listing would unblock S15; a seeded multi-photo set for the Android emulator gallery would unblock the entire bulk-listing block (N05/N12/N13) — both are named prerequisites rather than code fixes.

---

## 📋 QA Session Handoff

**Test Scope:** Phase 0 = FIX-Task-28 on-device verification (items 1a/1b/1c, 3, 4, 5, 7, 8, 9, 10, 11) · TRD Block 1 (N11) · TRD Block 2 (T03, T14 partial) · TRD Block 3 (S15/S16/S18/S19/S24) · TRD Block 4 (M14/M15/M19/M20) · TRD Block 5 (V08/V12/V13/X08).
**Design-System Compliance:** **FAIL** (corrected — see F11; the first pass reported PARTIAL because the off-brand-hex sweep was not actually run). One **MED colour deviation**: the Edit Listing screen's full-width **"+ Add Photo"** primary renders in **`#007AFF` (iOS system blue)** — a BP-82 forbidden token — on the same form as a **green `#5DBB8E`** "Save Changes", i.e. **two competing primaries in two palettes** (on-device pixel-proven: 97.48% blue / 0.00% green vs 94.10% green / 0.00% blue). Plus three LOW copy/affordance deviations: (1) the Trade Basket more-items banner sub-line is the bare verb "View"; (2) the below-threshold save dialog doesn't match the guide's "Let's Adjust Your Price"/"Update Price" 2-action design; (3) MoreFromThisSeller's title is "More from this seller" vs the guide's "More items from this seller". All dialogs reviewed (Disclaimer, Remove favourite, threshold error, Review Offer states, toggle-applied) use the documented in-app branded style with correct button hierarchy (max one primary) and disabled/enabled pill states.
**Perceived Load-Time Verdict:** FLAGGED — the dev-build **cold bundle load from Metro (:8082)** ran for many minutes on both terminate+launch cycles (`Dark`-flagged environment artifact of the dev server, not app behaviour). Every in-session app transition (Home→Trades, Basket→Checkout, checkout modal, Review Offer) rendered within the <3 s ideal; the only ≥3 s in-app timings were the deliberate 8 s hint and 20 s timeout of the `offer_load_stall` test.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Home (member strip / unverified strip / free upsell): wording plain and honest, single retry, one primary per state.
- CONFIRMED — Subscription card badge ("Plan unavailable"): never claims "Free Plan" when unknown.
- CONFIRMED — Swap Points (SP Wallet): SP-gold surfaces, section rhythm, no stray primaries.
- CONFIRMED — My Trades summary tiles + offer/bundle cards: stat row, status chips, progress bar.
- CONFIRMED — Trade Basket: one primary CTA (green combined-offer card); more-items banner is now plain text. **DEVIATION (LOW)** — banner sub-line "View" is a bare verb; rewrite "Browse all items from this seller".
- CONFIRMED — Item Detail (Seller Info + more-from-seller CTA): badge inside card, CTA below, correct primary/secondary button pair.
- CONFIRMED — MoreFromThisSeller: card grid, "In Trade Basket" disabled state, "Add to Trade Basket" outline. **DEVIATION (LOW)** — title "More from this seller" ≠ guide's "More items from this seller".
- CONFIRMED — Discover (grid + header + filter row): "View Favorites" label, neutral placeholder for image-less items.
- CONFIRMED — Checkout (combined offer): pinned "Points remaining", one primary (Send Offer) + secondary "Go Back", per-item SP rows.
- CONFIRMED — Liability Disclaimer modal (structure/hierarchy only; **content out of scope**).
- **DEVIATION (LOW)** — Below-threshold save dialog: shows "Error / Price must be at least $5.00 to be listed" (OK only) instead of the guide's "Let's Adjust Your Price" + "Update Price" with auto-scroll/focus.
- CONFIRMED — "Remove favorite?" confirm: secondary outline Cancel + destructive red Remove.
- CONFIRMED — Review Offer loading / 8 s hint / 20 s error: honest copy, recoverable, two exits.
- CONFIRMED — Settings and My Profile: canonical header/back, sectioned rows, danger actions in red.
- CONFIRMED — My Listings: stat row, filter chips, per-card actions.
- **DEVIATION (MED)** — **Edit Listing**: "+ Add Photo" is a full-width filled **`#007AFF` (iOS system blue)** primary (BP-82 forbidden), sitting above a green `#5DBB8E` "Save Changes" — **two competing primaries in two palettes on one form**; pixel-proven 97.48% blue vs 94.10% green on the same frame. Also carries `#007AFF` photo-source-modal options + upload spinner (`ImagePickerGrid.tsx:257/355/408`).
**Verdict Summary:** **14 PASS / 0 FAIL / 2 DEFERRED-BLOCKED (item 2 migration-unapplied; S15 fixture) / 6 NOT REACHED (named) / 2 DOC-DRIFT flips (S24, V13)** — headline: FIX-Task-28 items 1a/1b/1c ✅ PASS.
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — **5 flips:** `TRD-TC-T03` 🟡 PARTIAL→✅ PASS · `TRD-TC-S16` 🟡 PARTIAL→✅ PASS · `TRD-TC-S18` 🟡 PARTIAL→✅ PASS · `TRD-TC-S24` 🟡 PARTIAL→📄 DOC-DRIFT · `TRD-TC-V13` 🟡 PARTIAL→📄 DOC-DRIFT. **TRD totals: was 274 PASS / 33 PARTIAL / 0 OPEN / 7 DOC-DRIFT / 3 SKIPPED / 16 Remaining = 333 → now 277 PASS / 28 PARTIAL / 0 OPEN / 9 DOC-DRIFT / 3 SKIPPED / 16 Remaining = 333 ✓** (277+28+0+9+3+16 = 333; header ⇄ §1 roll-up ⇄ section header reconciled, R56). Android-coverage evidence (no status change) added to N11, M14, M15, M19, M20, V08, X08 and the FIX-Task-28 item notes.
**Critical Findings:**
1. **F11 (MED) — a BP-82 forbidden-token leak, on-device proven: the Edit Listing "+ Add Photo" button is a filled `#007AFF` iOS-system-blue primary** (97.48% blue / 0.00% green by pixel scan) rendering directly above a green `#5DBB8E` "Save Changes" (94.10% green / 0.00% blue) — **two competing primaries in two palettes on one form**. Source `ImagePickerGrid.tsx:408` (+ `:355`/`:257`). Further live-file candidates named in F11 need their own drives; `src/screens/LoginScreen.tsx`/`SignupScreen.tsx` are **orphans, not leaks**.
2. **F12 (process) — this round MISSED that deviation in its first pass.** I drove Edit Listing for N11 and read `edit-listing-image-picker-add-photo` in the AX tree, but the AX tree carries no colour, the §6.4 sweep was not run, and no Edit Listing row was added to the design table. It surfaced only when the owner pointed at the screenshot.
3. **F11's rule gap (MED, playbook) —** the QA playbook's standing off-brand sweep (§5.63 R62b) hard-codes the **bare 3-hex list** `#4A7C59|#4D4D4D|#808080`, which **structurally cannot detect `#007AFF`**, while dev-side BP-82 rule 7 already prescribes the full 13-hex list. Two QA rules depend on a check that is blind to this whole family.
4. **None blocking functionally.** The priority subscription-status bug (FIX-Task-28 item 1) is **confirmed fixed** on-device in all three branches.
5. **F1 (LOW–MED)** — Favorites renders "No favorites yet" immediately after a favourite is written elsewhere; a fresh mount shows it correctly (R59-class staleness).
6. **F2/F3/F4/F6 (LOW)** — four guide-vs-build drifts (threshold modal copy; Favorites has no basket action; MoreFromThisSeller's toast + no auto-navigation; MoreFromThisSeller page title).
7. **F5 (LOW)** — bare-verb banner sub-line ("View").
8. **F7 (INFO)** — cold dev-client bundle load is minutes-long; the dominant cost of any relaunch-heavy round.
**App State Left Behind:** `min_listing_price` back to **0** (DB-verified) · `test-buyer` SP back to **458** (DB-verified) · both QA toggles verified **off** · `test-buyer` favorites **empty** · `test-buyer` cart **holds 3 QA Bundle Fixture items from `test-seller`** (cleanup: clear the Basket or `npm run qa:reset-offer-fixtures -- --persona test-buyer`) · session logged in as **test-seller** sitting in an unsaved Edit Listing form · migration `20260913000001` still unapplied.
**Why It Matters:** This round converts the round's *only* truly high-stakes open question — "does the priority subscription-status fix actually work for a paying subscriber?" — from unverified to **verified on-device in all three branches** (never-confirmed / last-known / genuine free), which is materially different from the source-and-unit-test evidence the fix shipped with. It also removes three long-standing TRD PARTIALs (T03 via the new low-SP fixture, S16, S18), and it *retires* two more by proving they were guide drift rather than missing coverage (S24, V13) — so the remaining TRD backlog is smaller **and** more honestly classified than at the start of the round.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-fix28-verify-lowsp-n-s-2026-09-13/screenshots/` (38 frames). **F11 (blue button):** open Edit Listing as `test-seller`, screenshot, then `npm run qa:badge-scan -- --img <shot> --region 53,1034,975,127 --token blue007AFF,rmin=0,rmax=70,gmin=90,gmax=165,bmin=215,bmax=255 --token green5DBB8E,rmin=60,rmax=130,gmin=160,gmax=215,bmin=110,bmax=175` (control: the same command on region `53,1929,975,136` for Save Changes). Frame: `FINDING-editlisting-blue-add-photo.png`. To re-check 1a: arm `p2pkidsmarketplace://qa-dev-toggle?key=subscription_read_failure&value=read_failure`, cold relaunch, and confirm Home shows "We couldn't check your plan" + Try again (never the upsell). To re-check T03: `npm run qa:set-sp-balance -- --persona test-buyer --amount 8`, open Checkout, type 20 into an item whose cap exceeds 8, and confirm the clamp to 8 + "Limited by your SP balance" + "Points remaining: 0"; restore with `--amount 458`. To re-check F1: favourite a Discover card, then open Favorites immediately (stale empty) vs after a Home round-trip (correct).
**Known Gaps / Not Tested:** N05/N12/N13/N08 (bulk-listing not assemblable on the emulator — single-select photo picker; N08 needs a full purchase) · T12/T13 (multi-persona offer cycles) · S15 (no seller fixture with exactly one approved listing) · S19 (needs the test-seller-2 3-listing cart rebuild) · V12 (Bundle Builder not reachable from Trade Basket) · X08's Subscription surface · M15's unavailable-item overlay leg · FIX-Task-28 item 2 (migration unapplied, Tier 1/2 owed) · FIX-Task-28 item 4's on-device placeholder transient (source + unit-test only) · S24's toast frame not captured (source-confirmed copy) · **iOS: not driven — no iOS verdict is claimed for any case in this round (R80).**
**What Needs To Be Fixed Next:**
1. **Fix the `#007AFF` primary-button leak (F11, MED — highest-value design fix this round).** `ImagePickerGrid.tsx`'s `addPhotoButton` (`:408`) plus its photo-source-modal options (`:355`) and upload spinner (`:257`) must use the Pass It Up primary (`#5DBB8E`, pressed `#4DAA7A`) or a secondary-outline variant; no form should show two filled primaries in two colours. The class was already "fixed" once (`MyListingsScreen.tsx:975`, QA F10) **without a family-wide sweep** — don't repeat that.
2. **Sweep the BP-82 forbidden list app-wide (F11).** Run BP-82 rule 7's full 13-hex grep (`#4CAF50|#E53935|#29B6F6|#0066CC|#007AFF|#93C5FD|#D97706|#111827|#6B7280|#D1D5DB|#4A7C59|#4D4D4D|#808080`) and triage each hit live-vs-dead-branch. Source-identified candidates: `PriceSuggestionCard.tsx` (6 uses), `TradeInitiationScreen.tsx:980`, `AdminDashboardScreen.tsx:75,200`, `ItemDetailScreen.tsx:1872`, `CategoryFilterChip.tsx:107,125`, `atoms/Button/index.tsx:14` (`#0066FF`).
3. **Delete or relocate the orphaned auth screens.** `src/screens/LoginScreen.tsx` and `src/screens/SignupScreen.tsx` are **not routed** (`AppNavigator.tsx:19-20` imports `@/screens/auth/*`) yet carry full legacy `#007AFF` stylesheets — they misfire any future source-only audit (they almost did this round).
4. **Fix the Favorites staleness (F1)** — refetch/invalidate Favorites when the favorites set changes (focus-fetch on the Favorites route or a shared favorites store), so favouriting from Discover is immediately reflected.
5. **Correct the N11 expected result (F2)** — either restore a "Let's Adjust Your Price" + "Update Price" affordance (which the guide promises and which would let the seller fix the price in one tap) or amend the guide to the shipped "Error / Price must be at least $X to be listed" alert.
6. **Resolve V13 (F3)** — add an "Add to Trade Basket" action to the Favorites row, or amend the guide to "Request to Buy" (the guide currently asserts an affordance that does not exist).
7. **Amend S24 + S21 (F4/F6)** — record that MoreFromThisSeller confirms via a non-blocking toast and stays in place by design, and correct the page title to "More from this seller".
8. **Apply the low-SP fixture knowledge (new):** keep `qa:set-sp-balance` as the documented way to reach the wallet-limited branch — T03 is now reproducible, so the guide's "test-buyer with 8 SP wallet balance" precondition should cite the script.
**UX Enhancement Ideas (optional, not defects):** On the Trade Basket, the more-items banner's second line is just "View" while its Item Detail twin explains the value ("From $12.00 · add more to bundle into one trade") — consider reusing that phrasing ("Browse all items from this seller") so the banner explains *why* to tap. On the unverified Home strip, consider giving the "couldn't check your plan" state a distinctly different surface treatment from the free-tier upsell so a paying subscriber never briefly mistakes it for a downgrade message.
**Suggested Next Session:** Run the low-SP persona (now proven) through the **T-group remainder (T02/T12/T13)** with a second device/persona for the seller legs, then close the **S19 + S15** pair by provisioning a 3-listing seller cart and a single-listing seller fixture — that combination would clear Block 2 and Block 3 outright.
**Suggested to Improve Agent Rules:** **Replace §5.63 R62b's bare-3-hex standing grep with BP-82 rule 7's full forbidden list** (`#4CAF50|#E53935|#29B6F6|#0066CC|#007AFF|#93C5FD|#D97706|#111827|#6B7280|#D1D5DB|#4A7C59|#4D4D4D|#808080`). The shortcut is blind to the iOS-system-blue family, which this round proved is live as a full-width **primary button** (F11) — so the one check that exists to catch off-brand colour silently passed it. **Related:** make the per-screen §6.4 pass mandatory for **any** screen driven for a functional case, and add a standing "any full-width filled button is a colour-scan target" step (F12) — the AX tree never reports colour, so a functional drive cannot notice this class. **Minor:** promote the `mobile_batch_commands` `[re-render tap → `mobile_get_device_logs`]` pairing to a named technique: capturing a JS-side warning whose trigger is a render event is otherwise impossible with a tool that only sees logs emitted after the call starts — batching the trigger and the capture in one call turned item 5 from unverifiable into verified in a single step.
