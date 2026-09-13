# QA Task — Group L Final Legs + M/N/S/T remainder + Round 3 (U/V/X/Y/N2)

**Run folder:** `e2e-test-results/qa-groupl-final-mnst-round3-2026-09-13/`
**Date:** 2026-09-13 · **HEAD:** `94c8fb79` (FIX-Task-24)
**Platforms:** **Android `Medium_Phone_API_36.1` (`emulator-5554`, Android 16) — DRIVEN.** iOS `iPhone 17 Pro Max` booted, **NOT driven** (R80 platform disclosure).
**Admin portal:** `http://localhost:3001` up (Playwright webServer, pid 30849) but **not exercised** this session — no admin-dependent case was reached (see Known Gaps).
**DB:** read-only via Supabase MCP `execute_sql` (project `drntwgporzabmxdqykrp`) + one fixture-authoring UPDATE + one fast-clock UPDATE (both declared below).

---

## 0 · Session scope truth (R78-2 — a "remaining" claim is itself a claim)

The dispatch listed large per-group "remainder" blocks for M/N/S/T/U/V/X/Y/N2. Cross-checked against
`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`: **none of M/N/S/T/U/V/X/Y/N2 contains a
`NEVER RUN` row.** The tracker's entire 16-row Remaining set is A03, A04, D05, D06, E05, E06, N2,
O3-C08, O3-C09, Q10, Q11, Q13, Q14, Q16, R02, R05 — all explicitly excluded by the brief (post-MVP /
separate session / Stripe-injected). So P2/P3 are **Android-coverage + current-build re-verification
legs on rows that already carry verdicts**, not first verdicts. That is exactly why the brief's
Tier-3 "fast-confirm" framing is the right one for U/V/X/Y/N2.

---

## 1 · Priority 1 (Tier 1) — DISCHARGED, 3/3 PASS

### Fixture
`qa:create-bundle-fixture -- --buyer test-buyer --seller test-seller --count 4`
→ cart_id / **bundle_id `b12351bc-bca5-4b5c-a37d-2ac583cbf71e`**, items
`f51a42bf`(1 of 4), `1a59a2f2`(2 of 4), `e4b1ce37`(3 of 4), `cba33462`(4 of 4), all $29.00.
Offer created through the real `create-trade-offer` Edge Function (`qa:ef-repro`);
trades **A `f7e6d9d2` · B `080551cb` · C `62b979bf` · D `c20618be`**.

> ⚠️ **Fixture disclosure (see F8).** The EF's batch path (`items: [...]`) only stamps `bundle_id`
> when the caller supplies it; my EF call omitted it, so the 4 trades came back `bundle_id = null`
> (each its own offer-slot). Rather than orphan 4 Stripe authorization holds by resetting, I stamped
> the **cart id** onto the 4 pending trades — matching exactly what the app's own checkout sends
> (`cartService.checkoutCart` → `bundle_id: effectiveBundleId`, where `effectiveBundleId = cart.bundleId`
> and `cartService.getCartItems` maps `bundleId ← r['cart_id']`). Consequence: each trade carries a
> **per-item** seller fee ($5.80) instead of one-fee-per-bundle. **No L02/L08 assertion depends on fees.**

### TRD-TC-L08 — Individual accept/decline alongside bundle siblings → ✅ **PASS (Android)**
1. Seller **test-seller** → Trades → Active → `trade-bundle-b12351bc-…-card` "📦 Bundle Offer · 4 items"
   with `-review-each` / `-accept-all` / `-decline-all`.
2. `-review-each` → **Review Offer**: `accept-bundle-button` ("Accept All 4 Items"),
   **`accept-trade-button` ("Accept Trade")** and **`decline-trade-button` ("Decline") all co-present**
   → assertion 1 met (screenshot `L08-03`).
3. Tap the **individual** `accept-trade-button` → `accept-trade-confirm-button` → "Offer Accepted!".
   **DB (separate statement, R24): `080551cb` = `in_progress` + `auto_complete_at` stamped; siblings
   `f7e6d9d2` / `62b979bf` / `c20618be` still `pending`, no `auto_complete_at`** → assertion 2 met:
   *accepting just this offer updates only this trade; the bundle siblings stay pending.*
4. Then bundle-level `accept-bundle-button` → "Bundle Accepted!" → all 4 trades `in_progress`
   (idempotent w.r.t. the already-accepted sibling — no error, no double state).

