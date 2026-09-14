# QA Task — TRD's Final 13 Named Residuals (CLOSING REPORT)

**Date:** 2026-09-13 (run window 19:39 → 00:35 UTC rollout)
**Platform:** Android emulator `Medium_Phone_API_36.1` — **iOS 17 Pro Max was booted but NOT driven (R80: no iOS verdict claimed)**
**Metro:** 8081 + 8082 · **Admin portal:** `http://localhost:3001` (live, real admin session — `samer`)
**Device app:** `com.sameralzubaidi.p2pmarketplace` (Expo dev client)
**Evidence:** `screenshots/` (S19-*, O2C02-*, O3C01-*, O3C02-*, R07-*, R09-*, A3-*, B10-*)
**Supersedes:** the round notes for `qa-trd-closure-2026-09-13` and earlier.

---

## 0. Step 0 — the real residual set (reconciliation, not memory)

The dispatch's own instruction was to pull the tracker's current list rather than trust a reconstructed one. Done: `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` was parsed mechanically (TC-ID + Status column).

**Result — TRD was `285 ✅ / 12 🟡 / 1 🔴 / 13 📄 / 6 ⏭️ / 16 Remaining = 333`.**

The real residual set was **13 rows**, matching the dispatch's headline count:

- **12 🟡 PARTIAL:** B10, N03, O2-C02, O2-C03, O2-C12, O3-C01, O3-C02, O3-C06, R03, R07, R08, R09
- **1 🔴 OPEN:** S19

The dispatch's *named* items (R03, R07/R08/R09, B10, O2-C03, + "whichever others") were **correct but incomplete** — N03, O2-C02, O3-C01, O3-C02, O3-C06 and O2-C12 were the unnamed remainder. The tracker was the source of truth.

**Session-start hygiene:** preconditions were read-only DB-verified before device time (FIX-Task-30 items 1 & 2 proved in the DB **and** in the UI), and `npm run qa:reset-offer-fixtures` ran **before** any cart existed (R16-1). It was deliberately **not** run once a basket was built.

---

## 1. Verdicts

### 1.1 Status flips — 10 rows leave the residual set

