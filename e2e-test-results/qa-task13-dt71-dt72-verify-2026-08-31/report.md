# QA Task 13 — On-Device Verification of DT71/DT72 + Stale-Copy Re-Check

**Date:** 2026-08-31 · **Agent:** QA Test Agent (execution-only) · **App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`)
**Device:** iOS Simulator — iPhone 17 Pro Max (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1)
**Backend:** Supabase staging `drntwgporzabmxdqykrp` · **Build:** HEAD `f04c994b` (DT71 + DT72) — JS bundle loaded via dev-client + Metro (`--clear` cold compile, 27.5MB)
**Evidence dir:** `e2e-test-results/qa-task13-dt71-dt72-verify-2026-08-31/screenshots/`

> Scope per prompt: Section A (3 DT71 on-device checks — seller-accept alert copy, tax-toggle-without-restart, bulk below-minimum block) + Section B (DT72 re-verification — unified SP-limit phrasing T01/T03/T05/T06, gray more-from-seller banner) + Section C (guide T03 stale-copy flag, `dt72-cart-preload.mjs` cleanup).
> **Verdicts: 5/5 PASS (A1, A2, A3, B1, B2) — all Section A items CLOSE, all T-group + S-group banner verdicts REFRESHED to the current build.**

**Build note (environment):** `npx expo run:ios` was blocked by a code-signing environment error (Expo CLI 54.0.23 routed to a physical-device build → "No code signing certificates are available to use."). All DT71/DT72 changes are JS-only, so the fresh bundle was loaded via the dev-client + Metro (cold `--clear` compile) — functionally equivalent to a native rebuild for this run. Recorded as an environment artifact; not an app defect.

---

## Section A — DT71 on-device checks (3 items)

| Item | TC/area | Verdict | Evidence |
|---|---|---|---|
| A1 — seller-accept alert | R06 finding (Task 12 P2) | ✅ **PASS** | Accept of pending offer `ec5d50c3` (test-buyer → test-seller, "Vintage Comic Book Collection" $25, cash-only) → **"Offer Accepted!"** alert reads **"Payment authorized. Trade is now in progress. The buyer can confirm receipt."** — NOT "Payment captured". OCR of `A1-accept-alert.png` (native iOS alert blanked the AX tree, QA Task 11 pattern). DB: trade → `in_progress`, auto_complete set, payment hold recorded (`total_charged_cents=2649`). The Task 12 P2 copy finding is **FIXED on-device**. Bundle-accept variant source-confirmed (`ReviewOfferScreen` L259: "Payment authorized. Trades are now in progress."). |
| A2 — tax toggle without restart | DT71 item 3 (config cache) | ✅ **PASS** | `sales_tax_enabled` set `true→false` via `qa:admin-config-set` (read-back verified) → **HOME + foreground (NO relaunch)** → Make Offer on the taxable **Kids Bicycle - 20 inch** ($60, CT Tangible Goods 6.99%): **no "Sales Tax" row, Total cash $61.49** (`A2-tax-off-no-restart.png`). Reverted `false→true` + foreground → **"Sales Tax" $4.19, Total $65.68** (`tax-amount` testID). **The DT71 AppState-foreground cache-invalidation fix works — admin config applies on the next offer read WITHOUT a restart.** |
| A3 — bulk below-minimum block | N05/N13/N14 blocker | ✅ **PASS** | `min_listing_price` set 0→5 (`qa:admin-config-set`) → bulk-create → `dev-add-test-photos` (5) → `dev-fill-bulk-items` → `dev-skip-to-review` → **`dev-set-bulk-price-0`** (sets item 1 to the `dev-bulk-price-input` default `3`) → Review shows **item 1 = "$3 • new" + "Missing: Price must be $5.00+"** (`A3-bulk-below-min-item1.png`); publish "Submit 5 Items for Review" **BLOCKED** — tap produces no confirm sheet, button fill 0% primary-green (`A3-bulk-publish-blocked.png`); source-confirmed (`getMissingRequired` → `price_below_minimum` when `price < minListingPrice`; `BulkPublishBar disabled={!canSubmitForReview}`). **The N05/N13/N14 bulk-leg blocker is CLOSED — those flip from PARTIAL to PASS.** Config reverted to 0. |

## Section B — DT72 re-verification (copy/visual changed, behavior didn't)

| Item | Area | Verdict | Evidence |
|---|---|---|---|
| B1 — unified SP-limit phrasing | T01/T03/T05/T06 re-verify | ✅ **PASS** | Bundle checkout (Kids Bicycle $60 Accept-SP + Nintendo Switch $45): "📦 Combined Offer" banner; Kids Bicycle shows **`sp-max-hint-9b567cb3` = "You can use up to 4 SP"** + source subtext **"Limited by your SP balance"** (test-buyer 4 SP < Sports category cap 45) — replaces the old "Max: 4 SP" / "X of Y — balance limit" lines (`B1-bundle-checkout-sp-hint.png`). **T03** wallet-limit: apply 4 → "Points remaining: 0" + "Points Applied -$4.00". **T05** clear (Cmd+A+del): "Points remaining: 4" restored, no Points Applied row, Cash Total back to $113.83. **T06** real-time: counter 4 → 0 → 4, no stale value. **T01** SP input on the eligible (category-having) Accept-SP item; "Not eligible for points" badge source-unchanged (CartCheckoutScreen L~700) — cross-referenced from QA Task 12. `sp-max-hint-<item>` testID surfaces correctly. ⚠️ Edge noted: **Nintendo Switch has `category_id NULL` → no SP cap → no SP input** (data fixture, not a code defect). |
| B2 — neutral gray more-from-seller banner | S-group banner re-check | ✅ **PASS** | Trade Basket (2 test-seller items) shows `cart-more-from-seller-banner` = "**This seller has 117 more items**" + View + X dismiss. **Color-scan: banner band = 85.3% light-gray fill (#F7F7F7) + 2.3% gray border (#E0E0E0), 0.24% green; bundle CTA band = 90.7% green fill (#EEF9F4) + 3.3% green border (#5DBB8E).** The banner is now a neutral gray secondary card, visually distinct from the green bundle CTA — the old green-on-green look is gone (`B2-trade-basket-gray-banner.png`). |

## Section C — housekeeping

| Item | Result |
|---|---|
| C1 — guide stale-copy flag | ✅ Confirmed mismatch. `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` still asserts the OLD bundle-checkout phrasing: **TRD-TC-T03** (L5505) "Label shows '8 of 20 pts applied — balance limit'", **TRD-TC-T04** (L5520) "Label shows '10 pts applied (category cap: 10)'", **TRD-TC-T05** (L5535) "Item B shows '10 of 15 pts applied — balance limit'". The live build shows the unified **"You can use up to {N} SP"** (`sp-max-hint-<id>`) + source subtext ("Limited by your SP balance" / "Limited by this item's category") + "Points remaining: {N}". **Flagged for the next doc-fix task** (guide not edited in-run per execution-only boundary). |
| C2 — temp cleanup | ✅ `temp/dt72-cart-preload.mjs` (4739 B, disposable DT72 prep script) **removed** and verified gone — zero residue. |

---

## Roll-up

| Verdict | Count |
|---|---|
| ✅ PASS | **5** (A1, A2, A3, B1, B2) |
| ❌ FAIL | 0 |
| ⛔ BLOCKED | 0 |
| ⏭️ SKIPPED / deferred | 0 |

**All Section A DT71 items (alert copy, config-refresh, bulk fixture) close; all Section B DT72 re-verifications PASS against the new build.** N05/N13/N14 flip PARTIAL → PASS; T01/T03/T05/T06 and the S-group banner verdicts are refreshed to the current build.

## Perceived load-time notes (qualitative, dev-build)

- Offer-screen navs (deep link → Make Offer): ~0.9–1.2s. Bundle checkout: ~1.1s. Trade Basket: ~1.0s. Review Offer: ~1.0s. All within the <3s ideal threshold — **no slow screens flagged**.
- Cold bundle compile after the DT71/72 source change: ~53s / 27.5MB (dev-build environment artifact, not an app-behavior issue).

## Cross-cutting findings

1. **P3 (minor copy inconsistency, A1-adjacent):** the **Accept Trade confirm modal** still reads "The buyer will be charged and the trade moves to in progress." while the **post-accept alert** now correctly says "Payment authorized". Per the DT68/R06 auth-hold model, the buyer is only authorized (held), not charged — the pre-accept modal copy should match ("The buyer's payment will be authorized…").
2. **P4 (observation, same class):** the Trade Timeline seller status line reads **"Buyer paid. Awaiting pickup confirmation."** — "paid" implies a completed charge vs the uncaptured auth hold. Consistent with the QA Task 12 R06 wording finding class; the timeline's Payment Details line uses "Payment authorized" correctly, so the status line is the outlier.
3. **P4 (observation):** the item-detail price breakdown never shows a Sales Tax row (neither state of the toggle) — tax is displayed on the Make Offer / checkout screens only. Consistent pre/post-toggle; not a regression, but the item detail's "Total (before SP discount)" omits tax while the offer screen includes it — a minor display-surface inconsistency worth a product look.
4. **P4 (data/fixture edge, B1):** an Accept-SP item with `category_id NULL` (Nintendo Switch) gets no SP input in checkout (no category cap can be computed) while its cart card still says "Accepts Points". Fixture/data nuance — a category-less Accept-SP item offers no points entry. Not a DT72 regression.

## Cross-cutting design-system compliance

- No design-system deviations found on any screen/modal reviewed: Accept Trade confirm modal, "Offer Accepted!" alert, CancellationReasonModal (destructive red confirm), Trade Basket, bundle checkout, More-from-seller banner (neutral gray secondary card — the DT72 change), clear-basket dialog. Affirmative CTAs use `#5DBB8E`; destructive `#FF6B6B`; the gray banner uses documented neutral tokens (`#F7F7F7`/`#E0E0E0`/`#6B6B6B`) distinct from the green CTA. **No deviations found.**

