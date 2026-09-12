# QA Task — Verify FIX-Task-20, then finish Group Q + remaining tax legs

**Run folder:** `e2e-test-results/qa-fix20-verify-groupsq-taxlegs-2026-09-12/`
**Date:** 2026-09-12 · **Repo HEAD at start:** `9d623c4c` (unchanged; no repo writes this run)
**Devices / surfaces:**
- iOS Simulator **iPhone 17 Pro Max** `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E` (iOS 26.1, expo-dev-client) — **mobile legs driven on iOS this round**
- Live admin portal `http://localhost:3001` (real admin session, `samer@samer.com`), browser page `d8234aeb-…` (active)
- Supabase staging `drntwgporzabmxdqykrp` (read-only SQL for all DB assertions)

**R29 busy check (clean):** one `expo start` (Metro) instance; admin portal up on `:3001`; no `maestro` / `run-suite.sh` in flight; the only other process was an idle Playwright `test-server` for the admin config. No other QA/dev agent was driving the simulator or the admin session.

**Platform disclosure (R80):** every verdict in this report is an **iOS + admin-portal + DB/RPC** verdict. **Android is NOT claimed this round** (no Android verdict is reused or implied here). Prior-round Android evidence is cited only where explicitly labelled.

---

## 0. PHASE 1 — FIX-Task-20 verification

### 0.1 **[PRIORITY] Item 0 — Tax kill-switch save fix → ✅ PASS (both legs)**

**LEG A — an unrelated Tax Settings field can no longer carry the kill switch.**
Drove it independently of the dev-side check, using a *different* unrelated field (`subscription_fee_taxable`, true→false) on a freshly reloaded `/tax/settings` page:

| step | observed |
|---|---|
| pre | `enabled=true`, `subTax=true`, `feeInBase=false`, `jur=CT`, rate `6.35`, dirty marker absent |
| toggle subscription unchecked | dirty marker **"Unsaved changes (1): subscription_fee_taxable"** |
| Save | message **"Saved 1 setting: subscription_fee_taxable."** (names exactly one key) |
| DB after | `subscription_fee_taxable=false` @ **11:39:38.671546** (written) |
| DB after | `sales_tax_enabled` = **`true`, `updated_at` = **11:19:31.248497 — BYTE-IDENTICAL to the pre-run baseline** ✅ |
| DB after | `default_sales_tax_rate` 11:18:31, `subscription…` (other keys) `tax_remittance_jurisdiction` 01:38:43, `include_fee_in_tax_base` 01:38:43 — all **untouched** ✅ |

Restored immediately: `subscription_fee_taxable` → `true` @ 11:39:51 (message again named only that one key).

**LEG B — the kill switch now requires a distinct, explicit confirmation step.**

| step | observed | DB |
|---|---|---|
| uncheck `tax-enabled-toggle`, Save | modal **`tax-killswitch-confirm-modal`** appears — heading *"Turn off sales tax for the whole platform?"*, body *"This stops tax collection on every node … Buyers will be charged $0.00 tax on new orders. Trades that already exist keep the tax they were created with."*, buttons **"Keep tax on"** / **"Turn off sales tax"**; form shows the extra pending-change marker **"will change on save"** and "Unsaved changes (1): sales_tax_enabled" | **`sales_tax_enabled` still `true` @ 11:19:31.248497 — NO WRITE while the confirmation is open** ✅ |
| click **"Keep tax on"** (cancel) | modal closed, toggle reverted to ON, message **"Sales tax was left ON. No changes were saved."**, dirty marker cleared | **still `true` @ 11:19:31.248497 — cancel wrote nothing** ✅ (and 0 extra `admin_audit_log` rows: exactly 3 `update_tax_settings` audits for the 3 real saves) |
| re-open modal (evidence screenshot), click **"Turn off sales tax"** (accept) | modal closed, message "Saved 1 setting: sales_tax_enabled.", warning banner "⚠️ Sales tax is currently OFF…" | `sales_tax_enabled=**false**` @ **11:40:23.252275** ✅ |
| functional effect while OFF | — | `calculate_tax(node, 3000, general_tangible_goods, 3000)` → `{global_enabled:false, tax_rate:0, tax_amount_cents:0}` ✅ |
| re-enable, Save | **no modal** appeared (correct — only disabling is gated); "Saved 1 setting: sales_tax_enabled." | `sales_tax_enabled=true` @ **11:40:53.66252**; `calculate_tax` → `{tax_rate:0.0699, tax_amount_cents:210, global_enabled:true}` ✅ |

