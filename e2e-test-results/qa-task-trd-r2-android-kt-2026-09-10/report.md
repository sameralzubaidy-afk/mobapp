# QA Task — TRD Round 2: Groups K–T Android Coverage

**Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (TRD)
**Scope:** Groups K, L, M, N, O, O-1, O-2, O-3, P, Q, R, S, T (+R2/D06 credit-check)
**Platform:** Android `Medium_Phone_API_36.1` (primary, per the milestone gap). iOS spot-checks **not reached** (see Known Gaps — the round pivoted to the blocked-bundle-depth work).
**HEAD:** `92a0dae3` (FIX-Task-15 committed; worktree clean)
**Run folder:** `e2e-test-results/qa-task-trd-r2-android-kt-2026-09-10/`
**Method:** mobile-mcp AX-driven taps + `adb input` gestures/text/evidence, real admin portal (`:3001`, real `samer` session), DB read-backs via MCP SQL, sanctioned EF/fixture scripts (`qa:ef-repro`, `qa:reset-offer-fixtures`, `qa:admin-config-set`).
**Prior state:** every K–T row carried an **iOS-only** PASS from the Milestone-1 pass; this round is the first Android execution of the block.

> ## ⚠️ CORRECTION (2026-09-11) — finding F1 is RETRACTED. The app's bundle checkout is **NOT** broken.
>
> The owner submitted a real 3-item bundle order successfully on **2026-09-11 02:06:54 UTC**. DB proof: 3 `pending` trades created inside the same second (02:06:54.649 / .732 / .762) sharing **`bundle_id = 330427dc-1b1e-4146-b9fc-fa8e1e118457`** (buyer `d84bcc68…`, seller test-seller-3) with exactly **one** `buyer_transaction_fee_cents = 149` on item 0 and **0** on the other two — i.e. the app's batch checkout works end-to-end, including the one-fee-per-bundle rule.
>
> **My failure was QA-induced, not a product defect.** I ran `qa:reset-offer-fixtures` three times mid-session; that tool clears the **server-side** cart (`cart_items`) without informing the running app, so my second attempt submitted from a client whose cart/bundle context had been invalidated underneath it. I then attributed the resulting non-2xx to the product instead of validating under clean conditions — precisely the over-attribution the playbook's environment-first rules (R83 / R87 / R94) exist to prevent. Two facts from that episode remain true and are kept: attempt 1 failed on the per-seller cap (409 `MAX_PENDING_OFFERS`, real fixture residue), and the client **does** discard the EF's structured error body (a genuine low-severity diagnosability gap).
>
> A clean re-test (fresh process + an in-app cart built with **no resets in between**) was started 2026-09-11 07:19–07:21 and could **not** be completed: the Android dev client wedged on `Reloading...` through repeated `force-stop` + Dev-Launcher relaunches (splash, then a permanently empty view tree). Recorded as an **environment block** — it is not evidence either way. Completing that re-test is carried in Known Gaps.
>
> **Net effect on this round's coverage claims:** the bundle-heavy rows (K06, all of L, K04/K05 steps 7–10, T08–T11) are **SKIPPED-for-budget, not blocked**. The 25 PASS / 2 PARTIAL / 2 DOC-DRIFT verdicts in §1 are unaffected.

---

## 1. Verdict roll-up (Android, this round)

