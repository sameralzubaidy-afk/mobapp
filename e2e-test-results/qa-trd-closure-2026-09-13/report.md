# QA Task — TRD Final Closure round

**Date:** 2026-09-13 · **Platform:** Android emulator `Medium_Phone_API_36.1` (portrait) — **iOS 17 Pro Max was booted but NOT driven (R80: no iOS verdict claimed)**
**Metro:** 8081 + 8082 up · **Admin portal:** `:3001` up (not reached — the admin legs were classified by source instead; see §5)
**Device:** `com.sameralzubaidi.p2pmarketplace`, dev-client
**Evidence:** `e2e-test-results/qa-trd-closure-2026-09-13/screenshots/` (30 frames)

---

## 0. Step 0 — the real current scope (reconciliation, not memory)

**Method:** parsed `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`'s TRD table mechanically (TC-ID + Status column) rather than trusting the reconstructed list.

**Result — the non-final TRD set was 44 rows: 28 🟡 PARTIAL + 16 Remaining (all owner-excluded).**

**The reconstructed list in the dispatch was ~96 % stale.** 23 of the 24 IDs it named are already ✅ PASS on the tracker; one is ⏭️ SKIPPED:

| Named in dispatch | Tracker reality (verified this round) |
|---|---|
| N05, N08, N12, N13 | ✅ PASS all four (FIX-Task-28 round, 2026-09-13) |
| T02, T12, T13, T14 | ✅ PASS all four |
| S06, S08, S09, S11, S13, S22, S23 | ✅ PASS all seven |
| M05 | ⏭️ SKIPPED · M06, M14, M15, M19, M20 → ✅ PASS |
| V08, V12, X08 | ✅ PASS all three |

Only **S03 / S10 / S12 / S15 / S19** out of the whole reconstructed list were genuinely still open — and they were already inside the 28.

**The 28 PARTIAL rows (the real scope)** — `B02 B10 H05 M16 M18 N03 O1-C16 O2-C02 O2-C03 O2-C10 O2-C12 O3-C01 O3-C02 O3-C04 O3-C06 O3-C14 P02 P03 R03 R07 R08 R09 S03 S10 S12 S15 S19 T11`.

**Session-start hygiene:** `npm run qa:reset-offer-fixtures` run BEFORE any cart/bundle was built (R16-1) — cleared 3 stale cart rows + cancelled 6 stale pending offers + voided 5 tax records. The 3 `in_progress` trades for `test-seller-3` (bundle `330427dc`) were deliberately preserved.

---

## 1. Verdicts

### 1.1 Status flips (16 rows leave 🟡 PARTIAL)