| TC-ID | From | To | Evidence |
|---|---|---|---|
| **TRD-TC-S19** | 🔴 **OPEN** | ✅ **PASS** | `test-seller-2`'s 3 listings are now Discoverable (**"1 result · near CT"** with **Show All Nodes = Off**). All 3 in the basket (DB: 3 `cart_items`). **Before/after pair:** 2-of-3 → banner *"This seller has 1 more item"*; **3-of-3 → banner region empty** (OCR of the 3-item frame contains **no** "more item"/"Browse all items" text) with all 3 items listed, Total $46.00. |
| **TRD-TC-B10** | 🟡 PARTIAL | ✅ **PASS** | **The literal card-entry leg (tooling-limited since 2026-09-02) is DRIVEN.** `Add New Card` → **`Replace Card`** → native Stripe **PaymentSheet SetupIntent** (TEST · *no immediate charge* · locked **Set up**) → *Add new card* form filled **4242 4242 4242 4242 · 12/34 · 123 · 06850** (VISA auto-detected) → **"Card Added — Your new card has been saved successfully."** → Checkout flips to **"Paying with VISA •••• 4242 · Expires 12/2034"**. Persistence DB-verified: `subscriptions.stripe_payment_method_id = pm_1UFNpm4I6kCJlvXop2yMXsky` (new, `updated_at` 00:33:29). |
| **TRD-TC-N03** | 🟡 PARTIAL | ✅ **PASS** | Config → Fees renders **"Min Listing Price"** with the guide's exact description — matching the current guide body verbatim; the label mismatch is gone. |
| **TRD-TC-O2-C02** | 🟡 PARTIAL | ✅ **PASS** | Exempt line of a **mixed** bundle now renders the green **"Tax Free"** badge on the cart-checkout surface (on the exempt line only). Badge region: **69.88 % pill bg / 8.62 % brand green / 0.00 % off-brand blue**. Bundle `f07c51c4`: 3 trades all `quoted`, tax 140/126 at the live 6.99 % rate, fee charged **once**, exempt line carries **no** tax row. |
| **TRD-TC-O2-C03** | 🟡 PARTIAL | ✅ **PASS** | **On/off round-trip driven.** #1 (fee NOT in base) tax **196**; admin UI write → #2 (fee IN base) tax **206**; Δ = 10¢ = **149 × 0.0699** exactly; #2's snapshot records `include_fee_in_tax_base: true` (base 2949); #1's snapshot **unchanged** (not retroactive). Config **reverted via the same UI** and re-verified. |
| **TRD-TC-O3-C01** | 🟡 PARTIAL | ✅ **PASS** | Pending trade: **"Payment authorized:" $20.00**, Swap Points 0 SP, Platform Fee $1.49, **"Estimated Sales Tax (6.99%)" $1.40**, Total **$22.89** (arithmetic ✓). |
| **TRD-TC-O3-C02** | 🟡 PARTIAL | ✅ **PASS** | After a real seller **Accept All** ("…charge the buyer's saved payment method") the trade is **In Progress** and the card is **unchanged** — capture has not happened, "Estimated" prefix persists. |
| **TRD-TC-R07** | 🟡 PARTIAL | ✅ **PASS** | In-progress **SP cancel driven end-to-end**: 5 SP reserved (ledger `spend_purchase −5`, 458→453) → accepted → **cancelled via the UI** ("Can't do pickup") → buyer **453→458**, `reserved_sp 5→0`, exactly **one** `earn_refund +5`; **seller retained nothing** (`sp_transferred_at` NULL, 0 seller ledger entries, balances unchanged). |
| **TRD-TC-R08** | 🟡 PARTIAL | ✅ **PASS** | **0 `seller_payouts`** rows on both cancel paths (admin dispute-refund and seller UI cancel); 0 trades with `payout_status='paid'`. R100 note recorded (see §4). |
| **TRD-TC-R09** | 🟡 PARTIAL | ✅ **PASS** | Buyer dispute (`Report an Issue` → *Item not as described*) → admin **Disputes → Reported → Resolve → Refund**. DB: `cancelled`, `dispute_resolution=resolved_buyer`, `cancellation_reason=dispute_resolved_refund`, tax **`voided`**, **0 payouts**, **both parties notified** (`trade_cancelled`). |

### 1.2 New TRD totals (arithmetic reconciled)

**295 ✅ PASS / 3 🟡 PARTIAL / 0 🔴 OPEN / 13 📄 DOC-DRIFT / 6 ⏭️ SKIPPED / 16 Remaining = 333 ✓**
(file header ⇄ §1 roll-up ⇄ TRD section header ⇄ round note all updated in the same pass, R56/R59)

**TRD's OPEN count is now ZERO.** The residual set is **3 rows**.

### 1.3 The final accepted residuals — 3, each with its reason

| TC-ID | State | Exact reason it is not PASS — and why it is accepted |
|---|---|---|
| **R03** | 🟡 PARTIAL | Only the **competing-offers** limb is owed. It needs **two live offers on ONE listing** plus `rpc_process_expired_offers` with a fast-clocked expiry — i.e. **a DB write that requires explicit owner approval**. Approval was not granted this round, so it was deliberately **not attempted** (filed as an accepted residual, exactly like the Group Z and Stripe-injection classes). The expiry limb is already PASS on record. |
| **O2-C12** | 🟡 PARTIAL | **An owner decision is owed, not a QA drive.** 9 completed+quoted cash rows ($80.63) await the owner's **void-vs-collect** call. The 34 pre-migration rows are FIXED and re-verified. Not closeable by execution. |
| **O3-C06** | 🟡 PARTIAL | Three-layered protection: **layer 1** (RPC component cap → `REFUND_EXCEEDS_COLLECTED`) driven live on record; **layer 2 advanced this round** — a resolved dispute exposes **no resolve action anywhere in the admin UI** (the queue drops it, the detail page offers none), and the EF guard `ALREADY_RESOLVED` is source-read at `resolve-dispute/index.ts:119-120` — **but the EF could not be invoked a second time because the QA EF harness has no admin persona registered** (`qa:ef-repro` knows only buyer/seller personas); **layer 3** (Stripe `charge_already_refunded` reconciliation) requires a captured-and-refunded charge and is **not inducible on staging**. |

