# QA Task 31-M v2 — Phase 1 Retroactive Audit (read-only)

**Run date:** 2026-09-04 · **Run folder:** `e2e-test-results/qa-task31m-adm-mobile-impact-2026-09-04/`
**Purpose:** Retroactively audit every ADM case marked ✅ PASS across QA Task 28/29/30/31 for undisclosed mobile-verification gaps (ADM-R5 / R55 did not exist when those rounds ran). For every PASS case with any mobile surface per the ADM guide, classify **genuinely mobile-verified** vs **admin-only, mobile leg owed** — the confidence-building artifact the owner asked for.

**Method:** For each PASS case, (a) read the guide-declared `Surfaces:`/mobile-effect language in `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md`, (b) read the actual evidence (reports/ledgers/screenshots) for the round that PASSed it, (c) decide whether a mobile leg was genuinely driven (same-session mobile observation, or a legitimate cross-referenced mobile leg on an unchanged surface/build).

**Evidence bases read:**
- QA Task 28: `e2e-test-results/qa-task28-mobile-closure-sub-msg-2026-09-04/report.md` — SUB/MSG only; **admin portal untouched; no ADM-guide cases executed.** → no ADM PASS rows from QA Task 28.
- QA Task 29: `e2e-test-results/qa-task29-adm-first-live-2026-09-04/report.md` + `ledger-FULL-160.md` — ~88 ADM cases, **all admin-portal + DB only; zero mobile legs** (report has no on-device step; ledger marks only L08 + R03 "📄 mobile" as mobile legs that were NOT driven).
- QA Task 30: `e2e-test-results/qa-task30-adm-moderation-msg-y-2026-09-04/report.md` — C03–C10/X05/X06 PASS **admin-only commits on disposable listings that were force-deleted post-run** (no mobile visibility leg). Only mobile legs this round were MSG G05/G09 banners (not ADM cases).
- QA Task 31: `e2e-test-results/qa-task31-adm-near-total-2026-09-04/report.md` "Mobile-impact coverage assessment" + `/memories/repo/qa-task31-adm-near-total-2026-09-04.md` + `qa-task31b-reconcile` — 24-row mobile-leg-OWED list (only D03 fully + D02-show partially got a mobile leg this round).

---

## Audit results — summary counts

