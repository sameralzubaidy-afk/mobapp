# QA Task — TRD Admin-Portal Tax Groups + Group Q (Android + live admin portal)

**Run folder:** `e2e-test-results/qa-task-adm-tax-groups-w-q-2026-09-11/`
**Date:** 2026-09-11/12 · **Repo HEAD:** `9d623c4c` (clean tree at start)
**Devices:** Android `emulator-5554` (`Medium_Phone_API_36.1`, Android 16, expo-dev-client) + live admin portal `http://localhost:3001` (real admin session, `samer@samer.com`)
**Platform disclosure (R80):** every verdict in this report is **Android / platform-agnostic (admin portal + DB/RPC)**. **iOS was NOT driven this session — no iOS verdict is claimed.**

---

## 1. Verdict roll-up

| Group | Converted this round | Verdict mix |
|---|---|---|
| **O-1 — Tax by Catalog Category (admin)** | 13 of 16 | 12 ✅ PASS · 1 🟡 PARTIAL (C16) |
| **O-2 — Tax Status Lifecycle** | 9 of 12 | 4 ✅ PASS · 4 🟡 PARTIAL · 1 🔴 FAIL (C12) |
| **O-3 — Tax Refund & Reconciliation** | 12 of 14 | 6 ✅ PASS · 6 🟡 PARTIAL |
| **P — Tax (Admin Portal)** | 6 of 8 (P02/P03 are guide-deferred) | 5 ✅ PASS · 1 🟡 PARTIAL (P05) |
| **W — Admin Bundle Trade Views** | 12 of 12 | 11 ✅ PASS · 1 🟡 PARTIAL (W12) |
| **K07–K09** | 3 of 3 | 2 ✅ PASS · 1 🟡 PARTIAL (K09 search leg) |
| **Q — Reviews & Ratings** | 9 of 20 | 7 ✅ PASS · 2 🟡 PARTIAL |
| **Total** | **64 of 85 in-scope rows** | **47 PASS · 16 PARTIAL · 1 FAIL** |

Not reached (explicit, R40): O-1 C06/C07/C15 (all three require creating new listings before/after a mapping change), O-2 C04/C05/C11, O-3 C08/C09, Q04/Q05/Q15/Q17 (mobile report/anonymity affordances), Q10/Q11/Q13/Q14/Q16 (guide-deferred), Q19/Q20 (destructive on non-QA review data), plus the "if budget allows" items O03/O04/O06/O07/O08, R03/R04 and K02's first-trade leg — **none driven this session**.

---

## 2. Environment / setup facts