**Owner-excluded set (16 Remaining — unchanged, not re-litigated):** A03, A04, D05, D06, E05, E06, N2, O3-C08, O3-C09, Q10, Q11, Q13, Q14, Q16, R02, R05.
**Permanent-env SKIPPED (6, unchanged):** H05, M05, O1-C12, O2-C10, O3-C04, Y07.

---

## 2. FIX-Task-30 verification (items 1–5, 7)

| Item | Verdict | Evidence |
|---|---|---|
| **1 — `test-admin` credential** | ✅ **VERIFIED END-TO-END** | `qa-login-as?persona=test-admin` **succeeds** (was 3/3 INVALID_CREDENTIALS ×2 rounds). Avatar reads **"TA"**, admin persona Home renders, and the **Admin Dashboard** is reachable by deep link. DB cross-check: `encrypted_password = crypt('TestAdmin123!', …)` → true. |
| **2 — `test-seller-2` `node_id`; prod-risk question** | ✅ **VERIFIED; NOT a prod bug (confirmed)** | All 3 listings now carry `node_id = 550e8400-…0001`, `available`, approved. **UI-proven** Discoverable: each exact-title search returns *"1 result · near CT"* with **Show All Nodes Off**. The FIX-Task-30 investigation stands: `trg_set_item_node_id` copies `profiles.node_id` on INSERT and `createListing()` never writes it by design ⇒ **no client path can produce a NULL node for a node-holding seller**; the only real-world NULL case is a node-less seller (a documented product decision). **No separate security/production escalation is warranted** — the "production risk" reading is closed. |
| **3 — Basket badge staleness** | ✅ already FALSE POSITIVE (FIX-Task-30) | Not re-litigated; the round's own evidence contradicted it. Re-confirmed this round that the tab-bar badge and the header badges are distinct controls. |
| **4 — Clear-Basket a11y pluralisation** | ✅ **verified (visible surface)** | At **n=1** the basket sub-line reads **"Removes all 1 item from your trade basket."** (singular). The `accessibilityLabel` fix itself was not AX-dumped (see §6 — AX dumps crash the client). |
| **5 — "Tax Free" badge on cart-checkout** | ✅ **VERIFIED** | See O2-C02 — renders on the exempt line of a mixed bundle, on-token, 0.00 % off-brand blue. |
| **7 — SP nudge suppression** | ✅ **VERIFIED** | Trade Initiated now reads **"You still have 458 SP available for your next trade."** (was *"Consider using SP on your next purchase to save more."*) on a trade that used no SP. |
| **Carryover A3 — Admin Dashboard button** | ✅ **CLOSED (on-device leg)** | Not only source-verified: the screen renders and **"Run Mid-Trade Subscription Check"** measures **89.60 % brand green / 0.00 % iOS-system-blue** in its button region (`A3-02`). |

---

## 3. Friction vs. the operating rules (the round's biggest cost driver)

