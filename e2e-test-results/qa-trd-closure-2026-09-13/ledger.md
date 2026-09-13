# Ledger — TRD FINAL CLOSURE round (2026-09-13)

Compact action → outcome log. Platform: Android `Medium_Phone_API_36.1`. iOS booted, not driven (R80).

## Phase 0 — recon & hygiene
| # | Action | Outcome |
|---|---|---|
| 1 | Read playbook §4–§9 + persona registry + schema cheat-sheet | Done before any device call (R78-1). |
| 2 | Mechanically parse `QA-TESTCASE-STATUS-2026-09-03.md` (TC-ID + Status columns) | **Non-final scope = 28 PARTIAL + 16 Remaining (all owner-excluded).** Dispatch's reconstructed list **stale for 23 of 24 IDs.** |
| 3 | R29 busy check (`ps` for maestro/playwright/run-suite) + `xcrun simctl list devices booted` | Only the admin Playwright *test-server* resident (idle infra, not a run). Metro 8081+8082 up. No in-flight agent driving the emulator ⇒ not busy. |
| 4 | `npm run qa:reset-offer-fixtures` (R16-1, before any cart) | 3 stale cart rows cleared · 6 stale pending offers cancelled · 5 tax records voided · 6 listings reset. `in_progress` trades preserved. |
| 5 | DB: sellers with exactly 1 / 2 / 3 available+approved listings; residue query | Found 1-listing and 2-listing sellers in test-buyer's node; **no non-NULL-node seller with exactly 3**; `test-seller-2` = exactly 3 but `node_id` NULL. |

## Phase 1 — mobile drive (test-buyer)
| # | Action | Outcome |
|---|---|---|
| 6 | `adb` deep link `qa-login-as?persona=test-buyer` | Home, 458 SP, Norwalk Central. |
| 7 | Discover → search "Hood Raincoat Hoodie" → open the $20 card (`1c05408e`) | Item Detail; sticky CTA "Request to Buy" only. |
| 8 | Scroll → Seller Info | **S03/S15 PASS** — no `more-from-seller-cta`, no placeholder; `contact-seller-button`/`view-seller-profile-button` present. DB-confirmed the seller has exactly 1 listing. |
| 9 | (friction) blind-coordinate tap on the search field while it held text | Field corrupted ("Hood Raincoat HooQA Bundle Fixturedie") → recovered with the app's own **Clear search** control, then a **ref**-based field tap. |
| 10 | (friction) mid-session **unsolicited JS bundle reload** | Blank + spinner → Home, ~15–20 s; session preserved; cost 2 calls. R79-1 class. |
| 11 | Open a multi-listing seller's item (`18a41ad8`, test-seller) → `add-to-cart-button` visible | **Positive control for S03/S15** (multi-listing seller renders `Add`; single-listing does not). |
| 12 | Tap Add ×6 (across the QA bundle-fixture items) | Cart badge 1→6; toast missed twice by tap→screenshot (≈3 s round-trip vs 2.5 s window). |
| 13 | Batch `[tap Add, mobile_get_device_logs]` (R108) | Captured `[Analytics] Event tracked: cart_item_added {"item_id":"c4e1e2a1…"}` — proves the event; **no visual**. |
| 14 | Batch `[tap Add, 3× get_orientation, save_screenshot]` | **Toast caught mid-slide-in.** |
| 15 | Batch `[tap Add, 6× get_orientation, save_screenshot]` | **Toast fully rendered: "Added to Trade Basket"** ⇒ **M16 + M18 PASS**. |
| 16 | Basket (6 items) → `bundle-cta-button` → Checkout | **"📦 Combined Offer — … all 6 items from this seller"** ⇒ S10 leg A. Also read `cart-more-from-seller-banner` "This seller has 37 more items" (43 − 6 ✓ DB-consistent). |
| 17 | Back → Clear Basket → confirm (in-app branded destructive modal) | Cart emptied; empty-state verified. (First confirm tap missed — coordinates had been derived from the **downscaled** `view_image` frame; re-derived from the AX tree → worked.) |
| 18 | Search "Pocket Button Active Shorts" → open `704410de` (2-listing seller `bfaa272d`) → Add | Basket = 1 item; `single-item-cta-button` + `cart-more-from-seller-banner` **"This seller has 1 more item"** (positive control at the other end of the range). |
| 19 | `single-item-cta-button` → Checkout | **No "Combined Offer" banner** ⇒ **S10 PASS** (bundle vs single discriminator driven both ways). Step text vs removed "regular Checkout" button ⇒ **DOC-DRIFT**. |
| 20 | Send Offer → Liability Disclaimer modal → checkbox (AX: `checked`) → Accept & Continue | "Trade Initiated!" + "Consider using SP on your next purchase to save more." |
| 21 | DB read-back (2 queries) | **Exactly 1** trade `1dfae1ce…`: `pending`, cash 3000¢, buyer fee 149¢, `sp_amount` 0, `disclaimer_acknowledged=true`; `cart_items` = **0** (⇒ the still-showing Basket badge "1" is **stale**, F3). ⇒ **S12 PASS** (offer leg). |
| 22 | S19 attempt — search "Board Game Set" (test-seller-2) with Show All Nodes **Off**, then **On** | **"No Results Found" both times** despite the seller having exactly 3 available+approved listings ⇒ `node_id = NULL` items are not returned by Discover search under either scope. No listing deep link registered ⇒ **S19 BLOCKED (fixture reachability)**, mechanism's positive controls only. |

