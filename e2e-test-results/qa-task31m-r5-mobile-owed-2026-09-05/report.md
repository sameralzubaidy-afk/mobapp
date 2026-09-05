# QA Task 31-M Round 5 — Remaining Mobile-Owed Cases + Fixture-Gated Stragglers (Batches A–E)

**Run date:** 2026-09-05 · **Folder:** `e2e-test-results/qa-task31m-r5-mobile-owed-2026-09-05/`
**Build:** current dev (post-DT113/DT112/DT110/DT109/DT108) · **Guide:** `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` · **Rules:** ADM-R1–R6, R55/§5.57 (mobile legs same-session), R53/§5.55, R52/§5.54, R54/§5.56 (admin numbers DB-reconciled), R28/R37 (config scope-write-revert), R59 (fresh-fetch on backend changes), R60 (batched native-dialog handling), R29/§5.41 (device busy check), R-16-1/R49 (persona batching), §5.21 (stale dev-server recovery).
**Device:** iPhone 17 Pro Max sim `3F3293A3` · Admin `:3001` (shared page, samer `1a546991`; dev server **restarted mid-run** — stale Next.js dev server §5.21 recovery) · Metro `:8081` · Staging `drntwgporzabmxdqykrp`.

## Verdict summary

**ADM mobile-owed pool: before this round ~26 rows listed in the brief (14 rows carried an explicitly mobile-leg-owed note across the tracker + the QA31 correction blockquote); after this round 11 rows carry a genuinely-driven mobile leg + 2 PARTIAL→PASS flips + 1 more mobile-leg closure, and the rest remain owed with explicit per-case reasons (R40).**

Genuine mobile-leg closures this round (admin action → on-device observation → DB, all tied to the same fixture):
- **Batch A (D-group, 7 rows):** D02, D05, D06, D07, D08, D09, D10 — full mobile legs driven on disposable categories (multiplier estimate, icon render, caps enforcement + clamp, reorder, show/hide, delete).
- **Batch B (E-group, 2 rows):** E03 (deactivated-node cannot-join), E04 (radius live propagation).
- **Batch C (moderation, 3 rows):** C06 (force delete → buyer-gone), C08 (approve → buyer-visible; targeted /listings search worked this round), C10 (rejected → seller ListingSafetyReview).
- **Batch D (1 row):** N03 (referral SP config → mobile Referrals values match).
- **Batch E (2 rows PARTIAL→PASS):** Y08 (palette Listings nav — DT108 fix live), N2-A01 (per-trade financial audit journal).

**Count flips:** D08, Y08, N2-A01 → **PASS** (3 PARTIAL→PASS). ADM roll-up: **PASS 132 → 135 · PARTIAL 23 → 20** (OPEN 1 / SKIPPED 1 / Remaining 3 unchanged). **0 FAIL · 0 BLOCKED** (every attempted execution succeeded; several legs recorded as not-driven this round with explicit reasons, not failures).

---

## Batch A — D-Group (all PASS, mobile legs driven)

Fixture: disposable categories **QA R5 Cat A** (`1eee27c5`) + **QA R5 Cat B** (`95b36f9a`) created via admin `/categories`, configured per leg, both deleted at cleanup (**0 residue**; Sports redemption cap scope-written and reverted NULL).