| TC-ID | Case | Verdict | Key evidence |
|---|---|---|---|
| **K01** | Subscriber value stack + Sales Tax | ✅ **PASS** | Item Detail Price Breakdown: Item Price $15.00 + Safety & Platform Fee **$1.49** + Sales Tax **$1.05** + Total **$17.54**; Make Offer value stack identical; at 5 SP → `SP discount −5 SP`, Offer amount $10.00, Total cash **$12.54**; tax **unchanged** by SP (BP-37). `screenshots/K01-item-detail-pricebreakdown.png`, `K01-offer-0sp-subscriber.png`, `K01-K03-offer-5sp-subscriber.png` |
| **K02** | Non-subscriber tiered fee | ✅ **PASS** (subsequent tier) | test-free: fee **$2.74** = 5% × $15 + $1.99 ⇒ Total $18.79; savings note "Save $1.25"; `Use SP 🔒` chip; **no SP section** on Make Offer (subscribe-upsell card instead). *First-trade $1.49 tier NOT exercised* |
| **K03** | SP discount row conditional | ✅ **PASS** | Row absent at 0 SP → present at 5 SP (`−5 SP`) → absent again after clearing the field |
| **K04** | Bundle fee **per item** (toggle OFF) | ✅ **PASS** | Toggle OFF (DB-verified `false`) → CartCheckout: **"Safety & Platform Fee (×3 items)" $4.47** (= 3 × $1.49), Subtotal $69.00, Sales Tax $3.22, **Cash Total $76.69**. `K04-checkout-fee-per-item-toggle-OFF.png` |
| **K05** | Bundle fee **once** (toggle ON) | ✅ **PASS** | Toggle ON → **"Safety & Platform Fee" $1.49** (no ×N), **Cash Total $73.71**. Same cart, same session ⇒ live propagation. `K05-checkout-one-fee-toggle-ON.png` |
| **K06** | Bundle timeline fee display matches mode | ⏭️ **SKIPPED** | Not attempted this round (needs a real bundle trade). **The bundle path is functional** — see the CORRECTION at the top of this report |
| **K07/K08** | Admin partial refund (price-only / tax ledger) | ⏭️ **SKIPPED** | Admin-portal `/trades` interventions not reached this session (budget); needs a captured trade |
| **K09** | Payments reconciliation page | ⏭️ **SKIPPED** | Same as K07/K08 |
| **K10** | Server-side one-fee enforcement | 🟡 **PARTIAL** | **Only item 0 carries `buyer_transaction_fee_cents` = 149; items 1–2 = 0** (DB) — the guide's row-1 expectation, produced by the EF for a payload that sent **no** per-item fee ⇒ the server normalization is real. The "stale client sends a per-item fee" variant was not crafted |
| **K11** | Seller fee = rate × **cash portion** | ✅ **PASS** | EF-created offer on a $23 Accept-SP item with 11 SP → `cash_amount_cents` 1200, **`seller_transaction_fee_cents` = 240¢ = 20% × $12** (full-price basis would be 460¢) ⇒ **fee base = cash portion** verified. Buyer fee 149, tax 161 (on full price, SP-invariant). **Guide premise stale:** staging is 10% free / 20% subscriber and test-seller is *trial* ⇒ 20%, not 5% |
| **M01** | First item → active cart | ✅ **PASS** | Cart `5f1b2911` created with 1 item (DB) |
| **M02** | Second item, same seller | ✅ **PASS** | 3 same-seller items in ONE cart (DB: 3 items / $69.00) |
| **M03** | Different seller → choice modal | ⏭️ **SKIPPED** | Not driven (budget) |
| **M05/M06/M07** | Own item / unavailable / duplicate guards | ⏭️ **SKIPPED** | Not driven (budget) |
| **M08/M09** | Remove item / Clear basket | ⏭️ **SKIPPED** | Controls present + labelled in the tree (`cart-item-remove-*`, `clear-basket-button`) but not driven |
| **M10** | Saved carts max 3 | ⏭️ **SKIPPED** | Not driven |
| **M11** | Minimum cart warning + blocked checkout | ✅ **PASS** (via N01) | See N01 |
| **M12** | Max SP shown per cart item (subscriber) | ✅ **PASS** | Per-item "Accepts Points · Up to **11 / 17 / 16** SP" = floor($23 × 50 / 75 / 70%) — exact category-cap math |
| **M13** | Realtime unavailable-while-in-cart | ⏭️ **SKIPPED** | Not driven |
| **M14/M15** | Favorites add/remove, Favorites screen | ⏭️ **SKIPPED** | `cart-favorites-link` present; not driven |
| **M16/M18** | Add-to-cart toast + "Trade Basket" copy | ⏭️ **SKIPPED** | Toast is transient; not captured |
| **M17** | Cart badge increments with toast | ✅ **PASS** | Badge 1 → 2 → 3 across the three adds |
| **M19/M20** | Favorites quick-action tile / Discover heart | ⏭️ **SKIPPED** | Not driven |
| **N01** | Admin min cart value → app | ✅ **PASS** | Admin Cart Settings save → `cart_min_value_cents` **0→3000** (DB, `updated_by` = admin). App (fresh process): `cart-min-value-banner` **"Add $7.00 more to check out"** + **"Minimum checkout is $30.00…"** on a $23 cart; CTA → **"Minimum checkout not met / Add $7.00 more to reach the $30.00 minimum. Your current total is $23.00."** Reverted to 0, DB-verified. `N01-cart-min-value-30-banner.png`, `N01-checkout-blocked-modal.png` |
| **N02** | Admin min cart validation | ✅ **PASS** | Entering −5 + Save → inline **"Minimum cart value cannot be negative"**, **no write** (`Last updated` unchanged; DB `cart_min_value_cents` untouched). Positive save (≥ 0) succeeded — see N01 |
| **N03** | Min Listing Price on Config → Fees | ✅ **PASS** | Fees tab renders the field with the documented description *"Minimum price (in dollars) required for a listing to go live. Set to 0 to disable the floor."*; save 0→5 persisted (DB `min_listing_price = 5`, no deploy), reverted to 0. **Doc-drift:** the label renders **"Min Listing Price"**, guide says "Minimum Listing Price" |
| **N04** | Seller blocked below threshold | ✅ **PASS** | $3 single-item publish → styled modal **"Let's Adjust Your Price"** + body "…must be priced at **$5.00** or more…"; listing NOT created; after raising to $6 → **published successfully** ("Thanks for submitting!") |
| **N05** | Bulk below-threshold flagged | ⏭️ **SKIPPED** | Bulk flow not driven (budget); tracker already PASS (2026-08-31) |
| **N06** | Existing listing auto-paused on raise | 📄 **DOC-DRIFT** | **Behaviour intentionally removed** by DT-86 (2026-09-02, forward-only min price). Empirically re-confirmed: raising 0→5 left the **11 available sub-$5 listings unchanged** (DB `available` 11 → 11) |
| **N07** | Listing repurchasable after raise | 📄 **DOC-DRIFT** | Precondition impossible by design (see N06) |
| **N08** | Regression: checkout at/above threshold | ⏭️ **SKIPPED** | Bundle leg blocked by F1; tracker already PASS |
| **N09** | Price modal copy + button | ✅ **PASS** | Exact title/body with the **dynamic $5.00**; single **"Update Price"** button; **styled in-app modal**, not a native `Alert.alert`. `N04-N09-price-adjustment-modal.png` |
| **N10** | "Update Price" → dismiss + scroll + focus | ✅ **PASS** | Modal dismissed; screen auto-scrolled to `manual-price-input` with **`focused`** in the AX tree |
| **N11** | Price modal in edit-listing flow | ⏭️ **SKIPPED** | Not driven (same modal per source) |
| **N12/N13** | Bulk threshold chip / publish error | ⏭️ **SKIPPED** | Bulk flow not driven; tracker already PASS |
| **N14** | Regression: min-price blocks all flows | 🟡 **PARTIAL** | **Single-item leg verified** (blocked at $3, published at $6). Edit + bulk legs not driven |
| **O-1 C09** | Tax-exempt category configuration | ✅ **PASS** | The Books bundle item maps to `tax_exempt_goods` ⇒ its trade carries `tax_amount_cents` **0** while the two taxable items carry **161** each |
| **O2-C02** | Bundle of taxable + exempt items — line-level tax | ✅ **PASS** | Same evidence as C09: cart tax **$3.22 = 2 × $1.61 + $0** (not 3 × $1.61); Order Summary shows one aggregated Sales Tax row |
| **O01–O08, O-1 (rest), O-2 (rest), O-3, P, Q, R** | — | ⏭️ **SKIPPED** | Not reached this session (budget + fixture preconditions); see Known Gaps |
| **S07** | Bundle CTA at 2+ same-seller items | ✅ **PASS** | `bundle-cta-button` "Make one offer for these 3 items / All items from this seller" on the 3-item basket |
| **S10** | Bundle checkout banner | ✅ **PASS** | `bundle-checkout-banner`: "📦 **Combined Offer** / You're making a single offer for all 3 items from this seller." **Doc-drift:** guide expects a "Bundle Offer" banner |
| **S01–S06, S08/S09, S11–S24** | — | ⏭️ **SKIPPED** | Not driven (see Known Gaps) |
| **T02** | Entered SP applies correct amount | ✅ **PASS** | 5 SP entered on the 16-cap Books item applied exactly 5 |
| **T04** | **Category cap limits points even when the wallet covers more** | ✅ **PASS** | Wallet 474 SP; **20 SP entered on the 50%-cap Toys item → field auto-clamped to 11**; hint "You can use up to 11 SP / Limited by this item's category" |
| **T05** | Clearing SP restores balance for allocation | ✅ **PASS** | Cleared the 11 → "Points remaining" 458 → **469** while the other item's 5 SP stayed applied |
| **T06** | Running "Points remaining" counter | ✅ **PASS** | 474 → **458** (= 474 − 11 − 5) → **469** (= 474 − 5) |
| **T07** | Order Summary "Points Applied" + cash total | ✅ **PASS** | Multi-entry: **"Points Applied −$16.00"** (11 + 5); Cash Total **$57.71** = 69 − 16 + 1.49 + 3.22 |
| **T01** | SP input only on eligible items ("Not eligible") | ⏭️ **SKIPPED** | All three cart items were SP-eligible; the ineligible branch needs a non-SP item in the cart |
| **T03** | "Limited by your SP balance" | ⏭️ **SKIPPED** | Not reproducible: the wallet (474 SP) always exceeded the per-item caps (max 17) ⇒ the wallet-limited branch is unreachable without a low-balance fixture |
| **T08–T14** | Seller Review Offer / ledger / regressions | ⏭️ **SKIPPED** | Not attempted this round (need an accepted bundle trade — see CORRECTION) |
| **D06** | Pickup window drives auto-complete deadline | ♻️ **CREDITED** | **Already Android-PASS on record** (TRD-R1 Android round, 2026-09-08: `pickup_window_hours` 72→48 → `auto_complete_at` +48 h + buyer "48h" banner). Not re-driven (§5.30 evidence reuse) |