Baseline fully restored: `sales_tax_enabled=true`, `default_sales_tax_rate=0.0635`, `subscription_fee_taxable=true`, `include_fee_in_tax_base=false`, `tax_remittance_jurisdiction=CT`.

**Evidence:** `screenshots/ADM-ITEM0-killswitch-confirm-modal.png`, `screenshots/ADM-ITEM0-settings-after-legB-cancel.png`.

> Minor UX observation (not a defect): while the change is *pending* (unsaved), the "**Sales tax is currently OFF**" warning banner renders from form state, so the page can momentarily state that platform tax is off while it is still ON. The adjacent "will change on save" marker mitigates this; a pending-state variant of the banner ("Sales tax **will be** turned off on save") would remove the ambiguity.

### 0.2 Items 1–12 — spot checks

| item | verdict | evidence |
|---|---|---|
| **1 — historical backfill** | ✅ **PASS** | `completed` trades with `completed_at < 2026-07-23`: **`quoted = 0`** (was 34), **`collected = 50`** (was 16). Remaining `completed + quoted` = **9**, and all 9 are `payment_method='cash'`, `captured_at IS NULL`, `tax_amount_cents` summing to **$80.63** — i.e. exactly the disclosed, deliberately-excluded void-vs-collect set. |
| **2 — report header/breakdown reconciliation** | ✅ **PASS** | `get_tax_summary_for_period('2026-07-01','2026-09-12',null,'summary')` → header `tax_collected_cents 17143` / `tax_refunded 175` / `net 16968`; `by_jurisdiction[CT]` = **17143 / 175 / 16968** — **identical** (previously header 16968/175/16793). Also drove the **UI**: `/tax/reports` default 30-day window (2026-08-13→09-12) renders Taxable Sales **$468.00** · Tax Collected **$32.75** · Tax Refunded **$1.75** · Tax Voided **$105.30** · Net **$31.00** · Transactions **143**, and the CT row the same six figures — matching the RPC for that window (`46800 / 3275 / 175 / 10530 / 3100 / 143`) digit-for-digit (R54). |
| **3 — threshold decision** | ✅ **PASS (implemented + documented)** | `calculate_tax` live (Norwalk Central, global on): clothing **$25.00 → $0**, **$49.99 → $0**, **$50.00 → 318¢** (node rate 6.35%), **$60.00 → 381¢**; `tax_exempt_goods` **$60.00 → $0** (unbounded). Rule rows confirm the shape: `clothing_footwear` = "Under $50 (exempt)" `max=4999` + "$50 and over (taxable)" `min=5000`, and `Tax Exempt Goods V4` with `min/max = null`. Documentation: guide lines carry `🔄 Reconciled 2026-09-12 (FIX-Task-20 item 3)`. |
| **4 — rule precedence** | ✅ **PASS (with a residual owner-data item)** | Live `get_applicable_tax_rule` now ends `ORDER BY tr.effective_from DESC, tr.version DESC, tr.id ASC` (read from `pg_get_functiondef`) — a deterministic **total** order. Live resolution returns the **CT v3** rule (6.99%), not the stale NY rule. Read-only simulation over the live rule set + one synthetic candidate proves the last-round failure mode is gone: a *fresh* CT v1 created today sorts **above** the 2026-07-30 NY v1 (effective_from wins), so a newly created rule can no longer silently lose to an older rule on a version tie. **Residual (unchanged, still an owner DATA decision):** the stale `"NYC books taxes"` NY 10% rule is still `is_active=true` for `general_tangible_goods`, and jurisdiction is still **not** part of the resolver's match — so it is a latent hazard only if the CT rule is deactivated. |
| **5–11 (LOW fixes)** | ✅ **PASS** | see table below |
| **12 — guide corrections** | ✅ **PASS (spot-checked against shipped behavior)** | CSV download name is **`tax-transactions-2026-08-13-to-2026-09-12.csv`** (not `tax-export-…`); `/tax/reports` has **8** report-type tabs and **raw Start/End date inputs, no presets**; bundle detail heading is **"Bundle Admin Interventions"** and renders **only** for non-terminal bundles (in_progress = present; completed = absent); **"Total Swap Points Applied \| -16 SP"** row renders only when SP>0 (absent at 0 SP); breakdown arithmetic checks out on three bundles (50.00+1.49+2.38=53.87 · 19.00+1.49+1.33=21.82 · 53.00+1.49+3.22=57.71); `category_tax_mapping` still holds **10** rows; mobile tax label now reads **"Sales Tax, 6.99%, CT"** (prefix + rate). |

