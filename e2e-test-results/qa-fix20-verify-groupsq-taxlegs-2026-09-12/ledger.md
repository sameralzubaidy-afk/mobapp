# Ledger — QA run 2026-09-12 (FIX-Task-20 verify + Group Q + tax legs)

Condensed ordered trace. `[DB]` = read-only Supabase SQL · `[ADM]` = admin portal (run_playwright_code, DOM clicks) · `[iOS]` = mobile-mcp on iPhone 17 Pro Max · `[SH]` = terminal.

## Recon (before any device/admin work)
1. [SH] `xcrun simctl list devices booted` → iPhone 17 Pro Max `3F3293A3-…` booted.
2. [SH] `adb devices` → `emulator-5554` online (not used this round).
3. [SH] `pgrep -l -f "expo start"` → **one** Metro instance.
4. [SH] `pgrep -l -f "run-suite|maestro|playwright"` → only an idle admin Playwright `test-server`; no suite in flight.
5. [SH] `pgrep -l -f "next|node.*3001"` → admin portal (`next-server v14.2.30`) up on `:3001` + mobile-mcp process.
6. Read: QA playbook (full), `fix-task-20-2026-09-12.md`, `qa-test-accounts.md`, prior round `qa-task-adm-tax-groups-w-q-2026-09-11/report.md` + `session-notes.md`, Group Q + O-1 guide entries, `tax/settings/page.tsx`, `payments/page.tsx`, `trades/TradeFilters.tsx`+`page.tsx`, `tax/nodes/page.tsx`, `review.ts`, `SubmitReviewScreen.tsx`, `TradeTimelineScreen.tsx`.

## Phase 1 — item 0 (priority)
7. [DB] baseline of the 5 tax `admin_config` keys (values + `updated_at` + `updated_by`).
8. [ADM] `open_browser_page forceNew /tax/settings` → first read was a **hydration race** (stale toggle values) → reload + settle 2.5 s → clean read.
9. [ADM] **LEG A**: `subscription_fee_taxable` false → Save → msg *"Saved 1 setting: subscription_fee_taxable."*, dirty marker "Unsaved changes (1): …".
10. [DB] `subscription_fee_taxable=false @11:39:38.671546`; **`sales_tax_enabled` untouched (true @11:19:31.248497)**; other 3 keys untouched.
11. [ADM] restore `subscription_fee_taxable` → true (@11:39:51); provenance label moved (item 14).
12. [ADM] **LEG B**: uncheck kill switch → Save → modal present with heading/body/button copy captured; dirty marker + "will change on save".
13. [DB] **no write while the modal is open** (`sales_tax_enabled` still true @11:19:31.248497).
14. [ADM] **Cancel** ("Keep tax on") → modal closed, toggle reverted, msg "Sales tax was left ON. No changes were saved."
15. [DB] still `true` @11:19:31.248497; exactly 3 `update_tax_settings` audit rows for the 3 real saves ⇒ cancel wrote no audit row.
16. [ADM] re-open modal → **screenshot** (`ADM-ITEM0-killswitch-confirm-modal.png`).
17. [ADM] **Accept** ("Turn off sales tax") → "Saved 1 setting: sales_tax_enabled."
18. [DB] `sales_tax_enabled=false @11:40:23.252275`.
19. [DB] `calculate_tax(node,3000,gtg,3000)` → `{global_enabled:false, tax_amount_cents:0}`.
20. [ADM] re-enable → Save → **no modal** (correct) → msg names the single key.
21. [DB] `true @11:40:53.66252`; `calculate_tax` → `{0.0699, 210, global_enabled:true}`.

