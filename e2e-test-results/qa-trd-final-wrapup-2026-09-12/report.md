# QA Task — TRD Final Wrap-Up: All Remaining Groups

**Run folder:** `e2e-test-results/qa-trd-final-wrapup-2026-09-12/`
**Date:** 2026-09-12 · **Repo HEAD at start:** `9d623c4c` (unchanged; no app/repo writes this run)
**Devices / surfaces:**
- Android emulator **`Medium_Phone_API_36.1`** (x86_64, API 36, expo-dev-client) — `emulator-5554`. **The only mobile device driven this round.**
- Live admin portal `http://localhost:3001` (real admin session, `samer@samer.com`), browser page `d8234aeb-…` (**active**). Dev server was **restarted** mid-run (see §3.1).
- Supabase staging `drntwgporzabmxdqykrp` (read-only SQL for all DB assertions).

**R29 busy check (clean at start):** two Metro instances (`expo start` on **8081** and **8082**), admin portal up on `:3001`, iOS Simulator `iPhone 17 Pro Max` booted but **not driven**, no `maestro` / `run-suite.sh` in flight. Per the 2026-09-10/11 precedent the second Metro on `:8082` was treated as an expected multi-session state and **not** killed.

**Platform disclosure (R80):** every verdict in this report is an **Android emulator + live admin portal + DB** verdict. **iOS is NOT claimed this round** (no iOS leg was driven; the iOS verdicts from `qa-fix20-verify-groupsq-taxlegs-2026-09-12/` are cited only where explicitly labelled).

---

## 0. Budget reality (read this first)

The dispatch covers ≈100+ rows across 15+ groups. **This session reached Priority 1 in full (except one fixture-blocked leg) and a slice of Priority 2; Priorities 3 and 4 were not started.** The stopping point is stated explicitly in §6 rather than thinned out. The single most consequential output of the round is a **reproducible admin defect that blocks the Q19/Q20 restore path** (§2, finding N1).

---

## 1. PRIORITY 1 — O-1 Listing-Creation Batch + Q19/Q20 carryovers

### 1.1 `TRD-TC-O1-C06` — new single-listing creation receives its mapped tax category → ✅ **PASS** (Android)

Driven on Android as **test-seller** via `p2pkidsmarketplace://create-item`:

| step | observed |
|---|---|
| `dev-fill-item` | title "QA Dev Fixture Item", price $20, condition new, 1 photo injected (`(1/10 photos)`) |
| real `category-select-button` → **`CategorySelectModal` IS AX-drivable on Android** | full list rendered with bonus badges on Books ⭐ / Toys ⭐ / Electronics ⭐ / Art & Crafts (none on Games/Sports/Clothing/Other/Shoes/Bookies) — picked **Games** |
| `publish-button` | "Submitting Item For Review…" → success modal **"Thanks for submitting!"** + *"To ensure the marketplace is safe and free of offensive items, we are going to review your item and approve it…"* → **Go To My Items** → My Listings shows **PENDING** + *"Awaiting approval — this item is under review and will go live once approved."* |
| DB read-back | item **`591053d3-bc6f-405d-8deb-175a36c19c49`**, category **Games**, `tax_category_id` → **`general_tangible_goods`** ✅ (matches the guide's expected key) |

**Discoverable/purchasable limb — named explicitly (R13):** the item is `pending` (admin-approval gate), so it is deliberately **not** in the public feed yet; the flow's approval→available transition is already covered by Group L (2026-09-08, iOS+Android). Not re-driven here.

### 1.2 `TRD-TC-O1-C07` — new bulk-listing creation receives its mapped tax category → 🟡 **BLOCKED (fixture + environment)**, no verdict

Two independent attempts, both blocked, with the missing leg named:

1. **Dev-fixture path (fast):** `bulk-create` → intro sheet → `dev-add-test-photos` (5/30) → `bulk-reset-grouping` (5 items) → `dev-set-item-categories` + `dev-fill-bulk-items` → `dev-skip-to-review` → "Review 5 items" / "Bulk Listing SP Summary: Included 5 · SP-enabled 0" → `bulk-publish-button` → confirm sheet *"Confirm Submission / Items to submit for review: 5"* with 5 rows "$20 · Ready" → **Submit for Review** → alert **"Cannot submit for review / Missing bulk session or draft session."** — the dev fixtures create items + grouping but **not** the server-side bulk session, so the submit is rejected before any item row is written (DB confirmed: no new items).
2. **Real photo-picker path (the only way to a genuine bulk session):** opened the Android system photo picker → **"No photos yet / Start capturing photos and videos"** — the emulator gallery was empty. I then populated MediaStore from the host (`adb push <app assets> /sdcard/Pictures/QA` + `content call … scan_file`; MediaStore read-back showed **12 images**), but the picker did **not** surface them on an in-place re-entry within bounded attempts. Recorded as a tooling/environment gap (§2, N4) rather than retried.

**Missing leg (R13):** one real photo-picker-driven bulk creation of 2+ items → per-item `tax_category_id` read-back + My-Listings visibility. Remains on the tracker as never-run. **This is the same known fixture caveat recorded in 43g K05 — not a new product defect.**

### 1.3 Books `category_tax_mapping` flip (admin portal, live) → ✅ **PASS**

Driven through the admin UI on `/tax/category-mapping` (DOM `.click()` via `run_playwright_code`, per the recurring admin click-actionability environment note):

| step | observed |
|---|---|
| before | `Books · Tax Exempt Goods(tax_exempt_goods) · Sep 11, 2026` |
| Change → select *General Tangible Goods* → Save | **"Mapping updated. New listings will use the updated tax category."** |
| after (table) | `Books · General Tangible Goods(general_tangible_goods) · Sep 12, 2026` |
| DB read-back | `books_map_key = general_tangible_goods`, `updated_at = 2026-09-12T21:35:04.54393Z`, **`admin_audit_logs` row `category_tax_mapping_changed` @ the same timestamp** ✅ |

### 1.4 `TRD-TC-O1-C15` — mapping change affects new listings immediately → ✅ **PASS (all 7 steps, Android + admin + DB)**

| # | guide step | result |
|---|---|---|
| 1 | Books was mapped to Tax Exempt Goods | ✅ (recon + admin row) |
| 2–3 | **pre-flip** Books listing created → `tax_exempt_goods` | ✅ item **`c1b3cd63-1d00-4f78-bef3-707c56166dca`** (created 21:34:39Z), category Books, `tax_category_id` → `tax_exempt_goods` |
| 4 | admin flips Books → General Tangible Goods | ✅ §1.3 |
| 5–6 | **post-flip** Books listing created → `general_tangible_goods` | ✅ item **`ba961cae-d16f-4487-8444-45ec505506d3`** (created **21:35:55Z** — **51 s** after the mapping write), category Books, `tax_category_id` → `general_tangible_goods` |
| 7 | first listing unchanged (not retroactively updated) | ✅ `c1b3cd63` still `tax_exempt_goods` |
| — | *"No deploy needed — change is immediate"* | ✅ |
| — | **restore** | ✅ Books → `Tax Exempt Goods(tax_exempt_goods)` via the admin UI; DB read-back `tax_exempt_goods`, `updated_at 21:36:08.889Z`, mapping table still **10** rows |

### 1.5 `TRD-TC-Q20` — admin hides a reported review → ✅ **PASS** (Android + live admin + DB + reporter notification)

**Setup (Android, test-seller-3 = the reviewee):** own profile → Recent Reviews → the reviewee-only overflow `review-menu-button` (present on **both** review cards) → 4 reason rows (*Report as Spam / Report as Offensive / Report False Information / Report Other*) → **Report as Offensive** → confirm dialog *"Report Review / Report this review as Offensive Content?"* (Cancel / Report) → success alert **"Review reported. Thank you!"**. DB: `review_reports` row `f19a333c`, `reporter_id` = the **reviewee**, `reason='offensive'`; review `44f5662f` → `report_count 0→1`, `has_been_reported=true`, `review_status='pending_review'`, `is_hidden=false`.

**Hide (admin `/reviews`, live):**

| assertion | observed |
|---|---|
| confirmation dialog copy | *"This will remove the review and notify everyone who reported it. Continue?"* (native `window.confirm`; overridden before triggering per ADM-R6) ✅ |
| after confirm — row stays in queue, badged **"Hidden"** | ✅ row text changed `Pending Review` → **`Hidden`**; `rowStillPresent = true` |
| queue total does **not** drop | ✅ *"Queue updated just now · 14 in queue"* before **and** after |
| DB read-back | `is_hidden = true`, `review_status = 'hidden'`, `report_count` still `1`, **`review_reports` row still present** (Hide leaves reports in place) ✅ |
| review not visible publicly | ✅ reviewee's public **SellerProfile went "Reviews (2)" → "Reviews (1)"** with breakdown 5★ 1→**0** / 4★ 1→1, and the anonymous 5★ card disappeared |
| reporter notified | ✅ `user_notifications` row `565c26cf`, `type='review_report_hidden'`, title **"Review removed"**, body *"The review you reported has been removed…"*, `created 21:38:52.912Z` (= the Hide), `is_read=false` |

### 1.6 `TRD-TC-Q19` — admin keeps a reported review → 🔴 **FAIL on Android (Keep does not persist) + reporter-notification leg NOT re-observed**

Driving **Keep** on the same review (the only shipped route back), from the admin queue:

- `/api/reviews/44f5662f…/keep` → **HTTP 200 with body `{"success":true}`**;
- then the page refetches `/api/reviews/reported`, which **still returns `report_count: 1`, `is_hidden: true`, `review_status: "hidden"`**;
- DB unchanged: `is_hidden = true`, `report_count = 1`, `review_report_kept` rows for this review in the last 40 min = **0**; queue headline stays **14**; the row **never leaves the queue**.

**Reproduced 4×, including on a freshly restarted admin dev server** (§3.1). Two further anomalies captured:

1. The served response body (`{"success":true}`) does **not** match `p2p-kids-admin/src/app/api/reviews/[reviewId]/keep/route.ts`, which returns `{success, message:'Review kept successfully', review_status, reporters_notified}`.
2. The admin dev server log shows the `GET /api/reviews/reported` calls but **no `POST …/keep` entry at all**, and **no compiled `keep` route** exists under `.next/server/app/api/reviews/[reviewId]/` (the sibling `hide` route *did* compile there when it was used). There is **no catch-all route** and **no service worker / MSW registration** in `p2p-kids-admin/src`.

⇒ The Keep mutation is not reaching a working handler. **Recorded as a defect (finding N1) with the raw evidence rather than root-caused further** — execution-only boundary. The **Q19 reporter-notification leg therefore could not be asserted this round**; the source path is `create_system_notification_with_preferences` with `p_type='review_report_kept'`, and the only surviving witness is the **11:53:24Z `review_report_kept` row** created by this morning's successful iOS Keep — which is itself the strongest evidence that Keep *was* working earlier today.

**⚠️ Residue (unavoidable):** review `44f5662f` is **left hidden** because the restore path is broken; the reviewee's public profile is therefore showing 1 review instead of 2. This is flagged as residue caused by N1, not left silently.

---

## 2. PRIORITY 2 (partial) — Group Q Android legs

The dispatch's core Group Q ask — "redo Q01/Q04/Q05/Q06/Q15/Q17/Q19 **on Android**" — was met for **Q01, Q04, Q05, Q06, Q15, Q17** (plus Q20 via §1.5). **Q19's Android leg is the exception** (§1.6).

Cold-reload discipline: the Android dev client was running a **stale bundle** (its `char-count` still read the pre-fix copy) ⇒ per **R79-1** the app was terminated + relaunched from the Dev Launcher (chose `http://10.0.2.2:8081`) and **every verdict below was re-taken on the fresh bundle**, confirmed by a discriminating check (the FIX-Task-21 item-2 title now renders the counterparty's **name**: *"Review Test Buyer"* / *"Review Test Seller"*).

| TC | platform | verdict | evidence |
|---|---|---|---|
| **Q01** | Android | ✅ **PASS (seller side)** | completed-trade detail exposes `review-button` labelled **"Review the Buyer"**; tapping it opens `submit-review-screen` titled **"Review Test Buyer"** with rating stars + `comment-input` + `anonymous-checkbox` + `submit-review-button` + `skip-review-button`. Buyer-side variant ("Review the Seller") confirmed on the second trade. |
| **Q04** | Android | ✅ **PASS** | as **test-buyer** on a free slot (trade `47bdab0a`): ticked **Post anonymously**, chose **5★** → Submit Review → DB row **`15363fc3-d129-4637-839f-211a7aba6311`**: `rating=5`, **`is_anonymous=true`**. (First attempt failed — see N2 — and succeeded on the immediate retry.) |
| **Q05** | Android | ✅ **PASS** | on the seller-side free slot: **Skip for Now** → returned **immediately** to the Trade Timeline, no error/modal/blocker, the `review-button` CTA **still present** (slot not consumed) and no re-prompt. DB: review count on that trade stayed **1** (the existing buyer review) ⇒ skip wrote nothing. |
| **Q06** | Android | ✅ **PASS (both branches)** | **both unreviewed** (buyer view, trade `47bdab0a`): "✗ You haven't reviewed the seller" + "✗ The seller hasn't reviewed you" + CTA. **Buyer-reviewed / seller-not** (seller view, trade `4d50a44e`): "✗ You haven't reviewed the buyer" + "✓ The buyer has reviewed you" + CTA. |
| **Q15** | Android | ✅ **PASS** | 4 reason rows, reviewee-only menu, confirm dialog copy, success alert **"Review reported. Thank you!"**, DB report row + `report_count 1` written — see §1.5 setup. |
| **Q17** | Android | ✅ **PASS** | the **public** SellerProfile tree contains **no `review-menu-button`** at all (`SellerProfileScreen` hard-codes `showReportMenu={false}`); the overflow renders **only** on the own-profile (`ProfileScreen`) cards, and only where `currentUserId === review.reviewee_id`. |
| **Q20** | Android+admin | ✅ **PASS** | see §1.5. |
| **Q19** | Android+admin | 🔴 **FAIL — Keep does not persist** | see §1.6 (finding N1). |

**Incidental Group-Q re-confirmations on Android:** **Q08/Q09** — own-profile Reviews section renders **"4.5"**, **"Based on 2 reviews"**, breakdown 5★=1 / 4★=1 / 3★=0 / 2★=0 / 1★=0 (sums to 2) and then **"Reviews (1)"** after the Hide (5★→0) — i.e. the count/average/breakdown all re-derive from the visible set. **Q02 observation (not a verdict):** on the fresh Android bundle the **Submit Review button renders disabled/grey at 0 stars and enables once a rating is chosen** — this differs from the source reading recorded this morning on iOS (`disabled={submitting}` only) and is worth a look, but I did not run the bounded functional tap that Q02's own case requires.

**FIX-Task-21 items re-verified on Android (fresh bundle):** **item 2** — `review-button`'s `accessibilityLabel` now reads *"Review the Buyer"/"Review the Seller"* (matching its visible text; AX tree confirms) and the SubmitReview **title carries the counterparty's name** ✅. **item 17** — the comment field's placeholder is **`0/500`** ✅ (counter caption reads "500 characters max" — see N3).

---

## 3. Findings (ranked)

| # | Severity | Finding |
|---|---|---|
| **N1** | **HIGH** | **Admin "Keep" reports success but does not persist — the only route that un-hides a review is a no-op.** `POST /api/reviews/<id>/keep` returns **HTTP 200 `{"success":true}`** while the review stays `is_hidden=true` / `review_status='hidden'` / `report_count=1`, the `review_reports` row survives, the reporter is **not** notified, and the row never leaves the moderation queue. Reproduced 4× including on a **freshly restarted** dev server. Two anomalies: the response body does not match `keep/route.ts` on disk, and the dev-server log shows **no POST for that path and no compiled `keep` route** (the sibling `hide` route compiles + persists normally). Net effect: **a hidden review cannot be restored through the UI** — Q20's Hide is effectively irreversible today, and Q19 cannot be completed. Needs dev root-cause (route resolution/build) + a re-drive. |
| **N2** | **MED** | **A failed review submission shows a raw backend error to the user.** Submitting the Q04 review produced the Alert **"Error / Gateway Timeout"** (and `console.error('[Submit review error] {"message":"Gateway Tim…')` in LogBox). No friendly copy, no "try again" guidance, no mapping of gateway/5xx to a user-meaningful message — the §6.3 raw-machine-string class. It was transient (the retry succeeded), which is exactly why the wording matters: the user is told nothing actionable. |
| **N3** | **LOW** | **Two different cap captions on the same field.** On the fresh Android bundle the comment field shows **placeholder `0/500`** and a separate caption **"500 characters max"**, while this morning's iOS pass recorded the caption as *"0/500 characters"*. Worth reconciling to one consistent formulation. |
| **N4** | **LOW–MED (tooling/environment)** | **The emulator's photo library is empty by default, and the Android photo picker did not surface media after a MediaStore repopulation.** `adb push` + `content call … scan_file` successfully registered **12 images** (verified via `content query`), yet the picker still rendered "No photos yet" on in-place re-entry. This blocks every real-photo flow (O-1 C07 here; the upload/AI limbs of Group J/K generally). Suggest a documented emulator-media seeding step + entering the picker from a **freshly mounted** screen. |
| **N5** | **LOW (tooling)** | **The AX tree / a screenshot taken inside a `mobile_batch_commands` batch is taken *before* React re-renders.** A click followed by a screenshot in the same batch reliably returns the **pre-click** UI (this cost several false "nothing happened" readings, incl. one mistaken navigation). Read the post-action state in a **separate** call. |
| **N6** | **LOW (tooling)** | **A `create-item` deep link re-focuses the *retained* ItemCreate screen rather than resetting it** — a previously filled form (photo, title, price, and the previously chosen category) survives into the "new" listing flow, and a still-open "Thanks for submitting!" modal from the previous listing stays on top. Drive each listing from an explicitly re-checked screen state. |
| **N7** | **LOW (doc-drift)** | **O-1 C06/C07's hard-coded `general_tangible_goods` expectation only holds for categories mapped there.** A Books-category listing correctly receives `tax_exempt_goods` (proven in C15). The C06/C07 "expected result" should be phrased as *"equals the tax category its product category is mapped to"*, with `general_tangible_goods` as the example for the default-mapped categories. (The group header already carries a 🔄 note to this effect; the two case bodies still state the flat key.) |
| **N8** | **INFO** | The completed-trade review CTA is **amber `#F59E0B`** (`TradeTimelineScreen.styles.reviewButton`). That is a canonical design token (the SP amber), so it is **not** an off-brand hex — noting it only because it is the amber token used as a primary CTA, which is worth a conscious design sign-off. |

---

## 4. Perceived load time (§5.7 — "simulator, wall-clock, ±polling-interval precision", NOT a formal performance profile)

Only transitions with a timestamped read are listed; no transition was flagged ≥3 s as an app-behaviour issue.

| screen → transition | elapsed | note |
|---|---|---|
| Android `create-item` deep link → ItemCreate first tree | ≲2 s | warm app; the first tree read is often the **pre-navigation** screen (see N5) |
| Publish tap → "Submitting Item For Review…" overlay | ≤1 s | then the success modal within ~2 s (DB row stamped 21:30:44Z) |
| admin mapping Save → success message + refreshed row | ~1–2 s | local Next dev server |
| Books mapping write (21:35:04Z) → post-flip listing created (21:35:55Z) | **51 s** | the deliberate gap between the admin write and re-driving the mobile create flow — *not* app latency |
| **Android cold dev-client reload** (terminate → Dev Launcher → `10.0.2.2:8081`) | **≈90–120 s** | **environment artifact** (R77: cold-start ≈ minutes with Metro idle; native-init/first-frame, not bundling) — required by R79-1 because the running client held a stale bundle |
| Review Submit → submit outcome | ~2–4 s | first attempt returned "Gateway Timeout" (N2); retry succeeded |

---

## 5. Execution trace + evidence

Full ordered trace in `ledger.md`; **41** on-disk screenshots in `screenshots/`. Key files:

| file | what it shows |
|---|---|
| `AND-02…AND-08` | C06 — dev-fill, CategorySelectModal (bonus badges), Games selected, "Thanks for submitting!" modal, My Listings PENDING |
| `AND-09…AND-14` | C07 — bulk intro, 5/30 photos, reset grouping (Item 1/2), review step, confirm sheet (5 items), **"Missing bulk session or draft session."** |
| `AND-16`, `AND-17` | C07 real path — photo picker **"No photos yet"** (blocked, N4) |
| `AND-18…AND-20` | C15 — Books selected pre-flip |
| `AND-24` | C15 — post-flip Books listing submitted |
| `AND-25`, `AND-29…AND-32` | Q15/Q17 — own profile reviews, reviewee-only overflow menu (4 reasons), confirm dialog |
| `AND-33`, `AND-34` | R79-1 — cold reload + Dev Launcher (8081/8082 rows) |
| `AND-35` | Q01/item-17 — SubmitReview "Review Test Buyer" + `0/500` placeholder |
| `AND-36` | Q05 — post-skip Trade Timeline (CTA still present) |
| `AND-37`, `AND-38`, `AND-40` | Q04 — anonymous + 5★ before submit; **"Gateway Timeout"** error (N2); retry state |

### 5.1 Admin dev-server restart (§5.21 / §3 note)

Mid-run the admin dev server was **stopped and restarted** (`npm --prefix p2p-kids-admin run dev`, ready in 1.2 s) specifically to rule out a stale build before treating the Keep result as a product defect. The defect **reproduced identically** on the clean build — that is why it is reported as a defect rather than as a stale-build artifact. The portal is **left running** on `:3001`.

---

## 6. Session close — what was reached, what was not (explicit, per the dispatch)

| priority | status |
|---|---|
| **P1 — O-1 C06/C07/C15 + flip/restore + Q19/Q20 carryovers** | **reached**: C06 ✅, C15 ✅ (all 7 steps), flip ✅, restore ✅, Q20 ✅, Q19 🔴 (defect). **Not reached:** C07 (fixture + emulator-media blocked, §1.2). |
| **P2 — remaining Tier-1 money/state** | **partially reached**: Group Q Android legs (Q01/Q04/Q05/Q06/Q15/Q17 ✅, Q20 ✅, Q19 🔴), plus Q08/Q09 incidental. **Not started:** O-2 C04/C05/C11 · O03/O04/O06/O07/O08 · R03/R04 · K02 first-trade leg (`qa-first-trade` still not provisioned). |
| **P3 — Group L (0/11), M/N/S/T remainders** | **not started.** |
| **P4 — U/V/X/Y/N2 fast-confirm** | **not started.** |

**Stopping point: the session ran out of budget inside Priority 2.** Per the dispatch's own instruction, Tier-1 rigour was **not** thinned to reach further, and no Tier-3/4 row was touched. The next round can resume at **P2's O-2/O03/O06–O08/R03/R04 block** without re-doing anything above.

**The single most important carry-forward:** until **N1 (Keep)** is fixed, **Q19 is un-completable and Q20's Hide is irreversible through the UI** — restart the next round by re-driving the Q19 Keep leg and restoring review `44f5662f`.

### Tracker update

`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — a dated round note was added at the top of the TRD block (Android verdicts, findings, the new Android-coverage map, and the explicit not-reached list) and the header's Android-coverage map was refreshed. **No TRD row-status flips** were made: every row driven this round was already PASS on record, so the totals stay **288 · 239 PASS · 25 PARTIAL · 1 OPEN · 5 DOC-DRIFT · 2 SKIPPED · 16 Remaining**. Q19's row is **not** flipped (its iOS/admin PASS on record still stands, R80) but carries an explicit **Android-leg 🔴 + N1** note. The **O-1/O-2/O-3 sub-case rows remain unmaterialised** (flagged again — C06/C07/C15 verdicts again had no row to land in).

**Updated TRD Android-coverage map (Android-verified / total in group):** K 10/11 · L 0/11 · M 5/20 · N 6/14 · O 3/8 · **O-1 16/17** · O-2 10/12 · O-3 12/14 · P 6/8 · **Q 14/20** · R 5/13 · S 5/24 · T 11/14 · U 3/5 · V 5/14 · W 12/12 · X 7/16 · Y 4/9 · N2 3/10.
Net new Android coverage this round: **O-1 +2** (C06, C15) and **Q +5** (Q04, Q05, Q15, Q17, Q20 — Q01/Q06 were already counted in the prior 9/20, and are now independently re-confirmed on a fresh Android bundle). Remaining biggest gaps by row count: **L 11 · S 19 · M 15 · R 8 · N 8 · X 9 · V 9 · N2 7 · Q 6 · O-2 2 · O-3 2 · U 2 · Y 5 · P 2 · K 1 · O 5 · O-1 1 (C07)**.