**Item-5–11 detail (the LOW findings F5–F11/F13/F14):**

| # | verdict | evidence |
|---|---|---|
| **F5** — overlap error leaked a raw UUID | ✅ **RESOLVED** | Attempted the overlapping create on `/tax/rules`; error now reads: *`A tax rule for "General Tangible Goods" (general_tangible_goods) in CT already covers the same price band and date range: "Updated CT Tangible Goods Rate (v3)" (2026-09-12 to open-ended). Deactivate that rule first, or give this rule a price band that does not overlap it.`* — **no raw UUID in the body**; table row count unchanged (14) ⇒ rejected create wrote nothing. Evidence: `screenshots/ADM-F5-overlap-named-message.png`. |
| **F6** — empty dropdown = enabled silent no-op | ✅ **PASS — prior FAIL NOT REPRODUCIBLE** | On `/tax/category-mapping`, clearing the row select leaves **Save `disabled`**; the click is a no-op; no error, no write. This satisfies the guide's "Save disabled **or** shows a validation error". Residual nit: no explanatory hint tells the admin *why* Save is disabled. |
| **F7** — fragile non-deterministic precedence | ✅ **RESOLVED** | See item 4 (deterministic total order live). |
| **F8** — native `alert()` on invalid node rate | ✅ **RESOLVED** | `/tax/nodes`, Buffalo row: rate **101** → inline per-row error *"Tax rate must be a number between 0 and 100 (percent)."*; rate **-1** → same inline error. `window.alert` was instrumented and recorded **zero** alerts (no browser wedge). DB confirms Buffalo unchanged (`tax_rate 0.0000`, `tax_enabled false`) ⇒ no write. Evidence: `screenshots/ADM-F8-nodes-inline-validation.png`. |
| **F9** — stale review report counters | ✅ **RESOLVED** | Live: 13 `review_reports` rows, **13/13** reviews with `report_count>0` and `has_been_reported=true` (was 0/13), **0 mismatched rows** (`report_count` == actual report rows for every review), and `check_review_reports()` is `prosecdef=true`. Admin `/reviews` shows "Results (10 on this page) of **13 matching reviews**" with 🚩 "1 report" badges. Evidence: `screenshots/ADM-F9-review-moderation-queue.png`. **Plus a live in-app regression proof:** a *new* report filed from the mobile app by the reviewee incremented the counter correctly → `report_count=1`, `has_been_reported=true` (see Q15 below) — the exact path that used to silently no-op. |
| **F10 / W12** — tab switch didn't clear search | ✅ **PASS — prior PARTIAL NOT REPRODUCIBLE** | `trades-search-input` now exists (testability fix landed). It is rendered **only in the Single-Trades view** (`initialView !== 'bundles'`), so switching to Bundle Trades necessarily unmounts it and the URL drops `status` (`/trades?status=completed` → `/trades?view=bundles`). Both reset ⇒ W12 expectation met. |
| **F11** — "(1 reviews)" pluralisation | ✅ **FIXED** | Public SellerProfile for a user with exactly **1** received review renders **"(1 review)"** (singular) + "Reviews (1)". Evidence: `screenshots/IOS-Q17-public-profile-no-report-menu-1review-singular.png`. |
| **F13 / item 16** — Review CTA under the tab bar | ✅ **FIXED (verified on iOS)** | See the R79-1 note below — after a forced cold reload the Trade Timeline renders **Reviews (y499) → Payment Details (y694) → Refund (y938) → Message (y1177)**, i.e. the Reviews card + `review-button` are now hoisted **above** Payment Details, clear of the floating tab band. |
| **F14** — admin tooling | ✅ **STILL TRUE (environment, not an app defect)** | `click_element`/`hover_element` actionability continued to fail on this admin build; all admin driving used `run_playwright_code` with DOM `.click()`. Also confirmed again: an aggregate result can be truncated — pair with `count(*)`. |