### TRD-TC-O2-C09 — Auto-complete after 72 hours: capture succeeds, tax collected → ✅ **PASS**
Used the pre-existing in-progress residue trade **`472ef43a`** (real uncaptured PI
`pi_3UF0yS4I6kCJlvXo14VIbiFQ`, `tax_status='quoted'`) — this also **clears the residue**.
1. Fast-clock: `UPDATE trades SET auto_complete_at = now() + interval '5 seconds' WHERE id = '472ef43a…' AND status='in_progress'`.
2. **Drove the `process-auto-complete` EDGE FUNCTION** (`qa:ef-repro --ef process-auto-complete --body '{"batch_size":100}'`)
   — **not** the bare `rpc_process_auto_complete`, because the EF is what performs the Stripe capture +
   `rpc_mark_tax_collected` before the RPC (source: `supabase/functions/process-auto-complete/index.ts`
   L200-235). Driving the bare RPC would have produced a **false FAIL** on exactly the assertions the
   case makes (the F2 recipe lesson from the 2026-09-12 round).
   EF response: `eligible_count 1`, `capture_results[0].capture_success true`, `auto_completed_count 1`,
   `failed_count 0`.
3. **DB read-back (separate statement):**
   | Assertion | Observed |
   |---|---|
   | `trades.status = completed` | ✅ `completed` |
   | `auto_completed_at` stamped | ✅ `2026-09-13 12:08:59.575368+00` |
   | `tax_status = collected` (was `quoted`) | ✅ `collected` |
   | `captured_at IS NOT NULL` | ✅ `2026-09-13 12:08:59.34281+00` |
   | `stripe_capture_id` present | ✅ `ch_3UF0yS4I6kCJlvXo1VGFKXnc` |
   | Seller payout created | ✅ exactly **1** `seller_payouts` row, `requires_action`, net 900¢ |
   | Seller SP wallet `pending_balance` increased | ✅ test-seller-3 `pending_balance = 15`, `sp_released_at` NULL (3-day window) |
   | Buyer auto-complete notification | ✅ `user_notifications` → `trade_completed` "Trade Complete! 🎉" |

   *Honest scope:* the buyer-side notification was verified at the **DB** layer; its on-screen
   rendering was not driven in this leg (the in-app notification surfaces are covered by Group Y/N rows).

### TRD-TC-L02 — Confirm-All shortcut for bundle (buyer) → ✅ **PASS (Android, full 3 steps)**
The prior verdict's open caveat ("re-entering the partially-completed bundle gave NO confirm-all
prompt") is **resolved** — this is the first end-to-end verdict since the FIX-Task-18/19 work.
1. Buyer **test-buyer** → Trades → Active → IN PROGRESS `trade-bundle-…-view` ("📦 Bundle · 4 items")
   → "View →" → Trade Timeline (`confirm-trade-button` "I Got It — Complete Trade").
2. Tap **I Got It** → **"Confirm all 4 items received?"** with **`confirm-all-cancel-button` (Just This One)**
   and **`confirm-all-trades-button` (Confirm All 4)** → matches the guide's "Confirm all N items?" + both buttons. (screenshot `L02-03`)
3. Tap **Just This One** → second dialog (`complete-trade-confirm-button`) → "Trade Complete!".
   **DB: exactly 1 of 4 `completed` (`080551cb`), other 3 still `in_progress`.** (screenshot `L02-05`)
4. Re-enter the bundle and open a **different** sibling (`c20618be`) → **I Got It** →
   **the shortcut REAPPEARS, correctly re-scoped: "Confirm all 3 items received?" with [Confirm All 3]**
   (screenshot `L02-06`) → tap Confirm All 3 → **all 4 trades `completed`** (DB-verified).

---

## 2 · Priority 2 (Tier 2) — PARTIAL SWEEP (session stopped inside P2)

All verdicts below are **Android**, current build, from screenshots + AX tree (+ DB where money/state is involved).

