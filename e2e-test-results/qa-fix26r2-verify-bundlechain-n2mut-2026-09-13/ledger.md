# Ledger — QA: FIX-Task-26 (round 2) verify + bundle-offer chain + N2 mutation legs + remainder

Device: Android `Medium_Phone_API_36.1` (emulator-5554) · iOS `iPhone 17 Pro Max` booted but NOT driven (R80)
Backend: staging `drntwgporzabmxdqykrp` (read-only SQL) · HEAD `a6ce831a` · Evidence: `screenshots/` (32)
Prior round: `e2e-test-results/qa-post-phase0-verify-n2-n-2026-09-13/` (HEAD `e94b8ab4`)

## Method / hygiene
- R78-1 recon-first: read the prior round's `report.md` + `ledger.md` **before** any device call — that showed Phase A/B were already partly driven, so this round targeted the **round-2 delta** (`e94b8ab4` → `a6ce831a`).
- R29 busy check ran before touching the device (two Metros `:8081`+`:8082`; **neither killed** per the standing rule).
- R79-1 honoured **without** a cold reload: the F1 copy fix is unreachable pre-`a6ce831a`, so driving it doubles as the fresh-bundle discriminator.
- R95: no AX read/screenshot taken *inside* an action batch (the one exception is labelled `-pre-…` where it holds pre-action state).
- §5.19 Android IME rule honoured by **screenshot** before every BACK press (the IME was proven visible in `06-…`/`09-…` before BACK was fired).
- R24: every money/state DB read-back was issued as its **own statement**, never in the same batch as the mutation.

## Execution log (chronological, condensed)