1. **`view_image` DOWNSCALES every frame — and the scale VARIES per frame.** This round it rendered 1080×2400 captures at roughly **74 %–84 %** of true height (measured against OCR ground truth). Eyeballed coordinates missed the Trade Basket CTA (1565 vs true 1887), the seller "Accept Trade" (1507 vs 1719) and the modal "Accept" (1009 vs 1365). **Rule reinforced: derive EVERY tap from `qa:ocr --coords` or the AX tree — never from the displayed picture.**
2. **The mobile-mcp AX-dump path crashed the dev client twice.** `SIGSEGV` in `mobilecli.so` → `art::ti::AgentSpec::Attach` → `VMDebug.attachAgent` (the documented R87/R107 family), plus a separate uiautomator `UiAutomationService already registered!` fatal — **both tooling-side, not app code**. The first cost ~20 calls of recovery (force-stop → cold launch → 28 MB bundle re-download → dev-launcher → pick the *other* Metro row). **The fix that worked: abandon mobile-mcp taps/AX dumps for the rest of the round and drive with `adb shell input tap` / `input text` / `input swipe`**, using `qa:ocr --coords` as the only coordinate source. This also made the "native sheet" B10 leg drivable. **Recommend promoting this to a rule.**
3. **`mobile_click_on_screen_at_coordinates` with bare coordinates silently no-ops** far more often than a ref click (re-confirmed ×2; one produced a false "nothing happened" reading that the DB then contradicted).
4. **`mobile_swipe_on_screen` requires a `direction` argument** — a batch step omitting it **aborts every remaining step in that batch** silently (the batch reported failure at step 9 but steps 10–12 never ran).
5. **iOS `input text` into a native sheet can drop a character** (the Stripe CVC lost its first digit, and the card number its first digit on the first attempt) — verify the field value on-screen and re-enter with CTRL+A + retype rather than assuming.

---

## 4. Findings (ranked)

| # | Sev | Finding |
|---|---|---|
| **F1** | **LOW–MED (admin portal, real usability)** | **The fixed sidebar intercepts pointer events over the main content.** At the default viewport, Playwright could not click **Tax Settings → "Save 1 change"** — `<aside class="fixed top-0 left-0 h-screen … z-30">` intercepted every attempt. Worked only after widening the viewport to 1600 px. A real operator on a narrow window could be unable to save Tax Settings. |
| **F2** | **LOW (copy)** | The Tax Settings "Marketplace Fee Tax Base" description still says the buyer platform fee is **"$0.99 / $2.99"**; the live fee is **$1.49 (member) / $1.99 (subsequent)**. |
| **F3** | **LOW (flake — watch, do not file)** | A **one-off** `Error / "Failed to load trade"` modal appeared from `TradeTimelineScreen.tsx:614`'s catch-all **while the Timeline rendered fully** (status, item, payment card all present) and with **no console error** in the RN log. **Not reproducible on re-entry.** Recorded as a flake to watch, not a confirmed defect. |
| **F4** | **DOC-DRIFT (guide)** | O2-C03's expected `taxable_amount_cents` (3000 → 3149) does not hold: that column reports the **item subtotal** (2800 both times) and never reflects fee inclusion — the fee is visible only in `tax_amount_cents` + the snapshot's `include_fee_in_tax_base`. The guide's cent values (191/200) also assume the **6.35 %** default config rate, while the **live CT rate is 6.99 %**. |
| **F5** | **DOC-DRIFT (guide)** | O2-C02 expects the exempt item to produce a row with `tax_amount_cents = 0` / `is_taxable = false`; the implementation writes **no tax record at all** for a fully-exempt line. |
| **F6** | **Fixture gap (named)** | **No `clothing_footwear` listing exists in node `550e8400-…0001`**, so O2-C02's Item-C (price-threshold) leg is untestable. The case's own residual (the badge) is closed, so this does not block the PASS — but the leg is explicitly not covered. |
| **F7** | **LOW (behaviour note)** | A **bundle** dispute settles **only the disputed line**: resolving Science Kit cancelled that trade while its 2 siblings stayed `in_progress`. Worth confirming this is the intended partial-settlement semantics. |
| **F8** | **LOW (R100-class, reporting trap)** | Cancelled trades keep `trades.payout_status = 'pending'` (the untouched column default). A reader could mistake that for an owed payout; the authority is `seller_payouts`. Documented so a future session does not file a false money defect. |
| **F9** | **LOW (pre-existing)** | Several tracker rows contain a **mojibake status glyph** (`�` instead of 🔴/📄) — cosmetic R56-class drift; it also blocked a scripted edit until the anchor avoided the glyph. |
| **F10** | **LOW (NEW off-brand accent — design system)** | A full-frame `qa:badge-scan` of the **Home** screen (`A3-01`) returns **5,092 px (0.20 %) in the iOS-system-blue family** — well above the AA-noise band (0.01–0.06 %) and the largest off-brand reading of the round. Visually it is the **Action Items card's left rail + icon tint** ("Verify Your Identity" on the admin persona's Home). Note the rail colour is **per-action-kind**: the same card renders **brand green** for the "unfinished listings" action and **blue/info** for ID verification. ⚠️ The scan's token range was deliberately broad, so this confirms the **family**, not `#007AFF` specifically — needs one precise hex read before filing. |
| **F11** | **LOW (scope note)** | The admin portal's primary buttons are Tailwind **`bg-blue-600`** (e.g. Tax Settings' Save). The portal is governed by its own surface conventions rather than `docx/design-system-passitup.md`, so this is recorded as an **observation, not a mobile-design-system deviation**. |