### 0.3 ⚠️ R79-1 friction event — a **stale dev bundle** initially looked like an unfixed defect

The first Trade-Timeline read (before any reload) showed the **old** order — Payment Details at y499 and Reviews at y1062 — even though `TradeTimelineScreen.tsx:2091` already places the Reviews card before Payment Details. Per R79-1 the app was terminated + relaunched; the relaunch logged `Bundling 42%… → 98%…` (a genuinely fresh bundle) and the **same** screen then rendered **Reviews at y499 / Payment Details at y694** — the fixed order. This is recorded because it is a cheap way to *falsely fail* a verified fix: **always cold-reload before judging a layout fix on a dev client, and confirm the fresh bundle with a discriminating check** (here: which card is at y≈499).

### 0.4 Item 13 / 14 / 15

| item | verdict | evidence |
|---|---|---|
| **13 — report auto-run + skeleton** | ✅ **PASS** | `/tax/reports` renders a fully-populated summary on mount with no "Run Report" tap (window auto-selected 2026-08-13→09-12); `tax-report-skeleton` is present in source for the first aggregation. |
| **14 — per-key provenance refresh** | ✅ **PASS** | After saving only `subscription_fee_taxable`, its `last-updated-subscription_fee_taxable` label advanced (…→ 9/12/2026, 7:39:51 AM) while the other keys' labels stayed put. |
| **15 — payments disclosure phrasing** | ✅ **PASS** | `/payments` summary card reads **"Payments (this page) / 100 / of 890 matching"**, and it recomputes with the filter (see K09 below). |

---

## 1. PHASE 2 — Group Q + tax legs

### 1.1 Group Q — verdicts

Fixture: bundle `73d5eb11` (buyer **test-buyer** `49243010…`, seller **test-seller-3** `…0012`), completed trades **`4d50a44e`** (already reviewed) and **`f2899f12`** (free buyer-review slot).

