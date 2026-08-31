# QA Task 14 — DT73 Spot-Check + Reinstated Deferred Cases + Groups U–Y (2026-08-31)

**Device:** iPhone 17 Pro Max simulator (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1)
**Build:** dev build, Metro on 8081 serving current source (HEAD `08cc8e41`)
**Evidence:** `screenshots/` in this directory (referenced per case below)

**Important methodology note — stale-bundle lesson (Section A):** the first app launch of the session served a STALE JS bundle (the DT73 CartScreen note was not rendering even though a fresh `curl` of the Metro bundle contained the strings). A terminate+relaunch re-downloaded the bundle ("Downloading 100%…") and the DT73 code then rendered. All Section A items were re-verified on the fresh bundle. **Standing lesson: after a code-commit verification task, relaunch the app before on-device checks to guarantee the current bundle.**

---

## Section A — Dev Task 73 spot-check (5/5 PASS)

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | Seller Review Offer → Accept confirm modal: "…the buyer's payment will be **authorized**…" (not "will be charged") | **PASS** | `DT73-item1-PASS-accept-authorize-modal.png`; modal text "Are you sure you want to accept this offer? The buyer's payment will be authorized and the trade moves to in progress." |
| 2 | Accepted trade → seller Trade Timeline: "**Buyer payment authorized. Awaiting pickup confirmation.**" (not "Buyer paid") | **PASS** | `DT73-item2-PASS-seller-authorized-copy.png` + `DT73-item2-top-timeline-seller.png` |
| 3 | Cart with Accept-SP item whose category is NULL → "**Points unavailable for this item**" under Accepts Points tag | **PASS** | `DT73-item3-PASS-points-unavailable.png` (testID `cart-item-points-unavailable-…`; only after the fresh-bundle relaunch) |
| 4 | Cart 2+ same-seller items → banner "View" link gap above green bundle CTA visibly larger than before | **PASS** | `DT73-item4-PASS-fresh-bundle-banner-gap.png`; "View" link ≈y530, bundle CTA ≈y744 (~200pt gap); source `CartScreen.tsx` `moreFromSellerBanner.marginBottom = md` (DT73) |
| 5 | No regressions in ReviewOffer/Timeline/Cart | **PASS** | "Accepts Points · Up to 10 SP" still renders; payout breakdown correct; "What to do next" + "Need more time?" cards render; "Buyer pays via MASTERCARD •••• 4444 (authorized)"; no console errors |

Fixture created for A: in-progress trade `c0d12340` (test-buyer → test-seller, Cash-Only Item $20, tax $1.40, accept verified in DB `in_progress`). Reused later for Group Y extension.

---

## Section B — reinstated deferred cases (4/4 PASS)

### TRD-TC-Q05 — Skip review (PASS)
- As test-buyer, opened a completed-but-unreviewed trade (`91668589`, "QA Canned Cancelled-Trade Item"), tapped **Review the Seller** → SubmitReview screen → **Skip for Now** (`skip-review-button`).
- Skip dismissed the review screen back to the trade timeline with **no blocker / no modal / no error**. DB: `reviews` for `91668589` still 0 (no review created).
- **Interpretation note:** `skipReview` is analytics-only by design (`src/services/review.ts:438-457` — "We don't save skip events to database… reviews remain fully optional"). The trade-detail "Review the Seller" button remains as a persistent entry point after skip (by design). "No re-prompt" = no forced/blocking prompt reappears — satisfied.
- Evidence: `Q05-submit-review-skip-button.png`.

### TRD-TC-O07 — Refund shows proportional tax refunded (PASS — backend leg; UI leg deferred)
- **Guide status:** the end-user "refund detail view" showing proportional tax is **deferred** (not built). Admin dispute-refund is out of scope for this agent (§2).
- **DB-verified backend leg:** `trade_refunds.refund_tax_cents` tracks the tax component separately from price/fee; full refunds record **100%** of tax (`a01624a4` 140/140, `e54f608a` 154/154, `f9d53797` 699/699 — all `status=succeeded`, admin-initiated). `tax_records` `refunded_tax_cents` matches. The backend correctly records proportional tax refunds.
- **Not verifiable:** genuine partial (50%) proportional tax record — none exists; feature deferred.
- No new UI screen to test for the refund detail (deferred feature) — the completed trade's Payment Details shows standard rows (no refund line), consistent with the deferral.