| # | Action | Result |
|---|---|---|
| 1 | Recon: prior round report + ledger + repo memory | Prior round closed F1-A + F10, X11 PASS, N2 partial at `e94b8ab4` |
| 2 | R29 busy check (`pgrep`/`lsof`/`adb`) | Two Metros (8081, 8082) + admin `:3001` + `emulator-5554`; no competing driver |
| 3 | Phase 0 DB probe (`select now()`) | ✅ `16:49:15Z`, sub-second |
| 4 | Boot check (foreground app + screenshot `00-…`) | ✅ Client **live** on the Trade Basket — NOT wedged (prior session's end-state had cleared) |
| 5 | `qa-logout` deep link → Landing (`01-…`) | ✅ logged out |
| 6 | Tap `landing-login-button` → Login | ✅ (<1 s) |
| 7 | Tap email field → type `test-buyer@…` → screenshot `02-…` | ✅ email correct; IME visible (proven by screenshot) |
| 8 | Tap (540,1056) intending the password field → type wrong password | ❌ **landed in the EMAIL field** — visual y-estimate was wrong; tree says email = y 1012–1120 |
| 9 | BACK (IME proven up) → screenshot `04-…` → `sips` scale check | ✅ IME dismissed; screenshot is 1080×2400 = **1:1 with AX coords** |
| 10 | `adb input keycombination 113 29` + `adb input text '<email>'` → screenshot `05-…` | ✅ corrupted email replaced cleanly (R77 #4 technique) |
| 11 | Tap password field at **tree** coord (493,1350) → re-list (focused ✅) → type wrong password | ✅ field focused correctly |
| 12 | BACK → screenshot `07-…` → tap `login-submit-button` → screenshot `08-…` | ✅ **Phase A item 1 PASS** — "Login Failed" / "Invalid email or password." / OK, **no leaked identifier**. Also the **fresh-bundle discriminator** |
| 13 | Dialog-type check (§5.4) | ✅ AX-instrumentable `login-failed-dialog-ok-button` (not a native-modal pixel-scan case) |
| 14 | OK → tap password field → CTRL+A + correct password via adb → BACK → submit → `10-…` | ✅ Home as test-buyer, 459 SP |
| 15 | Tap `action-tile-myListings` → `11-…` | ✅ **Phase A item 3 PASS** — pill reads "My Trades" |
| 16 | DB baseline: test-buyer active `cart_items` | 1 row (`2febc5a8`, $15.00, cart `302e6ff6`) |
| 17 | `qa:create-bundle-fixture --count 3` (attempt 1) | ⚠️ created 3 items but **`CART_ACTIVE_LIMIT`** — buyer already had an active cart (→ finding F6) |
| 18 | Basket → `12-…` (pre-state) → tap `cart-item-remove-…` → confirm dialog (`global-alert-button-1`) → DB read-back (own statement) | ✅ **1 → 0 persisted on the FIRST attempt** |
| 19 | `13-…` (post-state) + tree | ✅ **Phase A item 2 PASS** — item gone, badge removed, empty state, **no error card** |
| 20 | `qa:create-bundle-fixture --count 3` (attempt 2, cart now empty) | ✅ cart `55ede89f`, bundle `5b3e9cc3`, 3 items |
| 21 | `qa-refresh` deep link → tree | ✅ cart badge "3"; `bundle-cta-button` present |
| 22 | Tap cart item → Item Detail (`14-…`) + tree | ⚠️ no seller block in the first viewport |
| 23 | DB: `items.seller_id` + `profiles` row; source grep of the render branches | Seller **exists** (`14be337c`, profile row = 1) |
| 24 | `adb logcat` grep for `[listing]` | ✅ `seller_id` present in the fetched item; **0** "Seller fetch" errors |
| 25 | Swipe ×2 → `15-…`, `16-…` + tree | ✅ **Seller Info block FOUND below the fold** — **prior round's finding RETRACTED** |
| 26 | B(c) check in the tree | ✅ `contact-seller-button` + `view-seller-profile-button` both present, both **`disabled`** (correct) |
| 27 | Tap `bundle-cta-button` → Checkout (`17-…`) | ✅ cold-open; item list first frame |
| 28 | Swipe → `18-…` + tree | ✅ ORDER SUMMARY resolved: $63.00 + $1.49 + $2.94 = **$67.43**; `send-offer-button` enabled, label "Send Offer · $67.43" |
| 29 | DB: per-item tax categories | ✅ mixed cart — **Books tax-exempt**, Sports/Toys taxable ⇒ 2 × $21 × 6.99% = **$2.94** exact |
| 30 | Source grep `CartCheckoutScreen` (`moneyReady`/`chargeOneFeePerBundle`/`'—'`/`disabled`) | ✅ F4 gating real in source (old `false` default = the $0.99 first-paint bug) |
| 31 | Send Offer → disclaimer gate → tick `disclaimer-modal-checkbox` (accept button un-disabled ✅) → Accept & Continue | ✅ gate gating verified in both states |
| 32 | `19-…` "Processing…" → `20-…` **"Trade Initiated!"** | ✅ 3 trades created |
| 33 | DB: the 3 trades | ✅ all `pending`, same `bundle_id` = **cart id**; tax 147+147+0 = **294**; **one** 149 fee; PIs distinct; `disclaimer_acknowledged` on **1 of 3** (→ F4 observation) |
| 34 | `qa-login-as?persona=test-seller` (attempt 1) → logcat | ❌ **"Login-as test-seller failed: User profile not found"** while the profile row is intact (→ finding F3) |
| 35 | Tap Trades → **buyer's** My Trades (`24-…`) | ✅ **F9 buyer PASS** (tiles 3/0/0/36; one bundle-of-3 card); **UX2 N/A** for buyer (0 needs-action) |
| 36 | DB buyer counts | ✅ pending 3, in_progress 0; completed **41** vs tile **36** → reconciled (`buyer_marked` 32 + `auto_completed` 4 = 36) |
| 37 | Tap "View Details" → Trade Timeline (`25-…`) | ✅ buyer detail = **Timeline**, so **F7 is seller-side** |
| 38 | DB: `auth.users` ⇄ `profiles` for the personas | ✅ test-seller's link is **perfect** ⇒ F3 is app-side, not data |
| 39 | `qa-login-as` retry (attempt 2) → `26-…` | ⚠️ screen wedged on **"Loading trade…"** |
| 40 | logcat grep | 🔴 **`Gateway Timeout`** signature on chat-count queries (R102) |
| 41 | **Pivot per R102** to session-independent work → read `create-trade-offer` source for the N2 idempotency mechanism | `submission_nonce` → `piKey`; deterministic dedupe |
| 42 | `qa:ef-repro --ef create-trade-offer` (call 1, no `cash_amount_cents`) | HTTP 400 `INVALID_AMOUNT` — EF leg **healthy**, structured error |
| 43 | `qa:ef-repro` (call 1, fixed `submission_nonce`) | ✅ HTTP 200, `trade_id 1f3ec04d` |
| 44 | `qa:ef-repro` (call 2, **byte-identical**) | ✅ HTTP **409 `DUPLICATE_OFFER`** |
| 45 | DB read-back (own statement) | ✅ **1** trade / **1** distinct PI / **1** audit row per key (`offer_`, `pi_`, `tax_quoted_`) ⇒ **N2-C01 PASS live** |
| 46 | `force-stop` → cold launch → Dev Launcher (`27-…`) | ✅ launched |
| 47 | Tap `10.0.2.2:8082` row → `28-…`, `29-…` "Loading from …8082…" → `ps` on the 8082 Metro | ❌ **wedge**: client waits indefinitely while Metro is **idle (0.1 % CPU)** (reproduced prior session's blocker) |
| 48 | `force-stop` → cold launch → tap **`10.0.2.2:8081`** → `32-…` + tree | ✅ **RECOVERED** — Home loaded; header **"TS"**, 2256 SP ⇒ session is now **test-seller** (the persona switch eventually took) |
| 49 | Tap Trades → `33-…` | ✅ **UX2 PASS** ("4 offers to review"); **F9 seller PASS** (tiles 4 = 1 + 3); **F8 3-item banner** "Bundle Offer · 3 items" |
| 50 | Tree (text format) → grep for the bundle controls | `trade-bundle-…-review-each` etc. located (my earlier visual estimate was ~340 px off) |
| 51 | Tap `…-review-each` → `35-…` | ✅ **F8 3-item PASS** (banner "3 items" ⇄ `accept-bundle-button` "Accept all 3 items"); **F7 baseline** = live "47h 51m left", no expired copy |
| 52 | Tap `accept-trade-button` → confirm dialog → `accept-trade-confirm-button` | ✅ accepted ONE sibling |
| 53 | DB: bundle trades | ✅ only `c9799204` → `in_progress`; other two still `pending` |
| 54 | `36-…` (post-accept) | ✅ **F7 PASS** — "You accepted this offer — the trade is now in progress." (status-aware, NOT "expired"); **F8 2-item PASS** — banner "Bundle offer · 2 items" + "1 already accepted" ⇄ "Accept the other 2 items"; **UX1 PASS** |
| 55 | Dismiss `offer-accepted-ok-button` → tree | ✅ navigated to **My Listings** (documented by-design) |
| 56 | Tap Trades → tree | 🔴 **LogBox overlay** `[listing] getListingSummary error: Gateway Timeout` (R102 signature #3) |
| 57 | Dismiss LogBox → **device work stopped** (budget + recurring degradation) | — |
| 58 | Tracker (R52): update the `TRD-TC-N2` Remaining-row note with the live C01 result | ✅ edited; **no row flips** (the N2 aggregate is not fully verified) |
| 59 | Wrote `report.md` + `ledger.md` | ✅ |

## Friction (for the next instrumentation pass)
1. **Two taps lost to visual coordinate estimates** (wrong-password → email field; "Review Each" ~340 px off). The tree was correct both times; the layout did **not** shift for the IME on this build. → always tap from a fresh **tree**.
2. **`qa:ax-tree` did not parse the chat-session-resource capture** (0 matches / 21 elements), and the capture's key shape depends on the list format (`format=json` vs text). A JSON-key grep against a **text** capture returns nothing and reads as "element absent" (3 calls).
3. **`qa:create-bundle-fixture` needs an empty cart** and orphans its created `items` rows on failure.
4. **`qa-login-as` failure mode** ("User profile not found") + the subsequent warm-switch wedge cost a cold start.
5. **Bundle-load wedge** on `:8082` with the Metro idle; recovered by switching to the `:8081` dev-server row.
6. **`Gateway Timeout` degradation** (3 sightings) — SQL unaffected; EF unaffected; one screen (Trade Timeline) wedged. Handled per R102 (bounded, pivoted, BLOCKED-class not FAIL).

## Residue / state left behind
- **Session logged in as `test-seller`** (Home). Trades badge 4, Basket badge 4 (test-seller's known stale 2026-08-29 `cart_items` — R100: real count, not a leak).
- **Bundle `55ede89f` / `5b3e9cc3`**: 1 sibling `in_progress` (`c9799204`), 2 `pending` (`22875742`, `0a86f094`). Auto-complete windows run ~48 h.
- **N2-C01 disposable fixture:** trade `1f3ec04d` `pending` on listing `344d3761` (offer expires 2026-09-15).
- **Buyer's cart consumed** by the checkout (its `cart_items` left `active`).
- **Orphan `items`** from the failed fixture attempts: `344d3761`/`87a8db74`/`3897a2f4` ($27) and `3 × $21` listings — all `available` under test-seller; reusable or prunable.
- **No config/admin writes. No stubs registered. No code or test files touched.**
- Metros `:8081` + `:8082` left running (neither killed); admin portal `:3001` untouched.