- R29 busy check clean: one `expo start` (Metro) instance, no other QA/dev agent driving the emulator or the shared admin browser session.
- Android app cold-starts into the Expo Dev Launcher (R77 #6) — tapping the `http://10.0.2.2:8081` row loads the bundle; the persona deep link then delivers warm.
- `adb shell settings put secure stylo_handwriting_enabled 0` applied at the mobile-leg start (R77 #2 standing step) — no Gboard stylus-tutorial interference this round.
- **Admin browser:** `click_element`-style Playwright actionability **never passes** on this build (R81 class — elements resolve but never become "stable"). All admin driving used `run_playwright_code` with **DOM `.click()`** + `page.fill`/`selectOption`, which is reliable. A native `alert()` from the Tax-Nodes invalid-rate validation wedged page `c30d9a2f…` (the harness reported an open dialog while `handle_dialog` reported none); the page was abandoned and a **fresh active page** was opened (R81 discipline).
- **Admin tax pages are fully `data-testid`-instrumented** (`tax-rule-*`, `ctm-*`, `tax-node-*`, `tax-report-*`, `payment-*`) — cheap to drive; `TradeActions.tsx` exposes `partial-refund-button`/`refund-*-input`/`confirm-partial-refund`.

### Tax-engine facts established from source + DB (used throughout)
- `get_applicable_tax_rule(category, date, price)` filters `is_active`, date range and price thresholds, then **`ORDER BY version DESC LIMIT 1`** — i.e. the highest *version* wins, **jurisdiction is not part of the match**. This is why the live effective rate was 6.99% (CT v3) rather than the NY v1 10% rule that the 2-arg RPC returns in isolation.
- `calculate_tax()` short-circuits to **$0 when `sales_tax_enabled` is false** (DT-68); otherwise it uses the category rule rate, falling back to the node rate.
- Staging tax-rule baseline (10 rows) and `category_tax_mapping` (**10** product categories) captured in `session-notes.md`.

---

## 3. Per-group detail

### 3.1 O-1 — Tax by Catalog Category (admin) — 12 PASS / 1 PARTIAL

| TC | Verdict | Evidence |
|---|---|---|
| O1-C01 | ✅ PASS | After clearing the blocking active rule: create `general_tangible_goods`/CT/6.35%/today→open → **"Rule created successfully."**; DB row `f45087b8` v1 `is_active=true` @0.0635; `admin_audit_logs.tax_rule_created` with `payload.new` (version/rate/is_active/created_at) |
| O1-C02 | ✅ PASS | As written (an active open-ended rule already existed) → **"Overlapping active tax rule exists for category e14198fb-…, jurisdiction CT in the same date range"**; rule count unchanged (10). ⚠️ the error text **leaks a raw category UUID** (see Findings) |
| O1-C03 | ✅ PASS | Edit → "Updated CT Tangible Goods Rate (v2)", 6.99%, effective **tomorrow** → **"Rule updated — new version 2 created."**; old v1 → Inactive with `effective_to` stamped; **Version History table shows v1 (Inactive) + v2 (Active)**; `tax_rule_updated` audit with before/after |
| O1-C04 | ✅ PASS | Deactivate modal copy exactly as the guide expects ("…close its effective period. Historical trades … retain their recorded tax calculation. This action is audited.") → confirm → Inactive + `effective_to` stamped; `tax_rule_updated` audit |
| O1-C05 | ✅ PASS | `SELECT count(*) FROM items WHERE tax_category_id IS NULL` = **0**; live distribution `general_tangible_goods=1931, tax_exempt_goods=50, clothing_footwear=25`. (Guide's "all items default to general_tangible_goods" is stale — items follow the category mapping.) |
| O1-C08 | ✅ PASS | Admin `/items/<id>` → **Change tax category** → Clothing and Footwear → **"Tax category updated."** → DB `clothing_footwear`; then restored to `general_tangible_goods`; **2** `item_tax_category_changed` audit rows |
| O1-C09 | ✅ PASS | `tax_exempt_goods` pre-seeded + active; `get_applicable_tax_rule(tax_exempt_goods, now, 3000)` → `is_taxable=false`. ⚠️ see Finding F3 ($0–$50 threshold) |
| O1-C10 | ✅ PASS | `clothing_footwear` price-threshold rule active, `$0 – $50` (max 5000), different category ⇒ no overlap rejection |
| O1-C11 | ✅ PASS | Tax → Settings → **Include marketplace transaction fee in sales-tax base** on → save → reload still checked → `admin_config.include_fee_in_tax_base='true'` + `get_include_fee_in_tax_base()=true`; off → save → `'false'` / `false` (restored to the pre-run `false`) |
| O1-C13 | ✅ PASS | `admin_audit_logs` rows for create/update/deactivate with `actor_id` = the authenticated admin, `entity_type='tax_rule'`, payload before/after |
| O1-C14 | ✅ PASS *(doc-drift)* | `/tax/category-mapping` renders **10** product categories (guide says 8) — Books→Tax Exempt Goods, **all others→General Tangible Goods** (guide's default "Clothing→Clothing and Footwear" is not the live mapping). Books→General Tangible Goods → **"Mapping updated. New listings will use the updated tax category."** → changed back successfully; `category_tax_mapping_changed` audit rows carry old/new ids |
| O1-C16 | 🟡 PARTIAL | **RPC guard PASS:** a fabricated tax-category UUID sent by the app's own admin call → **"Tax category not found or inactive"** inline, mapping unchanged. **UI guard FAIL:** with the dropdown empty the Save button is **not disabled** and clicking it is a **silent no-op** (no validation error) — the guide expects "Save disabled or shows validation error" |
| O1-C17 | ✅ PASS | Status filter defaults to "All statuses"; Active only → 4 rows; Inactive only → 9 rows; combined `Clothing and Footwear` + `Active only` → exactly the 1 active Clothing rule; all instant (no reload/spinner) |
| O1-C06/C07/C15 | ⚪ not reached | all require creating fresh listings (C15 twice, before/after a mapping change) |

### 3.2 O-2 — Tax Status Lifecycle — 4 PASS / 4 PARTIAL / 1 FAIL

| TC | Verdict | Evidence |
|---|---|---|
| O2-C01 | ✅ PASS | Live quoted records: `tax_status='quoted'`, `captured_at IS NULL`, `tax_snapshot.items` present (e.g. `2bb49d39` rate 0.0699, taxable 2000, tax 140) |
| O2-C02 | 🟡 PARTIAL | Inside the force-cancelled 3-item bundle a **$7 line carried `tax_amount_cents = 0` while its two $23 siblings carried $1.61 each** — a tax-exempt limb inside a taxable bundle. The line's `items.tax_category_key` could not be resolved (join mismatch), so exemption-vs-other-cause is not proven; the clothing-threshold limb was not exercised |
| O2-C03 | 🟡 PARTIAL | Precondition confirmed (`include_fee_in_tax_base=false`); the C11 toggle was driven on the admin side, but the **paired offer/tax-record comparison ($1.91 vs $2.00)** was not driven on mobile |
| O2-C04 | ⚪ not re-driven | BP-37 (taxable base = full item price with SP applied) has prior Android evidence on record; not independently re-driven this session |
| O2-C05 | ⚪ not re-driven | — |
| O2-C06 | ✅ PASS | Live cancellations → `tax_records.tax_status='voided'` + `voided_at` stamped, `captured_at` NULL (`6af48a08` voided 01:42:26, `2e0a27e8` voided 01:42:28 — 2 s after the cancel). SP leg N/A: both trades had `sp_amount=0`; the buyer's wallet shows **0 reserved** and **no `sp_ledger` rows in the window** — consistent, **not** a missing-refund defect (the only 16-SP trade in the bundle was already cancelled + released in a prior session) |
| O2-C07 | ✅ PASS | Same mechanism: cancel → PI/authorization voided, tax `voided` (not refunded), **0 `trade_refunds` rows created** |
| O2-C08 | ✅ PASS | A captured trade shows `tax_status='collected'` + `captured_at` set + `stripe_capture_id` present; the buyer timeline renders **"Paid:"** with a `timeline-payment-tax-row` → **"Sales Tax (6.99%)" = $1.75** |
| O2-C09 | 🟡 PARTIAL | Auto-complete path not re-driven this session (existing `collected` records + the prior round's `rpc_process_auto_complete` evidence stand) |
| O2-C10 | 🟡 PARTIAL | **Not inducible as specified** — would require voiding a live PI in the Stripe dashboard; `tax_records` with `tax_status='capture_failed'` = 0. `capture_attempted_at`/`capture_error` columns exist and are unused |
| O2-C11 | ⚪ not driven | idempotency RPC calls not executed (would mutate real collected/refunded records) |
| O2-C12 | 🔴 FAIL | Pre-migration **completed** trades are **not** all classified `collected`: `completed` trades with `completed_at < 2026-07-23` → **`collected=16`, `quoted=34`, `voided=1`** ⇒ 34 historical completed trades are still reported as "pending/authorized" rather than captured. (All rows *do* have consistent captured/voided stamps: `collected` records with a NULL `captured_at` = 0.) |

**Ledger cross-check of my own actions (independent state-machine confirmation):** tax-status distribution moved `quoted 99→97`, `collected 41→40`, `refunded 0→1`, `voided 310→312` — exactly matching the 2 pending trades I force-cancelled (→voided) and the 1 tax refund I issued (→refunded, collected −1).

### 3.3 O-3 — Tax Refund & Reconciliation — 6 PASS / 6 PARTIAL

| TC | Verdict | Evidence |
|---|---|---|
| O3-C01/C02 | 🟡 PARTIAL | Pre-capture "Payment authorized:" + "Estimated Sales Tax" wording not re-driven this session (no pending offer created) |
| O3-C03 | ✅ PASS | Completed trade's Payment Details: **"Paid:"** + **"Sales Tax (6.99%)"** with the stored amount `$1.75` and `Total $26.75` — capture-complete wording, no "Estimated" prefix |
| O3-C04 | 🟡 PARTIAL | Capture-failure path not inducible (same constraint as O2-C10) |
| O3-C05 | 🟡 PARTIAL | The **refund-with-tax-reversal mechanics were driven live** (K08/K07: Stripe refund + `tax_records.tax_status='refunded'` + `refunded_tax_cents` set + buyer refund card), but via the **admin partial-refund** path, not the dispute-resolve route |
| O3-C06 | 🟡 PARTIAL | Duplicate **tax** refund attempt was rejected (over-refund guard) and no double refund was written — but the guide's specific `action:'idempotent'` retry-response assertion was not exercised |
| O3-C07 | ✅ PASS | Cancelling uncaptured trades **voids** (no refund): `tax_status='voided'`, `voided_at` set, **0 `trade_refunds` rows** |
| O3-C08 | ⚪ not driven | Requires a Stripe refund failure injection |
| O3-C09 | ⚪ not driven | `tax_status='pending_refund'` never occurs on staging (0 rows); needs a pending Stripe refund |
| O3-C10/C11/C12/C13 | ✅ PASS (C13 with a finding) | Driven through `get_tax_summary_for_period` for the current window: `pending_tax_cents=238` (2), `voided_tax_cents=751` (4), `tax_refunded_cents=175`, `by_jurisdiction.CT{collected 175, refunded 175, net 0}`, plus `capture_failed`/`pending_refund`/`reconciliation` counters present. **Finding F4:** the same response's **header and jurisdiction breakdown disagree** (`tax_collected_cents` 0 / `tax_net_cents` −175 header vs collected 175 / net 0 for CT) |
| O3-C14 | 🟡 PARTIAL | CSV export works (see P07): 143 rows / 32 columns. Per-status reconciliation is **exact** (`sum(tax_voided_cents)=10208` = the on-screen "Tax Voided $102.08"; refunded 0 = on-screen $0.00), but a **naive unfiltered** sum of `tax_amount_cents` = $229.47 ≠ on-screen "Tax Collected $32.75" because the export deliberately includes `quoted` (63) and `voided` (61) rows alongside `collected` (19) — the guide's equation only holds when filtered by `tax_status`. File name is `tax-transactions-<start>-to-<end>.csv`, not the guide's `tax-export-<start>-<end>.csv` |

### 3.4 P — Tax (Admin Portal) — 5 PASS / 1 PARTIAL

| TC | Verdict | Evidence |
|---|---|---|
| P01 | ✅ PASS | `/tax/nodes` lists 7 nodes with editable rate/jurisdiction/enabled + last-updated metadata; Norwalk Central 6.35%→**7.00%** → saved → **persists after reload**; **-1** and **101** both rejected with **"Tax rate must be a number between 0 and 100 (percent)."**; restored to 6.35% (DB-verified) |
| P04 | ✅ PASS | Global switch OFF → warning banner **"⚠️ Sales tax is currently OFF. No tax will be applied to any transactions across all nodes until you enable it and save."**; **`calculate_tax()` returns `tax_amount_cents: 0, global_enabled: false`** while disabled ⇒ new offers are tax-free; re-enabled → `calculate_tax` = 0.0699/210 again; switch + all settings round-trip stable across reload |
| P05 | 🟡 PARTIAL | `/tax/reports` renders Taxable Sales $468.00 · Tax Collected $32.75 · Tax Refunded $0.00 · **Tax Voided $102.08** · Net Tax Payable $32.75 · Transactions 143 for the default 30-day range — **but there are NO date presets** (guide expects Today/Last 7/Last 30/This Month/Last Month/Custom; live = raw Start/End date inputs) and there is **no "Pending Tax" figure** on the summary (the copy mentions pending is shown "for operations only") |
| P06 | ✅ PASS *(doc-drift)* | Jurisdiction Breakdown present (per-jurisdiction table). All **8** live report types render distinct, correct data: summary · jurisdictions · transactions · refunds ("Total Refunded $0.00 / Refund Count 0 / No data in this period.") · by period · tax exempt · audit trail · reconciliation required. The guide's list of "7 report types" (Tax Collected/Tax Refunded/Net/Pending/Voided/Capture Failed/Pending Refund/Reconciliation) does **not** match the shipped tab set |
| P07 | ✅ PASS | **Export CSV (Transactions)** produces a client-side CSV: **143 rows × 32 columns**, headers `trade_id, buyer_id, seller_id, listing_ids, tax_categories, jurisdiction, tax_rule_version, item_subtotal_cents, … tax_amount_cents, tax_refunded_cents, net_tax_cents, tax_status, …` |
| P08 | ✅ PASS | With the `general_tangible_goods` CT rule active, `calculate_tax(node, 3000, gtg, 3000)` → `tax_rate 0.0699`, **`tax_amount_cents = 210` ($2.10)** — the guide's corrected expectation, proving a node-rate edit does **not** propagate while a category rule exists |
| P02/P03 | ⚪ guide-deferred | The guide itself marks both as deferred ("needs manual testing if bulk update UI exists" / no change-history UI) |

### 3.5 W — Admin Bundle Trade Views — 11 PASS / 1 PARTIAL

| TC | Verdict | Evidence |
|---|---|---|
| W01 | ✅ PASS | `/trades` shows **"Single Trades"** and **"Bundle Trades"** with Single selected by default (single rows rendered on load) |
| W02 | ✅ PASS | The single-view page rows (`3265ec84, 061aa3a3, b65128b0, 44e02ec7, …`) are exactly the most-recent `bundle_id IS NULL` trades; **no bundle trade id appears** (258 bundle vs 632 single trades in the DB) |
| W03 | ✅ PASS | Bundle tab groups by bundle: `6e06aa28… 3 items cancelled pending` · `73d5eb11… 3 items completed cancelled` · `330427dc… 3 items in_progress` · `d260110b… 1 item completed` … |
| W04 | ✅ PASS | Row shows truncated bundle id (`6e06aa28...`), "**3 items**" + status pills, `B: Test Buyer <email> <phone> S: Test Seller <email> <phone>`, **`$53.00 cash 16 SP +$1.49 fees`**, `9/11/2026`, `View Bundle` |
| W05 | ✅ PASS | `View Bundle` → `/trades/bundles/73d5eb11-f0a3-44d5-9e7f-ff4988212c01`; page title **"Bundle Details"** + `Bundle ID: <full uuid>` + "← Back to Bundle List" |
| W06 | ✅ PASS | "Trades in this Bundle" lists one card per trade: truncated id, status badge, item title, `Price $25.00`, `Condition Good`, **"View Details →"** |
| W07 | ✅ PASS *(minor deviation)* | Bundle Monetary Breakdown: Total Cash (All Items) **$75.00** · Total Platform Fees **$1.49** · Total Sales Tax **$3.50** · Total Charged (Cash) **$79.99** (= 75.00+1.49+3.50 ✓). **"Total Swap Points Applied" row is absent** when the bundle used 0 SP (guide expects the row) |
| W08 | ✅ PASS | "View Details →" → `/trades/4d50a44e-…` showing **Trade Details**, **Monetary Breakdown**, **Admin Audit Trail**, **Financial Audit** |
| W09 | ✅ PASS | Red **Admin Interventions** section present on a bundle with non-terminal trades: **"Force Cancel Entire Bundle"** + warning "Force-cancelling this bundle will attempt to cancel all 3 trades in the bundle. Each trade will be marked as cancelled, SP will be re-credited to the buyer, and Stripe refunds will be issued if applicable." |
| W10 | ✅ PASS | Driven live on the disposable QA bundle `6e06aa28` with a typed reason → **all 3 trades `cancelled`** with `cancellation_reason` = my reason + `[Bundle: 6e06aa28...]` and `cancelled_at` stamped sequentially (01:42:25/27/29); 0 `trade_refunds` and 0 `seller_payouts` created (correct — uncaptured) |
| W11 | ✅ PASS | Bundle view with status filter `completed`: 50 rows → **11 rows**, every row showing a `completed` status pill |
| W12 | 🟡 PARTIAL | Switching tabs **resets the status filter** (`completed` → `all`) ✓ but the **search query is NOT cleared** (`"test"` persisted into the Bundle view) — the guide expects both to reset |

### 3.6 K07–K09 — Admin partial refund / payments reconciliation

Driven on the completed QA trade `f2899f12` (Bundle `73d5eb11`, buyer test-buyer; price $25.00, fee $0.00, tax $1.75, charged $26.75 — the guide's $100/$1.49/$7.00 precondition does not exist on staging, so the amounts were adapted and the assertions kept).

| TC | Verdict | Evidence |
|---|---|---|
| K07 | ✅ PASS | Modal "Partial / Line-Item Refund … Original: price $25.00 + fee $0.00 + tax $1.75." → refund **price $25.00, fee $0, tax $0** → **"Partial refund issued successfully"**. **Stripe refund `re_3UEdW24I6kC…`** issued; trade **stays `completed`**; `payments.refunded_cents = 2500` (price only, not 2675), `status='partially_refunded'`, **`refunded_fee_cents = 0`** (fee kept); `trade_refunds` row `11d15200` with split `2500/0/0`, `initiating_actor=admin`, `status=succeeded` |
| K08 | ✅ PASS | Second refund of the **tax component only** ($1.75) → success → `tax_records.tax_status='refunded'`, `refunded_tax_cents=175`, `refund_status=succeeded`, `refunded_at` stamped. Repeating the same tax refund → **rejected**: *"Failed to issue partial refund: Refund tax exceeds remaining sales tax"* (HTTP 400). Only 2 `trade_refunds` rows total; `refunded_cents (2675) ≤ total_charged (2675)`; each refund has its own history row |
| K09 | 🟡 PARTIAL | `/payments` renders the strip **"Payments (this page) 100 of 890 matching · Total Charged $2769.36 · Total Refunded (0) $0.00 · Net Collected $2769.36"** (window disclosed on the page ✓) + per-row date, trade id (links), buyer, price, fee, tax, SP, Charged, Refunded, status pill, Stripe PI; the status filter works (`partially_refunded` → 5 rows, all pills "partially refunded", DB-verified splits `2200/0/154`, `1000/0/0`, `1000/0/699`, `10000/0/0`, `5000/0/0`). **Search leg NOT verified** — my first attempt typed into `topbar-global-search` (global ⌘K search) instead of the page's own `payment-search` input; the corrected leg was not re-driven ⇒ recorded as PARTIAL, **QA-side error, not a product defect** |

### 3.7 Q — Reviews & Ratings — 7 PASS / 2 PARTIAL

Fixture: Bundle `73d5eb11` (buyer **test-buyer** ← seller **test-seller-3**), 2 completed trades (`4d50a44e`, `f2899f12`) carrying **no** reviews — a clean review fixture.

| TC | Verdict | Evidence |
|---|---|---|
| Q01 | ✅ PASS (buyer side) | Completed trade detail shows a **Reviews** section + **Review button "Review the Seller"** (the review entry point is the completed-trade detail, not only the completion screen) → SubmitReview screen "Review the seller" → review created (`rating=4`, `comment` 500 chars, `review_status=active`) |
| Q02 | ✅ PASS | Submit with no star → in-app `GlobalAlertProvider` dialog **"Rating Required / Please select a star rating before submitting."** (`global-alert-button-0`). ⚠️ the button is **not** visually disabled (guide's alternative "or has no effect" branch is not met — the tap fires the alert) |
| Q03 | ✅ PASS | `comment-input` + live counter `char-count`; typing 505 characters left `comment-input` holding **exactly 500** and the counter at **"500/500 characters"** ⇒ cap enforced, 501st+ rejected; comment is optional (label "Comment (optional)") |
| Q04 | ⚪ not driven | Anonymous leg not driven (no second clean completed trade left in the fixture after Q01) |
| Q05 | ⚪ not driven | Skip leg not driven (kept the trade available for the review flow) |
| Q06 | 🟡 PARTIAL | Buyer side PASS: after submitting, the trade's Reviews section switches to **"✓ You have reviewed the seller"** and the review button is replaced by the status label (Trades list). **Seller side not driven** |
| Q07 | ✅ PASS | The review appears on **test-seller-3's public profile** under "Reviews (1)" — reviewer name ("Test Buyer"), date ("Sep 11, 2026") and the card in the list (most recent first) |
| Q08 | ✅ PASS | Profile header renders the star display + **"4.0"** + **"**(1 reviews)**"** for the single 4★ review (⚠️ pluralisation: "1 reviews") |
| Q09 | ✅ PASS | Rating breakdown renders 5★=0, **4★=1**, 3★=0, 2★=0, 1★=0 — zero rows show "0" and the counts sum to the profile total (1) |
| Q12 | ✅ PASS | The submission entry point is removed after review (`review-button` replaced by "You have reviewed the seller"); DB confirms **exactly 1** review row for the trade, so no duplicate could be created |
| Q15/Q17 | ⚪ not driven | Reviewee-only report menu + "cannot flag own review" negative check need test-seller-3's own profile (persona switch not made within budget) |
| Q16 | ⚪ deferred (guide) | Confirmed **unreachable by construction** on staging: all **13** `review_reports` rows are **1 per review** (max `report_count` = 0, 1 review hidden) ⇒ the "3 distinct reports" precondition cannot occur under the reviewee-only model |
| Q18 | 🟡 PARTIAL | Admin **Review Moderation** page renders "Results (10 on this page) of **13 matching reviews**" with Search / reason filter (All Reports, Spam, Offensive Content, False Information, Other) / status filter / sort (Most Reports, Newest, Oldest) and per-row rating, comment, Review ID, Reviewer, Reviewee — consistent with the 13 `review_reports` rows. Per-report reason+timestamp expansion, count-descending sort verification and the "zero-report reviews do not appear" assertion were not completed |
| Q19/Q20 | ⚪ not driven | Approve-unhide (destroys all reports) and Delete are destructive against **non-QA** review data on shared staging; deliberately not driven. Both have prior PASS-on-record evidence from QA Task 31-T |

---

## 4. Findings (ranked)

| # | Severity | Finding |
|---|---|---|
| **F1** | **MEDIUM–HIGH** | **The Tax Settings page persists the platform-wide kill switch from form state with no diff-guard, and `sales_tax_enabled` was persisted `false` during this run without a deliberate toggle-tap on that switch.** The page's `save()` writes **all five keys** (`sales_tax_enabled`, `default_sales_tax_rate`, `subscription_fee_taxable`, `tax_remittance_jurisdiction`, `include_fee_in_tax_base`) from React state on every save, and `load()` defaults any missing/unexpected value to `false`. Evidence: `admin_config.sales_tax_enabled` had `updated_at 01:35:04 = true`, then the settings page rendered the switch **unchecked** and my next Save persisted `false @01:37:35` (all 5 keys share that timestamp). `calculate_tax()` then returned **$0 tax** (the disable path itself works). Restored + verified (`true`, round-trip stable). **Recommendation:** confirm/diff-gate platform-wide switches (or require an explicit "disable tax platform-wide" confirmation) and never write unrelated keys from a page-scoped form. |
| **F2** | **MEDIUM** | **34 pre-migration completed trades are still classified `quoted`** instead of `collected` (`completed` trades with `completed_at < 2026-07-23` → collected 16 / quoted 34 / voided 1). They are permanently reported as "pending/authorized" tax, which understates Tax Collected and inflates Pending Tax (O2-C12 FAIL). |
| **F3** | **MEDIUM** | **The `tax_exempt_goods` rule carries a `$0–$50` price threshold**, so `get_applicable_tax_rule(tax_exempt_goods, now, 6000)` returns **no rule** ⇒ an "exempt" item priced above $50 silently falls back to the node rate (i.e. becomes taxable). The same is true for the Clothing threshold rule. Worth a product/config decision (threshold vs. unbounded exempt category). |
| **F4** | **MEDIUM** | **Tax report internal inconsistency:** in one `get_tax_summary_for_period(... 'summary')` response the **header** says `tax_collected_cents = 0`, `tax_net_cents = −175` while `by_jurisdiction[CT]` says `tax_collected_cents = 175`, `tax_net_cents = 0` for the same window. One of the two aggregations is wrong. |
| **F5** | **LOW–MED** | **Overlap-validation error leaks a raw UUID:** *"Overlapping active tax rule exists for category e14198fb-1357-44f7-874e-e1fc831e331b and jurisdiction CT…"* — an admin-facing message should name the category ("General Tangible Goods"), not the id (R58 copy class). |
| **F6** | **LOW** | **Silent no-op on an empty category-mapping dropdown** (O1-C16): Save stays enabled and does nothing — no disabled state, no validation, no feedback. |
| **F7** | **LOW** | **Duplicate active rules coexist** for `general_tangible_goods` (v1 "NYC books taxes" NY 10% + v3 CT 6.99%). The resolver picks by `ORDER BY version DESC` and ignores jurisdiction entirely, so precedence depends purely on version numbers — a fragile invariant (deactivating v3 and creating a fresh v1 silently promoted the NY 10% rule in my first attempt). |
| **F8** | **LOW** | **Tax-Nodes invalid-rate validation uses a native browser `alert()`** ("Tax rate must be a number between 0 and 100 (percent).") instead of the inline-error pattern the guide expects (and the rest of the tax pages use) — it also wedged the browser automation until dismissed. |
| **F9** | **LOW** | **Denormalised review flags are stale:** `review_reports` has 13 rows and the admin queue lists 13 matching reviews, but every review has `report_count = 0` and `has_been_reported = false`. Anything consuming those columns (client badge, auto-hide-at-3) will misbehave; the admin page works only because it joins `review_reports`. |
| **F10** | **LOW** | **W12:** switching Trades tabs resets the status filter but **not** the search query. |
| **F11** | **LOW** | **Copy/pluralisation:** seller profile header renders **"(1 reviews)"**. |
| **F12** | **LOW** | **Guide drift (documentation, not product):** O1-C14 (8 vs 10 product categories; Clothing default mapping), O1-C05 ("all items default to general_tangible_goods"), P05 (date presets do not exist), P06 (7 report types vs 8 live tabs), P07/O3-C14 (CSV file name + unfiltered-sum equation), W07 (Total SP row), O3-C03 ("Sales Tax" vs "Sales Tax (6.99%)"), W09 warning copy. |
| **F13** | **INFO (process)** | The **Review** CTA on a completed trade sits partly under the floating tab bar (button y2273–2400 vs tab band y2190–2295) — still tappable at its centre, so a cosmetic overlap only. |
| **F14** | **INFO / tooling** | Playwright `click_element` actionability never passes on this admin build; DOM `.click()` via `run_playwright_code` is the working path (R81-adjacent). Also: a single `$eval`-free long `string_agg` result can be silently **truncated** in the tool output (my first `tax_rules` aggregate returned 5 of 10 rows) — always pair an aggregate with a `count(*)`. |

---

## 5. Perceived load times (§5.7 — wall-clock, ±polling interval; not a performance profile)

| Screen → transition | Elapsed | Note |
|---|---|---|
| `/tax/rules` → loaded (lazy table fill) | ~2.5–3.5 s | spinner → 10 rows |
| Rule create → save → result banner | 3.5 s | includes the overlap RPC round-trip |
| Rule edit → "new version" → refreshed table | 3.5 s | |
| `/tax/reports` → run summary | **4.0 s** | ≥3 s — flagged: a large aggregation RPC with only a spinner |
| Tax-rules status/category filter apply | ~1.1 s | instant, no reload (as the guide expects) |
| `/payments` → first page render | ~4.5–5.0 s | 100 rows |
| Partial refund → success alert | ~9 s | includes the real Stripe refund call |
| Android app cold start (Dev Launcher → bundle) | ~25 s | harness artifact (FIX-Task-17 F9 class), not a product finding |
| Android persona login → Dashboard | ~5 s | deep link warm |
| Trade detail → review screen | ~1.5 s | |

**Verdict:** FLAGGED — `/tax/reports` run (4.0 s) and `/payments` first paint (~4.5–5 s) exceed 3 s with only a spinner; the refund leg's ~9 s is dominated by the Stripe call.

---

## 6. Design & copy compliance (§6.4)

- **Admin tax pages:** consistently instrumented and laid out; no off-brand-hex issues found in the rendered admin screens (admin console is not governed by the mobile design system).
- **DEVIATION — Tax Rules overlap error:** raw category UUID in an admin-facing error (F5).
- **DEVIATION — Tax Nodes validation:** native browser `alert()` instead of the inline error used elsewhere on the tax pages (F8).
- **DEVIATION — Tax Settings:** platform-wide kill switch persisted from unrelated form state with no confirmation (F1 — structural, not cosmetic).
- **CONFIRMED — mobile SubmitReview screen:** single primary pill (`submit-review-button`) + a secondary "Skip for Now", `Rating *` required marker, live `0/500` counter, "You can edit your review within 24 hours of submission." footer — matches the documented form conventions.
- **CONFIRMED — in-app dialogs:** "Rating Required" and "Your review has been submitted!" both render through `GlobalAlertProvider` with the canonical green `#5DBB8E` pill (screenshot `AND-Q-09`), not OS-default chrome.
- **DEVIATION (minor) — seller profile:** "(1 reviews)" pluralisation (F11).
- **CONFIRMED — buyer Trade Timeline:** canonical detail header (round back button + centered title + bell/chat), `status-banner` Completed, Payment Details rows `Paid:` / `Swap Points Used:` / `Platform Fee:` / `Sales Tax (6.99%)` / `Total:`.
- App-wide off-brand-hex grep (R62b) was **not** re-run this round (no mobile screens were style-audited beyond the review flow) — owed.

---

## 7. App state left behind

- **Config writes (all reverted + DB-verified):** `sales_tax_enabled=true`, `include_fee_in_tax_base=false`, `default_sales_tax_rate=0.0635`, `charge_one_fee_per_bundle=true`; Norwalk Central node rate back to **6.35%**.
- **Tax rules — deliberate residue:** the QA-created `general_tangible_goods` versions `f45087b8` (v1 6.35% inactive), `45d2238c` (v2 6.99% inactive) and its replacement **v3 "Updated CT Tangible Goods Rate (v3)" 6.99% CT active from 2026-09-12**. Effective behaviour is **identical to pre-run** (`calculate_tax` → 0.0699/CT/$2.10) except that the active rule's `effective_from` is now 2026-09-12 instead of 2026-07-27. The rule originally deactivated in O1-C04 (`bc94b4e0` v3) remains **inactive**; the Category Mapping was changed to General Tangible Goods and **changed back** to Tax Exempt Goods for Books.
- **Bundle `6e06aa28`:** all 3 trades force-cancelled (W10) with the QA reason recorded — the 2 pending trades are freed; 0 refunds/payouts.
- **Trade `f2899f12`** (Bundle `73d5eb11`, buyer test-buyer): partially → fully refunded via K07/K08 — **Stripe refunds `re_3UEdW24I6kC…` (price $25.00) and the $1.75 tax refund**; `payments.status='refunded'`; trade stays `completed`; `tax_records.tax_status='refunded'`.
- **Test data added:** 1 review (`fba65691`, rating 4, 500-char comment, non-anonymous) on trade `4d50a44e` — **consumes that trade's review slot** for test-buyer (the second completed trade `f2899f12` still has a free buyer-review slot).
- **Mobile app** left logged in as **test-buyer**, on test-seller-3's Seller Profile screen. Admins: a fresh portal page is open; a second page instance (`c30d9a2f…`) is wedged with an un-dismissable native alert and can be closed.
- **Metro** `:8081` left running (single instance).

---

## 8. Recovery notes for the next session

- To resume Q04/Q05/Q15/Q17: log in as **test-buyer**, open `p2pkidsmarketplace://trade/f2899f12-7317-4ec3-9ddd-d8e51b3dd2c0` (scroll past the refund card — the review CTA sits **below** it), and use `anonymous-checkbox` for Q04. Swap to **test-seller-3** for the seller-side review (Q01/Q06) and the reviewee-only report menu (Q15/Q17) on **their own** profile.
- O-1 C06/C07/C15 need real listings created **before and after** a category-mapping flip (Books), plus the mapping restore.
- The tax-rule experiments must be done with the **version DESC** precedence in mind (F7): deactivating the active CT rule and creating a *new* rule (version 1) silently promotes the NY 10% rule.