## App State Left Behind (cleanup performed)

- **Config restored:** `sales_tax_enabled` = `true` (read-back verified), `min_listing_price` = `0` (read-back verified). Both touched keys reverted to the pre-run baseline.
- **Trades:** A1 accept trade `ec5d50c3` → accepted (in_progress) → **seller-cancelled** (reason `item_no_longer_available`) → DB: trade `cancelled`, item restored `available`, payment `cancelled`/voided (refunded_cents 0, consistent with the void-not-refund model). **0 open trades** for test-buyer/test-seller.
- **Cart:** test-buyer cart cleared (0 rows) — B1/B2 items removed.
- **Client state:** final **logout to Landing** (session-local toggles `payment_card`, `card_decline`, etc. cleared on logout). No listings created (A3 publish was blocked; A2 preview-only).
- **Guide/temp:** `temp/dt72-cart-preload.mjs` removed; guide NOT edited (execution-only; flagged for doc-fix).

---

## 📋 QA Session Handoff

**Test Scope:** QA Task 13 — DT71 on-device (A1 seller-accept alert "Payment authorized"; A2 `sales_tax_enabled` toggle applies without restart; A3 `dev-set-bulk-price-<index>` below-minimum block) + DT72 re-verify (B1 unified "You can use up to N SP" SP-limit phrasing T01/T03/T05/T06; B2 neutral-gray more-from-seller banner) + C (guide T03 stale-copy flag; `dt72-cart-preload.mjs` cleanup). iOS Simulator iPhone 17 Pro Max, staging `drntwgporzabmxdqykrp`, build HEAD `f04c994b` loaded via dev-client + Metro.
**Design-System Compliance:** PASS — no deviations found on any screen/modal reviewed (Accept confirm modal, Offer Accepted alert, CancellationReasonModal, Trade Basket, bundle checkout, more-from-seller banner, clear-basket dialog); the DT72 gray banner uses neutral tokens (`#F7F7F7`/`#E0E0E0`/`#6B6B6B`) cleanly distinct from the green `#EEF9F4`/`#5DBB8E` CTA.
**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered within the <3s ideal threshold; dev-build cold bundle compile (~53s) noted as an environment artifact, not an app-behavior issue.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Seller-accept alert: "Payment authorized. Trade is now in progress. The buyer can confirm receipt." (DT71 fix; was "Payment captured").
- CONFIRMED — Bundle checkout SP-limit: "You can use up to {N} SP" (`sp-max-hint-<id>`) + source subtext "Limited by your SP balance" / "Limited by this item's category"; "Points remaining: {N}"; "Points Applied -$N" order-summary row.
- CONFIRMED — More-from-seller banner: "This seller has N more items" + View + X, neutral-gray secondary card distinct from the green bundle CTA ("Make one offer for these N items" / "All items from this seller").
- CONFIRMED — Review Offer: "Buyer pays via MASTERCARD •••• 4444 (authorized)".
- CONFIRMED — Combined Offer banner: "📦 Combined Offer" / "You're making a single offer for all 2 items from this seller."
- DEVIATION (minor) — Accept Trade confirm modal: "The buyer will be charged…" vs the now-correct post-accept "Payment authorized" — copy should say the payment is authorized (held), not charged.
- DEVIATION (minor) — Trade Timeline seller status: "Buyer paid. Awaiting pickup confirmation." — "paid" vs the uncaptured auth hold ("authorized").
**Verdict Summary:** 5 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. **DT71 items 1/3/4 all FIXED and on-device verified:** seller-accept alert now "Payment authorized" (A1); `sales_tax_enabled` toggle applies on foreground without restart (A2); `dev-set-bulk-price-<index>` drives the below-minimum block and the "Price must be $5.00+" chip blocks publish (A3). The Task 12 P2 copy bug and the N05/N13/N14 driving blocker are CLOSED.
2. **DT72 verified on-device:** the bundle checkout now shows ONE unified "You can use up to N SP" ceiling + a source subtext (no more dual "Max: N SP" / "X of Y — balance limit" denominators), and the more-from-seller banner is a neutral gray secondary card visually distinct from the green bundle CTA.
3. **P3 (copy):** the pre-accept confirm modal still says "The buyer will be charged" while the post-accept alert says "authorized" — align the confirm-modal copy to the auth-hold model.
4. **P4 (guide drift):** `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` TRD-TC-T03/T04/T05 still assert the old "X of Y — balance limit" / "category cap: N" phrasing — needs a copy sync to the unified phrasing (next doc-fix task).
**App State Left Behind:** Clean — config restored (`sales_tax_enabled=true`, `min_listing_price=0`, both read-back verified); A1 trade seller-cancelled (trade `cancelled`, listing `available`, payment voided); test-buyer cart cleared (0 rows); 0 open/pending trades; `temp/dt72-cart-preload.mjs` removed; app logged out to Landing (session-local toggles cleared).
**Why It Matters:** Proves the three Task 12 findings DT71 set out to fix are **fixed and re-verified on-device on a fresh bundle** (accept-alert copy, admin-config-foreground-refresh, and the bulk below-threshold QA driver that unblocked N05/N13/N14), and that DT72's two UX refinements (unified SP-limit phrasing + neutral gray banner) render exactly as specified with correct `sp-max-hint-<id>` / banner testIDs — refreshing the T-group and S-group banner verdicts to the current build.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-task13-dt71-dt72-verify-2026-08-31/screenshots/`. A1: buyer offer → seller Review Offer → Accept → alert reads "Payment authorized…" (OCR `A1-accept-alert.png`). A2: `npm run qa:admin-config-set set --key sales_tax_enabled --value false --data-type boolean --category tax` → HOME+foreground (no relaunch) → offer on Kids Bicycle → no tax / Total $61.49; revert true → tax $4.19 / $65.68. A3: `min_listing_price=5` → bulk-create → dev fixtures → `dev-set-bulk-price-0` → item "$3 • new" + "Missing: Price must be $5.00+" + publish blocked. B1: bundle checkout (Accept-SP item) → "You can use up to 4 SP" + "Limited by your SP balance"; apply/clear → counter 4→0→4. B2: Trade Basket 2 same-seller items → gray banner (85% `#F7F7F7` fill) vs green CTA (91% `#EEF9F4` fill).
**Known Gaps / Not Tested:** DT71's tax-voided-reporting fix (migration `20260831220000_dev_task_71_tax_voided_report_fix.sql` + admin `/tax/reports`) is **admin-web/backend — out of scope for this mobile agent** (Playwright + migration path); not re-verified here. Bundle-accept alert ("Payment authorized. Trades are now in progress.") source-confirmed but not driven as a 2-item bundle acceptance on-device. B1's cash-only "Not eligible for points" badge cross-referenced from QA Task 12 (source unchanged); the category-cap ("Limited by this item's category") subtext leg needs a wallet > cap fixture (test-buyer has 4 SP) — logic source-verified (`getSpLimitInfo`).
**What Needs To Be Fixed Next:**
1. Fix: align the Accept Trade confirm-modal copy "The buyer will be charged…" → "…the buyer's payment will be authorized…" to match the post-accept alert and the auth-hold model (P3).
2. Fix (doc): sync `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` TRD-TC-T03/T04/T05 expected copy to the unified "You can use up to {N} SP" + source-subtext phrasing (verified this run).
3. Consider: Trade Timeline seller status "Buyer paid" → "Buyer payment authorized" for consistency with the auth-hold model (P4 wording, same class as Task 12 R06).
4. Consider: surface tax on the item-detail price breakdown (or relabel its "Total (before SP discount)" to make the tax-exclusive nature explicit) — currently only the offer/checkout screens show tax (P4 observation).
**UX Enhancement Ideas (optional, not defects):**
- On the bundle checkout, an Accept-SP item with a NULL category (e.g. Nintendo Switch) shows "Accepts Points" on its cart card but offers no SP input (no category cap) — consider showing a lightweight "Points unavailable for this item" note on such items so the "Accepts Points" tag doesn't overpromise.
- On the Trade Basket, the gray more-from-seller banner and the green bundle CTA both sit in the lower half — the current color separation (gray vs green) resolves the earlier green-on-green confusion; consider also nudging the banner's View link further from the CTA to reduce any remaining tap mis-targeting.
**Suggested Next Session:** Re-run the deferred/edge legs with appropriate fixtures: B1 category-cap subtext ("Limited by this item's category") with a wallet > cap fixture; the 2-item bundle-accept alert path on-device; and hand DT71's admin tax-voided-report fix to the Playwright path for the `/tax/reports` re-verify.
**Suggested to Improve Agent Rules:** none this run — the standing rules (R7 schema-first, R24 DB read-back, R30 disclaimer fast-path, R31 tab-band tap gate, R32 cancellation-modal, R37 config-set path, §5.4 native-alert OCR-first, QA Task 11 "Payment authorized" knowledge) covered every interaction without a rule gap. One reinforcement: add a repo-memory note that the **pre-accept confirm modal still says "charged" while the post-accept alert says "authorized"** (copy-inconsistency class), and that **an Accept-SP item with NULL category gets no SP input** (fixture/data edge) — both cost a small re-observation this run.
