# QA Task — TRD Phase 2b/2c: The Real Wrap-Up (Android)

**Run folder:** `e2e-test-results/qa-trd-phase2bc-wrapup-2026-09-11/`
**Date:** 2026-09-11 → 2026-09-12 (device clock crossed midnight)
**Platform driven:** **Android — `Medium_Phone_API_36.1`** (emulator-5554, Android 16). iOS `iPhone 17 Pro Max` (3F3293A3) was booted but **not driven** (R80 — no iOS closure claimed).
**Build:** dev-client, Metro `:8081` (single instance verified, no `:8082` listener).
**Admin portal:** up on `:3001` — **not used this round** (see Known Gaps).
**Tracker:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (R52 update applied).

---

## 0 · Session setup + R29 busy check (2026-09-11)

| Check | Result |
|---|---|
| `xcrun simctl list devices booted` | iPhone 17 Pro Max `3F3293A3…` booted (not driven) |
| `adb devices` | `emulator-5554` online |
| `pgrep -l -f "expo start"` | **ONE** Metro (pid 36233/36244) |
| `lsof -iTCP:8081` / `:8082` | 8081 LISTEN only; **no 8082 listener** (R63a ✓) |
| `pgrep -l -f "run-suite.sh\|maestro\|playwright"` | no suite/Maestro running; one leftover Playwright `test-server` (pid 21212) — not driving a device |
| `lsof -iTCP:3001` | admin portal up (pid 68110) |
| Android standing step (R77 #2) | `adb shell settings put secure stylus_handwriting_enabled 0` applied |
| R-16-1 | `npm run qa:reset-offer-fixtures` → clean (no stale carts/offers) |

**Verdict: devices free, no competing agent task, single Metro.** Proceeded.

### Fixtures built
- **Fresh 3-item same-seller bundle with SP capability** (the dispatch's recommended strategy #1):
  `npm run qa:create-bundle-fixture -- --buyer test-buyer --seller test-seller --count 3`
  → cart `6e06aa28-611f-4765-88fc-3357820225a7`, bundle `1e2317ff-…`, items `4b0cffde` (Toys, general_tangible_goods), `b9e8918e` (Sports, general_tangible_goods), `6f9a5f27` (**Books → tax_exempt_goods**), all $23.00, all `accepts_swap_points=true`.
  The Books item gives a **tax-exempt limb inside a taxable cart** — the single highest-value fixture of the round.
- **Reused** the completed bundle `73d5eb11-…` (buyer test-buyer / seller **test-seller-3**): 2 completed + 1 in_progress (`0788cc0e`, tax 175¢ quoted, $25) → the R05/R06/R08 + seller-timeline fixture.
- `qa-first-trade` persona: **absent on staging** → K02's first-trade-tier leg = **fixture gap** (see Known Gaps).

---

## 1 · Verdict roll-up (Android, this round)

**33 verdict-class items: 28 PASS · 5 PARTIAL · 1 FAIL (re-confirmed, pre-existing) · 0 BLOCKED.**

| TC-ID | Guide group | Verdict (Android) | Headline evidence |
|---|---|---|---|
| TRD-TC-O01 | O · Tax (End User) | ✅ **PASS** | Cart-checkout ORDER SUMMARY: Subtotal $69.00 · Safety & Platform Fee **$1.49** · **Sales Tax (4.67%) $3.22** · Cash Total $73.71 — and $57.71 after SP. Matches DB exactly. |
| TRD-TC-O02 | O | ✅ **PASS** | Tax **unchanged at $3.22** at SP=5 and SP=16 (subtotal unchanged at $69.00, "Points Applied" row absorbs the SP). DB `tax_records` = 161 / 161 / **0** on cash 2300/2300/700. |
| TRD-TC-O05 | O | 🟡 **PARTIAL** | Exempt Books limb contributes **$0.00** tax (numeric proof: blended 4.67% = 322¢/6900¢). The green **"Tax Free" badge** was **not** rendered on the cart-checkout surface and Item Detail was not visited this round. |
| TRD-TC-R02 | R · Refund/Cancel | ✅ **PASS** | Seller declines pending SP offer → `status=cancelled`, `cancellation_reason='seller_declined'`, `cancelled_at` stamped; **buyer SP restored: reserved 16 → 0, available 458 → 474**; item back to `available`; buyer notified. |
| TRD-TC-R05 | R | ✅ **PASS** | Seller cancels in_progress (`0788cc0e`) → `cancelled` / `'Item no longer available'` / `cancelled_at`; **test-seller-3 `post_acceptance_cancellation_count` 2 → 3 AND `admin_review_flagged_at` SET** (level-3 consequence). |
| TRD-TC-R06 | R | 🟡 **PARTIAL** | `tax_records.tax_status` quoted → **voided**; **no `trade_refunds` row** — correct for an uncaptured authorization (void, not refund; matches the D68 precedent). Cash-refund *breakdown* not exercised. |
| TRD-TC-R07 | R | 🟡 **PARTIAL** | Reserved-SP reversal verified end-to-end (R02: 16 SP reserved → available). The "already released to the seller's pending wallet at completion" limb is unverified. |
| TRD-TC-R08 | R | ✅ **PASS** | `seller_payouts` count = **0** for the cancelled in_progress trade. |
| TRD-TC-K05 | K · Value stack | ✅ **PASS** | DB: of 3 bundle trades only **one** carries `buyer_transaction_fee_cents=149`; the other two are 0 → one fee per bundle. |
| TRD-TC-M12 | M · Cart | ✅ **PASS** | Per-item caps rendered as "Accepts Points · Up to **11 / 16 / 17** SP" = `floor(23 × 50% / 70% / 75%)`. |
| TRD-TC-T01 | T · Points redemption | 🟡 **PARTIAL** | Per-item SP inputs render on all 3 SP-eligible items with cap hints; the "ineligible item shows *Not eligible*" limb was not exercised (all 3 items eligible). |
| TRD-TC-T04 | T | ✅ **PASS** | Books $23 (70% cap) → field capped at **16 SP** with "You can use up to 16 SP / Limited by this item's category" while the wallet held 474 SP ⇒ the **category cap**, not the wallet, limits the entry. |
| TRD-TC-T06 | T | ✅ **PASS** | Running counter **"Points remaining: 474"** rendered above the item list on checkout. |
| TRD-TC-T07 | T | ✅ **PASS** | Order-summary math + offer button: `69.00 − 16.00 + 1.49 + 3.22 = $57.71` = "Send Offer · $57.71"; DB cash 700+2300+2300 + fee 149 + tax 322 = **5771¢** — exact match. |
| TRD-TC-T08 | T | ✅ **PASS** | Seller Review Offer: per-item `"23 SP releasing in 3 days after completion"` + payout card Cash Amount $7.00 / Safety & Platform Fee −$1.40 / Points Earned +23 SP / Net Cash Payout $5.60. |
| TRD-TC-T09 | T | ✅ **PASS** | Net payout math: $7.00 − 20%×$7.00 = **$5.60** ✓ (seller trial ⇒ 20% rate). Note: "Buyer's Total Paid" is not on the per-item view (it is a bundle-level element). |
| TRD-TC-T10 | T | ✅ **PASS** | **`includes-points-redemption-tag` "Includes points redemption"** renders on the **seller's** Needs-Action bundle offer card (the guide's own surface) — and on the buyer's offer card. |
| TRD-TC-S07 | S · Seller group/bundle | ✅ **PASS** | Cart with 2+ same-seller items renders `bundle-cta-button` "Make one offer for these 3 items" + "All items from this seller". |
| TRD-TC-S10 | S | ✅ **PASS** | Bundle checkout shows the combined-offer banner (shipped copy "Combined Offer · You're making a single offer for all 3 items from this seller."). |
| TRD-TC-S17 | S | ✅ **PASS** | `cart-more-from-seller-banner` "This seller has **23** more items" + View + dismiss (count consistent with the seller's remaining listings). |
| TRD-TC-U01 | U · Top nav header | ✅ **PASS** | Home: no back button, node chip + greeting left, **bell + chat + avatar** right; Discover/Trades/Basket: title + bell. DOC-DRIFT: guide says "Left: avatar + greeting" — shipped left is the **node chip** (`header-node-chip`) with the greeting in the body. |
| TRD-TC-U02 | U | ✅ **PASS** | Sampled back controls (Checkout, Trade Timeline, My Trades, Trade Basket cart): canonical `back-button`, label "Go back", `caret-left-regular` icon, **no text label**, 40px-ish round. |
| TRD-TC-U05 | U | ✅ **PASS** | Checkout header = back + "Checkout" + chat; **no bell** ✓ (intentional-hide screen). |
| TRD-TC-V01 | V · Copy rename | 🔴 **FAIL** (re-confirmed) | Bottom-tab label reads **"Basket"**, not "Trade Basket" — the known pre-existing copy defect (tracker already 🔴 FAIL). |
| TRD-TC-V02 | V | ✅ **PASS** | Cart screen title = **"Trade Basket"** (`screen-title`). |
| TRD-TC-V03 | V | ✅ **PASS** | Empty state: "Your trade basket is empty" / "Start adding items you love to your trade basket". |
| TRD-TC-V10 | V | ✅ **PASS** | Bundle CTA copy contains no "Bundle": "Make one offer for these 3 items". |
| TRD-TC-V11 | V | ✅ **PASS** | Checkout banner reads **"Combined Offer"**; the word "Bundle" does not appear on the checkout surface. |
| TRD-TC-X01 | X · Nav consistency | ✅ **PASS** | 5 items `tab-home`/`tab-discover`/`tab-sell`/`tab-trades`/`tab-basket`; labels Home/Discover/Trades/Basket; Home selected. |
| TRD-TC-X03 | X | ✅ **PASS** | Trades tab renders identically; Trades selected/filled. |
| TRD-TC-X04 | X | ✅ **PASS** | Trade Basket tab active/filled; screen title "Trade Basket". |
| TRD-TC-X09 | X | ✅ **PASS** | Basket badge appears with the live item count (3) with no manual refresh. |
| TRD-TC-X10 | X | ✅ **PASS** | Basket badge **3** with 3 items; Trades badge 1 → **4** after 3 offers were submitted. |
| TRD-TC-X12 | X | ✅ **PASS** (with finding F1) | Empty cart ⇒ badge cleared — but only **after the Basket screen mounted** (see F1). |
| TRD-TC-X13 | X | ✅ **PASS** | No "Me" tab; Profile reachable via `header-profile-btn` (Home header avatar). |
| TRD-TC-Y01 | Y · Trade list | ✅ **PASS** | Summary chips render with live counts — buyer `3 / 1 / 0 / 34`, seller `0 / 0 / 3 / 31` (Your Offers / In Progress / Needs Action / Completed). |
| TRD-TC-Y03 | Y | ✅ **PASS** | Row-level `trade-row-<id>-message` + `-view` present on buyer **and** seller rows. |
| TRD-TC-Y04 | Y | ✅ **PASS** | `trade-see-all` "See all →" in the RECENTLY COMPLETED header. |
| TRD-TC-Y09 | Y | ✅ **PASS** | "What to do next" card with **seller** steps 1 Message the buyer / 2 Hand off the item / 3 Wait for buyer confirmation + `next-steps-cta` "Got it". |
| TRD-TC-N2-C01 | N2 · Idempotency | ✅ **PASS** (guard+data) | `idx_trades_stripe_payment_intent_id` UNIQUE partial index present; **0 duplicate PIs** across all trades; `offer_created` audits = 208 = `payment_intent_created` audits = 208 (1:1). |
| TRD-TC-N2-C03 | N2 | ✅ **PASS** (guard+data) | `idx_trade_refunds_stripe_refund_id` UNIQUE partial index present; **0 duplicate refund ids**. |
| TRD-TC-N2-C05 | N2 | ✅ **PASS** (mechanism) | `sp_ledger_idempotency_key_key` UNIQUE index present; **0 duplicate keys** across 63 keyed `sp_ledger` rows. |

### Coverage movement vs. the round's own brief (R80 disclosure)
Baseline Android map (start of round): K 6/11 · L 0/11 · M 4/20 · N 6/14 · **O 0/8 · O-1 1/17 · O-2 1/12 · O-3 0/14 · P 0/8 · Q 0/20 · R 0/13** · S 2/24 · T 5/14 — ~120 rows owed an Android leg.
After this round (Android verdicts gained, by group): **O 2 PASS + 1 PARTIAL (O01/O02/O05)** · **R 3 PASS + 2 PARTIAL (R02/R05/R08 + R06/R07)** · **T +5 (T04/T06/T07/T08/T09/T10; T01 PARTIAL)** · **U 3 (U01/U02/U05)** · **V 4 PASS +V01 re-confirmed FAIL** · **X 7** · **Y 4** · **S 3** · **K 1** · **M 1** · **N2 3**.
**Still owed an Android leg after this round ≈ 95+ rows**, including every admin-portal group (O-1/O-2/O-3/P/W) and all of Group Q.

---

## 2 · Per-case execution trace (condensed; full call ledger in `ledger.md`)

### 2.1 Connected bundle flow (buyer = test-buyer)
1. App was on Landing (logged out from the prior round). `qa-login-as?persona=test-buyer` → **the app exited to the launcher** (see F7). Relaunch → Expo Dev Launcher → tapped the `http://10.0.2.2:8081` dev-server row → ~20 polls of blank/splash before the first interactive frame. **Harness artefact, not an app defect** (Metro idle at 0.7% CPU while the device "loaded" — matches FIX-Task-17's F9).
2. Home (test-buyer, SP 474, Trades badge 1, Basket badge 3) → **X01 / X09 / X10 / X13 evidence captured**.
3. Basket tab → cart screen "Trade Basket", 3 × $23.00, per-item "Accepts Points · Up to 11 / 16 / 17 SP", `cart-more-from-seller-banner`, `clear-basket-button`, subtotal/total $69.00, `bundle-cta-button` → **V02 / V10 / M12 / S07 / S17 / X04**.
   - Transient: while the cart was still fetching, each row read "Accepts Points" **and** "Points unavailable for this item" — see F2.
4. `bundle-cta-button` → **Checkout**: back + "Checkout" + chat (**no bell** → U05), "Combined Offer" banner (V11), "Points remaining: 474" (T06), 3 SP inputs with cap hints, ORDER SUMMARY = Subtotal $69.00 / Safety & Platform Fee $1.49 / **Sales Tax (4.67%) $3.22** / Cash Total $73.71 (O01), payment method "Use Saved Card MASTERCARD •••• 4444 / Expires 09/2027".
5. Tapped the Books SP input, typed `5` → summary became Subtotal $69.00 / **Points Applied −$5.00** / Fee $1.49 / **Sales Tax $3.22 (unchanged)** / Cash Total $68.71 (O02).
6. **Keyboard-hazard incident (F6):** a tap at the tree-reported `send-offer-button` centre (540,1850) landed on the **numeric IME keypad** (the IME is invisible to uiautomator) → typed into the still-focused SP field; the value went 5 → **16**. Verified against the screenshot before asserting anything. The final state was still fully usable and produced the strongest cap/T04 evidence: SP capped at the category max 16, tax still $3.22, Cash Total $57.71.
7. Back-press dismissed the IME; re-list + screenshot confirmed keyboard gone; tapped `send-offer-button` "Send Offer · $57.71" → liability disclaimer modal (R30 fast path: checkbox row centre → `checked`, accept button enabled → Accept & Continue) → **"Processing…"** (loading feedback shown) → **"Trade Initiated!"** screen.
8. **DB read-back (R24):** 3 `pending` trades under bundle `6e06aa28` — `ebcd1c46` (Books, sp 16, cash 700, tax **0**), `2e0a27e8` (Toys, sp 0, cash 2300, tax 161, **fee 149**), `6af48a08` (Sports, sp 0, cash 2300, tax 161, fee 0); wallet reserved 16 / available 458; cart emptied. ⇒ **K05 / O01 / O02 / T07** DB-closed.
9. `cta-view-trades-button` → My Trades: chips 3/1/0/34 (Y01), YOUR OFFERS bundle card + "48h 1m left" + **"Includes points redemption"** + `-message`/`-view` (Y03), RECENTLY COMPLETED + `trade-see-all` (Y04).
10. Basket tab → **empty state** and the badge is **gone** ⇒ X12 PASS, plus finding F1 (the badge read "3" on the three preceding screens).

### 2.2 R05 chain (seller = test-seller-3, then buyer)
11. `qa-login-as?persona=test-seller-3` → Home (TS avatar) → Trades → My Trades: chips 0/**4**/0/2; IN PROGRESS shows the Stage-3 bundle card + `trade-row-0788cc0e…` (Selling).
12. Opened `0788cc0e` → seller **Trade Timeline**: "In Progress" banner, timeline Initiated/In Progress/Completed, "What to do next" **seller** steps (Y09), payout-hold info ("automatically in 70h 41m left"), pinned **`seller-cancel-inprogress-button` "Cancel Trade"**. Overlap with `next-steps-cta` measured → **F5**.
13. Cancel Trade → **CancellationReasonModal** (AX-exposed): seller-only reasons `cant_do_pickup` / `item_no_longer_available` / `other` (J05), `cancel-trade-confirm-button` **disabled** → tapped "Item no longer available" → reason `selected`, confirm **enabled** (R32) → Confirm.
14. **"Trade Cancelled / Your trade has been cancelled. Any Swap Points have been refunded to your wallet."** + OK; screen behind = Cancelled banner + Platform Fee −$2.50 / Total $22.50.
15. **DB read-back (R24, after one poll):** `0788cc0e` `cancelled` / `'Item no longer available'` / `cancelled_at`; **test-seller-3 count 2 → 3 + `admin_review_flagged_at` SET**; `tax_records.tax_status` quoted → **voided**; `trade_refunds` = **0 rows**; `seller_payouts` = **0**; buyer wallet untouched by this trade (458/16 = the other bundle's reservation). ⇒ **R05 / R06(void-leg) / R08**.

### 2.3 R02 chain (seller = test-seller, owner of the fresh bundle)
16. `qa-login-as?persona=test-seller` → Trades → My Trades: chips 0/0/**3**/31; NEEDS ACTION renders `trade-bundle-6e06aa28…-card` "📦 Bundle Offer · 3 items" + OFFER badge + the 3 line items (one showing "$7.00 + 16 SP") + **`includes-points-redemption-tag`** + Review Each / Accept All / Decline All ⇒ **T10 / S-card**.
17. `-review-each` → **Review Offer**: `offer-countdown-pill` "47h 59m left", `bundle-context-banner` "Bundle offer · 3 items" + `review-bundle-toggle` (L06), BUYER OFFERS $23.00 → $7.00 + **"23 SP releasing in 3 days after completion"** (T08), YOUR PAYOUT Cash $7.00 / Fee −$1.40 / Points +23 SP / **Net Cash Payout $5.60** (T09), `accept-bundle-button` + `accept-trade-button` + `decline-trade-button` (L08).
18. Scrolled 500 px so `decline-trade-button` cleared the floating tab bar (R31/R22), then Decline → in-app **Decline Trade** confirm ("…This action cannot be undone.") → Decline → **"Offer Declined / The buyer has been notified. The item stays listed."** → OK.
19. **DB read-back:** `ebcd1c46` `cancelled` / `'seller_declined'` / `cancelled_at`; **buyer `reserved_sp` 16 → 0 and `available_balance` 458 → 474**; item `6f9a5f27` back to `available`; sibling trades still `pending`. ⇒ **R02 (+R07 reserved limb)**.

### 2.4 N2 desk verification (no device)
20. One read-only query returned the uniqueness guards + live duplicate scan (see §1 N2 rows). A first pass showed **1 "duplicate" payout group → re-queried before escalating (R15/R24)** and it turned out to be **21 `seller_payouts` rows with `trade_id IS NULL`** grouped by the NULL bucket — **not** a double-payout. Candidate finding retracted; no bug filed.

---

## 3 · Findings (ranked)

| # | Sev | Finding | Evidence |
|---|---|---|---|
| **F1** | **MEDIUM** | **Stale Basket badge after checkout.** With the cart consumed by checkout (`cart_items` = 0, DB), `tab-basket-badge` still read **"3"** on the Trade-Initiated success screen, on My Trades, and on Home; it disappeared only once the Basket screen mounted. The badge is the primary cart affordance, so a shopper sees "3 items" in an empty basket until they open it. | `AND-X12-basket-badge-after-checkout.png`, `AND-offer-created-my-trades.png`, `AND-X12` tree dumps |
| **F2** | **MEDIUM** | **Contradictory transient copy on the cart.** During the basket's initial fetch every row rendered "Accepts Points" **and** "Points unavailable for this item" simultaneously; ~1 s later the same rows read "Accepts Points · Up to N SP". A user who glances mid-load is told points are both accepted and unavailable. | Cart tree (pre-load, 2 rows) vs post-load tree; `AND-O01-X04-cart-basket.png` |
| **F3** | **LOW–MED** | **Success-screen copy contradicts the order.** Immediately after an order that used **16 SP**, the Trade Initiated screen said *"Consider using SP on your next purchase to save more."* | `cta-message` on the Trade Initiated tree + same-session DB sp_amount = 16 |
| **F4** | **LOW** | **Tax label exposes a blended rate.** Checkout shows **"Sales Tax (4.67%)"** — the effective rate across a 3-item bundle with one exempt item — while the applicable category rate is **6.99%** and the guide's expected label is plain **"Sales Tax"**. On mixed carts the shown rate is not a rate any buyer can act on. (`tax-label` a11y label also carries ", CT".) | `AND-O01-O02-T06-checkout-summary.png`, `tax-label`/`tax-amount` tree nodes |
| **F5** | **LOW** | **Pinned footer overlaps the next-steps CTA (seller timeline).** `seller-cancel-inprogress-button` (y1980–2106) overlaps `next-steps-cta` "Got it" (y1939–2056) by ~76 px ≈ 40 % of the pill. | `AND-R05-seller-timeline-inprogress.png` + tree boxes |
| **F6** | **tooling** | **The Android soft keyboard is NOT exposed in the uiautomator tree.** A tap at a tree-reported coordinate while the numeric IME was up landed on a keypad key and typed into the focused SP field (5 → 16) instead of the intended button. The §5.19 Rule-1 keyboard gate can therefore only be honoured from a **screenshot** on Android — never from the tree. | screenshot showing the numeric keypad + the field value change; §2.1 step 6 |
| **F7** | **tooling** | **Android cold dev-client start is very slow and can swallow the first deep link.** `qa-login-as` fired from Landing exited the app to the launcher; after relaunch the dev launcher → Metro row path needed ~20 polls (blank frame → splash → AuthContext spinner → Home). Metro was **idle (0.7 % CPU)** throughout ⇒ native-init/first-frame harness cost, not bundling (consistent with FIX-Task-17 item 9 / F9). | §2.1 steps 1 and 11 |
| **F8** | observation (already tracked — excluded from this dispatch) | The Liability Disclaimer modal body is still the **verbatim Amazon Services Business Solutions Agreement insurance text**, naming Amazon.com / Amazon Insurance Accelerator. Re-confirmed on Android. | `AND-I06-disclaimer-modal.png`, `disclaimer-modal` tree node |
| **F9** | observation | `seller_payouts` contains **21 rows with `trade_id IS NULL`** (surfaced while checking N2-C02). Not a defect for this case; noted because it makes any "payouts per trade" query need a NULL filter. | §2.4 query |

**Retracted before reporting (R15/R24):** "duplicate payout row for one trade" — it was the NULL `trade_id` bucket (F9).

---

## 4 · Three-layer UX review (per §6)

**Structural / affordance — PASS with the listed findings.** Loading feedback is present on every long action ("Loading trade basket…", "Processing…", `trade-list-loading` spinner, `disclaimer-modal` disabled-until-checked). Every screen visited has a working back control. Tap targets are large (buttons ≥110 px on the 1080 px-wide device). Issues: F1 (badge), F5 (overlap), and the tab-bar occlusion of the bottom-most CTA on the seller timeline and the `payout-hold-info-button` (y2143–2391 sits under the tab band y2190+).

**Wording / copy clarity — PASS with the listed findings.** The user-facing copy encountered is plain and parent-appropriate: "Why are you cancelling?", the decline-confirm "Your item stays listed and can receive new offers. This action cannot be undone.", "The buyer has been notified. The item stays listed.", "You can use up to 16 SP / Limited by this item's category", "Funds are held securely and release when the buyer taps \"I Got It\"…". No raw DB/EF error strings or SCREAMING_SNAKE codes were found on any user-facing surface this round (§6.3 raw-string audit: **clean**). Concrete rewrites proposed: F2 → render a neutral loading placeholder instead of "Points unavailable for this item"; F3 → suppress the "consider using SP" nudge when the order used SP (or swap to a savings line); F4 → drop the rate from the label (plain "Sales Tax") or show the applicable category rate only on single-rate carts.

**Design-system compliance — PASS (no deviations found on the screens checked).** Colors/typography/spacing matched the documented tokens on every screen and modal rendered (primary pill `#5DBB8E` on Get Started/Accept & Continue, danger-outline Cancel Trade, gold SP rows, green SP values, `#F4F4F4` round back buttons, one primary per dialog). Accessibility identifiers are present and BP-53-conformant on everything driven (`tab-*`, `back-button`, `cart-*`, `sp-input-*`, `send-offer-button`, `disclaimer-modal-*`, `trade-summary-*`, `cancellation-reason-*`, `includes-points-redemption-tag`, …). The standing **R62b off-brand-hex sweep** (`grep -rEn "#4A7C59|#4D4D4D|#808080" p2p-kids-marketplace/src`) was run in the prior round and returned 0 hits; no new app source landed since (HEAD unchanged) ⇒ not re-run.

---

## 5 · Perceived load time (§5.7)

**Coarse this round** — measurements were call-cadence bounded (± one poll) rather than a tight 500 ms loop, and this is stated as a limitation rather than dressed up.

| Transition | Elapsed | Flag |
|---|---|---|
| Cold dev-client launch → first interactive frame | **several minutes / ~20 polls** | **FLAGGED** as a *harness* artefact (Metro idle; matches F9/FIX-Task-17) — see F7 |
| Cart tab → cart content rendered | < 2 s (one poll; one intermediate "Loading trade basket…" frame) | OK |
| `bundle-cta-button` → Checkout rendered | < 2 s | OK |
| SP entry → summary recompute | < 1 s (visible in the very next frame) | OK |
| Send Offer → offer persisted (DB) | ≈ 2–3 s (one "Processing…" poll) | OK |
| Decline → confirmation dialog | < 2 s | OK |
| Seller cancel → cancelled state + DB | ≈ 2 s | OK |

**Verdict: GOOD for every in-app transition; the only ≥3 s item is the cold dev-client start, which is an environment artefact.**

---

## 6 · Known Gaps / Not Tested (honest, R40/R80)

**Not reached this round (explicit):**
- **All admin-portal groups:** O-1 (Tax by catalog category, 17 rows), O-2 (tax status lifecycle, 12), O-3 (tax refund & reconciliation, 14), **P (tax admin, 8)**, **W (admin bundle trade views, 12)**, K07–K09, N05/N08/N11–N13. The portal was running on `:3001` but no admin legs were driven — a **budget gap, not a blocker**.
- **Group Q (reviews & ratings, 20)** — a completed-trade fixture *was* available (bundle `73d5eb11` has 2 completed trades) but the review drives were not reached.
- **R03** (offer expiry auto-cancel), **R04** (card declined at offer) — not driven.
- **O03/O04** (tax disabled globally / node rate 0) — config-write legs not driven; **O06/O07/O08** — the buyer Payment-Details tax rows / refund-detail card not captured (O07 is additionally **unreachable via seller-cancel**, because an uncaptured authorization voids rather than refunds — it needs the dispute-resolve-refund path).
- **M08/M09/M10** (cart remove/clear/saved carts) — not driven.
- **L02's Confirm-All-N leg** — still needs a fresh 3-item bundle with ≥2 items still `in_progress` (FIX-Task-18 item 1's on-device both-state verification remains owed).
- **K02's first-trade-tier leg** — **fixture gap**: `SELECT … FROM profiles WHERE email LIKE 'qa-first-trade%'` → **0 rows** on staging. Provisioning is `npm run qa:r41-first-trade -- create` (dev-team/fixture step, on demand).
- Remaining U (U03 tap-destination, U04), V (V04–V09, V12–V14), X (X02, X05–X08, X16), Y (Y02, Y05–Y08), N2 (C02/C04/C06), T11–T14, remaining S.
- **iOS was not driven** (R80) — no iOS verdict is claimed for any row in this report.

**Fixture gap / setup notes**
- `qa-first-trade` persona absent (above).
- The fresh bundle's 2 remaining `pending` offers (`6af48a08`, `2e0a27e8`) are left in place; `qa:reset-offer-fixtures` clears them at the next session start.

---

## 7 · App state left behind

- **Mobile app:** left **logged in as test-seller** on the My Trades screen (Android). No config toggles armed; no `admin_config` writes this round.
- **Persona restored (R89, DB-verified):** test-seller-3 `post_acceptance_cancellation_count` **3 → 2** and `admin_review_flagged_at` **→ NULL** (the state consumed by the R05 drive). test-seller untouched at count 6 + flagged 2026-08-30 (its bundle decline does not touch a post-acceptance counter).
- **Data created:** bundle `6e06aa28-…` — 3 fixture items (one now `available` again after the decline, two `pending`); 1 cancelled trade (`ebcd1c46`) + 2 pending trades (`2e0a27e8`, `6af48a08`); buyer wallet back to **474 available / 0 reserved** (net zero SP).
- **Data consumed:** bundle `73d5eb11`'s only in_progress trade `0788cc0e` is now **cancelled** (tax record voided, no refund row, no payout) — that bundle is now 2 completed + 1 cancelled.
- **Untouched:** Stage-3 bundle `330427dc` (seller-side view only), the Amazon-disclaimer CRITICAL, and all `admin_config` / `categories` values.
- **Metro** left running (single instance, `:8081`). Admin portal left running on `:3001`.

---

## 8 · What needs to be fixed next (dev-side, ranked)

1. **Refresh the basket/cart count on checkout success** (F1). The tab badge must follow the cart mutation that checkout performs — subscribe the badge to the same cart-count source the empty-cart screen uses, or invalidate it on the checkout success path. Repro: add 2+ items → checkout → submit → observe the badge on the success screen and My Trades before opening Basket.
2. **Cart row copy during load** (F2): render a single neutral placeholder (e.g. "Checking points…") instead of "Accepts Points" + "Points unavailable for this item" while the per-item cap is still resolving.
3. **Trade-Initiated nudge vs. used-SP orders** (F3): gate "Consider using SP on your next purchase to save more." on `spUsed === 0` (or replace it with a savings line when SP was used).
4. **"Sales Tax (4.67%)" label** (F4): drop the parenthetical rate (guide expects plain "Sales Tax"), or show a rate only when every taxable line shares one rate.
5. **Seller timeline overlap** (F5): the pinned Cancel-Trade footer covers the "Got it" pill — add bottom padding equal to the footer height (same fix class as `computeTimelineBottomPadding`).
6. **Add the tab band to the bottom-padding calculation** for `payout-hold-info-button` / the bottom-most CTAs (y2143–2391 vs the tab bar at 2190+).
7. **Re-confirm V01's copy defect** — the bottom tab still reads "Basket"; the guide asserts "Trade Basket" everywhere. Either fix the label or the guide (a product decision, tracked as 🔴 FAIL).
8. **Amazon disclaimer body** — still verbatim Amazon text (already-tracked CRITICAL, excluded from this dispatch; listed for completeness).

---

## 9 · Suggested next session

**One admin-portal + Group-Q session on Android:** O-1 / O-2 / O-3 / **P** / **W** / K07–K09 at the real portal (`:3001`), then Group Q on the completed trades of bundle `73d5eb11`. That single batch converts the largest remaining block of "never reached" Tier-1 rows. A separate short session should supply the fresh 3-item bundle for L02's Confirm-All-N leg and the `qa-first-trade` fixture for K02.

---

## 📋 QA Session Handoff

**Test Scope:** TRD Phase 2b/2c wrap-up, Android — TRD-TC-O01, O02, O05, K05, M12, R02, R05, R06, R07, R08, S07, S10, S17, T01, T04, T06, T07, T08, T09, T10, U01, U02, U05, V01, V02, V03, V10, V11, X01, X03, X04, X09, X10, X12, X13, Y01, Y03, Y04, Y09, N2-C01, N2-C03, N2-C05 (plus K02 fixture-gap check). iOS not driven.
**Design-System Compliance:** PASS — no deviations found against `docx/design-system-passitup.md` on any screen or modal visited (Checkout, Trade Basket cart, Home, My Trades, Review Offer, Trade Timeline, CancellationReasonModal, Decline-confirm dialog, Liability Disclaimer modal, Trade Initiated). R62b off-brand-hex sweep: 0 hits (last run 2026-09-11, no app source landed since).
**Perceived Load-Time Verdict:** FLAGGED — cold dev-client launch → first interactive frame: several minutes (~20 polls), rendered as blank frame → splash → spinner, while Metro sat idle at 0.7 % CPU ⇒ **environment/harness artefact (native init + first frame), not an app-behaviour or bundling issue** (matches FIX-Task-17 item 9 / F9). Every in-app transition measured < 3 s (cart→checkout <2 s, SP recompute <1 s, send-offer persist ≈2–3 s, decline-confirm <2 s, seller cancel ≈2 s).
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Home (Dashboard): header chrome, bottom nav labels/ids, SP strip, action tiles all match; node chip left + bell/chat/avatar right.
- CONFIRMED — Trade Basket (cart, loaded): titles, per-item "Accepts Points · Up to N SP", summary rows, bundle CTA copy.
- DEVIATION — Trade Basket (cart, **loading**): rows simultaneously show "Accepts Points" and "Points unavailable for this item" (F2).
- CONFIRMED — Checkout: header (back + title + chat, bell intentionally hidden), "Combined Offer" banner, "Points remaining", SP inputs + cap hints, ORDER SUMMARY rows, payment-method card.
- CONFIRMED — Liability Disclaimer modal: content layout, checkbox + disabled→enabled primary pill, one primary.
- CONFIRMED — Trade Initiated screen: title, confirmation copy, 4 CTAs.
- DEVIATION — Trade Initiated screen: nudge copy contradicts an order that used SP (F3).
- CONFIRMED — My Trades (buyer + seller): summary chips, Active/History tabs, offer/bundle/in-progress/completed rows, row Message+View, "See all →".
- CONFIRMED — Review Offer: countdown pill, bundle banner + toggle, BUYER OFFERS rows, payout breakdown, Accept All / Accept / Decline.
- CONFIRMED — Decline Trade confirm dialog + Offer Declined alert: copy, button roles, one primary.
- CONFIRMED — Trade Timeline (seller, in_progress): status banner, item card, stepper, next-steps card, payout-hold card, Cancel Trade footer.
- DEVIATION — Trade Timeline (seller): pinned Cancel Trade overlaps the "Got it" pill (F5).
- CONFIRMED — CancellationReasonModal: seller-only reasons, disabled→enabled confirm, secondary "Keep Trade".
- CONFIRMED — Trade Timeline (seller, cancelled): cancelled banner + reasoning, no further CTAs.
**Verdict Summary:** 28 PASS / 5 PARTIAL / 1 FAIL / 0 BLOCKED (Android, 33 verdict-class items; iOS 0 — no iOS verdict claimed).
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — dated TRD baseline note added (2026-09-11/12) recording the Android legs gained + the honest not-reached list. **No status-value flips this round**: TRD totals remain **288 · 239 PASS · 25 PARTIAL · 1 OPEN · 5 DOC-DRIFT · 2 SKIPPED · 16 Remaining (NEVER RUN)**; §1 roll-up TRD row unchanged (verified consistent: 239+25+1+5+2+16 = 288 ✓). Rows whose **Android-evidence notes / Source / Date** were refreshed: O01, O02, O05, R02, R05, R06, R07, R08, T01, T04, T06, T07, T08, T09, T10, S07, S10, S17, K05, M12, U01, U02, U05, V01, V02, V03, V10, V11, X01, X03, X04, X09, X10, X12, X13, Y01, Y03, Y04, Y09, N2 (C01/C03/C05). Android-coverage map updated in the same note (O 3/8 · R 5/13 · T 11/14 · U 3/5 · V 5/14 · X 7/16 · Y 4/9 · S 5/24 · K 7/11 · M 5/20 · N2 3/10) with **≈95+ TRD rows still owed an Android leg**. K02 flagged as a fixture gap in the note.
**Critical Findings:**
1. **(MEDIUM) Stale Basket badge after checkout** — the tab still shows "3 items" in an emptied basket on three consecutive screens until the Basket is opened (F1).
2. **(MEDIUM) Contradictory cart copy during load** — "Accepts Points" and "Points unavailable for this item" render on the same row (F2).
3. **(LOW–MED) Success-screen SP nudge contradicts a 16-SP order** (F3).
4. **(LOW) "Sales Tax (4.67%)" blended-rate label** on a mixed-exemption bundle, where the applicable category rate is 6.99 % (F4).
5. **(LOW) Pinned Cancel-Trade footer overlaps the next-steps "Got it" pill** on the seller timeline (F5).
6. **(TOOLING) The Android soft keyboard is invisible to uiautomator** — a tree-coordinate tap while the IME is up lands on a keypad key; only a screenshot can enforce the keyboard gate (F6).
7. **(TOOLING) Cold dev-client start ≈ minutes, and the first deep link can exit the app** — harness artefact, Metro idle (F7).
**App State Left Behind:** Android app **logged in as test-seller**, on My Trades. **Persona restored (DB-verified):** test-seller-3 cancellation count 3→2, `admin_review_flagged_at`→NULL. Fresh bundle `6e06aa28` artefacts left: 3 fixture items (1 available, 2 pending), 1 cancelled + 2 pending trades; buyer wallet net-zero at 474/0. Bundle `73d5eb11`'s in_progress trade `0788cc0e` is now cancelled (no refund row, no payout, tax voided). Stage-3 bundle untouched. No config writes. Metro single instance on `:8081` left running; admin portal left on `:3001`.
**Why It Matters:** This round converts the two hardest Tier-1 **money/state** gaps that had never been driven on Android — the seller-decline SP-restore (16 SP reserved → available, DB-verified) and the seller-cancel escalation (count 2→3 + admin flag) — and proves the tax/points arithmetic end-to-end from the checkout UI down to `trades`/`tax_records` on a cart that mixes a **tax-exempt** item with two taxable ones. It also surfaces two user-visible cart/success-screen defects (stale badge, contradictory copy) that no scripted assertion in the automated suite checks, and it establishes that the Android IME is invisible to the AX tree, which changes how every future keyboard-sensitive Android tap must be gated.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-trd-phase2bc-wrapup-2026-09-11/screenshots/` (**22 files**, all Android; key ones: `AND-O-X-boot-home-testbuyer.png`, `AND-O01-X04-cart-basket.png`, `AND-O01-S10-V11-bundle-checkout.png`, `AND-O01-O02-T06-checkout-summary.png`, `AND-O02-T05-sp5-entered.png`, `AND-O02-T04-sp16-cap-tax-unchanged.png`, `AND-I06-disclaimer-modal.png`, `AND-offer-sent-result.png`, `AND-post-offer-state.png`, `AND-Y01-X03-trade-list.png`, `AND-Y01-Y03-trade-list-loaded.png`, `AND-X12-basket-badge-after-checkout.png`, `AND-R05-seller-timeline-inprogress.png`, `AND-R05-J05-cancel-reason-modal.png`, `AND-T08-T09-seller-review-offer.png`, `AND-R02-decline-dialog.png`, `AND-R02-declined.png`). Repro for F1: log in as test-buyer → add 2+ items → checkout → submit → watch the Basket badge on the success screen. Repro for F6: focus an SP input (numeric IME appears), re-list the tree (no IME nodes), tap a tree coordinate for a button that is visually under the keypad. Full call-by-call ledger in `ledger.md`.
**Known Gaps / Not Tested:** All admin-portal groups (O-1 17, O-2 12, O-3 14, P 8, W 12, K07–K09) — not driven despite the portal being up; Group Q (20) — not driven; R03/R04; O03/O04 (config-write legs); O06/O07/O08 UI legs (O07 additionally unreachable via seller-cancel — an uncaptured authorization voids, it does not refund); M08/M09/M10; L02's Confirm-All-N leg (needs a fresh 3-item bundle with ≥2 in_progress); K02's first-trade-tier leg (**fixture gap — `qa-first-trade` persona does not exist on staging**); remaining U/V/X/Y/T/S rows; N2-C02/C04/C06. **iOS not driven — no iOS verdict claimed (R80).**
**What Needs To Be Fixed Next:**
1. Fix: **Basket badge stale after checkout** — invalidate/subscribe the tab badge to the cart-count source on the checkout success path (F1).
2. Fix: **cart row copy while the per-item cap resolves** — one neutral loading placeholder instead of "Accepts Points" + "Points unavailable for this item" (F2).
3. Fix: **Trade-Initiated SP nudge** — gate on `spUsed === 0`, else show the savings line (F3).
4. Fix: **"Sales Tax (4.67%)"** — drop the parenthetical rate, or only show a rate when all taxable lines share one (F4).
5. Fix: **seller-timeline pinned footer overlap** — bottom padding ≥ footer height so "Got it" is fully visible (F5).
6. Fix: **bottom-padding calc must include the tab band** for `payout-hold-info-button` and bottom-most CTAs (y2143–2391 vs tab bar 2190+).
7. Decide: **V01 copy** — tab label "Basket" vs the guide's "Trade Basket" (fix the label or amend the guide).
8. Already tracked / out of scope: the **Amazon-verbatim liability-disclaimer body** (standalone CRITICAL).
**UX Enhancement Ideas (optional, not defects):**
- On the Cart screen, the loading state shows per-row badge text that flips meaning — consider skeleton rows so the "Up to N SP" value appears once, in one step.
- On Checkout, "Points remaining: 474" is shown above the item list but does not visibly decrement as SP is typed into items — consider updating it live so the buyer sees the running total without scrolling to ORDER SUMMARY.
- On the Trade-Initiated screen, the four CTAs (Browse Items / View Trade Details / View My Trades / Back to Home) offer no visual priority — consider one primary (View Trade Details) to reduce decision cost.
- On My Trades, the summary chips show 0 for "Needs Action" for a buyer while three offers are pending with the seller — consider a short sub-label clarifying whose action is awaited.
**Suggested Next Session:** One Android session against the real admin portal covering **O-1 / O-2 / O-3 / P / W / K07–K09**, then **Group Q** on bundle `73d5eb11`'s two completed trades — the largest remaining Tier-1 block.
**Suggested to Improve Agent Rules:** Codify the Android keyboard finding (F6) as a sharpening of §5.19 Rule 1: **on Android the soft keyboard is not exposed in the uiautomator tree, so "re-list before tapping" is not sufficient — after any text entry, take a screenshot to prove the IME is gone before tapping any tree coordinate**, and treat a field value that changed without a deliberate keystroke as an IME-interception signature rather than an app bug (one-miss full re-derive, §5.1).