| TC | verdict | evidence |
|---|---|---|
| **Q01** | ✅ **PASS (both sides)** | Seller side driven live on iOS: completed-trade detail shows the review CTA → `SubmitReview` screen titled **"Review the buyer"** (buyer side was "Review the seller" last round). Both sides derive the label from `isBuyer`, and both navigate to the counterparty-specific SubmitReview screen. **Doc/UX note:** the title renders the *role* ("the buyer") rather than the counterparty's **name**, and the CTA's `accessibilityLabel` is the generic `"Review button"` while its visible text is partner-specific — a screen-reader user loses the distinction. |
| **Q04** | ✅ **PASS** | As **test-buyer** on `f2899f12`: checked **Post anonymously**, selected 5★, submitted → *"Your review has been submitted!"* → DB: `rating=5`, **`is_anonymous=true`**. Reviewee side (test-seller-3 own profile → Reviews): card renders **"Anonymous User"** with an **"AU" initials placeholder** (not the buyer's photo) and no other PII. Evidence: `IOS-Q04-anon-5star-before-submit.png`, `IOS-Q04-review-submitted-alert.png`, `IOS-Q04-Q15-own-profile-reviews-anonymous.png`. |
| **Q05** | ✅ **PASS** | On the still-free `f2899f12` slot: tapped **"Skip for Now"** → returned **immediately** to the Trade Timeline with no error, no modal, no blocker; the Reviews section still offered the review CTA; DB confirmed **0** review rows for that trade ⇒ skip wrote nothing. Reopening the trade re-shows only the persistent CTA (no re-prompting modal). |
| **Q06** | ✅ **PASS (both sides, full lifecycle)** | **Buyer, pre-seller-review:** "✓ You have reviewed the seller" + "✗ The seller hasn't reviewed you", CTA replaced by the status label. **Seller, before reviewing:** "✗ You haven't reviewed the buyer" + "✓ The buyer has reviewed you" + CTA present. **After the seller submitted 4★:** "✓ You have reviewed the buyer" + "✓ The buyer has reviewed you", CTA gone. DB: exactly 2 reviews on `f2899f12` (buyer 5★ anon, seller 4★), 1 per party. |
| **Q15** | ✅ **PASS** | On test-seller-3's **own** profile, the review written about them exposes the overflow (`review-menu-button`); tapping it opens exactly **4** reason rows — `review-report-spam` "Report as Spam", `review-report-offensive` "Report as Offensive", `review-report-false-info` "Report False Information", `review-report-other` "Report Other". Chose Offensive → confirm dialog "Report Review / **Report this review as Offensive Content?**" (Cancel/Report) → success alert **"Review reported. Thank you!"**. DB: `review_reports` row `97b76c1e`, `reason='offensive'`, `reporter_id = the reviewee`; **`report_count` 0→1** and `has_been_reported=true` (the F9 fix working in-app); **`is_hidden=false`** ⇒ review stayed visible; `review_status` → `pending_review` (the intended 1-report moderation state — visibility is governed by `is_hidden`, not `review_status`). Evidence: `IOS-Q15-report-confirm-dialog.png`. |
| **Q16** | ✅ **CONFIRMED STILL ACCURATE (not re-attempted)** | Whole-table check: **`reviews_with_gt1_report = 0`** — no review anywhere on staging has more than 1 report, and the 13 remaining `review_reports` rows are 1-per-review. Under the reviewee-only model the single reporter is the reviewee, so the "3 distinct reporters" precondition remains **unreachable by construction**. |
| **Q17** | ✅ **PASS** | Public `SellerProfile` of another seller (bob.samer.demo@example.com, 1 review): the tree contains **no `review-menu-button`** anywhere ⇒ a non-reviewee never sees a report affordance (`SellerProfileScreen` hard-codes `showReportMenu={false}`), and a reviewer cannot flag their own review. Evidence: `IOS-Q17-public-profile-no-report-menu-1review-singular.png`. |
| **Q19** | ✅ **PASS (driven for real on QA-owned data)** | Exercised on the **QA-owned** review created this round (`44f5662f…`, 1 report → `pending_review`), so no shared data was touched. Admin queue showed it with `Keep`/`Hide` actions; clicking **Keep** raised the native confirm **"This will keep the review visible, reject all reports, and notify everyone who reported it. Continue?"** → accepted. DB after: **`report_rows = 0`** (all reports deleted), **`report_count = 0`**, `has_been_reported = false`, **`is_hidden = false`** (review kept visible), `review_status = 'reviewed'`. Row vanished from the rendered queue. **Doc drift:** the guide's Q19 expects the prompt *"This will unhide the review and delete all reports."* with an **[Approve]** button — the shipped copy/button are **"Keep"** / the sentence above. Evidence: `ADM-Q19-queue-before-keep.png`. **Minor UI note:** the page's "of **14** matching reviews" header did not decrease after the action (the row is removed locally but the total is not refetched) — an R59-class staleness nit. |
| **Q20** | ⚠️ **NOT IMPLEMENTED / NOT RE-DRIVEN** | Source + UI inspection of the moderation queue shows **no Delete affordance at all** — the only actions are **Keep** and **Hide** (`reviews/page.tsx` L491/L499; no delete route under `api/reviews/[reviewId]/`). The guide's Q20 ("admin deletes a reported review", "cannot be undone") therefore has **no shipped equivalent to drive**; the shipped destructive-equivalent is **Hide** (which merely hides + notifies reporters), and the tracker already records Q20 as "Hide" with prior PASS-on-record evidence (2026-08-30). Not re-driven this round because the review leaves the queue once kept (report_count returns to 0), so exercising Hide requires re-reporting to re-enter the queue — see Suggested Next Session. |
| **Q10 / Q11 / Q13 / Q14** | ⚠️ **NOT TESTABLE — NOT IMPLEMENTED (source-verified, stronger than "time-dependent")** | `src/services/review.ts` has **no update/edit path at all** (`submitReview` inserts; `canReviewUser` only checks trade-completed + not-already-reviewed) and the app ships **no** Edit Review affordance, so Q10 (edit within 24h) and Q11 (edit blocked after 24h) have nothing to drive. Likewise **no** 30-day same-counterparty cooldown (Q13) and **no** 24h post-completion lock (Q14) exist in either `submitReview` or `canReviewUser` — both are "locked until completed / already reviewed" only. **New copy finding:** `SubmitReviewScreen.tsx:326` tells the user *"You can edit your review within 24 hours of submission."* while **no edit capability exists anywhere in the app** — see Critical Findings. |
| **Q02 / Q03 / Q07 / Q08 / Q09 / Q12 / Q18** | ✅ **RE-CONFIRMED incidentally** | Q02/Q03: the SubmitReview screen's `submit-review-button` still carries only `disabled={submitting}` (not rating-gated) ⇒ the Q02 "alert instead of disabled" behaviour is unchanged; `comment-input` + `char-count` present. Q08/Q09 re-confirmed on test-seller-3's profile post-change: **"Reviews (2)"**, average **"4.5"**, "Based on 2 reviews", breakdown 5★=1 / 4★=1 / 3★=0 / 2★=0 / 1★=0 (sums to 2) and on the 1-review profile 5★=1 + "(1 review)". Q12: 1 review per party per trade enforced (2 rows, one per reviewer). Q18: moderation queue still lists reported reviews with reason + counts (see F9/Q19). |

### 1.2 Item 17 (mobile copy fix) — ✅ PASS

`SubmitReviewScreen` now surfaces the cap **before** typing: the comment field's placeholder is **`0/500`** and the counter under it reads **`0/500 characters`** at 0 characters (previously the placeholder duplicated the subtitle and the cap only appeared while typing).

### 1.3 Phase 2c — the two QA-side errors from last round, retested correctly → **both PASS**

| leg | verdict | evidence |
|---|---|---|
| **K09 search leg** | ✅ **PASS** | Typed `ebcd1c46` into the **page's own** `payment-search` field (placeholder "Search trade id, PI id, or bundle id…"), i.e. *not* the topbar global ⌘K search: the table narrowed to exactly **1** row (that bundle trade) and the summary strip recomputed to **"Payments (this page) 1 of 1 matching · Total Charged $7.00 · Net Collected $7.00"**. Clearing the field restored **"100 of 890 matching · Total Charged $2769.36 · Total Refunded (1) $26.75 · Net Collected $2742.61"** (and 2769.36 − 26.75 = 2742.61 ✓, consistent with last round's K07/K08 refunds). |
| **W12 search-reset leg** | ✅ **PASS** | See F10/W12 above — the search input exists only in the single view, so switching to Bundle Trades clears the search and drops the `status` filter. |