**Roll-up: 25 PASS · 2 PARTIAL (K10, N14) · 2 DOC-DRIFT (N06, N07) · 0 BLOCKED (K06 + the T08–T14 rows are reclassified SKIPPED-for-budget after the F1 retraction — see CORRECTION) · ~58 SKIPPED-with-reason.**

### Groups K–T Android coverage (the brief's headline tracker line)

| Group | Android-verified this round / total | Case IDs verified | Still iOS-only-carried-forward |
|---|---|---|---|
| K — Value Stack & Fees | **6 / 11** | K01, K02, K03, K04, K05, K11 (+K10 partial) | K06 (blocked), K07, K08, K09 (admin) |
| L — Bundle Flows | **0 / 11** | — | L01–L11 (all need a bundle trade — blocked by F1) |
| M — Cart (End User) | **4 / 20** | M01, M02, M12, M17 (+M11 via N01) | M03–M10, M13–M16, M18–M20 |
| N — Cart (Admin) | **6 / 14** | N01, N02, N03, N04, N09, N10 (+N14 partial) | N05, N08, N11, N12, N13; **N06/N07 → DOC-DRIFT (obsolete)** |
| O — Tax (End User) | **0 / 8** | — | O01–O08 |
| O-1 — Tax Categories (Admin) | **1 / 17** | O1-C09 | O1-C01–C08, C10–C17 |
| O-2 — Tax Status Lifecycle | **1 / 12** | O2-C02 | O2-C01, C03–C12 |
| O-3 — Tax Refund & Reconciliation | **0 / 14** | — | O3-C01–C14 |
| P — Tax (Admin) | **0 / 8** | — | P01–P08 |
| Q — Reviews & Ratings | **0 / 20** | — | Q01–Q20 |
| R — Refund & Cancellation SM | **0 / 13** | — | R01–R13 |
| S — Seller Group & Bundle Discovery | **2 / 24** | S07, S10 | S01–S06, S08, S09, S11–S24 |
| T — Points Redemption | **5 / 14** | T02, T04, T05, T06, T07 | T01, T03, T08–T14 |
| **Total K–T** | **25 / 186** (+2 partial, +2 doc-drift) | | **~157 rows still carry an iOS-only PASS and need an Android leg** |