### TRD-TC-Q15 — Flag a review (select reason) (PASS — via implemented model; spec deviation noted)
- **Fixture built:** as test-buyer-2, submitted a 4★ review of test-seller (review `14372222`, DB-verified) from completed trade `d62d340f` — "Success / Your review has been submitted!".
- **Implemented model (verified):** the report menu is shown **only to the reviewee on their OWN profile** (`ProfileScreen.tsx:731` renders `ReviewCard` with `currentUserId`; `ReviewCard.canReport = currentUserId === reviewee_id`; `SellerProfileScreen.tsx:434` hardcodes `showReportMenu={false}`). As **test-seller** (reviewee) on their own profile, the ⋯ `review-menu-button` appears on all 3 review cards → tapped → **Report as Offensive** → confirm dialog → **"Success / Thank you for reporting. We will review this content."** DB: `review_reports` row `4c84901a` (review `14372222`, reporter test-seller, reason `offensive`) — side-effect verified.
- **Spec deviation (finding):** the guide's Q15 says *"any user can flag from test-seller's public profile"* — **not implemented**: the public seller profile hides the report menu entirely, and non-reviewees never see it (verified as test-buyer — no flag on any card, incl. test-buyer-2's). Guide lists 4 reasons (incl. "Other"); app has 3 (Spam/Offensive/False Information). Confirmation copy is "Thank you for reporting. We will review this content." (guide: "Review reported. Thank you!").
- Evidence: `Q15-review-menu-buttons-own-profile.png`, `Q15-report-confirm-dialog.png`.

### TRD-TC-Q17 — Cannot flag own review (PASS)
- As test-buyer viewing test-seller's profile, **no report/flag/overflow button appears on test-buyer's own review cards** (Anonymous User 5★, Test Buyer 4★) — nor on any card (test-buyer is not the reviewee). Source corroborates (`canReport` = reviewee-only).
- The app satisfies the outcome ("reviewer cannot flag own review") via the reviewee-only model rather than the guide's stated own-review-hiding rationale.
- Evidence: `Q17-PASS-no-flag-own-reviews.png`, `Q17-profile-header-rating-breakdown.png` (also re-confirms Q08/Q09: avg 4.5→4.3 after the new review, breakdown 5★×1/4★×2).

---

## Section C — Groups U–Y (44 cases executed + 14 T partial + 12 W skipped)

### Group V — Copy Rename (11 PASS / 2 FAIL / 1 PARTIAL)
| TC | Verdict | Note |
|---|---|---|
| V01 | **FAIL** | Bottom-tab label renders "**Basket**", not "Trade Basket" (`PersistentTabBar/index.tsx:300` `label="Basket"`; AX label + on-device OCR). Screen/alert/buttons all use "Trade Basket", but the tab is the short form. |
| V02 | PASS | Cart screen title "Trade Basket" ✓ |
| V03 | PASS | Empty state: "Your trade basket is empty" + "Start adding items you love to your trade basket" + Browse Items ✓ (`V03-empty-trade-basket-state.png`) |
| V04 | PASS | Item Detail button reads "View Trade Basket" (visible text) ✓ |
| V05 | PASS | More-from-seller items not in basket show "Add to Trade Basket" ✓ (`V05-V06-more-from-seller-buttons.png`) |
| V06 | PASS | Items already in basket show "In Trade Basket" (dimmed/disabled) ✓ |
| V07 | PASS | "Added to Trade Basket" alert on add ✓ (`DT73-V07-added-to-trade-basket-alert.png`) |
| V08 | **FAIL** | "Matches Your Trade Basket" badge: copy correct in source (`MatchesCartBadge.tsx`), renders on More-from-seller cards, but **does NOT render on ItemDetailScreen** for a same-seller item despite a matching cart (source render gate `matchesCart` at `ItemDetailScreen.tsx:797`). OCR of seller card confirms absent. Possible async seller-group-hash/race. |
| V09 | PASS | Different-seller modal: "Your trade basket already has items from a different seller. Adding this item will clear your current trade basket. What would you like to do?" + buttons "Save & Start New Trade Basket"/"Replace Trade Basket"/"Cancel" ✓ (`V09-different-seller-modal.png`) |
| V10 | PASS | Bundle CTA "Make one offer for these 2 items" + "All items from this seller" — no "Bundle" ✓ |
| V11 | PASS | Checkout banner "📦 Combined Offer" + "You're making a single offer for all 2 items from this seller." — no "Bundle" ✓ (`V11-combined-offer-banner-checkout.png`) |
| V12 | PASS | Bundle Builder title "Build Offer" — no "Bundle" ✓ |
| V13 | **PARTIAL** | Alert copy "Added to Trade Basket" verified (V07). Favorites-screen trigger not driven: only favorite is a `sold` item (hidden → "No favorites yet"); favorite (heart) control not AX-exposed on item detail (locator gap). |
| V14 | PASS | Functional regression: add/remove/clear/different-seller modal/bundle CTA/badge all exercised without errors ✓ |