### 1.4 Phase 2b — O-1 C06 / C07 / C15 → **NOT REACHED this round (explicit)**

Each requires **live in-app listing creation** (C06 one single listing; C07 a bulk listing of 2+ items; C15 **two** listings created either side of a Books mapping flip), and C15 additionally needs a real admin `category_tax_mapping` change plus a restore. After the Phase-1 verification surface (item 0 + all 12 items) and the full Group-Q set, the remaining budget did not allow three listing-creation flows plus a mapping flip at a quality that would produce a trustworthy verdict, so these were **not** half-driven. **Missing legs named explicitly (R13):** C06 = 1 single-listing creation + its `tax_category_id` read-back; C07 = 1 bulk creation (2+ items) + per-item read-back + My-Listings visibility; C15 = the 2-listing before/after pair across one Books mapping flip (flip → verify → restore). All three remain on the tracker as never-run.

### 1.5 Phase 2d ("if budget allows") → **not driven**

O-2 C04/C05/C11, O03/O04/O06/O07/O08, R03/R04 and the K02 first-trade leg were not reached — budget consumed by Phase 1 + Group Q + the two 2c retests. No verdict is claimed for any of them.

---

## 2. Findings (ranked)

| # | Severity | Finding |
|---|---|---|
| **N1** | **LOW–MED** | **Copy promises a capability that does not exist.** `SubmitReviewScreen.tsx:326` renders *"You can edit your review within 24 hours of submission."* but the app has **no** edit-review affordance or service call anywhere (no `updateReview`, no Edit button, no editable SubmitReview route). A parent who submits a typo'd review is told they can fix it and cannot. Either ship the edit path (which would also make Q10/Q11 testable) or drop the sentence. |
| **N2** | **LOW** | **Guide/tracker drift on Group Q's deferred cases.** Q10/Q11/Q13/Q14 are recorded as *"time-dependent, descoped"*; source shows they are **not implemented** (no edit path, no 30-day counterparty cooldown, no 24h post-completion lock). Q20 is recorded as "Admin deletes a reported review" but **no delete affordance ships** (Keep/Hide only). Recommend relabelling these rows as *not-implemented-by-construction (source-verified 2026-09-12)*. |
| **N3** | **LOW** | **Q19 copy/button drift:** the shipped confirmation is *"This will keep the review visible, reject all reports, and notify everyone who reported it."* with a **[Keep]** button; the guide expects *"This will unhide the review and delete all reports."* with **[Approve]**. |
| **N4** | **LOW** | **A11y: the review CTA's accessibility label is generic.** `review-button` has `accessible`/`accessibilityRole="button"` but `accessibilityLabel="Review button"`, while its visible text is "Review the Buyer"/"Review the Seller". A VoiceOver user cannot tell which party they are about to review. Same family: the SubmitReview screen title renders the *role* ("Review the buyer") rather than the counterparty's name. |
| **N5** | **LOW (UX/copy)** | **Pending vs applied state on Tax Settings.** Un-ticking the global switch immediately renders the red "**Sales tax is currently OFF.** No tax will be applied…" banner while the change is still unsaved (the separate "will change on save" marker + "Unsaved changes" line do disambiguate). Suggest a pending-tense variant. |
| **N6** | **LOW (staleness / R59 class)** | After an admin moderation action, `/reviews` removes the row locally but leaves the header at *"of 14 matching reviews"*. Either refetch the total or label the header as of-load. |
| **N7** | **INFO (owner data decision, carried forward)** | The stale `"NYC books taxes"` **NY 10%** rule remains `is_active=true` for `general_tangible_goods` alongside the live CT rule. The resolver's total order is now deterministic, but **jurisdiction is still not part of the match**, so the NY rule is a latent mis-taxation hazard if the CT rule is ever deactivated. Recommend deactivating it (data change, not code). |
| **N8** | **INFO (tooling / R79-1)** | A **stale dev bundle** can make a shipped layout fix look unfixed: the pre-reload Trade Timeline rendered the old ordering. Always terminate + relaunch and confirm the fresh bundle with a discriminating check before judging a layout fix (evidence: `Bundling 42%→98%` then the corrected order). |
| **N9** | **INFO (opacity/consistency, low)** | Public seller profile showed **"Completed Trades 0"** next to a **"(1 review)"** header for the same user — the denormalised completed-trade counter disagrees with the review evidence (also seen earlier as `nodes.member_count` staleness). Not a Q-case failure; worth a data-integrity pass. |