| TC-ID | From | To | Evidence |
|---|---|---|---|
| TRD-TC-M16 | 🟡 | ✅ PASS | toast captured **mid-slide-in** (`M16-M18-03`) and **fully rendered** (`M16-M18-04`, "Added to Trade Basket"); absent in frames taken ~3 s+ after earlier adds (`M16-M18-01/02`); source `SuccessToast` default `duration = 2500`. |
| TRD-TC-M18 | 🟡 | ✅ PASS | `M16-M18-04` — toast copy is exactly **"Added to Trade Basket"**; corroborated by `view-cart-button` label "View Trade Basket" and the basket screen title "Trade Basket". |
| TRD-TC-S03 | 🟡 | ✅ PASS | single-listing seller verified in DB (`2b1246c6…` = exactly 1 available+approved) → Item Detail renders **no `more-from-seller-cta`** anywhere in the tree and no placeholder (`S03-02/03/04`). Positive control: a multi-listing seller on the same screen renders `add-to-cart-button` (`M16-03`). |
| TRD-TC-S15 | 🟡 | ✅ PASS | same drive — nothing below the Seller Info card; card renders normally ("Seller Info Hidden", "No rating yet", Contact Seller, View Profile, "Start a trade to see seller details"). |
| TRD-TC-S10 | 🟡 | ✅ PASS | **bundle mode (6 items)**: `📦 Combined Offer — You're making a single offer for all 6 items from this seller.` present (`S10-04`). **single-item mode**: no banner at all (`S10-09`). Guide step 1's "tap regular Checkout" → **DOC-DRIFT** (see §4). |
| TRD-TC-S12 | 🟡 | ✅ PASS | single-item cash-only offer re-driven end-to-end at the offer leg: Checkout → disclaimer → Send Offer → "Trade Initiated!" (`S12-01/02/03`); DB: **exactly 1** new trade `1dfae1ce…`, `status=pending`, cash 3000¢, buyer fee 149¢, `sp_amount=0`, `disclaimer_acknowledged=true`, cart emptied (0 `cart_items`). Completion halves credited to A01/A02's own PASS records. |
| TRD-TC-O1-C16 | 🟡 | ✅ PASS | `tax/category-mapping/page.tsx:341` — Save is `disabled={… || !editValue}`, i.e. the empty-dropdown path is now **disabled, not a silent no-op** (FIX-Task-20 F6). Fabricated-UUID guard remains PASS on record. |
| TRD-TC-B02 | 🟡 | ✅ PASS | the flagged residual (`offer_expired` vs `Offer expired`) is **resolved by the guide amendment + the shipped friendly string** — the B02 body carries no snake-code assertion (verified by reading the canonical body). Expiry mechanics + History tab PASS on record. |
| TRD-TC-T11 | 🟡 | 📄 DOC-DRIFT | guide asserts buyer-debit-at-offer; by design (D-17) SP transfers at **COMPLETION** in a single release (`trades.sp_transferred_at` NULL until completion). Completion-time release verified across A02/C05/Z05. |
| TRD-TC-O3-C14 | 🟡 | 📄 DOC-DRIFT | the CSV export is **intentionally unfiltered by status**; totals reconcile exactly *after* filtering `tax_status` (verified 2026-09-11/12: voided $102.08 / refunded $0.00 exact). The guide's "CSV sums == on-screen totals" only holds per-status. |
| TRD-TC-P02 | 🟡 | 📄 DOC-DRIFT | no bulk tax-node update UI exists. The portal's only bulk affordance is `categories/components/BulkActionsDropdown` (Activate/Deactivate/Delete/**Export**) — no tax-rate bulk edit. The guide's own status line is *"Needs manual testing **if** bulk update UI exists"*. |
| TRD-TC-P03 | 🟡 | 📄 DOC-DRIFT | the asserted affordance ("Tax → Nodes → **View Change History** on a node") does not exist. `tax/nodes/page.tsx` has no history control; the only version-history UI is `tax/rules` ("Version History by Category") which is **rule**-version history, not per-node. |
| TRD-TC-O2-C10 | 🟡 | ⏭️ SKIPPED | permanent environment limitation — needs an **inducible Stripe capture failure**. Same accepted class as the owner-excluded O3-C08/C09. |
| TRD-TC-O3-C04 | 🟡 | ⏭️ SKIPPED | same class — capture-failure copy is not inducible on staging. |
| TRD-TC-H05 | 🟡 | ⏭️ SKIPPED | permanent environment limitation — the trial-**start** leg is unreachable because `admin_config.trial_enabled = false` on staging is a **confirmed intentional product decision** (Group I closure, `docs/DECISIONS.md` D-001). State machine source-verified. |
| TRD-TC-S19 | 🟡 | 🔴 BLOCKED (named residual) | see §3. |

**New TRD totals (arithmetic reconciled across the file header, §1 roll-up, the TRD section header and the Completed/Remaining tables):**
**285 ✅ PASS / 12 🟡 PARTIAL / 1 🔴 OPEN / 13 📄 DOC-DRIFT / 6 ⏭️ SKIPPED / 16 Remaining = 333 ✓**

### 1.2 The FINAL RESIDUAL — 13 rows, each named with its reason