---

## 2. Findings (ranked)

### F1 — ❌ **RETRACTED** (2026-09-11) — "Bundle checkout fails end-to-end" was **not** a product defect
**Retraction basis:** the owner's own successful 3-item bundle order (2026-09-11 02:06:54 UTC) created 3 trades in one batch with a real `bundle_id` and exactly one fee — see the CORRECTION block at the top of this report. My failure was caused by my own `qa:reset-offer-fixtures` calls invalidating the running client's cart mid-session, which I then misattributed to the product. **Do not carry F1 forward as a defect.**

The only surviving (LOW) element of this episode is folded into F5 below: the client discards the EF's structured error body.

<details><summary>Original (incorrect) write-up, retained for the audit trail</summary>

- **Symptom:** a real 3-item same-seller cart → CartCheckout → Send Offer → disclaimer accept → **"Checkout Failed / Failed to submit offers for all items"** (`screenshots/F-NEW-bundle-checkout-failed-alert.png`); **0 trades created** (DB). Dev LogBox: `[cartService.checkoutCart] Batch offer failed: FunctionsHttpError: Edge Function returned a non-2xx status code` (`cartService.ts:596`).
- **Discrimination performed (R23/R83):**
  1. Attempt 1's cause **was** the per-seller cap — `qa:ef-repro` → **HTTP 409 `MAX_PENDING_OFFERS`** ("You have 3 pending offers with this seller") from prior-round residue; cleared with `qa:reset-offer-fixtures` (cancelled 3, reset 3 listings).
  2. Attempt 2 failed with the cap **free**. The **same 3 items** via `qa:ef-repro` → **HTTP 200, 3 trades created** ⇒ server healthy ⇒ client-side.
  3. The **app's exact payload shape** (`transaction_fee_cents` per item, `sp_amount`, `buyer_subscription_status`, `submission_nonce`, `bundle_id: null`) replayed → **HTTP 200 again** ⇒ not an item-payload rejection.
  4. `charge_one_fee_per_bundle` value **and** `data_type` verified correct; the EF applied exactly one fee ⇒ not a config/type issue.
  5. Remaining suspects (for dev): the client's non-null `bundle_id`, or a client-side failure surfacing as `FunctionsHttpError`. **`mcp_supabase_query_logs` returned "Backend error! Retry your query"** so the EF's own error line could not be retrieved.
- **Compounding defect (makes it undiagnosable from the UI):** the client **discards the EF's structured error body** — `console.error('[cartService.checkoutCart] Batch offer failed:', resp.error ?? resp.data?.error)` logs only the HTTP-level error and the user sees a generic alert. Wiring the EF's `{code, message}` into the alert is the enabler.
- **Impact:** live bundle purchase is impossible ⇒ the whole L group, K04/K05 steps 7–10, K06 and T08–T11 are untestable downstream. **Highest-priority fix of this round.**

### F2 — 🔴 CRITICAL (still reproducing, already known) — Liability Disclaimer body is verbatim **Amazon** Business Solutions Agreement text
- The pre-purchase disclaimer modal (shown on every offer submit) renders **"Commercial Liability Insurance Requirements … under section 9 of the Amazon Services Business Solutions Agreement … Amazon.com Services LLC and its affiliates and assignees as additional insureds … Amazon Insurance Accelerator …"** (Version 1.0, Effective 4/1/2026). Parents are asked to acknowledge another company's seller-insurance policy. `screenshots/I01-I06-disclaimer-amazon-text-critical.png`. Previously reported 2026-09-08 (Android); **re-confirmed today — still unfixed**.

### F3 — 🟡 MEDIUM (content/doc-drift) — K-group fee/rate guide premises are stale
- K11's precondition ("test-seller **free tier** — deterministic **5%**") does not match staging (`platform_fee_seller_percentage` = **10**; `platform_fee_seller_discount_percentage_kids_club_plus` = **20** used as a flat subscriber *rate*; test-seller is **trial** ⇒ 20%). The **formula** (rate × cash portion) is verified; the guide numbers must be updated or the case re-scoped.
- K01/K02 expect a "Sales Tax **with rate**" row — `TaxBreakdownRow` renders label + amount only (rate/jurisdiction props exist but are never displayed). **Doc-drift or a copy gap; decide which.**
- S10 expects a "Bundle Offer" banner; the shipped copy is **"📦 Combined Offer"**. N03's field label is **"Min Listing Price"** vs the guide's "Minimum Listing Price". K01 expects "Platform fee"; the shipped label is **"Safety & Platform Fee"**.