**Phase-1 findings that are now closed** (kept for the record, all re-verified this round): F5 resolved · F6 not reproducible (Save disabled) · F7 resolved (deterministic order) · F8 resolved (inline validation, no `alert()`) · F9 resolved (+ live in-app regression proof) · F10/W12 not reproducible · F11 fixed · F13/item 16 fixed · F14 confirmed as environment tooling.

---

## 3. Perceived load time (§5.7 — "simulator, wall-clock, ±polling-interval precision", NOT a formal performance profile)

⚠️ **Disclosure (R50):** a systematic per-transition stopwatch table was **not** captured this round; the entries below are the transitions that were actually observed with a timestamped read, plus the environment artifacts that were measured deliberately. No transition was flagged ≥3s as an app-behaviour issue.

| screen → transition | elapsed | note |
|---|---|---|
| iOS Landing → Home after `qa-login-as` persona deep link | ≲2 s | app already warm |
| iOS Home → Trade Timeline after `trade/<id>` deep link | ≲2 s | warm deep link, no intermediate hop |
| Trade Timeline → `SubmitReview` (review CTA tap) | ≲2 s | first read after tap already showed the populated screen |
| SubmitReview → success alert (review submit) | ≲2 s | `GlobalAlertProvider` alert with the OK button already in the tree |
| iOS **cold dev-client reload** (`terminate` → `launch`) | **~40 s** | **environment artifact** — dev-bundle `Bundling 42% → 98%`; not app behaviour |
| Admin `/tax/reports` mount → populated summary | ~3–4 s | **environment artifact** — local Next.js dev server + first aggregation; the shipped skeleton exists precisely for this gap |
| Admin page navigations (`/tax/*`, `/trades*`, `/reviews`, `/payments`) | ~2.5–4 s each | **environment artifact** — dev-server render, no user-visible spinner gap observed |