## Phase 1 — items 1–12
22. [DB] item 1: pre-2026-07-23 completed → `quoted 0` / `collected 50`; remaining completed+quoted = 9, all `cash`, $80.63, uncaptured.
23. [DB] item 2: `get_tax_summary_for_period('2026-07-01','2026-09-12',null,'summary')` → header 17143/175/16968 == by_jurisdiction CT 17143/175/16968.
24. [DB] `pg_get_function_arguments` for `calculate_tax` / `get_applicable_tax_rule`; `tax_categories` located (first attempts used wrong table names `taxonomy_categories`/`product_categories` — 1 schema surprise each, per R7).
25. [DB] item 3: clothing 2500→0 · 4999→0 · 5000→318 · 6000→381; exempt 6000→0; no-category→node rate 191.
26. [DB] `tax_rules` full dump (14 rows) — clothing bands, exempt V4 unbounded, 2 active `general_tangible_goods` rules (CT v3 + NY v1).
27. [DB] `pg_get_functiondef(get_applicable_tax_rule)` → `ORDER BY effective_from DESC, version DESC, id ASC` (item 4).
28. [DB] read-only precedence simulation → a fresh CT v1 created today outranks the NY v1.
29. [ADM] `/tax/rules` overlapping create → **named** rejection (F5), no UUID in the body; row count 14→14; **screenshot**.
30. [ADM] `/tax/category-mapping` → clear row select → Save **`disabled`**, click no-op, no write (F6).
31. [DB] `nodes` baseline (Norwalk Central 0.0635/enabled; others 0) before the F8 probe.
32. [ADM] `/tax/nodes` Buffalo: rate 101 → inline error; rate -1 → inline error; `window.alert` instrumented → **0 alerts**; **screenshot**.
33. [ADM] `/tax/reports` → auto-ran on mount (item 13); header == CT row ($468.00/$32.75/$1.75/$105.30/$31.00/143); new gross-collected explanatory copy present.
34. [DB] same-window RPC → exact match (R54).
35. [ADM] `/payments` → "Payments (this page) / 100 / of 890 matching" (item 15).
36. [ADM] K09 search leg with the **page's own** `payment-search` → 1 row + recomputed strip; cleared → 100 of 890.
37. [ADM] `/reviews` → "Results (10 on this page) of 13 matching reviews" + 🚩 badges (F9); **screenshot**.
38. [ADM] `/trades` W12: typed `test` into `trades-search-input`, set status=completed, switched to Bundle Trades → URL `?view=bundles`, search input absent, status dropped.
39. [ADM] CSV export → intercept anchor download → `tax-transactions-2026-08-13-to-2026-09-12.csv`.
40. [ADM] bundle detail pages (`330427dc` in_progress, `6e06aa28` SP16, `d260110b` SP0) → "Bundle Admin Interventions" present only for non-terminal; SP row conditional; arithmetic verified; **screenshot**.