## Phase 2 — FIX-Task-29 carryover
| # | Action | Outcome |
|---|---|---|
| 23 | `adb` `qa-login-as?persona=test-admin` ×2 | Landing both times. |
| 24 | `adb logcat -d -s ReactNativeJS` | `[QaLoginAsDeepLink] login-as test-admin attempt 1/3 failed: code=INVALID_CREDENTIALS …` ×3 per round, then "Cleared the half-switched session" → Landing ⇒ **A3 on-device BLOCKED (F1)**; the app's own log named the fault in one call (R102 ordering rule). |
| 25 | Full-frame `qa:badge-scan` on the Item Detail frame (`0,0,1080,2400`) | **iosblue 0 px (0.00 %)** ⇒ 7C Item-Detail accent verified clean on-device. |
| 26 | Source greps: `AdminDashboardScreen`, `#007AFF`, `CategoryFilterChip`/`PriceSuggestionCard` usage | A3 = zero literal hex + shared `ui/Button variant="primary"` + `testID="admin-run-mid-trade-check"`; `TradeInitiationScreen:981` = `#5B8FB9`; the two skipped targets are imported by **no live screen**. |
| 27 | Source greps: admin `bulk`, `tax/**` `disabled|history|version` | No bulk tax-node UI (categories-only bulk dropdown) ⇒ **P02 DOC-DRIFT**; no per-node change history (rule-version history only) ⇒ **P03 DOC-DRIFT**; `category-mapping/page.tsx:341 disabled={… || !editValue}` ⇒ **O1-C16 PASS**. |
| 28 | Read guide bodies: S03/S10/S12/S15/S19, P02, P03, B02 | Confirmed assertions + the B02 snake-string residual is **stale** (body carries no code assertion) ⇒ **B02 PASS**. |

## Phase 3 — tracker
| # | Action | Outcome |
|---|---|---|
| 29 | Edit 16 Status+Latest cells | 8 → ✅ PASS · 4 → 📄 DOC-DRIFT · 3 → ⏭️ SKIPPED · 1 → 🔴 STILL OPEN |
| 30 | Reconcile header ⇄ §1 roll-up ⇄ TRD section header ⇄ Remaining table | **285 / 12 / 1 / 13 / 6 / 16 = 333 ✓** (mechanically recounted from the Status column). |

## Safety
No `admin_config` writes · no admin-portal writes · no `page.route` stubs · no source/test/seed/config edits · no `git` writes · only read-only SQL.