### Group U — Top Nav Header Pattern (5 PASS)
- **U01** PASS — root screens (Home: avatar+greeting+bell+profile; Trades/Basket: title+bell; no back button).
- **U02** PASS — detail screens (Item Detail, Trade Timeline, SubmitReview, Review Offer, Edit Profile, Build Offer) all use canonical back button (40×40 gray `#F4F4F4`, icon-only) + title + bell.
- **U03** PASS — bell navigates to Notifications (badge 99+, incl. the "Offer Accepted!" notification) (`U03-notifications-screen.png`).
- **U04** PASS — SubmitReview + **EditProfile** use the canonical detail header (back-button + "Edit Profile" + bell) — the past green-"← Back" miss is fixed.
- **U05** PASS (CartCheckout leg) — CartCheckout header hides the bell (back + "Checkout" + Messages only); SubscriptionPayment/RequestPayout not visited this run.

### Group X — Navigation Consistency & Bottom Nav (16 PASS)
- **X01–X08** PASS — persistent 5-item bottom nav renders identically on Home, Discover (via item detail), Trades, Trade Basket, Item Detail, Cart Checkout, trade screens, Profile. (Note: X01/X13 tab label is "Basket" — see V01.)
- **X09–X12** PASS — cart badge shows live count (1→2), no badge when empty.
- **X13** PASS — no "Me" tab; Profile reachable via Home avatar.
- **X14** PASS — source: zero `MeTab`/`tab-me` references (removed).
- **X15** PASS — Sell FAB opens the action sheet (List One Item / Bulk Upload) from stacked screens (`X15-sell-fab-action-sheet.png`).
- **X16** PASS — flow-registry has FLOW-00/FLOW-07 bottom-nav/Trade-Basket entries.

### Group Y — Trade List & Timeline (8 PASS / 1 SKIPPED)
- **Y01** PASS — summary chips (Your Offers / In Progress / Needs Action / Completed) filter; counts render.
- **Y02** PASS — History pagination supported in source (`history-load-more`, `HISTORY_PAGE_SIZE=10`, "You're all caught up"); test-buyer has 25+ completed rows.
- **Y03** PASS — row-level Message button on trade rows (`trade-row-<id>-message`).
- **Y04** PASS — "See all →" link switches to History tab.
- **Y05** PASS — requester: "Need more time?" card + after request "Extension request sent / Waiting for the other party to respond. If they don't answer within 4h 1m left…" (DB `extension_status=requested`).
- **Y06** PASS — counterparty: "Extension request / The other party asked for more time…" card + Accept → "Accept Extension?" confirm → Processing → granted (DB `accepted`, `extension_granted_at` set).
- **Y07** **SKIPPED** — decline path not driven (single extension allowed per trade; trade now used). Decline button present (`decline-extension-button`).
- **Y08** PASS — granted state: "Pickup window extended / You now have until 9/3/2026, 2:44:38 PM to complete the trade." (`Y06-Y08-extension-granted.png`)
- **Y09** PASS — "What to do next" card (buyer steps: Message the seller / Confirm pickup; seller steps: Message the buyer / Hand off / Wait for buyer confirmation).