| Classification | Count | Cases |
|---|---|---|
| **Genuinely mobile-verified** (mobile leg driven same-session or legitimate cross-ref) | 3 PASS rows (+1 partial) | D03 (QA31 same-session); O02/O03 (QA29 cross-ref QA Task 25 mobile ID-badge legs); D02 is PARTIAL (show-only; multiplier-estimate leg owed) |
| **Admin-only, mobile leg OWED** (from QA31's own 24-row list) | 24 rows | B04 L04 L05 D02(est.) D05 D06 D07 D08 D09 D10 I03 I04 E02 E03 E04 E05 G04 M03 M04 O04 P02 P03 R01 R03 |
| **Admin-only, mobile leg OWED** (retroactive additions from QA29) | 10 rows | F03 F05 F06 F08 N03 P01 Q01 Q02 Q03 Q04 Q05 Q06 *(Q-group counted as rows; Q02/Q03 commits were dismissed in QA29 — commit leg itself owed)* |
| **Admin-only, mobile leg OWED** (retroactive additions from QA30) | 9 rows | C03 C04 C06 C07 C08 C09 C10 X05 X06 |
| **Confirmed admin-only / no mobile leg owed** | — | See §3 (Groups A, B-read, C01/C02, D01, E01/E08, F01/F04/F07/F09/F10, G01/G02/G03, H, I01/I05-queue, J, K, L01/L02/L03/L06, N01/N02/N04, O01, S/T/U, V/W/Y/Z, X01–X04/X07–X14, N2) |

**Bottom line:** Across all four rounds, of the ADM cases with genuine mobile/user impact that are marked PASS, **only D03 (QA31) and O02/O03 (QA29, via QA Task 25 cross-ref) have a genuinely driven mobile leg.** Every other mobile-impacting PASS means **PASS admin-leg only**. Coverage was materially overstated for the mobile-consuming side of these admin actions. This is exactly the gap ADM-R5/R55 was created to close; the retroactive correction is the table below.

---

## 1. Priority-group detail (per the task brief)

### Group F — trade-timing / config (QA Task 29) — HIGH-priority check

All PASS admin+DB only. The underlying *enforcement rules* (offer expiry, pickup window, auto-complete, buyer-cancel-request, swap-points, fee math) WERE confirmed live on real mobile trades **at baseline config values** in TRD-guide runs (B02 expiry, D01/D02 auto-complete, G05–G07 cancel-request, D03 countdown pill, K04/K05 fee-mode toggle, B05f/g offer-cap 3→5 immediate mobile pickup, N01/N02 cart-min mobile gate). But the **admin-config-change → mobile re-gate at a non-baseline value** leg was NOT driven in QA29 (verified to DB + audit only, then reverted). That changed-value mobile leg is the gap.

| Case | Guide mobile effect | Evidence (QA29) | Verdict |
|---|---|---|---|
| F03 Trade timing (timing keys + fees) | Keys drive mobile offer expiry/pickup/auto-complete countdowns + fee lines | `/settings/trade-timing` renders 10 sections; DB+audit verified | **OWED** (changed-value mobile leg) |
| F05 N1 pickup countdown + payout buffer | Pickup countdown pill (mobile); payout buffer → seller payout scheduling | Live round-trip `payout_buffer_days` 2→5→2 DB-verified; no mobile | **OWED** |
| F06 7-day guardrail | Guardrail is an **admin-side** validation (client hard-block + DB trigger P0001) — bounds mobile window, but no direct mobile screen | 172h hard-block client+server verified; QA30 F06b batch-atomic re-verified | **Admin-only for the guardrail itself**; mobile effect rides on F03/F05 changed-value legs → **OWED (via F03/F05)** |
| F08 R1 tiered buyer fee — `Surfaces: admin, mobile` | Tiered fee → mobile checkout fee line for free vs subscriber | R1 fields render (149/149/5/199/499); no mobile | **OWED** |
| F02 Cart settings | min/max/expiry govern mobile cart | render + DB; cart-min mobile gate previously proven (TRD N01/N02, QA Task 7) | **OWED-low** (legacy mobile proof exists for cart-min class) |

### Group C / X05 — moderation visibility (QA Task 30)

QA30 PASS C03–C10 + X05 on **disposable listings, all force-deleted post-run** — so no buyer/seller mobile-visibility leg exists for any moderation decision. A moderation decision directly controls (buyer) feed/discoverability + (seller) My Listings/Safety Review state on mobile.

| Case | Admin action (QA30 PASS) | Guide mobile effect | Verdict |
|---|---|---|---|
| C03 Approve flagged | Review-modal Approve → available (disposable 7bc46028) | Listing becomes buyer-visible on mobile feed | **OWED** |
| C04 Reject w/ reason | Reject + reason (disposable a821258d) | Seller sees rejected + reason on mobile; hidden from buyers | **OWED** |
| C06 Force Delete | Force-delete (disposable 033baae0) | Listing gone from mobile for everyone | **OWED** (terminal fixture; mobile not re-checked) |
| C07 Pause | Pause (disposable 53a3b578) | Mobile reflects paused (not purchasable until unpaused) | **OWED** |
| C08 Approve (pending) | Approve Listing (disposable 033baae0) | New pending listing becomes available to buyers on mobile | **OWED** |
| C09 Request Edits | Request Edits + note (disposable 7a045732) | Seller sees edit request in mobile app | **OWED** |
| C10 Reject (flagged) | Reject + note (disposable a8d41d07) | Seller mobile reflects rejected state | **OWED** |
| X05 Inline approve (Action Center) | Inline Approve (same action as C03) | Same buyer-visible effect as C03 | **OWED** |

### Group B — user suspend/unsuspend/reset (QA Task 29)

B03/B06/B07 are **NOT PASS** — they remain OPEN/BLOCKED-on-tooling (native `prompt()` commit leg undrivable), so there is no commit to check yet. B04 (SP credit/debit + freeze) IS PASS (QA31, admin+DB on disposable wallet) → its **mobile enforcement leg is OWED** (see §1 wallet row). B01/B02/B05/B08 are read-only admin views of users — no user-impacting change, admin-only.

### Group Q — review hide/approve (QA Task 29)

Q01–Q06 PASS **render + confirm-copy only**; the Q02 (Hide) and Q03 (Keep/Approve) confirms were **dismissed without committing** in QA29. So the hide/approve moderation **commit leg itself was never executed**, let alone its mobile effect (hidden/kept review on seller profile + reporter notification). → **OWED** (commit leg first, then mobile reflection).

### Group O — ID-verification queue (QA Task 29)

| Case | Evidence | Verdict |
|---|---|---|
| O01 Queue/stats/filter | Admin queue render (24 pending = AC count); admin-only read surface | Admin-only (no user change) |
| O02 ID approve | QA29 note "cross-ref QA Task 25"; QA Task 25 drove the SAME admin approve (d148ee0f) with on-device mobile leg (test-seller-3 profile "Identity Verified" + green Verified pill; other-user Seller Profile shows Verified) | **Genuinely mobile-verified (cross-ref QA Task 25, MSG E02/D07)** — different run/session caveat |
| O03 ID reject | QA Task 25 drove the same admin reject (76592772) with on-device mobile leg (test-seller ID screen returns to upload/resubmit + rejection notification with reason) | **Genuinely mobile-verified (cross-ref QA Task 25, MSG E03/D08)** |
| O04 Request details (screenshot-deleted note) | QA31 PARTIAL (state not present this round) | **OWED** (in QA31's list) — admin-only detail surface; mobile status leg unverified |

### Group N — referrals (QA Task 29)

| Case | Evidence | Verdict |
|---|---|---|
| N01 Config tab / N02 Analytics / N04 missing-config | Admin renders | Admin-only |
| N03 5 SP fields + toggles — `Surfaces: admin, mobile` | QA29 PASS admin-only (fields render) | **OWED** — awarded amounts the mobile referral screen reflects were never driven on-device |

### Group D — categories (QA Task 31) — see full rows in §2
D03 = genuinely mobile-verified (R55 same-session: active→shown, deactivate→hidden on fresh fetch). D02 = PARTIAL (show leg; multiplier-estimate leg OWED). D05–D10 = OWED (icon upload mobile UI, SP caps in mobile checkout, drag order, bulk hide/show, delete removal — none driven on mobile).

### X06 — inline dispute under review (QA Task 30)
X06 PASS admin-only (fe3924ee → under_review, DB-verified). Mobile effect: dispute state on both parties' mobile trade timelines. No mobile leg → **OWED** (groups with I02/I03/I04).

---

## 2. Full audit table — every PASS ADM case with any mobile surface

> Legend: **MV** = genuinely mobile-verified · **OWED** = admin-only, mobile leg owed (drive per R55/ADM-R5) · **AO** = admin-only, no mobile leg owed (confirmed) · N/P = not PASS (not in this audit).

| TC-ID | Guide `Surfaces:` / declared mobile effect | Round (PASS) | Evidence ref | Class |
|---|---|---|---|---|
| **Group B** | | | | |
| B01/B02/B05/B08 | user list/drawer/analytics/sort (read-only admin views) | QA29 | ledger lines 18/19/22/25 | AO |
| B04 Credit/debit SP + freeze | wallet balance + `can_spend_sp=false` on mobile (guide L07/L08 are the mobile-enforcement cases) | QA31 | admin+DB disposable wallet 3df0629c, all 4 status transitions + audit | **OWED** (top priority) |
| **Group C** | | | | |
| C01/C02 | listing/flagged queue renders | QA29 | ledger 28/29 | AO |
| C03–C10 | approve/reject/delete/pause/request-edits → buyer feed + seller mobile state | QA30 | disposables, all force-deleted; admin+DB only | **OWED** |
| C05 | /items/flagged Review modal appeal info (route/doc note) | QA31 | DT108 doc correction | AO (admin surface) |
| **Group D** | | | | |
| D01 | category list render | QA29 | ledger 35 | AO |
| D02 Create/edit + SP multiplier | new cat in picker (shown); multiplier → mobile SP estimate | QA31 | admin+DB; R55 show leg only | **OWED** (multiplier-estimate leg) |
| D03 Activate/deactivate | cat shown/hidden in mobile picker | QA31 | R55 same-session mobile leg (MOBILE-R55-*.png) | **MV** |
| D05 Icon/badge upload (`admin, mobile`) | icon appears in mobile category UI | QA31 | admin+DB icon upload | **OWED** |
| D06 SP spending cap % (`admin, mobile`) | cap applied in mobile checkout/offer flow | QA31 | admin cap 60 → Live Preview 30 SP (admin) | **OWED** (see note: QA16 TRD-A4 proved the redemption-cap class on-device) |
| D07 SP redemption cap (`admin, mobile`) | mobile caps SP usage per item | QA31 | admin redemption 40 → DB | **OWED** |
| D08 Drag reorder (`admin, mobile`) | picker/filter order for users | QA31 | PARTIAL (drag not drivable) | **OWED** |
| D09 Bulk activate/deactivate | same mobile hide/show as D03 | QA31 | admin bulk on 2 disposables | **OWED** |
| D10 Delete category + guards | deleted cat removed from mobile picker | QA31 | admin delete + DB | **OWED** |
| **Group E** | | | | |
| E01 stats | admin-only | QA31 | DB-exact stats | AO |
| E02 Add/edit node | node assignment for nearby mobile users | QA31 | admin+DB (disposable aeffbaa5) | **OWED** |
| E03 Deactivate node (members) | "new users cannot join" on mobile join | QA31 | admin deactivate/reactivate Diag Test Node | **OWED** |
| E04 Node radius validations | default radius drives mobile Discover radius | QA31 | admin 10→12→10 + invalid 150 blocked | **OWED** |
| E05 ZIP waitlist | waitlist→Joined on mobile signup | QA31 | admin metrics/search/empty | **OWED** |
| E08 Waitlist API auth | admin-only auth | QA31 | 401/redirect | AO |
| **Group F** | | | | |
| F01/F04/F07/F09/F10 | config hub/single-source/pipeline/analytics/legacy read-only | QA29 | admin+DB+audit | AO |
| F02 Cart settings | mobile cart behavior | QA29 | render+DB | OWED-low (cart-min mobile gate proven in TRD N01/N02, QA7) |
| F03 Trade timing | mobile trade timing enforcement at config values | QA29 | admin+DB+audit | **OWED** (changed-value class) |
| F05 N1 pickup/payout | pickup countdown + payout timing on mobile | QA29 | payout_buffer 2→5→2 DB | **OWED** |
| F06 7-day guardrail | admin-side validation (bounds mobile window) | QA29 (+QA30 F06b) | client+server block; batch fix holds | AO for the guardrail; mobile effect via F03/F05 |
| F08 Tiered buyer fee (`admin, mobile`) | mobile checkout tiered-fee line | QA29 | fields render (149/149/5/199/499) | **OWED** |
| **Group G** | | | | |
| G01/G02/G03 | policy tabs + draft create/edit (no user impact until publish) | QA29/QA31 | admin renders + draft DB | AO |
| G04 Publish policy | becomes active → mobile policy-acceptance gate | QA31 | PARTIAL (publish commit NOT executed — no safe revert) | **OWED** (commit leg fixture-gated; forward-only publish) |
| **Group H** | | | | |
| H01–H06 | trade list/detail/money (admin READ views of mobile trade data) | QA29 | admin render + DB-verified money | AO (read-only display; confirmed per task) |
| **Group I** | | | | |
| I01 Dispute queue+SLA | admin queue (no user change) | QA31 | DB-exact queue | AO |
| I02 Mark under review | trade dispute state on mobile timeline (both parties) | QA31 | admin under_review fe3924ee | **OWED** (ties to X06) |
| I03 Resolve Complete | trade completed on both parties' mobile timelines; payout→seller | QA31 | admin resolve-complete + payout row 50c024d1 | **OWED** |
| I04 Resolve Refund | trade cancelled + buyer refund reflected on mobile | QA31 | admin resolve-refund + PI cancel + tax void | **OWED** |
| I05 Filter-tab behavior | admin-only | QA31 | filters DB-exact | AO |
| **Group J** | tax pages | QA29 | admin-only (bare /tax 404) | AO |
| **Group K** | | | | |
| K01 Payout fee config | admin render (no commit) | QA29 | render only | AO |
| K02/K03/Z05 | payouts list/retry/deep-link | QA30/QA31 | admin data leg; retry fixture-gated | AO (admin surface; K03 fixture-gated) |
| **Group L** | | | | |
| L01/L02/L03/L06 | SP hub/dashboard/metrics/search (admin dashboards) | QA29/QA31 | admin renders/DB; L02 OPEN (missing table) | AO |
| L04 SP adjustment w/ reason | seller/buyer mobile wallet balance changes | QA31 | admin credit/debit + ledger (with B04) | **OWED** |
| L05 Freeze/unfreeze/suspend | same mobile enforcement as B04 (can_spend_sp=false) | QA31 | admin status transitions ×4 + audit | **OWED** |
| L07/L08 | (not PASS — OPEN; L08 is the dedicated mobile warning-banner case) | — | — | L08 surface is what B04/L04/L05 owed legs close |
| **Group M** | | | | |
| M03 Extend/cancel/reactivate | mobile Manage Kids Club+ reflects changes | QA31 | PARTIAL (commit deferred to QA Task 32 SUB) | **OWED** (deferred to SUB round, R40-explicit) |
| M04 Reactivate (`admin, mobile`) | cross-surface mobile reflection | QA31 | PARTIAL (same deferral) | **OWED** (deferred to QA32) |
| M02/M05/M06 | subscriptions list/metrics/free filter | QA31 | admin renders (R54 window-scoped cards flagged) | AO |
| **Group N** | | | | |
| N01/N02/N04 | config/analytics/missing-config | QA29 | admin renders | AO |
| N03 5 SP fields + toggles (`admin, mobile`) | awarded amounts reflect on mobile referral screen | QA29 | fields render | **OWED** |
| **Group O** | | | | |
| O01 Queue/stats | admin read surface | QA29 | queue render | AO |
| O02 ID approve | user Verified badge on mobile profile | QA29 | cross-ref QA25 mobile leg (d148ee0f) | **MV** (cross-ref) |
| O03 ID reject | user rejected/resubmit on mobile | QA29 | cross-ref QA25 mobile leg (76592772) | **MV** (cross-ref) |
| O04 Request details | admin surface (screenshot-deleted note) | QA31 | PARTIAL (state absent) | **OWED** |
| **Group P** | | | | |
| P01 Badge list + toggle | badge active state on mobile profile | QA29 | table render | **OWED** (low) |
| P02/P03/P04 edit/award/sandbox | badge on recipient's mobile profile | QA31 | PARTIAL (surfaces not on list view) | **OWED** |
| **Group Q** | | | | |
| Q01–Q06 review queue/filters/hide/approve/sort/search | hidden/kept review on mobile seller profile | QA29 | render + confirm copy only; Q02/Q03 commits DISMISSED (never executed) | **OWED** (commit leg first) |
| **Group R (indexed Education)** | | | | |
| R01 Education sections/examples/analytics | content in mobile education screens | QA31 | admin render | **OWED** |
| R03 Publish FAQ/education | published content on mobile | QA31 | PARTIAL (publish not driven) | **OWED** |
| R02 FAQ management | route note | QA31 | admin render | AO |
| **Groups S/T/U/V/W/X/Y/Z/N2** | support/analytics/audit/monitoring/sidebar/AC/palette/health/fin-audit | QA29/30/31 | all admin-only surfaces (confirmed per task — no `Surfaces` mobile line, no user-facing change) | AO (incl. X05/X06 handled above as OWED because they are moderation/action commits with buyer/seller mobile effect; X07 fixture-gated AO) |

---

## 3. Confirmed admin-only / no mobile leg owed (explicit list — "confirm, don't assume")

- **Group A** A01–A06 (admin login/dashboard/layout) — AO.
- **Group B-read** B01/B02/B05/B08 (users list/drawer/analytics/sort) — read-only admin views of user data; no user-facing change — AO.
- **Group C list** C01/C02 (listings + flagged queue renders), C05 (Review-modal appeal info doc) — AO.
- **Group D list** D01 (category list render) — AO.
- **Group E list** E01 (nodes stats), E08 (waitlist API auth) — AO.
- **Group F** F01 (config hub generic), F04 (single-source cross-surface — both admin), F07 (pipeline board), F09 (fee-tier distribution analytics), F10 (legacy read-only keys) — AO.
- **Group G** G01 (policy tabs), G02/G03 (policy **draft** create/edit — no user impact until publish) — AO.
- **Group H** H01–H06 — admin read-only views of mobile trade data (the task's "likely lower/no mobile impact, confirm" — confirmed: no `Surfaces:` line, no admin-initiated user-visible change; viewing a trade is read-only) — AO.
- **Group I** I01 (queue/SLA), I05 (filter tabs) — admin-only.
- **Group J** tax admin pages — AO.
- **Group K** K01/K02/Z05 (+K03 fixture-gated PARTIAL, X07) — admin payout surfaces.
- **Group L** L01/L02/L03/L06 — SP dashboards/metrics (admin-only).
- **Group M** M02/M05/M06 — subscriptions list/metrics/free-filter (admin-only; M05's window-scoped cards already flagged R54).
- **Group N** N01/N02/N04 — referral config/analytics (admin-only).
- **Group O** O01 — ID-badge queue (admin-only).
- **Group R** R02 — FAQ route note (admin-only).
- **Groups S/T/U** support inbox/analytics/audit — admin-only.
- **Group V** monitoring/cron — admin-only.
- **Group W** sidebar — admin-only.
- **Group Y** command palette (⌘K) — admin-only.
- **Group Z** health strip — admin-only.
- **Group N2** financial audit (N2-A01..A08) — admin-only.
- **X-group admin-only:** X01–X04 (AC cards/bundling/severity/expand), X07 (retry — fixture-gated), X08–X14 (empty state/pin/bell/drift/embed/insights) — admin-only.
- **X05/X06** are exceptions (moderation/action commits) — listed under OWED above.

---

## 4. Phase 2 scope decision (from this audit + QA31's 24-row list)

Prioritized closure queue (task's order). Items marked **🔵 drivable-this-session** have feasible fixtures (see R-NEW-6 checks); items marked **🟠 fixture-gap** need a new sanctioned fixture/decision and are flagged explicitly rather than worked around:

1. 🔵 **Wallet freeze/suspend mobile enforcement** — B04/L04/L05/L08: freeze test-buyer wallet via admin `/sp-wallet` → mobile frozen observation → unfreeze → mobile re-enabled → DB+audit verify + revert.
2. 🟠 **Group F trade-timing changed-value enforcement** — needs a live in-progress trade + a scoped low-risk timing change; no in-progress trade currently exists on QA personas (DB-verified). **Flag: new dev-enabler fixture (a sanctioned in-progress trade + non-destructive timing-change recipe) needed**; the enforcement rules themselves are already mobile-proven at baseline in TRD runs.
3. 🔵 **Moderation visibility** (C-group + X05 representative): disposable listings → admin reject (seller mobile sees rejected+reason; not buyer-visible) and approve (buyer mobile can load) → cleanup.
4. 🔵/🟠 **SP caps D06/D07**: scoped category cap change → mobile SP-entry clamp (redemption-cap class already mobile-proven in QA Task 16 TRD-A4) → revert. **Node/radius/waitlist E02–E05** largely 🟠 (node assignment/join/waitlist need user-level fixtures) — drive E04-radius if budget permits, else flag.
5. 🟠 **B-group suspend/unsuspend mobile access** — commit leg BLOCKED-on-tooling (native `prompt()`), so no admin commit exists to reflect; flag (unchanged from prior rounds).
6. 🟠 **Remainder** (Q reviews, O04, N03, P01–P03, D05/D08/D09/D10, M03/M04, R01/R03, G04, I03/I04/X06 dispute-reflection): dispute-reflection needs a fresh in-progress trade (🟠 fixture-gap, same as #2); Q hide/approve commit leg was never executed (🟠 needs a reported review fixture on a clean target); M03/M04 deferred to QA Task 32 (SUB round, R40-explicit); G04 forward-only publish has no safe revert (🟠 product decision); the rest are either low-priority display effects or need dedicated fixtures (R41-class) — recorded as OWED with precise reasons.

**New fixture gaps flagged (explicitly, not worked around):**
- **FG-1 (F-group, I-group, X06):** no sanctioned in-progress trade fixture exists right now (all QA-persona trades are completed/cancelled). Changed-value trade-timing enforcement AND dispute-resolution mobile reflection both need one. Recommend a dev-authored r41-style "create in-progress trade" fixture (or re-open the consumed dispute fixtures).
- **FG-2 (Q-group):** the review hide/approve commit leg needs a reported review on a clean target; multi-account/report-fixture assembly is an R41-class dedicated-fixture need.
- **FG-3 (G04):** policy publish is forward-only (no revert); a "restore previous active" affordance is needed before the publish commit + mobile gate can be driven safely.
- **FG-4 (M03/M04):** already R40-deferred to QA Task 32 (SUB money round) — commit legs not yet executed.
- **FG-5 (B03/B06/B07):** unchanged ADM-R3 prompt()-tooling blocker.