| TC-ID | State | Exact reason it is not PASS / DRIFT |
|---|---|---|
| **S19** | 🔴 BLOCKED | Only seller with exactly 3 listings is `test-seller-2`, whose 3 listings carry **`node_id = NULL`** → not returned by Discover search with "Show All Nodes" **both Off and On** (driven: "Board Game Set" → "No Results Found"; `S19-01/02`), and **no listing deep-link is registered** (playbook §5.67b) ⇒ the "all 3 in the basket" precondition has no reachable entry point. Mechanism's positive range captured instead: "This seller has **37** more items" with 6 of test-seller's 43 in the basket, and "This seller has **1** more item" with 1 of 2. **Needs a discoverable ≤3-listing seller fixture.** |
| B10 | 🟡 PARTIAL | Stripe's native "new card" entry inside the PaymentSheet — the attach/persist code path is verified (DT-83 D2 PASS); the literal card-entry leg is tooling-limited. |
| N03 | 🟡 PARTIAL | Config-write leg (0→5→0) verified; residual is the field label ("Min Listing Price") vs the guide's "Minimum Listing Price". |
| O2-C02 | 🟡 PARTIAL | Mixed-bundle line-level tax correct (taxable 161¢ each, Books 0¢); the **green "Tax Free" badge is not rendered on the cart-checkout surface** (it does render on Item Detail — observed this round). Dev-side UI gap. |
| O2-C03 | 🟡 PARTIAL | Fee-in-tax-base base change observed; the **full on/off round-trip** was not driven (needs an `include_fee_in_tax_base` write + a fresh offer). |
| O2-C12 | 🟡 PARTIAL | The 34 pre-migration rows are fixed (quoted 0 / collected 50). Residual = **9 completed+quoted cash rows** ($80.63) awaiting the **owner's void-vs-collect decision** — not a QA-closeable item. |
| O3-C01 | 🟡 PARTIAL | "Payment authorized" pre-capture wording — per-status wording legs only partly covered. |
| O3-C02 | 🟡 PARTIAL | Same, for the post-seller-accept (In Progress) status. |
| O3-C06 | 🟡 PARTIAL | Duplicate-refund protection is three-layered; layer 1 (RPC cap guard) driven live, layers 2–3 source-verified only. |
| R03 | 🟡 PARTIAL | Expiry limb PASS; the **competing-offers** limb still owed (needs two live offers on one listing + `rpc_process_expired_offers`, a DB write ⇒ needs explicit approval). |
| R07 | 🟡 PARTIAL | SP-reversal mechanism source-confirmed; an in-progress SP trade was not UI-cancelled to observe it. |
| R08 | 🟡 PARTIAL | "No `seller_payouts` on cancel/void" re-confirmed historically; not re-driven this round. |
| R09 | 🟡 PARTIAL | Dispute-resolve → Refund money flow is fixture-gapped (needs a disputed trade + the admin refund route). |

**Owner-excluded set (16 Remaining rows — unchanged, not re-litigated):** A03, A04, D05, D06, E05, E06, N2, O3-C08, O3-C09, Q10, Q11, Q13, Q14, Q16, R02, R05.

---

## 2. FIX-Task-29 carryover verification (Step 6)

| Item | Verdict | Evidence |
|---|---|---|
| **A3** — Admin Dashboard blue button | ✅ **SOURCE-VERIFIED** / 🔴 **on-device leg BLOCKED** | `src/screens/admin/AdminDashboardScreen.tsx` now contains **zero literal hex**: the hand-rolled filled-blue `styles.button` is replaced by the shared `ui/Button variant="primary" size="large"` with `testID="admin-run-mid-trade-check"`, and the `#007AFF` icon is now `theme.colors.secondary[500]` = **`#5B8FB9`** (info). **On-device blocked by a persona-credential drift** — `qa-login-as?persona=test-admin` fails 3/3 attempts, twice in a row, with the app's own log line: `[QaLoginAsDeepLink] login-as test-admin attempt 1/3 failed: code=INVALID_CREDENTIALS … Invalid login credentials` → the handler then clears the half-switched session and routes to Landing. `test-admin` is the only mobile admin persona ⇒ no admin session is obtainable via the QA path. |
| **7C — Item Detail link/SP card accent** | ✅ PASS | full-frame `qa:badge-scan` on the Item Detail frame: **0 iOS-system-blue pixels (0.00 %)** of a 2,592,000-px region — the `ItemDetailScreen.tsx` `#007AFF` accent is gone from the rendered screen. |
| **7C — Trade Initiation info badge** | ✅ PASS (source) | `TradeInitiationScreen.tsx:981` = `backgroundColor: '#5B8FB9'` (info), no `#007AFF` in the file. |
| **7C — Search Filters waitlist banner** | ✅ PASS (source) | no `#007AFF` remains in the Discover filter/waitlist surface; `DiscoverScreen` is clean. |
| **7C — skipped targets confirmed dead** | ✅ | `CategoryFilterChip` and `PriceSuggestionCard` (the two `#007AFF` holders the owner said to skip) are imported by **no live screen** — only their own file + a unit test. The skip decision is correct. |

---

## 3. Batch summary