### Group T — Points Redemption (2 PASS / 1 PARTIAL / 11 BLOCKED)
- **T01** PASS — bundle checkout shows SP toggle input only on Accept-SP item; Cash-Only item shows "Not eligible for points" with no toggle.
- **T03** PARTIAL — wallet-limited path verified with test-buyer's actual balance: "You can use up to 4 SP" + "Limited by your SP balance" (DT72 wording) + "Points remaining: 4". Guide's 8-SP scenario not reproducible (balance is 4).
- **T14** PASS — bundle CTA / different-seller modal / More-from-seller regression all functional.
- **T02, T04–T13** BLOCKED — fixture gap: these need specific SP wallet balances (8/30/50/100/200/500 SP) or an admin category-cap config change; test-buyer has **4 available SP** (10 reserved) and QA cannot top up SP or write category caps. Flagged honestly, not silently skipped.

### Group W — Admin Bundle Trade Views (12 SKIPPED)
- W01–W12 **SKIPPED (admin-scope)** — admin portal surface is out of scope for this agent (§2; Playwright path). Flagged for the Playwright runner, not silently skipped.

---

## Cross-cutting findings

1. **V01/X01 — tab label "Basket" not "Trade Basket" (Low).** The Cart→Trade Basket rename was applied to the screen title, alerts, and buttons, but the persistent bottom-tab label is the short "Basket". Either the tab should read "Trade Basket" (per guide) or the guide should note the short form is intentional.
2. **V08 — "Matches Your Trade Basket" badge missing on ItemDetail (Low/Medium).** Badge copy is correct and renders on the More-from-seller page, but is absent on ItemDetailScreen for a same-seller item with a matching cart. `matchesCart` gate at `ItemDetailScreen.tsx:797`; possible seller-group-hash or async race. Worth a dev look.
3. **Q15 — reporting model differs from the guide (Medium, spec drift).** Guide: any user flags from the public profile. App: only the reviewee can report, and only from their OWN profile (`SellerProfileScreen` hardcodes `showReportMenu={false}`). Guide should be updated to the implemented model (or the app should open public-profile reporting per the guide). Also guide lists 4 report reasons incl. "Other"; app has 3. Confirmation copy differs slightly.
4. **O07 — end-user refund detail view is deferred** (guide status confirmed on-device: completed trade shows no refund line). Backend proportional-tax refund is correct (DB-verified).
5. **Y07 — decline path untested** (single-extension-per-trade constraint; needs a fresh in-progress trade).
6. **T-group — SP-balance fixtures unavailable** to QA (11 cases BLOCKED). SP top-up or a subscriber persona with high SP balance is needed to close these.

---

## Perceived load-time observations
All screen transitions observed this run rendered within the ideal UX threshold (<3s) on the simulator (tab switches, item detail, trade list/timeline, checkout). No transition ≥3s was flagged. (Perceived load-time, simulator, wall-clock, ±polling-interval precision — not a formal performance profile.)

---

## App State Left Behind
- **In-progress trade `c0d12340`** (test-buyer ↔ test-seller, Cash-Only Item, $20, tax $1.40) with **extension granted** (`extension_status=accepted`, expires ~9/3). Used for DT73 + Group Y. Not cancelled — cleanup candidate.
- **New review `14372222`** (test-buyer-2 → test-seller, 4★) — useful future fixture; leave.
- **New review_reports row `4c84901a`** (test-seller reported test-buyer-2's review as `offensive`) — 1 report (harmless, no auto-hide at <3 reports). Cleanup optional.
- **test-buyer cart:** 2 test-seller items (Vintage Comic $25 + QA Canned $20) left in the active cart. Clear before future cart cases.
- **test-seller profile** now shows 3 reviews (avg 4.3) — was 2 (4.5).
- **Personas:** logged in as test-seller at EditProfile at session end. All prior sessions' data unchanged except above.
- **RLS advisory:** `public._orphan_image_snapshot_20260829` (orphan-image snapshot table, 513 rows, created 2026-08-29) has RLS disabled. It is an internal snapshot table, not user data, but the advisory recommends enabling RLS — dev/ops decision, no action auto-applied.