| TC-ID | Verdict | Evidence / note |
|---|---|---|
| TRD-TC-M03 | ✅ PASS | Add-item-from-different-seller → **"Different Seller"** `GlobalAlertProvider` modal (`global-alert-button-0/1/2`), exactly the guide's three choices. Screenshot `M03-S01-V09-01`. |
| TRD-TC-M07 | ✅ PASS | Re-adding an item already in the basket: the card's `more-seller-add-cart-<id>` flips to a disabled **"In Trade Basket"** state — no duplicate insert path offered. Screenshot `M16-M18-V06-V07-01`. |
| TRD-TC-M16 | ✅ PASS | Add-to-basket success toast renders then auto-dismisses ("Added to Trade Basket"). |
| TRD-TC-M18 | ✅ PASS | Toast copy uses **"Trade Basket"** (no "Cart"/"Basket"-only leak). |
| TRD-TC-M13 | 🟡 PARTIAL | Natural state: all 4 cart items went `sold` while `cart_items` stayed `active` → Basket correctly renders **"This item is no longer available"** per row (screenshot `S07-M13-01`). The **realtime-while-open** leg and the 24h auto-remove leg were **not** driven. |
| TRD-TC-S01 | ✅ PASS | Different-seller modal uses generic copy — **zero seller name/identity**. |
| TRD-TC-S02 | ✅ PASS | `more-from-seller-cta` rendered with **"This seller has 25 more items"**; seller DB count = **26** available+approved ⇒ correct "N−1" other-count. |
| TRD-TC-S04 | ✅ PASS | "More from this seller" page title + grid expose **no seller identity** (`more-from-seller-list`, `more-seller-item-<id>`); the originating listing is excluded. |
| TRD-TC-S05 | ✅ PASS | `more-seller-add-cart-<listingId>` on the filtered page populated the cart (badge 4→1 after Replace, DB `cart_items` rewritten). |
| TRD-TC-S07 | ✅ PASS | Basket with 2 same-seller items renders the bundle CTA **"Make one offer for these 2 items / All items from this seller"**. |
| TRD-TC-S14 | ✅ PASS | Item Detail: More-from-seller CTA is a **standalone full-width banner below the Seller Info card** (`more-from-seller-cta`, label "More from seller cta"). |
| TRD-TC-S17 | ✅ PASS | Basket banner **"This seller has 24 more items"** = 26 − 2 in basket ✓ (DB-reconciled). |
| TRD-TC-S20 | 🟡 PARTIAL | The banner's dismiss **X** is present and AX-exposed; the dismissal itself was not driven. |
| TRD-TC-S21 | ✅ PASS | Neither the seller-info card ("Seller Info Hidden", lock icon), the CTA, nor the filtered grid reveal identity. |
| TRD-TC-T01 | ✅ PASS | Checkout with a mixed bundle: SP input renders **only** on the SP-eligible item ("You can use up to 42 SP", "Limited by this item's category"); the ineligible item shows **"Not eligible for points"** with no SP control. Screenshot `T01-S09-S10-U05-V11-01`. |
| TRD-TC-S09 / S10 | ✅ PASS | Bundle CTA → Checkout in bundle mode with the **"🛍️ Combined Offer"** banner ("You're making a single offer for all 2 items from this seller."). |
| TRD-TC-N05 / N08 / N11–N13 | ❌ **NOT RUN** | Zero Group-N cases reached. |
| TRD-TC-T03 / T12–T14 | ❌ **NOT RUN** | T03 needs a persona whose wallet is below the per-item cap — test-buyer holds 459 SP vs a 42 SP item cap, so the "Limited by your SP balance" branch is **not inducible on this persona** (a fixture gap, not a product gap). |

---

## 3 · Priority 3 (Tier 3, fast-confirm) — PARTIAL

