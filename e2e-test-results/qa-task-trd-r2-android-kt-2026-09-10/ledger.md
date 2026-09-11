# Ledger — TRD Round 2: Groups K–T Android coverage (2026-09-10)

Run: `e2e-test-results/qa-task-trd-r2-android-kt-2026-09-10/`
Device: Android `Medium_Phone_API_36.1` (emulator-5554) · HEAD `92a0dae3` · Metro 8081 · admin `:3001`
Personas: test-buyer (subscriber), test-free, test-seller (trial) · real admin session (`samer`)

## Call ledger (R71 manual tally — transcript not mineable this session)
| Phase | Executions (approx) | Verdicts | Notes |
|---|---|---|---|
| Recon (guide/tracker/memory/fixtures) | ~28 | — | desk work: guide skim, tracker rows, persona + admin_config + item fixture reads |
| K group (K01–K05, K11, K10) | ~95 | 6 PASS + 1 PARTIAL | dominated by the bundle-checkout investigation (~55) |
| N group (N01–N04, N09, N10, N14, N06/N07) | ~85 | 6 PASS + 1 PARTIAL + 2 DOC-DRIFT | admin portal (login + Cart Settings + Fees tab) ≈ 22 |
| T group (T02, T04–T07) | ~35 | 5 PASS | all on one CartCheckout screen |
| M/S partial (M01, M02, M12, M17, S07, S10) | ~15 | 6 PASS | incidental to the cart flow |
| Evidence capture (screencap+pull pairs) | ~24 | — | 12 PNGs |
| Cleanup + tracker + report | ~14 | — | 3× fixture reset, 3 config reverts, tracker edits |
| **Total** | **~296 executions** | **~27 verdict-class items** | ≈ **11 calls/verdict** (above the 43c 9.6 target because of the F1 root-cause work, which alone was ~55 calls) |

## Tooling facts discovered/confirmed this round
1. **`mobile_save_screenshot` is disabled** on this harness ⇒ evidence via `adb shell screencap -p /sdcard/x.png` + `adb pull` (2 calls per shot).
2. **Android keyboard hide = `adb shell input keyevent 111`** (ESC) — reliable, no navigation side-effect.
3. **RN ScrollViews clip off-screen children OUT of the AX tree on Android** (`removeClippedSubviews`): the Item-Detail Price Breakdown and the CartCheckout Order Summary both looked "missing" and were merely below the fold. **Always scroll before declaring an element absent.**
4. **`qa:ax-tree` needs the JSON list format** — the default `text` dump cannot be parsed by it (fallback: `grep -o` on the session-resource file).
5. **LogBox overlays can be dismissed** via their AX-exposed `Dismiss` row (bottom-left), but a *stale replay* reappears after navigation (R4: prefer terminate+relaunch).
6. **Cold dev-client relaunch** = `am force-stop` → `am start -W -d <deeplink>` → Expo Dev Launcher → tap the `http://10.0.2.2:8081` row (~8–12 s to usable UI). Needed to clear **stale client cart state** after a server-side reset (R92).
7. **Deep links can be silently ignored right after a `qa-login-as`** (the auth transition swallows the first intent) — re-fire once.
8. **A deep link fired while the Basket tab is selected may not navigate** — re-fire or use the in-screen "View Trade Basket" button.
9. **`mcp_supabase_query_logs`** returned `"Backend error! Retry your query"` for a `function_edge_logs` query — EF log diagnosis unavailable this session.
10. **Item Detail's footer is stable at y1949–2085** for every listing ⇒ cheap repeated Add taps (the Add control becomes "View Trade Basket" once the item is in the cart).
11. **Android dev client can wedge on `Reloading...`** — repeated `force-stop` + Dev-Launcher relaunch reached a splash then a permanently empty view tree (`qa:ocr` showed "Reloading..."); treat as a dev-tooling block (R87 class), not an app fault.

## Decision log highlights (friction → pivot)
- **Offers cap not cleared at session start** (R-16-1 not applied) ⇒ the first bundle attempt failed for a fixture reason. Root-caused in 3 calls via `qa:ef-repro` (409 MAX_PENDING_OFFERS), then reset. **Cost ~12 calls.**
- **Bundle checkout failure chase:** after the cap was cleared the app still failed; the discriminating sequence (EF with same items → 200; EF with the app's exact payload → 200; config value/type verified; EF applied one fee) localised it to the **client**, costing ~55 calls. Logs unavailable ⇒ the EF's exact error line remains unknown; the client discards the error body.
- **Admin portal clicks:** `locator.click` on `/settings/cart` timed out because **the sidebar intercepted pointer events** (known class) ⇒ switched to `page.evaluate(() => el.click())` for every portal click; `getByText('FEES')` also failed to switch the config tab (render didn't change) — **a DOM-level `button` text match + `textContent` dump** was required to read the Fees panel.
- **Min-price raise made safe by discovery, not assumption:** source-read of `20260902000001_dev_task_86_forward_only_min_price.sql` proved the auto-pause was intentionally removed ⇒ the 0→5 raise had no listing blast radius (verified empirically afterwards).
- **`charge_one_fee_per_bundle` data_type normalised** to `boolean` after the helper wrote `string` (portal defines it boolean) — flagged for a dev sanity check (F6).

## ⚠️ CORRECTION (2026-09-11) — the "bundle checkout is broken" finding is RETRACTED
- **Owner evidence:** a real 3-item bundle order submitted 2026-09-11 **02:06:54 UTC** created 3 `pending` trades in one batch (02:06:54.649 / .732 / .762) sharing **`bundle_id = 330427dc-1b1e-4146-b9fc-fa8e1e118457`** (buyer `d84bcc68…`, seller test-seller-3) with exactly **one** `buyer_transaction_fee_cents = 149` and two zeros. The app's bundle checkout therefore works end-to-end, including the one-fee-per-bundle rule.
- **What actually happened to me:** `qa:reset-offer-fixtures` (run 3× this session) clears **`cart_items` server-side** without telling the running app. My second attempt submitted from a client whose cart/bundle context had been invalidated underneath it → non-2xx → I filed it as a product defect. Classic self-inflicted-state misattribution; the playbook's environment-first rules (R83/R87/R94) should have forced a clean-session reproduction before any finding.
- **Kept (still true):** attempt 1 WAS the per-seller cap (409 `MAX_PENDING_OFFERS`, real residue); `checkoutCart` **does** discard the EF's structured error body (a genuine, low-severity diagnosability gap).
- **Clean re-test attempted 2026-09-11 07:19–07:21 and NOT completed:** fresh `force-stop` → Dev-Launcher → server row; the client wedged on `Reloading...`, then reached a splash and a permanently empty view tree; a second `force-stop` + cold Dev Launcher start reproduced the same stall. Recorded as an **environment block** (dev-client/dev-server), not evidence either way. **Next session: finish this reproduction first — it is the only outstanding verification of the correction.**
- Report, tracker round note and tracker coverage rows have all been corrected in place; no surface still claims the bundle path is broken.

## Residue / cleanup performed
- `qa:reset-offer-fixtures --persona test-buyer` × 3 (final: 0 pending offers, 0 cart items).
- `charge_one_fee_per_bundle` → `true`/`boolean`; `cart_min_value_cents` → 0; `min_listing_price` → 0 (all DB read-back verified).
- Mobile app logged out. Admin portal left logged in at `/config`.
- **Left behind:** 1 pending "$6 QA Dev Fixture Item" listing under test-seller (N04 publish leg, 2 dev photos).