| TC-ID | Verdict | Top evidence |
|---|---|---|
| M16 | ✅ PASS | toast captured at ~1.6 s then gone |
| M18 | ✅ PASS | "Added to Trade Basket" |
| S03 | ✅ PASS | no CTA at 0 additional listings |
| S15 | ✅ PASS | nothing below the seller card |
| S10 | ✅ PASS | banner present (6 items) / absent (1 item) |
| S12 | ✅ PASS | 1 trade, DB-verified |
| S19 | 🔴 BLOCKED | fixture unreachable (node NULL) |

### Perceived load times (simulator, wall-clock, ±polling precision — not a formal profile)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Discover → Item Detail (tap card) | < 1 s | — |
| Basket → Checkout (tap CTA) | < 1 s | — |
| Checkout → disclaimer modal | < 1 s | — |
| Checkout → Trade Initiated | ~2 s | — |
| **Mid-session unsolicited JS reload** (blank + spinner → Home) | **~15–20 s** | ⚠ ≥3 s — dev-client bundle reload, environment artifact |

**No transition ≥ 3 s except the dev-client bundle reload.**

---

## 4. Doc-drift found in the guide this round

1. **S10 step 1** — "tap **regular Checkout**" describes a **removed** affordance. `CartScreen` ships **one** CTA: `bundle-cta-button` (≥2 items) / `single-item-cta-button` (1 item); `bundleMode = cartItems.length >= 2` is derived from the item count (source comment: *"CART-009: Server-side validation gate (moved from **removed Checkout button**)"*). The case's discriminating intent is fully drivable via the single CTA — which is how it was PASSed.
2. **S07 copy** — the shipped bundle CTA reads *"📦 Make one offer for these N items / All items from this seller"*, not the quoted *"Bundle these N items — Make one offer for all items from this seller."*
3. **P02 / P03** — flips to DOC-DRIFT as tabled above.

---

## 5. Findings (ranked)