### F4 — 🟡 MEDIUM (reconciliation) — Tracker row N06 described behaviour that DT-86 removed
The tracker's `TRD-TC-N06 ✅ PASS — "admin auto-pause real" (2026-08-30)` predates DT-86 (2026-09-02, **forward-only min price**, auto-pause deleted). Re-verified empirically today: raising 0→5 left all 11 available sub-$5 listings unchanged. N06/N07 are now 📄 DOC-DRIFT in the tracker and the guide's expectation is obsolete.

### F5 — 🟢 LOW (dev hygiene) — `console.error` on a normal error path raises a red LogBox that blocks the UI
`cartService.ts:596` fires on every bundle failure ⇒ a full-screen dev overlay; during this run it **swallowed taps** (an Add-to-cart tap and a Basket-tab tap were consumed), costing ~10 calls. FIX-2 class. Also revealed: the overlay is re-shown as a **stale replay** after navigation, and it is dismisseable via its AX-exposed `Dismiss` row.

### F6 — 🟢 LOW (data hygiene) — `charge_one_fee_per_bundle` has `data_type = 'string'` while every sibling feature flag is `'boolean'`
The admin portal declares it `boolean`; the row was `string` when first read. I restored it to `boolean` after my writes (see §4). **Flagged because I cannot prove it was `string` before my write** — one dev sanity check is warranted.

---

## 3. Design-system & copy compliance (§6.4 — per screen/dialog visited)

| Surface | Verdict |
|---|---|
| Item Detail (Price Breakdown, SP card, Seller Info) | CONFIRMED — canonical card/typography; tax row label + amount aligned. Minor: no tax **rate** shown (F3) |
| Make Offer (value stack, SP input, payment card, disclaimer strip) | CONFIRMED — primary green `#5DBB8E` CTAs, section labels, "Max: 11 SP (75% of price)" hint |
| Trade Basket (min-value banner, item rows, bundle CTA, more-from-seller banner) | CONFIRMED — SP gold chips on "Accepts Points", trash/clear affordances ≥44 px |
| CartCheckout (Combined Offer banner, Points remaining, Order Summary, payment method) | CONFIRMED — summary rows aligned, counts bold, single primary CTA ("Send Offer · $73.71") |
| "Minimum checkout not met" modal (N01) | CONFIRMED — title + body + one primary ("Browse More Items") + Cancel; no system colors |
| "Let's Adjust Your Price" modal (N04/N09) | CONFIRMED — single primary "Update Price", in-app styled (not a native alert) |
| Liability Disclaimer modal | **DEVIATION (content, CRITICAL)** — third-party (Amazon) legal text; see F2. Layout/typography themselves are fine |
| "Checkout Failed" alert + LogBox error overlay | **DEVIATION** — generic user copy hiding an actionable backend reason (F1); dev LogBox is a red OS-styled overlay (F5) |
| ItemCreate / New Item + submit confirmation | CONFIRMED — dev fixtures are clearly `__DEV__`-labelled; success screen uses the standard "Go To My Items / Dashboard" pattern |

**App-wide off-brand-hex grep (R62b):** not run this round (desk-only step) — carried as owed.

---

## 4. Admin-config writes (all reverted, DB-verified)

| Key | Path | Values | Reverted? |
|---|---|---|---|
| `charge_one_fee_per_bundle` | `qa:admin-config-set` | `true → false → true`, then re-written with **`data_type=boolean`** (was `string`) | ✅ value `true` restored (22:17:10Z); `data_type` normalised |
| `cart_min_value_cents` | admin portal `/settings/cart` (real save) + helper revert | `0 → 3000 → 0` | ✅ `0` (22:22:39Z) |
| `min_listing_price` | admin portal `/config` → FEES tab (real save) + helper revert | `0 → 5 → 0` | ✅ `0` (22:25:48Z) |
| `cart_max_saved_carts` / `cart_saved_expiry_days` | Same page save (unchanged values 3 / 7) | `3→3`, `7→7` | ✅ semantically unchanged (timestamps only) |

No `qa-dev-toggle` arming was used. No categories, listings or settings were deleted.

---

## 5. Perceived load time (§5.7) — *simulator/emulator wall-clock, ±polling precision; not a formal performance profile*

| Screen → transition | Elapsed | Note |
|---|---|---|
| Item Detail → rendered (deep link) | ~1–2 s | one poll |
| Item Detail → Make Offer (Request to Buy) | < 1 s | immediate |
| Make Offer: saved-card resolution ("Checking saved cards…" → "Paying with MASTERCARD") | ~1–2 s | one extra poll; skeleton copy shown (good feedback) |
| Cart → CartCheckout (bundle CTA) | < 1 s | immediate |
| CartCheckout → Order Summary after SP entry | < 1 s | live recompute |
| ItemCreate dev-fixture taps (photo/category/fill) | < 1 s each | immediate |
| Submit for Review → price modal | < 1 s | immediate |
| Submit for Review → success screen | ~1–2 s | one poll |
| **Cold dev-client start (after force-stop) → usable UI** | **~8–12 s** | **environment artifact** (Metro bundle load on a dev build), not app behaviour |

**No app-side transition ≥ 3 s was observed.**

---

## 6. App state left behind