| Item | Scenario driven | Evidence |
|---|---|---|
| **D08** (reorder→mobile) | Created A (order 11) + B (12) → admin **Move Down** on A (DT110 button) → persisted (DB B=11,A=12, reload confirmed) → **mobile CategorySelectModal main list shows QA R5 Cat B BEFORE QA R5 Cat A** (rows y756/y818, AX `category-95b36f9a` before `category-1eee27c5`; no "Recent" section in ItemCreate) | `MOBILE-D08-D02-picker-order-B-before-A.png`, `ADMIN-D05-D08-A-icon-multiplier-reordered.png` |
| **D02** (multiplier→mobile SP calc) | A multiplier set to 1.15 (admin, Live Preview 57 SP, DB) → mobile picker shows **Bonus badge on A only** (B 1.10 has none) → selected A + $20 price → **"You'll earn ~23 SP" + "1.15x multiplier for this category"** (round(20×1.15)=23 — the mobile SP calculation reflects the configured multiplier) | `MOBILE-D02-sp-estimate-23SP-1.15x.png` |
| **D05** (icon→mobile picker) | Custom icon uploaded to A (favicon.png 192px via Icon & Badge tab) → DB `icon_url` storage `category-icons/1eee27c5/…/category.png` + admin row shows image → **mobile picker A row renders the image (no 📦 fallback StaticText), while no-icon rows (B/Other/Shoes/Bookies) render the 📦 fallback** | `ADMIN-D05-D08-A-icon-multiplier-reordered.png` + AX (📦 present on B, absent on A) |
| **D06** (spending % → mobile) | Sports spending cap 75% (existing) → mobile Make Offer shows **"Max: 3 SP (75% of price)"** — the % is displayed | `MOBILE-D06-D07-offer-max-3SP-cap-enforced.png` |
| **D07** (redemption cap enforced) | Sports `sp_redemption_cap` set 3 via admin (DB) → mobile Make Offer **"Max: 3 SP"** (uncapped would be 10 = floor(14×75%)) → typing **"10" clamps to value 3 + "3 SP applied"** → cap reverted NULL (DB read-back) | `MOBILE-D06-D07-offer-max-3SP-cap-enforced.png`, `MOBILE-D07-entered-10-clamped-to-3.png` |
| **D09** (bulk show/hide→mobile) | Bulk **Deactivate** A+B (native confirm "Deactivate 2 categories?") → DB inactive → mobile picker **A+B GONE** (Bookies last before Other) → Bulk **Activate** → DB active → mobile picker A back | `MOBILE-D09-picker-hides-deactivated-AB.png` |
| **D10** (delete→mobile) | Deleted B (empty, confirm) → "Categories (12)"→(11)→(10) → mobile picker **B absent, A present** → A deleted at cleanup → Categories (10) baseline | `MOBILE-D10-deleted-B-gone-A-back.png` |

Cleanup DB-verified: 0 `QA R5%` categories; Sports cap NULL; A+B deleted. Note: A's storage icon object (`category-icons/1eee27c5/…/category.png`) may remain orphaned after the category delete (dev cleanup note).

## Batch B — E-Group (E03/E04 mobile legs closed; E02/E05 signup-gated)

| Case | Scenario driven | Evidence |
|---|---|---|
| **E04** (radius→mobile Discover) | admin_config `min_user_radius_miles` 5→10 (qa:admin-config-set, DB read-back) → fresh Discover filter modal radius slider min label **"5 mi"→"10 mi"** (max 25 held) → **reverted to 5** (DB read-back). Current-config display also reconciled (min 5/max 25) | `MOBILE-E04-discover-radius-5-25-config.png`, `MOBILE-E04-radius-min-updated-10mi.png` |
| **E03** (deactivate→cannot-join) | Deactivated-node ZIP **90210** (node "QA Auto G02" `is_active=false`, DB) → test-buyer Discover filter ZIP 90210 → **"Not Available in Your Area / We're not live in ZIP 90210 yet"** waitlist modal (cannot-join state). Dismissed "No, thanks" → **no waitlist row created** (DB 0 for 90210/test-buyer) | `MOBILE-E03-cannot-join-inactive-node-90210.png` |
| E02 / E05 | Admin legs PASS (QA31). Mobile leg = a fresh user resolving to a new node's ZIP / a waitlist→Joined transition on signup — both need a **fresh-signup fixture** (R41 class). Not driven this session; explicit reason recorded. | — |

## Batch C — Moderation mobile-visibility legs

Fixture: test-seller's pending `afd3384a` (QA Dev Fixture Item, $20, Books) driven approve→available→force-delete (consumed = soft-deleted).