| TC-ID | Verdict | Evidence |
|---|---|---|
| TRD-TC-U01 | ✅ PASS | Home = `variant="main"` (node chip + bell + chat + avatar, **no back**); Discover = `variant="tab"` (title + bell + chat, **no back**); Trade Basket = `variant="tab"` → top-left is an **empty spacer circle, not a back button** (verified at full resolution, not from the compressed thumbnail). Source: `AppHeader.tsx` `variant==='tab'` branch renders `<View style={styles.headerActionBtn} />`. |
| TRD-TC-U02 | ✅ PASS | Detail screens observed with the canonical header (back + centred title + bell + chat): Item Detail, Checkout, My Trades, More from this seller, Review Offer, Trade Timeline. |
| TRD-TC-U05 | ✅ PASS | Checkout hides the bell (right cluster renders an empty spacer); source `AppHeader` `showBell=false` for checkout/payment screens. |
| TRD-TC-V01 | ✅ PASS | Tab label reads **"Basket"** + icon unchanged; tapping opens the screen titled **"Trade Basket"** — exactly what the (Dev-Task-75-updated) guide expects. **The tracker's `V01 FAIL` row is stale (see F5).** |
| TRD-TC-V02 | ✅ PASS | Cart screen title = "Trade Basket" (`screen-title`). |
| TRD-TC-V05 | ✅ PASS | Filtered seller page buttons read **"Add to Trade Basket"**. |
| TRD-TC-V06 | ✅ PASS | Items already in the basket render the **"In Trade Basket"** state. |
| TRD-TC-V07 | ✅ PASS | Add alert reads **"Added to Trade Basket"**. |
| TRD-TC-V09 | ✅ PASS | Different-seller modal references **"trade basket"** 3× (body + "Save & Start New Trade Basket" + "Replace Trade Basket"). |
| TRD-TC-V10 | ✅ PASS | Bundle CTA says **"Make one offer for these 2 items"** — the word "Bundle" appears only in the *item-group* noun, never in the CTA. |
| TRD-TC-V11 | ✅ PASS | Checkout banner = **"Combined Offer"** (no "Bundle"). |
| TRD-TC-X03/X04/X05/X07 | ✅ PASS | Bottom nav identical (icons + green Sell FAB + badges) on My Trades, Trade Basket, Item Detail, Trade Timeline, Trade Complete, Checkout. |
| TRD-TC-X09 | ✅ PASS | Cart badge appears/updates **live with no pull-to-refresh** across 3 successive mutations (4 → 1 → 2); red pill, white bold count. *(Guide **body** numbering; the tracker's X-index row for X09 has different text — see F6.)* |
| TRD-TC-X10 | ✅ PASS | 2 same-seller items → badge `2`. |
| TRD-TC-X16 | ❌ NOT RUN | `docs/flow-registry.md` not re-checked this round. |
| TRD-TC-Y01 | ✅ PASS | Trade List summary = **Your Offers / In Progress / Needs Action (+ "Waiting on you") / Completed** with Active/History tabs. |
| TRD-TC-Y04 | ✅ PASS | "See all →" present on My Trades. |
| TRD-TC-Y09 | 🟡 PARTIAL | "What to do next" card (`next-steps-card`, 3 numbered steps) + `next-steps-cta` "Got it" both rendered; the toggle itself was not driven. |
| TRD-TC-Y02/Y03/Y05–Y08 | ❌ NOT RUN | Pagination / row Message button / R15 request-more-time flows not driven. |
| TRD-TC-V03/V04/V08/V12/V13/V14 | ❌ NOT RUN | — (V04's "View Trade Basket" button is state-gated on `inCart`; the equivalent `view-cart-button` path exists in source but was not driven this round.) |
| TRD-TC-X01/X02/X08 | ❌ NOT RUN | Home/Discover/Profile-Settings nav not separately asserted. |
| TRD-TC-N2-C01…C10 | ❌ NOT RUN | Zero idempotency/audit cases reached. |
| TRD-TC-W01…W12 | ⏭️ SKIPPED | By instruction (already 12/12). |

---

## 4 · Findings

| # | Sev | Finding | Evidence |
|---|---|---|---|
| **F1** | LOW–MED | **Stale Trade List after Confirm-All-N (R59 class).** After `Confirm All 3` completed the remaining siblings, returning to My Trades still rendered the bundle as **"IN PROGRESS · 3 items"** with the tiles frozen at *In Progress 3 / Completed 36*, even though the DB had all 4 `completed`. A `qa-refresh` deep link corrected it instantly to *0 / 0 / 0 / 39* and removed the bundle. A buyer can therefore believe items are still in progress (and "Needs Action" paths remain available) until something forces a refetch. | DB read-back vs on-screen tiles + `L02-07` (post-refresh correct state) |
| **F2** | LOW | **Stale Review Offer screen after an individual accept (R59 class).** After `Accept Trade` succeeded, the still-mounted Review Offer screen kept rendering live `accept-trade-button` / `decline-trade-button` / **"Accept All 4 items?"** for a trade the DB already had at `in_progress` — the confirm copy also over-counted (4 offered vs 3 actually pending). No data damage (the EF is idempotent), but a seller can tap "Decline" on an already-in-progress trade. | `L08-06` + DB read-back |
| **F3** | LOW (UX/affordance) | **Contradictory Seller Info affordance on Item Detail.** The card shows a padlock + **"Seller Info Hidden"** and the note *"Start a trade to see seller details and contact them."* while simultaneously presenting two **enabled** buttons, **Contact Seller** and **View Profile**. Either the buttons should be disabled/masked until a trade exists, or the note should explain what they do. Concrete rewrite for the note: *"Seller details are hidden until you start a trade. You can still message them about this item."* | `S02-S14-S21-01` |
| **F4** | LOW (env/tooling) | **App wedges after a warm `qa-login-as` persona switch.** Home + Trades both sat on perpetual spinners and a dev LogBox showed `[trade] Error counting active trades: {"message":""}` (an **empty-message** error = a fetch-layer stall, not a PostgREST error). `qa-logout` alone did not clear it; a **force-stop + cold relaunch** (R92) recovered — the cold dev-client start cost ~10 calls / ~4 min. | device logcat + `[trade] Error counting active trades` (writer: `src/services/trade.ts:155`) |
| **F5** | DOC-DRIFT | **Tracker `TRD-TC-V01 = 🔴 FAIL` is stale.** The row's note reads *"V01 FAIL re-confirmed — tab still reads 'Basket'"*, but the guide's V01 body (updated by Dev Task 75) **requires** the short form "Basket" and explicitly says this is intentional, not a defect. On-device today: tab = **"Basket"** ✅. The FAIL should be retired. | guide L6201-6215 vs tracker V01 row |
| **F6** | DOC-DRIFT | **The TRD X-group index descriptions do not match the guide's X section bodies** (e.g. index X09 = *"'Me' tab removed"*, body X09 = *"Cart badge shows item count from multiple entry points"*; index X06 = *"bottom nav on Profile/Settings/Wallet"*, body X06 = *"bottom nav on Cart Checkout"*). Verdicts must be keyed to the guide **body**, or X rows will be scored against the wrong assertion. | guide index L284-294 vs bodies L5868-6010 |
| **F7** | Locator gap | Item Detail's **Contact Seller** and **View Profile** are exposed only as un-labelled `ViewGroup`s (`label="Contact Seller"` / `label="View Profile"`) — no `testID`, no `accessibilityRole="button"`. Recommend `contact-seller-button` / `view-seller-profile-button`. | AX tree of Item Detail |
| **F8** | Fixture/harness | `create-trade-offer`'s **batch path only stamps `bundle_id` when the caller supplies it** — a direct EF call (or any non-app caller) with `items: [...]` and no `bundle_id` silently creates **N single-slot offers**, inflating `countPendingSlotsForSeller` against the per-seller cap. The app always supplies it (`cartService.checkoutCart`), so this is **not user-facing**; it is a QA-harness trap worth documenting. | EF response `"bundle_id": null` + DB read-back |
| **F9** | LOW (UX) | **Pinned "I Got It — Complete Trade" CTA overlaps the bottom tab bar and the `auto-complete-banner`** on the Trade Timeline (CTA at y1921-2106; tab bar at y2190+; the auto-complete banner sits under the CTA). Same class as the previously-reported `seller-cancel-inprogress-button` overlap. | `L02-02` |

### Near-miss false positives avoided (R100 — name the WRITER before filing)
Three candidate findings were **disproved by checking the writer/source first** and are recorded so no
future round re-files them:
1. **Basket badge = 4 for test-seller** looked like a cross-account badge leak. DB: test-seller genuinely
   has **4 `active` cart_items** (stale fixture rows from **2026-08-29**, bundle `3a73b72e`) ⇒ badge is **correct**.
2. **Trades badge = 4** vs an expected 5. DB: trade `472ef43a`'s seller is **test-seller-3**, not test-seller
   ⇒ 4 is **correct**.
3. **Books bundle trade has no `tax_records` row.** DB: its `tax_category_id` → **`tax_exempt_goods`**
   ⇒ absence is **by design**, not a missing tax record.
4. **"Back button" on the Trade Basket** looked like a U01 violation. Source (`AppHeader` `variant='tab'`)
   → it is an **empty spacer**; confirmed at full screenshot resolution ⇒ **U01 holds**.

---

## 5 · Perceived load times (simulator, wall-clock, ±polling-interval precision — not a formal profile)

| Screen → transition | Elapsed | Note |
|---|---|---|
| Cold dev-client start → Landing | **≈ 4 min** (~10 polls) | environment artifact (Metro `--clear` cold bundle), not app behaviour |
| `qa-login-as test-seller` → dashboard rendered | ≈ 25 s | cold process |
| Trades tab → list rendered | ≈ 3–5 s | |
| "View →" → Trade Timeline rendered | ≈ 3–4 s | |
| I Got It → confirm dialog | < 1 s | |
| Confirm All 3 → Trade Complete screen | ≈ 2 s | |
| Tab → Basket rendered | ≈ 2 s | |
| Basket → Checkout rendered (incl. SP state + "Points remaining: 459") | ≈ 5–8 s | ⚠️ > 3 s; two-stage load (items → combined-offer banner → SP block) |
| Discover → Item Detail | ≈ 2 s | |
| Item Detail → More from this seller | ≈ 2–3 s | |

**FLAGGED:** `Basket → Checkout` at ~5–8 s to the full SP state (two-stage render), and the ~4 min
dev-build cold start (environment).

---

## 6 · Evidence

`screenshots/` (12 on disk):
`L08-01` seller home (fresh process) · `L08-02` seller Offers bundle card · `L08-03` Review Offer with
co-present individual + bundle buttons · `L08-04` Accept Trade confirm · `L08-05` Offer Accepted alert ·
`L08-06` Accept-all-4 confirm on the **stale** screen · `L08-07` Bundle Accepted alert ·
`L02-01` buyer in-progress bundle · `L02-02` timeline + I Got It CTA · `L02-03` "Confirm all 4 items?" ·
`L02-04` Just-This-One second confirm · `L02-05` Trade Complete · `L02-06` **"Confirm all 3 items?" (the key
re-appearance frame)** · `L02-07` post-`qa-refresh` correct list ·
`M03-S01-V09-01` Different Seller modal · `M16-M18-V06-V07-01` toast + In Trade Basket ·
`V06-X07-02` two items / badge 2 · `S07-M13-01` basket with unavailable items + bundle CTA ·
`S07-S17-S20-V02-V10-01` basket 2 items bundle CTA + 24-more banner ·
`S02-V04-01` Item Detail more-from-seller icon area · `S02-S14-S21-01` hidden seller info + standalone CTA ·
`S04-V05-01` filtered seller page · `T01-S09-S10-U05-V11-01` checkout combined offer + SP input.

**Unmet capture obligations (declared, not silently traded):** two frames exist only in the tool trace,
not on disk — (a) the **stale Trade List** frame immediately after `Confirm All 3` (F1), and (b) the
post-`Just This One` My Trades frame showing *3 In Progress / 36 Completed*. Both are re-derivable from
the DB state recorded above plus `L02-05`.

---

## 7 · App state left behind

- **Android emulator** left **logged in as test-buyer**, sitting on the **Checkout** screen with a 2-item
  basket (bob.11demo items) — the checkout was **not** submitted, so no order was created.
- **Cart rewritten:** test-buyer's original 4-item cart (sold fixture items) was **replaced** via the
  in-app "Replace Trade Basket" flow with 2 available items:
  `240806c6-381d-4ba2-9aa0-e6ea125c4234` ("Test cancel trade by seller", $40) and
  `0712f916-fa66-4bb2-a595-21edcad51a18` ("E2E Pocket Button Active shorts", $60).
- **Data created this run:** 4 fixture listings (now `sold`), 4 bundle trades — **all 4 `completed`** with
  real Stripe captures + tax collected (3 × 203¢ taxable; 1 Books item tax-exempt); trade `472ef43a`
  **auto-completed** (residue cleared) with 1 payout row (`requires_action` $9.00) and test-seller-3 SP
  `pending_balance` +15.
- **Fixture writes (2, both declared):** one `UPDATE trades SET bundle_id …` (4 pending rows) and one
  `UPDATE trades SET auto_complete_at = now() + interval '5 seconds'` (fast clock).
- **No `admin_config` writes, no admin-portal mutations, no browser stubs left registered.**
- **Metro:** `:8081` (this session) and `:8082` (a colleague session) both still running — do **not** kill 8082.
- test-buyer's SP wallet was **not** debited by this run (all offers were cash-only, `sp_amount = 0`).

---

## 8 · Suggested to improve agent rules
1. **New rule candidate:** *"an empty-message fetch error (`{"message":""}`) is a fetch-layer stall, not a
   PostgREST error — recover with force-stop + cold relaunch, and never file it as a product defect."*
   (F4; today's wedge cost ~12 calls before the R92 relaunch.)
2. **Extend §5.6's evidence mandate** with the cheap habit: when a **staleness** finding is the point,
   save BOTH frames (stale + post-refetch) before refetching — the stale frame is the proof and it is
   unreproducible a second later (two such frames were lost this round).
3. **Extend R100** with the **badge/tab-count** case: a nav-badge count is a *writer* too — reconcile it
   against a per-persona DB count before calling it a leak (3 of 4 candidate findings this round died here).