- **Config:** all three touched keys reverted (DB-verified) — see §4.
- **Offers/cart:** `qa:reset-offer-fixtures --persona test-buyer` run 3× during the round; final state **0 pending offers, empty cart**; the 3 EF-created diagnostic trades (469c1854, 951945e0, b50d9948, 3265ec84, 44e02ec7…) were all cancelled by those resets.
- **New residue:** **1 pending listing** "QA Dev Fixture Item" **$6** under **test-seller** (created by the N04 publish leg, with 2 dev photos) — low-impact, but a cleanup candidate. It joins the existing population of QA dev-fixture listings on staging.
- **App session:** logged **out** (Landing) on Android at session end.
- **Admin portal:** left logged in at `/config` (FEES tab) on an **active** browser page.
- **No** notifications, wallets, subscriptions or ledger rows were mutated beyond the cancelled test offers.

---

## 7. Known gaps / not tested (explicit, per R13/R40)

**Not attempted this round (previously believed blocked by F1 — now corrected):** K06; all of **L01–L11**; K04/K05 steps 7–10 (timeline bundle totals); T08–T11; N08. The bundle checkout path is functional (see CORRECTION), so these are **budget gaps, not blockers**.
**Not driven — budget:** N05, N08, N11, N12, N13 (bulk/edit flows); M03, M05–M10, M13–M16, M18–M20; S01–S06, S08/S09, S11–S24; T01 (needs a non-SP cart item), T03 (needs a low-SP-balance fixture), T12/T13/T14.
**Not reached — whole groups:** O (8), O-1 (16 of 17), O-2 (11 of 12), O-3 (14), P (8), Q (20), R (13). These need captured/aged trades, admin-portal tax pages, completed-trade review fixtures, or the refund state machine — none of which fit this session's remaining budget.
**iOS spot-checks:** **not performed.** Per the brief they were secondary ("spot-checks only where behaviour plausibly changed since the last iOS pass"); the session was consumed by the priority sub-scope plus the F1 root-cause work. No iOS verdict is claimed for anything in this report.
**K02 first-trade tier:** not exercised (requires the on-demand `qa-first-trade` persona, which does not currently exist on staging).
**R62b off-brand-hex grep / R62c frame scan:** not run (desk step) — carried as owed.
**D06:** credited from the 2026-09-08 Android round, deliberately not re-driven.

---

## 8. What needs to be fixed next (dev-side, ranked)

1. **Surface the EF's structured error in `checkoutCart` (LOW, diagnosability)** — replace the generic "Failed to submit offers for all items" alert with the EF's `{code,message}` where one exists. This is the only surviving item from the retracted F1: it cost ~12 calls of inference this round and would have produced the per-seller-cap reason immediately. (The bundle checkout itself is **not** broken — see CORRECTION.)
2. **Replace the Liability Disclaimer body (F2)** — remove the verbatim Amazon insurance text and write Pass-It-Up parent-facing copy.
3. **Demote `console.error` to `console.warn` on the normal batch-failure path (F5)** so a handled error cannot raise a full-screen dev overlay that swallows taps.
4. **Update the K-group guide numbers (F3)** — seller-fee rate/tier premise, the "with rate" tax-row expectation, "Bundle Offer" → "Combined Offer", "Minimum Listing Price" → "Min Listing Price", "Platform fee" → "Safety & Platform Fee".
5. **Sanity-check `charge_one_fee_per_bundle.data_type` (F6)** — should be `boolean` (portal intent); I normalised it back but cannot prove the original value.
6. **Decide the tax-row rate display** (`TaxBreakdownRow` receives `taxRate`/`jurisdiction` but renders neither) — show the rate or drop the props.

---

## 9. UX enhancement ideas (optional, not defects)

- On the **Trade Basket**, the min-value banner already deep-links to "Browse 22 More Items" — consider sorting that filtered list by *price descending* so the buyer can most quickly clear a $7 shortfall.
- In the **bundle checkout**, the per-item SP inputs each say "Limited by this item's category" — consider surfacing the *remaining* per-item cap after entry (e.g. "11 of 16 SP used") so sequential allocation needs no mental arithmetic.
- On **Item Detail**, the SP-eligible card tells subscribers they *can* use points but not *how many* — a "you can use up to N SP here" line would set expectations before the offer screen.

---

## 10. Suggested next session

**Close the bundle gap first:** a focused round that (a) verifies the F1 fix end-to-end on the real 3-item bundle, then (b) harvests K06 + all of L + T08–T11 from that single completed bundle trade (R82 one-flow-many-verdicts), and (c) picks up M08/M09/M10 + S01–S09 from the same cart/session. That converts ~35 Android-only-carried rows into genuine Android verdicts for the cost of one working bundle flow.

---

## 📋 QA Session Handoff

**Test Scope:** TRD Round 2 — Groups K, L, M, N, T (+O2-C02/O1-C09 tax-tree evidence) on Android; D06 credited from the 2026-09-08 Android round. 25 PASS / 2 PARTIAL / 2 DOC-DRIFT / 0 BLOCKED (post-retraction) / ~58 SKIPPED-with-reason. iOS not executed this round.

**Design-System Compliance:** **PARTIAL** — 7 of 9 visited surfaces conform (Item Detail, Make Offer, Trade Basket, CartCheckout, min-value modal, price-adjustment modal, ItemCreate/success). Two deviations: (1) the Liability Disclaimer modal's **content** is verbatim Amazon insurance text (CRITICAL, §6.3/§6.4); (2) the "Checkout Failed" alert shows generic copy while a specific backend reason exists, plus a red dev LogBox overlay. App-wide off-brand-hex grep (R62b) not run this round — owed.