| Case | Scenario driven | Evidence |
|---|---|---|
| **C08** (approve→buyer-visible) | Targeted `/listings` search (seller-email test-seller@ + Pending filter — Round 4's unreliable-nav note **resolved**: exactly 1 result) → Listing Details → **Approve Listing** (Admin Notes optional) → native alert "Listing approved…" → DB `available` + `approved_by` 1a546991 → **mobile: pre-approve deep link = "This item is no longer available"; post-approve (fresh relaunch) = full ItemDetail + Request to Buy + Add to Cart** | `MOBILE-C08-pending-not-buyer-visible.png`, `MOBILE-C08-approved-buyer-visible-request-to-buy.png` |
| **C06** (force-delete→buyer-gone) | Same fixture post-approve → Listing Details **Force Delete** (reason form) → "Listing force-deleted successfully" → DB `status=deleted` → **mobile (fresh relaunch): deep link = "This item is no longer available"** again (no purchase path). Item consumed (clean, reduces residue) | `MOBILE-C06-force-deleted-not-buyer-visible.png` |
| **C10** (reject→mobile reflection) | Seller-side: `listing-safety` deep link on rejected test-seller item `04662c2c` → **ListingSafetyReview "This listing was rejected by our safety team." + REJECTED badge + "Rejection Reason: QA C04 reject reason…" + appeal UI**. Buyer-side = shared non-availability mechanic (proven C06/C08) | `MOBILE-C10-rejected-seller-safety-review.png` |
| C09 / X05 | Admin legs PASS (QA30). C09 mobile (needs_edits seller branch) = the **same ListingSafetyReview screen** as C10's captured REJECTED branch (needs_edits copy source-verified); no needs_edits item currently staged. X05 mobile (inline-approve→buyer-visible) = the **same approve→Request-to-Buy mechanic** driven for C08; no flagged item currently staged on staging (QA30's X05 fixture is deleted). Both recorded as demonstrated-by-shared-mechanic with precise reason. | — |

## Batch D — N03 closed; remainder scoped with explicit reasons

| Case | Result | Notes |
|---|---|---|
| **N03** (referral SP → mobile) | ✅ mobile leg | DB `sp_config`: referrer 40 / referee 20 / referrer-listing 10 / referee-listing 25 / starter 10, program+2 toggles active → **mobile Referrals (test-seller) shows First Trade 20 SP, First Listing 25 SP, "You earn: 40 SP per trade • 10 SP per listing"**, "Active Rewards" (no paused banner). Values match config exactly (R54) | `MOBILE-N03-referral-SP-values-match-config.png` |
| G04 (policy publish) | 🟡 PARTIAL-owed | Publish re-prompts ALL users (global blast radius on shared personas); DT109 restore (Make Active + draft delete) now makes it safe but needs a focused single-case round with a disposable policy + acceptance-gate handling. Not driven this session (R41-class). |
| M03/M04 (sub admin→Manage) | 🟡 PARTIAL-owed | Needs a disposable real subscription (Stripe lifecycle) — deferred to the SUB money round (QA Task 32) per R40. |
| O04 (ID screenshot-deleted note) | 🟡 PARTIAL-owed | "screenshot deleted" reviewed-state not present on staging (QA31 note unchanged). Fixture-gated. |
| P01/P02/P03 (badge toggle/edit/award) | 🟡 PARTIAL-owed | Badge toggles/edits are global (affect all users); manual award needs a target + the /badges award surface. Scope-write-revert possible but better as a focused round. |
| R01/R03 (education publish) | 🟡 PARTIAL-owed | R01 admin PASS (QA31). R03 needs a draft education/FAQ publish + mobile Help nav (no deep link). Focused round. |

## Batch E — Fixture-gated stragglers