## Phase 2 — mobile (iOS)
41. [iOS] `mobile_list_available_devices` → iPhone 17 Pro Max online + Android emulator online.
42. [iOS] `mobile_get_foreground_app` → app running (Landing).
43. [SH] `openurl qa-login-as?persona=test-buyer` → Home ("Good morning, Test").
44. [SH] `openurl trade/f2899f12-…` → Trade Timeline (pre-reload ordering; see 48).
45. [iOS] tree read → Reviews section + `review-button`; Payment Details present.
46. [iOS] `terminate_app` + `launch_app` (R79-1) → `Bundling 42%…` → `98%…`.
47. [SH] re-fire trade deep link after Home loaded.
48. [iOS] tree read → **Reviews y499 → Payment Details y694** ⇒ item 16/F13 verified on the fresh bundle.
49. [iOS] tap `review-button` → SubmitReview ("Review the seller"); `0/500` placeholder + `0/500 characters` (item 17); **screenshot**.
50. [iOS] tap **Skip for Now** (Q05) → back to Trade Timeline, no blocker; Reviews still offers the CTA.
51. [DB] 0 reviews on `f2899f12` ⇒ skip wrote nothing.
52. [iOS] batch: tap `review-button` → tap `anonymous-checkbox` → tap `star-5`.
53. [iOS] **screenshot** (`IOS-Q04-anon-5star-before-submit.png`).
54. [iOS] tap `submit-review-button` → alert "Your review has been submitted!" (`global-alert-button-0`); **screenshot**; tap OK.
55. [DB] review `44f5662f` created: `rating=5`, **`is_anonymous=true`**.
56. [iOS] tree read → buyer post-submit state: "✓ You have reviewed the seller" + "✗ The seller hasn't reviewed you", CTA gone (Q06 buyer side).
57. [SH] `openurl qa-login-as?persona=test-seller-3` → Home (avatar "TS").
58. [SH] `openurl trade/f2899f12-…` → seller-side state: "✗ You haven't reviewed the buyer" + "✓ The buyer has reviewed you" + CTA (Q06 seller side).
59. [iOS] tap `review-button` → SubmitReview **"Review the buyer"** (Q01 seller leg).
60. [iOS] batch: tap `star-4` → tap `submit-review-button` → alert → tap OK.
61. [DB] second review `bd39e3a4` (seller→buyer, 4★) ⇒ mutual pair complete.
62. [iOS] tree read → "✓ You have reviewed the buyer" + "✓ The buyer has reviewed you", CTA gone (Q06 complete).
63. [iOS] tap Home tab → tap `header-profile-btn` → **"My Profile"** (Test Seller 3). *(first attempt hit the messages icon on the Trade Timeline header — recovered via the Home tab.)*
64. [iOS] tree read → "Reviews (2)", "4.5", "Based on 2 reviews", breakdown 5/4/1+1.
65. [iOS] swipe up 700 px → review cards in view; `review-menu-button` (376,449).
66. [iOS] **screenshot** (`IOS-Q04-Q15-own-profile-reviews-anonymous.png`).
67. [iOS] tap `review-menu-button` → 4 reason rows (`review-report-spam|offensive|false-info|other`).
68. [iOS] tap **Report as Offensive** → confirm dialog "Report Review / Report this review as Offensive Content?"; **screenshot**; tap Report.
69. [iOS] success alert **"Review reported. Thank you!"**; tap OK.
70. [DB] `review_reports` row `97b76c1e` (`reason='offensive'`, reporter = reviewee); **`report_count` 0→1**, `has_been_reported=true`, `is_hidden=false`, `review_status='pending_review'` (F9 live regression proof + Q15).
71. [ADM] `/reviews` → located `44f5662f` row (Keep/Hide, "1 report", "Pending Review"); **screenshot**.
72. [ADM] click **Keep** with `window.confirm` instrumented+accepted → confirm text captured ("This will keep the review visible, reject all reports, and notify everyone who reported it. Continue?"); no error alerts; row left the rendered list.
73. [DB] `report_rows=0`, `report_count=0`, `has_been_reported=false`, `is_hidden=false`, `review_status='reviewed'` ⇒ Q19 verified.
74. [DB] Q16: `reviews_with_gt1_report = 0` (structural unreachability confirmed); `review_reports` back to 13 (zero residue); Buffalo node unchanged (no write from the invalid-rate probe).
75. [SH] `openurl seller-profile/93c3b2bd-…` (public profile, exactly 1 received review).
76. [iOS] tree read → header **"(1 review)"** (F11 singular fixed), "Reviews (1)", **no `review-menu-button` anywhere** (Q17 negative).
77. [iOS] **screenshot** (`IOS-Q17-public-profile-no-report-menu-1review-singular.png`).

## Tooling facts / friction (this run)
- `click_element`/`hover_element` actionability **still never passes** on this admin build (F14) — DOM `.click()` via `run_playwright_code` is the reliable path.
- A **hydration/first-read race** after `open_browser_page` returned stale controlled-input values once; a reload + ~2.5 s settle fixed it. Guard: never trust the first read after opening a page.
- `page.screenshot({clip})` with a `boundingBox()`-derived clip **failed** ("Clipped area is either empty or outside the resulting image") — use a full-page/screen screenshot instead.
- In the tool's script sandbox `setTimeout` is **not defined**; use `page.waitForTimeout`.
- A **stale dev bundle** rendered the pre-fix Trade Timeline ordering until a cold reload (R79-1 event, report §0.3).
- `includePattern` grep with an absolute path containing spaces did not match chat-session resource files — read the file directly instead.
- Schema surprises: `taxonomy_categories` and `product_categories` do not exist (the tables are `tax_categories`; the mapping's other side is not `product_categories`). One retry each per R7; `category_tax_mapping` row count 10.