**Perceived Load-Time Verdict:** **GOOD** — no app-side transition ≥ 3 s; all screen/state transitions rendered within 1–2 polls. One flagged item is an **environment artifact**, not app behaviour: the cold dev-client start after a deliberate force-stop took ~8–12 s to bundle (Metro/dev build), which is expected on a dev client.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — Item Detail: Price Breakdown card, SP-eligible card, Seller Info card; canonical tokens and alignment.
- CONFIRMED — Make Offer: value stack (Offer amount / Safety & Platform Fee / Sales Tax / Total cash), SP input + hint, saved-card selector.
- CONFIRMED — Trade Basket: min-value banner, item rows with SP caps, `bundle-cta-button`, more-from-seller banner + dismiss.
- CONFIRMED — CartCheckout: "📦 Combined Offer" banner, "Points remaining", Order Summary rows, payment-method section, single primary CTA.
- CONFIRMED — "Minimum checkout not met" modal: one primary + Cancel, correct math copy.
- CONFIRMED — "Let's Adjust Your Price" modal: exact dynamic copy, single primary "Update Price", styled in-app.
- CONFIRMED — ItemCreate + "Thanks for submitting!" screen.
- DEVIATION — Liability Disclaimer modal: body is verbatim **Amazon Services Business Solutions Agreement** commercial-insurance text (CRITICAL content defect; layout itself is fine).
- DEVIATION — "Checkout Failed" alert: generic "Failed to submit offers for all items" hides the actionable EF reason (`MAX_PENDING_OFFERS`-class codes are never surfaced).
- DEVIATION — dev LogBox overlay (red, OS-styled) raised by `console.error` on a handled failure path; it blocked UI interaction twice.
- DEVIATION (copy/doc-drift, guide-side) — "Combined Offer" vs "Bundle Offer"; "Min Listing Price" vs "Minimum Listing Price"; "Safety & Platform Fee" vs "Platform fee"; tax row shows no rate.

**Verdict Summary:** **25 PASS / 0 FAIL / 2 PARTIAL / 0 BLOCKED / 2 DOC-DRIFT / ~58 SKIPPED (with reason)**

**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — TRD section: **N06 ✅ PASS → 📄 DOC-DRIFT** ("Existing listing auto-paused…" — behaviour removed by DT-86, re-verified empirically) and **N07 🔴 STILL OPEN → 📄 DOC-DRIFT** (obsolete precondition). Both count surfaces updated atomically and verified byte-identical: §1 roll-up TRD row **and** the TRD section header now read **288 · 236 PASS · 27 PARTIAL · 1 OPEN · 5 DOC-DRIFT · 2 SKIPPED · 17 Remaining** (the older FIX-Task-13 baseline note is superseded by a dated baseline-update line). A dated **2026-09-10 TRD Round 2** round note was appended listing every Android verdict, the per-group K–T coverage table, and the F1 bundle finding **as originally reported — superseded by a dated 2026-09-11 RETRACTION correction appended to the same note** (the finding was a QA-induced false positive; the bundle legs are SKIPPED-for-budget, not blocked). All other touched rows (K01–K05, K10, K11, M01/M02/M12/M17, N01–N04/N09/N10/N14, S07/S10, T02/T04–T07, O2-C02, O-1 C09) keep their existing PASS status — **no flips** — so their `.md` row entries were not individually rewritten; their Android verdicts are recorded in the round note and this report (the convention used by the 2026-09-08/09 Android rounds).

**Critical Findings:**
0. **RETRACTED —** the original #1 ("bundle checkout is broken end-to-end in the app") is **withdrawn**: the owner's successful 3-item bundle order of 2026-09-11 02:06:54 UTC (3 trades, real `bundle_id`, one 149¢ fee) disproves it, and my own `qa:reset-offer-fixtures` runs had cleared the server-side cart under the running client. See the CORRECTION at the top of this report. **This round's top finding is now the CRITICAL disclaimer-content defect below.**
2. **CRITICAL (known, still reproducing) — the purchase disclaimer shows verbatim Amazon seller-insurance legal text** to parents.
3. **MEDIUM — stale guide premises in Group K** (seller-fee 5%/free-tier; "with rate" tax row; three copy mismatches).
4. **MEDIUM — tracker/reality drift on N06/N07** after DT-86 (now corrected).
5. **LOW — dev LogBox raised by `console.error` on a normal path** (swallowed two taps this run); `charge_one_fee_per_bundle.data_type` inconsistency.

**App State Left Behind:** All three admin-config keys reverted and DB-verified (`charge_one_fee_per_bundle` true/boolean, `cart_min_value_cents` 0, `min_listing_price` 0). test-buyer: 0 pending offers, empty cart (reset 3×). 5 diagnostic trades created during the F1 investigation — all cancelled by those resets. New residue: **1 pending "$6 QA Dev Fixture Item" listing under test-seller** (N04 publish leg, 2 dev photos) — cleanup candidate. **Not QA residue:** the owner's own 3 `pending` trades from their 2026-09-11 bundle order (`bundle_id` `330427dc-…`) are untouched and must not be cancelled by cleanup. Mobile app logged **out**; admin portal left logged in on an active `/config` page (FEES tab).