| Case | Result | Notes / evidence |
|---|---|---|
| **Y08** (palette Listings nav) | ✅ **PARTIAL→PASS** | Command palette search "Kids Bike Helmet" → Listings result row → click → URL `/listings?tab=search&q=Kids+Bike+Helmet` → "Results (1 of 1)" + item surfaced (test-seller-3, $14 Available). **DT108 title-based fix verified live** (the QA30 q=<uuid>→empty FINDING is RESOLVED). Settings/Users/Trades navs hold from QA30. | `ADMIN-Y08-palette-listings-nav-surfaced.png` |
| **N2-A01** (financial audit journal) | ✅ **PARTIAL→PASS** | DB: per-trade journal for completed trade `01121468` = 6 chronological rows (buyer_fee_charged 149 → offer_created → tax_quoted 419 → payment_intent_created 6568 → payment_captured 6000 → payout_initiated 5400) with actors. Admin `/audit` (Financial Audit): unified immutable idempotency-keyed journal with trade/entity search + mutation/entity-type filters. | `ADMIN-N2-A01-financial-audit-journal.png` |
| X07 (inline retry failed payout) | 🟡 PARTIAL (unchanged) | No failed-payout row staged this session (qa:failed-payout fixture is a dev-run service-role write; 0 failed seller_payouts on staging). Affordance + confirm verified QA30; DT109 fixture exists to stage one — commit leg needs a dev-staged row (K03's leg was closed via it on QA31-T). |
| Y05 (debounce ~200ms) | 🟡 PARTIAL (unchanged) | 200ms debounce source-verified (CommandPalette.tsx); char-by-char typing not drivable by the embedded driver → no per-keystroke network count; single native-setter → single fetch observed (QA30). |

---

## Findings

1. **[INFO — resolved this round] C08's Round-4 note "approve-pending /listings navigation unreliable" is RESOLVED.** The targeted search (seller-email `test-seller@` + Pending status) surfaced the exact row (`afd3384a`, "Results (1 of 1)") in one pass; the earlier unreliability was a bare-text-search/status-filter combination, not a page defect.
2. **[INFO — DT108 fix confirmed live]** Y08's "Listings row → empty search" FINDING is fixed on the running build: the palette now passes the searchable title (not the item UUID), and `/listings?tab=search&q=<title>` surfaces the listing.
3. **[LOW — admin/dev cleanup] Staging residue inventory.** Multiple QA leftover nodes (`QA Auto G01 Active EDITED` 10001, `QA Auto G02 Inactive` 90210, `QA T31 Disc Node` 06852 inactive, `Test Node 1787530126930/…389/…340` 06850, `Diag Test Node` 06850), ~50 duplicate "Cash-Only Item" $20 available listings under test-seller (E2E-run residue), and 5 pending `zip_waitlist` rows (07999×4, 12355) remain on staging from prior rounds. A dev/ops cleanup pass is recommended (delete/archive the clearly-QA nodes + duplicate items; the 07999 waitlist rows belong to throwaway users).
4. **[LOW — dev cleanup] Category icon storage objects may orphan on category delete.** Deleting a category left the uploaded icon at `category-icons/<id>/category.png` in storage (A's icon object remained after the category delete). Consider a storage cleanup on category delete (non-blocking).
5. **[INFO — doc-drift reaffirmed]** The Discover filter radius **min/max labels** reflect `min_user_radius_miles`/`max_user_radius_miles` (config), while the slider's current value uses the user's saved preference (test-buyer: 15) — the "default_radius_miles" only seeds when the user is still at the module default. Guide E04's expectation of default-radius mobile propagation is nuanced accordingly (already noted in guide's O05 cross-ref).
6. **[INFO]** The admin dev server was stale (running ~1d5h across code changes → 500s/404s on every route). Restarted per §5.21; all admin work this round ran on the fresh server.

## Perceived load-time (labeled per §5.7; simulator/browser wall-clock, not a profile)

- Admin category create/edit/save + Live Preview: ~1.5–2s each; bulk deactivate/activate + native confirm: ~1.5–2s; approve/reject/force-delete + native alert: ~1.5–2.5s each.
- Admin /listings targeted search: ~2–3s (search RPC); command palette search → results: ~1.5–2s; palette row → /listings page + results: ~2.5–3.5s.
- Mobile category picker open/selection: ~0.5–1s; SP estimate recompute on price entry: <1s; Make Offer screen load: ~1–1.5s; item-detail deep-link after relaunch: ~2–4s.
- No transition ≥3s observed for user-initiated actions except the palette→/listings navigation (~3s, includes a page load); none flagged as a defect.

## Design / copy / UX notes

- Category picker rows are clean (icon → emoji → 📦 fallback; Bonus badge on >1.1 categories); Make Offer SP section ("Max: 3 SP (75% of price)", "3 SP applied") is clear and consistent with canonical tokens.
- The inactive-ZIP "Not Available in Your Area / We're not live in ZIP 90210 yet" + outcome step ("No problem — you can still browse everything on Pass It Up.") copy is parent-appropriate and clear.
- ListingSafetyReview rejected-state copy ("This listing was rejected by our safety team." + Rejection Reason) is clean; no raw codes surfaced anywhere this round.
- Admin surfaces visited (/categories, /listings search+details, /audit) consistent with prior-round admin conventions; no new design/copy deviations.

## Evidence (screenshots/)

`ADMIN-D05-D08-A-icon-multiplier-reordered.png`, `MOBILE-D08-D02-picker-order-B-before-A.png`, `MOBILE-D02-sp-estimate-23SP-1.15x.png`, `MOBILE-D09-picker-hides-deactivated-AB.png`, `MOBILE-D10-deleted-B-gone-A-back.png`, `MOBILE-D06-D07-offer-max-3SP-cap-enforced.png`, `MOBILE-D07-entered-10-clamped-to-3.png`, `MOBILE-E04-discover-radius-5-25-config.png`, `MOBILE-E04-radius-min-updated-10mi.png`, `MOBILE-E03-cannot-join-inactive-node-90210.png`, `MOBILE-C08-pending-not-buyer-visible.png`, `MOBILE-C08-approved-buyer-visible-request-to-buy.png`, `MOBILE-C06-force-deleted-not-buyer-visible.png`, `MOBILE-C10-rejected-seller-safety-review.png`, `MOBILE-N03-referral-SP-values-match-config.png`, `ADMIN-Y08-palette-listings-nav-surfaced.png`, `ADMIN-N2-A01-financial-audit-journal.png`. DB read-backs + config states recorded inline and in the ledger.

## App / config state left behind (all DB-verified)

- Config baselines restored: `min_user_radius_miles`=5, Sports `sp_redemption_cap`=NULL, `platform_fee_seller_percentage` etc. untouched. Audit rows from the radius + Sports-cap + category create/edit/delete round-trips are expected (admin actor `1a546991`).
- Disposable categories A+B deleted — **0 `QA R5%` residue**; Categories back to 10 (Books…Other + Shoes + Bookies). Note the pre-existing "Bookies" category (order 10, 1 item, no icon) is itself likely prior QA residue.
- `afd3384a` soft-deleted (status=deleted) — the C08/C06 fixture consumed into its intended terminal state.
- No waitlist residue added for test-buyer (90210 dismissed No-thanks).
- Mobile session = test-seller (on the Referrals screen). Admin session = samer (on /audit). Metro + admin dev server (fresh) running.
- Flagged for dev cleanup: leftover QA nodes, duplicate "Cash-Only Item" listings, 5 pending waitlist rows, orphaned category-icon storage object for the deleted A.

---

## 📋 QA Session Handoff

**Test Scope:** QA Task 31-M Round 5 — mobile-owed closure across ADM batches A–E. Batch A D-group (D02 multiplier→mobile SP calc, D05 icon→mobile picker, D06/D07 caps enforced in mobile offer, D08 reorder→mobile order, D09/D10 bulk show-hide + delete→mobile) on disposable categories. Batch B E-group (E03 deactivated-node cannot-join, E04 radius→Discover). Batch C moderation mobile legs (C06 force-delete→buyer-gone, C08 approve→buyer-visible via targeted search, C10 rejected→seller ListingSafetyReview; C09/X05 shared-mechanism). Batch D (N03 referral config→mobile; remainder scoped). Batch E (Y08 palette Listings nav re-verify, N2-A01 financial audit journal; X07/Y05 remain fixture/driver-gated). ADM guide; ADM-R1–R6.
**Design-System Compliance:** PASS with notes — all mobile surfaces reviewed (category picker incl. icon render + Bonus badge, Make Offer SP cap UI, inactive-ZIP waitlist modal + outcome copy, ListingSafetyReview rejected state, Referrals screen, Discover radius slider, ItemCreate SP estimate) matched canonical tokens/copy; no new design-token deviations. Admin surfaces (/categories, /listings, /audit) consistent with prior rounds.
**Perceived Load-Time Verdict:** GOOD — no user-initiated transition ≥3s observed as a defect (only the palette→/listings navigation ~3s, a full page load). Admin save/moderation actions 1.5–2.5s; mobile picker/offer/referral transitions ~0.5–1.5s; item-detail deep links after relaunch ~2–4s.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — CategorySelectModal list (icon → emoji → 📦 fallback ordering; Bonus badge only on >1.1 multiplier rows; no "Recent" section in ItemCreate flow).
- CONFIRMED — Make Offer SP section: "Max: 3 SP (75% of price)" + "3 SP applied" clamp (no raw codes).
- CONFIRMED — Inactive-ZIP modal: "Not Available in Your Area / We're not live in ZIP 90210 yet." + outcome "No problem — you can still browse everything on Pass It Up."
- CONFIRMED — ListingSafetyReview rejected state: "This listing was rejected by our safety team." + REJECTED + "Rejection Reason: …".
- CONFIRMED — Referrals screen Active Rewards values match the configured referral SP fields (no paused banner since program active).
**Verdict Summary:** 11 rows closed with genuinely-driven mobile legs this round (D02/D05/D06/D07/D08/D09/D10, E03/E04, C06/C08/C10, N03 = 13 mobile legs actually driven across 11 PASS rows) + 3 PARTIAL→PASS flips (D08, Y08, N2-A01). ADM roll-up PASS 132→135, PARTIAL 23→20. 0 FAIL · 0 BLOCKED. Remaining owed rows (E02/E05, C09/X05, G04, M03/M04, O04, P01/P02/P03, R01/R03, X07, Y05) carry explicit reasons in the ledger/report.
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` ADM section — 3 PARTIAL→PASS flips (D08 reorder+mobile, Y08 palette nav DT108, N2-A01 journal), roll-up refreshed (PASS 135 / PARTIAL 20) on BOTH the §1 table and the section header, R5 addendum blockquote added, and mobile-leg Notes/Source refreshed on D02/D05/D06/D07/D09/D10/E02/E03/E04/E05/C06/C08/C09/C10/N03.
**Critical Findings:** (1) INFO — Round 4's "C08 /listings pending-nav unreliable" note resolved via targeted seller-email+Pending search. (2) INFO — Y08's palette-Listings empty-search FINDING is FIXED live (DT108 title-based nav). (3) LOW — dev cleanup inventory on staging (leftover QA nodes incl. 3 duplicate-06850 Test Nodes + QA Auto G01/G02 + QA T31 Disc, ~50 duplicate "Cash-Only Item" listings under test-seller, 5 pending waitlist rows, orphaned category-icon storage object on category delete). No app defects found this round.
**App State Left Behind:** Config at baseline DB-verified (radius min 5, Sports cap NULL). Disposable categories A+B deleted (0 residue; note A's orphaned storage icon + the pre-existing "Bookies" category are prior-QA residue). `afd3384a` soft-deleted (C08/C06 fixture, intended). No new waitlist rows. Mobile = test-seller (Referrals). Admin = samer (fresh dev server, /audit). No accounts created.
**Why It Matters:** This round drove the mobile leg that QA31's correction flagged as owed across the D/E/C/N/Y/N2 category-and-moderation surface — proving on-device that admin category config (multiplier/icon/caps/order/show-hide/delete), node radius + deactivation, moderation decisions (approve/delete/reject), referral SP values, palette navigation, and the audit journal all reach and correctly reflect in the mobile app / admin UI. Three previously-PARTIAL rows (D08, Y08, N2-A01) are now fully PASS, and the ADM tracker's mobile-leg debt is materially reduced with every remaining row carrying an explicit, actionable reason.
**How to Verify/Reproduce:** Evidence in `screenshots/` (list above). D-group: create 2 disposable categories → Move Down (D08 order in picker), set multiplier 1.15 (D02 estimate), upload an icon (D05 render), Sports redemption cap 3 + offer (D07 "Max: 3 SP"/clamp), bulk deactivate/activate (D09), delete (D10) → delete disposables. E04: `qa:admin-config-set set --key min_user_radius_miles --value 10 …` → fresh Discover filter slider min "10 mi" → revert 5. E03: Discover filter ZIP 90210 → "Not Available in Your Area". C08/C06: approve a pending test-seller item via /listings search → mobile Request to Buy → Force Delete → mobile "no longer available". C10: `listing-safety/<rejected-id>` → REJECTED review. N03: /referrals config vs mobile Referrals values. Y08: ⌘K → listing title → Listings row → /listings surfaces it. N2-A01: `SELECT … FROM financial_audit_log WHERE entity_id='<trade>'` + /audit.
**Known Gaps / Not Tested:** E02/E05 mobile legs need fresh-signup fixtures (new-node ZIP resolution / waitlist→Joined on signup) — R41-class, not driven. C09 (needs_edits seller branch) and X05 (flagged inline-approve) were demonstrated by shared-surface/mechanism (C10's ListingSafetyReview screen, C08's approve→buyer-visible) but not re-driven on a live needs_edits/flagged item (none staged). G04 policy publish (global re-prompt blast), M03/M04 (disposable real subscription — deferred to the SUB round), O04 (screenshot-deleted ID state), P01/P02/P03 (badge toggle/edit/award), R01/R03 (education publish) not driven — each carries a precise reason. X07 commit leg needs a dev-staged failed-payout row. Y05 debounce remains driver-limited (source-verified).
**What Needs To Be Fixed Next:** (1) Dev/ops cleanup pass on staging residue: leftover QA nodes (QA Auto G01/G02, QA T31 Disc, Test Node 17xxx×3, Diag Test Node), ~50 duplicate "Cash-Only Item" listings, 5 pending 07999/12355 waitlist rows, and orphaned category-icon storage objects on category delete (see findings 3/4). (2) A focused fixture/single-case round for the remaining owed rows: G04 policy publish via the DT109 restore affordance (with the acceptance-gate handling), P01/P02/P03 badge toggle/edit/manual-award → mobile profile, R03 education publish → mobile Help, O04 ID screenshot-deleted note, E02/E05 fresh-signup node/waitlist legs, X07 via a dev-staged failed-payout row. (3) QA-side: M03/M04 go with the SUB money round (QA Task 32) per the standing deferral.
**UX Enhancement Ideas (optional, not defects):** (1) On category delete, consider deleting the category's icon storage object (or a periodic orphaned-object sweep) so storage doesn't accumulate deleted-category icons. (2) The Discover radius slider shows the config min/max and the user's saved radius, but nothing labels the source ("saved preference" vs "default") — a microcopy line could clarify why the slider starts at 15 mi when the default is 10 mi. (3) The /listings search UX could surface a hint when a bare-text search returns 0 (e.g., suggest the seller-email + status filter combination that reliably finds a row) — the R4 round's friction was entirely navigational.
**Suggested Next Session:** A dedicated closure round for the fixture-gated remainder (G04 policy publish via DT109 restore, P01–P03 badge work, R03 education publish, O04, E02/E05 fresh-signup legs, X07 via a staged failed-payout row) → then QA Task 31c (closure certification, read-only final audit) → QA Task 32 (SUB money round, which also absorbs M03/M04).
**Suggested to Improve Agent Rules:** none blocking — this round ran cleanly under R55/§5.57 (mobile legs same-session), R54 (every admin-displayed value DB-reconciled), R59 (fresh-fetch on every backend state change — required a relaunch for ItemDetail/CategorySelect), R60 (batched confirm handling incl. window.confirm overrides), R-16-1/R49 (persona batching), §5.21 (stale dev-server recovery). Recurring tooling notes for the record: (1) mobile-mcp tool categories kept dropping mid-session — re-invoking the activate_* category tools restores them (Round 4's recovery confirmed again); (2) the admin CategorySelectModal-era fullScreen modal is AX-drivable this build for row reads but its × close-button tap was unreliable (selection closes it reliably) — worth remembering; (3) Playwright `locator.click()` actionability timeouts recurred on the admin app (category buttons, palette rows) — DOM `el.click()` is the reliable fallback; (4) the `/listings` status select option value for "Available" is `active`, not `available` (schema/driver gotcha).