| # | Sev | Finding |
|---|---|---|
| F1 | **MED** | **`test-admin` persona credential is stale** — `qa-login-as?persona=test-admin` fails `INVALID_CREDENTIALS` 3/3 ×2 rounds. Blocks every admin-persona mobile case (incl. the A3 verification). Fix: update the persona password in `src/services/qaPersonas.ts` **or** reset the staging credential — a dev-team task. |
| F2 | **MED** | **`test-seller-2`'s 3 listings are unreachable from the UI** — `node_id = NULL` and Discover search returns **0 results** for their exact titles with "Show All Nodes" both Off and On. They are the only exactly-3-listing fixture, so S19 cannot be driven; they also can't be bought/offered on at all. Fix: assign `node_id` in the seed (`seedSeller2`) or add a listing deep link. |
| F3 | **LOW (stale-cache class)** | **Basket tab badge is stale after checkout** — the badge still read **1** on the "Trade Initiated!" screen while `cart_items` for test-buyer was **0** rows (DB-verified). Clears on a Basket remount. Same class as the known F1 stale-basket-badge. |
| F4 | **LOW (copy)** | **`Clear basket, removes all 1 items`** — the `Clear Basket` button's accessibility label does not pluralise (`items` at n=1) while the visible sub-line does ("Removes all 1 item"). |
| F5 | **LOW (copy, still live)** | The **liability disclaimer body is still the verbatim Amazon Services Business Solutions Agreement insurance text** (captured in full in this round's AX dump of `disclaimer-modal`). Already tracked as a standalone CRITICAL; recorded here as still-live. |
| F6 | **LOW–MED** | `EditListingScreen` was **not** re-driven this round, so the previously-proven `#007AFF` "+ Add Photo" filled primary (the A1 acceptance item) has **no on-device frame** in this round's evidence — source says it is fixed (`ImagePickerGrid` is token-driven), and the file is imported by exactly one live screen. |

---

## 6. Friction vs. the operating rules (for the next toolkit round)

1. **A transient toast cannot be caught by tap→screenshot** — the MCP round-trip (~3 s) exceeds the 2.5 s window. **What worked:** `mobile_batch_commands` = `[tap] + N × mobile_get_orientation + mobile_save_screenshot` (N≈3 caught it mid-slide at ~1.2 s; N=6 caught it fully at ~1.6 s). This is the **R108 technique extended from logs to transient UI** — proposed as a rule refinement (see the handoff).
2. **`view_image` downscales frames** (a 1080×2400 capture is shown at 880×1956). Deriving tap coordinates from the *displayed* image produced a miss on the Clear-Basket confirm. Tap coordinates must come from the **AX tree**, never from the displayed screenshot.
3. **`mobile_click_on_screen_at_coordinates` with a bare coordinate pair silently no-ops** on this emulator more often than a ref-based click (re-confirmed this round: a 3-tap chained batch produced no state change). Prefer `ref`.
4. **A batch's in-line screenshot is pre-render** (R95 re-confirmed twice: the batch screenshot still showed Discover/Item Detail while the tree showed the destination).
5. **An unsolicited full JS bundle reload** happened mid-session after a search interaction (blank screen + spinner → Home, ~15–20 s, session preserved). Cost 2 calls and one field state. Environment artifact; worth an R79-1-style note.
6. **Discover search field corruption** — tapping the field at a *blind* coordinate while it held text inserted the new string mid-value ("Hood Raincoat Hoo**QA Bundle Fixture**die"). Resolved with the app's own "Clear search" control, then a **ref-based** field tap.

---

## 7. App state left behind

- Logged **out** (Landing) — the failed `test-admin` persona switch cleared the session.
- **1 new pending trade**: `1dfae1ce-58f3-4b95-870c-40d9cc989464` (buyer test-buyer, "Pocket Button Active Shorts" $30, listing `704410de…`) — reclaim with `npm run qa:reset-offer-fixtures`.
- **Basket empty** (cleared; the 6-item test-seller cart used for S10 was cleared deliberately).
- 6 `QA Bundle Fixture (2026-09-13)` listings left `available` (reset by the session-start harness).
- **No `admin_config` writes, no admin-portal writes, no stubs registered, no source/test/seed edits.**

---

## 📋 QA Session Handoff

**Test Scope:** TRD final-closure batch — M16, M18, S03, S10, S12, S15, S19 (+ Step-0 reconciliation over all 44 non-final TRD rows) + FIX-Task-29 carryover A3 / 7C accents. Guide: `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`. Platform: Android `Medium_Phone_API_36.1` (iOS booted, NOT driven — R80).
**Design-System Compliance:** PASS — no deviations in the screens/dialogs visited. The Clear-Basket destructive confirm renders the documented in-app branded modal (green-outline Cancel + danger-red filled confirm on a white rounded surface); the Item Detail primary CTA is the brand green `#5DBB8E` pill; the Item Detail full-frame scan returned **0.00 %** iOS-system-blue pixels; no literal-hex leakage was observed on any visited surface. (BP-82's Tailwind-gray family remains app-wide per FIX-Task-29's own note — a separate, larger sweep, not evaluated here.)
**Perceived Load-Time Verdict:** FLAGGED — one entry: *mid-session unsolicited JS bundle reload → blank+spinner → Home: ~15–20 s*. Environment artifact (dev-client bundle reload), **not** app behaviour; all genuine screen transitions were < 2 s (see the load-time table).
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Home (dashboard): brand green SP strip, single primary per section, consistent neutral text tiers.
- CONFIRMED — Discover: no seller-identity leakage on grid cards; chip/sort/filter row on-token.
- CONFIRMED — Item Detail: single filled primary (`Request to Buy`), "Tax Free" badge uses the documented exempt treatment, no `#007AFF`.
- CONFIRMED — Trade Basket: "more from this seller" banner + bundle CTA + summary all on-token; exactly one filled CTA.
- CONFIRMED — Clear Trade Basket dialog: documented destructive-modal treatment.
- CONFIRMED — Checkout: single filled primary (`Send Offer · $31.49`), correct fee/total stack.
- CONFIRMED — Liability Disclaimer modal layout/typography — but **DEVIATION (content)**: the body is the verbatim Amazon Services Business Solutions Agreement insurance text (F5, already tracked CRITICAL — not re-filed).
- CONFIRMED — Trade Initiated success screen: green check, brand pill + outline hierarchy.
- DEVIATION — Clear Basket button `accessibilityLabel` "Clear basket, removes all **1 items**" (no singular form) — F4.
**Verdict Summary:** 6 PASS / 0 FAIL / 1 BLOCKED (S19) / 0 SKIPPED this batch; plus **16 tracker rows flipped** (8 → PASS, 4 → DOC-DRIFT, 3 → SKIPPED, 1 → BLOCKED).
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — flips: **B02, M16, M18, O1-C16, S03, S10, S12, S15 → ✅ PASS**; **O3-C14, P02, P03, T11 → 📄 DOC-DRIFT**; **H05, O2-C10, O3-C04 → ⏭️ SKIPPED**; **S19 → 🔴 OPEN (BLOCKED)**. New TRD totals: **285 PASS / 12 PARTIAL / 1 OPEN / 13 DOC-DRIFT / 6 SKIPPED / 16 Remaining = 333 ✓** (header ⇄ §1 roll-up ⇄ TRD section header reconciled in the same pass, R56/R59).
**Critical Findings:** (1) **MED** `test-admin` persona credential stale → every admin-persona mobile case blocked (F1). (2) **MED** `test-seller-2`'s listings are `node_id = NULL` → invisible to Discover under both node scopes and unreachable by any deep link → S19 permanently blocked until the fixture is fixed (F2). (3) **LOW** stale Basket badge after checkout (F3). (4) **LOW** "1 items" a11y copy (F4). (5) **LOW** Amazon disclaimer text still live (F5, already CRITICAL).
**App State Left Behind:** logged out on Landing; 1 new pending trade `1dfae1ce…` (reclaim with `npm run qa:reset-offer-fixtures`); basket empty; 6 bundle-fixture listings left `available`; no config writes, no admin writes, no stubs, no repo edits.
**Why It Matters:** TRD is now **285/333 PASS with only 13 named residuals + 16 owner-excluded rows** — every one of them carries an explicit reason, and the four rows that close as DOC-DRIFT were closed by reading the shipped source/guide rather than guessing. The two MED findings are the reason the last few rows stay open, and both are one-line dev fixes.
**How to Verify/Reproduce:** `e2e-test-results/qa-trd-closure-2026-09-13/screenshots/` — `M16-M18-04-toast-fully-rendered.png` (toast), `S03-02..04` (S03/S15), `S10-04` / `S10-09` (bundle vs single checkout), `S12-01..03` + trade `1dfae1ce…` (S12), `S19-01/02` (node-NULL search dead-end), `A3-01/02` (Landing after the admin persona switch fails). Re-run: `qa-login-as?persona=test-buyer` → search an item → Add → Basket.
**Known Gaps / Not Tested:** S19's 3-item condition (fixture unreachable); A3's on-device render (persona credential); the Edit Listing "+ Add Photo" frame (not re-driven — F6); the admin-portal browser legs O1-C16/P02/P03/O3-C14/R09 were classified from **source + the guide body**, not re-driven in the browser; O2-C03's on/off round-trip; R03's competing-offers limb; R07/R08/R09's money legs; B10's native card entry.
**What Needs To Be Fixed Next:** 1. **Fix the `test-admin` persona password** in `src/services/qaPersonas.ts` (or reset the staging credential) — unblocks all admin-persona mobile verification. 2. **Assign `node_id` to `test-seller-2`'s 3 listings in `seedSeller2`** (or register a listing deep link) — unblocks S19 and makes those listings tradeable at all. 3. **Make the Basket tab badge refresh after checkout** (it lags `cart_items` by a remount) — F3. 4. **Pluralise the Clear-Basket accessibility label** ("1 item") — F4. 5. **Render the green "Tax Free" badge on the cart-checkout surface** for exempt line items (O2-C02's residual). 6. Update the S10 step text (remove "regular Checkout") and S07's quoted bundle copy.
**UX Enhancement Ideas (optional, not defects):** On **Trade Initiated**, the screen still shows *"Consider using SP on your next purchase to save more."* on an order that had **no SP applied** — consider suppressing the nudge when the buyer just declined/ignored SP, to avoid prompting for something they chose not to use. On the **Trade Basket**, the "more from this seller" banner's leading icon tile reads as a neutral gray rather than the brand primary used by the bundle CTA directly beneath it — consider tinting it to match so the two blocks read as one grouping.
**Suggested Next Session:** a **fixture-and-admin-enablement session**: fix the `test-admin` credential + `test-seller-2`'s node, then re-drive the 13 named residuals — starting with S19 (3-item basket), A3 (admin dashboard render), and O2-C03 (fee-in-tax-base round-trip), which together are the cheapest remaining closures.
**Suggested to Improve Agent Rules:** **extend R108 from logs to transient UI** — to capture a < 3 s visual state (toast/banner/snackbar) that a tap→screenshot round-trip cannot reach, batch `[trigger tap] + N × mobile_get_orientation + mobile_save_screenshot` (N≈3 catches mid-animation, N≈6 catches the settled state). Also add the twin of R95/R107: **derive tap coordinates only from the AX tree, never from the displayed screenshot** (`view_image` downscales a 1080×2400 capture to 880×1956).