---

## 4. Execution trace (condensed) + evidence

Full ordered tool trace is in `ledger.md`. Screenshots in `screenshots/`:

| file | what it shows |
|---|---|
| `ADM-ITEM0-killswitch-confirm-modal.png` | the **new** explicit kill-switch confirmation modal (item 0 LEG B) |
| `ADM-ITEM0-settings-after-legB-cancel.png` | post-Cancel state: toggle back ON, "Sales tax was left ON. No changes were saved." |
| `ADM-F5-overlap-named-message.png` | F5: overlap rejection naming the category (no raw UUID), row count unchanged |
| `ADM-F8-nodes-inline-validation.png` | F8: inline per-row rate validation with zero native `alert()` |
| `ADM-F9-review-moderation-queue.png` | F9: "of 13 matching reviews" + report badges |
| `ADM-Q19-queue-before-keep.png` | Q19: QA-owned reported review in the queue with Keep/Hide |
| `ADM-bundle-detail-sp0-row-absent.png` | item 12: conditional "Total Swap Points Applied" row absent at 0 SP |
| `IOS-Q-trade-deeplink-landing.png` | Trade Timeline landing (pre-reload ordering) |
| `IOS-Q-after-cold-reload.png` | cold-reload splash (`SplashScreenLegacy`) — R79-1 evidence |
| `IOS-Q05-Q04-submit-review-screen.png` | SubmitReview screen: `0/500` placeholder + `0/500 characters` (item 17) |
| `IOS-Q04-anon-5star-before-submit.png` | anonymous checked + 5★ selected before submit |
| `IOS-Q04-review-submitted-alert.png` | "Your review has been submitted!" |
| `IOS-Q04-Q15-own-profile-reviews-anonymous.png` | Q04: "Anonymous User" + AU placeholder on the reviewee's own profile; Q15 menu |
| `IOS-Q15-report-confirm-dialog.png` | Q15: "Report this review as Offensive Content?" confirm dialog |
| `IOS-Q17-public-profile-no-report-menu-1review-singular.png` | Q17 no report menu on a public profile + F11 "(1 review)" singular |

---

## 5. Tracker note (R52/R57 — the known gap the brief asked to flag)

`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` was updated for the rows this round touched (Group Q `Latest`/`Date`/`Source`/`Notes`, plus corrected reasons for Q10/Q11/Q13/Q14/Q20). **Per the brief's own instruction, the tracker's structural gap is flagged, not silently worked around:** the **O-1 / O-2 / O-3 sub-cases have no individual rows** — their verdicts live only in the round notes, so a FAIL/PASS there can never appear as a row flip. This round again produced O-group verification content (items 1–4, F5–F11, item 12) that has **no row to write to**. Recommend a consolidation pass that materialises the O-1/O-2/O-3 sub-case rows (and the W/K/Q rows are already individually tracked).

**Also flagged for the consolidation pass:** the FIX-Task-20 verification results (item 0 + items 1–15) are **fix-verification evidence, not test-case verdicts**, so they were recorded in this round note + the tracker's dated FIX-Task-20 note rather than as Q/O row flips.