**Why It Matters:** This round converts the first 25 rows of the largest remaining iOS-only backlog (K–T, 186 cases) into genuine Android verdicts, and it proves the admin-config → app propagation chain end-to-end for cart minimum ($30 enforcement with exact math), min listing price ($5 block + publish-at-$6), and the bundle-fee toggle ($4.47 per-item ↔ $1.49 single, same cart/session). It also surfaces a **CRITICAL legal-content defect** still shipping after a week. **The round's original "live purchase-path defect" claim was wrong and is retracted** (see CORRECTION) — the bundle path is functional, as the owner's own successful 3-item order demonstrates.

**How to Verify/Reproduce:**
- **F1 (retracted — do NOT chase):** the original repro was 3 same-seller items → Basket → "Make one offer for these 3 items" → Send Offer → accept disclaimer → "Checkout Failed". **That failure was self-inflicted**: `qa:reset-offer-fixtures` had cleared `cart_items` under the running client. The correct control is to build the cart **in a clean client with no fixture resets in between**; the owner's own 3-item order (2026-09-11 02:06:54 UTC, 3 trades, one `bundle_id`, one 149¢ fee) already demonstrates the path works. Two genuine low-severity spin-offs remain testable: the generic "Checkout Failed" copy (a `MAX_PENDING_OFFERS`-class reason is never surfaced) and the red LogBox on that handled path.
- **F2:** any offer/bundle submit → disclaimer modal body. Evidence: `screenshots/I01-I06-disclaimer-amazon-text-critical.png`.
- **N01:** admin `/settings/cart` save 30.00 → app cart of $23 → banner + blocked CTA. Evidence: `N01-cart-min-value-30-banner.png`, `N01-checkout-blocked-modal.png`.
- **N04/N09/N10:** test-seller → New Item → dev fixtures → price 3 → Submit. Evidence: `N04-N09-price-adjustment-modal.png`.
- **N06:** `SELECT status, count(*) FROM items WHERE price < 5 GROUP BY status` → raise `min_listing_price` to 5 → re-run (unchanged: 11 available).
- All other screenshots in `e2e-test-results/qa-task-trd-r2-android-kt-2026-09-10/screenshots/` (12 files).

**Known Gaps / Not Tested:** The bundle DOWNSTREAM rows (K06, all of L, K04/K05 steps 7–10, T08–T11, N08) were **not attempted** (budget) — the bundle path is functional, see CORRECTION; groups O, O-1 (16/17), O-2 (11/12), O-3, P, Q, R entirely; M03/M05–M10/M13–M16/M18–M20; S01–S06/S08/S09/S11–S24; N05/N08/N11/N12/N13; T01 (needs a non-SP cart item), T03 (needs a low-SP wallet fixture), T12–T14; K02's first-trade tier (no `qa-first-trade` persona on staging); **all iOS spot-checks** (not executed — no iOS verdict is claimed); the clean bundle-checkout re-test (blocked by a wedged dev client 2026-09-11 07:19–07:21); R62b off-brand-hex grep.

**What Needs To Be Fixed Next:** (1) Replace the Amazon disclaimer text with Pass-It-Up copy — **now the top item**, since the previously-ranked #1 (bundle checkout) was retracted; (2) surface the EF's structured error in `checkoutCart`; (3) demote `console.error` → `console.warn` on the handled batch-failure path; (4) update the K-group guide numbers/copy (seller-fee tier, tax-row rate, "Combined Offer", "Min Listing Price", "Safety & Platform Fee"); (5) sanity-check `charge_one_fee_per_bundle.data_type` (should be `boolean`); (6) decide whether `TaxBreakdownRow` should display the tax rate or drop the unused props.

**UX Enhancement Ideas (optional, not defects):** (1) On the Trade Basket min-value banner's "Browse 22 More Items", consider sorting that filtered list by price descending so a shortfall is cleared fastest. (2) On bundle checkout, consider showing the remaining per-item SP headroom after entry ("11 of 16 SP used") so sequential allocation needs no mental arithmetic. (3) On Item Detail's SP card, consider stating the concrete per-item cap ("you can use up to N SP here") instead of only "You can use your Swap Points…".

**Suggested Next Session:** Drive a real 3-item bundle (the path works — the owner's own order proves it), then harvest K06 + all of L + T08–T11 from that single completed bundle trade, plus M08/M09/M10 and S01–S09 from the same cart session — converting ~35 more K–T rows to Android in one flow. Start with the owed clean reproduction of the checkout leg (fresh client, cart built in-app, **no `qa:reset-offer-fixtures` after the cart exists**) so the retraction is closed with a positive in-app verdict rather than only the owner's DB evidence.

**Suggested to Improve Agent Rules:** Add a **self-inflicted-state rule** (the hard lesson this round): **a QA fixture/tool that mutates shared state the running client caches — `qa:reset-offer-fixtures` clears `cart_items` server-side without telling the app — invalidates the client, so do NOT attribute the next client failure to the product until the flow has been reproduced from a clean client AND a clean cart with no resets in between.** This generalises R92 ("relaunch after external state writes") into "**never file a client defect in the same session in which you cleared the client's server-side fixture**" — the alternative is exactly the false HIGH finding this round produced (F1, retracted). Companions that did earn their keep: **replay the client's exact payload through the sanctioned EF harness before writing any client-side finding** (R83 extension — it cleared the payload, the cap and the config, leaving only the untested variable), **run `qa:reset-offer-fixtures` BEFORE building the cart, never mid-flow**, and note that **`mcp_supabase_query_logs` can return "Backend error!"** so EF-log diagnosis needs a documented fallback.