---

## 5. Perceived load times (simulator, wall-clock, ±polling precision — not a formal profile)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Discover → Item Detail | < 1 s | — |
| Basket → Checkout | < 1 s | — |
| Checkout → Stripe PaymentSheet | ~1 s | — |
| Trade Initiated → Trade Timeline | ~2 s (~15 s on first entry, incl. one transient error modal) | — |
| Seller My Trades → Review Offer | < 1 s | — |
| Admin portal page loads | 2–3.5 s | — |
| **Dev-client cold start after the tooling crash** (force-stop → 28 MB bundle over Metro → dev launcher → first render) | **~6–8 min** | ⚠ environment artifact, not app behaviour |

**No genuine screen transition was ≥ 3 s** other than the dev-client cold rebuild.

---

## 6. App / environment state left behind

- Logged in as **test-buyer**; Basket holds **1 item** (`QA Bundle Fixture 1 of 1 (2026-09-14)`, from the B10 fixture) — **not** checked out.
- **Trades created this round (all reclaimable with `npm run qa:reset-offer-fixtures`):**
  - `f07c51c4` bundle — 1 `cancelled` (dispute-refund) + **2 `in_progress`** (Children's Dictionary, Board Game Set).
  - `096fc228`, `cb1cbc39` — pending cash offers to `test-seller`.
  - `50849c0b` — `cancelled` (SP trade; buyer wallet fully restored to 458 / 0 reserved).
- **`test-buyer`'s saved card was CHANGED to VISA •••• 4242** (`pm_1UFNpm4I6kCJlvXop2yMXsky`) — an intentional consequence of B10.
- **Config writes:** `include_fee_in_tax_base` **written true then reverted to false** through the real admin portal UI; re-verified in the DB (category `tax`, `data_type` `boolean` intact — **not clobbered**).
- **No source/test/seed/repo edits**, no stubs registered, no `git` writes.
- 4 `QA Bundle Fixture` listings were created by the sanctioned fixture tool for B10.

---

## 7. Ranking of the residual set by cost to close (for any future session)

1. **R03** — needs an owner approval for one DB write (`rpc_process_expired_offers` on a fast-clocked offer) + a second buyer's live offer on the same listing. **Cheapest remaining.**
2. **O3-C06** — needs an **admin persona added to `qa:ef-repro`** (small dev change) to invoke `resolve-dispute` a second time; layer 3 needs an inducible Stripe duplicate-refund (same accepted class as O2-C10/O3-C04).
3. **O2-C12** — an **owner decision**, not a test.
